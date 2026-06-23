import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame, referenceIlvl } from '../game/store'
import { useMediaQuery } from '../useMediaQuery'
import { ItemRow, QualityStars } from './ItemRow'
import { ComparePanel } from './ComparePanel'
import { LevelBadge } from './LevelBadge'
import { EQUIP_SLOTS, ITEM_TYPES, equipSlotsForType, slotAccepts } from '../game/slots'
import { RARITIES, RARITY_LIST } from '../game/rarities'
import { itemScore, itemHasRareStat, itemStatBlock } from '../game/items'
import { PRIMARY_META, SECONDARY_META, SECONDARY_STATS } from '../game/stats'
import { getCondGem } from '../game/condGems'
import { itemSockets } from '../game/gems'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { equipDelta, charDps, charEhp, type EquipDelta } from '../game/character'
import { SETS, setBonuses } from '../game/sets'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'
import { ConfirmButton, Sheet } from './ui'
import type { Character, DamageType, EquipSlotId, Equipment, Item, ItemType, OffensiveStat, SecondaryStat } from '../game/types'

type SortMode = 'recent' | 'score' | 'rarity' | 'ilvl' | 'dpsUp' | 'ehpUp'
const SORT_LABELS: Record<SortMode, string> = {
  dpsUp: '+DPS', ehpUp: '+Survie', score: 'Score', ilvl: 'iLvl', rarity: 'Rareté', recent: 'Récent',
}
// Sous-titre de chaque tri (lisible dans le menu déroulant) — rend « Score » & co explicites.
const SORT_DESC: Record<SortMode, string> = {
  dpsUp: 'Plus gros gain de dégâts pour ce héros',
  ehpUp: 'Plus gros gain de survie pour ce héros',
  score: 'Valeur brute des stats (toutes affinités confondues)',
  ilvl: 'Niveau d\'objet le plus élevé',
  rarity: 'Rareté la plus élevée',
  recent: 'Derniers objets ramassés',
}
// +DPS en tête : le tri par défaut, celui qui répond à « que dois-je équiper ? ».
const SORT_ORDER: SortMode[] = ['dpsUp', 'ehpUp', 'score', 'ilvl', 'rarity', 'recent']
const PRIMARY_FILTERS: OffensiveStat[] = ['force', 'agilite', 'intelligence']
const ITEM_TYPE_LIST = Object.values(ITEM_TYPES)

/** Quelle feuille de bas d'écran est ouverte (mobile : filtres / gérer / équipement). */
type SheetId = 'filters' | 'manage' | 'equip' | null

/** Format court d'un grand nombre (pills de la barre héros) : 184 k, 1,2 M. */
function fmtBig(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e6) return (a / 1e6).toFixed(1).replace('.', ',') + ' M'
  if (a >= 1e4) return Math.round(a / 1000).toLocaleString('fr-FR') + ' k'
  if (a >= 1000) return (a / 1000).toFixed(1).replace('.', ',') + ' k'
  return Math.round(a).toLocaleString('fr-FR')
}

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
  const autoRecycleUseless = useGame((s) => s.autoRecycleUseless)
  const toggleAutoRecycleUseless = useGame((s) => s.toggleAutoRecycleUseless)
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const dungeonProgress = useGame((s) => s.dungeonProgress)

  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const active = characters[activeChar] ?? characters[0]
  const equipment: Equipment = active?.equipment ?? {}
  // B1 — référence d'iLvl du compte (farm/donjons/raids) : colore le RETARD des pièces équipées.
  const contentIlvl = referenceIlvl(bestStage, raidProgress, dungeonProgress)

  const [selectedSlot, setSelectedSlot] = useState<EquipSlotId | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('dpsUp')
  const [sortOpen, setSortOpen] = useState(false)
  const [primaryFilter, setPrimaryFilter] = useState<OffensiveStat | null>(null)
  const [statFilter, setStatFilter] = useState<SecondaryStat[]>([])
  // Filtres typés : dégâts / résistance d'un élément (l'objet doit porter TOUTES les lignes cochées).
  const [typeFilter, setTypeFilter] = useState<{ kind: 'dmgType' | 'resist'; type: DamageType }[]>([])
  // Filtre de TYPE d'objet choisi explicitement (feuille Filtres), indépendant de la sélection de slot.
  const [typeSel, setTypeSel] = useState<ItemType | null>(null)
  // A1 — filtre par set : null = pas de filtre, 'any' = toute pièce de set, sinon id de set précis.
  const [setFilter, setSetFilter] = useState<string | 'any' | null>(null)
  // Feuilles de bas d'écran (mobile) : tous les contrôles vivent dedans → l'inventaire respire.
  const [sheet, setSheet] = useState<SheetId>(null)
  // A3 — multi-sélection : ids cochés, mode « Sélection » (tactile), dernier id cliqué (Maj = plage).
  const [bulkSel, setBulkSel] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  // Type filtrant la liste : slot sélectionné (paper-doll) prioritaire, sinon type choisi explicitement.
  const filterType: ItemType | null = selectedSlot
    ? EQUIP_SLOTS.find((s) => s.id === selectedSlot)!.accepts
    : typeSel

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
  }, [filtered, equipment, active?.talents, active?.pantheon, active?.powers, active?.level, selectedSlot])

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

  // (Retiré) — la pastille « N objets meilleurs » par emplacement reposait sur `itemScore` BRUT
  // (somme de stats) : un verdict mono-dimension trompeur (un objet « moins bon » en score peut être
  // meilleur pour la survie/résist). On garde les SEULS indicateurs honnêtes : les Δ DPS ⚔ / Δ Survie 🛡
  // par ligne d'inventaire (factuels, bi-dimensionnels).

  // Barre héros (mobile) : DPS / Survie / iLvl moyen de l'équipement porté.
  const dps = active ? charDps(active) : 0
  const ehp = active ? charEhp(active) : 0
  const equippedItems = Object.values(equipment).filter((it): it is Item => !!it)
  const avgIlvl = equippedItems.length ? Math.round(equippedItems.reduce((a, it) => a + it.ilvl, 0) / equippedItems.length) : 0

  // L'objet sélectionné peut être dans l'inventaire OU équipé.
  const equippedEntry = (Object.entries(equipment) as [EquipSlotId, Item][]).find(
    ([, it]) => it && it.id === selectedItemId,
  )
  const selectedItem = inventory.find((i) => i.id === selectedItemId) ?? equippedEntry?.[1] ?? null
  const selectedEquippedSlot = equippedEntry?.[0]

  // A1 — sets présents dans l'inventaire (puces de filtre).
  const setsInInv = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.setId).filter((x): x is string => !!x))),
    [inventory],
  )

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

  // Tap d'un emplacement du paper-doll : occupé → ouvre l'objet équipé + filtre son type ; vide → bascule
  // le filtre du slot. Ferme la feuille Équipement (sinon la comparaison s'ouvrirait derrière elle).
  const onSlotTap = (slotId: EquipSlotId, item: Item | undefined) => {
    if (item) { setSelectedItemId(item.id); setSelectedSlot(slotId) }
    else { setSelectedSlot((p) => (p === slotId ? null : slotId)); setSelectedItemId(null) }
    setTypeSel(null)
  }

  const switchChar = (i: number) => {
    setActiveChar(i)
    setSelectedItemId(null)
    setSelectedSlot(null)
  }

  // État des filtres : compteur (badge) + reset global.
  const activeFilterCount = (filterType ? 1 : 0) + (primaryFilter ? 1 : 0) + statFilter.length + typeFilter.length + (setFilter ? 1 : 0)
  const resetFilters = () => {
    setSelectedSlot(null); setTypeSel(null); setPrimaryFilter(null)
    setStatFilter([]); setTypeFilter([]); setSetFilter(null)
  }

  const compare = selectedItem && active ? (
    <ComparePanel
      item={selectedItem}
      char={active}
      previewDelta={selectedEquippedSlot ? undefined : equipDelta(active, selectedItem, targetSlotFor(equipment, selectedItem.type, selectedSlot))}
      equipped={comparableEquipped(equipment, selectedItem.type, selectedSlot)}
      occupied={equipment}
      onEquip={handleEquip}
      onSell={() => { sell(selectedItem.id); setSelectedItemId(null) }}
      onRecycle={() => { recycle(selectedItem.id); setSelectedItemId(null) }}
      onClose={() => setSelectedItemId(null)}
      equippedSlot={selectedEquippedSlot}
      onUnequip={() => { if (selectedEquippedSlot) unequip(selectedEquippedSlot); setSelectedItemId(null) }}
      onToggleLock={selectedEquippedSlot ? undefined : () => toggleLock(selectedItem.id)}
    />
  ) : null

  const paperDoll = (cols: 1 | 2, onAfterSelect: () => void) => (
    <PaperDoll
      characters={characters}
      activeChar={activeChar}
      onSwitch={switchChar}
      equipment={equipment}
      selectedSlot={selectedSlot}
      contentIlvl={contentIlvl}
      onSlotTap={(id, it) => { onSlotTap(id, it); onAfterSelect() }}
      onUnequip={unequip}
      cols={cols}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Barre héros — mobile uniquement : ouvre la feuille Équipement (paper-doll hors du flux). */}
      {active && !isDesktop && (
        <HeroBar char={active} dps={dps} ehp={ehp} avgIlvl={avgIlvl} onOpen={() => setSheet('equip')} />
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-3 xl:grid-cols-[200px_minmax(0,1fr)_300px]">
        {/* Paper-doll — colonne dédiée sur grand écran (sur mobile il vit dans la feuille Équipement). */}
        <div className="hidden rounded-xl border border-slate-800 bg-[#0d111a] p-2 lg:block lg:min-h-0 lg:overflow-y-auto">
          {paperDoll(1, () => {})}
        </div>

        {/* Liste filtrée — le centre d'interaction, qui récupère l'essentiel de la hauteur. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-slate-800 bg-[#0d111a] p-2 lg:flex-none">
          {/* Barre d'outils : 3 entrées qui ouvrent des feuilles (plus de bandeaux empilés). */}
          <div className="mb-1.5 flex gap-1.5">
            <button
              onClick={() => setSheet('filters')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              🔍 Filtres
              {activeFilterCount > 0 && <span className="rounded bg-orange-500 px-1.5 text-[10px] font-bold text-slate-950">{activeFilterCount}</span>}
            </button>
            {/* Tri : menu déroulant dédié (≠ Filtres) — un tap → choix → fermé. Chaque tri est décrit. */}
            <div className="relative flex-1">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                ↕ {SORT_LABELS[sort]} <span className="text-slate-500">▾</span>
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                  <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-700 bg-[#0e131d] shadow-2xl">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Trier par</div>
                    {SORT_ORDER.map((m) => (
                      <button
                        key={m}
                        onClick={() => { setSort(m); setSortOpen(false) }}
                        className={'block w-full px-3 py-2 text-left hover:bg-white/5 ' + (sort === m ? 'bg-orange-500/10' : '')}
                      >
                        <div className={'text-xs font-semibold ' + (sort === m ? 'text-orange-300' : 'text-slate-200')}>
                          {sort === m ? '● ' : ''}{SORT_LABELS[m]}
                        </div>
                        <div className="text-[10px] leading-tight text-slate-500">{SORT_DESC[m]}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setSheet('manage')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              ⚙ Gérer {(autoRecycle || autoRecycleUseless) && <span className="text-[10px] text-emerald-400" title="Recyclage auto actif">♻️</span>}
            </button>
          </div>

          {/* Puces de filtres ACTIFS : toujours visibles, effaçables d'un tap (rien de caché). */}
          {activeFilterCount > 0 && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px]">
              {filterType && (
                <Chip onClear={() => { setSelectedSlot(null); setTypeSel(null) }}>
                  {ITEM_TYPES[filterType].icon} {ITEM_TYPES[filterType].name}
                </Chip>
              )}
              {primaryFilter && (
                <Chip color={PRIMARY_META[primaryFilter].color} onClear={() => setPrimaryFilter(null)}>
                  {PRIMARY_META[primaryFilter].short}
                </Chip>
              )}
              {statFilter.map((s) => (
                <Chip key={s} color={SECONDARY_META[s].color} onClear={() => setStatFilter((f) => f.filter((x) => x !== s))}>
                  {SECONDARY_META[s].short}
                </Chip>
              ))}
              {typeFilter.map((f) => (
                <Chip key={f.kind + f.type} color={DAMAGE_TYPES[f.type].color} onClear={() => setTypeFilter((arr) => arr.filter((x) => !(x.kind === f.kind && x.type === f.type)))}>
                  {f.kind === 'resist' ? '🛡' : '⚔'} {DAMAGE_TYPES[f.type].icon}
                </Chip>
              ))}
              {setFilter && (
                <Chip color={setFilter !== 'any' ? SETS[setFilter]?.color : '#a78bfa'} onClear={() => setSetFilter(null)}>
                  ⬢ {setFilter === 'any' ? 'Sets' : SETS[setFilter]?.name ?? setFilter}
                </Chip>
              )}
              <button onClick={resetFilters} className="ml-1 text-[11px] font-medium text-orange-400 hover:text-orange-300">Réinit.</button>
            </div>
          )}

          {/* Barre d'actions de multi-sélection (apparaît en mode Sélection). */}
          {bulkMode && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-lg bg-sky-950/40 px-1.5 py-1 text-[11px]">
              <span className="font-medium text-sky-300">
                {bulkSel.size > 0 ? `${bulkSel.size} sélectionné${bulkSel.size > 1 ? 's' : ''}` : 'Touchez les objets…'}
                {bulkLockedCount > 0 ? ` · ${bulkLockedCount} 🔒` : ''}
              </span>
              {bulkSel.size > 0 && (
                <>
                  <ConfirmButton onConfirm={doBulkSell} className="rounded bg-yellow-900/40 px-2.5 py-1.5 text-yellow-300 hover:bg-yellow-900/60">💰 Vendre</ConfirmButton>
                  <ConfirmButton onConfirm={doBulkRecycle} className="rounded bg-cyan-900/40 px-2.5 py-1.5 text-cyan-300 hover:bg-cyan-900/60">♻️ Recycler</ConfirmButton>
                  <button onClick={doBulkLock} className="rounded bg-slate-800 px-2.5 py-1.5 text-amber-300 hover:bg-slate-700">🔒</button>
                </>
              )}
              <button onClick={() => { clearBulk(); setBulkMode(false) }} className="ml-auto rounded bg-slate-700 px-2 py-1.5 text-slate-300 hover:bg-slate-600">✕ Quitter</button>
            </div>
          )}

          {/* Compteur d'objets (discret). */}
          <div className="mb-1 flex items-center justify-between px-0.5 text-[10px] text-slate-500">
            <span>
              {filterType ? <>{ITEM_TYPES[filterType].icon} {ITEM_TYPES[filterType].name}</> : 'Tous les objets'}
            </span>
            <span className="tabular-nums">{visible.length} objet{visible.length > 1 ? 's' : ''}</span>
          </div>

          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {visible.length === 0 ? (
              <div className="mt-8 text-center text-sm text-slate-500">
                {activeFilterCount > 0 ? 'Aucun objet ne correspond aux filtres.' : 'Inventaire vide. Tuez des ennemis !'}
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

      {/* Feuille « Équipement » (mobile) : le paper-doll, hors du flux principal. */}
      {sheet === 'equip' && (
        <Sheet title={<span>🛡 Équipement · {active?.name ?? '—'}</span>} onClose={() => setSheet(null)}>
          {paperDoll(2, () => setSheet(null))}
        </Sheet>
      )}

      {/* Feuille « Filtres » : tous les filtres consolidés en un seul endroit (le tri vit dans son menu dédié). */}
      {sheet === 'filters' && (
        <Sheet title="🔍 Filtres" onClose={() => setSheet(null)}>
          <FiltersSheet
            primaryFilter={primaryFilter} setPrimaryFilter={setPrimaryFilter}
            filterType={filterType} setTypeSel={(t) => { setTypeSel(t); setSelectedSlot(null); setSelectedItemId(null) }}
            statFilter={statFilter} setStatFilter={setStatFilter}
            typeFilter={typeFilter} setTypeFilter={setTypeFilter}
            setFilter={setFilter} setSetFilter={setSetFilter} setsInInv={setsInInv}
            count={visible.length} onReset={resetFilters} onClose={() => setSheet(null)}
          />
        </Sheet>
      )}

      {/* Feuille « Gérer » : ventes de masse, recyclage auto, multi-sélection. */}
      {sheet === 'manage' && (
        <Sheet title="⚙ Gérer l'inventaire" onClose={() => setSheet(null)}>
          <ManageSheet
            recycleThreshold={recycleThreshold} setRecycleThreshold={setRecycleThreshold}
            sellAllBelow={sellAllBelow} recycleAllBelow={recycleAllBelow}
            autoRecycle={autoRecycle} toggleAutoRecycle={toggleAutoRecycle}
            autoRecycleUseless={autoRecycleUseless} toggleAutoRecycleUseless={toggleAutoRecycleUseless}
            bulkMode={bulkMode}
            onSelectionMode={() => { setBulkMode(true); setSheet(null) }}
            onStopSelection={() => { setBulkMode(false); clearBulk() }}
          />
        </Sheet>
      )}
    </div>
  )
}

/** Petite puce de filtre actif, effaçable d'un tap. */
function Chip({ color, onClear, children }: { color?: string; onClear: () => void; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1" style={color ? { color } : { color: '#cbd5e1' }}>
      {children}
      <button onClick={onClear} className="text-slate-500 hover:text-slate-200" aria-label="Retirer le filtre">✕</button>
    </span>
  )
}

/** Barre héros compacte (mobile) : avatar + DPS / Survie / iLvl ; tap → feuille Équipement. */
function HeroBar({ char, dps, ehp, avgIlvl, onOpen }: {
  char: Character; dps: number; ehp: number; avgIlvl: number; onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-800 bg-[#0b0f18] p-2 text-left hover:bg-white/5"
    >
      <div className="relative shrink-0">
        <LevelBadge char={char} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-100">
          {char.name} <span className="font-normal text-slate-500">· Niv {char.level}</span>
        </div>
        <div className="mt-1 flex gap-1.5">
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: 'rgba(251,146,60,.14)', color: '#fdba74' }} title="DPS de fiche">
            ⚔ {fmtBig(dps)}
          </span>
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: 'rgba(56,189,248,.13)', color: '#7dd3fc' }} title="Survie (PV effectifs)">
            🛡 {fmtBig(ehp)}
          </span>
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: 'rgba(148,163,184,.13)', color: '#cbd5e1' }} title="iLvl moyen de l'équipement porté">
            ◆ i{avgIlvl}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-lg text-slate-600">›</span>
    </button>
  )
}

/** Paper-doll : sélecteur de perso + récap des sets + grille des 16 emplacements (avec pastilles d'upgrade). */
function PaperDoll({ characters, activeChar, onSwitch, equipment, selectedSlot, contentIlvl, onSlotTap, onUnequip, cols }: {
  characters: Character[]
  activeChar: number
  onSwitch: (i: number) => void
  equipment: Equipment
  selectedSlot: EquipSlotId | null
  contentIlvl: number
  onSlotTap: (slotId: EquipSlotId, item: Item | undefined) => void
  onUnequip: (slot: EquipSlotId) => void
  cols: 1 | 2
}) {
  const active = characters[activeChar] ?? characters[0]
  const equippedCount = Object.values(equipment).filter(Boolean).length
  const activeSetCounts = setBonuses(equipment).counts

  return (
    <div>
      {characters.length > 1 && (
        <div className="mb-1.5 flex gap-1">
          {characters.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onSwitch(i)}
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

      <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Équipement de {active?.name ?? '—'} ({equippedCount}/16)
      </div>

      {/* A7 — récap des SETS actifs (pièces portées / pièces du set). */}
      {Object.keys(activeSetCounts).length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1 px-1 text-[9px]">
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

      <div className={'grid gap-1 ' + (cols === 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-1')}>
        {EQUIP_SLOTS.map((slot) => {
          const item = equipment[slot.id]
          const rarity = item ? RARITIES[item.rarity] : null
          const isActive = selectedSlot === slot.id
          // Gemmes serties (NET AVANTAGE → halo) + châsses VIDES (◇ en pointillés) visibles d'un coup d'œil.
          const gems = item?.gems ?? []
          const sockets = item ? itemSockets(item) : 0
          const emptySockets = Math.max(0, sockets - gems.length)
          const gemColor = gems.length ? getCondGem(gems[0].cond ?? '')?.color ?? '#a78bfa' : null
          return (
            <button
              key={slot.id}
              onClick={() => onSlotTap(slot.id, item)}
              className={
                'group relative rounded-lg border px-2 py-1.5 text-left transition-colors ' +
                (isActive ? 'border-orange-400 bg-orange-500/15 ring-2 ring-orange-400/70' : 'border-slate-800 hover:bg-white/5')
              }
              style={item && rarity ? { borderColor: gemColor ?? rarity.color + '55', ...(gemColor ? { boxShadow: `0 0 9px 0 ${gemColor}aa` } : {}) } : undefined}
            >
              {/* qualité ⭐X/5 dans le coin HAUT-GAUCHE, lisible sans clic. */}
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
              {/* En-tête : nom du slot. (Pastille « ⬆N objets meilleurs » retirée — verdict
                  mono-dimension trompeur ; les Δ DPS/Survie par ligne restent l'arbitrage fiable.) */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase tracking-wide text-slate-500">{slot.name}</span>
              </div>
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
                      onClick={(e) => { e.stopPropagation(); onUnequip(slot.id) }}
                      className="hidden rounded px-1 text-[10px] text-slate-400 hover:text-red-400 group-hover:inline"
                    >
                      ✕
                    </span>
                  </div>
                  {/* rareté · iLvl LISIBLES SANS CLIC ; iLvl coloré selon le retard. */}
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
  )
}

/** Feuille « Filtres » : type + affinité + stats + élément + set, tout en un (le tri a son menu dédié). */
function FiltersSheet({
  primaryFilter, setPrimaryFilter, filterType, setTypeSel,
  statFilter, setStatFilter, typeFilter, setTypeFilter, setFilter, setSetFilter, setsInInv,
  count, onReset, onClose,
}: {
  primaryFilter: OffensiveStat | null; setPrimaryFilter: (f: OffensiveStat | null) => void
  filterType: ItemType | null; setTypeSel: (t: ItemType | null) => void
  statFilter: SecondaryStat[]; setStatFilter: React.Dispatch<React.SetStateAction<SecondaryStat[]>>
  typeFilter: { kind: 'dmgType' | 'resist'; type: DamageType }[]; setTypeFilter: React.Dispatch<React.SetStateAction<{ kind: 'dmgType' | 'resist'; type: DamageType }[]>>
  setFilter: string | 'any' | null; setSetFilter: React.Dispatch<React.SetStateAction<string | 'any' | null>>
  setsInInv: string[]
  count: number; onReset: () => void; onClose: () => void
}) {
  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-1 mt-3 text-[11px] font-semibold text-slate-500 first:mt-0">{children}</div>
  )
  return (
    <div className="text-[11px]">
      <Label>Type d'objet</Label>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setTypeSel(null)}
          className={'rounded-lg px-2.5 py-1.5 font-medium ' + (filterType === null ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
        >
          Tous
        </button>
        {ITEM_TYPE_LIST.map((t) => (
          <button
            key={t.id}
            onClick={() => setTypeSel(filterType === t.id ? null : t.id)}
            className={'rounded-lg px-2.5 py-1.5 font-medium ' + (filterType === t.id ? 'bg-orange-500 text-slate-950' : 'bg-slate-800 text-slate-300')}
          >
            {t.icon} {t.name}
          </button>
        ))}
      </div>

      <Label>Affinité</Label>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setPrimaryFilter(null)}
          className={'rounded-lg px-2.5 py-1.5 font-medium ' + (primaryFilter === null ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
        >
          Toutes
        </button>
        {PRIMARY_FILTERS.map((p) => (
          <button
            key={p}
            onClick={() => setPrimaryFilter(primaryFilter === p ? null : p)}
            title={PRIMARY_META[p].desc}
            className={'rounded-lg px-2.5 py-1.5 font-medium ' + (primaryFilter === p ? 'text-slate-950' : 'bg-slate-800')}
            style={primaryFilter === p ? { background: PRIMARY_META[p].color } : { color: PRIMARY_META[p].color }}
          >
            {PRIMARY_META[p].short}
          </button>
        ))}
      </div>

      <Label>Stats recherchées</Label>
      <div className="flex flex-wrap gap-1.5">
        {SECONDARY_STATS.map((s) => {
          const on = statFilter.includes(s)
          const m = SECONDARY_META[s]
          return (
            <button
              key={s}
              onClick={() => setStatFilter((f) => (on ? f.filter((x) => x !== s) : [...f, s]))}
              title={`${m.name} — ${m.desc}`}
              className={'rounded-lg px-2 py-1.5 font-medium ' + (on ? 'text-slate-950' : 'bg-slate-800')}
              style={on ? { background: m.color } : { color: m.color }}
            >
              {m.short}
            </button>
          )
        })}
      </div>

      {(['dmgType', 'resist'] as const).map((kind) => (
        <div key={kind}>
          <Label>{kind === 'dmgType' ? '⚔ Dégâts' : '🛡 Résistance'}</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAMAGE_TYPE_LIST.map((t) => {
              const on = typeFilter.some((f) => f.kind === kind && f.type === t)
              const m = DAMAGE_TYPES[t]
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter((f) => (on ? f.filter((x) => !(x.kind === kind && x.type === t)) : [...f, { kind, type: t }]))}
                  className={'rounded-lg px-2 py-1.5 font-medium ' + (on ? 'text-slate-950' : 'bg-slate-800')}
                  style={on ? { background: m.color } : { color: m.color }}
                >
                  {m.icon} {m.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {setsInInv.length > 0 && (
        <>
          <Label>Set</Label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSetFilter((f) => (f === 'any' ? null : 'any'))}
              className={'rounded-lg px-2.5 py-1.5 font-medium ' + (setFilter === 'any' ? 'bg-violet-500 text-slate-950' : 'bg-slate-800 text-violet-300')}
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
                  className={'rounded-lg px-2.5 py-1.5 font-medium ' + (on ? 'text-slate-950' : 'bg-slate-800')}
                  style={on ? { background: color } : { color }}
                >
                  {def?.icon ?? '⬢'} {def?.name ?? sid}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={onReset} className="flex-1 rounded-lg border border-slate-700 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/5">
          Réinitialiser
        </button>
        <button onClick={onClose} className="flex-[1.4] rounded-lg bg-orange-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-orange-400">
          Voir {count} objet{count > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

/** Feuille « Gérer » : ventes/recyclage de masse, recyclage auto, mode multi-sélection. */
function ManageSheet({
  recycleThreshold, setRecycleThreshold, sellAllBelow, recycleAllBelow,
  autoRecycle, toggleAutoRecycle, autoRecycleUseless, toggleAutoRecycleUseless,
  bulkMode, onSelectionMode, onStopSelection,
}: {
  recycleThreshold: number; setRecycleThreshold: (n: number) => void
  sellAllBelow: (t: number, uselessOnly?: boolean) => void; recycleAllBelow: (t: number, uselessOnly?: boolean) => void
  autoRecycle: boolean; toggleAutoRecycle: () => void
  autoRecycleUseless: boolean; toggleAutoRecycleUseless: () => void
  bulkMode: boolean; onSelectionMode: () => void; onStopSelection: () => void
}) {
  const highTier = recycleThreshold >= 14
  // Filtre manuel optionnel : ne cibler que le butin inutile (n'améliore ni DPS ni survie d'aucun héros).
  const [uselessOnly, setUselessOnly] = useState(false)
  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold text-slate-500">Ventes & recyclage de masse</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400">Tout ce qui est sous</span>
          <select
            value={recycleThreshold}
            onChange={(e) => setRecycleThreshold(Number(e.target.value))}
            className="rounded bg-slate-800 px-2 py-1.5 text-slate-200"
          >
            {RARITY_LIST.filter((r) => r.tier >= 2 && r.tier <= 16).map((r) => (
              <option key={r.id} value={r.tier}>{r.name}</option>
            ))}
          </select>
          {highTier ? (
            <>
              <ConfirmButton onConfirm={() => sellAllBelow(recycleThreshold, uselessOnly)} className="rounded bg-yellow-900/40 px-3 py-1.5 text-yellow-300 hover:bg-yellow-900/60">💰 Vendre</ConfirmButton>
              <ConfirmButton onConfirm={() => recycleAllBelow(recycleThreshold, uselessOnly)} className="rounded bg-cyan-900/40 px-3 py-1.5 text-cyan-300 hover:bg-cyan-900/60">♻️ Recycler</ConfirmButton>
            </>
          ) : (
            <>
              <button onClick={() => sellAllBelow(recycleThreshold, uselessOnly)} className="rounded bg-yellow-900/40 px-3 py-1.5 text-yellow-300 hover:bg-yellow-900/60">💰 Vendre</button>
              <button onClick={() => recycleAllBelow(recycleThreshold, uselessOnly)} className="rounded bg-cyan-900/40 px-3 py-1.5 text-cyan-300 hover:bg-cyan-900/60">♻️ Recycler</button>
            </>
          )}
        </div>
        {/* Case à cocher : restreint le tri de masse au butin inutile (cumulable avec le seuil ci-dessus).
            Astuce : seuil au maximum + coché = recycler TOUT l'inutile, toutes raretés (verrou 🔒 / Cosmique+ épargnés). */}
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-300">
          <input type="checkbox" checked={uselessOnly} onChange={(e) => setUselessOnly(e.target.checked)} className="accent-cyan-500" />
          <span>… et qui n'améliore <b>ni le DPS ni la survie</b> d'aucun héros</span>
        </label>
        {highTier && <div className="mt-1 text-[10px] text-amber-300/80">⚠ Seuil élevé : engloutit du Cosmique+ (double confirmation requise).</div>}
        {uselessOnly && <div className="mt-1 text-[10px] text-amber-300/80">⚠ Compare à TES héros recrutés : un objet utile à une autre classe / un héros non débloqué peut partir. Verrouille 🔒 ce que tu veux garder.</div>}
      </div>

      <button
        onClick={toggleAutoRecycle}
        title="Recycle automatiquement tout butin sous le seuil de rareté, directement au drop (verrou 🔒 et uniques Cosmique+ épargnés)."
        className={'flex w-full items-center justify-between rounded-lg px-3 py-2.5 font-medium ' + (autoRecycle ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
      >
        <span>♻️ Recyclage auto sous le seuil de rareté</span>
        <span>{autoRecycle ? '✓ Actif' : 'Inactif'}</span>
      </button>

      <button
        onClick={toggleAutoRecycleUseless}
        title="Recycle au drop tout butin qui n'améliore NI le DPS NI la survie d'aucun héros recruté (comparé à l'équipement porté). Cumulable avec le seuil. Verrou 🔒 et uniques Cosmique+ épargnés."
        className={'flex w-full items-center justify-between rounded-lg px-3 py-2.5 font-medium ' + (autoRecycleUseless ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
      >
        <span>♻️ Recyclage auto du butin inutile (ni DPS ni survie)</span>
        <span>{autoRecycleUseless ? '✓ Actif' : 'Inactif'}</span>
      </button>

      {autoRecycleUseless && (
        <div className="text-[10px] leading-tight text-amber-300/80">
          ⚠ Compare à TES héros recrutés. Un objet utile à une classe/un héros pas encore débloqué — ou à un
          build futur — peut être recyclé. Verrouille 🔒 ce que tu veux garder.
        </div>
      )}

      <div className="border-t border-slate-800 pt-3">
        <div className="mb-1.5 text-[11px] font-semibold text-slate-500">Sélection multiple</div>
        {bulkMode ? (
          <button onClick={onStopSelection} className="w-full rounded-lg bg-slate-700 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-600">
            ✕ Quitter le mode sélection
          </button>
        ) : (
          <button onClick={onSelectionMode} className="w-full rounded-lg bg-sky-600 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-500">
            ✓ Activer la sélection multiple
          </button>
        )}
        <div className="mt-1.5 text-[10px] leading-snug text-slate-500">
          Touche ensuite les objets pour les cocher, puis vends / recycle / verrouille le lot d'un coup.
        </div>
      </div>
    </div>
  )
}
