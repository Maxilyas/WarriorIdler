import type { CSSProperties } from 'react'
import { RARITIES } from '../game/rarities'
import type { RarityId } from '../game/types'

/** Style de carte d'objet selon la rareté : bordure teintée + halo croissant (animé aux hautes raretés). */
export function rarityCardStyle(rarity: RarityId): CSSProperties {
  const r = RARITIES[rarity]
  const glow = r.tier >= 13 ? `0 0 24px ${r.color}77` : r.tier >= 11 ? `0 0 18px ${r.color}66` : r.tier >= 9 ? `0 0 16px ${r.color}55` : r.tier >= 6 ? `0 0 10px ${r.color}33` : 'none'
  return {
    borderColor: r.color + (r.tier >= 11 ? 'cc' : r.tier >= 6 ? 'aa' : '66'),
    boxShadow: glow,
    background: `linear-gradient(160deg, ${r.color}${r.tier >= 11 ? '22' : '14'}, #11151f 55%)`,
  }
}

/** Couleur de texte du nom. Le Transcendant (top) utilise la classe .prism animée → pas de couleur fixe. */
export function rarityTextStyle(rarity: RarityId): CSSProperties | undefined {
  if (RARITIES[rarity].tier >= 16) return undefined
  return { color: RARITIES[rarity].color }
}

/**
 * Classe d'EFFET visuel du nom selon la rareté (en plus de la couleur) :
 * - tier 16 (Transcendant) : `prism` (texte arc-en-ciel animé) ;
 * - tier 11-15 (Céleste→Primordial) : `rshimmer` (halo pulsé dans la couleur de la rareté) ;
 * - en-dessous : aucun effet. → distingue les hautes raretés même quand les teintes sont proches.
 */
export function rarityNameClass(rarity: RarityId): string {
  const t = RARITIES[rarity].tier
  if (t >= 16) return 'prism'
  if (t >= 11) return 'rshimmer'
  return ''
}

export function isPrism(rarity: RarityId): boolean {
  return RARITIES[rarity].tier >= 16
}
