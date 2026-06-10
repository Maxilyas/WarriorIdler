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

## `build-sim.mjs` — `npm run sim`
Harnais d'ÉQUILIBRAGE : construit des builds FOR/AGI/INT avec stuff optimisé + keystones optimaux,
et sort un tableau DPS (auto + sorts + DoT) / EHP par rareté (épique/cosmique/transcendant) et niveau
(50/100), plus le ratio de déséquilibre meilleur/pire build. À relancer après tout changement de
scaling (maîtrise, keystones, items) pour vérifier qu'aucun build ne domine.

## `survival-sim.mjs` — `npm run survival`
Harnais de SURVIE : compare, par palier, le temps-pour-mourir (EHP tank / dégâts ennemis) au
temps-pour-tuer (PV ennemi / DPS). Sert à vérifier que les dégâts ennemis ne dépassent pas la
capacité de survie (PV ~linéaires) au fil des paliers. (Le build DPS de référence y est volontairement
modeste — utiliser `npm run sim` pour le vrai plafond de DPS.)

## `dungeon-sim.mjs` — `npm run dungeon`
Harnais de progression DONJON : pour des builds FOR/AGI/INT stuffés selon le niveau de perso
(10/25/50/75/100), affiche le niveau de donjon MAX franchissable (survivre + tuer le boss), sur
plusieurs traits (rapide / elite / colosse). Sert à garder une COURBE de progression (et pas un mur).

## `stat-weights.mjs` — `npm run weights`
Harnais des POIDS DE STATS : valeur marginale (ΔDPS%) d'UNE ligne d'affixe de chaque famille
(secondaires offensives vs « +% type »), par build × niveau × rareté, plus la courbe d'EMPILEMENT
des lignes de type (0→16 lignes). C'est lui qui a mesuré la domination des dégâts de type
(+28-51%/ligne, ×5-6 en stack) et calibré le correctif v0.22 (soft cap TYPE_BONUS dans damage.ts,
constantes DMG_LINE_* dans items.ts). Cibles : ~2-3× la meilleure secondaire à l'unité, stack ≤ ×2.

## `eco-sim.mjs` — `npm run eco`
Harnais ÉCONOMIQUE : rendement par run de donjon (or/éclats/noyau/poussière) vs coût d'un craft à la
progression correspondante (createCost/ascendCost/reforgeCost). Affiche le ratio « crafts par run »
— qui doit rester STABLE (~1-3) à tous les niveaux. Sert à mapper donjons ↔ atelier/forge/marché.
