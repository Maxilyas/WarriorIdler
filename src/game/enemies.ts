import type { Enemy, DamageType } from './types'
import { DAMAGE_TYPE_LIST } from './damage'

const ENEMY_NAMES = [
  'Gobelin pillard', 'Loup affamé', 'Squelette rouillé', 'Bandit de grand chemin',
  'Araignée venimeuse', 'Ogre des cavernes', 'Goule putride', 'Cultiste masqué',
  'Golem de pierre', 'Wyrm des cendres', 'Spectre hurlant', 'Démon mineur',
]

const BOSS_NAMES = [
  'Seigneur Mortepierre', 'Vrakthul l\'Insatiable', 'La Veuve d\'Ébène',
  'Korgath le Briseur', 'Néfarius l\'Éternel', 'L\'Avatar du Néant',
]

/**
 * Traits déterministes (texture du combat classique, pas d'aléatoire d'un run à l'autre).
 * Apparaissent sur certains paliers et **cyclent** → on peut s'adapter (penetration vs Blindé…).
 */
interface EnemyTrait {
  id: string
  name: string
  hpMult?: number
  dmgMult?: number
  armorMult?: number
}
const TRAITS: EnemyTrait[] = [
  { id: 'blinde', name: 'Blindé', armorMult: 2.6 }, // la Pénétration aide
  { id: 'feroce', name: 'Féroce', dmgMult: 1.35 },
  { id: 'massif', name: 'Massif', hpMult: 1.6 },
  { id: 'coriace', name: 'Coriace', hpMult: 1.3, armorMult: 1.6 },
  { id: 'enrage', name: 'Enragé', dmgMult: 1.2, hpMult: 1.2 },
]

/** Palier à partir duquel les ennemis gagnent une résistance globale croissante. */
const RESIST_RAMP_FROM = 25
const RESIST_RAMP_PER_STAGE = 0.004
const RESIST_RAMP_CAP = 0.55
/** Élite tous les N paliers (hors boss) : stats accrues + meilleur butin. */
const ELITE_EVERY = 7

/** Résistance globale (tous types) d'un palier — croît linéairement, contrée par la Pénétration. */
export function stageResistRamp(stage: number): number {
  if (stage < RESIST_RAMP_FROM) return 0
  return Math.min(RESIST_RAMP_CAP, (stage - RESIST_RAMP_FROM) * RESIST_RAMP_PER_STAGE)
}

/** Crée l'ennemi correspondant à un palier (stage). Boss tous les 10 paliers. */
export function makeEnemy(stage: number): Enemy {
  const isBoss = stage % 10 === 0
  const isElite = !isBoss && stage % ELITE_EVERY === 0 && stage > ELITE_EVERY
  // Trait déterministe sur certains paliers (cycle), hors boss/élite.
  const trait = !isBoss && !isElite && stage % 3 === 0 ? TRAITS[Math.floor(stage / 3) % TRAITS.length] : undefined

  const hpMult = (isElite ? 2.2 : 1) * (trait?.hpMult ?? 1)
  const dmgMult = (isElite ? 1.4 : 1) * (trait?.dmgMult ?? 1)
  const armorMult = trait?.armorMult ?? 1

  // Croissance exponentielle douce du HP (réduite : moins de "sacs à PV"). Boss un peu moins gonflés.
  const hpBase = 40 * Math.pow(1.17, stage - 1)
  const maxHp = Math.round(hpBase * (isBoss ? 5 : 1) * hpMult)
  const baseName = isBoss
    ? BOSS_NAMES[Math.floor((stage / 10 - 1) % BOSS_NAMES.length)]
    : ENEMY_NAMES[(stage - 1) % ENEMY_NAMES.length]
  const name = isBoss ? `★ ${baseName}` : isElite ? `◆ ${baseName} d'élite` : trait ? `${baseName} ${trait.name.toLowerCase()}` : baseName

  // Résistance GLOBALE (tous types identiques) → difficulté monotone, la Pénétration la contre.
  const ramp = stageResistRamp(stage)
  const resist: Partial<Record<DamageType, number>> = {}
  if (ramp > 0) for (const t of DAMAGE_TYPE_LIST) resist[t] = ramp

  // Type d'attaque : cycle déterministe (les résistances héros restent un bonus pur).
  const damageType: DamageType = DAMAGE_TYPE_LIST[stage % DAMAGE_TYPE_LIST.length]

  return {
    name,
    maxHp,
    hp: maxHp,
    armor: Math.round(stage * 1.5 * armorMult),
    // Dégâts un peu plus mordants (la survie / les résistances doivent compter).
    damage: Math.round(2.6 * Math.pow(1.125, stage - 1) * (isBoss ? 1.8 : 1) * dmgMult),
    xp: Math.round((isBoss ? 50 : isElite ? 22 : 8) * Math.pow(1.12, stage - 1)),
    resist,
    damageType,
    ...(trait ? { trait: trait.name } : isElite ? { trait: 'Élite' } : {}),
    ...(isElite ? { elite: true } : {}),
  }
}

export function isBossStage(stage: number): boolean {
  return stage % 10 === 0
}

/** ilvl de loot attendu pour un palier. */
export function stageIlvl(stage: number): number {
  return Math.max(1, Math.round(stage * 1.5))
}

/** Décalage de chance de rareté selon le palier atteint. */
export function stageLuckTier(stage: number): number {
  return Math.floor(stage / 8)
}
