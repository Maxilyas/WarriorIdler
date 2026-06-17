import { useState, useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react'
import { useGame } from '../game/store'
import {
  CONSTELLATIONS, CONSTELLATION_LIST, TALENTS, talentsByConstellation, getTalent, canAllocate, isReachable,
  gateInfo, exclusiveBlocker, nodeTree, canAllocatePantheon, eveilBudget, spentInPantheon,
  pantheonClassesUnlocked, PANTHEON_CLASS_ORDER,
  type ConstellationId, type TalentNode, type TalentTreeId,
} from '../game/talents'
import { getPower, powerSummary, powerIcon, powerHasDamageType, powerDamageType } from '../game/powers'
import { Sheet, ConfirmButton } from './ui'
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

const RING = 82 // px par anneau de profondeur (v0.27 : aéré +25% — anti-chevauchement en zone dense)

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

/** Construit la disposition radiale d'UN arbre (v0.33 : 'base' = 6 classes de départ, 'pantheon' =
 *  4 classes de l'Éveil). Mémoïsée par arbre — ne dépend que des données statiques. */
function computeRadialLayout(tree: TalentTreeId): RadialLayout {
  const nodes = TALENTS.filter((t) => nodeTree(t) === tree)
  const byId = new Map(nodes.map((t) => [t.id, t]))
  // 1) Adjacence non-orientée à partir des prérequis (carrefours exclus de l'arbre couvrant).
  const adj = new Map<string, Set<string>>()
  const addEdge = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  for (const t of nodes) {
    if (isCarrefour(t.id)) continue // les carrefours sont posés à part (pont entre voies)
    // v0.29.3 : requires (parent de layout) + requiresAll (convergence) construisent l'arbre couvrant.
    for (const r of [...(t.requires ?? []), ...(t.requiresAll ?? [])]) if (byId.has(r) && !isCarrefour(r)) addEdge(r, t.id)
  }

  // 2) Arbre couvrant par BFS depuis la racine → profondeur + parent/enfants.
  const ROOT = tree === 'pantheon' ? 'pa_start' : 'co_start'
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
  for (const t of nodes) {
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
  for (const t of nodes) {
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
  const parentOf = new Map<string, string>()
  for (const [p, ch] of children) for (const c of ch) { links.push({ from: p, to: c }); parentOf.set(c, p) }
  for (const t of nodes) {
    if (!isCarrefour(t.id)) continue
    for (const r of t.requires ?? []) if (pos.has(r)) links.push({ from: r, to: t.id, bridge: true })
  }
  // v0.35.2 : CONVERGENCE — un nœud `requiresAll` a DEUX parents, mais l'arbre couvrant n'en relie
  //   qu'un seul. On trace le(s) lien(s) manquant(s) en pont, sinon la 2e exigence est invisible.
  for (const t of nodes) {
    if (isCarrefour(t.id)) continue
    for (const r of t.requiresAll ?? []) {
      if (pos.has(r) && pos.has(t.id) && parentOf.get(t.id) !== r) links.push({ from: r, to: t.id, bridge: true })
    }
  }
  // v0.29.3 : les `links` (anneau de navigation, routes croisées) sont tracés comme des ponts.
  for (const t of nodes) {
    for (const l of t.links ?? []) if (pos.has(l) && pos.has(t.id)) links.push({ from: l, to: t.id, bridge: true })
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
/** Diamètre (px) d'un nœud selon son importance (v0.24 : cibles tactiles agrandies). */
const KIND_SIZE: Record<TalentNode['kind'], number> = {
  minor: 22, notable: 32, ability: 36, keystone: 40, gateway: 36,
}

const MIN_SCALE = 0.32
// v0.24 : zoom max relevé (mobile : viser une node précise demandait trop de précision).
const MAX_SCALE = 2.6

export function TalentTree() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const prestigeRank = useGame((s) => s.prestigeRank)
  const char = characters[activeChar] ?? characters[0]
  const weaponType = charDamageProfile(char).mainType
  const [tree, setTree] = useState<TalentTreeId>('base')
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<ConstellationId | null>(null)
  const [voiesOpen, setVoiesOpen] = useState(false)

  // v0.33 : deux arbres mémoïsés. On bascule entre eux ; tout le pan/zoom est réutilisé tel quel.
  const baseLayout = useMemo(() => computeRadialLayout('base'), [])
  const pantheonLayout = useMemo(() => computeRadialLayout('pantheon'), [])
  const layout = tree === 'pantheon' ? pantheonLayout : baseLayout

  // --- Pan / zoom : positions écran calculées en JS (panX/panY = position de `co_start`). ---
  const viewportRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 520 })
  const [view, setView] = useState({ panX: 300, panY: 260, scale: 0.5 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null)
  const userMoved = useRef(false)
  // Pinch tactile : on suit chaque pointeur ; à 2 doigts, zoom incrémental centré sur leur milieu.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; cx: number; cy: number } | null>(null)

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

  // Bascule d'arbre : on recentre (reset userMoved → l'effet de recentrage se redéclenche) et on
  // ferme le détail/la surbrillance pour repartir propre.
  const switchTree = useCallback((t: TalentTreeId) => {
    setTree(t); setSelected(null); setFocus(null); userMoved.current = false
  }, [])

  // Recentre TANT QUE l'utilisateur n'a pas déplacé la vue (re-déclenché quand la taille réelle
  // arrive après le 1er rendu) → `co_start` reste bien au centre du viewport.
  useLayoutEffect(() => {
    if (userMoved.current || size.w <= 1) return
    center()
  }, [size.w, size.h, center])

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId) } catch { /* pointeur synthétique */ }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
      drag.current = null
    } else if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY, moved: false }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
      const rect = viewportRef.current?.getBoundingClientRect()
      const px = cx - (rect?.left ?? 0), py = cy - (rect?.top ?? 0)
      const prev = pinch.current
      userMoved.current = true
      setView((v) => {
        const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * (dist / prev.d)))
        const k = scale / v.scale
        return { scale, panX: px - (px - v.panX) * k + (cx - prev.cx), panY: py - (py - v.panY) * k + (cy - prev.cy) }
      })
      pinch.current = { d: dist, cx, cy }
      return
    }
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { d.moved = true; userMoved.current = true }
    setView((v) => ({ ...v, panX: d.panX + dx, panY: d.panY + dy }))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 1) {
      // Reprend un pan propre avec le doigt restant.
      const [p] = [...pointers.current.values()]
      drag.current = { x: p.x, y: p.y, panX: view.panX, panY: view.panY, moved: true }
    } else if (pointers.current.size === 0) {
      drag.current = null
    }
  }

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
  // v0.33 : arbre actif. Base → points de niveau / `char.talents`. Panthéon → budget de Points
  // d'Éveil (= prestigeRank × K, identique par perso) / `char.pantheon`.
  const isPantheon = tree === 'pantheon'
  const alloc = isPantheon ? (char.pantheon ?? { pa_start: 1 }) : char.talents
  const budget = eveilBudget(prestigeRank)
  const points = isPantheon ? Math.max(0, budget - spentInPantheon(alloc)) : char.talentPoints
  const classesUnlocked = pantheonClassesUnlocked(prestigeRank)
  const pantheonLocked = isPantheon && classesUnlocked === 0
  const selectedNode = selected ? TALENTS.find((n) => n.id === selected) ?? null : null
  // v0.25 : si le nœud sélectionné est verrouillé par un PALIER, surligner sur l'arbre les nœuds
  // où les points comptent (même constellation, tiers ≤ tier-plafond) — fini le « où investir ? ».
  const gateTarget = useMemo(() => {
    if (!selectedNode) return null
    const g = gateInfo(selectedNode, alloc, prestigeRank)
    // Budget non atteint → surligne TOUTE la voie (investir n'importe où compte).
    return g.need > 0 && g.spent < g.need ? { c: selectedNode.constellation } : null
  }, [selectedNode, alloc, prestigeRank])
  const sx = (id: string) => view.panX + (layout.pos.get(id)?.x ?? 0) * view.scale
  const sy = (id: string) => view.panY + (layout.pos.get(id)?.y ?? 0) * view.scale
  const showLabels = view.scale >= 0.55

  return (
    <div className="flex h-full flex-col">
      {/* En-tête : sélecteur d'arbre (Départ / Panthéon) + points de l'arbre actif */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-800/80 p-0.5">
          <button
            onClick={() => switchTree('base')}
            className={'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
              (!isPantheon ? 'bg-orange-500/25 text-orange-200' : 'text-slate-400 hover:text-slate-200')}
          >
            🌳 Départ
          </button>
          <button
            onClick={() => switchTree('pantheon')}
            className={'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
              (isPantheon ? 'bg-fuchsia-500/25 text-fuchsia-200' : 'text-slate-400 hover:text-slate-200')}
          >
            {classesUnlocked === 0 ? '🔒' : '🌌'} Panthéon
            {classesUnlocked > 0 && classesUnlocked < PANTHEON_CLASS_ORDER.length && (
              <span className="rounded-full bg-fuchsia-500/20 px-1 text-[8.5px] text-fuchsia-200">{classesUnlocked}/{PANTHEON_CLASS_ORDER.length}</span>
            )}
          </button>
        </div>
        {isPantheon ? (
          <span
            className={'rounded-full px-2 py-0.5 text-xs font-semibold ' +
              (points > 0 ? 'bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-400/40' : 'bg-slate-800 text-slate-500')}
            title="Points d'Éveil — gagnés à chaque Éveil Primordial, identiques pour chaque perso"
          >
            ✨ {points}/{budget} Éveil
          </span>
        ) : (
          <span
            className={'rounded-full px-2 py-0.5 text-xs font-semibold ' +
              (char.talentPoints > 0 ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40' : 'bg-slate-800 text-slate-500')}
          >
            {char.talentPoints} point{char.talentPoints > 1 ? 's' : ''}
          </span>
        )}
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

      {/* Voies & archétypes : bouton → feuille (remplace la longue rangée scrollable) */}
      <div className="mb-2 flex items-center gap-1.5">
        <button
          onClick={() => setVoiesOpen(true)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:border-slate-500"
        >
          🌌 Voies & archétypes ▾
        </button>
        {focus && (
          <button
            onClick={() => setFocus(null)}
            className="flex min-w-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
            style={{ color: CONSTELLATIONS[focus].color, background: CONSTELLATIONS[focus].color + '1a' }}
          >
            <span className="truncate">{CONSTELLATIONS[focus].icon} {CONSTELLATIONS[focus].name}</span> ✕
          </button>
        )}
      </div>

      {/* Feuille des voies : tap = surbrillance de la constellation dans l'arbre */}
      {voiesOpen && (
        <Sheet title="🌌 Voies & archétypes" onClose={() => setVoiesOpen(false)}>
          <p className="mb-2 text-[11px] leading-snug text-slate-500">
            Tape une voie pour la mettre en surbrillance dans l'arbre. Les points alloués sont indiqués.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {CONSTELLATION_LIST.filter((id) => !CONSTELLATIONS[id].archetype && (CONSTELLATIONS[id].tree ?? 'base') === tree).map((id) => (
              <VoieButton key={id} id={id} focus={focus} talents={alloc} onPick={(v) => { setFocus(v); setVoiesOpen(false) }} />
            ))}
          </div>
          <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-amber-300">⚔ Classes — chacune a ses archétypes</div>
          <div className="grid grid-cols-2 gap-1.5">
            {CONSTELLATION_LIST.filter((id) => CONSTELLATIONS[id].archetype && (CONSTELLATIONS[id].tree ?? 'base') === tree).map((id) => (
              <VoieButton key={id} id={id} focus={focus} talents={alloc} onPick={(v) => { setFocus(v); setVoiesOpen(false) }} />
            ))}
          </div>
        </Sheet>
      )}

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
            const filled = (alloc[l.from] ?? 0) > 0 && (alloc[l.to] ?? 0) > 0
            const reach = filled || isReachable(toNode, alloc)
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

        {/* Nœuds (de l'arbre actif uniquement) */}
        {TALENTS.filter((node) => nodeTree(node) === tree).map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            x={sx(node.id)}
            y={sy(node.id)}
            scale={view.scale}
            talents={alloc}
            selected={selected === node.id}
            dimmed={!!focus && node.constellation !== focus}
            gateHighlight={!!gateTarget && node.constellation === gateTarget.c}
            forceLock={!!node.requiresPrestige && prestigeRank < node.requiresPrestige}
            showLabel={showLabels}
            onSelect={() => { if (!drag.current?.moved) setSelected(node.id) }}
          />
        ))}

        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-slate-400">
          Glisse pour explorer · pince ou molette pour zoomer
        </div>

        {/* Panthéon entièrement verrouillé (aucun Éveil encore fait) : overlay givré + progression. */}
        {pantheonLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 px-6 text-center backdrop-blur-sm">
            <span className="text-4xl">🌌🔒</span>
            <div className="text-sm font-bold text-fuchsia-200">Le Panthéon dort encore</div>
            <p className="max-w-[280px] text-[11px] leading-snug text-slate-300">
              Les classes avancées — Chaman, Paladin, Démoniste, Chevalier de la mort — s'éveillent une par une
              à chaque <span className="font-semibold text-fuchsia-200">Éveil Primordial</span>. Réalise ton 1ᵉʳ Éveil
              pour débloquer le <span className="font-semibold text-cyan-200">Chaman</span> et tes premiers Points d'Éveil ✨.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
              {PANTHEON_CLASS_ORDER.map((c) => (
                <span key={c.node} className="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-slate-400">
                  {CONSTELLATIONS[c.constellation].icon} {CONSTELLATIONS[c.constellation].name}
                  <span className="text-fuchsia-300/70">· Éveil {c.prestige}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Panneau de détail */}
      {selectedNode && (
        <NodeDetail
          node={selectedNode} weaponType={weaponType}
          tree={tree} alloc={alloc} points={points} prestigeRank={prestigeRank}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Barre d'outils SOUS l'arbre (v0.24) : le zoom ne recouvre plus jamais une node. */}
      <div className="mt-2 flex gap-1.5">
        <CtrlBtn onClick={() => zoomBy(1.25)} label="+" title="Zoomer" />
        <CtrlBtn onClick={() => zoomBy(0.8)} label="−" title="Dézoomer" />
        <CtrlBtn onClick={center} label="⌖" title="Recentrer" />
        {isPantheon ? <PantheonRespecBar char={char} /> : (<><PresetsButton /><RespecBar char={char} /></>)}
      </div>
    </div>
  )
}

/** Une voie dans la feuille « Voies & archétypes » : nom coloré + points alloués. */
function VoieButton({ id, focus, talents, onPick }: {
  id: ConstellationId
  focus: ConstellationId | null
  talents: Record<string, number>
  onPick: (id: ConstellationId | null) => void
}) {
  const m = CONSTELLATIONS[id]
  const allocated = talentsByConstellation(id).reduce((a, n) => a + (talents[n.id] ?? 0), 0)
  const active = id === focus
  return (
    <button
      onClick={() => onPick(active ? null : id)}
      className={'flex items-center justify-between gap-1 rounded-lg border px-2.5 py-2 text-[12px] font-medium ' + (active ? 'border-current bg-white/5' : 'border-slate-700 hover:border-slate-500')}
      style={{ color: m.color }}
    >
      <span className="truncate">{m.archetype ? '★ ' : ''}{m.icon} {m.name}</span>
      {allocated > 0 && <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[10px] text-slate-200">{allocated}</span>}
    </button>
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
  node, x, y, scale, talents, selected, dimmed, gateHighlight, forceLock, showLabel, onSelect,
}: {
  node: TalentNode
  x: number
  y: number
  scale: number
  talents: Record<string, number>
  selected: boolean
  dimmed: boolean
  /** v0.25 : nœud où investir pour ouvrir le palier du nœud sélectionné (surligné ambre + tier). */
  gateHighlight: boolean
  /** v0.33 : classe du Panthéon pas encore débloquée par l'Éveil → cadenas franc (gate de prestige). */
  forceLock: boolean
  showLabel: boolean
  onSelect: () => void
}) {
  const rank = talents[node.id] ?? 0
  const allocated = rank > 0
  const reachable = !forceLock && isReachable(node, talents)
  const exclBlocked = !allocated && !forceLock && !!exclusiveBlocker(node, talents)
  const meta = CONSTELLATIONS[node.constellation]
  // La pastille SUIT (en partie) le zoom : dézoomer ne crée plus un mur de pastilles qui se
  // chevauchent, zoomer grossit la cible tactile (v0.24).
  const size = KIND_SIZE[node.kind] * Math.min(1.2, Math.max(0.5, scale * 0.9 + 0.25))
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
        opacity: dimmed ? 0.2 : exclBlocked ? 0.4 : 1,
        zIndex: selected ? 30 : gateHighlight ? 25 : emphatic ? 20 : 10,
      }}
      title={`${node.name} — ${KIND_LABEL[node.kind]} · Tier ${node.tier}`}
    >
      <span
        className="flex items-center justify-center rounded-full border transition-colors"
        style={{
          width: size, height: size,
          fontSize: size * 0.5,
          color: allocated ? '#0b1120' : color,
          background: allocated ? meta.color : reachable ? '#1e293b' : '#0f172a',
          borderColor: selected ? '#fff' : gateHighlight ? '#f59e0b' : color,
          borderWidth: selected || gateHighlight ? 2 : 1,
          boxShadow: selected
            ? `0 0 0 2px ${meta.color}, 0 0 14px ${meta.color}`
            : gateHighlight ? '0 0 0 1px #f59e0b88, 0 0 10px #f59e0b88'
            : allocated && emphatic ? `0 0 10px ${meta.color}aa` : 'none',
        }}
      >
        {exclBlocked ? '⊘' : !reachable && !allocated ? '🔒' : glyph}
      </span>
      {/* Surlignage de palier : tier affiché sous les nœuds éligibles (même sans libellé). */}
      {gateHighlight && !labelShown && (
        <span className="pointer-events-none mt-0.5 rounded bg-amber-500/20 px-1 text-[8px] font-bold leading-tight text-amber-300">
          T{node.tier}{node.maxRank > 1 ? ` · ${rank}/${node.maxRank}` : ''}
        </span>
      )}
      {labelShown && (
        <span
          className="pointer-events-none mt-0.5 max-w-[88px] truncate text-center text-[8.5px] font-semibold leading-tight"
          style={{ color: allocated || reachable ? meta.color : '#64748b' }}
        >
          <span className={gateHighlight ? 'text-amber-300' : 'text-slate-500'}>T{node.tier} · </span>
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
  node, weaponType, tree, alloc, points, prestigeRank, onClose,
}: {
  node: TalentNode
  weaponType: DamageType
  tree: TalentTreeId
  alloc: Record<string, number>
  /** Points restants du pool de l'arbre actif (points de niveau OU Points d'Éveil). */
  points: number
  prestigeRank: number
  onClose: () => void
}) {
  const allocateTalent = useGame((s) => s.allocateTalent)
  const allocatePantheon = useGame((s) => s.allocatePantheon)
  const isPantheon = tree === 'pantheon'
  const rank = alloc[node.id] ?? 0
  const maxed = rank >= node.maxRank
  const meta = CONSTELLATIONS[node.constellation]
  const power = node.unlockPower ? getPower(node.unlockPower) : undefined
  // v0.29.3 : verrou de BUDGET (pts dans la voie) + CHOIX EXCLUSIF + v0.33 : gate de prestige.
  const gate = gateInfo(node, alloc, prestigeRank)
  const prestigeLocked = !!gate.prestigeLocked
  const reachable = !prestigeLocked && isReachable(node, alloc)
  const can = isPantheon
    ? canAllocatePantheon(node, alloc, eveilBudget(prestigeRank), prestigeRank)
    : canAllocate(node, alloc, points)
  const gateLocked = gate.need > 0 && gate.spent < gate.need
  const exclLocked = !!gate.exclusiveBlocked
  const rankLocked = !!gate.rankReq
  // v0.35.2 : CONVERGENCE (requiresAll) — un pivot hybride exige DEUX nœuds précis (souvent dans des
  //   voies opposées). On les NOMME (✓/✗) au lieu du générique « nœud voisin », sinon il paraît injouable.
  const convergence = node.requiresAll && node.requiresAll.length
    ? node.requiresAll.map((r) => ({ name: getTalent(r)?.name ?? r, have: (alloc[r] ?? 0) > 0 }))
    : null

  let btnLabel: string
  if (maxed) btnLabel = `✓ Rang maximum (${rank}/${node.maxRank})`
  else if (prestigeLocked) btnLabel = `🔒 Débloqué au ${gate.prestigeLocked}ᵉ Éveil Primordial`
  else if (exclLocked) btnLabel = `🔒 Choix verrouillé par « ${gate.exclusiveBlocked} »`
  else if (!reachable) btnLabel = convergence
    ? `🔒 Convergence : ${convergence.filter((c) => !c.have).map((c) => c.name).join(' + ')} requis`
    : '🔒 Aucun nœud voisin alloué'
  else if (rankLocked) btnLabel = `🔒 Monte « ${gate.rankReq!.name} » au rang ${gate.rankReq!.need} (${gate.rankReq!.have}/${gate.rankReq!.need})`
  else if (gateLocked) btnLabel = `🔒 Investis ${gate.need} pts dans la voie (${gate.spent}/${gate.need})`
  else if (points <= 0) btnLabel = isPantheon ? 'Aucun Point d\'Éveil disponible' : 'Aucun point disponible'
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
          <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300" title="Tier du nœud dans sa constellation">T{node.tier}</span>
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
      {prestigeLocked && !maxed && (
        <p className="mb-1 text-[10px] text-fuchsia-300">🔒 Classe scellée : réalise {gate.prestigeLocked} Éveil{gate.prestigeLocked! > 1 ? 's' : ''} Primordial{gate.prestigeLocked! > 1 ? 'aux' : ''} pour éveiller cette classe (Éveil actuel : {prestigeRank}).</p>
      )}
      {exclLocked && !maxed && !prestigeLocked && (
        <p className="mb-1 text-[10px] text-rose-300">🔒 Choix exclusif : « {gate.exclusiveBlocked} » est déjà pris — tu ne peux pas avoir les deux.</p>
      )}
      {!reachable && !exclLocked && !prestigeLocked && (
        convergence ? (
          <p className="mb-1 text-[10px] text-rose-300">
            🔀 Convergence — exige les DEUX :{' '}
            {convergence.map((c, i) => (
              <span key={i} className={c.have ? 'text-emerald-300' : 'text-rose-300'}>
                {i > 0 ? ' + ' : ''}{c.have ? '✓' : '✗'} {c.name}
              </span>
            ))}
          </p>
        ) : (
          <p className="mb-1 text-[10px] text-rose-300">🔒 Relie ce nœud : alloue d'abord un nœud voisin.</p>
        )
      )}
      {rankLocked && reachable && !exclLocked && !maxed && (
        <p className="mb-1 text-[10px] text-amber-300">
          ⛓ Puissance gatée : monte d'abord « {gate.rankReq!.name} » au rang {gate.rankReq!.need} ({gate.rankReq!.have}/{gate.rankReq!.need}).
        </p>
      )}
      {gateLocked && reachable && !exclLocked && !rankLocked && !maxed && (
        <p className="mb-1 text-[10px] text-amber-300">
          ⛩ Investis {gate.need} pts dans {meta.icon} {meta.name} ({gate.spent}/{gate.need}) — n'importe où dans la voie.
        </p>
      )}

      <button
        onClick={() => (isPantheon ? allocatePantheon : allocateTalent)(node.id)}
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
  // v0.24 : CONFIRMATION (double-tap) — une erreur de clic ne vide plus l'arbre.
  return (
    <ConfirmButton
      onConfirm={respecTalents}
      disabled={gold < respecCost}
      confirmLabel={`⚠ Tout réinitialiser ? (${refundable} pts)`}
      className="flex-1 rounded-lg bg-slate-800 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
    >
      Réinitialiser · 💰 {respecCost.toLocaleString('fr-FR')}
    </ConfirmButton>
  )
}

/** v0.33 — réinitialisation du Panthéon : GRATUITE (le joueur refait son build d'Éveil librement). */
function PantheonRespecBar({ char }: { char: { pantheon?: Record<string, number> } }) {
  const respecPantheon = useGame((s) => s.respecPantheon)
  const refundable = spentInPantheon(char.pantheon ?? {})
  if (refundable <= 0) return null
  return (
    <ConfirmButton
      onConfirm={respecPantheon}
      confirmLabel={`⚠ Vider le Panthéon ? (${refundable} pts)`}
      className="flex-1 rounded-lg bg-slate-800 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700"
    >
      🌌 Réinitialiser le Panthéon · gratuit
    </ConfirmButton>
  )
}

/**
 * Présets de build : 3 photos « talents + capacités + spé » par perso, pour TESTER des builds
 * sans tout reconstruire à la main. Appliquer = respec payant + réallocation validée.
 */
function PresetsButton() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const gold = useGame((s) => s.gold)
  const saveBuildPreset = useGame((s) => s.saveBuildPreset)
  const applyBuildPreset = useGame((s) => s.applyBuildPreset)
  const deleteBuildPreset = useGame((s) => s.deleteBuildPreset)
  const [open, setOpen] = useState(false)
  const char = characters[activeChar] ?? characters[0]
  if (!char) return null
  const presets = char.buildPresets ?? [null, null, null]
  const refundable = Object.values(char.talents).reduce((a, b) => a + b, 0) - (char.talents.co_start ?? 0)
  const applyCost = refundable > 0 ? 200 * char.level : 0

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex-1 rounded-lg bg-violet-900/40 py-1.5 text-[11px] font-medium text-violet-200 hover:bg-violet-800/50">
        🧩 Présets de build
      </button>
      {open && (
        <Sheet title="🧩 Présets de build" onClose={() => setOpen(false)}>
          <p className="mb-2 text-[11px] leading-snug text-slate-500">
            Photographie ton build (talents + capacités + spécialisation) et bascule de l'un à l'autre.
            Appliquer coûte le prix d'un respec ({applyCost ? `💰 ${applyCost.toLocaleString('fr-FR')}` : 'gratuit, rien d\'alloué'}).
          </p>
          <div className="space-y-1.5">
            {[0, 1, 2].map((slot) => {
              const p = presets[slot]
              if (!p) {
                return (
                  <button
                    key={slot}
                    onClick={() => saveBuildPreset(slot)}
                    className="w-full rounded-lg border border-dashed border-slate-700 py-2.5 text-[11px] text-slate-500 hover:border-violet-500 hover:text-violet-300"
                  >
                    💾 Sauvegarder le build actuel ici (emplacement {slot + 1})
                  </button>
                )
              }
              const pts = Object.values(p.talents).reduce((a, b) => a + b, 0) - (p.talents.co_start ?? 0)
              const nPowers = p.powers.filter(Boolean).length
              return (
                <div key={slot} className="rounded-lg border border-slate-700 bg-black/20 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-violet-200">🧩 {p.name}</span>
                    <span className="text-[9.5px] text-slate-500">{pts} pts · {nPowers} capacité{nPowers > 1 ? 's' : ''} · spé {p.primaryBias}</span>
                  </div>
                  <div className="mt-1.5 flex gap-1.5 text-[10px]">
                    {/* v0.24 : appliquer = respec payant → CONFIRMATION (double-tap). */}
                    <ConfirmButton
                      disabled={gold < applyCost}
                      onConfirm={() => { applyBuildPreset(slot); setOpen(false) }}
                      confirmLabel="⚠ Respec + appliquer ?"
                      className="flex-1 rounded bg-violet-700/70 py-1.5 font-semibold text-violet-50 hover:bg-violet-600/70 disabled:opacity-40"
                    >
                      Appliquer{applyCost ? ` · 💰 ${applyCost.toLocaleString('fr-FR')}` : ''}
                    </ConfirmButton>
                    <button onClick={() => saveBuildPreset(slot, p.name)} className="rounded bg-slate-800 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700" title="Écraser avec le build actuel">
                      💾 Écraser
                    </button>
                    <button onClick={() => deleteBuildPreset(slot)} className="rounded bg-slate-800 px-2.5 py-1.5 text-slate-500 hover:text-red-400" title="Supprimer">
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Sheet>
      )}
    </>
  )
}
