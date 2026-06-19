// Vérif Abîme (2 tiers, 220/240, frag/cosmic boostés, rareté T10+traîne) + fix plafond surilvl. node scripts/verif-abime.mjs
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { RAIDS, raidIlvl, raidDifficultyIlvl, raidRarityWindow, raidFragments, raidCosmicQty, raidTierCap } from './src/game/raids.ts'
  export { stageIlvl } from './src/game/enemies.ts'
  export { SURILLVL_OVER_MARGIN } from './src/game/items.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
const { RAIDS, raidIlvl, raidDifficultyIlvl, raidRarityWindow, raidFragments, raidCosmicQty, raidTierCap, stageIlvl, SURILLVL_OVER_MARGIN, RARITY_LIST } = M
const rarName = (t) => (RARITY_LIST.find((r) => r.tier === t)?.name ?? `t${t}`)
const pad = (s, n) => String(s).padStart(n)
const pct = (p) => p >= 0.10 ? (p*100).toFixed(0)+'%' : p >= 0.01 ? (p*100).toFixed(1)+'%' : p >= 0.0001 ? (p*100).toFixed(2)+'%' : '~0'

function dist(floor, peak, cap, tail = 0.25, down = 0.30, shoulder = 0.30) {
  const lo = Math.round(floor), hi = Math.round(cap), pk = Math.round(peak), w = []
  for (let t = lo; t <= hi; t++) w.push([t, t <= pk ? Math.pow(down, pk - t) : shoulder * Math.pow(tail, t - pk - 1)])
  const tot = w.reduce((a, [, x]) => a + x, 0)
  return w.map(([t, x]) => [t, x / tot])
}

const ab = RAIDS.abysse, forge = RAIDS.forge
console.log(`=== ABÎME : cap de tiers = ${raidTierCap(ab)} (base = ${raidTierCap(forge)}) ===`)
console.log('Tier | loot ilvl | diff ilvl | ✨ frag | 💫 cosm | fenêtre rareté')
for (let T = 1; T <= 2; T++) {
  const w = raidRarityWindow(ab, T)
  console.log(`${pad(T,4)} | ${pad(raidIlvl(ab,T),9)} | ${pad(raidDifficultyIlvl(ab,T),9)} | ${pad(raidFragments(ab,T),6)} | ${pad(raidCosmicQty(ab,T),6)} | ${rarName(w.floor)}→${rarName(w.cap)} (pic ${rarName(w.peak)})`)
}
console.log(`\nRappel raids de base T10 : loot ${raidIlvl(forge,10)} · diff ${raidDifficultyIlvl(forge,10)} · ✨ ${raidFragments(forge,10)} · 💫 ${raidCosmicQty(forge,10)}`)

console.log('\n=== Rareté Abîme vs raid T10 de base (chance Primordial t15 / Transcendant t16 par objet) ===')
// v0.40.2 — formes réelles (cf. store.ts) : Abîme down0.78/shoulder0.20/tail0.10 ; base down0.30/shoulder0.15/tail0.12.
const wA = raidRarityWindow(ab, 1), dAb = dist(wA.floor, wA.peak, wA.cap, 0.10, 0.78, 0.20)
const wB = raidRarityWindow(forge, 10), dBase = dist(wB.floor, wB.peak, wB.cap, 0.12, 0.30, 0.15)
const p = (d, t) => d.find(([x]) => x === t)?.[1] ?? 0
console.log(`Abîme (39/50/10/1) : Primordial ${pct(p(dAb,15))} · Transcendant ${pct(p(dAb,16))}`)
console.log(`Base T10 (traîne resserrée): Primordial ${pct(p(dBase,15))} · Transcendant ${pct(p(dBase,16))}`)

console.log('\n=== FIX surilvl : plafond = maxContentIlvl + marge', SURILLVL_OVER_MARGIN, '===')
const maxContent = (bestStage, prog) => {
  let best = stageIlvl(Math.max(1, bestStage))
  for (const id of ['forge','reliquaire','citadelle','nexus','abysse']) {
    const t = prog[id] ?? 0
    if (t >= 1) best = Math.max(best, raidIlvl(RAIDS[id], t))
  }
  return best
}
const cas = [
  ['Ch.17, aucun raid', 170, {}],
  ['Ch.17, base T10 (pas d\'Abîme)', 170, { forge:10, reliquaire:10, citadelle:10, nexus:10 }],
  ['Ch.17, Abîme T1', 170, { forge:10, reliquaire:10, citadelle:10, nexus:10, abysse:1 }],
  ['Ch.17, Abîme T2', 170, { forge:10, reliquaire:10, citadelle:10, nexus:10, abysse:2 }],
]
for (const [label, bs, prog] of cas) {
  const c = maxContent(bs, prog)
  console.log(`${pad(label,32)} | contenu ${pad(c,3)} | surilvl max ${c + SURILLVL_OVER_MARGIN}`)
}
