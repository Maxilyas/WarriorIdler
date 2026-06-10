import { useState, useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react'
import { useGame } from '../game/store'
import {
  CONSTELLATIONS, CONSTELLATION_LIST, TALENTS, talentsByConstellation, getTalent, canAllocate, isReachable,
  type ConstellationId, type TalentNode,
} from '../game/talents'
import { getPower, powerSummary, powerIcon, powerHasDamageType, powerDamageType } from '../game/powers'
import { charDamageProfile } from '../game/character'
import { DAMAGE_TYPES } from '../game/damage'
import { ALL_STAT_META } from '../game/stats'
import type { DamageType, StatKey, PowerDef } from '../game/types'

/* ------------------------------------------------------------------ */
/* ARBRE RADIAL UNIQUE (style Path of Exile) — un seul canevas pannable/zoomable.
/* Le Cœur est au centre ; les 6 voies rayonnent ; les archétypes sont en périphérie.
/* Disposition = DENDROGRAMME RADIAL : arbre couvrant (BFS depuis `co_start`),
/*   rayon = profondeur, angle = répartition des feuilles → web sans recouvrement.
/* Liens tracés = uniquement les arêtes de l'ARBRE (pas de croisements parasites) + les
/*   « carrefours » inter-voies, repositionnés entre les deux voies qu'ils relient.
/* Rendu en coordonnées-écran calculées en JS (pas de gros calque CSS transformé) → pas
/*   d'écran noir au déplacement, quelle que soit la limite de texture du GPU.
/* ------------------------------------------------------------------ */

const RING = 56 // px par anneau de profondeur

const CIDX = new Map(CONSTELLATION_LIST.map((c, i) => [c, i]))
function sortKey(n: TalentNode): number {
  return (CIDX.get(n.constellation) ?? 0) * 1000 + n.tier
}

const isCarrefour = (id: string) => id.startsWith('xr_')

interface Link { from: string; to: string; bridge?: boolean }
interface RadialLayout {
  pos: Map<string, { x: number; y: number }>
  links: Link[]
  radius: number
}

/** Construit la disposition radiale globale (mémoïsée : ne dépend que des données statiques). */
function computeRadialLayout(): RadialLayout {
  const byId = new Map(TALENTS.map((t) => [t.id, t]))
  // 1) Adjacence non-orientée à partir des prérequis (carrefours exclus de l'arbre couvrant).
  const adj = new Map<string, Set<string>>()
  const addEdge = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  for (const t of TALENTS) {
    if (isCarrefour(t.id)) continue // les carrefours sont posés à part (pont entre voies)
    for (const r of t.requires ?? []) if (byId.has(r) && !isCarrefour(r)) addEdge(r, t.id)
  }

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
  // Sécurité : rattache au Cœur tout nœud non atteint (hors carrefours).
  for (const t of TALENTS) {
    if (depth.has(t.id) || isCarrefour(t.id)) continue
    depth.set(t.id, 1)
    const arr = children.get(ROOT) ?? []
    arr.push(t.id)
    children.set(ROOT, arr)
  }

  // 3) Angles : répartition des feuilles (post-ordre), nœud interne = moyenne des enfants.
  const leafIds = [...depth.keys()].filter((id) => !(children.get(id)?.length))
  const totalLeaves = leafIds.length || 1
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

  // 4) Coordonnées polaires (arbre couvrant).
  const pos = new Map<string, { x: number; y: number }>()
  for (const [id, d] of depth) {
    const r = d * RING
    const a = angle.get(id) ?? 0
    pos.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r })
  }

  // 4b) Carrefours : posés au milieu de leurs deux voies (lien court, sans croisement).
  for (const t of TALENTS) {
    if (!isCarrefour(t.id)) continue
    const reqs = (t.requires ?? []).filter((r) => pos.has(r))
    if (reqs.length >= 2) {
      const a = pos.get(reqs[0])!, b = pos.get(reqs[1])!
      pos.set(t.id, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    } else if (reqs.length === 1) {
      const a = pos.get(reqs[0])!
      pos.set(t.id, { x: a.x * 1.15, y: a.y * 1.15 })
    } else {
      pos.set(t.id, { x: 0, y: 0 })
    }
  }

  let radius = RING
  for (const { x, y } of pos.values()) radius = Math.max(radius, Math.hypot(x, y))

  // 5) Liens : arêtes de l'arbre (propres) + ponts de carrefours.
  const links: Link[] = []
  for (const [p, ch] of children) for (const c of ch) links.push({ from: p, to: c })
  for (const t of TALENTS) {
    if (!isCarrefour(t.id)) continue
    for (const r of t.requires ?? []) if (pos.has(r)) links.push({ from: r, to: t.id, bridge: true })
  }
  return { pos, links, radius }
}

/** Types de dégâts mis en avant par un nœud (conversion/éclaboussure de keystone + sort débloqué). */
function nodeDamageTypes(node: TalentNode): DamageType[] {
  const out = new Set<DamageType>()
  const k = node.keystone
  if (k?.convertDamage) out.add(k.convertDamage.to)
  if (k?.splashType) out.add(k.splashType.to)
  if (k?.convertFromMain) out.add(k.convertFromMain.to)
  if (k?.splashFromMain) out.add(k.splashFromMain.to)
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

const MIN_SCALE = 0.32
const MAX_SCALE = 1.8

export function TalentTree() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const char = characters[activeChar] ?? characters[0]
  const weaponType = charDamageProfile(char).mainType
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<ConstellationId | null>(null)

  const layout = useMemo(() => computeRadialLayout(), [])

  // --- Pan / zoom : positions écran calculées en JS (panX/panY = position de `co_start`). ---
  const viewportRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 520 })
  const [view, setView] = useState({ panX: 300, panY: 260, scale: 0.5 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null)
  const userMoved = useRef(false)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const center = useCallback(() => {
    userMoved.current = false
    const scale = Math.max(MIN_SCALE, Math.min(1, Math.min(size.w, size.h) / (layout.radius * 2.1)))
    setView({ scale, panX: size.w / 2, panY: size.h / 2 })
  }, [size.w, size.h, layout.radius])

  // Recentre TANT QUE l'utilisateur n'a pas déplacé la vue (re-déclenché quand la taille réelle
  // arrive après le 1er rendu) → `co_start` reste bien au centre du viewport.
  useLayoutEffect(() => {
    if (userMoved.current || size.w <= 1) return
    center()
  }, [size.w, size.h, center])

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY, moved: false }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { d.moved = true; userMoved.current = true }
    setView((v) => ({ ...v, panX: d.panX + dx, panY: d.panY + dy }))
  }
  const onPointerUp = () => { drag.current = null }

  const zoomBy = useCallback((f: number) => {
    userMoved.current = true
    setView((v) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * f))
      const k = scale / v.scale
      const cx = size.w / 2, cy = size.h / 2
      return { scale, panX: cx - (cx - v.panX) * k, panY: cy - (cy - v.panY) * k }
    })
  }, [size.w, size.h])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 0.9) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  if (!char) return null
  const selectedNode = selected ? TALENTS.find((n) => n.id === selected) ?? null : null
  const sx = (id: string) => view.panX + (layout.pos.get(id)?.x ?? 0) * view.scale
  const sy = (id: string) => view.panY + (layout.pos.get(id)?.y ?? 0) * view.scale
  const showLabels = view.scale >= 0.55

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
                'flex-1 truncate rounded px-2 py-1.5 text-[11px] font-medium ' +
                (i === activeChar ? 'bg-orange-500/20 text-orange-200' : 'bg-slate-800 text-slate-400')
              }
            >
              {c.name} <span className="text-slate-500">N{c.level}</span>
            </button>
          ))}
        </div>
      )}

      {/* Légende des voies (surligne une constellation) */}
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {CONSTELLATION_LIST.map((id) => {
          const m = CONSTELLATIONS[id]
          const active = id === focus
          const allocated = talentsByConstellation(id).reduce((a, n) => a + (char.talents[n.id] ?? 0), 0)
          return (
            <button
              key={id}
              onClick={() => setFocus(active ? null : id)}
              className={'shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ' + (active ? 'border-current' : m.archetype ? 'border-amber-700/50 text-slate-300 hover:border-amber-500' : 'border-slate-700 text-slate-400 hover:border-slate-500')}
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
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden rounded-xl border border-slate-800"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, #16213733, #0b1120 75%)', cursor: drag.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Liens (SVG plein viewport) */}
        <svg width={size.w} height={size.h} className="pointer-events-none absolute left-0 top-0">
          {layout.links.map((l, i) => {
            const toNode = TALENTS.find((n) => n.id === l.to)!
            const fromCid = getTalent(l.from)?.constellation
            const filled = (char.talents[l.from] ?? 0) > 0 && (char.talents[l.to] ?? 0) > 0
            const reach = filled || isReachable(toNode, char.talents)
            const dim = !!focus && toNode.constellation !== focus && fromCid !== focus
            const color = filled ? CONSTELLATIONS[toNode.constellation].color : reach ? '#475569' : '#283449'
            return (
              <line
                key={i}
                x1={sx(l.from)} y1={sy(l.from)} x2={sx(l.to)} y2={sy(l.to)}
                stroke={color}
                strokeWidth={filled ? 3 : 1.5}
                strokeDasharray={l.bridge ? '4 4' : undefined}
                strokeLinecap="round"
                opacity={dim ? 0.1 : filled ? 0.9 : l.bridge ? 0.45 : 0.55}
              />
            )
          })}
        </svg>

        {/* Nœuds */}
        {TALENTS.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            x={sx(node.id)}
            y={sy(node.id)}
            talents={char.talents}
            selected={selected === node.id}
            dimmed={!!focus && node.constellation !== focus}
            showLabel={showLabels}
            onSelect={() => { if (!drag.current?.moved) setSelected(node.id) }}
          />
        ))}

        {/* Contrôles zoom */}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <CtrlBtn onClick={() => zoomBy(1.25)} label="+" />
          <CtrlBtn onClick={() => zoomBy(0.8)} label="−" />
          <CtrlBtn onClick={center} label="⌖" title="Recentrer" />
        </div>
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-slate-400">
          Glisse pour explorer · molette / +/− pour zoomer
        </div>
      </div>

      {/* Panneau de détail */}
      {selectedNode && <NodeDetail node={selectedNode} char={char} weaponType={weaponType} onClose={() => setSelected(null)} />}

      <RespecBar char={char} />
    </div>
  )
}

function CtrlBtn({ onClick, label, title }: { onClick: () => void; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-900/80 text-sm font-bold text-slate-300 hover:bg-slate-800"
    >
      {label}
    </button>
  )
}

/** Nœud sur le canevas : pastille colorée + libellé (pour les nœuds marquants / sélectionné). */
function CanvasNode({
  node, x, y, talents, selected, dimmed, showLabel, onSelect,
}: {
  node: TalentNode
  x: number
  y: number
  talents: Record<string, number>
  selected: boolean
  dimmed: boolean
  showLabel: boolean
  onSelect: () => void
}) {
  const rank = talents[node.id] ?? 0
  const allocated = rank > 0
  const reachable = isReachable(node, talents)
  const meta = CONSTELLATIONS[node.constellation]
  const size = KIND_SIZE[node.kind]
  const emphatic = node.kind !== 'minor'
  const labelShown = (emphatic && showLabel) || selected
  const dmg = nodeDamageTypes(node)
  const power = node.unlockPower ? getPower(node.unlockPower) : undefined
  const sum = power ? powerSummary(power) : null

  const color = allocated || reachable ? meta.color : '#475569'
  const glyph = power ? powerIcon(power) : KIND_ICON[node.kind]

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute flex flex-col items-center"
      style={{
        left: x, top: y, transform: 'translate(-50%, -50%)',
        opacity: dimmed ? 0.2 : 1,
        zIndex: selected ? 30 : emphatic ? 20 : 10,
      }}
      title={`${node.name} — ${KIND_LABEL[node.kind]}`}
    >
      <span
        className="flex items-center justify-center rounded-full border transition-colors"
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
      {labelShown && (
        <span
          className="pointer-events-none mt-0.5 max-w-[88px] truncate text-center text-[8.5px] font-semibold leading-tight"
          style={{ color: allocated || reachable ? meta.color : '#64748b' }}
        >
          {node.name}
          {node.maxRank > 1 && <span className="text-slate-400"> {rank}/{node.maxRank}</span>}
        </span>
      )}
      {labelShown && (dmg.length > 0 || sum) && (
        <span className="pointer-events-none flex items-center gap-0.5 text-[8px] leading-none">
          {dmg.map((t) => <span key={t} style={{ color: DAMAGE_TYPES[t].color }}>{DAMAGE_TYPES[t].icon}</span>)}
          {sum && <span className="text-cyan-300/90">⏱{sum.cooldown}s</span>}
          {sum?.scaleShort && <span className="text-amber-300/90">{sum.scaleShort}</span>}
        </span>
      )}
    </button>
  )
}

/** Fiche de sort détaillée dans le panneau de nœud : type, recharge, scaling, cibles, valeur ≈. */
function SpellCard({ power, weaponType }: { power: PowerDef; weaponType: DamageType }) {
  const sum = powerSummary(power)
  // Type affiché : explicite (élémentaire) sinon celui de l'arme équipée. Masqué pour les sorts non typés.
  const typed = powerHasDamageType(power)
  const resolvedType = typed ? powerDamageType(power, weaponType) : power.damageType
  const dt = resolvedType ? DAMAGE_TYPES[resolvedType] : null
  const fromWeapon = typed && !power.damageType
  return (
    <div className="mb-1.5 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-emerald-300">{powerIcon(power)} {power.name}</span>
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
          {dt && (
            <span className="text-slate-300">
              Type : <span style={{ color: dt.color }}>{dt.icon} {dt.name}</span>
              {fromWeapon && <span className="text-slate-500"> (arme)</span>}
            </span>
          )}
          {sum.magnitude > 0 && !['charge', 'mark', 'frenzy', 'invuln'].includes(power.effect ?? '') && (
            <span className="col-span-2 text-slate-400">≈ valeur : <span className="font-semibold tabular-nums">×{sum.magnitude.toFixed(1)}</span> de la puissance (scale aussi sur ton profil d'arme)</span>
          )}
        </div>
      )}
    </div>
  )
}

function NodeDetail({
  node, char, weaponType, onClose,
}: {
  node: TalentNode
  char: { talents: Record<string, number>; talentPoints: number }
  weaponType: DamageType
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

      {power && <SpellCard power={power} weaponType={weaponType} />}
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
