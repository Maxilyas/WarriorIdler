# DESIGN v0.29 — REFONTE MASSIVE de l'arbre de talents (classes & mixing)

> Statut : **proposition** (non codé). Fait suite à l'audit de l'arbre v0.28.
> Objectif joueur : **beaucoup de classes**, **mixables librement**, **équilibre DPS / HEAL / TANK**,
> inspirées de **World of Warcraft**. Cible : **≥ 36 classes uniques**.
> Chiffres : `scripts/sim-classes.mjs` (DPS moteur-exact, stuff lvl 50 & lvl 150).

---

## 1. Les 4 problèmes à corriger (rappel de l'audit)

1. **Compétences prisonnières de l'arbre.** Aujourd'hui un sort signature est un nœud `ability`
   au fond d'une chaîne, verrouillé par le palier (5 pts/tier de profondeur) + prérequis maxés.
   → pour AVOIR la compétence, il faut acheter **toute la branche**. Le mixing est impossible.
2. **Redites massives** : 5 builds Agi-crit, 2 builds DoT-ombre, 6 keystones « tes coups font un DoT »,
   7 endroits qui « convertissent un type de dégât ».
3. **« Symbiose » (Métamorphe) & « Alchimiste »** = des *classes-plomberie* sans fantasy : juste des
   commutateurs de stats/types. → **supprimées**, la conversion part dans le stuff.
4. **Trous d'identité** : Froid, Nature, Surpuissance sans propriétaire ; **soin 100 % INT**.

---

## 2. Les 3 décisions structurantes

### 2.1 Découplage compétence ↔ profondeur (LE changement clé)

Nouvelle topologie en **3 couches** :

```
TRONC COMMUN (partagé)         →  stats de base + 2-3 sorts universels (Frappe, Onde, un soin mineur)
   │
   ├── NOYAU DE CLASSE ×36     →  ENTRÉE (1 pt) = sort signature + CHOIX du keystone d'identité
   │        (compact, 5-7 nœuds)   APPROFONDISSEMENT (optionnel) = stats + 2e keystone + capstone
   │
   └── PASSERELLES DE MIX      →  petits liens inter-noyaux qui débloquent des SYNERGIES de paire
```

Règles :
- **L'ENTRÉE d'un noyau (1 point) donne immédiatement** : le sort signature de la classe **et** le
  droit de choisir **un** keystone d'identité parmi 2-3. Plus besoin de gravir une branche.
- **Approfondir** un noyau (4-6 points de plus) donne des stats, un **2ᵉ keystone**, puis le **capstone**.
- Le **palier** ne force plus un chemin : il devient *« dépense N points DANS ce noyau »* (local),
  jamais *« 5 pts dans le tier exact d'en dessous »*. On achète ce qu'on veut dans le noyau.

### 2.2 Mixing : points globaux + budget de keystones

- Points de talent inchangés (1/niveau après 10) → **~140 pts au lvl 150**.
- Un noyau « complet » (entrée + approfondissement + capstone) ≈ **12-15 pts**.
  → 140 pts = **3 à 4 classes maîtrisées**, ou 1 classe + 6 entrées dippées. **Le mixing est natif.**
- **Garde-fou anti-soupe** : un perso ne peut avoir que **2 KEYSTONES D'IDENTITÉ MAJEURS actifs**
  à la fois (les capstones), comme on ne joue que 2 specs mêlées. Les entrées/sorts, eux, s'empilent.
  → un build = **1 identité dominante + 1 secondaire** (ex. Assassin/Affliction = poison + DoT d'ombre).

### 2.3 Rôles : **ancrés ET émergents** (ta réponse « les deux »)

- **Ancré** : chaque noyau porte une **étiquette de rôle** (DPS / HEAL / TANK) via son keystone.
  Prendre l'entrée « Prêtre sacré » annonce une intention de soin.
- **Émergent** : le rôle RÉEL en combat reste piloté par les **sorts équipés** (le moteur actuel —
  `charPassives`, menace, heal). Un noyau TANK joué avec des sorts DPS = bruiser. Un noyau HEAL
  splashé sur un DPS = soutien d'appoint. **On garde le système émergent, on AJOUTE l'ancrage.**

---

## 3. Rééquilibrage du MOTEUR (révélé par la simulation)

La simulation a mis au jour des défauts du moteur actuel qu'il faut corriger **avant** d'ajouter des classes,
sinon le déséquilibre se propage à 36 classes.

| Problème moteur (v0.28) | Effet mesuré | Correction proposée |
|---|---|---|
| **Maîtrise Agi → dégâts crit ×2/frac, NON capé** | écart DPS endgame **×3.40**, l'Agi explose | Agi : Maîtrise = **+0,6 dégâts/frac** + bonus crit **capé** `softCap(f×0.6, 0.8, 1.6)` (fini le runaway) ✅ **codé (Lot A)** |
| **Maîtrise Force = réduction (0 dégât)** | Force semblait **dernière** | En fait son levier EXISTE : Force-Maîtrise = **dégâts ×0,8 ET réduction** → le bruiser stacke la Maîtrise (dégâts + ×3 EHP). Une fois modélisé, Force remonte mid-pack (idx 106-118) ✅ |
| **Int trop fort** | glass cannon devant | Int : Maîtrise **0,9 → 0,8** (resserre l'écart) ✅ **codé (Lot A)** |
| **4 axes multiplicatifs** (power × mast × crit × hâte), accès inégal | une classe qui touche les 4 domine | **Chaque noyau garantit l'accès à crit + hâte + ampli** ; l'écart vient du keystone, pas de l'accès à un axe |
| **`degatsBoss` n'agit que vs boss** | builds exécution faibles en farm | appliqué à ~35 % d'uptime en farm ; l'UI doit montrer le **DPS-boss** à part (anti-boss brillent en donjon/raid) |

Après Lot A (codé dans `stats.ts`, validé au simulateur) : écart DPS **×1.67**, TANK **×1.41**, HEAL **×1.59**.
Cible long terme **< ×1.6** sur les DPS via tuning fin des keystones (les 2 specs « burst » en tête sont OK).

### 3.1 La conversion de type quitte les classes → va dans le STUFF

Les 7 mécaniques « convertis/splash ton type » sont retirées des classes et **regroupées dans l'itémisation** :
- **Gemmes de transmutation** (châsses) : « +X % de tes dégâts comptent aussi comme Feu ».
- **Runes d'arme** : « convertit 50 % du type de l'arme en Givre ».
- C'est là que ça a un sens (s'adapter aux résistances d'un boss = un choix d'**équipement**, pas de classe).
- Bénéfice : libère un énorme espace de design, supprime Métamorphe & Alchimiste **en tant que classes**,
  et la diversité de types reste accessible à TOUS les builds (un Berserker peut se « Feu » via gemmes).

---

## 4. Les 4 stats primaires & ce qui scale (rappel pour le catalogue)

| Stat | DPS scale | Rôle naturel | Secondaires reines |
|---|---|---|---|
| **Force** | mêlée lourde, exécution | DPS bruiser / Tank | Crit, Hâte, Dégâts boss |
| **Agilité** | crit & vitesse, DoT physiques/nature | DPS / Tank agile / Heal mêlée | Crit, Dégâts crit, Hâte, Multifrappe |
| **Intelligence** | sorts, DoT élémentaires | DPS caster / Heal | Maîtrise, Crit, Altération |
| **Endurance** | (via conversion) | Tank | Réduction, Barrière, Résistances |

**Levée du gap soin** : on AUTORISE des soins qui scalent FOR (Paladin sacré, soin via Force/attaque)
et AGI (Tisse-brume, *fistweaving* : attaquer soigne). Confirmé jouable par la simulation (HPS corrects).

---

## 5. CATALOGUE DES 36 CLASSES

Légende : **idx** = DPS endgame relatif (100 = médiane de la catégorie, simulateur rebalancé).
Chaque classe = 1 **stat**, 1 **type de dégât signature**, 1 **keystone d'identité**, des **secondaires clés**.

### 5.1 DPS — 22 classes (le gros du roster)

#### Famille FORCE (mêlée)
| Classe | Inspi WoW | Type | Secondaires | Keystone d'identité | idx |
|---|---|---|---|---|---|
| **Armes** | Arms Warrior | Physique | Dégâts boss, Crit | **Exécution** (×dégâts sous 35 % PV) | 86 |
| **Fureur** | Fury Warrior | Physique | Hâte, Multifrappe | **Berserk** (+dégâts sous 50 % PV) + multifrappe | 79 |
| **Vindicte** | Ret Paladin | Arcane (sacré) | Crit, Dégâts boss | **Verdict** (burst + bonus boss) | 78 |
| **Profanateur** | Unholy DK | Ombre/Nature | Altération | **Peste** (maladie DoT + propagation) | 87 |
| **Givre-mort** | Frost DK | **Froid** | Crit, Multifrappe | **Brisure** (exécute les ralentis/gelés) | 69 |

#### Famille AGILITÉ
| Classe | Inspi WoW | Type | Secondaires | Keystone d'identité | idx |
|---|---|---|---|---|---|
| **Tireur d'élite** | MM Hunter | Physique | Crit, Dégâts crit, Précision | **Tir parfait** (gros crit + exécution) | 136 |
| **Lame des ombres** | Sub Rogue | **Ombre** | Crit, Dégâts crit | **Ouverture** (×1,8 en début de combat) | 133 |
| **Traqueur du Fléau** | Havoc DH | **Feu** (chaos) | Crit, Hâte | **Métamorphose** (+dégâts soutenu) | 116 |
| **Maître des bêtes** | BM Hunter | Nature | équilibré | **Meute** (familier : DPS passif idéal idle) | 106 |
| **Assassin** | Assa Rogue | **Nature** (poison) | Altération | **Toxines** (gros DoT poison) | 100 |
| **Flibustier** | Outlaw Rogue | Physique | Hâte, Multifrappe | **Coup de dés** (multifrappe + **Surpuissance**) | 96 |
| **Druide félin** | Feral Druid | **Nature** (saignement) | Altération | **Lacération** (DoT saignement empilé) | 91 |
| **Pisteur** | Survival Hunter | Nature/Feu | Altération, Crit | **Pièges** (DoT + burst hybride) | 87 |
| **Marche-vent** | Windwalker Monk | Physique | Hâte, Multifrappe | **Combo** (enchaînements rapides) | 79 |
| **Chaman amélioration** | Enh Shaman | **Foudre** (mêlée) | Hâte, Multifrappe | **Surcharge** (procs foudre en mêlée) | 78 |

#### Famille INTELLIGENCE (sorts)
| Classe | Inspi WoW | Type | Secondaires | Keystone d'identité | idx |
|---|---|---|---|---|---|
| **Destructeur** | Destro Warlock | **Feu** (chaos) | Maîtrise, Crit | **Cataclysme** (burst + **Surpuissance**) | 125 |
| **Pyromancien** | Fire Mage | **Feu** | Maîtrise, Crit | **Embrasement** (crit → DoT de feu) | 117 |
| **Lunaire** | Balance Druid | Arcane/Nature | Maîtrise, Crit | **Éclipse** (alternance qui monte en puissance) | 117 |
| **Cryomancien** | Frost Mage | **Froid** | Maîtrise, Précision | **Gel** (ralentit + exécute les gelés) | 117 |
| **Arcaniste** | Arcane Mage | **Arcane** | Maîtrise, Récupération | **Surpuissance arcanique** (spam de sorts, CDR) | 106 |
| **Invocateur** | Demo Warlock | Ombre/Feu | Maîtrise | **Légion** (démons : DPS passif idle) | 104 |
| **Élémentaliste** | Ele Shaman | **Foudre** | Maîtrise, Crit | **Foudre en chaîne** (arcs multi-cibles) | 102 |
| **Dévastateur** | Deva Evoker | **Feu** | Maîtrise, Crit | **Souffle** (sorts à charge/empowered) | 102 |
| **Démoniste de l'effroi** | Affli Warlock | **Ombre** | Altération | **Fléaux** (multi-DoT, Altération reine) | 100 |
| **Ombremancien** | Shadow Priest | **Ombre** | Altération, Crit | **Folie** (DoT qui montent en intensité) | 90 |

> **Surpuissance** (stat rare, mult universel) trouve ses propriétaires : **Flibustier** & **Destructeur**
> (gameplay « chaos/RNG » qui paie gros). **Froid** : Cryomancien + Givre-mort (thème *brisure/gel* →
> keystone d'exécution sur cible ralentie). **Nature** : Assassin, Félin, Pisteur, Profanateur (DoT/poison/saignement).

### 5.2 TANKS — 7 classes
| Classe | Inspi WoW | Stat | Type | Mitigation signature | idx DPS |
|---|---|---|---|---|---|
| **Gardien** | Prot Warrior | Force | Physique | Blocage + **épines** | 90 |
| **Croisé-Bouclier** | Prot Paladin | END→Int | Arcane | **partage** de réduction au groupe | 91 |
| **Chevalier de sang** | Blood DK | Force | Ombre | **auto-soin** (vol de vie tank) | 92 |
| **Maître brasseur** | Brewmaster Monk | Agilité | Nature | **report** des dégâts (stagger) + esquive | 125 |
| **Gardien sylvestre** | Guardian Druid | Endurance | Nature | **gros PV** + régén, dégâts à PV hauts | 100 |
| **Chasseur de démons** | Vengeance DH | Agilité | Feu | **vol de vie** + brise-armure + épines | 132 |
| **Colosse / Égide** | Juggernaut | END→Force | Physique | **résistances** → dégâts, immuable | 121 |

> Les tanks font **~30-45 % du DPS** d'un DPS pur (taxe survie), avec **×4 l'EHP** — sains pour l'idle solo.
> Les deux tanks Agi (Brasseur, Vengeance) sont volontairement les **bruisers** (DPS haut, mitigation active).

### 5.3 HEALERS — 7 classes (dont 2 NON-INT, le gap comblé)
| Classe | Inspi WoW | Stat | Type | Style de soin | HPS idx | DPS idx |
|---|---|---|---|---|---|---|
| **Prêtre sacré** | Holy Priest | Int | Arcane | gros soins directs + HoT | ★★★ | 100 |
| **Disciple** | Disc Priest | Int | Ombre | **soigne en infligeant** (atonement) | ★ | 111 |
| **Druide réparateur** | Resto Druid | Int | Nature | **HoT empilés** (soin sur la durée) | ★★ | 71 |
| **Chaman restaurateur** | Resto Shaman | Int | Foudre | **soin en chaîne** (multi-cible) | ★★ | 101 |
| **Préservateur** | Pres Evoker | Int | Feu | soins **à charge** (empowered) | ★★★ | 99 |
| **Paladin sacré** | Holy Paladin | **Force** | Arcane | **soin par l'attaque** (puissance sacrée) | ★★ | 80 |
| **Tisse-brume** | Mistweaver Monk | **Agilité** | Nature | **fistweaving** : attaquer = soigner | ★★ | 114 |

> **Mistweaver (Agi)** et **Paladin sacré (Force)** prouvent (simulation) qu'on peut soigner sans INT :
> ils attaquent ET soignent. **Disciple** est l'hybride heal↔dps (reprend l'« Oracle sanglant » mais
> avec une vraie fantasy WoW). Les soins gardent un scaling sur la **stat principale** du noyau.

---

## 6. RÉSULTATS DE SIMULATION (DPS moteur-exact)

Hypothèses : stuff **ciblé** (le joueur craft ses stats), identité par **keystones**, bonus conditionnels
à uptime moyenne. Stuff MID = lvl 50 / iLvl 75 / Épique. Stuff END = lvl 150 / iLvl 225 / Mythique.

**Écarts (après Lot A)** : DPS **×1.67** · TANK **×1.41** · HEAL **×1.59**.
**Avant correctif moteur** : DPS **×3.40** (l'Agi écrasait tout).
> Les ratios entre classes sont **invariants au budget** (toutes reçoivent le même stuff) → ils tiennent
> même si v0.30 (cap iLvl 700, rareté aplatie) change les valeurs absolues. Re-run du sim à prévoir alors.

### 6.1 Hybrides simulés (le mixing en chiffres)
| Build (mix de 2 classes) | Stat | DPS MID (lvl 50) | DPS END (lvl 150) | Idée |
|---|---|---:|---:|---|
| **Lame-Sang** (Sub Rogue × Affliction) | AGI | 16 200 | **1 090 000** | ouverture burst + DoT d'ombre qui tourne |
| **Pyro-Boss** (Fire Mage × Arms) | INT | 20 600 | **997 000** | feu soutenu + exécution sous 35 % PV |
| **Arcane-Surp** (Arcane × Destro) | INT | 16 600 | **903 000** | spam de sorts + Surpuissance |
| **Assassin-Vitesse** (Assa × Windwalker) | AGI | 17 500 | **758 000** | poison + multifrappe |
| **Berserker-Givre** (Fury × Frost DK) | FOR | 16 900 | **607 000** | enrage bas-PV + brisure des gelés |
| **Croisé-DPS** (Prot Pal × Ret) | FOR | 9 500 | **256 000** | tank-DPS : survit ET tape (rôle hybride) |

→ Les meilleurs hybrides **dépassent** les classes pures : c'est voulu, le mixing est une **récompense
de maîtrise** (combiner deux fenêtres de burst/DoT), pas un piège. Le garde-fou « 2 keystones majeurs »
empêche d'empiler 4 multiplicateurs.

---

## 7. Ce qu'on SUPPRIME / DÉPLACE

| Élément v0.28 | Devenir |
|---|---|
| **Métamorphe** (constellation « conversion », nœud « Symbiose ») | **supprimé** — conversions → stuff (gemmes/runes) |
| **Alchimiste** (transmutation) | **supprimé** — idem |
| keystone « Symbiose » de l'Oracle | renommé/refondu (le mot disparaît) |
| 6 keystones « tes coups font un DoT » quasi clonés | **1 mécanique paramétrée**, instanciée par classe (poison/feu/ombre/saignement) |
| 7 conversions de type éparpillées | **gemmes/runes de transmutation** |
| Passerelles confuses | **passerelles de mix** lisibles (synergies de paire) |

---

## 8. Roadmap d'implémentation (lots)

1. **Lot A — Moteur** : rééquilibrer la Maîtrise (3 stats à 0,75 ; cap crit Agi), donner un levier de
   dégâts à Force, exposer le **DPS-boss** séparé dans l'UI. *(petit diff, gros impact ; testable au sim)*
2. **Lot B — Itémisation** : gemmes/runes de **transmutation de type** (récupèrent la conversion).
3. **Lot C — Données de classes** : réécrire `talents.ts` en **36 noyaux compacts** (entrée = sort +
   keystone, approfondissement optionnel). Supprimer Métamorphe/Alchimiste.
4. **Lot D — Système de points & mix** : palier local (« N pts dans le noyau »), garde-fou **2 keystones
   majeurs**, UI de mix (voir quelles paires se débloquent).
5. **Lot E — Sorts** : étendre `powers.ts` (familier/Meute & Légion pour l'idle, soins Force/Agi,
   sorts à charge/empowered). Mécanique DoT unifiée paramétrée.
6. **Lot F — UI arbre** : refonte de l'écran (36 noyaux navigables, filtrage par rôle, presets de mix).
7. **Lot G — Migration des saves** : reset des talents offert (respec gratuit one-shot à la MAJ).

---

## 9. Questions ouvertes pour toi

1. **36 classes d'un coup** ou on **commence par ~12-15** (4-5 par rôle) puis on étend ?
2. Le garde-fou **« 2 keystones majeurs »** te convient, ou tu veux laisser empiler librement (au risque
   de soupes très fortes) ?
3. Les **familiers/invocations** (Meute, Légion) : DPS passif simple (un % du tien) ou vraie 2ᵉ barre ?
4. On garde les **ultimes** (10 sorts à long CD) et on les rattache aux nouveaux noyaux ?
