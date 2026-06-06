import type { CSSProperties } from 'react'
import { RARITIES } from '../game/rarities'
import type { RarityId } from '../game/types'

/** Style de carte d'objet selon la rareté : bordure teintée + halo pour les hautes raretés. */
export function rarityCardStyle(rarity: RarityId): CSSProperties {
  const r = RARITIES[rarity]
  const glow = r.tier >= 9 ? `0 0 18px ${r.color}55` : r.tier >= 6 ? `0 0 10px ${r.color}33` : 'none'
  return {
    borderColor: r.color + (r.tier >= 6 ? 'aa' : '66'),
    boxShadow: glow,
    background: `linear-gradient(160deg, ${r.color}14, #11151f 55%)`,
  }
}

/** Couleur de texte du nom (le Transcendant utilise la classe .prism animée). */
export function rarityTextStyle(rarity: RarityId): CSSProperties | undefined {
  if (rarity === 'transcendant') return undefined
  return { color: RARITIES[rarity].color }
}

export function isPrism(rarity: RarityId): boolean {
  return rarity === 'transcendant'
}
