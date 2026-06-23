// Harnais de couverture ÉCO-CRAFT : courbes coût/rendement des trois puits de craft —
//  1) Améliorations du Marché (puits d'or + Éclats/Poussière),
//  2) Automates de forge (farm hors-ligne : rendement/heure vs coût de construction),
//  3) Alchimie (courbe de qualité des brassins + économie des réactifs).
// Utilise le VRAI code du jeu (transpilé via esbuild) — pas de copie de règles, donc pas de dérive.
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { UPGRADES, UPGRADE_CATEGORIES, upgradeCost, upgradePoussiere, upgradeEclats, isMaxed, computeGlobalMods } from './src/game/upgrades.ts'
  export { AUTOMATE_COSTS, AUTOMATE_MAX, AUTOMATE_UPG_MAX, AUTOMATE_EFF_BASE, AUTOMATE_EFF_PER_YIELD, AUTOMATE_NAMES, automateUpgradeCost, automateEfficiency, automateRunDuration, tickAutomates } from './src/game/automates.ts'
  export { BREWS, brewQualityAt, BREW_QUALITIES, BREW_PERFECT_FROM, BREW_PERFECT_TO, millesimeChance, EXPERIMENT_COST, REAGENT_DROP, recipeForPair } from './src/game/alchimie.ts'
  export { DUNGEONS } from './src/game/dungeons.ts'
`)
const {
  UPGRADES, upgradeCost, upgradePoussiere, upgradeEclats, isMaxed, computeGlobalMods,
  AUTOMATE_COSTS, AUTOMATE_UPG_MAX, AUTOMATE_EFF_BASE, AUTOMATE_EFF_PER_YIELD, automateUpgradeCost, automateEfficiency, automateRunDuration, tickAutomates,
  BREWS, brewQualityAt, BREW_QUALITIES, BREW_PERFECT_FROM, BREW_PERFECT_TO, millesimeChance, EXPERIMENT_COST, REAGENT_DROP, recipeForPair,
  DUNGEONS,
} = M

let errors = 0, warns = 0
const fail = (m) => { errors++; console.log('  ✗ ' + m) }
const warn = (m) => { warns++; console.log('  ⚠ ' + m) }
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const pct = (n) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'

/* ====================================================================== */
/* 1) AMÉLIORATIONS — puits d'or : courbe de coût + effet à un niveau cible */
/* ====================================================================== */
console.log('=== 1) Améliorations du Marché (puits d\'or) ===')
// Niveau cible d'évaluation : maxLevel si plafonné, sinon un niveau d'illustration (10).
const SAMPLE_LV = 10
// Champ de GlobalMods touché par chaque amélioration (pour mesurer l'effet vivant).
const FIELD = { goldGain: 'goldGain', xpGain: 'xpGain', eclatGain: 'eclatGain', lootQty: 'lootChance', rarityLuck: 'rarityLuck', talentBonus: 'talentBonus', forgeStellaire: 'power' }
for (const u of UPGRADES) {
  if (!(u.growth > 1)) fail(`${u.id} : growth ≤ 1 (${u.growth}) → coût non croissant`)
  const target = u.maxLevel ?? SAMPLE_LV
  let gold = 0, pous = 0, ecl = 0
  for (let l = 0; l < target; l++) { gold += upgradeCost(u, l); pous += upgradePoussiere(u, l); ecl += upgradeEclats(u, l) }
  // Effet vivant : computeGlobalMods doit bouger AU MOINS un champ entre niveau 0 et niveau cible.
  const g0 = computeGlobalMods({}), gN = computeGlobalMods({ [u.id]: target })
  const moved = Object.keys(g0).some((k) => g0[k] !== gN[k])
  if (!moved) fail(`${u.id} : aucun effet sur GlobalMods (amélioration non câblée dans computeGlobalMods)`)
  const f = FIELD[u.id]
  const eff = f ? (typeof gN[f] === 'number' && gN[f] > 2 ? `${f}=${gN[f].toFixed(2)}` : pct(gN[f] - g0[f]).replace('+', `${f} +`)) : '—'
  const cap = u.maxLevel ? `max ${u.maxLevel}` : `niv ${target} (∞)`
  console.log(`  ${u.icon} ${u.id.padEnd(14)} ${cap.padEnd(10)} → ${fmt(gold).padStart(8)} or${pous ? ` · ${fmt(pous)} 🌌` : ''}${ecl ? ` · ${fmt(ecl)} ♦` : ''}   effet : ${eff}`)
}
console.log('')

/* ====================================================================== */
/* 2) AUTOMATES — rendement/heure vs coût (recouvrement)                  */
/* ====================================================================== */
console.log('=== 2) Automates de forge (farm hors-ligne) ===')
const goldEntry = Object.entries(DUNGEONS).find(([, d]) => d.reward === 'gold')
if (!goldEntry) { warn('aucun donjon à récompense « gold » — section automates ignorée') }
else {
  const [goldId, goldDef] = goldEntry
  const BEST_STAGE = 300, MISSION_LV = 10
  const mkAuto = (speedLvl, yieldLvl) => ({ id: 0, name: 'Sim', mission: { kind: 'dungeon', id: goldId, level: MISSION_LV }, progress: 0, paused: false, speedLvl, yieldLvl, bank: {} })
  const goldPerHour = (speedLvl, yieldLvl) => {
    const eco = { automates: [mkAuto(speedLvl, yieldLvl)], bestStage: BEST_STAGE, gold: 0, essence: 0, noyau: 0, poussiere: 0, sceaux: 1e12, orbes: 1e12, fragments: 0, gemDust: 0 }
    const r = tickAutomates(eco, 3600)
    return r ? r.eco.gold : 0
  }
  // Intégrité : durée finie, efficacité dans [base, max], rendement positif.
  const dur0 = automateRunDuration(mkAuto(0, 0)), durMax = automateRunDuration(mkAuto(AUTOMATE_UPG_MAX, 0))
  const effMax = automateEfficiency(mkAuto(0, AUTOMATE_UPG_MAX))
  if (!(dur0 > 0 && Number.isFinite(dur0))) fail(`durée de run invalide (${dur0})`)
  if (effMax > AUTOMATE_EFF_BASE + AUTOMATE_EFF_PER_YIELD * AUTOMATE_UPG_MAX + 1e-9) fail(`efficacité max hors borne (${effMax})`)
  const g0 = goldPerHour(0, 0), gMax = goldPerHour(AUTOMATE_UPG_MAX, AUTOMATE_UPG_MAX)
  if (!(g0 > 0)) fail(`rendement nul sur un donjon « gold » (${g0})`)
  const buildGold = AUTOMATE_COSTS.reduce((a, c) => a + c.gold, 0)
  let upgGold = 0; for (let l = 0; l < AUTOMATE_UPG_MAX; l++) upgGold += automateUpgradeCost('speed', l) + automateUpgradeCost('yield', l)
  console.log(`  Mission de réf : ${goldDef.icon} ${goldDef.name} niv. ${MISSION_LV} · record ${BEST_STAGE} · clés illimitées`)
  console.log(`  Durée/run : ${dur0.toFixed(0)}s (nu) → ${durMax.toFixed(0)}s (vitesse max) · efficacité ${(automateEfficiency(mkAuto(0, 0)) * 100).toFixed(0)}% → ${(effMax * 100).toFixed(0)}%`)
  console.log(`  Or/heure : ${fmt(g0)} (nu) → ${fmt(gMax)} (max) · soit ×${(gMax / g0).toFixed(2)} par les améliorations`)
  const cosmicTot = AUTOMATE_COSTS.reduce((a, c) => a + c.cosmic, 0), fragTot = AUTOMATE_COSTS.reduce((a, c) => a + c.fragments, 0)
  console.log(`  Construire les 4 automates : ${fmt(buildGold)} or · ${fragTot} ✨ · ${cosmicTot} 💫 (+ poussière) · maxer 1 machine : ${fmt(upgGold)} or`)
  console.log(`  Recouvrement OR d'1 machine : ~${(AUTOMATE_COSTS[0].gold / gMax).toFixed(1)} h de farm — l'or se rembourse vite ; le vrai gate de construction, ce sont les mats rares (💫/✨).`)
}
console.log('')

/* ====================================================================== */
/* 3) ALCHIMIE — courbe de qualité + économie des réactifs               */
/* ====================================================================== */
console.log('=== 3) Alchimie (brassage) ===')
// Recettes : paires DISTINCTES (sinon recipeForPair est ambigu).
const pairSeen = new Map()
for (const b of BREWS) {
  const key = [...b.recipe].sort().join('+')
  if (pairSeen.has(key)) fail(`paire de réactifs dupliquée : ${key} (${b.id} & ${pairSeen.get(key)})`)
  pairSeen.set(key, b.id)
  if (recipeForPair(b.recipe[0], b.recipe[1])?.id !== b.id) fail(`${b.id} : recipeForPair ne retrouve pas la recette`)
  // Courbe : Trouble avant maturation, PARFAIT dans la fenêtre, Pur après.
  const need = b.brewMin
  const before = brewQualityAt(b, need * 0.5), at = brewQualityAt(b, need), perfect = brewQualityAt(b, need * (BREW_PERFECT_FROM + BREW_PERFECT_TO) / 2), after = brewQualityAt(b, need * 2)
  if (before !== 0) fail(`${b.id} : récolté trop tôt n'est pas « Trouble » (q=${before})`)
  if (at < 1) fail(`${b.id} : à maturité pas « Pur » (q=${at})`)
  if (perfect !== 2) fail(`${b.id} : fenêtre parfaite ne donne pas « Parfait » (q=${perfect})`)
  if (after !== 1) fail(`${b.id} : trop infusé devrait retomber « Pur » (q=${after})`)
}
console.log(`  ${BREWS.length} recettes · paires distinctes : ${pairSeen.size === BREWS.length ? 'OK' : 'NON'} · qualités ×${BREW_QUALITIES[0].mult}/×${BREW_QUALITIES[1].mult}/×${BREW_QUALITIES[2].mult}/×${BREW_QUALITIES[3].mult}`)
console.log('  Fenêtre parfaite = [brewMin×' + BREW_PERFECT_FROM + ' ; ×' + BREW_PERFECT_TO + ']  ·  millésime à Parfait : ' + pct(millesimeChance(0)) + ' (→ ' + pct(millesimeChance(3)) + ' avec Grands crus)')
for (const b of BREWS) {
  const lo = (b.brewMin * BREW_PERFECT_FROM).toFixed(0), hi = (b.brewMin * BREW_PERFECT_TO).toFixed(0)
  console.log(`  ${b.icon} ${b.id.padEnd(15)} ${String(b.brewMin).padStart(3)} min → Pur · Parfait dans [${lo}–${hi}] min · coût ${b.cost}×2 réactifs`)
}
// Économie des réactifs : combien de kills pour UN brassin, selon la source.
console.log('  Économie réactifs (kills pour 1 brassin de coût 3×2=6 réactifs, ' + (REAGENT_DROP.normal * 100).toFixed(0) + '%/' + (REAGENT_DROP.elite * 100).toFixed(0) + '%/' + (REAGENT_DROP.boss * 100).toFixed(0) + '% normal/élite/boss) :')
for (const [src, rate] of Object.entries(REAGENT_DROP)) {
  console.log(`    ${src.padEnd(7)} : ~${Math.ceil(6 / rate)} kills/brassin · 1 expérimentation = ${EXPERIMENT_COST} réactifs (~${Math.ceil(EXPERIMENT_COST / rate)} kills)`)
}
console.log('')

/* ---------- bilan ---------- */
console.log(`=== Bilan : ${errors} erreur(s) d'intégrité · ${warns} avertissement(s). ===`)
if (errors > 0) process.exit(1)
console.log('✓ Économie de craft cohérente (courbes coût/rendement saines ; tables ci-dessus pour le calibrage).')
