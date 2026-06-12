import type { Character, StatBlock, StatKey, PrimaryStat, OffensiveStat, PowerDef, DamageType, Item, EquipSlotId } from './types'
import { computeTotalStats, computeDerived, type DerivedStats } from './stats'
import { computeDamageProfile, computeResistProfile, profileDamageMult, type DamageProfile } from './damage'
import { DAMAGE_TYPE_LIST } from './damage'
import { setBonuses } from './sets'
import { getPower, POWER_SLOTS } from './powers'
import { theoreticalDps, genericMitigation } from './combat'
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
  // Bonus de SET (Régalia du Néant…) : PV, recharge et vol de vie passent par le moteur dérivé
  // (le multiplicateur de dégâts de set passe par charCombatMods, comme les keystones).
  const sb = setBonuses(char.equipment)
  return {
    ...d,
    power: d.power * GLOBAL.power,
    forcePower: d.forcePower * GLOBAL.power,
    agiPower: d.agiPower * GLOBAL.power,
    intPower: d.intPower * GLOBAL.power,
    endurancePower: d.endurancePower * GLOBAL.power,
    attacksPerSecond: d.attacksPerSecond * GLOBAL.attackSpeed,
    hp: d.hp * GLOBAL.vitality * sb.hpMult,
    cdr: Math.min(0.75, d.cdr + sb.cdr),
    leech: Math.min(0.6, d.leech + sb.leech),
  }
}

export function charMaxHp(char: Character): number {
  return charDerived(char).hp
}

/**
 * PV EFFECTIFS (« tankiness ») : PV max ÷ atténuation générique (esquive, réduction de dégâts,
 * maîtrise Force, passives, keystones). La Barrière est déjà dans les PV max. HORS résistances
 * de type (relatives à l'exigence de CHAQUE ennemi — pas comparables dans l'absolu) et régén.
 * C'est LA métrique de survie comparable entre deux pièces → affichée sur les objets (Δ Survie).
 */
export function charEhp(char: Character): number {
  const d = charDerived(char)
  const { damageReduction } = charPassives(char)
  const extra = (1 - damageReduction) * (1 - charCombatMods(char).flatDr)
  return d.hp / genericMitigation(d, extra)
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
  // Multiplicateur de dégâts PERSISTANT issu des keystones (Carnage, Titan…) + bonus de SET :
  // appliqué en combat aux auto-attaques ET aux sorts → il doit l'être ici aussi.
  const dmgMult = charCombatMods(char).damageMult
  let dps = theoreticalDps(derived, profile, dmgMult)
  for (const pid of char.powers) {
    if (!pid) continue
    const p = getPower(pid)
    if (p) dps += abilityDps(p, derived, pm, dmgMult)
  }
  return dps
}

/**
 * DÉTAIL du DPS affiché — exact PAR CONSTRUCTION : il appelle les mêmes fonctions que charDps
 * (theoreticalDps + abilityDps), il ne peut donc pas diverger. Sert la transparence : « pourquoi
 * cette pièce monte/baisse mon DPS ? » a toujours une réponse lisible ici.
 * Le DPS de fiche est HORS CIBLE : armure, résistances/vulnérabilités, pénétration, dégâts vs boss
 * et bonus conditionnels (PV bas/hauts, exécution, Maîtrise des Zones) s'appliquent en combat réel.
 */
export interface DpsBreakdown {
  total: number
  auto: number
  spells: { name: string; dps: number }[]
  /** Facteurs multiplicatifs de l'auto-attaque (le produit × puissance × vitesse = auto). */
  factors: { label: string; value: string }[]
  /** Le build convertit des stats (Endurance→offense…) : une pièce défensive PEUT monter le DPS. */
  hasConversions: boolean
}

export function dpsBreakdown(char: Character): DpsBreakdown {
  const derived = charDerived(char)
  const profile = charDamageProfile(char)
  const pm = profileDamageMult(profile)
  const dmgMult = charCombatMods(char).damageMult
  const auto = theoreticalDps(derived, profile, dmgMult)
  const spells: { name: string; dps: number }[] = []
  for (const pid of char.powers) {
    if (!pid) continue
    const p = getPower(pid)
    if (!p || p.kind !== 'active') continue
    const d = abilityDps(p, derived, pm, dmgMult)
    if (d > 0) spells.push({ name: p.name, dps: d })
  }
  const avgCrit = 1 + derived.critChance * (derived.critMult - 1)
  const factors = [
    { label: 'Puissance', value: Math.round(derived.power).toLocaleString('fr-FR') },
    { label: 'Vitesse', value: `${derived.attacksPerSecond.toFixed(2)} att/s` },
    { label: 'Maîtrise', value: `×${derived.masteryMult.toFixed(2)}` },
    { label: 'Surpuissance', value: `×${derived.overpower.toFixed(2)}` },
    { label: 'Critique moyen', value: `×${avgCrit.toFixed(2)}` },
    { label: 'Profil de dégâts', value: `×${pm.toFixed(2)}` },
    { label: 'Multifrappe', value: `×${(1 + derived.multistrike).toFixed(2)}` },
    { label: 'Talents & sets', value: `×${dmgMult.toFixed(2)}` },
  ]
  const hasConversions = charKeystones(char).some((k) => k.statAsOther || k.enduranceAs)
  return { total: auto + spells.reduce((a, s) => a + s.dps, 0), auto, spells, factors, hasConversions }
}

/** Résistances du héros en POINTS (équipement + talents + sets) — non plafonnées (v0.24). */
export function charResist(char: Character): Partial<Record<DamageType, number>> {
  const r = computeResistProfile(char.equipment, talentResistMods(char.talents ?? {}))
  const sb = setBonuses(char.equipment)
  if (sb.resistAll > 0) {
    for (const t of DAMAGE_TYPE_LIST) r[t] = (r[t] ?? 0) + sb.resistAll * 100
  }
  return r
}

/** Impact RÉEL d'un équipement : variation de DPS, de PV et de SURVIE (PV effectifs) si on pose
 *  `item` dans `slot`. Simulation par swap (toute la chaîne : profil de dégâts, conversions, sets…)
 *  — c'est LA métrique d'arbitrage du joueur, bien plus parlante qu'un score de stats. */
export interface EquipDelta { dps: number; hp: number; ehp: number }
export function equipDelta(char: Character, item: Item, slot: EquipSlotId): EquipDelta {
  const after: Character = { ...char, equipment: { ...char.equipment, [slot]: item } }
  return {
    dps: charDps(after) - charDps(char),
    hp: charMaxHp(after) - charMaxHp(char),
    ehp: charEhp(after) - charEhp(char),
  }
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
  // --- v0.24 : effets des nouveaux archétypes (voir talents.ts / DESIGN §3.4-3.5) ---
  /** Oracle sanglant : fraction des soins de sorts aussi infligée en dégâts (somme). */
  healToDamage: number
  /** Briseur : éclaboussure des auto-attaques sur le pack (somme, capée 0.8). */
  cleaveAuto: number
  /** Briseur : +frac dégâts par ennemi vivant au-delà du premier (somme). */
  perEnemyBonus: number
  /** Faucheur : les DoT infligés te soignent (somme). */
  dotLeech: number
  /** Pestiféré : propagation du DoT au pack (max). */
  dotAoe: number
  /** Chronomancien : multiplicateur des dégâts de sorts (produit). */
  spellMult: number
  /** Chronomancien : secondes de recharge rendues aux autres sorts par cast (somme). */
  cdrOnCast: number
  /** Égide (Acclimatation) : réduction des exigences de résistance (somme, capée 0.5). */
  reqReduction: number
  /** Égide : surplus de résist → dégâts (somme = bonus max). */
  surplusToDamage: number
  /** Égide : part de ta résist partagée aux alliés (max). */
  shareResist: number
  /** Égide : surplus de résist → régén (somme = fraction PV/s max). */
  surplusRegen: number
  /** Assassin : fenêtre d'ouverture (mult produit, durée max). */
  opener?: { mult: number; seconds: number }
  /** Foudreur : arcs (frac somme capée 0.8, targets max). */
  chainArc?: { frac: number; targets: number }
  /** Foudreur : décharge statique (on garde la plus rapide). */
  staticN?: { every: number; mult: number }
  /** Égide : résist adaptative (gain somme, cap max). */
  adaptiveResist?: { gain: number; cap: number }
  /** Purgateur : carburant d'affliction (per somme, cap max). */
  afflictionFuel?: { per: number; cap: number }
}

export function charCombatMods(char: Character): CombatMods {
  const out: CombatMods = {
    damageMult: 1, flatDr: 0, hot: 0, thorns: 0, multistrike: 0,
    healToDamage: 0, cleaveAuto: 0, perEnemyBonus: 0, dotLeech: 0, dotAoe: 0,
    spellMult: 1, cdrOnCast: 0, reqReduction: 0, surplusToDamage: 0, shareResist: 0, surplusRegen: 0,
  }
  // Multiplicateur de dégâts des bonus de SET (s'applique aux auto-attaques ET aux sorts,
  // et donc au DPS affiché via charDps — même chemin que les keystones).
  out.damageMult *= setBonuses(char.equipment).damageMult
  let multiType: { per: number; threshold: number } | undefined
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
    // --- v0.24 ---
    if (k.healToDamage) out.healToDamage += k.healToDamage
    if (k.cleaveAuto) out.cleaveAuto = Math.min(0.8, out.cleaveAuto + k.cleaveAuto)
    if (k.perEnemyBonus) out.perEnemyBonus += k.perEnemyBonus
    if (k.dotLeech) out.dotLeech += k.dotLeech
    if (k.dotAoe) out.dotAoe = Math.max(out.dotAoe, k.dotAoe)
    if (k.spellMult) out.spellMult *= k.spellMult
    if (k.cdrOnCast) out.cdrOnCast += k.cdrOnCast
    if (k.reqReduction) out.reqReduction = Math.min(0.5, out.reqReduction + k.reqReduction)
    if (k.surplusToDamage) out.surplusToDamage += k.surplusToDamage
    if (k.shareResist) out.shareResist = Math.max(out.shareResist, k.shareResist)
    if (k.surplusRegen) out.surplusRegen += k.surplusRegen
    if (k.openerBonus) {
      out.opener = out.opener
        ? { mult: out.opener.mult * k.openerBonus.mult, seconds: Math.max(out.opener.seconds, k.openerBonus.seconds) }
        : { ...k.openerBonus }
    }
    if (k.chainArc) {
      out.chainArc = out.chainArc
        ? { frac: Math.min(0.8, out.chainArc.frac + k.chainArc.frac), targets: Math.max(out.chainArc.targets, k.chainArc.targets) }
        : { ...k.chainArc }
    }
    if (k.staticN) {
      if (!out.staticN || k.staticN.every < out.staticN.every) out.staticN = { ...k.staticN }
    }
    if (k.adaptiveResist) {
      out.adaptiveResist = out.adaptiveResist
        ? { gain: out.adaptiveResist.gain + k.adaptiveResist.gain, cap: Math.max(out.adaptiveResist.cap, k.adaptiveResist.cap) }
        : { ...k.adaptiveResist }
    }
    if (k.afflictionFuel) {
      out.afflictionFuel = out.afflictionFuel
        ? { per: out.afflictionFuel.per + k.afflictionFuel.per, cap: Math.max(out.afflictionFuel.cap, k.afflictionFuel.cap) }
        : { ...k.afflictionFuel }
    }
    if (k.multiTypeBonus) {
      multiType = multiType
        ? { per: multiType.per + k.multiTypeBonus.per, threshold: Math.min(multiType.threshold, k.multiTypeBonus.threshold) }
        : { ...k.multiTypeBonus }
    }
  }
  // Élémentaliste « Réaction élémentaire » : +per de dégâts par type ≥ threshold du profil
  // (au-delà du premier) — replié dans damageMult (affiché dans « Talents & sets »).
  if (multiType) {
    const profile = charDamageProfile(char).profile
    let count = 0
    for (const t in profile) if ((profile[t as DamageType] ?? 0) >= multiType.threshold) count++
    if (count > 1) out.damageMult *= 1 + multiType.per * (count - 1)
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
