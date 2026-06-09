import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { RARITIES } from '../game/rarities'
import { ITEM_TYPES } from '../game/slots'
import { getUnique } from '../game/uniques'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'

/** Une ligne de récompense (icône + montant formaté + unité). */
function Reward({ color, icon, value, unit }: { color: string; icon: string; value: number; unit: string }) {
  return (
    <span className={color}>
      {icon} {value.toLocaleString('fr-FR')} {unit}
    </span>
  )
}

export function ChestModal() {
  const chest = useGame((s) => s.pendingChest)
  const claim = useGame((s) => s.claimChest)
  const [open, setOpen] = useState(false)

  if (!chest) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-amber-600/50 bg-gradient-to-b from-[#1a160d] to-[#0d111a] p-5 text-center shadow-2xl">
        {!open ? (
          <button onClick={() => setOpen(true)} className="flex w-full flex-col items-center gap-3 py-4">
            <div className="text-xs uppercase tracking-wide text-amber-300/80">{chest.dungeonName} — réussi !</div>
            <div className="chest-shake chest-glow text-[88px] leading-none">🧰</div>
            <div className="rounded-full bg-amber-600 px-4 py-1.5 text-sm font-bold text-slate-950">
              Cliquer pour ouvrir
            </div>
          </button>
        ) : (
          <div>
            <div className="relative mx-auto mb-1 h-16 w-16">
              <div className="burst absolute inset-0 rounded-full bg-amber-400/40" />
              <div className="relative text-5xl">🎉</div>
            </div>
            <div className="mb-2 text-sm font-bold text-amber-300">Butin du coffre</div>

            <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1 text-left">
              {chest.items.map((item, i) => {
                const r = RARITIES[item.rarity]
                const t = ITEM_TYPES[item.type]
                return (
                  <div
                    key={item.id}
                    className="pop-in flex items-center gap-2 rounded-lg border bg-black/30 px-2 py-1.5"
                    style={{ borderColor: r.color + '55', animationDelay: `${i * 80}ms` }}
                  >
                    <span>{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={'block truncate text-[13px] font-medium ' + rarityNameClass(item.rarity)}
                        style={rarityTextStyle(item.rarity)}
                      >
                        {item.name}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        <span style={{ color: r.color }}>{r.name}</span> · iLvl {item.ilvl}
                        {item.unique && <span className="text-fuchsia-400"> · ✦ {getUnique(item.unique.id)?.name}</span>}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>

            <div
              className="pop-in mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs"
              style={{ animationDelay: `${chest.items.length * 80 + 100}ms` }}
            >
              {(chest.xp ?? 0) > 0 && <Reward color="text-violet-300" icon="📚" value={chest.xp!} unit="XP" />}
              {chest.gold > 0 && <Reward color="text-yellow-400" icon="💰" value={chest.gold} unit="or" />}
              {chest.eclats > 0 && <Reward color="text-cyan-300" icon="♦" value={chest.eclats} unit="éclats" />}
              {chest.noyau > 0 && <Reward color="text-fuchsia-300" icon="💠" value={chest.noyau} unit="noyaux" />}
              {(chest.poussiere ?? 0) > 0 && <Reward color="text-indigo-300" icon="🌌" value={chest.poussiere!} unit="poussière" />}
              {chest.sceaux > 0 && <Reward color="text-amber-300" icon="🔑" value={chest.sceaux} unit="sceau" />}
              {(chest.orbes ?? 0) > 0 && <Reward color="text-rose-300" icon="🔮" value={chest.orbes!} unit="orbe" />}
              {(chest.fragments ?? 0) > 0 && <Reward color="text-sky-300" icon="✨" value={chest.fragments!} unit="fragments" />}
              {(chest.cosmic ?? 0) > 0 && <Reward color="font-semibold text-violet-300" icon="💫" value={chest.cosmic!} unit="Éclat cosmique" />}
            </div>

            <button
              onClick={() => {
                claim()
                setOpen(false)
              }}
              className="pop-in mt-4 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-500"
              style={{ animationDelay: `${chest.items.length * 80 + 200}ms` }}
            >
              Tout récupérer
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
