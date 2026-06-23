import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset, biomeRec } from './_helpers'

describe('worldSlice', () => {
  beforeEach(() => reset())

  describe('setStage', () => {
    it('clampe le palier dans [1, biomeBest[biome actif]]', () => {
      reset({ biomeBest: biomeRec(50) })
      g().setStage(8); expect(g().stage).toBe(8)
      g().setStage(999); expect(g().stage).toBe(50) // capé au record du biome actif
      g().setStage(0); expect(g().stage).toBe(1) // plancher
    })

    it('est un no-op pendant un donjon', () => {
      reset({ biomeBest: biomeRec(50), dungeon: { id: 'x', level: 1 } as never })
      g().setStage(10)
      expect(g().stage).toBe(1)
    })
  })

  it('toggleFarmLock bascule le verrou de farm', () => {
    const before = g().farmLock
    g().toggleFarmLock(); expect(g().farmLock).toBe(!before)
    g().toggleFarmLock(); expect(g().farmLock).toBe(before)
  })

  it('setRecycleThreshold clampe dans [2, 16]', () => {
    g().setRecycleThreshold(7); expect(g().recycleThreshold).toBe(7)
    g().setRecycleThreshold(99); expect(g().recycleThreshold).toBe(16)
    g().setRecycleThreshold(1); expect(g().recycleThreshold).toBe(2)
  })

  it('toggleAutoRecycle bascule', () => {
    const before = g().autoRecycle
    g().toggleAutoRecycle(); expect(g().autoRecycle).toBe(!before)
    g().toggleAutoRecycle(); expect(g().autoRecycle).toBe(before)
  })

  describe('setBiome', () => {
    it('change de zone vers un biome débloqué (record suffisant)', () => {
      reset({ bestStage: 100000, biomeBest: biomeRec(100000) })
      g().setBiome('feu')
      expect(g().activeBiome).toBe('feu')
    })

    it('no-op si même biome ou biome verrouillé', () => {
      reset({ bestStage: 1, biomeBest: biomeRec(1) })
      g().setBiome('physique'); expect(g().activeBiome).toBe('physique') // même zone
      g().setBiome('feu'); expect(g().activeBiome).toBe('physique') // common verrouillé (<20)
      g().setBiome('ombre'); expect(g().activeBiome).toBe('physique') // rare verrouillé (<50)
    })
  })
})
