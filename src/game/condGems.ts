import type { Character, DamageType, GemInstance } from './types'

/**
 * GEMMES DE CONDITION (v0.22) — LE système de gemmes, refondu.
 *
 * Plus AUCUNE stat plate : chaque gemme déclenche un COMPORTEMENT de combat. Trois familles :
 *  - 🥁 RYTHME        : compteurs (attaques, sorts, kills) — le tempo du combat.
 *  - 🌊 FLUX          : gestion de ressources (PV, recharges, boucliers).
 *  - 🌍 ENVIRONNEMENT : l'état du monde (télégraphes, Surcharge, packs).
 *
 * Chaque gemme a UN paramètre chiffré, amélioré par la RECOUPE du Joaillier (rang 1→maxRank,
 * coût en poussière de gemme 💠). Les effets sont agrégés au niveau de l'ÉQUIPE (meilleur rang
 * porté). Les doublons ne s'empilent pas → broie-les en poussière.
 *
 * Sources : drop de biome par FAMILLE (Feu/Foudre → Rythme · Ombre/Nature → Flux ·
 * Arcane/Froid → Environnement · Physique → au hasard), champions ✦, raids — et la TAILLE
 * (gemme au CHOIX contre de la poussière, arbre du Joaillier).
 */

export type GemFamily = 'rythme' | 'flux' | 'environnement'

export const GEM_FAMILIES: Record<GemFamily, { name: string; icon: string; color: string }> = {
  rythme: { name: 'Rythme', icon: '🥁', color: '#fbbf24' },
  flux: { name: 'Flux', icon: '🌊', color: '#38bdf8' },
  environnement: { name: 'Environnement', icon: '🌍', color: '#4ade80' },
}

export type CondGemId =
  | 'metronome' | 'echo' | 'crescendo' | 'overkill' | 'conquete'
  | 'pacte' | 'souffle' | 'tresorerie' | 'acharne'
  | 'opportuniste' | 'orage' | 'nuee'

export interface CondGemDef {
  id: CondGemId
  family: GemFamily
  name: string
  icon: string
  color: string
  /** Valeur du paramètre par rang (index = rang − 1). maxRank = values.length. */
  values: number[]
  /** Description paramétrée (reçoit la valeur du rang courant). */
  desc: (v: number) => string
}

export const COND_GEMS: Record<CondGemId, CondGemDef> = {
  /* 🥁 RYTHME — compteurs */
  metronome: {
    id: 'metronome', family: 'rythme', name: 'Métronome', icon: '🎼', color: '#fbbf24',
    values: [10, 9, 8, 7, 6],
    desc: (v) => `Toutes les ${v} attaques auto, la suivante est un CRITIQUE garanti.`,
  },
  echo: {
    id: 'echo', family: 'rythme', name: 'Pierre d\'Écho', icon: '🔔', color: '#f59e0b',
    values: [6, 5, 4, 3],
    desc: (v) => `Tous les ${v} sorts lancés par l'équipe, le suivant résonne une 2e fois (50% d'effet).`,
  },
  crescendo: {
    id: 'crescendo', family: 'rythme', name: 'Crescendo', icon: '📯', color: '#fb923c',
    values: [20, 28, 36, 44, 52],
    desc: (v) => `+1% de dégâts par ennemi tué (cap +${v}%). Remis à zéro si l'équipe tombe.`,
  },
  overkill: {
    id: 'overkill', family: 'rythme', name: 'Étoile d\'Overkill', icon: '🌠', color: '#ffd43b',
    values: [1],
    desc: () => 'L\'excédent de dégâts du coup fatal frappe l\'ennemi SUIVANT. Le farm s\'enchaîne.',
  },
  conquete: {
    id: 'conquete', family: 'rythme', name: 'Fragment de Conquête', icon: '🏆', color: '#fb923c',
    values: [1],
    desc: () => 'Tuer un boss ou une élite remet à zéro la plus longue recharge de chaque héros.',
  },

  /* 🌊 FLUX — ressources */
  pacte: {
    id: 'pacte', family: 'flux', name: 'Pacte sanglant', icon: '🩸', color: '#f87171',
    values: [10, 14, 18, 22, 26],
    desc: (v) => `Recharges des capacités −${v}%, mais chaque lancement coûte 2% des PV max.`,
  },
  souffle: {
    id: 'souffle', family: 'flux', name: 'Second Souffle', icon: '🫁', color: '#34d399',
    values: [20, 27, 34, 41, 50],
    desc: (v) => `Sous 30% des PV : +${v}% de dégâts. Le dos au mur rend féroce.`,
  },
  tresorerie: {
    id: 'tresorerie', family: 'flux', name: 'Trésorerie de guerre', icon: '🛡️', color: '#fde047',
    values: [10, 14, 18, 24, 30],
    desc: (v) => `Chaque kill blinde un bouclier de 2% des PV max (cumul jusqu'à ${v}%).`,
  },
  acharne: {
    id: 'acharne', family: 'flux', name: 'Sablier de l\'Acharné', icon: '⏳', color: '#c084fc',
    values: [50, 62, 74, 86, 100],
    desc: (v) => `+2% de dégâts par seconde passée sur le MÊME ennemi (cap +${v}%). Le tueur de murs.`,
  },

  /* 🌍 ENVIRONNEMENT — l'état du monde */
  opportuniste: {
    id: 'opportuniste', family: 'environnement', name: 'Œil de l\'Opportuniste', icon: '👁️', color: '#4ade80',
    values: [30, 40, 50, 65, 80],
    desc: (v) => `Pendant qu'un ennemi INCANTE (télégraphe ⚠️) : +${v}% de dégâts.`,
  },
  orage: {
    id: 'orage', family: 'environnement', name: 'Chasseur d\'orage', icon: '🌩️', color: '#facc15',
    values: [15, 20, 25, 32, 40],
    desc: (v) => `Dans le biome en ⚡ Surcharge : +${v}% de dégâts.`,
  },
  // (v0.25 : « Semelles du Nomade » supprimée avec l'Élan du voyageur — migration : broyée en 🔹.)
  nuee: {
    id: 'nuee', family: 'environnement', name: 'Cœur de Nuée', icon: '🐝', color: '#66bb6a',
    values: [7, 8, 9, 10, 12],
    desc: (v) => `+${v}% de dégâts par ennemi vivant au-delà du premier (cap +${v * 5}%). Roi des packs.`,
  },
}

export const COND_GEM_LIST: CondGemDef[] = Object.values(COND_GEMS)

export function getCondGem(id: string): CondGemDef | undefined {
  return COND_GEMS[id as CondGemId]
}

export function gemMaxRank(def: CondGemDef): number {
  return def.values.length
}

/** Valeur du paramètre d'une gemme à un rang donné (clampé). */
export function gemValue(def: CondGemDef, rank: number): number {
  return def.values[Math.max(0, Math.min(def.values.length, rank) - 1)]
}

/** Description au rang donné. */
export function gemDesc(def: CondGemDef, rank = 1): string {
  return def.desc(gemValue(def, rank))
}

/** Clé de stock d'une gemme de condition — le RANG fait partie de la clé (rang 1 : `cond:id`). */
export function condGemKey(id: CondGemId, rank = 1): string {
  return rank > 1 ? `cond:${id}:${rank}` : `cond:${id}`
}

/** Décode une clé de stock `cond:id[:rank]`. Renvoie null si la gemme n'existe pas/plus. */
export function parseCondKey(key: string): { def: CondGemDef; rank: number } | null {
  if (!key.startsWith('cond:')) return null
  const [, id, rank] = key.split(':')
  const def = getCondGem(id)
  if (!def) return null
  return { def, rank: Math.max(1, Math.min(gemMaxRank(def), Number(rank) || 1)) }
}

/** Instance sertissable (type/tier vestigiels, `cond` + `rank` font foi). */
export function condGemInstance(id: CondGemId, rank = 1): GemInstance {
  return { type: 'physique', tier: 0, cond: id, rank }
}

/* ------------------------------------------------------------------ */
/* Drops                                                               */
/* ------------------------------------------------------------------ */

/** Famille de gemme qui tombe dans chaque biome (Physique : au hasard). */
export const BIOME_GEM_FAMILY: Partial<Record<DamageType, GemFamily>> = {
  feu: 'rythme', foudre: 'rythme',
  ombre: 'flux', nature: 'flux',
  arcane: 'environnement', froid: 'environnement',
}

/** Tire une gemme au hasard, dans une famille donnée (ou toutes si absente). */
export function rollCondGem(family?: GemFamily): CondGemDef {
  const pool = family ? COND_GEM_LIST.filter((g) => g.family === family) : COND_GEM_LIST
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Chance de drop d'une gemme de condition dans le biome, par rang d'ennemi. */
export const COND_GEM_DROP = { normal: 0.003, elite: 0.02, boss: 0.05 }
/** Chance et montants de drop de POUSSIÈRE de gemme 💠, par rang d'ennemi. */
export const GEM_DUST_DROP = { chance: { normal: 0.06, elite: 0.2, boss: 0.35 }, amount: { normal: 2, elite: 5, boss: 10 } }

/* ------------------------------------------------------------------ */
/* Poussière de gemme : broyage / taille / recoupe (Joaillier)         */
/* ------------------------------------------------------------------ */

/** Poussière rendue par le broyage d'une gemme de condition (+ par rang déjà recoupé). */
export function grindDust(rank = 1): number {
  return 15 + 10 * (Math.max(1, rank) - 1)
}

/** Poussière rendue par une ANCIENNE gemme élémentaire (migration v0.22). */
export function legacyGemDust(tier: number): number {
  return 2 * Math.pow(3, Math.max(1, tier) - 1) // Éclatée 2 · Polie 6 · Parfaite 18
}

/** Coût de TAILLE d'une gemme au choix (rang 1). */
export const GEM_CUT_COST = 60

/** Coût de RECOUPE : passer du rang `rank` au suivant. */
export function recutCost(rank: number): number {
  return 25 * (rank + 1) // 50 · 75 · 100 · 125
}

/* ------------------------------------------------------------------ */
/* Agrégation d'équipe (mods de combat)                                */
/* ------------------------------------------------------------------ */

/** Effets de gemmes actifs sur l'équipe — meilleur rang porté par gemme. */
export interface CondMods {
  overkill?: boolean
  conquete?: boolean
  /** Cap du Sablier de l'Acharné (fraction, ex. 0.5). */
  acharneCap?: number
  /** Bonus par ennemi de la Nuée (fraction, ex. 0.07). */
  nueePer?: number
  /** Métronome : 1 critique garanti toutes les N attaques. */
  metronomeN?: number
  /** Écho : le sort suivant est doublé tous les N lancements. */
  echoN?: number
  /** Crescendo : cap du cumul de kills (fraction). */
  crescendoCap?: number
  /** Pacte sanglant : réduction de recharge (fraction) contre 2% PV par cast. */
  pacteCdr?: number
  /** Second Souffle : bonus de dégâts sous 30% PV (fraction). */
  souffle?: number
  /** Trésorerie : cap du bouclier par kills (fraction des PV max). */
  tresorerieCap?: number
  /** Opportuniste : bonus pendant une incantation ennemie (fraction). */
  opportuniste?: number
  /** Chasseur d'orage : bonus dans le biome en Surcharge (fraction). */
  orage?: number
}

/** Meilleur rang porté par gemme sur TOUTE l'équipe.
 *  `familyBonus` (◈ spec du Joaillier) : les gemmes de cette famille comptent +1 rang (capé). */
export function condGemRanks(characters: Character[], familyBonus?: GemFamily | null): Map<CondGemId, number> {
  const out = new Map<CondGemId, number>()
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      for (const g of it?.gems ?? []) {
        if (!g.cond) continue
        const id = g.cond as CondGemId
        const def = COND_GEMS[id]
        if (!def) continue
        const bonus = familyBonus && def.family === familyBonus ? 1 : 0
        const rank = Math.min(gemMaxRank(def), (g.rank ?? 1) + bonus)
        out.set(id, Math.max(out.get(id) ?? 0, rank))
      }
    }
  }
  return out
}

/** Construit les mods de combat depuis les rangs portés. */
export function condGemMods(characters: Character[], familyBonus?: GemFamily | null): CondMods {
  const ranks = condGemRanks(characters, familyBonus)
  const val = (id: CondGemId) => {
    const r = ranks.get(id)
    return r ? gemValue(COND_GEMS[id], r) : undefined
  }
  const pct = (id: CondGemId) => {
    const v = val(id)
    return v !== undefined ? v / 100 : undefined
  }
  return {
    overkill: ranks.has('overkill') || undefined,
    conquete: ranks.has('conquete') || undefined,
    acharneCap: pct('acharne'),
    nueePer: pct('nuee'),
    metronomeN: val('metronome'),
    echoN: val('echo'),
    crescendoCap: pct('crescendo'),
    pacteCdr: pct('pacte'),
    souffle: pct('souffle'),
    tresorerieCap: pct('tresorerie'),
    opportuniste: pct('opportuniste'),
    orage: pct('orage'),
  }
}

/** Multiplicateur de l'Acharné selon l'âge du combat contre l'ennemi courant. */
export function acharneMult(age: number, cap = 0.5): number {
  return 1 + Math.min(cap, 0.02 * age)
}

/** Multiplicateur de la Nuée selon le nombre d'ennemis vivants. */
export function nueeMult(aliveCount: number, per = 0.07): number {
  return 1 + Math.min(per * 5, per * Math.max(0, aliveCount - 1))
}
