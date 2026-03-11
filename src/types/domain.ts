export type EleveId = number
export type GroupeId = number
export type ChambreId = number

export interface EleveRecord {
  id: EleveId
  nom: string
  prenom: string
  classe: string
  groupeId: GroupeId | null
  /** Identifiant de l'utilisateur ayant verrouillé l'élève (champ Verrou), ou null si non verrouillé. */
  verrou?: string | null
  /** Numéro du séjour (1 ou 2) auquel participe l'élève. */
  sejour?: 1 | 2
}

export interface GroupeRecord {
  id: GroupeId
  numGroupe: number
  couleur: string
  ouvert: boolean
  xPiton: number | null
  yPiton: number | null
  chambreId?: ChambreId | null
  /** Numéro du séjour (1 ou 2) auquel le groupe appartient. */
  sejour?: 1 | 2
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
  errorMessage: string | null
  hasGroupRoomLink: boolean
  roomsPerLine: number
  /** Séjour affiché (1 ou 2) pour préparer les données indépendamment. */
  selectedSejour: 1 | 2
}

