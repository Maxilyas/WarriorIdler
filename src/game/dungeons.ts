import type { DamageType, Enemy } from './types'
import { DAMAGE_TYPES } from './damage'
import type { GemFamily } from './condGems'
import { dungeonReq } from './resist'

/**
 * DONJONS « par RESSOURCE » (refonte v0.17).
 *
 * Fini les donjons « par type de résistance ». Désormais chaque donjon CIBLE une ressource
 * (or, éclats, poussière, noyaux, XP, stuff, clés) et possède une IDENTITÉ MÉCANIQUE légère
 * (pas un mur de résistance élémentaire) qui valorise des stats/builds différents :
 *  - 'rapide'  → ennemis qui frappent fort  → il faut de la SURVIE (EHP / résistances)
 *  - 'pack'    → nuées nombreuses           → privilégie le CLEAVE / les capacités de zone
 *  - 'colosse' → un seul ennemi colossal    → DPS mono-cible + Dégâts vs Boss
 *  - 'armure'  → ennemis très blindés       → PÉNÉTRATION obligatoire
 *  - 'elite'   → élites coriaces            → DPS soutenu + Dégâts vs Boss
 *  - 'regen'   → ennemis qui se régénèrent  → BURST (sinon ils ne meurent jamais)
 *
 * Boucle voulue : taper les paliers classiques → farmer les donjons (ressources/stuff)
 * → réussir les raids (pièces hors-norme).
 */

export type DungeonId = 'or' | 'savoir' | 'eclats' | 'noyau' | 'butin' | 'sceaux' | 'orbes' | 'poussiere' | 'geode'
export type DungeonReward = 'gold' | 'xp' | 'eclats' | 'noyau' | 'stuff' | 'sceaux' | 'orbes' | 'poussiere' | 'gemmes'
export type DungeonTrait = 'rapide' | 'pack' | 'colosse' | 'armure' | 'elite' | 'regen'

export interface DungeonDef {
  id: DungeonId
  name: string
  icon: string
  color: string
  lore: string
  reward: DungeonReward
  trait: DungeonTrait
  /** Description de l'identité de combat (affichée au joueur). */
  traitLabel: string
  /** Type d'attaque des ennemis (flavor — PAS de mur de résistance). */
  element: DamageType
  /** Palier de farm requis pour débloquer. */
  unlockStage: number
  /** Coût d'entrée en Sceaux de faille (0 = gratuit). Le donjon de Sceaux est gratuit ; celui d'Orbes coûte cher. */
  sceauCost: number
}

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  sceaux: {
    id: 'sceaux', name: 'Antre des Failles', icon: '🔑', color: '#4dd0e1', reward: 'sceaux',
    lore: 'Un nœud de failles instables où grouillent des entités qui se reforment sans fin. On y récolte les Sceaux qui ouvrent tous les autres donjons.',
    trait: 'regen', traitLabel: 'Ennemis qui se régénèrent : sans burst, tu ne les tueras jamais.',
    element: 'froid', unlockStage: 5, sceauCost: 0,
  },
  or: {
    id: 'or', name: 'Chambre du Trésor', icon: '💰', color: '#ffd43b', reward: 'gold',
    lore: 'Des gardiens d\'or massif veillent sur des montagnes de pièces. Ils frappent sans pitié quiconque convoite le trésor.',
    trait: 'rapide', traitLabel: 'Gardiens avides : frappent vite et fort → il faut de la survie (EHP, résistances).',
    element: 'physique', unlockStage: 7, sceauCost: 1,
  },
  savoir: {
    id: 'savoir', name: 'Sanctuaire du Savoir', icon: '⚗️', color: '#51cf66', reward: 'xp',
    lore: 'Une bibliothèque infinie hantée d\'esprits studieux. Les terrasser nourrit ton expérience.',
    trait: 'pack', traitLabel: 'Nuées d\'esprits : beaucoup de cibles → idéal au cleave / capacités de zone.',
    element: 'nature', unlockStage: 10, sceauCost: 1,
  },
  eclats: {
    id: 'eclats', name: 'Faille Arcanique', icon: '♦', color: '#22d3ee', reward: 'eclats',
    lore: 'Une déchirure dans la réalité d\'où jaillissent des éclats d\'arcane vivants qui se scindent sans cesse.',
    trait: 'pack', traitLabel: 'Cristaux qui se multiplient : nuées denses → privilégie le cleave.',
    element: 'arcane', unlockStage: 13, sceauCost: 1,
  },
  noyau: {
    id: 'noyau', name: 'Forge du Noyau', icon: '💠', color: '#f783ac', reward: 'noyau',
    lore: 'Au cœur d\'un volcan, des golems de fonte gardent les Noyaux primordiaux — désormais l\'UNIQUE source de ce matériau de craft.',
    trait: 'armure', traitLabel: 'Golems blindés : sans Pénétration, ton DPS s\'effondre.',
    element: 'feu', unlockStage: 18, sceauCost: 1,
  },
  butin: {
    id: 'butin', name: 'Cache du Pilleur', icon: '🎒', color: '#a78bfa', reward: 'stuff',
    lore: 'Le repaire d\'un seigneur-voleur, gardé par ses lieutenants d\'élite. Le butin monte en rareté avec le niveau, jusqu\'à Éternel — au-delà, seul un tirage infime perce le voile.',
    trait: 'elite', traitLabel: 'Lieutenants d\'élite coriaces → DPS soutenu et Dégâts vs Boss.',
    element: 'ombre', unlockStage: 24, sceauCost: 1,
  },
  geode: {
    id: 'geode', name: 'La Géode', icon: '🔹', color: '#38bdf8', reward: 'gemmes',
    lore: 'Une caverne aux mille facettes, divisée en trois ailes cristallines — une par famille de gemme. Choisis ton aile : la poussière est garantie, la gemme se mérite.',
    trait: 'armure', traitLabel: 'Golems cristallins blindés : sans Pénétration, ton DPS s\'effondre.',
    element: 'froid', unlockStage: 30, sceauCost: 2,
  },
  orbes: {
    id: 'orbes', name: 'Vortex des Orbes', icon: '🔮', color: '#e599f7', reward: 'orbes',
    lore: 'Un maelström où se condensent les Orbes de raid. Y pénétrer exige de sacrifier une poignée de Sceaux.',
    trait: 'pack', traitLabel: 'Nuées denses → privilégie le cleave.',
    element: 'arcane', unlockStage: 30, sceauCost: 10,
  },
  poussiere: {
    id: 'poussiere', name: 'Observatoire Stellaire', icon: '🌌', color: '#748ffc', reward: 'poussiere',
    lore: 'Au sommet du monde, un colosse stellaire unique condense la Poussière d\'étoile. Un mur de PV à lui seul.',
    trait: 'colosse', traitLabel: 'Un colosse unique : DPS mono-cible massif (et Dégâts vs Boss).',
    element: 'foudre', unlockStage: 45, sceauCost: 1,
  },
}

export const DUNGEON_LIST: DungeonDef[] = [
  DUNGEONS.sceaux, DUNGEONS.or, DUNGEONS.savoir, DUNGEONS.eclats, DUNGEONS.noyau, DUNGEONS.butin, DUNGEONS.geode, DUNGEONS.orbes, DUNGEONS.poussiere,
]

// ---- La Géode : ailes (famille de gemme) + rendements ----

/** Élément des golems de chaque aile (assorti aux biomes de drop de la famille). */
export const GEODE_WING_ELEMENT: Record<GemFamily, DamageType> = {
  rythme: 'feu', flux: 'ombre', environnement: 'froid',
}

/** Poussière de gemme 🔹 par run (par-combat + coffre, avant efficacité d'automate). */
export function geodeDustYield(level: number): number {
  return Math.round(30 * Math.pow(1.18, level - 1))
}

/** Chance qu'une GEMME de l'aile tombe dans le coffre (montée par niveau, capée). */
export function geodeGemChance(level: number): number {
  return Math.min(0.8, 0.35 + level * 0.03)
}

/** Rang de la gemme du coffre (les hauts niveaux donnent des gemmes pré-recoupées). */
export function geodeGemRank(level: number): number {
  return level >= 18 ? 3 : level >= 10 ? 2 : 1
}

/**
 * Rampe de rareté FINE du donjon Butin (Cache du Pilleur). Niv 1 = {Médiocre…Rare} ; la fenêtre
 * s'élargit et se décale vers le haut avec le niveau (via rollBoxRarity).
 * v0.23 : SOFT CAP à Éternel (t12) — la Cache n'est PAS la source du stuff au-dessus d'Éternel
 * (ça, c'est le rôle des raids). Au-delà, seul un tirage « au-delà du voile » à part peut tomber
 * (voir butinOverChance/butinOverRarity) : infime, et presque insensible au niveau.
 */
export const BUTIN_RARITY_CAP = 12 // Éternel — plafond DUR de la fenêtre normale (jackpot compris)
export function butinMinTier(level: number): number {
  return Math.max(1, Math.min(11, 1 + Math.floor(level / 4)))
}
export function butinMaxTier(level: number): number {
  return Math.max(3, Math.min(BUTIN_RARITY_CAP, 3 + Math.floor(level * 0.45))) // Éternel atteint vers le niv 20
}

/**
 * « Au-delà du voile » : chance qu'UN objet du coffre perce le soft cap (Cosmique → Transcendant).
 * Infime par design : ~0,4% au niv 1, qui grimpe DOUCEMENT (+0,02%/niv) et plafonne à 1,5%.
 * Le niveau du donjon n'achète donc jamais ces raretés — il en effleure juste la probabilité.
 */
export function butinOverChance(level: number): number {
  return Math.min(0.015, 0.004 + level * 0.0002)
}

/** Répartition (quasi figée, quel que soit le niveau) du tirage au-delà d'Éternel. */
const BUTIN_OVER_WEIGHTS: { tier: number; w: number }[] = [
  { tier: 13, w: 60 }, // Cosmique
  { tier: 14, w: 25 }, // Abyssal
  { tier: 15, w: 11 }, // Primordial
  { tier: 16, w: 4 },  // Transcendant
]
export function butinOverTier(): number {
  const total = BUTIN_OVER_WEIGHTS.reduce((a, x) => a + x.w, 0)
  let r = Math.random() * total
  for (const x of BUTIN_OVER_WEIGHTS) { r -= x.w; if (r <= 0) return x.tier }
  return 13
}

/**
 * Repère de RENDEMENT (par run terminé) pour calibrer l'équilibrage — chaque donjon doit rester
 * la voie LA PLUS RENTABLE pour SA ressource. Un run niv N = (4+N) combats. (Premier jet à affiner.)
 *   or       ≈ 450·N·(1+0.15N)              noyau   ≈ 12·N·(1+0.10N)
 *   eclats   ≈ 300·N·(1+0.13N)              sceaux  ≈ 3 + 0.9N
 *   xp       ≈ 180·N·1.1^N (équipe)         orbes   ≈ 1 + 0.5N (entrée : 10 Sceaux)
 *   poussiere≈ (1+⌊N/3⌋) garanti + 0..2 bonus (proba croissante)
 *   butin    ≈ (3+⌊N/2⌋) objets, rareté de butinMinTier(N)→butinMaxTier(N)
 */

export function getDungeonDef(id: DungeonId): DungeonDef {
  return DUNGEONS[id]
}

// ---- Modificateurs (style Mythique+) : épice aléatoire en plus de l'identité du donjon ----

export interface DungeonModifier {
  id: string
  name: string
  description: string
  hpMult?: number
  armorMult?: number
  xpMult?: number
  noGold?: boolean
  rareBonus?: number
  enrageRampPerSec?: number
  reflectPct?: number
  regenPct?: number
}

export const DUNGEON_MODIFIERS: DungeonModifier[] = [
  { id: 'colossal', name: 'Colossal', description: '+40% de PV des ennemis.', hpMult: 1.4 },
  { id: 'blinde', name: 'Blindé', description: 'Armure doublée.', armorMult: 2 },
  { id: 'enrage', name: 'Enragé', description: 'Les ennemis frappent de plus en plus fort avec le temps.', enrageRampPerSec: 0.08 },
  { id: 'reflectif', name: 'Réfléchissant', description: 'Renvoie une partie de tes dégâts (capé à 10% de tes PV max par seconde).', reflectPct: 0.10 },
  { id: 'erudit', name: 'Érudit', description: '+100% XP, mais ennemis plus coriaces.', xpMult: 2, hpMult: 1.5 },
  { id: 'avare', name: 'Avare', description: 'Aucun or, mais davantage d\'objets rares.', noGold: true, rareBonus: 1 },
]

// ---- Donjon actif ----

export interface ActiveDungeon {
  dungeonId: DungeonId
  level: number
  name: string
  trait: DungeonTrait
  reward: DungeonReward
  /** Type d'attaque des ennemis (flavor). */
  element: DamageType
  /** La Géode : aile choisie (famille de gemme farmée). */
  wing?: GemFamily
  modifiers: DungeonModifier[]
  totalFights: number
  current: number
  /** Le combat courant : un pack d'ennemis. */
  enemies: Enemy[]
  fightTime: number
  /** Accumulateur fractionnaire des ressources gagnées PAR COMBAT (crédité en unités entières au fil de l'eau). */
  earned?: Record<string, number>
  /** Relances automatiques restantes (auto-farm) : à la fin du run, on relance si > 0 et Sceaux suffisants. */
  repeatLeft?: number
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const ENEMY_NAMES = ['Sentinelle', 'Aberration', 'Gardien', 'Cultiste', 'Revenant', 'Colosse', 'Spectre', 'Traqueur']
const PACK_TAGS = ['α', 'β', 'γ', 'δ']

/** Réglages de combat par identité de donjon. */
interface TraitCfg { hp: number; dmg: number; armor: number; pack: number; elite?: boolean; regen?: number }
const TRAIT_CFG: Record<DungeonTrait, TraitCfg> = {
  rapide: { hp: 0.8, dmg: 1.5, armor: 1, pack: 2 },
  pack: { hp: 0.55, dmg: 0.9, armor: 1, pack: 4 },
  colosse: { hp: 2.6, dmg: 1.25, armor: 1.3, pack: 1 },
  armure: { hp: 1.0, dmg: 1.0, armor: 3.4, pack: 2 },
  // v0.22 : les lieutenants de la Cache étaient trop mous pour la qualité du butin → durcis.
  elite: { hp: 2.1, dmg: 1.3, armor: 1.2, pack: 2, elite: true },
  regen: { hp: 1.1, dmg: 1.0, armor: 1, pack: 2, regen: 0.03 },
}

/** Nombre de combats d'un donjon de niveau N — court et dense (v0.21 : 2 à 4, fini les 4+N). */
export function dungeonFights(level: number): number {
  return Math.min(4, 2 + Math.floor(level / 4))
}

/**
 * ilvl du butin du coffre : en avance sur le farm pour récompenser le défi, mais PLAFONNÉ à
 * 125% de l'ilvl du record de palier. v0.22 : avant (10 + 12·niv, sans plafond) la Cache niv 38
 * crachait de l'ilvl 466 quand le farm en donnait 180 — boule de neige stuff → niveau suivant.
 * Monter le PALIER redevient le moteur ; le donjon garde une longueur d'avance, pas une galaxie.
 */
export function dungeonIlvl(level: number, bestStage: number): number {
  const cap = Math.round(Math.max(1, bestStage) * 1.5 * 1.25) // stageIlvl(bestStage) × 1.25
  return Math.min(Math.round(10 + level * 8), Math.max(20, cap))
}

/**
 * RENDEMENT par run d'un donjon, par ressource — MAPPÉ sur les coûts de craft (atelier/forge).
 * Avant : indexé sur packXp (∝ 1.12^(7·niveau) ≈ 2.21^niveau) → explosion, 1 run = des milliers de
 * crafts en fin de course. Désormais : base × growth^(niveau-1), où growth ≈ la croissance du COÛT
 * de la ressource correspondante (éclats ~1.13, noyau/poussière ~1.45 via la table de rareté, or ~1.40)
 * → le ratio « crafts par run » reste stable (~2-4) à tous les niveaux. Voir `npm run eco`.
 */
const DUNGEON_YIELD: Partial<Record<DungeonReward, { base: number; growth: number }>> = {
  gold: { base: 6000, growth: 1.40 },
  // Éclats ÷4 (v0.20) : contrairement aux noyaux/poussière, les éclats arrivent AUSSI en masse par
  // le recyclage et l'achat à l'or → la Faille seule couvrait tout le craft et l'éclat ne valait
  // plus rien. Le donjon reste la meilleure source PONCTUELLE (~0.5-0.65 craft/run), le recyclage
  // fait l'appoint. (Réf : npm run eco.)
  eclats: { base: 10000, growth: 1.13 },
  noyau: { base: 500, growth: 1.45 },
  poussiere: { base: 25, growth: 1.47 },
}
/** Part du rendement distribuée PAR COMBAT (le reste tombe dans le coffre de fin). */
export const DUNGEON_YIELD_PERFIGHT_FRAC = 0.4
/** Rendement TOTAL d'un run (par-combat + coffre) pour la ressource du donjon. */
export function dungeonRunYield(reward: DungeonReward, level: number): number {
  const y = DUNGEON_YIELD[reward]
  return y ? Math.round(y.base * Math.pow(y.growth, level - 1)) : 0
}

/**
 * Rendement TOTAL en CLÉS (Sceaux / Orbes) d'un run — v0.21 : mappé comme les autres ressources
 * (40% au fil des combats, 60% au coffre). Avant, le fil de combats était indexé sur l'XP du pack
 * (exponentielle) et le coffre sur une formule linéaire → le Vortex crachait tout PENDANT le run
 * et un coffre ridicule. C'est désormais l'inverse : le coffre est le gros morceau.
 */
export function dungeonKeyYield(reward: 'sceaux' | 'orbes', level: number): number {
  return reward === 'sceaux' ? 3 + 0.9 * level : 1 + 0.5 * level
}

/** Décalage de chance de rareté du coffre (généreux). */
export function dungeonLuckTier(level: number): number {
  return 2 + Math.floor(level / 2)
}

// Constantes d'équilibrage des donjons (à ajuster facilement).
const EFF_STAGE_PER_LEVEL = 7 // sert aux RÉCOMPENSES (xp) et à l'armure → économie inchangée.
// Scaling COMBAT (refonte) : PV/dégâts par NIVEAU de donjon DÉCOUPLÉS du nombre de combats, calés
// sur une vraie courbe de progression (cf. npm run dungeon). Avant : effStage=level*7+combat avec
// base 1.18/1.12 → PV ×3.18 ET dégâts ridicules en début de palier ET ×8.6 PV sur un run.
const DUNGEON_HP_BASE = 3200       // PV d'un ennemi NORMAL, donjon niv 1, 1er combat (neutre)
const DUNGEON_HP_PER_LEVEL = 1.42  // ×PV par niveau de donjon (montée douce → progression réelle)
const DUNGEON_DMG_BASE = 389       // dégâts de base RELEVÉS (fini les dégâts ridicules au début)
const DUNGEON_DMG_PER_LEVEL = 1.26 // ×dégâts par niveau (plus lent que les PV → la survie suit)
const DUNGEON_FIGHT_RAMP = 1.04    // ×PV & dégâts par combat DANS un run (rampe douce, pas un mur)
const DUNGEON_BOSS_HP_MULT = 5     // le boss (dernier combat) reste un pic de PV

/** Régénération des ennemis (fraction des PV max/s) imposée par l'identité du donjon. */
export function dungeonRegen(trait: DungeonTrait): number {
  return TRAIT_CFG[trait].regen ?? 0
}

/** Taille du pack d'un combat (le boss final est seul). */
export function dungeonPackSize(trait: DungeonTrait, fightIndex: number, totalFights: number): number {
  if (fightIndex === totalFights - 1) return 1
  return TRAIT_CFG[trait].pack
}

/** Construit un ennemi d'un combat de donjon selon l'identité (trait). Pas de mur de résistance. */
export function makeDungeonEnemy(
  def: DungeonDef,
  level: number,
  fightIndex: number,
  totalFights: number,
  modifiers: DungeonModifier[],
): Enemy {
  const cfg = TRAIT_CFG[def.trait]
  const isBoss = fightIndex === totalFights - 1
  let hpMult = cfg.hp
  let armorMult = cfg.armor
  let xpMult = 1
  for (const m of modifiers) {
    if (m.hpMult) hpMult *= m.hpMult
    if (m.armorMult) armorMult *= m.armorMult
    if (m.xpMult) xpMult *= m.xpMult
  }

  const lvl = level - 1
  const effStage = level * EFF_STAGE_PER_LEVEL + fightIndex // récompenses (xp) + armure (économie inchangée)
  // PV : montée modérée par NIVEAU (1.42) + rampe douce par COMBAT (1.04) → courbe de progression.
  const hpBase = DUNGEON_HP_BASE * Math.pow(DUNGEON_HP_PER_LEVEL, lvl) * Math.pow(DUNGEON_FIGHT_RAMP, fightIndex)
  const maxHp = Math.round(hpBase * (isBoss ? DUNGEON_BOSS_HP_MULT : 1) * hpMult)
  const isElite = cfg.elite && !isBoss

  const baseName = `${pick(ENEMY_NAMES)} ${DAMAGE_TYPES[def.element].name.toLowerCase()}`
  const name = isBoss ? `★ ${baseName}` : isElite ? `◆ ${baseName}` : baseName

  return {
    name,
    maxHp,
    hp: maxHp,
    armor: Math.round((10 + level * 10) * armorMult),
    // Dégâts : base RELEVÉE + croissance par niveau plus lente que les PV (1.26 < 1.42) → survie suit.
    damage: Math.round(DUNGEON_DMG_BASE * Math.pow(DUNGEON_DMG_PER_LEVEL, lvl) * Math.pow(DUNGEON_FIGHT_RAMP, fightIndex) * cfg.dmg * (isBoss ? 1.8 : 1)),
    xp: Math.round(8 * Math.pow(1.12, effStage - 1) * (isBoss ? 5 : 1) * xpMult),
    resist: {},
    damageType: def.element,
    // Exigence de résistance (v0.24) sur l'élément du donjon — modérée (cap ×2.1 à zéro résist).
    reqs: { [def.element]: dungeonReq(level) },
    ...(isElite ? { elite: true, dodge: 0.1 } : {}),
    ...(isBoss ? { boss: true, dodge: 0.15, ccDur: 1.6, ccCd: 7 } : {}),
  }
}

/** Construit le PACK d'ennemis d'un combat (plusieurs adversaires simultanés selon l'identité). */
export function makeDungeonPack(
  def: DungeonDef,
  level: number,
  fightIndex: number,
  totalFights: number,
  modifiers: DungeonModifier[],
): Enemy[] {
  const size = dungeonPackSize(def.trait, fightIndex, totalFights)
  if (size <= 1) return [makeDungeonEnemy(def, level, fightIndex, totalFights, modifiers)]
  const pack: Enemy[] = []
  for (let i = 0; i < size; i++) {
    const e = makeDungeonEnemy(def, level, fightIndex, totalFights, modifiers)
    e.maxHp = Math.max(1, Math.round(e.maxHp * 0.72))
    e.hp = e.maxHp
    e.name = `${e.name} ${PACK_TAGS[i] ?? i + 1}`
    pack.push(e)
  }
  return pack
}

/** Génère un donjon prêt à jouer. `wing` (La Géode) : aile choisie → famille farmée + élément. */
export function generateDungeon(dungeonId: DungeonId, level: number, wing?: GemFamily): ActiveDungeon {
  const def = dungeonId === 'geode' && wing
    ? { ...DUNGEONS.geode, element: GEODE_WING_ELEMENT[wing] }
    : DUNGEONS[dungeonId]
  const totalFights = dungeonFights(level)

  // 1 modificateur, +1 à partir du niveau 4. Le donjon d'OR exclut « Avare » (sinon zéro or — bug).
  const count = level >= 4 ? 2 : 1
  const pool = DUNGEON_MODIFIERS.filter((m) => !(def.reward === 'gold' && m.noGold))
  const modifiers: DungeonModifier[] = []
  for (let i = 0; i < count && pool.length; i++) {
    modifiers.push({ ...pool.splice(Math.floor(Math.random() * pool.length), 1)[0] })
  }

  return {
    dungeonId,
    level,
    name: `${def.icon} ${def.name} · Niv. ${level}`,
    trait: def.trait,
    reward: def.reward,
    element: def.element,
    ...(dungeonId === 'geode' && wing ? { wing } : {}),
    modifiers,
    totalFights,
    current: 0,
    enemies: makeDungeonPack(def, level, 0, totalFights, modifiers),
    fightTime: 0,
    earned: {},
  }
}
