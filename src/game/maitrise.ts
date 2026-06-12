/**
 * 🏛️ CONSEIL DES MAÎTRISES (v0.25, DESIGN §3) — la progression de compte TIME-GATÉE.
 *
 * Remplace la puissance achetable du Marché : 3 CONTRATS par semaine RÉELLE (fenêtres d'epoch
 * UTC, déterministes), chacun crédité automatiquement en jouant le contenu. Contrat rempli =
 * +1 Point de Maîtrise, dépensé dans un petit arbre aux bonus VOLONTAIREMENT MINIMES (~+11%
 * de combat réparti, tout maxé ≈ 19 semaines pleines). Sensible sur une année, jamais décisif.
 *
 * Les EFFETS chiffrés vivent dans computeGlobalMods (upgrades.ts) — les ids des nœuds y sont
 * couplés (frappe/vigueur/celerite/fortune/savoir/flair) : ajouter un nœud = brancher les deux.
 */

export interface MaitriseNode {
  id: string
  name: string
  icon: string
  /** Bonus par rang, en % (affichage — l'application est dans computeGlobalMods). */
  perRank: number
  maxRank: number
  desc: string
}

export const MAITRISE_NODES: MaitriseNode[] = [
  { id: 'frappe', name: 'Frappe maîtrisée', icon: '⚔️', perRank: 0.4, maxRank: 10, desc: '+0,4% de dégâts par rang.' },
  { id: 'vigueur', name: 'Vigueur', icon: '❤️', perRank: 0.5, maxRank: 10, desc: '+0,5% de PV par rang.' },
  { id: 'celerite', name: 'Célérité', icon: '⚡', perRank: 0.3, maxRank: 8, desc: "+0,3% de vitesse d'attaque par rang." },
  { id: 'fortune', name: 'Fortune', icon: '💰', perRank: 1, maxRank: 10, desc: "+1% d'or par rang." },
  { id: 'savoir', name: 'Savoir', icon: '📚', perRank: 1, maxRank: 10, desc: "+1% d'XP par rang." },
  { id: 'flair', name: 'Flair', icon: '🍀', perRank: 0.5, maxRank: 8, desc: '+0,5% de chance de butin par rang.' },
]

export function getMaitriseNode(id: string): MaitriseNode | undefined {
  return MAITRISE_NODES.find((n) => n.id === id)
}

/** Points totaux nécessaires pour TOUT maxer (≈ 19 semaines pleines à 3 pts/sem). */
export const MAITRISE_TOTAL_POINTS = MAITRISE_NODES.reduce((a, n) => a + n.maxRank, 0)

// ---- Contrats hebdomadaires ----

export type ContractId = 'donjons' | 'raids' | 'paliers'

export interface ContractDef {
  id: ContractId
  icon: string
  name: string
  label: string
  need: number
}

export const CONTRACTS: ContractDef[] = [
  { id: 'donjons', icon: '🏰', name: 'Expéditionnaire', label: 'Termine 5 donjons', need: 5 },
  { id: 'raids', icon: '☠️', name: 'Pourfendeur', label: 'Vaincs 3 raids', need: 3 },
  { id: 'paliers', icon: '⚔️', name: 'Conquérant', label: 'Gagne 15 paliers de farm', need: 15 },
]

export function getContract(id: ContractId): ContractDef {
  return CONTRACTS.find((c) => c.id === id)!
}

/** État hebdo : semaine d'epoch + compteurs + contrats déjà encaissés. */
export interface ConseilState {
  week: number
  counts: Record<ContractId, number>
  done: Record<ContractId, boolean>
}

export const WEEK_MS = 7 * 24 * 3600 * 1000

/** Semaine d'epoch UTC courante (déterministe, pas de fuseau). */
export function currentWeek(now = Date.now()): number {
  return Math.floor(now / WEEK_MS)
}

/** Temps restant (ms) avant la remise à zéro hebdomadaire. */
export function weekRemainingMs(now = Date.now()): number {
  return WEEK_MS - (now % WEEK_MS)
}

export function emptyConseil(week = currentWeek()): ConseilState {
  return {
    week,
    counts: { donjons: 0, raids: 0, paliers: 0 },
    done: { donjons: false, raids: false, paliers: false },
  }
}

/** L'état affiché/incrémenté : remis à zéro si la semaine a tourné (les Points acquis restent). */
export function conseilFresh(c: ConseilState, now = Date.now()): ConseilState {
  return c.week === currentWeek(now) ? c : emptyConseil(currentWeek(now))
}
