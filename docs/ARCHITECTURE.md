# Architecture — Warrior Idler

> Vue d'ensemble technique. Pour le détail d'un système, voir [`systemes/`](systemes/).
> Pour la vision/pilier, voir [`DESIGN.md`](DESIGN.md). Pour le vocabulaire, voir
> [`GLOSSAIRE.md`](GLOSSAIRE.md).

## Stack

- **React 18** + **TypeScript** + **Vite 6** — SPA, build `tsc -b && vite build`.
- **Tailwind CSS v4** (`@tailwindcss/vite`) — styles utilitaires inline.
- **Zustand 4** — un **store unique** (`src/game/store.ts`) tient tout l'état du jeu.
- **vite-plugin-pwa** — installable, jouable hors-ligne, service worker auto-update.
- **Sauvegarde** : `localStorage` (clé `warrior-idler-save-v030c`), sérialisation JSON, migrations à la lecture.
- **Pas de backend** : tout est client. Les fenêtres temporelles (daily, event, maîtrises) sont
  calées sur l'**epoch UTC** → déterministes sans serveur.

## Couches (du plus pur au plus impur)

```
types.ts                 vocabulaire de domaine (aucune logique)
   ↓
game/*.ts (data+pur)     tables de données + fonctions PURES (sans état, sans React)
   ↓                     ex. rarities, slots, damage, stats, combat, items, talents, raids…
store.ts (Zustand)       ÉTAT mutable + actions + boucle de combat + save/load/migration
   ↓
components/*.tsx         rendu + dispatch d'actions (s'abonnent via useGame(selector))
   ↓
App.tsx                  coquille : onglets, pilotage du tick & timers, porte d'onboarding
```

**Règle d'or** : la logique de jeu vit dans les modules **purs** de `game/` (testables,
réutilisés tels quels par les scripts de sim). `store.ts` orchestre l'état et appelle ces
fonctions ; les composants ne contiennent **pas** de règles de jeu, seulement de l'affichage
et des appels d'actions.

### Flux de données

1. Les composants lisent l'état via `useGame((s) => …)` (sélecteurs Zustand).
2. Une interaction appelle une **action** du store (`useGame.getState().xxx()` ou via hook).
3. L'action calcule le prochain état en appelant des fonctions pures de `game/`, fait
   `set(next)`, puis `persist(next)` (écriture localStorage).
4. Zustand notifie les abonnés → re-render ciblé.

## La boucle de jeu (tick)

Pilotée dans [`App.tsx`](../src/App.tsx) :

- **Tick de combat** : `setInterval(() => tick(TICK_MS / 1000), TICK_MS)` avec
  **`TICK_MS = 200`** → **5 ticks/seconde**. `dt` (≈0,2 s) est passé à `tick`.
  - **Suspendu** quand l'onglet passe en arrière-plan (visibilitychange) ET tant que l'écran
    d'accueil n'est pas franchi (`onboarded`).
- **Timers périodiques séparés** (hors du tick de combat, pour ne pas le polluer) :
  - rotation des biomes : vérifiée toutes les **5 s** (`rotateBiomeIfDue`, change la zone ~toutes les **1 h** réelle, `BIOME_ROTATE_MS`).
  - hauts faits : `checkAchievements()` toutes les **4 s** + un passage au montage.
  - quotidien + event : `rollDailyIfNeeded()` / `rollEventIfNeeded()` toutes les **60 s** + au montage.
- **Cycle de vie mobile** : passage en arrière-plan → suspend le tick + horodate (`lastSeen`) ;
  retour → calcule les **gains hors-ligne** (voir [`offline.ts`](../src/game/offline.ts)).
- **Wake Lock** : l'écran est maintenu allumé tant que l'onglet est visible.

`tick(dt)` (dans `store.ts`) résout un pas de combat : auto-attaques selon la Hâte, capacités
auto-lancées, altérations (DoT/HoT, voir `tickHeroStatuses`), capacités ennemies télégraphiées
(`tickEnemyAbilities`), application des dégâts, mort/repli, butin, XP/or.

## État & sauvegarde

- L'état complet vit dans le store (`GameState`). La forme **persistée** est `SaveData`
  (voir `persist()` dans `store.ts`, ~ligne 2126) : personnages, ressources, progression
  (stage/bestStage/biomes), métiers, donjons/raids, maîtrises, hauts faits, live-ops, etc.
- **Transitoire, NON persisté** : cooldowns des capacités, compteurs de gemmes de condition,
  états d'archétypes, runes de temps/pactes — recalculés/réinitialisés à chaque rencontre.
- **Chargement** : `load()` lit la clé, et `migrateOldSave()` + une série de migrations ciblées
  (`migrateItem`, `migrateItemGems`, `migrateItemRune`, `migrateLegacyForge`…) rattrapent les
  vieilles saves. `metiersV` versionne les arbres de métiers.

## Carte des modules

### `src/game/` — logique de jeu (data + pur)

| Module | Rôle | Doc système |
|---|---|---|
| `types.ts` | Vocabulaire de domaine : `Item`, `Affix`, `Character`, `DamageType`, `EquipSlotId`, `PowerDef`… | [10](systemes/10-etat-store-et-sauvegarde.md) |
| `store.ts` | **Store Zustand** : état + actions + orchestration (tick/donjon/raid) (~4,5k lignes) | [10](systemes/10-etat-store-et-sauvegarde.md) |
| `save.ts` | **Sauvegarde & migration** : `SaveData`, `freshSave`, `sanitize`, `loadSave`, `persist` (extrait de `store.ts`) | [10](systemes/10-etat-store-et-sauvegarde.md) |
| `combatEngine.ts` | **Moteur de combat** : état transitoire + `partyCombatStep`/`partyCombatStepMulti` (extrait de `store.ts`) | [01](systemes/01-combat-et-degats.md) |
| `stats.ts` | Méta des stats, totaux, dérivées, soft-caps, stats rares | [02](systemes/02-stats-et-maitrises.md) |
| `maitrise.ts` | Conseil des Maîtrises : progression de compte time-gatée (contrats hebdo) | [02](systemes/02-stats-et-maitrises.md) |
| `combat.ts` | Coups, mitigation (armure), DPS théorique, dégâts subis, résist sur sorts | [01](systemes/01-combat-et-degats.md) |
| `damage.ts` | 7 types de dégâts, profil de dégâts, triangle d'élément, soft cap de type | [01](systemes/01-combat-et-degats.md) |
| `resist.ts` | Résistances relatives (en points, non plafonnées) — annulent la punition typée | [01](systemes/01-combat-et-degats.md) |
| `enemies.ts` | Génération d'ennemis, escalier des vagues, techniques signature de biome | [01](systemes/01-combat-et-degats.md) / [03](systemes/03-progression-et-monde.md) |
| `progression.ts` | **Source de vérité chiffrée** : loi de puissance, ilvl, Paliers, Chapitres, budget objet | [03](systemes/03-progression-et-monde.md) |
| `biomes.ts` | 7 biomes (= 7 types de dégâts), progression par biome, rotation | [03](systemes/03-progression-et-monde.md) |
| `biomeBonus.ts` | 4 mécaniques anti-mono-biome | [03](systemes/03-progression-et-monde.md) |
| `offline.ts` | Gains hors-ligne (cap 12 h, taux 0,5) | [03](systemes/03-progression-et-monde.md) |
| `prestige.ts` | Éveil Primordial : reset dur → Échos + Constellation (méta-arbre) | [03](systemes/03-progression-et-monde.md) |
| `items.ts` | Génération d'objets, budget, score, vente/recyclage, fenêtres de rareté | [04](systemes/04-stuff-et-loot.md) |
| `rarities.ts` | 16 paliers de rareté + tirage pondéré | [04](systemes/04-stuff-et-loot.md) |
| `slots.ts` | 16 emplacements + types d'objets (mapping, icônes) | [04](systemes/04-stuff-et-loot.md) |
| `uniques.ts` | Catalogue des effets uniques (tous rôles), scaling rang × rareté × ilvl | [05](systemes/05-uniques-sets-gemmes.md) |
| `sets.ts` | Sets d'équipement (bonus 2/4/6 pièces) | [05](systemes/05-uniques-sets-gemmes.md) |
| `gems.ts` | Châsses (sockets) + stock de gemmes | [05](systemes/05-uniques-sets-gemmes.md) |
| `condGems.ts` | **Gemmes de condition** : comportements de combat (rythme, seuil, riposte, serment) | [05](systemes/05-uniques-sets-gemmes.md) |
| `enchants.ts` | Runes (Temps, Règles) + Pactes — effets d'équipe | [05](systemes/05-uniques-sets-gemmes.md) |
| `classData.ts` | Socle des classes (arbres handcrafted), type `KeystoneEffect` | [06](systemes/06-classes-talents-pouvoirs.md) |
| `talents.ts` | **Arbre de talents** (façon PoE) : nœuds, gating, keystones, capstones | [06](systemes/06-classes-talents-pouvoirs.md) |
| `powers.ts` | Registre des capacités équipables (débloquées via l'arbre) | [06](systemes/06-classes-talents-pouvoirs.md) |
| `character.ts` | Modèle de personnage, stats totales/dérivées, capacités allouées | [06](systemes/06-classes-talents-pouvoirs.md) / [10](systemes/10-etat-store-et-sauvegarde.md) |
| `dungeons.ts` | Donjons (séries de combats, modificateurs, butin ciblé) | [07](systemes/07-donjons-et-raids.md) |
| `raids.ts` | Raids gardiens (mécaniques signature, butin par catégorie, gating) | [07](systemes/07-donjons-et-raids.md) |
| `metiers.ts` | 4 métiers (Forgeron/Joaillier/Runiste/Alchimiste), Forge hexagonale | [08](systemes/08-metiers-et-craft.md) |
| `alchimie.ts` | Officine : réactifs, découverte, brassage en cuves (temps réel), consommables | [08](systemes/08-metiers-et-craft.md) |
| `automates.ts` | Automates de forge : refont en boucle un donjon/raid battu (hors-ligne) | [08](systemes/08-metiers-et-craft.md) |
| `upgrades.ts` | Améliorations permanentes (puits d'or du Marché) | [08](systemes/08-metiers-et-craft.md) |
| `achievements.ts` | Hauts faits : titres + petits bonus permanents | [09](systemes/09-meta-et-live-ops.md) |
| `daily.ts` | Quotidien : 3 contrats du jour + connexion | [09](systemes/09-meta-et-live-ops.md) |
| `event.ts` | Event hebdo : Invasion élémentaire → aura exclusive | [09](systemes/09-meta-et-live-ops.md) |
| `inbox.ts` | Boîte de réception ✉ : gains à collecter (cadeaux, hors-ligne, event) | [09](systemes/09-meta-et-live-ops.md) |
| `tutorial.ts` | Tutoriel « Premiers Pas » (chaîne de quêtes d'onboarding) | [09](systemes/09-meta-et-live-ops.md) |
| `avatar.ts` | Portraits procéduraux SVG (palette + emblème), rendus par `LevelBadge` | [09](systemes/09-meta-et-live-ops.md) |

### `src/components/` — interface

| Composant | Rôle |
|---|---|
| `CombatPanel.tsx` | Écran de combat : barres de vie, métriques, journal, capacités |
| `StuffScreen.tsx` | Paper-doll des 16 emplacements + inventaire filtré + comparaison |
| `ItemRow.tsx` / `ComparePanel.tsx` | Ligne d'inventaire compacte / comparaison côte à côte + actions |
| `CharacterPanel.tsx` | Fiche de perso : identité, ressources, effets des stats, spécialisation |
| `AtelierPanel.tsx` | Atelier : les 4 métiers, Forge hexagonale, alchimie, automates (~1,8k lignes) |
| `TalentTree.tsx` | Arbre de talents (constellations navigables) |
| `HerosHub.tsx` | Hub Héros (sous-onglets : talents, maîtrises, prestige…) |
| `ExpedHub.tsx` / `DungeonPanel.tsx` / `RaidPanel.tsx` | Hub Expéditions → donjons / raids |
| `MerchantPanel.tsx` | Marché : coffres, échoppe, comptoir, améliorations |
| `GrimoirePanel.tsx` | Codex des uniques (collection) |
| `PrestigePanel.tsx` | Éveil Primordial (constellation) |
| `AchievementsPanel.tsx` | Hauts faits |
| `LevelBadge.tsx` / `AvatarEditor.tsx` | Médaillon de perso (portrait SVG) / éditeur de portrait |
| `ChestModal.tsx` / `ChoiceModal.tsx` | Modale de coffre animé / modale de choix |
| `WelcomeScreen.tsx` | Écran d'accueil / onboarding |
| `rarityStyle.ts` / `ui.tsx` | Styles par rareté / primitives d'UI |

### `scripts/` — simulations & garde-fous (headless)

Outils Node qui **transpilent le TS du jeu en mémoire** (esbuild) et exécutent la **vraie
logique** — pas de copie de règles, donc pas de dérive. Voir [`scripts/README.md`](../scripts/README.md).
Exemples : `npm run validate` (anti-régression arbre), `npm run sim`/`ttk`/`survival`/`dungeon`
(équilibrage), `npm run eco` (économie), `npm run mur` (mur de progression).

## Conventions

- **Langue** : tout en français (code, commentaires, UI, docs).
- **Commentaires** : un docblock d'en-tête par module décrit le système **tel qu'il est** ;
  les tags de version (`v0.40.1 — …`) tracent le *pourquoi* d'un changement.
- **Knobs** : les constantes d'équilibrage sont nommées en MAJUSCULES (ex. `RAID_HP`,
  `STAIRCASE_FULL`, `TYPE_BONUS`) et regroupées en tête de leur module. C'est le point
  d'entrée pour ajuster l'équilibrage sans toucher à la logique.
- **Build vert** = garde-fou : `npm run build` (typecheck strict) après toute édition de source.
