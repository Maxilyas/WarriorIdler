import type { Item } from '../game/types'
import { RARITIES } from '../game/rarities'
import { ITEM_TYPES } from '../game/slots'
import { DAMAGE_TYPES } from '../game/damage'
import { getUnique } from '../game/uniques'
import { itemHasRareStat } from '../game/items'
import { itemSockets } from '../game/gems'
import { getCondGem } from '../game/condGems'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'

interface Props {
  item: Item
  /** Δ DPS si on équipe l'objet (swap simulé) — LA métrique d'arbitrage, affichée en vert/rouge. */
  dpsDelta?: number
  /** Δ Survie (PV effectifs) si on équipe l'objet — le pendant défensif du Δ DPS. */
  ehpDelta?: number
  selected?: boolean
  onClick?: () => void
}

/** Δ DPS compact : +1,2k / −340 (vide si négligeable). */
function fmtDelta(n: number): string {
  const a = Math.abs(n)
  const v = a >= 10000 ? `${Math.round(a / 1000)}k` : a >= 1000 ? `${(a / 1000).toFixed(1).replace('.', ',')}k` : `${Math.round(a)}`
  return (n > 0 ? '+' : '−') + v
}

/** Badge gemmes/châsses : icônes des gemmes serties + ◇ par châsse vide.
 *  Les châsses sont RARES (v0.25) → l'indicateur fait ressortir les pièces précieuses d'un coup d'œil. */
export function GemBadges({ item }: { item: Item }) {
  const sockets = itemSockets(item)
  if (sockets <= 0) return null
  const gems = item.gems ?? []
  const names = gems
    .map((g) => {
      const d = g.cond ? getCondGem(g.cond) : undefined
      return d ? `${d.name}${(g.rank ?? 1) > 1 ? ` R${g.rank}` : ''}` : null
    })
    .filter(Boolean)
    .join(' · ')
  const empty = Math.max(0, sockets - gems.length)
  return (
    <span
      className="text-[10px] leading-none tracking-tight"
      title={gems.length ? `Gemmes : ${names}${empty ? ` · ${empty} châsse(s) vide(s)` : ''}` : `${sockets} châsse(s) vide(s)`}
    >
      {gems.map((g, i) => {
        const d = g.cond ? getCondGem(g.cond) : undefined
        return <span key={i}>{d?.icon ?? '◆'}</span>
      })}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="text-sky-500/60">◇</span>
      ))}
    </span>
  )
}

/** Une ligne compacte d'inventaire : icône · nom · type/rareté · Δ DPS/Survie · ilvl · badges. */
export function ItemRow({ item, dpsDelta, ehpDelta, selected, onClick }: Props) {
  const rarity = RARITIES[item.rarity]
  const type = ITEM_TYPES[item.type]
  const showDelta = dpsDelta != null && Math.abs(dpsDelta) >= 1
  const showEhp = ehpDelta != null && Math.abs(ehpDelta) >= 1

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
        <GemBadges item={item} />
        {item.unique && (
          <span className="text-[11px] text-fuchsia-400" title={getUnique(item.unique.id)?.name}>✦</span>
        )}
        {item.setId && (
          <span className="text-[11px]" style={{ color: '#8a2be2' }} title="Pièce de set">⬢</span>
        )}
        {(showDelta || showEhp) && (
          <span className="flex flex-col items-end leading-tight">
            {showDelta && (
              <span className={'text-[10px] font-bold tabular-nums ' + (dpsDelta! > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {dpsDelta! > 0 ? '▲' : '▼'}{fmtDelta(dpsDelta!)}⚔
              </span>
            )}
            {showEhp && (
              <span
                className={'text-[9px] font-semibold tabular-nums ' + (ehpDelta! > 0 ? 'text-sky-300' : 'text-red-400/80')}
                title="Δ Survie (PV effectifs)"
              >
                {ehpDelta! > 0 ? '▲' : '▼'}{fmtDelta(ehpDelta!)}🛡
              </span>
            )}
          </span>
        )}
        <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">i{item.ilvl}</span>
      </span>
    </button>
  )
}
