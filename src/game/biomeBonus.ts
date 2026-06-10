import { BIOME_IDS, type BiomeId } from './biomes'
import type { DamageType } from './types'

/**
 * BONUS DE BIOME (v0.21) — quatre mécaniques qui cassent le « mono-biome » :
 * un build qui empile un seul élément et campe un seul biome perdait tout intérêt
 * pour les six autres. Chaque mécanique tire dans une direction différente :
 *
 * 1. HARMONIE : bonus global indexé sur le PLUS PETIT record des 7 biomes → monter
 *    tous les biomes paie, pour tous les builds (collection).
 * 2. SURCHARGE : un biome tournant (30 min, heure réelle) donne +50% or/XP et ×2
 *    quintessence → la rotation opportuniste est récompensée.
 * 3. ÉLAN DU VOYAGEUR : changer de biome donne +20% de dégâts pendant 10 min dans
 *    le biome rejoint → la carotte du nomade (jamais punitif).
 * 4. PRÉDATION : les ennemis d'un biome élémentaire RÉSISTENT à leur propre élément
 *    et sont VULNÉRABLES à l'élément « prédateur » → le build feu farme mieux la
 *    Toundra (vulnérable au feu) que les Terres de Cendres… où tombent pourtant
 *    le butin et les quintessences de feu. Tension assumée.
 *    (La 5e mécanique — gemmes exclusives par biome — vit dans gems.ts.)
 */

// ---- 1) Harmonie des biomes ----

/** Bonus de dégâts par palier d'harmonie (plus petit record parmi les 7 biomes). */
export const HARMONY_PER_STAGE = 0.01
/** Plafond du bonus d'harmonie (+100%). */
export const HARMONY_CAP = 1.0

/** Palier d'harmonie = plus petit record parmi TOUS les biomes (0 tant qu'un biome est vierge). */
export function harmonyStage(biomeBest: Record<BiomeId, number>): number {
  let min = Infinity
  for (const id of BIOME_IDS) min = Math.min(min, biomeBest[id] ?? 0)
  return Number.isFinite(min) ? Math.max(0, min) : 0
}

/** Bonus de dégâts global (0 → HARMONY_CAP) issu de l'harmonie. */
export function harmonyBonus(biomeBest: Record<BiomeId, number>): number {
  return Math.min(HARMONY_CAP, harmonyStage(biomeBest) * HARMONY_PER_STAGE)
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

// ---- 3) Élan du voyageur ----

export const ELAN_DURATION_MS = 10 * 60 * 1000
export const ELAN_DMG_MULT = 1.2

export interface ElanState {
  biome: BiomeId
  until: number
}

/** L'élan est-il actif (bon biome + fenêtre temporelle) ? */
export function elanActive(elan: ElanState | undefined, activeBiome: BiomeId, now = Date.now()): boolean {
  return !!elan && elan.biome === activeBiome && now < elan.until
}

// ---- 4) Cycle de prédation ----

/** Résistance des ennemis d'un biome élémentaire à LEUR élément. */
export const PREDATION_SELF_RESIST = 0.15
/** Vulnérabilité à l'élément prédateur (négatif = dégâts amplifiés). */
export const PREDATION_VULN = -0.2

/** Élément qui « chasse » chaque biome (même table que les vulnérabilités de raid). */
export const BIOME_VULN: Record<DamageType, DamageType> = {
  physique: 'arcane', feu: 'froid', froid: 'feu', foudre: 'nature',
  nature: 'foudre', arcane: 'ombre', ombre: 'arcane',
}
