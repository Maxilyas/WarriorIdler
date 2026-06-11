# DESIGN v0.24 — Résistances relatives, refonte du loot & de l'arbre de talents

> Document de **gel** issu de la grande review. Contrat de conception **avant** toute ligne de
> code. Les valeurs chiffrées sont des **points de départ** (tunables à l'implémentation), sauf
> mention « verrouillé ».

---

## 0. Ordre d'implémentation convenu

1. **Quick-wins sûrs** — §1 (mort/abandon/réanimation) + §2 (recyclage).
2. **Fondation résist** — §5 (modèle relatif) + **fiche de boss**.
3. **Tables de loot** — §4 (fonction unifiée : farm / Cache / raids + gap d'ilevel).
4. **Refonte arbre** — §3 (gating par paliers, anti-redite, 5 nouveaux archétypes).
5. **UI mobile** — §6 (hub build B+C, panneau Résist promu).

---

## 1. Bug — mort / abandon / réanimation  *(quick-win)*

**Constat.** `abandonRaid` ([store.ts:3148]) et `abandonDungeon` ([store.ts:3121]) ne soignent
pas (pas de `fullHeal`). Sur le farm, un perso mort ne ressuscite jamais tant que l'équipe ne
wipe pas entièrement (la victoire de palier ignore les morts : `if (c.hp <= 0) return c`).

**Décisions (verrouillé).**
- **1a** — Quitter une instance (raid **ou** donjon ; abandon / victoire / wipe) **soigne et
  ressuscite toute l'équipe à fond**. → `abandonRaid`/`abandonDungeon` appellent `fullHeal`.
- **1b** — Sur le farm, **résurrection auto à chaque palier gagné OU perdu**. Un perso à 0 PV se
  relève (PV pleins) à la résolution du palier suivant. La mort ne « colle » plus jamais.
- **1c** — **La mort n'a aucun coût** (pas de pénalité, pas de perte de butin). État purement
  transitoire.

---

## 2. Recyclage — plafond de rareté  *(quick-win)*

**Constat.** Le store accepte déjà le tier 16 ; seule la liste déroulante coupe à Abyssal (14)
via `r.tier <= 14` ([StuffScreen.tsx:338]).

**Décisions (verrouillé).**
- **2a** — Étendre le seuil jusqu'à **Transcendant (16)**.
- **2b** — **Confirmation** demandée dès que le seuil ≥ **Abyssal** (recyclage/vente de masse de
  haute rareté). Les objets à **effet unique** restent protégés du recyclage de masse.

---

## 3. Arbre de talents

### 3.1 Gating — modèle « Paliers d'Archétype »  *(verrouillé)*

Aujourd'hui `canAllocate` n'exige que **rang ≥ 1** sur les prérequis → on trace jusqu'aux
capstones avec 1 point partout.

**Nouveau modèle, deux verrous :**
- **Verrou de palier (global)** — pour débloquer le **Tier N** d'un arbre, il faut avoir dépensé
  **≥ 5 points cumulés dans le Tier (N−1)** de cet arbre. Répartition libre (5/5 sur une node, ou
  3+2 sur deux, etc.).
- **Verrou de compétence (keystone/active)** — les nodes **très fortes** exigent un prérequis
  **strict** : node précédente **maxée** *ou* un **palier d'arbre minimum atteint** (ex. Tier 4).

> Implémentation : ajouter au `TalentNode` un champ de *coût de palier* et/ou `requiresMaxed` /
> `requiresTierPoints`. `canAllocate` vérifie les points cumulés par constellation et par tier.

### 3.2 Empilement des multiplicateurs  *(verrouillé)*

- **`damageMult`** — on **NE limite PAS** l'empilement (`*=` multiplicatif conservé). Le levier,
  c'est le **placement intelligent des nodes** : disperser les gros `damageMult` dans des
  branches/paliers profonds et coûteux pour que « en prendre 10 » exige de **vrais sacrifices**
  d'arbre. À charge du joueur d'optimiser.
- **`flatDr`** — **disperser** les nodes de réduction de dégâts dans l'arbre global (plus de
  cluster où l'on rafle tout). Pas de cap dur ajouté ; c'est le positionnement qui régule.

### 3.3 Anti-redite — repositionnement de l'existant  *(verrouillé)*

| Redite | Résolution |
|---|---|
| **Colosse vs Briseur** | Colosse = **mono-cible immobile** (highHp, anti-burst). Briseur = vrai **AoE/pack** (cleave scalant au nb d'ennemis, anti-CC) → archétype farm de packs. |
| **Faucheur vs Pestiféré** | Faucheur = **drain/sustain** (vol de vie sur DoT, tanky solo). Pestiféré = **contagion** (DoT qui se propage aux packs, scale Altération). Retirer le `Fléau d'ombre` dupliqué de l'un. |
| **Rôdeur / Duelliste / Spectre** | Rôdeur = poison/sustained ; Duelliste = **burst/multifrappe mono-cible** ; Spectre = anti-CC/évasion (gardé tel quel). |
| **Élémentaliste vs Alchimiste** | Alchimiste gardé (part du type d'arme). Élémentaliste **réidentifié** : « réaction élémentaire » (alterner les types inflige un bonus), au lieu d'un sac de `damageMult` générique. |

### 3.4 Cinq nouveaux archétypes  *(verrouillé)*

1. **Foudreur** *(Foudre / AGI, pont INT)* — identité **arc + statique + conductivité** :
   - **Arc** : le coup de foudre **rebondit** sur 2-3 ennemis du pack (dégâts dégressifs) →
     élément **AoE-pack**.
   - **Statique** : empiler de la **Hâte** charge une jauge ; à seuil, **décharge** (nuke).
   - **Conductivité** : ignore une part de l'**armure** (anti-blindé) ; faible en mono-cible pur
     (contrepoids assumé).
2. **Chronomancien** *(Récupération / CDR)* — recharges écrasées, **spam de sorts/ultimes**.
   Keystones : « chaque sort lancé −X % CD des autres », « sous X % de CD restant, +dégâts ».
   Sert la stat **Récupération** (orpheline).
3. **Purgateur** *(Purge / Altération)* — **encaisse les afflictions et les retourne**. Keystones :
   « chaque DoT/CC purgé → stack de dégâts », « immunité montante aux altérations ». **Synergie
   directe avec §5** (Purge réduit le déficit DoT). Sert la stat **Purge** (orpheline).
4. **Oracle sanglant** *(heal→dégâts)* — hybride **DPS/heal non spécifique** : une fraction de
   **tout soin généré** est aussi infligée à l'ennemi (et une part des dégâts soigne le groupe).
   Scale sur la **stat dominante** du perso (pas de scaling exclusif). Nouveau type d'effet
   keystone `healToDamage: frac`.
5. **Assassin d'ouverture** *(AGI distinct)* — **coup d'entrée énorme** sur cible fraîche puis
   ramp ; récompense le **kill rapide** (synergie packs/adds de raid). Gameplay distinct du crit
   soutenu.

### 3.5 Archétype tank-résistance — « Égide »  *(verrouillé)*

Trois voies, toutes indexées sur la **résistance** (qui devient la stat-reine défensive, §5) :
- **Gardien du seuil** *(offensif)* — si `Résist ≥ Req` du boss, le **surplus** de résist se
  convertit en **dégâts** (boucle de stuff : capper = débloquer l'offense).
- **Aegis adaptatif** *(confort)* — gagne automatiquement de la résist **du type qui vient de
  toucher** (lisse les boss multi-type / rotate).
- **Égide partagée** *(soutien)* — partage une part de sa résist avec le **groupe** (aura) → le
  tank compte en raid.
- **Métaboliseur** *(sustain)* — la résist **au-delà du cap** se transforme en **soin/seconde**.
- **Acclimatation** *(soupape, talent)* — traite `Req` du boss comme **−X %** (pour les hybrides
  qui ne peuvent pas tout capper, cf. §5e).

### 3.6 UI de l'arbre  *(verrouillé)*

- **Reset** — **modal de confirmation** (« Réinitialiser pour 💰X ? »). Même confirmation sur
  **« Appliquer un préset »** (respec payant).
- **Zoom mobile** : (1) **sortir les contrôles +/−/recentrer hors du canevas** (barre dédiée sous
  l'arbre) pour ne plus masquer de nodes, (2) **zoom max augmenté**, (3) **cibles tactiles des
  nodes agrandies** + gros boutons.

---

## 4. Loot — fonction unifiée & cohérence des sources

### 4.0 Principe — une seule fonction  *(verrouillé)*

Unifier farm / Cache / raids / coffres marché sous **`rollWindowRarity(plancher, pic, plafond,
decayDown, decayUp, jackpotEps)`** : **fenêtre glissante à pic**, **décroissance géométrique à
deux pentes** (raide en bas, **très raide en haut** = traîne « très rare »), bornée par
plancher/plafond. Défauts : `decayDown ≈ 0,30` · `decayUp ≈ 0,30-0,32` · ε au plafond pour que le
top **existe** sans être courant.

**Échelle des sources (verrouillé) :**
`Farm (≤ Légendaire)` **<** `Cache du Pilleur (pic Légendaire, plafond pratique Artefact + traîne
infime → Éternel)` **<** `Raids T1→T10 (seul chemin Céleste → Transcendant)`.

### 4.1 Farm (paliers)

- `pic(stage) = clamp(2 + ⌊stage/18⌋, 2, 5)` → Commun → **Épique** (~palier 54).
- `plancher = max(1, pic−2)` · `plafond = min(6, pic+2)` → **jamais > Légendaire**.
- Élite / Champion / Boss = décalage de fenêtre **+1 / +2 / +1** (moment jackpot), capé à 6.
- Rôle : ilevel (`stageIlvl ≈ 1,5·stage`) + XP + or + filet. Pas la chasse à la rareté.

Rareté dominante : ~palier 10 → **Commun** ; ~50 → **Rare** (17 % Épique) ; ~90 → **Épique**
(17 % Légendaire).

### 4.2 Cache du Pilleur (feeder vers raid T1)

- **Abaisser** le plafond pratique à **Artefact (7)** (pic **Légendaire (6)**), pilotée par le
  niveau de donjon.
- **Traîne « au-delà du voile »** infime (~0,3-1,2 %) pouvant atteindre **Patrimoine → Éternel**.
- Cohérence : raid T1 = **même rareté commune (Épique)** mais **meilleur ilevel** + **porte vers
  Céleste**. ⚠️ Léger **nerf ressenti** de la Cache (moins d'Éternel) — assumé/communiqué.

### 4.3 Raids — rareté par tier  *(modèle validé, traîne haute volontairement rare)*

Fenêtre glissante : `plancher(t)` et `plafond(t)` montent ~**+0,6 rareté/tier** ; `pic(t) =
plancher(t) + 2`. Le joueur a **préféré une traîne haute plus rare** que ses chiffres bruts → on
garde le modèle tel quel (top Cosmique→Transcendant ~**0,05-0,5 %**).

Fourchettes cibles (rappel des intentions joueur) :
| Tier | Plancher | Plafond |
|---|---|---|
| T1-T2 | Inhabituel | Céleste |
| T3-T4 | Rare | Éternel |
| T5-T6 | Légendaire | Cosmique |
| T7-T8 | Artefact | Abyssal |
| T9 | Artefact | Primordial |
| T10 | Patrimoine | Transcendant |

Validation T1 (modèle vs joueur, %) :
| | inhab | rare | épique | légend | artef | patrim | mythiq | ascend | céleste |
|---|---|---|---|---|---|---|---|---|---|
| joueur | 5 | 20 | 60 | 10 | 3 | 1 | 0,5 | 0,4 | 0,1 |
| modèle | 4,8 | 16 | 54 | 17 | 5,5 | 1,8 | 0,6 | 0,18 | 0,06 |

### 4.4 Raids — quantité de butin  *(verrouillé)*

**1 objet garanti** + tirages bonus indépendants : `P(+1) = min(50 %, 5 %·tier)` ·
`P(+2) ≈ P(+1)·0,5` · `P(+3) ≈ P(+1)·0,2` (dès T3). → T1 ~1,06 objet ; T5 ~1,40 ; T10 ~1,85.

### 4.5 Raids — tiers & progression  *(verrouillé)*

- **Chaque tier = un vrai mur.** On farme **beaucoup** le T(n) pour passer T(n+1).
- **Gate de passage** = réussir le combat **+ monnaie spécifique au raid** à farmer
  (T1→T2, T2→T3, …). *(Nouvelle ressource/monnaie de raid à définir : nom, coût par tier.)*
- **Butin ciblé par raid conservé** (Armes / Bijoux / Armures / Résist / Tout).
- **Gap d'ilevel** calé pour valoir **≈ +1 cran de rareté/tier** (1 cran ≈ ×1,22 de budget stat
  via `statMult`) → un T(n+1) de rareté égale/inférieure peut battre un T(n) supérieur (la chasse).

---

## 5. Résistances — modèle relatif  *(fondation)*

### 5.1 Modèle  *(verrouillé)*

- La résistance devient une **stat en points, NON plafonnée**, par type. **Suppression du cap
  75 %.** Migration : valeurs actuelles ×100, lignes stuff/talents/sets rescalées.
- Chaque **attaque ennemie typée** porte une **Exigence** `Req` (puissance du boss sur ce type).
- Déficit : `D = max(0, Req − Résist)`.
- **Multiplicateur de dégâts reçus** :

  ```
  M = 1 + Kmax · (D / Req)^p
  ```

  - `Résist ≥ Req` → `D = 0` → **M = ×1** (au cap, dégâts normaux).
  - `Résist = 0`  → **M = 1 + Kmax** (punition max, **bornée** : pas de one-shot exponentiel).
  - **Défauts :** `Kmax = 4` (×5 max, tunable à 5) · `p = 1,6` (indulgent : un peu de résist aide
    déjà beaucoup ; capper enlève toute la pénalité).

### 5.2 Gradation par contenu  *(verrouillé)*

`Req(type, tier)` ≈ **0 sur le farm** (résist non contraignante) → **faible en donjon** →
**réelle sur boss de raid**, montant par tier. La menace vient du **multiplicateur**, pas du sac à
PV → **les PV des boss peuvent rester modérés, voire baisser**.

### 5.3 Parade au sous-résist  *(verrouillé)*

- Réponse principale = **plus de résist** + **EHP/soin** comme filet généraliste.
- **Purge** = soupape ciblée : `Req_effectif = Req − Purge` **sur les attaques DoT/altération**
  (la stat orpheline entre en jeu).
- **Acclimatation** (talent Égide) = traite `Req` comme `−X %`.

### 5.4 Fiche de boss  *(verrouillé)*

Donnée unique (types + `Req` par type, par tier), affichée à **deux surfaces** :
1. **Écran de raid** (avant engagement) : « ce boss exige Foudre 320 / Ombre 280 — toi 150 / 0 ».
2. **Hub Résist** : surlignage **boss-aware** des déficits quand un raid est sélectionné/actif.

### 5.5 Côté offensif

**Inchangé pour l'instant** : la pénétration vs résistance ennemie reste le système offensif
actuel. On ne refond que le **côté défensif** (subi) dans cette passe.

---

## 6. UI mobile — hub « build »  *(verrouillé : B + C)*

- **B — Hub « carte de perso »** : un écran scrollable. Identité en haut (niveau, dégâts, EHP),
  puis **mini-cartes repliées** (Stats / **Résist** / Capacités) qui s'ouvrent **en plein écran**
  au tap ; **Talents** = mini-map des constellations allouées → ouvre l'arbre plein écran.
- **C — Contextuel** : l'écran **pousse** ce qui compte (points de talent non dépensés →
  Talents mis en avant ; **avant un raid → Résist surligne le type exigé manquant**).
- **Résist promu au rang de panneau** à part entière (central avec §5).
- Progressive disclosure : ne montrer que le pertinent → pas de surcharge.

---

## 7. Knobs ouverts (à nudger à l'implémentation)

- §3 : coût exact du verrou de palier (5 pts ?), seuils `requiresMaxed`/`requiresTierPoints` par
  keystone, valeurs des nouveaux keystones (`healToDamage`, arc Foudre, CDR, etc.).
- §4 : nom + coûts de la **monnaie de passage de tier** de raid ; pente post-pic exacte des
  fenêtres ; gap d'ilevel chiffré par tier.
- §5 : `Kmax` final (4 vs 5), `p`, courbes `Req(type, tier)` par raid, échelle de rescale des
  points de résist, valeur de l'aide Purge.
