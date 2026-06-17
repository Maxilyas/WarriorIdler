// ============================================================================
// SIM VOLEUR HYBRIDE (section synergie Assassin × Ombrelame) — calibrage TTK.
//
// But : chiffrer la section « Lame Vénéneuse » et VÉRIFIER deux choses :
//   (A) le multiplicateur de DPS qu'elle apporte est dans une bande saine vs les voies pures,
//   (B) ce multiplicateur est INVARIANT en ilvl (≈ plat) → il ne crée PAS de snowball.
//
// Méthode : on ne réinvente pas le combat. On lit les VRAIES stats dérivées du jeu
// (charDerived : critChance/critMult/aps/alterationMult/multistrike… tous SOFT-CAPÉS) sur un
// Voleur équipé à l'ilvl du contenu (generateItem réel), et on pose au-dessus un modèle de boucle
// en régime permanent (générateur → finisseur + rampe de venin + détonation) qui applique
// l'agrégation EXACTE du moteur (damageMult produit, finisherMult/comboGen/poison additifs,
// tagBonus produit par tag, detonateDouble…). Les keystones de la section sont injectés comme un
// paquet de CombatMods calibré. Comme toutes les entrées sont bornées, le ×mult sort plat.
// ============================================================================
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charDamageProfile, charMaxHp } from './src/game/character.ts'
  export { generateItem } from './src/game/items.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export * as P from './src/game/progression.ts'
`)
const { makeCharacter, charDerived, charDamageProfile, profileDamageMult, generateItem, EQUIP_SLOTS, P } = M
const { enemyHp, TTK } = P
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const ok = (b) => b ? '✅' : '❌'

// --- Voleur équipé (Agilité, cuir, légendaire 3★) calé sur l'ilvl de contenu ci. ---
function gearedVoleur(ci) {
  const c = makeCharacter('Voleur', Math.max(1, Math.min(200, Math.round(ci / 4))), 'agilite')
  const eq = {}
  for (const s of EQUIP_SLOTS) {
    eq[s.id] = generateItem({ ilvl: ci, rarity: 'legendaire', type: s.accepts, primary: 'agilite', stars: 3, ...(s.accepts === 'armePrincipale' ? { element: 'physique' } : {}) })
  }
  c.equipment = eq
  return c
}

// --- Paquets de CombatMods (mêmes champs/agrégation que character.ts). ---
// "stems" = épine dorsale Assassin + Ombrelame (déjà investie dans un Voleur 100-120 pts).
// "section" = ce que la « Lame Vénéneuse » AJOUTE par-dessus (l'objet à calibrer).
const NAKED = {
  damageMult: 1, comboCap: 0, comboGen: 0, finisherMult: 0, comboRefund: 0, multistrike: 0,
  poison: { perStack: 0.08, maxStacks: 4 }, detonateDouble: false,
  tag: { direct: 1, finisseur: 1, dot: 1 }, finisherIsDot: false, poisonCrit: false,
  symbioseFin: 0, symbioseVen: 0, pacteFin: 0, detonateReapply: 0,
}
// Épine Ombrelame + Assassin (keystones existants, valeurs RÉELLES du talents.ts).
const STEMS = {
  ...NAKED,
  damageMult: 1.15 * 1.12,            // Danse de l'ombre × Dérobade
  comboCap: 2, comboGen: 2, finisherMult: 0.25, comboRefund: 2, multistrike: 0.18,
  poison: { perStack: 0.08 + 0.05, maxStacks: 4 + 2 }, detonateDouble: true,
  tag: { direct: 1.12, finisseur: 1.15, dot: 1.12 },
}
// Section synergie « Lame Vénéneuse » (paquet CALIBRÉ — c'est CE qu'on règle ici).
// v2 du calibrage : dégonflée + on RETIRE les scalings sur stat brute qui dérivaient en ilvl
// (symbioseVen sur critChance). Ce qui reste référence des quantités bornées/saturées ou des
// FENÊTRES conditionnelles plates → multiplicateur ≈ plat en endgame.
function withSection(base) {
  return {
    ...base,
    finisherMult: base.finisherMult + 0.10,         // +10 % de finisseur (gardé modeste)
    comboCap: base.comboCap + 1,                     // +1 plafond de combo
    poison: { perStack: base.poison.perStack + 0.02, maxStacks: base.poison.maxStacks + 2 },
    tag: { ...base.tag, finisseur: base.tag.finisseur * 1.10, dot: base.tag.dot * 1.08 },
    finisherIsDot: true,    // Lame Vénéneuse : le finisseur compte comme [dot] → gagne tag.dot (identité)
    poisonCrit: false,      // Lame critique = keystone OPT-IN (chiffré à part) : scale sur crit → hors paquet plat
    symbioseFin: 0.30,      // Symbiose : finisseur +0,30×(alterationMult-1)/5 — BORNÉ (alt cap 6,5)
    symbioseVen: 0,         // retiré : scalait sur critChance brute → dérive
    pacteFin: 0,            // Pacte de la toxine = keystone OPT-IN (tradeoff survie) — hors paquet par défaut
    detonateReapply: 0.4,   // Apothéose : détonation ré-applique 40 % → détonation soutenue
  }
}
// Keystones OPT-IN (pics conditionnels chiffrés séparément, hors paquet toujours-actif).
const withCrit = (m) => ({ ...m, poisonCrit: true })                       // Lame critique (crit≥60 %)
const withPacte = (m) => ({ ...m, pacteFin: 0.04 })                        // Pacte de la toxine (tradeoff survie)

// --- Boucle Voleur en régime permanent (DPS mono-cible soutenu). ---
const DIST_CD = 6 // s entre deux détonations (Distillation)
function loopDps(c, mod) {
  const d = charDerived(c)
  const prof = charDamageProfile(c)
  const pm = profileDamageMult(prof)
  // Coup de base (espérance non-crit) — MÊME formule que ttk-sim/dotDps.
  const H = d.power * d.masteryMult * d.overpower * pm * mod.damageMult
  const critF = 1 + d.critChance * (d.critMult - 1)              // facteur crit moyen (BORNÉ)
  const hits = d.attacksPerSecond * (1 + mod.multistrike)        // coups/s (multifrappe incluse)

  const C = 5 + mod.comboCap                                     // plafond de Points de Combo
  const g = 1 + mod.comboGen                                     // PC par générateur
  const pf = g / (g + Math.max(1, C - mod.comboRefund))          // proportion de coups = finisseurs
  // Symbiose : bonus de finisseur tiré de l'Altération (borné car alterationMult ≤ 6,5).
  const finSym = 1 + mod.symbioseFin * (d.alterationMult - 1) / 5
  const pacte = 1 + Math.min(0.40, mod.pacteFin * mod.poison.maxStacks)
  const finTag = mod.tag.finisseur * (mod.finisherIsDot ? mod.tag.dot : 1)
  const Hgen = H * critF * mod.tag.direct
  const Hfin = H * critF * C * (1 + mod.finisherMult) * finTag * finSym * pacte
  const dpsActive = hits * ((1 - pf) * Hgen + pf * Hfin)

  // Venin : en régime permanent on tient maxStacks. Chaque stack = perStack du coup/s.
  const venCrit = mod.poisonCrit ? critF : 1
  const venSym = 1 + mod.symbioseVen * d.critChance
  const venPerStackDps = H * mod.poison.perStack * d.alterationMult * mod.tag.dot * venCrit * venSym
  const dpsVenom = mod.poison.maxStacks * venPerStackDps

  // Détonation (Distillation) : consomme les stacks pour un pic, amortie sur son CD.
  // detonateReapply garde la rampe → on ne perd plus le temps de re-ramper (uptime ≈ 1).
  const detoStacks = mod.poison.maxStacks * (mod.detonateDouble ? 2 : 1)
  const detoHit = detoStacks * H * mod.poison.perStack * d.alterationMult * mod.tag.dot * venCrit
  const dpsDeto = (detoHit / DIST_CD) * (1 + mod.detonateReapply)

  return dpsActive + dpsVenom + dpsDeto
}

console.log('================ SIM VOLEUR HYBRIDE — section « Lame Vénéneuse » ================')
console.log(`b=${P.POW_BASE}  ·  cibles TTK trash ${TTK.trash}s / boss ${TTK.boss}s  ·  modèle régime permanent mono-cible\n`)

const CIS = [50, 150, 300, 400, 500, 700]
console.log('=== (1) DPS & TTK : naked → stems → stems+section (Voleur AGI légendaire calé) ===')
console.log(' ci  | DPS naked | DPS stems | DPS +sect | ×sect | ×total | TTK trash | TTK boss')
const mults = []
for (const ci of CIS) {
  const c = gearedVoleur(ci)
  const dN = loopDps(c, NAKED)
  const dS = loopDps(c, STEMS)
  const dH = loopDps(c, withSection(STEMS))
  const xSect = dH / dS, xTot = dH / dN
  mults.push({ ci, xSect, xTot })
  const tTrash = enemyHp(ci, 'trash') / dH, tBoss = enemyHp(ci, 'boss') / dH
  console.log(` ${String(ci).padStart(3)} | ${fmt(dN).padStart(9)} | ${fmt(dS).padStart(9)} | ${fmt(dH).padStart(9)} | ${xSect.toFixed(2)} | ${xTot.toFixed(2)} | ${tTrash.toFixed(1).padStart(8)}s | ${tBoss.toFixed(0).padStart(6)}s`)
}

// (A) bande saine : la section apporte un gain net mais pas démesuré.
const xs = mults.map((m) => m.xSect)
const xMin = Math.min(...xs), xMax = Math.max(...xs)
// (B) INVARIANCE en ENDGAME (ci≥400, comme le harnais ttk) : le ×section ne dérive pas.
// La rampe 50→400 = build qui « s'allume » (secondaires qui se remplissent), tolérée par le modèle.
const eg = mults.filter((m) => m.ci >= 400).map((m) => m.xSect)
const driftEg = Math.max(...eg) / Math.min(...eg)
const driftFull = xMax / xMin
console.log(`\n  ${ok(xMin >= 1.30 && xMax <= 1.85)} gain de la SECTION dans la bande (×${xMin.toFixed(2)}–${xMax.toFixed(2)}, cible 1,30–1,85)`)
console.log(`  ${ok(driftEg < 1.06)} INVARIANCE endgame ci≥400 (dérive ×${driftEg.toFixed(3)}, seuil 1,06) → pas de snowball`)
console.log(`     (dérive plein-range 50→700 ×${driftFull.toFixed(3)} = build qui s'allume, voulu)`)

// (2) Comparaison des trois identités à ci=400 (la section doit être COMPÉTITIVE, pas dominante).
console.log('\n=== (2) Trois identités à ci=400 (boss) — équilibre inter-builds ===')
const c4 = gearedVoleur(400)
const PURE_OMBRE = { ...STEMS, poison: { perStack: 0.08, maxStacks: 4 }, detonateDouble: false, tag: { direct: 1.12 * 1.12, finisseur: 1.15 * 1.18, dot: 1 }, finisherMult: 0.45, comboCap: 3 }
const PURE_ASSA = { ...STEMS, finisherMult: 0, comboCap: 0, comboGen: 0, tag: { direct: 1, finisseur: 1, dot: 1.12 * 1.18 }, poison: { perStack: 0.08 + 0.05 + 0.06, maxStacks: 4 + 2 + 2 }, detonateDouble: true }
for (const [name, mod] of [['Ombrelame pur', PURE_OMBRE], ['Assassin pur', PURE_ASSA], ['Hybride (stems+section)', withSection(STEMS)]]) {
  const dps = loopDps(c4, mod)
  console.log(`  ${name.padEnd(24)} DPS ${fmt(dps).padStart(9)}  TTK boss ${(enemyHp(400, 'boss') / dps).toFixed(0)}s`)
}
const dPure = Math.max(loopDps(c4, PURE_OMBRE), loopDps(c4, PURE_ASSA))
const dHyb = loopDps(c4, withSection(STEMS))
const spread = dHyb / dPure
console.log(`  ${ok(spread >= 1.0 && spread <= 1.35)} l'hybride bat le meilleur build pur de ×${spread.toFixed(2)} (cible 1,0–1,35 : récompense l'investissement sans écraser)`)

// (3) Décomposition de la source du gain (où va la puissance de la section).
console.log('\n=== (3) Décomposition du DPS hybride à ci=400 ===')
;(function () {
  const c = c4, mod = withSection(STEMS)
  const d = charDerived(c), pm = profileDamageMult(charDamageProfile(c))
  const H = d.power * d.masteryMult * d.overpower * pm * mod.damageMult
  const critF = 1 + d.critChance * (d.critMult - 1)
  const hits = d.attacksPerSecond * (1 + mod.multistrike)
  const C = 5 + mod.comboCap, g = 1 + mod.comboGen, pf = g / (g + Math.max(1, C - mod.comboRefund))
  const finSym = 1 + mod.symbioseFin * (d.alterationMult - 1) / 5, pacte = 1 + Math.min(0.4, mod.pacteFin * mod.poison.maxStacks)
  const finTag = mod.tag.finisseur * (mod.finisherIsDot ? mod.tag.dot : 1)
  const venCrit = mod.poisonCrit ? critF : 1, venSym = 1 + mod.symbioseVen * d.critChance
  const dpsActive = hits * ((1 - pf) * H * critF * mod.tag.direct + pf * H * critF * C * (1 + mod.finisherMult) * finTag * finSym * pacte)
  const dpsVenom = mod.poison.maxStacks * H * mod.poison.perStack * d.alterationMult * mod.tag.dot * venCrit * venSym
  const detoHit = mod.poison.maxStacks * (mod.detonateDouble ? 2 : 1) * H * mod.poison.perStack * d.alterationMult * mod.tag.dot * venCrit
  const dpsDeto = (detoHit / DIST_CD) * (1 + mod.detonateReapply)
  const tot = dpsActive + dpsVenom + dpsDeto
  console.log(`  Actif (gén+finisseur) : ${(100 * dpsActive / tot).toFixed(0)}%   Venin soutenu : ${(100 * dpsVenom / tot).toFixed(0)}%   Détonation : ${(100 * dpsDeto / tot).toFixed(0)}%`)
  console.log(`  Stats clés réelles à ci=400 : crit ${(100 * d.critChance).toFixed(0)}%  ×crit ${d.critMult.toFixed(2)}  aps ${d.attacksPerSecond.toFixed(2)}  altMult ${d.alterationMult.toFixed(2)}  multifrappe ${(100 * d.multistrike).toFixed(0)}%`)
})()

// (4) Keystones OPT-IN : pic conditionnel chiffré (gain sur le build hybride de base).
console.log('\n=== (4) Keystones OPT-IN : ×gain conditionnel (sur hybride à ci=400) ===')
const baseH = loopDps(c4, withSection(STEMS))
console.log(`  Lame critique  (venin crite, crit≥60 %) : ×${(loopDps(c4, withCrit(withSection(STEMS))) / baseH).toFixed(2)}  → récompense le cap de Critique`)
console.log(`  Pacte de la toxine (+4 %/stack, perd le drain) : ×${(loopDps(c4, withPacte(withSection(STEMS))) / baseH).toFixed(2)}  → tradeoff survie`)
console.log(`  Les deux ensemble                              : ×${(loopDps(c4, withCrit(withPacte(withSection(STEMS)))) / baseH).toFixed(2)}`)
