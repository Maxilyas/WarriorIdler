# 03 — Progression & monde

> Source : [`progression.ts`](../../src/game/progression.ts) (**source de vérité chiffrée**),
> [`enemies.ts`](../../src/game/enemies.ts), [`biomes.ts`](../../src/game/biomes.ts),
> [`biomeBonus.ts`](../../src/game/biomeBonus.ts), [`offline.ts`](../../src/game/offline.ts),
> [`prestige.ts`](../../src/game/prestige.ts). Partagé avec `scripts/ttk-sim.mjs` & `sim-mur.mjs`.

## Rôle

Définit **la courbe de puissance unique** du jeu (joueur ET ennemis), le découpage du monde en
**Chapitres / Vagues / Murs**, le **retard de gear** permanent, les biomes, le hors-ligne et le prestige.

## Courbe maîtresse (refonte v0.30)

**Une seule loi de puissance**, base commune `b` pour le joueur et les ennemis :
`powerAt(ilvl) = POW_BASE^ilvl`.

| Knob | Valeur | Effet |
|---|---|---|
| `POW_BASE` | **1.018** | +1.8 %/ilvl → ×2 tous les ~38.9 ilvl. Courbe **aplatie** (v0.32.1) pour des chiffres lisibles. |
| `ILVL_MAX` | **700** | Cap dur : aucun drop/craft/surilvl/boss de raid ne dépasse. |
| `RARITY_ILVL_PER_TIER` | **8** | Rareté = bonus **additif** en ilvl-équiv (+8/cran ≈ +15 % puissance). |
| `ITEM_BUDGET0` | **8.0** | Échelle du budget de stats (`itemBudget` exponentiel en ilvl effectif). |
| `ENEMY_HP0` / `ENEMY_DMG0` | **12500 / 320** | Échelles de PV/dégâts trash, calibrées par `npm run ttk`. |

> **Invariance TTK** : joueur et ennemis partageant `b`, le temps de kill est **constant** à stuff
> calé ; un sur-stuff de +Δ ilvl ne donne qu'une réduction **bornée** `b^Δ` → plus de boule de neige.

**Classes d'ennemi** (= ratios de TTK) : `ENEMY_HP_CLASS` (trash 1 · elite 2.7 · champion 4 ·
boss 11.7 · raidboss 13.3) et `ENEMY_DMG_CLASS` (trash 1 · elite 1.4 · champion 1.25 · boss 1.8 ·
**raidboss 2.0** — les raids sont du contenu de **groupe**, durs en solo = voulu).

**Cibles** : `TTK = { trash 3, elite 8, boss 35, raidboss 40 }` s, `SURVIVE_SECONDS = 8`.

## Chapitres, Vagues & Murs (v0.35/v0.36)

Un **seul axe d'ilvl** porté par le farm. Le `stage` du code = une **Vague** ; un **Chapitre** =
bloc de `CHAPITRE_SIZE = 10` vagues, fermé par un **boss-MUR** (vague 10).

- `chapitreOf(stage)`, `vagueOf(stage)`, `isMur(stage)`, `chapitreLabel` → « Chapitre C · Vague V/10 ».
- **Frontière** (difficulté du contenu) : `frontierIlvl(stage) = round(stage × PENTE_VAGUE)`,
  `PENTE_VAGUE = 1.45` (~10 ilvl/Chapitre ; le loot atteint ~200 au mur du Chapitre 15).
- **Retard de gear** : `lagAt(chapitre) = LAG0 + K_LAG·chapitre` (`LAG0 = 4`, `K_LAG = 0.9`).
- **Loot de farm** : `lootFarmIlvl = clamp(frontière − lag, 1, ILVL_CAP_BASE)`.

| Knob | Valeur | Effet |
|---|---|---|
| `ILVL_CAP_BASE` | **200** | Plafond du loot de **contenu de base** (farm/donjons/raids T1-T10) → endgame **horizontal**. |
| `ILVL_CAP_ENDGAME` | **240** | Plafond de l'endgame (Abîme & raids endgame) : seule source d'ilvl > base. |

> **On ne peut pas out-ilvl un mur** : la difficulté (frontière) continue de monter au-delà du cap,
> mais le gear plafonne → l'écart se comble **uniquement par l'optimisation** (secondaires/gemmes/
> runes/pacte/alchimie/talents).

### Gate de raid (v0.36)

Prologue **Chapitres 1-5 libre** (sans raid), puis 10 vrais Chapitres **(6-15)** dont l'entrée est
gatée par un **tier de raid** (`raidGateForStage`) : battre le Raid **T1 → Chapitre 6**, T2 → 7, …,
**T10 → Chapitre 15** (formellement : franchir le **mur** du Chapitre `c`, avec 5 ≤ c ≤ 14, exige le
Raid T(c−4)). Au-delà du Chapitre 15 : libre, mais l'ilvl du loot **plafonne** (`ILVL_CAP_BASE = 200`).

### Escalier des vagues (v0.40.1, accessible)

Chaque Chapitre **repart bas** et monte jusqu'à son boss : vague V = V·10 % du boss du Chapitre
(`waveStat`, `metricBoss × vague/10`). Pour rester **accessible**, l'escalier **fond** progressivement :

| Knob | Valeur | Effet |
|---|---|---|
| `STAIRCASE_PROLOGUE` | **4** | Dernier Chapitre 100 % sur la courbe d'onboarding (un perso nu tue la vague 1). |
| `STAIRCASE_FULL` | **8** | 1er Chapitre à escalier **plein** (ancré au boss ; le joueur a du stuff de raid). |

`staircaseBlend(chapitre)` mélange les deux. Avant : la courbe d'**onboarding** `onboardingMult`
(`ONBOARD_STAGES = 22`, `FARM_PLATEAU = 0.55`) — rampe très douce (exposant 2.6) puis plateau de
farm à 55 % de la courbe calibrée (les sims calibrent sur du **légendaire**, le farmeur a de
l'**épique**). Les **raids n'y passent pas** (pleine échelle).

### Murs (boss de fin de Chapitre)

`makeEnemy` (stage % 10 == 0) ou `murBossHp`/`murBossDmg` (source de vérité **partagée** avec
`raids.ts`). Mécanique **dominante** cyclée (`murMechanic` : berserk/nova/fortress/leech/rotate),
**enrage DPS** (`murEnrage = MUR_TARGET_TTK × margeMur`, marge 1.30 à P10 → 1.05 à P40),
**PV ramp** post-prologue (`murHpRamp` : ×2 au Ch.15) et **régén** (`murRegenAt` : jusqu'à 4 %/s)
→ force le burst/heal d'un 2ᵉ-3ᵉ héros.

### Génération d'ennemi (`makeEnemy`)

Faune & boss **par biome** (zéro redondance inter-biomes), épithètes déterministes, **élite ◆**
(`ELITE_EVERY = 7`) et **champion ✦** (`CHAMPION_CHANCE = 0.03`) = **marqueurs de butin** (plus de
pic de difficulté depuis v0.40, les traits ont été retirés). Résistance globale `stageResistRamp`
(dès la vague 25, cap 55 %) + **affinité élémentaire** (voir [01](01-combat-et-degats.md)). Auto-attaques
**toujours physiques** + technique **signature** du biome (DoT/burst/CC typé). Exigence de résist
`farmReq` (dès la vague 45).

## Biomes

7 biomes = les 7 types de dégâts ([`biomes.ts`](../../src/game/biomes.ts)), **Physique = zone de
départ**. Chaque biome a **sa** progression de vagues (`biomeStages`/`biomeBest`) ; la zone tourne
au hasard toutes les ~1 h (`BIOME_ROTATE_MS`).

**Bonus de biome** ([`biomeBonus.ts`](../../src/game/biomeBonus.ts)) :
- **Maîtrise des zones** : bonus de dégâts **minime** (`maitriseBonus(bestStage)`, ~5 % à P150,
  cap `MAITRISE_CAP = 0.10`) — de la collection, pas une source de puissance.
- **Surcharge** : un biome tournant toutes les 30 min (`SURGE_INTERVAL_MS`) donne +50 % or/XP
  (`SURGE_GOLD_XP_MULT`) et ×2 Quintessence (`SURGE_QUINT_MULT`).

## Hors-ligne ([`offline.ts`](../../src/game/offline.ts))

`simulateOffline` estime le rythme de kills (DPS équipe vs PV de l'ennemi de la vague courante) à
taux réduit. La **vague ne progresse pas** hors-ligne (farm sûr).

| Knob | Valeur |
|---|---|
| `OFFLINE_CAP_MS` | **12 h** |
| `OFFLINE_RATE` | **0.5** |
| `MIN_OFFLINE_MS` | 60 s (pas de récap sous 1 min) |
| `MAX_OFFLINE_DROPS` | 12 |

Gains alignés sur le farm en ligne (`CLASSIC_GOLD_MULT = 5.0`, `CLASSIC_XP_MULT = 8` côté store) ;
or = **farm only**.

## Prestige « Éveil Primordial » ([`prestige.ts`](../../src/game/prestige.ts))

Reset **dur** (rend vagues, niveau, stuff sauf **1 Relique**, tiers de raid) contre des **Échos
primordiaux**. Conservés à travers l'Éveil : Échos + **Constellation** (méta-arbre, 8 nœuds),
Relique, record de progression (gating), XP des métiers.

- **Échos gagnés** : `echosGain(bestRaidTier, bestStage, raidsBeaten, echosMult)` — indexé sur **le
  contenu vaincu**, pas le temps farmé.
- **Constellation** : `CONSTELLATION` (vélocité, puissance, vitalité, acclimatation/résist,
  offrande/hors-ligne, résonance/échos, relique/ilvl plancher, première étincelle). Coût ×1.6/rang
  (`nodeCost`). Effets agrégés par `constellationMods`. Relique : `RELIC_BASE_ILVL = 24` + bonus.

## Interactions

- Toute la difficulté alimente [01 Combat](01-combat-et-degats.md) ; le loot alimente [04 Stuff & loot](04-stuff-et-loot.md).
- Le gate de raid lie ce module à [07 Donjons & raids](07-donjons-et-raids.md).
- La Constellation/les bonus de compte se cumulent dans `computeGlobalMods` ([upgrades.ts](../../src/game/upgrades.ts)).

## Dette / provisoire

- Les knobs `STAIRCASE_*`, `murHpRamp`/`murRegenAt`, `margeMur` sont marqués **« à éprouver au
  playtest »** dans le code.
- L'**application en combat** de certaines dominantes de mur (nova/fortress/leech/rotate) était posée
  en métadonnée (v0.35) ; vérifier le câblage côté `store.ts` avant de s'appuyer dessus.
