import type { Character } from '../game/types'
import { xpForLevel } from '../game/store'

/**
 * F4 (v0.27) — badge de niveau circulaire avec ANNEAU D'XP autour (« vrai jeu »).
 * Le niveau est au centre, l'anneau se remplit vers le niveau suivant (char.xp / xpForLevel).
 */
export function LevelBadge({ char, size = 46 }: { char: Character; size?: number }) {
  const need = xpForLevel(char.level)
  const progress = need > 0 ? Math.max(0, Math.min(1, char.xp / need)) : 1
  const sw = Math.max(3, Math.round(size * 0.08))
  const r = size / 2 - sw / 2 - 1
  const circ = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Niveau ${char.level} · XP ${Math.round(char.xp)}/${need}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fb923c" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[7px] uppercase tracking-wide text-slate-500">niv</span>
        <span className="font-bold text-slate-100" style={{ fontSize: size * 0.34 }}>{char.level}</span>
      </div>
    </div>
  )
}
