// ============================================================================
// SIM GUERRIER HYBRIDE (section synergie « Juggernaut » : Sentence × Rempart) — calibrage TTK.
//
// Même démarche (charDerived réels + boucle régime permanent). Le guerrier Juggernaut fusionne
// OFFENSE et DÉFENSE : Endurance → Force (enduranceAs, EXISTANT), le bouclier (finisherShield) nourrit
// les finisseurs, et encaisser des coups génère de la Rage. La valeur d'un DPS-tank est en partie la
// SURVIE (que la sim DPS ne capture pas) → la section convertit les stats défensives en dégâts pour
// qu'un build TANKY frappe au niveau Sentence. On vérifie : (A) ×gain section borné + dans la bande,
// (B) INVARIANCE en ilvl, (C) l'hybride ne SUR-DPS pas le DPS pur (son edge = encaisser).
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

function gearedGuerrier(ci) {
  const c = makeCharacter('Guerrier', Math.max(1, Math.min(200, Math.round(ci / 4))), 'force')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: ci, rarity: 'legendaire', type: s.accepts, primary: 'force', stars: 3, ...(s.accepts === 'armePrincipale' ? { element: 'physique' } : {}) })
  c.equipment = eq
  return c
}

const R_AUTO = 0.6, BLEED_COEF = 0.55
const NAKED = {
  tagDirect: 1, tagFin: 1, damageMult: 1, finisherMult: 0, comboCap: 0, comboGen: 0, comboRefund: 0,
  bleed: false, hpBonus: 1, enduranceAs: 1, shieldFin: 0, rageOnHit: 1, execute: 0,
  multistrike: 0, enrageMult: 1,
}
// Épines : Sentence (Rage→finisseur, exécution, saignement) + Rempart (highHp/Colosse, un peu de finisher).
const STEMS = {
  ...NAKED,
  tagDirect: 1.12, tagFin: 1.15, damageMult: 1.15,        // Brutalité, Mise à mort, Soif de sang
  finisherMult: 0.25, comboCap: 4, comboGen: 1, comboRefund: 0,
  bleed: true, execute: 0.2,                              // Hémorragie + Exécution
  hpBonus: 1 + 0.20 * 0.7,                                // Colosse (+20 % à >60 % PV, uptime ~0,7)
}
// Section « Juggernaut » (paquet CALIBRÉ — défense → offense).
function withSection(base) {
  return {
    ...base,
    enduranceAs: 1.12,        // Indomptable : Endurance → Force (~+12 % de puissance) — BORNÉ (2 primaires, ratio ~constant)
    shieldFin: 0.16,          // Bouclier offensif : finisseur +shieldPct×0,16 (bouclier ≤ 50 % PV → cap +8 %)
    rageOnHit: 1.04,          // Vengeance : encaisser génère de la Rage → finisseurs un peu plus fréquents
    hpBonus: 1 + 0.26 * 0.7,  // Avatar : +6 pts au seuil Colosse (highHp 0,20→0,26)
  }
}

function loopDps(c, mod) {
  const d = charDerived(c)
  const pm = profileDamageMult(charDamageProfile(c))
  const H = d.power * d.masteryMult * d.overpower * pm * mod.enduranceAs   // enduranceAs = boost de puissance (FOR)
  const critF = 1 + d.critChance * (d.critMult - 1)
  const C = 5 + mod.comboCap, g = (1 + mod.comboGen) * mod.rageOnHit, pf = g / (g + Math.max(1, C - mod.comboRefund))
  const shieldFinMult = 1 + mod.shieldFin * 0.5   // bouclier ~50 % PV au cap → +shieldFin×0,5 au finisseur
  const exec = 1 + mod.execute * 0.5              // valeur moyenne de l'exécution (sous-seuil sur la durée du fight)
  const common = mod.damageMult * mod.hpBonus
  const Hauto = H * critF * mod.tagDirect * common
  const Hfin = H * critF * C * (1 + mod.finisherMult) * mod.tagFin * common * shieldFinMult * exec
  // BERSERKER : multifrappe (bi-arme) ajoute des coups ; Enrage (frenzy déclenché par les crits) multiplie tout.
  const ms = 1 + mod.multistrike
  const dpsActive = (R_AUTO + 0.5) * ((1 - pf) * Hauto + pf * Hfin) * ms * mod.enrageMult
  const dpsBleed = mod.bleed ? BLEED_COEF * H * d.alterationMult * common * mod.enrageMult : 0
  return { tot: dpsActive + dpsBleed, dpsActive, dpsBleed }
}
function repMulti(ci, modList, n = 14) {
  const sums = modList.map(() => ({ tot: 0, dpsActive: 0, dpsBleed: 0 }))
  for (let i = 0; i < n; i++) { const c = gearedGuerrier(ci); modList.forEach((m, j) => { const r = loopDps(c, m); for (const k in r) sums[j][k] += r[k] }) }
  for (const s of sums) for (const k in s) s[k] /= n
  return sums
}

console.log('================ SIM GUERRIER HYBRIDE — section « Juggernaut » (Sentence × Rempart) ================')
console.log(`b=${P.POW_BASE}  ·  cibles TTK trash ${TTK.trash}s / boss ${TTK.boss}s  ·  régime permanent mono-cible (relatif)\n`)
const CIS = [50, 150, 300, 400, 500, 700]
console.log('=== (1) DPS & TTK : naked → stems → stems+section (Guerrier FOR légendaire calé) ===')
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
// Bande Guerrier 1,18–1,45 : c'est un DPS-TANK → une part de la valeur de la section est la SURVIE
// (shield/thorns/flatDr/enduranceAs), invisible en sim DPS. On vise un DPS ≈ spec pure, pas un premium.
console.log(`\n  ${ok(xMin >= 1.18 && xMax <= 1.45)} gain SECTION dans la bande Guerrier (×${xMin.toFixed(2)}–${xMax.toFixed(2)}, cible 1,18–1,45)`)
console.log(`  ${ok(driftEg < 1.06)} INVARIANCE endgame ci≥400 (dérive ×${driftEg.toFixed(3)}, seuil 1,06) → pas de snowball`)

console.log('\n=== (2) Équilibre à ci=400 : le Juggernaut ne doit pas SUR-DPS le DPS pur (son edge = la survie) ===')
const PURE_SENTENCE = { ...STEMS, tagDirect: 1.12 * 1.12, tagFin: 1.15 * 1.18, finisherMult: 0.45, comboCap: 6, damageMult: 1.15, execute: 0.2, hpBonus: 1 }
const [rPure, rHy] = repMulti(400, [PURE_SENTENCE, withSection(STEMS)])
console.log(`  Sentence pur (DPS)        DPS ${fmt(rPure.tot).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / rPure.tot).toFixed(0)}s`)
console.log(`  Juggernaut (hybride)      DPS ${fmt(rHy.tot).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / rHy.tot).toFixed(0)}s`)
const ratio = rHy.tot / rPure.tot
console.log(`  ${ok(ratio >= 0.85 && ratio <= 1.12)} Juggernaut vs Sentence pur ×${ratio.toFixed(2)} (cible 0,85–1,12 : DPS comparable, mais BIEN plus tanky → c'est ça l'edge)`)

console.log('\n=== (3) Décomposition à ci=400 ===')
const r = repMulti(400, [withSection(STEMS)])[0]
console.log(`  Actif (auto+finisseur) : ${(100 * r.dpsActive / r.tot).toFixed(0)}%   Saignement : ${(100 * r.dpsBleed / r.tot).toFixed(0)}%`)
const d4 = charDerived(gearedGuerrier(400))
console.log(`  Stats réelles ci=400 : FOR-power ${fmt(d4.power)}  crit ${(100 * d4.critChance).toFixed(0)}%  ×crit ${d4.critMult.toFixed(2)}  réduc.Maîtrise ${(100 * d4.masteryDr).toFixed(0)}%`)

// ============================ BERSERKER « Furie » (Fury WoW : bi-arme + Enrage + vol de vie) ============================
// Voie DPS PURE distincte : gros dégâts soutenus, tanky par le VOL DE VIE (pas la mitigation).
function withBerserker(base) {
  return {
    ...base,
    multistrike: 0.18,    // Jumelage (bi-arme) : +18 % de coups
    enrageMult: 1.12,     // Enrage : crit → +15 % de dégâts (uptime ~0,8 → ~+12 % moyen, BORNÉ)
    damageMult: base.damageMult * 1.06, // Témérité : crit/dégâts crit pendant l'Enrage
    // le vol de vie élevé (Soif de sang) = la SURVIE, hors sim DPS
  }
}
console.log('\n================ BERSERKER « Furie » (voie DPS pure : Enrage + bi-arme + vol de vie) ================')
console.log('=== (4) DPS & invariance : naked → stems → stems+Furie ===')
console.log(' ci  | DPS stems | DPS +Furie | ×Furie')
const bms = []
for (const ci of CIS) {
  const [rS, rB] = repMulti(ci, [STEMS, withBerserker(STEMS)])
  const xB = rB.tot / rS.tot
  bms.push(xB)
  console.log(` ${String(ci).padStart(3)} | ${fmt(rS.tot).padStart(9)} | ${fmt(rB.tot).padStart(10)} | ${xB.toFixed(2)}`)
}
const bMin = Math.min(...bms), bMax = Math.max(...bms)
console.log(`  ${ok(bMin >= 1.25 && bMax <= 1.50)} gain FURIE dans la bande (×${bMin.toFixed(2)}–${bMax.toFixed(2)}, cible 1,25–1,50)`)
console.log(`  ${ok(bMax / bMin < 1.06)} INVARIANCE (dérive ×${(bMax / bMin).toFixed(3)}) → pas de snowball`)
// Les 3 voies DPS du guerrier à ci=400 — toutes viables, identités distinctes.
const [rSent, rJug, rBer] = repMulti(400, [PURE_SENTENCE, withSection(STEMS), withBerserker(STEMS)])
console.log('\n=== (5) Les voies DPS du guerrier à ci=400 (toutes viables) ===')
console.log(`  Sentence pur (Rage/exécution)   DPS ${fmt(rSent.tot).padStart(9)}`)
console.log(`  Juggernaut (tanky-DPS hybride)  DPS ${fmt(rJug.tot).padStart(9)}  (+ survie énorme)`)
console.log(`  Berserker/Furie (bi-arme/leech) DPS ${fmt(rBer.tot).padStart(9)}  (+ auto-sustain)`)
const spread2 = Math.max(rSent.tot, rJug.tot, rBer.tot) / Math.min(rSent.tot, rJug.tot, rBer.tot)
console.log(`  ${ok(spread2 <= 1.30)} écart entre les 3 voies DPS ×${spread2.toFixed(2)} (≤1,30 : aucune n'écrase, chacune a son edge)`)
