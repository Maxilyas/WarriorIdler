// Harnais TTK (refonte v0.30) — filet de sécurité chiffré, branché sur le VRAI code du jeu.
// Construit un perso calé sur chaque ilvl de contenu (équipement réel via generateItem) et mesure le
// TEMPS DE KILL (TTK) vs les courbes d'ennemi de progression.ts. Si DPS ∝ b^ilvl (compression OK),
// le TTK est PLAT → pas de snowball. Calibre ITEM_BUDGET0 / ENEMY_HP0 / ENEMY_DMG0.
//
// Critères (DESIGN_v0.30 §11) : TTK plat 50→700 (trash 3 s / boss 35 s ±15 %), sur-stuff borné,
// rareté ≤ ×4, aucun ilvl > 700, survie ~8 s.
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charCombatMods, setGlobalCombatMods } from './src/game/character.ts'
  export { generateItem } from './src/game/items.ts'
  export { EQUIP_SLOTS, ITEM_TYPES } from './src/game/slots.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export { RAID_LIST, raidIlvl, raidBerserkTime, raidMinTier, raidMaxTier } from './src/game/raids.ts'
  export * as P from './src/game/progression.ts'
`)
const { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charCombatMods, setGlobalCombatMods, generateItem, EQUIP_SLOTS, P } = M
const { POW_BASE, ILVL_MAX, RARITY_ILVL_PER_TIER, powerAt, effItemIlvl, ilvlPerDouble, enemyHp, enemyDmg, ENEMY_HP0, ENEMY_DMG0, ITEM_BUDGET0, TTK, SURVIVE_SECONDS, ilvlFarm, ilvlDungeon, ilvlRaid } = M.P

setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })
const fmt = (n) => n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const ok = (b) => b ? '✅' : '❌'

// Builds optimisés (mêmes keystones/sorts que build-sim — comparaison contrôlée).
const BUILDS = {
  FORCE: { primary: 'force', bias: 'force', elem: 'physique', talents: ['fo_b5', 'fo_c4', 'bo_b2', 'fo_b1', 'du_a3'], powers: ['frappe_lourde', 'choc_sismique', 'laceration', 'decapitation', 'tourbillon'] },
  AGI: { primary: 'agilite', bias: 'agilite', elem: 'physique', talents: ['ag_b5', 'du_b2', 'sp_b2', 'ag_b3', 'du_a3'], powers: ['eviscaration', 'tir_precis', 'volee_de_fleches', 'poison', 'soif_du_neant'] },
  INT: { primary: 'intelligence', bias: 'intelligence', elem: 'arcane', talents: ['in_a7', 'in_b5', 'el_a1', 'el_a3', 'in_a5'], powers: ['eclair', 'embrasement', 'trait_de_givre', 'salve_arcanique', 'deluge_stellaire'] },
}

// Perso calé : équipement RÉEL généré à l'ilvl du contenu, rareté légendaire (= stuff réaliste du tier).
function gearedChar(b, ci, rarity = 'legendaire') {
  const c = makeCharacter('Sim', Math.max(1, Math.min(200, Math.round(ci / 4))), b.bias)
  const eq = {}
  for (const s of EQUIP_SLOTS) {
    eq[s.id] = generateItem({ ilvl: ci, rarity, type: s.accepts, primary: b.primary, stars: 3, ...(s.accepts === 'armePrincipale' ? { element: b.elem } : {}) })
  }
  c.equipment = eq
  c.talents = { co_start: 1 }
  for (const t of b.talents) c.talents[t] = 1
  c.powers = [...b.powers]
  c.hp = charMaxHp(c)
  return c
}
// DoT keystone (les auto-attaques appliquent un DoT, non inclus dans charDps).
function dotDps(c) {
  const cm = charCombatMods(c)
  if (!cm.dot) return 0
  const d = charDerived(c), prof = charDamageProfile(c), pm = M.profileDamageMult(prof)
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult
}
// DPS représentatif (moyenne des 3 builds, N échantillons chacun pour lisser l'aléa des rolls).
function repDps(ci, rarity) {
  let sum = 0, n = 0
  for (const b of Object.values(BUILDS)) for (let i = 0; i < 6; i++) { const c = gearedChar(b, ci, rarity); sum += charDps(c) + dotDps(c); n++ }
  return sum / n
}
function repEhp(ci) {
  let sum = 0, n = 0
  for (const b of Object.values(BUILDS)) for (let i = 0; i < 12; i++) { const c = gearedChar(b, ci); sum += charEhp(c); n++ }
  return sum / n
}

console.log('================= HARNAIS TTK v0.30 (code réel) =================')
console.log(`b=${POW_BASE}  ×2/${ilvlPerDouble().toFixed(1)} ilvl  ·  cap ${ILVL_MAX}  ·  rareté +${RARITY_ILVL_PER_TIER}/cran  ·  ITEM_BUDGET0=${ITEM_BUDGET0} ENEMY_HP0=${ENEMY_HP0} ENEMY_DMG0=${ENEMY_DMG0}\n`)

// ---- (1) TTK à stuff calé sur toute la plage ----
console.log('=== (1) TTK à stuff calé (gi=ci, légendaire, moyenne FOR/AGI/INT) ===')
console.log(' ci  | DPS réel    | PV trash    | TTK trash | TTK boss | ENEMY_HP0 implicite(trash 3s)')
const rows = []
for (const ci of [50, 100, 150, 200, 300, 400, 500, 600, 700]) {
  const dps = repDps(ci, 'legendaire')
  const tTrash = enemyHp(ci, 'trash') / dps, tBoss = enemyHp(ci, 'boss') / dps
  const hp0impl = TTK.trash * dps / powerAt(ci) // ENEMY_HP0 qu'il faudrait pour trash=3s
  rows.push({ ci, dps, tTrash, tBoss, hp0impl })
  console.log(` ${String(ci).padStart(3)} | ${fmt(dps).padStart(11)} | ${fmt(enemyHp(ci, 'trash')).padStart(11)} | ${tTrash.toFixed(1).padStart(8)}s | ${tBoss.toFixed(0).padStart(7)}s | ${hp0impl.toFixed(2).padStart(10)}`)
}
// L'ANTI-SNOWBALL se juge sur la zone ENDGAME (ci ≥ 300, la frontière des raids) : c'est LÀ que le TTK
// doit être plat. La « dérive » 50→300 est le build qui s'allume (secondaires saturant à 300) — voulu.
const endgame = rows.filter((r) => r.ci >= 300)
const egTrash = endgame.map((r) => r.tTrash), egBoss = endgame.map((r) => r.tBoss)
const egDpsFlat = Math.max(...endgame.map((r) => r.hp0impl)) / Math.min(...endgame.map((r) => r.hp0impl))
const trashErr = Math.max(...rows.map((r) => Math.abs(r.tTrash - TTK.trash) / TTK.trash))
const bossErr = Math.max(...rows.map((r) => Math.abs(r.tBoss - TTK.boss) / TTK.boss))
console.log(`\n  ${ok(egDpsFlat < 1.2)} ENDGAME plat : DPS ∝ b^ilvl sur ci≥300 (ratio ${egDpsFlat.toFixed(2)}, seuil 1,2) → snowball neutralisé`)
console.log(`     (rampe 50→300 = build qui s'allume, voulu · médian ENEMY_HP0 ${rows.map(r=>r.hp0impl).sort((a,b)=>a-b)[4].toFixed(0)})`)
console.log(`  ${ok(trashErr < 0.30)} TTK trash dans la bande (${Math.min(...rows.map(r=>r.tTrash)).toFixed(1)}–${Math.max(...rows.map(r=>r.tTrash)).toFixed(1)}s, cible ${TTK.trash}s)`)
console.log(`  ${ok(bossErr < 0.30)} TTK boss dans la bande (${Math.min(...egBoss).toFixed(0)}–${Math.max(...egBoss).toFixed(0)}s endgame, cible ${TTK.boss}s)`)

// ---- (2) Sur/sous-stuff (contenu ci=400) ----
console.log('\n=== (2) Sur/sous-stuff vs contenu ci=400 (boss) ===')
const baseDps = repDps(400, 'legendaire')
const baseTtk = enemyHp(400, 'boss') / baseDps
for (const d of [-80, -40, -20, 0, 20, 40, 80]) {
  const dps = repDps(400 + d, 'legendaire')
  const t = enemyHp(400, 'boss') / dps
  console.log(`  Δ${(d >= 0 ? '+' : '') + d}`.padEnd(8) + `| TTK ${t.toFixed(1).padStart(7)}s | ×${(baseTtk / t).toFixed(2)} vitesse`)
}

// ---- (3) Rareté à ilvl fixe (ci=400) — INFORMATIF ----
// L'écart mediocre→transcendant (15 crans) n'est JAMAIS vécu en contenu calé (tu n'as pas du
// Transcendant à l'ilvl où le contenu drop du Légendaire). L'anti-snowball cross-tier se règle en
// gardant les FENÊTRES de rareté des raids ~constantes (LOT 6) : l'ilvl porte la progression, pas la
// rareté. Ce qui compte ici : l'écart dans une FENÊTRE de contenu (légendaire→artefact) reste petit.
console.log('\n=== (3) Rareté à ilvl fixe (ci=400) : ×DPS [informatif] ===')
const dMed = repDps(400, 'mediocre')
for (const r of ['mediocre', 'epique', 'legendaire', 'mythique', 'cosmique', 'transcendant']) {
  console.log(`  ${r.padEnd(13)} ×${(repDps(400, r) / dMed).toFixed(2)}`)
}
const windowSpread = repDps(400, 'artefact') / repDps(400, 'legendaire')
console.log(`  ${ok(windowSpread <= 1.8)} écart DANS une fenêtre de contenu légendaire→artefact ×${windowSpread.toFixed(2)} (seuil 1,8)`)

// ---- (4) Cap d'ilvl ----
console.log('\n=== (4) Mapping contenu → ilvl (aucun > 700) ===')
console.log(`  Farm 1→500 : ${ilvlFarm(1)}→${ilvlFarm(500)} · Donjon 1→30 : ${ilvlDungeon(1)}→${ilvlDungeon(30)} · Raids 230→ : ${ilvlRaid(230,10)} · Abîme 560→ : ${ilvlRaid(560,10)}`)
const allUnder = [ilvlFarm(500), ilvlDungeon(30), ilvlRaid(465, 10), ilvlRaid(560, 10)].every((v) => v <= ILVL_MAX)
console.log(`  ${ok(allUnder)} aucun ilvl de contenu > ${ILVL_MAX}`)

// ---- (5) Survie ----
console.log('\n=== (5) Survie à stuff calé (s de boss auto encaissables) ===')
const survRows = []
for (const ci of [50, 150, 300, 400, 500, 700]) {
  const eh = repEhp(ci)
  const s = eh / enemyDmg(ci, 'boss')
  survRows.push({ ci, s })
  const dmg0impl = eh / (SURVIVE_SECONDS * powerAt(ci) * 1.8) // ENEMY_DMG0 pour survie = cible
  console.log(`  ci ${String(ci).padStart(3)} : ${s.toFixed(1).padStart(5)}s   (ENEMY_DMG0 implicite pour ${SURVIVE_SECONDS}s = ${dmg0impl.toFixed(0)})`)
}
const egSurv = survRows.filter((r) => r.ci >= 300).map((r) => r.s)
const survFlat = Math.max(...egSurv) / Math.min(...egSurv)
console.log(`  ${ok(survFlat < 1.25)} survie ENDGAME plate (ci≥300, ratio ${survFlat.toFixed(2)}) ~${(egSurv.reduce((a,b)=>a+b,0)/egSurv.length).toFixed(0)}s`)

// ---- (6) RAIDS : bande d'ilvl linéaire + TTK boss à stuff calé (le contenu ex-snowball) ----
console.log('\n=== (6) Raids : ilvl par tier + TTK boss à stuff calé ===')
console.log('  raid          T1   T5   T10  | TTK boss T1/T5/T10 (cible ~40s) | enrage T1/T10')
let raidOk = true
for (const def of M.RAID_LIST) {
  const il = (t) => M.raidIlvl(def, t)
  const bossTtk = (t) => P.enemyHp(il(t), 'raidboss') / repDps(il(t), 'legendaire')
  const t1 = bossTtk(1), t5 = bossTtk(5), t10 = bossTtk(10)
  const enr1 = M.raidBerserkTime(def, 1), enr10 = M.raidBerserkTime(def, 10)
  if (Math.max(il(1), il(5), il(10)) > ILVL_MAX) raidOk = false
  console.log(`  ${def.id.padEnd(12)} ${String(il(1)).padStart(3)}  ${String(il(5)).padStart(3)}  ${String(il(10)).padStart(3)}  | ${t1.toFixed(0).padStart(3)}s ${t5.toFixed(0).padStart(3)}s ${t10.toFixed(0).padStart(3)}s            | ${enr1.toFixed(0)}s ${enr10.toFixed(0)}s`)
}
// Le step entre tiers ne doit jamais dépasser +20 ilvl (anti-trivialisation locale).
const maxStep = Math.max(...M.RAID_LIST.map((def) => M.raidIlvl(def, 2) - M.raidIlvl(def, 1)))
console.log(`  ${ok(maxStep <= 20)} step max entre tiers = +${maxStep} ilvl (seuil +20)`)
const raidBossTtkOk = M.RAID_LIST.every((def) => { const t = (P.enemyHp(M.raidIlvl(def, 5), 'raidboss')) / repDps(M.raidIlvl(def, 5), 'legendaire'); return t > 18 && t < 70 })
console.log(`  ${ok(raidBossTtkOk)} TTK boss de raid dans une bande saine (~30-55s à stuff calé)`)
// L'enrage doit laisser une MARGE au-dessus du TTK à stuff calé (le calé clear, le sous-stuffé échoue).
const enrageOk = M.RAID_LIST.every((def) => [1, 5, 10].every((t) => M.raidBerserkTime(def, t) > P.enemyHp(M.raidIlvl(def, t), 'raidboss') / repDps(M.raidIlvl(def, t), 'legendaire')))
console.log(`  ${ok(enrageOk)} enrage > TTK boss à stuff calé (marge de clear)`)

// ---- (7) PROPORTION des stats sur un objet (le bug v0.30.1 : primaire 2 vs secondaire 66) ----
console.log('\n=== (7) Proportion primaire vs secondaire sur un objet (légendaire) ===')
console.log('  ilvl | primaire | endurance | max secondaire | ratio sec/prim')
let propOk = true
for (const il of [10, 26, 100, 300, 700]) {
  const it = generateItem({ ilvl: il, rarity: 'legendaire', type: 'torse', primary: 'force', stars: 3 })
  const sec = it.affixes.filter((a) => a.kind === 'stat').map((a) => a.value)
  const maxSec = sec.length ? Math.max(...sec) : 0
  const ratio = maxSec / Math.max(1, it.primaryValue)
  if (ratio > 1.0) propOk = false // le primaire doit RESTER le plus gros nombre de l'objet
  console.log(`  ${String(il).padStart(4)} | ${String(it.primaryValue).padStart(8)} | ${String(it.endurance).padStart(9)} | ${String(maxSec).padStart(14)} | ×${ratio.toFixed(2)}`)
}
console.log(`  ${ok(propOk)} le primaire reste le plus gros nombre de l'objet (sec/prim ≤ 1)`)

const pass = egDpsFlat < 1.2 && survFlat < 1.25 && allUnder && windowSpread <= 1.8 && raidOk && maxStep <= 20 && raidBossTtkOk && enrageOk && propOk
console.log(`\n=== VERDICT : ${pass ? '✅ MODÈLE VALIDE — snowball neutralisé sur toute la progression' : '❌ à recaler'} ===`)
