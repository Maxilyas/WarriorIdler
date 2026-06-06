import { useGame, SCEAU_COST } from '../game/store'
import { dungeonTheme, dungeonFights, dungeonIlvl } from '../game/dungeons'
import { DAMAGE_TYPES } from '../game/damage'

export function DungeonPanel() {
  const sceaux = useGame((s) => s.sceaux)
  const progress = useGame((s) => s.dungeonProgress)
  const dungeon = useGame((s) => s.dungeon)
  const enterDungeon = useGame((s) => s.enterDungeon)
  const craftSceau = useGame((s) => s.craftSceau)
  const noyau = useGame((s) => s.noyau)
  const essence = useGame((s) => s.essence)
  const canCraftSceau = noyau >= SCEAU_COST.noyau && essence >= SCEAU_COST.eclats

  const frontier = progress + 1 // plus haut niveau accessible
  const levels = Array.from({ length: frontier }, (_, i) => i + 1)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">🏰 Donjons</div>
        <div className="text-xs">
          <span className="text-amber-300">🔑 {sceaux} sceau{sceaux > 1 ? 'x' : ''} de faille</span>
        </div>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        Une série de combats à enchaîner d'une traite. Réussir → un coffre (meilleur loot + ressources)
        et débloque le niveau suivant. Échouer = repli, le Sceau est perdu. Gagne des Sceaux en montant
        de palier (1 tous les 5), ou forge-les.
      </p>

      <button
        onClick={craftSceau}
        disabled={!canCraftSceau}
        className="mb-2 w-full rounded-lg bg-amber-800/50 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-700/60 disabled:opacity-40"
      >
        🔨 Forger un Sceau de faille · 💠 {SCEAU_COST.noyau} + ♦ {SCEAU_COST.eclats}
      </button>

      {dungeon && (
        <div className="mb-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-2 text-[11px] text-amber-200">
          Donjon en cours : {dungeon.name} (combat {dungeon.current + 1}/{dungeon.totalFights}). Va dans l'onglet Combat.
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {levels.map((lvl) => {
          const { theme, vuln } = dungeonTheme(lvl)
          const tm = DAMAGE_TYPES[theme]
          const vm = DAMAGE_TYPES[vuln]
          const isNew = lvl === frontier && lvl > 1
          const canEnter = !dungeon && sceaux >= 1
          return (
            <div
              key={lvl}
              className="rounded-lg border border-slate-800 bg-[#11151f] p-2.5"
              style={{ borderColor: tm.color + '40' }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-200">
                  Niveau {lvl}
                  {isNew && <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] text-slate-950">NOUVEAU</span>}
                </div>
                <div className="text-[11px] text-slate-500">{dungeonFights(lvl)} combats</div>
              </div>
              <div className="mt-1 text-[11px]">
                <span style={{ color: tm.color }}>{tm.icon} Thème {tm.name}</span>
                <span className="text-slate-500"> · faible : </span>
                <span style={{ color: vm.color }}>{vm.icon} {vm.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                Coffre iLvl ~{dungeonIlvl(lvl)} · modificateurs aléatoires
              </div>
              <button
                disabled={!canEnter}
                onClick={() => enterDungeon(lvl)}
                className="mt-2 w-full rounded-lg bg-amber-700/80 py-1.5 text-xs font-semibold hover:bg-amber-600 disabled:opacity-40"
              >
                {dungeon ? 'Donjon en cours…' : sceaux < 1 ? 'Pas de Sceau' : 'Entrer (1 🔑)'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
