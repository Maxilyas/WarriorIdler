import type { DungeonId } from './dungeons'
import type { RaidId } from './raids'
import { DUNGEONS, dungeonRunYield, dungeonKeyYield, butinMinTier, geodeDustYield } from './dungeons'
import { RAIDS, raidFragments } from './raids'

/**
 * AUTOMATES DE FORGE (v0.21) — le sommet du métier de forgeron.
 *
 * Un automate est une machine de guerre craftée (TRÈS cher, 3 maximum) qui refait EN BOUCLE
 * un donjon ou un raid DÉJÀ BATTU, en parallèle de ton équipe (et hors-ligne).
 * Position économique stricte, pour ne rien casser :
 *  - il farme AU NIVEAU RECORD battu (jamais de progression, jamais d'échec) ;
 *  - il CONSOMME les clés normales (Sceaux / Orbes) — pas de ressources gratuites ;
 *  - il rapporte les RESSOURCES à efficacité réduite (60% de base, jusqu'à 85% amélioré) ;
 *  - il ne rapporte JAMAIS le stuff ni les Éclats cosmiques 💫 (réservés au jeu actif) —
 *    le butin du Cache du Pilleur est recyclé en éclats.
 * L'astuce d'optimisation voulue : assigner un automate à l'Antre des Failles (gratuit,
 * produit des Sceaux) pour alimenter les clés des deux autres.
 */

export interface AutomateMission {
  kind: 'dungeon' | 'raid'
  id: DungeonId | RaidId
  /** Niveau de donjon ou tier de raid (= record battu au moment de l'assignation). */
  level: number
}

export interface Automate {
  id: number
  name: string
  mission: AutomateMission | null
  /** Avancement du run en cours (s). */
  progress: number
  paused: boolean
  /** Améliorations (or) : vitesse de run / rendement. */
  speedLvl: number
  yieldLvl: number
  /** Accumulateurs fractionnaires des ressources discrètes (un run peut rapporter 0,6 noyau). */
  bank: Record<string, number>
  /** Bloqué faute de clés (affichage). */
  waiting?: boolean
}

/** v0.26 : 4 machines — la 4e exige le nœud « Manufacture » (arbre du Forgeron niv 40 + P80). */
export const AUTOMATE_MAX = 4
export const AUTOMATE_NAMES = ['Rouage', 'Enclume', 'Vigile', 'Manufacture']

/** Coûts de construction — croissance brutale assumée (sink de très fin de partie).
 *  L'ex-composante Savoir-faire 🔧 est remplacée par un niveau de Forgeron requis (metiers.ts). */
export const AUTOMATE_COSTS: { gold: number; poussiere: number; fragments: number; cosmic: number }[] = [
  { gold: 5_000_000, poussiere: 300, fragments: 100, cosmic: 0 },
  { gold: 25_000_000, poussiere: 1_200, fragments: 400, cosmic: 10 },
  { gold: 120_000_000, poussiere: 5_000, fragments: 1_500, cosmic: 50 },
  { gold: 500_000_000, poussiere: 18_000, fragments: 5_000, cosmic: 200 },
]

/** Efficacité de récolte : 60% de base, +5% par niveau de rendement (max 85%). */
export const AUTOMATE_EFF_BASE = 0.6
export const AUTOMATE_EFF_PER_YIELD = 0.05
/** Réduction de durée par niveau de vitesse (max −35%). */
export const AUTOMATE_SPEED_PER_LVL = 0.07
export const AUTOMATE_UPG_MAX = 5

/** Coût (or) d'une amélioration d'automate. */
export function automateUpgradeCost(kind: 'speed' | 'yield', lvl: number): number {
  return Math.round((kind === 'speed' ? 400_000 : 500_000) * Math.pow(2, lvl))
}

export function automateEfficiency(a: Automate): number {
  return AUTOMATE_EFF_BASE + AUTOMATE_EFF_PER_YIELD * a.yieldLvl
}

/** Durée (s) d'un run automatisé — plus lent qu'un joueur actif, accéléré par les améliorations.
 *  `durMult` : bonus du nœud « Chaîne de montage » du Forgeron (≤ 1). */
export function automateRunDuration(a: Automate, durMult = 1): number {
  if (!a.mission) return Infinity
  const base = a.mission.kind === 'dungeon' ? 45 + 10 * a.mission.level : 90 + 20 * a.mission.level
  return base * (1 - AUTOMATE_SPEED_PER_LVL * a.speedLvl) * durMult
}

/** Libellé court de la mission. */
export function missionLabel(m: AutomateMission): string {
  if (m.kind === 'dungeon') {
    const d = DUNGEONS[m.id as DungeonId]
    return `${d.icon} ${d.name} niv. ${m.level}`
  }
  const r = RAIDS[m.id as RaidId]
  return `${r.icon} ${r.name} T${m.level}`
}

/** Coût en clés d'un run de la mission. */
export function missionKeyCost(m: AutomateMission): { sceaux: number; orbes: number } {
  if (m.kind === 'dungeon') return { sceaux: DUNGEONS[m.id as DungeonId].sceauCost, orbes: 0 }
  return { sceaux: 0, orbes: RAIDS[m.id as RaidId].orbeCost }
}

/** Gains BRUTS d'un run (avant efficacité), en flottants. `xp` = XP par personnage vivant. */
function runGains(m: AutomateMission): Record<string, number> {
  if (m.kind === 'dungeon') {
    const def = DUNGEONS[m.id as DungeonId]
    const N = m.level
    switch (def.reward) {
      case 'gold': return { gold: dungeonRunYield('gold', N) }
      case 'eclats': return { essence: dungeonRunYield('eclats', N) }
      case 'noyau': return { noyau: dungeonRunYield('noyau', N) }
      case 'poussiere': return { poussiere: dungeonRunYield('poussiere', N) }
      case 'sceaux': return { sceaux: dungeonKeyYield('sceaux', N) }
      case 'orbes': return { orbes: dungeonKeyYield('orbes', N) }
      case 'xp': return { xp: 1200 * N * Math.pow(1.12, N) }
      // Cache du Pilleur : le butin est RECYCLÉ par l'automate (pas de stuff hors jeu actif).
      case 'stuff': return { essence: (3 + N / 2) * 3 * Math.pow(butinMinTier(N) + 1, 1.8) }
      // La Géode : l'automate ne rapporte QUE la poussière 🔹 — jamais les gemmes (jeu actif).
      case 'gemmes': return { gemDust: geodeDustYield(N) }
    }
  }
  const def = RAIDS[m.id as RaidId]
  const T = m.level
  return {
    essence: 200 * T * def.baseDifficulty,
    gold: 400 * T * def.baseDifficulty,
    noyau: 3 + T,
    sceaux: 1,
    poussiere: Math.floor(T / 2),
    fragments: raidFragments(def, T),
    // PAS d'Éclat cosmique 💫 ni de stuff : réservés au jeu actif.
  }
}

/** Pool de ressources sur lequel les automates opèrent (sous-ensemble du store). */
export interface AutomateEconomy {
  automates: Automate[]
  gold: number
  essence: number
  noyau: number
  poussiere: number
  sceaux: number
  orbes: number
  fragments: number
  /** 🔹 Poussière de gemme (La Géode — la seule chose qu'un automate y rapporte). */
  gemDust: number
}

export interface AutomateTickResult {
  eco: AutomateEconomy
  /** Une ligne de log par automate ayant terminé ≥ 1 run pendant ce pas. */
  lines: string[]
  /** XP à créditer à chaque personnage vivant (déjà multipliée par l'efficacité). */
  xpEach: number
  completed: boolean
}

const GAIN_LABELS: Record<string, string> = {
  gold: 'or', essence: '♦', noyau: '💠', poussiere: '🌌', sceaux: '🔑', orbes: '🔮', fragments: '✨', gemDust: '🔹', xp: 'XP',
}

/**
 * Fait avancer tous les automates de `dt` secondes (fonctionne aussi pour le hors-ligne avec un
 * grand dt : chaque run est résolu en boucle, clés consommées au fil de l'eau — un automate
 * assigné à l'Antre des Failles peut donc alimenter les suivants).
 * Renvoie null si aucun automate actif (zéro coût sur le tick).
 */
export function tickAutomates(input: AutomateEconomy, dt: number, keySaveChance = 0, durMult = 1): AutomateTickResult | null {
  if (!input.automates.some((a) => a.mission && !a.paused)) return null
  const eco: AutomateEconomy = { ...input, automates: input.automates.map((a) => ({ ...a, bank: { ...a.bank } })) }
  const lines: string[] = []
  let xpEach = 0
  let completed = false

  for (const a of eco.automates) {
    if (!a.mission || a.paused) continue
    const duration = automateRunDuration(a, durMult)
    const key = missionKeyCost(a.mission)
    const eff = automateEfficiency(a)
    a.progress += dt
    let runs = 0
    while (a.progress >= duration) {
      if (eco.sceaux < key.sceaux || eco.orbes < key.orbes) {
        a.progress = duration // prêt à partir dès que les clés arrivent
        a.waiting = true
        break
      }
      a.waiting = false
      // Rune de l'Économe : chance de préserver la clé (s'applique aussi aux machines).
      if (!(keySaveChance > 0 && Math.random() < keySaveChance)) {
        eco.sceaux -= key.sceaux
        eco.orbes -= key.orbes
      }
      a.progress -= duration
      runs++
      const gains = runGains(a.mission)
      for (const k in gains) {
        a.bank[k] = (a.bank[k] ?? 0) + gains[k] * eff
      }
    }
    if (runs > 0) {
      completed = true
      // Crédite les unités entières accumulées (les fractions restent en banque).
      const parts: string[] = []
      const credit = (k: 'gold' | 'essence' | 'noyau' | 'poussiere' | 'sceaux' | 'orbes' | 'fragments' | 'gemDust') => {
        const whole = Math.floor(a.bank[k] ?? 0)
        if (whole <= 0) return
        a.bank[k] -= whole
        eco[k] += whole
        parts.push(`+${whole.toLocaleString('fr-FR')} ${GAIN_LABELS[k]}`)
      }
      credit('gold'); credit('essence'); credit('noyau'); credit('poussiere'); credit('sceaux'); credit('orbes'); credit('fragments'); credit('gemDust')
      const xpWhole = Math.floor(a.bank.xp ?? 0)
      if (xpWhole > 0) {
        a.bank.xp -= xpWhole
        xpEach += xpWhole
        parts.push(`+${xpWhole.toLocaleString('fr-FR')} XP`)
      }
      lines.push(`🤖 ${a.name} · ${missionLabel(a.mission)} ×${runs}${parts.length ? ` : ${parts.join(', ')}` : ''}`)
    }
  }
  return { eco, lines, xpEach, completed }
}
