import type { Equipment, ItemType } from './types'

/**
 * SETS D'ÉQUIPEMENT — pièces nommées, exclusives à un contenu précis, dont le
 * PORT GROUPÉ octroie des bonus à seuils (2/4/6 pièces) volontairement énormes :
 * c'est la chasse d'endgame par excellence (l'Abîme Primordial drop le premier set).
 * Les bonus sont multiplicatifs/additifs au niveau du MOTEUR (dégâts, PV, recharge,
 * résistances, vol de vie) — pas de simples ratings.
 */

export interface SetBonusTier {
  pieces: number
  desc: string
  /** Multiplicateur de dégâts global (auto-attaques + sorts). */
  damageMult?: number
  /** Multiplicateur de PV max. */
  hpMult?: number
  /** Réduction de recharge additionnelle (additive au cdr, capée par le moteur). */
  cdr?: number
  /** Résistance à TOUS les types (fraction ; ×100 → points à l'agrégation). */
  resistAll?: number
  /** Vol de vie plat (fraction des dégâts). */
  leech?: number
}

export interface SetDef {
  id: string
  name: string
  icon: string
  color: string
  /** Pièces du set : type d'objet → nom de la pièce. */
  pieces: Partial<Record<ItemType, string>>
  bonuses: SetBonusTier[]
}

export const SETS: Record<string, SetDef> = {
  neant: {
    id: 'neant', name: 'Régalia du Néant', icon: '🕳️', color: '#8a2be2',
    pieces: {
      tete: 'Couronne du Néant',
      epaules: 'Mantelet du Néant',
      torse: 'Cuirasse du Néant',
      mains: 'Poignes du Néant',
      jambes: 'Tassettes du Néant',
      armePrincipale: 'Faux du Néant',
    },
    bonuses: [
      { pieces: 2, desc: '+10% dégâts et +10% PV', damageMult: 1.10, hpMult: 1.10 },
      { pieces: 4, desc: '−20% de recharge des capacités et +20% PV', cdr: 0.20, hpMult: 1.20 },
      { pieces: 6, desc: 'Cœur du Néant : +50% dégâts, +25% résistance à TOUT, 10% de vol de vie', damageMult: 1.50, resistAll: 0.25, leech: 0.10 },
    ],
  },
}

export const SET_LIST: SetDef[] = Object.values(SETS)

export function getSet(id: string): SetDef | undefined {
  return SETS[id]
}

export interface ActiveSetBonuses {
  damageMult: number
  hpMult: number
  cdr: number
  resistAll: number
  leech: number
  /** Pièces équipées par set (pour l'affichage). */
  counts: Record<string, number>
}

/** Agrège les bonus de set actifs d'un équipement (seuils cumulatifs, comme WoW). */
export function setBonuses(equipment: Equipment): ActiveSetBonuses {
  const counts: Record<string, number> = {}
  for (const slot in equipment) {
    const it = equipment[slot as keyof Equipment]
    if (it?.setId) counts[it.setId] = (counts[it.setId] ?? 0) + 1
  }
  const out: ActiveSetBonuses = { damageMult: 1, hpMult: 1, cdr: 0, resistAll: 0, leech: 0, counts }
  for (const id in counts) {
    const def = SETS[id]
    if (!def) continue
    for (const b of def.bonuses) {
      if (counts[id] < b.pieces) continue
      if (b.damageMult) out.damageMult *= b.damageMult
      if (b.hpMult) out.hpMult *= b.hpMult
      if (b.cdr) out.cdr += b.cdr
      if (b.resistAll) out.resistAll += b.resistAll
      if (b.leech) out.leech += b.leech
    }
  }
  return out
}
