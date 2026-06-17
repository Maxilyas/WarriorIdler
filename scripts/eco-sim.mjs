// Harnais ÉCONOMIQUE (refonte v0.35) — mappe le RENDEMENT des donjons (par devise) contre le COÛT de
// TOUS les puits d'optimisation, sur la courbe v0.35. Règle : un run au niveau de farm ≈ quelques
// actions d'optimisation (jamais des milliers). Vrai code via esbuild ; seuls le marché (2 formules
// triviales) et xpForLevel sont reflétés inline (dans store.ts, lourd à importer — zustand).
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { createCost, ascendCost, surillvlCost, reforgeCost, transmuteCost, contentRarityTier } from './src/game/items.ts'
  export { dungeonRunYield, geodeDustYield, dungeonFights } from './src/game/dungeons.ts'
  export { GEM_CUT_COST, recutCost, GEM_FUSE_COST, GEM_CORRUPT_COST, drillCost } from './src/game/condGems.ts'
  export { unsocketCost } from './src/game/gems.ts'
  export { enchantCost, runeForgeCost, ENCHANTS } from './src/game/enchants.ts'
  export { lootFarmIlvl } from './src/game/progression.ts'
  export { RARITIES, RARITY_LIST } from './src/game/rarities.ts'
`)

// --- reflets inline de store.ts (formules triviales — gardés synchro à la main) ---
const shopBuyPrice = (item) => Math.round(item.ilvl * Math.pow(M.RARITIES[item.rarity].tier, 2.6) * 1.5)
const shopRefreshCost = (bestStage) => Math.round(500 + bestStage * 60)
const xpForLevel = (level) => { const x = level - 1; return Math.round(560 * Math.exp(0.105 * x + 0.00055 * x * x)) }

const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const REF_LEVEL = 5 // niveau de donjon « de farm » représentatif (≈ plafond confortable). Knob d'affichage.
const TIME_RUNE = M.ENCHANTS.find((e) => e.time) // rune la moins chère à graver/forger
// « actions par run » : combien d'optimisations un run finance. Bande saine ≈ 0,3 à 8.
const ratio = (yield_, cost) => cost > 0 ? yield_ / cost : Infinity
const band = (r) => r >= 0.3 && r <= 8 ? '✅' : (r < 0.3 ? '❌ trop peu' : '❌ trop')
const line = (label, y, cost, unit) => console.log(`    ${label.padEnd(26)} coût ${fmt(cost).padStart(8)} ${unit} → ${ratio(y, cost).toFixed(2).padStart(6)} /run ${band(ratio(y, cost))}`)

console.log('================= HARNAIS ÉCO v0.35 — rendement donjon vs TOUS les puits =================')
console.log(`Run de référence : donjon niveau ${REF_LEVEL}. « /run » = nb d'actions qu'un run finance (bande saine 0,3–8).\n`)

for (const best of [10, 30, 60, 100, 200]) {
  const ilvl = M.lootFarmIlvl(best)
  const tier = 6 // Légendaire : la pièce qu'on optimise à ce stade
  const item = { ilvl, rarity: M.RARITY_LIST.find((r) => r.tier === tier).id }
  console.log(`========== bestStage ${best} · tranche ilvl ${ilvl} · pièce de réf Légendaire(t${tier}) ==========`)

  // 🪙 OR — Chambre du Trésor
  const gold = M.dungeonRunYield('gold', REF_LEVEL)
  console.log(`  🪙 OR (Chambre du Trésor) — rendement/run ${fmt(gold)}`)
  line('marché : acheter 1 objet', gold, shopBuyPrice(item), 'or')
  line('marché : rafraîchir', gold, shopRefreshCost(best), 'or')
  line('percer une châsse (or)', gold, M.drillCost(tier).gold, 'or')
  line('forge runique (or)', gold, M.runeForgeCost(TIME_RUNE, 0).gold, 'or')

  // ♦ ÉCLATS — Faille Arcanique (+ recyclage)
  const ct = M.contentRarityTier(best)
  const ecl = M.dungeonRunYield('eclats', REF_LEVEL)
  const runsFor = (cost) => (cost / ecl).toFixed(cost / ecl >= 10 ? 0 : 1)
  console.log(`  ♦ ÉCLATS (Faille Arcanique) — rendement/run ${fmt(ecl)} · rareté du contenu = t${ct}`)
  // CHASE de rareté (forge AU-DESSUS du contenu) — en RUNS par craft (doit exploser ×4/cran) :
  for (const d of [0, 1, 2, 3]) {
    const cost = M.createCost(ct + d, ilvl, ct).eclats
    console.log(`    forge t${ct + d} (${d === 0 ? 'contenu' : '+' + d + ' au-dessus'})`.padEnd(30) + ` ${fmt(cost).padStart(9)} ♦ → ${runsFor(cost).padStart(6)} runs/craft`)
  }
  // Routines en-tranche (actions par run) :
  line('reforge (affixe sec.)', ecl, M.reforgeCost(item, 0), '♦')
  line('surilvl (1 pas)', ecl, M.surillvlCost(item, 0), '♦')
  line('désertir une gemme', ecl, M.unsocketCost(), '♦')
  line('graver une rune', ecl, M.enchantCost(TIME_RUNE, item).eclats, '♦')
  line('transmutation', ecl, M.transmuteCost(item), '♦')

  // 💠 NOYAU — Forge du Noyau
  const noy = M.dungeonRunYield('noyau', REF_LEVEL)
  console.log(`  💠 NOYAU (Forge du Noyau) — rendement/run ${fmt(noy)}`)
  line('forge : créer 1 objet', noy, M.createCost(tier, ilvl).noyau, '💠')
  line('ascension (cran +1)', noy, M.ascendCost(item).noyau, '💠')

  // 🌌 POUSSIÈRE D'ÉTOILE — Observatoire
  const pous = M.dungeonRunYield('poussiere', REF_LEVEL)
  console.log(`  🌌 POUSSIÈRE D'ÉTOILE (Observatoire) — rendement/run ${fmt(pous)}`)
  line('forge : créer 1 objet', pous, M.createCost(tier, ilvl).poussiere ?? 0, '🌌')
  line('graver une rune', pous, M.enchantCost(TIME_RUNE, item).poussiere, '🌌')
  line('forge runique', pous, M.runeForgeCost(TIME_RUNE, 0).poussiere, '🌌')

  // 🔹 POUSSIÈRE DE GEMME — Géode
  const gd = M.geodeDustYield(REF_LEVEL)
  console.log(`  🔹 POUSSIÈRE DE GEMME (Géode) — rendement/run ${fmt(gd)}`)
  line('tailler une gemme', gd, M.GEM_CUT_COST, '🔹')
  line('recouper (rang+)', gd, M.recutCost(2), '🔹')
  line('fusionner', gd, M.GEM_FUSE_COST, '🔹')
  line('corrompre', gd, M.GEM_CORRUPT_COST, '🔹')
  line('percer une châsse (poussière)', gd, M.drillCost(tier).dust, '🔹')

  // ⭐ XP — Sanctuaire du Savoir (rendement xp non dans DUNGEON_YIELD → coût de niveau affiché seul)
  console.log(`  ⭐ XP (Sanctuaire) — coût d'un niveau ≈ ${fmt(xpForLevel(Math.max(2, Math.round(best / 4))))} (niv ~${Math.round(best / 4)}) · rendement à mapper sur le run`)
  console.log('')
}
console.log('NB : Fragments ✨ / Éclat cosmique 💫 = devises de RAID (pas de donjon) → forge haute rareté + runes/pactes.')
