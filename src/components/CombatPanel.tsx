import { useGame } from '../game/store'
import type { LogKind } from '../game/store'
import { charDerived, charMaxHp, charDamageProfile, TALENT_START_LEVEL } from '../game/character'
import { theoreticalDps } from '../game/combat'
import { isBossStage } from '../game/enemies'
import { DAMAGE_TYPES } from '../game/damage'
import { RAID_MECHANIC_META } from '../game/raids'
import type { DamageType } from '../game/types'

const LOG_COLORS: Record<LogKind, string> = {
  hit: 'text-slate-300',
  crit: 'text-orange-300',
  loot: 'text-sky-300',
  kill: 'text-emerald-300',
  info: 'text-amber-300',
  level: 'text-yellow-300 font-semibold',
  death: 'text-red-400 font-semibold',
  gold: 'text-yellow-400',
  craft: 'text-cyan-300',
}

export function CombatPanel() {
  const characters = useGame((s) => s.characters)
  const normalEnemy = useGame((s) => s.enemy)
  const dungeon = useGame((s) => s.dungeon)
  const raid = useGame((s) => s.raid)
  const abandonDungeon = useGame((s) => s.abandonDungeon)
  const abandonRaid = useGame((s) => s.abandonRaid)
  const stage = useGame((s) => s.stage)
  const bestStage = useGame((s) => s.bestStage)
  const farmLock = useGame((s) => s.farmLock)
  const setStage = useGame((s) => s.setStage)
  const toggleFarmLock = useGame((s) => s.toggleFarmLock)
  const log = useGame((s) => s.log)

  const enemy = raid ? raid.enemy : dungeon ? dungeon.enemy : normalEnemy
  const atkType = DAMAGE_TYPES[enemy.damageType]
  // Objectif courant (tutoriel léger + signalisation des déblocages progressifs).
  const maxLevel = characters.reduce((m, c) => Math.max(m, c.level), 1)
  const objective = nextObjective(bestStage, maxLevel)
  const partyDps = characters
    .filter((c) => c.hp > 0)
    .reduce((sum, c) => sum + theoreticalDps(charDerived(c), charDamageProfile(c)), 0)
  const resistEntries = Object.entries(enemy.resist ?? {}) as [DamageType, number][]
  // Combat classique : résistance globale (les 7 types égaux) ; donjon/raid : résistances typées.
  const resistVals = resistEntries.map(([, v]) => v)
  const globalResist = resistVals.length >= 7 && resistVals.every((v) => v === resistVals[0]) ? resistVals[0] : null
  const enemyPct = (enemy.hp / enemy.maxHp) * 100
  const boss = raid ? true : dungeon ? dungeon.current === dungeon.totalFights - 1 : isBossStage(stage)

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Objectif / tutoriel (disparaît une fois tout débloqué) */}
      {objective && !dungeon && !raid && (
        <div className="rounded-xl border border-orange-700/40 bg-orange-950/20 px-3 py-2 text-[11px] leading-snug text-orange-100">
          <span className="font-semibold text-orange-300">🎯 Objectif&nbsp;:</span> {objective}
        </div>
      )}

      {/* Équipe */}
      <div className="space-y-1.5 rounded-xl border border-slate-800 bg-gradient-to-br from-[#141a26] to-[#0d111a] p-3">
        {characters.map((c) => {
          const mh = charMaxHp(c)
          const pct = Math.max(0, (c.hp / mh) * 100)
          const dead = c.hp <= 0
          return (
            <div key={c.id}>
              <div className="flex items-center justify-between text-[11px]">
                <span className={'font-semibold ' + (dead ? 'text-red-500/70 line-through' : 'text-slate-100')}>
                  🛡 {c.name} <span className="text-slate-500">N{c.level}</span>
                </span>
                <span className="text-slate-400">{Math.ceil(Math.max(0, c.hp)).toLocaleString('fr-FR')} / {Math.round(mh).toLocaleString('fr-FR')}</span>
              </div>
              <div className="mt-0.5 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={'h-full transition-all duration-200 ' + (dead ? 'bg-red-900' : 'bg-gradient-to-r from-emerald-600 to-emerald-400')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Bandeau donjon */}
      {dungeon && (
        <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-300">🏰 {dungeon.name}</span>
            <button onClick={abandonDungeon} className="rounded bg-red-900/50 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-900/70">
              Abandonner
            </button>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Combat <span className="text-slate-200">{dungeon.current + 1}/{dungeon.totalFights}</span>
          </div>
          {dungeon.modifiers.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {dungeon.modifiers.map((m) => (
                <span key={m.id} title={m.description} className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                  {m.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bandeau raid */}
      {raid && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-950/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-rose-300">☠️ {raid.name}</span>
            <button onClick={abandonRaid} className="rounded bg-red-900/50 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-900/70">
              Abandonner
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Boss <span className="text-slate-200">{raid.current + 1}/{raid.totalBosses}</span></span>
            {raid.mechanics.includes('berserk') && (
              <span className={raid.fightTime >= raid.berserkAt ? 'font-semibold text-rose-400' : 'text-amber-300'}>
                ⏱️ {raid.fightTime >= raid.berserkAt ? 'ENRAGE MORTEL !' : `${Math.max(0, Math.ceil(raid.berserkAt - raid.fightTime))}s avant enrage`}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {raid.mechanics.map((m) => (
              <span key={m} title={RAID_MECHANIC_META[m].desc} className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] text-rose-200">
                {RAID_MECHANIC_META[m].icon} {RAID_MECHANIC_META[m].name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Verrou de palier (farm) */}
      {!dungeon && !raid && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0d111a] px-3 py-2 text-xs">
          <span className="text-slate-400">Palier de farm</span>
          <div className="flex items-center rounded-lg border border-slate-700">
            <button onClick={() => setStage(stage - 1)} disabled={stage <= 1} className="px-2 py-0.5 text-slate-300 hover:bg-white/5 disabled:opacity-30">−</button>
            <span className="w-10 text-center tabular-nums text-slate-100">{stage}</span>
            <button onClick={() => setStage(stage + 1)} disabled={stage >= bestStage} className="px-2 py-0.5 text-slate-300 hover:bg-white/5 disabled:opacity-30">+</button>
          </div>
          <span className="text-slate-500">/ {bestStage}</span>
          <button
            onClick={toggleFarmLock}
            title={farmLock ? 'Verrouillé : le combat reste à ce palier' : 'Libre : progression normale'}
            className={'ml-auto rounded-lg px-2.5 py-1 text-[11px] font-medium ' + (farmLock ? 'bg-amber-600 text-slate-950' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}
          >
            {farmLock ? '🔒 Verrouillé' : '🔓 Libre'}
          </button>
        </div>
      )}

      {/* Ennemi */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#1a1420] to-[#11151f] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          {raid ? (
            <span className="text-rose-300">Raid · Tier {raid.tier}</span>
          ) : dungeon ? (
            <span className="text-amber-300">Donjon niv. {dungeon.level}</span>
          ) : (
            <span>
              Palier <span className="font-semibold text-slate-200">{stage}</span>
              {boss && <span className="ml-2 text-rose-400">⚔ BOSS</span>}
            </span>
          )}
          <span>Record : {bestStage}</span>
        </div>

        <div className="mt-2 text-center">
          <div className={'text-lg font-bold ' + (boss ? 'text-rose-300' : 'text-slate-100')}>{enemy.name}</div>
          <div className="mt-2 h-5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={'h-full transition-all duration-150 ' + (boss ? 'bg-gradient-to-r from-rose-700 to-rose-500' : 'bg-gradient-to-r from-red-700 to-red-500')}
              style={{ width: `${enemyPct}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {Math.ceil(enemy.hp).toLocaleString('fr-FR')} / {enemy.maxHp.toLocaleString('fr-FR')} PV
          </div>
          <div className="mt-1 text-[11px]">
            <span className="text-slate-500">Frappe en </span>
            <span style={{ color: atkType.color }}>{atkType.icon} {atkType.name}</span>
            <span className="text-slate-600"> · résiste-y pour encaisser</span>
          </div>
        </div>

        {globalResist != null ? (
          <div className="mt-2 text-center text-[11px] text-slate-400">
            🛡 Résistance globale <span className="text-red-400">+{Math.round(globalResist * 100)}%</span>
            <span className="text-slate-600"> · contrée par la Pénétration</span>
          </div>
        ) : resistEntries.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px]">
            {resistEntries.map(([type, val]) => {
              const m = DAMAGE_TYPES[type]
              const resist = val > 0
              return (
                <span key={type} title={resist ? 'Résiste' : 'Vulnérable'}>
                  <span style={{ color: m.color }}>{m.icon} {m.name}</span>{' '}
                  <span className={resist ? 'text-red-400' : 'text-emerald-400'}>
                    {resist ? `+${Math.round(val * 100)}%` : `${Math.round(val * 100)}%`}
                  </span>
                </span>
              )
            })}
          </div>
        ) : null}
        {enemy.trait && (
          <div className="mt-1 text-center">
            <span className={'rounded px-1.5 py-0.5 text-[10px] font-medium ' + (enemy.elite ? 'bg-amber-600/30 text-amber-200' : 'bg-slate-700/60 text-slate-300')}>
              {enemy.elite ? '◆ ' : ''}{enemy.trait}
            </span>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <Metric label="DPS équipe" value={Math.round(partyDps).toLocaleString('fr-FR')} accent="text-emerald-300" />
          <Metric label="Dégâts ennemi/s" value={Math.round(enemy.damage).toLocaleString('fr-FR')} accent="text-red-300" />
        </div>
      </div>

      {/* Journal */}
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-[#0d111a] p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Journal</div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1 text-[12.5px] leading-snug">
          {log.map((e) => (
            <div key={e.id} className={LOG_COLORS[e.kind]}>
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Prochain objectif du joueur — sert de fil conducteur et annonce les déblocages. */
function nextObjective(bestStage: number, maxLevel: number): string | null {
  if (bestStage < 3) return 'Frappe ! Tue des ennemis pour ramasser du butin, puis équipe tes meilleures pièces dans l\'onglet 🎒 Stuff.'
  if (maxLevel <= TALENT_START_LEVEL) return `Monte un personnage au niveau ${TALENT_START_LEVEL + 1} (onglet 🛡 Perso) pour débloquer l'arbre de 🌌 Talents.`
  if (bestStage < 5) return 'Atteins le palier 5 pour débloquer les 🏰 Donjons — ta vraie source d\'or, d\'éclats et de ressources.'
  if (bestStage < 10) return 'Atteins le palier 10 pour débloquer le 🏪 Marché et ses améliorations permanentes.'
  if (bestStage < 50) return 'Atteins le palier 50 pour débloquer les ☠️ Raids (butin et ressources d\'élite).'
  return null
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/50 py-1.5">
      <div className={'font-semibold ' + (accent ?? 'text-slate-100')}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}
