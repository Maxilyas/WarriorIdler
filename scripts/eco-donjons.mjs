// Analyse éco des DONJONS : difficulté vs murs + drop par niveau vs coût de craft accessible.
// Utilise le VRAI code (esbuild). Lancer : node scripts/eco-donjons.mjs
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { setGlobalCombatMods } from './src/game/character.ts'
  export { frontierIlvl, lootFarmIlvl, CHAPITRE_SIZE, ILVL_CAP_BASE, ILVL_CAP_ENDGAME } from './src/game/progression.ts'
  export { makeEnemy } from './src/game/enemies.ts'
  export { DUNGEONS, dungeonContentIlvl, dungeonIlvl, dungeonRunYield, geodeDustYield, makeDungeonEnemy, dungeonFights } from './src/game/dungeons.ts'
  export { createCost, contentRarityTier, overContentMult } from './src/game/items.ts'
  export { RARITIES, RARITY_LIST } from './src/game/rarities.ts'
`)
M.setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })
const { frontierIlvl, lootFarmIlvl, CHAPITRE_SIZE, makeEnemy, DUNGEONS, dungeonContentIlvl, dungeonRunYield, geodeDustYield, makeDungeonEnemy, dungeonFights, createCost, contentRarityTier, RARITY_LIST } = M

const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+'Md' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'k' : Math.round(n).toString()
const rarName = (t) => (RARITY_LIST.find((r) => r.tier === t)?.name ?? `t${t}`)
const pad = (s, n) => String(s).padStart(n)

// Murs de chapitre (boss de la vague 10 du Chapitre C) — référence de difficulté.
const murHp = (C) => makeEnemy(C * CHAPITRE_SIZE, 'physique').maxHp
console.log('=== MURS de chapitre (boss vague 10) — référence de difficulté ===')
console.log('Chap | frontière ilvl | PV mur')
for (let C = 1; C <= 17; C++) console.log(`${pad(C,4)} | ${pad(frontierIlvl(C*10),14)} | ${pad(fmt(murHp(C)),8)}`)

// Boss d'un donjon de niveau N (dernier combat).
function dungBossHp(id, N) {
  const def = DUNGEONS[id]
  const tf = dungeonFights(N)
  return makeDungeonEnemy(def, N, tf - 1, tf, [], N * CHAPITRE_SIZE).maxHp
}

// Coût d'un craft de rareté R à l'ilvl/contenu d'un niveau de donjon, en NB DE RUNS.
function runsToCraft(reward, N, R) {
  const ilvl = lootFarmIlvl(N * CHAPITRE_SIZE)
  const ct = contentRarityTier(N * CHAPITRE_SIZE)
  const cost = createCost(R, ilvl, ct)
  const per = dungeonRunYield(reward, N)
  const need = reward === 'eclats' ? cost.eclats : reward === 'noyau' ? cost.noyau : reward === 'poussiere' ? (cost.poussiere ?? 0) : 0
  return per > 0 && need > 0 ? need / per : Infinity
}

function analyse(id, reward, label) {
  const def = DUNGEONS[id]
  console.log(`\n=== ${def.icon} ${def.name} — ${label} (trait « ${def.trait} », déblocage Chapitre ${Math.ceil(def.unlockStage/10)}) ===`)
  console.log('Niv | diff ilvl | PV boss | vs mur(N-1) | ct contenu | ' + (reward==='gemmes'?'🔹/run':reward+'/run') + ' | runs: contenu / +1 / +2 / +3')
  for (let N = 1; N <= 17; N++) {
    const ilvl = lootFarmIlvl(N * CHAPITRE_SIZE)
    const ct = contentRarityTier(N * CHAPITRE_SIZE)
    const diff = dungeonContentIlvl(N)
    const hp = dungBossHp(id, N)
    const vsPrev = N >= 2 ? (hp / murHp(N - 1)) : (hp / murHp(1))
    const per = reward === 'gemmes' ? geodeDustYield(N) : dungeonRunYield(reward, N)
    let runsStr = '—'
    if (reward !== 'gemmes') {
      const r0 = runsToCraft(reward, N, ct)
      const r1 = runsToCraft(reward, N, ct + 1)
      const r2 = runsToCraft(reward, N, ct + 2)
      const r3 = runsToCraft(reward, N, ct + 3)
      const f = (r) => r === Infinity ? '∞' : r >= 1000 ? fmt(r) : Math.round(r)
      runsStr = `${f(r0)} / ${f(r1)} / ${f(r2)} / ${f(r3)}`
    }
    console.log(`${pad(N,3)} | ${pad(diff,9)} | ${pad(fmt(hp),7)} | ${pad('×'+vsPrev.toFixed(2),11)} | ${pad(rarName(ct)+'(t'+ct+')',12)} | ${pad(fmt(per),7)} | ${runsStr}`)
  }
}

analyse('eclats', 'eclats', 'ÉCLATS d\'arcane')
analyse('noyau', 'noyau', 'NOYAUX primordiaux')
analyse('geode', 'gemmes', 'POUSSIÈRE de gemmes')
analyse('poussiere', 'poussiere', 'POUSSIÈRE d\'étoile')

console.log('\nLecture : « vs mur(N-1) » < 1 = le boss du donjon niv N est PLUS FAIBLE que le mur du chapitre N-1 (objectif : faisable).')
console.log('« runs: contenu/+1/+2/+3 » = nb de runs pour s\'offrir un craft de la rareté du contenu, ou +1/+2/+3 crans au-dessus (over-content ×4/cran).')
console.log(`Rappel : la rareté « contenu » du donjon est capée à Légendaire (t6, FARM_RARITY_CAP). Artefact=t7, Patrimoine=t8 … Céleste=t11.`)
