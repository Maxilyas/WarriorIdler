import { useGame } from '../game/store'
import {
  ACHIEVEMENTS, ACHV_CATEGORIES, achievementBonuses, unlockedTitles,
  type AchvCategory, type AchvBonusKey,
} from '../game/achievements'
import { getMaitriseNode } from '../game/maitrise'
import { getBorder, getAura } from '../game/avatar'

const CAT_ORDER: AchvCategory[] = ['progression', 'stuff', 'collection', 'metiers', 'combat', 'legende']

/** Libellé de la parure (bordure/aura) débloquée par un haut fait, ou null. */
function parureLabel(border?: string, aura?: string): string | null {
  const b = getBorder(border)
  if (b) return `bordure ${b.name}`
  const a = getAura(aura)
  if (a) return `aura ${a.name}`
  return null
}

/** Puce de récompense : « ⚔️ +0,8% » (rangs façon Maîtrise → effet réel via perRank). */
function RewardChips({ reward }: { reward: Partial<Record<AchvBonusKey, number>> }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {(Object.keys(reward) as AchvBonusKey[]).map((k) => {
        const node = getMaitriseNode(k)
        if (!node) return null
        const ranks = reward[k] ?? 0
        const eff = (ranks * node.perRank).toFixed(1).replace('.', ',')
        return (
          <span key={k} title={`${node.name} : +${eff}% (${ranks} rang${ranks > 1 ? 's' : ''})`} className="rounded bg-black/30 px-1 text-[9.5px] leading-tight text-slate-300">
            {node.icon} +{eff}%
          </span>
        )
      })}
    </span>
  )
}

export function AchievementsPanel() {
  const achievements = useGame((s) => s.achievements)
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const selectTitle = useGame((s) => s.selectTitle)

  const char = characters[activeChar] ?? characters[0]
  const unlockedCount = ACHIEVEMENTS.filter((a) => achievements[a.id]).length
  const totalBonus = achievementBonuses(achievements)
  const titles = unlockedTitles(achievements)

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      {/* En-tête : progression + bonus total cumulé */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#161c2a] to-[#0d111a] p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-100">🏆 Hauts faits</span>
          <span className="text-[11px] tabular-nums text-amber-300">{unlockedCount}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
          <span>Bonus permanents cumulés :</span>
          {Object.keys(totalBonus).length === 0 ? (
            <span className="italic">aucun pour l'instant</span>
          ) : (
            <RewardChips reward={totalBonus} />
          )}
        </div>
      </div>

      {/* Sélecteur de TITRE (par héros) */}
      <div className="rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Titre de {char?.name ?? '—'}</div>
        {titles.length === 0 ? (
          <div className="text-[11px] italic text-slate-500">Débloque un haut fait à titre pour en équiper un.</div>
        ) : (
          <select
            value={char?.title ?? ''}
            onChange={(e) => char && selectTitle(char.id, e.target.value || null)}
            className="w-full rounded-lg bg-slate-800 px-2 py-1.5 text-[12px] text-slate-200"
          >
            <option value="">— Aucun titre —</option>
            {titles.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Liste par catégorie */}
      {CAT_ORDER.map((cat) => {
        const meta = ACHV_CATEGORIES[cat]
        const list = ACHIEVEMENTS.filter((a) => a.category === cat)
        const done = list.filter((a) => achievements[a.id]).length
        return (
          <div key={cat} className="rounded-xl border border-slate-800 bg-[#0d111a] p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: meta.color }}>{meta.icon} {meta.name}</span>
              <span className="text-[10px] tabular-nums text-slate-500">{done}/{list.length}</span>
            </div>
            <div className="space-y-1">
              {list.map((a) => {
                const got = !!achievements[a.id]
                return (
                  <div
                    key={a.id}
                    className={'flex items-center gap-2 rounded-lg px-2 py-1.5 ' + (got ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'bg-black/20 opacity-70')}
                  >
                    <span className={'text-base leading-none ' + (got ? '' : 'grayscale')}>{got ? a.icon : '🔒'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={'truncate text-[12px] font-medium ' + (got ? 'text-slate-100' : 'text-slate-400')}>{a.name}</span>
                        {a.title && <span className="shrink-0 rounded bg-fuchsia-500/20 px-1 text-[8.5px] text-fuchsia-200" title={`Titre : « ${a.title} »`}>🎖 titre</span>}
                        {parureLabel(a.border, a.aura) && <span className="shrink-0 rounded bg-amber-500/20 px-1 text-[8.5px] text-amber-200" title={`Parure : ${parureLabel(a.border, a.aura)}`}>🏅 parure</span>}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">{a.desc}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <RewardChips reward={a.reward} />
                      {got && <div className="text-[9px] font-bold text-emerald-400">✓ obtenu</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
