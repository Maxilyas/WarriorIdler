import { useState, useEffect, type ReactNode } from 'react'
import { useGame, MYSTERY_BOXES, EXCHANGE_RATES, RECRUIT_COST, RECRUIT_POUSSIERE, shopBuyPrice, shopRefreshCost, SHOP_INTERVAL_MS } from '../game/store'
import { UPGRADES, UPGRADE_CATEGORIES, upgradeCost, upgradePoussiere, upgradeEclats, isMaxed, type UpgradeCategory } from '../game/upgrades'
import { RARITIES, RARITY_LIST } from '../game/rarities'
import { ITEM_TYPES } from '../game/slots'
import { rarityTextStyle, rarityNameClass } from './rarityStyle'

export function MerchantPanel() {
  const gold = useGame((s) => s.gold)
  const essence = useGame((s) => s.essence)
  const poussiere = useGame((s) => s.poussiere)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const shopStock = useGame((s) => s.shopStock)
  const lastShopRefresh = useGame((s) => s.lastShopRefresh)
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

  const [qty, setQty] = useState(1)

  // Compte à rebours de la rotation horaire (re-render chaque seconde).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const remaining = Math.max(0, SHOP_INTERVAL_MS - (now - (lastShopRefresh || 0)))
  const rh = Math.floor(remaining / 3_600_000)
  const rm = Math.floor((remaining % 3_600_000) / 60_000)
  const rs = Math.floor((remaining % 60_000) / 1000)
  const countdown = rh > 0 ? `${rh} h ${rm} min` : rm > 0 ? `${rm} min ${rs} s` : `${rs} s`

  const refreshCost = shopRefreshCost(bestStage)
  const recruitIdx = characters.length - 1
  const recruitCost = RECRUIT_COST[recruitIdx] ?? 250000
  const recruitPoussiere = RECRUIT_POUSSIERE[recruitIdx] ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">🏪 Marchand</div>
        <div className="text-xs text-yellow-400">💰 {gold.toLocaleString('fr-FR')} or</div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Coffres mystères (10 types, distribution de rareté + jackpot) */}
        <Section title="🎁 Coffres mystères" accent="text-fuchsia-300">
          <p className="mb-1.5 text-[10px] leading-snug text-slate-500">
            Chaque coffre tire une <b className="text-slate-300">fourchette de rareté</b> (pas une rareté fixe) avec
            une petite chance de <b className="text-fuchsia-300">jackpot</b> au-dessus. Plus c'est cher, plus c'est fort.
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {MYSTERY_BOXES.map((b) => {
              const minName = RARITY_LIST.find((r) => r.tier === b.minTier)
              const maxName = RARITY_LIST.find((r) => r.tier === b.maxTier)
              const affordable = gold >= b.gold && fragments >= (b.costFragments ?? 0) && cosmic >= (b.costCosmic ?? 0)
              return (
                <button
                  key={b.id}
                  disabled={!affordable}
                  onClick={() => mysteryBox(b.id)}
                  title={b.desc}
                  className="flex items-center gap-2 rounded-lg border border-fuchsia-700/40 bg-fuchsia-950/20 p-2 text-left hover:bg-fuchsia-900/30 disabled:opacity-40"
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-fuchsia-200">{b.name}</span>
                    <span className="block truncate text-[9px]">
                      <span style={{ color: minName?.color }}>{minName?.name}</span>
                      <span className="text-slate-600"> → </span>
                      <span style={{ color: maxName?.color }}>{maxName?.name}</span>
                      <span className="text-slate-500"> · {b.count} obj{b.guaranteeUnique ? ' · ✦' : ''}</span>
                    </span>
                    <span className="block text-[11px] font-medium">
                      <span className="text-yellow-400">💰 {b.gold.toLocaleString('fr-FR')}</span>
                      {b.costFragments ? <span className={fragments >= b.costFragments ? 'text-sky-300' : 'text-red-400'}> · ✨ {b.costFragments}</span> : null}
                      {b.costCosmic ? <span className={cosmic >= b.costCosmic ? 'text-violet-300' : 'text-red-400'}> · 💫 {b.costCosmic}</span> : null}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        {/* Échoppe */}
        <Section
          title="🛒 Échoppe"
          accent="text-amber-300"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500" title="Rotation automatique toutes les heures">🕐 {countdown}</span>
              <button onClick={refreshShop} disabled={gold < refreshCost} className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600 disabled:opacity-40">
                ↻ Rafraîchir · 💰 {refreshCost}
              </button>
            </div>
          }
        >
          {shopStock.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-500">Stock vide — rotation horaire ou rafraîchis.</div>
          ) : (
            <div className="space-y-1">
              {shopStock.map((item) => {
                const r = RARITIES[item.rarity]
                const price = shopBuyPrice(item)
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-black/20 py-1 pl-1.5 pr-1" style={{ borderLeft: `3px solid ${r.color}` }}>
                    <span>{ITEM_TYPES[item.type].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className={'block truncate text-[12px] font-medium ' + rarityNameClass(item.rarity)} style={rarityTextStyle(item.rarity)}>
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
        <Section
          title="🔄 Comptoir d'échange"
          accent="text-cyan-300"
          action={
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-500">Quantité</span>
              {[1, 10, 100].map((q) => (
                <button
                  key={q}
                  onClick={() => setQty(q)}
                  className={'rounded px-1.5 py-0.5 font-medium ' + (qty === q ? 'bg-cyan-600 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
                >
                  ×{q}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <ExchangeBtn label={`+${(EXCHANGE_RATES.eclatsBatch * qty).toLocaleString('fr-FR')} ♦ éclats`} cost={EXCHANGE_RATES.eclatGoldCost * qty} gold={gold} onClick={() => buyEclats(qty)} />
            <ExchangeBtn label={`+${qty} 🔑 Sceau${qty > 1 ? 'x' : ''} de faille`} cost={EXCHANGE_RATES.sceauGold * qty} gold={gold} onClick={() => buyResource('sceau', qty)} />
            <ExchangeBtn label={`+${qty} 🔮 Orbe${qty > 1 ? 's' : ''} de raid`} cost={EXCHANGE_RATES.orbeGold * qty} gold={gold} onClick={() => buyResource('orbe', qty)} />
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
                  const pous = upgradePoussiere(u, level)
                  const ecl = upgradeEclats(u, level)
                  return (
                    <div key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-black/20 px-2 py-1">
                      <span>{u.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-200">{u.name} <span className="text-slate-500">Niv. {level}{u.maxLevel ? `/${u.maxLevel}` : ''}</span></span>
                        <span className="block truncate text-[9px] text-slate-500">{u.description}</span>
                      </span>
                      <button onClick={() => buyUpgrade(u.id)} disabled={maxed || gold < cost || poussiere < pous || essence < ecl} className="shrink-0 rounded bg-emerald-800/60 px-2 py-1 text-[10px] font-medium hover:bg-emerald-700 disabled:opacity-40">
                        {maxed ? 'Max' : <>💰 {cost.toLocaleString('fr-FR')}{ecl ? <span className={essence >= ecl ? '' : 'text-red-400'}> ♦{ecl}</span> : null}{pous ? ` 🌌${pous}` : ''}</>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {characters.length < 3 && (
            <button onClick={recruitCharacter} disabled={gold < recruitCost || poussiere < recruitPoussiere} className="mt-1 w-full rounded-lg bg-indigo-800/50 py-2 text-[11px] font-medium text-indigo-200 hover:bg-indigo-700/60 disabled:opacity-40">
              🧑‍🤝‍🧑 Recruter un {characters.length === 1 ? '2ᵉ' : '3ᵉ'} personnage · 💰 {recruitCost.toLocaleString('fr-FR')}{recruitPoussiere ? ` + 🌌 ${recruitPoussiere}` : ''}
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
