import { useEffect, useState } from 'react'
import { useGame } from './game/store'
import { useMediaQuery } from './useMediaQuery'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from './game/damage'
import { TALENT_START_LEVEL } from './game/character'
import { CombatPanel } from './components/CombatPanel'
import { StuffScreen } from './components/StuffScreen'
import { HerosHub } from './components/HerosHub'
import { ExpedHub } from './components/ExpedHub'
import { MerchantPanel } from './components/MerchantPanel'
import { GrimoirePanel } from './components/GrimoirePanel'
import { ResetButton } from './components/CharacterPanel'
import { Sheet } from './components/ui'
import { ChestModal } from './components/ChestModal'
import { WelcomeBackModal } from './components/WelcomeBackModal'

const TICK_MS = 200

type Tab = 'combat' | 'stuff' | 'heros' | 'exped' | 'marche'
type DeskTab = 'stuff' | 'heros' | 'exped' | 'marche' | 'grimoire'

/** Paliers de déblocage (révélation progressive de l'UI). */
const MARCHE_STAGE = 10
const DONJON_STAGE = 20
const RAID_STAGE = 50

/** Barre du bas : 5 emplacements maximum — les features futures vivent DANS les hubs. */
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'combat', label: 'Combat', icon: '⚔' },
  { id: 'stuff', label: 'Stuff', icon: '🎒' },
  { id: 'heros', label: 'Héros', icon: '🛡' },
  { id: 'exped', label: 'Expéd.', icon: '🏰' },
  { id: 'marche', label: 'Marché', icon: '🏪' },
]

const DESK_LABEL: Record<DeskTab, string> = {
  stuff: '🎒 Équipement', heros: '🛡 Héros', exped: '🏰 Expéditions', marche: '🏪 Marché', grimoire: '📖 Codex',
}

/** Format court des grands nombres (en-tête mobile : la place est comptée). */
function fmtShort(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' Md'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M'
  if (n >= 10000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k'
  return n.toLocaleString('fr-FR')
}

export default function App() {
  const tick = useGame((s) => s.tick)
  const inventory = useGame((s) => s.inventory)
  const gold = useGame((s) => s.gold)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const poussiere = useGame((s) => s.poussiere)
  const quint = useGame((s) => s.quint)
  const orbes = useGame((s) => s.orbes)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const forgeMastery = useGame((s) => s.forgeMastery)
  const sceaux = useGame((s) => s.sceaux)
  const bestStage = useGame((s) => s.bestStage)
  const characters = useGame((s) => s.characters)
  const dungeonProgress = useGame((s) => s.dungeonProgress)
  const upgrades = useGame((s) => s.upgrades)
  const inDungeon = useGame((s) => s.dungeon !== null)
  const inRaid = useGame((s) => s.raid !== null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [tab, setTab] = useState<Tab>('combat')
  const [deskTab, setDeskTab] = useState<DeskTab>('stuff')
  const [sheet, setSheet] = useState<null | 'monnaies' | 'codex' | 'reglages'>(null)

  useEffect(() => {
    const id = setInterval(() => tick(TICK_MS / 1000), TICK_MS)
    return () => clearInterval(id)
  }, [tick])

  // Révélation progressive : une fonctionnalité n'apparaît qu'une fois pertinente.
  const maxLevel = characters.reduce((m, c) => Math.max(m, c.level), 1)
  const anyDungeon = Object.values(dungeonProgress).some((v) => v > 0)
  const anyUpgrade = Object.values(upgrades).some((v) => v > 0)
  const talentsUnlocked = maxLevel >= TALENT_START_LEVEL || characters.some((c) => c.talentPoints > 0)
  const raidsUnlocked = orbes > 0 || inRaid || bestStage >= RAID_STAGE
  const expedUnlocked = sceaux > 0 || anyDungeon || inDungeon || bestStage >= DONJON_STAGE || raidsUnlocked
  const marcheUnlocked = bestStage >= MARCHE_STAGE || anyUpgrade

  const unlocked: Record<Tab, boolean> = { combat: true, stuff: true, heros: true, exped: expedUnlocked, marche: marcheUnlocked }
  const mobileTabs = TABS.filter((t) => unlocked[t.id])
  const deskTabs = (['stuff', 'heros', 'exped', 'marche', 'grimoire'] as const).filter((t) => t === 'grimoire' || unlocked[t])
  const talentPoints = characters.reduce((a, c) => a + c.talentPoints, 0)

  // Monnaies : l'en-tête mobile n'en montre que 2 + un compteur ; le détail vit dans une feuille
  // (les info-bulles `title` n'existent pas au tactile).
  const quintTotal = DAMAGE_TYPE_LIST.reduce((a, t) => a + (quint[t] ?? 0), 0)
  const currencies = [
    { icon: '💰', name: 'Or', value: gold, cls: 'text-yellow-400' },
    { icon: '♦', name: 'Éclats d\'arcane', value: essence, cls: 'text-cyan-300' },
    { icon: '💠', name: 'Noyaux primordiaux', value: noyau, cls: 'text-fuchsia-300' },
    { icon: '🌌', name: 'Poussière d\'étoile', value: poussiere, cls: 'text-indigo-300' },
    { icon: '⚗️', name: 'Quintessences élémentaires', value: quintTotal, cls: 'text-emerald-300' },
    { icon: '🔧', name: 'Savoir-faire de forge', value: forgeMastery, cls: 'text-amber-200' },
    { icon: '🔮', name: 'Orbes de raid', value: orbes, cls: 'text-rose-300' },
    { icon: '✨', name: 'Fragments d\'éternité', value: fragments, cls: 'text-sky-300' },
    { icon: '💫', name: 'Éclats cosmiques', value: cosmic, cls: 'text-violet-300' },
  ]
  const extraCount = currencies.slice(2).filter((c) => c.value > 0).length

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
                {deskTab === 'heros' ? (
                  <HerosHub talentsUnlocked={talentsUnlocked} />
                ) : deskTab === 'exped' ? (
                  <ExpedHub raidsUnlocked={raidsUnlocked} />
                ) : deskTab === 'marche' ? (
                  <MerchantPanel />
                ) : deskTab === 'grimoire' ? (
                  <GrimoirePanel />
                ) : (
                  <StuffScreen />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Mobile : un hub à la fois */
          <div className="h-full">
            {tab === 'combat' && <CombatPanel />}
            {tab === 'stuff' && <StuffScreen />}
            {tab === 'heros' && <HerosHub talentsUnlocked={talentsUnlocked} />}
            {tab === 'exped' && <ExpedHub raidsUnlocked={raidsUnlocked} />}
            {tab === 'marche' && <MerchantPanel />}
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
            <GrimoirePanel />
          </div>
        </Sheet>
      )}
      {sheet === 'reglages' && (
        <Sheet title="⚙ Réglages" onClose={() => setSheet(null)}>
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500">
              Record de palier : <span className="text-slate-300">{bestStage}</span> · Niveau max : <span className="text-slate-300">{maxLevel}</span>
            </div>
            <ResetButton />
          </div>
        </Sheet>
      )}

      <ChestModal />
      <WelcomeBackModal />
    </div>
  )
}
