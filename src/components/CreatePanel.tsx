import { useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { ITEM_TYPES } from '../game/slots'
import { PRIMARY_META } from '../game/stats'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RARITY_LIST } from '../game/rarities'
import { maxCraftTier, createCost } from '../game/items'
import { FORGE_UPGRADES, forgeMods, forgeUpgradeCost, forgeUpgradeMaxed } from '../game/forge'
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
  const fragments = useGame((s) => s.fragments)
  const poussiere = useGame((s) => s.poussiere)
  const cosmic = useGame((s) => s.cosmic)
  const createItem = useGame((s) => s.createItem)
  const forgeMastery = useGame((s) => s.forgeMastery)
  const forgeUpgrades = useGame((s) => s.forgeUpgrades)
  const buyForgeUpgrade = useGame((s) => s.buyForgeUpgrade)
  const mods = forgeMods(forgeUpgrades)

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
  const raw = createCost(tier, ilvl)
  const cm = mods.costMult
  const cost = { eclats: Math.round(raw.eclats * cm), noyau: Math.round(raw.noyau * cm), fragments: Math.round((raw.fragments ?? 0) * cm), poussiere: Math.round((raw.poussiere ?? 0) * cm), cosmic: Math.round((raw.cosmic ?? 0) * cm) }
  const canForge = essence >= cost.eclats && noyau >= cost.noyau && fragments >= cost.fragments && poussiere >= cost.poussiere && cosmic >= cost.cosmic

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-700/40 bg-[#0d111a] p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-amber-300">🔨 Forger un objet</h2>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-slate-400 hover:bg-slate-700">✕</button>
        </div>

        {/* Métier de forgeron : Savoir-faire 🔧 + améliorations (déblocages + bonus) */}
        <div className="mb-3 rounded-xl border border-amber-800/40 bg-amber-950/10 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">🔧 Métier de forgeron</span>
            <span className="text-[11px] text-amber-200">🔧 {forgeMastery.toLocaleString('fr-FR')} Savoir-faire</span>
          </div>
          <p className="mb-1.5 text-[9.5px] leading-snug text-slate-500">
            Gagne du Savoir-faire en créant/modifiant des objets, puis débloque & améliore ton atelier.
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {FORGE_UPGRADES.map((u) => {
              const lvl = forgeUpgrades[u.id] ?? 0
              const maxed = forgeUpgradeMaxed(u, lvl)
              const c = forgeUpgradeCost(u, lvl)
              const isUnlock = u.maxLevel === 1
              const owned = isUnlock && lvl > 0
              return (
                <button
                  key={u.id}
                  disabled={maxed || forgeMastery < c}
                  onClick={() => buyForgeUpgrade(u.id)}
                  title={u.description}
                  className={'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left disabled:opacity-50 ' + (owned ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-slate-700 bg-black/20 hover:border-amber-600/60')}
                >
                  <span className="text-base">{u.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-slate-200">
                      {u.name}{u.maxLevel > 1 ? <span className="text-slate-500"> {lvl}/{u.maxLevel}</span> : null}
                    </span>
                    <span className="block truncate text-[8.5px] text-slate-500">{u.description}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold">
                    {owned ? <span className="text-emerald-400">✓ Débloqué</span> : maxed ? <span className="text-slate-500">Max</span> : <span className={forgeMastery >= c ? 'text-amber-300' : 'text-red-400'}>🔧 {c}</span>}
                  </span>
                </button>
              )
            })}
          </div>
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
                className={'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ' + (rarity === r.id ? 'border-current' : 'border-slate-700/60')}
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
          </div>
          {(mods.costMult < 1 || mods.luckChance > 0) && (
            <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-amber-300/80">
              {mods.costMult < 1 && <span>💰 −{Math.round((1 - mods.costMult) * 100)}% coûts (métier)</span>}
              {mods.luckChance > 0 && <span>🎲 +{Math.round(mods.luckChance * 100)}% chance de rareté supérieure</span>}
            </div>
          )}
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
