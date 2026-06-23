/**
 * PROGRESSION UNIFIÉE — source de vérité chiffrée de la courbe de puissance.
 *
 * Principe : UNE seule loi de puissance, base commune `b` pour le joueur ET les ennemis →
 * `Puissance(ilvl) = b^ilvl`. Comme les deux côtés partagent `b`, le TEMPS DE KILL (TTK) est
 * CONSTANT à stuff calé sur le contenu, et un sur-stuff de +Δ ilvl ne donne qu'une réduction
 * BORNÉE `b^Δ` → pas de boule de neige possible.
 *
 * Ce module ne contient QUE des constantes et des fonctions PURES (aucune dépendance gameplay) :
 * il est importé par le jeu (items/enemies/dungeons/raids) ET par le harnais `scripts/ttk-sim.mjs`.
 */

import type { Item } from './types'

// ---- Courbe maîtresse ----

/** Base de puissance : +1,8 %/ilvl → ×2 tous les ~38,9 ilvl. Plage 1→700 ≈ ×2,7·10^5.
 *  Calée à 1.018 pour une courbe PLATE (chiffres lisibles : le primaire d'arme reste < 1 M jusqu'à
 *  ilvl ~630, plafond ~3,5 M à 700). TTK INVARIANT : joueur ET ennemis partagent `b` via powerAt → le
 *  ratio puissance/PV ne dépend pas de `b` (cf. npm run ttk). Gap par +10 ilvl ~+20 % → le stuff reste
 *  pertinent longtemps. */
export const POW_BASE = 1.018
/** Cap DUR d'ilvl : aucun drop / craft / surillvl / boss de raid ne dépasse cette valeur. */
export const ILVL_MAX = 700
/** Rareté = bonus ADDITIF en ilvl-équivalent (au lieu d'un multiplicateur de budget qui se faisait
 *  « cuber » par le DPS convexe). K = 8 : +8/cran → +15 %/cran de puissance (b^8), un drop d'une rareté
 *  au-dessus se garde nettement plus longtemps. Médiocre→Transcendant = +120 ilvl-équiv = ×8,4
 *  (informatif : JAMAIS vécu, la rareté est gatée par l'ilvl → l'écart RÉEL dans une fenêtre de contenu
 *  = ~3 crans = ×1,5, sous le seuil snowball 1,8 du harnais). Anti-snowball préservé par le GATING. */
export const RARITY_ILVL_PER_TIER = 8

/** Puissance relative à un ilvl (normalisée : `powerAt(0) = 1`). LA fonction centrale. */
export function powerAt(ilvl: number): number {
  return Math.pow(POW_BASE, ilvl)
}

/** Nombre d'ilvl pour doubler la puissance (≈ 38,9). */
export function ilvlPerDouble(): number {
  return Math.log(2) / Math.log(POW_BASE)
}

/** ilvl EFFECTIF d'un objet = ilvl + bonus de rareté (en ilvl-équiv). Borné au cap. */
export function effItemIlvl(ilvl: number, rarityTier: number): number {
  return Math.min(ILVL_MAX + RARITY_ILVL_PER_TIER * 15, ilvl + RARITY_ILVL_PER_TIER * (rarityTier - 1))
}

// ---- Budget d'objet (EXPONENTIEL — cœur de la refonte, ex-linéaire) ----

/**
 * Échelle de base du budget de stats. Calée à 8 (au lieu de 1) pour que les objets de bas ilvl aient
 * des stats LISIBLES (primaire ~15-30 dès ilvl 26, pas ~2) et que le gear domine les stats de niveau.
 * Le ratio `ENEMY_HP0/ITEM_BUDGET0` est préservé → le TTK est invariant (seule l'échelle absolue change).
 */
export const ITEM_BUDGET0 = 8.0

/** Budget de stats d'un objet : EXPONENTIEL en ilvl effectif (la stat primaire le porte → DPS ∝ b^ilvl). */
export function itemBudget(ilvl: number, rarityTier: number, weight: number, qMult = 1): number {
  return ITEM_BUDGET0 * powerAt(effItemIlvl(ilvl, rarityTier)) * weight * qMult
}

// ---- Classes d'ennemi (multiplicateurs = ratios de TTK) ----

export type EnemyClass = 'trash' | 'elite' | 'champion' | 'boss' | 'raidboss'

/** Multiplicateur de PV par classe = ratio de TTK vs le trash (trash = référence). */
export const ENEMY_HP_CLASS: Record<EnemyClass, number> = {
  trash: 1, elite: 2.7, champion: 4, boss: 11.7, raidboss: 13.3,
}
/** Multiplicateur de dégâts par classe (les boss frappent plus fort, mais bornés par la base b). */
export const ENEMY_DMG_CLASS: Record<EnemyClass, number> = {
  // raidboss = 2.0 : les RAIDS sont du contenu de GROUPE. La survie vient d'un 2e/3e héros qui
  // HEAL/BOUCLIER (la « dynamique reine » multi-classe), pas d'un nerf des dégâts. Dur en solo = VOULU.
  trash: 1, elite: 1.4, champion: 1.25, boss: 1.8, raidboss: 2.0,
}

/** Échelle de PV de base (ennemi trash, ilvl 0). Calibrée par `npm run ttk` (médian implicite) pour
 *  que le trash meure en ~`TTK.trash` à stuff calé. Calée à 12500 : suit ITEM_BUDGET0 (ratio préservé →
 *  TTK invariant) et tient compte de la rareté musclée (K=8 + lignes + unique) qui rend le stuff calé
 *  ~×1,7 plus fort → recentre le boss endgame ~35 s. */
export const ENEMY_HP0 = 12500
/** Échelle de dégâts de base. Calibrée par `npm run ttk` pour viser `SURVIVE_SECONDS` à stuff calé. */
export const ENEMY_DMG0 = 320

/** PV d'un ennemi à un ilvl de contenu donné. */
export function enemyHp(ilvl: number, cls: EnemyClass = 'trash'): number {
  return ENEMY_HP0 * powerAt(ilvl) * ENEMY_HP_CLASS[cls]
}
/** Dégâts d'un ennemi à un ilvl de contenu donné (même base b → la pression suit la montée). */
export function enemyDmg(ilvl: number, cls: EnemyClass = 'trash'): number {
  return ENEMY_DMG0 * powerAt(ilvl) * ENEMY_DMG_CLASS[cls]
}

/** Armure d'un ennemi : scale comme la puissance (powerAt) → mitigation physique ~constante (la
 *  Pénétration reste pertinente à tout ilvl). `mult` = blindage du contenu (donjon armure, forteresse). */
export const ENEMY_ARMOR0 = 6
export function enemyArmor(ilvl: number, mult = 1): number {
  return ENEMY_ARMOR0 * powerAt(ilvl) * mult
}

// ---- CHAPITRES, VAGUES & RETARD DE GEAR ----
// Un seul axe d'ilvl, porté par le farm. Le `stage` du code = une VAGUE ; un CHAPITRE = bloc de 10
// vagues fermé par un boss-MUR (vague 10). La FRONTIÈRE (difficulté du contenu) monte de PENTE_VAGUE
// par vague (~14,5 ilvl/Chapitre) ; le LOOT, lui, sort en RETARD permanent (frontière − LAG) → le joueur
// est toujours sous-stuffé, et seule l'OPTIMISATION (secondaires/gemmes/runes/pacte/alch/talents)
// comble l'écart. On NE PEUT PAS out-ilvl un mur : l'ilvl manquant est gaté par le mur lui-même.

/** Pente d'ilvl par vague (1 pas de farm). Calée à 1.45 pour que le LOOT atteigne ~200 au mur du
 *  Chapitre 15 (stage 150) — le plafond du contenu de base. La pente NE change PAS le TTK (le LAG,
 *  donc le ratio gear/contenu, est inchangé) : elle ne fait que fixer l'échelle absolue d'ilvl. */
export const PENTE_VAGUE = 1.45
/** Vagues par Chapitre (boss-mur à la dernière). */
export const CHAPITRE_SIZE = 10
/** Retard de gear : LAG0 + K_LAG·chapitre. Knob central. */
export const LAG0 = 4
export const K_LAG = 0.9
/** PLAFOND d'ilvl du LOOT de CONTENU DE BASE (farm / donjons / raids T1-T10). Gear capé à 200 :
 *  l'endgame devient HORIZONTAL (optimisation + rareté). La DIFFICULTÉ (frontière) continue de monter
 *  au-delà (Chapitre++ = boss plus durs), mais le gear plafonne → l'écart se comble par le build. */
export const ILVL_CAP_BASE = 200
/** Plafond d'ilvl de l'ENDGAME (Abîme & futurs raids endgame) : SEULE source d'ilvl > base, le grind ultime. */
export const ILVL_CAP_ENDGAME = 240

/** Numéro de CHAPITRE d'une vague (stage). Chapitre 1 = vagues 1-10. */
export function chapitreOf(stage: number): number {
  return Math.max(1, Math.ceil(stage / CHAPITRE_SIZE))
}
/** Position de la VAGUE dans son Chapitre (1..CHAPITRE_SIZE). */
export function vagueOf(stage: number): number {
  return ((Math.max(1, stage) - 1) % CHAPITRE_SIZE) + 1
}
/** Une vague est-elle un MUR (boss de fin de Chapitre) ? */
export function isMur(stage: number): boolean {
  return stage % CHAPITRE_SIZE === 0
}
/** Libellé joueur d'un stage : « Chapitre C · Vague V/10 ». */
export function chapitreLabel(stage: number): string {
  return `Chapitre ${chapitreOf(stage)} · Vague ${vagueOf(stage)}/${CHAPITRE_SIZE}`
}

// ---- GATE DE RAID ----
// Structure : Prologue (Chapitres 1-5) LIBRE, puis 10 vrais Chapitres (6-15) dont le franchissement
// est gaté par un tier de raid. Battre le Raid T(k) ouvre l'accès au Chapitre (5+k) : on franchit le
// MUR du Chapitre (4+k) — soit, en stage, le mur du Chapitre `c` (5≤c≤14) exige le Raid T(c−4).
// Au-delà du Chapitre 15 (Chapitre++, ≥ 16) : libre (plus de tiers de raid).

/** Tier de raid requis pour franchir le MUR du Chapitre où se trouve ce stage (0 = aucun gate). */
export function raidGateForStage(stage: number): number {
  if (!isMur(stage)) return 0
  const c = chapitreOf(stage)
  return c >= 5 && c <= 14 ? c - 4 : 0
}

/** FRONTIÈRE : difficulté en ilvl du contenu d'une vague (courbe unifiée, NON capée). */
export function frontierIlvl(stage: number): number {
  return Math.max(1, Math.round(stage * PENTE_VAGUE))
}
/** Retard de gear (en ilvl) au Chapitre donné. */
export function lagAt(chapitre: number): number {
  return LAG0 + K_LAG * chapitre
}
/** ilvl du LOOT de farm = frontière − LAG, CAPÉ à ILVL_CAP_BASE (200). Au-delà du Chapitre 15, la
 *  difficulté (frontière) monte encore mais le gear plafonne → l'écart se comble par l'optimisation. */
export function lootFarmIlvl(stage: number): number {
  return Math.min(ILVL_CAP_BASE, Math.max(1, Math.round(frontierIlvl(stage) - lagAt(chapitreOf(stage)))))
}

/** Difficulté du FARM en ilvl = la FRONTIÈRE (courbe unifiée douce). Les ennemis sont calés ici ;
 *  le loot sort en retard (lootFarmIlvl) → le LAG est permanent. */
export function farmDifficultyIlvl(stage: number): number {
  return frontierIlvl(stage)
}

// ---- Cibles d'équilibrage (knobs centraux) ----

/** Temps de kill cibles (s) à stuff CALÉ sur le contenu. */
export const TTK = { trash: 3, elite: 8, boss: 35, raidboss: 40 } as const
/** Secondes d'auto-attaque de boss encaissables à stuff calé (avant burst/nova). */
export const SURVIVE_SECONDS = 8

// ---- MURS (boss de fin de Palier) : knobs de difficulté ----
// Le mur est calé pour que le Build CIBLE (optimisation ATTENDUE au Palier) clear JUSTE, et qu'un
// build sous-optimisé tape l'enrage et échoue. Source de vérité PARTAGÉE avec `scripts/sim-mur.mjs`.

/** TTK boss visé au Build CIBLE. */
export const MUR_TARGET_TTK = TTK.boss
/** Marge de clear du CIBLE : large tôt (1,30 à P10) → serrée tard (1,05 à P40). Knob de tension. */
export function margeMur(palier: number): number {
  return Math.max(1.05, Math.min(1.30, 1.30 - (palier - 10) * (0.25 / 30)))
}
/** Délai d'enrage DUR (s) : l'ossature de tous les murs (check de DPS présent partout). */
export function murEnrage(palier: number): number {
  return MUR_TARGET_TTK * margeMur(palier)
}
/** Pic de nova PLEIN exigé par un mur de survie endgame. */
export const NOVA_FULL = 3.6
/** Sévérité du burst exigée par un mur de SURVIE au Palier : nulle avant P20 → pleine à P40 (la
 *  survie n'est un vrai mur qu'une fois les défenses mûres — finding du harnais sim-mur.mjs). */
export function novaReqAt(palier: number): number {
  return Math.max(0, NOVA_FULL * (palier - 20) / 20)
}

// ---- Mapping contenu → ilvl (axe unique) ----
// Bornes = calibration de départ (faciles à nudger). Le gear-up (farm + donjons) plafonne à
// ILVL_CAP_BASE ; la difficulté (frontière), elle, continue de monter au-delà.

/** Farm : ilvl du LOOT (= frontière − LAG, capé à ILVL_CAP_BASE). C'est l'ilvl du stuff qui drop à
 *  ce stage ; il reste en RETARD permanent sur la difficulté (farmDifficultyIlvl). */
export function ilvlFarm(stage: number): number {
  return lootFarmIlvl(stage)
}
/** Donjon : difficulté en ilvl (NON capée — comme le farm, la pression continue au-delà du loot). */
export function dungeonDifficultyIlvl(level: number): number {
  return Math.max(20, Math.round(40 + level * 14))
}
/** Donjon : ilvl de LOOT (side-grade ciblé, ~15 % devant le farm), plafonné à 250. */
export function ilvlDungeon(level: number): number {
  return Math.min(250, dungeonDifficultyIlvl(level))
}
/**
 * Bande d'ilvl linéaire `tierFloor + (tier−1)·step`, bornée à ILVL_MAX. LEGACY : les raids en jeu ne
 * l'utilisent plus (ils s'ancrent sur le système de Chapitres via `lootFarmIlvl`, cf. raids.ts) ;
 * seul le harnais `scripts/ttk-sim.mjs` l'appelle encore.
 */
export function ilvlRaid(tierFloor: number, tier: number, step = 15): number {
  return Math.min(ILVL_MAX, Math.round(tierFloor + (tier - 1) * step))
}

// ---- Garde-fou : borne l'ilvl d'un objet au cap ----

/** Borne dure : aucun objet ne dépasse `ILVL_MAX`. */
export function clampIlvl(ilvl: number): number {
  return Math.min(ILVL_MAX, Math.max(1, Math.round(ilvl)))
}

/** ilvl moyen d'un équipement (mesure de « gear ilvl » du joueur). */
export function gearIlvl(items: (Item | undefined)[]): number {
  const eq = items.filter((i): i is Item => !!i)
  if (!eq.length) return 1
  return eq.reduce((a, i) => a + i.ilvl, 0) / eq.length
}
