import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame, referenceIlvl } from '../game/store'
import { ItemRow, QualityStars } from './ItemRow'
import { ComparePanel } from './ComparePanel'
import { EQUIP_SLOTS, ITEM_TYPES, equipSlotsForType, slotAccepts } from '../game/slots'
import { RARITIES, RARITY_LIST } from '../game/rarities'
import { itemScore, itemHasRareStat, itemStatBlock } from '../game/items'
import { PRIMARY_META, SECONDARY_META, SECONDARY_STATS } from '../game/stats'
import { getCondGem } from '../game/condGems'
import { itemSockets } from '../game/gems'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { equipDelta, type EquipDelta } from '../game/character'
import { SETS, setBonuses } from '../game/sets'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'
import { ConfirmButton } from './ui'
import type { DamageType, EquipSlotId, Equipment, Item, ItemType, OffensiveStat, SecondaryStat } from '../game/types'

type SortMode = 'recent' | 'score' | 'rarity' | 'ilvl' | 'dpsUp' | 'ehpUp'
const SORT_LABELS: Record<SortMode, string> = {
  score: 'Score', ilvl: 'iLvl', rarity: 'Rareté', dpsUp: '+DPS', ehpUp: '+Survie', recent: 'Récent',
}
const SORT_ORDER: SortMode[] = ['score', 'ilvl', 'rarity', 'dpsUp', 'ehpUp', 'recent']
const PRIMARY_FILTERS: OffensiveStat[] = ['force', 'agilite', 'intelligence']

/** Couleur de l'iLvl d'une pièce équipée selon son RETARD vs le plafond de contenu atteint. */
function ilvlLagColor(ilvl: number, ref: number): string {
  if (ref <= 0) return '#94a3b8'
  const r = ilvl / ref
  if (r >= 0.85) return '#94a3b8' // à jour
  if (r >= 0.7) return '#fbbf24'  // léger retard
  return '#f87171'                // gros retard
}

/** Objet équipé auquel comparer, selon le contexte (slot choisi ou auto). */
function comparableEquipped(equipment: Equipment, type: ItemType, selectedSlot: EquipSlotId | null): Item | undefined {
  if (selectedSlot && slotAccepts(selectedSlot, type)) return equipment[selectedSlot]
  const slots = equipSlotsForType(type)
  const empty = slots.find((s) => !equipment[s.id])
  if (empty) return undefined
  return slots.map((s) => equipment[s.id]!).sort((a, b) => itemScore(a) - itemScore(b))[0]
}

/** Emplacement où l'objet irait (slot choisi, sinon vide, sinon le plus faible) — pour le Δ DPS. */
function targetSlotFor(equipment: Equipment, type: ItemType, selectedSlot: EquipSlotId | null): EquipSlotId {
  if (selectedSlot && slotAccepts(selectedSlot, type)) return selectedSlot
  const slots = equipSlotsForType(type)
  const empty = slots.find((s) => !equipment[s.id])
  if (empty) return empty.id
  return slots.map((s) => s.id).sort((a, b) => itemScore(equipment[a]!) - itemScore(equipment[b]!))[0]
}

export function StuffScreen() {
  const inventory = useGame((s) => s.inventory)
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const equip = useGame((s) => s.equip)
  const unequip = useGame((s) => s.unequip)
  const sell = useGame((s) => s.sell)
  const recycle = useGame((s) => s.recycle)
  const sellAllBelow = useGame((s) => s.sellAllBelow)
  const recycleAllBelow = useGame((s) => s.recycleAllBelow)
  const toggleLock = useGame((s) => s.toggleLock)
  const sellMany = useGame((s) => s.sellMany)
  const recycleMany = useGame((s) => s.recycleMany)
  const recycleThreshold = useGame((s) => s.recycleThreshold)
  const setRecycleThreshold = useGame((s) => s.setRecycleThreshold)
  const autoRecycle = useGame((s) => s.autoRecycle)
  const toggleAutoRecycle = useGame((s) => s.toggleAutoRecycle)
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const dungeonProgress = useGame((s) => s.dungeonProgress)

  const active = characters[activeChar] ?? characters[0]
  const equipment: Equipment = active?.equipment ?? {}
  // B1 — référence d'iLvl du compte (farm/donjons/raids) : colore le RETARD des pièces équipées.
  const contentIlvl = referenceIlvl(bestStage, raidProgress, dungeonProgress)

  const [selectedSlot, setSelectedSlot] = useState<EquipSlotId | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('score')
  const [primaryFilter, setPrimaryFilter] = useState<OffensiveStat | null>(null)
  const [statFilter, setStatFilter] = useState<SecondaryStat[]>([])
  // Filtres typés : dégâts / résistance d'un élément (l'objet doit porter TOUTES les lignes cochées).
  const [typeFilter, setTypeFilter] = useState<{ kind: 'dmgType' | 'resist'; type: DamageType }[]>([])
  const [showStatFilter, setShowStatFilter] = useState(false)
  // Le paper-doll est repliable sur mobile (libère l'inventaire, qui est le vrai centre d'interaction).
  // Toujours affiché sur grand écran (colonne dédiée).
  const [equipOpen, setEquipOpen] = useState(true)
  // Tri & ventes groupées : repliés par défaut (utilisés par à-coups).
  const [bulkOpen, setBulkOpen] = useState(false)
  // A1 — filtre par set : null = pas de filtre, 'any' = toute pièce de set, sinon id de set précis.
  const [setFilter, setSetFilter] = useState<string | 'any' | null>(null)
  // A3 — multi-sélection : ids cochés, mode « Sélection » (tactile), dernier id cliqué (Maj = plage).
  const [bulkSel, setBulkSel] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  const filterType: ItemType | null = selectedSlot
    ? EQUIP_SLOTS.find((s) => s.id === selectedSlot)!.accepts
    : null

  // 1) FILTRES uniquement (l'ordre vient après — les tris par Δ ont besoin des deltas d'abord).
  const filtered = useMemo(() => {
    let arr = inventory
    if (filterType) arr = arr.filter((i) => i.type === filterType)
    if (primaryFilter) arr = arr.filter((i) => i.primary === primaryFilter)
    // A1 — filtre par set : toute pièce de set, ou un set précis.
    if (setFilter === 'any') arr = arr.filter((i) => i.setId != null)
    else if (setFilter) arr = arr.filter((i) => i.setId === setFilter)
    // Filtre par stats : l'objet doit porter TOUTES les stats sélectionnées (recherche de build précis).
    if (statFilter.length) arr = arr.filter((i) => { const b = itemStatBlock(i); return statFilter.every((s) => (b[s] ?? 0) > 0) })
    // Filtres typés : lignes d'affixe du (kind, type) — une arme du bon élément compte comme dégâts.
    if (typeFilter.length) arr = arr.filter((i) => typeFilter.every((f) =>
      i.affixes.some((a) => a.kind === f.kind && a.type === f.type) || (f.kind === 'dmgType' && i.damageType === f.type)))
    return arr
  }, [inventory, filterType, primaryFilter, statFilter, typeFilter, setFilter])

  // 2) Δ DPS / Δ Survie par objet filtré (swap simulé sur l'emplacement cible) — mémoïsé sur des
  // références stables (le tick recrée les persos mais PAS leur équipement/talents).
  const deltas = useMemo(() => {
    const m = new Map<string, EquipDelta>()
    if (!active) return m
    for (const it of filtered) m.set(it.id, equipDelta(active, it, targetSlotFor(equipment, it.type, selectedSlot)))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, equipment, active?.talents, active?.powers, active?.level, selectedSlot])

  // 3) TRI (réutilise les deltas pour « +DPS » / « +Survie »).
  const visible = useMemo(() => {
    const arr = [...filtered]
    const dlt = (id: string, k: 'dps' | 'ehp') => deltas.get(id)?.[k] ?? -Infinity
    if (sort === 'score') arr.sort((a, b) => itemScore(b) - itemScore(a))
    else if (sort === 'rarity') arr.sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || b.ilvl - a.ilvl)
    else if (sort === 'ilvl') arr.sort((a, b) => b.ilvl - a.ilvl || RARITIES[b.rarity].tier - RARITIES[a.rarity].tier)
    else if (sort === 'dpsUp') arr.sort((a, b) => dlt(b.id, 'dps') - dlt(a.id, 'dps'))
    else if (sort === 'ehpUp') arr.sort((a, b) => dlt(b.id, 'ehp') - dlt(a.id, 'ehp'))
    return arr
  }, [filtered, sort, deltas])

  // L'objet sélectionné peut être dans l'inventaire OU équipé.
  const equippedEntry = (Object.entries(equipment) as [EquipSlotId, Item][]).find(
    ([, it]) => it && it.id === selectedItemId,
  )
  const selectedItem = inventory.find((i) => i.id === selectedItemId) ?? equippedEntry?.[1] ?? null
  const selectedEquippedSlot = equippedEntry?.[0]

  const equippedCount = Object.values(equipment).filter(Boolean).length

  // A1 — sets présents dans l'inventaire (puces de filtre).
  const setsInInv = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.setId).filter((x): x is string => !!x))),
    [inventory],
  )
  // A7 — pièces de set PORTÉES (récap + marqueurs paper-doll).
  const activeSetCounts = setBonuses(equipment).counts

  // A3 — multi-sélection.
  const visibleIds = visible.map((i) => i.id)
  const bulkItems = inventory.filter((i) => bulkSel.has(i.id))
  const bulkLockedCount = bulkItems.filter((i) => i.locked).length
  const clearBulk = () => setBulkSel(new Set())
  const handleRowClick = (e: React.MouseEvent, item: Item) => {
    // Maj+clic = sélection d'une PLAGE depuis le dernier objet cliqué.
    if (e.shiftKey && lastClickedId) {
      const a = visibleIds.indexOf(lastClickedId)
      const b = visibleIds.indexOf(item.id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        setBulkSel((prev) => {
          const n = new Set(prev)
          for (let i = lo; i <= hi; i++) n.add(visibleIds[i])
          return n
        })
        setLastClickedId(item.id)
        return
      }
    }
    // Ctrl/Cmd+clic ou mode Sélection (tactile) = (dé)cocher.
    if (bulkMode || e.ctrlKey || e.metaKey) {
      setBulkSel((prev) => {
        const n = new Set(prev)
        if (n.has(item.id)) n.delete(item.id)
        else n.add(item.id)
        return n
      })
      setLastClickedId(item.id)
      return
    }
    // Clic simple = sélection de comparaison.
    setSelectedItemId(item.id)
    setLastClickedId(item.id)
  }
  const doBulkSell = () => { sellMany([...bulkSel]); clearBulk() }
  const doBulkRecycle = () => { recycleMany([...bulkSel]); clearBulk() }
  const doBulkLock = () => { for (const it of bulkItems) if (!it.locked) toggleLock(it.id) }

  const handleEquip = (slot: EquipSlotId) => {
    if (selectedItem) equip(selectedItem.id, slot)
    setSelectedItemId(null)
  }

  const compare = selectedItem && active ? (
    <ComparePanel
      item={selectedItem}
      char={active}
      previewDelta={selectedEquippedSlot ? undefined : equipDelta(active, selectedItem, targetSlotFor(equipment, selectedItem.type, selectedSlot))}
      equipped={comparableEquipped(equipment, selectedItem.type, selectedSlot)}
      occupied={equipment}
      onEquip={handleEquip}
      onSell={() => {
        sell(selectedItem.id)
        setSelectedItemId(null)
      }}
      onRecycle={() => {
        recycle(selectedItem.id)
        setSelectedItemId(null)
      }}
      onClose={() => setSelectedItemId(null)}
      equippedSlot={selectedEquippedSlot}
      onUnequip={() => {
        if (selectedEquippedSlot) unequip(selectedEquippedSlot)
        setSelectedItemId(null)
      }}
      onToggleLock={selectedEquippedSlot ? undefined : () => toggleLock(selectedItem.id)}
    />
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_300px]">
      {/* Paper-doll */}
      <div className="max-h-[36vh] shrink-0 overflow-y-auto rounded-xl border border-slate-800 bg-[#0d111a] p-2 lg:max-h-none lg:min-h-0 lg:shrink">
        {characters.length > 1 && (
          <div className="mb-1.5 flex gap-1">
            {characters.map((c, i) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveChar(i)
                  setSelectedItemId(null)
                  setSelectedSlot(null)
                }}
                className={
                  'flex-1 truncate rounded px-2 py-1.5 text-[10px] font-medium ' +
                  (i === activeChar ? 'bg-orange-500/20 text-orange-200' : 'bg-slate-800 text-slate-400')
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setEquipOpen((o) => !o)}
          className="mb-1.5 flex w-full items-center justify-between px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:pointer-events-none"
        >
          <span>Équipement de {active?.name ?? '—'} ({equippedCount}/16)</span>
          <span className="text-slate-600 lg:hidden">{equipOpen ? '▾' : '▸'}</span>
        </button>
        {/* A7 — récap des SETS actifs (pièces portées / pièces du set). */}
        {Object.keys(activeSetCounts).length > 0 && (
          <div className={'mb-1.5 flex-wrap gap-1 px-1 text-[9px] ' + (equipOpen ? 'flex' : 'hidden lg:flex')}>
            {Object.entries(activeSetCounts).map(([sid, n]) => {
              const def = SETS[sid]
              const total = def ? Object.keys(def.pieces).length : n
              const color = def?.color ?? '#8a2be2'
              return (
                <span
                  key={sid}
                  title={def ? `${def.name} — ${n}/${total} pièces portées` : sid}
                  className="rounded px-1.5 py-0.5 font-semibold"
                  style={{ color, background: color + '22', border: `1px solid ${color}55` }}
                >
                  {def?.icon ?? '⬢'} {def?.name ?? sid} {n}/{total}
                </span>
              )
            })}
          </div>
        )}
        <div className={'grid-cols-2 gap-1 lg:grid lg:grid-cols-1 ' + (equipOpen ? 'grid' : 'hidden')}>
          {EQUIP_SLOTS.map((slot) => {
            const item = equipment[slot.id]
            const rarity = item ? RARITIES[item.rarity] : null
            const active = selectedSlot === slot.id
            // Gemmes serties : un objet gemmé est un NET AVANTAGE → on le fait SORTIR DU LOT (halo).
            // v0.25.x : les châsses VIDES s'affichent aussi (◇ en pointillés) — on voit d'un coup
            // d'œil le potentiel de sertissage inexploité de son équipement porté.
            const gems = item?.gems ?? []
            const sockets = item ? itemSockets(item) : 0
            const emptySockets = Math.max(0, sockets - gems.length)
            const gemColor = gems.length ? getCondGem(gems[0].cond ?? '')?.color ?? '#a78bfa' : null
            return (
              <button
                key={slot.id}
                onClick={() => {
                  if (item) {
                    // Slot occupé : ouvre l'objet équipé (voir/améliorer) + filtre son type.
                    setSelectedItemId(item.id)
                    setSelectedSlot(slot.id)
                  } else {
                    setSelectedSlot((p) => (p === slot.id ? null : slot.id))
                    setSelectedItemId(null)
                  }
                }}
                className={
                  'group relative rounded-lg border px-2 py-1.5 text-left transition-colors ' +
                  (active ? 'border-orange-400 bg-orange-500/15 ring-2 ring-orange-400/70' : 'border-slate-800 hover:bg-white/5')
                }
                style={item && rarity ? { borderColor: gemColor ?? rarity.color + '55', ...(gemColor ? { boxShadow: `0 0 9px 0 ${gemColor}aa` } : {}) } : undefined}
              >
                {/* v0.27 — qualité ⭐X/5 dans le coin HAUT-GAUCHE, lisible sans clic. */}
                {item && <QualityStars stars={item.stars} className="pointer-events-none absolute -left-1.5 -top-1.5 z-10" />}
                {/* Gemme(s) INCRUSTÉE(S) + châsses VIDES (◇) dans le coin haut-droit. */}
                {(gems.length > 0 || emptySockets > 0) && (
                  <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex gap-0.5">
                    {gems.map((g, i) => {
                      const cg = g.cond ? getCondGem(g.cond) : undefined
                      const c = cg?.color ?? '#a78bfa'
                      return (
                        <span
                          key={i}
                          title={cg ? `Gemme : ${cg.name}` : 'Gemme sertie'}
                          className="flex h-4 w-4 animate-pulse items-center justify-center rounded-full text-[9px] leading-none"
                          style={{ background: c + '33', border: `1px solid ${c}`, boxShadow: `0 0 6px 1px ${c}, inset 0 0 2px ${c}` }}
                        >
                          {cg?.icon ?? '💎'}
                        </span>
                      )
                    })}
                    {Array.from({ length: emptySockets }).map((_, i) => (
                      <span
                        key={`e${i}`}
                        title="Châsse VIDE — sertis-y une gemme (objet → 💎 Châsses)"
                        className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none text-sky-300/80"
                        style={{ background: '#0ea5e91a', border: '1px dashed #38bdf8aa' }}
                      >
                        ◇
                      </span>
                    ))}
                  </span>
                )}
                <div className="text-[9px] uppercase tracking-wide text-slate-500">{slot.name}</div>
                {item ? (
                  <>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{ITEM_TYPES[item.type].icon}</span>
                    <span
                      className={'min-w-0 flex-1 truncate text-[11px] font-medium ' + rarityNameClass(item.rarity)}
                      style={rarityTextStyle(item.rarity)}
                    >
                      {item.name}
                    </span>
                    {itemHasRareStat(item) && <span className="text-[9px]" title="Stat rare">💎</span>}
                    {item.unique && <span className="text-[9px] text-fuchsia-400">✦</span>}
                    {item.setId && (
                      <span className="text-[9px]" style={{ color: SETS[item.setId]?.color ?? '#8a2be2' }} title={`Pièce de set : ${SETS[item.setId]?.name ?? item.setId}`}>⬢</span>
                    )}
                    {item.locked && <span className="text-[9px] text-amber-300" title="Verrouillé">🔒</span>}
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        unequip(slot.id)
                      }}
                      className="hidden rounded px-1 text-[10px] text-slate-400 hover:text-red-400 group-hover:inline"
                    >
                      ✕
                    </span>
                  </div>
                  {/* v0.27 — rareté · iLvl · qualité LISIBLES SANS CLIC ; iLvl coloré selon le retard. */}
                  <div className="mt-0.5 flex items-center gap-1 text-[9px] leading-none">
                    <span className="font-semibold tabular-nums" style={{ color: ilvlLagColor(item.ilvl, contentIlvl) }} title="iLvl — orange/rouge = en retard sur ton contenu actuel">i{item.ilvl}</span>
                    <span style={{ color: RARITIES[item.rarity].color }}>{RARITIES[item.rarity].name}</span>
                  </div>
                  </>
                ) : (
                  <div className="text-[11px] italic text-slate-600">— vide —</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Liste filtrée */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-slate-800 bg-[#0d111a] p-2 lg:flex-none">
        <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
          <div className="text-sm font-semibold text-slate-200">
            {filterType ? (
              <span className="flex items-center gap-1">
                {ITEM_TYPES[filterType].icon} {ITEM_TYPES[filterType].name}
                <button onClick={() => setSelectedSlot(null)} className="ml-1 rounded bg-slate-700 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-slate-600">
                  tous ✕
                </button>
              </span>
            ) : (
              <>Objets <span className="text-slate-500">({visible.length})</span></>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-1 text-[10px]">
            {SORT_ORDER.map((m) => (
              <button
                key={m}
                onClick={() => setSort(m)}
                className={'rounded px-2.5 py-1.5 ' + (sort === m ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
              >
                {SORT_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-1.5 flex flex-wrap items-center gap-1 px-1 text-[10px]">
          <span className="text-slate-500">Affinité :</span>
          <button
            onClick={() => setPrimaryFilter(null)}
            className={'rounded px-2.5 py-1.5 ' + (primaryFilter === null ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
          >
            Toutes
          </button>
          {PRIMARY_FILTERS.map((p) => (
            <button
              key={p}
              onClick={() => setPrimaryFilter((f) => (f === p ? null : p))}
              title={PRIMARY_META[p].desc}
              className={'rounded px-2.5 py-1.5 font-medium ' + (primaryFilter === p ? 'text-slate-950' : 'bg-slate-800')}
              style={primaryFilter === p ? { background: PRIMARY_META[p].color } : { color: PRIMARY_META[p].color }}
            >
              {PRIMARY_META[p].short}
            </button>
          ))}
        </div>

        {/* A1 — filtre par set (n'apparaît que si l'inventaire contient des pièces de set). */}
        {setsInInv.length > 0 && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1 px-1 text-[10px]">
            <span className="text-slate-500">Set :</span>
            <button
              onClick={() => setSetFilter((f) => (f === 'any' ? null : 'any'))}
              className={'rounded px-2.5 py-1.5 font-medium ' + (setFilter === 'any' ? 'bg-violet-500 text-slate-950' : 'bg-slate-800 text-violet-300')}
            >
              ⬢ Toutes pièces
            </button>
            {setsInInv.map((sid) => {
              const def = SETS[sid]
              const on = setFilter === sid
              const color = def?.color ?? '#8a2be2'
              return (
                <button
                  key={sid}
                  onClick={() => setSetFilter((f) => (f === sid ? null : sid))}
                  title={def?.name}
                  className={'rounded px-2.5 py-1.5 font-medium ' + (on ? 'text-slate-950' : 'bg-slate-800')}
                  style={on ? { background: color } : { color }}
                >
                  {def?.icon ?? '⬢'} {def?.name ?? sid}
                </button>
              )
            })}
          </div>
        )}

        {/* Filtre par stat secondaire (recherche de build précis) */}
        <div className="mb-1.5 px-1 text-[10px]">
          <button onClick={() => setShowStatFilter((v) => !v)} className="inline-flex items-center py-1 text-slate-400 hover:text-slate-200">
            🔍 Filtrer par stat{statFilter.length + typeFilter.length ? ` (${statFilter.length + typeFilter.length})` : ''} {showStatFilter ? '▾' : '▸'}
          </button>
          {showStatFilter && (
            <>
              <div className="mt-1 flex flex-wrap gap-1">
                {statFilter.length + typeFilter.length > 0 && (
                  <button onClick={() => { setStatFilter([]); setTypeFilter([]) }} className="rounded bg-slate-700 px-2 py-1.5 text-slate-300 hover:bg-slate-600">tout ✕</button>
                )}
                {SECONDARY_STATS.map((s) => {
                  const on = statFilter.includes(s)
                  const m = SECONDARY_META[s]
                  return (
                    <button
                      key={s}
                      onClick={() => setStatFilter((f) => (on ? f.filter((x) => x !== s) : [...f, s]))}
                      title={`${m.name} — ${m.desc}`}
                      className={'rounded px-2 py-1.5 font-medium ' + (on ? 'text-slate-950' : 'bg-slate-800')}
                      style={on ? { background: m.color } : { color: m.color }}
                    >
                      {m.short}
                    </button>
                  )
                })}
              </div>
              {/* Lignes typées : dégâts / résistance d'un élément (résistances de Nature incluses !) */}
              {(['dmgType', 'resist'] as const).map((kind) => (
                <div key={kind} className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="text-slate-500">{kind === 'dmgType' ? '⚔ Dégâts :' : '🛡 Résist :'}</span>
                  {DAMAGE_TYPE_LIST.map((t) => {
                    const on = typeFilter.some((f) => f.kind === kind && f.type === t)
                    const m = DAMAGE_TYPES[t]
                    return (
                      <button
                        key={t}
                        onClick={() => setTypeFilter((f) => (on ? f.filter((x) => !(x.kind === kind && x.type === t)) : [...f, { kind, type: t }]))}
                        className={'rounded px-2 py-1.5 font-medium ' + (on ? 'text-slate-950' : 'bg-slate-800')}
                        style={on ? { background: m.color } : { color: m.color }}
                      >
                        {m.icon} {m.name}
                      </button>
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Tri & ventes groupées : repliés derrière une ligne (utilisés par à-coups) */}
        <div className="mb-1.5 px-1 text-[10px]">
          <button onClick={() => setBulkOpen((v) => !v)} className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-slate-200">
            ⚙ Tri & ventes
            {autoRecycle && <span className="text-emerald-400">♻️ auto</span>}
            <span>{bulkOpen ? '▾' : '▸'}</span>
          </button>
          {bulkOpen && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="text-slate-500">sous</span>
              <select
                value={recycleThreshold}
                onChange={(e) => setRecycleThreshold(Number(e.target.value))}
                className="rounded bg-slate-800 px-2 py-1.5 text-slate-200"
              >
                {RARITY_LIST.filter((r) => r.tier >= 2 && r.tier <= 16).map((r) => (
                  <option key={r.id} value={r.tier}>{r.name}</option>
                ))}
              </select>
              {/* Seuil ≥ Abyssal : la vente/le recyclage de masse engloutit du Cosmique+ → confirmation. */}
              {recycleThreshold >= 14 ? (
                <>
                  <ConfirmButton onConfirm={() => sellAllBelow(recycleThreshold)} className="rounded bg-yellow-900/40 px-2.5 py-1.5 text-yellow-300 hover:bg-yellow-900/60">
                    💰 Vendre
                  </ConfirmButton>
                  <ConfirmButton onConfirm={() => recycleAllBelow(recycleThreshold)} className="rounded bg-cyan-900/40 px-2.5 py-1.5 text-cyan-300 hover:bg-cyan-900/60">
                    ♻️ Recycler
                  </ConfirmButton>
                </>
              ) : (
                <>
                  <button onClick={() => sellAllBelow(recycleThreshold)} className="rounded bg-yellow-900/40 px-2.5 py-1.5 text-yellow-300 hover:bg-yellow-900/60">
                    💰 Vendre
                  </button>
                  <button onClick={() => recycleAllBelow(recycleThreshold)} className="rounded bg-cyan-900/40 px-2.5 py-1.5 text-cyan-300 hover:bg-cyan-900/60">
                    ♻️ Recycler
                  </button>
                </>
              )}
              <button
                onClick={toggleAutoRecycle}
                title="Recycle automatiquement tout butin (non unique) sous le seuil, directement au drop."
                className={'rounded px-2.5 py-1.5 font-medium ' + (autoRecycle ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-slate-200')}
              >
                {autoRecycle ? '♻️ Auto ✓' : '♻️ Auto'}
              </button>
            </div>
          )}
        </div>

        {/* A3 — multi-sélection : bascule du mode + barre d'action quand une sélection existe. */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1 px-1 text-[10px]">
          <button
            onClick={() => { if (bulkMode) clearBulk(); setBulkMode((m) => !m) }}
            className={'rounded px-2.5 py-1.5 font-medium ' + (bulkMode ? 'bg-sky-600 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-slate-100')}
          >
            {bulkMode ? '✓ Sélection active' : '✓ Sélection'}
          </button>
          {bulkSel.size > 0 ? (
            <>
              <span className="text-sky-300">{bulkSel.size} sélectionné{bulkSel.size > 1 ? 's' : ''}{bulkLockedCount > 0 ? ` · ${bulkLockedCount} 🔒 protégé(s)` : ''}</span>
              <ConfirmButton onConfirm={doBulkSell} className="rounded bg-yellow-900/40 px-2.5 py-1.5 text-yellow-300 hover:bg-yellow-900/60">💰 Vendre</ConfirmButton>
              <ConfirmButton onConfirm={doBulkRecycle} className="rounded bg-cyan-900/40 px-2.5 py-1.5 text-cyan-300 hover:bg-cyan-900/60">♻️ Recycler</ConfirmButton>
              <button onClick={doBulkLock} className="rounded bg-slate-800 px-2.5 py-1.5 text-amber-300 hover:bg-slate-700">🔒 Verrouiller</button>
              <button onClick={clearBulk} className="rounded bg-slate-700 px-2 py-1.5 text-slate-300 hover:bg-slate-600">✕</button>
            </>
          ) : bulkMode ? (
            <span className="text-slate-500">Touche les objets à sélectionner…</span>
          ) : (
            <span className="hidden text-slate-600 lg:inline">Ctrl+clic / Maj+clic pour sélectionner plusieurs objets</span>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {visible.length === 0 ? (
            <div className="mt-8 text-center text-sm text-slate-500">
              {filterType ? 'Aucun objet de ce type.' : 'Inventaire vide. Tuez des ennemis !'}
            </div>
          ) : (
            visible.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                dpsDelta={deltas.get(item.id)?.dps}
                ehpDelta={deltas.get(item.id)?.ehp}
                selected={item.id === selectedItemId}
                bulkSelected={bulkSel.has(item.id)}
                bulkMode={bulkMode}
                onClick={(e) => handleRowClick(e, item)}
                onToggleLock={() => toggleLock(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Comparaison — colonne sur très grand écran */}
      <div className="hidden min-h-0 xl:block xl:overflow-y-auto">
        {compare ?? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 p-4 text-center text-sm text-slate-600">
            Sélectionne un objet dans la liste pour le comparer à ton équipement.
          </div>
        )}
      </div>

      {/* Comparaison — feuille du bas sur mobile & écran moyen (portail vers body) */}
      {selectedItem &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 xl:hidden" onClick={() => setSelectedItemId(null)}>
            <div
              className="mx-auto max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-[#0b0e14] p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {compare}
            </div>
          </div>,
          document.body,
        )}

      </div>
    </div>
  )
}
