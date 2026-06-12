import { useState } from 'react'
import type { ReactNode } from 'react'
import { useGame, bestRaidTier, forgeContractsForDay, CONTRACT_LINGOTS } from '../game/store'
import { ITEM_TYPES } from '../game/slots'
import { PRIMARY_META, SECONDARY_META } from '../game/stats'
import { currentWeek } from '../game/maitrise'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RARITIES, RARITY_LIST } from '../game/rarities'
import { maxCraftTier, createCost } from '../game/items'
import {
  METIERS, METIER_LIST, METIER_NODES, METIER_BRANCHES, METIER_MAX_LEVEL, AUTOMATE_FORGERON_LEVELS,
  craftMods, levelFromXp, xpTotalForLevel, pointsAvailable, pointsTotal, canLearnNode, nodeRank,
  respecCost, respecBranchCost, pointsSpentInBranch,
  CORPS, corpsBonusFor, signatureLingotCost, smeltLingots, MASTERWORK_LINGOTS,
  type MetierId,
} from '../game/metiers'
import { ENCHANTS, TIME_RUNES, RULE_RUNES, PACT_RUNES, eraseFragments, runeForgeCost, RUNE_GAMBLE_COST } from '../game/enchants'
import {
  REAGENTS, BREWS, getBrew, parseBrewKey, BREW_QUALITIES, EXPERIMENT_COST,
  DAILY_TRANSMUTE_COST, PHILOSOPHALE_COST,
} from '../game/alchimie'
import {
  COND_GEM_LIST, GEM_FAMILIES, GEM_CUT_COST, GEM_FUSE_COUNT, GEM_FUSE_COST, GEM_CORRUPT_COST, GEM_QUALITIES,
  parseCondKey, gemDesc, gemMaxRank, grindDust, corruptOdds, cutQualityOdds,
  type GemFamily, type CondGemId,
} from '../game/condGems'
import {
  missionLabel, automateRunDuration, automateEfficiency, automateUpgradeCost,
  AUTOMATE_MAX, AUTOMATE_COSTS, AUTOMATE_NAMES, AUTOMATE_UPG_MAX, type AutomateMission,
} from '../game/automates'
import { DUNGEON_LIST } from '../game/dungeons'
import { RAID_LIST } from '../game/raids'
import { stageIlvl } from '../game/enemies'
import { Sheet } from './ui'
import type { ItemType, OffensiveStat, ItemOrientation, DamageType, RarityId, SecondaryStat } from '../game/types'

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

/** Arbre du métier (v0.26) : nœuds groupés PAR BRANCHE, respec ciblé par branche. */
function MetierTree({ metier }: { metier: MetierId }) {
  const metiers = useGame((s) => s.metiers)
  const bestStage = useGame((s) => s.bestStage)
  const gold = useGame((s) => s.gold)
  const learn = useGame((s) => s.learnMetierNode)
  const respecBranch = useGame((s) => s.respecMetierBranch)
  const st = metiers[metier]
  const pts = pointsAvailable(st)
  const [open, setOpen] = useState(pts > 0)
  const def = METIERS[metier]

  // Branches affichées : tronc commun d'abord, puis les branches déclarées qui ont des nœuds.
  const branches: { id: string; name: string; icon: string }[] = [
    { id: 'tronc', name: 'Tronc commun', icon: '🌳' },
    ...METIER_BRANCHES[metier],
  ].filter((b) => METIER_NODES[metier].some((n) => (n.branch ?? 'tronc') === b.id))
  const branchCost = respecBranchCost(st)

  return (
    <div className="mb-3 rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span>🌳 Arbre de compétences {pts > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[9px] text-slate-950">{pts}</span>}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && branches.map((b) => {
        const nodes = METIER_NODES[metier].filter((n) => (n.branch ?? 'tronc') === b.id)
        const spent = pointsSpentInBranch(st, metier, b.id)
        const max = nodes.reduce((a, n) => a + n.maxRank, 0)
        return (
          <div key={b.id} className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: def.color }}>
                {b.icon} {b.name} <span className="font-normal text-slate-500">· {spent}/{max} pt{max > 1 ? 's' : ''}</span>
              </span>
              {spent > 0 && branches.length > 1 && (
                <button
                  disabled={gold < branchCost}
                  onClick={() => respecBranch(metier, b.id)}
                  title={`Réinitialise UNIQUEMENT cette branche — ${branchCost.toLocaleString('fr-FR')} or (40% du respec complet)`}
                  className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                >
                  ↺ {(branchCost / 1000).toLocaleString('fr-FR')}k
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {nodes.map((n) => {
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
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 🔨 Forgeron : création d'objets + automates                         */
/* ------------------------------------------------------------------ */

function ForgeronWorkshop() {
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const fragments = useGame((s) => s.fragments)
  const poussiere = useGame((s) => s.poussiere)
  const cosmic = useGame((s) => s.cosmic)
  const lingots = useGame((s) => s.lingots)
  const mould = useGame((s) => s.mould)
  const lastMasterwork = useGame((s) => s.lastMasterwork)
  const createItem = useGame((s) => s.createItem)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)

  // v0.25 : double horloge — le palier de farm ET le meilleur tier de raid bornent la rareté.
  const raidTier = bestRaidTier(raidProgress)
  const maxTier = maxCraftTier(bestStage, raidTier)
  const raidCapped = maxTier < maxCraftTier(bestStage) // le raid est la borne ACTIVE
  const rarities = RARITY_LIST.filter((r) => r.tier <= maxTier)

  const [type, setType] = useState<ItemType>('armePrincipale')
  const [primary, setPrimary] = useState<OffensiveStat>('force')
  const [orientation, setOrientation] = useState<ItemOrientation>('equilibre')
  const [element, setElement] = useState<DamageType>('feu')
  const [rarity, setRarity] = useState<RarityId>(rarities[Math.min(3, rarities.length - 1)].id)
  const [signature, setSignature] = useState<SecondaryStat | null>(null)
  const [masterwork, setMasterwork] = useState(false)

  const isWeapon = type === 'armePrincipale'
  const tier = RARITY_LIST.find((r) => r.id === rarity)!.tier
  // ◈ Compagnonnage (v0.26) : bonus du corps couvrant le type sélectionné.
  const corps = corpsBonusFor(mods, type)
  const ilvl = stageIlvl(bestStage) + corps.ilvlBonus
  const activeSignature = signature && corps.signatures?.includes(signature) ? signature : null
  const signCost = activeSignature ? signatureLingotCost(tier) : 0
  const mwReady = corps.masterwork && lastMasterwork < currentWeek()
  const mwOn = masterwork && mwReady
  const mouldHit = mods.moules && mould
    && mould.type === type && mould.rarity === rarity && mould.primary === primary
    && mould.orientation === orientation && mould.element === (isWeapon ? element : undefined)
  const raw = createCost(tier, ilvl)
  const cm = mods.costMult * corps.costMult * (mouldHit ? 0.7 : 1) * (mwOn ? 1.5 : 1)
  const cost = { eclats: Math.round(raw.eclats * cm), noyau: Math.round(raw.noyau * cm), fragments: Math.round((raw.fragments ?? 0) * cm), poussiere: Math.round((raw.poussiere ?? 0) * cm), cosmic: Math.round((raw.cosmic ?? 0) * cm) }
  const lingotNeed = signCost + (mwOn ? MASTERWORK_LINGOTS : 0)
  const canForge = essence >= cost.eclats && noyau >= cost.noyau && fragments >= cost.fragments && poussiere >= cost.poussiere && cosmic >= cost.cosmic && lingots >= lingotNeed
  const corpsName = mods.corpsMajeur ? CORPS[mods.corpsMajeur.corps] : null

  return (
    <>
      {/* Automates : la branche Industrialisation du Forgeron */}
      <AutomateWorkshop />

      {/* 📋 Contrats · 🫕 Fonderie · 🔥 Bac de trempe (v0.26) */}
      <ForgeProcedes />

      {/* ◈ Compagnonnage : où en est ton corps de métier */}
      {corpsName && mods.corpsMajeur && (
        <div className="mb-3 rounded-lg border border-amber-700/40 bg-amber-950/10 px-2.5 py-1.5 text-[10px] text-amber-200/90">
          ◈ {corpsName.icon} <b>{corpsName.name}</b> {['I', 'II', 'III', 'IV', 'V'][mods.corpsMajeur.tier - 1]}
          <span className="text-slate-400"> — {corpsName.types.map((t) => ITEM_TYPES[t].name).join(', ')} : −15% coûts
          {mods.corpsMajeur.tier >= 2 && ' · +1 iLvl'}
          {mods.corpsMajeur.tier >= 3 && ' · ✒️ Signature'}
          {mods.corpsMajeur.tier >= 4 && ' · 🎲 +12% rareté'}
          {mods.corpsMajeur.tier >= 5 && ' · 🏆 Chef-d\'œuvre hebdo'}</span>
          {mods.corpsMineur && <span className="text-slate-400"> · mineur : {CORPS[mods.corpsMineur.corps].icon} {CORPS[mods.corpsMineur.corps].name} {['I', 'II'][mods.corpsMineur.tier - 1]}</span>}
        </div>
      )}

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
        {raidCapped && (
          <p className="mt-1 text-[9.5px] leading-snug text-rose-300/80">
            ☠️ Le cran suivant exige un <b>tier de raid ≥ {raidTier + 1}</b> (record : {raidTier}) — la haute rareté se forge au rythme de tes raids.
          </p>
        )}
      </Section>

      {/* ✒️ Signature (Compagnonnage III) : affixe garanti au choix sur les pièces du corps */}
      {corps.signatures && (
        <Section title={`✒️ Signature (${signCost > 0 ? `${signCost} 🧱` : 'choisis une ligne garantie'})`}>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSignature(null)}
              className={'rounded-lg border px-2.5 py-1.5 text-[11px] ' + (!activeSignature ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-400')}
            >
              Sans
            </button>
            {corps.signatures.map((st) => (
              <button
                key={st}
                onClick={() => setSignature(st)}
                className={'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ' + (activeSignature === st ? 'border-amber-400 bg-amber-900/30 text-amber-200' : 'border-slate-700 text-slate-300 hover:border-slate-500')}
              >
                {SECONDARY_META[st].name} <span className="text-slate-500">· {signatureLingotCost(tier)} 🧱</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* 🏆 Chef-d'œuvre hebdomadaire (Compagnonnage V) */}
      {corps.masterwork && (
        <button
          onClick={() => setMasterwork((m2) => !m2)}
          disabled={!mwReady}
          className={
            'mb-3 w-full rounded-lg border py-2 text-[11px] font-semibold ' +
            (mwOn ? 'border-amber-400 bg-amber-500/20 text-amber-200' : mwReady ? 'border-amber-700/50 text-amber-300/80 hover:bg-amber-900/20' : 'border-slate-800 text-slate-600')
          }
        >
          🏆 Chef-d'œuvre {mwReady ? (mwOn ? 'ACTIVÉ — +1 cran garanti + châsse garantie (×1,5 coûts + 10 🧱)' : '— 1/semaine : +1 cran garanti + châsse garantie') : '— déjà forgé cette semaine'}
        </button>
      )}

      {/* Récapitulatif + coût */}
      <div className="mt-3 rounded-lg bg-black/30 p-3 text-xs text-slate-400">
        <div>iLvl de l'objet : <span className="text-slate-200">{ilvl}</span> (lié à ton record de palier{corps.ilvlBonus > 0 ? ` · ◈ +${corps.ilvlBonus}` : ''})</div>
        {mouldHit && <div className="mt-0.5 text-[10.5px] text-emerald-300/80">🧩 Moule actif : ce craft est identique au précédent — coûts −30%.</div>}
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
          {lingotNeed > 0 && (
            <span className={lingots >= lingotNeed ? 'text-amber-300' : 'text-red-400'}>🧱 {lingotNeed}</span>
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
        onClick={() => createItem({
          type, primary, rarity, orientation,
          ...(isWeapon ? { element } : {}),
          ...(activeSignature ? { signature: activeSignature } : {}),
          ...(mwOn ? { masterwork: true } : {}),
        })}
        className="mt-3 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-40"
      >
        {mwOn ? '🏆 Forger le CHEF-D\'ŒUVRE — ' : 'Forger '}{isWeapon ? `${DAMAGE_TYPES[element].icon} ` : ''}{ITEM_TYPES[type].name}
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

        {nextCost && mods.automates && (automates.length < 3 || mods.automate4) && (
          forgeronLvl < lvlReq ? (
            <div className="rounded-lg border border-slate-800 bg-black/20 py-2 text-center text-[10px] text-slate-500">
              🔒 Prochain automate « {AUTOMATE_NAMES[automates.length]} » : Forgeron niveau {lvlReq} requis (actuel : {forgeronLvl}).
            </div>
          ) : (
            <button
              onClick={buildAutomate}
              disabled={gold < nextCost.gold || poussiere < nextCost.poussiere || fragments < nextCost.fragments || cosmic < nextCost.cosmic}
              className="w-full rounded-lg border border-violet-700/50 bg-violet-900/20 py-2 text-[11px] font-medium text-violet-200 hover:bg-violet-800/30 disabled:opacity-40"
            >
              🛠 Construire « {AUTOMATE_NAMES[automates.length]} » · 💰 {nextCost.gold.toLocaleString('fr-FR')} + 🌌 {nextCost.poussiere}
              {' '}+ ✨ {nextCost.fragments}{nextCost.cosmic ? ` + 💫 ${nextCost.cosmic}` : ''}
            </button>
          )
        )}
        {nextCost && mods.automates && automates.length >= 3 && !mods.automate4 && (
          <div className="rounded-lg border border-slate-800 bg-black/20 py-2 text-center text-[10px] text-slate-500">
            🔒 La 4e machine « Manufacture » exige le nœud 🏭 de l'arbre (niv 40 · P80).
          </div>
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

/**
 * v0.26 — Procédés du Forgeron : 📋 Contrats quotidiens (forge la pièce demandée → Lingots 🧱),
 * 🫕 Fonderie (objet Rare+ du sac → Lingots) et 🔥 Bac de trempe (+1 iLvl par 24 h réelles).
 */
function ForgeProcedes() {
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const lingots = useGame((s) => s.lingots)
  const inventory = useGame((s) => s.inventory)
  const forgeContracts = useGame((s) => s.forgeContracts)
  const trempe = useGame((s) => s.trempe)
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const smeltItem = useGame((s) => s.smeltItem)
  const startTempering = useGame((s) => s.startTempering)
  const collectTempering = useGame((s) => s.collectTempering)
  const [fonderieOpen, setFonderieOpen] = useState(false)
  const [trempeOpen, setTrempeOpen] = useState(false)

  if (!mods.contrats && !mods.fonderie && !mods.trempeLente) return null

  const today = Math.floor(Date.now() / 86_400_000)
  const craftCap = maxCraftTier(bestStage, bestRaidTier(raidProgress))
  const defs = forgeContractsForDay(today, craftCap)
  const done = forgeContracts && forgeContracts.day === today ? forgeContracts.done : [false, false, false]
  const smeltable = inventory.filter((i) => RARITIES[i.rarity].tier >= 4).slice(0, 8)
  const trempables = inventory.filter((i) => (i.trempeCount ?? 0) < 5).slice(0, 8)
  const trempeItem = trempe ? inventory.find((i) => i.id === trempe.itemId) : undefined
  const trempeDays = trempe ? Math.floor((Date.now() - trempe.startedAt) / 86_400_000) : 0
  const trempeNextH = trempe ? Math.ceil((86_400_000 - ((Date.now() - trempe.startedAt) % 86_400_000)) / 3_600_000) : 0

  return (
    <div className="mb-3 rounded-xl border border-orange-800/40 bg-orange-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-300">⚒️ Procédés du Forgeron</span>
        <span className="text-[10px] text-amber-300">🧱 {lingots} lingot{lingots > 1 ? 's' : ''}</span>
      </div>

      {/* 📋 Contrats quotidiens */}
      {mods.contrats && (
        <div className="mb-2">
          <div className="mb-1 text-[10px] font-semibold text-orange-200/90">📋 Commandes du jour <span className="font-normal text-slate-500">— forge la pièce EXACTE (type + affinité + rareté ≥ exigée)</span></div>
          <div className="space-y-0.5">
            {defs.map((d, i) => {
              const r = RARITY_LIST.find((x) => x.tier === d.minTier)
              return (
                <div key={i} className={'flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] ' + (done[i] ? 'bg-emerald-950/30 text-emerald-300' : 'bg-black/20 text-slate-300')}>
                  <span className="shrink-0">{done[i] ? '✅' : '⬜'}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {ITEM_TYPES[d.type].icon} {ITEM_TYPES[d.type].name} · {PRIMARY_META[d.primary].name} · <span style={{ color: r?.color }}>{r?.name}+</span>
                  </span>
                  <span className="shrink-0 text-amber-300/80">+{CONTRACT_LINGOTS + mods.negociant} 🧱</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 🫕 Fonderie */}
      {mods.fonderie && (
        <div className="mb-2">
          <button onClick={() => setFonderieOpen((o) => !o)} className="flex w-full items-center justify-between text-[10px] font-semibold text-orange-200/90">
            <span>🫕 Fonderie <span className="font-normal text-slate-500">— fond un objet Rare+ du sac en Lingots</span></span>
            <span>{fonderieOpen ? '▾' : '▸'}</span>
          </button>
          {fonderieOpen && (
            <div className="mt-1 space-y-0.5">
              {smeltable.length === 0 && <div className="text-[9.5px] italic text-slate-500">Rien à fondre (Rare+ uniquement).</div>}
              {smeltable.map((it) => (
                <div key={it.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                  <span className="min-w-0 flex-1 truncate" style={{ color: RARITIES[it.rarity].color }}>{it.name} <span className="text-slate-500">iLvl {it.ilvl}</span></span>
                  <button
                    onClick={() => smeltItem(it.id)}
                    className="shrink-0 rounded bg-orange-900/40 px-1.5 py-1 font-medium text-orange-200 hover:bg-orange-800/50"
                  >
                    🫕 +{Math.max(1, Math.round(smeltLingots(RARITIES[it.rarity].tier) * mods.lingotierMult))} 🧱
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🔥 Bac de trempe */}
      {mods.trempeLente && (
        <div>
          <button onClick={() => setTrempeOpen((o) => !o)} className="flex w-full items-center justify-between text-[10px] font-semibold text-orange-200/90">
            <span>🔥 Bac de trempe <span className="font-normal text-slate-500">— +1 iLvl par 24 h réelles (5 max/objet)</span></span>
            <span>{trempeOpen ? '▾' : '▸'}</span>
          </button>
          {trempeOpen && (
            trempe ? (
              <div className="mt-1 rounded bg-black/20 px-1.5 py-1.5 text-[10px]">
                <div className="text-slate-300">
                  🔥 {trempeItem ? trempeItem.name : 'Objet introuvable (vendu ?)'} — {trempeDays} iLvl mûri{trempeDays > 1 ? 's' : ''}
                  {trempeDays === 0 && ` · prochain dans ~${trempeNextH} h`}
                </div>
                <button onClick={() => collectTempering()} className="mt-1 w-full rounded bg-orange-700/60 py-1 font-medium text-orange-100 hover:bg-orange-600/60">
                  Récupérer {trempeDays > 0 ? `(+${trempeDays} iLvl)` : '(sans gain)'}
                </button>
              </div>
            ) : (
              <div className="mt-1 space-y-0.5">
                {trempables.length === 0 && <div className="text-[9.5px] italic text-slate-500">Aucun objet du sac à tremper.</div>}
                {trempables.map((it) => (
                  <div key={it.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                    <span className="min-w-0 flex-1 truncate" style={{ color: RARITIES[it.rarity].color }}>{it.name} <span className="text-slate-500">iLvl {it.ilvl} · {5 - (it.trempeCount ?? 0)} restant{5 - (it.trempeCount ?? 0) > 1 ? 's' : ''}</span></span>
                    <button onClick={() => startTempering(it.id)} className="shrink-0 rounded bg-orange-900/40 px-1.5 py-1 font-medium text-orange-200 hover:bg-orange-800/50">
                      🔥 Tremper
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
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
  const lastStoneTrade = useGame((s) => s.lastStoneTrade)
  const grindGem = useGame((s) => s.grindGem)
  const cutGem = useGame((s) => s.cutGem)
  const fuseGems = useGame((s) => s.fuseGems)
  const corruptGem = useGame((s) => s.corruptGem)
  const tradeGems = useGame((s) => s.tradeGems)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const [cutOpen, setCutOpen] = useState(false)
  const [cutFamily, setCutFamily] = useState<GemFamily | 'all'>('all')
  const [tradeSel, setTradeSel] = useState<string[]>([])
  const [tradeOpen, setTradeOpen] = useState(false)

  // Stock : entrées `cond:id[:rang[:qualité]]` décodées, groupées par famille.
  const stock = Object.entries(gems)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ key: k, parsed: parseCondKey(k), n }))
    .filter((x): x is { key: string; parsed: NonNullable<ReturnType<typeof parseCondKey>>; n: number } => !!x.parsed)
    .sort((a, b) => a.parsed.def.family.localeCompare(b.parsed.def.family) || a.parsed.def.name.localeCompare(b.parsed.def.name) || a.parsed.rank - b.parsed.rank)
  const total = stock.reduce((a, x) => a + x.n, 0)
  const cutList = COND_GEM_LIST.filter((g) => cutFamily === 'all' || g.family === cutFamily)
  const cutCost = Math.round(GEM_CUT_COST * mods.tailleCostMult)
  const fuseCost = Math.round(GEM_FUSE_COST * mods.fuseCostMult)
  const corruptCost = Math.round(GEM_CORRUPT_COST * (mods.corruptSafe ? 2 : 1))
  const [cOdds] = corruptOdds(mods.pacteLapidaire)
  const [qE, , qP] = cutQualityOdds(mods.mainSure)
  const today = Math.floor(Date.now() / 86_400_000)
  const tradeDone = lastStoneTrade >= today
  const qMark = (q: 0 | 1 | 2) => (q !== 1 ? <span style={{ color: GEM_QUALITIES[q].color }}> {GEM_QUALITIES[q].mark}</span> : null)

  return (
    <div className="mb-3 rounded-xl border border-sky-800/40 bg-sky-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">💎 Taillerie</span>
        <span className="text-[10px] text-slate-400">🔹 {gemDust.toLocaleString('fr-FR')} poussière · {total} gemme{total > 1 ? 's' : ''}</span>
      </div>
      <p className="mb-1.5 text-[9.5px] leading-snug text-slate-500">
        Les gemmes de CONDITION programment le combat — 4 familles : 🥁 Rythme, 🌊 Flux, 🌍 Environnement,
        🛡️ Bastion (biome Physique). Drop par famille selon le biome (rare — la taille/fusion compensent) ;
        sertis-les via la fiche d'un objet. Qualité : ▾ Éclatée · Polie · ▴ Parfaite (roulée à la taille).
        {!mods.gems && ' 🔒 Sertissage : apprends le nœud ci-dessus.'}
      </p>

      {/* Stock */}
      {total === 0 ? (
        <div className="text-[10px] italic text-slate-500">
          Aucune gemme — drops de biome (rare), champions ✦ (8%), raids… ou la TAILLE ci-dessous.
        </div>
      ) : (
        <div className="space-y-1">
          {stock.map(({ key, parsed, n }) => {
            const fam = GEM_FAMILIES[parsed.def.family]
            const dust = Math.round(grindDust(parsed.rank, parsed.quality) * mods.grindMult)
            const canFuse = mods.fusion && n >= GEM_FUSE_COUNT && parsed.rank < gemMaxRank(parsed.def)
            const canCorrupt = mods.corruption && parsed.rank < gemMaxRank(parsed.def)
            const selCount = tradeSel.filter((k) => k === key).length
            return (
              <div key={key} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                <span className="shrink-0 font-medium" style={{ color: parsed.def.color }} title={fam.name}>
                  {fam.icon} {parsed.def.icon} {parsed.def.name}{parsed.rank > 1 ? ` R${parsed.rank}` : ''}{qMark(parsed.quality)} ×{n}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-500">{gemDesc(parsed.def, parsed.rank, parsed.quality)}</span>
                {tradeOpen && (
                  <button
                    onClick={() => {
                      if (selCount < n && tradeSel.length < 3) setTradeSel([...tradeSel, key])
                      else setTradeSel(tradeSel.filter((k, i) => !(k === key && i === tradeSel.indexOf(key))))
                    }}
                    className={'shrink-0 rounded px-1.5 py-1 ' + (selCount > 0 ? 'bg-amber-600 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-amber-200')}
                  >
                    {selCount > 0 ? `✓×${selCount}` : '⚖️'}
                  </button>
                )}
                {canFuse && (
                  <button
                    onClick={() => fuseGems(key)}
                    disabled={gemDust < fuseCost}
                    title={`Fusion : 3 exemplaires → 1 au rang ${parsed.rank + 1} (-${fuseCost} 🔹)`}
                    className="shrink-0 rounded bg-orange-900/40 px-1.5 py-1 font-medium text-orange-200 hover:bg-orange-800/50 disabled:opacity-40"
                  >
                    🔥 3→R{parsed.rank + 1}
                  </button>
                )}
                {canCorrupt && (
                  <button
                    onClick={() => corruptGem(key)}
                    disabled={gemDust < corruptCost}
                    title={`Corruption (-${corruptCost} 🔹) : ${Math.round(cOdds * 100)}% rang +1 · ${mods.corruptSafe ? 'échec = rien (Stabilisation)' : `${Math.round(corruptOdds(mods.pacteLapidaire)[2] * 100)}% broyée`}`}
                    className="shrink-0 rounded bg-fuchsia-900/40 px-1.5 py-1 font-medium text-fuchsia-200 hover:bg-fuchsia-800/50 disabled:opacity-40"
                  >
                    🫦 {Math.round(cOdds * 100)}%
                  </button>
                )}
                {mods.broyage && (
                  <button
                    onClick={() => grindGem(key)}
                    title={`Broyer → +${dust} 🔹`}
                    className="shrink-0 rounded bg-slate-800 px-1.5 py-1 text-slate-400 hover:text-sky-200"
                  >
                    ⚒️ +{dust}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ⚖️ Marché aux pierres : 1/jour, 3 gemmes → 1 au choix (rang = min). */}
      {mods.marcheAuxPierres && total > 0 && (
        <div className="mt-2 rounded border border-amber-800/40 bg-amber-950/10 p-1.5">
          <button onClick={() => { setTradeOpen((o) => !o); setTradeSel([]) }} className="flex w-full items-center justify-between text-[10.5px] font-semibold text-amber-200">
            <span>⚖️ Marché aux pierres — 3 gemmes → 1 au CHOIX {tradeDone && <span className="font-normal text-slate-500">(déjà utilisé aujourd'hui)</span>}</span>
            <span>{tradeOpen ? '▾' : '▸'}</span>
          </button>
          {tradeOpen && !tradeDone && (
            <>
              <p className="mt-1 text-[9px] text-slate-500">Coche 3 gemmes dans le stock ci-dessus ({tradeSel.length}/3), puis choisis la gemme reçue (rang = min des 3).</p>
              {tradeSel.length === 3 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {COND_GEM_LIST.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => { tradeGems(tradeSel, g.id as CondGemId); setTradeSel([]); setTradeOpen(false) }}
                      title={gemDesc(g, 1)}
                      className="rounded border px-1.5 py-1 text-[9.5px] hover:bg-white/5"
                      style={{ color: g.color, borderColor: g.color + '55' }}
                    >
                      {g.icon} {g.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Taille : façonner la gemme de son choix (déblocage par l'arbre) */}
      {mods.taille ? (
        <div className="mt-2">
          <button onClick={() => setCutOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[11px] font-semibold text-sky-200">
            <span>✂️ Tailler une gemme au choix · {cutCost} 🔹 <span className="font-normal text-slate-500">(▴ Parfaite {Math.round(qP * 100)}% · ▾ Éclatée {Math.round(qE * 100)}%)</span></span>
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
                    disabled={gemDust < cutCost}
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
  const runeFragments = useGame((s) => s.runeFragments)
  const runeCrafted = useGame((s) => s.runeCrafted)
  const poussiere = useGame((s) => s.poussiere)
  const gold = useGame((s) => s.gold)
  const cosmic = useGame((s) => s.cosmic)
  const eraseRune = useGame((s) => s.eraseRune)
  const forgeRune = useGame((s) => s.forgeRune)
  const gambleRune = useGame((s) => s.gambleRune)
  const mods = craftMods(metiers)
  const [forgeOpen, setForgeOpen] = useState(false)

  const runeRow = (e: (typeof ENCHANTS)[number]) => {
    const n = runesOwned[e.id] ?? 0
    const cost = runeForgeCost(e, runeCrafted[e.id] ?? 0)
    const canForge = mods.forgeRunique && runeFragments >= cost.fragments && poussiere >= cost.poussiere && gold >= cost.gold && cosmic >= cost.cosmic
    return (
      <div key={e.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
        <span className={'shrink-0 rounded px-1 text-[9px] font-semibold ' + (n > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-600')}>×{n}</span>
        <span className="shrink-0 font-medium text-slate-200">{e.icon} {e.name}</span>
        <span className="min-w-0 flex-1 truncate text-slate-500" title={e.description}>{e.description}</span>
        {mods.effacement && n > 0 && (
          <button
            onClick={() => eraseRune(e.id)}
            title={`Effacer → +${eraseFragments(e)} 🜁`}
            className="shrink-0 rounded bg-slate-800 px-1.5 py-1 text-slate-400 hover:text-purple-200"
          >
            🧽 +{eraseFragments(e)} 🜁
          </button>
        )}
        {forgeOpen && mods.forgeRunique && (
          <button
            onClick={() => forgeRune(e.id)}
            disabled={!canForge}
            title={`Forger : ${cost.fragments} 🜁 + ${cost.poussiere} 🌌 + ${(cost.gold / 1e6).toLocaleString('fr-FR')}M or${cost.cosmic ? ` + ${cost.cosmic} 💫` : ''}`}
            className="shrink-0 rounded bg-purple-900/40 px-1.5 py-1 font-medium text-purple-200 hover:bg-purple-800/50 disabled:opacity-40"
          >
            🔨 {cost.fragments} 🜁
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mb-3 rounded-xl border border-purple-800/40 bg-purple-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-purple-300">🪄 Atelier runique</span>
        <span className="text-[10px] text-purple-200">🜁 {runeFragments} fragment{runeFragments > 1 ? 's' : ''}</span>
      </div>
      <p className="mb-2 text-[9.5px] leading-snug text-slate-500">
        Les runes TOMBENT (☠️ raids surtout) ; graver consomme l'exemplaire. v0.26 : 🧽 EFFACER une rune
        rend des Fragments 🜁 · 🔨 FORGER la rune de ton CHOIX (coût ×1,5 par exemplaire) · les 🩸 PACTES
        ne tombent jamais — forgés uniquement, un seul actif{mods.doublePacte ? ' (⛓️ deux, malus ×1,5)' : ''}.
        {!mods.enchant && ' 🔒 Apprends « Gravure » ci-dessus pour commencer.'}
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {mods.forgeRunique && (
          <button onClick={() => setForgeOpen((o) => !o)} className={'rounded px-2 py-1 text-[10px] font-medium ' + (forgeOpen ? 'bg-purple-600 text-slate-50' : 'bg-slate-800 text-slate-300')}>
            🔨 Forge runique {forgeOpen ? 'ON' : ''}
          </button>
        )}
        {mods.surchargeRunique && (
          <button
            onClick={() => gambleRune()}
            disabled={runeFragments < RUNE_GAMBLE_COST}
            className="rounded bg-fuchsia-900/40 px-2 py-1 text-[10px] font-medium text-fuchsia-200 hover:bg-fuchsia-800/50 disabled:opacity-40"
          >
            🎲 Surcharge · {RUNE_GAMBLE_COST} 🜁 → rune aléatoire
          </button>
        )}
      </div>
      <div className="mb-1 text-[10px] font-semibold text-purple-300/80">
        ⏳ Runes de TEMPS {mods.runisteTempo > 1 && <span className="font-normal text-emerald-400">— efficacité ×{mods.runisteTempo.toFixed(2)}</span>}
      </div>
      <div className="space-y-0.5">{TIME_RUNES.map(runeRow)}</div>
      <div className="mt-2 mb-1 text-[10px] font-semibold text-purple-300/80">
        ⚖️ Runes de RÈGLE {!mods.ruleRunes ? <span className="font-normal text-slate-500">— 🔒 nœud « Lois du monde »</span> : mods.ruleAmpTier >= 3 ? <span className="font-normal text-emerald-400">— ◈ Législateur {['', 'I', 'II', 'III', 'IV', 'V'][mods.ruleAmpTier]} : amplifiées</span> : null}
      </div>
      <div className={'space-y-0.5 ' + (mods.ruleRunes ? '' : 'opacity-50')}>{RULE_RUNES.map(runeRow)}</div>
      <div className="mt-2 mb-1 text-[10px] font-semibold text-rose-300/90">
        🩸 PACTES {!mods.pactes ? <span className="font-normal text-slate-500">— 🔒 nœud « Sang d'encre » (niv 12 · P60)</span> : <span className="font-normal text-slate-400">— un seul actif{mods.pactMalusMult < 1 ? ` · ◈ Pactiste : malus −${Math.round((1 - mods.pactMalusMult) * 100)}%` : ''}</span>}
      </div>
      <div className={'space-y-0.5 ' + (mods.pactes ? '' : 'opacity-50')}>{PACT_RUNES.map(runeRow)}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ⚗️ Alchimiste : quintessences + synthèse d'uniques                  */
/* ------------------------------------------------------------------ */

function AlchimisteWorkshop() {
  const quint = useGame((s) => s.quint)
  const reagents = useGame((s) => s.reagents)
  const brews = useGame((s) => s.brews)
  const alchemyRecipes = useGame((s) => s.alchemyRecipes)
  const cuvesEnCours = useGame((s) => s.cuvesEnCours)
  const elixirActive = useGame((s) => s.elixirActive)
  const oilActive = useGame((s) => s.oilActive)
  const antidoteActive = useGame((s) => s.antidoteActive)
  const mutagenActive = useGame((s) => s.mutagenActive)
  const armedRaidShield = useGame((s) => s.armedRaidShield)
  const armedChestBonus = useGame((s) => s.armedChestBonus)
  const armedXpBonus = useGame((s) => s.armedXpBonus)
  const lastTransmute = useGame((s) => s.lastTransmute)
  const philosophale = useGame((s) => s.philosophale)
  const poussiere = useGame((s) => s.poussiere)
  const experiment = useGame((s) => s.experiment)
  const brewStart = useGame((s) => s.brewStart)
  const brewCollect = useGame((s) => s.brewCollect)
  const drinkElixir = useGame((s) => s.drinkElixir)
  const armPotion = useGame((s) => s.armPotion)
  const useOil = useGame((s) => s.useOil)
  const useAntidote = useGame((s) => s.useAntidote)
  const drinkMutagen = useGame((s) => s.drinkMutagen)
  const dailyTransmute = useGame((s) => s.dailyTransmute)
  const craftPhilosophale = useGame((s) => s.craftPhilosophale)
  const metiers = useGame((s) => s.metiers)
  const mods = craftMods(metiers)
  const [expA, setExpA] = useState<DamageType>('feu')
  const [expB, setExpB] = useState<DamageType>('foudre')
  const [typed, setTyped] = useState<DamageType>('feu')
  const [transFrom, setTransFrom] = useState<DamageType>('feu')
  const [transTo, setTransTo] = useState<DamageType>('froid')
  const now = Date.now()
  const totalQuint = DAMAGE_TYPE_LIST.reduce((a, t) => a + (quint[t] ?? 0), 0)
  const today = Math.floor(now / 86_400_000)
  const remainingMin = (until: number) => Math.max(0, Math.round((until - now) / 60_000))

  // Stock des brassins, décodé.
  const brewStock = Object.entries(brews)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ key: k, parsed: parseBrewKey(k), n }))
    .filter((x): x is { key: string; parsed: NonNullable<ReturnType<typeof parseBrewKey>>; n: number } => !!x.parsed)

  const activeLine = (label: string, until: number) => (
    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] text-emerald-300">{label} · {remainingMin(until)} min</span>
  )

  return (
    <div className="mb-3 rounded-xl border border-emerald-800/40 bg-emerald-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">⚗️ Laboratoire {philosophale && <span title="Pierre philosophale">🜍</span>}</span>
        <span className="text-[10px] text-slate-500">⚗️ {totalQuint} quint. · {alchemyRecipes.length}/{BREWS.length} recettes</span>
      </div>

      {/* Buffs actifs & potions armées */}
      {(elixirActive && elixirActive.until > now) || (oilActive && oilActive.until > now) || (antidoteActive && antidoteActive.until > now) || (mutagenActive && mutagenActive.until > now) || armedRaidShield || armedChestBonus || armedXpBonus ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {elixirActive && elixirActive.until > now && activeLine(`🧪 ${getBrew(elixirActive.id)?.name ?? 'Élixir'}`, elixirActive.until)}
          {oilActive && oilActive.until > now && activeLine(`🛢️ Huile ${DAMAGE_TYPES[oilActive.type].name}`, oilActive.until)}
          {antidoteActive && antidoteActive.until > now && activeLine(`🧴 Antidote ${DAMAGE_TYPES[antidoteActive.type].name}`, antidoteActive.until)}
          {mutagenActive && mutagenActive.until > now && activeLine(`☣️ Mutagène ${mutagenActive.mult >= 1 ? '+' : ''}${Math.round((mutagenActive.mult - 1) * 100)}%`, mutagenActive.until)}
          {armedRaidShield && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9.5px] text-sky-300">🛡️ Garde armée (prochain raid)</span>}
          {armedChestBonus && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] text-amber-300">💰 Pillard armé (prochain donjon)</span>}
          {armedXpBonus && <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9.5px] text-violet-300">📚 Érudit armé (prochain donjon)</span>}
        </div>
      ) : null}

      {/* 🌿 Réactifs */}
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 rounded bg-black/20 px-2 py-1.5 text-[10px]">
        {DAMAGE_TYPE_LIST.map((t) => (
          <span key={t} title={REAGENTS[t].name} style={{ color: DAMAGE_TYPES[t].color }}>{REAGENTS[t].icon} ×{reagents[t] ?? 0}</span>
        ))}
        <span className="text-slate-600">— réactifs de biome (drop en farm{mods.herboristeMult > 1 ? `, 🌿 ×${mods.herboristeMult.toFixed(2)}` : ''})</span>
      </div>

      {!mods.officine ? (
        <p className="mb-2 text-[9.5px] italic text-slate-500">🔒 Apprends « 🫖 Officine » dans l'arbre : cuves de brassage, expérimentation, élixirs & potions.</p>
      ) : (
        <>
          {/* 🫙 Cuves */}
          <div className="mb-1 text-[10px] font-semibold text-emerald-300/80">🫙 Cuves ({cuvesEnCours.length}/{mods.cuves}) <span className="font-normal text-slate-500">— récolte dans la fenêtre PARFAITE (entre ×1,3 et ×1,6 du temps) pour le ▴</span></div>
          <div className="mb-2 space-y-0.5">
            {cuvesEnCours.map((cu, i) => {
              const def = getBrew(cu.recipeId)
              if (!def) return null
              const elapsed = (now - cu.startedAt) / 60_000
              const need = def.brewMin * mods.brewTimeMult
              const state = elapsed < need ? `mûrit… ${Math.round(elapsed)}/${Math.round(need)} min` : elapsed <= need * 1.6 ? (elapsed >= need * 1.3 ? '▴ FENÊTRE PARFAITE !' : 'à point (Pur)') : 'éventé (Pur)'
              return (
                <div key={i} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                  <span className="shrink-0 font-medium text-slate-200">{def.icon} {def.name}</span>
                  <span className={'min-w-0 flex-1 truncate ' + (state.includes('PARFAITE') ? 'font-semibold text-emerald-300' : 'text-slate-500')}>{state}</span>
                  <button onClick={() => brewCollect(i)} className="shrink-0 rounded bg-emerald-900/40 px-1.5 py-1 font-medium text-emerald-200 hover:bg-emerald-800/50">Récolter</button>
                </div>
              )
            })}
            {cuvesEnCours.length < mods.cuves && alchemyRecipes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {alchemyRecipes.map((rid) => {
                  const def = getBrew(rid)
                  if (!def) return null
                  const [a, b] = def.recipe
                  const ok = (reagents[a] ?? 0) >= def.cost && (reagents[b] ?? 0) >= (a === b ? def.cost * 2 : def.cost)
                  return (
                    <button
                      key={rid}
                      disabled={!ok}
                      onClick={() => brewStart(rid)}
                      title={`${def.desc}\nCoût : ${def.cost} ${REAGENTS[a].icon} + ${def.cost} ${REAGENTS[b].icon} · ~${Math.round(def.brewMin * mods.brewTimeMult)} min`}
                      className="rounded border border-emerald-800/50 px-1.5 py-1 text-[9.5px] text-emerald-200 hover:bg-emerald-900/30 disabled:opacity-40"
                    >
                      {def.icon} {def.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 🧪 Expérimentation */}
          <div className="mb-1 text-[10px] font-semibold text-emerald-300/80">🧪 Expérimentation <span className="font-normal text-slate-500">— combine 2 réactifs ({EXPERIMENT_COST} de chaque) pour DÉCOUVRIR une recette</span></div>
          <div className="mb-2 flex flex-wrap items-center gap-1">
            {DAMAGE_TYPE_LIST.map((t) => (
              <button key={'a' + t} onClick={() => setExpA(t)} className={'rounded px-1.5 py-1 text-[10px] ' + (expA === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-400')} title={REAGENTS[t].name}>{REAGENTS[t].icon}</button>
            ))}
            <span className="text-slate-500">+</span>
            {DAMAGE_TYPE_LIST.map((t) => (
              <button key={'b' + t} onClick={() => setExpB(t)} className={'rounded px-1.5 py-1 text-[10px] ' + (expB === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-400')} title={REAGENTS[t].name}>{REAGENTS[t].icon}</button>
            ))}
            <button
              onClick={() => experiment(expA, expB)}
              disabled={(reagents[expA] ?? 0) < EXPERIMENT_COST || (reagents[expB] ?? 0) < (expA === expB ? EXPERIMENT_COST * 2 : EXPERIMENT_COST)}
              className="rounded bg-emerald-700/60 px-2 py-1 text-[10px] font-medium text-emerald-100 hover:bg-emerald-600/60 disabled:opacity-40"
            >
              ⚗️ Tenter
            </button>
          </div>

          {/* Stock de brassins */}
          {brewStock.length > 0 && (
            <>
              <div className="mb-1 text-[10px] font-semibold text-emerald-300/80">🍶 Brassins en réserve</div>
              <div className="mb-2 space-y-0.5">
                {brewStock.map(({ key, parsed, n }) => {
                  const q = BREW_QUALITIES[parsed.quality]
                  const needsType = parsed.def.kind === 'huile' || parsed.def.kind === 'antidote'
                  return (
                    <div key={key} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                      <span className="shrink-0 font-medium" style={{ color: q.color }}>{parsed.def.icon} {parsed.def.name} {q.mark} ×{n}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-500">{parsed.def.desc}</span>
                      {needsType && DAMAGE_TYPE_LIST.map((t) => (
                        <button key={t} onClick={() => setTyped(t)} className={'shrink-0 rounded px-1 py-0.5 text-[9px] ' + (typed === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-500')}>{DAMAGE_TYPES[t].icon}</button>
                      ))}
                      <button
                        onClick={() => {
                          if (parsed.def.kind === 'elixir') drinkElixir(key)
                          else if (parsed.def.kind === 'potion') armPotion(key)
                          else if (parsed.def.kind === 'huile') useOil(key, typed)
                          else if (parsed.def.kind === 'antidote') useAntidote(key, typed)
                          else drinkMutagen(key)
                        }}
                        className="shrink-0 rounded bg-emerald-900/40 px-1.5 py-1 font-medium text-emerald-200 hover:bg-emerald-800/50"
                      >
                        {parsed.def.kind === 'potion' ? 'Armer' : parsed.def.kind === 'huile' ? 'Appliquer' : 'Boire'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* 🌗 Transmutation du jour */}
          {mods.transmutJour && (
            <div className="mb-2 flex flex-wrap items-center gap-1 rounded border border-emerald-900/40 bg-black/20 px-1.5 py-1 text-[10px]">
              <span className="font-semibold text-emerald-300/80">🌗 Transmutation du jour</span>
              {lastTransmute >= today ? (
                <span className="text-slate-500">— déjà utilisée aujourd'hui</span>
              ) : (
                <>
                  {DAMAGE_TYPE_LIST.map((t) => (
                    <button key={'f' + t} onClick={() => setTransFrom(t)} className={'rounded px-1 py-0.5 ' + (transFrom === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-500')}>{DAMAGE_TYPES[t].icon}</button>
                  ))}
                  <span className="text-slate-500">→</span>
                  {DAMAGE_TYPE_LIST.map((t) => (
                    <button key={'t' + t} onClick={() => setTransTo(t)} className={'rounded px-1 py-0.5 ' + (transTo === t ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-500')}>{DAMAGE_TYPES[t].icon}</button>
                  ))}
                  <button
                    onClick={() => dailyTransmute(transFrom, transTo)}
                    disabled={(quint[transFrom] ?? 0) < DAILY_TRANSMUTE_COST || transFrom === transTo}
                    className="rounded bg-emerald-700/60 px-1.5 py-0.5 font-medium text-emerald-100 disabled:opacity-40"
                  >
                    4 → 1
                  </button>
                </>
              )}
            </div>
          )}

          {/* 🜍 Pierre philosophale */}
          {mods.philosophaleUnlock && !philosophale && (
            <button
              onClick={() => craftPhilosophale()}
              disabled={DAMAGE_TYPE_LIST.some((t) => (reagents[t] ?? 0) < PHILOSOPHALE_COST.reagentsEach) || poussiere < PHILOSOPHALE_COST.poussiere || !brewStock.some((b) => b.parsed.quality === 3)}
              title={`${PHILOSOPHALE_COST.reagentsEach} de CHAQUE réactif + ${PHILOSOPHALE_COST.poussiere} 🌌 + 1 brassin MILLÉSIME ★`}
              className="mb-2 w-full rounded-lg border border-amber-600/50 bg-amber-900/20 py-2 text-[11px] font-semibold text-amber-200 hover:bg-amber-800/30 disabled:opacity-40"
            >
              🜍 Accomplir le Grand Œuvre — la Pierre philosophale
            </button>
          )}
        </>
      )}

      {/* Quintessences + synthèses (inchangé) */}
      {totalQuint > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 rounded bg-black/20 px-2 py-1.5 text-[10px]">
          {DAMAGE_TYPE_LIST.filter((t) => (quint[t] ?? 0) > 0).map((t) => (
            <span key={t} style={{ color: DAMAGE_TYPES[t].color }}>{DAMAGE_TYPES[t].icon} {DAMAGE_TYPES[t].name} ×{quint[t]}</span>
          ))}
        </div>
      )}
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
      {mods.quintCostMult < 1 && (
        <p className="mt-2 rounded bg-emerald-500/10 px-1.5 py-1 text-[9.5px] text-emerald-300">
          ◈ Catalyseur/Rendement : Quintessences <b>−{Math.round((1 - mods.quintCostMult) * 100)}%</b>{mods.quintRefundFull ? <> · recyclage rembourse <b>100%</b></> : null}.
        </p>
      )}
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
