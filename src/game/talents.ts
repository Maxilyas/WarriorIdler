import type { StatBlock } from './types'

export type TalentBranch = 'bastion' | 'tueur' | 'soigneur'

export interface TalentBranchMeta {
  id: TalentBranch
  name: string
  role: string
  color: string
  icon: string
}

export const TALENT_BRANCHES: Record<TalentBranch, TalentBranchMeta> = {
  bastion: { id: 'bastion', name: 'Bastion', role: 'Tank', color: '#4dabf7', icon: '🛡' },
  tueur: { id: 'tueur', name: 'Tueur', role: 'DPS', color: '#ff6b6b', icon: '⚔' },
  soigneur: { id: 'soigneur', name: 'Soigneur', role: 'Heal', color: '#51cf66', icon: '✚' },
}

export interface TalentNode {
  id: string
  name: string
  branch: TalentBranch
  description: string
  maxRank: number
  /** Prérequis : nœud à avoir alloué (rang ≥ 1) avant de pouvoir investir ici. */
  requires?: string
  /** Bonus de stats par rang (accumulés). */
  statMods?: StatBlock
  /** Débloque une capacité (au rang 1). */
  unlockPower?: string
}

/**
 * Arbre de talents — constellations par rôle. Data-driven : ajouter un nœud = une entrée.
 * Source des bonus de build + de capacités avancées. Les talents donnent du SENS aux stats
 * (on investit dans ce que son build veut → choix stratégique, pas "tout bourrer").
 */
export const TALENTS: TalentNode[] = [
  // --- Bastion (Tank) ---
  { id: 'bas_end1', name: 'Carrure', branch: 'bastion', description: '+40 Endurance par rang.', maxRank: 3, statMods: { endurance: 40 } },
  { id: 'bas_poly', name: 'Garde résolue', branch: 'bastion', description: '+25 Polyvalence par rang (dégâts subis réduits).', maxRank: 3, requires: 'bas_end1', statMods: { polyvalence: 25 } },
  { id: 'bas_power', name: 'Provocateur', branch: 'bastion', description: 'Débloque la capacité Rempart (menace + réduction).', maxRank: 1, requires: 'bas_end1', unlockPower: 'rempart' },
  { id: 'bas_cap', name: 'Inébranlable', branch: 'bastion', description: 'Capstone : +120 Endurance, +30 Maîtrise.', maxRank: 1, requires: 'bas_poly', statMods: { endurance: 120, maitrise: 30 } },

  // --- Tueur (DPS) ---
  { id: 'tue_crit', name: 'Précision', branch: 'tueur', description: '+30 Critique par rang.', maxRank: 3, statMods: { critique: 30 } },
  { id: 'tue_haste', name: 'Célérité', branch: 'tueur', description: '+30 Hâte par rang.', maxRank: 3, requires: 'tue_crit', statMods: { hate: 30 } },
  { id: 'tue_power', name: 'Maître d\'armes', branch: 'tueur', description: 'Débloque la capacité Tourbillon.', maxRank: 1, requires: 'tue_crit', unlockPower: 'tourbillon' },
  { id: 'tue_cap', name: 'Carnage', branch: 'tueur', description: 'Capstone : +80 Critique, +50 Maîtrise.', maxRank: 1, requires: 'tue_haste', statMods: { critique: 80, maitrise: 50 } },

  // --- Soigneur (Heal) ---
  { id: 'soi_int', name: 'Sagesse', branch: 'soigneur', description: '+40 Intelligence par rang.', maxRank: 3, statMods: { intelligence: 40 } },
  { id: 'soi_leech', name: 'Transfert vital', branch: 'soigneur', description: '+25 Vol de vie par rang.', maxRank: 3, requires: 'soi_int', statMods: { volDeVie: 25 } },
  { id: 'soi_power', name: 'Grand soin', branch: 'soigneur', description: 'Débloque la capacité Guérison majeure.', maxRank: 1, requires: 'soi_int', unlockPower: 'guerison_majeure' },
  { id: 'soi_cap', name: 'Bénédiction', branch: 'soigneur', description: 'Capstone : +100 Intelligence, +40 Maîtrise.', maxRank: 1, requires: 'soi_leech', statMods: { intelligence: 100, maitrise: 40 } },
]

const BY_ID = new Map(TALENTS.map((t) => [t.id, t]))
export function getTalent(id: string): TalentNode | undefined {
  return BY_ID.get(id)
}

export function talentsByBranch(branch: TalentBranch): TalentNode[] {
  return TALENTS.filter((t) => t.branch === branch)
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

/** Peut-on allouer un point dans ce nœud ? */
export function canAllocate(node: TalentNode, talents: Record<string, number>, points: number): boolean {
  if (points <= 0) return false
  if ((talents[node.id] ?? 0) >= node.maxRank) return false
  if (node.requires && (talents[node.requires] ?? 0) <= 0) return false
  return true
}
