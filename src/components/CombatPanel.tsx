import { useState } from 'react'
import { useGame, powerCooldowns } from '../game/store'
import type { LogKind } from '../game/store'
import { charMaxHp, charDps, TALENT_START_LEVEL } from '../game/character'
import { isBossStage } from '../game/enemies'
import { getPower, powerIcon } from '../game/powers'
import { DAMAGE_TYPES } from '../game/damage'
import { RAID_MECHANIC_META } from '../game/raids'
import { BIOME_LIST, biomeUnlocked, biomeUnlockHint, getBiomeDef } from '../game/biomes'
import type { DamageType, Enemy, EnemyAbility, PowerDef } from '../game/types'

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
  const setBiome = useGame((s) => s.setBiome)
  const activeChar = useGame((s) => s.activeChar)
  const castPower = useGame((s) => s.castPower)
  const togglePowerAuto = useGame((s) => s.togglePowerAuto)
  const farmLock = useGame((s) => s.farmLock)
  const setStage = useGame((s) => s.setStage)
  const toggleFarmLock = useGame((s) => s.toggleFarmLock)
  const log = useGame((s) => s.log)

  // Le sélecteur de biome est replié par défaut sur mobile (rarement changé en combat → gagne de la
  // place ; le biome courant reste visible dans l'en-tête). Déplié par défaut sur grand écran.
  const [biomeOpen, setBiomeOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640)

  const me = characters[activeChar] ?? characters[0]
  // Recharges courantes du perso actif (re-render à chaque tick → barre de cooldown vivante).
  const pcd = me ? powerCooldowns(me) : {}
  const castSlots = me ? me.powers.map((pid, slot) => ({ slot, p: pid ? getPower(pid) : null })).filter((x): x is { slot: number; p: PowerDef } => !!x.p && x.p.kind === 'active') : []

  const biomeDef = getBiomeDef(activeBiome)
  const physiqueBest = biomeBest.physique ?? 0
  // Cap de farm = record DANS LE BIOME ACTIF (pas le record global).
  const activeBiomeBest = Math.max(1, biomeBest[activeBiome] ?? 1)

  // Donjons/raids = combat à PLUSIEURS adversaires. En combat classique, un seul ennemi.
  const enemies: Enemy[] = raid ? raid.enemies : dungeon ? dungeon.enemies : [normalEnemy]
  const enemy = enemies.find((e) => e.hp > 0) ?? enemies[0]
  const multi = enemies.length > 1
  const enemyDmgTotal = enemies.filter((e) => e.hp > 0).reduce((a, e) => a + e.damage, 0)
  const atkType = DAMAGE_TYPES[enemy.damageType]
  // Objectif courant (tutoriel léger + signalisation des déblocages progressifs).
  const maxLevel = characters.reduce((m, c) => Math.max(m, c.level), 1)
  const objective = nextObjective(bestStage, maxLevel, physiqueBest)
  const partyDps = characters
    .filter((c) => c.hp > 0)
    .reduce((sum, c) => sum + charDps(c), 0)
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
                  {(c.stun ?? 0) > 0 && <span className="ml-1 rounded bg-yellow-500/20 px-1 text-[9px] text-yellow-300" title="Étourdi : n'attaque pas">💫 étourdi</span>}
                  {c.dots && c.dots.length > 0 && <span className="ml-1 rounded bg-rose-500/20 px-1 text-[9px] text-rose-300" title="Altération subie (DoT) — Purge et résistance la réduisent">🩸 altéré</span>}
                  {c.weaken && <span className="ml-1 rounded bg-fuchsia-500/20 px-1 text-[9px] text-fuchsia-300" title="Affaibli (malédiction) — Purge en réduit la durée">✨ affaibli</span>}
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
              Boss <span className="text-slate-200">{raid.current + 1}/{raid.totalBosses}</span>
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

      {/* Sélecteur de biome (farm) — repliable (gagne de la place sur mobile) */}
      {!dungeon && !raid && (
        <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-2">
          <button
            onClick={() => setBiomeOpen((o) => !o)}
            className="flex w-full items-center justify-between py-1"
            title={biomeOpen ? 'Replier les biomes' : 'Déplier les biomes'}
          >
            <span className="text-[10px] uppercase tracking-wide text-slate-500">🧭 Biome</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: biomeDef.color }}>
              {biomeDef.icon} {biomeDef.name}
              <span className="text-slate-500">{biomeOpen ? '▾' : '▸'}</span>
            </span>
          </button>
          {biomeOpen && (
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {BIOME_LIST.map((b) => {
              const unlocked = biomeUnlocked(b.id, physiqueBest, bestStage)
              const active = b.id === activeBiome
              const rec = biomeBest[b.id] ?? 0
              return (
                <button
                  key={b.id}
                  disabled={!unlocked}
                  onClick={() => setBiome(b.id)}
                  title={unlocked ? `${b.name} — record palier ${rec}` : `🔒 ${biomeUnlockHint(b.id)}`}
                  className={
                    'flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-colors ' +
                    (active ? 'border-current bg-white/10' : unlocked ? 'border-slate-700 hover:border-slate-500' : 'border-slate-800 opacity-50')
                  }
                  style={active ? { color: b.color } : undefined}
                >
                  <span className="text-xl leading-none">{unlocked ? b.icon : '🔒'}</span>
                  <span className={'w-full truncate text-center text-[9px] font-semibold ' + (active ? '' : 'text-slate-300')}>
                    {DAMAGE_TYPES[b.id].name}
                  </span>
                  <span className="text-[8px] text-slate-500">{unlocked ? (rec > 0 ? `▸ ${rec}` : '—') : '🔒'}</span>
                </button>
              )
            })}
          </div>
          )}
        </div>
      )}

      {/* Verrou de palier (farm) */}
      {!dungeon && !raid && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0d111a] px-3 py-2 text-xs">
          <span className="text-slate-400">Palier</span>
          <div className="flex items-center rounded-lg border border-slate-700">
            <button onClick={() => setStage(stage - 1)} disabled={stage <= 1} className="px-3 py-2.5 text-slate-300 hover:bg-white/5 disabled:opacity-30">−</button>
            <span className="w-10 text-center tabular-nums text-slate-100">{stage}</span>
            <button onClick={() => setStage(stage + 1)} disabled={stage >= activeBiomeBest} className="px-3 py-2.5 text-slate-300 hover:bg-white/5 disabled:opacity-30">+</button>
          </div>
          <span className="text-slate-500" title={`Record en ${biomeDef.name}`}>/ {activeBiomeBest}</span>
          <button
            onClick={toggleFarmLock}
            title={farmLock ? 'Verrouillé : le combat reste à ce palier' : 'Libre : progression normale'}
            className={'ml-auto rounded-lg px-3 py-2 text-[11px] font-medium ' + (farmLock ? 'bg-amber-600 text-slate-950' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}
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
                    <div key={i} className={dead ? 'opacity-40' : ''}>
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
              <div className="mt-1 text-xs text-slate-400">
                {Math.ceil(enemy.hp).toLocaleString('fr-FR')} / {enemy.maxHp.toLocaleString('fr-FR')} PV
              </div>
            </>
          )}
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
      </div>

      {/* Capacités : icône de sort + bascule AUTO/MANUEL + lancement (tap quand MANUEL & prêt) */}
      {castSlots.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">⚔️ Capacités de {me!.name}</span>
            <span className="text-[8.5px] text-slate-600">AUTO = lancée seule · MANUEL = au tap</span>
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
                    <span className={'text-[8px] font-semibold leading-none ' + (canTap ? 'text-amber-200' : ready ? 'text-slate-500' : 'text-slate-500')}>
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
  if (bestStage < 5) return 'Les ennemis frappent de plus en plus fort : équipe-toi (Endurance, résistances). Le palier 5 débloque les 🏰 Donjons.'
  if (bestStage < 10) return 'Atteins le palier 10 pour débloquer le 🏪 Marché. Un boss t\'y attend : prépare ton stuff.'
  if (maxLevel <= TALENT_START_LEVEL) return `Monte un personnage au niveau ${TALENT_START_LEVEL + 1} (onglet 🛡 Perso) pour débloquer l'arbre de 🌌 Talents.`
  if (physiqueBest < 20) return 'Atteins le palier 20 aux Champs de Bataille pour débloquer 4 nouveaux 🧭 biomes (Feu, Froid, Foudre, Nature) — chacun son butin et ses menaces.'
  if (bestStage < 50) return 'Atteins le palier 50 (n\'importe quel biome) pour débloquer les ☠️ Raids et les biomes Arcane & Ombre.'
  if (maxLevel < 100) return `Vise le niveau 100 — le soft cap (3-5 h de jeu) qui débloque des builds complets. Farme le 📚 Sanctuaire du Savoir pour l'XP. (Niv. actuel max : ${maxLevel})`
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
