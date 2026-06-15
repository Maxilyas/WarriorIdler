# DESIGN v0.30 — Refonte de la progression : courbe d'ilvl unifiée & anti-snowball

> **But** : tuer le snowball (« au bout d'un moment on one-shot tout »), poser un **cap d'ilvl à 700**,
> et **unifier farm / donjon / raid** sur une seule courbe de puissance — le tout *mathématiquement*,
> avec une invariance vérifiable (TTK constant à stuff calé).

---

## 0. Diagnostic chiffré (état v0.29)

Le snowball naît de **deux courbes qui se multiplient** :

1. **Gap d'ilvl géométrique par tier de raid** : `raidIlvl = base × 1,22^(tier-1)` → **×6,0 sur 9 tiers**
   (Forge T1=92 → T10=551). L'Abîme (`tierOffset +6`) atteint **ilvl 2622** au T10 → crève 700 par ×3,7.
2. **Fonction de transfert DPS convexe** : à **ilvl fixe (75)**, le simulateur donne Épique **48,8k** →
   Transcendant **10,9M** = **×223**, alors que `statMult` ne fait que ×9,3. Soit **DPS ≈ budget^2,4**.
   Cause : la puissance est *linéaire* en stat, mais **Hâte et Maîtrise sont des multiplicateurs non
   plafonnés** → trois canaux linéaires multipliés = courbe cubique.

Côté contenu, les PV ennemis sont **exponentiels** (`40 × 1,17^palier`) tandis que le DPS joueur est
**polynomial** : deux lois de croissance différentes **doivent** se croiser → faceroll garanti à long terme.

---

## 1. Principe directeur — invariance du TTK

Une seule loi de puissance, **base commune `b`** pour le joueur ET les ennemis :

```
Puissance(ilvl)  = P0 · b^ilvl                 (même b des deux côtés)
PV_ennemi(ci)    = H0 · b^ci · classMult        ci = ilvl du contenu
DPS_joueur(gi)   = D0 · b^gi                     gi = ilvl de stuff effectif
TTK = PV / DPS   = (H0·classMult / D0) · b^(ci − gi)
```

À stuff calé sur le contenu (`gi ≈ ci`) → **TTK = constante**. Un sur-stuff de `+Δ` ilvl ne donne
qu'une réduction **bornée** `b^Δ`. **Plus aucune boule de neige possible** (garanti par la base commune).

**Vérifié numériquement** (`b=1,03`) : TTK plat de l'ilvl 50 à 700, rareté à ilvl fixe ramenée à ×3,78.

---

## 2. Paramètres validés (décisions joueur)

| Décision | Choix retenu |
|---|---|
| **Cap 700** | Atteint mi/fin de partie ; au-delà, progression sur **autres axes** (gemmes/talents/sets/prestige) **sans monter l'ilvl**. Le stuff plafonne, le perso continue. |
| **Amplificateur DPS** | **Compresser** : rareté = bonus additif en ilvl-équiv ; Hâte/Maîtrise plafonnées. |
| **Vieux contenu** | Faceroll **assumé** (pas de level-sync). Stabilité garantie uniquement sur la **frontière active**. |
| **Ampleur** | **Refonte unifiée propre** (une seule fonction de puissance). |
| **Plafond des nombres** | Moyen **~10^9–10^10** → `b ≈ 1,03` (×2 tous les ~23 ilvl). |
| **Poids rareté** | **+3 ilvl/cran** → Médiocre→Transcendant = +45 ilvl = **×3,8** sur toute la plage. |
| **TTK cible** | Moyen : **trash ~3 s, boss ~30–40 s** (à stuff calé). |
| **Piliers** | **Hybride** : farm+donjons = montée (mêmes bandes, donjon = side-grade ciblé légèrement devant) ; raids = sommet/frontière. |

---

## 3. Courbe maîtresse

- **Base** : `b = 1.03` → ×2 tous les **23,4 ilvl** ; plage ilvl 1→700 = **×9,4·10^8**.
- **Axe ilvl** : `[1, 700]`, **linéaire** (chaque +1 ilvl = +3 % de puissance brute).
- **Cap dur** : `ILVL_MAX = 700`. Aucun drop, craft, surillvl ou trempe ne dépasse 700.

### Constantes de calibration (knobs centraux — à régler dans un seul fichier `progression.ts`)

```ts
export const POW_BASE = 1.03          // b
export const ILVL_MAX = 700
export const RARITY_ILVL_PER_TIER = 3 // +3 ilvl-équiv par cran de rareté
// Classes d'ennemi = multiplicateurs de PV = ratios de TTK (trash = 3 s de référence)
export const ENEMY_HP_CLASS = { trash: 1, elite: 2.7, champion: 4, boss: 11.7, raidboss: 13.3 }
// TTK cibles (s) à stuff calé — pilotent H0/D0 et SLOT budget
export const TTK = { trash: 3, elite: 8, boss: 35, raidboss: 40 }
// Survie : nb de secondes d'auto-attaque de boss encaissables à stuff calé (avant burst)
export const SURVIVE_SECONDS = 8
```

---

## 4. Mapping contenu → ilvl (axe unique)

Le **gear-up** (farm+donjons) plafonne en ilvl ; les **raids** portent la frontière jusqu'à 700.
(Bornes = calibration de départ, faciles à nudger.)

| Pilier | Bande ilvl | Note |
|---|---|---|
| **Farm** (paliers) | 1 → **200** | `ilvlFarm(p) = min(200, round(p · 2.5))` → cap au palier ~80. Au-delà, difficulté monte mais **loot plafonné** → pousse vers donjons/raids. |
| **Donjons** | 30 → **250** | Side-grade ciblé, **+~15 % d'ilvl devant le farm**, cap 250. `ilvlDonjon(n) = min(250, base + n·step)`. |
| **Raids base** (4) | **230 → 600** | Bandes **chevauchantes à planchers échelonnés** : Forge 230→365, Reliquaire 320→455, Citadelle 410→545, Nexus 465→600 — chacun **+15/tier** sur 10 tiers (rung ≤ +20). Échelonner les planchers (et non tout en parallèle) permet de couvrir 230→600 *sans* sauter > +20 ilvl par rung. |
| **Abîme / endgame** | **560 → 700** | `tierOffset` recalé pour démarrer ~560 (≈ Nexus T7) et finir à 700. Tiers au-delà = **même ilvl 700**, mécaniques plus dures (cf. §8). |

**Re-gating** : les raids n'unlock plus au palier 50 mais quand le gear-up t'a mené ~ilvl 230
(palier ~80 + donjons). Évite le « +170 ilvl d'un coup » qui écraserait.

**Pas par rung** (anti-snowball local) : aucun rung consécutif de la frontière ne saute **> +20 ilvl**
(+20 ilvl = ×1,81 TTK max → jamais de trivialisation du rung précédent). Paliers de farm = +2,5 (fins) ;
tiers de raid = +15 (gros mais bornés).

---

## 5. Refonte du budget d'objet (le cœur)

Aujourd'hui : `budget = ilvl · weight · statMult · qMult` → **linéaire** en ilvl → DPS polynomial.
Demain : **exponentiel** en ilvl, rareté = **+ilvl-équiv** (pas un multiplicateur qui se fait cuber) :

```ts
// ilvl effectif d'un objet = ilvl + bonus de rareté (en ilvl-équiv)
const effIlvl = item.ilvl + RARITY_ILVL_PER_TIER * (rarityTier - 1)
budget = BUDGET0 · POW_BASE^effIlvl · typeMeta.weight · qMult
```

- **Stat primaire** (= la puissance) : `primaryValue = budget · offFrac`. **Seule** porteuse de la
  puissance `b^ilvl` → `power ∝ b^ilvl` → `DPS ∝ b^ilvl`.
- **Endurance** : idem (`b^ilvl`) → PV ∝ b^ilvl → EHP suit les dégâts ennemis (`b^ilvl`) → **survie constante**.
- **`statMult` (rarities.ts)** : **ne sert plus à la puissance**. Repurposé pour :
  `affixCount` (nb de lignes) + qualité. On peut **aplatir** la courbe `statMult` (≈ 1 partout) ou la
  garder pour des micro-effets — la puissance de rareté passe désormais **entièrement** par `+3 ilvl/cran`.
- **`maxRarityTierForIlvl`** : conservé (anti « ilvl 30 Transcendant »), mais re-calé sur la nouvelle échelle.
- **surillvl / craft / trempe** : plafonnés **durs à ilvl 700** (`SURILLVL_OVER_MARGIN` → marge nulle au cap).

**Vérifié** : DPS ∝ b^ilvl, TTK plat 50→700 ; rareté à ilvl fixe ×1,0 (Médiocre) → ×3,78 (Transcendant).

---

## 6. Compression des stats secondaires (tuer l'exposant convexe)

Problème : `RATING_PER_PERCENT = 50` est **fixe**, donc à ilvl élevé un rating énorme → % illimité →
Hâte/Maîtrise explosent multiplicativement.

**Solution** : les secondaires donnent un **% borné, indépendant de l'ilvl** — de l'**identité de build**,
pas de l'inflation de puissance.

- Les lignes de stat secondaire roulent un **% normalisé** (ex. `+4,2 % hâte`) au lieu d'un rating
  ensuite divisé ; OU `RATING_PER_PERCENT` devient `∝ b^ilvl` (mêmes %, peu importe l'ilvl).
- **Plafonds (softCap) sur les canaux multiplicatifs** :
  - Hâte : att/s plafonné (ex. asymptote **×2,2**).
  - Maîtrise : `masteryMult` asymptote (ex. **+60 %** INT, moins ailleurs).
  - Crit : déjà soft-cappé (0,75/0,92) — OK.
  - Bonus de type : déjà soft-cappé (0,6/1,2) — OK.
- Résultat : à ilvl fixe, l'écart entre stuff « jet pourri » et « god-roll » reste **≈ ×1,5–2**
  (variance de jeu saine), pas ×200.

---

## 7. Calibration TTK & survie

### Dégâts (DPS)
1. Choisir `SLOTS·BUDGET0·OFF` pour que, à ilvl `ci` avec rareté plancher du contenu, le **trash meure
   en `TTK.trash` (3 s)**.
2. Les autres classes héritent du TTK via `ENEMY_HP_CLASS` (= ratios de TTK) : élite 8 s, boss 35 s, etc.

### Survie (EHP vs dégâts ennemis)
1. **Dégâts ennemis** : `enemyDmg(ci) = D0 · b^ci · classMult` — **même base b** → la pression suit
   la montée (fini le one-shot exponentiel ; fini aussi le « trop mou »).
2. Caler `D0` et le budget Endurance pour qu'à stuff calé, le joueur encaisse **`SURVIVE_SECONDS` (8 s)**
   d'auto-attaques de boss + **une** nova (`NOVA_MULT`) avant de mourir.
3. **Modèle de résistance (resist.ts)** : conservé tel quel (exigences relatives `req`, `M = 1+KMAX·…`).
   Les `req` (farm/donjon/raid) se recalent simplement sur le nouvel axe d'ilvl (cf. §4) — toujours
   « ×1 au cap, jusqu'à ×5 à nu ». C'est **le** check de stuff, orthogonal à la courbe de puissance.

---

## 8. Endgame post-700 (axes plats)

Une fois l'ilvl plafonné à 700, la puissance ne vient plus que de **multiplicateurs plats** (n'inflent
pas l'ilvl, ne cassent pas la base `b`) :

- **Gemmes de condition**, **talents/keystones**, **bonus de set**, **qualité ⭐**, **quintessences**,
  **reliques de prestige**.
- Cible : un perso **pleinement investi** ≈ **×3–×8** au-dessus d'un perso « juste ilvl 700 nu ».
- Usage : pousser les **tiers d'Abîme au-delà du cap** (PV/dégâts toujours `b^700` mais **mécaniques
  plus dures** : enrage plus court, novas plus denses, exigences `req` plus hautes) — un mur de
  *skill/build*, pas d'ilvl. Le DPS/EHP « brut » reste à l'échelle 700 → pas de re-snowball.

---

## 9. Prestige

- **Relique** (`relicFromItem`) : conserve lignes/unique/gemmes/qualité, **ramène l'ilvl au plancher**,
  stats rescalées au prorata `b^ilvl`. On re-grimpe la courbe (rapide, car le vieux contenu est faceroll
  — assumé). Le plancher de prestige et la courbe unifiée doivent rester cohérents (rescale `b^ilvl`).

---

## 10. Plan d'implémentation (lots ordonnés)

> Principe : **harnais d'abord** (filet de sécurité chiffré), puis on bouge les formules une couche à
> la fois en re-vérifiant le TTK à chaque étape.

- **LOT 0 — Harnais TTK** (`scripts/ttk-sim.mjs`, `npm run ttk`)
  Étend `build-sim` : pour chaque build (FOR/AGI/INT) et chaque ilvl de contenu (50→700, pas de 50),
  calcule TTK trash/élite/boss/raidboss **à stuff calé** + à `±20/±80` ilvl. **Critère de succès** :
  TTK calé dans la bande cible et **plat** (variance < ±15 %) sur toute la plage. Sert de garde-fou
  pour tous les lots suivants.

- **LOT 1 — `progression.ts`** : module central des constantes (§3) + helpers
  `powerAt(ilvl)`, `enemyHp(ilvl, class)`, `enemyDmg(ilvl, class)`, `ilvlFarm/Donjon/Raid(...)`.
  Aucune logique de gameplay déplacée encore : juste la source de vérité chiffrée.

- **LOT 2 — Budget d'objet exponentiel** (`items.ts`, `rarities.ts`)
  `generateItem` budget → `b^effIlvl` ; rareté = `+3 ilvl/cran` ; `statMult` repurposé (lignes/qualité) ;
  caps surillvl/craft/trempe à 700 ; `maxRarityTierForIlvl` recalé. Re-run harnais.

- **LOT 3 — Compression des secondaires** (`stats.ts`, `items.ts`)
  Secondaires en % bornés indépendants de l'ilvl ; plafonds Hâte/Maîtrise. Re-run harnais → l'écart
  god-roll/jet-pourri doit retomber à ~×1,5–2.

- **LOT 4 — Ennemis de farm** (`enemies.ts`)
  `stageIlvl` → `ilvlFarm` (cap 200) ; HP/dégâts → `b^ilvl · classMult` ; xp/armure/req recalés.

- **LOT 5 — Donjons** (`dungeons.ts`)
  `dungeonIlvl` (cap 250, side-grade) ; courbes HP/dégâts → unifiées ; offsets de départ supprimés
  (l'ilvl porte tout maintenant).

- **LOT 6 — Raids** (`raids.ts`)
  `raidIlvl` **linéaire** par bande (§4, +~15/tier) ; `bossHp/bossDamage` → `b^ilvl · classMult` ;
  Abîme `tierOffset` recalé (démarre ~560, finit 700) ; `raidReq` recalé ; fenêtres de rareté revues
  (le pic suit l'ilvl, pas un statMult qui explose). **Re-gating** des unlocks.

- **LOT 7 — Endgame post-700 & prestige** (`prestige.ts`, sets/gemmes/talents)
  Plafonner l'ilvl à 700 partout ; brancher les axes plats (§8) ; tiers d'Abîme post-cap = mécaniques
  plus dures à ilvl 700 constant. Cohérence relique/`b^ilvl`.

- **LOT 8 — Équilibrage fin & UI**
  Passe `npm run ttk` + `sim`/`survival`/`dungeon`/`eco` ; ajuster les knobs de `progression.ts` ;
  vérifier les affichages d'ilvl/DPS/TTK recommandés (RaidPanel, fiches de boss).

---

## 11. Critères de validation (mesurables)

À chaque lot, `npm run ttk` doit montrer :
1. **TTK plat** sur 50→700 à stuff calé (trash 3 s ±15 %, boss 35 s ±15 %).
2. **Sur-stuff borné** : +20 ilvl → TTK ÷1,8 max ; pas d'explosion.
3. **Rareté à ilvl fixe** : écart max ×3,8 (drop) / ×~2 (rolls) — jamais ×200.
4. **Aucun ilvl > 700** nulle part (drop/craft/surillvl/raid T-max/Abîme).
5. **Survie** : à stuff calé, le joueur encaisse ~8 s de boss + 1 nova (ni one-shot, ni invincible).

---

---

## Statut

- **LOT 0 — ✅ FAIT** : `src/game/progression.ts` (source de vérité) + harnais `scripts/ttk-sim.mjs`
  (`npm run ttk`). Modèle **validé** : TTK plat 50→700 (trash 3 s / boss 35 s, écart < 0,5 %), sur-stuff
  borné (+20 ilvl = ×1,81), rareté ×3,78 max, survie plate ~8 s, aucun ilvl > 700.
- **LOTS 1-8 — à venir** (cf. §10). Prochain : LOT 1/2 (câbler `progression.ts` dans `items.ts`,
  budget exponentiel) puis re-vérifier via `npm run ttk` branché sur le vrai code character.

*Constantes solvées par le harnais : `K_DPS=1.141`, `K_HP=24.96` (ENEMY_HP0=40, ENEMY_DMG0=6).*
