import { useState } from 'react'
import { useGame, SCEAU_COST } from '../game/store'
import { DUNGEON_LIST, dungeonFights, dungeonIlvl, type DungeonDef, type DungeonReward } from '../game/dungeons'
import { DAMAGE_TYPES } from '../game/damage'

/** Valeur « ∞ » du sélecteur de répétitions (limité en pratique par les Sceaux disponibles). */
const INF = 999
const REPEAT_PRESETS = [1, 5, 10, INF]

const REWARD_LABEL: Record<DungeonReward, string> = {
  gold: '💰 Or',
  xp: '📚 Expérience',
  eclats: '♦ Éclats d\'arcane',
  noyau: '💠 Noyaux primordiaux',
  stuff: '🎒 Stuff (rareté croissante)',
  sceaux: '🔑 Sceaux de faille',
  orbes: '🔮 Orbes de raid',
  poussiere: '🌌 Poussière d\'étoile',
}

export function DungeonPanel() {
  const sceaux = useGame((s) => s.sceaux)
  const progress = useGame((s) => s.dungeonProgress)
  const dungeon = useGame((s) => s.dungeon)
  const bestStage = useGame((s) => s.bestStage)
  const enterDungeon = useGame((s) => s.enterDungeon)
  const craftSceau = useGame((s) => s.craftSceau)
  const noyau = useGame((s) => s.noyau)
  const essence = useGame((s) => s.essence)
  const canCraftSceau = noyau >= SCEAU_COST.noyau && essence >= SCEAU_COST.eclats

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">🏰 Donjons</div>
        <div className="text-xs">
          <span className="text-amber-300">🔑 {sceaux} sceau{sceaux > 1 ? 'x' : ''}</span>
        </div>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        Chaque donjon <b className="text-slate-300">cible une ressource</b> (or, éclats, XP, stuff…) et possède une
        <b className="text-slate-300"> identité de combat</b> qui valorise des builds différents — pas un mur de résistance.
        Réussir le niveau N débloque N+1. Le Sceau de faille est la clé.
      </p>

      <button
        onClick={craftSceau}
        disabled={!canCraftSceau}
        className="mb-2 w-full rounded-lg bg-amber-800/50 py-2 text-[11px] font-medium text-amber-200 hover:bg-amber-700/60 disabled:opacity-40"
      >
        🔨 Forger un Sceau de faille · 💠 {SCEAU_COST.noyau} + ♦ {SCEAU_COST.eclats}
      </button>

      {dungeon && (
        <div className="mb-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-2 text-[11px] text-amber-200">
          Donjon en cours : {dungeon.name} (combat {dungeon.current + 1}/{dungeon.totalFights}). Va dans l'onglet Combat.
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {DUNGEON_LIST.map((def) => (
          <DungeonCard
            key={def.id}
            def={def}
            cleared={progress[def.id] ?? 0}
            sceaux={sceaux}
            bestStage={bestStage}
            busy={!!dungeon}
            onEnter={(lvl, rep) => enterDungeon(def.id, lvl, rep)}
          />
        ))}
      </div>
    </div>
  )
}

function DungeonCard({ def, cleared, sceaux, bestStage, busy, onEnter }: {
  def: DungeonDef
  cleared: number
  sceaux: number
  bestStage: number
  busy: boolean
  onEnter: (level: number, repeat: number) => void
}) {
  const frontier = cleared + 1
  const [level, setLevel] = useState(frontier)
  const [repeat, setRepeat] = useState(1)
  const lvl = Math.max(1, Math.min(frontier, level))
  const locked = bestStage < def.unlockStage
  const el = DAMAGE_TYPES[def.element]
  const cost = def.sceauCost
  const canEnter = !busy && sceaux >= cost && !locked
  // Nombre de runs réellement payables d'affilée (∞ = limité par les Sceaux).
  const affordableRuns = cost === 0 ? (repeat === INF ? 99 : repeat) : Math.min(repeat, Math.floor(sceaux / cost))

  return (
    <div className="rounded-lg border border-slate-800 bg-[#11151f] p-2.5" style={{ borderColor: def.color + '40' }}>
      <div className="flex items-center justify-between">
        <div className="font-medium" style={{ color: def.color }}>
          {def.icon} {def.name}
        </div>
        <div className="text-[10px] text-slate-500">{locked ? `🔒 palier ${def.unlockStage}` : `Record : niv. ${cleared}`}</div>
      </div>
      <div className="mt-0.5 text-[11px]">
        <span className="text-slate-500">Récompense : </span>
        <span style={{ color: def.color }}>{REWARD_LABEL[def.reward]}</span>
      </div>
      <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{def.traitLabel}</div>
      <div className="mt-0.5 text-[10px] text-slate-500">
        Attaques en <span style={{ color: el.color }}>{el.icon} {el.name}</span> · Niv. {lvl} · {dungeonFights(lvl)} combats
        {def.reward === 'stuff' ? ` · coffre iLvl ~${dungeonIlvl(lvl)}` : ''}
        {' · '}{cost === 0 ? <span className="text-emerald-400">gratuit</span> : <span className="text-amber-300">{cost} 🔑</span>}
      </div>
      {locked ? (
        <div className="mt-2 rounded-lg bg-slate-800/60 py-1.5 text-center text-[11px] text-slate-500">
          🔒 Atteins le palier {def.unlockStage} pour débloquer
        </div>
      ) : (
        <>
          {/* Auto-farm : nombre de runs enchaînés (consomme les Sceaux à la volée) */}
          <div className="mt-2 flex items-center gap-1 text-[10px]">
            <span className="text-slate-500" title="Relances automatiques à la fin de chaque run">🔁 Auto</span>
            {REPEAT_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => setRepeat(n)}
                className={'rounded px-2.5 py-1.5 font-semibold ' + (repeat === n ? 'bg-amber-600 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
              >
                {n === INF ? '∞' : '×' + n}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex items-center rounded-lg border border-slate-700">
              <button onClick={() => setLevel((l) => Math.max(1, Math.min(frontier, l) - 1))} className="px-3 py-2.5 text-xs text-slate-300 hover:bg-white/5">−</button>
              <span className="w-7 text-center text-xs tabular-nums text-slate-200">{lvl}</span>
              <button onClick={() => setLevel((l) => Math.min(frontier, Math.max(1, l) + 1))} className="px-3 py-2.5 text-xs text-slate-300 hover:bg-white/5">+</button>
            </div>
            <button
              disabled={!canEnter}
              onClick={() => onEnter(lvl, repeat)}
              className="flex-1 rounded-lg bg-amber-700/80 py-2.5 text-xs font-semibold hover:bg-amber-600 disabled:opacity-40"
            >
              {busy ? 'Donjon en cours…' : sceaux < cost ? `Manque de Sceaux (${cost} 🔑)` : `Entrer niv. ${lvl}${repeat > 1 ? ` ×${affordableRuns}${repeat === INF ? '' : ''}` : ''}${cost === 0 ? '' : ` (${cost} 🔑/run)`}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
