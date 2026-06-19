// Vérif que donjons + raids suivent la courbe validée (vraies fonctions du jeu). node scripts/verif-mats-courbe.mjs
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { dungeonRunYield } from './src/game/dungeons.ts'
  export { RAIDS, raidFragments, raidCosmicQty, globalTier } from './src/game/raids.ts'
  export { accessibleRarityTier } from './src/game/items.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
const { dungeonRunYield, RAIDS, raidFragments, raidCosmicQty, globalTier, accessibleRarityTier, RARITY_LIST } = M
const rarName = (t) => (RARITY_LIST.find((r) => r.tier === t)?.name ?? `t${t}`)
const pad = (s, n) => String(s).padStart(n)

console.log('=== DONJONS de matériaux (dungeonRunYield réel) par niveau ===')
console.log('Niv | rareté acc.       | ♦ éclats | 💠 noyau | 🌌 pouss.')
for (let N = 1; N <= 15; N++) {
  console.log(`${pad(N,3)} | ${pad(rarName(accessibleRarityTier(N))+` (t${accessibleRarityTier(N)})`,17)} | ${pad(dungeonRunYield('eclats',N),8)} | ${pad(dungeonRunYield('noyau',N),8)} | ${pad(dungeonRunYield('poussiere',N),8)}`)
}

console.log('\n=== RAIDS de base (globalTier = tier) : ✨ fragments + 💫 cosmiques par clear ===')
console.log('Tier | GT | Chap.(GT+4) | rareté acc.        | ✨ frag | 💫 cosm')
const forge = RAIDS.forge
for (let T = 1; T <= 11; T++) {
  const gt = globalTier(forge, T), ch = gt + 4
  console.log(`${pad(T,4)} | ${pad(gt,2)} | ${pad(ch,11)} | ${pad(rarName(accessibleRarityTier(ch))+` (t${accessibleRarityTier(ch)})`,18)} | ${pad(raidFragments(forge,T),6)} | ${pad(raidCosmicQty(forge,T),6)}`)
}

console.log('\n=== Abîme (tierOffset +6) : ✨ fragments + 💫 cosmiques par clear ===')
console.log('Tier | GT | Chap.(GT+4) | ✨ frag | 💫 cosm')
const ab = RAIDS.abysse
for (let T = 1; T <= 10; T++) {
  const gt = globalTier(ab, T), ch = gt + 4
  console.log(`${pad(T,4)} | ${pad(gt,2)} | ${pad(ch,11)} | ${pad(raidFragments(ab,T),6)} | ${pad(raidCosmicQty(ab,T),6)}`)
}
