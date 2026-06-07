import { useState } from 'react'
import { useGame, SCEAU_COST } from '../game/store'
import { DUNGEON_ELEMENTS, dungeonVuln, dungeonFights, dungeonIlvl } from '../game/dungeons'
import { DAMAGE_TYPES } from '../game/damage'
import type { DamageType } from '../game/types'

export function DungeonPanel() {
  const sceaux = useGame((s) => s.sceaux)
  const progress = useGame((s) => s.dungeonProgress)
  const dungeon = useGame((s) => s.dungeon)
  const enterDungeon = useGame((s) => s.enterDungeon)
  const craftSceau = useGame((s) => s.craftSceau)
  const noyau = useGame((s) => s.noyau)
  const essence = useGame((s) => s.essence)
  const canCraftSceau = noyau >= SCEAU_COST.noyau && essence >= SCEAU_COST.eclats

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">🏰 Donjons élémentaires</div>
        <div className="text-xs">
          <span className="text-amber-300">🔑 {sceaux} sceau{sceaux > 1 ? 'x' : ''}</span>
        </div>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        Un donjon par type de dégâts, monté <b className="text-slate-300">indépendamment</b>. Chaque donjon
        lâche du stuff ciblé (dégâts ET résistance de son élément) — farme celui qu'il te faut. Réussir le
        niveau N débloque N+1. Le Sceau de faille est la clé.
      </p>

      <button
        onClick={craftSceau}
        disabled={!canCraftSceau}
        className="mb-2 w-full rounded-lg bg-amber-800/50 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-700/60 disabled:opacity-40"
      >
        🔨 Forger un Sceau de faille · 💠 {SCEAU_COST.noyau} + ♦ {SCEAU_COST.eclats}
      </button>

      {dungeon && (
        <div className="mb-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-2 text-[11px] text-amber-200">
          Donjon en cours : {dungeon.name} (combat {dungeon.current + 1}/{dungeon.totalFights}). Va dans l'onglet Combat.
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {DUNGEON_ELEMENTS.map((element) => (
          <DungeonCard
            key={element}
            element={element}
            cleared={progress[element] ?? 0}
            sceaux={sceaux}
            busy={!!dungeon}
            onEnter={(lvl) => enterDungeon(element, lvl)}
          />
        ))}
      </div>
    </div>
  )
}

function DungeonCard({ element, cleared, sceaux, busy, onEnter }: {
  element: DamageType
  cleared: number
  sceaux: number
  busy: boolean
  onEnter: (level: number) => void
}) {
  const frontier = cleared + 1
  const [level, setLevel] = useState(frontier)
  const lvl = Math.max(1, Math.min(frontier, level))
  const tm = DAMAGE_TYPES[element]
  const vm = DAMAGE_TYPES[dungeonVuln(element)]
  const canEnter = !busy && sceaux >= 1

  return (
    <div className="rounded-lg border border-slate-800 bg-[#11151f] p-2.5" style={{ borderColor: tm.color + '40' }}>
      <div className="flex items-center justify-between">
        <div className="font-medium" style={{ color: tm.color }}>
          {tm.icon} Donjon {tm.name}
        </div>
        <div className="text-[10px] text-slate-500">Record : niv. {cleared}</div>
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        Ennemis résistants au <span style={{ color: tm.color }}>{tm.name}</span>
        <span className="text-slate-500"> · faibles au </span>
        <span style={{ color: vm.color }}>{vm.icon} {vm.name}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500">
        Niv. {lvl} · {dungeonFights(lvl)} combats · coffre iLvl ~{dungeonIlvl(lvl)}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <div className="flex items-center rounded-lg border border-slate-700">
          <button onClick={() => setLevel((l) => Math.max(1, Math.min(frontier, l) - 1))} className="px-2 py-1 text-xs text-slate-300 hover:bg-white/5">−</button>
          <span className="w-7 text-center text-xs tabular-nums text-slate-200">{lvl}</span>
          <button onClick={() => setLevel((l) => Math.min(frontier, Math.max(1, l) + 1))} className="px-2 py-1 text-xs text-slate-300 hover:bg-white/5">+</button>
        </div>
        <button
          disabled={!canEnter}
          onClick={() => onEnter(lvl)}
          className="flex-1 rounded-lg bg-amber-700/80 py-1.5 text-xs font-semibold hover:bg-amber-600 disabled:opacity-40"
        >
          {busy ? 'Donjon en cours…' : sceaux < 1 ? 'Pas de Sceau' : `Entrer niv. ${lvl} (1 🔑)`}
        </button>
      </div>
    </div>
  )
}
