#!/usr/bin/env node
/**
 * Convertit un .gltf (+ .bin + textures externes) en .glb autonome dans public/models/.
 * Utilise @gltf-transform (lecture/écriture glTF en Node, sans DOM).
 *
 * Usage : node scripts/gltf2glb.mjs <entrée.gltf> <nomDeSortie>
 *         → public/models/<nomDeSortie>.glb
 */
import { NodeIO } from '@gltf-transform/core'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , input, outName] = process.argv
if (!input || !outName) { console.error('Usage: node scripts/gltf2glb.mjs <entrée.gltf> <nomDeSortie>'); process.exit(1) }
const inPath = resolve(input)
if (!existsSync(inPath)) { console.error('✖ Introuvable : ' + inPath); process.exit(1) }
const out = resolve(`public/models/${outName}.glb`)

const io = new NodeIO()
const doc = await io.read(inPath)
await io.write(out, doc)
console.log(`✔ ${outName}.glb — ${(statSync(out).size / 1024).toFixed(0)} Ko`)
