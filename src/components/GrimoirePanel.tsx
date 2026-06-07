import { useMemo, useState } from 'react'
import { useGame } from '../game/store'
import {
  UNIQUE_EFFECTS, UNIQUE_ROLES, uniqueModsAtRank, uniqueResistAtRank,
  uniqueActiveText, UNIQUE_ACTIVE_RANK,
} from '../game/uniques'
import { ALL_STAT_META } from '../game/stats'
import { DAMAGE_TYPES } from '../game/damage'
import type { StatKey, UniqueRole } from '../game/types'

const ROLE_META: Record<UniqueRole, { label: string; color: string; icon: string }> = {
  dps: { label: 'Dégâts', color: '#ff6b6b', icon: '⚔️' },
  heal: { label: 'Soin', color: '#51cf66', icon: '✚' },
  tank: { label: 'Tank', color: '#74c0fc', icon: '🛡' },
  resist: { label: 'Résistance', color: '#c084fc', icon: '🔯' },
  utility: { label: 'Utilitaire', color: '#ffd43b', icon: '✦' },
}

type RoleFilter = UniqueRole | 'all'

export function GrimoirePanel() {
  const codex = useGame((s) => s.codex)
  const essences = useGame((s) => s.essences)
  const [filter, setFilter] = useState<RoleFilter>('all')

  const discovered = useMemo(() => new Set(codex), [codex])
  const total = UNIQUE_EFFECTS.length
  const found = UNIQUE_EFFECTS.filter((e) => discovered.has(e.id)).length

  const list = useMemo(
    () => UNIQUE_EFFECTS.filter((e) => filter === 'all' || e.role === filter),
    [filter],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">📖 Grimoire des uniques</div>
        <div className="text-xs text-fuchsia-300">{found}/{total} découverts</div>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        Répertoire de tous les effets uniques. Trouve-les sur des objets (Épique+), via les coffres, le craft ou les
        raids. Les valeurs affichées sont les <b className="text-slate-300">bases au rang 1</b> — elles montent avec le
        rang <b className="text-slate-300">et la rareté/iLvl</b> de la pièce qui les porte.
      </p>

      {/* Filtres par rôle */}
      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} label={`Tous (${found}/${total})`} color="#cbd5e1" />
        {UNIQUE_ROLES.map((r) => {
          const m = ROLE_META[r]
          const all = UNIQUE_EFFECTS.filter((e) => e.role === r)
          const f = all.filter((e) => discovered.has(e.id)).length
          return <FilterBtn key={r} active={filter === r} onClick={() => setFilter(r)} label={`${m.icon} ${m.label} (${f}/${all.length})`} color={m.color} />
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {list.map((e) => {
          const known = discovered.has(e.id)
          const role = ROLE_META[e.role]
          const owned = essences[e.id] ?? 0
          if (!known) {
            return (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-[#0c0f17] px-2.5 py-2 opacity-70">
                <span className="text-base grayscale">{role.icon}</span>
                <span className="flex-1 text-[12px] italic text-slate-600">Effet non découvert</span>
                <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: role.color + '22', color: role.color }}>{role.label}</span>
              </div>
            )
          }
          const mods = uniqueModsAtRank(e.id, 1)
          const resist = uniqueResistAtRank(e.id, 1)
          return (
            <div key={e.id} className="rounded-lg border p-2.5" style={{ borderColor: role.color + '33', background: role.color + '0c' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-fuchsia-200">✦ {e.name}</span>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px]" style={{ background: role.color + '22', color: role.color }}>
                  {role.icon} {role.label}
                </span>
              </div>
              <div className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{e.description}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px]">
                {Object.entries(mods).map(([k, v]) => {
                  const sm = ALL_STAT_META[k as StatKey]
                  return <span key={k} style={{ color: sm.color }}>+{v} {sm.name}</span>
                })}
                {Object.entries(resist).map(([k, v]) => {
                  const dm = DAMAGE_TYPES[k as keyof typeof DAMAGE_TYPES]
                  return <span key={k} style={{ color: dm.color }}>+{Math.round((v as number) * 100)}% rés. {dm.name}</span>
                })}
              </div>
              {uniqueActiveText(e.id) && (
                <div className="mt-1 text-[10px] leading-snug text-emerald-300/80">
                  <span className="text-slate-500">Rang {UNIQUE_ACTIVE_RANK} : </span>{uniqueActiveText(e.id)}
                </div>
              )}
              {owned > 0 && (
                <div className="mt-1 text-[9.5px] text-cyan-300/70">🧬 {owned} essence{owned > 1 ? 's' : ''} en réserve</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className={'rounded px-1.5 py-0.5 font-medium ' + (active ? 'text-slate-950' : 'bg-slate-800')}
      style={active ? { background: color } : { color }}
    >
      {label}
    </button>
  )
}
