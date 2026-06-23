import { useState } from 'react'
import { useGame, bestRaidTier } from '../game/store'
import { CONSTELLATION, nodeCost, constellationMods, echosGain } from '../game/prestige'
import { raidUnlocked, getRaidDef } from '../game/raids'
import { EQUIP_SLOTS } from '../game/slots'
import { ITEM_TYPES } from '../game/slots'
import { RARITIES } from '../game/rarities'
import { ConfirmButton } from './ui'
import { QualityStars } from './ItemRow'
import type { EquipSlotId } from '../game/types'

/**
 * ÉVEIL PRIMORDIAL : dépense des Échos dans la Constellation, et reset DUR contre
 * une moisson d'Échos (en gardant 1 Relique). Visible une fois l'Abîme débloqué.
 */
export function PrestigePanel() {
  const echos = useGame((s) => s.echos)
  const prestigeRank = useGame((s) => s.prestigeRank)
  const constellation = useGame((s) => s.constellation)
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const allocate = useGame((s) => s.allocateConstellation)
  const awaken = useGame((s) => s.awaken)

  const [relicSlot, setRelicSlot] = useState<EquipSlotId | null>(null)

  const unlocked = raidUnlocked(getRaidDef('abysse'), bestStage, raidProgress)
  const mods = constellationMods(constellation)
  const raidsBeaten = Object.values(raidProgress).filter((t) => (t ?? 0) > 0).length
  const gain = echosGain(bestRaidTier(raidProgress), bestStage, raidsBeaten, mods.echosMult)

  const active = characters[activeChar] ?? characters[0]
  const equipped = EQUIP_SLOTS.filter((s) => active?.equipment[s.id])

  return (
    <div className="h-full space-y-3 overflow-y-auto pr-1">
      {/* En-tête */}
      <div className="rounded-xl border border-fuchsia-800/40 bg-gradient-to-br from-[#1a1326] to-[#0d0a14] p-3">
        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-fuchsia-200">✨ Éveil Primordial</div>
          <div className="text-xs text-slate-400">Éveils : <b className="text-fuchsia-300">{prestigeRank}</b></div>
        </div>
        <div className="mt-1 text-[11px] leading-snug text-slate-400">
          Un reset <b className="text-rose-300">DUR</b> (stuff, niveau, Chapitres, tiers de raid) contre des <b className="text-fuchsia-300">Échos primordiaux 💠</b>,
          investis dans la <b className="text-fuchsia-200">Constellation</b> (bonus permanents). Tu gardes <b className="text-amber-300">1 Relique</b>,
          tes <b className="text-slate-300">Échos</b>, ta <b className="text-slate-300">Constellation</b>, ton <b className="text-slate-300">record</b> et l'<b className="text-slate-300">XP métiers</b>.
        </div>
        <div className="mt-2 rounded-lg bg-black/30 px-2.5 py-1.5 text-sm">
          <span className="text-slate-500">Échos : </span><b className="text-fuchsia-300">💠 {echos}</b>
        </div>
      </div>

      {/* Constellation */}
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">🌌 Constellation</div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CONSTELLATION.map((node) => {
            const rank = constellation[node.id] ?? 0
            const maxed = rank >= node.maxRank
            const cost = nodeCost(node, rank)
            const afford = echos >= cost
            return (
              <div key={node.id} className="rounded-lg border border-slate-800 bg-black/20 p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[12px] font-semibold text-slate-100">{node.icon} {node.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{rank}/{node.maxRank}</span>
                </div>
                <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{node.desc}</div>
                <button
                  disabled={maxed || !afford}
                  onClick={() => allocate(node.id)}
                  className={'mt-1 w-full rounded py-1 text-[10.5px] font-medium ' + (maxed ? 'bg-emerald-900/30 text-emerald-300' : afford ? 'bg-fuchsia-700/50 text-fuchsia-100 hover:bg-fuchsia-600/50' : 'bg-slate-800 text-slate-500')}
                >
                  {maxed ? '✓ Maximisé' : `💠 ${cost} Échos`}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Éveil */}
      <div className="rounded-xl border border-fuchsia-800/40 bg-[#140e1c] p-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-400">🔥 Procéder à l'Éveil</div>
        {!unlocked ? (
          <div className="text-[11px] leading-snug text-slate-500">
            🔒 L'Éveil se débloque en atteignant le <b className="text-rose-300">contenu endgame</b> : bats l'Abîme Primordial (Tier 7 sur les 4 raids de base).
          </div>
        ) : (
          <>
            <div className="text-[11px] text-slate-300">
              Gain à l'Éveil : <b className="text-fuchsia-300">+{gain} Échos 💠</b>
              <span className="text-slate-500"> (selon ton meilleur tier de raid × Chapitre × diversité).</span>
            </div>

            {/* Choix de la Relique */}
            <div className="mt-2 text-[11px] text-slate-400">Relique à conserver (iLvl ramené au plancher, garde lignes/unique/gemmes) :</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                onClick={() => setRelicSlot(null)}
                className={'rounded px-2 py-1 text-[10px] ' + (relicSlot === null ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
              >
                Aucune
              </button>
              {equipped.map((slot) => {
                const it = active!.equipment[slot.id]!
                const on = relicSlot === slot.id
                return (
                  <button
                    key={slot.id}
                    onClick={() => setRelicSlot(slot.id)}
                    title={`${it.name} · iLvl ${it.ilvl}`}
                    className={'flex items-center gap-1 rounded px-2 py-1 text-[10px] ' + (on ? 'ring-1 ring-fuchsia-400 bg-white/10' : 'bg-slate-800 hover:bg-white/5')}
                    style={{ color: RARITIES[it.rarity].color }}
                  >
                    <QualityStars stars={it.stars} />
                    <span className="text-xs">{ITEM_TYPES[it.type].icon}</span>
                    <span className="max-w-[90px] truncate">{it.name}</span>
                  </button>
                )
              })}
            </div>

            <ConfirmButton
              onConfirm={() => { awaken(relicSlot); setRelicSlot(null) }}
              className="mt-2 w-full rounded-lg bg-fuchsia-700 py-2 text-xs font-semibold text-white hover:bg-fuchsia-600"
            >
              ✨ S'ÉVEILLER — reset DUR (+{gain} Échos)
            </ConfirmButton>
            <div className="mt-1 text-[9px] leading-snug text-slate-600">
              Irréversible : ton stuff (sauf la Relique), ton niveau, tes Chapitres et tes tiers de raid tentables sont remis à zéro.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
