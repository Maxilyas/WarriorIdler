// AUDIT DE PUISSANCE DES RARETÉS — pour chaque rareté R (1-16), à une ÉPOQUE de référence FIXE (niveau+ilvl),
// un build dont TOUTES les pièces sont de rareté R (SANS unique, pour ISOLER l'effet rareté) pousse la
// FRONTIÈRE de raid le plus haut possible (GA mode frontière, moteur durci scripts/lib/ga-engine.mjs).
// → on lit la « valeur en tiers de raid » d'un cran de rareté, croisée au chapitre d'ACQUISITION de R :
//   « cette rareté est-elle trop forte pour le moment où on l'obtient ? ». Cf. docs/DIFFICULTE.md §2 (snowball borné).
//
//   node scripts/rarity-frontier.mjs [raid=forge] [tierEpoque=6]   (tierEpoque fixe l'ère : stage=(t+4)×10)
import { writeFileSync } from 'node:fs'
import { loadGame, makeEngine } from './lib/ga-engine.mjs'

const REF_RAID = process.argv[2] || 'forge'
const REF_TIER = Number(process.argv[3] || 6) // fixe l'ÉPOQUE (stage=(6+4)×10=100 → Ch.10) ; la frontière sweep les tiers
const GA = { islands: 3, pop: 22, elite: 4, tourney: 4, mut: 0.4, immigrants: 2, migrateEvery: 6, stallGens: 16, maxGens: 500, samples: 7, mode: 'frontier' }

// Chapitre d'ACQUISITION par tier de rareté (table analytique, depuis contentRarityTier/raidReach).
const ACQ = { 1: 'Ch.1', 2: 'Ch.1', 3: 'Ch.1', 4: 'Ch.2', 5: 'Ch.3', 6: 'Ch.4', 7: 'Ch.5', 8: 'Ch.5', 9: 'Ch.5', 10: 'Ch.5', 11: 'Ch.5', 12: 'Ch.7', 13: 'Ch.9', 14: 'Ch.11', 15: 'chase', 16: 'chase' }

const M = await loadGame()
const E = makeEngine(M)
const out = []; const log = (s) => { out.push(s); console.log(s) }
const epochStage = (REF_TIER + 4) * 10
log(`=== AUDIT PUISSANCE DES RARETÉS — frontière de raid sur ${REF_RAID}, époque FIXE Ch.${epochStage / 10} ===`)
log('(toutes pièces = rareté R, SANS unique → effet rareté ISOLÉ ; GA frontière jusqu\'à convergence)\n')
log('  Rareté          tier affix  acquisition   frontière (tier max poussé)   évals')

const t0 = Date.now()
const rows = []
for (const r of E.RARITY_LIST) {
  const ctx = E.ctxFor(REF_RAID, REF_TIER, { unconstrained: true })
  ctx.caps.rarityMin = ctx.caps.rarityMax = r.tier   // FORCE toutes les pièces à cette rareté
  ctx.caps.uniqueChance = 0; ctx.caps.uniquePool = [] // pas d'unique → on mesure la RARETÉ seule
  const res = E.runGA(ctx, GA)
  const tier = Math.floor(res.best.f)
  const prog = Math.round((res.best.f - tier) / 0.9 * 100)
  rows.push({ r, tier, prog, evals: res.evals })
  log(`  ${r.name.padEnd(14)} t${String(r.tier).padStart(2)}  ${String(r.affixCount).padStart(2)}    ${ACQ[r.tier].padEnd(8)}      T${tier} (${prog}% vers T${tier + 1})${''.padEnd(8 - String(tier).length)}     ${res.evals}`)
}

log(`\nTemps total : ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min.`)
// Saut de frontière par cran (la "valeur en tiers de raid" d'un cran de rareté).
log('\nValeur d\'un cran de rareté (Δ frontière) :')
for (let i = 1; i < rows.length; i++) {
  const d = rows[i].tier - rows[i - 1].tier
  if (d !== 0) log(`  ${rows[i - 1].r.name} → ${rows[i].r.name} : ${d > 0 ? '+' : ''}${d} tier(s)`)
}
log('\nLecture : si une rareté pousse BEAUCOUP plus haut que le tier que son chapitre d\'acquisition gate')
log(`(Ch.${epochStage / 10} ↔ raid T${REF_TIER}), elle "saute des tiers" → snowball à surveiller (seuil doctrine ×1.8/fenêtre).`)
writeFileSync('rarity-frontier.txt', out.join('\n'))
console.log('\n(écrit dans rarity-frontier.txt)')
