import type { Item, StatBlock, StatKey } from './types'
import { RARITIES } from './rarities'

/**
 * ENCHANTEMENTS (v0.21) — une RUNE par pièce d'équipement.
 *
 * La rune grave une stat ciblée dont la valeur SCALE avec l'iLvl de la pièce (un surillvl
 * améliore donc aussi la rune). C'est le levier de craft « je choisis ma stat » : là où les
 * affixes sont tirés au sort, la rune est déterministe — au prix du Savoir-faire 🔧 (le
 * métier de forgeron devient un vrai puits). Remplacer une rune écrase l'ancienne.
 */

export interface EnchantDef {
  id: string
  name: string
  icon: string
  description: string
  stat: StatKey
  /** Rating gravé par point d'iLvl de la pièce. */
  per: number
  /** Rune RARE (stats rares) : coût ×3. */
  rare?: boolean
}

export const ENCHANTS: EnchantDef[] = [
  { id: 'tranchant', name: 'Tranchant', icon: '🗡️', stat: 'critique', per: 1.0, description: 'Grave du Critique sur la pièce.' },
  { id: 'cruaute', name: 'Cruauté', icon: '🩸', stat: 'degatsCrit', per: 1.0, description: 'Grave des Dégâts critiques.' },
  { id: 'celerite', name: 'Célérité', icon: '💨', stat: 'hate', per: 1.0, description: 'Grave de la Hâte.' },
  { id: 'perceur', name: 'Perce-armure', icon: '🪓', stat: 'penetration', per: 0.9, description: 'Grave de la Pénétration.' },
  { id: 'chasseur', name: 'Chasseur de rois', icon: '🎯', stat: 'degatsBoss', per: 1.0, description: 'Grave des Dégâts aux boss.' },
  { id: 'gardien', name: 'Gardien', icon: '🛡️', stat: 'reductionDegats', per: 1.0, description: 'Grave de la Réduction de dégâts.' },
  { id: 'felin', name: 'Grâce féline', icon: '🐈', stat: 'esquive', per: 0.9, description: 'Grave de l\'Esquive.' },
  { id: 'colosse', name: 'Colosse', icon: '🗿', stat: 'endurance', per: 1.3, description: 'Grave de l\'Endurance (PV).' },
  { id: 'sangsue', name: 'Sangsue', icon: '🧛', stat: 'volDeVie', per: 0.35, rare: true, description: 'Grave du Vol de vie (rune RARE).' },
  { id: 'chronomage', name: 'Chrono-rune', icon: '⏳', stat: 'recuperation', per: 0.3, rare: true, description: 'Grave de la Récupération (rune RARE).' },
]

const BY_ID = new Map(ENCHANTS.map((e) => [e.id, e]))
export function getEnchant(id: string): EnchantDef | undefined {
  return BY_ID.get(id)
}

/** Valeur gravée par une rune sur une pièce donnée (scale avec l'iLvl). */
export function enchantValue(def: EnchantDef, item: Item): number {
  return Math.max(1, Math.round(item.ilvl * def.per))
}

/** Stats apportées par la rune d'un objet (vide si non enchanté). */
export function enchantMods(item: Item): StatBlock {
  if (!item.enchant) return {}
  const def = BY_ID.get(item.enchant)
  if (!def) return {}
  return { [def.stat]: enchantValue(def, item) }
}

/** Coût de gravure : Savoir-faire 🔧 (le métier est le vrai puits) + éclats. */
export function enchantCost(def: EnchantDef, item: Item): { mastery: number; eclats: number } {
  const tier = RARITIES[item.rarity].tier
  const rareMult = def.rare ? 3 : 1
  return {
    mastery: Math.round(25 * tier * rareMult),
    eclats: Math.round(item.ilvl * 3 * tier * rareMult),
  }
}
