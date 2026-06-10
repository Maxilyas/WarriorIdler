import type { PrimaryStat, SecondaryStat, StatKey, StatBlock, Equipment } from './types'
import { instanceMods } from './uniques'

export interface StatMeta {
  key: StatKey
  name: string
  short: string
  /** Couleur d'accent pour l'affichage. */
  color: string
  /** Texte d'aide affiché dans les tooltips. */
  desc: string
  /** Stat RARE : apparition très faible + indicateur visuel sur l'objet. */
  rare?: boolean
}

export const PRIMARY_META: Record<PrimaryStat, StatMeta> = {
  force: { key: 'force', name: 'Force', short: 'FOR', color: '#ff6b6b', desc: 'Puissance des frappes de mêlée. Les capacités de Force scalent dessus.' },
  agilite: { key: 'agilite', name: 'Agilité', short: 'AGI', color: '#51cf66', desc: 'Puissance des attaques rapides et furtives. Les capacités d\'Agilité scalent dessus.' },
  intelligence: { key: 'intelligence', name: 'Intelligence', short: 'INT', color: '#4dabf7', desc: 'Puissance des sorts, réserve et régénération de mana. Les sorts scalent dessus.' },
  endurance: { key: 'endurance', name: 'Endurance', short: 'END', color: '#ffd43b', desc: 'Augmente les points de vie.' },
}

export const SECONDARY_META: Record<SecondaryStat, StatMeta> = {
  // Offensif
  critique: { key: 'critique', name: 'Critique', short: 'CRIT', color: '#ffa94d', desc: 'Chance d\'infliger un coup critique.' },
  degatsCrit: { key: 'degatsCrit', name: 'Dégâts critiques', short: 'DCRI', color: '#ff922b', desc: 'Augmente les dégâts des coups critiques (inutile sans Critique).' },
  hate: { key: 'hate', name: 'Hâte', short: 'HÂTE', color: '#22d3ee', desc: 'Augmente la vitesse d\'attaque et d\'incantation.' },
  maitrise: { key: 'maitrise', name: 'Maîtrise', short: 'MAÎT', color: '#c084fc', desc: 'Effet propre à ton archétype : Force = réduction (bruiser), Agilité = dégâts crit., Intelligence = dégâts bruts.' },
  penetration: { key: 'penetration', name: 'Pénétration', short: 'PÉN', color: '#fab005', desc: 'Ignore une partie des résistances et de l\'armure ennemies (anti-tank).' },
  precision: { key: 'precision', name: 'Précision', short: 'PRÉC', color: '#fcc419', desc: 'Annule l\'esquive des ennemis : indispensable contre les boss fuyants.' },
  alteration: { key: 'alteration', name: 'Altération', short: 'ALT', color: '#e8590c', desc: 'Amplifie tes dégâts sur la durée (saignement, poison, feu). Cœur des builds DoT.' },
  degatsBoss: { key: 'degatsBoss', name: 'Dégâts aux boss', short: 'BOSS', color: '#f03e3e', desc: 'Augmente les dégâts infligés aux boss et aux élites (farm de donjons/raids).' },
  // Défensif
  reductionDegats: { key: 'reductionDegats', name: 'Réduction de dégâts', short: 'RÉD', color: '#74c0fc', desc: 'Réduction plate des dégâts subis (efficace contre les petits coups rapides).' },
  esquive: { key: 'esquive', name: 'Esquive', short: 'ESQ', color: '#63e6be', desc: 'Chance d\'éviter complètement un coup ennemi (tout ou rien).' },
  barriere: { key: 'barriere', name: 'Barrière', short: 'BARR', color: '#4dabf7', desc: 'Bouclier de départ : augmente tes PV effectifs. Excellent contre le burst.' },
  tenacite: { key: 'tenacite', name: 'Ténacité', short: 'TÉN', color: '#a9e34b', desc: 'Réduit la durée des étourdissements et contrôles infligés par les boss.' },
  purge: { key: 'purge', name: 'Purge', short: 'PURG', color: '#38d9a9', desc: 'Réduit la durée ET l\'intensité des altérations subies (saignement, poison, brûlure, malédiction). Cruciale hors du biome Physique.' },
  // Soutien
  regen: { key: 'regen', name: 'Régénération', short: 'RÉG', color: '#51cf66', desc: 'Augmente la régénération des points de vie (combats longs).' },
  // RARES (apparition très faible, effets puissants)
  volDeVie: { key: 'volDeVie', name: 'Vol de vie', short: 'VOL', color: '#f06595', desc: 'Soigne en infligeant des dégâts. La stat des builds solo (DPS sans soigneur). Très rare.', rare: true },
  surpuissance: { key: 'surpuissance', name: 'Surpuissance', short: 'SURP', color: '#ff4d4d', desc: 'Augmente TOUS tes dégâts (multiplicatif, universel). Extrêmement rare.', rare: true },
  multifrappe: { key: 'multifrappe', name: 'Multifrappe', short: 'MULT', color: '#ffd43b', desc: 'Chance de frapper une seconde fois. Extrêmement rare.', rare: true },
  recuperation: { key: 'recuperation', name: 'Récupération', short: 'RÉCU', color: '#3bc9db', desc: 'Réduit le temps de recharge des capacités (spam de compétences). Extrêmement rare.', rare: true },
}

export const ALL_STAT_META: Record<StatKey, StatMeta> = { ...PRIMARY_META, ...SECONDARY_META }

export const PRIMARY_STATS: PrimaryStat[] = ['force', 'agilite', 'intelligence', 'endurance']
export const SECONDARY_STATS: SecondaryStat[] = [
  'critique', 'degatsCrit', 'hate', 'maitrise', 'penetration', 'precision', 'alteration', 'degatsBoss',
  'reductionDegats', 'esquive', 'barriere', 'tenacite', 'purge',
  'regen',
  'volDeVie', 'surpuissance', 'multifrappe', 'recuperation',
]

/** Stats secondaires RARES (apparition très faible, indicateur visuel). */
export const RARE_STATS: SecondaryStat[] = ['volDeVie', 'surpuissance', 'multifrappe', 'recuperation']

/** Additionne les stats d'un item dans un StatBlock accumulateur (lignes 'stat' + uniques). */
function addItemStats(acc: StatBlock, equipment: Equipment) {
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item) continue
    acc[item.primary] = (acc[item.primary] ?? 0) + item.primaryValue
    if (item.endurance) acc.endurance = (acc.endurance ?? 0) + item.endurance
    for (const aff of item.affixes) {
      if (aff.kind === 'stat' && aff.stat) acc[aff.stat] = (acc[aff.stat] ?? 0) + aff.value
    }
    // Bonus de stats des effets uniques équipés (selon leur rang ET la rareté/iLvl de la pièce).
    if (item.unique) {
      const mods = instanceMods(item.unique, item)
      for (const k in mods) {
        const key = k as StatKey
        acc[key] = (acc[key] ?? 0) + (mods[key] ?? 0)
      }
    }
    // (v0.22 : les runes ne gravent plus de stats — temps & règles uniquement, voir enchants.ts.)
  }
}

/** Stats totales = stats de base du personnage + stats de l'équipement. */
export function computeTotalStats(base: StatBlock, equipment: Equipment): StatBlock {
  const total: StatBlock = { ...base }
  addItemStats(total, equipment)
  return total
}

export interface DerivedStats {
  /** Puissance de l'auto-attaque (selon la stat primaire dominante). */
  power: number
  /** Puissance par stat (les capacités scalent sur la leur). */
  forcePower: number
  agiPower: number
  intPower: number
  /** Puissance issue de l'Endurance (boucliers défensifs : scalent dessus). */
  endurancePower: number
  /** Stat primaire qui domine le build. */
  mainStat: PrimaryStat
  hp: number
  critChance: number // 0..1
  /** Multiplicateur des coups critiques (≥2). */
  critMult: number
  attacksPerSecond: number
  masteryMult: number // multiplicateur de dégâts (Maîtrise, selon l'archétype)
  /** Réduction de dégâts plate issue de la Maîtrise (build Force = bruiser). */
  masteryDr: number // 0..1
  leech: number // 0..1
  penetration: number // 0..1 (ignore résist/armure)
  precision: number // 0..1 (annule l'esquive ennemie)
  alterationMult: number // ≥1 multiplicateur des dégâts sur la durée (DoT)
  bossDamageMult: number // ≥1 multiplicateur de dégâts contre les boss/élites
  tenacity: number // 0..1 réduction de la durée des contrôles ennemis
  purge: number // 0..1 réduction de la durée/intensité des altérations subies (DoT/debuffs ennemis)
  flatDr: number // 0..1 réduction plate supplémentaire
  dodge: number // 0..1 chance d'esquive
  regenBonus: number // ajouté au taux de régén PV
  // --- stats rares ---
  overpower: number // multiplicateur de dégâts (Surpuissance)
  multistrike: number // 0..1 chance de double frappe (Multifrappe)
  cdr: number // 0..1 réduction de cooldown (Récupération)
}

export const RATING_PER_PERCENT = 50 // ratings nécessaires pour 1% (style WoW)
const PER_PCT = RATING_PER_PERCENT * 100 // ratings pour +1.0 (100%)

/** Puissance issue d'une stat primaire offensive. */
function statPower(value: number): number {
  return 10 + value * 2
}

/**
 * Soft cap façon WoW : plein rendement (1:1) jusqu'à `soft`, puis rendement DÉGRESSIF au-delà.
 * La pente vaut 1 au passage du seuil (continuité, aucun nerf sous l'ancien cap) puis décroît,
 * en s'approchant asymptotiquement de `hard` sans jamais l'atteindre. Plus de mur sec : continuer
 * d'empiler la stat reste utile, simplement de moins en moins (le surplus n'est plus gaspillé).
 * (Exportée : sert aussi au bonus des lignes « +% type » dans damage.ts.)
 */
export function softCap(value: number, soft: number, hard: number): number {
  if (value <= soft) return value
  const head = hard - soft
  if (head <= 0) return soft
  const excess = value - soft
  return soft + (head * excess) / (excess + head)
}

/** Calcule les stats dérivées de combat à partir des stats totales. */
export function computeDerived(total: StatBlock): DerivedStats {
  const force = total.force ?? 0
  const agilite = total.agilite ?? 0
  const intelligence = total.intelligence ?? 0
  const endurance = total.endurance ?? 0

  const forcePower = statPower(force)
  const agiPower = statPower(agilite)
  const intPower = statPower(intelligence)

  // La plus haute des 3 stats offensives détermine le build (auto-attaque + archétype).
  const offensive: [PrimaryStat, number][] = [
    ['force', force],
    ['agilite', agilite],
    ['intelligence', intelligence],
  ]
  offensive.sort((a, b) => b[1] - a[1])
  const [mainStat, mainValue] = offensive[0]

  // Maîtrise SPÉCIFIQUE À L'ARCHÉTYPE — distincte de la Surpuissance (qui, elle, est un mult brut
  // universel). La Maîtrise ne donne quasiment pas de dégâts bruts sauf pour l'Intelligence :
  // - Force        → RÉDUCTION de dégâts (bruiser tanky) + un peu de dégâts
  // - Agilité      → DÉGÂTS CRITIQUES accrus (burst, rien sans Critique)
  // - Intelligence → DÉGÂTS BRUTS (le seul archétype « glass cannon » qui scale en dégâts purs)
  const masteryFrac = (total.maitrise ?? 0) / PER_PCT
  let masteryMult = 1
  let critMult = 2 + (total.degatsCrit ?? 0) / PER_PCT
  let masteryDr = 0
  if (mainStat === 'force') {
    masteryMult = 1 + masteryFrac * 0.8 // un peu plus de dégâts bruts (le bruiser n'est pas largué)
    masteryDr = softCap(masteryFrac * 0.85, 0.5, 0.7)
  } else if (mainStat === 'agilite') {
    masteryMult = 1 + masteryFrac * 0.45 // ajoute un peu de dégâts plats (plancher relevé)
    critMult += masteryFrac * 2 // critique toujours fort, mais moins extrême
  } else {
    masteryMult = 1 + masteryFrac * 0.9 // glass cannon : encore le meilleur, mais ne gonfle plus à l'infini
  }

  const shieldPct = softCap((total.barriere ?? 0) / PER_PCT, 1, 1.6)

  return {
    mainStat,
    power: statPower(mainValue),
    forcePower,
    agiPower,
    intPower,
    endurancePower: statPower(endurance),
    hp: (100 + endurance * 12) * (1 + shieldPct), // PV/Endurance relevés (survie suit mieux la montée)
    // Soft caps (style WoW) : plein rendement jusqu'au seuil (= ancien cap), puis dégressif au-delà
    // en approchant une limite haute. Plus aucun rating gaspillé après le seuil.
    critChance: softCap(0.05 + (total.critique ?? 0) / PER_PCT, 0.75, 0.92),
    critMult,
    attacksPerSecond: 1 + (total.hate ?? 0) / PER_PCT,
    masteryMult,
    masteryDr,
    leech: softCap((total.volDeVie ?? 0) / 2500, 0.5, 0.72),
    penetration: softCap((total.penetration ?? 0) / PER_PCT, 0.6, 0.82),
    precision: softCap((total.precision ?? 0) / PER_PCT, 0.95, 0.99),
    alterationMult: 1 + softCap((total.alteration ?? 0) / PER_PCT, 3, 5.5),
    bossDamageMult: 1 + softCap((total.degatsBoss ?? 0) / PER_PCT, 2.5, 4.5),
    tenacity: softCap((total.tenacite ?? 0) / PER_PCT, 0.85, 0.96),
    purge: softCap((total.purge ?? 0) / PER_PCT, 0.8, 0.93),
    flatDr: softCap((total.reductionDegats ?? 0) / PER_PCT, 0.5, 0.72),
    dodge: softCap((total.esquive ?? 0) / PER_PCT, 0.4, 0.62),
    regenBonus: (total.regen ?? 0) / PER_PCT,
    // stats rares (divisor plus généreux → impact fort malgré la rareté)
    overpower: 1 + softCap((total.surpuissance ?? 0) / 1500, 2, 4),
    multistrike: softCap((total.multifrappe ?? 0) / 1500, 0.6, 0.85),
    cdr: softCap((total.recuperation ?? 0) / 1500, 0.6, 0.82),
  }
}

export interface StatEffect {
  key: StatKey
  name: string
  short: string
  color: string
  /** Valeur brute de la stat (rating). */
  rating: number
  /** Effet concret et chiffré (ce que la stat fait). */
  effect: string
  /** Texte d'aide long. */
  desc: string
  /** false = la stat n'a aucun effet actuellement (ex. stat primaire non dominante). */
  active: boolean
}

/** Décrit l'effet concret de chaque stat, pour l'afficher sur la fiche de personnage. */
export function describeStats(total: StatBlock): { primary: StatEffect[]; secondary: StatEffect[] } {
  const d = computeDerived(total)

  const primary: StatEffect[] = PRIMARY_STATS.map((k) => {
    const m = PRIMARY_META[k]
    const rating = total[k] ?? 0
    if (k === 'endurance') {
      return { key: k, name: m.name, short: m.short, color: m.color, rating, active: true,
        effect: `+${rating * 10} points de vie`, desc: m.desc }
    }
    const isMain = k === d.mainStat
    return {
      key: k, name: m.name, short: m.short, color: m.color, rating, active: isMain,
      effect: isMain ? `Stat de combat active · +${statPower(rating) - 10} puissance` : 'Inactive pour l\'auto-attaque (deviens dominante)',
      desc: m.desc,
    }
  })

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`
  const secondary: StatEffect[] = SECONDARY_STATS.map((k) => {
    const m = SECONDARY_META[k]
    const rating = total[k] ?? 0
    let effect = ''
    switch (k) {
      case 'critique': effect = `${pct(d.critChance)} de coups critiques`; break
      case 'degatsCrit': effect = `coups critiques ×${d.critMult.toFixed(2)}`; break
      case 'hate': effect = `+${pct(d.attacksPerSecond - 1)} vitesse · ${d.attacksPerSecond.toFixed(2)} att/s`; break
      case 'maitrise': effect = d.mainStat === 'agilite' ? `coups critiques ×${d.critMult.toFixed(2)} (archétype)` : `+${pct(d.masteryMult - 1)} de dégâts${d.masteryDr > 0 ? ` · -${pct(d.masteryDr)} subis` : ''}`; break
      case 'penetration': effect = `ignore ${pct(d.penetration)} des résistances/armure`; break
      case 'precision': effect = `annule ${pct(d.precision)} de l'esquive ennemie`; break
      case 'alteration': effect = `+${pct(d.alterationMult - 1)} de dégâts sur la durée`; break
      case 'degatsBoss': effect = `+${pct(d.bossDamageMult - 1)} de dégâts aux boss/élites`; break
      case 'reductionDegats': effect = `-${pct(d.flatDr)} de dégâts subis`; break
      case 'esquive': effect = `${pct(d.dodge)} d'esquive`; break
      case 'barriere': effect = `+${Math.round(softCap(rating / PER_PCT, 1, 1.6) * 100)}% PV effectifs`; break
      case 'tenacite': effect = `-${pct(d.tenacity)} de durée des contrôles`; break
      case 'purge': effect = `-${pct(d.purge)} de durée/intensité des altérations subies`; break
      case 'regen': effect = `+${pct(d.regenBonus)} de régénération`; break
      case 'volDeVie': effect = `${pct(d.leech)} des dégâts rendus en vie`; break
      case 'surpuissance': effect = `+${pct(d.overpower - 1)} de dégâts globaux`; break
      case 'multifrappe': effect = `${pct(d.multistrike)} de frapper deux fois`; break
      case 'recuperation': effect = `-${pct(d.cdr)} de temps de recharge`; break
    }
    return { key: k, name: m.name, short: m.short, color: m.color, rating, active: rating > 0, effect, desc: m.desc }
  })

  return { primary, secondary }
}
