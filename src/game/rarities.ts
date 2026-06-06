import type { Rarity, RarityId } from './types'

/**
 * 16 paliers de rareté : les 8 de WoW + 8 au-delà.
 * Plus la rareté monte, plus l'objet a d'affixes, de budget de stats,
 * et plus il est rare au drop (weight décroissant).
 */
export const RARITIES: Record<RarityId, Rarity> = {
  mediocre: { id: 'mediocre', name: 'Médiocre', tier: 1, color: '#9d9d9d', affixCount: 0, statMult: 0.6, weight: 1000 },
  commun: { id: 'commun', name: 'Commun', tier: 2, color: '#ffffff', affixCount: 1, statMult: 0.85, weight: 700 },
  inhabituel: { id: 'inhabituel', name: 'Inhabituel', tier: 3, color: '#1eff00', affixCount: 2, statMult: 1.0, weight: 450 },
  rare: { id: 'rare', name: 'Rare', tier: 4, color: '#0070dd', affixCount: 3, statMult: 1.25, weight: 250 },
  epique: { id: 'epique', name: 'Épique', tier: 5, color: '#a335ee', affixCount: 4, statMult: 1.6, weight: 120 },
  legendaire: { id: 'legendaire', name: 'Légendaire', tier: 6, color: '#ff8000', affixCount: 5, statMult: 2.1, weight: 55 },
  artefact: { id: 'artefact', name: 'Artefact', tier: 7, color: '#e6cc80', affixCount: 6, statMult: 2.7, weight: 26 },
  patrimoine: { id: 'patrimoine', name: 'Patrimoine', tier: 8, color: '#00ccff', affixCount: 6, statMult: 3.4, weight: 13 },
  mythique: { id: 'mythique', name: 'Mythique', tier: 9, color: '#ff2d55', affixCount: 7, statMult: 4.3, weight: 7 },
  ascendant: { id: 'ascendant', name: 'Ascendant', tier: 10, color: '#ff5ed2', affixCount: 7, statMult: 5.4, weight: 4 },
  celeste: { id: 'celeste', name: 'Céleste', tier: 11, color: '#3ff0e0', affixCount: 8, statMult: 6.8, weight: 2.2 },
  eternel: { id: 'eternel', name: 'Éternel', tier: 12, color: '#ffbf3f', affixCount: 8, statMult: 8.5, weight: 1.2 },
  cosmique: { id: 'cosmique', name: 'Cosmique', tier: 13, color: '#7af0ff', affixCount: 9, statMult: 10.6, weight: 0.6 },
  abyssal: { id: 'abyssal', name: 'Abyssal', tier: 14, color: '#8a2be2', affixCount: 9, statMult: 13.2, weight: 0.3 },
  primordial: { id: 'primordial', name: 'Primordial', tier: 15, color: '#ff5a1f', affixCount: 10, statMult: 16.5, weight: 0.15 },
  transcendant: { id: 'transcendant', name: 'Transcendant', tier: 16, color: '#f5f5ff', affixCount: 10, statMult: 20.6, weight: 0.07 },
}

/** Liste ordonnée par tier croissant. */
export const RARITY_LIST: Rarity[] = Object.values(RARITIES).sort((a, b) => a.tier - b.tier)

/**
 * Tire une rareté au hasard pondérée par le weight.
 * `luckTier` décale légèrement la distribution vers le haut (déblocage via ilvl/zone).
 */
export function rollRarity(luckTier = 0): RarityId {
  const pool = RARITY_LIST.filter((r) => r.tier <= 8 + luckTier)
  const total = pool.reduce((sum, r) => sum + r.weight, 0)
  let roll = Math.random() * total
  for (const r of pool) {
    roll -= r.weight
    if (roll <= 0) return r.id
  }
  return 'mediocre'
}
