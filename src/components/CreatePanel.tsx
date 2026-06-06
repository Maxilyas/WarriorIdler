import { useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { ITEM_TYPES } from '../game/slots'
import { PRIMARY_META } from '../game/stats'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RARITY_LIST } from '../game/rarities'
import { maxCraftTier, createCost } from '../game/items'
import { stageIlvl } from '../game/enemies'
import type { ItemType, OffensiveStat, ItemOrientation, DamageType, RarityId } from '../game/types'

const TYPE_LIST = Object.values(ITEM_TYPES)
const OFFENSIVE: OffensiveStat[] = ['force', 'agilite', 'intelligence']
const ORIENTATIONS: { id: ItemOrientation; label: string }[] = [
  { id: 'offensif', label: 'Offensif' },
  { id: 'equilibre', label: 'Équilibré' },
  { id: 'defensif', label: 'Défensif' },
]

export function CreatePanel({ onClose }: { onClose: () => void }) {
  const bestStage = useGame((s) => s.bestStage)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const createItem = useGame((s) => s.createItem)

  const ilvl = stageIlvl(bestStage)
  const maxTier = maxCraftTier(bestStage)
  const rarities = RARITY_LIST.filter((r) => r.tier <= maxTier)

  const [type, setType] = useState<ItemType>('armePrincipale')
  const [primary, setPrimary] = useState<OffensiveStat>('force')
  const [orientation, setOrientation] = useState<ItemOrientation>('equilibre')
  const [element, setElement] = useState<DamageType>('feu')
  const [rarity, setRarity] = useState<RarityId>(rarities[Math.min(3, rarities.length - 1)].id)

  const isWeapon = type === 'armePrincipale'
  const tier = RARITY_LIST.find((r) => r.id === rarity)!.tier
  const cost = createCost(tier, ilvl)
  const canForge = essence >= cost.eclats && noyau >= cost.noyau

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-700/40 bg-[#0d111a] p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-amber-300">🔨 Forger un objet</h2>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-400 hover:bg-slate-700">✕</button>
        </div>

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
                className={'rounded-lg border px-2 py-1 text-[11px] font-medium ' + (rarity === r.id ? 'border-current' : 'border-slate-700/60')}
                style={{ color: r.color }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </Section>

        {/* Récapitulatif + coût */}
        <div className="mt-3 rounded-lg bg-black/30 p-3 text-xs text-slate-400">
          <div>iLvl de l'objet : <span className="text-slate-200">{ilvl}</span> (lié à ton record de palier)</div>
          <div className="mt-1 flex items-center gap-3">
            <span>Coût :</span>
            <span className={essence >= cost.eclats ? 'text-cyan-300' : 'text-red-400'}>♦ {cost.eclats}</span>
            {cost.noyau > 0 && (
              <span className={noyau >= cost.noyau ? 'text-fuchsia-300' : 'text-red-400'}>💠 {cost.noyau}</span>
            )}
          </div>
          {tier >= 7 && <div className="mt-1 text-[10.5px] text-fuchsia-300/80">Rareté Artefact+ : chance d'obtenir un effet unique.</div>}
        </div>

        <button
          disabled={!canForge}
          onClick={() => createItem({ type, primary, rarity, orientation, ...(isWeapon ? { element } : {}) })}
          className="mt-3 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-40"
        >
          Forger {isWeapon ? `${DAMAGE_TYPES[element].icon} ` : ''}{ITEM_TYPES[type].name}
        </button>
        <p className="mt-1.5 text-center text-[10px] text-slate-500">L'objet apparaît dans ton inventaire. Tu peux forger en série.</p>
      </div>
    </div>,
    document.body,
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
