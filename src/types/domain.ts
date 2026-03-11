export type EleveId = number
export type GroupeId = number
export type ChambreId = number

export interface EleveRecord {
  id: EleveId
  nom: string
  prenom: string
  classe: string
  groupeId: GroupeId | null
  /**
   * Champ hérité de la V1 (colonne Verrou/LockedBy sur Eleve).
   * En V2, la source de vérité des verrous est la table Lock.
   * TODO V2+: ne plus se baser sur ce champ côté métier, seulement pour compat UI si besoin.
   */
  verrou?: string | null
  /** Numéro du séjour (1 ou 2) auquel participe l'élève (hérité, ignoré en V2 si inutile). */
  sejour?: 1 | 2
  /**
   * Champs dérivés potentiellement remplis depuis la table Eleve (LockedBy / LockedAt / LastModified*).
   * En V2, la source de vérité des verrous est la table Lock et celle de l'audit la table ActionLog.
   * Ces champs peuvent encore être utilisés comme "view model" pratique, mais ne doivent pas être
   * considérés comme autorité métier.
   */
  lockedBy?: string | null
  lockedAt?: string | null
  lastModifiedBy?: string | null
  lastModifiedAt?: string | null
  status?: string | null
}

export interface GroupeRecord {
  id: GroupeId
  numGroupe: number
  couleur: string
  ouvert: boolean
  xPiton: number | null
  yPiton: number | null
  chambreId?: ChambreId | null
  /** Numéro du séjour (1 ou 2) auquel le groupe appartient (hérité, ignoré en V2 si inutile). */
  sejour?: 1 | 2
  lockedBy?: string | null
  lockedAt?: string | null
  lastModifiedBy?: string | null
  lastModifiedAt?: string | null
  status?: string | null
}

export interface ChambreRecord {
  id: ChambreId
  nomChambre: string
  capacite: number
  lastModifiedBy?: string | null
  lastModifiedAt?: string | null
  status?: string | null
}

/** Session utilisateur courante (table SessionUser dans Grist). */
export interface SessionUserRecord {
  id: number
  Email: string
  Name: string
  CreatedAt: string
  WidgetSessionId: string
  Active: boolean
}

/**
 * Représentation d'un verrou dans la table Lock.
 * Les colonnes CreatedBy* / LastModifiedBy* sont renseignées automatiquement
 * par Grist (user stamps) au moment de l'écriture : l'identité n'est donc
 * connue qu'APRÈS la création/modification de la ligne, jamais "à l'avance".
 */
export type LockState = 'active' | 'released' | 'expired'

export interface LockRecord {
  id: number
  resourceType: 'Eleve' | 'Groupe'
  resourceId: number
  resourceLabel: string
  widgetSessionId: string
  lockState: LockState
  createdAt: string
  lastModifiedAt: string
  expiresAt: string | null
  // Stamps auteur / modificateur gérés par Grist (non édités par le widget) :
  createdByName?: string | null
  createdByEmail?: string | null
  createdByUserID?: string | null
  lastModifiedByName?: string | null
  lastModifiedByEmail?: string | null
  lastModifiedByUserID?: string | null
}

/**
 * Entrée d'audit dans la table ActionLog.
 * Là encore, CreatedBy* est renseigné par Grist.
 */
export type ActionType =
  | 'lock_start'
  | 'lock_refresh'
  | 'lock_release'
  | 'move_eleve'
  | 'move_groupe'
  | 'group_to_chambre'
  | 'create_groupe'
  | 'delete_groupe'
  | 'error'

export interface ActionLogRecord {
  id: number
  actionType: ActionType
  resourceType: 'Eleve' | 'Groupe' | 'Chambre'
  resourceId: number | null
  fromGroup?: number | null
  toGroup?: number | null
  fromChambre?: number | null
  toChambre?: number | null
  widgetSessionId: string
  details?: string
  createdAt: string
  createdByName?: string | null
  createdByEmail?: string | null
  createdByUserID?: string | null
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

