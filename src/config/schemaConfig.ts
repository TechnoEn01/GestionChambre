export interface TableColumnMapping {
  table: string
  columns: Record<string, string>
}

export interface SchemaMapping {
  eleve: TableColumnMapping
  groupe: TableColumnMapping
  chambre: TableColumnMapping
  /** Optionnel – colonne Ref vers Chambre depuis Groupe. */
  groupeChambreColumn?: string
  /** Table technique pour identifier la session widget (optionnelle). */
  sessionUser?: TableColumnMapping
  /** Table des verrous coopératifs (Lock). */
  lock?: TableColumnMapping
  /** Table d'audit des actions importantes (ActionLog). */
  actionLog?: TableColumnMapping
}

// Mapping par défaut aligné sur la description du document Grist.
export const defaultSchemaMapping: SchemaMapping = {
  eleve: {
    table: 'Eleve',
    columns: {
      id: 'id',
      nom: 'Nom',
      prenom: 'Prenom',
      classe: 'Classe',
      groupeRef: 'Groupe',
      sejour: 'Sejour',
      // Optionnel : colonnes legacy (Verrou, LastModified*). Si absentes de la table Grist,
      // ne pas les déclarer ici pour éviter KeyError à l'écriture.
      // verrou: 'Verrou',
      // lockedBy: 'LockedBy',
      // lockedAt: 'LockedAt',
      // lastModifiedBy: 'LastModifiedBy',
      // lastModifiedAt: 'LastModifiedAt',
    },
  },
  groupe: {
    table: 'Groupe',
    columns: {
      id: 'id',
      numGroupe: 'NumGroupe',
      couleur: 'Couleur',
      ouvert: 'Ouvert',
      xPiton: 'X_piton',
      yPiton: 'Y_piton',
      // Position du groupe sur le canvas (persistée indépendamment du piton).
      xGroup: 'X_Group',
      yGroup: 'Y_Group',
      chambreRef: 'Chambre',
    },
  },
  chambre: {
    table: 'Chambre',
    columns: {
      id: 'id',
      nomChambre: 'NomChambre',
      capacite: 'Capacite',
    },
  },
  groupeChambreColumn: 'Chambre',
  // SessionUser reste optionnelle et peut toujours être configurée si besoin
  // pour stocker un WidgetSessionId associé à un utilisateur.
  sessionUser: undefined,
  // Tables Lock et ActionLog (V2) – à déclarer dans Grist avec ces colonnes.
  lock: {
    table: 'Lock',
    columns: {
      id: 'id',
      resourceType: 'ResourceType',
      resourceId: 'ResourceId',
      resourceLabel: 'ResourceLabel',
      widgetSessionId: 'WidgetSessionId',
      lockState: 'LockState',
      createdAt: 'CreatedAt',
      lastModifiedAt: 'LastModifiedAt',
      // expiresAt est recommandé mais optionnel : si la colonne n'existe pas
      // dans Grist, on ne l'utilisera simplement pas.
      expiresAt: 'ExpiresAt',
      createdByName: 'CreatedByName',
      createdByEmail: 'CreatedByEmail',
      createdByUserID: 'CreatedByUserID',
      lastModifiedByName: 'LastModifiedByName',
      lastModifiedByEmail: 'LastModifiedByEmail',
      lastModifiedByUserID: 'LastModifiedByUserID',
    },
  },
  actionLog: {
    table: 'ActionLog',
    columns: {
      id: 'id',
      actionType: 'ActionType',
      resourceType: 'ResourceType',
      resourceId: 'ResourceId',
      fromGroup: 'FromGroup',
      toGroup: 'ToGroup',
      fromChambre: 'FromChambre',
      toChambre: 'ToChambre',
      widgetSessionId: 'WidgetSessionId',
      details: 'Details',
      createdAt: 'CreatedAt',
      createdByName: 'CreatedByName',
      createdByEmail: 'CreatedByEmail',
      createdByUserID: 'CreatedByUserID',
    },
  },
}

