import type { StatBlock, DamageType } from './types'
import { CLASSES, type ClassId, type SpecDef, type KsSpec } from './classData'
export type { KeystoneEffect } from './classData'
import type { KeystoneEffect } from './classData'

/**
 * ARBRE DE TALENTS v0.29.1 — HIÉRARCHIE WoW (root → classes → archétypes → branches).
 *
 *   RACINE (Éveil)
 *     → 13 NŒUDS DE CLASSE (Guerrier, Mage, …) — rayonnent du centre,
 *         → ENTRÉES D'ARCHÉTYPE (specs) — chaque classe a 2-4 specs,
 *             → SOUS-ARBRE PROFOND (4 branches) : chaîne d'identité (identité → 2e sort →
 *               capstone → ULTIME) + 2 branches de stats + un 2e keystone.
 *
 * Données : tout vient de classData.ts (sorts ET nœuds générés du même endroit → zéro désynchro).
 * Constellation = la CLASSE (13) → la feuille « Classes » liste 13 entrées propres, le palier
 * s'accumule par classe (investir une classe pour aller profond — le côté « plein de branches »).
 */

export type ConstellationId = 'coeur' | ClassId

export interface ConstellationMeta {
  id: ConstellationId
  name: string
  role: string
  color: string
  icon: string
  /** false pour le Cœur ; true pour les 13 classes (mises en avant dans l'UI). */
  archetype?: boolean
}

export type TalentKind = 'minor' | 'notable' | 'keystone' | 'ability' | 'gateway'

export interface TalentNode {
  id: string
  name: string
  constellation: ConstellationId
  description: string
  kind: TalentKind
  maxRank: number
  tier: number
  requires?: string[]
  statMods?: StatBlock
  resistMods?: Partial<Record<DamageType, number>>
  unlockPower?: string
  keystone?: KeystoneEffect
}

/* ------------------------------------------------------------------ */
/* Helpers de construction.                                            */
/* ------------------------------------------------------------------ */
export const TALENTS: TalentNode[] = []

const STAT_FR: Record<string, string> = {
  force: 'Force', agilite: 'Agilité', intelligence: 'Intelligence', endurance: 'Endurance',
  critique: 'Critique', degatsCrit: 'Dégâts crit.', hate: 'Hâte', maitrise: 'Maîtrise', penetration: 'Pénétration',
  precision: 'Précision', alteration: 'Altération', degatsBoss: 'Dégâts boss',
  reductionDegats: 'Réduction', esquive: 'Esquive', barriere: 'Barrière', tenacite: 'Ténacité', regen: 'Régén', purge: 'Purge',
  volDeVie: 'Vol de vie', surpuissance: 'Surpuissance', multifrappe: 'Multifrappe', recuperation: 'Récupération',
}
function sd(mods: StatBlock): string {
  return Object.entries(mods).map(([k, v]) => `+${v} ${STAT_FR[k] ?? k}`).join(', ')
}
function single(n: TalentNode) { TALENTS.push(n) }
function emitKs(id: string, c: ConstellationId, tier: number, requires: string[], k: KsSpec, kind: TalentKind = 'keystone') {
  single({ id, name: k.name, constellation: c, kind, tier, maxRank: 1, requires, description: k.desc,
    ...(k.stat ? { statMods: k.stat } : {}), ...(k.resist ? { resistMods: k.resist } : {}), ...(k.ks ? { keystone: k.ks } : {}) })
}

/* ------------------------------------------------------------------ */
/* RACINE.                                                             */
/* ------------------------------------------------------------------ */
single({ id: 'co_start', name: 'Éveil', constellation: 'coeur', kind: 'ability', tier: 0, maxRank: 1,
  description: '+10 stats primaires, +20 Endurance, et débloque Frappe. La racine de toutes les classes.',
  statMods: { force: 10, agilite: 10, intelligence: 10, endurance: 20 }, unlockPower: 'frappe_simple' })

/* ------------------------------------------------------------------ */
/* GÉNÉRATION : pour chaque CLASSE → nœud de classe → specs → branches. */
/* ------------------------------------------------------------------ */
function emitSpec(c: ClassId, classNode: string, s: SpecDef) {
  const p = `sp_${s.id}_`
  const entryStat: StatBlock = s.primary === 'endurance' ? { endurance: 50 } : { [s.primary]: 25 }
  // Entrée d'archétype : débloque le sort SIGNATURE.
  single({ id: `${p}e`, name: s.name, constellation: c, kind: 'ability', tier: 1, maxRank: 1, requires: [classNode],
    description: `${s.wow} — débloque ${s.sig.name} et ouvre l'archétype ${s.name}. ${sd(entryStat)}.`,
    statMods: entryStat, unlockPower: s.sig.id })
  // Branche 1 (cœur d'identité) : identité → 2e sort → capstone → ULTIME.
  emitKs(`${p}i`, c, 2, [`${p}e`], s.identity)
  single({ id: `${p}q`, name: s.q.name, constellation: c, kind: 'ability', tier: 3, maxRank: 1, requires: [`${p}i`],
    description: `Débloque ${s.q.name}.`, unlockPower: s.q.id })
  emitKs(`${p}c`, c, 4, [`${p}q`], s.cap)
  single({ id: `${p}u`, name: s.ult.name, constellation: c, kind: 'ability', tier: 5, maxRank: 1, requires: [`${p}c`],
    description: `ULTIME — débloque ${s.ult.name} (sort surpuissant, long cooldown).`, unlockPower: s.ult.id })
  // Branche 2 (stats A) : deux crans.
  single({ id: `${p}a1`, name: `${s.name} · affinité`, constellation: c, kind: 'minor', tier: 2, maxRank: 5, requires: [`${p}e`], description: `${sd(s.sA)} par rang.`, statMods: s.sA })
  single({ id: `${p}a2`, name: `${s.name} · maîtrise`, constellation: c, kind: 'minor', tier: 3, maxRank: 3, requires: [`${p}a1`], description: `${sd(s.sC)} par rang.`, statMods: s.sC })
  // Branche 3 (stats B) + 4 (2e keystone) : en parallèle depuis l'entrée.
  single({ id: `${p}b1`, name: `${s.name} · discipline`, constellation: c, kind: 'minor', tier: 2, maxRank: 4, requires: [`${p}e`], description: `${sd(s.sB)} par rang.`, statMods: s.sB })
  emitKs(`${p}k2`, c, 2, [`${p}e`], s.ks2)
}

for (const cls of CLASSES) {
  const classNode = `cl_${cls.id}`
  single({ id: classNode, name: cls.name, constellation: cls.id, kind: 'ability', tier: 0, maxRank: 1, requires: ['co_start'],
    description: `${cls.wow} — ${cls.passive.desc} Débloque ${cls.classSpell.name} et ouvre les archétypes de la classe.`,
    statMods: cls.passive.stat, unlockPower: cls.classSpell.id, ...(cls.passive.ks ? { keystone: cls.passive.ks } : {}) })
  for (const s of cls.specs) emitSpec(cls.id, classNode, s)
}

/* Méta de constellation : Cœur + 13 classes. */
export const CONSTELLATIONS: Record<ConstellationId, ConstellationMeta> = (() => {
  const out = {} as Record<ConstellationId, ConstellationMeta>
  out.coeur = { id: 'coeur', name: 'Cœur', role: 'Racine', color: '#e2e8f0', icon: '✶' }
  for (const c of CLASSES) {
    const roles = [...new Set(c.specs.map((s) => ({ dps: 'DPS', tank: 'Tank', heal: 'Heal' }[s.role])))].join('/')
    out[c.id] = { id: c.id, name: c.name, role: `${c.wow} · ${roles}`, color: c.color, icon: c.icon, archetype: true }
  }
  return out
})()

export const CONSTELLATION_LIST: ConstellationId[] = ['coeur', ...CLASSES.map((c) => c.id)]

/* ------------------------------------------------------------------ */
/* Accès & agrégation (API INCHANGÉE — consommée par character.ts / UI). */
/* ------------------------------------------------------------------ */
const BY_ID = new Map(TALENTS.map((t) => [t.id, t]))
export function getTalent(id: string): TalentNode | undefined {
  return BY_ID.get(id)
}

export function talentsByConstellation(c: ConstellationId): TalentNode[] {
  return TALENTS.filter((t) => t.constellation === c).sort((a, b) => a.tier - b.tier)
}

/** Stats cumulées issues des talents alloués. */
export function talentStatMods(talents: Record<string, number>): StatBlock {
  const out: StatBlock = {}
  for (const id in talents) {
    const rank = talents[id]
    const node = BY_ID.get(id)
    if (!node?.statMods || rank <= 0) continue
    for (const k in node.statMods) {
      const key = k as keyof StatBlock
      out[key] = (out[key] ?? 0) + (node.statMods[key] ?? 0) * rank
    }
  }
  return out
}

/** Résistances cumulées issues des talents alloués. */
export function talentResistMods(talents: Record<string, number>): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {}
  for (const id in talents) {
    const rank = talents[id]
    const node = BY_ID.get(id)
    if (!node?.resistMods || rank <= 0) continue
    for (const t in node.resistMods) {
      const type = t as DamageType
      out[type] = (out[type] ?? 0) + (node.resistMods[type] ?? 0) * rank
    }
  }
  return out
}

/** Capacités débloquées par les talents alloués. */
export function talentUnlockedPowers(talents: Record<string, number>): string[] {
  const out: string[] = []
  for (const id in talents) {
    if (talents[id] <= 0) continue
    const p = BY_ID.get(id)?.unlockPower
    if (p) out.push(p)
  }
  return out
}

/** Tous les keystones actifs (alloués), pour le moteur de combat. */
export function talentKeystones(talents: Record<string, number>): KeystoneEffect[] {
  const out: KeystoneEffect[] = []
  for (const id in talents) {
    if (talents[id] <= 0) continue
    const k = BY_ID.get(id)?.keystone
    if (k) out.push(k)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* GATING — palier CUMULATIF par CLASSE + verrou de compétence.
/*  GATE_PER_TIER points par tier de profondeur, dépensés n'importe où dans les tiers
/*  inférieurs de la CLASSE (constellation). Clampé aux points disponibles en dessous.
/*  → signatures cheap, identité/sorts/capstone/ultime = investissement croissant dans la classe.
/* ------------------------------------------------------------------ */
export const GATE_PER_TIER = 3

const tierTotals = new Map<ConstellationId, Map<number, number>>()
function tierTotalsFor(c: ConstellationId): Map<number, number> {
  let m = tierTotals.get(c)
  if (!m) {
    m = new Map()
    for (const n of TALENTS) {
      if (n.constellation !== c) continue
      m.set(n.tier, (m.get(n.tier) ?? 0) + n.maxRank)
    }
    tierTotals.set(c, m)
  }
  return m
}

function previousTier(c: ConstellationId, tier: number): number | null {
  let best: number | null = null
  for (const t of tierTotalsFor(c).keys()) {
    if (t < tier && (best == null || t > best)) best = t
  }
  return best
}

/** Points dépensés dans TOUS les tiers ≤ `tier` d'une constellation (cumulatif). */
export function spentInTier(talents: Record<string, number>, c: ConstellationId, tier: number): number {
  let spent = 0
  for (const id in talents) {
    const node = BY_ID.get(id)
    if (node?.constellation === c && node.tier <= tier) spent += talents[id]
  }
  return spent
}

export function tierGate(node: TalentNode): { tier: number; need: number } {
  if (node.tier <= 0 || node.constellation === 'coeur') return { tier: 0, need: 0 }
  const prev = previousTier(node.constellation, node.tier)
  if (prev == null) return { tier: 0, need: 0 }
  const totals = tierTotalsFor(node.constellation)
  let depth = 0
  let available = 0
  for (const [t, total] of totals) {
    if (t < node.tier) { depth++; available += total }
  }
  return { tier: prev, need: Math.min(GATE_PER_TIER * depth, available) }
}

/** Les nœuds FORTS exigent leurs prérequis au rang MAX (verrou de compétence). */
export function strictRequires(node: TalentNode): boolean {
  return node.kind === 'keystone' || node.kind === 'ability'
}

export interface GateInfo {
  gateTier: number
  spent: number
  need: number
  missingMaxed: string[]
}
export function gateInfo(node: TalentNode, talents: Record<string, number>): GateInfo {
  const missingMaxed: string[] = []
  if (strictRequires(node)) {
    for (const r of node.requires ?? []) {
      const rn = BY_ID.get(r)
      if (rn && (talents[r] ?? 0) < rn.maxRank) missingMaxed.push(rn.name)
    }
  }
  const g = tierGate(node)
  return { gateTier: g.tier, spent: g.need > 0 ? spentInTier(talents, node.constellation, g.tier) : 0, need: g.need, missingMaxed }
}

/** Peut-on allouer un point dans ce nœud ? (prérequis + verrous de palier/compétence). */
export function canAllocate(node: TalentNode, talents: Record<string, number>, points: number): boolean {
  if (points <= 0) return false
  if ((talents[node.id] ?? 0) >= node.maxRank) return false
  const strict = strictRequires(node)
  if (node.requires && node.requires.length) {
    const ok = node.requires.every((r) => {
      const have = talents[r] ?? 0
      if (have <= 0) return false
      if (!strict) return true
      const rn = BY_ID.get(r)
      return have >= (rn?.maxRank ?? 1)
    })
    if (!ok) return false
  }
  const g = tierGate(node)
  if (g.need > 0 && spentInTier(talents, node.constellation, g.tier) < g.need) return false
  return true
}

/** Le nœud est-il accessible (TOUS les prérequis remplis), indépendamment des points ? */
export function isReachable(node: TalentNode, talents: Record<string, number>): boolean {
  if (!node.requires || node.requires.length === 0) return true
  return node.requires.every((r) => (talents[r] ?? 0) > 0)
}
