/**
 * COMBAT — résolution d'un coup (`rollHit`), mitigation (armure), dégâts subis (`incomingDps`),
 * DPS théorique affiché (`theoreticalDps`). Ordre d'un coup : esquive → crit → bruts → armure
 * (Physique) → résist par type. L'atténuation générique est BORNÉE (`EFFECTIVE_DR_CAP = 0.8`).
 *   → Doc : docs/systemes/01-combat-et-degats.md
 */
import type { DerivedStats } from './stats'
import type { DamageType, Enemy } from './types'
import type { DamageProfile } from './damage'
import { resistMult } from './resist'

/** Réduction de dégâts par l'armure (courbe à rendement décroissant). */
export function armorMitigation(armor: number, attackerPower: number): number {
  const k = 50 + attackerPower
  return armor / (armor + k)
}

export interface HitResult {
  damage: number
  crit: boolean
  heal: number
  /** Coup esquivé par l'ennemi (Précision insuffisante). */
  miss?: boolean
}

export interface HitOpts {
  /** Multiplicateur de dégâts supplémentaire (keystones : damageMult, lowHpBonus…). */
  bonusMult?: number
  /** Exécution : ×mult si les PV de l'ennemi sont sous threshold. */
  execute?: { threshold: number; mult: number }
  /** 🎼 Métronome : critique GARANTI sur ce coup (ignore l'esquive ennemie aussi). */
  forceCrit?: boolean
  /** 🎻 Ostinato (v0.26) : chance de critique ADDITIONNELLE sur ce coup (fraction). */
  bonusCrit?: number
}

/**
 * Calcule un coup unique contre un ennemi.
 * Les dégâts sont répartis par type, puis réduits :
 * - la Pénétration ampute l'armure et les résistances positives de l'ennemi,
 * - l'armure réduit la part Physique,
 * - les résistances de l'ennemi réduisent chaque type.
 */
export function rollHit(derived: DerivedStats, profile: DamageProfile, enemy: Enemy, opts: HitOpts = {}): HitResult {
  // Esquive ennemie (annulée par la Précision) : le coup peut être totalement manqué.
  const effDodge = Math.max(0, (enemy.dodge ?? 0) - derived.precision)
  if (!opts.forceCrit && effDodge > 0 && Math.random() < effDodge) return { damage: 0, crit: false, heal: 0, miss: true }

  const crit = opts.forceCrit || Math.random() < Math.min(0.98, derived.critChance + (opts.bonusCrit ?? 0))
  const critMult = crit ? derived.critMult : 1
  let raw = derived.power * derived.masteryMult * derived.overpower * critMult * (opts.bonusMult ?? 1)
  // Dégâts vs Boss : bonus contre boss & élites uniquement.
  if ((enemy.boss || enemy.elite) && derived.bossDamageMult > 1) raw *= derived.bossDamageMult
  if (opts.execute && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= opts.execute.threshold) raw *= opts.execute.mult

  const pen = derived.penetration
  // 🥁 Tambour de siège (v0.26) : la Brèche ampute l'armure de l'ennemi.
  const sunder = enemy.sunder && enemy.sunder.remaining > 0 ? enemy.sunder.pct : 0
  const armorMit = armorMitigation(enemy.armor * (1 - pen) * (1 - sunder), derived.power)
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

/**
 * v0.37 « Piste C » — réduction des dégâts d'un SORT par la RÉSISTANCE de type de l'ennemi.
 * Symétrique de rollHit côté résist : la Pénétration ampute la résist positive ; une vulnérabilité
 * (résist < 0) amplifie (la Pénétration n'y change rien). L'ARMURE n'entre PAS ici (elle reste une
 * défense d'auto-attaque physique) → les sorts physiques ne sont pas nerfés par l'armure.
 * Aujourd'hui la résist ennemie est UNIFORME par type : c'est donc une atténuation égale sur tous les
 * éléments, que la Pénétration contre (les casters cessent d'ignorer la résist comme avant v0.37).
 */
export function spellResistMult(enemy: Enemy, type: DamageType, penetration: number): number {
  let res = enemy.resist?.[type] ?? 0
  if (res > 0) res *= 1 - penetration
  return Math.max(0, 1 - res)
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
  return derived.power * derived.masteryMult * derived.overpower * avgCrit * derived.attacksPerSecond * typeMult * multistrikeMult * bonusMult
}

/**
 * Plafond d'atténuation GÉNÉRIQUE (hors résistances de type) : le joueur encaisse
 * toujours au moins (1 − cap) des dégâts génériques. Empêche l'invincibilité par
 * empilement d'esquive / réduction / maîtrise → il faut survivre, pas juste tanker.
 * Les RÉSISTANCES de type (v0.24, modèle relatif — resist.ts) n'atténuent plus en % :
 * elles annulent le MULTIPLICATEUR d'exigence des attaques typées (×1 au cap → ×5 à nu).
 */
export const EFFECTIVE_DR_CAP = 0.8

/**
 * Multiplicateur d'atténuation générique (toutes sources hors résistance de type),
 * borné par EFFECTIVE_DR_CAP. `extraMitigation` = produit des réductions externes
 * (capacités passives, keystones) déjà sous forme (1 − x).
 */
export function genericMitigation(derived: DerivedStats, extraMitigation = 1): number {
  // v0.38 — Esquive retirée : ne reste que Réduction × Maîtrise-DR (Force). « Surcharge » de l'Int
  // (damageTakenMult) AUGMENTE les dégâts subis → appliquée ici (peut dépasser 1 = glass cannon).
  const g = (1 - derived.flatDr) * (1 - derived.masteryDr) * extraMitigation
  return Math.max(g, 1 - EFFECTIVE_DR_CAP) * derived.damageTakenMult
}

/**
 * Dégâts subis par le joueur (par seconde) :
 * - le MULTIPLICATEUR d'exigence du type s'applique d'abord (v0.24 : résist du héros en points
 *   vs `req` de l'ennemi — ×1 au cap, jusqu'à ×5 à zéro résist, voir resist.ts) ;
 * - puis l'atténuation générique, BORNÉE (esquive/réduction/maîtrise + externes).
 */
export function incomingDps(
  enemyDamage: number,
  enemyType: DamageType,
  derived: DerivedStats,
  heroResist: Partial<Record<DamageType, number>>,
  req = 0,
  extraMitigation = 1,
  reqReduction = 0,
): number {
  const afterResist = enemyDamage * resistMult(req, heroResist[enemyType] ?? 0, reqReduction)
  return Math.max(0.5, afterResist * genericMitigation(derived, extraMitigation))
}
