import type { DamageType, Equipment } from './types'
import type { KeystoneEffect } from './talents'
import { instanceResist } from './uniques'

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

/** Résistance maximale d'un héros à un type (cap dur). */
export const RESIST_CAP = 0.75

export interface DamageProfile {
  /** Répartition des dégâts par type (somme = 1). */
  profile: Partial<Record<DamageType, number>>
  /** Bonus multiplicatif par type (0.3 = +30%). */
  bonus: Partial<Record<DamageType, number>>
  /** Type dominant (pour l'affichage). */
  mainType: DamageType
}

/**
 * Calcule le profil de dégâts du personnage à partir de son équipement + des keystones.
 * - Le type de base vient de l'arme principale (Physique par défaut).
 * - Les affixes `dmgType` (+% type) s'accumulent en bonus multiplicatifs par type.
 * - Les keystones `convertDamage` redistribuent une fraction d'un type vers un autre.
 */
export function computeDamageProfile(equipment: Equipment, keystones: KeystoneEffect[] = []): DamageProfile {
  const mainTypeBase: DamageType = equipment.armePrincipale?.damageType ?? 'physique'
  const profile: Partial<Record<DamageType, number>> = { [mainTypeBase]: 1 }

  // Conversions de type (keystones).
  for (const k of keystones) {
    if (!k.convertDamage) continue
    const { from, to, frac } = k.convertDamage
    const moved = (profile[from] ?? 0) * frac
    if (moved <= 0) continue
    profile[from] = (profile[from] ?? 0) - moved
    profile[to] = (profile[to] ?? 0) + moved
  }

  const bonus: Partial<Record<DamageType, number>> = {}
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item) continue
    for (const aff of item.affixes) {
      if (aff.kind === 'dmgType' && aff.type) bonus[aff.type] = (bonus[aff.type] ?? 0) + aff.value / 100
    }
  }

  // Type dominant = part de profil la plus haute.
  let mainType = mainTypeBase
  let best = -1
  for (const t in profile) {
    const v = profile[t as DamageType] ?? 0
    if (v > best) { best = v; mainType = t as DamageType }
  }

  return { profile, bonus, mainType }
}

/** Profil de résistances du héros : affixes `resist` + résistances de talents (capé). */
export function computeResistProfile(
  equipment: Equipment,
  talentResist: Partial<Record<DamageType, number>> = {},
): Partial<Record<DamageType, number>> {
  const resist: Partial<Record<DamageType, number>> = { ...talentResist }
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item) continue
    for (const aff of item.affixes) {
      if (aff.kind === 'resist' && aff.type) resist[aff.type] = (resist[aff.type] ?? 0) + aff.value / 100
    }
    if (item.unique) {
      const ur = instanceResist(item.unique)
      for (const t in ur) resist[t as DamageType] = (resist[t as DamageType] ?? 0) + (ur[t as DamageType] ?? 0)
    }
  }
  for (const t in resist) {
    const type = t as DamageType
    resist[type] = Math.min(RESIST_CAP, resist[type] ?? 0)
  }
  return resist
}

/** Multiplicateur de dégâts effectif sur le type dominant (pour l'affichage). */
export function effectiveTypeMult(p: DamageProfile): number {
  return 1 + (p.bonus[p.mainType] ?? 0)
}
