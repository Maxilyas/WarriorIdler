// Banc d'essai des BUILDS DE RÉFÉRENCE (src/game/referenceBuilds.ts) — compare chaque build dans les
// MÊMES conditions, via le MÊME moteur que l'écran Simulateur (`runSim`). C'est la « centralisation des
// tests d'équilibrage » : un build ajouté au catalogue est testé ici ET chargeable en jeu.
//   node scripts/builds-bench.mjs   (alias : npm run bench)
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { runSim } from './src/game/simulator.ts'
  export { REFERENCE_BUILDS } from './src/game/referenceBuilds.ts'
  export { setGlobalCombatMods } from './src/game/character.ts'
`)
const { runSim, REFERENCE_BUILDS, setGlobalCombatMods } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 }) // baseline neutre (pas d'upgrades de compte)

const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

const ct = REFERENCE_BUILDS[0]?.config?.content
console.log('=== Banc d\'essai des builds de référence (vrai moteur via runSim) ===')
console.log(`Contenu : ${ct?.kind === 'raid' ? 'raid' : 'donjon'} « ${ct?.id} » · ${ct?.scan ? 'scan du max' : 'tier ' + ct?.tier} · iLvl ${REFERENCE_BUILDS[0]?.config?.ilvl} ${REFERENCE_BUILDS[0]?.config?.rarity}\n`)
console.log('Build                      Max     DPS équipe   EHP min   Mur (qui tombe)')

const rows = []
for (const b of REFERENCE_BUILDS) {
  const r = runSim(b.config)
  const o = r.outcome
  const max = o.scanned ? `${r.unit}${o.maxReached}` : (o.win ? 'OK' : 'KO')
  const dps = r.members.reduce((a, m) => a + m.dps, 0)
  const ehpMin = Math.min(...r.members.map((m) => m.ehp))
  const wall = o.firstDead ? `${o.firstDead}@${o.firstT.toFixed(0)}s/${o.bossLeftPct.toFixed(0)}%` : (o.wallAt > 0 ? `enrage/${o.bossLeftPct.toFixed(0)}%` : '—')
  rows.push({ name: b.name, max, maxN: o.maxReached, dps, ehpMin, wall })
  console.log(`${b.name.padEnd(26)} ${String(max).padStart(4)}   ${fmt(dps).padStart(9)}   ${fmt(ehpMin).padStart(7)}   ${wall}`)
}

// Lecture d'équilibrage : dispersion du tier max atteint entre builds.
const maxes = rows.map((r) => r.maxN).filter((n) => n > 0)
if (maxes.length) {
  const hi = Math.max(...maxes), lo = Math.min(...maxes)
  const top = rows.find((r) => r.maxN === hi).name, bot = rows.find((r) => r.maxN === lo).name
  console.log(`\n→ Écart de contenu franchi : ${rows[0].max[0]}${lo} → ${rows[0].max[0]}${hi}  (top « ${top} » / bottom « ${bot} »). Un grand écart = builds déséquilibrés.`)
}
console.log('(Ajoute des builds dans src/game/referenceBuilds.ts — ils sont aussi chargeables en jeu via le Catalogue.)')
