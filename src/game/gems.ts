import type { DamageType, GemInstance, Item } from './types'
import { RARITIES } from './rarities'

/**
 * CHÂSSES & STOCK DE GEMMES.
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

/**
 * CHÂSSES ROULÉES — une châsse est un NET AVANTAGE (gemme = comportement de combat fort),
 * donc RARE par design : la plupart des objets n'en ont AUCUNE, et le nombre monte doucement avec la
 * rareté. [P(exactement 1), P(2), P(3)] par tier de rareté ; le reste = 0 châsse.
 *   tier 1 (Médiocre) → 0 partout · tier 6 (Légendaire) → ~9% d'au moins 1 · tier 16 (Transcendant)
 *   → ~37% d'au moins 1, 3 châsses ≤ 5% (jackpot). Voir le tableau de probas dans la réponse design.
 */
const SOCKET_ODDS: Record<number, [number, number, number]> = {
  1: [0, 0, 0], 2: [0.01, 0, 0], 3: [0.02, 0, 0],
  4: [0.04, 0.003, 0], 5: [0.06, 0.006, 0], 6: [0.08, 0.012, 0.001],
  7: [0.10, 0.02, 0.002], 8: [0.12, 0.03, 0.004], 9: [0.13, 0.04, 0.007],
  10: [0.14, 0.05, 0.01], 11: [0.15, 0.06, 0.015], 12: [0.16, 0.07, 0.02],
  13: [0.17, 0.08, 0.025], 14: [0.18, 0.09, 0.03], 15: [0.19, 0.10, 0.04],
  16: [0.20, 0.12, 0.05],
}

/** Tire le nombre de châsses d'un objet selon son tier de rareté (0 le plus souvent — rare !). */
export function rollSockets(tier: number): number {
  const [p1, p2, p3] = SOCKET_ODDS[tier] ?? [0, 0, 0]
  const r = Math.random()
  if (r < p3) return 3
  if (r < p3 + p2) return 2
  if (r < p3 + p2 + p1) return 1
  return 0
}

/** Ancienne règle déterministe (Rare=1, Patrimoine=2, Éternel=3) — sert au GRANDFATHER du stuff
 *  hérité (sockets non roulés) pour ne pas faire sauter les gemmes déjà serties. */
function legacySockets(item: Item): number {
  const t = RARITIES[item.rarity].tier
  if (t >= 12) return 3
  if (t >= 8) return 2
  if (t >= 4) return 1
  return 0
}

/** Nombre de châsses d'un objet : valeur ROULÉE (rare) si présente, sinon ancienne règle.
 *  `weaponBonus` : châsse(s) supplémentaire(s) sur les armes (nœud « Châsse forcée » du Joaillier). */
export function itemSockets(item: Item, weaponBonus = 0): number {
  const bonus = item.type === 'armePrincipale' ? weaponBonus : 0
  const base = item.sockets ?? legacySockets(item)
  return base + bonus
}

/** Coût (éclats) pour DÉSERTIR une gemme — la gemme est rendue au stock. */
export function unsocketCost(): number {
  return 2000
}
