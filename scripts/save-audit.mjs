// AUDIT PERSONNALISÉ d'une sauvegarde — « avec CE que TU as, où en es-tu ? »
// Charge ton fichier JSON de save (export du jeu) via le VRAI loader (sanitizeRaw : migrations + valid.),
// applique TES mods de compte (améliorations + maîtrises + hauts faits), puis audite le perso actif :
//   1) Donjons : niveau max franchissable par donjon (+ facteur limitant : survie ou vitesse).
//   2) Raids : tier max battable (+ facteur limitant : enrage ou survie).
//   3) Sorts équipés : contribution DPS de chacun (retrait marginal) — repère le poids mort.
//   4) Talents : points dépensés/dispo, gain de DPS de ton arbre, nœuds alloués sans effet.
//
//   Usage :  node scripts/save-audit.mjs  chemin/vers/ma-save.json
//   Sans argument → MODE DÉMO (perso stuffé généré) pour prouver le pipeline.
//
// Tout transpile le vrai code via esbuild — zéro copie de règles, donc l'audit reflète l'équilibrage réel.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charResist, charCombatMods, charPassives, talentsSpent, talentPointsForLevel, teamTalentPool, setGlobalCombatMods } from './src/game/character.ts'
  export { incomingDps, armorMitigation } from './src/game/combat.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
  export { generateItem } from './src/game/items.ts'
  export { makeDungeonEnemy, dungeonFights, DUNGEONS } from './src/game/dungeons.ts'
  export { RAID_LIST, raidIlvl, raidBerserkTime } from './src/game/raids.ts'
  export { enemyHp, enemyDmg } from './src/game/progression.ts'
  export { computeGlobalMods } from './src/game/upgrades.ts'
  export { achievementBonuses } from './src/game/achievements.ts'
  export { sanitizeRaw, freshSave } from './src/game/save.ts'
  export { getPower } from './src/game/powers.ts'
  export { getTalent } from './src/game/talents.ts'
`)
const {
  makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charResist, charCombatMods, charPassives,
  talentsSpent, talentPointsForLevel, teamTalentPool, setGlobalCombatMods,
  incomingDps, armorMitigation, profileDamageMult, EQUIP_SLOTS, generateItem,
  makeDungeonEnemy, dungeonFights, DUNGEONS, RAID_LIST, raidIlvl, raidBerserkTime, enemyHp, enemyDmg,
  computeGlobalMods, achievementBonuses, sanitizeRaw, freshSave, getPower, getTalent,
} = M

const fmt = (n) => n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
let CID = 0
const clone = (c, patch) => ({ ...c, ...patch, id: `audit-${CID++}` }) // id frais → cache de stats non figé

/* ---------- chargement de la save (ou démo) ---------- */
const path = process.argv[2]
let save, demo = false
if (path) {
  let raw
  try { raw = JSON.parse(readFileSync(path, 'utf8')) }
  catch (e) { console.error(`✗ Lecture/JSON impossible : ${path}\n  ${e.message}`); process.exit(1) }
  save = sanitizeRaw(raw)
  if (!save) { console.error('✗ Fichier non reconnu comme une sauvegarde Warrior Idler (champ "characters" manquant ?).'); process.exit(1) }
} else {
  demo = true
  // Perso de démonstration : niv 100 stuffé Cosmique iLvl 155 (config réaliste de fin de jeu, calée sur
  // la table de dungeon-sim), chemin Guerrier réel (mêmes ids que ttk-sim) — produit un MIX de verdicts.
  const c = makeCharacter('Démo (Guerrier)', 100, 'force')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: 155, rarity: 'cosmique', type: s.accepts, primary: 'force', stars: 3, ...(s.accepts === 'armePrincipale' ? { element: 'physique' } : {}) })
  c.equipment = eq
  c.talents = { co_start: 1, cat_plaque: 1, cl_guerrier: 1, se_hub: 1, se_brutal: 1, se_mortel: 1, se_rage: 1, id_guerrier: 1 }
  c.powers = ['gu_frappe', 'se_sentence', 'se_saignement', 'se_decapite', 'se_tourmente']
  c.support = ['se_mutile']
  c.hp = charMaxHp(c)
  save = { ...freshSave(), characters: [c], activeChar: 0, bestStage: 360 }
}

// Mods de COMPTE du joueur (améliorations + maîtrises + hauts faits) → exactement comme le tick du jeu.
const eco = computeGlobalMods(save.upgrades ?? {}, save.maitrise ?? {}, achievementBonuses(save.achievements ?? {}))
setGlobalCombatMods({ power: eco.power, attackSpeed: eco.attackSpeed, vitality: eco.vitality })

const c = save.characters[save.activeChar] ?? save.characters[0]
const REGEN_RATE = 0.05

// DPS total = auto+sorts (charDps) + DoT keystone des auto-attaques (non inclus dans charDps).
function dotDps(ch) {
  const cm = charCombatMods(ch); if (!cm.dot) return 0
  const d = charDerived(ch), pm = profileDamageMult(charDamageProfile(ch))
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult
}
const totalDps = (ch) => charDps(ch) + dotDps(ch)

// DPS effectif vs un ennemi (armure + résist) — comme dungeon-sim.
function effectiveDps(ch, enemy) {
  const dps = totalDps(ch), prof = charDamageProfile(ch), d = charDerived(ch)
  const physFrac = prof.profile.physique ?? 0
  const resE = enemy.resist?.[ch.equipment.armePrincipale?.damageType ?? 'physique'] ?? 0
  return dps * (1 - physFrac * armorMitigation(enemy.armor, d.power)) * (1 - Math.max(0, resE))
}
function ttd(ch, enemy) {
  const d = charDerived(ch), res = charResist(ch), pass = charPassives(ch), cm = charCombatMods(ch)
  const taken = incomingDps(enemy.damage, enemy.damageType, d, res, (1 - pass.damageReduction) * (1 - cm.flatDr))
  const net = taken - charMaxHp(ch) * REGEN_RATE
  return net <= 0 ? Infinity : charMaxHp(ch) / net
}

/* ====================================================================== */
/* 0) PROFIL                                                             */
/* ====================================================================== */
console.log(`\n${'═'.repeat(70)}`)
console.log(`AUDIT — ${c.name} · niv. ${c.level} · spé ${c.primaryBias}${demo ? '   [MODE DÉMO]' : ''}`)
console.log('═'.repeat(70))
const dps = totalDps(c), ehp = charEhp(c), hp = charMaxHp(c)
const rar = {}; let uniq = 0
for (const s of EQUIP_SLOTS) { const it = c.equipment[s.id]; if (it) { rar[it.rarity] = (rar[it.rarity] ?? 0) + 1; if (it.unique) uniq++ } }
console.log(`  DPS ${fmt(dps)} · EHP ${fmt(ehp)} · PV ${fmt(hp)} · record de farm (stage) ${save.bestStage ?? '?'}`)
console.log(`  Stuff : ${Object.entries(rar).map(([r, n]) => `${n}×${r}`).join(', ') || 'aucun'} · ${uniq} effet(s) unique(s)`)
console.log(`  Mods de compte : puissance ×${eco.power.toFixed(2)} · vit. att. ×${eco.attackSpeed.toFixed(2)} · vitalité ×${eco.vitality.toFixed(2)}`)
if (save.characters.length > 1) console.log(`  (${save.characters.length} persos dans la save — audit du perso ACTIF ; relance en changeant activeChar pour les autres.)`)

/* ====================================================================== */
/* 1) DONJONS                                                            */
/* ====================================================================== */
console.log('\n── 1) DONJONS — niveau max franchissable (survivre ET tuer le boss < 180s) ──')
for (const [dId, def] of Object.entries(DUNGEONS)) {
  let last = 0, limit = ''
  for (let D = 1; D <= 60; D++) {
    const fights = dungeonFights(D) // dungeonFights prend le NIVEAU du donjon, pas le def
    const boss = makeDungeonEnemy(def, D, fights - 1, fights, [], c.level)
    const tk = boss.hp / effectiveDps(c, boss)
    const survive = ttd(c, boss) >= tk
    if (survive && tk < 180) { last = D; continue }
    limit = !survive ? 'survie' : 'vitesse (>180s)'
    break
  }
  const verdict = last === 0 ? '⛔ infranchissable' : last >= 55 ? '😴 trop facile' : `🧱 mur ~niv ${last + 1} (${limit})`
  console.log(`  ${def.icon} ${def.name.padEnd(22)} max niv ${String(last).padStart(2)}   ${verdict}`)
}

/* ====================================================================== */
/* 2) RAIDS                                                              */
/* ====================================================================== */
console.log('\n── 2) RAIDS — tier max battable (TTK boss < enrage ET survie ; mécaniques de raid non modélisées) ──')
const RAID_CAP = 30 // les raids normaux plafonnent en ilvl bien avant — au-delà, aucun mur ne reste
for (const def of RAID_LIST) {
  let last = 0, limit = ''
  for (let t = 1; t <= RAID_CAP; t++) {
    const il = raidIlvl(def, t, 200)
    const tk = enemyHp(il, 'raidboss') / totalDps(c)
    const surviveS = charEhp(c) / enemyDmg(il, 'raidboss')
    const enrage = raidBerserkTime(def, t)
    if (tk < enrage && surviveS >= tk) { last = t; continue }
    limit = tk >= enrage ? `enrage (TTK ${tk.toFixed(0)}s > ${enrage.toFixed(0)}s)` : 'survie'
    break
  }
  const verdict = last === 0 ? '⛔ T1 hors de portée' : last >= RAID_CAP ? '😴 tous tiers (raid plafonné en difficulté)' : `🧱 mur T${last + 1} (${limit})`
  console.log(`  ${def.icon} ${def.name.padEnd(22)} max T${String(last).padStart(2)}   ${verdict}`)
}

/* ====================================================================== */
/* 3) SORTS ÉQUIPÉS — contribution DPS (retrait marginal)                */
/* ====================================================================== */
console.log('\n── 3) SORTS ÉQUIPÉS — contribution au DPS (retrait marginal) ──')
const slots = (c.powers ?? []).map((id, i) => ({ id, i })).filter((x) => x.id)
if (!slots.length) console.log('  (aucun sort actif équipé)')
else {
  const base = totalDps(c)
  const rows = slots.map(({ id, i }) => {
    const without = clone(c, { powers: c.powers.map((p, j) => (j === i ? null : p)) })
    const contrib = base - totalDps(without)
    return { id, contrib, pctOfTotal: (contrib / base) * 100 }
  }).sort((a, b) => b.contrib - a.contrib)
  for (const r of rows) {
    const flag = r.pctOfTotal < 1 ? '  ⚠ poids mort' : ''
    console.log(`  ${(getPower(r.id)?.name ?? r.id).padEnd(24)} +${fmt(r.contrib).padStart(8)} DPS (${r.pctOfTotal.toFixed(1)}% du total)${flag}`)
  }
}

/* ====================================================================== */
/* 4) TALENTS — points, gain de DPS de l'arbre, nœuds morts              */
/* ====================================================================== */
console.log('\n── 4) TALENTS ──')
const spent = talentsSpent(c)
const pool = teamTalentPool(save.characters, eco.talentBonus ?? 0)
const dpsBare = totalDps(clone(c, { talents: { co_start: 1 } }))
const dpsFull = totalDps(c)
const uplift = ((dpsFull - dpsBare) / Math.max(1, dpsBare)) * 100
console.log(`  ${spent} points dépensés dans l'arbre · ${pool} restant(s) dans le pool d'équipe · ton arbre = ${uplift >= 0 ? '+' : ''}${uplift.toFixed(0)}% de DPS`)
const ehpBare = charEhp(clone(c, { talents: { co_start: 1 } }))
const dead = []
for (const id of Object.keys(c.talents)) {
  if (id === 'co_start' || (c.talents[id] ?? 0) <= 0) continue
  const without = clone(c, { talents: { ...c.talents, [id]: 0 } })
  const dDps = Math.abs(dpsFull - totalDps(without)), dEhp = Math.abs(charEhp(c) - charEhp(without))
  if (dDps < dpsFull * 0.0005 && dEhp < ehpBare * 0.0005) dead.push(id)
}
if (dead.length) {
  console.log(`  ⚠ ${dead.length} nœud(s) alloué(s) sans effet DPS/EHP mesurable (utilité/sustain, ou point gâché) :`)
  console.log('    ' + dead.map((id) => getTalent(id)?.name ?? id).join(', '))
} else console.log('  ✓ tous tes nœuds alloués pèsent sur le DPS ou l\'EHP.')

console.log(`\n${'═'.repeat(70)}`)
console.log('Modèle : DPS soutenu (auto+sorts+DoT) vs PV/enrage, survie = EHP burst. Estimation — il')
console.log('ignore rotation fine, cooldowns et mécaniques signature de raid. Mur = 1er niveau/tier échoué.')
console.log(demo
  ? 'Démo terminée. Lance sur TA save : node scripts/save-audit.mjs chemin/vers/ta-save.json'
  : 'Audit terminé.')
