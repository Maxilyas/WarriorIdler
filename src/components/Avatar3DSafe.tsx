import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { Character } from '../game/types'
import { Mannequin } from './Mannequin'

/**
 * Enveloppe sûre de l'avatar 3D (v0.43.3) : charge `Avatar3D` en LAZY (three.js hors du bundle initial)
 * et retombe sur le `Mannequin` 2D si la 3D échoue — WebGL absent, perte de contexte, erreur de rendu.
 * Le Stuff ne plante jamais à cause de la 3D.
 */
const Avatar3D = lazy(() => import('./Avatar3D'))

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function Avatar3DSafe({ char, maxWidth }: { char: Character; maxWidth?: number }) {
  const fallback = <Mannequin char={char} maxWidth={maxWidth} />
  return (
    <Boundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Avatar3D char={char} maxWidth={maxWidth} />
      </Suspense>
    </Boundary>
  )
}
