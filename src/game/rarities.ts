import type { Rarity, RarityId } from './types'

/**
 * RARETÉS — 16 crans + tirage pondéré (`rollRarity`).  → Doc : docs/systemes/04-stuff-et-loot.md
 *
 * 16 crans de rareté : les 8 de WoW + 8 au-delà.
 * Plus la rareté monte, plus l'objet a d'affixes, de budget de stats,
 * et plus il est rare au drop (weight décroissant).
 */
// statMult : ⚠️ NE PILOTE PAS le budget de stats (ne sert QU'aux effets uniques, cf. uniques.ts). Le
// budget primaire/endurance/lignes d'une rareté = +RARITY_ILVL_PER_TIER (8) ilvl-équiv PAR CRAN
// (progression.ts) → ~+15 %/cran, un Transcendant à ilvl ÉGAL vaut ~×8,4 un Médiocre (et NON ×22 : la
// puissance vient surtout de l'ilvl). La rareté apporte AUSSI des LIGNES en plus (affixCount) + une
// chance d'unique relevée — pour que monter d'une rareté SE SENTE. statMult reste ~géométrique pour le
// scaling des uniques.
export const RARITIES: Record<RarityId, Rarity> = {
  mediocre: { id: 'mediocre', name: 'Médiocre', tier: 1, color: '#9d9d9d', affixCount: 1, statMult: 0.55, weight: 1000 },
  commun: { id: 'commun', name: 'Commun', tier: 2, color: '#ffffff', affixCount: 2, statMult: 0.70, weight: 700 },
  inhabituel: { id: 'inhabituel', name: 'Inhabituel', tier: 3, color: '#1eff00', affixCount: 2, statMult: 0.85, weight: 450 },
  rare: { id: 'rare', name: 'Rare', tier: 4, color: '#0070dd', affixCount: 3, statMult: 1.05, weight: 250 },
  epique: { id: 'epique', name: 'Épique', tier: 5, color: '#a335ee', affixCount: 3, statMult: 1.30, weight: 120 },
  legendaire: { id: 'legendaire', name: 'Légendaire', tier: 6, color: '#ff8000', affixCount: 4, statMult: 1.60, weight: 55 },
  artefact: { id: 'artefact', name: 'Artefact', tier: 7, color: '#e6cc80', affixCount: 4, statMult: 1.95, weight: 26 },
  patrimoine: { id: 'patrimoine', name: 'Patrimoine', tier: 8, color: '#00ccff', affixCount: 5, statMult: 2.40, weight: 13 },
  mythique: { id: 'mythique', name: 'Mythique', tier: 9, color: '#ff2d55', affixCount: 5, statMult: 2.95, weight: 7 },
  ascendant: { id: 'ascendant', name: 'Ascendant', tier: 10, color: '#ff5ed2', affixCount: 6, statMult: 3.60, weight: 4 },
  celeste: { id: 'celeste', name: 'Céleste', tier: 11, color: '#1fd9b0', affixCount: 6, statMult: 4.40, weight: 2.2 },
  eternel: { id: 'eternel', name: 'Éternel', tier: 12, color: '#ffe14d', affixCount: 7, statMult: 5.40, weight: 1.2 },
  cosmique: { id: 'cosmique', name: 'Cosmique', tier: 13, color: '#7af0ff', affixCount: 7, statMult: 6.60, weight: 0.6 },
  abyssal: { id: 'abyssal', name: 'Abyssal', tier: 14, color: '#c026d3', affixCount: 8, statMult: 8.10, weight: 0.3 },
  primordial: { id: 'primordial', name: 'Primordial', tier: 15, color: '#ff3b00', affixCount: 8, statMult: 9.90, weight: 0.15 },
  transcendant: { id: 'transcendant', name: 'Transcendant', tier: 16, color: '#f5f5ff', affixCount: 8, statMult: 12.10, weight: 0.07 },
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
