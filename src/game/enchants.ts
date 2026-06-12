import type { Character, Item } from './types'
import { RARITIES } from './rarities'

/**
 * RUNES (v0.22 — refonte Runiste) : le TEMPS et les RÈGLES, rien d'autre.
 *
 * Les 10 runes de stat ont été SUPPRIMÉES (redondantes : la stat choisie, c'est la Quintessence
 * et la transmutation). Une rune par pièce, remplaçable, payée en ♦ + 🌌 poussière d'étoile.
 * Deux familles :
 *  - ⏳ TEMPS : manipulent les horloges du combat (début de combat, recharges, morts, télégraphes).
 *  - ⚖️ RÈGLE : tordent le fonctionnement du JEU (loot, clés, drops, biomes) tant que portées.
 * Les effets sont d'ÉQUIPE (union des runes portées). Spécialisations du Runiste :
 * ◈ Chronomancien (runes de temps +50% efficaces) ↔ ◈ Législateur (règles amplifiées).
 */

export type RuleId = 'karma' | 'econome' | 'transmutation'
export type TimeRuneId = 'premierElan' | 'boucle' | 'sursis' | 'dilatation'

export interface EnchantDef {
  id: string
  name: string
  icon: string
  description: string
  /** Rune de TEMPS : manipule les horloges du combat. */
  time?: TimeRuneId
  /** Rune de RÈGLE : tord les règles du jeu. */
  rule?: RuleId
  /** Coût ×3 (toutes les runes de règle le sont). */
  rare?: boolean
}

export const ENCHANTS: EnchantDef[] = [
  // --- ⏳ TEMPS ---
  { id: 'runePremierElan', name: 'Rune du Premier élan', icon: '⏱️', time: 'premierElan',
    description: 'Les 10 premières secondes de chaque combat : +50% de vitesse d\'attaque.' },
  { id: 'runeBoucle', name: 'Rune de la Boucle', icon: '🔁', time: 'boucle',
    description: 'Toutes les 45 s, les recharges de TOUTE l\'équipe sont remises à zéro.' },
  { id: 'runeSursis', name: 'Rune du Sursis', icon: '🕊️', time: 'sursis',
    description: 'Un héros qui devrait mourir survit à 25% de ses PV (une fois par minute chacun).' },
  { id: 'runeDilatation', name: 'Rune de Dilatation', icon: '🐌', time: 'dilatation',
    description: 'Les incantations télégraphiées des ennemis durent +50% (synergie : Œil de l\'Opportuniste).' },
  // --- ⚖️ RÈGLE ---
  { id: 'runeKarma', name: 'Rune du Karma', icon: '🎰', rare: true, rule: 'karma',
    description: 'PITIÉ DU DESTIN : chaque kill sans drop Épique+ augmente ta chance de rareté (+1 cran / 40 kills). Remise à zéro au prochain Épique+.' },
  { id: 'runeEconome', name: 'Rune de l\'Économe', icon: '🗝️', rare: true, rule: 'econome',
    description: '15% de chance de ne PAS consommer la clé (Sceau / Orbe) — pour toi ET tes automates.' },
  { id: 'runeTransmutation', name: 'Rune de Transmutation brute', icon: '⚗️', rare: true, rule: 'transmutation',
    description: 'Les monstres NORMAUX ne droppent plus d\'objets ; en échange, chance de Quintessence et de Gemme ×2. (Boss, élites et champions droppent toujours.)' },
  // (v0.25 : « Rune du Vagabond » supprimée avec l'Élan du voyageur — migration : effacée, +8 🌌.)
]

const BY_ID = new Map(ENCHANTS.map((e) => [e.id, e]))
export function getEnchant(id: string): EnchantDef | undefined {
  return BY_ID.get(id)
}

/** Règles de jeu actives sur l'ÉQUIPE (union des runes de règle portées). */
export function equippedRules(characters: Character[]): Set<RuleId> {
  const out = new Set<RuleId>()
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      const def = it?.enchant ? BY_ID.get(it.enchant) : undefined
      if (def?.rule) out.add(def.rule)
    }
  }
  return out
}

/** Runes de TEMPS actives sur l'ÉQUIPE. */
export function equippedTimeRunes(characters: Character[]): Set<TimeRuneId> {
  const out = new Set<TimeRuneId>()
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      const def = it?.enchant ? BY_ID.get(it.enchant) : undefined
      if (def?.time) out.add(def.time)
    }
  }
  return out
}

/** Effets chiffrés des runes de TEMPS — `tempo` = 1.5 en spécialisation ◈ Chronomancien. */
export interface TimeRuneMods {
  /** +vitesse d'attaque en début de combat (fraction) pendant `premierElanDur` secondes. */
  premierElan?: number
  premierElanDur?: number
  /** Période (s) de la remise à zéro des recharges (0 = inactif). */
  boucleEvery?: number
  /** Délai (s) entre deux survies in extremis par héros (0 = inactif). */
  sursisCd?: number
  /** Allongement des télégraphes ennemis (fraction). */
  dilatation?: number
}

export function timeRuneMods(runes: Set<TimeRuneId>, tempo = 1): TimeRuneMods {
  const out: TimeRuneMods = {}
  if (runes.has('premierElan')) { out.premierElan = 0.5 * tempo; out.premierElanDur = 10 }
  if (runes.has('boucle')) out.boucleEvery = Math.round(45 / tempo)
  if (runes.has('sursis')) out.sursisCd = Math.round(60 / tempo)
  if (runes.has('dilatation')) out.dilatation = 0.5 * tempo
  return out
}

/** Coût de gravure : éclats + 🌌 poussière d'étoile (l'encre du Runiste — thème temps/astres). */
export function enchantCost(def: EnchantDef, item: Item): { eclats: number; poussiere: number } {
  const tier = RARITIES[item.rarity].tier
  const rareMult = def.rare ? 3 : 1
  return {
    eclats: Math.round(item.ilvl * 4 * tier * rareMult),
    poussiere: Math.round(tier * rareMult),
  }
}
