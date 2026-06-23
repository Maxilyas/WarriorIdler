import type { DamageType, Enemy } from './types'

/**
 * RÉSISTANCES RELATIVES.
 *
 * La résistance du héros est une stat en POINTS, NON PLAFONNÉE, par type. Elle ne réduit pas les
 * dégâts en % : elle ANNULE la punition des attaques typées.
 *
 * Chaque attaque ennemie typée porte une EXIGENCE `req` (la « puissance » du monstre sur
 * ce type). Le multiplicateur de dégâts subis est :
 *
 *     M = 1 + KMAX · min(1, déficit / DSCALE)^P     où déficit = max(0, req − résist)
 *
 *  - résist ≥ req  → M = ×1 (au cap du monstre : dégâts normaux) ;
 *  - résist = 0    → M monte avec l'AMPLEUR ABSOLUE du déficit, borné à ×(1+KMAX) :
 *      · farm (req ≈ 0-60)    → ×1 … ×1.7  (sensible sans être un mur)
 *      · donjon (req ≈ 25-120) → ×1.4 … ×2.9 (un vrai levier)
 *      · raid (req ≈ 100-430+) → ×2.5 … ×6  (LE check de stuff par boss : OBLIGATOIRE)
 *
 * Convention : 1 % de résistance = 1 point (lignes d'objet telles quelles ; talents,
 * uniques et sets ×100 à l'agrégation). Pas de cap.
 */

/** Punition maximale : ×(1+KMAX) à déficit total. Calé à 5 pour que le check de résist soit un vrai
 *  mur en raid (à 4, on clearait à ×2,3 sans une seule ligne de résist). */
export const RESIST_KMAX = 5
/** Forme de la courbe (>1 = indulgent : un peu de résist aide déjà beaucoup). Calé à 1.35 : les
 *  déficits MOYENS piquent tôt (à mi-déficit ≈ ×3,4 avec KMAX=5). Farm (req ≤ 60) → ×1,7 max ;
 *  donjons à zéro résist → ×2,9 max. */
export const RESIST_P = 1.35
/** Déficit (points) qui déclenche la punition maximale. */
export const RESIST_DSCALE = 250

/**
 * Multiplicateur de dégâts subis pour une attaque d'exigence `req` contre `resistPoints`.
 * `reqReduction` (talent « Acclimatation ») réduit l'exigence perçue.
 */
export function resistMult(req: number, resistPoints: number, reqReduction = 0): number {
  const effReq = req * (1 - Math.min(0.9, Math.max(0, reqReduction)))
  if (effReq <= 0) return 1
  const deficit = Math.max(0, effReq - Math.max(0, resistPoints))
  if (deficit <= 0) return 1
  return 1 + RESIST_KMAX * Math.pow(Math.min(1, deficit / RESIST_DSCALE), RESIST_P)
}

/** Exigence d'un ennemi sur un type (0 si non typé / pas d'exigence). */
export function enemyReq(enemy: Enemy, type: DamageType): number {
  return enemy.reqs?.[type] ?? 0
}

/**
 * SURPLUS de résistance face à un ennemi (somme des points au-delà des exigences, sur les
 * types exigés uniquement). Alimente l'archétype Égide (Gardien du seuil, Métaboliseur).
 */
export function resistSurplus(enemy: Enemy, resist: Partial<Record<DamageType, number>>): number {
  if (!enemy.reqs) return 0
  let surplus = 0
  for (const t in enemy.reqs) {
    const req = enemy.reqs[t as DamageType] ?? 0
    if (req <= 0) continue
    surplus += Math.max(0, (resist[t as DamageType] ?? 0) - req)
  }
  return surplus
}

/* ---- Exigences par contenu (gradation : ≈0 farm < donjon < raid) ---- */

/** Farm : exigence sur l'élément du biome, nulle avant la vague 45 puis douce (cap 60 → ×1.7 max). */
export function farmReq(stage: number): number {
  if (stage < 45) return 0
  return Math.min(60, Math.round((stage - 45) * 1.2))
}

/** Donjon : exigence sur l'élément du donjon (cap 120 → ×2.9 max à zéro résist). */
export function dungeonReq(level: number): number {
  return Math.min(120, 20 + level * 6)
}
