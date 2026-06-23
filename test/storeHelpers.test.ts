import { describe, it, expect } from 'vitest'
import {
  xpForLevel, boxGoldPrice, bestRaidTier, quintTierMult, maxContentIlvl, MYSTERY_BOXES,
} from '../src/game/storeHelpers'

describe('xpForLevel', () => {
  it('est strictement croissant et positif', () => {
    let prev = 0
    for (let lvl = 1; lvl <= 100; lvl++) {
      const x = xpForLevel(lvl)
      expect(x).toBeGreaterThan(0)
      if (lvl > 1) expect(x).toBeGreaterThan(prev)
      prev = x
    }
  })
})

describe('quintTierMult', () => {
  it('vaut 1 au palier 1, croît, et plafonne à 4', () => {
    expect(quintTierMult(1)).toBe(1)
    expect(quintTierMult(50)).toBeGreaterThan(1)
    expect(quintTierMult(50)).toBeLessThanOrEqual(4)
    expect(quintTierMult(100000)).toBe(4) // cap dur
  })
})

describe('bestRaidTier', () => {
  it('retourne le maximum des tiers, 0 si vide', () => {
    expect(bestRaidTier({})).toBe(0)
    expect(bestRaidTier({ a: 2, b: 5, c: 1 })).toBe(5)
  })
})

describe('boxGoldPrice', () => {
  it('rend le prix fixe d\'un coffre gratuit', () => {
    const free = MYSTERY_BOXES.find((b) => b.free)!
    expect(boxGoldPrice(free, 100)).toBe(free.gold)
  })

  it('croît avec le palier-record pour un coffre payant', () => {
    const paid = MYSTERY_BOXES.find((b) => !b.free && b.count > 0)!
    expect(boxGoldPrice(paid, 200)).toBeGreaterThan(boxGoldPrice(paid, 1))
  })
})

describe('maxContentIlvl', () => {
  it('est au moins l\'ilvl du palier (croissant avec bestStage)', () => {
    const low = maxContentIlvl(1, {})
    const high = maxContentIlvl(200, {})
    expect(high).toBeGreaterThan(low)
    expect(low).toBeGreaterThan(0)
  })
})
