import type { Character, Item, DamageType } from './types'
import { charDps } from './character'
import { makeEnemy, stageIlvl } from './enemies'
import { generateItem, rollFarmRarity } from './items'
import { computeGlobalMods } from './upgrades'

/** Plafond de progression hors-ligne (12 h) et taux réduit. */
const OFFLINE_CAP_MS = 12 * 3600 * 1000
const OFFLINE_RATE = 0.5
const MIN_OFFLINE_MS = 60 * 1000 // pas de récap sous 1 minute
const MAX_OFFLINE_DROPS = 12

export interface OfflineReport {
  durationMs: number
  kills: number
  gold: number
  xp: number
  items: Item[]
  sceaux: number
  noyau: number
  /** Quintessence du biome actif récoltée hors-ligne (drop ~1% des kills). */
  quint?: { type: DamageType; amount: number }
}

/**
 * Simule la progression pendant l'absence : estime le rythme de kills (DPS de l'équipe
 * vs PV de l'ennemi du palier courant) à taux réduit, et renvoie un récap des gains.
 * Le palier ne progresse pas hors-ligne (farm sûr du palier courant).
 */
export function simulateOffline(
  characters: Character[],
  stage: number,
  upgrades: Record<string, number>,
  elapsedMs: number,
  activeBiome: DamageType,
  maitrise: Record<string, number> = {},
  /** v0.28 — bonus de hauts faits (rangs façon Maîtrise) à inclure dans l'éco. */
  achv: Record<string, number> = {},
): OfflineReport | null {
  if (elapsedMs < MIN_OFFLINE_MS) return null
  const capped = Math.min(elapsedMs, OFFLINE_CAP_MS)
  const seconds = (capped / 1000) * OFFLINE_RATE

  const living = characters.filter((c) => c.hp > 0)
  const pool = living.length ? living : characters
  const partyDps = pool.reduce((sum, c) => sum + charDps(c), 0)
  if (partyDps <= 0) return null

  const enemy = makeEnemy(stage)
  const timePerKill = Math.max(0.4, enemy.maxHp / partyDps + 0.8) // + marge (l'ennemi riposte)
  const kills = Math.min(20000, Math.floor(seconds / timePerKill))
  if (kills <= 0) return null

  const eco = computeGlobalMods(upgrades, maitrise, achv)
  // v0.36 — le farm (online ET offline idle) est la SEULE source d'or → aligné sur CLASSIC_GOLD_MULT = 5.0.
  const gold = Math.round(kills * enemy.xp * 5.0 * eco.goldGain) // aligné sur CLASSIC_GOLD_MULT (store, v0.36)
  // Même boost d'XP que le combat classique en ligne (CLASSIC_XP_MULT = 8 dans le store).
  const xp = Math.round(kills * enemy.xp * eco.xpGain * 8)

  // Quelques drops représentatifs (plafonnés pour ne pas saturer l'inventaire).
  const dropCount = Math.min(MAX_OFFLINE_DROPS, Math.floor(kills * (0.2 + eco.lootChance)))
  const shift = Math.min(2, Math.floor(eco.rarityLuck))
  const items: Item[] = []
  for (let i = 0; i < dropCount; i++) items.push(generateItem({ ilvl: stageIlvl(stage), rarity: rollFarmRarity(stage, shift) }))

  // v0.25 : plus de Sceaux en farm (en ligne comme hors-ligne) — l'Antre des Failles est LA source.
  const sceaux = 0
  const noyau = Math.floor(kills / 80)

  // Quintessence du biome : ~1% des kills, AUGMENTÉ par le palier (même formule que le store :
  // QUINT_TIER_BONUS=0.012, plafond ×4) → farmer haut rapporte plus.
  const qTierMult = Math.min(4, 1 + Math.max(0, stage - 1) * 0.012)
  const qAmount = Math.floor(kills * 0.01 * qTierMult)
  const quint = qAmount > 0 ? { type: activeBiome, amount: qAmount } : undefined

  return { durationMs: capped, kills, gold, xp, items, sceaux, noyau, quint }
}
