// OPTIMISEUR D'ÉQUIPE — construit la FRONTIÈRE (meilleur build atteignable) par bande, en RESPECTANT le
// pool de talents PARTAGÉ. Recherche STAGÉE (l'éval = sim de raid fidèle, ~1-2 s → on évite l'explosion) :
//   1) CLASSES par rôle  (quel DPS ? quel heal ?)   — split fixe
//   2) SPLIT du pool partagé (hill-climbing, asymétrique)  — sur la meilleure compo
//   3) BALAYAGE de bandes (Ch.5 → endgame)  — avec compo+split gagnants → courbe de frontière
// Arbres alloués gloutonnement via le vrai canAllocate (toujours valides). Sert de FRONTIÈRE à comparer
// au MÉDIAN des vraies saves (bench-diff). Le joueur reprend le code WIB1 dans le Simulateur.
//
//   node scripts/optimize-build.mjs            → recherche complète, écrit optimized.txt
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

const RAIDS = ['forge', 'reliquaire', 'citadelle', 'nexus']
const UNIQ = SIM_UNIQUES.map((u) => u.id)
const SURVIE = ['bouclier_runique', 'second_souffle'] // survie garantie pour tank/dps

/* ---- Allocateur glouton VALIDE, borné au budget (part du pool PARTAGÉ). ---- */
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
  return talents
}

/* ---- Pouvoirs : dégâts en ACTIF d'abord, puis soins (cas healer) ; soutien = survie garantie + soins. ---- */
function pickPowers(talents, wantSupport) {
  const defs = computeUnlockedPowers(talents).map((id) => ({ id, p: getPower(id) })).filter((x) => x.p)
  const dmg = defs.filter((x) => x.p.kind === 'active' && !isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const supEff = defs.filter((x) => isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const builders = defs.filter((x) => isBuilder(x.p))
  const pass = defs.filter((x) => x.p.kind === 'passive').sort((a, b) => (b.p.threatMult ?? 1) - (a.p.threatMult ?? 1) || (b.p.damageReduction ?? 0) - (a.p.damageReduction ?? 0))
  const support = []
  for (const id of wantSupport) if (supEff.some((x) => x.id === id) && support.length < SUPPORT_SLOTS) support.push(id)
  for (const x of [...supEff, ...builders]) if (!support.includes(x.id) && support.length < SUPPORT_SLOTS) support.push(x.id)
  const powers = []
  for (const x of [...dmg, ...supEff]) if (!powers.includes(x.id) && !support.includes(x.id) && powers.length < POWER_SLOTS) powers.push(x.id)
  return { powers, support, passives: pass.slice(0, PASSIVE_SLOTS).map((x) => x.id) }
}

/* ---- Stuff par rôle. ---- */
const LINES = {
  tank: [{ k: 'stat', id: 'reductionDegats' }, { k: 'stat', id: 'resilience' }, { k: 'stat', id: 'barriere' }, { k: 'stat', id: 'maitrise' }, { k: 'resist', id: 'physique' }, { k: 'resist', id: 'feu' }, { k: 'stat', id: 'penetration' }],
  dps: [{ k: 'stat', id: 'maitrise' }, { k: 'stat', id: 'critique' }, { k: 'stat', id: 'degatsCrit' }, { k: 'stat', id: 'hate' }, { k: 'stat', id: 'penetration' }, { k: 'stat', id: 'degatsBoss' }],
  heal: [{ k: 'stat', id: 'maitrise' }, { k: 'stat', id: 'reductionDegats' }, { k: 'stat', id: 'resilience' }, { k: 'stat', id: 'recuperation' }, { k: 'stat', id: 'barriere' }],
}
const ORIENT = { tank: 'defensif', dps: 'offensif', heal: 'equilibre' }
const GEMS = { tank: ['sixieme', 'riposte'], dps: ['overkill', 'tambour'], heal: ['perfusion', 'tresorerie'] }
function gearFor(role) {
  const g = initGear(ORIENT[role])
  Object.keys(g).forEach((sid, i) => { g[sid] = { ...g[sid], stars: 5, lines: LINES[role], gems: GEMS[role], gemRank: 10, unique: UNIQ[i % UNIQ.length], uniqueRank: 10 } })
  return g
}

/* ---- Construit un membre (rôle + classe) avec une part `frac` du pool partagé. ---- */
// Le heal se CONCENTRE sur sa spec de soin (pas les specs dps de la classe) → soins, pas Vide/dps.
const HEAL_CONS = { pretre: ['coeur', 'pretre', 'lumiere'], druide: ['coeur', 'druide', 'floraison'] }
function makeMember(role, cls, level, frac, total) {
  const budget = Math.round(total * frac)
  const cons = role === 'heal' ? (HEAL_CONS[cls] ?? CLASS_CONSTELLATIONS[cls]) : (CLASS_CONSTELLATIONS[cls] ?? ['coeur'])
  const talents = allocate(cons, budget)
  const pw = pickPowers(talents, role === 'heal' ? [] : SURVIE) // heal : pickPowers remplit auto avec ses soins
  return { name: `${role}/${cls}`, cls, level, orientation: ORIENT[role], primary: getClassPreset(cls).primary,
    gems: [], runes: [], gear: gearFor(role), talents, powers: pw.powers, support: pw.support, passives: pw.passives }
}
const spentOf = (t) => Object.values(t.talents).reduce((x, y) => x + y, 0) - 1

function evalTeam(team, ilvl, rarity, stage) {
  const base = { ilvl, rarity, bestStage: stage, elixir: 'elixirPuissance', team }
  const tiers = {}; let sum = 0
  for (const id of RAIDS) { const o = runSim({ ...base, content: { kind: 'raid', id, tier: 1, scan: true } }).outcome; tiers[id] = o.maxReached; sum += o.maxReached }
  return { tiers, sum, cfg: { ...base, content: { kind: 'raid', id: 'forge', tier: 1, scan: true } } }
}
const buildTeam = (comp, level, fracs) => {
  const total = talentPointsForLevel(level)
  return comp.map((m, i) => makeMember(m.role, m.cls, level, fracs[i], total))
}

/* ====================================================================== */
/* RECHERCHE STAGÉE                                                       */
/* ====================================================================== */
const out = []; const log = (s) => { out.push(s); console.log(s) }
const TANK = 'guerrier', DPS_OPTS = ['mage', 'voleur', 'chasseur'], HEAL_OPTS = ['pretre', 'druide']
const SPLITS = [[0.34, 0.33, 0.33], [0.40, 0.40, 0.20], [0.45, 0.35, 0.20], [0.35, 0.45, 0.20], [0.50, 0.30, 0.20], [0.30, 0.50, 0.20], [0.45, 0.30, 0.25]]
const LV_META = 110, ST_META = 110, RAR_META = 'ascendant'
const ilvlMeta = stageIlvl(ST_META)

log('=== OPTIMISEUR D\'ÉQUIPE — recherche stagée (classes → split → bandes) ===')
log(`Pool de talents PARTAGÉ. Tank = ${TANK}. DPS ∈ {${DPS_OPTS}} · Heal ∈ {${HEAL_OPTS}}.\n`)

/* 1) CLASSES (split fixe 40/40/20) */
log(`── 1) Meilleure compo (niv ${LV_META} · ${RAR_META} ⭐5 · split 40/40/20) ──`)
let bestComp = null
for (const dps of DPS_OPTS) for (const heal of HEAL_OPTS) {
  const comp = [{ role: 'tank', cls: TANK }, { role: 'dps', cls: dps }, { role: 'heal', cls: heal }]
  const team = buildTeam(comp, LV_META, [0.40, 0.40, 0.20])
  const ev = evalTeam(team, ilvlMeta, RAR_META, ST_META)
  log(`  ${TANK}+${dps}+${heal} → ${RAIDS.map((id) => `${id[0].toUpperCase()}${ev.tiers[id]}`).join(' ')} · Σ${ev.sum}`)
  if (!bestComp || ev.sum > bestComp.ev.sum) bestComp = { comp, ev }
}
log(`  ★ compo : ${bestComp.comp.map((m) => m.cls).join(' + ')}\n`)

/* 2) SPLIT (sur la meilleure compo) */
log(`── 2) Meilleur split du pool partagé ──`)
let bestSplit = null
for (const fr of SPLITS) {
  const team = buildTeam(bestComp.comp, LV_META, fr)
  const ev = evalTeam(team, ilvlMeta, RAR_META, ST_META)
  const spent = team.reduce((a, t) => a + spentOf(t), 0)
  log(`  ${fr.map((f) => Math.round(f * 100)).join('/')}% → pts ${spent}/${talentPointsForLevel(LV_META)} · ${RAIDS.map((id) => `${id[0].toUpperCase()}${ev.tiers[id]}`).join(' ')} · Σ${ev.sum}`)
  if (!bestSplit || ev.sum > bestSplit.ev.sum) bestSplit = { fr, ev, team }
}
log(`  ★ split : ${bestSplit.fr.map((f) => Math.round(f * 100)).join('/')}%\n`)

/* 3) BANDES (compo+split gagnants) → courbe de frontière */
const BANDS = [{ stage: 50, level: 46, rarity: 'artefact' }, { stage: 80, level: 74, rarity: 'mythique' }, { stage: 110, level: 110, rarity: 'ascendant' }]
log('── 3) FRONTIÈRE par bande (compo + split gagnants) ──')
const codes = []
for (const b of BANDS) {
  const team = buildTeam(bestComp.comp, b.level, bestSplit.fr)
  const ev = evalTeam(team, stageIlvl(b.stage), b.rarity, b.stage)
  log(`  Ch.${Math.ceil(b.stage / 10)} · niv ${b.level} · ${b.rarity} ⭐5 (pool ${talentPointsForLevel(b.level)}) → ${RAIDS.map((id) => `${id} T${ev.tiers[id]}`).join(' · ')}`)
  codes.push(`# ${bestComp.comp.map((m) => m.cls).join('+')} · Ch.${Math.ceil(b.stage / 10)} ${b.rarity} niv ${b.level}\n${encodeBuild(ev.cfg)}`)
}

/* Détail de la meilleure équipe (bande méta) */
log(`\n★ Équipe de référence (Ch.${Math.ceil(ST_META / 10)}) :`)
for (const t of bestSplit.team) {
  log(`  ${t.name.padEnd(14)} ${spentOf(t)} pts · actifs: ${t.powers.map((id) => getPower(id)?.name).join(', ')}`)
  log(`  ${' '.repeat(14)} soutien: ${t.support.map((id) => getPower(id)?.name).join(', ') || '—'}`)
}
out.push('\n=== Codes WIB1 (à charger dans le Simulateur) ===', ...codes)
writeFileSync('optimized.txt', out.join('\n'))
console.log('\n(détails + codes WIB1 écrits dans optimized.txt)')
