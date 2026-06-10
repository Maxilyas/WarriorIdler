import type { DamageType, GemInstance, Item } from './types'
import { RARITIES } from './rarities'

/**
 * GEMMES ÉLÉMENTAIRES (v0.21) — craft de sertissage + 5e mécanique de biome.
 *
 * - Une gemme ne tombe QUE dans le biome de son élément (la gemme de feu aux Terres de
 *   Cendres…) → même un build Ombre a une raison d'aller farmer le Feu : la résistance
 *   feu de sa prochaine gemme. C'est le pilier « drop exclusif » du rééquilibrage biome.
 * - 3 qualités : Éclatée → Polie → Parfaite, fusionnées 3 → 1 à l'Atelier (puits d'or).
 * - Effet HYBRIDE lisible : +% dégâts du type ET +% résistance du type. Sertie, retirable
 *   (coût en éclats), elle suit l'objet (recycler un objet serti rend ses gemmes).
 * - Châsses par rareté : Rare = 1, Patrimoine = 2, Éternel = 3.
 */

export const GEM_MAX_TIER = 3
export const GEM_TIER_NAMES = ['Éclatée', 'Polie', 'Parfaite']
/** +% dégâts du type par qualité (index = tier − 1). */
export const GEM_DMG = [4, 9, 16]
/** +% résistance du type par qualité. */
export const GEM_RES = [2, 5, 9]

/** Fusion : 3 gemmes d'une qualité → 1 de la qualité supérieure (coût en or par fusion). */
export const GEM_FUSE_COUNT = 3
export const GEM_FUSE_GOLD = [25_000, 250_000]

/** Chance de drop d'une gemme Éclatée du biome actif, par rang d'ennemi. */
export const GEM_DROP = { normal: 0.015, elite: 0.06, boss: 0.12 }

/** Clé du stock : `${type}:${tier}`. */
export function gemKey(type: DamageType, tier: number): string {
  return `${type}:${tier}`
}

/** Décode une clé de stock. */
export function parseGemKey(key: string): GemInstance {
  const [type, tier] = key.split(':')
  return { type: type as DamageType, tier: Number(tier) }
}

/** Nombre de châsses d'un objet selon sa rareté (Rare=1, Patrimoine=2, Éternel=3). */
export function itemSockets(item: Item): number {
  const t = RARITIES[item.rarity].tier
  if (t >= 12) return 3
  if (t >= 8) return 2
  if (t >= 4) return 1
  return 0
}

/** Coût (éclats) pour DÉSERTIR une gemme — la gemme est rendue au stock. */
export function unsocketCost(g: GemInstance): number {
  return 500 * Math.pow(4, g.tier - 1)
}

/** Libellé de qualité d'une gemme. */
export function gemTierName(tier: number): string {
  return GEM_TIER_NAMES[Math.max(0, Math.min(GEM_MAX_TIER, tier) - 1)]
}

/** Contribution d'une gemme au score d'objet (cohérent avec la pondération des affixes). */
export function gemScore(g: GemInstance): number {
  return GEM_DMG[g.tier - 1] * 2 + GEM_RES[g.tier - 1] * 3
}
