# DESIGN v0.35 — Axe de Palier unique & murs d'optimisation

> Statut : **conception validée, rien codé.** Ce document est la référence du chantier.
> Décidé en session avec le joueur (2026-06-17). Remplace le modèle des 3 axes d'ilvl
> désynchronisés (cf. `DESIGN_v0.30.md`). Voir aussi la mémoire `warrior-idler-v035-axe-palier-unique`.

---

## 0. Le problème qu'on résout

Aujourd'hui l'ilvl est porté par **trois axes parallèles** aux lois différentes :

| Système | Dial | Loi d'ilvl actuelle | Plage |
|---|---|---|---|
| Farm | palier | `palier × 2.5`, capé 200 | 3 → 200 |
| Donjon | niveau de donjon | `40 + niveau × 14`, capé 250 | 54 → 250 |
| Raid | tier | `plancher + (tier−1)×15` | 230 → 700 |

Le joueur arrive à ilvl 97 et le « donjon 1 » est calé sur ilvl 54 → contenu mort. Les trois
dials ne se suivent pas, rien ne pointe la frontière, et les donjons/raids sont des escaliers
d'ilvl **concurrents** du farm.

**Objectif de design** : fonctionner par **paliers**. Optimiser son stuff à fond pour battre le
boss et monter. La progression ne doit PAS être un défilé d'équipement (monter trop vite = juste
changer de gear) mais une **énigme d'optimisation** pour cracker la marche suivante.

---

## 1. Vocabulaire (renommage acté)

- **Palier** = bloc de 10 pas de farm, **fermé par un boss-MUR**. C'est l'unité joueur.
  « Passer un Palier » = battre le boss. Affiché « Palier I, II, III… ».
- **Vague** = un pas de farm dans un Palier (vague 7/10).
- Le code garde son `stage` interne ; on dérive `palier = ⌈stage / 10⌉`, `vague = ((stage−1) mod 10) + 1`.
- **Mur** = le boss de fin de Palier (vague 10).

---

## 2. Principe directeur : un seul escalier + retard de gear

### 2.1 Un seul axe d'ilvl
**Seul le Palier monte l'ilvl.** Donjons, raids et biomes deviennent des **outils horizontaux
de qualité** (§9) qui n'augmentent JAMAIS l'ilvl.

### 2.2 La boucle fermée (le cœur)
L'ilvl est **gaté par le mur** : bloqué au Palier 10, on ne farme que les Paliers 1-9, donc l'ilvl
plafonne à `loot(Palier 9)`. Le mur est à `frontière(Palier 10)`. **L'ilvl manquant n'existe nulle
part** tant que le mur n'est pas tombé → on **ne peut pas out-ilvl un mur**. La seule sortie =
**qualité du build** → l'optimisation est forcée, pas optionnelle.

### 2.3 Retard de gear permanent (variante DURE)
Le loot d'un Palier sort à `frontière − LAG`. Le joueur est **toujours** sous-stuffé par rapport
à la frontière, même en farm. Cela **casse volontairement l'invariant-TTK de la v0.30** (qui
rendait tout équivalent à stuff calé). Le retard est ce que l'optimisation comble.

> La difficulté monte via le **LAG** + l'**empilement de checks** au mur — **JAMAIS** via un saut
> d'ilvl plus gros. C'est ce qui donne *à la fois* des murs de plus en plus durs **et** du gear
> qui dure (§7).

---

## 3. La courbe maîtresse unifiée

On garde la base de puissance v0.30 (`POW_BASE = 1.018`, `powerAt(ilvl) = b^ilvl`).

```
frontièreIlvl(stage) = round(stage × PENTE_VAGUE)     // PENTE_VAGUE = 1.0 ilvl/vague
                     ⇒ ~10 ilvl par Palier
ILVL_PLAFOND ≈ 400   au Palier 40 (fin de l'escalier → prestige)
```

| Repère | ilvl | puissance relative |
|---|---|---|
| Palier 1 (vague 10, 1er mur) | ~10 | ×1 |
| Palier 20 | ~200 | ×1,018^190 ≈ ×29 |
| Palier 40 (dernier mur) | ~400 | ×1,018^390 ≈ ×1050 |
| Par Palier (+10 ilvl) | — | **×1,20** |
| Sur 2 Paliers (+20 ilvl) | — | **×1,43** (montée douce) |

**Pourquoi ~400 et pas 700** : le joueur trouvait 700 trop fort/trop rapide. Ce n'est pas l'ilvl
qui fait durer le jeu — c'est la **dureté croissante des murs**. On garde des pas d'ilvl **petits**
et on rend le jeu long en **nombre de Paliers**. Au-delà du Palier 40, **le prestige** reprend la main.

> `ILVL_MAX = 700` (cap dur v0.30) reste comme garde-fou absolu, mais n'est plus jamais atteint
> par le contenu de base (il sert au surilevel/prestige extrêmes).

---

## 4. Le retard de gear (LAG)

```
LAG(palier) = LAG0 + K_LAG × palier        // LAG0 ≈ 4 ,  K_LAG ≈ 0,9
```

| Palier | LAG (ilvl) | gear vs frontière (puissance) |
|---|---|---|
| 1 | ~5 | ×0,91 (≈ −9 % : quelques minutes d'optim) |
| 20 | ~22 | ×0,67 |
| 40 | ~40 | ×0,49 (le mur vaut ~2× ton gear nu) |

Le LAG est un **knob central**. Il pose l'écart que l'optimisation doit combler. Early = petit
(le 1er mur ne doit JAMAIS être infranchissable d'emblée) ; late = large (il faut TOUT investir).

---

## 5. ⭐ Le Potentiel d'Optimisation (cœur du calibrage)

**Règle d'or : le mur se calibre contre un build OPTIMISÉ, jamais contre l'ilvl nu.** L'ilvl nu
amène à ~80 % du kill ; les 20 % qui font tomber le mur viennent de TOUT le reste. Le harnais
d'équilibrage doit donc modéliser **tout le stack**, sur les **3 dimensions** : dégâts, soin, survie.

### 5.1 Enveloppe par source (valeurs réelles du code, mi-2026)

| Source | Dégâts | Survie | Soin / Sustain |
|---|---|---|---|
| **Secondaires** (`stats.ts`, soft-capés) | crit ≤92 % × dcrit ≤×4 ; hâte ≤+150 % ; maîtrise ≤+60 % ; pén ≤82 % ; altération ≤+550 % (DoT) ; dégâtsBoss ≤+450 % ; surpuissance ≤+400 % | réducDmg ≤72 % ; esquive ≤62 % ; barrière ≤+60 % PV ; ténacité ≤96 % ; purge ≤93 % | volDeVie ≤72 % ; régen |
| **Gemmes** (`condGems.ts`, comportements) | Acharné +50→100 %, Souffle +20→50 %, Nuée +35→60 %, Opportuniste +30→80 %, Crescendo/Marche/PiedDuMur +10→52 %, Tambour (brèche armure) | Égide −30→60 % (1er coup), Granit −15→35 %, Ancrage −5→15 %, Rempart, Carapace (bouclier), Cilice (épines) | Glas, Calice (bouclier), Perfusion, Garrot, Vases, Goutte |
| **Runes ⏳ Temps** (`enchants.ts`) | Usure +8 %/10 s (×3), PremierÉlan +50 % aps 10 s, HâteFunèbre +18 % aps, Sabliers, AvanceRapide (DoT) | Latence −30 % 8 s, Sursis (survie 25 % PV/min), Rembobinage, Stase | (via recharges de capacités de soin) |
| **Pacte 🩸** (1 actif, bonus/malus) | Verre +35 %, Berserk +30 %, Colosse +60 %/coup, LignesLey +25 %, Ermite +55 % (solo), Meute +8 %/héros | Plomb +35 % PV, Roc −15 %, Ermite +55 % PV | SangVicié +40 % vol de vie, Jeûne (6 % PV/kill) |
| **Alchimie ⚗️** (consommables, qualité ×0,75→1,5) | Élixir +8 %, Huile +12 % (élément), Mutagène ±8-12 % | Élixir vigueur +12 % PV, Antidote −15 % (type), Potion garde (bouclier 25 %) | (régén via élixirs) |
| **Uniques** (`uniques.ts`, montent en rang × ilvl/rareté) | mods de stat (ex. hâte +45, mult +18, INT +70) + effets actifs | mods défensifs + résist | mods de soin |
| **Talents** (`talents.ts`, handcraftés/classe) — **le plus gros levier** | empilement de ×1,12-1,18 (tagBonus, damageMult), exécutions ×2,2-2,4, signatures (HotStreak ×2,6, Surcharge ×1,4), convergence | nœuds de réduction, esquive, PV | sorts de heal/leech, nœuds de sustain |

**Lecture** : un build **pleinement kitté** vaut, sur un objet nu de même ilvl, **×8 à ×25 en
dégâts** et **×2 à ×3 en survie effective**. C'est ÉNORME — d'où l'impératif : la difficulté
suppose qu'une grande partie est investie.

### 5.2 Le « build attendu » et le taux d'optimisation τ(palier)

À chaque Palier on définit deux références (modélisées par le harnais) :

- **Build NU** = loot ilvl + **stat primaire seule** (zéro secondaire/gemme/rune/pacte/alch/talent).
- **Build CIBLE** = loot ilvl + la fraction `τ(palier)` du stack attendue à ce stade.

```
τ(palier) :  Palier 1-10 → ~40 %   ·   11-25 → ~65 %   ·   26-40 → ~90 %
```

| Tranche | Ce que le Build CIBLE contient | Dimension(s) sollicitée(s) |
|---|---|---|
| **P1-10** (τ ~40 %) | secondaires bien roulés, 1-2 gemmes bas rang, alchimie de base | surtout **dégâts** (1 check) |
| **P11-25** (τ ~65 %) | gemmes rang 3-4, runes de temps, **1 pacte**, ~½ arbre de talents, 1-2 uniques | **dégâts + survie** (2 checks) |
| **P26-40** (τ ~90 %) | gemmes rang max/qualité parfaite, pacte optimal, **arbre + convergence**, uniques haut rang, alchimie millésime, sets | **dégâts + survie + soin** (3 checks) |

### 5.3 Règle de calibrage (opérationnelle)

Le mur du Palier `p` est calé pour que :
1. **Build NU → ÉCHOUE** (TTK > enrage *ou* meurt à la nova/au sustain ennemi).
2. **Build CIBLE → PASSE**, avec une **marge qui se resserre** quand `p` monte
   (`margeMur(p)` : ~1,3 à P10 → ~1,05 à P40 → late = quasi sans slack, optimisation quasi-parfaite exigée).

C'est ce double test (NU échoue / CIBLE passe) qui transforme le `LAG` brut en **exigence
d'optimisation réelle**, et il couvre les 3 dimensions parce que les checks du mur (§6) les testent
toutes.

---

## 6. Le mur (boss de fin de Palier)

### 6.1 Difficulté
```
murHp(p)   = enemyHp(frontièreIlvl(10·p), 'boss') × MUR_HP_CLASS × margeMur(p)
murDmg(p)  = enemyDmg(frontièreIlvl(10·p), 'boss') × MUR_DMG_CLASS
enrage(p)  = murHp(p) / dpsCible(p)        // dpsCible = DPS du Build CIBLE
```
La frontière du mur intègre le `LAG` parce que le **loot** du joueur, lui, sort à `frontière − LAG`.

### 6.2 Une mécanique DOMINANTE par mur (révisé après le harnais — `sim-mur.mjs`)

Le harnais a montré que **seul le DPS/enrage discrimine finement** : l'écart d'EHP entre un build
optimisé et un sous-optimisé est structurellement trop petit (les PV suivent l'ilvl quel que soit le
build, les soft-caps défensifs compressent). Forcer 3 checks co-égaux à chaque mur est donc
impossible sans rééquilibrage lourd du combat.

**Décision (joueur) : murs VARIÉS, une mécanique DOMINANTE par mur, façon boss de raid, CYCLÉE** sur
le parcours. Les 3 dimensions comptent **sur le parcours**, pas à chaque mur. Le DPS/enrage reste
l'**ossature** présente partout (le gate qui filtre l'optimisation) ; la dominante ajoute le défi de
la dimension du mur.

| Dominante | Mécanique (`raids.ts`) | Ce que le mur EXIGE en plus du DPS |
|---|---|---|
| **Course au DPS** | `berserk` (enrage serré) | dégâts purs : tout le stack offensif |
| **Mur de survie** | `nova` / `execute` | EHP/mitigation : END + réducDmg/esquive/barrière + gemmes bastion + runes + alch antidote |
| **Mur de sustain** | `leech` / DoT (`swarm`) | soin : régen/volDeVie + gemmes flux + talents heal + pacte sangVicié |
| **Forteresse** | `fortress` | pénétration : sinon le DPS s'effondre |
| **Prisme** | `rotate` | résistance large → te dit quel **biome** préparer (§9) |

- **Enrage DUR partout** (l'ossature) : `enrage(p) = TARGET_BOSS_TTK × margeMur(p)` ; le Build CIBLE
  clear, le sous-optimisé tape l'enrage et échoue. `margeMur` se resserre tard (§5.3).
- La **dominante** est calée pour MORDRE sur sa dimension à ce Palier (ex. nova qui RAMPE — nulle
  avant ~P20, pleine à P40 ; cf. finding du harnais : la survie n'est viable comme mur qu'une fois
  les défenses mûres).
- L'**élément tourne** par mur → fiche de mur (`raidReqs`-like) affichée avant l'engagement → indique
  la dominante + l'élément → le joueur prépare son stuff (et le **biome**, §9).
- **Pic de difficulté relatif en milieu de jeu (P20-25)** : avant que les soft-caps « s'allument ».
  Knob `margeMur` à reshaper pour garder le late tendu.

---

## 7. Longévité du stuff (anti-obsolescence)

La pente douce (§3) + la **réserve de rareté** donnent la durée de vie GRATUITEMENT :

- `RARITY_ILVL_PER_TIER = 8` (garde) : une rareté = +8 ilvl-équivalent.
- Une **belle rare** (+3 crans sur la baseline) = +24 ilvl-équiv = ~2 Paliers d'avance → **tient ≥ 2 Paliers**.
- Une **top rareté** (dropée OU ascensionnée) = 3-4 Paliers → **trophée**.

| Pièce | Durée de vie | Ressenti |
|---|---|---|
| Baseline | ~1 Palier | rotation normale |
| Belle rare (+3 crans) | ~2 Paliers | « je la garde » |
| Top rareté | 3-4 Paliers | trophée |

> Puissance de rareté **ADDITIVE en ilvl-équiv** (jamais convexe → pas de snowball, cf. v0.29).
> Le « ressenti » des hautes raretés (abyssal/primordial/transcendant) vient de leur **rareté de
> drop** + leur **longévité**, PAS d'un pic de puissance.

---

## 8. Anti-fossilisation du stuff (surilevel / ascension / portabilité)

Le but du jeu = **trouver plus rare et plus fort**. Trois garde-fous pour que le craft soit un
**pont**, jamais un substitut à la chasse :

1. **Surilevel = pont d'ilvl UNIQUEMENT** (jamais de rareté). Déjà capé au contenu courant
   (`ComparePanel.tsx`, `surillvlCost`). Une pièce surilevelée reste à sa rareté → un drop rare
   frais la bat toujours. Inoffensif une fois la rareté = vrai axe de puissance.
2. **Ascension de rareté = GARDÉE jusqu'au sommet** (choix du joueur) **mais coût brutal + mats
   drop-gated** (Noyaux primordiaux des boss, Éclats cosmiques 💫 des raids). En pratique : **1
   pièce signature** par cycle de prestige, jamais le kit. Garde-fou : coût d'ascension **>** chemin
   « droppe + change » → c'est la prime sentimentale, pas la route optimale. Comme l'ascension
   *consomme* les drops rares, elle ne les contourne pas → la haute rareté reste un événement.
3. **Investissement PORTABLE** (nouveau) : extraction des gemmes/runes/enchants vers une nouvelle
   pièce (à un coût). C'est ce qui débloque la rotation : on swappe sur le drop rare **sans rien
   perdre**. La pièce devient jetable, l'optimisation voyage. *(À vérifier : si l'extraction
   n'existe pas, c'est la feature clé à ajouter.)*

---

## 9. Donjons / Raids / Biomes = outils de qualité (jamais d'ilvl)

| Outil | Donne | Débloqué | Rôle |
|---|---|---|---|
| **Donjons** | rareté (Cache du Pilleur) + **matériaux** | tôt | farmer la qualité dans ta tranche d'ilvl |
| **Raids** | qualité **top** (sets/uniques/résist), plus exigeants | plus haut | la meilleure qualité, pour préparer les murs |
| **Biomes** | **élément + résistance** orientés | progressif | le canal résist : le mur a un élément → tu prépares le biome assorti |

- Le loot de donjon/raid sort à **l'ilvl de ta tranche courante** (= ta frontière − LAG), avec une
  **meilleure fenêtre de rareté**, jamais un ilvl plus haut. On **supprime** le bump ×1,25 du donjon.
- **On lâche la progression par-biome** : un seul axe d'ilvl GLOBAL. Le biome devient un **choix
  joueur** (où farmer pour la résist du prochain mur) ; la rotation horaire forcée passe en
  opt-in/cosmétique (sinon elle empêche le farm ciblé).
- La fiche du mur (§6) indique l'élément → la boucle « va farmer le bon biome pour la résist » est
  *l'énigme de build*.

---

## 10. Multi-classe (mur fixe, roster attendu)

- **Murs à difficulté FIXE, zéro scaling par taille d'équipe** : on **retire `raidPartyHpMult`**.
- La difficulté est calée en **supposant la roster qui monte à 3** (jalons `CHAR2_STAGE`,
  `CHAR3_STAGE`, sur le même axe que les murs → le perso est toujours débloqué quand la courbe le
  suppose ; reste à le **lever + stuffer**).
- Conséquence assumée : **multi-classe de fait OBLIGATOIRE** en endgame. Développer/synergiser les
  3 classes EST une brique d'optimisation (la « dynamique reine »).

---

## 11. Calibration & validation

- **`npm run ttk`** (source de vérité) doit MAINTENANT mesurer un TTK au front **> calé** (le
  retard de gear) : viser ~×1,3 du TTK calé tôt, montant vers la limite d'enrage tard.
- **Nouveau harnais `scripts/sim-mur.mjs`** : pour chaque Palier, simule **Build NU** vs **Build
  CIBLE** (modélise le stack §5.1 au taux τ §5.2) contre le mur, vérifie « NU échoue / CIBLE passe
  marge `margeMur(p)` » sur les **3 checks** (DPS, survie, soin).
- Les **6 sims par classe** existants servent à vérifier la parité inter-classes au build CIBLE.

---

## 12. Knobs récapitulés (à éprouver)

| Knob | Valeur de départ | Effet |
|---|---|---|
| `PENTE_VAGUE` | 1,0 ilvl/vague (~10/Palier) | plafond ilvl ~400 au P40 |
| `POW_BASE` | 1,018 (garde) | ×1,20/Palier ; ×1,43/2 Paliers |
| `LAG0`, `K_LAG` | 4 ; 0,9 | retard +5 (P1) → +40 (P40) |
| `τ(palier)` | 40 % / 65 % / 90 % | taux d'optimisation attendu |
| `margeMur(p)` | 1,3 (P10) → 1,05 (P40) | slack qui se resserre |
| `RARITY_ILVL_PER_TIER` | 8 (garde) | longévité (belle rare ≥ 2 Paliers) |
| Checks/mur | 1 (tôt) → 3 (tard) | DPS / survie / soin empilés |
| `raidPartyHpMult` | **retiré** | murs fixes, roster supposée |

---

## 13. Lots d'implémentation (ordre proposé)

0. **`progression.ts`** : courbe unifiée (supprimer cap 200 du farm + bande raid), `frontièreIlvl`,
   `LAG`, dérivation `palier/vague`. Valider `npm run ttk` AVANT de toucher au reste.
1. **`sim-mur.mjs`** : le harnais Build NU vs CIBLE + τ + 3 checks (l'outil qui pilote tout le reste).
2. **Murs** : boss de fin de Palier (vague 10), checks empilés par tranche, fiche de mur, élément tournant.
3. **Donjons/Raids** : retirer le bump d'ilvl, recadrer en outils de qualité (rareté/mats) à l'ilvl de tranche.
4. **Biomes** : axe d'ilvl global, biome = choix joueur, rotation opt-in.
5. **Multi-classe** : retirer `raidPartyHpMult`, caler la courbe sur la roster attendue.
6. **Anti-fossilisation** : surilevel pont, ascension brutale drop-gated, **extraction portable**.
7. **Renommage UI** : Palier/Vague, écran d'objectif unique (la frontière du moment).
8. **Prestige** : reprise au-delà du Palier 40.

> **Aucune ligne n'est écrite à ce stade.** Ce doc fige la conception ; l'implémentation démarre
> sur « go » du joueur, lot par lot, chaque lot validé au harnais avant le suivant.
