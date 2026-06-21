#!/usr/bin/env node
/**
 * Optimise une illustration d'avatar → WebP 768×1152 dans public/avatars/<classId>/<tier>.webp.
 * Réduit drastiquement le poids (un export 2K fait ~7 Mo → ~150 Ko à la taille d'affichage).
 *
 * Usage :
 *   node scripts/avatar-import.mjs <classId> <tier> [cheminSource]
 *   - avec cheminSource : importe et optimise ce fichier vers public/avatars/<classId>/<tier>.webp
 *   - sans cheminSource : ré-optimise EN PLACE public/avatars/<classId>/<tier>.webp (déjà déposé)
 *
 * Exemples :
 *   node scripts/avatar-import.mjs guerrier 0 ~/Downloads/warrior.png
 *   node scripts/avatar-import.mjs guerrier 0          # ré-encode l'image déjà en place
 *
 * Pense ensuite à ajouter la clé '<classId>-<tier>' au set AVATAR_ART (src/game/wardrobe.ts).
 */
import sharp from 'sharp'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const [, , classId, tier, input] = process.argv
if (!classId || tier === undefined) {
  console.error('Usage: node scripts/avatar-import.mjs <classId> <tier> [cheminSource]')
  process.exit(1)
}

const W = 768
const H = 1152
const QUALITY = 80
const out = resolve(`public/avatars/${classId}/${tier}.webp`)
const src = input ? resolve(input) : out

if (!existsSync(src)) {
  console.error(`✖ Source introuvable : ${src}`)
  process.exit(1)
}

const ko = (n) => (n / 1024).toFixed(0) + ' Ko'
const before = existsSync(out) ? statSync(out).size : 0

// src === out → lire d'abord en buffer (sharp ne lit/écrit pas le même fichier en streaming).
const buf = await sharp(src)
  .rotate() // applique l'orientation EXIF
  .resize(W, H, { fit: 'cover', position: 'top' }) // 2:3 attendu → aucun rognage si l'entrée est en 2:3
  .webp({ quality: QUALITY })
  .toBuffer()

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, buf)

const after = statSync(out).size
console.log(`✔ ${classId}/${tier}.webp — ${W}×${H} @ q${QUALITY}`)
console.log(`  ${before ? ko(before) + ' → ' : ''}${ko(after)}`)
if (after > 180 * 1024) console.log('  ⚠ Toujours > 180 Ko : baisse la qualité ou vérifie la source.')
console.log(`  → ajoute '${classId}-${tier}' à AVATAR_ART dans src/game/wardrobe.ts si pas déjà fait.`)
