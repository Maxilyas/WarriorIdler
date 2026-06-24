// EXPLORATEUR DE BUILDS — matrice d'équilibrage via le VRAI moteur de combat (partyCombatStep).
// Croise des ARCHÉTYPES (chemins de classe réels) × une ORIENTATION de stuff (offensif/équilibré/défensif),
// fabrique un perso stuffé réel (generateItem), et SIMULE le combat d'équipe jusqu'au kill/wipe contre
// le contenu (tiers de raid + niveaux de donjon) → tier/niveau MAX battable + DPS/EHP.
//
// But : voir (1) quel build domine, (2) si l'offensif reste viable ou si « les monstres font trop mal »
// → on est forcé vers le défensif. Solo (1 perso) pour ISOLER la puissance du build (pas de heal externe).
// Pas encore de gemmes/runes (couche suivante) : tous les builds sur le même pied → comparaison juste.
//
// Lancer : node scripts/build-explorer.mjs
import { build } from 'esbuild'

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
  export { partyCombatStep, resetAllCooldowns, fuelReset, crescendoReset } from './src/game/combatEngine.ts'
  export { condGemMods } from './src/game/condGems.ts'
  export { timeRuneMods } from './src/game/enchants.ts'
`)
const {
  makeCharacter, charDps, charMaxHp, charEhp, charDerived, charDamageProfile, charCombatMods, setGlobalCombatMods,
  profileDamageMult, generateItem, EQUIP_SLOTS, RAID_LIST, makeRaidBoss, raidBerserkTime,
  makeDungeonEnemy, dungeonFights, DUNGEONS, partyCombatStep, resetAllCooldowns, fuelReset, crescendoReset, condGemMods, timeRuneMods,
} = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 }) // pas d'upgrades de compte (comparaison pure)

const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

// Archétypes = chemins de classe RÉELS (mêmes ids que ttk-sim, v0.42 : classe + keystones + capstone + passifs).
const ARCHETYPES = [
  { name: 'Guerrier (FOR)', primary: 'force', bias: 'force', elem: 'physique',
    talents: ['cat_plaque', 'cl_guerrier', 'se_hub', 'se_brutal', 'se_mortel', 'se_rage', 'id_guerrier'],
    support: ['se_mutile'], powers: ['gu_frappe', 'se_sentence', 'se_saignement', 'se_decapite', 'se_tourmente'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
  { name: 'Voleur (AGI)', primary: 'agilite', bias: 'agilite', elem: 'physique',
    talents: ['cat_cuir', 'cl_voleur', 'om_hub', 'om_saig', 'om_surin', 'om_jum', 'id_voleur'],
    support: ['om_frappe_sournoise'], powers: ['om_eviscaration', 'vo_tranchant', 'om_embuscade', 'om_eventail', 'as_lame_enduite'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
  { name: 'Mage (INT)', primary: 'intelligence', bias: 'intelligence', elem: 'feu',
    talents: ['cat_tissu', 'cl_mage', 'py_hub', 'py_pyromanie', 'py_hotstreak', 'py_combustion', 'id_mage'],
    support: [], powers: ['ma_eclair', 'py_boule', 'py_pyroblast', 'py_flammes', 'py_immolation'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
  // Chasseur voie MEUTE (familier) — keystones petDps (me_familier/me_meute) + me_frenesie (dmgMult) + capstone.
  { name: 'Chasseur (AGI)', primary: 'agilite', bias: 'agilite', elem: 'physique',
    talents: ['cat_mailles', 'cl_chasseur', 'me_hub', 'me_familier', 'me_meute', 'me_frenesie', 'me_coordination', 'id_chasseur'],
    support: [], powers: ['ch_tir', 'me_cmd', 'me_morsure', 'me_saignee', 'me_curee'], passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'] },
]
const ORIENTATIONS = ['offensif', 'equilibre', 'defensif']
// KITS (gemmes de condition + runes de temps). Un `kit` = { gems:[ids], runes:[ids] }.
const GEMS_OFF = ['overkill', 'tambour', 'hemorragie']   // rythme : offensif
const GEMS_DEF = ['sixieme', 'tresorerie', 'souffle']    // anti-télégraphe + bouclier + auto-soin
const KIT_OFF = { gems: GEMS_OFF, runes: ['premierElan', 'hateFunebre'] }
const KIT_DEF = { gems: GEMS_DEF, runes: ['sursis', 'boucle'] }
const NO_KIT = { gems: [], runes: [] }
// Kit STANDARD appliqué à TOUTE la matrice (mixte pratique) — la compétition « comme on joue vraiment ».
const KIT_STD = { gems: ['sixieme', 'tresorerie', 'overkill'], runes: ['premierElan', 'sursis'] }

// Bande de progression évaluée (un point fin de jeu, calé sur la table de ttk-sim/dungeon-sim).
const ILVL = 200, RARITY = 'mythique', LEVEL = 75, BEST_STAGE = 300

function gearedChar(arch, orientation, gemIds = []) {
  const c = makeCharacter('Sim', LEVEL, arch.bias)
  const eq = {}
  for (const s of EQUIP_SLOTS) {
    eq[s.id] = generateItem({ ilvl: ILVL, rarity: RARITY, type: s.accepts, primary: arch.primary, stars: 3, orientation, ...(s.accepts === 'armePrincipale' ? { element: arch.elem } : {}) })
  }
  c.equipment = eq
  // Pose les gemmes de condition sur les premiers emplacements (forme réelle : item.gems = [{cond,rank,quality}]).
  const slotIds = EQUIP_SLOTS.map((s) => s.id)
  gemIds.forEach((id, i) => { const it = eq[slotIds[i % slotIds.length]]; it.gems = [...(it.gems ?? []), { cond: id, rank: 5, quality: 2 }] })
  c.talents = { co_start: 1 }
  for (const t of arch.talents) c.talents[t] = 1
  c.powers = [...arch.powers]
  c.support = [...(arch.support ?? [])]
  c.passives = [...(arch.passives ?? [])]
  c.hp = charMaxHp(c)
  return c
}
// DoT keystone (auto-attaques appliquant un DoT, non inclus dans charDps) — pour le DPS affiché.
function dotDps(c) {
  const cm = charCombatMods(c); if (!cm.dot) return 0
  const d = charDerived(c), pm = profileDamageMult(charDamageProfile(c))
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult
}
const totalDps = (c) => charDps(c) + dotDps(c)
// generateItem tire des affixes ALÉATOIRES → on moyenne DPS/EHP sur plusieurs sets pour des chiffres stables.
function avgStats(arch, orient, n = 8) {
  let dps = 0, ehp = 0
  for (let i = 0; i < n; i++) { const c = gearedChar(arch, orient); dps += totalDps(c); ehp += charEhp(c) }
  return { dps: dps / n, ehp: ehp / n }
}

// Combat SOLO via le vrai moteur jusqu'au kill (gagné) ou wipe/temps (perdu).
// `kit` = { gems:[ids], runes:[ids] } → gemmes posées (condGemMods) + runes (timeRuneMods), comme tickRaid.
function simWin(arch, orientation, kit, makeEnemy, timeLimit) {
  let p = [gearedChar(arch, orientation, kit.gems)]
  const mods = (kit.gems.length || kit.runes.length)
    ? { heroMult: 1, cond: condGemMods(p), runes: timeRuneMods(new Set(kit.runes)) }
    : undefined
  resetAllCooldowns(p); fuelReset(); crescendoReset()
  let enemy = makeEnemy(1)
  for (let t = 0; t < timeLimit && enemy.hp > 0 && p[0].hp > 0; t += 0.2) {
    const r = partyCombatStep(p, enemy, 0.2, mods)
    p = r.chars; enemy = r.enemy
  }
  return enemy.hp <= 0
}
const beats = (arch, orient, kit, makeEnemy, timeLimit) => {
  let w = 0; for (let i = 0; i < 3; i++) if (simWin(arch, orient, kit, makeEnemy, timeLimit)) w++; return w >= 2 // majorité (2/3) : battable de façon fiable
}

// Contenu de référence : 1er raid (Forge) pour le tier max, + un donjon « gros PV » pour le niveau max.
const REF_RAID = RAID_LIST[0]
const REF_RAID_EL = REF_RAID.element === 'rotating' ? 'arcane' : REF_RAID.element
const REF_DUN = Object.values(DUNGEONS)[0]
function maxRaidTier(arch, orient, kit = NO_KIT) {
  let last = 0
  for (let t = 1; t <= 15; t++) { if (beats(arch, orient, kit, (n) => makeRaidBoss(REF_RAID, t, REF_RAID_EL, BEST_STAGE, n), raidBerserkTime(REF_RAID, t))) last = t; else break }
  return last
}
function maxDunLevel(arch, orient, kit = NO_KIT) {
  let last = 0
  for (let D = 1; D <= 25; D++) { const f = dungeonFights(D); if (beats(arch, orient, kit, () => makeDungeonEnemy(REF_DUN, D, f - 1, f, [], BEST_STAGE), 180)) last = D; else break }
  return last
}

/* ---------- run de la matrice ---------- */
console.log(`=== EXPLORATEUR DE BUILDS — moteur réel, SOLO · iLvl ${ILVL} ${RARITY} · niv ${LEVEL} · record ${BEST_STAGE} ===`)
console.log(`Contenu de réf : raid ${REF_RAID.icon} ${REF_RAID.name} · donjon ${REF_DUN.icon} ${REF_DUN.name}`)
console.log(`KIT STANDARD appliqué à tous : gemmes [${KIT_STD.gems.join(', ')}] · runes [${KIT_STD.runes.join(', ')}]\n`)
console.log('Archétype          Orient.    DPS       EHP      RaidTmax  DonjonMax')
const rows = []
for (const arch of ARCHETYPES) {
  for (const orient of ORIENTATIONS) {
    const { dps, ehp } = avgStats(arch, orient)
    const rt = maxRaidTier(arch, orient, KIT_STD), dl = maxDunLevel(arch, orient, KIT_STD)
    rows.push({ arch: arch.name, orient, dps, ehp, rt, dl })
    console.log(`${arch.name.padEnd(18)} ${orient.padEnd(10)} ${fmt(dps).padStart(7)}  ${fmt(ehp).padStart(8)}   ${String(rt).padStart(5)}    ${String(dl).padStart(6)}`)
  }
  console.log('')
}

/* ---------- verdicts d'équilibrage ---------- */
console.log('=== Lecture d\'équilibrage ===')
// 1) Écart de PUISSANCE entre archétypes (à orientation offensive) — équilibre des classes.
const off = rows.filter((r) => r.orient === 'offensif')
const dpsHi = Math.max(...off.map((r) => r.dps)), dpsLo = Math.min(...off.map((r) => r.dps))
const topA = off.find((r) => r.dps === dpsHi).arch, botA = off.find((r) => r.dps === dpsLo).arch
console.log(`• Écart de DPS entre classes (offensif) : ×${(dpsHi / dpsLo).toFixed(2)}  (top ${topA} / bottom ${botA})  — idéal < ×1,6`)
const rtHi = Math.max(...off.map((r) => r.rt)), rtLo = Math.min(...off.map((r) => r.rt))
console.log(`• Tier de raid max franchi (offensif) : de T${rtLo} à T${rtHi} selon la classe — un grand écart = déséquilibre de classe`)

// 2) Direction FORCÉE : gain de contenu en passant offensif → défensif (par archétype).
console.log('• Offensif vs défensif (le contenu franchi en plus en sacrifiant du DPS) :')
let forcedVotes = 0
for (const arch of ARCHETYPES) {
  const o = rows.find((r) => r.arch === arch.name && r.orient === 'offensif')
  const d = rows.find((r) => r.arch === arch.name && r.orient === 'defensif')
  const dRt = d.rt - o.rt, dDl = d.dl - o.dl, dpsCost = (1 - d.dps / o.dps) * 100
  if (dRt >= 2 || dDl >= 3) forcedVotes++
  console.log(`    ${arch.name.padEnd(18)} défensif : ${dRt >= 0 ? '+' : ''}${dRt} tier de raid · ${dDl >= 0 ? '+' : ''}${dDl} niv donjon  (pour −${dpsCost.toFixed(0)}% DPS)`)
}
console.log(forcedVotes >= 2
  ? '  → ⚠ Le défensif débloque nettement plus de contenu que l\'offensif : les monstres POUSSENT à la défense (« on est forcé »).'
  : '  → ✓ L\'offensif reste compétitif : tu peux jouer la puissance sans être muré par la survie.')
// 3) Impact du KIT (gemmes + runes) sur un build de réf — le « tous les composants ».
console.log('\n=== Impact du kit gemmes+runes (réf : ' + ARCHETYPES[0].name + ' offensif, vs ' + REF_RAID.icon + ' ' + REF_RAID.name + ') ===')
for (const [label, kit] of [['sans kit', NO_KIT], ['kit OFFENSIF', KIT_OFF], ['kit DÉFENSIF', KIT_DEF]]) {
  const rt = maxRaidTier(ARCHETYPES[0], 'offensif', kit), dl = maxDunLevel(ARCHETYPES[0], 'offensif', kit)
  console.log(`  ${label.padEnd(13)} RaidTmax T${String(rt).padStart(2)} · DonjonMax ${String(dl).padStart(2)}   gemmes [${kit.gems.join(', ') || '—'}] · runes [${kit.runes.join(', ') || '—'}]`)
}
console.log('  (Gemmes+runes agissent EN COMBAT via condGemMods/timeRuneMods — pas dans les colonnes DPS/EHP statiques.')
console.log('   La défense anti-télégraphe « sixieme » + bouclier/soin/Sursis fait gagner du tier quand le mur est la survie.)')

console.log('\n(Solo, sans heal externe — comparaison RELATIVE. Étends ARCHETYPES/ORIENTATIONS et les KIT_* pour plus de cas.)')
