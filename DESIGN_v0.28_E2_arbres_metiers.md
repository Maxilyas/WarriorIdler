# DESIGN v0.28 — Sous-design E2 : arbres de métier en vrais arbres à nœuds

> Sous-chantier de [DESIGN_v0.28.md](DESIGN_v0.28.md) (Lot E, refonte ergonomie des ateliers).
> Retour joueur : *« l'arbre des compétences, on devrait avoir un arbre avec des nodes, au moins on a
> un certain nombre de choix et pas trop de choix comme ici »* + *« interface pas intuitive, trop dense »*.
> **But : transformer les listes plates de nœuds en vrais arbres visuels, avec moins de choix mais
> plus signifiants, et masquer ce qui n'est pas accessible.** Aucune perte de fonctionnalité.

## 1. Constat (existant)

- `METIER_NODES: Record<MetierId, MetierNode[]>` (`metiers.ts:241`) = **liste plate** par métier,
  groupée à l'écran par `branch` (`METIER_BRANCHES`). Rendu = colonnes de boutons, **dense**.
- 4 métiers (forgeron, joaillier, runiste, alchimiste), 3–4 branches chacun, **~60 rangs dépensables**
  par métier. `MetierNode` : `maxRank`, `minLevel`, `minStage?`, `requires?`, `requiresRank?`,
  `exclusive?`, `branch?`.
- 1 point/niveau (max 50), respec par branche (`respecBranchCost`).
- **Problèmes** : (a) trop de petits nœuds « +X% » à rangs multiples (filler) noient les vrais choix ;
  (b) pas de lecture spatiale (qu'est-ce qui mène à quoi) ; (c) tout est affiché même non débloqué ;
  (d) pas de « keystones » identitaires forts.

## 2. Objectif

1. **Arbre visuel** par métier (nœuds positionnés + liens), rendu à la manière de
   [TalentTree.tsx](src/components/TalentTree.tsx) (déjà un arbre fonctionnel à réutiliser).
2. **Moins de nœuds, plus de poids** : fusionner le filler, transformer 2–3 nœuds par branche en
   **keystones exclusifs** (vrais arbitrages).
3. **Révélation progressive** : une branche/un nœud verrouillé (niveau de métier / `minStage` / parent
   non pris) est **grisé-discret ou masqué**, pas un mur d'options.
4. **Zéro perte** : toutes les fonctions actuelles restent atteignables ; migration des rangs déjà appris.

## 3. Modèle de données (extension, rétro-compatible)

On garde `MetierNode` + `state.nodes:{id→rank}`. On ajoute le **layout** et on durcit les prérequis :

```ts
interface MetierNode {
  // … champs existants …
  /** Position dans la grille de l'arbre (colonne, rangée). Rétro-compat : absent = auto-layout par branche. */
  pos?: { col: number; row: number }
  /** Prérequis multiples (en plus de `requires`). Permet les confluences (2 parents → 1 nœud). */
  requiresAll?: { id: string; rank?: number }[]
  /** Keystone : nœud à 1 rang, effet fort, souvent `exclusive`. Marqueur visuel (hexagone, halo). */
  keystone?: boolean
}
```

- `pos` défini **par branche** (chaque branche = une colonne/sous-arbre vertical). Le rendu calcule
  les liens à partir de `requires`/`requiresAll`.
- Les **branches deviennent les grandes voies verticales** de l'arbre (le tronc commun = nœuds
  d'entrée en haut). On garde `METIER_BRANCHES` pour les titres de colonnes + le respec par branche.

## 4. Méthode de réduction (appliquée à chaque branche)

Pour chaque branche, viser **4 à 6 nœuds** au lieu de 8–12 :
- **Fusionner les filler** : plusieurs petits « +X%/rang » de même thème → un seul nœud à rangs
  (ex. les 3 nœuds d'XP/coût d'un métier → 1 nœud « Efficience » multi-rang).
- **1 entrée** (déblocage de la fonction de base de la branche, rang 1, `minLevel` bas).
- **2–3 nœuds de progression** (rangs, gating par le précédent).
- **1 keystone** en bout de branche : effet identitaire fort, **exclusif** quand pertinent (choix).
- Conserver les `minStage` (synchronise le craft avec le contenu).

## 5. Exemple travaillé — Forgeron

Branches existantes : Compagnonnages 🛠️ · Prodige ✨ · Procédés ⚙️ · Industrialisation 🤖.
Proposition d'arbre (tronc en haut, 4 colonnes) :

```
                 [Tronc] Apprenti forgeron (entrée, rang 1)
        ┌───────────────┬───────────────┬───────────────┐
   🛠️ Compagnonnages   ✨ Prodige     ⚙️ Procédés     🤖 Industrie
   Corps majeur (excl.) Prodige(rangs)  Surillvl         Industrialisation
   Corps mineur (excl.) Inspiration     ├ Affûtage sup.  Chaîne de montage(r)
   ▢ KEYSTONE :         Sérendipité     ├ Transmutateur  ▢ KEYSTONE :
     « Maître d'armes »                 Polissage(+fin)    « Manufacture »
     (bonus de forge fort)             ▢ KEYSTONE :        (auto haut débit,
                                        « Grand-maître »   gaté minStage)
                                        (ascension/forge)
```
- **Compagnonnages** : garder les 4 corps majeurs (exclusifs) + seconds corps (déjà exclusifs) →
  c'est DÉJÀ un bon choix structurant ; ajouter un keystone terminal « Maître d'armes ».
- **Prodige** : Prodige (rangs) → Inspiration / Sérendipité (2 confluents). Pas de keystone (branche
  « chance », volontairement secondaire).
- **Procédés** : regrouper Verrous/Négociant/Lingotier/Trempe/Moules en **2 nœuds multi-rang**
  thématiques (« Atelier » = surillvl/affûtage/transmute ; « Finition » = polissage/trempe/moules) ;
  keystone « Grand-maître forgeron » (ascension).
- **Industrie** : Industrialisation → Chaîne de montage (rangs) → keystone « Manufacture » (gaté `minStage`).

Cible forgeron : **~5–6 nœuds par colonne**, dont 2 keystones exclusifs marquants.

## 6. Squelettes des 3 autres métiers (même méthode au lot)

- **Joaillier 💎** — Taille & Qualité ✂️ · Châsses & Sertissage 💎 · Maîtrises de famille ◈ · Négoce ⚖️.
  Keystones : famille au choix (déjà `exclusive: joaillier-spec`) ; Perçage (châsse manuelle).
  Fusionner le filler économat/geste précis/inspiration en 1 nœud « Lapidaire économe » (rangs).
- **Runiste 🜁** — Chronomancie ⏳ · Législation ⚖️ · Pactes 🩸.
  Keystones : un Pacte majeur exclusif par voie. Regrouper les petits bonus de durée/règle.
- **Alchimiste ⚗️** — Officine 🧪 · Grand Œuvre ⚗️ · Matière 🌿.
  Keystone : spécialisation de cuve (potions vs huiles vs mutagènes). Fusionner les bonus de
  rendement/durée en « Pharmacopée » (rangs, déjà existant partiellement).

> Le détail nœud-par-nœud des 3 se fait à l'implémentation, en suivant §4 (4–6 nœuds/branche, 1 keystone).

## 7. Rendu (réutiliser TalentTree)

- Conteneur scrollable, fond constellation, nœuds hexagonaux (keystones plus gros + halo),
  liens SVG entre `requires`/`requiresAll`.
- **États visuels** : appris (plein) · apprenable (bordure vive + pastille « +1 ») · verrouillé (grisé,
  tooltip « niveau métier N / palier N / requiert X ») · **caché** si la branche entière est hors d'atteinte
  (révélation progressive).
- Réutiliser le panneau latéral de détail (nom, effet par rang, prérequis, coût) au clic.
- En-tête : niveau de métier, points dispo, **respec par branche** (déjà là).

## 8. Migration

- Les rangs déjà appris (`state.nodes[id]`) sont **conservés** : on ne change que le LAYOUT et on
  **fusionne** certains ids. Pour chaque fusion, additionner les rangs des ids fusionnés dans le nouvel
  id (table de correspondance dans la migration du save, comme les migrations existantes).
- Garder les ids des keystones/exclusifs inchangés autant que possible (zéro remap).
- Si un total de rangs dépasse le nouveau `maxRank`, rembourser le surplus en points (re-dépensables).

## 9. Chantier (ordre)

1. Étendre `MetierNode` (`pos`, `requiresAll`, `keystone`) — rétro-compatible.
2. Définir le **layout + la réduction** d'un métier (Forgeron en pilote) dans `metiers.ts`.
3. Composant `MetierTree` (forké de `TalentTree`) + intégration dans le hub Atelier (E1 multi-pages).
4. Migration des ids fusionnés.
5. Décliner les 3 autres métiers.
6. Révélation progressive (masquage des branches hors d'atteinte).

## 10. Points ouverts
- Nombre exact de keystones par métier (proposé : 2).
- Faut-il **réduire le total de points** (rééquilibrer `METIER_MAX_LEVEL` / coûts) ou garder 50 ?
- Garder le respec par branche tel quel (oui par défaut).
