## Composition Chambre – Widget Grist

Widget React/TypeScript pour préparer la composition des chambres d’un voyage scolaire à partir de tables Grist.  
Pensé pour être **hébergé sur GitHub Pages**, utilisé comme **custom widget Grist (full access)**, et rester **évolutif**.

---

### Architecture générale

- **Stack** : React + Vite + TypeScript, CSS simple.
- **Domaine** :
  - `Eleve` (Nom, Prenom, Classe, Groupe).
  - `Groupe` (NumGroupe, Couleur, Ouvert, X_piton, Y_piton, colonne recommandée `Chambre`).
  - `Chambre` (NomChambre, Capacite).
- **Principe clé** : Grist est la **seule source de vérité**. Le widget :
  - lit les tables,
  - reconstruit l’état (élèves par groupe, groupes par chambre),
  - écrit uniquement les modifications nécessaires (affectation d’un élève à un groupe, d’un groupe à une chambre).

---

### 1. Lancer le projet en local

- **Prérequis** : Node 18+ et npm.

```bash
cd composition-chambre
npm install
npm run dev
```

Le serveur se lance par défaut sur `http://localhost:5173`.  
En dehors de Grist, le widget fonctionne en **mode démo lecture seule** (pas d’écriture, ni de données réelles).

---

### 2. Build de production

```bash
npm run build
```

- Les fichiers produits sont générés dans le dossier `docs/`.
- Ce dossier est prêt pour un hébergement GitHub Pages (branche principale).

**Version affichée dans le widget** : le build injecte le hash court du commit Git courant.  
- Pour que la version affichée corresponde au commit déployé, **committe d’abord tes changements, puis lance `npm run build`**, puis ajoute `docs/` et pousse.  
- Si tu fais le build **avant** le commit, le hash est celui du dernier commit ; en plus, un suffixe **`-dirty`** est ajouté tant qu’il reste des changements non commités (ex. `a1b2c3d-dirty`).

---

### 3. Déploiement sur GitHub Pages

1. **Initialiser un dépôt** (si ce n’est pas déjà fait) :

```bash
git init
git add .
git commit -m "Initialisation widget Composition Chambre"
git branch -M main
git remote add origin <URL_DU_DEPOT>
```

2. **Build** :

```bash
npm run build
```

3. **Pousser sur GitHub** :

```bash
git push -u origin main
```

4. **Activer GitHub Pages** :

- Aller dans **Settings → Pages** du dépôt.
- **Source** : `Deploy from a branch`.
- **Branch** : `main`, dossier `/docs`.
- Enregistrer.

5. L’URL finale sera de la forme  
`https://<votre-compte>.github.io/<nom-du-depot>/` (ou selon votre configuration Pages).

---

### 4. Configuration des tables Grist

#### 4.1 Tables minimales requises

- **Table `Eleve`** (nom par défaut : `Eleve`)
  - **Nom** (Text)
  - **Prenom** (Text)
  - **Classe** (Text)
  - **Groupe** (Reference vers `Groupe`)

- **Table `Groupe`** (nom par défaut : `Groupe`)
  - **NumGroupe** (Numeric, entier ou Text)
  - **Couleur** (Text, ex : `#4f46e5`)
  - **Ouvert** (Booléen)
  - **X_piton** (Numeric, optionnel – position “piton” sur le canvas)
  - **Y_piton** (Numeric, optionnel – position “piton” sur le canvas)

- **Table `Chambre`** (nom par défaut : `Chambre`)
  - **NomChambre** (Text)
  - **Capacite** (Numeric, entier)

#### 4.2 Colonne optionnelle mais fortement recommandée : Groupe → Chambre

Pour relier proprement un groupe à une chambre **et permettre le dépôt de groupes dans les chambres** :

- **Dans la table `Groupe`** :
  - **Chambre** (Reference vers `Chambre`)

Comportement :

- si cette colonne **existe** :
  - le drag & drop **groupe → chambre** est activé,
  - la colonne est mise à jour lors du drop,
  - l’export par chambre est disponible.
- si cette colonne **n’existe pas** :
  - le drag & drop **groupe → chambre est désactivé** (message explicite dans le panneau “Chambres”),
  - l’**export par chambre est indisponible** (message dans le panneau “Export”),
  - aucune affectation virtuelle n’est faite en mémoire : seules les données réellement présentes dans Grist sont utilisées.

---

### 5. Colonnes / tables supplémentaires recommandées

> Ces tables/colonnes supplémentaires (verrouillage, logs, canvas libre, etc.) **ne sont pas utilisées en V1 minimale**.  
> Elles pourront être ajoutées pour une V2 plus riche si besoin.

---

### 6. Mapping configurable

Le code centralise le mapping dans `src/config/schemaConfig.ts` :

- **Tables** :
  - `eleve.table` – par défaut `Eleve`,
  - `groupe.table` – par défaut `Groupe`,
  - `chambre.table` – par défaut `Chambre`.
- **Colonnes** :
  - `eleve.columns.Nom`, `Prenom`, `Classe`, `Groupe`,
  - `groupe.columns.NumGroupe`, `Couleur`, `Ouvert`, `X_piton`, `Y_piton`, `Chambre`,
  - `chambre.columns.NomChambre`, `Capacite`.

En V1, ce mapping est **codé en dur** avec des valeurs par défaut cohérentes avec ce README.  
Une V2 pourra permettre de les surcharger via les **settings du widget Grist** (`grist.onSettings`).

---

### 7. Intégration dans Grist (custom widget)

1. **Ouvrir votre document Grist**.
2. Ajouter un **Widget → Custom → Add widget**.
3. Renseigner l’URL du widget :
   - l’URL GitHub Pages générée (`https://…/index.html`).
4. Choisir le mode **Full document access**.
5. Sauvegarder.

Le widget :

- lit les tables `Eleve`, `Groupe`, `Chambre`,
- reconstruit les listes d’élèves non groupés, groupes, chambres,
- fournit une UI avec :
  - liste des élèves non groupés à gauche,
  - “canvas” de groupes au centre,
  - panneaux de chambres et export à droite.

---

### 8. Fonctionnalités V1 implémentées

- **Élèves**
  - Liste d’élèves non groupés (tri alphabétique par nom).
  - Cartes élèves compactes (nom, prénom, classe).
  - Sélection d’un élève par clic (bordure mise en évidence).
  - Glisser-déposer d’un élève vers un groupe.

- **Groupes**
  - Visualisation des groupes existants (données Grist).
  - Affichage du nombre d’élèves par groupe.
  - Affichage compact des prénoms des élèves à l’intérieur du groupe.
  - Drag & drop : déposer un élève sur un groupe met à jour `Eleve.Groupe`.
  - Alternative d’interaction : double-clic sur un groupe pour y envoyer l’élève sélectionné.

- **Chambres**
  - Affichage des chambres avec capacité et statut (complet / places restantes).
  - Drag & drop d’un groupe vers une chambre **uniquement si la colonne `Groupe.Chambre` existe**.
  - Contrôle de capacité :
    - si le groupe ne tient pas dans la chambre (places restantes < taille du groupe), le drop est refusé avec un message lisible.

- **Drag & drop**
  - Élèves `draggable` → groupes (drop valide avec “snap” simple).
  - Groupes `draggable` → chambres (drop contrôlé par la capacité).
  - Retour visuel simple via messages et états.

- **Interface**
  - Thème **clair/sombre** (bouton en haut à droite).
  - **Mode compact** : réduit légèrement la taille de certaines cartes.
  - Mise en page en trois colonnes (élèves / canvas groupes / chambres + export).
  - Style moderne (cartes, coins arrondis, ombres légères).
  - Export texte listant `Chambre → Groupes → Élèves`.

---

### 9. Mode debug et multi-utilisateur

- **Mode debug / multi-utilisateur (V1 minimale)** :
  - Le bouton `Debug` est présent mais n’active pour l’instant qu’un mode d’affichage interne basique.
  - Pas de système de **verrouillage** ni de **logs avancés** dans cette V1.
  - Le widget se contente de **refléter l’état courant de Grist** (modèle last-write-wins).

---

### 10. Checklist de test manuel

- **Configuration minimale**
  - [ ] Les tables `Eleve`, `Groupe`, `Chambre` existent avec les colonnes décrites.
  - [ ] La colonne `Eleve.Groupe` pointe bien sur `Groupe`.
  - [ ] (Optionnel mais fortement recommandé) La colonne `Groupe.Chambre` existe et pointe vers `Chambre`.

- **Chargement du widget**
  - [ ] Le widget se charge dans Grist sans erreur de console bloquante.
  - [ ] La liste des élèves non groupés s’affiche.
  - [ ] Les groupes et chambres existants sont visibles.

- **Glisser-déposer des élèves**
  - [ ] Glisser un élève de la colonne de gauche vers un groupe au centre.
  - [ ] Vérifier dans la table `Eleve` que la colonne `Groupe` est mise à jour.
  - [ ] Retirer l’élève d’un groupe en le rebasculant à “sans groupe” (à faire via Grist ou future V2 du widget).

- **Glisser-déposer des groupes vers les chambres**
  - [ ] Si la colonne `Groupe.Chambre` est présente : glisser un groupe vers une chambre.
  - [ ] Vérifier dans la table `Groupe` que la colonne `Chambre` reflète bien l’affectation.
  - [ ] Tester le cas où le groupe dépasse la capacité restante de la chambre (erreur lisible, pas de mise à jour).
  - [ ] Si la colonne `Groupe.Chambre` est absente : vérifier que le drag & drop vers les chambres est désactivé et qu’un message l’indique dans le panneau “Chambres”.

- **Export**
  - [ ] Si la colonne `Groupe.Chambre` est présente : vérifier que l’onglet “Export (aperçu)” affiche bien une liste `Chambre → Groupes → Élèves`.
  - [ ] Si la colonne `Groupe.Chambre` est absente : vérifier que l’onglet “Export (aperçu)” affiche un message expliquant que la colonne est nécessaire pour l’export par chambre.
  - [ ] Copier/coller le contenu dans un document externe (tableur, traitement de texte).

- **Thème & compact**
  - [ ] Basculer thème clair/sombre.
  - [ ] Activer / désactiver le mode compact et vérifier la lisibilité.

- **Multi-utilisateur** (test simple)
  - [ ] Ouvrir le même document Grist dans deux navigateurs.
  - [ ] Faire des modifications de groupes/chambres depuis A et B.
  - [ ] Vérifier que les deux widgets se synchronisent bien (après un court délai).

---

### 11. Limites connues et TODO V2

- **Verrouillage** :
  - [ ] Implémenter l’écriture/lecture réelle dans la table `Lock` pour verrouiller les entités en cours de déplacement.
  - [ ] Afficher visuellement les éléments verrouillés par un autre utilisateur (bordure rouge, info-bulle “verrouillé par X”).

- **Logs** :
  - [ ] Brancher la fonction `logAction` pour enregistrer dans la table de log (`Log`).

- **Pitons & canvas libre** :
  - [ ] Exploiter `Groupe.X_piton` et `Groupe.Y_piton` pour positionner les groupes sur un canvas libre
        (drag & drop de position, zoom/dézoom, mémorisation des coordonnées).

- **UI avancée** :
  - [ ] Panneau latéral rétractable.
  - [ ] Zoom/dézoom du canvas.
  - [ ] Filtre par classe actif avec UI plus riche.

Ces TODO sont balisés dans le code pour faciliter l’évolution ultérieure.

---

### 12. Sécurité & bonnes pratiques

- **Pas de secrets** dans le code, ni de clé API.
- **Aucune exécution de code** à partir des données Grist (tous les textes sont traités comme du texte).
- **Grist reste l’arbitre final** :
  - en cas de conflit, la dernière écriture acceptée par Grist l’emporte,
  - le widget se contente de refléter l’état courant du document.

