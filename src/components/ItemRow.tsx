import type { Item } from '../game/types'
import { RARITIES } from '../game/rarities'
import { ITEM_TYPES } from '../game/slots'
import { DAMAGE_TYPES } from '../game/damage'
import { getUnique } from '../game/uniques'
import { rarityTextStyle, isPrism } from './rarityStyle'

interface Props {
  item: Item
  isUpgrade?: boolean
  selected?: boolean
  onClick?: () => void
}

/** Une ligne compacte d'inventaire : icône · nom · type/rareté · ilvl · badges. */
export function ItemRow({ item, isUpgrade, selected, onClick }: Props) {
  const rarity = RARITIES[item.rarity]
  const type = ITEM_TYPES[item.type]

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
          className={'block truncate text-[13px] font-medium leading-tight ' + (isPrism(item.rarity) ? 'prism' : '')}
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
        {item.unique && (
          <span className="text-[11px] text-fuchsia-400" title={getUnique(item.unique.id)?.name}>✦</span>
        )}
        {isUpgrade && <span className="text-[10px] font-bold text-emerald-400">▲</span>}
        <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">i{item.ilvl}</span>
      </span>
    </button>
  )
}
