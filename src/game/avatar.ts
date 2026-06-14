import type { PrimaryStat } from './types'

/**
 * 🎨 PORTRAITS PROCÉDURAUX (v0.28, C1) — avatar 100% SVG, sans asset. Le joueur choisit une
 * PALETTE (dégradé de fond) et un EMBLÈME (symbole central) par héros ; le défaut dérive de la
 * classe. Rendu par `LevelBadge`. Personnalisation = `Character.avatar`.
 */

export interface AvatarPalette {
  id: string
  name: string
  /** Dégradé du médaillon (haut → bas). */
  c1: string
  c2: string
}

export interface AvatarEmblem {
  id: string
  name: string
  glyph: string
}

export const AVATAR_PALETTES: AvatarPalette[] = [
  { id: 'acier', name: 'Acier', c1: '#243044', c2: '#0a0e16' },
  { id: 'sang', name: 'Sang', c1: '#7f1d1d', c2: '#1a0a0a' },
  { id: 'foret', name: 'Forêt', c1: '#14532d', c2: '#06140c' },
  { id: 'arcane', name: 'Arcane', c1: '#3730a3', c2: '#0b0a1f' },
  { id: 'or', name: 'Or', c1: '#92610a', c2: '#1c1405' },
  { id: 'givre', name: 'Givre', c1: '#0e7490', c2: '#04161c' },
  { id: 'ombre', name: 'Ombre', c1: '#4c1d95', c2: '#0a0414' },
  { id: 'cendre', name: 'Cendre', c1: '#44403c', c2: '#0c0a09' },
  { id: 'rose', name: 'Rose', c1: '#9d174d', c2: '#1a0610' },
  { id: 'jade', name: 'Jade', c1: '#0f766e', c2: '#04140f' },
]

export const AVATAR_EMBLEMS: AvatarEmblem[] = [
  { id: 'epee', name: 'Épée', glyph: '⚔️' },
  { id: 'arc', name: 'Arc', glyph: '🏹' },
  { id: 'sort', name: 'Sort', glyph: '✨' },
  { id: 'crane', name: 'Crâne', glyph: '💀' },
  { id: 'dragon', name: 'Dragon', glyph: '🐉' },
  { id: 'loup', name: 'Loup', glyph: '🐺' },
  { id: 'flamme', name: 'Flamme', glyph: '🔥' },
  { id: 'eclair', name: 'Éclair', glyph: '⚡' },
  { id: 'couronne', name: 'Couronne', glyph: '👑' },
  { id: 'bouclier', name: 'Bouclier', glyph: '🛡️' },
  { id: 'etoile', name: 'Étoile', glyph: '⭐' },
  { id: 'oeil', name: 'Œil', glyph: '👁️' },
]

const CLASS_DEFAULT_EMBLEM: Record<PrimaryStat, string> = { force: 'epee', agilite: 'arc', intelligence: 'sort', endurance: 'bouclier' }
const CLASS_DEFAULT_PALETTE: Record<PrimaryStat, string> = { force: 'sang', agilite: 'foret', intelligence: 'arcane', endurance: 'acier' }

/** Sélection de portrait stockée sur le personnage (champs optionnels = défaut par classe). */
export interface AvatarSel {
  palette?: string
  emblem?: string
}

/** Résout la palette + l'emblème effectifs d'un héros (défauts dérivés de sa classe). */
export function resolveAvatar(bias: PrimaryStat, sel?: AvatarSel): { pal: AvatarPalette; emb: AvatarEmblem } {
  const palId = sel?.palette ?? CLASS_DEFAULT_PALETTE[bias] ?? 'acier'
  const embId = sel?.emblem ?? CLASS_DEFAULT_EMBLEM[bias] ?? 'epee'
  const pal = AVATAR_PALETTES.find((p) => p.id === palId) ?? AVATAR_PALETTES[0]
  const emb = AVATAR_EMBLEMS.find((e) => e.id === embId) ?? AVATAR_EMBLEMS[0]
  return { pal, emb }
}
