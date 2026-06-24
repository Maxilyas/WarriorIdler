import { useState, useMemo, type ReactNode } from 'react'
import { useGame } from '../game/store'
import { Sheet } from './ui'
import {
  runSim, defaultConfig, importedMember, initGear, initTalents, gearFromCharacter, statLines, maxLinesFor, availableAbilities, getClassPreset,
  SIM_CLASSES, SIM_GEMS, SIM_RUNES, SIM_ELIXIRS, SIM_ORIENTATIONS, SIM_PRIMARIES, SIM_RAIDS, SIM_DUNGEONS, SIM_STATS, SIM_SLOTS, SIM_RARITIES, SIM_DMG_TYPES, SIM_UNIQUES,
  SIM_ABILITY_SLOTS, SIM_MAX_GEM_RANK, SIM_MAX_UNIQUE_RANK,
  type SimConfig, type SimMemberCfg, type SimResult, type GearSlotCfg, type LineCfg,
} from '../game/simulator'
import { charDamageProfile, talentPointsForLevel } from '../game/character'
import { TalentTree } from './TalentTree'
import { REFERENCE_BUILDS } from '../game/referenceBuilds'
import type { Character, DamageType, OffensiveStat } from '../game/types'

const LIB_KEY = 'wi-sim-builds'
type SavedBuild = { name: string; cfg: SimConfig }
/** Pool de talents PARTAGÉ par l'équipe (niveau de compte). `remaining` = ce qu'il reste à allouer,
 *  COMMUN à tous les membres : ce que les autres dépensent réduit le tien. */
type TalentBudget = { level: number; pool: number; teamSpent: number; remaining: number }
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

/** Bouton ⓘ → feuille (mobile-friendly) listant les gemmes et leurs effets. */
function GemInfoButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full border border-slate-700 px-1.5 text-[10px] text-slate-400 hover:text-slate-200" aria-label="Effets des gemmes">ⓘ</button>
      {open && (
        <Sheet title="💎 Gemmes de condition — effets" onClose={() => setOpen(false)}>
          <div className="space-y-2.5">
            {SIM_GEMS.map((g) => (
              <div key={g.id} className="text-[12px]">
                <span className="font-semibold" style={{ color: g.color }}>{g.icon} {g.name}</span>
                <span className="ml-1.5 text-[9px] uppercase tracking-wide text-slate-600">{g.kind === 'off' ? 'offensive' : 'défensive'}</span>
                <div className="text-[11px] leading-snug text-slate-400">{g.desc}</div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}

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

  // POOL DE TALENTS PARTAGÉ par l'équipe (mêmes conditions que le vrai jeu) : taille = points du niveau
  // de COMPTE (= niveau le plus haut de l'équipe), MOINS le total dépensé sur TOUS les arbres de l'équipe.
  // Plus de points = monter le niveau (jamais un budget libre par perso → un build resterait « jouable »).
  const talentBudget = useMemo<TalentBudget>(() => {
    const memberLevel = (m: SimMemberCfg) => m.imported?.level ?? m.level
    const effTalents = (m: SimMemberCfg) => m.talents ?? (m.imported ? m.imported.talents : initTalents(m.cls))
    const spentOf = (t: Record<string, number>) => Object.values(t).reduce((a, b) => a + b, 0) - (t.co_start ?? 0)
    const level = Math.max(1, ...cfg.team.map(memberLevel))
    const pool = talentPointsForLevel(level)
    const teamSpent = cfg.team.reduce((a, m) => a + spentOf(effTalents(m)), 0)
    return { level, pool, teamSpent, remaining: Math.max(0, pool - teamSpent) }
  }, [cfg.team])

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
            <MemberCard key={i} m={m} index={i} canRemove={cfg.team.length > 1} globalIlvl={cfg.ilvl} globalRarity={cfg.rarity} talentBudget={talentBudget}
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

function MemberCard({ m, index, canRemove, globalIlvl, globalRarity, talentBudget, onSet, onRemove, onToggleGem, onToggleRune }: {
  m: SimMemberCfg; index: number; canRemove: boolean; globalIlvl: number; globalRarity: string; talentBudget: TalentBudget
  onSet: (p: Partial<SimMemberCfg>) => void; onRemove: () => void
  onToggleGem: (g: string) => void; onToggleRune: (r: string) => void
}) {
  const [open, setOpen] = useState(index === 0)
  const cls = SIM_CLASSES.find((c) => c.id === m.cls) ?? SIM_CLASSES[0]

  // Membre IMPORTÉ : carte éditable adossée au vrai perso (overrides par section).
  if (m.imported) {
    return <ImportedMemberCard m={m} ch={m.imported} canRemove={canRemove} globalIlvl={globalIlvl} globalRarity={globalRarity} talentBudget={talentBudget} onSet={onSet} onRemove={onRemove} />
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

          {/* Stat primaire (FORCE/AGI/INT) du stuff généré — défaut = stat de la classe */}
          <PrimarySelect value={m.primary} onChange={(v) => onSet({ primary: v })} />

          {/* Stuff : simple (orientation globale) ou détaillé (pièce-par-pièce) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Stuff{m.gear ? ' — détaillé (pièce par pièce)' : ''}</Label>
              {m.gear
                ? <button onClick={() => onSet({ gear: undefined })} className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200">✕ Mode simple</button>
                : <button onClick={() => onSet({ gear: initGear(m.orientation) })} className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200 hover:bg-orange-500/20">🔧 Détailler le stuff</button>}
            </div>
            {m.gear
              ? <GearEditor gear={m.gear} globalIlvl={globalIlvl} globalRarity={globalRarity} onChange={(g) => onSet({ gear: g })} />
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
            {m.talents && <TalentTreeSandbox clsId={m.cls} level={m.level} talents={m.talents} budget={talentBudget} onChange={(t) => onSet({ talents: t })} />}
          </div>

          {/* Capacités équipées (l'arbre débloque plus que les slots → on choisit) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Capacités{(m.powers || m.support || m.passives) ? ' — personnalisées' : ''}</Label>
              {(m.powers || m.support || m.passives)
                ? <button onClick={() => onSet({ powers: undefined, support: undefined, passives: undefined })} className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200">✕ Défaut de classe</button>
                : <button onClick={() => { const pr = SIM_CLASSES.find((c) => c.id === m.cls) ?? SIM_CLASSES[0]; onSet({ powers: [...pr.powers], support: [...pr.support], passives: [...pr.passives] }) }} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/20">🪄 Choisir les capacités</button>}
            </div>
            {(m.powers || m.support || m.passives) && <AbilitiesEditor m={m} onSet={onSet} />}
          </div>

          {/* Gemmes */}
          <div>
            <div className="mb-1 flex items-center gap-2"><Label>Gemmes de condition <span className="text-emerald-500/70">off</span> · <span className="text-sky-500/70">déf</span></Label><GemInfoButton /></div>
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

/** Sélecteur de stat primaire FORCE / AGI / INT (re-clic = retour au défaut). */
function PrimarySelect({ value, onChange }: { value?: OffensiveStat; onChange: (v: OffensiveStat | undefined) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label>Stat primaire</Label>
      <div className="inline-flex gap-1 rounded-lg bg-slate-900/60 p-0.5">
        {SIM_PRIMARIES.map((p) => {
          const on = value === p.id
          return (
            <button key={p.id} onClick={() => onChange(on ? undefined : p.id)} title={`Forcer ${p.label} sur tout le stuff généré`}
              className={'rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ' + (on ? '' : 'text-slate-400 hover:text-slate-200')}
              style={on ? { background: p.color + '2a', color: p.color, boxShadow: `inset 0 0 0 1px ${p.color}88` } : undefined}>
              {p.short}
            </button>
          )
        })}
      </div>
      <span className="text-[9.5px] text-slate-600">{value ? 'forcée' : 'défaut (classe / réel)'}</span>
    </div>
  )
}

/** Carte d'un membre IMPORTÉ : adossée au vrai perso, éditable par OVERRIDES (stat primaire, stuff,
 *  arbre, capacités). Toute section non retouchée reste exactement celle du perso réel. */
function ImportedMemberCard({ m, ch, canRemove, globalIlvl, globalRarity, talentBudget, onSet, onRemove }: {
  m: SimMemberCfg; ch: Character; canRemove: boolean; globalIlvl: number; globalRarity: string; talentBudget: TalentBudget
  onSet: (p: Partial<SimMemberCfg>) => void; onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const weapon = charDamageProfile(ch).mainType
  // Capacités réelles : compactées (les slots vides du perso = null → retirés pour les chips).
  const compact = (a?: (string | null)[]) => (a ?? []).filter((x): x is string => !!x)
  const realPowers = compact(ch.powers), realSupport = compact(ch.support), realPassives = compact(ch.passives)
  const customAbilities = !!(m.powers || m.support || m.passives)
  const mods = [m.gear && 'stuff', m.talents && 'arbre', customAbilities && 'capacités', m.primary && 'stat'].filter(Boolean)
  const ovBtn = 'rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200'
  const editBtn = 'rounded-lg border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200 hover:bg-orange-500/20'

  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-lg">📥</span>
          <span className="truncate text-sm font-semibold text-orange-100">{ch.name}</span>
          <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-200">RÉEL · N{ch.level}</span>
          {mods.length > 0 && <span className="shrink-0 rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-200">✎ {mods.join(' · ')}</span>}
        </span>
        <span className="text-slate-500">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-orange-500/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[10.5px] leading-snug text-slate-400">Perso <b className="text-slate-300">réel</b> : chaque section non modifiée reste exacte (valeurs réelles). Retouche ce que tu veux tester — ex. juste l'arbre, en gardant le stuff.</div>
            {canRemove && <button onClick={onRemove} className="shrink-0 rounded-lg border border-rose-700/50 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950/30">✕</button>}
          </div>

          {/* Stat primaire (s'applique au stuff RETOUCHÉ ; le stuff réel garde sa stat) */}
          <PrimarySelect value={m.primary} onChange={(v) => onSet({ primary: v })} />

          {/* Stuff : réel, ou copie retouchable pièce-par-pièce */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Stuff{m.gear ? ' — retouché (copie du réel)' : ' — réel'}</Label>
              {m.gear
                ? <button onClick={() => onSet({ gear: undefined })} className={ovBtn}>↩ Stuff réel</button>
                : <button onClick={() => onSet({ gear: gearFromCharacter(ch) })} className={editBtn}>🔧 Retoucher le stuff</button>}
            </div>
            {m.gear && <GearEditor gear={m.gear} globalIlvl={globalIlvl} globalRarity={globalRarity} onChange={(g) => onSet({ gear: g })} />}
          </div>

          {/* Talents : réels, ou copie éditable (arbre radial) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Talents{m.talents ? ' — retouché (copie du réel)' : ' — réel'}</Label>
              {m.talents
                ? <button onClick={() => onSet({ talents: undefined })} className={ovBtn}>↩ Talents réels</button>
                : <button onClick={() => onSet({ talents: { ...ch.talents } })} className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20">🌌 Retoucher l'arbre</button>}
            </div>
            {m.talents && <TalentTreeSandbox clsId={m.cls} level={ch.level} talents={m.talents} weapon={weapon} resetTo={ch.talents} budget={talentBudget} onChange={(t) => onSet({ talents: t })} />}
          </div>

          {/* Capacités : réelles, ou choix personnalisé */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Capacités{customAbilities ? ' — retouché' : ' — réel'}</Label>
              {customAbilities
                ? <button onClick={() => onSet({ powers: undefined, support: undefined, passives: undefined })} className={ovBtn}>↩ Capacités réelles</button>
                : <button onClick={() => onSet({ powers: realPowers, support: realSupport, passives: realPassives })} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/20">🪄 Choisir les capacités</button>}
            </div>
            {customAbilities && <AbilitiesEditor m={m} onSet={onSet} base={{ powers: realPowers, support: realSupport, passives: realPassives, talents: ch.talents }} />}
          </div>

          <div className="text-[10px] text-slate-600">Gemmes &amp; runes suivent le stuff (réel, ou ce que tu poses en retouchant le stuff).</div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** Étiquette lisible d'une ligne d'affixe (stat / résist / % dégâts) + couleur. */
function lineLabel(l: LineCfg): { text: string; color: string } {
  if (l.k === 'stat') { const s = SIM_STATS.find((x) => x.id === l.id); return { text: s?.short ?? l.id, color: s?.color ?? '#cbd5e1' } }
  const d = SIM_DMG_TYPES.find((x) => x.id === l.id)
  return { text: (l.k === 'resist' ? 'Rés ' : '+% ') + (d?.icon ?? l.id), color: d?.color ?? '#cbd5e1' }
}

/** Petit select « ajouter » qui se réinitialise après chaque choix. */
function AddSelect({ label, options, onPick, disabled }: { label: string; options: { id: string; label: string }[]; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <select value="" disabled={disabled} onChange={(e) => { if (e.target.value) onPick(e.target.value) }}
      className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 outline-none disabled:opacity-40">
      <option value="">{label}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

/** Éditeur DÉTAILLÉ d'une pièce : ilvl/rareté, lignes (stat/résist/%dmg) au nb de la rareté, gemmes, unique. */
function SlotDetail({ gs, rar, il, lines, isWeapon, setSlot }: { gs: GearSlotCfg; rar: string; il: number; lines: LineCfg[]; isWeapon: boolean; setSlot: (p: Partial<GearSlotCfg>) => void }) {
  const cap = maxLinesFor(rar, gs.stars ?? 3)
  const addLine = (l: LineCfg) => { if (lines.length < cap) setSlot({ lines: [...lines, l] }) }
  const removeLine = (i: number) => setSlot({ lines: lines.filter((_, j) => j !== i) })
  const toggleGem = (id: string) => { const g = gs.gems ?? []; setSlot({ gems: g.includes(id) ? g.filter((x) => x !== id) : [...g, id] }) }
  return (
    <div className="space-y-2 border-t border-slate-800 p-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-400">
        <label className="flex items-center gap-1">iLvl <Num value={il} min={1} max={700} w="w-16" onChange={(v) => setSlot({ ilvl: v })} /></label>
        <label className="flex items-center gap-1">Rareté
          <select value={rar} onChange={(e) => setSlot({ rarity: e.target.value })} className="rounded border border-slate-700 bg-slate-900/60 px-1 py-0.5 capitalize text-slate-200 outline-none">
            {SIM_RARITIES.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.affixCount}L)</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">⭐ <Num value={gs.stars ?? 3} min={1} max={5} w="w-11" onChange={(v) => setSlot({ stars: v })} /></label>
        {isWeapon && (
          <label className="flex items-center gap-1">Élément
            <select value={gs.element ?? ''} onChange={(e) => setSlot({ element: (e.target.value || undefined) as GearSlotCfg['element'] })} className="rounded border border-slate-700 bg-slate-900/60 px-1 py-0.5 text-slate-200 outline-none">
              <option value="">défaut</option>
              {SIM_DMG_TYPES.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
            </select>
          </label>
        )}
        <Seg value={gs.orientation} options={SIM_ORIENTATIONS.map((o) => ({ id: o.id, label: o.label }))} onChange={(v) => setSlot({ orientation: v })} />
      </div>
      <div>
        <div className="mb-1 text-[9.5px] uppercase tracking-wide text-slate-500">Lignes ({lines.length}/{cap})</div>
        <div className="flex flex-wrap gap-1">
          {lines.map((l, i) => { const lab = lineLabel(l); return (
            <span key={i} className="flex items-center rounded border px-1 py-0.5 text-[10px] font-semibold" style={{ color: lab.color, borderColor: lab.color + '80' }}>
              {lab.text}<button onClick={() => removeLine(i)} className="ml-1 text-rose-400 hover:text-rose-300">✕</button>
            </span>
          ) })}
          {lines.length === 0 && <span className="text-[10px] text-slate-600">aucune ligne</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <AddSelect label="+ Stat" disabled={lines.length >= cap} options={SIM_STATS.map((s) => ({ id: s.id, label: s.name }))} onPick={(id) => addLine({ k: 'stat', id })} />
          <AddSelect label="+ Résist" disabled={lines.length >= cap} options={SIM_DMG_TYPES.map((d) => ({ id: d.id, label: d.name }))} onPick={(id) => addLine({ k: 'resist', id })} />
          <AddSelect label="+ %Dégâts" disabled={lines.length >= cap} options={SIM_DMG_TYPES.map((d) => ({ id: d.id, label: d.name }))} onPick={(id) => addLine({ k: 'dmg', id })} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-wide text-slate-500">
          <span>Gemmes — châsses ({(gs.gems ?? []).length})</span>
          <GemInfoButton />
          {(gs.gems ?? []).length > 0 && <span className="flex items-center gap-1 normal-case tracking-normal text-slate-400">rang <Num value={gs.gemRank ?? 5} min={1} max={SIM_MAX_GEM_RANK} w="w-11" onChange={(v) => setSlot({ gemRank: v })} /></span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {SIM_GEMS.map((g) => (
            <Chip key={g.id} on={(gs.gems ?? []).includes(g.id)} color={g.kind === 'off' ? 'emerald' : 'sky'} onClick={() => toggleGem(g.id)} title={g.name}>{g.icon}</Chip>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-400">✦ Unique
        <select value={gs.unique ?? ''} onChange={(e) => setSlot({ unique: e.target.value || undefined })} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900/60 px-1 py-0.5 text-slate-200 outline-none">
          <option value="">— aucun —</option>
          {SIM_UNIQUES.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {gs.unique && <span className="flex shrink-0 items-center gap-1">rang <Num value={gs.uniqueRank ?? SIM_MAX_UNIQUE_RANK} min={1} max={SIM_MAX_UNIQUE_RANK} w="w-11" onChange={(v) => setSlot({ uniqueRank: v })} /></span>}
      </div>
      {gs.unique && <div className="rounded bg-black/20 px-2 py-1 text-[10px] leading-snug text-slate-400">{SIM_UNIQUES.find((u) => u.id === gs.unique)?.desc}</div>}
    </div>
  )
}

/** Éditeur de stuff PIÈCE-PAR-PIÈCE : chaque emplacement s'ouvre en éditeur d'objet complet. */
function GearEditor({ gear, globalIlvl, globalRarity, onChange }: { gear: Record<string, GearSlotCfg>; globalIlvl: number; globalRarity: string; onChange: (g: Record<string, GearSlotCfg>) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const setSlot = (id: string, p: Partial<GearSlotCfg>) => onChange({ ...gear, [id]: { ...gear[id], ...p } })
  const applyAllOrientation = (orientation: GearSlotCfg['orientation']) => { const g = { ...gear }; for (const k in g) g[k] = { ...g[k], orientation }; onChange(g) }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">Tout en :
        {SIM_ORIENTATIONS.map((o) => <button key={o.id} onClick={() => applyAllOrientation(o.id)} className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800">{o.label}</button>)}
      </div>
      <div className="max-h-[26rem] space-y-1 overflow-y-auto pr-1">
        {SIM_SLOTS.map((sl) => {
          const gs = gear[sl.id]; if (!gs) return null
          const lines = gs.lines ?? statLines(gs.stats ?? [])
          const rar = gs.rarity ?? globalRarity, il = gs.ilvl ?? globalIlvl
          const isOpen = open === sl.id
          return (
            <div key={sl.id} className="rounded-lg border border-slate-800 bg-slate-900/40">
              <button onClick={() => setOpen(isOpen ? null : sl.id)} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left">
                <span className="text-[11px] font-medium text-slate-300">{sl.icon} {sl.name}</span>
                <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
                  <span>iL{il} · {rar.slice(0, 5)} · {lines.length}L{gs.gems?.length ? ` · ${gs.gems.length}◆` : ''}{gs.unique ? ' · ✦' : ''}</span>
                  <span>{isOpen ? '▴' : '▾'}</span>
                </span>
              </button>
              {isOpen && <SlotDetail gs={gs} rar={rar} il={il} lines={lines} isWeapon={sl.accepts === 'armePrincipale'} setSlot={(p) => setSlot(sl.id, p)} />}
            </div>
          )
        })}
      </div>
      <div className="text-[10px] text-slate-600">Clique une pièce pour l'éditer : ilvl/rareté, lignes (stat/résist/%dmg) au nb de la rareté, gemmes (châsses), unique. Valeurs auto au budget.</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** Bac-à-sable de talents : le VRAI arbre radial (TalentTree en mode contrôlé) édite une COPIE locale
 *  sans toucher la vraie partie. Clic sur un nœud = +1 (allouable) / −1 (déjà pris) ; ↺ Reset. Le pool de
 *  points est PARTAGÉ par l'équipe et fixé par le niveau (comme le vrai jeu) ; le gating réel (adjacence,
 *  seuils minSpent, exclusifs) s'applique. */
function TalentTreeSandbox({ clsId, level, talents, onChange, weapon, resetTo, budget }: {
  clsId: string; level: number; talents: Record<string, number>; onChange: (t: Record<string, number>) => void
  /** Élément d'arme (sinon = élément de la classe). */
  weapon?: DamageType
  /** Cible du Reset (sinon = chemin de classe). Pour un import : les talents RÉELS du perso. */
  resetTo?: Record<string, number>
  /** Pool PARTAGÉ par l'équipe (niveau de compte). `remaining` = points encore allouables (communs). */
  budget: TalentBudget
}) {
  const mySpent = Object.entries(talents).reduce((a, [k, v]) => a + (k === 'co_start' ? 0 : v), 0)
  const points = budget.remaining // reste COMMUN à l'équipe — ce que les autres dépensent réduit le tien
  const wpn = weapon ?? getClassPreset(clsId).elem
  const onAllocate = (id: string) => onChange({ ...talents, [id]: (talents[id] ?? 0) + 1 })
  const onRemove = (id: string) => {
    const r = talents[id] ?? 0; if (r <= 0) return
    const t = { ...talents }; if (r - 1 <= 0) delete t[id]; else t[id] = r - 1
    onChange(t)
  }
  const onReset = () => onChange(resetTo ? { ...resetTo } : initTalents(clsId))
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400" title="Pool de talents PARTAGÉ par l'équipe, fixé par le niveau de compte (= niveau le plus haut de l'équipe). Pour plus de points : monte le niveau — pas de budget libre.">
          🤝 Pool d'équipe · niv {budget.level} : <b className="text-slate-200">{budget.pool}</b> pts
        </span>
        <span className="text-slate-500">équipe <b className="text-emerald-300">{budget.teamSpent}</b> · reste <b className={points <= 0 ? 'text-rose-400' : 'text-amber-300'}>{points}</b></span>
      </div>
      <div className="text-[10px] text-slate-500">Ce perso : <b className="text-slate-300">{mySpent}</b> pts{points <= 0 ? ' · pool épuisé — monte le niveau ou libère des points (ici ou sur un autre perso)' : ''}</div>
      <div className="h-[32rem] rounded-lg border border-slate-800 bg-[#0b1120] p-1.5">
        <TalentTree ctrl={{ talents, points, level, weapon: wpn, onAllocate, onRemove, onReset }} />
      </div>
      <div className="text-[10px] text-slate-600">Clique un nœud pour l'allouer (+1) ; re-clique un nœud pris pour le retirer (−1). Pool PARTAGÉ : développer 2 arbres splitte le même budget. Sorts équipés = ceux de la classe (v1).</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** Choix des capacités ÉQUIPÉES (actifs/soutien/passifs) parmi celles débloquées par les talents,
 *  bornées au nombre de slots. */
function AbilitiesEditor({ m, onSet, base }: {
  m: SimMemberCfg; onSet: (p: Partial<SimMemberCfg>) => void
  /** Défauts si une section n'est pas overridée (membre importé : capacités/talents RÉELS). */
  base?: { powers: string[]; support: string[]; passives: string[]; talents: Record<string, number> }
}) {
  const preset = SIM_CLASSES.find((c) => c.id === m.cls) ?? SIM_CLASSES[0]
  const defPowers = base?.powers ?? preset.powers, defSupport = base?.support ?? preset.support, defPassives = base?.passives ?? preset.passives
  const cur = { active: m.powers ?? defPowers, support: m.support ?? defSupport, passive: m.passives ?? defPassives }
  const avail = availableAbilities(m.talents ?? base?.talents ?? initTalents(m.cls), cur) // inclut les capacités déjà équipées
  const FIELD = { active: 'powers', support: 'support', passive: 'passives' } as const
  const groups = [
    { k: 'active' as const, label: 'Actifs', list: avail.active },
    { k: 'support' as const, label: 'Soutien', list: avail.support },
    { k: 'passive' as const, label: 'Passifs', list: avail.passive },
  ]
  const toggle = (k: 'active' | 'support' | 'passive', id: string) => {
    const list = cur[k], cap = SIM_ABILITY_SLOTS[k]
    const next = list.includes(id) ? list.filter((x) => x !== id) : (list.length < cap ? [...list, id] : list)
    onSet({ [FIELD[k]]: next })
  }
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.k}>
          <div className="mb-1 text-[9.5px] uppercase tracking-wide text-slate-500">{g.label} ({cur[g.k].length}/{SIM_ABILITY_SLOTS[g.k]})</div>
          {g.list.length === 0
            ? <div className="text-[10px] text-slate-600">Aucune capacité de ce type débloquée par l'arbre.</div>
            : <div className="flex flex-wrap gap-1.5">
                {g.list.map((a) => {
                  const on = cur[g.k].includes(a.id)
                  const full = !on && cur[g.k].length >= SIM_ABILITY_SLOTS[g.k]
                  return (
                    <button key={a.id} onClick={() => toggle(g.k, a.id)} disabled={full} title={a.name}
                      className={'rounded-full border px-2 py-0.5 text-[10.5px] transition-colors ' + (on ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200' : full ? 'border-slate-800 text-slate-700' : 'border-slate-700 text-slate-400 hover:text-slate-200')}>
                      {a.icon} {a.name}
                    </button>
                  )
                })}
              </div>}
        </div>
      ))}
      <div className="text-[10px] text-slate-600">L'arbre débloque plus de capacités que de slots — choisis lesquelles équiper.</div>
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
