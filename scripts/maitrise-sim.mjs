// Harnais de couverture du 🏛️ CONSEIL DES MAÎTRISES — l'arbre de progression de compte time-gaté.
// Vérifie surtout le COUPLAGE à deux fichiers (la doc le signale comme fragile) : chaque nœud déclaré
// dans maitrise.ts doit être CÂBLÉ dans computeGlobalMods (upgrades.ts), et le %/rang AFFICHÉ doit
// correspondre au coefficient réellement appliqué par le moteur. Quantifie aussi l'effet total (tout
// maxé) et la cadence time-gate (points/semaine → semaines pour tout maxer).
// Utilise le VRAI code (transpilé via esbuild) — pas de copie de règles, donc pas de dérive.
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { MAITRISE_NODES, MAITRISE_TOTAL_POINTS, CONTRACTS, WEEK_MS } from './src/game/maitrise.ts'
  export { computeGlobalMods } from './src/game/upgrades.ts'
`)
const { MAITRISE_NODES, MAITRISE_TOTAL_POINTS, CONTRACTS, WEEK_MS, computeGlobalMods } = M

let errors = 0
const fail = (m) => { errors++; console.log('  ✗ ' + m) }
const pct = (n) => (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%'

// Champs numériques de GlobalMods (pour differ l'effet d'un nœud).
const G0 = computeGlobalMods({})
const FIELDS = Object.keys(G0).filter((k) => typeof G0[k] === 'number')
// Diff GlobalMods entre maîtrise vide et { id: rank } → champ(s) touché(s) et delta.
function effectOf(id, rank) {
  const g = computeGlobalMods({}, { [id]: rank })
  const moved = FIELDS.map((f) => ({ f, d: g[f] - G0[f] })).filter((x) => Math.abs(x.d) > 1e-12)
  return moved
}

/* ====================================================================== */
/* 1) Intégrité + câblage display ↔ moteur                               */
/* ====================================================================== */
console.log('=== 1) Câblage des nœuds (maitrise.ts ↔ computeGlobalMods) ===')
const seen = new Set()
for (const n of MAITRISE_NODES) {
  if (seen.has(n.id)) fail(`id dupliqué : ${n.id}`)
  seen.add(n.id)
  if (!(n.maxRank > 0)) fail(`${n.id} : maxRank invalide (${n.maxRank})`)
  if (!(n.perRank > 0)) fail(`${n.id} : perRank invalide (${n.perRank})`)
  // CÂBLAGE : un nœud non branché dans computeGlobalMods ne fait RIEN (bonus mort).
  const eff = effectOf(n.id, 1)
  if (eff.length === 0) { fail(`${n.id} : aucun effet sur GlobalMods → nœud non câblé dans computeGlobalMods (bonus mort)`); continue }
  // COHÉRENCE display↔moteur : le %/rang affiché doit égaler le delta réel (champ principal).
  const main = eff.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a))
  const moteurPerRank = main.d * 100 // delta à 1 rang = coefficient (champs linéaires en rang)
  const ok = Math.abs(moteurPerRank - n.perRank) < 1e-6
  if (!ok) fail(`${n.id} : %/rang AFFICHÉ ${n.perRank} ≠ MOTEUR ${moteurPerRank.toFixed(3)} (sur ${main.f}) — dérive display/moteur`)
  console.log(`  ${ok ? '✓' : '✗'} ${n.icon} ${n.id.padEnd(9)} ${main.f.padEnd(11)} ${String(n.perRank).padStart(4)}%/rang × ${n.maxRank} rangs`)
}
console.log(`  ${MAITRISE_NODES.length} nœuds · ${errors} erreur(s) de câblage.\n`)

/* ====================================================================== */
/* 2) Effet total (tout maxé) — doit rester « minime, jamais décisif »   */
/* ====================================================================== */
console.log('=== 2) Effet du Conseil entièrement maxé ===')
const maxAll = {}
for (const n of MAITRISE_NODES) maxAll[n.id] = n.maxRank
const gMax = computeGlobalMods({}, maxAll)
for (const f of FIELDS) {
  const d = gMax[f] - G0[f]
  if (Math.abs(d) > 1e-9) console.log(`  ${f.padEnd(12)} ${G0[f].toFixed(2)} → ${gMax[f].toFixed(2)}  (${pct(d)})`)
}
// Agrégat « combat » multiplicatif (puissance × vitesse × vitalité) = le gain de puissance brut.
const combat = (gMax.power * gMax.attackSpeed * gMax.vitality) / (G0.power * G0.attackSpeed * G0.vitality) - 1
console.log(`  → Gain de combat agrégé (power × attackSpeed × vitality) : ${pct(combat)} tout maxé.\n`)

/* ====================================================================== */
/* 3) Cadence time-gate (contrats hebdo)                                 */
/* ====================================================================== */
console.log('=== 3) Cadence time-gate ===')
const ptsPerWeek = CONTRACTS.length // 1 Point de Maîtrise par contrat rempli
const weeksToMax = Math.ceil(MAITRISE_TOTAL_POINTS / ptsPerWeek)
const weekDays = WEEK_MS / (24 * 3600 * 1000)
if (weekDays !== 7) fail(`WEEK_MS ≠ 7 jours (${weekDays})`)
console.log(`  ${MAITRISE_TOTAL_POINTS} points pour tout maxer · ${ptsPerWeek} contrats/sem (${CONTRACTS.map((c) => `${c.icon}${c.need}`).join(' ')})`)
console.log(`  → ${ptsPerWeek} Points/semaine max → ~${weeksToMax} semaines pleines (fenêtre = ${weekDays} j).\n`)

console.log(`=== Bilan : ${errors} erreur(s). ===`)
if (errors > 0) process.exit(1)
console.log('✓ Conseil des Maîtrises cohérent (tous les nœuds câblés, display ↔ moteur alignés).')
