# DESIGN v0.28 — Retours joueurs (prod)

> **Contexte.** Lot issu d'une vague de retours de joueurs qui étaient sur la **prod v0.26**.
> Le **v0.27** (avatar, prestige, Abîme endgame, inventaire lisible, UI combat) a été **déployé
> le 2026-06-14** (push de 16 commits → GitHub Pages). Plusieurs retours sont donc déjà couverts
> par ce déploiement ; ce document ne couvre que ce qui est **réellement neuf**.
>
> **Périmètre arbitré avec le joueur :**
> - ✅ Quick wins inventaire · ✅ Économie & cohérence ilvl · ✅ Gros chantiers UX
>   (portraits, équipe visible en combat, hauts faits, refonte ergonomie des ateliers, animations).
> - ❌ Hors périmètre pour l'instant : **contenu endgame** (l'Abîme v0.27 suffit pour le moment),
>   **compositions d'équipe** (abandonné).
>
> **Décisions verrouillées :** portraits = **SVG procéduraux personnalisables** · hauts faits =
> **petites récompenses (monnaies sous-utilisées) + titres** · ilvl = **échelle numérique unifiée** ·
> éco = **ajouter des usages dédiés** (pas de convertisseurs, pas de fusion de monnaies) ·
> ateliers = **moins dense, multi-pages, masquer le non-débloqué, arbres à nœuds, aides au choix**.

---

## Lot A — Quick wins inventaire (faible risque, fort confort)

### A1 · Filtre par set
- **État** : 🔴 absent. Filtres existants (affinité, stat, dégâts/résist typés) dans `StuffScreen.tsx`.
  Les objets portent déjà `setId` ; registre dans `src/game/sets.ts`.
- **Quoi** : un groupe de filtres « Set » : `Tous · Pièces de set · <sets présents en inventaire>`.
- **Où** : `StuffScreen.tsx` — nouvel état `setFilter: string | 'any' | null`, intégré au `useMemo` `filtered`
  (ligne ~94) ; UI dans le bloc « Filtrer par stat ».
- **Approche** : lister les `setId` distincts présents dans l'inventaire (+ nom depuis `sets.ts`).
  `'any'` = `i.setId != null` ; un id précis = `i.setId === id`.

### A2 · Favoris / verrou (anti-suppression)
- **État** : 🔴 absent. `Item` n'a aucun champ de protection (`types.ts:195`).
- **Quoi** : verrouiller une pièce → exclue de TOUTE vente/recyclage (manuel, masse, auto, multi-sélection).
- **Où** :
  - `types.ts` : `locked?: boolean` sur `Item` (champ optionnel → pas de migration).
  - `store.ts` : action `toggleLock(id)` ; **garde** dans `sell`, `recycle`, `sellAllBelow`,
    `recycleAllBelow`, et l'auto-recyclage au drop (sauter les `locked`).
  - `ItemRow.tsx` : icône 🔒 (cliquable) ; `ComparePanel.tsx` : bouton « Verrouiller / Déverrouiller ».
- **Détail** : un verrouillé garde une bordure/teinte distincte ; les actions de masse affichent
  « N protégé(s) ignoré(s) ».

### A3 · Multi-sélection vendre / recycler
- **État** : 🔴 absent (seulement la vente « sous seuil de rareté »).
- **Quoi** : sélectionner plusieurs objets puis Vendre / Recycler / Verrouiller en lot.
- **Où** : `StuffScreen.tsx` (+ `ItemRow.tsx` pour la case/halo de sélection multiple) ;
  `store.ts` : `sellMany(ids)`, `recycleMany(ids)`.
- **Approche** :
  - **Desktop** : `Ctrl/Cmd+clic` = (dé)sélection ; `Maj+clic` = sélection d'une plage sur la liste
    visible. État `bulkSel: Set<string>`.
  - **Mobile** : bouton « ✓ Sélection » qui passe en mode cases à cocher (pas de Ctrl au tactile).
  - **Barre d'action** flottante quand `bulkSel` non vide : `Vendre (N) · Recycler (N) · 🔒 (N) · ✕`.
  - Les **verrouillés** (A2) sont ignorés par les actions de lot (compte affiché).
  - Surbrillance de sélection-multiple **distincte** de la sélection-comparaison.

### A4 · Infobulles = description des stats
- **État** : 🟡 les descriptions existent (`ALL_STAT_META[k].desc` dans `stats.ts`) mais ne sont
  visibles que dans le Codex.
- **Quoi** : afficher `desc` en `title` partout où une stat apparaît, pour ne plus avoir à ouvrir le Codex.
- **Où** : `CharacterPanel.tsx` (vue Stats), lignes d'affixe de `ComparePanel.tsx`, boutons de filtre de
  `StuffScreen.tsx` (remplacer `title={m.name}` → `title={m.desc}`), types de dégâts (`DAMAGE_TYPES`).
- **Approche** : petit composant réutilisable `<StatTag stat={k}/>` (nom + couleur + `title=desc`),
  ou simple ajout de `title` au survol. Idéalement aussi un `desc` court pour les **types de dégâts**.

### A5 · Récap puissance + résistances sur la page Combat
- **État** : 🟡 `CombatPanel` montre le DPS d'équipe + la résist **ennemie**, pas le récap **du héros**.
- **Quoi** : encart compact « ta puissance » : DPS, PV / PV effectifs (EHP), et **résistances du héros**
  (avec mise en avant du pire type face au contenu courant, comme dans `HerosHub`).
- **Où** : `CombatPanel.tsx`, près de l'en-tête perso/équipe. Réutilise `charDps`, `charMaxHp`,
  `charResist` (déjà utilisés ailleurs) + `resistMult` pour le pire écart.

### A6 · Bouton « fusionner toutes les gemmes »
- **État** : 🟡 `fuseGems(key)` existe **par type** (`AtelierPanel.tsx:918`).
- **Quoi** : un seul bouton qui fusionne tous les lots éligibles d'un coup.
- **Où** : `store.ts` : action `fuseAllGems()` qui boucle sur toutes les clés où
  `n >= GEM_FUSE_COUNT && rank < gemMaxRank` (logique déjà en place ligne 896) ; bouton dans la
  page Joaillier. Journalise un récap « X fusions effectuées ».

### A7 · Marqueur de set sur l'équipement porté
- **État** : 🟡 `ItemRow` montre ⬢ ; le **paper-doll** (pièces équipées) n'a aucun marqueur de set.
- **Quoi** : sur chaque emplacement équipé, marqueur ⬢ + couleur du set ; et un récap
  « Sets actifs : Nom 2/4 » en tête du paper-doll.
- **Où** : `StuffScreen.tsx` (boutons d'emplacement, lignes ~262-289 + en-tête). Compter les pièces
  portées par `setId` ; afficher le palier atteint via `sets.ts`.

### A8 · Surbrillance de l'objet sélectionné
- **État** : 🟡 surbrillance trop discrète (`bg-white/10` ; slot `border-white/40`).
- **Quoi** : sélection nettement visible (anneau coloré + fond + barre d'accent).
- **Où** : `ItemRow.tsx` (état `selected`) et `StuffScreen.tsx` (slot actif). Ex. `ring-2 ring-orange-400`,
  fond renforcé, accent latéral. À distinguer de la sélection-multiple (A3).

---

## Lot B — Économie & cohérence ilvl

### B1 · ilvl unifié (échelle numérique)
- **État** : 🟡 sources presque alignées mais référence d'affichage faussée.
  - Ancre : `stageIlvl(stage) = round(stage × 1.5)` (`enemies.ts:174`).
  - Expédition : `generateItem({ ilvl: stageIlvl(palier_courant) })` (`store.ts:4025`).
  - Marché : `stageIlvl(bestStage)` (`store.ts:2076`). Forge : `stageIlvl(bestStage) + corps.ilvlBonus`
    (`store.ts:5188`).
  - **Bug de ressenti** : `maxContentIlvl = round(stageIlvl(bestStage) × 1.25)` (`store.ts:2057`) sert de
    référence au code couleur `ilvlLagColor` → le meilleur stuff farmé tombe à ratio **0.80 = jaune
    « léger retard »**. Et farmer sous son record loote plus bas que ce que forge/marché annoncent.
- **Objectif** : un joueur doit voir **le même nombre** pour « ce que je peux obtenir » à la forge, au
  marché et en expédition à son meilleur palier, et le code couleur doit dire « à jour » pour ce stuff-là.
- **Quoi** :
  1. Introduire `accountIlvl(bestStage, raidProgress)` = `max(stageIlvl(bestStage), raidIlvl…)` **sans le
     ×1.25**. C'est la référence unique « ton contenu actuel ».
  2. Recaler `ilvlLagColor` sur `accountIlvl` (gris = à jour quand on est au niveau du meilleur palier).
  3. **Afficher la référence** dans la Forge et le Marché : « Forge à **i{X}** — = ton meilleur palier ;
     l'expédition au palier {bestStage} donne aussi i{X} ».
  4. En expédition sous le record : afficher « i{stageIlvl(palier)} à ce palier » + indice « pousse plus
     haut pour i{accountIlvl} ».
  5. Garder le `+ilvlBonus` de la forge comme **avantage de métier explicite** (« +N au-dessus de ton
     farm »), borné pour rester lisible.
- **Knob** : valeur du `+ilvlBonus` forge ; seuils de `ilvlLagColor` (proposé : ≥0.92 à jour, ≥0.78 léger
  retard, sinon gros retard, calés sur la nouvelle référence).

### B2 · Donner de l'intérêt aux monnaies sous-utilisées
- **État** : 🟡 le joueur consomme surtout **Éclats d'arcane** (`essence` ♦) et **Orbes de raid**
  (`orbes` 🔮) ; les autres dorment : Noyaux 💠, Poussière d'étoile 🌌, Poussière de gemme 🔹,
  Quintessences ⚗️, Fragments d'éternité ✨, Éclats cosmiques 💫.
- **Décision** : **ajouter des usages dédiés** (pas de convertisseur, pas de fusion de monnaies).
- **Pistes de sinks** (à chiffrer après un audit gain/dépense par monnaie) :
  - 🌌 **Poussière d'étoile** → déblocage des **portraits/cosmétiques** (Lot C1) + une piste
    d'**améliorations de compte** (`upgrades.ts`).
  - 💠 **Noyaux primordiaux** → améliorations de compte récurrentes / paliers de prestige légers.
  - ⚗️ **Quintessences** → usage élargi (reroll d'une ligne typée existante, pas seulement +valeur).
  - ✨ **Fragments d'éternité** → plus d'usages runiques + déblocages.
  - 💫 **Éclats cosmiques** → rester rares (invocation d'unique au choix), ne pas inflater.
  - 🔹 **Poussière de gemme** → déjà correcte si on joue le Joaillier ; à surveiller.
  - **Hauts faits (Lot D)** en distribuent en récompense → boucle d'usage.
- **À faire d'abord** : un **audit gains/dépenses** (grep des crédits/débits par monnaie dans `store.ts`)
  pour dimensionner les sinks sans casser l'équilibre. ⚠️ pré-requis avant d'écrire les coûts.

---

## Lot C — Avatar & équipe

### C1 · Portraits SVG procéduraux personnalisables
- **État** : 🟡 `LevelBadge.tsx` rend déjà un **avatar de substitution** (glyphe de classe + anneau d'XP
  + écusson à paliers).
- **Quoi** : un vrai **portrait paramétrique** (formes/teintes par classe, emblème, accessoires/couleurs),
  personnalisable par héros. On **garde** l'anneau d'XP + l'écusson de niveau de `LevelBadge`.
- **Où** :
  - Nouveau `src/game/avatar.ts` : modèle de portrait paramétrique + rendu SVG (zéro asset).
  - `types.ts` : `avatar?: { palette: string; emblem: string; … }` sur `Character` (défaut dérivé de la
    classe à la migration).
  - `LevelBadge.tsx` : remplacer le glyphe par le portrait procédural.
  - `HerosHub.tsx` (vue Aperçu) : éditeur de personnalisation.
- **Lien éco** : certaines options de portrait coûtent de la **Poussière d'étoile** (B2).

### C2 · Équipe visible en combat
- **État** : 🟡 le combat **est déjà en équipe** (`partyCombatStep`, jusqu'à 3 héros) mais `CombatPanel`
  n'affiche que le **héros actif**.
- **Quoi** : une bande d'équipe montrant tous les héros vivants (portrait, barre de PV, recharges de
  sorts), **clic = héros actif**. Le « choix du héros » devient évident.
- **Où** : `CombatPanel.tsx`. Réutilise `charMaxHp`, `charDps`, `powerCooldowns`. Desktop : dans la
  colonne combat de gauche ; mobile : bande horizontale compacte.

---

## Lot D — Hauts faits

### D1 · Système de hauts faits
- **État** : 🔴 totalement absent (aucun fichier).
- **Quoi** : un registre de hauts faits à catégories, débloqués par condition, donnant **petites
  récompenses (monnaies sous-utilisées) + titres** affichables.
- **Où** :
  - `src/game/achievements.ts` : définitions `{ id, name, desc, category, check(state), reward, title? }`.
  - `store.ts` : `achievements: Record<string, true>` (persisté) ; vérification à la fin du tick / sur
    événements (kill boss, level up, équipement, palier). Crédite les récompenses une seule fois.
    `selectedTitle?: string` par compte (ou par héros).
  - UI : panneau « 🏆 Hauts faits » (sous-onglet du Codex ou du hub Héros) ; sélecteur de titre.
- **Catégories proposées** :
  - **Progression** : atteindre palier X, niveau X, prestige X.
  - **Stuff** : *full équipé* (16/16), *full équipé en rareté ≥ X* (un haut fait par palier de rareté →
    couvre « full équipé de chaque niveau »), *full set complet*, *tout l'équipement à jour en ilvl*.
  - **Collection** : uniques découverts, gemmes/runes/recettes découvertes.
  - **Métiers** : niveau de métier X, premier chef-d'œuvre.
  - **Combat / Raids** : premier boss, raid T7, Abîme.
- **Récompenses** : surtout des **monnaies sous-utilisées** (B2) + titres. Garder modeste (pas de power
  creep — cf. décision « petites récompenses »).

---

## Lot E — Refonte ergonomie des ateliers (le gros morceau)

> Retour clé : *« l'interface n'est pas intuitive (trop dense), on choisit au pif »*. S'applique à **tous**
> les métiers (Forgeron, Joaillier, Runiste, Alchimiste). `AtelierPanel.tsx` = 1377 lignes.
> Toutes les aides demandées sont retenues : **recommandations contextuelles + avant/après + recettes
> 1-clic + révélation progressive**.

### E1 · Multi-pages par métier + révélation progressive
- **Quoi** : chaque métier devient un **hub à pages claires** (ex. Forgeron : *Améliorer · Créer · Arbre ·
  Contrats*), au lieu d'un mur d'options. **Masquer** tout ce qui n'est pas débloqué (par palier / niveau
  de métier) au lieu de l'afficher grisé.
- **Où** : découper `AtelierPanel.tsx` en sous-composants par métier + par page ; gating par
  `bestStage` / niveau de métier (déjà calculé dans `App.tsx` via `pointsAvailable`/`unlockStage`).

### E2 · Arbres de métier → vrais arbres à nœuds
- **Quoi** : remplacer les listes plates d'améliorations (`metiers.ts`, `MetierNode` avec `requires`/
  `branch`) par des **arbres à nœuds** offrant **un nombre limité de choix** (à la manière de
  l'arbre de talents), pour donner de la lisibilité et de la décision.
- **Où** : modèle de données dans `metiers.ts` ; rendu inspiré de `TalentTree.tsx` (déjà un arbre
  visuel fonctionnel à réutiliser).
- ⚠️ **Sous-chantier conséquent** : mérite sa **propre passe de design** (carte des nœuds par métier,
  contraintes de choix) avant code. À détailler séparément.

### E3 · Aides au choix
- **Recommandations contextuelles** : surligner l'action qui apporte le plus (ex. +DPS/+survie estimé),
  une « étincelle » sur le meilleur choix.
- **Avant/après** : chaque action montre le **résultat estimé** avant validation (réutiliser
  `ComparePanel`/`equipDelta` pour les pièces).
- **Recettes / presets 1-clic** : flux guidés (« Optimiser cette pièce » enchaîne surillvl/reforge/
  polissage dans le budget dispo).

### E4 · Animations d'ateliers
- **Quoi** : micro-animations (étincelles de forge, bouillonnement du chaudron, lueur runique) au
  déclenchement et en idle.
- **Où** : CSS/SVG léger (cohérent avec le reste, **zéro asset**). Sur les pages métier concernées.

---

## Ordre d'implémentation proposé

1. **Lot A** (quick wins) — livrable rapide, gros confort, peu de risque. Idéalement 1 commit / item.
2. **Lot B1** (ilvl unifié) — petit mais très visible ; **B2** après l'audit éco.
3. **Lot D** (hauts faits) — autonome, crée la boucle d'usage des monnaies (lien B2).
4. **Lot C** (portraits + équipe visible) — UX, autonome.
5. **Lot E** (refonte ateliers) — le plus gros ; **E2 (arbres) à designer à part** avant code.

## Points encore ouverts (à trancher au fil de l'eau)
- B2 : montants exacts des sinks (après audit gains/dépenses).
- D1 : titres par **compte** ou par **héros** ; emplacement du panneau (Codex vs Héros).
- E2 : cartographie des arbres de métier (sous-design dédié).
- A3 : confirmer l'affordance mobile (mode « Sélection » à cases).
