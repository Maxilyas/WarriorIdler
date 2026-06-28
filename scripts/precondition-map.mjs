// CARTE DE PRÉCONDITION — pour chaque (raid × tier), un petit GA cross-class + acquisition-réaliste
// cherche le MEILLEUR build de l'ÉPOQUE du tier (niveau/ilvl/rareté/uniques gatés) et répond :
// « un build d'époque peut-il clear ce tier ? ». Sort un tableau raid×tier (✓ clear / ✗N% PV au mur).
// Réutilise le moteur fidèle via runSim. Mods de compte réalistes (ecoFor). Cf. docs/DIFFICULTE.md §6.
//
//   node scripts/precondition-map.mjs
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { runSim, initGear, SIM_GEMS } from './src/game/simulator.ts'
  export { PLAIN_UNIQUES, TAGGED_UNIQUES } from './src/game/uniques.ts'
  export { talentsByConstellation, canAllocate } from './src/game/talents.ts'
  export { computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel, setGlobalCombatMods } from './src/game/character.ts'
  export { SUPPORT_SLOTS, PASSIVE_SLOTS } from './src/game/character.ts'
  export { getPower, POWER_SLOTS } from './src/game/powers.ts'
  export { stageIlvl } from './src/game/enemies.ts'
  export { RARITY_LIST } from './src/game/rarities.ts'
`)
const { runSim, initGear, SIM_GEMS, PLAIN_UNIQUES, TAGGED_UNIQUES, talentsByConstellation, canAllocate,
  computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel, setGlobalCombatMods,
  SUPPORT_SLOTS, PASSIVE_SLOTS, getPower, POWER_SLOTS, stageIlvl, RARITY_LIST } = M

const POP = 12, GEN = 6, ELITE = 3, TOURNEY = 3, MUT = 0.4
const RAIDS = ['forge', 'reliquaire', 'citadelle', 'nexus']
const TIERS = [1, 2, 3, 5, 7, 10]
const ecoFor = (stage) => ({ power: 1 + Math.min(0.10, stage * 0.00054), attackSpeed: 1 + Math.min(0.01, stage * 0.000025), vitality: 1 + Math.min(0.08, stage * 0.00038) })

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
const STAT_OFF = ['maitrise', 'critique', 'degatsCrit', 'hate', 'penetration', 'degatsBoss']
const STAT_DEF = ['reductionDegats', 'resilience', 'barriere', 'recuperation', 'volDeVie']
const DMG_TYPES = ['physique', 'feu', 'froid', 'foudre', 'nature', 'arcane', 'ombre']
const GEM_IDS = SIM_GEMS.map((g) => g.id)
const COEUR = talentsByConstellation('coeur')
const rnd = (a) => a[Math.floor(Math.random() * a.length)]
const rint = (n) => Math.floor(Math.random() * n)

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

/* ---- Un GA par cellule (raid, tier) avec les contraintes d'époque. ---- */
function runCell(raid, tier) {
  const stage = (tier + 4) * 10
  const level = Math.max(1, Math.round(stage * 0.92))
  const ilvl = stageIlvl(stage)
  const pool = talentPointsForLevel(level)
  const rarityCap = Math.min(14, 5 + tier)
  const maxStars = Math.min(5, 3 + Math.floor(tier / 3))
  const maxGemRank = Math.min(10, 3 + tier)
  const raidAccess = tier >= 2
  const UNIQ = [...PLAIN_UNIQUES.map((u) => u.id), ...(raidAccess ? TAGGED_UNIQUES.map((u) => u.id) : [])]
  const maxUniq = (rt) => Math.max(1, Math.min(8, Math.round(16 * Math.min(1, (rt - 4) * 0.14))))
  const sampleUniques = (k) => { const p = [...UNIQ]; const o = []; for (let i = 0; i < k && p.length; i++) o.push(p.splice(rint(p.length), 1)[0]); return o }
  setGlobalCombatMods(ecoFor(stage))

  const randMember = () => {
    const specs = [...new Set(Array.from({ length: 1 + rint(4) }, () => rnd(ALL_SPECS)))]
    const lines = Array.from({ length: 4 + rint(3) }, () => { const r = Math.random(); return r < 0.5 ? { k: 'stat', id: rnd(STAT_OFF) } : r < 0.8 ? { k: 'stat', id: rnd(STAT_DEF) } : { k: Math.random() < 0.6 ? 'resist' : 'dmg', id: rnd(DMG_TYPES) } })
    const rarityTier = 4 + rint(rarityCap - 3)
    return { specs, primary: rnd(PRIMARIES), weight: 1 + Math.random() * 2, rarityTier, stars: Math.min(maxStars, 3 + rint(3)), lines, uniques: sampleUniques(1 + rint(maxUniq(rarityTier))), gems: [rnd(GEM_IDS), rnd(GEM_IDS)] }
  }
  const randTeam = () => Array.from({ length: 1 + rint(3) }, randMember)
  const toConfig = (team) => {
    const totalW = team.reduce((a, m) => a + m.weight, 0)
    const members = team.map((m, i) => {
      const talents = allocate(m.specs, Math.max(1, Math.round(pool * m.weight / totalW)))
      const pw = pickPowers(talents)
      const g = initGear('equilibre')
      const K = Math.min(m.uniques.length, maxUniq(m.rarityTier))
      Object.keys(g).forEach((sid, k) => { g[sid] = { ...g[sid], rarity: RARITY_LIST[m.rarityTier - 1].id, stars: m.stars, lines: m.lines, gems: m.gems, gemRank: maxGemRank, unique: k < K ? m.uniques[k] : undefined, uniqueRank: 10 } })
      return { name: `m${i}`, cls: 'guerrier', level, orientation: 'equilibre', primary: m.primary, gems: [], runes: [], gear: g, talents, powers: pw.powers, support: pw.support, passives: pw.passives }
    })
    return { ilvl, rarity: RARITY_LIST[rarityCap - 1].id, bestStage: stage, elixir: 'elixirPuissance', team: members, content: { kind: 'raid', id: raid, tier, scan: false } }
  }
  const fit = (team) => { const o = runSim(toConfig(team)).outcome; return o.win ? 1 + (1 - o.dur / 80) * 0.3 : (1 - o.bossLeftPct / 100) * 0.9 }
  const clone = (m) => JSON.parse(JSON.stringify(m))
  const mutMember = (m) => {
    const n = clone(m); const r = Math.random()
    if (r < 0.3) { if (Math.random() < 0.5 && n.specs.length < 4) n.specs = [...new Set([...n.specs, rnd(ALL_SPECS)])]; else if (n.specs.length > 1) n.specs.splice(rint(n.specs.length), 1) }
    else if (r < 0.4) n.primary = rnd(PRIMARIES)
    else if (r < 0.55) n.weight = Math.max(0.5, n.weight + (Math.random() - 0.5))
    else if (r < 0.72) { const i = rint(n.lines.length); n.lines[i] = Math.random() < 0.5 ? { k: 'stat', id: rnd([...STAT_OFF, ...STAT_DEF]) } : { k: Math.random() < 0.6 ? 'resist' : 'dmg', id: rnd(DMG_TYPES) } }
    else if (r < 0.85) n.uniques = sampleUniques(Math.max(1, Math.min(maxUniq(n.rarityTier), n.uniques.length + (Math.random() < 0.5 ? 1 : -1))))
    else if (r < 0.93) n.gems[rint(n.gems.length)] = rnd(GEM_IDS)
    else if (r < 0.97) n.stars = Math.min(maxStars, 3 + rint(3))
    else n.rarityTier = 4 + rint(rarityCap - 3)
    return n
  }
  const cross = (a, b) => { const size = Math.random() < 0.5 ? a.length : b.length; const p = [...a, ...b]; return Array.from({ length: size }, () => clone(rnd(p))) }
  const mutTeam = (t) => { let n = t.map((m) => (Math.random() < MUT ? mutMember(m) : m)); if (Math.random() < 0.15) { if (n.length < 3 && Math.random() < 0.5) n = [...n, randMember()]; else if (n.length > 1) n = n.slice(0, -1) } return n }

  const cache = new Map()
  const F = (t) => { const k = JSON.stringify(t); let v = cache.get(k); if (v === undefined) { v = fit(t); cache.set(k, v) } return v }
  let popl = Array.from({ length: POP }, randTeam); let best = -1
  for (let gen = 0; gen < GEN; gen++) {
    const scored = popl.map((t) => ({ t, f: F(t) })).sort((a, b) => b.f - a.f)
    best = Math.max(best, scored[0].f)
    const next = scored.slice(0, ELITE).map((s) => s.t)
    while (next.length < POP) { const pick = () => { let b = scored[rint(POP)]; for (let i = 1; i < TOURNEY; i++) { const c = scored[rint(POP)]; if (c.f > b.f) b = c } return b.t }; next.push(mutTeam(cross(pick(), pick()))) }
    popl = next
  }
  return best >= 1 ? '✓' : `✗${Math.round((1 - best / 0.9) * 100)}%`
}

/* ====================================================================== */
const out = []; const log = (s) => { out.push(s); console.log(s) }
log('=== CARTE DE PRÉCONDITION §6 — un build d\'ÉPOQUE peut-il clear (raid × tier) ? ===')
log('(meilleur build cross-class + acquisition-réaliste de l\'époque du tier ; ✓ = clear · ✗N% = PV boss au mur)\n')
log('  Raid                  ' + TIERS.map((t) => `T${t}`.padStart(6)).join(''))
for (const raid of RAIDS) {
  const cells = TIERS.map((t) => runCell(raid, t).padStart(6))
  log(`  ${raid.padEnd(20)}${cells.join('')}`)
}
log('\nT(k) gate le Chapitre (k+4) ; époque = niv ~0,92×stage, ilvl/rareté/uniques gatés, eco réaliste.')
log('Tier ≥2 : uniques de raid dispo (synergie de tags = pouvoir build-defining voulu).')
writeFileSync('precondition-map.txt', out.join('\n'))
console.log('\n(écrit dans precondition-map.txt)')
