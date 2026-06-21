#!/usr/bin/env node
/**
 * Extrait un CALQUE de pièce d'équipement par DIFFÉRENCE avec le corps de base.
 *
 * Principe : tu génères toutes les pièces en habillant le MÊME corps de base (inpaint MJ sur la même
 * image) → pose/lumière/cadrage identiques. Ce script compare l'image habillée au corps nu et ne garde
 * que les pixels qui ont CHANGÉ → la pièce seule, sur fond transparent, déjà alignée. Le compositeur
 * (<Mannequin>) n'a plus qu'à empiler les calques.
 *
 * Usage :
 *   node scripts/avatar-layer.mjs <classId> <region> <tier> <imageHabillee>
 *   (le corps de base lu = public/avatars/<classId>/base.webp ; dépose-le d'abord via `npm run avatar <classId> base <img>`)
 *
 * Régions : tete epaules cape torse poignets mains taille jambes pieds bouclier arme
 * Réglage : THRESH=<n> (défaut 38) — seuil de différence. Monte-le si le calque déborde (fond bruité),
 *           baisse-le s'il troue la pièce.  ex: THRESH=55 node scripts/avatar-layer.mjs guerrier torse 0 ./x.png
 */
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const [, , classId, region, tier, dressed] = process.argv
if (!classId || !region || tier === undefined || !dressed) {
  console.error('Usage: node scripts/avatar-layer.mjs <classId> <region> <tier> <imageHabillee>')
  process.exit(1)
}

const W = 768
const H = 1152
const THRESH = Number(process.env.THRESH || 38) // |Δr|+|Δg|+|Δb| (0..765) au-dessus = pièce
const FEATHER = 26 // rampe d'alpha au-dessus du seuil (bords doux)

const baseP = resolve(`public/avatars/${classId}/base.webp`)
const dressedP = resolve(dressed)
const out = resolve(`public/avatars/${classId}/${region}-${tier}.webp`)

if (!existsSync(baseP)) {
  console.error(`✖ Corps de base introuvable : ${baseP}`)
  console.error(`  Dépose-le d'abord : npm run avatar ${classId} base <imageDuCorpsNu>`)
  process.exit(1)
}
if (!existsSync(dressedP)) {
  console.error(`✖ Image habillée introuvable : ${dressedP}`)
  process.exit(1)
}

const norm = (p) => sharp(p).rotate().resize(W, H, { fit: 'cover', position: 'top' }).removeAlpha().raw().toBuffer()
const [b, d] = await Promise.all([norm(baseP), norm(dressedP)])

const px = W * H
const rgba = Buffer.alloc(px * 4)
let kept = 0
for (let i = 0; i < px; i++) {
  const j = i * 3
  const diff = Math.abs(d[j] - b[j]) + Math.abs(d[j + 1] - b[j + 1]) + Math.abs(d[j + 2] - b[j + 2])
  let a = 0
  if (diff > THRESH) { a = Math.min(255, Math.round(((diff - THRESH) / FEATHER) * 255)); kept++ }
  const k = i * 4
  rgba[k] = d[j]; rgba[k + 1] = d[j + 1]; rgba[k + 2] = d[j + 2]; rgba[k + 3] = a
}

mkdirSync(dirname(out), { recursive: true })
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 82, alphaQuality: 90 }).toFile(out)

console.log(`✔ ${classId}/${region}-${tier}.webp — ${(kept / px * 100).toFixed(1)}% de pixels conservés (THRESH=${THRESH})`)
console.log('  Déborde (fond bruité) → monte THRESH ; troue la pièce → baisse-le.')
console.log(`  Équipe une pièce de région « ${region} » en jeu pour la voir se composer sur le corps.`)
