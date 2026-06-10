import type { DamageType, Enemy, EnemyAbility, ItemType } from './types'
import { DAMAGE_TYPE_LIST } from './damage'
import { stageIlvl } from './enemies'

/**
 * RAIDS — refonte v0.23 « un boss, dix tiers ».
 *
 * Chaque raid est désormais UN AFFRONTEMENT UNIQUE contre un boss (un duo pour l'Abîme),
 * et le boss CHANGE À CHAQUE TIER : 5 visages par raid, chacun avec son kit télégraphié et
 * sa mécanique propre, qui reviennent « Éveillés » (plus vicieux) au-delà du tier 5.
 *
 *  - une IDENTITÉ par raid (lore, couleur, mécaniques signature),
 *  - un BUTIN CIBLÉ par catégorie d'équipement (Armes / Bijoux / Armures / Résistances / Tout),
 *  - des TIERS montés indépendamment, à la courbe DOUCE ET CONSTANTE : chaque tier = +4 paliers
 *    de farm (×~1,9 PV) — fini le mur exponentiel ; ~10 tiers sont atteignables,
 *  - un VRAI GAP de récompense entre tiers : ~+19 iLvl et +1 rang de rareté plancher par tier,
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
  /** Palier de déblocage (bestStage requis) — porte d'ACCÈS uniquement. */
  unlockStage: number
  /**
   * Ancre de DIFFICULTÉ (palier de farm de référence du Tier 1). Par défaut = unlockStage.
   * L'Abîme s'en sert pour être calé sur un Tier ~6 des autres raids (accessible) tout en
   * restant verrouillé derrière le palier 100.
   */
  anchorStage?: number
  /** Raid prérequis : doit avoir été clear (tier ≥ 1) au moins une fois. */
  requires?: RaidId
  /** Difficulté de base : multiplie PV et dégâts (≥1, monte d'un raid à l'autre). */
  baseDifficulty: number
  /** Mécaniques signature imposées (identité du raid — les boss de tier en AJOUTENT). */
  signature: RaidMechanicKind[]
  /** Élément principal, ou 'rotating' (le boss cycle les types d'attaque). */
  element: DamageType | 'rotating'
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
    unlockStage: 50, baseDifficulty: 1.0, signature: ['fortress', 'berserk'], element: 'physique', orbeCost: 1,
  },
  reliquaire: {
    id: 'reliquaire', name: 'Le Reliquaire Englouti', icon: '💍', color: '#4dd0e1',
    lore: 'Une crypte noyée où dorment les joyaux des rois morts. Leurs gardiens se ressoudent sans cesse — frappe vite et fort.',
    lootTypes: ['anneau', 'bijou', 'cou'], lootLabel: 'Anneaux, Bijoux & Colliers',
    unlockStage: 50, baseDifficulty: 1.3, signature: ['leech', 'swarm'], element: 'froid', orbeCost: 1,
  },
  citadelle: {
    id: 'citadelle', name: 'La Citadelle Éternelle', icon: '🏰', color: '#ffd43b',
    lore: 'Une forteresse battue par des orages sans fin. Ses sentinelles déchaînent des novas — seule une muraille de PV tient debout.',
    lootTypes: ['tete', 'epaules', 'torse', 'jambes', 'mains', 'taille', 'pieds', 'poignets', 'cape'], lootLabel: 'Pièces d\'armure',
    unlockStage: 50, baseDifficulty: 1.6, signature: ['nova', 'execute'], element: 'foudre', orbeCost: 1,
  },
  nexus: {
    id: 'nexus', name: 'Le Nexus Prismatique', icon: '🌈', color: '#c084fc',
    lore: 'Un cœur de magie pure où la réalité se fracture en sept couleurs. Le boss change d\'élément sans prévenir : résiste à tout, ou meurs.',
    lootTypes: ['cou', 'cape', 'bijou', 'anneau'], lootLabel: 'Accessoires de résistance',
    unlockStage: 50, baseDifficulty: 1.9, signature: ['rotate', 'nova'], element: 'rotating', orbeCost: 2,
  },
  abysse: {
    id: 'abysse', name: 'L\'Abîme Primordial', icon: '🕳️', color: '#8a2be2',
    lore: 'Le gouffre d\'où tout est né et où tout retourne. Les horreurs y chassent PAR PAIRES : abats l\'une, l\'autre entre en furie. Seul endroit au monde où tombe la Régalia du Néant.',
    lootTypes: ['tete', 'epaules', 'torse', 'jambes', 'mains', 'taille', 'pieds', 'poignets', 'cape', 'cou', 'anneau', 'bijou', 'armePrincipale', 'armeSecondaire'], lootLabel: 'Tout + set Régalia du Néant',
    // v0.23 : l'Abîme était EXTRÊMEMENT overtuné (ancré au palier 100 → des milliards de PV au T1).
    // Il reste verrouillé derrière le palier 100, mais sa DIFFICULTÉ est ancrée au palier 70 :
    // son Tier 1 ≈ un Tier 6 du Nexus, puis il scale au même pas (+4 paliers/tier).
    unlockStage: 100, anchorStage: 70, requires: 'nexus', baseDifficulty: 1.9, signature: ['berserk', 'nova'], element: 'rotating', orbeCost: 3,
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
const SOLO_BOSS_MULT = 1.7        // l'unique boss du raid est un vrai morceau (il remplace 3-5 combats)
/**
 * Pas (en paliers de farm) entre deux tiers — CONSTANT (v0.23). Avant : pas de 8 paliers qui
 * GRANDISSAIT de +2 par tier → le tier 10 cumulait +144 paliers (×10¹⁰ PV), inatteignable.
 * Désormais chaque tier = +4 paliers (×~1,9 PV) : ~10 tiers se montent sur une partie.
 */
const TIER_STAGE_STEP = 4

/** Paliers de farm cumulés ajoutés par les tiers (linéaire — courbe douce et prévisible). */
function tierStageOffset(tier: number): number {
  return (tier - 1) * TIER_STAGE_STEP
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
  /** Index du boss en cours (toujours 0 depuis la v0.23 — un seul affrontement). */
  current: number
  totalBosses: number
  /** enemies[0] = le boss (cible d'objectif) ; les suivants = jumeau d'Abîme / renforts (Déferlante). */
  enemies: Enemy[]
  /** Mécaniques du TIER (signature du raid + celles du boss du tier). */
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
  /** Relances automatiques restantes (auto-farm) : à la fin du raid, on relance si > 0 et Orbes suffisantes. */
  repeatLeft?: number
}

/** Palier de farm « effectif » du boss d'un tier (sert à toutes les courbes). */
function effStage(def: RaidDef, tier: number): number {
  return (def.anchorStage ?? def.unlockStage) + tierStageOffset(tier)
}

/** Délai d'enrage dur (s) — rétrécit doucement avec le tier → exige toujours plus de DPS. */
export function raidBerserkTime(def: RaidDef, tier: number): number {
  return Math.max(16, 32 - tier * 1.2 - def.baseDifficulty * 2)
}

/**
 * iLvl du butin (les raids restent la meilleure source de stuff du jeu).
 * v0.23 : ancré sur le palier EFFECTIF du tier + un VRAI gap par tier (~+19 iLvl) — chaque tier
 * vaincu équipe concrètement pour le suivant. L'Abîme, ancré plus haut, loote au-dessus de tous.
 */
export function raidIlvl(def: RaidDef, tier: number): number {
  return Math.round(stageIlvl(effStage(def, tier)) * 1.12 + def.baseDifficulty * 8 + (tier - 1) * 12)
}

/**
 * Rareté du butin de raid — distribution en ÉVENTAIL entre un plancher garanti `raidMinTier`
 * et un plafond `raidMaxTier`, avec jackpot au-dessus. v0.23 : le plancher monte d'UN RANG
 * PLEIN par tier (vrai gap de rareté) ; les raids sont LA source du stuff au-delà d'Éternel.
 */

/** Rareté plancher GARANTIE du butin (+1 rang par tier ; l'Abîme part un cran au-dessus). */
export function raidMinTier(def: RaidDef, tier: number): number {
  const cap = def.id === 'abysse' ? 13 : 12
  return Math.min(cap, 4 + Math.round(def.baseDifficulty) + (tier - 1) + (def.id === 'abysse' ? 1 : 0))
}

/** Rareté plafond ATTEIGNABLE : la fenêtre s'élargit avec le tier (Transcendant aux hauts tiers). */
export function raidMaxTier(def: RaidDef, tier: number): number {
  return Math.min(16, raidMinTier(def, tier) + 3 + Math.floor(tier / 2))
}

/**
 * Aplatissement de la distribution (0→1) : plus c'est proche de 1, plus le tirage « remonte »
 * vers le haut de la fenêtre. Croît avec le tier et la difficulté du raid.
 */
export function raidRarityDecay(def: RaidDef, tier: number): number {
  return Math.min(0.92, 0.5 + tier * 0.04 + def.baseDifficulty * 0.04)
}

/** Chance de « jackpot » (cran de rareté bonus au-delà du plafond), croissante avec le tier. */
export function raidRarityJackpot(def: RaidDef, tier: number): number {
  return Math.min(0.5, 0.04 + tier * 0.04 + def.baseDifficulty * 0.03)
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

// ---- Boss de tier : 5 visages par raid, chacun avec sa mécanique et son kit ----

/** Cale les premières incantations d'un kit (pas de salve à t=0). */
function stagger(out: EnemyAbility[]): EnemyAbility[] {
  out.forEach((a, i) => { a.cd = a.cooldown * (0.6 + i * 0.35) })
  return out
}

export interface RaidBossVariant {
  name: string
  /** Identité mécanique du tier — une ligne, affichée au joueur. */
  blurb: string
  /** Mécaniques AJOUTÉES à la signature du raid pour ce boss. */
  extra: RaidMechanicKind[]
  /** Tweaks de stats (1 = neutre). */
  hp?: number
  dmg?: number
  armor?: number
  /** Rotation d'éléments imposée par CE boss (raids à élément fixe qui « tournent » sur ce tier). */
  rotate?: DamageType[]
  /** Kit de techniques télégraphiées (element = type d'attaque courant). */
  abilities: (element: DamageType) => EnemyAbility[]
  /** Abîme uniquement : nom et kit du JUMEAU du duo. */
  partnerName?: string
  partnerAbilities?: () => EnemyAbility[]
}

/**
 * Les visages de chaque raid : le tier T affronte le boss (T-1) mod 5. Au-delà du tier 5,
 * les mêmes reviennent « ÉVEILLÉS » : +1 mécanique, +12% de dégâts (voir raidBossVariant).
 */
const RAID_BOSSES: Record<RaidId, RaidBossVariant[]> = {
  forge: [
    {
      name: 'Hagen, l\'Enclume Vivante', blurb: 'Un mur de métal : armure colossale, marteau télégraphié à parer.',
      extra: [], armor: 1.25,
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Marteau-pilon', icon: '🔨', cooldown: 11, magnitude: 3.0, telegraph: 1.8 },
        { kind: 'dot', element: 'feu', name: 'Coulée de fonte', icon: '🌋', cooldown: 8, magnitude: 0.9, duration: 4 },
      ],
    },
    {
      name: 'Pyrax le Fondeur', blurb: 'La forge déborde : éruptions de zone et métal en fusion qui ronge l\'équipe.',
      extra: ['nova'], hp: 0.95,
      abilities: () => [
        { kind: 'burst', element: 'feu', name: 'Geyser de fonte', icon: '🌋', cooldown: 10, magnitude: 2.8, telegraph: 1.6 },
        { kind: 'dot', element: 'feu', name: 'Métal liquide', icon: '🫠', cooldown: 7, magnitude: 1.1, duration: 5 },
      ],
    },
    {
      name: 'Le Marteau Primordial', blurb: 'Course contre l\'enclume : moins de PV, mais il s\'acharne — du DPS, vite.',
      extra: ['execute'], hp: 0.8, dmg: 1.1,
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Frappe sismique', icon: '💥', cooldown: 10, magnitude: 3.4, telegraph: 1.7 },
        { kind: 'cc', element: 'physique', name: 'Onde assourdissante', icon: '🔔', cooldown: 12, magnitude: 0, duration: 1.5 },
      ],
    },
    {
      name: 'Vulcanar, Maître-Forge', blurb: 'Ses automates déferlent sans fin : survie de groupe exigée.',
      extra: ['swarm'],
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Marteau-pilon', icon: '🔨', cooldown: 11, magnitude: 2.9, telegraph: 1.8 },
        { kind: 'debuff', element: 'arcane', name: 'Appel de la chaîne', icon: '⛓️', cooldown: 12, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'L\'Âme de la Forge', blurb: 'Le feu originel se ressoude sans cesse : du burst, à travers l\'armure.',
      extra: ['leech'], armor: 1.15,
      abilities: () => [
        { kind: 'burst', element: 'feu', name: 'Souffle du creuset', icon: '🔥', cooldown: 11, magnitude: 3.2, telegraph: 1.9 },
        { kind: 'dot', element: 'feu', name: 'Brasier éternel', icon: '♨️', cooldown: 8, magnitude: 1.0, duration: 4 },
        { kind: 'drain', element: 'feu', name: 'Fonte vampirique', icon: '🩸', cooldown: 14, magnitude: 1.6 },
      ],
    },
  ],
  reliquaire: [
    {
      name: 'La Gardienne Noyée', blurb: 'Les flots la ressoudent : burst obligatoire, raz-de-marée à parer.',
      extra: [],
      abilities: () => [
        { kind: 'burst', element: 'froid', name: 'Raz-de-marée abyssal', icon: '🌊', cooldown: 10, magnitude: 2.8, telegraph: 1.6 },
        { kind: 'cc', element: 'froid', name: 'Étreinte glaçante', icon: '🧊', cooldown: 12, magnitude: 0, duration: 1.6 },
      ],
    },
    {
      name: 'Ossric aux Mille Bagues', blurb: 'L\'avare drape sa vie dans la tienne : drains et malédictions.',
      extra: [], armor: 1.1,
      abilities: () => [
        { kind: 'drain', element: 'arcane', name: 'Dîme des anneaux', icon: '💍', cooldown: 12, magnitude: 1.8 },
        { kind: 'debuff', element: 'arcane', name: 'Malédiction d\'avarice', icon: '🪙', cooldown: 10, magnitude: 0, duration: 6 },
        { kind: 'burst', element: 'froid', name: 'Pluie de joyaux', icon: '💎', cooldown: 13, magnitude: 2.6, telegraph: 1.5 },
      ],
    },
    {
      name: 'Le Conservateur Éternel', blurb: 'Une vitrine blindée : armure de musée et contrôles glaçants.',
      extra: ['fortress'], hp: 1.1, dmg: 0.9,
      abilities: () => [
        { kind: 'cc', element: 'froid', name: 'Mise sous verre', icon: '🫙', cooldown: 11, magnitude: 0, duration: 1.8 },
        { kind: 'dot', element: 'froid', name: 'Givre conservateur', icon: '❄️', cooldown: 8, magnitude: 0.9, duration: 5 },
      ],
    },
    {
      name: 'Néréa des Profondeurs', blurb: 'L\'abîme se soulève : lames de fond glacées en cadence.',
      extra: ['nova'],
      abilities: () => [
        { kind: 'burst', element: 'froid', name: 'Lame de fond', icon: '🌊', cooldown: 10, magnitude: 3.2, telegraph: 1.8 },
        { kind: 'debuff', element: 'froid', name: 'Chant des noyés', icon: '🎶', cooldown: 13, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'Le Roi des Marées', blurb: 'Plus il saigne, plus la marée frappe fort — achève-le vite.',
      extra: ['execute', 'nova'], hp: 1.05,
      abilities: () => [
        { kind: 'burst', element: 'froid', name: 'Vague scélérate', icon: '🌊', cooldown: 11, magnitude: 3.5, telegraph: 2.0 },
        { kind: 'dot', element: 'froid', name: 'Ressac', icon: '🌀', cooldown: 8, magnitude: 1.0, duration: 4 },
        { kind: 'drain', element: 'froid', name: 'Reflux', icon: '🩸', cooldown: 14, magnitude: 1.6 },
      ],
    },
  ],
  citadelle: [
    {
      name: 'Le Sénéchal de Foudre', blurb: 'L\'orage au garde-à-vous : novas réglées comme du papier à musique.',
      extra: [],
      abilities: () => [
        { kind: 'burst', element: 'foudre', name: 'Fracas du ciel', icon: '🌩️', cooldown: 11, magnitude: 3.4, telegraph: 2.0 },
        { kind: 'cc', element: 'foudre', name: 'Tonnerre assourdissant', icon: '🔔', cooldown: 13, magnitude: 0, duration: 1.4 },
      ],
    },
    {
      name: 'Tour-Vivante Aldric', blurb: 'Une tour qui marche : armure colossale, coups lents mais écrasants.',
      extra: ['fortress'], armor: 1.3, hp: 1.1, dmg: 0.95,
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Chute de créneaux', icon: '🧱', cooldown: 13, magnitude: 3.6, telegraph: 2.2 },
        { kind: 'cc', element: 'physique', name: 'Verrouillage', icon: '🔒', cooldown: 12, magnitude: 0, duration: 1.6 },
      ],
    },
    {
      name: 'Le Rempart Hurlant', blurb: 'Son hurlement appelle la garnison : renforts en vagues continues.',
      extra: ['swarm'],
      abilities: () => [
        { kind: 'debuff', element: 'foudre', name: 'Hurlement du rempart', icon: '📢', cooldown: 11, magnitude: 0, duration: 5 },
        { kind: 'burst', element: 'foudre', name: 'Salve de tourelles', icon: '🏹', cooldown: 9, magnitude: 2.8, telegraph: 1.5 },
      ],
    },
    {
      name: 'Castellan Vorn', blurb: 'Il se nourrit de l\'orage : régénération continue, burst exigé.',
      extra: ['leech'],
      abilities: () => [
        { kind: 'drain', element: 'foudre', name: 'Siphon d\'orage', icon: '⚡', cooldown: 13, magnitude: 1.7 },
        { kind: 'burst', element: 'foudre', name: 'Fracas du ciel', icon: '🌩️', cooldown: 11, magnitude: 3.2, telegraph: 1.9 },
      ],
    },
    {
      name: 'L\'Orage Couronné', blurb: 'Le ciel entier se déchaîne — et change de visage : foudre, froid, nature.',
      extra: ['rotate'], rotate: ['foudre', 'froid', 'nature'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Couronnement', icon: '👑', cooldown: 10, magnitude: 3.3, telegraph: 1.8 },
        { kind: 'dot', element: 'nature', name: 'Pluie battante', icon: '🌧️', cooldown: 8, magnitude: 0.9, duration: 4 },
      ],
    },
  ],
  nexus: [
    {
      name: 'Le Prisme Brisé', blurb: 'Sept couleurs, sept morsures : résiste à tout.',
      extra: [],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Rayon prismatique', icon: '🔆', cooldown: 9, magnitude: 3.0, telegraph: 1.6 },
        { kind: 'debuff', element: 'arcane', name: 'Distorsion chromatique', icon: '🌀', cooldown: 12, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'Iris, Cœur du Spectre', blurb: 'Elle boit la lumière : sa vie remonte sans cesse.',
      extra: ['leech'],
      abilities: (element) => [
        { kind: 'drain', element: 'arcane', name: 'Absorption spectrale', icon: '👁️', cooldown: 12, magnitude: 1.8 },
        { kind: 'burst', element, name: 'Rayon prismatique', icon: '🔆', cooldown: 10, magnitude: 2.9, telegraph: 1.6 },
      ],
    },
    {
      name: 'L\'Écho Polychrome', blurb: 'Chaque couleur fait naître un écho : la nuée submerge.',
      extra: ['swarm'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Réverbération', icon: '🔊', cooldown: 9, magnitude: 2.7, telegraph: 1.5 },
        { kind: 'debuff', element: 'arcane', name: 'Écho dissonant', icon: '🎭', cooldown: 11, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'Chromax l\'Instable', blurb: 'Une bombe arc-en-ciel : enrage express et fission continue.',
      extra: ['berserk'], hp: 0.9, dmg: 1.05,
      abilities: (element) => [
        { kind: 'burst', element, name: 'Surcharge chromatique', icon: '💥', cooldown: 9, magnitude: 3.4, telegraph: 1.6 },
        { kind: 'dot', element: 'arcane', name: 'Fission', icon: '☢️', cooldown: 7, magnitude: 1.0, duration: 4 },
      ],
    },
    {
      name: 'Le Kaléidoscope', blurb: 'Toutes les couleurs à la fois : un mur prismatique qui s\'acharne.',
      extra: ['fortress', 'execute'], armor: 1.2, hp: 1.1,
      abilities: (element) => [
        { kind: 'burst', element, name: 'Spirale kaléidoscopique', icon: '🌀', cooldown: 10, magnitude: 3.2, telegraph: 1.8 },
        { kind: 'dot', element: 'arcane', name: 'Facettes coupantes', icon: '🔪', cooldown: 8, magnitude: 0.9, duration: 4 },
        { kind: 'cc', element: 'arcane', name: 'Verre figeant', icon: '🫙', cooldown: 13, magnitude: 0, duration: 1.4 },
      ],
    },
  ],
  abysse: [
    {
      name: 'Le Premier Silence', partnerName: 'Nul, le Dévoreur',
      blurb: 'Le silence annihile, le dévoreur boit : pare l\'Annihilation ou meurs.',
      extra: ['fortress'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Annihilation', icon: '💥', cooldown: 12, magnitude: 4.0, telegraph: 2.2 },
        { kind: 'dot', element: 'ombre', name: 'Corruption du néant', icon: '🕳️', cooldown: 8, magnitude: 1.0, duration: 5 },
      ],
      partnerAbilities: () => [
        { kind: 'cc', element: 'ombre', name: 'Étreinte du vide', icon: '🕳️', cooldown: 11, magnitude: 0, duration: 1.8 },
        { kind: 'drain', element: 'ombre', name: 'Dévoration', icon: '👄', cooldown: 13, magnitude: 1.8 },
      ],
    },
    {
      name: 'L\'Œil du Gouffre', partnerName: 'Ce-Qui-Reste',
      blurb: 'L\'Œil voit tes failles — plus tu le blesses, plus il frappe ; Ce-Qui-Reste te draine.',
      extra: ['execute'],
      abilities: () => [
        { kind: 'burst', element: 'ombre', name: 'Regard qui défait', icon: '👁️', cooldown: 11, magnitude: 3.8, telegraph: 2.0 },
        { kind: 'debuff', element: 'arcane', name: 'Iris du vide', icon: '🌀', cooldown: 10, magnitude: 0, duration: 6 },
      ],
      partnerAbilities: () => [
        { kind: 'dot', element: 'ombre', name: 'Lambeaux', icon: '🩹', cooldown: 7, magnitude: 1.1, duration: 5 },
        { kind: 'drain', element: 'ombre', name: 'Siphon d\'essence', icon: '🫗', cooldown: 13, magnitude: 1.6 },
      ],
    },
    {
      name: 'Abyssa la Primordiale', partnerName: 'Le Néant Couronné',
      blurb: 'Le couple royal du gouffre : leur cour déferle en renforts incessants.',
      extra: ['swarm'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Annihilation', icon: '💥', cooldown: 12, magnitude: 4.0, telegraph: 2.2 },
        { kind: 'debuff', element: 'ombre', name: 'Couronne d\'ombre', icon: '👑', cooldown: 12, magnitude: 0, duration: 5 },
      ],
      partnerAbilities: () => [
        { kind: 'cc', element: 'ombre', name: 'Étreinte du vide', icon: '🕳️', cooldown: 11, magnitude: 0, duration: 1.8 },
        { kind: 'drain', element: 'ombre', name: 'Tribut du Néant', icon: '🫴', cooldown: 14, magnitude: 1.7 },
      ],
    },
    {
      name: 'La Faim', partnerName: 'La Soif',
      blurb: 'Deux gueules, un seul appétit : tout ce qu\'elles touchent les nourrit.',
      extra: ['leech'],
      abilities: () => [
        { kind: 'burst', element: 'ombre', name: 'Gueule béante', icon: '🦷', cooldown: 10, magnitude: 3.6, telegraph: 1.8 },
        { kind: 'drain', element: 'ombre', name: 'Voracité', icon: '👄', cooldown: 12, magnitude: 2.0 },
      ],
      partnerAbilities: () => [
        { kind: 'drain', element: 'froid', name: 'Soif inextinguible', icon: '🥶', cooldown: 12, magnitude: 2.0 },
        { kind: 'debuff', element: 'arcane', name: 'Assèchement', icon: '🏜️', cooldown: 11, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'L\'Avant-Monde', partnerName: 'L\'Après-Tout',
      blurb: 'Ce qui fut et ce qui sera : le temps se fracture, les éléments défilent.',
      extra: ['rotate', 'fortress'], armor: 1.15,
      abilities: (element) => [
        { kind: 'burst', element, name: 'Annihilation', icon: '💥', cooldown: 12, magnitude: 4.2, telegraph: 2.3 },
        { kind: 'cc', element: 'arcane', name: 'Paradoxe', icon: '⏳', cooldown: 12, magnitude: 0, duration: 1.6 },
      ],
      partnerAbilities: () => [
        { kind: 'dot', element: 'arcane', name: 'Échos d\'avant', icon: '🌀', cooldown: 8, magnitude: 1.0, duration: 5 },
        { kind: 'drain', element: 'arcane', name: 'Siphon temporel', icon: '⌛', cooldown: 13, magnitude: 1.7 },
      ],
    },
  ],
}

/** Ordre d'octroi de la mécanique bonus des boss ÉVEILLÉS (la première absente du kit du tier). */
const AWAKENED_EXTRA: RaidMechanicKind[] = ['execute', 'leech', 'swarm', 'fortress', 'berserk', 'nova', 'rotate']
/** Bonus de dégâts des boss Éveillés (tiers 6+). */
const AWAKENED_DMG = 1.12
const AWAKENED_HP = 1.05

export interface ResolvedBoss {
  variant: RaidBossVariant
  name: string
  partnerName?: string
  blurb: string
  /** Mécaniques complètes du tier (signature + boss + éveil). */
  mechanics: RaidMechanicKind[]
  awakened: boolean
  hpMult: number
  dmgMult: number
  armorMult: number
}

/** Résout le boss d'un tier : visage (cycle de 5), mécaniques fusionnées, éveil au-delà du tier 5. */
export function raidBossVariant(def: RaidDef, tier: number): ResolvedBoss {
  const list = RAID_BOSSES[def.id]
  const variant = list[(Math.max(1, tier) - 1) % list.length]
  const awakened = tier > list.length
  const mechanics: RaidMechanicKind[] = [...def.signature]
  for (const m of variant.extra) if (!mechanics.includes(m)) mechanics.push(m)
  if (awakened) {
    const bonus = AWAKENED_EXTRA.find((m) => !mechanics.includes(m))
    if (bonus) mechanics.push(bonus)
  }
  return {
    variant,
    name: awakened ? `${variant.name} · Éveillé` : variant.name,
    ...(variant.partnerName ? { partnerName: awakened ? `${variant.partnerName} · Éveillé` : variant.partnerName } : {}),
    blurb: awakened ? `${variant.blurb} ÉVEILLÉ : une mécanique de plus, des coups plus durs.` : variant.blurb,
    mechanics,
    awakened,
    hpMult: (variant.hp ?? 1) * (awakened ? AWAKENED_HP : 1),
    dmgMult: (variant.dmg ?? 1) * (awakened ? AWAKENED_DMG : 1),
    armorMult: variant.armor ?? 1,
  }
}

/** Mécaniques complètes d'un tier (raccourci pour l'UI et les recommandations). */
export function raidMechanics(def: RaidDef, tier: number): RaidMechanicKind[] {
  return raidBossVariant(def, tier).mechanics
}

/** DPS recommandé (contre le timer d'enrage). L'Abîme = duo (+10% de PV totaux). */
export function recommendedDps(def: RaidDef, tier: number): number {
  const hp = bossHp(def, tier) * (def.id === 'abysse' ? PAIR_HP_TOTAL : 1)
  return Math.round(hp / raidBerserkTime(def, tier))
}

/** PV effectifs recommandés (encaisser ~8 s du boss + une nova). */
export function recommendedEhp(def: RaidDef, tier: number): number {
  const dmg = bossDamage(def, tier)
  const novaSpike = raidMechanics(def, tier).includes('nova') ? dmg * NOVA_MULT : 0
  return Math.round(dmg * 8 + novaSpike)
}

/** Multiplicateur de la Nova cataclysmique (AoE périodique) — partagé avec le tick de combat. */
export const NOVA_MULT = 4.5

function bossHp(def: RaidDef, tier: number): number {
  const eff = effStage(def, tier)
  const v = raidBossVariant(def, tier)
  return Math.round(40 * Math.pow(1.18, eff - 1) * RAID_HP_PREMIUM * def.baseDifficulty * SOLO_BOSS_MULT * v.hpMult)
}

function bossDamage(def: RaidDef, tier: number): number {
  const eff = effStage(def, tier)
  const v = raidBossVariant(def, tier)
  return Math.round(2.5 * Math.pow(1.12, eff - 1) * RAID_DMG_PREMIUM * def.baseDifficulty * v.dmgMult)
}

/** Construit le boss du tier. `element` = type d'attaque courant (pour les raids 'rotating'). */
export function makeRaidBoss(def: RaidDef, tier: number, element: DamageType): Enemy {
  const eff = effStage(def, tier)
  const v = raidBossVariant(def, tier)
  const maxHp = bossHp(def, tier)

  // Le boss RÉSISTE à son thème (élément maison), avec une vulnérabilité = porte de sortie.
  const home: DamageType = def.element === 'rotating' ? 'arcane' : def.element
  const resist: Partial<Record<DamageType, number>> = {}
  resist[home] = 0.55 + (v.mechanics.includes('fortress') ? FORTRESS_RESIST_BONUS : 0)
  resist[VULN[home]] = -0.3

  const armorMult = (v.mechanics.includes('fortress') ? FORTRESS_ARMOR_MULT : 1.4) * v.armorMult

  return {
    name: `★ ${def.icon} ${v.name}`,
    maxHp,
    hp: maxHp,
    armor: Math.round((20 + eff * 2.2) * armorMult),
    damage: bossDamage(def, tier),
    xp: Math.round(8 * Math.pow(1.12, eff - 1) * 6),
    resist,
    damageType: element,
    elite: true,
    // Boss de raid : esquive marquée (→ Précision) + étourdissement régulier (→ Ténacité).
    boss: true,
    dodge: 0.2,
    ccDur: 2,
    ccCd: 6,
    // Kit signature TÉLÉGRAPHIÉ du boss du tier — à contrer (bouclier/immunité/Ténacité/Purge…).
    abilities: stagger(v.variant.abilities(element)),
  }
}

// ---- Duo de l'Abîme : les boss chassent PAR PAIRES (kits distincts, furie du survivant) ----

/** Répartition des PV du duo : chaque membre porte 55% des PV d'un boss seul (total ×1,1). */
const PAIR_HP_FRAC = 0.55
const PAIR_HP_TOTAL = PAIR_HP_FRAC * 2
/** Dégâts de chaque membre du duo (le total dépasse un boss seul → pression de groupe). */
const PAIR_DMG_FRAC = 0.7
/** Furie du survivant : multiplicateur de dégâts quand son jumeau meurt. */
export const PAIR_ENRAGE_MULT = 1.5

/**
 * Construit la RENCONTRE d'un tier : le boss du tier seul, ou le DUO de l'Abîme — deux boss
 * simultanés aux pouvoirs distincts (burst télégraphié d'un côté, contrôle/drain de l'autre).
 * Quand l'un tombe, l'autre entre en FURIE (+50% dégâts) → l'ordre de kill et les contres comptent.
 */
export function makeRaidEncounter(def: RaidDef, tier: number, element: DamageType): Enemy[] {
  const main = makeRaidBoss(def, tier, element)
  const v = raidBossVariant(def, tier)
  if (def.id !== 'abysse' || !v.partnerName) return [main]
  const partner: Enemy = {
    ...main,
    name: `★ ${def.icon} ${v.partnerName}`,
    maxHp: Math.round(main.maxHp * PAIR_HP_FRAC),
    hp: Math.round(main.maxHp * PAIR_HP_FRAC),
    damage: Math.round(main.damage * PAIR_DMG_FRAC),
    xp: Math.round(main.xp * 0.5),
    abilities: stagger(v.variant.partnerAbilities ? v.variant.partnerAbilities() : []),
  }
  main.maxHp = Math.round(main.maxHp * PAIR_HP_FRAC)
  main.hp = main.maxHp
  main.damage = Math.round(main.damage * PAIR_DMG_FRAC)
  return [main, partner]
}

/**
 * Crée un RENFORT de raid (mécanique Déferlante) : un add temporaire qui frappe l'équipe puis
 * disparaît (`lifetime`). Délivre le « combat à plusieurs adversaires » sans casser le combat de boss.
 */
export function makeRaidAdd(def: RaidDef, tier: number, element: DamageType): Enemy {
  const eff = effStage(def, tier)
  const hp = Math.round(40 * Math.pow(1.18, eff - 1) * 0.45 * def.baseDifficulty)
  return {
    name: `${def.icon} Rejeton`,
    maxHp: hp,
    hp,
    armor: Math.round(8 + eff),
    damage: Math.round(bossDamage(def, tier) * 0.45),
    xp: 0,
    resist: {},
    damageType: element,
    lifetime: 8,
    add: true,
  }
}

/** Crée le cycle d'éléments d'attaque (raids 'rotating' / boss de tier qui « tournent »). */
function rotateListFor(def: RaidDef, tier: number): DamageType[] {
  const v = raidBossVariant(def, tier)
  if (v.variant.rotate) return [...v.variant.rotate]
  if (def.element === 'rotating') return [...ELEMENTS]
  // Raid à élément fixe : pas de rotation (un seul élément).
  return [def.element]
}

/** Génère un raid prêt à jouer : UN affrontement contre le boss du tier. */
export function generateRaid(raidId: RaidId, tier: number): ActiveRaid {
  const def = RAIDS[raidId]
  const v = raidBossVariant(def, tier)
  const rotateList = rotateListFor(def, tier)
  const startEl = rotateList[0]
  return {
    raidId,
    tier,
    name: `${def.name} · Tier ${tier}`,
    current: 0,
    totalBosses: 1,
    enemies: makeRaidEncounter(def, tier, startEl),
    mechanics: v.mechanics,
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
