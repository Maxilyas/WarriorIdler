import type { Enemy, DamageType, EnemyAbility } from './types'
import { DAMAGE_TYPE_LIST } from './damage'
import type { BiomeId } from './biomes'
import { BIOME_VULN, PREDATION_SELF_RESIST, PREDATION_VULN } from './biomeBonus'

/**
 * Technique SIGNATURE par biome (l'« autre chose » qui s'ajoute aux frappes physiques de base).
 * Chaque famille mappe sur un contre du kit héros (voir EnemyAbility). magnitude = fraction des
 * dégâts de base de l'ennemi.
 */
const BIOME_SIGNATURE: Record<BiomeId, EnemyAbility> = {
  physique: { kind: 'dot', element: 'physique', name: 'Saignement', icon: '🩸', cooldown: 5, magnitude: 0.6, duration: 4 },
  feu: { kind: 'dot', element: 'feu', name: 'Brûlure', icon: '🔥', cooldown: 5, magnitude: 0.8, duration: 4 },
  froid: { kind: 'cc', element: 'froid', name: 'Gel', icon: '❄️', cooldown: 9, magnitude: 0, duration: 1.2 },
  foudre: { kind: 'burst', element: 'foudre', name: 'Décharge', icon: '⚡', cooldown: 6, magnitude: 2.0, telegraph: 1.2 },
  nature: { kind: 'dot', element: 'nature', name: 'Poison', icon: '☠️', cooldown: 4, magnitude: 0.6, duration: 5 },
  arcane: { kind: 'debuff', element: 'arcane', name: 'Malédiction', icon: '✨', cooldown: 8, magnitude: 0, duration: 5 },
  ombre: { kind: 'drain', element: 'ombre', name: 'Drain de vie', icon: '🌑', cooldown: 6, magnitude: 1.4 },
}

/**
 * Techniques d'un ennemi selon son biome et son rang.
 * - Physique = biome d'APPRENTISSAGE : seuls élites/boss ont une technique (rien sur les normaux).
 * - Autres biomes : technique signature élémentaire pour TOUS ; les boss ajoutent un gros burst télégraphié.
 */
function biomeAbilities(biome: BiomeId, isBoss: boolean, isElite: boolean): EnemyAbility[] {
  const out: EnemyAbility[] = []
  if (biome === 'physique') {
    if (isBoss || isElite) out.push({ ...BIOME_SIGNATURE.physique })
    if (isBoss) out.push({ kind: 'burst', element: 'physique', name: 'Charge dévastatrice', icon: '💥', cooldown: 8, magnitude: 2.6, telegraph: 1.5 })
  } else {
    out.push({ ...BIOME_SIGNATURE[biome] })
    if (isBoss) out.push({ kind: 'burst', element: biome, name: 'Cataclysme', icon: '☄️', cooldown: 9, magnitude: 2.8, telegraph: 1.5 })
  }
  // Décale les premières incantations (pas de salve à t=0).
  out.forEach((a, i) => { a.cd = a.cooldown * (0.5 + i * 0.3) })
  return out
}

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

/** Crée l'ennemi correspondant à un palier (stage) dans un biome donné. Boss tous les 10 paliers. */
export function makeEnemy(stage: number, biome: BiomeId = 'physique'): Enemy {
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
  // CYCLE DE PRÉDATION (v0.21) : hors Physique, les ennemis résistent à LEUR élément et sont
  // vulnérables à l'élément prédateur → camper le biome de son propre élément n'est plus optimal
  // (le butin de ton élément tombe là où les ennemis te résistent — arbitrage voulu).
  if (biome !== 'physique') {
    resist[biome] = (resist[biome] ?? 0) + PREDATION_SELF_RESIST
    const vul = BIOME_VULN[biome]
    resist[vul] = (resist[vul] ?? 0) + PREDATION_VULN
  }

  // Auto-attaques TOUJOURS PHYSIQUES (la base). L'élément du biome arrive en plus, via la technique
  // signature (DoT/burst/CC… typé) → « physique + autre chose ». Donc en biome Feu : frappes physiques
  // (→ armure / résist physique) + Brûlure de feu (→ résist feu + Purge). Double levier de survie.
  const damageType: DamageType = 'physique'

  return {
    name,
    maxHp,
    hp: maxHp,
    armor: Math.round(stage * 1.5 * armorMult),
    // Dégâts : croissance VOLONTAIREMENT plus lente que les PV (1.115 vs 1.17, comme les raids) →
    // les PV joueur (≈ linéaires) suivent, fini le one-shot exponentiel en fin de course. La menace
    // vient désormais de la pression soutenue + des techniques télégraphiées (à parer), pas du mur sec.
    damage: Math.round(7 * Math.pow(1.115, stage - 1) * (isBoss ? 1.8 : 1) * dmgMult),
    // XP rare (monter de niveau se mérite — levelling volontairement lent au début).
    xp: Math.round((isBoss ? 38 : isElite ? 17 : 4) * Math.pow(1.115, stage - 1)),
    resist,
    damageType,
    ...(trait ? { trait: trait.name } : isElite ? { trait: 'Élite' } : {}),
    ...(() => { const a = biomeAbilities(biome, isBoss, isElite); return a.length ? { abilities: a } : {} })(),
    ...(isElite ? { elite: true, dodge: 0.1 } : {}),
    // Boss : reçoivent les « Dégâts vs Boss », esquivent (→ Précision) et étourdissent (→ Ténacité).
    ...(isBoss ? { boss: true, dodge: 0.15, ccDur: 1.5, ccCd: 7 } : {}),
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
