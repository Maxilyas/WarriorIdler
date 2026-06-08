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

/** Poids de base de l'arme dans le profil (le reste vient des affixes +% type de TOUT le stuff). */
const WEAPON_BASE_WEIGHT = 1
/** Part d'un affixe « +% type » reversée dans la RÉPARTITION du profil (diversification). */
const AFFIX_PROFILE_SHARE = 0.7
/** Part d'un affixe « +% type » conservée en bonus multiplicatif brut (+% de dégâts). */
const AFFIX_BONUS_SHARE = 0.5

/**
 * Calcule le profil de dégâts à partir de TOUT l'équipement (plus seulement l'arme) + des keystones.
 * - L'arme principale pose un poids de base sur son type.
 * - Chaque affixe `+% type` (n'importe quelle pièce) ajoute du POIDS à ce type dans la répartition
 *   ET un bonus multiplicatif → empiler du Feu sur une arme Physique fait basculer ton profil vers
 *   le Feu. Le stuff entier façonne le profil, l'arme ne le verrouille plus.
 * - `convertDamage` déplace une part d'un type vers un autre ; `splashType` ajoute une part SANS
 *   retirer (double appartenance), pour les nœuds « le Physique compte aussi comme Feu ».
 */
export function computeDamageProfile(equipment: Equipment, keystones: KeystoneEffect[] = []): DamageProfile {
  const mainTypeBase: DamageType = equipment.armePrincipale?.damageType ?? 'physique'

  // 1) Poids bruts par type : arme de base + contribution des affixes +% type de tout le stuff.
  const weight: Partial<Record<DamageType, number>> = { [mainTypeBase]: WEAPON_BASE_WEIGHT }
  const bonus: Partial<Record<DamageType, number>> = {}
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item) continue
    for (const aff of item.affixes) {
      if (aff.kind === 'dmgType' && aff.type) {
        weight[aff.type] = (weight[aff.type] ?? 0) + (aff.value / 100) * AFFIX_PROFILE_SHARE
        bonus[aff.type] = (bonus[aff.type] ?? 0) + (aff.value / 100) * AFFIX_BONUS_SHARE
      }
    }
  }

  // 2) Conversions (déplacent) puis éclaboussures (ajoutent sans retirer).
  for (const k of keystones) {
    if (!k.convertDamage) continue
    const { from, to, frac } = k.convertDamage
    const moved = (weight[from] ?? 0) * frac
    if (moved <= 0) continue
    weight[from] = (weight[from] ?? 0) - moved
    weight[to] = (weight[to] ?? 0) + moved
  }
  for (const k of keystones) {
    if (!k.splashType) continue
    const { from, to, frac } = k.splashType
    const added = (weight[from] ?? 0) * frac
    if (added <= 0) continue
    weight[to] = (weight[to] ?? 0) + added
  }

  // 3) Normalisation → répartition (somme = 1).
  let total = 0
  for (const t in weight) total += Math.max(0, weight[t as DamageType] ?? 0)
  if (total <= 0) { total = 1; weight[mainTypeBase] = 1 }
  const profile: Partial<Record<DamageType, number>> = {}
  let mainType = mainTypeBase
  let best = -1
  for (const t in weight) {
    const type = t as DamageType
    const v = Math.max(0, weight[type] ?? 0) / total
    if (v <= 0) continue
    profile[type] = v
    if (v > best) { best = v; mainType = type }
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
