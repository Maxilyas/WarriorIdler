import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset } from './_helpers'

describe('marketSlice', () => {
  beforeEach(() => reset())

  it('mysteryBox ouvre un coffre (pendingChest) contre de l\'or, no-op si déjà un en attente', () => {
    reset({ gold: 1e9 })
    g().mysteryBox(0)
    expect(g().pendingChest).not.toBeNull()
    expect(g().gold).toBeLessThan(1e9)
    const goldNow = g().gold
    g().mysteryBox(0) // un coffre est déjà en attente → no-op
    expect(g().gold).toBe(goldNow)
  })

  it('mysteryBox no-op si or insuffisant', () => {
    reset({ gold: 0 })
    g().mysteryBox(0)
    expect(g().pendingChest).toBeNull()
  })

  it('recruitCharacter ajoute un perso (ressources suffisantes), no-op si or insuffisant', () => {
    reset({ gold: 1e9, poussiere: 1e9 })
    expect(g().characters).toHaveLength(1)
    g().recruitCharacter()
    expect(g().characters).toHaveLength(2)
    expect(g().gold).toBeLessThan(1e9)
    // or à zéro → pas de 3e recrue
    reset({ gold: 0, poussiere: 0, characters: g().characters })
    g().recruitCharacter()
    expect(g().characters).toHaveLength(2)
  })

  it('reset rétablit une partie neuve', () => {
    reset({ gold: 500000, stage: 1, bestStage: 1, onboarded: true })
    g().reset()
    expect(g().stage).toBe(1)
    expect(g().gold).toBe(0)
    expect(g().characters).toHaveLength(1)
    expect(g().onboarded).toBe(false)
  })
})
