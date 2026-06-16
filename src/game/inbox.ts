/**
 * BOÎTE DE RÉCEPTION ✉ (v0.31.2) — réceptacle des GAINS à collecter, sorti de l'écran de combat.
 *
 * Sépare la « collecte » (cadeaux, gains hors-ligne, récompenses d'évènement → un clic pour encaisser)
 * du « guidage » (quêtes Premiers Pas) et du combat lui-même. Pensé pour grandir : un daily, un event…
 * y dépose un message via `pushInbox` (store), le joueur le réclame depuis l'icône ✉ flottante.
 */

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
  createdAt: number
  claimed: boolean
}

/** Plafond de messages conservés (les plus anciens tombent) — évite une inbox qui gonfle sans fin. */
export const INBOX_CAP = 30

/** Une récompense non nulle ? (un message purement informatif n'a pas de bouton Réclamer). */
export function hasReward(r: InboxReward): boolean {
  return !!(r.gold || r.eclats || r.noyau || r.sceaux || r.fragments || r.poussiere)
}

/** Nombre de messages encore à réclamer → alimente le red-dot de l'icône ✉. */
export function inboxUnclaimedCount(inbox: InboxMessage[]): number {
  return inbox.reduce((n, m) => n + (!m.claimed && hasReward(m.reward) ? 1 : 0), 0)
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
