import type { ReactNode } from 'react'
import { useGame, MYSTERY_BOXES, EXCHANGE_RATES, shopBuyPrice, shopRefreshCost } from '../game/store'
import { UPGRADES, UPGRADE_CATEGORIES, upgradeCost, isMaxed, type UpgradeCategory } from '../game/upgrades'
import { RARITIES } from '../game/rarities'
import { ITEM_TYPES } from '../game/slots'
import { rarityTextStyle, isPrism } from './rarityStyle'

export function MerchantPanel() {
  const gold = useGame((s) => s.gold)
  const shopStock = useGame((s) => s.shopStock)
  const upgrades = useGame((s) => s.upgrades)
  const bestStage = useGame((s) => s.bestStage)
  const characters = useGame((s) => s.characters)
  const mysteryBox = useGame((s) => s.mysteryBox)
  const buyShopItem = useGame((s) => s.buyShopItem)
  const refreshShop = useGame((s) => s.refreshShop)
  const buyEclats = useGame((s) => s.buyEclats)
  const buyResource = useGame((s) => s.buyResource)
  const buyUpgrade = useGame((s) => s.buyUpgrade)
  const recruitCharacter = useGame((s) => s.recruitCharacter)

  const refreshCost = shopRefreshCost(bestStage)
  const recruitCost = characters.length === 1 ? 5000 : 20000

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">🏪 Marchand</div>
        <div className="text-xs text-yellow-400">💰 {gold.toLocaleString('fr-FR')} or</div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Coffre mystère */}
        <Section title="🎁 Coffres mystères" accent="text-fuchsia-300">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {MYSTERY_BOXES.map((b) => (
              <button
                key={b.id}
                disabled={gold < b.gold}
                onClick={() => mysteryBox(b.id)}
                className="flex flex-col items-center gap-1 rounded-lg border border-fuchsia-700/50 bg-fuchsia-950/20 p-2 hover:bg-fuchsia-900/30 disabled:opacity-40"
              >
                <span className="text-2xl">🧰</span>
                <span className="text-[11px] font-semibold text-fuchsia-200">{b.name}</span>
                <span className="text-[10px] text-slate-400">{b.count} objet{b.count > 1 ? 's' : ''}{b.luck ? ` · +rareté` : ''}</span>
                <span className="text-[11px] text-yellow-400">💰 {b.gold.toLocaleString('fr-FR')}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Échoppe */}
        <Section
          title="🛒 Échoppe"
          accent="text-amber-300"
          action={
            <button onClick={refreshShop} disabled={gold < refreshCost} className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600 disabled:opacity-40">
              ↻ Rafraîchir · 💰 {refreshCost}
            </button>
          }
        >
          {shopStock.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-500">Stock vide — vaincs un boss ou rafraîchis.</div>
          ) : (
            <div className="space-y-1">
              {shopStock.map((item) => {
                const r = RARITIES[item.rarity]
                const price = shopBuyPrice(item)
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-black/20 py-1 pl-1.5 pr-1" style={{ borderLeft: `3px solid ${r.color}` }}>
                    <span>{ITEM_TYPES[item.type].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className={'block truncate text-[12px] font-medium ' + (isPrism(item.rarity) ? 'prism' : '')} style={rarityTextStyle(item.rarity)}>
                        {item.name}
                      </span>
                      <span className="block text-[9px] text-slate-500">
                        <span style={{ color: r.color }}>{r.name}</span> · iLvl {item.ilvl}{item.unique ? ' · ✦' : ''}
                      </span>
                    </span>
                    <button onClick={() => buyShopItem(item.id)} disabled={gold < price} className="shrink-0 rounded bg-yellow-700/70 px-2 py-1 text-[10px] font-medium hover:bg-yellow-600 disabled:opacity-40">
                      💰 {price}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* Comptoir d'échange */}
        <Section title="🔄 Comptoir d'échange" accent="text-cyan-300">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <ExchangeBtn label={`+${EXCHANGE_RATES.eclatsBatch} ♦ éclats`} cost={EXCHANGE_RATES.eclatGoldCost} gold={gold} onClick={buyEclats} />
            <ExchangeBtn label="+1 🔑 Sceau de faille" cost={EXCHANGE_RATES.sceauGold} gold={gold} onClick={() => buyResource('sceau')} />
            <ExchangeBtn label="+1 🔮 Orbe de raid" cost={EXCHANGE_RATES.orbeGold} gold={gold} onClick={() => buyResource('orbe')} />
          </div>
        </Section>

        {/* Améliorations permanentes */}
        <Section title="⬆️ Améliorations permanentes" accent="text-emerald-300">
          {(Object.keys(UPGRADE_CATEGORIES) as UpgradeCategory[]).map((cat) => (
            <div key={cat} className="mb-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: UPGRADE_CATEGORIES[cat].color }}>
                {UPGRADE_CATEGORIES[cat].name}
              </div>
              <div className="space-y-1">
                {UPGRADES.filter((u) => u.category === cat).map((u) => {
                  const level = upgrades[u.id] ?? 0
                  const maxed = isMaxed(u, level)
                  const cost = upgradeCost(u, level)
                  return (
                    <div key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-black/20 px-2 py-1">
                      <span>{u.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-200">{u.name} <span className="text-slate-500">Niv. {level}{u.maxLevel ? `/${u.maxLevel}` : ''}</span></span>
                        <span className="block truncate text-[9px] text-slate-500">{u.description}</span>
                      </span>
                      <button onClick={() => buyUpgrade(u.id)} disabled={maxed || gold < cost} className="shrink-0 rounded bg-emerald-800/60 px-2 py-1 text-[10px] font-medium hover:bg-emerald-700 disabled:opacity-40">
                        {maxed ? 'Max' : `💰 ${cost.toLocaleString('fr-FR')}`}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {characters.length < 3 && (
            <button onClick={recruitCharacter} disabled={gold < recruitCost} className="mt-1 w-full rounded-lg bg-indigo-800/50 py-2 text-[11px] font-medium text-indigo-200 hover:bg-indigo-700/60 disabled:opacity-40">
              🧑‍🤝‍🧑 Recruter un {characters.length === 1 ? '2ᵉ' : '3ᵉ'} personnage · 💰 {recruitCost.toLocaleString('fr-FR')}
            </button>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, accent, action, children }: { title: string; accent: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#11151f] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className={'text-xs font-semibold uppercase tracking-wide ' + accent}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function ExchangeBtn({ label, cost, gold, onClick }: { label: string; cost: number; gold: number; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={gold < cost} className="flex flex-col items-center gap-0.5 rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-2 hover:bg-cyan-900/30 disabled:opacity-40">
      <span className="text-[11px] font-medium text-cyan-200">{label}</span>
      <span className="text-[11px] text-yellow-400">💰 {cost.toLocaleString('fr-FR')}</span>
    </button>
  )
}
