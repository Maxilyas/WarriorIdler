// GA cross-class BLINDÉ — fait CONVERGER une équipe vers le build qui pousse la FRONTIÈRE la plus haute
// sur un raid (tier max atteint), sous les contraintes de l'époque. Utilise le moteur partagé durci
// (scripts/lib/ga-engine.mjs) : fitness MOYENNÉE (combat stochastique), arbres ÉVOLUTIFS (poids par nœud),
// génome PAR-PIÈCE (rareté/⭐/lignes/gemmes/unique différents par slot), recherche en ÎLOTS → convergence.
//
// MODE par défaut = NON CONTRAINT (borne haute : qualité libérée, empilement d'uniques). --realiste
// rebranche les contraintes d'acquisition. Le `tier` de départ ne sert qu'à fixer l'ÉPOQUE (niveau/ilvl).
//
//   node scripts/ga-optimize.mjs [raid] [tier] [--realiste]      (défaut : forge 1)
import { writeFileSync } from 'node:fs'
import { loadGame, makeEngine } from './lib/ga-engine.mjs'

const ARGV = process.argv.slice(2)
const UNCONSTRAINED = !ARGV.includes('--realiste')
const pos = ARGV.filter((a) => !a.startsWith('--'))
const TARGET_RAID = pos[0] || 'forge'
const TARGET_TIER = Number(pos[1] || 1)
const RAIDS = ['forge', 'reliquaire', 'citadelle', 'nexus']

// Budget EXHAUSTIF : convergence (le meilleur ne progresse plus depuis `stallGens` générations).
const GA = { islands: 4, pop: 28, elite: 4, tourney: 4, mut: 0.4, immigrants: 2, migrateEvery: 8, stallGens: 30, maxGens: 1200, samples: 11, mode: 'frontier' }

const M = await loadGame()
const E = makeEngine(M)
const ctx = E.ctxFor(TARGET_RAID, TARGET_TIER, { unconstrained: UNCONSTRAINED })

const descF = (f) => f >= 1
  ? `T${Math.floor(f)} max (${Math.round((f - Math.floor(f)) / 0.9 * 100)}% vers T${Math.floor(f) + 1})`
  : `T0 (boss ${Math.round((1 - f / 0.9) * 100)}% au mur T1)`

const out = []; const log = (s) => { out.push(s); console.log(s) }
log(`=== GA BLINDÉ — frontière sur ${TARGET_RAID} (${UNCONSTRAINED ? 'non contraint' : 'réaliste'}) ===`)
log(`Époque T${TARGET_TIER} : niv ${ctx.level} · ilvl ${ctx.ilvl} · pool ${ctx.pool} · rareté max ${ctx.caps.rarityMax} · uniques dispo ${ctx.caps.uniquePool.length}`)
log(`GA : ${GA.islands} îlots × pop ${GA.pop} · ${GA.samples} combats/éval · arrêt convergence ${GA.stallGens} gén\n`)

const t0 = Date.now()
const res = E.runGA(ctx, { ...GA, onGen: ({ gen, bestF, genF, stall, evals }) => {
  if (gen % 5 === 0 || stall === 0) log(`gén ${String(gen).padStart(3)} : best ${descF(bestF)} · gén ${descF(genF)} · stall ${stall} · évals ${evals}`)
} })
log(`\nConvergé en ${res.gens} gén (dernier progrès gén ${res.lastImprove}) · ${res.evals} évals · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
log(`\n★ MEILLEUR — frontière ${descF(res.best.f)} :`)
log(E.describeTeam(res.best.t, ctx))

// Frontière de cette équipe sur les 4 raids (scan complet).
const cfg = E.toConfig(res.best.t, ctx)
M.setGlobalCombatMods(ctx.eco)
log('  Frontière sur les 4 raids :')
for (const id of RAIDS) { const o = M.runSim({ ...cfg, content: { kind: 'raid', id, tier: 1, scan: true } }).outcome; log(`    ${id.padEnd(11)} T${o.maxReached}`) }

out.push('\n=== Code WIB1 (à charger dans le Simulateur) ===', E.encodeBuild({ ...cfg, content: { kind: 'raid', id: TARGET_RAID, tier: TARGET_TIER, scan: false } }))
writeFileSync('ga-result.txt', out.join('\n'))
console.log('\n(détails + code WIB1 écrits dans ga-result.txt)')
