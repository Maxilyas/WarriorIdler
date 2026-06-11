import { useState } from 'react'
import {
  useGame, MYSTERY_BOXES, MARKET_TRADES, TRADE_RES_META, FREE_BOX_COOLDOWN_MS,
  BOX_BULK_QTY, BOX_BULK_DISCOUNT, BOX_PITY_STEP, BOX_PITY_CAP,
  RECRUIT_COST, RECRUIT_POUSSIERE, type MysteryBox, type ResourceTrade, type TradeRes,
} from '../game/store'
import { UPGRADES, UPGRADE_CATEGORIES, upgradeCost, upgradePoussiere, upgradeEclats, isMaxed, type UpgradeCategory } from '../game/upgrades'
import { RARITY_LIST } from '../game/rarities'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import type { DamageType } from '../game/types'
import { SubTab } from './ui'

/** Badge de « promesse » du coffre (gratuit / gamble / choix / build / slot / affixe / défense / matériaux). */
function boxTag(b: MysteryBox): { label: string; cls: string } | null {
  if (b.free) return { label: '🗓️ Gratuit · 22 h', cls: 'bg-emerald-500/20 text-emerald-200' }
  if (b.cursed) return { label: '🎲 Gamble', cls: 'bg-purple-500/20 text-purple-200' }
  if (b.choice) return { label: '🎭 1 sur 3', cls: 'bg-fuchsia-500/20 text-fuchsia-200' }
  if (b.elementPick) return { label: '🔥 Élément au choix', cls: 'bg-orange-500/20 text-orange-200' }
  if (b.weakest) return { label: '🧩 Maillon faible', cls: 'bg-cyan-500/20 text-cyan-200' }
  if (b.collector) return { label: '📖 Unique inédit', cls: 'bg-fuchsia-500/20 text-fuchsia-200' }
  if ((b.sceaux ?? 0) > 0 || (b.orbes ?? 0) > 0) return { label: '🗝️ Clés', cls: 'bg-amber-500/20 text-amber-200' }
  if ((b.gemDust ?? 0) > 0) return { label: '💎 Gemmes', cls: 'bg-sky-500/20 text-sky-200' }
  if (b.primary) return { label: b.primary === 'force' ? '⚔ FORCE' : b.primary === 'agilite' ? '🏹 AGILITÉ' : '🔮 INTEL', cls: 'bg-orange-500/20 text-orange-200' }
  if (b.guaranteeAffix) return { label: '🎯 Crit garanti', cls: 'bg-rose-500/20 text-rose-200' }
  if (b.biasResist) return { label: '🛡 Défense', cls: 'bg-sky-500/20 text-sky-200' }
  if (b.types?.includes('armePrincipale')) return { label: '⚔ Armes', cls: 'bg-amber-500/20 text-amber-200' }
  if (b.types?.includes('tete')) return { label: '🥋 Armures', cls: 'bg-amber-500/20 text-amber-200' }
  if (b.types?.includes('anneau')) return { label: '💍 Bijoux', cls: 'bg-amber-500/20 text-amber-200' }
  if ((b.noyau ?? 0) > 0 && b.count <= 1) return { label: '🔨 Matériaux', cls: 'bg-emerald-500/20 text-emerald-200' }
  if (b.guaranteeUnique) return { label: '✦ Unique garanti', cls: 'bg-fuchsia-500/20 text-fuchsia-200' }
  return null
}

/** Gammes de coffres : groupage par prix — la pile devient des rayons lisibles. */
const BOX_GROUPS: { title: string; hint?: string; test: (b: MysteryBox) => boolean }[] = [
  { title: '💼 Gamme de départ', test: (b) => b.gold <= 1000 },
  { title: '🎯 Coffres spécialisés', hint: 'Cible un type de stuff précis', test: (b) => b.gold > 1000 && b.gold < 200000 },
  { title: '🌟 Gamme prestige', hint: 'Très chers, très puissants', test: (b) => b.gold >= 200000 },
]

export function MerchantPanel() {
  const gold = useGame((s) => s.gold)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const poussiere = useGame((s) => s.poussiere)
  const sceaux = useGame((s) => s.sceaux)
  const orbes = useGame((s) => s.orbes)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const gemDust = useGame((s) => s.gemDust)
  const bestStage = useGame((s) => s.bestStage)
  const lastFreeBox = useGame((s) => s.lastFreeBox)
  const boxPity = useGame((s) => s.boxPity)
  const upgrades = useGame((s) => s.upgrades)
  const characters = useGame((s) => s.characters)
  const mysteryBox = useGame((s) => s.mysteryBox)
  const tradeResource = useGame((s) => s.tradeResource)
  const buyUpgrade = useGame((s) => s.buyUpgrade)
  const recruitCharacter = useGame((s) => s.recruitCharacter)

  const [sub, setSub] = useState<'coffres' | 'echange' | 'ameliorations'>('coffres')
  const [qty, setQty] = useState(1)
  const [boxQty, setBoxQty] = useState(1)

  const recruitIdx = characters.length - 1
  const recruitCost = RECRUIT_COST[recruitIdx] ?? 250000
  const recruitPoussiere = RECRUIT_POUSSIERE[recruitIdx] ?? 0

  const pityBonus = Math.min(BOX_PITY_CAP, boxPity * BOX_PITY_STEP)
  const balances: Record<TradeRes, number> = { gold, essence, noyau, poussiere, sceaux, orbes, fragments, cosmic, gemDust }
  const trades = MARKET_TRADES.filter((t) => bestStage >= (t.unlockStage ?? 0))

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">🏪 Marchand</div>
        <div className="text-xs text-yellow-400">💰 {gold.toLocaleString('fr-FR')} or</div>
      </div>

      <div className="mb-2 flex gap-1.5">
        <SubTab on={sub === 'coffres'} onClick={() => setSub('coffres')}>🎁 Coffres</SubTab>
        <SubTab on={sub === 'echange'} onClick={() => setSub('echange')}>🔄 Échange</SubTab>
        <SubTab on={sub === 'ameliorations'} onClick={() => setSub('ameliorations')}>⬆️ Améliorations</SubTab>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {sub === 'coffres' && (
          <>
            <p className="mb-2 text-[10px] leading-snug text-slate-500">
              Chaque coffre tire une <b className="text-slate-300">fourchette de rareté</b> avec une petite chance
              de <b className="text-fuchsia-300">jackpot</b> au-dessus. Plus c'est cher, plus c'est fort.
            </p>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-500" title="Achat en gros : ×5 d'un coup = -10% d'or">📦</span>
                {[1, BOX_BULK_QTY].map((q) => (
                  <button
                    key={q}
                    onClick={() => setBoxQty(q)}
                    className={'rounded px-2.5 py-1.5 font-medium ' + (boxQty === q ? 'bg-fuchsia-600 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
                  >
                    ×{q}{q >= BOX_BULK_QTY ? ` (-${Math.round((1 - BOX_BULK_DISCOUNT) * 100)}%)` : ''}
                  </button>
                ))}
              </div>
              <span
                className={'rounded px-1.5 py-0.5 text-[9.5px] ' + (pityBonus > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-600')}
                title="Karma du marchand : chaque coffre ouvert sans jackpot augmente la chance de jackpot du suivant (+1%/coffre, max +25%). Reset au jackpot."
              >
                🍀 Karma : +{Math.round(pityBonus * 100)}% jackpot
              </span>
            </div>
            {BOX_GROUPS.map((g) => {
              const boxes = MYSTERY_BOXES.filter(g.test)
              if (boxes.length === 0) return null
              return (
                <div key={g.title} className="mb-3">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.title}</span>
                    {g.hint && <span className="text-[9px] text-slate-600">{g.hint}</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {boxes.map((b) => (
                      <BoxCard
                        key={b.id}
                        box={b}
                        gold={gold}
                        fragments={fragments}
                        cosmic={cosmic}
                        qty={boxQty}
                        bestStage={bestStage}
                        lastFreeBox={lastFreeBox}
                        onBuy={(element) => mysteryBox(b.id, { qty: boxQty, ...(element ? { element } : {}) })}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {sub === 'echange' && (
          <>
            <p className="mb-2 text-[10px] leading-snug text-slate-500">
              Troc de ressources <b className="text-slate-300">taxé</b> (aller-retour ≈ ÷4) : un dépannage, jamais
              l'optimum. L'<b className="text-teal-300">Alchimiste ◈ Transmutateur</b> convertit à de bien meilleurs taux.
            </p>
            <div className="mb-2 flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-500">Quantité</span>
              {[1, 10, 100].map((q) => (
                <button
                  key={q}
                  onClick={() => setQty(q)}
                  className={'rounded px-2.5 py-1.5 font-medium ' + (qty === q ? 'bg-cyan-600 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
                >
                  ×{q}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {trades.map((t) => (
                <TradeBtn key={t.id} trade={t} qty={qty} have={balances[t.from.res]} onClick={() => tradeResource(t.id, qty)} />
              ))}
            </div>
          </>
        )}

        {sub === 'ameliorations' && (
          <>
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
                        <button onClick={() => buyUpgrade(u.id)} disabled={maxed || gold < cost || poussiere < pous || essence < ecl} className="shrink-0 rounded bg-emerald-800/60 px-2.5 py-1.5 text-[10px] font-medium hover:bg-emerald-700 disabled:opacity-40">
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
          </>
        )}
      </div>
    </div>
  )
}

/** Compte à rebours court « 21h04 » du Coffre du Jour. */
function fmtCooldown(ms: number): string {
  const m = Math.ceil(ms / 60000)
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Carte d'un coffre — « scellée » tant que sa monnaie exotique est inconnue du joueur (teaser). */
function BoxCard({ box: b, gold, fragments, cosmic, qty, bestStage, lastFreeBox, onBuy }: {
  box: MysteryBox
  gold: number
  fragments: number
  cosmic: number
  qty: number
  bestStage: number
  lastFreeBox: number
  onBuy: (element?: DamageType) => void
}) {
  const [el, setEl] = useState<DamageType>('feu')
  const needsExotic = (b.costFragments ?? 0) > 0 || (b.costCosmic ?? 0) > 0
  const sealed = needsExotic && fragments === 0 && cosmic === 0
  if (sealed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0c0f17] p-2 opacity-60">
        <span className="text-2xl grayscale">🔒</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-slate-500">Coffre scellé</span>
          <span className="block text-[9px] text-slate-600">
            Exige des {(b.costCosmic ?? 0) > 0 ? '💫 Éclats cosmiques' : '✨ Fragments d\'éternité'} — récompenses de ☠️ raid.
          </span>
        </span>
      </div>
    )
  }
  // Gratuit / Destin : toujours à l'unité. Les autres profitent de l'achat en gros (-10% à ×5).
  const effQty = b.free || b.choice ? 1 : qty
  const goldCost = Math.round(b.gold * effQty * (effQty >= BOX_BULK_QTY ? BOX_BULK_DISCOUNT : 1))
  const fragCost = (b.costFragments ?? 0) * effQty
  const cosmicCost = (b.costCosmic ?? 0) * effQty
  const cooldownLeft = b.free ? Math.max(0, FREE_BOX_COOLDOWN_MS - (Date.now() - lastFreeBox)) : 0
  const affordable = gold >= goldCost && fragments >= fragCost && cosmic >= cosmicCost && cooldownLeft === 0
  const minName = RARITY_LIST.find((r) => r.tier === b.minTier)
  const maxName = RARITY_LIST.find((r) => r.tier === b.maxTier)
  const tag = boxTag(b)
  return (
    <button
      disabled={!affordable}
      onClick={() => onBuy(b.elementPick ? el : undefined)}
      title={b.desc}
      className="flex items-center gap-2 rounded-lg border border-fuchsia-700/40 bg-fuchsia-950/20 p-2 text-left hover:bg-fuchsia-900/30 disabled:opacity-40"
    >
      <span className="text-2xl">{b.elementPick ? DAMAGE_TYPES[el].icon : b.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-fuchsia-200">{b.name}</span>
          {tag && <span className={'shrink-0 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide ' + tag.cls}>{tag.label}</span>}
        </span>
        {b.count > 0 ? (
          <span className="block truncate text-[9px]">
            <span style={{ color: minName?.color }}>{minName?.name}</span>
            <span className="text-slate-600"> → </span>
            <span style={{ color: maxName?.color }}>{maxName?.name}</span>
            <span className="text-slate-500"> · {b.count * (b.cursed ? 2 : 1) * effQty} obj{b.cursed ? ' ou 1' : ''}{b.choice ? ' · 1 gardé' : ''}{b.guaranteeUnique ? ' · ✦' : ''}</span>
          </span>
        ) : (
          <span className="block truncate text-[9px] text-slate-400">
            {(b.sceaux ?? 0) > 0 && <>🔑 {(b.sceaux ?? 0) * effQty} + 🔮 {(b.orbes ?? 0) * effQty}</>}
            {(b.gemDust ?? 0) > 0 && <>🔹 ~{Math.round((b.gemDust ?? 0) * (1 + bestStage / 50)) * effQty} + {Math.round((b.gemChance ?? 0) * 100)}% 💎</>}
          </span>
        )}
        {b.elementPick && (
          <span className="mt-0.5 flex gap-1">
            {DAMAGE_TYPE_LIST.map((t) => (
              <span
                key={t}
                onClick={(e) => { e.stopPropagation(); setEl(t) }}
                title={DAMAGE_TYPES[t].name}
                className={'cursor-pointer rounded px-1 py-px text-[11px] ' + (el === t ? 'bg-orange-500/40 ring-1 ring-orange-300' : 'bg-slate-800/80 opacity-60 hover:opacity-100')}
              >
                {DAMAGE_TYPES[t].icon}
              </span>
            ))}
          </span>
        )}
        <span className="block text-[11px] font-medium">
          {b.free ? (
            cooldownLeft > 0
              ? <span className="text-slate-500">⏳ Reviens dans {fmtCooldown(cooldownLeft)}</span>
              : <span className="text-emerald-300">GRATUIT !</span>
          ) : (
            <span className="text-yellow-400">💰 {goldCost.toLocaleString('fr-FR')}{effQty > 1 ? ` (×${effQty})` : ''}</span>
          )}
          {fragCost ? <span className={fragments >= fragCost ? 'text-sky-300' : 'text-red-400'}> · ✨ {fragCost}</span> : null}
          {cosmicCost ? <span className={cosmic >= cosmicCost ? 'text-violet-300' : 'text-red-400'}> · 💫 {cosmicCost}</span> : null}
        </span>
      </span>
    </button>
  )
}

function TradeBtn({ trade: t, qty, have, onClick }: { trade: ResourceTrade; qty: number; have: number; onClick: () => void }) {
  const fm = TRADE_RES_META[t.from.res]
  const tm = TRADE_RES_META[t.to.res]
  const cost = t.from.amt * qty
  const gain = t.to.amt * qty
  return (
    <button
      onClick={onClick}
      disabled={have < cost}
      title={`${fm.icon} ${fm.name} → ${tm.icon} ${tm.name}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-cyan-800/50 bg-cyan-950/20 px-2.5 py-2 hover:bg-cyan-900/30 disabled:opacity-40"
    >
      <span className={'text-[11px] font-medium ' + (have >= cost ? 'text-slate-200' : 'text-red-400')}>
        {fm.icon} {cost.toLocaleString('fr-FR')}
      </span>
      <span className="text-[10px] text-slate-600">→</span>
      <span className="text-[11px] font-medium text-cyan-200">{tm.icon} {gain.toLocaleString('fr-FR')}</span>
    </button>
  )
}
