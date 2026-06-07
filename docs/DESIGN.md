# Warrior Idler — Document de conception

> Vision long-terme et décisions de design. Référence vivante : à mettre à jour
> au fur et à mesure. L'état *réellement implémenté* est décrit dans le README.

## Pilier du jeu

Idler textuel WoW-like. Le **cœur = la gestion du stuff et des synergies** : trouver,
crafter et optimiser de l'équipement pour créer des builds. Tout le reste (combat,
donjons, raids, talents) existe pour donner du sens et de la profondeur au stuff.

## Décisions validées

- **Types de dégâts = colonne vertébrale** (7 types) : posés en premier, tout en dépend.
- **3 personnages** (débloqués à un palier) avec **stuff ET talents propres** à chacun.
- **Upgrade des effets uniques** = **Essence d'effet** obtenue en recyclant des uniques.
- **Ordre de construction** : Types → Craft/Uniques → Donjons → Party → Raids → Talents.

---

## 1. Types de dégâts (fondation)

7 types : **Physique, Feu, Froid, Foudre, Arcane, Ombre, Nature**.

- La puissance du personnage est **répartie** sur des types (défaut : 100% Physique).
- Le stuff/les talents **ajoutent** (« +X% dégâts de Feu ») ou **convertissent**
  (« convertit 30% des dégâts Physiques en Ombre »).
- Les ennemis ont des **résistances/vulnérabilités** par type (peuvent être négatives).
- Calcul : dégâts bruts → répartis par type → réduits par la résistance → sommés.
- Représentation technique : `Record<TypeDégât, number>` partout (extensible).

## 2. Effets uniques

- **Nombre par objet** : décroissance géométrique. `P(Nᵉ) = P(1ᵉʳ) × 0,12^(N-1)`.
  → plupart 1, certains 2, rares 3, 4+ quasi-introuvable. Uniquement sur Artefact+.
- **Rangs** I→X : montent les chiffres ET débloquent la **partie active** (proc/sort)
  à partir d'un certain rang.
- **Upgrade** : recycler un unique donne des **Essences de cet effet** (+ éclats) ;
  on les dépense pour monter le rang de ce même effet sur l'objet voulu.
- **Codex des uniques** : collection/déblocage pour la complétion (fantasme « des centaines »).
- Registre extensible : ajouter une capacité = ajouter une entrée de données.

## 3. Craft

**Créer un objet** (création ciblée, pas 100% aléatoire) :
- Choix slot + affinité (Force/Agi/Int) ; option (plus chère) pour biaiser vers des
  affixes voulus ou garantir une rareté mini. Consomme des éclats.
- Le **Noyau primordial** (ressource de boss) augmente la chance d'unique à la création.

**Améliorer un objet** (4 leviers complémentaires) :
1. **Reforge** : reroll des affixes, avec **verrou** d'un affixe (déterministe).
2. **Surillvl** : monter l'ilvl par paliers → garder un objet aimé pertinent.
3. **Ascension de rareté** : +1 cran de rareté (Noyau) → +1 slot d'affixe + chance d'unique.
4. **Sertissage** : sockets + gemmes (stats / types de dégâts modulaires).

## 4. Économie de ressources

| Ressource | Source | Usage |
|---|---|---|
| **Éclats d'arcane** | recyclage | craft de base, reforge |
| **Noyau primordial** | boss | chance d'unique, ascension de rareté |
| **Essence d'effet** (par effet) | recyclage d'uniques | monter le rang d'un effet |
| **Sceau de faille** | montée de palier | ouvrir les donjons |
| **Fragment d'éternité** | raids | craft de très haut niveau |

> Garder l'économie **tendue** : peu de ressources, rôles distincts.

## 5. Personnages, rôles, aggro (chantier #4 — design verrouillé)

- Jusqu'à **3 personnages**, débloqués **aux paliers** (2ᵉ ~50, 3ᵉ ~150).
- **Inventaire et ressources COMMUNS** ; **équipement par personnage**.
- **Aggro = menace légère** : menace/s = dégâts infligés + bonus de capacités ; l'ennemi
  frappe la **plus haute menace cumulée**.
- **Pas de rôle figé** : le rôle **émerge** des capacités équipées + du stuff.
- **5 capacités équipables par perso** (slots libres, mix actif/passif) :
  - **Passives** : menace, réduction de dégâts, bonus de stats.
  - **Actives** : auto-lancées sur cooldown en combat idle (heal, nuke, bouclier, buff).
  - Débloquées **par niveau** pour l'instant ; l'**arbre de talents** (chantier #6) deviendra
    la source (déblocage + rangs, comme les uniques). Registre data-driven : `powers.ts`.
- **Combat** : équipe complète vs ennemi ; 3 barres de vie ; sélecteur de perso pour équiper.
  Mort d'un perso → le combat continue avec les survivants ; équipe entière soignée entre
  combats ; toute l'équipe à terre → repli.
- **Refactor** : l'état mono-acteur (base, equipment, totalStats, hp, primaryBias) devient
  **par personnage** (`Character`). Implémenté **par étapes** pour ne pas casser le build.

## 6. Donjons / Raids / Ennemis

**Ennemis** : résistances/vulnérabilités par type de dégât → le stuff a un impact direct
sur *quel* ennemi on bat (profondeur recherchée).

**Donjons** : suite de N combats → **coffre** (stuff + ressources). Ouverts par un
**Sceau de faille**. Difficulté croissante, **modificateurs variés** (donjon « ardent » →
ennemis résistants au Feu / vulnérables au Givre). Réussir le niveau N débloque N+1.

**Raids** : suite de **boss** nécessitant une **équipe**. Chaque boss : résistances par
type + **capacité unique** résolue en **check** contre les capacités de l'équipe
(ex. « Nova d'Ombre : X dégâts d'Ombre au groupe → le heal doit suivre ou résistance
Ombre suffisante, sinon wipe »). Rend la diversité de dégâts/résistances et la compo
tank/heal/dps **obligatoires**. Récompense : **Fragments d'éternité**.

## 7. Arbre de talents

- **Gigantesque**, data-driven (JSON, pas du code).
- 3 familles : **Tank / Heal / DPS** + branches d'**affinité** : CaC / Distance /
  Type de dégât / Conversion de dégâts.
- UX en **constellations** (sections navigables) plutôt qu'une toile unique — clé sur mobile.
- Par personnage. Coût de respec à définir.

## 8. Idées additionnelles à intégrer

- **Bonus de sets** (2/4/6 pièces) — pilier des synergies.
- **Progression hors-ligne** — indispensable pour un idler.
- **Loadouts** : préréglages stuff+talents par contenu (donjon Feu vs raid Ombre).
- **Moteur de combat déterministe** à formaliser tôt (types + résistances + party + mécaniques).
- **Prestige** — couche long-terme.

## Implémenté en v0.11 (refonte « choix & synergies »)

- **Itémisation** : nombre d'affixes **fixe** par rareté (2→6) ; lignes unifiées
  `stat | dmgType | resist` (arbitrage offense ↔ survie sur un budget limité) ; **Vol de vie rare**.
- **Résistances de héros** (équipement/talents/uniques) ; chaque ennemi a un **type d'attaque**.
- **Mana** (INT) ; capacités à **coût de mana** + **scaling par stat** (FOR/AGI/INT).
- **Arbre de talents** réécrit en **constellations navigables** (un seul arbre connecté par
  passerelles, mix de rôles) ; **keystones** (conversion de stat/type, DoT, HoT, exécution,
  berserker) ; **les capacités viennent de l'arbre** (plus du niveau).
- **Donjons par type** (7, niveaux indépendants, butin ciblé) ; **verrou de palier** (farm).
- **Économie** retendue (recyclage/forge/coffres/recrue) + matériaux **Poussière d'étoile** /
  **Fragment d'éternité** ; **uniques dès Épique** + catalogue par rôle + **insertion via essences**.
- **Progression hors-ligne** (récap « Bon retour »).

> Décisions de design détaillées : `C:\Users\antoi\.claude\plans\ethereal-chasing-gem.md`.

## Roadmap (par dépendances)

1. **Types de dégâts** (fondation) — combat + résistances ennemies + affixes de type.
2. **Craft & Uniques** — création/amélioration, essence d'effet, codex.
3. **Donjons** — contenu solo, sceaux de faille, coffres, modificateurs.
4. **Party** — 2ᵉ/3ᵉ perso, rôles, aggro, moteur party.
5. **Raids** — boss à mécaniques/résistances, fragments d'éternité.
6. **Talents** — grand arbre (en parallèle / après).

Transverses à glisser quand pertinent : sets, hors-ligne, loadouts, prestige.
