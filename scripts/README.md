# Scripts de vérification & d'équilibrage (data-driven)

Outils Node qui **transpilent le TypeScript du jeu en mémoire** (via esbuild) et exécutent la **vraie
logique** — pas de copie de règles, donc **pas de dérive**. Ils sont le filet de sécurité chiffré du
projet : à relancer après tout changement de scaling/équilibrage.

> Beaucoup ont un alias `npm run …` (voir `package.json`) ; les autres se lancent directement avec
> `node scripts/<fichier>.mjs` (ou `npx tsx scripts/check-talents.ts`).

> **Équilibrage = vrais builds.** Les anciens harnais de combat à builds **synthétiques** (`ttk`, `sim`,
> `survival`, `mur`, `dungeon`, `weights`, `dps`, `explorer`, `sandbox`, et les sims de classe/synergie
> `sim-*-hybride`…) ont été **retirés** : un build généré n'est pas représentatif de ce que jouent
> réellement les joueurs. Le seul harnais d'équilibrage de builds est désormais
> **`builds-bench` / `build-leaderboard`**, qui rejoue les **vrais builds** (catalogue de référence curé
> + soumissions communautaires) sur le moteur du Simulateur in-game.

## Équilibrage par les vrais builds (la référence)

### `builds-bench.mjs` — `npm run bench`
**Banc d'essai des builds** via le MÊME moteur que l'écran Simulateur (`runSim`). Teste le **catalogue de
référence** (`src/game/referenceBuilds.ts`) ET le **catalogue communautaire** (`src/game/communityBuilds.json`,
codes `WIB1:` décodés via `buildCode.ts`) dans les mêmes conditions : tier/niveau max, DPS équipe, EHP min,
mur. Sort aussi des **tendances** d'usage des capacités actives (top utilisées + sorts « jamais choisis »
= sous-utilisés). Le catalogue communautaire est alimenté par les **soumissions GitHub** des joueurs
(Simulateur → 🔗 Partager → 🚀 Soumettre → issue → Action `ingest-builds.yml` → `ingest-build.mjs`).

### `build-leaderboard.mjs` — `npm run leaderboard`
Rejoue chaque build (référence + communautaire) sur un **benchmark commun** via le vrai moteur `runSim`,
extrait toute la compo (talents/sorts/gemmes/runes/uniques), agrège des KPI et émet une **page HTML
autonome et interactive** (`dist/leaderboard.html`, publiée sur GitHub Pages via `deploy.yml`).

### `bench-difficulty.mjs` — `npm run bench-diff [chemin/save.json] [--json]`
**Harnais de DIFFICULTÉ en mode GRILLE** (≠ `bench`, qui scanne le max par build). Rejoue tout le corpus
contre une **grille fixe** (chaque tier de chaque raid) et répond à *« quel raid mure quel build, à quel
tier, et POURQUOI »* (cf. [`../docs/DIFFICULTE.md`](../docs/DIFFICULTE.md) §9). Deux sources :
- 🌍/📚 **communauté + référence** (codes `WIB1:` → `SimConfig`) — joués via le vrai moteur `runSim` ;
- 💾 **save export** du joueur (Réglages → exporter, argument positionnel) — l'**équipe RÉELLE** est jouée
  via `makeRaidEncounter` + `partyCombatStepMulti` (**duo-aware** pour l'Abîme) avec les **vrais** mods de
  compte + gemmes/runes/pactes/conso (loader `sanitizeRaw`, comme `save-audit`). Sa progression réelle
  (`bestStage` / `raidProgress`) sert de **vérité terrain** → le rapport mesure l'**offset sim-vs-réel**
  (le sim suppose un jeu parfait ⇒ ~+1 tier optimiste).

Sort, **par cellule (raid × tier)** : taux de **clear %**, **TTK** médian/p25/p75, **marge de survie**
(TTD÷TTK, via une sonde PV-boss-∞), **type de mur** (DPS / survie / résist, selon `firstDead` + déficit
vs `raidReqs`), les **keystones/uniques partagés par les clearers** (détection de build dominant), et un
**verdict** par pièce (🔴 trop dur / 🟢 sur cible / 🟡 trop facile), calé sur la **bande qui devrait la
battre** (`bestStage ≥` mur du Chapitre gardé). Bucketise par **bande de progression** et **alerte
« cluster vs outlier solitaire »** (§1 : l'alerte est l'isolement d'un build, pas le ×20 brut). `--json`
dumpe `difficulty-report.json` (cellules brutes, pour un futur dashboard).
> ⚠️ **Mesure pure** : aucun knob d'équilibrage n'est touché. Fidélité = celle de `save-audit` (kit de boss
> télégraphié + jeu parfait ; les novas/déferlantes/rotations *périodiques* de `tickRaid` sont omises).
> Les **verdicts agrégés** ne sont fiables qu'avec **N≥3 builds sur la bande** (panel de saves / corpus
> communautaire) ; sur une **save seule**, la grille reste un **diagnostic perso** (mur de CE build + offset).

### `ingest-build.mjs` (pipeline, pas un alias)
Décode une soumission `WIB1:` (issue GitHub) et l'ajoute à `src/game/communityBuilds.json`. Lancé par
l'Action `ingest-builds.yml` ; Git reste le store (aucun backend). `npm run bench` teste ensuite tout le
catalogue.

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

## Couverture (effets uniques / câblage)

### `uniques-sim.mjs` — `npm run uniques`
**Couverture des effets uniques + sets.** Pose chaque unique sur une pièce de référence et mesure sa
**valeur marginale** (ΔDPS% / ΔEHP% via `charDps`/`charMaxHp`/`charEhp`), le scaling rang×rareté, et
les bonus de set par seuil (2/4/6). Intègre une **sonde de liveness** (chaque stat utilisée bouge-t-elle
un axe joueur ?) qui détecte un mod mort/silencieux. Garde-fou : NaN, croissance par rang, paliers de
set incohérents. Sépare les uniques **taggés** (valeur de tag annoncée — dépend du build porteur).

### `maitrise-sim.mjs` — `npm run maitrise`
**Couverture du 🏛️ Conseil des Maîtrises** (progression de compte time-gatée). Vérifie le **couplage à
deux fichiers** signalé comme fragile : chaque nœud de `maitrise.ts` est-il **câblé** dans
`computeGlobalMods` (`upgrades.ts`) et le **%/rang affiché** colle-t-il au coefficient réellement
appliqué ? Quantifie l'effet total (tout maxé ≈ +12% de combat agrégé) et la cadence time-gate
(56 points · 3 contrats/sem → ~19 semaines). Garde-fou : nœud non câblé, dérive display↔moteur.

## Économie & craft

### `eco-craft-sim.mjs` — `npm run eco-craft`
**Couverture éco du craft** (3 puits) : courbe de coût + effet des **améliorations** du Marché
(`computeGlobalMods`), **automates** de forge (rendement/heure via `tickAutomates` vs coût de
construction), **alchimie** (courbe de qualité des brassins + économie des réactifs). Garde-fou
d'intégrité : amélioration non câblée, coût non croissant, **paire de réactifs dupliquée** (recette
masquée → inbrassable), fenêtre parfaite atteignable.

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

## Audit personnalisé (depuis ta sauvegarde)

### `save-audit.mjs` — `npm run audit -- chemin/vers/ta-save.json`
**Pas un garde-fou d'équilibrage global, mais un diagnostic PERSO** : charge un fichier JSON de save
(export du jeu) via le vrai `sanitizeRaw` (migrations + validation), applique TES mods de compte
(`computeGlobalMods` : améliorations + maîtrises + hauts faits), puis audite le perso ACTIF :
1. **Donjons** : niveau max franchissable par donjon + facteur limitant (survie / vitesse).
2. **Raids** : tier max battable + facteur limitant (enrage / survie).
3. **Sorts équipés** : contribution DPS de chacun par retrait marginal (repère le poids mort).
4. **Talents** : points dépensés/dispo, gain de DPS de l'arbre, nœuds alloués sans effet.

Sans argument → **mode démo** (perso stuffé généré) qui prouve le pipeline. Le combat (donjons/raids)
tourne le **VRAI `partyCombatStep`** sur toute l'équipe (heal, cooldowns, mécaniques de boss inclus),
sans buffs gemmes/runes/conso (plancher) et en supposant un jeu parfait (léger plafond) ; il affiche le
**diagnostic du mur** (qui tombe en premier, quand, PV restant du boss → mur de survie vs de DPS).

## Vérifs ponctuelles (one-off, liées à une version)

Scripts écrits pour valider un changement précis ; gardés pour la traçabilité. Ils tournent toujours
sur le vrai code mais ciblent une version donnée — lire leur en-tête avant de s'y fier.

| Script | Vérifie |
|---|---|
| `verif-stats-v038.mjs` | Refonte des stats v0.38 sur la fiche (avant/après). |
| `verif-v036-raids-cache.mjs` | v0.36 : PV des boss de raid montent à chaque tier + table de loot de la Cache. |
| `verif-mats-courbe.mjs` | Donjons + raids suivent la courbe de matériaux validée. |
| `verif-abime.mjs` | Abîme (2 tiers 220/240, fragments/cosmique boostés, rareté T10+traîne). |
