/**
 * BOÎTE DE RÉCEPTION ✉ — réceptacle des GAINS à collecter, sorti de l'écran de combat.
 *
 * Sépare la « collecte » (cadeaux, gains hors-ligne, récompenses d'évènement → un clic pour encaisser)
 * du « guidage » (quêtes Premiers Pas) et du combat lui-même. Pensé pour grandir : un daily, un event…
 * y dépose un message via `pushInbox` (store), le joueur le réclame depuis l'icône ✉ flottante.
 */
import type { OfflineReport } from './offline'

/** Récompense créditée à la réclamation d'un message. Sous-ensemble des monnaies du jeu. */
export interface InboxReward {
  gold?: number
  /** ♦ éclats d'arcane (champ `essence` du store). */
  eclats?: number
  noyau?: number
  sceaux?: number
  fragments?: number
  poussiere?: number
}

export type InboxKind = 'welcome' | 'offline' | 'gift' | 'event' | 'system'

export interface InboxMessage {
  id: string
  kind: InboxKind
  icon: string
  title: string
  body?: string
  reward: InboxReward
  /** Lu ? (messages informatifs sans récompense : c'est l'ouverture qui les « consomme »). */
  seen?: boolean
  createdAt: number
  claimed: boolean
}

/** Plafond de messages conservés (les plus anciens tombent) — évite une inbox qui gonfle sans fin. */
export const INBOX_CAP = 30

/** Une récompense non nulle ? (un message purement informatif n'a pas de bouton Réclamer). */
export function hasReward(r: InboxReward): boolean {
  return !!(r.gold || r.eclats || r.noyau || r.sceaux || r.fragments || r.poussiere)
}

/**
 * Un message « demande l'attention » du joueur :
 *  - avec récompense → tant qu'elle n'est PAS réclamée (claim explicite) ;
 *  - sans récompense (recap hors-ligne, annonce d'event) → tant qu'il n'est PAS lu.
 */
export function needsAttention(m: InboxMessage): boolean {
  return hasReward(m.reward) ? !m.claimed : !m.seen
}

/** Nombre de messages à traiter (récompense à réclamer + messages non lus) → red-dot de l'icône ✉. */
export function inboxAttentionCount(inbox: InboxMessage[]): number {
  return inbox.reduce((n, m) => n + (needsAttention(m) ? 1 : 0), 0)
}

/** Résumé lisible d'une récompense (« +500 💰 · +100 ♦ »). */
export function formatInboxReward(r: InboxReward): string {
  const f = (n: number) => n.toLocaleString('fr-FR')
  const parts: string[] = []
  if (r.gold) parts.push(`+${f(r.gold)} 💰`)
  if (r.eclats) parts.push(`+${f(r.eclats)} ♦`)
  if (r.noyau) parts.push(`+${f(r.noyau)} 💠`)
  if (r.sceaux) parts.push(`+${f(r.sceaux)} 🔑`)
  if (r.fragments) parts.push(`+${f(r.fragments)} ✨`)
  if (r.poussiere) parts.push(`+${f(r.poussiere)} 🌌`)
  return parts.join(' · ')
}

/** Durée d'absence lisible (« 2 h 14 min », « 37 min »). */
function fmtAway(ms: number): string {
  const min = Math.floor(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

/**
 * Récap des gains hors-ligne — INFORMATIF : les ressources sont déjà créditées par
 * `simulateOffline`/cold-start, donc `reward` est vide (pas de double-crédit, pas de bouton Réclamer).
 * `seen: false` → l'icône ✉ porte un red-dot « non lu » jusqu'à l'ouverture de la boîte.
 */
export function offlineMessage(report: OfflineReport, now: number): InboxMessage {
  const f = (n: number) => n.toLocaleString('fr-FR')
  const parts = [`⚔ ${f(report.kills)} vaincus`, `💰 +${f(report.gold)}`, `⬆ +${f(report.xp)} XP`]
  if (report.noyau > 0) parts.push(`💠 +${f(report.noyau)}`)
  if (report.sceaux > 0) parts.push(`🔑 +${f(report.sceaux)}`)
  if (report.quint && report.quint.amount > 0) parts.push(`⚗️ +${f(report.quint.amount)}`)
  if (report.items.length > 0) parts.push(`🎒 +${report.items.length} objet${report.items.length > 1 ? 's' : ''}`)
  return {
    id: `offline-${now}`,
    kind: 'offline',
    icon: '🌙',
    title: `Absence — ${fmtAway(report.durationMs)}`,
    body: `Ton équipe a combattu en ton absence : ${parts.join(' · ')}. Gains déjà crédités.`,
    reward: {},
    seen: false,
    createdAt: now,
    claimed: false,
  }
}

/** Message « la boîte est là » (semé une fois) — onboarding : montre OÙ atterrissent les cadeaux. */
export function welcomeMessage(now: number): InboxMessage {
  return {
    id: 'welcome',
    kind: 'welcome',
    icon: '🎁',
    title: 'La boîte de réception est là !',
    body: 'Tes cadeaux, gains hors-ligne et récompenses d\'évènement arriveront désormais ici. Voici un présent pour commencer.',
    reward: { gold: 500, eclats: 100 },
    createdAt: now,
    claimed: false,
  }
}
