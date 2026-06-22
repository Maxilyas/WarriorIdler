/**
 * STATS — méta des stats, agrégation (`computeTotalStats`) et stats dérivées de combat
 * (`computeDerived`). Chaque secondaire a une COURBE à soft cap (`softCap`, rendement décroissant,
 * jamais de mur). La MAÎTRISE a une identité par stat primaire dominante (Force=DR+Riposte,
 * Agi=Débordement crit, Int=Surcharge). Refonte majeure v0.38 (Esquive/Ténacité/Purge/Régén
 * dépréciées mais repliées pour la rétro-compat).
 *   → Doc : docs/systemes/02-stats-et-maitrises.md
 */
import type { PrimaryStat, SecondaryStat, StatKey, StatBlock, Equipment, ConvSource } from './types'
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
  precision: { key: 'precision', name: 'Précision', short: 'PRÉC', color: '#fcc419', desc: 'Augmente ta CHANCE DE TOUCHER en auto-attaque (les sorts touchent toujours). Les ennemis esquivent : élite 10% · boss 15% · boss de raid 20%. Pour 0 raté (100% de touche) : 1000 · 1500 · 2000 rating de Précision.' },
  alteration: { key: 'alteration', name: 'Altération', short: 'ALT', color: '#e8590c', desc: 'Amplifie tes dégâts sur la durée (saignement, poison, feu). Cœur des builds DoT.' },
  degatsBoss: { key: 'degatsBoss', name: 'Dégâts aux boss', short: 'BOSS', color: '#f03e3e', desc: 'Augmente les dégâts infligés aux boss et aux élites (farm de donjons/raids).' },
  // Défensif
  reductionDegats: { key: 'reductionDegats', name: 'Réduction de dégâts', short: 'RÉD', color: '#74c0fc', desc: 'Réduction plate des dégâts subis (efficace contre les petits coups rapides).' },
  barriere: { key: 'barriere', name: 'Barrière', short: 'BARR', color: '#4dabf7', desc: 'Bouclier de départ : augmente tes PV effectifs. Excellent contre le burst.' },
  resilience: { key: 'resilience', name: 'Résilience', short: 'RÉSI', color: '#a9e34b', desc: 'Réduit la durée des contrôles ennemis ET la durée/intensité des altérations subies (saignement, poison, brûlure, malédiction).' },
  // --- DÉPRÉCIÉES (v0.38) : ne sont plus rollées ni listées sur la fiche, mais restent FONCTIONNELLES
  //     (vieux objets/talents) : Esquive comptée comme Réduction · Ténacité + Purge comptées comme
  //     Résilience · Régénération toujours active (l'archétype soigneur en dépend). ---
  esquive: { key: 'esquive', name: 'Réduction', short: 'RÉD', color: '#74c0fc', desc: 'Comptée comme Réduction de dégâts (Esquive dépréciée, plus rollée).' },
  tenacite: { key: 'tenacite', name: 'Résilience', short: 'RÉSI', color: '#a9e34b', desc: 'Comptée comme Résilience (Ténacité dépréciée, plus rollée).' },
  purge: { key: 'purge', name: 'Résilience', short: 'RÉSI', color: '#38d9a9', desc: 'Comptée comme Résilience (Purge dépréciée, plus rollée).' },
  regen: { key: 'regen', name: 'Intelligence', short: 'INT', color: '#4dabf7', desc: 'Comptée comme Intelligence — le soin scale sur l\'Intelligence (Régénération dépréciée, plus rollée).' },
  // RARES (apparition très faible, effets puissants)
  volDeVie: { key: 'volDeVie', name: 'Vol de vie', short: 'VOL', color: '#f06595', desc: 'Soigne en infligeant des dégâts. La stat des builds solo (DPS sans soigneur). Très rare.', rare: true },
  surpuissance: { key: 'surpuissance', name: 'Surpuissance', short: 'SURP', color: '#ff4d4d', desc: 'Augmente TOUS tes dégâts (multiplicatif, universel). Extrêmement rare.', rare: true },
  multifrappe: { key: 'multifrappe', name: 'Multifrappe', short: 'MULT', color: '#ffd43b', desc: 'Chance de frapper une seconde fois. Extrêmement rare.', rare: true },
  recuperation: { key: 'recuperation', name: 'Récupération', short: 'RÉCU', color: '#3bc9db', desc: 'Réduit le temps de recharge des capacités (spam de compétences). Extrêmement rare.', rare: true },
}

export const ALL_STAT_META: Record<StatKey, StatMeta> = { ...PRIMARY_META, ...SECONDARY_META }

/** Libellé court + couleur d'une SOURCE de conversion (v0.39) : une stat OU `healPower` (puissance de soin). */
export function convSourceMeta(s: ConvSource): { short: string; color: string } {
  if (s === 'healPower') return { short: 'SOIN', color: '#51cf66' }
  const m = ALL_STAT_META[s]
  return { short: m.short, color: m.color }
}

export const PRIMARY_STATS: PrimaryStat[] = ['force', 'agilite', 'intelligence', 'endurance']
// v0.38 — liste AFFICHÉE/ROLLÉE : Esquive, Ténacité, Purge, Régén retirées ; Résilience (fusion Tén+Purge) ajoutée.
export const SECONDARY_STATS: SecondaryStat[] = [
  'critique', 'degatsCrit', 'hate', 'maitrise', 'penetration', 'precision', 'alteration', 'degatsBoss',
  'reductionDegats', 'barriere', 'resilience',
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
  // v0.38 — RÉGÉNÉRATION RETIRÉE : tout reliquat de `regen` (vieux objets, uniques de soin, talents)
  // est compté comme INTELLIGENCE — le soin scale désormais sur l'Int (cf. design Option B), donc les
  // uniques/talents de soin restent pertinents (Int = soins plus gros) sans réécrire leurs données.
  if (total.regen) { total.intelligence = (total.intelligence ?? 0) + total.regen; total.regen = 0 }
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
  resilience: number // 0..1 réduction durée CC + durée/intensité altérations (v0.38, ex-Ténacité+Purge fusionnées)
  flatDr: number // 0..1 réduction plate supplémentaire
  /** 🤺 Chance de RIPOSTE du bruiser Force (v0.38) : % de contre-attaquer (frappe complète) quand on est touché. */
  riposteChance: number
  /** Multiplicateur de dégâts SUBIS (Surcharge de l'Int glass cannon ; 1 = neutre). */
  damageTakenMult: number
  /** Fraction de PV effectifs issue de la Barrière (v0.26 : sert à la Doctrine du bouclier). */
  shieldPct: number
  // --- stats rares ---
  overpower: number // multiplicateur de dégâts (Surpuissance)
  multistrike: number // 0..1 chance de double frappe (Multifrappe)
  cdr: number // 0..1 réduction de cooldown (Récupération)
}

export const RATING_PER_PERCENT = 25 // v0.35 : 50→25 (les secondaires comptaient ~1/50 d'une ligne %type)
const PER_PCT = RATING_PER_PERCENT * 100 // ratings pour +1.0 (100%)

/** v0.38 — ESQUIVE des ennemis (SOURCE UNIQUE, contrée par la Précision sur les AUTO-ATTAQUES seulement).
 *  Élite/champion 10% · boss 15% · boss de raid 20%. enemies/dungeons/raids importent ces valeurs. */
export const ENEMY_DODGE = { elite: 0.10, boss: 0.15, raidboss: 0.20 } as const
/** Précision : rating pour 100% d'esquive annulée (v0.38 : 100 rating/1%, abaissé de 200). C'est le « hit cap ». */
export const PRECISION_DIVISOR = 10000
/** Rating de Précision nécessaire pour annuler ENTIÈREMENT une esquive donnée (le hit cap exact). */
export function precisionRatingToCancel(dodge: number): number {
  return Math.round(dodge * PRECISION_DIVISOR)
}
/** v0.27 (C5) — part de la 2e stat offensive reversée dans la puissance (knob d'équilibrage). */
export const SECOND_STAT_SHARE = 0.2

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
  // v0.27 (C5) — les hybrides 2-stats ne sont plus du poids mort : la 2e stat offensive compte
  // pour SECOND_STAT_SHARE dans la puissance d'auto-attaque (le winner-take-all est adouci).
  const secondValue = offensive[1]?.[1] ?? 0
  const effMainValue = mainValue + SECOND_STAT_SHARE * secondValue

  // === v0.38 — REFONTE DES STATS ===
  // Critique : base 5% + 1% par 100 rating (rating/10000), soft cap 45% → asymptote 70% (fini les ~75% gratuits).
  const rawCrit = 0.05 + (total.critique ?? 0) / 10000
  const critChance = softCap(rawCrit, 0.45, 0.70)
  // Dégâts crit : ×1,5 + rating/700 (700 rating = +100%), soft cap +400% (×5,5) → +700% (×8,5). Gros SPREAD
  // (investir paie : ×1,9 à 300 → ×5,4 à 2700), contrairement à l'ancien ×2→×3 ultra-compressé.
  let critMult = 1.5 + softCap((total.degatsCrit ?? 0) / 700, 4.0, 7.0)

  // --- MAÎTRISE (v0.38) : identité PAR ARCHÉTYPE, chacune avec sa mécanique « folle ». ---
  // - Force        → bruiser : RÉDUCTION plate + dégâts PLATS nourris par la tankiness (« Riposte »).
  // - Agilité      → assassin : ×CRIT ; le crit AU-DELÀ du cap n'est plus gaspillé (« Débordement »).
  // - Intelligence → glass cannon : gros %dégâts MAIS +dégâts subis (« Surcharge »).
  const masteryFrac = softCap((total.maitrise ?? 0) / PER_PCT, 0.8, 1.5)
  let masteryMult = 1
  let masteryDr = 0
  let riposteChance = 0
  let damageTakenMult = 1
  if (mainStat === 'force') {
    masteryDr = softCap((total.maitrise ?? 0) / 5000, 0.25, 0.40)
    // « Riposte » : quand tu es touché, % de chance de renvoyer une FRAPPE COMPLÈTE (scale sur ta puissance).
    // Plus on te tape / t'entoure, plus tu rends → fantasme bruiser, scale avec les adds & raids.
    riposteChance = softCap((total.maitrise ?? 0) / 3500, 0.5, 0.8)
  } else if (mainStat === 'agilite') {
    masteryMult = 1 + masteryFrac * 0.3 // petit flat pour ne pas être nul sans crit
    // « Débordement » : la chance de crit AU-DESSUS du cap se reverse en multiplicateur de crit.
    const overflow = Math.max(0, rawCrit - critChance)
    critMult += masteryFrac * 0.8 + overflow * 2
  } else {
    masteryMult = 1 + masteryFrac * 1.0 // glass cannon : gros %dégâts
    // « Surcharge » : tu subis aussi plus de dégâts (risque/récompense).
    damageTakenMult = 1 + softCap((total.maitrise ?? 0) / 5000, 0.3, 0.6)
  }

  const shieldPct = softCap((total.barriere ?? 0) / PER_PCT, 1, 1.6)
  // Résilience = ex-Ténacité + ex-Purge FUSIONNÉES (20 rating/1%, soft cap 85% → 96%). Couvre CC ET altérations.
  const resilienceRating = (total.resilience ?? 0) + (total.tenacite ?? 0) + (total.purge ?? 0)
  // Réduction plate (50 rating/1%, soft cap 40% → 60%) ; l'Esquive dépréciée est repliée dedans 1:1.
  const flatDrRating = (total.reductionDegats ?? 0) + (total.esquive ?? 0)

  return {
    mainStat,
    power: statPower(effMainValue),
    forcePower,
    agiPower,
    intPower,
    endurancePower: statPower(endurance),
    hp: (100 + endurance * 12) * (1 + shieldPct), // PV/Endurance relevés (survie suit mieux la montée)
    critChance,
    critMult,
    // Hâte : 1% par 50 rating (rating/5000), soft cap +90% → +140% (aps max ~2,4).
    attacksPerSecond: 1 + softCap((total.hate ?? 0) / 5000, 0.9, 1.4),
    masteryMult,
    masteryDr,
    riposteChance,
    damageTakenMult,
    leech: softCap((total.volDeVie ?? 0) / 20000, 0.5, 0.72), // 1% par 200 rating
    penetration: softCap((total.penetration ?? 0) / 20000, 0.70, 0.85), // 1% par 200 rating, pas de base
    precision: softCap((total.precision ?? 0) / PRECISION_DIVISOR, 0.90, 0.99), // v0.38 : 100 rating/1% (abaissé de 200), pas de base
    alterationMult: 1 + (total.alteration ?? 0) / 4000, // +1% par 40 rating, linéaire (DoT-only)
    bossDamageMult: 1 + (total.degatsBoss ?? 0) / 5000, // +1% par 50 rating, linéaire
    resilience: softCap(resilienceRating / 2000, 0.85, 0.96),
    shieldPct,
    flatDr: softCap(flatDrRating / 5000, 0.40, 0.60),
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
      case 'maitrise': effect = d.mainStat === 'agilite' ? `coups critiques ×${d.critMult.toFixed(2)} (Débordement)`
        : d.mainStat === 'force' ? `-${pct(d.masteryDr)} subis · ${pct(d.riposteChance)} de riposte (contre-attaque)`
        : `+${pct(d.masteryMult - 1)} de dégâts · +${pct(d.damageTakenMult - 1)} subis (Surcharge)`; break
      case 'penetration': effect = `ignore ${pct(d.penetration)} des résistances/armure`; break
      case 'precision': {
        // v0.38 — exprimé en CHANCE DE TOUCHER (auto-attaque) : lisible sans connaître l'esquive ennemie
        // (90% = 10% d'esquive). Monte vers 100% avec la Précision ; rating exact pour 0 raté en suffixe.
        const hit = (dodge: number) => Math.round(Math.min(1, 1 - dodge + d.precision) * 100)
        const caps = `${precisionRatingToCancel(ENEMY_DODGE.elite)}/${precisionRatingToCancel(ENEMY_DODGE.boss)}/${precisionRatingToCancel(ENEMY_DODGE.raidboss)}`
        effect = `toucher (auto) : élite ${hit(ENEMY_DODGE.elite)}% · boss ${hit(ENEMY_DODGE.boss)}% · raid ${hit(ENEMY_DODGE.raidboss)}% · 0 raté à ${caps}`
        break
      }
      case 'alteration': effect = `+${pct(d.alterationMult - 1)} de dégâts sur la durée`; break
      case 'degatsBoss': effect = `+${pct(d.bossDamageMult - 1)} de dégâts aux boss/élites`; break
      case 'reductionDegats': effect = `-${pct(d.flatDr)} de dégâts subis`; break
      case 'barriere': effect = `+${Math.round(softCap(rating / PER_PCT, 1, 1.6) * 100)}% PV effectifs`; break
      case 'resilience': effect = `-${pct(d.resilience)} de durée des contrôles & altérations`; break
      case 'volDeVie': effect = `${pct(d.leech)} des dégâts rendus en vie`; break
      case 'surpuissance': effect = `+${pct(d.overpower - 1)} de dégâts globaux`; break
      case 'multifrappe': effect = `${pct(d.multistrike)} de frapper deux fois`; break
      case 'recuperation': effect = `-${pct(d.cdr)} de temps de recharge`; break
    }
    return { key: k, name: m.name, short: m.short, color: m.color, rating, active: rating > 0, effect, desc: m.desc }
  })

  return { primary, secondary }
}
