import type { DamageType } from './types'

/**
 * ⚗️ OFFICINE DE L'ALCHIMISTE (v0.26) — le métier des CONSOMMABLES et du temps réel.
 *
 * Boucle : récolter des RÉACTIFS de biome (drop léger en farm) → DÉCOUVRIR des recettes par
 * EXPÉRIMENTATION (combiner 2 réactifs) → BRASSER en CUVES (maturation en temps réel, fenêtre
 * de récolte parfaite) → CONSOMMER (élixirs d'équipe, potions de contenu, huiles, antidotes).
 *
 * Qualités de brassin (récolte au bon moment — le check-in du métier) :
 *   récolte trop tôt        → TROUBLE  (×0,75)
 *   à point                 → PUR      (×1)
 *   dans la fenêtre parfaite→ PARFAIT  (×1,25) — 5% de MILLÉSIME (×1,5, stockable, flex)
 *   éventé (trop tard)      → PUR      (le bonus s'évapore, pas de malus)
 */

/* ------------------------------------------------------------------ */
/* Réactifs de biome                                                   */
/* ------------------------------------------------------------------ */

export const REAGENTS: Record<DamageType, { name: string; icon: string }> = {
  physique: { name: 'Racine de fer', icon: '🫚' },
  feu: { name: 'Fleur de cendre', icon: '🌺' },
  froid: { name: 'Givrelle', icon: '🥀' },
  foudre: { name: 'Chardon fulminant', icon: '🌩️' },
  arcane: { name: 'Lys arcanique', icon: '🪻' },
  ombre: { name: 'Morille du voile', icon: '🍄' },
  nature: { name: 'Sève vive', icon: '🌿' },
}

/** Chance de drop d'un réactif du biome, par rang d'ennemi (× Herboriste). */
export const REAGENT_DROP = { normal: 0.02, elite: 0.06, boss: 0.12 }

/* ------------------------------------------------------------------ */
/* Recettes (découvertes par expérimentation)                          */
/* ------------------------------------------------------------------ */

export type BrewKind = 'elixir' | 'potion' | 'huile' | 'antidote' | 'mutagene'

export interface BrewDef {
  id: string
  name: string
  icon: string
  kind: BrewKind
  desc: string
  /** Paire de réactifs de la recette (ordre indifférent ; paires distinctes par recette). */
  recipe: [DamageType, DamageType]
  /** Réactifs consommés par brassin (n de CHAQUE membre de la paire). */
  cost: number
  /** Maturation (minutes réelles) jusqu'à « Pur ». Fenêtre PARFAITE : [×1,3 ; ×1,6]. */
  brewMin: number
  /** Élixirs/huiles/antidotes/mutagènes : durée d'effet (minutes réelles). */
  durMin?: number
  /** Élixirs : effet global (fractions). */
  effect?: { dmg?: number; hp?: number; gold?: number; speed?: number }
  /** Potions : nombre de charges par brassin. */
  charges?: number
}

export const BREWS: BrewDef[] = [
  /* — Élixirs d'équipe (1 actif à la fois, durée réelle) — */
  { id: 'elixirPuissance', name: 'Élixir de puissance', icon: '🧪', kind: 'elixir',
    recipe: ['feu', 'foudre'], cost: 3, brewMin: 45, durMin: 45, effect: { dmg: 0.08 },
    desc: '+8% de dégâts pendant 45 min (réelles).' },
  { id: 'elixirVigueur', name: 'Élixir de vigueur', icon: '🍶', kind: 'elixir',
    recipe: ['nature', 'ombre'], cost: 3, brewMin: 45, durMin: 45, effect: { hp: 0.12 },
    desc: '+12% de PV max pendant 45 min.' },
  { id: 'elixirFortune', name: 'Élixir de fortune', icon: '🍯', kind: 'elixir',
    recipe: ['physique', 'arcane'], cost: 3, brewMin: 30, durMin: 45, effect: { gold: 0.15 },
    desc: '+15% d\'or de farm pendant 45 min.' },
  { id: 'elixirCelerite', name: 'Élixir de célérité', icon: '🥂', kind: 'elixir',
    recipe: ['froid', 'foudre'], cost: 3, brewMin: 60, durMin: 45, effect: { speed: 0.06 },
    desc: '+6% de vitesse d\'attaque pendant 45 min.' },
  /* — Potions de contenu (charges, ARMÉES puis consommées à l'entrée) — */
  { id: 'potionGarde', name: 'Potion de garde', icon: '🛡️', kind: 'potion',
    recipe: ['nature', 'froid'], cost: 4, brewMin: 90, charges: 2,
    desc: 'ARME ton prochain RAID : toute l\'équipe y entre avec un bouclier de 25% des PV max.' },
  { id: 'potionPillard', name: 'Potion du pillard', icon: '💰', kind: 'potion',
    recipe: ['physique', 'ombre'], cost: 4, brewMin: 90, charges: 3,
    desc: 'ARME ton prochain DONJON : le coffre de fin rend +25%.' },
  { id: 'potionErudit', name: 'Potion de l\'érudit', icon: '📚', kind: 'potion',
    recipe: ['arcane', 'nature'], cost: 4, brewMin: 90, charges: 3,
    desc: 'ARME ton prochain DONJON : l\'XP du run +30%.' },
  /* — Huile d'arme (type CHOISI à l'application) — */
  { id: 'huileArme', name: 'Huile d\'affûtage', icon: '🛢️', kind: 'huile',
    recipe: ['physique', 'feu'], cost: 3, brewMin: 60, durMin: 30,
    desc: '+12% de dégâts quand l\'ÉLÉMENT du contenu (biome, donjon, raid) correspond au type choisi. 30 min.' },
  /* — Antidote (type CHOISI à l'application) — */
  { id: 'antidote', name: 'Antidote ciblé', icon: '🧴', kind: 'antidote',
    recipe: ['froid', 'nature'], cost: 3, brewMin: 60, durMin: 30,
    desc: '−15% de dégâts SUBIS du type choisi pendant 30 min. La préparation avant un mur.' },
  /* — Mutagène (la chimie n'est pas une science exacte) — */
  { id: 'mutagene', name: 'Mutagène instable', icon: '☣️', kind: 'mutagene',
    recipe: ['feu', 'ombre'], cost: 2, brewMin: 20, durMin: 20,
    desc: 'Au débouchage : 70% → +12% de dégâts · 30% → −8%. Pendant 20 min. Santé !' },
]

const BREW_BY_ID = new Map(BREWS.map((b) => [b.id, b]))
export function getBrew(id: string): BrewDef | undefined {
  return BREW_BY_ID.get(id)
}

/** Recette correspondant à une paire de réactifs (ordre indifférent), ou undefined. */
export function recipeForPair(a: DamageType, b: DamageType): BrewDef | undefined {
  return BREWS.find((r) => (r.recipe[0] === a && r.recipe[1] === b) || (r.recipe[0] === b && r.recipe[1] === a))
}

/** Coût d'une EXPÉRIMENTATION (réactifs de chaque type tentés, perdus si fiasco). */
export const EXPERIMENT_COST = 3

/* ------------------------------------------------------------------ */
/* Qualité des brassins                                                */
/* ------------------------------------------------------------------ */

/** 0 Trouble · 1 Pur · 2 Parfait · 3 Millésime. */
export type BrewQuality = 0 | 1 | 2 | 3

export const BREW_QUALITIES: Record<BrewQuality, { name: string; mark: string; mult: number; color: string }> = {
  0: { name: 'Trouble', mark: '▾', mult: 0.75, color: '#9ca3af' },
  1: { name: 'Pur', mark: '', mult: 1, color: '#e2e8f0' },
  2: { name: 'Parfait', mark: '▴', mult: 1.25, color: '#34d399' },
  3: { name: 'Millésime', mark: '★', mult: 1.5, color: '#fbbf24' },
}

/** Bornes de la fenêtre PARFAITE (multiples de brewMin). */
export const BREW_PERFECT_FROM = 1.3
export const BREW_PERFECT_TO = 1.6

/** Qualité d'un brassin récolté après `elapsedMin` minutes (sans bonus d'arbre). */
export function brewQualityAt(def: BrewDef, elapsedMin: number, brewMult = 1): BrewQuality {
  const need = def.brewMin * brewMult
  if (elapsedMin < need) return 0
  if (elapsedMin >= need * BREW_PERFECT_FROM && elapsedMin <= need * BREW_PERFECT_TO) return 2
  return 1
}

/** Clé de stock d'un brassin : `id:qualité`. */
export function brewKey(id: string, q: BrewQuality): string {
  return `${id}:${q}`
}

export function parseBrewKey(key: string): { def: BrewDef; quality: BrewQuality } | null {
  const [id, q] = key.split(':')
  const def = getBrew(id)
  if (!def) return null
  const quality = Math.max(0, Math.min(3, Number(q) || 0)) as BrewQuality
  return { def, quality }
}

/** Chance de MILLÉSIME quand la récolte est Parfaite (+ nœud Grands crus). */
export function millesimeChance(grandsCrusRank = 0): number {
  return 0.05 + 0.02 * grandsCrusRank
}

/* ------------------------------------------------------------------ */
/* Transmutation du jour & Pierre philosophale                         */
/* ------------------------------------------------------------------ */

/** 1/jour réel : 4 Quintessences d'un type → 1 du type CHOISI (cadence trop lente pour
 *  devenir une économie parallèle — l'exception contrôlée au dogme « chaque donjon est LA source »). */
export const DAILY_TRANSMUTE_COST = 4

/** 🜍 Pierre philosophale (capstone 50) : relique de compte — réactifs des 7 biomes + un Millésime. */
export const PHILOSOPHALE_COST = { reagentsEach: 10, poussiere: 50 }
/** Bonus de la Pierre : multiplicateur doux sur les DROPS de ressources de farm. */
export const PHILOSOPHALE_MULT = 1.02
