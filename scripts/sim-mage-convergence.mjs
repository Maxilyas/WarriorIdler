// ============================================================================
// SIM MAGE — CONVERGENCE TRI-ÉLÉMENTAIRE (feu × givre × arcane) — calibrage TTK.
//
// Concept : une section qui se rejoint sur les nœuds les PLUS PROFONDS des 3 archétypes (Pyro/Cryo/Arc).
// C'est un build-engagement COMPLET : les 3 signatures se répondent (Hot Streak → Charges, Surcharge →
// gel, gel → embrasement) et un payoff « Trinité » récompense d'avoir les 3 états élémentaires ACTIFS.
//
// Particularité de calibrage : combiner 3 systèmes MULTIPLICATIFS (shatter × Hot Streak × Surcharge)
// est intrinsèquement très fort → le tri-build DOIT être plus puissant qu'un build pur, MAIS il coûte
// TOUT le budget (~100-120 pts dans une seule classe) là où un pur/paire laisse de quoi multi-classer.
// On VÉRIFIE donc : (A) la SECTION (convergence) sur les tri-stems = ×gain modeste + borné (le combo
// est déjà le gros de la puissance), (B) INVARIANCE en ilvl, (C) le tri reste dans un premium
// raisonnable vs pur (≤ ~×1,7, assumé : c'est le coût/récompense d'un build mono-classe total).
// ============================================================================
import { build } from 'esbuild'
const load = async (e) => { const r = await build({ stdin: { contents: e, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')) }
const M = await load(`
  export { makeCharacter, charDerived, charDamageProfile } from './src/game/character.ts'
  export { generateItem } from './src/game/items.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export * as P from './src/game/progression.ts'
`)
const { makeCharacter, charDerived, charDamageProfile, profileDamageMult, generateItem, EQUIP_SLOTS, P } = M
const { enemyHp, TTK } = P
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const ok = (b) => b ? '✅' : '❌'

function gearedMage(ci) {
  const c = makeCharacter('Mage', Math.max(1, Math.min(200, Math.round(ci / 4))), 'intelligence')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: ci, rarity: 'legendaire', type: s.accepts, primary: 'intelligence', stars: 3, ...(s.accepts === 'armePrincipale' ? { element: 'arcane' } : {}) })
  c.equipment = eq
  return c
}

// Cadences (régime permanent) — un tri-mage tisse les 3 écoles.
const R_FIRE = 0.30, R_FROST = 0.28, R_ARC = 0.30, IGNITE_COEF = 0.45

const NAKED = {
  tagFeu: 1, tagFroid: 1, tagArc: 1, tagDot: 1, damageMult: 1,
  shatter: 0, frozenUp: 0, hotStreak: 1, overloadBonus: 0, overloadUp: 0, ignite: false,
  trinityPer: 0, states: 0, frozenIgnite: 0,
}
// Tri-stems : profond dans les 3, mais aucun poussé aussi loin qu'un specialist (budget réparti).
const TRI_STEMS = {
  ...NAKED,
  tagFeu: 1.18, tagFroid: 1.12, tagArc: 1.12, tagDot: 1.12, damageMult: 1.15,
  shatter: 0.20 + 0.25, frozenUp: 0.5,          // Fracas+Glaciation (pas Abîme), Cône occasionnel
  hotStreak: 1.18, ignite: true,
  overloadBonus: 0.4, overloadUp: 0.4,          // Surcharge ×1,4, uptime ~40 %
}
// Section CONVERGENCE (le payoff de la cascade tri-élémentaire — toujours-actif sur un tri-build).
function withConvergence(base) {
  return {
    ...base,
    frozenUp: 0.66,                 // Gel arcanique : la Surcharge gèle le pack → gel fiable (hausse modeste)
    overloadUp: 0.48,               // Combustion runique : Hot Streak donne des Charges → Surcharge un peu plus souvent
    frozenIgnite: 0.10,             // Fracas ardent : les coups sur gelé embrasent (ignite +)
    trinityPer: 0.07, states: 3,    // TRINITÉ : +7 % par état élémentaire ACTIF (embrasement/gel/surcharge), max 3 → ×1,21
  }
}

function loopDps(c, mod) {
  const d = charDerived(c)
  const pm = profileDamageMult(charDamageProfile(c))
  const H = d.power * d.masteryMult * d.overpower * pm
  const critF = 1 + d.critChance * (d.critMult - 1)
  const shatterAvg = 1 + mod.shatter * mod.frozenUp
  const overloadAvg = 1 + mod.overloadBonus * mod.overloadUp
  const trinity = 1 + mod.trinityPer * mod.states          // payoff borné (states ≤ 3)
  const common = mod.damageMult * shatterAvg * overloadAvg * trinity
  const dpsFire = R_FIRE * 3.0 * H * critF * mod.tagFeu * common * mod.hotStreak
  const dpsFrost = R_FROST * 3.0 * H * critF * mod.tagFroid * common
  const dpsArc = R_ARC * 3.2 * H * critF * mod.tagArc * common
  const dpsIgnite = mod.ignite ? IGNITE_COEF * H * d.alterationMult * mod.tagDot * mod.tagFeu * common * (1 + mod.frozenIgnite + 0.25 * mod.frozenUp) : 0
  return { tot: dpsFire + dpsFrost + dpsArc + dpsIgnite, dpsFire, dpsFrost, dpsArc, dpsIgnite }
}
function repMulti(ci, modList, n = 14) {
  const sums = modList.map(() => ({ tot: 0, dpsFire: 0, dpsFrost: 0, dpsArc: 0, dpsIgnite: 0 }))
  for (let i = 0; i < n; i++) { const c = gearedMage(ci); modList.forEach((m, j) => { const r = loopDps(c, m); for (const k in r) sums[j][k] += r[k] }) }
  for (const s of sums) for (const k in s) s[k] /= n
  return sums
}

console.log('================ SIM MAGE — CONVERGENCE TRI-ÉLÉMENTAIRE (feu × givre × arcane) ================')
console.log(`b=${P.POW_BASE}  ·  cibles TTK trash ${TTK.trash}s / boss ${TTK.boss}s  ·  régime permanent mono-cible (relatif)\n`)
const CIS = [50, 150, 300, 400, 500, 700]
console.log('=== (1) DPS & TTK : naked → tri-stems → +convergence (Mage INT légendaire calé) ===')
console.log(' ci  | DPS naked | DPS tri   | DPS +conv | ×conv | ×total | TTK trash | TTK boss')
const mults = []
for (const ci of CIS) {
  const [rN, rT, rC] = repMulti(ci, [NAKED, TRI_STEMS, withConvergence(TRI_STEMS)])
  const xConv = rC.tot / rT.tot
  mults.push({ ci, xConv })
  console.log(` ${String(ci).padStart(3)} | ${fmt(rN.tot).padStart(9)} | ${fmt(rT.tot).padStart(9)} | ${fmt(rC.tot).padStart(9)} | ${xConv.toFixed(2)} | ${(rC.tot / rN.tot).toFixed(2)} | ${(enemyHp(ci,'trash')/rC.tot).toFixed(1).padStart(8)}s | ${(enemyHp(ci,'boss')/rC.tot).toFixed(0).padStart(6)}s`)
}
const xs = mults.map((m) => m.xConv), xMin = Math.min(...xs), xMax = Math.max(...xs)
const eg = mults.filter((m) => m.ci >= 400).map((m) => m.xConv), driftEg = Math.max(...eg) / Math.min(...eg)
console.log(`\n  ${ok(xMin >= 1.20 && xMax <= 1.45)} gain CONVERGENCE dans la bande (×${xMin.toFixed(2)}–${xMax.toFixed(2)}, cible 1,20–1,45 : le combo EST déjà le gros)`)
console.log(`  ${ok(driftEg < 1.06)} INVARIANCE endgame ci≥400 (dérive ×${driftEg.toFixed(3)}, seuil 1,06) → pas de snowball`)

console.log('\n=== (2) Le coût/récompense : tri-convergence vs build PUR à ci=400 ===')
const PURE_PYRO = { ...TRI_STEMS, tagFeu: 1.18 * 1.12, damageMult: 1.15 * 1.12, shatter: 0, frozenUp: 0, hotStreak: 1.6, overloadBonus: 0, overloadUp: 0, tagFroid: 1, tagArc: 1 }
const PURE_CRYO = { ...TRI_STEMS, tagFroid: 1.12 * 1.12, shatter: 0.20 + 0.25 + 0.30, frozenUp: 0.88, hotStreak: 1, ignite: false, overloadBonus: 0, overloadUp: 0, tagFeu: 1, tagArc: 1 }
const PURE_ARC = { ...TRI_STEMS, tagArc: 1.12 * 1.15, damageMult: 1.15 * 1.15, overloadBonus: 0.4, overloadUp: 0.62, shatter: 0, frozenUp: 0, hotStreak: 1, ignite: false, tagFeu: 1, tagFroid: 1 }
const [rP, rCr, rA, rConv] = repMulti(400, [PURE_PYRO, PURE_CRYO, PURE_ARC, withConvergence(TRI_STEMS)])
for (const [name, r] of [['Pyromancien pur', rP], ['Cryomancien pur', rCr], ['Arcaniste pur', rA], ['Convergence (tri)', rConv]])
  console.log(`  ${name.padEnd(20)} DPS ${fmt(r.tot).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / r.tot).toFixed(0)}s`)
const bestPure = Math.max(rP.tot, rCr.tot, rA.tot)
const triVsPure = rConv.tot / bestPure
console.log(`  ${ok(triVsPure <= 1.6)} tri vs meilleur pur ×${triVsPure.toFixed(2)} (≤1,6 : premium assumé d'un build mono-classe TOTAL ~110 pts, vs pur ~60 pts + 2e classe)`)

console.log('\n=== (3) Décomposition à ci=400 ===')
const r = repMulti(400, [withConvergence(TRI_STEMS)])[0]
console.log(`  Feu : ${(100 * r.dpsFire / r.tot).toFixed(0)}%   Froid : ${(100 * r.dpsFrost / r.tot).toFixed(0)}%   Arcane : ${(100 * r.dpsArc / r.tot).toFixed(0)}%   Embrasement : ${(100 * r.dpsIgnite / r.tot).toFixed(0)}%`)
console.log(`  TRINITÉ payoff (3 états actifs) = ×${(1 + 0.07 * 3).toFixed(2)} — borné (states ≤ 3, indépendant de l'ilvl)`)
