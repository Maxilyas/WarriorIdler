/**
 * MARCHÉ & BONUS DE COMPTE — améliorations permanentes (`UPGRADES`, puits d'or/éclats) ET
 * l'AGRÉGATEUR CENTRAL `computeGlobalMods` où se cumulent améliorations + Conseil des Maîtrises +
 * hauts faits (mêmes clés/coefficients). Brancher ici tout nouveau bonus de compte. Le Marché est
 * volontairement VIDÉ de sa puissance (v0.25) : seule la Forge stellaire reste un puits de combat.
 *   → Doc : docs/systemes/08-metiers-et-craft.md
 */
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
  /** Coût en Poussière d'étoile par niveau (amélioration sommitale). */
  poussierePerLevel?: number
  /** Coût SUPPLÉMENTAIRE en Éclats d'arcane, en fraction du coût en or (l'or seul ne suffit plus). */
  eclatsFrac?: number
}

export const UPGRADE_CATEGORIES: Record<UpgradeCategory, { name: string; color: string }> = {
  economie: { name: 'Économie', color: '#ffd43b' },
  progression: { name: 'Progression', color: '#c084fc' },
  combat: { name: 'Combat', color: '#ff6b6b' },
  confort: { name: 'Confort', color: '#4dabf7' },
}

/**
 * Améliorations permanentes de compte (puits d'or + Éclats à coûts croissants). Data-driven.
 * v0.25 (DESIGN §1) — le Marché est VIDÉ de sa puissance : Puissance/Vivacité/Vitalité/Régénération
 * supprimées (pas chères + grosses différences = inéquilibrables), Sacoches supprimée (inventaire
 * illimité). La progression de compte passe au 🏛️ Conseil des Maîtrises (time-gaté, bonus minimes).
 * Seule puissance restante : la Forge stellaire — puits SOMMITAL infini, cher, gaté 🌌.
 */
export const UPGRADES: UpgradeDef[] = [
  // Économie
  { id: 'goldGain', name: 'Cupidité', description: "Augmente l'or gagné en combat.", category: 'economie', icon: '💰', baseCost: 500, growth: 1.6, perLevel: 0.1, unit: 'pct', eclatsFrac: 0.25 },
  { id: 'lootQty', name: 'Pilleur', description: 'Augmente la chance de butin supplémentaire.', category: 'economie', icon: '🎁', baseCost: 800, growth: 1.6, perLevel: 0.08, unit: 'pct', maxLevel: 10, eclatsFrac: 0.25 },
  { id: 'rarityLuck', name: 'Chance', description: 'Améliore la rareté du butin trouvé.', category: 'economie', icon: '🍀', baseCost: 1200, growth: 1.8, perLevel: 0.3, unit: 'flat', maxLevel: 16, eclatsFrac: 0.3 },
  { id: 'eclatGain', name: 'Récupérateur', description: 'Augmente les Éclats obtenus au recyclage.', category: 'economie', icon: '♦', baseCost: 600, growth: 1.6, perLevel: 0.12, unit: 'pct', eclatsFrac: 0.25 },

  // Progression
  { id: 'xpGain', name: 'Érudition', description: "Augmente l'XP gagnée.", category: 'progression', icon: '⬆', baseCost: 600, growth: 1.6, perLevel: 0.1, unit: 'pct', eclatsFrac: 0.2 },
  { id: 'talentBonus', name: 'Sagesse innée', description: 'Points de talent supplémentaires par personnage (immédiat).', category: 'progression', icon: '🌟', baseCost: 8000, growth: 2.4, perLevel: 1, unit: 'flat', maxLevel: 12 },

  // Combat — uniquement le puits sommital (cher, gaté par la Poussière d'étoile)
  { id: 'forgeStellaire', name: 'Forge stellaire', description: 'Puits sommital infini : +4% de puissance/niveau (or + Poussière d\'étoile).', category: 'combat', icon: '🌌', baseCost: 50000, growth: 1.7, perLevel: 0.04, unit: 'pct', poussierePerLevel: 2, eclatsFrac: 0.4 },
]

/** v0.25 — améliorations SUPPRIMÉES (migration : remboursement 100% or + éclats depuis ces formules). */
export const REMOVED_UPGRADES: Record<string, { baseCost: number; growth: number; eclatsFrac?: number }> = {
  power: { baseCost: 1200, growth: 1.6, eclatsFrac: 0.35 },
  attackSpeed: { baseCost: 1500, growth: 1.62, eclatsFrac: 0.35 },
  vitality: { baseCost: 1200, growth: 1.6, eclatsFrac: 0.35 },
  regen: { baseCost: 1000, growth: 1.6, eclatsFrac: 0.3 },
  inventory: { baseCost: 600, growth: 1.6 },
}

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

/** Coût en Poussière d'étoile du prochain niveau (amélioration sommitale). */
export function upgradePoussiere(def: UpgradeDef, level: number): number {
  if (!def.poussierePerLevel) return 0
  return def.poussierePerLevel * (level + 1)
}

/** Coût SUPPLÉMENTAIRE en Éclats d'arcane du prochain niveau (fraction du coût en or). */
export function upgradeEclats(def: UpgradeDef, level: number): number {
  if (!def.eclatsFrac) return 0
  return Math.round(upgradeCost(def, level) * def.eclatsFrac)
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

/**
 * Calcule tous les multiplicateurs/bonus globaux issus des améliorations — et, v0.25, de l'arbre
 * du 🏛️ Conseil des Maîtrises (`maitrise` : rangs par nœud, bonus minimes appliqués partout).
 */
export function computeGlobalMods(
  upgrades: Record<string, number>,
  maitrise: Record<string, number> = {},
  /** v0.28 — rangs « façon Maîtrise » crédités par les hauts faits (mêmes clés, mêmes coefficients). */
  achv: Record<string, number> = {},
): GlobalMods {
  const lv = (id: string) => upgrades[id] ?? 0
  const mr = (id: string) => (maitrise[id] ?? 0) + (achv[id] ?? 0)
  return {
    // v0.25 : Puissance/Vivacité/Vitalité/Régénération supprimées — seule la Forge stellaire
    // (puits sommital) et la Maîtrise (minime) portent encore du combat.
    power: (1 + lv('forgeStellaire') * 0.04) * (1 + mr('frappe') * 0.004),
    attackSpeed: 1 + mr('celerite') * 0.003,
    vitality: 1 + mr('vigueur') * 0.005,
    regen: 1,
    goldGain: (1 + lv('goldGain') * 0.1) * (1 + mr('fortune') * 0.01),
    xpGain: (1 + lv('xpGain') * 0.1) * (1 + mr('savoir') * 0.01),
    eclatGain: 1 + lv('eclatGain') * 0.12,
    lootChance: lv('lootQty') * 0.08 + mr('flair') * 0.005,
    rarityLuck: lv('rarityLuck') * 0.3,
    inventoryBonus: 0, // v0.25 : inventaire illimité (Sacoches supprimée)
    talentBonus: lv('talentBonus'),
  }
}
