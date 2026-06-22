# Warrior Idler — Vision & piliers de design

> Document **vivant** : la philosophie de design et la direction actuelle. Pour *comment* chaque
> système est implémenté, voir [`systemes/`](systemes/). Pour l'historique des versions, voir
> [`archive/`](archive/) et `git log`.

## Pilier

**Idler textuel WoW-like.** Le **cœur = la gestion du stuff et des synergies** : trouver, crafter et
optimiser de l'équipement pour bâtir des builds. Tout le reste (combat, donjons, raids, talents,
métiers) existe pour donner du **sens et de la profondeur au stuff**.

Le jeu est jouable **en idle** (il tourne tout seul, y compris hors-ligne) ; la profondeur vient des
**décisions** entre les combats, pas de l'exécution en temps réel.

## Principes directeurs

Ces principes sont la grille de lecture des choix d'équilibrage. Quand un changement les contredit,
c'est généralement un signal.

1. **Les types de dégâts sont la colonne vertébrale.** 7 types, posés en premier ; résistances,
   affixes, biomes, sorts en dépendent. → [systemes/01](systemes/01-combat-et-degats.md)
2. **Le choix prime sur l'accumulation.** Chaque système est une **suite de décisions** (offense ↔
   survie, quel élément, quel archétype), pas un empilement linéaire. Les soft-caps existent pour que
   « continuer d'empiler » reste utile mais jamais dominant.
3. **TTK invariant = anti-snowball.** Joueur et ennemis partagent **une seule loi de puissance**
   (`b^ilvl`) → le temps de kill est constant à stuff calé, un sur-stuff ne donne qu'un gain **borné**.
   On ne « one-shot » jamais le contenu en farmant. → [systemes/03](systemes/03-progression-et-monde.md)
4. **L'endgame est horizontal.** Le gear de base **plafonne** (ilvl 200) ; passé un cap, l'écart se
   comble par l'**optimisation** (secondaires, gemmes, runes, pactes, alchimie, talents), pas par plus
   d'ilvl. La chasse aux très hautes raretés est un **over-content** coûteux, pas du farm.
5. **Le multi-classe est la dynamique reine.** Plusieurs personnages, équipement par perso mais
   **budget de talents partagé** : développer une 2ᵉ classe est un vrai arbitrage. Les raids (durs en
   solo) récompensent une compo tank/heal/dps **émergente** (pas de rôle imposé).
6. **L'économie reste tendue.** Peu de ressources, rôles distincts (voir le [glossaire](GLOSSAIRE.md)).
   L'or et l'XP sont **farm-only** ; les matériaux rares sont arrimés au contenu qui les produit
   (Fragments ↔ raids, etc.). La puissance de compte est **time-gatée** (Conseil des Maîtrises), pas
   achetable.
7. **La progression de compte est modeste et cosmétique quand elle ne l'est pas.** Hauts faits,
   event, prestige donnent surtout des **titres/parures zéro puissance** ; les rares bonus de
   puissance sont minimes et lents — pour préserver l'invariance TTK.

## État des grands chantiers

L'état **réel** vit dans le code et dans [`systemes/`](systemes/). Repères de direction actuels :

- **Classes** : 6 classes de base faites (arbres handcrafted, synergies par sim) ; le **Panthéon**
  (Chaman/Paladin/Démoniste/DK) est partiellement câblé.
- **Passifs** (refonte v0.42) : cluster d'utilitaires slottables + capstones d'identité gatés derrière
  les ultimes ; valeurs **provisoires**.
- **Forgeron** (refonte v0.41) : Forge hexagonale (allocation par adjacence) + Foyer idle + mini-jeu
  de Frappe — livraison en lots, à confirmer ce qui est câblé.
- **Avatar « voir son stuff »** : exploré puis **entièrement retiré** (les portraits cosmétiques, eux,
  restent — voir [systemes/09](systemes/09-meta-et-live-ops.md)).

## Comment on équilibre

Le jeu est calibré par des **simulations headless** qui exécutent la vraie logique (pas de copie de
règles) : `npm run ttk` / `sim` / `survival` / `dungeon` / `mur` / `eco` / `weights`. Les **knobs**
(constantes nommées en MAJUSCULES, documentées par système) sont le point d'entrée pour ajuster
**sans** toucher à la logique. Relancer les sims pertinentes après tout changement de scaling, et
`npm run validate` après toute édition de l'arbre de talents. → [`../scripts/README.md`](../scripts/README.md)

## Décisions verrouillées (rappels)

- 3 personnages max, débloqués aux paliers ; inventaire/ressources communs, équipement/talents propres.
- Les capacités se débloquent **uniquement** via l'arbre de talents (plus par niveau).
- Aggro = **menace légère** : l'ennemi frappe la plus haute menace cumulée → un vrai rôle de tank émerge.
- Registres **data-driven** partout (uniques, powers, talents, sets, gemmes, runes, donjons, raids) :
  ajouter du contenu = ajouter une entrée de données.
