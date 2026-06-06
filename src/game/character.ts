import type { Character, StatBlock, StatKey, PrimaryStat, PowerDef } from './types'
import { computeTotalStats, computeDerived, type DerivedStats } from './stats'
import { computeDamageProfile, type DamageProfile } from './damage'
import { getPower, powersUnlockedAt, POWER_SLOTS } from './powers'
import { talentStatMods, talentUnlockedPowers } from './talents'

export const STARTING_BASE: StatBlock = { force: 5, agilite: 5, intelligence: 5, endurance: 10 }

let charSeq = 1

/** Crée un personnage à un niveau donné (stats de base simulées pour ce niveau). */
export function makeCharacter(name: string, level: number, bias: PrimaryStat): Character {
  const base: StatBlock = { ...STARTING_BASE }
  base[bias] = (base[bias] ?? 0) + 2 * (level - 1)
  base.endurance = (base.endurance ?? 0) + 1 * (level - 1)

  const unlocked = powersUnlockedAt(level).map((p) => p.id)
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
    unlockedPowers: unlocked,
    talentPoints: Math.max(0, level - 1),
    talents: {},
    primaryBias: bias,
    hp: 0,
  }
  c.hp = charMaxHp(c)
  return c
}

/** Capacités débloquées = celles du niveau + celles des talents. */
export function computeUnlockedPowers(level: number, talents: Record<string, number>): string[] {
  const set = new Set<string>(powersUnlockedAt(level).map((p) => p.id))
  for (const id of talentUnlockedPowers(talents)) set.add(id)
  return [...set]
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

/** Stats totales d'un perso : base + talents + mods de capacités passives + équipement. */
export function charTotalStats(char: Character): StatBlock {
  const { mods } = charPassives(char)
  const talentMods = talentStatMods(char.talents ?? {})
  const base: StatBlock = { ...char.base }
  for (const k in mods) base[k as StatKey] = (base[k as StatKey] ?? 0) + (mods[k as StatKey] ?? 0)
  for (const k in talentMods) base[k as StatKey] = (base[k as StatKey] ?? 0) + (talentMods[k as StatKey] ?? 0)
  return computeTotalStats(base, char.equipment)
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
    attacksPerSecond: d.attacksPerSecond * GLOBAL.attackSpeed,
    hp: d.hp * GLOBAL.vitality,
  }
}

export function charMaxHp(char: Character): number {
  return charDerived(char).hp
}

export function charDamageProfile(char: Character): DamageProfile {
  return computeDamageProfile(char.equipment)
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
