import { describe, it, expect } from 'vitest'
import { raidShortfall } from '../src/game/raids'

// SOFT-CHECK §7.5 : raidShortfall renvoie LE plus gros déficit (ratio avoir/requis le plus bas < 1),
// ou null si l'équipe est prête. L'UI le traduit en « va farmer Y ».
describe('raidShortfall (soft-check §7.5)', () => {
  it('null quand tout est au-dessus du requis (équipe prête)', () => {
    expect(raidShortfall(1.0, 1.2, { element: 'feu', ratio: 1.1 })).toBeNull()
    expect(raidShortfall(2, 2, null)).toBeNull()
  })

  it('renvoie le SEUL axe manquant', () => {
    expect(raidShortfall(0.8, 1.5, null)).toEqual({ kind: 'dps', ratio: 0.8 })
    expect(raidShortfall(1.5, 0.7, null)).toEqual({ kind: 'ehp', ratio: 0.7 })
  })

  it('priorise le déficit le PLUS bas (le vrai bloqueur) parmi plusieurs', () => {
    // DPS à 0.9, EHP à 0.6 → EHP est le bloqueur.
    expect(raidShortfall(0.9, 0.6, null)).toEqual({ kind: 'ehp', ratio: 0.6 })
    // résist à 0.4 (le pire) bat DPS 0.7 et EHP 0.8.
    expect(raidShortfall(0.7, 0.8, { element: 'foudre', ratio: 0.4 })).toEqual({ kind: 'resist', element: 'foudre', ratio: 0.4 })
  })

  it('ignore la résist si non requise (worstResist null) ou au cap', () => {
    expect(raidShortfall(0.5, 1.1, null)).toEqual({ kind: 'dps', ratio: 0.5 })
    expect(raidShortfall(1.1, 1.1, { element: 'froid', ratio: 1.0 })).toBeNull() // résist au cap (ratio 1.0, pas < 1)
  })
})
