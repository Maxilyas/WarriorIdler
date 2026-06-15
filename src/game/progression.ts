/**
 * PROGRESSION UNIFIÉE (refonte v0.30) — source de vérité chiffrée de la courbe de puissance.
 *
 * Principe (DESIGN_v0.30 §1) : UNE seule loi de puissance, base commune `b` pour le joueur ET les
 * ennemis → `Puissance(ilvl) = b^ilvl`. Comme les deux côtés partagent `b`, le TEMPS DE KILL (TTK)
 * est CONSTANT à stuff calé sur le contenu, et un sur-stuff de +Δ ilvl ne donne qu'une réduction
 * BORNÉE `b^Δ`. Plus de boule de neige possible (cf. snowball v0.29 : ilvl raid ×1,22/tier + DPS
 * convexe ≈ budget^2,4 → on one-shottait tout).
 *
 * Ce module ne contient QUE des constantes et des fonctions PURES (aucune dépendance gameplay) :
 * il est importé par le jeu (items/enemies/dungeons/raids) ET par le harnais `scripts/ttk-sim.mjs`.
 */

import type { Item } from './types'

// ---- Courbe maîtresse ----

/** Base de puissance : +3 %/ilvl → ×2 tous les ~23,4 ilvl. Plage 1→700 ≈ ×9,4·10^8. */
export const POW_BASE = 1.03
/** Cap DUR d'ilvl : aucun drop / craft / surillvl / boss de raid ne dépasse cette valeur. */
export const ILVL_MAX = 700
/** Rareté = bonus ADDITIF en ilvl-équivalent (au lieu d'un multiplicateur de budget qui se faisait
 *  « cuber » par le DPS convexe). +3/cran → Médiocre→Transcendant = +45 ilvl = ×3,8 (vs ×223 en v0.29). */
export const RARITY_ILVL_PER_TIER = 3

/** Puissance relative à un ilvl (normalisée : `powerAt(0) = 1`). LA fonction centrale. */
export function powerAt(ilvl: number): number {
  return Math.pow(POW_BASE, ilvl)
}

/** Nombre d'ilvl pour doubler la puissance (≈ 23,4). */
export function ilvlPerDouble(): number {
  return Math.log(2) / Math.log(POW_BASE)
}

/** ilvl EFFECTIF d'un objet = ilvl + bonus de rareté (en ilvl-équiv). Borné au cap. */
export function effItemIlvl(ilvl: number, rarityTier: number): number {
  return Math.min(ILVL_MAX + RARITY_ILVL_PER_TIER * 15, ilvl + RARITY_ILVL_PER_TIER * (rarityTier - 1))
}

// ---- Budget d'objet (EXPONENTIEL — cœur de la refonte, ex-linéaire) ----

/**
 * Échelle de base du budget de stats. Calibrée (LOT 2) pour que le DPS du joueur à stuff calé tue
 * le trash dans `TTK.trash`. PROVISOIRE tant que le harnais TTK n'a pas figé la valeur définitive.
 */
export const ITEM_BUDGET0 = 1.0

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
  trash: 1, elite: 1.4, champion: 1.25, boss: 1.8, raidboss: 2.0,
}

/** Échelle de PV de base (ennemi trash, ilvl 0). Calibrée par `npm run ttk` (médian implicite) pour
 *  que le trash meure en ~`TTK.trash` à stuff calé sur tout l'axe. */
export const ENEMY_HP0 = 1000
/** Échelle de dégâts de base. Calibrée par `npm run ttk` pour viser `SURVIVE_SECONDS` à stuff calé. */
export const ENEMY_DMG0 = 82

/** PV d'un ennemi à un ilvl de contenu donné. */
export function enemyHp(ilvl: number, cls: EnemyClass = 'trash'): number {
  return ENEMY_HP0 * powerAt(ilvl) * ENEMY_HP_CLASS[cls]
}
/** Dégâts d'un ennemi à un ilvl de contenu donné (même base b → la pression suit la montée). */
export function enemyDmg(ilvl: number, cls: EnemyClass = 'trash'): number {
  return ENEMY_DMG0 * powerAt(ilvl) * ENEMY_DMG_CLASS[cls]
}

// ---- Cibles d'équilibrage (knobs centraux) ----

/** Temps de kill cibles (s) à stuff CALÉ sur le contenu (DESIGN_v0.30 §7). */
export const TTK = { trash: 3, elite: 8, boss: 35, raidboss: 40 } as const
/** Secondes d'auto-attaque de boss encaissables à stuff calé (avant burst/nova). */
export const SURVIVE_SECONDS = 8

// ---- Mapping contenu → ilvl (axe unique, hybride — DESIGN_v0.30 §4) ----
// Bornes = calibration de départ (faciles à nudger). Le gear-up (farm+donjons) plafonne ; les raids
// portent la frontière jusqu'à 700.

/** Farm : ilvl du palier, PLAFONNÉ à 200 (au-delà, difficulté monte mais loot capé → pousse au raid). */
export function ilvlFarm(palier: number): number {
  return Math.min(200, Math.max(1, Math.round(palier * 2.5)))
}
/** Donjon : side-grade ciblé, ~15 % d'ilvl devant le farm, plafonné à 250. */
export function ilvlDungeon(level: number): number {
  return Math.min(250, Math.max(20, Math.round(40 + level * 14)))
}
/**
 * Raid : bande linéaire `230 → 600` pour les 4 raids de base (+~15/tier sur 10 tiers), prolongée par
 * l'Abîme `560 → 700`. `rank` = rang de difficulté du raid (0..3 base, Abîme à part via `tierFloor`).
 * Un rung ne saute jamais > +20 ilvl (anti-trivialisation locale).
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
