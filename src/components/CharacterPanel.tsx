import { useState } from 'react'
import { useGame, xpForLevel } from '../game/store'
import { describeStats, PRIMARY_META } from '../game/stats'
import type { StatEffect } from '../game/stats'
import type { PrimaryStat, DamageType, Character } from '../game/types'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { charTotalStats, charDerived, charMaxHp, charDamageProfile } from '../game/character'
import { getPower } from '../game/powers'
import { TALENT_BRANCHES, talentsByBranch, canAllocate, type TalentBranch } from '../game/talents'

const SPEC_INFO: Record<PrimaryStat, string> = {
  force: 'Guerrier de mêlée : la Force devient votre stat de combat.',
  agilite: 'Combattant rapide : l\'Agilité devient votre stat de combat.',
  intelligence: 'Mage de guerre : l\'Intelligence devient votre stat de combat.',
  endurance: '',
}

export function CharacterPanel() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const setBias = useGame((s) => s.setBias)
  const gold = useGame((s) => s.gold)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const orbes = useGame((s) => s.orbes)
  const fragments = useGame((s) => s.fragments)

  const char = characters[activeChar] ?? characters[0]
  if (!char) return null
  const totalStats = charTotalStats(char)
  const derived = charDerived(char)
  const maxHp = charMaxHp(char)
  const { primary, secondary } = describeStats(totalStats)
  const xpNeed = xpForLevel(char.level)
  const buildName = PRIMARY_META[derived.mainStat].name
  const dmg = charDamageProfile(char)
  const dmgTypes = DAMAGE_TYPE_LIST.filter((t) => (dmg.profile[t] ?? 0) > 0 || (dmg.bonus[t] ?? 0) > 0)

  return (
    <div className="space-y-3">
      {/* Sélecteur d'équipe */}
      {characters.length > 1 && (
        <div className="flex gap-1.5">
          {characters.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActiveChar(i)}
              className={
                'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ' +
                (i === activeChar ? 'border-orange-400 bg-orange-500/10 text-orange-200' : 'border-slate-700 text-slate-400 hover:border-slate-500')
              }
            >
              {c.name} <span className="text-slate-500">N{c.level}</span>
            </button>
          ))}
        </div>
      )}

      {/* Identité */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#161c2a] to-[#0d111a] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-100">{char.name}</div>
            <div className="text-xs text-slate-400">
              Niveau {char.level} · Build <span style={{ color: PRIMARY_META[derived.mainStat].color }}>{buildName}</span>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-yellow-400">💰 {gold.toLocaleString('fr-FR')} or</div>
            <div className="text-cyan-300">♦ {essence.toLocaleString('fr-FR')} éclats</div>
            <div className="text-fuchsia-300">💠 {noyau.toLocaleString('fr-FR')} noyaux</div>
            {orbes > 0 && <div className="text-rose-300">🔮 {orbes.toLocaleString('fr-FR')} orbes</div>}
            {fragments > 0 && <div className="text-sky-300">✨ {fragments.toLocaleString('fr-FR')} fragments</div>}
          </div>
        </div>
        <Bar label="Vie" value={char.hp} max={maxHp} color="from-emerald-600 to-emerald-400" />
        <Bar label="Expérience" value={char.xp} max={xpNeed} color="from-violet-600 to-violet-400" />
      </div>

      {/* Capacités équipables */}
      <PowersSection char={char} />

      {/* Arbre de talents */}
      <TalentsSection char={char} />

      {/* Spécialisation */}
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Spécialisation</div>
        <p className="mb-2 text-[11.5px] leading-snug text-slate-400">
          Choisit la <b className="text-slate-300">stat de combat</b> de ce perso : seule la stat dominante alimente sa
          puissance. +2 dedans (et +1 Endurance) par niveau, et le butin penche vers cette stat.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {(['force', 'agilite', 'intelligence'] as PrimaryStat[]).map((p) => (
            <button
              key={p}
              onClick={() => setBias(p)}
              title={SPEC_INFO[p]}
              className={
                'rounded-lg border px-2 py-2 text-xs font-medium transition-colors ' +
                (char.primaryBias === p ? 'border-transparent text-slate-950' : 'border-slate-700 text-slate-300 hover:border-slate-500')
              }
              style={char.primaryBias === p ? { background: PRIMARY_META[p].color } : undefined}
            >
              {PRIMARY_META[p].name}
            </button>
          ))}
        </div>
      </div>

      {/* Stats primaires */}
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stats primaires</div>
        <div className="space-y-2">{primary.map((e) => <EffectRow key={e.key} e={e} />)}</div>
      </div>

      {/* Stats secondaires */}
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stats secondaires</div>
        <div className="space-y-2">{secondary.map((e) => <EffectRow key={e.key} e={e} />)}</div>
      </div>

      {/* Profil de dégâts */}
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Profil de dégâts</div>
        <div className="mb-2 text-[11.5px] text-slate-400">
          Type principal :{' '}
          <span style={{ color: DAMAGE_TYPES[dmg.mainType].color }}>
            {DAMAGE_TYPES[dmg.mainType].icon} {DAMAGE_TYPES[dmg.mainType].name}
          </span>{' '}
          (défini par l'arme)
        </div>
        <div className="space-y-1">
          {dmgTypes.map((t) => {
            const m = DAMAGE_TYPES[t as DamageType]
            const frac = dmg.profile[t as DamageType] ?? 0
            const bonus = dmg.bonus[t as DamageType] ?? 0
            const eff = frac * (1 + bonus)
            return (
              <div key={t} className="flex items-center justify-between text-sm">
                <span style={{ color: m.color }}>{m.icon} {m.name}</span>
                <span className="text-slate-300">
                  {frac > 0 && <span>×{eff.toFixed(2)} dégâts</span>}
                  {bonus > 0 && <span className="ml-2 text-emerald-400">+{Math.round(bonus * 100)}%</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Combat */}
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Combat</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <Kv name="Puissance" value={Math.round(derived.power).toLocaleString('fr-FR')} />
          <Kv name="Points de vie" value={Math.round(maxHp).toLocaleString('fr-FR')} />
          <Kv name="Multiplicateur dég." value={`×${(derived.masteryMult * derived.versatilityMult).toFixed(2)}`} />
          <Kv name="Vitesse" value={`${derived.attacksPerSecond.toFixed(2)} att/s`} />
        </div>
      </div>

      {/* Paramètres */}
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Paramètres</div>
        <ResetButton />
      </div>
    </div>
  )
}

function PowersSection({ char }: { char: Character }) {
  const setPower = useGame((s) => s.setPower)
  const equipped = new Set(char.powers.filter(Boolean) as string[])
  const available = char.unlockedPowers.filter((id) => !equipped.has(id))

  return (
    <div className="rounded-xl border border-violet-800/40 bg-violet-950/10 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-300">Capacités (5 slots)</div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {char.powers.map((pid, slot) => {
          const p = pid ? getPower(pid) : null
          return (
            <div key={slot} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-black/20 px-2 py-1.5">
              {p ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-slate-100">{p.name}</span>
                    <span className="text-[9px] uppercase tracking-wide text-slate-500">{p.kind === 'active' ? '⚡ Active' : '🛡 Passive'}</span>
                  </span>
                  <button onClick={() => setPower(slot, null)} className="rounded px-1 text-[11px] text-slate-500 hover:text-red-400" title="Retirer">✕</button>
                </>
              ) : (
                <span className="text-[11px] italic text-slate-600">— emplacement libre —</span>
              )}
            </div>
          )
        })}
      </div>

      {available.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] text-slate-500">Capacités débloquées à équiper :</div>
          <div className="flex flex-wrap gap-1">
            {available.map((id) => {
              const p = getPower(id)
              if (!p) return null
              const emptySlot = char.powers.indexOf(null)
              return (
                <button
                  key={id}
                  disabled={emptySlot < 0}
                  onClick={() => setPower(emptySlot, id)}
                  title={p.description}
                  className="rounded border border-violet-700/50 bg-violet-900/30 px-1.5 py-0.5 text-[10px] text-violet-200 hover:bg-violet-800/40 disabled:opacity-40"
                >
                  {p.kind === 'active' ? '⚡' : '🛡'} {p.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TalentsSection({ char }: { char: Character }) {
  const allocateTalent = useGame((s) => s.allocateTalent)
  const respecTalents = useGame((s) => s.respecTalents)
  const gold = useGame((s) => s.gold)
  const respecCost = 200 * char.level
  const spent = Object.values(char.talents).reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Arbre de talents</span>
        <span className="text-xs text-amber-300">{char.talentPoints} point{char.talentPoints > 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(TALENT_BRANCHES) as TalentBranch[]).map((b) => {
          const meta = TALENT_BRANCHES[b]
          return (
            <div key={b} className="rounded-lg bg-black/20 p-2">
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: meta.color }}>
                {meta.icon} {meta.name} <span className="text-slate-500">· {meta.role}</span>
              </div>
              <div className="space-y-1">
                {talentsByBranch(b).map((node) => {
                  const rank = char.talents[node.id] ?? 0
                  const can = canAllocate(node, char.talents, char.talentPoints)
                  const locked = node.requires && (char.talents[node.requires] ?? 0) <= 0
                  return (
                    <button
                      key={node.id}
                      disabled={!can}
                      onClick={() => allocateTalent(node.id)}
                      title={node.description + (locked ? ' (prérequis manquant)' : '')}
                      className={
                        'flex w-full items-center justify-between rounded border px-1.5 py-1 text-left text-[10px] transition-colors ' +
                        (rank > 0 ? 'border-indigo-500/60 bg-indigo-900/30 text-indigo-100' : locked ? 'border-slate-800 text-slate-600' : 'border-slate-700 text-slate-300 enabled:hover:bg-white/5')
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{node.unlockPower ? '✦ ' : ''}{node.name}</span>
                      <span className="ml-1 tabular-nums text-slate-400">{rank}/{node.maxRank}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {spent > 0 && (
        <button
          onClick={respecTalents}
          disabled={gold < respecCost}
          className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
        >
          Réinitialiser les talents · 💰 {respecCost}
        </button>
      )}
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="mt-2">
      <div className="mb-0.5 flex justify-between text-[10px] text-slate-500">
        <span>{label}</span>
        <span>{Math.ceil(value).toLocaleString('fr-FR')} / {Math.round(max).toLocaleString('fr-FR')}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={'h-full bg-gradient-to-r transition-all ' + color} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EffectRow({ e }: { e: StatEffect }) {
  return (
    <div title={e.desc}>
      <div className="flex items-center justify-between">
        <span style={{ color: e.active ? e.color : '#64748b' }} className="text-sm font-medium">{e.name}</span>
        <span className="text-sm font-semibold text-slate-100">{Math.round(e.rating).toLocaleString('fr-FR')}</span>
      </div>
      <div className={'text-[11px] ' + (e.active ? 'text-slate-400' : 'text-slate-600 italic')}>{e.effect}</div>
    </div>
  )
}

function Kv({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{name}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  )
}

function ResetButton() {
  const reset = useGame((s) => s.reset)
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-red-300">Effacer définitivement ta partie (équipe, stuff, ressources) ?</p>
        <div className="flex gap-2">
          <button onClick={() => { reset(); setConfirm(false) }} className="flex-1 rounded-lg bg-red-700 py-2 text-xs font-semibold text-white hover:bg-red-600">
            Oui, tout effacer
          </button>
          <button onClick={() => setConfirm(false)} className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-600">Annuler</button>
        </div>
      </div>
    )
  }
  return (
    <button onClick={() => setConfirm(true)} className="w-full rounded-lg bg-red-900/40 py-2 text-xs font-medium text-red-300 hover:bg-red-900/60">
      🗑 Réinitialiser la partie
    </button>
  )
}
