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
  degatsCrit: { key: 'degatsCrit', name: 'Dégâts critiques', short: 'DCRI', color: '#ff922b', desc: 'Augmente les dégâts des coups critiques.' },
  hate: { key: 'hate', name: 'Hâte', short: 'HÂTE', color: '#22d3ee', desc: 'Augmente la vitesse d\'attaque et d\'incantation.' },
  maitrise: { key: 'maitrise', name: 'Maîtrise', short: 'MAÎT', color: '#c084fc', desc: 'Augmente les dégâts selon ta spécialisation (FOR/AGI/INT).' },
  penetration: { key: 'penetration', name: 'Pénétration', short: 'PÉN', color: '#fab005', desc: 'Ignore une partie des résistances et de l\'armure ennemies.' },
  // Défensif
  reductionDegats: { key: 'reductionDegats', name: 'Réduction de dégâts', short: 'RÉD', color: '#74c0fc', desc: 'Réduction plate des dégâts subis.' },
  esquive: { key: 'esquive', name: 'Esquive', short: 'ESQ', color: '#63e6be', desc: 'Chance d\'éviter complètement un coup ennemi.' },
  bouclier: { key: 'bouclier', name: 'Bouclier', short: 'BOUC', color: '#4dabf7', desc: 'Bouclier d\'absorption : augmente tes PV effectifs.' },
  // Soutien
  polyvalence: { key: 'polyvalence', name: 'Polyvalence', short: 'POLY', color: '#94d82d', desc: 'Augmente les dégâts et réduit les dégâts subis.' },
  regen: { key: 'regen', name: 'Régénération', short: 'RÉG', color: '#51cf66', desc: 'Augmente la régénération des points de vie.' },
  // RARES (apparition très faible, effets puissants)
  volDeVie: { key: 'volDeVie', name: 'Vol de vie', short: 'VOL', color: '#f06595', desc: 'Soigne en infligeant des dégâts. Survie constante : très rare.', rare: true },
  surpuissance: { key: 'surpuissance', name: 'Surpuissance', short: 'SURP', color: '#ff4d4d', desc: 'Augmente tous tes dégâts (multiplicatif). Extrêmement rare.', rare: true },
  multifrappe: { key: 'multifrappe', name: 'Multifrappe', short: 'MULT', color: '#ffd43b', desc: 'Chance de frapper une seconde fois. Extrêmement rare.', rare: true },
  recuperation: { key: 'recuperation', name: 'Récupération', short: 'RÉCU', color: '#3bc9db', desc: 'Réduit le temps de recharge des capacités. Extrêmement rare.', rare: true },
}

export const ALL_STAT_META: Record<StatKey, StatMeta> = { ...PRIMARY_META, ...SECONDARY_META }

export const PRIMARY_STATS: PrimaryStat[] = ['force', 'agilite', 'intelligence', 'endurance']
export const SECONDARY_STATS: SecondaryStat[] = [
  'critique', 'degatsCrit', 'hate', 'maitrise', 'penetration',
  'reductionDegats', 'esquive', 'bouclier',
  'polyvalence', 'regen',
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
  /** Stat primaire qui domine le build. */
  mainStat: PrimaryStat
  hp: number
  critChance: number // 0..1
  /** Multiplicateur des coups critiques (≥2). */
  critMult: number
  attacksPerSecond: number
  masteryMult: number // multiplicateur de dégâts
  versatilityMult: number
  /** Réduction de dégâts plate issue de la Maîtrise (build Force = bruiser). */
  masteryDr: number // 0..1
  leech: number // 0..1
  penetration: number // 0..1 (ignore résist/armure)
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

  // Maîtrise SPÉCIFIQUE À L'ARCHÉTYPE (donne une identité à chaque build) :
  // - Force        → dégâts + réduction de dégâts subis (bruiser)
  // - Agilité      → dégâts critiques accrus (burst)
  // - Intelligence → dégâts bruts accrus (glass cannon)
  const masteryFrac = (total.maitrise ?? 0) / PER_PCT
  let masteryMult = 1
  let critMult = 2 + (total.degatsCrit ?? 0) / PER_PCT
  let masteryDr = 0
  if (mainStat === 'force') {
    masteryMult = 1 + masteryFrac
    masteryDr = Math.min(0.4, masteryFrac * 0.6)
  } else if (mainStat === 'agilite') {
    critMult += masteryFrac * 2.5
  } else {
    masteryMult = 1 + masteryFrac * 2
  }

  const shieldPct = Math.min(1, (total.bouclier ?? 0) / PER_PCT)

  return {
    mainStat,
    power: statPower(mainValue),
    forcePower,
    agiPower,
    intPower,
    hp: (100 + endurance * 10) * (1 + shieldPct),
    critChance: Math.min(0.75, 0.05 + (total.critique ?? 0) / PER_PCT),
    critMult,
    attacksPerSecond: 1 + (total.hate ?? 0) / PER_PCT,
    masteryMult,
    versatilityMult: 1 + (total.polyvalence ?? 0) / PER_PCT,
    masteryDr,
    leech: Math.min(0.5, (total.volDeVie ?? 0) / 2500),
    penetration: Math.min(0.6, (total.penetration ?? 0) / PER_PCT),
    flatDr: Math.min(0.5, (total.reductionDegats ?? 0) / PER_PCT),
    dodge: Math.min(0.4, (total.esquive ?? 0) / PER_PCT),
    regenBonus: (total.regen ?? 0) / PER_PCT,
    // stats rares (divisor plus généreux → impact fort malgré la rareté)
    overpower: 1 + Math.min(2, (total.surpuissance ?? 0) / 1500),
    multistrike: Math.min(0.6, (total.multifrappe ?? 0) / 1500),
    cdr: Math.min(0.6, (total.recuperation ?? 0) / 1500),
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
      case 'maitrise': effect = `+${pct(d.masteryMult - 1)} de dégâts${d.masteryDr > 0 ? ` · -${pct(d.masteryDr)} subis` : ''}`; break
      case 'penetration': effect = `ignore ${pct(d.penetration)} des résistances/armure`; break
      case 'reductionDegats': effect = `-${pct(d.flatDr)} de dégâts subis`; break
      case 'esquive': effect = `${pct(d.dodge)} d'esquive`; break
      case 'bouclier': effect = `+${Math.round((1 + Math.min(1, rating / PER_PCT)) * 100 - 100)}% PV effectifs`; break
      case 'polyvalence': effect = `+${pct(d.versatilityMult - 1)} dégâts · -${pct(1 - 1 / d.versatilityMult)} subis`; break
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
