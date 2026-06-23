# 07 — Donjons & raids

> Source : [`dungeons.ts`](../../src/game/dungeons.ts), [`raids.ts`](../../src/game/raids.ts).
> UI : [`DungeonPanel.tsx`](../../src/components/DungeonPanel.tsx),
> [`RaidPanel.tsx`](../../src/components/RaidPanel.tsx), [`ExpedHub.tsx`](../../src/components/ExpedHub.tsx).
> Difficulté calée sur [`progression.ts`](../../src/game/progression.ts) (murs). Harnais : `npm run dungeon`.

## Rôle

Les **outils horizontaux** de la boucle : taper les vagues (farm) → farmer les **donjons**
(ressources/stuff ciblés) → réussir les **raids** (pièces hors-norme + matériaux rares). Le combat
reste idle ; la difficulté s'exprime en **seuils de stats** (checks).

## Donjons ([`dungeons.ts`](../../src/game/dungeons.ts))

Donjons « par **ressource** » (refonte v0.17) : chaque donjon **cible une ressource** (`DungeonReward`)
et porte une **identité mécanique légère** (`DungeonTrait`) qui valorise un build différent :

| Trait | Combat | Build récompensé |
|---|---|---|
| `rapide` | ennemis qui frappent fort | survie / EHP / résistances |
| `pack` | nuées | cleave / zone |
| `colosse` | un ennemi colossal | DPS mono + dégâts boss |
| `armure` | très blindés | **Pénétration** |
| `elite` | élites coriaces | DPS soutenu + dégâts boss |
| `regen` | se régénèrent | **burst** |

9 donjons (`DUNGEONS`) : Antre des Failles (🔑 Sceaux, **gratuit**, source des Sceaux), Or, Savoir
(XP), Éclats, Noyau, Butin (stuff), Orbes (coûte cher), Poussière, **Géode** (gemmes — ailes par
`GemFamily`, `GEODE_WING_ELEMENT`). Déblocage par `unlockStage` ; `anchorStage` cale la difficulté
quand elle diffère du déblocage (ex. contenu endgame gaté tard mais calé plus bas).

- **Run** : `dungeonFights(level)` combats → coffre. `sceauCost` à l'entrée (0 pour l'Antre).
- **Difficulté** : `dungeonContentIlvl` / `makeDungeonEnemy` / `makeDungeonPack`, `dungeonReq` (résist),
  `dungeonRegen` (trait regen), modificateurs `DUNGEON_MODIFIERS`.
- **Rendement** : `dungeonRunYield` (= 1/N d'un craft accessible, via `materialYieldAtChapter`),
  `dungeonKeyYield`, `dungeonLuckTier`. **Pas d'or/XP** en donjon (farm only — v0.36).
- **Rareté du butin (la Cache)** : `cacheRarityWindow(level)` — fenêtre à pic (1-7 historique,
  **8-14 = rampe via `shoulder`**, 15+ plateau Artefact), plafond `BUTIN_RARITY_CAP = 7` + over-chance.

## Raids ([`raids.ts`](../../src/game/raids.ts))

« Un boss, dix tiers » (refonte v0.23) : chaque raid = **un affrontement unique** (un duo pour
l'Abîme) dont le **boss change à chaque tier** (5 visages, qui reviennent « Éveillés » au-delà du T5,
`raidBossVariant` : +1 mécanique, +12 % dégâts).

**5 raids** (`RAIDS`/`RAID_ID`) avec **butin ciblé par catégorie** (`lootTypes`) :
⚒️ Forge (armes) · 💍 Reliquaire (bijoux) · 🏰 Citadelle (armures) · 🌈 Nexus (résistances) ·
🕳️ Abîme Primordial (tout — capstone, drop le set du Néant). Déblocage `RAID_UNLOCK_STAGE = 50` ;
l'Abîme est gaté derrière les **4 raids de base tous au Tier 10** (`requiresAllTier`), calé via
`tierOffset` (+6) / `anchorStage` (70).

### Mécaniques = checks de stuff (`RaidMechanicKind`)

| Mécanique | Check |
|---|---|
| `berserk` (Enrage mortel ⏱️) | **DPS** (timer de kill, `raidBerserkTime`) |
| `nova` (Nova cataclysmique ☄️) | **EHP** / mitigation (`NOVA_MULT = 3.6`) |
| `fortress` (Forteresse 🛡️) | **Pénétration** (armure/résist colossales) |
| `leech` (Sangsue 🩸) | **burst** (régén) |
| `swarm` (Déferlante 🐛) | **EHP de groupe** |
| `rotate` (Prisme instable 🌈) | **résistances larges** (change de type) |
| `execute` (Acharnement 💀) | course (frappe plus fort en perdant des PV) |

`recommendedDps` / `recommendedEhp` affichent les seuils ✓/✗ vs ton équipe.

### Difficulté & récompense (calées sur les murs)

| Knob | Valeur | Effet |
|---|---|---|
| `RAID_HP_VS_MUR` | **1.8** | PV du boss = 1.8× le **mur du Chapitre gardé** (`murBossHp`). |
| `RAID_DMG_VS_MUR` | **1.4** | DPS auto = 1.4× ce mur. |
| `tier` | T1 ↔ mur Ch.5 (vague 50) → T10 ↔ mur Ch.14 (vague 140) | **+10 vagues/tier**, ancré sur le **mur de Chapitre gardé** (`RAID_ANCHOR_LOW`/`HIGH`) ; ~10 tiers atteignables. |

- **Résistances exigées** : `raidReq` / `raidReqs` (req 100→430+ → check **obligatoire**, cf. [01](01-combat-et-degats.md)),
  `VULN` (chaque boss a une vulnérabilité). `ENEMY_DODGE.raidboss = 20 %` (hit cap 2000 Précision).
- **Multi-perso** : `raidPartyHpMult(partySize)` — la survie vient d'un 2ᵉ/3ᵉ héros qui heal/bouclier
  (les raids sont durs en solo = voulu, `ENEMY_DMG_CLASS.raidboss = 2.0`).
- **Butin** : `raidRarityWindow` (fenêtre à pic Myth T1 → Abyssal T10), `rollRaidLootCount`,
  `pickRaidLootType` (catégorie ciblée), `raidTrophyGain` (Trophées).
- **Matériaux** : `raidFragments` (Fragments d'éternité ✨, via `materialYieldAtChapter`, Chapitre =
  globalTier + 4), `raidCosmicQty` (Éclat cosmique 💫). `raidTierUnlockCost` pour monter de tier.
- **Gating de progression** : battre un tier ouvre le **mur du Chapitre** correspondant
  (`raidGateForStage`, voir [03](03-progression-et-monde.md)).

## Interactions

- Difficulté ancrée sur les murs (`murBossHp`/`murBossDmg`) → [03 Progression & monde](03-progression-et-monde.md).
- Rareté/matériaux ancrés sur `accessibleRarityTier`/`materialYieldAtChapter` → [04 Stuff & loot](04-stuff-et-loot.md).
- Uniques taggés (donjon 5 % / raid 30 %), set du Néant → [05](05-uniques-sets-gemmes.md).
- Contrats du Conseil (donjons/raids) → [02 Stats & maîtrises](02-stats-et-maitrises.md).
- Automates rejouent un donjon/raid battu → [08 Métiers & craft](08-metiers-et-craft.md).

## Dette / provisoire

- Le pacing **farm ↔ donjon ↔ raid** et l'anti-farm (escalier plein au Ch.8) sont marqués **à
  éprouver** : revérifier via `npm run dungeon` / `eco-donjons` après tout changement de courbe.
- `materialYieldAtChapter` est la **source unique** partagée donjons/raids : ne pas dupliquer la
  courbe de rendement ailleurs.
