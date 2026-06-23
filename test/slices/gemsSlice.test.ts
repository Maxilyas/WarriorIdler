import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset } from './_helpers'

const totalGems = () => Object.values(g().gems).reduce((a, b) => a + b, 0)

describe('gemsSlice', () => {
  beforeEach(() => reset())

  it('buyGem ajoute une gemme au stock contre de la poussière (non gaté par métier)', () => {
    reset({ gemDust: 1000 })
    g().buyGem('metronome')
    expect(g().gemsSeen).toContain('metronome')
    expect(g().gemDust).toBe(1000 - 60 * 2) // GEM_CUT_COST × 2
    expect(totalGems()).toBe(1)
  })

  it('buyGem no-op si poussière insuffisante', () => {
    reset({ gemDust: 0 })
    g().buyGem('metronome')
    expect(g().gemsSeen).not.toContain('metronome')
    expect(totalGems()).toBe(0)
  })

  it('cutGem est un no-op sans le nœud Taille du Joaillier', () => {
    reset({ gemDust: 1000 })
    g().cutGem('metronome')
    expect(totalGems()).toBe(0)
  })
})
