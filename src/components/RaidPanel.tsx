import { useState } from 'react'
import { useGame } from '../game/store'
import {
  RAID_LIST, RAID_UNLOCK_STAGE, RAID_MECHANIC_META, getRaidDef, raidUnlocked,
  raidBossCount, raidIlvl, raidBerserkTime, raidFragments, raidCosmicChance,
  recommendedDps, recommendedEhp, type RaidDef,
} from '../game/raids'
import { charDerived, charDamageProfile, charMaxHp } from '../game/character'
import { theoreticalDps } from '../game/combat'
import { DAMAGE_TYPES } from '../game/damage'

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'Md'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return Math.round(n).toLocaleString('fr-FR')
}

export function RaidPanel() {
  const orbes = useGame((s) => s.orbes)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const bestStage = useGame((s) => s.bestStage)
  const progress = useGame((s) => s.raidProgress)
  const raid = useGame((s) => s.raid)
  const dungeon = useGame((s) => s.dungeon)
  const characters = useGame((s) => s.characters)
  const enterRaid = useGame((s) => s.enterRaid)

  const partyDps = characters.filter((c) => c.hp > 0).reduce((a, c) => a + theoreticalDps(charDerived(c), charDamageProfile(c)), 0)
  const partyHp = characters.reduce((a, c) => a + charMaxHp(c), 0)

  const anyUnlocked = bestStage >= RAID_UNLOCK_STAGE

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">☠️ Raids légendaires</div>
        <div className="flex gap-2.5 text-xs">
          <span className="text-rose-300">🔮 {orbes}</span>
          <span className="text-sky-300">✨ {fragments}</span>
          <span className="text-violet-300" title="Éclat cosmique">💫 {cosmic}</span>
        </div>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        Cinq sanctuaires <b className="text-slate-300">distincts</b>, chacun ciblant une catégorie de butin et montés
        en <b className="text-slate-300">tiers indépendants</b>. <b className="text-rose-300">Extrêmement difficiles</b> :
        chaque raid teste une facette de ton stuff (DPS, PV, résistances, pénétration, burst). Récompenses : butin ciblé
        de très haut iLvl, Fragments d'éternité et le rarissime <b className="text-violet-300">Éclat cosmique 💫</b>.
      </p>

      <div className="mb-2 rounded-lg border border-slate-800 bg-[#0d111a] px-2.5 py-1.5 text-[10.5px]">
        <span className="text-slate-500">Ton équipe — </span>
        <span className="text-emerald-300">DPS {fmt(partyDps)}</span>
        <span className="text-slate-600"> · </span>
        <span className="text-sky-300">PV {fmt(partyHp)}</span>
      </div>

      {(raid || dungeon) && (
        <div className="mb-2 rounded-lg border border-rose-700/50 bg-rose-950/20 p-2 text-[11px] text-rose-200">
          {raid ? 'Raid en cours — va dans l\'onglet Combat.' : 'Termine ton donjon avant de lancer un raid.'}
        </div>
      )}

      {!anyUnlocked ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          Les raids se débloquent au <span className="text-rose-300">palier {RAID_UNLOCK_STAGE}</span>.
          <br />Record actuel : {bestStage}.
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {RAID_LIST.map((def) => (
            <RaidCard
              key={def.id}
              def={def}
              unlocked={raidUnlocked(def, bestStage, progress)}
              cleared={progress[def.id] ?? 0}
              bestStage={bestStage}
              orbes={orbes}
              busy={!!raid || !!dungeon}
              partyDps={partyDps}
              partyHp={partyHp}
              onEnter={(tier) => enterRaid(def.id, tier)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RaidCard({ def, unlocked, cleared, bestStage, orbes, busy, partyDps, partyHp, onEnter }: {
  def: RaidDef
  unlocked: boolean
  cleared: number
  bestStage: number
  orbes: number
  busy: boolean
  partyDps: number
  partyHp: number
  onEnter: (tier: number) => void
}) {
  const frontier = cleared + 1
  const [tier, setTier] = useState(frontier)
  const t = Math.max(1, Math.min(frontier, tier))

  if (!unlocked) {
    const reqRaid = def.requires ? getRaidDef(def.requires) : null
    return (
      <div className="rounded-lg border border-slate-800 bg-[#0c0f17] p-2.5 opacity-70">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-400">{def.icon} {def.name}</div>
          <span className="text-[10px] text-slate-600">🔒 Verrouillé</span>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-500">
          Requiert le <span className="text-rose-300">palier {def.unlockStage}</span>
          {bestStage < def.unlockStage ? ` (record ${bestStage})` : ' ✓'}
          {reqRaid && <> · avoir vaincu <span style={{ color: reqRaid.color }}>{reqRaid.name}</span></>}
        </div>
      </div>
    )
  }

  const recDps = recommendedDps(def, t)
  const recEhp = recommendedEhp(def, t)
  const dpsOk = partyDps >= recDps
  const ehpOk = partyHp >= recEhp
  const canEnter = !busy && orbes >= def.orbeCost
  const isNew = t === frontier && t > 1

  return (
    <div className="rounded-lg border bg-[#11151f] p-2.5" style={{ borderColor: def.color + '40' }}>
      <div className="flex items-center justify-between">
        <div className="font-medium" style={{ color: def.color }}>{def.icon} {def.name}</div>
        <div className="text-[10px] text-slate-500">Record : tier {cleared}</div>
      </div>

      <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{def.lore}</div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9.5px] text-slate-300">🎁 {def.lootLabel}</span>
        {def.signature.map((m) => (
          <span key={m} title={RAID_MECHANIC_META[m].desc} className="rounded bg-rose-900/30 px-1.5 py-0.5 text-[9.5px] text-rose-200">
            {RAID_MECHANIC_META[m].icon} {RAID_MECHANIC_META[m].name}
          </span>
        ))}
      </div>

      {/* Recommandations (checks de stuff) */}
      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px]">
        <div className={'rounded px-1.5 py-1 ' + (dpsOk ? 'bg-emerald-900/20' : 'bg-rose-900/20')}>
          <span className="text-slate-500">DPS conseillé </span>
          <span className={dpsOk ? 'text-emerald-300' : 'text-rose-300'}>{fmt(recDps)} {dpsOk ? '✓' : '✗'}</span>
          <span className="block text-[8.5px] text-slate-600">timer enrage {Math.round(raidBerserkTime(def, t))}s</span>
        </div>
        <div className={'rounded px-1.5 py-1 ' + (ehpOk ? 'bg-emerald-900/20' : 'bg-rose-900/20')}>
          <span className="text-slate-500">PV conseillés </span>
          <span className={ehpOk ? 'text-emerald-300' : 'text-rose-300'}>{fmt(recEhp)} {ehpOk ? '✓' : '✗'}</span>
          <span className="block text-[8.5px] text-slate-600">{raidBossCount(def, t)} boss · butin iLvl ~{raidIlvl(def, t)}</span>
        </div>
      </div>

      <div className="mt-1 text-[9.5px] text-slate-500">
        Récompense : ✨ {raidFragments(def, t)} fragments · 💫 {Math.round(raidCosmicChance(def, t) * 100)}%
        {def.element !== 'rotating' && <> · attaque {DAMAGE_TYPES[def.element].icon} {DAMAGE_TYPES[def.element].name}</>}
        {def.element === 'rotating' && <> · 🌈 éléments tournants</>}
      </div>

      {/* Sélecteur de tier + lancement */}
      <div className="mt-2 flex items-center gap-1.5">
        <div className="flex items-center rounded-lg border border-slate-700">
          <button onClick={() => setTier((x) => Math.max(1, Math.min(frontier, x) - 1))} className="px-2 py-1 text-xs text-slate-300 hover:bg-white/5">−</button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-200">Tier {t}{isNew ? ' ★' : ''}</span>
          <button onClick={() => setTier((x) => Math.min(frontier, Math.max(1, x) + 1))} className="px-2 py-1 text-xs text-slate-300 hover:bg-white/5">+</button>
        </div>
        <button
          disabled={!canEnter}
          onClick={() => onEnter(t)}
          className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-slate-50 disabled:opacity-40"
          style={{ background: canEnter ? def.color + 'cc' : '#1e2433' }}
        >
          {busy ? 'Indisponible' : orbes < def.orbeCost ? `Besoin de ${def.orbeCost} 🔮` : `Lancer le tier ${t} (${def.orbeCost} 🔮)`}
        </button>
      </div>
    </div>
  )
}
