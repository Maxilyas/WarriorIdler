import type { Character, GemInstance } from './types'

/**
 * GEMMES DE CONDITION (v0.21) — la « programmation » du combat.
 *
 * Contrairement aux gemmes élémentaires (stats plates), une gemme de condition déclenche un
 * COMPORTEMENT : un trigger de combat qui change la façon de jouer. Elles occupent les MÊMES
 * châsses que les gemmes élémentaires → vrai arbitrage (stats sûres vs comportement).
 * Sans qualité ni fusion : chaque gemme est unique en son genre.
 * Sources (endgame assumé) : champions ✦ (12%) et coffres de raid (25%) — on farme POUR elles.
 * Les effets sont agrégés au niveau de l'ÉQUIPE (une gemme portée par n'importe quel membre).
 */

export type CondGemId = 'overkill' | 'conquete' | 'acharne' | 'nuee'

export interface CondGemDef {
  id: CondGemId
  name: string
  icon: string
  color: string
  desc: string
}

export const COND_GEMS: Record<CondGemId, CondGemDef> = {
  overkill: {
    id: 'overkill', name: 'Étoile d\'Overkill', icon: '🌠', color: '#ffd43b',
    desc: 'L\'excédent de dégâts du coup fatal frappe l\'ennemi SUIVANT. Le farm s\'enchaîne.',
  },
  conquete: {
    id: 'conquete', name: 'Fragment de Conquête', icon: '🏆', color: '#fb923c',
    desc: 'Tuer un boss ou une élite remet à zéro la plus longue recharge de chaque héros.',
  },
  acharne: {
    id: 'acharne', name: 'Sablier de l\'Acharné', icon: '⏳', color: '#c084fc',
    desc: '+2% de dégâts par seconde passée sur le MÊME ennemi (cap +50%). Le tueur de murs.',
  },
  nuee: {
    id: 'nuee', name: 'Cœur de Nuée', icon: '🐝', color: '#66bb6a',
    desc: '+7% de dégâts par ennemi vivant au-delà du premier (cap +35%). Roi des packs.',
  },
}

export const COND_GEM_LIST: CondGemDef[] = Object.values(COND_GEMS)

export function getCondGem(id: string): CondGemDef | undefined {
  return COND_GEMS[id as CondGemId]
}

/** Clé de stock d'une gemme de condition. */
export function condGemKey(id: CondGemId): string {
  return `cond:${id}`
}

/** Instance sertissable d'une gemme de condition (type/tier neutres, `cond` fait foi). */
export function condGemInstance(id: CondGemId): GemInstance {
  return { type: 'physique', tier: 0, cond: id }
}

/** Tire une gemme de condition au hasard (drops champions / raids). */
export function rollCondGem(): CondGemDef {
  return COND_GEM_LIST[Math.floor(Math.random() * COND_GEM_LIST.length)]
}

/** Gemmes de condition actives sur l'ÉQUIPE (union de tout l'équipement). */
export function condGemFlags(characters: Character[]): Set<CondGemId> {
  const out = new Set<CondGemId>()
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      for (const g of it?.gems ?? []) if (g.cond) out.add(g.cond as CondGemId)
    }
  }
  return out
}

/** Multiplicateur de l'Acharné selon l'âge du combat contre l'ennemi courant. */
export function acharneMult(age: number): number {
  return 1 + Math.min(0.5, 0.02 * age)
}

/** Multiplicateur de la Nuée selon le nombre d'ennemis vivants. */
export function nueeMult(aliveCount: number): number {
  return 1 + Math.min(0.35, 0.07 * Math.max(0, aliveCount - 1))
}
