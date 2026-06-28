// GÉNÉRATEUR DE BUILDS OPTIMISÉS (équipe) — arbres + stuff + pouvoirs construits AUTOMATIQUEMENT et
// VALIDÉS (l'équipe doit clear, mesuré par runSim). Sert de BROUILLON ultra-performant que le joueur
// reprend ensuite dans le Simulateur. Compo : TANK/DPS (Guerrier, Rempart+Sentence → Bouclier runique +
// Second souffle obligatoires) + DPS (Mage Pyromancien). Arbres alloués gloutonnement via le VRAI
// `canAllocate` → toujours VALIDES. Stuff légendaire/artefact ⭐5, stats ciblées (tank def+résist /
// dps offensif), uniques + gemmes. Sortie : code WIB1 d'équipe + tiers réellement clearés.
//
//   node scripts/gen-optimized.mjs            → écrit optimized.txt + affiche les tiers clearés
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { encodeBuild } from './src/game/buildCode.ts'
  export { runSim, initGear, SIM_UNIQUES } from './src/game/simulator.ts'
  export { talentsByConstellation, canAllocate, getTalent } from './src/game/talents.ts'
  export { computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel } from './src/game/character.ts'
  export { SUPPORT_SLOTS, PASSIVE_SLOTS } from './src/game/character.ts'
  export { getPower, POWER_SLOTS } from './src/game/powers.ts'
  export { stageIlvl } from './src/game/enemies.ts'
`)
const { encodeBuild, runSim, initGear, SIM_UNIQUES, talentsByConstellation, canAllocate, getTalent,
  computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel, POWER_SLOTS, SUPPORT_SLOTS, PASSIVE_SLOTS, getPower, stageIlvl } = M

/* ---- Allocateur glouton VALIDE : remplit des constellations par tiers croissants (ouvre les gates
 *      minSpent au fur et à mesure), borné au budget de points. Toujours conforme à canAllocate. ---- */
function allocate(consList, budget) {
  const talents = { co_start: 1 }
  const pool = consList.flatMap((c) => talentsByConstellation(c))
  let pts = budget
  for (let guard = 0; guard < 5000 && pts > 0; guard++) {
    const cands = pool.filter((n) => canAllocate(n, talents, pts)).sort((a, b) => a.tier - b.tier)
    if (!cands.length) break
    let any = false
    for (const n of cands) {
      if (pts <= 0) break
      if (!canAllocate(n, talents, pts)) continue
      talents[n.id] = (talents[n.id] ?? 0) + 1; pts -= 1; any = true
    }
    if (!any) break
  }
  return talents
}

/* ---- Sélection des pouvoirs depuis l'arbre alloué. `mustSupport` = ids à garantir (survie du tank). ---- */
function pickPowers(talents, { wantSupport = [], offensiveFirst = true } = {}) {
  const ids = computeUnlockedPowers(talents)
  const defs = ids.map((id) => ({ id, p: getPower(id) })).filter((x) => x.p)
  const dmg = defs.filter((x) => x.p.kind === 'active' && !isSupport(x.p) && !isBuilder(x.p))
    .sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
  const sup = defs.filter((x) => isSupport(x.p) && !isBuilder(x.p))
  const builders = defs.filter((x) => isBuilder(x.p))
  const pass = defs.filter((x) => x.p.kind === 'passive')
    .sort((a, b) => (b.p.threatMult ?? 1) - (a.p.threatMult ?? 1) || (b.p.damageReduction ?? 0) - (a.p.damageReduction ?? 0))
  // SOUTIEN : on garantit les survie demandés (bouclier/soin), puis on complète.
  const supIds = []
  for (const id of wantSupport) if (sup.some((x) => x.id === id) && supIds.length < SUPPORT_SLOTS) supIds.push(id)
  for (const x of [...sup, ...builders]) if (!supIds.includes(x.id) && supIds.length < SUPPORT_SLOTS) supIds.push(x.id)
  // ACTIFS : meilleurs sorts de dégâts (le tank en met aussi — il DPS).
  const actIds = dmg.slice(0, POWER_SLOTS).map((x) => x.id)
  const passIds = pass.slice(0, PASSIVE_SLOTS).map((x) => x.id)
  return { powers: actIds, support: supIds, passives: passIds,
    hasShield: supIds.includes('bouclier_runique'), hasSouffle: supIds.includes('second_souffle') }
}

/* ---- Stuff optimisé : 16 pièces ⭐5, lignes ciblées, 2 gemmes/pièce, 1 unique/pièce (cyclé d'un set). ---- */
function gearFor(role, ilvl, uniques) {
  const g = initGear(role === 'tank' ? 'defensif' : 'offensif')
  // lignes : tank = défensif + résist physique/feu (Forge) ; dps = offensif pur.
  const tankLines = [{ k: 'stat', id: 'reductionDegats' }, { k: 'stat', id: 'resilience' }, { k: 'stat', id: 'barriere' },
    { k: 'stat', id: 'maitrise' }, { k: 'resist', id: 'physique' }, { k: 'resist', id: 'feu' }, { k: 'stat', id: 'penetration' }]
  const dpsLines = [{ k: 'stat', id: 'maitrise' }, { k: 'stat', id: 'critique' }, { k: 'stat', id: 'degatsCrit' },
    { k: 'stat', id: 'hate' }, { k: 'stat', id: 'penetration' }, { k: 'stat', id: 'degatsBoss' }]
  Object.keys(g).forEach((sid, i) => {
    g[sid] = { ...g[sid], stars: 5, lines: role === 'tank' ? tankLines : dpsLines,
      gems: role === 'tank' ? ['sixieme', 'riposte'] : ['overkill', 'tambour'], gemRank: 10,
      unique: uniques[i % uniques.length], uniqueRank: 10 }
  })
  return g
}

/* ====================================================================== */
/* CONSTRUCTION + VALIDATION — échelle de profils (niveau/rareté croissants) */
/* ====================================================================== */
// Min légendaire/artefact dès le début (cf. demande). Rareté + niveau montent par rung.
const PROFILES = [
  { stage: 50, level: 46, rarity: 'artefact' },     // début de raid, optimisé
  { stage: 80, level: 74, rarity: 'mythique' },      // mid
  { stage: 110, level: 110, rarity: 'ascendant' },   // avancé
]
const RAIDS = ['forge', 'reliquaire', 'citadelle', 'nexus']
const UNIQ = SIM_UNIQUES.map((u) => u.id) // uniques cyclés (le joueur affinera lesquels)

function buildTeam(level, ilvl) {
  // TANK/DPS Guerrier : Rempart (bouclier) + Sentence (second souffle) + Juggernaut + Furie.
  const budget = talentPointsForLevel(level)
  const tankTal = allocate(['coeur', 'guerrier', 'rempart', 'sentence', 'juggernaut', 'furie'], budget)
  const tankPw = pickPowers(tankTal, { wantSupport: ['bouclier_runique', 'second_souffle'] })
  // DPS Mage : Pyromancien + Arcaniste + Cryomancien (dégâts) ; survie en cooldowns (slots SOUTIEN,
  // coût offensif nul) : Bouclier runique (ar_/cr_barriere) + Second souffle (py_souffle) → ne meurt plus bêtement.
  const dpsTal = allocate(['coeur', 'mage', 'pyromancien', 'arcaniste', 'cryomancien'], budget)
  const dpsPw = pickPowers(dpsTal, { wantSupport: ['bouclier_runique', 'second_souffle'] })
  const team = [
    { name: 'Tank/DPS Guerrier', cls: 'guerrier', level, orientation: 'defensif', primary: 'force',
      gems: [], runes: [], gear: gearFor('tank', ilvl, UNIQ), talents: tankTal, powers: tankPw.powers, support: tankPw.support, passives: tankPw.passives },
    { name: 'DPS Mage', cls: 'mage', level, orientation: 'offensif', primary: 'intelligence',
      gems: [], runes: [], gear: gearFor('dps', ilvl, UNIQ), talents: dpsTal, powers: dpsPw.powers, support: dpsPw.support, passives: dpsPw.passives },
  ]
  return { team, tankTal, tankPw, dpsTal, dpsPw }
}

const out = []
const log = (s) => { out.push(s); console.log(s) }
const codes = []
log('=== Builds OPTIMISÉS (équipe Tank/DPS + DPS) — arbres alloués via canAllocate + VALIDÉS par runSim ===')
log('Compo : Guerrier Rempart+Sentence (Bouclier runique + Second souffle + Provocation = il tient l\'aggro')
log('et soutient l\'équipe) + Mage offensif. Heal DÉDIÉ = constellations prestige (paladin/chaman) non')
log('éditables dans le Simulateur pour les 4 classes de base → ici le sustain vient du tank. À affiner.\n')

for (const { stage, level, rarity } of PROFILES) {
  const ilvl = stageIlvl(stage)
  const { team, tankTal, tankPw, dpsTal, dpsPw } = buildTeam(level, ilvl)
  const cfg = { ilvl, rarity, bestStage: stage, elixir: 'elixirPuissance', team, content: { kind: 'raid', id: 'forge', tier: 1, scan: true } }
  log(`── Rung Ch.${Math.ceil(stage / 10)} · niv ${level} · ilvl ${ilvl} · ${rarity} ⭐5 (budget talents ${talentPointsForLevel(level)}) ──`)
  log(`  Tank ${Object.keys(tankTal).length} nœuds · 🛡️ Bouclier ${tankPw.hasShield ? 'OK' : '✗'} · 🩹 Souffle ${tankPw.hasSouffle ? 'OK' : '✗'} · actifs: ${tankPw.powers.map((id) => getPower(id)?.name).join(', ')} · soutien: ${tankPw.support.map((id) => getPower(id)?.name).join(', ')} · passifs: ${tankPw.passives.map((id) => getPower(id)?.name).join(', ')}`)
  log(`  DPS  ${Object.keys(dpsTal).length} nœuds · actifs: ${dpsPw.powers.map((id) => getPower(id)?.name).join(', ')}`)
  for (const id of RAIDS) {
    const r = runSim({ ...cfg, content: { kind: 'raid', id, tier: 1, scan: true } })
    const o = r.outcome
    log(`    ${id.padEnd(11)} : T${o.maxReached} max${o.wallAt ? ` (mur T${o.wallAt}: ${o.firstDead ?? 'enrage'} · boss ${o.bossLeftPct.toFixed(0)}%)` : ''}`)
  }
  codes.push(`# Tank/DPS + DPS · Ch.${Math.ceil(stage / 10)} ${rarity} niv ${level}\n${encodeBuild(cfg)}`)
  log('')
}
out.push('=== CODES WIB1 (à charger dans le Simulateur pour affiner) ===', ...codes)
writeFileSync('optimized.txt', out.join('\n'))
console.log('\n(détails + codes WIB1 écrits dans optimized.txt)')
