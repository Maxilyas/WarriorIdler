import { create } from 'zustand'
import type {
  Equipment, Item, Affix, PrimaryStat, OffensiveStat, EquipSlotId, ItemType, Enemy, DamageType, RarityId, Character, PowerDef, EnemyAbility,
} from './types'
import { rollHit, incomingDps, genericMitigation } from './combat'
import type { DerivedStats } from './stats'
import {
  makeCharacter, charDerived, charMaxHp, charDamageProfile, charPassives,
  charResist, charCombatMods, abilityPower, computeUnlockedPowers, setGlobalCombatMods,
  talentPointsForLevel,
} from './character'
import { getTalent, canAllocate } from './talents'
import { getPower } from './powers'
import { getUpgrade, upgradeCost as accountUpgradeCost, upgradePoussiere, upgradeEclats, isMaxed, computeGlobalMods } from './upgrades'
import {
  generateItem, rollBoxRarity, sellValue, recycleValue, recyclePoussiere, itemScore,
  reforgeItem, surillvlItem, ascendItem,
  reforgeCost, surillvlCost, ascendCost, createCost, transmuteCost,
  enhanceTypedAffixes, quintRefund,
} from './items'
import { makeEnemy, isBossStage, stageIlvl, stageLuckTier } from './enemies'
import { BIOME_IDS, biomeUnlocked, getBiomeDef, type BiomeId } from './biomes'
import { RARITIES, RARITY_LIST } from './rarities'
import { SECONDARY_STATS } from './stats'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES, profileDamageMult, type DamageProfile } from './damage'
import { equipSlotsForType, slotAccepts } from './slots'
import { essenceGain, upgradeCost, insertCost, getUnique, UNIQUE_MAX_RANK, randomUniqueInstance } from './uniques'
import {
  generateDungeon, makeDungeonPack, dungeonIlvl, dungeonLuckTier, dungeonRegen, getDungeonDef, butinMinTier, butinMaxTier,
  DUNGEONS, type ActiveDungeon, type DungeonId,
} from './dungeons'
import {
  generateRaid, makeRaidBoss, makeRaidAdd, getRaidDef, raidUnlocked, raidBerserkTime,
  raidIlvl, raidMinTier, raidMaxTier, raidRarityDecay, raidRarityJackpot,
  raidLootCount, raidFragments, raidCosmicChance, raidCosmicQty, pickRaidLootType,
  RAIDS, type ActiveRaid, type RaidId,
} from './raids'
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

/** Suffixe de log « + 🔥3 + ❄️2 » pour un remboursement de Quintessences (vide si rien). */
function quintLogSuffix(refund: Partial<Record<DamageType, number>>): string {
  const parts: string[] = []
  for (const t in refund) {
    const v = refund[t as DamageType] ?? 0
    if (v > 0) parts.push(`${DAMAGE_TYPES[t as DamageType].icon}${v}`)
  }
  return parts.length ? ` + ${parts.join(' ')}` : ''
}

/** Chances de drop d'une Quintessence du biome actif selon le rang d'ennemi. */
const QUINT_DROP = { normal: 0.01, elite: 0.05, boss: 0.1 }

/**
 * Donjons = voie RENTABLE pour monter de niveau & farmer l'or. À CHAQUE combat gagné, l'équipe
 * gagne de l'XP (créditée tout de suite, gardée même si le run échoue) et de l'or (versé au coffre).
 * Multiplicateurs volontairement GÉNÉREUX (le levelling est lent par design) — à affiner.
 */
const DUNGEON_FIGHT_XP_MULT = 7 // ×XP de l'équipe par combat dans le Sanctuaire du Savoir (donjon d'XP)
/** Boost de l'XP du combat CLASSIQUE : recale le ratio donjon/classique (~×80 → ~×10). */
const CLASSIC_XP_MULT = 8

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
  essences: Record<string, number>
  sceaux: number
  dungeonProgress: DungeonProgress
  dungeon: ActiveDungeon | null
  pendingChest: ChestReward | null
  orbes: number
  fragments: number
  /** Éclat cosmique 💫 — ressource ultra-rare des raids. */
  cosmic: number
  raidProgress: RaidProgress
  raid: ActiveRaid | null
  /** Grimoire : ids des effets uniques déjà découverts. */
  codex: string[]
  /** Améliorations permanentes : id → niveau. */
  upgrades: Record<string, number>
  /** Stock de l'échoppe du marchand. */
  shopStock: Item[]
  inventory: Item[]
  /** Seuil de rareté (tier) pour vente/recyclage en masse + recyclage auto. Persisté. */
  recycleThreshold: number
  /** Recyclage automatique : tout butin sous le seuil est recyclé directement au drop. */
  autoRecycle: boolean
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
  createItem: (opts: CreateOptions) => void
  enterDungeon: (dungeonId: DungeonId, level: number, repeat?: number) => void
  abandonDungeon: () => void
  enterRaid: (raidId: RaidId, tier: number, repeat?: number) => void
  abandonRaid: () => void
  infuseUnique: (itemId: string) => void
  chooseUnique: (itemId: string, effectId: string) => void
  claimChest: () => void
  craftSceau: () => void
  setActiveChar: (index: number) => void
  setBias: (p: PrimaryStat) => void
  setPower: (slot: number, powerId: string | null) => void
  /** Bascule un emplacement de capacité entre AUTO et MANUEL (perso actif). */
  togglePowerAuto: (slot: number) => void
  /** Lance MANUELLEMENT la capacité d'un emplacement (perso actif) — strict : ne part qu'au prochain tick si prête. */
  castPower: (slot: number) => void
  allocateTalent: (nodeId: string) => void
  respecTalents: () => void
  buyUpgrade: (id: string) => void
  refreshShop: () => void
  buyShopItem: (itemId: string) => void
  buyEclats: (qty?: number) => void
  buyResource: (kind: 'sceau' | 'orbe', qty?: number) => void
  mysteryBox: (tier: number) => void
  recruitCharacter: () => void
  reset: () => void
}

let logId = 1
function pushLog(log: LogEntry[], text: string, kind: LogKind): LogEntry[] {
  return [{ id: logId++, text, kind }, ...log].slice(0, MAX_LOG)
}

function xpForLevel(level: number): number {
  // La courbe DOIT grandir exponentiellement, sinon le revenu d'XP (qui croît en 1.115^stage)
  // dépasse instantanément le coût d'un niveau → on prend des centaines de niveaux/seconde.
  //
  // Phase 1 (1→100) : coût qui suit la croissance du revenu (1.115/niveau, calé sur l'XP des
  //   ennemis). À progression régulière (~1 niveau par stage), le temps par niveau reste stable :
  //   1→90 se joue sur quelques heures, le 100 marque la fin de la montée « rapide ».
  // Phase 2 (100+) : soft cap. Croissance plus rapide que le revenu (1.17 > 1.115) → chaque niveau
  //   coûte strictement plus que ce qu'un stage de plus rapporte, donc la montée ralentit sans cesse
  //   (heures, puis jours par niveau en fin de course).
  if (level <= 100) return Math.round(50 * Math.pow(1.115, level - 1))
  const at100 = 50 * Math.pow(1.115, 99)
  return Math.round(at100 * Math.pow(1.17, level - 100))
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
    essences: {},
    sceaux: 0,
    dungeonProgress: emptyDungeonProgress(),
    dungeon: null,
    pendingChest: null,
    orbes: 0,
    fragments: 0,
    cosmic: 0,
    raidProgress: emptyRaidProgress(),
    raid: null,
    codex: [],
    upgrades: {},
    shopStock: [],
    inventory: [],
    recycleThreshold: 4,
    autoRecycle: false,
    lastSeen: Date.now(),
    lastShopRefresh: 0,
  }
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
  if (typeof save.recycleThreshold !== 'number') save.recycleThreshold = 4
  if (typeof save.autoRecycle !== 'boolean') save.autoRecycle = false
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
  // Raid en cours au format obsolète (pas de `raidId`) → abandonné par la migration.
  if (save.raid && !(save.raid as { raidId?: string }).raidId) save.raid = null

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
    essences: s.essences,
    sceaux: s.sceaux,
    dungeonProgress: s.dungeonProgress,
    dungeon: s.dungeon,
    pendingChest: s.pendingChest,
    orbes: s.orbes,
    fragments: s.fragments,
    cosmic: s.cosmic,
    raidProgress: s.raidProgress,
    raid: s.raid,
    codex: s.codex,
    upgrades: s.upgrades,
    shopStock: s.shopStock,
    inventory: s.inventory,
    recycleThreshold: s.recycleThreshold,
    autoRecycle: s.autoRecycle,
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
// L'or est désormais rare (le combat classique n'en donne presque plus) → ces taux sont de vrais puits.
export const EXCHANGE_RATES = { eclatsBatch: 100, eclatGoldCost: 1500, sceauGold: 8000, orbeGold: 25000 }
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
  /** Biaise vers des résistances (stuff défensif). */
  biasResist?: boolean
  /** Garantit au moins un effet unique. */
  guaranteeUnique?: boolean
  eclats?: number
  noyau?: number
  poussiere?: number
  fragments?: number
  /** Coût SUPPLÉMENTAIRE en ressources de raid (les coffres d'élite ne s'achètent pas qu'avec de l'or). */
  costFragments?: number
  costCosmic?: number
  desc: string
}

/**
 * 10 coffres mystères avec une distribution de rareté (pas une rareté fixe) + une petite
 * chance de JACKPOT (raretés au-dessus de la fourchette) → on peut toujours rêver mieux.
 * Échelle de prix de 500 or à 10M.
 */
export const MYSTERY_BOXES: MysteryBox[] = [
  { id: 0, name: 'Coffre de bronze', icon: '🥉', gold: 500, count: 2, minTier: 2, maxTier: 5, jackpot: 0.02, desc: 'Petit pari. Commun → Épique.' },
  { id: 1, name: 'Coffre d\'argent', icon: '🥈', gold: 5000, count: 3, minTier: 3, maxTier: 6, jackpot: 0.03, eclats: 150, desc: 'Inhabituel → Légendaire + éclats.' },
  { id: 2, name: 'Coffre d\'or', icon: '🥇', gold: 30000, count: 3, minTier: 4, maxTier: 8, jackpot: 0.04, eclats: 400, noyau: 1, desc: 'Rare → Patrimoine + ressources.' },
  { id: 3, name: 'Arsenal', icon: '⚔️', gold: 60000, count: 2, minTier: 5, maxTier: 9, jackpot: 0.05, type: 'armePrincipale', desc: 'Cible des ARMES. Épique → Mythique.' },
  { id: 4, name: 'Coffre du gardien', icon: '🛡️', gold: 60000, count: 3, minTier: 5, maxTier: 9, jackpot: 0.05, biasResist: true, desc: 'Stuff défensif/résistances. Épique → Mythique.' },
  { id: 5, name: 'Coffre légendaire', icon: '🟠', gold: 150000, count: 4, minTier: 6, maxTier: 10, jackpot: 0.06, eclats: 600, noyau: 2, desc: 'Légendaire → Ascendant + ressources.' },
  { id: 6, name: 'Coffre du forgeron', icon: '🔨', gold: 400000, count: 1, minTier: 7, maxTier: 11, jackpot: 0.05, eclats: 3000, noyau: 12, poussiere: 8, desc: 'Matériaux de craft en MASSE + 1 objet.' },
  { id: 7, name: 'Coffre mythique', icon: '🔴', gold: 800000, count: 4, minTier: 8, maxTier: 12, jackpot: 0.07, eclats: 1500, noyau: 5, poussiere: 3, costFragments: 2, desc: 'Mythique → Éternel. Exige des Fragments de raid.' },
  { id: 8, name: 'Coffre cosmique', icon: '🌟', gold: 2500000, count: 5, minTier: 10, maxTier: 14, jackpot: 0.09, guaranteeUnique: true, eclats: 4000, noyau: 10, poussiere: 12, fragments: 2, costFragments: 6, desc: 'Ascendant → Abyssal, 1 unique garanti. Exige des Fragments.' },
  { id: 9, name: 'Coffre du Néant', icon: '🕳️', gold: 10000000, count: 6, minTier: 12, maxTier: 16, jackpot: 0.13, guaranteeUnique: true, eclats: 10000, noyau: 25, poussiere: 35, fragments: 8, costFragments: 18, costCosmic: 3, desc: 'Le pari ultime : exige Fragments ✨ ET Éclats cosmiques 💫 (donc des raids).' },
]

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
function fireActive(p: PowerDef, caster: Character, derived: DerivedStats, profile: DamageProfile, chars: Character[], enemy: Enemy, hotBonus: number): number {
  const base = (p.magnitude ?? 1) * abilityPower(derived, p.scaleStat) // soins / boucliers (sans profil)
  const magDmg = base * profileDamageMult(profile) // dégâts : scalent sur le profil de l'arme
  const vm = enemyVuln(enemy)
  const hit = (dmg: number): number => { const before = enemy.hp; enemy.hp = Math.max(0, enemy.hp - dmg); return before - enemy.hp }
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
      return 0
    }
    case 'bigHeal':
      for (const a of chars) if (a.hp > 0) a.hp = Math.min(charMaxHp(a), a.hp + base * (1 + hotBonus))
      return 0
    case 'buffParty':
      for (const a of chars) if (a.hp > 0) a.hp = Math.min(charMaxHp(a), a.hp + base * 0.5 * (1 + hotBonus))
      return 0
    case 'shield':
      caster.hp = Math.min(charMaxHp(caster), caster.hp + base)
      return 0
    case 'bigShield':
      // Énorme bouclier d'absorption (soaké avant les PV) + 40% à l'équipe.
      caster.absorb = (caster.absorb ?? 0) + base
      for (const a of chars) if (a.hp > 0 && a !== caster) a.absorb = (a.absorb ?? 0) + base * 0.4
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
  cmods: { flatDr: number }
}

/** Applique l'effet d'une technique ennemie à un héros cible (déjà atténué par résist + Purge). */
function applyEnemyAbility(ab: EnemyAbility, enemy: Enemy, t: Character, ctx: AbilityCtx) {
  const resist = ctx.resist[ab.element] ?? 0
  const purge = ctx.derived.purge
  const extra = (1 - ctx.passives.damageReduction) * (1 - ctx.cmods.flatDr)
  switch (ab.kind) {
    case 'dot': {
      // DoT : ignore armure/esquive, mais réduit par la RÉSISTANCE du type et la PURGE (intensité + durée).
      const dps = Math.max(0, enemy.damage * ab.magnitude * (1 - resist) * (1 - purge))
      const remaining = (ab.duration ?? 4) * (1 - purge * 0.5)
      if (dps > 0) t.dots = [...(t.dots ?? []), { dps, type: ab.element, remaining }]
      break
    }
    case 'burst':
    case 'drain': {
      // Coup unique télégraphié : atténué comme une attaque (résist + esquive/réduction + barrière via PV),
      // puis passé par l'immunité/bouclier d'absorption du héros.
      const dmg = incomingDps(enemy.damage * ab.magnitude, ab.element, ctx.derived, ctx.resist, extra)
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

/** Fait progresser les techniques d'un ennemi (cooldown + télégraphe) et applique celles qui tombent. */
function tickEnemyAbilities(enemy: Enemy, chars: Character[], info: (AbilityCtx | null)[], dt: number) {
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
        if (ab.telegraph && ab.telegraph > 0) ab.cast = ab.telegraph
        else { applyEnemyAbility(ab, enemy, t, ctx); ab.cd = ab.cooldown }
      }
    }
  }
}

/** Décompte des statuts transitoires du héros (étourdissement, malédiction, DoT subis). */
function tickHeroStatuses(chars: Character[], dt: number) {
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

  let totalDealt = 0

  // 1) Attaques automatiques (+ Multifrappe) + DoT (keystone). Les persos étourdis n'attaquent pas.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    const hits = d.derived.attacksPerSecond * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    // Malédiction (debuff ennemi) réduit les dégâts ; Frénésie (« Furie sanguinaire ») les amplifie.
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole && enemy.hp > 0; h++) {
      // Multifrappe : chance de déclencher un coup supplémentaire.
      const strikes = 1 + (Math.random() < multistrikeChance ? 1 : 0)
      for (let s = 0; s < strikes && enemy.hp > 0; s++) {
        const hit = rollHit(d.derived, d.profile, enemy, { bonusMult, execute: d.cmods.execute })
        const dmg = hit.damage * enemyVuln(enemy) // Sceau de faiblesse amplifie aussi les auto-attaques
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
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr))
        manualFire.delete(key)
        const dealt = fireActive(p, c, d.derived, d.profile, chars, enemy, d.cmods.hot)
        // Vengeance différée : compte AUSSI les dégâts des sorts dans le cumul.
        if (c.charge && dealt > 0) c.charge.dealt += dealt
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
    // dans incomingDps → on encaisse toujours une part. Les résistances de type restent décisives.
    let incoming = incomingDps(
      effDmg, enemy.damageType, td.derived, td.resist,
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
    ) * dt
    if (mods?.reflect) incoming += totalDealt * mods.reflect
    // Immunité / bouclier d'absorption du héros (Phase éthérée, Égide titanesque).
    damageHero(t, incoming)
    // Épines (thorns) : renvoie une fraction de l'attaque à l'ennemi (basée sur le coup, bouclier inclus).
    if (td.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - incoming * td.cmods.thorns)
  }

  // 4b) Techniques signature de l'ennemi (DoT/burst/CC/debuff/drain) sur la plus haute menace.
  tickEnemyAbilities(enemy, chars, info, dt)

  // 5) Régénération de l'ennemi (Vampirique) — annulée par « Hémorragie cosmique ».
  if (mods?.regen && enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 6) Régénération des persos (+ bonus de régén) + clamp.
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      c.hp = Math.min(mh, c.hp + mh * REGEN_RATE * (1 + d.derived.regenBonus) * regenMult * dt)
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemy, anyAlive: chars.some((c) => c.hp > 0), totalDealt }
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
  tickHeroStatuses(chars, dt)
  const info = chars.map((c) =>
    c.hp > 0
      ? { derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c), resist: charResist(c), cmods: charCombatMods(c) }
      : null,
  )
  let totalDealt = 0
  const focus = (): Enemy | undefined => enemies.find((e) => e.hp > 0)

  // 1) Auto-attaques (+ Multifrappe) sur la cible focus + DoT keystone. Étourdi = pas d'attaque.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    const hits = d.derived.attacksPerSecond * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole; h++) {
      const target = focus()
      if (!target) break
      const strikes = 1 + (Math.random() < multistrikeChance ? 1 : 0)
      for (let st = 0; st < strikes; st++) {
        const t2 = focus()
        if (!t2) break
        const hit = rollHit(d.derived, d.profile, t2, { bonusMult, execute: d.cmods.execute })
        const dmg = hit.damage * enemyVuln(t2)
        t2.hp = Math.max(0, t2.hp - dmg)
        totalDealt += dmg
        dealtThis += dmg
        healed += hit.heal
        if (d.cmods.dot) t2.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
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
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr))
        manualFire.delete(key)
        let dealt = 0
        if (p.effect === 'cleave' || p.effect === 'megaCleave') {
          for (const e of enemies) if (e.hp > 0) dealt += fireActive(p, c, d.derived, d.profile, chars, e, d.cmods.hot)
        } else {
          dealt = fireActive(p, c, d.derived, d.profile, chars, focus() ?? enemies[0], d.cmods.hot)
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
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
    ) * dt
    if (mods?.reflect && !reflectApplied) { incoming += totalDealt * mods.reflect; reflectApplied = true }
    // Immunité / bouclier d'absorption du héros (Phase éthérée, Égide titanesque).
    damageHero(t, incoming)
    if (td.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - incoming * td.cmods.thorns)
    // Techniques signature de CET ennemi (sur la plus haute menace).
    tickEnemyAbilities(enemy, chars, info, dt)
  }

  // 5) Régénération ennemie (Vampirique/Sangsue) — annulée par « Hémorragie cosmique ».
  if (mods?.regen) for (const enemy of enemies) if (enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 6) Régénération des persos + clamp.
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      c.hp = Math.min(mh, c.hp + mh * REGEN_RATE * (1 + d.derived.regenBonus) * regenMult * dt)
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemies, anyAlive: chars.some((c) => c.hp > 0), totalDealt }
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

  const res = partyCombatStepMulti(s.characters, d.enemies, dt, { enrage, reflect, regen, fightTime })
  let chars = res.chars
  const enemies = res.enemies
  let log = s.log

  if (!res.anyAlive) {
    const healed = chars.map(fullHeal)
    log = pushLog(log, `💀 Échec dans ${d.name} ! L'équipe bat en retraite.`, 'death')
    const next = { ...s, characters: healed, dungeon: null, log }
    persist(next)
    set(next)
    return
  }

  if (enemies.every((e) => e.hp <= 0)) {
    const eco = computeGlobalMods(s.upgrades)
    const lv = d.level
    const packXp = enemies.reduce((a, e) => a + (e.xp ?? 0), 0)
    const noGold = d.modifiers.some((m) => m.noGold)

    // --- Récompense PAR COMBAT (chaque combat gagné crédite la ressource du donjon, tout de suite) ---
    let gold = s.gold, essence = s.essence, noyau = s.noyau, poussiere = s.poussiere, sceaux = s.sceaux, orbes = s.orbes
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
    switch (def.reward) {
      case 'gold': { if (!noGold) { const g = Math.round(packXp * 8 * eco.goldGain); gold += g; logBit = `+${g.toLocaleString('fr-FR')} or` } break }
      case 'eclats': { const e2 = Math.round(packXp * 4); essence += e2; logBit = `+${e2.toLocaleString('fr-FR')} éclats` } break
      case 'noyau': { const n = accrue('noyau', packXp * 0.05); if (n) { noyau += n; logBit = `+${n} 💠` } } break
      case 'poussiere': { const pq = accrue('poussiere', packXp * 0.015); if (pq) { poussiere += pq; logBit = `+${pq} 🌌` } } break
      case 'sceaux': { const sc = accrue('sceaux', packXp * 0.025); if (sc) { sceaux += sc; logBit = `+${sc} 🔑` } } break
      case 'orbes': { const ob = accrue('orbes', packXp * 0.015); if (ob) { orbes += ob; logBit = `+${ob} 🔮` } } break
      case 'xp': {
        const xp = Math.round(packXp * DUNGEON_FIGHT_XP_MULT * eco.xpGain)
        chars = chars.map((c) => { if (c.hp <= 0) return c; const nc = grantXp(c, xp); if (nc.level > c.level) leveled = true; return nc })
        earned.xp = (earned.xp ?? 0) + xp
        logBit = `+${xp.toLocaleString('fr-FR')} XP`
        break
      }
      case 'stuff': { if (Math.random() < 0.4) { fightItems.push(generateItem({ ilvl: dungeonIlvl(lv), luckTier: dungeonLuckTier(lv), primaryBias: pickBias(s.characters) })); logBit = '+1 objet' } break }
    }
    log = pushLog(log, `⚔️ ${def.icon} Combat ${d.current + 1}/${d.totalFights}${logBit ? ` · ${logBit}` : ''}.`, 'kill')
    if (leveled) log = pushLog(log, '⬆ Niveau gagné !', 'level')

    let inventory = s.inventory
    for (const it of fightItems) inventory = [it, ...inventory].slice(0, invMax)
    const codex = fightItems.length ? discoverFromItems(s.codex, fightItems) : s.codex

    const nextIndex = d.current + 1
    if (nextIndex >= d.totalFights) {
      const rareBonus = d.modifiers.reduce((a, m) => a + (m.rareBonus ?? 0), 0)
      const bias = pickBias(s.characters)

      // --- Coffre : BONUS de fin (montant ÉLEVÉ) de la ressource du donjon, EN PLUS du par-combat ---
      let items: Item[] = []
      let cGold = 0, cEclats = 0, cNoyau = 0, cPous = 0, cSceaux = 0, cOrbes = 0, cXp = earned.xp ?? 0
      switch (def.reward) {
        case 'gold': cGold = noGold ? 0 : Math.round(2000 * lv * (1 + lv * 0.15)); break
        case 'eclats': cEclats = Math.round(1200 * lv * (1 + lv * 0.13)); break
        case 'noyau': cNoyau = Math.round(48 * lv * (1 + lv * 0.1)); break // ×4
        case 'orbes': cOrbes = Math.round(1 + lv * 0.5); break
        case 'sceaux': cSceaux = Math.round(3 + lv * 0.9); break
        case 'poussiere': { // ×2
          const base = 2 * (1 + Math.floor(lv / 3))
          const bonusChance = Math.min(0.9, 0.25 + lv * 0.03)
          cPous = base + (Math.random() < bonusChance ? 2 + Math.floor(Math.random() * 3) : 0)
          break
        }
        case 'xp': { const bonus = Math.round(1200 * lv * Math.pow(1.12, lv)); chars = chars.map((c) => (c.hp > 0 ? grantXp(c, bonus) : c)); cXp += bonus; break }
        case 'stuff': {
          const ilvl = dungeonIlvl(lv)
          const count = 3 + Math.floor(lv / 2)
          const minTier = Math.min(14, butinMinTier(lv) + rareBonus)
          const maxTier = Math.min(16, butinMaxTier(lv) + rareBonus)
          for (let i = 0; i < count; i++) {
            const rarity = rollBoxRarity(minTier, maxTier, Math.min(0.25, 0.05 + lv * 0.01), 0.6)
            items.push(generateItem({ ilvl, rarity, primaryBias: bias }))
          }
          break
        }
      }
      const chest: ChestReward = { dungeonName: d.name, level: lv, items, eclats: cEclats, noyau: cNoyau, gold: cGold, sceaux: cSceaux, orbes: cOrbes, poussiere: cPous, xp: cXp }

      const healed: Character[] = chars.map(fullHeal)
      const dungeonProgress = { ...s.dungeonProgress, [d.dungeonId]: Math.max(s.dungeonProgress[d.dungeonId] ?? 0, lv) }
      const repeatLeft = d.repeatLeft ?? 0
      // État avec les pools PAR COMBAT déjà crédités (le coffre est un bonus en plus).
      const base = { ...s, gold, essence, noyau, poussiere, sceaux, orbes, inventory, codex }

      // Auto-farm : on encaisse le coffre directement (sans modal) et on relance.
      if (repeatLeft > 0) {
        const credited = applyChestRewards(base, chest)
        if (credited.sceaux >= def.sceauCost) {
          const ndun = generateDungeon(d.dungeonId, lv)
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
    const next = { ...s, characters: chars, gold, essence, noyau, poussiere, sceaux, orbes, inventory, codex, dungeon: nd, log }
    persist(next)
    set(next)
    return
  }

  set({ ...s, characters: chars, dungeon: { ...d, enemies, fightTime }, log })
}

/** Dégâts de zone (Nova/adds) sur l'équipe, typés et atténués par chaque perso. */
function applyAoe(chars: Character[], baseDmg: number, type: DamageType): Character[] {
  return chars.map((c) => {
    if (c.hp <= 0) return c
    const d = charDerived(c)
    const p = charPassives(c)
    const cm = charCombatMods(c)
    const resist = charResist(c)[type] ?? 0
    // Même plafond d'atténuation que les coups normaux (pas d'invincibilité face aux Novas).
    const dmg = baseDmg * (1 - resist) * genericMitigation(d, (1 - p.damageReduction) * (1 - cm.flatDr))
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
  // Acharnement : le boss frappe plus fort à mesure qu'il agonise.
  const bossIn = r.enemies[0]
  if (mech.includes('execute')) dmgMult *= 1 + (1 - bossIn.hp / Math.max(1, bossIn.maxHp)) * 0.7

  const res = partyCombatStepMulti(s.characters, r.enemies, dt, { enrage, regen: drain, fightTime, dmgMult })
  let chars = res.chars
  let enemies = res.enemies
  const boss = enemies[0]
  let log = s.log
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
    boss.damageType = element
    log = pushLog(log, `🌈 ${boss.name} bascule en ${DAMAGE_TYPES[element].name} !`, 'info')
  }
  // Nova cataclysmique : grosse AoE typée (check d'EHP/mitigation).
  if (mech.includes('nova') && novaCd <= 0) {
    novaCd = 6
    chars = applyAoe(chars, boss.damage * 4 * def.baseDifficulty, element)
    log = pushLog(log, `☄️ ${boss.name} déchaîne une Nova ${DAMAGE_TYPES[element].name} !`, 'death')
  }
  // Déferlante : fait SURGIR des renforts réels (combat à plusieurs adversaires), plafonnés.
  if (mech.includes('swarm') && swarmCd <= 0) {
    swarmCd = 5
    const liveAdds = enemies.filter((e) => e.add && e.hp > 0).length
    const toSpawn = Math.max(0, Math.min(2, 3 - liveAdds))
    for (let k = 0; k < toSpawn; k++) enemies.push(makeRaidAdd(def, r.tier, element))
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
    const healed = chars.map(fullHeal)
    const why = mech.includes('berserk') && overtime > 0 ? ' (enrage mortel — il fallait plus de DPS)' : ''
    log = pushLog(log, `💀 Raid échoué : ${r.name}${why}. L'équipe est anéantie.`, 'death')
    const next = { ...s, characters: healed, raid: null, log }
    persist(next)
    set(next)
    return
  }

  if (boss.hp <= 0) {
    const nextIndex = r.current + 1
    if (nextIndex >= r.totalBosses) {
      const tier = r.tier
      const ilvl = raidIlvl(def, tier)
      const minTier = raidMinTier(def, tier)
      const maxTier = raidMaxTier(def, tier)
      const decay = raidRarityDecay(def, tier)
      const jackpot = raidRarityJackpot(def, tier)
      const count = raidLootCount(def, tier)
      const bias = pickBias(s.characters)
      const items: Item[] = []
      for (let i = 0; i < count; i++) {
        const lootType = pickRaidLootType(def)
        // Rareté en éventail : plancher garanti → plafond, décalée vers le haut avec le tier.
        const rarity = rollBoxRarity(minTier, maxTier, jackpot, decay)
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
      const repeatLeft = r.repeatLeft ?? 0

      // Auto-raid : s'il reste des relances ET assez d'Orbes, on encaisse le trésor et on relance.
      if (repeatLeft > 0) {
        const credited = applyChestRewards(s, chest)
        if (credited.orbes >= def.orbeCost) {
          const nr = generateRaid(r.raidId, tier)
          nr.repeatLeft = repeatLeft - 1
          const log3 = pushLog(log, `🔁 Auto-raid : trésor encaissé${cosmic ? ` (💫 ×${cosmic})` : ''} · ${repeatLeft} relance${repeatLeft > 1 ? 's' : ''} restante${repeatLeft > 1 ? 's' : ''}.`, 'kill')
          const next = { ...s, ...credited, characters: healed, raidProgress, orbes: credited.orbes - def.orbeCost, raid: nr, log: log3 }
          persist(next)
          set(next)
          return
        }
      }

      log = pushLog(log, `🏆 RAID VAINCU : ${def.name} (Tier ${tier}) !${cosmic ? ` 💫 Éclat cosmique ×${cosmic} !` : ''} Un trésor t'attend.`, 'kill')
      const next = { ...s, characters: healed, raid: null, raidProgress, pendingChest: chest, log }
      persist(next)
      set(next)
      return
    }
    const startEl = r.rotateList[0]
    const nr: ActiveRaid = {
      ...r,
      current: nextIndex,
      enemies: [makeRaidBoss(def, r.tier, nextIndex, startEl)],
      element: startEl,
      rotateIdx: 0,
      fightTime: 0,
      novaCd: 6,
      swarmCd: 5,
      rotateCd: 8,
      berserkAt: raidBerserkTime(def, r.tier),
    }
    log = pushLog(log, `${def.name} — boss ${nextIndex + 1}/${r.totalBosses} !`, 'info')
    const next = { ...s, characters: chars, raid: nr, log }
    persist(next)
    set(next)
    return
  }

  set({ ...s, characters: chars, raid: { ...r, enemies, fightTime, novaCd, swarmCd, rotateCd, element, rotateIdx }, log })
}

/** Deltas d'état d'un coffre (ressources + inventaire + codex). XP exclue (déjà créditée par combat). */
function applyChestRewards(s: GameState, c: ChestReward): Pick<GameState, 'inventory' | 'codex' | 'essence' | 'noyau' | 'poussiere' | 'cosmic' | 'gold' | 'sceaux' | 'orbes' | 'fragments'> {
  let inventory = s.inventory
  for (const it of c.items) inventory = [it, ...inventory].slice(0, invMax)
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

  return {
    ...save,
    enemy: makeEnemy(save.stage, save.activeBiome),
    log: [{ id: logId++, text: 'Bienvenue, guerrier. Le combat commence.', kind: 'info' }],
    killCount: 0,
    pendingOffline,

    tick: (dt) => {
      let s = get()
      // Échoppe : rotation sur timer réel (1 h), indépendante du combat. Se déclenche aussi
      // pendant un donjon/raid → on rafraîchit AVANT de déléguer.
      if (Date.now() - (s.lastShopRefresh ?? 0) >= SHOP_INTERVAL_MS) {
        const eco = computeGlobalMods(s.upgrades)
        s = { ...s, shopStock: generateShop(s.bestStage, Math.floor(eco.rarityLuck)), lastShopRefresh: Date.now() }
        persist(s)
      }
      if (s.raid) {
        tickRaid(s, dt, set)
        return
      }
      if (s.dungeon) {
        tickDungeon(s, dt, set)
        return
      }

      const res = partyCombatStep(s.characters, s.enemy, dt)
      let chars = res.chars
      const enemy = res.enemy
      let log = s.log

      if (!res.anyAlive) {
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
        const eco = computeGlobalMods(s.upgrades)
        // Le combat CLASSIQUE n'est plus qu'un filet d'or/butin : la vraie source = donjons & raids.
        const goldGain = Math.round(enemy.xp * 0.12 * eco.goldGain)
        const xpGain = Math.round(enemy.xp * eco.xpGain * CLASSIC_XP_MULT)
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
        if (elite) log = pushLog(log, '◆ Élite vaincue : butin supérieur !', 'kill')
        // Moins d'objets en combat classique (le farm de stuff se fait en donjon/raid).
        const drops = (boss ? 2 : Math.random() < 0.30 + eco.lootChance ? 1 : 0) + (elite ? 1 : 0)
        const bias = pickBias(chars)
        const luck = stageLuckTier(stage) + (boss ? 1 : 0) + (elite ? 3 : 0) + Math.floor(eco.rarityLuck)
        let codex = s.codex
        let autoRec = 0
        for (let dd = 0; dd < drops; dd++) {
          // Identité de loot du biome : ~50% dégâts de l'élément, ~25% résistance à l'élément, ~25% neutre.
          const br = Math.random()
          const biomeOpts = br < 0.5 ? { forceDmgType: s.activeBiome } : br < 0.75 ? { biasResist: s.activeBiome } : {}
          const it = generateItem({ ilvl: stageIlvl(stage), luckTier: luck, primaryBias: bias, ...biomeOpts })
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

        // Quintessence élémentaire : ressource ultra-rare du biome (type = celui des monstres).
        // 1% sur un ennemi normal, 5% sur une élite, 10% sur un boss. Farm continu et patient.
        let quint = s.quint
        {
          const qChance = boss ? QUINT_DROP.boss : elite ? QUINT_DROP.elite : QUINT_DROP.normal
          if (Math.random() < qChance) {
            const t = s.activeBiome
            quint = { ...quint, [t]: (quint[t] ?? 0) + 1 }
            log = pushLog(log, `${DAMAGE_TYPES[t].icon} Quintessence de ${DAMAGE_TYPES[t].name} récoltée ! (ultra-rare)`, 'loot')
          }
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
        if (isBossStage(stage)) log = pushLog(log, `⚔ Un boss vous barre la route : ${enemyNext.name} !`, 'info')

        const next = { ...s, characters, stage, bestStage, biomeBest, gold, sceaux, poussiere, quint, essence, codex, inventory, enemy: enemyNext, log, killCount: s.killCount + 1 }
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
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(s.log, `Vendu : ${item.name} (+${gain} or).`, 'gold'),
      }
      persist(next)
      set(next)
    },

    recycle: (itemId) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item) return
      const gain = Math.round(recycleValue(item) * computeGlobalMods(s.upgrades).eclatGain)
      const pous = recyclePoussiere(item)
      const refund = quintRefund(item)
      const essences = { ...s.essences }
      let essLog = ''
      if (item.unique) {
        const eg = essenceGain(RARITIES[item.rarity].tier, item.unique.rank)
        essences[item.unique.id] = (essences[item.unique.id] ?? 0) + eg
        essLog = ` + ${eg} essences de ${getUnique(item.unique.id)?.name ?? 'l\'effet'}`
      }
      const qLog = quintLogSuffix(refund)
      const next = {
        ...s,
        essence: s.essence + gain,
        poussiere: s.poussiere + pous,
        quint: addQuint(s.quint, refund),
        essences,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(s.log, `Recyclé : ${item.name} (+${gain} éclats${pous ? ` + ${pous} 🌌` : ''}${qLog}${essLog}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    sellAllBelow: (tier) => {
      const s = get()
      let gold = s.gold
      let count = 0
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier) {
          gold += sellValue(item)
          count++
        } else keep.push(item)
      }
      const gained = gold - s.gold
      const next = { ...s, gold, inventory: keep, log: count ? pushLog(s.log, `${count} objet(s) vendu(s) (+${gained} or).`, 'gold') : s.log }
      persist(next)
      set(next)
    },

    recycleAllBelow: (tier) => {
      const s = get()
      let essence = s.essence
      let poussiere = s.poussiere
      let quint = s.quint
      let count = 0
      const essences = { ...s.essences }
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier) {
          essence += recycleValue(item)
          poussiere += recyclePoussiere(item)
          quint = addQuint(quint, quintRefund(item))
          if (item.unique) essences[item.unique.id] = (essences[item.unique.id] ?? 0) + essenceGain(RARITIES[item.rarity].tier, item.unique.rank)
          count++
        } else keep.push(item)
      }
      const gained = essence - s.essence
      const next = { ...s, essence, poussiere, quint, essences, inventory: keep, log: count ? pushLog(s.log, `${count} objet(s) recyclé(s) (+${gained} éclats).`, 'craft') : s.log }
      persist(next)
      set(next)
    },

    reforge: (itemId, locked) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item) return
      const cost = reforgeCost(item)
      if (s.essence < cost) return
      // Les lignes renforcées à la Quintessence sont protégées (jamais re-tirées).
      const enhanced = item.affixes.map((a, i) => ((a.upgraded ?? 0) > 0 ? i : -1)).filter((i) => i >= 0)
      const allLocked = [...new Set([...locked, ...enhanced])]
      const upd = applyItemPatch(s, itemId, { affixes: reforgeItem(item, allLocked) })
      if (!upd) return
      const next = { ...s, ...upd, essence: s.essence - cost, log: pushLog(s.log, `Reforge : ${item.name} (-${cost} éclats).`, 'craft') }
      persist(next)
      set(next)
    },

    surillvl: (itemId) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item) return
      const cost = surillvlCost(item)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, surillvlItem(item))
      if (!upd) return
      const next = { ...s, ...upd, essence: s.essence - cost, log: pushLog(s.log, `Surillvl : ${item.name} → iLvl ${item.ilvl + 2} (-${cost} éclats).`, 'craft') }
      persist(next)
      set(next)
    },

    ascend: (itemId) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item) return
      const patch = ascendItem(item)
      if (!patch) return
      const cost = ascendCost(item)
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < (cost.fragments ?? 0) || s.poussiere < (cost.poussiere ?? 0) || s.cosmic < (cost.cosmic ?? 0)) return
      const upd = applyItemPatch(s, itemId, patch)
      if (!upd) return
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        fragments: s.fragments - (cost.fragments ?? 0),
        poussiere: s.poussiere - (cost.poussiere ?? 0),
        cosmic: s.cosmic - (cost.cosmic ?? 0),
        log: pushLog(s.log, `Ascension : ${item.name} → ${RARITIES[patch.rarity!].name} ! (-${cost.noyau} Noyau)`, 'craft'),
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
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        essences,
        log: pushLog(s.log, `Effet amélioré : ${getUnique(item.unique.id)?.name ?? ''} → rang ${rank + 1} !`, 'craft'),
      }
      persist(next)
      set(next)
    },

    transmute: (itemId, newPrimary) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item || item.primary === newPrimary) return
      const cost = transmuteCost(item)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, { primary: newPrimary })
      if (!upd) return
      const next = { ...s, ...upd, essence: s.essence - cost, log: pushLog(s.log, `Affinité transmutée : ${item.name} → ${newPrimary} (-${cost} éclats).`, 'craft') }
      persist(next)
      set(next)
    },

    enhanceTyped: (itemId, type, kind) => {
      const s = get()
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
      const next = {
        ...s,
        ...upd,
        quint: { ...s.quint, [type]: have - res.cost },
        log: pushLog(s.log, `${m.icon} Ligne ${kind === 'resist' ? 'Résist.' : 'Dégâts'} ${m.name} ${verb} (-${res.cost} Quintessence).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    createItem: (opts) => {
      const s = get()
      const tier = RARITIES[opts.rarity].tier
      const ilvl = stageIlvl(s.bestStage)
      const cost = createCost(tier, ilvl)
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < (cost.fragments ?? 0) || s.poussiere < (cost.poussiere ?? 0) || s.cosmic < (cost.cosmic ?? 0)) return
      const item = generateItem({ ilvl, type: opts.type, rarity: opts.rarity, primary: opts.primary, ...(opts.orientation ? { orientation: opts.orientation } : {}), ...(opts.element ? { element: opts.element } : {}) })
      const inventory = [item, ...s.inventory].slice(0, invMax)
      const next = {
        ...s,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        fragments: s.fragments - (cost.fragments ?? 0),
        poussiere: s.poussiere - (cost.poussiere ?? 0),
        cosmic: s.cosmic - (cost.cosmic ?? 0),
        inventory,
        codex: discoverFromItems(s.codex, [item]),
        log: pushLog(s.log, `Forgé : ${item.name} (${RARITIES[opts.rarity].name}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    enterDungeon: (dungeonId, level, repeat = 1) => {
      const s = get()
      if (s.dungeon || s.raid) return
      const def = getDungeonDef(dungeonId)
      if (!def || s.bestStage < def.unlockStage) return
      if (s.sceaux < def.sceauCost) return
      if (level < 1 || level > (s.dungeonProgress[dungeonId] ?? 0) + 1) return
      const dungeon = generateDungeon(dungeonId, level)
      dungeon.repeatLeft = Math.max(0, Math.round(repeat) - 1)
      const cost = def.sceauCost
      const runs = dungeon.repeatLeft > 0 ? ` · auto ×${dungeon.repeatLeft + 1}` : ''
      const next = { ...s, sceaux: s.sceaux - cost, dungeon, log: pushLog(s.log, `🏰 Entrée dans ${dungeon.name} (${dungeon.totalFights} combats${cost ? `, -${cost} 🔑` : ', gratuit'}${runs}).`, 'info') }
      persist(next)
      set(next)
    },

    abandonDungeon: () => {
      const s = get()
      if (!s.dungeon) return
      const next = { ...s, dungeon: null, log: pushLog(s.log, 'Donjon abandonné. Le Sceau est perdu.', 'info') }
      persist(next)
      set(next)
    },

    enterRaid: (raidId, tier, repeat = 1) => {
      const s = get()
      if (s.raid || s.dungeon) return
      const def = getRaidDef(raidId)
      if (!def || !raidUnlocked(def, s.bestStage, s.raidProgress)) return
      const maxTier = (s.raidProgress[raidId] ?? 0) + 1
      if (tier < 1 || tier > maxTier) return
      if (s.orbes < def.orbeCost) return
      const raid = generateRaid(raidId, tier)
      raid.repeatLeft = Math.max(0, Math.round(repeat) - 1)
      const runs = raid.repeatLeft > 0 ? ` · auto ×${raid.repeatLeft + 1}` : ''
      const next = { ...s, orbes: s.orbes - def.orbeCost, raid, log: pushLog(s.log, `⚔️ Raid lancé : ${def.name} · Tier ${tier} (${raid.totalBosses} boss${runs}).`, 'info') }
      persist(next)
      set(next)
    },

    abandonRaid: () => {
      const s = get()
      if (!s.raid) return
      const next = { ...s, raid: null, log: pushLog(s.log, 'Raid abandonné. L\'Orbe est perdue.', 'info') }
      persist(next)
      set(next)
    },

    infuseUnique: (itemId) => {
      const s = get()
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
      const next = { ...s, ...upd, codex, fragments: s.fragments - FRAGMENT_INFUSE_COST, log: pushLog(s.log, `✨ Fragment infusé : ${item.name} (${label}).`, 'craft') }
      persist(next)
      set(next)
    },

    /** Invoque un effet unique AU CHOIX sur un objet (sink d'Éclat cosmique des raids). */
    chooseUnique: (itemId, effectId) => {
      const s = get()
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
      const next = {
        ...s,
        ...upd,
        codex,
        cosmic: s.cosmic - CHOOSE_UNIQUE_COST.cosmic,
        fragments: s.fragments - CHOOSE_UNIQUE_COST.fragments,
        log: pushLog(s.log, `💫 Effet invoqué : ${def.name} sur ${item.name} (rang ${rank}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    insertEffect: (itemId, effectId) => {
      const s = get()
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
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        essences,
        codex,
        log: pushLog(s.log, `🧬 Effet inséré : ${def.name} sur ${item.name} (-${cost.essences} essences).`, 'craft'),
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
      const next = {
        ...s,
        ...applyChestRewards(s, c),
        pendingChest: null,
        log: pushLog(
          s.log,
          `Coffre ouvert : ${c.items.length} objets${c.eclats ? `, +${c.eclats} éclats` : ''}${c.noyau ? `, +${c.noyau} noyaux` : ''}${pousG ? `, +${pousG} poussière` : ''}${cosmG ? `, +${cosmG} 💫` : ''}${c.gold ? `, +${c.gold} or` : ''}${c.sceaux ? `, +${c.sceaux} sceau` : ''}${orbeG ? `, +${orbeG} orbe` : ''}${fragG ? `, +${fragG} fragment` : ''}.`,
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

    buyEclats: (qty = 1) => {
      const s = get()
      const n = Math.max(1, Math.floor(qty))
      const c = EXCHANGE_RATES.eclatGoldCost * n
      if (s.gold < c) return
      const next = { ...s, gold: s.gold - c, essence: s.essence + EXCHANGE_RATES.eclatsBatch * n, log: pushLog(s.log, `Acheté ${EXCHANGE_RATES.eclatsBatch * n} éclats (-${c.toLocaleString('fr-FR')} or).`, 'gold') }
      persist(next)
      set(next)
    },

    buyResource: (kind, qty = 1) => {
      const s = get()
      const n = Math.max(1, Math.floor(qty))
      if (kind === 'sceau') {
        const c = EXCHANGE_RATES.sceauGold * n
        if (s.gold < c) return
        const next = { ...s, gold: s.gold - c, sceaux: s.sceaux + n, log: pushLog(s.log, `Sceau de faille ×${n} acheté (-${c.toLocaleString('fr-FR')} or).`, 'gold') }
        persist(next)
        set(next)
      } else {
        const c = EXCHANGE_RATES.orbeGold * n
        if (s.gold < c) return
        const next = { ...s, gold: s.gold - c, orbes: s.orbes + n, log: pushLog(s.log, `Orbe de raid ×${n} achetée (-${c.toLocaleString('fr-FR')} or).`, 'gold') }
        persist(next)
        set(next)
      }
    },

    mysteryBox: (tier) => {
      const s = get()
      const box = MYSTERY_BOXES[tier]
      if (!box || s.gold < box.gold || s.pendingChest) return
      // Les coffres d'élite exigent en plus des ressources de raid (pas d'or seul).
      if (s.fragments < (box.costFragments ?? 0) || s.cosmic < (box.costCosmic ?? 0)) return
      const ilvl = Math.max(1, stageIlvl(s.bestStage))
      const items: Item[] = []
      for (let i = 0; i < box.count; i++) {
        const rarity = rollBoxRarity(box.minTier, box.maxTier, box.jackpot)
        items.push(generateItem({
          ilvl, rarity, primaryBias: pickBias(s.characters),
          ...(box.type ? { type: box.type } : {}),
          ...(box.biasResist ? { biasResist: DAMAGE_TYPE_LIST[Math.floor(Math.random() * DAMAGE_TYPE_LIST.length)] } : {}),
        }))
      }
      // Garantie d'unique : si aucun objet n'en a, on en pose un sur le meilleur.
      if (box.guaranteeUnique && !items.some((it) => it.unique)) {
        const best = items.reduce((a, b) => (RARITIES[b.rarity].tier > RARITIES[a.rarity].tier ? b : a), items[0])
        if (best) best.unique = randomUniqueInstance()
      }
      const chest: ChestReward = {
        dungeonName: box.name, level: 0, items, gold: 0, sceaux: 0,
        eclats: box.eclats ?? 0, noyau: box.noyau ?? 0, poussiere: box.poussiere ?? 0, fragments: box.fragments ?? 0,
      }
      const extraCost = `${box.costFragments ? ` -${box.costFragments} ✨` : ''}${box.costCosmic ? ` -${box.costCosmic} 💫` : ''}`
      const next = {
        ...s,
        gold: s.gold - box.gold,
        fragments: s.fragments - (box.costFragments ?? 0),
        cosmic: s.cosmic - (box.costCosmic ?? 0),
        pendingChest: chest,
        log: pushLog(s.log, `${box.name} acheté (-${box.gold.toLocaleString('fr-FR')} or${extraCost}) !`, 'gold'),
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
