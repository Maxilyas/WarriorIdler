import type { Affix, Item, PrimaryStat, OffensiveStat, ItemOrientation, ItemType, SecondaryStat, RarityId, DamageType } from './types'
import { RARITIES, RARITY_LIST, rollRarity } from './rarities'
import { RARE_STATS } from './stats'
import { ITEM_TYPES } from './slots'
import { rollUnique, instanceMods } from './uniques'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from './damage'
import { gemScore } from './gems'
import { enchantMods } from './enchants'

const ITEM_TYPE_LIST: ItemType[] = Object.keys(ITEM_TYPES) as ItemType[]

// Préfixes par stat primaire (thématique).
const PREFIXES: Record<PrimaryStat, string[]> = {
  force: ['Brutal', 'Sanglant', 'Massif', 'Titanesque', 'Implacable'],
  agilite: ['Furtif', 'Véloce', 'Affûté', 'Vif', 'Fuyant'],
  intelligence: ['Arcanique', 'Runique', 'Spectral', 'Éthéré', 'Mystique'],
  endurance: ['Robuste', 'Inébranlable', 'Gardien', 'Massif', 'Ancestral'],
}

const NOUNS: Record<ItemType, string> = {
  tete: 'Heaume', cou: 'Amulette', epaules: 'Spallières', cape: 'Cape',
  torse: 'Plastron', poignets: 'Bracelets', mains: 'Gantelets', taille: 'Ceinture',
  jambes: 'Jambières', pieds: 'Bottes', anneau: 'Anneau', bijou: 'Talisman',
  armePrincipale: 'Lame', armeSecondaire: 'Bouclier',
}

const SUFFIXES = ['du Crépuscule', 'de la Forge', 'des Abysses', 'de l\'Aube', 'du Néant', 'des Anciens', 'de la Tempête']

let nextId = 1
const ID_PREFIX = Date.now().toString(36)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ---- Pool d'affixes pondéré (stat / dégâts de type / résistance) ----

type LineSpec =
  | { kind: 'stat'; stat: SecondaryStat; weight: number }
  | { kind: 'dmgType'; type: DamageType; weight: number }
  | { kind: 'resist'; type: DamageType; weight: number }

/**
 * Poids de tirage des stats secondaires. Les stats RARES ont un poids minuscule
 * (Vol de vie ~2% par objet, Surpuissance/Multifrappe/Récupération encore plus rares).
 *
 * `polyvalence` est à 0 : volontairement RETIRÉE du butin aléatoire. C'était la stat
 * « strictement bonne » (+dégâts ET -dégâts subis) qui diluait le choix offense ↔ survie.
 * Elle reste disponible comme IDENTITÉ via les talents (Métamorphe) et les effets uniques.
 */
const STAT_WEIGHTS: Record<SecondaryStat, number> = {
  critique: 10, degatsCrit: 9, hate: 10, maitrise: 9, penetration: 7,
  precision: 7, alteration: 6, degatsBoss: 6,
  reductionDegats: 8, esquive: 7, barriere: 7, tenacite: 5, purge: 7,
  regen: 6,
  volDeVie: 0.6, surpuissance: 0.3, multifrappe: 0.3, recuperation: 0.3,
}

function buildPool(): LineSpec[] {
  const pool: LineSpec[] = []
  for (const s of Object.keys(STAT_WEIGHTS) as SecondaryStat[]) {
    if (STAT_WEIGHTS[s] <= 0) continue // stats retirées du tirage aléatoire (ex. polyvalence)
    pool.push({ kind: 'stat', stat: s, weight: STAT_WEIGHTS[s] })
  }
  for (const t of DAMAGE_TYPE_LIST) pool.push({ kind: 'dmgType', type: t, weight: t === 'physique' ? 4 : 6 })
  for (const t of DAMAGE_TYPE_LIST) pool.push({ kind: 'resist', type: t, weight: 5 })
  return pool
}

function lineKey(s: LineSpec): string {
  return s.kind === 'stat' ? `stat:${s.stat}` : `${s.kind}:${s.type}`
}

function affixKey(a: Affix): string {
  return a.kind === 'stat' ? `stat:${a.stat}` : `${a.kind}:${a.type}`
}

function rollLineValue(spec: LineSpec, ilvl: number, statMult: number, tier: number): number {
  if (spec.kind === 'stat') {
    const soft = RARE_STATS.includes(spec.stat) ? 0.5 : 1 // stats rares modérées (rares mais fortes)
    const base = ilvl * 0.8 * statMult * soft
    return Math.max(1, Math.round(base * (0.7 + Math.random() * 0.6)))
  }
  if (spec.kind === 'dmgType') return Math.round((10 + Math.random() * 15) * (1 + tier * 0.12))
  return Math.min(30, Math.round((5 + Math.random() * 8) * (1 + tier * 0.06))) // résistance %
}

function specToAffix(spec: LineSpec, value: number): Affix {
  if (spec.kind === 'stat') return { kind: 'stat', stat: spec.stat, value }
  return { kind: spec.kind, type: spec.type, value }
}

/** Tire `count` lignes distinctes depuis le pool pondéré, en garantissant des lignes ciblées. */
function rollAffixes(count: number, ilvl: number, statMult: number, tier: number, opts: GenerateOptions): Affix[] {
  const used = new Set<string>()
  const out: Affix[] = []

  const force = (spec: LineSpec) => {
    if (out.length >= count || used.has(lineKey(spec))) return
    used.add(lineKey(spec))
    out.push(specToAffix(spec, rollLineValue(spec, ilvl, statMult, tier)))
  }
  // Lignes ciblées (donjons par type / coffres ciblés) en priorité.
  if (opts.forceStat) force({ kind: 'stat', stat: opts.forceStat, weight: 0 })
  if (opts.forceDmgType) force({ kind: 'dmgType', type: opts.forceDmgType, weight: 0 })
  if (opts.biasResist) force({ kind: 'resist', type: opts.biasResist, weight: 0 })

  const pool = buildPool().filter((s) => !used.has(lineKey(s)))
  while (out.length < count && pool.length) {
    const total = pool.reduce((a, s) => a + s.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break } }
    const spec = pool.splice(idx, 1)[0]
    used.add(lineKey(spec))
    out.push(specToAffix(spec, rollLineValue(spec, ilvl, statMult, tier)))
  }
  return out
}

export interface GenerateOptions {
  ilvl: number
  luckTier?: number
  type?: ItemType
  rarity?: RarityId
  primaryBias?: OffensiveStat
  /** Force la stat primaire offensive (création). */
  primary?: OffensiveStat
  /** Force l'orientation offensive/défensive (création). */
  orientation?: ItemOrientation
  /** Force l'élément de l'arme (création). */
  element?: DamageType
  /** Garantit une ligne de dégâts de ce type (donjon ciblé). */
  forceDmgType?: DamageType
  /** Garantit une ligne de résistance à ce type (donjon ciblé). */
  biasResist?: DamageType
  /** Garantit une LIGNE DE STAT secondaire (coffres ciblés : crit, etc.). */
  forceStat?: SecondaryStat
  /** Rareté minimale garantie (coffres) : remonte la rareté tirée si trop basse. */
  minTier?: number
}

const OFFENSIVE_POOL: OffensiveStat[] = ['force', 'agilite', 'intelligence']
/** Part du budget allouée à l'offensif (le reste va en Endurance). */
const ORIENTATION_FRAC: Record<ItemOrientation, number> = { offensif: 0.82, equilibre: 0.55, defensif: 0.3 }

/** Génère un objet aléatoire complet. */
export function generateItem(opts: GenerateOptions): Item {
  const type = opts.type ?? pick(ITEM_TYPE_LIST)
  const typeMeta = ITEM_TYPES[type]
  let rarityId = opts.rarity ?? rollRarity(opts.luckTier ?? 0)
  // Plancher d'iLvl par rareté (drops ALÉATOIRES uniquement) : une haute rareté ne peut pas
  // tomber sur un objet de bas iLvl → fini le « ilvl 30 abyssal qui remplace un ilvl 140 ».
  // Les coffres/raids/craft (rareté forcée) ne sont pas concernés (leur iLvl est déjà calé).
  if (!opts.rarity) {
    const capTier = maxRarityTierForIlvl(opts.ilvl)
    if (RARITIES[rarityId].tier > capTier) {
      const capped = RARITY_LIST.find((r) => r.tier === capTier)
      if (capped) rarityId = capped.id
    }
  }
  // Rareté plancher garantie (coffres) : remonte si la rareté tirée est trop basse.
  if (opts.minTier && RARITIES[rarityId].tier < opts.minTier) {
    const floor = RARITY_LIST.find((r) => r.tier === Math.min(16, opts.minTier!))
    if (floor) rarityId = floor.id
  }
  const rarity = RARITIES[rarityId]
  const isWeapon = type === 'armePrincipale'
  const isShield = type === 'armeSecondaire'

  const primary: OffensiveStat = opts.primary
    ? opts.primary
    : opts.primaryBias && Math.random() < 0.6
      ? opts.primaryBias
      : pick(OFFENSIVE_POOL)

  // Orientation : armes offensives, boucliers défensifs, armures variées.
  const orientation: ItemOrientation =
    opts.orientation ?? (isWeapon ? 'offensif' : isShield ? 'defensif' : pick(['offensif', 'equilibre', 'equilibre', 'defensif'] as ItemOrientation[]))
  const offFrac = ORIENTATION_FRAC[orientation]

  const budget = opts.ilvl * typeMeta.weight * rarity.statMult
  const primaryValue = Math.max(1, Math.round(budget * offFrac * (0.85 + Math.random() * 0.3)))
  // Toute pièce donne de l'Endurance (la survie scale) ; davantage si défensive. Multiplicateur relevé
  // (1.4 → 1.9) : les PV suivaient mal la montée des dégâts ennemis → le stuff donne plus d'Endurance.
  const endurance = Math.max(1, Math.round(budget * (1 - offFrac) * 1.9 * (0.85 + Math.random() * 0.3)))

  const affixes = rollAffixes(rarity.affixCount, opts.ilvl, rarity.statMult, rarity.tier, opts)
  const unique = rollUnique(rarity.tier)

  // Type de dégâts : uniquement sur l'arme principale (Physique plus fréquent).
  const damageType: DamageType | undefined = isWeapon
    ? opts.element ?? opts.forceDmgType ??
      (Math.random() < 0.35 ? 'physique' : pick(DAMAGE_TYPE_LIST.filter((t) => t !== 'physique')))
    : undefined

  const suffix =
    isWeapon && damageType && damageType !== 'physique'
      ? `de ${DAMAGE_TYPES[damageType].name}`
      : pick(SUFFIXES)
  const name = `${pick(PREFIXES[primary])} ${NOUNS[type]} ${suffix}`

  return {
    id: `item-${ID_PREFIX}-${nextId++}`,
    name,
    type,
    rarity: rarityId,
    ilvl: opts.ilvl,
    primary,
    primaryValue,
    endurance,
    orientation,
    affixes,
    ...(damageType ? { damageType } : {}),
    ...(unique ? { unique } : {}),
  }
}

/**
 * Tire une rareté pour un coffre : distribution pondérée (favorise le bas de la fourchette)
 * entre minTier et maxTier, avec une petite chance de JACKPOT au-dessus de maxTier.
 * `decay` (0→1) règle l'inclinaison : proche de 1, la distribution s'aplatit et remonte
 * vers les hautes raretés (utilisé par les raids pour scaler avec le tier).
 */
export function rollBoxRarity(minTier: number, maxTier: number, jackpot: number, decay = 0.62): RarityId {
  const weights: number[] = []
  for (let t = minTier; t <= maxTier; t++) weights.push(Math.pow(decay, t - minTier))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let tier = minTier
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { tier = minTier + i; break } }
  if (Math.random() < jackpot) tier += 1 + Math.floor(Math.random() * 4) // jackpot : +1 à +4 crans
  tier = Math.max(1, Math.min(16, tier))
  return (RARITY_LIST.find((x) => x.tier === tier) ?? RARITY_LIST[0]).id
}

/** Stats totales apportées par un objet (primaire + endurance + affixes 'stat' + uniques + rune). */
export function itemStatBlock(item: Item): Record<string, number> {
  const block: Record<string, number> = { [item.primary]: item.primaryValue }
  if (item.endurance) block.endurance = (block.endurance ?? 0) + item.endurance
  for (const a of item.affixes) if (a.kind === 'stat' && a.stat) block[a.stat] = (block[a.stat] ?? 0) + a.value
  if (item.unique) {
    const mods = instanceMods(item.unique, item)
    for (const k in mods) block[k] = (block[k] ?? 0) + (mods[k as keyof typeof mods] ?? 0)
  }
  if (item.enchant) {
    const em = enchantMods(item)
    for (const k in em) block[k] = (block[k] ?? 0) + (em[k as keyof typeof em] ?? 0)
  }
  return block
}

/** L'objet porte-t-il une stat RARE (vol de vie / surpuissance / multifrappe / récupération) ? */
export function itemHasRareStat(item: Item): boolean {
  return item.affixes.some((a) => a.kind === 'stat' && a.stat != null && (RARE_STATS as string[]).includes(a.stat))
}

/** Score brut d'un objet pour comparer rapidement (somme pondérée). */
export function itemScore(item: Item): number {
  const block = itemStatBlock(item)
  let sum = 0
  for (const k in block) sum += block[k]
  let typeSum = 0
  let resistSum = 0
  for (const a of item.affixes) {
    if (a.kind === 'dmgType') typeSum += a.value * 2
    else if (a.kind === 'resist') resistSum += a.value * 3
  }
  let gemSum = 0
  for (const g of item.gems ?? []) gemSum += gemScore(g)
  // La stat primaire pèse double, un effet unique, les gemmes et les lignes de type comptent.
  return sum + item.primaryValue + typeSum + resistSum + gemSum + (item.unique ? 150 : 0)
}

/** Or obtenu en vendant l'objet (récompense croissante avec la rareté). */
export function sellValue(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  return Math.max(1, Math.round(item.ilvl * (0.4 + tier * 0.3) + 4 * Math.pow(tier, 1.6)))
}

/** Éclats d'arcane obtenus en recyclant l'objet (récompense croissante avec la rareté). */
export function recycleValue(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  return Math.max(1, Math.round(3 * Math.pow(tier, 1.8) + item.ilvl * 0.2)) + (item.unique ? tier * 2 : 0)
}

/** Recyclage de haute rareté : Poussière d'étoile gagnée (matériau rare de craft). */
export function recyclePoussiere(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  if (tier < 11) return 0 // Céleste+
  return (tier - 10) + (item.unique ? 1 : 0)
}

// ---- Craft : améliorer un objet ----

export const SURILLVL_STEP = 2

/** Coût en éclats d'une reforge. */
export function reforgeCost(item: Item): number {
  return Math.round(item.ilvl * 2.5 * RARITIES[item.rarity].tier)
}

/** Coût en éclats d'un surillvl (+SURILLVL_STEP ilvl). */
export function surillvlCost(item: Item): number {
  return Math.round(item.ilvl * 3.5 * RARITIES[item.rarity].tier)
}

export interface CraftCost { eclats: number; noyau: number; fragments?: number; poussiere?: number; cosmic?: number }

/**
 * Plancher d'iLvl par rareté : tier de rareté MAX qu'un drop aléatoire de cet iLvl peut atteindre.
 * Empêche une haute rareté d'apparaître sur un objet de bas iLvl (anti « ilvl 30 transcendant »).
 * Les coffres/raids/craft à rareté forcée ne passent pas par ici.
 */
export function maxRarityTierForIlvl(ilvl: number): number {
  return Math.max(1, Math.min(16, 6 + Math.floor(ilvl / 16)))
}

/**
 * Coûts de MATÉRIAUX RARES de craft par tier de rareté (refonte v0.18). Indexés par tier.
 * - Noyaux 💠 dès Rare (t4) · Poussière 🌌 dès Légendaire (t6) · Fragments ✨ dès Mythique (t9)
 *   · Éclat cosmique 💫 dès Cosmique (t13). Les quantités montent FORT (les raids en crachent beaucoup).
 */
const CRAFT_NOYAU: Record<number, number> = { 4: 10, 5: 50, 6: 200, 7: 600, 8: 1500, 9: 3500, 10: 7000, 11: 13000, 12: 24000, 13: 42000, 14: 70000, 15: 115000, 16: 180000 }
const CRAFT_POUSSIERE: Record<number, number> = { 6: 10, 7: 30, 8: 80, 9: 200, 10: 450, 11: 900, 12: 1700, 13: 3000, 14: 5000, 15: 8000, 16: 13000 }
const CRAFT_FRAGMENTS: Record<number, number> = { 9: 5, 10: 15, 11: 40, 12: 90, 13: 180, 14: 320, 15: 550, 16: 900 }
const CRAFT_COSMIC: Record<number, number> = { 13: 5, 14: 20, 15: 50, 16: 120 }

/** Multiplicateur d'iLvl appliqué aux matériaux (forger un iLvl élevé coûte plus — doux, ~×1 à 60, ~×3 à 540). */
function craftIlvlMult(ilvl: number): number {
  return 1 + Math.max(0, ilvl - 60) / 240
}

/**
 * Coût en ÉCLATS d'arcane d'un craft. Les éclats sont la ressource ABONDANTE (recyclage de masse
 * + achat en or) → c'est un GROS puits qui croît fort avec la rareté et l'iLvl, bien au-dessus
 * du nombre de noyaux/poussière (matériaux rares farmés en donjon).
 */
function craftEclats(tier: number, ilvl: number): number {
  return Math.round(300 * Math.pow(tier, 2.2) + ilvl * tier * 12)
}

/** Assemble un coût en matériaux pour un tier cible donné, avec un facteur global (ascension < création). */
function materialCost(tier: number, ilvl: number, factor: number): Omit<CraftCost, 'eclats'> {
  const m = craftIlvlMult(ilvl)
  const noyau = Math.round((CRAFT_NOYAU[tier] ?? 0) * factor * m)
  const poussiere = Math.round((CRAFT_POUSSIERE[tier] ?? 0) * factor * m)
  const fragments = Math.round((CRAFT_FRAGMENTS[tier] ?? 0) * factor * m)
  const cosmic = Math.round((CRAFT_COSMIC[tier] ?? 0) * factor * m)
  return {
    noyau,
    ...(poussiere > 0 ? { poussiere } : {}),
    ...(fragments > 0 ? { fragments } : {}),
    ...(cosmic > 0 ? { cosmic } : {}),
  }
}

/** Coût d'une ascension de rareté → calé sur le tier CIBLE, à un facteur réduit (l'objet de base existe déjà). */
export function ascendCost(item: Item): CraftCost {
  const nt = RARITIES[item.rarity].tier + 1
  return {
    eclats: Math.round(craftEclats(nt, item.ilvl) * 0.7),
    ...materialCost(nt, item.ilvl, 0.55),
  }
}

// ---- Craft : créer un objet ----

/** Rareté max forgeable selon la meilleure progression (mêmes paliers que le loot). */
export function maxCraftTier(bestStage: number): number {
  return Math.min(16, 8 + Math.floor(bestStage / 8))
}

/** Coût de création d'un objet d'une rareté/ilvl donnés (éclats scalent rareté+iLvl ; matériaux par table). */
export function createCost(rarityTier: number, ilvl: number): CraftCost {
  return {
    eclats: craftEclats(rarityTier, ilvl),
    ...materialCost(rarityTier, ilvl, 1),
  }
}

/** Rareté suivante, ou null si déjà au maximum. */
export function nextRarity(r: RarityId): RarityId | null {
  const next = RARITY_LIST.find((x) => x.tier === RARITIES[r].tier + 1)
  return next ? next.id : null
}

/** Reroll des lignes, en conservant les index verrouillés. */
export function reforgeItem(item: Item, locked: number[]): Affix[] {
  const lockedSet = new Set(locked)
  const kept = item.affixes.filter((_, i) => lockedSet.has(i))
  const used = new Set(kept.map(affixKey))
  const tier = RARITIES[item.rarity].tier
  const statMult = RARITIES[item.rarity].statMult
  const pool = buildPool().filter((s) => !used.has(lineKey(s)))
  const fresh: Affix[] = []
  const rerollCount = item.affixes.length - kept.length
  for (let i = 0; i < rerollCount && pool.length; i++) {
    const total = pool.reduce((a, s) => a + s.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let j = 0; j < pool.length; j++) { r -= pool[j].weight; if (r <= 0) { idx = j; break } }
    const spec = pool.splice(idx, 1)[0]
    fresh.push(specToAffix(spec, rollLineValue(spec, item.ilvl, statMult, tier)))
  }
  return [...kept, ...fresh]
}

/** Augmente l'ilvl de l'objet et rescale ses stats (les lignes % ne scalent pas). */
export function surillvlItem(item: Item, step = SURILLVL_STEP): Pick<Item, 'ilvl' | 'primaryValue' | 'endurance' | 'affixes'> {
  const newIlvl = item.ilvl + step
  const ratio = newIlvl / item.ilvl
  return {
    ilvl: newIlvl,
    primaryValue: Math.round(item.primaryValue * ratio),
    endurance: Math.round(item.endurance * ratio),
    affixes: item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.round(a.value * ratio) } : a)),
  }
}

/** Monte l'objet d'un cran de rareté : rescale, +1 ligne, chance d'unique. */
export function ascendItem(item: Item): Partial<Item> | null {
  const nr = nextRarity(item.rarity)
  if (!nr) return null
  const ratio = RARITIES[nr].statMult / RARITIES[item.rarity].statMult
  const tier = RARITIES[nr].tier
  const affixes = item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.round(a.value * ratio) } : a))
  const used = new Set(affixes.map(affixKey))
  const pool = buildPool().filter((s) => !used.has(lineKey(s)))
  if (pool.length) {
    const total = pool.reduce((a, s) => a + s.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let j = 0; j < pool.length; j++) { r -= pool[j].weight; if (r <= 0) { idx = j; break } }
    const spec = pool[idx]
    affixes.push(specToAffix(spec, rollLineValue(spec, item.ilvl, RARITIES[nr].statMult, tier)))
  }
  const unique = item.unique ?? rollUnique(RARITIES[nr].tier)
  return {
    rarity: nr,
    primaryValue: Math.round(item.primaryValue * ratio),
    endurance: Math.round(item.endurance * ratio),
    affixes,
    ...(unique ? { unique } : {}),
  }
}

/** Transmute l'affinité (stat primaire offensive) d'un objet. Coût en éclats. */
export function transmuteCost(item: Item): number {
  return Math.round(item.ilvl * 1.5 * RARITIES[item.rarity].tier)
}

// ---- Quintessences élémentaires (craft typé, ressource ultra-rare par biome) ----

/**
 * Coût de base d'une amélioration de ligne typée (en Quintessences). Élevé même la 1re fois :
 * la Quintessence ne tombe qu'à ~1% sur les ennemis du biome → 4 unités ≈ ~400 kills.
 */
export const QUINT_BASE_COST = 4
/** Croissance exponentielle du coût par niveau : 4 → 8 → 16 → 32 … (puits sans fin). */
export const QUINT_GROWTH = 2
/** Fraction de Quintessence remboursée au recyclage d'un objet renforcé. */
export const QUINT_RECYCLE_REFUND = 0.75
/** Gain de valeur par amélioration : +% dégâts (dmgType) ou +% résistance (resist). */
export const QUINT_GAIN = { dmgType: 6, resist: 3 } as const
/** Valeur de départ d'une ligne typée AJOUTÉE par Quintessence (avant la 1re amélioration). */
const QUINT_STARTER = { dmgType: 8, resist: 4 } as const

/** Coût (en Quintessences du type) pour passer du niveau `level` au niveau `level + 1`. */
export function quintCost(level: number): number {
  return QUINT_BASE_COST * Math.pow(QUINT_GROWTH, Math.max(0, level))
}

/** Quintessences totales déjà investies pour atteindre `level` améliorations (somme géométrique). */
export function quintInvestedForLevel(level: number): number {
  let sum = 0
  for (let i = 0; i < level; i++) sum += quintCost(i)
  return sum
}

/** Quintessences investies dans un objet, par type (pour le remboursement au recyclage). */
export function quintInvested(item: Item): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {}
  for (const a of item.affixes) {
    if ((a.kind === 'dmgType' || a.kind === 'resist') && a.type && (a.upgraded ?? 0) > 0) {
      out[a.type] = (out[a.type] ?? 0) + quintInvestedForLevel(a.upgraded ?? 0)
    }
  }
  return out
}

/** Quintessences remboursées au recyclage d'un objet (75% de l'investi), par type. */
export function quintRefund(item: Item): Partial<Record<DamageType, number>> {
  const inv = quintInvested(item)
  const out: Partial<Record<DamageType, number>> = {}
  for (const t in inv) out[t as DamageType] = Math.floor((inv[t as DamageType] ?? 0) * QUINT_RECYCLE_REFUND)
  return out
}

/**
 * Améliore (ou ajoute) la ligne typée d'un objet via une Quintessence.
 * Renvoie les nouveaux affixes + le coût en Quintessences, ou null si rien à faire.
 */
export function enhanceTypedAffixes(
  item: Item, type: DamageType, kind: 'dmgType' | 'resist',
): { affixes: Affix[]; cost: number } | null {
  const idx = item.affixes.findIndex((a) => a.kind === kind && a.type === type)
  if (idx >= 0) {
    const a = item.affixes[idx]
    const level = a.upgraded ?? 0
    const cost = quintCost(level)
    const next: Affix = { ...a, value: a.value + QUINT_GAIN[kind], upgraded: level + 1 }
    const affixes = item.affixes.map((x, i) => (i === idx ? next : x))
    return { affixes, cost }
  }
  // Pas de ligne de ce (type, kind) : on en AJOUTE une (coût = 1re amélioration).
  const cost = quintCost(0)
  const fresh: Affix = { kind, type, value: QUINT_STARTER[kind], upgraded: 1 }
  return { affixes: [...item.affixes, fresh], cost }
}
