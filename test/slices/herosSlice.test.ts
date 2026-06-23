import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset } from './_helpers'
import { makeCharacter } from '../../src/game/character'

const hero = (lvl: number) => ({ ...makeCharacter('H', lvl, 'force' as const), talents: { co_start: 1 } })

describe('herosSlice', () => {
  beforeEach(() => reset())

  it('setActiveChar change le perso actif (index valide), no-op hors borne', () => {
    reset({ characters: [makeCharacter('A', 5, 'force'), makeCharacter('B', 5, 'agilite')], activeChar: 0 })
    g().setActiveChar(1); expect(g().activeChar).toBe(1)
    g().setActiveChar(9); expect(g().activeChar).toBe(1)
    g().setActiveChar(-1); expect(g().activeChar).toBe(1)
  })

  it('renameCharacter renomme (trim + max 16), no-op si vide', () => {
    g().renameCharacter(0, '  Bob  '); expect(g().characters[0].name).toBe('Bob')
    g().renameCharacter(0, 'x'.repeat(30)); expect(g().characters[0].name).toHaveLength(16)
    const cur = g().characters[0].name
    g().renameCharacter(0, '   '); expect(g().characters[0].name).toBe(cur)
  })

  it('setBias change la spé du perso actif', () => {
    g().setBias('intelligence')
    expect(g().characters[g().activeChar].primaryBias).toBe('intelligence')
  })

  it('allocateTalent alloue un nœud valide ; respecTalents rembourse (coût en or)', () => {
    reset({ characters: [hero(50)], gold: 1_000_000 })
    g().allocateTalent('cat_plaque')
    expect(g().characters[0].talents.cat_plaque).toBe(1)
    g().respecTalents()
    expect(g().characters[0].talents.cat_plaque ?? 0).toBe(0)
    expect(g().characters[0].talents.co_start).toBe(1) // racine conservée
    expect(g().gold).toBeLessThan(1_000_000) // respec payant
  })

  it('allocateTalent est un no-op pour un nœud inexistant', () => {
    reset({ characters: [hero(50)] })
    const before = { ...g().characters[0].talents }
    g().allocateTalent('node_qui_nexiste_pas')
    expect(g().characters[0].talents).toEqual(before)
  })
})
