#!/usr/bin/env node
/**
 * Inspecte un fichier .glb (glTF binaire) et liste ses os, meshes, animations — sans aucune dépendance
 * (on lit juste le chunk JSON du conteneur). Sert à câbler l'attachement du gear (noms d'os de la tête,
 * des mains…) et l'animation idle.
 *
 * Usage : npm run glb public/models/base.glb
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/glb-inspect.mjs <fichier.glb>'); process.exit(1) }

const buf = readFileSync(file)
if (buf.readUInt32LE(0) !== 0x46546c67) { console.error('✖ Pas un GLB (magic « glTF » absent). Convertis en .glb.'); process.exit(1) }

// En-tête 12 o, puis chunks : [length u32][type u32][data]. Le 1er chunk est le JSON.
const jsonLen = buf.readUInt32LE(12)
const jsonType = buf.readUInt32LE(16)
if (jsonType !== 0x4e4f534a) { console.error('✖ Premier chunk non-JSON inattendu.'); process.exit(1) }
const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))

const nodes = gltf.nodes ?? []
const names = nodes.map((n, i) => n.name ?? `node_${i}`)
// Os = nœuds référencés par un skin (joints).
const jointSet = new Set()
for (const s of gltf.skins ?? []) for (const j of s.joints ?? []) jointSet.add(j)
const bones = [...jointSet].map((i) => names[i]).filter(Boolean)
// Heuristique : os candidats pour l'attachement.
const pick = (re) => bones.filter((b) => re.test(b))

console.log(`\n📦 ${file}`)
console.log(`  Meshes (${(gltf.meshes ?? []).length}) : ${(gltf.meshes ?? []).map((m, i) => m.name ?? `mesh_${i}`).join(', ') || '—'}`)
console.log(`  Animations (${(gltf.animations ?? []).length}) : ${(gltf.animations ?? []).map((a, i) => a.name ?? `anim_${i}`).join(', ') || '—'}`)
console.log(`  Squelette : ${bones.length} os${(gltf.skins ?? []).length ? '' : ' (aucun skin → modèle peut-être NON rigé)'}`)
if (bones.length) {
  console.log('  ── Os candidats pour attacher le gear ──')
  console.log('    tête   :', pick(/head|skull|t[eê]te/i).join(', ') || '?')
  console.log('    mainD  :', pick(/hand.*(r|right)|(r|right).*hand|mainmd|wrist.*r/i).join(', ') || '?')
  console.log('    mainG  :', pick(/hand.*(l|left)|(l|left).*hand|wrist.*l/i).join(', ') || '?')
  console.log('    épaules:', pick(/shoulder|clavicle|épaule/i).join(', ') || '?')
  console.log('    bassin :', pick(/hips|pelvis|root|bassin/i).join(', ') || '?')
  console.log('  ── Tous les os ──')
  console.log('   ', bones.join(', '))
}
console.log('')
