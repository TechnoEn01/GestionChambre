import type {
  Grist,
  GristDocApi,
  GristDocData,
  GristTableData,
  GristDocInfo,
  GristRowRecord,
} from './gristTypes'
import { defaultSchemaMapping, type SchemaMapping } from '../config/schemaConfig'
import type { EleveRecord, GroupeRecord, ChambreRecord } from '../types/domain'

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
  const [eleveRaw, groupeRaw, chambreRaw] = await Promise.all([
    api.fetchTable(mapping.eleve.table).catch(() => null),
    api.fetchTable(mapping.groupe.table).catch(() => null),
    api.fetchTable(mapping.chambre.table).catch(() => null),
  ])
  const docData: GristDocData = {}
  if (eleveRaw) docData[mapping.eleve.table] = normalizeTableData(eleveRaw)
  if (groupeRaw) docData[mapping.groupe.table] = normalizeTableData(groupeRaw)
  if (chambreRaw) docData[mapping.chambre.table] = normalizeTableData(chambreRaw)
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
    records.push({
      id,
      nom: columnValue(table, tableInfo.columns.nom, i, ''),
      prenom: columnValue(table, tableInfo.columns.prenom, i, ''),
      classe: columnValue(table, tableInfo.columns.classe, i, ''),
      groupeId,
      verrou: tableInfo.columns.verrou
        ? columnValue<string | null>(table, tableInfo.columns.verrou, i, null)
        : null,
      sejour,
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
    })
  }
  return records
}

export async function assignEleveToGroupe(
  eleveId: number,
  groupeId: number | null,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) {
    throw new Error("API Grist indisponible (docApi).")
  }
  const { eleve } = mapping
  const update: Record<string, any> = {}
  update[eleve.columns.groupeRef] = groupeId
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
  const colVerrou = eleve.columns.verrou
  if (!colVerrou) {
    throw new Error("La colonne Verrou est absente du mapping Eleve.")
  }
  await api.applyUserActions([
    ['UpdateRecord', eleve.table, eleveId, { [colVerrou]: value }],
  ])
}

export async function assignGroupeToChambre(
  groupeId: number,
  chambreId: number | null,
  mapping: SchemaMapping,
): Promise<void> {
  const api = getDocApi()
  if (!api) {
    throw new Error("API Grist indisponible (docApi).")
  }
  if (!mapping.groupeChambreColumn) {
    throw new Error('La colonne Groupe → Chambre est absente de la configuration.')
  }
  const table = mapping.groupe.table
  const update: Record<string, any> = {}
  update[mapping.groupeChambreColumn] = chambreId
  await api.applyUserActions([['UpdateRecord', table, groupeId, update]])
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

