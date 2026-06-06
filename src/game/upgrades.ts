export type UpgradeCategory = 'economie' | 'progression' | 'combat' | 'confort'

export interface UpgradeDef {
  id: string
  name: string
  description: string
  category: UpgradeCategory
  icon: string
  baseCost: number
  growth: number
  /** Valeur ajoutée par niveau (interprétée selon l'id). */
  perLevel: number
  unit: 'pct' | 'flat'
  maxLevel?: number
}

export const UPGRADE_CATEGORIES: Record<UpgradeCategory, { name: string; color: string }> = {
  economie: { name: 'Économie', color: '#ffd43b' },
  progression: { name: 'Progression', color: '#c084fc' },
  combat: { name: 'Combat', color: '#ff6b6b' },
  confort: { name: 'Confort', color: '#4dabf7' },
}

/** Améliorations permanentes de compte (puits d'or à coûts croissants). Data-driven. */
export const UPGRADES: UpgradeDef[] = [
  // Économie
  { id: 'goldGain', name: 'Cupidité', description: "Augmente l'or gagné en combat.", category: 'economie', icon: '💰', baseCost: 200, growth: 1.5, perLevel: 0.1, unit: 'pct' },
  { id: 'lootQty', name: 'Pilleur', description: 'Augmente la chance de butin supplémentaire.', category: 'economie', icon: '🎁', baseCost: 400, growth: 1.55, perLevel: 0.08, unit: 'pct', maxLevel: 10 },
  { id: 'rarityLuck', name: 'Chance', description: 'Améliore la rareté du butin trouvé.', category: 'economie', icon: '🍀', baseCost: 600, growth: 1.7, perLevel: 0.3, unit: 'flat', maxLevel: 12 },
  { id: 'eclatGain', name: 'Récupérateur', description: 'Augmente les Éclats obtenus au recyclage.', category: 'economie', icon: '♦', baseCost: 300, growth: 1.5, perLevel: 0.12, unit: 'pct' },

  // Progression
  { id: 'xpGain', name: 'Érudition', description: "Augmente l'XP gagnée.", category: 'progression', icon: '⬆', baseCost: 300, growth: 1.5, perLevel: 0.1, unit: 'pct' },
  { id: 'talentBonus', name: 'Sagesse innée', description: 'Points de talent supplémentaires par personnage (immédiat).', category: 'progression', icon: '🌟', baseCost: 5000, growth: 2.2, perLevel: 1, unit: 'flat', maxLevel: 10 },

  // Combat
  { id: 'power', name: 'Puissance', description: "Augmente la puissance de toute l'équipe.", category: 'combat', icon: '⚔', baseCost: 500, growth: 1.55, perLevel: 0.05, unit: 'pct' },
  { id: 'attackSpeed', name: 'Vivacité', description: "Augmente la vitesse d'attaque de l'équipe.", category: 'combat', icon: '⚡', baseCost: 800, growth: 1.6, perLevel: 0.04, unit: 'pct', maxLevel: 15 },
  { id: 'vitality', name: 'Vitalité', description: "Augmente les PV de toute l'équipe.", category: 'combat', icon: '❤', baseCost: 500, growth: 1.55, perLevel: 0.08, unit: 'pct' },
  { id: 'regen', name: 'Régénération', description: "Augmente la régénération de l'équipe.", category: 'combat', icon: '✚', baseCost: 600, growth: 1.55, perLevel: 0.1, unit: 'pct' },

  // Confort
  { id: 'inventory', name: 'Sacoches', description: "Augmente la taille de l'inventaire (+10/niveau).", category: 'confort', icon: '🎒', baseCost: 400, growth: 1.6, perLevel: 10, unit: 'flat', maxLevel: 12 },
]

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]))
export function getUpgrade(id: string): UpgradeDef | undefined {
  return BY_ID.get(id)
}

export function upgradeLevel(upgrades: Record<string, number>, id: string): number {
  return upgrades[id] ?? 0
}

/** Coût du prochain niveau d'une amélioration. */
export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.growth, level))
}

export function isMaxed(def: UpgradeDef, level: number): boolean {
  return def.maxLevel !== undefined && level >= def.maxLevel
}

export interface GlobalMods {
  power: number
  attackSpeed: number
  vitality: number
  regen: number
  goldGain: number
  xpGain: number
  eclatGain: number
  lootChance: number // bonus de chance de drop
  rarityLuck: number // bonus de luckTier
  inventoryBonus: number
  talentBonus: number
}

/** Calcule tous les multiplicateurs/bonus globaux issus des améliorations. */
export function computeGlobalMods(upgrades: Record<string, number>): GlobalMods {
  const lv = (id: string) => upgrades[id] ?? 0
  return {
    power: 1 + lv('power') * 0.05,
    attackSpeed: 1 + lv('attackSpeed') * 0.04,
    vitality: 1 + lv('vitality') * 0.08,
    regen: 1 + lv('regen') * 0.1,
    goldGain: 1 + lv('goldGain') * 0.1,
    xpGain: 1 + lv('xpGain') * 0.1,
    eclatGain: 1 + lv('eclatGain') * 0.12,
    lootChance: lv('lootQty') * 0.08,
    rarityLuck: lv('rarityLuck') * 0.3,
    inventoryBonus: lv('inventory') * 10,
    talentBonus: lv('talentBonus'),
  }
}
