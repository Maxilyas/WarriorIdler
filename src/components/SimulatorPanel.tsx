import { useState, type ReactNode } from 'react'
import { useGame } from '../game/store'
import {
  runSim, defaultConfig, importedMember, initGear, initTalents, CLASS_CONSTELLATIONS, DEFAULT_TALENT_BUDGET,
  SIM_CLASSES, SIM_GEMS, SIM_RUNES, SIM_ELIXIRS, SIM_ORIENTATIONS, SIM_RAIDS, SIM_DUNGEONS, SIM_STATS, SIM_SLOTS,
  type SimConfig, type SimMemberCfg, type SimResult, type GearSlotCfg,
} from '../game/simulator'
import { CONSTELLATIONS, talentsByConstellation, canAllocate, gateInfo, type ConstellationId, type TalentNode } from '../game/talents'
import { REFERENCE_BUILDS } from '../game/referenceBuilds'

const LIB_KEY = 'wi-sim-builds'
type SavedBuild = { name: string; cfg: SimConfig }
function loadLib(): SavedBuild[] {
  try { const v = JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function saveLib(list: SavedBuild[]) { try { localStorage.setItem(LIB_KEY, JSON.stringify(list)) } catch { /* quota */ } }
const cloneCfg = (c: SimConfig): SimConfig => JSON.parse(JSON.stringify(c))

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
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const [cfg, setCfg] = useState<SimConfig>(() => defaultConfig(bestStage || 300))
  const [result, setResult] = useState<SimResult | null>(null)
  const [running, setRunning] = useState(false)
  const [lib, setLib] = useState<SavedBuild[]>(() => loadLib())
  const [saveName, setSaveName] = useState('')

  const persistLib = (l: SavedBuild[]) => { setLib(l); saveLib(l) }
  const saveCurrent = () => {
    const name = saveName.trim() || `Build ${lib.length + 1}`
    persistLib([...lib.filter((b) => b.name !== name), { name, cfg: cloneCfg(cfg) }])
    setSaveName('')
  }
  const loadCfg = (c: SimConfig) => { setCfg(cloneCfg(c)); setResult(null) }
  const deleteSaved = (name: string) => persistLib(lib.filter((b) => b.name !== name))

  const activeReal = characters[activeChar] ?? characters[0]
  const importActive = () => {
    if (!activeReal) return
    setCfg((c) => c.team.length >= 3 ? c : ({ ...c, team: [...c.team, importedMember(activeReal)] }))
  }
  // Remplace l'équipe par TOUS tes vrais persos (ta compo réelle DPS + heal), capée à 3.
  const importTeam = () => {
    if (!characters.length) return
    setCfg((c) => ({ ...c, team: characters.slice(0, 3).map(importedMember) }))
  }

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

      {/* BIBLIOTHÈQUE : catalogue versionné (dev) + mes builds (localStorage) */}
      <section className="rounded-xl border border-slate-800 bg-[#11151f] p-3">
        <Label>Bibliothèque</Label>
        <div className="mb-2">
          <div className="mb-1 text-[10px] text-slate-500">📚 Catalogue de référence</div>
          <div className="flex flex-wrap gap-1.5">
            {REFERENCE_BUILDS.map((b) => (
              <button key={b.name} onClick={() => loadCfg(b.config)} title={b.desc}
                className="rounded-full border border-slate-700 bg-slate-800/40 px-2.5 py-1 text-[11px] text-slate-300 hover:border-fuchsia-400/60 hover:text-fuchsia-200">
                {b.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="shrink-0 text-[10px] text-slate-500">💾 Mes builds</span>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="nom du build…"
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-orange-400/60" />
            <button onClick={saveCurrent} className="shrink-0 rounded-lg bg-orange-500/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-orange-500">Sauver</button>
          </div>
          {lib.length === 0
            ? <div className="text-[10px] text-slate-600">Aucun build sauvegardé. « Sauver » mémorise la compo + tous les loadouts actuels.</div>
            : <div className="flex flex-wrap gap-1.5">
                {lib.map((b) => (
                  <span key={b.name} className="flex items-center rounded-full border border-slate-700 bg-slate-800/40 text-[11px]">
                    <button onClick={() => loadCfg(b.cfg)} className="py-0.5 pl-2.5 pr-1 text-slate-200 hover:text-orange-200">{b.name}</button>
                    <button onClick={() => deleteSaved(b.name)} className="py-0.5 pl-1 pr-2 text-rose-400 hover:text-rose-300" aria-label="Supprimer">✕</button>
                  </span>
                ))}
              </div>}
        </div>
      </section>

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
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label>Équipe ({cfg.team.length}/3)</Label>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {activeReal && cfg.team.length < 3 && (
              <button onClick={importActive} title={`Importer ${activeReal.name} (vrais talents, stuff, gemmes, runes)`}
                className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-2 py-1 text-[11px] font-medium text-orange-200 hover:bg-orange-500/20">
                📥 Perso actif
              </button>
            )}
            {characters.length > 1 && (
              <button onClick={importTeam} title="Remplacer par ta vraie compo (tous tes persos)"
                className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-2 py-1 text-[11px] font-medium text-orange-200 hover:bg-orange-500/20">
                📥 Mon équipe
              </button>
            )}
            {cfg.team.length < 3 && (
              <button onClick={addMember} className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">+ Preset</button>
            )}
          </div>
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

  // Membre IMPORTÉ : carte compacte (le vrai perso, non éditable ici).
  if (m.imported) {
    const ch = m.imported
    return (
      <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-lg">📥</span>
            <span className="truncate text-sm font-semibold text-orange-100">{ch.name}</span>
            <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-200">RÉEL · N{ch.level}</span>
          </span>
          {canRemove && <button onClick={onRemove} className="shrink-0 rounded-lg border border-rose-700/50 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950/30">✕</button>}
        </div>
        <div className="mt-1 text-[10.5px] text-slate-400">Talents, équipement, gemmes et runes <b className="text-slate-300">réels</b> de ton perso — testé tel quel.</div>
      </div>
    )
  }

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
            <select value={m.cls} onChange={(e) => onSet({ cls: e.target.value, talents: undefined, gear: undefined })}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200 outline-none focus:border-orange-400/60">
              {SIM_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-slate-400">N <Num value={m.level} min={1} max={300} w="w-16" onChange={(v) => onSet({ level: v })} /></label>
            {canRemove && <button onClick={onRemove} className="ml-auto rounded-lg border border-rose-700/50 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950/30">✕ Retirer</button>}
          </div>

          {/* Stuff : simple (orientation globale) ou détaillé (pièce-par-pièce) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Stuff{m.gear ? ' — détaillé (pièce par pièce)' : ''}</Label>
              {m.gear
                ? <button onClick={() => onSet({ gear: undefined })} className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200">✕ Mode simple</button>
                : <button onClick={() => onSet({ gear: initGear(m.orientation) })} className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200 hover:bg-orange-500/20">🔧 Détailler le stuff</button>}
            </div>
            {m.gear
              ? <GearEditor gear={m.gear} onChange={(g) => onSet({ gear: g })} />
              : <Seg value={m.orientation} options={SIM_ORIENTATIONS.map((o) => ({ id: o.id, label: o.label }))} onChange={(v) => onSet({ orientation: v })} />}
          </div>

          {/* Talents : chemin de classe par défaut, ou arbre personnalisé (bac-à-sable) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Talents{m.talents ? ' — arbre personnalisé' : ''}</Label>
              {m.talents
                ? <button onClick={() => onSet({ talents: undefined })} className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200">✕ Chemin par défaut</button>
                : <button onClick={() => onSet({ talents: initTalents(m.cls) })} className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20">🌌 Éditer l'arbre</button>}
            </div>
            {m.talents && <TalentSandbox clsId={m.cls} talents={m.talents} onChange={(t) => onSet({ talents: t })} />}
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

/** Éditeur de stuff pièce-par-pièce : par emplacement, orientation off/def + stats qui rollent
 *  (valeurs auto-calculées au max du budget de la pièce). */
function GearEditor({ gear, onChange }: { gear: Record<string, GearSlotCfg>; onChange: (g: Record<string, GearSlotCfg>) => void }) {
  const setSlot = (id: string, p: Partial<GearSlotCfg>) => onChange({ ...gear, [id]: { ...gear[id], ...p } })
  const toggleStat = (id: string, stat: string) => { const cur = gear[id].stats; setSlot(id, { stats: cur.includes(stat) ? cur.filter((s) => s !== stat) : [...cur, stat] }) }
  const applyAllOrientation = (orientation: GearSlotCfg['orientation']) => { const g = { ...gear }; for (const k in g) g[k] = { ...g[k], orientation }; onChange(g) }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        Tout en :
        {SIM_ORIENTATIONS.map((o) => (
          <button key={o.id} onClick={() => applyAllOrientation(o.id)} className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800">{o.label}</button>
        ))}
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {SIM_SLOTS.map((sl) => {
          const gs = gear[sl.id]
          if (!gs) return null
          return (
            <div key={sl.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-300">{sl.icon} {sl.name}</span>
                <Seg value={gs.orientation} options={SIM_ORIENTATIONS.map((o) => ({ id: o.id, label: o.label }))} onChange={(v) => setSlot(sl.id, { orientation: v })} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {SIM_STATS.map((st) => {
                  const on = gs.stats.includes(st.id)
                  return (
                    <button key={st.id} onClick={() => toggleStat(sl.id, st.id)} title={st.name + (st.kind === 'rare' ? ' (rare)' : '')}
                      className={'rounded border px-1.5 py-0.5 text-[10px] font-semibold ' + (on ? '' : 'border-slate-700/60 text-slate-500 hover:text-slate-300')}
                      style={on ? { color: st.color, borderColor: st.color + '99', background: st.color + '1f' } : undefined}>
                      {st.short}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="text-[10px] text-slate-600">Valeurs auto au max du budget de chaque pièce ; choisis quelles stats rollent + l'équilibre off/def par emplacement.</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** Allocateur de talents bac-à-sable : alloue librement sur une map locale, avec le VRAI gating
 *  (canAllocate : adjacence, seuils minSpent, choix exclusifs). Groupé par constellation de la classe. */
function TalentSandbox({ clsId, talents, onChange }: { clsId: string; talents: Record<string, number>; onChange: (t: Record<string, number>) => void }) {
  const [budget, setBudget] = useState(DEFAULT_TALENT_BUDGET)
  const [openCid, setOpenCid] = useState<string | null>(null)
  const spent = Object.entries(talents).reduce((a, [k, v]) => a + (k === 'co_start' ? 0 : v), 0)
  const avail = budget - spent
  const cids = CLASS_CONSTELLATIONS[clsId] ?? CLASS_CONSTELLATIONS.guerrier
  const inc = (n: TalentNode) => { if (canAllocate(n, talents, avail)) onChange({ ...talents, [n.id]: (talents[n.id] ?? 0) + 1 }) }
  const dec = (n: TalentNode) => { const r = talents[n.id] ?? 0; if (r <= 0) return; const t = { ...talents }; if (r - 1 <= 0) delete t[n.id]; else t[n.id] = r - 1; onChange(t) }
  const spentIn = (cid: string) => talentsByConstellation(cid as ConstellationId).reduce((a, n) => a + (talents[n.id] ?? 0), 0)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400">Points dépensés : <b className={avail < 0 ? 'text-rose-400' : 'text-emerald-300'}>{spent}</b> / <input type="number" value={budget} min={0} max={300}
          onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} className="w-14 rounded border border-slate-700 bg-slate-900/60 px-1 py-0.5 tabular-nums text-slate-200" /></span>
        <button onClick={() => onChange(initTalents(clsId))} className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200">↺ Chemin de classe</button>
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {cids.map((cid) => {
          const meta = CONSTELLATIONS[cid as ConstellationId]
          if (!meta) return null
          const nodes = talentsByConstellation(cid as ConstellationId)
          const open = openCid === cid
          const sp = spentIn(cid)
          return (
            <div key={cid} className="rounded-lg border border-slate-800 bg-slate-900/40">
              <button onClick={() => setOpenCid(open ? null : cid)} className="flex w-full items-center justify-between px-2 py-1.5 text-left">
                <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.icon} {meta.name}</span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">{sp > 0 && <span className="rounded-full bg-slate-800 px-1.5 text-amber-300">{sp}</span>}{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <div className="space-y-0.5 border-t border-slate-800 p-1.5">
                  {nodes.map((n) => {
                    const r = talents[n.id] ?? 0
                    const can = canAllocate(n, talents, avail)
                    const g = gateInfo(n, talents)
                    return (
                      <div key={n.id} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[10.5px]">
                        <span className={'min-w-0 flex-1 truncate ' + (r > 0 ? 'text-slate-200' : !can ? 'text-slate-600' : 'text-slate-400')} title={n.name}>
                          {n.name}{g.need > g.spent ? <span className="ml-1 text-[9px] text-slate-600">· {g.need}pts</span> : null}
                          {g.exclusiveBlocked ? <span className="ml-1 text-[9px] text-rose-500/70">· exclu</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <button onClick={() => dec(n)} disabled={r <= 0} className="h-5 w-5 rounded bg-slate-800 text-slate-300 disabled:opacity-30">−</button>
                          <span className="w-8 text-center tabular-nums text-slate-400">{r}/{n.maxRank}</span>
                          <button onClick={() => inc(n)} disabled={!can} className="h-5 w-5 rounded bg-slate-800 font-bold text-emerald-300 disabled:opacity-30">+</button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="text-[10px] text-slate-600">Gating réel (adjacence, seuils, exclusifs). Les sorts équipés restent ceux de la classe (v1).</div>
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
