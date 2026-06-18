import { useMemo, useState } from 'react'
import { useGame } from '../game/store'
import {
  UNIQUE_EFFECTS, UNIQUE_ROLES, uniqueModsAtRank, uniqueResistAtRank,
  uniqueActiveText, UNIQUE_ACTIVE_RANK,
} from '../game/uniques'
import {
  ALL_STAT_META, PRIMARY_META, SECONDARY_META, RATING_PER_PERCENT, RARE_STATS,
} from '../game/stats'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { EFFECTIVE_DR_CAP } from '../game/combat'
import { POWERS } from '../game/powers'
import { TALENTS, CONSTELLATIONS } from '../game/talents'
import { TALENT_START_LEVEL } from '../game/character'
import type { StatKey, UniqueRole, SecondaryStat, OffensiveStat } from '../game/types'

const ROLE_META: Record<UniqueRole, { label: string; color: string; icon: string }> = {
  dps: { label: 'Dégâts', color: '#ff6b6b', icon: '⚔️' },
  heal: { label: 'Soin', color: '#51cf66', icon: '✚' },
  tank: { label: 'Tank', color: '#74c0fc', icon: '🛡' },
  resist: { label: 'Résistance', color: '#c084fc', icon: '🔯' },
  utility: { label: 'Utilitaire', color: '#ffd43b', icon: '✦' },
}

type CodexTab = 'stats' | 'capacites' | 'synergies' | 'uniques'

const TABS: { id: CodexTab; label: string; icon: string }[] = [
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'capacites', label: 'Capacités', icon: '✨' },
  { id: 'synergies', label: 'Synergies', icon: '🜂' },
  { id: 'uniques', label: 'Uniques', icon: '✦' },
]

export function GrimoirePanel() {
  const [tab, setTab] = useState<CodexTab>('stats')

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">📖 Codex</div>
        <div className="text-[11px] text-slate-500">Tout comprendre du jeu</div>
      </div>

      <div className="mb-2 flex gap-1 text-[11px]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={'flex-1 rounded px-2 py-2 font-medium ' + (tab === t.id ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200')}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === 'stats' && <StatsCodex />}
        {tab === 'capacites' && <PowersCodex />}
        {tab === 'synergies' && <SynergiesCodex />}
        {tab === 'uniques' && <UniquesCodex />}
      </div>
    </div>
  )
}

/* ----------------------------- STATS ----------------------------- */

const SECONDARY_GROUPS: { title: string; color: string; keys: SecondaryStat[] }[] = [
  { title: 'Offensif', color: '#ff8787', keys: ['critique', 'degatsCrit', 'hate', 'maitrise', 'penetration', 'precision', 'alteration', 'degatsBoss'] },
  { title: 'Défensif', color: '#74c0fc', keys: ['reductionDegats', 'esquive', 'barriere', 'tenacite', 'purge'] },
  { title: 'Soutien', color: '#94d82d', keys: ['regen'] },
  { title: 'RARES (très puissantes)', color: '#ffd43b', keys: ['volDeVie', 'surpuissance', 'multifrappe', 'recuperation'] },
]

function StatsCodex() {
  const offensive: OffensiveStat[] = ['force', 'agilite', 'intelligence']
  return (
    <div className="space-y-3">
      <Card>
        <Title color="#e2e8f0">Stats primaires</Title>
        <p className="mb-1.5 text-[10.5px] leading-snug text-slate-500">
          La <b className="text-slate-300">plus haute</b> de tes 3 stats offensives (Force / Agilité / Intelligence)
          détermine ton build : elle alimente l'auto-attaque et fixe ton archétype de Maîtrise. L'Endurance donne les PV.
        </p>
        {[...offensive, 'endurance' as const].map((k) => {
          const m = PRIMARY_META[k]
          return (
            <Row key={k} color={m.color} short={m.short} name={m.name} desc={m.desc} />
          )
        })}
        <div className="mt-1.5 rounded bg-purple-950/30 p-1.5 text-[10px] text-purple-200">
          Maîtrise selon l'archétype : <b>Force</b> = dégâts + réduction (bruiser) · <b>Agilité</b> = coups critiques accrus ·
          <b> Intelligence</b> = dégâts bruts (glass cannon).
        </div>
      </Card>

      <Card>
        <Title color="#cbd5e1">Stats secondaires</Title>
        <p className="mb-1.5 text-[10.5px] leading-snug text-slate-500">
          {RATING_PER_PERCENT} de rating ≈ <b className="text-slate-300">1 %</b>. Tu arbitres un budget de lignes limité
          entre offense, survie et soutien — il faut <b className="text-slate-300">équilibrer</b>, pas tout empiler.
        </p>
        {SECONDARY_GROUPS.map((g) => (
          <div key={g.title} className="mb-1.5">
            <div className="mb-0.5 text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: g.color }}>{g.title}</div>
            {g.keys.map((k) => {
              const m = SECONDARY_META[k]
              return <Row key={k} color={m.color} short={m.short} name={m.name} desc={m.desc} rare={RARE_STATS.includes(k)} />
            })}
          </div>
        ))}
      </Card>

      <Card>
        <Title color="#74c0fc">Survie & résistances — les règles clés</Title>
        <ul className="space-y-1 text-[10.5px] leading-snug text-slate-300">
          <li>• <b className="text-sky-300">Résistances par type</b> (points, sans plafond) : les boss <b>EXIGENT</b> des points de résistance. Au cap de l'exigence → dégâts normaux (×1) ; à zéro résist → jusqu'à <b>×5</b>. ≈0 en farm, modéré en donjon, décisif en raid : prépare ton stuff selon la fiche du boss.</li>
          <li>• <b className="text-amber-300">Atténuation générique</b> (esquive / réduction / maîtrise / polyvalence) : <b>plafonnée à {Math.round(EFFECTIVE_DR_CAP * 100)} %</b>. Tu encaisses TOUJOURS une part — impossible d'être invincible.</li>
          <li>• Conséquence : empiler la tankiness ne suffit pas. Il faut un mélange de <b>résistances</b>, de <b>soin/régén/vol de vie</b> et de <b>dégâts</b> pour passer les Chapitres.</li>
        </ul>
      </Card>
    </div>
  )
}

/* --------------------------- CAPACITÉS --------------------------- */

const EFFECT_LABEL: Record<string, string> = {
  nuke: 'Dégâts directs', cleave: 'Dégâts (lourds)', dot: 'Dégâts sur la durée',
  heal: 'Soin', hot: 'Soin continu', shield: 'Bouclier', buffParty: 'Soin de groupe',
}
const SCALE_LABEL: Record<OffensiveStat, { label: string; color: string }> = {
  force: { label: 'FOR', color: '#ff6b6b' },
  agilite: { label: 'AGI', color: '#51cf66' },
  intelligence: { label: 'INT', color: '#4dabf7' },
}

function PowersCodex() {
  const actives = POWERS.filter((p) => p.kind === 'active')
  const passives = POWERS.filter((p) => p.kind === 'passive')
  return (
    <div className="space-y-3">
      <Card>
        <p className="text-[10.5px] leading-snug text-slate-400">
          Les capacités s'équipent (5 emplacements) et se lancent <b className="text-slate-300">automatiquement</b> au
          cooldown en combat. Elles se débloquent <b className="text-slate-300">via l'arbre de Talents</b> (nœuds capacité),
          disponible dès le niveau {TALENT_START_LEVEL + 1}. La <b className="text-cyan-300">Récupération</b> réduit leur recharge.
        </p>
      </Card>

      <Card>
        <Title color="#ff8787">Capacités actives ({actives.length})</Title>
        <div className="space-y-1">
          {actives.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-800 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-slate-100">
                  {p.damageType && p.damageType !== 'physique' ? DAMAGE_TYPES[p.damageType].icon + ' ' : ''}{p.name}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[9px]">
                  {p.effect && <span className="rounded bg-slate-700 px-1 py-0.5 text-slate-300">{EFFECT_LABEL[p.effect] ?? p.effect}</span>}
                  {/* v0.27 (C1) : les capacités scalent sur la stat DOMINANTE ; le scaleStat n'est plus qu'une affinité (couleur). */}
                  {p.scaleStat && <span className="rounded px-1 py-0.5 font-bold" style={{ background: SCALE_LABEL[p.scaleStat].color + '33', color: SCALE_LABEL[p.scaleStat].color }} title="Scale sur ta stat primaire DOMINANTE (v0.27) — le type de dégâts reste l'identité de la capacité.">⚡ dominante</span>}
                  {p.cooldown && <span className="text-slate-500">{p.cooldown}s</span>}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{p.description}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Title color="#ffd43b">Capacités passives ({passives.length})</Title>
        <div className="space-y-1">
          {passives.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-800 bg-black/20 p-2">
              <div className="text-[12px] font-semibold text-slate-100">{p.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{p.description}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* --------------------------- SYNERGIES --------------------------- */

function SynergiesCodex() {
  const keystoneNodes = useMemo(() => TALENTS.filter((t) => t.keystone), [])
  return (
    <div className="space-y-3">
      <Card>
        <Title color="#cbd5e1">Les 7 types de dégâts</Title>
        <p className="mb-1.5 text-[10.5px] leading-snug text-slate-500">
          Ton arme principale fixe ton type de base. Les affixes <b className="text-slate-300">+% type</b> et les conversions
          de l'arbre orientent ton profil. Les ennemis <b className="text-slate-300">résistent</b> à certains types — d'où
          l'intérêt de pouvoir <b className="text-slate-300">convertir</b> ou diversifier.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DAMAGE_TYPE_LIST.map((t) => {
            const m = DAMAGE_TYPES[t]
            return (
              <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: m.color + '22', color: m.color }}>
                {m.icon} {m.name}
              </span>
            )
          })}
        </div>
      </Card>

      <Card>
        <Title color="#c084fc">Conversions & keystones ({keystoneNodes.length})</Title>
        <p className="mb-1.5 text-[10.5px] leading-snug text-slate-500">
          Les <b className="text-slate-300">keystones</b> de l'arbre de Talents créent les vraies synergies : convertir un
          type de dégât en un autre (ex. Physique → Feu/Froid/Ombre), faire compter une stat comme une autre, transformer
          tes coups en DoT, exécuter les ennemis affaiblis… Trouve ceux qui se combinent avec ton stuff.
        </p>
        <div className="space-y-1">
          {keystoneNodes.map((n) => {
            const c = CONSTELLATIONS[n.constellation]
            return (
              <div key={n.id} className="rounded-lg border p-2" style={{ borderColor: c.color + '33', background: c.color + '0c' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-100">{n.name}</span>
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px]" style={{ background: c.color + '22', color: c.color }}>{c.icon} {c.name}</span>
                </div>
                <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{n.description}</div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ---------------------------- UNIQUES ---------------------------- */

type RoleFilter = UniqueRole | 'all'

function UniquesCodex() {
  const codex = useGame((s) => s.codex)
  const essences = useGame((s) => s.essences)
  const [filter, setFilter] = useState<RoleFilter>('all')

  const discovered = useMemo(() => new Set(codex), [codex])
  const total = UNIQUE_EFFECTS.length
  const found = UNIQUE_EFFECTS.filter((e) => discovered.has(e.id)).length

  const list = useMemo(
    () => UNIQUE_EFFECTS.filter((e) => filter === 'all' || e.role === filter),
    [filter],
  )

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-semibold text-fuchsia-200">✦ Grimoire des uniques</div>
        <div className="text-xs text-fuchsia-300">{found}/{total} découverts</div>
      </div>
      <p className="mb-2 text-[10.5px] leading-snug text-slate-500">
        Tous les effets uniques. Trouve-les sur des objets (Épique+), via les coffres, le craft ou les raids. Les valeurs
        affichées sont les <b className="text-slate-300">bases au rang 1</b> — elles montent avec le rang et la rareté/iLvl.
      </p>

      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} label={`Tous (${found}/${total})`} color="#cbd5e1" />
        {UNIQUE_ROLES.map((r) => {
          const m = ROLE_META[r]
          const all = UNIQUE_EFFECTS.filter((e) => e.role === r)
          const f = all.filter((e) => discovered.has(e.id)).length
          return <FilterBtn key={r} active={filter === r} onClick={() => setFilter(r)} label={`${m.icon} ${m.label} (${f}/${all.length})`} color={m.color} />
        })}
      </div>

      <div className="space-y-1.5">
        {list.map((e) => {
          const known = discovered.has(e.id)
          const role = ROLE_META[e.role]
          const owned = essences[e.id] ?? 0
          if (!known) {
            return (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-[#0c0f17] px-2.5 py-2 opacity-70">
                <span className="text-base grayscale">{role.icon}</span>
                <span className="flex-1 text-[12px] italic text-slate-600">Effet non découvert</span>
                <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: role.color + '22', color: role.color }}>{role.label}</span>
              </div>
            )
          }
          const mods = uniqueModsAtRank(e.id, 1)
          const resist = uniqueResistAtRank(e.id, 1)
          return (
            <div key={e.id} className="rounded-lg border p-2.5" style={{ borderColor: role.color + '33', background: role.color + '0c' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-fuchsia-200">✦ {e.name}</span>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px]" style={{ background: role.color + '22', color: role.color }}>
                  {role.icon} {role.label}
                </span>
              </div>
              <div className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{e.description}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px]">
                {Object.entries(mods).map(([k, v]) => {
                  const sm = ALL_STAT_META[k as StatKey]
                  return <span key={k} style={{ color: sm.color }}>+{v} {sm.name}</span>
                })}
                {Object.entries(resist).map(([k, v]) => {
                  const dm = DAMAGE_TYPES[k as keyof typeof DAMAGE_TYPES]
                  return <span key={k} style={{ color: dm.color }}>+{Math.round((v as number) * 100)}% rés. {dm.name}</span>
                })}
              </div>
              {uniqueActiveText(e.id) && (
                <div className="mt-1 text-[10px] leading-snug text-emerald-300/80">
                  <span className="text-slate-500">Rang {UNIQUE_ACTIVE_RANK} : </span>{uniqueActiveText(e.id)}
                </div>
              )}
              {owned > 0 && (
                <div className="mt-1 text-[9.5px] text-cyan-300/70">🧬 {owned} essence{owned > 1 ? 's' : ''} en réserve</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------- shared ---------------------------- */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-800 bg-[#11151f] p-3">{children}</div>
}

function Title({ children, color }: { children: React.ReactNode; color: string }) {
  return <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color }}>{children}</div>
}

function Row({ color, short, name, desc, rare }: { color: string; short: string; name: string; desc: string; rare?: boolean }) {
  return (
    <div className="flex items-start gap-2 border-t border-slate-800/60 py-1 first:border-t-0">
      <span className="mt-0.5 w-12 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-bold" style={{ background: color + '22', color }}>{short}</span>
      <span className="min-w-0">
        <span className="text-[11.5px] font-medium text-slate-200">{name}{rare && <span className="ml-1" title="Stat rare">💎</span>}</span>
        <span className="block text-[10px] leading-snug text-slate-500">{desc}</span>
      </span>
    </div>
  )
}

function FilterBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className={'rounded px-2 py-1.5 font-medium ' + (active ? 'text-slate-950' : 'bg-slate-800')}
      style={active ? { background: color } : { color }}
    >
      {label}
    </button>
  )
}
