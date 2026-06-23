/**
 * PRESTIGE « Éveil Primordial ».
 *
 * Reset DUR : on rend les vagues, le niveau, le stuff (SAUF 1 Relique) et les tiers de raid
 * tentables, contre des ÉCHOS PRIMORDIAUX 💠 — investis dans une CONSTELLATION (méta-arbre, séparé
 * de l'arbre de talents). Conservés à travers l'Éveil : Échos + Constellation, la Relique, le record
 * de progression (gating), et l'XP des métiers (choix A).
 *
 * La monnaie est indexée sur LE CONTENU le plus dur battu (tier de raid × vague × diversité),
 * pas sur le temps farmé. La courbe s'accélère : Vélocité + Offline + Acclimatation rendent chaque
 * vie plus rapide et plus solide que la précédente.
 */

export interface ConstNode {
  id: string
  name: string
  icon: string
  desc: string
  maxRank: number
  /** Coût en Échos du rang 1 (les rangs suivants renchérissent ×1,6). */
  baseCost: number
}

export const CONSTELLATION: ConstNode[] = [
  { id: 'velocite', name: 'Vélocité primordiale', icon: '⚡', maxRank: 8, baseCost: 2, desc: '+4 % de vitesse d\'attaque par rang — chaque vie se re-farme plus vite.' },
  { id: 'puissance', name: 'Force ancestrale', icon: '⚔️', maxRank: 8, baseCost: 2, desc: '+5 % de TOUS tes dégâts par rang.' },
  { id: 'vitalite', name: 'Endurance éternelle', icon: '❤️', maxRank: 8, baseCost: 2, desc: '+6 % de PV par rang.' },
  { id: 'acclim', name: 'Acclimatation', icon: '🜍', maxRank: 6, baseCost: 3, desc: '+12 points de résistance (TOUS types) par rang — le check endgame s\'adoucit.' },
  { id: 'offrande', name: 'Offrande au gouffre', icon: '🌙', maxRank: 6, baseCost: 2, desc: '+15 % de gains HORS-LIGNE par rang.' },
  { id: 'echo', name: 'Résonance', icon: '💠', maxRank: 4, baseCost: 4, desc: '+15 % d\'Échos gagnés au prochain Éveil, par rang.' },
  { id: 'relique', name: 'Relique majeure', icon: '🏺', maxRank: 4, baseCost: 5, desc: 'La Relique conservée garde un iLvl plancher plus haut (+18 par rang).' },
  { id: 'etincelle', name: 'Première étincelle', icon: '✨', maxRank: 1, baseCost: 1, desc: 'Après chaque Éveil, tu démarres avec un coup de pouce (or de départ + 3 niveaux).' },
]

const BY_ID = new Map(CONSTELLATION.map((n) => [n.id, n]))
export function getConstNode(id: string): ConstNode | undefined { return BY_ID.get(id) }

/** Coût en Échos pour passer du rang `currentRank` au suivant. */
export function nodeCost(node: ConstNode, currentRank: number): number {
  return Math.round(node.baseCost * Math.pow(1.6, currentRank))
}

export interface PrestigeMods {
  speedMult: number
  damageMult: number
  vitalityMult: number
  resistFlat: number
  offlineMult: number
  echosMult: number
  /** iLvl plancher BONUS de la Relique conservée. */
  relicFloor: number
  /** Première étincelle débloquée. */
  etincelle: boolean
}

/** Agrège les effets de la Constellation à partir des rangs alloués. */
export function constellationMods(alloc: Record<string, number>): PrestigeMods {
  const r = (id: string) => alloc[id] ?? 0
  return {
    speedMult: 1 + r('velocite') * 0.04,
    damageMult: 1 + r('puissance') * 0.05,
    vitalityMult: 1 + r('vitalite') * 0.06,
    resistFlat: r('acclim') * 12,
    offlineMult: 1 + r('offrande') * 0.15,
    echosMult: 1 + r('echo') * 0.15,
    relicFloor: r('relique') * 18,
    etincelle: r('etincelle') > 0,
  }
}

/** iLvl PLANCHER de base de la Relique (avant bonus de Constellation). */
export const RELIC_BASE_ILVL = 24

/**
 * Échos gagnés à l'Éveil : f(meilleur tier de raid, vague record, diversité de raids battus).
 * Indexé sur LE CONTENU vaincu, pas le temps farmé. `echosMult` = bonus « Résonance ».
 */
export function echosGain(bestRaidTier: number, bestStage: number, raidsBeaten: number, echosMult: number): number {
  const base = Math.pow(Math.max(0, bestRaidTier), 1.5) * 2 + Math.floor(Math.max(0, bestStage) / 10) + raidsBeaten * 3
  return Math.max(1, Math.round(base * echosMult))
}
