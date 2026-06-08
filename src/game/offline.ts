import type { Character, Item } from './types'
import { charDerived, charDamageProfile } from './character'
import { theoreticalDps } from './combat'
import { makeEnemy, stageIlvl, stageLuckTier } from './enemies'
import { generateItem } from './items'
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
): OfflineReport | null {
  if (elapsedMs < MIN_OFFLINE_MS) return null
  const capped = Math.min(elapsedMs, OFFLINE_CAP_MS)
  const seconds = (capped / 1000) * OFFLINE_RATE

  const living = characters.filter((c) => c.hp > 0)
  const pool = living.length ? living : characters
  const partyDps = pool.reduce((sum, c) => sum + theoreticalDps(charDerived(c), charDamageProfile(c)), 0)
  if (partyDps <= 0) return null

  const enemy = makeEnemy(stage)
  const timePerKill = Math.max(0.4, enemy.maxHp / partyDps + 0.8) // + marge (l'ennemi riposte)
  const kills = Math.min(20000, Math.floor(seconds / timePerKill))
  if (kills <= 0) return null

  const eco = computeGlobalMods(upgrades)
  // Même filet d'or que le combat classique en ligne (la richesse vient des donjons/raids).
  const gold = Math.round(kills * enemy.xp * 0.12 * eco.goldGain)
  const xp = Math.round(kills * enemy.xp * eco.xpGain)

  // Quelques drops représentatifs (plafonnés pour ne pas saturer l'inventaire).
  const dropCount = Math.min(MAX_OFFLINE_DROPS, Math.floor(kills * (0.2 + eco.lootChance)))
  const luck = stageLuckTier(stage) + Math.floor(eco.rarityLuck)
  const items: Item[] = []
  for (let i = 0; i < dropCount; i++) items.push(generateItem({ ilvl: stageIlvl(stage), luckTier: luck }))

  const sceaux = Math.floor(kills / 50) // ~1 sceau / 50 kills
  const noyau = Math.floor(kills / 80)

  return { durationMs: capped, kills, gold, xp, items, sceaux, noyau }
}
