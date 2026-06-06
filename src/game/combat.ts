import type { DerivedStats } from './stats'
import type { DamageType, Enemy } from './types'
import type { DamageProfile } from './damage'

/** Réduction de dégâts par l'armure (courbe à rendement décroissant). */
export function armorMitigation(armor: number, attackerPower: number): number {
  const k = 50 + attackerPower
  return armor / (armor + k)
}

export interface HitResult {
  damage: number
  crit: boolean
  heal: number
}

/**
 * Calcule un coup unique contre un ennemi.
 * Les dégâts sont répartis par type, puis réduits :
 * - l'armure réduit la part Physique,
 * - les résistances de l'ennemi réduisent chaque type.
 */
export function rollHit(derived: DerivedStats, profile: DamageProfile, enemy: Enemy): HitResult {
  const crit = Math.random() < derived.critChance
  const critMult = crit ? derived.critMult : 1
  const raw = derived.power * derived.masteryMult * derived.versatilityMult * critMult

  const armorMit = armorMitigation(enemy.armor, derived.power)
  let total = 0
  for (const t in profile.profile) {
    const type = t as DamageType
    const frac = profile.profile[type] ?? 0
    if (frac <= 0) continue
    let typed = raw * frac * (1 + (profile.bonus[type] ?? 0))
    if (type === 'physique') typed *= 1 - armorMit
    typed *= 1 - (enemy.resist[type] ?? 0)
    total += typed
  }

  const damage = Math.max(1, Math.round(total))
  const heal = Math.round(damage * derived.leech)
  return { damage, crit, heal }
}

/** DPS théorique (affichage) : inclut le bonus de type, ignore armure/résistances. */
export function theoreticalDps(derived: DerivedStats, profile: DamageProfile): number {
  const avgCrit = 1 + derived.critChance * (derived.critMult - 1)
  let typeMult = 0
  for (const t in profile.profile) {
    const type = t as DamageType
    typeMult += (profile.profile[type] ?? 0) * (1 + (profile.bonus[type] ?? 0))
  }
  if (typeMult === 0) typeMult = 1
  return derived.power * derived.masteryMult * derived.versatilityMult * avgCrit * derived.attacksPerSecond * typeMult
}

/** Dégâts subis par le joueur (par seconde) après réduction par la Polyvalence. */
export function incomingDps(enemyDamage: number, derived: DerivedStats): number {
  return Math.max(1, enemyDamage / derived.versatilityMult)
}
