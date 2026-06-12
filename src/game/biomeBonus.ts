import { BIOME_IDS, type BiomeId } from './biomes'
import type { DamageType } from './types'

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
 * 3. ÉLAN DU VOYAGEUR : changer de biome donne +20% de dégâts pendant 10 min dans
 *    le biome rejoint → la carotte du nomade (jamais punitif).
 * 4. PRÉDATION : les ennemis d'un biome élémentaire RÉSISTENT à leur propre élément
 *    et sont VULNÉRABLES à l'élément « prédateur » → le build feu farme mieux la
 *    Toundra (vulnérable au feu) que les Terres de Cendres… où tombent pourtant
 *    le butin et les quintessences de feu. Tension assumée.
 *    (La 5e mécanique — gemmes exclusives par biome — vit dans gems.ts.)
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

/** Bonus de dégâts global (0 → MAITRISE_CAP) — ~5% quand les 7 biomes sont au palier 150. */
export function maitriseBonus(biomeBest: Record<BiomeId, number>): number {
  const ref = BIOME_IDS.length * MAITRISE_REF_STAGE // 7 × 150 = 1050
  return Math.min(MAITRISE_CAP, maitriseSum(biomeBest) * (MAITRISE_TARGET / ref))
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
/** Rune du Vagabond : élan prolongé et renforcé. */
export const ELAN_VAGABOND_DURATION_MS = 20 * 60 * 1000
export const ELAN_VAGABOND_MULT = 1.3

export interface ElanState {
  biome: BiomeId
  until: number
  /** Multiplicateur effectif (1.2 de base, 1.3 avec la Rune du Vagabond). */
  mult?: number
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
