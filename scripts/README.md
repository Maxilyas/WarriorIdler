# Scripts de vérification & d'équilibrage (data-driven)

Outils Node qui **transpilent le TypeScript du jeu en mémoire** (via esbuild) et exécutent la **vraie
logique** — pas de copie de règles, donc **pas de dérive**. Ils sont le filet de sécurité chiffré du
projet : à relancer après tout changement de scaling/équilibrage.

> Beaucoup ont un alias `npm run …` (voir `package.json`) ; les autres se lancent directement avec
> `node scripts/<fichier>.mjs` (ou `npx tsx scripts/check-talents.ts`).

## Garde-fous d'intégrité (à lancer après édition de l'arbre/classes)

### `validate-talents.mjs` — `npm run validate`
Anti-régression sur l'arbre de talents (`src/game/talents.ts`) : références `requires` inexistantes,
nœuds inaccessibles depuis le Cœur, IDs dupliqués, `unlockPower` pointant vers un sort inexistant.
> ⚠️ Ne suit que `requires` : il ne détecte **pas** les bugs de **budget** (`minSpent`/exclusifs) —
> compléter avec `check-talents` + `check-classes`.

### `check-talents.ts` — `npx tsx scripts/check-talents.ts`
Intégrité plus stricte : ids uniques, prérequis existants, capacités débloquées existantes, tout nœud
atteignable depuis `co_start`, et **verrous de palier finissables** (gate ≤ points disponibles dans la
constellation — le glouton d'allocation qui attrape les bugs de budget).

### `check-classes.mjs` — `npm run check-classes`
Vérif runtime des classes : alloue des talents, équipe des sorts, contrôle que `charCombatMods` +
`abilityDps` + les keystones (igniteOnCrit / petDps / combo / tagBonus…) produisent des nombres sains
(pas de NaN, lignes attendues).

## Harnais d'équilibrage (les courbes maîtresses)

### `ttk-sim.mjs` — `npm run ttk`
**Le filet de sécurité central.** Construit un perso calé sur chaque ilvl de contenu (équipement réel
via `generateItem`) et mesure le **temps de kill** vs les courbes d'ennemi. Si DPS ∝ `b^ilvl`, le TTK
est **plat** → pas de snowball. Calibre `ITEM_BUDGET0` / `ENEMY_HP0` / `ENEMY_DMG0`.

### `sim-mur.mjs` — `npm run mur`
**L'outil qui pilote le calibrage des murs.** Pour chaque Palier, compare un build **NU** (loot + stat
primaire seule) et un build **CIBLE** (loot + secondaires + talents, simulés fidèlement) contre le
boss-MUR. Source de vérité partagée avec les knobs de murs de `progression.ts`.

### `build-sim.mjs` — `npm run sim`
Harnais d'équilibrage des builds : construit des builds FOR/AGI/INT optimisés (stuff + keystones) et
sort un tableau DPS/EHP par rareté & niveau, plus le ratio de déséquilibre meilleur/pire build. À
relancer après tout changement de scaling (maîtrise, keystones, items).

### `survival-sim.mjs` — `npm run survival`
Harnais de **survie** : compare, par palier, le temps-pour-mourir (EHP tank / dégâts ennemis) au
temps-pour-tuer. Vérifie que les dégâts ennemis ne dépassent pas la capacité de survie au fil des paliers.

### `dungeon-sim.mjs` — `npm run dungeon`
Progression **donjon** : pour des builds stuffés au niveau de perso, affiche le niveau de donjon MAX
franchissable (survivre + tuer le boss), sur plusieurs traits. Garde une COURBE (pas un mur).

### `stat-weights.mjs` — `npm run weights`
**Poids de stats** : valeur marginale (ΔDPS%) d'une ligne d'affixe de chaque famille, + la courbe
d'empilement des lignes de type. C'est lui qui a mesuré la domination des `+% type` et calibré les soft
caps (`TYPE_BONUS_*` dans `damage.ts`, `DMG_LINE_*` dans `items.ts`).

### `dps-check.mjs` — `npm run dps`
Calcule `charDps` (le DPS affiché) pour comparer des configs — utile pour vérifier qu'un multiplicateur
(keystone, profil) est bien pris en compte.

## Économie

### `eco-sim.mjs` — `npm run eco`
Rendement par run de donjon (or/éclats/noyau/poussière) vs coût d'un craft à la progression
correspondante (`createCost`/`ascendCost`/`reforgeCost`). Le ratio « crafts par run » doit rester
**stable** (~1-3) à tous les niveaux.

### `eco-donjons.mjs` — `node scripts/eco-donjons.mjs`
Analyse éco des donjons (v0.36) : difficulté vs murs + drop par niveau vs coût de craft accessible.

### `mats-par-niveau.mjs` — `node scripts/mats-par-niveau.mjs`
Rendement par run de **chaque** donjon de matériau, indexé sur la rareté **accessible** (Cache + raids)
par chapitre. Vérifie la cohérence de `materialYieldAtChapter`.

## Métiers

### `verif-forge-hex.mjs` — `npm run forge-hex`
Vérif de la **Forge hexagonale** (v0.41) : voisinage axial, Chaînes (run connecté de même famille),
Creuset (entrées possédées), règle de **forgeabilité par adjacence**.

## Simulations de classes (calibrage TTK par archétype)

| Script | Sujet |
|---|---|
| `sim-classes.mjs` | Simulateur d'équilibrage de **toutes** les classes (DPS réel par classe, refonte v0.29). |
| `sim-voleur-hybride.mjs` | Synergie Assassin × Ombrelame (« Lame Vénéneuse »). |
| `sim-guerrier-hybride.mjs` | Synergie « Juggernaut » (Sentence × Rempart). |
| `sim-mage-convergence.mjs` | Convergence tri-élémentaire (feu × givre × arcane). |
| `sim-pretre-hybride.mjs` | Synergie Lumière × Vide (« Crépuscule »). |
| `sim-chasseur-hybride.mjs` | Symbiose (Meute × Œil de faucon, familier + concentration). |
| `sim-druide-metamorphe.mjs` | « Danse Primordiale » — formes rotatives (mécanique neuve). |

Lancement : `node scripts/<fichier>.mjs`.

## Vérifs ponctuelles (one-off, liées à une version)

Scripts écrits pour valider un changement précis ; gardés pour la traçabilité. Ils tournent toujours
sur le vrai code mais ciblent une version donnée — lire leur en-tête avant de s'y fier.

| Script | Vérifie |
|---|---|
| `verif-stats-v038.mjs` | Refonte des stats v0.38 sur la fiche (avant/après). |
| `verif-v036-raids-cache.mjs` | v0.36 : PV des boss de raid montent à chaque tier + table de loot de la Cache. |
| `verif-mats-courbe.mjs` | Donjons + raids suivent la courbe de matériaux validée. |
| `verif-abime.mjs` | Abîme (2 tiers 220/240, fragments/cosmique boostés, rareté T10+traîne). |
