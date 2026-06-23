import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset } from './_helpers'
import { freshSave } from '../../src/game/save'

const quint = (o: Record<string, number> = {}) => ({ physique: 0, feu: 0, froid: 0, foudre: 0, arcane: 0, ombre: 0, nature: 0, ...o })

/** metiers avec des nœuds Alchimiste forcés (pour franchir les gates craftMods). */
function withAlchNodes(nodes: Record<string, number>) {
  const m = freshSave().metiers
  return { ...m, alchimiste: { ...m.alchimiste, nodes: { ...m.alchimiste.nodes, ...nodes } } }
}

describe('officineSlice', () => {
  beforeEach(() => reset())

  it('experiment consomme des réactifs quand le nœud Officine est actif', () => {
    reset({ metiers: withAlchNodes({ officine: 1 }) as never, reagents: quint({ feu: 10, froid: 10 }) as never })
    g().experiment('feu', 'froid')
    expect(g().reagents.feu).toBe(7) // -EXPERIMENT_COST (3)
    expect(g().reagents.froid).toBe(7)
  })

  it('experiment est un no-op sans le nœud Officine (gate)', () => {
    reset({ reagents: quint({ feu: 10, froid: 10 }) as never })
    g().experiment('feu', 'froid')
    expect(g().reagents.feu).toBe(10)
  })

  it('dailyTransmute convertit des Quintessences (nœud Transmutation du jour)', () => {
    reset({ metiers: withAlchNodes({ officine: 1, transmutJour: 1 }) as never, quint: quint({ feu: 10 }) as never, lastTransmute: 0 })
    g().dailyTransmute('feu', 'froid')
    expect(g().quint.froid).toBe(1)
    expect(g().quint.feu).toBeLessThan(10)
  })
})
