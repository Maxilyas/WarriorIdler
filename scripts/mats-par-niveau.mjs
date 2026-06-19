// Rendement par run de CHAQUE donjon de matériau, indexé sur la rareté ACCESSIBLE (Cache+raids) par chapitre.
// node scripts/mats-par-niveau.mjs
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { lootFarmIlvl, CHAPITRE_SIZE } from './src/game/progression.ts'
  export { createCost } from './src/game/items.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
const { lootFarmIlvl, CHAPITRE_SIZE, createCost, RARITY_LIST } = M
const rarName = (t) => (RARITY_LIST.find((r) => r.tier === t)?.name ?? `t${t}`)
const pad = (s, n) => String(s).padStart(n)
const f = (n) => n.toLocaleString('fr-FR')
const CRAFT_RUNS_TARGET = 10

// FONCTION PROPOSÉE : rareté accessible (Cache plafond Artefact + raids gatés par Chapitre).
function ct(ch) {
  if (ch <= 4) return 7
  if (ch <= 8) return 3 + ch
  return Math.min(14, 11 + Math.floor((ch - 8) / 2))
}

const MATS = [
  ['eclats',    'Éclats d\'arcane ♦  (Faille Arcanique)'],
  ['noyau',     'Noyaux primordiaux 💠  (Forge du Noyau)'],
  ['poussiere', 'Poussière d\'étoile 🌌  (Observatoire Stellaire)'],
  ['fragments', 'Fragments d\'éternité ✨  (≥ t8 → dès Chapitre 5)'],
  ['cosmic',    'Éclats cosmiques 💫  (≥ t13 → dès Chapitre 12)'],
]

for (const [mat, title] of MATS) {
  console.log(`\n=== ${title} ===`)
  console.log('Niv | ilvl | rareté contenu     | coût craft (' + mat + ') | /run')
  for (let N = 1; N <= 15; N++) {
    const ilvl = lootFarmIlvl(N * CHAPITRE_SIZE)
    const ctN = ct(N)
    const cost = createCost(ctN, ilvl, ctN)[mat] ?? 0
    const perRun = cost > 0 ? Math.max(1, Math.round(cost / CRAFT_RUNS_TARGET)) : 0
    console.log(`${pad(N,3)} | ${pad(ilvl,4)} | ${pad(rarName(ctN)+` (t${ctN})`,18)} | ${pad(cost>0?f(cost):'—',20)} | ${pad(perRun>0?f(perRun):'—',8)}`)
  }
}
