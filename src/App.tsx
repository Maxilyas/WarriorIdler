import { useEffect, useState } from 'react'
import { useGame } from './game/store'
import { useMediaQuery } from './useMediaQuery'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from './game/damage'
import { TALENT_START_LEVEL } from './game/character'
import { CombatPanel } from './components/CombatPanel'
import { CharacterPanel } from './components/CharacterPanel'
import { TalentTree } from './components/TalentTree'
import { StuffScreen } from './components/StuffScreen'
import { DungeonPanel } from './components/DungeonPanel'
import { RaidPanel } from './components/RaidPanel'
import { MerchantPanel } from './components/MerchantPanel'
import { GrimoirePanel } from './components/GrimoirePanel'
import { ChestModal } from './components/ChestModal'
import { WelcomeBackModal } from './components/WelcomeBackModal'

const TICK_MS = 200

type Tab = 'combat' | 'perso' | 'talents' | 'stuff' | 'donjons' | 'raids' | 'marchand' | 'grimoire'

/** Palier de déblocage de chaque fonctionnalité (révélation progressive de l'UI). */
const DONJON_STAGE = 20
const RAID_STAGE = 50

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'combat', label: 'Combat', icon: '⚔' },
  { id: 'perso', label: 'Perso', icon: '🛡' },
  { id: 'talents', label: 'Talents', icon: '🌌' },
  { id: 'stuff', label: 'Stuff', icon: '🎒' },
  { id: 'donjons', label: 'Donjons', icon: '🏰' },
  { id: 'raids', label: 'Raids', icon: '☠️' },
  { id: 'marchand', label: 'Marché', icon: '🏪' },
  { id: 'grimoire', label: 'Codex', icon: '📖' },
]

const DESK_LABEL: Record<Exclude<Tab, 'combat'>, string> = {
  stuff: '🎒 Équipement', perso: '🛡 Personnage', talents: '🌌 Talents',
  donjons: '🏰 Donjons', raids: '☠️ Raids', marchand: '🏪 Marché', grimoire: '📖 Codex',
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
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const sceaux = useGame((s) => s.sceaux)
  const bestStage = useGame((s) => s.bestStage)
  const characters = useGame((s) => s.characters)
  const dungeonProgress = useGame((s) => s.dungeonProgress)
  const inDungeon = useGame((s) => s.dungeon !== null)
  const inRaid = useGame((s) => s.raid !== null)
  const [tab, setTab] = useState<Tab>('combat')
  const [deskTab, setDeskTab] = useState<'perso' | 'talents' | 'stuff' | 'donjons' | 'raids' | 'marchand' | 'grimoire'>('stuff')

  useEffect(() => {
    const id = setInterval(() => tick(TICK_MS / 1000), TICK_MS)
    return () => clearInterval(id)
  }, [tick])

  // Révélation progressive : on ne montre une fonctionnalité qu'une fois pertinente.
  const maxLevel = characters.reduce((m, c) => Math.max(m, c.level), 1)
  const anyDungeon = Object.values(dungeonProgress).some((v) => v > 0)
  const unlocked: Record<Tab, boolean> = {
    combat: true,
    perso: true,
    stuff: true,
    // Marché & Codex disponibles dès le début (pas de mur d'entrée).
    grimoire: true,
    marchand: true,
    // Talents au niveau 10 ; Donjons au palier 20 ; Raids au palier 50 (révélation progressive).
    talents: maxLevel >= TALENT_START_LEVEL || characters.some((c) => c.talentPoints > 0),
    donjons: sceaux > 0 || anyDungeon || inDungeon || bestStage >= DONJON_STAGE,
    raids: orbes > 0 || inRaid || bestStage >= RAID_STAGE,
  }

  const mobileTabs = TABS.filter((t) => unlocked[t.id])
  const deskTabs = (['stuff', 'perso', 'talents', 'donjons', 'raids', 'marchand', 'grimoire'] as const).filter((t) => unlocked[t])
  const navCols = mobileTabs.length

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
          {(() => {
            const total = DAMAGE_TYPE_LIST.reduce((a, t) => a + (quint[t] ?? 0), 0)
            if (total <= 0) return null
            const breakdown = DAMAGE_TYPE_LIST.filter((t) => (quint[t] ?? 0) > 0).map((t) => `${DAMAGE_TYPES[t].icon} ${DAMAGE_TYPES[t].name} : ${quint[t]}`).join('\n')
            return <span className="text-emerald-300" title={`Quintessences élémentaires (craft typé)\n${breakdown}`}>⚗️ {total.toLocaleString('fr-FR')}</span>
          })()}
          {orbes > 0 && <span className="text-rose-300" title="Orbe de raid">🔮 {orbes.toLocaleString('fr-FR')}</span>}
          {fragments > 0 && <span className="text-sky-300" title="Fragment d'éternité">✨ {fragments.toLocaleString('fr-FR')}</span>}
          {cosmic > 0 && <span className="text-violet-300" title="Éclat cosmique (raids)">💫 {cosmic.toLocaleString('fr-FR')}</span>}
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
                {!unlocked[deskTab] ? (
                  <StuffScreen />
                ) : deskTab === 'perso' ? (
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
                ) : deskTab === 'grimoire' ? (
                  <GrimoirePanel />
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
            {tab === 'grimoire' && <GrimoirePanel />}
          </div>
        )}
      </main>

      {/* Barre d'onglets (mobile uniquement) — n'affiche que les fonctionnalités débloquées */}
      {!isDesktop && (
        <nav className="grid border-t border-slate-800" style={{ gridTemplateColumns: `repeat(${navCols}, minmax(0, 1fr))` }}>
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
