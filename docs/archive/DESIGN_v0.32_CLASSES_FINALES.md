# DESIGN — 5 DERNIÈRES CLASSES (v0.32)

> Spec d'implémentation des classes restantes : **Paladin, Chevalier de la mort, Chaman, Druide, Démoniste**
> (≈12 archétypes). Suit le gabarit du handoff (`DESIGN_v0.29_CLASSES_HANDOFF.md`) : 1 sort de départ au hub,
> sorts forts gatés (`minSpent`), **nœuds tampon `maxRank 5` (`requiresRank @5`) sur chaque branche**,
> puissance brute (DR/épines/+%dégâts/vol de vie) gatée, scaling sur la stat dominante, 1 **gameplay unique**
> par archétype. Réutilise un MAXIMUM les mécaniques existantes ; **1 seul nouveau keystone** : `damageToHeal`.

## Mécaniques RÉUTILISÉES (rappel)
combo (`char.combo`, build/spend, libellé `resource`) · `dot`/`dotAoe`/`dotLeech` · venin (`poison`/`detonate`) ·
`controle`+`shatter` · `petDps` (invocation) · `chainArc`+`staticN` (foudre) · `frenzy` · `finisherShield` ·
`healToDamage` (soigne en frappant… non : une part du SOIN frappe) · `hot` · `thorns`/`flatDr`/`highHpBonus`/`executeBonus` ·
`tagBonus` (cross-classe) · `igniteOnCrit`/`hotStreak`/`overload` (Mage). `gen` (ressource/lancement).

## NOUVEAU keystone (1 seul)
- **`damageToHeal?: number`** (PALADIN Aube) : une fraction de TES DÉGÂTS soigne l'allié le plus blessé. C'est
  l'inverse de `healToDamage` → un **healer qui soigne en TAPANT** (scale FORCE), distinct de Lumière (qui tape
  en soignant). Résolu dans `fireActive`/les 2 pas de combat (après `hit`), estimé en fiche.

---

## ☠ CHEVALIER DE LA MORT (Plaque) — ressource « Puissance runique »
Mort, givre, sang. Mêlée FOR. 100% réutilisation (aucun nouveau keystone).

### Givre-mort (DPS) — *contrôle de mêlée → fracas runique + exécution*
- **Particularité** : version MÊLÉE/FOR du givre (le Cryo est INT/sorts). Tu RALENTIS/gèles (`controle`) puis tu
  **fracasses** (`shatter`) et **exécutes** (`executeBonus`) les cibles contrôlées, via une rotation de Puissance
  runique (combo) + **multifrappe** runique.
- **Boucle** : générateur runique → geler (Souffle givrant, `controle`) → finisseur Oblitération qui ×combo et
  exécute les gelés. EASY = ralentir+frapper ; HARD = caler Oblitération quand la cible est gelée ET basse.
- **Mécaniques** : combo (Puissance runique) ; `controle` (sorts froid) ; `shatter` ; `executeBonus` ; `multistrike`.
- **Sorts** : dk_givre (builder froid, gen 1) · dk_obliteration (finisher froid, exécute) · dk_souffle (cleave froid
  `controle`) · dk_pilier (gros nuke froid mono, gaté) · dk_apocalypse (ULTIME megaCleave froid).
- **Branches & tampons** : SIGNATURE (runique→shatter→Oblitération→ult, tampon avant le gros nuke) · CONTRÔLE
  (geler + multifrappe, tampon avant 2e sort) · SURVIE (plaque, tampon = mineur maxRank5).

### Sang (TANK) — *tank vampire : encaisser → drainer → bouclier d'os*
- **Particularité** : tank qui se SOIGNE de ses dégâts/DoT et érige un **bouclier d'os** (`finisherShield`,
  cooldown 30 s déjà codé). Plus il prend cher, plus il rend (lifeNuke + dotLeech).
- **Mécaniques** : `lifeNuke` (Coup runique = drain) ; `dotLeech` ; `finisherShield` (bouclier d'os) ; `flatDr` ;
  `thorns` ; provocation (menace).
- **Sorts** : dk_coup_runique (lifeNuke, drain) · dk_sang_builder (builder Rage/Puissance) · dk_marque_sang
  (finisher → bouclier d'os) · provocation (réutilisé) · egide (réutilisé, ULTIME).
- **Tampons** : BOUCLIER (mineur maxRank5 → bouclier d'os) · DRAIN (mineur5 → dotLeech) · MENACE/épines (mineur5).

---

## ⚜ PALADIN (Plaque) — ressource « Pouvoir Sacré » (partagée 3 specs)
Sacré (arcane). Trinité complète. 1 nouveau keystone (`damageToHeal`, pour Aube).

### Croisé (DPS) — *Pouvoir Sacré → Jugement + fenêtre d'Ailes*
- **Particularité** : build/spend arcane (Jugement = finisseur sacré) + **Croisade** : une fenêtre de burst
  (`frenzy`) sur cooldown — l'identité « ailes de vengeance ». EASY = build/Jugement ; HARD = aligner Croisade.
- **Mécaniques** : combo (Pouvoir Sacré) ; finisher arcane ; `frenzy` (Croisade) ; tagBonus arcane/finisseur.
- **Tampons** : SIGNATURE (build→Jugement→Croisade→ult) · DIRECT (2e sort) · SURVIE.

### Templier (TANK) — *aura de partage de résistance + zone consacrée*
- **Particularité** : LE tank de soutien — partage sa **résistance à l'équipe** (`shareResist`, déjà codé,
  identité Égide) + **épines** + provocation + une zone (Consécration = cleave qui tient le pack).
- **Mécaniques** : `shareResist` ; `thorns` ; `flatDr` ; `finisherShield` ; provocation.
- **Tampons** : AURA (mineur5 → shareResist) · CONSÉCRATION (mineur5 → 2e sort) · BLOCAGE (mineur5).

### Aube (HEAL) — *soigne en FRAPPANT (scale FORCE) — `damageToHeal`*
- **Particularité** : healer **offensif** unique — `damageToHeal` : une part de tes dégâts soigne l'allié le
  plus blessé. Tu joues comme un DPS Force et l'équipe est soignée. Inverse de Lumière (Prêtre). + soins directs
  (Imposition des mains) en pic.
- **Mécaniques** : NOUVEAU `damageToHeal` ; heal/buffParty (pics) ; combo (Pouvoir Sacré → gros soin sur CD).
- **Tampons** : VERDICT (mineur5 → damageToHeal) · LUMIÈRE (mineur5 → soins) · SURVIE.

---

## ⚡ CHAMAN (Mailles) — ressource « Maelström »
Éléments. 100% réutilisation.

### Élémentaire (DPS) — *foudre en chaîne + Surcharge de Maelström*
- **Particularité** : **foudre en chaîne** (`chainArc`, déjà codé) qui rebondit sur le pack + **Surcharge**
  (`staticN` : toutes les N attaques, la suivante ×mult) — procs satisfaisants. Maelström (combo) pour le gros
  sort (Salve de lave). EASY = foudroyer ; HARD = consommer les procs de Surcharge au bon moment.
- **Mécaniques** : `chainArc` ; `staticN` ; combo (Maelström) ; tagBonus foudre/zone.
- **Tampons** : SIGNATURE (chaîne→Surcharge→ult) · MAELSTRÖM (2e sort) · SURVIE.

### Vague (HEAL) — *soin en chaîne + totem (HoT passif)*
- **Particularité** : **soin de groupe en chaîne** (buffParty/bigHeal) + **totem de soin** = `hot` keystone
  (HoT passif d'équipe, « Totem de jouvence ») + `healToDamage` léger pour solo. EASY = soin de groupe ; HARD =
  poser le totem avant le burst de dégâts ennemi.
- **Mécaniques** : heal/buffParty/bigHeal ; `hot` (totem) ; `healToDamage` (solo).
- **Tampons** : TOTEMS (mineur5 → hot) · CHAÎNE (mineur5 → soin de groupe) · SURVIE.

---

## 🐾 DRUIDE (Cuir) — sans ressource nommée unique (Pouvoir astral = combo pour Lunaire)
Polyvalent (3 rôles). 100% réutilisation.

### Lunaire (DPS) — *DoT astraux (Lune/Soleil) + Pouvoir astral → Plénitude*
- **Particularité** : pose 2 DoT (Lune=arcane, Soleil=nature) qui tournent, génère le **Pouvoir astral** (combo)
  et le dépense en **Plénitude** (gros finisseur arcane+nature). EASY = entretenir les 2 DoT ; HARD = lâcher
  Plénitude à combo plein avec les 2 DoT actifs. (L'« Éclipse » = la double-affinité arcane/nature.)
- **Mécaniques** : `dot` ; combo (Pouvoir astral) ; tagBonus arcane + nature ; `dotAoe`.
- **Tampons** : ASTRAL (DoT→Plénitude→ult) · ÉCLIPSE (2e sort) · SURVIE.

### Ronce (TANK) — *gros PV, épines, plus fort à PV hauts*
- **Particularité** : tank brut — énormes PV, **épines** (`thorns`), régén, et **+dégâts à PV hauts**
  (`highHpBonus`, déjà codé) → tu frappes fort tant que tu es plein. Provocation.
- **Mécaniques** : `thorns` ; `highHpBonus` ; `flatDr` ; regen ; provocation.
- **Tampons** : ÉCORCE (mineur5 → highHpBonus) · ÉPINES (mineur5) · RÉGÉN (mineur5).

### Floraison (HEAL) — *HoT empilés qui éclosent*
- **Particularité** : **HoT** soutenus (`hot`) + soins de groupe ; régén d'équipe constante. EASY = entretenir
  les HoT ; HARD = anticiper les dégâts (les HoT préposés). + `healToDamage` léger.
- **Mécaniques** : `hot` ; buffParty/bigHeal ; `healToDamage`.
- **Tampons** : FLORAISON (mineur5 → hot) · POLLEN (2e sort) · SURVIE.

---

## 💀 DÉMONISTE (Tissu) — ressource « Âmes » (combo, pour Pestilence)
Afflictions & démons. 100% réutilisation (réutilise venin pour Pestilence).

### Pestilence (DPS) — *multi-DoT d'ombre → drain qui détone tout*
- **Particularité** : empile des **fléaux** (venin ombre, `poison`) sur la cible, les propage au pack
  (`dotAoe`) puis **détone** tout (`detonate`) d'un drain. Version INT/ombre de l'Assassin (≠ : caster, ombre,
  propagation pack). EASY = poser les fléaux ; HARD = détoner au pic de stacks sur tout le pack.
- **Mécaniques** : `poison` (fléaux) ; `detonate` ; `dotAoe` ; `dotLeech` ; tagBonus ombre/dot.
- **Tampons** : FLÉAU (poison→détonation→ult) · CORRUPTION (2e sort) · DRAIN (survie).

### Légion (DPS) — *invoque des démons cumulés + Tyran qui les survolte*
- **Particularité** : **familiers démoniaques** (`petDps`, empilables) + **Tyran** : fenêtre de burst
  (`frenzy`/damageMult) qui survolte les démons. EASY = invoquer ; HARD = lâcher le Tyran quand la Légion est
  au max. (Idle-friendly : les démons tapent en continu.)
- **Mécaniques** : `petDps` (démons) ; `frenzy` (Tyran) ; tagBonus ombre/invocation.
- **Tampons** : LÉGION (démons→Tyran→ult) · MALÉFICE (2e sort) · SURVIE.

---

## ORDRE D'IMPLÉMENTATION
1. **Chevalier de la mort** (0 nouveau code) · 2. **Démoniste** (0) · 3. **Chaman** (0) · 4. **Druide** (0) ·
5. **Paladin** (+ keystone `damageToHeal`).
Après chaque classe : `npx tsc --noEmit` + `npm run validate` + `npm run check-classes` (étendre 1 cas/archétype).
