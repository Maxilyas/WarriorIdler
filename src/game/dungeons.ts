import type { DamageType, Enemy } from './types'
import { DAMAGE_TYPES, elementAffinityResist } from './damage'
import type { GemFamily } from './condGems'
import { dungeonReq } from './resist'
import { enemyHp, enemyDmg, enemyArmor, lootFarmIlvl, frontierIlvl, CHAPITRE_SIZE } from './progression'
import { murSoftness } from './enemies'
import { ENEMY_DODGE } from './stats'
import { accessibleRarityTier, materialYieldAtChapter } from './items'

/**
 * DONJONS « par RESSOURCE ».
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
 * Boucle voulue : taper les vagues classiques → farmer les donjons (ressources/stuff)
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
  /**
   * Ancre de DIFFICULTÉ (sert au décalage de départ) quand elle diffère de la vague de déblocage —
   * même idée que les raids : l'Observatoire est GATÉ à la vague 50 (contenu endgame, timing de la
   * poussière 🌌) mais sa difficulté reste calée sur 45.
   */
  anchorStage?: number
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
    element: 'arcane', unlockStage: 8, sceauCost: 1,
  },
  noyau: {
    id: 'noyau', name: 'Forge du Noyau', icon: '💠', color: '#f783ac', reward: 'noyau',
    lore: 'Au cœur d\'un volcan, des golems de fonte gardent les Noyaux primordiaux — désormais l\'UNIQUE source de ce matériau de craft.',
    trait: 'armure', traitLabel: 'Golems blindés : sans Pénétration, ton DPS s\'effondre.',
    element: 'feu', unlockStage: 12, sceauCost: 1,
  },
  butin: {
    id: 'butin', name: 'Cache du Pilleur', icon: '🎒', color: '#a78bfa', reward: 'stuff',
    lore: 'Le repaire d\'un seigneur-voleur, gardé par ses lieutenants d\'élite. Le butin monte en rareté avec le niveau, jusqu\'à Artefact — au-delà, seul un tirage infime perce le voile (Éternel max). Les raretés cosmiques sont l\'apanage des raids.',
    trait: 'elite', traitLabel: 'Lieutenants d\'élite coriaces → DPS soutenu et Dégâts vs Boss.',
    element: 'ombre', unlockStage: 12, sceauCost: 1,
  },
  geode: {
    id: 'geode', name: 'La Géode', icon: '🔹', color: '#38bdf8', reward: 'gemmes',
    lore: 'Une caverne aux mille facettes, divisée en trois ailes cristallines — une par famille de gemme. Choisis ton aile : la poussière est garantie, la gemme se mérite.',
    trait: 'armure', traitLabel: 'Golems cristallins blindés : sans Pénétration, ton DPS s\'effondre.',
    element: 'froid', unlockStage: 20, sceauCost: 2,
  },
  orbes: {
    id: 'orbes', name: 'Vortex des Orbes', icon: '🔮', color: '#e599f7', reward: 'orbes',
    lore: 'Un maelström où se condensent les Orbes de raid. Y pénétrer exige de sacrifier une poignée de Sceaux.',
    trait: 'pack', traitLabel: 'Nuées denses → privilégie le cleave.',
    element: 'arcane', unlockStage: 50, sceauCost: 10,
  },
  poussiere: {
    id: 'poussiere', name: 'Observatoire Stellaire', icon: '🌌', color: '#748ffc', reward: 'poussiere',
    lore: 'Au sommet du monde, un colosse stellaire unique condense la Poussière d\'étoile. Un mur de PV à lui seul.',
    trait: 'colosse', traitLabel: 'Un colosse unique : DPS mono-cible massif (et Dégâts vs Boss).',
    element: 'foudre', unlockStage: 22, anchorStage: 45, sceauCost: 1,
  },
}

// l'OR et l'XP ne viennent QUE du farm classique (idle). Les donjons « Chambre du Trésor » (or)
// et « Sanctuaire du Savoir » (xp) sont RETIRÉS du jeu (sortis de la liste jouable) → plus aucun donjon
// ne donne or/XP (tue le snowball de donjon). Leurs défs restent dans DUNGEONS (type-safety) mais sont
// injouables. (Nettoyage des types 'or'/'savoir'/'gold'/'xp' = passe cosmétique.)
export const DUNGEON_LIST: DungeonDef[] = [
  DUNGEONS.sceaux, DUNGEONS.eclats, DUNGEONS.noyau, DUNGEONS.butin, DUNGEONS.geode, DUNGEONS.orbes, DUNGEONS.poussiere,
]

// ---- La Géode : ailes (famille de gemme) + rendements ----

/** Élément des golems de chaque aile (assorti aux biomes de drop de la famille).
 *  4e aile — le Bastion vient du Physique. */
export const GEODE_WING_ELEMENT: Record<GemFamily, DamageType> = {
  rythme: 'feu', flux: 'ombre', environnement: 'froid', bastion: 'physique',
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

/** Plafond pratique de la fenêtre normale de la Cache : Artefact (t7). */
export const BUTIN_RARITY_CAP = 7
/**
 * Fenêtre de rareté de la Cache du Pilleur. Trois régimes :
 *   • Niv 1-7  : COURBE HISTORIQUE validée par le joueur — pic Rare(4)→Épique(5)→Légendaire(6),
 *                floor = pic-2 (la Cache reste meilleure que le farm sans cracher d'Artefact tôt).
 *   • Niv 8-14 : RAMPE — corrige le défaut de l'ancienne courbe (l'Artefact culminait dès niv 9 et
 *                restait PLAT jusqu'à 15 → « 9+ == 15+ »). Ici le pic reste Légendaire mais la PART
 *                d'Artefact grimpe en continu (~18 % → ~64 %) via le knob `shoulder` de rollWindowRarity.
 *   • Niv 15+  : PLATEAU HISTORIQUE — pic Artefact (~72 % Artefact/objet), l'état final « qui est bon ».
 * (`cap` reste Artefact ; au-delà, seul le « voile » perce — cf. butinOverTier.)
 */
export function cacheRarityWindow(level: number): { floor: number; peak: number; cap: number; shoulder?: number } {
  const cap = BUTIN_RARITY_CAP
  if (level <= 7) {
    const peak = Math.max(4, Math.min(6, 4 + Math.floor(level / 3)))
    return { floor: Math.max(2, peak - 2), peak, cap }
  }
  if (level >= 15) return { floor: 5, peak: 7, cap }
  // 8-14 : pic Légendaire(6), plancher Épique(5), part d'Artefact interpolée 18 % (niv8) → 72 % (niv15).
  // shoulder = poids de l'Artefact (t7) relatif au pic ; weights = {Épique 0.3, Légend 1, Artefact shoulder}.
  const t = (level - 8) / 7 // 0 (niv8) → 1 (niv15)
  const targetArtefact = 0.18 + (0.72 - 0.18) * t
  const shoulder = (targetArtefact * 1.3) / (1 - targetArtefact)
  return { floor: 5, peak: 6, cap, shoulder }
}
/** Plancher / plafond pratiques (affichage + rendement des automates). */
export function butinMinTier(level: number): number {
  return cacheRarityWindow(level).floor
}
export function butinMaxTier(level: number): number {
  return cacheRarityWindow(level).cap
}

/**
 * « Au-delà du voile » : chance qu'UN objet du coffre perce le plafond pratique.
 * Infime par design : ~0,4% au niv 1, qui grimpe DOUCEMENT (+0,02%/niv) et plafonne à 1,5%.
 * Le niveau du donjon n'achète donc jamais ces raretés — il en effleure juste la probabilité.
 */
export function butinOverChance(level: number): number {
  return Math.min(0.015, 0.004 + level * 0.0002)
}

/** Répartition du tirage « au-delà du voile » (au-dessus d'Artefact).
 *  La Cache TOPE à Artefact (t7) — le voile ne lâche QUE du Patrimoine (t8), un seul cran au-dessus,
 *  comme jackpot ultra-rare. Mythique+ (et tout Céleste+) est l'apanage EXCLUSIF des raids
 *  (Cache→Artefact, raids→Patrimoine/Céleste+). */
const BUTIN_OVER_WEIGHTS: { tier: number; w: number }[] = [
  { tier: 8, w: 100 }, // Patrimoine (seul cran du voile)
]
export function butinOverTier(): number {
  const total = BUTIN_OVER_WEIGHTS.reduce((a, x) => a + x.w, 0)
  let r = Math.random() * total
  for (const x of BUTIN_OVER_WEIGHTS) { r -= x.w; if (r <= 0) return x.tier }
  return 8
}

/**
 * Repère de RENDEMENT (par run terminé) pour calibrer l'équilibrage — chaque donjon doit rester
 * la voie LA PLUS RENTABLE pour SA ressource. Un run niv N = (4+N) combats. (Premier jet à affiner.)
 *   or       ≈ 450·N·(1+0.15N)              noyau   ≈ 12·N·(1+0.10N)
 *   eclats   ≈ 300·N·(1+0.13N)              sceaux  ≈ 3 + 0.9N
 *   xp       ≈ 180·N·1.1^N (équipe)         orbes   ≈ 1 + 0.5N (entrée : 10 Sceaux)
 *   poussiere≈ (1+⌊N/3⌋) garanti + 0..2 bonus (proba croissante)
 *   butin    = min(5, 1+⌊(N-1)/3⌋) objets (droite 1→5, +1 tous les 3 niv), rareté butinMinTier(N)→butinMaxTier(N)
 */

export function getDungeonDef(id: DungeonId): DungeonDef {
  return DUNGEONS[id]
}

// ---- Modificateurs (style Mythique+) : épice aléatoire en plus de l'identité du donjon ----
//
// La variance se JOUE au lieu d'être subie :
//  (A) chaque affixe de difficulté PAIE : `rewardMult` multiplie les récompenses (par-combat + coffre),
//      affiché dans la description → un tirage dur est une opportunité, pas une loterie ;
//  (C) anti-synergies BANNIES : `excludeTraits` empêche les doubles murs (Blindé sur un donjon
//      déjà « armure », Colossal sur le colosse unique ou les régénérants, Enragé sur les cogneurs) ;
//  (+) affixes « fun d'abord » : Pressé (défi de temps, zéro difficulté ajoutée), Hanté (champion
//      jackpot). « Réfléchissant » est SUPPRIMÉ du tirage (anti-fun pur : punissait le DPS sans
//      contrepartie) ; « Volatile » est SUPPRIMÉ à son tour (les explosions
//      en chaîne sur les packs one-shotaient l'équipe) — les runs en cours restent gérés.

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
  /** Vestige (« Réfléchissant », retiré du tirage) — encore appliqué aux runs en cours. */
  reflectPct?: number
  regenPct?: number
  /** (A) Multiplicateur de RÉCOMPENSES du donjon (par-combat + coffre) — le risque paie. */
  rewardMult?: number
  /** Vestige (« Volatile », retiré du tirage) — encore appliqué aux runs en cours. */
  explodePct?: number
  /** Pressé : bonus de COFFRE si le run est bouclé en moins de `timerSec` (posé à la génération). */
  timerBonus?: number
  timerSec?: number
  /** Hanté : un Champion ✦ rôde dans le run — objet de haute rareté à sa mort. */
  champion?: boolean
  /** (C) Identités de donjon où cet affixe ne tombe JAMAIS (anti-synergies). */
  excludeTraits?: DungeonTrait[]
  /** Réservé à la ressource indiquée (Érudit → donjon d'XP uniquement). */
  onlyReward?: DungeonReward
}

export const DUNGEON_MODIFIERS: DungeonModifier[] = [
  { id: 'colossal', name: 'Colossal', description: '+40% de PV des ennemis · récompenses +15%.', hpMult: 1.4, rewardMult: 1.15, excludeTraits: ['colosse', 'regen'] },
  { id: 'blinde', name: 'Blindé', description: 'Armure doublée · récompenses +15%.', armorMult: 2, rewardMult: 1.15, excludeTraits: ['armure'] },
  { id: 'enrage', name: 'Enragé', description: 'Les ennemis frappent de plus en plus fort avec le temps · récompenses +25%.', enrageRampPerSec: 0.08, rewardMult: 1.25, excludeTraits: ['rapide'] },
  { id: 'erudit', name: 'Érudit', description: '+100% XP, mais ennemis plus coriaces.', xpMult: 2, hpMult: 1.5, onlyReward: 'xp' },
  { id: 'avare', name: 'Avare', description: 'Aucun or, mais davantage d\'objets rares.', noGold: true, rareBonus: 1 },
  // --- le fun d'abord --- (« Volatile » retiré du tirage : one-shots de packs)
  { id: 'presse', name: 'Pressé', description: 'Boucle le donjon dans le temps imparti : coffre +30%.', timerBonus: 0.3 },
  { id: 'hante', name: 'Hanté', description: 'Un Champion ✦ rôde dans ce donjon : abats-le pour un objet de haute rareté.', champion: true },
]

// ---- Donjon actif ----

export interface ActiveDungeon {
  /** 💰 Potion du pillard ARMÉE à l'entrée : bonus de coffre (fraction). */
  chestPotion?: number
  /** 📚 Potion de l'érudit ARMÉE à l'entrée : bonus d'XP du run (fraction). */
  xpPotion?: number
  dungeonId: DungeonId
  level: number
  /** Record de farm au lancement. Conservé pour la compat de signature : la difficulté et le loot
   *  sont FIXES par niveau, il ne les cale PAS. */
  bestStage: number
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
  /** Temps TOTAL écoulé dans le run (s) — sert au défi « Pressé ». */
  runTime?: number
  /** Hanté : index du combat où rôde le Champion ✦ (absent = pas de champion). */
  championAt?: number
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
  colosse: { hp: 1.6, dmg: 1.25, armor: 1.3, pack: 1 }, // la plus grosse barre de PV des donjons
  armure: { hp: 1.0, dmg: 1.0, armor: 3.4, pack: 2 },
  // hp 1,5 (durci pour la qualité du butin) — à 2,1, couplé au boss ×5, ça faisait ~×10,5 PV
  // (≈ le mur lui-même) → niveau 1 infranchissable. Reste le donjon le plus exigeant, mais son entrée
  // est un OUTIL (la difficulté vient du PUSH, pas de l'entrée).
  elite: { hp: 1.5, dmg: 1.3, armor: 1.2, pack: 2, elite: true },
  regen: { hp: 1.1, dmg: 1.0, armor: 1, pack: 2, regen: 0.03 },
}

/** Nombre de combats d'un donjon de niveau N — court et dense (2 à 4 combats). */
export function dungeonFights(level: number): number {
  return Math.min(4, 2 + Math.floor(level / 4))
}

/**
 * ilvl du butin du coffre — FIXE par niveau : le loot du niveau N sort à la tranche du Chapitre N
 * (lootFarmIlvl(N×10), capé 200), indépendant du record du joueur. Le niveau garde une longueur
 * d'avance sur le farm de bas Chapitre, sans s'emballer (plus de boule de neige stuff).
 */
export function dungeonIlvl(level: number, _bestStage = 0): number {
  // donjon à difficulté FIXE par niveau : le loot du niveau N sort à la tranche du CHAPITRE N
  // (lootFarmIlvl(N×10), capé 200), INDÉPENDANT du record du joueur → le niveau 1 reste à jamais le
  // niveau 1 (on le dépasse en montant les niveaux, en parallèle des Chapitres). Sa valeur = rareté + mats.
  return lootFarmIlvl(level * CHAPITRE_SIZE)
}

/**
 * RENDEMENT par run — ∝ au NIVEAU du donjon (= Chapitre N), INDÉPENDANT du record : ancré sur
 * le coût d'un craft à la rareté ACCESSIBLE de ce Chapitre (Cache + raids gatés, cf. accessibleRarityTier)
 * → un run ≈ 1/CRAFT_RUNS_TARGET d'un tel craft. La rareté accessible MONTE avec le Chapitre (raids) au
 * lieu de plafonner à Artefact → les hauts niveaux rapportent enfin assez de matériaux. Ratios stables,
 * et farmer un BAS niveau trivial ne rapporte plus comme ton record. Pour plus : monter en Chapitre.
 */
const GOLD_BUYS_PER_RUN = 3       // l'or = dump marché : ~3 achats par run (généreux)
/** Part du rendement distribuée PAR COMBAT (le reste tombe dans le coffre de fin). */
export const DUNGEON_YIELD_PERFIGHT_FRAC = 0.4
/** Rendement TOTAL d'un run (par-combat + coffre) pour la ressource du donjon, à la tranche du niveau. */
export function dungeonRunYield(reward: DungeonReward, level: number, _bestStage = 0): number {
  if (reward === 'gold') {
    const ilvl = lootFarmIlvl(level * CHAPITRE_SIZE)
    const marketBuy = ilvl * Math.pow(accessibleRarityTier(level), 2.6) * 1.5 // ≈ shopBuyPrice (dump d'or)
    return Math.max(1, Math.round(marketBuy * GOLD_BUYS_PER_RUN))
  }
  // Matériaux (éclats / noyaux / poussière) : courbe partagée = coût d'un craft à la rareté accessible ÷ cadence.
  if (reward === 'eclats' || reward === 'noyau' || reward === 'poussiere') return materialYieldAtChapter(reward, level)
  return 0
}

/**
 * Rendement TOTAL en CLÉS (Sceaux / Orbes) d'un run — mappé comme les autres ressources
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

// Constantes d'équilibrage des donjons.
const EFF_STAGE_PER_LEVEL = 7      // sert aux RÉCOMPENSES (xp) → économie inchangée.
// la COURBE DE COMBAT n'est pas propre aux donjons : PV/dégâts = base unifiée b^ilvl
// (progression.ts, dungeonDifficultyIlvl). Le décalage de départ (anchorStage) est ABSORBÉ par
// l'ilvl du donjon — plus besoin d'offsets. L'identité (TRAIT_CFG) reste un multiplicateur.
const DUNGEON_FIGHT_RAMP_ILVL = 2 // +ilvl de difficulté par combat DANS un run (rampe douce)
const DUNGEON_BOSS_HP_MULT = 5    // boss (dernier combat) : pic de PV (~15 s, pacing donjon court)
const DUNGEON_ELITE_HP_MULT = 2.7 // élites coriaces (Cache)

// DIFFICULTÉ FIXE par niveau : le niveau N est calé sur la FRONTIÈRE du Chapitre N (stage N×10),
// INDÉPENDANT du record du joueur. On fait le donjon niveau N quand on est au Chapitre N ; le niveau 1
// reste à jamais le niveau 1 (finit trivial = voulu — on monte les niveaux EN PARALLÈLE des Chapitres).
export function dungeonContentIlvl(level: number, _bestStage = 0): number {
  return Math.max(1, frontierIlvl(level * CHAPITRE_SIZE))
}

/** Régénération des ennemis (fraction des PV max/s) imposée par l'identité du donjon.
 *  RAMPE avec le niveau : NULLE au niveau 1 (la passerelle Antre des Failles doit être
 *  franchissable d'emblée pour ouvrir la boucle des donjons), pleine au niveau 5+ (le check de burst
 *  revient pour le défi et les clés). Évite que le donjon-passerelle soit un mur de burst infranchissable. */
export function dungeonRegen(trait: DungeonTrait, level = 1): number {
  // rampe douce : NULLE jusqu'au niveau 3 (l'Antre des Failles est le donjon
  // d'ENTRÉE, il doit être le plus facile — retour joueur), pleine vers le niveau 9. Le check de burst
  // (regen) est un défi de PUSH, jamais une barrière à l'entrée de la boucle.
  return (TRAIT_CFG[trait].regen ?? 0) * Math.max(0, Math.min(1, (level - 3) / 6))
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
  _bestStage = 0,
): Enemy {
  const cfg = TRAIT_CFG[def.trait]
  const isBoss = fightIndex === totalFights - 1
  const isElite = cfg.elite && !isBoss
  let hpMods = 1
  let armorMods = 1
  let xpMult = 1
  for (const m of modifiers) {
    if (m.hpMult) hpMods *= m.hpMult
    if (m.armorMult) armorMods *= m.armorMult
    if (m.xpMult) xpMult *= m.xpMult
  }

  // base UNIFIÉE b^ilvl à l'ilvl de difficulté du donjon (+ rampe douce par combat) ;
  // l'identité (cfg.hp/dmg/armor) et la classe (boss/élite) restent des multiplicateurs.
  const diffIlvl = dungeonContentIlvl(level) + fightIndex * DUNGEON_FIGHT_RAMP_ILVL
  // atténuation par NIVEAU (murSoftness sur la tranche du Chapitre N) : les bas niveaux sont
  // adoucis (intro franchissable d'emblée), pleine puissance ensuite. Fixe par niveau, plus par record.
  const soft = murSoftness(level * CHAPITRE_SIZE)
  const classHp = isBoss ? DUNGEON_BOSS_HP_MULT : isElite ? DUNGEON_ELITE_HP_MULT : 1
  const maxHp = Math.round(enemyHp(diffIlvl, 'trash') * classHp * cfg.hp * hpMods * soft)
  const effStage = level * EFF_STAGE_PER_LEVEL + fightIndex // récompenses (xp) — économie inchangée

  const baseName = `${pick(ENEMY_NAMES)} ${DAMAGE_TYPES[def.element].name.toLowerCase()}`
  const name = isBoss ? `★ ${baseName}` : isElite ? `◆ ${baseName}` : baseName

  return {
    name,
    maxHp,
    hp: maxHp,
    armor: Math.round(enemyArmor(diffIlvl, cfg.armor * armorMods)),
    // Dégâts : MÊME base b que les PV ; identité (cfg.dmg) + boss ×1,8 en multiplicateurs.
    damage: Math.round(enemyDmg(diffIlvl, 'trash') * cfg.dmg * (isBoss ? 1.8 : 1) * soft),
    xp: Math.round(8 * Math.pow(1.12, effStage - 1) * (isBoss ? 5 : 1) * xpMult),
    // AFFINITÉ ÉLÉMENTAIRE (pas de rampe en donjon → base 0) : résiste l'élément du donjon,
    // vulnérable à l'opposé. Amener le contre (ou le bon héros multi-classe) = un vrai levier de clear.
    resist: elementAffinityResist(def.element, 0),
    damageType: def.element,
    // Exigence de résistance sur l'élément du donjon — modérée (cap ×2.1 à zéro résist).
    reqs: { [def.element]: dungeonReq(level) },
    ...(isElite ? { elite: true, dodge: ENEMY_DODGE.elite } : {}),
    ...(isBoss ? { boss: true, dodge: ENEMY_DODGE.boss, ccDur: 1.6, ccCd: 7 } : {}),
  }
}

/** Titres du Champion ✦ de l'affixe « Hanté ». */
const HAUNT_TITLES = ['le Hanteur', 'l\'Écorcheur', 'la Calamité', 'le Maudit', 'l\'Insaisissable']

/** Construit le PACK d'ennemis d'un combat (plusieurs adversaires simultanés selon l'identité).
 *  `champion` (affixe Hanté) : un membre du pack devient un Champion ✦ — plus coriace, jackpot à sa mort. */
export function makeDungeonPack(
  def: DungeonDef,
  level: number,
  fightIndex: number,
  totalFights: number,
  modifiers: DungeonModifier[],
  bestStage: number,
  champion = false,
): Enemy[] {
  const size = dungeonPackSize(def.trait, fightIndex, totalFights)
  const pack: Enemy[] = []
  if (size <= 1) {
    pack.push(makeDungeonEnemy(def, level, fightIndex, totalFights, modifiers, bestStage))
  } else {
    for (let i = 0; i < size; i++) {
      const e = makeDungeonEnemy(def, level, fightIndex, totalFights, modifiers, bestStage)
      e.maxHp = Math.max(1, Math.round(e.maxHp * 0.72))
      e.hp = e.maxHp
      e.name = `${e.name} ${PACK_TAGS[i] ?? i + 1}`
      pack.push(e)
    }
  }
  if (champion) {
    const c = pack[0]
    c.maxHp = Math.round(c.maxHp * 1.7)
    c.hp = c.maxHp
    c.damage = Math.round(c.damage * 1.2)
    c.name = `✦ ${c.name.replace(/^[★◆] /, '')} ${pick(HAUNT_TITLES)}`
    c.elite = true
    c.champion = true
    c.dodge = Math.max(c.dodge ?? 0, ENEMY_DODGE.elite)
    c.trait = 'Champion ✦'
  }
  return pack
}

/** Temps imparti (s) du défi « Pressé » : ~28 s par combat (+ marge par niveau, les packs gonflent). */
export function presseTimer(level: number, totalFights: number): number {
  return Math.round(totalFights * (28 + level * 0.8))
}

/** Génère un donjon prêt à jouer. `wing` (La Géode) : aile choisie → famille farmée + élément. */
export function generateDungeon(dungeonId: DungeonId, level: number, bestStage: number, wing?: GemFamily): ActiveDungeon {
  const def = dungeonId === 'geode' && wing
    ? { ...DUNGEONS.geode, element: GEODE_WING_ELEMENT[wing] }
    : DUNGEONS[dungeonId]
  const totalFights = dungeonFights(level)

  // 1 modificateur, +1 à partir du niveau 4. Le tirage respecte l'identité du donjon —
  // pas d'Avare sur le donjon d'or, pas de double mur (excludeTraits), Érudit réservé à l'XP.
  const count = level >= 4 ? 2 : 1
  const pool = DUNGEON_MODIFIERS.filter((m) =>
    !(def.reward === 'gold' && m.noGold)
    && !m.excludeTraits?.includes(def.trait)
    && (!m.onlyReward || m.onlyReward === def.reward))
  const modifiers: DungeonModifier[] = []
  for (let i = 0; i < count && pool.length; i++) {
    const m = { ...pool.splice(Math.floor(Math.random() * pool.length), 1)[0] }
    // Pressé : le temps imparti est figé à la génération et écrit dans la description (lisible en jeu).
    if (m.timerBonus) {
      m.timerSec = presseTimer(level, totalFights)
      m.description = `Boucle le donjon en moins de ${m.timerSec}s : coffre +${Math.round(m.timerBonus * 100)}%.`
    }
    modifiers.push(m)
  }
  // Hanté : le Champion ✦ rôde dans un combat aléatoire HORS boss final.
  const championAt = modifiers.some((m) => m.champion)
    ? Math.floor(Math.random() * Math.max(1, totalFights - 1))
    : undefined

  return {
    dungeonId,
    level,
    bestStage,
    name: `${def.icon} ${def.name} · Niv. ${level}`,
    trait: def.trait,
    reward: def.reward,
    element: def.element,
    ...(dungeonId === 'geode' && wing ? { wing } : {}),
    modifiers,
    totalFights,
    current: 0,
    enemies: makeDungeonPack(def, level, 0, totalFights, modifiers, bestStage, championAt === 0),
    fightTime: 0,
    runTime: 0,
    ...(championAt !== undefined ? { championAt } : {}),
    earned: {},
  }
}
