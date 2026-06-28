// ALGORITHME GÉNÉTIQUE — fait CONVERGER une équipe aléatoire vers le meilleur build pour battre un
// (raid, tier) donné, sous les contraintes de l'époque (niveau/ilvl/rareté) + pool de talents PARTAGÉ +
// mods de compte RÉALISTES. Explore TOUS les systèmes :
//  - taille d'équipe (1-3) ;
//  - CROSS-CLASS TOTAL : un perso pioche dans N'IMPORTE quelles specs (guerrier + prêtre, etc.) — les
//    catégories d'armure ne sont PAS exclusives ; l'allocateur paie les prérequis cat/cl tout seul ;
//  - répartition du pool partagé, stat primaire, et le STUFF (rareté/⭐/stats/résist/uniques/gemmes).
// Arbres toujours VALIDES (canAllocate). Fitness CONTINUE (progrès vers le kill) → gradient. Via runSim.
//
// MODS DE COMPTE (C3) : `ecoFor(stage)` calé sur la RÉALITÉ — le Marché est vidé de sa puissance ; seuls
// la Forge stellaire (gated prestige) et 3 nœuds de Maîtrise (frappe/célérité/vigueur, coeffs minimes)
// portent du combat. Mesuré sur une vraie save Ch.12 : power ×1.064 / vit ×1.045 → eco MODESTE, ~neutre tôt.
//
//   node scripts/ga-optimize.mjs [raid] [tier]      (défaut : forge 1)
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { encodeBuild } from './src/game/buildCode.ts'
  export { runSim, initGear, SIM_UNIQUES, SIM_GEMS } from './src/game/simulator.ts'
  export { talentsByConstellation, canAllocate } from './src/game/talents.ts'
  export { computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel, setGlobalCombatMods } from './src/game/character.ts'
  export { SUPPORT_SLOTS, PASSIVE_SLOTS } from './src/game/character.ts'
  export { getPower, POWER_SLOTS } from './src/game/powers.ts'
  export { stageIlvl } from './src/game/enemies.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
const { encodeBuild, runSim, initGear, SIM_UNIQUES, SIM_GEMS, talentsByConstellation, canAllocate,
  computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel, setGlobalCombatMods,
  SUPPORT_SLOTS, PASSIVE_SLOTS, getPower, POWER_SLOTS, stageIlvl, RARITY_LIST } = M

/* ---------- KNOBS ---------- */
const POP = 24, GEN = 14, ELITE = 4, TOURNEY = 3, MUT = 0.35
const TARGET_RAID = process.argv[2] || 'forge'
const TARGET_TIER = Number(process.argv[3] || 1)
const STAGE = (TARGET_TIER + 4) * 10            // Raid T(k) gate le Chapitre (k+4)
const LEVEL = Math.max(1, Math.round(STAGE * 0.92))
const ILVL = stageIlvl(STAGE)
const RARITY_CAP_TIER = 7                        // artefact (joueur équipé de l'époque)
const POOL = talentPointsForLevel(LEVEL)

// C3 — MODS DE COMPTE RÉALISTES (calés sur une vraie save Ch.12 : power ×1.064 / vit ×1.045 / aspd ×1.003).
// Le combat de compte est VOLONTAIREMENT minime (Marché vidé) → eco ~neutre tôt, ~×1.06 à mi-jeu.
const ecoFor = (stage) => ({
  power: 1 + Math.min(0.10, stage * 0.00054),
  attackSpeed: 1 + Math.min(0.01, stage * 0.000025),
  vitality: 1 + Math.min(0.08, stage * 0.00038),
})
const ECO = ecoFor(STAGE)

/* ---------- Specs (constellations) → classe-hub. CROSS-CLASS LIBRE : n'importe quel mélange. ---------- */
const SPEC_TO_CLASS = {
  sentence: 'guerrier', rempart: 'guerrier', juggernaut: 'guerrier', furie: 'guerrier',
  assassin: 'voleur', ombrelame: 'voleur', lamevenin: 'voleur',
  pyromancien: 'mage', cryomancien: 'mage', arcaniste: 'mage', convergence: 'mage',
  meute: 'chasseur', faucon: 'chasseur', symbiose: 'chasseur',
  lumiere: 'pretre', vide: 'pretre', crepuscule: 'pretre',
  floraison: 'druide', lunaire: 'druide', ronce: 'druide', metamorphe: 'druide',
}
const ALL_SPECS = Object.keys(SPEC_TO_CLASS)
const PRIMARIES = ['force', 'agilite', 'intelligence']
const STAT_OFF = ['maitrise', 'critique', 'degatsCrit', 'hate', 'penetration', 'degatsBoss', 'precision']
const STAT_DEF = ['reductionDegats', 'resilience', 'barriere', 'recuperation', 'volDeVie']
const DMG_TYPES = ['physique', 'feu', 'froid', 'foudre', 'nature', 'arcane', 'ombre']
const UNIQ = SIM_UNIQUES.map((u) => u.id)
const GEM_IDS = SIM_GEMS.map((g) => g.id)
const RAIDS = ['forge', 'reliquaire', 'citadelle', 'nexus']
const rnd = (a) => a[Math.floor(Math.random() * a.length)]
const rint = (n) => Math.floor(Math.random() * n)

/* ---------- Génome : équipe de 1-3 membres ---------- */
function randomMember() {
  const specs = [...new Set(Array.from({ length: 1 + rint(4) }, () => rnd(ALL_SPECS)))]
  const lines = []
  for (let i = 0; i < 4 + rint(3); i++) {
    const r = Math.random()
    if (r < 0.5) lines.push({ k: 'stat', id: rnd(STAT_OFF) })
    else if (r < 0.8) lines.push({ k: 'stat', id: rnd(STAT_DEF) })
    else lines.push({ k: Math.random() < 0.6 ? 'resist' : 'dmg', id: rnd(DMG_TYPES) })
  }
  return {
    specs, primary: rnd(PRIMARIES), weight: 1 + Math.random() * 2,
    rarityTier: 4 + rint(RARITY_CAP_TIER - 3), stars: 3 + rint(3), lines,
    uniques: Array.from({ length: 3 }, () => rnd(UNIQ)), gems: [rnd(GEM_IDS), rnd(GEM_IDS)],
  }
}
const randomTeam = () => Array.from({ length: 1 + rint(3) }, randomMember)

/* ---------- Allocateur glouton VALIDE : specs choisies (+ leurs classe-hubs) + Cœur (toutes catégories
 *            dispo, NON exclusives → l'allocateur paie cat_X puis cl_X selon les specs). ---------- */
const COEUR = talentsByConstellation('coeur')
function allocate(specs, budget) {
  const talents = { co_start: 1 }
  const hubs = [...new Set(specs.map((s) => SPEC_TO_CLASS[s]))]
  const pool = [...COEUR, ...hubs.flatMap((h) => talentsByConstellation(h)), ...specs.flatMap((s) => talentsByConstellation(s))]
  let pts = budget
  for (let g = 0; g < 5000 && pts > 0; g++) {
    const cands = pool.filter((n) => canAllocate(n, talents, pts)).sort((a, b) => a.tier - b.tier)
    if (!cands.length) break
    let any = false
    for (const n of cands) { if (pts <= 0) break; if (!canAllocate(n, talents, pts)) continue; talents[n.id] = (talents[n.id] ?? 0) + 1; pts -= 1; any = true }
    if (!any) break
  }
  return talents
}

/* ---------- Pouvoirs : dégâts en actif, puis soins ; soutien = survie + soins. ---------- */
function pickPowers(talents) {
  const defs = computeUnlockedPowers(talents).map((id) => ({ id, p: getPower(id) })).filter((x) => x.p)
  const dmg = defs.filter((x) => x.p.kind === 'active' && !isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const supEff = defs.filter((x) => isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const builders = defs.filter((x) => isBuilder(x.p))
  const pass = defs.filter((x) => x.p.kind === 'passive').sort((a, b) => (b.p.threatMult ?? 1) - (a.p.threatMult ?? 1) || (b.p.damageReduction ?? 0) - (a.p.damageReduction ?? 0))
  const support = []
  for (const id of ['bouclier_runique', 'second_souffle']) if (supEff.some((x) => x.id === id) && support.length < SUPPORT_SLOTS) support.push(id)
  for (const x of [...supEff, ...builders]) if (!support.includes(x.id) && support.length < SUPPORT_SLOTS) support.push(x.id)
  const powers = []
  for (const x of [...dmg, ...supEff]) if (!powers.includes(x.id) && !support.includes(x.id) && powers.length < POWER_SLOTS) powers.push(x.id)
  return { powers, support, passives: pass.slice(0, PASSIVE_SLOTS).map((x) => x.id) }
}

/* ---------- Génome → SimConfig (toujours valide). ---------- */
function toConfig(team) {
  const totalW = team.reduce((a, m) => a + m.weight, 0)
  const members = team.map((m, i) => {
    const budget = Math.max(1, Math.round(POOL * m.weight / totalW))
    const talents = allocate(m.specs, budget)
    const pw = pickPowers(talents)
    const g = initGear('equilibre')
    Object.keys(g).forEach((sid, k) => { g[sid] = { ...g[sid], rarity: RARITY_LIST[m.rarityTier - 1].id, stars: m.stars, lines: m.lines, gems: m.gems, gemRank: 10, unique: m.uniques[k % m.uniques.length], uniqueRank: 10 } })
    return { name: `m${i}`, cls: 'guerrier', level: LEVEL, orientation: 'equilibre', primary: m.primary, gems: [], runes: [], gear: g, talents, powers: pw.powers, support: pw.support, passives: pw.passives }
  })
  return { ilvl: ILVL, rarity: RARITY_LIST[RARITY_CAP_TIER - 1].id, bestStage: STAGE, elixir: 'elixirPuissance', team: members, content: { kind: 'raid', id: TARGET_RAID, tier: TARGET_TIER, scan: false } }
}

/* ---------- Fitness CONTINUE (cible = TARGET_RAID @ TARGET_TIER). ---------- */
function fitness(team) {
  const o = runSim(toConfig(team)).outcome
  if (o.win) return 1 + Math.max(0, (1 - o.dur / 80)) * 0.5      // victoire → 1 + marge (kill rapide)
  return (1 - o.bossLeftPct / 100) * 0.9                          // échec → progrès vers le kill (gradient)
}

/* ---------- Opérateurs GA ---------- */
const clone = (m) => JSON.parse(JSON.stringify(m))
function mutateMember(m) {
  const n = clone(m); const r = Math.random()
  if (r < 0.3) { if (Math.random() < 0.5 && n.specs.length < 4) n.specs = [...new Set([...n.specs, rnd(ALL_SPECS)])]; else if (n.specs.length > 1) n.specs.splice(rint(n.specs.length), 1); else n.specs = [rnd(ALL_SPECS)] }
  else if (r < 0.4) n.primary = rnd(PRIMARIES)
  else if (r < 0.55) n.weight = Math.max(0.5, n.weight + (Math.random() - 0.5))
  else if (r < 0.7) { const i = rint(n.lines.length); n.lines[i] = Math.random() < 0.5 ? { k: 'stat', id: rnd([...STAT_OFF, ...STAT_DEF]) } : { k: Math.random() < 0.6 ? 'resist' : 'dmg', id: rnd(DMG_TYPES) } }
  else if (r < 0.82) n.uniques[rint(n.uniques.length)] = rnd(UNIQ)
  else if (r < 0.9) n.gems[rint(n.gems.length)] = rnd(GEM_IDS)
  else if (r < 0.96) n.stars = 3 + rint(3)
  else n.rarityTier = 4 + rint(RARITY_CAP_TIER - 3)
  return n
}
function crossover(a, b) {
  const size = Math.random() < 0.5 ? a.length : b.length
  const pool = [...a, ...b]
  return Array.from({ length: size }, () => clone(rnd(pool)))
}
function mutateTeam(t) {
  let n = t.map((m) => (Math.random() < MUT ? mutateMember(m) : m))
  if (Math.random() < 0.15) { if (n.length < 3 && Math.random() < 0.5) n = [...n, randomMember()]; else if (n.length > 1) n = n.slice(0, -1) }
  return n
}

/* ====================================================================== */
/* BOUCLE GÉNÉTIQUE                                                       */
/* ====================================================================== */
setGlobalCombatMods(ECO)
const out = []; const log = (s) => { out.push(s); console.log(s) }
log(`=== GA cross-class — meilleur build pour ${TARGET_RAID} T${TARGET_TIER} ===`)
log(`Époque : Ch.${Math.ceil(STAGE / 10)} · niv ${LEVEL} · ilvl ${ILVL} · rareté ≤ ${RARITY_LIST[RARITY_CAP_TIER - 1].name} · pool partagé ${POOL}`)
log(`ECO RÉALISTE (calé save Ch.12) : power ×${ECO.power.toFixed(3)} · vit ×${ECO.vitality.toFixed(3)} · aspd ×${ECO.attackSpeed.toFixed(3)}`)
log(`GA : pop ${POP} · gén ${GEN}\n`)

let pop = Array.from({ length: POP }, randomTeam)
let best = null
for (let gen = 0; gen < GEN; gen++) {
  const scored = pop.map((t) => ({ t, f: fitness(t) })).sort((a, b) => b.f - a.f)
  if (!best || scored[0].f > best.f) best = { t: scored[0].t, f: scored[0].f }
  log(`gén ${String(gen).padStart(2)} : fitness ${scored[0].f.toFixed(3)} ${scored[0].f >= 1 ? '(CLEAR)' : `(boss ~${Math.round((1 - scored[0].f / 0.9) * 100)}% PV)`} · taille ${scored[0].t.length}`)
  const next = scored.slice(0, ELITE).map((s) => s.t)
  while (next.length < POP) {
    const pick = () => { let b = scored[rint(POP)]; for (let i = 1; i < TOURNEY; i++) { const c = scored[rint(POP)]; if (c.f > b.f) b = c } return b.t }
    next.push(mutateTeam(crossover(pick(), pick())))
  }
  pop = next
}

const cfg = toConfig(best.t)
log(`\n★ MEILLEUR (${best.f >= 1 ? 'CLEAR T' + TARGET_TIER : 'échec — ' + Math.round((1 - best.f / 0.9) * 100) + '% PV boss restants'}) — équipe de ${best.t.length} :`)
for (let i = 0; i < best.t.length; i++) {
  const m = best.t[i], mc = cfg.team[i]
  const spent = Object.values(mc.talents).reduce((x, y) => x + y, 0) - 1
  const classes = [...new Set(m.specs.map((s) => SPEC_TO_CLASS[s]))]
  log(`  ${m.primary} · classes [${classes.join('+')}] · specs [${m.specs.join(',')}] · ${spent} pts · ${RARITY_LIST[m.rarityTier - 1].name} ⭐${m.stars}`)
  log(`     actifs: ${mc.powers.map((id) => getPower(id)?.name).join(', ')} · soutien: ${mc.support.map((id) => getPower(id)?.name).join(', ') || '—'}`)
}
log('  Frontière de cette équipe sur les 4 raids :')
for (const id of RAIDS) { const o = runSim({ ...cfg, content: { kind: 'raid', id, tier: 1, scan: true } }).outcome; log(`    ${id.padEnd(11)} T${o.maxReached}`) }
out.push('\n=== Code WIB1 (à charger dans le Simulateur) ===', encodeBuild(cfg))
writeFileSync('ga-result.txt', out.join('\n'))
console.log('\n(détails + code WIB1 écrits dans ga-result.txt)')
