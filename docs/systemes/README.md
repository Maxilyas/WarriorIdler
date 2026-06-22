# Documentation par système

Une page par grand système du jeu. Chaque page suit la même trame : **rôle**, fichiers source,
modèle de données, mécanique (formules réelles), **knobs** d'équilibrage, interactions, dette.

> Le **code fait foi** sur l'état du jeu ; ces pages en sont la synthèse. En cas de divergence,
> c'est le code qui a raison — et la page qu'il faut corriger.

| # | Système | Modules principaux |
|---|---|---|
| [01](01-combat-et-degats.md) | Combat & dégâts | `combat.ts`, `damage.ts`, `resist.ts`, `enemies.ts` |
| [02](02-stats-et-maitrises.md) | Stats & maîtrises | `stats.ts`, `maitrise.ts` |
| [03](03-progression-et-monde.md) | Progression & monde | `progression.ts`, `enemies.ts`, `biomes.ts`, `offline.ts`, `prestige.ts` |
| [04](04-stuff-et-loot.md) | Stuff & loot | `items.ts`, `rarities.ts`, `slots.ts` |
| [05](05-uniques-sets-gemmes.md) | Uniques, sets & gemmes | `uniques.ts`, `sets.ts`, `gems.ts`, `condGems.ts`, `enchants.ts` |
| [06](06-classes-talents-pouvoirs.md) | Classes, talents & pouvoirs | `talents.ts`, `classData.ts`, `powers.ts`, `character.ts` |
| [07](07-donjons-et-raids.md) | Donjons & raids | `dungeons.ts`, `raids.ts` |
| [08](08-metiers-et-craft.md) | Métiers & craft | `metiers.ts`, `alchimie.ts`, `automates.ts`, `upgrades.ts` |
| [09](09-meta-et-live-ops.md) | Méta & live-ops | `achievements.ts`, `daily.ts`, `event.ts`, `inbox.ts`, `tutorial.ts`, `avatar.ts` |
| [10](10-etat-store-et-sauvegarde.md) | État, store & sauvegarde | `store.ts`, `types.ts`, `character.ts` |

Voir aussi : [`../ARCHITECTURE.md`](../ARCHITECTURE.md) (vue d'ensemble), [`../GLOSSAIRE.md`](../GLOSSAIRE.md)
(lexique), [`../DESIGN.md`](../DESIGN.md) (vision/pilier).
