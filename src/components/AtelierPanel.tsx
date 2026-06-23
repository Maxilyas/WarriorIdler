import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useGame, bestRaidTier, forgeContractsForDay, CONTRACT_LINGOTS } from '../game/store'
import { ITEM_TYPES } from '../game/slots'
import { PRIMARY_META, SECONDARY_META } from '../game/stats'
import { currentWeek } from '../game/maitrise'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RARITIES, RARITY_LIST } from '../game/rarities'
import { maxCraftTier, createCost, contentRarityTier } from '../game/items'
import { chapitreOf } from '../game/progression'
import { stageIlvl } from '../game/enemies'
import type { Item } from '../game/types'
import { ComparePanel } from './ComparePanel'
import { QualityStars } from './ItemRow'
import {
  METIERS, METIER_LIST, METIER_NODES, METIER_BRANCHES, METIER_MAX_LEVEL, AUTOMATE_FORGERON_LEVELS,
  craftMods, levelFromXp, xpTotalForLevel, pointsAvailable, pointsTotal, canLearnNode, nodeRank,
  forgeChainBonus, forgeCreuset, foyerRate,
  frappeActive, judgeFrappe, CHALEUR_MAX, FRAPPE_ZONE, FRAPPE_NEAR, FRAPPE_STREAK_RARITY, SURCHAUFFE_COST,
  respecCost, respecBranchCost, pointsSpentInBranch,
  forgeBonus, signatureLingotCost, smeltLingots, MASTERWORK_LINGOTS,
  type MetierId, type MetierNode,
} from '../game/metiers'
import { ENCHANTS, TIME_RUNES, RULE_RUNES, PACT_RUNES, eraseFragments, runeForgeCost, RUNE_GAMBLE_COST } from '../game/enchants'
import {
  REAGENTS, BREWS, getBrew, parseBrewKey, BREW_QUALITIES, EXPERIMENT_COST,
  DAILY_TRANSMUTE_COST, PHILOSOPHALE_COST,
} from '../game/alchimie'
import {
  COND_GEM_LIST, GEM_FAMILIES, GEM_CUT_COST, GEM_FUSE_COUNT, GEM_FUSE_COST, GEM_CORRUPT_COST, GEM_QUALITIES,
  parseCondKey, gemDesc, gemMaxRank, grindDust, corruptOdds, cutQualityOdds,
  type GemFamily, type CondGemId,
} from '../game/condGems'
import {
  missionLabel, automateRunDuration, automateEfficiency, automateUpgradeCost,
  AUTOMATE_MAX, AUTOMATE_COSTS, AUTOMATE_NAMES, AUTOMATE_UPG_MAX, type AutomateMission,
} from '../game/automates'
import { DUNGEON_LIST } from '../game/dungeons'
import { RAID_LIST } from '../game/raids'
import { Sheet } from './ui'
import type { ItemType, OffensiveStat, ItemOrientation, DamageType, RarityId, SecondaryStat } from '../game/types'

const TYPE_LIST = Object.values(ITEM_TYPES)
const OFFENSIVE: OffensiveStat[] = ['force', 'agilite', 'intelligence']
const ORIENTATIONS: { id: ItemOrientation; label: string }[] = [
  { id: 'offensif', label: 'Offensif' },
  { id: 'equilibre', label: 'Équilibré' },
  { id: 'defensif', label: 'Défensif' },
]

/** E1 — une sous-page d'un métier (segmented control + bandeau de guidage). */
type SubPage = { id: string; label: string; icon: string; hint: string; node: ReactNode }

/**
 * L'Atelier des MÉTIERS — hub des 4 métiers de craft.
 * Chaque métier : un niveau monté par la pratique, un arbre (1 point/niveau), son atelier.
 * Forgeron (création + automates) · Joaillier (gemmes) · Runiste (runes) · Alchimiste (quintessences/uniques).
 */
export function AtelierPanel() {
  const bestStage = useGame((s) => s.bestStage)
  const metiers = useGame((s) => s.metiers)
  const [metier, setMetier] = useState<MetierId>('forgeron')
  // E1 — sous-page active DANS le métier (vide = première page ; le fallback gère le changement de métier).
  const [page, setPage] = useState('')
  const def = METIERS[metier]
  const unlocked = bestStage >= def.unlockStage
  const pts = unlocked ? pointsAvailable(metiers[metier]) : 0

  return (
    <div className="h-full overflow-y-auto pr-1">
      {/* Barre des métiers */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {METIER_LIST.map((m) => {
          const open = bestStage >= m.unlockStage
          const st = metiers[m.id]
          const lvl = levelFromXp(st.xp)
          const pts = open ? pointsAvailable(st) : 0
          const active = metier === m.id
          return (
            <button
              key={m.id}
              onClick={() => setMetier(m.id)}
              className={
                'relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[10px] transition-colors ' +
                (active ? 'border-current bg-white/10' : open ? 'border-slate-700 text-slate-300 hover:border-slate-500' : 'border-slate-800 text-slate-600')
              }
              style={active ? { color: m.color } : undefined}
            >
              {pts > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950">{pts}</span>}
              <span className="text-xl leading-none">{open ? m.icon : '🔒'}</span>
              <span className="font-semibold">{m.name}</span>
              <span className="text-[9px] text-slate-500">{open ? `niv. ${lvl}` : `Chapitre ${chapitreOf(m.unlockStage)}`}</span>
            </button>
          )
        })}
      </div>

      {!unlocked ? (
        <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-4 text-center">
          <div className="text-2xl">🔒</div>
          <div className="mt-1 text-sm font-semibold text-slate-300">{def.icon} {def.name} — « {def.verb} »</div>
          <div className="mt-1 text-[11px] text-slate-500">Atteins le Chapitre {chapitreOf(def.unlockStage)} pour ouvrir ce métier.</div>
        </div>
      ) : (
        (() => {
          // E1 — chaque métier est découpé en SOUS-PAGES (moins dense, mobile-first). L'Arbre
          // a sa propre page ; les pages non pertinentes (ex. Automates < vague 65) sont MASQUÉES.
          const treePage: SubPage = metier === 'forgeron'
            ? { id: 'arbre', label: 'Forge', icon: '⬡', hint: 'Pose tes tuiles : chaque tuile doit toucher une tuile déjà forgée (ou le Creuset central).', node: <ForgeBoard /> }
            : { id: 'arbre', label: 'Arbre', icon: '🌳', hint: 'Dépense tes points de métier dans les compétences.', node: <MetierTree metier={metier} alwaysOpen /> }
          let pages: SubPage[]
          if (metier === 'forgeron') {
            pages = [
              { id: 'creer', label: 'Créer', icon: '🔨', hint: 'Forge une pièce neuve, au niveau de ton meilleur contenu.', node: <ForgeronWorkshop /> },
              { id: 'procedes', label: 'Procédés', icon: '⚙️', hint: 'Contrats de forge · Fonderie (→ Lingots) · Bac de trempe.', node: <ForgeProcedes /> },
              // Automates : page visible dès que le nœud Industrialisation est appris (survit au prestige,
              // contrairement à la vague qui reset) — ou à la vague 65 (avant de l'avoir appris).
              ...(nodeRank(metiers, 'forgeron', 'automates') > 0 || bestStage >= 65 ? [{ id: 'automates', label: 'Automates', icon: '🤖', hint: 'Envoie des automates farmer le contenu déjà vaincu.', node: <AutomateWorkshop /> }] : []),
              treePage,
              { id: 'build', label: 'Build', icon: '📊', hint: 'Synergies hexagonales : engagement par Voie, Chaînes, Creuset et effets cumulés.', node: <ForgeBuildPanel /> },
            ]
          } else if (metier === 'joaillier') {
            pages = [
              { id: 'gemmes', label: 'Mes gemmes', icon: '💎', hint: 'Tes gemmes de condition : fusionner, corrompre, broyer, troquer.', node: <GemStock /> },
              { id: 'creer', label: 'Créer', icon: '✂️', hint: 'Tailler ou acheter une gemme de condition, au choix par famille.', node: <GemCreate /> },
              treePage,
            ]
          } else if (metier === 'runiste') {
            pages = [{ id: 'atelier', label: 'Runes', icon: '🜁', hint: 'Forge et gère tes runes & pactes.', node: <RunisteWorkshop /> }, treePage]
          } else {
            pages = [{ id: 'atelier', label: 'Officine', icon: '⚗️', hint: 'Cuves, recettes et consommables alchimiques.', node: <AlchimisteWorkshop /> }, treePage]
          }
          const active = pages.find((p) => p.id === page) ?? pages[0]
          return (
            <>
              <MetierHeader metier={metier} />
              {/* Sous-pages (pills scrollables sous le pouce sur mobile) */}
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {pages.map((p) => {
                  const on = active.id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPage(p.id)}
                      className={'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ' + (on ? 'border-current bg-white/10' : 'border-slate-700 text-slate-400 hover:border-slate-500')}
                      style={on ? { color: def.color } : undefined}
                    >
                      <span>{p.icon} {p.label}</span>
                      {p.id === 'arbre' && pts > 0 && <span className="rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950">{pts}</span>}
                    </button>
                  )
                })}
              </div>
              {/* Bandeau de guidage : à quoi sert la page + recommandation contextuelle */}
              <div className="mb-2 rounded-lg border border-slate-800 bg-[#0d111a] px-2.5 py-1.5 text-[10.5px] leading-snug text-slate-400">
                <span style={{ color: def.color }}>{active.icon}</span> {active.hint}
                {pts > 0 && active.id !== 'arbre' && (
                  <span className="ml-1 text-amber-300">· ★ {pts} point{pts > 1 ? 's' : ''} d'arbre à dépenser (onglet 🌳 Arbre)</span>
                )}
              </div>
              {active.node}
            </>
          )
        })()
      )}
    </div>
  )
}

/** En-tête de métier : verbe, niveau, barre d'XP, points disponibles, respec. */
function MetierHeader({ metier }: { metier: MetierId }) {
  const st = useGame((s) => s.metiers[metier])
  const gold = useGame((s) => s.gold)
  const respec = useGame((s) => s.respecMetier)
  const def = METIERS[metier]
  const lvl = levelFromXp(st.xp)
  const pts = pointsAvailable(st)
  const maxed = lvl >= METIER_MAX_LEVEL
  const cur = st.xp - xpTotalForLevel(lvl)
  const need = xpTotalForLevel(lvl + 1) - xpTotalForLevel(lvl)
  const cost = respecCost(st)
  const hasNodes = Object.keys(st.nodes).length > 0

  return (
    <div className="mb-3 rounded-xl border p-2.5" style={{ borderColor: def.color + '44', background: def.color + '0d' }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold" style={{ color: def.color }}>{def.icon} {def.name} <span className="font-normal text-slate-500">· « {def.verb} »</span></span>
        <span className="text-[11px] font-semibold text-slate-200">niv. {lvl}<span className="text-slate-500">/{METIER_MAX_LEVEL}</span></span>
      </div>
      {!maxed && (
        <div className="mt-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full transition-all" style={{ width: `${Math.min(100, (cur / need) * 100)}%`, background: def.color }} />
          </div>
          <div className="mt-0.5 text-right text-[9px] text-slate-500">{Math.floor(cur).toLocaleString('fr-FR')} / {need.toLocaleString('fr-FR')} XP — pratique ton métier pour progresser</div>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between text-[10.5px]">
        <span className={pts > 0 ? 'font-semibold text-amber-300' : 'text-slate-500'}>
          {pts > 0 ? `★ ${pts} point${pts > 1 ? 's' : ''} d'arbre à dépenser` : `${pointsTotal(st)} point${pointsTotal(st) > 1 ? 's' : ''} d'arbre gagné${pointsTotal(st) > 1 ? 's' : ''}`}
        </span>
        {hasNodes && (
          <button
            disabled={gold < cost}
            onClick={() => respec(metier)}
            title={`Réinitialise l'arbre (XP conservée) — ${cost.toLocaleString('fr-FR')} or`}
            className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            ↺ Respec · 💰 {cost.toLocaleString('fr-FR')}
          </button>
        )}
      </div>
    </div>
  )
}

/** E2 — ordonne les nœuds d'une branche par dépendance (racines → enfants) avec une profondeur,
 *  pour un rendu en ARBRE (indentation + connecteurs au lieu d'une grille plate). */
function orderBranch(nodes: MetierNode[]): { node: MetierNode; depth: number }[] {
  const inBranch = new Set(nodes.map((n) => n.id))
  const children = new Map<string, MetierNode[]>()
  const roots: MetierNode[] = []
  for (const n of nodes) {
    if (n.requires && inBranch.has(n.requires)) {
      const arr = children.get(n.requires) ?? []
      arr.push(n)
      children.set(n.requires, arr)
    } else roots.push(n)
  }
  const out: { node: MetierNode; depth: number }[] = []
  const visit = (n: MetierNode, d: number) => {
    out.push({ node: n, depth: d })
    for (const c of children.get(n.id) ?? []) visit(c, d + 1)
  }
  for (const r of roots) visit(r, 0)
  return out
}

/** Arbre du métier : nœuds groupés PAR BRANCHE, respec ciblé par branche.
 *  Rendu en ARBRE À NŒUDS (dépendances visibles + keystones). */
function MetierTree({ metier, alwaysOpen }: { metier: MetierId; alwaysOpen?: boolean }) {
  const metiers = useGame((s) => s.metiers)
  const bestStage = useGame((s) => s.bestStage)
  const gold = useGame((s) => s.gold)
  const learn = useGame((s) => s.learnMetierNode)
  const respecBranch = useGame((s) => s.respecMetierBranch)
  const st = metiers[metier]
  const pts = pointsAvailable(st)
  const [openState, setOpen] = useState(pts > 0)
  const open = alwaysOpen ? true : openState
  const def = METIERS[metier]
  // E2 : les 4 métiers sont réduits → tous au rendu ARBRE À NŒUDS (dépendances + keystones).
  const graph = true

  // Branches affichées : tronc commun d'abord, puis les branches déclarées qui ont des nœuds.
  const branches: { id: string; name: string; icon: string }[] = [
    { id: 'tronc', name: 'Tronc commun', icon: '🌳' },
    ...METIER_BRANCHES[metier],
  ].filter((b) => METIER_NODES[metier].some((n) => (n.branch ?? 'tronc') === b.id))
  const branchCost = respecBranchCost(st)

  return (
    <div className="mb-3 rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
      <button onClick={() => !alwaysOpen && setOpen((o) => !o)} className="flex w-full items-center justify-between py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span>🌳 Arbre de compétences {pts > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[9px] text-slate-950">{pts}</span>}</span>
        {!alwaysOpen && <span>{open ? '▾' : '▸'}</span>}
      </button>
      {open && branches.map((b) => {
        const nodes = METIER_NODES[metier].filter((n) => (n.branch ?? 'tronc') === b.id)
        const spent = pointsSpentInBranch(st, metier, b.id)
        const max = nodes.reduce((a, n) => a + n.maxRank, 0)
        return (
          <div key={b.id} className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: def.color }}>
                {b.icon} {b.name} <span className="font-normal text-slate-500">· {spent}/{max} pt{max > 1 ? 's' : ''}</span>
              </span>
              {spent > 0 && branches.length > 1 && (
                <button
                  disabled={gold < branchCost}
                  onClick={() => respecBranch(metier, b.id)}
                  title={`Réinitialise UNIQUEMENT cette branche — ${branchCost.toLocaleString('fr-FR')} or (40% du respec complet)`}
                  className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                >
                  ↺ {(branchCost / 1000).toLocaleString('fr-FR')}k
                </button>
              )}
            </div>
            {(() => {
              const tile = (n: MetierNode) => {
                const rank = nodeRank(metiers, metier, n.id)
                const owned = rank >= n.maxRank
                const check = canLearnNode(metiers, metier, n.id, bestStage)
                const isSpec = !!n.exclusive
                const isKey = !!n.keystone
                return (
                  <button
                    key={n.id}
                    disabled={!check.ok}
                    onClick={() => learn(metier, n.id)}
                    title={check.ok ? n.desc : `${n.desc}\n— ${check.reason}`}
                    className={
                      'flex flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-left disabled:opacity-60 ' +
                      (owned ? 'border-emerald-700/50 bg-emerald-950/20' : rank > 0 ? 'border-amber-700/50 bg-amber-950/10' : 'border-slate-700 bg-black/20 enabled:hover:border-amber-600/60') +
                      (isKey ? ' ring-1 ring-amber-400/50 shadow-[0_0_8px_-2px] shadow-amber-500/40' : '')
                    }
                    style={isSpec && rank > 0 ? { borderColor: def.color } : undefined}
                  >
                    <span className="text-base">{isKey ? '◆' : n.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-slate-200">
                        {isSpec && <span style={{ color: def.color }}>◈ </span>}{isKey ? `${n.icon} ` : ''}{n.name}{n.maxRank > 1 ? <span className="text-slate-500"> {rank}/{n.maxRank}</span> : null}
                      </span>
                      <span className="block text-[8.5px] leading-snug text-slate-500">{n.desc}</span>
                      {!owned && !check.ok && check.reason !== 'Aucun point disponible — pratique ton métier.' && (
                        <span className="block text-[8.5px] font-medium text-rose-400/80">🔒 {check.reason}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold">
                      {owned ? <span className="text-emerald-400">✓</span> : <span className={check.ok ? 'text-amber-300' : 'text-slate-600'}>1 pt</span>}
                    </span>
                  </button>
                )
              }
              return graph ? (
                // ARBRE À NŒUDS : ordonné par dépendance, indentation + connecteur ↳ vers le parent.
                <div className="space-y-1">
                  {orderBranch(nodes).map(({ node: n, depth }) => (
                    <div key={n.id} className="flex items-center" style={{ paddingLeft: depth * 16 }}>
                      {depth > 0 && <span className="mr-1 shrink-0 select-none text-sm leading-none" style={{ color: def.color + 'aa' }}>↳</span>}
                      {tile(n)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{nodes.map((n) => tile(n))}</div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ⬡ La Forge hexagonale — planche à tuiles du Forgeron */
/* ------------------------------------------------------------------ */

const FAMILY_LABEL: Record<string, string> = { qualite: 'Qualité', ressource: 'Ressource', idle: 'Idle', chance: 'Chance' }
/** Tuiles dont l'EFFET n'est pas encore branché (lots ultérieurs) : visibles mais non forgeables.
 *  (Le Foyer en est exclu : c'est la porte d'entrée de la Voie Industriel — sa prod arrive au Lot 2.) */
const FORGE_PENDING = new Set<string>()

/** Couleur de Voie d'une tuile (dérivée de sa famille / nature). */
function tileColor(n: MetierNode): string {
  if (n.kind === 'junction') return '#94a3b8'
  if (n.family === 'qualite') return '#60a5fa'
  if (n.family === 'ressource' || n.family === 'chance') return '#fb923c'
  if (n.family === 'idle') return '#a78bfa'
  return '#94a3b8'
}

/**
 * La Forge hexagonale : allocation par ADJACENCE (le build = le placement).
 * Le Creuset (cœur) est acquis d'office ; une tuile se forge si elle touche une tuile possédée.
 * Remplace MetierTree pour le seul Forgeron ; les 3 autres métiers gardent la liste.
 */
function ForgeBoard() {
  const metiers = useGame((s) => s.metiers)
  const bestStage = useGame((s) => s.bestStage)
  const learn = useGame((s) => s.learnMetierNode)
  const [selected, setSelected] = useState<string | null>(null)

  const tiles = METIER_NODES.forgeron.filter((n) => n.hex)
  const S = 26, OX = 190, OY = 205, HH = (Math.sqrt(3) / 2) * S
  const px = (q: number, r: number) => ({ x: OX + S * 1.5 * q, y: OY + HH * 2 * (r + q / 2) })
  const poly = (cx: number, cy: number) =>
    `${cx + S},${cy} ${cx + S / 2},${cy + HH} ${cx - S / 2},${cy + HH} ${cx - S},${cy} ${cx - S / 2},${cy - HH} ${cx + S / 2},${cy - HH}`

  // Tuiles possédées indexées par coordonnée (pour tracer les liens de Chaîne).
  const ownedByKey = new Map<string, MetierNode>()
  for (const n of tiles) if ((metiers.forgeron.nodes[n.id] ?? 0) > 0) ownedByKey.set(`${n.hex!.q},${n.hex!.r}`, n)

  const links: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
  const seenLink = new Set<string>()
  const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  for (const n of ownedByKey.values()) {
    if (!n.family) continue
    const a = px(n.hex!.q, n.hex!.r)
    for (const [dq, dr] of DIRS) {
      const m = ownedByKey.get(`${n.hex!.q + dq},${n.hex!.r + dr}`)
      if (!m || m.family !== n.family) continue
      const key = [n.id, m.id].sort().join('|')
      if (seenLink.has(key)) continue
      seenLink.add(key)
      const b = px(m.hex!.q, m.hex!.r)
      links.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: tileColor(n) })
    }
  }

  const core = px(0, 0)
  const creuset = forgeCreuset(metiers)
  const chains = forgeChainBonus(metiers)
  const sel = selected ? tiles.find((t) => t.id === selected) : undefined
  const selRank = sel ? (metiers.forgeron.nodes[sel.id] ?? 0) : 0
  const selPending = !!sel && FORGE_PENDING.has(sel.id)
  const selCheck = sel && !selPending ? canLearnNode(metiers, 'forgeron', sel.id, bestStage) : null
  const selMaxed = !!sel && selRank >= (sel?.maxRank ?? 1)

  return (
    <div className="mb-3">
      <svg viewBox="0 0 380 356" className="w-full select-none" style={{ touchAction: 'manipulation' }}>
        {links.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={3} strokeOpacity={0.5} strokeLinecap="round" />
        ))}
        {/* Creuset (cœur, acquis d'office) */}
        <polygon points={poly(core.x, core.y)} fill={creuset > 0 ? '#fbbf2433' : '#1c1206'} stroke="#fbbf24" strokeWidth={2} />
        <text x={core.x} y={core.y - 3} textAnchor="middle" dominantBaseline="central" fontSize={15}>🔥</text>
        <text x={core.x} y={core.y + 13} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="#fcd34d">Creuset</text>
        {tiles.map((n) => {
          const { x, y } = px(n.hex!.q, n.hex!.r)
          const rank = metiers.forgeron.nodes[n.id] ?? 0
          const owned = rank > 0
          const maxed = rank >= n.maxRank
          const pending = FORGE_PENDING.has(n.id)
          const ok = !pending && canLearnNode(metiers, 'forgeron', n.id, bestStage).ok
          const color = tileColor(n)
          const isKey = n.kind === 'keystone'
          const fill = owned ? color + '44' : ok ? color + '1f' : '#0b0e14'
          const stroke = owned ? color : ok ? color : '#283042'
          return (
            <g key={n.id} onClick={() => setSelected(n.id)} style={{ cursor: 'pointer' }}>
              <polygon points={poly(x, y)} fill={fill} stroke={stroke} strokeWidth={isKey ? 2.6 : 1.4} strokeOpacity={owned || ok ? 1 : 0.7} />
              {selected === n.id && <polygon points={poly(x, y)} fill="none" stroke="#e2e8f0" strokeWidth={1.4} />}
              <text x={x} y={n.maxRank > 1 ? y - 4 : y} textAnchor="middle" dominantBaseline="central" fontSize={15} opacity={owned || ok ? 1 : 0.4}>{n.icon}</text>
              {n.maxRank > 1 && (
                <text x={x} y={y + 12} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={owned ? color : '#64748b'}>{rank}/{n.maxRank}</text>
              )}
              {maxed && <text x={x + 14} y={y - 13} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#34d399">✓</text>}
              {isKey && !maxed && <text x={x} y={y - 17} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={owned ? color : '#64748b'}>◆</text>}
              {pending && <text x={x} y={y + 12} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="#64748b">⏳</text>}
            </g>
          )
        })}
      </svg>

      {/* Synergies actives (mini-récap ; le tableau complet vient au Lot 4) */}
      {(creuset > 0 || chains.qualite > 0 || chains.ressource > 0 || chains.idle > 0 || chains.chance > 0) && (
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
          {creuset > 0 && <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-amber-200">🔥 Creuset +{Math.round(creuset * 100)}%</span>}
          {(['qualite', 'ressource', 'idle', 'chance'] as const).map((f) =>
            chains[f] > 0 ? (
              <span key={f} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">⛓ {FAMILY_LABEL[f]} +{Math.round(chains[f] * 100)}%</span>
            ) : null,
          )}
        </div>
      )}

      {/* Détail de la tuile sélectionnée */}
      {sel ? (
        <div className="mt-2 rounded-xl border border-slate-700 bg-[#0d111a] p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">{sel.icon}</span>
            <span className="flex-1 text-[12px] font-semibold text-slate-200">
              {sel.kind === 'keystone' && <span className="text-amber-300">◆ </span>}{sel.name}
              {sel.maxRank > 1 && <span className="text-slate-500"> {selRank}/{sel.maxRank}</span>}
            </span>
          </div>
          <p className="mt-1 text-[10.5px] leading-snug text-slate-400">{sel.desc}</p>
          {sel.kind === 'keystone' && <p className="mt-1 text-[9.5px] text-amber-300/70">Keystone exclusif : un seul des trois actif (en choisir un autre rembourse celui-ci).</p>}
          {sel.id === 'foyer' && <p className="mt-1 text-[9.5px] text-violet-300/70">Cœur de la Voie Industriel : produit XP + Lingots en continu (page Créer), indexé sur tes Chefs-d'œuvre.</p>}
          <div className="mt-2">
            {selPending ? (
              <span className="text-[10.5px] font-medium text-slate-500">⏳ Bientôt — cette tuile s'active dans un prochain lot.</span>
            ) : selMaxed ? (
              <span className="text-[11px] font-semibold text-emerald-400">✓ Acquis</span>
            ) : selCheck?.ok ? (
              <button onClick={() => learn('forgeron', sel.id)} className="w-full rounded-lg bg-amber-600 py-2 text-[12px] font-semibold text-slate-950 hover:bg-amber-500">
                🔨 Forger {selRank > 0 ? `rang ${selRank + 1}` : 'cette tuile'} · 1 pt
              </button>
            ) : (
              <span className="text-[10.5px] font-medium text-rose-400/80">🔒 {selCheck?.reason}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded-xl border border-dashed border-slate-800 bg-black/20 p-3 text-center text-[10.5px] text-slate-500">
          Touche une tuile pour la voir. Une tuile se forge si elle touche une tuile déjà acquise (ou le Creuset central 🔥).
        </div>
      )}
    </div>
  )
}

/** Le tableau de Build : engagement par Voie + synergies hexagonales + effets cumulés. */
function ForgeBuildPanel() {
  const metiers = useGame((s) => s.metiers)
  const automates = useGame((s) => s.automates)
  const bestStage = useGame((s) => s.bestStage)
  const foyer = useGame((s) => s.foyer)
  const chains = forgeChainBonus(metiers)
  const creuset = forgeCreuset(metiers)
  const tiles = METIER_NODES.forgeron.filter((n) => n.hex && n.family)
  const voies = [
    { name: 'Armurier', icon: '🛡️', color: '#60a5fa', fams: ['qualite'] },
    { name: 'Fondeur', icon: '🔥', color: '#fb923c', fams: ['ressource', 'chance'] },
    { name: 'Industriel', icon: '🤖', color: '#a78bfa', fams: ['idle'] },
  ]
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const rate = foyerRate(metiers, automates.length, bestStage, foyer.masterworkKeys.length)
  const effects = [
    { label: '🎲 Rareté (chance)', v: chains.chance + creuset },
    { label: '⭐ Qualité', v: chains.qualite + creuset },
    { label: '🔥 Foyer — XP', v: chains.idle + creuset },
    { label: '🧱 Foyer — Lingots', v: chains.ressource + creuset },
  ]
  return (
    <div className="mb-3 space-y-3">
      <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Engagement par Voie</div>
        <div className="space-y-1.5">
          {voies.map((v) => {
            const list = tiles.filter((n) => (v.fams as readonly string[]).includes(n.family ?? ''))
            const owned = list.filter((n) => (metiers.forgeron.nodes[n.id] ?? 0) > 0).length
            const total = list.length
            return (
              <div key={v.name}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium" style={{ color: v.color }}>{v.icon} {v.name}</span>
                  <span className="text-slate-500">{owned}/{total} tuiles</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full" style={{ width: `${total ? (owned / total) * 100 : 0}%`, background: v.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Synergies actives</div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-amber-200">🔥 Creuset +{pct(creuset)}</span>
          {(['qualite', 'ressource', 'idle', 'chance'] as const).map((f) => (
            <span key={f} className={'rounded px-1.5 py-0.5 ' + (chains[f] > 0 ? 'bg-slate-800 text-slate-200' : 'bg-slate-900 text-slate-600')}>
              ⛓ {FAMILY_LABEL[f]} +{pct(chains[f])}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] leading-snug text-slate-500">Une Chaîne = des tuiles de MÊME famille reliées (×3 = +12% · ×4 = +20% · ×5 = +30%). Le Creuset monte avec tes 3 entrées de Voie (Affûtage · Forge économe · Foyer).</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Effets cumulés</div>
        <div className="grid grid-cols-2 gap-1.5">
          {effects.map((e) => (
            <div key={e.label} className="rounded-lg bg-black/30 px-2 py-1.5">
              <div className="text-[10px] text-slate-400">{e.label}</div>
              <div className={'text-[14px] font-semibold ' + (e.v > 0 ? 'text-emerald-300' : 'text-slate-500')}>+{pct(e.v)}</div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[10px] text-slate-500">Foyer actuel : <span className="text-violet-300">+{(rate.xp * 60).toFixed(1)} XP/min · +{(rate.lingots * 3600).toFixed(1)} 🧱/h</span></div>
      </div>
    </div>
  )
}

/** Le Foyer : carte de production idle d'XP + Lingots, indexée sur les Chefs-d'œuvre. */
function FoyerPanel() {
  const metiers = useGame((s) => s.metiers)
  const foyer = useGame((s) => s.foyer)
  const automates = useGame((s) => s.automates)
  const bestStage = useGame((s) => s.bestStage)
  const mw = foyer.masterworkKeys.length
  const rate = foyerRate(metiers, automates.length, bestStage, mw)
  if (rate.xp <= 0) return null // Foyer non débloqué (tuile Industriel de la planche ⬡ Forge)
  return (
    <div className="mb-3 rounded-xl border border-violet-800/40 bg-violet-950/10 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-300">🔥 Foyer — production passive</span>
        <span className="text-[10px] font-semibold text-violet-200">+{(rate.xp * 60).toFixed(1)} XP/min · +{(rate.lingots * 3600).toFixed(1)} 🧱/h</span>
      </div>
      <p className="mt-1 text-[9.5px] leading-snug text-slate-500">
        Tourne en continu, même hors-ligne (plafond 12 h). Forge des Chefs-d'œuvre VARIÉS (🏆 Maître forgeron R3) pour l'accélérer.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded bg-violet-900/40 px-1.5 py-0.5 text-violet-200">🏆 Chefs-d'œuvre ×{mw} <span className="text-violet-300/70">+{mw * 10}%</span></span>
        <span className="rounded bg-violet-900/40 px-1.5 py-0.5 text-violet-200">🤖 Automates ×{automates.length} <span className="text-violet-300/70">+{automates.length * 15}%</span></span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">⛰ Palier {bestStage}</span>
      </div>
    </div>
  )
}

/** Le mini-jeu de Frappe : génère la Chaleur (ressource) + une série de PARFAITS. */
function FrappePanel() {
  const metiers = useGame((s) => s.metiers)
  const chaleur = useGame((s) => s.chaleur)
  const streak = useGame((s) => s.chaleurStreak)
  const strike = useGame((s) => s.strikeForge)
  const active = frappeActive(metiers)
  const posRef = useRef(0)
  const dirRef = useRef(1)
  const markerRef = useRef<HTMLDivElement | null>(null)
  const [flash, setFlash] = useState<'perfect' | 'good' | 'miss' | null>(null)
  useEffect(() => {
    if (!active) return
    let raf = 0
    const loop = () => {
      posRef.current += dirRef.current * 0.018
      if (posRef.current >= 1) { posRef.current = 1; dirRef.current = -1 }
      else if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1 }
      if (markerRef.current) markerRef.current.style.left = `calc(${(posRef.current * 100).toFixed(2)}% - 2px)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
  if (!active) return null
  const onStrike = () => { const r = judgeFrappe(posRef.current); strike(r); setFlash(r) }
  const flashTxt = flash === 'perfect' ? { t: 'PARFAIT !', c: 'text-emerald-300' }
    : flash === 'good' ? { t: 'Bien', c: 'text-amber-300' }
    : flash === 'miss' ? { t: 'Raté — série perdue', c: 'text-rose-400' } : null
  const dots = '●'.repeat(Math.min(streak, FRAPPE_STREAK_RARITY)) + '○'.repeat(Math.max(0, FRAPPE_STREAK_RARITY - streak))
  return (
    <div className="mb-3 rounded-xl border border-amber-800/40 bg-amber-950/10 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">🔨 Frappe — Chaleur</span>
        <span className="text-[10px] font-semibold text-amber-200">🔥 {chaleur}/{CHALEUR_MAX}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${(chaleur / CHALEUR_MAX) * 100}%` }} />
      </div>
      <div className="relative mt-2 h-5 overflow-hidden rounded bg-slate-800">
        <div className="absolute inset-y-0 bg-amber-900/50" style={{ left: `${(0.5 - FRAPPE_NEAR / 2) * 100}%`, width: `${FRAPPE_NEAR * 100}%` }} />
        <div className="absolute inset-y-0 bg-emerald-600/60" style={{ left: `${(0.5 - FRAPPE_ZONE / 2) * 100}%`, width: `${FRAPPE_ZONE * 100}%` }} />
        <div ref={markerRef} className="absolute inset-y-0 w-1 bg-amber-100" style={{ left: 0 }} />
      </div>
      <div className="mt-1 min-h-[14px] text-center text-[10px] font-semibold">
        {flashTxt && <span className={flashTxt.c}>{flashTxt.t}</span>}
      </div>
      <button onClick={onStrike} className="w-full rounded-lg bg-amber-600 py-2 text-[12px] font-semibold text-slate-950 hover:bg-amber-500">🔨 Frapper</button>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
        <span>Série {Math.min(streak, FRAPPE_STREAK_RARITY)}/{FRAPPE_STREAK_RARITY}</span>
        <span className="tracking-widest text-amber-300">{dots}</span>
        {streak >= FRAPPE_STREAK_RARITY && <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 font-semibold text-emerald-300">⚡ +1 cran prêt</span>}
      </div>
      <p className="mt-1 text-[9px] leading-snug text-slate-500">Frappe dans le vert : +Chaleur & série. 5 parfaites → +1 cran garanti à la forge ; la Chaleur achète des ⭐ (Surchauffe, plus bas).</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 🔨 Forgeron : création d'objets + automates                         */
/* ------------------------------------------------------------------ */

function ForgeronWorkshop() {
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const fragments = useGame((s) => s.fragments)
  const poussiere = useGame((s) => s.poussiere)
  const cosmic = useGame((s) => s.cosmic)
  const lingots = useGame((s) => s.lingots)
  const lastMasterwork = useGame((s) => s.lastMasterwork)
  const createItem = useGame((s) => s.createItem)
  const metiers = useGame((s) => s.metiers)
  const chaleur = useGame((s) => s.chaleur)
  const chaleurStreak = useGame((s) => s.chaleurStreak)
  const mods = craftMods(metiers)

  // double horloge — la vague de farm ET le meilleur tier de raid bornent la rareté.
  const raidTier = bestRaidTier(raidProgress)
  const maxTier = maxCraftTier(bestStage, raidTier)
  const raidCapped = maxTier < maxCraftTier(bestStage) // le raid est la borne ACTIVE
  const rarities = RARITY_LIST.filter((r) => r.tier <= maxTier)

  const [type, setType] = useState<ItemType>('armePrincipale')
  const [primary, setPrimary] = useState<OffensiveStat>('force')
  const [orientation, setOrientation] = useState<ItemOrientation>('equilibre')
  const [element, setElement] = useState<DamageType>('feu')
  const [rarity, setRarity] = useState<RarityId>(rarities[Math.min(3, rarities.length - 1)].id)
  const [signature, setSignature] = useState<SecondaryStat | null>(null)
  const [masterwork, setMasterwork] = useState(false)
  const [surchauffe, setSurchauffe] = useState(false)

  const isWeapon = type === 'armePrincipale'
  const tier = RARITY_LIST.find((r) => r.id === rarity)!.tier
  // bonus de création UNIVERSELS (Maître forgeron + Signature) ; plus de corps de métier.
  const forge = forgeBonus(mods)
  // la forge crée au niveau de ton FARM (vague) + bonus de métier (pas les donjons/raids).
  const ilvl = stageIlvl(Math.max(1, bestStage)) + forge.ilvlBonus
  const activeSignature = signature && forge.signatures?.includes(signature) ? signature : null
  const signCost = activeSignature ? Math.max(1, Math.round(signatureLingotCost(tier) * mods.signatureCostMult)) : 0
  const mwReady = forge.masterwork && lastMasterwork < currentWeek()
  const mwOn = masterwork && mwReady
  const raw = createCost(tier, ilvl, contentRarityTier(bestStage, raidTier))
  const cm = mods.costMult * (mwOn ? 1.5 : 1)
  const cost = { eclats: Math.round(raw.eclats * cm), noyau: Math.round(raw.noyau * cm), fragments: Math.round((raw.fragments ?? 0) * cm), poussiere: Math.round((raw.poussiere ?? 0) * cm), cosmic: Math.round((raw.cosmic ?? 0) * cm) }
  const lingotNeed = signCost + (mwOn ? MASTERWORK_LINGOTS : 0)
  const canForge = essence >= cost.eclats && noyau >= cost.noyau && fragments >= cost.fragments && poussiere >= cost.poussiere && cosmic >= cost.cosmic && lingots >= lingotNeed

  return (
    <>
      <FoyerPanel />
      <FrappePanel />
      {/* Type d'objet */}
      <Section title="Type d'objet">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {TYPE_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              title={t.name}
              className={
                'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[9px] ' +
                (type === t.id ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-400 hover:border-slate-500')
              }
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Affinité */}
      <Section title="Affinité (stat offensive)">
        <div className="grid grid-cols-3 gap-1.5">
          {OFFENSIVE.map((p) => (
            <button
              key={p}
              onClick={() => setPrimary(p)}
              className={
                'rounded-lg border py-1.5 text-xs font-medium ' +
                (primary === p ? 'border-transparent text-slate-950' : 'border-slate-700 text-slate-300 hover:border-slate-500')
              }
              style={primary === p ? { background: PRIMARY_META[p].color } : undefined}
            >
              {PRIMARY_META[p].name}
            </button>
          ))}
        </div>
      </Section>

      {/* Orientation offensive/défensive */}
      <Section title="Orientation (dégâts ↔ survie)">
        <div className="grid grid-cols-3 gap-1.5">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrientation(o.id)}
              className={
                'rounded-lg border py-1.5 text-xs font-medium ' +
                (orientation === o.id ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-300 hover:border-slate-500')
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Élément (armes uniquement) */}
      {isWeapon && (
        <Section title="Élément de l'arme">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {DAMAGE_TYPE_LIST.map((d) => {
              const m = DAMAGE_TYPES[d]
              return (
                <button
                  key={d}
                  onClick={() => setElement(d)}
                  title={m.name}
                  className={
                    'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[9px] ' +
                    (element === d ? 'border-current bg-white/5' : 'border-slate-700 text-slate-400 hover:border-slate-500')
                  }
                  style={element === d ? { color: m.color } : undefined}
                >
                  <span className="text-sm leading-none">{m.icon}</span>
                  <span className="truncate">{m.name}</span>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* Rareté cible */}
      <Section title={`Rareté cible (max : ${rarities[rarities.length - 1].name})`}>
        <div className="flex flex-wrap gap-1.5">
          {rarities.map((r) => (
            <button
              key={r.id}
              onClick={() => setRarity(r.id)}
              className={'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ' + (rarity === r.id ? 'border-current' : 'border-slate-700/60')}
              style={{ color: r.color }}
            >
              {r.name}
            </button>
          ))}
        </div>
        {raidCapped && (
          <p className="mt-1 text-[9.5px] leading-snug text-rose-300/80">
            ☠️ Le cran suivant exige un <b>tier de raid ≥ {raidTier + 1}</b> (record : {raidTier}) — la haute rareté se forge au rythme de tes raids.
          </p>
        )}
      </Section>

      {/* ✒️ Signature : affixe garanti AU CHOIX (universel, débloqué par le nœud Signature) */}
      {forge.signatures && (
        <Section title={`✒️ Signature (${signCost > 0 ? `${signCost} 🧱` : 'choisis une ligne garantie'})`}>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSignature(null)}
              className={'rounded-lg border px-2.5 py-1.5 text-[11px] ' + (!activeSignature ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-400')}
            >
              Sans
            </button>
            {forge.signatures.map((st) => (
              <button
                key={st}
                onClick={() => setSignature(st)}
                className={'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ' + (activeSignature === st ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-300 hover:border-slate-500')}
              >
                {SECONDARY_META[st].name} <span className="text-slate-500">· {signatureLingotCost(tier)} 🧱</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* 🏆 Chef-d'œuvre hebdomadaire (Maître forgeron R3) */}
      {forge.masterwork && (
        <button
          onClick={() => setMasterwork((m2) => !m2)}
          disabled={!mwReady}
          className={
            'mb-3 w-full rounded-lg border py-2 text-[11px] font-semibold ' +
            (mwOn ? 'border-amber-400 bg-amber-500/20 text-amber-200' : mwReady ? 'border-amber-700/50 text-amber-300/80 hover:bg-amber-900/20' : 'border-slate-800 text-slate-600')
          }
        >
          🏆 Chef-d'œuvre {mwReady ? (mwOn ? 'ACTIVÉ — +1 cran garanti + châsse garantie (×1,5 coûts + 10 🧱)' : '— 1/semaine : +1 cran garanti + châsse garantie') : '— déjà forgé cette semaine'}
        </button>
      )}

      {/* Récapitulatif + coût */}
      <div className="mt-3 rounded-lg bg-black/30 p-3 text-xs text-slate-400">
        <div>iLvl de l'objet : <span className="text-slate-200">{ilvl}</span> (au niveau de ton farm — palier {bestStage}{forge.ilvlBonus > 0 ? ` · 🛠️ +${forge.ilvlBonus}` : ''})</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span>Coût :</span>
          <span className={essence >= cost.eclats ? 'text-cyan-300' : 'text-red-400'}>♦ {cost.eclats}</span>
          {cost.noyau > 0 && (
            <span className={noyau >= cost.noyau ? 'text-fuchsia-300' : 'text-red-400'}>💠 {cost.noyau}</span>
          )}
          {(cost.poussiere ?? 0) > 0 && (
            <span className={poussiere >= (cost.poussiere ?? 0) ? 'text-indigo-300' : 'text-red-400'}>🌌 {cost.poussiere}</span>
          )}
          {(cost.fragments ?? 0) > 0 && (
            <span className={fragments >= (cost.fragments ?? 0) ? 'text-sky-300' : 'text-red-400'}>✨ {cost.fragments}</span>
          )}
          {(cost.cosmic ?? 0) > 0 && (
            <span className={cosmic >= (cost.cosmic ?? 0) ? 'text-violet-300' : 'text-red-400'}>💫 {cost.cosmic}</span>
          )}
          {lingotNeed > 0 && (
            <span className={lingots >= lingotNeed ? 'text-amber-300' : 'text-red-400'}>🧱 {lingotNeed}</span>
          )}
        </div>
        {(mods.costMult < 1 || mods.luckChance > 0) && (
          <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-amber-300/80">
            {mods.costMult < 1 && <span>💰 −{Math.round((1 - mods.costMult) * 100)}% coûts (arbre)</span>}
            {mods.luckChance > 0 && <span>🎲 +{Math.round(mods.luckChance * 100)}% chance de rareté supérieure</span>}
          </div>
        )}
        {tier >= 7 && <div className="mt-1 text-[10.5px] text-fuchsia-300/80">Rareté Artefact+ : chance d'obtenir un effet unique.</div>}
      </div>

      {/* 🔥 Frappe : Surchauffe (Chaleur → +1 ⭐) + série maîtrisée (+1 cran garanti) */}
      {frappeActive(metiers) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSurchauffe((v) => !v)}
            disabled={chaleur < SURCHAUFFE_COST && !surchauffe}
            className={
              'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ' +
              (surchauffe ? 'border-amber-400 bg-amber-500/20 text-amber-200' : chaleur >= SURCHAUFFE_COST ? 'border-amber-700/50 text-amber-300/80 hover:bg-amber-900/20' : 'border-slate-800 text-slate-600')
            }
          >
            🔥 Surchauffe +1 ⭐ <span className="text-amber-300/70">−{SURCHAUFFE_COST} Chaleur</span>
          </button>
          {chaleurStreak >= FRAPPE_STREAK_RARITY && (
            <span className="rounded-lg bg-emerald-900/30 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300">⚡ Frappe maîtrisée : +1 cran sur cette forge</span>
          )}
        </div>
      )}

      <button
        disabled={!canForge}
        onClick={() => createItem({
          type, primary, rarity, orientation,
          ...(isWeapon ? { element } : {}),
          ...(activeSignature ? { signature: activeSignature } : {}),
          ...(mwOn ? { masterwork: true } : {}),
          ...(surchauffe ? { surchauffe: true } : {}),
        })}
        className="mt-3 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-40"
      >
        {mwOn ? '🏆 Forger le CHEF-D\'ŒUVRE — ' : 'Forger '}{isWeapon ? `${DAMAGE_TYPES[element].icon} ` : ''}{ITEM_TYPES[type].name}
      </button>
      <p className="mt-1.5 pb-2 text-center text-[10px] text-slate-500">L'objet apparaît dans ton Sac. Forger donne de l'XP de Forgeron.</p>
    </>
  )
}

/**
 * Atelier des automates : construction (3 max, gated par l'arbre + niveau de Forgeron),
 * assignation de mission (donjon/raid DÉJÀ battu), améliorations vitesse/rendement (or).
 */
function AutomateWorkshop() {
  const automates = useGame((s) => s.automates)
  const gold = useGame((s) => s.gold)
  const poussiere = useGame((s) => s.poussiere)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const metiers = useGame((s) => s.metiers)
  const dungeonProgress = useGame((s) => s.dungeonProgress)
  const raidProgress = useGame((s) => s.raidProgress)
  const buildAutomate = useGame((s) => s.buildAutomate)
  const assignAutomate = useGame((s) => s.assignAutomate)
  const toggleAutomatePause = useGame((s) => s.toggleAutomatePause)
  const upgradeAutomate = useGame((s) => s.upgradeAutomate)
  const [assigning, setAssigning] = useState<number | null>(null)

  const mods = craftMods(metiers)
  const forgeronLvl = levelFromXp(metiers.forgeron.xp)
  // L'atelier n'apparaît qu'une fois la branche Industrialisation apprise (ou un automate possédé).
  if (!mods.automates && automates.length === 0) return null

  const nextCost = AUTOMATE_COSTS[automates.length]
  const lvlReq = AUTOMATE_FORGERON_LEVELS[automates.length] ?? Infinity
  const beatenDungeons = DUNGEON_LIST.filter((d) => (dungeonProgress[d.id] ?? 0) > 0)
  const beatenRaids = RAID_LIST.filter((r) => (raidProgress[r.id] ?? 0) > 0)

  return (
    <div className="mb-3 rounded-xl border border-violet-800/40 bg-violet-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-300">🤖 Industrialisation — automates</span>
        <span className="text-[10px] text-slate-500">{automates.length}/{AUTOMATE_MAX}</span>
      </div>
      <p className="mb-2 text-[9.5px] leading-snug text-slate-500">
        Une machine refait EN BOUCLE un donjon/raid déjà battu (au niveau record), même hors-ligne.
        Elle consomme les clés (🔑/🔮) et rapporte les ressources à 60–85% — jamais le stuff ni les 💫.
        Astuce : un automate sur l'Antre des Failles produit les Sceaux des autres.
      </p>

      <div className="space-y-2">
        {automates.map((a) => {
          const duration = automateRunDuration(a, mods.automateDurMult)
          const pct = a.mission ? Math.min(100, (a.progress / duration) * 100) : 0
          return (
            <div key={a.id} className="rounded-lg border border-slate-700 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-violet-200">🤖 {a.name}</span>
                <span className="text-[9px] text-slate-500">rendement {Math.round(automateEfficiency(a) * 100)}% · run {a.mission ? Math.round(duration) + ' s' : '—'}</span>
              </div>
              <div className="mt-1 text-[10.5px]">
                {a.mission ? (
                  <span className="text-slate-300">{missionLabel(a.mission)}{a.paused ? ' · ⏸ en pause' : a.waiting ? ' · ⏳ en attente de clés' : ''}</span>
                ) : (
                  <span className="italic text-slate-500">Sans mission — assigne-lui un donjon ou un raid battu.</span>
                )}
              </div>
              {a.mission && !a.paused && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                <button onClick={() => setAssigning(a.id)} className="rounded bg-violet-900/40 px-2 py-1 font-medium text-violet-200 hover:bg-violet-800/50">
                  🎯 Mission
                </button>
                {a.mission && (
                  <button onClick={() => toggleAutomatePause(a.id)} className="rounded bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700">
                    {a.paused ? '▶ Reprendre' : '⏸ Pause'}
                  </button>
                )}
                {(['speed', 'yield'] as const).map((kind) => {
                  const lvl = kind === 'speed' ? a.speedLvl : a.yieldLvl
                  const maxed = lvl >= AUTOMATE_UPG_MAX
                  const cost = automateUpgradeCost(kind, lvl)
                  return (
                    <button
                      key={kind}
                      disabled={maxed || gold < cost}
                      onClick={() => upgradeAutomate(a.id, kind)}
                      className="rounded bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    >
                      {kind === 'speed' ? '⚡ Vitesse' : '📈 Rendement'} {lvl}/{AUTOMATE_UPG_MAX}{maxed ? '' : ` · 💰${(cost / 1000).toLocaleString('fr-FR')}k`}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {nextCost && mods.automates && (automates.length < 3 || mods.automate4) && (
          forgeronLvl < lvlReq ? (
            <div className="rounded-lg border border-slate-800 bg-black/20 py-2 text-center text-[10px] text-slate-500">
              🔒 Prochain automate « {AUTOMATE_NAMES[automates.length]} » : Forgeron niveau {lvlReq} requis (actuel : {forgeronLvl}).
            </div>
          ) : (
            <button
              onClick={buildAutomate}
              disabled={gold < nextCost.gold || poussiere < nextCost.poussiere || fragments < nextCost.fragments || cosmic < nextCost.cosmic}
              className="w-full rounded-lg border border-violet-700/50 bg-violet-900/20 py-2 text-[11px] font-medium text-violet-200 hover:bg-violet-800/30 disabled:opacity-40"
            >
              🛠 Construire « {AUTOMATE_NAMES[automates.length]} » · 💰 {nextCost.gold.toLocaleString('fr-FR')} + 🌌 {nextCost.poussiere}
              {' '}+ ✨ {nextCost.fragments}{nextCost.cosmic ? ` + 💫 ${nextCost.cosmic}` : ''}
            </button>
          )
        )}
        {nextCost && mods.automates && automates.length >= 3 && !mods.automate4 && (
          <div className="rounded-lg border border-slate-800 bg-black/20 py-2 text-center text-[10px] text-slate-500">
            🔒 La 4e machine « Manufacture » exige le nœud 🏭 de l'arbre (niv 40 · P80).
          </div>
        )}
      </div>

      {/* Feuille d'assignation : contenu déjà battu uniquement (farmé au niveau record) */}
      {assigning !== null && (
        <Sheet title="🎯 Mission de l'automate" onClose={() => setAssigning(null)}>
          <p className="mb-2 text-[11px] leading-snug text-slate-500">
            Uniquement du contenu DÉJÀ battu — l'automate farme au niveau record (les gains suivent si tu bats mieux : réassigne).
          </p>
          <div className="space-y-1">
            {beatenDungeons.map((d) => {
              const rec = dungeonProgress[d.id] ?? 0
              const m: AutomateMission = { kind: 'dungeon', id: d.id, level: rec }
              return (
                <button
                  key={d.id}
                  onClick={() => { assignAutomate(assigning, m); setAssigning(null) }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-2.5 py-2 text-left text-[12px] hover:border-violet-500"
                >
                  <span style={{ color: d.color }}>{d.icon} {d.name}</span>
                  <span className="text-[10px] text-slate-500">niv. {rec}{d.sceauCost ? ` · ${d.sceauCost} 🔑/run` : ' · gratuit'}</span>
                </button>
              )
            })}
            {beatenRaids.map((r) => {
              const rec = raidProgress[r.id] ?? 0
              const m: AutomateMission = { kind: 'raid', id: r.id, level: rec }
              return (
                <button
                  key={r.id}
                  onClick={() => { assignAutomate(assigning, m); setAssigning(null) }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-2.5 py-2 text-left text-[12px] hover:border-violet-500"
                >
                  <span style={{ color: r.color }}>{r.icon} {r.name}</span>
                  <span className="text-[10px] text-slate-500">T{rec} · {r.orbeCost} 🔮/run</span>
                </button>
              )
            })}
            {beatenDungeons.length === 0 && beatenRaids.length === 0 && (
              <div className="text-center text-[11px] italic text-slate-500">Bats d'abord un donjon ou un raid.</div>
            )}
            <button
              onClick={() => { assignAutomate(assigning, null); setAssigning(null) }}
              className="w-full rounded-lg bg-slate-800 py-2 text-[11px] text-slate-400 hover:bg-slate-700"
            >
              ✕ Retirer la mission
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/** la fonderie/trempe ouvre la CARTE COMPLÈTE de l'objet au clic (cohérent avec le Stuff). */
function ItemCardSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const equip = useGame((s) => s.equip)
  const sell = useGame((s) => s.sell)
  const recycle = useGame((s) => s.recycle)
  const char = characters[activeChar] ?? characters[0]
  if (!char) return null
  return (
    <Sheet title={`${ITEM_TYPES[item.type].icon} ${item.name}`} onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto">
        <ComparePanel
          item={item}
          char={char}
          occupied={char.equipment}
          onEquip={(slot) => { equip(item.id, slot); onClose() }}
          onSell={() => { sell(item.id); onClose() }}
          onRecycle={() => { recycle(item.id); onClose() }}
          onClose={onClose}
        />
      </div>
    </Sheet>
  )
}

/**
 * Procédés du Forgeron : 📋 Contrats quotidiens (forge la pièce demandée → Lingots 🧱),
 * 🫕 Fonderie (objet Rare+ du sac → Lingots) et 🔥 Bac de trempe (+1 iLvl par 24 h réelles).
 */
function ForgeProcedes() {
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const lingots = useGame((s) => s.lingots)
  const inventory = useGame((s) => s.inventory)
  const forgeContracts = useGame((s) => s.forgeContracts)
  const trempe = useGame((s) => s.trempe)
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const smeltItem = useGame((s) => s.smeltItem)
  const startTempering = useGame((s) => s.startTempering)
  const collectTempering = useGame((s) => s.collectTempering)
  const [fonderieOpen, setFonderieOpen] = useState(false)
  const [trempeOpen, setTrempeOpen] = useState(false)
  // objet dont la CARTE COMPLÈTE est ouverte (clic sur une ligne fonderie/trempe).
  const [viewItem, setViewItem] = useState<Item | null>(null)

  if (!mods.contrats && !mods.fonderie && !mods.trempeLente) return null

  const today = Math.floor(Date.now() / 86_400_000)
  const craftCap = maxCraftTier(bestStage, bestRaidTier(raidProgress))
  const defs = forgeContractsForDay(today, craftCap)
  const done = forgeContracts && forgeContracts.day === today ? forgeContracts.done : [false, false, false]
  const smeltable = inventory.filter((i) => RARITIES[i.rarity].tier >= 4).slice(0, 8)
  const trempables = inventory.filter((i) => (i.trempeCount ?? 0) < 5).slice(0, 8)
  const trempeItem = trempe ? inventory.find((i) => i.id === trempe.itemId) : undefined
  const trempeDays = trempe ? Math.floor((Date.now() - trempe.startedAt) / 86_400_000) : 0
  const trempeNextH = trempe ? Math.ceil((86_400_000 - ((Date.now() - trempe.startedAt) % 86_400_000)) / 3_600_000) : 0

  return (
    <div className="mb-3 rounded-xl border border-orange-800/40 bg-orange-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-300">⚒️ Procédés du Forgeron</span>
        <span className="text-[10px] text-amber-300">🧱 {lingots} lingot{lingots > 1 ? 's' : ''}</span>
      </div>

      {/* 📋 Contrats quotidiens */}
      {mods.contrats && (
        <div className="mb-2">
          <div className="mb-1 text-[10px] font-semibold text-orange-200/90">📋 Commandes du jour <span className="font-normal text-slate-500">— forge la pièce EXACTE (type + affinité + rareté ≥ exigée)</span></div>
          <div className="space-y-0.5">
            {defs.map((d, i) => {
              const r = RARITY_LIST.find((x) => x.tier === d.minTier)
              return (
                <div key={i} className={'flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] ' + (done[i] ? 'bg-emerald-950/30 text-emerald-300' : 'bg-black/20 text-slate-300')}>
                  <span className="shrink-0">{done[i] ? '✅' : '⬜'}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {ITEM_TYPES[d.type].icon} {ITEM_TYPES[d.type].name} · {PRIMARY_META[d.primary].name} · <span style={{ color: r?.color }}>{r?.name}+</span>
                  </span>
                  <span className="shrink-0 text-amber-300/80">+{CONTRACT_LINGOTS + mods.negociant} 🧱</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 🫕 Fonderie */}
      {mods.fonderie && (
        <div className="mb-2">
          <button onClick={() => setFonderieOpen((o) => !o)} className="flex w-full items-center justify-between text-[10px] font-semibold text-orange-200/90">
            <span>🫕 Fonderie <span className="font-normal text-slate-500">— fond un objet Rare+ du sac en Lingots</span></span>
            <span>{fonderieOpen ? '▾' : '▸'}</span>
          </button>
          {fonderieOpen && (
            <div className="mt-1 space-y-0.5">
              {smeltable.length === 0 && <div className="text-[9.5px] italic text-slate-500">Rien à fondre (Rare+ uniquement).</div>}
              {smeltable.map((it) => (
                <div key={it.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                  {/* clic = carte complète de l'objet (pour décider de fondre). */}
                  <button onClick={() => setViewItem(it)} className="flex min-w-0 flex-1 items-center gap-1 truncate text-left" style={{ color: RARITIES[it.rarity].color }}>
                    <QualityStars stars={it.stars} />
                    <span className="truncate hover:underline">{it.name}</span>
                    <span className="shrink-0 text-slate-500">iLvl {it.ilvl}</span>
                  </button>
                  <button
                    onClick={() => smeltItem(it.id)}
                    className="shrink-0 rounded bg-orange-900/40 px-1.5 py-1 font-medium text-orange-200 hover:bg-orange-800/50"
                  >
                    🫕 +{Math.max(1, Math.round(smeltLingots(RARITIES[it.rarity].tier) * mods.lingotierMult))} 🧱
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🔥 Bac de trempe */}
      {mods.trempeLente && (
        <div>
          <button onClick={() => setTrempeOpen((o) => !o)} className="flex w-full items-center justify-between text-[10px] font-semibold text-orange-200/90">
            <span>🔥 Bac de trempe <span className="font-normal text-slate-500">— +1 iLvl par 24 h réelles (5 max/objet)</span></span>
            <span>{trempeOpen ? '▾' : '▸'}</span>
          </button>
          {trempeOpen && (
            trempe ? (
              <div className="mt-1 rounded bg-black/20 px-1.5 py-1.5 text-[10px]">
                <div className="text-slate-300">
                  🔥 {trempeItem ? trempeItem.name : 'Objet introuvable (vendu ?)'} — {trempeDays} iLvl mûri{trempeDays > 1 ? 's' : ''}
                  {trempeDays === 0 && ` · prochain dans ~${trempeNextH} h`}
                </div>
                <button onClick={() => collectTempering()} className="mt-1 w-full rounded bg-orange-700/60 py-1 font-medium text-orange-100 hover:bg-orange-600/60">
                  Récupérer {trempeDays > 0 ? `(+${trempeDays} iLvl)` : '(sans gain)'}
                </button>
              </div>
            ) : (
              <div className="mt-1 space-y-0.5">
                {trempables.length === 0 && <div className="text-[9.5px] italic text-slate-500">Aucun objet du sac à tremper.</div>}
                {trempables.map((it) => (
                  <div key={it.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                    <button onClick={() => setViewItem(it)} className="flex min-w-0 flex-1 items-center gap-1 truncate text-left" style={{ color: RARITIES[it.rarity].color }}>
                      <QualityStars stars={it.stars} />
                      <span className="truncate hover:underline">{it.name}</span>
                      <span className="shrink-0 text-slate-500">iLvl {it.ilvl} · {5 - (it.trempeCount ?? 0)} rest.</span>
                    </button>
                    <button onClick={() => startTempering(it.id)} className="shrink-0 rounded bg-orange-900/40 px-1.5 py-1 font-medium text-orange-200 hover:bg-orange-800/50">
                      🔥 Tremper
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* carte complète de l'objet (clic sur une ligne fonderie/trempe). */}
      {viewItem && <ItemCardSheet item={viewItem} onClose={() => setViewItem(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 💎 Joaillier : taillerie (stock + fusion)                           */
/* ------------------------------------------------------------------ */

/** Marque de qualité ▾/▴ (Polie = rien). */
function qMark(q: 0 | 1 | 2) {
  return q !== 1 ? <span style={{ color: GEM_QUALITIES[q].color }}>{GEM_QUALITIES[q].mark}</span> : null
}

/** 💎 Mes gemmes — stock en GRILLE DE CARTES par famille + actions (fusion/corruption/
 *  broyage) et troc. Visuel, scannable, fini le scroll de lignes denses. */
function GemStock() {
  const gems = useGame((s) => s.gems)
  const gemDust = useGame((s) => s.gemDust)
  const grindGem = useGame((s) => s.grindGem)
  const fuseGems = useGame((s) => s.fuseGems)
  const fuseAllGems = useGame((s) => s.fuseAllGems)
  const corruptGem = useGame((s) => s.corruptGem)
  const tradeGems = useGame((s) => s.tradeGems)
  const lastStoneTrade = useGame((s) => s.lastStoneTrade)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const [tradeMode, setTradeMode] = useState(false)
  const [tradeSel, setTradeSel] = useState<string[]>([])

  const stock = Object.entries(gems)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ key: k, parsed: parseCondKey(k), n }))
    .filter((x): x is { key: string; parsed: NonNullable<ReturnType<typeof parseCondKey>>; n: number } => !!x.parsed)
  const total = stock.reduce((a, x) => a + x.n, 0)
  const fuseCost = Math.round(GEM_FUSE_COST * mods.fuseCostMult)
  const corruptCost = Math.round(GEM_CORRUPT_COST * (mods.corruptSafe ? 2 : 1))
  const [cOdds] = corruptOdds(mods.pacteLapidaire)
  const canFuseAny = mods.fusion && stock.some((x) => x.n >= GEM_FUSE_COUNT && x.parsed.rank < gemMaxRank(x.parsed.def))
  const today = Math.floor(Date.now() / 86_400_000)
  const tradeDone = lastStoneTrade >= today
  const fams = (Object.keys(GEM_FAMILIES) as GemFamily[])
    .map((f) => ({ f, items: stock.filter((x) => x.parsed.def.family === f).sort((a, b) => a.parsed.def.name.localeCompare(b.parsed.def.name) || a.parsed.rank - b.parsed.rank) }))
    .filter((g) => g.items.length)

  const toggleTrade = (key: string, n: number) => {
    const selCount = tradeSel.filter((k) => k === key).length
    if (selCount < n && tradeSel.length < 3) setTradeSel([...tradeSel, key])
    else { const i = tradeSel.indexOf(key); if (i >= 0) setTradeSel(tradeSel.filter((_, j) => j !== i)) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] text-slate-400">🔹 {gemDust.toLocaleString('fr-FR')} · {total} gemme{total > 1 ? 's' : ''}</span>
        <div className="flex gap-1.5">
          {canFuseAny && (
            <button onClick={fuseAllGems} disabled={gemDust < fuseCost} title="Fusionne tous les lots de 3 gemmes identiques (cascade incluse)." className="rounded bg-orange-900/40 px-2 py-1 text-[10px] font-medium text-orange-200 hover:bg-orange-800/50 disabled:opacity-40">🔥 Tout fusionner</button>
          )}
          {mods.marcheAuxPierres && total > 0 && (
            <button onClick={() => { setTradeMode((m) => !m); setTradeSel([]) }} className={'rounded px-2 py-1 text-[10px] font-medium ' + (tradeMode ? 'bg-amber-600 text-slate-950' : 'bg-slate-800 text-amber-200')}>⚖️ Troquer</button>
          )}
        </div>
      </div>

      {tradeMode && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/10 p-2 text-[10px] text-amber-200">
          {tradeDone ? 'Troc déjà utilisé aujourd\'hui.' : (
            <>Sélectionne 3 gemmes ({tradeSel.length}/3), puis choisis la gemme reçue (rang = min) :
              {tradeSel.length === 3 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {COND_GEM_LIST.map((g) => (
                    <button key={g.id} onClick={() => { tradeGems(tradeSel, g.id as CondGemId); setTradeSel([]); setTradeMode(false) }} title={gemDesc(g, 1)} className="rounded border px-1.5 py-1 text-[9.5px] hover:bg-white/5" style={{ color: g.color, borderColor: g.color + '55' }}>{g.icon} {g.name}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-500">
          Aucune gemme. Va dans <b className="text-sky-300">✂️ Créer</b> pour en tailler / acheter, ou farme les biomes (drops rares).
        </div>
      ) : (
        fams.map(({ f, items }) => (
          <div key={f}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{GEM_FAMILIES[f].icon} {GEM_FAMILIES[f].name}</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {items.map(({ key, parsed, n }) => {
                const canFuse = mods.fusion && n >= GEM_FUSE_COUNT && parsed.rank < gemMaxRank(parsed.def)
                const canCorrupt = mods.corruption && parsed.rank < gemMaxRank(parsed.def)
                const dust = Math.round(grindDust(parsed.rank, parsed.quality) * mods.grindMult)
                const selCount = tradeSel.filter((k) => k === key).length
                return (
                  <div key={key} className={'rounded-lg border p-1.5 ' + (selCount > 0 ? 'ring-1 ring-amber-400' : '')} style={{ borderColor: parsed.def.color + '55', background: parsed.def.color + '0d' }}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[10.5px] font-medium" style={{ color: parsed.def.color }}>{parsed.def.icon} {parsed.def.name}</span>
                      <span className="shrink-0 text-[9px] text-slate-400">R{parsed.rank}{qMark(parsed.quality)} ×{n}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[8.5px] leading-snug text-slate-500" title={gemDesc(parsed.def, parsed.rank, parsed.quality)}>{gemDesc(parsed.def, parsed.rank, parsed.quality)}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tradeMode ? (
                        <button onClick={() => toggleTrade(key, n)} className={'flex-1 rounded px-1.5 py-1 text-[9.5px] ' + (selCount > 0 ? 'bg-amber-600 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-amber-200')}>{selCount > 0 ? `✓ ×${selCount}` : '⚖️ choisir'}</button>
                      ) : (
                        <>
                          {canFuse && <button onClick={() => fuseGems(key)} disabled={gemDust < fuseCost} title={`Fusion : 3 → rang ${parsed.rank + 1} (-${fuseCost} 🔹)`} className="rounded bg-orange-900/40 px-1.5 py-1 text-[9.5px] font-medium text-orange-200 hover:bg-orange-800/50 disabled:opacity-40">🔥 R{parsed.rank + 1}</button>}
                          {canCorrupt && <button onClick={() => corruptGem(key)} disabled={gemDust < corruptCost} title={`Corruption (-${corruptCost} 🔹) : ${Math.round(cOdds * 100)}% rang +1, sécurisée (échec = rien)`} className="rounded bg-fuchsia-900/40 px-1.5 py-1 text-[9.5px] font-medium text-fuchsia-200 hover:bg-fuchsia-800/50 disabled:opacity-40">🫦 {Math.round(cOdds * 100)}%</button>}
                          {mods.broyage && <button onClick={() => grindGem(key)} title={`Broyer → +${dust} 🔹`} className="rounded bg-slate-800 px-1.5 py-1 text-[9.5px] text-slate-400 hover:text-sky-200">⚒️ +{dust}</button>}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

/** ✂️ Créer — Tailler + Acheter UNIFIÉS : choisis une famille, puis chaque gemme
 *  est une carte avec ses deux actions côte à côte. Fini les deux listes séparées. */
function GemCreate() {
  const gems = useGame((s) => s.gems)
  const gemDust = useGame((s) => s.gemDust)
  const cutGem = useGame((s) => s.cutGem)
  const buyGem = useGame((s) => s.buyGem)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const [family, setFamily] = useState<GemFamily>('rythme')
  const cutCost = Math.round(GEM_CUT_COST * mods.tailleCostMult)
  const buyCost = GEM_CUT_COST * 2
  const [qE, , qP] = cutQualityOdds(mods.mainSure)
  const list = COND_GEM_LIST.filter((g) => g.family === family)
  const ownedOf = (id: string) => Object.entries(gems).reduce((a, [k, n]) => a + (parseCondKey(k)?.def.id === id ? n : 0), 0)

  return (
    <div className="space-y-2">
      <p className="text-[9.5px] leading-snug text-slate-500">
        <b className="text-sky-300">✂️ Tailler</b> : qualité ⭐ aléatoire (▴ {Math.round(qP * 100)}% · ▾ {Math.round(qE * 100)}%){mods.taille ? '' : ' — 🔒 nœud Taille de l\'arbre'}. <b className="text-emerald-300">🛒 Acheter</b> : rang 1, Polie (sans métier).
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(GEM_FAMILIES) as GemFamily[]).map((f) => (
          <button key={f} onClick={() => setFamily(f)} className={'flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[9px] ' + (family === f ? 'border-sky-400 bg-sky-900/30 text-sky-200' : 'border-slate-700 text-slate-400 hover:border-slate-500')}>
            <span className="text-base leading-none">{GEM_FAMILIES[f].icon}</span>
            <span className="truncate">{GEM_FAMILIES[f].name}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {list.map((def) => {
          const owned = ownedOf(def.id)
          return (
            <div key={def.id} className="rounded-lg border p-2" style={{ borderColor: def.color + '55', background: def.color + '0d' }}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[11px] font-medium" style={{ color: def.color }}>{def.icon} {def.name}</span>
                {owned > 0 && <span className="shrink-0 text-[9px] text-slate-400">tu en as {owned}</span>}
              </div>
              <div className="mt-0.5 text-[9px] leading-snug text-slate-500">{gemDesc(def, 1)} <span className="text-slate-600">· rangs max {gemMaxRank(def)}</span></div>
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={() => cutGem(def.id as CondGemId)} disabled={!mods.taille || gemDust < cutCost} title={mods.taille ? undefined : 'Apprends le nœud ✂️ Taille (onglet 🌳 Arbre) — il s\'ouvre dès le Sertissage.'} className="flex-1 rounded bg-sky-800/60 py-1.5 text-[10px] font-medium text-sky-100 hover:bg-sky-700/70 disabled:opacity-40">{mods.taille ? '✂️ Tailler' : '🔒 Tailler'} · {cutCost}🔹</button>
                <button onClick={() => buyGem(def.id as CondGemId)} disabled={gemDust < buyCost} className="flex-1 rounded bg-emerald-800/60 py-1.5 text-[10px] font-medium text-emerald-100 hover:bg-emerald-700/70 disabled:opacity-40">🛒 Acheter · {buyCost}🔹</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 🪄 Runiste : aperçu des runes                                       */
/* ------------------------------------------------------------------ */

function RunisteWorkshop() {
  const metiers = useGame((s) => s.metiers)
  const runesOwned = useGame((s) => s.runesOwned)
  const runeFragments = useGame((s) => s.runeFragments)
  const runeCrafted = useGame((s) => s.runeCrafted)
  const poussiere = useGame((s) => s.poussiere)
  const gold = useGame((s) => s.gold)
  const cosmic = useGame((s) => s.cosmic)
  const eraseRune = useGame((s) => s.eraseRune)
  const forgeRune = useGame((s) => s.forgeRune)
  const gambleRune = useGame((s) => s.gambleRune)
  const mods = craftMods(metiers)
  const [forgeOpen, setForgeOpen] = useState(false)

  // carte de rune (visuel moderne, remplace les lignes denses).
  const runeCard = (e: (typeof ENCHANTS)[number]) => {
    const n = runesOwned[e.id] ?? 0
    const cost = runeForgeCost(e, runeCrafted[e.id] ?? 0)
    const canForge = mods.forgeRunique && runeFragments >= cost.fragments && poussiere >= cost.poussiere && gold >= cost.gold && cosmic >= cost.cosmic
    return (
      <div key={e.id} className={'rounded-lg border p-1.5 ' + (n > 0 ? 'border-purple-700/50 bg-purple-950/20' : 'border-slate-700/60 bg-black/20')}>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[10.5px] font-medium text-slate-200">{e.icon} {e.name}</span>
          <span className={'shrink-0 rounded px-1 text-[9px] font-semibold ' + (n > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-600')}>×{n}</span>
        </div>
        <div className="mt-0.5 line-clamp-2 text-[8.5px] leading-snug text-slate-500" title={e.description}>{e.description}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {mods.effacement && n > 0 && (
            <button onClick={() => eraseRune(e.id)} title={`Effacer → +${eraseFragments(e)} 🜁`} className="rounded bg-slate-800 px-1.5 py-1 text-[9.5px] text-slate-400 hover:text-purple-200">🧽 +{eraseFragments(e)} 🜁</button>
          )}
          {forgeOpen && mods.forgeRunique && (
            <button onClick={() => forgeRune(e.id)} disabled={!canForge} title={`Forger : ${cost.fragments} 🜁 + ${cost.poussiere} 🌌 + ${(cost.gold / 1e6).toLocaleString('fr-FR')}M or${cost.cosmic ? ` + ${cost.cosmic} 💫` : ''}`} className="rounded bg-purple-900/40 px-1.5 py-1 text-[9.5px] font-medium text-purple-200 hover:bg-purple-800/50 disabled:opacity-40">🔨 {cost.fragments} 🜁</button>
          )}
        </div>
      </div>
    )
  }
  const section = (title: ReactNode, runes: typeof ENCHANTS, locked: boolean, lockMsg?: string) => (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-purple-300/80">{title}{locked && <span className="font-normal text-slate-500"> — 🔒 {lockMsg}</span>}</div>
      <div className={'grid grid-cols-2 gap-1.5 sm:grid-cols-3 ' + (locked ? 'opacity-50' : '')}>{runes.map(runeCard)}</div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] text-purple-200">🜁 {runeFragments} fragment{runeFragments > 1 ? 's' : ''}</span>
        <div className="flex gap-1.5">
          {mods.forgeRunique && (
            <button onClick={() => setForgeOpen((o) => !o)} className={'rounded px-2 py-1 text-[10px] font-medium ' + (forgeOpen ? 'bg-purple-600 text-slate-50' : 'bg-slate-800 text-slate-300')}>🔨 Forge runique{forgeOpen ? ' ✓' : ''}</button>
          )}
          {mods.surchargeRunique && (
            <button onClick={() => gambleRune()} disabled={runeFragments < RUNE_GAMBLE_COST} className="rounded bg-fuchsia-900/40 px-2 py-1 text-[10px] font-medium text-fuchsia-200 hover:bg-fuchsia-800/50 disabled:opacity-40">🎲 Surcharge · {RUNE_GAMBLE_COST} 🜁</button>
          )}
        </div>
      </div>
      <p className="text-[9.5px] leading-snug text-slate-500">
        Les runes tombent (☠️ raids surtout) ; graver consomme l'exemplaire. 🧽 Effacer → Fragments · 🔨 Forger au choix · 🩸 Pactes forgés uniquement, un seul actif{mods.doublePacte ? ' (⛓️ deux, malus ×1,5)' : ''}.{!mods.enchant && ' 🔒 Apprends « Gravure » dans l\'arbre.'}
      </p>
      {section(<>⏳ Runes de TEMPS {mods.runisteTempo > 1 && <span className="font-normal text-emerald-400">— ×{mods.runisteTempo.toFixed(2)}</span>}</>, TIME_RUNES, false)}
      {section(<>⚖️ Runes de RÈGLE {mods.ruleRunes && mods.ruleAmpTier >= 3 && <span className="font-normal text-emerald-400">— ◈ amplifiées</span>}</>, RULE_RUNES, !mods.ruleRunes, 'nœud « Lois du monde »')}
      {section(<>🩸 PACTES {mods.pactes && mods.pactMalusMult < 1 && <span className="font-normal text-slate-400">— malus −{Math.round((1 - mods.pactMalusMult) * 100)}%</span>}</>, PACT_RUNES, !mods.pactes, 'nœud « Sang d\'encre » (niv 12 · P60)')}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ⚗️ Alchimiste : quintessences + synthèse d'uniques                  */
/* ------------------------------------------------------------------ */

function AlchimisteWorkshop() {
  const quint = useGame((s) => s.quint)
  const reagents = useGame((s) => s.reagents)
  const brews = useGame((s) => s.brews)
  const alchemyRecipes = useGame((s) => s.alchemyRecipes)
  const cuvesEnCours = useGame((s) => s.cuvesEnCours)
  const elixirActive = useGame((s) => s.elixirActive)
  const oilActive = useGame((s) => s.oilActive)
  const antidoteActive = useGame((s) => s.antidoteActive)
  const mutagenActive = useGame((s) => s.mutagenActive)
  const armedRaidShield = useGame((s) => s.armedRaidShield)
  const armedChestBonus = useGame((s) => s.armedChestBonus)
  const armedXpBonus = useGame((s) => s.armedXpBonus)
  const lastTransmute = useGame((s) => s.lastTransmute)
  const philosophale = useGame((s) => s.philosophale)
  const poussiere = useGame((s) => s.poussiere)
  const experiment = useGame((s) => s.experiment)
  const brewStart = useGame((s) => s.brewStart)
  const brewCollect = useGame((s) => s.brewCollect)
  const drinkElixir = useGame((s) => s.drinkElixir)
  const armPotion = useGame((s) => s.armPotion)
  const useOil = useGame((s) => s.useOil)
  const useAntidote = useGame((s) => s.useAntidote)
  const drinkMutagen = useGame((s) => s.drinkMutagen)
  const dailyTransmute = useGame((s) => s.dailyTransmute)
  const craftPhilosophale = useGame((s) => s.craftPhilosophale)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const [expA, setExpA] = useState<DamageType>('feu')
  const [expB, setExpB] = useState<DamageType>('foudre')
  const [typed, setTyped] = useState<DamageType>('feu')
  const [transFrom, setTransFrom] = useState<DamageType>('feu')
  const [transTo, setTransTo] = useState<DamageType>('froid')
  const now = Date.now()
  const totalQuint = DAMAGE_TYPE_LIST.reduce((a, t) => a + (quint[t] ?? 0), 0)
  const today = Math.floor(now / 86_400_000)
  const remainingMin = (until: number) => Math.max(0, Math.round((until - now) / 60_000))

  // Stock des brassins, décodé.
  const brewStock = Object.entries(brews)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ key: k, parsed: parseBrewKey(k), n }))
    .filter((x): x is { key: string; parsed: NonNullable<ReturnType<typeof parseBrewKey>>; n: number } => !!x.parsed)

  const activeLine = (label: string, until: number) => (
    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] text-emerald-300">{label} · {remainingMin(until)} min</span>
  )

  // panneau réutilisable (sous-section moderne, encadrée).
  const Panel = ({ title, children }: { title: ReactNode; children: ReactNode }) => (
    <div className="rounded-lg border border-emerald-800/30 bg-black/20 p-2">
      <div className="mb-1.5 text-[10px] font-semibold text-emerald-300/80">{title}</div>
      {children}
    </div>
  )

  return (
    <div className="space-y-2.5">
      {/* en-tête */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] text-emerald-300">⚗️ {totalQuint} quintessences {philosophale && <span title="Pierre philosophale">🜍</span>}</span>
        <span className="text-[10px] text-slate-500">{alchemyRecipes.length}/{BREWS.length} recettes</span>
      </div>

      {/* Buffs actifs & potions armées */}
      {(elixirActive && elixirActive.until > now) || (oilActive && oilActive.until > now) || (antidoteActive && antidoteActive.until > now) || (mutagenActive && mutagenActive.until > now) || armedRaidShield || armedChestBonus || armedXpBonus ? (
        <div className="flex flex-wrap gap-1">
          {elixirActive && elixirActive.until > now && activeLine(`🧪 ${getBrew(elixirActive.id)?.name ?? 'Élixir'}`, elixirActive.until)}
          {oilActive && oilActive.until > now && activeLine(`🛢️ Huile ${DAMAGE_TYPES[oilActive.type].name}`, oilActive.until)}
          {antidoteActive && antidoteActive.until > now && activeLine(`🧴 Antidote ${DAMAGE_TYPES[antidoteActive.type].name}`, antidoteActive.until)}
          {mutagenActive && mutagenActive.until > now && activeLine(`☣️ Mutagène ${mutagenActive.mult >= 1 ? '+' : ''}${Math.round((mutagenActive.mult - 1) * 100)}%`, mutagenActive.until)}
          {armedRaidShield && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9.5px] text-sky-300">🛡️ Garde armée (prochain raid)</span>}
          {armedChestBonus && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] text-amber-300">💰 Pillard armé (prochain donjon)</span>}
          {armedXpBonus && <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9.5px] text-violet-300">📚 Érudit armé (prochain donjon)</span>}
        </div>
      ) : null}

      {/* 🌿 Réactifs */}
      <Panel title={<>🌿 Réactifs <span className="font-normal text-slate-500">— drop en farm{mods.herboristeMult > 1 ? `, ×${mods.herboristeMult.toFixed(2)}` : ''}</span></>}>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {DAMAGE_TYPE_LIST.map((t) => (
            <span key={t} title={REAGENTS[t].name} style={{ color: DAMAGE_TYPES[t].color }}>{REAGENTS[t].icon} ×{reagents[t] ?? 0}</span>
          ))}
        </div>
      </Panel>

      {!mods.officine ? (
        <p className="text-[9.5px] italic text-slate-500">🔒 Apprends « 🫖 Officine » dans l'arbre : cuves de brassage, expérimentation, élixirs & potions.</p>
      ) : (
        <>
          {/* 🫙 Cuves — cartes */}
          <Panel title={<>🫙 Cuves ({cuvesEnCours.length}/{mods.cuves}) <span className="font-normal text-slate-500">— récolte en fenêtre PARFAITE (×1,3→×1,6) pour le ▴</span></>}>
            {cuvesEnCours.length > 0 && (
              <div className="mb-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {cuvesEnCours.map((cu, i) => {
                  const def = getBrew(cu.recipeId)
                  if (!def) return null
                  const elapsed = (now - cu.startedAt) / 60_000
                  const need = def.brewMin * mods.brewTimeMult
                  const perfect = elapsed >= need * 1.3 && elapsed <= need * 1.6
                  const state = elapsed < need ? `mûrit… ${Math.round(elapsed)}/${Math.round(need)} min` : perfect ? '▴ FENÊTRE PARFAITE !' : elapsed <= need * 1.6 ? 'à point (Pur)' : 'éventé (Pur)'
                  return (
                    <div key={i} className={'rounded-lg border p-1.5 ' + (perfect ? 'border-emerald-400 bg-emerald-950/30' : 'border-slate-700/60 bg-black/20')}>
                      <div className="truncate text-[10.5px] font-medium text-slate-200">{def.icon} {def.name}</div>
                      <div className={'text-[9px] ' + (perfect ? 'font-semibold text-emerald-300' : 'text-slate-500')}>{state}</div>
                      <button onClick={() => brewCollect(i)} className="mt-1 w-full rounded bg-emerald-900/40 py-1 text-[9.5px] font-medium text-emerald-200 hover:bg-emerald-800/50">Récolter</button>
                    </div>
                  )
                })}
              </div>
            )}
            {cuvesEnCours.length < mods.cuves && alchemyRecipes.length > 0 ? (
              <>
                <div className="mb-1 text-[9px] text-slate-500">Lancer un brassin (cuve libre) :</div>
                <div className="flex flex-wrap gap-1">
                  {alchemyRecipes.map((rid) => {
                    const def = getBrew(rid)
                    if (!def) return null
                    const [a, b] = def.recipe
                    const ok = (reagents[a] ?? 0) >= def.cost && (reagents[b] ?? 0) >= (a === b ? def.cost * 2 : def.cost)
                    return (
                      <button
                        key={rid}
                        disabled={!ok}
                        onClick={() => brewStart(rid)}
                        title={`${def.desc}\nCoût : ${def.cost} ${REAGENTS[a].icon} + ${def.cost} ${REAGENTS[b].icon} · ~${Math.round(def.brewMin * mods.brewTimeMult)} min`}
                        className="rounded border border-emerald-800/50 px-1.5 py-1 text-[9.5px] text-emerald-200 hover:bg-emerald-900/30 disabled:opacity-40"
                      >
                        {def.icon} {def.name}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : cuvesEnCours.length === 0 && alchemyRecipes.length === 0 ? (
              <div className="text-[9.5px] italic text-slate-500">Aucune recette connue — utilise l'Expérimentation ci-dessous.</div>
            ) : null}
          </Panel>

          {/* 🧪 Expérimentation */}
          <Panel title={<>🧪 Expérimentation <span className="font-normal text-slate-500">— 2 réactifs ({EXPERIMENT_COST} chacun) → DÉCOUVRIR une recette</span></>}>
            <div className="flex flex-wrap items-center gap-1">
              {DAMAGE_TYPE_LIST.map((t) => (
                <button key={'a' + t} onClick={() => setExpA(t)} className={'rounded px-1.5 py-1 text-[10px] ' + (expA === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-400')} title={REAGENTS[t].name}>{REAGENTS[t].icon}</button>
              ))}
              <span className="text-slate-500">+</span>
              {DAMAGE_TYPE_LIST.map((t) => (
                <button key={'b' + t} onClick={() => setExpB(t)} className={'rounded px-1.5 py-1 text-[10px] ' + (expB === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-400')} title={REAGENTS[t].name}>{REAGENTS[t].icon}</button>
              ))}
              <button
                onClick={() => experiment(expA, expB)}
                disabled={(reagents[expA] ?? 0) < EXPERIMENT_COST || (reagents[expB] ?? 0) < (expA === expB ? EXPERIMENT_COST * 2 : EXPERIMENT_COST)}
                className="rounded bg-emerald-700/60 px-2 py-1 text-[10px] font-medium text-emerald-100 hover:bg-emerald-600/60 disabled:opacity-40"
              >
                ⚗️ Tenter
              </button>
            </div>
          </Panel>

          {/* 🍶 Brassins — cartes */}
          {brewStock.length > 0 && (
            <Panel title="🍶 Brassins en réserve">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {brewStock.map(({ key, parsed, n }) => {
                  const q = BREW_QUALITIES[parsed.quality]
                  const needsType = parsed.def.kind === 'huile' || parsed.def.kind === 'antidote'
                  return (
                    <div key={key} className="rounded-lg border border-slate-700/60 bg-black/20 p-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[10.5px] font-medium" style={{ color: q.color }}>{parsed.def.icon} {parsed.def.name} {q.mark}</span>
                        <span className="shrink-0 text-[9px] text-slate-400">×{n}</span>
                      </div>
                      <div className="line-clamp-2 text-[8.5px] leading-snug text-slate-500" title={parsed.def.desc}>{parsed.def.desc}</div>
                      {needsType && (
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {DAMAGE_TYPE_LIST.map((t) => (
                            <button key={t} onClick={() => setTyped(t)} title={DAMAGE_TYPES[t].name} className={'rounded px-1 py-0.5 text-[9px] ' + (typed === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-500')}>{DAMAGE_TYPES[t].icon}</button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (parsed.def.kind === 'elixir') drinkElixir(key)
                          else if (parsed.def.kind === 'potion') armPotion(key)
                          else if (parsed.def.kind === 'huile') useOil(key, typed)
                          else if (parsed.def.kind === 'antidote') useAntidote(key, typed)
                          else drinkMutagen(key)
                        }}
                        className="mt-1 w-full rounded bg-emerald-900/40 py-1 text-[9.5px] font-medium text-emerald-200 hover:bg-emerald-800/50"
                      >
                        {parsed.def.kind === 'potion' ? 'Armer' : parsed.def.kind === 'huile' ? `Appliquer ${DAMAGE_TYPES[typed].icon}` : parsed.def.kind === 'antidote' ? `Utiliser ${DAMAGE_TYPES[typed].icon}` : 'Boire'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* 🌗 Transmutation du jour */}
          {mods.transmutJour && (
            <Panel title="🌗 Transmutation du jour">
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                {lastTransmute >= today ? (
                  <span className="text-slate-500">Déjà utilisée aujourd'hui.</span>
                ) : (
                  <>
                    {DAMAGE_TYPE_LIST.map((t) => (
                      <button key={'f' + t} onClick={() => setTransFrom(t)} className={'rounded px-1 py-0.5 ' + (transFrom === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-500')}>{DAMAGE_TYPES[t].icon}</button>
                    ))}
                    <span className="text-slate-500">→</span>
                    {DAMAGE_TYPE_LIST.map((t) => (
                      <button key={'t' + t} onClick={() => setTransTo(t)} className={'rounded px-1 py-0.5 ' + (transTo === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-500')}>{DAMAGE_TYPES[t].icon}</button>
                    ))}
                    <button
                      onClick={() => dailyTransmute(transFrom, transTo)}
                      disabled={(quint[transFrom] ?? 0) < DAILY_TRANSMUTE_COST || transFrom === transTo}
                      className="rounded bg-emerald-700/60 px-1.5 py-0.5 font-medium text-emerald-100 disabled:opacity-40"
                    >
                      4 → 1
                    </button>
                  </>
                )}
              </div>
            </Panel>
          )}

          {/* 🜍 Pierre philosophale */}
          {mods.philosophaleUnlock && !philosophale && (
            <button
              onClick={() => craftPhilosophale()}
              disabled={DAMAGE_TYPE_LIST.some((t) => (reagents[t] ?? 0) < PHILOSOPHALE_COST.reagentsEach) || poussiere < PHILOSOPHALE_COST.poussiere || !brewStock.some((b) => b.parsed.quality === 3)}
              title={`${PHILOSOPHALE_COST.reagentsEach} de CHAQUE réactif + ${PHILOSOPHALE_COST.poussiere} 🌌 + 1 brassin MILLÉSIME ★`}
              className="w-full rounded-lg border border-amber-600/50 bg-amber-900/20 py-2 text-[11px] font-semibold text-amber-200 hover:bg-amber-800/30 disabled:opacity-40"
            >
              🜍 Accomplir le Grand Œuvre — la Pierre philosophale
            </button>
          )}
        </>
      )}

      {/* 🧬 Quintessences + synthèses */}
      <Panel title="🧬 Synthèse d'uniques — 3 crans (depuis la fiche objet)">
        {totalQuint > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            {DAMAGE_TYPE_LIST.filter((t) => (quint[t] ?? 0) > 0).map((t) => (
              <span key={t} style={{ color: DAMAGE_TYPES[t].color }}>{DAMAGE_TYPES[t].icon} ×{quint[t]}</span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 text-[10px]">
          {([['✨ I — Infusion', 'Fragment → effet ALÉATOIRE.', mods.synth1], ['🧬 II — Essence', 'Essence → effet semi-ciblé.', mods.synth2], ['💫 III — Invocation', 'Éclats cosmiques → effet AU CHOIX.', mods.synth3]] as const).map(([t, d, on]) => (
            <div key={t} className={'rounded-lg border border-slate-700/60 bg-black/20 p-1.5 ' + (on ? '' : 'opacity-50')}>
              <div className="text-[10px] font-medium text-slate-200">{t} {!on && '🔒'}</div>
              <div className="text-[8.5px] leading-snug text-slate-500">{d}</div>
            </div>
          ))}
        </div>
        {mods.quintCostMult < 1 && (
          <p className="mt-1.5 text-[9.5px] text-emerald-300">◈ Quintessences <b>−{Math.round((1 - mods.quintCostMult) * 100)}%</b>{mods.quintRefundFull ? <> · recyclage <b>100%</b></> : null}.</p>
        )}
      </Panel>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  )
}
