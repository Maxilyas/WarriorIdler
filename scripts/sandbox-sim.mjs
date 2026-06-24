// SANDBOX config-driven — la FONDATION headless du bac à sable de simulation de raid.
// Décris une équipe (1-3 persos) + leurs loadouts (classe/talents, stuff, GEMMES, RUNES, consommables)
// dans un JSON, et obtiens : profil de l'équipe + « ce raid/donjon passe-t-il ? » + diagnostic du mur.
// Tout passe par le VRAI moteur (partyCombatStep) avec le `mods` complet (gemmes/runes/pactes/conso),
// exactement comme tickRaid. Réutilisable tel quel par une future UI React.
//
//   node scripts/sandbox-sim.mjs  chemin/vers/config.json      (sans argument → config d'EXEMPLE)
//
// Schéma de config (champs optionnels → défauts) :
// {
//   "ilvl": 200, "rarity": "mythique", "bestStage": 300,
//   "consumables": { "elixir": "elixirPuissance" },
//   "team": [
//     { "name": "Héros", "class": "guerrier", "level": 75, "orientation": "offensif",
//       "gems": ["sixieme","tresorerie"], "runes": ["premierElan"] },
//     { "name": "Lyra", "class": "mage", "orientation": "defensif" }
//   ],
//   "content": { "raid": "forge", "tier": 5 }        // ou { "raid":"forge", "scan": true }
//                                                    // ou { "dungeon":"antre", "level": 10 }
// }
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDps, charMaxHp, charEhp, charDerived, charDamageProfile, charCombatMods, setGlobalCombatMods } from './src/game/character.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export { generateItem } from './src/game/items.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
  export { RAID_LIST, makeRaidBoss, raidBerserkTime } from './src/game/raids.ts'
  export { makeDungeonEnemy, dungeonFights, DUNGEONS } from './src/game/dungeons.ts'
  export { partyCombatStep, resetAllCooldowns, fuelReset, crescendoReset, crescendoBonus } from './src/game/combatEngine.ts'
  export { craftMods } from './src/game/metiers.ts'
  export { condGemMods } from './src/game/condGems.ts'
  export { timeRuneMods } from './src/game/enchants.ts'
  export { activeBrewBuffs, teamPactMods, teamGemOpts } from './src/game/storeHelpers.ts'
  export { maitriseBonus } from './src/game/biomeBonus.ts'
  export { freshSave } from './src/game/save.ts'
`)
const {
  makeCharacter, charDps, charMaxHp, charEhp, charDerived, charDamageProfile, charCombatMods, setGlobalCombatMods,
  profileDamageMult, generateItem, EQUIP_SLOTS, RAID_LIST, makeRaidBoss, raidBerserkTime,
  makeDungeonEnemy, dungeonFights, DUNGEONS, partyCombatStep, resetAllCooldowns, fuelReset, crescendoReset, crescendoBonus,
  craftMods, condGemMods, timeRuneMods, activeBrewBuffs, teamPactMods, teamGemOpts, maitriseBonus, freshSave,
} = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

// Presets de CLASSE (chemins réels, mêmes ids que build-explorer). Surchargeable par la config.
const CLASSES = {
  guerrier: { primary: 'force', bias: 'force', elem: 'physique', talents: ['cat_plaque', 'cl_guerrier', 'se_hub', 'se_brutal', 'se_mortel', 'se_rage', 'id_guerrier'], support: ['se_mutile'], powers: ['gu_frappe', 'se_sentence', 'se_saignement', 'se_decapite', 'se_tourmente'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
  voleur: { primary: 'agilite', bias: 'agilite', elem: 'physique', talents: ['cat_cuir', 'cl_voleur', 'om_hub', 'om_saig', 'om_surin', 'om_jum', 'id_voleur'], support: ['om_frappe_sournoise'], powers: ['om_eviscaration', 'vo_tranchant', 'om_embuscade', 'om_eventail', 'as_lame_enduite'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
  mage: { primary: 'intelligence', bias: 'intelligence', elem: 'feu', talents: ['cat_tissu', 'cl_mage', 'py_hub', 'py_pyromanie', 'py_hotstreak', 'py_combustion', 'id_mage'], support: [], powers: ['ma_eclair', 'py_boule', 'py_pyroblast', 'py_flammes', 'py_immolation'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
  chasseur: { primary: 'agilite', bias: 'agilite', elem: 'physique', talents: ['cat_mailles', 'cl_chasseur', 'me_hub', 'me_familier', 'me_meute', 'me_frenesie', 'me_coordination', 'id_chasseur'], support: [], powers: ['ch_tir', 'me_cmd', 'me_morsure', 'me_saignee', 'me_curee'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
}

// Config d'EXEMPLE (sans argument) — montre tous les composants : 2 persos, gemmes, rune, élixir.
const EXAMPLE = {
  ilvl: 200, rarity: 'mythique', bestStage: 300,
  consumables: { elixir: 'elixirPuissance' },
  team: [
    { name: 'Tank-DPS', class: 'guerrier', level: 75, orientation: 'equilibre', gems: ['sixieme', 'tresorerie', 'souffle'], runes: ['premierElan', 'sursis'] },
    { name: 'Renfort', class: 'mage', level: 75, orientation: 'offensif', gems: ['overkill', 'hemorragie'] },
  ],
  content: { raid: 'forge', scan: true },
}

const cfg = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : EXAMPLE
const ILVL = cfg.ilvl ?? 200, RARITY = cfg.rarity ?? 'mythique', BEST = cfg.bestStage ?? 300

/* ---------- construction de l'équipe ---------- */
function buildChar(m) {
  const p = CLASSES[m.class] ?? CLASSES.guerrier
  const primary = m.primary ?? p.primary, elem = m.element ?? p.elem
  const c = makeCharacter(m.name ?? 'Perso', m.level ?? 75, m.bias ?? p.bias)
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: ILVL, rarity: RARITY, type: s.accepts, primary, stars: 3, orientation: m.orientation ?? 'equilibre', ...(s.accepts === 'armePrincipale' ? { element: elem } : {}) })
  const slotIds = EQUIP_SLOTS.map((s) => s.id)
  ;(m.gems ?? []).forEach((id, i) => { const it = eq[slotIds[i % slotIds.length]]; it.gems = [...(it.gems ?? []), { cond: id, rank: m.gemRank ?? 5, quality: 2 }] })
  c.equipment = eq
  c.talents = { co_start: 1 }; for (const t of (m.talents ?? p.talents)) c.talents[t] = 1
  c.powers = [...(m.powers ?? p.powers)]
  c.support = [...(m.support ?? p.support ?? [])]
  c.passives = [...(m.passives ?? p.passives ?? [])]
  c.hp = charMaxHp(c)
  c._cfg = m
  return c
}
const team = (cfg.team ?? []).map(buildChar)
if (!team.length) { console.error('✗ config.team vide — décris au moins un personnage.'); process.exit(1) }

/* ---------- mods complets (gemmes + runes + pactes + consommables) ---------- */
const cons = cfg.consumables ?? {}
const now = Date.now()
// État synthétique = défauts valides de freshSave() (métiers/gemsSeen structurés) + nos overrides.
const s = {
  ...freshSave(), characters: team, bestStage: BEST,
  elixirActive: cons.elixir ? { id: cons.elixir, until: now + 1e9, quality: 2 } : undefined,
  oilActive: cons.oil ? { type: cons.oil.type, pct: cons.oil.pct ?? 0.12, until: now + 1e9 } : undefined,
  antidoteActive: cons.antidote ? { type: cons.antidote, pct: 0.15, until: now + 1e9 } : undefined,
  mutagenActive: cons.mutagen ? { mult: 1.12, until: now + 1e9 } : undefined,
}
const craft = craftMods(s.metiers)
const cond = condGemMods(team, craft.gemSpec, teamGemOpts(s, craft))
const runeSet = new Set(team.flatMap((c) => c._cfg.runes ?? []))
const runes = timeRuneMods(runeSet, craft.runisteTempo)
const buffs = activeBrewBuffs(s)
const pact = teamPactMods(s, craft, buffs)
const heroMult = (1 + maitriseBonus(BEST)) * (1 + crescendoBonus(cond.crescendoCap)) * buffs.dmgMult
const MODS = { heroMult, cond, runes, pact, content: { antidote: buffs.antidote ?? undefined } }

// DPS = charDps + DoT keystone (non inclus dans charDps).
function dotDps(c) {
  const cm = charCombatMods(c); if (!cm.dot) return 0
  const d = charDerived(c), pm = profileDamageMult(charDamageProfile(c))
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult
}
const totalDps = (c) => charDps(c) + dotDps(c)

/* ---------- simulation ---------- */
function freshTeam() {
  const p = team.map((c) => ({ ...c, hp: charMaxHp(c), dots: undefined, weaken: undefined, stun: 0, rez: undefined }))
  resetAllCooldowns(p); fuelReset(); crescendoReset()
  return p
}
function simFight(makeEnemy, timeLimit) {
  let p = freshTeam(); let enemy = makeEnemy(p.length); const death = {}; let t = 0
  for (; t < timeLimit && enemy.hp > 0 && p.some((x) => x.hp > 0); t += 0.2) {
    const r = partyCombatStep(p, enemy, 0.2, MODS); p = r.chars; enemy = r.enemy
    for (const ch of p) if (ch.hp <= 0 && !(ch.name in death)) death[ch.name] = t
  }
  const order = Object.entries(death).sort((a, b) => a[1] - b[1])
  return { win: enemy.hp <= 0, dur: t, bossLeft: enemy.hp / enemy.maxHp, firstDead: order[0]?.[0], firstT: order[0]?.[1] ?? 0 }
}
const beats = (makeEnemy, timeLimit) => { let w = 0; for (let i = 0; i < 3; i++) if (simFight(makeEnemy, timeLimit).win) w++; return w >= 2 }
const resolveRaid = (k) => RAID_LIST.find((d) => d.id === k || d.icon === k || d.name.toLowerCase().includes(String(k).toLowerCase()))
const resolveDun = (k) => Object.values(DUNGEONS).find((d) => d.icon === k || d.name.toLowerCase().includes(String(k).toLowerCase()))

/* ---------- sortie ---------- */
console.log(`\n${'═'.repeat(70)}`)
console.log(`SANDBOX — équipe de ${team.length} · stuff iLvl ${ILVL} ${RARITY} · record ${BEST}`)
console.log('═'.repeat(70))
for (const c of team) {
  const m = c._cfg
  console.log(`  ${c.name.padEnd(12)} ${(m.class ?? 'guerrier').padEnd(9)} ${(m.orientation ?? 'equilibre').padEnd(10)} DPS ${fmt(totalDps(c)).padStart(7)} · EHP ${fmt(charEhp(c)).padStart(7)} · gemmes [${(m.gems ?? []).join(', ') || '—'}] · runes [${(m.runes ?? []).join(', ') || '—'}]`)
}
console.log(`  Kit d'équipe : heroMult ×${heroMult.toFixed(2)} · ${runeSet.size} rune(s) · élixir ${buffs.dmgMult > 1 ? 'ACTIF' : 'non'} · gemmes+pactes intégrés`)

const ct = cfg.content ?? {}
function reportFight(label, makeEnemy, timeLimit) {
  const d = simFight(makeEnemy, timeLimit)
  const tag = d.win ? '✅ PASSE' : '❌ ÉCHEC'
  let line = `  ${label} : ${tag} (combat ${d.dur.toFixed(0)}s)`
  if (!d.win && d.firstDead) line += ` — ${d.firstDead} tombe à ${d.firstT.toFixed(0)}s, boss encore à ${(d.bossLeft * 100).toFixed(0)}% PV`
  else if (!d.win) line += ` — enrage atteint, boss à ${(d.bossLeft * 100).toFixed(0)}% PV`
  console.log(line)
}
console.log('')
if (ct.raid) {
  const def = resolveRaid(ct.raid)
  if (!def) { console.error(`✗ raid « ${ct.raid} » introuvable. Dispo : ${RAID_LIST.map((d) => d.name).join(', ')}`); process.exit(1) }
  const el = def.element === 'rotating' ? 'arcane' : def.element
  console.log(`── RAID : ${def.icon} ${def.name} ──`)
  if (ct.scan || ct.tier == null) {
    let last = 0
    for (let t = 1; t <= 15; t++) { if (beats((n) => makeRaidBoss(def, t, el, BEST, n), raidBerserkTime(def, t))) last = t; else break }
    console.log(`  Tier MAX battable : ${last === 0 ? 'aucun (T1 échoue)' : 'T' + last}`)
    if (last < 15) reportFight(`Diagnostic au mur T${last + 1}`, (n) => makeRaidBoss(def, last + 1, el, BEST, n), raidBerserkTime(def, last + 1))
  } else {
    reportFight(`T${ct.tier}`, (n) => makeRaidBoss(def, ct.tier, el, BEST, n), raidBerserkTime(def, ct.tier))
  }
} else if (ct.dungeon) {
  const def = resolveDun(ct.dungeon)
  if (!def) { console.error(`✗ donjon « ${ct.dungeon} » introuvable.`); process.exit(1) }
  console.log(`── DONJON : ${def.icon} ${def.name} ──`)
  const mk = (lvl) => { const f = dungeonFights(lvl); return () => makeDungeonEnemy(def, lvl, f - 1, f, [], BEST) }
  if (ct.scan || ct.level == null) {
    let last = 0; for (let D = 1; D <= 25; D++) { if (beats(mk(D), 180)) last = D; else break }
    console.log(`  Niveau MAX franchissable : ${last === 0 ? 'aucun' : 'niv ' + last}`)
    if (last < 25) reportFight(`Diagnostic au mur niv ${last + 1}`, mk(last + 1), 180)
  } else {
    reportFight(`niv ${ct.level}`, mk(ct.level), 180)
  }
} else {
  console.log('  (Aucun content.raid / content.dungeon dans la config — rien à simuler.)')
}
console.log(`\n${'═'.repeat(70)}`)
console.log('Combat d\'équipe réel (heal + gemmes/runes/pactes/conso). Suppose un jeu parfait (léger plafond).')
console.log(process.argv[2] ? 'Édite ta config et relance pour explorer d\'autres loadouts.' : 'Config d\'EXEMPLE. Lance avec : node scripts/sandbox-sim.mjs ta-config.json')
