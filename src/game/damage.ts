import type { DamageType, Equipment } from './types'

export interface DamageTypeMeta {
  id: DamageType
  name: string
  icon: string
  color: string
}

export const DAMAGE_TYPES: Record<DamageType, DamageTypeMeta> = {
  physique: { id: 'physique', name: 'Physique', icon: '⚔️', color: '#cbd5e1' },
  feu: { id: 'feu', name: 'Feu', icon: '🔥', color: '#ff6b35' },
  froid: { id: 'froid', name: 'Froid', icon: '❄️', color: '#4dd0e1' },
  foudre: { id: 'foudre', name: 'Foudre', icon: '⚡', color: '#ffd54f' },
  arcane: { id: 'arcane', name: 'Arcane', icon: '✨', color: '#c084fc' },
  ombre: { id: 'ombre', name: 'Ombre', icon: '🌑', color: '#a78bfa' },
  nature: { id: 'nature', name: 'Nature', icon: '🌿', color: '#66bb6a' },
}

export const DAMAGE_TYPE_LIST: DamageType[] = Object.keys(DAMAGE_TYPES) as DamageType[]

export interface DamageProfile {
  /** Répartition des dégâts par type (somme = 1). */
  profile: Partial<Record<DamageType, number>>
  /** Bonus multiplicatif par type (0.3 = +30%). */
  bonus: Partial<Record<DamageType, number>>
  /** Type dominant (pour l'affichage). */
  mainType: DamageType
}

/**
 * Calcule le profil de dégâts du personnage à partir de son équipement.
 * - Le type de base vient de l'arme principale (Physique par défaut).
 * - Les affixes "+% type" s'accumulent en bonus multiplicatifs par type.
 */
export function computeDamageProfile(equipment: Equipment): DamageProfile {
  const mainType: DamageType = equipment.armePrincipale?.damageType ?? 'physique'
  const profile: Partial<Record<DamageType, number>> = { [mainType]: 1 }

  const bonus: Partial<Record<DamageType, number>> = {}
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item?.typeAffixes) continue
    for (const ta of item.typeAffixes) {
      bonus[ta.type] = (bonus[ta.type] ?? 0) + ta.value / 100
    }
  }

  return { profile, bonus, mainType }
}

/** Multiplicateur de dégâts effectif sur le type dominant (pour l'affichage). */
export function effectiveTypeMult(p: DamageProfile): number {
  return 1 + (p.bonus[p.mainType] ?? 0)
}
