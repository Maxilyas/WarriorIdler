import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset } from './_helpers'

describe('expeditionsSlice', () => {
  beforeEach(() => reset())

  it('claimChest verse le contenu d\'un coffre en attente puis le vide', () => {
    reset({ gold: 1e9 })
    g().mysteryBox(0)
    expect(g().pendingChest).not.toBeNull()
    const invBefore = g().inventory.length
    g().claimChest()
    expect(g().pendingChest).toBeNull()
    expect(g().inventory.length).toBeGreaterThan(invBefore)
  })

  it('enterDungeon démarre un donjon débloqué, abandonDungeon le quitte', () => {
    reset({ bestStage: 50, sceaux: 10 })
    g().enterDungeon('sceaux', 1)
    expect(g().dungeon).not.toBeNull()
    g().abandonDungeon()
    expect(g().dungeon).toBeNull()
  })

  it('enterDungeon no-op si palier insuffisant', () => {
    reset({ bestStage: 1, sceaux: 10 })
    g().enterDungeon('or', 1) // 'or' (Chambre du Trésor) unlockStage 7
    expect(g().dungeon).toBeNull()
  })
})
