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
  if (!char) return null

  const meta = CONSTELLATIONS[cid]
  const nodes = talentsByConstellation(cid)
  const tiers = [...new Set(nodes.map((n) => n.tier))].sort((a, b) => a - b)

  return (
    <div className="flex h-full flex-col">
      {/* En-tête : roster + points */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-200">🌌 Arbre de talents</div>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
          {char.talentPoints} point{char.talentPoints > 1 ? 's' : ''}
        </span>
      </div>

      {characters.length > 1 && (
        <div className="mb-2 flex gap-1">
          {characters.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActiveChar(i)}
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
              onClick={() => setCid(id)}
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
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-1">
          {tiers.map((tier, ti) => (
            <div key={tier}>
              {ti > 0 && <div className="mx-auto h-2 w-px bg-slate-700" />}
              <div className="flex flex-wrap justify-center gap-1.5">
                {nodes.filter((n) => n.tier === tier).map((node) => (
                  <NodeChip key={node.id} node={node} char={char} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <RespecBar char={char} />
    </div>
  )
}

function NodeChip({ node, char }: { node: TalentNode; char: { talents: Record<string, number>; talentPoints: number } }) {
  const allocateTalent = useGame((s) => s.allocateTalent)
  const rank = char.talents[node.id] ?? 0
  const can = canAllocate(node, char.talents, char.talentPoints)
  const reachable = isReachable(node, char.talents)
  const allocated = rank > 0
  const meta = CONSTELLATIONS[node.constellation]

  const reqNames = (node.requires ?? []).map((r) => getTalent(r)?.name).filter(Boolean).join(', ')
  const powerName = node.unlockPower ? getPower(node.unlockPower)?.name : null
  const title = `${KIND_LABEL[node.kind]} — ${node.description}`
    + (powerName ? `\nDébloque : ${powerName}` : '')
    + (reqNames && !reachable ? `\nRequiert : ${reqNames}` : '')

  return (
    <button
      onClick={() => allocateTalent(node.id)}
      disabled={!can}
      title={title}
      className={
        'flex min-w-[88px] max-w-[150px] flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-center transition-colors ' +
        (allocated
          ? 'border-transparent'
          : reachable
            ? 'border-slate-600 hover:bg-white/5'
            : 'border-slate-800 opacity-50')
      }
      style={allocated ? { background: meta.color + '22', borderColor: meta.color } : undefined}
    >
      <span className="text-[11px] font-semibold leading-tight" style={{ color: allocated || reachable ? meta.color : '#64748b' }}>
        {KIND_ICON[node.kind]} {node.name}
      </span>
      <span className="text-[9px] tabular-nums text-slate-400">
        {node.maxRank > 1 ? `${rank}/${node.maxRank}` : allocated ? 'alloué' : KIND_LABEL[node.kind]}
      </span>
    </button>
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
