# DESIGN v0.27 — Endgame, anti-exploit, refonte stats/DoT, qualité, prestige

> État : **DESIGN FINAL — implémentation en cours** (juin 2026). Issu du retour joueur.
>
> **Lots LIVRÉS & commités** : **Lot 1 (Abîme A)** · **Lot 2 (qualité + inventaire D1–D5)** ·
> **Lot 4 (stats/arbre C1·C3·C5·C6·C7)** · **Lot 6 (confort F1–F4)** · **Lot 3 SOCLE** (anti-immortalité :
> Mal de l'abîme regen−50% en raid + Estoc primordial 4% PV max imparable) · **corrections retour**
> (qualité ⭐X/5 coin haut-gauche, carte fonderie au clic, validation rotation biome) · **F4 badge**
> façon Overwatch (avatar + écusson à paliers, page combat + aperçu héros).
> Tous : `tsc -b` + `vite build` + `validate-talents` + `dps-check` + `survival-sim` verts, preview OK.
>
> **RESTANT** :
> - **Lot 3 (suite)** : 3 autres leviers socle (heal-cut, frappe partagée, estocade) + 10 twists par
>   raid + panneau Préparation. *À faire après playtest du socle en raid réel (tuning ESTOC_PCT / regen).*
> - **Lot 5 (prestige E)** : le plus gros système neuf (Éveil = reset destructif, Échos, Constellation,
>   Relique) — mérite une passe dédiée.
>
> Knobs à éprouver : ESTOC_PCT=4% · RAID_REGEN_MULT=0.5 · qualité (+0/0/1/1/2) · SECOND_STAT_SHARE=0.2 ·
> biomes (10 min / 60 min / 3 ✨). Chiffrage ouvert : E2 (gain d'Échos).

Sommaire :
- **A —** Abîme Primordial : accès + parité endgame
- **B —** Combat anti-exploit + Aperçu global de survie
- **C —** Système de stats & arbre de talents (DoT For/Agi/Int, conversions, pathing, clarté des types)
- **D —** Équipement : qualité unifiée, lisibilité (iLvl/rareté/qualité), fonderie, gemmes mobile
- **E —** Prestige « Éveil Primordial » (reset dur + Relique)
- **F —** Confort & monde : wake-lock mobile, rotation des biomes

---

## A — Abîme Primordial : accès + parité endgame

### Diagnostic (chiffré, vérifié dans `raids.ts` + `enemies.ts`)

Formules réelles : `stageIlvl(s)=round(s×1.5)` ; `raidIlvl=round((stageIlvl(anchor)×1.12 + baseDifficulty×8) × 1.22^(tier−1))` ; HP boss ∝ `1.18^(effStage−1)×baseDifficulty`, `effStage = anchor + (tier−1)×4`.

| Courbe | Forge T7 | Abîme T1 (actuel) | Verdict |
|---|---|---|---|
| iLvl butin | 303 | **133** | ❌ niveau Forge **T3** |
| HP boss (difficulté) | réf. | ≈ **−2 %** | ✅ déjà calé |
| Dégâts boss | réf. | **+20 %** | ✅ ok (endgame) |
| Exigence résist `raidReq` | 304 | **127** | ❌ 2,4× trop bas |
| Rareté plancher | Artefact (7) | **Rare (4)** | ❌ ~3 crans trop bas |
| Trophées / fragments / éclats | élevés | minimaux | ❌ indexés « tier 1 » |

**Racine** : la difficulté de l'Abîme est ancrée en avant (`anchorStage:70` + `baseDifficulty:1.9` ⇒ ≈ Forge T7) **mais toutes les courbes de récompense/check lisent le numéro de tier brut (1)**. Un boss aussi dur que Forge T7 lâche du butin de Forge T3 et n'exige que des résist de Forge T3.

### Décision

Introduire un **palier mondial** : `globalTier(def, tier) = tier + (def.tierOffset ?? 0)`, avec **`abysse.tierOffset = 6`**. Toutes les courbes de **récompense et de check** passent par `globalTier` ; la **difficulté (HP/dégâts) reste inchangée** (déjà bonne).

Fonctions à router via `globalTier` : `raidIlvl`, `raidRarityWindow` (floor/peak/cap), `raidReq`/`raidReqs`, `raidTrophyGain`, `raidTierUnlockCost`, `raidFragments`, `raidCosmicChance`, `raidCosmicQty`, `raidBerserkTime`. **Ne PAS router** : `bossHp`, `bossDamage`, `effStage` (difficulté conservée).

Effet : l'Abîme **T1 affiché = T7 mondial**. iLvl ≈ **438** (au-dessus de Forge T7 = 303 → correct : l'Abîme est LA meilleure source de loot du jeu), rareté plancher Artefact+, `raidReq` ≈ 331 (≈ Forge T7). Bénéfice gratuit : `maxContentIlvl` et `maxCraftTier` (qui consomment déjà `raidIlvl`/`bestRaidTier`) suivent l'Abîme comme nouveau plafond.

### Accès

Remplacer `unlockStage:100 + requires:'nexus'` par une condition **« T7 sur les 4 raids de base »** :
```
abysseUnlocked = min(progress.forge, progress.reliquaire, progress.citadelle, progress.nexus) >= 7
```
Math du gating : atteindre T7 sur un raid coûte cumulativement `5+10+15+20+25+30 = 105` trophées (`raidTierUnlockCost`), à ~6/clear de T6 → sur **4 raids**, vrai mur d'endgame. **Palier 100 retiré** (le « T7 ×4 » est LA porte, et implique de facto un perso/stuff de haut niveau).

**Knobs** : `tierOffset` (4/5/6 — 6 retenu), tier d'accès (6/7 — 7 retenu), iLvl plafonnable à 303 si on veut la parité stricte (option C : router rareté/req/récompenses en +6 mais brider l'iLvl).

**Question ouverte A1** : afficher l'Abîme comme « Tier 1 » avec bandeau « ≈ Tier 7 mondial », ou directement renuméroter « Tier 7 → … » ? (reco : garder T1 affiché + bandeau, plus lisible que des tiers qui sautent de 1 à 7.)

---

## B — Combat anti-exploit + Aperçu global de survie

### Diagnostic (vérifié dans `store.ts` / `combat.ts` / `resist.ts`)

Le combo **1 tank + 1 DPS** trivialise tous les checks car :
1. **Ciblage par menace** (`(dps+1)×threatMult`) → tout le mono-cible converge sur 1 perso ; un tank `threatMult` aspire 100 % des coups.
2. **Mitigation générique plafonnée à 80 %** (`EFFECTIVE_DR_CAP=0.8`) puis **regen 5 %/s** (`REGEN_RATE`) + leech + `surplusRegen` + perfusion ⇒ regen > dégâts réduits ⇒ « ma vie ne bouge pas ».
3. Nova/kit **typés et soignables** (résist annule le multiplicateur, regen éponge le reste).
4. Seul couperet, l'enrage, est satisfait par le DPS dédié avant de mordre.

→ Chaque check (résist/EHP/DPS) résolu par **un perso spécialisé différent** ⇒ zéro tension de build.

### Décision — Socle global (5 leviers, surtout en raid)

| # | Levier | Cible de l'exploit | Détail (valeurs initiales à éprouver) |
|---|---|---|---|
| **2** | **Blessures mortelles** | regen + leech | Gros coups/Nova posent un debuff **−60 % aux soins reçus** (regen, leech, HoT, vol de vie) pendant 5 s. Nouveau champ ennemi `healCut`, appliqué dans la boucle de soin. |
| **4** | **Estoc primordial** | EHP/mitigation pur | Attaque signature = **% des PV max** (3–5 %), **ignore armure/résist**, sous plancher ; non réductible par le cap de mitigation. |
| **37** | **Mal de l'abîme** (knob) | regen excessive | `REGEN_RATE` **5 %→2,5 %/s en raid** + soft-cap au-delà d'un seuil. La vie redevient une ressource. |
| **12** | **Frappe partagée** | solo-tank | Périodiquement un coup se **divise entre héros vivants** ⇒ un solo-tank encaisse le total (valorise le scaling multi-perso). |
| **11** | **Estocade** | DPS protégé | Une AoE vise le **plus bas en PV** (pas la menace) ⇒ le DPS doit aussi survivre. |

3 premiers ⇒ immortalité (regen/EHP) ; 2 derniers ⇒ tension de rôle. Aucun n'interdit un build perçant : ils posent un **plancher de pression incompressible**.

### Décision — Twists identitaires (2 par raid, renforcent la faille voulue)

| Raid (faille) | Twist A | Twist B |
|---|---|---|
| **Forge** (pén.+DPS) | **Trempe** : armure ×2, 4 s/15 s → seul le pic de pénétration passe | **Surchauffe** : DPS rapide ⇒ boss tape plus fort (anti-glass-cannon) |
| **Reliquaire** (burst) | **Ressoudure** : pas tué sous seuil en X s ⇒ regen 100 % | **Avarice** : add tué ⇒ rend des PV au boss (ordre de kill) |
| **Citadelle** (EHP) | **Barrage** : 3 Novas rapprochées (salve) | **Effondrement** : sous 20 % PV, Nova toutes les 2 s |
| **Nexus** (résist large) | **Résonance** : trou de résist amplifie le coup suivant | **Inversion** : résiste au type le plus utilisé (force la diversité) |
| **Abîme** (duo) | **Synchronisation** : jumeaux castant ensemble ⇒ Nova ×2 | **Dernier souffle** : mort du 2ᵉ jumeau ⇒ Annihilation = % PV équipe |

**En réserve (dials)** : `EFFECTIVE_DR_CAP` qui se resserre 0,8→0,65 aux hauts tiers ; Annihilation différée à purger. Non inclus tant que le socle n'est pas mesuré.

### Aperçu global de survie (nouveau panneau)

Aujourd'hui `recommendedDps`/`recommendedEhp`/`raidReqs` existent mais ne sont lus que par raid. **Ajouter une vue « Préparation »** (fiche perso / hub) :
- Par contenu accessible (biome courant, donjons débloqués, chaque raid×tier tentable) : **DPS requis vs DPS actuel**, **EHP requis vs EHP actuel**, **résist requise par type vs résist actuelle** — code couleur ✅/⚠️/❌.
- Une ligne de synthèse « tu es prêt jusqu'à : <contenu le plus dur où tout est ✅> ».
- Réutilise `charDps`/`charEhp` (déjà dans `character.ts`) + `raidReqs`/`recommendedDps`/`recommendedEhp`.

**Question ouverte B1** : l'aperçu liste-t-il TOUT le contenu (long) ou seulement « le palier suivant + les tiers de raid à portée » (compact) ? (reco : compact + bouton « tout voir ».)

---

## C — Système de stats & arbre de talents

> Le point le plus profond. Le joueur a raison : aujourd'hui le système **« déplace le problème »**
> (un archétype est nominalement lié à 1 stat primaire, mais son payoff est agnostique à la stat).
> On RE-PENSE, sans tout casser.

### Diagnostic (vérifié dans `stats.ts` / `talents.ts` / `powers.ts`)

1. **`power = statPower(stat dominante)`** — winner-take-all strict. Les 2 autres primaires ne donnent **rien** à l'auto-attaque (elles n'alimentent que `forcePower/agiPower/intPower` des sorts). ⇒ les builds hybrides de stats sont punis ; un arbre d'archétype qui octroie une stat non-dominante est du gâchis de `power`.
2. **Maîtrise = nature différente selon la dominante** : For→réduction (bruiser), Agi→dégâts crit., Int→dégâts bruts. C'est la **vraie identité** des 3 primaires (et elle est bonne).
3. **Sorts** : `scaleStat`/`scaleStats` **codés en dur** (ex. Poison/Lacération = For/Agi ; Embrasement/Fléau/Soif du néant = Int). ⇒ **Soif du néant** (ultime Faucheur, arbre Int) scale **For/Agi** : mismatch confirmé.
4. **DoT-keystones** (`dot:{frac,duration}`) : `dps = hit.damage × frac × alterationMult` ⇒ **agnostiques à la stat** (scalent sur la dominante). Il n'existe **aucune identité distincte** For-DoT / Agi-DoT / Int-DoT : tous font la même chose.
5. **Pathing siloté** : Pestiféré derrière `in_a4` (Arcaniste/Int profond) ; Faucheur derrière `cv_b1` **Voile d'ombre** (conversion physique→ombre **forcée**) ; les conversions de stat (`Guerre dansante`→`Esprit affûté`→`Magie de guerre`) sont une **chaîne profonde** (chaque keystone exige le précédent MAXÉ).
6. **UI** : la constellation Métamorphe entasse **6 branches au tier 1** depuis `cv_entry` (Équilibre, Flux, Cristallisation, 3 Empreintes) ⇒ collision ⇒ la node avant **Givre éternel** (Cristallisation) devient **incliquable**.

### Principe directeur (le « repense »)

> **Le primaire est le MOTEUR (combien tu frappes), l'arbre est l'IDENTITÉ (comment / quel type).**
> On découple le *scaling* du *thème*. INT cesse d'être « la stat des DoT/sorts » : c'est la Maîtrise
> glass-cannon. N'importe quel primaire peut faire du DoT ; ce qui change, c'est la **forme** du DoT.

### C1 — Découpler le scaling des sorts de l'arbre

**Les capacités offensives scalent sur ta `power` (stat dominante)**, plus sur une stat codée en dur. Le `damageType` de la capacité reste sa saveur (interagit avec résist/biome — le vrai choix). 

- Supprime le mismatch (4 ⟶ Soif du néant scale sur ta dominante, cohérent).
- Permet à un build For/Agi de prendre une capacité « d'arbre Int » et qu'elle scale correctement.
- **Nuance d'affinité (optionnelle)** : +10–15 % si ta dominante == la stat thématique de la capacité, pour garder une nudge de saveur sans verrouiller.

### C2 — Donner à chaque primaire une voie DoT COMPLÈTE et DISTINCTE

Même moteur (`alterationMult`), **formes** différentes — ça répond à « qu'est-ce qui les différencie » :

| Primaire | Identité DoT | Forme mécanique | Loge dans |
|---|---|---|---|
| **Force** | **Saignement / Hémorragie** | DoT **mono-cible BURST** (frac haute, courte durée), **PHYSIQUE** (ignore la résist élémentaire → fort vs boss résistants), nourri crit | Berserker / Bourreau |
| **Agilité** | **Poison** | DoT **EMPILABLE / qui RAMPE** (s'intensifie dans la durée, multi-application via multifrappe), crit-fed | Rôdeur / Assassin |
| **Intelligence** | **Peste / Brûlure / Ombre** | DoT **AoE (propagation, Pandémie) + DRAIN (dotLeech)**, élémentaire (gère la résist mais multi-cible/sustain) | Pestiféré / Faucheur |

Chaque voie doit être **auto-suffisante** : accès à l'**Altération** + un **capstone DoT** sans traverser une autre stat. (For/Agi ont déjà un peu d'Altération via le capstone Rôdeur « Carquois sans fond » +50 ALT ; on en ajoute côté Berserker.)

### C3 — Libérer le pathing

- **Faucheur** : déplacer la passerelle `cv_gw_faucheur` pour qu'elle exige `cv_entry` (ou un nœud de support neutre), **plus `cv_b1` Voile d'ombre** ⇒ on n'est plus forcé de convertir physique→ombre. (Alternative : ajouter une 2ᵉ passerelle Faucheur depuis l'Arcaniste, archétype Int/ombre.)
- **Pestiféré** : ajouter une **2ᵉ passerelle depuis le Rôdeur/Agilité** (poison → peste est naturel) en plus de celle d'Int ⇒ un build poison atteint la propagation sans détour Int.
- **Conversions de stat Métamorphe** : rendre `Guerre dansante` / `Esprit affûté` / `Magie de guerre` **parallèles** (chacune ne requiert que `cv_entry`), plus une chaîne ⇒ on prend **la** conversion voulue sans acheter les 3.

### C4 — Faire vraiment interagir les stats primaires (le fond)

Deux leviers, à doser :
- **(déjà là)** Les conversions Métamorphe empilent une stat sur une autre (ex. `Magie de guerre` : 60 % de l'Int compte comme Force) ⇒ comme `power` lit la dominante, investir Int **gonfle** une `power` Force-dominante. C'est le canal hybride existant — on le **clarifie et on le rend accessible** (C3).
- **(option)** **Adoucir le winner-take-all** : `power = statPower(main + 0.25 × second)` au lieu de `max` seul ⇒ un hybride 2-stats délibéré (For+Int) n'est plus du poids mort même sans conversion. Touche l'équilibrage global ⇒ **à activer prudemment** (knob `SECOND_STAT_SHARE`, 0 = comportement actuel).

**✅ C5 (tranché)** : on **adoucit** le winner-take-all → `power = statPower(main + 0.2 × second)` (knob `SECOND_STAT_SHARE = 0.2`, mesurable et réversible). Un hybride 2-stats délibéré n'est plus du poids mort.

### C6 — Clarté du type de dégâts (UI + doc)

Le modèle réel (`damage.ts`) : **auto-attaques ET sorts utilisent le même PROFIL** (répartition par type). L'arme **pose le poids de base** sur son type ; chaque affixe `+% type` (n'importe quelle pièce) **reforme** le profil ; les sorts scalent via `profileDamageMult` (donc suivent le profil). ⇒ « les attaques physiques ont bien un type » = celui du profil, dominé par l'arme tant qu'aucun affixe ne le bascule.

**À faire (lisibilité, pas de refonte)** :
- **Lecture du profil** sur la fiche perso : « ⚔ 70 % Physique · 🔥 30 % Feu », avec mention « auto-attaques **et** sorts utilisent ce profil ».
- Tooltip d'arme : « type de base = graine du profil ; les affixes +% type le déplacent ».
- Sur chaque capacité : afficher **« scale sur ta stat dominante »** (après C1) + son `damageType`.

### C7 — UI de l'arbre (node incliquable)

La constellation Métamorphe (6 branches au tier 1 depuis un seul `cv_entry`) doit être **désencombrée** : espacement angulaire/radial accru, ou sous-sections (Conversions de stat / Conversions de type / Empreintes / Alchimiste). Objectif : chaque nœud cliquable sans chevauchement, **Cristallisation/Givre éternel** inclus. Audit générique du layout pour les constellations à fort fan-out.

**✅ C8 (tranché)** : **v0.27 = C1 + C3 + C6 + C7** (re-câblage du scaling + pathing libéré + clarté du profil + fix layout — fort ROI, faible risque). **C2 (nouvelles abilities DoT par primaire)** repoussé en **v0.28**. NB : C1 (sorts scalent sur la dominante) + C3 (pathing) rendent **déjà** les builds For/Agi DoT viables avec l'outillage existant ; C2 ne fera qu'enrichir l'identité.

---

## D — Équipement : qualité unifiée, lisibilité, fonderie, gemmes

### D1 — Qualité unifiée sur TOUS les équipements

Aujourd'hui `Item.quality?` **existe** mais n'est pas exploité (seules les gemmes ont une qualité). On en fait un **axe orthogonal à la rareté**, présent sur **drops ET crafts**.

- **Définition** : **5 paliers nommés** — Grossier < Standard < Fin < Supérieur < Chef-d'œuvre. La qualité agit sur **DEUX** axes (décision joueur : « + de qualité = + de stats ») :
  1. **Nombre de lignes** : aujourd'hui le nombre d'affixes est **DÉJÀ FIXE par rareté** (`items.ts:198` → `rollAffixes(rarity.affixCount, …)`, zéro variance : Rare = 3, Légendaire = 4, …). Décision joueur : **on garde ce nombre fixe comme PLANCHER**, et la **qualité est le SEUL levier qui ajoute des lignes**. `affixes = RARITIES[rarity].affixCount + qualityBonus(quality)`, avec `qualityBonus` = **+0 / +0 / +1 / +1 / +2** (Grossier→Chef-d'œuvre), plafonné à un max global (7). ⇒ deux Rares de qualité différente ont 3 vs 4 vs 5 lignes — la qualité se **LIT au nombre de stats**.
  2. **Budget par ligne** : multiplie la valeur de chaque affixe (×0,9 → ×1,15 environ).
- ⚠️ **Garde-fou d'équilibrage** : ajouter des lignes EN PLUS de la rareté gonfle la puissance ⇒ amplitude modeste pour qu'un **Chef-d'œuvre Rare ne dépasse pas un Épique standard** (la rareté reste le pilote du `statMult` et de la chance de stat RARE ; la qualité affine). Knob : la courbe `qualityBonus` + `qualityBudgetMult`.
- **Distribution par source** (le joueur veut « des qualités inférieures sur le farm, du bon en raid ») :
  - Farm/donjon bas palier → qualité basse-moyenne (queue vers le haut rare).
  - Donjon haut palier → moyenne-haute.
  - **Raid → haute garantie** (plancher de qualité par tier, comme la fenêtre de rareté).
  - Craft (forge) → qualité pilotée par le métier (voir D2).
- **Intégration** : `quality` entre dans `itemScore`, `equipDelta`, et le budget de `generateItem`. Unifie drop & craft sous une seule échelle.

**Question ouverte D1a** : qualité **continue** (0–100 %, fin mais bruité) ou **paliers nommés** (5 crans, lisibles) ? (reco : **5 paliers nommés** — lisibilité mobile, et ça matche la demande « voir le niveau de qualité ».)

### D2 — Rareté + iLvl + qualité visibles SANS CLIC (inventaire + équipé)

Exigence explicite du joueur : **voir la rareté (et l'iLvl, et la qualité) sans avoir à ouvrir l'objet**. Le point dur est l'**équipé** : aujourd'hui le slot du paper-doll ne montre que le **nom coloré** ⇒ la rareté est *devinée* à la couleur, pas *lue*, et l'iLvl/qualité sont invisibles avant de cliquer.

- **Équipé** (paper-doll `StuffScreen`) — le vrai manque : sur chaque slot, afficher **directement** un mini-bandeau **`rareté · i{ilvl} · qualité`** (texte court + couleur de rareté). Un coup d'œil sur le paper-doll = « Épique, i280, Chef-d'œuvre, et en retard d'iLvl » sans toucher l'objet.
- **Inventaire** (`ItemRow`) : la rareté est déjà dans le sous-titre + couleur ; on **ajoute le cran de qualité** (badge/sigle) à côté de `i{ilvl}`. Garder le tout lisible d'un seul regard.

**Le mot d'ordre transverse de D2/D3 : zéro clic pour juger une pièce (portée OU en stock).**

### D3 — Inventaire : tris + iLvl/qualité partout (chantier court, infra déjà là)

`equipDelta()` renvoie déjà `{dps, hp, ehp}` par objet ; `ItemRow` montre déjà `i{ilvl}` + Δ. Manque :
- **Tri par iLvl** (nouveau mode), **tri « +DPS »** et **tri « +Survie »** (réutilisent `deltas` ; recâbler l'ordre : deltas calculés après le tri actuel).
- **iLvl sur les objets ÉQUIPÉS** (paper-doll) avec **alerte de retard** : comparer l'iLvl du slot à `maxContentIlvl(bestStage, raidProgress)` ⇒ slot nettement en dessous = orange/rouge.
- **Qualité affichée** partout (D2).

### D4 — Fonderie : stats complètes avant de fondre

La fonderie n'affiche que **nom + rareté + iLvl** ⇒ insuffisant pour décider. **Afficher le bloc de stats complet** (primaire+valeur, tous les affixes, lignes typées, unique, gemmes, set) — réutiliser le rendu de `ComparePanel`/`itemStatBlock`. Idéalement un **mini Δ vs équipé** dans la fonderie aussi.

### D5 — Gemmes : aperçu avant sertissage (mobile)

Le tooltip de gemme est en **hover** ⇒ invisible au tap mobile. **Avant de sertir** : un panneau/feuille qui **décrit l'effet de la gemme** (nom, famille, condition, effet chiffré au rang courant) au tap. Pattern « sheet > tooltip » déjà adopté ailleurs (mémoire v0.20). S'applique à la liste de gemmes sertissables ET aux gemmes déjà serties (tap pour relire).

---

## E — Prestige « Éveil Primordial » (reset dur + Relique)

Aucun système n'existe (juste `reset()` hard). Greenfield.

### Le geste

Disponible quand l'Abîme est débloqué. **Reset DUR.** Le joueur choisit **1 pièce équipée** ⇒ **Relique**.

| Wipe | Conservé (permanent) |
|---|---|
| Stuff équipé + inventaire (**sauf Relique**) | **Échos primordiaux** 💠 + Constellation |
| Niveau perso · paliers de farm (`biomeStages`/`biomeBest` → 1) | La **Relique** |
| Tiers de raid *tentables* (`raidTierUnlocked`) | Record de progression (`raidProgress`, pour le gating) |
| Monnaies par-combat | **XP métier (choix A — conservée)** |

**La Relique** : pièce choisie, **iLvl ramené au plancher**, conserve **affixes / unique / gemmes / set**. Elle **re-scale avec ton palier de farm** (heirloom : redevient pertinente en fin de vie, jamais OP au début). Identité conservée, puissance non.

### MVP — 7 modules (gagner / dépenser / ancrer / accélérer / accrocher)

Un reset dur n'a qu'un risque : un re-grind punitif. Le MVP doit donc **gagner**, **dépenser**, **ancrer** et surtout **accélérer**.

| Rôle | Module | Détail |
|---|---|---|
| Gagner | **Monnaie = contenu** | Échos = f(meilleur tier de raid × palier × diversité de raids battus) — pas le temps farmé |
| Dépenser | **Constellation** | Méta-arbre permanent, **distinct** de l'arbre de talents |
| Ancrer | **La Relique** | La pièce gardée (identité qui traverse les vies) |
| Accélérer | **Vélocité primordiale** | +vitesse de combat permanente / palier d'Écho |
| Accélérer | **Rendement offline** | +gains hors-ligne / éveil |
| Adoucir | **Acclimatation** | +résist de base permanente / éveil (re-grind plus solide **et** adoucit le check résist endgame de A) |
| Accrocher | **Première étincelle** | Bonus immédiat et visible dès le 1ᵉʳ éveil (ex. +1 slot de préset) |

Boucle : gagner des Échos selon **ce qu'on a vaincu** → Constellation → Relique → vélocité/offline/acclimatation rendent chaque vie plus rapide et solide. La courbe **s'accélère** ⇒ reset dur grisant, pas punitif.

**Post-MVP** : Voies d'éveil (Conquérant/Artisan/Archiviste) · Le Pari (objectif avant reset, ×2/×0,5) · Sceaux de raid · Régalia évolutive (la Relique monte de rang par éveil) · Codex d'éveil.

**✅ E1 (tranché)** : seuil d'éligibilité = **« Abîme débloqué » seul** (c'est déjà le sommet).
**Question ouverte E2** : formule de gain d'Échos — pondération tier vs palier vs diversité (à chiffrer une fois la Constellation esquissée).

---

## F — Confort & monde

### F1 — Wake-lock mobile

Aucun wake-lock. L'écran s'endort ⇒ le idle « visible » s'interrompt. **Ajouter la Screen Wake Lock API** (`navigator.wakeLock.request('screen')`), ré-acquise sur `visibilitychange`, **togglable** dans les réglages (« garder l'écran allumé » — off par défaut pour la batterie). Fallback silencieux si non supporté (iOS Safari ancien).

### F2 — Rotation automatique des biomes (+ lock payant)

Aujourd'hui le biome est **choisi à la main** (`setBiome`) et on tend à rester sur le même. Décision : **rotation SUBIE toutes les X minutes** ; le **lock est un luxe payant** (endgame).

- **Défaut (subi)** : rotation auto **forcée** parmi les biomes **débloqués**, période `BIOME_ROTATE_MINUTES` (ex. 5–10 min). À chaque bascule, `activeBiome` change ; `stage` se synchronise sur `biomeStages[nouveauBiome]` (déjà géré à la sauvegarde). **Pas d'opt-out gratuit** : la variété est la règle.
- **✅ F2a (tranché)** : rotation **SUBIE** (pas opt-in) — le lock est le seul moyen de rester sur un biome.
- **✅ F2b (tranché)** — Lock = **Fragments d'éternité** (ressource rare de raid). Épingle un biome (durée ou jusqu'à déblocage manuel). **Conséquence design voulue** : farmer une **quintessence précise** ou un **stuff spécifique d'un biome devient du contenu ENDGAME** — il faut dépenser une monnaie d'endgame pour cibler un biome, sinon on subit le brassage. Le farm ciblé est un acte délibéré et coûteux.
- **Garde-fous** : ne pas basculer en plein raid/donjon (instances indépendantes) ; respecter les déblocages (`biomeUnlocked`) ; UI claire « prochain biome dans mm:ss » + coût/durée du lock en Fragments.

**Question ouverte F2c** : prix du lock en Fragments (par bascule évitée ? forfait par durée ?) + durée d'un lock — à chiffrer contre l'économie de Fragments (cf. `raidFragments`).

---

### F3 — Cycle de vie mobile : l'offline ne se déclenche pas

Bug signalé : **sur mobile, quitter l'appli ne « sort » pas vraiment et le mode offline ne se déclenche pas**. Aujourd'hui le calcul offline (`offline.ts` + `WelcomeBackModal`) se fait surtout au **cold start** (rechargement) ; un simple passage en arrière-plan (PWA) ne le déclenche pas, donc en revenant on n'a ni gains offline ni modal.

**À faire** — gérer le **cycle de vie** explicitement :
- Sur `visibilitychange → hidden` (ou `pagehide`/`blur`) : **horodater** la mise en veille et **suspendre** la boucle de tick (plus de simulation temps-réel en arrière-plan).
- Sur `visibilitychange → visible` : calculer l'**écart** depuis l'horodatage, appliquer les **gains offline** (mêmes règles que le cold start) et **afficher le WelcomeBack** si l'écart dépasse le seuil.
- Cohérent avec **F1 (wake-lock)** : si le wake-lock est ON, l'écran reste allumé (pas d'arrière-plan) ; s'il est OFF ou que l'utilisateur quitte vraiment, l'offline prend le relais. Les deux couvrent les deux intentions (« laisser tourner à l'écran » vs « fermer et récupérer en revenant »).
- **PWA** : vérifier que `vite-plugin-pwa` / le SW ne maintient pas un état « ouvert » trompeur ; la source de vérité de l'offline doit être l'**horodatage**, pas l'état d'exécution.

### F4 — Badge de niveau du joueur (retour externe)

Demande : un **badge avec logo affichant le niveau du joueur, entouré d'une barre d'XP** (anneau de progression circulaire) — pattern « vrai jeu ».

- **Élément HUD** : un badge circulaire **niveau au centre** (+ icône/logo, ex. l'archétype ou un sceau), **anneau d'XP** tout autour qui se remplit vers le niveau suivant (`xp / xpToNext`).
- **Emplacement** : en-tête du Héros (et mini-version dans le sélecteur multi-perso). Remplace/augmente l'affichage texte du niveau actuel.
- **Multi-perso** : un badge par héros (le niveau est par perso). Au survol/tap : `niv. N · XP a/b`.
- Détail : SVG (cercle de fond + arc de progression `stroke-dasharray`), réutilisable.

## Récapitulatif des arbitrages — TOUS TRANCHÉS ✅

| Réf | Décision figée |
|---|---|
| A | Abîme `tierOffset=+6` (récompense/check), difficulté inchangée, accès **T7×4**, palier 100 retiré |
| A1 | Affichage : **T1 + bandeau « ≈ Tier 7 mondial »** |
| B | Socle 5 leviers + 10 twists + panneau **Préparation** (**B1 : compact** + « tout voir ») |
| C1 | Sorts scalent sur la **stat dominante** (fin du mismatch Soif du néant) |
| C3 | Pathing libéré (Faucheur hors Voile d'ombre, 2ᵉ passerelle Pestiféré côté Agi, conversions Métamorphe parallèles) |
| C5 | **Adoucir** winner-take-all : `power = statPower(main + 0.2×second)` |
| C6/C7 | Clarté du profil de dégâts + fix layout Métamorphe (node incliquable) |
| C8 | **v0.27 = C1+C3+C6+C7** ; nouvelles abilities DoT (C2) → **v0.28** |
| D1 | Qualité = **5 paliers** ; nombre de stats **fixe par rareté** (plancher) + la **qualité ajoute des lignes** (+0/+0/+1/+1/+2) + budget |
| D2/D3/D4/D5 | Rareté/iLvl/qualité **sans clic** (surtout équipé) · tris iLvl/+DPS/+Survie · retard vs `maxContentIlvl` · fonderie = stats complètes · gemmes = aperçu au tap |
| E | Prestige reset **dur** + Relique · MVP 7 modules · **E1 : Abîme débloqué suffit** · métiers conservés |
| F | F1 wake-lock · **F2 rotation SUBIE + lock = Fragments d'éternité** · F3 offline sur cycle de vie · F4 badge de niveau |

**Chiffrages reportés à l'implémentation** (pas des blocages de design) : **E2** formule de gain d'Échos · **F2c** prix/durée du lock biome en Fragments.

## Ordre de chantier proposé (lots)

1. **Lot 1 — Abîme (A)** : `tierOffset`, accès T7×4, retrait palier 100. *(petit, fort impact, isolé)*
2. **Lot 2 — Inventaire/qualité (D1→D5)** : qualité unifiée + tris + iLvl/qualité visibles + fonderie + gemmes mobile. *(beaucoup de lisibilité, infra en partie là)*
3. **Lot 3 — Combat & survie (B)** : socle 5 leviers + twists + aperçu de survie. *(équilibrage, à éprouver en partie réelle)*
4. **Lot 4 — Stats/arbre (C1,C3,C6,C7)** : re-câblage scaling + pathing + clarté + fix layout. *(transverse, à valider build par build)*
5. **Lot 5 — Prestige (E)** : Éveil + Échos + Constellation + Relique (MVP 7 modules).
6. **Lot 6 — Confort & monde (F)** : wake-lock (F1) + offline sur cycle de vie (F3, **bug — prioritaire, peut remonter au Lot 1**) + badge de niveau (F4) + rotation subie des biomes & lock en Fragments (F2).
