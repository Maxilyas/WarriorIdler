import { useState, type ReactNode } from 'react'
import { useGame } from '../game/store'
import {
  runSim, defaultConfig, SIM_CLASSES, SIM_GEMS, SIM_RUNES, SIM_ELIXIRS, SIM_ORIENTATIONS, SIM_RAIDS, SIM_DUNGEONS,
  type SimConfig, type SimMemberCfg, type SimResult,
} from '../game/simulator'

const RARITIES_OPT = ['epique', 'legendaire', 'mythique', 'ascendant', 'celeste', 'transcendant'] as const

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'Md'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return Math.round(n).toLocaleString('fr-FR')
}

/** Petite étiquette de section. */
function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{children}</div>
}

/** Chip cliquable (toggle ou radio). */
function Chip({ on, onClick, color = 'orange', children, title }: { on: boolean; onClick: () => void; color?: 'orange' | 'emerald' | 'sky'; children: ReactNode; title?: string }) {
  const ring = on
    ? color === 'emerald' ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
      : color === 'sky' ? 'border-sky-400/70 bg-sky-500/15 text-sky-200'
        : 'border-orange-400/70 bg-orange-500/15 text-orange-200'
    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
  return (
    <button title={title} onClick={onClick} className={'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ' + ring}>
      {children}
    </button>
  )
}

/** Segmented control (radio inline). */
function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-slate-900/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ' + (value === o.id ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Champ numérique compact. */
function Num({ value, onChange, min = 1, max = 999, w = 'w-16' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; w?: string }) {
  return (
    <input
      type="number" value={value} min={min} max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      className={'rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm tabular-nums text-slate-200 outline-none focus:border-orange-400/60 ' + w}
    />
  )
}

/* ------------------------------------------------------------------ */

export function SimulatorPanel() {
  const bestStage = useGame((s) => s.bestStage)
  const [cfg, setCfg] = useState<SimConfig>(() => defaultConfig(bestStage || 300))
  const [result, setResult] = useState<SimResult | null>(null)
  const [running, setRunning] = useState(false)

  const patch = (p: Partial<SimConfig>) => setCfg((c) => ({ ...c, ...p }))
  const setMember = (i: number, p: Partial<SimMemberCfg>) => setCfg((c) => ({ ...c, team: c.team.map((m, j) => (j === i ? { ...m, ...p } : m)) }))
  const toggleIn = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  const addMember = () => setCfg((c) => c.team.length >= 3 ? c : ({ ...c, team: [...c.team, { name: `Perso ${c.team.length + 1}`, cls: 'mage', level: 75, orientation: 'equilibre', gems: [], runes: [] }] }))
  const removeMember = (i: number) => setCfg((c) => c.team.length <= 1 ? c : ({ ...c, team: c.team.filter((_, j) => j !== i) }))

  const run = () => {
    setRunning(true)
    // setTimeout → laisse l'UI peindre l'état « simulation… » avant le calcul synchrone.
    setTimeout(() => { setResult(runSim(cfg)); setRunning(false) }, 20)
  }

  const isRaid = cfg.content.kind === 'raid'
  const contentList = isRaid ? SIM_RAIDS : SIM_DUNGEONS

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#1a1320] to-[#0d111a] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-slate-100">🧪 Simulateur de raid</div>
            <div className="text-[11px] text-slate-500">Compose une équipe, équipe-la, et teste-la sur le vrai moteur de combat.</div>
          </div>
          <button
            onClick={run} disabled={running}
            className="shrink-0 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-900/40 transition active:scale-95 disabled:opacity-60"
          >
            {running ? '⏳ Simulation…' : '▶ Lancer'}
          </button>
        </div>
      </div>

      {/* RÉSULTAT (en tête une fois calculé) */}
      {result && <ResultCard result={result} />}

      {/* CONTENU CIBLE */}
      <section className="rounded-xl border border-slate-800 bg-[#11151f] p-3">
        <Label>Contenu visé</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Seg value={cfg.content.kind} options={[{ id: 'raid', label: '☠️ Raid' }, { id: 'dungeon', label: '🏰 Donjon' }]}
            onChange={(k) => patch({ content: { ...cfg.content, kind: k, id: (k === 'raid' ? SIM_RAIDS : SIM_DUNGEONS)[0].id } })} />
          <select
            value={cfg.content.id} onChange={(e) => patch({ content: { ...cfg.content, id: e.target.value } })}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-orange-400/60"
          >
            {contentList.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <Chip on={cfg.content.scan} onClick={() => patch({ content: { ...cfg.content, scan: true } })}>🔎 {isRaid ? 'Tier' : 'Niveau'} max (scan)</Chip>
          <Chip on={!cfg.content.scan} onClick={() => patch({ content: { ...cfg.content, scan: false } })}>🎯 {isRaid ? 'Tier' : 'Niveau'} précis</Chip>
          {!cfg.content.scan && (
            <span className="flex items-center gap-1.5">
              {isRaid ? 'T' : 'niv'} <Num value={cfg.content.tier} min={1} max={isRaid ? 15 : 25} w="w-14" onChange={(v) => patch({ content: { ...cfg.content, tier: v } })} />
            </span>
          )}
        </div>
      </section>

      {/* PARAMÈTRES & CONSOMMABLE */}
      <section className="rounded-xl border border-slate-800 bg-[#11151f] p-3">
        <Label>Paramètres du stuff & consommable</Label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5">iLvl <Num value={cfg.ilvl} min={10} max={700} w="w-18" onChange={(v) => patch({ ilvl: v })} /></label>
          <label className="flex items-center gap-1.5">
            Rareté
            <select value={cfg.rarity} onChange={(e) => patch({ rarity: e.target.value as SimConfig['rarity'] })}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] capitalize text-slate-200 outline-none focus:border-orange-400/60">
              {RARITIES_OPT.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">Record <Num value={cfg.bestStage} min={1} max={1000} w="w-20" onChange={(v) => patch({ bestStage: v })} /></label>
          <label className="flex items-center gap-1.5">
            🧴 Élixir
            <select value={cfg.elixir} onChange={(e) => patch({ elixir: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-orange-400/60">
              {SIM_ELIXIRS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {/* ÉQUIPE */}
      <section className="rounded-xl border border-slate-800 bg-[#11151f] p-3">
        <div className="mb-2 flex items-center justify-between">
          <Label>Équipe ({cfg.team.length}/3)</Label>
          {cfg.team.length < 3 && (
            <button onClick={addMember} className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">+ Ajouter</button>
          )}
        </div>
        <div className="space-y-3">
          {cfg.team.map((m, i) => (
            <MemberCard key={i} m={m} index={i} canRemove={cfg.team.length > 1}
              onSet={(p) => setMember(i, p)} onRemove={() => removeMember(i)}
              onToggleGem={(g) => setMember(i, { gems: toggleIn(m.gems, g) })}
              onToggleRune={(r) => setMember(i, { runes: toggleIn(m.runes, r) })} />
          ))}
        </div>
      </section>

      <div className="pb-2 text-center text-[10px] leading-snug text-slate-600">
        Combat d'équipe réel (heal, gemmes, runes, pactes, conso). Solo/équipe selon ta compo. Suppose un jeu parfait → léger plafond optimiste.
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function MemberCard({ m, index, canRemove, onSet, onRemove, onToggleGem, onToggleRune }: {
  m: SimMemberCfg; index: number; canRemove: boolean
  onSet: (p: Partial<SimMemberCfg>) => void; onRemove: () => void
  onToggleGem: (g: string) => void; onToggleRune: (r: string) => void
}) {
  const [open, setOpen] = useState(index === 0)
  const cls = SIM_CLASSES.find((c) => c.id === m.cls) ?? SIM_CLASSES[0]
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/40">
      {/* En-tête repliable */}
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-lg">{cls.icon}</span>
          <span className="truncate text-sm font-semibold text-slate-200">{m.name}</span>
          <span className="shrink-0 text-[10px] text-slate-500">{cls.label} · N{m.level} · {m.orientation}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {(m.gems.length > 0 || m.runes.length > 0) && (
            <span className="text-[10px] text-slate-500">{m.gems.length}◆ {m.runes.length}⏳</span>
          )}
          <span className="text-slate-500">{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-slate-800 p-3">
          {/* Ligne identité */}
          <div className="flex flex-wrap items-center gap-2">
            <input value={m.name} onChange={(e) => onSet({ name: e.target.value })}
              className="w-28 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200 outline-none focus:border-orange-400/60" />
            <select value={m.cls} onChange={(e) => onSet({ cls: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200 outline-none focus:border-orange-400/60">
              {SIM_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-slate-400">N <Num value={m.level} min={1} max={300} w="w-16" onChange={(v) => onSet({ level: v })} /></label>
            {canRemove && <button onClick={onRemove} className="ml-auto rounded-lg border border-rose-700/50 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950/30">✕ Retirer</button>}
          </div>

          {/* Orientation */}
          <div>
            <Label>Orientation du stuff</Label>
            <Seg value={m.orientation} options={SIM_ORIENTATIONS.map((o) => ({ id: o.id, label: o.label }))} onChange={(v) => onSet({ orientation: v })} />
          </div>

          {/* Gemmes */}
          <div>
            <Label>Gemmes de condition <span className="text-emerald-500/70">offensives</span> · <span className="text-sky-500/70">défensives</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {SIM_GEMS.map((g) => (
                <Chip key={g.id} on={m.gems.includes(g.id)} color={g.kind === 'off' ? 'emerald' : 'sky'} onClick={() => onToggleGem(g.id)} title={g.name}>
                  {g.icon} {g.name}
                </Chip>
              ))}
            </div>
          </div>

          {/* Runes */}
          <div>
            <Label>Runes de temps</Label>
            <div className="flex flex-wrap gap-1.5">
              {SIM_RUNES.map((r) => (
                <Chip key={r.id} on={m.runes.includes(r.id)} onClick={() => onToggleRune(r.id)} title={r.name}>
                  {r.icon} {r.name}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ResultCard({ result }: { result: SimResult }) {
  const { outcome: o, unit, contentLabel } = result
  const pass = o.scanned ? o.maxReached > 0 : o.win
  const headline = o.scanned
    ? (o.maxReached > 0 ? `${unit}${o.maxReached} max` : `Aucun ${unit} battu`)
    : (o.win ? 'PASSE' : 'ÉCHEC')
  const accent = pass ? 'emerald' : 'rose'
  const wall = o.wallAt > 0
    ? (o.firstDead ? `🧱 Mur ${unit}${o.wallAt} : ${o.firstDead} tombe à ${o.firstT.toFixed(0)}s · boss encore à ${o.bossLeftPct.toFixed(0)}% PV`
      : `🧱 Mur ${unit}${o.wallAt} : enrage atteint · boss encore à ${o.bossLeftPct.toFixed(0)}% PV`)
    : (pass && !o.scanned ? `✅ Boss tombé en ${o.dur.toFixed(0)}s` : '')

  return (
    <div className={'rounded-xl border p-3 ' + (pass ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-rose-700/50 bg-rose-950/20')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400">{contentLabel}</div>
          <div className={'text-2xl font-extrabold ' + (accent === 'emerald' ? 'text-emerald-300' : 'text-rose-300')}>
            {pass ? '✅ ' : '❌ '}{headline}
          </div>
        </div>
        <div className="shrink-0 text-right text-[10px] text-slate-400">
          <div>kit : heroMult ×{result.heroMult.toFixed(2)}</div>
          <div>{result.runeCount} rune(s) · élixir {result.elixirActive ? 'actif' : 'non'}</div>
        </div>
      </div>
      {wall && <div className="mt-2 rounded-lg bg-black/30 px-2.5 py-1.5 text-[12px] text-slate-200">{wall}</div>}
      <div className="mt-2 space-y-1">
        {result.members.map((mb, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-2.5 py-1 text-[11px]">
            <span className="truncate font-medium text-slate-200">{mb.name} <span className="text-slate-500">{mb.cls}</span></span>
            <span className="flex shrink-0 gap-3 tabular-nums">
              <span className="text-emerald-300">⚔ {fmt(mb.dps)}</span>
              <span className="text-sky-300">🛡 {fmt(mb.ehp)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
