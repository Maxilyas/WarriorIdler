import type { DamageType, Enemy } from './types'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES } from './damage'

// ---- Mécaniques de boss (checks auto-résolus) ----

export type RaidMechanicKind = 'carapace' | 'nova' | 'enrage' | 'drain' | 'adds'

export interface RaidMechanic {
  kind: RaidMechanicKind
  name: string
  description: string
  value: number
  cooldown?: number
  type?: DamageType // pour Carapace
}

/** Palier requis pour débloquer les raids. */
export const RAID_UNLOCK_STAGE = 50

// Constantes d'équilibrage (à ajuster facilement).
const RAID_HP_PREMIUM = 1.8
const RAID_BOSS_MULT = 3.5
const RAID_DMG_PREMIUM = 1.5
const EFF_STAGE_BASE = 40
const EFF_STAGE_PER_LEVEL = 14

const ELEMENTS: DamageType[] = DAMAGE_TYPE_LIST.filter((t) => t !== 'physique')

const BOSS_NAMES = [
  'Vorathul, l\'Effroi', 'La Dévoreuse d\'Étoiles', 'Kruul le Cataclysme', 'L\'Augure du Néant',
  'Xanthys aux Mille Yeux', 'Le Colosse Primordial', 'Néroth, Roi Déchu', 'L\'Hydre des Abysses',
]

export interface ActiveRaid {
  level: number
  name: string
  theme: DamageType
  vuln: DamageType
  totalBosses: number
  current: number
  enemy: Enemy
  mechanics: RaidMechanic[]
  fightTime: number
  novaCd: number
  addsCd: number
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function raidBosses(level: number): number {
  return 2 + Math.floor(level / 2)
}

export function raidIlvl(level: number): number {
  return Math.round(120 + level * 14)
}

export function raidLuckTier(level: number): number {
  return 4 + Math.floor(level / 2)
}

export function raidTheme(level: number): { theme: DamageType; vuln: DamageType } {
  return {
    theme: ELEMENTS[(level + 1) % ELEMENTS.length],
    vuln: ELEMENTS[(level + 4) % ELEMENTS.length],
  }
}

/** Génère 1 à 2 mécaniques pour un boss (rerollées à chaque boss du raid). */
export function rollRaidMechanics(level: number): RaidMechanic[] {
  const pool: RaidMechanic[] = [
    { kind: 'nova', name: 'Nova élémentaire', description: 'Inflige périodiquement de gros dégâts à toute l\'équipe (soigne / encaisse).', value: 4, cooldown: 6 },
    { kind: 'enrage', name: 'Enrage', description: 'Frappe de plus en plus fort avec le temps (course au DPS).', value: 0.05 },
    { kind: 'drain', name: 'Drain de vie', description: 'Se régénère continuellement (besoin de burst).', value: 0.035 },
    { kind: 'adds', name: 'Invocation d\'adds', description: 'Des renforts frappent l\'équipe par vagues.', value: 3, cooldown: 5 },
    { kind: 'carapace', name: 'Carapace élémentaire', description: 'Très résistant à un type : varie tes dégâts !', value: 0.8, type: pick(ELEMENTS) },
  ]
  const count = level >= 3 ? 2 : 1
  const chosen: RaidMechanic[] = []
  for (let i = 0; i < count && pool.length; i++) {
    chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return chosen
}

export function makeRaidBoss(
  level: number,
  index: number,
  theme: DamageType,
  vuln: DamageType,
  mechanics: RaidMechanic[],
): Enemy {
  const effStage = EFF_STAGE_BASE + level * EFF_STAGE_PER_LEVEL + index * 6
  const hpBase = 40 * Math.pow(1.18, effStage - 1) * RAID_HP_PREMIUM
  const maxHp = Math.round(hpBase * RAID_BOSS_MULT)

  const resist: Partial<Record<DamageType, number>> = {}
  resist[theme] = 0.55
  resist[vuln] = -0.35
  for (const m of mechanics) if (m.kind === 'carapace' && m.type) resist[m.type] = Math.max(resist[m.type] ?? 0, m.value)

  return {
    name: `★ ${pick(BOSS_NAMES)}`,
    maxHp,
    hp: maxHp,
    armor: Math.round((20 + effStage * 2)),
    damage: Math.round(2.5 * Math.pow(1.12, effStage - 1) * RAID_DMG_PREMIUM),
    xp: Math.round(8 * Math.pow(1.12, effStage - 1) * 5),
    resist,
    damageType: theme, // le boss frappe avec le thème du raid
  }
}

const RAID_NAMES = ['Sanctuaire', 'Caveau maudit', 'Trône brisé', 'Antre primordial', 'Cœur du Néant']

export function generateRaid(level: number): ActiveRaid {
  const { theme, vuln } = raidTheme(level)
  const totalBosses = raidBosses(level)
  const mechanics = rollRaidMechanics(level)
  return {
    level,
    name: `${RAID_NAMES[level % RAID_NAMES.length]} de ${DAMAGE_TYPES[theme].name} · Raid ${level}`,
    theme,
    vuln,
    totalBosses,
    current: 0,
    enemy: makeRaidBoss(level, 0, theme, vuln, mechanics),
    mechanics,
    fightTime: 0,
    novaCd: 6,
    addsCd: 5,
  }
}
