import { useState, Fragment } from 'react'
import { useGame } from '../game/store'
import {
  CONSTELLATIONS, CONSTELLATION_LIST, talentsByConstellation, getTalent, canAllocate, isReachable,
  type ConstellationId, type TalentNode,
} from '../game/talents'
import { getPower } from '../game/powers'
import { DAMAGE_TYPES } from '../game/damage'
import { ALL_STAT_META } from '../game/stats'
import type { DamageType, StatKey } from '../game/types'

interface Branch { head: TalentNode; nodes: TalentNode[] }
interface Layout { roots: TalentNode[]; branches: Branch[]; gateways: TalentNode[] }

/**
 * Dispose une constellation en ÉTOILE : un (ou plusieurs) nœud racine = HUB, des AXES qui rayonnent
 * (colonnes), et les PASSERELLES d'archétype regroupées en bas. Bien plus lisible que des lignes par
 * tier, et met en avant les directions de build. Les axes sont déduits du graphe de prérequis.
 */
function buildLayout(nodes: TalentNode[]): Layout {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const inC = new Set(nodes.map((n) => n.id))
  const roots = nodes.filter((n) => !n.requires || !n.requires.some((r) => inC.has(r)))
  const rootIds = new Set(roots.map((n) => n.id))
  const gateways = nodes.filter((n) => n.kind === 'gateway')
  const gwIds = new Set(gateways.map((n) => n.id))
  // Têtes d'axe = enfants directs d'une racine (hors passerelles).
  const heads = nodes.filter((n) => !rootIds.has(n.id) && !gwIds.has(n.id) && (n.requires ?? []).some((r) => rootIds.has(r)))
  const headIds = new Set(heads.map((n) => n.id))

  // Remonte le graphe jusqu'à une tête d'axe.
  const memo = new Map<string, string | null>()
  const branchOf = (n: TalentNode): string | null => {
    if (headIds.has(n.id)) return n.id
    if (memo.has(n.id)) return memo.get(n.id) ?? null
    memo.set(n.id, null)
    for (const r of n.requires ?? []) {
      const parent = byId.get(r)
      if (parent) { const b = branchOf(parent); if (b) { memo.set(n.id, b); return b } }
    }
    return null
  }

  const branches: Branch[] = heads.map((h) => ({ head: h, nodes: [] }))
  for (const n of nodes) {
    if (rootIds.has(n.id) || gwIds.has(n.id) || headIds.has(n.id)) continue
    const b = branchOf(n)
    const col = b ? branches.find((c) => c.head.id === b) : undefined
    if (col) col.nodes.push(n)
  }
  for (const c of branches) c.nodes.sort((a, b) => a.tier - b.tier)
  return { roots, branches, gateways }
}

/** Types de dégâts mis en avant par un nœud (conversion/éclaboussure de keystone + sort débloqué). */
function nodeDamageTypes(node: TalentNode): DamageType[] {
  const out = new Set<DamageType>()
  const k = node.keystone
  if (k?.convertDamage) out.add(k.convertDamage.to)
  if (k?.splashType) out.add(k.splashType.to)
  if (node.unlockPower) {
    const p = getPower(node.unlockPower)
    if (p?.damageType && p.damageType !== 'physique') out.add(p.damageType)
  }
  return [...out]
}

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
  const layout = buildLayout(nodes)
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

      {/* Constellation en ÉTOILE : hub (racine) → axes (colonnes) → passerelles d'archétype (bas) */}
      <div
        className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 p-2"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.color}14, transparent 60%)` }}
      >
        {/* Hub */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {layout.roots.map((node) => (
            <NodeChip key={node.id} node={node} char={char} selected={selected === node.id} onSelect={() => setSelected(node.id)} />
          ))}
        </div>

        {/* Axes rayonnants */}
        {layout.branches.length > 0 && (
          <>
            <div className="mx-auto my-1 h-3 w-px" style={{ background: `linear-gradient(to bottom, transparent, ${meta.color}66, transparent)` }} />
            <div className="flex justify-center gap-2">
              {layout.branches.map((col) => (
                <div key={col.head.id} className="flex flex-col items-center gap-1">
                  <NodeChip node={col.head} char={char} selected={selected === col.head.id} onSelect={() => setSelected(col.head.id)} />
                  {col.nodes.map((node) => (
                    <Fragment key={node.id}>
                      <div className="h-2 w-px" style={{ background: meta.color + '40' }} />
                      <NodeChip node={node} char={char} selected={selected === node.id} onSelect={() => setSelected(node.id)} />
                    </Fragment>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Passerelles d'archétype (axes vers d'autres voies) */}
        {layout.gateways.length > 0 && (
          <>
            <div className="mt-3 text-center text-[9px] font-semibold uppercase tracking-wide text-amber-300/70">⛩ Passerelles d'archétype</div>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {layout.gateways.map((node) => (
                <NodeChip key={node.id} node={node} char={char} selected={selected === node.id} onSelect={() => setSelected(node.id)} />
              ))}
            </div>
          </>
        )}
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
      {nodeDamageTypes(node).length > 0 && (
        <span className="flex items-center gap-0.5 text-[9px]" title="Type de dégâts mis en avant">
          {nodeDamageTypes(node).map((t) => (
            <span key={t} style={{ color: DAMAGE_TYPES[t].color }}>{DAMAGE_TYPES[t].icon}</span>
          ))}
        </span>
      )}
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

      {/* Détail chiffré : stats (cumulé actuel → suivant) + résistances + keystone */}
      {node.statMods && Object.keys(node.statMods).length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
          {Object.entries(node.statMods).map(([k, v]) => {
            const m = ALL_STAT_META[k as StatKey]
            const val = v as number
            return (
              <span key={k} style={{ color: m?.color ?? '#cbd5e1' }} title={m?.desc}>
                +{val} {m?.short ?? k}
                {node.maxRank > 1 && <span className="text-slate-500"> ({val * rank}→{val * Math.min(node.maxRank, rank + 1)})</span>}
              </span>
            )
          })}
        </div>
      )}
      {node.resistMods && Object.keys(node.resistMods).length > 0 && (
        <div className="mb-1.5 text-[10px] text-emerald-300/90">
          🛡 +{Math.round((Object.values(node.resistMods)[0] ?? 0) * 100)}% résistance
          {Object.keys(node.resistMods).length >= 7 ? ' (tous types)' : ' ' + Object.keys(node.resistMods).map((t) => DAMAGE_TYPES[t as DamageType]?.icon).join('')}
          {node.maxRank > 1 ? ' / rang' : ''}
        </div>
      )}
      {node.keystone && (
        <div className="mb-1.5 rounded bg-fuchsia-500/10 px-1.5 py-1 text-[10px] text-fuchsia-200">✦ Effet de build (keystone)</div>
      )}

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
