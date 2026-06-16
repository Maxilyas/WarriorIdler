import type { StatBlock, DamageType } from './types'
export type { KeystoneEffect } from './classData'
import type { KeystoneEffect } from './classData'

/**
 * ARBRE DE TALENTS v0.29.3 — ARBRES À CHOIX (façon Path of Exile), handcrafted classe par classe.
 *
 *   RACINE (Éveil) → 4 CATÉGORIES (armure) → CLASSES → ARCHÉTYPES (webs de grappes).
 *
 * Modèle d'allocation NOUVEAU (fini le couloir) :
 *   - RÉACHABILITÉ PAR ADJACENCE : un nœud est dispo s'il TOUCHE n'importe quel nœud déjà pris
 *     (`requires` = parent de layout + `links` = anneau/routes croisées, tous traités comme voisins).
 *   - NŒUDS DE CHOIX EXCLUSIFS (`exclusive`) : prendre A verrouille ses frères de groupe.
 *   - CONVERGENCE (`requiresAll`) : exige TOUS les nœuds listés (ex. identité au carrefour).
 *   - BUDGET (`minSpent`) : les payoffs (ultimes, capstones) exigent N pts investis DANS la voie.
 * → on navigue, on esquive ce qu'on ne veut pas, on trouve plein de chemins/builds. Multi-classe natif
 *   (catégories + entrées peu chères + keystones qui s'empilent entre classes, aucun cap).
 *
 * FAIT : Voleur (Cuir) → Assassin (afflictions, 4 grappes) + Ombrelame (combo/ombre, 4 grappes + convergence).
 */

export type ConstellationId = 'coeur' | 'voleur' | 'assassin' | 'ombrelame'

export interface ConstellationMeta {
  id: ConstellationId
  name: string
  role: string
  color: string
  icon: string
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
  /** Parent(s) de LAYOUT + voisins (réachabilité OR). */
  requires?: string[]
  /** Liens d'adjacence SUPPLÉMENTAIRES (anneau, routes croisées) — bidirectionnels pour la réachabilité. */
  links?: string[]
  /** CONVERGENCE : exige TOUS ces nœuds (au lieu de l'un d'eux). */
  requiresAll?: string[]
  /** CHOIX EXCLUSIF : prendre ce nœud verrouille les autres du même groupe. */
  exclusive?: string
  /** BUDGET : points à dépenser dans la constellation avant de pouvoir l'allouer. */
  minSpent?: number
  statMods?: StatBlock
  resistMods?: Partial<Record<DamageType, number>>
  unlockPower?: string
  keystone?: KeystoneEffect
}

/* ------------------------------------------------------------------ */
/* Helpers de construction.                                           */
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
type Opt = Partial<Pick<TalentNode, 'requires' | 'links' | 'requiresAll' | 'exclusive' | 'minSpent' | 'statMods' | 'resistMods' | 'unlockPower' | 'keystone'>>
function node(id: string, c: ConstellationId, kind: TalentKind, tier: number, maxRank: number, name: string, description: string, opt: Opt = {}) {
  TALENTS.push({ id, name, constellation: c, kind, tier, maxRank, description, ...opt })
}
function minor(id: string, c: ConstellationId, tier: number, name: string, maxRank: number, stat: StatBlock, opt: Opt = {}) {
  node(id, c, 'minor', tier, maxRank, name, `${sd(stat)} par rang.`, { statMods: stat, ...opt })
}
function ks(id: string, c: ConstellationId, tier: number, name: string, desc: string,
  kStone: { stat?: StatBlock; ks?: KeystoneEffect; resist?: Partial<Record<DamageType, number>> }, opt: Opt = {}) {
  node(id, c, opt.exclusive ? 'notable' : 'keystone', tier, 1, name, desc,
    { ...(kStone.stat ? { statMods: kStone.stat } : {}), ...(kStone.ks ? { keystone: kStone.ks } : {}), ...(kStone.resist ? { resistMods: kStone.resist } : {}), ...opt })
}
function ability(id: string, c: ConstellationId, tier: number, name: string, power: string, desc: string, opt: Opt = {}) {
  node(id, c, 'ability', tier, 1, name, desc, { unlockPower: power, ...opt })
}

/* ------------------------------------------------------------------ */
/* RACINE + 4 CATÉGORIES.                                              */
/* ------------------------------------------------------------------ */
node('co_start', 'coeur', 'ability', 0, 1, 'Éveil', '+10 stats primaires, +20 Endurance, débloque Frappe. La racine de l\'arbre.',
  { statMods: { force: 10, agilite: 10, intelligence: 10, endurance: 20 }, unlockPower: 'frappe_simple' })
node('cat_plaque', 'coeur', 'gateway', 1, 1, 'Plaque', 'Catégorie Plaque (Guerrier, Paladin, Chevalier de la mort). +40 Endurance, +15 Force. — classes à venir.', { requires: ['co_start'], statMods: { endurance: 40, force: 15 } })
node('cat_mailles', 'coeur', 'gateway', 1, 1, 'Mailles', 'Catégorie Mailles (Chasseur, Chaman). +20 Agilité, +20 Intelligence. — classes à venir.', { requires: ['co_start'], statMods: { agilite: 20, intelligence: 20 } })
node('cat_cuir', 'coeur', 'gateway', 1, 1, 'Cuir', 'Catégorie Cuir (Voleur, Druide). +30 Agilité, +15 Critique.', { requires: ['co_start'], statMods: { agilite: 30, critique: 15 } })
node('cat_tissu', 'coeur', 'gateway', 1, 1, 'Tissu', 'Catégorie Tissu (Mage, Démoniste, Prêtre). +40 Intelligence. — classes à venir.', { requires: ['co_start'], statMods: { intelligence: 40 } })

/* VOLEUR — nœud de classe (peu cher : multi-classe natif). */
node('cl_voleur', 'voleur', 'ability', 0, 1, 'Voleur', 'Maître de la lame et du poison. Débloque Tranchant et ouvre ses deux archétypes. +25 Agilité, +15 Critique.',
  { requires: ['cat_cuir'], statMods: { agilite: 25, critique: 15 }, unlockPower: 'vo_tranchant' })

/* ================= ASSASSIN — réseau d'afflictions (moyeu → 4 grappes + anneau) ================= */
ability('as_hub', 'assassin', 0, 'Assassin', 'as_lame_enduite', 'Entre dans la voie de l\'Assassin : débloque Lame enduite (venin cumulatif). +18 Agilité, +15 Altération.', { requires: ['cl_voleur'], statMods: { agilite: 18, alteration: 15 } })

// Grappe VENIN (cumulatif)
minor('as_tox', 'assassin', 1, 'Toxicologie', 3, { alteration: 18 }, { requires: ['as_hub'] })
ks('as_inoc', 'assassin', 2, 'Inoculation', 'VENIN : ton venin s\'empile plus haut et frappe plus fort.', { stat: { alteration: 16 }, ks: { poison: { perStack: 0.05, maxStacks: 2 } } }, { requires: ['as_tox'] })
ks('as_letal', 'assassin', 3, 'Venin létal', 'CHOIX : +grosse intensité par stack (venin lent et brutal).', { stat: { alteration: 14 }, ks: { poison: { perStack: 0.06, maxStacks: 0 } } }, { requires: ['as_inoc'], exclusive: 'as_venin' })
ks('as_viru', 'assassin', 3, 'Venin virulent', 'CHOIX : +2 stacks max (venin qui sature plus haut).', { stat: { alteration: 14 }, ks: { poison: { perStack: 0, maxStacks: 2 } } }, { requires: ['as_inoc'], exclusive: 'as_venin' })

// Grappe SAIGNEMENT
minor('as_lame', 'assassin', 1, 'Lames affûtées', 3, { critique: 18 }, { requires: ['as_hub'] })
ks('as_hemo', 'assassin', 2, 'Hémorragie vive', 'SAIGNEMENT : tes coups ouvrent une plaie (DoT physique, 20% du coup/s, 5 s).', { stat: { alteration: 12 }, ks: { dot: { frac: 0.2, duration: 5 } } }, { requires: ['as_lame'] })
ks('as_beante', 'assassin', 3, 'Plaie béante', 'CHOIX : +12% de dégâts (saignements brutaux).', { ks: { damageMult: 1.12 } }, { requires: ['as_hemo'], exclusive: 'as_saign' })
ks('as_infect', 'assassin', 3, 'Plaie infectée', 'CHOIX : le saignement nourrit le venin (+intensité de stack).', { stat: { alteration: 10 }, ks: { poison: { perStack: 0.04, maxStacks: 0 } } }, { requires: ['as_hemo'], exclusive: 'as_saign' })

// Grappe DÉTONATION (atteignable depuis Venin OU Saignement)
minor('as_conc', 'assassin', 1, 'Concentration', 3, { penetration: 18 }, { requires: ['as_hub'] })
ability('as_dist', 'assassin', 2, 'Distillation explosive', 'as_distillation', 'Débloque Distillation : DÉTONE tous les stacks de venin (pic = stacks × dégâts).', { requires: ['as_conc'] })
ks('as_chain', 'assassin', 3, 'Réaction en chaîne', 'La détonation et tes DoT se propagent au pack (50%).', { stat: { penetration: 16 }, ks: { dotAoe: 0.5 } }, { requires: ['as_dist'] })
ability('as_peste', 'assassin', 4, 'Peste Souveraine', 'as_peste_souveraine', 'ULTIME — détonation cataclysmique de tout le venin.', { requires: ['as_chain'], minSpent: 14 })

// Grappe DRAIN (SURVIE — profil poison/drain) (atteignable depuis Venin OU Saignement)
minor('as_sang', 'assassin', 1, 'Sangsue', 3, { volDeVie: 10 }, { requires: ['as_hub'] })
ks('as_vamp', 'assassin', 2, 'Vampirisme toxique', 'SURVIE : tes DoT te soignent (25% du tick). +20 Régén.', { stat: { regen: 20 }, ks: { dotLeech: 0.25 } }, { requires: ['as_sang'] })
ability('as_reprise', 'assassin', 2, 'Reprise', 'second_souffle', 'SURVIE : débloque Reprise (auto-soin) — pour tenir en solo dès le début.', { requires: ['as_sang'] })
ks('as_meta', 'assassin', 3, 'Métabolisme morbide', 'SURVIE : +30 Régén, +12 Vol de vie, -8% de dégâts subis.', { stat: { regen: 30, volDeVie: 12 }, ks: { flatDr: 0.08 } }, { requires: ['as_vamp'] })

/* ================= OMBRELAME — combo & ombre (moyeu → 4 grappes + CONVERGENCE) ================= */
ability('om_hub', 'ombrelame', 0, 'Ombrelame', 'om_frappe_sournoise', 'Entre dans la voie de l\'Ombrelame : débloque Frappe sournoise (générateur de Points de Combo). +18 Agilité, +12 Critique.', { requires: ['cl_voleur'], statMods: { agilite: 18, critique: 12 } })

// Grappe GÉNÉRATION
minor('om_aff', 'ombrelame', 1, 'Affûtage', 3, { critique: 18 }, { requires: ['om_hub'] })
ks('om_saig', 'ombrelame', 2, 'Saignée preste', 'GÉNÉRATION : tes générateurs donnent +1 Point de Combo.', { stat: { hate: 16 }, ks: { comboGen: 1 } }, { requires: ['om_aff'] })
ks('om_oeil', 'ombrelame', 3, 'Œil pour œil', 'CHOIX : +20 Critique, +1 PC (génération sur burst de crit).', { stat: { critique: 20 }, ks: { comboGen: 1 } }, { requires: ['om_saig'], exclusive: 'om_gen' })
ks('om_cad', 'ombrelame', 3, 'Cadence', 'CHOIX : +24 Hâte (génération rapide et régulière).', { stat: { hate: 24 } }, { requires: ['om_saig'], exclusive: 'om_gen' })

// Grappe FINITION
ability('om_evis', 'ombrelame', 1, 'Éviscération', 'om_eviscaration', 'FINITION : débloque Éviscération (finisseur — dégâts × Points de Combo). +16 Agilité.', { requires: ['om_hub'], statMods: { agilite: 16 } })
ks('om_surin', 'ombrelame', 2, 'Surin mortel', 'FINITION : tes finisseurs frappent +25% plus fort.', { stat: { degatsCrit: 20 }, ks: { finisherMult: 0.25 } }, { requires: ['om_evis'] })
ks('om_brutal', 'ombrelame', 3, 'Éviscération brutale', 'CHOIX : finisseurs +30% (gros pics à PC plein).', { ks: { finisherMult: 0.3 } }, { requires: ['om_surin'], exclusive: 'om_fin' })
ks('om_taillade', 'ombrelame', 3, 'Cadence mortelle', 'CHOIX : +1 PC généré, +18 Hâte (finisseurs à répétition).', { stat: { hate: 18 }, ks: { comboGen: 1 } }, { requires: ['om_surin'], exclusive: 'om_fin' })

// Grappe FURTIVITÉ (SURVIE = esquive ; atteignable depuis Génération OU Finition)
minor('om_cele', 'ombrelame', 1, 'Célérité', 3, { esquive: 18, hate: 8 }, { requires: ['om_hub'] })
ability('om_voile', 'ombrelame', 2, 'Voile d\'ombre', 'posture_defensive', 'SURVIE : débloque Voile d\'ombre (passif : -18% de dégâts subis) — pour tenir en solo.', { requires: ['om_cele'] })
ks('om_derob', 'ombrelame', 2, 'Dérobade', 'Tu frappes depuis l\'ombre : +12% de dégâts, +30 Esquive.', { stat: { esquive: 30 }, ks: { damageMult: 1.12 } }, { requires: ['om_cele'] })
ability('om_embus', 'ombrelame', 3, 'Embuscade', 'om_embuscade', 'Débloque Embuscade : énorme nuke d\'ouverture depuis l\'ombre.', { requires: ['om_derob'] })

// Grappe LAMES (multifrappe ; atteignable depuis Génération OU Finition)
minor('om_lame', 'ombrelame', 1, 'Fil du rasoir', 3, { critique: 16 }, { requires: ['om_hub'] })
ks('om_jum', 'ombrelame', 2, 'Lames jumelles', 'LAMES : +18% de chance de Multifrappe.', { ks: { multistrike: 0.18 } }, { requires: ['om_lame'] })
ks('om_fren', 'ombrelame', 3, 'Frénésie', 'CHOIX : +26 Hâte.', { stat: { hate: 26 } }, { requires: ['om_jum'], exclusive: 'om_lames' })
ks('om_precis', 'ombrelame', 3, 'Précision', 'CHOIX : +24 Critique, +24 Dégâts crit.', { stat: { critique: 24, degatsCrit: 24 } }, { requires: ['om_jum'], exclusive: 'om_lames' })

// CONVERGENCE : exige Génération ET Finition (le carrefour des deux colonnes)
ks('om_danse', 'ombrelame', 4, 'Danse de l\'ombre', 'IDENTITÉ (carrefour) : +2 Points de Combo max et +15% de dégâts. Exige Saignée preste ET Surin mortel.', { stat: { critique: 18 }, ks: { comboCap: 2, damageMult: 1.15 } }, { requiresAll: ['om_saig', 'om_surin'], minSpent: 8 })
ability('om_linceul', 'ombrelame', 5, 'Linceul', 'om_linceul', 'ULTIME — un finisseur dévastateur enveloppe la cible d\'ombre.', { requires: ['om_danse'], minSpent: 14 })

/* ------------------------------------------------------------------ */
/* Méta de constellation.                                             */
/* ------------------------------------------------------------------ */
export const CONSTELLATIONS: Record<ConstellationId, ConstellationMeta> = {
  coeur: { id: 'coeur', name: 'Cœur & catégories', role: 'Racine', color: '#e2e8f0', icon: '✶' },
  voleur: { id: 'voleur', name: 'Voleur', role: 'Cuir · classe', color: '#a18152', icon: '🗡' },
  assassin: { id: 'assassin', name: 'Assassin', role: 'Voleur · afflictions', color: '#51cf66', icon: '☠', archetype: true },
  ombrelame: { id: 'ombrelame', name: 'Ombrelame', role: 'Voleur · combo & ombre', color: '#b197fc', icon: '🌑', archetype: true },
}
export const CONSTELLATION_LIST: ConstellationId[] = ['coeur', 'voleur', 'assassin', 'ombrelame']

/* ------------------------------------------------------------------ */
/* Accès & agrégation (API consommée par character.ts / UI).           */
/* ------------------------------------------------------------------ */
const BY_ID = new Map(TALENTS.map((t) => [t.id, t]))
export function getTalent(id: string): TalentNode | undefined { return BY_ID.get(id) }
export function talentsByConstellation(c: ConstellationId): TalentNode[] {
  return TALENTS.filter((t) => t.constellation === c).sort((a, b) => a.tier - b.tier)
}

export function talentStatMods(talents: Record<string, number>): StatBlock {
  const out: StatBlock = {}
  for (const id in talents) {
    const rank = talents[id]; const n = BY_ID.get(id)
    if (!n?.statMods || rank <= 0) continue
    for (const k in n.statMods) { const key = k as keyof StatBlock; out[key] = (out[key] ?? 0) + (n.statMods[key] ?? 0) * rank }
  }
  return out
}
export function talentResistMods(talents: Record<string, number>): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {}
  for (const id in talents) {
    const rank = talents[id]; const n = BY_ID.get(id)
    if (!n?.resistMods || rank <= 0) continue
    for (const t in n.resistMods) { const ty = t as DamageType; out[ty] = (out[ty] ?? 0) + (n.resistMods[ty] ?? 0) * rank }
  }
  return out
}
export function talentUnlockedPowers(talents: Record<string, number>): string[] {
  const out: string[] = []
  for (const id in talents) { if (talents[id] <= 0) continue; const p = BY_ID.get(id)?.unlockPower; if (p) out.push(p) }
  return out
}
export function talentKeystones(talents: Record<string, number>): KeystoneEffect[] {
  const out: KeystoneEffect[] = []
  for (const id in talents) { if (talents[id] <= 0) continue; const k = BY_ID.get(id)?.keystone; if (k) out.push(k) }
  return out
}

/* ---- Modèle d'allocation : adjacence + choix exclusif + budget. ---- */

/** Points dépensés dans une constellation (pour les portes de budget `minSpent`). */
export function spentInConstellation(talents: Record<string, number>, c: ConstellationId): number {
  let s = 0
  for (const id in talents) { if (BY_ID.get(id)?.constellation === c) s += talents[id] }
  return s
}

/** Un frère de groupe exclusif est-il déjà alloué (→ ce nœud est verrouillé) ? */
export function exclusiveBlocker(node: TalentNode, talents: Record<string, number>): TalentNode | null {
  if (!node.exclusive) return null
  for (const t of TALENTS) {
    if (t.id !== node.id && t.exclusive === node.exclusive && (talents[t.id] ?? 0) > 0) return t
  }
  return null
}

/** Réachabilité PAR ADJACENCE : voisin pris (OR), ou tous les `requiresAll` pris (convergence). */
export function isReachable(node: TalentNode, talents: Record<string, number>): boolean {
  if (node.requiresAll && node.requiresAll.length) return node.requiresAll.every((r) => (talents[r] ?? 0) > 0)
  const nb = [...(node.requires ?? []), ...(node.links ?? [])]
  if (nb.length === 0) return true
  return nb.some((r) => (talents[r] ?? 0) > 0)
}

/** Détail du verrouillage (pour l'UI). `need`/`spent` = porte de budget ; `exclusiveBlocked` = choix pris. */
export interface GateInfo {
  need: number
  spent: number
  exclusiveBlocked?: string
}
export function gateInfo(node: TalentNode, talents: Record<string, number>): GateInfo {
  const blk = exclusiveBlocker(node, talents)
  return {
    need: node.minSpent ?? 0,
    spent: node.minSpent ? spentInConstellation(talents, node.constellation) : 0,
    ...(blk ? { exclusiveBlocked: blk.name } : {}),
  }
}

export function canAllocate(node: TalentNode, talents: Record<string, number>, points: number): boolean {
  if (points <= 0) return false
  if ((talents[node.id] ?? 0) >= node.maxRank) return false
  if (!isReachable(node, talents)) return false
  if (exclusiveBlocker(node, talents)) return false
  if (node.minSpent && spentInConstellation(talents, node.constellation) < node.minSpent) return false
  return true
}
