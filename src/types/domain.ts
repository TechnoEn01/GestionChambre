export type EleveId = number
export type GroupeId = number
export type ChambreId = number

export interface EleveRecord {
  id: EleveId
  nom: string
  prenom: string
  classe: string
  groupeId: GroupeId | null
}

export interface GroupeRecord {
  id: GroupeId
  numGroupe: number
  couleur: string
  ouvert: boolean
  xPiton: number | null
  yPiton: number | null
  chambreId?: ChambreId | null
}

export interface ChambreRecord {
  id: ChambreId
  nomChambre: string
  capacite: number
}

export interface ChambreWithStats extends ChambreRecord {
  // Nombre d'élèves assignés via les groupes rattachés à cette chambre.
  totalEleves: number
  // Capacité restante = capacite - totalEleves.
  capaciteRestante: number
}

export interface GroupeWithMembers extends GroupeRecord {
  eleves: EleveRecord[]
}

export type ThemeMode = 'light' | 'dark'

export interface LockInfo {
  entityType: 'Eleve' | 'Groupe'
  entityId: number
  lockedBy: string
  lockedAt: string
  // Texte court facultatif pour plus de contexte.
  info?: string
}

export interface DebugFlags {
  enabled: boolean
}

export interface UiState {
  theme: ThemeMode
  compactMode: boolean
  isSyncing: boolean
  readOnly: boolean
  debug: DebugFlags
  // Message d'erreur global (configuration ou écriture Grist).
  errorMessage: string | null
  // Indique si la colonne Groupe.Chambre existe réellement.
  hasGroupRoomLink: boolean
}

