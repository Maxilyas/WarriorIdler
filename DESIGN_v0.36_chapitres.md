# DESIGN v0.36 — Refonte « Chapitres » & retours playtest v0.35.1

> Statut : **conception VERROUILLÉE** (session joueur 2026-06-18). Rien codé — implémentation sur « go ».
> Remplace/affine `DESIGN_v0.35.md` (l'axe de Palier unique) : on resserre à **15 Chapitres**,
> on **cape l'ilvl**, on **inverse l'économie** (or/XP = farm only), et on **renomme** Palier→Chapitre.
> Ce doc agrège AUSSI le diagnostic groundé de chaque retour playtest (bugs / calibrage / UX).

---

## 0. Décisions actées en session

1. **Renommage** : « Palier » → **Chapitre**. 1 Chapitre = **10 vagues**, **mur** à la vague 10.
   En interne le code garde `stage` ; on dérive `chapitre = ⌈stage/10⌉`, `vague = ((stage−1) mod 10)+1`.
   Fini l'ambiguïté palier/stage de v0.35.
2. **Structure = 15 Chapitres** : **5 Chapitres tutoriel** (Prologue) + **10 vrais Chapitres**, chacun
   gaté par un **tier de raid**. Au-delà du dernier : **Chapitre++** = boss de plus en plus durs (pas d'ilvl).
3. **ilvl capé à 200** pour TOUT le contenu de base (15 Chapitres + donjons + raids T1-T10). **Seule
   source d'ilvl > 200 = les raids endgame** (l'Abîme & futurs) à un ilvl **un poil au-dessus** de 200 →
   du stuff à grind. La progression endgame passe à l'**horizontal** : **optimisation du stuff + chasse à
   la rareté**.
4. **Multi-perso = Lock par raids (socle) + Budget 100 % partagé.** **Plus de niveau par perso : un seul
   NIVEAU DE COMPTE global** → matériaux, or, **points de talent ET niveau** sont communs aux 2 persos.
   On garde le scaling de groupe des raids tel quel pour l'instant.
5. **Économie inversée** : **or & XP uniquement via le farm classique** (idle, time-gate). **Donjons et
   raids ne donnent plus ni or ni XP** → tue le snowball de donjon. **Les 2 donjons Or/XP (Chambre du
   Trésor, Sanctuaire du Savoir) sont SUPPRIMÉS** (sans objet). **Or = généreux** (rythme élevé → on
   dépense souvent au Marché). **Courbe d'XP INCHANGÉE pour l'instant** (le joueur l'ajuste après une
   grosse session de tests).

---

## 1. Architecture « Chapitres »

### 1.1 Carte de progression (15 Chapitres = 150 vagues)

| Bloc | Chapitres | Vagues (stage) | Rôle | Gate |
|---|---|---|---|---|
| **Prologue (tutoriel)** | 1 → 5 | 1 → 50 | Rampe douce, enseigne les systèmes (équipement, donjons, métiers, gemmes, résist). Murs « doux ». | aucun |
| **Vrais Chapitres** | 6 → 15 | 51 → 150 | Le cœur : vrais murs, optimisation forcée. | **Raid T(k)** |
| **Chapitre++** | > 15 | > 150 | Boss de plus en plus durs. **Pas d'ilvl.** Filet d'or/XP idle + chasse rareté. | aucun |

- Les **raids se débloquent au Chapitre 5** (dernier tuto) — il faut pouvoir tenter T1 pour entrer en Chapitre 6.
- **Gate (tranché) : battre le Raid T(k) débloque l'accès au Chapitre (5+k).** Tant que T(k) n'est pas
  vaincu, on **plafonne au Chapitre (4+k)**. Concrètement : **T1 absent → bloqué au Chapitre 5** ; T1
  vaincu → **Chapitre 6** ; … ; T10 vaincu → **Chapitre 15**. (10 tiers ↔ 10 vrais Chapitres.)
- **ilvl capé à 200.** `PENTE_VAGUE` recalé (~1,33) pour que `frontierIlvl(stage 150) ≈ 200`, clamp dur à 200
  pour le contenu de base. Au-delà (Chapitre++), les boss montent en difficulté **sans** monter l'ilvl.
  Les **raids endgame (Abîme)** sont la seule chose qui dépasse 200 (de peu) → le grind de stuff ultime.

### 1.2 Ce que ça résout
- **Anti-trivialisation multi-perso** : on ne peut plus « sauter » des chapitres — chaque vrai Chapitre
  est gaté par un raid à battre **optimisé**. Un 2ᵉ perso ne fait pas gagner 110 chapitres d'un coup.
- **Early structuré** : le Prologue donne des objectifs clairs sans mur infranchissable.
- **Endgame horizontal** : ilvl capé → la puissance vient de la qualité/rareté/gemmes/runes/talents/multi-perso.

---

## 2. Économie (REFONTE — inversion v0.35)

### 2.1 Qui donne quoi

| Source | Or | XP | Autres |
|---|---|---|---|
| **Farm classique (Chapitres)** | ✅ **seule source** | ✅ **seule source** | stuff (filet), butin de boss |
| **Donjons** | ❌ retiré | ❌ retiré | ressource dédiée only (rareté/Cache, noyaux, poussière, sceaux, orbes, gemmes) |
| **Raids** | ❌ | ❌ | qualité top (sets/uniques/résist), trophées, fragments, éclats cosmiques |
| **Marché** | dépense l'or | — | caisses → gear / rareté + parties « amélioration » |

- **XP → niveau de COMPTE → points de talent** (pool **partagé**, §4). L'XP est **time-gatée** : plus on
  joue (idle), plus le compte level, plus on débloque de talents.
- **Or → Marché** (caisses de gear / rareté + améliorations) et craft.
- **🗑️ SUPPRESSION des 2 donjons Or/XP** : **Chambre du Trésor** (`or`, reward `gold`) et **Sanctuaire du
  Savoir** (`savoir`, reward `xp`) ([dungeons.ts:61-72](src/game/dungeons.ts)) — sans objet une fois l'or/XP
  retirés des donjons. Retirer de `DUNGEONS`/`DUNGEON_LIST`, gérer les rewards orphelins (`gold`/`xp`).
- **Retrait de l'or/XP du reste des donjons** : supprime `DUNGEON_FIGHT_XP_MULT` ([store.ts:300](src/game/store.ts)),
  le cas `gold`/`xp` du rendement donjon ([store.ts:3988](src/game/store.ts), [store.ts:4050](src/game/store.ts),
  [dungeons.ts:337](src/game/dungeons.ts)), et l'or/XP offline ([offline.ts:56-58](src/game/offline.ts)).
  → **tue le snowball** « farm donjon = +dizaines de niveaux d'avance ».

### 2.2 Calibrage de la courbe de farm (source unique)
- **OR = généreux, rythme élevé** : calé sur les prix du Marché pour qu'on puisse y **dépenser souvent**
  (coffres + améliorations). C'est le seul robinet d'or → il doit couler franchement.
- **XP = courbe INCHANGÉE pour l'instant** : `enemy.xp = (4→38) × 1,115^(stage−1)` ([enemies.ts:199](src/game/enemies.ts))
  + `xpForLevel` ([store.ts:731](src/game/store.ts)) restent tels quels. **Le joueur ajustera après une
  grosse session de tests.** L'anti-snowball ne repose PLUS sur l'aplatissement de la courbe mais sur le
  **cap d'ilvl 200 + le retrait or/XP des donjons + le gate-raid**.
- Outils de calage : `scripts/eco-sim.mjs`, `scripts/ttk-sim.mjs`.

### 2.3 Chapitre++ (au-delà du Chapitre 15)
Boss de plus en plus durs qui **continuent à dripper or/XP** (idle) **sans monter l'ilvl**. Sert à
nourrir le pool de talents + l'or de Marché + la chasse à la rareté. Pas un escalier de puissance.

---

## 3. Donjons = difficulté FIXE, mappée au Chapitre (correctif du « bug »)

**Malentendu v0.35 levé.** Intention réelle : **donjon niveau N = difficulté ABSOLUE fixe**, calibrée
pour correspondre au **Chapitre N**. Chapitre 1 → donjon niv 1 ; Chapitre 2 → niv 2… On monte les
niveaux de donjon **en parallèle** des chapitres ; le niv 1 reste à jamais le niv 1 (finit trivial = voulu).

- **Bug actuel** : `dungeonContentIlvl(level, bestStage)` recalcule la difficulté à partir du `bestStage`
  **en direct** ([dungeons.ts:387](src/game/dungeons.ts)) → le niv 1 « gonfle » avec le joueur, jamais dépassé.
- **Fix** : difficulté = **fonction fixe du niveau de donjon**, mappée sur la difficulté du Chapitre N,
  **indépendante de `bestStage`**. Idem `raidIlvl`/`dungeonIlvl` qui s'appuient sur `lootFarmIlvl(bestStage)`.
- Le loot de donjon reste **dans la tranche d'ilvl du niveau** (rareté/mats), jamais un escalier d'ilvl.

---

## 4. Budget partagé entre persos (anti-snowball multi-perso)

**Décision (tranchée) : plus de niveau par perso → un seul NIVEAU DE COMPTE.** Tout est commun aux 2
persos : **matériaux de craft, or** (déjà fait), **points de talent ET niveau**.

- **Niveau de compte** : l'XP de farm alimente **un seul niveau global**. Tous les persos partagent ce
  niveau (les recrues rejoignent **au niveau de compte** → zéro re-grind, et un 2ᵉ/3ᵉ perso n'ajoute NI
  niveau NI points). La puissance venant surtout du stuff ([character.ts:43](src/game/character.ts)),
  retirer le niveau par-perso est peu risqué côté stats.
- **Points de talent = pool partagé** dérivé du niveau de compte : chaque perso **alloue dans son propre
  arbre** mais **puise dans le pool commun**. Plus de persos n'ajoute PAS de points.
- **Refactor** : sortir `level`/`xp`/`talentPoints` de `Character` vers l'état global ; adapter
  `grantXp`, `talentPointsForLevel`, `makeCharacter` (recrue sans niveau propre), l'UI (CharacterPanel,
  LevelBadge, HerosHub).
- **Conséquence sur les retours** : le bug « badge points de talent = somme de tous les persos »
  ([HerosHub.tsx:44](src/components/HerosHub.tsx)) **est ABANDONNÉ** — un pool partagé EST global, l'affichage
  agrégé devient correct par construction.

---

## 5. Bugs mécaniques (à corriger — peu de débat)

### 5.1 🔴 CRITIQUE — IDs de perso non uniques après reload
`let charSeq = 1` est un compteur **module-level réinitialisé à chaque chargement**, jamais resynchronisé
avec la save ([character.ts:38](src/game/character.ts), id à [character.ts:68](src/game/character.ts)).
Après un reload, la prochaine **recrue** récupère un id **déjà pris** (`char-1`) → collision.
`setAvatar(charId)` / `setTitle(charId)` mappent par id ([store.ts:7021](src/game/store.ts),
[store.ts:7013](src/game/store.ts)) → **deux persos changent ensemble** = bug « l'apparence change pour
tous les héros ». Touche potentiellement tout l'état keyé par `char.id` (cooldowns `charId:powerId`, etc.).
- **Fix** : id robuste (`crypto.randomUUID()`) **ou** resync `charSeq > max(ids chargés)` au load.
- *(Repro : recruter un perso après un refresh.)*

### 5.2 🟠 Boucliers cumulables + persistants entre combats
`c.absorb` cumulé **additivement** par talents/gemmes ([store.ts:2656](src/game/store.ts),
[store.ts:2660](src/game/store.ts)), Trésorerie par kill ([store.ts:948-954](src/game/store.ts)), et
**non remis à zéro entre deux ennemis de farm** → on pré-charge sur du trash puis on tape le boss.
Sources incohérentes (`max` vs `+`).
- **Fix (tranché)** : (1) boucliers de talent en **`max()` (remplace)** pas en `+` ; (2) **RESET DUR hors
  combat** (`absorb = 0` à la fin de chaque combat / hors instance) → impossible de pré-charger sur du
  trash ; (3) cap global d'`absorb` en % des PV max.

> Note : le bug « badge points de talent » (ex-A2) est **abandonné** → remplacé par le pool partagé (§4).

---

## 6. Calibrage & UX

### 6.1 Ultimes sous-puissants (confirmé)
DPS/CD des ultimes < sorts de base ([powers.ts:174-228](src/game/powers.ts)) :

| Sort | mag | cd | mag/s |
|---|---|---|---|
| Nuke de base | 5,0 | 3,5 s | **1,43** |
| Ultime executeNuke | 4,0 | 12 s | **0,33** |
| Ultime megaCleave | 7,0 | 20 s | 0,35 |

- **Fix** : remonter fortement la **magnitude par cast** (cible : **le plus gros coup du jeu** ; DPS/CD ≥
  un bon sort de base + bonus de burst). Ordre de grandeur nuke ultime ~15-25 de mag. Valider `npm run ttk`.

### 6.2 Coût de craft décorrélé du drop réel
`contentRarityTier(stage)` sous-évalue ce qui droppe (Cache du Pilleur sort de l'Artefact dès le rang 1),
et le « hors-contenu » coûte **×4/cran** ([items.ts:312](src/game/items.ts), [items.ts:317](src/game/items.ts))
→ Artefact (t7) à 3 crans au-dessus de Rare = **×64** ≈ centaines/milliers de runs.
- **Fix** : ancrer le coût sur la **probabilité de drop réelle, tout contenu débloqué confondu**
  (`reachableRarityTier`), recalibrer `OVER_CONTENT_STEEP` + `CRAFT_RUNS_TARGET`.
  Cibles : **Légendaire ~1-2 runs**, **Artefact ~30 runs**, **Cosmique+ = chase (raids)**.

### 6.3 Indicateur item « ⬆N objets meilleurs » → à RETIRER (pas les Δ !)
- **GARDÉ** (factuel, bi-dimensionnel — « génial ») : Δ DPS ⚔ / Δ Survie 🛡 par ligne
  ([ItemRow.tsx:158-172](src/components/ItemRow.tsx)).
- **RETIRÉ** : la pastille **`⬆N`** sur les **slots équipés** (« N objets en sac améliorent cet
  emplacement », [StuffScreen.tsx:675-679](src/components/StuffScreen.tsx)) + son jumeau HeroBar
  ([StuffScreen.tsx:527](src/components/StuffScreen.tsx)) — calculés sur `itemScore` **brut**
  ([StuffScreen.tsx:171-183](src/components/StuffScreen.tsx)), verdict mono-dimension trompeur. On
  supprime `upgradeCounts` et ses 2 affichages.

### 6.4 Compteur de boucliers visible en combat (mobile-friendly)
Afficher la valeur d'`absorb` en chiffre lisible sur la barre de PV (ex. `🛡 12,4k`), sans survol. À
coupler avec la refonte du modèle de bouclier (§5.2).

### 6.5 🔵 Refonte de l'UI de combat multi-perso
À plusieurs persos, l'UI déborde et on n'accède pas à tous les sorts. Le multi-classe étant **assumé en
endgame**, il faut un **écran de combat dédié et épuré** : une rangée de capacités **par perso**
(compacte/repliable), retrait des éléments parasites hors-combat. Chantier UI à part entière (maquettes
à produire).

### 6.6 Mage-Arcane : Clignement keystone → Téléportation passive
Aujourd'hui `ar_clignement` = keystone de stats ([talents.ts:327](src/game/talents.ts)). Cible : **passif
« esquive/immunité garantie d'un coup toutes les 30 s »** (cooldown interne réduit par la Récupération).
Mécanique **neuve** à spécifier : absorbe quoi (auto-attaque ? nova télégraphiée ?), feedback visuel,
interaction boucliers. Patron réutilisable pour §6.7.

### 6.7 Plus de passifs / convertir des nodes en passifs
Passe de contenu d'arbre par classe : transformer des nodes de stat en **passifs comportementaux**
(déclencheurs, transformations de sorts, gates exclusifs) pour plus de choix de build.

---

## 7. Points tranchés (ex-questions ouvertes)
1. ✅ **Gate-raid** : battre T(k) débloque l'accès au Chapitre (5+k) ; sans T1 on plafonne au Chapitre 5.
2. ✅ **ilvl cap = 200** (contenu de base) ; seuls les raids endgame (Abîme) dépassent 200, de peu.
3. ✅ **Plus de niveau par perso → niveau de COMPTE unique** ; tout partagé (matériaux/or/talents/niveau).
4. ✅ **Boucliers : RESET DUR hors combat** (+ `max()` pendant le combat + cap %PV).
5. ✅ **Économie** : OR généreux (rythme Marché élevé) ; **courbe d'XP INCHANGÉE** (le joueur ajuste après tests).

Reste à fixer en chiffres au moment d'implémenter (knobs, pas des décisions de design) : valeur exacte de
`PENTE_VAGUE` pour viser ilvl 200 au Chapitre 15, le multiplicateur d'or de farm, le delta d'ilvl des raids
endgame au-dessus de 200, et la cible de runs par rareté pour le coût de craft (§6.2).

---

## 8. Lots d'implémentation (ordre proposé)
0. **Bugs nets** : IDs persos uniques (5.1), retrait pastille `⬆N` (6.3), compteur bouclier (6.4).
1. **Renommage Chapitre/Vague** : code (`chapitreOf/vagueOf`) + UI + seuils (`unlockStage`, raids, recrues).
2. **Structure 15 Chapitres** : Prologue 1-5, vrais 6-15, gate-raid T(k)→Chapitre(5+k), cap ilvl 200, Chapitre++.
3. **Donjons fixes** : difficulté = f(niveau) mappée au Chapitre, indépendante de `bestStage` (§3).
4. **Économie** : or/XP = farm only ; **suppression des donjons Or (Chambre du Trésor) & XP (Sanctuaire
   du Savoir)** + retrait or/XP des autres donjons/raids/offline ; **or généreux** (XP curve inchangée).
5. **Budget partagé / niveau de compte** : sortir `level`/`xp`/`talentPoints` de `Character` vers l'état global.
6. **Boucliers** : modèle `max`/reset/cap (5.2).
7. **Ultimes** (6.1) + **coût de craft** (6.2) : recalibrage validé au harnais.
8. **UI combat multi-perso** (6.5).
9. **Arbre** : Téléportation passive (6.6) + passe de passifs (6.7).

> **Aucune ligne n'est écrite à ce stade.** Implémentation lot par lot sur « go », chaque lot validé.
