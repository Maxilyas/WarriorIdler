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
  export { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charCombatMods, talentsSpent, teamTalentPool, setGlobalCombatMods } from './src/game/character.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
  export { generateItem } from './src/game/items.ts'
  export { makeDungeonEnemy, dungeonFights, DUNGEONS } from './src/game/dungeons.ts'
  export { RAID_LIST, makeRaidBoss, raidBerserkTime } from './src/game/raids.ts'
  export { partyCombatStep, resetAllCooldowns, fuelReset, crescendoReset, crescendoBonus } from './src/game/combatEngine.ts'
  export { computeGlobalMods } from './src/game/upgrades.ts'
  export { achievementBonuses } from './src/game/achievements.ts'
  export { sanitizeRaw, freshSave } from './src/game/save.ts'
  export { getPower } from './src/game/powers.ts'
  export { getTalent } from './src/game/talents.ts'
  export { craftMods } from './src/game/metiers.ts'
  export { condGemMods } from './src/game/condGems.ts'
  export { equippedTimeRunes, timeRuneMods } from './src/game/enchants.ts'
  export { activeBrewBuffs, teamPactMods, teamGemOpts } from './src/game/storeHelpers.ts'
  export { maitriseBonus } from './src/game/biomeBonus.ts'
`)
const {
  makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charCombatMods,
  talentsSpent, teamTalentPool, setGlobalCombatMods, profileDamageMult, EQUIP_SLOTS, generateItem,
  makeDungeonEnemy, dungeonFights, DUNGEONS, RAID_LIST, makeRaidBoss, raidBerserkTime,
  partyCombatStep, resetAllCooldowns, fuelReset, crescendoReset, crescendoBonus,
  computeGlobalMods, achievementBonuses, sanitizeRaw, freshSave, getPower, getTalent,
  craftMods, condGemMods, equippedTimeRunes, timeRuneMods, activeBrewBuffs, teamPactMods, teamGemOpts, maitriseBonus,
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
  // Export du jeu enveloppé : { app, schema, exportedAt, checksum, data } → le SaveData est dans `data`.
  if (raw && !Array.isArray(raw.characters) && raw.data && Array.isArray(raw.data.characters)) raw = raw.data
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

// ---- KIT DE COMBAT DU JOUEUR (full-fidélité) : reconstruit le `mods` comme tickRaid/tickDungeon ----
// gemmes de condition + runes de temps + pactes + consommables ACTIFS → passés à partyCombatStep.
// (On omet la régén/drain/dmgMult d'escalade propres au contenu, et le bonus huile×élément, mineurs.)
const craft = craftMods(save.metiers ?? {})
const cond = condGemMods(save.characters, craft.gemSpec, teamGemOpts(save, craft))
const runes = timeRuneMods(equippedTimeRunes(save.characters), craft.runisteTempo)
const buffs = activeBrewBuffs(save)
const pact = teamPactMods(save, craft, buffs)
const heroMult = (1 + maitriseBonus(save.bestStage ?? 1)) * (1 + crescendoBonus(cond.crescendoCap)) * buffs.dmgMult
const PLAYER_MODS = { heroMult, cond, runes, pact, content: { antidote: buffs.antidote ?? undefined } }
const nRunes = equippedTimeRunes(save.characters).size

// DPS total = auto+sorts (charDps) + DoT keystone des auto-attaques (non inclus dans charDps).
function dotDps(ch) {
  const cm = charCombatMods(ch); if (!cm.dot) return 0
  const d = charDerived(ch), pm = profileDamageMult(charDamageProfile(ch))
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult
}
const totalDps = (ch) => charDps(ch) + dotDps(ch)

// ---- Simulation de combat d'ÉQUIPE via le VRAI moteur (heal, cooldowns et mécaniques de boss inclus) ----
// Équipe = TOUS les persos de la save (le DPS + le heal), comme le tick du jeu (partyCombatStep(s.characters)).
// Pas de buffs gemmes/runes/consommables (mods omis) → estimation CONSERVATRICE (plancher réaliste).
const party0 = save.characters
const TEAM = party0.length
function freshParty() {
  // copies neuves à PV pleins, sans état transitoire ; module-state (cooldowns/fuel/crescendo) remis à zéro.
  const p = party0.map((ch) => ({ ...ch, hp: charMaxHp(ch), dots: undefined, weaken: undefined, stun: 0, rez: undefined }))
  resetAllCooldowns(p); fuelReset(); crescendoReset()
  return p
}
// Un combat d'équipe vs `enemy` jusqu'au kill (gagné) ou wipe/temps écoulé (perdu). dt=0,2 s (5 Hz, comme le jeu).
// Renvoie le détail : qui tombe en PREMIER et quand, PV restant du boss → diagnostic du mur.
function simWin(makeEnemy, timeLimit) {
  let p = freshParty()
  let enemy = makeEnemy(p.length)
  const death = {}
  let t = 0
  for (; t < timeLimit && enemy.hp > 0 && p.some((x) => x.hp > 0); t += 0.2) {
    const r = partyCombatStep(p, enemy, 0.2, PLAYER_MODS)
    p = r.chars; enemy = r.enemy
    for (const ch of p) if (ch.hp <= 0 && !(ch.name in death)) death[ch.name] = t
  }
  const order = Object.entries(death).sort((a, b) => a[1] - b[1])
  return { win: enemy.hp <= 0, dur: t, bossLeft: enemy.hp / enemy.maxHp, firstDead: order[0]?.[0], firstT: order[0]?.[1] ?? 0 }
}
// L'aléa (esquive/procs/sursis) rend un combat bruité → 3 essais, majorité (≥2 wins) = « battable ».
function beats(makeEnemy, timeLimit) {
  let w = 0
  for (let i = 0; i < 3; i++) if (simWin(makeEnemy, timeLimit).win) w++
  return w >= 2
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
console.log(`  Équipe simulée (${TEAM}) : ${save.characters.map((x) => `${x.name} niv${x.level} ${x.primaryBias} (EHP ${fmt(charEhp(x))})`).join(' · ')}`)
console.log(`  Kit de combat (pris en compte) : heroMult ×${heroMult.toFixed(2)} · ${nRunes} rune(s) de temps · élixir ${buffs.dmgMult > 1 ? 'ACTIF' : 'non'} · gemmes de condition + pactes intégrés`)
console.log('  → Donjons/Raids = COMBAT D\'ÉQUIPE réel (heal + gemmes/runes/pactes/conso inclus) ; Sorts/Talents = perso actif.')

/* ====================================================================== */
/* 1) DONJONS                                                            */
/* ====================================================================== */
console.log('\n── 1) DONJONS — niveau max franchissable par l\'ÉQUIPE (vrai combat, heal inclus) ──')
for (const [dId, def] of Object.entries(DUNGEONS)) {
  let last = 0
  for (let D = 1; D <= 25; D++) {
    const fights = dungeonFights(D) // dungeonFights prend le NIVEAU du donjon, pas le def
    if (beats(() => makeDungeonEnemy(def, D, fights - 1, fights, [], save.bestStage ?? 1), 180)) last = D
    else break
  }
  const verdict = last === 0 ? '⛔ infranchissable' : last >= 25 ? '😴 trop facile (≥25)' : `🧱 mur ~niv ${last + 1}`
  console.log(`  ${def.icon} ${def.name.padEnd(22)} max niv ${String(last).padStart(2)}   ${verdict}`)
}

/* ====================================================================== */
/* 2) RAIDS                                                              */
/* ====================================================================== */
console.log('\n── 2) RAIDS — tier max battable par l\'ÉQUIPE (vrai boss + mécaniques télégraphiées, heal inclus) ──')
for (const def of RAID_LIST) {
  const el = def.element === 'rotating' ? 'arcane' : def.element // type de dégâts infligé par le boss
  let last = 0
  for (let t = 1; t <= 15; t++) {
    if (beats((n) => makeRaidBoss(def, t, el, save.bestStage ?? 1, n), raidBerserkTime(def, t))) last = t
    else break
  }
  const verdict = last === 0 ? '⛔ T1 hors de portée' : last >= 15 ? '😴 tous tiers (≥15)' : `🧱 mur T${last + 1}`
  const note = def.icon === '🕳️' ? '  (Abîme = duo réel → un peu plus dur que cette sim mono-boss)' : ''
  console.log(`  ${def.icon} ${def.name.padEnd(22)} max T${String(last).padStart(2)}   ${verdict}${note}`)
  // Diagnostic du mur : qui tombe en premier au tier échoué, et à combien de PV est le boss.
  if (last < 15) {
    const wt = last + 1
    const d = simWin((n) => makeRaidBoss(def, wt, el, save.bestStage ?? 1, n), raidBerserkTime(def, wt))
    if (d.firstDead) console.log(`        └─ T${wt} : ${d.firstDead} tombe à ${d.firstT.toFixed(0)}s · boss encore à ${(d.bossLeft * 100).toFixed(0)}% PV`)
  }
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
  // Effets dont la valeur N'EST PAS du DPS direct (soutien/debuff) → 0% est NORMAL, pas un poids mort.
  const SUPPORT_FX = new Set(['mark', 'builder', 'shield', 'bigShield', 'heal', 'bigHeal', 'hot', 'buffParty', 'invuln', 'frenzy'])
  for (const r of rows) {
    const eff = getPower(r.id)?.effect
    const note = r.pctOfTotal >= 1 ? ''
      : SUPPORT_FX.has(eff) ? `  (soutien « ${eff} » — valeur indirecte, hors DPS direct)`
      : '  ⚠ poids mort (sort de dégât sans contribution — élément/stat inadaptés ?)'
    console.log(`  ${(getPower(r.id)?.name ?? r.id).padEnd(24)} +${fmt(r.contrib).padStart(8)} DPS (${r.pctOfTotal.toFixed(1)}% du total)${note}`)
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
const inert = []
for (const id of Object.keys(c.talents)) {
  if (id === 'co_start' || (c.talents[id] ?? 0) <= 0) continue
  if (getTalent(id)?.unlockPower) continue // un nœud qui DÉBLOQUE un sort équipé n'est jamais « mort »
  const without = clone(c, { talents: { ...c.talents, [id]: 0 } })
  const dDps = Math.abs(dpsFull - totalDps(without)), dEhp = Math.abs(charEhp(c) - charEhp(without))
  if (dDps < dpsFull * 0.0005 && dEhp < ehpBare * 0.0005) inert.push(id)
}
if (inert.length) {
  console.log(`  ${inert.length} nœud(s) sans impact DPS/EHP burst mesuré (hors sorts débloqués) — utilité,`)
  console.log('  survie conditionnelle (bouclier/riposte, non captée par l\'EHP burst) ou pathing — pas forcément gâchés :')
  console.log('    ' + inert.map((id) => getTalent(id)?.name ?? id).join(', '))
} else console.log('  ✓ tous tes nœuds alloués pèsent sur le DPS ou l\'EHP.')

console.log(`\n${'═'.repeat(70)}`)
console.log('Donjons/Raids = VRAI moteur de combat d\'équipe (heal, cooldowns, mécaniques de boss inclus),')
console.log('SANS buffs gemmes/runes/consommables (plancher) mais en supposant un jeu parfait (léger plafond) ;')
console.log('3 essais/combat, majorité. Sorts/Talents = contribution DPS mono-cible du perso actif.')
console.log(demo
  ? 'Démo terminée. Lance sur TA save : node scripts/save-audit.mjs chemin/vers/ta-save.json'
  : 'Audit terminé.')
