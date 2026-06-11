/**
 * Harnais d'intégrité de l'arbre de talents (npx tsx scripts/check-talents.ts) :
 *  - ids uniques, prérequis existants, capacités débloquées existantes ;
 *  - tout nœud atteignable depuis la racine `co_start` ;
 *  - verrous de palier finissables (gate ≤ points disponibles dans la constellation) ;
 *  - simulation gloutonne : un perso à N points peut-il réellement tout débloquer ?
 */
import { TALENTS, CONSTELLATION_LIST, canAllocate, tierGate, getTalent } from '../src/game/talents'
import { POWERS } from '../src/game/powers'

let errors = 0
const fail = (msg: string) => { errors++; console.error('✗', msg) }

// 1) Ids uniques + prérequis existants + powers existants.
const ids = new Set<string>()
const powerIds = new Set(POWERS.map((p) => p.id))
for (const t of TALENTS) {
  if (ids.has(t.id)) fail(`id dupliqué : ${t.id}`)
  ids.add(t.id)
  for (const r of t.requires ?? []) if (!getTalent(r)) fail(`${t.id} requiert un nœud inconnu : ${r}`)
  if (t.unlockPower && !powerIds.has(t.unlockPower)) fail(`${t.id} débloque une capacité inconnue : ${t.unlockPower}`)
}

// 2) Atteignabilité depuis la racine (graphe des requires).
const reached = new Set<string>(['co_start'])
let grew = true
while (grew) {
  grew = false
  for (const t of TALENTS) {
    if (reached.has(t.id)) continue
    if ((t.requires ?? []).every((r) => reached.has(r))) { reached.add(t.id); grew = true }
  }
}
for (const t of TALENTS) if (!reached.has(t.id)) fail(`nœud inatteignable : ${t.id} (${t.name})`)

// 3) Gates finissables : le besoin ne dépasse jamais les points disponibles dans le tier visé.
for (const c of CONSTELLATION_LIST) {
  const nodes = TALENTS.filter((t) => t.constellation === c)
  for (const n of nodes) {
    const g = tierGate(n)
    if (g.need > 0) {
      const avail = nodes.filter((x) => x.tier === g.tier).reduce((a, x) => a + x.maxRank, 0)
      if (g.need > avail) fail(`${c}/${n.id} : gate ${g.need} > points disponibles au tier ${g.tier} (${avail})`)
    }
  }
}

// 4) Simulation gloutonne : avec beaucoup de points, tout l'arbre doit être complétable.
const talents: Record<string, number> = { co_start: 1 }
let progressed = true
let spent = 0
while (progressed) {
  progressed = false
  for (const t of TALENTS) {
    while ((talents[t.id] ?? 0) < t.maxRank && canAllocate(t, talents, 9999)) {
      talents[t.id] = (talents[t.id] ?? 0) + 1
      spent++
      progressed = true
    }
  }
}
const unfinished = TALENTS.filter((t) => (talents[t.id] ?? 0) < t.maxRank)
for (const t of unfinished) fail(`incomplétable même à points infinis : ${t.id} (${t.name}) — rang ${talents[t.id] ?? 0}/${t.maxRank}`)

console.log(`\n${TALENTS.length} nœuds · ${spent} points dépensés en simulation gloutonne · ${errors} erreur(s).`)
if (errors > 0) process.exit(1)
console.log('✓ Arbre de talents intègre.')
