import type {
  Grist,
  GristDocApi,
  GristDocData,
  GristTableData,
  GristDocInfo,
  GristRowRecord,
} from './gristTypes'
import { defaultSchemaMapping, type SchemaMapping } from '../config/schemaConfig'
import type {
  EleveRecord,
  GroupeRecord,
  ChambreRecord,
  LockRecord,
  ActionLogRecord,
  LockState,
} from '../types/domain'

export interface GristEnvironment {
  grist: Grist | null
  mapping: SchemaMapping
}

export function getGristEnvironment(): GristEnvironment {
  const grist = typeof window !== 'undefined' ? window.grist ?? null : null
  return {
    grist,
    mapping: defaultSchemaMapping,
  }
}

export function isGristAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.grist
}

export function getDocApi(): GristDocApi | null {
  return isGristAvailable() ? window.grist!.docApi : null
}

/** Génère un identifiant unique de session widget (pour SessionUser.WidgetSessionId). */
export function generateWidgetSessionId(): string {
  return `cc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface CurrentUserInfo {
  email: string
  name: string
  sessionId: string | null
}

/**
 * Crée ou récupère la session utilisateur dans la table SessionUser et retourne
 * l'email et le nom à utiliser (depuis docInfo ou la ligne créée).
 * Si la table SessionUser n'existe pas ou est absente du mapping, retourne les infos depuis docInfo.
 */
export async function ensureSessionUser(
  mapping: SchemaMapping,
  docInfoUser: { email?: string; name?: string } | null,
): Promise<CurrentUserInfo> {
  const api = getDocApi()
  const email = docInfoUser?.email ?? docInfoUser?.name ?? ''
  const name = docInfoUser?.name ?? docInfoUser?.email ?? 'Anonyme'
  const fallback: CurrentUserInfo = { email: email || 'Anonyme', name: name || 'Anonyme', sessionId: null }

  if (!api || !mapping.sessionUser) return fallback

  const su = mapping.sessionUser
  const sessionId = generateWidgetSessionId()
  const now = new Date().toISOString()

  try {
    await api.applyUserActions([
      [
        'AddRecord',
        su.table,
        null,
        {
          [su.columns.email]: email || 'Anonyme',
          [su.columns.name]: name || 'Anonyme',
          [su.columns.createdAt]: now,
          [su.columns.widgetSessionId]: sessionId,
          [su.columns.active]: true,
        },
      ],
    ])
    return { email: email || 'Anonyme', name: name || 'Anonyme', sessionId }
  } catch (err) {
    console.warn('[Composition Chambre] SessionUser non disponible, utilisation docInfo :', err)
    return fallback
  }
}

/** Passe une table (lignes ou colonnes) au format colonnes attendu par nos mappers. */
function normalizeTableData(raw: GristTableData | GristRowRecord[]): GristTableData {
  if (Array.isArray(raw)) {
    const rows = raw as GristRowRecord[]
    if (rows.length === 0) return { id: [] }
    const cols: Record<string, any[]> = { id: rows.map((r) => r.id) }
    for (const key of Object.keys(rows[0])) {
      if (key === 'id') continue
      cols[key] = rows.map((r) => r[key])
    }
    return cols as GristTableData
  }
  return raw as GristTableData
}

/**
 * Charge les tables Eleve, Groupe, Chambre via docApi.fetchTable (nécessaire en full access :
 * Grist n’envoie pas toujours tout le doc via on('data')).
 */
export async function fetchDocData(mapping: SchemaMapping): Promise<GristDocData> {
  const api = getDocApi()
  if (!api) return {}
  const [eleveRaw, groupeRaw, chambreRaw, lockRaw, logRaw] = await Promise.all([
    api.fetchTable(mapping.eleve.table).catch(() => null),
    api.fetchTable(mapping.groupe.table).catch(() => null),
    api.fetchTable(mapping.chambre.table).catch(() => null),
    mapping.lock ? api.fetchTable(mapping.lock.table).catch(() => null) : Promise.resolve(null),
    mapping.actionLog ? api.fetchTable(mapping.actionLog.table).catch(() => null) : Promise.resolve(null),
  ])
  const docData: GristDocData = {}
  if (eleveRaw) docData[mapping.eleve.table] = normalizeTableData(eleveRaw)
  if (groupeRaw) docData[mapping.groupe.table] = normalizeTableData(groupeRaw)
  if (chambreRaw) docData[mapping.chambre.table] = normalizeTableData(chambreRaw)
  if (lockRaw && mapping.lock) docData[mapping.lock.table] = normalizeTableData(lockRaw)
  if (logRaw && mapping.actionLog) docData[mapping.actionLog.table] = normalizeTableData(logRaw)
  return docData
}

export function subscribeToDocData(
  onData: (data: GristDocData) => void,
  onDocInfo: (info: GristDocInfo) => void,
  onError: (err: any) => void,
): { refresh: () => Promise<void> } | void {
  if (!isGristAvailable()) {
    console.error('[Composition Chambre] Environnement Grist non détecté. Le widget doit être chargé comme custom widget dans Grist.')
    return
  }
  const grist = window.grist!
  const mapping = defaultSchemaMapping
  grist.on('docInfo', onDocInfo)
  grist.on('error', onError)
  grist.on('data', onData)
  grist.ready({ requiredAccess: 'full' })

  const refresh = (): Promise<void> =>
    fetchDocData(mapping).then(onData).catch((err) => {
      console.error('[Composition Chambre] Erreur fetchDocData :', err)
      onError(err)
    })

  refresh()
  return { refresh }
}

function columnValue<T = any>(
  table: GristTableData,
  colName: string,
  index: number,
  defaultValue: T,
): T {
  const col = table[colName]
  if (!col || index >= col.length) return defaultValue
  const v = col[index]
  return (v === null || v === undefined ? defaultValue : v) as T
}

export function mapEleves(data: GristDocData, mapping: SchemaMapping): EleveRecord[] {
  const tableInfo = mapping.eleve
  const table = data[tableInfo.table]
  if (!table || !table.id) return []

  const ids = table.id
  const records: EleveRecord[] = []
  const colSejour = tableInfo.columns.sejour
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    let groupeId = columnValue<number | null>(table, tableInfo.columns.groupeRef, i, null)
    if (groupeId === 0) groupeId = null
    let sejour: 1 | 2 = 1
    if (colSejour) {
      const v = columnValue<number | string>(table, colSejour, i, 1)
      sejour = v === 2 || v === '2' ? 2 : 1
    }
    const lockedBy = tableInfo.columns.lockedBy
      ? columnValue<string | null>(table, tableInfo.columns.lockedBy, i, null)
      : null
    const verrouVal = tableInfo.columns.verrou
      ? columnValue<string | null>(table, tableInfo.columns.verrou, i, null)
      : null
    records.push({
      id,
      nom: columnValue(table, tableInfo.columns.nom, i, ''),
      prenom: columnValue(table, tableInfo.columns.prenom, i, ''),
      classe: columnValue(table, tableInfo.columns.classe, i, ''),
      groupeId,
      verrou: lockedBy ?? verrouVal,
      sejour,
      lockedBy: lockedBy ?? undefined,
      lockedAt: tableInfo.columns.lockedAt
        ? columnValue<string | null>(table, tableInfo.columns.lockedAt, i, null)
        : undefined,
      lastModifiedBy: tableInfo.columns.lastModifiedBy
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedBy, i, null)
        : undefined,
      lastModifiedAt: tableInfo.columns.lastModifiedAt
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedAt, i, null)
        : undefined,
      status: tableInfo.columns.status
        ? columnValue<string | null>(table, tableInfo.columns.status, i, null)
        : undefined,
    })
  }
  return records
}

export function mapGroupes(data: GristDocData, mapping: SchemaMapping): GroupeRecord[] {
  const tableInfo = mapping.groupe
  const table = data[tableInfo.table]
  if (!table || !table.id) return []

  const ids = table.id
  const records: GroupeRecord[] = []
  const colSejour = tableInfo.columns.sejour
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    let sejour: 1 | 2 = 1
    if (colSejour) {
      const v = columnValue<number | string>(table, colSejour, i, 1)
      sejour = v === 2 || v === '2' ? 2 : 1
    }
    records.push({
      id,
      numGroupe: columnValue<number>(table, tableInfo.columns.numGroupe, i, id),
      couleur: columnValue<string>(table, tableInfo.columns.couleur, i, '#4f46e5'),
      ouvert: Boolean(columnValue(table, tableInfo.columns.ouvert, i, true)),
      xPiton: columnValue<number | null>(table, tableInfo.columns.xPiton, i, null),
      yPiton: columnValue<number | null>(table, tableInfo.columns.yPiton, i, null),
      chambreId: mapping.groupeChambreColumn
        ? columnValue<number | null>(table, mapping.groupeChambreColumn, i, null)
        : null,
      sejour,
      lockedBy: tableInfo.columns.lockedBy
        ? columnValue<string | null>(table, tableInfo.columns.lockedBy, i, null)
        : undefined,
      lockedAt: tableInfo.columns.lockedAt
        ? columnValue<string | null>(table, tableInfo.columns.lockedAt, i, null)
        : undefined,
      lastModifiedBy: tableInfo.columns.lastModifiedBy
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedBy, i, null)
        : undefined,
      lastModifiedAt: tableInfo.columns.lastModifiedAt
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedAt, i, null)
        : undefined,
      status: tableInfo.columns.status
        ? columnValue<string | null>(table, tableInfo.columns.status, i, null)
        : undefined,
    })
  }
  return records
}

export function mapChambres(data: GristDocData, mapping: SchemaMapping): ChambreRecord[] {
  const tableInfo = mapping.chambre
  const table = data[tableInfo.table]
  if (!table || !table.id) return []

  const ids = table.id
  const records: ChambreRecord[] = []
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    records.push({
      id,
      nomChambre: columnValue<string>(table, tableInfo.columns.nomChambre, i, String(id)),
      capacite: columnValue<number>(table, tableInfo.columns.capacite, i, 0),
      lastModifiedBy: tableInfo.columns.lastModifiedBy
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedBy, i, null)
        : undefined,
      lastModifiedAt: tableInfo.columns.lastModifiedAt
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedAt, i, null)
        : undefined,
      status: tableInfo.columns.status
        ? columnValue<string | null>(table, tableInfo.columns.status, i, null)
        : undefined,
    })
  }
  return records
}

/** Convertit la table Lock en tableau de LockRecord (verrous coopératifs). */
export function mapLocks(data: GristDocData, mapping: SchemaMapping): LockRecord[] {
  if (!mapping.lock) return []
  const tableInfo = mapping.lock
  const table = data[tableInfo.table]
  if (!table || !table.id) return []

  const ids = table.id
  const records: LockRecord[] = []
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    records.push({
      id,
      resourceType: columnValue<'Eleve' | 'Groupe'>(table, tableInfo.columns.resourceType, i, 'Eleve'),
      resourceId: columnValue<number>(table, tableInfo.columns.resourceId, i, 0),
      resourceLabel: columnValue<string>(table, tableInfo.columns.resourceLabel, i, ''),
      widgetSessionId: columnValue<string>(table, tableInfo.columns.widgetSessionId, i, ''),
      lockState: columnValue<LockState>(table, tableInfo.columns.lockState, i, 'active'),
      createdAt: columnValue<string>(table, tableInfo.columns.createdAt, i, ''),
      lastModifiedAt: columnValue<string>(table, tableInfo.columns.lastModifiedAt, i, ''),
      expiresAt: tableInfo.columns.expiresAt
        ? columnValue<string | null>(table, tableInfo.columns.expiresAt, i, null)
        : null,
      createdByName: tableInfo.columns.createdByName
        ? columnValue<string | null>(table, tableInfo.columns.createdByName, i, null)
        : null,
      createdByEmail: tableInfo.columns.createdByEmail
        ? columnValue<string | null>(table, tableInfo.columns.createdByEmail, i, null)
        : null,
      createdByUserID: tableInfo.columns.createdByUserID
        ? columnValue<string | null>(table, tableInfo.columns.createdByUserID, i, null)
        : null,
      lastModifiedByName: tableInfo.columns.lastModifiedByName
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedByName, i, null)
        : null,
      lastModifiedByEmail: tableInfo.columns.lastModifiedByEmail
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedByEmail, i, null)
        : null,
      lastModifiedByUserID: tableInfo.columns.lastModifiedByUserID
        ? columnValue<string | null>(table, tableInfo.columns.lastModifiedByUserID, i, null)
        : null,
    })
  }
  return records
}

/** Convertit la table ActionLog en tableau d'ActionLogRecord. */
export function mapActionLogs(data: GristDocData, mapping: SchemaMapping): ActionLogRecord[] {
  if (!mapping.actionLog) return []
  const tableInfo = mapping.actionLog
  const table = data[tableInfo.table]
  if (!table || !table.id) return []

  const ids = table.id
  const records: ActionLogRecord[] = []
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    records.push({
      id,
      actionType: columnValue<string>(table, tableInfo.columns.actionType, i, 'error') as any,
      resourceType: columnValue<'Eleve' | 'Groupe' | 'Chambre'>(
        table,
        tableInfo.columns.resourceType,
        i,
        'Eleve',
      ),
      resourceId: columnValue<number | null>(table, tableInfo.columns.resourceId, i, null),
      fromGroup: tableInfo.columns.fromGroup
        ? columnValue<number | null>(table, tableInfo.columns.fromGroup, i, null)
        : null,
      toGroup: tableInfo.columns.toGroup
        ? columnValue<number | null>(table, tableInfo.columns.toGroup, i, null)
        : null,
      fromChambre: tableInfo.columns.fromChambre
        ? columnValue<number | null>(table, tableInfo.columns.fromChambre, i, null)
        : null,
      toChambre: tableInfo.columns.toChambre
        ? columnValue<number | null>(table, tableInfo.columns.toChambre, i, null)
        : null,
      widgetSessionId: columnValue<string>(table, tableInfo.columns.widgetSessionId, i, ''),
      details: tableInfo.columns.details
        ? columnValue<string | null>(table, tableInfo.columns.details, i, null) ?? undefined
        : undefined,
      createdAt: tableInfo.columns.createdAt
        ? columnValue<string>(table, tableInfo.columns.createdAt, i, '')
        : '',
      createdByName: tableInfo.columns.createdByName
        ? columnValue<string | null>(table, tableInfo.columns.createdByName, i, null)
        : null,
      createdByEmail: tableInfo.columns.createdByEmail
        ? columnValue<string | null>(table, tableInfo.columns.createdByEmail, i, null)
        : null,
      createdByUserID: tableInfo.columns.createdByUserID
        ? columnValue<string | null>(table, tableInfo.columns.createdByUserID, i, null)
        : null,
    })
  }
  return records
}

/**
 * Vérifie si un lock est actif côté UI : état 'active' ET non expiré.
 * NB : l'expiration se base sur ExpiresAt, qui doit être remplie par Grist
 * (formule) ou par le widget. Cette fonction ne met pas à jour la base.
 */
export function isLockActive(lock: LockRecord, now: Date = new Date()): boolean {
  if (lock.lockState !== 'active') return false
  if (!lock.expiresAt) return true
  const expires = new Date(lock.expiresAt).getTime()
  return Number.isFinite(expires) && expires > now.getTime()
}

/** Optionnel : qui a fait la modification (pour LastModifiedBy et déverrouillage). */
export async function assignEleveToGroupe(
  eleveId: number,
  groupeId: number | null,
  mapping: SchemaMapping,
  lastModifiedBy?: string,
): Promise<void> {
  const api = getDocApi()
  if (!api) throw new Error("API Grist indisponible (docApi).")
  const { eleve } = mapping
  const update: Record<string, any> = { [eleve.columns.groupeRef]: groupeId }
  if (lastModifiedBy) {
    if (eleve.columns.verrou) update[eleve.columns.verrou] = null
    if (eleve.columns.lockedBy) update[eleve.columns.lockedBy] = null
    if (eleve.columns.lockedAt) update[eleve.columns.lockedAt] = null
    if (eleve.columns.lastModifiedBy) update[eleve.columns.lastModifiedBy] = lastModifiedBy
    if (eleve.columns.lastModifiedAt) update[eleve.columns.lastModifiedAt] = new Date().toISOString()
  }
  await api.applyUserActions([['UpdateRecord', eleve.table, eleveId, update]])
}

/** Met à jour le verrou d’un élève (champ Verrou) : valeur = identifiant utilisateur ou null pour déverrouiller. */
export async function setEleveVerrou(
  eleveId: number,
  value: string | null,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) {
    throw new Error("API Grist indisponible (docApi).")
  }
  const { eleve } = mapping
  const update: Record<string, any> = {}
  if (eleve.columns.verrou) update[eleve.columns.verrou] = value
  if (eleve.columns.lockedBy) update[eleve.columns.lockedBy] = value
  if (eleve.columns.lockedAt) update[eleve.columns.lockedAt] = value ? new Date().toISOString() : null
  if (Object.keys(update).length === 0) throw new Error("Aucune colonne de verrou (Verrou ou LockedBy) dans le mapping Eleve.")
  await api.applyUserActions([['UpdateRecord', eleve.table, eleveId, update]])
}

/** Déverrouille un élève et remplit LastModifiedBy / LastModifiedAt. */
export async function clearEleveLockAndSetLastModified(
  eleveId: number,
  who: string,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) throw new Error("API Grist indisponible (docApi).")
  const { eleve } = mapping
  const update: Record<string, any> = {}
  if (eleve.columns.verrou) update[eleve.columns.verrou] = null
  if (eleve.columns.lockedBy) update[eleve.columns.lockedBy] = null
  if (eleve.columns.lockedAt) update[eleve.columns.lockedAt] = null
  if (eleve.columns.lastModifiedBy) update[eleve.columns.lastModifiedBy] = who
  if (eleve.columns.lastModifiedAt) update[eleve.columns.lastModifiedAt] = new Date().toISOString()
  if (Object.keys(update).length === 0) return
  await api.applyUserActions([['UpdateRecord', eleve.table, eleveId, update]])
}

/** Verrouille un groupe (LockedBy, LockedAt). */
export async function setGroupeLock(
  groupeId: number,
  who: string,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) throw new Error("API Grist indisponible (docApi).")
  const { groupe } = mapping
  const update: Record<string, any> = {}
  if (groupe.columns.lockedBy) update[groupe.columns.lockedBy] = who
  if (groupe.columns.lockedAt) update[groupe.columns.lockedAt] = new Date().toISOString()
  if (Object.keys(update).length === 0) return
  await api.applyUserActions([['UpdateRecord', groupe.table, groupeId, update]])
}

/** Déverrouille un groupe et remplit LastModifiedBy / LastModifiedAt. */
export async function clearGroupeLockAndSetLastModified(
  groupeId: number,
  who: string,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) throw new Error("API Grist indisponible (docApi).")
  const { groupe } = mapping
  const update: Record<string, any> = {}
  if (groupe.columns.lockedBy) update[groupe.columns.lockedBy] = null
  if (groupe.columns.lockedAt) update[groupe.columns.lockedAt] = null
  if (groupe.columns.lastModifiedBy) update[groupe.columns.lastModifiedBy] = who
  if (groupe.columns.lastModifiedAt) update[groupe.columns.lastModifiedAt] = new Date().toISOString()
  if (Object.keys(update).length === 0) return
  await api.applyUserActions([['UpdateRecord', groupe.table, groupeId, update]])
}

/** Déverrouille un groupe sans remplir LastModified (ex. annulation drag). */
export async function clearGroupeLock(
  groupeId: number,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) return
  const { groupe } = mapping
  const update: Record<string, any> = {}
  if (groupe.columns.lockedBy) update[groupe.columns.lockedBy] = null
  if (groupe.columns.lockedAt) update[groupe.columns.lockedAt] = null
  if (Object.keys(update).length === 0) return
  await api.applyUserActions([['UpdateRecord', groupe.table, groupeId, update]])
}

/** Met à jour LastModifiedBy / LastModifiedAt sur une chambre. */
export async function setChambreLastModified(
  chambreId: number,
  who: string,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) return
  const { chambre } = mapping
  const update: Record<string, any> = {}
  if (chambre.columns.lastModifiedBy) update[chambre.columns.lastModifiedBy] = who
  if (chambre.columns.lastModifiedAt) update[chambre.columns.lastModifiedAt] = new Date().toISOString()
  if (Object.keys(update).length === 0) return
  await api.applyUserActions([['UpdateRecord', chambre.table, chambreId, update]])
}

/** Optionnel : lastModifiedBy pour déverrouiller le groupe et remplir LastModified sur groupe et chambre. */
export async function assignGroupeToChambre(
  groupeId: number,
  chambreId: number | null,
  mapping: SchemaMapping,
  lastModifiedBy?: string,
): Promise<void> {
  const api = getDocApi()
  if (!api) throw new Error("API Grist indisponible (docApi).")
  if (!mapping.groupeChambreColumn) throw new Error('La colonne Groupe → Chambre est absente de la configuration.')
  const { groupe } = mapping
  const update: Record<string, any> = { [mapping.groupeChambreColumn]: chambreId }
  if (lastModifiedBy) {
    if (groupe.columns.lockedBy) update[groupe.columns.lockedBy] = null
    if (groupe.columns.lockedAt) update[groupe.columns.lockedAt] = null
    if (groupe.columns.lastModifiedBy) update[groupe.columns.lastModifiedBy] = lastModifiedBy
    if (groupe.columns.lastModifiedAt) update[groupe.columns.lastModifiedAt] = new Date().toISOString()
  }
  await api.applyUserActions([['UpdateRecord', groupe.table, groupeId, update]])
  if (chambreId != null && lastModifiedBy) {
    await setChambreLastModified(chambreId, lastModifiedBy, mapping)
  }
}

/** Met à jour la couleur d’un groupe (champ Couleur, valeur hexadécimale #rrggbb). */
export async function updateGroupeCouleur(
  groupeId: number,
  hexColor: string,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) {
    throw new Error("API Grist indisponible (docApi).")
  }
  const { groupe } = mapping
  const hex = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
  await api.applyUserActions([
    ['UpdateRecord', groupe.table, groupeId, { [groupe.columns.couleur]: hex }],
  ])
}

/** Crée un nouveau groupe dans Grist et retourne son id. initialCouleur au format hex #rrggbb (optionnel). */
export async function createGroupe(
  nextNumGroupe: number,
  sejour: 1 | 2,
  mapping: SchemaMapping,
  initialCouleur?: string,
): Promise<number> {
  const api = getDocApi()
  if (!api) {
    throw new Error("API Grist indisponible (docApi).")
  }
  const hex =
    initialCouleur && /^#?[0-9A-Fa-f]{6}$/.test(initialCouleur.replace('#', ''))
      ? initialCouleur.startsWith('#')
        ? initialCouleur
        : `#${initialCouleur}`
      : '#4f46e5'
  const { groupe } = mapping
  const fields: Record<string, any> = {
    [groupe.columns.numGroupe]: nextNumGroupe,
    [groupe.columns.couleur]: hex,
    [groupe.columns.ouvert]: true,
  }
  if (groupe.columns.sejour) {
    fields[groupe.columns.sejour] = sejour
  }
  const actions: any[] = [
    ['AddRecord', groupe.table, null, fields],
  ]
  const result = await api.applyUserActions(actions)
  let newId = result?.retValues?.[0]
  if (typeof newId !== 'number') {
    throw new Error("Création du groupe : l'API Grist n'a pas renvoyé l'id du nouvel enregistrement.")
  }
  await api.applyUserActions([
    ['UpdateRecord', groupe.table, newId, { [groupe.columns.couleur]: hex }],
  ])
  return newId
}

/** Retire tous les élèves du groupe puis supprime le groupe. */
export async function removeGroupe(
  groupeId: number,
  eleveIds: number[],
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) {
    throw new Error("API Grist indisponible (docApi).")
  }
  const { eleve, groupe } = mapping
  const actions: any[] = []
  for (const id of eleveIds) {
    actions.push(['UpdateRecord', eleve.table, id, { [eleve.columns.groupeRef]: null }])
  }
  actions.push(['RemoveRecord', groupe.table, groupeId])
  await api.applyUserActions(actions)
}

/**
 * Journalise une action dans la table ActionLog si elle existe.
 *
 * IMPORTANT :
 * - l'identité de l'auteur (nom/email/id) n'est PAS passée en paramètre,
 *   elle est déduite via les user stamps Grist (CreatedBy*).
 * - le paramètre userId est conservé pour compatibilité ascendante mais
 *   n'est plus écrit dans la base.
 */
export async function logAction(
  mapping: SchemaMapping,
  actionType: string,
  // Paramètre conservé pour compatibilité ascendante ; ignoré en V2.
  _userId: string,
  resourceType: 'Eleve' | 'Groupe' | 'Chambre',
  resourceId: number,
  details?: string,
): Promise<void> {
  const api = getDocApi()
  if (!api || !mapping.actionLog) return
  const log = mapping.actionLog
  try {
    await api.applyUserActions([
      [
        'AddRecord',
        log.table,
        null,
        {
          [log.columns.actionType]: actionType,
          [log.columns.resourceType]: resourceType,
          [log.columns.resourceId]: resourceId,
          [log.columns.widgetSessionId]: generateWidgetSessionId(),
          [log.columns.details]: details ?? '',
          [log.columns.createdAt]: new Date().toISOString(),
        },
      ],
    ])
  } catch (err) {
    console.warn('[Composition Chambre] ActionLog non disponible :', err)
  }
}

