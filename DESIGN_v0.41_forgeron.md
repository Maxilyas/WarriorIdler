# DESIGN v0.41 — Refonte du Forgeron : « Les Trois Feux » + Forge hexagonale

> Retour joueur : *« l'interface du forgeron est améliorable, l'arbre on est vite perdu »* +
> *« on ne sait pas vraiment comment avoir de l'XP »*.
> **But : refondre le Forgeron autour de TROIS VOIES identitaires, d'une allocation HEXAGONALE
> (le build = le placement), d'une XP enfin LISIBLE (Foyer idle + recyclage + frappe + commandes),
> et d'un mini-jeu de FRAPPE qui nourrit le passif.** Aucune perte de fonctionnalité.
>
> Pilote : **Forgeron uniquement** (comme [DESIGN_v0.28_E2](DESIGN_v0.28_E2_arbres_metiers.md) l'a
> fait pour le rendu arbre). Joaillier / Runiste / Alchimiste restent sur l'arbre à nœuds actuel.

## 1. Constat (existant)

- Le Forgeron mélange **4 histoires** sous le verbe « façonner la matière » : Créer, Modifier,
  Procédés (contrats/fonderie/trempe), Industrialisation (automates). Les **automates** n'ont rien à
  voir avec « façonner » → identité diluée. (`AtelierPanel.tsx:108`, `metiers.ts:214`)
- **L'XP est opaque ET en tension avec l'économie** : elle vient quasi-uniquement du craft
  (`create`/`modify`/`ascend`, `store.ts:6099`, `metierXpGain` `metiers.ts:94`), or le craft COÛTE des
  ressources. Monter le métier = se ruiner. La seule source « gratuite » est implicite et cachée
  (30 % du recyclage/fonte, `store.ts:5147`). **Aucune source idle**, alors que le métier POSSÈDE les
  automates. C'est exactement le « on ne sait pas comment avoir de l'XP ».
- **L'arbre n'est pas un arbre** : `MetierTree` rend une **liste verticale indentée** (`orderBranch` +
  `paddingLeft: depth*16`, `AtelierPanel.tsx:214-339`). Pas de lecture spatiale, dépendances ratables,
  keystones noyés, fonctions (`maxRank:1`) et filler (`maxRank:3-5`) traités pareil.
- **Densité mobile** : tuiles 8.5–11 px, descriptions complètes empilées, 4 niveaux de navigation.

## 2. Objectif

1. **Trois Feux** : éclater le Forgeron en 3 Voies identitaires, **re-choix gratuit** (no-regret déjà
   en place, `canLearnNode` `metiers.ts:411`), qui sortent enfin les automates dans leur propre voie.
2. **Forge hexagonale** : remplacer les chaînes `requires`/`requiresRank` par de l'**ADJACENCE**.
   Le build devient un **placement** sur un nid d'abeille → profondeur min-max native, lisible au pouce.
3. **XP lisible** : 4 robinets affichés (Foyer idle · Recyclage · Frappe · Commandes), le craft n'étant
   plus la voie unique. **Boucle vertueuse** : forger des Chefs-d'œuvre (actif) ↑ le rendement du Foyer
   (passif) ↑ les ressources pour forger (actif).
4. **Mini-jeu de frappe** + ressource **Chaleur** : un geste tactile optionnel, avec breakpoints.
5. **Zéro perte** : toutes les fonctions actuelles restent atteignables ; migration des rangs appris.

## 3. Les Trois Feux (remap des nœuds existants)

Chaque Voie = une **zone colorée** du nid d'abeille (cf. §4). On range les nœuds Forgeron actuels par
identité, on ajoute les nœuds neufs. Rien n'est supprimé.

### 🛡️ Armurier — qualité / craft actif / frappe
| Tuile | Rôle | Statut |
|---|---|---|
| Affûtage | surillvl (`surillvl`) | existant |
| Polissage ⭐ | qualité (`polissage`) | existant |
| Signature | affixe garanti (`signature`) | existant |
| Maître forgeron | iLvl/rareté/Chef-d'œuvre (`maitreForgeron`) | existant |
| **Frappe brûlante** | débloque le mini-jeu → Chaleur (§6) | **neuf** |
| ◆ Ascension | +1 cran de rareté (`ascension`) | keystone existant |

### 🔥 Fondeur — ressources / lingots / chance
| Tuile | Rôle | Statut |
|---|---|---|
| Forge économe | −coûts (`econome`) | existant |
| Prodige | +chance rareté (`chance`) | existant |
| Fonderie & Contrats | fonte → 🧱 (`fonderie`) | existant |
| Maître fondeur | +🧱 (`maitreFondeur`) | existant |
| Transmutateur | change stat primaire (`transmute`) | existant |
| ◆ **Haut fourneau** | recyclage rembourse + **burst d'XP** (§7) | **neuf** keystone |

### 🤖 Industriel — idle / automates / Foyer
| Tuile | Rôle | Statut |
|---|---|---|
| **Foyer** | XP + 🧱 PASSIFS, indexés sur les Chefs-d'œuvre (§5) | **neuf** (cœur de la voie) |
| Trempe lente | +iLvl idle (`trempeLente`) | existant (déplacé ici) |
| Industrialisation | automates (`automates`) | existant |
| Chaîne de montage | −durée des runs (`montage`) | existant |
| ◆ Manufacture | 4ᵉ automate (`automate4`) | keystone existant |

**Keystones exclusifs** : les 3 capstones (Ascension / Haut fourneau / Manufacture) sont **mutuellement
exclusifs — 1 seul actif** (vrai choix de build, change gratuitement).

## 4. La Forge hexagonale (allocation)

Une seule planche en **nid d'abeille**, partagée, avec 3 zones colorées (les Voies) rayonnant autour
d'une **tuile-cœur** centrale (acquise gratuitement à l'ouverture du métier).

### Règle d'allocation (remplace `requires`/`requiresRank`)
- **1 point par niveau** (courbe `METIER` conservée, §7), dépensé pour **forger une tuile**.
- **Gating par ADJACENCE** : une tuile est forgeable ssi elle **touche une tuile déjà possédée**
  (ou le cœur). Plus de chaînes `requires` : la dépendance devient spatiale et visible.
- **`minLevel` / `minStage` conservés** sur les tuiles de fonction/keystone (synchronise au contenu).

### Types de tuiles
- `stat` (filler %, multi-rang) — leur intérêt est de **bâtir des chaînes** (cf. synergies).
- `function` (rang 1) — débloque un verbe (surillvl, ascension, fonderie, transmute, automates…).
- `keystone` (en bordure, exclusif) — effet identitaire fort.

### Synergies d'adjacence (le min-max)
Deux stratégies opposées (le théorycraft) : **profond** (un bras à fond) vs **large** (le cœur).

- **Chaîne** *(profond)* : N tuiles **possédées, de la même famille, connectées** → bonus croissant à
  cette famille. `CHAINE = [0,0,0, .12, .20, .30, .42][min(6,N)]` (×3 = +12 %, ×4 = +20 %, ×5 = +30 %…).
  Chaque bras est mono-famille : le pousser à fond = une longue chaîne + son keystone ◆.
- **Creuset** *(large, cœur gratuit)* : la tuile-cœur touche les **3 entrées** (A1/F1/I1). Bonus à
  **toutes les Voies** = `CREUSET_BONUS × (nb d'entrées possédées)` (3 entrées = Creuset plein).
  Récompense le multi-feu — cohérent avec « le multi-classe est la dynamique reine ».
- **Jonctions** *(les 3 coutures, optionnelles)* : J1/J2/J3 relient deux bras + le cœur. Les forger
  donne un **bonus hybride** (pont croisé entre 2 familles) — voir la carte ci-dessous.
- Le joueur **route son chemin** : maximiser une chaîne + keystone (profond) OU remplir le Creuset et
  les jonctions (large). On ne peut pas tout faire → c'est le puzzle, entièrement lisible (Tableau §8).

### Modèle de données (extension de `MetierNode`)
```ts
interface MetierNode {
  // … champs existants (id, name, icon, desc, maxRank, minLevel?, minStage?, exclusive?, keystone?) …
  /** Coordonnées axiales sur le nid d'abeille (pilote Forgeron). Absent = ancien rendu liste. */
  hex?: { q: number; r: number }
  /** Famille de synergie (pour les Chaînes). */
  family?: 'qualite' | 'ressource' | 'idle' | 'chance'
  /** Type de tuile (défaut déduit : maxRank>1 = 'stat', sinon 'function'). */
  kind?: 'stat' | 'function' | 'keystone'
}
```
- `requires`/`requiresRank` **abandonnés sur le Forgeron** (remplacés par l'adjacence calculée depuis
  `hex`). On les garde sur les 3 autres métiers (non pilotes).
- L'adjacence se calcule sur la grille axiale (6 voisins : `(q±1,r), (q,r±1), (q+1,r−1), (q−1,r+1)`).

### Carte des tuiles (planche figée — v0.41)

Coordonnées axiales `(q,r)`, cœur en `(0,0)`. Trois bras à 120° : Armurier vers le haut, Fondeur en
bas-droite, Industriel en bas-gauche. Pixels (flat-top) : `x = 190 + 39q`, `y = 205 + 45.03·(r + q/2)`.

| Code | Tuile | (q,r) | Voie | Famille | Type |
|---|---|---|---|---|---|
| C | Creuset (cœur) | (0,0) | — | hub | core · gratuit |
| A1 | Affûtage | (0,−1) | Armurier | qualité | function (entrée) |
| A2 | Polissage | (0,−2) | Armurier | qualité | stat |
| A3 | Maître forgeron | (0,−3) | Armurier | qualité | stat |
| A4 | ◆ Ascension | (0,−4) | Armurier | qualité | keystone |
| A5 | Signature | (1,−2) | Armurier | qualité | function |
| A6 | Frappe brûlante | (−1,−1) | Armurier | qualité | function (mini-jeu) |
| F1 | Forge économe | (1,0) | Fondeur | ressource | stat (entrée) |
| F2 | Fonderie & Contrats | (2,0) | Fondeur | ressource | function |
| F3 | Maître fondeur | (3,0) | Fondeur | ressource | stat |
| F4 | Prodige | (1,1) | Fondeur | chance | stat |
| F5 | Transmutateur | (2,1) | Fondeur | ressource | function |
| F6 | ◆ Haut fourneau | (3,1) | Fondeur | ressource | keystone |
| I1 | Foyer | (−1,1) | Industriel | idle | function (entrée, cœur de voie) |
| I2 | Trempe lente | (−1,2) | Industriel | idle | stat |
| I3 | Industrialisation | (−2,2) | Industriel | idle | function |
| I4 | Chaîne de montage | (−2,3) | Industriel | idle | stat |
| I5 | ◆ Manufacture | (−3,3) | Industriel | idle | keystone |
| J1 | Pont Qualité–Foyer | (−1,0) | couture A/I | pont | function · option |
| J2 | Pont Qualité–Lingots | (1,−1) | couture A/F | pont | function · option |
| J3 | Pont Lingots–Foyer | (0,1) | couture F/I | pont | function · option |

- **Jonctions** : J1 (A1↔I1) = tes Chefs-d'œuvre nourrissent le Foyer ; J2 (A1/A5↔F1) = −coût des
  Signatures/Ascensions ; J3 (F1/F4↔I1/I2) = +🧱 au Foyer. Chaque jonction touche le Creuset + deux
  familles → c'est là que se font les ponts croisés.
- 18 tuiles « cœur de métier » (C + 6 A + 6 F + 5 I) + 3 jonctions optionnelles = **21 tuiles**.

### Rendu UI (mobile)
- Planche **pannable/zoomable** (pinch + drag), recentrage auto sur les tuiles forgeables.
- Tuiles forgeables = **halo couleur de Voie** ; possédées = pleines ; verrouillées (niv/stage) =
  cadenas + « niv. X ». Une **chaîne active** relie ses tuiles d'un trait lumineux.
- Voir [maquette « grille hexagonale »] (conversation) : poser une tuile adjacente à 2 autres = Chaîne.

## 5. Le Foyer (XP & ressources passives) — couche idle

Cœur de la Voie Industriel et **réponse principale au problème d'XP**.

```ts
interface ForgeronFoyer {
  /** Horodatage du dernier prélèvement (accumulation hors-ligne). */
  lastTick: number
  /** Set des signatures de Chefs-d'œuvre UNIQUES déjà forgés (indexation du rendement). */
  masterworkKeys: string[]
}
```

- **Production** : XP de Forgeron **+** Lingots 🧱, en continu, **accumulés hors-ligne** (cap horaire).
- **Rendement** (la boucle voulue) :
  ```
  foyerRate(t) = FOYER_BASE
               × foyerLevel                       // rang de la tuile Foyer (1..3)
               × (1 + uniqueMasterworks × FOYER_MW_K)   // ← ACTIF (Armurier) nourrit le PASSIF
               × (1 + automatesCount × FOYER_AUTO_K)    // synergie Industriel
               × stageFactor(bestStage)
  ```
  `uniqueMasterworks = masterworkKeys.length`. **Forger un Chef-d'œuvre inédit ↑ le rendement pour
  toujours** → Actif → Passif → plus de ressources → Actif.
- **Collecte** : auto-créditée au tick + bandeau « Foyer : +N XP, +M 🧱 depuis ta dernière visite ».
- Knobs : `FOYER_BASE`, `FOYER_MW_K`, `FOYER_AUTO_K`, `FOYER_OFFLINE_CAP_H`.

## 6. La Frappe (mini-jeu) + ressource Chaleur — couche active

Débloquée par la tuile **Frappe brûlante** (Armurier). Optionnelle : un **toggle « auto-frappe »**
existe pour les joueurs idle (résultat moyen, sans bonus de série → reste accessible).

- À chaque **création** (page Créer), un **curseur oscille** sur une barre ; le joueur **frappe** :
  - **Parfait** (zone verte) : +Chaleur, **série +1**, +XP de Forgeron.
  - **Bien** (proche) : +Chaleur réduite, série conservée.
  - **Raté** : série remise à 0.
- **Chaleur** = ressource stockable (`chaleur: number`, 0..`CHALEUR_MAX`). Dépensable :
  - **+1 ⭐ de qualité** garanti sur la pièce,
  - **reroll de rareté** (retente le proc),
  - **souffler le Foyer** (convertit la Chaleur en burst de production).
- **Breakpoint de série** : **5 parfaites d'affilée → +1 cran de rareté GARANTI** sur la forge en cours.
- Knobs : `CHALEUR_MAX`, gains par palier, coûts des dépenses, largeur de la zone (difficulté).

## 7. XP : refonte de la lisibilité

**4 robinets affichés** dans un bandeau « Sources d'XP » (page Forgeron) — le craft n'est plus l'unique
chemin :

| Source | Type | Détail | Code touché |
|---|---|---|---|
| 🔥 Foyer | idle | §5, débit/min visible | nouveau tick |
| ♻️ Recyclage / fonte | semi-actif | **promu 30 % → first-class** et AFFICHÉ (le loot est gratuit) | `store.ts:5147,6155` |
| 🔨 Frappe parfaite | actif | §6 | nouveau |
| 📋 Commandes | burst | déjà là, à mettre en avant | `store.ts:6112` |

- La **création** garde un petit gain (`metierXpGain(..,'create')`) mais n'est plus structurante.
- **Haut fourneau** (keystone Fondeur) : la fonte/recyclage rembourse une part des coûts **et** lâche un
  **burst d'XP** (rend le démantèlement gratifiant et lisible).
- Courbe `xpForNext` (`metiers.ts:66`) **inchangée** ; c'est le **débit du Foyer** qui rend la montée
  enfin perceptible (un palier toutes les ~X min en idle, à régler).

## 8. Tableau de breakpoints (sous-page « Build »)

Nouvelle sous-page Forgeron pour le min-maxer (voir [maquette « tableau »] en conversation) :
- **Paliers d'engagement** par Voie : barres « tuiles possédées / prochain seuil » → bonus de Voie.
- **Synergies actives** : Chaînes en cours (×3, ×4…) + Mosaïques, avec leur % .
- **Synergies en attente** : « pose la tuile adjacente → Chaîne ×4 ».
- **Bonus cumulés** : Qualité / Rareté / Coûts / Lingots / rendement Foyer.

## 9. Migration (sauvegardes existantes)

- `forgeron.nodes: {id→rank}` → tuiles possédées sur le nid d'abeille via une `HEX_MAP` (chaque ancien
  nœud a son `hex`). Les rangs `stat` sont conservés.
- Si la nouvelle planche a moins de capacité que les points dépensés (peu probable), **rembourser** le
  surplus (les points restent dispo, l'XP est intacte — même logique que `migrateLegacyForge`
  `metiers.ts:699`).
- `foyer` initialisé vide ; `masterworkKeys` reconstruit depuis l'inventaire si des Chefs-d'œuvre y sont.
- Les 3 autres métiers : **aucun changement**.

## 10. Lots d'implémentation

- **Lot 0 — Données** : `hex`/`family`/`kind` sur les tuiles Forgeron ; `craftMods` remappé sur
  l'adjacence ; helpers `hexNeighbors`, `chainBonus`, `mosaicBonus`. (`metiers.ts`)
- **Lot 1 — Planche hexagonale** : composant `ForgeBoard` (pan/zoom, allocation par adjacence, halos,
  trait de chaîne). Remplace `MetierTree` pour le Forgeron. (`AtelierPanel.tsx`)
- **Lot 2 — Foyer idle** : état + tick + accumulation hors-ligne + indexation Chefs-d'œuvre + bandeau de
  collecte. (`store.ts`, `offline.ts`)
- **Lot 3 — Frappe & Chaleur** : mini-jeu sur la création + ressource `chaleur` + dépenses + toggle
  auto-frappe. (`AtelierPanel.tsx`, `store.ts`)
- **Lot 4 — Tableau de breakpoints** : sous-page « Build ». (`AtelierPanel.tsx`)
- **Lot 5 — Sources d'XP & migration** : bandeau « Sources d'XP », promotion du recyclage, `HEX_MAP`,
  init `foyer`. Build vert + sauvegardes anciennes intactes.

## 11. Knobs (à éprouver en partie réelle)

| Knob | Rôle | Départ proposé |
|---|---|---|
| `FOYER_BASE` | débit XP/min de base du Foyer | à caler (~1 palier / 15 min idle early) |
| `FOYER_MW_K` | poids des Chefs-d'œuvre uniques | 0.10 |
| `FOYER_AUTO_K` | poids des automates | 0.15 |
| `FOYER_OFFLINE_CAP_H` | plafond d'accumulation hors-ligne | 12 h |
| `CHAINE[N]` | bonus de chaîne par longueur | [.12,.20,.30,.42] |
| `CREUSET_BONUS` | bonus à toutes les Voies par entrée possédée | +6 % / entrée (max +18 %) |
| `JONCTION_BONUS` | bonus hybride d'un pont forgé | +10 % sur l'effet ponté |
| `CHALEUR_MAX` | réserve de Chaleur | 100 |
| `FRAPPE_ZONE` | largeur de la zone parfaite | 16 % (difficulté) |
| `FRAPPE_STREAK_RARITY` | série pour +1 cran garanti | 5 |

---

> **Ordre conseillé** : Lot 0 → 1 (le cœur : la planche jouable) → 5 (migration, pour ne jamais casser
> les saves) → 2 (Foyer, le gros gain d'XP) → 3 (Frappe) → 4 (Tableau). On peut livrer 0+1+5 d'abord et
> éprouver l'allocation hexagonale avant d'empiler les couches.
