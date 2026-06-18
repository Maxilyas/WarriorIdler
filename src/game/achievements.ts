import type { Character } from './types'
import { RARITIES } from './rarities'
import { EQUIP_SLOTS } from './slots'
import { setBonuses } from './sets'
import { UNIQUE_EFFECTS } from './uniques'
import { CONSTELLATION } from './prestige'
import { AVATAR_PALETTES, AVATAR_EMBLEMS } from './avatar'
import { chapitreOf } from './progression'

/**
 * 🏆 HAUTS FAITS (v0.28, Lot D) — objectifs débloqués en jouant. Récompense : un TITRE (par héros)
 * + un petit bonus PERMANENT exprimé dans les mêmes catégories que le 🏛️ Conseil des Maîtrises
 * (frappe/vigueur/celerite/fortune/savoir/flair) → réutilise directement les coefficients de
 * `computeGlobalMods` (1 « rang » de haut fait = 1 rang de Maîtrise). Pas de monnaie, pas de stats
 * brutes : une progression de fond, cumulative et modeste.
 */

/** Clés de bonus = nœuds de Maîtrise (voir maitrise.ts / computeGlobalMods). */
export type AchvBonusKey = 'frappe' | 'vigueur' | 'celerite' | 'fortune' | 'savoir' | 'flair'

export type AchvCategory = 'progression' | 'stuff' | 'collection' | 'metiers' | 'combat' | 'legende'

export const ACHV_CATEGORIES: Record<AchvCategory, { name: string; icon: string; color: string }> = {
  progression: { name: 'Progression', icon: '⬆️', color: '#c084fc' },
  stuff: { name: 'Équipement', icon: '🎒', color: '#38bdf8' },
  collection: { name: 'Collection', icon: '📖', color: '#f0abfc' },
  metiers: { name: 'Métiers', icon: '🛠️', color: '#fbbf24' },
  combat: { name: 'Combat', icon: '⚔️', color: '#f87171' },
  legende: { name: 'Légende', icon: '👑', color: '#fde047' },
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
  // ---- v0.32 : étage Légende (endgame + prestige) ----
  /** Palier COURANT (≠ record) — pour les feats post-Éveil. */
  curStage: number
  /** Meilleur iLvl PORTÉ (min des 16 emplacements, 0 si un trou) — sur l'ensemble des héros. */
  maxEquippedIlvl: number
  /** Tier MONDIAL min sur les 5 raids (pousse tous les raids). */
  minRaidWorldTier: number
  /** Tier MONDIAL de l'Abîme spécifiquement. */
  abyssWorldTier: number
  /** Rangs alloués dans la Constellation (id → rang). */
  constellationAlloc: Record<string, number>
  /** Cosmétiques d'apparence (palettes/emblèmes) ACHETÉS débloqués. */
  cosmeticsUnlocked: number
  /** Pactes de rune DISTINCTS portés simultanément par l'équipe. */
  pactsEquipped: number
  /** Hauts faits déjà débloqués (pour le capstone « tout compléter »). */
  achvUnlockedCount: number
  /** Millisecondes écoulées depuis le dernier Éveil (Infinity si jamais). */
  msSincePrestige: number
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
  /** 🏅 (v0.32) Bordure d'avatar débloquée — id du registre AVATAR_BORDERS (étage Légende). */
  border?: string
  /** 🏅 (v0.32) Aura d'avatar débloquée — id du registre AVATAR_AURAS (étage Légende). */
  aura?: string
}

// ---- Constantes de l'étage Légende ----
const ILVL_CAP_FEAT = 690                 // « presque le cap 700 » sur les 16 pièces
const ABYSS_WORLD_TIER_FEAT = 14          // tréfonds de l'Abîme
const ALL_RAIDS_WORLD_TIER = 10           // grand chelem mondial
const PRESTIGE_LOOP = 10                  // 10 Éveils Primordiaux
const PACTS_FEAT = 4                      // 4 pactes distincts simultanés (sur 14)
const PERFECT_GEMS_SET = 8                // plein jeu de gemmes Parfaites
const SYNERGY_GEMS = 3                    // ≥3 gemmes Parfaites pour le combo synergie
const SYNERGY_RAID_TIER = 10              // combo synergie en raid de haut tier
const FAST_RETURN_STAGE = 300             // re-palier visé après Éveil
const FAST_RETURN_MS = 20 * 60 * 1000     // …en moins de 20 min
const PERFECT_GEM_QUALITY = 2             // 2 = Parfaite (cf. condGems.ts GEM_QUALITIES)

/** Total d'effets uniques du codex (100% = collection complète). */
const CODEX_TOTAL = UNIQUE_EFFECTS.length
/** Cosmétiques d'apparence ACHETABLES (palettes + emblèmes premium). */
const COSMETICS_TOTAL = [...AVATAR_PALETTES, ...AVATAR_EMBLEMS].filter((c) => (c.cost ?? 0) > 0).length

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

/** iLvl PORTÉ minimal (les 16 emplacements remplis) — 0 si un emplacement est vide. */
export function fullyEquippedMinIlvl(char: Character): number {
  let min = Infinity
  for (const slot of EQUIP_SLOTS) {
    const it = char.equipment[slot.id]
    if (!it) return 0
    min = Math.min(min, it.ilvl)
  }
  return min === Infinity ? 0 : min
}

/** Nombre de gemmes de qualité PARFAITE serties sur l'équipement porté. */
function perfectGemsWorn(char: Character): number {
  let n = 0
  for (const slot of EQUIP_SLOTS) {
    const gems = char.equipment[slot.id]?.gems
    if (gems) for (const g of gems) if ((g.quality ?? 1) >= PERFECT_GEM_QUALITY) n++
  }
  return n
}

/** Le héros porte-t-il au moins un effet unique actif ? */
function wearsUnique(char: Character): boolean {
  return EQUIP_SLOTS.some((s) => !!char.equipment[s.id]?.unique)
}

/** Nombre de héros entièrement parés en rareté transcendante (la plus haute). */
function fullTranscendantCount(ctx: AchvCtx): number {
  const top = RARITIES.transcendant.tier
  return ctx.characters.filter((ch) => fullyEquippedMinTier(ch) >= top).length
}

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
  { id: 'palier25', category: 'progression', icon: '⚔️', name: 'Aventurier', desc: 'Atteins le Chapitre 3.', check: (c) => c.bestStage >= 25, reward: { frappe: 1 } },
  { id: 'palier50', category: 'progression', icon: '⚔️', name: 'Vétéran', desc: 'Atteins le Chapitre 5.', check: (c) => c.bestStage >= 50, reward: { frappe: 1, vigueur: 1 }, title: 'Vétéran' },
  { id: 'palier100', category: 'progression', icon: '⚔️', name: 'Conquérant', desc: 'Atteins le Chapitre 10.', check: (c) => c.bestStage >= 100, reward: { frappe: 2, vigueur: 1 }, title: 'le Conquérant' },
  { id: 'palier150', category: 'progression', icon: '⚔️', name: 'Légende', desc: 'Atteins le Chapitre 15.', check: (c) => c.bestStage >= 150, reward: { frappe: 2, vigueur: 2 }, title: 'la Légende' },
  { id: 'palier200', category: 'progression', icon: '⚔️', name: 'Mythe vivant', desc: 'Atteins le Chapitre 20.', check: (c) => c.bestStage >= 200, reward: { frappe: 3, vigueur: 2 }, title: 'le Mythe' },
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

  // ============================================================================
  // 👑 LÉGENDE (v0.32) — l'étage endgame. Récompense = TITRE + PARURE (bordure ou
  // aura d'avatar), JAMAIS de puissance (anti-snowball v0.30). Conçus pour pousser
  // vers le très haut niveau ET la boucle de prestige (recommencer la save).
  // ============================================================================
  {
    id: 'sommetMonde', category: 'legende', icon: '👑', name: 'Au Sommet du Monde',
    desc: `Équipe un héros avec 16 pièces d'iLvl ${ILVL_CAP_FEAT} ou plus (le cap est 700).`,
    check: (c) => anyChar(c, (ch) => fullyEquippedMinIlvl(ch) >= ILVL_CAP_FEAT),
    reward: {}, title: 'le Souverain', border: 'couronne',
  },
  {
    id: 'finPaliers', category: 'legende', icon: '🗻', name: 'La Fin des Chapitres',
    desc: 'Atteins le Chapitre 80.',
    check: (c) => c.bestStage >= 800, reward: {}, title: "l'Éternel", aura: 'doree',
  },
  {
    id: 'trefondsAbime', category: 'legende', icon: '🕳️', name: "Tréfonds de l'Abîme",
    desc: `Atteins le tier mondial ${ABYSS_WORLD_TIER_FEAT} dans l'Abîme Primordial.`,
    check: (c) => c.abyssWorldTier >= ABYSS_WORLD_TIER_FEAT, reward: {}, title: 'des Tréfonds', aura: 'abyssale',
  },
  {
    id: 'briseurMondes', category: 'legende', icon: '🌍', name: 'Briseur de Mondes',
    desc: `Atteins le tier mondial ${ALL_RAIDS_WORLD_TIER} sur LES 5 raids.`,
    check: (c) => c.minRaidWorldTier >= ALL_RAIDS_WORLD_TIER, reward: {}, title: 'le Briseur de Mondes', border: 'fracture',
  },
  {
    id: 'cycleEternel', category: 'legende', icon: '♾️', name: 'Le Cycle Éternel',
    desc: `Accomplis ${PRESTIGE_LOOP} Éveils Primordiaux.`,
    check: (c) => c.prestigeRank >= PRESTIGE_LOOP, reward: {}, title: "l'Ouroboros", aura: 'primordiale',
  },
  {
    id: 'constellationMax', category: 'legende', icon: '🌌', name: 'Constellation Achevée',
    desc: 'Porte tous les nœuds de la Constellation à leur rang maximal.',
    check: (c) => CONSTELLATION.every((n) => (c.constellationAlloc[n.id] ?? 0) >= n.maxRank),
    reward: {}, title: "l'Astre Premier", border: 'constellation',
  },
  {
    id: 'polymatheAbsolu', category: 'legende', icon: '🛠️', name: 'Polymathe Absolu',
    desc: 'Monte les 4 métiers au niveau 50 (le maximum).',
    check: (c) => c.metierMinLevel >= 50, reward: {}, title: 'le Grand Œuvre', border: 'runique',
  },
  {
    id: 'codexComplet', category: 'legende', icon: '📚', name: 'Codex Complet',
    desc: `Découvre les ${CODEX_TOTAL} effets uniques du jeu.`,
    check: (c) => c.uniquesDiscovered >= CODEX_TOTAL, reward: {}, title: "l'Omniscient", aura: 'arcane',
  },
  {
    id: 'maitreSynergies', category: 'legende', icon: '🔗', name: 'Maître des Synergies',
    desc: `Atteins le tier mondial ${SYNERGY_RAID_TIER} en raid avec un héros portant un set complet, ${SYNERGY_GEMS} gemmes Parfaites et un effet unique.`,
    check: (c) => c.bestRaidTier >= SYNERGY_RAID_TIER && anyChar(c, (ch) => wornFullSet(ch) && perfectGemsWorn(ch) >= SYNERGY_GEMS && wearsUnique(ch)),
    reward: {}, title: "l'Architecte", border: 'gemmee',
  },
  {
    id: 'joaillierSupreme', category: 'legende', icon: '💎', name: 'Joaillier Suprême',
    desc: `Sertis simultanément ${PERFECT_GEMS_SET} gemmes Parfaites sur un seul héros.`,
    check: (c) => anyChar(c, (ch) => perfectGemsWorn(ch) >= PERFECT_GEMS_SET), reward: {}, title: 'le Lapidaire', aura: 'prismatique',
  },
  {
    id: 'pacteTotal', category: 'legende', icon: '📜', name: 'Pacte Total',
    desc: `Porte simultanément ${PACTS_FEAT} Pactes de rune différents sur ton équipe.`,
    check: (c) => c.pactsEquipped >= PACTS_FEAT, reward: {}, title: 'le Runescribe', border: 'pactes',
  },
  {
    id: 'triade', category: 'legende', icon: '👥', name: 'Trois Héros, Un Destin',
    desc: 'Possède 3 héros entièrement parés en rareté transcendante.',
    check: (c) => fullTranscendantCount(c) >= 3, reward: {}, title: 'la Triade', border: 'triade',
  },
  {
    id: 'gardeRobeCosmique', category: 'legende', icon: '🎨', name: 'Garde-Robe Cosmique',
    desc: 'Débloque tous les cosmétiques d\'apparence premium.',
    check: (c) => c.cosmeticsUnlocked >= COSMETICS_TOTAL, reward: {}, title: "l'Esthète", aura: 'arcenciel',
  },
  {
    id: 'renaissanceFulgurante', category: 'legende', icon: '🔥', name: 'Renaissance Fulgurante',
    desc: `Après un Éveil, re-atteins le Chapitre ${chapitreOf(FAST_RETURN_STAGE)} en moins de 20 minutes.`,
    check: (c) => c.prestigeRank >= 1 && c.curStage >= FAST_RETURN_STAGE && c.msSincePrestige <= FAST_RETURN_MS,
    reward: {}, title: 'le Phénix', aura: 'flamme',
  },
  {
    id: 'apotheose', category: 'legende', icon: '✨', name: "L'Apothéose",
    desc: 'Débloque TOUS les autres hauts faits du jeu.',
    check: (c) => c.achvUnlockedCount >= ACHIEVEMENTS.length - 1, reward: {}, title: "l'Élu", aura: 'primordialePlus',
  },
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

/** Parures débloquées (bordures/auras) par haut fait obtenu — pour le sélecteur d'apparence. */
export function unlockedCosmetics(unlocked: Record<string, true>): { borders: string[]; auras: string[] } {
  const borders: string[] = []
  const auras: string[] = []
  for (const a of ACHIEVEMENTS) {
    if (!unlocked[a.id]) continue
    if (a.border) borders.push(a.border)
    if (a.aura) auras.push(a.aura)
  }
  return { borders, auras }
}
