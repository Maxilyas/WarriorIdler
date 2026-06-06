import type { Affix, Item, PrimaryStat, OffensiveStat, ItemOrientation, ItemType, SecondaryStat, RarityId, DamageType, TypeAffix } from './types'
import { RARITIES, RARITY_LIST, rollRarity } from './rarities'
import { SECONDARY_STATS } from './stats'
import { ITEM_TYPES } from './slots'
import { rollUnique, instanceMods } from './uniques'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from './damage'

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

function rollAffixes(count: number, ilvl: number, statMult: number): Affix[] {
  const pool: SecondaryStat[] = [...SECONDARY_STATS]
  const chosen: Affix[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    const stat = pool.splice(idx, 1)[0]
    const base = ilvl * 0.8 * statMult
    const value = Math.max(1, Math.round(base * (0.7 + Math.random() * 0.6)))
    chosen.push({ stat, value })
  }
  return chosen
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
}

const OFFENSIVE_POOL: OffensiveStat[] = ['force', 'agilite', 'intelligence']
/** Part du budget allouée à l'offensif (le reste va en Endurance). */
const ORIENTATION_FRAC: Record<ItemOrientation, number> = { offensif: 0.82, equilibre: 0.55, defensif: 0.3 }

/** Génère un objet aléatoire complet. */
export function generateItem(opts: GenerateOptions): Item {
  const type = opts.type ?? pick(ITEM_TYPE_LIST)
  const typeMeta = ITEM_TYPES[type]
  const rarityId = opts.rarity ?? rollRarity(opts.luckTier ?? 0)
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
  // Toute pièce donne de l'Endurance (la survie scale) ; davantage si défensive.
  const endurance = Math.max(1, Math.round(budget * (1 - offFrac) * 1.4 * (0.85 + Math.random() * 0.3)))

  const affixes = rollAffixes(rarity.affixCount, opts.ilvl, rarity.statMult)
  const unique = rollUnique(rarity.tier)

  // Type de dégâts : uniquement sur l'arme principale (Physique plus fréquent).
  const damageType: DamageType | undefined = isWeapon
    ? opts.element ??
      (Math.random() < 0.35 ? 'physique' : pick(DAMAGE_TYPE_LIST.filter((t) => t !== 'physique')))
    : undefined

  const typeAffixes = rollTypeAffixes(rarity.tier)

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
    ...(typeAffixes.length ? { typeAffixes } : {}),
    ...(unique ? { unique } : {}),
  }
}

/** Tire 0 à 2 affixes de dégâts élémentaires selon la rareté. */
function rollTypeAffixes(rarityTier: number): TypeAffix[] {
  const out: TypeAffix[] = []
  const maxCount = rarityTier >= 7 ? 2 : 1
  const elements = DAMAGE_TYPE_LIST.filter((t) => t !== 'physique')
  const pool = [...elements]
  for (let i = 0; i < maxCount; i++) {
    // Probabilité décroissante d'un affixe élémentaire.
    const chance = rarityTier >= 3 ? 0.4 - i * 0.2 : 0.15
    if (Math.random() > chance) break
    const idx = Math.floor(Math.random() * pool.length)
    const type = pool.splice(idx, 1)[0]
    const value = Math.round((10 + Math.random() * 15) * (1 + rarityTier * 0.12))
    out.push({ type, value })
  }
  return out
}

/** Stats totales apportées par un objet (primaire + endurance + affixes + mods uniques). */
export function itemStatBlock(item: Item): Record<string, number> {
  const block: Record<string, number> = { [item.primary]: item.primaryValue }
  if (item.endurance) block.endurance = (block.endurance ?? 0) + item.endurance
  for (const a of item.affixes) block[a.stat] = (block[a.stat] ?? 0) + a.value
  if (item.unique) {
    const mods = instanceMods(item.unique)
    for (const k in mods) block[k] = (block[k] ?? 0) + (mods[k as keyof typeof mods] ?? 0)
  }
  return block
}

/** Score brut d'un objet pour comparer rapidement (somme pondérée). */
export function itemScore(item: Item): number {
  const block = itemStatBlock(item)
  let sum = 0
  for (const k in block) sum += block[k]
  const typeSum = (item.typeAffixes ?? []).reduce((s, t) => s + t.value * 2, 0)
  // La stat primaire pèse double, un effet unique et les dégâts de type comptent.
  return sum + item.primaryValue + typeSum + (item.unique ? 100 : 0)
}

/** Or obtenu en vendant l'objet. */
export function sellValue(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  return Math.max(1, Math.round(item.ilvl * (0.5 + tier * 0.4)))
}

/** Éclats d'arcane obtenus en recyclant l'objet. */
export function recycleValue(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  return Math.max(1, Math.round(tier * 2 + item.ilvl * 0.15)) + (item.unique ? tier : 0)
}

// ---- Craft : améliorer un objet ----

export const SURILLVL_STEP = 2

/** Coût en éclats d'une reforge. */
export function reforgeCost(item: Item): number {
  return Math.round(item.ilvl * 2 * RARITIES[item.rarity].tier)
}

/** Coût en éclats d'un surillvl (+SURILLVL_STEP ilvl). */
export function surillvlCost(item: Item): number {
  return Math.round(item.ilvl * 3 * RARITIES[item.rarity].tier)
}

/** Coût d'une ascension de rareté (Noyau primordial + éclats). */
export function ascendCost(item: Item): { noyau: number; eclats: number } {
  const t = RARITIES[item.rarity].tier
  return { noyau: Math.max(1, Math.ceil(t / 2)), eclats: Math.round(item.ilvl * 5 * t) }
}

// ---- Craft : créer un objet ----

/** Rareté max forgeable selon la meilleure progression (mêmes paliers que le loot). */
export function maxCraftTier(bestStage: number): number {
  return Math.min(16, 8 + Math.floor(bestStage / 8))
}

/** Coût de création d'un objet d'une rareté/ilvl donnés. */
export function createCost(rarityTier: number, ilvl: number): { eclats: number; noyau: number } {
  return {
    eclats: Math.round(30 * Math.pow(rarityTier, 1.8) + ilvl * rarityTier * 2),
    noyau: rarityTier >= 9 ? rarityTier - 8 : 0,
  }
}

/** Rareté suivante, ou null si déjà au maximum. */
export function nextRarity(r: RarityId): RarityId | null {
  const next = RARITY_LIST.find((x) => x.tier === RARITIES[r].tier + 1)
  return next ? next.id : null
}

/** Reroll des affixes secondaires, en conservant les index verrouillés. */
export function reforgeItem(item: Item, locked: number[]): Affix[] {
  const lockedSet = new Set(locked)
  const kept = item.affixes.filter((_, i) => lockedSet.has(i))
  const used = new Set(kept.map((a) => a.stat))
  const pool = SECONDARY_STATS.filter((s) => !used.has(s))
  const statMult = RARITIES[item.rarity].statMult
  const fresh: Affix[] = []
  const rerollCount = item.affixes.length - kept.length
  for (let i = 0; i < rerollCount && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    const stat = pool.splice(idx, 1)[0]
    const base = item.ilvl * 0.8 * statMult
    fresh.push({ stat, value: Math.max(1, Math.round(base * (0.7 + Math.random() * 0.6))) })
  }
  return [...kept, ...fresh]
}

/** Augmente l'ilvl de l'objet et rescale ses stats. */
export function surillvlItem(item: Item): Pick<Item, 'ilvl' | 'primaryValue' | 'endurance' | 'affixes'> {
  const newIlvl = item.ilvl + SURILLVL_STEP
  const ratio = newIlvl / item.ilvl
  return {
    ilvl: newIlvl,
    primaryValue: Math.round(item.primaryValue * ratio),
    endurance: Math.round(item.endurance * ratio),
    affixes: item.affixes.map((a) => ({ ...a, value: Math.round(a.value * ratio) })),
  }
}

/** Monte l'objet d'un cran de rareté : rescale, +1 affixe, chance d'unique. */
export function ascendItem(item: Item): Partial<Item> | null {
  const nr = nextRarity(item.rarity)
  if (!nr) return null
  const ratio = RARITIES[nr].statMult / RARITIES[item.rarity].statMult
  const affixes = item.affixes.map((a) => ({ ...a, value: Math.round(a.value * ratio) }))
  const used = new Set(affixes.map((a) => a.stat))
  const pool = SECONDARY_STATS.filter((s) => !used.has(s))
  if (pool.length) {
    const stat = pool[Math.floor(Math.random() * pool.length)]
    const base = item.ilvl * 0.8 * RARITIES[nr].statMult
    affixes.push({ stat, value: Math.max(1, Math.round(base * (0.7 + Math.random() * 0.6))) })
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
