import type { DamageType, Enemy } from './types'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES } from './damage'

// ---- Modificateurs (style Mythique+) ----

export interface DungeonModifier {
  id: string
  name: string
  description: string
  // --- effets statiques (à la création de l'ennemi) ---
  hpMult?: number
  armorMult?: number
  resistBonus?: number // ajouté à toutes les résistances
  xpMult?: number
  immunity?: 'physique' | 'elements' | 'random'
  // --- effets économiques (au coffre) ---
  noGold?: boolean
  rareBonus?: number // bonus de luckTier au butin
  // --- effets dynamiques (gérés au tick) ---
  enrageRampPerSec?: number // +fraction de dégâts ennemis / seconde
  reflectPct?: number // % des dégâts infligés renvoyés au joueur
  regenPct?: number // % des PV max régénérés / seconde par l'ennemi
}

/** Pool de modificateurs jouables avec le moteur actuel (extensible). */
export const DUNGEON_MODIFIERS: DungeonModifier[] = [
  { id: 'colossal', name: 'Colossal', description: '+40% de PV des ennemis.', hpMult: 1.4 },
  { id: 'blinde', name: 'Blindé', description: 'Armure doublée, +15% de résistances.', armorMult: 2, resistBonus: 0.15 },
  { id: 'enrage', name: 'Enragé', description: 'Les ennemis frappent de plus en plus fort avec le temps.', enrageRampPerSec: 0.08 },
  { id: 'reflectif', name: 'Réfléchissant', description: 'Renvoie 15% des dégâts que tu infliges.', reflectPct: 0.15 },
  { id: 'vampirique', name: 'Vampirique', description: 'Les ennemis régénèrent leur vie (3%/s).', regenPct: 0.03 },
  { id: 'erudit', name: 'Érudit', description: '+100% XP, mais ennemis plus coriaces.', xpMult: 2, hpMult: 1.5 },
  { id: 'avare', name: 'Avare', description: 'Aucun or, mais davantage d\'objets rares.', noGold: true, rareBonus: 1 },
  { id: 'polarise', name: 'Polarisé', description: 'Forte résistance (-65%) au Physique OU aux éléments.', immunity: 'random' },
]

/** Résistance appliquée par Polarisé (au lieu d'une immunité totale, trop punitive). */
const POLARISE_RESIST = 0.65

// ---- Donjon actif ----

export interface ActiveDungeon {
  level: number
  name: string
  theme: DamageType
  vuln: DamageType
  modifiers: DungeonModifier[]
  totalFights: number
  current: number // index du combat en cours (0-based)
  enemy: Enemy
  fightTime: number // temps écoulé sur le combat courant (pour Enragé)
}

const ELEMENTS: DamageType[] = DAMAGE_TYPE_LIST.filter((t) => t !== 'physique')

const DUNGEON_NAMES: Record<DamageType, string> = {
  physique: 'Arène de pierre',
  feu: 'Fournaise ardente',
  froid: 'Caveau de givre',
  foudre: 'Nexus orageux',
  arcane: 'Sanctuaire arcanique',
  ombre: 'Crypte des ombres',
  nature: 'Bosquet corrompu',
}

const ENEMY_NAMES = ['Sentinelle', 'Aberration', 'Gardien', 'Cultiste', 'Revenant', 'Colosse', 'Spectre', 'Traqueur']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Nombre de combats d'un donjon de niveau N. */
export function dungeonFights(level: number): number {
  return 4 + level
}

/** ilvl du butin du coffre (en avance sur le farm normal pour récompenser le défi). */
export function dungeonIlvl(level: number): number {
  return Math.round(10 + level * 12)
}

/** Décalage de chance de rareté du coffre (généreux). */
export function dungeonLuckTier(level: number): number {
  return 2 + Math.floor(level / 2)
}

// Constantes d'équilibrage des donjons (à ajuster facilement).
const DUNGEON_HP_PREMIUM = 1.7 // PV des ennemis vs le farm de difficulté équivalente
const DUNGEON_DMG_PREMIUM = 1.4 // dégâts des ennemis vs farm équivalent
const EFF_STAGE_PER_LEVEL = 7 // un niveau de donjon ≈ ce ncombre de paliers de farm

/** Construit l'ennemi d'un combat de donjon. */
export function makeDungeonEnemy(
  level: number,
  fightIndex: number,
  totalFights: number,
  theme: DamageType,
  vuln: DamageType,
  modifiers: DungeonModifier[],
): Enemy {
  const isBoss = fightIndex === totalFights - 1
  let hpMult = 1
  let armorMult = 1
  let resistBonus = 0
  let xpMult = 1
  let immunity: 'physique' | 'elements' | undefined
  for (const m of modifiers) {
    if (m.hpMult) hpMult *= m.hpMult
    if (m.armorMult) armorMult *= m.armorMult
    if (m.resistBonus) resistBonus += m.resistBonus
    if (m.xpMult) xpMult *= m.xpMult
    if (m.immunity === 'physique' || m.immunity === 'elements') immunity = m.immunity
  }

  // Difficulté calée sur la courbe du farm (que le joueur connaît) + une prime de donjon.
  const effStage = level * EFF_STAGE_PER_LEVEL + fightIndex
  const hpBase = 40 * Math.pow(1.18, effStage - 1) * DUNGEON_HP_PREMIUM
  const maxHp = Math.round(hpBase * (isBoss ? 7 : 1) * hpMult)

  // Résistances : thème FORT (force à adapter son stuff), vulnérabilité marquée.
  const resist: Partial<Record<DamageType, number>> = {}
  if (resistBonus) for (const t of DAMAGE_TYPE_LIST) resist[t] = resistBonus
  resist[theme] = (resist[theme] ?? 0) + (isBoss ? 0.6 : 0.5)
  resist[vuln] = (resist[vuln] ?? 0) - 0.35
  if (immunity === 'physique') resist.physique = Math.max(resist.physique ?? 0, POLARISE_RESIST)
  else if (immunity === 'elements') for (const t of ELEMENTS) resist[t] = Math.max(resist[t] ?? 0, POLARISE_RESIST)

  const name = `${pick(ENEMY_NAMES)} ${DAMAGE_TYPES[theme].name.toLowerCase()}`

  return {
    name: isBoss ? `★ ${name}` : name,
    maxHp,
    hp: maxHp,
    armor: Math.round((10 + effStage * 1.5) * armorMult),
    damage: Math.round(2.5 * Math.pow(1.12, effStage - 1) * DUNGEON_DMG_PREMIUM * (isBoss ? 1.8 : 1)),
    xp: Math.round(8 * Math.pow(1.12, effStage - 1) * (isBoss ? 5 : 1) * xpMult),
    resist,
  }
}

/** Thème élémentaire (déterministe) d'un niveau de donjon. */
export function dungeonTheme(level: number): { theme: DamageType; vuln: DamageType } {
  return {
    theme: ELEMENTS[level % ELEMENTS.length],
    vuln: ELEMENTS[(level + 2) % ELEMENTS.length],
  }
}

/** Génère un donjon prêt à jouer pour un niveau donné. */
export function generateDungeon(level: number): ActiveDungeon {
  const { theme, vuln } = dungeonTheme(level)
  const totalFights = dungeonFights(level)

  // 1 modificateur, +1 à partir du niveau 3.
  const count = level >= 3 ? 2 : 1
  const pool = [...DUNGEON_MODIFIERS]
  const modifiers: DungeonModifier[] = []
  for (let i = 0; i < count && pool.length; i++) {
    const m = { ...pool.splice(Math.floor(Math.random() * pool.length), 1)[0] }
    if (m.immunity === 'random') m.immunity = Math.random() < 0.5 ? 'physique' : 'elements'
    modifiers.push(m)
  }

  return {
    level,
    name: `${DUNGEON_NAMES[theme]} · Niv. ${level}`,
    theme,
    vuln,
    modifiers,
    totalFights,
    current: 0,
    enemy: makeDungeonEnemy(level, 0, totalFights, theme, vuln, modifiers),
    fightTime: 0,
  }
}
