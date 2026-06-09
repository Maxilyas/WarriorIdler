import type { Character, StatBlock, StatKey, PrimaryStat, OffensiveStat, PowerDef, DamageType } from './types'
import { computeTotalStats, computeDerived, type DerivedStats } from './stats'
import { computeDamageProfile, computeResistProfile, profileDamageMult, type DamageProfile } from './damage'
import { getPower, POWER_SLOTS } from './powers'
import { theoreticalDps } from './combat'
import {
  talentStatMods, talentResistMods, talentUnlockedPowers, talentKeystones, type KeystoneEffect,
} from './talents'

export const STARTING_BASE: StatBlock = { force: 5, agilite: 5, intelligence: 5, endurance: 10 }

/**
 * Niveau à partir duquel un personnage commence à gagner des points de talent.
 * Les 10 premiers niveaux servent à se familiariser avec le combat/le stuff
 * (l'arbre de talents reste caché tant qu'aucun point n'est disponible).
 */
export const TALENT_START_LEVEL = 10

/** Points de talent accumulés à un niveau donné (1 par niveau au-delà de TALENT_START_LEVEL). */
export function talentPointsForLevel(level: number): number {
  return Math.max(0, level - TALENT_START_LEVEL)
}

let charSeq = 1

/** Crée un personnage à un niveau donné (stats de base simulées pour ce niveau). */
export function makeCharacter(name: string, level: number, bias: PrimaryStat): Character {
  const base: StatBlock = { ...STARTING_BASE }
  // Gain par niveau VOLONTAIREMENT faible : la puissance vient du STUFF, pas du niveau seul
  // (on doit s'équiper soigneusement pour passer les paliers).
  base[bias] = (base[bias] ?? 0) + 1 * (level - 1)
  base.endurance = (base.endurance ?? 0) + 1 * (level - 1)

  // Le nœud racine « Éveil » est alloué d'office (débloque Frappe + stats de départ).
  const talents: Record<string, number> = { co_start: 1 }
  const unlocked = computeUnlockedPowers(talents)
  const powers: (string | null)[] = Array(POWER_SLOTS).fill(null)
  unlocked.slice(0, POWER_SLOTS).forEach((id, i) => (powers[i] = id))

  const c: Character = {
    id: `char-${charSeq++}`,
    name,
    level,
    xp: 0,
    base,
    equipment: {},
    powers,
    powerAuto: Array(POWER_SLOTS).fill(true),
    unlockedPowers: unlocked,
    talentPoints: talentPointsForLevel(level),
    talents,
    primaryBias: bias,
    hp: 0,
  }
  c.hp = charMaxHp(c)
  return c
}

/** Capacités débloquées = celles des nœuds `ability` alloués dans l'arbre. */
export function computeUnlockedPowers(talents: Record<string, number>): string[] {
  return [...new Set(talentUnlockedPowers(talents))]
}

/** Agrège les effets des capacités PASSIVES équipées. */
export function charPassives(char: Character): { threatMult: number; damageReduction: number; mods: StatBlock } {
  let threatMult = 1
  let damageReduction = 0
  const mods: StatBlock = {}
  for (const pid of char.powers) {
    if (!pid) continue
    const p = getPower(pid)
    if (!p || p.kind !== 'passive') continue
    if (p.threatMult) threatMult *= p.threatMult
    if (p.damageReduction) damageReduction = 1 - (1 - damageReduction) * (1 - p.damageReduction)
    if (p.mods) for (const k in p.mods) mods[k as StatKey] = (mods[k as StatKey] ?? 0) + (p.mods[k as StatKey] ?? 0)
  }
  return { threatMult, damageReduction, mods }
}

/** Keystones alloués dans l'arbre de ce perso. */
export function charKeystones(char: Character): KeystoneEffect[] {
  return talentKeystones(char.talents ?? {})
}

/** Applique les conversions de stat (« la Force compte comme Agi », « Endurance comme Force »…). */
function applyStatConversions(total: StatBlock, keystones: KeystoneEffect[]): StatBlock {
  const out = { ...total }
  for (const k of keystones) {
    if (k.statAsOther) {
      const from = total[k.statAsOther.from] ?? 0 // basé sur la valeur d'origine (pas de double-dip)
      out[k.statAsOther.to] = (out[k.statAsOther.to] ?? 0) + Math.round(from * k.statAsOther.frac)
    }
    if (k.enduranceAs) {
      const end = total.endurance ?? 0
      out[k.enduranceAs.to] = (out[k.enduranceAs.to] ?? 0) + Math.round(end * k.enduranceAs.frac)
    }
  }
  return out
}

/** Stats totales : base + talents + mods de capacités passives + équipement, puis conversions. */
export function charTotalStats(char: Character): StatBlock {
  const { mods } = charPassives(char)
  const talentMods = talentStatMods(char.talents ?? {})
  const base: StatBlock = { ...char.base }
  for (const k in mods) base[k as StatKey] = (base[k as StatKey] ?? 0) + (mods[k as StatKey] ?? 0)
  for (const k in talentMods) base[k as StatKey] = (base[k as StatKey] ?? 0) + (talentMods[k as StatKey] ?? 0)
  const total = computeTotalStats(base, char.equipment)
  return applyStatConversions(total, charKeystones(char))
}

// Multiplicateurs globaux issus des améliorations marchand (mis à jour par le store).
let GLOBAL = { power: 1, attackSpeed: 1, vitality: 1 }
export function setGlobalCombatMods(m: { power: number; attackSpeed: number; vitality: number }) {
  GLOBAL = m
}

export function charDerived(char: Character): DerivedStats {
  const d = computeDerived(charTotalStats(char))
  return {
    ...d,
    power: d.power * GLOBAL.power,
    forcePower: d.forcePower * GLOBAL.power,
    agiPower: d.agiPower * GLOBAL.power,
    intPower: d.intPower * GLOBAL.power,
    endurancePower: d.endurancePower * GLOBAL.power,
    attacksPerSecond: d.attacksPerSecond * GLOBAL.attackSpeed,
    hp: d.hp * GLOBAL.vitality,
  }
}

export function charMaxHp(char: Character): number {
  return charDerived(char).hp
}

/**
 * Puissance d'une capacité selon sa stat de scaling.
 * - stat unique → la puissance de cette stat.
 * - liste de stats → la MEILLEURE d'entre elles (build Force OU Agilité, etc.).
 * - rien → la STAT DOMINANTE (`d.power`) → utilitaire ouvert à tous les builds.
 */
export function abilityPower(d: DerivedStats, scale?: OffensiveStat | OffensiveStat[]): number {
  if (Array.isArray(scale)) {
    let best = 0
    for (const s of scale) best = Math.max(best, abilityPower(d, s))
    return best || d.power
  }
  if (scale === 'force') return d.forcePower
  if (scale === 'agilite') return d.agiPower
  if (scale === 'intelligence') return d.intPower
  return d.power
}

/** Stat(s) de scaling effectives d'une capacité (multi prioritaire sur simple). */
export function powerScale(p: PowerDef): OffensiveStat | OffensiveStat[] | undefined {
  return p.scaleStats ?? p.scaleStat
}

export function charDamageProfile(char: Character): DamageProfile {
  return computeDamageProfile(char.equipment, charKeystones(char))
}

/** DPS d'un sort actif (mêmes règles qu'en combat : dégâts directs/DoT, scalent sur le profil + keystones). */
function abilityDps(p: PowerDef, derived: DerivedStats, profileMult: number, dmgMult: number): number {
  if (p.kind !== 'active' || !p.effect) return 0
  const value = (p.magnitude ?? 0) * abilityPower(derived, powerScale(p)) * profileMult * dmgMult
  const cd = Math.max(0.5, (p.cooldown ?? 3) * (1 - derived.cdr))
  switch (p.effect) {
    case 'nuke': case 'cleave': case 'megaCleave': case 'lifeNuke': return value / cd
    case 'executeNuke': return (value * 1.8) / cd // bonus moyen selon les PV manquants de la cible
    case 'dot': return value * 0.4 * derived.alterationMult // DoT soutenu
    case 'rupture': return (value * 0.5 + value * 0.5 * derived.alterationMult * (p.duration ?? 8)) / cd
    default: return 0 // soins / boucliers / buffs / charge / marque : pas un DPS direct
  }
}

/** DPS total estimé d'un perso : auto-attaque + CAPACITÉS actives équipées (pour l'affichage). */
export function charDps(char: Character): number {
  const derived = charDerived(char)
  const profile = charDamageProfile(char)
  const pm = profileDamageMult(profile)
  // Multiplicateur de dégâts PERSISTANT issu des keystones (Carnage, Titan…) : appliqué en combat
  // aux auto-attaques ET aux sorts → il doit l'être ici aussi, sinon le DPS affiché sous-estime.
  const dmgMult = charCombatMods(char).damageMult
  let dps = theoreticalDps(derived, profile, dmgMult)
  for (const pid of char.powers) {
    if (!pid) continue
    const p = getPower(pid)
    if (p) dps += abilityDps(p, derived, pm, dmgMult)
  }
  return dps
}

/** Résistances du héros (équipement + talents), capées. */
export function charResist(char: Character): Partial<Record<DamageType, number>> {
  return computeResistProfile(char.equipment, talentResistMods(char.talents ?? {}))
}

/** Modificateurs de combat agrégés issus des keystones. */
export interface CombatMods {
  damageMult: number
  flatDr: number
  hot: number
  thorns: number
  multistrike: number
  dot?: { frac: number; duration: number }
  execute?: { threshold: number; mult: number }
  lowHp?: { threshold: number; mult: number }
  highHp?: { threshold: number; mult: number }
}

export function charCombatMods(char: Character): CombatMods {
  const out: CombatMods = { damageMult: 1, flatDr: 0, hot: 0, thorns: 0, multistrike: 0 }
  for (const k of charKeystones(char)) {
    if (k.damageMult) out.damageMult *= k.damageMult
    if (k.flatDr) out.flatDr = 1 - (1 - out.flatDr) * (1 - k.flatDr)
    if (k.hot) out.hot += k.hot
    if (k.thorns) out.thorns += k.thorns
    if (k.multistrike) out.multistrike += k.multistrike
    if (k.dot) out.dot = k.dot // un seul DoT actif (le dernier alloué)
    if (k.executeBonus) out.execute = k.executeBonus
    if (k.lowHpBonus) out.lowHp = k.lowHpBonus
    if (k.highHpBonus) out.highHp = k.highHpBonus
  }
  return out
}

/** Capacités ACTIVES équipées (auto-cast en combat). */
export function charActives(char: Character): PowerDef[] {
  const out: PowerDef[] = []
  for (const pid of char.powers) {
    if (!pid) continue
    const p = getPower(pid)
    if (p && p.kind === 'active') out.push(p)
  }
  return out
}

export function isAlive(char: Character): boolean {
  return char.hp > 0
}
