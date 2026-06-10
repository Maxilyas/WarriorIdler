import type { DamageType, GemInstance, Item } from './types'
import { RARITIES } from './rarities'

/**
 * CHÂSSES & STOCK DE GEMMES (v0.22).
 *
 * Les gemmes ÉLÉMENTAIRES (+% dégâts / +% résistance) ont été SUPPRIMÉES — broyées en
 * poussière de gemme 💠 à la migration. Toutes les gemmes sont désormais des gemmes de
 * CONDITION (voir condGems.ts) : des comportements de combat, pas des stats.
 * Ce module ne garde que la mécanique des châsses et les helpers de stock/migration.
 */

/** Clé du stock : `${type}:${tier}` (ANCIEN format élémentaire — ne sert qu'à la migration). */
export function gemKey(type: DamageType, tier: number): string {
  return `${type}:${tier}`
}

/** Décode une clé de stock élémentaire (migration). */
export function parseGemKey(key: string): GemInstance {
  const [type, tier] = key.split(':')
  return { type: type as DamageType, tier: Number(tier) }
}

/** Nombre de châsses d'un objet selon sa rareté (Rare=1, Patrimoine=2, Éternel=3).
 *  `weaponBonus` : châsse(s) supplémentaire(s) sur les armes (nœud « Châsse forcée » du Joaillier). */
export function itemSockets(item: Item, weaponBonus = 0): number {
  const t = RARITIES[item.rarity].tier
  const bonus = item.type === 'armePrincipale' ? weaponBonus : 0
  if (t >= 12) return 3 + bonus
  if (t >= 8) return 2 + bonus
  if (t >= 4) return 1 + bonus
  return 0
}

/** Coût (éclats) pour DÉSERTIR une gemme — la gemme est rendue au stock. */
export function unsocketCost(): number {
  return 2000
}
