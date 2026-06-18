/**
 * QUOTIDIEN (v0.31.4) — starter de la boucle de rétention : 3 « Contrats du jour » + « Connexion ».
 *
 * Philosophie idle (cf. mémoire onboarding) : complétable EN JOUANT (pas de corvée active), catch-up
 * sans FOMO (rater un jour ne punit pas), canalise vers les boucles existantes (combat, donjons,
 * métiers), récompense en monnaies RARES (✨🌌💠) pour ne pas toucher l'éco or/éclats TTK-invariante.
 *
 * Sans serveur : reset déterministe à minuit LOCAL ; les 3 contrats sont tirés d'un hash de la date
 * (stables dans la journée, varient d'un jour à l'autre). Métriques = deltas depuis une photo prise au
 * passage de jour (`baseline`), toutes monotones (compteurs à vie + agrégats existants).
 */
import { METIER_LIST, type MetiersState } from './metiers'
import type { InboxReward } from './inbox'

/** Métriques suivies (toutes monotones → un contrat = `valeur du jour − baseline ≥ cible`). */
export interface DailyMetrics {
  /** Kills en combat classique (compteur à vie `totalKills`). */
  kills: number
  /** Donjons terminés (compteur à vie `totalDungeons`). */
  dungeons: number
  /** XP de métier cumulée (somme des métiers). */
  metierXp: number
  /** Record de palier. */
  bestStage: number
}

export interface DailyState {
  /** Jour courant 'AAAA-MM-JJ' (local) ; '' = jamais initialisé. */
  date: string
  /** Ids des 3 contrats tirés pour aujourd'hui. */
  questIds: string[]
  /** Photo des métriques au passage de jour (référence des deltas). */
  baseline: DailyMetrics
  /** Ids des contrats déjà réclamés aujourd'hui. */
  claimed: string[]
  /** Streak de connexion (jours consécutifs) — pilote le jour du calendrier. */
  streak: number
  /** Dernier jour ayant fait avancer le streak. */
  lastLogin: string
  /** Jour où la récompense de connexion a été réclamée (1×/jour). */
  loginClaimed: string
}

export interface DailyQuest {
  id: string
  icon: string
  title: string
  desc: string
  metric: keyof DailyMetrics
  target: number
  reward: InboxReward
  /** Disponible selon l'avancement (un contrat de donjon n'a pas de sens avant le déblocage). */
  available: (ctx: { bestStage: number }) => boolean
}

/** Pool de contrats. ≥3 sont toujours dispo (les 3 « kills » + Conquérant) → tirage de 3 garanti. */
export const DAILY_QUESTS: DailyQuest[] = [
  { id: 'kills1', icon: '⚔️', title: 'Pourfendeur', desc: 'Tue 250 ennemis.', metric: 'kills', target: 250, reward: { poussiere: 30, eclats: 100 }, available: () => true },
  { id: 'kills2', icon: '💀', title: 'Massacre', desc: 'Tue 600 ennemis.', metric: 'kills', target: 600, reward: { poussiere: 50, noyau: 8 }, available: () => true },
  { id: 'kills3', icon: '🔥', title: 'Carnage', desc: 'Tue 1 200 ennemis.', metric: 'kills', target: 1200, reward: { poussiere: 80, fragments: 1 }, available: () => true },
  { id: 'stage', icon: '🧭', title: 'Conquérant', desc: 'Progresse de 3 vagues.', metric: 'bestStage', target: 3, reward: { poussiere: 40, eclats: 150 }, available: (c) => c.bestStage < 690 },
  { id: 'metier', icon: '🔨', title: 'Artisan', desc: 'Gagne 800 XP de métier.', metric: 'metierXp', target: 800, reward: { eclats: 200, noyau: 6 }, available: (c) => c.bestStage >= 6 },
  { id: 'dungeon', icon: '🏰', title: 'Explorateur', desc: 'Termine 2 donjons.', metric: 'dungeons', target: 2, reward: { poussiere: 60, noyau: 10 }, available: (c) => c.bestStage >= 12 },
]

/** Calendrier de connexion 7 jours (cyclique). J7 = jackpot. Monnaies rares uniquement. */
export const LOGIN_REWARDS: InboxReward[] = [
  { poussiere: 40 },                  // J1
  { eclats: 150, gold: 300 },         // J2
  { noyau: 15 },                      // J3
  { poussiere: 80 },                  // J4
  { fragments: 2 },                   // J5
  { noyau: 30, eclats: 250 },         // J6
  { fragments: 5, poussiere: 150 },   // J7 — jackpot
]

export function getDailyQuest(id: string): DailyQuest | undefined {
  return DAILY_QUESTS.find((q) => q.id === id)
}

export function emptyDaily(): DailyState {
  return { date: '', questIds: [], baseline: { kills: 0, dungeons: 0, metierXp: 0, bestStage: 0 }, claimed: [], streak: 0, lastLogin: '', loginClaimed: '' }
}

/** Métriques courantes depuis l'état du store. */
export function dailyMetrics(s: { totalKills: number; totalDungeons: number; metiers: MetiersState; bestStage: number }): DailyMetrics {
  return {
    kills: s.totalKills,
    dungeons: s.totalDungeons,
    metierXp: METIER_LIST.reduce((a, m) => a + (s.metiers[m.id]?.xp ?? 0), 0),
    bestStage: s.bestStage,
  }
}

/** Avancement (borné à la cible) d'un contrat. */
export function questProgress(q: DailyQuest, now: DailyMetrics, baseline: DailyMetrics): number {
  return Math.min(q.target, Math.max(0, now[q.metric] - baseline[q.metric]))
}

export function questDone(q: DailyQuest, now: DailyMetrics, baseline: DailyMetrics): boolean {
  return now[q.metric] - baseline[q.metric] >= q.target
}

/** Récompenses non nulles d'un reward, en (icône, montant) — pour l'affichage du calendrier. */
export function rewardLines(r: InboxReward): { icon: string; amount: number }[] {
  const out: { icon: string; amount: number }[] = []
  if (r.gold) out.push({ icon: '💰', amount: r.gold })
  if (r.eclats) out.push({ icon: '♦', amount: r.eclats })
  if (r.noyau) out.push({ icon: '💠', amount: r.noyau })
  if (r.sceaux) out.push({ icon: '🔑', amount: r.sceaux })
  if (r.fragments) out.push({ icon: '✨', amount: r.fragments })
  if (r.poussiere) out.push({ icon: '🌌', amount: r.poussiere })
  return out
}

/** Nombre d'actions en attente (contrats finis non réclamés + connexion du jour) → red-dot 📅. */
export function dailyClaimableCount(daily: DailyState, now: DailyMetrics, today: string): number {
  let n = 0
  for (const id of daily.questIds) {
    const q = getDailyQuest(id)
    if (q && !daily.claimed.includes(id) && questDone(q, now, daily.baseline)) n++
  }
  if (daily.loginClaimed !== today) n++
  return n
}

/** Jour 'AAAA-MM-JJ' en heure LOCALE. */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Veille d'une date 'AAAA-MM-JJ'. */
function prevDayStr(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return todayStr(dt)
}

/** Millisecondes jusqu'au prochain minuit local (timer de reset). */
export function msUntilReset(d: Date = new Date()): number {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0)
  return next.getTime() - d.getTime()
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tire 3 contrats distincts, dispo selon l'avancement, déterministes pour la date donnée. */
export function pickDailyQuests(date: string, ctx: { bestStage: number }): string[] {
  const avail = DAILY_QUESTS.filter((q) => q.available(ctx))
  const rng = mulberry32(hashStr(date))
  const a = avail.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, 3).map((q) => q.id)
}

/**
 * Calcule le nouvel état quotidien au passage de jour (pur) : streak de connexion + tirage des
 * contrats + photo des métriques (baseline). `loginClaimed` est conservé (nouveau jour ≠ → réclamable).
 */
export function rollDaily(prev: DailyState, now: DailyMetrics, today: string, ctx: { bestStage: number }): DailyState {
  const streak = prev.lastLogin && prev.lastLogin === prevDayStr(today) ? prev.streak + 1 : 1
  return {
    date: today,
    questIds: pickDailyQuests(today, ctx),
    baseline: now,
    claimed: [],
    streak,
    lastLogin: today,
    loginClaimed: prev.loginClaimed,
  }
}
