import { useState } from 'react'
import { useGame, xpForLevel } from '../game/store'
import { describeStats, PRIMARY_META } from '../game/stats'
import type { StatEffect } from '../game/stats'
import type { PrimaryStat, DamageType, Character, PowerDef } from '../game/types'
import type { DerivedStats } from '../game/stats'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST, profileDamageMult } from '../game/damage'
import { charTotalStats, charDerived, charMaxHp, charDamageProfile, charResist, abilityPower, powerScale, dpsBreakdown } from '../game/character'
import { setBonuses, getSet } from '../game/sets'
import { getPower, POWER_EFFECT_META, scaleLabel, powerDamageType } from '../game/powers'
import { RAID_LIST, getRaidDef, raidUnlocked, raidReqs, type RaidId } from '../game/raids'
import { resistMult } from '../game/resist'
import { LevelBadge } from './LevelBadge'

const DMG_EFFECTS: ReadonlySet<string> = new Set(['nuke', 'cleave', 'dot', 'executeNuke', 'megaCleave', 'lifeNuke', 'rupture'])
// Effets dont la magnitude est une VALEUR affichable (dégâts/PV). Les autres (charge/marque/frénésie/
// immunité) ont une magnitude = MULTIPLICATEUR/durée → on n'affiche pas de « ≈ X » trompeur.
const VALUE_EFFECTS: ReadonlySet<string> = new Set([
  'nuke', 'cleave', 'dot', 'heal', 'hot', 'shield', 'buffParty',
  'executeNuke', 'megaCleave', 'lifeNuke', 'rupture', 'bigShield', 'bigHeal',
])

/** Détail chiffré d'une capacité active : type, cooldown réel, valeur théorique (1 chiffre). */
function powerDetail(p: PowerDef, derived: DerivedStats, weaponType: DamageType) {
  const value = Math.round((p.magnitude ?? 0) * abilityPower(derived, powerScale(p)))
  const cd = (p.cooldown ?? 0) * (1 - derived.cdr)
  const isDmg = DMG_EFFECTS.has(p.effect ?? '')
  // Sans type explicite, un sort de dégâts prend le type de l'ARME équipée (Ombre, Feu…).
  const type: DamageType | undefined = isDmg ? powerDamageType(p, weaponType) : p.damageType
  return { value, cd, type, dmg: isDmg, scale: scaleLabel(p), showValue: VALUE_EFFECTS.has(p.effect ?? '') }
}

const SPEC_INFO: Record<PrimaryStat, string> = {
  force: 'Guerrier de mêlée : la Force devient votre stat de combat.',
  agilite: 'Combattant rapide : l\'Agilité devient votre stat de combat.',
  intelligence: 'Mage de guerre : l\'Intelligence devient votre stat de combat.',
  endurance: '',
}

export type CharacterView = 'apercu' | 'stats' | 'capacites' | 'resist'

/** Fiche du personnage, éclatée en vues courtes (sous-onglets du hub Héros) :
 *  Aperçu = identité + spé + résumé combat · Stats = le détail chiffré · Capacités = les 5 slots. */
export function CharacterPanel({ view = 'apercu' }: { view?: CharacterView }) {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const renameCharacter = useGame((s) => s.renameCharacter)
  const setBias = useGame((s) => s.setBias)
  const [editName, setEditName] = useState<string | null>(null)
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
  const resist = charResist(char)
  const resistTypes = DAMAGE_TYPE_LIST.filter((t) => (resist[t] ?? 0) !== 0)
  const { primary, secondary } = describeStats(totalStats)
  const xpNeed = xpForLevel(char.level)
  const buildName = PRIMARY_META[derived.mainStat].name
  const dmg = charDamageProfile(char)
  const dmgTypes = DAMAGE_TYPE_LIST.filter((t) => (dmg.profile[t] ?? 0) > 0 || (dmg.bonus[t] ?? 0) > 0)

  return (
    <div className="space-y-3">
      {/* Sélecteur d'équipe (toutes vues) */}
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

      {view === 'apercu' && (
        <>
          {/* Identité */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#161c2a] to-[#0d111a] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <LevelBadge char={char} size={58} />
                <div className="min-w-0">
                {editName !== null ? (
                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={(e) => { e.preventDefault(); renameCharacter(activeChar, editName); setEditName(null) }}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={16}
                      className="w-36 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm font-bold text-slate-100 outline-none focus:border-orange-400"
                    />
                    <button type="submit" className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">✓</button>
                    <button type="button" onClick={() => setEditName(null)} className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-slate-300">✕</button>
                  </form>
                ) : (
                  <button onClick={() => setEditName(char.name)} className="group flex items-center gap-1.5 text-left" title="Renommer">
                    <span className="truncate text-lg font-bold text-slate-100">{char.name}</span>
                    <span className="text-xs text-slate-600 group-hover:text-slate-300">✏️</span>
                  </button>
                )}
                <div className="text-xs text-slate-400">
                  Niveau {char.level} · Build <span style={{ color: PRIMARY_META[derived.mainStat].color }}>{buildName}</span>
                </div>
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

          {/* Résumé combat */}
          <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Combat</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <Kv name="Puissance" value={Math.round(derived.power).toLocaleString('fr-FR')} />
              <Kv name="Points de vie" value={Math.round(maxHp).toLocaleString('fr-FR')} />
              <Kv name="Multiplicateur dég." value={`×${(derived.masteryMult * derived.overpower).toFixed(2)}`} />
              <Kv name="Vitesse" value={`${derived.attacksPerSecond.toFixed(2)} att/s`} />
            </div>
          </div>

          {/* Sets d'équipement actifs */}
          {(() => {
            const counts = setBonuses(char.equipment).counts
            const entries = Object.entries(counts)
            if (!entries.length) return null
            return (
              <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sets d'équipement</div>
                {entries.map(([id, n]) => {
                  const def = getSet(id)
                  if (!def) return null
                  return (
                    <div key={id}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold" style={{ color: def.color }}>⬢ {def.name}</span>
                        <span className="text-slate-400">{n}/{Object.keys(def.pieces).length}</span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {def.bonuses.map((b) => (
                          <div key={b.pieces} className={'text-[10.5px] leading-snug ' + (n >= b.pieces ? 'text-emerald-300' : 'text-slate-600')}>
                            ({b.pieces}) {n >= b.pieces ? '✓ ' : ''}{b.desc}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Résistances (v0.24 : POINTS — annulent l'exigence des boss, voir resist.ts) */}
          <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Résistances</div>
            {resistTypes.length === 0 ? (
              <p className="text-[11px] italic text-slate-500">
                Aucune résistance. Les boss EXIGENT des points de résistance : sous leur exigence, leurs
                attaques typées frappent jusqu'à ×5. Équipe des lignes/talents de résistance.
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {resistTypes.map((t) => {
                  const m = DAMAGE_TYPES[t]
                  const v = resist[t] ?? 0
                  return (
                    <span key={t} title={`${Math.round(v)} points de résistance ${m.name} (annule l'exigence des boss)`}>
                      <span style={{ color: m.color }}>{m.icon} {m.name}</span>{' '}
                      <span className="font-semibold text-emerald-300">{Math.round(v)}</span>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'stats' && (
        <>
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
            <div className="mb-1 text-[11.5px] text-slate-400">
              Type principal :{' '}
              <span style={{ color: DAMAGE_TYPES[dmg.mainType].color }}>
                {DAMAGE_TYPES[dmg.mainType].icon} {DAMAGE_TYPES[dmg.mainType].name}
              </span>{' '}
              (défini par l'arme)
            </div>
            <div className="mb-2 text-[12px] text-slate-300">
              Multiplicateur de dégâts :{' '}
              <span className="font-bold text-emerald-300">×{profileDamageMult(dmg).toFixed(2)}</span>
              <span className="text-slate-500"> · sur toutes tes attaques & sorts</span>
            </div>
            <div className="space-y-1">
              {dmgTypes.map((t) => {
                const m = DAMAGE_TYPES[t as DamageType]
                const frac = dmg.profile[t as DamageType] ?? 0
                const bonus = dmg.bonus[t as DamageType] ?? 0
                return (
                  <div key={t} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: m.color }}>{m.icon} {m.name}</span>
                    <span className="text-slate-400">
                      {frac > 0 && <span>{Math.round(frac * 100)}% du profil</span>}
                      {bonus > 0 && <span className="ml-2 text-emerald-400">+{Math.round(bonus * 100)}% dégâts</span>}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Empile des affixes « +% {DAMAGE_TYPES[dmg.mainType].name} » (ton type principal) pour faire monter le multiplicateur. Investir dans un type minoritaire rapporte peu : sa part du profil est faible.
            </p>
          </div>

          {/* Détail du DPS — exact par construction (mêmes formules que le DPS affiché) */}
          {(() => {
            const bd = dpsBreakdown(char)
            return (
              <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">🔬 Détail du DPS</span>
                  <span className="text-sm font-bold text-emerald-300">{Math.round(bd.total).toLocaleString('fr-FR')}</span>
                </div>
                <div className="space-y-1 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">⚔ Auto-attaque</span>
                    <span className="tabular-nums text-slate-100">{Math.round(bd.auto).toLocaleString('fr-FR')}</span>
                  </div>
                  {bd.spells.map((sp) => (
                    <div key={sp.name} className="flex items-center justify-between">
                      <span className="text-slate-400">✨ {sp.name}</span>
                      <span className="tabular-nums text-slate-300">{Math.round(sp.dps).toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-slate-800 pt-2 text-[10.5px]">
                  {bd.factors.map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="text-slate-500">{f.label}</span>
                      <span className="tabular-nums text-slate-300">{f.value}</span>
                    </div>
                  ))}
                </div>
                {bd.hasConversions && (
                  <p className="mt-2 rounded bg-amber-950/30 p-1.5 text-[10px] leading-snug text-amber-200/90">
                    ⚠️ Tes talents CONVERTISSENT des stats (ex. Endurance → offense) : une pièce défensive peut
                    donc réellement augmenter ton DPS.
                  </p>
                )}
                <p className="mt-1.5 text-[9.5px] leading-snug text-slate-600">
                  DPS « de fiche », hors cible : l'armure, les résistances/vulnérabilités, la Pénétration, les
                  Dégâts aux boss et les bonus conditionnels (PV bas, exécution, Maîtrise des Zones) s'appliquent en combat.
                </p>
              </div>
            )
          })()}
        </>
      )}

      {view === 'capacites' && <PowersSection char={char} />}

      {view === 'resist' && <ResistSection char={char} allChars={characters} />}
    </div>
  )
}

/**
 * PANNEAU RÉSIST (v0.24, DESIGN §6) — la résistance est en POINTS et c'est LE check de stuff
 * des raids : ce panneau montre tes 7 résistances ET, en face, les EXIGENCES du boss choisi
 * (raid en cours par défaut) avec le multiplicateur que tu subirais. Boss-aware (option C).
 */
function ResistSection({ char, allChars }: { char: Character; allChars: Character[] }) {
  const raid = useGame((s) => s.raid)
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const tierUnlocked = useGame((s) => s.raidTierUnlocked)
  const resist = charResist(char)

  // Raids consultables : débloqués uniquement. Par défaut : le raid EN COURS, sinon le premier.
  const unlockedRaids = RAID_LIST.filter((d) => raidUnlocked(d, bestStage, raidProgress))
  const [sel, setSel] = useState<string | null>(null)
  const selId = (raid?.raidId ?? sel ?? unlockedRaids[0]?.id) as RaidId | undefined
  const def = selId ? getRaidDef(selId) : undefined
  const tier = raid && def && raid.raidId === def.id ? raid.tier : def ? (tierUnlocked[def.id] ?? 1) : 1
  const reqs = def ? raidReqs(def, tier) : {}

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">🛡 Résistances (points)</div>
        <p className="mb-2 text-[10.5px] leading-snug text-slate-500">
          Les boss <b className="text-slate-300">exigent</b> des points de résistance : au cap → dégâts normaux (×1) ;
          sous le cap → jusqu'à <b className="text-rose-300">×5</b>. ≈0 en farm, modéré en donjon, décisif en raid.
          Sources : lignes d'objets, talents, effets uniques, sets, Quintessences.
        </p>

        {/* Sélecteur de boss (raid en cours prioritaire) */}
        {unlockedRaids.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {unlockedRaids.map((d) => (
              <button
                key={d.id}
                onClick={() => setSel(d.id)}
                disabled={!!raid}
                className={'rounded px-2 py-1 text-[10px] font-medium ' + (selId === d.id ? 'text-slate-950' : 'bg-slate-800 text-slate-400')}
                style={selId === d.id ? { background: d.color } : undefined}
              >
                {d.icon} {d.name.replace(/^(La |Le |L')/, '')}
              </button>
            ))}
            {def && <span className="self-center text-[10px] text-slate-500">Tier {tier}{raid && raid.raidId === def.id ? ' (en cours)' : ''}</span>}
          </div>
        )}

        <div className="space-y-1">
          {DAMAGE_TYPE_LIST.map((t) => {
            const m = DAMAGE_TYPES[t]
            const have = Math.round(resist[t] ?? 0)
            const req = Math.round(reqs[t] ?? 0)
            const mult = req > 0 ? resistMult(req, have) : 1
            const ok = req > 0 && mult <= 1
            const danger = req > 0 && mult > 1
            return (
              <div key={t} className="flex items-center justify-between text-[12px]">
                <span style={{ color: m.color }}>{m.icon} {m.name}</span>
                <span className="tabular-nums">
                  <span className={have > 0 ? 'font-semibold text-slate-200' : 'text-slate-600'}>{have}</span>
                  {req > 0 && (
                    <>
                      <span className="text-slate-600"> / {req}</span>
                      {ok && <span className="ml-1.5 text-emerald-400">✓ ×1</span>}
                      {danger && <span className="ml-1.5 font-semibold text-rose-400">×{mult.toFixed(1)}</span>}
                    </>
                  )}
                </span>
              </div>
            )
          })}
        </div>
        {def && (
          <p className="mt-2 text-[9.5px] leading-snug text-slate-600">
            Exigences de <span style={{ color: def.color }}>{def.name}</span> · Tier {tier}. Les types sans
            chiffre ne sont pas utilisés par ce boss.
          </p>
        )}
      </div>

      {/* Égide partagée : si un AUTRE membre partage sa résistance, le signaler. */}
      {allChars.length > 1 && (
        <p className="px-1 text-[9.5px] leading-snug text-slate-600">
          Les exigences frappent chaque membre individuellement (les novas touchent toute l'équipe) —
          vérifie chaque héros, ou investis dans « Égide partagée » (arbre Égide).
        </p>
      )}
    </>
  )
}

function PowersSection({ char }: { char: Character }) {
  const setPower = useGame((s) => s.setPower)
  const togglePowerAuto = useGame((s) => s.togglePowerAuto)
  const derived = charDerived(char)
  const weaponType = charDamageProfile(char).mainType
  const equipped = new Set(char.powers.filter(Boolean) as string[])
  const available = char.unlockedPowers.filter((id) => !equipped.has(id))

  return (
    <div className="rounded-xl border border-violet-800/40 bg-violet-950/10 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-300">Capacités (5 slots) · auto / manuel</div>
      <div className="grid grid-cols-1 gap-1.5">
        {char.powers.map((pid, slot) => {
          const p = pid ? getPower(pid) : null
          if (!p) {
            return <div key={slot} className="rounded-lg border border-slate-800 bg-black/20 px-2 py-1.5 text-[11px] italic text-slate-600">— emplacement {slot + 1} libre —</div>
          }
          const active = p.kind === 'active'
          const auto = char.powerAuto?.[slot] !== false
          const det = active ? powerDetail(p, derived, weaponType) : null
          return (
            <div key={slot} className="rounded-lg border border-slate-700 bg-black/20 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-slate-100">{p.name}</span>
                  <span className="text-[9px] uppercase tracking-wide text-slate-500">{active ? '⚡ Active' : '🛡 Passive'}</span>
                </span>
                {active && (
                  <button
                    onClick={() => togglePowerAuto(slot)}
                    title="Basculer entre lancement automatique et manuel (bouton en combat)"
                    className={'rounded px-2 py-1 text-[10px] font-semibold ' + (auto ? 'bg-cyan-600/30 text-cyan-200' : 'bg-amber-600/30 text-amber-200')}
                  >
                    {auto ? 'AUTO' : 'MANUEL'}
                  </button>
                )}
                <button onClick={() => setPower(slot, null)} className="rounded px-2 py-1 text-sm text-slate-500 hover:text-red-400" title="Retirer">✕</button>
              </div>
              {det && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
                  {det.type && <span style={{ color: DAMAGE_TYPES[det.type].color }}>{DAMAGE_TYPES[det.type].icon} {DAMAGE_TYPES[det.type].name}</span>}
                  <span>{POWER_EFFECT_META[p.effect ?? 'nuke'].label}</span>
                  {det.scale && <span className="text-amber-300/80">📈 {det.scale}</span>}
                  <span>CD {det.cd.toFixed(1)}s</span>
                  {det.showValue && <span className="text-slate-200">≈ {det.value.toLocaleString('fr-FR')} {det.dmg ? 'dég.' : 'PV'}</span>}
                </div>
              )}
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{p.description}</p>
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
                  className="rounded border border-violet-700/50 bg-violet-900/30 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-800/40 disabled:opacity-40"
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

/** Réinitialisation de la partie — affiché dans la feuille ⚙ Réglages (en-tête). */
export function ResetButton() {
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
