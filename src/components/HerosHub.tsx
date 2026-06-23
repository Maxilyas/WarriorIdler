import { useState } from 'react'
import { useGame } from '../game/store'
import { useMediaQuery } from '../useMediaQuery'
import { CharacterPanel, type CharacterView } from './CharacterPanel'
import { TalentTree } from './TalentTree'
import { Sheet, SubTab } from './ui'
import { LevelBadge } from './LevelBadge'
import { PrestigePanel } from './PrestigePanel'
import { AchievementsPanel } from './AchievementsPanel'
import { getAchievement } from '../game/achievements'
import { charDps, charMaxHp, charResist, teamTalentPool } from '../game/character'
import { getRaidDef, raidReqs, raidUnlocked } from '../game/raids'
import { resistMult } from '../game/resist'
import { DAMAGE_TYPE_LIST } from '../game/damage'
import { PRIMARY_META } from '../game/stats'
import type { DamageType } from '../game/types'

type HerosView = CharacterView | 'talents' | 'prestige' | 'hautsFaits'

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'Md'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return Math.round(n).toLocaleString('fr-FR')
}

/**
 * Hub Héros :
 *  - DESKTOP : sous-onglets (Aperçu · Stats · Résist · Capacités · Talents).
 *  - MOBILE : « carte de perso » — identité en tête (nom, niveau, DPS, PV) + MINI-CARTES
 *    qui s'ouvrent en plein écran. CONTEXTUEL : les points de talent et les DÉFICITS de
 *    résistance face au raid en cours remontent en badge sur leur carte.
 */
export function HerosHub({ talentsUnlocked }: { talentsUnlocked: boolean }) {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setActiveChar = useGame((s) => s.setActiveChar)
  const raid = useGame((s) => s.raid)
  const echos = useGame((s) => s.echos)
  const prestigeRank = useGame((s) => s.prestigeRank)
  const bestStage = useGame((s) => s.bestStage)
  const raidProgress = useGame((s) => s.raidProgress)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  // pool de talents PARTAGÉ (compte), dérivé : plus la somme des persos (qui doublait avec un alt).
  const upgrades = useGame((s) => s.upgrades)
  const talentPoints = teamTalentPool(characters, upgrades.talentBonus ?? 0)
  const prestigeUnlocked = prestigeRank > 0 || echos > 0 || raidUnlocked(getRaidDef('abysse'), bestStage, raidProgress)
  const [sub, setSub] = useState<HerosView>('apercu')
  const [card, setCard] = useState<HerosView | null>(null)

  const char = characters[activeChar] ?? characters[0]
  if (!char) return null

  // CONTEXTE (option C) : pire multiplicateur de résist du perso actif face au raid EN COURS.
  let worstMult = 1
  if (raid) {
    const def = getRaidDef(raid.raidId)
    const reqs = def ? raidReqs(def, raid.tier) : {}
    const res = charResist(char)
    for (const t of DAMAGE_TYPE_LIST) {
      const req = reqs[t as DamageType] ?? 0
      if (req > 0) worstMult = Math.max(worstMult, resistMult(req, res[t as DamageType] ?? 0))
    }
  }

  /* ---------- DESKTOP : sous-onglets ---------- */
  if (isDesktop) {
    const active: HerosView = sub === 'talents' && !talentsUnlocked ? 'apercu' : sub
    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex gap-1.5">
          <SubTab on={active === 'apercu'} onClick={() => setSub('apercu')}>🛡 Aperçu</SubTab>
          <SubTab on={active === 'stats'} onClick={() => setSub('stats')}>📊 Stats</SubTab>
          <SubTab on={active === 'resist'} onClick={() => setSub('resist')}>
            🌈 Résist
            {worstMult > 1 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-slate-950">×{worstMult.toFixed(1)}</span>}
          </SubTab>
          <SubTab on={active === 'capacites'} onClick={() => setSub('capacites')}>⚡ Capacités</SubTab>
          {talentsUnlocked && (
            <SubTab on={active === 'talents'} onClick={() => setSub('talents')}>
              🌌 Talents
              {talentPoints > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-950">{talentPoints}</span>}
            </SubTab>
          )}
          {prestigeUnlocked && (
            <SubTab on={active === 'prestige'} onClick={() => setSub('prestige')}>✨ Éveil
              {echos > 0 && <span className="rounded-full bg-fuchsia-500 px-1.5 text-[10px] text-slate-950">{echos}</span>}
            </SubTab>
          )}
          <SubTab on={active === 'hautsFaits'} onClick={() => setSub('hautsFaits')}>🏆 Hauts faits</SubTab>
        </div>
        <div className="min-h-0 flex-1">
          {active === 'talents' ? (
            <TalentTree />
          ) : active === 'prestige' ? (
            <PrestigePanel />
          ) : active === 'hautsFaits' ? (
            <AchievementsPanel />
          ) : (
            <div className="h-full overflow-y-auto pr-1">
              <CharacterPanel view={active} />
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ---------- MOBILE : carte de perso + mini-cartes plein écran ---------- */
  const dps = charDps(char)
  const maxHp = charMaxHp(char)
  const cards: { id: HerosView; icon: string; label: string; hint: string; badge?: React.ReactNode }[] = [
    { id: 'apercu', icon: '🛡', label: 'Aperçu', hint: 'Spé · sets · résumé' },
    { id: 'stats', icon: '📊', label: 'Stats', hint: 'Détail chiffré · DPS' },
    {
      id: 'resist', icon: '🌈', label: 'Résist', hint: raid ? 'Boss en cours' : 'Exigences des boss',
      badge: worstMult > 1
        ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-slate-950">×{worstMult.toFixed(1)}</span>
        : undefined,
    },
    { id: 'capacites', icon: '⚡', label: 'Capacités', hint: '5 slots · auto/manuel' },
    ...(talentsUnlocked
      ? [{
          id: 'talents' as HerosView, icon: '🌌', label: 'Talents', hint: 'L\'arbre des builds',
          badge: talentPoints > 0
            ? <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-slate-950">{talentPoints}</span>
            : undefined,
        }]
      : []),
    ...(prestigeUnlocked
      ? [{
          id: 'prestige' as HerosView, icon: '✨', label: 'Éveil', hint: 'Prestige · Constellation',
          badge: echos > 0
            ? <span className="rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[9px] font-bold text-slate-950">{echos}</span>
            : undefined,
        }]
      : []),
    { id: 'hautsFaits' as HerosView, icon: '🏆', label: 'Hauts faits', hint: 'Titres · bonus permanents' },
  ]

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      {/* Identité (roster + vitaux) */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#161c2a] to-[#0d111a] p-3">
        {characters.length > 1 && (
          <div className="mb-2 flex gap-1.5">
            {characters.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setActiveChar(i)}
                className={
                  'flex-1 truncate rounded-lg border px-2 py-1.5 text-[11px] font-medium ' +
                  (i === activeChar ? 'border-orange-400 bg-orange-500/10 text-orange-200' : 'border-slate-700 text-slate-400')
                }
              >
                {c.name} <span className="text-slate-500">N{c.level}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <LevelBadge char={characters[0]} />
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-slate-100">{char.name}</div>
              {char.title && getAchievement(char.title)?.title && (
                <div className="truncate text-[10px] italic text-amber-300">🎖 {getAchievement(char.title)!.title}</div>
              )}
              <div className="text-[11px]" style={{ color: PRIMARY_META[char.primaryBias].color }}>
                {PRIMARY_META[char.primaryBias].name}
              </div>
            </div>
          </div>
          <div className="text-right text-[11px]">
            <div className="text-emerald-300">⚔ {fmt(dps)} DPS</div>
            <div className="text-sky-300">❤ {fmt(char.hp)} / {fmt(maxHp)}</div>
          </div>
        </div>
      </div>

      {/* Mini-cartes (B) : tout le build au même endroit, le détail en plein écran. */}
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => setCard(c.id)}
            className="flex flex-col items-start gap-0.5 rounded-xl border border-slate-800 bg-[#11151f] p-3 text-left active:bg-slate-800/60"
          >
            <span className="flex w-full items-center justify-between text-[13px] font-semibold text-slate-200">
              <span>{c.icon} {c.label}</span>
              {c.badge}
            </span>
            <span className="text-[10px] text-slate-500">{c.hint}</span>
          </button>
        ))}
      </div>

      {raid && worstMult > 1 && (
        <button onClick={() => setCard('resist')} className="rounded-lg border border-rose-700/50 bg-rose-950/20 p-2 text-left text-[10.5px] leading-snug text-rose-200">
          ⚠️ Raid en cours : {char.name} subit jusqu'à <b>×{worstMult.toFixed(1)}</b> sur un type exigé — ouvre 🌈 Résist.
        </button>
      )}

      {/* Plein écran (Sheet) */}
      {card && card !== 'talents' && card !== 'prestige' && card !== 'hautsFaits' && (
        <Sheet title={`${cards.find((c) => c.id === card)?.icon} ${cards.find((c) => c.id === card)?.label} — ${char.name}`} onClose={() => setCard(null)}>
          <CharacterPanel view={card} />
        </Sheet>
      )}
      {card === 'hautsFaits' && (
        <Sheet title="🏆 Hauts faits" onClose={() => setCard(null)}>
          <div className="h-[72vh]">
            <AchievementsPanel />
          </div>
        </Sheet>
      )}
      {card === 'talents' && (
        <Sheet title={`🌌 Talents — ${char.name}`} onClose={() => setCard(null)}>
          <div className="h-[72vh]">
            <TalentTree />
          </div>
        </Sheet>
      )}
      {card === 'prestige' && (
        <Sheet title="✨ Éveil Primordial" onClose={() => setCard(null)}>
          <div className="h-[72vh]">
            <PrestigePanel />
          </div>
        </Sheet>
      )}
    </div>
  )
}
