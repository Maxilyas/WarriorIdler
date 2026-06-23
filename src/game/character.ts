/**
 * PERSONNAGE — assemble un `Character` (base + équipement + talents) en stats dérivées, profil de
 * dégâts, decks de capacités, et DPS/EHP. `charDps`/`dpsBreakdown` sont EXACTS par construction
 * (mêmes fonctions que le combat réel). Budget de talents PARTAGÉ au niveau de compte
 * (`teamTalentPool`) ; l'arbre s'ouvre au niveau 11 (`TALENT_START_LEVEL`).
 *   → Doc : docs/systemes/06-classes-talents-pouvoirs.md + docs/systemes/10-etat-store-et-sauvegarde.md
 */
import type { Character, StatBlock, StatKey, PrimaryStat, OffensiveStat, PowerDef, PowerEffect, PassiveConversion, DamageType, Item, EquipSlotId } from './types'
import { computeTotalStats, computeDerived, type DerivedStats } from './stats'
import { computeDamageProfile, computeResistProfile, profileDamageMult, type DamageProfile } from './damage'
import { DAMAGE_TYPE_LIST } from './damage'
import { setBonuses } from './sets'
import { instanceTagMods } from './uniques'
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

/** 3 emplacements RÉSERVÉS aux capacités PASSIVES (distincts des 5 slots actifs). */
export const PASSIVE_SLOTS = 3

/** 3 emplacements de SOUTIEN (ex-Générateurs), auto-cast pur. Accueillent les builders ET
 *  les sorts de soutien (boucliers/soins/buffs) à lancer en fond, sans les timer (fire-and-forget). */
export const SUPPORT_SLOTS = 3

/** Un sort est-il un GÉNÉRATEUR (builder) → auto-cast pur, REFUSÉ des actifs (aucun sens en manuel). */
export function isBuilder(p: PowerDef | undefined): boolean {
  return p?.kind === 'active' && p.effect === 'builder'
}

/** Effets de SOUTIEN éligibles à la lane Soutien (en plus des builders) : boucliers, soins, buffs. */
const SUPPORT_EFFECTS: ReadonlySet<PowerEffect> = new Set<PowerEffect>([
  'shield', 'bigShield', 'invuln', 'avatar', 'heal', 'hot', 'buffParty', 'bigHeal',
])

/** Un sort peut-il aller dans la lane SOUTIEN ? builder OU sort de soutien. MULTI-LANE : les
 *  boucliers/soins restent AUSSI équipables en ACTIF (pour un déclenchement manuel) — l'unicité tranche. */
export function isSupport(p: PowerDef | undefined): boolean {
  if (!p || p.kind !== 'active') return false
  return p.effect === 'builder' || (!!p.effect && SUPPORT_EFFECTS.has(p.effect))
}

/** Points de talent accumulés à un niveau donné (1 par niveau au-delà de TALENT_START_LEVEL). */
export function talentPointsForLevel(level: number): number {
  return Math.max(0, level - TALENT_START_LEVEL)
}

/** Total dépensé dans l'arbre de DÉPART d'un perso (hors racine gratuite co_start). */
export function talentsSpent(c: Character): number {
  return Object.values(c.talents).reduce((a, b) => a + b, 0) - (c.talents.co_start ?? 0)
}

/**
 * POOL DE TALENTS PARTAGÉ (niveau de COMPTE). Points gagnés au niveau de compte (le plus haut
 * des persos, qui restent synchronisés) + bonus d'amélioration, MOINS le total dépensé sur TOUS les
 * arbres. Une recrue (arbre vide) n'ajoute rien → zéro inflation ; développer 2 arbres SPLITTE le même
 * budget (« budget partagé » = frein au multi-perso, la dynamique reine). Dérivé → aucune désync possible.
 */
export function teamTalentPool(chars: Character[], bonus = 0): number {
  if (!chars.length) return 0
  const level = chars.reduce((m, c) => Math.max(m, c.level), 1)
  const spent = chars.reduce((a, c) => a + talentsSpent(c), 0)
  return Math.max(0, talentPointsForLevel(level) + bonus - spent)
}

/** Identifiant de personnage UNIQUE et stable, jamais réutilisé — y compris après un reload.
 *  (Un compteur module-level se réinitialisait au chargement et entrait en collision avec les
 *  persos déjà en sauvegarde : la prochaine recrue récupérait `char-1` et « partageait » alors
 *  son apparence/titre/cooldowns avec le héros existant.) */
function newCharId(): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `char-${rnd}`
}

/** Crée un personnage à un niveau donné (stats de base simulées pour ce niveau). */
export function makeCharacter(name: string, level: number, bias: PrimaryStat): Character {
  const base: StatBlock = { ...STARTING_BASE }
  // Gain par niveau VOLONTAIREMENT faible : la puissance vient du STUFF, pas du niveau seul
  // (on doit s'équiper soigneusement pour passer les vagues).
  base[bias] = (base[bias] ?? 0) + 1 * (level - 1)
  base.endurance = (base.endurance ?? 0) + 1 * (level - 1)

  // Le nœud racine « Éveil » est alloué d'office (débloque Frappe + stats de départ).
  const talents: Record<string, number> = { co_start: 1 }
  // racine du Panthéon (2e arbre) seedée d'office — ancrage gratuit (0 stat), rend les
  // classes avancées atteignables une fois débloquées par l'Éveil.
  const pantheon: Record<string, number> = { pa_start: 1 }
  const unlocked = computeUnlockedPowers({ ...talents, ...pantheon }, level)
  // on répartit les capacités débloquées entre ACTIFS (5), SOUTIEN (3) et PASSIFS (3).
  // Seuls les builders sont auto-rangés en SOUTIEN ; les boucliers/soins atterrissent en actif (le
  // joueur les déplace en Soutien s'il veut le fire-and-forget).
  const powers: (string | null)[] = Array(POWER_SLOTS).fill(null)
  const passives: (string | null)[] = Array(PASSIVE_SLOTS).fill(null)
  const support: (string | null)[] = Array(SUPPORT_SLOTS).fill(null)
  let ai = 0, pi = 0, gi = 0
  for (const id of unlocked) {
    const p = getPower(id)
    if (!p) continue
    if (p.kind === 'passive') { if (pi < PASSIVE_SLOTS) passives[pi++] = id }
    else if (isBuilder(p)) { if (gi < SUPPORT_SLOTS) support[gi++] = id }
    else if (ai < POWER_SLOTS) powers[ai++] = id
  }

  const c: Character = {
    id: newCharId(),
    name,
    level,
    xp: 0,
    base,
    equipment: {},
    powers,
    passives,
    support,
    powerAuto: Array(POWER_SLOTS).fill(true),
    unlockedPowers: unlocked,
    talentPoints: talentPointsForLevel(level),
    talents,
    pantheon,
    primaryBias: bias,
    hp: 0,
  }
  c.hp = charMaxHp(c)
  return c
}

/**
 * Capacités débloquées = nœuds `ability` alloués dans l'arbre. Plus AUCUN passif débloqué par
 * NIVEAU — les passifs utilitaires (slots) comme les capstones d'identité s'obtiennent DANS L'ARBRE.
 * (Le paramètre `level` est conservé pour la compat des appelants ; il n'est plus utilisé ici.)
 */
export function computeUnlockedPowers(talents: Record<string, number>, _level = 0): string[] {
  return talentUnlockedPowers(talents)
}

/** Allocations TOTALES d'un perso = arbre de base (`talents`) + Panthéon (`pantheon`).
 *  Les deux maps n'ont aucune clé en commun (racines/voies distinctes) → simple fusion. Tous les
 *  agrégateurs de talents (stats, résist, keystones, capacités) lisent cette vue unifiée. */
export function charAllocations(char: Character): Record<string, number> {
  const p = char.pantheon
  return p && Object.keys(p).length > 0 ? { ...char.talents, ...p } : (char.talents ?? {})
}

/** Agrège les effets des capacités PASSIVES équipées (menace, réduction, mods, conversions). */
export function charPassives(char: Character): { threatMult: number; damageReduction: number; mods: StatBlock; conversions: PassiveConversion[] } {
  const e = cacheFor(char)
  return (e.passivesOut ??= charPassivesUncached(char))
}
function charPassivesUncached(char: Character): { threatMult: number; damageReduction: number; mods: StatBlock; conversions: PassiveConversion[] } {
  let threatMult = 1
  let damageReduction = 0
  const mods: StatBlock = {}
  const conversions: PassiveConversion[] = []
  for (const pid of char.passives ?? []) {
    if (!pid) continue
    const p = getPower(pid)
    if (!p || p.kind !== 'passive') continue
    if (p.threatMult) threatMult *= p.threatMult
    if (p.damageReduction) damageReduction = 1 - (1 - damageReduction) * (1 - p.damageReduction)
    if (p.mods) for (const k in p.mods) mods[k as StatKey] = (mods[k as StatKey] ?? 0) + (p.mods[k as StatKey] ?? 0)
    if (p.convert) for (const cv of p.convert) conversions.push(cv)
  }
  return { threatMult, damageReduction, mods, conversions }
}

/** Keystones alloués dans l'arbre de ce perso (base + Panthéon). */
export function charKeystones(char: Character): KeystoneEffect[] {
  return talentKeystones(charAllocations(char))
}

/** Applique les conversions de stat : keystones (additif, verrouillés à l'arbre) PUIS passifs
 *  (transfert par défaut = sidegrade). Toutes lisent la valeur d'ORIGINE (`total`) → pas de double-dip. */
function applyStatConversions(total: StatBlock, keystones: KeystoneEffect[], conversions: PassiveConversion[] = []): StatBlock {
  const out = { ...total }
  // SÈVE ET ACIER : overcap — le Critique AU-DELÀ de 50 % (rating 2250) déborde en Altération.
  // Borné par construction : ne convertit QUE le surplus, et l'Altération reste soft-capée en aval.
  let critToAlt = 0
  for (const k of keystones) {
    if (k.statAsOther) {
      const from = total[k.statAsOther.from] ?? 0 // basé sur la valeur d'origine (pas de double-dip)
      out[k.statAsOther.to] = (out[k.statAsOther.to] ?? 0) + Math.round(from * k.statAsOther.frac)
    }
    if (k.enduranceAs) {
      const end = total.endurance ?? 0
      out[k.enduranceAs.to] = (out[k.enduranceAs.to] ?? 0) + Math.round(end * k.enduranceAs.frac)
    }
    if (k.critToAlteration) critToAlt += k.critToAlteration
  }
  if (critToAlt > 0) {
    const CRIT_50_RATING = 2250 // 0,05 + 2250/5000 = 50 % de chance de critique
    const surplus = Math.max(0, (total.critique ?? 0) - CRIT_50_RATING)
    out.alteration = (out.alteration ?? 0) + Math.round(surplus * critToAlt)
  }
  // CONVERSIONS de passifs. Source lue sur `total` (origine) ; transfert = retire de la source.
  // `healPower` (puissance de soin) = proxy Intelligence (le soin scale INT).
  for (const cv of conversions) {
    const src = cv.from === 'healPower' ? (total.intelligence ?? 0) : (total[cv.from] ?? 0)
    const moved = Math.round(src * cv.frac)
    if (moved <= 0) continue
    out[cv.to] = (out[cv.to] ?? 0) + moved
    if ((cv.mode ?? 'transfer') === 'transfer' && cv.from !== 'healPower') {
      out[cv.from] = Math.max(0, (out[cv.from] ?? 0) - moved)
    }
  }
  return out
}

/** Stats totales : base + talents + mods de capacités passives + équipement, puis conversions (keystones + passifs). */
export function charTotalStats(char: Character): StatBlock {
  const { mods, conversions } = charPassives(char)
  const talentMods = talentStatMods(charAllocations(char))
  const base: StatBlock = { ...char.base }
  for (const k in mods) base[k as StatKey] = (base[k as StatKey] ?? 0) + (mods[k as StatKey] ?? 0)
  for (const k in talentMods) base[k as StatKey] = (base[k as StatKey] ?? 0) + (talentMods[k as StatKey] ?? 0)
  const total = computeTotalStats(base, char.equipment)
  return applyStatConversions(total, charKeystones(char), conversions)
}

// --- Cache des stats dérivées par perso (perf) -------------------------------------------------
// charDerived/charDamageProfile/charPassives/charResist/charCombatMods sont des fonctions PURES de
// { char.base, char.equipment, char.talents, char.pantheon, char.passives } + les globals module
// GLOBAL/PACT/PRESTIGE_RESIST. En combat (5 Hz) le perso est RE-cloné chaque tick, mais ces cinq
// RÉFÉRENCES restent stables tant que le joueur ne change pas son build (équiper/sertir/forger/allouer
// produit toujours un NOUVEAU conteneur via applyItemPatch/{...c}). On mémoïse donc par char.id,
// invalidé si une de ces références OU l'epoch des globals change.
//   `statsEpoch` ne bouge QUE si un global change de VALEUR — pas à chaque setPactDerivedMods (appelé
//   à chaque tick par le store mais quasi toujours avec la même valeur). Le moteur de combat traite
//   les objets renvoyés en LECTURE SEULE (il réassigne d.profile/d.resist à de nouveaux objets, ne
//   mute jamais l'objet caché) → mémoïser ne corrompt rien.
let statsEpoch = 0

interface StatCache {
  epoch: number
  base: Character['base']
  equipment: Character['equipment']
  talents: Character['talents']
  pantheon: Character['pantheon']
  passives: Character['passives']
  derived?: DerivedStats
  profile?: DamageProfile
  passivesOut?: ReturnType<typeof charPassivesUncached>
  resist?: Partial<Record<DamageType, number>>
  cmods?: CombatMods
}
const statCache = new Map<string, StatCache>()

/** Entrée de cache valide pour ce perso (mêmes références de build + même epoch), sinon entrée neuve. */
function cacheFor(char: Character): StatCache {
  const e = statCache.get(char.id)
  if (e && e.epoch === statsEpoch
    && e.base === char.base && e.equipment === char.equipment
    && e.talents === char.talents && e.pantheon === char.pantheon && e.passives === char.passives) {
    return e
  }
  const fresh: StatCache = {
    epoch: statsEpoch, base: char.base, equipment: char.equipment,
    talents: char.talents, pantheon: char.pantheon, passives: char.passives,
  }
  statCache.set(char.id, fresh)
  return fresh
}

// Multiplicateurs globaux issus des améliorations marchand (mis à jour par le store).
let GLOBAL = { power: 1, attackSpeed: 1, vitality: 1 }
export function setGlobalCombatMods(m: { power: number; attackSpeed: number; vitality: number }) {
  if (m.power !== GLOBAL.power || m.attackSpeed !== GLOBAL.attackSpeed || m.vitality !== GLOBAL.vitality) statsEpoch++
  GLOBAL = m
}

// 🩸 PACTES (runes keystone) : mods dérivés d'ÉQUIPE, recalculés par le store au tick —
// même mécanique module-niveau que GLOBAL (les pactes portés changent rarement, latence ≤ 1 tick).
let PACT = { hpMult: 1, apsMult: 1, apsForce: 0, leechBonus: 0, noRiposte: false }
export function setPactDerivedMods(m: { hpMult: number; apsMult: number; apsForce: number; leechBonus: number; noRiposte: boolean }) {
  if (m.hpMult !== PACT.hpMult || m.apsMult !== PACT.apsMult || m.apsForce !== PACT.apsForce
    || m.leechBonus !== PACT.leechBonus || m.noRiposte !== PACT.noRiposte) statsEpoch++
  PACT = m
}

// ✨ PRESTIGE : résistance plate offerte par la Constellation (Acclimatation), mise à jour par le store.
let PRESTIGE_RESIST = 0
export function setGlobalPrestigeResist(v: number) {
  const nv = Math.max(0, v)
  if (nv !== PRESTIGE_RESIST) statsEpoch++
  PRESTIGE_RESIST = nv
}

export function charDerived(char: Character): DerivedStats {
  const e = cacheFor(char)
  return (e.derived ??= charDerivedUncached(char))
}
function charDerivedUncached(char: Character): DerivedStats {
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
    // ⛰️ Roc / 🛢️ Plomb / 🗿 Colosse : les pactes pèsent sur les dérivées de TOUTE l'équipe.
    attacksPerSecond: PACT.apsForce > 0 ? PACT.apsForce : d.attacksPerSecond * GLOBAL.attackSpeed * PACT.apsMult,
    hp: d.hp * GLOBAL.vitality * sb.hpMult * PACT.hpMult,
    cdr: Math.min(0.75, d.cdr + sb.cdr),
    leech: Math.min(0.95, d.leech + sb.leech + PACT.leechBonus),
    riposteChance: PACT.noRiposte ? 0 : d.riposteChance, // ⛰️ Pacte du Roc : immobile, ne riposte pas
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
function singlePower(d: DerivedStats, s?: OffensiveStat): number {
  if (s === 'force') return d.forcePower
  if (s === 'agilite') return d.agiPower
  if (s === 'intelligence') return d.intPower
  return d.power
}
export function abilityPower(d: DerivedStats, scale?: OffensiveStat | OffensiveStat[]): number {
  // DÉCOUPLAGE : le primaire est le MOTEUR, l'arbre est l'IDENTITÉ. Toute capacité
  // scale sur ta stat DOMINANTE (`d.power`) ; le `scaleStat` déclaré n'est plus qu'une AFFINITÉ
  // thématique, jamais INFÉRIEURE à la dominante. Fin du mismatch « sort d'arbre Int qui scale
  // For/Agi » : un build For prend un sort « Int » et il scale sur sa Force.
  let declared = 0
  if (Array.isArray(scale)) for (const s of scale) declared = Math.max(declared, singlePower(d, s))
  else declared = singlePower(d, scale)
  return Math.max(declared, d.power)
}

/** Stat(s) de scaling effectives d'une capacité (multi prioritaire sur simple). */
export function powerScale(p: PowerDef): OffensiveStat | OffensiveStat[] | undefined {
  return p.scaleStats ?? p.scaleStat
}

export function charDamageProfile(char: Character): DamageProfile {
  const e = cacheFor(char)
  return (e.profile ??= computeDamageProfile(char.equipment, charKeystones(char)))
}

/** IDs des capacités ACTIVES (actifs + soutien auto-cast) — pour le DPS de fiche et le combat. */
export function charDeck(char: Character): (string | null)[] {
  return [...char.powers, ...(char.support ?? [])]
}

/** Génération de ressource (Points de Combo)/s des GÉNÉRATEURS équipés — pour estimer les finisseurs. */
function comboGenPerSec(char: Character, derived: DerivedStats, comboGen: number): number {
  let g = 0
  for (const pid of char.support ?? []) {
    if (!pid) continue
    const p = getPower(pid)
    if (p?.kind === 'active' && p.effect === 'builder') g += ((p.gen ?? 1) + comboGen) / Math.max(0.5, (p.cooldown ?? 3) * (1 - derived.cdr))
  }
  return g
}

/**
 * DPS d'un sort actif — MÊMES maths qu'en combat (fireActive), y compris les mécaniques de ressource :
 * - `builder` : petit coup direct ;
 * - `finisher` : dépense les Points de Combo → on estime le combo moyen au lancer via l'économie
 *   générateur→finisseur (génération/s × recharge, capée, + remboursement) ;
 * - `poison` : venin cumulatif SOUTENU (monte au cap puis se maintient) = stacks × intensité × Altération ;
 * - `detonate` : consomme le venin (×2 si Catalyse) à chaque recharge.
 * Plus le bonus par TAG (cross-classe). Sans ça la fiche sous-estimait les builds Voleur.
 */
function abilityDps(p: PowerDef, derived: DerivedStats, profileMult: number, dmgMult: number, cm: CombatMods, genPerSec: number): number {
  if (p.kind !== 'active' || !p.effect) return 0
  let tagMult = 1
  if (p.tags) for (const t of p.tags) tagMult *= (cm.tagBonus[t] ?? 1)
  // EV des procs signature du Mage (Hot Streak feu, Surcharge arcane).
  let procMult = 1
  const isNuke = p.effect === 'nuke' || p.effect === 'cleave' || p.effect === 'megaCleave'
  if (cm.hotStreak && isNuke && p.tags?.includes('feu') && p.tags?.includes('direct')) {
    const gain = 1 + 2 * derived.critChance // la Chaleur monte plus vite avec le Critique
    procMult *= 1 + (cm.hotStreak.mult - 1) * Math.min(1, gain / cm.hotStreak.cap)
  }
  if (cm.overload) {
    const cap = 5 + cm.comboCap
    const uptime = genPerSec > 0 ? cm.overload.window / (cm.overload.window + cap / genPerSec) : 0
    procMult *= 1 + (cm.overload.mult - 1) * uptime // la Surcharge booste TOUS tes sorts pendant la fenêtre
  }
  const value = (p.magnitude ?? 0) * abilityPower(derived, powerScale(p)) * profileMult * dmgMult * tagMult * procMult
  const cd = Math.max(0.5, (p.cooldown ?? 3) * (1 - derived.cdr))
  switch (p.effect) {
    case 'nuke': case 'cleave': case 'megaCleave': case 'lifeNuke': return value / cd
    case 'builder': return value / cd
    case 'executeNuke': return (value * 1.8) / cd // bonus moyen selon les PV manquants de la cible
    case 'dot': return value * 0.4 * derived.alterationMult // DoT soutenu
    case 'rupture': return (value * 0.5 + value * 0.5 * derived.alterationMult * (p.duration ?? 8)) / cd
    case 'poison': return cm.poison.maxStacks * cm.poison.perStack * value * derived.alterationMult
    case 'detonate': return (value * cm.poison.maxStacks * (cm.detonateDouble ? 2 : 1)) / cd
    case 'finisher': {
      const cap = 5 + cm.comboCap
      const avgCombo = Math.max(1, Math.min(cap, genPerSec * cd + cm.comboRefund))
      return (value * avgCombo * 0.55 * (1 + cm.finisherMult)) / cd
    }
    default: return 0 // soins / boucliers / buffs / charge / marque : pas un DPS direct
  }
}

/**
 * PYROMANCIEN — estimation du DoT d'Embrasement (DoT feu posé par les coups CRITIQUES).
 * Sustained ≈ (dégât d'UN crit) × frac × Altération × uptime, où l'uptime est la probabilité
 * que le DoT reste rafraîchi (assez de crits dans sa durée). Approx de fiche (hors cible).
 */
function igniteDps(cm: CombatMods, derived: DerivedStats, auto: number): number {
  if (!cm.igniteOnCrit || auto <= 0) return 0
  const avgCrit = 1 + derived.critChance * (derived.critMult - 1)
  const avgHit = auto / Math.max(0.1, derived.attacksPerSecond)
  const critHit = avgHit * derived.critMult / Math.max(1, avgCrit) // dégât d'un coup critique précis
  const uptime = Math.min(1, derived.critChance * derived.attacksPerSecond * cm.igniteOnCrit.duration)
  return critHit * cm.igniteOnCrit.frac * derived.alterationMult * uptime
}

/** DPS total estimé d'un perso : auto-attaque + CAPACITÉS actives équipées (pour l'affichage). */
export function charDps(char: Character): number {
  const derived = charDerived(char)
  const profile = charDamageProfile(char)
  const pm = profileDamageMult(profile)
  // Multiplicateur de dégâts PERSISTANT issu des keystones (Carnage, Titan…) + bonus de SET :
  // appliqué en combat aux auto-attaques ET aux sorts → il doit l'être ici aussi.
  const cm = charCombatMods(char)
  const dmgMult = cm.damageMult
  const gen = comboGenPerSec(char, derived, cm.comboGen)
  const auto = theoreticalDps(derived, profile, dmgMult * cm.autoTagMult)
  let dps = auto + auto * cm.petDps // INVOCATION : le familier inflige une fraction de ton DPS d'auto.
  dps += igniteDps(cm, derived, auto) // PYROMANCIEN : DoT d'Embrasement (crits).
  for (const pid of charDeck(char)) { // actifs + générateurs (les builders frappent aussi un peu)
    if (!pid) continue
    const p = getPower(pid)
    if (p) dps += abilityDps(p, derived, pm, dmgMult, cm, gen)
  }
  return dps
}

/** DPS estimé d'UN sort actif équipé (mêmes maths que la fiche) — pour l'affichage par carte (Capacités).
 *  Renvoie 0 pour les sorts qui ne sont pas un DPS direct (soins/boucliers/buffs). */
export function spellDps(char: Character, p: PowerDef): number {
  if (p.kind !== 'active' || !p.effect) return 0
  const derived = charDerived(char)
  const profile = charDamageProfile(char)
  const cm = charCombatMods(char)
  const gen = comboGenPerSec(char, derived, cm.comboGen)
  return abilityDps(p, derived, profileDamageMult(profile), cm.damageMult, cm, gen)
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
  const cm = charCombatMods(char)
  const dmgMult = cm.damageMult
  const gen = comboGenPerSec(char, derived, cm.comboGen)
  const auto = theoreticalDps(derived, profile, dmgMult * cm.autoTagMult)
  const spells: { name: string; dps: number }[] = []
  for (const pid of charDeck(char)) { // actifs + générateurs
    if (!pid) continue
    const p = getPower(pid)
    if (!p || p.kind !== 'active') continue
    const d = abilityDps(p, derived, pm, dmgMult, cm, gen)
    if (d > 0) spells.push({ name: p.name, dps: d })
  }
  if (cm.petDps > 0) spells.push({ name: '🐾 Familier', dps: auto * cm.petDps })
  const ig = igniteDps(cm, derived, auto)
  if (ig > 0) spells.push({ name: '🔥 Embrasement', dps: ig })
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
    ...(cm.autoTagMult > 1.001 ? [{ label: 'Tags (élément/direct)', value: `×${cm.autoTagMult.toFixed(2)}` }] : []),
  ]
  const hasConversions = charKeystones(char).some((k) => k.statAsOther || k.enduranceAs)
  return { total: auto + spells.reduce((a, s) => a + s.dps, 0), auto, spells, factors, hasConversions }
}

/** Résistances du héros en POINTS (équipement + talents + sets) — non plafonnées. */
export function charResist(char: Character): Partial<Record<DamageType, number>> {
  const e = cacheFor(char)
  return (e.resist ??= charResistUncached(char))
}
function charResistUncached(char: Character): Partial<Record<DamageType, number>> {
  const r = computeResistProfile(char.equipment, talentResistMods(charAllocations(char)))
  const sb = setBonuses(char.equipment)
  if (sb.resistAll > 0) {
    for (const t of DAMAGE_TYPE_LIST) r[t] = (r[t] ?? 0) + sb.resistAll * 100
  }
  // ✨ Acclimatation (Constellation) : résistance plate sur TOUS les types.
  if (PRESTIGE_RESIST > 0) for (const t of DAMAGE_TYPE_LIST) r[t] = (r[t] ?? 0) + PRESTIGE_RESIST
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
  // --- effets des archétypes (voir talents.ts) ---
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
  // --- socle VOLEUR ---
  /** ASSASSIN : venin cumulatif (base + bonus des keystones). */
  poison: { perStack: number; maxStacks: number }
  /** OMBRELAME : plafond de Points de Combo au-delà de 5 (somme). */
  comboCap: number
  /** OMBRELAME : Points de Combo générés en plus par les builders (somme). */
  comboGen: number
  /** OMBRELAME : amplification des finisseurs (somme). */
  finisherMult: number
  /** Bonus de dégâts par TAG (produit des keystones du même tag). */
  tagBonus: Record<string, number>
  /** Multiplicateur de tag appliqué à l'AUTO-ATTAQUE (élément de l'arme × [direct] × [mono]/[zone]). */
  autoTagMult: number
  /** ASSASSIN « Catalyse » : la détonation double le venin. */
  detonateDouble: boolean
  /** OMBRELAME : Points de Combo rendus par un finisseur (max des keystones). */
  comboRefund: number
  /** INVOCATION : DPS continu du familier, en fraction de ton DPS d'auto-attaque (somme). */
  petDps: number
  /** CONTRÔLE : bonus de dégâts (somme) contre les ennemis contrôlés. */
  shatter: number
  /** PYROMANCIEN : Embrasement sur coup critique (frac somme, durée max). */
  igniteOnCrit?: { frac: number; duration: number }
  /** REMPART : un finisseur accorde un bouclier = finisherShield × ses dégâts (somme). */
  finisherShield: number
  /** PYROMANCIEN « Hot Streak » : empower des sorts [feu][direct] à pleine Chaleur (le plus fort). */
  hotStreak?: { cap: number; mult: number }
  /** ARCANISTE « Surcharge instable » : fenêtre de burst au plein de Charges (le plus fort). */
  overload?: { window: number; mult: number }
  /** PALADIN AUBE : fraction de tes dégâts reversée en soin à l'allié le plus blessé (somme). */
  damageToHeal: number
  // --- VOLEUR « Lame Vénéneuse » ---
  finisherToPoison: number
  finisherIsDot: boolean
  finisherRefreshPoison: boolean
  finisherVsVenom: number
  finisherFromAlteration: number
  finisherVenomBonus: number
  noDotLeech: boolean
  poisonCanCrit: number
  finisherDetonate: number
  finisherProlongsDot?: { seconds: number; perCombo: number }
  detonateReapply: number
  critToAlteration: number
  builderPoison: boolean
  venomFinisherGen: boolean
  // --- PRÊTRE « Crépuscule » ---
  healAppliesDot: number
  atonementIsShadow: boolean
  atonementVsDot: number
  atonementFromAlteration: number
  atonementMult: number
  folieEmpowersAtonement: number
  folieDot: number
  noSelfHeal: boolean
  dotHealsParty: number
  // --- MAGE « Convergence » ---
  hotStreakCharges: number
  overloadFreezes: boolean
  frozenIgnites: number
  elementalStates: number
  shatterFromAlteration: number
  // --- GUERRIER « Juggernaut » + « Furie » ---
  shieldToFinisher: number
  damageToRage: number
  finisherRefreshBleed: boolean
  enrageOnCrit?: { mult: number; duration: number }
  // --- CHASSEUR « Symbiose » ---
  petBonus: number
  petFromPrecision: number
  petCombo: number
  petBurstOnFinisher: number
  // --- DRUIDE « Métamorphe » ---
  shifter: boolean
  formFauve: number
  formOurs: number
  formHibou: number
  instinctPer: number
  instinctMax: number
  shiftHaste: number
  formEcho: number
}

export function charCombatMods(char: Character): CombatMods {
  const e = cacheFor(char)
  return (e.cmods ??= charCombatModsUncached(char))
}
function charCombatModsUncached(char: Character): CombatMods {
  const out: CombatMods = {
    damageMult: 1, flatDr: 0, hot: 0, thorns: 0, multistrike: 0,
    healToDamage: 0, cleaveAuto: 0, perEnemyBonus: 0, dotLeech: 0, dotAoe: 0,
    spellMult: 1, cdrOnCast: 0, reqReduction: 0, surplusToDamage: 0, shareResist: 0, surplusRegen: 0,
    poison: { perStack: 0.08, maxStacks: 4 }, comboCap: 0, comboGen: 0, finisherMult: 0,
    tagBonus: {}, autoTagMult: 1, detonateDouble: false, comboRefund: 0, petDps: 0, shatter: 0, finisherShield: 0, damageToHeal: 0,
    // Lame Vénéneuse
    finisherToPoison: 0, finisherIsDot: false, finisherRefreshPoison: false, finisherVsVenom: 0,
    finisherFromAlteration: 0, finisherVenomBonus: 0, noDotLeech: false, poisonCanCrit: 0, finisherDetonate: 0,
    detonateReapply: 0, critToAlteration: 0, builderPoison: false, venomFinisherGen: false,
    // Crépuscule
    healAppliesDot: 0, atonementIsShadow: false, atonementVsDot: 0, atonementFromAlteration: 0, atonementMult: 1,
    folieEmpowersAtonement: 0, folieDot: 0, noSelfHeal: false, dotHealsParty: 0,
    // Convergence (Mage)
    hotStreakCharges: 0, overloadFreezes: false, frozenIgnites: 0, elementalStates: 0, shatterFromAlteration: 0,
    // Guerrier (Juggernaut + Furie)
    shieldToFinisher: 0, damageToRage: 0, finisherRefreshBleed: false,
    // Chasseur (Symbiose)
    petBonus: 0, petFromPrecision: 0, petCombo: 0, petBurstOnFinisher: 0,
    // Druide (Métamorphe)
    shifter: false, formFauve: 0, formOurs: 0, formHibou: 0, instinctPer: 0, instinctMax: 0, shiftHaste: 0, formEcho: 0,
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
    // --- archétypes ---
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
    // --- socle VOLEUR ---
    if (k.poison) { out.poison.perStack += k.poison.perStack; out.poison.maxStacks += k.poison.maxStacks }
    if (k.comboCap) out.comboCap += k.comboCap
    if (k.comboGen) out.comboGen += k.comboGen
    if (k.finisherMult) out.finisherMult += k.finisherMult
    if (k.tagBonus) out.tagBonus[k.tagBonus.tag] = (out.tagBonus[k.tagBonus.tag] ?? 1) * k.tagBonus.damageMult
    if (k.detonateDouble) out.detonateDouble = true
    if (k.comboRefund) out.comboRefund = Math.max(out.comboRefund, k.comboRefund)
    if (k.petDps) out.petDps += k.petDps
    if (k.shatter) out.shatter += k.shatter
    if (k.igniteOnCrit) {
      out.igniteOnCrit = out.igniteOnCrit
        ? { frac: out.igniteOnCrit.frac + k.igniteOnCrit.frac, duration: Math.max(out.igniteOnCrit.duration, k.igniteOnCrit.duration) }
        : { ...k.igniteOnCrit }
    }
    if (k.finisherShield) out.finisherShield += k.finisherShield
    if (k.damageToHeal) out.damageToHeal += k.damageToHeal
    // --- VOLEUR « Lame Vénéneuse » ---
    if (k.finisherToPoison) out.finisherToPoison += k.finisherToPoison
    if (k.finisherIsDot) out.finisherIsDot = true
    if (k.finisherRefreshPoison) out.finisherRefreshPoison = true
    if (k.finisherVsVenom) out.finisherVsVenom += k.finisherVsVenom
    if (k.finisherFromAlteration) out.finisherFromAlteration += k.finisherFromAlteration
    if (k.finisherVenomBonus) out.finisherVenomBonus += k.finisherVenomBonus
    if (k.noDotLeech) out.noDotLeech = true
    if (k.poisonCanCrit) out.poisonCanCrit = Math.max(out.poisonCanCrit, k.poisonCanCrit)
    if (k.finisherDetonate) out.finisherDetonate = Math.max(out.finisherDetonate, k.finisherDetonate)
    if (k.finisherProlongsDot) out.finisherProlongsDot = k.finisherProlongsDot
    if (k.detonateReapply) out.detonateReapply = Math.max(out.detonateReapply, k.detonateReapply)
    if (k.critToAlteration) out.critToAlteration += k.critToAlteration
    if (k.builderPoison) out.builderPoison = true
    if (k.venomFinisherGen) out.venomFinisherGen = true
    // --- PRÊTRE « Crépuscule » ---
    if (k.healAppliesDot) out.healAppliesDot += k.healAppliesDot
    if (k.atonementIsShadow) out.atonementIsShadow = true
    if (k.atonementVsDot) out.atonementVsDot += k.atonementVsDot
    if (k.atonementFromAlteration) out.atonementFromAlteration += k.atonementFromAlteration
    if (k.atonementMult) out.atonementMult *= k.atonementMult
    if (k.folieEmpowersAtonement) out.folieEmpowersAtonement += k.folieEmpowersAtonement
    if (k.folieDot) out.folieDot += k.folieDot
    if (k.noSelfHeal) out.noSelfHeal = true
    if (k.dotHealsParty) out.dotHealsParty += k.dotHealsParty
    // --- MAGE « Convergence » ---
    if (k.hotStreakCharges) out.hotStreakCharges += k.hotStreakCharges
    if (k.overloadFreezes) out.overloadFreezes = true
    if (k.frozenIgnites) out.frozenIgnites += k.frozenIgnites
    if (k.elementalStates) out.elementalStates += k.elementalStates
    if (k.shatterFromAlteration) out.shatterFromAlteration += k.shatterFromAlteration
    // --- GUERRIER « Juggernaut » + « Furie » ---
    if (k.shieldToFinisher) out.shieldToFinisher += k.shieldToFinisher
    if (k.damageToRage) out.damageToRage += k.damageToRage
    if (k.finisherRefreshBleed) out.finisherRefreshBleed = true
    if (k.enrageOnCrit) out.enrageOnCrit = out.enrageOnCrit
      ? { mult: Math.max(out.enrageOnCrit.mult, k.enrageOnCrit.mult), duration: Math.max(out.enrageOnCrit.duration, k.enrageOnCrit.duration) }
      : { ...k.enrageOnCrit }
    // --- CHASSEUR « Symbiose » ---
    if (k.petBonus) out.petBonus += k.petBonus
    if (k.petFromPrecision) out.petFromPrecision += k.petFromPrecision
    if (k.petCombo) out.petCombo += k.petCombo
    if (k.petBurstOnFinisher) out.petBurstOnFinisher += k.petBurstOnFinisher
    // --- DRUIDE « Métamorphe » ---
    if (k.shifter) out.shifter = true
    if (k.formFauve) out.formFauve += k.formFauve
    if (k.formOurs) out.formOurs += k.formOurs
    if (k.formHibou) out.formHibou += k.formHibou
    if (k.instinctPer) out.instinctPer += k.instinctPer
    if (k.instinctMax) out.instinctMax = Math.max(out.instinctMax, k.instinctMax)
    if (k.shiftHaste) out.shiftHaste += k.shiftHaste
    if (k.formEcho) out.formEcho = Math.max(out.formEcho, k.formEcho)
    if (k.hotStreak) out.hotStreak = out.hotStreak ? { cap: Math.min(out.hotStreak.cap, k.hotStreak.cap), mult: Math.max(out.hotStreak.mult, k.hotStreak.mult) } : { ...k.hotStreak }
    if (k.overload) out.overload = out.overload ? { window: Math.max(out.overload.window, k.overload.window), mult: Math.max(out.overload.mult, k.overload.mult) } : { ...k.overload }
    if (k.multiTypeBonus) {
      multiType = multiType
        ? { per: multiType.per + k.multiTypeBonus.per, threshold: Math.min(multiType.threshold, k.multiTypeBonus.threshold) }
        : { ...k.multiTypeBonus }
    }
  }
  // UNIQUES PAR TAG : leur bonus s'ajoute multiplicativement au tagBonus (×dégâts des sorts
  // du tag, et ×soin pour [soin] via healTagMult) → un unique peut DÉFINIR un build (feu, dot, soin…).
  for (const it of Object.values(char.equipment)) {
    if (!it?.unique) continue
    const tm = instanceTagMods(it.unique)
    for (const tag in tm) out.tagBonus[tag] = (out.tagBonus[tag] ?? 1) * (1 + tm[tag])
  }
  // l'AUTO-ATTAQUE profite des bonus de tag : son élément (type de l'arme) × [direct] × [mono]/[zone].
  // (les sorts, eux, prennent leur tagMult propre dans fireActive). → un unique [feu] ou [direct] booste aussi l'auto.
  const autoElem = char.equipment.armePrincipale?.damageType ?? 'physique'
  out.autoTagMult = (out.tagBonus[autoElem] ?? 1) * (out.tagBonus['direct'] ?? 1) * (out.tagBonus[out.cleaveAuto > 0 ? 'zone' : 'mono'] ?? 1)
  // PACTE DE LA TOXINE : la contrepartie coupe le soin par DoT.
  if (out.noDotLeech) out.dotLeech = 0
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
