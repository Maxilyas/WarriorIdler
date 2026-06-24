# 05 — Uniques, sets & gemmes

> Source : [`uniques.ts`](../../src/game/uniques.ts), [`sets.ts`](../../src/game/sets.ts),
> [`gems.ts`](../../src/game/gems.ts), [`condGems.ts`](../../src/game/condGems.ts),
> [`enchants.ts`](../../src/game/enchants.ts). UI : [`GrimoirePanel.tsx`](../../src/components/GrimoirePanel.tsx)
> (codex), [`AtelierPanel.tsx`](../../src/components/AtelierPanel.tsx) (joaillier/runiste).

## Rôle

Les **modificateurs profonds** qui créent les synergies : effets uniques (capacités nommées),
bonus de set, gemmes de **condition** (comportements de combat), runes d'équipe (Temps/Règles/Pactes).

## Effets uniques ([`uniques.ts`](../../src/game/uniques.ts))

Catalogue `UNIQUE_EFFECTS` (~150 entrées), 5 **rôles** (`UNIQUE_ROLES` : dps/heal/tank/resist/utility).
Chaque effet : `mods` (stats de base) + parfois `resistMods` + parfois `tagMods` + texte `active`.

### Scaling — `instanceMods(inst, item)`

`mods × rankScale × itemScale` :
- **Rang** : `rankScale = 1 + (rank−1)·RANK_GROWTH(0.35)`. `UNIQUE_MAX_RANK = 10`, la partie
  **active se débloque au rang `UNIQUE_ACTIVE_RANK = 5`** (`isUniqueActive`).
- **Objet porteur** : `itemScale = (ilvl/100) × (statMult/statMult_épique) × UNIQUE_POWER(0.5)`. →
  un unique sur une pièce Transcendante de haut ilvl **pèse autant qu'une grosse ligne d'affixe**.
- `resistMods` (en %) et `tagMods` ne montent **qu'avec le rang** (pas l'objet).

### Actifs câblés — archetypes (`UniqueActiveKind`)

La partie `active` n'est **plus** un simple texte de saveur : chaque unique reçoit un **archetype**
mécanique, **déduit** de son texte d'accroche + son rôle (`deriveActiveKind`, couverture **totale**),
débloqué au **rang actif** (5) et monté au rang (`activeMagAt`, `ACTIVE_RANK_GROWTH`). ~15 archetypes
bornés (anti-snowball : cap, CD interne, ou 1×/combat) :

| Catégorie | Archetypes |
|---|---|
| Offensif | `doubleFrappe`, `execution` (vs ennemi <25% PV), `berserk` (soi <50% PV), `rampe` (montée), `penResist` |
| Défensif | `epines`, `bouclierCoup`, `bouclierDepart`, `degatsBouclier`, `ralentir`, `sursis` (1×/combat) |
| Soin | `soinHot` (soi), `soinGroupe` |
| Utilitaire | `cdrKill` (au kill), `butin` (+palier de rareté au drop) |

- **Knobs** : `ACTIVE_MAG` (magnitude de base par archetype) dans [`uniques.ts`](../../src/game/uniques.ts).
- **Agrégation** : `aggregateUniqueActives(characters)` → meilleure magnitude par archetype au niveau
  **équipe** (comme les gemmes). Passée via `CombatMods.uniqueActives` et déclenchée par le moteur
  ([`combatEngine.ts`](../../src/game/combatEngine.ts)) aux hooks existants (ouverture, multiplicateur
  offensif, chaîne défensive, sursis, régén) dans les **deux** pas (mono + multi). `cdrKill` via
  `uniqueKillEvents` (farm/donjon/raid). État transitoire **non persisté**.
- **Affichage chiffré** : `describeActiveEffect(id, rank)` → consommé par le Codex et la fiche d'objet
  via [`uniqueDescribe.ts`](../../src/game/uniqueDescribe.ts).

### Uniques taggés (gating v0.39.1)

`tagMods` = signatures de **conversion** (`[feu]`, `[zone]`, `[finisseur]`, `[dot]`, `[soin]`,
`[ultime]`…) qui amplifient les sorts portant ce tag. Jugés trop forts pour le farm :

| `TAGGED_DROP_RATE` | Valeur | |
|---|---|---|
| `farm` | **0** | Ne tombent jamais en farm. |
| `dungeon` | **0.05** | Traîne infime. |
| `raid` | **0.30** | Source principale. |

`PLAIN_UNIQUES` (sans tag) tombent partout. Au craft (infusion/coffre garanti), seul le pool
**simple** est tiré (`randomUniqueInstance`) sauf `allowTagged`. Au **choix** : Éclat cosmique (raid).

### Drop & économie

- `rollUnique(rarityTier, source)` : Épique+ (tier 5), chance `min(1, (tier−4)·0.14)` → **garanti**
  au sommet (Céleste ~98 %, Éternel+ 100 %).
- **Codex / Grimoire** : `undiscoveredUnique(codex)` (Coffre du Collectionneur), collection X/total.
- **Essences** : `essenceGain` (recyclage d'un unique) → `upgradeCost(rank)` (monter le rang) ou
  `insertCost` (poser un effet sur un objet). Une essence par effet.

## Sets ([`sets.ts`](../../src/game/sets.ts))

Pièces nommées (`SETS`, `setId` sur l'objet), bonus à paliers **2/4/6 pièces** (`SetBonusTier`)
agrégés par `setBonuses` au niveau **moteur** (`damageMult`, `hpMult`, `cdr`, `resistAll`, `leech`).
Bonus **volontairement énormes** = chasse d'endgame. Actuellement **un set** : `neant` (Régalia du
Néant, drop de l'Abîme Primordial), 6 pièces, capstone +50 % dégâts / +25 % résist / 10 % vol de vie.

## Sockets / gemmes ([`gems.ts`](../../src/game/gems.ts))

- **Châsses roulées** (`rollSockets(tier)`, table `SOCKET_ODDS`) : 0 le plus souvent (rare !),
  monte avec la rareté (Transcendant ~20 % d'≥1, 3 châsses ~5 % = jackpot). `itemSockets` gère le
  grandfather du vieux stuff (`legacySockets`) + bonus d'arme (nœud Joaillier).
- Les gemmes **élémentaires** ont été supprimées (broyées en poussière 💠) : `gems.ts` ne garde que
  la mécanique des châsses + helpers de migration.

## Gemmes de condition ([`condGems.ts`](../../src/game/condGems.ts)) — LE système de gemmes

Plus aucune stat plate : chaque gemme déclenche un **comportement de combat**. 4 familles (`GemFamily`) :

| Famille | Icône | Thème |
|---|---|---|
| **Rythme** | 🥁 | Compteurs (attaques, sorts, kills) — le tempo. |
| **Flux** | 🌊 | Ressources (PV, soins, recharges, boucliers). |
| **Environnement** | 🌍 | L'état du monde (télégraphes, Surcharge, donjons, raids, champions). |
| **Bastion** | 🛡️ | Défense (anti-burst, épines, redirections). Biome Physique. |

Chaque gemme : **un** paramètre chiffré, amélioré par la **recoupe** (rang 1→maxRank) et la
**qualité** (Éclatée/Polie/Parfaite). Effets agrégés au niveau **équipe** (meilleure instance portée).
Drops ×0.4 (le drop est un événement) → la **poussière de gemme** est la monnaie ; le **Joaillier**
taille/fusionne/corrompt (voir [08](08-metiers-et-craft.md)). État transitoire (compteurs) **non persisté**.

## Runes ([`enchants.ts`](../../src/game/enchants.ts))

Une rune par pièce, remplaçable (graver consomme l'exemplaire). Effets **d'équipe** :

- **⏳ Temps** (`TimeRuneId`, 16) : manipulent les horloges du combat (début, recharges, télégraphes, DoT).
- **⚖️ Règles** (`RuleId`, 17) : tordent le jeu (loot, clés, drops, économie) tant que portées.
- **🩸 Pactes** (`PactId`, 14) : keystones façon PoE — **gros bonus contre gros malus**. **Un seul**
  actif par équipe (deux via « Double pacte », malus ×1.5). Ne droppent **jamais** : forgés à
  l'Atelier runique (Fragments runiques 🜁 + Poussière + or + Éclat cosmique pour les pactes).

Spécialisations étagées (◈ I→V, exclusives) : Chronomancien / Législateur / Pactiste.

## Interactions

- `instanceMods` est consommé par `computeTotalStats` ([02](02-stats-et-maitrises.md)) ;
  `instanceResist` par `computeResistProfile` ([01](01-combat-et-degats.md)) ; `instanceTagMods` par
  l'amplification de sorts ([06](06-classes-talents-pouvoirs.md)).
- Production des gemmes/runes (taille, fusion, forge) → [08 Métiers & craft](08-metiers-et-craft.md).
- Sets de raid → [07 Donjons & raids](07-donjons-et-raids.md).

## Dette / provisoire

- **Un seul set** existe (`neant`) : le système supporte davantage, c'est du contenu à ajouter.
- Les actifs sont **mappés par mots-clés** (`deriveActiveKind`) : un texte ambigu peut tomber sur le
  repli de rôle. Ajouter un champ `activeEffect` explicite sur l'entrée si un cas précis doit forcer
  son archetype. Magnitudes (`ACTIVE_MAG`) **conservatrices** par défaut — à recalibrer aux sims si on
  veut rendre les actifs plus marquants.
- `butin` n'est câblé que sur le **drop de farm** (pas l'hors-ligne ni le butin de donjon/raid).
