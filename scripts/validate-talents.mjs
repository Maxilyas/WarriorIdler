import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

// Transpile talents.ts (import type ./types est effacé par esbuild) puis import dynamique.
const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
  const js = transformSync(src, { loader: 'ts', format: 'esm' }).code
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}
const mod = await load('../src/game/talents.ts')
const powersMod = await load('../src/game/powers.ts')

const { TALENTS } = mod
const powerIds = new Set(powersMod.POWERS.map((p) => p.id))
const byId = new Map()
const dupes = []
for (const t of TALENTS) {
  if (byId.has(t.id)) dupes.push(t.id)
  byId.set(t.id, t)
}

// 1) requires pointant vers un id inexistant
const broken = []
for (const t of TALENTS) {
  for (const r of t.requires ?? []) {
    if (!byId.has(r)) broken.push({ node: t.id, name: t.name, missing: r })
  }
}

// 2) accessibilité depuis le Cœur (mêmes arêtes que le moteur : requires)
const ROOT = 'co_start'
const seen = new Set([ROOT])
let changed = true
while (changed) {
  changed = false
  for (const t of TALENTS) {
    if (seen.has(t.id)) continue
    const reqs = t.requires ?? []
    if (reqs.length === 0 || reqs.some((r) => seen.has(r))) { seen.add(t.id); changed = true }
  }
}
const unreachable = TALENTS.filter((t) => !seen.has(t.id)).map((t) => `${t.id} (${t.name})`)

// 2b) unlockPower pointant vers un sort inexistant
const badPowers = []
for (const t of TALENTS) {
  if (t.unlockPower && !powerIds.has(t.unlockPower)) badPowers.push(`${t.id} "${t.name}" → sort "${t.unlockPower}" (inexistant)`)
}

console.log(`Total nœuds : ${TALENTS.length}`)
console.log(`IDs dupliqués : ${dupes.length ? dupes.join(', ') : 'aucun'}`)
console.log(`Références requires cassées : ${broken.length}`)
for (const b of broken) console.log(`  ✗ ${b.node} "${b.name}" → requiert "${b.missing}" (inexistant)`)
console.log(`Nœuds inaccessibles depuis le Cœur : ${unreachable.length}`)
for (const u of unreachable) console.log(`  ✗ ${u}`)
console.log(`unlockPower vers un sort inexistant : ${badPowers.length}`)
for (const b of badPowers) console.log(`  ✗ ${b}`)

// 3) Vérifie le cas signalé : Os d'acier II → Peau de pierre
const osII = TALENTS.find((t) => t.name === "Os d'acier II")
if (osII) {
  const reqNames = (osII.requires ?? []).map((r) => byId.get(r)?.name ?? `??(${r})`)
  console.log(`\n"Os d'acier II" (${osII.id}) requiert : ${reqNames.join(', ')}`)
}
