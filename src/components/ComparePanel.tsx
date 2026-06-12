import { useState } from 'react'
import type { Item, EquipSlotId, StatKey, Affix, DamageType, Character } from '../game/types'
import { equipDelta, type EquipDelta } from '../game/character'
import { RARITIES } from '../game/rarities'
import { ALL_STAT_META } from '../game/stats'
import {
  sellValue, recycleValue, itemStatBlock, itemHasRareStat,
  reforgeCost, surillvlCost, ascendCost, nextRarity, transmuteCost, craftRaidGate,
  quintCost, QUINT_GAIN,
} from '../game/items'
import { craftMods } from '../game/metiers'
import { itemSockets, unsocketCost } from '../game/gems'
import { getCondGem, parseCondKey, gemDesc, gemValue, gemMaxRank, recutCost, GEM_FAMILIES } from '../game/condGems'
import { getSet } from '../game/sets'
import { ENCHANTS, getEnchant, enchantCost } from '../game/enchants'
import type { OffensiveStat } from '../game/types'
import { ITEM_TYPES, equipSlotsForType } from '../game/slots'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import {
  getUnique, uniqueActiveText, isUniqueActive, instanceMods, instanceResist, upgradeCost, insertCost,
  UNIQUE_EFFECTS, UNIQUE_ROLES, UNIQUE_MAX_RANK, UNIQUE_ACTIVE_RANK,
} from '../game/uniques'
import type { UniqueRole } from '../game/types'
import { useGame, FRAGMENT_INFUSE_COST, CHOOSE_UNIQUE_COST, bestRaidTier } from '../game/store'
import { rarityTextStyle, rarityCardStyle, rarityNameClass } from './rarityStyle'

/** Libellé/couleur d'affichage d'une ligne d'objet (stat / dégâts / résistance). */
function affixLabel(a: Affix): { name: string; color: string; pct: boolean } {
  if (a.kind === 'stat' && a.stat) { const m = ALL_STAT_META[a.stat]; return { name: m.name, color: m.color, pct: false } }
  if (a.kind === 'dmgType' && a.type) { const m = DAMAGE_TYPES[a.type]; return { name: `Dégâts ${m.name}`, color: m.color, pct: true } }
  // v0.24 : la résistance est en POINTS (plus en %) → pas de suffixe « % ».
  if (a.kind === 'resist' && a.type) { const m = DAMAGE_TYPES[a.type]; return { name: `Résist. ${m.name}`, color: m.color, pct: false } }
  return { name: '?', color: '#94a3b8', pct: false }
}

/** Δ signé compact : +1,2k / −340. */
function fmtSigned(n: number): string {
  const a = Math.abs(n)
  const v = a >= 10000 ? `${Math.round(a / 1000)}k` : a >= 1000 ? `${(a / 1000).toFixed(1).replace('.', ',')}k` : `${Math.round(a)}`
  return (n >= 0 ? '+' : '−') + v
}

interface Props {
  item: Item
  /** Personnage actif : sert au calcul du Δ DPS / Δ PV réel (swap simulé). */
  char: Character
  /** Δ pré-calculé pour l'emplacement cible automatique (absent si l'objet est déjà équipé). */
  previewDelta?: EquipDelta
  equipped?: Item
  /** Emplacements occupés (pour indiquer l'objet déjà en place sur chaque bouton). */
  occupied: Partial<Record<EquipSlotId, Item>>
  onEquip: (slot: EquipSlotId) => void
  onSell: () => void
  onRecycle: () => void
  onClose?: () => void
  /** Si défini, l'objet est actuellement équipé sur ce slot (affiche « Retirer »). */
  equippedSlot?: EquipSlotId
  onUnequip?: () => void
}

export function ComparePanel({ item, char, previewDelta, equipped, occupied, onEquip, onSell, onRecycle, onClose, equippedSlot, onUnequip }: Props) {
  const rarity = RARITIES[item.rarity]
  const type = ITEM_TYPES[item.type]
  const slots = equipSlotsForType(item.type)
  const isEquipped = !!equippedSlot

  // Pas de comparaison si l'objet est déjà équipé (il se comparerait à lui-même).
  const cmp = isEquipped ? undefined : equipped
  const cur = itemStatBlock(item)
  const old = cmp ? itemStatBlock(cmp) : {}
  const keys = orderedKeys(cur, old)

  return (
    <div className="flex flex-col rounded-xl border p-3" style={rarityCardStyle(item.rarity)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span>{type.icon}</span>
            <span
              className={'truncate text-sm font-bold ' + rarityNameClass(item.rarity)}
              style={rarityTextStyle(item.rarity)}
            >
              {item.name}
            </span>
            {itemHasRareStat(item) && <span title="Stat RARE">💎</span>}
          </div>
          <div className="text-[10px] text-slate-400">
            <span style={{ color: rarity.color }}>{rarity.name}</span> · {type.name} · iLvl {item.ilvl}
            {' · '}
            <span className={item.orientation === 'offensif' ? 'text-rose-300' : item.orientation === 'defensif' ? 'text-emerald-300' : 'text-slate-300'}>
              {item.orientation === 'offensif' ? '⚔ Offensif' : item.orientation === 'defensif' ? '🛡 Défensif' : '⚖ Équilibré'}
            </span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-slate-400 hover:bg-slate-700">
            ✕
          </button>
        )}
      </div>

      {/* Objet(s) équipé(s) : pour les anneaux/bijoux (2 slots) on montre LES DEUX, avec leur emplacement. */}
      {!isEquipped && (() => {
        const occHere = slots
          .map((s) => ({ slot: s, it: occupied[s.id] }))
          .filter((x): x is { slot: (typeof slots)[number]; it: Item } => !!x.it)
        if (occHere.length === 0) return null
        return <>{occHere.map(({ slot, it }) => <EquippedSummary key={slot.id} item={it} slotName={slots.length > 1 ? slot.name : undefined} />)}</>
      })()}

      {/* Tableau de comparaison */}
      <div className="mt-2 overflow-hidden rounded-lg bg-black/30 text-[12px]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2.5 py-1 text-[9px] uppercase tracking-wide text-slate-500">
          <span>Stat</span>
          <span className="text-right">Cet objet</span>
          <span className="w-12 text-right">Équipé</span>
        </div>
        {keys.map((k) => {
          const meta = ALL_STAT_META[k]
          const a = cur[k] ?? 0
          const b = old[k] ?? 0
          const d = a - b
          return (
            <div key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-2.5 py-0.5">
              <span style={{ color: meta.color }} className="truncate">{meta.rare ? '💎 ' : ''}{meta.name}</span>
              <span className="text-right tabular-nums text-slate-200">
                {a ? a.toLocaleString('fr-FR') : '—'}
                {cmp && d !== 0 && (
                  <span className={d > 0 ? ' text-emerald-400' : ' text-red-400'}>
                    {' '}{d > 0 ? '▲' : '▼'}{Math.abs(d).toLocaleString('fr-FR')}
                  </span>
                )}
              </span>
              <span className="w-12 text-right tabular-nums text-slate-500">{b ? b.toLocaleString('fr-FR') : '—'}</span>
            </div>
          )
        })}
      </div>

      {/* L'IMPACT RÉEL : Δ DPS / Δ PV si on équipe (swap simulé — la vraie métrique d'arbitrage) */}
      {!isEquipped && previewDelta && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
          <div className={'rounded-lg py-1.5 text-[13px] font-bold tabular-nums ' + (previewDelta.dps >= 0 ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300')}>
            ⚔ {fmtSigned(previewDelta.dps)} DPS
          </div>
          <div className={'rounded-lg py-1.5 text-[13px] font-bold tabular-nums ' + (previewDelta.hp >= 0 ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300')}>
            ❤️ {fmtSigned(previewDelta.hp)} PV
          </div>
        </div>
      )}
      {isEquipped && <div className="mt-1.5 text-center text-[11px] text-amber-300">Actuellement équipé</div>}

      {/* Type d'arme + lignes de dégâts/résistances de type */}
      {(item.damageType || item.affixes.some((a) => a.kind !== 'stat')) && (
        <div className="mt-2 space-y-0.5 rounded-lg bg-black/20 p-2 text-[11.5px]">
          {item.damageType && (
            <div>
              <span className="text-slate-500">Type d'arme : </span>
              <span style={{ color: DAMAGE_TYPES[item.damageType].color }}>
                {DAMAGE_TYPES[item.damageType].icon} {DAMAGE_TYPES[item.damageType].name}
              </span>
            </div>
          )}
          {item.affixes.filter((a) => a.kind !== 'stat').map((a, i) => {
            const m = a.type ? DAMAGE_TYPES[a.type] : null
            const up = a.upgraded ?? 0
            return (
              <div key={i} className="flex items-center gap-1" style={{ color: m?.color }}>
                <span style={up > 0 ? { textShadow: `0 0 6px ${m?.color}` } : undefined}>
                  {a.kind === 'resist' ? `🛡 +${a.value} résistance` : `${m?.icon} +${a.value}% dégâts`} {m?.name}
                </span>
                {up > 0 && (
                  <span className="rounded-full bg-emerald-500/20 px-1 text-[8.5px] font-bold text-emerald-300 ring-1 ring-emerald-400/40" title={`Renforcé ${up}× à la Quintessence`}>
                    ⚗️+{up}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pièce de set (Régalia du Néant…) */}
      {item.setId && <SetBlock item={item} char={char} />}

      {/* Effet unique */}
      {item.unique && <UniqueBlock item={item} />}

      {!isEquipped && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>💰 <span className="text-yellow-400">{sellValue(item)}</span></span>
          <span>♻️ <span className="text-cyan-300">{recycleValue(item)} éclats</span></span>
        </div>
      )}

      {/* Actions : retirer (si équipé) ou équiper/vendre/recycler */}
      <div className="mt-2 space-y-1.5">
        {isEquipped ? (
          <button onClick={onUnequip} className="w-full rounded-lg bg-slate-700 py-2.5 text-xs font-semibold hover:bg-slate-600">
            Retirer
          </button>
        ) : (
          <>
            {slots.map((slot) => {
              const inPlace = occupied[slot.id]
              const d = equipDelta(char, item, slot.id)
              return (
                <button
                  key={slot.id}
                  onClick={() => onEquip(slot.id)}
                  className="flex w-full items-center justify-between rounded-lg bg-emerald-700/80 px-3 py-2.5 text-xs font-semibold hover:bg-emerald-600"
                >
                  <span>Équiper · {slot.name}</span>
                  <span className="text-[10px] font-normal text-emerald-200/80">
                    {inPlace ? `remplace ${RARITIES[inPlace.rarity].name} ` : 'vide '}
                    <span className={'font-bold tabular-nums ' + (d.dps >= 0 ? 'text-emerald-300' : 'text-red-300')}>{d.dps >= 0 ? '▲' : '▼'}{fmtSigned(d.dps)} DPS</span>
                  </span>
                </button>
              )
            })}
            <div className="flex gap-1.5">
              <button onClick={onSell} className="flex-1 rounded-lg bg-yellow-800/60 py-2 text-xs hover:bg-yellow-700/70">
                Vendre
              </button>
              <button onClick={onRecycle} className="flex-1 rounded-lg bg-cyan-800/60 py-2 text-xs hover:bg-cyan-700/70">
                Recycler
              </button>
            </div>
          </>
        )}
      </div>

      {/* key=id : les verrous de reforge ne survivent pas au changement d'objet */}
      <CraftSection key={item.id} item={item} />
    </div>
  )
}

/** Atelier d'amélioration : reforge (avec verrous), surillvl, ascension de rareté. */
function CraftSection({ item }: { item: Item }) {
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const fragments = useGame((s) => s.fragments)
  const poussiere = useGame((s) => s.poussiere)
  const cosmic = useGame((s) => s.cosmic)
  const reforge = useGame((s) => s.reforge)
  const surillvl = useGame((s) => s.surillvl)
  const ascend = useGame((s) => s.ascend)
  const infuseUnique = useGame((s) => s.infuseUnique)
  const transmute = useGame((s) => s.transmute)
  const mods = craftMods(useGame((s) => s.metiers))
  const raidProgress = useGame((s) => s.raidProgress)
  const [open, setOpen] = useState(false)
  const [locked, setLocked] = useState<number[]>([])
  const cm = mods.costMult
  const tCost = Math.round(transmuteCost(item) * cm)
  const OFFENSIVE: OffensiveStat[] = ['force', 'agilite', 'intelligence']

  // v0.25 : le prix de la reforge suit les VERROUS posés et les reforges déjà faites sur l'objet.
  const rCost = Math.round(reforgeCost(item, locked.length) * cm)
  const sCost = Math.round(surillvlCost(item) * cm)
  const rawA = ascendCost(item)
  const aCost = { eclats: Math.round(rawA.eclats * cm), noyau: Math.round(rawA.noyau * cm), fragments: Math.round((rawA.fragments ?? 0) * cm), poussiere: Math.round((rawA.poussiere ?? 0) * cm), cosmic: Math.round((rawA.cosmic ?? 0) * cm) }
  const nr = nextRarity(item.rarity)
  // v0.25 : verrou raid sur l'Ascension (miroir du craft) — tier cible − 8.
  const ascGate = nr ? craftRaidGate(RARITIES[nr].tier) : 0
  const ascRaidOk = ascGate <= bestRaidTier(raidProgress)
  const Locked = ({ label, metier }: { label: string; metier: string }) => (
    <div className="rounded border border-slate-800 bg-black/20 py-1.5 text-center text-[10px] text-slate-500">🔒 {label} — à apprendre dans l'arbre du {metier} (onglet 🔨 Atelier)</div>
  )

  const toggle = (i: number) => setLocked((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]))
  // Reforge en chaîne : les affixes conservés (verrous + lignes Quintessence) passent en TÊTE du
  // nouveau tableau — on remappe les indices verrouillés pour que les cadenas restent posés.
  const reforgeKeepingLocks = () => {
    const enhanced = item.affixes.map((a, i) => ((a.upgraded ?? 0) > 0 ? i : -1)).filter((i) => i >= 0)
    const kept = [...new Set([...locked, ...enhanced])].sort((a, b) => a - b)
    reforge(item.id, locked)
    setLocked(locked.map((i) => kept.indexOf(i)))
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-800/40 bg-amber-950/10 p-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[11px] font-semibold text-amber-300">
        <span>🔨 Atelier — améliorer</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {item.affixes.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] text-slate-500">Verrouille les affixes à conserver, puis reforge le reste :</div>
              <div className="flex flex-wrap gap-1">
                {item.affixes.map((a, i) => {
                  const lbl = affixLabel(a)
                  const isL = locked.includes(i)
                  return (
                    <button
                      key={i}
                      onClick={() => toggle(i)}
                      className={'rounded border px-2 py-1 text-[10px] ' + (isL ? 'border-amber-400 bg-amber-900/40 text-amber-200' : 'border-slate-700 text-slate-400')}
                      style={{ color: isL ? undefined : lbl.color }}
                    >
                      {isL ? '🔒 ' : ''}{lbl.name} +{a.value}{lbl.pct ? '%' : ''}
                    </button>
                  )
                })}
              </div>
              <button
                disabled={essence < rCost}
                onClick={reforgeKeepingLocks}
                className="mt-1.5 w-full rounded bg-amber-800/60 py-2 text-[11px] font-medium hover:bg-amber-700/70 disabled:opacity-40"
              >
                Reforge les affixes · ♦ {rCost}
              </button>
            </div>
          )}

          {mods.surillvl ? (
            <button
              disabled={essence < sCost}
              onClick={() => surillvl(item.id)}
              className="w-full rounded bg-amber-800/60 py-2 text-[11px] font-medium hover:bg-amber-700/70 disabled:opacity-40"
            >
              Surillvl → iLvl {item.ilvl + mods.surillvlStep} · ♦ {sCost}
            </button>
          ) : <Locked label="Surillvl" metier="Forgeron" />}

          {/* Transmuter l'affinité (Force/Agi/Int) */}
          {mods.transmute ? (
            <div>
              <div className="mb-1 text-[10px] text-slate-500">Transmuter l'affinité · ♦ {tCost} :</div>
              <div className="grid grid-cols-3 gap-1">
                {OFFENSIVE.map((p) => {
                  const m = ALL_STAT_META[p]
                  const cur = item.primary === p
                  return (
                    <button
                      key={p}
                      disabled={cur || essence < tCost}
                      onClick={() => transmute(item.id, p)}
                      className="rounded border border-slate-700 py-1.5 text-[10px] font-medium disabled:opacity-40 enabled:hover:bg-white/5"
                      style={{ color: cur ? '#64748b' : m.color }}
                    >
                      {cur ? '✓ ' : ''}{m.short}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : <Locked label="Transmutation" metier="Forgeron" />}

          {!mods.ascend ? <Locked label="Ascension" metier="Forgeron" /> : nr ? (
            !ascRaidOk ? (
              <div className="rounded border border-rose-900/40 bg-rose-950/10 py-1.5 text-center text-[10px] text-rose-300/80">
                ☠️ Ascension → <span style={{ color: RARITIES[nr].color }}>{RARITIES[nr].name}</span> : vaincs un raid <b>tier ≥ {ascGate}</b> (record {bestRaidTier(raidProgress)}).
              </div>
            ) : (
            <button
              disabled={essence < aCost.eclats || noyau < aCost.noyau || fragments < aCost.fragments || poussiere < aCost.poussiere || cosmic < aCost.cosmic}
              onClick={() => ascend(item.id)}
              className="w-full rounded bg-fuchsia-900/50 py-2 text-[11px] font-medium hover:bg-fuchsia-800/60 disabled:opacity-40"
            >
              Ascension → {RARITIES[nr].name} · 💠 {aCost.noyau} + ♦ {aCost.eclats}
              {aCost.poussiere ? ` + 🌌 ${aCost.poussiere}` : ''}{aCost.fragments ? ` + ✨ ${aCost.fragments}` : ''}{aCost.cosmic ? ` + 💫 ${aCost.cosmic}` : ''}
            </button>
            )
          ) : (
            <div className="text-center text-[10px] italic text-slate-600">Rareté maximale atteinte.</div>
          )}

          {mods.quint ? <QuintessenceSection item={item} /> : <Locked label="Craft à la Quintessence" metier="Alchimiste" />}

          {itemSockets(item, mods.weaponSocketBonus) > 0 && (mods.gems ? <GemSection item={item} /> : <Locked label="Sertissage (gemmes)" metier="Joaillier" />)}

          {mods.enchant ? <EnchantSection item={item} /> : <Locked label="Gravure (runes)" metier="Runiste" />}

          {/* Synthèse d'uniques (Alchimiste) : 3 crans de précision, de l'aléatoire au choix exact */}
          {mods.synth2 ? <InsertEffectSection item={item} /> : null}

          {mods.synth3 ? <ChooseUniqueSection item={item} /> : <Locked label="Synthèse III — Invocation au choix" metier="Alchimiste (palier 100)" />}

          {/* Synthèse I : infuser un Fragment d'éternité (effet aléatoire) */}
          {mods.synth1 ? (
            <button
              disabled={fragments < FRAGMENT_INFUSE_COST}
              onClick={() => infuseUnique(item.id)}
              className="w-full rounded bg-sky-900/50 py-2 text-[11px] font-medium text-sky-200 hover:bg-sky-800/60 disabled:opacity-40"
              title="Ajoute un effet unique ALÉATOIRE (ou monte son rang) — récompense de raid"
            >
              ✨ {item.unique ? 'Renforcer l\'unique' : 'Infuser un unique'} · {FRAGMENT_INFUSE_COST} fragments
            </button>
          ) : <Locked label="Synthèse I — Infusion d'unique" metier="Alchimiste" />}
        </div>
      )}
    </div>
  )
}

/**
 * Craft typé à la Quintessence élémentaire : ajoute/améliore une ligne de Dégâts ou de Résistance
 * d'un type. Coût exponentiel par amélioration (puits sans fin), remboursé à 75% au recyclage.
 */
function QuintessenceSection({ item }: { item: Item }) {
  const quint = useGame((s) => s.quint)
  const enhanceTyped = useGame((s) => s.enhanceTyped)
  const qMods = craftMods(useGame((s) => s.metiers))
  const [open, setOpen] = useState(false)

  // Types pertinents : ceux dont on a des Quintessences, ou déjà présents sur l'objet.
  const present = new Set(item.affixes.filter((a) => a.kind !== 'stat' && a.type).map((a) => a.type as DamageType))
  const types = DAMAGE_TYPE_LIST.filter((t) => (quint[t] ?? 0) > 0 || present.has(t))
  const totalOwned = DAMAGE_TYPE_LIST.reduce((a, t) => a + (quint[t] ?? 0), 0)

  const find = (t: DamageType, kind: 'dmgType' | 'resist') => item.affixes.find((a) => a.kind === kind && a.type === t)

  return (
    <div className="rounded border border-emerald-800/40 bg-emerald-950/10 p-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[11px] font-semibold text-emerald-300">
        <span>⚗️ Quintessences élémentaires</span>
        <span className="text-[9.5px] font-normal text-slate-400">⚗️ {totalOwned} · {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-1.5">
          <div className="mb-1 text-[9.5px] leading-snug text-emerald-200/60">
            Ajoute ou renforce une ligne typée. Coût exponentiel par palier · {qMods.quintRefundFull ? '◈ 100%' : '75%'} remboursé au recyclage.
            {qMods.quintCostMult < 1 && <span className="text-emerald-300"> ◈ Catalyseur : −25%.</span>}
          </div>
          {types.length === 0 ? (
            <div className="text-[10px] italic text-slate-500">Aucune Quintessence — farme les biomes (drop ultra-rare ~1%).</div>
          ) : (
            <div className="space-y-1">
              {types.map((t) => {
                const m = DAMAGE_TYPES[t]
                const owned = quint[t] ?? 0
                return (
                  <div key={t} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1">
                    <span className="w-20 shrink-0 truncate text-[10px] font-medium" style={{ color: m.color }}>{m.icon} {m.name}</span>
                    <span className="w-12 shrink-0 text-[9px] text-slate-400" title="Quintessences disponibles">⚗️ {owned}</span>
                    <div className="flex flex-1 gap-1">
                      {(['dmgType', 'resist'] as const).map((kind) => {
                        const aff = find(t, kind)
                        const level = aff?.upgraded ?? 0
                        const cost = Math.max(1, Math.round(quintCost(level) * qMods.quintCostMult))
                        const can = owned >= cost
                        const label = kind === 'resist' ? 'Résist.' : 'Dégâts'
                        return (
                          <button
                            key={kind}
                            disabled={!can}
                            onClick={() => enhanceTyped(item.id, t, kind)}
                            title={aff
                              ? `+${QUINT_GAIN[kind]}${kind === 'resist' ? ' pts' : '%'} (palier ${level} → ${level + 1})`
                              : `Ajoute +${kind === 'resist' ? '4 pts' : '8%'} ${label}`}
                            className="flex-1 rounded border border-emerald-700/40 px-1 py-1 text-[9.5px] font-medium text-emerald-100 enabled:hover:bg-emerald-900/30 disabled:opacity-40"
                          >
                            {aff ? '⬆' : '+'} {label} · {m.icon}{cost}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Châsses & gemmes de CONDITION : sertir depuis le stock, désertir (rang conservé),
 * RECOUPER une gemme sertie (monte son paramètre d'un rang, contre de la poussière 🔹).
 */
function GemSection({ item }: { item: Item }) {
  const gems = useGame((s) => s.gems)
  const gemDust = useGame((s) => s.gemDust)
  const essence = useGame((s) => s.essence)
  const socketCondGem = useGame((s) => s.socketCondGem)
  const unsocketGem = useGame((s) => s.unsocketGem)
  const recutGem = useGame((s) => s.recutGem)
  const mods = craftMods(useGame((s) => s.metiers))
  const [open, setOpen] = useState(false)

  const sockets = itemSockets(item, mods.weaponSocketBonus)
  const filled = item.gems ?? []
  const unsocket = Math.round(unsocketCost() * mods.unsocketCostMult)
  const condStock = Object.entries(gems)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ key: k, parsed: parseCondKey(k), n }))
    .filter((x): x is { key: string; parsed: NonNullable<ReturnType<typeof parseCondKey>>; n: number } => !!x.parsed)

  return (
    <div className="rounded border border-sky-800/40 bg-sky-950/10 p-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[11px] font-semibold text-sky-300">
        <span>💎 Châsses ({filled.length}/{sockets})</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {filled.map((g, i) => {
            const cond = g.cond ? getCondGem(g.cond) : undefined
            if (!cond) return null
            const rank = g.rank ?? 1
            const maxR = gemMaxRank(cond)
            const rCost = recutCost(rank)
            return (
              <div key={i} className="flex items-center gap-2 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                <span className="min-w-0 flex-1" style={{ color: cond.color }}>
                  <span className="block truncate font-medium">
                    {GEM_FAMILIES[cond.family].icon} {cond.icon} {cond.name}
                    {maxR > 1 && <span className="text-slate-400"> · rang {rank}/{maxR}</span>}
                  </span>
                  <span className="block text-[9px] leading-snug text-slate-400">{gemDesc(cond, rank)}</span>
                </span>
                {mods.recoupe && rank < maxR && (
                  <button
                    disabled={gemDust < rCost}
                    onClick={() => recutGem(item.id, i)}
                    title={`Recoupe → rang ${rank + 1} : ${gemDesc(cond, rank + 1)} (-${rCost} 🔹)`}
                    className="shrink-0 rounded border border-sky-700/40 px-1.5 py-1 font-medium text-sky-200 hover:bg-sky-900/30 disabled:opacity-40"
                  >
                    🔬 {gemValue(cond, rank + 1)} · {rCost} 🔹
                  </button>
                )}
                <button
                  disabled={essence < unsocket}
                  onClick={() => unsocketGem(item.id, i)}
                  title={`Désertir (-${unsocket} éclats, gemme rendue avec son rang)`}
                  className="shrink-0 rounded bg-slate-800 px-1.5 py-1 text-slate-400 hover:text-red-400 disabled:opacity-40"
                >
                  ✕ ♦{unsocket}
                </button>
              </div>
            )
          })}
          {filled.length < sockets && (
            condStock.length === 0 ? (
              <div className="text-[10px] italic text-slate-500">
                Aucune gemme en stock — drops par famille de biome, champions ✦, raids, ou la ✂️ Taille (Atelier · Joaillier).
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {condStock.map(({ key, parsed, n }) => (
                  <button
                    key={key}
                    onClick={() => socketCondGem(item.id, parsed.def.id, parsed.rank)}
                    title={gemDesc(parsed.def, parsed.rank)}
                    className="rounded border px-2 py-1 text-[10px] font-medium hover:bg-white/5"
                    style={{ color: parsed.def.color, borderColor: parsed.def.color + '66' }}
                  >
                    {parsed.def.icon} {parsed.def.name}{parsed.rank > 1 ? ` R${parsed.rank}` : ''} ×{n}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

/** Rune : se GRAVE depuis le stash (v0.25 : graver CONSOMME une rune possédée — drop de raid). */
function EnchantSection({ item }: { item: Item }) {
  const essence = useGame((s) => s.essence)
  const poussiere = useGame((s) => s.poussiere)
  const runesOwned = useGame((s) => s.runesOwned)
  const enchantItem = useGame((s) => s.enchantItem)
  const mods = craftMods(useGame((s) => s.metiers))
  const [open, setOpen] = useState(false)
  const current = item.enchant ? getEnchant(item.enchant) : undefined

  return (
    <div className="rounded border border-amber-700/40 bg-amber-950/10 p-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[11px] font-semibold text-amber-200">
        <span>🪄 Rune {current ? `· ${current.icon} ${current.name}` : '· aucune'}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-1.5">
          <div className="mb-1 text-[9.5px] leading-snug text-slate-500">
            ⏳ TEMPS (horloges du combat) ou ⚖️ RÈGLE (lois du jeu) — une rune par pièce, effets d'équipe.
            Graver <b className="text-amber-300">CONSOMME</b> la rune (drop de ☠️ raid surtout) ; écraser ne rembourse pas.
          </div>
          <div className="space-y-0.5">
            {ENCHANTS.map((e) => {
              const raw = enchantCost(e, item)
              const cost = { eclats: Math.round(raw.eclats * mods.enchantCostMult), poussiere: Math.round(raw.poussiere * mods.enchantCostMult) }
              const on = item.enchant === e.id
              const ruleLocked = !!e.rule && !mods.ruleRunes
              const owned = runesOwned[e.id] ?? 0
              const can = !on && !ruleLocked && owned > 0 && essence >= cost.eclats && poussiere >= cost.poussiere
              return (
                <button
                  key={e.id}
                  disabled={!can}
                  onClick={() => enchantItem(item.id, e.id)}
                  title={ruleLocked ? `${e.description}\n— 🔒 nœud « Lois du monde » (arbre du Runiste)` : owned === 0 && !on ? `${e.description}\n— 🔒 aucune en stock : trouve-la en raid (ou rarement en donjon)` : e.description}
                  className={
                    'flex w-full flex-col gap-0.5 rounded border px-1.5 py-1 text-left text-[10px] disabled:opacity-40 ' +
                    (on ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-300 enabled:hover:bg-amber-900/20')
                  }
                >
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className="min-w-0 truncate">
                      {on ? '✓ ' : ruleLocked ? '🔒 ' : ''}{e.icon} {e.name}
                      <span className="text-slate-500"> · {e.rule ? '⚖️ RÈGLE' : '⏳ TEMPS'}</span>
                      <span className={owned > 0 ? 'text-emerald-300' : 'text-slate-600'}> · ×{owned}</span>
                    </span>
                    {!on && <span className="shrink-0 text-[9px] text-slate-500">{owned === 0 ? '☠️ à trouver' : <>♦{cost.eclats}{cost.poussiere ? ` 🌌${cost.poussiere}` : ''}</>}</span>}
                  </span>
                  <span className="text-[8.5px] leading-snug text-slate-500">{e.description}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Insertion ciblée d'un effet unique via les essences (recyclage d'uniques). */
function InsertEffectSection({ item }: { item: Item }) {
  const essences = useGame((s) => s.essences)
  const essence = useGame((s) => s.essence)
  const insertEffect = useGame((s) => s.insertEffect)
  const cost = insertCost()
  const owned = UNIQUE_EFFECTS.filter((e) => (essences[e.id] ?? 0) >= cost.essences)
  if (owned.length === 0) return null
  return (
    <div className="rounded border border-fuchsia-800/40 bg-fuchsia-950/10 p-2">
      <div className="mb-1 text-[10px] text-fuchsia-300/80">🧬 Insérer un fragment d'effet · {cost.essences} essences + ♦ {cost.eclats} :</div>
      <div className="flex flex-wrap gap-1">
        {owned.map((e) => (
          <button
            key={e.id}
            disabled={essence < cost.eclats}
            onClick={() => insertEffect(item.id, e.id)}
            title={e.description}
            className="rounded border border-fuchsia-700/50 bg-fuchsia-900/30 px-2 py-1 text-[10px] text-fuchsia-200 hover:bg-fuchsia-800/40 disabled:opacity-40"
          >
            {e.name} ({essences[e.id]})
          </button>
        ))}
      </div>
    </div>
  )
}

/** Invocation d'un effet unique AU CHOIX via un Éclat cosmique 💫 (sink des raids). */
function ChooseUniqueSection({ item }: { item: Item }) {
  const cosmic = useGame((s) => s.cosmic)
  const fragments = useGame((s) => s.fragments)
  const chooseUnique = useGame((s) => s.chooseUnique)
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<UniqueRole | 'all'>('all')
  const affordable = cosmic >= CHOOSE_UNIQUE_COST.cosmic && fragments >= CHOOSE_UNIQUE_COST.fragments
  const list = UNIQUE_EFFECTS.filter((e) => role === 'all' || e.role === role)
  return (
    <div className="rounded border border-violet-800/40 bg-violet-950/10 p-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[11px] font-semibold text-violet-300">
        <span>💫 Invoquer un effet au choix</span>
        <span className="text-[9.5px] font-normal text-slate-400">{CHOOSE_UNIQUE_COST.cosmic} 💫 + {CHOOSE_UNIQUE_COST.fragments} ✨ · {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-1.5">
          {!affordable && <div className="mb-1 text-[9.5px] text-rose-300/70">Pas assez de ressources — les Éclats cosmiques 💫 viennent des raids.</div>}
          <div className="mb-1 flex flex-wrap gap-1 text-[9px]">
            <RoleChip active={role === 'all'} onClick={() => setRole('all')} label="Tous" />
            {UNIQUE_ROLES.map((r) => <RoleChip key={r} active={role === r} onClick={() => setRole(r)} label={r} />)}
          </div>
          <div className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
            {list.map((e) => (
              <button
                key={e.id}
                disabled={!affordable}
                onClick={() => chooseUnique(item.id, e.id)}
                title={e.description}
                className="flex w-full items-center justify-between rounded border border-violet-800/40 px-2 py-1 text-left text-[10px] text-violet-100 hover:bg-violet-900/30 disabled:opacity-40"
              >
                <span className="truncate">{item.unique?.id === e.id ? '✦ ' : ''}{e.name}</span>
                <span className="ml-1 shrink-0 text-[8.5px] text-slate-500">{e.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={'rounded px-2 py-1 ' + (active ? 'bg-violet-600 text-slate-50' : 'bg-slate-800 text-slate-400')}>
      {label}
    </button>
  )
}

/** Pièce de set : nom, pièces portées, paliers de bonus (actifs en vert). */
function SetBlock({ item, char }: { item: Item; char: Character }) {
  const def = getSet(item.setId!)
  if (!def) return null
  const count = Object.values(char.equipment).filter((it) => it?.setId === def.id).length
  const total = Object.keys(def.pieces).length
  return (
    <div className="mt-2 rounded-lg border p-2" style={{ borderColor: def.color + '66', background: def.color + '14' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold" style={{ color: def.color }}>⬢ {def.name}</span>
        <span className="text-[10px]" style={{ color: def.color }}>{count}/{total} portée{count > 1 ? 's' : ''}</span>
      </div>
      <div className="mt-1 space-y-0.5">
        {def.bonuses.map((b) => (
          <div key={b.pieces} className={'text-[10px] leading-snug ' + (count >= b.pieces ? 'font-medium text-emerald-300' : 'text-slate-500')}>
            ({b.pieces}) {count >= b.pieces ? '✓ ' : ''}{b.desc}
          </div>
        ))}
      </div>
      <div className="mt-1 text-[9px] italic text-slate-500">Exclusif à 🕳️ l'Abîme Primordial.</div>
    </div>
  )
}

/** Bloc d'effet unique : rang, mods, capacité active, amélioration via essences. */
function UniqueBlock({ item }: { item: Item }) {
  const inst = item.unique!
  const def = getUnique(inst.id)
  const essence = useGame((s) => s.essence)
  const essences = useGame((s) => s.essences)
  const upgradeUnique = useGame((s) => s.upgradeUnique)
  if (!def) return null

  const mods = instanceMods(inst, item)
  const active = isUniqueActive(inst.rank)
  const cost = upgradeCost(inst.rank)
  const have = essences[inst.id] ?? 0
  const maxed = inst.rank >= UNIQUE_MAX_RANK
  const canUp = !maxed && have >= cost.essences && essence >= cost.eclats

  return (
    <div className="mt-2 rounded-lg border border-fuchsia-700/50 bg-fuchsia-950/30 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-fuchsia-300">✦ {def.name}</span>
        <span className="text-[10px] text-fuchsia-200/70">Rang {inst.rank}/{UNIQUE_MAX_RANK}</span>
      </div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-fuchsia-200/80">{def.description}</div>
      <div className="mt-0.5 text-[9.5px] italic text-fuchsia-300/50">Monte avec le rang, la rareté et l'iLvl de la pièce.</div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[10.5px]">
        {Object.entries(mods).map(([k, v]) => {
          const m = ALL_STAT_META[k as StatKey]
          return (
            <span key={k} style={{ color: m.color }}>+{v} {m.name}</span>
          )
        })}
        {Object.entries(instanceResist(inst)).map(([k, v]) => {
          const m = DAMAGE_TYPES[k as keyof typeof DAMAGE_TYPES]
          return (
            <span key={k} style={{ color: m.color }}>+{Math.round((v as number) * 100)} résist. {m.name}</span>
          )
        })}
      </div>
      <div className={'mt-1 text-[10px] leading-snug ' + (active ? 'text-emerald-300' : 'text-slate-500')}>
        {active ? '✓ Actif : ' : `🔒 Rang ${UNIQUE_ACTIVE_RANK} : `}
        {uniqueActiveText(inst.id)}
      </div>
      {maxed ? (
        <div className="mt-1.5 text-center text-[10px] text-fuchsia-200/60">Rang maximal atteint</div>
      ) : (
        <button
          disabled={!canUp}
          onClick={() => upgradeUnique(item.id)}
          className="mt-1.5 w-full rounded bg-fuchsia-800/60 py-2 text-[11px] font-medium hover:bg-fuchsia-700/70 disabled:opacity-40"
          title={have < cost.essences ? 'Pas assez d\'essences (recycle des uniques identiques)' : ''}
        >
          Monter rang {inst.rank + 1} · {cost.essences} essences ({have}) + ♦ {cost.eclats}
        </button>
      )}
    </div>
  )
}

/** Résumé de l'objet ÉQUIPÉ (rareté, unique, type) affiché au-dessus de la comparaison. */
function EquippedSummary({ item, slotName }: { item: Item; slotName?: string }) {
  const rarity = RARITIES[item.rarity]
  const uniqueName = item.unique ? getUnique(item.unique.id)?.name : null
  const typeLines = item.affixes.filter((a) => a.kind !== 'stat')
  return (
    <div className="mt-2 rounded-lg border border-slate-700/60 bg-black/20 p-2">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{slotName ? `Équipé · ${slotName}` : 'Équipé actuellement'}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span>{ITEM_TYPES[item.type].icon}</span>
        <span className={'min-w-0 flex-1 truncate text-[12px] font-semibold ' + rarityNameClass(item.rarity)} style={rarityTextStyle(item.rarity)}>
          {item.name}
        </span>
        {itemHasRareStat(item) && <span className="text-[10px]" title="Stat RARE">💎</span>}
        {item.unique && <span className="text-[10px] text-fuchsia-400" title={uniqueName ?? undefined}>✦</span>}
      </div>
      <div className="text-[9.5px] text-slate-500">
        <span style={{ color: rarity.color }}>{rarity.name}</span> · iLvl {item.ilvl}
        {item.damageType && item.damageType !== 'physique' && (
          <span style={{ color: DAMAGE_TYPES[item.damageType].color }}> · {DAMAGE_TYPES[item.damageType].icon} {DAMAGE_TYPES[item.damageType].name}</span>
        )}
      </div>
      {uniqueName && <div className="mt-0.5 text-[10px] font-medium text-fuchsia-300/90">✦ {uniqueName} (rang {item.unique!.rank})</div>}
      {typeLines.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
          {typeLines.map((a, i) => {
            const m = a.type ? DAMAGE_TYPES[a.type] : null
            return (
              <span key={i} style={{ color: m?.color }}>
                {a.kind === 'resist' ? `🛡 +${a.value} rés.` : `${m?.icon} +${a.value}%`} {m?.name}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Ordonne les stats : primaire(s) d'abord, puis secondaires, dans un ordre stable. */
function orderedKeys(a: Record<string, number>, b: Record<string, number>): StatKey[] {
  const order: StatKey[] = [
    'force', 'agilite', 'intelligence', 'endurance',
    'critique', 'degatsCrit', 'hate', 'maitrise', 'penetration', 'precision', 'alteration', 'degatsBoss',
    'reductionDegats', 'esquive', 'barriere', 'tenacite',
    'regen',
    'volDeVie', 'surpuissance', 'multifrappe', 'recuperation',
  ]
  const present = new Set([...Object.keys(a), ...Object.keys(b)])
  return order.filter((k) => present.has(k))
}
