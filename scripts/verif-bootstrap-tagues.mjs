// VÉRIF — pacing du BOOTSTRAP donjon : un joueur qui farme les donjons récupère-t-il des uniques
// TAGGÉS (et de la résist) AVANT de raider (T1 = Chapitre 5) ? Modèle ANALYTIQUE (pas de RNG) bâti
// sur le VRAI code : fenêtre de rareté de la Cache (cacheRarityWindow + windowRarityDist), table de
// drop d'unique (rollUnique : chance = (rt-4)·0.14, gating tier≥5) et TAGGED_DROP_RATE (donjon 5%).
//   node scripts/verif-bootstrap-tagues.mjs
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { cacheRarityWindow, butinOverChance, butinOverTier, BUTIN_RARITY_CAP } from './src/game/dungeons.ts'
  export { windowRarityDist } from './src/game/items.ts'
  export { TAGGED_DROP_RATE, PLAIN_UNIQUES, TAGGED_UNIQUES } from './src/game/uniques.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
const { cacheRarityWindow, butinOverChance, windowRarityDist, TAGGED_DROP_RATE, PLAIN_UNIQUES, TAGGED_UNIQUES, RARITY_LIST } = M

const BUTIN_OVER_TIER = 8 // voile = Patrimoine (cf. BUTIN_OVER_WEIGHTS)
const DUNGEON_RATE = TAGGED_DROP_RATE.dungeon
const RAID_RATE = TAGGED_DROP_RATE.raid
const pUnique = (rt) => rt < 5 ? 0 : Math.min(1, (rt - 4) * 0.14)
const pad = (s, n) => String(s).padStart(n)
const rarName = (t) => RARITY_LIST.find((r) => r.tier === t)?.name ?? `t${t}`

// Nb d'objets que crache la Cache au coffre pour un niveau (droite 1→5, +1 tous les 3 niveaux).
const cacheCount = (lv) => Math.max(1, Math.min(5, 1 + Math.floor((lv - 1) / 3)))

// Distribution de rareté d'UN objet de Cache au niveau lv (voile inclus).
function itemTierDist(lv) {
  const cw = cacheRarityWindow(lv)
  const over = butinOverChance(lv)
  const dist = windowRarityDist(cw.floor, cw.peak, cw.cap, cw.shoulder != null ? { shoulder: cw.shoulder } : undefined)
  const map = new Map()
  for (const { tier, p } of dist) map.set(tier, (map.get(tier) ?? 0) + p * (1 - over))
  map.set(BUTIN_OVER_TIER, (map.get(BUTIN_OVER_TIER) ?? 0) + over)
  return map
}

// Espérance d'uniques (tout court) et de TAGGÉS par OBJET, puis par RUN.
function perRun(lv, rate) {
  const dist = itemTierDist(lv)
  let eUniq = 0, eTag = 0, pAnyT5 = 0
  for (const [rt, p] of dist) { const pu = pUnique(rt); eUniq += p * pu; eTag += p * pu * rate; if (rt >= 5) pAnyT5 += p }
  const n = cacheCount(lv)
  return { count: n, pAnyT5, eUniqRun: eUniq * n, eTagRun: eTag * n }
}

console.log('=== BOOTSTRAP donjon — la Cache du Pilleur seed-t-elle des uniques TAGGÉS avant le raid ? ===')
console.log('Cache débloquée Chapitre 2 (unlockStage 12) · 1er raid T1 = Chapitre 5 · uniques gating tier≥5 (Épique)')
console.log('TAGGED_DROP_RATE : donjon = ' + (DUNGEON_RATE * 100) + '%  ·  raid = ' + (RAID_RATE * 100) + '%  (fraction des uniques issus du pool taggé)')
console.log('Pool : ' + PLAIN_UNIQUES.length + ' simples · ' + TAGGED_UNIQUES.length + ' taggés\n')
console.log('Niv | pic/cap rareté        | obj/run | P(obj ≥ Épique) | uniques/run | TAGGÉS/run | runs → 1er taggé')
for (let lv = 1; lv <= 10; lv++) {
  const cw = cacheRarityWindow(lv)
  const r = perRun(lv, DUNGEON_RATE)
  const runsTo = r.eTagRun > 0 ? Math.round(1 / r.eTagRun) : Infinity
  console.log(
    `${pad(lv, 3)} | ${pad(rarName(cw.peak) + '/' + rarName(cw.cap), 21)} | ${pad(r.count, 7)} | ${pad((r.pAnyT5 * 100).toFixed(1) + '%', 15)} | ` +
    `${pad(r.eUniqRun.toFixed(3), 11)} | ${pad(r.eTagRun.toFixed(4), 10)} | ${pad(runsTo === Infinity ? '∞' : runsTo, 14)}`,
  )
}

// Comparatif : combien de drops d'un PREMIER raid (T1) pour le même 1er taggé (rate 30%) ?
console.log('\n=== Référence RAID (T1) — un drop de raid à 30% taggé, supposé Patrimoine(t8) garanti unique ? ===')
console.log('(le raid droppe minStars élevé + uniqueSource raid ; à tier≥7 P(unique) sature vite)')
for (const rt of [6, 7, 8]) {
  const pu = pUnique(rt)
  const eTag = pu * RAID_RATE
  console.log(`  objet ${rarName(rt)}(t${rt}) : P(unique)=${(pu * 100).toFixed(0)}% · P(taggé)=${(eTag * 100).toFixed(1)}% → ${eTag > 0 ? Math.round(1 / eTag) : '∞'} objets/1er taggé`)
}

console.log('\n--- Lecture ---')
console.log('• « runs → 1er taggé » = espérance de runs de Cache pour décrocher UN unique taggé (≈ 1/taux).')
console.log('• La RÉSIST n\'est PAS gatée : c\'est une LIGNE d\'objet (affixe) + gemmes, craftable/reforgeable dès le Ch.1.')
console.log('  Le bootstrap ne concerne donc QUE les uniques TAGGÉS (synergie de tags = pouvoir build-defining).')
