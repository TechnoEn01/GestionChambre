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
  LockRecord,
  ActionLogRecord,
} from '../types/domain'
import {
  subscribeToDocData,
  fetchDocData,
  mapEleves,
  mapGroupes,
  mapChambres,
  mapLocks,
  mapActionLogs,
  assignEleveToGroupe as assignEleveToGroupeApi,
  assignGroupeToChambre as assignGroupeToChambreApi,
  createGroupe as createGroupeApi,
  removeGroupe as removeGroupeApi,
  updateGroupeCouleur as updateGroupeCouleurApi,
  getGristEnvironment,
  getDocApi,
  isLockActive,
  logAction,
  type CurrentUserInfo,
} from '../grist/gristClient'

/** Infos brutes reçues de Grist, pour le debug (noms de tables et colonnes). */
export interface GristDebugInfo {
  tableNames: string[]
  eleveRowCount: number
  eleveColumns: string[]
}

type ResourceType = 'Eleve' | 'Groupe'

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
  /** Séjour affiché (1 ou 2). (hérité V1, peut être ignoré V2 si inutile) */
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

  /** Verrouille un élève (Lock table). */
  lockEleve: (eleveId: number) => Promise<void>
  /** Déverrouille un élève. */
  unlockEleve: (eleveId: number) => Promise<void>
  /** Verrouille un groupe. */
  lockGroupe: (groupeId: number) => Promise<void>
  /** Déverrouille un groupe. */
  unlockGroupe: (groupeId: number) => Promise<void>

  /** utilisateur effectif utilisé par les verrous (affichage uniquement) */
  currentUser: string
  /** WidgetSessionId stable pour toute la durée de vie du widget. */
  widgetSessionId: string
  /** Logs bruts (pour debug éventuel). */
  actionLogs: ActionLogRecord[]

  /** Infos session (legacy) et label brut docInfo, pour compat avec l'UI actuelle. */
  sessionUserInfo: CurrentUserInfo | null
  docUserLabel: string
  /** Dernière erreur technique détaillée (stack / message), visible en mode debug. */
  lastErrorDetails: string | null
}

const AppStateContext = createContext<AppState | undefined>(undefined)

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState doit être utilisé dans un AppStateProvider')
  }
  return ctx
}

/** Génère un identifiant unique par session widget (rafraîchi seulement au reload de l’iframe). */
function generateWidgetSessionId(): string {
  return `cc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Filtrer les locks d’une ressource donnée. */
function getLocksForResource(
  locks: LockRecord[],
  resourceType: ResourceType,
  resourceId: number,
): LockRecord[] {
  return locks.filter((l) => l.resourceType === resourceType && l.resourceId === resourceId)
}

/** Choisir un lock gagnant de manière déterministe (par exemple, plus ancien CreatedAt ou plus petit id). */
function pickWinningLock(candidates: LockRecord[]): LockRecord | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => {
    const ta = Date.parse(a.createdAt || '') || 0
    const tb = Date.parse(b.createdAt || '') || 0
    if (ta !== tb) return ta - tb
    return a.id - b.id
  })
  return sorted[0]
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
  const [locks, setLocks] = useState<LockRecord[]>([])
  const [actionLogs, setActionLogs] = useState<ActionLogRecord[]>([])
  const [schemaOk, setSchemaOk] = useState<boolean>(true)
  const [gristDebugInfo, setGristDebugInfo] = useState<GristDebugInfo | null>(null)

  const [currentUser, setCurrentUser] = useState<string>('Anonyme')
  const [lastErrorDetails, setLastErrorDetails] = useState<string | null>(null)
  const widgetSessionIdRef = useRef<string>(generateWidgetSessionId())

  // Legacy pour debug UI actuel
  const [sessionUserInfo, setSessionUserInfo] = useState<CurrentUserInfo | null>(null)
  const [docUserLabel, setDocUserLabel] = useState<string>('Anonyme')

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

        setLocks(mapLocks(docData, env.mapping))
        setActionLogs(mapActionLogs(docData, env.mapping))
      },
      (info) => {
        const user = info?.user
        const label = user?.email || user?.name || 'Anonyme'
        setCurrentUser(label)
        setDocUserLabel(label)
        // On ne s'appuie plus sur SessionUser comme vérité, on la laisse à null pour l'instant.
        setSessionUserInfo(null)
      },
      (err) => {
        console.error('[Composition Chambre] Erreur Grist :', err)
        setUi((prev) => ({
          ...prev,
          isSyncing: false,
          errorMessage: 'Erreur lors de la lecture des données Grist.',
        }))
        setLastErrorDetails(String((err as any)?.stack || (err as any)?.message || err))
      },
    )
    if (result?.refresh) refreshDataRef.current = result.refresh
    return () => {}
  }, [env.mapping])

  /**
   * Vue décorée avec les verrous issus de la table Lock.
   * Source de vérité = Lock, les champs Eleve.verrou / Groupe.lockedBy sont des vues.
   */
  const elevesWithLocks = useMemo<EleveRecord[]>(() => {
    if (locks.length === 0) return eleves
    const now = new Date()
    const activeLocks = locks.filter(
      (l) => l.resourceType === 'Eleve' && isLockActive(l, now),
    )
    return eleves.map((e) => {
      const candidates = activeLocks.filter((l) => l.resourceId === e.id)
      const winning = pickWinningLock(candidates)
      if (!winning) {
        return { ...e, verrou: undefined, lockedAt: undefined }
      }
      const lockedBy = winning.createdByName || winning.widgetSessionId || undefined
      const lockedAt = winning.createdAt || winning.lastModifiedAt || undefined
      return { ...e, verrou: lockedBy, lockedAt }
    })
  }, [eleves, locks])

  const groupesWithLocks = useMemo<GroupeRecord[]>(() => {
    if (locks.length === 0) return groupes
    const now = new Date()
    const activeLocks = locks.filter(
      (l) => l.resourceType === 'Groupe' && isLockActive(l, now),
    )
    return groupes.map((g) => {
      const candidates = activeLocks.filter((l) => l.resourceId === g.id)
      const winning = pickWinningLock(candidates)
      if (!winning) {
        return { ...g, lockedBy: undefined, lockedAt: undefined }
      }
      const lockedBy = winning.createdByName || winning.widgetSessionId || undefined
      const lockedAt = winning.createdAt || winning.lastModifiedAt || undefined
      return { ...g, lockedBy, lockedAt }
    })
  }, [groupes, locks])

  const filteredEleves = useMemo(
    () => elevesWithLocks.filter((e) => (e.sejour ?? 1) === ui.selectedSejour),
    [elevesWithLocks, ui.selectedSejour],
  )

  const filteredGroupes = useMemo(
    () => groupesWithLocks.filter((g) => (g.sejour ?? 1) === ui.selectedSejour),
    [groupesWithLocks, ui.selectedSejour],
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

  const classes = useMemo(
    () =>
      Array.from(new Set(filteredEleves.map((e) => e.classe)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [filteredEleves],
  )

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

  const createLock = useCallback(
    async (resourceType: ResourceType, resourceId: number, resourceLabel: string) => {
      const api = getDocApi()
      const mapping = env.mapping
      if (!api || !mapping.lock) return null

      const now = new Date()
      const expiresAt = new Date(now.getTime() + 2 * 60 * 1000) // 2 minutes
      const lockTable = mapping.lock

      const existing = getLocksForResource(locks, resourceType, resourceId).filter((l) =>
        isLockActive(l, now),
      )
      const foreignActive = existing.filter(
        (l) => l.widgetSessionId !== widgetSessionIdRef.current,
      )
      if (foreignActive.length > 0) {
        const l = pickWinningLock(foreignActive)!
        setUi((prev) => ({
          ...prev,
          errorMessage: `Ressource déjà manipulée par ${l.createdByName || l.widgetSessionId}`,
        }))
        setLastErrorDetails(
          `Lock conflict on ${resourceType}#${resourceId} — winningLockId=${l.id}, widgetSessionId=${l.widgetSessionId}, createdAt=${l.createdAt}`,
        )
        return null
      }

      try {
        await api.applyUserActions([
          [
            'AddRecord',
            lockTable.table,
            null,
            (() => {
              const payload: Record<string, any> = {
                [lockTable.columns.resourceType]: resourceType,
                [lockTable.columns.resourceId]: resourceId,
                [lockTable.columns.resourceLabel]: resourceLabel,
                [lockTable.columns.widgetSessionId]: widgetSessionIdRef.current,
                [lockTable.columns.lockState]: 'active',
              }
              if (lockTable.columns.expiresAt) {
                payload[lockTable.columns.expiresAt] = expiresAt.toISOString()
              }
              return payload
            })(),
          ],
        ])
        await refreshDataRef.current()
        return true
      } catch (err) {
        console.error('[Composition Chambre] Erreur création lock :', err)
        setUi((prev) => ({
          ...prev,
          errorMessage: "Impossible de verrouiller l'élément (Lock).",
        }))
        setLastErrorDetails(String((err as any)?.stack || (err as any)?.message || err))
        return null
      }
    },
    [env.mapping, locks],
  )

  const releaseLocksForResource = useCallback(
    async (resourceType: ResourceType, resourceId: number) => {
      const api = getDocApi()
      const mapping = env.mapping
      if (!api || !mapping.lock) return

      const lockTable = mapping.lock
      const now = new Date()
      // Recharger les locks depuis le serveur pour être sûr d'avoir le lock qu'on vient de créer
      // (le state React peut ne pas être à jour encore).
      let currentLocks: LockRecord[]
      try {
        const docData = await fetchDocData(mapping)
        currentLocks = mapLocks(docData, mapping)
      } catch (err) {
        console.error('[Composition Chambre] Erreur fetch locks pour release :', err)
        setLastErrorDetails(String((err as any)?.stack || (err as any)?.message || err))
        return
      }
      const resourceLocks = getLocksForResource(currentLocks, resourceType, resourceId)

      const actions: any[] = []
      for (const l of resourceLocks) {
        if (!isLockActive(l, now)) continue
        if (l.widgetSessionId === widgetSessionIdRef.current) {
          const update: Record<string, any> = {
            [lockTable.columns.lockState]: 'released',
          }
          if (lockTable.columns.expiresAt) {
            update[lockTable.columns.expiresAt] = now.toISOString()
          }
          actions.push(['UpdateRecord', lockTable.table, l.id, update])
        }
      }
      if (actions.length === 0) return

      try {
        await api.applyUserActions(actions)
        await refreshDataRef.current()
      } catch (err) {
        console.error('[Composition Chambre] Erreur release lock :', err)
        setLastErrorDetails(String((err as any)?.stack || (err as any)?.message || err))
      }
    },
    [env.mapping],
  )

  const lockEleve = useCallback(
    async (eleveId: number) => {
      const eleve = eleves.find((e) => e.id === eleveId)
      if (!eleve) return
      const label = `${eleve.nom} ${eleve.prenom}`.trim() || `Eleve ${eleveId}`
      const ok = await createLock('Eleve', eleveId, label)
      if (!ok) return
      await logAction(
        env.mapping,
        'lock_start',
        widgetSessionIdRef.current,
        'Eleve',
        eleveId,
        '',
      )
    },
    [createLock, eleves, env.mapping],
  )

  const unlockEleve = useCallback(
    async (eleveId: number) => {
      await releaseLocksForResource('Eleve', eleveId)
      await logAction(
        env.mapping,
        'lock_release',
        widgetSessionIdRef.current,
        'Eleve',
        eleveId,
        '',
      )
    },
    [env.mapping, releaseLocksForResource],
  )

  const lockGroupe = useCallback(
    async (groupeId: number) => {
      const groupe = groupes.find((g) => g.id === groupeId)
      if (!groupe) return
      const label = `Groupe ${groupe.numGroupe}`
      const ok = await createLock('Groupe', groupeId, label)
      if (!ok) return
      await logAction(
        env.mapping,
        'lock_start',
        widgetSessionIdRef.current,
        'Groupe',
        groupeId,
        '',
      )
    },
    [createLock, env.mapping, groupes],
  )

  const unlockGroupe = useCallback(
    async (groupeId: number) => {
      await releaseLocksForResource('Groupe', groupeId)
      await logAction(
        env.mapping,
        'lock_release',
        widgetSessionIdRef.current,
        'Groupe',
        groupeId,
        '',
      )
    },
    [env.mapping, releaseLocksForResource],
  )

  const moveEleveToGroupe = useCallback(
    async (eleveId: number, groupeId: number | null) => {
      const who = currentUser || 'Anonyme'
      try {
        await assignEleveToGroupeApi(eleveId, groupeId, env.mapping, who)
        setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
        await refreshDataRef.current()
        setUi((prev) => ({ ...prev, isSyncing: false }))
        await logAction(
          env.mapping,
          'move_eleve',
          widgetSessionIdRef.current,
          'Eleve',
          eleveId,
          groupeId != null ? `vers groupe ${groupeId}` : 'retiré du groupe',
        )
        await releaseLocksForResource('Eleve', eleveId)
      } catch (error: any) {
        console.error('[Composition Chambre] Erreur d’écriture Eleve.Groupe :', error)
        setUi((prev) => ({
          ...prev,
          readOnly: true,
          errorMessage:
            "Impossible d'enregistrer la modification (probable mode lecture seule ou manque de droits). Vérifiez dans Grist que vous avez le droit d'éditer le document et les tables Eleve / Groupe.",
        }))
        setLastErrorDetails(String(error?.stack || error?.message || error))
        await logAction(
          env.mapping,
          'error',
          widgetSessionIdRef.current,
          'Eleve',
          eleveId,
          String(error?.message || error),
        )
      }
    },
    [currentUser, env.mapping, releaseLocksForResource],
  )

  const moveGroupeToChambre = useCallback(
    async (groupeId: number, chambreId: number | null) => {
      const who = currentUser || 'Anonyme'
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
        await assignGroupeToChambreApi(groupeId, chambreId, env.mapping, who)
        setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
        await refreshDataRef.current()
        setUi((prev) => ({ ...prev, isSyncing: false }))
        await logAction(
          env.mapping,
          'group_to_chambre',
          widgetSessionIdRef.current,
          'Groupe',
          groupeId,
          chambreId != null ? `vers chambre ${chambreId}` : 'retiré de la chambre',
        )
        await releaseLocksForResource('Groupe', groupeId)
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
        setLastErrorDetails(String(error?.stack || error?.message || error))
        await logAction(
          env.mapping,
          'error',
          widgetSessionIdRef.current,
          'Groupe',
          groupeId,
          String(error?.message || error),
        )
      }
    },
    [chambresAvecStats, currentUser, env.mapping, groupesAvecEleves, releaseLocksForResource],
  )

  const createGroupeCallback = useCallback(async (): Promise<number> => {
    const nextNum =
      filteredGroupes.length === 0
        ? 1
        : Math.max(...filteredGroupes.map((g) => g.numGroupe)) + 1
    const initialCouleur = '#4f46e5'
    const newId = await createGroupeApi(
      nextNum,
      ui.selectedSejour,
      env.mapping,
      initialCouleur,
    )
    setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
    await refreshDataRef.current()
    setUi((prev) => ({ ...prev, isSyncing: false }))
    await logAction(
      env.mapping,
      'create_groupe',
      widgetSessionIdRef.current,
      'Groupe',
      newId,
      '',
    )
    return newId
  }, [env.mapping, filteredGroupes, ui.selectedSejour])

  const removeGroupeCallback = useCallback(
    async (groupeId: number, eleveIds: number[]) => {
      try {
        await removeGroupeApi(groupeId, eleveIds, env.mapping)
        setUi((prev) => ({ ...prev, isSyncing: true, errorMessage: null }))
        await refreshDataRef.current()
        setUi((prev) => ({ ...prev, isSyncing: false }))
        await logAction(
          env.mapping,
          'delete_groupe',
          widgetSessionIdRef.current,
          'Groupe',
          groupeId,
          `avec ${eleveIds.length} élève(s) détaché(s)`,
        )
      } catch (error: any) {
        console.error('[Composition Chambre] Erreur suppression groupe :', error)
        setUi((prev) => ({
          ...prev,
          readOnly: true,
          errorMessage:
            "Impossible de supprimer le groupe (droits ou colonnes manquantes). Vérifiez l'accès en écriture.",
        }))
        setLastErrorDetails(String(error?.stack || error?.message || error))
        await logAction(
          env.mapping,
          'error',
          widgetSessionIdRef.current,
          'Groupe',
          groupeId,
          String(error?.message || error),
        )
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
        setLastErrorDetails(String(error?.stack || error?.message || error))
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
    lockEleve,
    unlockEleve,
    lockGroupe,
    unlockGroupe,
    currentUser,
    widgetSessionId: widgetSessionIdRef.current,
    actionLogs,
    sessionUserInfo,
    docUserLabel,
    lastErrorDetails,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export default AppStateContext

