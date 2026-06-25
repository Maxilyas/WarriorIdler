# Difficulté & Équilibrage — Doctrine

> **Nature de ce document.** C'est une **doctrine de design** (la cible vers laquelle on tend), pas une
> description de l'état courant. Le **code fait foi** sur ce qui existe *aujourd'hui* ; ce qui est marqué
> **🎯 Cible** n'est **pas encore** implémenté. Chaque section distingue **Aujourd'hui (code)** de la
> **Cible**. À lire avant tout rééquilibrage ou ajout de contenu. Compléments : [`DESIGN.md`](DESIGN.md)
> (vision), [`systemes/07-donjons-et-raids.md`](systemes/07-donjons-et-raids.md) (raids tels qu'ils sont),
> [`../scripts/README.md`](../scripts/README.md) (harnais d'équilibrage).

---

## 0. Les deux problèmes qu'on sépare

Sous le mot « difficulté » se cachaient **deux problèmes distincts** qu'il faut traiter séparément :

- **(A) Équilibrage de PUISSANCE** — numérique, mesurable par le banc d'essai sur de vrais builds. Ici on
  **assume le snowball** : on règle pour que les raids gatent correctement et que le build *médian*
  progresse à bon rythme. Levier = knobs.
- **(B) Complexité PROGRESSIVE** — structurel. Faire en sorte que le **puzzle d'optimisation gagne des
  dimensions** en avançant. Levier = design de contenu/systèmes, pas knobs.

> **Le vrai mal diagnostiqué :** le jeu n'est pas trop *plat en puissance*, il est trop *plat en
> complexité*. Aujourd'hui tous les systèmes (gemmes, runes, quintessences, reforge…) sont disponibles
> **dès le début**, donc battre un raid au Chapitre 5 demande **la même optimisation** qu'au Chapitre 15.
> Toute la suite vise à corriger ça.

---

## 1. Philosophie du SNOWBALL (problème A)

**Position assumée : le snowball est DÉSIRÉ, dans des bornes.** Trouver un build « pété » optimisé qui
avance plus vite que la moyenne *est* une grande partie du plaisir ARPG/idle.

- **« Pété » = un build optimisé** (la puissance vient surtout de **l'arbre de talents**) qui rend le
  contenu plus simple et avance plus vite que les autres.
- **Spread toléré : jusqu'à ~×20** entre le top théorycraft et le médian, à fond optimisé. C'est *gros*,
  et c'est **voulu**.
- **Items / keystones build-defining = bienvenus** (des pics de puissance assumés, façon PoE), pas que
  des bonus additifs lissés.
- **Large éventail de builds forts**, avec un sommet assumé que les théorycrafteurs trouveront toujours.
- Le snowball peut aussi se **canaliser vers le rendement passif / l'automatisation** (idle-friendly).

### Le garde-fou qui RESTE (anti-bug, pas anti-build)

Relâcher le snowball **ne réintroduit pas** les bugs de scaling. L'invariant qui compte est un garde-fou
**anti-bug** :

> **Un multiplicateur plat ne s'applique qu'à une quantité BORNÉE.** (Pas de puissance *infinie* sur une
> quantité non bornée.) Cf. [`memory`/leçons] et les commentaires de `combatEngine.ts`.

Un spread énorme mais **borné** (×20) est sain ; un multiplicateur qui scale sur une quantité non bornée
est un bug. Les deux cohabitent.

### Les lignes rouges (non négociables)

1. **Plein de chemins viables au sommet.** Aucun build *obligatoire*. (PoE : le « forcé » est le péché
   capital ; la diversité de build est sacrée.)
2. **Jouable et compréhensible sur mobile.** Pas de friction d'UI/charge mentale excessive.

### Où vit le snowball

- **Zone de chasse = farm idle passif** : à terme elle se fait rouler dessus, c'est *voulu*. Pas un gate.
- **Raids = le vrai gate** où le build est testé.
- **Endgame** (Éveil/prestige + futurs contenus max) = là où **le build devient capital**.

### L'alerte du banc d'essai : cluster vs outlier (pas le ×20 brut)

Le problème n'est **pas** le spread absolu, c'est la **concentration**. ×20 est sain *s'il existe un
cluster de builds proches du sommet*. La vraie alerte =

> **Un outlier solitaire ×N au-dessus du 2ᵉ, seul à clear le contenu de pointe** = build obligatoire =
> violation de la ligne rouge n°1.

Le banc (`npm run bench`) doit donc mesurer **« cluster au sommet vs outlier isolé »**, pas le ratio brut.

---

## 2. Philosophie de la COMPLEXITÉ PROGRESSIVE (problème B)

**Cible : le puzzle d'optimisation doit GAGNER des dimensions en progressant.** Deux moteurs :

- **Faire évoluer le PROBLÈME** (levier principal, faible risque) : les outils restent, mais les raids
  exigent de les utiliser **différemment** en montant (cf. §3, §4). Early = « stacke ta stat + 1 résist » ;
  late = « orchestre des gemmes de condition + multi-résist + timing ».
- **Gater la PROFONDEUR par les ressources** : un système peut être *disponible* sans qu'on ait *les
  ressources de l'appliquer* — c'est le pattern Melvor/NGU (la complexité se révèle comme récompense, la
  rareté gate la profondeur). Early = peu de châsses/peu de gemmes de condition ; late = le système complet.

### Référence externe (recherche)

- **Idle (Melvor, NGU)** : la complexité se **révèle comme récompense**, jamais front-loaded ; UI quasi
  vide au début, systèmes qui **s'entremêlent** en avançant. La rareté des ressources + le pacing font le
  travail.
- **Last Epoch** : **soft-checks scalés > hard-locks** — pénétration ennemie progressive, -X% résist
  *linéaire* (pas le double-damage de Diablo), **shred réduit sur les boss pour préserver la viabilité**.
- **Path of Exile** : diversité de build **sacrée**, le contenu *forcé* détesté ; le bon endgame
  récompense **la connaissance des interactions de systèmes**, pas une recette unique.

### La courbe de leviers (cible, façon Melvor)

Pacing d'introduction **pour les NOUVEAUX comptes** (cf. §7 « ré-introduction »). Idée maîtresse :
**talents tôt** (le cœur du build), **gemmes de condition / pactes tard** (le combinatoire « si-alors »,
aujourd'hui amené trop tôt), **profondeur gatée par les ressources** partout.

| Tranche | Leviers actifs (cible) | Systèmes introduits | Pas encore |
|---|---|---|---|
| **Ch.1-5** — *apprends* | **2-3** : stat primaire · 1 résist · talents de base | Talents (tôt) ; 1 raid à **1 identité simple** ; gemmes basiques (1 châsse, off **ou** def) en fin de tranche | runes, quintessences, gemmes de condition, pactes, multi-résist, reforge |
| **Ch.6-10** — *compose* | **4-5** : +pénétration · +multi-résist (2 types) · +sockets | +pénétration ; sets 2-pièces ; runes (1 slot) ; reforge (ressources **rares**) ; **2 checks/raid** | gemmes de condition profondes, pactes, quints avancées |
| **Ch.11-15** — *optimise* | **6-7** : +gemmes de condition · +pactes · +quintessences · +timing défensif | Le « si-alors » arrive **maintenant** ; sets 4/6 ; **3 checks** ; uniques build-defining (tiers profonds) ; loadout-swap (présets) | — (tout l'arsenal est là ; la **profondeur** reste gatée par les ressources) |
| **Endgame** — *casse* | **7+ · ré-agencement** | Éveil/prestige rebat talents/constellation ; raids max = orchestration complète ; c'est ici que vivent le **×20** et le théorycraft | — |

---

## 3. Le méta-principe ANTI-INVALIDATION

**La règle d'or pour ne jamais rendre un build incapable de participer.** Quatre lois :

1. **Soft check, jamais hard lock.** Un boss fait *-X%* / *+X%* / un *cap*, **jamais** « immunité / 0 ».
   Tout build *participe*, juste moins efficacement s'il n'est pas adapté.
2. **Plusieurs contre-réponses par mécanique** (≥ 2-3, issues de systèmes différents) → **aucune stat
   obligatoire**. C'est ce qui produit « plein de chemins viables ».
3. **La réponse est une stat/un système qu'on a DÉJÀ**, juste mise en avant → s'adapter = re-régler son
   loadout, **pas** re-roll sa classe.
4. **Le check scale avec la puissance du joueur, plafonné** (riposte ∝ tes dégâts capée ; shred réduit sur
   les boss). → **c'est la soupape** qui réconcilie le snowball ×20 *sur le farm* avec des **raids
   honnêtes**.

> **Conséquence directe sur le tuning :** une mécanique qui dit « *impossible sans X* » (ex. `leech` =
> « sans burst, tu ne le tueras jamais ») **viole** ce principe. La corriger = la convertir en soft check
> (régen = *taxe* de DPS, pas un mur). Cf. §7.

---

## 4. Les 4 PILIERS DE RÔLE (raids)

### Aujourd'hui (code, `raids.ts`)

5 raids (forge, reliquaire, citadelle, nexus, abysse). Les **identités mécaniques existent déjà** (7
`RaidMechanicKind` : `berserk`/DPS · `nova`/EHP · `fortress`/pénétration · `leech`/burst · `swarm`/EHP de
groupe · `rotate`/multi-résist · `execute`/course). La complexité **monte déjà par tier** (5 visages de
boss/raid, « Éveillés » au-delà du T5). Les **exigences de résist montent par tier** (`raidReqs`). Mais :

- **Le loot est différencié par EMPLACEMENT, pas par RÔLE**, et il **chevauche** (Nexus *et* Reliquaire
  lâchent anneaux/bijoux/cou).
- **La colonne vertébrale est trop fine** : battre **un** raid suffit à passer le Chapitre → on ne touche
  jamais aux 3 autres mécaniques → **la diversité déjà codée est gâchée** (symptôme vécu : « je ne fais que
  la Forge »).
- **Lisibilité** : rien ne *dit* au joueur ce que chaque raid vérifie.

### 🎯 Cible : réassignation en piliers de rôle

3 raids deviennent des **piliers auto-renforçants** (chacun *exige* son axe et *récompense* ce même axe) ;
1 raid devient le **moteur build-defining** (il lâche les uniques qui permettent de casser les 3 autres).
Ça colle déjà aux emplacements + au lore + à la mécanique existante.

| Raid | Rôle | **Mécanique-IDENTITÉ (exclusive)** | Loot (cible) | Boucle |
|---|---|---|---|---|
| ⚒️ **Forge** | **OFFENSE** | **`fortress`** (armure/pénétration) | armes + affixes **offensifs** | exige du DPS perçant → récompense l'offense |
| 🏰 **Citadelle** | **DÉFENSE** | **`nova`** (burst de zone) | armures + affixes **défensifs** | exige de survivre → récompense la défense |
| 🌈 **Nexus** | **RÉSIST / utilitaire** | **`rotate`** (multi-élément) | accessoires de **résist** | exige de résister à tout → récompense la résist |
| 💍 **Reliquaire** | **UNIQUES / build-defining** | **`leech`** (rendu **SOFT**) | **taux d'unique taggé boosté** (voir ci-dessous) | lâche les uniques qui *reshapent* les 3 autres |
| 🕳️ **Abîme** | **CAPSTONE** (endgame) | **`swarm` + `execute` + le duo** | tout + set Régalia | gaté « les 4 raids à T10 » ; exige la maîtrise des 4 axes |
| — | **universel** | **`berserk`** (timer d'enrage, monte par tier) | — | le plancher « pas trop lent », **sur tous les raids** |

**Règle de précision (anti-dilution) :** *1 mécanique = 1 foyer.* On **dé-duplique** vs aujourd'hui
(`nova` quitte Nexus pour Citadelle seule ; `berserk` devient universel et non identitaire ;
`swarm`/`execute` deviennent le domaine de l'Abîme). Résultat : **4 identités franches + 1 taxe
universelle, zéro mélange.**

#### Les uniques de Reliquaire = un KNOB, pas une famille dédiée

Le système existe déjà : dans `uniques.ts`, les uniques **taggés** (les *build-defining* : conversions
[feu]/[zone]/[finisseur]…) ne tombent **qu'en donjon (5 %) et en raid (30 %)** via `TAGGED_DROP_RATE`. Les
raids sont **déjà** la source des uniques qui cassent le build.

> **🎯 Cible :** différencier le taux **par raid** — **Reliquaire = taux taggé fortement boosté / unique
> quasi-garanti**, les 3 autres raids = leur gear de rôle avec un taux **réduit**. Simple knob, fidèle à
> « ajuster = toucher un knob ». **Ne pas** créer de famille d'objets uniques séparée.

#### Équilibré = le FARM ; les raids = les EXTRÊMES

Les objets ont 3 orientations (`ORIENTATION_FRAC = { offensif: 0.82, equilibre: 0.55, defensif: 0.3 }`).

> **🎯 Cible :** la **zone de chasse (idle) lâche du gear ÉQUILIBRÉ** (le généraliste qui porte tôt) ; les
> **raids lâchent les extrêmes** (Forge pur offensif, Citadelle pur défensif, Nexus résist). La progression
> *« généraliste équilibré → spécialisé extrême »* **EST** la montée de complexité, et donne enfin une
> *raison d'aller en raid* : la version extrême d'un axe que le farm ne peut pas donner.

---

## 5. Les 3 LEVIERS DU JOUEUR : arbre · gear · composition

| Levier | Rôle | Caractère |
|---|---|---|
| **Arbre de talents** | **PRIMAIRE / engagé** : ton identité de build, d'où vient la puissance | choix lourd ; peut hyper-spécialiser même avec du stuff équilibré |
| **Gear de pilier (raid)** | **SECONDAIRE / flexible** : **patche l'axe qui te manque sans respec** | un glass-cannon (arbre DPS) farme l'armure Citadelle pour survivre à la nova **sans** abandonner son arbre |
| **Composition d'équipe** | **endgame** : trinité tank/DPS/heal, chacun maître d'un axe → l'équipe couvre les 4 | **optionnel**, pas obligatoire |

### La trinité tank/DPS/heal (🎯 endgame de composition)

C'est la clé de voûte du endgame. Le problème « un build couvre-t-il 4 axes exigeants à la fois ? » devient
trivial en raisonnant **équipe** : le **tank** porte l'axe Citadelle, le **DPS** l'axe Forge, le
**heal/support** la soutenance (+ Nexus), Reliquaire amplifie. Une équipe composée **couvre naturellement
les 4 piliers**, chaque membre **spécialiste** au lieu d'un solo étalé.

**Infra existante :** 1-3 héros (`raidPartyHpMult`), aggro/menace (`provocation`, `threatMult`), archétypes
tank (Rempart) / heal (Aube, Templier) / DPS dans l'arbre.

**Garde-fous (sinon ça casse) :**
1. **Optionnel, jamais obligatoire** : un solo fort doit rester capable de faire les raids (ligne rouge n°1).
2. **Déblocage paced** : le 2ᵉ/3ᵉ perso s'ouvre progressivement (chantier « ré-introduction », §7).
3. **Complexité dans la COMPO/le gear, PAS l'exécution** (c'est idle : l'IA joue, le skill = composer/gear).

---

## 6. La PORTE DE PROGRESSION : gate à largeur croissante

**Le raid reste la porte du Chapitre** (la zone de chasse se fait rouler dessus à terme). Le défi : un
débutant est faible **partout** (offense ET défense ET résist), donc exiger les 4 raids tôt = mur × 4 ;
mais ne jamais les exiger = complexité plate. La solution **épouse la courbe de compétence** :

### 🎯 Le nombre de raids exigés GRANDIT avec la progression

| Tranche | Raids exigés pour passer le Chapitre | Pourquoi |
|---|---|---|
| **Ch.5-7** | **1** — *le joueur choisit lequel* | débutant faible partout → on n'exige que son **axe le plus fort** |
| **Ch.8-10** | **2** | a farmé du gear → couvre un 2ᵉ axe |
| **Ch.11-13** | **3** | spécialise / commence à composer une équipe |
| **Ch.14+** | **les 4** → puis l'**Abîme** | maîtrise complète = endgame de composition |

- **Le joueur choisit lesquels** (ses N meilleurs axes d'abord). Le **1ᵉʳ raid (N=1) est libre.**
- Le raid **poussé au front** pour le loot peut monter plus haut ; l'avancement ne réclame que **N raids au
  tier qui garde le Chapitre** (les autres restent en retrait → **jamais hard-stuck** sur les 4 au front).
- **Ça matérialise la courbe de leviers** (§2) : la *largeur* d'axes exigée = le nombre de leviers actifs.
- **Lève l'ancien malaise** : on n'avance sur un seul raid *qu'au tout début* (onboarding obligé), puis ça
  s'élargit — alors qu'avant ça restait *un seul raid tout le jeu*.

### La PRÉCONDITION non négociable

Le gate ne marche que si **les bas tiers (T1-T2) de CHAQUE raid sont battables par un généraliste du
Chapitre** (gear de farm équilibré, sans spécialisation). À T1, la mécanique-identité **bite à peine**
(soft-check au minimum) et monte par tier. Sinon le **bootstrap** d'un axe est impossible (il faut le gear
résist pour faire Nexus T1, mais Nexus T1 lâche le gear résist). **Ordre impératif : tuner les T1 gentils
→ PUIS poser le gate.** Le banc (vrais builds) mesure « T1 de Nexus mure-t-il un généraliste du Ch.5 ? ».

### Ancrages existants (code)

Aujourd'hui : raids débloqués à la vague 50 (Ch.5) ; le Raid T (mondial) garde le mur du Chapitre (T+4) ;
boss = un cran au-dessus du mur (`RAID_HP_VS_MUR 1.8` / `RAID_DMG_VS_MUR 1.4`) ; l'Abîme exige déjà les 4
raids de base à T10 (`requiresAllTier`). La largeur croissante se branche **par-dessus** ces ancrages.

---

## 7. Doctrine de TUNING

Tuner « pour que ce ne soit pas déséquilibré » se fait **par principe**, pas au feeling :

1. **Convertir les hard locks en soft checks** : `leech` = régen qui *taxe* le DPS (pas « impossible sans
   burst ») ; `fortress` = la pénétration *aide fort* (pas obligatoire). Tout build *participe*.
2. **Bas tiers généraliste-battables** : T1-T2 de chaque raid passables par un build raisonnable de
   **n'importe quelle spé d'arbre** → le bootstrap de chaque axe marche.
3. **Équivalence à tier égal** : les 4 ont aujourd'hui `baseDifficulty: 1.0` mais des mécaniques d'inégale
   punition. On **mesure quel raid mure le build médian et à quel tier** (banc/distribution) → tuning
   *objectif*.
4. **Calibrer contre des builds SPÉCIALISÉS par l'arbre** : l'arbre domine la puissance et peut
   hyper-spécialiser même avec du stuff équilibré → c'est pour ça que le banc teste de **vrais builds
   (arbre + gear)**, là où un sim synthétique mentirait.
5. **Lisibilité** : la fiche de boss montre déjà les résist requises (`raidReqs`) ; il manque le *« il te
   manque du burst/EHP/résist → va farmer X »*.

### Ré-introduction des systèmes (chantier parallèle)

Aujourd'hui l'arsenal (gemmes/runes/quintessences/reforge) arrive **trop tôt, mal amené** (« j'acquiers des
gemmes sans comprendre comment/pourquoi »). 🎯 Cible : chaque système **arrive quand un raid le réclame**,
**introduit un par un**, sa **profondeur gatée par les ressources** (§2). **Pacing appliqué aux NOUVEAUX
comptes uniquement** — on ne re-verrouille pas l'acquis des parties en cours.

---

## 8. L'ÉCONOMIE qui lie les 4 piliers

Aujourd'hui : Trophées (monnaie de passage de tier, **par raid**), Fragments d'éternité ✨, Éclats
cosmiques 💫 (exclusifs aux raids). 🎯 Cible : une **essence partagée** + le principe que **les 4 se
nourrissent** — p. ex. les **uniques de Reliquaire se montent avec des matériaux des 3 autres** → on touche
naturellement aux 4 piliers, **sans cadenas**. (Surtout de l'implémentation ; le *principe* est ici.)

---

## 9. STRATÉGIE DE TEST : mesurer la difficulté sur de VRAIS builds

L'équilibrage de difficulté se pilote sur des **builds réels**, pas synthétiques (les sims de combat à
builds générés ont été retirés — non représentatifs ; cf. [`../scripts/README.md`](../scripts/README.md)).

### Source de données : le SAVE EXPORT > le code WIB1

Le code `WIB1:` (Simulateur → Partager) encode un `SimConfig` *choisi* — sans vérité terrain. Le **save
export** (Réglages) contient le `SaveData` complet : **vrais** persos (stuff/talents/gemmes/runes réels),
**bestStage**, **raidProgress/dungeonProgress** (ce qui a été *réellement* battu), mods de compte, économie.
`save-audit.mjs` sait **déjà** l'ingérer et faire tourner le vrai moteur dessus.

> **🎯 Cible :** corpus de difficulté **bâti sur des save exports** (réels + ground-truthed), bucketisés par
> bande de progression. Garde-fous : **anonymisation** (retirer pseudo/cosmétiques), **panel de testeurs**
> (série temporelle = on voit où les gens **décrochent**), **filtre de plausibilité** (`sanitizeRaw`).
> Garder en parallèle WIB1/leaderboard pour le partage social.

### Le harnais de distribution (extension de `npm run bench`)

Au lieu de scanner le max par build : rejouer **tout le corpus** contre une **grille fixe** (chaque tier de
raid, niveau de donjon, mur de chapitre) et sortir, **par contenu** : taux de clear (%), TTK médian/p25/p75,
marge de survie (TTD÷TTK), **répartition mur DPS vs survie**, et **les keystones/uniques que partagent les
clearers** (détection de build dominant). **Verdict** par pièce : *trop dur / sur cible / trop facile*.

### Calibrer le sim contre la réalité

Le sim suppose un **jeu parfait** → ~+1 tier optimiste (constaté par `save-audit`). La vérité terrain
(bestStage/tiers réellement battus) permet de **mesurer cet offset** et de le corriger en lisant les
verdicts (ou via un mode « jeu réaliste »).

### Décider : CONTENU ou PUISSANCE JOUEUR

Deux axes lus dans la distribution — le **niveau** (le médian atteint-il la cible ?) et la **dispersion**
(cluster vs outlier, §1).

| Symptôme | Diagnostic | Levier |
|---|---|---|
| Médian sous la cible, dispersion OK | trop dur (uniforme) | **Contenu** (selon mur : survie → nova/résist requises ; DPS → enrage/PV) ou **joueur** (budget d'objet/rareté **sur la bande**) |
| Médian faceroll | trop facile | monter les mêmes knobs |
| **Outlier solitaire** au sommet | **déséquilibre de BUILD** | **Joueur** : nerf du levier dominant (`talents.ts` keystone / `uniques.ts`) **ou** buff des sorts jamais choisis ; **pas** le contenu |
| Mur = survie partout | check défensif trop dur | `novaReqAt`, résist requises |
| Mur = DPS partout | enrage/PV trop hauts | timer d'enrage, PV de tier |

> **Préférence par défaut :** toucher le **contenu** en priorité (invisible, ne casse pas les builds
> existants) ; un nerf joueur frustre. Et ne toucher la **courbe maîtresse** (`POW_BASE`/`ENEMY_*`,
> globale) **que** pour un biais *systémique*.

### La boucle de calibrage

1. Rafraîchir le corpus (saves du panel + anchors de référence). 2. `bench --grid` → verdicts + rapport de
build dominant. 3. Changer **un seul** knob (contenu **ou** joueur). 4. Re-`bench --grid` → la distribution
visée bouge vers la cible **et** la dispersion n'empire pas. 5. Garde-fous : `validate` / `check-talents` /
`check-classes` + `eco`/`eco-craft`. 6. Commit + republier le `leaderboard`. **Seuil de déclenchement** :
ne bouger qu'au-delà d'un écart franc à la cible (sinon on sur-tune le bruit). **N minimum** par bande avant
de faire confiance à un verdict.

---

## 10. Difficulté par TYPE DE CONTENU

| Contenu | Nature voulue | Notes |
|---|---|---|
| **Zone de chasse (Chapitres)** | **farm idle passif** — avance toujours un peu, se fait rouler dessus à terme | **pas** le vrai gate ; le mur de chapitre est franchi via les **raids** (§6) |
| **Donjons** | une **COURBE** (toujours +1 à viser), pas un mur | source de matériaux ; pacing via `npm run eco-donjons` |
| **Raids** | le **vrai gate** : check de stuff **et** de composition (§4-6) | identité par pilier · largeur croissante · trinité en endgame |

---

## 11. Points OUVERTS

- **Futurs raids endgame.** Aujourd'hui le endgame = l'Abîme (duo de boss). Demain : potentiellement une
  **vision/contenu différents** pour « aller toujours plus loin » — on garde un **point d'extension propre**
  (de nouveaux axes ? des combinaisons des 4 piliers ?). À ne pas sur-concevoir maintenant.
- **Migration des comptes existants.** La réassignation du loot (Reliquaire → uniques ; farm → équilibré) et
  la ré-introduction des systèmes s'appliquent proprement aux **nouveaux comptes** ; pour les parties en
  cours, ne pas re-verrouiller l'acquis. À cadrer le moment venu.
- **Stricte vs souple du gate** : la largeur croissante choisie ; reste à fixer si le tier exigé est celui
  du chapitre ou un tier *décalé* (peloton). Réglage de tuning, pas de doctrine.

---

## Références (fichiers & knobs)

- **Raids** : [`src/game/raids.ts`](../src/game/raids.ts) (`RaidMechanicKind`, `RAIDS`, `signature`,
  `lootTypes`, `raidReqs`, `requiresAllTier`, `RAID_HP_VS_MUR`/`RAID_DMG_VS_MUR`, `raidPartyHpMult`).
- **Uniques** : [`src/game/uniques.ts`](../src/game/uniques.ts) (`TAGGED_DROP_RATE`, `rollUnique`, taggés).
- **Objets** : [`src/game/items.ts`](../src/game/items.ts) (`ORIENTATION_FRAC`).
- **Courbe maîtresse** : [`src/game/progression.ts`](../src/game/progression.ts) (`POW_BASE`, `ENEMY_HP0`,
  `ENEMY_DMG0`, murs, `novaReqAt`).
- **Présets de build** : `character.ts` (`buildPresets`, 3 slots — le vecteur du loadout-swap).
- **Harnais** : `npm run bench` / `leaderboard` (vrais builds), `npm run audit` (save export), `eco`/
  `eco-craft`/`uniques`/`maitrise`. Détails : [`../scripts/README.md`](../scripts/README.md).
