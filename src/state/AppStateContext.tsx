import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  EleveRecord,
  GroupeRecord,
  ChambreRecord,
  ChambreWithStats,
  GroupeWithMembers,
  UiState,
  ThemeMode,
} from '../types/domain'
import {
  subscribeToDocData,
  mapEleves,
  mapGroupes,
  mapChambres,
  assignEleveToGroupe,
  assignGroupeToChambre,
  createGroupe,
  removeGroupe as removeGroupeApi,
  updateGroupeCouleur as updateGroupeCouleurApi,
  setEleveVerrou,
  setGroupeLock,
  clearGroupeLock,
  ensureSessionUser,
  getGristEnvironment,
  logAction,
  type CurrentUserInfo,
} from '../grist/gristClient'
import { getNewGroupColor } from '../config/groupColors'

/** Infos brutes reçues de Grist, pour le debug (noms de tables et colonnes). */
export interface GristDebugInfo {
  tableNames: string[]
  eleveRowCount: number
  eleveColumns: string[]
}

interface AppState {
  ui: UiState
  eleves: EleveRecord[]
  groupes: GroupeRecord[]
  chambres: ChambreRecord[]
  groupesAvecEleves: GroupeWithMembers[]
  chambresAvecStats: ChambreWithStats[]
  elevesSansGroupe: EleveRecord[]
  /** Liste des classes distinctes (pour filtre). */
  classes: string[]
  schemaOk: boolean
  /** Renseigné à chaque réception de données Grist (pour le mode Debug). */
  gristDebugInfo: GristDebugInfo | null
  // Actions UI
  setTheme: (mode: ThemeMode) => void
  toggleCompactMode: () => void
  toggleDebug: () => void
  /** Réglage du nombre de chambres par ligne (mode non compact). */
  setRoomsPerLine: (n: number) => void
  /** Séjour affiché (1 ou 2). */
  selectedSejour: 1 | 2
  setSelectedSejour: (s: 1 | 2) => void
  // Actions métier
  moveEleveToGroupe: (eleveId: number, groupeId: number | null) => Promise<void>
  moveGroupeToChambre: (groupeId: number, chambreId: number | null) => Promise<void>
  /** Crée un nouveau groupe et retourne son id. */
  createGroupe: () => Promise<number>
  /** Retire les élèves du groupe puis supprime le groupe. */
  removeGroupe: (groupeId: number, eleveIds: number[]) => Promise<void>
  /** Met à jour la couleur du groupe (hex #rrggbb), enregistrée dans Grist (Couleur). */
  updateGroupeCouleur: (groupeId: number, hexColor: string) => Promise<void>
  /** Verrouille un élève (LockedBy / Verrou = utilisateur courant). */
  lockEleve: (eleveId: number) => Promise<void>
  /** Déverrouille un élève. */
  unlockEleve: (eleveId: number) => Promise<void>
  /** Verrouille un groupe (page chambres). */
  lockGroupe: (groupeId: number) => Promise<void>
  /** Déverrouille un groupe (annulation drag ou après drop). */
  unlockGroupe: (groupeId: number) => Promise<void>
  /** Utilisateur courant (SessionUser ou docInfo), pour debug et verrous. */
  currentUser: string
  /** Infos session (email, name, sessionId) pour le mode debug. */
  sessionUserInfo: CurrentUserInfo | null
}

const AppStateContext = createContext<AppState | undefined>(undefined)

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState doit être utilisé dans un AppStateProvider')
  }
  return ctx
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ui, setUi] = useState<UiState>({
    theme: 'light',
    compactMode: false,
    isSyncing: true,
    readOnly: false,
    debug: { enabled: false },
    errorMessage: null,
    hasGroupRoomLink: false,
    roomsPerLine: 4,
    selectedSejour: 1,
  })
  const [eleves, setEleves] = useState<EleveRecord[]>([])
  const [groupes, setGroupes] = useState<GroupeRecord[]>([])
  const [chambres, setChambres] = useState<ChambreRecord[]>([])
  const [schemaOk, setSchemaOk] = useState<boolean>(true)
  const [gristDebugInfo, setGristDebugInfo] = useState<GristDebugInfo | null>(null)
  const [currentUser, setCurrentUser] = useState<string>('')
  const [sessionUserInfo, setSessionUserInfo] = useState<CurrentUserInfo | null>(null)
  const refreshDataRef = useRef<() => Promise<void>>(async () => {})

  const env = getGristEnvironment()

  useEffect(() => {
    const result = subscribeToDocData(
      (docData) => {
        const mapping = env.mapping
        const tableNames = Object.keys(docData)
        const eleveTable = docData[mapping.eleve.table]
        const eleveRowCount = eleveTable?.id?.length ?? 0
        const eleveColumns = eleveTable ? Object.keys(eleveTable) : []
        setGristDebugInfo({ tableNames, eleveRowCount, eleveColumns })

        const missing: string[] = []
        if (!docData[mapping.eleve.table]) missing.push(`table "${mapping.eleve.table}"`)
        if (!docData[mapping.groupe.table]) missing.push(`table "${mapping.groupe.table}"`)
        if (!docData[mapping.chambre.table]) missing.push(`table "${mapping.chambre.table}"`)

        if (missing.length > 0) {
          setSchemaOk(false)
          setUi((prev) => ({
            ...prev,
            isSyncing: false,
            errorMessage: `Configuration Grist incomplète : ${missing.join(', ')} introuvable(s).`,
          }))
          return
        }

        setSchemaOk(true)
        setUi((prev) => ({
          ...prev,
          isSyncing: false,
          errorMessage: null,
          hasGroupRoomLink: Boolean(mapping.groupeChambreColumn),
        }))
        setEleves(mapEleves(docData, env.mapping))
        setGroupes(mapGroupes(docData, env.mapping))
        setChambres(mapChambres(docData, env.mapping))
      },
      async (info) => {
        try {
          const session = await ensureSessionUser(env.mapping, info?.user ?? null)
          setSessionUserInfo(session)
          setCurrentUser(session.name || session.email || 'Anonyme')
        } catch {
          const user = info?.user
          setSessionUserInfo(null)
          setCurrentUser(user?.email || user?.name || 'Anonyme')
        }
      },
      (err) => {
        console.error('[Composition Chambre] Erreur Grist :', err)
        setUi((prev) => ({
          ...prev,
          isSyncing: false,
          errorMessage: 'Erreur lors de la lecture des données Grist.',
        }))
      },
    )
    if (result?.refresh) refreshDataRef.current = result.refresh
    return () => {}
  }, [env.mapping])

  const filteredEleves = useMemo(
    () => eleves.filter((e) => (e.sejour ?? 1) === ui.selectedSejour),
    [eleves, ui.selectedSejour],
  )

  const filteredGroupes = useMemo(
    () => groupes.filter((g) => (g.sejour ?? 1) === ui.selectedSejour),
    [groupes, ui.selectedSejour],
  )

  const groupesAvecEleves = useMemo<GroupeWithMembers[]>(() => {
    const elevesParGroupe = new Map<number, EleveRecord[]>()
    for (const g of filteredGroupes) {
      elevesParGroupe.set(g.id, [])
    }
    for (const e of filteredEleves) {
      if (e.groupeId != null) {
        const list = elevesParGroupe.get(e.groupeId)
        if (list) list.push(e)
      }
    }
    return filteredGroupes.map((g) => ({
      ...g,
      eleves: elevesParGroupe.get(g.id) ?? [],
    }))
  }, [filteredGroupes, filteredEleves])

  const chambresAvecStats = useMemo<ChambreWithStats[]>(() => {
    const totalParChambre = new Map<number, number>()
    for (const chambre of chambres) {
      totalParChambre.set(chambre.id, 0)
    }
    for (const g of groupesAvecEleves) {
      if (g.chambreId != null) {
        const current = totalParChambre.get(g.chambreId) ?? 0
        totalParChambre.set(g.chambreId, current + g.eleves.length)
      }
    }
    return chambres.map((c) => {
      const totalEleves = totalParChambre.get(c.id) ?? 0
      return {
        ...c,
        totalEleves,
        capaciteRestante: Math.max(0, c.capacite - totalEleves),
      }
    })
  }, [chambres, groupesAvecEleves])

  const elevesSansGroupe = useMemo(
    () =>
      filteredEleves
        .filter((e) => e.groupeId == null || e.groupeId === 0)
        .sort((a, b) => a.nom.localeCompare(b.nom)),
    [filteredEleves],
  )

  const classes = useMemo(() => {
    const set = new Set<string>()
    for (const e of filteredEleves) {
      if (e.classe?.trim()) set.add(e.classe.trim())
    }
    return [...set].sort()
  }, [filteredEleves])

  const setTheme = useCallback((mode: ThemeMode) => {
    setUi((prev) => ({ ...prev, theme: mode }))
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode
    }
  }, [])

  const toggleCompactMode = useCallback(() => {
    setUi((prev) => ({ ...prev, compactMode: !prev.compactMode }))
  }, [])

  const toggleDebug = useCallback(() => {
    setUi((prev) => ({ ...prev, debug: { enabled: !prev.debug.enabled } }))
  }, [])

  const setRoomsPerLine = useCallback((n: number) => {
    setUi((prev) => ({ ...prev, roomsPerLine: Math.max(1, Math.min(4, n)) }))
  }, [])

  const setSelectedSejour = useCallback((s: 1 | 2) => {
    setUi((prev) => ({ ...prev, selectedSejour: s }))
  }, [])

  const moveEleveToGroupe = useCallback(
    async (eleveId: number, groupeId: number | null) => {
      try {
        await assignEleveToGroupe(eleveId, groupeId, env.mapping, currentUser || 'Anonyme')
        setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
        await refreshDataRef.current()
        setUi((prev) => ({ ...prev, isSyncing: false }))
      } catch (error: any) {
        console.error('[Composition Chambre] Erreur d’écriture Eleve.Groupe :', error)
        setUi((prev) => ({
          ...prev,
          readOnly: true,
          errorMessage:
            "Impossible d'enregistrer la modification (probable mode lecture seule ou manque de droits). Vérifiez dans Grist que vous avez le droit d'éditer le document et les tables Eleve / Groupe.",
        }))
      }
    },
    [currentUser, env.mapping],
  )

  const moveGroupeToChambre = useCallback(
    async (groupeId: number, chambreId: number | null) => {
      const who = currentUser || 'Anonyme'
      // Vérification de capacité : refus si la chambre ne peut accueillir tous les élèves du groupe.
      const groupe = groupesAvecEleves.find((g) => g.id === groupeId)
      const chambre = chambresAvecStats.find((c) => c.id === chambreId)
      if (groupe && chambre) {
        const tailleGroupe = groupe.eleves.length
        if (tailleGroupe > chambre.capaciteRestante) {
          alert(
            `La chambre "${chambre.nomChambre}" n'a pas assez de place pour ce groupe (${tailleGroupe} élèves, capacité restante ${chambre.capaciteRestante}).`,
          )
          return
        }
      }
      try {
        await assignGroupeToChambre(groupeId, chambreId, env.mapping, currentUser || 'Anonyme')
        setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
        await refreshDataRef.current()
        setUi((prev) => ({ ...prev, isSyncing: false }))
      } catch (error: any) {
        console.error('[Composition Chambre] Erreur d’écriture Groupe.Chambre :', error)
        const message =
          error instanceof Error && error.message.includes('Groupe → Chambre')
            ? 'La colonne "Chambre" dans la table "Groupe" est manquante : impossible de déposer un groupe dans une chambre.'
            : "Impossible d'enregistrer la modification (probable mode lecture seule ou manque de droits)."
        setUi((prev) => ({
          ...prev,
          readOnly: true,
          errorMessage: message,
        }))
        await logAction(env.mapping, 'error', who, 'Groupe', groupeId, String(error?.message || error))
      }
    },
    [chambresAvecStats, currentUser, env.mapping, groupesAvecEleves],
  )

  const createGroupeCallback = useCallback(async (): Promise<number> => {
    const nextNum =
      filteredGroupes.length === 0
        ? 1
        : Math.max(...filteredGroupes.map((g) => g.numGroupe)) + 1
    const usedColors = filteredGroupes
      .map((g) => g.couleur)
      .filter((c): c is string => Boolean(c))
    const initialCouleur = getNewGroupColor(filteredGroupes.length, usedColors)
    const newId = await createGroupe(
      nextNum,
      ui.selectedSejour,
      env.mapping,
      initialCouleur,
    )
    setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
    await refreshDataRef.current()
    setUi((prev) => ({ ...prev, isSyncing: false }))
    return newId
  }, [env.mapping, filteredGroupes, ui.selectedSejour])

  const removeGroupeCallback = useCallback(
    async (groupeId: number, eleveIds: number[]) => {
      try {
        await removeGroupeApi(groupeId, eleveIds, env.mapping)
        setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
        await refreshDataRef.current()
        setUi((prev) => ({ ...prev, isSyncing: false }))
      } catch (error: any) {
        console.error('[Composition Chambre] Erreur suppression groupe :', error)
        setUi((prev) => ({
          ...prev,
          readOnly: true,
          errorMessage:
            "Impossible de supprimer le groupe (droits ou colonnes manquantes). Vérifiez l'accès en écriture.",
        }))
      }
    },
    [env.mapping],
  )

  const updateGroupeCouleurCallback = useCallback(
    async (groupeId: number, hexColor: string) => {
      try {
        await updateGroupeCouleurApi(groupeId, hexColor, env.mapping)
        setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
        await refreshDataRef.current()
        setUi((prev) => ({ ...prev, isSyncing: false }))
      } catch (error: any) {
        console.error('[Composition Chambre] Erreur mise à jour couleur groupe :', error)
        setUi((prev) => ({
          ...prev,
          errorMessage: "Impossible d'enregistrer la couleur du groupe.",
        }))
      }
    },
    [env.mapping],
  )

  const lockEleveCallback = useCallback(
    async (eleveId: number) => {
      const eleve = eleves.find((e) => e.id === eleveId)
      const lockedBy = eleve?.lockedBy ?? eleve?.verrou
      const who = currentUser || 'Anonyme'
      if (lockedBy && lockedBy !== who) {
        setUi((prev) => ({
          ...prev,
          errorMessage: `En cours de manipulation par ${lockedBy}`,
        }))
        return
      }
      try {
        await setEleveVerrou(eleveId, who, env.mapping)
        await refreshDataRef.current()
        await logAction(env.mapping, 'lock_eleve', who, 'Eleve', eleveId, '')
      } catch (error: any) {
        console.warn('[Composition Chambre] Verrouillage élève :', error)
        setUi((prev) => ({ ...prev, errorMessage: 'Verrouillage impossible (colonne Verrou/LockedBy manquante ?).' }))
      }
    },
    [currentUser, eleves, env.mapping],
  )

  const unlockEleveCallback = useCallback(
    async (eleveId: number) => {
      try {
        await setEleveVerrou(eleveId, null, env.mapping)
        await refreshDataRef.current()
      } catch (error: any) {
        console.warn('[Composition Chambre] Déverrouillage élève :', error)
      }
    },
    [env.mapping],
  )

  const lockGroupeCallback = useCallback(
    async (groupeId: number) => {
      const groupe = groupes.find((g) => g.id === groupeId)
      const lockedBy = groupe?.lockedBy
      const who = currentUser || 'Anonyme'
      if (lockedBy && lockedBy !== who) {
        setUi((prev) => ({
          ...prev,
          errorMessage: `Groupe en cours de manipulation par ${lockedBy}`,
        }))
        return
      }
      try {
        await setGroupeLock(groupeId, who, env.mapping)
        await refreshDataRef.current()
        await logAction(env.mapping, 'lock_groupe', who, 'Groupe', groupeId, '')
      } catch (error: any) {
        console.warn('[Composition Chambre] Verrouillage groupe :', error)
      }
    },
    [currentUser, env.mapping, groupes],
  )

  const unlockGroupeCallback = useCallback(
    async (groupeId: number) => {
      try {
        await clearGroupeLock(groupeId, env.mapping)
        await refreshDataRef.current()
      } catch (error: any) {
        console.warn('[Composition Chambre] Déverrouillage groupe :', error)
      }
    },
    [env.mapping],
  )

  const value: AppState = {
    ui,
    eleves: filteredEleves,
    groupes: filteredGroupes,
    chambres,
    groupesAvecEleves,
    chambresAvecStats,
    elevesSansGroupe,
    classes,
    schemaOk,
    gristDebugInfo,
    setTheme,
    toggleCompactMode,
    toggleDebug,
    setRoomsPerLine,
    selectedSejour: ui.selectedSejour,
    setSelectedSejour,
    moveEleveToGroupe,
    moveGroupeToChambre,
    createGroupe: createGroupeCallback,
    removeGroupe: removeGroupeCallback,
    updateGroupeCouleur: updateGroupeCouleurCallback,
    lockEleve: lockEleveCallback,
    unlockEleve: unlockEleveCallback,
    lockGroupe: lockGroupeCallback,
    unlockGroupe: unlockGroupeCallback,
    currentUser: currentUser || 'Anonyme',
    sessionUserInfo,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

