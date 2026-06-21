import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, RoundedBox } from '@react-three/drei'
import type { Character } from '../game/types'
import { buildLayers, resolveClass, lookTier, type GearLayer } from '../game/wardrobe'

/**
 * 👤 AVATAR 3D (v0.43.3, PIVOT 3D) — preuve du moteur : un corps en primitives + des pièces de gear
 * ATTACHÉES selon l'équipement RÉEL (réutilise `buildLayers`). Matériaux PBR pilotés par la rareté
 * (métal/émission montent avec le palier ; arme = émission de l'élément). Placeholder : les primitives
 * remplaceront des meshes GLB rigés une fois le moteur validé. Voir DESIGN_v0.43_avatar.md.
 */

const BODY = '#39414f'
const SKIN = '#5b6473'

/** Matériau PBR d'une pièce selon son palier (métal + brillance + émission montent avec la rareté). */
function gearMat(l: GearLayer) {
  const t = l.tier
  return {
    color: l.color,
    metalness: Math.min(0.95, 0.3 + t * 0.12),
    roughness: Math.max(0.14, 0.72 - t * 0.1),
    emissive: l.glowColor,
    emissiveIntensity: l.region === 'arme' ? 0.7 : t >= 4 ? 0.35 * l.glow + 0.1 : 0,
  }
}

/** Une pièce d'équipement en primitives, positionnée sur le corps. */
function GearPiece({ l }: { l: GearLayer }) {
  const m = gearMat(l)
  const mat = <meshStandardMaterial color={m.color} metalness={m.metalness} roughness={m.roughness} emissive={m.emissive} emissiveIntensity={m.emissiveIntensity} />
  switch (l.region) {
    case 'tete':
      return <RoundedBox args={[0.34, 0.3, 0.34]} radius={0.1} smoothness={4} position={[0, 1.56, 0.01]} castShadow>{mat}</RoundedBox>
    case 'epaules':
      return (<group>
        {[-0.31, 0.31].map((x) => <RoundedBox key={x} args={[0.22, 0.18, 0.24]} radius={0.07} position={[x, 1.34, 0]} castShadow>{mat}</RoundedBox>)}
      </group>)
    case 'cape':
      return <RoundedBox args={[0.44, 0.78, 0.04]} radius={0.03} position={[0, 0.98, -0.17]} castShadow>{mat}</RoundedBox>
    case 'torse':
      return <RoundedBox args={[0.56, 0.58, 0.34]} radius={0.08} position={[0, 1.12, 0.01]} castShadow>{mat}</RoundedBox>
    case 'poignets':
      return (<group>
        {[-0.34, 0.34].map((x) => <mesh key={x} position={[x, 0.92, 0]} castShadow><cylinderGeometry args={[0.09, 0.09, 0.16, 16]} /><meshStandardMaterial {...m} /></mesh>)}
      </group>)
    case 'mains':
      return (<group>
        {[-0.35, 0.35].map((x) => <RoundedBox key={x} args={[0.15, 0.16, 0.17]} radius={0.05} position={[x, 0.77, 0]} castShadow>{mat}</RoundedBox>)}
      </group>)
    case 'taille':
      return <RoundedBox args={[0.52, 0.14, 0.32]} radius={0.04} position={[0, 0.86, 0]} castShadow>{mat}</RoundedBox>
    case 'jambes':
      return (<group>
        {[-0.14, 0.14].map((x) => <RoundedBox key={x} args={[0.2, 0.72, 0.23]} radius={0.06} position={[x, 0.46, 0.01]} castShadow>{mat}</RoundedBox>)}
      </group>)
    case 'pieds':
      return (<group>
        {[-0.14, 0.14].map((x) => <RoundedBox key={x} args={[0.19, 0.14, 0.34]} radius={0.05} position={[x, 0.07, 0.06]} castShadow>{mat}</RoundedBox>)}
      </group>)
    case 'bouclier':
      return <RoundedBox args={[0.06, 0.46, 0.38]} radius={0.04} position={[-0.44, 1.0, 0.12]} rotation={[0, 0, 0]} castShadow>{mat}</RoundedBox>
    case 'arme':
      return (
        <group position={[0.42, 0.75, 0.16]} rotation={[0, 0, 0.12]}>
          <RoundedBox args={[0.07, 0.95, 0.03]} radius={0.015} position={[0, 0.25, 0]} castShadow>{mat}</RoundedBox>
          <mesh position={[0, -0.28, 0]}><boxGeometry args={[0.22, 0.05, 0.05]} /><meshStandardMaterial color={l.color} metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.025, 0.025, 0.2, 12]} /><meshStandardMaterial color="#2a1d12" roughness={0.8} /></mesh>
        </group>
      )
    default:
      return null
  }
}

/** Corps nu en primitives (le « mannequin » sur lequel le gear s'attache). */
function Body() {
  const bodyMat = <meshStandardMaterial color={BODY} metalness={0.1} roughness={0.85} />
  return (
    <group>
      <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.17, 24, 24]} /><meshStandardMaterial color={SKIN} roughness={0.7} /></mesh>
      <mesh position={[0, 1.38, 0]}><cylinderGeometry args={[0.07, 0.08, 0.1, 12]} /><meshStandardMaterial color={SKIN} roughness={0.7} /></mesh>
      <RoundedBox args={[0.46, 0.56, 0.26]} radius={0.12} smoothness={4} position={[0, 1.12, 0]} castShadow>{bodyMat}</RoundedBox>
      <RoundedBox args={[0.4, 0.18, 0.26]} radius={0.09} position={[0, 0.84, 0]} castShadow>{bodyMat}</RoundedBox>
      {[-0.31, 0.31].map((x) => <RoundedBox key={x} args={[0.12, 0.52, 0.14]} radius={0.06} position={[x, 1.12, 0]} castShadow>{bodyMat}</RoundedBox>)}
      {[-0.14, 0.14].map((x) => <RoundedBox key={x} args={[0.16, 0.78, 0.18]} radius={0.08} position={[x, 0.44, 0]} castShadow>{bodyMat}</RoundedBox>)}
    </group>
  )
}

export default function Avatar3D({ char, maxWidth = 168 }: { char: Character; maxWidth?: number }) {
  const cls = resolveClass(char)
  const layers = buildLayers(char)
  const tier = lookTier(char)
  const TIER_NAME = ['Brut', 'Affûté', 'Ouvragé', 'Héroïque', 'Glorieux', 'Mythique']

  return (
    <div className="relative mx-auto" style={{ width: '100%', maxWidth }}>
      <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '2 / 3', background: 'radial-gradient(ellipse at 50% 30%, #11161f 0%, #0a0e16 70%)' }}>
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.0, 3.05], fov: 32 }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#9bb8ff" />
          <group position={[0, -0.05, 0]}>
            <Body />
            {layers.map((l) => <GearPiece key={l.slot} l={l} />)}
          </group>
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={4} blur={2.6} far={3} />
          <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.1} target={[0, 0.95, 0]} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.9} />
        </Canvas>
      </div>
      <div className="mt-1 text-center text-[10px] leading-tight">
        <span className="font-semibold text-slate-200">{cls.name}</span>
        {layers.length > 0 && <span className="ml-1 text-slate-400">· palier {TIER_NAME[tier]}</span>}
      </div>
    </div>
  )
}
