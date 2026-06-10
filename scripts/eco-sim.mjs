// Harnais ÉCONOMIQUE : rendement d'un run de donjon (par ressource) vs coût d'un craft à la
// progression correspondante. Sert à mapper donjons ↔ atelier/forge/marché. Vrai code via esbuild.
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { dungeonRunYield, DUNGEONS } from './src/game/dungeons.ts'
  export { createCost, ascendCost, reforgeCost, surillvlCost, maxCraftTier } from './src/game/items.ts'
  export { stageIlvl } from './src/game/enemies.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
const { dungeonRunYield, DUNGEONS, createCost, ascendCost, reforgeCost, maxCraftTier, stageIlvl, RARITY_LIST } = M

// Rendement par run = vraie fonction du jeu (par-combat + coffre).
const runYield = (def, lv) => dungeonRunYield(def.reward, lv)

const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : Math.round(n).toString()
// Tier de rareté « de référence » qu'on craft quand on farme un donjon de niveau lv (≈ progression).
const tierFor = (lv) => Math.min(16, 5 + Math.round(lv * 0.6))
const ilvlFor = (lv) => stageIlvl(lv * 4) // un donjon niv lv ≈ palier de farm ~4×lv

console.log('=== Rendement donjon / run vs coût de craft (réf : créer 1 objet de rareté liée au niveau) ===\n')
for (const [id, def] of Object.entries(DUNGEONS)) {
  if (!['gold', 'eclats', 'noyau', 'poussiere'].includes(def.reward)) continue
  console.log(`--- ${def.name} (ressource: ${def.reward}) ---`)
  for (const lv of [1, 5, 10, 15, 20]) {
    const y = runYield(def, lv)
    const tier = tierFor(lv); const ilvl = ilvlFor(lv)
    const cc = createCost(tier, ilvl)
    const costOfRes = def.reward === 'gold' ? null
      : def.reward === 'eclats' ? cc.eclats
      : def.reward === 'noyau' ? cc.noyau
      : cc.poussiere ?? 0
    const ratio = costOfRes ? (y / costOfRes) : null
    const rname = RARITY_LIST.find((r) => r.tier === tier)?.name ?? '?'
    console.log(`  Niv ${String(lv).padStart(2)} : rendement/run = ${fmt(y).padStart(7)} ${def.reward}` +
      (costOfRes != null ? `   | craft ${rname}(t${tier}) coûte ${fmt(costOfRes)} ${def.reward} → ${ratio.toFixed(2)} craft/run` : ''))
  }
  console.log('')
}

// Coûts d'atelier (modif) de référence (en éclats), par rareté à ilvl 120.
console.log('=== Coûts ATELIER (éclats) à ilvl 120 ===')
for (const t of [6, 9, 12, 16]) {
  const item = { ilvl: 120, rarity: RARITY_LIST.find((r) => r.tier === t).id }
  console.log(`  t${t} ${RARITY_LIST.find(r=>r.tier===t).name.padEnd(12)} reforge=${fmt(reforgeCost(item))}  ascend.éclats=${fmt(ascendCost(item).eclats)}  ascend.noyau=${fmt(ascendCost(item).noyau)}`)
}
