import { useEffect, useState } from 'react'
import { useGame } from './game/store'
import { useMediaQuery } from './useMediaQuery'
import { CombatPanel } from './components/CombatPanel'
import { CharacterPanel } from './components/CharacterPanel'
import { TalentTree } from './components/TalentTree'
import { StuffScreen } from './components/StuffScreen'
import { DungeonPanel } from './components/DungeonPanel'
import { RaidPanel } from './components/RaidPanel'
import { MerchantPanel } from './components/MerchantPanel'
import { ChestModal } from './components/ChestModal'
import { WelcomeBackModal } from './components/WelcomeBackModal'

const TICK_MS = 200

type Tab = 'combat' | 'perso' | 'talents' | 'stuff' | 'donjons' | 'raids' | 'marchand'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'combat', label: 'Combat', icon: '⚔' },
  { id: 'perso', label: 'Perso', icon: '🛡' },
  { id: 'talents', label: 'Talents', icon: '🌌' },
  { id: 'stuff', label: 'Stuff', icon: '🎒' },
  { id: 'donjons', label: 'Donjons', icon: '🏰' },
  { id: 'raids', label: 'Raids', icon: '☠️' },
  { id: 'marchand', label: 'Marché', icon: '🏪' },
]

export default function App() {
  const tick = useGame((s) => s.tick)
  const inventory = useGame((s) => s.inventory)
  const gold = useGame((s) => s.gold)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const poussiere = useGame((s) => s.poussiere)
  const orbes = useGame((s) => s.orbes)
  const fragments = useGame((s) => s.fragments)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const sceaux = useGame((s) => s.sceaux)
  const inDungeon = useGame((s) => s.dungeon !== null)
  const inRaid = useGame((s) => s.raid !== null)
  const [tab, setTab] = useState<Tab>('combat')
  const [deskTab, setDeskTab] = useState<'perso' | 'talents' | 'stuff' | 'donjons' | 'raids' | 'marchand'>('stuff')

  useEffect(() => {
    const id = setInterval(() => tick(TICK_MS / 1000), TICK_MS)
    return () => clearInterval(id)
  }, [tick])

  return (
    <div className="mx-auto flex h-[100dvh] max-w-6xl flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <h1 className="text-base font-bold tracking-wide">
          <span className="text-orange-400">⚔</span> Warrior <span className="text-orange-400">Idler</span>
        </h1>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="text-yellow-400">💰 {gold.toLocaleString('fr-FR')}</span>
          <span className="text-cyan-300" title="Éclats d'arcane">♦ {essence.toLocaleString('fr-FR')}</span>
          <span className="text-fuchsia-300" title="Noyau primordial (boss)">💠 {noyau.toLocaleString('fr-FR')}</span>
          {poussiere > 0 && <span className="text-indigo-300" title="Poussière d'étoile (craft sommital)">🌌 {poussiere.toLocaleString('fr-FR')}</span>}
          {orbes > 0 && <span className="text-rose-300" title="Orbe de raid">🔮 {orbes.toLocaleString('fr-FR')}</span>}
          {fragments > 0 && <span className="text-sky-300" title="Fragment d'éternité">✨ {fragments.toLocaleString('fr-FR')}</span>}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-3">
        {isDesktop ? (
          /* Desktop : Combat fixe à gauche + onglet Perso/Stuff à droite */
          <div className="grid h-full grid-cols-[320px_1fr] gap-3">
            <div className="min-h-0 overflow-hidden">
              <CombatPanel />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-3 flex gap-1.5">
                {(['stuff', 'perso', 'talents', 'donjons', 'raids', 'marchand'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDeskTab(t)}
                    className={
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
                      (deskTab === t ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200')
                    }
                  >
                    {t === 'stuff' ? '🎒 Équipement' : t === 'perso' ? '🛡 Personnage' : t === 'talents' ? '🌌 Talents' : t === 'donjons' ? '🏰 Donjons' : t === 'raids' ? '☠️ Raids' : '🏪 Marché'}
                    {t === 'donjons' && (sceaux > 0 || inDungeon) && (
                      <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-950">
                        {inDungeon ? '!' : sceaux}
                      </span>
                    )}
                    {t === 'raids' && (orbes > 0 || inRaid) && (
                      <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] text-slate-950">
                        {inRaid ? '!' : orbes}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                {deskTab === 'perso' ? (
                  <div className="h-full overflow-y-auto pr-1">
                    <CharacterPanel />
                  </div>
                ) : deskTab === 'talents' ? (
                  <TalentTree />
                ) : deskTab === 'donjons' ? (
                  <DungeonPanel />
                ) : deskTab === 'raids' ? (
                  <RaidPanel />
                ) : deskTab === 'marchand' ? (
                  <MerchantPanel />
                ) : (
                  <StuffScreen />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Mobile : un onglet à la fois */
          <div className="h-full">
            {tab === 'combat' && <CombatPanel />}
            {tab === 'perso' && (
              <div className="h-full overflow-y-auto pr-1">
                <CharacterPanel />
              </div>
            )}
            {tab === 'talents' && <TalentTree />}
            {tab === 'stuff' && <StuffScreen />}
            {tab === 'donjons' && <DungeonPanel />}
            {tab === 'raids' && <RaidPanel />}
            {tab === 'marchand' && <MerchantPanel />}
          </div>
        )}
      </main>

      {/* Barre d'onglets (mobile uniquement) */}
      {!isDesktop && (
        <nav className="grid grid-cols-7 border-t border-slate-800">
          {TABS.map((t) => (
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
                <span className="absolute right-3 top-1 rounded-full bg-slate-700 px-1 text-[9px] text-slate-200">
                  {inventory.length}
                </span>
              )}
              {t.id === 'donjons' && (sceaux > 0 || inDungeon) && (
                <span className="absolute right-1.5 top-1 rounded-full bg-amber-500 px-1 text-[9px] text-slate-950">
                  {inDungeon ? '!' : sceaux}
                </span>
              )}
              {t.id === 'raids' && (orbes > 0 || inRaid) && (
                <span className="absolute right-1.5 top-1 rounded-full bg-rose-500 px-1 text-[9px] text-slate-950">
                  {inRaid ? '!' : orbes}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}

      <ChestModal />
      <WelcomeBackModal />
    </div>
  )
}
