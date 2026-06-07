import { useState } from 'react'
import { useGame } from '../game/store'
import {
  CONSTELLATIONS, CONSTELLATION_LIST, talentsByConstellation, getTalent, canAllocate, isReachable,
  type ConstellationId, type TalentNode,
} from '../game/talents'
import { getPower } from '../game/powers'

const KIND_ICON: Record<TalentNode['kind'], string> = {
  minor: '•', notable: '◆', keystone: '✦', ability: '⚡', gateway: '⛩',
}
const KIND_LABEL: Record<TalentNode['kind'], string> = {
  minor: 'Passif mineur', notable: 'Passif notable', keystone: 'Keystone', ability: 'Capacité', gateway: 'Passerelle',
}

export function TalentTree() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const char = characters[activeChar] ?? characters[0]
  const [cid, setCid] = useState<ConstellationId>('coeur')
  const [selected, setSelected] = useState<string | null>(null)
  if (!char) return null

  const meta = CONSTELLATIONS[cid]
  const nodes = talentsByConstellation(cid)
  const tiers = [...new Set(nodes.map((n) => n.tier))].sort((a, b) => a - b)
  const selectedNode = selected ? nodes.find((n) => n.id === selected) ?? null : null

  const switchCid = (id: ConstellationId) => { setCid(id); setSelected(null) }

  return (
    <div className="flex h-full flex-col">
      {/* En-tête : roster + points */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-200">🌌 Arbre de talents</div>
        <span
          className={
            'rounded-full px-2 py-0.5 text-xs font-semibold ' +
            (char.talentPoints > 0
              ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
              : 'bg-slate-800 text-slate-500')
          }
        >
          {char.talentPoints} point{char.talentPoints > 1 ? 's' : ''}
        </span>
      </div>

      {characters.length > 1 && (
        <div className="mb-2 flex gap-1">
          {characters.map((c, i) => (
            <button
              key={c.id}
              onClick={() => { setActiveChar(i); setSelected(null) }}
              className={
                'flex-1 truncate rounded px-2 py-1 text-[11px] font-medium ' +
                (i === activeChar ? 'bg-orange-500/20 text-orange-200' : 'bg-slate-800 text-slate-400')
              }
            >
              {c.name} <span className="text-slate-500">N{c.level}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sélecteur de constellation */}
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {CONSTELLATION_LIST.map((id) => {
          const m = CONSTELLATIONS[id]
          const active = id === cid
          const allocated = talentsByConstellation(id).reduce((a, n) => a + (char.talents[n.id] ?? 0), 0)
          return (
            <button
              key={id}
              onClick={() => switchCid(id)}
              className={'shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ' + (active ? 'border-current' : m.archetype ? 'border-amber-700/50 text-slate-300 hover:border-amber-500' : 'border-slate-700 text-slate-400 hover:border-slate-500')}
              style={active ? { color: m.color } : undefined}
            >
              {m.archetype && <span className="mr-0.5 text-[8px] text-amber-300" title="Archétype (change le gameplay)">★</span>}
              {m.icon} {m.name}
              {allocated > 0 && <span className="ml-1 rounded-full bg-white/10 px-1 text-[9px] text-slate-200">{allocated}</span>}
            </button>
          )
        })}
      </div>

      <div className="mb-2 text-[11px] text-slate-500" style={{ color: meta.color }}>
        {meta.icon} {meta.name} <span className="text-slate-500">· {meta.role}</span>
      </div>

      {/* Constellation : nœuds par tier (lignes), reliés visuellement */}
      <div
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-800 p-2 pr-1"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.color}14, transparent 60%)` }}
      >
        <div className="space-y-1">
          {tiers.map((tier, ti) => (
            <div key={tier}>
              {ti > 0 && (
                <div
                  className="mx-auto h-3 w-px"
                  style={{ background: `linear-gradient(to bottom, transparent, ${meta.color}55, transparent)` }}
                />
              )}
              <div className="flex flex-wrap justify-center gap-1.5">
                {nodes.filter((n) => n.tier === tier).map((node) => (
                  <NodeChip
                    key={node.id}
                    node={node}
                    char={char}
                    selected={selected === node.id}
                    onSelect={() => setSelected(node.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panneau de détail : prévisualiser AVANT de dépenser (confort mobile) */}
      {selectedNode && (
        <NodeDetail node={selectedNode} char={char} onClose={() => setSelected(null)} />
      )}

      <RespecBar char={char} />
    </div>
  )
}

function NodeChip({
  node, char, selected, onSelect,
}: {
  node: TalentNode
  char: { talents: Record<string, number>; talentPoints: number }
  selected: boolean
  onSelect: () => void
}) {
  const rank = char.talents[node.id] ?? 0
  const reachable = isReachable(node, char.talents)
  const allocated = rank > 0
  const maxed = rank >= node.maxRank
  const meta = CONSTELLATIONS[node.constellation]
  const emphatic = node.kind === 'keystone' || node.kind === 'ability' || node.kind === 'gateway'
  const color = allocated || reachable ? meta.color : '#64748b'

  return (
    <button
      onClick={onSelect}
      className={
        'relative flex min-w-[88px] max-w-[150px] flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-center transition-all ' +
        (allocated
          ? 'border-transparent'
          : reachable
            ? 'border-slate-600 bg-slate-800/50 hover:bg-white/5'
            : 'border-slate-800 bg-slate-900/40 opacity-60') +
        (selected ? ' -translate-y-px scale-[1.03]' : '')
      }
      style={{
        ...(allocated ? { background: meta.color + '1f', borderColor: meta.color } : {}),
        ...(selected ? { boxShadow: `0 0 0 2px ${color}, 0 0 12px ${color}66` } : {}),
        ...(allocated && emphatic && !selected ? { boxShadow: `0 0 10px ${meta.color}55` } : {}),
      }}
    >
      {!reachable && <span className="absolute right-1 top-1 text-[8px] text-slate-600">🔒</span>}
      <span className="text-[11px] font-semibold leading-tight" style={{ color }}>
        {KIND_ICON[node.kind]} {node.name}
      </span>
      {node.maxRank > 1 ? (
        <span className="flex items-center gap-0.5">
          {Array.from({ length: node.maxRank }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: i < rank ? meta.color : '#334155' }}
            />
          ))}
        </span>
      ) : (
        <span className="text-[9px] tabular-nums" style={{ color: allocated ? meta.color : '#64748b' }}>
          {allocated ? '✓ alloué' : maxed ? '—' : KIND_LABEL[node.kind]}
        </span>
      )}
    </button>
  )
}

function NodeDetail({
  node, char, onClose,
}: {
  node: TalentNode
  char: { talents: Record<string, number>; talentPoints: number }
  onClose: () => void
}) {
  const allocateTalent = useGame((s) => s.allocateTalent)
  const rank = char.talents[node.id] ?? 0
  const reachable = isReachable(node, char.talents)
  const maxed = rank >= node.maxRank
  const can = canAllocate(node, char.talents, char.talentPoints)
  const meta = CONSTELLATIONS[node.constellation]
  const powerName = node.unlockPower ? getPower(node.unlockPower)?.name : null
  const reqNames = (node.requires ?? []).map((r) => getTalent(r)?.name).filter(Boolean).join(', ')

  let btnLabel: string
  if (maxed) btnLabel = `✓ Rang maximum (${rank}/${node.maxRank})`
  else if (!reachable) btnLabel = '🔒 Prérequis manquant'
  else if (char.talentPoints <= 0) btnLabel = 'Aucun point disponible'
  else btnLabel = node.maxRank > 1 ? `Allouer 1 point  (${rank} → ${rank + 1}/${node.maxRank})` : 'Allouer 1 point'

  return (
    <div
      className="mt-2 rounded-xl border p-3"
      style={{ borderColor: meta.color + '88', background: `linear-gradient(to bottom, ${meta.color}14, rgba(15,23,42,0.6))` }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold" style={{ color: meta.color }}>
            {KIND_ICON[node.kind]} {node.name}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ background: meta.color + '22', color: meta.color }}
          >
            {KIND_LABEL[node.kind]}
          </span>
        </div>
        <button onClick={onClose} className="shrink-0 text-xs text-slate-500 hover:text-slate-300" aria-label="Fermer">✕</button>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-slate-300">{node.description}</p>

      {powerName && (
        <p className="mb-1 text-[10px] text-emerald-300">⚡ Débloque : {powerName}</p>
      )}
      {reqNames && !reachable && (
        <p className="mb-1 text-[10px] text-rose-300">🔒 Requiert : {reqNames}</p>
      )}

      <button
        onClick={() => allocateTalent(node.id)}
        disabled={!can}
        className="mt-1 w-full rounded-lg py-2 text-xs font-bold transition-colors disabled:bg-slate-800 disabled:text-slate-500"
        style={can ? { background: meta.color, color: '#0b1120' } : undefined}
      >
        {btnLabel}
      </button>
    </div>
  )
}

function RespecBar({ char }: { char: { level: number; talents: Record<string, number> } }) {
  const respecTalents = useGame((s) => s.respecTalents)
  const gold = useGame((s) => s.gold)
  const respecCost = 200 * char.level
  const refundable = Object.values(char.talents).reduce((a, b) => a + b, 0) - (char.talents.co_start ?? 0)
  if (refundable <= 0) return null
  return (
    <button
      onClick={respecTalents}
      disabled={gold < respecCost}
      className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
    >
      Réinitialiser les talents · 💰 {respecCost.toLocaleString('fr-FR')}
    </button>
  )
}
