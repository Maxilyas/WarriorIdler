/**
 * ÉVÉNEMENT — INVASION ÉLÉMENTAIRE. Premier event de la boucle live-ops.
 *
 * Une semaine = un élément envahit (rotation déterministe, SANS serveur). Le joueur accumule des
 * « points d'invasion » en jouant (= kills depuis le début de l'event, réutilise `totalKills` → aucun
 * hook combat), et réclame des seuils. Le capstone débloque une AURA élémentaire EXCLUSIVE (zéro
 * puissance, façon parures Légende) — collectionnable au fil des semaines. Reset hebdomadaire (le
 * grind + l'élément + l'aura tournent), d'où la pression « limité dans le temps » du genre.
 *
 * Livraison cohérente avec le cluster : 4ᵉ icône 🎉, réclamation en panneau (comme 📅).
 */
import type { DamageType } from './types'
import type { InboxReward } from './inbox'

/** Éléments envahisseurs (le Physique n'envahit pas) — pilote la rotation + l'aura débloquée. */
export const INVASION_ELEMENTS: DamageType[] = ['feu', 'froid', 'foudre', 'arcane', 'ombre', 'nature']

export interface EventState {
  /** Clé de semaine (index de semaine depuis l'epoch) ; '' = jamais initialisé. */
  week: string
  /** Élément envahisseur courant. */
  element: DamageType
  /** `totalKills` au début de l'event → points = totalKills − baseline (remis à zéro chaque semaine). */
  baseline: number
  /** Index des seuils déjà réclamés cette semaine. */
  claimed: number[]
}

export interface EventMilestone {
  points: number
  reward: InboxReward
  /** Capstone : débloque AUSSI l'aura élémentaire (`inv_<element>`). */
  aura?: boolean
}

/** Seuils d'invasion (points = kills de la semaine). Capstone = aura exclusive + grosse poussière. */
export const EVENT_MILESTONES: EventMilestone[] = [
  { points: 200, reward: { poussiere: 40 } },
  { points: 600, reward: { eclats: 200, noyau: 8 } },
  { points: 1500, reward: { poussiere: 100 } },
  { points: 3500, reward: { fragments: 2, noyau: 15 } },
  { points: 7000, reward: { poussiere: 200 }, aura: true },
]

const MS_WEEK = 7 * 24 * 3600 * 1000

/** Index de semaine depuis l'epoch (UTC) — clé stable + pilote la rotation. */
export function weekIndex(now: number = Date.now()): number {
  return Math.floor(now / MS_WEEK)
}

export function eventElementFor(wIndex: number): DamageType {
  const n = INVASION_ELEMENTS.length
  return INVASION_ELEMENTS[((wIndex % n) + n) % n]
}

/** Millisecondes avant la fin de l'event (prochaine bascule de semaine). */
export function msUntilEventEnd(now: number = Date.now()): number {
  return (weekIndex(now) + 1) * MS_WEEK - now
}

/** Id de l'aura élémentaire débloquée (doit correspondre à AVATAR_AURAS). */
export function invasionAuraId(element: DamageType): string {
  return `inv_${element}`
}

export function emptyEvent(): EventState {
  return { week: '', element: 'feu', baseline: 0, claimed: [] }
}

/** Points d'invasion courants (kills depuis le début de l'event, jamais négatif). */
export function eventPoints(ev: EventState, totalKills: number): number {
  return Math.max(0, totalKills - ev.baseline)
}

/** Seuils atteints non réclamés → red-dot de l'icône 🎉. */
export function eventClaimableCount(ev: EventState, totalKills: number): number {
  const pts = eventPoints(ev, totalKills)
  let n = 0
  for (let i = 0; i < EVENT_MILESTONES.length; i++) {
    if (pts >= EVENT_MILESTONES[i].points && !ev.claimed.includes(i)) n++
  }
  return n
}

/**
 * Nouvel état d'event au passage de semaine (pur) : nouvel élément + baseline remise sur `totalKills`
 * + seuils remis à zéro. Inchangé si on est déjà dans la bonne semaine.
 */
export function rollEvent(prev: EventState, totalKills: number, now: number = Date.now()): EventState {
  const wi = weekIndex(now)
  const week = String(wi)
  if (prev.week === week) return prev
  return { week, element: eventElementFor(wi), baseline: totalKills, claimed: [] }
}
