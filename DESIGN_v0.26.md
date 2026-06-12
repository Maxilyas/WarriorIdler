# DESIGN v0.26 — La Grande Refonte des Métiers

> Retours joueur de juin 2026 (palier 70, Alchimiste 19 avec **11 points morts**,
> « beaucoup trop » de gemmes, specs jugées plates). Inspirations assumées :
> **WoW Dragonflight** (spécialisations à sous-arbres, qualité, inspiration,
> multicraft), **Diablo 4** (masterworking, tempering, salvage), **PoE**
> (monnaies-verbes, keystones, corruption).
>
> ✅ Déjà livré en hotfix : **Volatile retiré du tirage** des affixes de donjon
> (one-shots de packs) — vestige conservé pour les runs en cours, comme
> Réfléchissant en v0.25.x.

---

## 0. Diagnostic — pourquoi les arbres déçoivent

Rangs dépensables par arbre aujourd'hui (specs exclusives comptées 1) vs les
**25 points** du niveau max :

| Métier | Rangs dépensables | Points MORTS au niv 25 | Et avant P80… |
|---|---|---|---|
| Forgeron | 21 | 4 | OK (le moins touché) |
| Joaillier | 12 | **13** | 12 |
| Runiste | 9 | **16** | 9 |
| Alchimiste | 11 | **14** | **8** (Synthèses = P80/P100) |

Deux maladies :
1. **Arbre-menu** : presque tous les nœuds sont des déblocages 1 point. Une
   fois le menu acheté, le niveau ne sert plus à rien → points morts.
2. **Specs plates** : « ◈ +1 rang de famille » est un interrupteur, pas une
   identité. Aucune décision après le choix initial.

**Décision cadre (s'applique aux 4 métiers) :**
- Niveau max **25 → 50**. Courbe d'XP adoucie après 25 (×1,15/niv au lieu de
  ×1,22) + nouvelles sources d'XP (procédés, contrats, découvertes).
- Chaque arbre vise **70–90 rangs dépensables** pour 50 points → on ne peut
  PAS tout avoir : de vrais choix (PoE), du respec par branche.
- **Plus jamais de point mort** : chaque branche a des nœuds à rangs « filler »
  honnêtes, apprenables dès le niv 1, sans gate de palier.
- Les **gates de palier** restent sur les FONCTIONS (Synthèse P80, etc.),
  jamais sur la capacité à dépenser ses points.
- Structure commune : **tronc** (procédés de base) → **3 branches** →
  **spécialisations étagées I→V** (l'ex-spec plate devient une ligne profonde)
  → **capstone 50**.
- **Lot 1 immédiat (quick-win)** : avant la refonte complète, ajout de fillers
  aux 4 arbres actuels pour absorber les points existants (cf. §6).

---

## 1. ⚗️ Alchimiste — « distiller l'essence » devient JOUER avec la matière

**Problème.** Avant P80, l'arbre se vide en 8 points ; le métier n'a aucune
action récurrente (la Quintessence est un clic d'amélioration, la Synthèse est
end-game). **L'Alchimiste devient le métier des CONSOMMABLES et du temps réel**
— le seul à produire des choses qui se *consomment*, donc une demande infinie.

### 1.1 Les idées (catalogue)

**Production & boucle quotidienne**
1. **Élixirs d'équipe** — buff unique actif (1 slot), durée en temps réel
   30–60 min : `+8% dégâts` / `+12% PV` / `+15% or` / `+10% vitesse`…
2. **Potions de contenu** — à charges, consommées par l'activité : Potion de
   raid (réduit de 40 % le premier pic de dégâts du boss — réponse directe aux
   raids durcis), Potion de donjon (+1 jet de coffre), Fiole de chasse (la
   prochaine chasse paie +50 %).
3. **Philtres de butin** — 30 min : +1 cran de chance de rareté (drops normaux).
4. **Huiles d'arme** — 30 min : l'arme gagne +X % de dégâts du TYPE choisi
   (pont avec les lignes typées/résists v0.24).
5. **Antidotes ciblés** — −20 % des dégâts d'UN type pour le prochain
   donjon/raid : la préparation tactique avant un mur.
6. **Mutagènes** — consommable risqué : 70 % `+15 % dégâts` / 30 % `−10 %`.
   La chimie, c'est pas une science exacte.

**Time-gate & interactivité**
7. **Cuves de fermentation** (2→4 slots via l'arbre) — on lance un brassin,
   il **mûrit en temps réel** (30 min → 8 h) ; récolter au bon moment :
   trop tôt = Trouble, à point = Pur, fenêtre parfaite = **Parfait** (±25 %
   d'effet/durée). Le check-in quotidien du métier.
8. **Transmutation du jour** — 1/jour réel : 4 Quintessences d'un type → 1 du
   type CHOISI. Exception contrôlée au dogme « chaque donjon est LA source »
   (cadence quotidienne = jamais une économie parallèle, cf. Comptoir).
9. **Grands crus** — un brassin Parfait a 5 % de devenir **Millésime** :
   effet +50 %, stockable, affiché avec son année. Collection & flex.

**Découverte (le jeu dans le jeu)**
10. **Réactifs de biome** — 7 herbes/essences légères (1 par biome) : nouvelles
    tables de drop discrètes, la matière première des recettes.
11. **Recettes par EXPÉRIMENTATION** — combiner 2 réactifs inconnus au
    Laboratoire → découvre (ou rate, petit coût). Codex d'alchimie qui se
    remplit ; chaque découverte = XP forte.
12. **Pharmacopée** — passif de collection : +0,5 % de durée d'élixir par
    recette découverte.

**Grand Œuvre (l'existant, approfondi)**
13. **Alambic de précision** — orienter le recyclage : éclats OU essences OU
    réactifs (choix, plus de subi).
14. **Essences de qualité** — pâle / franche / absolue : la Synthèse II devient
    plus fiable avec de meilleures essences (au lieu d'un simple coût).
15. **Double distillation** — X % de chance de ne pas consommer les réactifs.
16. **Laborantin** — synergie Forgeron : un automate peut récolter les cuves.
17. **Pierre philosophale** — capstone 50 : relique de compte unique,
    +2 % à tous les drops de ressources, craftée en plusieurs étapes
    (réactifs des 7 biomes + Millésime + Synthèse III).

### 1.2 L'arbre (~75 rangs, 3 branches)

| Branche | Identité | Nœuds (extraits) |
|---|---|---|
| 🧪 **Officine** | potions & élixirs | Déblocages élixir/potion/huile/antidote (1 pt chacun, étagés niv 2→20) · Concentration (5 rangs, +6 %/rang durée) · Brassage critique (5 rangs, +4 %/rang chance Parfait) · ◈ **Maître de chai I→V** (cuves +1, maturation −20 %, Millésimes ×2…) |
| ⚗️ **Grand Œuvre** | quintessences & synthèses | L'existant (Quintessence, Synthèses I–III, gates P80/P100 conservées) · Rendement quintessencié (5 rangs, −4 %/rang coût quint) · Essences de qualité (3 rangs) · ◈ **Catalyseur I→V** (étage l'actuel : −5 %/rang coût, refund 80→100 %) |
| 🌿 **Matière** | réactifs, recyclage, économie | Distillation/Condensation passent ici et gagnent des rangs (3→5) · Herboriste (5 rangs, +8 %/rang drop de réactifs) · Expérimentation (déblocage) · Double distillation (5 rangs) · ◈ **Distillateur I→V** |

> **Capstones exclusifs niv 50** (1 seul) : 🜍 *Pierre philosophale* (compte) ·
> 🜚 *Panacée* (l'élixir d'équipe actif s'applique aussi aux automates) ·
> 🜂 *Athanor* (les cuves produisent double, maturation ×2 plus longue).

---

## 2. 💎 Joaillier — l'économie se resserre, le craft s'approfondit

### 2.1 Économie des gemmes (le « trop simple »)

**Problème.** Drop trop généreux (0,3 %/2 %/5 % + champions 12 %) → stock
énorme, le drop n'est plus un événement, la Taille ne sert à rien.

**Décision.**
- **Nerf des drops ×0,4** : normal 0,3 %→0,12 % · élite 2 %→0,8 % · boss
  5 %→2 % · champion 12 %→8 %. Le drop redevient un événement.
- **La poussière 💠 devient LA monnaie** : tout passe par elle (taille,
  recoupe, fusion, qualité). Les drops de poussière, eux, ne bougent pas.
- **Résorption du stock existant** : la **Fusion** (3 gemmes identiques →
  rang +1) donne immédiatement un usage au surplus accumulé — le stock du
  joueur devient son capital de départ, pas un regret.

### 2.2 Craft : monter, façonner, risquer

| Procédé | Quoi | Inspiration |
|---|---|---|
| **Taille** (existant) | poussière → gemme au choix (rang 1) | — |
| **Recoupe** (existant) | rang +1 contre poussière — étendue : les gemmes 4 rangs passent à 5 | — |
| **Fusion** ✨ | 3 gemmes identiques (même rang) → 1 au rang +1 | D4 |
| **Qualité** ✨ | chaque gemme a une qualité : Éclatée ×0,85 · Polie ×1 · **Parfaite ×1,15** sur le paramètre. La taille roll la qualité (compétence + nœuds ↑) | WoW DF |
| **Corruption** ✨ | retaille risquée : 45 % rang +1 · 35 % rien · 20 % broyée. Améliorable, jamais sûre | PoE |
| **Perçage** ✨ | ajoute une châsse à une pièce (1×/objet, très cher en 💠 + or) | PoE |

### 2.3 Les 40 nouvelles gemmes de condition

Règles de sélection : **un seul paramètre réglable** par gemme (équilibrable),
aucun doublon avec les 12 existantes, et chaque stat/build sous-représenté
reçoit son support : Altération/DoT, Pénétration, Précision, Esquive, Purge,
Ténacité, Barrière, Régén, Vol de vie, Multifrappe, Récupération/CDR, mana,
épines, anti-burst, chasses, raids.

**🥁 RYTHME (compteurs)** — `N` = compteur, `X%` = knob

| # | Gemme | Effet (paramètre en gras) | Sert |
|---|---|---|---|
| 1 | Tambour de siège | toutes les 8 attaques sur la même cible : Brèche, **−10→20 %** d'armure 6 s | Pénétration |
| 2 | Hémorragie cadencée | tous les **6→3** crits : saignement (60 % du coup sur 6 s, scale Altération) | DoT |
| 3 | Glas | tous les **8→4** kills : soigne l'équipe de 5 % PV max | Heal |
| 4 | Riposte mesurée | toutes les **8→4** attaques subies : riposte automatique (100 % arme) | Tank-DPS |
| 5 | Ostinato | chaque attaque sans crit : **+1→3 %** crit cumulé (vidé au crit) | Anti-malchance |
| 6 | Cadence parfaite | toutes les **12→6** attaques : la suivante Multifrappe | Multifrappe |
| 7 | Marche triomphale | +0,5 % dégâts par combat gagné sans mort (cap **+10→25 %**) | Streak |
| 8 | Détonation arcanique | tous les **8→4** sorts : le suivant frappe en zone (50 %) | Caster/AoE |
| 9 | Carillon | tous les **6→3** lancements de capacité : la prochaine recharge est réduite de moitié | CDR |
| 10 | Da capo | après **40→20 s** de combat : tes compteurs Rythme avancent ×2 | Méta-famille |

**🌊 FLUX (ressources)**

| # | Gemme | Effet | Sert |
|---|---|---|---|
| 11 | Calice débordant | l'excédent de soin devient bouclier (cap **10→30 %** PV) | Heal→tank |
| 12 | Fièvre de l'hallali | 5 s après un kill : **+5→15 %** vol de vie | Leech |
| 13 | Perfusion | héros < 50 % PV : régén ×**1,5→2,5** | Régén |
| 14 | Vases communicants | le plus blessé reçoit **+10→30 %** des soins des autres | Heal d'équipe |
| 15 | Garrot | une altération subie qui expire soigne **30→70 %** de ses dégâts | Purge/anti-DoT |
| 16 | Réservoir pressurisé | Barrière de départ **+15→40 %** | Barrière |
| 17 | Sous tension | toutes capacités en recharge : auto-attaques **+20→50 %** | Tempo |
| 18 | Échangeur | **5→15 %** des dégâts subis convertis en mana | Casters |
| 19 | Testament | à la mort d'un héros : bouclier **15→35 %** + 10 % dégâts 10 s aux survivants | Anti-wipe |
| 20 | Goutte-à-goutte | le vol de vie en excès (PV pleins) devient régén différée (**20→50 %** conservé) | Leech |

**🌍 ENVIRONNEMENT (l'état du monde)**

| # | Gemme | Effet | Sert |
|---|---|---|---|
| 21 | Boussole du traqueur | cibles de CHASSE : **+20→50 %** dégâts | Chasses (v0.25.2) |
| 22 | Pierre de sceau | en donjon : **+4→10 %** dégâts par affixe actif | Donjons |
| 23 | Trophée de guerre | en raid : **+10→30 points** de résistance à tous | Raids durcis ! |
| 24 | Prisme d'accord | **10→25 %** des dégâts convertis dans le type du biome | Lignes typées |
| 25 | Paratonnerre | pendant la Surcharge ⚡ : **−10→25 %** dégâts subis | Défense Surcharge |
| 26 | Première impression | le 1er ennemi de chaque combat subit **+15→40 %** | Ouverture de pack |
| 27 | Cartographe | coffres de donjon **+10→25 %** | Économie |
| 28 | Sixième sens | pendant un télégraphe ⚠️ : équipe **−15→40 %** dégâts subis | Miroir défensif de l'Opportuniste |
| 29 | Pied du mur | en farm, à ≤2 paliers du record : **+10→25 %** dégâts | Push |
| 30 | Veine mère | poussières (💠 + 🌌) **+15→40 %** au drop | Économie craft |

**🛡️ BASTION — NOUVELLE famille (défense), droppée dans le biome Physique**
(le Physique perd son « au hasard » : chaque biome a désormais SA famille)

| # | Gemme | Effet | Sert |
|---|---|---|---|
| 31 | Égide du premier sang | le 1er coup subi par héros chaque combat : **−30→60 %** | Anti-burst/one-shot |
| 32 | Rempart | par ennemi vivant au-delà du 1er : **−3→6 %** subis (cap ×5) | Tank de packs (miroir Nuée) |
| 33 | Carapace réactive | coup ≥ 15 % PV max → bouclier **10→25 %** (10 s CD) | Anti-burst |
| 34 | Ancrage | tant qu'aucun héros n'est tombé : **−5→15 %** subis | Discipline |
| 35 | Cilice | renvoie **15→40 %** des dégâts subis | ÉPINES (nouveau build) |
| 36 | Verre trempé | chaque esquive : +1 charge, prochaine attaque **+8→20 %** (cumul 5) | Esquive→DPS |
| 37 | Doctrine du bouclier | le porteur de bouclier partage **20→50 %** de sa Barrière | Slot bouclier |
| 38 | Granit | sous 30 % PV : **−15→35 %** subis | Miroir défensif du Second Souffle |
| 39 | Tour de garde | **25→60 %** des coups visant un allié < 30 % PV redirigés vers le plus gros PV max | Protection/taunt |
| 40 | Mémoire de la pierre | la Ténacité réduit aussi les coups télégraphés de **30→70 %** de sa valeur | Ténacité |

### 2.4 Les 30 idées d'arbre & de spécialisation

**A. Procédés & qualité (WoW DF)**
1. **Qualité de taille** — la compétence fait la Parfaite (cf. §2.2), nœuds
   « Main sûre » (5 rangs, +4 %/rang chance Polie→Parfaite).
2. **Inspiration** — 5 rangs : +2 %/rang de tailler directement au rang 2.
3. **Multitaille** — 3 rangs : +3 %/rang de produire une 2e gemme (même famille).
4. **Économie de matière** — 5 rangs : broyage +6 %/rang de poussière.
5. **Fusion** — déblocage (cf. §2.2), puis « Fusion propre » (3 rangs : −1
   gemme requise au rang 5… non : −20 %/rang de poussière de frais).
6. **Corruption** — déblocage, puis « Pacte du lapidaire » (3 rangs : le
   45/35/20 devient 55/30/15).
7. **Stabilisation** — la corruption ne détruit plus, coût ×2 (nœud tardif).
8. **Patrons de taille** — retailler une gemme déjà taillée coûte −50 %.
9. **File de taille** — lancer jusqu'à 5 tailles résolues en temps réel
   (10 min/gemme) : le métier travaille pendant que tu farmes.
10. **Calibrage** — transférer 1 rang d'une gemme vers une autre de la même
    famille (sans perte, contre poussière).

**B. Châsses & sertissage**
11. **Perçage** — cf. §2.2 (capstone de branche).
12. **Châsse royale** — la gemme sertie dans l'ARME compte +1 rang.
13. **Serti-conducteur** — 2 gemmes de la même famille sur un même perso :
    paramètres +10 %.
14. **Mosaïque** — 3 familles différentes portées par l'équipe : +8 % à tous
    les paramètres (encourage la diversité).
15. **Désertissage gratuit** — QoL de fin de branche.

**C. Spécialisations de famille PROFONDES (remplacent les ◈ plates)**
Chaque famille devient une ligne I→V (1 seule famille en spé majeure) :
16. **◈ Maître du Rythme I→V** — I : compteurs −1 · II : +1 rang famille ·
    III : les compteurs SURVIVENT entre les combats · IV : le 1er déclenchement
    du combat compte double · V : *Polyrythmie* (ta meilleure gemme Rythme
    compte +2 rangs).
17. **◈ Maître du Flux I→V** — I : paramètres +10 % · II : +1 rang · III : les
    boucliers de gemmes persistent entre combats · IV : soins de gemmes +25 % ·
    V : *Marée* (caps de Calice/Trésorerie +50 %).
18. **◈ Maître de l'Environnement I→V** — I : +1 rang · II : *Rémanence* (les
    effets durent 5 s après la fin de leur condition) · III : coffres/chasses
    +10 % · IV : Surcharge +25 % de durée pour toi · V : *Climat* (l'effet du
    biome précédent reste actif à 50 %).
19. **◈ Maître du Bastion I→V** — I : +1 rang · II : les réductions s'appliquent
    aussi aux DoT · III : le Cilice renvoie en type du biome · IV : boucliers
    de gemmes +25 % · V : *Citadelle* (l'Égide couvre les 2 premiers coups).
20. **Double allégeance** — niv 45 : une 2e famille gagne +1 rang (jamais la
    profondeur I→V — la spé majeure reste un choix).

**D. Économie & sources**
21. **Prospection ciblée** — choisir la famille droppée dans le biome courant
    (override la table biome↔famille).
22. **Tamis** — toggle : les gemmes en double sont auto-broyées à +20 %.
23. **Nez du lapidaire** — les champions ✦ droppent toujours rang ≥ 2.
24. **Gisements** — sonder un biome (4 h réelles) → filon de poussière/gemmes.
    Time-gate doux, check-in quotidien.
25. **Marché aux pierres** — 1/jour : 3 gemmes quelconques → 1 gemme au CHOIX
    (rang = min des 3).

**E. Identité & collection**
26. **Gemmes signées** — les Parfaites taillées portent ta marque : +1 % de
    paramètre par 10 niveaux de métier.
27. **Écrins** — présets de gemmes par perso, liés aux présets d'équipement.
28. **Lapidaire de raid** — 1 gemme « Trophée » par tier de raid, recette
    droppée sur le boss (chase item).
29. **Catalogue** — tailler au moins 1× chaque gemme : +2 % à tous les
    paramètres (collection complète).
30. **Grand Œuvre du Joaillier** — capstone 50 : la *Gemme prismatique*,
    unique par compte, paramètre choisi dans 3 familles.

---

## 3. 🪄 Runiste — temps, règles… et PACTES

### 3.1 La nouvelle famille : 🩸 PACTE (keystones PoE)

Les gemmes = comportements de combat conditionnels. Les règles = économie du
jeu. Le créneau libre : **bonus permanent CONTRE malus permanent** — l'art du
build extrême, rien ne le recoupe. Une seule rune de Pacte active par équipe
(knob), elles définissent un build entier.

### 3.2 Les 40 runes

**⏳ TEMPS (12)** — knob unique en gras

| # | Rune | Effet |
|---|---|---|
| 1 | Ouverture | la plus longue capacité de chaque héros démarre rechargée |
| 2 | Latence | ennemis **−20→40 %** vitesse d'attaque pendant 8 s |
| 3 | Rembobinage | héros < 25 % PV : ses recharges avancent de **5→12 s** (1×/combat) |
| 4 | Sabliers liés | pendant un télégraphe : recharges d'équipe ×**1,5→2** |
| 5 | Usure | **+5→12 %** dégâts infligés par tranche de 10 s (cap 3 tranches) |
| 6 | Hâte funèbre | chaque kill : **+10→25 %** hâte 4 s |
| 7 | Préparation | entre les combats, recharges ×**1,5→2,5** |
| 8 | Écho temporel | toutes les 30 s : relance la dernière capacité à **40→80 %** d'effet |
| 9 | Stase | l'enrage/la montée des affixes gelé **10→25 s** |
| 10 | Seconde aube | le Sursis revient **+25→50 %** plus vite |
| 11 | Avance rapide | TES altérations tickent **+25→60 %** plus vite |
| 12 | Grain de sable | la 1re incantation de chaque non-boss est interrompue |

**⚖️ RÈGLE (14)**

| # | Rune | Effet |
|---|---|---|
| 13 | Collectionneur | gemmes droppées : **10→30 %** de tomber rang 2 |
| 14 | Prospecteur | poussière 💠 ×2 au drop, gemmes entières −50 % |
| 15 | Archiviste | **+10→25 %** XP des 4 métiers |
| 16 | Pacte de chasse | chasses **+20→50 %** de prime, fenêtre 2× plus courte |
| 17 | Clés en double | clé droppée : **10→25 %** d'en recevoir 2 |
| 18 | Appât à champions | champions ✦ **+20→50 %** d'apparition |
| 19 | Monomanie | objets 2× plus rares, **+1→2 crans** de chance de rareté |
| 20 | Quartzite | Quintessences du biome **+25→60 %** |
| 21 | Coffres doubles | automates : **10→25 %** de coffre double |
| 22 | Tisse-châsse | objets droppés : **+10→25 %** de chance de châsse |
| 23 | Mécène | or **+20→40 %**, XP −10 % |
| 24 | Bourse d'études | XP **+20→40 %**, or −10 % |
| 25 | Loi du talion | élites/boss : **10→20 %** de dropper leur table 2× |
| 26 | Saturnales | le dimanche réel : récompenses **+10→20 %** |

**🩸 PACTE (14)** — un seul actif ; le malus ne se réduit pas (sauf spé)

| # | Rune | Pacte |
|---|---|---|
| 27 | Verre | **+25→50 %** dégâts infligés ET subis |
| 28 | Plomb | −20 % hâte ; **+25→50 %** PV |
| 29 | Ermite | UN seul héros aligné : **+40→80 %** toutes stats |
| 30 | Meute | **+6→12 %** dégâts par héros au-delà du 1er |
| 31 | Jeûne | soins/régén coupés ; chaque kill rend **4→10 %** PV |
| 32 | Sang vicié | régén coupée ; vol de vie **+30→60 %** |
| 33 | Roc | esquive impossible ; **−10→20 %** dégâts subis |
| 34 | Berserk | PV capés à 60 % ; **+20→45 %** dégâts |
| 35 | Pacifiste | auto-attaques −90 % ; capacités **+40→90 %** |
| 36 | Duelliste | **+30→60 %** au 1er ennemi vivant ; −30 % aux autres |
| 37 | Lignes ley | dégâts 100 % convertis au type du biome ; **+15→35 %** |
| 38 | Colosse | vitesse figée à 0,8/s ; chaque coup **+40→90 %** (synergie Métronome) |
| 39 | Hubris | récompenses **+15→35 %** ; Sursis et survies désactivés |
| 40 | Memento mori | un héros tombe : les autres **+15→35 %** dégâts jusqu'à la fin du run |

### 3.3 Craft runique — TRÈS cher, par destruction

À la PoE : la matière vient de la **destruction**.
- **Effacement** — sacrifier une rune → 1 **Fragment runique** (2 si Règle,
  3 si Pacte). Les doublons de drop deviennent enfin utiles.
- **Forge runique** — rune au CHOIX : Temps = 6 fragments + 25 🌌 + or massif ·
  Règle = 10 fragments + 60 🌌 · **Pacte = 16 fragments + 150 🌌 + 1 Trophée de
  raid**. Coûts ×1,5 à chaque craft de la même rune (anti-spam).
- **Surcharge runique** — gamble : 3 fragments → rune aléatoire (pondérée).
- Les PACTES ne droppent **jamais** : uniquement craftés. Le Runiste devient
  le métier le plus cher du jeu — et le plus définissant.

### 3.4 L'arbre (~70 rangs, 3 branches)

| Branche | Extraits |
|---|---|
| ⏳ **Chronomancie** | ◈ Chronomancien I→V (efficacité +10 %/rang, V : *Hors du temps* — une 2e rune de Temps compte en union) · Fillers : gravure −coût, XP, fragments +1 |
| ⚖️ **Législation** | ◈ Législateur I→V (V : *Jurisprudence* — une 2e Règle active) · Greffier (les Règles économiques affichent leurs gains cumulés — feedback !) |
| 🩸 **Pactes** | Déblocage (niv 12, P60) · ◈ Pactiste I→V (I–IV : malus −5 %/rang, V : *Avocat du diable* — le malus du pacte actif −30 %) · *Double pacte* (capstone 50 : 2 pactes actifs, leurs malus ×1,5 — le nœud le plus dangereux du jeu) |

---

## 4. 🔨 Forgeron — les Compagnonnages (ce qui marche n'est PAS touché)

**Conservé tel quel** : équilibrage armes/ateliers, coûts, surillvl,
transmutation, ascension, automates. On AJOUTE de la profondeur, on ne
rééquilibre pas l'existant.

### 4.1 Compagnonnages — la spécialisation par TYPE de pièce

4 corps de métier (les armes restent hors spé — jugées bien réglées) :

| Compagnonnage | Pièces | Saveur |
|---|---|---|
| 🪖 **Heaumier** | Tête, Épaules | le prestige |
| 🥋 **Cuirassier** | Torse, Jambes, Bouclier | la masse |
| 🧤 **Équipementier** | Mains, Poignets, Taille, Pieds, Cape | la polyvalence |
| 💍 **Orfèvre** | Collier, Anneaux, Bijoux | la finesse |

**1 compagnonnage MAJEUR** (ligne I→V complète) + dès le niv 35 **1 mineur**
(rangs I–II seulement). Chaque ligne I→V :

- **I — Plans de maître** : crafter ces pièces coûte −15 % et +10 % d'XP.
- **II — Tour de main** : +1 iLvl plancher sur ces pièces (création).
- **III — Signature** : 1 affixe GARANTI au choix dans une liste du corps de
  métier (Heaumier : crit/ténacité · Cuirassier : END/réduction · Équipementier :
  hâte/esquive · Orfèvre : stats rares à petit budget) — le tempering de D4.
- **IV — Œuvre** : chance de rareté supérieure +12 % sur ces pièces (l'ex
  « +32 % global » devient une force LOCALISÉE, là où tu es maître).
- **V — Chef-d'œuvre** : 1/semaine, craft un objet **+1 cran de rareté garanti**
  avec châsse garantie (cadence hebdo = Conseil-compatible).

### 4.2 Le Prodige — la « rareté supérieure » devient une branche

L'Œil du maître (+4 %×5) et Visionnaire (+12 %) fusionnent dans une ligne :
- **Prodige I–V** (5×3 rangs fillers : +2 %/rang, donc +30 % max — au lieu de
  +32 % opaque) ;
- **Inspiration** (WoW) : un craft « critique » à X % monte de DEUX crans de
  rareté (annoncé avec fanfare — le jackpot visible) ;
- **Sérendipité** : les crafts ratés (rareté de base) rendent 25 % des coûts.

### 4.3 Nouveaux procédés (l'arbre les débloque)

1. **Reforge ciblée** — reroll d'UN affixe choisi (l'enchant de D4), coût
   croissant par reroll sur le même objet.
2. **Trempe lente** — la v0.25 §3 l'avait spécifiée « hors lot » : intégrée
   ICI. Déposer un objet à la forge : +1 petit palier d'iLvl par 24 h réelles
   (max 5). Nœud Forgeron niv 8.
3. **Polissage** — qualité ⭐1–5 du craft (budget de stats ±8 %) : la
   compétence du forgeron roll la qualité, les nœuds l'améliorent (WoW DF).
4. **Fonderie** — fondre les objets → **Lingots** (nouvelle matière), exigés
   par les Signatures (III) et Chefs-d'œuvre (V). Donne un puits aux drops.
5. **Moules** — mémoriser un craft réussi : le re-crafter coûte −30 %
   (chasse au « god roll » moins punitive).
6. **Contrats de forge** — 3 commandes quotidiennes (« un casque Rare+ en
   END ») : XP forte + Lingots. Le check-in du Forgeron (crafting orders WoW,
   version PNJ).
7. **Étalonnage** — surillvl par lots de 5 (QoL tardive).
8. **Industrialisation étendue** — 4e automate (capstone), modules d'automate
   (ciblage de coffre, +résist pour les raids durcis), et le **Laborantin**
   (cf. Alchimiste 16).

### 4.4 L'arbre (~90 rangs — le plus gros)

```
            TRONC (économe, pédagogie, procédés de base)
                 │
   ┌─────────┬───┴────────┬──────────────┐
 🪖/🥋/🧤/💍   ✨ Prodige    ⚙️ Procédés     🤖 Industrialisation
 Compagnonnages  (rareté)   (reforge,       (automates, modules,
 (majeur+mineur)            trempe, fonte,   chaîne de montage)
                            polissage)
```

Capstones 50 exclusifs : *Chef-d'œuvre hebdo amélioré* (2/sem) · *Maître des
quatre corps* (le compagnonnage mineur passe I→III) · *Manufacture* (le 4e
automate + les modules coûtent −50 %).

---

## 5. Cadre technique commun

- `METIER_MAX_LEVEL` 25 → **50** ; XP post-25 : `60·1,22^24·1,15^(n−25)`.
- Nouvelles sources d'XP : procédés quotidiens (cuves, contrats, gisements),
  découvertes (recettes, catalogue), premier craft de chaque chose.
- **Respec PAR BRANCHE** (l'or actuel ×0,4 par branche) — changer de
  compagnonnage/famille ne rase plus tout l'arbre.
- Specs étagées : `exclusive` actuel devient `exclusiveTier` (I→V même groupe).
- UI : l'arbre passe en **colonnes par branche** (le hub build mobile v0.24
  sait déjà faire), badge « points disponibles » par métier.
- Sauvegardes : migration douce — nœuds existants conservés à l'identique
  (mêmes ids), specs plates converties en rang I de leur ligne, points
  excédentaires rendus.

## 6. Ordre de chantier

| Lot | Contenu | Taille |
|---|---|---|
| **1 — Dégoulottage** ⚡ | fillers immédiats sur les 4 arbres ACTUELS (Distillation/Condensation 3→5 rangs, +2 nœuds à rangs par métier apprenables dès niv 1) — élimine les points morts AVANT la refonte | S |
| **2 — Économie Joaillier** | nerf drops ×0,4 + Fusion + Qualité + nouvelles gemmes par vagues (10 Bastion d'abord — la demande tank/anti-burst est immédiate, puis 10/10/10) | M |
| **3 — Cadre 50 niveaux** | niveau 50, XP, respec par branche, UI colonnes | M |
| **4 — Forgeron** | Compagnonnages + Prodige + Contrats + Trempe lente + Fonderie | L |
| **5 — Runiste** | Pactes (vague de 6, puis 8) + craft runique + arbre | L |
| **6 — Alchimiste** | Officine (élixirs/potions) + cuves + découverte + arbre | L |
| **7 — Corruption/Perçage/Gisements** | les procédés à risque & time-gate du Joaillier | M |

## 7. Knobs

| Knob | Valeur proposée | Fichier |
|---|---|---|
| Drops gemmes | 0,12 % / 0,8 % / 2 % / champion 8 % | `condGems.ts` |
| Fusion | 3 identiques → rang +1, 30 💠 de frais | `condGems.ts` |
| Qualité | ×0,85 / ×1 / ×1,15 · base 15 % Parfaite | `condGems.ts` |
| Corruption | 45/35/20 → 55/30/15 spécialisé | `condGems.ts` |
| Niveau max / XP post-25 | 50 · ×1,15/niv | `metiers.ts` |
| Rangs par arbre | Forgeron ~90 · autres ~70–75 | `metiers.ts` |
| Forge runique | 6/10/16 fragments · 25/60/150 🌌 · ×1,5 répétition | `enchants.ts` |
| Pactes actifs | 1 (2 via capstone, malus ×1,5) | `enchants.ts` |
| Élixir actif / cuves | 1 slot · 2→4 cuves · 30 min–8 h | `metiers.ts` (nouveau `alchimie.ts`) |
| Chef-d'œuvre | 1/semaine (epoch UTC, comme le Conseil) | `metiers.ts` |
| Compagnonnage | 1 majeur (I→V) + 1 mineur (I–II) dès niv 35 | `metiers.ts` |
