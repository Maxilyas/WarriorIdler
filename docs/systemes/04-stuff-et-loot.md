# 04 — Stuff & loot

> Source : [`items.ts`](../../src/game/items.ts) (génération, budget, rareté, craft, qualité),
> [`rarities.ts`](../../src/game/rarities.ts), [`slots.ts`](../../src/game/slots.ts).
> Budget exponentiel : [`progression.ts`](../../src/game/progression.ts). UI :
> [`StuffScreen.tsx`](../../src/components/StuffScreen.tsx), [`ComparePanel.tsx`](../../src/components/ComparePanel.tsx),
> [`ItemRow.tsx`](../../src/components/ItemRow.tsx). Harnais : `scripts/stat-weights.mjs`, `eco-sim.mjs`.

## Rôle

Le **pilier du jeu** : générer, comparer, crafter et optimiser l'équipement. Un objet = stat
primaire + Endurance + affixes secondaires (`stat`/`dmgType`/`resist`) + qualité + sockets +
éventuel effet unique.

## Emplacements & types ([`slots.ts`](../../src/game/slots.ts))

**16 emplacements** (`EQUIP_SLOTS`) : tête, cou, épaules, cape, torse, poignets, mains, taille,
jambes, pieds, anneau I/II, bijou I/II, arme principale, arme secondaire (bouclier). **14 types
d'objet** (`ITEM_TYPES`) avec un **poids de budget** (`weight`) : arme 2 · torse/jambes 1.4 ·
bouclier 1.2 · casque/épaules/gants/bottes 1 · ceinture 0.8 · bijou 0.7 · cou/cape/poignets/anneau 0.6.

## 16 raretés ([`rarities.ts`](../../src/game/rarities.ts))

Médiocre(1) → Transcendant(16). Chaque cran = plus d'**affixes de base** (`affixCount` 1→8),
plus rare au drop (`weight` décroissant 1000→0.07). `rollRarity(luckTier)` tire pondéré.

> ⚠️ **`statMult` ne pilote plus le budget** depuis v0.30 (sert **uniquement** au scaling des effets
> uniques). Le budget d'une rareté vient du **bonus d'ilvl-équiv** `RARITY_ILVL_PER_TIER = 8`/cran.

## Budget exponentiel (cœur de la refonte v0.30)

`itemBudget(ilvl, rarityTier, weight, qMult) = ITEM_BUDGET0 · powerAt(effItemIlvl) · weight · qMult`.
La **stat primaire** porte le budget → DPS ∝ `b^ilvl` → **TTK constant**. Répartition par
**orientation** (`ORIENTATION_FRAC`) : armes offensives, boucliers défensifs, armures variées.
Toute pièce donne de l'**Endurance** (la survie scale aussi). `effItemIlvl = ilvl + 8·(tier−1)`.

### Lignes secondaires (`rollLineValue`)

- **stat** : proportionnelle au budget (`SECONDARY_FRAC = 0.7`) puis **soft-capée**
  (`SECONDARY_SOFT = 400` → `SECONDARY_HARD = 700` rating) → suit le primaire à bas ilvl,
  plafonne au mid-game (% borné → TTK plat), toujours < primaire. Stats rares ×0.5.
- **dmgType** (`+% type`) : `(DMG_LINE_BASE 8 + rand·DMG_LINE_RANGE 12) × (1 + tier·0.07)`.
- **resist** : en **points** (pas de cap %), scale avec la rareté (la course à l'armement des raids).

Pool pondéré `STAT_WEIGHTS` : offensives 6-10, défensives 7-8, **rares** très faibles (volDeVie 0.6,
surpuissance/multifrappe/recuperation 0.3). **Polyvalence et les stats dépréciées sont à 0** (ne
rollent plus). `+% type` : physique 4, autres 6 ; resist : 5 chacun.

## Génération — `generateItem(opts)`

1. ilvl `clampIlvl` (cap 700) ; rareté tirée ou forcée.
2. **Plancher d'ilvl par rareté** (`maxRarityTierForIlvl = 6 + ilvl/16`) : un drop **aléatoire** de
   haut tier ne peut pas tomber sur un bas ilvl (anti « ilvl 30 abyssal »). Coffres/raids/craft
   (rareté forcée) **non concernés**.
3. **Rareté plancher** (`minTier`) pour les coffres.
4. **Qualité** 1-5 (`rollStars`) : agit sur le **budget** (`starsMult`) ET le **nombre de lignes**
   (`qualityBonusAffixes` : +0/+0/+1/+1/+2). Nombre de lignes = `min(9, affixCount + bonus qualité)`.
5. **Type de dégâts** : arme principale seulement (35 % physique, sinon élément).
6. Sockets (`rollSockets`), unique (`rollUnique`).

## Fenêtres de rareté — la famille de fonctions

| Fonction | Usage |
|---|---|
| `rollWindowRarity(floor, peak, cap, {down, shoulder, tail})` | **LA** fonction de rareté unifiée : distribution « plancher → **PIC** → plafond » à deux pentes géométriques. Farm / Cache / raids. |
| `rollFarmRarity(stage, shift)` | Farm : pic glisse Commun→Épique, **plafond dur `FARM_RARITY_CAP = 6`** (Légendaire). Le farm n'est pas la chasse à la rareté. |
| `boxRarityWindow(box, rTop)` | Fenêtre EFFECTIVE d'un coffre du marché : module l'ancre `unlockedRarityTier` via `shape` (POOR/DUMP/RICH), `capDelta` (départ −1 = budget ; >0 = capBonus) et `peakShift` (premium +1). Tire ensuite via `rollWindowRarity` ; `windowRarityDist` en donne le % par rareté (affiché au Marché). Jackpot = forme RICH ponctuelle. |
| `contentRarityTier(bestStage, bestRaidTier)` | Rareté **du contenu** = ancre du craft / over-content (Cache→Artefact, raids +1/2 tiers, plafond Abyssal). |
| `unlockedRarityTier(bestRaidTier)` | Rareté **débloquée du compte** = ancre des **coffres** (fenêtre [Rmax−4 → Rmax], pic au plancher = dump d'or). |
| `accessibleRarityTier(chapter)` | Rareté **accessible** à un Chapitre = ancre des rendements donjon + fragments/cosmique raid. |

## Score, vente, recyclage

- `itemScore` : Σ stats + primaire (×1) + lignes type (×2) + résist (×3) + gemmes (60/gemme) + unique (150).
- `sellValue` → Or ; `recycleValue` → Éclats d'arcane ; `recyclePoussiere` → Poussière d'étoile (Céleste+).
- **Recyclage auto au drop** (`tickSlice`, deux critères CUMULABLES, `bulkProtected` épargne toujours
  verrou 🔒 + uniques Cosmique+) : `autoRecycle` recycle tout butin **strictement sous le seuil de rareté**
  (`recycleThreshold`, uniques compris — essences créditées, Codex préservé : comme un drop puis un
  recyclage de masse) ; `autoRecycleUseless` recycle tout butin qui **n'améliore NI le DPS NI la survie**
  d'aucun héros recruté (`itemUsefulForAnyChar` → `charDps`/`charEhp`, comparé à l'emplacement occupé).
- **Tri manuel de masse** (`sellAllBelow`/`recycleAllBelow`, écran Gérer) : tout ce qui est **sous le seuil
  de rareté** ; option `uselessOnly` (case à cocher) qui RESTREINT en plus au butin **inutile** (même
  `itemUsefulForAnyChar` que l'auto). Mêmes protections `bulkProtected`. Seuil au max + coché = recycler
  tout l'inutile, toutes raretés.

## Craft — améliorer / créer / ascensionner

Tout passe par `CraftCost = { eclats, noyau, fragments?, poussiere?, cosmic? }`.

- **Reforge** (`reforgeCost`, `reforgeItem`) : reroll des affixes, **verrou** d'une ligne (+100 %/verrou),
  renchérit par usage (`CRAFT_REPEAT_GROWTH = 1.18`).
- **Surilvl** (`surillvlCost`, `surillvlItem`, +`SURILLVL_STEP = 2`) : plafonné au contenu + marge
  (`SURILLVL_OVER_MARGIN = 6`), sur-coût ×4/pas au-dessus (`SURILLVL_OVER_COST_MULT`).
- **Ascension** (`ascendCost`, `ascendItem`) : +1 cran, **garde** lignes/unique/gemmes/rune + ajoute
  une ligne. Facteur **majoré** (×1.35) : strictement meilleur qu'une création aléatoire.
- **Création** (`createCost`) : éclats `craftEclats` (gros puits) + matériaux par table
  (`CRAFT_NOYAU`/`POUSSIERE`/`FRAGMENTS`/`COSMIC`, indexés par tier).

### Gating du craft (anti-snowball)

- **Verrou raid** : `craftRaidGate(tier) = tier − 8` → crafter un cran t exige un tier de raid ≥ t−8.
  Stocker des fragments **n'achète jamais** un cran au-dessus de ton contenu.
- `maxCraftTier(bestStage, bestRaidTier)` : double horloge (farm ET raid).
- **Over-content** : `overContentMult(target, content) = OVER_CONTENT_STEEP(4)^(target−content)` →
  +1 = ×4 (dizaines de runs), +2 = ×16, +3 = ×64. **C'est le chase**, pas du farm.

## Économie de craft (cadence)

`materialYieldAtChapter(material, chapter)` = coût d'un craft à la rareté **accessible** ÷
`CRAFT_RUNS_TARGET = 10` → un run/clear ≈ 1/10 d'un craft accessible. **Source de vérité partagée**
par donjons (niveau = Chapitre) et raids (Chapitre = globalTier + 4). À vérifier via `npm run eco`.

## Qualité unifiée (v0.27)

1-5 (`QUALITY_NAMES` Grossier→Chef-d'œuvre) sur **tout** le stuff (drop & craft). **Seul levier qui
ajoute des lignes** au-dessus du plancher fixe de la rareté.

## Interactions

- Effets uniques, sockets, runes → [05 Uniques, sets & gemmes](05-uniques-sets-gemmes.md).
- Métiers (Forge hexagonale, transmutation, Quintessence) → [08 Métiers & craft](08-metiers-et-craft.md).
- Loot windows ancrées sur la progression → [03 Progression & monde](03-progression-et-monde.md).
- Reliques (`relicFromItem`, `RELIC_BASE_ILVL`) → prestige, [03](03-progression-et-monde.md).

## Dette / provisoire

- Plusieurs fonctions de rareté **coexistent** (`contentRarityTier`, `unlockedRarityTier`,
  `accessibleRarityTier`) — **séparées à dessein** (craft vs coffres vs rendement). Ne pas les fusionner
  sans relire leurs commentaires.
- Quintessence d'objet (`quintCost`, `enhanceTypedAffixes`) = levier joaillier, voir [08](08-metiers-et-craft.md).
