import { create } from 'zustand'
import type {
  Equipment, Item, PrimaryStat, OffensiveStat, EquipSlotId, ItemType, Enemy, DamageType, RarityId, Character, PowerDef,
} from './types'
import { rollHit, incomingDps } from './combat'
import {
  makeCharacter, charDerived, charMaxHp, charDamageProfile, charPassives, charActives, computeUnlockedPowers,
  setGlobalCombatMods,
} from './character'
import { getTalent, canAllocate } from './talents'
import { getUpgrade, upgradeCost as accountUpgradeCost, isMaxed, computeGlobalMods } from './upgrades'
import {
  generateItem, sellValue, recycleValue, itemScore,
  reforgeItem, surillvlItem, ascendItem,
  reforgeCost, surillvlCost, ascendCost, createCost, transmuteCost,
} from './items'
import { makeEnemy, isBossStage, stageIlvl, stageLuckTier } from './enemies'
import { RARITIES } from './rarities'
import { equipSlotsForType, slotAccepts } from './slots'
import { essenceGain, upgradeCost, getUnique, UNIQUE_MAX_RANK, randomUniqueInstance } from './uniques'
import { powersUnlockedAt } from './powers'
import {
  generateDungeon, makeDungeonEnemy, dungeonIlvl, dungeonLuckTier, type ActiveDungeon,
} from './dungeons'
import {
  generateRaid, makeRaidBoss, raidIlvl, raidLuckTier, rollRaidMechanics, RAID_UNLOCK_STAGE, type ActiveRaid,
} from './raids'

const SAVE_KEY = 'warrior-idler-save-v1'
const MAX_LOG = 40
const INV_BASE = 80
let invMax = INV_BASE // ajusté par l'amélioration "Sacoches"
let regenMult = 1 // ajusté par l'amélioration "Régénération"
const REGEN_RATE = 0.05
const RETREAT_STAGES = 2
const CHAR2_STAGE = 50
const CHAR3_STAGE = 150
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
}

export const SCEAU_COST = { noyau: 3, eclats: 600 }
export const FRAGMENT_INFUSE_COST = 2 // Fragments d'éternité pour infuser un effet unique

interface SaveData {
  characters: Character[]
  activeChar: number
  stage: number
  bestStage: number
  gold: number
  essence: number
  noyau: number
  essences: Record<string, number>
  sceaux: number
  dungeonProgress: number
  dungeon: ActiveDungeon | null
  pendingChest: ChestReward | null
  orbes: number
  fragments: number
  raidProgress: number
  raid: ActiveRaid | null
  /** Améliorations permanentes : id → niveau. */
  upgrades: Record<string, number>
  /** Stock de l'échoppe du marchand. */
  shopStock: Item[]
  inventory: Item[]
}

interface GameState extends SaveData {
  enemy: Enemy
  log: LogEntry[]
  killCount: number
  tick: (dt: number) => void
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
  enterDungeon: (level: number) => void
  abandonDungeon: () => void
  enterRaid: (level: number) => void
  abandonRaid: () => void
  infuseUnique: (itemId: string) => void
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
    gold: 0,
    essence: 0,
    noyau: 0,
    essences: {},
    sceaux: 0,
    dungeonProgress: 0,
    dungeon: null,
    pendingChest: null,
    orbes: 0,
    fragments: 0,
    raidProgress: 0,
    raid: null,
    upgrades: {},
    shopStock: [],
    inventory: [],
  }
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
}

function sanitizeItem(item: Item) {
  item.id = `save-${migrateId++}`
  migrateItem(item)
}

/** Nettoie/migre les objets (inventaire + équipement de chaque perso). */
function sanitize(save: SaveData): SaveData {
  for (const item of save.inventory) sanitizeItem(item)
  for (const c of save.characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as EquipSlotId]
      if (it) sanitizeItem(it)
    }
    if (!Array.isArray(c.powers)) c.powers = [null, null, null, null, null]
    if (!c.talents) c.talents = {}
    if (typeof c.talentPoints !== 'number') c.talentPoints = Math.max(0, c.level - 1)
    if (!Array.isArray(c.unlockedPowers)) c.unlockedPowers = computeUnlockedPowers(c.level, c.talents)
    const mh = charMaxHp(c)
    c.hp = c.hp > 0 ? Math.min(c.hp, mh) : mh
  }
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
    unlockedPowers: powersUnlockedAt(p.level ?? 1).map((pw) => pw.id),
    talentPoints: Math.max(0, (p.level ?? 1) - 1),
    talents: {},
    primaryBias: p.primaryBias ?? 'force',
    hp: p.hp ?? 0,
  }
  // auto-équipe les capacités de départ
  hero.unlockedPowers.slice(0, 5).forEach((id, i) => (hero.powers[i] = id))

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
    gold: s.gold,
    essence: s.essence,
    noyau: s.noyau,
    essences: s.essences,
    sceaux: s.sceaux,
    dungeonProgress: s.dungeonProgress,
    dungeon: s.dungeon,
    pendingChest: s.pendingChest,
    orbes: s.orbes,
    fragments: s.fragments,
    raidProgress: s.raidProgress,
    raid: s.raid,
    upgrades: s.upgrades,
    shopStock: s.shopStock,
    inventory: s.inventory,
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
export const MYSTERY_BOXES = [
  { id: 0, name: 'Petit coffre', gold: 500, count: 1, luck: 0 },
  { id: 1, name: 'Grand coffre', gold: 2000, count: 2, luck: 2 },
  { id: 2, name: 'Coffre légendaire', gold: 8000, count: 3, luck: 5 },
]

/** Prix d'achat d'un objet en échoppe (croît avec ilvl et rareté). */
export function shopBuyPrice(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  return Math.round(item.ilvl * (4 + tier * 3))
}

export function shopRefreshCost(bestStage: number): number {
  return Math.round(200 + bestStage * 25)
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

/** Donne de l'XP à un perso, gère les montées de niveau (gains de base + déblocage de capacités). */
function grantXp(char: Character, xp: number): Character {
  let level = char.level
  let curXp = char.xp + xp
  const base = { ...char.base }
  const powers = [...char.powers]
  const unlocked = [...char.unlockedPowers]
  while (curXp >= xpForLevel(level)) {
    curXp -= xpForLevel(level)
    level++
    base[char.primaryBias] = (base[char.primaryBias] ?? 0) + 2
    base.endurance = (base.endurance ?? 0) + 1
    for (const p of powersUnlockedAt(level)) {
      if (!unlocked.includes(p.id)) {
        unlocked.push(p.id)
        const empty = powers.indexOf(null)
        if (empty >= 0) powers[empty] = p.id
      }
    }
  }
  const gained = level - char.level
  return { ...char, level, xp: curXp, base, powers, unlockedPowers: unlocked, talentPoints: char.talentPoints + gained }
}

// ---- Combat d'équipe ----

interface CombatMods {
  enrage?: number
  reflect?: number
  regen?: number
  fightTime?: number
}

function fireActive(p: PowerDef, caster: Character, casterPower: number, chars: Character[], enemy: Enemy) {
  const mag = (p.magnitude ?? 1) * casterPower
  switch (p.effect) {
    case 'nuke':
    case 'cleave':
      enemy.hp = Math.max(0, enemy.hp - mag)
      break
    case 'heal': {
      const allies = chars.filter((c) => c.hp > 0)
      if (allies.length) {
        let low = allies[0]
        for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
        low.hp = Math.min(charMaxHp(low), low.hp + mag)
      }
      break
    }
    case 'buffParty':
      for (const a of chars) if (a.hp > 0) a.hp = Math.min(charMaxHp(a), a.hp + mag * 0.5)
      break
    case 'shield':
      caster.hp = Math.min(charMaxHp(caster), caster.hp + mag)
      break
  }
}

/** Un pas de combat de l'équipe contre un ennemi. Renvoie l'état mis à jour. */
function partyCombatStep(input: Character[], enemyIn: Enemy, dt: number, mods?: CombatMods) {
  const enemy = { ...enemyIn }
  const chars = input.map((c) => ({ ...c }))
  const info = chars.map((c) =>
    c.hp > 0 ? { derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c) } : null,
  )

  let totalDealt = 0

  // 1) Attaques automatiques de chaque perso.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const hits = d.derived.attacksPerSecond * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    let healed = 0
    for (let h = 0; h < whole && enemy.hp > 0; h++) {
      const hit = rollHit(d.derived, d.profile, enemy)
      enemy.hp = Math.max(0, enemy.hp - hit.damage)
      totalDealt += hit.damage
      healed += hit.heal
    }
    if (healed) c.hp = Math.min(charMaxHp(c), c.hp + healed)
  })

  // 2) Capacités actives auto-lancées.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    for (const p of charActives(c)) {
      const key = `${c.id}:${p.id}`
      const cd = (cooldowns.get(key) ?? 0) - dt
      if (cd <= 0) {
        cooldowns.set(key, p.cooldown ?? 3)
        fireActive(p, c, d.derived.power, chars, enemy)
      } else {
        cooldowns.set(key, cd)
      }
    }
  })

  // 3) L'ennemi frappe la plus haute menace.
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
    const effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * (mods?.fightTime ?? 0))
    let incoming = incomingDps(effDmg, td.derived) * (1 - td.passives.damageReduction) * (1 - td.derived.masteryDr) * dt
    if (mods?.reflect) incoming += totalDealt * mods.reflect
    t.hp -= incoming
  }

  // 4) Régénération de l'ennemi (Vampirique).
  if (mods?.regen && enemy.hp > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 5) Régénération des persos + clamp.
  chars.forEach((c) => {
    if (c.hp > 0) {
      const mh = charMaxHp(c)
      c.hp = Math.min(mh, c.hp + mh * REGEN_RATE * regenMult * dt)
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
      for (let i = 0; i < count; i++) items.push(generateItem({ ilvl, luckTier: luck, primaryBias: bias }))
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
      const next = {
        ...s,
        characters: healed,
        dungeon: null,
        dungeonProgress: Math.max(s.dungeonProgress, d.level),
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

/** Dégâts de zone (Nova/adds) sur l'équipe, atténués par chaque perso. */
function applyAoe(chars: Character[], baseDmg: number): Character[] {
  return chars.map((c) => {
    if (c.hp <= 0) return c
    const d = charDerived(c)
    const p = charPassives(c)
    const dmg = (baseDmg / d.versatilityMult) * (1 - p.damageReduction) * (1 - d.masteryDr)
    return { ...c, hp: Math.max(0, c.hp - dmg) }
  })
}

function tickRaid(s: GameState, dt: number, set: (s: GameState) => void) {
  const r = s.raid!
  const fightTime = r.fightTime + dt
  let enrage = 0
  let drain = 0
  for (const m of r.mechanics) {
    if (m.kind === 'enrage') enrage += m.value
    if (m.kind === 'drain') drain += m.value
  }
  const nova = r.mechanics.find((m) => m.kind === 'nova')
  const adds = r.mechanics.find((m) => m.kind === 'adds')

  const res = partyCombatStep(s.characters, r.enemy, dt, { enrage, regen: drain, fightTime })
  let chars = res.chars
  const enemy = res.enemy
  let log = s.log
  let novaCd = r.novaCd - dt
  let addsCd = r.addsCd - dt

  if (nova && novaCd <= 0) {
    novaCd = nova.cooldown ?? 6
    chars = applyAoe(chars, nova.value * enemy.damage)
    log = pushLog(log, `☄️ ${r.enemy.name} déclenche une Nova élémentaire !`, 'death')
  }
  if (adds && addsCd <= 0) {
    addsCd = adds.cooldown ?? 5
    chars = applyAoe(chars, adds.value * enemy.damage * 0.7)
  }

  if (!chars.some((c) => c.hp > 0)) {
    const healed = chars.map((c) => ({ ...c, hp: charMaxHp(c) }))
    log = pushLog(log, `💀 Raid échoué : ${r.name}. L'équipe est anéantie.`, 'death')
    const next = { ...s, characters: healed, raid: null, log }
    persist(next)
    set(next)
    return
  }

  if (enemy.hp <= 0) {
    const nextIndex = r.current + 1
    if (nextIndex >= r.totalBosses) {
      const ilvl = raidIlvl(r.level)
      const luck = raidLuckTier(r.level)
      const count = 3 + r.level
      const bias = pickBias(s.characters)
      const items: Item[] = []
      for (let i = 0; i < count; i++) items.push(generateItem({ ilvl, luckTier: luck, primaryBias: bias }))
      const chest: ChestReward = {
        dungeonName: r.name,
        level: r.level,
        items,
        eclats: Math.round(150 * r.level),
        noyau: 2 + r.level,
        gold: Math.round(300 * r.level),
        sceaux: 1,
        fragments: 1 + Math.floor(r.level / 2),
      }
      const healed = chars.map((c) => ({ ...c, hp: charMaxHp(c) }))
      log = pushLog(log, `🏆 RAID VAINCU : ${r.name} ! Un trésor t'attend.`, 'kill')
      const next = { ...s, characters: healed, raid: null, raidProgress: Math.max(s.raidProgress, r.level), pendingChest: chest, log }
      persist(next)
      set(next)
      return
    }
    const mechanics = rollRaidMechanics(r.level)
    const nr: ActiveRaid = {
      ...r,
      current: nextIndex,
      mechanics,
      enemy: makeRaidBoss(r.level, nextIndex, r.theme, r.vuln, mechanics),
      fightTime: 0,
      novaCd: 6,
      addsCd: 5,
    }
    log = pushLog(log, `${r.name} — boss ${nextIndex + 1}/${r.totalBosses} !`, 'info')
    const next = { ...s, characters: chars, raid: nr, log }
    persist(next)
    set(next)
    return
  }

  set({ ...s, characters: chars, raid: { ...r, enemy, fightTime, novaCd, addsCd }, log })
}

export const useGame = create<GameState>((set, get) => {
  const save = loadSave()
  refreshGlobals(save.upgrades)
  return {
    ...save,
    enemy: makeEnemy(save.stage),
    log: [{ id: logId++, text: 'Bienvenue, guerrier. Le combat commence.', kind: 'info' }],
    killCount: 0,

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
        let { stage, bestStage, gold, noyau, sceaux, inventory, orbes } = s
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
        }

        const drops = boss ? 3 : Math.random() < 0.55 + eco.lootChance ? 1 : 0
        const bias = pickBias(chars)
        const luck = stageLuckTier(stage) + (boss ? 1 : 0) + Math.floor(eco.rarityLuck)
        for (let dd = 0; dd < drops; dd++) {
          const it = generateItem({ ilvl: stageIlvl(stage), luckTier: luck, primaryBias: bias })
          inventory = [it, ...inventory].slice(0, invMax)
          log = pushLog(log, `Butin : ${it.name}`, 'loot')
        }

        stage += 1
        bestStage = Math.max(bestStage, stage)
        if (stage % 5 === 0) {
          sceaux += 1
          log = pushLog(log, '🔑 Sceau de faille obtenu.', 'info')
        }

        // Déblocage des personnages.
        let characters = chars
        if (bestStage >= CHAR2_STAGE && characters.length < 2) {
          characters = [...characters, makeCharacter(RECRUE_NAMES[0], highestLevel(characters), 'agilite')]
          log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[0]} rejoint ton équipe !`, 'level')
        }
        if (bestStage >= CHAR3_STAGE && characters.length < 3) {
          characters = [...characters, makeCharacter(RECRUE_NAMES[1], highestLevel(characters), 'intelligence')]
          log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[1]} rejoint ton équipe !`, 'level')
        }

        // L'échoppe du marchand se renouvelle à chaque boss vaincu.
        const shopStock = boss ? generateShop(bestStage, Math.floor(eco.rarityLuck)) : s.shopStock

        const enemyNext = makeEnemy(stage)
        if (isBossStage(stage)) log = pushLog(log, `⚔ Un boss vous barre la route : ${enemyNext.name} !`, 'info')

        const next = { ...s, characters, stage, bestStage, gold, noyau, sceaux, orbes, shopStock, inventory, enemy: enemyNext, log, killCount: s.killCount + 1 }
        persist(next)
        set(next)
        return
      }

      set({ ...s, characters: chars, enemy, log })
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
        essences,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(s.log, `Recyclé : ${item.name} (+${gain} éclats${essLog}).`, 'craft'),
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
      let count = 0
      const essences = { ...s.essences }
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier) {
          essence += recycleValue(item)
          if (item.unique) essences[item.unique.id] = (essences[item.unique.id] ?? 0) + essenceGain(RARITIES[item.rarity].tier, item.unique.rank)
          count++
        } else keep.push(item)
      }
      const gained = essence - s.essence
      const next = { ...s, essence, essences, inventory: keep, log: count ? pushLog(s.log, `${count} objet(s) recyclé(s) (+${gained} éclats).`, 'craft') : s.log }
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
      if (s.essence < cost.eclats || s.noyau < cost.noyau) return
      const upd = applyItemPatch(s, itemId, patch)
      if (!upd) return
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
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
      if (s.essence < cost.eclats || s.noyau < cost.noyau) return
      const item = generateItem({ ilvl, type: opts.type, rarity: opts.rarity, primary: opts.primary, ...(opts.orientation ? { orientation: opts.orientation } : {}), ...(opts.element ? { element: opts.element } : {}) })
      const inventory = [item, ...s.inventory].slice(0, invMax)
      const next = {
        ...s,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        inventory,
        log: pushLog(s.log, `Forgé : ${item.name} (${RARITIES[opts.rarity].name}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    enterDungeon: (level) => {
      const s = get()
      if (s.dungeon || s.sceaux < 1) return
      if (level < 1 || level > s.dungeonProgress + 1) return
      const dungeon = generateDungeon(level)
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

    enterRaid: (level) => {
      const s = get()
      if (s.raid || s.dungeon) return
      if (s.bestStage < RAID_UNLOCK_STAGE) return
      if (s.orbes < 1) return
      if (level < 1 || level > s.raidProgress + 1) return
      const raid = generateRaid(level)
      const next = { ...s, orbes: s.orbes - 1, raid, log: pushLog(s.log, `⚔️ Raid lancé : ${raid.name} (${raid.totalBosses} boss).`, 'info') }
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
      const next = { ...s, ...upd, fragments: s.fragments - FRAGMENT_INFUSE_COST, log: pushLog(s.log, `✨ Fragment infusé : ${item.name} (${label}).`, 'craft') }
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
      const next = {
        ...s,
        pendingChest: null,
        inventory,
        essence: s.essence + c.eclats,
        noyau: s.noyau + c.noyau,
        gold: s.gold + c.gold,
        sceaux: s.sceaux + c.sceaux,
        orbes: s.orbes + orbeG,
        fragments: s.fragments + fragG,
        log: pushLog(
          s.log,
          `Coffre ouvert : ${c.items.length} objets, +${c.eclats} éclats, +${c.noyau} noyaux${c.gold ? `, +${c.gold} or` : ''}${c.sceaux ? `, +${c.sceaux} sceau` : ''}${orbeG ? `, +${orbeG} orbe` : ''}${fragG ? `, +${fragG} fragment` : ''}.`,
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
      const unlockedPowers = computeUnlockedPowers(char.level, talents)
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
      if (spent === 0) return
      const cost = 200 * char.level
      if (s.gold < cost) return
      const unlockedPowers = computeUnlockedPowers(char.level, {})
      const powers = char.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, talents: {}, talentPoints: char.talentPoints + spent, unlockedPowers, powers }
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
      if (s.gold < cost) return
      const upgrades = { ...s.upgrades, [id]: level + 1 }
      let characters = s.characters
      if (id === 'talentBonus') characters = characters.map((c) => ({ ...c, talentPoints: c.talentPoints + 1 }))
      refreshGlobals(upgrades)
      const next = { ...s, gold: s.gold - cost, upgrades, characters, log: pushLog(s.log, `Amélioration : ${def.name} niv. ${level + 1} (-${cost} or).`, 'gold') }
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
      const eco = computeGlobalMods(s.upgrades)
      const luck = stageLuckTier(s.bestStage) + box.luck + Math.floor(eco.rarityLuck)
      const items: Item[] = []
      for (let i = 0; i < box.count; i++) items.push(generateItem({ ilvl, luckTier: luck, primaryBias: pickBias(s.characters) }))
      const chest: ChestReward = { dungeonName: box.name, level: 0, items, eclats: 0, noyau: 0, gold: 0, sceaux: 0 }
      const next = { ...s, gold: s.gold - box.gold, pendingChest: chest, log: pushLog(s.log, `${box.name} acheté (-${box.gold} or) !`, 'gold') }
      persist(next)
      set(next)
    },

    recruitCharacter: () => {
      const s = get()
      if (s.characters.length >= 3) return
      const cost = s.characters.length === 1 ? 5000 : 20000
      if (s.gold < cost) return
      const bias: OffensiveStat = s.characters.length === 1 ? 'agilite' : 'intelligence'
      const name = RECRUE_NAMES[s.characters.length - 1] ?? 'Recrue'
      const characters = [...s.characters, makeCharacter(name, highestLevel(s.characters), bias)]
      const next = { ...s, gold: s.gold - cost, characters, log: pushLog(s.log, `🧑‍🤝‍🧑 ${name} recruté(e) (-${cost} or) !`, 'level') }
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
      } as GameState)
    },
  }
})

export { xpForLevel }
