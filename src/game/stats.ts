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
}

export const PRIMARY_META: Record<PrimaryStat, StatMeta> = {
  force: { key: 'force', name: 'Force', short: 'FOR', color: '#ff6b6b', desc: 'Augmente la puissance d\'attaque des builds mêlée.' },
  agilite: { key: 'agilite', name: 'Agilité', short: 'AGI', color: '#51cf66', desc: 'Augmente la puissance d\'attaque des builds rapides.' },
  intelligence: { key: 'intelligence', name: 'Intelligence', short: 'INT', color: '#4dabf7', desc: 'Augmente la puissance des sorts.' },
  endurance: { key: 'endurance', name: 'Endurance', short: 'END', color: '#ffd43b', desc: 'Augmente les points de vie.' },
}

export const SECONDARY_META: Record<SecondaryStat, StatMeta> = {
  critique: { key: 'critique', name: 'Critique', short: 'CRIT', color: '#ffa94d', desc: 'Chance d\'infliger un coup critique (×2 dégâts).' },
  hate: { key: 'hate', name: 'Hâte', short: 'HÂTE', color: '#22d3ee', desc: 'Augmente la vitesse d\'attaque.' },
  maitrise: { key: 'maitrise', name: 'Maîtrise', short: 'MAÎT', color: '#c084fc', desc: 'Augmente les dégâts globaux selon ta spécialisation.' },
  polyvalence: { key: 'polyvalence', name: 'Polyvalence', short: 'POLY', color: '#94d82d', desc: 'Augmente les dégâts et réduit les dégâts subis.' },
  volDeVie: { key: 'volDeVie', name: 'Vol de vie', short: 'VOL', color: '#f06595', desc: 'Soigne en infligeant des dégâts.' },
}

export const ALL_STAT_META: Record<StatKey, StatMeta> = { ...PRIMARY_META, ...SECONDARY_META }

export const PRIMARY_STATS: PrimaryStat[] = ['force', 'agilite', 'intelligence', 'endurance']
export const SECONDARY_STATS: SecondaryStat[] = ['critique', 'hate', 'maitrise', 'polyvalence', 'volDeVie']

/** Additionne les stats d'un item dans un StatBlock accumulateur. */
function addItemStats(acc: StatBlock, equipment: Equipment) {
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item) continue
    acc[item.primary] = (acc[item.primary] ?? 0) + item.primaryValue
    if (item.endurance) acc.endurance = (acc.endurance ?? 0) + item.endurance
    for (const aff of item.affixes) {
      acc[aff.stat] = (acc[aff.stat] ?? 0) + aff.value
    }
    // Bonus de stats des effets uniques équipés (selon leur rang).
    if (item.unique) {
      const mods = instanceMods(item.unique)
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
  /** Puissance d'attaque/sort effective (selon la stat primaire dominante). */
  power: number
  /** Stat primaire qui domine le build. */
  mainStat: PrimaryStat
  hp: number
  critChance: number // 0..1
  /** Multiplicateur des coups critiques (≥2, monté par la Maîtrise en build Agilité). */
  critMult: number
  attacksPerSecond: number
  masteryMult: number // multiplicateur de dégâts
  versatilityMult: number
  /** Réduction de dégâts plate issue de la Maîtrise (build Force = bruiser). */
  masteryDr: number // 0..1
  leech: number // 0..1
}

export const RATING_PER_PERCENT = 50 // ratings nécessaires pour 1% (style WoW)

/** Calcule les stats dérivées de combat à partir des stats totales. */
export function computeDerived(total: StatBlock): DerivedStats {
  const force = total.force ?? 0
  const agilite = total.agilite ?? 0
  const intelligence = total.intelligence ?? 0
  const endurance = total.endurance ?? 0

  // La plus haute des 3 stats offensives détermine le build.
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
  const masteryFrac = (total.maitrise ?? 0) / (RATING_PER_PERCENT * 100)
  let masteryMult = 1
  let critMult = 2
  let masteryDr = 0
  if (mainStat === 'force') {
    masteryMult = 1 + masteryFrac
    masteryDr = Math.min(0.4, masteryFrac * 0.6)
  } else if (mainStat === 'agilite') {
    critMult = 2 + masteryFrac * 2.5
  } else {
    masteryMult = 1 + masteryFrac * 2
  }

  return {
    mainStat,
    power: 10 + mainValue * 2,
    hp: 100 + endurance * 10,
    critChance: Math.min(0.75, 0.05 + (total.critique ?? 0) / (RATING_PER_PERCENT * 100)),
    critMult,
    attacksPerSecond: 1 + (total.hate ?? 0) / (RATING_PER_PERCENT * 100),
    masteryMult,
    versatilityMult: 1 + (total.polyvalence ?? 0) / (RATING_PER_PERCENT * 100),
    masteryDr,
    leech: Math.min(0.5, (total.volDeVie ?? 0) / (RATING_PER_PERCENT * 100)),
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
      effect: isMain ? `Stat de combat active · +${rating * 2} puissance` : 'Inactive (deviens dominante pour l\'activer)',
      desc: m.desc,
    }
  })

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`
  const secondary: StatEffect[] = SECONDARY_STATS.map((k) => {
    const m = SECONDARY_META[k]
    const rating = total[k] ?? 0
    let effect = ''
    switch (k) {
      case 'critique': effect = `${pct(d.critChance)} de coups critiques (×2 dégâts)`; break
      case 'hate': effect = `+${pct(d.attacksPerSecond - 1)} vitesse · ${d.attacksPerSecond.toFixed(2)} att/s`; break
      case 'maitrise': effect = `+${pct(d.masteryMult - 1)} de dégâts`; break
      case 'polyvalence': effect = `+${pct(d.versatilityMult - 1)} dégâts · -${pct(1 - 1 / d.versatilityMult)} subis`; break
      case 'volDeVie': effect = `${pct(d.leech)} des dégâts rendus en vie`; break
    }
    return { key: k, name: m.name, short: m.short, color: m.color, rating, active: rating > 0, effect, desc: m.desc }
  })

  return { primary, secondary }
}
