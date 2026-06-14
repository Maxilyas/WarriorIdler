import type { Character } from '../game/types'
import { xpForLevel } from '../game/store'

/**
 * F4 (v0.27) — BADGE DE NIVEAU « à la Overwatch » : un AVATAR (portrait) cerné d'un ANNEAU D'XP,
 * surmonté d'un ÉCUSSON qui représente le niveau. Plus le niveau monte, plus l'écusson est ÉPIQUE
 * (couleurs + éclat + nombre de pointes de l'étoile). Affiché sur la page Combat et l'aperçu Héros.
 */

/** Paliers d'écusson : le rang change tous les ~25 niveaux et devient plus beau (couleurs/éclat/pointes). */
const LEVEL_TIERS = [
  { min: 1, name: 'Bronze', c1: '#7c4a13', c2: '#f0b250', spikes: 6, glow: 0 },
  { min: 10, name: 'Argent', c1: '#566173', c2: '#dbe4ee', spikes: 6, glow: 0 },
  { min: 25, name: 'Or', c1: '#9a6a06', c2: '#ffd84d', spikes: 6, glow: 2 },
  { min: 50, name: 'Platine', c1: '#0c6478', c2: '#5fe3f0', spikes: 8, glow: 3 },
  { min: 75, name: 'Diamant', c1: '#5b21b6', c2: '#c4b5fd', spikes: 8, glow: 4 },
  { min: 100, name: 'Maître', c1: '#9f1239', c2: '#fb7185', spikes: 10, glow: 5 },
  { min: 150, name: 'Cosmique', c1: '#0e7490', c2: '#7af0ff', spikes: 12, glow: 7 },
]
function levelTier(level: number) {
  let t = LEVEL_TIERS[0]
  for (const x of LEVEL_TIERS) if (level >= x.min) t = x
  return t
}

/** Glyphe d'avatar selon l'affinité (à défaut d'art : l'icône d'archétype tient lieu de portrait). */
const CLASS_GLYPH: Record<string, string> = { force: '⚔️', agilite: '🏹', intelligence: '✨' }

function hexPoints(cx: number, cy: number, rad: number): string {
  const p: string[] = []
  for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; p.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`) }
  return p.join(' ')
}
function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const p: string[] = []
  for (let i = 0; i < points * 2; i++) { const rad = i % 2 ? inner : outer; const a = -Math.PI / 2 + (i * Math.PI) / points; p.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`) }
  return p.join(' ')
}

export function LevelBadge({ char, size = 64 }: { char: Character; size?: number }) {
  const lvl = char.level
  const tier = levelTier(lvl)
  const need = xpForLevel(lvl)
  const progress = need > 0 ? Math.max(0, Math.min(1, char.xp / need)) : 1
  const glyph = CLASS_GLYPH[char.primaryBias] ?? '⚔️'
  const uid = String(char.id).replace(/[^a-z0-9]/gi, '') || 'x'

  const r = size / 2
  const ringW = Math.max(3, size * 0.07)
  const ringR = r - ringW / 2 - 1
  const circ = 2 * Math.PI * ringR
  const emblemH = size * 0.56
  const totalH = size + emblemH * 0.6
  const ecx = size / 2
  const ecy = emblemH / 2

  return (
    <div className="relative shrink-0" style={{ width: size, height: totalH }} title={`Niveau ${lvl} · écusson ${tier.name} · XP ${Math.round(char.xp)}/${need}`}>
      {/* Avatar + anneau d'XP */}
      <svg width={size} height={size} className="absolute left-0 top-0">
        <defs>
          <radialGradient id={`av${uid}`} cx="50%" cy="36%">
            <stop offset="0%" stopColor="#243044" />
            <stop offset="100%" stopColor="#0a0e16" />
          </radialGradient>
        </defs>
        <circle cx={r} cy={r} r={ringR} fill={`url(#av${uid})`} stroke={tier.c2} strokeWidth={1.5} />
        <circle cx={r} cy={r} r={ringR} fill="none" stroke="#1e293b" strokeWidth={ringW} />
        <circle
          cx={r} cy={r} r={ringR} fill="none" stroke={tier.c2} strokeWidth={ringW} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} transform={`rotate(-90 ${r} ${r})`}
        />
      </svg>
      {/* Glyphe d'avatar (portrait de substitution) */}
      <div className="absolute left-0 top-0 flex items-center justify-center" style={{ width: size, height: size, fontSize: size * 0.38, paddingBottom: size * 0.04 }}>{glyph}</div>
      {/* Écusson de niveau (étoile + hexagone), évolue avec le palier */}
      <svg width={size} height={emblemH} className="absolute left-0" style={{ top: size - emblemH * 0.45, filter: tier.glow ? `drop-shadow(0 0 ${tier.glow}px ${tier.c2})` : undefined }}>
        <defs>
          <linearGradient id={`em${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tier.c2} />
            <stop offset="100%" stopColor={tier.c1} />
          </linearGradient>
        </defs>
        <polygon points={starPoints(ecx, ecy, emblemH * 0.49, emblemH * 0.3, tier.spikes)} fill={tier.c1} opacity={0.6} />
        <polygon points={hexPoints(ecx, ecy, emblemH * 0.36)} fill={`url(#em${uid})`} stroke="#0a0e16" strokeWidth={1.5} />
        <text x={ecx} y={ecy} textAnchor="middle" dominantBaseline="central" fontSize={emblemH * 0.36} fontWeight={800} fill="#0a0e16">{lvl}</text>
      </svg>
    </div>
  )
}
