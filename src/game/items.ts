import type { Affix, Item, PrimaryStat, OffensiveStat, ItemOrientation, ItemType, SecondaryStat, RarityId, DamageType } from './types'
import { RARITIES, RARITY_LIST, rollRarity } from './rarities'
import { RARE_STATS, softCap } from './stats'
import { ITEM_TYPES } from './slots'
import { rollUnique, instanceMods, type UniqueSource } from './uniques'
import { rollSockets } from './gems'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from './damage'
import { itemBudget, effItemIlvl, clampIlvl, powerAt, RARITY_ILVL_PER_TIER, CHAPITRE_SIZE, lootFarmIlvl } from './progression'

/** v0.30.1 — lignes de stat secondaire : PROPORTIONNELLES au budget exponentiel (poids SECONDARY_FRAC)
 *  → même échelle que le primaire à bas ilvl (fini « primaire 2 vs crit 66 »), MAIS plafonnées à
 *  SECONDARY_CAP (rating) une fois le mid-game atteint. Le plafond garde le % borné (compatible avec
 *  le /PER_PCT fixe dont dépendent talents/sets) et le TTL plat en endgame, tout en restant toujours
 *  < primaire (≈0,43× : SECONDARY_FRAC/offFrac). */
export const SECONDARY_FRAC = 0.7 // v0.35 : 0,35→0,7 (reste < offFrac 0,82 → le nombre primaire domine encore)
/** Soft cap du RATING d'une ligne secondaire : transition DOUCE vers SECONDARY_HARD (pas de saut net
 *  quand le budget dépasse le seuil, contrairement à un min() — évite le « kink » de DPS au mid-game). */
export const SECONDARY_SOFT = 400
export const SECONDARY_HARD = 700

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
  reductionDegats: 8, barriere: 7, resilience: 8,
  volDeVie: 0.6, surpuissance: 0.3, multifrappe: 0.3, recuperation: 0.3,
  // v0.38 — DÉPRÉCIÉES (poids 0 = ne rollent plus) : Esquive→Réduction, Ténacité+Purge→Résilience, Régén retirée.
  esquive: 0, tenacite: 0, purge: 0, regen: 0,
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

/** Valeur d'une ligne « +% dégâts du type » : base aléatoire × croissance par tier de rareté.
 *  Exportées pour le harnais d'équilibrage (scripts/stat-weights.mjs).
 *  v0.22 : 10..25 ×(1+0.12·tier) → 8..20 ×(1+0.07·tier) — couplé au soft cap de damage.ts. */
export const DMG_LINE_BASE = 8
export const DMG_LINE_RANGE = 12
export const DMG_LINE_TIER_GROWTH = 0.07

function rollLineValue(spec: LineSpec, ilvl: number, qMult: number, tier: number): number {
  if (spec.kind === 'stat') {
    const soft = RARE_STATS.includes(spec.stat) ? 0.5 : 1 // stats rares modérées (rares mais fortes)
    // v0.30.1 : PROPORTIONNEL au budget (poids SECONDARY_FRAC) puis SOFT-CAPÉ → à bas ilvl ça suit le
    // primaire (×0,43, lisible & proportionnel) ; au mid-game ça plafonne EN DOUCEUR (rating borné →
    // % borné → TTK plat, et toujours < primaire qui, lui, continue en b^ilvl).
    const base = softCap(itemBudget(ilvl, tier, SECONDARY_FRAC, qMult), SECONDARY_SOFT * qMult, SECONDARY_HARD * qMult) * soft
    return Math.max(1, Math.round(base * (0.7 + Math.random() * 0.6)))
  }
  if (spec.kind === 'dmgType') return Math.round((DMG_LINE_BASE + Math.random() * DMG_LINE_RANGE) * (1 + tier * DMG_LINE_TIER_GROWTH))
  // Résistance en POINTS (v0.24, plus de cap %) : scale avec la rareté — la course à l'armement
  // des raids se gagne en empilant ces lignes (Req des boss v0.25.x : ~100 au T1 → ~430 au T10).
  return Math.round((6 + Math.random() * 10) * (1 + tier * 0.09))
}

function specToAffix(spec: LineSpec, value: number): Affix {
  if (spec.kind === 'stat') return { kind: 'stat', stat: spec.stat, value }
  return { kind: spec.kind, type: spec.type, value }
}

/** Tire `count` lignes distinctes depuis le pool pondéré, en garantissant des lignes ciblées.
 *  `qMult` = multiplicateur de qualité (les lignes de stat secondaire en profitent un peu). */
function rollAffixes(count: number, ilvl: number, qMult: number, tier: number, opts: GenerateOptions): Affix[] {
  const used = new Set<string>()
  const out: Affix[] = []

  const force = (spec: LineSpec) => {
    if (out.length >= count || used.has(lineKey(spec))) return
    used.add(lineKey(spec))
    out.push(specToAffix(spec, rollLineValue(spec, ilvl, qMult, tier)))
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
    out.push(specToAffix(spec, rollLineValue(spec, ilvl, qMult, tier)))
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
  /** 🕳️ Tisse-châsse (rune v0.26) : chance SUPPLÉMENTAIRE d'ajouter une châsse au drop. */
  socketLuck?: number
  /** v0.27 — qualité FORCÉE (1..5). Sinon roulée. */
  stars?: number
  /** v0.27 — décalage de distribution de qualité (forge « Main de maître »). */
  starsFin?: number
  /** v0.27 — qualité PLANCHER (raids/coffres : du bon stuff). */
  minStars?: number
  /** v0.39.1 — source du drop : pilote l'éligibilité des uniques TAGGÉS (donjon/raid seulement).
   *  Omis = 'farm' (aucun unique taggé). Voir uniques.ts / TAGGED_DROP_RATE. */
  uniqueSource?: UniqueSource
}

const OFFENSIVE_POOL: OffensiveStat[] = ['force', 'agilite', 'intelligence']
/** Part du budget allouée à l'offensif (le reste va en Endurance). */
const ORIENTATION_FRAC: Record<ItemOrientation, number> = { offensif: 0.82, equilibre: 0.55, defensif: 0.3 }

/** Génère un objet aléatoire complet. */
export function generateItem(opts: GenerateOptions): Item {
  const type = opts.type ?? pick(ITEM_TYPE_LIST)
  const typeMeta = ITEM_TYPES[type]
  // v0.30 : cap DUR d'ilvl (aucun objet ne dépasse 700).
  const ilvl = clampIlvl(opts.ilvl)
  let rarityId = opts.rarity ?? rollRarity(opts.luckTier ?? 0)
  // Plancher d'iLvl par rareté (drops ALÉATOIRES uniquement) : une haute rareté ne peut pas
  // tomber sur un objet de bas iLvl → fini le « ilvl 30 abyssal qui remplace un ilvl 140 ».
  // Les coffres/raids/craft (rareté forcée) ne sont pas concernés (leur iLvl est déjà calé).
  if (!opts.rarity) {
    const capTier = maxRarityTierForIlvl(ilvl)
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

  // v0.27 — QUALITÉ unifiée : TOUT objet roule une qualité 1..5 (ex-⭐ Polissage, généralisé aux
  // drops). Elle agit sur le BUDGET (starsMult) ET le NOMBRE de lignes (qualityBonusAffixes).
  let stars = opts.stars ?? rollStars(opts.starsFin ?? 0)
  if (opts.minStars) stars = Math.max(stars, opts.minStars)
  stars = Math.max(1, Math.min(5, stars))
  const qMult = starsMult(stars)

  // v0.30 — BUDGET EXPONENTIEL en ilvl effectif (= ilvl + rareté ×3/cran). La stat primaire le porte
  // → DPS ∝ b^ilvl → TTK constant. La rareté n'est plus un multiplicateur de budget (qui se faisait
  // « cuber » par le DPS convexe) : c'est un bonus d'ilvl-équiv borné (cf. progression.ts).
  const budget = itemBudget(ilvl, rarity.tier, typeMeta.weight, qMult)
  const primaryValue = Math.max(1, Math.round(budget * offFrac * (0.85 + Math.random() * 0.3)))
  // Toute pièce donne de l'Endurance (la survie scale, même base b → EHP suit les dégâts ennemis).
  const endurance = Math.max(1, Math.round(budget * (1 - offFrac) * 1.9 * (0.85 + Math.random() * 0.3)))

  // La qualité AJOUTE des lignes au-dessus du plancher FIXE de la rareté (+0/+0/+1/+1/+2).
  // v0.32.2 : cap 7 → 9 (les hautes raretés montent jusqu'à 8 lignes de base ; +qualité au-dessus).
  const affixCount = Math.min(9, rarity.affixCount + qualityBonusAffixes(stars))
  const affixes = rollAffixes(affixCount, ilvl, qMult, rarity.tier, opts)
  const unique = rollUnique(rarity.tier, opts.uniqueSource)

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
    ilvl,
    primary,
    primaryValue,
    endurance,
    orientation,
    affixes,
    stars,
    // v0.25 : châsses RARES (roulées) · v0.26 : 🕳️ Tisse-châsse peut en ajouter une au drop.
    sockets: Math.min(3, rollSockets(rarity.tier) + (opts.socketLuck && Math.random() < opts.socketLuck ? 1 : 0)),
    ...(damageType ? { damageType } : {}),
    ...(unique ? { unique } : {}),
  }
}

/**
 * FENÊTRE À PIC (v0.24, DESIGN §4.0) — LA fonction de rareté unifiée du jeu (farm / Cache /
 * raids). Distribution « plancher → PIC → plafond » à DEUX PENTES géométriques :
 *  - sous le pic : `down` par cran (raide — le bas de fenêtre reste minoritaire),
 *  - au-dessus : « épaule » `shoulder` au premier cran, puis traîne `tail` par cran
 *    (TRÈS raide → le haut de fenêtre existe toujours, mais reste un événement).
 * Repère (fenêtre raid T1 v0.25.x, pic Légendaire) : ~56% Légendaire · 17% Artefact ·
 * 4% Patrimoine · 1% Mythique · … traîne infime jusqu'à Céleste.
 */
export function rollWindowRarity(
  floor: number, peak: number, cap: number,
  opts?: { down?: number; shoulder?: number; tail?: number },
): RarityId {
  const down = opts?.down ?? 0.30
  const shoulder = opts?.shoulder ?? 0.30
  const tail = opts?.tail ?? 0.25
  const lo = Math.max(1, Math.min(16, Math.round(floor)))
  const hi = Math.max(lo, Math.min(16, Math.round(cap)))
  const pk = Math.max(lo, Math.min(hi, Math.round(peak)))
  const weights: number[] = []
  for (let t = lo; t <= hi; t++) {
    weights.push(t <= pk ? Math.pow(down, pk - t) : shoulder * Math.pow(tail, t - pk - 1))
  }
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let tier = pk
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { tier = lo + i; break } }
  return (RARITY_LIST.find((x) => x.tier === tier) ?? RARITY_LIST[0]).id
}

/**
 * Fenêtre de rareté du FARM (paliers classiques) : le pic glisse de Commun (palier 1) à
 * Épique (~palier 54), plafond DUR à Légendaire — le farm n'est PAS la chasse à la rareté
 * (ça, c'est la Cache puis les raids). `shift` décale la fenêtre (élite +1, champion +2,
 * boss +1, karma/chance), toujours sous le plafond.
 */
export const FARM_RARITY_CAP = 6 // Légendaire
export function rollFarmRarity(stage: number, shift = 0): RarityId {
  const peak = Math.min(FARM_RARITY_CAP, Math.max(2, Math.min(5, 2 + Math.floor(stage / 18))) + shift)
  return rollWindowRarity(Math.max(1, peak - 2), peak, Math.min(FARM_RARITY_CAP, peak + 2))
}

// v0.36 — RARETÉ « DU CONTENU » = la rareté ATTEIGNABLE (tout contenu confondu), pas seulement le farm.
// C'est l'ancre de l'over-content (×4/cran AU-DESSUS d'elle) ET du rendement des donjons. Plus de cap à
// Légendaire : la Cache du Pilleur pousse à Artefact (~Ch.5), puis les raids montent vers Céleste+ (Ch.6+).
// → crafter ce qu'on peut atteindre ≈ 10-30 runs ; seul AU-DELÀ de l'atteignable explose (le vrai chase).
export function contentRarityTier(bestStage: number, bestRaidTier = 0): number {
  const chapter = Math.max(1, Math.ceil(bestStage / CHAPITRE_SIZE))
  // Cache du Pilleur : Artefact (t7) accessible DÈS le Chapitre 1, juste de plus en plus FACILE à crafter
  // sur les 5 premiers (la rampe = le coût qui baisse). C'est l'ancre des DONJONS (raid-agnostiques).
  const cacheReach = Math.min(7, 2 + chapter)
  // Raids : +1 rareté TOUS LES 2 TIERS, ancré T3→Éternel(t12), T5→Cosmique(t13), T7→Abyssal(t14).
  // PLAFOND = Abyssal (t14) : Primordial(t15) & Transcendant(t16) restent le CHASE (over-content = centaines de runs).
  const raidReach = bestRaidTier > 0 ? Math.min(14, 11 + Math.floor((bestRaidTier - 1) / 2)) : 0
  return Math.max(3, cacheReach, raidReach)
}

/**
 * v0.36 — RARETÉ ACCESSIBLE à un CHAPITRE donné (Cache plafond Artefact + raid GATÉ au Chapitre).
 * Reproduit la table validée par le joueur : Cache→Artefact sur les chapitres tuto, puis les raids
 * (T1 au mur du Ch.5, T(c−4) au mur du Ch.c) montent la rareté — +1/tier jusqu'à Céleste, puis +1
 * tous les 2 tiers (règle « 2 tiers = 1 rareté »), plafond Abyssal (Primordial/Transcendant = chase).
 *   Ch.1-4 → Artefact(7) · Ch.5-8 → Patrimoine→Céleste(8-11) · Ch.9+ → +1/2ch → Abyssal(14) max.
 * C'est l'ancre des RENDEMENTS de donjon ET des fragments/cosmique de raid (via le Chapitre = GT+4).
 */
export function accessibleRarityTier(chapter: number): number {
  const ch = Math.max(1, chapter)
  if (ch <= 4) return 7
  if (ch <= 8) return 3 + ch // 8,9,10,11 (raids T1-T4 : +1 rareté par tier)
  return Math.min(14, 11 + Math.floor((ch - 8) / 2)) // 11,11,12,12,13,13,14… (+1 tous les 2 tiers)
}

/** Cadence commune : un run/clear ≈ 1/CRAFT_RUNS_TARGET d'un craft à la rareté accessible. */
export const CRAFT_RUNS_TARGET = 10

/**
 * Rendement par run/clear d'un MATÉRIAU au Chapitre donné = coût d'un craft à la rareté ACCESSIBLE
 * (en ce matériau) ÷ cadence. 0 si le matériau n'existe pas encore à cette rareté (fragments < t8,
 * cosmique < t13). Source unique de vérité partagée par les donjons (niveau = Chapitre) ET les raids
 * (Chapitre = globalTier + 4) → fragments/cosmique de raid suivent la même courbe que les donjons.
 */
export function materialYieldAtChapter(material: keyof CraftCost, chapter: number): number {
  const ct = accessibleRarityTier(chapter)
  const ilvl = lootFarmIlvl(chapter * CHAPITRE_SIZE)
  const cost = createCost(ct, ilvl, ct)[material] ?? 0
  return cost > 0 ? Math.max(1, Math.round(cost / CRAFT_RUNS_TARGET)) : 0
}
/** Multiplicateur de coût « AU-DESSUS DU CONTENU » : ×OVER_CONTENT_STEEP par cran de rareté au-dessus
 *  de ce que le farm donne au Palier. +1 = ×4 (dizaines de runs), +2 = ×16 (centaines), +3 = ×64. */
export const OVER_CONTENT_STEEP = 4
export function overContentMult(targetTier: number, contentTier: number): number {
  return Math.pow(OVER_CONTENT_STEEP, Math.max(0, targetTier - contentTier))
}
function scaleCraftCost(c: CraftCost, m: number): CraftCost {
  if (m === 1) return c
  return {
    eclats: Math.round(c.eclats * m),
    noyau: Math.round(c.noyau * m),
    ...(c.poussiere ? { poussiere: Math.round(c.poussiere * m) } : {}),
    ...(c.fragments ? { fragments: Math.round(c.fragments * m) } : {}),
    ...(c.cosmic ? { cosmic: Math.round(c.cosmic * m) } : {}),
  }
}

/**
 * Tire une rareté pour un coffre : distribution pondérée (favorise le bas de la fourchette)
 * entre minTier et maxTier, avec une petite chance de JACKPOT au-dessus de maxTier.
 * `decay` (0→1) règle l'inclinaison : proche de 1, la distribution s'aplatit et remonte
 * vers les hautes raretés. (Coffres du marché — farm/Cache/raids utilisent rollWindowRarity.)
 */
export function rollBoxRarity(minTier: number, maxTier: number, jackpot: number, decay = 0.62, cap = 16): RarityId {
  const weights: number[] = []
  for (let t = minTier; t <= maxTier; t++) weights.push(Math.pow(decay, t - minTier))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let tier = minTier
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { tier = minTier + i; break } }
  if (Math.random() < jackpot) tier += 1 + Math.floor(Math.random() * 4) // jackpot : +1 à +4 crans
  tier = Math.max(1, Math.min(Math.min(16, cap), tier))
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
  // (v0.22 : les runes ne portent plus de stats — temps & règles uniquement.)
  return block
}

/** L'objet porte-t-il une stat RARE (vol de vie / surpuissance / multifrappe / récupération) ? */
export function itemHasRareStat(item: Item): boolean {
  return item.affixes.some((a) => a.kind === 'stat' && a.stat != null && (RARE_STATS as string[]).includes(a.stat))
}

/** Synthèse chiffrée d'un objet : nb de STATS distinctes (primaire + endurance + lignes + unique)
 *  et TOTAL de points de stats. Les lignes typées (+% dégâts / résist) ne sont pas des « points »
 *  comparables → comptées à part (`typedLines`). Affichée sur la fiche objet. */
export function itemStatTotals(item: Item): { count: number; total: number; typedLines: number } {
  const block = itemStatBlock(item)
  let count = 0
  let total = 0
  for (const k in block) {
    const v = block[k] ?? 0
    if (v <= 0) continue
    count++
    total += v
  }
  return { count, total, typedLines: item.affixes.filter((a) => a.kind !== 'stat').length }
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
  // Une gemme de condition vaut un forfait (comportement, pas des stats chiffrables).
  const gemSum = (item.gems?.length ?? 0) * 60
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

/** Croissance du coût par USAGE répété sur le même objet (reforge/surillvl) — v0.25.
 *  Sans elle, spammer à coût constant jusqu'au god-roll était l'optimum sans fond :
 *  ×1,18 par usage ≈ ×27 au 20e — une borne naturelle, pas un mur. */
export const CRAFT_REPEAT_GROWTH = 1.18

/** Coût en éclats d'une reforge. v0.25 : chaque ligne VERROUILLÉE multiplie le prix (+100%/verrou —
 *  cibler le god-roll se paie) et chaque reforge renchérit la suivante sur cet objet. */
export function reforgeCost(item: Item, lockedCount = 0): number {
  return Math.round(item.ilvl * 2.5 * RARITIES[item.rarity].tier * (1 + lockedCount) * Math.pow(CRAFT_REPEAT_GROWTH, item.reforgeCount ?? 0))
}

/** Marge d'iLvl tolérée AU-DESSUS de l'iLvl max du contenu débloqué (paliers/donjons/raids).
 *  v0.25.x : le surillvl est PLAFONNÉ à contenu + marge — l'atelier suit la progression,
 *  il ne la remplace pas (avant : +30 iLvl au-dessus de tout contenu était accessible). */
export const SURILLVL_OVER_MARGIN = 6
/** Sur-coût par pas AU-DESSUS de l'iLvl de contenu : ×4 par pas (×4 → ×16 → ×64) —
 *  les derniers iLvl de la marge sont un luxe hors de prix, pas une routine. */
export const SURILLVL_OVER_COST_MULT = 4

/** Coût en éclats d'un surillvl (+SURILLVL_STEP ilvl). v0.25 : géométrique par usage.
 *  `overSteps` = nb de pas du résultat AU-DESSUS de l'iLvl de contenu (sur-coût ×4 par pas). */
export function surillvlCost(item: Item, overSteps = 0): number {
  return Math.round(
    item.ilvl * 3.5 * RARITIES[item.rarity].tier
    * Math.pow(CRAFT_REPEAT_GROWTH, item.surCount ?? 0)
    * Math.pow(SURILLVL_OVER_COST_MULT, Math.max(0, overSteps)),
  )
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
// v0.25 — FRAGMENTS RECALÉS sur le principe « un craft de rareté r ≈ 5 clears du raid dont le PIC
// de loot est r » (revenu ✨ ≈ tier+1/clear). Avant : t9 = 5 ✨ → ~2 clears T1 offraient un objet
// 4 crans AU-DESSUS de la fenêtre du contenu (pic Épique). Démarre désormais à t8 (les fragments
// n'existent qu'en raid → le craft t8+ est arrimé aux raids).
const CRAFT_FRAGMENTS: Record<number, number> = { 8: 15, 9: 40, 10: 70, 11: 120, 12: 200, 13: 320, 14: 500, 15: 750, 16: 1100 }
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

/**
 * Coût d'une ascension de rareté → calé sur le tier CIBLE, à un facteur MAJORÉ (v0.25.x).
 * Ascensionner GARDE l'objet (lignes, unique, gemmes, rune) et ajoute une ligne : c'est strictement
 * meilleur qu'une création ALÉATOIRE du même tier → ça doit coûter PLUS cher, pas moitié prix.
 * Avant : éclats ×0.7 / matériaux ×0.55 — monter son BiS coûtait ~2× moins que forger un inconnu.
 */
export function ascendCost(item: Item, contentTier = Infinity): CraftCost {
  const nt = RARITIES[item.rarity].tier + 1
  const base: CraftCost = {
    eclats: Math.round(craftEclats(nt, item.ilvl) * 1.15),
    ...materialCost(nt, item.ilvl, 1.35),
  }
  // v0.35 — monter une rareté AU-DESSUS du contenu explose le coût (×4/cran) → dizaines→centaines de runs.
  return scaleCraftCost(base, overContentMult(nt, contentTier))
}

// ---- Craft : créer un objet ----

/**
 * v0.25 — VERROU RAID du craft (miroir du marché, boxRaidGate) : crafter/ascensionner un cran t
 * exige d'avoir vaincu un tier de raid ≥ t−8 (Mythique→T1 … Céleste→T3 … Transcendant→T8).
 * Même en STOCKANT des fragments, un tas de ✨ n'achète jamais un cran au-dessus de ton contenu.
 */
export function craftRaidGate(rarityTier: number): number {
  return Math.max(0, rarityTier - 8)
}

/** Rareté max forgeable : double horloge — palier de farm ET meilleur tier de raid vaincu. */
export function maxCraftTier(bestStage: number, bestRaidTier = 0): number {
  return Math.min(16, 8 + Math.floor(bestStage / 8), 8 + bestRaidTier)
}

/** Coût de création d'un objet d'une rareté/ilvl donnés (éclats scalent rareté+iLvl ; matériaux par table). */
export function createCost(rarityTier: number, ilvl: number, contentTier = Infinity): CraftCost {
  const base: CraftCost = {
    eclats: craftEclats(rarityTier, ilvl),
    ...materialCost(rarityTier, ilvl, 1),
  }
  // v0.35 — forger une rareté AU-DESSUS du contenu explose le coût (×4/cran) → c'est le chase, pas du farm.
  return scaleCraftCost(base, overContentMult(rarityTier, contentTier))
}

/* ---- ⭐ QUALITÉ unifiée (v0.27, ex-Polissage Forgeron) : 1–5 sur TOUT le stuff, drop & craft ----
 * 1 Grossier · 2 Standard · 3 Fin · 4 Supérieur · 5 Chef-d'œuvre.
 * Agit sur le BUDGET (starsMult) ET le NOMBRE de lignes (qualityBonusAffixes). Le nombre de lignes
 * reste FIXE par rareté (plancher) ; la qualité est le SEUL levier qui en ajoute. */

export const QUALITY_NAMES = ['Grossier', 'Standard', 'Fin', 'Supérieur', 'Chef-d\'œuvre']
export const QUALITY_COLORS = ['#94a3b8', '#cbd5e1', '#86efac', '#5eead4', '#fcd34d']
/** Index 0..4 borné (qualité absente = Standard, pour le stuff d'avant v0.27). */
function qIdx(stars?: number): number { return Math.max(0, Math.min(4, (stars ?? 2) - 1)) }
export function qualityName(stars?: number): string { return QUALITY_NAMES[qIdx(stars)] }
export function qualityColor(stars?: number): string { return QUALITY_COLORS[qIdx(stars)] }
/** Lignes BONUS apportées par la qualité : +0/+0/+1/+1/+2 (Grossier→Chef-d'œuvre). KNOB d'équilibrage. */
export function qualityBonusAffixes(stars: number): number { return [0, 0, 1, 1, 2][qIdx(stars)] }

/**
 * v0.27 (Lot 5) — RELIQUE de prestige : conserve l'objet (lignes / unique / gemmes / set / qualité)
 * mais RAMÈNE son iLvl au plancher, stats rescalées au prorata. Re-grandira en jeu (surillvl/trempe).
 */
export function relicFromItem(item: Item, floorIlvl: number): Item {
  const fl = Math.max(1, Math.min(item.ilvl, floorIlvl))
  const tier = RARITIES[item.rarity].tier
  // v0.30 : primaire/endurance suivent le budget EXPONENTIEL (powerAt) ; les lignes de stat suivent
  // l'échelle linéaire (effItemIlvl) ; les lignes typées (% / points) ne scalent pas.
  const powK = powerAt(fl - item.ilvl)
  const statK = effItemIlvl(fl, tier) / effItemIlvl(item.ilvl, tier)
  return {
    ...item,
    ilvl: fl,
    primaryValue: Math.max(1, Math.round(item.primaryValue * powK)),
    endurance: Math.max(1, Math.round(item.endurance * powK)),
    affixes: item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.max(1, Math.round(a.value * statK)) } : a)),
    surCount: 0, trempeCount: 0, reforgeCount: 0,
  }
}

/** Tire la qualité ⭐ d'une création (« Main de maître » déplace les poids vers le haut). */
export function rollStars(finRank = 0): number {
  const w = [Math.max(5, 35 - 8 * finRank), 30, 22 + 2 * finRank, 10 + 3 * finRank, 3 + 3 * finRank]
  const total = w.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) return i + 1 }
  return 3
}

/** Multiplicateur de budget par étoile : ⭐1 ×0,96 … ⭐3 ×1,04 … ⭐5 ×1,12. */
export function starsMult(stars: number): number {
  return 0.92 + 0.04 * stars
}

/** Applique la qualité ⭐ à une création (stats plates rescalées, % intacts) — MUTE l'objet. */
export function applyStars(item: Item, stars: number): void {
  const m = starsMult(stars)
  item.stars = stars
  item.primaryValue = Math.max(1, Math.round(item.primaryValue * m))
  item.endurance = Math.max(1, Math.round(item.endurance * m))
  item.affixes = item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.max(1, Math.round(a.value * m)) } : a))
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
  const qMult = starsMult(item.stars ?? 3)
  const pool = buildPool().filter((s) => !used.has(lineKey(s)))
  const fresh: Affix[] = []
  const rerollCount = item.affixes.length - kept.length
  for (let i = 0; i < rerollCount && pool.length; i++) {
    const total = pool.reduce((a, s) => a + s.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let j = 0; j < pool.length; j++) { r -= pool[j].weight; if (r <= 0) { idx = j; break } }
    const spec = pool.splice(idx, 1)[0]
    fresh.push(specToAffix(spec, rollLineValue(spec, item.ilvl, qMult, tier)))
  }
  return [...kept, ...fresh]
}

/** Augmente l'ilvl de l'objet et rescale ses stats (cap dur 700 ; les lignes typées % ne scalent pas). */
export function surillvlItem(item: Item, step = SURILLVL_STEP): Pick<Item, 'ilvl' | 'primaryValue' | 'endurance' | 'affixes' | 'surCount'> {
  const newIlvl = clampIlvl(item.ilvl + step)
  const realStep = newIlvl - item.ilvl
  const tier = RARITIES[item.rarity].tier
  // v0.30 : primaire/endurance EXPONENTIELS (powerAt(step)) ; lignes de stat linéaires (effItemIlvl).
  const powK = powerAt(realStep)
  const statK = effItemIlvl(newIlvl, tier) / effItemIlvl(item.ilvl, tier)
  return {
    ilvl: newIlvl,
    primaryValue: Math.round(item.primaryValue * powK),
    endurance: Math.round(item.endurance * powK),
    affixes: item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.round(a.value * statK) } : a)),
    surCount: (item.surCount ?? 0) + 1, // v0.25 : renchérit le prochain surillvl (×1,18)
  }
}

/** Monte l'objet d'un cran de rareté : rescale (+3 ilvl-équiv), +1 ligne, chance d'unique. */
export function ascendItem(item: Item): Partial<Item> | null {
  const nr = nextRarity(item.rarity)
  if (!nr) return null
  const ot = RARITIES[item.rarity].tier
  const nt = RARITIES[nr].tier
  // v0.30 : +1 cran = +RARITY_ILVL_PER_TIER ilvl-équiv. Primaire/endurance ×powerAt(+3) ; lignes de
  // stat ×ratio linéaire d'effItemIlvl.
  const powK = powerAt(RARITY_ILVL_PER_TIER * (nt - ot))
  const statK = effItemIlvl(item.ilvl, nt) / effItemIlvl(item.ilvl, ot)
  const qMult = starsMult(item.stars ?? 3)
  const affixes = item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.round(a.value * statK) } : a))
  const used = new Set(affixes.map(affixKey))
  const pool = buildPool().filter((s) => !used.has(lineKey(s)))
  if (pool.length) {
    const total = pool.reduce((a, s) => a + s.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let j = 0; j < pool.length; j++) { r -= pool[j].weight; if (r <= 0) { idx = j; break } }
    const spec = pool[idx]
    affixes.push(specToAffix(spec, rollLineValue(spec, item.ilvl, qMult, nt)))
  }
  const unique = item.unique ?? rollUnique(nt)
  return {
    rarity: nr,
    primaryValue: Math.round(item.primaryValue * powK),
    endurance: Math.round(item.endurance * powK),
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

/** Quintessences remboursées au recyclage (75% de l'investi — 100% en ◈ Catalyseur), par type. */
export function quintRefund(item: Item, full = false): Partial<Record<DamageType, number>> {
  const inv = quintInvested(item)
  const rate = full ? 1 : QUINT_RECYCLE_REFUND
  const out: Partial<Record<DamageType, number>> = {}
  for (const t in inv) out[t as DamageType] = Math.floor((inv[t as DamageType] ?? 0) * rate)
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
