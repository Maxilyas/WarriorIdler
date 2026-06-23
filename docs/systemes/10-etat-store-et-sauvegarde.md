# 10 — État, store & sauvegarde

> Source : [`store.ts`](../../src/game/store.ts) (~500 lignes : assembleur — types, état initial,
> spread des 10 slices), [`*Slice.ts`](../../src/game/) (les ~120 actions par domaine : tick, monde,
> stuff, gems, officine, atelier, expéditions, héros, live-ops, market),
> [`save.ts`](../../src/game/save.ts) (sauvegarde & migration), [`combatEngine.ts`](../../src/game/combatEngine.ts)
> (moteur de combat), [`storeHelpers.ts`](../../src/game/storeHelpers.ts) (helpers purs + consts partagés) —
> tous extraits de `store.ts`,
> [`types.ts`](../../src/game/types.ts) (vocabulaire de domaine), [`character.ts`](../../src/game/character.ts)
> (modèle de perso dérivé). Pilotage du tick : [`App.tsx`](../../src/App.tsx). Voir aussi
> [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Rôle

Le **cœur runtime** : un store Zustand unique qui tient tout l'état mutable, expose les actions, fait
tourner la boucle de combat et gère la sauvegarde/migration `localStorage`. `types.ts` est le
vocabulaire partagé (aucune logique).

## Vocabulaire de domaine ([`types.ts`](../../src/game/types.ts))

Types clés (purs, sans logique) :
- **Stats** : `PrimaryStat`, `SecondaryStat`, `StatKey`, `StatBlock = Partial<Record<StatKey, number>>`.
- **Objets** : `Item`, `Affix` (`AffixKind` = `stat`/`dmgType`/`resist`), `Rarity`/`RarityId` (16),
  `EquipSlotId` (16), `ItemType` (14), `ItemOrientation`, `Equipment = Partial<Record<EquipSlotId, Item>>`.
- **Uniques/gemmes** : `UniqueEffect`, `UniqueInstance`, `GemInstance`.
- **Dégâts** : `DamageType` (7).
- **Capacités** : `PowerDef`, `PowerEffect`, `PowerKind`, `PassiveConversion`, `BuildPreset`.
- **Personnage** : `Character`. **Ennemis** : `Enemy`, `EnemyAbility`, `EnemyAbilityKind`.

## Modèle de personnage (`Character`)

**Persistant** : `id` (UUID stable, jamais réutilisé), `name`, `level`, `xp`, `base` (StatBlock),
`equipment`, decks (`powers` ×5, `passives` ×3, `support` ×3, `powerAuto`), `unlockedPowers`,
`talents` + `pantheon` (id de nœud → rang), `primaryBias`, `title`, `avatar`, `buildPresets`, `hp`.

**Transitoire (NON persisté, réinitialisé par rencontre)** : `rez`, `stun`, `dots`, `weaken`,
`absorb`, `invuln`, `healCut`, `charge`, `frenzy`, et tous les compteurs d'archétype (`combo`,
`heat`, `overload`, `form`/`formClock`/`instinct`/`chimera`…). Tout ce qui est dérivable (PV max,
DPS, profil) est recalculé par [`character.ts`](06-classes-talents-pouvoirs.md), jamais stocké.

> **Multi-perso** : l'inventaire et les ressources sont **communs** ; l'équipement et les talents
> sont **par personnage**. `activeChar` = perso sélectionné. Le budget de talents est partagé au
> niveau de compte (voir [06](06-classes-talents-pouvoirs.md)).

## Le store ([`store.ts`](../../src/game/store.ts))

Store Zustand unique (`useGame`), 4 grands rôles :

1. **État** (`GameState`) : personnages + progression (`stage`/`bestStage`/biomes) + ressources
   (or, éclats/`essence`, noyau, poussière, fragments, cosmic, sceaux, orbes, gemmes, lingots…) +
   sous-systèmes (métiers, alchimie, donjon/raid en cours, maîtrises, hauts faits, daily, event, inbox).
2. **Actions** : tout ce qui mute l'état (équiper, crafter, lancer un donjon/raid, acheter, prestige…).
   Chaque action calcule le prochain état via des fonctions **pures** de `game/`, `set(next)` puis
   `persist(next)`. Les ~120 actions sont **découpées en 10 slices par domaine** (`*Slice.ts` :
   tick, monde, stuff, gems, officine, atelier, expéditions, héros, live-ops, market) — chacune
   `createXSlice(set, get) → Pick<GameState, …>` que `create()` spread dans son `return` ; les slices
   n'importent du store que des **types** (`import type` → pas de cycle runtime).
3. **Boucle de combat** : `tick(dt)` à 5 Hz (`TICK_MS = 200` dans App.tsx) — voir [01 Combat](01-combat-et-degats.md).
   Sous-fonctions : `tickHeroStatuses`, `tickEnemyAbilities`, gestion menace/mort/repli/butin.
4. **Sauvegarde** (voir ci-dessous).

## Sauvegarde & migration

- **Clé** : `SAVE_KEY = 'warrior-idler-save-v030c'` ; sérialisation JSON dans `localStorage`.
- **`persist(s)`** (dans [`save.ts`](../../src/game/save.ts)) : projette le `GameState` sur une forme `SaveData` (liste **explicite**
  des champs persistés — les champs transitoires en sont **exclus**), horodate `lastSeen`.
- **`load()`** : lit la clé, `JSON.parse`, puis `migrateOldSave(p)`.
- **Migrations** : une série de fonctions rattrapent les vieilles saves —
  `migrateItem`/`migrateItemGems`/`migrateItemRune` (objets), `migrateLegacyForge` (arbres de
  métiers, versionnés par `metiersV`), reroutage des stats dépréciées, etc. **Toute refonte d'un
  sous-système persisté doit prévoir sa migration.**
- **Hors-ligne** : à la reprise, `simulateOffline` (voir [03](03-progression-et-monde.md)) calcule les
  gains depuis `lastSeen` et les dépose dans l'inbox.

## Conventions d'évolution

- **Ajouter un champ d'état** = l'ajouter à `GameState`, à l'init, **et** à `persist`/`SaveData` (sinon
  il n'est pas sauvegardé) — sauf s'il est volontairement transitoire.
- **Ne jamais** mettre de logique de jeu dans les composants : passer par une action du store qui
  appelle les fonctions pures de `game/`.
- Les fonctions pures de `game/` sont réutilisées **telles quelles** par les scripts de sim
  (`scripts/*.mjs`) → ne pas y introduire de dépendance au store ou à React.

## Interactions

- Toutes les docs système décrivent un sous-état tenu ici. `store.ts` est leur point d'orchestration.
- Le flux data → store → composants est détaillé dans [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Dette / provisoire

- Le découpage du god-file (7.5k lignes) est **terminé** : `store.ts` ≈ 500 lignes (assembleur), le
  reste réparti en `save.ts` / `combatEngine.ts` / `storeHelpers.ts` / 10 `*Slice.ts`. Toute extraction
  future doit préserver l'invariant « logique pure dans `game/`, orchestration dans les slices ».
- Le **socle de tests** [`test/`](../../test/) (Vitest) couvre save (round-trip/migration), helpers purs
  et invariants moteur ; à étoffer au fil des évolutions (`npm test`).
- La clé de save porte encore `v030c` : la **version de schéma** (clé) et la **version de jeu**
  (commits) sont découplées — voir la proposition d'`APP_VERSION` dans le [README](../../README.md).
