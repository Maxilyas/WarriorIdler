import { useEffect, useState, lazy, Suspense } from 'react'
import { useGame } from './game/store'
import { flushSave } from './game/save'
import { chapitreOf } from './game/progression'
import { useMediaQuery } from './useMediaQuery'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from './game/damage'
import { TALENT_START_LEVEL, teamTalentPool } from './game/character'
import { METIER_LIST, pointsAvailable } from './game/metiers'
import { CombatPanel } from './components/CombatPanel'
import { ResetButton } from './components/CharacterPanel'
import { SaveTransfer } from './components/SaveTransfer'
import { SlotManager } from './components/SlotManager'
import { Sheet } from './components/ui'
import { ChestModal } from './components/ChestModal'
import { ChoiceModal } from './components/ChoiceModal'
import { WelcomeScreen } from './components/WelcomeScreen'

// v0.40.5 (perf, lot 8) — CODE-SPLITTING : les panneaux NON-combat sont chargés à la demande
// (React.lazy) → ils sortent du bundle initial, qui ne garde que le combat + l'accueil (démarrage
// plus rapide). Exports nommés → on remappe en `default` pour `import()`. La PWA (generateSW)
// précache TOUS les chunks → hors-ligne OK même pour un onglet jamais ouvert.
const StuffScreen = lazy(() => import('./components/StuffScreen').then((m) => ({ default: m.StuffScreen })))
const AtelierPanel = lazy(() => import('./components/AtelierPanel').then((m) => ({ default: m.AtelierPanel })))
const HerosHub = lazy(() => import('./components/HerosHub').then((m) => ({ default: m.HerosHub })))
const ExpedHub = lazy(() => import('./components/ExpedHub').then((m) => ({ default: m.ExpedHub })))
const MerchantPanel = lazy(() => import('./components/MerchantPanel').then((m) => ({ default: m.MerchantPanel })))
const GrimoirePanel = lazy(() => import('./components/GrimoirePanel').then((m) => ({ default: m.GrimoirePanel })))

/** Repli affiché le temps qu'un chunk d'onglet se charge (instantané une fois précaché/visité). */
const panelFallback = (
  <div className="flex h-full items-center justify-center text-sm text-slate-500">Chargement…</div>
)

const TICK_MS = 200

type Tab = 'combat' | 'stuff' | 'atelier' | 'heros' | 'exped' | 'marche'
type DeskTab = 'stuff' | 'atelier' | 'heros' | 'exped' | 'marche' | 'grimoire'

/** Paliers de déblocage (révélation progressive de l'UI). v0.31 — avancés pour l'onboarding : on
 *  découvre les systèmes TÔT (pendant que le combat est encore lent), guidé par la chaîne « Premiers
 *  Pas ». Marché 3 · Atelier/Forge 6 · Donjons 12 · Raids 50 (endgame, inchangé). */
const MARCHE_STAGE = 3
const ATELIER_STAGE = 6
const DONJON_STAGE = 12
const RAID_STAGE = 50

/** Barre du bas : 6 emplacements maximum — les features futures vivent DANS les hubs. */
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'combat', label: 'Combat', icon: '⚔' },
  { id: 'stuff', label: 'Stuff', icon: '🎒' },
  { id: 'atelier', label: 'Atelier', icon: '🔨' },
  { id: 'heros', label: 'Héros', icon: '🛡' },
  { id: 'exped', label: 'Expéd.', icon: '🏰' },
  { id: 'marche', label: 'Marché', icon: '🏪' },
]

const DESK_LABEL: Record<DeskTab, string> = {
  stuff: '🎒 Équipement', atelier: '🔨 Atelier', heros: '🛡 Héros', exped: '🏰 Expéditions', marche: '🏪 Marché', grimoire: '📖 Codex',
}

/** Format court des grands nombres (en-tête mobile : la place est comptée). */
function fmtShort(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' Md'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M'
  if (n >= 10000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k'
  return n.toLocaleString('fr-FR')
}

/** Écran de chargement (Palier 2) : affiché le temps que le boot async lise le stockage durable. */
function BootScreen() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-[#0b0e14] text-slate-400">
      <div className="text-3xl">⚔</div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-orange-500" />
      </div>
      <div className="text-xs">Chargement de la partie…</div>
    </div>
  )
}

/** Racine : tant que le store n'est pas hydraté (boot async, Palier 2), on montre l'écran de chargement.
 *  Le vrai jeu (`GameApp`) n'est monté qu'APRÈS — ses effets (tick, cycle de vie) ne tournent donc
 *  jamais sur l'état placeholder. */
export default function App() {
  const booted = useGame((s) => s.booted)
  if (!booted) return <BootScreen />
  return <GameApp />
}

function GameApp() {
  const tick = useGame((s) => s.tick)
  const markAway = useGame((s) => s.markAway)
  const resumeAway = useGame((s) => s.resumeAway)
  const rotateBiomeIfDue = useGame((s) => s.rotateBiomeIfDue)
  const checkAchievements = useGame((s) => s.checkAchievements)
  const rollDailyIfNeeded = useGame((s) => s.rollDailyIfNeeded)
  const rollEventIfNeeded = useGame((s) => s.rollEventIfNeeded)
  const inventory = useGame((s) => s.inventory)
  const gold = useGame((s) => s.gold)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const poussiere = useGame((s) => s.poussiere)
  const gemDust = useGame((s) => s.gemDust)
  const quint = useGame((s) => s.quint)
  const orbes = useGame((s) => s.orbes)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const metiers = useGame((s) => s.metiers)
  const sceaux = useGame((s) => s.sceaux)
  const bestStage = useGame((s) => s.bestStage)
  const characters = useGame((s) => s.characters)
  const dungeonProgress = useGame((s) => s.dungeonProgress)
  const upgrades = useGame((s) => s.upgrades)
  const onboarded = useGame((s) => s.onboarded)
  const inDungeon = useGame((s) => s.dungeon !== null)
  const inRaid = useGame((s) => s.raid !== null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [tab, setTab] = useState<Tab>('combat')
  const [deskTab, setDeskTab] = useState<DeskTab>('stuff')
  const [sheet, setSheet] = useState<null | 'monnaies' | 'codex' | 'reglages'>(null)
  const [paused, setPaused] = useState(false)
  // F1 — garder l'écran allumé (préférence persistée ; off par défaut pour la batterie).
  const [keepAwake, setKeepAwake] = useState(() => {
    try { return localStorage.getItem('wi-keepAwake') === '1' } catch { return false }
  })

  // Boucle de tick — suspendue en arrière-plan (F3) ET tant que l'écran d'accueil n'est pas franchi
  // (sinon le combat lancerait les paliers — et le butin — avant le choix de spé).
  useEffect(() => {
    if (paused || !onboarded) return
    const id = setInterval(() => tick(TICK_MS / 1000), TICK_MS)
    return () => clearInterval(id)
  }, [tick, paused, onboarded])

  // F2 — rotation subie des biomes : vérifiée toutes les 5 s (hors du tick de combat).
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => rotateBiomeIfDue(), 5000)
    return () => clearInterval(id)
  }, [rotateBiomeIfDue, paused])

  // 🏆 Hauts faits : évaluation périodique (hors du tick de combat) + un passage immédiat au montage.
  useEffect(() => {
    if (paused) return
    checkAchievements()
    const id = setInterval(() => checkAchievements(), 4000)
    return () => clearInterval(id)
  }, [checkAchievements, paused])

  // 📅🎉 Quotidien + event : passage de jour/semaine vérifié hors du tick + un passage immédiat au montage.
  useEffect(() => {
    if (paused) return
    rollDailyIfNeeded()
    rollEventIfNeeded()
    const id = setInterval(() => { rollDailyIfNeeded(); rollEventIfNeeded() }, 60000)
    return () => clearInterval(id)
  }, [rollDailyIfNeeded, rollEventIfNeeded, paused])

  // F3 — cycle de vie mobile : arrière-plan → suspend le tick + horodate ; retour → gains hors-ligne.
  useEffect(() => {
    // markAway persiste déjà (synchrone) en horodatant lastSeen ; flushSave force en plus l'écriture
    // d'un éventuel instantané throttlé encore en attente (boucle de combat) → zéro perte à la fermeture.
    const onHide = () => { markAway(); flushSave(); setPaused(true) }
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide()
      else { resumeAway(); setPaused(false) }
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
    }
  }, [markAway, resumeAway])

  // F1 — Screen Wake Lock : maintient l'écran allumé tant que c'est activé (ré-acquis au retour).
  useEffect(() => {
    try { localStorage.setItem('wi-keepAwake', keepAwake ? '1' : '0') } catch { /* */ }
    if (!keepAwake) return
    let sentinel: { release: () => Promise<void> } | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<typeof sentinel> } }
        if (nav.wakeLock && document.visibilityState === 'visible') sentinel = await nav.wakeLock.request('screen')
      } catch { /* non supporté / refusé : silencieux */ }
    }
    acquire()
    const onVis = () => { if (document.visibilityState === 'visible' && !cancelled) acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      try { sentinel?.release() } catch { /* */ }
    }
  }, [keepAwake])

  // Révélation progressive : une fonctionnalité n'apparaît qu'une fois pertinente.
  const maxLevel = characters.reduce((m, c) => Math.max(m, c.level), 1)
  const anyDungeon = Object.values(dungeonProgress).some((v) => v > 0)
  const anyUpgrade = Object.values(upgrades).some((v) => v > 0)
  const talentsUnlocked = maxLevel >= TALENT_START_LEVEL || teamTalentPool(characters, upgrades.talentBonus ?? 0) > 0
  const raidsUnlocked = orbes > 0 || inRaid || bestStage >= RAID_STAGE
  const expedUnlocked = sceaux > 0 || anyDungeon || inDungeon || bestStage >= DONJON_STAGE || raidsUnlocked
  const marcheUnlocked = bestStage >= MARCHE_STAGE || anyUpgrade
  const atelierUnlocked = bestStage >= ATELIER_STAGE || metiers.forgeron.xp > 0
  // Points d'arbre de métier à dépenser (badge sur l'onglet Atelier).
  const metierPoints = METIER_LIST.reduce((a, m) => a + (bestStage >= m.unlockStage ? pointsAvailable(metiers[m.id]) : 0), 0)

  const unlocked: Record<Tab, boolean> = { combat: true, stuff: true, atelier: atelierUnlocked, heros: true, exped: expedUnlocked, marche: marcheUnlocked }
  const mobileTabs = TABS.filter((t) => unlocked[t.id])
  const deskTabs = (['stuff', 'atelier', 'heros', 'exped', 'marche', 'grimoire'] as const).filter((t) => t === 'grimoire' || unlocked[t])
  // v0.36 — pool de talents PARTAGÉ (compte), dérivé : badge non gonflé par les alts.
  const talentPoints = teamTalentPool(characters, upgrades.talentBonus ?? 0)

  // Monnaies : l'en-tête mobile n'en montre que 2 + un compteur ; le détail vit dans une feuille
  // (les info-bulles `title` n'existent pas au tactile).
  const quintTotal = DAMAGE_TYPE_LIST.reduce((a, t) => a + (quint[t] ?? 0), 0)
  const currencies = [
    { icon: '💰', name: 'Or', value: gold, cls: 'text-yellow-400' },
    { icon: '♦', name: 'Éclats d\'arcane', value: essence, cls: 'text-cyan-300' },
    { icon: '💠', name: 'Noyaux primordiaux', value: noyau, cls: 'text-fuchsia-300' },
    { icon: '🌌', name: 'Poussière d\'étoile', value: poussiere, cls: 'text-indigo-300' },
    { icon: '🔹', name: 'Poussière de gemme', value: gemDust, cls: 'text-sky-300' },
    { icon: '⚗️', name: 'Quintessences élémentaires', value: quintTotal, cls: 'text-emerald-300' },
    { icon: '🔮', name: 'Orbes de raid', value: orbes, cls: 'text-rose-300' },
    { icon: '✨', name: 'Fragments d\'éternité', value: fragments, cls: 'text-sky-300' },
    { icon: '💫', name: 'Éclats cosmiques', value: cosmic, cls: 'text-violet-300' },
  ]
  const extraCount = currencies.slice(2).filter((c) => c.value > 0).length

  // Partie NEUVE : on présente le but du jeu + le choix de spé avant tout. Le combat reste en pause
  // (tick gardé ci-dessus) jusqu'à ce que le joueur lance l'aventure.
  if (!onboarded) return <WelcomeScreen />

  return (
    <div className="mx-auto flex h-[100dvh] max-w-6xl flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 sm:px-4">
        <h1 className="shrink-0 whitespace-nowrap text-base font-bold tracking-wide">
          <span className="text-orange-400">⚔</span> Warrior <span className="text-orange-400">Idler</span>
        </h1>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {isDesktop ? (
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-xs font-medium">
              {currencies.filter((c, i) => i < 2 || c.value > 0).map((c) => (
                <span key={c.name} className={c.cls} title={c.name}>{c.icon} {c.value.toLocaleString('fr-FR')}</span>
              ))}
            </div>
          ) : (
            <button onClick={() => setSheet('monnaies')} className="flex shrink-0 items-center gap-2 whitespace-nowrap px-1 py-1.5 text-xs font-medium">
              <span className="text-yellow-400">💰 {fmtShort(gold)}</span>
              <span className="text-cyan-300">♦ {fmtShort(essence)}</span>
              {extraCount > 0 && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">+{extraCount} ▾</span>}
            </button>
          )}
          {!isDesktop && (
            <button onClick={() => setSheet('codex')} className="rounded-lg bg-slate-800/70 px-2 py-1.5 text-sm" aria-label="Codex">
              📖
            </button>
          )}
          <button onClick={() => setSheet('reglages')} className="rounded-lg bg-slate-800/70 px-2 py-1.5 text-sm" aria-label="Réglages">
            ⚙
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-3">
        {isDesktop ? (
          /* Desktop : Combat fixe à gauche + hub à droite */
          <div className="grid h-full grid-cols-[320px_1fr] gap-3">
            <div className="min-h-0 overflow-hidden">
              <CombatPanel />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {deskTabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDeskTab(t)}
                    className={
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
                      (deskTab === t ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200')
                    }
                  >
                    {DESK_LABEL[t]}
                    {t === 'atelier' && metierPoints > 0 && (
                      <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-950">{metierPoints}</span>
                    )}
                    {t === 'heros' && talentPoints > 0 && (
                      <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-950">{talentPoints}</span>
                    )}
                    {t === 'exped' && (sceaux > 0 || inDungeon || inRaid) && (
                      <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-950">
                        {inDungeon || inRaid ? '!' : sceaux}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                <Suspense fallback={panelFallback}>
                  {deskTab === 'heros' ? (
                    <HerosHub talentsUnlocked={talentsUnlocked} />
                  ) : deskTab === 'exped' ? (
                    <ExpedHub raidsUnlocked={raidsUnlocked} />
                  ) : deskTab === 'marche' ? (
                    <MerchantPanel />
                  ) : deskTab === 'grimoire' ? (
                    <GrimoirePanel />
                  ) : deskTab === 'atelier' ? (
                    <AtelierPanel />
                  ) : (
                    <StuffScreen />
                  )}
                </Suspense>
              </div>
            </div>
          </div>
        ) : (
          /* Mobile : un hub à la fois */
          <div className="h-full">
            <Suspense fallback={panelFallback}>
              {tab === 'combat' && <CombatPanel />}
              {tab === 'stuff' && <StuffScreen />}
              {tab === 'atelier' && <AtelierPanel />}
              {tab === 'heros' && <HerosHub talentsUnlocked={talentsUnlocked} />}
              {tab === 'exped' && <ExpedHub raidsUnlocked={raidsUnlocked} />}
              {tab === 'marche' && <MerchantPanel />}
            </Suspense>
          </div>
        )}
      </main>

      {/* Barre d'onglets (mobile) — seules les fonctionnalités débloquées apparaissent */}
      {!isDesktop && (
        <nav className="grid border-t border-slate-800" style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))` }}>
          {mobileTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'relative flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ' +
                (tab === t.id ? 'text-orange-400' : 'text-slate-500')
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
              {t.id === 'stuff' && inventory.length > 0 && (
                <span className="absolute right-2 top-1 rounded-full bg-slate-700 px-1 text-[9px] text-slate-200">
                  {inventory.length}
                </span>
              )}
              {t.id === 'atelier' && metierPoints > 0 && (
                <span className="absolute right-2 top-1 rounded-full bg-amber-500 px-1 text-[9px] text-slate-950">{metierPoints}</span>
              )}
              {t.id === 'heros' && talentPoints > 0 && (
                <span className="absolute right-2 top-1 rounded-full bg-amber-500 px-1 text-[9px] text-slate-950">{talentPoints}</span>
              )}
              {t.id === 'exped' && (sceaux > 0 || inDungeon || inRaid) && (
                <span className="absolute right-2 top-1 rounded-full bg-amber-500 px-1 text-[9px] text-slate-950">
                  {inDungeon || inRaid ? '!' : sceaux}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}

      {/* Feuilles d'en-tête : monnaies / codex / réglages */}
      {sheet === 'monnaies' && (
        <Sheet title="Ressources" onClose={() => setSheet(null)}>
          <div className="space-y-1.5">
            {currencies.filter((c, i) => i < 2 || c.value > 0).map((c) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className={c.cls}>{c.icon} {c.name}</span>
                <span className="tabular-nums text-slate-200">{c.value.toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
          {quintTotal > 0 && (
            <div className="mt-2 border-t border-slate-800 pt-2 text-[11px]">
              <span className="text-slate-500">Quintessences par élément : </span>
              {DAMAGE_TYPE_LIST.filter((t) => (quint[t] ?? 0) > 0).map((t) => (
                <span key={t} className="mr-2" style={{ color: DAMAGE_TYPES[t].color }}>
                  {DAMAGE_TYPES[t].icon} {quint[t]}
                </span>
              ))}
            </div>
          )}
        </Sheet>
      )}
      {sheet === 'codex' && (
        <Sheet title="📖 Codex" onClose={() => setSheet(null)}>
          <div className="h-[72vh]">
            <Suspense fallback={panelFallback}>
              <GrimoirePanel />
            </Suspense>
          </div>
        </Sheet>
      )}
      {sheet === 'reglages' && (
        <Sheet title="⚙ Réglages" onClose={() => setSheet(null)}>
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500">
              Record : <span className="text-slate-300">Chapitre {chapitreOf(bestStage)}</span> · Niveau max : <span className="text-slate-300">{maxLevel}</span>
            </div>
            {/* F1 — empêcher la mise en veille de l'écran (consomme plus de batterie). */}
            <label className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
              <span>📱 Garder l'écran allumé</span>
              <input type="checkbox" checked={keepAwake} onChange={(e) => setKeepAwake(e.target.checked)} className="h-4 w-4 accent-orange-500" />
            </label>
            <SlotManager />
            <SaveTransfer />
            <ResetButton />
          </div>
        </Sheet>
      )}

      <ChestModal />
      <ChoiceModal />
    </div>
  )
}
