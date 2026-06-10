import type { Item } from '../game/types'
import { RARITIES } from '../game/rarities'
import { ITEM_TYPES } from '../game/slots'
import { DAMAGE_TYPES } from '../game/damage'
import { getUnique } from '../game/uniques'
import { itemHasRareStat } from '../game/items'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'

interface Props {
  item: Item
  /** Δ DPS si on équipe l'objet (swap simulé) — LA métrique d'arbitrage, affichée en vert/rouge. */
  dpsDelta?: number
  selected?: boolean
  onClick?: () => void
}

/** Δ DPS compact : +1,2k / −340 (vide si négligeable). */
function fmtDelta(n: number): string {
  const a = Math.abs(n)
  const v = a >= 10000 ? `${Math.round(a / 1000)}k` : a >= 1000 ? `${(a / 1000).toFixed(1).replace('.', ',')}k` : `${Math.round(a)}`
  return (n > 0 ? '+' : '−') + v
}

/** Une ligne compacte d'inventaire : icône · nom · type/rareté · Δ DPS · ilvl · badges. */
export function ItemRow({ item, dpsDelta, selected, onClick }: Props) {
  const rarity = RARITIES[item.rarity]
  const type = ITEM_TYPES[item.type]
  const showDelta = dpsDelta != null && Math.abs(dpsDelta) >= 1

  return (
    <button
      onClick={onClick}
      className={
        'flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-2 text-left transition-colors ' +
        (selected ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5')
      }
      style={{ borderLeft: `3px solid ${rarity.color}`, paddingLeft: 8 }}
    >
      <span className="text-base leading-none">{type.icon}</span>
      <span className="min-w-0 flex-1">
        <span
          className={'block truncate text-[13px] font-medium leading-tight ' + rarityNameClass(item.rarity)}
          style={rarityTextStyle(item.rarity)}
        >
          {item.name}
        </span>
        <span className="block truncate text-[10px] text-slate-500">
          {type.name} · <span style={{ color: rarity.color }}>{rarity.name}</span>
          {item.damageType && item.damageType !== 'physique' && (
            <span style={{ color: DAMAGE_TYPES[item.damageType].color }}> · {DAMAGE_TYPES[item.damageType].icon}</span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {itemHasRareStat(item) && (
          <span className="text-[11px]" title="Possède une stat RARE">💎</span>
        )}
        {item.unique && (
          <span className="text-[11px] text-fuchsia-400" title={getUnique(item.unique.id)?.name}>✦</span>
        )}
        {showDelta && (
          <span className={'text-[10px] font-bold tabular-nums ' + (dpsDelta! > 0 ? 'text-emerald-400' : 'text-red-400')}>
            {dpsDelta! > 0 ? '▲' : '▼'}{fmtDelta(dpsDelta!)}
          </span>
        )}
        <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">i{item.ilvl}</span>
      </span>
    </button>
  )
}
