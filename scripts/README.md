# Scripts de vérification (data-driven)

Outils Node qui transpilent le TypeScript du jeu en mémoire (via esbuild, dépendance de Vite)
et exécutent la vraie logique — pas de copie de règles, donc pas de dérive.

## `validate-talents.mjs` — `npm run validate`
Garde-fou anti-régression sur l'arbre de talents (`src/game/talents.ts`). Vérifie :
- références `requires` pointant vers un nœud inexistant,
- nœuds inaccessibles depuis le Cœur,
- IDs dupliqués,
- `unlockPower` pointant vers un sort inexistant (`src/game/powers.ts`).

À lancer après toute édition de l'arbre.

## `dps-check.mjs` — `npm run dps`
Calcule `charDps` (le DPS affiché) pour comparer des configs — utile pour vérifier qu'un
multiplicateur (keystone, profil…) est bien pris en compte dans l'estimation.
