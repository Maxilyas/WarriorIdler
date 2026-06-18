// Vérif v0.36 : (A) PV des boss de raid montent à CHAQUE tier (plus de plateau) · (B) table de loot
// de la Cache du Pilleur (count + ilvl=bestStage + distribution de rareté). Lancer : node scripts/verif-v036-raids-cache.mjs
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { setGlobalCombatMods } from './src/game/character.ts'
  export { lootFarmIlvl, frontierIlvl } from './src/game/progression.ts'
  export { RAIDS, raidIlvl, raidDifficultyIlvl, makeRaidBoss } from './src/game/raids.ts'
  export { cacheRarityWindow, BUTIN_RARITY_CAP } from './src/game/dungeons.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
M.setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })
const { lootFarmIlvl, RAIDS, raidIlvl, raidDifficultyIlvl, makeRaidBoss, cacheRarityWindow, BUTIN_RARITY_CAP, RARITY_LIST } = M

const fmt = (n) => n >= 1e12 ? (n/1e12).toFixed(2)+'T' : n >= 1e9 ? (n/1e9).toFixed(2)+'Md' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'k' : Math.round(n).toString()
const rarName = (t) => (RARITY_LIST.find((r) => r.tier === t)?.name ?? `t${t}`)
const pad = (s, n) => String(s).padStart(n)

// ---------- (A) RAIDS : ilvl loot (capé) vs ilvl difficulté (non capé) + PV boss par tier ----------
const def = RAIDS.forge
console.log(`=== (A) RAID « ${def.name} » : ilvl loot (capé 200) vs ilvl DIFFICULTÉ (non capé) + PV boss ===`)
console.log('Tier | ilvl loot | ilvl diff | PV boss        | × PV vs tier préc.')
let prevHp = 0
for (const T of [1, 2, 3, 5, 7, 10, 12, 14, 16, 18, 20, 25, 30]) {
  const loot = raidIlvl(def, T)
  const diff = raidDifficultyIlvl(def, T)
  const hp = makeRaidBoss(def, T, 'physique', 0, 1).maxHp
  const ratio = prevHp > 0 ? (hp / prevHp) : 0
  console.log(`${pad(T,4)} | ${pad(loot,9)} | ${pad(diff,9)} | ${pad(fmt(hp),14)} | ${ratio ? '×'+ratio.toFixed(2) : '—'}`)
  prevHp = hp
}
console.log('  → si les PV continuent de monter à chaque tier (× > 1), le plateau est corrigé.')

// ---------- (B) CACHE DU PILLEUR : count + ilvl + distribution de rareté par niveau ----------
// Distribution analytique de rollWindowRarity (mêmes pentes par défaut : down/shoulder/tail = .30/.30/.25).
function dist(floor, peak, cap) {
  const down = 0.30, shoulder = 0.30, tail = 0.25
  const lo = Math.max(1, Math.min(16, Math.round(floor)))
  const hi = Math.max(lo, Math.min(16, Math.round(cap)))
  const pk = Math.max(lo, Math.min(hi, Math.round(peak)))
  const w = []
  for (let t = lo; t <= hi; t++) w.push([t, t <= pk ? Math.pow(down, pk - t) : shoulder * Math.pow(tail, t - pk - 1)])
  const tot = w.reduce((a, [, x]) => a + x, 0)
  return w.map(([t, x]) => [t, x / tot])
}
const pct = (p) => p >= 0.10 ? (p*100).toFixed(0)+'%' : p >= 0.01 ? (p*100).toFixed(1)+'%' : p >= 0.0001 ? (p*100).toFixed(2)+'%' : '~0'

const bestStage = 170 // exemple : joueur Chapitre 17 (≈ ce qu'il décrit) → ilvl loot identique à tous les niveaux
console.log(`\n=== (B) CACHE DU PILLEUR — joueur bestStage=${bestStage} (ilvl loot = lootFarmIlvl = ${lootFarmIlvl(bestStage)}, IDENTIQUE à tous les niveaux) ===`)
console.log('Niv | count | plancher | rareté la plus probable → traîne (P artefact t7)')
for (let N = 1; N <= 15; N++) {
  const cw = cacheRarityWindow(N)
  const count = Math.max(1, Math.min(8, 1 + Math.floor((N - 1) / 2)))
  const d = dist(cw.floor, cw.peak, cw.cap)
  const top = [...d].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, p]) => `${rarName(t)} ${pct(p)}`).join(' · ')
  const pArt = d.find(([t]) => t === 7)?.[1] ?? 0
  console.log(`${pad(N,3)} | ${pad(count,5)} | ${pad(rarName(cw.floor),9)} | ${top}   ⟶ Artefact ${pct(pArt)}`)
}
console.log('  → count 1-3 (bas) → 5-8 (haut) ; Artefact reste une TRAÎNE rare (~5% au sommet, jamais le gros du butin).')
