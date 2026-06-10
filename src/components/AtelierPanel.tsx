import { useState } from 'react'
import type { ReactNode } from 'react'
import { useGame } from '../game/store'
import { ITEM_TYPES } from '../game/slots'
import { PRIMARY_META } from '../game/stats'
import { DAMAGE_TYPES, DAMAGE_TYPE_LIST } from '../game/damage'
import { RARITY_LIST } from '../game/rarities'
import { maxCraftTier, createCost } from '../game/items'
import { FORGE_UPGRADES, forgeMods, forgeUpgradeCost, forgeUpgradeMaxed } from '../game/forge'
import { gemKey, gemTierName, GEM_MAX_TIER, GEM_FUSE_COUNT, GEM_FUSE_GOLD, GEM_DMG, GEM_RES } from '../game/gems'
import { getCondGem } from '../game/condGems'
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
 * L'Atelier du forgeron — écran complet (sous-onglet de Stuff, ex-modale).
 * Métier (Savoir-faire + améliorations) puis création d'objets sur mesure.
 * Conçu pour grossir : recettes, spécialisations, files de craft…
 */
export function AtelierPanel() {
  const bestStage = useGame((s) => s.bestStage)
  const essence = useGame((s) => s.essence)
  const noyau = useGame((s) => s.noyau)
  const fragments = useGame((s) => s.fragments)
  const poussiere = useGame((s) => s.poussiere)
  const cosmic = useGame((s) => s.cosmic)
  const createItem = useGame((s) => s.createItem)
  const forgeMastery = useGame((s) => s.forgeMastery)
  const forgeUpgrades = useGame((s) => s.forgeUpgrades)
  const buyForgeUpgrade = useGame((s) => s.buyForgeUpgrade)
  const mods = forgeMods(forgeUpgrades)

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
    <div className="h-full overflow-y-auto pr-1">
      {/* Métier de forgeron : Savoir-faire 🔧 + améliorations (déblocages + bonus) */}
      <div className="mb-3 rounded-xl border border-amber-800/40 bg-amber-950/10 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">🔧 Métier de forgeron</span>
          <span className="text-[11px] text-amber-200">🔧 {forgeMastery.toLocaleString('fr-FR')} Savoir-faire</span>
        </div>
        <p className="mb-1.5 text-[9.5px] leading-snug text-slate-500">
          Gagne du Savoir-faire en créant/modifiant des objets, puis débloque & améliore ton atelier.
        </p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {FORGE_UPGRADES.map((u) => {
            const lvl = forgeUpgrades[u.id] ?? 0
            const maxed = forgeUpgradeMaxed(u, lvl)
            const c = forgeUpgradeCost(u, lvl)
            const isUnlock = u.maxLevel === 1
            const owned = isUnlock && lvl > 0
            return (
              <button
                key={u.id}
                disabled={maxed || forgeMastery < c}
                onClick={() => buyForgeUpgrade(u.id)}
                title={u.description}
                className={'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left disabled:opacity-50 ' + (owned ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-slate-700 bg-black/20 hover:border-amber-600/60')}
              >
                <span className="text-base">{u.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-slate-200">
                    {u.name}{u.maxLevel > 1 ? <span className="text-slate-500"> {lvl}/{u.maxLevel}</span> : null}
                  </span>
                  <span className="block truncate text-[8.5px] text-slate-500">{u.description}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold">
                  {owned ? <span className="text-emerald-400">✓ Débloqué</span> : maxed ? <span className="text-slate-500">Max</span> : <span className={forgeMastery >= c ? 'text-amber-300' : 'text-red-400'}>🔧 {c}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Automates de forge : le sommet du métier (farm parallèle des donjons/raids battus) */}
      <AutomateWorkshop />

      {/* Taillerie de gemmes (stock + fusion 3 → 1) */}
      <GemWorkshop unlocked={mods.gems} />

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
            {mods.costMult < 1 && <span>💰 −{Math.round((1 - mods.costMult) * 100)}% coûts (métier)</span>}
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
      <p className="mt-1.5 pb-2 text-center text-[10px] text-slate-500">L'objet apparaît dans ton Sac. Tu peux forger en série.</p>
    </div>
  )
}

/**
 * Atelier des automates : construction (3 max, coûts brutaux), assignation de mission
 * (donjon/raid DÉJÀ battu, farmé au niveau record), améliorations vitesse/rendement.
 * L'automate consomme les clés, rapporte les ressources à 60-85% — jamais le stuff ni les 💫.
 */
function AutomateWorkshop() {
  const automates = useGame((s) => s.automates)
  const gold = useGame((s) => s.gold)
  const poussiere = useGame((s) => s.poussiere)
  const fragments = useGame((s) => s.fragments)
  const cosmic = useGame((s) => s.cosmic)
  const forgeMastery = useGame((s) => s.forgeMastery)
  const dungeonProgress = useGame((s) => s.dungeonProgress)
  const raidProgress = useGame((s) => s.raidProgress)
  const buildAutomate = useGame((s) => s.buildAutomate)
  const assignAutomate = useGame((s) => s.assignAutomate)
  const toggleAutomatePause = useGame((s) => s.toggleAutomatePause)
  const upgradeAutomate = useGame((s) => s.upgradeAutomate)
  const [assigning, setAssigning] = useState<number | null>(null)

  const nextCost = AUTOMATE_COSTS[automates.length]
  const anyBeaten = Object.values(dungeonProgress).some((v) => v > 0) || Object.values(raidProgress).some((v) => v > 0)
  // L'atelier des automates ne se révèle qu'une fois du contenu battu (et reste discret avant).
  if (automates.length === 0 && !anyBeaten) return null

  const beatenDungeons = DUNGEON_LIST.filter((d) => (dungeonProgress[d.id] ?? 0) > 0)
  const beatenRaids = RAID_LIST.filter((r) => (raidProgress[r.id] ?? 0) > 0)

  return (
    <div className="mb-3 rounded-xl border border-violet-800/40 bg-violet-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-300">🤖 Automates de forge</span>
        <span className="text-[10px] text-slate-500">{automates.length}/{AUTOMATE_MAX}</span>
      </div>
      <p className="mb-2 text-[9.5px] leading-snug text-slate-500">
        Une machine refait EN BOUCLE un donjon/raid déjà battu (au niveau record), même hors-ligne.
        Elle consomme les clés (🔑/🔮) et rapporte les ressources à {Math.round(60)}–85% — jamais le stuff ni les 💫.
        Astuce : un automate sur l'Antre des Failles produit les Sceaux des autres.
      </p>

      <div className="space-y-2">
        {automates.map((a) => {
          const duration = automateRunDuration(a)
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
                      disabled={maxed || forgeMastery < cost}
                      onClick={() => upgradeAutomate(a.id, kind)}
                      className="rounded bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    >
                      {kind === 'speed' ? '⚡ Vitesse' : '📈 Rendement'} {lvl}/{AUTOMATE_UPG_MAX}{maxed ? '' : ` · 🔧${cost}`}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {nextCost && (
          <button
            onClick={buildAutomate}
            disabled={gold < nextCost.gold || poussiere < nextCost.poussiere || fragments < nextCost.fragments || cosmic < nextCost.cosmic || forgeMastery < nextCost.mastery}
            className="w-full rounded-lg border border-violet-700/50 bg-violet-900/20 py-2 text-[11px] font-medium text-violet-200 hover:bg-violet-800/30 disabled:opacity-40"
          >
            🛠 Construire « {['Rouage', 'Enclume', 'Vigile'][automates.length]} » · 💰 {nextCost.gold.toLocaleString('fr-FR')} + 🌌 {nextCost.poussiere}
            {' '}+ ✨ {nextCost.fragments}{nextCost.cosmic ? ` + 💫 ${nextCost.cosmic}` : ''} + 🔧 {nextCost.mastery.toLocaleString('fr-FR')}
          </button>
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
 * Taillerie : stock de gemmes par élément/qualité + fusion 3 → 1 (puits d'or).
 * Les gemmes tombent chacune dans le biome de LEUR élément → farmer tous les biomes.
 */
function GemWorkshop({ unlocked }: { unlocked: boolean }) {
  const gems = useGame((s) => s.gems)
  const gold = useGame((s) => s.gold)
  const fuseGems = useGame((s) => s.fuseGems)
  const total = Object.values(gems).reduce((a, b) => a + b, 0)
  if (total === 0 && !unlocked) return null

  return (
    <div className="mb-3 rounded-xl border border-sky-800/40 bg-sky-950/10 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">💎 Taillerie de gemmes</span>
        <span className="text-[10px] text-slate-500">{total} en stock</span>
      </div>
      <p className="mb-1.5 text-[9.5px] leading-snug text-slate-500">
        Chaque gemme tombe dans le biome de SON élément. Sertis-les sur ton stuff (fiche objet, Rare+),
        fusionne 3 gemmes en 1 de qualité supérieure.{!unlocked && ' 🔒 Sertissage : débloque « Sertisseur » ci-dessus.'}
      </p>
      {/* Gemmes de CONDITION en stock (champions ✦ & raids) — se sertissent via la fiche objet */}
      {(() => {
        const conds = Object.entries(gems)
          .filter(([k, n]) => n > 0 && k.startsWith('cond:'))
          .map(([k, n]) => ({ def: getCondGem(k.slice(5))!, n }))
          .filter((x) => x.def)
        if (!conds.length) return null
        return (
          <div className="mb-1.5 space-y-1">
            {conds.map(({ def, n }) => (
              <div key={def.id} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                <span className="shrink-0 font-medium" style={{ color: def.color }}>{def.icon} {def.name} ×{n}</span>
                <span className="min-w-0 flex-1 truncate text-slate-500">{def.desc}</span>
              </div>
            ))}
          </div>
        )
      })()}
      {total === 0 ? (
        <div className="text-[10px] italic text-slate-500">Aucune gemme — farme les biomes (~1,5% par kill, plus sur élites/boss).</div>
      ) : (
        <div className="space-y-1">
          {DAMAGE_TYPE_LIST.map((t) => {
            const counts = [1, 2, 3].map((tier) => gems[gemKey(t, tier)] ?? 0)
            if (counts.every((c) => c === 0)) return null
            const m = DAMAGE_TYPES[t]
            return (
              <div key={t} className="flex items-center gap-1.5 rounded bg-black/20 px-1.5 py-1 text-[10px]">
                <span className="w-16 shrink-0 truncate font-medium" style={{ color: m.color }}>{m.icon} {m.name}</span>
                <span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-300">
                  {counts.map((c, i) => (c > 0 ? <span key={i} title={`+${GEM_DMG[i]}% dég. · +${GEM_RES[i]}% rés.`}>{gemTierName(i + 1)} ×{c}</span> : null))}
                </span>
                <span className="flex shrink-0 gap-1">
                  {[1, 2].map((tier) =>
                    tier < GEM_MAX_TIER && (gems[gemKey(t, tier)] ?? 0) >= GEM_FUSE_COUNT ? (
                      <button
                        key={tier}
                        disabled={gold < GEM_FUSE_GOLD[tier - 1]}
                        onClick={() => fuseGems(t, tier)}
                        title={`3 ${gemTierName(tier)} → 1 ${gemTierName(tier + 1)} · ${GEM_FUSE_GOLD[tier - 1].toLocaleString('fr-FR')} or`}
                        className="rounded border border-sky-700/40 px-1.5 py-1 font-medium text-sky-200 hover:bg-sky-900/30 disabled:opacity-40"
                      >
                        ⏫ {gemTierName(tier + 1)}
                      </button>
                    ) : null,
                  )}
                </span>
              </div>
            )
          })}
        </div>
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
