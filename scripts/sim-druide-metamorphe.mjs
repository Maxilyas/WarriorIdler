// ============================================================================
// SIM DRUIDE — « LA DANSE PRIMORDIALE » (Métamorphe) — mécanique NEUVE : formes rotatives.
//
// Système inédit : le druide CHANGE DE FORME en boucle (Fauve → Ours → Hibou, ~5 s chacune). Chaque
// forme applique un don tant qu'elle est active. Chaque métamorphose accumule de l'INSTINCT (momentum :
// +x % dégâts/stack, décroît si on cesse de changer → l'auto-cycle le maintient). Capstone « Mémoire
// des formes » : on conserve une part de la forme quittée (écho) → on finit par cumuler les 3 aspects.
//
// DPS = MOYENNE sur le cycle (Fauve burst / Ours bruiser+survie / Hibou caster-DoT) × Instinct.
// La forme Ours apporte la SURVIE (hors sim DPS) → la vraie valeur du métamorphe est sa polyvalence.
// On vérifie : (A) ×gain borné + bande, (B) INVARIANCE ilvl (formes/instinct = % fixes, bornés),
// (C) métamorphe ≈ Lunaire pur en DPS (son edge = fluidité + survie de l'Ours).
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

function gearedDruide(ci) {
  const c = makeCharacter('Druide', Math.max(1, Math.min(200, Math.round(ci / 4))), 'intelligence')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: ci, rarity: 'legendaire', type: s.accepts, primary: 'intelligence', stars: 3, ...(s.accepts === 'armePrincipale' ? { element: 'nature' } : {}) })
  c.equipment = eq
  return c
}

const R_DIR = 0.35, R_FIN = 0.30, DOT_COEF = 1.0
const NAKED = {
  tagDot: 1, tagDirect: 1, damageMult: 1, finisherMult: 0, comboCap: 0, comboGen: 0,
  // métamorphe :
  shifter: false, fFauve: 0, fOurs: 0, fHibou: 0, instinctPer: 0, instinctMax: 0, echo: 0,
}
// Épines druide (DoT astral + finisseur Pouvoir astral), SANS le système de formes.
const STEMS = {
  ...NAKED,
  tagDot: 1.12, tagDirect: 1.12, damageMult: 1.15, finisherMult: 0.25, comboCap: 2, comboGen: 1,
}
// Section « Danse Primordiale » — le système de FORMES + Instinct.
function withMetamorphe(base) {
  return {
    ...base,
    shifter: true,
    fFauve: 0.35,    // Forme du Fauve : +35 % de dégâts (fenêtre burst)
    fOurs: 0.18,     // Forme de l'Ours : +18 % de dégâts (+ survie/épines, hors sim)
    fHibou: 0.30,    // Forme du Hibou : +30 % de dégâts (caster/DoT)
    instinctPer: 0.04, instinctMax: 5,  // Instinct : +4 %/stack, max 5 → l'auto-cycle maintient ~4 stacks
    echo: 0,
  }
}
const withEcho = (m) => ({ ...m, echo: 0.5 }) // Mémoire des formes (capstone) : +50 % d'écho (cumul partiel des formes)

function loopDps(c, mod) {
  const d = charDerived(c)
  const pm = profileDamageMult(charDamageProfile(c))
  const H = d.power * d.masteryMult * d.overpower * pm
  const critF = 1 + d.critChance * (d.critMult - 1)
  const C = 5 + mod.comboCap, g = 1 + mod.comboGen, pf = g / (g + C)
  // FORMES : multiplicateur de dégâts MOYEN sur le cycle (3 formes, temps égal). Écho = on garde une
  // part de la forme quittée → la moyenne monte vers le max (on cumule les aspects).
  let formMult = 1
  if (mod.shifter) {
    const avg = (mod.fFauve + mod.fOurs + mod.fHibou) / 3
    const echoBoost = mod.echo * ((mod.fFauve + mod.fHibou) / 2 - mod.fOurs / 3) // l'écho cumule surtout l'offensif
    formMult = 1 + avg + Math.max(0, echoBoost)
  }
  // INSTINCT : momentum (auto-cycle → ~80 % du max maintenu), BORNÉ.
  const instinct = 1 + mod.instinctPer * mod.instinctMax * 0.8
  const common = mod.damageMult * formMult * instinct
  const dpsDot = 2 * DOT_COEF * H * d.alterationMult * mod.tagDot * common
  const dpsFin = R_FIN * H * critF * C * (1 + mod.finisherMult) * mod.tagDirect * common * 1.15
  const dpsDir = R_DIR * 2.6 * H * critF * mod.tagDirect * common
  return { tot: dpsDot + dpsFin + dpsDir, dpsDot, dpsFin, dpsDir, formMult, instinct }
}
function repMulti(ci, modList, n = 14) {
  const sums = modList.map(() => ({ tot: 0, dpsDot: 0, dpsFin: 0, dpsDir: 0 }))
  for (let i = 0; i < n; i++) { const c = gearedDruide(ci); modList.forEach((m, j) => { const r = loopDps(c, m); for (const k in sums[j]) sums[j][k] += r[k] }) }
  for (const s of sums) for (const k in s) s[k] /= n
  return sums
}

console.log('================ SIM DRUIDE — « LA DANSE PRIMORDIALE » (Métamorphe, système de formes) ================')
console.log(`b=${P.POW_BASE}  ·  cibles TTK trash ${TTK.trash}s / boss ${TTK.boss}s  ·  régime permanent mono-cible (relatif)\n`)
const CIS = [50, 150, 300, 400, 500, 700]
console.log('=== (1) DPS & TTK : naked → stems → stems+métamorphe (Druide INT légendaire calé) ===')
console.log(' ci  | DPS naked | DPS stems | DPS +méta | ×méta | ×total | TTK trash | TTK boss')
const mults = []
for (const ci of CIS) {
  const [rN, rS, rH] = repMulti(ci, [NAKED, STEMS, withMetamorphe(STEMS)])
  const xM = rH.tot / rS.tot
  mults.push({ ci, xM })
  console.log(` ${String(ci).padStart(3)} | ${fmt(rN.tot).padStart(9)} | ${fmt(rS.tot).padStart(9)} | ${fmt(rH.tot).padStart(9)} | ${xM.toFixed(2)} | ${(rH.tot / rN.tot).toFixed(2)} | ${(enemyHp(ci,'trash')/rH.tot).toFixed(1).padStart(8)}s | ${(enemyHp(ci,'boss')/rH.tot).toFixed(0).padStart(6)}s`)
}
const xs = mults.map((m) => m.xM), xMin = Math.min(...xs), xMax = Math.max(...xs)
const driftEg = Math.max(...mults.filter((m) => m.ci >= 400).map((m) => m.xM)) / Math.min(...mults.filter((m) => m.ci >= 400).map((m) => m.xM))
console.log(`\n  ${ok(xMin >= 1.30 && xMax <= 1.55)} gain MÉTAMORPHE dans la bande (×${xMin.toFixed(2)}–${xMax.toFixed(2)}, cible 1,30–1,55)`)
console.log(`  ${ok(driftEg < 1.06)} INVARIANCE endgame ci≥400 (dérive ×${driftEg.toFixed(3)}) → pas de snowball (formes/instinct = % fixes bornés)`)

console.log('\n=== (2) Métamorphe ≈ Lunaire pur en DPS (son edge = fluidité + survie de l\'Ours) ===')
const PURE_LUNAIRE = { ...STEMS, tagDot: 1.12 * 1.12, tagDirect: 1.12 * 1.12, damageMult: 1.15 * 1.12, finisherMult: 0.4, comboCap: 3 }
const [rPure, rMeta, rEcho] = repMulti(400, [PURE_LUNAIRE, withMetamorphe(STEMS), withEcho(withMetamorphe(STEMS))])
console.log(`  Lunaire pur (DoT/astral)        DPS ${fmt(rPure.tot).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / rPure.tot).toFixed(0)}s`)
console.log(`  Métamorphe (formes)             DPS ${fmt(rMeta.tot).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / rMeta.tot).toFixed(0)}s  (+ Ours = survie)`)
console.log(`  Métamorphe + Mémoire des formes DPS ${fmt(rEcho.tot).padStart(9)}  (capstone : cumul des aspects)`)
const ratio = rMeta.tot / rPure.tot
console.log(`  ${ok(ratio >= 0.9 && ratio <= 1.2)} Métamorphe vs Lunaire pur ×${ratio.toFixed(2)} (cible 0,9–1,2)`)
console.log(`  capstone Écho : ×${(rEcho.tot / rMeta.tot).toFixed(2)} (gain du cumul des formes)`)

console.log('\n=== (3) Détail des formes à ci=400 ===')
const c4 = gearedDruide(400), base = withMetamorphe(STEMS)
const probe = (fauve, ours, hibou) => loopDps(c4, { ...base, fFauve: fauve, fOurs: ours, fHibou: hibou }).formMult
console.log(`  formMult moyen (cycle) = ×${loopDps(c4, base).formMult.toFixed(2)}  ·  Instinct = ×${loopDps(c4, base).instinct.toFixed(2)}`)
console.log(`  Fauve seul ×${(1 + base.fFauve).toFixed(2)}  ·  Ours seul ×${(1 + base.fOurs).toFixed(2)} (+survie/épines)  ·  Hibou seul ×${(1 + base.fHibou).toFixed(2)}`)
void probe
