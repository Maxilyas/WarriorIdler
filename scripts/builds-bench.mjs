// Banc d'essai des BUILDS — catalogue de référence (src/game/referenceBuilds.ts) + catalogue
// COMMUNAUTAIRE (src/game/communityBuilds.json, alimenté par les soumissions GitHub). Compare chaque
// build dans les MÊMES conditions, via le MÊME moteur que l'écran Simulateur (`runSim`), et dégage des
// TENDANCES (sorts sous-utilisés). C'est la « centralisation des tests d'équilibrage ».
//   node scripts/builds-bench.mjs   (alias : npm run bench)
import { build } from 'esbuild'
import fs from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { runSim, getClassPreset } from './src/game/simulator.ts'
  export { REFERENCE_BUILDS } from './src/game/referenceBuilds.ts'
  export { decodeBuild } from './src/game/buildCode.ts'
  export { setGlobalCombatMods } from './src/game/character.ts'
  export { POWERS, getPower } from './src/game/powers.ts'
`)
const { runSim, getClassPreset, REFERENCE_BUILDS, decodeBuild, setGlobalCombatMods, POWERS, getPower } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 }) // baseline neutre (pas d'upgrades de compte)

const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

// Catalogue COMMUNAUTAIRE : décodage des codes soumis → configs (ignore les codes invalides).
let community = []
try { community = JSON.parse(fs.readFileSync('src/game/communityBuilds.json', 'utf-8')) } catch { /* pas de catalogue */ }
const communityBuilds = community
  .map((b) => ({ name: b.name + (b.by ? ` (${b.by})` : ''), config: decodeBuild(b.code), source: '🌍' }))
  .filter((b) => b.config)

const ALL = [
  ...REFERENCE_BUILDS.map((b) => ({ name: b.name, config: b.config, source: '📚' })),
  ...communityBuilds,
]

const ct = ALL[0]?.config?.content
console.log('=== Banc d\'essai des builds (référence + communautaire, vrai moteur via runSim) ===')
console.log(`Référence : ${REFERENCE_BUILDS.length} · Communauté : ${communityBuilds.length}${community.length > communityBuilds.length ? ` (${community.length - communityBuilds.length} code(s) invalide(s) ignoré(s))` : ''}`)
console.log(`Contenu du 1ᵉʳ build : ${ct?.kind === 'raid' ? 'raid' : 'donjon'} « ${ct?.id} » · ${ct?.scan ? 'scan du max' : 'tier ' + ct?.tier}\n`)
console.log('   Build                          Max     DPS équipe   EHP min   Mur (qui tombe)')

const rows = []
for (const b of ALL) {
  const r = runSim(b.config)
  const o = r.outcome
  const max = o.scanned ? `${r.unit}${o.maxReached}` : (o.win ? 'OK' : 'KO')
  const dps = r.members.reduce((a, m) => a + m.dps, 0)
  const ehpMin = Math.min(...r.members.map((m) => m.ehp))
  const wall = o.firstDead ? `${o.firstDead}@${o.firstT.toFixed(0)}s/${o.bossLeftPct.toFixed(0)}%` : (o.wallAt > 0 ? `enrage/${o.bossLeftPct.toFixed(0)}%` : '—')
  rows.push({ name: b.name, max, maxN: o.maxReached, dps, ehpMin, wall })
  console.log(`${b.source} ${b.name.padEnd(30).slice(0, 30)} ${String(max).padStart(4)}   ${fmt(dps).padStart(9)}   ${fmt(ehpMin).padStart(7)}   ${wall}`)
}

// Lecture d'équilibrage : dispersion du tier max atteint entre builds.
const maxes = rows.map((r) => r.maxN).filter((n) => n > 0)
if (maxes.length) {
  const hi = Math.max(...maxes), lo = Math.min(...maxes)
  const top = rows.find((r) => r.maxN === hi).name, bot = rows.find((r) => r.maxN === lo).name
  console.log(`\n→ Écart de contenu franchi : ${rows[0].max[0]}${lo} → ${rows[0].max[0]}${hi}  (top « ${top} » / bottom « ${bot} »). Un grand écart = builds déséquilibrés.`)
}

// TENDANCES — usage des CAPACITÉS ACTIVES sur tout le catalogue (référence + communauté).
// Met en évidence les sorts JAMAIS choisis (candidats « sous-utilisés / à revoir »).
const equippedActives = (cfg) => cfg.team.flatMap((m) => {
  const list = m.imported ? (m.imported.powers ?? []) : (m.powers ?? getClassPreset(m.cls).powers ?? [])
  return list.filter(Boolean)
})
const activeIds = new Set(POWERS.filter((p) => p.kind === 'active').map((p) => p.id))
const uses = new Map([...activeIds].map((id) => [id, 0]))
for (const b of ALL) for (const id of equippedActives(b.config)) if (uses.has(id)) uses.set(id, uses.get(id) + 1)

const used = [...uses.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
const unused = [...uses.entries()].filter(([, n]) => n === 0).map(([id]) => getPower(id)?.name ?? id)
console.log(`\n=== Tendances — capacités actives (sur ${ALL.length} build(s)) ===`)
console.log(`Top utilisées : ${used.slice(0, 8).map(([id, n]) => `${getPower(id)?.name ?? id}×${n}`).join(' · ') || '—'}`)
console.log(`Sorts JAMAIS choisis (${unused.length}/${activeIds.size}) : ${unused.slice(0, 24).join(', ')}${unused.length > 24 ? ` … (+${unused.length - 24})` : ''}`)
console.log('\n(Soumets des builds en jeu : Simulateur → 🔗 Partager → 🚀 Soumettre. Ils enrichissent ce banc.)')
