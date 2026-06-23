# 08 — Métiers & craft

> Source : [`metiers.ts`](../../src/game/metiers.ts) (4 métiers + Forge hexagonale),
> [`alchimie.ts`](../../src/game/alchimie.ts), [`automates.ts`](../../src/game/automates.ts),
> [`upgrades.ts`](../../src/game/upgrades.ts) (Marché + `computeGlobalMods`).
> UI : [`AtelierPanel.tsx`](../../src/components/AtelierPanel.tsx) (~1.8k lignes),
> [`MerchantPanel.tsx`](../../src/components/MerchantPanel.tsx). Harnais : `npm run forge-hex`, `eco`.

## Rôle

Les **systèmes de craft** profonds. 4 métiers à XP/arbres + le Marché (puits d'or + bonus de compte).
La logique de **coûts** d'objets (reforge/surilvl/ascension/création) vit dans [`items.ts`](04-stuff-et-loot.md).

## Les 4 métiers ([`metiers.ts`](../../src/game/metiers.ts))

Quatre verbes (`METIERS`), chacun avec sa **vague de déblocage** (`unlockStage`) :

| Métier | Verbe | Rôle | Unlock |
|---|---|---|---|
| 🔨 **Forgeron** | Façonner la matière | création/reforge/surilvl/transmutation/ascension + automates | vague 6 |
| 💎 **Joaillier** | Programmer le combat | gemmes de condition (sertir/broyer/tailler/recouper/fusionner) | vague 25 |
| 🪄 **Runiste** | Tordre temps & règles | runes (Temps/Règles/Pactes), le métier le plus cher | vague 35 |
| ⚗️ **Alchimiste** | Distiller l'essence | quintessences + consommables | (officine) |

**Progression** : le **niveau** (1→25) monte par la **pratique** (chaque action donne de l'XP).
1 niveau = 1 point d'arbre (`METIER_NODES`). **Double verrou** : la vague (`bestStage`) ouvre le
métier/les nœuds de contenu, l'arbre ouvre les **fonctions**. Arbres groupés en **branches**
(`METIER_BRANCHES`), respec **par branche** (`respecBranchCost` = 40 % du respec complet).

### Forge hexagonale (v0.41, pilote Forgeron)

Refonte de l'arbre du Forgeron en **planche hexagonale** : chaque tuile (`MetierNode.hex {q,r}`)
porte une **famille** de synergie (`ForgeFamily` : qualite/ressource/idle/chance — les « Chaînes »)
et une **nature** (`ForgeKind` : stat/function/keystone/junction). **Allocation par ADJACENCE** (le
build = le placement). Composants : le **Foyer** (production idle d'XP + Lingots 🧱, indexée sur les
Chefs-d'œuvre), le mini-jeu de **Frappe** (génère la Chaleur 🔥 + des Parfaits), les **Signatures**
(affixe payé en Lingots, `signatureLingotCost`), le **Chef-d'œuvre** hebdo (`MASTERWORK_LINGOTS = 10`),
la **fonte** d'objets (`smeltLingots`, tier ≥ 4).

> ⚠️ Les `branch`/`requires` **historiques** sont conservés pour l'ancienne UI ; les tuiles neuves
> ont une branche de Voie absente de `METIER_BRANCHES.forgeron` → invisibles tant que la planche hex
> n'est pas livrée. Vérifier l'état de livraison avant de toucher au Forgeron.

## Alchimie ([`alchimie.ts`](../../src/game/alchimie.ts))

Officine = métier des **consommables et du temps réel** : récolter des **réactifs** de biome (drop
léger en farm) → **découvrir** des recettes par expérimentation (combiner 2 réactifs) → **brasser**
en **cuves** (maturation en temps réel) → élixirs/huiles/antidotes/mutagènes temporaires
(`elixirActive`/`oilActive`/… dans le store). Aussi : **Quintessence** → lignes de dégât/résist sur
objet (`quintCost`/`enhanceTypedAffixes` côté items.ts).

## Automates ([`automates.ts`](../../src/game/automates.ts))

Sommet du Forgeron (branche Industrialisation) : une machine craftée (**très chère, 3 max**) qui
**refait en boucle** un donjon/raid **déjà battu**, en parallèle de l'équipe et **hors-ligne**
(`tickAutomates`, `automateUpgradeCost`).

## Marché ([`upgrades.ts`](../../src/game/upgrades.ts))

Améliorations **permanentes** de compte (`UPGRADES`, data-driven, coûts croissants or + Éclats) :

- **Vidé de sa puissance** (v0.25) : Puissance/Vivacité/Vitalité/Régén supprimées (`REMOVED_UPGRADES`,
  remboursées à la migration). La progression de **puissance** de compte passe au [Conseil des
  Maîtrises](02-stats-et-maitrises.md) (time-gaté, minime).
- **Restantes** : Cupidité (or), Pilleur (loot), Chance (rareté), Récupérateur (éclats), Érudition
  (XP), Sagesse innée (points de talent), et le seul puits de combat : **Forge stellaire** (+4 %
  puissance/niveau, gaté Poussière d'étoile 🌌, infini).
- Le Marché vend aussi : **coffres mystères** (`rollBoxRarity`), échoppe (stock tournant), comptoir
  d'échange (or → ressources).

### `computeGlobalMods` — l'agrégateur central

`computeGlobalMods(upgrades, maitrise, achv)` → `GlobalMods` (power, attackSpeed, vitality, goldGain,
xpGain, eclatGain, lootChance, rarityLuck, talentBonus). **Source unique** où se cumulent
améliorations + **Conseil des Maîtrises** + **hauts faits** (mêmes clés/coefficients). C'est ici
qu'il faut brancher tout nouveau bonus de compte.

## Interactions

- Coûts d'objet (reforge/ascension/création) → [04 Stuff & loot](04-stuff-et-loot.md).
- Production gemmes/runes → [05 Uniques, sets & gemmes](05-uniques-sets-gemmes.md).
- Automates rejouent donjons/raids → [07 Donjons & raids](07-donjons-et-raids.md).
- `computeGlobalMods` consommé par le hors-ligne et le combat → [02](02-stats-et-maitrises.md), [03](03-progression-et-monde.md).

## Dette / provisoire

- **Forge hexagonale** = chantier v0.41 (doc verrouillée, livraison en lots) : confirmer ce qui est
  réellement câblé vs métadonnée (`hex`/`family` posés mais planche non livrée).
- `metiersV` (store) versionne les arbres : toute refonte d'arbre doit prévoir une migration.
