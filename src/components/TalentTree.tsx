import { useState, useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react'
import { useGame } from '../game/store'
import {
  CONSTELLATIONS, CONSTELLATION_LIST, TALENTS, talentsByConstellation, getTalent, canAllocate, isReachable,
  type ConstellationId, type TalentNode,
} from '../game/talents'
import { getPower, powerSummary } from '../game/powers'
import { DAMAGE_TYPES } from '../game/damage'
import { ALL_STAT_META } from '../game/stats'
import type { DamageType, StatKey, PowerDef } from '../game/types'

/* ------------------------------------------------------------------ */
/* ARBRE RADIAL UNIQUE (style Path of Exile) — un seul canevas pannable/zoomable.
/* Le Cœur est au centre ; les 6 voies rayonnent ; les archétypes sont en périphérie.
/* Disposition = DENDROGRAMME RADIAL : arbre couvrant (BFS depuis `co_start`),
/*   rayon = profondeur, angle = répartition des feuilles → web sans recouvrement.
/* Tous les prérequis sont tracés comme des LIENS (passerelles incluses).
/* ------------------------------------------------------------------ */

const RING = 58 // px par anneau de profondeur
const PAD = 70 // marge autour du contenu

const CIDX = new Map(CONSTELLATION_LIST.map((c, i) => [c, i]))
function sortKey(n: TalentNode): number {
  return (CIDX.get(n.constellation) ?? 0) * 1000 + n.tier
}

interface RadialLayout {
  pos: Map<string, { x: number; y: number }>
  links: { from: string; to: string }[]
  radius: number
}

/** Construit la disposition radiale globale (mémoïsée : ne dépend que des données statiques). */
function computeRadialLayout(): RadialLayout {
  const byId = new Map(TALENTS.map((t) => [t.id, t]))
  // 1) Adjacence non-orientée à partir des prérequis.
  const adj = new Map<string, Set<string>>()
  const addEdge = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  for (const t of TALENTS) for (const r of t.requires ?? []) if (byId.has(r)) addEdge(r, t.id)

  // 2) Arbre couvrant par BFS depuis le Cœur → profondeur + parent/enfants.
  const ROOT = 'co_start'
  const depth = new Map<string, number>([[ROOT, 0]])
  const children = new Map<string, string[]>()
  const queue = [ROOT]
  while (queue.length) {
    const cur = queue.shift()!
    const neigh = [...(adj.get(cur) ?? [])].sort(
      (a, b) => sortKey(byId.get(a)!) - sortKey(byId.get(b)!) || (a < b ? -1 : 1),
    )
    for (const nx of neigh) {
      if (depth.has(nx)) continue
      depth.set(nx, depth.get(cur)! + 1)
      const arr = children.get(cur) ?? []
      arr.push(nx)
      children.set(cur, arr)
      queue.push(nx)
    }
  }
  // Sécurité : rattache au Cœur tout nœud non atteint.
  for (const t of TALENTS) {
    if (depth.has(t.id)) continue
    depth.set(t.id, 1)
    const arr = children.get(ROOT) ?? []
    arr.push(t.id)
    children.set(ROOT, arr)
  }

  // 3) Angles : répartition des feuilles (post-ordre), nœud interne = moyenne des enfants.
  const totalLeaves = TALENTS.filter((t) => !(children.get(t.id)?.length)).length || 1
  let leaf = 0
  const angle = new Map<string, number>()
  const assign = (id: string): number => {
    const ch = children.get(id) ?? []
    if (ch.length === 0) {
      const a = ((leaf + 0.5) / totalLeaves) * Math.PI * 2
      leaf++
      angle.set(id, a)
      return a
    }
    let sum = 0
    for (const c of ch) sum += assign(c)
    const a = sum / ch.length
    angle.set(id, a)
    return a
  }
  assign(ROOT)

  // 4) Coordonnées polaires.
  const pos = new Map<string, { x: number; y: number }>()
  let radius = RING
  for (const t of TALENTS) {
    const r = (depth.get(t.id) ?? 1) * RING
    const a = angle.get(t.id) ?? 0
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    pos.set(t.id, { x, y })
    radius = Math.max(radius, Math.hypot(x, y))
  }

  // 5) Liens = tous les prérequis (dédupliqués).
  const links: { from: string; to: string }[] = []
  const seen = new Set<string>()
  for (const t of TALENTS) {
    for (const r of t.requires ?? []) {
      if (!pos.has(r) || !pos.has(t.id)) continue
      const key = r < t.id ? `${r}|${t.id}` : `${t.id}|${r}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ from: r, to: t.id })
    }
  }
  return { pos, links, radius }
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
  minor: '•', notable: '◆', keystone: '✦', ability: '✷', gateway: '⛩',
}
const KIND_LABEL: Record<TalentNode['kind'], string> = {
  minor: 'Passif mineur', notable: 'Passif notable', keystone: 'Keystone', ability: 'Capacité', gateway: 'Passerelle',
}

/** Diamètre (px) d'un nœud selon son importance. */
const KIND_SIZE: Record<TalentNode['kind'], number> = {
  minor: 18, notable: 30, ability: 34, keystone: 38, gateway: 34,
}

export function TalentTree() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const char = characters[activeChar] ?? characters[0]
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<ConstellationId | null>(null)

  const layout = useMemo(() => computeRadialLayout(), [])
  const OFFSET = layout.radius + PAD
  const contentSize = OFFSET * 2

  // --- Pan / zoom ---
  const viewportRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1 })
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const center = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const vw = el.clientWidth
    const vh = el.clientHeight
    const scale = Math.max(0.32, Math.min(1, Math.min(vw, vh) / (contentSize * 0.62)))
    // Centre `co_start` (au milieu du contenu) dans le viewport.
    setView({ scale, tx: vw / 2 - OFFSET * scale, ty: vh / 2 - OFFSET * scale })
  }, [contentSize, OFFSET])

  useLayoutEffect(() => { center() }, [center])

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setView((v) => ({ ...v, tx: drag.current!.tx + (e.clientX - drag.current!.x), ty: drag.current!.ty + (e.clientY - drag.current!.y) }))
  }
  const onPointerUp = () => { drag.current = null }
  const zoomBy = useCallback((f: number) => {
    const el = viewportRef.current
    if (!el) return
    const vw = el.clientWidth, vh = el.clientHeight
    setView((v) => {
      const scale = Math.max(0.25, Math.min(2.2, v.scale * f))
      const k = scale / v.scale
      return { scale, tx: vw / 2 - (vw / 2 - v.tx) * k, ty: vh / 2 - (vh / 2 - v.ty) * k }
    })
  }, [])

  // Zoom molette (listener natif non-passif pour pouvoir préventDefault).
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 0.9) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  if (!char) return null
  const selectedNode = selected ? TALENTS.find((n) => n.id === selected) ?? null : null

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

      {/* Légende des voies (surligne une constellation, ne change pas la vue) */}
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {CONSTELLATION_LIST.map((id) => {
          const m = CONSTELLATIONS[id]
          const active = id === focus
          const allocated = talentsByConstellation(id).reduce((a, n) => a + (char.talents[n.id] ?? 0), 0)
          return (
            <button
              key={id}
              onClick={() => setFocus(active ? null : id)}
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

      {/* Canevas radial */}
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-xl border border-slate-800"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, #16213733, #0b1120 75%)', cursor: drag.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: contentSize, height: contentSize, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
        >
          {/* Liens */}
          <svg width={contentSize} height={contentSize} className="absolute left-0 top-0 overflow-visible">
            {layout.links.map((l, i) => {
              const a = layout.pos.get(l.from)!
              const b = layout.pos.get(l.to)!
              const toNode = TALENTS.find((n) => n.id === l.to)!
              const filled = (char.talents[l.from] ?? 0) > 0 && (char.talents[l.to] ?? 0) > 0
              const reach = filled || isReachable(toNode, char.talents)
              const dim = focus && toNode.constellation !== focus && getTalent(l.from)?.constellation !== focus
              const color = filled ? CONSTELLATIONS[toNode.constellation].color : reach ? '#475569' : '#1e293b'
              return (
                <line
                  key={i}
                  x1={OFFSET + a.x} y1={OFFSET + a.y} x2={OFFSET + b.x} y2={OFFSET + b.y}
                  stroke={color} strokeWidth={filled ? 3 : 1.5} strokeLinecap="round"
                  opacity={dim ? 0.12 : filled ? 0.9 : 0.5}
                />
              )
            })}
          </svg>

          {/* Nœuds */}
          {TALENTS.map((node) => {
            const p = layout.pos.get(node.id)!
            return (
              <CanvasNode
                key={node.id}
                node={node}
                x={OFFSET + p.x}
                y={OFFSET + p.y}
                talents={char.talents}
                selected={selected === node.id}
                dimmed={!!focus && node.constellation !== focus}
                onSelect={() => setSelected(node.id)}
              />
            )
          })}
        </div>

        {/* Contrôles zoom */}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <CtrlBtn onClick={() => zoomBy(1.25)} label="+" />
          <CtrlBtn onClick={() => zoomBy(0.8)} label="−" />
          <CtrlBtn onClick={center} label="⌖" title="Recentrer" />
        </div>
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-slate-400">
          Glisse pour explorer · molette/+/− pour zoomer
        </div>
      </div>

      {/* Panneau de détail */}
      {selectedNode && <NodeDetail node={selectedNode} char={char} onClose={() => setSelected(null)} />}

      <RespecBar char={char} />
    </div>
  )
}

function CtrlBtn({ onClick, label, title }: { onClick: () => void; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 w-7 rounded-lg border border-slate-700 bg-slate-900/80 text-sm font-bold text-slate-300 hover:bg-slate-800"
    >
      {label}
    </button>
  )
}

/** Nœud sur le canevas : pastille colorée + libellé (pour les nœuds marquants / sélectionné). */
function CanvasNode({
  node, x, y, talents, selected, dimmed, onSelect,
}: {
  node: TalentNode
  x: number
  y: number
  talents: Record<string, number>
  selected: boolean
  dimmed: boolean
  onSelect: () => void
}) {
  const rank = talents[node.id] ?? 0
  const allocated = rank > 0
  const reachable = isReachable(node, talents)
  const meta = CONSTELLATIONS[node.constellation]
  const size = KIND_SIZE[node.kind]
  const emphatic = node.kind !== 'minor'
  const showLabel = emphatic || selected
  const dmg = nodeDamageTypes(node)
  const power = node.unlockPower ? getPower(node.unlockPower) : undefined
  const sum = power ? powerSummary(power) : null

  const color = allocated || reachable ? meta.color : '#475569'
  const glyph = node.kind === 'ability' && sum ? sum.effectMeta.icon : KIND_ICON[node.kind]

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute flex flex-col items-center"
      style={{
        left: x, top: y, transform: 'translate(-50%, -50%)',
        opacity: dimmed ? 0.22 : 1,
        zIndex: selected ? 30 : emphatic ? 20 : 10,
      }}
      title={`${node.name} — ${KIND_LABEL[node.kind]}`}
    >
      <span
        className="flex items-center justify-center rounded-full border transition-all"
        style={{
          width: size, height: size,
          fontSize: size * 0.5,
          color: allocated ? '#0b1120' : color,
          background: allocated ? meta.color : reachable ? '#1e293b' : '#0f172a',
          borderColor: selected ? '#fff' : color,
          borderWidth: selected ? 2 : 1,
          boxShadow: selected
            ? `0 0 0 2px ${meta.color}, 0 0 14px ${meta.color}`
            : allocated && emphatic ? `0 0 10px ${meta.color}aa` : 'none',
        }}
      >
        {!reachable && !allocated ? '🔒' : glyph}
      </span>
      {showLabel && (
        <span
          className="mt-0.5 max-w-[84px] truncate text-center text-[8.5px] font-semibold leading-tight"
          style={{ color: allocated || reachable ? meta.color : '#64748b' }}
        >
          {node.name}
          {node.maxRank > 1 && <span className="text-slate-400"> {rank}/{node.maxRank}</span>}
        </span>
      )}
      {showLabel && (dmg.length > 0 || sum) && (
        <span className="flex items-center gap-0.5 text-[8px] leading-none">
          {dmg.map((t) => <span key={t} style={{ color: DAMAGE_TYPES[t].color }}>{DAMAGE_TYPES[t].icon}</span>)}
          {sum && <span className="text-cyan-300/90">⏱{sum.cooldown}s</span>}
          {sum?.scaleShort && <span className="text-amber-300/90">{sum.scaleShort}</span>}
        </span>
      )}
    </button>
  )
}

/** Fiche de sort détaillée dans le panneau de nœud : type, recharge, scaling, cibles, valeur ≈. */
function SpellCard({ power }: { power: PowerDef }) {
  const sum = powerSummary(power)
  const dt = power.damageType ? DAMAGE_TYPES[power.damageType] : null
  return (
    <div className="mb-1.5 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-emerald-300">✷ {power.name}</span>
        {sum && (
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-emerald-200">
            {sum.effectMeta.icon} {sum.effectMeta.label}
          </span>
        )}
        {power.kind === 'passive' && (
          <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-sky-200">Passif</span>
        )}
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-emerald-100/70">{power.description}</p>
      {sum && (
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
          <span className="text-cyan-300/90">⏱ Recharge : <span className="font-semibold tabular-nums">{sum.cooldown}s</span></span>
          <span className="text-slate-300">🎯 Cibles : <span className="font-semibold">{sum.effectMeta.targets}</span></span>
          {sum.scaleShort && (
            <span className="text-amber-300/90">📈 Scale : <span className="font-semibold">{sum.scaleShort}</span></span>
          )}
          <span className="text-slate-300">
            Type : {dt ? <span style={{ color: dt.color }}>{dt.icon} {dt.name}</span> : <span style={{ color: DAMAGE_TYPES.physique.color }}>{DAMAGE_TYPES.physique.icon} Physique</span>}
          </span>
          {sum.magnitude > 0 && (
            <span className="col-span-2 text-slate-400">≈ valeur : <span className="font-semibold tabular-nums">×{sum.magnitude.toFixed(1)}</span> de la puissance de scaling</span>
          )}
        </div>
      )}
    </div>
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
  const power = node.unlockPower ? getPower(node.unlockPower) : undefined
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
          <span className="text-[9px] text-slate-500">{meta.icon} {meta.name}</span>
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

      {power && <SpellCard power={power} />}
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
