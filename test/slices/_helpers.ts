// Helpers partagés des tests de slices : on teste les actions via le VRAI store (`useGame`),
// en réinitialisant l'état (data via freshSave) avant chaque test. Les actions sont conservées
// (setState merge). localStorage est polyfillé par test/setup.ts.
import { useGame } from '../../src/game/store'
import type { GameState } from '../../src/game/store'
import { freshSave } from '../../src/game/save'
import { makeEnemy } from '../../src/game/enemies'
import { generateItem, type GenerateOptions } from '../../src/game/items'

export const g = (): GameState => useGame.getState()

/** Réinitialise le store à un état neuf + overrides ciblés. */
export function reset(overrides: Partial<GameState> = {}): void {
  useGame.setState({
    ...freshSave(),
    enemy: makeEnemy(1, 'physique'),
    log: [],
    killCount: 0,
    pendingOffline: null,
    ...overrides,
  } as Partial<GameState>)
}

/** Record de paliers par biome (physique = `physique`, autres = `other`). */
export function biomeRec(physique: number, other = 0): Record<string, number> {
  return { physique, feu: other, froid: other, foudre: other, arcane: other, ombre: other, nature: other }
}

export function mkItem(opts: GenerateOptions) { return generateItem(opts) }
