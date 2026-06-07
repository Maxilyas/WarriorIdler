import { create } from 'zustand'
import type {
  Equipment, Item, Affix, PrimaryStat, OffensiveStat, EquipSlotId, ItemType, Enemy, DamageType, RarityId, Character, PowerDef,
} from './types'
import { rollHit, incomingDps } from './combat'
import type { DerivedStats } from './stats'
import {
  makeCharacter, charDerived, charMaxHp, charDamageProfile, charPassives, charActives,
  charResist, charCombatMods, abilityPower, computeUnlockedPowers, setGlobalCombatMods,
} from './character'
import { getTalent, canAllocate } from './talents'
import { getUpgrade, upgradeCost as accountUpgradeCost, upgradePoussiere, isMaxed, computeGlobalMods } from './upgrades'
import {
  generateItem, rollBoxRarity, sellValue, recycleValue, recyclePoussiere, itemScore,
  reforgeItem, surillvlItem, ascendItem,
  reforgeCost, surillvlCost, ascendCost, createCost, transmuteCost,
} from './items'
import { makeEnemy, isBossStage, stageIlvl, stageLuckTier } from './enemies'
import { RARITIES } from './rarities'
import { SECONDARY_STATS } from './stats'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES } from './damage'
import { equipSlotsForType, slotAccepts } from './slots'
import { essenceGain, upgradeCost, insertCost, getUnique, UNIQUE_MAX_RANK, randomUniqueInstance } from './uniques'
import {
  generateDungeon, makeDungeonEnemy, dungeonIlvl, dungeonLuckTier, type ActiveDungeon,
} from './dungeons'
import {
  generateRaid, makeRaidBoss, getRaidDef, raidUnlocked, raidBerserkTime,
  raidIlvl, raidLuckTier, raidMinTier, raidLootCount, raidFragments,
  raidCosmicChance, raidCosmicQty, pickRaidLootType,
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
}

export const SCEAU_COST = { noyau: 3, eclats: 600 }
export const FRAGMENT_INFUSE_COST = 2 // Fragments d'éternité pour infuser un effet unique
/** Invocation d'un effet unique au CHOIX (Éclat cosmique + Fragments). */
export const CHOOSE_UNIQUE_COST = { cosmic: 1, fragments: 3 }

/** Progression de donjon par type de dégâts (un donjon par type). */
export type DungeonProgress = Record<DamageType, number>
function emptyDungeonProgress(): DungeonProgress {
  const out = {} as DungeonProgress
  for (const t of DAMAGE_TYPE_LIST) out[t] = 0
  return out
}

/** Progression par raid (chaque raid monte indépendamment). */
export type RaidProgress = Record<RaidId, number>
function emptyRaidProgress(): RaidProgress {
  const out = {} as RaidProgress
  for (const id of Object.keys(RAIDS) as RaidId[]) out[id] = 0
  return out
}

interface SaveData {
  characters: Character[]
  activeChar: number
  stage: number
  bestStage: number
  /** Verrou de farm : fige la progression au palier courant. */
  farmLock: boolean
  gold: number
  essence: number
  noyau: number
  /** Poussière d'étoile : matériau rare de craft sommital. */
  poussiere: number
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
  /** Horodatage de la dernière sauvegarde (progression hors-ligne). */
  lastSeen: number
}

interface GameState extends SaveData {
  enemy: Enemy
  log: LogEntry[]
  killCount: number
  /** Récap de progression hors-ligne à présenter au retour (modal). */
  pendingOffline: OfflineReport | null
  tick: (dt: number) => void
  setStage: (n: number) => void
  toggleFarmLock: () => void
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
  createItem: (opts: CreateOptions) => void
  enterDungeon: (element: DamageType, level: number) => void
  abandonDungeon: () => void
  enterRaid: (raidId: RaidId, tier: number) => void
  abandonRaid: () => void
  infuseUnique: (itemId: string) => void
  chooseUnique: (itemId: string, effectId: string) => void
  claimChest: () => void
  craftSceau: () => void
  setActiveChar: (index: number) => void
  setBias: (p: PrimaryStat) => void
  setPower: (slot: number, powerId: string | null) => void
  allocateTalent: (nodeId: string) => void
  respecTalents: () => void
  buyUpgrade: (id: string) => void
  refreshShop: () => void
  buyShopItem: (itemId: string) => void
  buyEclats: () => void
  buyResource: (kind: 'sceau' | 'orbe') => void
  mysteryBox: (tier: number) => void
  recruitCharacter: () => void
  reset: () => void
}

let logId = 1
function pushLog(log: LogEntry[], text: string, kind: LogKind): LogEntry[] {
  return [{ id: logId++, text, kind }, ...log].slice(0, MAX_LOG)
}

function xpForLevel(level: number): number {
  return Math.round(50 * Math.pow(1.35, level - 1))
}

// Cooldowns transitoires des capacités actives (clé `charId:powerId`). Non persistés.
const cooldowns = new Map<string, number>()

function freshSave(): SaveData {
  return {
    characters: [makeCharacter('Héros', 1, 'force')],
    activeChar: 0,
    stage: 1,
    bestStage: 1,
    farmLock: false,
    gold: 0,
    essence: 0,
    noyau: 0,
    poussiere: 0,
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
    lastSeen: Date.now(),
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
  const validStats = new Set<string>(SECONDARY_STATS)
  const affixes: Affix[] = []
  if (Array.isArray(item.affixes)) {
    for (const a of item.affixes) {
      if (a && a.kind === 'stat') { if (a.stat && validStats.has(a.stat)) affixes.push(a as Affix) }
      else if (a && a.kind) affixes.push(a as Affix)
      else if (a && a.stat && validStats.has(a.stat)) affixes.push({ kind: 'stat', stat: a.stat, value: a.value })
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
  if (typeof save.farmLock !== 'boolean') save.farmLock = false
  if (typeof save.lastSeen !== 'number') save.lastSeen = Date.now()

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

  // dungeonProgress : ancien `number` → record par type.
  const dp = save.dungeonProgress as unknown
  if (typeof dp === 'number' || !dp) {
    const old = typeof dp === 'number' ? dp : 0
    const rec = emptyDungeonProgress()
    for (const t of DAMAGE_TYPE_LIST) rec[t] = old
    save.dungeonProgress = rec
  } else {
    const rec = emptyDungeonProgress()
    for (const t of DAMAGE_TYPE_LIST) rec[t] = (dp as DungeonProgress)[t] ?? 0
    save.dungeonProgress = rec
  }

  // Donjon/raid actifs : garantir element + type d'attaque ennemi.
  if (save.dungeon) {
    if (!save.dungeon.element) save.dungeon.element = save.dungeon.theme
    if (save.dungeon.enemy && !save.dungeon.enemy.damageType) save.dungeon.enemy.damageType = save.dungeon.theme
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
    // Points restants = gagnés (niveau − 1) − dépensés (hors racine gratuite).
    c.talentPoints = Math.max(0, c.level - 1 - spent)
    c.unlockedPowers = computeUnlockedPowers(talents)
    // On garde les capacités équipées encore débloquées (sinon créneau vidé).
    const equipped = Array.isArray(c.powers) ? c.powers : []
    c.powers = [0, 1, 2, 3, 4].map((i) => {
      const p = equipped[i]
      return p && c.unlockedPowers.includes(p) ? p : null
    })
    const mh = charMaxHp(c)
    c.hp = c.hp > 0 ? Math.min(c.hp, mh) : mh
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
    talentPoints: Math.max(0, (p.level ?? 1) - 1),
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
    farmLock: s.farmLock,
    gold: s.gold,
    essence: s.essence,
    noyau: s.noyau,
    poussiere: s.poussiere,
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
    lastSeen: Date.now(),
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

/** Met à jour les multiplicateurs globaux (combat, inventaire, régén) depuis les améliorations. */
function refreshGlobals(upgrades: Record<string, number>) {
  const m = computeGlobalMods(upgrades)
  setGlobalCombatMods({ power: m.power, attackSpeed: m.attackSpeed, vitality: m.vitality })
  invMax = INV_BASE + m.inventoryBonus
  regenMult = m.regen
}

// ---- Marchand ----
const SHOP_SIZE = 6
export const EXCHANGE_RATES = { eclatsBatch: 100, eclatGoldCost: 800, sceauGold: 2500, orbeGold: 6000 }
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
  { id: 7, name: 'Coffre mythique', icon: '🔴', gold: 800000, count: 4, minTier: 8, maxTier: 12, jackpot: 0.07, eclats: 1500, noyau: 5, poussiere: 3, desc: 'Mythique → Éternel + ressources rares.' },
  { id: 8, name: 'Coffre cosmique', icon: '🌟', gold: 2500000, count: 5, minTier: 10, maxTier: 14, jackpot: 0.09, guaranteeUnique: true, eclats: 4000, noyau: 10, poussiere: 12, fragments: 2, desc: 'Ascendant → Abyssal, 1 unique garanti.' },
  { id: 9, name: 'Coffre du Néant', icon: '🕳️', gold: 10000000, count: 6, minTier: 12, maxTier: 16, jackpot: 0.13, guaranteeUnique: true, eclats: 10000, noyau: 25, poussiere: 35, fragments: 8, desc: 'Le pari ultime : top raretés + jackpot Transcendant + uniques.' },
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
    base[char.primaryBias] = (base[char.primaryBias] ?? 0) + 2
    base.endurance = (base.endurance ?? 0) + 1
  }
  const gained = level - char.level
  return { ...char, level, xp: curXp, base, talentPoints: char.talentPoints + gained }
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

function fireActive(p: PowerDef, caster: Character, derived: DerivedStats, chars: Character[], enemy: Enemy, hotBonus: number) {
  const mag = (p.magnitude ?? 1) * abilityPower(derived, p.scaleStat)
  switch (p.effect) {
    case 'nuke':
    case 'cleave':
      enemy.hp = Math.max(0, enemy.hp - mag)
      break
    case 'dot':
      enemy.dot = { dps: Math.max(mag * 0.4, enemy.dot?.dps ?? 0), remaining: 5 }
      break
    case 'heal':
    case 'hot': {
      const allies = chars.filter((c) => c.hp > 0)
      if (allies.length) {
        let low = allies[0]
        for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
        low.hp = Math.min(charMaxHp(low), low.hp + mag * (1 + hotBonus))
      }
      break
    }
    case 'buffParty':
      for (const a of chars) if (a.hp > 0) a.hp = Math.min(charMaxHp(a), a.hp + mag * 0.5 * (1 + hotBonus))
      break
    case 'shield':
      caster.hp = Math.min(charMaxHp(caster), caster.hp + mag)
      break
  }
}

/** Un pas de combat de l'équipe contre un ennemi. Renvoie l'état mis à jour. */
function partyCombatStep(input: Character[], enemyIn: Enemy, dt: number, mods?: CombatMods) {
  const enemy: Enemy = { ...enemyIn, dot: enemyIn.dot ? { ...enemyIn.dot } : undefined }
  const chars = input.map((c) => ({ ...c }))
  const info = chars.map((c) =>
    c.hp > 0
      ? {
          derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c),
          resist: charResist(c), cmods: charCombatMods(c),
        }
      : null,
  )

  let totalDealt = 0

  // 1) Attaques automatiques (+ Multifrappe) + DoT (keystone).
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const hits = d.derived.attacksPerSecond * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    const bonusMult = d.cmods.damageMult * lowHp * highHp
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    let healed = 0
    for (let h = 0; h < whole && enemy.hp > 0; h++) {
      // Multifrappe : chance de déclencher un coup supplémentaire.
      const strikes = 1 + (Math.random() < multistrikeChance ? 1 : 0)
      for (let s = 0; s < strikes && enemy.hp > 0; s++) {
        const hit = rollHit(d.derived, d.profile, enemy, { bonusMult, execute: d.cmods.execute })
        enemy.hp = Math.max(0, enemy.hp - hit.damage)
        totalDealt += hit.damage
        healed += hit.heal
        if (d.cmods.dot) enemy.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac, enemy.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
      }
    }
    if (healed) c.hp = Math.min(charMaxHp(c), c.hp + healed)
  })

  // 2) Dégâts du DoT sur l'ennemi.
  if (enemy.dot && enemy.hp > 0) {
    const dmg = enemy.dot.dps * dt
    enemy.hp = Math.max(0, enemy.hp - dmg)
    totalDealt += dmg
    enemy.dot.remaining -= dt
    if (enemy.dot.remaining <= 0) enemy.dot = undefined
  }

  // 3) Capacités actives auto-lancées (cooldown réduit par la Récupération).
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    for (const p of charActives(c)) {
      const key = `${c.id}:${p.id}`
      const cd = (cooldowns.get(key) ?? 0) - dt
      if (cd <= 0) {
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr))
        fireActive(p, c, d.derived, chars, enemy, d.cmods.hot)
      } else {
        cooldowns.set(key, cd)
      }
    }
  })

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
    const effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * (mods?.fightTime ?? 0)) * (mods?.dmgMult ?? 1)
    let incoming = incomingDps(effDmg, enemy.damageType, td.derived, td.resist)
      * (1 - td.passives.damageReduction) * (1 - td.derived.masteryDr) * (1 - td.cmods.flatDr) * dt
    if (mods?.reflect) incoming += totalDealt * mods.reflect
    t.hp -= incoming
    // Épines (thorns) : renvoie une fraction des dégâts subis à l'ennemi.
    if (td.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - incoming * td.cmods.thorns)
  }

  // 5) Régénération de l'ennemi (Vampirique).
  if (mods?.regen && enemy.hp > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

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

function tickDungeon(s: GameState, dt: number, set: (s: GameState) => void) {
  const d = s.dungeon!
  const fightTime = d.fightTime + dt
  let enrage = 0
  let reflect = 0
  let regen = 0
  for (const m of d.modifiers) {
    if (m.enrageRampPerSec) enrage += m.enrageRampPerSec
    if (m.reflectPct) reflect += m.reflectPct
    if (m.regenPct) regen += m.regenPct
  }

  const res = partyCombatStep(s.characters, d.enemy, dt, { enrage, reflect, regen, fightTime })
  let chars = res.chars
  const enemy = res.enemy
  let log = s.log

  if (!res.anyAlive) {
    const healed = chars.map((c) => ({ ...c, hp: charMaxHp(c) }))
    log = pushLog(log, `💀 Échec dans ${d.name} ! L'équipe bat en retraite.`, 'death')
    const next = { ...s, characters: healed, dungeon: null, log }
    persist(next)
    set(next)
    return
  }

  if (enemy.hp <= 0) {
    const nextIndex = d.current + 1
    if (nextIndex >= d.totalFights) {
      const noGold = d.modifiers.some((m) => m.noGold)
      const rareBonus = d.modifiers.reduce((a, m) => a + (m.rareBonus ?? 0), 0)
      const ilvl = dungeonIlvl(d.level)
      const luck = dungeonLuckTier(d.level) + rareBonus
      const count = 3 + Math.floor(d.level / 2)
      const bias = pickBias(s.characters)
      const items: Item[] = []
      // Butin CIBLÉ : du stuff de l'élément du donjon (dégâts + résistance du type).
      for (let i = 0; i < count; i++) {
        const targetDmg = Math.random() < 0.5
        items.push(generateItem({ ilvl, luckTier: luck, primaryBias: bias, ...(targetDmg ? { forceDmgType: d.element } : { biasResist: d.element }) }))
      }
      const chest: ChestReward = {
        dungeonName: d.name,
        level: d.level,
        items,
        eclats: Math.round(80 * d.level),
        noyau: 1 + Math.floor(d.level / 2),
        gold: noGold ? 0 : Math.round(150 * d.level),
        sceaux: d.level >= 5 ? 1 : 0,
        orbes: d.level >= 4 ? 1 : 0,
      }
      log = pushLog(log, `🎉 ${d.name} vaincu ! Un coffre t'attend.`, 'kill')
      const healed = chars.map((c) => ({ ...c, hp: charMaxHp(c) }))
      const dungeonProgress = { ...s.dungeonProgress, [d.element]: Math.max(s.dungeonProgress[d.element] ?? 0, d.level) }
      const next = {
        ...s,
        characters: healed,
        dungeon: null,
        dungeonProgress,
        pendingChest: chest,
        log,
      }
      persist(next)
      set(next)
      return
    }
    const nd: ActiveDungeon = {
      ...d,
      current: nextIndex,
      enemy: makeDungeonEnemy(d.level, nextIndex, d.totalFights, d.theme, d.vuln, d.modifiers),
      fightTime: 0,
    }
    log = pushLog(log, `${d.name} — combat ${nextIndex + 1}/${d.totalFights}.`, 'info')
    const next = { ...s, characters: chars, dungeon: nd, log }
    persist(next)
    set(next)
    return
  }

  set({ ...s, characters: chars, dungeon: { ...d, enemy, fightTime }, log })
}

/** Dégâts de zone (Nova/adds) sur l'équipe, typés et atténués par chaque perso. */
function applyAoe(chars: Character[], baseDmg: number, type: DamageType): Character[] {
  return chars.map((c) => {
    if (c.hp <= 0) return c
    const d = charDerived(c)
    const p = charPassives(c)
    const cm = charCombatMods(c)
    const resist = charResist(c)[type] ?? 0
    const dmg = (baseDmg * (1 - resist) / d.versatilityMult) * (1 - p.damageReduction) * (1 - d.masteryDr) * (1 - cm.flatDr) * (1 - d.dodge)
    return { ...c, hp: Math.max(0, c.hp - dmg) }
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
  if (mech.includes('execute')) dmgMult *= 1 + (1 - r.enemy.hp / Math.max(1, r.enemy.maxHp)) * 0.7

  const res = partyCombatStep(s.characters, r.enemy, dt, { enrage, regen: drain, fightTime, dmgMult })
  let chars = res.chars
  const enemy = res.enemy
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
    enemy.damageType = element
    log = pushLog(log, `🌈 ${r.enemy.name} bascule en ${DAMAGE_TYPES[element].name} !`, 'info')
  }
  // Nova cataclysmique : grosse AoE typée (check d'EHP/mitigation).
  if (mech.includes('nova') && novaCd <= 0) {
    novaCd = 6
    chars = applyAoe(chars, enemy.damage * 4 * def.baseDifficulty, element)
    log = pushLog(log, `☄️ ${r.enemy.name} déchaîne une Nova ${DAMAGE_TYPES[element].name} !`, 'death')
  }
  // Déferlante : vagues d'adds sur tout le groupe.
  if (mech.includes('swarm') && swarmCd <= 0) {
    swarmCd = 5
    chars = applyAoe(chars, enemy.damage * 2.2 * def.baseDifficulty, element)
    log = pushLog(log, '🐛 Des renforts assaillent l\'équipe !', 'death')
  }

  if (!chars.some((c) => c.hp > 0)) {
    const healed = chars.map((c) => ({ ...c, hp: charMaxHp(c) }))
    const why = mech.includes('berserk') && overtime > 0 ? ' (enrage mortel — il fallait plus de DPS)' : ''
    log = pushLog(log, `💀 Raid échoué : ${r.name}${why}. L'équipe est anéantie.`, 'death')
    const next = { ...s, characters: healed, raid: null, log }
    persist(next)
    set(next)
    return
  }

  if (enemy.hp <= 0) {
    const nextIndex = r.current + 1
    if (nextIndex >= r.totalBosses) {
      const tier = r.tier
      const ilvl = raidIlvl(def, tier)
      const luck = raidLuckTier(def, tier)
      const minTier = raidMinTier(def, tier)
      const count = raidLootCount(def, tier)
      const bias = pickBias(s.characters)
      const items: Item[] = []
      for (let i = 0; i < count; i++) {
        const lootType = pickRaidLootType(def)
        items.push(generateItem({
          ilvl, luckTier: luck, minTier, type: lootType, primaryBias: bias,
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
      const healed = chars.map((c) => ({ ...c, hp: charMaxHp(c) }))
      const raidProgress = { ...s.raidProgress, [r.raidId]: Math.max(s.raidProgress[r.raidId] ?? 0, tier) }
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
      enemy: makeRaidBoss(def, r.tier, nextIndex, startEl),
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

  set({ ...s, characters: chars, raid: { ...r, enemy, fightTime, novaCd, swarmCd, rotateCd, element, rotateIdx }, log })
}

export const useGame = create<GameState>((set, get) => {
  const save = loadSave()
  refreshGlobals(save.upgrades)

  // Progression hors-ligne : applique les gains accumulés depuis la dernière sauvegarde.
  let pendingOffline: OfflineReport | null = null
  const elapsed = Date.now() - (save.lastSeen ?? Date.now())
  if (elapsed > 0) {
    const report = simulateOffline(save.characters, save.stage, save.upgrades, elapsed)
    if (report) {
      pendingOffline = report
      save.gold += report.gold
      save.noyau += report.noyau
      save.sceaux += report.sceaux
      save.characters = save.characters.map((c) => (c.hp > 0 ? grantXp(c, report.xp) : c))
      for (const it of report.items) save.inventory = [it, ...save.inventory].slice(0, invMax)
    }
  }

  return {
    ...save,
    enemy: makeEnemy(save.stage),
    log: [{ id: logId++, text: 'Bienvenue, guerrier. Le combat commence.', kind: 'info' }],
    killCount: 0,
    pendingOffline,

    tick: (dt) => {
      const s = get()
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
        const healed = chars.map((c) => ({ ...c, hp: charMaxHp(c) }))
        log = pushLog(log, `💀 Équipe vaincue ! Repli au palier ${stage}.`, 'death')
        const next = { ...s, characters: healed, stage, enemy: makeEnemy(stage), log }
        persist(next)
        set(next)
        return
      }

      if (enemy.hp <= 0) {
        let { stage, bestStage, gold, noyau, sceaux, inventory, orbes, poussiere } = s
        const boss = isBossStage(stage)
        const eco = computeGlobalMods(s.upgrades)
        const goldGain = Math.round(enemy.xp * 0.5 * eco.goldGain)
        const xpGain = Math.round(enemy.xp * eco.xpGain)
        gold += goldGain

        chars = chars.map((c) => {
          if (c.hp <= 0) return c
          const nc = grantXp(c, xpGain)
          if (nc.level > c.level) log = pushLog(log, `⬆ ${nc.name} niveau ${nc.level} !`, 'level')
          return nc
        })
        log = pushLog(log, `${s.enemy.name} vaincu ! +${xpGain} XP, +${goldGain} or.`, 'kill')

        if (boss) {
          const ng = 1 + Math.floor(stage / 20)
          noyau += ng
          log = pushLog(log, `💠 Noyau primordial ×${ng} récupéré !`, 'craft')
          // Orbe de raid : chute rare sur les boss (plus probable en profondeur).
          if (Math.random() < Math.min(0.5, 0.15 + stage / 600)) {
            orbes += 1
            log = pushLog(log, '🔮 Orbe de raid récupérée !', 'craft')
          }
          // Poussière d'étoile : chute rare sur les boss profonds (craft sommital).
          if (stage >= 100 && Math.random() < Math.min(0.4, stage / 1000)) {
            poussiere += 1
            log = pushLog(log, '🌌 Poussière d\'étoile récupérée !', 'craft')
          }
        }

        const elite = enemy.elite === true
        if (elite) { noyau += 1; log = pushLog(log, '◆ Élite vaincue : butin supérieur !', 'kill') }
        const drops = (boss ? 3 : Math.random() < 0.55 + eco.lootChance ? 1 : 0) + (elite ? 2 : 0)
        const bias = pickBias(chars)
        const luck = stageLuckTier(stage) + (boss ? 1 : 0) + (elite ? 3 : 0) + Math.floor(eco.rarityLuck)
        let codex = s.codex
        for (let dd = 0; dd < drops; dd++) {
          const it = generateItem({ ilvl: stageIlvl(stage), luckTier: luck, primaryBias: bias })
          inventory = [it, ...inventory].slice(0, invMax)
          if (it.unique) codex = discoverFromItems(codex, [it])
          log = pushLog(log, `Butin : ${it.name}`, 'loot')
        }

        // Le verrou de farm fige la progression au palier courant.
        let characters = chars
        if (!s.farmLock) {
          stage += 1
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

        // L'échoppe du marchand se renouvelle à chaque boss vaincu.
        const shopStock = boss ? generateShop(bestStage, Math.floor(eco.rarityLuck)) : s.shopStock

        const enemyNext = makeEnemy(stage)
        if (isBossStage(stage)) log = pushLog(log, `⚔ Un boss vous barre la route : ${enemyNext.name} !`, 'info')

        const next = { ...s, characters, stage, bestStage, gold, noyau, sceaux, orbes, poussiere, codex, shopStock, inventory, enemy: enemyNext, log, killCount: s.killCount + 1 }
        persist(next)
        set(next)
        return
      }

      set({ ...s, characters: chars, enemy, log })
    },

    setStage: (n) => {
      const s = get()
      if (s.dungeon || s.raid) return
      const stage = Math.max(1, Math.min(s.bestStage, Math.round(n)))
      const next = { ...s, stage, enemy: makeEnemy(stage) }
      persist(next)
      set(next)
    },

    toggleFarmLock: () => {
      const s = get()
      const next = { ...s, farmLock: !s.farmLock }
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
      const essences = { ...s.essences }
      let essLog = ''
      if (item.unique) {
        const eg = essenceGain(RARITIES[item.rarity].tier, item.unique.rank)
        essences[item.unique.id] = (essences[item.unique.id] ?? 0) + eg
        essLog = ` + ${eg} essences de ${getUnique(item.unique.id)?.name ?? 'l\'effet'}`
      }
      const next = {
        ...s,
        essence: s.essence + gain,
        poussiere: s.poussiere + pous,
        essences,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(s.log, `Recyclé : ${item.name} (+${gain} éclats${pous ? ` + ${pous} 🌌` : ''}${essLog}).`, 'craft'),
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
      let count = 0
      const essences = { ...s.essences }
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier) {
          essence += recycleValue(item)
          poussiere += recyclePoussiere(item)
          if (item.unique) essences[item.unique.id] = (essences[item.unique.id] ?? 0) + essenceGain(RARITIES[item.rarity].tier, item.unique.rank)
          count++
        } else keep.push(item)
      }
      const gained = essence - s.essence
      const next = { ...s, essence, poussiere, essences, inventory: keep, log: count ? pushLog(s.log, `${count} objet(s) recyclé(s) (+${gained} éclats).`, 'craft') : s.log }
      persist(next)
      set(next)
    },

    reforge: (itemId, locked) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item) return
      const cost = reforgeCost(item)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, { affixes: reforgeItem(item, locked) })
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
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < (cost.fragments ?? 0) || s.poussiere < (cost.poussiere ?? 0)) return
      const upd = applyItemPatch(s, itemId, patch)
      if (!upd) return
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        fragments: s.fragments - (cost.fragments ?? 0),
        poussiere: s.poussiere - (cost.poussiere ?? 0),
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

    createItem: (opts) => {
      const s = get()
      const tier = RARITIES[opts.rarity].tier
      const ilvl = stageIlvl(s.bestStage)
      const cost = createCost(tier, ilvl)
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < (cost.fragments ?? 0) || s.poussiere < (cost.poussiere ?? 0)) return
      const item = generateItem({ ilvl, type: opts.type, rarity: opts.rarity, primary: opts.primary, ...(opts.orientation ? { orientation: opts.orientation } : {}), ...(opts.element ? { element: opts.element } : {}) })
      const inventory = [item, ...s.inventory].slice(0, invMax)
      const next = {
        ...s,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        fragments: s.fragments - (cost.fragments ?? 0),
        poussiere: s.poussiere - (cost.poussiere ?? 0),
        inventory,
        codex: discoverFromItems(s.codex, [item]),
        log: pushLog(s.log, `Forgé : ${item.name} (${RARITIES[opts.rarity].name}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    enterDungeon: (element, level) => {
      const s = get()
      if (s.dungeon || s.raid || s.sceaux < 1) return
      if (level < 1 || level > (s.dungeonProgress[element] ?? 0) + 1) return
      const dungeon = generateDungeon(element, level)
      const next = { ...s, sceaux: s.sceaux - 1, dungeon, log: pushLog(s.log, `🏰 Entrée dans ${dungeon.name} (${dungeon.totalFights} combats).`, 'info') }
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

    enterRaid: (raidId, tier) => {
      const s = get()
      if (s.raid || s.dungeon) return
      const def = getRaidDef(raidId)
      if (!def || !raidUnlocked(def, s.bestStage, s.raidProgress)) return
      const maxTier = (s.raidProgress[raidId] ?? 0) + 1
      if (tier < 1 || tier > maxTier) return
      if (s.orbes < def.orbeCost) return
      const raid = generateRaid(raidId, tier)
      const next = { ...s, orbes: s.orbes - def.orbeCost, raid, log: pushLog(s.log, `⚔️ Raid lancé : ${def.name} · Tier ${tier} (${raid.totalBosses} boss).`, 'info') }
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
      let inventory = s.inventory
      for (const it of c.items) inventory = [it, ...inventory].slice(0, invMax)
      const orbeG = c.orbes ?? 0
      const fragG = c.fragments ?? 0
      const pousG = c.poussiere ?? 0
      const cosmG = c.cosmic ?? 0
      const next = {
        ...s,
        pendingChest: null,
        inventory,
        codex: discoverFromItems(s.codex, c.items),
        essence: s.essence + c.eclats,
        noyau: s.noyau + c.noyau,
        poussiere: s.poussiere + pousG,
        cosmic: s.cosmic + cosmG,
        gold: s.gold + c.gold,
        sceaux: s.sceaux + c.sceaux,
        orbes: s.orbes + orbeG,
        fragments: s.fragments + fragG,
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
      if (s.gold < cost || s.poussiere < pous) return
      const upgrades = { ...s.upgrades, [id]: level + 1 }
      let characters = s.characters
      if (id === 'talentBonus') characters = characters.map((c) => ({ ...c, talentPoints: c.talentPoints + 1 }))
      refreshGlobals(upgrades)
      const next = { ...s, gold: s.gold - cost, poussiere: s.poussiere - pous, upgrades, characters, log: pushLog(s.log, `Amélioration : ${def.name} niv. ${level + 1} (-${cost} or${pous ? `, -${pous} 🌌` : ''}).`, 'gold') }
      persist(next)
      set(next)
    },

    refreshShop: () => {
      const s = get()
      const cost = shopRefreshCost(s.bestStage)
      if (s.gold < cost) return
      const eco = computeGlobalMods(s.upgrades)
      const next = { ...s, gold: s.gold - cost, shopStock: generateShop(s.bestStage, Math.floor(eco.rarityLuck)), log: pushLog(s.log, `Échoppe rafraîchie (-${cost} or).`, 'gold') }
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

    buyEclats: () => {
      const s = get()
      const c = EXCHANGE_RATES.eclatGoldCost
      if (s.gold < c) return
      const next = { ...s, gold: s.gold - c, essence: s.essence + EXCHANGE_RATES.eclatsBatch, log: pushLog(s.log, `Acheté ${EXCHANGE_RATES.eclatsBatch} éclats (-${c} or).`, 'gold') }
      persist(next)
      set(next)
    },

    buyResource: (kind) => {
      const s = get()
      if (kind === 'sceau') {
        if (s.gold < EXCHANGE_RATES.sceauGold) return
        const next = { ...s, gold: s.gold - EXCHANGE_RATES.sceauGold, sceaux: s.sceaux + 1, log: pushLog(s.log, `Sceau de faille acheté (-${EXCHANGE_RATES.sceauGold} or).`, 'gold') }
        persist(next)
        set(next)
      } else {
        if (s.gold < EXCHANGE_RATES.orbeGold) return
        const next = { ...s, gold: s.gold - EXCHANGE_RATES.orbeGold, orbes: s.orbes + 1, log: pushLog(s.log, `Orbe de raid achetée (-${EXCHANGE_RATES.orbeGold} or).`, 'gold') }
        persist(next)
        set(next)
      }
    },

    mysteryBox: (tier) => {
      const s = get()
      const box = MYSTERY_BOXES[tier]
      if (!box || s.gold < box.gold || s.pendingChest) return
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
      const next = { ...s, gold: s.gold - box.gold, pendingChest: chest, log: pushLog(s.log, `${box.name} acheté (-${box.gold.toLocaleString('fr-FR')} or) !`, 'gold') }
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
        enemy: makeEnemy(fresh.stage),
        log: [{ id: logId++, text: 'Nouvelle partie commencée.', kind: 'info' }],
        killCount: 0,
        pendingOffline: null,
      } as GameState)
    },
  }
})

export { xpForLevel }
