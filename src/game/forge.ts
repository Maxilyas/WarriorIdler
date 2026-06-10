/**
 * MÉTIER DE FORGERON (v0.19).
 *
 * Le forgeron est un métier qui MONTE en puissance. On gagne du « Savoir-faire » 🔧 en CRÉANT et en
 * MODIFIANT des objets (plus le craft est dur, plus on en gagne), puis on le dépense en améliorations :
 *  - DÉBLOCAGES : au début seules la création et la reforge de base existent ; on débloque ensuite le
 *    surillvl, la transmutation, le craft typé (quintessence) et l'ascension.
 *  - BONUS : réduire les coûts, augmenter la chance de forger une rareté supérieure, gagner plus de 🔧.
 */

export type ForgeUpgradeId =
  | 'unlockSurillvl' | 'unlockTransmute' | 'unlockQuint' | 'unlockAscend'
  | 'forgeCost' | 'forgeLuck' | 'forgeYield'

export interface ForgeUpgrade {
  id: ForgeUpgradeId
  name: string
  icon: string
  description: string
  /** 1 = déblocage ponctuel ; >1 = bonus à paliers. */
  maxLevel: number
  /** Coût en Savoir-faire 🔧 au niveau 0 (puis ×growth par niveau). */
  baseCost: number
  growth: number
  /** Déblocage d'une fonction de l'atelier (sinon = bonus chiffré). */
  unlocks?: 'surillvl' | 'ascend' | 'transmute' | 'quint'
}

/** Boutique du métier : d'abord les déblocages (progression), puis les bonus à paliers. */
export const FORGE_UPGRADES: ForgeUpgrade[] = [
  { id: 'unlockSurillvl', name: 'Maître affûteur', icon: '⬆️', maxLevel: 1, baseCost: 60, growth: 1, unlocks: 'surillvl',
    description: 'Débloque le SURILLVL : augmenter l\'iLvl d\'un objet (atelier).' },
  { id: 'unlockTransmute', name: 'Transmutateur', icon: '🔄', maxLevel: 1, baseCost: 140, growth: 1, unlocks: 'transmute',
    description: 'Débloque la TRANSMUTATION : changer la stat primaire d\'un objet.' },
  { id: 'unlockQuint', name: 'Alchimiste de forge', icon: '⚗️', maxLevel: 1, baseCost: 240, growth: 1, unlocks: 'quint',
    description: 'Débloque le craft typé à la QUINTESSENCE (lignes de dégâts / résistance).' },
  { id: 'unlockAscend', name: 'Grand-maître forgeron', icon: '✨', maxLevel: 1, baseCost: 450, growth: 1, unlocks: 'ascend',
    description: 'Débloque l\'ASCENSION : monter un objet d\'un cran de rareté.' },
  { id: 'forgeCost', name: 'Forgeron économe', icon: '💰', maxLevel: 10, baseCost: 100, growth: 1.5,
    description: '−3% des coûts de craft (éclats & matériaux) par niveau.' },
  { id: 'forgeLuck', name: 'Œil du joaillier', icon: '🎲', maxLevel: 10, baseCost: 130, growth: 1.55,
    description: '+4% de chance de forger une rareté SUPÉRIEURE par niveau (création).' },
  { id: 'forgeYield', name: 'Maître artisan', icon: '🔧', maxLevel: 8, baseCost: 90, growth: 1.5,
    description: '+15% de Savoir-faire gagné par niveau.' },
]

const BY_ID = new Map(FORGE_UPGRADES.map((u) => [u.id, u]))
export function getForgeUpgrade(id: ForgeUpgradeId): ForgeUpgrade | undefined {
  return BY_ID.get(id)
}

/** Coût (en 🔧) pour passer du niveau `level` au suivant. */
export function forgeUpgradeCost(u: ForgeUpgrade, level: number): number {
  return Math.round(u.baseCost * Math.pow(u.growth, level))
}
export function forgeUpgradeMaxed(u: ForgeUpgrade, level: number): boolean {
  return level >= u.maxLevel
}

export interface ForgeMods {
  /** Multiplicateur des coûts de craft (≤ 1). */
  costMult: number
  /** Chance de forger une rareté +1 cran (création). */
  luckChance: number
  /** Multiplicateur du Savoir-faire gagné. */
  yieldMult: number
  /** Fonctions débloquées. */
  surillvl: boolean
  ascend: boolean
  transmute: boolean
  quint: boolean
}

export function forgeMods(upg: Record<string, number>): ForgeMods {
  const lv = (id: ForgeUpgradeId) => upg[id] ?? 0
  return {
    costMult: Math.max(0.5, 1 - lv('forgeCost') * 0.03),
    luckChance: Math.min(0.6, lv('forgeLuck') * 0.04),
    yieldMult: 1 + lv('forgeYield') * 0.15,
    surillvl: lv('unlockSurillvl') > 0,
    ascend: lv('unlockAscend') > 0,
    transmute: lv('unlockTransmute') > 0,
    quint: lv('unlockQuint') > 0,
  }
}

/**
 * Savoir-faire 🔧 gagné par opération, proportionnel à la DIFFICULTÉ (tier de rareté).
 * create > ascend > modify (reforge/surillvl/transmute/quintessence).
 */
export function forgeMasteryGain(tier: number, kind: 'create' | 'ascend' | 'modify', yieldMult = 1): number {
  const base = kind === 'create' ? 2 : kind === 'ascend' ? 3.5 : 0.7
  return Math.max(1, Math.round(base * Math.pow(tier, 1.3) * yieldMult))
}
