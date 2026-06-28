// OPTIMISEUR D'ÉQUIPE — construit le MEILLEUR build atteignable par bande/compo, en RESPECTANT le pool
// de talents PARTAGÉ (le bug de gen-optimized : chaque perso prenait le plein budget). Approche :
// construction gloutonne (canAllocate → arbres toujours valides) + HILL-CLIMBING du SPLIT du pool sur
// l'équipe (asymétrique). Fitness = somme des tiers max clearés sur les 4 raids (clear DANS l'enrage =
// la condition de victoire de runSim). Sert de FRONTIÈRE pour l'équilibrage (à comparer au médian des
// vraies saves). Le joueur reprend le résultat dans le Simulateur (code WIB1).
//
//   node scripts/optimize-build.mjs            → optimise la compo par défaut, écrit optimized.txt
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { encodeBuild } from './src/game/buildCode.ts'
  export { runSim, initGear, SIM_UNIQUES, CLASS_CONSTELLATIONS, getClassPreset } from './src/game/simulator.ts'
  export { talentsByConstellation, canAllocate } from './src/game/talents.ts'
  export { computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel } from './src/game/character.ts'
  export { SUPPORT_SLOTS, PASSIVE_SLOTS } from './src/game/character.ts'
  export { getPower, POWER_SLOTS } from './src/game/powers.ts'
  export { stageIlvl } from './src/game/enemies.ts'
`)
const { encodeBuild, runSim, initGear, SIM_UNIQUES, CLASS_CONSTELLATIONS, getClassPreset,
  talentsByConstellation, canAllocate, computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel,
  SUPPORT_SLOTS, PASSIVE_SLOTS, getPower, POWER_SLOTS, stageIlvl } = M

/* ---- Allocateur glouton VALIDE, borné à un budget (part du pool partagé). ---- */
function allocate(consList, budget) {
  const talents = { co_start: 1 }
  const pool = consList.flatMap((c) => talentsByConstellation(c))
  let pts = budget
  for (let guard = 0; guard < 5000 && pts > 0; guard++) {
    const cands = pool.filter((n) => canAllocate(n, talents, pts)).sort((a, b) => a.tier - b.tier)
    if (!cands.length) break
    let any = false
    for (const n of cands) { if (pts <= 0) break; if (!canAllocate(n, talents, pts)) continue; talents[n.id] = (talents[n.id] ?? 0) + 1; pts -= 1; any = true }
    if (!any) break
  }
  return { talents, spent: budget - pts }
}

/* ---- Pouvoirs depuis l'arbre. Dégâts en ACTIF d'abord ; si reste de place (healer), on remplit avec
 *      les soins (multi-lane : un soin va en actif ET en soutien). `wantSupport` = survie garantie. ---- */
function pickPowers(talents, wantSupport = []) {
  const defs = computeUnlockedPowers(talents).map((id) => ({ id, p: getPower(id) })).filter((x) => x.p)
  const dmg = defs.filter((x) => x.p.kind === 'active' && !isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const supEff = defs.filter((x) => isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const builders = defs.filter((x) => isBuilder(x.p))
  const pass = defs.filter((x) => x.p.kind === 'passive').sort((a, b) => (b.p.threatMult ?? 1) - (a.p.threatMult ?? 1) || (b.p.damageReduction ?? 0) - (a.p.damageReduction ?? 0))
  const support = []
  for (const id of wantSupport) if (supEff.some((x) => x.id === id) && support.length < SUPPORT_SLOTS) support.push(id)
  for (const x of [...supEff, ...builders]) if (!support.includes(x.id) && support.length < SUPPORT_SLOTS) support.push(x.id)
  const powers = []
  for (const x of [...dmg, ...supEff]) if (!powers.includes(x.id) && powers.length < POWER_SLOTS) powers.push(x.id)
  return { powers, support, passives: pass.slice(0, PASSIVE_SLOTS).map((x) => x.id) }
}

/* ---- Stuff par rôle : tank def+résist · dps offensif · heal def+récup (soin scale INT = primaire). ---- */
const LINES = {
  tank: [{ k: 'stat', id: 'reductionDegats' }, { k: 'stat', id: 'resilience' }, { k: 'stat', id: 'barriere' }, { k: 'stat', id: 'maitrise' }, { k: 'resist', id: 'physique' }, { k: 'resist', id: 'feu' }, { k: 'stat', id: 'penetration' }],
  dps: [{ k: 'stat', id: 'maitrise' }, { k: 'stat', id: 'critique' }, { k: 'stat', id: 'degatsCrit' }, { k: 'stat', id: 'hate' }, { k: 'stat', id: 'penetration' }, { k: 'stat', id: 'degatsBoss' }],
  heal: [{ k: 'stat', id: 'maitrise' }, { k: 'stat', id: 'reductionDegats' }, { k: 'stat', id: 'resilience' }, { k: 'stat', id: 'recuperation' }, { k: 'stat', id: 'barriere' }],
}
const ORIENT = { tank: 'defensif', dps: 'offensif', heal: 'equilibre' }
const GEMS = { tank: ['sixieme', 'riposte'], dps: ['overkill', 'tambour'], heal: ['perfusion', 'tresorerie'] }
function gearFor(role, uniques) {
  const g = initGear(ORIENT[role])
  Object.keys(g).forEach((sid, i) => { g[sid] = { ...g[sid], stars: 5, lines: LINES[role], gems: GEMS[role], gemRank: 10, unique: uniques[i % uniques.length], uniqueRank: 10 } })
  return g
}

/* ---- Compo (rôle → classe). Toutes les classes de base sont disponibles ; ici une trinité. ---- */
const COMP = [
  { role: 'tank', cls: 'guerrier', cons: ['coeur', 'guerrier', 'rempart', 'sentence', 'juggernaut', 'furie'], want: ['bouclier_runique', 'second_souffle'], primary: 'force' },
  { role: 'dps', cls: 'mage', cons: ['coeur', 'mage', 'pyromancien', 'arcaniste', 'cryomancien'], want: ['bouclier_runique', 'second_souffle'], primary: 'intelligence' },
  { role: 'heal', cls: 'pretre', cons: ['coeur', 'pretre', 'lumiere'], want: ['lu_aube', 'lu_soin', 'lu_renouveau', 'bouclier_runique'], primary: 'intelligence' },
]
const UNIQ = SIM_UNIQUES.map((u) => u.id)
const RAIDS = ['forge', 'reliquaire', 'citadelle', 'nexus']

function buildTeam(level, ilvl, splitFracs) {
  const total = talentPointsForLevel(level)
  return COMP.map((m, i) => {
    const budget = Math.round(total * splitFracs[i])
    const { talents } = allocate(m.cons, budget)
    const pw = pickPowers(talents, m.want)
    return { name: `${m.role}/${m.cls}`, cls: m.cls, level, orientation: ORIENT[m.role], primary: m.primary,
      gems: [], runes: [], gear: gearFor(m.role, UNIQ), talents, powers: pw.powers, support: pw.support, passives: pw.passives }
  })
}

function evalTeam(team, ilvl, rarity, stage) {
  const cfg = { ilvl, rarity, bestStage: stage, elixir: 'elixirPuissance', team, content: { kind: 'raid', id: 'forge', tier: 1, scan: true } }
  const tiers = {}
  let sum = 0
  for (const id of RAIDS) { const o = runSim({ ...cfg, content: { kind: 'raid', id, tier: 1, scan: true } }).outcome; tiers[id] = o.maxReached; sum += o.maxReached }
  return { tiers, sum, cfg }
}

/* ====================================================================== */
/* HILL-CLIMBING du SPLIT du pool partagé                                 */
/* ====================================================================== */
const LEVEL = 110
const STAGE = 110
const RARITY = 'ascendant'
const ilvl = stageIlvl(STAGE)
// Splits candidats (somme = 1) — tank / dps / heal. Le pool est PARTAGÉ : la somme des points alloués
// ne dépasse jamais talentPointsForLevel(LEVEL).
const SPLITS = [
  [0.34, 0.33, 0.33], [0.45, 0.35, 0.20], [0.35, 0.45, 0.20], [0.40, 0.40, 0.20],
  [0.50, 0.30, 0.20], [0.30, 0.50, 0.20], [0.45, 0.30, 0.25],
]

const out = []
const log = (s) => { out.push(s); console.log(s) }
log('=== OPTIMISEUR D\'ÉQUIPE — pool de talents PARTAGÉ (hill-climbing du split) ===')
log(`Compo : ${COMP.map((m) => `${m.role}/${m.cls}`).join(' + ')} · niv ${LEVEL} · ilvl ${ilvl} · ${RARITY} ⭐5`)
log(`Pool de talents PARTAGÉ : ${talentPointsForLevel(LEVEL)} points pour TOUTE l'équipe\n`)

let best = null
for (const fr of SPLITS) {
  const team = buildTeam(LEVEL, ilvl, fr)
  const ev = evalTeam(team, ilvl, RARITY, STAGE)
  const spent = team.reduce((a, t) => a + (Object.values(t.talents).reduce((x, y) => x + y, 0) - 1), 0)
  log(`  split ${fr.map((f) => Math.round(f * 100)).join('/')}% → points ${spent}/${talentPointsForLevel(LEVEL)} · tiers ${RAIDS.map((id) => `${id[0].toUpperCase()}${ev.tiers[id]}`).join(' ')} · Σ${ev.sum}`)
  if (!best || ev.sum > best.ev.sum) best = { fr, team, ev }
}

log(`\n★ MEILLEUR split : ${best.fr.map((f) => Math.round(f * 100)).join('/')}%`)
for (const t of best.team) {
  const spent = Object.values(t.talents).reduce((x, y) => x + y, 0) - 1
  log(`  ${t.name.padEnd(14)} ${spent} pts · actifs: ${t.powers.map((id) => getPower(id)?.name).join(', ')}`)
  log(`  ${' '.repeat(14)} soutien: ${t.support.map((id) => getPower(id)?.name).join(', ')} · passifs: ${t.passives.map((id) => getPower(id)?.name).join(', ')}`)
}
log(`  Tiers clearés : ${RAIDS.map((id) => `${id} T${best.ev.tiers[id]}`).join(' · ')}`)
out.push('\n=== Code WIB1 d\'équipe (à charger dans le Simulateur) ===', encodeBuild(best.ev.cfg))
writeFileSync('optimized.txt', out.join('\n'))
console.log('\n(détails + code WIB1 écrits dans optimized.txt)')
