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

/** Crée l'ennemi correspondant à un palier (stage). Boss tous les 10 paliers. */
export function makeEnemy(stage: number): Enemy {
  const isBoss = stage % 10 === 0
  // Croissance exponentielle douce du HP.
  const hpBase = 40 * Math.pow(1.18, stage - 1)
  const maxHp = Math.round(hpBase * (isBoss ? 6 : 1))
  const name = isBoss
    ? BOSS_NAMES[Math.floor((stage / 10 - 1) % BOSS_NAMES.length)]
    : ENEMY_NAMES[(stage - 1) % ENEMY_NAMES.length]

  // Résistances déterministes par palier : un type résisté, un type vulnérable.
  const n = DAMAGE_TYPE_LIST.length
  const resistedType: DamageType = DAMAGE_TYPE_LIST[stage % n]
  const vulnType: DamageType = DAMAGE_TYPE_LIST[(stage + 3) % n]
  const resist: Partial<Record<DamageType, number>> = {
    [resistedType]: isBoss ? 0.4 : 0.2,
    [vulnType]: isBoss ? -0.15 : -0.2,
  }

  return {
    name: isBoss ? `★ ${name}` : name,
    maxHp,
    hp: maxHp,
    armor: Math.round(stage * 1.5),
    damage: Math.round(2.5 * Math.pow(1.12, stage - 1) * (isBoss ? 1.8 : 1)),
    xp: Math.round((isBoss ? 50 : 8) * Math.pow(1.12, stage - 1)),
    resist,
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
