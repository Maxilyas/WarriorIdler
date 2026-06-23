/**
 * Harnais d'intégrité de l'arbre de talents (npx tsx scripts/check-talents.ts) :
 *  - ids uniques, prérequis existants, capacités débloquées existantes ;
 *  - tout nœud atteignable depuis la racine `co_start` ;
 *  - verrous de seuil finissables (gate ≤ points disponibles dans la constellation) ;
 *  - complétabilité PAR BUILD : chaque nœud est allouable dans au moins un build valide
 *    (les choix `exclusive` ne se prennent pas en même temps — on teste la faisabilité, pas
 *    une allocation simultanée totale).
 */
import { TALENTS, CONSTELLATION_LIST, isReachable, getTalent } from '../src/game/talents'
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

// 3) Gates de budget finissables : `minSpent` ne dépasse jamais les points disponibles dans la
//    constellation (modèle courant : la porte compte les points dépensés dans la MÊME constellation).
for (const c of CONSTELLATION_LIST) {
  const nodes = TALENTS.filter((t) => t.constellation === c)
  const totalPts = nodes.reduce((a, x) => a + x.maxRank, 0)
  for (const n of nodes) {
    const need = n.minSpent ?? 0
    if (need > 0) {
      const avail = totalPts - n.maxRank // points venant des AUTRES nœuds de la constellation
      if (need > avail) fail(`${c}/${n.id} : minSpent ${need} > points disponibles dans la constellation (${avail})`)
    }
  }
}

// 4) Complétabilité PAR BUILD : chaque nœud doit être allouable dans AU MOINS un build valide.
//    On ne peut pas tout prendre à la fois (les `exclusive` l'interdisent), donc on teste la
//    faisabilité individuelle : adjacence satisfaite, rang prérequis atteignable, gate `minSpent`
//    couvrable par le budget de la constellation. `full` = toutes les prérequis « disponibles ».
const full: Record<string, number> = {}
for (const t of TALENTS) full[t.id] = t.maxRank
for (const t of TALENTS) {
  if (!isReachable(t, full)) fail(`inatteignable par adjacence : ${t.id} (${t.name}) — requires/requiresAll/links cassés`)
  if (t.requiresRank) {
    const dep = getTalent(t.requiresRank.id)
    if (!dep || dep.maxRank < t.requiresRank.rank) fail(`${t.id} : requiert rang ${t.requiresRank.rank} sur ${t.requiresRank.id} (max ${dep?.maxRank ?? 0})`)
  }
  if (t.minSpent) {
    const budget = TALENTS.filter((x) => x.constellation === t.constellation && x.id !== t.id).reduce((a, x) => a + x.maxRank, 0)
    if (t.minSpent > budget) fail(`${t.id} : minSpent ${t.minSpent} > budget de la constellation (${budget})`)
  }
}

const totalPts = TALENTS.reduce((a, t) => a + t.maxRank, 0)
console.log(`\n${TALENTS.length} nœuds · ${totalPts} points cumulés · ${CONSTELLATION_LIST.length} constellations · ${errors} erreur(s).`)
if (errors > 0) process.exit(1)
console.log('✓ Arbre de talents intègre.')
