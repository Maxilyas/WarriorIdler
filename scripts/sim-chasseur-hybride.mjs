// ============================================================================
// SIM CHASSEUR HYBRIDE (section « Symbiose » : Meute × Œil de faucon) — calibrage TTK.
//
// Le chasseur Symbiose chasse avec sa bête : le FAMILIER (petDps, fraction continue de ton DPS) et
// la CONCENTRATION (combo → Tir visé/finisseur) se nourrissent. La section : le familier hérite de
// ta Précision/Critique (petBonus), un finisseur commande au familier de BONDIR (petBurst), les
// attaques du familier génèrent de la Concentration (→ plus de finisseurs), et ta MARQUE amplifie
// tes dégâts ET ceux du familier. On vérifie : (A) ×gain borné + dans la bande, (B) INVARIANCE ilvl,
// (C) hybride ≤ ~×1,3 vs build pur (Meute pur OU Faucon pur). Modèle relatif, anchors réels.
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

function gearedChasseur(ci) {
  const c = makeCharacter('Chasseur', Math.max(1, Math.min(200, Math.round(ci / 4))), 'agilite')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: ci, rarity: 'legendaire', type: s.accepts, primary: 'agilite', stars: 3, ...(s.accepts === 'armePrincipale' ? { element: 'physique' } : {}) })
  c.equipment = eq
  return c
}

const R_AUTO = 0.7
const NAKED = {
  tagDirect: 1, tagFin: 1, damageMult: 1, finisherMult: 0, comboCap: 0, comboGen: 0,
  petDps: 0, petBonus: 1, petCombo: 0, petBurst: 0, mark: 1, execute: 0,
}
// Épines : Meute (familier petDps) + Œil de faucon (Concentration → finisseur, exécution).
const STEMS = {
  ...NAKED,
  tagDirect: 1.12, tagFin: 1.15, damageMult: 1.12 * 1.15,    // Coordination/Visée, carrefours
  finisherMult: 0.25, comboCap: 4, comboGen: 1, execute: 0.2,
  petDps: 0.6,                                               // Familier (0,3) + un peu de meute (build réparti)
}
// Section « Symbiose » (paquet CALIBRÉ — chasseur ⇄ bête).
function withSection(base) {
  return {
    ...base,
    petBonus: 1.25,   // Meute affûtée : le familier hérite de ta Précision/Critique (+25 %)
    petCombo: 1,      // Lien instinctif : le familier génère de la Concentration → +1 cran de cadence de finisseur
    petBurst: 0.6,    // Symbiose : un finisseur fait BONDIR le familier (≈ 0,6 s de DPS de familier en pic)
    mark: 1.10,       // Marque du chasseur : +10 % de TES dégâts ET de ceux du familier sur la cible marquée
  }
}

function loopDps(c, mod) {
  const d = charDerived(c)
  const pm = profileDamageMult(charDamageProfile(c))
  const H = d.power * d.masteryMult * d.overpower * pm
  const critF = 1 + d.critChance * (d.critMult - 1)
  const C = 5 + mod.comboCap, g = (1 + mod.comboGen) + mod.petCombo, pf = g / (g + C)  // petCombo = cadence de finisseur ↑
  const exec = 1 + mod.execute * 0.5
  const common = mod.damageMult * mod.mark
  const Hauto = H * critF * mod.tagDirect * common
  const Hfin = H * critF * C * (1 + mod.finisherMult) * mod.tagFin * common * exec
  const dpsActive = (R_AUTO + 0.4) * ((1 - pf) * Hauto + pf * Hfin)
  // FAMILIER : DPS continu = petDps × DPS THÉORIQUE d'auto (cadence incluse), × petBonus, × marque ; bond sur finisseur.
  const petBase = mod.petDps * ((R_AUTO + 0.4) * H * critF * common) * mod.petBonus
  const dpsPet = petBase * (1 + mod.petBurst * pf)   // Symbiose : le bond du familier sur chaque finisseur
  return { tot: dpsActive + dpsPet, dpsActive, dpsPet }
}
function repMulti(ci, modList, n = 14) {
  const sums = modList.map(() => ({ tot: 0, dpsActive: 0, dpsPet: 0 }))
  for (let i = 0; i < n; i++) { const c = gearedChasseur(ci); modList.forEach((m, j) => { const r = loopDps(c, m); for (const k in r) sums[j][k] += r[k] }) }
  for (const s of sums) for (const k in s) s[k] /= n
  return sums
}

console.log('================ SIM CHASSEUR HYBRIDE — section « Symbiose » (Meute × Œil de faucon) ================')
console.log(`b=${P.POW_BASE}  ·  cibles TTK trash ${TTK.trash}s / boss ${TTK.boss}s  ·  régime permanent mono-cible (relatif)\n`)
const CIS = [50, 150, 300, 400, 500, 700]
console.log('=== (1) DPS & TTK : naked → stems → stems+section (Chasseur AGI légendaire calé) ===')
console.log(' ci  | DPS naked | DPS stems | DPS +sect | ×sect | ×total | TTK trash | TTK boss')
const mults = []
for (const ci of CIS) {
  const [rN, rS, rH] = repMulti(ci, [NAKED, STEMS, withSection(STEMS)])
  const xSect = rH.tot / rS.tot
  mults.push({ ci, xSect })
  console.log(` ${String(ci).padStart(3)} | ${fmt(rN.tot).padStart(9)} | ${fmt(rS.tot).padStart(9)} | ${fmt(rH.tot).padStart(9)} | ${xSect.toFixed(2)} | ${(rH.tot / rN.tot).toFixed(2)} | ${(enemyHp(ci,'trash')/rH.tot).toFixed(1).padStart(8)}s | ${(enemyHp(ci,'boss')/rH.tot).toFixed(0).padStart(6)}s`)
}
const xs = mults.map((m) => m.xSect), xMin = Math.min(...xs), xMax = Math.max(...xs)
const eg = mults.filter((m) => m.ci >= 400).map((m) => m.xSect), driftEg = Math.max(...eg) / Math.min(...eg)
console.log(`\n  ${ok(xMin >= 1.30 && xMax <= 1.85)} gain SECTION dans la bande (×${xMin.toFixed(2)}–${xMax.toFixed(2)}, cible 1,30–1,85)`)
console.log(`  ${ok(driftEg < 1.06)} INVARIANCE endgame ci≥400 (dérive ×${driftEg.toFixed(3)}, seuil 1,06) → pas de snowball`)

console.log('\n=== (2) Équilibre à ci=400 : Symbiose vs builds purs ===')
const PURE_MEUTE = { ...STEMS, petDps: 1.15, damageMult: 1.12 * 1.12, finisherMult: 0, comboCap: 0, tagFin: 1 }
const PURE_FAUCON = { ...STEMS, petDps: 0, finisherMult: 0.45, comboCap: 6, tagFin: 1.15 * 1.15, tagDirect: 1.12 * 1.12, execute: 0.2 }
const [rMe, rFa, rHy] = repMulti(400, [PURE_MEUTE, PURE_FAUCON, withSection(STEMS)])
for (const [name, r] of [['Meute pure (familier)', rMe], ['Œil de faucon pur (tir)', rFa], ['Symbiose (hybride)', rHy]])
  console.log(`  ${name.padEnd(24)} DPS ${fmt(r.tot).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / r.tot).toFixed(0)}s`)
const spread = rHy.tot / Math.max(rMe.tot, rFa.tot)
console.log(`  ${ok(spread >= 1.0 && spread <= 1.35)} hybride vs meilleur pur ×${spread.toFixed(2)} (cible 1,0–1,35)`)

console.log('\n=== (3) Décomposition à ci=400 ===')
const r = repMulti(400, [withSection(STEMS)])[0]
console.log(`  Chasseur (auto+finisseur) : ${(100 * r.dpsActive / r.tot).toFixed(0)}%   Familier : ${(100 * r.dpsPet / r.tot).toFixed(0)}%`)
const d4 = charDerived(gearedChasseur(400))
console.log(`  Stats réelles ci=400 : AGI-power ${fmt(d4.power)}  crit ${(100 * d4.critChance).toFixed(0)}%  ×crit ${d4.critMult.toFixed(2)}`)
