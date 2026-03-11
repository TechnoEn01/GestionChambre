export interface TableColumnMapping {
  table: string
  columns: Record<string, string>
}

export interface SchemaMapping {
  eleve: TableColumnMapping
  groupe: TableColumnMapping
  chambre: TableColumnMapping
  // Optionnel – colonne Ref vers Chambre depuis Groupe.
  groupeChambreColumn?: string
  // Tables optionnelles pour les verrous et les logs.
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
  // Nom de colonne Ref sur la table Groupe vers Chambre (optionnelle).
  groupeChambreColumn: 'Chambre',
  // Tables optionnelles de lock et de log recommandées – non obligatoires.
  lockTable: undefined,
  logTable: undefined,
}

