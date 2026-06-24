/**
 * UNIQUE DESCRIBE — traduit les effets d'un unique en valeurs CONCRÈTES et chiffrées, pour le Codex
 * et la fiche d'objet. Logique PURE (aucune dépendance au store/React) : les composants se contentent
 * d'afficher les lignes renvoyées.
 *
 * Principe : on affiche le DELTA marginal qu'apporte le bloc de stats (pas l'absolu, qui inclurait les
 * bases innées : 5% de crit, ×1,5 de dégâts crit…). On réutilise `computeDerived` (la SOURCE UNIQUE des
 * knobs de conversion) plutôt que de recopier les diviseurs — pas de dérive d'équilibrage possible.
 *   → Consommé par GrimoirePanel (codex) et ComparePanel (fiche d'objet).
 */
import type { StatBlock, StatKey, PrimaryStat, DamageType } from './types'
import { computeDerived, ALL_STAT_META, PRIMARY_STATS, HP_PER_ENDURANCE, type DerivedStats } from './stats'
import { DAMAGE_TYPES } from './damage'
import { getUnique, UNIQUE_ACTIVE_RANK, describeActiveEffect } from './uniques'

export interface EffectLine { label: string; color: string; rare?: boolean }

/** Baseline (bases innées du personnage NU) — sert à exprimer le delta marginal d'un unique. */
const EMPTY = computeDerived({})
const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`

const PRIMARY_NOTE: Record<PrimaryStat, string> = {
  force: 'dégâts de mêlée',
  agilite: 'dégâts rapides',
  intelligence: 'dégâts de sorts & soins',
  endurance: 'points de vie',
}

/** Pour chaque secondaire : fragment chiffré du DELTA marginal (à partir des stats dérivées). */
type Fmt = (d: DerivedStats) => string
const SEC_FMT: Partial<Record<StatKey, Fmt>> = {
  critique: (d) => `+${pct(d.critChance - EMPTY.critChance)} coups critiques`,
  degatsCrit: (d) => `dégâts critiques ×${d.critMult.toFixed(2)} (sans crit : inutile)`,
  hate: (d) => `+${pct(d.attacksPerSecond - EMPTY.attacksPerSecond)} vitesse d'attaque`,
  penetration: (d) => `ignore ${pct(d.penetration)} des résistances/armure`,
  precision: (d) => `+${pct(d.precision)} d'anti-esquive (auto-attaques)`,
  alteration: (d) => `+${pct(d.alterationMult - 1)} de dégâts sur la durée`,
  degatsBoss: (d) => `+${pct(d.bossDamageMult - 1)} de dégâts aux boss/élites`,
  reductionDegats: (d) => `-${pct(d.flatDr)} de dégâts subis`,
  barriere: (d) => `+${pct(d.shieldPct)} de PV effectifs (bouclier)`,
  resilience: (d) => `-${pct(d.resilience)} de durée des contrôles & altérations`,
  volDeVie: (d) => `${pct(d.leech)} des dégâts rendus en vie`,
  surpuissance: (d) => `+${pct(d.overpower - 1)} de dégâts globaux`,
  multifrappe: (d) => `${pct(d.multistrike)} de frapper deux fois`,
  recuperation: (d) => `-${pct(d.cdr)} de temps de recharge`,
  maitrise: () => `effet de Maîtrise (selon ton archétype)`,
}

const isPrimary = (k: string): k is PrimaryStat => (PRIMARY_STATS as string[]).includes(k)

/** Traduit un bloc de stats (déjà scalé au rang/rareté) en effets concrets et chiffrés. */
export function describeUniqueStats(mods: StatBlock): EffectLine[] {
  const out: EffectLine[] = []
  const d = computeDerived(mods)
  // Primaires : libellé clair (PV exacts pour l'Endurance, rôle pour les offensives).
  for (const k of PRIMARY_STATS) {
    const r = mods[k] ?? 0
    if (r <= 0) continue
    const m = ALL_STAT_META[k]
    out.push(k === 'endurance'
      ? { label: `+${r * HP_PER_ENDURANCE} PV`, color: m.color }
      : { label: `+${r} ${m.name} · ${PRIMARY_NOTE[k]}`, color: m.color })
  }
  // Secondaires : on annexe le delta marginal chiffré (réutilise les knobs de computeDerived).
  for (const k in mods) {
    if (isPrimary(k)) continue
    const key = k as StatKey
    const r = mods[key] ?? 0
    if (r <= 0) continue
    const m = ALL_STAT_META[key]
    const frag = SEC_FMT[key]?.(d)
    out.push({ label: frag ? `+${r} ${m.name} → ${frag}` : `+${r} ${m.name}`, color: m.color, rare: m.rare })
  }
  return out
}

/** Résistances (en %) → lignes colorées par type de dégât. */
export function describeUniqueResist(resist: Partial<Record<DamageType, number>>): EffectLine[] {
  const out: EffectLine[] = []
  for (const k in resist) {
    const type = k as DamageType
    const v = resist[type] ?? 0
    if (v <= 0) continue
    const m = DAMAGE_TYPES[type]
    out.push({ label: `+${Math.round(v * 100)}% de résistance ${m.name}`, color: m.color })
  }
  return out
}

/** Bonus de tag (amplification de sorts) → +X% dégâts (ou soins pour [soin]) du tag. */
export function describeUniqueTags(tags: Record<string, number>): EffectLine[] {
  const out: EffectLine[] = []
  for (const tag in tags) {
    const v = tags[tag]
    if (v <= 0) continue
    out.push({ label: `+${Math.round(v * 100)}% de ${tag === 'soin' ? 'soins' : 'dégâts'} [${tag}]`, color: '#22d3ee' })
  }
  return out
}

export interface ActiveInfo {
  /** Texte d'accroche (saveur). */
  text: string
  /** Effet mécanique chiffré, si l'actif est câblé (Phase B). */
  value?: string
  /** Rang qui débloque l'actif. */
  unlockRank: number
}

/** Décrit l'actif d'un unique à un rang donné : accroche + effet chiffré si câblé. */
export function describeUniqueActive(id: string, rank: number): ActiveInfo | null {
  const def = getUnique(id)
  if (!def?.active) return null
  return { text: def.active, value: describeActiveEffect(id, rank) ?? undefined, unlockRank: UNIQUE_ACTIVE_RANK }
}
