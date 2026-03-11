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
  /** Table technique pour identifier l'utilisateur courant (SessionUser). */
  sessionUser?: TableColumnMapping
  /** Table optionnelle pour journaliser les actions (ActionLog). */
  actionLog?: TableColumnMapping
  /** @deprecated Tables optionnelles pour les verrous et les logs (remplacées par colonnes sur Eleve/Groupe). */
  lockTable?: TableColumnMapping
  logTable?: TableColumnMapping
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
      verrou: 'Verrou',
      sejour: 'Sejour',
      lockedBy: 'LockedBy',
      lockedAt: 'LockedAt',
      lastModifiedBy: 'LastModifiedBy',
      lastModifiedAt: 'LastModifiedAt',
      status: 'Status',
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
      chambreRef: 'Chambre',
      sejour: 'Sejour',
      lockedBy: 'LockedBy',
      lockedAt: 'LockedAt',
      lastModifiedBy: 'LastModifiedBy',
      lastModifiedAt: 'LastModifiedAt',
      status: 'Status',
    },
  },
  chambre: {
    table: 'Chambre',
    columns: {
      id: 'id',
      nomChambre: 'NomChambre',
      capacite: 'Capacite',
      lastModifiedBy: 'LastModifiedBy',
      lastModifiedAt: 'LastModifiedAt',
      status: 'Status',
    },
  },
  groupeChambreColumn: 'Chambre',
  sessionUser: {
    table: 'SessionUser',
    columns: {
      id: 'id',
      email: 'Email',
      name: 'Name',
      createdAt: 'CreatedAt',
      widgetSessionId: 'WidgetSessionId',
      active: 'Active',
    },
  },
  actionLog: {
    table: 'ActionLog',
    columns: {
      id: 'id',
      at: 'At',
      action: 'Action',
      userId: 'UserId',
      entityType: 'EntityType',
      entityId: 'EntityId',
      details: 'Details',
    },
  },
  lockTable: undefined,
  logTable: undefined,
}

