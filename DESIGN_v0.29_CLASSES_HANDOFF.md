# REFONTE DES CLASSES — DOCUMENT DE REPRISE (handoff)

> **But** : reprendre la refonte dans une nouvelle session de code et **créer les classes restantes**
> sans rien réexpliquer. Ce doc est la **source de vérité** ; il SUPERSÈDE `DESIGN_v0.29_refonte_classes.md`
> (l'ancien plan « 39 specs générées », abandonné car trop linéaire).
>
> **État** : socles + **Voleur** (Assassin + Ombrelame) + **Mage** (Pyromancien + Cryomancien + Arcaniste)
> + **Chasseur** (Meneur de meute + Œil de faucon). **3 classes faites, 7 restantes.** Arbre = 135 nœuds.

---

## 1. VISION (ne pas la perdre)

- **Idler + try-hard.** Les sorts s'auto-lancent (`powerAuto`), mais on peut les passer en **MANUEL** pour
  optimiser (timer un finisseur à ressource pleine, détoner au max de stacks, ultime en fenêtre de burst).
  L'écart auto↔manuel = la skill expression. → l'**auto intelligent à seuil** existe (`autoSpenderReady`).
- **Multi-classe = LA dynamique fun.** Un perso met ses points dans plusieurs classes pour des **combos
  cross-classe forts**. C'est pour ça que les modificateurs portent sur des **TAGS** (pas un sort nommé) :
  « tes [dot] +12% » booste AUSSI les DoT d'une autre classe → **aucun point gâché**.
- **Arbres À CHOIX (façon PoE), pas des couloirs.** Beaucoup plus de nœuds que de points
  (**~200 pts à l'endgame, lvl ~180-200** ; `talentPointsForLevel = level − 10`). On en remplit ~⅓ → on
  **choisit** en permanence. **Early non durci** : bas tiers accessibles (les portes `minSpent` ne gatent
  que les payoffs profonds).
- **Profondeur = débloquer/combotter les SORTS**, pas empiler des stats. 1 sort de départ ; les sorts forts
  sont **gatés** (chaînes + `minSpent`) ; **choix exclusifs de SORTS** ; ultimes **tout au fond** (`minSpent 20`).
  Les nœuds intermédiaires sont des **modificateurs de sorts / combos**, pas des « +3 crit ».
- **5 sorts actifs + 3 passifs** équipables (deck). Sur mobile : pas de surcharge (auto-cast). La diversité
  vient des **passifs/triggers** + **mutations via tags**, pas de boutons en plus.
- **Survie par archétype**, cohérente au profil (jamais au niveau d'un vrai tank) — chaque arbre a son lot
  de nœuds de soin/résist/esquive pour tenir en solo tôt.

---

## 2. ARCHITECTURE DE L'ARBRE

```
co_start (Éveil, racine)
  └─ 4 CATÉGORIES par armure (nœuds dans la constellation 'coeur') :
       cat_plaque (Guerrier, Paladin, DK) · cat_mailles (Chasseur, Chaman)
       cat_cuir (Voleur, Druide)          · cat_tissu (Mage, Démoniste, Prêtre)
        └─ NŒUD DE CLASSE (1 par classe, sa propre constellation) requiert sa catégorie
             └─ HUB D'ARCHÉTYPE (1 par archétype, sa propre constellation) requiert le nœud de classe
                  └─ le web de l'archétype (grappes, choix, sorts, ultime)
```

- **Une constellation = un archétype** (couleur + palier propres) ; le **nœud de classe** a sa propre
  constellation aussi (ex. `voleur`). Les catégories vivent dans `coeur`.
- Fichier : `src/game/talents.ts`. Constellations actuelles : `coeur, voleur, assassin, ombrelame`.

### Modèle d'ALLOCATION (clé — `talents.ts`)
- **Réachabilité par ADJACENCE** : un nœud est dispo si **un voisin est pris** (OR sur `requires` ∪ `links`).
- `requires` = parent(s) de layout + voisins. `links` = arêtes SUPPLÉMENTAIRES (routes croisées ; tracées
  en ponts). ⚠️ Le joueur a trouvé l'anneau de `links` **illisible** sur le Voleur → **par défaut, PAS de
  links cross-grappes** ; chaque grappe part du hub. N'utiliser `links` que si une route alternée est voulue.
- `requiresAll` = **convergence** (exige TOUS les nœuds — ex. `om_danse`).
- `exclusive: 'groupe'` = **choix exclusif** (prendre A verrouille ses frères de groupe ; l'UI grise ⊘).
- `minSpent: N` = **porte de budget** (N points dépensés dans la constellation avant d'allouer) — pour gater
  les sorts/ultimes profonds **sans** forcer un chemin.
- Helpers d'écriture : `node()`, `minor(id,c,tier,name,maxRank,stat,opt)`, `ks(id,c,tier,name,desc,{stat?,ks?,resist?},opt)`,
  `ability(id,c,tier,name,powerId,desc,opt)`. `opt` = `{requires, links, requiresAll, exclusive, minSpent, statMods…}`.

---

## 3. SYSTÈME DE TAGS (la colle multi-classe)

Chaque sort porte des **tags** (`PowerDef.tags` / `SpellSpec.tags`). **12 tags de comportement** +
**7 types de dégâts** (déjà des tags de fait via `damageType`).

`mono` · `zone` · `dot` · `direct` · `generateur` · `finisseur` · `furtif` · `soin` · `protection` ·
`ultime` · `invocation` · `controle`  (liste : `classData.ts` → `BEHAVIOR_TAGS`)

- **Modificateur par tag** : keystone `tagBonus: { tag, damageMult }`. Agrégé dans `charCombatMods.tagBonus`
  (produit), appliqué dans `fireActive` (et estimé dans `abilityDps`). → « tes [finisseur] +15% » booste tout
  sort taggé `finisseur`, **toutes classes confondues**.
- **Tags ≠ Triggers** : un tag = ce qu'EST le sort ; un trigger = une CONDITION (sur crit, à l'esquive, au seuil).
  Réservé `soutien` (buff d'équipe/aura) pour le jour où une classe en fait son identité.

---

## 4. RESSOURCE build/spend GÉNÉRIQUE

- Mécanique **déjà générique** : `effect:'builder'` (+1 ressource) / `effect:'finisher'` (dégâts × ressource,
  remet à 0 ou à `comboRefund`). Stockée dans `char.combo`. Keystones : `comboGen` (+génération), `comboCap`
  (+plafond, base 5), `finisherMult` (+dégâts finisseur), `comboRefund` (rend N PC).
- **Pour une nouvelle classe** : mettre `resource: 'Rage' / 'Pouvoir sacré' / 'Maelström'…` sur ses
  générateurs/finisseurs (libellé d'affichage, `CombatPanel` le montre). Même moteur, nom propre.
- ⚠️ Limite connue : `char.combo` est **un seul pool**. Un build qui mixe deux systèmes build/spend les
  **partage**. Acceptable v1 ; si besoin un jour → `char.resources: Record<string, number>` indexé par nom.

---

## 5. MÉCANIQUES NEUVES déjà codées (réutilisables)

| Mécanique | Données | Résolu où | Pour |
|---|---|---|---|
| **Venin cumulatif** | `enemy.venomStacks` ; keystone `poison:{perStack,maxStacks}` (base 0.08/4) | `fireActive` effet `poison` (réutilise `enemy.dot`) | Assassin, DoT-empile |
| **Détonation** | effet `detonate` ; `detonateDouble` (Catalyse ×2) | `fireActive` effet `detonate` | Assassin, finisher de DoT |
| **Points de Combo** | `char.combo` ; `comboGen/Cap/Refund/finisherMult` | `fireActive` `builder`/`finisher` | Ombrelame + futures (Rage…) |
| **Tags / tagBonus** | `PowerDef.tags` ; keystone `tagBonus` | `fireActive`, `abilityDps`, `charCombatMods` | TOUTES (multi-classe) |
| **Auto à seuil** | — | `autoSpenderReady` (store) : finisher≥3, detonate≥4, sinon attend | pont idle↔try-hard |
| **Invocation (pet)** | keystone `petDps` (× DPS auto, continu) | les 2 pas de combat + `charDps`/`dpsBreakdown` (ligne 🐾) | Chasseur (meute), Démoniste (Légion), totems |
| **Contrôle** | `enemy.controlled` (posé par sorts taggés `controle`) ; keystone `shatter` (+dégâts vs contrôlés, SORTS only) | `fireActive` (pose + bonus), décrément au tick | Cryomancien ✓, DK Givre-mort |
| **Embrasement sur crit** | keystone `igniteOnCrit:{frac,duration}` (frac somme, durée max) | les 2 pas de combat (sur `hit.crit`) + estim. fiche `igniteDps` (ligne 🔥) | Pyromancien ✓ |
| **3 passifs / 5 actifs** | `char.powers` (5 actifs) + `char.passives` (3 passifs) | `charPassives` lit `passives` ; `setPassive` | toutes |

> ⚠️ `enemy.dot` est **un seul slot** (Math.max garde le plus fort) : venin / saignement / Embrasement / Immolation
> se le **partagent** (pas de cumul). Idem `char.combo` partagé (Ombrelame / Arcaniste / Œil de faucon).
> Acceptable v1. — Les **finisseurs taggés `zone`** (Éventail, Orbe… si effect `finisher`) ne frappent QUE le focus
> en multi : seuls `cleave`/`megaCleave` touchent le pack. Pour une vraie AoE → effet `cleave`.

`KeystoneEffect` (dans `classData.ts`, re-exporté par `talents.ts`) liste TOUS les champs ; combat les
résout dans `character.ts` (`charCombatMods`) + `store.ts` (`fireActive`, pas de combat).

---

## 6. PowerEffect (catalogue) — `types.ts`
`nuke, cleave, megaCleave, dot, heal, hot, shield, buffParty, bigShield, invuln, charge, frenzy,
executeNuke, lifeNuke, rupture, mark` + **v0.29** `poison, detonate, builder, finisher`.
Estimation DPS de fiche : `character.ts` → `abilityDps` (gère tous, y compris l'économie de combo). Le calcul
**multi-types** se fait par le **profil de dégâts** (`damage.ts`) — un sort hérite du type de l'arme sauf
`damageType` explicite ; le bonus +%type s'applique à tout.

---

## 7. RECETTE : AJOUTER UNE CLASSE (pas à pas)

1. **Sorts** → `powers.ts`, dans un tableau `<CLASSE>_SPELLS: SpellSpec[]` (copier le bloc `VOLEUR_SPELLS`),
   puis `for (const s of …) POWERS.push(specToPower(s))`. Renseigner `tags`, `type`, `scale`, `resource`.
   - Effet **inédit** ? Ajouter dans `types.ts` `PowerEffect`, `powers.ts` `EFFECT_FR` + `POWER_EFFECT_META`,
     `store.ts` `fireActive` (le case), `character.ts` `abilityDps` (l'estimation).
2. **Keystone inédit** ? Ajouter le champ dans `classData.ts` `KeystoneEffect`, l'agréger dans
   `character.ts` `charCombatMods`, le résoudre dans `store.ts` (`fireActive` ou le pas de combat).
3. **Arbre** → `talents.ts` :
   - `ConstellationId` : ajouter `'<classe>'` + un id par archétype.
   - `CONSTELLATIONS` : meta (name, role, color, icon, `archetype:true` pour les archétypes).
   - `CONSTELLATION_LIST` : les ajouter.
   - Nœud de classe : `node('cl_<classe>', '<classe>', 'ability', 0, 1, …, { requires:['cat_<categorie>'], unlockPower:'…' })`.
   - Par archétype : `ability('<hub>', '<archetype>', 0, …, { requires:['cl_<classe>'] })` puis les grappes
     (minors = stats, ks = keystones/choix, ability = sorts). Gater : `minSpent` sur sorts/ultimes profonds,
     `exclusive` sur les choix de sorts, `requiresAll` sur une convergence.
4. **Vérifier** : `npx tsc --noEmit` (0 erreur) **ET** `npm run validate` (0 doublon / 0 require cassé /
   0 inaccessible / 0 sort manquant).
5. **Save** : aucune migration à écrire — le chargeur (`store.ts`) purge les ids inconnus et REMBOURSE les
   points (respec gratuit de fait). Garder `co_start` comme racine.

⚠️ **Test visuel** : l'arbre se déverrouille au **lvl 10**. Le preview en sandbox (data: URL) ne permet pas
de monter un perso → tester sur une vraie partie. `tsc` + `validate` sont les garde-fous fiables.

---

## 8. PRINCIPES DE PROFONDEUR (gabarit d'un archétype réussi)
1. **1 sort de départ** au hub. 2. Le **2e/3e sort gaté** derrière 2-4 modificateurs (qui le renforcent →
quand on l'a, il frappe déjà fort). 3. **≥1 choix exclusif de SORTS** (deux gameplays, un seul équipé).
4. **Modificateurs = tags/combos**, pas des stats sèches. 5. **Ultime au fond** (`minSpent 20`). 6. **Une
grappe de survie** cohérente au profil. 7. **Anneau de links évité** (illisible) — grappes indépendantes du hub.

---

## 9. CATALOGUE DES 23 ARCHÉTYPES (10 classes — 15 DPS / 4 TANK / 4 HEAL)
Format : **Nom** (rôle) — *boucle unique* — `tags` clés. (Noms = identités, basés sur WoW mais renommés.)

### 🐆 VOLEUR (Cuir) — ✅ FAIT
- **Assassin** (DPS) — venin cumulatif → détonation (Catalyse ×2 ; Réaction en chaîne = AoE) ; survie = Drain. `dot, finisseur`
- **Ombrelame** (DPS) — Points de Combo (générateur→finisseur, Effusion = refund) ; convergence Danse ; survie = esquive/Voile. `generateur, finisseur, furtif`

### ⚜ PALADIN (Plaque) — *ressource « Pouvoir Sacré » partagée 3 specs*
- **Croisé** (DPS) — build → Jugement (finisseur sacré). `mono, direct, finisseur` (arcane)
- **Templier** (TANK) — blocage + **aura** partageant ta résistance à l'équipe + zone consacrée. `protection, zone`
- **Aube** (HEAL) — soigne en frappant (Pouvoir Sacré → soins), scale FORCE (heal non-INT). `soin, generateur, finisseur`

### ⚔ GUERRIER (Plaque) — *ressource « Rage »*
- **Sentence** (DPS) — Rage → gros coups + **exécution** + saignements. `mono, direct, finisseur, dot`
- **Rempart** (TANK) — Rage → **bouclier d'absorption** + **épines** + provocation. `protection, finisseur`

### ☠ CHEVALIER DE LA MORT (Plaque) — *ressource « Puissance runique »*
- **Givre-mort** (DPS) — **brise** les cibles `controle` (exécution sur gelé/ralenti) + multifrappe runique. `mono, direct, finisseur, froid, controle`
- **Sang** (TANK) — tank vampire : dégâts/DoT te **soignent** + bouclier d'os. `protection, soin, finisseur, ombre`

### 🏹 CHASSEUR (Mailles) — ✅ FAIT
- **Meneur de meute** (DPS) — **familier** (`petDps`, DPS passif idle ; Meute = 2e fauve, Alpha/Frénésie au choix). `invocation, direct, nature`
- **Œil de faucon** (DPS) — **Concentration** (`char.combo`) : générateur→finisseur + **exécution** (`executeBonus`) + précision. `mono, direct, finisseur`

### ⚡ CHAMAN (Mailles)
- **Élémentaire** (DPS) — **Maelström** + foudre en chaîne (zone) + procs de Surcharge. `zone, finisseur, foudre`
- **Vague** (HEAL) — **totems** (`invocation`) + soin en chaîne (zone). `soin, zone, invocation`

### 🐾 DRUIDE (Cuir)
- **Lunaire** (DPS) — **Éclipse** (Lune/Soleil) → Pouvoir astral → gros sort. `finisseur, zone` (arcane/nature)
- **Ronce** (TANK) — gros PV + **épines** + régén, dégâts à PV hauts. `protection, soin`
- **Floraison** (HEAL) — **HoT empilés** qui éclosent. `soin, dot, zone`

### 💀 DÉMONISTE (Tissu)
- **Pestilence** (DPS) — gère **plusieurs DoT** ; un drain qui les **étend/détone** tous. `dot, finisseur, zone, ombre`
- **Légion** (DPS) — **invoque des démons** cumulés (`invocation`) + Tyran qui les survolte. `invocation, ombre`

### ✨ MAGE (Tissu) — ✅ FAIT
- **Pyromancien** (DPS) — **crits embrasent** (DoT feu via `igniteOnCrit`) + Combustion (cumule frac + [feu]). `direct, dot, feu`
- **Cryomancien** (DPS) — **gèle** (`controle` : Cône/Nova/Gangue) puis **fracasse** (`shatter` +0,45 sur gelé, SORTS). `mono, direct, controle, froid`
- **Arcaniste** (DPS) — **Charge des arcanes** (`char.combo`) → surcharge ; Cascade (`cdrOnCast`) = spam. `mono, finisseur, arcane`

### ✚ PRÊTRE (Tissu)
- **Lumière** (HEAL) — **soigne en infligeant des dégâts** (atonement) + boucliers. `soin, protection, direct`
- **Vide** (DPS) — **Folie** : plus tu restes en Forme du Vide, plus tes DoT d'ombre **rampent**. `dot, ombre, finisseur`

---

## 10. CARTE DES FICHIERS
- `src/game/classData.ts` — `KeystoneEffect` (tous les champs de mécaniques), `SpellSpec`, `KsSpec`, `BEHAVIOR_TAGS`.
- `src/game/talents.ts` — arbre (constellations, nœuds, helpers `node/minor/ks/ability`, modèle d'alloc
  `isReachable/canAllocate/gateInfo/exclusiveBlocker/spentInConstellation`).
- `src/game/powers.ts` — registre des sorts (`POWERS`), `specToPower`, `POWER_EFFECT_META`, `VOLEUR_SPELLS`.
- `src/game/character.ts` — `charCombatMods` (agrège keystones → `CombatMods`), `charPassives`, `abilityDps`/
  `charDps`/`dpsBreakdown` (DPS de fiche), `makeCharacter`, `PASSIVE_SLOTS`, `POWER_SLOTS`.
- `src/game/store.ts` — `fireActive` (résolution des effets de sort, PARTAGÉ), les 2 pas de combat
  (`partyCombatStep` / `partyCombatStepMulti`), `autoSpenderReady`, `setPower`/`setPassive`, chargement/migration.
- `src/game/combat.ts` — `rollHit`, `theoreticalDps`, atténuation.
- `src/game/types.ts` — `PowerEffect`, `Character` (`powers`, `passives`, `combo`), `Enemy` (`venomStacks`, `controlled`).
- `src/components/CharacterPanel.tsx` — équipement des capacités (5 actifs / 3 passifs).
- `src/components/CombatPanel.tsx` — combat ; ressources affichées (Combo X/cap, ☠ Venin ×N).
- `scripts/validate-talents.mjs` — `npm run validate` (intégrité de l'arbre, bundle esbuild).
- `scripts/check-classes.mjs` — `npm run check-classes` (smoke-test runtime des classes : DPS de fiche +
  keystones par archétype, sans NaN ; à étendre par classe).

## 11. NETTOYAGE / DETTE
- `scripts/sim-classes.mjs` (simulateur DPS des 39 specs générées) est **périmé** (modèle abandonné) — à
  re-câbler sur le nouveau modèle si on veut simuler, sinon supprimer.
- `DESIGN_v0.29_refonte_classes.md` = ancien plan, **superseded** par ce doc.
- Lot non fait : **conversion de type → gemmes/runes** (retirée des classes, doit atterrir dans le stuff).
- Équilibrage : valeurs (perStack, finisherMult, minSpent, petDps…) sont des **knobs** à éprouver en jeu.

## 12. PROCHAINES ÉTAPES suggérées
1. Tester Voleur/Mage/Chasseur en jeu (ressenti profondeur/gating/manuel ; éprouver les knobs : `igniteOnCrit`
   frac, `shatter` total, `petDps` total ~0,95, `finisherMult`). 2. Classes à RESSOURCE NOMMÉE :
   **Guerrier** (Rage : build/spend + exécution + saignements), **Paladin** (Pouvoir Sacré partagé 3 specs, dont
   1 TANK + 1 HEAL — premiers rôles non-DPS), **Chevalier de la mort** (Puissance runique ; Givre-mort réutilise
   `controle`/`shatter` déjà codés). 3. Puis Chaman/Druide/Démoniste/Prêtre (totems & Légion = `petDps`).
   4. Lot gemmes/runes de conversion (type → type). 5. **TANK/HEAL** : aucun encore handcrafted — vérifier que
   menace (`threatMult`), `shareResist`, `healToDamage` tiennent dans le nouveau modèle d'arbre.

> ⚙️ Garde-fous : `npx tsc --noEmit` + `npm run validate` (intégrité arbre) + `npm run check-classes` (smoke-test
> runtime : alloue des talents, équipe des sorts, vérifie DPS/keystones sans NaN). Étendre `check-classes.mjs`
> à chaque nouvelle classe.
