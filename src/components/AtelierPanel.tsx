import { useState } from 'react'
import type { ReactNode } from 'react'
import { useGame } from '../game/store'
import { ITEM_TYPES } from '../game/slots'
import { PRIMARY_META } from '../game/stats'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RARITY_LIST } from '../game/rarities'
import { maxCraftTier, createCost } from '../game/items'
import {
  METIERS, METIER_LIST, METIER_NODES, METIER_MAX_LEVEL, AUTOMATE_FORGERON_LEVELS, CONVERSIONS,
  craftMods, levelFromXp, xpTotalForLevel, pointsAvailable, pointsTotal, canLearnNode, nodeRank, respecCost,
  type MetierId,
} from '../game/metiers'
import { ENCHANTS } from '../game/enchants'
import {
  COND_GEM_LIST, GEM_FAMILIES, GEM_CUT_COST, parseCondKey, gemDesc, gemMaxRank, grindDust,
  type GemFamily, type CondGemId,
} from '../game/condGems'
import {
  missionLabel, automateRunDuration, automateEfficiency, automateUpgradeCost,
  AUTOMATE_MAX, AUTOMATE_COSTS, AUTOMATE_UPG_MAX, type AutomateMission,
} from '../game/automates'
import { DUNGEON_LIST } from '../game/dungeons'
import { RAID_LIST } from '../game/raids'
import { stageIlvl } from '../game/enemies'
import { Sheet } from './ui'
import type { ItemType, OffensiveStat, ItemOrientation, DamageType, RarityId } from '../game/types'

const TYPE_LIST = Object.values(ITEM_TYPES)
const OFFENSIVE: OffensiveStat[] = ['force', 'agilite', 'intelligence']
const ORIENTATIONS: { id: ItemOrientation; label: string }[] = [
  { id: 'offensif', label: 'Offensif' },
  { id: 'equilibre', label: 'Équilibré' },
  { id: 'defensif', label: 'Défensif' },
]

/**
 * L'Atelier des MÉTIERS (v0.22) — hub des 4 métiers de craft.
 * Chaque métier : un niveau monté par la pratique, un arbre (1 point/niveau), son atelier.
 * Forgeron (création + automates) · Joaillier (gemmes) · Runiste (runes) · Alchimiste (quintessences/uniques).
 */
export function AtelierPanel() {
  const bestStage = useGame((s) => s.bestStage)
  const metiers = useGame((s) => s.metiers)
  const [metier, setMetier] = useState<MetierId>('forgeron')
  const def = METIERS[metier]
  const unlocked = bestStage >= def.unlockStage

  return (
    <div className="h-full overflow-y-auto pr-1">
      {/* Barre des métiers */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {METIER_LIST.map((m) => {
          const open = bestStage >= m.unlockStage
          const st = metiers[m.id]
          const lvl = levelFromXp(st.xp)
          const pts = open ? pointsAvailable(st) : 0
          const active = metier === m.id
          return (
            <button
              key={m.id}
              onClick={() => setMetier(m.id)}
              className={
                'relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[10px] transition-colors ' +
                (active ? 'border-current bg-white/10' : open ? 'border-slate-700 text-slate-300 hover:border-slate-500' : 'border-slate-800 text-slate-600')
              }
              style={active ? { color: m.color } : undefined}
            >
              {pts > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950">{pts}</span>}
              <span className="text-xl leading-none">{open ? m.icon : '🔒'}</span>
              <span className="font-semibold">{m.name}</span>
              <span className="text-[9px] text-slate-500">{open ? `niv. ${lvl}` : `palier ${m.unlockStage}`}</span>
            </button>
          )
        })}
      </div>

      {!unlocked ? (
        <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-4 text-center">
          <div className="text-2xl">🔒</div>
          <div className="mt-1 text-sm font-semibold text-slate-300">{def.icon} {def.name} — « {def.verb} »</div>
          <div className="mt-1 text-[11px] text-slate-500">Atteins le palier {def.unlockStage} pour ouvrir ce métier.</div>
        </div>
      ) : (
        <>
          <MetierHeader metier={metier} />
          <MetierTree metier={metier} />
          {metier === 'forgeron' && <ForgeronWorkshop />}
          {metier === 'joaillier' && <GemWorkshop />}
          {metier === 'runiste' && <RunisteWorkshop />}
          {metier === 'alchimiste' && <AlchimisteWorkshop />}
        </>
      )}
    </div>
  )
}

/** En-tête de métier : verbe, niveau, barre d'XP, points disponibles, respec. */
function MetierHeader({ metier }: { metier: MetierId }) {
  const st = useGame((s) => s.metiers[metier])
  const gold = useGame((s) => s.gold)
  const respec = useGame((s) => s.respecMetier)
  const def = METIERS[metier]
  const lvl = levelFromXp(st.xp)
  const pts = pointsAvailable(st)
  const maxed = lvl >= METIER_MAX_LEVEL
  const cur = st.xp - xpTotalForLevel(lvl)
  const need = xpTotalForLevel(lvl + 1) - xpTotalForLevel(lvl)
  const cost = respecCost(st)
  const hasNodes = Object.keys(st.nodes).length > 0

  return (
    <div className="mb-3 rounded-xl border p-2.5" style={{ borderColor: def.color + '44', background: def.color + '0d' }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold" style={{ color: def.color }}>{def.icon} {def.name} <span className="font-normal text-slate-500">· « {def.verb} »</span></span>
        <span className="text-[11px] font-semibold text-slate-200">niv. {lvl}<span className="text-slate-500">/{METIER_MAX_LEVEL}</span></span>
      </div>
      {!maxed && (
        <div className="mt-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full transition-all" style={{ width: `${Math.min(100, (cur / need) * 100)}%`, background: def.color }} />
          </div>
          <div className="mt-0.5 text-right text-[9px] text-slate-500">{Math.floor(cur).toLocaleString('fr-FR')} / {need.toLocaleString('fr-FR')} XP — pratique ton métier pour progresser</div>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between text-[10.5px]">
        <span className={pts > 0 ? 'font-semibold text-amber-300' : 'text-slate-500'}>
          {pts > 0 ? `★ ${pts} point${pts > 1 ? 's' : ''} d'arbre à dépenser` : `${pointsTotal(st)} point${pointsTotal(st) > 1 ? 's' : ''} d'arbre gagné${pointsTotal(st) > 1 ? 's' : ''}`}
        </span>
        {hasNodes && (
          <button
            disabled={gold < cost}
            onClick={() => respec(metier)}
            title={`Réinitialise l'arbre (XP conservée) — ${cost.toLocaleString('fr-FR')} or`}
            className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            ↺ Respec · 💰 {cost.toLocaleString('fr-FR')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Arbre du métier : nœuds (déblocages + bonus + spécialisations exclusives). */
function MetierTree({ metier }: { metier: MetierId }) {
  const metiers = useGame((s) => s.metiers)
  const bestStage = useGame((s) => s.bestStage)
  const learn = useGame((s) => s.learnMetierNode)
  const st = metiers[metier]
  const pts = pointsAvailable(st)
  const [open, setOpen] = useState(pts > 0)
  const def = METIERS[metier]

  return (
    <div className="mb-3 rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span>🌳 Arbre de compétences {pts > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[9px] text-slate-950">{pts}</span>}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {METIER_NODES[metier].map((n) => {
            const rank = nodeRank(metiers, metier, n.id)
            const owned = rank >= n.maxRank
            const check = canLearnNode(metiers, metier, n.id, bestStage)
            const isSpec = !!n.exclusive
            return (
              <button
                key={n.id}
                disabled={!check.ok}
                onClick={() => learn(metier, n.id)}
                title={check.ok ? n.desc : `${n.desc}\n— ${check.reason}`}
                className={
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left disabled:opacity-60 ' +
                  (owned ? 'border-emerald-700/50 bg-emerald-950/20' : rank > 0 ? 'border-amber-700/50 bg-amber-950/10' : 'border-slate-700 bg-black/20 enabled:hover:border-amber-600/60')
                }
                style={isSpec && rank > 0 ? { borderColor: def.color } : undefined}
              >
                <span className="text-base">{n.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-slate-200">
                    {isSpec && <span style={{ color: def.color }}>◈ </span>}{n.name}{n.maxRank > 1 ? <span className="text-slate-500"> {rank}/{n.maxRank}</span> : null}
                  </span>
                  <span className="block text-[8.5px] leading-snug text-slate-500">{n.desc}</span>
                  {!owned && !check.ok && check.reason !== 'Aucun point disponible — pratique ton métier.' && (
                    <span className="block text-[8.5px] font-medium text-rose-400/80">🔒 {check.reason}</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] font-semibold">
                  {owned ? <span className="text-emerald-400">✓</span> : <span className={check.ok ? 'text-amber-300' : 'text-slate-600'}>1 pt</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 🔨 Forgeron : création d'objets + automates                         */
/* ------------------------------------------------------------------ */

function ForgeronWorkshop() {
  const bestStage = useGame((s) => s.bestStage)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const fragments = useGame((s) => s.fragments)
  const poussiere = useGame((s) => s.poussiere)
  const cosmic = useGame((s) => s.cosmic)
  const createItem = useGame((s) => s.createItem)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)

  const ilvl = stageIlvl(bestStage)
  const maxTier = maxCraftTier(bestStage)
  const rarities = RARITY_LIST.filter((r) => r.tier <= maxTier)

  const [type, setType] = useState<ItemType>('armePrincipale')
  const [primary, setPrimary] = useState<OffensiveStat>('force')
  const [orientation, setOrientation] = useState<ItemOrientation>('equilibre')
  const [element, setElement] = useState<DamageType>('feu')
  const [rarity, setRarity] = useState<RarityId>(rarities[Math.min(3, rarities.length - 1)].id)

  const isWeapon = type === 'armePrincipale'
  const tier = RARITY_LIST.find((r) => r.id === rarity)!.tier
  const raw = createCost(tier, ilvl)
  const cm = mods.costMult
  const cost = { eclats: Math.round(raw.eclats * cm), noyau: Math.round(raw.noyau * cm), fragments: Math.round((raw.fragments ?? 0) * cm), poussiere: Math.round((raw.poussiere ?? 0) * cm), cosmic: Math.round((raw.cosmic ?? 0) * cm) }
  const canForge = essence >= cost.eclats && noyau >= cost.noyau && fragments >= cost.fragments && poussiere >= cost.poussiere && cosmic >= cost.cosmic

  return (
    <>
      {/* Automates : la branche Industrialisation du Forgeron */}
      <AutomateWorkshop />

      {/* Type d'objet */}
      <Section title="Type d'objet">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {TYPE_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              title={t.name}
              className={
                'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[9px] ' +
                (type === t.id ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-400 hover:border-slate-500')
              }
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Affinité */}
      <Section title="Affinité (stat offensive)">
        <div className="grid grid-cols-3 gap-1.5">
          {OFFENSIVE.map((p) => (
            <button
              key={p}
              onClick={() => setPrimary(p)}
              className={
                'rounded-lg border py-1.5 text-xs font-medium ' +
                (primary === p ? 'border-transparent text-slate-950' : 'border-slate-700 text-slate-300 hover:border-slate-500')
              }
              style={primary === p ? { background: PRIMARY_META[p].color } : undefined}
            >
              {PRIMARY_META[p].name}
            </button>
          ))}
        </div>
      </Section>

      {/* Orientation offensive/défensive */}
      <Section title="Orientation (dégâts ↔ survie)">
        <div className="grid grid-cols-3 gap-1.5">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrientation(o.id)}
              className={
                'rounded-lg border py-1.5 text-xs font-medium ' +
                (orientation === o.id ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-300 hover:border-slate-500')
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Élément (armes uniquement) */}
      {isWeapon && (
        <Section title="Élément de l'arme">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {DAMAGE_TYPE_LIST.map((d) => {
              const m = DAMAGE_TYPES[d]
              return (
                <button
                  key={d}
                  onClick={() => setElement(d)}
                  title={m.name}
                  className={
                    'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[9px] ' +
                    (element === d ? 'border-current bg-white/5' : 'border-slate-700 text-slate-400 hover:border-slate-500')
                  }
                  style={element === d ? { color: m.color } : undefined}
                >
                  <span className="text-sm leading-none">{m.icon}</span>
                  <span className="truncate">{m.name}</span>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* Rareté cible */}
      <Section title={`Rareté cible (max : ${rarities[rarities.length - 1].name})`}>
        <div className="flex flex-wrap gap-1.5">
          {rarities.map((r) => (
            <button
              key={r.id}
              onClick={() => setRarity(r.id)}
              className={'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ' + (rarity === r.id ? 'border-current' : 'border-slate-700/60')}
              style={{ color: r.color }}
            >
              {r.name}
            </button>
          ))}
        </div>
      </Section>

      {/* Récapitulatif + coût */}
      <div className="mt-3 rounded-lg bg-black/30 p-3 text-xs text-slate-400">
        <div>iLvl de l'objet : <span className="text-slate-200">{ilvl}</span> (lié à ton record de palier)</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span>Coût :</span>
          <span className={essence >= cost.eclats ? 'text-cyan-300' : 'text-red-400'}>♦ {cost.eclats}</span>
          {cost.noyau > 0 && (
            <span className={noyau >= cost.noyau ? 'text-fuchsia-300' : 'text-red-400'}>💠 {cost.noyau}</span>
          )}
          {(cost.poussiere ?? 0) > 0 && (
            <span className={poussiere >= (cost.poussiere ?? 0) ? 'text-indigo-300' : 'text-red-400'}>🌌 {cost.poussiere}</span>
          )}
          {(cost.fragments ?? 0) > 0 && (
            <span className={fragments >= (cost.fragments ?? 0) ? 'text-sky-300' : 'text-red-400'}>✨ {cost.fragments}</span>
          )}
          {(cost.cosmic ?? 0) > 0 && (
            <span className={cosmic >= (cost.cosmic ?? 0) ? 'text-violet-300' : 'text-red-400'}>💫 {cost.cosmic}</span>
          )}
        </div>
        {(mods.costMult < 1 || mods.luckChance > 0) && (
          <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-amber-300/80">
            {mods.costMult < 1 && <span>💰 −{Math.round((1 - mods.costMult) * 100)}% coûts (arbre)</span>}
            {mods.luckChance > 0 && <span>🎲 +{Math.round(mods.luckChance * 100)}% chance de rareté supérieure</span>}
          </div>
        )}
        {tier >= 7 && <div className="mt-1 text-[10.5px] text-fuchsia-300/80">Rareté Artefact+ : chance d'obtenir un effet unique.</div>}
      </div>

      <button
        disabled={!canForge}
        onClick={() => createItem({ type, primary, rarity, orientation, ...(isWeapon ? { element } : {}) })}
        className="mt-3 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-40"
      >
        Forger {isWeapon ? `${DAMAGE_TYPES[element].icon} ` : ''}{ITEM_TYPES[type].name}
      </button>
      <p className="mt-1.5 pb-2 text-center text-[10px] text-slate-500">L'objet apparaît dans ton Sac. Forger donne de l'XP de Forgeron.</p>
    </>
  )
}

/**
 * Atelier des automates : construction (3 max, gated par l'arbre + niveau de Forgeron),
 * assignation de mission (donjon/raid DÉJÀ battu), améliorations vitesse/rendement (or).
 */
function AutomateWorkshop() {
  const automates = useGame((s) => s.automates)
  const gold = useGame((s) => s.gold)
  const poussiere = useGame((s) => s.poussiere)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const metiers = useGame((s) => s.metiers)
  const dungeonProgress = useGame((s) => s.dungeonProgress)
  const raidProgress = useGame((s) => s.raidProgress)
  const buildAutomate = useGame((s) => s.buildAutomate)
  const assignAutomate = useGame((s) => s.assignAutomate)
  const toggleAutomatePause = useGame((s) => s.toggleAutomatePause)
  const upgradeAutomate = useGame((s) => s.upgradeAutomate)
  const [assigning, setAssigning] = useState<number | null>(null)

  const mods = craftMods(metiers)
  const forgeronLvl = levelFromXp(metiers.forgeron.xp)
  // L'atelier n'apparaît qu'une fois la branche Industrialisation apprise (ou un automate possédé).
  if (!mods.automates && automates.length === 0) return null

  const nextCost = AUTOMATE_COSTS[automates.length]
  const lvlReq = AUTOMATE_FORGERON_LEVELS[automates.length] ?? Infinity
  const beatenDungeons = DUNGEON_LIST.filter((d) => (dungeonProgress[d.id] ?? 0) > 0)
  const beatenRaids = RAID_LIST.filter((r) => (raidProgress[r.id] ?? 0) > 0)

  return (
    <div className="mb-3 rounded-xl border border-violet-800/40 bg-violet-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-300">🤖 Industrialisation — automates</span>
        <span className="text-[10px] text-slate-500">{automates.length}/{AUTOMATE_MAX}</span>
      </div>
      <p className="mb-2 text-[9.5px] leading-snug text-slate-500">
        Une machine refait EN BOUCLE un donjon/raid déjà battu (au niveau record), même hors-ligne.
        Elle consomme les clés (🔑/🔮) et rapporte les ressources à 60–85% — jamais le stuff ni les 💫.
        Astuce : un automate sur l'Antre des Failles produit les Sceaux des autres.
      </p>

      <div className="space-y-2">
        {automates.map((a) => {
          const duration = automateRunDuration(a, mods.automateDurMult)
          const pct = a.mission ? Math.min(100, (a.progress / duration) * 100) : 0
          return (
            <div key={a.id} className="rounded-lg border border-slate-700 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-violet-200">🤖 {a.name}</span>
                <span className="text-[9px] text-slate-500">rendement {Math.round(automateEfficiency(a) * 100)}% · run {a.mission ? Math.round(duration) + ' s' : '—'}</span>
              </div>
              <div className="mt-1 text-[10.5px]">
                {a.mission ? (
                  <span className="text-slate-300">{missionLabel(a.mission)}{a.paused ? ' · ⏸ en pause' : a.waiting ? ' · ⏳ en attente de clés' : ''}</span>
                ) : (
                  <span className="italic text-slate-500">Sans mission — assigne-lui un donjon ou un raid battu.</span>
                )}
              </div>
              {a.mission && !a.paused && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                <button onClick={() => setAssigning(a.id)} className="rounded bg-violet-900/40 px-2 py-1 font-medium text-violet-200 hover:bg-violet-800/50">
                  🎯 Mission
                </button>
                {a.mission && (
                  <button onClick={() => toggleAutomatePause(a.id)} className="rounded bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700">
                    {a.paused ? '▶ Reprendre' : '⏸ Pause'}
                  </button>
                )}
                {(['speed', 'yield'] as const).map((kind) => {
                  const lvl = kind === 'speed' ? a.speedLvl : a.yieldLvl
                  const maxed = lvl >= AUTOMATE_UPG_MAX
                  const cost = automateUpgradeCost(kind, lvl)
                  return (
                    <button
                      key={kind}
                      disabled={maxed || gold < cost}
                      onClick={() => upgradeAutomate(a.id, kind)}
                      className="rounded bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    >
                      {kind === 'speed' ? '⚡ Vitesse' : '📈 Rendement'} {lvl}/{AUTOMATE_UPG_MAX}{maxed ? '' : ` · 💰${(cost / 1000).toLocaleString('fr-FR')}k`}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {nextCost && mods.automates && (
          forgeronLvl < lvlReq ? (
            <div className="rounded-lg border border-slate-800 bg-black/20 py-2 text-center text-[10px] text-slate-500">
              🔒 Prochain automate « {['Rouage', 'Enclume', 'Vigile'][automates.length]} » : Forgeron niveau {lvlReq} requis (actuel : {forgeronLvl}).
            </div>
          ) : (
            <button
              onClick={buildAutomate}
              disabled={gold < nextCost.gold || poussiere < nextCost.poussiere || fragments < nextCost.fragments || cosmic < nextCost.cosmic}
              className="w-full rounded-lg border border-violet-700/50 bg-violet-900/20 py-2 text-[11px] font-medium text-violet-200 hover:bg-violet-800/30 disabled:opacity-40"
            >
              🛠 Construire « {['Rouage', 'Enclume', 'Vigile'][automates.length]} » · 💰 {nextCost.gold.toLocaleString('fr-FR')} + 🌌 {nextCost.poussiere}
              {' '}+ ✨ {nextCost.fragments}{nextCost.cosmic ? ` + 💫 ${nextCost.cosmic}` : ''}
            </button>
          )
        )}
      </div>

      {/* Feuille d'assignation : contenu déjà battu uniquement (farmé au niveau record) */}
      {assigning !== null && (
        <Sheet title="🎯 Mission de l'automate" onClose={() => setAssigning(null)}>
          <p className="mb-2 text-[11px] leading-snug text-slate-500">
            Uniquement du contenu DÉJÀ battu — l'automate farme au niveau record (les gains suivent si tu bats mieux : réassigne).
          </p>
          <div className="space-y-1">
            {beatenDungeons.map((d) => {
              const rec = dungeonProgress[d.id] ?? 0
              const m: AutomateMission = { kind: 'dungeon', id: d.id, level: rec }
              return (
                <button
                  key={d.id}
                  onClick={() => { assignAutomate(assigning, m); setAssigning(null) }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-2.5 py-2 text-left text-[12px] hover:border-violet-500"
                >
                  <span style={{ color: d.color }}>{d.icon} {d.name}</span>
                  <span className="text-[10px] text-slate-500">niv. {rec}{d.sceauCost ? ` · ${d.sceauCost} 🔑/run` : ' · gratuit'}</span>
                </button>
              )
            })}
            {beatenRaids.map((r) => {
              const rec = raidProgress[r.id] ?? 0
              const m: AutomateMission = { kind: 'raid', id: r.id, level: rec }
              return (
                <button
                  key={r.id}
                  onClick={() => { assignAutomate(assigning, m); setAssigning(null) }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-2.5 py-2 text-left text-[12px] hover:border-violet-500"
                >
                  <span style={{ color: r.color }}>{r.icon} {r.name}</span>
                  <span className="text-[10px] text-slate-500">T{rec} · {r.orbeCost} 🔮/run</span>
                </button>
              )
            })}
            {beatenDungeons.length === 0 && beatenRaids.length === 0 && (
              <div className="text-center text-[11px] italic text-slate-500">Bats d'abord un donjon ou un raid.</div>
            )}
            <button
              onClick={() => { assignAutomate(assigning, null); setAssigning(null) }}
              className="w-full rounded-lg bg-slate-800 py-2 text-[11px] text-slate-400 hover:bg-slate-700"
            >
              ✕ Retirer la mission
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 💎 Joaillier : taillerie (stock + fusion)                           */
/* ------------------------------------------------------------------ */

function GemWorkshop() {
  const gems = useGame((s) => s.gems)
  const gemDust = useGame((s) => s.gemDust)
  const grindGem = useGame((s) => s.grindGem)
  const cutGem = useGame((s) => s.cutGem)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const [cutOpen, setCutOpen] = useState(false)
  const [cutFamily, setCutFamily] = useState<GemFamily | 'all'>('all')

  // Stock : entrées `cond:id[:rang]` décodées, groupées par famille.
  const stock = Object.entries(gems)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ key: k, parsed: parseCondKey(k), n }))
    .filter((x): x is { key: string; parsed: NonNullable<ReturnType<typeof parseCondKey>>; n: number } => !!x.parsed)
    .sort((a, b) => a.parsed.def.family.localeCompare(b.parsed.def.family) || a.parsed.def.name.localeCompare(b.parsed.def.name))
  const total = stock.reduce((a, x) => a + x.n, 0)
  const cutList = COND_GEM_LIST.filter((g) => cutFamily === 'all' || g.family === cutFamily)

  return (
    <div className="mb-3 rounded-xl border border-sky-800/40 bg-sky-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">💎 Taillerie</span>
        <span className="text-[10px] text-slate-400">🔹 {gemDust.toLocaleString('fr-FR')} poussière · {total} gemme{total > 1 ? 's' : ''}</span>
      </div>
      <p className="mb-1.5 text-[9.5px] leading-snug text-slate-500">
        Les gemmes de CONDITION programment le combat (3 familles : 🥁 Rythme, 🌊 Flux, 🌍 Environnement).
        Elles droppent par famille selon le biome ; sertis-les via la fiche d'un objet (Rare+).
        La RECOUPE (paramètres) se fait sur les gemmes SERTIES, depuis la fiche de l'objet.
        {!mods.gems && ' 🔒 Sertissage : apprends le nœud ci-dessus.'}
      </p>

      {/* Stock */}
      {total === 0 ? (
        <div className="text-[10px] italic text-slate-500">
          Aucune gemme — drops de biome (rare), champions ✦ (12%), raids… ou la TAILLE ci-dessous.
        </div>
      ) : (
        <div className="space-y-1">
          {stock.map(({ key, parsed, n }) => {
            const fam = GEM_FAMILIES[parsed.def.family]
            return (
              <div key={key} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                <span className="shrink-0 font-medium" style={{ color: parsed.def.color }} title={fam.name}>
                  {fam.icon} {parsed.def.icon} {parsed.def.name}{parsed.rank > 1 ? ` R${parsed.rank}` : ''} ×{n}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-500">{gemDesc(parsed.def, parsed.rank)}</span>
                {mods.broyage && (
                  <button
                    onClick={() => grindGem(key)}
                    title={`Broyer → +${grindDust(parsed.rank)} 🔹`}
                    className="shrink-0 rounded bg-slate-800 px-1.5 py-1 text-slate-400 hover:text-sky-200"
                  >
                    ⚒️ +{grindDust(parsed.rank)} 🔹
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Taille : façonner la gemme de son choix (déblocage par l'arbre) */}
      {mods.taille ? (
        <div className="mt-2">
          <button onClick={() => setCutOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[11px] font-semibold text-sky-200">
            <span>✂️ Tailler une gemme au choix · {GEM_CUT_COST} 🔹</span>
            <span>{cutOpen ? '▾' : '▸'}</span>
          </button>
          {cutOpen && (
            <>
              <div className="mb-1 mt-1 flex flex-wrap gap-1 text-[9px]">
                <button onClick={() => setCutFamily('all')} className={'rounded px-2 py-1 ' + (cutFamily === 'all' ? 'bg-sky-600 text-slate-50' : 'bg-slate-800 text-slate-400')}>Toutes</button>
                {(Object.keys(GEM_FAMILIES) as GemFamily[]).map((f) => (
                  <button key={f} onClick={() => setCutFamily(f)} className={'rounded px-2 py-1 ' + (cutFamily === f ? 'bg-sky-600 text-slate-50' : 'bg-slate-800 text-slate-400')}>
                    {GEM_FAMILIES[f].icon} {GEM_FAMILIES[f].name}
                  </button>
                ))}
              </div>
              <div className="space-y-0.5">
                {cutList.map((def) => (
                  <button
                    key={def.id}
                    disabled={gemDust < GEM_CUT_COST}
                    onClick={() => cutGem(def.id as CondGemId)}
                    title={gemDesc(def, 1)}
                    className="flex w-full items-center gap-1.5 rounded border border-slate-700 px-1.5 py-1 text-left text-[10px] enabled:hover:border-sky-500 disabled:opacity-40"
                  >
                    <span className="shrink-0 font-medium" style={{ color: def.color }}>{def.icon} {def.name}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{gemDesc(def, 1)}</span>
                    <span className="shrink-0 text-[9px] text-slate-500">rangs : {gemMaxRank(def)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[9px] italic text-slate-600">✂️ Taille (gemme au choix) et 🔬 Recoupe (rangs) : nœuds de l'arbre ci-dessus.</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 🪄 Runiste : aperçu des runes                                       */
/* ------------------------------------------------------------------ */

function RunisteWorkshop() {
  const metiers = useGame((s) => s.metiers)
  const runesOwned = useGame((s) => s.runesOwned)
  const mods = craftMods(metiers)
  const timeRunes = ENCHANTS.filter((e) => e.time)
  const ruleRunes = ENCHANTS.filter((e) => e.rule)
  const ownedBadge = (id: string) => {
    const n = runesOwned[id] ?? 0
    return (
      <span className={'shrink-0 rounded px-1 text-[9px] font-semibold ' + (n > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-600')}>
        ×{n}
      </span>
    )
  }

  return (
    <div className="mb-3 rounded-xl border border-purple-800/40 bg-purple-950/10 p-2.5">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-300">🪄 Stash de runes</div>
      <p className="mb-2 text-[9.5px] leading-snug text-slate-500">
        v0.25 : les runes <b className="text-purple-300">TOMBENT</b> — en ☠️ raid surtout (chance ↑ avec le tier), rarement en
        donjon ; les runes de RÈGLE sont 2× plus rares. Graver (depuis la fiche d'un objet)
        <b className="text-amber-300"> consomme</b> l'exemplaire ; écraser ne rembourse pas.
        {!mods.enchant && ' 🔒 Apprends « Gravure » ci-dessus pour commencer.'}
      </p>
      <div className="mb-1 text-[10px] font-semibold text-purple-300/80">
        ⏳ Runes de TEMPS {mods.runisteTempo > 1 && <span className="font-normal text-emerald-400">— ◈ Chronomancien : +50% d'efficacité</span>}
      </div>
      <div className="space-y-0.5">
        {timeRunes.map((e) => (
          <div key={e.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
            {ownedBadge(e.id)}
            <span className="shrink-0 font-medium text-slate-200">{e.icon} {e.name}</span>
            <span className="min-w-0 flex-1 truncate text-slate-500">{e.description}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 mb-1 text-[10px] font-semibold text-purple-300/80">
        ⚖️ Runes de RÈGLE {!mods.ruleRunes ? <span className="font-normal text-slate-500">— 🔒 nœud « Lois du monde »</span> : mods.loiAmplifiee ? <span className="font-normal text-emerald-400">— ◈ Législateur : amplifiées</span> : null}
      </div>
      <div className={'space-y-0.5 ' + (mods.ruleRunes ? '' : 'opacity-50')}>
        {ruleRunes.map((e) => (
          <div key={e.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
            {ownedBadge(e.id)}
            <span className="shrink-0 font-medium text-slate-200">{e.icon} {e.name}</span>
            <span className="min-w-0 flex-1 truncate text-slate-500">{e.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ⚗️ Alchimiste : quintessences + synthèse d'uniques                  */
/* ------------------------------------------------------------------ */

function AlchimisteWorkshop() {
  const quint = useGame((s) => s.quint)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const totalQuint = DAMAGE_TYPE_LIST.reduce((a, t) => a + (quint[t] ?? 0), 0)
  const essence = useGame((s) => s.essence)
  const poussiere = useGame((s) => s.poussiere)
  const noyau = useGame((s) => s.noyau)
  const convertResource = useGame((s) => s.convertResource)
  const [quintType, setQuintType] = useState<DamageType>('feu')
  const have: Record<string, number> = { essence, poussiere, noyau }

  return (
    <div className="mb-3 rounded-xl border border-emerald-800/40 bg-emerald-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">⚗️ Laboratoire</span>
        <span className="text-[10px] text-slate-500">⚗️ {totalQuint} quintessence{totalQuint > 1 ? 's' : ''}</span>
      </div>
      <p className="mb-2 text-[9.5px] leading-snug text-slate-500">
        Les quintessences s'appliquent depuis la FICHE D'UN OBJET (lignes typées choisies).
        {!mods.quint && ' 🔒 Apprends « Quintessence » ci-dessus pour commencer.'}
      </p>
      {totalQuint > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 rounded bg-black/20 px-2 py-1.5 text-[10px]">
          {DAMAGE_TYPE_LIST.filter((t) => (quint[t] ?? 0) > 0).map((t) => (
            <span key={t} style={{ color: DAMAGE_TYPES[t].color }}>{DAMAGE_TYPES[t].icon} {DAMAGE_TYPES[t].name} ×{quint[t]}</span>
          ))}
        </div>
      )}
      {/* La synthèse d'uniques : 3 crans de précision, de l'aléatoire au choix exact */}
      <div className="mb-1 text-[10px] font-semibold text-emerald-300/80">🧬 Synthèse d'uniques — 3 crans de précision (fiche objet)</div>
      <div className="space-y-0.5 text-[10px]">
        <div className={'flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 ' + (mods.synth1 ? '' : 'opacity-50')}>
          <span className="shrink-0 font-medium text-slate-200">✨ I — Infusion</span>
          <span className="min-w-0 flex-1 truncate text-slate-500">Fragment d'éternité → effet ALÉATOIRE (ou +1 rang).</span>
          {!mods.synth1 && <span className="shrink-0 text-slate-500">🔒</span>}
        </div>
        <div className={'flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 ' + (mods.synth2 ? '' : 'opacity-50')}>
          <span className="shrink-0 font-medium text-slate-200">🧬 II — Essence</span>
          <span className="min-w-0 flex-1 truncate text-slate-500">Essences d'uniques recyclés → l'effet de l'essence (semi-ciblé).</span>
          {!mods.synth2 && <span className="shrink-0 text-slate-500">🔒</span>}
        </div>
        <div className={'flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 ' + (mods.synth3 ? '' : 'opacity-50')}>
          <span className="shrink-0 font-medium text-slate-200">💫 III — Invocation</span>
          <span className="min-w-0 flex-1 truncate text-slate-500">Éclats cosmiques → l'effet de ton CHOIX. L'acte final du craft.</span>
          {!mods.synth3 && <span className="shrink-0 text-slate-500">🔒</span>}
        </div>
      </div>
      {/* ◈ Transmutateur : conversions de ressources (à perte) */}
      <div className="mt-2 mb-1 text-[10px] font-semibold text-emerald-300/80">
        ⚗️ Transmutation de ressources {!mods.transmutateur && <span className="font-normal text-slate-500">— 🔒 spécialisation ◈ Transmutateur</span>}
      </div>
      {mods.transmutateur ? (
        <div className="space-y-1">
          {CONVERSIONS.map((c) => {
            const isQuint = c.to.res === 'quint'
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                <span className="min-w-0 flex-1 truncate text-slate-300">{c.name}</span>
                <span className="shrink-0 text-slate-500">{c.from.amt.toLocaleString('fr-FR')} → {c.to.amt}</span>
                {isQuint && (
                  <select value={quintType} onChange={(e) => setQuintType(e.target.value as DamageType)} className="shrink-0 rounded bg-slate-800 px-1 py-0.5 text-slate-200">
                    {DAMAGE_TYPE_LIST.map((t) => <option key={t} value={t}>{DAMAGE_TYPES[t].icon} {DAMAGE_TYPES[t].name}</option>)}
                  </select>
                )}
                {[1, 10].map((n) => (
                  <button
                    key={n}
                    disabled={(have[c.from.res] ?? 0) < c.from.amt * n}
                    onClick={() => convertResource(c.id, n, isQuint ? quintType : undefined)}
                    className="shrink-0 rounded border border-emerald-700/40 px-1.5 py-1 font-medium text-emerald-200 hover:bg-emerald-900/30 disabled:opacity-40"
                  >
                    ×{n}
                  </button>
                ))}
              </div>
            )
          })}
          <p className="text-[9px] italic text-slate-600">Taux à perte (aller-retour ≈ ÷2) : un robinet d'appoint, jamais l'optimum.</p>
        </div>
      ) : null}
      <p className="mt-2 text-[9px] italic text-slate-600">
        Le recyclage d'objets nourrit l'XP d'Alchimiste — la Distillation le rend plus rentable{mods.distillateur ? ' (◈ Distillateur : +25% et essences ×2)' : ''}.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  )
}
