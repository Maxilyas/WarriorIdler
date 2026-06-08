import type { DamageType, Enemy, ItemType } from './types'
import { DAMAGE_TYPE_LIST } from './damage'
import { stageIlvl } from './enemies'

/**
 * RAIDS — refonte « endgame ».
 *
 * Plus un seul raid générique « résistance X », mais **5 raids distincts**, chacun avec :
 *  - une IDENTITÉ (lore, couleur, mécaniques signature imposées),
 *  - un BUTIN CIBLÉ par catégorie d'équipement (Armes / Anneaux & Bijoux / Armures / Résistances /
 *    Tout) → farmer un raid fait progresser un emplacement précis,
 *  - des TIERS de difficulté montés **indépendamment** (battre le tier T débloque T+1 de CE raid),
 *  - des CHECKS DE STUFF brutaux (DPS / EHP / résistances / pénétration / burst) : il faut un
 *    équipement extrêmement optimisé pour les battre,
 *  - des RESSOURCES TRÈS RARES (Fragments d'éternité + **Éclat cosmique 💫**, exclusif aux raids).
 *
 * Le combat reste idle : la « difficulté » s'exprime via des seuils de stats (timer d'enrage dur,
 * novas qui one-shot le stuff faible, armure/résistances qui exigent de la pénétration, etc.).
 */

// ---- Mécaniques de boss (checks de stuff) ----

export type RaidMechanicKind =
  | 'berserk'   // ENRAGE DUR : timer de kill ; passé le délai, les dégâts explosent → check de DPS
  | 'nova'      // AoE périodique massive (typée) → check d'EHP / mitigation
  | 'fortress'  // armure + résistance colossales → check de PÉNÉTRATION
  | 'leech'     // le boss se régénère vite → check de BURST
  | 'swarm'     // vagues d'adds qui frappent l'équipe → check d'EHP de groupe
  | 'rotate'    // le boss change de type d'attaque à chaque phase → check de RÉSISTANCES larges
  | 'execute'   // le boss frappe plus fort à mesure qu'il perd ses PV → course contre la montre

export const RAID_MECHANIC_META: Record<RaidMechanicKind, { name: string; icon: string; desc: string }> = {
  berserk: { name: 'Enrage mortel', icon: '⏱️', desc: 'Timer de kill : passé le délai, les dégâts deviennent fatals. Il faut du DPS.' },
  nova: { name: 'Nova cataclysmique', icon: '☄️', desc: 'Explosion périodique qui pulvérise l\'équipe sous-équipée. Il faut des PV et de la mitigation.' },
  fortress: { name: 'Forteresse', icon: '🛡️', desc: 'Armure et résistances colossales. Sans Pénétration, ton DPS s\'effondre.' },
  leech: { name: 'Sangsue', icon: '🩸', desc: 'Le boss régénère sa vie en continu. Sans burst, tu ne le tueras jamais.' },
  swarm: { name: 'Déferlante', icon: '🐛', desc: 'Des vagues de renforts frappent toute l\'équipe. Survie de groupe exigée.' },
  rotate: { name: 'Prisme instable', icon: '🌈', desc: 'Le boss change de type d\'attaque à chaque phase. Il faut résister à TOUT.' },
  execute: { name: 'Acharnement', icon: '💀', desc: 'Plus le boss perd de vie, plus il frappe fort. Achève-le vite.' },
}

// ---- Registre des raids ----

export type RaidId = 'forge' | 'reliquaire' | 'citadelle' | 'nexus' | 'abysse'

export interface RaidDef {
  id: RaidId
  name: string
  icon: string
  color: string
  lore: string
  /** Catégorie d'équipement ciblée par le butin. */
  lootTypes: ItemType[]
  lootLabel: string
  /**
   * Palier de déblocage (bestStage requis). Sert AUSSI de palier de référence pour la
   * difficulté et l'iLvl du Tier 1 : un raid débloqué au palier 50 est calé sur le palier 50.
   * La différence de difficulté entre raids vient de `baseDifficulty` (pas du palier d'accès).
   */
  unlockStage: number
  /** Raid prérequis : doit avoir été clear (tier ≥ 1) au moins une fois. */
  requires?: RaidId
  /** Difficulté de base : multiplie PV et dégâts (≥1, monte d'un raid à l'autre). */
  baseDifficulty: number
  /** Mécaniques signature imposées (identité). */
  signature: RaidMechanicKind[]
  /** Élément principal, ou 'rotating' (le boss cycle les types d'attaque). */
  element: DamageType | 'rotating'
  /** Nombre de boss de base (croît un peu avec le tier). */
  bosses: number
  /** Coût en Orbes de raid pour tenter. */
  orbeCost: number
}

/** Palier (bestStage) qui débloque le PREMIER raid. */
export const RAID_UNLOCK_STAGE = 50

export const RAIDS: Record<RaidId, RaidDef> = {
  forge: {
    id: 'forge', name: 'La Forge des Titans', icon: '⚒️', color: '#ff6b35',
    lore: 'Des enclumes grandes comme des collines, des gardiens de fonte en fusion. Seul un DPS perçant fend leur carapace.',
    lootTypes: ['armePrincipale', 'armeSecondaire'], lootLabel: 'Armes & Boucliers',
    unlockStage: 50, baseDifficulty: 1.0, signature: ['fortress', 'berserk'], element: 'physique', bosses: 3, orbeCost: 1,
  },
  reliquaire: {
    id: 'reliquaire', name: 'Le Reliquaire Englouti', icon: '💍', color: '#4dd0e1',
    lore: 'Une crypte noyée où dorment les joyaux des rois morts. Leurs gardiens se ressoudent sans cesse — frappe vite et fort.',
    lootTypes: ['anneau', 'bijou', 'cou'], lootLabel: 'Anneaux, Bijoux & Colliers',
    unlockStage: 50, baseDifficulty: 1.3, signature: ['leech', 'swarm'], element: 'froid', bosses: 3, orbeCost: 1,
  },
  citadelle: {
    id: 'citadelle', name: 'La Citadelle Éternelle', icon: '🏰', color: '#ffd43b',
    lore: 'Une forteresse battue par des orages sans fin. Ses sentinelles déchaînent des novas — seule une muraille de PV tient debout.',
    lootTypes: ['tete', 'epaules', 'torse', 'jambes', 'mains', 'taille', 'pieds', 'poignets', 'cape'], lootLabel: 'Pièces d\'armure',
    unlockStage: 50, baseDifficulty: 1.6, signature: ['nova', 'execute'], element: 'foudre', bosses: 4, orbeCost: 1,
  },
  nexus: {
    id: 'nexus', name: 'Le Nexus Prismatique', icon: '🌈', color: '#c084fc',
    lore: 'Un cœur de magie pure où la réalité se fracture en sept couleurs. Le boss change d\'élément sans prévenir : résiste à tout, ou meurs.',
    lootTypes: ['cou', 'cape', 'bijou', 'anneau'], lootLabel: 'Accessoires de résistance',
    unlockStage: 50, baseDifficulty: 1.9, signature: ['rotate', 'nova'], element: 'rotating', bosses: 4, orbeCost: 2,
  },
  abysse: {
    id: 'abysse', name: 'L\'Abîme Primordial', icon: '🕳️', color: '#8a2be2',
    lore: 'Le gouffre d\'où tout est né et où tout retourne. Le défi ultime : aucune faiblesse de stuff n\'est pardonnée. Le butin et les Éclats cosmiques y sont les plus riches.',
    lootTypes: ['tete', 'epaules', 'torse', 'jambes', 'mains', 'taille', 'pieds', 'poignets', 'cape', 'cou', 'anneau', 'bijou', 'armePrincipale', 'armeSecondaire'], lootLabel: 'Tout l\'équipement',
    unlockStage: 150, requires: 'nexus', baseDifficulty: 2.4, signature: ['berserk', 'nova', 'fortress', 'leech'], element: 'rotating', bosses: 5, orbeCost: 3,
  },
}

export const RAID_LIST: RaidDef[] = [RAIDS.forge, RAIDS.reliquaire, RAIDS.citadelle, RAIDS.nexus, RAIDS.abysse]

export function getRaidDef(id: RaidId): RaidDef {
  return RAIDS[id]
}

/** Un raid est-il accessible (palier requis + raid prérequis clear) ? */
export function raidUnlocked(def: RaidDef, bestStage: number, progress: Record<RaidId, number>): boolean {
  if (bestStage < def.unlockStage) return false
  if (def.requires && (progress[def.requires] ?? 0) < 1) return false
  return true
}

// ---- Constantes d'équilibrage (DUR mais sans mur — à nudger ici) ----
const RAID_HP_PREMIUM = 2.5       // PV bruts vs un ennemi de farm de palier équivalent
const RAID_DMG_PREMIUM = 1.95     // dégâts bruts vs farm équivalent
const FINAL_BOSS_MULT = 2.2       // le dernier boss du raid est un mur (adouci)
// Pas (en paliers de farm) entre deux tiers — désormais PROGRESSIF : les premiers tiers
// montent doucement (plus de mur au tier 2), l'écart s'élargit ensuite.
const TIER_STAGE_BASE = 11        // pas du tier 2
const TIER_STAGE_GROWTH = 2.4     // +X paliers de pas par tier supplémentaire
const BOSS_STAGE_STEP = 6         // chaque boss suivant est plus dur (modéré : un raid à 4 boss
                                  // n'écrase plus un raid à 3 boss au même palier d'accès)

/** Paliers de farm cumulés ajoutés par les tiers (courbe douce au début, plus raide ensuite). */
function tierStageOffset(tier: number): number {
  // tier 1 = 0 ; tier 2 = BASE ; ensuite chaque tier ajoute BASE + (t-2)*GROWTH.
  let off = 0
  for (let t = 2; t <= tier; t++) off += TIER_STAGE_BASE + (t - 2) * TIER_STAGE_GROWTH
  return off
}
const FORTRESS_ARMOR_MULT = 3.2   // 'fortress' : armure colossale
const FORTRESS_RESIST_BONUS = 0.2 // 'fortress' : +résistance au thème

const ELEMENTS: DamageType[] = DAMAGE_TYPE_LIST

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Vulnérabilité thématique d'un élément (laisse une porte de sortie : varier ses dégâts). */
const VULN: Record<DamageType, DamageType> = {
  physique: 'arcane', feu: 'froid', froid: 'feu', foudre: 'nature',
  nature: 'foudre', arcane: 'ombre', ombre: 'arcane',
}

export interface ActiveRaid {
  raidId: RaidId
  tier: number
  name: string
  /** Index du boss en cours (0-based). */
  current: number
  totalBosses: number
  /** enemies[0] = le boss (cible d'objectif) ; les suivants = renforts temporaires (mécanique Déferlante). */
  enemies: Enemy[]
  /** Mécaniques signature (depuis la def). */
  mechanics: RaidMechanicKind[]
  /** Type d'attaque courant (pour 'rotate'/'rotating'). */
  element: DamageType
  /** Cycle d'éléments pour 'rotate'. */
  rotateList: DamageType[]
  rotateIdx: number
  fightTime: number
  novaCd: number
  swarmCd: number
  rotateCd: number
  /** Délai (s) avant l'enrage mortel sur ce boss. */
  berserkAt: number
}

/** Nombre de boss d'un raid à un tier donné. */
export function raidBossCount(def: RaidDef, tier: number): number {
  return def.bosses + Math.floor((tier - 1) / 3)
}

/** Palier de farm « effectif » d'un boss (sert à toutes les courbes). */
function effStage(def: RaidDef, tier: number, bossIndex: number): number {
  return def.unlockStage + tierStageOffset(tier) + bossIndex * BOSS_STAGE_STEP
}

/** Délai d'enrage dur (s) — rétrécit avec le tier → exige toujours plus de DPS. */
export function raidBerserkTime(def: RaidDef, tier: number): number {
  return Math.max(14, 34 - tier * 1.5 - def.baseDifficulty * 2)
}

/**
 * iLvl du butin (les raids sont la meilleure source de stuff du jeu).
 * Calé sur le palier d'accès (`stageIlvl(unlockStage)`) avec une prime de raid (~×1.7 au Tier 1),
 * un léger bonus pour les raids difficiles, et +~30 iLvl par tier supplémentaire.
 */
export function raidIlvl(def: RaidDef, tier: number): number {
  return Math.round(stageIlvl(def.unlockStage) * 1.5 + def.baseDifficulty * 16 + (tier - 1) * 30)
}

/**
 * Rareté du butin de raid — distribution en ÉVENTAIL (et non plus un plancher fixe qui
 * « écrasait » tout sur une seule rareté). On tire entre un plancher garanti `raidMinTier`
 * et un plafond `raidMaxTier` ; plus le tier monte, plus la distribution se décale vers le
 * haut (`raidRarityDecay`) et plus le « jackpot » est probable (`raidRarityJackpot`).
 */

/** Rareté plancher GARANTIE du butin (monte doucement avec le tier et la difficulté). */
export function raidMinTier(def: RaidDef, tier: number): number {
  return Math.min(12, 5 + Math.round((tier - 1) * 0.6) + Math.floor(def.baseDifficulty))
}

/** Rareté plafond ATTEIGNABLE : la fenêtre s'élargit vite (Transcendant aux hauts tiers). */
export function raidMaxTier(def: RaidDef, tier: number): number {
  return Math.min(16, raidMinTier(def, tier) + 4 + tier)
}

/**
 * Aplatissement de la distribution (0→1) : plus c'est proche de 1, plus le tirage « remonte »
 * vers le haut de la fenêtre. Croît avec le tier et la difficulté du raid.
 */
export function raidRarityDecay(def: RaidDef, tier: number): number {
  return Math.min(0.92, 0.5 + tier * 0.03 + def.baseDifficulty * 0.04)
}

/** Chance de « jackpot » (cran de rareté bonus au-delà du plafond), croissante avec le tier. */
export function raidRarityJackpot(def: RaidDef, tier: number): number {
  return Math.min(0.6, 0.05 + tier * 0.03 + def.baseDifficulty * 0.04)
}

/** Nombre d'objets dans le coffre. */
export function raidLootCount(def: RaidDef, tier: number): number {
  return 3 + Math.floor(tier / 2) + (def.id === 'abysse' ? 2 : 0)
}

/** Fragments d'éternité gagnés. */
export function raidFragments(def: RaidDef, tier: number): number {
  return 1 + tier + (def.id === 'abysse' ? tier : 0)
}

/** Chance d'Éclat cosmique 💫 (ressource ultra-rare, exclusive aux raids). */
export function raidCosmicChance(def: RaidDef, tier: number): number {
  const base = 0.04 + tier * 0.05
  return Math.min(0.95, base * (def.id === 'abysse' ? 2.2 : 1))
}

/** Quantité d'Éclats cosmiques quand le tirage réussit (plus aux hauts tiers / Abîme). */
export function raidCosmicQty(def: RaidDef, tier: number): number {
  return 1 + Math.floor(tier / 4) + (def.id === 'abysse' ? 1 : 0)
}

/** Type d'objet aléatoire dans la catégorie ciblée du raid. */
export function pickRaidLootType(def: RaidDef): ItemType {
  return pick(def.lootTypes)
}

/** DPS recommandé (sur le dernier boss, contre son timer d'enrage). */
export function recommendedDps(def: RaidDef, tier: number): number {
  const bosses = raidBossCount(def, tier)
  const hp = bossHp(def, tier, bosses - 1, bosses)
  return Math.round(hp / raidBerserkTime(def, tier))
}

/** PV effectifs recommandés (encaisser ~8 s du dernier boss + une nova). */
export function recommendedEhp(def: RaidDef, tier: number): number {
  const bosses = raidBossCount(def, tier)
  const dmg = bossDamage(def, tier, bosses - 1)
  const novaSpike = def.signature.includes('nova') ? dmg * 5 : 0
  return Math.round(dmg * 8 + novaSpike)
}

function bossHp(def: RaidDef, tier: number, bossIndex: number, totalBosses: number): number {
  const eff = effStage(def, tier, bossIndex)
  const isFinal = bossIndex === totalBosses - 1
  return Math.round(40 * Math.pow(1.18, eff - 1) * RAID_HP_PREMIUM * def.baseDifficulty * (isFinal ? FINAL_BOSS_MULT : 1))
}

function bossDamage(def: RaidDef, tier: number, bossIndex: number): number {
  const eff = effStage(def, tier, bossIndex)
  return Math.round(2.5 * Math.pow(1.12, eff - 1) * RAID_DMG_PREMIUM * def.baseDifficulty)
}

const BOSS_NAMES: Record<RaidId, string[]> = {
  forge: ['Hagen, l\'Enclume Vivante', 'Pyrax le Fondeur', 'Le Marteau Primordial', 'Vulcanar, Maître-Forge'],
  reliquaire: ['La Gardienne Noyée', 'Ossric aux Mille Bagues', 'Le Conservateur Éternel', 'Néréa des Profondeurs'],
  citadelle: ['Le Sénéchal de Foudre', 'Tour-Vivante Aldric', 'Le Rempart Hurlant', 'Castellan Vorn', 'L\'Orage Couronné'],
  nexus: ['Le Prisme Brisé', 'Iris, Cœur du Spectre', 'L\'ÉchO Polychrome', 'Chromax l\'Instable', 'Le Kaléidoscope'],
  abysse: ['Le Premier Silence', 'Nul, le Dévoreur', 'L\'Œil du Gouffre', 'Abyssa la Primordiale', 'Ce-Qui-Reste', 'Le Néant Couronné'],
}

/** Construit un boss de raid. `element` = type d'attaque courant (pour les raids 'rotating'). */
export function makeRaidBoss(def: RaidDef, tier: number, bossIndex: number, element: DamageType): Enemy {
  const totalBosses = raidBossCount(def, tier)
  const eff = effStage(def, tier, bossIndex)
  const maxHp = bossHp(def, tier, bossIndex, totalBosses)
  const isFinal = bossIndex === totalBosses - 1

  // Le boss RÉSISTE à son thème (élément maison), avec une vulnérabilité = porte de sortie.
  const home: DamageType = def.element === 'rotating' ? 'arcane' : def.element
  const resist: Partial<Record<DamageType, number>> = {}
  resist[home] = 0.55 + (def.signature.includes('fortress') ? FORTRESS_RESIST_BONUS : 0)
  resist[VULN[home]] = -0.3

  const armorMult = def.signature.includes('fortress') ? FORTRESS_ARMOR_MULT : 1.4
  const names = BOSS_NAMES[def.id]
  const name = `${def.icon} ${names[bossIndex % names.length]}`

  return {
    name: isFinal ? `★ ${name}` : name,
    maxHp,
    hp: maxHp,
    armor: Math.round((20 + eff * 2.2) * armorMult),
    damage: bossDamage(def, tier, bossIndex),
    xp: Math.round(8 * Math.pow(1.12, eff - 1) * 6),
    resist,
    damageType: element,
    elite: true,
  }
}

/**
 * Crée un RENFORT de raid (mécanique Déferlante) : un add temporaire qui frappe l'équipe puis
 * disparaît (`lifetime`). Délivre le « combat à plusieurs adversaires » sans casser le combat de boss.
 */
export function makeRaidAdd(def: RaidDef, tier: number, element: DamageType): Enemy {
  const eff = effStage(def, tier, 0)
  const hp = Math.round(40 * Math.pow(1.18, eff - 1) * 0.45 * def.baseDifficulty)
  return {
    name: `${def.icon} Rejeton`,
    maxHp: hp,
    hp,
    armor: Math.round(8 + eff),
    damage: Math.round(bossDamage(def, tier, 0) * 0.45),
    xp: 0,
    resist: {},
    damageType: element,
    lifetime: 8,
    add: true,
  }
}

/** Crée le cycle d'éléments d'attaque (raids 'rotating'/mécanique 'rotate'). */
function rotateListFor(def: RaidDef): DamageType[] {
  if (def.element === 'rotating') return [...ELEMENTS]
  // Raid à élément fixe : pas de rotation (un seul élément).
  return [def.element]
}

/** Génère un raid prêt à jouer. */
export function generateRaid(raidId: RaidId, tier: number): ActiveRaid {
  const def = RAIDS[raidId]
  const totalBosses = raidBossCount(def, tier)
  const rotateList = rotateListFor(def)
  const startEl = rotateList[0]
  return {
    raidId,
    tier,
    name: `${def.name} · Tier ${tier}`,
    current: 0,
    totalBosses,
    enemies: [makeRaidBoss(def, tier, 0, startEl)],
    mechanics: def.signature,
    element: startEl,
    rotateList,
    rotateIdx: 0,
    fightTime: 0,
    novaCd: 6,
    swarmCd: 5,
    rotateCd: 8,
    berserkAt: raidBerserkTime(def, tier),
  }
}
