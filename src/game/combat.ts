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

export interface HitOpts {
  /** Multiplicateur de dégâts supplémentaire (keystones : damageMult, lowHpBonus…). */
  bonusMult?: number
  /** Exécution : ×mult si les PV de l'ennemi sont sous threshold. */
  execute?: { threshold: number; mult: number }
}

/**
 * Calcule un coup unique contre un ennemi.
 * Les dégâts sont répartis par type, puis réduits :
 * - la Pénétration ampute l'armure et les résistances positives de l'ennemi,
 * - l'armure réduit la part Physique,
 * - les résistances de l'ennemi réduisent chaque type.
 */
export function rollHit(derived: DerivedStats, profile: DamageProfile, enemy: Enemy, opts: HitOpts = {}): HitResult {
  const crit = Math.random() < derived.critChance
  const critMult = crit ? derived.critMult : 1
  let raw = derived.power * derived.masteryMult * derived.versatilityMult * derived.overpower * critMult * (opts.bonusMult ?? 1)
  if (opts.execute && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= opts.execute.threshold) raw *= opts.execute.mult

  const pen = derived.penetration
  const armorMit = armorMitigation(enemy.armor * (1 - pen), derived.power)
  let total = 0
  for (const t in profile.profile) {
    const type = t as DamageType
    const frac = profile.profile[type] ?? 0
    if (frac <= 0) continue
    let typed = raw * frac * (1 + (profile.bonus[type] ?? 0))
    if (type === 'physique') typed *= 1 - armorMit
    let res = enemy.resist[type] ?? 0
    if (res > 0) res *= 1 - pen // la pénétration n'aide pas contre les vulnérabilités
    typed *= 1 - res
    total += typed
  }

  const damage = Math.max(1, Math.round(total))
  const heal = Math.round(damage * derived.leech)
  return { damage, crit, heal }
}

/** DPS théorique (affichage) : inclut le bonus de type, ignore armure/résistances. */
export function theoreticalDps(derived: DerivedStats, profile: DamageProfile, bonusMult = 1): number {
  const avgCrit = 1 + derived.critChance * (derived.critMult - 1)
  let typeMult = 0
  for (const t in profile.profile) {
    const type = t as DamageType
    typeMult += (profile.profile[type] ?? 0) * (1 + (profile.bonus[type] ?? 0))
  }
  if (typeMult === 0) typeMult = 1
  const multistrikeMult = 1 + derived.multistrike
  return derived.power * derived.masteryMult * derived.versatilityMult * derived.overpower * avgCrit * derived.attacksPerSecond * typeMult * multistrikeMult * bonusMult
}

/**
 * Dégâts subis par le joueur (par seconde) après réduction par :
 * la résistance du héros au type d'attaque, l'esquive, la réduction plate et la Polyvalence.
 */
export function incomingDps(
  enemyDamage: number,
  enemyType: DamageType,
  derived: DerivedStats,
  heroResist: Partial<Record<DamageType, number>>,
): number {
  let dmg = enemyDamage * (1 - (heroResist[enemyType] ?? 0))
  dmg *= 1 - derived.dodge
  dmg *= 1 - derived.flatDr
  dmg /= derived.versatilityMult
  return Math.max(0.5, dmg)
}
