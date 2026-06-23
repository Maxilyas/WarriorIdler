import { BIOME_IDS, type BiomeId } from './biomes'

/**
 * BONUS DE BIOME — mécaniques qui cassent le « mono-biome » : un build qui empile un seul élément et
 * campe un seul biome perdrait tout intérêt pour les six autres. Deux mécaniques vivent ici :
 *
 * 1. MAÎTRISE DES ZONES : petit bonus de dégâts global indexé sur ton record GLOBAL (~5% à la vague de
 *    référence) → progresser paie un peu, mais c'est de la collection, pas une source de puissance.
 * 2. SURCHARGE : un biome tournant (30 min, heure réelle) donne +50% or/XP et ×2 quintessence → la
 *    rotation opportuniste est récompensée.
 * (Une 3e mécanique — gemmes exclusives par biome — vit dans condGems.ts.)
 */

// ---- 1) MAÎTRISE DES ZONES ----
//
// Bonus de dégâts VOLONTAIREMENT MINIME, indexé sur le record GLOBAL (bestStage) → ~5% à la vague de
// référence. Toujours appliqué à TOUT le contenu (farm/donjon/raid). C'est de la collection, pas une
// source de puissance.

/** Bonus de dégâts cible quand le record global atteint la vague de référence. */
export const MAITRISE_TARGET = 0.05
/** Vague de référence (≈ plafond pratique des vagues de farm). */
export const MAITRISE_REF_STAGE = 150
/** Garde-fou si l'on dépasse la vague de référence. */
export const MAITRISE_CAP = 0.10

/** Somme des records de TOUS les biomes (0 si tout est vierge). Actuellement inutilisé (la Maîtrise
 *  des Zones est indexée sur le record global via `maitriseBonus`). */
export function maitriseSum(biomeBest: Record<BiomeId, number>): number {
  let sum = 0
  for (const id of BIOME_IDS) sum += Math.max(0, biomeBest[id] ?? 0)
  return sum
}

/** Bonus de dégâts global (0 → MAITRISE_CAP) indexé sur ton record GLOBAL (bestStage), réf
 *  MAITRISE_REF_STAGE → ~5% à la vague 150. */
export function maitriseBonus(globalBest: number): number {
  return Math.min(MAITRISE_CAP, Math.max(0, globalBest) * (MAITRISE_TARGET / MAITRISE_REF_STAGE))
}

// ---- 2) Surcharge élémentaire (rotation horaire réelle) ----

export const SURGE_INTERVAL_MS = 30 * 60 * 1000
/** Multiplicateur d'or et d'XP dans le biome en surcharge. */
export const SURGE_GOLD_XP_MULT = 1.5
/** Multiplicateur de chance de Quintessence dans le biome en surcharge. */
export const SURGE_QUINT_MULT = 2

/** Biome actuellement en surcharge (déterministe : heure réelle, tourne toutes les 30 min). */
export function surgeBiome(now = Date.now()): BiomeId {
  return BIOME_IDS[Math.floor(now / SURGE_INTERVAL_MS) % BIOME_IDS.length]
}

/** Temps restant (ms) avant la rotation de la surcharge. */
export function surgeRemainingMs(now = Date.now()): number {
  return SURGE_INTERVAL_MS - (now % SURGE_INTERVAL_MS)
}
