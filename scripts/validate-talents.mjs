import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// BUNDLE (résout ./classData & efface les import type ./types) puis import dynamique.
// v0.29.1 : talents.ts & powers.ts importent classData.ts → il faut bundler, pas juste transpiler.
const load = async (rel) => {
  const res = await build({
    entryPoints: [fileURLToPath(new URL(rel, import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  })
  const js = res.outputFiles[0].text
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

// 1) requires (+ requiresAll + requiresRank.id) pointant vers un id inexistant
const broken = []
for (const t of TALENTS) {
  for (const r of [...(t.requires ?? []), ...(t.requiresAll ?? [])]) {
    if (!byId.has(r)) broken.push({ node: t.id, name: t.name, missing: r })
  }
  if (t.requiresRank && !byId.has(t.requiresRank.id)) broken.push({ node: t.id, name: t.name, missing: t.requiresRank.id })
}

// 2) accessibilité depuis les RACINES (mêmes arêtes que le moteur : requires).
//    v0.33 : deux arbres → deux racines (Cœur = base, Panthéon = classes débloquées par l'Éveil).
const ROOTS = ['co_start', 'pa_start']
const seen = new Set(ROOTS)
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
