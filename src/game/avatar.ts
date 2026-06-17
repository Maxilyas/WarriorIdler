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
  /** Coût de déblocage en Poussière d'étoile 🌌 (v0.28 B2) — absent = gratuit dès le départ. */
  cost?: number
}

export interface AvatarEmblem {
  id: string
  name: string
  glyph: string
  /** Coût de déblocage en Poussière d'étoile 🌌 (v0.28 B2) — absent = gratuit dès le départ. */
  cost?: number
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
  // Premium (🌌 Poussière d'étoile) — finitions prestige.
  { id: 'nebuleuse', name: 'Nébuleuse', c1: '#6d28d9', c2: '#0a1840', cost: 50 },
  { id: 'aurore', name: 'Aurore', c1: '#0891b2', c2: '#3b1060', cost: 50 },
  { id: 'magma', name: 'Magma', c1: '#b91c1c', c2: '#451a03', cost: 80 },
  { id: 'spectre', name: 'Spectre', c1: '#0d9488', c2: '#172554', cost: 80 },
  { id: 'royal', name: 'Royal', c1: '#1d4ed8', c2: '#3b0764', cost: 120 },
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
  // Premium (🌌 Poussière d'étoile).
  { id: 'phenix', name: 'Phénix', glyph: '🦅', cost: 50 },
  { id: 'serpent', name: 'Serpent', glyph: '🐍', cost: 50 },
  { id: 'lune', name: 'Lune', glyph: '🌙', cost: 80 },
  { id: 'soleil', name: 'Soleil', glyph: '☀️', cost: 80 },
  { id: 'galaxie', name: 'Galaxie', glyph: '🌌', cost: 120 },
  { id: 'diamant', name: 'Diamant', glyph: '💎', cost: 120 },
]

const CLASS_DEFAULT_EMBLEM: Record<PrimaryStat, string> = { force: 'epee', agilite: 'arc', intelligence: 'sort', endurance: 'bouclier' }
const CLASS_DEFAULT_PALETTE: Record<PrimaryStat, string> = { force: 'sang', agilite: 'foret', intelligence: 'arcane', endurance: 'acier' }

/**
 * 🏅 PARURES DE PRESTIGE (v0.32) — bordures (anneau décoratif) et auras (halo) débloquées par les
 * HAUTS FAITS endgame (pas d'achat : le haut fait obtenu EST le déblocage, comme les titres). Le
 * mapping haut-fait → cosmétique vit dans achievements.ts ; ici on ne décrit que le RENDU.
 */
export type BorderStyle = 'double' | 'dashed' | 'studded' | 'spikes' | 'runic'
export interface AvatarBorder {
  id: string
  name: string
  /** Couleurs de l'anneau (trait → reflet). */
  c1: string
  c2: string
  style: BorderStyle
}
export interface AvatarAura {
  id: string
  name: string
  /** Couleur dominante du halo. */
  color: string
  /** Halo pulsé (animation CSS) — réservé aux parures les plus prestigieuses. */
  anim?: boolean
}

export const AVATAR_BORDERS: AvatarBorder[] = [
  { id: 'couronne', name: 'Couronne', c1: '#b8860b', c2: '#ffe08a', style: 'studded' },
  { id: 'fracture', name: 'Fracture', c1: '#b91c1c', c2: '#fb923c', style: 'spikes' },
  { id: 'constellation', name: 'Constellation', c1: '#4338ca', c2: '#c7d2fe', style: 'studded' },
  { id: 'runique', name: 'Runique', c1: '#92610a', c2: '#fcd34d', style: 'runic' },
  { id: 'gemmee', name: 'Gemmée', c1: '#0f766e', c2: '#5eead4', style: 'studded' },
  { id: 'pactes', name: 'Pactes', c1: '#166534', c2: '#86efac', style: 'runic' },
  { id: 'triade', name: 'Triade', c1: '#9d174d', c2: '#fda4af', style: 'double' },
]

export const AVATAR_AURAS: AvatarAura[] = [
  { id: 'doree', name: 'Dorée', color: '#fbbf24' },
  { id: 'abyssale', name: 'Abyssale', color: '#a855f7', anim: true },
  { id: 'primordiale', name: 'Primordiale', color: '#8b5cf6', anim: true },
  { id: 'arcane', name: 'Arcane', color: '#60a5fa' },
  { id: 'prismatique', name: 'Prismatique', color: '#22d3ee', anim: true },
  { id: 'arcenciel', name: 'Arc-en-ciel', color: '#f472b6', anim: true },
  { id: 'primordialePlus', name: 'Primordiale absolue', color: '#e879f9', anim: true },
  { id: 'flamme', name: 'Flamme', color: '#f97316', anim: true },
  // 🎉 Auras d'INVASION (event élémentaire, v0.31.5) — débloquées au capstone de l'event de la semaine
  // (zéro puissance). Une par élément, à collectionner au fil des semaines. Id = `inv_<element>`.
  { id: 'inv_feu', name: 'Brasier', color: '#ff6b35', anim: true },
  { id: 'inv_froid', name: 'Blizzard', color: '#4dd0e1', anim: true },
  { id: 'inv_foudre', name: 'Orage', color: '#ffd54f', anim: true },
  { id: 'inv_arcane', name: 'Faille arcanique', color: '#c084fc', anim: true },
  { id: 'inv_ombre', name: 'Pénombre', color: '#a78bfa', anim: true },
  { id: 'inv_nature', name: 'Sylve', color: '#66bb6a', anim: true },
]

const BORDER_BY_ID = new Map(AVATAR_BORDERS.map((b) => [b.id, b]))
const AURA_BY_ID = new Map(AVATAR_AURAS.map((a) => [a.id, a]))
export function getBorder(id?: string): AvatarBorder | undefined { return id ? BORDER_BY_ID.get(id) : undefined }
export function getAura(id?: string): AvatarAura | undefined { return id ? AURA_BY_ID.get(id) : undefined }

/** Sélection de portrait stockée sur le personnage (champs optionnels = défaut par classe). */
export interface AvatarSel {
  palette?: string
  emblem?: string
  /** Parures de prestige (débloquées par haut fait) — absentes = aucune. */
  border?: string
  aura?: string
}

/** Résout la palette + l'emblème + les parures effectifs d'un héros (défauts dérivés de sa classe). */
export function resolveAvatar(bias: PrimaryStat, sel?: AvatarSel): { pal: AvatarPalette; emb: AvatarEmblem; border?: AvatarBorder; aura?: AvatarAura } {
  const palId = sel?.palette ?? CLASS_DEFAULT_PALETTE[bias] ?? 'acier'
  const embId = sel?.emblem ?? CLASS_DEFAULT_EMBLEM[bias] ?? 'epee'
  const pal = AVATAR_PALETTES.find((p) => p.id === palId) ?? AVATAR_PALETTES[0]
  const emb = AVATAR_EMBLEMS.find((e) => e.id === embId) ?? AVATAR_EMBLEMS[0]
  return { pal, emb, border: getBorder(sel?.border), aura: getAura(sel?.aura) }
}

/** Coût de déblocage (🌌) d'un cosmétique (palette ou emblème), 0 si gratuit/inconnu. */
export function cosmeticCost(id: string): number {
  const all = [...AVATAR_PALETTES, ...AVATAR_EMBLEMS]
  return all.find((x) => x.id === id)?.cost ?? 0
}
