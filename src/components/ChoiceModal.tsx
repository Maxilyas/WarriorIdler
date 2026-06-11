import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { RARITIES } from '../game/rarities'
import { ITEM_TYPES } from '../game/slots'
import { getUnique } from '../game/uniques'
import { recycleValue } from '../game/items'
import { PRIMARY_META } from '../game/stats'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'

/**
 * Coffre du Destin 🎭 : trois objets révélés, le joueur en GARDE UN — les autres sont
 * recyclés en éclats. Le modal bloque tout (comme le coffre classique) jusqu'au choix.
 */
export function ChoiceModal() {
  const choice = useGame((s) => s.pendingChoice)
  const choose = useGame((s) => s.chooseFromChoice)

  if (!choice) return null

  const bestIdx = choice.items.reduce((bi, it, i, arr) => (RARITIES[it.rarity].tier > RARITIES[arr[bi].rarity].tier ? i : bi), 0)
  const bestColor = choice.items.length ? RARITIES[choice.items[bestIdx].rarity].color : '#e879f9'

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-gradient-to-b from-[#170d1a] to-[#0d111a] p-5 text-center shadow-2xl"
        style={{ borderColor: bestColor + '66' }}
      >
        <div className="mb-1 text-3xl">🎭</div>
        <div className="text-sm font-bold text-fuchsia-200">{choice.name}</div>
        <p className="mb-3 mt-1 text-[10.5px] leading-snug text-slate-500">
          Le destin t'offre {choice.items.length} objets — <b className="text-fuchsia-300">tu n'en gardes qu'UN</b>.
          Les autres sont recyclés en ♦ éclats.
        </p>

        <div className="space-y-1.5 text-left">
          {choice.items.map((item, i) => {
            const r = RARITIES[item.rarity]
            const t = ITEM_TYPES[item.type]
            return (
              <button
                key={item.id}
                onClick={() => choose(i)}
                className="item-reveal relative flex w-full items-center gap-2 overflow-hidden rounded-lg border bg-black/30 px-2 py-2 text-left hover:bg-white/5"
                style={{
                  borderColor: r.color + '88',
                  boxShadow: r.tier >= 6 ? `0 0 10px ${r.color}33` : undefined,
                  animationDelay: `${i * 120 + 100}ms`,
                }}
              >
                <span className="relative text-xl">{t.icon}</span>
                <span className="relative min-w-0 flex-1">
                  <span
                    className={'block truncate text-[13px] font-medium ' + rarityNameClass(item.rarity)}
                    style={rarityTextStyle(item.rarity)}
                  >
                    {item.name}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    <span style={{ color: r.color }}>{r.name}</span> · iLvl {item.ilvl}
                    {' '}· {PRIMARY_META[item.primary].name} +{item.primaryValue}
                    {' '}· {item.affixes.length} affixe{item.affixes.length > 1 ? 's' : ''}
                    {item.unique && <span className="text-fuchsia-400"> · ✦ {getUnique(item.unique.id)?.name}</span>}
                  </span>
                  <span className="block text-[9px] text-slate-600">sinon recyclé : ♦ {recycleValue(item).toLocaleString('fr-FR')}</span>
                </span>
                <span className="shrink-0 rounded bg-fuchsia-700/60 px-2 py-1 text-[10px] font-semibold text-fuchsia-100">Garder</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
