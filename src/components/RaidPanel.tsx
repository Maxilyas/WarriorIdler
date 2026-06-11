import { useState } from 'react'
import { useGame } from '../game/store'
import {
  RAID_LIST, RAID_UNLOCK_STAGE, RAID_MECHANIC_META, getRaidDef, raidUnlocked,
  raidBossVariant, raidIlvl, raidBerserkTime, raidFragments, raidCosmicChance,
  raidMinTier, raidMaxTier, raidReqs, recommendedDps, recommendedEhp, type RaidDef,
} from '../game/raids'
import { charDps, charMaxHp, charResist } from '../game/character'
import { resistMult } from '../game/resist'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RARITY_LIST } from '../game/rarities'
import type { Character, DamageType } from '../game/types'

/** Valeur « ∞ » du sélecteur de répétitions (limité en pratique par les Orbes disponibles). */
const INF = 999
const REPEAT_PRESETS = [1, 3, 5, INF]

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

  const partyDps = characters.filter((c) => c.hp > 0).reduce((a, c) => a + charDps(c), 0)
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
        en <b className="text-slate-300">tiers indépendants</b>. Un raid = <b className="text-slate-300">un seul affrontement</b>,
        et <b className="text-rose-300">le boss change à chaque tier</b> (mécaniques différentes). Chaque tier vaincu
        débloque le suivant : butin de plus en plus haut en iLvl et en rareté, Fragments d'éternité et le
        rarissime <b className="text-violet-300">Éclat cosmique 💫</b>.
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
              characters={characters}
              onEnter={(tier, rep) => enterRaid(def.id, tier, rep)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * FICHE DE BOSS (v0.24 §5.4) : exigences de résistance du tier, type par type, face au
 * MEMBRE LE PLUS FAIBLE de l'équipe (les novas frappent tout le monde). Vert = au cap (×1),
 * orange = proche, rouge = déficit (le multiplicateur subi est affiché).
 */
function BossReqs({ def, tier, characters }: { def: RaidDef; tier: number; characters: Character[] }) {
  const reqs = raidReqs(def, tier)
  const types = DAMAGE_TYPE_LIST.filter((t) => (reqs[t] ?? 0) > 0)
  if (!types.length) return null
  const resists = characters.map((c) => charResist(c))
  return (
    <div className="mt-1.5 rounded-lg border border-slate-800 bg-black/20 px-2 py-1.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
        🛡 Exigences de résistance <span className="normal-case text-slate-600">(vs ton membre le plus exposé)</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {types.map((t) => {
          const req = reqs[t as DamageType] ?? 0
          const weakest = Math.min(...resists.map((r) => Math.round(r[t as DamageType] ?? 0)))
          const mult = resistMult(req, weakest)
          const ok = mult <= 1
          const close = !ok && weakest >= req * 0.6
          const m = DAMAGE_TYPES[t as DamageType]
          return (
            <span
              key={t}
              title={`${m.name} : exigence ${req} · toi ${weakest}${ok ? ' — au cap (×1)' : ` — dégâts subis ×${mult.toFixed(1)}`}`}
              className={
                'rounded px-1.5 py-0.5 text-[9.5px] font-medium ' +
                (ok ? 'bg-emerald-900/30 text-emerald-300' : close ? 'bg-amber-900/30 text-amber-300' : 'bg-rose-900/40 text-rose-300')
              }
            >
              {m.icon} {weakest}/{req}{ok ? ' ✓' : ` ×${mult.toFixed(1)}`}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function RaidCard({ def, unlocked, cleared, bestStage, orbes, busy, partyDps, partyHp, characters, onEnter }: {
  def: RaidDef
  unlocked: boolean
  cleared: number
  bestStage: number
  orbes: number
  busy: boolean
  partyDps: number
  partyHp: number
  characters: Character[]
  onEnter: (tier: number, repeat: number) => void
}) {
  const frontier = cleared + 1
  const [tier, setTier] = useState(frontier)
  const [repeat, setRepeat] = useState(1)
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
  const boss = raidBossVariant(def, t)

  return (
    <div className="rounded-lg border bg-[#11151f] p-2.5" style={{ borderColor: def.color + '40' }}>
      <div className="flex items-center justify-between">
        <div className="font-medium" style={{ color: def.color }}>{def.icon} {def.name}</div>
        <div className="text-[10px] text-slate-500">Record : tier {cleared}</div>
      </div>

      <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{def.lore}</div>
      {def.id === 'abysse' && (
        <div className="mt-1 text-[10px] leading-snug">
          <span className="text-rose-300">👿 DUO : deux boss simultanés aux pouvoirs distincts — le survivant entre en furie (+50%).</span>{' '}
          <span style={{ color: '#8a2be2' }}>⬢ Set exclusif : Régalia du Néant (bonus 2/4/6 pièces).</span>
        </div>
      )}

      {/* Boss du tier sélectionné : le visage (et les mécaniques) changent à chaque tier */}
      <div className="mt-1.5 rounded-lg border border-slate-800 bg-black/20 px-2 py-1.5">
        <div className="text-[11px] font-semibold" style={{ color: boss.awakened ? '#f87171' : def.color }}>
          ★ {boss.name}{boss.partnerName ? <span className="text-slate-400"> & {boss.partnerName}</span> : null}
        </div>
        <div className="mt-0.5 text-[9.5px] leading-snug text-slate-500">{boss.blurb}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9.5px] text-slate-300">🎁 {def.lootLabel}</span>
          {boss.mechanics.map((m) => (
            <span key={m} title={RAID_MECHANIC_META[m].desc} className="rounded bg-rose-900/30 px-1.5 py-0.5 text-[9.5px] text-rose-200">
              {RAID_MECHANIC_META[m].icon} {RAID_MECHANIC_META[m].name}
            </span>
          ))}
        </div>
      </div>

      {/* Fiche de boss : exigences de résistance du tier (prépare ton stuff) */}
      <BossReqs def={def} tier={t} characters={characters} />

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
          <span className="block text-[8.5px] text-slate-600">butin iLvl ~{raidIlvl(def, t)}</span>
        </div>
      </div>

      <div className="mt-1 text-[9.5px] text-slate-500">
        Récompense : ✨ {raidFragments(def, t)} fragments · 💫 {Math.round(raidCosmicChance(def, t) * 100)}%
        {def.element !== 'rotating' && <> · attaque {DAMAGE_TYPES[def.element].icon} {DAMAGE_TYPES[def.element].name}</>}
        {def.element === 'rotating' && <> · 🌈 éléments tournants</>}
      </div>

      <RarityRange def={def} tier={t} />

      {/* Auto-raid : nombre de raids enchaînés (consomme les Orbes à la volée) */}
      <div className="mt-2 flex items-center gap-1 text-[10px]">
        <span className="text-slate-500" title="Relances automatiques à la fin de chaque raid">🔁 Auto</span>
        {REPEAT_PRESETS.map((n) => (
          <button
            key={n}
            onClick={() => setRepeat(n)}
            className={'rounded px-2.5 py-1.5 font-semibold ' + (repeat === n ? 'bg-rose-600 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
          >
            {n === INF ? '∞' : '×' + n}
          </button>
        ))}
        <span className="ml-auto text-[8.5px] text-slate-600">{def.orbeCost} 🔮 / raid</span>
      </div>

      {/* Sélecteur de tier + lancement */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="flex items-center rounded-lg border border-slate-700">
          <button onClick={() => setTier((x) => Math.max(1, Math.min(frontier, x) - 1))} className="px-3 py-2.5 text-xs text-slate-300 hover:bg-white/5">−</button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-200">Tier {t}{isNew ? ' ★' : ''}</span>
          <button onClick={() => setTier((x) => Math.min(frontier, Math.max(1, x) + 1))} className="px-3 py-2.5 text-xs text-slate-300 hover:bg-white/5">+</button>
        </div>
        <button
          disabled={!canEnter}
          onClick={() => onEnter(t, repeat)}
          className="flex-1 rounded-lg py-2.5 text-xs font-semibold text-slate-50 disabled:opacity-40"
          style={{ background: canEnter ? def.color + 'cc' : '#1e2433' }}
        >
          {busy ? 'Indisponible' : orbes < def.orbeCost ? `Besoin de ${def.orbeCost} 🔮` : `Lancer tier ${t}${repeat > 1 ? (repeat === INF ? ' ∞' : ` ×${repeat}`) : ''} (${def.orbeCost} 🔮)`}
        </button>
      </div>
    </div>
  )
}

/** Affiche l'éventail de raretés possibles du butin (plancher garanti → plafond atteignable). */
function RarityRange({ def, tier }: { def: RaidDef; tier: number }) {
  const minR = RARITY_LIST.find((r) => r.tier === raidMinTier(def, tier))
  const maxR = RARITY_LIST.find((r) => r.tier === raidMaxTier(def, tier))
  if (!minR || !maxR) return null
  return (
    <div className="mt-1 text-[9.5px] text-slate-500">
      Rareté du butin :{' '}
      <span style={{ color: minR.color }}>{minR.name}</span>
      <span className="text-slate-600"> → </span>
      <span style={{ color: maxR.color }}>{maxR.name}</span>
      {minR.tier !== maxR.tier && <span className="text-slate-600"> (chances ↑ avec le tier)</span>}
    </div>
  )
}
