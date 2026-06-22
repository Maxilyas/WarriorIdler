# 06 — Classes, talents & pouvoirs

> Source : [`talents.ts`](../../src/game/talents.ts) (l'arbre, ~1k lignes data-driven),
> [`classData.ts`](../../src/game/classData.ts) (types `KeystoneEffect`, `SpellSpec`),
> [`powers.ts`](../../src/game/powers.ts) (capacités), [`character.ts`](../../src/game/character.ts)
> (assemblage). UI : [`TalentTree.tsx`](../../src/components/TalentTree.tsx),
> [`HerosHub.tsx`](../../src/components/HerosHub.tsx). Garde-fou : `npm run validate`.

## Rôle

Le **moteur de build**. L'arbre de talents (façon Path of Exile, **dessiné à la main** classe par
classe) débloque les capacités, les keystones (qui changent les règles) et l'identité de classe.
Le **rôle émerge** des capacités équipées + du stuff (pas de tag imposé).

## Structure de l'arbre ([`talents.ts`](../../src/game/talents.ts))

```
RACINE (Éveil) → 4 CATÉGORIES (armure) → CLASSES → ARCHÉTYPES (webs de grappes)
```

- **Deux arbres** (`TalentTreeId`) : `base` (6 classes de départ, points de **niveau**) et
  `pantheon` (4 classes débloquées par l'Éveil Primordial, budget de **Points d'Éveil**).
- **Catégories** (`cat_plaque`/`mailles`/`cuir`/`tissu`) regroupent les classes par type d'armure.
- **6 classes de base** : Voleur (Assassin/Ombrelame), Mage (Pyro/Cryo/Arcaniste + Convergence),
  Chasseur (Meute/Faucon + Symbiose), Guerrier (Sentence/Rempart + Juggernaut/Furie), Prêtre
  (Lumière/Vide + Crépuscule), Druide (formes Métamorphe). Panthéon : Chaman, Paladin, Démoniste, DK.

### Modèle d'allocation (PoE-like)

Un `TalentNode` (`kind` : `minor`/`notable`/`keystone`/`ability`/`gateway`) :

| Champ | Règle |
|---|---|
| `requires` + `links` | **Réachabilité par ADJACENCE** (OR) : dispo si touche un nœud déjà pris. |
| `requiresAll` | **CONVERGENCE** : exige **tous** les nœuds listés (identité au carrefour). |
| `exclusive` | **CHOIX EXCLUSIF** : prendre A verrouille ses frères de groupe. |
| `minSpent` | **BUDGET** : N points investis **dans la constellation** avant d'allouer (gate les payoffs). |
| `requiresRank` | Un nœud précis doit être à ≥ ce rang (« monte d'abord ce mineur au max »). |
| `requiresPrestige` | Entrée d'une classe Panthéon : `prestigeRank` ≥ valeur (1 classe par Éveil). |

> ⚠️ **Invariants de gating** (piège connu) : `minSpent` ne compte que la **même** constellation ;
> une paire exclusive = −1 point disponible → revoir chaque capstone. `requiresAll` = prérequis
> **nommés**. `validate-talents.mjs` ne suit que `requires` → il ne détecte pas ces bugs de budget
> (utiliser un glouton `canAllocate`). Cf. mémoire `warrior-idler-talents-gating-invariants`.

## Keystones ([`classData.ts`](../../src/game/classData.ts))

`KeystoneEffect` = la grosse interface (~120 champs) résolue par `character.ts`/`combat.ts`/`damage.ts`.
Familles de mécaniques : conversions de stat/type (`statAsOther`, `convertDamage`, `splashType`),
DoT/HoT, exécution/low-hp, épines, multifrappe, et les **socles d'archétype** réutilisables :
venin/combo (Voleur), ignite/Hot Streak/Surcharge (Mage), familier (Chasseur), Rage→bouclier
(Guerrier), châtiment/Vide (Prêtre), **formes rotatives** (Druide `shifter`).

**Tags de comportement** (`BEHAVIOR_TAGS`, 12 : `zone`/`dot`/`direct`/`generateur`/`finisseur`/
`furtif`/`soin`/`ultime`/`invocation`/`controle`/`mono` + les 7 types de dégâts). Les keystones
`tagBonus` amplifient **tout** sort portant un tag → **cross-classe** (le multi-classe est natif).

## Capacités ([`powers.ts`](../../src/game/powers.ts))

`POWERS` (registre `PowerDef`). Débloquées **uniquement** via les nœuds `ability` de l'arbre.

- **Actives** (`kind: 'active'`) : auto-lancées au cooldown ; scalent sur une stat (`scaleStat(s)` :
  sort=INT, frappe=FOR, finesse=AGI). Effets : `nuke`/`cleave`/`dot`/`shield`/`heal`/`buff`. La
  **Récupération** réduit le cooldown.
- **Passives** (`kind: 'passive'`) : effet continu (menace `threatMult`, réduction, +stats).
- **Builders / Soutien** (v0.39) : générateurs de ressource auto-rangés en lane **Soutien**.

**Slots équipables** par perso : `POWER_SLOTS = 5` actifs · `SUPPORT_SLOTS = 3` soutien ·
`PASSIVE_SLOTS = 3` passifs (`charDeck`/`charActives`).

## Assemblage du personnage ([`character.ts`](../../src/game/character.ts))

`Character` = base + équipement + talents (base & pantheon) + decks de capacités. Pipeline :

1. `charTotalStats` = base + équipement (`computeTotalStats`) + statMods des talents alloués.
2. `charKeystones(char)` = keystones des nœuds alloués (base + pantheon).
3. `charDerived` = `computeDerived` + keystones + mods globaux (prestige, pactes, set).
4. `charDamageProfile` / `charResist` ; `charDps` / `spellDps` / `dpsBreakdown` (DPS affiché,
   **exact par construction** : mêmes fonctions que le combat réel). `charMaxHp` / `charEhp`.
5. `equipDelta(char, item, slot)` → deltas DPS/HP/EHP pour la comparaison d'objets.

### Budget de talents (v0.36, partagé)

- `talentPointsForLevel(level) = max(0, level − TALENT_START_LEVEL(10))` → l'arbre s'ouvre **au
  niveau 11**.
- **Pool partagé au niveau de compte** : `teamTalentPool(chars, bonus)` = points du plus haut niveau
  − total dépensé sur **tous** les arbres de tous les persos. → développer 2 arbres **splitte** le
  même budget : frein voulu au multi-perso (« la dynamique reine »).

## Interactions

- Profil de dégâts / conversions → [01 Combat & dégâts](01-combat-et-degats.md).
- Stats & maîtrises consommées → [02](02-stats-et-maitrises.md).
- Uniques taggés amplifiés par les sorts → [05](05-uniques-sets-gemmes.md).
- Panthéon débloqué par le prestige → [03 Progression & monde](03-progression-et-monde.md).
- État par perso (`char.talents`, `char.pantheon`, decks) persisté → [10](10-etat-store-et-sauvegarde.md).

## Dette / provisoire

- Valeurs de plusieurs passifs/capstones **provisoires** (refonte v0.42, à calibrer par sim).
- Le **Panthéon** (Chaman/Paladin/Démoniste/DK) est partiellement câblé : vérifier l'état réel de
  chaque archétype avant d'équilibrer.
- `npm run validate` ne détecte pas les bugs de **budget** (`minSpent`/exclusifs) — relancer aussi
  `npm run check-classes` et un glouton d'allocation après toute édition de l'arbre.
