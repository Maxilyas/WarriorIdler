import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset } from './_helpers'

describe('atelierSlice', () => {
  beforeEach(() => reset())

  it('createItem forge un objet dans le sac (ressources suffisantes)', () => {
    reset({ bestStage: 200, essence: 1e9, noyau: 1e9, poussiere: 1e9, fragments: 1e9, cosmic: 1e9 })
    expect(g().inventory).toHaveLength(0)
    g().createItem({ type: 'tete', primary: 'force', rarity: 'commun' })
    expect(g().inventory).toHaveLength(1)
    expect(g().inventory[0].type).toBe('tete')
    expect(g().essence).toBeLessThan(1e9) // coût payé
  })

  it('createItem no-op si ressources insuffisantes', () => {
    reset({ bestStage: 200, essence: 0, noyau: 0, poussiere: 0, fragments: 0, cosmic: 0 })
    g().createItem({ type: 'tete', primary: 'force', rarity: 'epique' })
    expect(g().inventory).toHaveLength(0)
  })

  it('learnMetierNode est un no-op pour un nœud inexistant', () => {
    const before = JSON.stringify(g().metiers.forgeron)
    g().learnMetierNode('forgeron', 'noeud_bidon')
    expect(JSON.stringify(g().metiers.forgeron)).toBe(before)
  })
})
