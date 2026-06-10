import { useState } from 'react'
import { useGame, MYSTERY_BOXES, EXCHANGE_RATES, RECRUIT_COST, RECRUIT_POUSSIERE, type MysteryBox } from '../game/store'
import { UPGRADES, UPGRADE_CATEGORIES, upgradeCost, upgradePoussiere, upgradeEclats, isMaxed, type UpgradeCategory } from '../game/upgrades'
import { RARITY_LIST } from '../game/rarities'
import { SubTab } from './ui'

/** Badge de « promesse » du coffre (build / slot / affixe / défense / matériaux). */
function boxTag(b: MysteryBox): { label: string; cls: string } | null {
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

/** Gammes de coffres : groupage par prix — la pile de 12 devient 3 rayons lisibles. */
const BOX_GROUPS: { title: string; hint?: string; test: (b: MysteryBox) => boolean }[] = [
  { title: '💼 Gamme de départ', test: (b) => b.gold <= 1000 },
  { title: '🎯 Coffres spécialisés', hint: 'Cible un type de stuff précis', test: (b) => b.gold > 1000 && b.gold < 200000 },
  { title: '🌟 Gamme prestige', hint: 'Très chers, très puissants', test: (b) => b.gold >= 200000 },
]

export function MerchantPanel() {
  const gold = useGame((s) => s.gold)
  const essence = useGame((s) => s.essence)
  const poussiere = useGame((s) => s.poussiere)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const upgrades = useGame((s) => s.upgrades)
  const characters = useGame((s) => s.characters)
  const mysteryBox = useGame((s) => s.mysteryBox)
  const buyEclats = useGame((s) => s.buyEclats)
  const buyResource = useGame((s) => s.buyResource)
  const buyUpgrade = useGame((s) => s.buyUpgrade)
  const recruitCharacter = useGame((s) => s.recruitCharacter)

  const [sub, setSub] = useState<'coffres' | 'echange' | 'ameliorations'>('coffres')
  const [qty, setQty] = useState(1)

  const recruitIdx = characters.length - 1
  const recruitCost = RECRUIT_COST[recruitIdx] ?? 250000
  const recruitPoussiere = RECRUIT_POUSSIERE[recruitIdx] ?? 0

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
              Chaque coffre tire une <b className="text-slate-300">fourchette de rareté</b> (pas une rareté fixe) avec
              une petite chance de <b className="text-fuchsia-300">jackpot</b> au-dessus. Plus c'est cher, plus c'est fort.
            </p>
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
                    {boxes.map((b) => <BoxCard key={b.id} box={b} gold={gold} fragments={fragments} cosmic={cosmic} onBuy={() => mysteryBox(b.id)} />)}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {sub === 'echange' && (
          <>
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
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <ExchangeBtn label={`+${(EXCHANGE_RATES.eclatsBatch * qty).toLocaleString('fr-FR')} ♦ éclats`} cost={EXCHANGE_RATES.eclatGoldCost * qty} gold={gold} onClick={() => buyEclats(qty)} />
              <ExchangeBtn label={`+${qty} 🔑 Sceau${qty > 1 ? 'x' : ''} de faille`} cost={EXCHANGE_RATES.sceauGold * qty} gold={gold} onClick={() => buyResource('sceau', qty)} />
              <ExchangeBtn label={`+${qty} 🔮 Orbe${qty > 1 ? 's' : ''} de raid`} cost={EXCHANGE_RATES.orbeGold * qty} gold={gold} onClick={() => buyResource('orbe', qty)} />
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

/** Carte d'un coffre — « scellée » tant que sa monnaie exotique est inconnue du joueur (teaser). */
function BoxCard({ box: b, gold, fragments, cosmic, onBuy }: {
  box: MysteryBox
  gold: number
  fragments: number
  cosmic: number
  onBuy: () => void
}) {
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
  const minName = RARITY_LIST.find((r) => r.tier === b.minTier)
  const maxName = RARITY_LIST.find((r) => r.tier === b.maxTier)
  const affordable = gold >= b.gold && fragments >= (b.costFragments ?? 0) && cosmic >= (b.costCosmic ?? 0)
  const tag = boxTag(b)
  return (
    <button
      disabled={!affordable}
      onClick={onBuy}
      title={b.desc}
      className="flex items-center gap-2 rounded-lg border border-fuchsia-700/40 bg-fuchsia-950/20 p-2 text-left hover:bg-fuchsia-900/30 disabled:opacity-40"
    >
      <span className="text-2xl">{b.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-fuchsia-200">{b.name}</span>
          {tag && <span className={'shrink-0 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide ' + tag.cls}>{tag.label}</span>}
        </span>
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
}

function ExchangeBtn({ label, cost, gold, onClick }: { label: string; cost: number; gold: number; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={gold < cost} className="flex flex-col items-center gap-0.5 rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-2.5 hover:bg-cyan-900/30 disabled:opacity-40">
      <span className="text-[11px] font-medium text-cyan-200">{label}</span>
      <span className="text-[11px] text-yellow-400">💰 {cost.toLocaleString('fr-FR')}</span>
    </button>
  )
}
