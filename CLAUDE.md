# CLAUDE.md — Warrior Idler

Idler textuel WoW-like (web + mobile, **PWA**), cœur = gestion du stuff et des synergies.
Stack : **React 18 + TypeScript + Vite 6 + Tailwind v4 + Zustand**, save `localStorage`, aucun
backend. **Tout est en français** : code, commentaires, UI et docs.

## Lire la doc avant de coder

La doc est **dans le repo** et fait autorité avec le code :

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — vue d'ensemble, flux de données, boucle de jeu,
  sauvegarde, **carte des modules** (un rôle par fichier).
- [`docs/systemes/`](docs/systemes/) — **une page par système** (combat, stats, progression, stuff,
  uniques/gemmes, classes/talents, donjons/raids, métiers, live-ops, état/store). Chaque page liste
  le rôle, le modèle de données, les **formules réelles**, les **knobs** d'équilibrage et la dette.
- [`docs/GLOSSAIRE.md`](docs/GLOSSAIRE.md) — Palier, Chapitre, Mur, ilvl, ressources…
- [`docs/DESIGN.md`](docs/DESIGN.md) — vision / piliers de design.
- [`docs/archive/`](docs/archive/) — snapshots de versions historiques, **non maintenus**.

> **Le code fait foi.** En cas de divergence code ↔ doc, le code a raison — et c'est la doc qu'il
> faut corriger. Avant de citer un fichier/fonction/knob, vérifier qu'il existe dans le code courant.

## Architecture — la règle d'or

```
types.ts → game/*.ts (data + fonctions PURES) → store.ts (état + actions + tick) → components/*.tsx
```

- La **logique de jeu** vit dans les fonctions **pures** de `src/game/` (réutilisées telles quelles
  par les sims `scripts/*.mjs`). **Ne pas** y introduire de dépendance au store ou à React.
- `store.ts` orchestre l'**état**, les actions, la **boucle de combat** (`tick`, 5 Hz) et la
  **sauvegarde/migration** (`persist` → `SaveData`). Les champs transitoires ne sont **pas** persistés.
- Les **composants** rendent et dispatchent des actions — **aucune** règle de jeu dedans.
- **Knobs** d'équilibrage = constantes en MAJUSCULES, documentées par système. Ajuster l'équilibrage =
  toucher un knob, **pas** la logique.
- Ajouter du contenu (unique/power/talent/set/gemme/rune/donjon/raid) = ajouter une **entrée de
  données** dans le registre concerné.

## Garde-fous (à lancer)

- `npm run build` — typecheck (`tsc -b`) + bundle. **Doit rester vert.**
- `npm run validate` — intégrité de l'arbre de talents (après toute édition de `talents.ts`).
- Sims d'équilibrage après tout changement de scaling : `npm run ttk` / `sim` / `survival` / `mur` /
  `eco` / `weights`. Détails : [`scripts/README.md`](scripts/README.md).

## Conventions

- **Français** partout. Le **code fait foi** sur l'état du jeu.
- **Commit à chaque livraison** (sans attendre la demande), messages en français, sur `main`.
  **Ne pas `git push`** — le mainteneur pousse lui-même.
- Documentation : on **documente** l'existant ; ne pas changer le gameplay sous couvert de doc.
