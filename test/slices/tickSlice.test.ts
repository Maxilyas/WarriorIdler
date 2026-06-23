import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset, biomeRec, mkItem } from './_helpers'
import { makeCharacter, charMaxHp } from '../../src/game/character'
import { makeEnemy } from '../../src/game/enemies'

function gearedHero(level = 50) {
  const c = makeCharacter('H', level, 'force')
  c.equipment.armePrincipale = mkItem({ type: 'armePrincipale', ilvl: 150, rarity: 'epique' })
  c.hp = charMaxHp(c)
  return c
}

describe('tickSlice', () => {
  beforeEach(() => reset())

  it('tick fait progresser le combat : un héros équipé tue et gagne de l\'or sur la durée', () => {
    reset({ characters: [gearedHero()], stage: 1, biomeBest: biomeRec(50), gold: 0, killCount: 0, enemy: makeEnemy(1) })
    for (let i = 0; i < 300; i++) g().tick(0.2)
    expect(g().killCount).toBeGreaterThan(0)
    expect(g().gold).toBeGreaterThan(0)
  })

  it('farmLock fige le palier (le combat tourne mais on n\'avance pas)', () => {
    reset({ characters: [gearedHero()], stage: 3, bestStage: 10, biomeBest: biomeRec(10), farmLock: true, killCount: 0, enemy: makeEnemy(3) })
    for (let i = 0; i < 200; i++) g().tick(0.2)
    expect(g().stage).toBe(3) // verrou de farm : palier inchangé
    expect(g().killCount).toBeGreaterThan(0) // mais des kills ont bien eu lieu
  })
})
