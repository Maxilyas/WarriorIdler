import { useGame } from '../game/store'
import { raidTheme, raidBosses, raidIlvl, RAID_UNLOCK_STAGE } from '../game/raids'
import { DAMAGE_TYPES } from '../game/damage'

export function RaidPanel() {
  const orbes = useGame((s) => s.orbes)
  const fragments = useGame((s) => s.fragments)
  const bestStage = useGame((s) => s.bestStage)
  const progress = useGame((s) => s.raidProgress)
  const raid = useGame((s) => s.raid)
  const dungeon = useGame((s) => s.dungeon)
  const enterRaid = useGame((s) => s.enterRaid)

  const unlocked = bestStage >= RAID_UNLOCK_STAGE

  if (!unlocked) {
    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 text-sm font-semibold text-slate-200">⚔️ Raids</div>
        <div className="mt-8 rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          Les raids se débloquent au <span className="text-rose-300">palier {RAID_UNLOCK_STAGE}</span>.
          <br />Record actuel : {bestStage}.
        </div>
      </div>
    )
  }

  const frontier = progress + 1
  const levels = Array.from({ length: frontier }, (_, i) => i + 1)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">⚔️ Raids</div>
        <div className="flex gap-3 text-xs">
          <span className="text-rose-300">🔮 {orbes} orbe{orbes > 1 ? 's' : ''}</span>
          <span className="text-sky-300">✨ {fragments} fragment{fragments > 1 ? 's' : ''}</span>
        </div>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        Séries de boss redoutables à vaincre d'une traite avec ton équipe. Chaque boss a des résistances
        fortes et 1-2 mécaniques (Nova, Enrage, Carapace…). Consomme une Orbe de raid (lâchée par les
        boss et les donjons profonds). Récompense : objets d'élite + <b className="text-sky-300">Fragments
        d'éternité</b> (craft sommital).
      </p>

      {(raid || dungeon) && (
        <div className="mb-2 rounded-lg border border-rose-700/50 bg-rose-950/20 p-2 text-[11px] text-rose-200">
          {raid ? 'Raid en cours — va dans l\'onglet Combat.' : 'Termine ton donjon avant de lancer un raid.'}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {levels.map((lvl) => {
          const { theme, vuln } = raidTheme(lvl)
          const tm = DAMAGE_TYPES[theme]
          const vm = DAMAGE_TYPES[vuln]
          const isNew = lvl === frontier && lvl > 1
          const canEnter = !raid && !dungeon && orbes >= 1
          return (
            <div key={lvl} className="rounded-lg border border-slate-800 bg-[#11151f] p-2.5" style={{ borderColor: tm.color + '40' }}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-200">
                  Raid {lvl}
                  {isNew && <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] text-slate-950">NOUVEAU</span>}
                </div>
                <div className="text-[11px] text-slate-500">{raidBosses(lvl)} boss</div>
              </div>
              <div className="mt-1 text-[11px]">
                <span style={{ color: tm.color }}>{tm.icon} Thème {tm.name}</span>
                <span className="text-slate-500"> · faible : </span>
                <span style={{ color: vm.color }}>{vm.icon} {vm.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">Butin iLvl ~{raidIlvl(lvl)} · Fragments d'éternité</div>
              <button
                disabled={!canEnter}
                onClick={() => enterRaid(lvl)}
                className="mt-2 w-full rounded-lg bg-rose-700/80 py-1.5 text-xs font-semibold hover:bg-rose-600 disabled:opacity-40"
              >
                {raid || dungeon ? 'Indisponible' : orbes < 1 ? 'Pas d\'Orbe de raid' : 'Lancer le raid (1 🔮)'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
