// CARTE DE PRÉCONDITION — pour chaque (raid × tier), le GA BLINDÉ (scripts/lib/ga-engine.mjs) cherche
// JUSQU'À CONVERGENCE le MEILLEUR build de l'ÉPOQUE du tier et répond : « ce tier est-il clearable ? ».
// Sort un tableau raid×tier (✓ winRate% / ✗winRate% · PV boss restants), + télémétrie de convergence.
//
// Moteur DURCI (audit 28/06/2026) : fitness MOYENNÉE (combat stochastique), arbres ÉVOLUTIFS, génome
// PAR-PIÈCE (rareté/⭐/lignes/gemmes/unique différents par slot), recherche en ÎLOTS jusqu'à convergence.
//
// MODE par défaut = NON CONTRAINT (borne HAUTE absolue : niveau+ilvl figés à l'époque, qualité libérée
// → empilement d'uniques, raretés max ; trouve « est-ce théoriquement clearable ? »). Le flag --realiste
// rebranche les contraintes d'ACQUISITION (raretés ≤ bande, uniques distincts, taggés gatés) → carte du
// build qu'un joueur peut RÉELLEMENT avoir. Cf. docs/DIFFICULTE.md §6.
//
//   node scripts/precondition-map.mjs [--realiste] [--tiers=1,2,3,4,5]
import { writeFileSync } from 'node:fs'
import { loadGame, makeEngine } from './lib/ga-engine.mjs'

const ARGV = process.argv.slice(2)
const UNCONSTRAINED = !ARGV.includes('--realiste')
const TIERS = (ARGV.find((a) => a.startsWith('--tiers='))?.split('=')[1]?.split(',').map(Number)) || [1, 2, 3, 4, 5]
const RAIDS = ['forge', 'reliquaire', 'citadelle', 'nexus']

// Budget EXHAUSTIF : on tourne jusqu'à ce que le meilleur ne progresse plus depuis `stallGens` gén.
const GA = { islands: 4, pop: 28, elite: 4, tourney: 4, mut: 0.4, immigrants: 2, migrateEvery: 8, stallGens: 30, maxGens: 1200, samples: 11, mode: 'cell' }
const CONFIRM_N = 80          // grosse confirmation pour le VERDICT (indépendante de la recherche)
const CLEAR_THRESHOLD = 0.5   // ✓ si winRate de confirmation ≥ 50%

const M = await loadGame()
const E = makeEngine(M)

const out = []; const log = (s) => { out.push(s); console.log(s) }
log(`=== CARTE DE PRÉCONDITION §6 — ${UNCONSTRAINED ? 'BORNE HAUTE (non contraint)' : 'RÉALISTE (acquisition gatée)'} ===`)
log(UNCONSTRAINED
  ? '(optimum THÉORIQUE de l\'époque : niveau+ilvl figés, qualité libérée — empilement d\'uniques/raretés max)'
  : '(meilleur build ATTEIGNABLE : raretés ≤ bande, uniques distincts, taggés gatés par accès raid)')
log(`GA blindé : ${GA.islands} îlots × pop ${GA.pop} · ${GA.samples} combats/éval · arrêt convergence (${GA.stallGens} gén) · confirm ${CONFIRM_N}\n`)

const t0 = Date.now()
const grid = {} // grid[raid][tier] = { winRate, bossLeft, gens, evals }
for (const raid of RAIDS) {
  grid[raid] = {}
  for (const tier of TIERS) {
    const ct = Date.now()
    const ctx = E.ctxFor(raid, tier, { unconstrained: UNCONSTRAINED })
    const res = E.runGA(ctx, GA)
    const v = E.confirm(res.best.t, ctx, CONFIRM_N)
    grid[raid][tier] = { ...v, gens: res.gens, evals: res.evals, converged: res.converged }
    console.log(`  · ${raid.padEnd(11)} T${tier} → winRate ${(v.winRate * 100).toFixed(0)}% · boss ${(v.bossLeft * 100).toFixed(0)}% · ${res.gens} gén (conv ${res.converged ? '✓' : '✗'}) · ${res.evals} évals · ${((Date.now() - ct) / 1000).toFixed(0)}s`)
  }
}

const cell = (c) => c.winRate >= CLEAR_THRESHOLD ? `✓${Math.round(c.winRate * 100)}%` : `✗${Math.round(c.winRate * 100)}/${Math.round(c.bossLeft * 100)}`
log('\n  Raid             ' + TIERS.map((t) => `T${t}`.padStart(8)).join(''))
for (const raid of RAIDS) log(`  ${raid.padEnd(13)}` + TIERS.map((t) => cell(grid[raid][t]).padStart(8)).join(''))

log('\nLégende : ✓W% = clearable (winRate de confirmation) · ✗W%/B% = winRate / PV boss restants au mur.')
log(`Convergence : moy ${(Object.values(grid).flatMap((r) => Object.values(r)).reduce((a, c) => a + c.gens, 0) / (RAIDS.length * TIERS.length)).toFixed(0)} gén/cellule · ` +
  `${Object.values(grid).flatMap((r) => Object.values(r)).reduce((a, c) => a + c.evals, 0)} évals totales · ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min.`)
log(UNCONSTRAINED
  ? '\nBorne HAUTE : un ✓ prouve que le combat est théoriquement gagnable ; un ✗ = mur RÉEL (même l\'optimum cale).'
  : '\nRÉALISTE : un ✗ = le joueur ne peut pas FIELD le build requis à ce stade (mur d\'acquisition).')

const file = UNCONSTRAINED ? 'precondition-map.txt' : 'precondition-map-realiste.txt'
writeFileSync(file, out.join('\n'))
console.log(`\n(écrit dans ${file})`)
