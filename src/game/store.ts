import { create } from 'zustand'
import type {
  Equipment, Item, Affix, PrimaryStat, OffensiveStat, SecondaryStat, EquipSlotId, ItemType, Enemy, DamageType, RarityId, Character, PowerDef, EnemyAbility,
} from './types'
import { rollHit, incomingDps, genericMitigation } from './combat'
import { resistMult, enemyReq, resistSurplus, RESIST_DSCALE } from './resist'
import type { DerivedStats } from './stats'
import {
  makeCharacter, charDerived, charMaxHp, charDamageProfile, charPassives,
  charResist, charCombatMods, abilityPower, powerScale, computeUnlockedPowers, setGlobalCombatMods,
  talentPointsForLevel, type CombatMods as CharCombatMods,
} from './character'
import { getTalent, canAllocate } from './talents'
import { getPower } from './powers'
import { getUpgrade, upgradeCost as accountUpgradeCost, upgradePoussiere, upgradeEclats, isMaxed, computeGlobalMods } from './upgrades'
import {
  generateItem, rollBoxRarity, rollWindowRarity, rollFarmRarity, sellValue, recycleValue, recyclePoussiere, itemScore,
  reforgeItem, surillvlItem, ascendItem,
  reforgeCost, surillvlCost, ascendCost, createCost, transmuteCost, maxCraftTier,
  enhanceTypedAffixes, quintRefund,
} from './items'
import {
  craftMods, metierXpGain, canLearnNode, getMetierNode, respecCost, emptyMetiers, migrateLegacyForge,
  levelFromXp, METIERS, METIER_LIST, AUTOMATE_FORGERON_LEVELS,
  type MetierId, type MetiersState,
} from './metiers'
import { itemSockets, unsocketCost, parseGemKey } from './gems'
import { getEnchant, enchantCost, equippedRules, equippedTimeRunes, timeRuneMods, rollRuneDrop, raidRuneChance, dungeonRuneChance, type TimeRuneMods } from './enchants'
import {
  condGemMods, acharneMult, nueeMult, rollCondGem, condGemKey, parseCondKey, getCondGem, condGemInstance,
  gemMaxRank, grindDust, legacyGemDust, recutCost, BIOME_GEM_FAMILY, COND_GEM_DROP, GEM_DUST_DROP, GEM_CUT_COST,
  type CondGemId, type CondMods,
} from './condGems'
import { getConversion, type ConvRes } from './metiers'
import {
  tickAutomates, missionLabel, automateUpgradeCost,
  AUTOMATE_MAX, AUTOMATE_COSTS, AUTOMATE_NAMES, AUTOMATE_UPG_MAX,
  type Automate, type AutomateMission,
} from './automates'
import { makeEnemy, isBossStage, stageIlvl, stageLuckTier } from './enemies'
import { BIOME_IDS, biomeUnlocked, getBiomeDef, type BiomeId } from './biomes'
import {
  maitriseBonus, surgeBiome,
  SURGE_GOLD_XP_MULT, SURGE_QUINT_MULT,
} from './biomeBonus'
import { RARITIES, RARITY_LIST } from './rarities'
import { SECONDARY_STATS } from './stats'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES, profileDamageMult, type DamageProfile } from './damage'
import { equipSlotsForType, slotAccepts, EQUIP_SLOTS } from './slots'
import { essenceGain, upgradeCost, insertCost, getUnique, UNIQUE_MAX_RANK, randomUniqueInstance, undiscoveredUnique } from './uniques'
import {
  generateDungeon, makeDungeonPack, dungeonIlvl, dungeonRegen, getDungeonDef,
  cacheRarityWindow, butinOverChance, butinOverTier, BUTIN_RARITY_CAP,
  dungeonRunYield, dungeonKeyYield, DUNGEON_YIELD_PERFIGHT_FRAC,
  geodeDustYield, geodeGemChance, geodeGemRank,
  DUNGEONS, type ActiveDungeon, type DungeonId,
} from './dungeons'
import type { GemFamily } from './condGems'
import {
  generateRaid, makeRaidAdd, getRaidDef, raidUnlocked, raidBossVariant,
  raidIlvl, raidRarityWindow, rollRaidLootCount, raidTrophyGain, raidTierUnlockCost,
  raidFragments, raidCosmicChance, raidCosmicQty, pickRaidLootType,
  PAIR_ENRAGE_MULT, NOVA_MULT, RAIDS, type ActiveRaid, type RaidId,
} from './raids'
import { SETS } from './sets'
import { simulateOffline, type OfflineReport } from './offline'

const SAVE_KEY = 'warrior-idler-save-v1'
const MAX_LOG = 40
const INV_BASE = 80
let invMax = INV_BASE // ajusté par l'amélioration "Sacoches"
let regenMult = 1 // ajusté par l'amélioration "Régénération"
const REGEN_RATE = 0.05
const RETREAT_STAGES = 2
/** Intervalle (s) entre deux étourdissements d'un boss (après le 1er, cadencé par ccCd). */
const CC_INTERVAL = 8
// Personnages 2 & 3 = VERY END-GAME (déblocage gratuit très tardif, recrutement très cher).
const CHAR2_STAGE = 350
const CHAR3_STAGE = 800
export const RECRUIT_COST = [10_000_000, 100_000_000] // or pour recruter le 2ᵉ / 3ᵉ perso
export const RECRUIT_POUSSIERE = [25, 120] // + Poussière d'étoile (matériau rare)
const RECRUE_NAMES = ['Lyra', 'Kael', 'Sora', 'Dorn', 'Mira']

export type LogKind = 'hit' | 'crit' | 'loot' | 'kill' | 'info' | 'level' | 'death' | 'gold' | 'craft'

export interface LogEntry {
  id: number
  text: string
  kind: LogKind
}

export interface CreateOptions {
  type: ItemType
  primary: OffensiveStat
  rarity: RarityId
  orientation?: import('./types').ItemOrientation
  element?: DamageType
}

export interface ChestReward {
  dungeonName: string
  level: number
  items: Item[]
  eclats: number
  noyau: number
  gold: number
  sceaux: number
  orbes?: number
  fragments?: number
  poussiere?: number
  /** Éclat cosmique 💫 — ressource ultra-rare exclusive aux raids. */
  cosmic?: number
  /** XP d'équipe gagnée pendant le donjon (déjà créditée combat par combat ; affichage récap). */
  xp?: number
  /** 🔹 Poussière de gemme (La Géode). */
  gemDust?: number
  /** 💎 Gemme de condition trouvée dans le coffre (La Géode — aile choisie). */
  gem?: { id: CondGemId; rank: number }
}

/** Coffre du Destin 🎭 : objets révélés dont UN SEUL sera gardé (les autres sont recyclés). */
export interface ChoiceReward {
  name: string
  items: Item[]
}

export const SCEAU_COST = { noyau: 3, eclats: 600 }
export const FRAGMENT_INFUSE_COST = 2 // Fragments d'éternité pour infuser un effet unique
/** Invocation d'un effet unique au CHOIX (Éclat cosmique + Fragments). */
export const CHOOSE_UNIQUE_COST = { cosmic: 1, fragments: 3 }

/** Progression par donjon-ressource (chaque donjon monte indépendamment). */
export type DungeonProgress = Record<DungeonId, number>
function emptyDungeonProgress(): DungeonProgress {
  const out = {} as DungeonProgress
  for (const id of Object.keys(DUNGEONS) as DungeonId[]) out[id] = 0
  return out
}

/** Progression par raid (chaque raid monte indépendamment). */
export type RaidProgress = Record<RaidId, number>
function emptyRaidProgress(): RaidProgress {
  const out = {} as RaidProgress
  for (const id of Object.keys(RAIDS) as RaidId[]) out[id] = 0
  return out
}

/** Progression par biome (chaque biome monte indépendamment). */
function emptyBiomeRecord(physiqueValue: number, otherValue: number): Record<BiomeId, number> {
  const out = {} as Record<BiomeId, number>
  for (const id of BIOME_IDS) out[id] = id === 'physique' ? physiqueValue : otherValue
  return out
}

/** Meilleur palier tous biomes confondus (gate des donjons/raids/persos). */
function globalBest(biomeBest: Record<BiomeId, number>): number {
  let best = 1
  for (const id of BIOME_IDS) best = Math.max(best, biomeBest[id] ?? 0)
  return best
}

/** Stock de Quintessences vide (une entrée par type de dégâts). */
function emptyQuint(): Record<DamageType, number> {
  return Object.fromEntries(DAMAGE_TYPE_LIST.map((t) => [t, 0])) as Record<DamageType, number>
}

/** Ajoute un sac de Quintessences typées à un stock (immutable). */
function addQuint(base: Record<DamageType, number>, add: Partial<Record<DamageType, number>>): Record<DamageType, number> {
  let changed = false
  const out = { ...base }
  for (const t in add) {
    const v = add[t as DamageType] ?? 0
    if (v > 0) { out[t as DamageType] = (out[t as DamageType] ?? 0) + v; changed = true }
  }
  return changed ? out : base
}

/** Rend au stock les gemmes serties d'un objet (vente/recyclage : les gemmes ne se perdent pas). */
function gemStockAdd(stock: Record<string, number>, item: Item): Record<string, number> {
  if (!item.gems?.length) return stock
  const out = { ...stock }
  for (const g of item.gems) {
    if (!g.cond) continue // vestige élémentaire (ne devrait plus exister après migration)
    const k = condGemKey(g.cond as CondGemId, g.rank ?? 1)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** Suffixe de log « + 🔥3 + ❄️2 » pour un remboursement de Quintessences (vide si rien). */
function quintLogSuffix(refund: Partial<Record<DamageType, number>>): string {
  const parts: string[] = []
  for (const t in refund) {
    const v = refund[t as DamageType] ?? 0
    if (v > 0) parts.push(`${DAMAGE_TYPES[t as DamageType].icon}${v}`)
  }
  return parts.length ? ` + ${parts.join(' ')}` : ''
}

/** Chances de drop d'une Quintessence du biome actif selon le rang d'ennemi (au palier 1). */
const QUINT_DROP = { normal: 0.01, elite: 0.05, boss: 0.1 }
/** Bonus de drop de Quintessence par palier (multiplicatif, plafonné) → farmer son palier actuel
 *  rapporte plus que farmer 50 paliers en dessous. */
const QUINT_TIER_BONUS = 0.012
const QUINT_TIER_MULT_CAP = 4
/** Multiplicateur de drop de Quintessence au palier `stage`. */
function quintTierMult(stage: number): number {
  return Math.min(QUINT_TIER_MULT_CAP, 1 + Math.max(0, stage - 1) * QUINT_TIER_BONUS)
}

/**
 * Donjons = voie RENTABLE pour monter de niveau & farmer l'or. À CHAQUE combat gagné, l'équipe
 * gagne de l'XP (créditée tout de suite, gardée même si le run échoue) et de l'or (versé au coffre).
 * Multiplicateurs volontairement GÉNÉREUX (le levelling est lent par design) — à affiner.
 */
// ×XP de l'équipe par combat dans le Sanctuaire du Savoir. Relevé 7 → 24 (v0.21) : les donjons
// sont passés de 4+N combats à 2-4 → on préserve l'XP totale d'un run.
const DUNGEON_FIGHT_XP_MULT = 24
/** Boost de l'XP du combat CLASSIQUE : recale le ratio donjon/classique (~×80 → ~×10). */
const CLASSIC_XP_MULT = 8
/** Or par kill en combat CLASSIQUE (fraction de l'XP du mob). Relevé 0.12 → 0.8 : farmer les paliers
 *  rapporte enfin un vrai revenu d'or (avant : « pratiquement rien »). */
const CLASSIC_GOLD_MULT = 0.8

interface SaveData {
  characters: Character[]
  activeChar: number
  /** Palier courant DU BIOME ACTIF. */
  stage: number
  /** Meilleur palier tous biomes confondus (= max sur biomeBest). */
  bestStage: number
  /** Biome actif (combat classique). */
  activeBiome: BiomeId
  /** Palier courant mémorisé par biome (le biome actif reflète `stage`). */
  biomeStages: Record<BiomeId, number>
  /** Meilleur palier atteint par biome. */
  biomeBest: Record<BiomeId, number>
  /** Verrou de farm : fige la progression au palier courant. */
  farmLock: boolean
  gold: number
  essence: number
  noyau: number
  /** Poussière d'étoile : matériau rare de craft sommital. */
  poussiere: number
  /** Quintessences élémentaires : 1 par type de dégâts (drop ~1% par biome). Craft typé sur le stuff. */
  quint: Record<DamageType, number>
  /** Stock de gemmes de CONDITION (clé `cond:id[:rang]`) — drop par famille de biome. */
  gems: Record<string, number>
  /** Poussière de gemme 🔹 : broyage → taille (gemme au choix) & recoupe (rangs). Joaillier. */
  gemDust: number
  essences: Record<string, number>
  sceaux: number
  dungeonProgress: DungeonProgress
  dungeon: ActiveDungeon | null
  pendingChest: ChestReward | null
  /** Coffre du Destin en attente de choix (3 objets révélés, un seul gardé). */
  pendingChoice: ChoiceReward | null
  /** Horodatage du dernier Coffre du Jour 🗓️ (gratuit, cooldown réel). */
  lastFreeBox: number
  /** Karma du marchand 🍀 : coffres ouverts sans jackpot (bonus de jackpot croissant, reset au proc). */
  boxPity: number
  orbes: number
  fragments: number
  /** Éclat cosmique 💫 — ressource ultra-rare des raids. */
  cosmic: number
  raidProgress: RaidProgress
  /** 🏆 Trophées par raid (v0.24) : la monnaie de PASSAGE DE TIER (gagnés par clear). */
  raidTrophies: Partial<Record<RaidId, number>>
  /** Tier maximal TENTABLE par raid (v0.24) : monte via unlockRaidTier (clear + Trophées). */
  raidTierUnlocked: Partial<Record<RaidId, number>>
  raid: ActiveRaid | null
  /** 🪄 Runes POSSÉDÉES (v0.25, option A) : id de rune → quantité. Drop rare (raids surtout) ;
   *  la gravure CONSOMME un exemplaire — retirer/écraser ne rembourse pas. */
  runesOwned: Record<string, number>
  /** Grimoire : ids des effets uniques déjà découverts. */
  codex: string[]
  /** Améliorations permanentes : id → niveau. */
  upgrades: Record<string, number>
  /** Métiers de l'Atelier (v0.22) : XP cumulée + nœuds d'arbre appris, par métier. */
  metiers: MetiersState
  /** Automates de forge : farment en boucle les donjons/raids déjà battus (3 max). */
  automates: Automate[]
  /** Stock de l'échoppe du marchand. */
  shopStock: Item[]
  inventory: Item[]
  /** Seuil de rareté (tier) pour vente/recyclage en masse + recyclage auto. Persisté. */
  recycleThreshold: number
  /** Recyclage automatique : tout butin sous le seuil est recyclé directement au drop. */
  autoRecycle: boolean
  /** Rune du Karma (pity) : kills depuis le dernier drop Épique+ (compté en permanence). */
  killsSinceEpic: number
  /** Horodatage de la dernière sauvegarde (progression hors-ligne). */
  lastSeen: number
  /** Horodatage de la dernière rotation de l'échoppe (rotation horaire, indépendante du combat). */
  lastShopRefresh: number
}

interface GameState extends SaveData {
  enemy: Enemy
  log: LogEntry[]
  killCount: number
  /** Récap de progression hors-ligne à présenter au retour (modal). */
  pendingOffline: OfflineReport | null
  tick: (dt: number) => void
  setStage: (n: number) => void
  setBiome: (biome: BiomeId) => void
  toggleFarmLock: () => void
  setRecycleThreshold: (tier: number) => void
  toggleAutoRecycle: () => void
  insertEffect: (itemId: string, effectId: string) => void
  claimOffline: () => void
  equip: (itemId: string, targetSlot?: EquipSlotId) => void
  unequip: (slot: EquipSlotId) => void
  sell: (itemId: string) => void
  recycle: (itemId: string) => void
  sellAllBelow: (tier: number) => void
  recycleAllBelow: (tier: number) => void
  reforge: (itemId: string, locked: number[]) => void
  surillvl: (itemId: string) => void
  ascend: (itemId: string) => void
  upgradeUnique: (itemId: string) => void
  transmute: (itemId: string, newPrimary: OffensiveStat) => void
  /** Améliore (ou ajoute) la ligne typée (dégâts/résist) d'un objet via une Quintessence du type. */
  enhanceTyped: (itemId: string, type: DamageType, kind: 'dmgType' | 'resist') => void
  /** Sertit une gemme de CONDITION du stock (trigger de combat) dans une châsse libre. */
  socketCondGem: (itemId: string, condId: CondGemId, rank?: number) => void
  /** Désertit la gemme à l'index donné (coût en éclats, gemme rendue au stock avec son rang). */
  unsocketGem: (itemId: string, index: number) => void
  /** BROYAGE (Joaillier) : réduit une gemme du stock en poussière 🔹. */
  grindGem: (key: string) => void
  /** TAILLE (Joaillier) : façonne la gemme de son CHOIX (rang 1) contre de la poussière 🔹. */
  cutGem: (condId: CondGemId) => void
  /** RECOUPE (Joaillier) : monte d'un rang le paramètre d'une gemme SERTIE (poussière 🔹). */
  recutGem: (itemId: string, index: number) => void
  /** Grave (ou remplace) la rune d'enchantement d'un objet (coût : Savoir-faire + éclats). */
  enchantItem: (itemId: string, enchantId: string) => void
  createItem: (opts: CreateOptions) => void
  /** Apprend un rang d'un nœud d'arbre de métier (dépense un point gagné par niveau). */
  learnMetierNode: (metier: MetierId, nodeId: string) => void
  /** Réinitialise l'arbre d'un métier contre de l'or (XP et niveau conservés). */
  respecMetier: (metier: MetierId) => void
  /** ◈ Transmutateur : convertit des ressources (à perte). `quintType` requis pour ♦ → ⚗️. */
  convertResource: (conversionId: string, times?: number, quintType?: DamageType) => void
  /** Construit le prochain automate de forge (3 max, coût croissant brutal). */
  buildAutomate: () => void
  /** Assigne (ou retire) la mission d'un automate — donjon/raid DÉJÀ battu uniquement. */
  assignAutomate: (id: number, mission: AutomateMission | null) => void
  toggleAutomatePause: (id: number) => void
  /** Améliore la vitesse ou le rendement d'un automate (or). */
  upgradeAutomate: (id: number, kind: 'speed' | 'yield') => void
  enterDungeon: (dungeonId: DungeonId, level: number, repeat?: number, wing?: GemFamily) => void
  abandonDungeon: () => void
  enterRaid: (raidId: RaidId, tier: number, repeat?: number) => void
  abandonRaid: () => void
  /** 🏆 Débloque le tier suivant d'un raid (exige : frontière vaincue + Trophées du raid). */
  unlockRaidTier: (raidId: RaidId) => void
  infuseUnique: (itemId: string) => void
  chooseUnique: (itemId: string, effectId: string) => void
  claimChest: () => void
  craftSceau: () => void
  setActiveChar: (index: number) => void
  /** Renomme un personnage (personnalisation du joueur). */
  renameCharacter: (index: number, name: string) => void
  setBias: (p: PrimaryStat) => void
  setPower: (slot: number, powerId: string | null) => void
  /** Bascule un emplacement de capacité entre AUTO et MANUEL (perso actif). */
  togglePowerAuto: (slot: number) => void
  /** Lance MANUELLEMENT la capacité d'un emplacement (perso actif) — strict : ne part qu'au prochain tick si prête. */
  castPower: (slot: number) => void
  allocateTalent: (nodeId: string) => void
  respecTalents: () => void
  /** Sauvegarde le build courant (talents + capacités + spé) dans un emplacement (0-2). */
  saveBuildPreset: (slot: number, name?: string) => void
  /** Applique un préset : respec payant + réallocation validée nœud par nœud. */
  applyBuildPreset: (slot: number) => void
  deleteBuildPreset: (slot: number) => void
  buyUpgrade: (id: string) => void
  refreshShop: () => void
  buyShopItem: (itemId: string) => void
  /** Achète un coffre. `qty` ×5 = achat en gros (-10% d'or) ; `element` requis pour le coffre élémentaire. */
  mysteryBox: (id: number, opts?: { qty?: number; element?: DamageType }) => void
  /** Coffre du Destin : garde l'objet à cet index, recycle les autres. */
  chooseFromChoice: (index: number) => void
  recruitCharacter: () => void
  reset: () => void
}

let logId = 1
function pushLog(log: LogEntry[], text: string, kind: LogKind): LogEntry[] {
  return [{ id: logId++, text, kind }, ...log].slice(0, MAX_LOG)
}

/** Crédite de l'XP de métier et journalise les montées de niveau (1 niveau = 1 point d'arbre). */
function gainMetierXp(
  s: Pick<GameState, 'metiers' | 'log'>,
  metier: MetierId,
  amount: number,
): { metiers: MetiersState; log: LogEntry[] } {
  const st = s.metiers[metier]
  const before = levelFromXp(st.xp)
  const xp = st.xp + amount
  const after = levelFromXp(xp)
  const metiers = { ...s.metiers, [metier]: { ...st, xp } }
  let log = s.log
  if (after > before) {
    const def = METIERS[metier]
    log = pushLog(log, `${def.icon} ${def.name} niveau ${after} — +${after - before} point${after - before > 1 ? 's' : ''} d'arbre (Atelier) !`, 'level')
  }
  return { metiers, log }
}

function xpForLevel(level: number): number {
  // Exponentielle ACCÉLÉRÉE (le taux de croissance augmente avec le niveau) calibrée sur un planning
  // de temps cible « meilleur rendement » : ~10 min au niv 10, ~1 h au 30, ~2 h au 50, ~10 h au 70,
  // ~25 h au 90, ~150 h au 100 — puis ça devient un vrai mur d'endgame au-delà.
  //
  // Calage : à partir du point de repère « courbe précédente = niv 50 en ~5 min », on a estimé le
  // revenu d'XP au meilleur rendement (≈ croît en 1.10/niveau), puis ajusté A/α/β pour que le COÛT
  // (= revenu × temps voulu par niveau) suive le planning. α = pente de base, β·L² = accélération.
  // (Constantes faciles à régler : A=échelle globale, α=pente, β=durcissement de fin de course.)
  const x = level - 1
  return Math.round(560 * Math.exp(0.105 * x + 0.00055 * x * x))
}

// Cooldowns transitoires des capacités actives (clé `charId:powerId`). Non persistés.
const cooldowns = new Map<string, number>()
// Demandes de lancement MANUEL en attente (clé `charId:powerId`) : posées par castPower, consommées au tick.
const manualFire = new Set<string>()

/** Recharges courantes des capacités d'un perso (pour l'UI : 0 = prête). */
export function powerCooldowns(char: Character): Record<string, number> {
  const out: Record<string, number> = {}
  for (const pid of char.powers) if (pid) out[pid] = Math.max(0, cooldowns.get(`${char.id}:${pid}`) ?? 0)
  return out
}

/** 🏆 Fragment de Conquête : remet à zéro la PLUS LONGUE recharge de chaque héros. */
function resetLongestCooldown(chars: Character[]) {
  for (const c of chars) {
    let bestKey = ''
    let best = 0
    for (const pid of c.powers) {
      if (!pid) continue
      const k = `${c.id}:${pid}`
      const cd = cooldowns.get(k) ?? 0
      if (cd > best) { best = cd; bestKey = k }
    }
    if (bestKey) cooldowns.set(bestKey, 0)
  }
}

/** Drapeaux des gemmes de condition pour le pas de combat. */
// État transitoire des gemmes de condition (compteurs de rythme). Non persisté, comme les cooldowns.
// Clés : `metronome:<charId>` (attaques), `echo` (sorts d'équipe), `crescendo` (kills d'équipe).
const gemCounters = new Map<string, number>()

// Runes de TEMPS : accumulateur de la Boucle (s) + prochain Sursis par héros (epoch ms).
let boucleAcc = 0
const sursisReadyAt = new Map<string, number>()

// ---- v0.24 : état transitoire des nouveaux archétypes (non persisté, comme les cooldowns) ----

// ÉGIDE « Aegis adaptatif » : stacks de résist par héros et par type (20 s glissantes).
const adaptiveStacks = new Map<string, Partial<Record<DamageType, { pts: number; remaining: number }>>>()
function adaptiveAdd(charId: string, type: DamageType, gain: number, cap: number) {
  const m = adaptiveStacks.get(charId) ?? {}
  const cur = m[type]
  m[type] = { pts: Math.min(cap, (cur?.pts ?? 0) + gain), remaining: 20 }
  adaptiveStacks.set(charId, m)
}
function adaptiveFor(charId: string): Partial<Record<DamageType, number>> {
  const m = adaptiveStacks.get(charId)
  if (!m) return {}
  const out: Partial<Record<DamageType, number>> = {}
  for (const t in m) {
    const e = m[t as DamageType]
    if (e && e.remaining > 0 && e.pts > 0) out[t as DamageType] = e.pts
  }
  return out
}
function adaptiveTick(dt: number) {
  for (const m of adaptiveStacks.values()) {
    for (const t in m) {
      const e = m[t as DamageType]
      if (e) e.remaining -= dt
    }
  }
}

// PURGATEUR « Combustion purificatrice » : altérations subies → carburant de dégâts (par héros).
function fuelAdd(charId: string) {
  gemCounters.set(`fuel:${charId}`, (gemCounters.get(`fuel:${charId}`) ?? 0) + 1)
}
function fuelMult(charId: string, fuel?: { per: number; cap: number }): number {
  if (!fuel) return 1
  return 1 + Math.min(fuel.cap, (gemCounters.get(`fuel:${charId}`) ?? 0) * fuel.per)
}
/** Remise à zéro du carburant (wipe / fin d'instance — comme le Crescendo). */
function fuelReset() {
  for (const k of [...gemCounters.keys()]) if (k.startsWith('fuel:')) gemCounters.delete(k)
}

/**
 * ÉGIDE : enrichit les résistances effectives de l'équipe — « Égide partagée » (l'aura du
 * meilleur porteur profite aux ALLIÉS) + « Aegis adaptatif » (stacks du héros). Mute info[].
 */
function enrichResists(
  chars: Character[],
  info: ({ resist: Partial<Record<DamageType, number>>; cmods: CharCombatMods } | null)[],
) {
  // Aura : pour chaque type, la meilleure part partagée (et son porteur, exclu de sa propre aura).
  const aura: Partial<Record<DamageType, { v: number; owner: number }>> = {}
  chars.forEach((_, i) => {
    const d = info[i]
    if (!d || d.cmods.shareResist <= 0) return
    for (const t in d.resist) {
      const type = t as DamageType
      const v = (d.resist[type] ?? 0) * d.cmods.shareResist
      if (v > (aura[type]?.v ?? 0)) aura[type] = { v, owner: i }
    }
  })
  const hasAura = Object.keys(aura).length > 0
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const adaptive = d.cmods.adaptiveResist ? adaptiveFor(c.id) : null
    if (!hasAura && !adaptive) return
    const merged: Partial<Record<DamageType, number>> = { ...d.resist }
    if (hasAura) {
      for (const t in aura) {
        const type = t as DamageType
        const a = aura[type]
        if (a && a.owner !== i) merged[type] = (merged[type] ?? 0) + a.v
      }
    }
    if (adaptive) {
      for (const t in adaptive) {
        const type = t as DamageType
        merged[type] = (merged[type] ?? 0) + (adaptive[type] ?? 0)
      }
    }
    d.resist = merged
  })
}

/** 🔁 Boucle temporelle : remet à zéro TOUTES les recharges des héros donnés. */
function resetAllCooldowns(chars: Character[]) {
  for (const c of chars) for (const pid of c.powers) if (pid) cooldowns.set(`${c.id}:${pid}`, 0)
}

/** 🕊️ Sursis : si un héros vient de tomber et que sa rune est prête, il survit à 25% PV. */
function applySursis(chars: Character[], sursisCd?: number): string[] {
  if (!sursisCd) return []
  const revived: string[] = []
  const now = Date.now()
  for (const c of chars) {
    if (c.hp > 0) continue
    if ((sursisReadyAt.get(c.id) ?? 0) > now) continue
    c.hp = charMaxHp(c) * 0.25
    sursisReadyAt.set(c.id, now + sursisCd * 1000)
    revived.push(c.name)
  }
  return revived
}

/** Bonus du Crescendo : +1% de dégâts par kill, capé — remis à zéro quand l'équipe tombe. */
function crescendoBonus(cap?: number): number {
  return cap ? Math.min(cap, 0.01 * (gemCounters.get('crescendo') ?? 0)) : 0
}
function crescendoAdd(kills: number) {
  gemCounters.set('crescendo', (gemCounters.get('crescendo') ?? 0) + kills)
}
function crescendoReset() {
  gemCounters.delete('crescendo')
  fuelReset() // 🜍 Purgateur : le carburant d'affliction retombe quand l'équipe tombe
}

/** Trésorerie de guerre : chaque kill blinde un bouclier (2% PV max, cumul capé). */
function tresorerieShield(chars: Character[], cap?: number) {
  if (!cap) return
  for (const c of chars) {
    if (c.hp <= 0) continue
    const mh = charMaxHp(c)
    const capV = cap * mh
    if ((c.absorb ?? 0) < capV) c.absorb = Math.min(capV, (c.absorb ?? 0) + 0.02 * mh)
  }
}

function freshSave(): SaveData {
  return {
    characters: [makeCharacter('Héros', 1, 'force')],
    activeChar: 0,
    stage: 1,
    bestStage: 1,
    activeBiome: 'physique',
    biomeStages: emptyBiomeRecord(1, 1),
    biomeBest: emptyBiomeRecord(1, 0),
    farmLock: false,
    gold: 0,
    essence: 0,
    noyau: 0,
    poussiere: 0,
    quint: emptyQuint(),
    gems: {},
    gemDust: 0,
    essences: {},
    sceaux: 0,
    dungeonProgress: emptyDungeonProgress(),
    dungeon: null,
    pendingChest: null,
    pendingChoice: null,
    lastFreeBox: 0,
    boxPity: 0,
    orbes: 0,
    fragments: 0,
    cosmic: 0,
    raidProgress: emptyRaidProgress(),
    raidTrophies: {},
    raidTierUnlocked: {},
    raid: null,
    runesOwned: {},
    codex: [],
    upgrades: {},
    metiers: emptyMetiers(),
    automates: [],
    shopStock: [],
    inventory: [],
    recycleThreshold: 4,
    autoRecycle: false,
    killsSinceEpic: 0,
    lastSeen: Date.now(),
    lastShopRefresh: 0,
  }
}

/**
 * Protection des ventes/recyclages DE MASSE : les objets à effet unique de très haute rareté
 * (Cosmique+) ne partent jamais en lot — recyclage à l'unité uniquement. Les uniques plus communs
 * (Épique…) restent recyclables en masse : c'est le moteur d'essences du jeu.
 */
function bulkProtected(item: Item): boolean {
  return !!item.unique && RARITIES[item.rarity].tier >= 13
}

/** Ajoute les uniques portés par des objets au grimoire (sans doublon). */
function discoverFromItems(codex: string[], items: (Item | undefined)[]): string[] {
  let out = codex
  for (const it of items) {
    const id = it?.unique?.id
    if (id && !out.includes(id)) out = [...out, id]
  }
  return out
}

let migrateId = 1
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateItem(item: any) {
  if (!item.type && item.slot) {
    const s = item.slot
    item.type = (s === 'anneau1' || s === 'anneau2' ? 'anneau' : s === 'bijou1' || s === 'bijou2' ? 'bijou' : s) as ItemType
    delete item.slot
  }
  if (item.unique && typeof item.unique.rank !== 'number') item.unique = { id: item.unique.id, rank: 1 }
  // Migration itémisation : Endurance garantie + orientation, primaire offensif uniquement.
  if (item.primary === 'endurance') {
    item.endurance = (item.endurance ?? 0) + item.primaryValue
    item.primary = 'force'
    item.primaryValue = Math.max(1, Math.round(item.primaryValue * 0.3))
    item.orientation = 'defensif'
  }
  if (typeof item.endurance !== 'number') item.endurance = 0
  if (!item.orientation) item.orientation = 'offensif'
  // Migration des affixes vers le format unifié (stat / dmgType / resist).
  // Renommage v0.17 : Bouclier→Barrière, Polyvalence supprimée→Maîtrise (préserve la valeur du stuff).
  const renameStat = (s: string): import('./types').SecondaryStat => (s === 'bouclier' ? 'barriere' : s === 'polyvalence' ? 'maitrise' : s) as import('./types').SecondaryStat
  const validStats = new Set<string>(SECONDARY_STATS)
  const affixes: Affix[] = []
  if (Array.isArray(item.affixes)) {
    for (const a of item.affixes) {
      if (a && a.kind === 'stat') { const st = a.stat ? renameStat(a.stat) : undefined; if (st && validStats.has(st)) affixes.push({ ...a, stat: st } as Affix) }
      else if (a && a.kind) affixes.push(a as Affix)
      else if (a && a.stat && validStats.has(renameStat(a.stat))) affixes.push({ kind: 'stat', stat: renameStat(a.stat), value: a.value })
    }
  }
  if (Array.isArray(item.typeAffixes)) {
    for (const ta of item.typeAffixes) if (ta?.type) affixes.push({ kind: 'dmgType', type: ta.type, value: ta.value })
    delete item.typeAffixes
  }
  item.affixes = affixes
}

function sanitizeItem(item: Item) {
  item.id = `save-${migrateId++}`
  migrateItem(item)
}

/** Nettoie/migre les objets (inventaire + équipement de chaque perso). */
function sanitize(save: SaveData): SaveData {
  for (const item of save.inventory) sanitizeItem(item)

  // Ressources / champs ajoutés.
  if (typeof save.poussiere !== 'number') save.poussiere = 0
  if (typeof save.cosmic !== 'number') save.cosmic = 0
  {
    const q = emptyQuint()
    const src = (save.quint ?? {}) as Record<string, number>
    for (const t of DAMAGE_TYPE_LIST) if (typeof src[t] === 'number') q[t] = src[t]
    save.quint = q
  }
  if (typeof save.farmLock !== 'boolean') save.farmLock = false
  if (!save.gems || typeof save.gems !== 'object') save.gems = {}
  if (typeof save.gemDust !== 'number') save.gemDust = 0
  // Migration gemmes (v0.22) : les ÉLÉMENTAIRES sont broyées en poussière 🔹, les gemmes de
  // condition gagnent un rang (clé `cond:id[:rang]`). S'applique au stock ET aux gemmes serties.
  {
    for (const k of Object.keys(save.gems)) {
      if (k.startsWith('cond:')) {
        if (!parseCondKey(k)) delete save.gems[k] // gemme disparue du registre
        continue
      }
      const g = parseGemKey(k)
      save.gemDust += (save.gems[k] ?? 0) * legacyGemDust(g.tier || 1)
      delete save.gems[k]
    }
    const migrateItemGems = (it: Item) => {
      if (!it.gems?.length) return
      const keep: typeof it.gems = []
      for (const g of it.gems) {
        if (g.cond && getCondGem(g.cond)) keep.push({ ...g, rank: g.rank ?? 1 })
        else save.gemDust += legacyGemDust(g.tier || 1)
      }
      it.gems = keep.length ? keep : undefined
    }
    // Runes de STAT supprimées (v0.22) : effacées et remboursées en 🌌 poussière d'étoile.
    const migrateItemRune = (it: Item) => {
      if (it.enchant && !getEnchant(it.enchant)) {
        delete it.enchant
        save.poussiere += 8
      }
    }
    for (const it of save.inventory) { migrateItemGems(it); migrateItemRune(it) }
    for (const it of save.shopStock ?? []) { migrateItemGems(it); migrateItemRune(it) }
    for (const c of save.characters) for (const slot in c.equipment) { const it = c.equipment[slot as EquipSlotId]; if (it) { migrateItemGems(it); migrateItemRune(it) } }
  }
  // Automates : valide la structure (mission, bornes d'amélioration, banque).
  if (!Array.isArray(save.automates)) save.automates = []
  save.automates = save.automates
    .filter((a) => a && typeof a === 'object')
    .slice(0, AUTOMATE_MAX)
    .map((a, i) => ({
      id: typeof a.id === 'number' ? a.id : i + 1,
      name: typeof a.name === 'string' ? a.name : AUTOMATE_NAMES[i] ?? `Automate ${i + 1}`,
      mission: a.mission && (a.mission.kind === 'dungeon' || a.mission.kind === 'raid') && typeof a.mission.level === 'number' ? a.mission : null,
      progress: typeof a.progress === 'number' ? Math.max(0, a.progress) : 0,
      paused: a.paused === true,
      speedLvl: Math.max(0, Math.min(AUTOMATE_UPG_MAX, a.speedLvl ?? 0)),
      yieldLvl: Math.max(0, Math.min(AUTOMATE_UPG_MAX, a.yieldLvl ?? 0)),
      bank: a.bank && typeof a.bank === 'object' ? a.bank : {},
    }))
  // Métiers (v0.22) : migration de l'ancien duo Savoir-faire 🔧 / forgeUpgrades, sinon validation.
  // ATTENTION : loadSave spreade freshSave() AVANT la vieille sauvegarde — `save.metiers` existe
  // donc toujours (vide). La présence des champs LEGACY fait foi, pas l'absence de `metiers`.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = save as any
    const hasLegacy = typeof legacy.forgeMastery === 'number' || (legacy.forgeUpgrades && typeof legacy.forgeUpgrades === 'object')
    const metiersEmpty = !save.metiers || typeof save.metiers !== 'object' || !save.metiers.forgeron ||
      METIER_LIST.every((m) => {
        const st = save.metiers[m.id]
        return !st || ((st.xp ?? 0) === 0 && Object.keys(st.nodes ?? {}).length === 0)
      })
    if (hasLegacy && metiersEmpty) {
      save.metiers = migrateLegacyForge(
        typeof legacy.forgeMastery === 'number' ? legacy.forgeMastery : 0,
        legacy.forgeUpgrades && typeof legacy.forgeUpgrades === 'object' ? legacy.forgeUpgrades : {},
        save.automates.length > 0,
      )
    } else {
      const clean = emptyMetiers()
      for (const m of METIER_LIST) {
        const st = save.metiers[m.id]
        if (st && typeof st === 'object') {
          clean[m.id].xp = typeof st.xp === 'number' ? Math.max(0, st.xp) : 0
          if (st.nodes && typeof st.nodes === 'object') {
            for (const [id, rank] of Object.entries(st.nodes)) {
              const def = getMetierNode(m.id, id)
              if (def && typeof rank === 'number' && rank > 0) clean[m.id].nodes[id] = Math.min(def.maxRank, rank)
            }
          }
        }
      }
      save.metiers = clean
    }
    delete legacy.forgeMastery
    delete legacy.forgeUpgrades
  }
  if (typeof save.recycleThreshold !== 'number') save.recycleThreshold = 4
  if (typeof save.autoRecycle !== 'boolean') save.autoRecycle = false
  if (typeof save.lastFreeBox !== 'number') save.lastFreeBox = 0
  if (typeof save.boxPity !== 'number') save.boxPity = 0
  if (save.pendingChoice && !Array.isArray(save.pendingChoice.items)) save.pendingChoice = null
  if (typeof save.killsSinceEpic !== 'number') save.killsSinceEpic = 0
  if (typeof save.lastSeen !== 'number') save.lastSeen = Date.now()
  if (typeof save.lastShopRefresh !== 'number') save.lastShopRefresh = 0

  // Biomes (v0.18) : une ancienne save mono-zone devient le biome Physique.
  if (!save.activeBiome || !BIOME_IDS.includes(save.activeBiome)) save.activeBiome = 'physique'
  {
    const stages = emptyBiomeRecord(Math.max(1, save.stage ?? 1), 1)
    const best = emptyBiomeRecord(Math.max(1, save.bestStage ?? 1), 0)
    const srcStages = (save.biomeStages ?? {}) as Record<string, number>
    const srcBest = (save.biomeBest ?? {}) as Record<string, number>
    for (const id of BIOME_IDS) {
      if (typeof srcStages[id] === 'number') stages[id] = srcStages[id]
      if (typeof srcBest[id] === 'number') best[id] = srcBest[id]
    }
    save.biomeStages = stages
    save.biomeBest = best
    // `stage` = palier courant du biome actif ; `bestStage` = max global.
    save.stage = Math.max(1, stages[save.activeBiome] ?? 1)
    save.bestStage = globalBest(best)
  }

  // raidProgress : ancien `number` (raids génériques) → record par raid (refonte). On repart à 0.
  const rp = save.raidProgress as unknown
  if (!rp || typeof rp === 'number') {
    save.raidProgress = emptyRaidProgress()
  } else {
    const rec = emptyRaidProgress()
    for (const id of Object.keys(RAIDS) as RaidId[]) rec[id] = (rp as RaidProgress)[id] ?? 0
    save.raidProgress = rec
  }
  // 🏆 Trophées & tiers débloqués (v0.24) : migration — l'accès existant est conservé
  // (tier débloqué = meilleur tier vaincu + 1), les Trophées partent de zéro.
  if (!save.raidTrophies || typeof save.raidTrophies !== 'object') save.raidTrophies = {}
  // 🪄 Runes possédées (v0.25) : stash vide au départ — les runes déjà GRAVÉES sont conservées.
  if (!save.runesOwned || typeof save.runesOwned !== 'object') save.runesOwned = {}
  {
    // SEED UNIQUE (v0.24 fix) : si la save n'a pas encore de tiers débloqués (pré-v0.24), on dérive
    // l'accès du meilleur tier vaincu +1. SINON on conserve l'acquis SANS re-bump — avant, ce bloc
    // tournait à CHAQUE chargement et faisait `max(progress+1, …)` → clear le tier N rouvrait le N+1
    // GRATUITEMENT au reload (le gate Trophées court-circuité). Désormais seul `unlockRaidTier` ouvre.
    const existing = save.raidTierUnlocked && typeof save.raidTierUnlocked === 'object'
      ? (save.raidTierUnlocked as Partial<Record<RaidId, number>>)
      : null
    const unlocked: Partial<Record<RaidId, number>> = {}
    for (const id of Object.keys(RAIDS) as RaidId[]) {
      unlocked[id] = existing
        ? Math.max(1, existing[id] ?? 1)                // conserve, ne re-bump jamais depuis progress
        : Math.max(1, (save.raidProgress[id] ?? 0) + 1) // seed initial, une seule fois
    }
    save.raidTierUnlocked = unlocked
  }

  // Raid en cours au format obsolète (pas de `raidId`) → abandonné par la migration.
  if (save.raid && !(save.raid as { raidId?: string }).raidId) save.raid = null
  // v0.23 : un raid = UN affrontement. Un raid multi-boss en cours (ancienne save) est abandonné.
  if (save.raid && (save.raid as ActiveRaid).totalBosses !== 1) save.raid = null

  // dungeonProgress : REFONTE v0.17 (clé = id de donjon-ressource, plus le type de dégâts) → reset propre,
  // en conservant uniquement les clés déjà au nouveau format si présentes.
  const dp = save.dungeonProgress as unknown
  const dprec = emptyDungeonProgress()
  if (dp && typeof dp === 'object') {
    for (const id of Object.keys(DUNGEONS) as DungeonId[]) {
      const v = (dp as Record<string, number>)[id]
      if (typeof v === 'number') dprec[id] = v
    }
  }
  save.dungeonProgress = dprec

  // Donjon actif : structure refondue (v0.17). Sans `dungeonId` (ancien format), on l'abandonne proprement.
  if (save.dungeon && !(save.dungeon as { dungeonId?: string }).dungeonId) save.dungeon = null
  if (save.raid) {
    const r = save.raid as ActiveRaid & { enemy?: Enemy }
    if (!Array.isArray(r.enemies)) {
      r.enemies = r.enemy ? [r.enemy] : []
    }
    delete r.enemy
    if (!r.enemies.length) save.raid = null
  }
  for (const c of save.characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as EquipSlotId]
      if (it) sanitizeItem(it)
    }
    // Talents : on CONSERVE l'allocation du joueur. On purge seulement les nœuds
    // inconnus (vieilles sauvegardes), on garantit la racine, et on recalcule les dérivés.
    const rawTalents = c.talents && typeof c.talents === 'object' ? c.talents : {}
    const talents: Record<string, number> = { co_start: 1 }
    let spent = 0
    for (const id in rawTalents) {
      if (id === 'co_start') continue
      const node = getTalent(id)
      const rank = rawTalents[id]
      if (!node || rank <= 0) continue
      const r = Math.min(rank, node.maxRank)
      talents[id] = r
      spent += r
    }
    c.talents = talents
    // Points restants = gagnés (au-delà du niveau de départ des talents) − dépensés (hors racine gratuite).
    c.talentPoints = Math.max(0, talentPointsForLevel(c.level) - spent)
    c.unlockedPowers = computeUnlockedPowers(talents)
    // On garde les capacités équipées encore débloquées (sinon créneau vidé).
    const equipped = Array.isArray(c.powers) ? c.powers : []
    c.powers = [0, 1, 2, 3, 4].map((i) => {
      const p = equipped[i]
      return p && c.unlockedPowers.includes(p) ? p : null
    })
    // Mode auto/manuel par emplacement (défaut AUTO).
    c.powerAuto = [0, 1, 2, 3, 4].map((i) => (Array.isArray(c.powerAuto) ? c.powerAuto[i] !== false : true))
    // Présets de build : structure validée (3 emplacements max, entrées bien formées).
    if (Array.isArray(c.buildPresets)) {
      c.buildPresets = c.buildPresets.slice(0, 3).map((p) =>
        p && typeof p === 'object' && p.talents && Array.isArray(p.powers)
          ? { name: String(p.name ?? 'Build').slice(0, 14), talents: p.talents, powers: p.powers.slice(0, 5), primaryBias: p.primaryBias ?? 'force' }
          : null,
      )
    } else {
      c.buildPresets = undefined
    }
    const mh = charMaxHp(c)
    c.hp = c.hp > 0 ? Math.min(c.hp, mh) : mh
    // Statuts de combat transitoires : ne pas les conserver entre deux sessions.
    c.stun = 0
    c.dots = undefined
    c.weaken = undefined
  }

  // Grimoire : amorce les découvertes depuis l'inventaire + l'équipement de l'équipe.
  let codex = Array.isArray(save.codex) ? save.codex : []
  codex = discoverFromItems(codex, save.inventory)
  for (const c of save.characters) codex = discoverFromItems(codex, Object.values(c.equipment))
  save.codex = codex

  return save
}

/** Construit l'équipe à partir d'une ancienne sauvegarde mono-personnage. */
function migrateOldSave(p: any): SaveData {
  const hero: Character = {
    id: 'char-hero',
    name: 'Héros',
    level: p.level ?? 1,
    xp: p.xp ?? 0,
    base: p.base ?? { force: 5, agilite: 5, intelligence: 5, endurance: 10 },
    equipment: p.equipment ?? {},
    powers: [null, null, null, null, null],
    unlockedPowers: [],
    talentPoints: talentPointsForLevel(p.level ?? 1),
    talents: {},
    primaryBias: p.primaryBias ?? 'force',
    hp: p.hp ?? 0,
  }
  // (talents/capacités réinitialisés par sanitize)

  const fresh = freshSave()
  return sanitize({
    ...fresh,
    characters: [hero],
    stage: p.stage ?? 1,
    bestStage: p.bestStage ?? 1,
    gold: p.gold ?? 0,
    essence: p.essence ?? 0,
    noyau: p.noyau ?? 0,
    essences: p.essences ?? {},
    sceaux: p.sceaux ?? 0,
    dungeonProgress: p.dungeonProgress ?? 0,
    dungeon: p.dungeon ?? null,
    pendingChest: p.pendingChest ?? null,
    inventory: p.inventory ?? [],
  })
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (Array.isArray(p.characters)) return sanitize({ ...freshSave(), ...p })
      return migrateOldSave(p)
    }
  } catch {
    /* ignore */
  }
  return freshSave()
}

function persist(s: GameState) {
  const data: SaveData = {
    characters: s.characters,
    activeChar: s.activeChar,
    stage: s.stage,
    bestStage: s.bestStage,
    activeBiome: s.activeBiome,
    // Le biome actif reflète `stage` → on le synchronise à la sauvegarde.
    biomeStages: { ...s.biomeStages, [s.activeBiome]: s.stage },
    biomeBest: s.biomeBest,
    farmLock: s.farmLock,
    gold: s.gold,
    essence: s.essence,
    noyau: s.noyau,
    poussiere: s.poussiere,
    quint: s.quint,
    gems: s.gems,
    gemDust: s.gemDust,
    essences: s.essences,
    sceaux: s.sceaux,
    dungeonProgress: s.dungeonProgress,
    dungeon: s.dungeon,
    pendingChest: s.pendingChest,
    pendingChoice: s.pendingChoice,
    lastFreeBox: s.lastFreeBox,
    boxPity: s.boxPity,
    orbes: s.orbes,
    fragments: s.fragments,
    cosmic: s.cosmic,
    raidProgress: s.raidProgress,
    raidTrophies: s.raidTrophies,
    raidTierUnlocked: s.raidTierUnlocked,
    raid: s.raid,
    runesOwned: s.runesOwned,
    codex: s.codex,
    upgrades: s.upgrades,
    metiers: s.metiers,
    automates: s.automates,
    shopStock: s.shopStock,
    inventory: s.inventory,
    recycleThreshold: s.recycleThreshold,
    autoRecycle: s.autoRecycle,
    killsSinceEpic: s.killsSinceEpic,
    lastSeen: Date.now(),
    lastShopRefresh: s.lastShopRefresh,
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

// ---- Logique de personnage / objets ----

function findItemById(s: GameState, id: string): Item | undefined {
  const inv = s.inventory.find((i) => i.id === id)
  if (inv) return inv
  for (const c of s.characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as EquipSlotId]
      if (it && it.id === id) return it
    }
  }
  return undefined
}

/** Applique un patch à un objet (inventaire ou équipement d'un perso) et reclampe les PV. */
function applyItemPatch(s: GameState, id: string, patch: Partial<Item>): Partial<GameState> | null {
  const invIdx = s.inventory.findIndex((i) => i.id === id)
  if (invIdx >= 0) {
    const inventory = [...s.inventory]
    inventory[invIdx] = { ...inventory[invIdx], ...patch }
    return { inventory }
  }
  let touched = false
  const characters = s.characters.map((c) => {
    let changed = false
    const equipment: Equipment = { ...c.equipment }
    for (const slot in equipment) {
      const it = equipment[slot as EquipSlotId]
      if (it && it.id === id) {
        equipment[slot as EquipSlotId] = { ...it, ...patch }
        changed = true
      }
    }
    if (!changed) return c
    touched = true
    const nc = { ...c, equipment }
    nc.hp = Math.min(nc.hp, charMaxHp(nc))
    return nc
  })
  return touched ? { characters } : null
}

function highestLevel(chars: Character[]): number {
  return chars.reduce((m, c) => Math.max(m, c.level), 1)
}

/** Soin complet + purge des statuts de combat transitoires (mort, repli, fin de donjon/raid). */
function fullHeal(c: Character): Character {
  return { ...c, hp: charMaxHp(c), stun: 0, dots: undefined, weaken: undefined }
}

/** Met à jour les multiplicateurs globaux (combat, inventaire, régén) depuis les améliorations. */
function refreshGlobals(upgrades: Record<string, number>) {
  const m = computeGlobalMods(upgrades)
  setGlobalCombatMods({ power: m.power, attackSpeed: m.attackSpeed, vitality: m.vitality })
  invMax = INV_BASE + m.inventoryBonus
  regenMult = m.regen
}

// ---- Marchand ----
const SHOP_SIZE = 6
/** Intervalle de rotation de l'échoppe : 1 h réelle (indépendant du combat). */
export const SHOP_INTERVAL_MS = 60 * 60 * 1000
export interface MysteryBox {
  id: number
  name: string
  icon: string
  gold: number
  count: number
  /** Fourchette de rareté des objets (distribution pondérée + jackpot). */
  minTier: number
  maxTier: number
  jackpot: number
  /** Cible un type d'objet précis. */
  type?: ItemType
  /** Cible une CATÉGORIE d'objets (tire un type au hasard dedans : armes / armures / bijoux). */
  types?: ItemType[]
  /** GARANTIT la stat primaire des objets (coffre de build : Guerrier/Rôdeur/Mage). */
  primary?: OffensiveStat
  /** GARANTIT une ligne de stat secondaire sur chaque objet (coffre à affixe : Critique…). */
  guaranteeAffix?: SecondaryStat
  /** Biaise vers des résistances (stuff défensif). */
  biasResist?: boolean
  /** Garantit au moins un effet unique. */
  guaranteeUnique?: boolean
  eclats?: number
  noyau?: number
  poussiere?: number
  fragments?: number
  /** Récompenses en CLÉS (Trousseau du Pilleur). */
  sceaux?: number
  orbes?: number
  /** 🔹 Poussière de gemme (base — scalée sur le bestStage à l'achat). */
  gemDust?: number
  /** Chance qu'une gemme de CONDITION (rang 1) accompagne le coffre. */
  gemChance?: number
  /** Coffre du Jour 🗓️ : gratuit, un par FREE_BOX_COOLDOWN_MS. */
  free?: boolean
  /** Coffre du Destin 🎭 : révèle `count` objets, le joueur n'en GARDE qu'un (les autres recyclés). */
  choice?: boolean
  /** Coffre élémentaire 🔥 : l'élément est choisi à l'achat → ligne « +% dégâts du type » garantie. */
  elementPick?: boolean
  /** Coffre du Collectionneur 📖 : effet unique JAMAIS DÉCOUVERT garanti (complète le Grimoire). */
  collector?: boolean
  /** Coffre du Maillon Faible 🧩 : cible l'emplacement équipé le plus faible du perso actif. */
  weakest?: boolean
  /** Coffre Maudit 🎲 : 75% contenu DOUBLÉ, 25% un seul objet Commun. */
  cursed?: boolean
  /** Coût SUPPLÉMENTAIRE en ressources de raid (les coffres d'élite ne s'achètent pas qu'avec de l'or). */
  costFragments?: number
  costCosmic?: number
  desc: string
}

/** Coffre du Jour 🗓️ : un gratuit toutes les 22 h (réelles). */
export const FREE_BOX_COOLDOWN_MS = 22 * 3600 * 1000
/** Achat en gros 📦 : ×5 d'un coup → -10% sur l'or (pas sur les ressources de raid). */
export const BOX_BULK_QTY = 5
export const BOX_BULK_DISCOUNT = 0.9
/** Karma du marchand 🍀 : +1% de jackpot par coffre sans jackpot, plafonné à +25% ; reset au proc. */
export const BOX_PITY_STEP = 0.01
export const BOX_PITY_CAP = 0.25
/** Coffre Maudit 🎲 : chance que la malédiction soit déjouée (contenu doublé). */
export const CURSED_WIN_CHANCE = 0.75

// Catégories d'objets pour les coffres ciblés par slot.
const BOX_WEAPONS: ItemType[] = ['armePrincipale', 'armeSecondaire']
const BOX_ARMOR: ItemType[] = ['tete', 'epaules', 'cape', 'torse', 'poignets', 'mains', 'taille', 'jambes', 'pieds']
const BOX_ACCESSORIES: ItemType[] = ['anneau', 'bijou', 'cou']

/**
 * Coffres CIBLÉS et ATTRACTIFS (refonte v0.19). Au lieu de coffres « génériques » sans intérêt,
 * chaque coffre a une PROMESSE claire : un build (Guerrier/Rôdeur/Mage), un slot (armes/armures/
 * bijoux), un affixe fort (Critique), de la défense, ou des matériaux. Les petits coffres GARANTISSENT
 * un objet utile (ta stat) + des éclats → ils ne sont plus jamais « gâchés ».
 * id = index dans le tableau (utilisé par l'action mysteryBox).
 */
export const MYSTERY_BOXES: MysteryBox[] = [
  // --- Coffres de BUILD : bon marché, stat primaire GARANTIE + éclats → toujours utiles ---
  { id: 0, name: 'Coffre du Guerrier', icon: '🗡️', gold: 400, count: 2, minTier: 3, maxTier: 6, jackpot: 0.03, primary: 'force', eclats: 80, desc: 'FORCE garantie sur chaque objet (+ éclats). Rare → Légendaire.' },
  { id: 1, name: 'Coffre du Rôdeur', icon: '🏹', gold: 400, count: 2, minTier: 3, maxTier: 6, jackpot: 0.03, primary: 'agilite', eclats: 80, desc: 'AGILITÉ garantie sur chaque objet (+ éclats). Rare → Légendaire.' },
  { id: 2, name: 'Coffre du Mage', icon: '🔮', gold: 400, count: 2, minTier: 3, maxTier: 6, jackpot: 0.03, primary: 'intelligence', eclats: 80, desc: 'INTELLIGENCE garantie sur chaque objet (+ éclats). Rare → Légendaire.' },
  // --- Coffres de SLOT : combler un emplacement précis ---
  { id: 3, name: 'Arsenal', icon: '⚔️', gold: 45000, count: 2, minTier: 5, maxTier: 9, jackpot: 0.05, types: BOX_WEAPONS, desc: 'ARMES & boucliers uniquement. Épique → Mythique.' },
  { id: 4, name: 'Armurerie', icon: '🥋', gold: 45000, count: 3, minTier: 5, maxTier: 9, jackpot: 0.05, types: BOX_ARMOR, desc: 'PIÈCES D\'ARMURE uniquement. Épique → Mythique.' },
  { id: 5, name: 'Joaillier', icon: '💍', gold: 45000, count: 3, minTier: 5, maxTier: 9, jackpot: 0.05, types: BOX_ACCESSORIES, desc: 'BIJOUX (anneaux, talismans, colliers). Épique → Mythique.' },
  // --- Coffres à AFFIXE / DÉFENSE : stats garanties ---
  { id: 6, name: 'Coffre du Critique', icon: '🎯', gold: 120000, count: 3, minTier: 6, maxTier: 10, jackpot: 0.06, guaranteeAffix: 'degatsCrit', eclats: 500, desc: 'Ligne de Dégâts critiques GARANTIE sur chaque objet. Légendaire → Ascendant.' },
  { id: 7, name: 'Coffre du Gardien', icon: '🛡️', gold: 120000, count: 3, minTier: 6, maxTier: 10, jackpot: 0.06, biasResist: true, desc: 'Stuff défensif : résistances garanties. Légendaire → Ascendant.' },
  // --- Matériaux & haut de gamme ---
  { id: 8, name: 'Coffre du forgeron', icon: '🔨', gold: 400000, count: 1, minTier: 7, maxTier: 11, jackpot: 0.05, eclats: 3000, noyau: 12, poussiere: 8, desc: 'Matériaux de craft en MASSE (atelier/forge) + 1 objet.' },
  { id: 9, name: 'Coffre légendaire', icon: '🟠', gold: 800000, count: 4, minTier: 8, maxTier: 12, jackpot: 0.07, eclats: 1500, noyau: 5, poussiere: 3, costFragments: 2, desc: 'Mythique → Éternel. Exige des Fragments de raid.' },
  { id: 10, name: 'Coffre cosmique', icon: '🌟', gold: 2500000, count: 5, minTier: 10, maxTier: 14, jackpot: 0.09, guaranteeUnique: true, eclats: 4000, noyau: 10, poussiere: 12, fragments: 2, costFragments: 6, desc: 'Ascendant → Abyssal, 1 unique garanti. Exige des Fragments.' },
  { id: 11, name: 'Coffre du Néant', icon: '🕳️', gold: 10000000, count: 6, minTier: 12, maxTier: 16, jackpot: 0.13, guaranteeUnique: true, eclats: 10000, noyau: 25, poussiere: 35, fragments: 8, costFragments: 18, costCosmic: 3, desc: 'Le pari ultime : exige Fragments ✨ ET Éclats cosmiques 💫 (donc des raids).' },
  // --- Nouveautés v0.23 (les ids sont des INDEX : on n'insère jamais, on AJOUTE) ---
  { id: 12, name: 'Coffre du Jour', icon: '🗓️', gold: 0, free: true, count: 1, minTier: 4, maxTier: 8, jackpot: 0.06, eclats: 150, desc: 'GRATUIT toutes les 22 h. Un objet (Rare → Patrimoine) + des éclats. Reviens demain !' },
  { id: 13, name: 'Coffre Maudit', icon: '🎲', gold: 60000, count: 2, minTier: 6, maxTier: 10, jackpot: 0.08, cursed: true, desc: '75% : contenu DOUBLÉ (4 objets). 25% : la malédiction ne laisse qu\'un objet Commun.' },
  { id: 14, name: 'Coffre élémentaire', icon: '🔥', gold: 35000, count: 2, minTier: 5, maxTier: 9, jackpot: 0.05, elementPick: true, desc: 'Choisis un ÉLÉMENT : ligne « +% dégâts du type » garantie sur chaque objet (armes typées).' },
  { id: 15, name: 'Trousseau du Pilleur', icon: '🗝️', gold: 70000, count: 0, minTier: 1, maxTier: 1, jackpot: 0, sceaux: 5, orbes: 2, desc: '5 Sceaux 🔑 + 2 Orbes 🔮 d\'un coup — moins cher qu\'à l\'unité.' },
  { id: 16, name: 'Coffre du Lapidaire', icon: '💎', gold: 90000, count: 0, minTier: 1, maxTier: 1, jackpot: 0, gemDust: 220, gemChance: 0.45, desc: 'Poussière de gemme 🔹 (scalée sur ton record) + 45% de gemme de condition.' },
  { id: 17, name: 'Coffre du Destin', icon: '🎭', gold: 120000, count: 3, minTier: 6, maxTier: 11, jackpot: 0.07, choice: true, desc: 'Révèle 3 objets : tu n\'en GARDES qu\'UN, les deux autres sont recyclés en éclats.' },
  { id: 18, name: 'Coffre du Maillon Faible', icon: '🧩', gold: 150000, count: 2, minTier: 7, maxTier: 11, jackpot: 0.06, weakest: true, desc: 'Analyse ton équipement et cible ton EMPLACEMENT le plus faible (vide ou en retard).' },
  { id: 19, name: 'Coffre du Collectionneur', icon: '📖', gold: 300000, count: 1, minTier: 8, maxTier: 12, jackpot: 0.06, collector: true, costFragments: 3, desc: 'Un objet portant un effet unique JAMAIS DÉCOUVERT — complète le Grimoire.' },
]

/**
 * v0.25 — PRIX EN OR d'un coffre de stuff. Suit (a) la rareté ET (b) ton revenu d'or (record) :
 * un prix FIXE devenait vite trivial face au revenu exponentiel (« on a tout ce qu'on veut »).
 * Calé SOUS la croissance du Donjon d'Or (≈1,069^palier) → acheter coûte ~un nombre constant de
 * runs, qui décroît LENTEMENT (rentable sur le temps, jamais instantané). Lots de ressources
 * (count 0) & coffres gratuits : prix fixe (l'équation, indexée rareté, ne les concerne pas).
 */
const BOX_PRICE_K = 400       // base (~4 runs du Donjon d'Or au niveau courant)
const BOX_PRICE_RARITY = 2.5  // ×prix par cran de rareté moyenne (raide : « gonfle énormément » en haut)
const BOX_PRICE_STAGE = 1.06  // ×prix par palier de record (< revenu d'or → rentable sur le temps)
export function boxGoldPrice(box: MysteryBox, bestStage: number): number {
  if (box.free || box.count <= 0) return box.gold
  const tMoy = box.minTier + 1.5
  return Math.round(BOX_PRICE_K * box.count * Math.pow(BOX_PRICE_RARITY, tMoy - 3) * Math.pow(BOX_PRICE_STAGE, Math.max(1, bestStage)))
}

/** v0.25 — VERROU rareté×raids : meilleur tier de raid requis pour acheter (Céleste+ = raid only). */
export function boxRaidGate(box: MysteryBox): number {
  return Math.max(0, box.maxTier - 10) // maxTier 11→1 · 12→2 · 14→4 · 16→6
}
/** Meilleur tier de raid atteint, tous raids confondus. */
export function bestRaidTier(raidProgress: Record<string, number>): number {
  let best = 0
  for (const k in raidProgress) best = Math.max(best, raidProgress[k] ?? 0)
  return best
}

/** Prix d'achat d'un objet en échoppe (croît FORTEMENT avec la rareté → vrai puits d'or). */
export function shopBuyPrice(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  return Math.round(item.ilvl * Math.pow(tier, 2.6) * 1.5)
}

export function shopRefreshCost(bestStage: number): number {
  return Math.round(500 + bestStage * 60)
}

function generateShop(bestStage: number, luckBonus: number): Item[] {
  const ilvl = Math.max(1, stageIlvl(bestStage))
  const luck = stageLuckTier(bestStage) + 1 + luckBonus
  const out: Item[] = []
  for (let i = 0; i < SHOP_SIZE; i++) out.push(generateItem({ ilvl, luckTier: luck }))
  return out
}

/** Type d'objet de l'emplacement le plus FAIBLE d'un perso (vide en priorité, sinon score minimal). */
function weakestSlotType(c: Character): ItemType {
  let worst: { score: number; type: ItemType } | null = null
  for (const slot of EQUIP_SLOTS) {
    const it = c.equipment[slot.id]
    const score = it ? itemScore(it) : -1 // un emplacement vide est toujours le plus faible
    if (!worst || score < worst.score) worst = { score, type: slot.accepts }
  }
  return worst!.type
}

/** Affinité de drop : celle d'un membre d'équipe au hasard (nourrit tous les builds). */
function pickBias(chars: Character[]): OffensiveStat {
  const living = chars.filter((c) => c.hp > 0)
  const pool = living.length ? living : chars
  const b = pool[Math.floor(Math.random() * pool.length)]?.primaryBias
  return b === 'agilite' || b === 'intelligence' ? b : 'force'
}

/** Donne de l'XP à un perso, gère les montées de niveau (gains de base + points de talent). */
function grantXp(char: Character, xp: number): Character {
  let level = char.level
  let curXp = char.xp + xp
  const base = { ...char.base }
  while (curXp >= xpForLevel(level)) {
    curXp -= xpForLevel(level)
    level++
    base[char.primaryBias] = (base[char.primaryBias] ?? 0) + 1
    base.endurance = (base.endurance ?? 0) + 1
  }
  // Points de talent : seulement au-delà de TALENT_START_LEVEL (l'arbre se débloque plus tard).
  const gainedPoints = talentPointsForLevel(level) - talentPointsForLevel(char.level)
  return { ...char, level, xp: curXp, base, talentPoints: char.talentPoints + gainedPoints }
}

// ---- Combat d'équipe ----

interface CombatMods {
  enrage?: number
  reflect?: number
  regen?: number
  fightTime?: number
  /** Multiplicateur plat des dégâts ennemis (enrage dur / acharnement de raid). */
  dmgMult?: number
  /** Multiplicateur plat des dégâts du HÉROS (Maîtrise des Zones, crescendo, environnement). */
  heroMult?: number
  /** Gemmes de condition actives sur l'équipe (triggers de combat — voir condGems.ts). */
  cond?: CondMods
  /** Runes de TEMPS actives (manipulation des horloges — voir enchants.ts). */
  runes?: TimeRuneMods
}

/** Multiplicateur de dégâts SUBIS par un ennemi (vulnérabilité « Sceau de faiblesse »). */
function enemyVuln(enemy: Enemy): number {
  return enemy.vuln && enemy.vuln.remaining > 0 ? enemy.vuln.mult : 1
}

/**
 * Lance une capacité active. Renvoie les DÉGÂTS infligés à l'ennemi (pour la « Vengeance différée »).
 * Les dégâts des sorts scalent sur le PROFIL DE DÉGÂTS de l'arme/du stuff (profileDamageMult) — comme
 * les auto-attaques — pour qu'un build qui empile un type booste aussi ses sorts.
 */
function fireActive(p: PowerDef, caster: Character, derived: DerivedStats, profile: DamageProfile, chars: Character[], enemy: Enemy, hotBonus: number, dmgMult = 1, healToDamage = 0): number {
  const base = (p.magnitude ?? 1) * abilityPower(derived, powerScale(p)) // soins (sans profil ni keystones)
  const magDmg = base * profileDamageMult(profile) * dmgMult // dégâts : scalent sur le profil de l'arme + keystones (Carnage…)
  // Boucliers : scalent sur la MEILLEURE de (stat principale, Endurance) → un tank qui empile
  // l'Endurance obtient un énorme bouclier (levier de survie qui suit l'Endurance).
  const shieldBase = (p.magnitude ?? 1) * Math.max(abilityPower(derived, powerScale(p)), derived.endurancePower)
  const vm = enemyVuln(enemy)
  const hit = (dmg: number): number => { const before = enemy.hp; enemy.hp = Math.max(0, enemy.hp - dmg); return before - enemy.hp }
  // ORACLE SANGLANT : une fraction du SOIN est aussi infligée en dégâts à l'ennemi focus.
  const bleedHeal = (healed: number): number => (healToDamage > 0 && enemy.hp > 0 ? hit(healed * healToDamage * vm) : 0)
  switch (p.effect) {
    case 'nuke':
    case 'cleave':
    case 'megaCleave':
      return hit(magDmg * vm)
    case 'executeNuke': {
      // +250% de dégâts selon les PV MANQUANTS : finisher dévastateur.
      const missing = 1 - enemy.hp / Math.max(1, enemy.maxHp)
      return hit(magDmg * (1 + missing * 2.5) * vm)
    }
    case 'lifeNuke': {
      const done = hit(magDmg * vm)
      caster.hp = Math.min(charMaxHp(caster), caster.hp + done * 0.6)
      return done
    }
    case 'dot':
      // L'Altération amplifie les dégâts sur la durée.
      enemy.dot = { dps: Math.max(magDmg * 0.4 * derived.alterationMult, enemy.dot?.dps ?? 0), remaining: 5 }
      return 0
    case 'rupture':
      // Brise la régén ennemie + grosse plaie (dégât immédiat + DoT puissant).
      enemy.noRegen = Math.max(enemy.noRegen ?? 0, p.duration ?? 8)
      enemy.dot = { dps: Math.max(magDmg * 0.5 * derived.alterationMult, enemy.dot?.dps ?? 0), remaining: p.duration ?? 8 }
      return hit(magDmg * 0.5 * vm)
    case 'mark':
      enemy.vuln = { mult: p.magnitude ?? 1.4, remaining: p.duration ?? 8 } // magnitude = multiplicateur brut
      return 0
    case 'heal':
    case 'hot': {
      const allies = chars.filter((c) => c.hp > 0)
      if (allies.length) {
        let low = allies[0]
        for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
        low.hp = Math.min(charMaxHp(low), low.hp + base * (1 + hotBonus))
      }
      return bleedHeal(base * (1 + hotBonus))
    }
    case 'bigHeal':
      for (const a of chars) if (a.hp > 0) a.hp = Math.min(charMaxHp(a), a.hp + base * (1 + hotBonus))
      return bleedHeal(base * (1 + hotBonus))
    case 'buffParty':
      for (const a of chars) if (a.hp > 0) a.hp = Math.min(charMaxHp(a), a.hp + base * 0.5 * (1 + hotBonus))
      return bleedHeal(base * 0.5 * (1 + hotBonus))
    case 'shield':
      // Bouclier runique : absorption sur le porteur (scale stat principale OU Endurance).
      caster.absorb = (caster.absorb ?? 0) + shieldBase
      return 0
    case 'bigShield':
      // Énorme bouclier d'absorption (soaké avant les PV) + 40% à l'équipe.
      caster.absorb = (caster.absorb ?? 0) + shieldBase
      for (const a of chars) if (a.hp > 0 && a !== caster) a.absorb = (a.absorb ?? 0) + shieldBase * 0.4
      return 0
    case 'invuln':
      caster.invuln = Math.max(caster.invuln ?? 0, p.duration ?? 2)
      return 0
    case 'charge':
      // Démarre l'accumulation ; la frappe différée (×mult le cumul) est résolue dans le pas de combat.
      caster.charge = { dealt: 0, remaining: p.duration ?? 5, mult: p.magnitude ?? 3 }
      return 0
    case 'frenzy':
      caster.frenzy = { mult: p.magnitude ?? 2, remaining: p.duration ?? 6 }
      return 0
  }
  return 0
}

/** Applique des dégâts à un héros via l'immunité puis le bouclier d'absorption. Renvoie les PV réellement perdus. */
function damageHero(c: Character, amount: number): number {
  if (amount <= 0) return 0
  if ((c.invuln ?? 0) > 0) return 0 // immunité totale (Phase éthérée)
  let amt = amount
  if ((c.absorb ?? 0) > 0) {
    const soak = Math.min(c.absorb!, amt)
    c.absorb = c.absorb! - soak
    amt -= soak
    if ((c.absorb ?? 0) <= 0) c.absorb = undefined
  }
  c.hp -= amt
  return amt
}

/** Contexte de combat d'un héros utilisé pour résoudre les techniques ennemies. */
interface AbilityCtx {
  derived: DerivedStats
  resist: Partial<Record<DamageType, number>>
  passives: { threatMult: number; damageReduction: number }
  cmods: CharCombatMods
}

/** Applique l'effet d'une technique ennemie à un héros cible (modèle d'exigence + Purge). */
function applyEnemyAbility(ab: EnemyAbility, enemy: Enemy, t: Character, ctx: AbilityCtx) {
  const resist = ctx.resist[ab.element] ?? 0
  const purge = ctx.derived.purge
  const extra = (1 - ctx.passives.damageReduction) * (1 - ctx.cmods.flatDr)
  const req = enemyReq(enemy, ab.element)
  // ÉGIDE « Aegis adaptatif » : tout type qui te frappe te rend plus résistant à ce type.
  if (ctx.cmods.adaptiveResist && (ab.kind === 'dot' || ab.kind === 'burst' || ab.kind === 'drain')) {
    adaptiveAdd(t.id, ab.element, ctx.cmods.adaptiveResist.gain, ctx.cmods.adaptiveResist.cap)
  }
  // PURGATEUR : chaque affliction subie nourrit la Combustion purificatrice.
  if (ctx.cmods.afflictionFuel && (ab.kind === 'dot' || ab.kind === 'cc' || ab.kind === 'debuff')) fuelAdd(t.id)
  switch (ab.kind) {
    case 'dot': {
      // DoT : ignore armure/esquive. La PURGE réduit intensité + durée ET ronge l'exigence du
      // type sur les altérations (v0.24 §5.3 : Req_eff = Req − Purge×100 — la soupape anti-DoT).
      const reqDot = Math.max(0, req - purge * 100)
      const dps = Math.max(0, enemy.damage * ab.magnitude * resistMult(reqDot, resist, ctx.cmods.reqReduction) * (1 - purge))
      const remaining = (ab.duration ?? 4) * (1 - purge * 0.5)
      if (dps > 0) t.dots = [...(t.dots ?? []), { dps, type: ab.element, remaining }]
      break
    }
    case 'burst':
    case 'drain': {
      // Coup unique télégraphié : multiplicateur d'exigence + atténuation générique bornée,
      // puis passé par l'immunité/bouclier d'absorption du héros.
      const dmg = incomingDps(enemy.damage * ab.magnitude, ab.element, ctx.derived, ctx.resist, req, extra, ctx.cmods.reqReduction)
      const taken = damageHero(t, dmg)
      if (ab.kind === 'drain') enemy.hp = Math.min(enemy.maxHp, enemy.hp + taken * 0.6)
      break
    }
    case 'cc': {
      // Contrôle : durée réduite par la TÉNACITÉ.
      t.stun = Math.max(t.stun ?? 0, (ab.duration ?? 1) * (1 - ctx.derived.tenacity))
      break
    }
    case 'debuff': {
      // Malédiction : −35% de dégâts du héros ; durée réduite par la PURGE.
      const dur = (ab.duration ?? 5) * (1 - purge)
      if (dur > 0.3) t.weaken = { mult: 0.65, remaining: Math.max(t.weaken?.remaining ?? 0, dur) }
      break
    }
  }
}

/** Fait progresser les techniques d'un ennemi (cooldown + télégraphe) et applique celles qui tombent.
 *  `dilatation` (🐌 rune) : allonge la durée des télégraphes (plus de temps pour réagir). */
function tickEnemyAbilities(enemy: Enemy, chars: Character[], info: (AbilityCtx | null)[], dt: number, dilatation = 0) {
  if (!enemy.abilities || enemy.abilities.length === 0 || enemy.hp <= 0) return
  const alive = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
  if (!alive.length) return
  // Cible = plus haute menace (même logique que l'auto-attaque).
  let ti = alive[0]
  let best = -1
  for (const i of alive) {
    const d = info[i]!
    const dps = d.derived.power * d.derived.attacksPerSecond
    const score = (dps + 1) * d.passives.threatMult
    if (score > best) { best = score; ti = i }
  }
  const t = chars[ti]
  const ctx = info[ti]!
  for (const ab of enemy.abilities) {
    if ((ab.cast ?? 0) > 0) {
      ab.cast = (ab.cast ?? 0) - dt
      if ((ab.cast ?? 0) <= 0) { ab.cast = 0; applyEnemyAbility(ab, enemy, t, ctx); ab.cd = ab.cooldown }
    } else {
      ab.cd = (ab.cd ?? ab.cooldown) - dt
      if (ab.cd <= 0) {
        if (ab.telegraph && ab.telegraph > 0) ab.cast = ab.telegraph * (1 + dilatation)
        else { applyEnemyAbility(ab, enemy, t, ctx); ab.cd = ab.cooldown }
      }
    }
  }
}

/** Décompte des statuts transitoires du héros (étourdissement, malédiction, DoT subis). */
function tickHeroStatuses(chars: Character[], dt: number) {
  adaptiveTick(dt) // Égide : les stacks adaptatifs s'éventent (20 s glissantes)
  for (const c of chars) {
    if (c.stun && c.stun > 0) c.stun = Math.max(0, c.stun - dt)
    if (c.weaken) { c.weaken.remaining -= dt; if (c.weaken.remaining <= 0) c.weaken = undefined }
    if ((c.invuln ?? 0) > 0) { c.invuln = Math.max(0, c.invuln! - dt); if ((c.invuln ?? 0) <= 0) c.invuln = undefined }
    if (c.frenzy) { c.frenzy.remaining -= dt; if (c.frenzy.remaining <= 0) c.frenzy = undefined }
    if (c.charge) c.charge.remaining -= dt // la frappe différée est résolue dans le pas de combat
    if (c.dots && c.dots.length) {
      let dmg = 0
      for (const d of c.dots) { dmg += d.dps * dt; d.remaining -= dt }
      c.dots = c.dots.filter((d) => d.remaining > 0)
      if (c.dots.length === 0) c.dots = undefined
      if (dmg > 0 && c.hp > 0) c.hp = Math.max(0, c.hp - dmg)
    }
  }
}

/** Un pas de combat de l'équipe contre un ennemi. Renvoie l'état mis à jour. */
function partyCombatStep(input: Character[], enemyIn: Enemy, dt: number, mods?: CombatMods) {
  const enemy: Enemy = { ...enemyIn, dot: enemyIn.dot ? { ...enemyIn.dot } : undefined, abilities: enemyIn.abilities?.map((a) => ({ ...a })) }
  const chars: Character[] = input.map((c) => ({ ...c, dots: c.dots?.map((d) => ({ ...d })), weaken: c.weaken ? { ...c.weaken } : undefined }))
  // Âge du combat : nourrit le Sablier de l'Acharné (gemme) et le Premier élan (rune de temps).
  enemy.age = (enemy.age ?? 0) + dt
  // 🔁 Boucle temporelle : toutes les N secondes, les recharges de l'équipe tombent à zéro.
  if (mods?.runes?.boucleEvery) {
    boucleAcc += dt
    if (boucleAcc >= mods.runes.boucleEvery) { boucleAcc = 0; resetAllCooldowns(chars) }
  }
  // Étoile d'Overkill : excédent du coup fatal, reporté sur l'ennemi suivant par l'appelant.
  let overkill = 0
  // Œil de l'Opportuniste : bonus pendant qu'une technique ennemie INCANTE (télégraphe visible).
  const opportunisteMult = mods?.cond?.opportuniste && enemy.abilities?.some((a) => (a.cast ?? 0) > 0)
    ? 1 + mods.cond.opportuniste
    : 1
  // Décompte des statuts transitoires (étourdissement, malédiction, DoT subis) avant d'agir.
  tickHeroStatuses(chars, dt)
  const info = chars.map((c) =>
    c.hp > 0
      ? {
          derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c),
          resist: charResist(c), cmods: charCombatMods(c),
        }
      : null,
  )
  // ÉGIDE : aura partagée + stacks adaptatifs → résistances effectives.
  enrichResists(chars, info)

  let totalDealt = 0

  // 1) Attaques automatiques (+ Multifrappe) + DoT (keystone). Les persos étourdis n'attaquent pas.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    // ⏱️ Premier élan : vitesse d'attaque dopée en début de combat (rune de temps).
    const elanRune = mods?.runes?.premierElan && (enemy.age ?? 0) <= (mods.runes.premierElanDur ?? 10) ? 1 + mods.runes.premierElan : 1
    const hits = d.derived.attacksPerSecond * elanRune * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    // Malédiction (debuff ennemi) réduit les dégâts ; Frénésie (« Furie sanguinaire ») les amplifie.
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const acharne = mods?.cond?.acharneCap ? acharneMult(enemy.age ?? 0, mods.cond.acharneCap) : 1
    // 🫁 Second Souffle : le dos au mur (sous 30% PV) rend féroce.
    const souffle = mods?.cond?.souffle && hpFrac <= 0.3 ? 1 + mods.cond.souffle : 1
    // 🔪 ASSASSIN : fenêtre d'OUVERTURE (×mult les premières secondes face à cet ennemi).
    const opener = d.cmods.opener && (enemy.age ?? 0) <= d.cmods.opener.seconds ? d.cmods.opener.mult : 1
    // 🜍 PURGATEUR : le carburant d'affliction amplifie les dégâts.
    const fuel = fuelMult(c.id, d.cmods.afflictionFuel)
    // 🛡️ ÉGIDE « Gardien du seuil » : le surplus de résist face aux exigences devient des dégâts.
    const surplusMult = d.cmods.surplusToDamage > 0
      ? 1 + Math.min(d.cmods.surplusToDamage, (resistSurplus(enemy, d.resist) / RESIST_DSCALE) * d.cmods.surplusToDamage)
      : 1
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult * (mods?.heroMult ?? 1) * acharne * souffle * opportunisteMult * opener * fuel * surplusMult
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    const metroN = mods?.cond?.metronomeN
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole && enemy.hp > 0; h++) {
      // 🎼 Métronome : toutes les N attaques auto, la suivante est un CRITIQUE garanti.
      let forceCrit = false
      if (metroN) {
        const mk = `metronome:${c.id}`
        const n = (gemCounters.get(mk) ?? 0) + 1
        if (n >= metroN) { forceCrit = true; gemCounters.set(mk, 0) } else gemCounters.set(mk, n)
      }
      // ⚡ FOUDREUR « Décharge » : toutes les N attaques, la suivante frappe ×mult.
      let staticMult = 1
      if (d.cmods.staticN) {
        const sk = `static:${c.id}`
        const n = (gemCounters.get(sk) ?? 0) + 1
        if (n >= d.cmods.staticN.every) { staticMult = d.cmods.staticN.mult; gemCounters.set(sk, 0) } else gemCounters.set(sk, n)
      }
      // Multifrappe : chance de déclencher un coup supplémentaire.
      const strikes = 1 + (Math.random() < multistrikeChance ? 1 : 0)
      for (let s = 0; s < strikes && enemy.hp > 0; s++) {
        const hit = rollHit(d.derived, d.profile, enemy, { bonusMult, execute: d.cmods.execute, forceCrit: forceCrit && s === 0 })
        const dmg = hit.damage * enemyVuln(enemy) * (s === 0 ? staticMult : 1) // Sceau de faiblesse + Décharge
        if (mods?.cond?.overkill && dmg > enemy.hp) overkill += dmg - enemy.hp
        enemy.hp = Math.max(0, enemy.hp - dmg)
        totalDealt += dmg
        dealtThis += dmg
        healed += hit.heal
        if (d.cmods.dot) enemy.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac * d.derived.alterationMult, enemy.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
      }
    }
    if (c.charge) c.charge.dealt += dealtThis
    if (healed) c.hp = Math.min(charMaxHp(c), c.hp + healed)
  })

  // 2) Dégâts du DoT sur l'ennemi + décompte de ses statuts (vulnérabilité, anti-régén).
  if (enemy.dot && enemy.hp > 0) {
    const dmg = enemy.dot.dps * dt
    enemy.hp = Math.max(0, enemy.hp - dmg)
    totalDealt += dmg
    enemy.dot.remaining -= dt
    if (enemy.dot.remaining <= 0) enemy.dot = undefined
    // ☠ FAUCHEUR : les DoT te soignent (fraction du tick).
    chars.forEach((c, i) => {
      const d = info[i]
      if (d && c.hp > 0 && d.cmods.dotLeech > 0) c.hp = Math.min(charMaxHp(c), c.hp + dmg * d.cmods.dotLeech)
    })
  }
  if ((enemy.noRegen ?? 0) > 0) enemy.noRegen = Math.max(0, enemy.noRegen! - dt)
  if (enemy.vuln) { enemy.vuln.remaining -= dt; if (enemy.vuln.remaining <= 0) enemy.vuln = undefined }

  // 3) Capacités actives (cooldown réduit par la Récupération). AUTO = auto-lancées ; MANUEL = sur tap
  //    (castPower) uniquement, lancement STRICT (si pas prêt, rien). Étourdi = on ne LANCE pas, mais
  //    les RECHARGES continuent de tourner (le CD se résorbe même étourdi).
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const stunned = (c.stun ?? 0) > 0
    c.powers.forEach((pid, slot) => {
      if (!pid) return
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      const key = `${c.id}:${pid}`
      const cd = (cooldowns.get(key) ?? 0) - dt
      const auto = c.powerAuto?.[slot] !== false
      if (cd <= 0 && !stunned && (auto || manualFire.has(key))) {
        // 🩸 Pacte sanglant : recharges raccourcies, mais chaque lancement coûte 2% des PV max.
        const pacte = mods?.cond?.pacteCdr ?? 0
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr) * (1 - pacte))
        if (pacte > 0) c.hp = Math.max(1, c.hp - 0.02 * charMaxHp(c))
        manualFire.delete(key)
        // ⏳ CHRONOMANCIEN « Cascade temporelle » : chaque sort lancé rembourse les autres recharges.
        if (d.cmods.cdrOnCast > 0) {
          for (const pid2 of c.powers) {
            if (!pid2 || pid2 === pid) continue
            const k2 = `${c.id}:${pid2}`
            cooldowns.set(k2, Math.max(0, (cooldowns.get(k2) ?? 0) - d.cmods.cdrOnCast))
          }
        }
        // Sorts : keystones de dégâts (Carnage…) + ×sorts (Chronomancien) + heal→dégâts (Oracle sanglant).
        const spellMult = d.cmods.damageMult * d.cmods.spellMult
        const dealt = fireActive(p, c, d.derived, d.profile, chars, enemy, d.cmods.hot, spellMult, d.cmods.healToDamage)
        // Vengeance différée : compte AUSSI les dégâts des sorts dans le cumul.
        if (c.charge && dealt > 0) c.charge.dealt += dealt
        // 🔔 Pierre d'Écho : tous les N sorts de l'équipe, le suivant résonne une 2e fois (50%).
        const echoN = mods?.cond?.echoN
        if (echoN) {
          const n = (gemCounters.get('echo') ?? 0) + 1
          if (n >= echoN) {
            gemCounters.set('echo', 0)
            const echoDealt = fireActive(p, c, d.derived, d.profile, chars, enemy, d.cmods.hot, spellMult * 0.5, d.cmods.healToDamage * 0.5)
            if (c.charge && echoDealt > 0) c.charge.dealt += echoDealt
          } else gemCounters.set('echo', n)
        }
      } else {
        cooldowns.set(key, Math.max(0, cd))
        if (!auto && !stunned) manualFire.delete(key) // cast manuel strict : pas de file d'attente
      }
    })
  })

  // 3b) Vengeance différée : la fenêtre expirée, déchaîne ×mult TOUT le cumul (auto + sorts).
  for (const c of chars) {
    if (!c.charge || c.charge.remaining > 0) continue
    if (c.hp > 0 && enemy.hp > 0 && c.charge.dealt > 0) {
      const burst = c.charge.dealt * c.charge.mult * enemyVuln(enemy)
      enemy.hp = Math.max(0, enemy.hp - burst)
      totalDealt += burst
    }
    c.charge = undefined
  }

  // 4) L'ennemi frappe la plus haute menace (dégâts typés, réduits par la résistance héros).
  const alive = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
  if (enemy.hp > 0 && alive.length) {
    let targetI = alive[0]
    let best = -1
    for (const i of alive) {
      const d = info[i]!
      const dps = d.derived.power * d.derived.attacksPerSecond
      const score = (dps + 1) * d.passives.threatMult
      if (score > best) {
        best = score
        targetI = i
      }
    }
    const t = chars[targetI]
    const td = info[targetI]!
    // Étourdissement du boss (réduit par la Ténacité de la cible).
    if (enemy.ccDur) {
      enemy.ccCd = (enemy.ccCd ?? 0) - dt
      if (enemy.ccCd <= 0) {
        enemy.ccCd = CC_INTERVAL
        t.stun = Math.max(t.stun ?? 0, enemy.ccDur * (1 - td.derived.tenacity))
      }
    }
    const effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * (mods?.fightTime ?? 0)) * (mods?.dmgMult ?? 1)
    // L'atténuation générique (esquive/réduction/maîtrise + passives/keystones) est BORNÉE
    // dans incomingDps ; le multiplicateur d'exigence du type (v0.24) s'applique avant.
    let incoming = incomingDps(
      effDmg, enemy.damageType, td.derived, td.resist,
      enemyReq(enemy, enemy.damageType),
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
      td.cmods.reqReduction,
    ) * dt
    // Réfléchissant : CAPÉ à 10% des PV max de la cible par seconde — sinon un héros à très gros
    // DPS et petits PV se one-shotait lui-même (400k DPS vs 12k PV…).
    if (mods?.reflect) incoming += Math.min(totalDealt * mods.reflect, charMaxHp(t) * 0.10 * dt)
    // Immunité / bouclier d'absorption du héros (Phase éthérée, Égide titanesque).
    damageHero(t, incoming)
    // ÉGIDE « Aegis adaptatif » : être frappé par un type endurcit contre ce type.
    if (td.cmods.adaptiveResist && incoming > 0) adaptiveAdd(t.id, enemy.damageType, td.cmods.adaptiveResist.gain * dt, td.cmods.adaptiveResist.cap)
    // Épines (thorns) : renvoie une fraction de l'attaque à l'ennemi (basée sur le coup, bouclier inclus).
    if (td.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - incoming * td.cmods.thorns)
  }

  // 4b) Techniques signature de l'ennemi (DoT/burst/CC/debuff/drain) sur la plus haute menace.
  tickEnemyAbilities(enemy, chars, info, dt, mods?.runes?.dilatation ?? 0)

  // 5) Régénération de l'ennemi (Vampirique) — annulée par « Hémorragie cosmique ».
  if (mods?.regen && enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 5b) 🕊️ Sursis : un héros qui vient de tomber survit à 25% PV (une fois par minute chacun).
  const revived = applySursis(chars, mods?.runes?.sursisCd)

  // 6) Régénération des persos (+ bonus de régén + Métaboliseur d'Égide) + clamp.
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      let regen = mh * REGEN_RATE * (1 + d.derived.regenBonus) * regenMult
      // 🛡️ ÉGIDE « Métaboliseur » : le surplus de résist face aux exigences devient du soin/s.
      if (d.cmods.surplusRegen > 0) {
        regen += mh * Math.min(d.cmods.surplusRegen, (resistSurplus(enemy, d.resist) / RESIST_DSCALE) * d.cmods.surplusRegen)
      }
      c.hp = Math.min(mh, c.hp + regen * dt)
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemy, anyAlive: chars.some((c) => c.hp > 0), totalDealt, overkill, revived }
}

/**
 * Pas de combat de l'équipe contre PLUSIEURS ennemis simultanés (donjons en pack, raids avec adds).
 * - Les auto-attaques + capacités mono-cible concentrent le feu sur le 1er ennemi vivant (focus).
 * - Les capacités `cleave` touchent TOUS les ennemis vivants.
 * - CHAQUE ennemi vivant frappe la plus haute menace → un pack met l'équipe sous pression (survie de groupe).
 */
function partyCombatStepMulti(input: Character[], enemiesIn: Enemy[], dt: number, mods?: CombatMods) {
  const enemies: Enemy[] = enemiesIn.map((e) => ({ ...e, dot: e.dot ? { ...e.dot } : undefined, abilities: e.abilities?.map((a) => ({ ...a })) }))
  const chars: Character[] = input.map((c) => ({ ...c, dots: c.dots?.map((d) => ({ ...d })), weaken: c.weaken ? { ...c.weaken } : undefined }))
  // Gemmes de condition : Cœur de Nuée (packs) + Sablier de l'Acharné (âge de la cible focus).
  const aliveAtStart = enemies.filter((e) => e.hp > 0).length
  const nuee = mods?.cond?.nueePer ? nueeMult(aliveAtStart, mods.cond.nueePer) : 1
  for (const e of enemies) if (e.hp > 0) e.age = (e.age ?? 0) + dt
  // 🔁 Boucle temporelle : toutes les N secondes, les recharges de l'équipe tombent à zéro.
  if (mods?.runes?.boucleEvery) {
    boucleAcc += dt
    if (boucleAcc >= mods.runes.boucleEvery) { boucleAcc = 0; resetAllCooldowns(chars) }
  }
  // Œil de l'Opportuniste : bonus tant qu'au moins un ennemi du pack INCANTE (télégraphe).
  const opportunisteMult = mods?.cond?.opportuniste && enemies.some((e) => e.hp > 0 && e.abilities?.some((a) => (a.cast ?? 0) > 0))
    ? 1 + mods.cond.opportuniste
    : 1
  tickHeroStatuses(chars, dt)
  const info = chars.map((c) =>
    c.hp > 0
      ? { derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c), resist: charResist(c), cmods: charCombatMods(c) }
      : null,
  )
  // ÉGIDE : aura partagée + stacks adaptatifs → résistances effectives.
  enrichResists(chars, info)
  let totalDealt = 0
  const focus = (): Enemy | undefined => enemies.find((e) => e.hp > 0)

  // 1) Auto-attaques (+ Multifrappe) sur la cible focus + DoT keystone. Étourdi = pas d'attaque.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    // ⏱️ Premier élan : vitesse d'attaque dopée en début de RENCONTRE (fightTime du donjon/raid).
    const elanRune = mods?.runes?.premierElan && (mods?.fightTime ?? 99) <= (mods.runes.premierElanDur ?? 10) ? 1 + mods.runes.premierElan : 1
    const hits = d.derived.attacksPerSecond * elanRune * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const acharne = mods?.cond?.acharneCap ? acharneMult(focus()?.age ?? 0, mods.cond.acharneCap) : 1
    // 🫁 Second Souffle : sous 30% PV, le héros frappe plus fort.
    const souffle = mods?.cond?.souffle && hpFrac <= 0.3 ? 1 + mods.cond.souffle : 1
    // 🔪 ASSASSIN : fenêtre d'OUVERTURE face à la cible focus (l'âge est par ennemi).
    const opener = d.cmods.opener && (focus()?.age ?? 99) <= d.cmods.opener.seconds ? d.cmods.opener.mult : 1
    // 🜍 PURGATEUR : carburant d'affliction. 🌋 BRISEUR : +dégâts par ennemi vivant.
    const fuel = fuelMult(c.id, d.cmods.afflictionFuel)
    const perEnemy = 1 + d.cmods.perEnemyBonus * Math.max(0, aliveAtStart - 1)
    // 🛡️ ÉGIDE « Gardien du seuil » : surplus de résist face à la cible focus → dégâts.
    const fTarget = focus()
    const surplusMult = d.cmods.surplusToDamage > 0 && fTarget
      ? 1 + Math.min(d.cmods.surplusToDamage, (resistSurplus(fTarget, d.resist) / RESIST_DSCALE) * d.cmods.surplusToDamage)
      : 1
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult * (mods?.heroMult ?? 1) * nuee * acharne * souffle * opportunisteMult * opener * fuel * perEnemy * surplusMult
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    const metroN = mods?.cond?.metronomeN
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole; h++) {
      const target = focus()
      if (!target) break
      // 🎼 Métronome : critique garanti toutes les N attaques auto.
      let forceCrit = false
      if (metroN) {
        const mk = `metronome:${c.id}`
        const n = (gemCounters.get(mk) ?? 0) + 1
        if (n >= metroN) { forceCrit = true; gemCounters.set(mk, 0) } else gemCounters.set(mk, n)
      }
      // ⚡ FOUDREUR « Décharge » : toutes les N attaques, la suivante frappe ×mult.
      let staticMult = 1
      if (d.cmods.staticN) {
        const sk = `static:${c.id}`
        const n = (gemCounters.get(sk) ?? 0) + 1
        if (n >= d.cmods.staticN.every) { staticMult = d.cmods.staticN.mult; gemCounters.set(sk, 0) } else gemCounters.set(sk, n)
      }
      const strikes = 1 + (Math.random() < multistrikeChance ? 1 : 0)
      for (let st = 0; st < strikes; st++) {
        const t2 = focus()
        if (!t2) break
        const hit = rollHit(d.derived, d.profile, t2, { bonusMult, execute: d.cmods.execute, forceCrit: forceCrit && st === 0 })
        const dmg = hit.damage * enemyVuln(t2) * (st === 0 ? staticMult : 1)
        // Étoile d'Overkill : l'excédent du coup fatal déborde sur les ennemis suivants du pack
        // (hors totalDealt → n'alimente pas le Réfléchissant).
        if (mods?.cond?.overkill && dmg > t2.hp) {
          let left = dmg - t2.hp
          t2.hp = 0
          while (left > 0) {
            const nx = focus()
            if (!nx) break
            const absorbed = Math.min(left, nx.hp)
            nx.hp -= absorbed
            left -= absorbed
          }
        }
        t2.hp = Math.max(0, t2.hp - dmg)
        totalDealt += dmg
        dealtThis += dmg
        healed += hit.heal
        if (d.cmods.dot) {
          t2.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
          // 🦠 PESTIFÉRÉ « Pandémie » : la peste s'applique aussi au reste du pack (fraction).
          if (d.cmods.dotAoe > 0) {
            const spread = hit.damage * d.cmods.dot.frac * d.derived.alterationMult * d.cmods.dotAoe
            for (const e of enemies) {
              if (e === t2 || e.hp <= 0) continue
              e.dot = { dps: Math.max(spread, e.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
            }
          }
        }
        // 🌋 BRISEUR « Onde de choc » + ⚡ FOUDREUR « Foudre en chaîne » : éclaboussures sur le pack.
        if ((d.cmods.cleaveAuto > 0 || d.cmods.chainArc) && dmg > 0) {
          let arcLeft = d.cmods.chainArc?.targets ?? 0
          for (const e of enemies) {
            if (e === t2 || e.hp <= 0) continue
            let frac = d.cmods.cleaveAuto
            if (arcLeft > 0 && d.cmods.chainArc) { frac = Math.max(frac, d.cmods.chainArc.frac); arcLeft-- }
            if (frac <= 0) break
            const splash = dmg * frac
            e.hp = Math.max(0, e.hp - splash)
            totalDealt += splash
            dealtThis += splash
          }
        }
      }
    }
    if (c.charge) c.charge.dealt += dealtThis
    if (healed) c.hp = Math.min(charMaxHp(c), c.hp + healed)
  })

  // 2) DoT par ennemi + décompte de ses statuts (vulnérabilité, anti-régén).
  for (const enemy of enemies) {
    if (enemy.dot && enemy.hp > 0) {
      const dmg = enemy.dot.dps * dt
      enemy.hp = Math.max(0, enemy.hp - dmg)
      totalDealt += dmg
      enemy.dot.remaining -= dt
      if (enemy.dot.remaining <= 0) enemy.dot = undefined
      // ☠ FAUCHEUR : les DoT te soignent (fraction du tick).
      chars.forEach((c, i) => {
        const d = info[i]
        if (d && c.hp > 0 && d.cmods.dotLeech > 0) c.hp = Math.min(charMaxHp(c), c.hp + dmg * d.cmods.dotLeech)
      })
    }
    if ((enemy.noRegen ?? 0) > 0) enemy.noRegen = Math.max(0, enemy.noRegen! - dt)
    if (enemy.vuln) { enemy.vuln.remaining -= dt; if (enemy.vuln.remaining <= 0) enemy.vuln = undefined }
  }

  // 3) Actives : `cleave`/AoE touchent TOUS les ennemis, le reste la cible focus. Étourdi = on ne
  //    LANCE pas, mais les RECHARGES continuent de tourner.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const stunned = (c.stun ?? 0) > 0
    c.powers.forEach((pid, slot) => {
      if (!pid) return
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      const key = `${c.id}:${pid}`
      const cd = (cooldowns.get(key) ?? 0) - dt
      const auto = c.powerAuto?.[slot] !== false
      if (cd <= 0 && !stunned && (auto || manualFire.has(key))) {
        // 🩸 Pacte sanglant : recharges raccourcies contre 2% des PV max par lancement.
        const pacte = mods?.cond?.pacteCdr ?? 0
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr) * (1 - pacte))
        if (pacte > 0) c.hp = Math.max(1, c.hp - 0.02 * charMaxHp(c))
        manualFire.delete(key)
        // ⏳ CHRONOMANCIEN « Cascade temporelle » : chaque sort lancé rembourse les autres recharges.
        if (d.cmods.cdrOnCast > 0) {
          for (const pid2 of c.powers) {
            if (!pid2 || pid2 === pid) continue
            const k2 = `${c.id}:${pid2}`
            cooldowns.set(k2, Math.max(0, (cooldowns.get(k2) ?? 0) - d.cmods.cdrOnCast))
          }
        }
        const cast = (mult: number): number => {
          let dd = 0
          const sm = d.cmods.damageMult * d.cmods.spellMult * mult
          if (p.effect === 'cleave' || p.effect === 'megaCleave') {
            for (const e of enemies) if (e.hp > 0) dd += fireActive(p, c, d.derived, d.profile, chars, e, d.cmods.hot, sm, d.cmods.healToDamage)
          } else {
            dd = fireActive(p, c, d.derived, d.profile, chars, focus() ?? enemies[0], d.cmods.hot, sm, d.cmods.healToDamage)
          }
          return dd
        }
        let dealt = cast(1)
        // 🔔 Pierre d'Écho : tous les N sorts de l'équipe, le suivant résonne une 2e fois (50%).
        const echoN = mods?.cond?.echoN
        if (echoN) {
          const n = (gemCounters.get('echo') ?? 0) + 1
          if (n >= echoN) { gemCounters.set('echo', 0); dealt += cast(0.5) } else gemCounters.set('echo', n)
        }
        if (c.charge && dealt > 0) c.charge.dealt += dealt
      } else {
        cooldowns.set(key, Math.max(0, cd))
        if (!auto && !stunned) manualFire.delete(key)
      }
    })
  })

  // 3b) Vengeance différée : la fenêtre expirée, déchaîne ×mult TOUT le cumul, sur la cible focus.
  for (const c of chars) {
    if (!c.charge || c.charge.remaining > 0) continue
    const tg = focus()
    if (c.hp > 0 && tg && c.charge.dealt > 0) {
      const burst = c.charge.dealt * c.charge.mult * enemyVuln(tg)
      tg.hp = Math.max(0, tg.hp - burst)
      totalDealt += burst
    }
    c.charge = undefined
  }

  // 4) Chaque ennemi vivant frappe la plus haute menace (l'équipe doit survivre au pack).
  let reflectApplied = false
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue
    const liveNow = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
    if (!liveNow.length) break
    let targetI = liveNow[0]
    let best = -1
    for (const i of liveNow) {
      const d = info[i]!
      const dps = d.derived.power * d.derived.attacksPerSecond
      const score = (dps + 1) * d.passives.threatMult
      if (score > best) { best = score; targetI = i }
    }
    const t = chars[targetI]
    const td = info[targetI]!
    // Étourdissement (boss) réduit par la Ténacité de la cible.
    if (enemy.ccDur) {
      enemy.ccCd = (enemy.ccCd ?? 0) - dt
      if (enemy.ccCd <= 0) {
        enemy.ccCd = CC_INTERVAL
        t.stun = Math.max(t.stun ?? 0, enemy.ccDur * (1 - td.derived.tenacity))
      }
    }
    const effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * (mods?.fightTime ?? 0)) * (mods?.dmgMult ?? 1)
    let incoming = incomingDps(
      effDmg, enemy.damageType, td.derived, td.resist,
      enemyReq(enemy, enemy.damageType),
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
      td.cmods.reqReduction,
    ) * dt
    // Même cap que le combat mono-cible : le renvoi ne dépasse jamais 10% des PV max/s.
    if (mods?.reflect && !reflectApplied) { incoming += Math.min(totalDealt * mods.reflect, charMaxHp(t) * 0.10 * dt); reflectApplied = true }
    // Immunité / bouclier d'absorption du héros (Phase éthérée, Égide titanesque).
    damageHero(t, incoming)
    // ÉGIDE « Aegis adaptatif » : être frappé par un type endurcit contre ce type.
    if (td.cmods.adaptiveResist && incoming > 0) adaptiveAdd(t.id, enemy.damageType, td.cmods.adaptiveResist.gain * dt, td.cmods.adaptiveResist.cap)
    if (td.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - incoming * td.cmods.thorns)
    // Techniques signature de CET ennemi (sur la plus haute menace).
    tickEnemyAbilities(enemy, chars, info, dt, mods?.runes?.dilatation ?? 0)
  }

  // 5) Régénération ennemie (Vampirique/Sangsue) — annulée par « Hémorragie cosmique ».
  if (mods?.regen) for (const enemy of enemies) if (enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 5b) 🕊️ Sursis : un héros qui vient de tomber survit à 25% PV (une fois par minute chacun).
  const revived = applySursis(chars, mods?.runes?.sursisCd)

  // 6) Régénération des persos (+ Métaboliseur d'Égide face à la cible focus) + clamp.
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      let regen = mh * REGEN_RATE * (1 + d.derived.regenBonus) * regenMult
      const ft = focus()
      if (d.cmods.surplusRegen > 0 && ft) {
        regen += mh * Math.min(d.cmods.surplusRegen, (resistSurplus(ft, d.resist) / RESIST_DSCALE) * d.cmods.surplusRegen)
      }
      c.hp = Math.min(mh, c.hp + regen * dt)
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemies, anyAlive: chars.some((c) => c.hp > 0), totalDealt, revived }
}

function tickDungeon(s: GameState, dt: number, set: (s: GameState) => void) {
  const d = s.dungeon!
  const def = getDungeonDef(d.dungeonId)
  const fightTime = d.fightTime + dt
  let enrage = 0
  let reflect = 0
  let regen = dungeonRegen(d.trait) // identité 'regen' : les ennemis se régénèrent (→ il faut du burst)
  for (const m of d.modifiers) {
    if (m.enrageRampPerSec) enrage += m.enrageRampPerSec
    if (m.reflectPct) reflect += m.reflectPct
    if (m.regenPct) regen += m.regenPct
  }

  const dCraft = craftMods(s.metiers)
  const dCond = condGemMods(s.characters, dCraft.gemFamilyBonus)
  const dRunes = timeRuneMods(equippedTimeRunes(s.characters), dCraft.runisteTempo)
  const dHeroMult = (1 + maitriseBonus(s.biomeBest)) * (1 + crescendoBonus(dCond.crescendoCap))
  const res = partyCombatStepMulti(s.characters, d.enemies, dt, { enrage, reflect, regen, fightTime, heroMult: dHeroMult, cond: dCond, runes: dRunes })
  let chars = res.chars
  const enemies = res.enemies
  let log = s.log
  for (const n of res.revived ?? []) log = pushLog(log, `🕊️ Sursis : ${n} survit in extremis !`, 'info')

  if (!res.anyAlive) {
    crescendoReset() // 📯 Crescendo : l'équipe tombe, le cumul retombe
    const healed = chars.map(fullHeal)
    log = pushLog(log, `💀 Échec dans ${d.name} ! L'équipe bat en retraite.`, 'death')
    const next = { ...s, characters: healed, dungeon: null, log }
    persist(next)
    set(next)
    return
  }

  if (enemies.every((e) => e.hp <= 0)) {
    // 📯 Crescendo & 🛡️ Trésorerie : chaque combat de pack nettoyé compte ses kills.
    crescendoAdd(enemies.length)
    tresorerieShield(chars, dCond.tresorerieCap)
    const eco = computeGlobalMods(s.upgrades)
    const lv = d.level
    const packXp = enemies.reduce((a, e) => a + (e.xp ?? 0), 0)
    const noGold = d.modifiers.some((m) => m.noGold)

    // --- Récompense PAR COMBAT (chaque combat gagné crédite la ressource du donjon, tout de suite) ---
    let gold = s.gold, essence = s.essence, noyau = s.noyau, poussiere = s.poussiere, sceaux = s.sceaux, orbes = s.orbes, gemDust = s.gemDust
    const earned: Record<string, number> = { ...(d.earned ?? {}) }
    // Accumulateur fractionnaire (ressources rares) → crédite les UNITÉS ENTIÈRES gagnées ce combat.
    const accrue = (key: string, amt: number): number => {
      const prev = earned[key] ?? 0
      earned[key] = prev + amt
      return Math.floor(earned[key]) - Math.floor(prev)
    }
    const fightItems: Item[] = []
    let logBit = ''
    let leveled = false
    // Rendement par combat = part PERFIGHT du rendement total mappé sur les coûts (voir dungeons.ts).
    const perFight = (r: 'gold' | 'eclats' | 'noyau' | 'poussiere') => dungeonRunYield(r, lv) * DUNGEON_YIELD_PERFIGHT_FRAC / Math.max(1, d.totalFights)
    switch (def.reward) {
      case 'gold': { if (!noGold) { const g = Math.round(perFight('gold') * eco.goldGain); gold += g; logBit = `+${g.toLocaleString('fr-FR')} or` } break }
      case 'eclats': { const e2 = Math.round(perFight('eclats')); essence += e2; logBit = `+${e2.toLocaleString('fr-FR')} éclats` } break
      case 'noyau': { const n = accrue('noyau', perFight('noyau')); if (n) { noyau += n; logBit = `+${n} 💠` } } break
      case 'poussiere': { const pq = accrue('poussiere', perFight('poussiere')); if (pq) { poussiere += pq; logBit = `+${pq} 🌌` } } break
      // Clés : mêmes règles que les autres ressources (40% au fil des combats, 60% au coffre) —
      // fini le fil exponentiel indexé sur l'XP du pack qui rendait le coffre ridicule.
      case 'sceaux': { const sc = accrue('sceaux', dungeonKeyYield('sceaux', lv) * DUNGEON_YIELD_PERFIGHT_FRAC / Math.max(1, d.totalFights)); if (sc) { sceaux += sc; logBit = `+${sc} 🔑` } } break
      case 'orbes': { const ob = accrue('orbes', dungeonKeyYield('orbes', lv) * DUNGEON_YIELD_PERFIGHT_FRAC / Math.max(1, d.totalFights)); if (ob) { orbes += ob; logBit = `+${ob} 🔮` } } break
      case 'xp': {
        const xp = Math.round(packXp * DUNGEON_FIGHT_XP_MULT * eco.xpGain)
        chars = chars.map((c) => { if (c.hp <= 0) return c; const nc = grantXp(c, xp); if (nc.level > c.level) leveled = true; return nc })
        earned.xp = (earned.xp ?? 0) + xp
        logBit = `+${xp.toLocaleString('fr-FR')} XP`
        break
      }
      // Cache du Pilleur, drops PAR COMBAT : même fenêtre que le coffre (pic ≤ Légendaire, plafond Artefact).
      case 'stuff': { if (Math.random() < 0.4) { const cw = cacheRarityWindow(lv); fightItems.push(generateItem({ ilvl: dungeonIlvl(lv, s.bestStage), rarity: rollWindowRarity(cw.floor, cw.peak, cw.cap), primaryBias: pickBias(s.characters) })); logBit = '+1 objet' } break }
      // La Géode : la poussière 🔹 coule à chaque combat (la gemme, elle, attend le coffre).
      case 'gemmes': { const gd = accrue('gemDust', geodeDustYield(lv) * DUNGEON_YIELD_PERFIGHT_FRAC / Math.max(1, d.totalFights)); if (gd) { gemDust += gd; logBit = `+${gd} 🔹` } } break
    }
    log = pushLog(log, `⚔️ ${def.icon} Combat ${d.current + 1}/${d.totalFights}${logBit ? ` · ${logBit}` : ''}.`, 'kill')
    if (leveled) log = pushLog(log, '⬆ Niveau gagné !', 'level')

    let inventory = s.inventory
    for (const it of fightItems) inventory = [it, ...inventory].slice(0, invMax)
    const codex = fightItems.length ? discoverFromItems(s.codex, fightItems) : s.codex

    const nextIndex = d.current + 1
    if (nextIndex >= d.totalFights) {
      // 🏆 Fragment de Conquête : le boss final du donjon réinitialise les plus longues recharges.
      if (dCond.conquete) resetLongestCooldown(chars)
      fuelReset() // 🜍 Purgateur : fin d'instance, le carburant retombe
      const rareBonus = d.modifiers.reduce((a, m) => a + (m.rareBonus ?? 0), 0)
      const bias = pickBias(s.characters)

      // --- Coffre : BONUS de fin (montant ÉLEVÉ) de la ressource du donjon, EN PLUS du par-combat ---
      let items: Item[] = []
      let cGold = 0, cEclats = 0, cNoyau = 0, cPous = 0, cSceaux = 0, cOrbes = 0, cXp = earned.xp ?? 0
      let cDust = 0
      let cGem: { id: CondGemId; rank: number } | undefined
      const chestFrac = 1 - DUNGEON_YIELD_PERFIGHT_FRAC // 60% du rendement mappé tombe dans le coffre
      switch (def.reward) {
        case 'gold': cGold = noGold ? 0 : Math.round(dungeonRunYield('gold', lv) * chestFrac * eco.goldGain); break
        case 'eclats': cEclats = Math.round(dungeonRunYield('eclats', lv) * chestFrac); break
        case 'noyau': cNoyau = Math.round(dungeonRunYield('noyau', lv) * chestFrac); break
        case 'poussiere': cPous = Math.round(dungeonRunYield('poussiere', lv) * chestFrac); break
        case 'orbes': cOrbes = Math.round(dungeonKeyYield('orbes', lv) * chestFrac); break
        case 'sceaux': cSceaux = Math.round(dungeonKeyYield('sceaux', lv) * chestFrac); break
        case 'xp': { const bonus = Math.round(1200 * lv * Math.pow(1.12, lv)); chars = chars.map((c) => (c.hp > 0 ? grantXp(c, bonus) : c)); cXp += bonus; break }
        case 'stuff': {
          const ilvl = dungeonIlvl(lv, s.bestStage)
          const count = 3 + Math.floor(lv / 2)
          // v0.24 : FENÊTRE de la Cache (pic ≤ Légendaire, plafond pratique Artefact — même
          // « Avare » ne le perce pas). Au-dessus, seul le « voile » (infime, → Éternel max).
          const cw = cacheRarityWindow(lv)
          for (let i = 0; i < count; i++) {
            const rarity = Math.random() < butinOverChance(lv)
              ? (RARITY_LIST.find((r) => r.tier === butinOverTier())?.id ?? 'patrimoine')
              : rollWindowRarity(
                  Math.min(BUTIN_RARITY_CAP, cw.floor + rareBonus),
                  Math.min(BUTIN_RARITY_CAP, cw.peak + rareBonus),
                  Math.min(BUTIN_RARITY_CAP, cw.cap + rareBonus),
                )
            items.push(generateItem({ ilvl, rarity, primaryBias: bias }))
          }
          break
        }
        // La Géode : gros paquet de poussière 🔹 + chance d'une GEMME de l'aile choisie (pré-recoupée
        // aux hauts niveaux). C'est la seule source de gemme « semi-ciblée » du jeu.
        case 'gemmes': {
          cDust = Math.round(geodeDustYield(lv) * chestFrac)
          if (Math.random() < geodeGemChance(lv)) {
            const g = rollCondGem(d.wing)
            cGem = { id: g.id, rank: Math.min(gemMaxRank(g), geodeGemRank(lv)) }
          }
          break
        }
      }
      const chest: ChestReward = { dungeonName: d.name, level: lv, items, eclats: cEclats, noyau: cNoyau, gold: cGold, sceaux: cSceaux, orbes: cOrbes, poussiere: cPous, xp: cXp, gemDust: cDust, gem: cGem }

      // 🪄 Rune (v0.25) : drop TRÈS rare en fin de run — la vraie source est le raid.
      let runesOwned = s.runesOwned
      if (Math.random() < dungeonRuneChance(lv)) {
        const rd = rollRuneDrop()
        runesOwned = { ...runesOwned, [rd.id]: (runesOwned[rd.id] ?? 0) + 1 }
        log = pushLog(log, `🪄 RUNE TROUVÉE : ${rd.icon} ${rd.name} !`, 'loot')
      }

      const healed: Character[] = chars.map(fullHeal)
      const dungeonProgress = { ...s.dungeonProgress, [d.dungeonId]: Math.max(s.dungeonProgress[d.dungeonId] ?? 0, lv) }
      const repeatLeft = d.repeatLeft ?? 0
      // État avec les pools PAR COMBAT déjà crédités (le coffre est un bonus en plus).
      const base = { ...s, gold, essence, noyau, poussiere, sceaux, orbes, gemDust, inventory, codex, runesOwned }

      // Auto-farm : on encaisse le coffre directement (sans modal) et on relance.
      if (repeatLeft > 0) {
        const credited = applyChestRewards(base, chest)
        if (credited.sceaux >= def.sceauCost) {
          const ndun = generateDungeon(d.dungeonId, lv, d.wing)
          ndun.repeatLeft = repeatLeft - 1
          const log3 = pushLog(log, `🔁 Auto-farm : run encaissé · ${repeatLeft} relance${repeatLeft > 1 ? 's' : ''} restante${repeatLeft > 1 ? 's' : ''}.`, 'info')
          const next = { ...base, ...credited, characters: healed, dungeonProgress, sceaux: credited.sceaux - def.sceauCost, dungeon: ndun, log: log3 }
          persist(next)
          set(next)
          return
        }
      }

      const log2 = pushLog(log, `🎉 ${d.name} vaincu ! Un coffre t'attend (bonus de fin).`, 'kill')
      const next = { ...base, characters: healed, dungeon: null, dungeonProgress, pendingChest: chest, log: log2 }
      persist(next)
      set(next)
      return
    }

    // Avance au combat suivant (pools par-combat crédités + accumulateur conservé).
    const nd: ActiveDungeon = {
      ...d,
      current: nextIndex,
      enemies: makeDungeonPack(def, d.level, nextIndex, d.totalFights, d.modifiers),
      fightTime: 0,
      earned,
    }
    const next = { ...s, characters: chars, gold, essence, noyau, poussiere, sceaux, orbes, gemDust, inventory, codex, dungeon: nd, log }
    persist(next)
    set(next)
    return
  }

  set({ ...s, characters: chars, dungeon: { ...d, enemies, fightTime }, log })
}

/** Dégâts de zone (Nova/adds) sur l'équipe, typés : multiplicateur d'exigence par perso. */
function applyAoe(chars: Character[], baseDmg: number, type: DamageType, req = 0): Character[] {
  return chars.map((c) => {
    if (c.hp <= 0) return c
    const d = charDerived(c)
    const p = charPassives(c)
    const cm = charCombatMods(c)
    const resist = charResist(c)[type] ?? 0
    // Même plafond d'atténuation que les coups normaux (pas d'invincibilité face aux Novas).
    const dmg = baseDmg * resistMult(req, resist) * genericMitigation(d, (1 - p.damageReduction) * (1 - cm.flatDr))
    if ((c.invuln ?? 0) > 0) return c // Phase éthérée : immunité totale
    let amt = dmg
    let absorb = c.absorb
    if (absorb && absorb > 0) { const soak = Math.min(absorb, amt); absorb -= soak; amt -= soak }
    return { ...c, hp: Math.max(0, c.hp - amt), absorb: absorb && absorb > 0 ? absorb : undefined }
  })
}

function tickRaid(s: GameState, dt: number, set: (s: GameState) => void) {
  const r = s.raid!
  const def = getRaidDef(r.raidId)
  const mech = r.mechanics
  const fightTime = r.fightTime + dt

  // --- Mécaniques de pression continue ---
  const drain = mech.includes('leech') ? 0.028 : 0 // Sangsue : le boss se régénère (check de burst)
  const enrage = 0.012 // léger durcissement pour éviter les combats interminables
  // Enrage DUR : passé le délai, les dégâts explosent (check de DPS).
  const overtime = Math.max(0, fightTime - r.berserkAt)
  let dmgMult = 1
  if (mech.includes('berserk') && overtime > 0) dmgMult *= 1 + overtime * 0.6
  // Acharnement : le boss frappe plus fort à mesure qu'il agonise (premier boss VIVANT — duo de l'Abîme).
  const bossIn = r.enemies.find((e) => e.boss && e.hp > 0) ?? r.enemies[0]
  if (mech.includes('execute')) dmgMult *= 1 + (1 - bossIn.hp / Math.max(1, bossIn.maxHp)) * 0.7

  const rCraft = craftMods(s.metiers)
  const rCond = condGemMods(s.characters, rCraft.gemFamilyBonus)
  const rRunes = timeRuneMods(equippedTimeRunes(s.characters), rCraft.runisteTempo)
  const rHeroMult = (1 + maitriseBonus(s.biomeBest)) * (1 + crescendoBonus(rCond.crescendoCap))
  const res = partyCombatStepMulti(s.characters, r.enemies, dt, { enrage, regen: drain, fightTime, dmgMult, heroMult: rHeroMult, cond: rCond, runes: rRunes })
  let chars = res.chars
  let enemies = res.enemies
  const aliveBosses = enemies.filter((e) => e.boss && e.hp > 0)
  const boss = aliveBosses[0] ?? enemies[0]
  let log = s.log
  for (const n of res.revived ?? []) log = pushLog(log, `🕊️ Sursis : ${n} survit in extremis !`, 'info')

  // Duo de l'Abîme : quand l'un des jumeaux tombe, le survivant entre en FURIE (+50% dégâts).
  if (aliveBosses.length === 1 && !aliveBosses[0].enraged && enemies.some((e) => e.boss && e.hp <= 0)) {
    aliveBosses[0].enraged = true
    aliveBosses[0].damage = Math.round(aliveBosses[0].damage * PAIR_ENRAGE_MULT)
    log = pushLog(log, `💢 FURIE DU SURVIVANT : ${aliveBosses[0].name} s'embrase (+50% dégâts) !`, 'death')
  }
  let novaCd = r.novaCd - dt
  let swarmCd = r.swarmCd - dt
  let rotateCd = r.rotateCd - dt
  let element = r.element
  let rotateIdx = r.rotateIdx

  // Prisme : le boss change de type d'attaque (check de résistances larges).
  if (mech.includes('rotate') && rotateCd <= 0 && r.rotateList.length > 1) {
    rotateCd = 7
    rotateIdx = (rotateIdx + 1) % r.rotateList.length
    element = r.rotateList[rotateIdx]
    for (const b of aliveBosses) b.damageType = element
    log = pushLog(log, `🌈 ${boss.name} bascule en ${DAMAGE_TYPES[element].name} !`, 'info')
  }
  // Nova cataclysmique : grosse AoE typée (check d'EHP/mitigation). NOVA_MULT plat : la difficulté
  // du raid est DÉJÀ dans boss.damage (avant, ×4×baseDifficulty la comptait deux fois).
  if (mech.includes('nova') && novaCd <= 0) {
    novaCd = 6
    chars = applyAoe(chars, boss.damage * NOVA_MULT, element, enemyReq(boss, element))
    log = pushLog(log, `☄️ ${boss.name} déchaîne une Nova ${DAMAGE_TYPES[element].name} !`, 'death')
  }
  // Déferlante : fait SURGIR des renforts réels (combat à plusieurs adversaires), plafonnés.
  if (mech.includes('swarm') && swarmCd <= 0) {
    swarmCd = 5
    const liveAdds = enemies.filter((e) => e.add && e.hp > 0).length
    const toSpawn = Math.max(0, Math.min(2, 3 - liveAdds))
    // uid stable (1001+ pour ne JAMAIS percuter l'index des boss en [0]/[1]) + numérotation :
    // sans ça, la liste keyée par index faisait « sauter » les barres quand un rejeton expirait.
    const ADD_TAGS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ']
    let uid = enemies.reduce((m, e) => Math.max(m, e.uid ?? 0), 1000)
    for (let k = 0; k < toSpawn; k++) {
      const add = makeRaidAdd(def, r.tier, element)
      add.uid = ++uid
      add.name = `${add.name} ${ADD_TAGS[(uid - 1001) % ADD_TAGS.length]}`
      enemies.push(add)
    }
    if (toSpawn > 0) log = pushLog(log, `🐛 ${toSpawn} renfort(s) surgissent !`, 'death')
  }

  // Renforts : décompte de durée de vie + nettoyage (le boss en [0] est toujours conservé).
  enemies = enemies.filter((e, idx) => {
    if (idx === 0) return true
    if (e.hp <= 0) return false
    if (e.lifetime != null) { e.lifetime -= dt; if (e.lifetime <= 0) return false }
    return true
  })

  if (!chars.some((c) => c.hp > 0)) {
    crescendoReset() // 📯 Crescendo : l'équipe tombe, le cumul retombe
    const healed = chars.map(fullHeal)
    const why = mech.includes('berserk') && overtime > 0 ? ' (enrage mortel — il fallait plus de DPS)' : ''
    log = pushLog(log, `💀 Raid échoué : ${r.name}${why}. L'équipe est anéantie.`, 'death')
    const next = { ...s, characters: healed, raid: null, log }
    persist(next)
    set(next)
    return
  }

  if (boss.hp <= 0) {
    // 🏆 Fragment de Conquête : chaque rencontre de boss vaincue réinitialise les longues recharges.
    if (rCond.conquete) resetLongestCooldown(chars)
    fuelReset() // 🜍 Purgateur : fin d'instance, le carburant retombe
    // 📯 Crescendo & 🛡️ Trésorerie : un boss de raid compte comme un kill.
    crescendoAdd(1)
    tresorerieShield(chars, rCond.tresorerieCap)
    // v0.23 : un raid = UN affrontement → le boss (ou duo) vaincu, le trésor tombe directement.
    {
      const tier = r.tier
      const ilvl = raidIlvl(def, tier)
      // v0.24 : fenêtre à pic par tier (DESIGN §4.3) — pic « banal », traîne très rare vers le haut.
      const w = raidRarityWindow(def, tier)
      const count = rollRaidLootCount(def, tier)
      const bias = pickBias(s.characters)
      const items: Item[] = []
      for (let i = 0; i < count; i++) {
        const rarity = rollWindowRarity(w.floor, w.peak, w.cap)
        // L'Abîme : ~30% des objets sont des pièces de la RÉGALIA DU NÉANT (set exclusif).
        if (def.id === 'abysse' && Math.random() < 0.3) {
          const sd = SETS.neant
          const types = Object.keys(sd.pieces) as ItemType[]
          const t = types[Math.floor(Math.random() * types.length)]
          const it = generateItem({ ilvl, rarity, type: t, primaryBias: bias, ...(t === 'armePrincipale' ? { element: 'ombre' as DamageType } : {}) })
          it.setId = sd.id
          it.name = sd.pieces[t]!
          items.push(it)
          continue
        }
        const lootType = pickRaidLootType(def)
        items.push(generateItem({
          ilvl, rarity, type: lootType, primaryBias: bias,
          ...(def.id === 'nexus' ? { biasResist: DAMAGE_TYPE_LIST[Math.floor(Math.random() * DAMAGE_TYPE_LIST.length)] } : {}),
        }))
      }
      const cosmic = Math.random() < raidCosmicChance(def, tier) ? raidCosmicQty(def, tier) : 0
      const chest: ChestReward = {
        dungeonName: `${def.icon} ${def.name} · Tier ${tier}`,
        level: tier,
        items,
        eclats: Math.round(200 * tier * def.baseDifficulty),
        noyau: 3 + tier,
        gold: Math.round(400 * tier * def.baseDifficulty),
        sceaux: 1,
        fragments: raidFragments(def, tier),
        poussiere: Math.floor(tier / 2),
        cosmic,
      }
      const healed = chars.map(fullHeal)
      const raidProgress = { ...s.raidProgress, [r.raidId]: Math.max(s.raidProgress[r.raidId] ?? 0, tier) }
      // 🏆 Trophées du raid : la monnaie de passage de tier (≈ 5 clears du tier courant).
      const trophies = raidTrophyGain(tier)
      const raidTrophies = { ...s.raidTrophies, [r.raidId]: (s.raidTrophies[r.raidId] ?? 0) + trophies }
      log = pushLog(log, `🏆 +${trophies} Trophée${trophies > 1 ? 's' : ''} de ${def.name} (total ${raidTrophies[r.raidId]}).`, 'loot')
      const repeatLeft = r.repeatLeft ?? 0

      // Gemme de CONDITION (25% par raid vaincu) — l'autre source est le champion ✦ de farm.
      let gems = s.gems
      if (Math.random() < 0.25) {
        const cg = rollCondGem()
        gems = { ...gems, [condGemKey(cg.id)]: (gems[condGemKey(cg.id)] ?? 0) + 1 }
        log = pushLog(log, `${cg.icon} GEMME DE CONDITION : ${cg.name} !`, 'loot')
      }

      // 🪄 Rune (v0.25) : LE raid est la source des runes — chance qui monte avec le tier.
      let runesOwned = s.runesOwned
      if (Math.random() < raidRuneChance(tier)) {
        const rd = rollRuneDrop()
        runesOwned = { ...runesOwned, [rd.id]: (runesOwned[rd.id] ?? 0) + 1 }
        log = pushLog(log, `🪄 RUNE TROUVÉE : ${rd.icon} ${rd.name} !`, 'loot')
      }

      // Auto-raid : s'il reste des relances ET assez d'Orbes, on encaisse le trésor et on relance.
      if (repeatLeft > 0) {
        const credited = applyChestRewards(s, chest)
        if (credited.orbes >= def.orbeCost) {
          const nr = generateRaid(r.raidId, tier)
          nr.repeatLeft = repeatLeft - 1
          const log3 = pushLog(log, `🔁 Auto-raid : trésor encaissé${cosmic ? ` (💫 ×${cosmic})` : ''} · ${repeatLeft} relance${repeatLeft > 1 ? 's' : ''} restante${repeatLeft > 1 ? 's' : ''}.`, 'kill')
          const next = { ...s, ...credited, gems, runesOwned, characters: healed, raidProgress, raidTrophies, orbes: credited.orbes - def.orbeCost, raid: nr, log: log3 }
          persist(next)
          set(next)
          return
        }
      }

      log = pushLog(log, `🏆 RAID VAINCU : ${def.name} (Tier ${tier}) !${cosmic ? ` 💫 Éclat cosmique ×${cosmic} !` : ''} Un trésor t'attend.`, 'kill')
      const next = { ...s, gems, runesOwned, characters: healed, raid: null, raidProgress, raidTrophies, pendingChest: chest, log }
      persist(next)
      set(next)
      return
    }
  }

  set({ ...s, characters: chars, raid: { ...r, enemies, fightTime, novaCd, swarmCd, rotateCd, element, rotateIdx }, log })
}

/** Deltas d'état d'un coffre (ressources + inventaire + codex). XP exclue (déjà créditée par combat). */
function applyChestRewards(s: GameState, c: ChestReward): Pick<GameState, 'inventory' | 'codex' | 'essence' | 'noyau' | 'poussiere' | 'cosmic' | 'gold' | 'sceaux' | 'orbes' | 'fragments' | 'gemDust' | 'gems'> {
  let inventory = s.inventory
  for (const it of c.items) inventory = [it, ...inventory].slice(0, invMax)
  let gems = s.gems
  if (c.gem) {
    const k = condGemKey(c.gem.id, c.gem.rank)
    gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
  }
  return {
    inventory,
    codex: discoverFromItems(s.codex, c.items),
    essence: s.essence + c.eclats,
    noyau: s.noyau + c.noyau,
    poussiere: s.poussiere + (c.poussiere ?? 0),
    cosmic: s.cosmic + (c.cosmic ?? 0),
    gold: s.gold + c.gold,
    sceaux: s.sceaux + c.sceaux,
    orbes: s.orbes + (c.orbes ?? 0),
    fragments: s.fragments + (c.fragments ?? 0),
    gemDust: s.gemDust + (c.gemDust ?? 0),
    gems,
  }
}

export const useGame = create<GameState>((set, get) => {
  const save = loadSave()
  refreshGlobals(save.upgrades)

  // Progression hors-ligne : applique les gains accumulés depuis la dernière sauvegarde.
  let pendingOffline: OfflineReport | null = null
  const elapsed = Date.now() - (save.lastSeen ?? Date.now())
  if (elapsed > 0) {
    const report = simulateOffline(save.characters, save.stage, save.upgrades, elapsed, save.activeBiome)
    if (report) {
      pendingOffline = report
      save.gold += report.gold
      save.noyau += report.noyau
      save.sceaux += report.sceaux
      if (report.quint) save.quint = addQuint(save.quint, { [report.quint.type]: report.quint.amount })
      save.characters = save.characters.map((c) => (c.hp > 0 ? grantXp(c, report.xp) : c))
      for (const it of report.items) save.inventory = [it, ...save.inventory].slice(0, invMax)
    }
  }

  // Automates de forge HORS-LIGNE : même moteur que le tick, avec un grand dt (plafonné 12 h,
  // plein régime — ce sont des machines). Les clés sont consommées run par run.
  const autoLogLines: string[] = []
  if (elapsed > 60_000 && save.automates.length > 0) {
    const ar = tickAutomates(save, Math.min(elapsed, 12 * 3600 * 1000) / 1000, equippedRules(save.characters).has('econome') ? (craftMods(save.metiers).loiAmplifiee ? 0.25 : 0.15) : 0, craftMods(save.metiers).automateDurMult)
    if (ar) {
      Object.assign(save, ar.eco)
      if (ar.xpEach > 0) save.characters = save.characters.map((c) => (c.hp > 0 ? grantXp(c, ar.xpEach) : c))
      autoLogLines.push(...ar.lines.map((l) => `(hors-ligne) ${l}`))
    }
  }

  return {
    ...save,
    enemy: makeEnemy(save.stage, save.activeBiome),
    log: [
      ...autoLogLines.map((text) => ({ id: logId++, text, kind: 'craft' as LogKind })),
      { id: logId++, text: 'Bienvenue, guerrier. Le combat commence.', kind: 'info' as LogKind },
    ],
    killCount: 0,
    pendingOffline,

    tick: (dt) => {
      let s = get()

      // Automates de forge : avancent en PARALLÈLE de tout le reste (farm, donjon, raid).
      const ar = tickAutomates(s, dt, equippedRules(s.characters).has('econome') ? (craftMods(s.metiers).loiAmplifiee ? 0.25 : 0.15) : 0, craftMods(s.metiers).automateDurMult)
      if (ar) {
        let log = s.log
        for (const line of ar.lines) log = pushLog(log, line, 'craft')
        let characters = s.characters
        if (ar.xpEach > 0) characters = characters.map((c) => (c.hp > 0 ? grantXp(c, ar.xpEach) : c))
        s = { ...s, ...ar.eco, characters, log }
        if (ar.completed) persist(s)
      }

      if (s.raid) {
        tickRaid(s, dt, set)
        return
      }
      if (s.dungeon) {
        tickDungeon(s, dt, set)
        return
      }

      // Bonus de biome : Maîtrise des Zones partout + gemme d'ENVIRONNEMENT (🌩️ Orage en
      // Surcharge) et 📯 Crescendo. (v0.25 : Élan du voyageur et gemme Nomade supprimés.)
      const cmodsTick = craftMods(s.metiers)
      const cond = condGemMods(s.characters, cmodsTick.gemFamilyBonus)
      const runes = timeRuneMods(equippedTimeRunes(s.characters), cmodsTick.runisteTempo)
      const surgedNow = surgeBiome() === s.activeBiome
      const heroMult = (1 + maitriseBonus(s.biomeBest))
        * (1 + crescendoBonus(cond.crescendoCap))
        * (surgedNow && cond.orage ? 1 + cond.orage : 1)
      const res = partyCombatStep(s.characters, s.enemy, dt, { heroMult, cond, runes })
      let chars = res.chars
      const enemy = res.enemy
      let log = s.log
      for (const n of res.revived ?? []) log = pushLog(log, `🕊️ Sursis : ${n} survit in extremis !`, 'info')

      if (!res.anyAlive) {
        crescendoReset() // 📯 Crescendo : l'équipe tombe, le cumul retombe
        const stage = Math.max(1, s.stage - RETREAT_STAGES)
        const healed = chars.map(fullHeal)
        log = pushLog(log, `💀 Équipe vaincue ! Repli au palier ${stage}.`, 'death')
        const next = { ...s, characters: healed, stage, enemy: makeEnemy(stage, s.activeBiome), log }
        persist(next)
        set(next)
        return
      }

      if (enemy.hp <= 0) {
        let { stage, bestStage, gold, sceaux, inventory, poussiere, essence } = s
        const boss = isBossStage(stage)
        // ⛑️ Résurrection au palier : un héros tombé (raid abandonné, mort isolée…) se relève à
        // chaque palier RÉSOLU (gagné ici ; perdu = repli plus haut). La mort n'a aucun coût.
        chars = chars.map((c) => (c.hp <= 0 ? fullHeal(c) : c))
        // 📯 Crescendo & 🛡️ Trésorerie : chaque kill nourrit le cumul / blinde le bouclier.
        crescendoAdd(1)
        tresorerieShield(chars, cond.tresorerieCap)
        const eco = computeGlobalMods(s.upgrades)
        // SURCHARGE élémentaire : le biome tournant rapporte +50% or/XP et ×2 quintessence.
        const surged = surgeBiome() === s.activeBiome
        const surgeMult = surged ? SURGE_GOLD_XP_MULT : 1
        // Le combat CLASSIQUE n'est plus qu'un filet d'or/butin : la vraie source = donjons & raids.
        const goldGain = Math.round(enemy.xp * CLASSIC_GOLD_MULT * eco.goldGain * surgeMult)
        const xpGain = Math.round(enemy.xp * eco.xpGain * CLASSIC_XP_MULT * surgeMult)
        gold += goldGain

        chars = chars.map((c) => {
          if (c.hp <= 0) return c
          const nc = grantXp(c, xpGain)
          if (nc.level > c.level) log = pushLog(log, `⬆ ${nc.name} niveau ${nc.level} !`, 'level')
          return nc
        })
        log = pushLog(log, `${s.enemy.name} vaincu ! +${xpGain} XP, +${goldGain} or.`, 'kill')

        // v0.18 : les ressources rares (Noyaux 💠, Orbes 🔮, Poussière 🌌) ne tombent PLUS sur les
        // boss/élites de farm — elles se farment en DONJON dédié (mono-ressource). Le farm classique
        // reste une source de stuff, d'XP et d'un filet d'or.
        const elite = enemy.elite === true
        const champion = enemy.champion === true
        if (champion) log = pushLog(log, '✦ CHAMPION vaincu : butin exceptionnel !', 'kill')
        else if (elite) log = pushLog(log, '◆ Élite vaincue : butin supérieur !', 'kill')
        // Runes de RÈGLE portées par l'équipe (Karma, Transmutation brute…). ◈ Législateur les amplifie.
        const rules = equippedRules(s.characters)
        const loi = cmodsTick.loiAmplifiee
        // Rune du Karma : la malchance s'accumule en chance (+1 cran de rareté / 40 kills sans Épique+, /25 en Législateur).
        const karmaBonus = rules.has('karma') ? Math.min(8, Math.floor(s.killsSinceEpic / (loi ? 25 : 40))) : 0
        // Rune de Transmutation brute : les monstres NORMAUX ne droppent plus d'objets.
        const transmut = rules.has('transmutation')
        // Moins d'objets en combat classique (le farm de stuff se fait en donjon/raid).
        const drops = transmut && !boss && !elite
          ? 0
          : (boss ? 2 : Math.random() < 0.30 + eco.lootChance ? 1 : 0) + (elite ? 1 : 0) + (champion ? 1 : 0)
        const bias = pickBias(chars)
        // v0.24 : FENÊTRE de rareté du farm (≤ Légendaire). Élite/champion/boss + karma/chance
        // décalent la fenêtre — toujours sous le plafond (la chasse est en donjon/raid).
        const shift = (boss ? 1 : 0) + (elite ? 1 : 0) + (champion ? 2 : 0)
          + Math.min(2, Math.floor(eco.rarityLuck)) + Math.min(2, karmaBonus)
        let codex = s.codex
        let autoRec = 0
        let killsSinceEpic = s.killsSinceEpic + 1
        for (let dd = 0; dd < drops; dd++) {
          // Identité de loot du biome : ~50% dégâts de l'élément, ~25% résistance à l'élément, ~25% neutre.
          const br = Math.random()
          const biomeOpts = br < 0.5 ? { forceDmgType: s.activeBiome } : br < 0.75 ? { biasResist: s.activeBiome } : {}
          const it = generateItem({ ilvl: stageIlvl(stage), rarity: rollFarmRarity(stage, shift), primaryBias: bias, ...biomeOpts })
          // Rune du Karma : un drop Épique+ remet le compteur de pitié à zéro.
          if (RARITIES[it.rarity].tier >= 5) killsSinceEpic = 0
          // Recyclage automatique : tout butin commun sous le seuil part directement en éclats (on garde les uniques).
          if (s.autoRecycle && !it.unique && RARITIES[it.rarity].tier < s.recycleThreshold) {
            essence += Math.round(recycleValue(it) * eco.eclatGain)
            poussiere += recyclePoussiere(it)
            autoRec++
            continue
          }
          inventory = [it, ...inventory].slice(0, invMax)
          if (it.unique) codex = discoverFromItems(codex, [it])
          log = pushLog(log, `Butin : ${it.name}`, 'loot')
        }
        if (autoRec) log = pushLog(log, `♻️ ${autoRec} butin recyclé automatiquement.`, 'craft')

        // Bonus de métier sur les drops (Condensation de l'Alchimiste, Prospection du Joaillier).
        const cmods = cmodsTick
        // Transmutation brute : ×2 sur quintessences/gemmes/poussière (×3 en ◈ Législateur).
        const transmutMult = transmut ? (loi ? 3 : 2) : 1

        // Quintessence élémentaire : ressource ultra-rare du biome (type = celui des monstres).
        // 1% sur un ennemi normal, 5% sur une élite, 10% sur un boss. Farm continu et patient.
        let quint = s.quint
        {
          const qBase = boss ? QUINT_DROP.boss : elite ? QUINT_DROP.elite : QUINT_DROP.normal
          const qChance = qBase * quintTierMult(stage) * (surged ? SURGE_QUINT_MULT : 1) * transmutMult * cmods.quintDropMult
          if (Math.random() < qChance) {
            const t = s.activeBiome
            quint = { ...quint, [t]: (quint[t] ?? 0) + 1 }
            log = pushLog(log, `${DAMAGE_TYPES[t].icon} Quintessence de ${DAMAGE_TYPES[t].name} récoltée ! (ultra-rare)`, 'loot')
          }
        }

        // 🔹 Poussière de gemme : matière première du Joaillier (taille & recoupe).
        let gems = s.gems
        let gemDust = s.gemDust
        {
          const rank2 = boss ? 'boss' : elite ? 'elite' : 'normal'
          const dustC = GEM_DUST_DROP.chance[rank2] * transmutMult * cmods.gemDropMult
          if (Math.random() < dustC) {
            const amt = GEM_DUST_DROP.amount[rank2]
            gemDust += amt
            log = pushLog(log, `🔹 +${amt} poussière de gemme.`, 'loot')
          }
          // Gemme de CONDITION : drop par FAMILLE selon le biome (Feu/Foudre → Rythme,
          // Ombre/Nature → Flux, Arcane/Froid → Environnement, Physique → au hasard).
          const gemC = COND_GEM_DROP[rank2] * transmutMult * cmods.gemDropMult
          if (Math.random() < gemC) {
            const cg = rollCondGem(BIOME_GEM_FAMILY[s.activeBiome])
            const k = condGemKey(cg.id)
            gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
            log = pushLog(log, `${cg.icon} GEMME : ${cg.name} (${cg.family}) — drop de biome !`, 'loot')
          }
        }

        // Gemme de CONDITION : les champions ✦ en lâchent parfois (12%, toutes familles).
        if (champion && Math.random() < 0.12 * cmods.gemDropMult) {
          const cg = rollCondGem()
          const k = condGemKey(cg.id)
          gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
          log = pushLog(log, `${cg.icon} GEMME DE CONDITION : ${cg.name} ! (champion)`, 'loot')
        }

        // 🏆 Fragment de Conquête : boss/élite vaincu → la plus longue recharge de chacun tombe à zéro.
        if (cond.conquete && (boss || elite)) {
          resetLongestCooldown(chars)
          if (boss) log = pushLog(log, '🏆 Fragment de Conquête : recharges réinitialisées !', 'info')
        }

        // Le verrou de farm fige la progression au palier courant.
        let characters = chars
        let biomeBest = s.biomeBest
        if (!s.farmLock) {
          stage += 1
          biomeBest = { ...biomeBest, [s.activeBiome]: Math.max(biomeBest[s.activeBiome] ?? 0, stage) }
          bestStage = Math.max(bestStage, stage)
          if (stage % 5 === 0) {
            sceaux += 1
            log = pushLog(log, '🔑 Sceau de faille obtenu.', 'info')
          }
          // Déblocage des personnages.
          if (bestStage >= CHAR2_STAGE && characters.length < 2) {
            characters = [...characters, makeCharacter(RECRUE_NAMES[0], highestLevel(characters), 'agilite')]
            log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[0]} rejoint ton équipe !`, 'level')
          }
          if (bestStage >= CHAR3_STAGE && characters.length < 3) {
            characters = [...characters, makeCharacter(RECRUE_NAMES[1], highestLevel(characters), 'intelligence')]
            log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[1]} rejoint ton équipe !`, 'level')
          }
        }

        // L'échoppe ne se renouvelle plus au boss : rotation horaire gérée dans `tick`.
        const enemyNext = makeEnemy(stage, s.activeBiome)
        // 🌠 Étoile d'Overkill : l'excédent du coup fatal entame l'ennemi suivant.
        if (res.overkill > 0) enemyNext.hp = Math.max(1, enemyNext.maxHp - res.overkill)
        if (isBossStage(stage)) log = pushLog(log, `⚔ Un boss vous barre la route : ${enemyNext.name} !`, 'info')

        const next = { ...s, characters, stage, bestStage, biomeBest, gold, sceaux, poussiere, quint, gems, gemDust, essence, codex, inventory, killsSinceEpic, enemy: enemyNext, log, killCount: s.killCount + 1 }
        persist(next)
        set(next)
        return
      }

      set({ ...s, characters: chars, enemy, log })
    },

    setStage: (n) => {
      const s = get()
      if (s.dungeon || s.raid) return
      // On ne peut farmer que jusqu'à son RECORD DANS LE BIOME ACTIF.
      const cap = Math.max(1, s.biomeBest[s.activeBiome] ?? 1)
      const stage = Math.max(1, Math.min(cap, Math.round(n)))
      const next = { ...s, stage, enemy: makeEnemy(stage, s.activeBiome) }
      persist(next)
      set(next)
    },

    setBiome: (biome) => {
      const s = get()
      if (s.dungeon || s.raid) return
      if (!BIOME_IDS.includes(biome) || biome === s.activeBiome) return
      if (!biomeUnlocked(biome, s.biomeBest.physique ?? 0, s.bestStage)) return
      // Mémorise le palier du biome quitté, charge celui du biome rejoint.
      const biomeStages = { ...s.biomeStages, [s.activeBiome]: s.stage }
      const stage = Math.max(1, biomeStages[biome] ?? 1)
      const next = {
        ...s, activeBiome: biome, biomeStages, stage,
        enemy: makeEnemy(stage, biome),
        log: pushLog(s.log, `🧭 Tu pars pour : ${getBiomeDef(biome).icon} ${getBiomeDef(biome).name}.`, 'info'),
      }
      persist(next)
      set(next)
    },

    toggleFarmLock: () => {
      const s = get()
      const next = { ...s, farmLock: !s.farmLock }
      persist(next)
      set(next)
    },

    setRecycleThreshold: (tier) => {
      const s = get()
      const next = { ...s, recycleThreshold: Math.max(2, Math.min(16, Math.round(tier))) }
      persist(next)
      set(next)
    },

    toggleAutoRecycle: () => {
      const s = get()
      const next = { ...s, autoRecycle: !s.autoRecycle, log: pushLog(s.log, `Recyclage auto ${s.autoRecycle ? 'désactivé' : 'activé'} (sous ${RARITIES[RARITY_LIST.find((r) => r.tier === s.recycleThreshold)?.id ?? 'rare'].name}).`, 'info') }
      persist(next)
      set(next)
    },

    claimOffline: () => {
      set({ ...get(), pendingOffline: null })
    },

    equip: (itemId, targetSlot) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item) return
      const char = s.characters[s.activeChar]
      if (!char) return
      const candidates = equipSlotsForType(item.type)
      if (!candidates.length) return

      let slot: EquipSlotId
      if (targetSlot && slotAccepts(targetSlot, item.type)) slot = targetSlot
      else {
        const empty = candidates.find((c) => !char.equipment[c.id])
        slot = empty
          ? empty.id
          : candidates.slice().sort((a, b) => itemScore(char.equipment[a.id]!) - itemScore(char.equipment[b.id]!))[0].id
      }

      const equipment: Equipment = { ...char.equipment }
      const previous = equipment[slot]
      equipment[slot] = item
      let inventory = s.inventory.filter((i) => i.id !== itemId)
      if (previous) inventory = [previous, ...inventory]
      const nc = { ...char, equipment }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters, inventory }
      persist(next)
      set(next)
    },

    unequip: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      const item = char?.equipment[slot]
      if (!char || !item) return
      const equipment: Equipment = { ...char.equipment }
      delete equipment[slot]
      const inventory = [item, ...s.inventory].slice(0, invMax)
      const nc = { ...char, equipment }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters, inventory }
      persist(next)
      set(next)
    },

    sell: (itemId) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item) return
      const gain = sellValue(item)
      const next = {
        ...s,
        gold: s.gold + gain,
        gems: gemStockAdd(s.gems, item),
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(s.log, `Vendu : ${item.name} (+${gain} or${item.gems?.length ? ', gemmes rendues' : ''}).`, 'gold'),
      }
      persist(next)
      set(next)
    },

    recycle: (itemId) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item) return
      const mods = craftMods(s.metiers)
      const gain = Math.round(recycleValue(item) * computeGlobalMods(s.upgrades).eclatGain * mods.recycleMult)
      const pous = recyclePoussiere(item)
      const refund = quintRefund(item)
      const essences = { ...s.essences }
      let essLog = ''
      if (item.unique) {
        // ◈ Distillateur : essences d'uniques ×2 au recyclage.
        const eg = essenceGain(RARITIES[item.rarity].tier, item.unique.rank) * (mods.distillateur ? 2 : 1)
        essences[item.unique.id] = (essences[item.unique.id] ?? 0) + eg
        essLog = ` + ${eg} essences de ${getUnique(item.unique.id)?.name ?? 'l\'effet'}`
      }
      const qLog = quintLogSuffix(refund)
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'modify'))
      const next = {
        ...s,
        essence: s.essence + gain,
        poussiere: s.poussiere + pous,
        quint: addQuint(s.quint, refund),
        gems: gemStockAdd(s.gems, item),
        essences,
        metiers: g.metiers,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(g.log, `Recyclé : ${item.name} (+${gain} éclats${pous ? ` + ${pous} 🌌` : ''}${qLog}${essLog}${item.gems?.length ? ', gemmes rendues' : ''}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    sellAllBelow: (tier) => {
      const s = get()
      let gold = s.gold
      let gems = s.gems
      let count = 0
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier && !bulkProtected(item)) {
          gold += sellValue(item)
          gems = gemStockAdd(gems, item)
          count++
        } else keep.push(item)
      }
      const gained = gold - s.gold
      const next = { ...s, gold, gems, inventory: keep, log: count ? pushLog(s.log, `${count} objet(s) vendu(s) (+${gained} or).`, 'gold') : s.log }
      persist(next)
      set(next)
    },

    recycleAllBelow: (tier) => {
      const s = get()
      const mods = craftMods(s.metiers)
      let essence = s.essence
      let poussiere = s.poussiere
      let quint = s.quint
      let gems = s.gems
      let count = 0
      let xp = 0
      const essences = { ...s.essences }
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier && !bulkProtected(item)) {
          essence += Math.round(recycleValue(item) * mods.recycleMult)
          poussiere += recyclePoussiere(item)
          quint = addQuint(quint, quintRefund(item))
          gems = gemStockAdd(gems, item)
          if (item.unique) essences[item.unique.id] = (essences[item.unique.id] ?? 0) + essenceGain(RARITIES[item.rarity].tier, item.unique.rank) * (mods.distillateur ? 2 : 1)
          xp += metierXpGain(RARITIES[item.rarity].tier, 'modify')
          count++
        } else keep.push(item)
      }
      const gained = essence - s.essence
      const g = count ? gainMetierXp(s, 'alchimiste', xp) : { metiers: s.metiers, log: s.log }
      const next = { ...s, essence, poussiere, quint, gems, essences, metiers: g.metiers, inventory: keep, log: count ? pushLog(g.log, `${count} objet(s) recyclé(s) (+${gained} éclats).`, 'craft') : g.log }
      persist(next)
      set(next)
    },

    reforge: (itemId, locked) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item) return
      const mods = craftMods(s.metiers)
      const cost = Math.round(reforgeCost(item) * mods.costMult)
      if (s.essence < cost) return
      // Les lignes renforcées à la Quintessence sont protégées (jamais re-tirées).
      const enhanced = item.affixes.map((a, i) => ((a.upgraded ?? 0) > 0 ? i : -1)).filter((i) => i >= 0)
      const allLocked = [...new Set([...locked, ...enhanced])]
      const upd = applyItemPatch(s, itemId, { affixes: reforgeItem(item, allLocked) })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = { ...s, ...upd, metiers: g.metiers, essence: s.essence - cost, log: pushLog(g.log, `Reforge : ${item.name} (-${cost} éclats, +${gain} XP 🔨).`, 'craft') }
      persist(next)
      set(next)
    },

    surillvl: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.surillvl) return // débloqué via l'arbre du Forgeron
      const item = findItemById(s, itemId)
      if (!item) return
      const cost = Math.round(surillvlCost(item) * mods.costMult)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, surillvlItem(item, mods.surillvlStep))
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = { ...s, ...upd, metiers: g.metiers, essence: s.essence - cost, log: pushLog(g.log, `Surillvl : ${item.name} → iLvl ${item.ilvl + mods.surillvlStep} (-${cost} éclats, +${gain} XP 🔨).`, 'craft') }
      persist(next)
      set(next)
    },

    ascend: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.ascend) return // débloqué via l'arbre du Forgeron
      const item = findItemById(s, itemId)
      if (!item) return
      const patch = ascendItem(item)
      if (!patch) return
      const c = ascendCost(item)
      const m = mods.costMult
      const cost = { eclats: Math.round(c.eclats * m), noyau: Math.round(c.noyau * m), fragments: Math.round((c.fragments ?? 0) * m), poussiere: Math.round((c.poussiere ?? 0) * m), cosmic: Math.round((c.cosmic ?? 0) * m) }
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < cost.fragments || s.poussiere < cost.poussiere || s.cosmic < cost.cosmic) return
      const upd = applyItemPatch(s, itemId, patch)
      if (!upd) return
      const gain = metierXpGain(RARITIES[patch.rarity!].tier, 'ascend', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        fragments: s.fragments - cost.fragments,
        poussiere: s.poussiere - cost.poussiere,
        cosmic: s.cosmic - cost.cosmic,
        metiers: g.metiers,
        log: pushLog(g.log, `Ascension : ${item.name} → ${RARITIES[patch.rarity!].name} ! (-${cost.noyau} Noyau, +${gain} XP 🔨)`, 'craft'),
      }
      persist(next)
      set(next)
    },

    upgradeUnique: (itemId) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item?.unique) return
      const rank = item.unique.rank
      if (rank >= UNIQUE_MAX_RANK) return
      const cost = upgradeCost(rank)
      const have = s.essences[item.unique.id] ?? 0
      if (have < cost.essences || s.essence < cost.eclats) return
      const upd = applyItemPatch(s, itemId, { unique: { id: item.unique.id, rank: rank + 1 } })
      if (!upd) return
      const essences = { ...s.essences, [item.unique.id]: have - cost.essences }
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'modify'))
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        essences,
        metiers: g.metiers,
        log: pushLog(g.log, `Effet amélioré : ${getUnique(item.unique.id)?.name ?? ''} → rang ${rank + 1} !`, 'craft'),
      }
      persist(next)
      set(next)
    },

    transmute: (itemId, newPrimary) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.transmute) return // débloqué via l'arbre du Forgeron
      const item = findItemById(s, itemId)
      if (!item || item.primary === newPrimary) return
      const cost = Math.round(transmuteCost(item) * mods.costMult)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, { primary: newPrimary })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = { ...s, ...upd, metiers: g.metiers, essence: s.essence - cost, log: pushLog(g.log, `Affinité transmutée : ${item.name} → ${newPrimary} (-${cost} éclats, +${gain} XP 🔨).`, 'craft') }
      persist(next)
      set(next)
    },

    enhanceTyped: (itemId, type, kind) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.quint) return // débloqué via l'arbre de l'Alchimiste
      const item = findItemById(s, itemId)
      if (!item) return
      const res = enhanceTypedAffixes(item, type, kind)
      if (!res) return
      const have = s.quint[type] ?? 0
      if (have < res.cost) return
      const upd = applyItemPatch(s, itemId, { affixes: res.affixes })
      if (!upd) return
      const m = DAMAGE_TYPES[type]
      const verb = item.affixes.some((a) => a.kind === kind && a.type === type) ? 'renforcée' : 'ajoutée'
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify')
      const g = gainMetierXp(s, 'alchimiste', gain)
      const next = {
        ...s,
        ...upd,
        quint: { ...s.quint, [type]: have - res.cost },
        metiers: g.metiers,
        log: pushLog(g.log, `${m.icon} Ligne ${kind === 'resist' ? 'Résist.' : 'Dégâts'} ${m.name} ${verb} (-${res.cost} Quintessence, +${gain} XP ⚗️).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    socketCondGem: (itemId, condId, rank = 1) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.gems) return // débloqué via l'arbre du Joaillier (Sertissage)
      const def = getCondGem(condId)
      const item = findItemById(s, itemId)
      if (!def || !item) return
      if ((item.gems?.length ?? 0) >= itemSockets(item, mods.weaponSocketBonus)) return
      const key = condGemKey(condId, rank)
      if ((s.gems[key] ?? 0) < 1) return
      const upd = applyItemPatch(s, itemId, { gems: [...(item.gems ?? []), condGemInstance(condId, rank)] })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify')
      const g = gainMetierXp(s, 'joaillier', gain)
      const next = {
        ...s, ...upd,
        gems: { ...s.gems, [key]: (s.gems[key] ?? 0) - 1 },
        metiers: g.metiers,
        log: pushLog(g.log, `${def.icon} Sertie : ${def.name}${rank > 1 ? ` (rang ${rank})` : ''} sur ${item.name} (+${gain} XP 💎).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    unsocketGem: (itemId, index) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.gems) return
      const item = findItemById(s, itemId)
      const gem = item?.gems?.[index]
      if (!item || !gem?.cond) return
      const cost = Math.round(unsocketCost() * mods.unsocketCostMult)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, { gems: item.gems!.filter((_, i) => i !== index) })
      if (!upd) return
      const key = condGemKey(gem.cond as CondGemId, gem.rank ?? 1)
      const label = getCondGem(gem.cond)?.name ?? 'gemme'
      const next = {
        ...s, ...upd,
        essence: s.essence - cost,
        gems: { ...s.gems, [key]: (s.gems[key] ?? 0) + 1 },
        log: pushLog(s.log, `💎 Désertie : ${label} (-${cost} éclats, gemme rendue avec son rang).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    grindGem: (key) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.broyage) return // nœud « Broyage » de l'arbre du Joaillier
      const parsed = parseCondKey(key)
      if (!parsed || (s.gems[key] ?? 0) < 1) return
      const dust = grindDust(parsed.rank)
      const gems = { ...s.gems, [key]: (s.gems[key] ?? 0) - 1 }
      if (gems[key] <= 0) delete gems[key]
      const g = gainMetierXp(s, 'joaillier', metierXpGain(2 + parsed.rank, 'modify'))
      const next = {
        ...s, gems, gemDust: s.gemDust + dust, metiers: g.metiers,
        log: pushLog(g.log, `⚒️ Broyée : ${parsed.def.name} → +${dust} 🔹 poussière.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    cutGem: (condId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.taille) return // nœud « Taille » de l'arbre du Joaillier
      const def = getCondGem(condId)
      if (!def || s.gemDust < GEM_CUT_COST) return
      const key = condGemKey(condId)
      const g = gainMetierXp(s, 'joaillier', metierXpGain(5, 'create'))
      const next = {
        ...s,
        gemDust: s.gemDust - GEM_CUT_COST,
        gems: { ...s.gems, [key]: (s.gems[key] ?? 0) + 1 },
        metiers: g.metiers,
        log: pushLog(g.log, `✂️ Taillée : ${def.icon} ${def.name} (-${GEM_CUT_COST} 🔹).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    recutGem: (itemId, index) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.recoupe) return // nœud « Recoupe » de l'arbre du Joaillier
      const item = findItemById(s, itemId)
      const gem = item?.gems?.[index]
      if (!item || !gem?.cond) return
      const def = getCondGem(gem.cond)
      if (!def) return
      const rank = gem.rank ?? 1
      if (rank >= gemMaxRank(def)) return
      const cost = recutCost(rank)
      if (s.gemDust < cost) return
      const gemsArr = item.gems!.map((x, i) => (i === index ? { ...x, rank: rank + 1 } : x))
      const upd = applyItemPatch(s, itemId, { gems: gemsArr })
      if (!upd) return
      const gain = metierXpGain(4 + rank, 'ascend')
      const g = gainMetierXp(s, 'joaillier', gain)
      const next = {
        ...s, ...upd,
        gemDust: s.gemDust - cost,
        metiers: g.metiers,
        log: pushLog(g.log, `🔬 Recoupe : ${def.name} → rang ${rank + 1} (-${cost} 🔹, +${gain} XP 💎).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    enchantItem: (itemId, enchantId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.enchant) return // débloqué via l'arbre du Runiste (Gravure)
      const def = getEnchant(enchantId)
      const item = findItemById(s, itemId)
      if (!def || !item || item.enchant === enchantId) return
      if (def.rule && !mods.ruleRunes) return // runes de RÈGLE : nœud « Lois du monde »
      // v0.25 (option A) : la gravure CONSOMME une rune POSSÉDÉE (drop de raid/donjon).
      if ((s.runesOwned[enchantId] ?? 0) < 1) return
      const raw = enchantCost(def, item)
      const cost = { eclats: Math.round(raw.eclats * mods.enchantCostMult), poussiere: Math.round(raw.poussiere * mods.enchantCostMult) }
      if (s.essence < cost.eclats || s.poussiere < cost.poussiere) return
      const upd = applyItemPatch(s, itemId, { enchant: enchantId })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.runisteXpMult)
      const g = gainMetierXp(s, 'runiste', gain)
      const next = {
        ...s, ...upd,
        essence: s.essence - cost.eclats,
        poussiere: s.poussiere - cost.poussiere,
        runesOwned: { ...s.runesOwned, [enchantId]: (s.runesOwned[enchantId] ?? 0) - 1 },
        metiers: g.metiers,
        log: pushLog(g.log, `🪄 Rune gravée : ${def.icon} ${def.name} sur ${item.name} (rune consommée, -${cost.eclats} ♦${cost.poussiere ? `, -${cost.poussiere} 🌌` : ''}, +${gain} XP 🪄).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    createItem: (opts) => {
      const s = get()
      const mods = craftMods(s.metiers)
      const tier = RARITIES[opts.rarity].tier
      const ilvl = stageIlvl(s.bestStage)
      // Coût de la rareté CHOISIE, réduit par le métier (Forgeron économe).
      const c = createCost(tier, ilvl); const m = mods.costMult
      const cost = { eclats: Math.round(c.eclats * m), noyau: Math.round(c.noyau * m), fragments: Math.round((c.fragments ?? 0) * m), poussiere: Math.round((c.poussiere ?? 0) * m), cosmic: Math.round((c.cosmic ?? 0) * m) }
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < cost.fragments || s.poussiere < cost.poussiere || s.cosmic < cost.cosmic) return
      // Œil du joaillier : chance de forger une rareté SUPÉRIEURE (gratuit), capée au max craftable.
      const lucky = Math.random() < mods.luckChance && tier < maxCraftTier(s.bestStage)
      const prodTier = lucky ? tier + 1 : tier
      const rarityId = RARITY_LIST.find((r) => r.tier === prodTier)?.id ?? opts.rarity
      const item = generateItem({ ilvl, type: opts.type, rarity: rarityId, primary: opts.primary, ...(opts.orientation ? { orientation: opts.orientation } : {}), ...(opts.element ? { element: opts.element } : {}) })
      const inventory = [item, ...s.inventory].slice(0, invMax)
      const gain = metierXpGain(prodTier, 'create', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = {
        ...s,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        fragments: s.fragments - cost.fragments,
        poussiere: s.poussiere - cost.poussiere,
        cosmic: s.cosmic - cost.cosmic,
        metiers: g.metiers,
        inventory,
        codex: discoverFromItems(s.codex, [item]),
        log: pushLog(g.log, `Forgé : ${item.name} (${RARITIES[rarityId].name})${lucky ? ' — 🎲 rareté chanceuse !' : ''} (+${gain} XP 🔨).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    learnMetierNode: (metier, nodeId) => {
      const s = get()
      const def = getMetierNode(metier, nodeId)
      if (!def) return
      if (!canLearnNode(s.metiers, metier, nodeId, s.bestStage).ok) return
      const st = s.metiers[metier]
      const rank = (st.nodes[nodeId] ?? 0) + 1
      const metiers = { ...s.metiers, [metier]: { ...st, nodes: { ...st.nodes, [nodeId]: rank } } }
      const m = METIERS[metier]
      const next = {
        ...s, metiers,
        log: pushLog(s.log, `${m.icon} ${m.name} : ${def.icon} ${def.name}${def.maxRank > 1 ? ` rang ${rank}` : ''} appris !`, 'craft'),
      }
      persist(next)
      set(next)
    },

    respecMetier: (metier) => {
      const s = get()
      const st = s.metiers[metier]
      if (Object.keys(st.nodes).length === 0) return
      const cost = respecCost(st)
      if (s.gold < cost) return
      const metiers = { ...s.metiers, [metier]: { ...st, nodes: {} } }
      const m = METIERS[metier]
      const next = {
        ...s, metiers, gold: s.gold - cost,
        log: pushLog(s.log, `${m.icon} ${m.name} : arbre réinitialisé (-${cost.toLocaleString('fr-FR')} or). Points rendus.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    convertResource: (conversionId, times = 1, quintType) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.transmutateur) return // ◈ spécialisation Transmutateur de l'Alchimiste
      const def = getConversion(conversionId)
      const n = Math.max(1, Math.round(times))
      if (!def) return
      if (def.to.res === 'quint' && !quintType) return
      const pool: Record<ConvRes, number> = { essence: s.essence, poussiere: s.poussiere, noyau: s.noyau, quint: 0 }
      const cost = def.from.amt * n
      if (pool[def.from.res] < cost) return
      const gainAmt = def.to.amt * n
      const next = {
        ...s,
        essence: s.essence + (def.to.res === 'essence' ? gainAmt : 0) - (def.from.res === 'essence' ? cost : 0),
        poussiere: s.poussiere + (def.to.res === 'poussiere' ? gainAmt : 0) - (def.from.res === 'poussiere' ? cost : 0),
        noyau: s.noyau + (def.to.res === 'noyau' ? gainAmt : 0) - (def.from.res === 'noyau' ? cost : 0),
        quint: def.to.res === 'quint' && quintType ? { ...s.quint, [quintType]: (s.quint[quintType] ?? 0) + gainAmt } : s.quint,
        ...(() => {
          const g = gainMetierXp(s, 'alchimiste', metierXpGain(3, 'modify'))
          return { metiers: g.metiers, log: pushLog(g.log, `⚗️ Transmutation : ${def.name}${quintType ? ` (${DAMAGE_TYPES[quintType].name})` : ''} ×${n}.`, 'craft') }
        })(),
      }
      persist(next)
      set(next)
    },

    buildAutomate: () => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.automates) return // nœud « Industrialisation » de l'arbre du Forgeron
      const idx = s.automates.length
      if (idx >= AUTOMATE_MAX) return
      if (levelFromXp(s.metiers.forgeron.xp) < AUTOMATE_FORGERON_LEVELS[idx]) return
      const c = AUTOMATE_COSTS[idx]
      if (s.gold < c.gold || s.poussiere < c.poussiere || s.fragments < c.fragments || s.cosmic < c.cosmic) return
      const a: Automate = {
        id: idx + 1,
        name: AUTOMATE_NAMES[idx] ?? `Automate ${idx + 1}`,
        mission: null, progress: 0, paused: false, speedLvl: 0, yieldLvl: 0, bank: {},
      }
      const next = {
        ...s,
        gold: s.gold - c.gold,
        poussiere: s.poussiere - c.poussiere,
        fragments: s.fragments - c.fragments,
        cosmic: s.cosmic - c.cosmic,
        automates: [...s.automates, a],
        log: pushLog(s.log, `🤖 Automate construit : ${a.name} ! Assigne-lui un donjon ou un raid déjà battu (Atelier).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    assignAutomate: (id, mission) => {
      const s = get()
      if (mission) {
        // Uniquement du contenu DÉJÀ BATTU (l'automate ne progresse jamais, il récolte).
        const record = mission.kind === 'dungeon'
          ? s.dungeonProgress[mission.id as DungeonId] ?? 0
          : s.raidProgress[mission.id as RaidId] ?? 0
        if (mission.level < 1 || mission.level > record) return
      }
      const automates = s.automates.map((a) => (a.id === id ? { ...a, mission, progress: 0, waiting: false } : a))
      const next = {
        ...s, automates,
        log: pushLog(s.log, mission
          ? `🤖 Mission assignée : ${missionLabel(mission)}.`
          : '🤖 Mission retirée — l\'automate est au repos.', 'craft'),
      }
      persist(next)
      set(next)
    },

    toggleAutomatePause: (id) => {
      const s = get()
      const automates = s.automates.map((a) => (a.id === id ? { ...a, paused: !a.paused } : a))
      const next = { ...s, automates }
      persist(next)
      set(next)
    },

    upgradeAutomate: (id, kind) => {
      const s = get()
      const a = s.automates.find((x) => x.id === id)
      if (!a) return
      const lvl = kind === 'speed' ? a.speedLvl : a.yieldLvl
      if (lvl >= AUTOMATE_UPG_MAX) return
      const cost = automateUpgradeCost(kind, lvl)
      if (s.gold < cost) return
      const automates = s.automates.map((x) =>
        x.id === id ? { ...x, speedLvl: kind === 'speed' ? x.speedLvl + 1 : x.speedLvl, yieldLvl: kind === 'yield' ? x.yieldLvl + 1 : x.yieldLvl } : x,
      )
      const next = {
        ...s, automates, gold: s.gold - cost,
        log: pushLog(s.log, `🤖 ${a.name} amélioré : ${kind === 'speed' ? 'vitesse' : 'rendement'} niv. ${lvl + 1} (-${cost.toLocaleString('fr-FR')} or).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    enterDungeon: (dungeonId, level, repeat = 1, wing) => {
      const s = get()
      if (s.dungeon || s.raid) return
      const def = getDungeonDef(dungeonId)
      if (!def || s.bestStage < def.unlockStage) return
      if (s.sceaux < def.sceauCost) return
      if (level < 1 || level > (s.dungeonProgress[dungeonId] ?? 0) + 1) return
      const dungeon = generateDungeon(dungeonId, level, wing)
      dungeon.repeatLeft = Math.max(0, Math.round(repeat) - 1)
      // Rune de l'Économe : 15% de chance de préserver la clé.
      const saved = def.sceauCost > 0 && equippedRules(s.characters).has('econome') && Math.random() < (craftMods(s.metiers).loiAmplifiee ? 0.25 : 0.15)
      const cost = saved ? 0 : def.sceauCost
      const runs = dungeon.repeatLeft > 0 ? ` · auto ×${dungeon.repeatLeft + 1}` : ''
      // On ENTRE frais : PV pleins + recharges remises à zéro (fini les morts en donjon après un farm low PV).
      const healed = s.characters.map(fullHeal)
      resetAllCooldowns(healed)
      const next = { ...s, characters: healed, sceaux: s.sceaux - cost, dungeon, log: pushLog(s.log, `🏰 Entrée dans ${dungeon.name} (${dungeon.totalFights} combats${saved ? ', 🗝️ clé préservée !' : cost ? `, -${cost} 🔑` : ', gratuit'}${runs}).`, 'info') }
      persist(next)
      set(next)
    },

    abandonDungeon: () => {
      const s = get()
      if (!s.dungeon) return
      // Quitter une instance soigne et RESSUSCITE toute l'équipe (sinon un perso mort restait mort).
      const next = { ...s, characters: s.characters.map(fullHeal), dungeon: null, log: pushLog(s.log, 'Donjon abandonné. Le Sceau est perdu.', 'info') }
      persist(next)
      set(next)
    },

    enterRaid: (raidId, tier, repeat = 1) => {
      const s = get()
      if (s.raid || s.dungeon) return
      const def = getRaidDef(raidId)
      if (!def || !raidUnlocked(def, s.bestStage, s.raidProgress)) return
      // v0.24 : le tier doit être DÉBLOQUÉ (clear de la frontière + Trophées — voir unlockRaidTier).
      const maxTier = s.raidTierUnlocked[raidId] ?? 1
      if (tier < 1 || tier > maxTier) return
      if (s.orbes < def.orbeCost) return
      const raid = generateRaid(raidId, tier)
      raid.repeatLeft = Math.max(0, Math.round(repeat) - 1)
      // Rune de l'Économe : 15% de chance de préserver l'Orbe.
      const saved = equippedRules(s.characters).has('econome') && Math.random() < (craftMods(s.metiers).loiAmplifiee ? 0.25 : 0.15)
      const runs = raid.repeatLeft > 0 ? ` · auto ×${raid.repeatLeft + 1}` : ''
      const boss = raidBossVariant(def, tier)
      // On ENTRE frais : PV pleins + recharges remises à zéro (le boss se prépare à neuf).
      const healed = s.characters.map(fullHeal)
      resetAllCooldowns(healed)
      const next = { ...s, characters: healed, orbes: s.orbes - (saved ? 0 : def.orbeCost), raid, log: pushLog(s.log, `⚔️ Raid lancé : ${def.name} · Tier ${tier} — ${boss.name}${boss.partnerName ? ` & ${boss.partnerName}` : ''}${saved ? ' · 🗝️ Orbe préservée !' : ''}${runs}.`, 'info') }
      persist(next)
      set(next)
    },

    abandonRaid: () => {
      const s = get()
      if (!s.raid) return
      // Quitter une instance soigne et RESSUSCITE toute l'équipe (sinon un perso mort restait mort).
      const next = { ...s, characters: s.characters.map(fullHeal), raid: null, log: pushLog(s.log, 'Raid abandonné. L\'Orbe est perdue.', 'info') }
      persist(next)
      set(next)
    },

    unlockRaidTier: (raidId) => {
      const s = get()
      const def = getRaidDef(raidId)
      if (!def) return
      const cur = s.raidTierUnlocked[raidId] ?? 1
      // Il faut avoir VAINCU la frontière actuelle (le mur se franchit, il ne s'achète pas seul)…
      if ((s.raidProgress[raidId] ?? 0) < cur) return
      // …et payer les Trophées du raid (≈ 5 clears du tier courant).
      const cost = raidTierUnlockCost(cur + 1)
      if ((s.raidTrophies[raidId] ?? 0) < cost) return
      const next = {
        ...s,
        raidTrophies: { ...s.raidTrophies, [raidId]: (s.raidTrophies[raidId] ?? 0) - cost },
        raidTierUnlocked: { ...s.raidTierUnlocked, [raidId]: cur + 1 },
        log: pushLog(s.log, `🏆 ${def.name} : Tier ${cur + 1} débloqué (-${cost} Trophées) !`, 'level'),
      }
      persist(next)
      set(next)
    },

    infuseUnique: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.synth1) return // Synthèse I (arbre de l'Alchimiste)
      if (s.fragments < FRAGMENT_INFUSE_COST) return
      const item = findItemById(s, itemId)
      if (!item) return
      // Pas d'unique → en ajoute un ; sinon monte son rang.
      const newUnique = item.unique
        ? { id: item.unique.id, rank: Math.min(UNIQUE_MAX_RANK, item.unique.rank + 1) }
        : randomUniqueInstance()
      const upd = applyItemPatch(s, itemId, { unique: newUnique })
      if (!upd) return
      const label = item.unique ? `rang ${newUnique.rank}` : `effet ${getUnique(newUnique.id)?.name ?? ''}`
      const codex = s.codex.includes(newUnique.id) ? s.codex : [...s.codex, newUnique.id]
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'ascend'))
      const next = { ...s, ...upd, codex, metiers: g.metiers, fragments: s.fragments - FRAGMENT_INFUSE_COST, log: pushLog(g.log, `✨ Fragment infusé : ${item.name} (${label}).`, 'craft') }
      persist(next)
      set(next)
    },

    /** Invoque un effet unique AU CHOIX sur un objet (sink d'Éclat cosmique des raids). */
    chooseUnique: (itemId, effectId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.synth3) return // Synthèse III (arbre de l'Alchimiste, palier 100)
      const def = getUnique(effectId)
      if (!def) return
      const item = findItemById(s, itemId)
      if (!item) return
      if (s.cosmic < CHOOSE_UNIQUE_COST.cosmic || s.fragments < CHOOSE_UNIQUE_COST.fragments) return
      // Même effet déjà présent → monte son rang ; sinon le pose au rang 1.
      const rank = item.unique?.id === effectId ? Math.min(UNIQUE_MAX_RANK, item.unique.rank + 1) : 1
      const upd = applyItemPatch(s, itemId, { unique: { id: effectId, rank } })
      if (!upd) return
      const codex = s.codex.includes(effectId) ? s.codex : [...s.codex, effectId]
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'ascend'))
      const next = {
        ...s,
        ...upd,
        codex,
        cosmic: s.cosmic - CHOOSE_UNIQUE_COST.cosmic,
        fragments: s.fragments - CHOOSE_UNIQUE_COST.fragments,
        metiers: g.metiers,
        log: pushLog(g.log, `💫 Effet invoqué : ${def.name} sur ${item.name} (rang ${rank}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    insertEffect: (itemId, effectId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.synth2) return // Synthèse II (arbre de l'Alchimiste)
      const def = getUnique(effectId)
      if (!def) return
      const item = findItemById(s, itemId)
      if (!item) return
      const cost = insertCost()
      const have = s.essences[effectId] ?? 0
      if (have < cost.essences || s.essence < cost.eclats) return
      const rank = item.unique?.id === effectId ? item.unique.rank : 1
      const upd = applyItemPatch(s, itemId, { unique: { id: effectId, rank } })
      if (!upd) return
      const essences = { ...s.essences, [effectId]: have - cost.essences }
      const codex = s.codex.includes(effectId) ? s.codex : [...s.codex, effectId]
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'modify'))
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        essences,
        codex,
        metiers: g.metiers,
        log: pushLog(g.log, `🧬 Effet inséré : ${def.name} sur ${item.name} (-${cost.essences} essences).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    claimChest: () => {
      const s = get()
      const c = s.pendingChest
      if (!c) return
      const pousG = c.poussiere ?? 0
      const cosmG = c.cosmic ?? 0
      const orbeG = c.orbes ?? 0
      const fragG = c.fragments ?? 0
      const gemG = c.gem ? getCondGem(c.gem.id) : undefined
      const next = {
        ...s,
        ...applyChestRewards(s, c),
        pendingChest: null,
        log: pushLog(
          s.log,
          `Coffre ouvert : ${c.items.length} objets${c.eclats ? `, +${c.eclats} éclats` : ''}${c.noyau ? `, +${c.noyau} noyaux` : ''}${pousG ? `, +${pousG} poussière` : ''}${c.gemDust ? `, +${c.gemDust} 🔹` : ''}${gemG ? `, 💎 ${gemG.name}${(c.gem!.rank ?? 1) > 1 ? ` R${c.gem!.rank}` : ''}` : ''}${cosmG ? `, +${cosmG} 💫` : ''}${c.gold ? `, +${c.gold} or` : ''}${c.sceaux ? `, +${c.sceaux} sceau` : ''}${orbeG ? `, +${orbeG} orbe` : ''}${fragG ? `, +${fragG} fragment` : ''}.`,
          'craft',
        ),
      }
      persist(next)
      set(next)
    },

    craftSceau: () => {
      const s = get()
      if (s.noyau < SCEAU_COST.noyau || s.essence < SCEAU_COST.eclats) return
      const next = {
        ...s,
        noyau: s.noyau - SCEAU_COST.noyau,
        essence: s.essence - SCEAU_COST.eclats,
        sceaux: s.sceaux + 1,
        log: pushLog(s.log, `🔑 Sceau de faille forgé (-${SCEAU_COST.noyau} noyaux, -${SCEAU_COST.eclats} éclats).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    setActiveChar: (index) => {
      const s = get()
      if (index < 0 || index >= s.characters.length) return
      const next = { ...s, activeChar: index }
      persist(next)
      set(next)
    },

    renameCharacter: (index, name) => {
      const s = get()
      const n = name.trim().slice(0, 16)
      if (!n || index < 0 || index >= s.characters.length || n === s.characters[index].name) return
      const old = s.characters[index].name
      const characters = s.characters.map((c, i) => (i === index ? { ...c, name: n } : c))
      const next = { ...s, characters, log: pushLog(s.log, `✏️ ${old} s'appelle désormais ${n}.`, 'info') }
      persist(next)
      set(next)
    },

    setBias: (p) => {
      const s = get()
      const characters = s.characters.map((c, i) => (i === s.activeChar ? { ...c, primaryBias: p } : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    setPower: (slot, powerId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || slot < 0 || slot >= char.powers.length) return
      if (powerId && !char.unlockedPowers.includes(powerId)) return
      const powers = char.powers.map((x) => (x === powerId ? null : x)) // unicité
      powers[slot] = powerId
      const nc = { ...char, powers }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    togglePowerAuto: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || slot < 0 || slot >= char.powers.length) return
      const powerAuto = char.powers.map((_, i) => (i === slot ? char.powerAuto?.[i] === false : char.powerAuto?.[i] !== false))
      const nc = { ...char, powerAuto }
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    castPower: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const pid = char.powers[slot]
      if (!pid || char.powerAuto?.[slot] !== false) return // doit être en MANUEL
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      // Posé en attente : le prochain tick le lancera si la recharge est prête (strict, pas de file).
      manualFire.add(`${char.id}:${pid}`)
    },

    allocateTalent: (nodeId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const node = getTalent(nodeId)
      if (!node || !canAllocate(node, char.talents, char.talentPoints)) return
      const talents = { ...char.talents, [nodeId]: (char.talents[nodeId] ?? 0) + 1 }
      const unlockedPowers = computeUnlockedPowers(talents)
      const nc = { ...char, talents, talentPoints: char.talentPoints - 1, unlockedPowers }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    respecTalents: () => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const spent = Object.values(char.talents).reduce((a, b) => a + b, 0)
      // Le nœud racine « Éveil » (co_start) reste alloué d'office : on rembourse le reste.
      const refundable = spent - (char.talents.co_start ?? 0)
      if (refundable <= 0) return
      const cost = 200 * char.level
      if (s.gold < cost) return
      const talents = { co_start: 1 }
      const unlockedPowers = computeUnlockedPowers(talents)
      const powers = char.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, talents, talentPoints: char.talentPoints + refundable, unlockedPowers, powers }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, gold: s.gold - cost, characters, log: pushLog(s.log, `Talents réinitialisés (-${cost} or).`, 'craft') }
      persist(next)
      set(next)
    },

    saveBuildPreset: (slot, name) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || slot < 0 || slot > 2) return
      const presets = [...(char.buildPresets ?? [null, null, null])]
      presets[slot] = {
        name: (name ?? presets[slot]?.name ?? `Build ${slot + 1}`).trim().slice(0, 14) || `Build ${slot + 1}`,
        talents: { ...char.talents },
        powers: [...char.powers],
        primaryBias: char.primaryBias,
      }
      const characters = s.characters.map((c, i) => (i === s.activeChar ? { ...c, buildPresets: presets } : c))
      const next = { ...s, characters, log: pushLog(s.log, `🧩 Préset « ${presets[slot]!.name} » sauvegardé.`, 'craft') }
      persist(next)
      set(next)
    },

    applyBuildPreset: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      const preset = char?.buildPresets?.[slot]
      if (!char || !preset) return
      // Respec payant (gratuit si rien n'est alloué au-delà de la racine).
      const refundable = Object.values(char.talents).reduce((a, b) => a + b, 0) - (char.talents.co_start ?? 0)
      const cost = refundable > 0 ? 200 * char.level : 0
      if (s.gold < cost) return
      // Réallocation VALIDÉE nœud par nœud (prérequis + budget de points du niveau actuel) :
      // un préset sauvegardé à plus haut niveau s'applique au mieux, jamais en triche.
      const target = preset.talents
      const talents: Record<string, number> = { co_start: 1 }
      let points = talentPointsForLevel(char.level)
      let progressed = true
      while (progressed) {
        progressed = false
        for (const id in target) {
          if (id === 'co_start') continue
          const node = getTalent(id)
          if (!node) continue
          const want = Math.min(target[id], node.maxRank)
          while ((talents[id] ?? 0) < want && canAllocate(node, talents, points)) {
            talents[id] = (talents[id] ?? 0) + 1
            points--
            progressed = true
          }
        }
      }
      const unlockedPowers = computeUnlockedPowers(talents)
      const powers = preset.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, talents, talentPoints: points, unlockedPowers, powers, primaryBias: preset.primaryBias }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = {
        ...s, gold: s.gold - cost, characters,
        log: pushLog(s.log, `🧩 Préset « ${preset.name} » appliqué${cost ? ` (-${cost.toLocaleString('fr-FR')} or)` : ''}.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    deleteBuildPreset: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || !char.buildPresets?.[slot]) return
      const presets = [...char.buildPresets]
      presets[slot] = null
      const characters = s.characters.map((c, i) => (i === s.activeChar ? { ...c, buildPresets: presets } : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    buyUpgrade: (id) => {
      const s = get()
      const def = getUpgrade(id)
      if (!def) return
      const level = s.upgrades[id] ?? 0
      if (isMaxed(def, level)) return
      const cost = accountUpgradeCost(def, level)
      const pous = upgradePoussiere(def, level)
      const ecl = upgradeEclats(def, level)
      if (s.gold < cost || s.poussiere < pous || s.essence < ecl) return
      const upgrades = { ...s.upgrades, [id]: level + 1 }
      let characters = s.characters
      if (id === 'talentBonus') characters = characters.map((c) => ({ ...c, talentPoints: c.talentPoints + 1 }))
      refreshGlobals(upgrades)
      const next = { ...s, gold: s.gold - cost, poussiere: s.poussiere - pous, essence: s.essence - ecl, upgrades, characters, log: pushLog(s.log, `Amélioration : ${def.name} niv. ${level + 1} (-${cost.toLocaleString('fr-FR')} or${ecl ? `, -${ecl} ♦` : ''}${pous ? `, -${pous} 🌌` : ''}).`, 'gold') }
      persist(next)
      set(next)
    },

    refreshShop: () => {
      const s = get()
      const cost = shopRefreshCost(s.bestStage)
      if (s.gold < cost) return
      const eco = computeGlobalMods(s.upgrades)
      const next = { ...s, gold: s.gold - cost, shopStock: generateShop(s.bestStage, Math.floor(eco.rarityLuck)), lastShopRefresh: Date.now(), log: pushLog(s.log, `Échoppe rafraîchie (-${cost} or).`, 'gold') }
      persist(next)
      set(next)
    },

    buyShopItem: (itemId) => {
      const s = get()
      const item = s.shopStock.find((i) => i.id === itemId)
      if (!item) return
      const price = shopBuyPrice(item)
      if (s.gold < price) return
      const next = {
        ...s,
        gold: s.gold - price,
        shopStock: s.shopStock.filter((i) => i.id !== itemId),
        inventory: [item, ...s.inventory].slice(0, invMax),
        codex: discoverFromItems(s.codex, [item]),
        log: pushLog(s.log, `Acheté : ${item.name} (-${price} or).`, 'gold'),
      }
      persist(next)
      set(next)
    },

    mysteryBox: (id, opts = {}) => {
      const s = get()
      const box = MYSTERY_BOXES[id]
      if (!box || s.pendingChest || s.pendingChoice) return
      // Coffre du Jour : gratuit, mais un seul par fenêtre de 22 h.
      if (box.free && Date.now() - s.lastFreeBox < FREE_BOX_COOLDOWN_MS) return
      if (box.elementPick && !opts.element) return
      // Achat en gros : ×5 d'un coup → -10% d'or. (Pas de gros sur le gratuit / le Destin.)
      const qty = box.free || box.choice ? 1 : Math.max(1, Math.min(BOX_BULK_QTY, Math.round(opts.qty ?? 1)))
      // v0.25 : verrou rareté×raids — les hautes raretés exigent d'avoir raidé (Céleste+ = raid only).
      if (bestRaidTier(s.raidProgress) < boxRaidGate(box)) return
      const goldCost = Math.round(boxGoldPrice(box, s.bestStage) * qty * (qty >= BOX_BULK_QTY ? BOX_BULK_DISCOUNT : 1))
      const fragCost = (box.costFragments ?? 0) * qty
      const cosmicCost = (box.costCosmic ?? 0) * qty
      if (s.gold < goldCost || s.fragments < fragCost || s.cosmic < cosmicCost) return

      const ilvl = Math.max(1, stageIlvl(s.bestStage))
      // Karma du marchand 🍀 : la malchance accumulée gonfle la chance de jackpot, reset au proc.
      const pityBonus = Math.min(BOX_PITY_CAP, s.boxPity * BOX_PITY_STEP)
      let jackpotHit = false
      // Maillon Faible : cible l'emplacement le plus FAIBLE (vide ou au score le plus bas) du perso actif.
      const weakType = box.weakest ? weakestSlotType(s.characters[s.activeChar] ?? s.characters[0]) : undefined

      const rollOne = (): Item => {
        const proc = box.jackpot > 0 && Math.random() < Math.min(0.95, box.jackpot + pityBonus)
        if (proc) jackpotHit = true
        const rarity = rollBoxRarity(box.minTier, box.maxTier, proc ? 1 : 0)
        const type = weakType ?? box.type ?? (box.types ? box.types[Math.floor(Math.random() * box.types.length)] : undefined)
        return generateItem({
          ilvl, rarity, primaryBias: pickBias(s.characters),
          ...(box.primary ? { primary: box.primary } : {}),
          ...(type ? { type } : {}),
          ...(box.guaranteeAffix ? { forceStat: box.guaranteeAffix } : {}),
          ...(box.biasResist ? { biasResist: DAMAGE_TYPE_LIST[Math.floor(Math.random() * DAMAGE_TYPE_LIST.length)] } : {}),
          ...(opts.element ? { forceDmgType: opts.element, element: opts.element } : {}),
        })
      }

      const items: Item[] = []
      let cursedWins = 0
      let cursedFails = 0
      for (let q = 0; q < qty; q++) {
        if (box.cursed) {
          // Coffre Maudit 🎲 : pile, contenu doublé ; face, un seul objet Commun.
          if (Math.random() < CURSED_WIN_CHANCE) {
            cursedWins++
            for (let i = 0; i < box.count * 2; i++) items.push(rollOne())
          } else {
            cursedFails++
            items.push(generateItem({ ilvl, rarity: 'commun', primaryBias: pickBias(s.characters) }))
          }
        } else {
          for (let i = 0; i < box.count; i++) items.push(rollOne())
        }
      }
      // Collectionneur 📖 : l'objet porte un effet unique JAMAIS DÉCOUVERT (complète le Grimoire).
      if (box.collector && items.length) items[0].unique = undiscoveredUnique(s.codex)
      // Garantie d'unique : si aucun objet n'en a, on en pose un sur le meilleur.
      if (box.guaranteeUnique && !items.some((it) => it.unique)) {
        const best = items.reduce((a, b) => (RARITIES[b.rarity].tier > RARITIES[a.rarity].tier ? b : a), items[0])
        if (best) best.unique = randomUniqueInstance()
      }

      // Lapidaire 💎 : poussière de gemme scalée sur le record + chance de gemme de condition.
      const gemDustGain = box.gemDust ? Math.round(box.gemDust * (1 + s.bestStage / 50)) * qty : 0
      let gem: ChestReward['gem']
      if (box.gemChance && Math.random() < 1 - Math.pow(1 - box.gemChance, qty)) {
        const g = rollCondGem()
        gem = { id: g.id, rank: 1 }
      }

      // Le pity ne bouge que sur les coffres qui TIRENT des raretés (pas Trousseau/Lapidaire purs).
      const rolled = !box.cursed ? box.count > 0 : true
      const boxPity = rolled ? (jackpotHit ? 0 : s.boxPity + qty) : s.boxPity

      const extraCost = `${fragCost ? ` -${fragCost} ✨` : ''}${cosmicCost ? ` -${cosmicCost} 💫` : ''}`
      const bulk = qty > 1 ? ` ×${qty} (-10%)` : ''
      const cursedNote = box.cursed ? (cursedFails && !cursedWins ? ' 🎲 Maudit !' : cursedWins && !cursedFails ? ' 🎲 Malédiction déjouée : contenu doublé !' : ' 🎲 Fortunes mêlées.') : ''
      const logLine = box.free
        ? `🗓️ Coffre du Jour ouvert — reviens dans 22 h !`
        : `${box.name}${bulk} acheté (-${goldCost.toLocaleString('fr-FR')} or${extraCost}) !${cursedNote}`

      const base = {
        ...s,
        gold: s.gold - goldCost,
        fragments: s.fragments - fragCost,
        cosmic: s.cosmic - cosmicCost,
        boxPity,
        lastFreeBox: box.free ? Date.now() : s.lastFreeBox,
        log: pushLog(s.log, logLine, 'gold'),
      }
      // Coffre du Destin 🎭 : les objets partent dans le modal de CHOIX (un seul sera gardé).
      const next = box.choice
        ? { ...base, pendingChoice: { name: box.name, items } }
        : {
            ...base,
            pendingChest: {
              dungeonName: box.name, level: 0, items, gold: 0,
              sceaux: (box.sceaux ?? 0) * qty, orbes: (box.orbes ?? 0) * qty,
              eclats: (box.eclats ?? 0) * qty, noyau: (box.noyau ?? 0) * qty,
              poussiere: (box.poussiere ?? 0) * qty, fragments: (box.fragments ?? 0) * qty,
              gemDust: gemDustGain, gem,
            } satisfies ChestReward,
          }
      persist(next)
      set(next)
    },

    chooseFromChoice: (index) => {
      const s = get()
      const pc = s.pendingChoice
      if (!pc) return
      const chosen = pc.items[index]
      if (!chosen) return
      let essence = s.essence
      let poussiere = s.poussiere
      for (let i = 0; i < pc.items.length; i++) {
        if (i === index) continue
        essence += recycleValue(pc.items[i])
        poussiere += recyclePoussiere(pc.items[i])
      }
      const inventory = [chosen, ...s.inventory].slice(0, invMax)
      const next = {
        ...s, essence, poussiere, inventory,
        codex: discoverFromItems(s.codex, [chosen]),
        pendingChoice: null,
        log: pushLog(s.log, `🎭 Destin scellé : ${chosen.name} gardé, le reste recyclé en éclats.`, 'loot'),
      }
      persist(next)
      set(next)
    },

    recruitCharacter: () => {
      const s = get()
      if (s.characters.length >= 3) return
      const idx = s.characters.length - 1
      const cost = RECRUIT_COST[idx] ?? 250000
      const pous = RECRUIT_POUSSIERE[idx] ?? 0
      if (s.gold < cost || s.poussiere < pous) return
      const bias: OffensiveStat = s.characters.length === 1 ? 'agilite' : 'intelligence'
      const name = RECRUE_NAMES[idx] ?? 'Recrue'
      const characters = [...s.characters, makeCharacter(name, highestLevel(s.characters), bias)]
      const next = { ...s, gold: s.gold - cost, poussiere: s.poussiere - pous, characters, log: pushLog(s.log, `🧑‍🤝‍🧑 ${name} recruté(e) (-${cost} or${pous ? `, -${pous} 🌌` : ''}) !`, 'level') }
      persist(next)
      set(next)
    },

    reset: () => {
      const fresh = freshSave()
      localStorage.removeItem(SAVE_KEY)
      cooldowns.clear()
      refreshGlobals(fresh.upgrades)
      set({
        ...fresh,
        enemy: makeEnemy(fresh.stage, fresh.activeBiome),
        log: [{ id: logId++, text: 'Nouvelle partie commencée.', kind: 'info' }],
        killCount: 0,
        pendingOffline: null,
      } as GameState)
    },
  }
})

export { xpForLevel }
