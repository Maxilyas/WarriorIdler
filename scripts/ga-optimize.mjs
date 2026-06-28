// ALGORITHME GÉNÉTIQUE — fait CONVERGER une équipe aléatoire vers le meilleur build pour battre un
// (raid, tier) donné, sous les contraintes de l'époque (niveau/ilvl/rareté) + pool de talents PARTAGÉ +
// mods de compte (ECO). Explore TOUS les systèmes : taille d'équipe, CATÉGORIE d'armure (→ specs
// cross-class : un cuir peut mêler voleur+druide, un tissu mage+prêtre), répartition du pool, stat
// primaire, et le STUFF (rareté/⭐/stats/résist/uniques/gemmes). Arbres toujours VALIDES (canAllocate).
// Fitness CONTINUE (progrès vers le kill) → gradient de convergence. Réutilise le vrai moteur via runSim.
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
// Époque du tier : Raid T(k) gate le Chapitre (k+4). Niveau ~0,92×stage, ilvl d'époque, rareté plafond.
const STAGE = (TARGET_TIER + 4) * 10
const LEVEL = Math.max(1, Math.round(STAGE * 0.92))
const ILVL = stageIlvl(STAGE)
const RARITY_CAP_TIER = 7 // artefact (un joueur équipé de l'époque) — plafond de rareté exploré
const POOL = talentPointsForLevel(LEVEL)
// C3 — MODS DE COMPTE : améliorations/maîtrises qu'un joueur a à cette bande (calibrable). Neutre = 1.
const ECO = { power: 1.4, attackSpeed: 1.15, vitality: 1.4 }

/* ---------- Données : catégorie d'armure → specs (constellations) cross-class atteignables ---------- */
const CATEGORIES = {
  plaque: { cat: 'cat_plaque', primaries: ['force'], specs: ['guerrier', 'sentence', 'rempart', 'juggernaut', 'furie'] },
  cuir: { cat: 'cat_cuir', primaries: ['agilite', 'intelligence'], specs: ['voleur', 'assassin', 'ombrelame', 'lamevenin', 'druide', 'floraison', 'lunaire', 'ronce', 'metamorphe'] },
  mailles: { cat: 'cat_mailles', primaries: ['agilite'], specs: ['chasseur', 'meute', 'faucon', 'symbiose'] },
  tissu: { cat: 'cat_tissu', primaries: ['intelligence'], specs: ['mage', 'pyromancien', 'cryomancien', 'arcaniste', 'convergence', 'pretre', 'lumiere', 'vide', 'crepuscule'] },
}
const CAT_KEYS = Object.keys(CATEGORIES)
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
  const catKey = rnd(CAT_KEYS)
  const C = CATEGORIES[catKey]
  const nSpecs = 1 + rint(3)
  const specs = []
  for (let i = 0; i < nSpecs; i++) specs.push(rnd(C.specs))
  const nLines = 4 + rint(3)
  const lines = []
  for (let i = 0; i < nLines; i++) {
    const r = Math.random()
    if (r < 0.5) lines.push({ k: 'stat', id: rnd(STAT_OFF) })
    else if (r < 0.8) lines.push({ k: 'stat', id: rnd(STAT_DEF) })
    else lines.push({ k: Math.random() < 0.6 ? 'resist' : 'dmg', id: rnd(DMG_TYPES) })
  }
  return {
    cat: catKey, primary: rnd(C.primaries), specs: [...new Set(specs)],
    weight: 1 + Math.random() * 2, // part relative du pool partagé
    rarityTier: 4 + rint(RARITY_CAP_TIER - 3), // rare..artefact
    stars: 3 + rint(3), lines,
    uniques: Array.from({ length: 3 }, () => rnd(UNIQ)),
    gems: [rnd(GEM_IDS), rnd(GEM_IDS)],
  }
}
const randomTeam = () => Array.from({ length: 1 + rint(3) }, randomMember)

/* ---------- Allocateur glouton VALIDE depuis une catégorie + specs choisies ---------- */
function allocate(catKey, specs, budget) {
  const C = CATEGORIES[catKey]
  const talents = { co_start: 1 }
  // pool = nœuds des specs choisies + nœuds génériques du Cœur + LA catégorie choisie (pas les autres cat_).
  const coeur = talentsByConstellation('coeur').filter((n) => !n.id.startsWith('cat_') || n.id === C.cat)
  const pool = [...coeur, ...specs.flatMap((s) => talentsByConstellation(s))]
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

/* ---------- Pouvoirs : dégâts en actif, puis soins (cas heal) ; soutien = survie + soins. ---------- */
function pickPowers(talents) {
  const defs = computeUnlockedPowers(talents).map((id) => ({ id, p: getPower(id) })).filter((x) => x.p)
  const dmg = defs.filter((x) => x.p.kind === 'active' && !isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const supEff = defs.filter((x) => isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const builders = defs.filter((x) => isBuilder(x.p))
  const pass = defs.filter((x) => x.p.kind === 'passive').sort((a, b) => (b.p.threatMult ?? 1) - (a.p.threatMult ?? 1) || (b.p.damageReduction ?? 0) - (a.p.damageReduction ?? 0))
  const want = ['bouclier_runique', 'second_souffle']
  const support = []
  for (const id of want) if (supEff.some((x) => x.id === id) && support.length < SUPPORT_SLOTS) support.push(id)
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
    const talents = allocate(m.cat, m.specs, budget)
    const pw = pickPowers(talents)
    const g = initGear('equilibre')
    Object.keys(g).forEach((sid, k) => { g[sid] = { ...g[sid], rarity: RARITY_LIST[m.rarityTier - 1].id, stars: m.stars, lines: m.lines, gems: m.gems, gemRank: 10, unique: m.uniques[k % m.uniques.length], uniqueRank: 10 } })
    return { name: `${m.cat}-${i}`, cls: 'guerrier', level: LEVEL, orientation: 'equilibre', primary: m.primary, gems: [], runes: [], gear: g, talents, powers: pw.powers, support: pw.support, passives: pw.passives }
  })
  return { ilvl: ILVL, rarity: RARITY_LIST[RARITY_CAP_TIER - 1].id, bestStage: STAGE, elixir: 'elixirPuissance', team: members, content: { kind: 'raid', id: TARGET_RAID, tier: TARGET_TIER, scan: false } }
}

/* ---------- Fitness CONTINUE (cible = TARGET_RAID @ TARGET_TIER). ---------- */
function fitness(team) {
  const cfg = toConfig(team)
  const o = runSim(cfg).outcome
  // victoire → 1 + marge (kill rapide) ; échec → progrès vers le kill (1 - PV restant) + survie partielle.
  if (o.win) return 1 + Math.max(0, (1 - o.dur / 80)) * 0.5
  const progress = 1 - (o.bossLeftPct / 100) // 0..1 selon les PV enlevés
  return progress * 0.9
}

/* ---------- Opérateurs GA ---------- */
const clone = (m) => JSON.parse(JSON.stringify(m))
function mutateMember(m) {
  const n = clone(m)
  const r = Math.random()
  const C = CATEGORIES[n.cat]
  if (r < 0.2) { n.cat = rnd(CAT_KEYS); n.specs = [rnd(CATEGORIES[n.cat].specs)]; n.primary = rnd(CATEGORIES[n.cat].primaries) }
  else if (r < 0.4) { if (Math.random() < 0.5 && n.specs.length < 3) n.specs = [...new Set([...n.specs, rnd(C.specs)])]; else if (n.specs.length > 1) n.specs = n.specs.slice(0, -1) }
  else if (r < 0.55) n.weight = Math.max(0.5, n.weight + (Math.random() - 0.5))
  else if (r < 0.7) { const i = rint(n.lines.length); n.lines[i] = Math.random() < 0.5 ? { k: 'stat', id: rnd([...STAT_OFF, ...STAT_DEF]) } : { k: Math.random() < 0.6 ? 'resist' : 'dmg', id: rnd(DMG_TYPES) } }
  else if (r < 0.82) n.uniques[rint(n.uniques.length)] = rnd(UNIQ)
  else if (r < 0.9) n.gems[rint(n.gems.length)] = rnd(GEM_IDS)
  else if (r < 0.96) n.stars = 3 + rint(3)
  else n.rarityTier = 4 + rint(RARITY_CAP_TIER - 3)
  return n
}
function crossover(a, b) {
  // mélange au niveau membre + parfois change la taille.
  const size = Math.random() < 0.5 ? a.length : b.length
  const pool = [...a, ...b]
  const child = []
  for (let i = 0; i < size; i++) child.push(clone(rnd(pool)))
  return child
}
function mutateTeam(t) {
  let n = t.map((m) => (Math.random() < MUT ? mutateMember(m) : m))
  if (Math.random() < 0.15) { if (n.length < 3 && Math.random() < 0.5) n = [...n, randomMember()]; else if (n.length > 1) n = n.slice(0, -1) }
  return n
}

/* ====================================================================== */
/* BOUCLE GÉNÉTIQUE                                                       */
/* ====================================================================== */
setGlobalCombatMods(ECO) // C3 : mods de compte appliqués à TOUTES les évals
const out = []; const log = (s) => { out.push(s); console.log(s) }
log(`=== GA — converger vers le meilleur build pour ${TARGET_RAID} T${TARGET_TIER} ===`)
log(`Époque : Ch.${Math.ceil(STAGE / 10)} · niv ${LEVEL} · ilvl ${ILVL} · rareté ≤ ${RARITY_LIST[RARITY_CAP_TIER - 1].name} · pool partagé ${POOL}`)
log(`Mods de compte (ECO) : puissance ×${ECO.power} · vit.att ×${ECO.attackSpeed} · vitalité ×${ECO.vitality}`)
log(`GA : pop ${POP} · gén ${GEN} · élite ${ELITE}\n`)

let pop = Array.from({ length: POP }, randomTeam)
let best = null
for (let gen = 0; gen < GEN; gen++) {
  const scored = pop.map((t) => ({ t, f: fitness(t) })).sort((a, b) => b.f - a.f)
  if (!best || scored[0].f > best.f) best = { t: scored[0].t, f: scored[0].f }
  const win = best.f >= 1
  log(`gén ${String(gen).padStart(2)} : meilleur fitness ${scored[0].f.toFixed(3)} ${scored[0].f >= 1 ? '(CLEAR)' : `(boss ~${Math.round((1 - scored[0].f / 0.9) * 100)}% PV)`} · taille ${scored[0].t.length}`)
  // sélection (élite) + reproduction
  const next = scored.slice(0, ELITE).map((s) => s.t)
  while (next.length < POP) {
    const pick = () => { let b = scored[rint(POP)]; for (let i = 1; i < TOURNEY; i++) { const c = scored[rint(POP)]; if (c.f > b.f) b = c } return b.t }
    next.push(mutateTeam(crossover(pick(), pick())))
  }
  pop = next
}

/* ---------- Rapport du meilleur ---------- */
const cfg = toConfig(best.t)
log(`\n★ MEILLEUR (${best.f >= 1 ? 'CLEAR' : 'échec, ' + Math.round((1 - best.f / 0.9) * 100) + '% PV boss restants'}) — équipe de ${best.t.length} :`)
for (let i = 0; i < best.t.length; i++) {
  const m = best.t[i], mc = cfg.team[i]
  const spent = Object.values(mc.talents).reduce((x, y) => x + y, 0) - 1
  log(`  ${m.cat}/${m.primary} · specs [${m.specs.join(',')}] · ${spent} pts · ${RARITY_LIST[m.rarityTier - 1].name} ⭐${m.stars}`)
  log(`     actifs: ${mc.powers.map((id) => getPower(id)?.name).join(', ')} · soutien: ${mc.support.map((id) => getPower(id)?.name).join(', ') || '—'}`)
}
// éval finale sur les 4 raids (au tier cible) pour situer l'équipe
log('  Tiers (cible) sur les 4 raids :')
for (const id of RAIDS) { const o = runSim({ ...cfg, content: { kind: 'raid', id, tier: 1, scan: true } }).outcome; log(`    ${id.padEnd(11)} T${o.maxReached}`) }
out.push('\n=== Code WIB1 (à charger dans le Simulateur) ===', encodeBuild(cfg))
writeFileSync('ga-result.txt', out.join('\n'))
console.log('\n(détails + code WIB1 écrits dans ga-result.txt)')
