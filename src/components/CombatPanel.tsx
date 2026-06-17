import { useState } from 'react'
import { useGame, powerCooldowns, tutContext } from '../game/store'
import type { LogKind } from '../game/store'
import { TUT_QUESTS, tutDone, tutAllClaimed, tutClaimableCount, type TutCtx } from '../game/tutorial'
import { hasReward, formatInboxReward, inboxAttentionCount, type InboxMessage } from '../game/inbox'
import {
  dailyMetrics, dailyClaimableCount, getDailyQuest, questProgress, questDone, todayStr, msUntilReset,
  rewardLines, LOGIN_REWARDS, type DailyState, type DailyMetrics,
} from '../game/daily'
import {
  eventPoints, eventClaimableCount, msUntilEventEnd, invasionAuraId, EVENT_MILESTONES, INVASION_ELEMENTS, type EventState,
} from '../game/event'
import { getAura } from '../game/avatar'
import { Sheet } from './ui'
import { LevelBadge } from './LevelBadge'
import { charMaxHp, charDps, charResist, charCombatMods, TALENT_START_LEVEL } from '../game/character'
import { getAchievement } from '../game/achievements'
import { isBossStage } from '../game/enemies'
import { getPower, powerIcon } from '../game/powers'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RAID_MECHANIC_META } from '../game/raids'
import { BIOME_LIST, biomeUnlocked, biomeUnlockHint, getBiomeDef, BIOME_LOCK_FRAGMENTS, BIOME_LOCK_MS } from '../game/biomes'
import { maitriseBonus, maitriseSum, surgeBiome, surgeRemainingMs } from '../game/biomeBonus'
import type { Character, DamageType, Enemy, EnemyAbility, PowerDef } from '../game/types'

/** Filtres du journal plein écran (catégories de LogKind). */
const LOG_FILTERS: { id: string; label: string; kinds?: LogKind[] }[] = [
  { id: 'tout', label: 'Tout' },
  { id: 'butin', label: '🎒 Butin', kinds: ['loot', 'gold', 'craft'] },
  { id: 'combat', label: '⚔ Combat', kinds: ['hit', 'crit', 'kill', 'death'] },
  { id: 'progres', label: '⬆ Progrès', kinds: ['level', 'info'] },
]

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
  const activeBiome = useGame((s) => s.activeBiome)
  const biomeBest = useGame((s) => s.biomeBest)
  const lockBiome = useGame((s) => s.lockBiome)
  const fragments = useGame((s) => s.fragments)
  const nextRotateAt = useGame((s) => s.nextRotateAt)
  const biomeLockUntil = useGame((s) => s.biomeLockUntil)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const castPower = useGame((s) => s.castPower)
  const togglePowerAuto = useGame((s) => s.togglePowerAuto)
  const farmLock = useGame((s) => s.farmLock)
  const setStage = useGame((s) => s.setStage)
  const toggleFarmLock = useGame((s) => s.toggleFarmLock)
  const log = useGame((s) => s.log)
  // v0.31 — tutoriel « Premiers Pas »
  const inventory = useGame((s) => s.inventory)
  const dungeonProgress = useGame((s) => s.dungeonProgress)
  const tut = useGame((s) => s.tut)
  const claimTutorialReward = useGame((s) => s.claimTutorialReward)
  // ✉ Boîte de réception (v0.31.2) : gains à collecter, sortis de l'écran de combat.
  const inbox = useGame((s) => s.inbox)
  const claimInbox = useGame((s) => s.claimInbox)
  const claimAllInbox = useGame((s) => s.claimAllInbox)
  const markInboxSeen = useGame((s) => s.markInboxSeen)
  // 📅 Quotidien (v0.31.4) : contrats du jour + connexion.
  const daily = useGame((s) => s.daily)
  const totalKills = useGame((s) => s.totalKills)
  const totalDungeons = useGame((s) => s.totalDungeons)
  const metiers = useGame((s) => s.metiers)
  const claimDailyQuest = useGame((s) => s.claimDailyQuest)
  const claimLogin = useGame((s) => s.claimLogin)
  // 🎉 Event Invasion élémentaire (v0.31.5).
  const event = useGame((s) => s.event)
  const eventCosmetics = useGame((s) => s.eventCosmetics)
  const claimEventMilestone = useGame((s) => s.claimEventMilestone)

  // Biome + palier + verrou fusionnés en une ligne « zone » : le détail s'ouvre en feuille
  // (libère un tiers d'écran pour le journal sur mobile).
  const [zoneOpen, setZoneOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const [questsOpen, setQuestsOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [dailyOpen, setDailyOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [logFilter, setLogFilter] = useState('tout')

  const me = characters[activeChar] ?? characters[0]
  // Recharges courantes du perso actif (re-render à chaque tick → barre de cooldown vivante).
  const pcd = me ? powerCooldowns(me) : {}
  const castSlots = me ? me.powers.map((pid, slot) => ({ slot, p: pid ? getPower(pid) : null })).filter((x): x is { slot: number; p: PowerDef } => !!x.p && x.p.kind === 'active') : []

  const biomeDef = getBiomeDef(activeBiome)
  const physiqueBest = biomeBest.physique ?? 0
  // Cap de farm = record DANS LE BIOME ACTIF (pas le record global).
  const activeBiomeBest = Math.max(1, biomeBest[activeBiome] ?? 1)
  // Bonus de biome : surcharge tournante + Maîtrise des Zones (v0.25 : Élan supprimé).
  const surge = surgeBiome()
  const maitrise = maitriseBonus(biomeBest)

  // Donjons/raids = combat à PLUSIEURS adversaires. En combat classique, un seul ennemi.
  const enemies: Enemy[] = raid ? raid.enemies : dungeon ? dungeon.enemies : [normalEnemy]
  const enemy = enemies.find((e) => e.hp > 0) ?? enemies[0]
  const multi = enemies.length > 1
  const enemyDmgTotal = enemies.filter((e) => e.hp > 0).reduce((a, e) => a + e.damage, 0)
  const atkType = DAMAGE_TYPES[enemy.damageType]
  // Objectif courant (tutoriel léger + signalisation des déblocages progressifs).
  const maxLevel = characters.reduce((m, c) => Math.max(m, c.level), 1)
  const objective = nextObjective(bestStage, maxLevel, physiqueBest)
  // v0.31 — Journal « Premiers Pas » : actif tant que toutes les quêtes ne sont pas réclamées.
  const tutCtx = tutContext({ characters, activeChar, bestStage, inventory, dungeonProgress, tut })
  const tutActive = !tutAllClaimed(tut.claimed)
  // Récompenses de tuto prêtes à réclamer → red-dot de l'icône 🎯 flottante (cf. cluster live-ops).
  const tutClaimable = tutClaimableCount(tutCtx, tut.claimed)
  // ✉ Inbox : récompenses à réclamer + messages non lus → red-dot de l'icône ✉.
  const inboxAttention = inboxAttentionCount(inbox)
  // 📅 Quotidien : contrats finis non réclamés + connexion du jour → red-dot de l'icône 📅.
  const dailyMetricsNow = dailyMetrics({ totalKills, totalDungeons, metiers, bestStage })
  const dailyClaim = dailyClaimableCount(daily, dailyMetricsNow, todayStr())
  // 🎉 Event Invasion : paliers réclamables → red-dot 🎉. Icône débloquée avec les biomes élémentaires (palier 20).
  const eventUnlocked = bestStage >= 20
  const eventClaim = eventClaimableCount(event, totalKills)
  // Le cluster s'affiche hors instance (🎯 selon tuto · ✉/📅 toujours · 🎉 dès palier 20).
  const clusterVisible = !dungeon && !raid
  const partyDps = characters
    .filter((c) => c.hp > 0)
    .reduce((sum, c) => sum + charDps(c), 0)
  const resistEntries = Object.entries(enemy.resist ?? {}) as [DamageType, number][]
  // Affichage : « résistance globale » = valeur MAJORITAIRE (rampe de palier) ; les écarts
  // (thème de boss de raid) s'affichent en exceptions résiste/vulnérable.
  let globalResist: number | null = null
  let resistExceptions = resistEntries
  if (resistEntries.length >= 5) {
    const counts = new Map<number, number>()
    for (const [, v] of resistEntries) counts.set(v, (counts.get(v) ?? 0) + 1)
    let modeV = 0
    let modeC = 0
    for (const [v, c] of counts) if (c > modeC) { modeC = c; modeV = v }
    if (modeC >= 5) { globalResist = modeV; resistExceptions = resistEntries.filter(([, v]) => v !== modeV) }
  }
  const enemyPct = (enemy.hp / enemy.maxHp) * 100
  const boss = raid ? true : dungeon ? dungeon.current === dungeon.totalFights - 1 : isBossStage(stage)

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Bandeau du haut : fil conducteur (objectif, 1 ligne) à gauche + cluster live-ops à droite.
          Le cluster SORT de l'écran de combat le détail des quêtes (🎯) et la boîte de réception (✉) :
          chaque icône porte un red-dot = gains à réclamer. Rangée en flux normal (zéro chevauchement
          avec les contrôles de zone). Conçu pour s'étendre (events…). Masqué en donjon/raid. */}
      {!dungeon && !raid && (objective || clusterVisible) && (
        <div className="flex items-start justify-end gap-2">
          {objective && (
            <div className="min-w-0 flex-1 rounded-xl border border-orange-700/40 bg-orange-950/20 px-3 py-2 text-[11px] leading-snug text-orange-100">
              <span className="font-semibold text-orange-300">🎯 Objectif&nbsp;:</span> {objective}
            </div>
          )}
          {clusterVisible && (
            <div className="flex w-[88px] shrink-0 flex-wrap justify-end gap-2">
              {tutActive && (
                <button
                  onClick={() => setQuestsOpen(true)}
                  aria-label={`Premiers Pas — ${tutClaimable} récompense${tutClaimable > 1 ? 's' : ''} à réclamer`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-orange-700/50 bg-[#1a1320] text-xl active:scale-95"
                >
                  🎯
                  {tutClaimable > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#0d111a]">
                      {tutClaimable}
                    </span>
                  )}
                </button>
              )}
              {inbox.length > 0 && (
                <button
                  onClick={() => { setInboxOpen(true); markInboxSeen() }}
                  aria-label={`Boîte de réception — ${inboxAttention} à consulter`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-sky-700/50 bg-[#101a26] text-xl active:scale-95"
                >
                  ✉
                  {inboxAttention > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#0d111a]">
                      {inboxAttention}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setDailyOpen(true)}
                aria-label={`Quotidien — ${dailyClaim} récompense${dailyClaim > 1 ? 's' : ''} à réclamer`}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-emerald-700/50 bg-[#0d1a14] text-xl active:scale-95"
              >
                📅
                {dailyClaim > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#0d111a]">
                    {dailyClaim}
                  </span>
                )}
              </button>
              {eventUnlocked && (
                <button
                  onClick={() => setEventOpen(true)}
                  aria-label={`Invasion élémentaire — ${eventClaim} palier${eventClaim > 1 ? 's' : ''} à réclamer`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border text-xl active:scale-95"
                  style={{ borderColor: DAMAGE_TYPES[event.element].color + '80', background: '#160d14' }}
                >
                  🎉
                  {eventClaim > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#0d111a]">
                      {eventClaim}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
            {(dungeon.repeatLeft ?? 0) > 0 && (
              <span className="ml-2 rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-200" title="Relances automatiques restantes">🔁 {dungeon.repeatLeft} run{dungeon.repeatLeft! > 1 ? 's' : ''} en file</span>
            )}
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
            <span>
              {raid.totalBosses > 1 && <>Boss <span className="text-slate-200">{raid.current + 1}/{raid.totalBosses}</span></>}
              {(raid.repeatLeft ?? 0) > 0 && (
                <span className="ml-2 rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] text-rose-200" title="Relances automatiques restantes">🔁 {raid.repeatLeft}</span>
              )}
            </span>
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

      {/* Surcharge tournante : affichée uniquement dans la feuille Zone (cf. plus bas) pour ne pas encombrer l'écran sur mobile */}

      {/* Ligne « zone » : biome (→ feuille) + stepper de palier + cadenas, le tout inline */}
      {!dungeon && !raid && (
        <div className="flex w-full items-center gap-1 rounded-xl border border-slate-800 bg-[#0d111a] px-2 py-1.5 text-xs">
          <button onClick={() => setZoneOpen(true)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 hover:bg-white/5">
            <span className="shrink-0 text-slate-500">🧭</span>
            <span className="truncate font-semibold" style={{ color: biomeDef.color }}>{biomeDef.icon} {biomeDef.name}</span>
            <span className="shrink-0 text-slate-500">▸</span>
          </button>
          <button
            onClick={() => setStage(stage - 1)}
            disabled={stage <= 1}
            aria-label="Palier précédent"
            className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-30"
          >
            −
          </button>
          <span className="shrink-0 px-0.5 tabular-nums text-slate-400">
            <b className="text-slate-100">{stage}</b><span className="text-slate-600">/{activeBiomeBest}</span>
          </span>
          <button
            onClick={() => setStage(stage + 1)}
            disabled={stage >= activeBiomeBest}
            aria-label="Palier suivant"
            className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-30"
          >
            +
          </button>
          <button
            onClick={toggleFarmLock}
            title={farmLock ? 'Verrouillé — le combat reste à ce palier' : 'Libre — progression normale au fil des victoires'}
            aria-label="Verrou de farm"
            className={'shrink-0 rounded-lg px-2 py-1.5 text-sm ' + (farmLock ? 'bg-amber-600/30 text-amber-300' : 'text-slate-500 hover:bg-white/5')}
          >
            {farmLock ? '🔒' : '🔓'}
          </button>
        </div>
      )}

      {/* Feuille zone : choix du biome, palier, verrou de farm */}
      {zoneOpen && (
        <Sheet title="🧭 Zone de chasse" onClose={() => setZoneOpen(false)}>
          {/* v0.28 — la zone change AU HASARD toutes les ~1 h ; pour rester, on FORCE un biome (Fragments). */}
          {(() => {
            const now = Date.now()
            const locked = now < biomeLockUntil
            const mins = (ms: number) => Math.max(0, Math.ceil(ms / 60000))
            return (
              <div className={'mb-2 rounded-lg px-2 py-1.5 text-[10.5px] leading-snug ' + (locked ? 'bg-emerald-900/20 text-emerald-200' : 'bg-slate-800/40 text-slate-300')}>
                {locked
                  ? <>🔒 Forcé sur <b style={{ color: biomeDef.color }}>{biomeDef.icon} {biomeDef.name}</b> — encore ~{mins(biomeLockUntil - now)} min, puis rotation aléatoire.</>
                  : <>🧭 Rotation aléatoire — la zone change au hasard dans ~{mins(nextRotateAt - now)} min. Force un biome ({BIOME_LOCK_FRAGMENTS} ✨) pour y rester ~{Math.round(BIOME_LOCK_MS / 60000)} min (farm ciblé).</>}
              </div>
            )
          })()}
          <div className="grid grid-cols-4 gap-1.5">
            {BIOME_LIST.map((b) => {
              const unlocked = biomeUnlocked(b.id, physiqueBest, bestStage)
              const active = b.id === activeBiome
              const rec = biomeBest[b.id] ?? 0
              const affordable = fragments >= BIOME_LOCK_FRAGMENTS
              // Un biome déjà forcé (actif + verrou en cours) n'est pas re-forçable (éviter de re-payer).
              const forcedActive = active && Date.now() < biomeLockUntil
              return (
                <button
                  key={b.id}
                  disabled={!unlocked || !affordable || forcedActive}
                  onClick={() => lockBiome(b.id)}
                  title={!unlocked ? 'Biome verrouillé' : forcedActive ? 'Déjà forcé' : affordable ? `Forcer ce biome 1 h (${BIOME_LOCK_FRAGMENTS} ✨)` : `Pas assez de Fragments (${BIOME_LOCK_FRAGMENTS} ✨)`}
                  className={
                    'relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 transition-colors ' +
                    (active ? 'border-current bg-white/10' : unlocked ? 'border-slate-700 hover:border-slate-500' : 'border-slate-800 opacity-50')
                  }
                  style={active ? { color: b.color } : undefined}
                >
                  {surge === b.id && <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[10px] text-slate-950">⚡</span>}
                  <span className="text-xl leading-none">{unlocked ? b.icon : '🔒'}</span>
                  <span className={'w-full truncate text-center text-[10px] font-semibold ' + (active ? '' : 'text-slate-300')}>
                    {DAMAGE_TYPES[b.id].name}
                  </span>
                  <span className="text-[9px] text-slate-500">{unlocked ? (forcedActive ? '🔒 forcé' : active ? '◉ actif' : `🔒 ${BIOME_LOCK_FRAGMENTS}✨`) : ''}</span>
                  {unlocked && rec > 0 && <span className="text-[8px] text-slate-600">rec. {rec}</span>}
                </button>
              )
            })}
          </div>
          {(() => {
            const lockedBiome = BIOME_LIST.find((b) => !biomeUnlocked(b.id, physiqueBest, bestStage))
            return lockedBiome ? (
              <p className="mt-1.5 text-[10px] leading-snug text-slate-500">🔒 {biomeUnlockHint(lockedBiome.id)}</p>
            ) : null
          })()}

          {/* Bonus de biome : surcharge tournante + maîtrise des zones */}
          <div className="mt-3 space-y-1 rounded-lg bg-black/30 p-2 text-[10.5px] leading-snug">
            <div className="text-amber-300">
              ⚡ Surcharge : <span style={{ color: getBiomeDef(surge).color }}>{getBiomeDef(surge).icon} {getBiomeDef(surge).name}</span>
              <span className="text-slate-400"> — +50% or & XP, quintessence ×2 · change dans {Math.max(1, Math.ceil(surgeRemainingMs() / 60000))} min</span>
            </div>
            <div className="text-violet-300">
              🗺️ Maîtrise des Zones : <span className="font-semibold">+{(maitrise * 100).toFixed(1)}% dégâts</span>
              <span className="text-slate-400"> partout (somme des records : {maitriseSum(biomeBest)} / {7 * 150} — monte TOUS les biomes, ~5% à fond)</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">Palier</span>
            <div className="flex items-center rounded-lg border border-slate-700">
              <button onClick={() => setStage(stage - 1)} disabled={stage <= 1} className="px-4 py-2 text-base text-slate-300 hover:bg-white/5 disabled:opacity-30">−</button>
              <span className="w-12 text-center text-sm tabular-nums text-slate-100">{stage}</span>
              <button onClick={() => setStage(stage + 1)} disabled={stage >= activeBiomeBest} className="px-4 py-2 text-base text-slate-300 hover:bg-white/5 disabled:opacity-30">+</button>
            </div>
            <span className="text-xs text-slate-500">record : {activeBiomeBest}</span>
          </div>
          <button
            onClick={toggleFarmLock}
            className={'mt-3 w-full rounded-lg py-2.5 text-xs font-medium ' + (farmLock ? 'bg-amber-600 text-slate-950' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}
          >
            {farmLock ? '🔒 Verrouillé — le combat reste à ce palier' : '🔓 Libre — progression normale au fil des victoires'}
          </button>
        </Sheet>
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
          {multi ? (
            <>
              <div className="text-[11px] font-semibold text-slate-300">
                {enemies.filter((e) => e.hp > 0).length} adversaire{enemies.filter((e) => e.hp > 0).length > 1 ? 's' : ''}
              </div>
              <div className="mt-1.5 space-y-1">
                {enemies.map((e, i) => {
                  const pct = Math.max(0, (e.hp / e.maxHp) * 100)
                  const dead = e.hp <= 0
                  const isFocus = e === enemy
                  return (
                    <div key={e.uid ?? i} className={dead ? 'opacity-40' : ''}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={'truncate ' + (e.add ? 'text-rose-300/80' : 'text-slate-200')}>
                          {isFocus ? '🎯 ' : ''}{e.name}
                        </span>
                        <span className="ml-2 shrink-0 text-slate-500">{Math.ceil(Math.max(0, e.hp)).toLocaleString('fr-FR')}/{e.maxHp.toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="mt-0.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={'h-full transition-all duration-150 ' + (dead ? 'bg-slate-700' : e.add ? 'bg-gradient-to-r from-rose-800 to-rose-600' : 'bg-gradient-to-r from-red-700 to-red-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className={'text-lg font-bold ' + (boss ? 'text-rose-300' : 'text-slate-100')}>{enemy.name}</div>
              <div className="mt-2 h-5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={'h-full transition-all duration-150 ' + (boss ? 'bg-gradient-to-r from-rose-700 to-rose-500' : 'bg-gradient-to-r from-red-700 to-red-500')}
                  style={{ width: `${enemyPct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>{Math.ceil(enemy.hp).toLocaleString('fr-FR')} / {enemy.maxHp.toLocaleString('fr-FR')} PV</span>
                {(enemy.venomStacks ?? 0) > 0 && (
                  <span className="rounded bg-lime-500/20 px-1.5 py-px text-[10px] font-semibold text-lime-300" title="Stacks de venin : la Distillation les détone (dégâts × stacks)">
                    ☠ Venin ×{enemy.venomStacks}
                  </span>
                )}
                {(enemy.controlled ?? 0) > 0 && (
                  <span className="rounded bg-cyan-500/20 px-1.5 py-px text-[10px] font-semibold text-cyan-300" title="Gelé / contrôlé : tes sorts infligent un bonus de Fracas (shatter)">
                    ❄ Gelé {(enemy.controlled ?? 0).toFixed(1)}s
                  </span>
                )}
              </div>
            </>
          )}
          <div className="mt-1 text-[11px]">
            <span className="text-slate-500">Frappe en </span>
            <span style={{ color: atkType.color }}>{atkType.icon} {atkType.name}</span>
            <span className="text-slate-600"> · résiste-y pour encaisser</span>
          </div>
        </div>

        {globalResist != null && globalResist > 0 && (
          <div className="mt-2 text-center text-[11px] text-slate-400">
            🛡 Résistance globale <span className="text-red-400">+{Math.round(globalResist * 100)}%</span>
            <span className="text-slate-600"> · contrée par la Pénétration</span>
          </div>
        )}
        {(globalResist != null ? resistExceptions : resistEntries).length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px]">
            {(globalResist != null ? resistExceptions : resistEntries).map(([type, val]) => {
              const m = DAMAGE_TYPES[type]
              const resist = val > (globalResist ?? 0)
              const shown = globalResist != null ? val - globalResist : val
              return (
                <span key={type}>
                  <span style={{ color: m.color }}>{m.icon} {m.name}</span>{' '}
                  <span className={resist ? 'text-red-400' : 'text-emerald-400'}>
                    {resist ? `résiste +${Math.round(shown * 100)}%` : `vulnérable ${Math.round(shown * 100)}%`}
                  </span>
                </span>
              )
            })}
          </div>
        )}
        {enemy.trait && (
          <div className="mt-1 text-center">
            <span className={'rounded px-1.5 py-0.5 text-[10px] font-medium ' + (enemy.elite ? 'bg-amber-600/30 text-amber-200' : 'bg-slate-700/60 text-slate-300')}>
              {enemy.elite ? '◆ ' : ''}{enemy.trait}
            </span>
          </div>
        )}

        {/* Techniques de l'ennemi + télégraphe (barre de préavis sur les gros coups) */}
        {enemy.abilities && enemy.abilities.length > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {enemy.abilities.map((a, i) => (
                <span
                  key={i}
                  title={abilityHint(a)}
                  className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ color: DAMAGE_TYPES[a.element].color }}
                >
                  {a.icon} {a.name}
                </span>
              ))}
            </div>
            {(() => {
              const casting = enemy.abilities!.find((a) => (a.cast ?? 0) > 0 && a.telegraph)
              if (!casting) return null
              const frac = Math.min(1, Math.max(0, 1 - (casting.cast ?? 0) / (casting.telegraph ?? 1)))
              return (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-amber-300">
                    <span>⚠️ {casting.icon} {casting.name} — incantation&nbsp;!</span>
                    <span>{(casting.cast ?? 0).toFixed(1)}s</span>
                  </div>
                  <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-red-500" style={{ width: `${frac * 100}%` }} />
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <Metric label="DPS équipe" value={Math.round(partyDps).toLocaleString('fr-FR')} accent="text-emerald-300" />
          <Metric label={multi ? 'Dégâts pack/s' : 'Dégâts ennemi/s'} value={Math.round(enemyDmgTotal).toLocaleString('fr-FR')} accent="text-red-300" />
        </div>

        {/* A5 — récap PUISSANCE + RÉSISTANCES du héros piloté (lisible sans ouvrir le hub Héros).
            Le type infligé PAR l'ennemi courant est mis en avant (anneau). */}
        {me && (() => {
          const meResist = charResist(me)
          return (
            <div className="mt-2 border-t border-slate-800 pt-2">
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="min-w-0 truncate font-semibold uppercase tracking-wide text-slate-400">🛡 {me.name}</span>
                <span className="shrink-0 tabular-nums text-slate-300">
                  <span className="text-emerald-300">⚔ {Math.round(charDps(me)).toLocaleString('fr-FR')}</span>
                  {' · '}
                  <span className="text-sky-300">❤ {Math.round(charMaxHp(me)).toLocaleString('fr-FR')}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {DAMAGE_TYPE_LIST.map((t) => {
                  const m = DAMAGE_TYPES[t]
                  const v = Math.round(meResist[t] ?? 0)
                  const incoming = enemy.damageType === t
                  return (
                    <span
                      key={t}
                      title={`Résistance ${m.name} : ${v} points${incoming ? ' — type infligé par l\'ennemi actuel' : ''}`}
                      className={'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] tabular-nums ' + (incoming ? 'bg-black/40 ring-1 ring-rose-400/70' : 'bg-black/25')}
                      style={{ color: m.color }}
                    >
                      {m.icon} {v}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ÉQUIPE + CAPACITÉS fusionnées : une carte par héros (badge de niveau, PV, bouclier,
          altérations) → tap pour piloter ce héros ; ses sorts s'affichent juste en dessous.
          Posée bas d'écran : PV + sorts sous le pouce, à côté du journal (ergonomie mobile). */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#141a26] to-[#0d111a] p-2.5">
        <div className="space-y-1.5">
          {characters.map((c, i) => {
            const mh = charMaxHp(c)
            const pct = Math.max(0, Math.min(100, (c.hp / mh) * 100))
            const dead = c.hp <= 0
            const active = i === activeChar
            const single = characters.length === 1
            const chips = statusChips(c)
            // Bouclier d'absorption : segment cyan posé À LA SUITE des PV (visible sans encombrer).
            const shieldPct = (c.absorb ?? 0) > 0 ? Math.max(0, Math.min(100 - pct, ((c.absorb ?? 0) / mh) * 100)) : 0
            return (
              <button
                key={c.id}
                onClick={() => setActiveChar(i)}
                disabled={single}
                title={single ? undefined : `Piloter ${c.name} (sorts manuels)`}
                className={
                  'flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors ' +
                  (active && !single
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : 'border-transparent bg-black/20 ' + (single ? '' : 'hover:border-slate-600'))
                }
              >
                <LevelBadge char={c} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className={'truncate font-semibold ' + (dead ? 'text-red-500/70 line-through' : 'text-slate-100')}>
                      {c.name}
                      {c.title && getAchievement(c.title)?.title && (
                        <span className="ml-1 text-[8.5px] font-normal italic text-amber-300/80">🎖 {getAchievement(c.title)!.title}</span>
                      )}
                      {active && !single && <span className="ml-1 text-[8.5px] font-normal text-orange-400">● actif</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {dead ? (
                        <span className="text-red-400">{(c.rez ?? 0) > 0 ? `↻ ${Math.ceil(c.rez!)} s` : 'K.O.'}</span>
                      ) : (
                        <>{Math.ceil(Math.max(0, c.hp)).toLocaleString('fr-FR')} <span className="text-slate-600">/ {Math.round(mh).toLocaleString('fr-FR')}</span></>
                      )}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={'absolute inset-y-0 left-0 transition-all duration-200 ' + (dead ? 'bg-red-900' : 'bg-gradient-to-r from-emerald-600 to-emerald-400')}
                      style={{ width: `${pct}%` }}
                    />
                    {shieldPct > 0 && (
                      <div className="absolute inset-y-0 bg-sky-400/70" style={{ left: `${pct}%`, width: `${shieldPct}%` }} />
                    )}
                  </div>
                  {chips.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {chips.map((s) => (
                        <span key={s.label} title={s.title} className={'rounded px-1 py-px text-[9px] leading-tight ' + s.cls}>
                          {s.icon} {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Sorts du héros piloté (AUTO = lancé seul · MANUEL = au tap) */}
        {castSlots.length > 0 && (
          <div className="mt-2 border-t border-slate-800 pt-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">⚔️ Sorts — {me!.name}</span>
              <span className="shrink-0 text-[8.5px] text-slate-600">AUTO = seul · MAN = au tap</span>
            </div>
            {/* Mobile : rangée horizontale scrollable (1 ligne) · Desktop : grille 3 colonnes */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
              {castSlots.map(({ slot, p }) => {
                const cd = pcd[p.id] ?? 0
                const ready = cd <= 0
                const auto = me!.powerAuto?.[slot] !== false
                const total = p.cooldown ?? 3
                const frac = ready ? 1 : Math.max(0, 1 - cd / total)
                const canTap = !auto && ready
                return (
                  <div
                    key={slot}
                    className={
                      'relative w-[68px] shrink-0 overflow-hidden rounded-lg border sm:w-auto ' +
                      (auto ? 'border-cyan-700/50 bg-cyan-950/20' : canTap ? 'border-amber-500 bg-amber-900/20' : 'border-slate-700 bg-black/20')
                    }
                  >
                    {/* Bascule AUTO/MANUEL (coin) */}
                    <button
                      onClick={() => togglePowerAuto(slot)}
                      title="Activer / désactiver le lancement automatique"
                      className={'absolute right-0.5 top-0.5 z-10 rounded px-1.5 py-1 text-[8px] font-bold ' + (auto ? 'bg-cyan-600/40 text-cyan-100' : 'bg-amber-600/40 text-amber-100')}
                    >
                      {auto ? 'AUTO' : 'MAN'}
                    </button>
                    {/* Zone de lancement (active uniquement en MANUEL & prête) */}
                    <button
                      disabled={!canTap}
                      onClick={() => castPower(slot)}
                      title={auto ? `${p.name} — lancement automatique` : ready ? `Lancer ${p.name}` : `${p.name} — ${cd.toFixed(1)} s`}
                      className="flex w-full flex-col items-center gap-0.5 px-1 pb-1.5 pt-2"
                    >
                      <span className="text-xl leading-none">{powerIcon(p)}</span>
                      <span className="w-full truncate text-center text-[8px] font-medium text-slate-300">{p.name}</span>
                      <span className={'text-[8px] font-semibold leading-none ' + (canTap ? 'text-amber-200' : 'text-slate-500')}>
                        {auto ? '⟳ auto' : ready ? '▶ lancer' : `${cd.toFixed(1)}s`}
                      </span>
                    </button>
                    {!ready && <div className="absolute bottom-0 left-0 h-0.5 bg-cyan-500" style={{ width: `${frac * 100}%` }} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Journal — zone réelle (min-height garanti) + plein écran filtrable au tap */}
      <div className="flex min-h-[120px] flex-1 flex-col rounded-xl border border-slate-800 bg-[#0d111a] p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Journal</span>
          <button
            onClick={() => setJournalOpen(true)}
            className="rounded bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
            aria-label="Agrandir le journal"
          >
            ⤢
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1 text-[12.5px] leading-snug">
          {log.map((e) => (
            <div key={e.id} className={LOG_COLORS[e.kind]}>
              {e.text}
            </div>
          ))}
        </div>
      </div>

      {/* Feuille « Premiers Pas » : la liste détaillée des quêtes + récompenses, sortie de l'écran de combat. */}
      {questsOpen && (
        <Sheet title={`🎯 Premiers Pas — ${tut.claimed.length}/${TUT_QUESTS.length}`} onClose={() => setQuestsOpen(false)}>
          <QuestList ctx={tutCtx} claimed={tut.claimed} onClaim={claimTutorialReward} />
        </Sheet>
      )}

      {/* Feuille ✉ Boîte de réception : les gains à collecter (cadeaux, hors-ligne, events). */}
      {inboxOpen && (
        <Sheet title="✉ Boîte de réception" onClose={() => setInboxOpen(false)}>
          <InboxList inbox={inbox} onClaim={claimInbox} onClaimAll={claimAllInbox} />
        </Sheet>
      )}

      {/* Feuille 📅 Quotidien : contrats du jour + connexion. */}
      {dailyOpen && (
        <Sheet title="📅 Quotidien" onClose={() => setDailyOpen(false)}>
          <DailyPanel daily={daily} metrics={dailyMetricsNow} onClaimQuest={claimDailyQuest} onClaimLogin={claimLogin} />
        </Sheet>
      )}

      {/* Feuille 🎉 Invasion élémentaire : event hebdomadaire (paliers → aura exclusive). */}
      {eventOpen && (
        <Sheet title="🎉 Invasion élémentaire" onClose={() => setEventOpen(false)}>
          <EventPanel event={event} totalKills={totalKills} collected={eventCosmetics.length} onClaim={claimEventMilestone} />
        </Sheet>
      )}

      {/* Journal plein écran */}
      {journalOpen && (
        <Sheet title="Journal de combat" onClose={() => setJournalOpen(false)}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {LOG_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setLogFilter(f.id)}
                className={'rounded-lg px-2.5 py-1.5 text-[11px] font-medium ' + (logFilter === f.id ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400')}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="h-[58vh] space-y-1 overflow-y-auto pr-1 text-[13px] leading-snug">
            {(() => {
              const kinds = LOG_FILTERS.find((f) => f.id === logFilter)?.kinds
              const entries = kinds ? log.filter((e) => kinds.includes(e.kind)) : log
              return entries.length === 0 ? (
                <div className="mt-6 text-center text-xs text-slate-600">Rien dans cette catégorie pour l'instant.</div>
              ) : (
                entries.map((e) => (
                  <div key={e.id} className={LOG_COLORS[e.kind]}>
                    {e.text}
                  </div>
                ))
              )
            })()}
          </div>
        </Sheet>
      )}
    </div>
  )
}

/** Pastilles d'état d'un héros (altérations + buffs transitoires) — lecture rapide « comment va-t-il ? ». */
function statusChips(c: Character): { icon: string; label: string; cls: string; title: string }[] {
  const out: { icon: string; label: string; cls: string; title: string }[] = []
  if ((c.stun ?? 0) > 0) out.push({ icon: '💫', label: 'étourdi', cls: 'bg-yellow-500/20 text-yellow-300', title: "Étourdi : n'attaque pas tant que ça dure" })
  if (c.dots && c.dots.length > 0) {
    const dps = c.dots.reduce((a, d) => a + d.dps, 0)
    out.push({ icon: '🩸', label: 'altéré', cls: 'bg-rose-500/20 text-rose-300', title: `Altération subie (DoT) ~${Math.round(dps).toLocaleString('fr-FR')}/s — Purge et résistance la réduisent` })
  }
  if (c.weaken) out.push({ icon: '🌀', label: 'affaibli', cls: 'bg-fuchsia-500/20 text-fuchsia-300', title: `Affaibli (malédiction) : dégâts ×${c.weaken.mult.toFixed(2)} — Purge en réduit la durée` })
  if ((c.healCut ?? 0) > 0) out.push({ icon: '🚫', label: 'soins coupés', cls: 'bg-red-500/20 text-red-300', title: 'Blessures mortelles : régénération fortement réduite' })
  if ((c.absorb ?? 0) > 0) out.push({ icon: '🛡', label: 'bouclier', cls: 'bg-sky-500/20 text-sky-200', title: `Bouclier d'absorption : ${Math.round(c.absorb!).toLocaleString('fr-FR')} PV encaissés avant la vie` })
  if ((c.invuln ?? 0) > 0) out.push({ icon: '💎', label: 'immunisé', cls: 'bg-cyan-500/20 text-cyan-200', title: 'Immunité aux dégâts directs' })
  if (c.frenzy) out.push({ icon: '🔥', label: 'frénésie', cls: 'bg-orange-500/20 text-orange-300', title: `Frénésie : dégâts ×${c.frenzy.mult.toFixed(2)}` })
  if (c.charge) out.push({ icon: '⚡', label: 'vengeance', cls: 'bg-amber-500/20 text-amber-300', title: 'Vengeance différée : la riposte frappe à expiration' })
  // RESSOURCE DE CLASSE (build/spend) — RÉSERVE UNIQUE partagée (char.combo) : TOUS les générateurs la
  // remplissent, TOUS les finisseurs la dépensent, MÊME entre classes. On scanne actifs ET générateurs
  // (les builders vivent dans c.generators depuis v0.30) ; on affiche les libellés distincts équipés.
  const cmods = charCombatMods(c)
  const resNames = [...new Set(
    [...c.powers, ...(c.generators ?? [])]
      .map((p) => (p ? getPower(p) : null))
      .filter((pw) => pw?.effect === 'builder' || pw?.effect === 'finisher')
      .map((pw) => pw?.resource ?? 'Combo'),
  )]
  if (resNames.length) {
    const combo = c.combo ?? 0
    const cap = 5 + cmods.comboCap
    out.push({ icon: '🗡', label: `${resNames.join(' / ')} ${combo}/${cap}`, cls: 'bg-violet-500/25 text-violet-200 font-semibold', title: 'Réserve UNIQUE partagée : tous tes générateurs la remplissent, tous tes finisseurs la dépensent — même entre classes.' })
  }
  // 🔥 PYROMANCIEN « Hot Streak » : Chaleur (à plein, ton prochain gros sort de feu est surpuissant).
  if (cmods.hotStreak) {
    const heat = Math.floor(c.heat ?? 0)
    const full = (c.heat ?? 0) >= cmods.hotStreak.cap
    out.push({ icon: '🔥', label: full ? `CHALEUR MAX (×${cmods.hotStreak.mult})` : `Chaleur ${heat}/${cmods.hotStreak.cap}`, cls: full ? 'bg-orange-500/40 text-orange-100 font-bold' : 'bg-orange-500/20 text-orange-300', title: 'Hot Streak : tes sorts de feu chargent la Chaleur (plus vite avec le Critique). À plein, ton prochain sort de feu DIRECT est surpuissant.' })
  }
  // ✨ ARCANISTE « Surcharge instable » : fenêtre de burst au plein de Charges.
  if ((c.overload ?? 0) > 0) {
    out.push({ icon: '✨', label: `Surcharge ${(c.overload ?? 0).toFixed(1)}s`, cls: 'bg-fuchsia-500/30 text-fuchsia-100 font-bold', title: 'Surcharge instable : dégâts de sorts ↑ et recharges ×2 — déclenchée au plein de Charges (qui sont consommées).' })
  }
  return out
}

/** Aide d'une technique ennemie : type + le contre du kit héros à privilégier. */
function abilityHint(a: EnemyAbility): string {
  const counter: Record<EnemyAbility['kind'], string> = {
    dot: 'résiste au type + Purge (+ régén)',
    burst: 'Barrière / Esquive / Réduction + résiste',
    cc: 'Ténacité',
    debuff: 'Purge',
    drain: 'Burst (tue-le vite) + résiste',
  }
  return `${a.name} · ${DAMAGE_TYPES[a.element].name} — contre : ${counter[a.kind]}`
}

/** Prochain objectif du joueur — sert de fil conducteur et annonce les déblocages (intro progressive). */
function nextObjective(bestStage: number, maxLevel: number, physiqueBest: number): string | null {
  if (bestStage < 3) return 'Frappe ! Tue des ennemis pour ramasser du butin, puis équipe tes meilleures pièces dans l\'onglet 🎒 Stuff.'
  if (bestStage < 10) return 'Les ennemis frappent de plus en plus fort : équipe-toi (Endurance, résistances). Le palier 10 débloque le 🏪 Marché — un boss t\'y attend.'
  if (bestStage < 12) return 'Palier 12 : l\'onglet 🔨 Atelier ouvre (forge, métiers). Recycle ton butin pour des ♦ éclats en attendant.'
  if (maxLevel <= TALENT_START_LEVEL) return `Monte un personnage au niveau ${TALENT_START_LEVEL + 1} (hub 🛡 Héros) pour débloquer l'arbre de 🌌 Talents.`
  if (physiqueBest < 20) return 'Atteins le palier 20 aux Champs de Bataille pour débloquer 4 nouveaux 🧭 biomes (Feu, Froid, Foudre, Nature) et les 🏰 Expéditions (donjons).'
  if (bestStage < 50) return 'Atteins le palier 50 (n\'importe quel biome) pour débloquer les ☠️ Raids (hub Expéditions) et les biomes Arcane & Ombre.'
  if (maxLevel < 100) return `Vise le niveau 100 — le soft cap (3-5 h de jeu) qui débloque des builds complets. Farme le 📚 Sanctuaire du Savoir pour l'XP. (Niv. actuel max : ${maxLevel})`
  return null
}

/** v0.31 — Liste de quêtes « Premiers Pas » (rendue DANS une feuille : pas d'encadré ni de repli ici,
 *  la Sheet fournit déjà le conteneur + le titre). Chaîne d'onboarding avec récompenses à réclamer. */
function QuestList({ ctx, claimed, onClaim }: { ctx: TutCtx; claimed: string[]; onClaim: (id: string) => void }) {
  return (
    <ul className="space-y-1.5">
      {TUT_QUESTS.map((q) => {
        const isClaimed = claimed.includes(q.id)
        const isDone = tutDone(q, ctx)
        const claimable = isDone && !isClaimed
        return (
          <li key={q.id} className={'rounded-lg px-2.5 py-2 ' + (isClaimed ? 'opacity-45' : claimable ? 'bg-orange-900/30 ring-1 ring-orange-500/40' : 'bg-slate-900/40')}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-orange-100">
                {isClaimed ? '✅' : isDone ? '🟡' : '⬜'} {q.icon} {q.title}
              </span>
              {claimable && (
                <button onClick={() => onClaim(q.id)} className="shrink-0 rounded bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-500 active:scale-95">
                  Réclamer 🎁
                </button>
              )}
            </div>
            {!isClaimed && <div className="mt-1 text-[11px] leading-snug text-orange-200/70">{q.desc}</div>}
            {!isClaimed && <div className="mt-1 text-[11px] font-medium text-amber-300/80">🎁 {q.rewardText}</div>}
          </li>
        )
      })}
    </ul>
  )
}

/** ✉ Liste de la boîte de réception (rendue dans une feuille) : gains à collecter + « Tout réclamer ». */
function InboxList({ inbox, onClaim, onClaimAll }: { inbox: InboxMessage[]; onClaim: (id: string) => void; onClaimAll: () => void }) {
  if (inbox.length === 0) {
    return <div className="py-6 text-center text-xs text-slate-500">Aucun message. Tes cadeaux et gains hors-ligne arriveront ici.</div>
  }
  const pending = inbox.filter((m) => !m.claimed && hasReward(m.reward)).length
  return (
    <div>
      {pending > 0 && (
        <button
          onClick={onClaimAll}
          className="mb-2 w-full rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-500 active:scale-95"
        >
          🎁 Tout réclamer ({pending})
        </button>
      )}
      <ul className="space-y-1.5">
        {inbox.map((m) => {
          const reward = hasReward(m.reward)
          const claimable = reward && !m.claimed
          return (
            <li key={m.id} className={'rounded-lg px-2.5 py-2 ' + (m.claimed ? 'opacity-45' : claimable ? 'bg-sky-900/25 ring-1 ring-sky-500/30' : 'bg-slate-900/40')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-slate-100">{m.icon} {m.title}</span>
                {claimable && (
                  <button onClick={() => onClaim(m.id)} className="shrink-0 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 active:scale-95">
                    Réclamer 🎁
                  </button>
                )}
                {m.claimed && reward && <span className="shrink-0 text-[10px] font-medium text-emerald-400">✅ réclamé</span>}
              </div>
              {m.body && <div className="mt-1 text-[11px] leading-snug text-slate-400">{m.body}</div>}
              {reward && <div className="mt-1 text-[11px] font-medium text-sky-300/90">🎁 {formatInboxReward(m.reward)}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 📅 Panneau Quotidien : connexion (calendrier 7 j) + 3 contrats du jour, rendu dans une feuille. */
function DailyPanel({ daily, metrics, onClaimQuest, onClaimLogin }: { daily: DailyState; metrics: DailyMetrics; onClaimQuest: (id: string) => void; onClaimLogin: () => void }) {
  const today = todayStr()
  const loginDay = ((daily.streak - 1) % LOGIN_REWARDS.length + LOGIN_REWARDS.length) % LOGIN_REWARDS.length // 0..6
  const loginClaimable = daily.date === today && daily.loginClaimed !== today
  const ms = msUntilReset()
  const resetIn = ms >= 3600000 ? `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min` : `${Math.max(1, Math.floor(ms / 60000))} min`
  return (
    <div className="space-y-3">
      <div className="text-center text-[10.5px] text-slate-500">↻ Réinitialisation dans {resetIn}</div>

      {/* Connexion quotidienne */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">🔔 Connexion — jour {loginDay + 1}/{LOGIN_REWARDS.length}</div>
        <div className="grid grid-cols-7 gap-1">
          {LOGIN_REWARDS.map((r, i) => {
            const isToday = i === loginDay
            const past = i < loginDay
            const line = rewardLines(r)[0]
            return (
              <div key={i} className={'flex flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1.5 ' + (isToday ? 'border-emerald-500 bg-emerald-900/30' : past ? 'border-slate-800 opacity-40' : 'border-slate-700')}>
                <span className="text-[8px] text-slate-500">J{i + 1}</span>
                <span className="text-base leading-none">{line.icon}</span>
                <span className="text-[8px] tabular-nums text-slate-400">{line.amount.toLocaleString('fr-FR')}</span>
              </div>
            )
          })}
        </div>
        <button
          disabled={!loginClaimable}
          onClick={onClaimLogin}
          className={'mt-2 w-full rounded-lg py-2 text-xs font-semibold ' + (loginClaimable ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95' : 'bg-slate-800 text-slate-500')}
        >
          {loginClaimable ? `Réclamer le jour ${loginDay + 1} 🎁` : '✅ Connexion réclamée aujourd\'hui'}
        </button>
      </div>

      {/* Contrats du jour */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Contrats du jour</div>
        <ul className="space-y-1.5">
          {daily.questIds.map((id) => {
            const q = getDailyQuest(id)
            if (!q) return null
            const prog = questProgress(q, metrics, daily.baseline)
            const done = questDone(q, metrics, daily.baseline)
            const claimed = daily.claimed.includes(id)
            return (
              <li key={id} className={'rounded-lg px-2.5 py-2 ' + (claimed ? 'opacity-45' : done ? 'bg-emerald-900/25 ring-1 ring-emerald-500/30' : 'bg-slate-900/40')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-slate-100">{claimed ? '✅' : done ? '🟡' : '⬜'} {q.icon} {q.title}</span>
                  {done && !claimed && (
                    <button onClick={() => onClaimQuest(id)} className="shrink-0 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 active:scale-95">
                      Réclamer 🎁
                    </button>
                  )}
                </div>
                {!claimed && (
                  <>
                    <div className="mt-1 text-[11px] leading-snug text-slate-400">{q.desc}</div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full bg-emerald-500" style={{ width: `${(prog / q.target) * 100}%` }} />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px]">
                      <span className="tabular-nums text-slate-500">{prog.toLocaleString('fr-FR')} / {q.target.toLocaleString('fr-FR')}</span>
                      <span className="font-medium text-emerald-300/80">🎁 {formatInboxReward(q.reward)}</span>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/** 🎉 Panneau Invasion élémentaire : header thématique + barre de points + paliers (capstone = aura). */
function EventPanel({ event, totalKills, collected, onClaim }: { event: EventState; totalKills: number; collected: number; onClaim: (index: number) => void }) {
  const el = DAMAGE_TYPES[event.element]
  const pts = eventPoints(event, totalKills)
  const max = EVENT_MILESTONES[EVENT_MILESTONES.length - 1].points
  const ms = msUntilEventEnd()
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const ends = days > 0 ? `${days} j ${hours} h` : `${Math.max(1, hours)} h`
  const auraName = getAura(invasionAuraId(event.element))?.name
  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-2.5 text-center" style={{ borderColor: el.color + '66', background: el.color + '14' }}>
        <div className="text-sm font-bold" style={{ color: el.color }}>{el.icon} Invasion de {el.name}</div>
        <div className="text-[10.5px] text-slate-400">L'élément {el.name} déferle sur les terres — finit dans {ends}</div>
        <div className="mt-1.5 text-[11px] text-slate-300">Points d'invasion : <b style={{ color: el.color }}>{pts.toLocaleString('fr-FR')}</b> <span className="text-slate-600">/ {max.toLocaleString('fr-FR')}</span></div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full" style={{ width: `${Math.min(100, (pts / max) * 100)}%`, background: el.color }} />
        </div>
        <div className="mt-1 text-[9.5px] text-slate-500">Gagne des points en tuant des ennemis (tout biome). Reset hebdomadaire.</div>
      </div>

      <ul className="space-y-1.5">
        {EVENT_MILESTONES.map((m, i) => {
          const reached = pts >= m.points
          const claimed = event.claimed.includes(i)
          const claimable = reached && !claimed
          return (
            <li key={i} className={'rounded-lg px-2.5 py-2 ' + (claimed ? 'opacity-45' : claimable ? 'bg-emerald-900/25 ring-1 ring-emerald-500/30' : 'bg-slate-900/40')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-slate-100">{claimed ? '✅' : reached ? '🟡' : '⬜'} Palier {i + 1} — {m.points.toLocaleString('fr-FR')} pts</span>
                {claimable && (
                  <button onClick={() => onClaim(i)} className="shrink-0 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 active:scale-95">
                    Réclamer 🎁
                  </button>
                )}
              </div>
              <div className="mt-1 text-[11px] font-medium text-emerald-300/80">
                🎁 {formatInboxReward(m.reward)}{m.aura ? <span style={{ color: el.color }}> · 🏅 Aura exclusive « {auraName} »</span> : null}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="text-center text-[10px] text-slate-500">🏅 Auras d'invasion collectées : <b className="text-slate-300">{collected}</b> / {INVASION_ELEMENTS.length} — équipe-les dans 🛡 Héros → Apparence.</div>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/50 py-1.5">
      <div className={'font-semibold ' + (accent ?? 'text-slate-100')}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}
