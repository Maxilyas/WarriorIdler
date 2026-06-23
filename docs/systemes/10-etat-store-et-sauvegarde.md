# 10 — État, store & sauvegarde

> Source : [`store.ts`](../../src/game/store.ts) (~500 lignes : assembleur — types, état initial,
> spread des 10 slices), [`*Slice.ts`](../../src/game/) (les ~120 actions par domaine : tick, monde,
> stuff, gems, officine, atelier, expéditions, héros, live-ops, market),
> [`save.ts`](../../src/game/save.ts) (sauvegarde, migration, export/import), [`saveSlots.ts`](../../src/game/saveSlots.ts)
> (multi-emplacements IndexedDB + boot durable), [`combatEngine.ts`](../../src/game/combatEngine.ts)
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

- **Clé (filet)** : `SAVE_KEY = 'warrior-idler-save-v030c'` ; sérialisation JSON dans `localStorage`.
  Depuis le **Palier 2**, `localStorage` n'est plus le stockage durable mais un **filet synchrone** du
  slot ACTIF (voir « Multi-emplacements »).
- **`persist(s)`** (dans [`save.ts`](../../src/game/save.ts)) : projette le `GameState` sur une forme `SaveData` (liste **explicite**
  des champs persistés — les champs transitoires en sont **exclus**), horodate `lastSeen`. Synchrone :
  c'est le contrat des **actions joueur** (et du round-trip de test). Écrit le filet localStorage **et**
  notifie le sink durable (mirror IndexedDB).
- **`persistThrottled(s)`** : réservé au **chemin chaud** (boucle de combat 5 Hz — `tick`/`tickDungeon`/
  `tickRaid`). Mémorise le dernier instantané et n'écrit qu'**au plus une fois / `SAVE_THROTTLE_MS` (2 s)** :
  sans ça, jusqu'à 5 `JSON.stringify` de tout le save par seconde bloqueraient le thread UI. Aucune perte
  au-delà de la fenêtre — `flushSave` (mise en veille/fermeture, `pagehide`/`visibilitychange`) et
  `persist` (action joueur) écrivent le pending immédiatement, et la simulation hors-ligne recrédite
  l'écart via `lastSeen`. **Cap d'inventaire** `INV_BASE = 20000` (`storeHelpers.ts`) : borne de
  **sécurité/perf** (limite le re-render/scan d'inventaire). v0.42 — la save durable vivant désormais
  dans IndexedDB, la contrainte de quota `localStorage` est levée → cap relevé 5000 → 20000 (gardé borné,
  pas infini) ; le tri reste à l'auto-recyclage et aux outils de masse.
- **`loadSave()`** : lit la clé (avec **relais d'import** prioritaire, voir Export/Import), `JSON.parse`,
  `sanitize` (merge defaults + migrations + `onboarded`). `sanitizeRaw(raw)` factorise l'adoption d'une
  save d'origine quelconque (relais, slot IDB, filet).
- **Migrations** : une série de fonctions rattrapent les vieilles saves —
  `migrateItem`/`migrateItemGems`/`migrateItemRune` (objets), `migrateLegacyForge` (arbres de
  métiers, versionnés par `metiersV`), reroutage des stats dépréciées, etc. **Toute refonte d'un
  sous-système persisté doit prévoir sa migration.**
- **Hors-ligne** : à la reprise, `simulateOffline` (voir [03](03-progression-et-monde.md)) calcule les
  gains depuis `lastSeen` et les dépose dans l'inbox. **Crédité une seule fois par chargement de slot**,
  dans `hydrate(save)` (`store.ts`) — la fonction partagée appelée par le boot async.

## Export / Import par fichier (Palier 1, [`save.ts`](../../src/game/save.ts) + [`SaveTransfer.tsx`](../../src/components/SaveTransfer.tsx))

Sauvegarde transférable, sans backend, depuis ⚙ Réglages :

- **Export** : `exportSaveText(state)` enveloppe `buildSaveData` dans `{ app, schema, exportedAt,
  checksum, data }` (`SAVE_SCHEMA`, checksum FNV-1a léger). UI : téléchargement `.json` (Blob +
  `<a download>`), avec replis **Copier** (presse-papier) / **Partager** (Web Share) pour le mobile.
  Vise toujours le **slot actif** (`useGame.getState()`).
- **Import** : `parseImport(text)` est **défensif** (`JSON.parse` try/catch ; n'écrase **jamais** avant
  validation ; accepte l'enveloppe OU un `SaveData` brut ; **avertit** sur schéma plus récent =
  downgrade, ou checksum incohérent). `applyImport(data)` estampille `lastSeen = now` (neutralise un
  crédit hors-ligne fortuit) + `onboarded = true`, puis dépose le payload sous **`IMPORT_KEY`**.
- **Relais `IMPORT_KEY`** : l'import recharge la page ; or le `pagehide` du reload déclenche un flush qui
  n'écrit que `SAVE_KEY`/le slot actif → un payload sous `IMPORT_KEY` **survit** et est **promu** au boot
  (`loadSave`/`bootStorage`), avec **priorité** sur le filet et l'IDB, puis consommé. C'est la parade à la
  course write-async vs flush-synchrone.

## Multi-emplacements & boot asynchrone (Palier 2, [`saveSlots.ts`](../../src/game/saveSlots.ts) + [`SlotManager.tsx`](../../src/components/SlotManager.tsx))

> ⚠️ `saveSlots.ts` (emplacements de SAUVEGARDE) ≠ `slots.ts` (emplacements d'ÉQUIPEMENT).

- **Stockage durable = IndexedDB** (`warrior-idler-db`, store `slots` keyé par `id` :
  `{ id, name, createdAt, updatedAt, data: SaveData }`). Le **pointeur de slot actif** + le **drapeau
  anti-windfall** vivent dans `localStorage` (lecture synchrone). Repli **mono-slot localStorage** si
  IndexedDB indisponible (mode privé strict) — `storageMode()` renvoie `idb` ou `local`.
- **Migration idempotente** : au premier lancement IDB, la save `localStorage` existante est seedée en
  `slot-0` (via `loadSave`). Ensuite, plus de re-seed.
- **Boot ASYNCHRONE** : le store démarre en **placeholder** (`booted: false`) ; `bootGame()` (appelé par
  `main.tsx`) lit le stockage durable, applique l'anti-windfall, **hydrate** (`hydrate(save)` : crédit
  hors-ligne, automates, rolls), `setState({ booted: true })`, puis persiste. `App` montre un écran de
  chargement tant que `!booted` (le vrai jeu n'est monté qu'après → ses effets ne tournent jamais sur le
  placeholder).
- **Durabilité (anti-perte)** : `persist`/`persistThrottled` écrivent le **filet synchrone**
  `localStorage` (slot actif) **et** notifient un **sink** injecté (`registerDurableSink`) qui mirrore le
  slot actif dans IndexedDB (debounce ; immédiat sur `flushSave`). Au boot, **réconciliation** filet vs
  IDB : le `lastSeen` le plus récent gagne — le filet survit à un kill brutal pendant qu'une écriture IDB
  async est abandonnée. (Même leçon que le relais `IMPORT_KEY`.)
- **Gestion des slots** (UI Réglages) : lister (aperçu niveau/chapitre/or/prestige), créer, renommer,
  **dupliquer** (= backup local instantané — prend l'état EN COURS pour le slot actif), supprimer (jamais
  l'actif), **basculer**. La bascule (`switchToSlot`) persiste DURABLEMENT le slot courant (awaited, donc
  pas de course `pagehide`), arme le **drapeau anti-windfall**, purge le filet, puis **recharge** → le
  boot recharge le slot cible via le chemin éprouvé. **Anti-windfall** : à une bascule délibérée, le boot
  remet `lastSeen = now` → **aucun** crédit hors-ligne du temps « dormant » du slot cible.
- **Acyclique** : `saveSlots.ts → save.ts` (le sink est **injecté**, `save.ts` n'importe jamais
  `saveSlots.ts`). Aucun accès `indexedDB`/`window` au chargement des modules (sims Node saines).

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
- Le **socle de tests** [`test/`](../../test/) (Vitest, `npm test`) couvre save (round-trip/migration),
  helpers purs, invariants moteur **et chaque slice d'actions** ([`test/slices/`](../../test/slices/) :
  un fichier par slice, via le vrai store `useGame` réinitialisé entre tests). À étoffer au fil des évolutions.
- La clé de save porte encore `v030c` : la **version de schéma** (clé) et la **version de jeu**
  (commits) sont découplées — voir la proposition d'`APP_VERSION` dans le [README](../../README.md).
  L'export embarque en plus un `SAVE_SCHEMA` (entier) à **incrémenter** à tout changement de forme
  incompatible (un import de schéma supérieur déclenche l'avertissement de downgrade).
- **Palier 2 livré** (multi-slots IDB + boot async). Pistes restantes : `version` du store IndexedDB
  (actuellement `DB_VERSION = 1`) à bumper si le schéma du store change ; pas d'export/import multi-slots
  en un seul fichier (l'export ne vise que le slot actif — par choix).
