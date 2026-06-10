import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { ItemRow } from './ItemRow'
import { ComparePanel } from './ComparePanel'
import { CreatePanel } from './CreatePanel'
import { EQUIP_SLOTS, ITEM_TYPES, equipSlotsForType, slotAccepts } from '../game/slots'
import { RARITIES, RARITY_LIST } from '../game/rarities'
import { itemScore, itemHasRareStat, itemStatBlock } from '../game/items'
import { PRIMARY_META, SECONDARY_META, SECONDARY_STATS } from '../game/stats'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'
import type { EquipSlotId, Equipment, Item, ItemType, OffensiveStat, SecondaryStat } from '../game/types'

type SortMode = 'recent' | 'score' | 'rarity'
const PRIMARY_FILTERS: OffensiveStat[] = ['force', 'agilite', 'intelligence']

/** Objet équipé auquel comparer, selon le contexte (slot choisi ou auto). */
function comparableEquipped(equipment: Equipment, type: ItemType, selectedSlot: EquipSlotId | null): Item | undefined {
  if (selectedSlot && slotAccepts(selectedSlot, type)) return equipment[selectedSlot]
  const slots = equipSlotsForType(type)
  const empty = slots.find((s) => !equipment[s.id])
  if (empty) return undefined
  return slots.map((s) => equipment[s.id]!).sort((a, b) => itemScore(a) - itemScore(b))[0]
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
  const recycleThreshold = useGame((s) => s.recycleThreshold)
  const setRecycleThreshold = useGame((s) => s.setRecycleThreshold)
  const autoRecycle = useGame((s) => s.autoRecycle)
  const toggleAutoRecycle = useGame((s) => s.toggleAutoRecycle)

  const active = characters[activeChar] ?? characters[0]
  const equipment: Equipment = active?.equipment ?? {}

  const [selectedSlot, setSelectedSlot] = useState<EquipSlotId | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('score')
  const [primaryFilter, setPrimaryFilter] = useState<OffensiveStat | null>(null)
  const [statFilter, setStatFilter] = useState<SecondaryStat[]>([])
  const [showStatFilter, setShowStatFilter] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  // Le paper-doll est repliable sur mobile (libère l'inventaire, qui est le vrai centre d'interaction).
  // Toujours affiché sur grand écran (colonne dédiée).
  const [equipOpen, setEquipOpen] = useState(true)

  const filterType: ItemType | null = selectedSlot
    ? EQUIP_SLOTS.find((s) => s.id === selectedSlot)!.accepts
    : null

  const visible = useMemo(() => {
    let arr = inventory
    if (filterType) arr = arr.filter((i) => i.type === filterType)
    if (primaryFilter) arr = arr.filter((i) => i.primary === primaryFilter)
    // Filtre par stats : l'objet doit porter TOUTES les stats sélectionnées (recherche de build précis).
    if (statFilter.length) arr = arr.filter((i) => { const b = itemStatBlock(i); return statFilter.every((s) => (b[s] ?? 0) > 0) })
    arr = [...arr]
    if (sort === 'score') arr.sort((a, b) => itemScore(b) - itemScore(a))
    else if (sort === 'rarity') arr.sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier)
    return arr
  }, [inventory, filterType, primaryFilter, statFilter, sort])

  // L'objet sélectionné peut être dans l'inventaire OU équipé.
  const equippedEntry = (Object.entries(equipment) as [EquipSlotId, Item][]).find(
    ([, it]) => it && it.id === selectedItemId,
  )
  const selectedItem = inventory.find((i) => i.id === selectedItemId) ?? equippedEntry?.[1] ?? null
  const selectedEquippedSlot = equippedEntry?.[0]

  const isUpgrade = (item: Item) => {
    const eq = comparableEquipped(equipment, item.type, selectedSlot)
    return !eq || itemScore(item) > itemScore(eq)
  }

  const equippedCount = Object.values(equipment).filter(Boolean).length

  const handleEquip = (slot: EquipSlotId) => {
    if (selectedItem) equip(selectedItem.id, slot)
    setSelectedItemId(null)
  }

  const compare = selectedItem ? (
    <ComparePanel
      item={selectedItem}
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
    />
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_300px]">
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
        <div className={'grid-cols-2 gap-1 lg:grid lg:grid-cols-1 ' + (equipOpen ? 'grid' : 'hidden')}>
          {EQUIP_SLOTS.map((slot) => {
            const item = equipment[slot.id]
            const rarity = item ? RARITIES[item.rarity] : null
            const active = selectedSlot === slot.id
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
                  (active ? 'border-white/40 bg-white/10' : 'border-slate-800 hover:bg-white/5')
                }
                style={item && rarity ? { borderColor: rarity.color + '55' } : undefined}
              >
                <div className="text-[9px] uppercase tracking-wide text-slate-500">{slot.name}</div>
                {item ? (
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
          <div className="flex gap-1 text-[10px]">
            {(['score', 'rarity', 'recent'] as SortMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSort(m)}
                className={'rounded px-2.5 py-1.5 ' + (sort === m ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
              >
                {m === 'score' ? 'Score' : m === 'rarity' ? 'Rareté' : 'Récent'}
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
              className={'rounded px-2.5 py-1.5 font-medium ' + (primaryFilter === p ? 'text-slate-950' : 'bg-slate-800')}
              style={primaryFilter === p ? { background: PRIMARY_META[p].color } : { color: PRIMARY_META[p].color }}
            >
              {PRIMARY_META[p].short}
            </button>
          ))}
        </div>

        {/* Filtre par stat secondaire (recherche de build précis) */}
        <div className="mb-1.5 px-1 text-[10px]">
          <button onClick={() => setShowStatFilter((v) => !v)} className="inline-flex items-center py-1 text-slate-400 hover:text-slate-200">
            🔍 Filtrer par stat{statFilter.length ? ` (${statFilter.length})` : ''} {showStatFilter ? '▾' : '▸'}
          </button>
          {showStatFilter && (
            <div className="mt-1 flex flex-wrap gap-1">
              {statFilter.length > 0 && (
                <button onClick={() => setStatFilter([])} className="rounded bg-slate-700 px-2 py-1.5 text-slate-300 hover:bg-slate-600">tout ✕</button>
              )}
              {SECONDARY_STATS.map((s) => {
                const on = statFilter.includes(s)
                const m = SECONDARY_META[s]
                return (
                  <button
                    key={s}
                    onClick={() => setStatFilter((f) => (on ? f.filter((x) => x !== s) : [...f, s]))}
                    title={m.name}
                    className={'rounded px-2 py-1.5 font-medium ' + (on ? 'text-slate-950' : 'bg-slate-800')}
                    style={on ? { background: m.color } : { color: m.color }}
                  >
                    {m.short}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-1.5 flex flex-wrap items-center gap-1 px-1 text-[10px]">
          <button onClick={() => setShowCreate(true)} className="rounded bg-amber-700/70 px-2.5 py-1.5 font-medium text-amber-100 hover:bg-amber-600/70">
            🔨 Forger
          </button>
          <span className="text-slate-500">sous</span>
          <select
            value={recycleThreshold}
            onChange={(e) => setRecycleThreshold(Number(e.target.value))}
            className="rounded bg-slate-800 px-2 py-1.5 text-slate-200"
          >
            {RARITY_LIST.filter((r) => r.tier >= 2 && r.tier <= 14).map((r) => (
              <option key={r.id} value={r.tier}>{r.name}</option>
            ))}
          </select>
          <button onClick={() => sellAllBelow(recycleThreshold)} className="rounded bg-yellow-900/40 px-2.5 py-1.5 text-yellow-300 hover:bg-yellow-900/60">
            💰 Vendre
          </button>
          <button onClick={() => recycleAllBelow(recycleThreshold)} className="rounded bg-cyan-900/40 px-2.5 py-1.5 text-cyan-300 hover:bg-cyan-900/60">
            ♻️ Recycler
          </button>
          <button
            onClick={toggleAutoRecycle}
            title="Recycle automatiquement tout butin (non unique) sous le seuil, directement au drop."
            className={'rounded px-2.5 py-1.5 font-medium ' + (autoRecycle ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-slate-200')}
          >
            {autoRecycle ? '♻️ Auto ✓' : '♻️ Auto'}
          </button>
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
                isUpgrade={isUpgrade(item)}
                selected={item.id === selectedItemId}
                onClick={() => setSelectedItemId(item.id)}
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

      {showCreate && <CreatePanel onClose={() => setShowCreate(false)} />}
    </div>
  )
}
