import type { Character } from './types'
import { RARITIES } from './rarities'
import { EQUIP_SLOTS } from './slots'
import { setBonuses } from './sets'

/**
 * 🏆 HAUTS FAITS (v0.28, Lot D) — objectifs débloqués en jouant. Récompense : un TITRE (par héros)
 * + un petit bonus PERMANENT exprimé dans les mêmes catégories que le 🏛️ Conseil des Maîtrises
 * (frappe/vigueur/celerite/fortune/savoir/flair) → réutilise directement les coefficients de
 * `computeGlobalMods` (1 « rang » de haut fait = 1 rang de Maîtrise). Pas de monnaie, pas de stats
 * brutes : une progression de fond, cumulative et modeste.
 */

/** Clés de bonus = nœuds de Maîtrise (voir maitrise.ts / computeGlobalMods). */
export type AchvBonusKey = 'frappe' | 'vigueur' | 'celerite' | 'fortune' | 'savoir' | 'flair'

export type AchvCategory = 'progression' | 'stuff' | 'collection' | 'metiers' | 'combat'

export const ACHV_CATEGORIES: Record<AchvCategory, { name: string; icon: string; color: string }> = {
  progression: { name: 'Progression', icon: '⬆️', color: '#c084fc' },
  stuff: { name: 'Équipement', icon: '🎒', color: '#38bdf8' },
  collection: { name: 'Collection', icon: '📖', color: '#f0abfc' },
  metiers: { name: 'Métiers', icon: '🛠️', color: '#fbbf24' },
  combat: { name: 'Combat', icon: '⚔️', color: '#f87171' },
}

/** Contexte d'évaluation — un instantané léger construit par le store (zéro import du store ici). */
export interface AchvCtx {
  bestStage: number
  maxLevel: number
  prestigeRank: number
  bestRaidTier: number
  dungeonLevels: number
  uniquesDiscovered: number
  metierMaxLevel: number
  metierMinLevel: number
  characters: Character[]
}

export interface AchievementDef {
  id: string
  name: string
  desc: string
  icon: string
  category: AchvCategory
  /** Condition de déblocage. */
  check: (c: AchvCtx) => boolean
  /** Bonus permanent (rangs façon Maîtrise) crédité tant que le haut fait est débloqué. */
  reward: Partial<Record<AchvBonusKey, number>>
  /** Titre affichable sous le nom du héros (jalons uniquement). */
  title?: string
}

/** Rareté minimale PORTÉE (les 16 emplacements remplis) — 0 si un emplacement est vide. */
export function fullyEquippedMinTier(char: Character): number {
  let min = Infinity
  for (const slot of EQUIP_SLOTS) {
    const it = char.equipment[slot.id]
    if (!it) return 0
    min = Math.min(min, RARITIES[it.rarity].tier)
  }
  return min === Infinity ? 0 : min
}

/** Un set est-il PORTÉ au complet (toutes ses pièces) par ce héros ? */
function wornFullSet(char: Character): boolean {
  const counts = setBonuses(char.equipment).counts
  // setBonuses ne connaît pas le total ; on considère « complet » dès le plus haut palier (6+).
  return Object.values(counts).some((n) => n >= 6)
}

const anyChar = (ctx: AchvCtx, pred: (c: Character) => boolean) => ctx.characters.some(pred)

/** Famille « full équipé en rareté ≥ X » (le « full équipé de chaque niveau » demandé). */
function fullEquipAchv(id: string, rarityId: keyof typeof RARITIES, reward: Partial<Record<AchvBonusKey, number>>, title?: string): AchievementDef {
  const r = RARITIES[rarityId]
  return {
    id, category: 'stuff', icon: '🛡️', title,
    name: `Paré de ${r.name}`,
    desc: `Équipe un héros avec 16 pièces de rareté ${r.name} ou mieux.`,
    check: (c) => anyChar(c, (ch) => fullyEquippedMinTier(ch) >= r.tier),
    reward,
  }
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---- Progression ----
  { id: 'palier25', category: 'progression', icon: '⚔️', name: 'Aventurier', desc: 'Atteins le palier 25.', check: (c) => c.bestStage >= 25, reward: { frappe: 1 } },
  { id: 'palier50', category: 'progression', icon: '⚔️', name: 'Vétéran', desc: 'Atteins le palier 50.', check: (c) => c.bestStage >= 50, reward: { frappe: 1, vigueur: 1 }, title: 'Vétéran' },
  { id: 'palier100', category: 'progression', icon: '⚔️', name: 'Conquérant', desc: 'Atteins le palier 100.', check: (c) => c.bestStage >= 100, reward: { frappe: 2, vigueur: 1 }, title: 'le Conquérant' },
  { id: 'palier150', category: 'progression', icon: '⚔️', name: 'Légende', desc: 'Atteins le palier 150.', check: (c) => c.bestStage >= 150, reward: { frappe: 2, vigueur: 2 }, title: 'la Légende' },
  { id: 'palier200', category: 'progression', icon: '⚔️', name: 'Mythe vivant', desc: 'Atteins le palier 200.', check: (c) => c.bestStage >= 200, reward: { frappe: 3, vigueur: 2 }, title: 'le Mythe' },
  { id: 'niveau25', category: 'progression', icon: '🌟', name: 'Aguerri', desc: 'Monte un héros au niveau 25.', check: (c) => c.maxLevel >= 25, reward: { savoir: 1 } },
  { id: 'niveau50', category: 'progression', icon: '🌟', name: 'Maître de soi', desc: 'Monte un héros au niveau 50.', check: (c) => c.maxLevel >= 50, reward: { savoir: 2 } },
  { id: 'prestige1', category: 'progression', icon: '✨', name: 'Renaissance', desc: 'Accomplis un premier Éveil Primordial.', check: (c) => c.prestigeRank >= 1, reward: { frappe: 1, savoir: 1 }, title: "l'Éveillé" },
  { id: 'prestige3', category: 'progression', icon: '✨', name: 'Cycle éternel', desc: 'Atteins le rang de prestige 3.', check: (c) => c.prestigeRank >= 3, reward: { frappe: 2, vigueur: 1 }, title: "l'Immortel" },

  // ---- Équipement (full équipé de chaque niveau) ----
  {
    id: 'fullEquip', category: 'stuff', icon: '🎽', name: 'Tout équipé',
    desc: 'Remplis les 16 emplacements d\'équipement d\'un héros.',
    check: (c) => anyChar(c, (ch) => fullyEquippedMinTier(ch) >= 1), reward: { vigueur: 1 },
  },
  fullEquipAchv('fullRare', 'rare', { frappe: 1, vigueur: 1 }),
  fullEquipAchv('fullEpique', 'epique', { frappe: 1, vigueur: 1 }, 'le Paré'),
  fullEquipAchv('fullLegendaire', 'legendaire', { frappe: 2, vigueur: 1 }, "l'Orné"),
  fullEquipAchv('fullMythique', 'mythique', { frappe: 2, vigueur: 2 }, 'le Mythique'),
  fullEquipAchv('fullCosmique', 'cosmique', { frappe: 3, vigueur: 2 }, 'le Cosmique'),
  fullEquipAchv('fullTranscendant', 'transcendant', { frappe: 3, vigueur: 3 }, 'le Transcendant'),
  {
    id: 'setComplet', category: 'stuff', icon: '⬢', name: 'Régalia',
    desc: 'Porte un set d\'équipement au complet.',
    check: (c) => anyChar(c, wornFullSet), reward: { frappe: 2, vigueur: 2 }, title: 'le Régalien',
  },

  // ---- Collection ----
  { id: 'uniq1', category: 'collection', icon: '✦', name: 'Première âme', desc: 'Découvre un effet unique.', check: (c) => c.uniquesDiscovered >= 1, reward: { flair: 1 } },
  { id: 'uniq10', category: 'collection', icon: '✦', name: 'Collectionneur', desc: 'Découvre 10 effets uniques.', check: (c) => c.uniquesDiscovered >= 10, reward: { flair: 2 } },
  { id: 'uniq30', category: 'collection', icon: '✦', name: 'Archiviste', desc: 'Découvre 30 effets uniques.', check: (c) => c.uniquesDiscovered >= 30, reward: { flair: 2, fortune: 1 }, title: "l'Archiviste" },
  { id: 'uniq60', category: 'collection', icon: '✦', name: 'Conservateur', desc: 'Découvre 60 effets uniques.', check: (c) => c.uniquesDiscovered >= 60, reward: { flair: 3, fortune: 1 }, title: 'le Conservateur' },

  // ---- Métiers ----
  { id: 'metier25', category: 'metiers', icon: '🛠️', name: 'Artisan', desc: 'Monte un métier au niveau 25.', check: (c) => c.metierMaxLevel >= 25, reward: { fortune: 1 } },
  { id: 'metier50', category: 'metiers', icon: '🛠️', name: 'Maître artisan', desc: 'Monte un métier au niveau 50.', check: (c) => c.metierMaxLevel >= 50, reward: { fortune: 2 }, title: "le Maître artisan" },
  { id: 'metiersAll10', category: 'metiers', icon: '🧰', name: 'Touche-à-tout', desc: 'Monte les 4 métiers au niveau 10.', check: (c) => c.metierMinLevel >= 10, reward: { fortune: 1, savoir: 1 } },
  { id: 'metiersAll25', category: 'metiers', icon: '🧰', name: 'Polymathe', desc: 'Monte les 4 métiers au niveau 25.', check: (c) => c.metierMinLevel >= 25, reward: { fortune: 2, savoir: 1 }, title: 'le Polymathe' },

  // ---- Combat ----
  { id: 'raid1', category: 'combat', icon: '☠️', name: 'Pourfendeur', desc: 'Vaincs un raid (tier 1).', check: (c) => c.bestRaidTier >= 1, reward: { frappe: 1 } },
  { id: 'raid4', category: 'combat', icon: '☠️', name: 'Briseur de raids', desc: 'Atteins le tier 4 en raid.', check: (c) => c.bestRaidTier >= 4, reward: { frappe: 2 }, title: 'le Briseur' },
  { id: 'raid7', category: 'combat', icon: '🕳️', name: 'Plongeur de l\'Abîme', desc: 'Atteins le tier 7 en raid (accès Abîme).', check: (c) => c.bestRaidTier >= 7, reward: { frappe: 3, vigueur: 2 }, title: "de l'Abîme" },
  { id: 'dungeon', category: 'combat', icon: '🏰', name: 'Explorateur', desc: 'Progresse dans les donjons-ressource.', check: (c) => c.dungeonLevels >= 10, reward: { celerite: 1 } },
]

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
export function getAchievement(id: string): AchievementDef | undefined {
  return BY_ID.get(id)
}

/** Somme des bonus (rangs façon Maîtrise) des hauts faits débloqués. */
export function achievementBonuses(unlocked: Record<string, true>): Partial<Record<AchvBonusKey, number>> {
  const out: Partial<Record<AchvBonusKey, number>> = {}
  for (const id in unlocked) {
    const def = BY_ID.get(id)
    if (!def) continue
    for (const k in def.reward) {
      const key = k as AchvBonusKey
      out[key] = (out[key] ?? 0) + (def.reward[key] ?? 0)
    }
  }
  return out
}

/** Ids des hauts faits désormais satisfaits mais pas encore débloqués. */
export function evaluateNewAchievements(ctx: AchvCtx, unlocked: Record<string, true>): string[] {
  const fresh: string[] = []
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue
    try {
      if (a.check(ctx)) fresh.push(a.id)
    } catch {
      /* check défensif : un haut fait ne doit jamais casser le tick */
    }
  }
  return fresh
}

/** Titres débloqués (pour le sélecteur) : id de haut fait → libellé du titre. */
export function unlockedTitles(unlocked: Record<string, true>): { id: string; title: string }[] {
  return ACHIEVEMENTS.filter((a) => a.title && unlocked[a.id]).map((a) => ({ id: a.id, title: a.title! }))
}
