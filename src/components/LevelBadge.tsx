import type { Character } from '../game/types'
import { xpForLevel } from '../game/store'
import { resolveAvatar, type AvatarBorder } from '../game/avatar'

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

/** Positions régulières sur un cercle (studs/épines de bordure). */
function ringDots(cx: number, cy: number, rad: number, count: number): { x: number; y: number; a: number }[] {
  const out: { x: number; y: number; a: number }[] = []
  for (let i = 0; i < count; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / count; out.push({ x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a), a }) }
  return out
}

/** 🏅 Bordure de prestige : un anneau décoratif autour du portrait (style selon la parure). */
function BorderRing({ border, cx, cy, rad, w }: { border: AvatarBorder; cx: number; cy: number; rad: number; w: number }) {
  const stud = Math.max(1.4, w * 0.9)
  switch (border.style) {
    case 'double':
      return (<g>
        <circle cx={cx} cy={cy} r={rad} fill="none" stroke={border.c1} strokeWidth={w} />
        <circle cx={cx} cy={cy} r={rad - w - 1} fill="none" stroke={border.c2} strokeWidth={Math.max(1, w * 0.6)} />
      </g>)
    case 'dashed':
      return <circle cx={cx} cy={cy} r={rad} fill="none" stroke={border.c2} strokeWidth={w} strokeDasharray={`${w * 2} ${w * 1.4}`} strokeLinecap="round" />
    case 'runic':
      return <circle cx={cx} cy={cy} r={rad} fill="none" stroke={border.c2} strokeWidth={w} strokeDasharray={`${w * 1.2} ${w * 1.2}`} style={{ filter: `drop-shadow(0 0 2px ${border.c2})` }} />
    case 'spikes':
      return (<g>
        <circle cx={cx} cy={cy} r={rad} fill="none" stroke={border.c1} strokeWidth={Math.max(1, w * 0.7)} />
        {ringDots(cx, cy, rad, 12).map((d, i) => {
          const tip = { x: cx + (rad + stud * 1.6) * Math.cos(d.a), y: cy + (rad + stud * 1.6) * Math.sin(d.a) }
          const l = { x: cx + rad * Math.cos(d.a - 0.12), y: cy + rad * Math.sin(d.a - 0.12) }
          const r = { x: cx + rad * Math.cos(d.a + 0.12), y: cy + rad * Math.sin(d.a + 0.12) }
          return <polygon key={i} points={`${tip.x},${tip.y} ${l.x},${l.y} ${r.x},${r.y}`} fill={border.c2} />
        })}
      </g>)
    case 'studded':
    default:
      return (<g>
        <circle cx={cx} cy={cy} r={rad} fill="none" stroke={border.c1} strokeWidth={Math.max(1, w * 0.7)} />
        {ringDots(cx, cy, rad, 8).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={stud} fill={border.c2} />)}
      </g>)
  }
}

export function LevelBadge({ char, size = 64, showLevel = true }: { char: Character; size?: number; showLevel?: boolean }) {
  const lvl = char.level
  const tier = levelTier(lvl)
  const need = xpForLevel(lvl)
  const progress = need > 0 ? Math.max(0, Math.min(1, char.xp / need)) : 1
  // 🎨 (v0.28) portrait procédural : palette de fond + emblème central choisis (défaut par classe).
  // 🏅 (v0.32) parures de prestige : bordure + aura débloquées par haut fait (étage Légende).
  const { pal, emb, border, aura } = resolveAvatar(char.primaryBias, char.avatar)
  const glyph = emb.glyph
  const uid = String(char.id).replace(/[^a-z0-9]/gi, '') || 'x'

  const r = size / 2
  const ringW = Math.max(3, size * 0.07)
  const ringR = r - ringW / 2 - 1
  const circ = 2 * Math.PI * ringR
  const emblemH = size * 0.56
  const totalH = size + emblemH * 0.6
  const ecx = size / 2
  const ecy = emblemH / 2
  // Cadre décoratif posé juste à l'intérieur de l'anneau d'XP (n'empiète pas dessus).
  const borderRad = ringR - ringW - 1
  const borderW = Math.max(1.5, size * 0.028)
  const auraSize = size * 1.18
  // v0.36 — `showLevel=false` : portrait NU (sans écusson de niveau ni anneau d'XP). Le niveau étant
  // désormais un NIVEAU DE COMPTE unique, on ne le répète plus sur chaque héros (cf. lot 8).
  const badgeH = showLevel ? totalH : size

  return (
    <div className="relative shrink-0" style={{ width: size, height: badgeH }} title={showLevel ? `Niveau ${lvl} · écusson ${tier.name} · XP ${Math.round(char.xp)}/${need}` : char.name}>
      {/* Aura de prestige (halo derrière le médaillon) */}
      {aura && (
        <div
          className={'absolute rounded-full ' + (aura.anim ? 'av-aura-pulse' : '')}
          style={{ left: r - auraSize / 2, top: r - auraSize / 2, width: auraSize, height: auraSize, background: `radial-gradient(circle, ${aura.color} 0%, transparent 68%)`, opacity: 0.55, pointerEvents: 'none' }}
        />
      )}
      {/* Avatar + anneau d'XP */}
      <svg width={size} height={size} className="absolute left-0 top-0">
        <defs>
          <radialGradient id={`av${uid}`} cx="50%" cy="36%">
            <stop offset="0%" stopColor={pal.c1} />
            <stop offset="100%" stopColor={pal.c2} />
          </radialGradient>
        </defs>
        <circle cx={r} cy={r} r={ringR} fill={`url(#av${uid})`} stroke={tier.c2} strokeWidth={1.5} />
        <circle cx={r} cy={r} r={ringR} fill="none" stroke="#1e293b" strokeWidth={ringW} />
        {showLevel && (
          <circle
            cx={r} cy={r} r={ringR} fill="none" stroke={tier.c2} strokeWidth={ringW} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} transform={`rotate(-90 ${r} ${r})`}
          />
        )}
        {border && <BorderRing border={border} cx={r} cy={r} rad={borderRad} w={borderW} />}
      </svg>
      {/* Glyphe d'avatar (portrait de substitution) */}
      <div className="absolute left-0 top-0 flex items-center justify-center" style={{ width: size, height: size, fontSize: size * 0.38, paddingBottom: size * 0.04 }}>{glyph}</div>
      {/* Écusson de niveau (étoile + hexagone), évolue avec le palier — masqué si showLevel=false */}
      {showLevel && (
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
      )}
    </div>
  )
}
