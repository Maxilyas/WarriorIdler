# DESIGN v0.43 — Avatar 2D en pied : « Voir son stuff »

> Demande joueur : *« avoir un avatar 2D des personnages et voir le stuff qu'on équipe sur eux.
> Plus le stuff est élevé, plus les équipements (visuel) évoluent pour avoir des choses magnifiques. »*
>
> **But : afficher une FIGURINE en pied par héros, sur laquelle l'équipement RÉELLEMENT porté se
> compose en calques, et dont l'allure MONTE par paliers visuels + teinte/glow/aura au fil de l'ilvl
> et de la rareté.** C'est une **couche de PRÉSENTATION** : aucun impact sur le gameplay, les stats,
> le combat ou les sauvegardes.
>
> Pilote : **l'écran Stuff** (figurine à côté de la grille des 16 slots) puis le **hub Héros**
> (vitrine). Le médaillon actuel ([LevelBadge.tsx](src/components/LevelBadge.tsx)) reste partout
> ailleurs (combat, barres) — la figurine **augmente**, ne remplace pas.

## 0. RÉVISION v0.43.1 — PIVOT vers illustrations réalistes par palier

> Retour joueur : *« je veux vraiment quelque chose de RÉALISTE pour les assets. »*

Le plan LAYERED (calques par pièce, pack LPC) décrit en §1-§10 est **ABANDONNÉ** : LPC est du
pixel-art stylisé (l'inverse de réaliste), et empiler des centaines de calques d'armure *réalistes*
cohérents (anatomie / lumière / perspective / ancrage) est infaisable en 2D — c'est précisément
pourquoi les jeux AAA à avatar équipable passent par la **3D**. Nouvelle direction **verrouillée** :

- **L'avatar = UNE illustration réaliste en pied, par `classe × palier visuel`** (10 classes × 6
  paliers ≈ **60-120 images**), affichée en entier (aucune composition de calques).
- **Elle change d'ALLURE GLOBALE** selon le palier d'équipement du héros (`lookTier`, §0.2).
- **Le « voir chaque pièce » est DÉLÉGUÉ à la grille des 16 slots** (déjà existante,
  [StuffScreen.tsx:537](src/components/StuffScreen.tsx#L537)) : le détail par-pièce y vit déjà ;
  l'avatar devient la **pièce maîtresse esthétique**, pas un inventaire visuel.
- **Effets** (glow d'arme élémentaire, aura de prestige, éclat de haut palier) = overlays CSS
  par-dessus l'image — inchangés.

### 0.1 Source d'art (⚠ non générable par l'assistant)
Aucun pack open-source d'armures réalistes en calques n'existe. Pour ~60-120 illustrations réalistes
COHÉRENTES, la voie réaliste solo = **génération IA pilotée par template strict** (ou commission
d'artiste). **Le code CONSOMME les images et le SPEC de génération est fourni
([public/avatars/README.md](public/avatars/README.md)), mais la PRODUCTION des images se fait via un
modèle d'image / un artiste — hors des outils de l'assistant.** Le système fonctionne AVANT l'art
(fallback placeholder procédural).

### 0.2 Palier d'allure (`lookTier`)
Agrège la rareté de l'équipement porté → 0..5. **Moyenne** des raretés portées (stable) plutôt que
le max (qui sauterait au moindre drop chanceux). Knob : biais vers « meilleure pièce » ajustable.

### 0.3 Architecture de consommation (livrée v0.43.1)
- `public/avatars/<classId>/<tier>.webp` (fond transparent ou sombre, cadrage / pose CONSTANTS).
- Manifeste `AVATAR_ART` (set de combos `classId-tier` disponibles, [wardrobe.ts](src/game/wardrobe.ts)) :
  tant qu'un combo en est absent, le Mannequin affiche le **placeholder procédural** (§5, conservé
  comme repli). Déposer l'image + ajouter son combo au set → l'avatar réel remplace le placeholder
  pour ce `classe×palier`. Mise en prod incrémentale, jamais cassée.
- Poids PWA : WebP/AVIF, ~768×1152, **lazy-load** de la seule image affichée.

> Tout ce qui suit (§1-§10) décrit le plan LAYERED d'origine. **À lire comme l'historique** : les
> points RENDU / PILOTAGE / SOURCE D'ART sont supersédés par cette §0. Restent valides — résolution
> classe→catégorie→palier (§3), les 6 paliers visuels, les effets CSS, les emplacements (Stuff + Héros).

## 1. Décisions verrouillées (cadrage — RENDU/PILOTAGE/SOURCE supersédés par §0)

Issues du Q&A de cadrage. Ce sont les invariants du chantier.

| Axe | Décision | Conséquence |
|---|---|---|
| **Rendu** | Raster en **calques** (pack layered open-source type LPC) | Pas de SVG procédural pour le corps ; pipeline d'assets à créer (§6) |
| **Pilotage** | **Par pièce réelle** — chaque slot visible affiche SON équipement | Le rendu lit `char.equipment[slot]` directement |
| **Corps** | **Par classe** (10 silhouettes) | Résolution classe → corps (§3) ; gear curé par classe |
| **Per-classe** | **Mutualisé aux bas paliers, divergent en haut** | Économise l'art ; l'identité monte avec la puissance |
| **Paliers** | 16 raretés → **6 paliers visuels** + teinte/glow/aura pour l'ilvl fin | La forme change 6 fois ; chaque upgrade « se sent » via effets |
| **Animation** | **Statique + effets CSS** (glow d'arme élémentaire, aura pulsée, scintillement de gemmes) | Zéro spritesheet ; réutilise les auras existantes |
| **Emplacement** | **Figurine sur Stuff** + **vitrine sur Héros** | Deux tailles d'un même composant `<Mannequin>` |

### Deux contraintes assumées (à garder en tête)
1. **Licence du pack** : l'art LPC est majoritairement **CC-BY-SA 3.0 / GPL**. Obligations :
   **attribution** (fichier `CREDITS.md` listant chaque auteur/asset) **et share-alike** (tout dérivé
   de cet art reste sous licence libre). Sans effet sur le code ; à valider si monétisation un jour.
2. **Style imposé** : LPC = **2D RPG / pixel-art ~64 px**, charmant mais pas « peinture haute
   résolution ». Le « magnifique » se joue sur **montée de palier + glow + auras** dans cet idiome.
   Si un rendu painterly AAA est voulu plus tard, il faut basculer la SOURCE d'art (IA/artiste) — le
   moteur de composition (§4-5) reste identique.

## 2. Constat (existant réutilisable)

- **`Item` porte déjà tout** le nécessaire : `type`, `rarity`, `ilvl`, `damageType` (arme),
  `gems`, `unique` ([types.ts:199](src/game/types.ts#L199)). Aucun champ gameplay à ajouter.
- **Le « paper-doll » actuel est une GRILLE de 16 boutons-slots**, pas une figurine
  (`PaperDoll`, [StuffScreen.tsx:537](src/components/StuffScreen.tsx#L537)). La figurine est un
  **composant NOUVEAU** (`<Mannequin>`), posé **au-dessus** de cette grille — on ne la remplace pas.
- **Catégorie d'armure + classe se dérivent des talents** : gateways `cat_plaque/mailles/cuir/tissu`
  ([talents.ts:124](src/game/talents.ts#L124)) puis sous-arbres d'archétype. Pas de `classId` stocké
  sur `Character` → on le **résout** (§3).
- **Réutilisables tels quels** : `RARITIES[id].color` ([rarities.ts](src/game/rarities.ts)),
  `DAMAGE_TYPES[t].color/.icon` (glow élémentaire), `AVATAR_AURAS` + `av-aura-pulse`
  ([avatar.ts:104](src/game/avatar.ts#L104), réutilisé par [LevelBadge](src/components/LevelBadge.tsx)).
- **`sharp`** est déjà une devDep (génère les icônes PWA) → dispo pour un script d'optimisation/atlas.

## 3. Résolution de la classe (corps & curating du gear)

`Character` n'a pas de `classId`. On le dérive, dans l'ordre :

1. **Catégorie d'armure** = le gateway `cat_*` alloué (rang ≥ 1) dans `char.talents`. Détermine le
   **type d'armure** porté → quel set de calques de gear utiliser.
2. **Classe** = la racine d'archétype la plus investie sous cette catégorie (ex. `cl_druide`,
   `vo_*`, `gu_*`…). Détermine la **silhouette du corps** + la **teinte de classe**.
3. **Fallback** (perso frais sans talents) = dérivée de `char.primaryBias` → classe par défaut de la
   catégorie correspondante.

```
Plaque  → Guerrier · Paladin · Chevalier de la mort      (corps massif)
Mailles → Chasseur · Chaman                              (corps athlétique)
Cuir    → Voleur · Druide                                (corps agile/encapuchonné)
Tissu   → Mage · Prêtre · Démoniste                      (corps en robe)
```

> **Per-classe mutualisé→divergent** : aux **bas paliers** (V0–V2), les classes d'une même catégorie
> partagent une silhouette de gear (teinte de classe pour les distinguer). Aux **hauts paliers**
> (V3–V5), on assigne des pièces distinctes par classe (pièces « héroïques » curées) → l'identité
> visuelle se gagne avec la puissance.

## 4. Modèle de données (nouveau module `src/game/wardrobe.ts`)

100 % présentation. Aucune migration de save (rien n'est stocké de neuf sur `Character`/`Item`).

```ts
export type ArmorType = 'plaque' | 'mailles' | 'cuir' | 'tissu'
export type ClassId =
  | 'guerrier' | 'paladin' | 'dk'          // plaque
  | 'chasseur' | 'chaman'                  // mailles
  | 'voleur'   | 'druide'                  // cuir
  | 'mage'     | 'pretre' | 'demoniste'    // tissu

export interface ClassMeta {
  id: ClassId; name: string; armor: ArmorType
  body: string      // asset de la silhouette nue (calque de base)
  tint: string      // couleur d'identité de classe (teinte appliquée au gear bas-palier)
}

/** 6 paliers visuels : projection des 16 raretés (la forme du gear change 6 fois). */
export type VisualTier = 0 | 1 | 2 | 3 | 4 | 5
export function visualTier(r: RarityId): VisualTier {
  const t = RARITIES[r].tier // 1..16
  return (t <= 2 ? 0 : t <= 4 ? 1 : t <= 6 ? 2 : t <= 8 ? 3 : t <= 11 ? 4 : 5) as VisualTier
}

/** Résout corps + teinte d'un héros (talents → classe, fallback primaryBias). */
export function resolveClass(char: Character): ClassMeta

/** Un calque prêt à composer pour un slot rendu. */
export interface GearLayer {
  asset: string                 // chemin du PNG (ou clé d'atlas)
  z: number                     // ordre de composition (cf. §5)
  anchor: { x: number; y: number }
  tint?: string                 // RARITIES[r].color (teinte rareté, bas-palier surtout)
  glowColor?: string            // élément d'arme (DAMAGE_TYPES) ou rareté
  glow?: number                 // intensité 0..1, croît avec l'ilvl dans le palier
}

/** Construit la pile de calques d'un héros depuis son équipement réel. */
export function buildLayers(char: Character): GearLayer[]
```

### Slots → calques visibles (16 slots ≠ 16 calques)
Tous les slots ne donnent pas une pièce sur le corps. ~10 calques visibles ; les bijouteries
deviennent des **accents** (micro-glow) plutôt qu'une silhouette.

| Slot | Calque corporel | Région |
|---|---|---|
| `cape` | cape | dos (z le + bas) |
| `torse` | plastron | tronc |
| `jambes` | jambières | bas du corps |
| `pieds` | bottes | pieds |
| `mains` | gants | mains |
| `taille` | ceinture | taille |
| `epaules` | épaulières | épaules |
| `tete` | casque | tête |
| `armeSecondaire` | bouclier / main gauche | bras gauche |
| `armePrincipale` | arme | main droite (z le + haut) |
| `cou` `poignets` `anneau1/2` `bijou1/2` | — | accent optionnel (scintillement), pas de silhouette |

## 5. Le composant `<Mannequin>` (rendu)

Composant unique, deux tailles (`size` + `compact`) : figurine sur Stuff, vitrine sur Héros.

- **Composition** : empile les `GearLayer` en `position:absolute`, triés par `z` (dos → face) :
  ```
  cape < corps(base) < jambes < torse < bottes < mains < ceinture < épaules < casque
       < bouclier(bras G) < arme(main D)
  ```
- **Effets CSS (le « magnifique »)** :
  - **Teinte de rareté** : overlay coloré (`RARITIES[r].color`) sur le calque, surtout aux bas
    paliers où la forme bouge peu.
  - **Glow d'ilvl** : `drop-shadow` dont l'intensité = position de l'ilvl DANS le palier → chaque
    upgrade se sent un peu.
  - **Glow élémentaire d'arme** : `armePrincipale.damageType` → halo coloré sur l'arme
    (`DAMAGE_TYPES[t].color`). Quasi gratuit, très satisfaisant (épée de feu qui rougeoie…).
  - **Aura de prestige** : réutilise `AVATAR_AURAS` + `av-aura-pulse` derrière toute la figurine
    (déjà débloquées par hauts faits, [avatar.ts](src/game/avatar.ts)).
  - **Scintillement de gemmes** : si `item.gems`, micro-pulse (même idiome que la grille actuelle,
    [StuffScreen.tsx:628](src/components/StuffScreen.tsx#L628)).
- **Statique** : pose fixe, aucune frame d'animation. Tout le « vivant » vient du CSS.
- **Mobile** : hauteur bornée (~180–240 px) via `compact` ; la figurine vit dans la feuille
  « Équipement » existante ([StuffScreen.tsx:456](src/components/StuffScreen.tsx#L456)).

### Intégration UI
- **Stuff** : `<Mannequin>` en tête du `PaperDoll` (colonne 200 px desktop + feuille Équipement
  mobile). Au-dessus de la grille des 16 slots — on **voit** ce qu'on équipe en équipant.
- **Héros** ([HerosHub.tsx](src/components/HerosHub.tsx)) : `<Mannequin size="vitrine">`, grand,
  pour admirer/comparer ses persos.

## 6. Pipeline d'assets (le vrai chantier)

Rien de tel n'existe : le repo est aujourd'hui 100 % SVG/emoji. À créer :

- **Arborescence** : `public/wardrobe/<armorType|classId>/<slot>/<tier>.png` (transparent, même
  grille/pose/cadrage). Corps : `public/wardrobe/body/<classId>.png`.
- **Manifeste** (`src/game/wardrobeManifest.ts` ou JSON) : `(armorType|classId) × slot × tier`
  → `{ file, z, anchor }`. Champ `perClass?` pour les divergences hauts paliers.
- **Ancrage / z-order** : métadonnées par pièce (où l'épaulière se pose, devant/derrière le bras).
- **Atlas + lazy-load** : ~plusieurs centaines de PNG ⇒ atlas (sprite sheet) + chargement paresseux
  pour ne pas plomber la PWA. Script d'optimisation via `sharp` (déjà dispo).
- **`CREDITS.md`** : attribution LPC (obligation de licence, §1).

### Volume (factoring qui rend le tout faisable)
Gear partagé **par catégorie d'armure** (pas par classe) : `4 armures × ~10 slots × 6 paliers ≈ 240`
+ armes (par type d'arme × palier) + ~10 corps de classe + quelques pièces héroïques per-classe aux
hauts paliers. Fini et maintenable, vs ~2 560 en naïf (16 slots × 16 raretés × 10 classes).

## 7. Tranche verticale (dé-risquer AVANT de produire les assets)

But : prouver composition + ancrage + montée de palier sur le **vrai** écran, en 1 jour, avec des
**placeholders SVG** (silhouette + formes simples teintées) si le set LPC n'est pas encore intégré.

- **1 classe** : Guerrier (plaque).
- **5 slots** : `tete`, `epaules`, `torse`, `jambes`, `armePrincipale`.
- **2–3 paliers** visuels + glow d'ilvl + glow élémentaire d'arme.
- **Sur Stuff** (figurine en tête du paper-doll).
- **Go / No-Go** sur le ressenti réel. Si oui → on industrialise (Lots 2-4). Si non → 1 jour perdu,
  pas 3 mois.

## 8. Lots d'implémentation

- **Lot 0 — Données & résolution** : `wardrobe.ts` (`ArmorType`, `ClassId`, `ClassMeta`,
  `visualTier`, `resolveClass`, `buildLayers`), map slot→calque, z-order, projection rareté→palier.
  Placeholders SVG. *(aucun asset, build vert)*
- **Lot 1 — Composant `<Mannequin>` + tranche verticale** : composition en calques + effets CSS
  (teinte/glow/aura/élément), branché sur Stuff (1 classe, placeholders). **→ Go/No-Go (§7).**
- **Lot 2 — Pipeline d'assets** : arborescence `public/wardrobe`, manifeste, ancrage/z, atlas +
  lazy-load, script `sharp`, `CREDITS.md`.
- **Lot 3 — Set LPC mappé** : import + curating `armorType × slot × tier` + table de teintes par
  classe + divergences per-classe aux hauts paliers (V3–V5).
- **Lot 4 — Vitrine Héros + polish** : `<Mannequin>` grand format sur [HerosHub](src/components/HerosHub.tsx),
  réglages mobile (hauteur, compact), auras/élément finis.

> **Ordre conseillé** : 0 → 1 (et on s'ARRÊTE pour juger sur pièce) → 2 → 3 → 4. On ne touche aux
> ~240 assets qu'après le Go de la tranche verticale.

## 9. Risques & points ouverts (à trancher en cours de route)

- **Cohérence de l'art** (le piège du raster en calques) : exiger un set unifié (même grille, même
  palette de base recolorable). LPC le garantit ; un mix de sources non.
- **Style pixel** assumé (§1.2) — à confirmer que ça te convient une fois la tranche verticale vue.
- **Per-classe aux bas paliers** : combien de classes partagent vraiment une silhouette ? À regarder
  sur pièce (décision déjà prise : mutualisé bas / divergent haut).
- **Options cosmétiques** (genre du corps, couleur de peau/cheveux) : hors scope v0.43 ; un seul
  corps par classe pour commencer. Extensible plus tard (réutiliserait `Character.avatar`).
- **Bijouteries** (cou/anneaux/bijoux) : accent scintillant ou rien ? Défaut : rien en v0.43.
- **Poids PWA** : surveiller la taille de l'atlas ; lazy-load par classe/palier visible.

## 10. Ce qui NE bouge PAS

- Stats, combat, économie, loot, talents, sauvegardes : **rien**. Couche de présentation pure.
- Le médaillon [LevelBadge](src/components/LevelBadge.tsx) reste l'avatar compact partout ailleurs
  (combat, barres, listes). La figurine ne le remplace pas.
- Les parures de prestige (bordures/auras, [avatar.ts](src/game/avatar.ts)) sont **réutilisées** par
  la figurine, pas refaites.
