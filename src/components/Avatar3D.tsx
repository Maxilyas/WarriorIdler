import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, useGLTF, useAnimations } from '@react-three/drei'
import { Box3, Vector3, type Group, type Object3D } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import type { Character } from '../game/types'
import { resolveClass, lookTier } from '../game/wardrobe'

/**
 * 👤 AVATAR 3D (v0.43.3) — vrai modèle rigé (KayKit Adventurers, CC0). Charge le Knight + l'animation
 * Idle (rig partagé, mêmes os), recadre automatiquement, et MONTRE/CACHE les pièces modulaires selon
 * l'équipement réel (casque ↔ slot tête, cape ↔ slot cape). L'attachement d'armes (os `handslot.r/l`)
 * et le mapping complet slot→mesh viennent ensuite. Voir DESIGN_v0.43_avatar.md.
 */

const BASE = `${import.meta.env.BASE_URL}models/base.glb`
const ANIMS = `${import.meta.env.BASE_URL}models/animations.glb`

function KnightFigure({ char }: { char: Character }) {
  const root = useRef<Group>(null)
  const { scene } = useGLTF(BASE)
  const { animations } = useGLTF(ANIMS)
  // Clone (SkeletonUtils) : instance indépendante avec skinning préservé.
  const model = useMemo(() => SkeletonUtils.clone(scene) as Group, [scene])
  const { actions } = useAnimations(animations, model)

  // Animation Idle en boucle.
  useEffect(() => {
    const a = actions.Idle_A ?? actions[Object.keys(actions)[0]]
    a?.reset().fadeIn(0.3).play()
    return () => { a?.fadeOut(0.2) }
  }, [actions])

  // Recadrage déterministe : hauteur cible ~1.7, pieds au sol, centré.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const s = size.y > 0 ? 1.7 / size.y : 1
    return { s, px: -center.x * s, py: -box.min.y * s, pz: -center.z * s }
  }, [model])

  // Pièces modulaires : visibles selon l'équipement réel (preuve du « voir la pièce »).
  const hasTete = !!char.equipment?.tete
  const hasCape = !!char.equipment?.cape
  useEffect(() => {
    model.traverse((o: Object3D) => {
      o.castShadow = true
      if (o.name === 'Knight_Helmet' || o.name === 'Knight_HelmetVisor') o.visible = hasTete
      if (o.name === 'Knight_Cape') o.visible = hasCape
    })
  }, [model, hasTete, hasCape])

  return (
    <group ref={root} position={[fit.px, fit.py, fit.pz]} scale={fit.s}>
      <primitive object={model} />
    </group>
  )
}

const TIER_NAME = ['Brut', 'Affûté', 'Ouvragé', 'Héroïque', 'Glorieux', 'Mythique']

export default function Avatar3D({ char, maxWidth = 168 }: { char: Character; maxWidth?: number }) {
  const cls = resolveClass(char)
  const tier = lookTier(char)
  const equipped = Object.values(char.equipment ?? {}).some(Boolean)

  return (
    <div className="relative mx-auto" style={{ width: '100%', maxWidth }}>
      <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '2 / 3', background: 'radial-gradient(ellipse at 50% 35%, #141a24 0%, #0a0e16 72%)' }}>
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.0, 3.0], fov: 33 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-3, 2, -3]} intensity={0.5} color="#9bb8ff" />
          <Suspense fallback={null}>
            <KnightFigure char={char} />
          </Suspense>
          <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={4} blur={2.6} far={3} />
          <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.1} target={[0, 0.95, 0]} minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 1.9} />
        </Canvas>
      </div>
      <div className="mt-1 text-center text-[10px] leading-tight">
        <span className="font-semibold text-slate-200">{cls.name}</span>
        {equipped && <span className="ml-1 text-slate-400">· palier {TIER_NAME[tier]}</span>}
      </div>
    </div>
  )
}

useGLTF.preload(BASE)
useGLTF.preload(ANIMS)
