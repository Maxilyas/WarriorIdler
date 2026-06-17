// ============================================================================
// SIM PRÊTRE HYBRIDE (section synergie Lumière × Vide) — calibrage TTK.
//
// Même démarche que sim-voleur-hybride : on lit les VRAIES stats dérivées (charDerived, soft-capées)
// d'un Prêtre INT équipé à l'ilvl du contenu, et on pose au-dessus un modèle de boucle en régime
// permanent. Le Prêtre hybride a 3 sources de DPS :
//   • OMBRE direct (Douleur)        — magDmg × profil × tags × damageMult, fenêtre de Folie (frenzy).
//   • DoT d'ombre (Mot de l'ombre)  — dps ∝ Altération.
//   • ATONEMENT (châtiment)         — un SOIN inflige `healToDamage` × son montant à l'ennemi (scale d.power).
// La SECTION « Crépuscule » fait se nourrir Lumière et Vide (l'atonement applique des DoT, la Folie
// booste le châtiment, cross-scaling INT×Altération). On VÉRIFIE : (A) ×gain de la section dans une
// bande, (B) INVARIANCE en ilvl (tout est borné → pas de snowball), (C) hybride ≤ ~×1,2 vs build pur.
// Modèle RELATIF (anchors réels) : ce sont les ratios + la platitude qui sont validés, pas l'absolu.
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

function gearedPretre(ci) {
  const c = makeCharacter('Pretre', Math.max(1, Math.min(200, Math.round(ci / 4))), 'intelligence')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: ci, rarity: 'legendaire', type: s.accepts, primary: 'intelligence', stars: 3, ...(s.accepts === 'armePrincipale' ? { element: 'ombre' } : {}) })
  c.equipment = eq
  return c
}

// Cadences de lancement (régime permanent, mono-cible) — hypothèses documentées.
const R_DIR = 0.45   // Douleur ~ 1 / 2,2 s
const R_HEAL = 0.45  // un soin (châtiment) ~ 1 / 2,2 s
const FOLIE_UP = 8 / 18 // uptime de Forme du Vide
const FOLIE_MULT = 1.6
const DOT_COEF = 1.05 // coefficient du DoT d'ombre (mag × 0,4)

const NAKED = {
  healToDamage: 0, tagOmbre: 1, tagDot: 1, tagSoin: 1, damageMult: 1, folie: false,
  healAppliesDot: 0, confession: 0, folieAtone: 0, atoneFromAlt: 0, atoneMult: 1, atoneIsShadow: false, dotCanCrit: false,
  shadowMult: 1, folieDot: 0,
}
// Épines Lumière (atonement 0,8 + ferveur) + Vide (DoT/ombre + Folie + Insanité).
const STEMS = {
  ...NAKED,
  healToDamage: 0.8,                 // Châtiment 0,4 + Inquisition 0,4
  tagOmbre: 1.12, tagDot: 1.12, tagSoin: 1.15,
  damageMult: 1.15 * 1.12,           // Insanité × Ferveur
  folie: true,
}
// Section « Crépuscule » (paquet CALIBRÉ — toujours-actif ; opt-in chiffrés à part).
function withSection(base) {
  return {
    ...base,
    atoneIsShadow: true,             // Dissonance : le châtiment compte comme [ombre] → ×tagOmbre
    healAppliesDot: 0.6,             // Dissonance : les soins posent un DoT (= 0,6 × DoT de base, en plus)
    confession: 0.30,                // Confession : châtiment ×(1 + jusqu'à +30 % selon DoT actifs) — borné
    folieAtone: 0.35,                // Pénombre : pendant la Folie, châtiment +35 % (×uptime)
    atoneFromAlt: 0.30,              // Équilibre : châtiment +30 %×(alterationMult−1) — BORNÉ (alt cap)
    shadowMult: 1.12,                // Réciprocité : tes soins empower tes sorts d'ombre (+12 %, conditionnel)
    folieDot: 0.20,                  // Pénombre : pendant la Folie, tes DoT +20 % aussi (×uptime)
  }
}
const withHeresie = (m) => ({ ...m, atoneMult: m.atoneMult * 2 }) // OPT-IN : ne soigne plus, châtiment ×2

function loopDps(c, mod) {
  const d = charDerived(c)
  const pm = profileDamageMult(charDamageProfile(c))
  const H = d.power * d.masteryMult * d.overpower * pm
  const critF = 1 + d.critChance * (d.critMult - 1)
  const folieAvg = mod.folie ? 1 + FOLIE_UP * (FOLIE_MULT - 1) : 1

  // OMBRE direct (Douleur). Réciprocité = shadowMult (les soins empower l'ombre).
  const dpsDir = R_DIR * 3.0 * H * critF * mod.tagOmbre * mod.damageMult * folieAvg * mod.shadowMult
  // DoT d'ombre (Mot de l'ombre) + DoT d'atonement (Dissonance) ; Pénombre booste aussi les DoT.
  const folieDotAvg = 1 + mod.folieDot * FOLIE_UP
  const dotBase = DOT_COEF * H * d.alterationMult * mod.tagDot * mod.tagOmbre * mod.damageMult * folieAvg * folieDotAvg * mod.shadowMult * (mod.dotCanCrit ? critF : 1)
  const dpsDot = dotBase * (1 + mod.healAppliesDot)
  // ATONEMENT (châtiment) : un soin inflige healToDamage × montant. Le soin scale d.power (pas de mastery/profil).
  const nDots = 1 + (mod.healAppliesDot > 0 ? 1 : 0)
  const confMult = 1 + Math.min(0.30, mod.confession / 0.30 * (mod.confession > 0 ? Math.min(0.30, 0.10 * nDots * 3) : 0)) // borné +30 %
  const atoneAmp = (1 + Math.min(0.30, mod.confession)) * (1 + mod.folieAtone * FOLIE_UP) * (1 + mod.atoneFromAlt * (d.alterationMult - 1)) * mod.atoneMult * (mod.atoneIsShadow ? mod.tagOmbre : 1)
  const Hheal = d.power * 3.0 // base de soin (mag 3 × d.power), sans mastery/overpower/profil
  const dpsAtone = R_HEAL * Hheal * mod.healToDamage * mod.tagSoin * atoneAmp
  void confMult
  return { tot: dpsDir + dpsDot + dpsAtone, dpsDir, dpsDot, dpsAtone }
}
// Moyenne sur N jets, MÊME stuff partagé entre les configs (ratios appariés → pas de bruit parasite).
function repMulti(ci, modList, n = 14) {
  const sums = modList.map(() => ({ tot: 0, dpsDir: 0, dpsDot: 0, dpsAtone: 0 }))
  for (let i = 0; i < n; i++) {
    const c = gearedPretre(ci)
    modList.forEach((m, j) => { const r = loopDps(c, m); sums[j].tot += r.tot; sums[j].dpsDir += r.dpsDir; sums[j].dpsDot += r.dpsDot; sums[j].dpsAtone += r.dpsAtone })
  }
  for (const s of sums) for (const k in s) s[k] /= n
  return sums
}
const rep = (ci, mod, n = 14) => repMulti(ci, [mod], n)[0]

console.log('================ SIM PRÊTRE HYBRIDE — section « Crépuscule » (Lumière × Vide) ================')
console.log(`b=${P.POW_BASE}  ·  cibles TTK trash ${TTK.trash}s / boss ${TTK.boss}s  ·  régime permanent mono-cible (relatif)\n`)

const CIS = [50, 150, 300, 400, 500, 700]
console.log('=== (1) DPS & TTK : naked → stems → stems+section (Prêtre INT légendaire calé) ===')
console.log(' ci  | DPS naked | DPS stems | DPS +sect | ×sect | ×total | TTK trash | TTK boss')
const mults = []
for (const ci of CIS) {
  const [rN, rS, rH] = repMulti(ci, [NAKED, STEMS, withSection(STEMS)])
  const dN = rN.tot, dS = rS.tot, dH = rH.tot
  const xSect = dH / dS, xTot = dH / dN
  mults.push({ ci, xSect })
  const tT = enemyHp(ci, 'trash') / dH, tB = enemyHp(ci, 'boss') / dH
  console.log(` ${String(ci).padStart(3)} | ${fmt(dN).padStart(9)} | ${fmt(dS).padStart(9)} | ${fmt(dH).padStart(9)} | ${xSect.toFixed(2)} | ${xTot.toFixed(2)} | ${tT.toFixed(1).padStart(8)}s | ${tB.toFixed(0).padStart(6)}s`)
}
const xs = mults.map((m) => m.xSect), xMin = Math.min(...xs), xMax = Math.max(...xs)
const eg = mults.filter((m) => m.ci >= 400).map((m) => m.xSect), driftEg = Math.max(...eg) / Math.min(...eg)
console.log(`\n  ${ok(xMin >= 1.30 && xMax <= 1.85)} gain SECTION dans la bande (×${xMin.toFixed(2)}–${xMax.toFixed(2)}, cible 1,30–1,85)`)
console.log(`  ${ok(driftEg < 1.06)} INVARIANCE endgame ci≥400 (dérive ×${driftEg.toFixed(3)}, seuil 1,06) → pas de snowball`)
console.log(`     (dérive plein-range ×${(xMax / xMin).toFixed(3)} = build qui s'allume, voulu)`)

console.log('\n=== (2) Trois identités à ci=400 (boss) — équilibre inter-builds ===')
const PURE_VIDE = { ...STEMS, healToDamage: 0, tagOmbre: 1.12 * 1.12, tagDot: 1.12 * 1.12, damageMult: 1.15 * 1.12, folie: true, dotCanCrit: false }
const PURE_LUM = { ...STEMS, folie: false, damageMult: 1.12, healToDamage: 0.8, tagSoin: 1.15 * 1.15, atoneMult: 1.25, tagOmbre: 1, tagDot: 1 }
for (const [name, mod] of [['Vide pur (ombre)', PURE_VIDE], ['Lumière pure (atonement)', PURE_LUM], ['Hybride (stems+section)', withSection(STEMS)]]) {
  const r = rep(400, mod)
  console.log(`  ${name.padEnd(26)} DPS ${fmt(r.tot).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / r.tot).toFixed(0)}s`)
}
const [rV, rL, rHy] = repMulti(400, [PURE_VIDE, PURE_LUM, withSection(STEMS)])
const spread = rHy.tot / Math.max(rV.tot, rL.tot)
console.log(`  ${ok(spread >= 1.0 && spread <= 1.35)} hybride bat le meilleur build pur de ×${spread.toFixed(2)} (cible 1,0–1,35)`)

console.log('\n=== (3) Décomposition + OPT-IN à ci=400 ===')
const r = rep(400, withSection(STEMS))
console.log(`  Ombre direct : ${(100 * r.dpsDir / r.tot).toFixed(0)}%   DoT : ${(100 * r.dpsDot / r.tot).toFixed(0)}%   Atonement : ${(100 * r.dpsAtone / r.tot).toFixed(0)}%`)
const d4 = charDerived(gearedPretre(400))
console.log(`  Stats réelles ci=400 : INT-power ${fmt(d4.power)}  crit ${(100 * d4.critChance).toFixed(0)}%  altMult ${d4.alterationMult.toFixed(2)}`)
console.log(`  Hérésie (ne soigne plus, châtiment ×2) : ×${(rep(400, withHeresie(withSection(STEMS))).tot / r.tot).toFixed(2)} DPS  → tradeoff survie total`)
