import { useMemo } from 'react'
import type { Character } from '../game/types'
import { resolveAvatar } from '../game/avatar'
import { RARITIES } from '../game/rarities'
import {
  buildLayers, resolveClass, topVisualTier, type BodyShape, type GearLayer, type VisualTier,
} from '../game/wardrobe'

/**
 * 👤 MANNEQUIN (v0.43, tranche verticale) — avatar 2D EN PIED : compose l'équipement RÉELLEMENT porté
 * en calques sur une silhouette de classe. PLACEHOLDER SVG procédural (pas d'asset raster encore) :
 * prouve composition + ancrage + montée de palier + effets (glow d'ilvl, glow élémentaire d'arme,
 * aura, scintillement) sur le vrai écran. Quand le pack d'art arrivera, chaque région dessinera un PNG
 * ancré au lieu de la forme procédurale. Voir DESIGN_v0.43_avatar.md.
 */

const CX = 50
const HEAD_CY = 19
const SHO_Y = 33
const WAIST_Y = 76
const HIP_Y = 86
const FOOT_Y = 144
const ARM_TOP = 35
const ARM_BOT = 80

interface Geo { headR: number; shoulderW: number; waistW: number; hipW: number; legW: number; armW: number }
const GEO: Record<BodyShape, Geo> = {
  massif: { headR: 11, shoulderW: 42, waistW: 24, hipW: 28, legW: 12, armW: 9 },
  athletique: { headR: 10, shoulderW: 34, waistW: 20, hipW: 24, legW: 10, armW: 7.5 },
  agile: { headR: 9.5, shoulderW: 29, waistW: 18, hipW: 21, legW: 9, armW: 6.5 },
  robe: { headR: 9.5, shoulderW: 29, waistW: 20, hipW: 36, legW: 0, armW: 7 },
}

/** Halo (drop-shadow) d'un calque : rayon proportionnel à l'intensité. */
function glowStyle(l: GearLayer): React.CSSProperties | undefined {
  if (l.glow <= 0.18) return undefined
  return { filter: `drop-shadow(0 0 ${(0.8 + l.glow * 4).toFixed(1)}px ${l.glowColor})` }
}

/** Forme procédurale d'une région, tintée par la rareté, ornementée selon le palier visuel. */
function Region({ l, geo, classTint }: { l: GearLayer; geo: Geo; classTint: string }) {
  const c = l.color
  const t = l.tier
  // Aux bas paliers (0-1) la teinte vire vers l'identité de CLASSE ; en haut, la rareté domine.
  const fill = t <= 1 ? classTint : c
  const stroke = '#0a0e16'
  const gem = l.gemmed || t >= 4
  const style = glowStyle(l)

  switch (l.region) {
    case 'cape': {
      const topW = geo.shoulderW * 0.7
      const botW = geo.hipW + 12
      return (
        <path
          d={`M ${CX - topW / 2} ${SHO_Y + 1} L ${CX + topW / 2} ${SHO_Y + 1} L ${CX + botW / 2} ${FOOT_Y - 16} L ${CX - botW / 2} ${FOOT_Y - 16} Z`}
          fill={classTint} opacity={0.85} stroke={stroke} strokeWidth={0.8} style={style}
        />
      )
    }
    case 'tete': {
      const r = geo.headR + 1.4
      return (
        <g style={style}>
          {/* Dôme de casque (moitié haute de la tête) */}
          <path d={`M ${CX - r} ${HEAD_CY + 1} A ${r} ${r} 0 0 1 ${CX + r} ${HEAD_CY + 1} L ${CX + r} ${HEAD_CY - 1} L ${CX - r} ${HEAD_CY - 1} Z`} fill={fill} stroke={stroke} strokeWidth={0.8} />
          <rect x={CX - r} y={HEAD_CY + 1} width={r * 2} height={2.4} rx={1} fill={fill} stroke={stroke} strokeWidth={0.6} />
          {/* Crête (palier ≥ 3) */}
          {t >= 3 && <path d={`M ${CX - 1.4} ${HEAD_CY - r} L ${CX + 1.4} ${HEAD_CY - r} L ${CX} ${HEAD_CY - r - 5 - t} Z`} fill={fill} stroke={stroke} strokeWidth={0.5} />}
        </g>
      )
    }
    case 'epaules': {
      const sx = geo.shoulderW / 2
      const rx = geo.shoulderW * 0.16
      const Pad = ({ x, dir }: { x: number; dir: 1 | -1 }) => (
        <g>
          <ellipse cx={x} cy={SHO_Y + 2} rx={rx} ry={rx * 0.8} fill={fill} stroke={stroke} strokeWidth={0.8} />
          {/* Pointes (palier ≥ 2) */}
          {t >= 2 && <path d={`M ${x} ${SHO_Y - rx * 0.8} L ${x + dir * rx * 0.7} ${SHO_Y - rx * 0.8 - 3 - t} L ${x + dir * rx} ${SHO_Y - rx * 0.4} Z`} fill={fill} stroke={stroke} strokeWidth={0.5} />}
        </g>
      )
      return <g style={style}><Pad x={CX - sx} dir={-1} /><Pad x={CX + sx} dir={1} /></g>
    }
    case 'torse': {
      const w = (geo.shoulderW + geo.waistW) / 2 * 0.66
      return (
        <g style={style}>
          <path d={`M ${CX - geo.shoulderW / 2 + 2} ${SHO_Y + 3} L ${CX + geo.shoulderW / 2 - 2} ${SHO_Y + 3} L ${CX + geo.waistW / 2} ${WAIST_Y - 2} L ${CX - geo.waistW / 2} ${WAIST_Y - 2} Z`} fill={fill} stroke={stroke} strokeWidth={0.9} />
          <line x1={CX} y1={SHO_Y + 5} x2={CX} y2={WAIST_Y - 4} stroke={stroke} strokeWidth={0.6} opacity={0.5} />
          {gem && <circle cx={CX} cy={(SHO_Y + WAIST_Y) / 2 - 6} r={2 + t * 0.4} fill="#fff" stroke={c} strokeWidth={1} className="mq-shimmer" />}
          <ellipse cx={CX} cy={SHO_Y + 8} rx={w * 0.18} ry={2} fill="#ffffff" opacity={0.18} />
        </g>
      )
    }
    case 'taille':
      return <rect x={CX - geo.waistW / 2 - 2} y={WAIST_Y - 3} width={geo.waistW + 4} height={6} rx={1.5} fill={fill} stroke={stroke} strokeWidth={0.8} style={style} />
    case 'jambes': {
      if (geo.legW === 0) {
        // Robe : jupe triangulaire.
        return <path d={`M ${CX - geo.waistW / 2} ${WAIST_Y} L ${CX - geo.hipW / 2} ${FOOT_Y - 8} L ${CX + geo.hipW / 2} ${FOOT_Y - 8} L ${CX + geo.waistW / 2} ${WAIST_Y} Z`} fill={fill} opacity={0.92} stroke={stroke} strokeWidth={0.9} style={style} />
      }
      const off = geo.legW / 2 + 1
      return (
        <g style={style}>
          <rect x={CX - off - geo.legW / 2} y={HIP_Y} width={geo.legW} height={FOOT_Y - HIP_Y - 6} rx={2} fill={fill} stroke={stroke} strokeWidth={0.8} />
          <rect x={CX + off - geo.legW / 2} y={HIP_Y} width={geo.legW} height={FOOT_Y - HIP_Y - 6} rx={2} fill={fill} stroke={stroke} strokeWidth={0.8} />
        </g>
      )
    }
    case 'pieds': {
      const off = (geo.legW || geo.hipW * 0.4) / 2 + 1
      const Boot = ({ x }: { x: number }) => <rect x={x - 4} y={FOOT_Y - 7} width={9} height={7} rx={2} fill={fill} stroke={stroke} strokeWidth={0.8} />
      return <g style={style}><Boot x={CX - off} /><Boot x={CX + off} /></g>
    }
    case 'mains': {
      const lx = CX - geo.shoulderW / 2 + 1
      const rx = CX + geo.shoulderW / 2 - 1
      return <g style={style}><circle cx={lx} cy={ARM_BOT - 1} r={3} fill={fill} stroke={stroke} strokeWidth={0.7} /><circle cx={rx} cy={ARM_BOT - 1} r={3} fill={fill} stroke={stroke} strokeWidth={0.7} /></g>
    }
    case 'bouclier': {
      const x = CX - geo.shoulderW / 2 - 4
      const y = 60
      return (
        <g style={style}>
          <path d={`M ${x - 8} ${y - 11} L ${x + 8} ${y - 11} L ${x + 8} ${y + 4} Q ${x} ${y + 14} ${x - 8} ${y + 4} Z`} fill={fill} stroke={stroke} strokeWidth={1} />
          {t >= 2 && <circle cx={x} cy={y - 2} r={2.4} fill="#ffffff" opacity={0.7} />}
        </g>
      )
    }
    case 'arme': {
      const x = CX + geo.shoulderW / 2 + 6
      const tip = 12 - t * 0.5
      return (
        <g style={style}>
          {/* Lame */}
          <path d={`M ${x - 2} ${ARM_BOT - 2} L ${x + 2} ${ARM_BOT - 2} L ${x + 1.4} ${tip + 6} L ${x} ${tip} L ${x - 1.4} ${tip + 6} Z`} fill={l.glowColor} stroke={stroke} strokeWidth={0.7} />
          {/* Garde + poignée */}
          <rect x={x - 5} y={ARM_BOT - 3} width={10} height={2.4} rx={1} fill={fill} stroke={stroke} strokeWidth={0.6} />
          <rect x={x - 1.2} y={ARM_BOT - 1} width={2.4} height={7} rx={1} fill="#3a2a18" stroke={stroke} strokeWidth={0.5} />
        </g>
      )
    }
    default:
      return null
  }
}

/** Silhouette nue (corps) — dessinée sous le gear, au-dessus de la cape. */
function Body({ geo }: { geo: Geo }) {
  const skin = '#2a3346'
  const body = '#1b2433'
  const edge = '#33415c'
  const off = geo.legW / 2 + 1
  return (
    <g>
      {/* Tête + cou */}
      <circle cx={CX} cy={HEAD_CY} r={geo.headR} fill={skin} stroke={edge} strokeWidth={0.8} />
      <rect x={CX - 3} y={HEAD_CY + geo.headR - 1} width={6} height={5} fill={skin} />
      {/* Bras */}
      <rect x={CX - geo.shoulderW / 2 - geo.armW * 0.3} y={ARM_TOP} width={geo.armW} height={ARM_BOT - ARM_TOP} rx={geo.armW / 2} fill={body} stroke={edge} strokeWidth={0.7} />
      <rect x={CX + geo.shoulderW / 2 - geo.armW * 0.7} y={ARM_TOP} width={geo.armW} height={ARM_BOT - ARM_TOP} rx={geo.armW / 2} fill={body} stroke={edge} strokeWidth={0.7} />
      {/* Torse */}
      <path d={`M ${CX - geo.shoulderW / 2} ${SHO_Y} L ${CX + geo.shoulderW / 2} ${SHO_Y} L ${CX + geo.waistW / 2} ${WAIST_Y} L ${CX + geo.hipW / 2} ${HIP_Y} L ${CX - geo.hipW / 2} ${HIP_Y} L ${CX - geo.waistW / 2} ${WAIST_Y} Z`} fill={body} stroke={edge} strokeWidth={0.8} />
      {/* Jambes (ou base de robe) */}
      {geo.legW === 0 ? (
        <path d={`M ${CX - geo.waistW / 2} ${WAIST_Y} L ${CX - geo.hipW / 2} ${FOOT_Y - 6} L ${CX + geo.hipW / 2} ${FOOT_Y - 6} L ${CX + geo.waistW / 2} ${WAIST_Y} Z`} fill={body} stroke={edge} strokeWidth={0.8} />
      ) : (
        <>
          <rect x={CX - off - geo.legW / 2} y={HIP_Y} width={geo.legW} height={FOOT_Y - HIP_Y} rx={geo.legW / 2} fill={body} stroke={edge} strokeWidth={0.7} />
          <rect x={CX + off - geo.legW / 2} y={HIP_Y} width={geo.legW} height={FOOT_Y - HIP_Y} rx={geo.legW / 2} fill={body} stroke={edge} strokeWidth={0.7} />
        </>
      )}
    </g>
  )
}

const TIER_NAME: Record<VisualTier, string> = { 0: 'Brut', 1: 'Affûté', 2: 'Ouvragé', 3: 'Héroïque', 4: 'Glorieux', 5: 'Mythique' }

export function Mannequin({ char, maxWidth = 168, caption = true }: { char: Character; maxWidth?: number; caption?: boolean }) {
  const cls = useMemo(() => resolveClass(char), [char])
  const layers = useMemo(() => buildLayers(char), [char.equipment])
  const geo = GEO[cls.body]
  const { aura } = resolveAvatar(char.primaryBias, char.avatar)
  const top = topVisualTier(char)

  // La cape se rend DERRIÈRE le corps ; le reste devant (les calques sont déjà triés dos→face).
  const capeLayer = layers.find((l) => l.region === 'cape')
  const frontLayers = layers.filter((l) => l.region !== 'cape')

  return (
    <div className="relative mx-auto" style={{ width: '100%', maxWidth }}>
      {aura && (
        <div
          className={'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ' + (aura.anim ? 'av-aura-pulse' : '')}
          style={{ width: '82%', paddingBottom: '82%', height: 0, background: `radial-gradient(circle, ${aura.color} 0%, transparent 66%)`, opacity: 0.5 }}
        />
      )}
      <svg viewBox="0 0 100 152" className="relative block w-full" style={{ filter: top >= 5 ? 'drop-shadow(0 0 5px rgba(255,255,255,.35))' : undefined }}>
        {/* Socle */}
        <ellipse cx={CX} cy={FOOT_Y + 1} rx={geo.hipW * 0.9} ry={4} fill="#000" opacity={0.35} />
        {capeLayer && <Region l={capeLayer} geo={geo} classTint={cls.tint} />}
        <Body geo={geo} />
        {frontLayers.map((l) => <Region key={l.slot} l={l} geo={geo} classTint={cls.tint} />)}
      </svg>
      {caption && (
        <div className="mt-1 text-center text-[10px] leading-tight">
          <span className="font-semibold text-slate-200">{cls.name}</span>
          {layers.length > 0 && (
            <span className="ml-1" style={{ color: RARITIES[Object.values(char.equipment).find((i) => i)?.rarity ?? 'commun']?.color }}>
              · palier {TIER_NAME[top]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
