import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { ItemRow } from './ItemRow'
import { ComparePanel } from './ComparePanel'
import { CreatePanel } from './CreatePanel'
import { EQUIP_SLOTS, ITEM_TYPES, equipSlotsForType, slotAccepts } from '../game/slots'
import { RARITIES, RARITY_LIST } from '../game/rarities'
import { itemScore } from '../game/items'
import { rarityTextStyle, isPrism } from './rarityStyle'
import type { EquipSlotId, Equipment, Item, ItemType } from '../game/types'

type SortMode = 'recent' | 'score' | 'rarity'

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

  const active = characters[activeChar] ?? characters[0]
  const equipment: Equipment = active?.equipment ?? {}

  const [selectedSlot, setSelectedSlot] = useState<EquipSlotId | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('score')
  const [showCreate, setShowCreate] = useState(false)
  const [bulkTier, setBulkTier] = useState(4) // seuil de rareté pour vente/recyclage en masse

  const filterType: ItemType | null = selectedSlot
    ? EQUIP_SLOTS.find((s) => s.id === selectedSlot)!.accepts
    : null

  const visible = useMemo(() => {
    let arr = inventory
    if (filterType) arr = arr.filter((i) => i.type === filterType)
    arr = [...arr]
    if (sort === 'score') arr.sort((a, b) => itemScore(b) - itemScore(a))
    else if (sort === 'rarity') arr.sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier)
    return arr
  }, [inventory, filterType, sort])

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
                  'flex-1 truncate rounded px-1 py-1 text-[10px] font-medium ' +
                  (i === activeChar ? 'bg-orange-500/20 text-orange-200' : 'bg-slate-800 text-slate-400')
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Équipement de {active?.name ?? '—'} ({equippedCount}/16)
        </div>
        <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">
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
                  'group relative rounded-lg border px-2 py-1 text-left transition-colors ' +
                  (active ? 'border-white/40 bg-white/10' : 'border-slate-800 hover:bg-white/5')
                }
                style={item && rarity ? { borderColor: rarity.color + '55' } : undefined}
              >
                <div className="text-[9px] uppercase tracking-wide text-slate-500">{slot.name}</div>
                {item ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{ITEM_TYPES[item.type].icon}</span>
                    <span
                      className={'min-w-0 flex-1 truncate text-[11px] font-medium ' + (isPrism(item.rarity) ? 'prism' : '')}
                      style={rarityTextStyle(item.rarity)}
                    >
                      {item.name}
                    </span>
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
                <button onClick={() => setSelectedSlot(null)} className="ml-1 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-600">
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
                className={'rounded px-1.5 py-0.5 ' + (sort === m ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
              >
                {m === 'score' ? 'Score' : m === 'rarity' ? 'Rareté' : 'Récent'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-1.5 flex flex-wrap items-center gap-1 px-1 text-[10px]">
          <button onClick={() => setShowCreate(true)} className="rounded bg-amber-700/70 px-1.5 py-0.5 font-medium text-amber-100 hover:bg-amber-600/70">
            🔨 Forger
          </button>
          <span className="text-slate-500">en masse &lt;</span>
          <select
            value={bulkTier}
            onChange={(e) => setBulkTier(Number(e.target.value))}
            className="rounded bg-slate-800 px-1 py-0.5 text-slate-200"
          >
            {RARITY_LIST.filter((r) => r.tier >= 2 && r.tier <= 14).map((r) => (
              <option key={r.id} value={r.tier}>{r.name}</option>
            ))}
          </select>
          <button onClick={() => sellAllBelow(bulkTier)} className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-yellow-300 hover:bg-yellow-900/60">
            💰 Vendre
          </button>
          <button onClick={() => recycleAllBelow(bulkTier)} className="rounded bg-cyan-900/40 px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-900/60">
            ♻️ Recycler
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
