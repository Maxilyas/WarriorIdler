import { BIOME_IDS, type BiomeId } from './biomes'

/**
 * BONUS DE BIOME (v0.21) — quatre mécaniques qui cassent le « mono-biome » :
 * un build qui empile un seul élément et campe un seul biome perdait tout intérêt
 * pour les six autres. Chaque mécanique tire dans une direction différente :
 *
 * 1. MAÎTRISE DES ZONES (v0.25, ex-Harmonie) : petit bonus de dégâts global indexé sur la SOMME
 *    des records des 7 biomes (~5% à fond) → monter chaque zone paie, mais c'est de la collection,
 *    pas une source de puissance (l'ex-Harmonie min-based donnait jusqu'à +100%).
 * 2. SURCHARGE : un biome tournant (30 min, heure réelle) donne +50% or/XP et ×2
 *    quintessence → la rotation opportuniste est récompensée.
 * (v0.25 : l'ÉLAN DU VOYAGEUR et la PRÉDATION ont été SUPPRIMÉS — retours joueur : bruit
 *  sans vrai choix. La 3e mécanique — gemmes exclusives par biome — vit dans condGems.ts.)
 */

// ---- 1) MAÎTRISE DES ZONES (v0.25) — remplace l'ancienne « Harmonie » ----
//
// L'ancienne Harmonie donnait jusqu'à +100% de dégâts, indexée sur le PLUS PETIT record (min) des 7
// biomes → un multiplicateur de puissance majeur et punitif (ta zone la plus faible bloquait tout).
// La Maîtrise des Zones la remplace par un bonus VOLONTAIREMENT MINIME, indexé sur la SOMME des
// records (récompense de pousser CHAQUE zone, pas seulement la plus faible). Toujours appliqué à TOUT
// le contenu (farm/donjon/raid). C'est de la collection, plus une source de puissance.

/** Bonus de dégâts cible quand TOUS les biomes atteignent le palier de référence. */
export const MAITRISE_TARGET = 0.05
/** Palier de référence par biome (≈ plafond pratique des paliers de farm). */
export const MAITRISE_REF_STAGE = 150
/** Garde-fou si l'on dépasse la référence sur tous les biomes. */
export const MAITRISE_CAP = 0.10

/** Somme des records de TOUS les biomes (0 si tout est vierge). */
export function maitriseSum(biomeBest: Record<BiomeId, number>): number {
  let sum = 0
  for (const id of BIOME_IDS) sum += Math.max(0, biomeBest[id] ?? 0)
  return sum
}

/** Bonus de dégâts global (0 → MAITRISE_CAP). v0.35 — UNE seule zone : indexé sur ton record GLOBAL
 *  (bestStage), réf = UN biome (MAITRISE_REF_STAGE) → ~5% au palier 150 (au lieu de la somme des 7
 *  biomes, qui donnait un % minuscule avec un seul biome actif). */
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

// (v0.25 : sections « Élan du voyageur » et « Cycle de prédation » supprimées.)
