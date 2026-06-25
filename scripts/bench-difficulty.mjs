// HARNAIS DE DIFFICULTÉ — la grille « quel raid mure quel build, à quel tier, et POURQUOI ».
//
// On ne SCANNE PAS le max par build (c'est le rôle de builds-bench) : on rejoue TOUT le corpus contre
// une GRILLE FIXE (chaque tier de chaque raid) et on sort, PAR CONTENU :
//   • taux de clear %                         • TTK médian / p25 / p75 (sur les clearers)
//   • marge de survie (TTD ÷ TTK)             • type de mur (DPS / survie / résist)
//   • keystones/uniques partagés par les clearers (détection de build dominant)
//   • VERDICT par pièce : trop dur / sur cible / trop facile (calé sur la bande qui DEVRAIT la battre)
//
// DEUX sources de corpus (cf. docs/DIFFICULTE.md §9 — « test sur de VRAIS builds ») :
//   📚/🌍  Référence + communauté (codes WIB1 → SimConfig)  → joués via le VRAI moteur `runSim`.
//   💾     Save export du joueur (Réglages → exporter)       → équipe RÉELLE jouée via
//          `makeRaidEncounter` + `partyCombatStepMulti` (duo-aware Abîme), avec les VRAIS mods de compte
//          (upgrades/maîtrises/hauts faits) + gemmes/runes/pactes/conso — exactement comme save-audit.
//          Sa progression réelle (`bestStage` / `raidProgress`) sert de VÉRITÉ TERRAIN → on mesure
//          l'offset sim-vs-réel (le sim suppose un jeu parfait ⇒ ~+1 tier optimiste).
//
// On bucketise par bande de progression (bestStage) et on alerte « cluster au sommet vs outlier
// solitaire » (§1 : l'alerte est l'ISOLEMENT d'un build, pas le ×20 brut).
//
//   Usage :  node scripts/bench-difficulty.mjs [chemin/save.json] [--json]   (alias : npm run bench-diff)
//
// MESURE PURE : aucun knob d'équilibrage touché ici. Tout transpile le vrai TS du jeu (zéro copie de
// règles) → les verdicts reflètent l'équilibrage réel. Fidélité = celle de save-audit (kit de boss
// télégraphié + jeu parfait ; les novas/déferlantes/rotations périodiques de tickRaid sont omises, d'où
// le léger optimisme assumé).
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { runSim, getClassPreset, initTalents } from './src/game/simulator.ts'
  export { REFERENCE_BUILDS } from './src/game/referenceBuilds.ts'
  export { decodeBuild } from './src/game/buildCode.ts'
  export { setGlobalCombatMods, charMaxHp, charEhp, charDps, charResist } from './src/game/character.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
  export { RAID_LIST, makeRaidEncounter, raidBerserkTime, raidTierCap, raidReqs, globalTier } from './src/game/raids.ts'
  export { partyCombatStepMulti, resetAllCooldowns, fuelReset, crescendoReset, crescendoBonus } from './src/game/combatEngine.ts'
  export { computeGlobalMods } from './src/game/upgrades.ts'
  export { achievementBonuses } from './src/game/achievements.ts'
  export { sanitizeRaw } from './src/game/save.ts'
  export { getPower, POWERS } from './src/game/powers.ts'
  export { getTalent } from './src/game/talents.ts'
  export { UNIQUE_EFFECTS } from './src/game/uniques.ts'
  export { craftMods } from './src/game/metiers.ts'
  export { condGemMods } from './src/game/condGems.ts'
  export { equippedTimeRunes, timeRuneMods } from './src/game/enchants.ts'
  export { activeBrewBuffs, teamPactMods, teamGemOpts } from './src/game/storeHelpers.ts'
  export { maitriseBonus } from './src/game/biomeBonus.ts'
  export { CHAPITRE_SIZE, chapitreOf } from './src/game/progression.ts'
`)
const {
  runSim, getClassPreset, initTalents, REFERENCE_BUILDS, decodeBuild,
  setGlobalCombatMods, charMaxHp, charEhp, charDps, charResist, EQUIP_SLOTS,
  RAID_LIST, makeRaidEncounter, raidBerserkTime, raidTierCap, raidReqs, globalTier,
  partyCombatStepMulti, resetAllCooldowns, fuelReset, crescendoReset, crescendoBonus,
  computeGlobalMods, achievementBonuses, sanitizeRaw, getPower, POWERS, getTalent, UNIQUE_EFFECTS,
  craftMods, condGemMods, equippedTimeRunes, timeRuneMods, activeBrewBuffs, teamPactMods, teamGemOpts, maitriseBonus,
} = M

/* ---------- KNOBS (lecture seule — purement de mesure) ---------- */
const TRIALS = 3              // essais par cellule (l'aléa esquive/proc) ; victoire = majorité (≥2)
const PROBE_FACTOR = 2        // sonde de survie : fenêtre = PROBE_FACTOR × timer d'enrage (PV boss ≈∞)
const PROBE_TRIALS = 2        // essais de la sonde TTD (uniquement sur les clears — là où la marge parle)
const N_MIN = 3               // builds « sur la bande » mini avant qu'un verdict de cellule soit fiable
const VERDICT_HARD = 0.5      // clear% (sur la bande) < 50% → 🔴 trop dur
const VERDICT_EASY = 0.9      // clear% (sur la bande) ≥ 90% ET marge ≥ FACEROLL → 🟡 trop facile
const FACEROLL_MARGIN = 2.5   // marge de survie au-delà de laquelle un clear « sur la bande » est trivial
const RESIST_GAP = 35         // déficit de résist (unités de raidReq) au-delà duquel un mort = mur « résist »
const OUTLIER_GAP = 2         // bande : top à ≥ OUTLIER_GAP tiers (score) au-dessus du 2ᵉ…
const CLUSTER_NEAR = 1        // …ET aucun autre build à ≤ CLUSTER_NEAR du top → ⚠ outlier solitaire
const BUCKET_MIN = 3          // builds mini dans une bande avant une alerte cluster/outlier (N=2 ne tranche pas)
// COHORTE D'UN VERDICT : un tier T gate un Chapitre ; on ne le juge qu'avec les builds À CE NIVEAU. Trop
// au-dessus = pur out-gear (rouler sur les bas tiers est VOULU, cf. doctrine) → exclu du verdict.
const BAND_BELOW = 1          // …dès 1 chapitre SOUS le gate (presque à niveau)…
const BAND_ABOVE = 3          // …jusqu'à 3 chapitres AU-DESSUS (au-delà = out-gear, non probant)
const DOMINANT_CAP = 8        // plafond d'affichage des leviers DISTINCTIFS partagés par les clearers

/* ---------- helpers ---------- */
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const pad = (s, n) => String(s).padEnd(n).slice(0, n)
const padL = (s, n) => String(s).padStart(n)
const sortNum = (a) => [...a].sort((x, y) => x - y)
const quantile = (arr, q) => { if (!arr.length) return NaN; const s = sortNum(arr); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }
const median = (arr) => quantile(arr, 0.5)
const UNIQUE_NAME = new Map(UNIQUE_EFFECTS.map((u) => [u.id, u.name]))
const uniqueName = (id) => UNIQUE_NAME.get(id) ?? id

const wantJson = process.argv.includes('--json')
const savePath = process.argv.slice(2).find((a) => !a.startsWith('--'))

/* ====================================================================== */
/* CORPUS — communauté (WIB1) + save export                              */
/* ====================================================================== */
const NEUTRAL = { power: 1, attackSpeed: 1, vitality: 1 }
const RAID_ELEM = (def) => (def.element === 'rotating' ? 'arcane' : def.element) // type d'attaque pour 'rotating'

// La grille balaie les 5 raids. raidTierCap : 10 (base) / 2 (Abîme).
const RAIDS = RAID_LIST
const tiersOf = (def) => Array.from({ length: raidTierCap(def) }, (_, i) => i + 1)

/** Stage que la bande DOIT atteindre pour « être sur la cible » d'un tier : Raid T mondial ↔ mur Ch.(T+4). */
const onBandStage = (def, tier) => (globalTier(def, tier) + 4) * M.CHAPITRE_SIZE

const builds = []

/* ---- (1) Communauté + référence : codes/SimConfig → cellule via runSim ---- */
let community = []
try { community = JSON.parse(readFileSync('src/game/communityBuilds.json', 'utf-8')) } catch { /* pas de catalogue */ }
const communityCfgs = community
  .map((b) => ({ name: b.name + (b.by ? ` (${b.by})` : ''), config: decodeBuild(b.code), source: '🌍' }))
  .filter((b) => b.config)
const refCfgs = REFERENCE_BUILDS.map((b) => ({ name: b.name, config: b.config, source: '📚' }))

function cfgKeystones(cfg) {
  const ks = new Set(), uq = new Set()
  for (const m of cfg.team) {
    const tmap = m.imported?.talents ?? m.talents ?? null
    if (tmap) for (const [id, r] of Object.entries(tmap)) { if (r > 0) ks.add(id) }
    else for (const id of (getClassPreset(m.cls).talents ?? [])) ks.add(id)
    if (m.imported) for (const s of EQUIP_SLOTS) { const u = m.imported.equipment?.[s.id]?.unique?.id; if (u) uq.add(u) }
    if (m.gear) for (const g of Object.values(m.gear)) if (g?.unique) uq.add(g.unique)
  }
  return { keystones: [...ks], uniques: [...uq] }
}

for (const { name, config, source } of [...refCfgs, ...communityCfgs]) {
  builds.push({
    name, source, band: config.bestStage ?? 1, ilvl: config.ilvl ?? 0, truth: null,
    sig: cfgKeystones(config),
    applyMods: () => setGlobalCombatMods(NEUTRAL),
    // Cellule via runSim (boss mono ; Abîme mono → léger sous-estimé, comme le note save-audit).
    cell(def, tier) {
      const r = runSim({ ...config, content: { kind: 'raid', id: def.id, tier, scan: false } })
      const o = r.outcome
      return { win: o.win, ttk: o.win ? o.dur : null, ttd: null, firstDead: o.firstDead, firstT: o.firstT, bossLeft: o.bossLeftPct / 100, member: null }
    },
  })
}

/* ---- (2) Save export : équipe réelle → cellule via le moteur d'équipe (save-audit duo-aware) ---- */
function loadSave(path) {
  let raw
  try { raw = JSON.parse(readFileSync(path, 'utf8')) }
  catch (e) { console.error(`✗ Lecture/JSON impossible : ${path}\n  ${e.message}`); process.exit(1) }
  if (raw && !Array.isArray(raw.characters) && raw.data && Array.isArray(raw.data.characters)) raw = raw.data // export enveloppé
  const save = sanitizeRaw(raw)
  if (!save) { console.error('✗ Fichier non reconnu comme une sauvegarde Warrior Idler (champ "characters" manquant ?).'); process.exit(1) }
  return save
}

if (savePath) {
  const save = loadSave(savePath)
  const eco = computeGlobalMods(save.upgrades ?? {}, save.maitrise ?? {}, achievementBonuses(save.achievements ?? {}))
  // KIT DE COMBAT RÉEL (full-fidélité) — reconstruit le `mods` comme tickRaid (cf. save-audit).
  const craft = craftMods(save.metiers ?? {})
  const cond = condGemMods(save.characters, craft.gemSpec, teamGemOpts(save, craft))
  const runes = timeRuneMods(equippedTimeRunes(save.characters), craft.runisteTempo)
  const buffs = activeBrewBuffs(save)
  const pact = teamPactMods(save, craft, buffs)
  const heroMult = (1 + maitriseBonus(save.bestStage ?? 1)) * (1 + crescendoBonus(cond.crescendoCap)) * buffs.dmgMult
  const PLAYER_MODS = { heroMult, cond, runes, pact, content: { antidote: buffs.antidote ?? undefined } }

  const party0 = save.characters
  const freshParty = () => {
    // ids STABLES (= ceux du save) → cache de stats borné + cooldowns scopés (cf. save-audit/simulator).
    const p = party0.map((ch) => ({ ...ch, hp: charMaxHp(ch), dots: undefined, weaken: undefined, stun: 0, rez: undefined }))
    resetAllCooldowns(p); fuelReset(); crescendoReset()
    return p
  }
  // Un combat d'équipe vs la RENCONTRE (boss seul ou duo de l'Abîme) jusqu'au kill (win) ou wipe/temps (loss).
  function simKill(def, tier) {
    let p = freshParty()
    let enemies = makeRaidEncounter(def, tier, RAID_ELEM(def), save.bestStage ?? 1, p.length)
    const limit = raidBerserkTime(def, tier)
    const death = {}; let t = 0
    for (; t < limit && enemies.some((e) => e.hp > 0) && p.some((x) => x.hp > 0); t += 0.2) {
      const r = partyCombatStepMulti(p, enemies, 0.2, PLAYER_MODS); p = r.chars; enemies = r.enemies
      for (const ch of p) if (ch.hp <= 0 && !(ch.name in death)) death[ch.name] = t
    }
    const order = Object.entries(death).sort((a, b) => a[1] - b[1])
    const boss = enemies[0]
    return { win: enemies.every((e) => e.hp <= 0), ttk: t, firstDead: order[0]?.[0] ?? null, firstT: order[0]?.[1] ?? 0, bossLeft: boss.hp / boss.maxHp }
  }
  // Sonde de survie : même rencontre, PV ≈∞ → on lit COMBIEN DE TEMPS l'équipe tient (TTD).
  function simSurvive(def, tier) {
    let p = freshParty()
    let enemies = makeRaidEncounter(def, tier, RAID_ELEM(def), save.bestStage ?? 1, p.length)
    for (const e of enemies) { e.hp = 1e18; e.maxHp = 1e18 }
    const window = raidBerserkTime(def, tier) * PROBE_FACTOR
    let t = 0, firstT = null
    for (; t < window && p.some((x) => x.hp > 0); t += 0.2) {
      const r = partyCombatStepMulti(p, enemies, 0.2, PLAYER_MODS); p = r.chars; enemies = r.enemies
      for (const e of enemies) { e.hp = 1e18 } // re-clamp (DoT/thorns peuvent les entamer)
      if (firstT === null && p.some((x) => x.hp <= 0)) firstT = t
    }
    return { ttd: firstT ?? window, survived: firstT === null }
  }
  // Résist : déficit max (req − résist équipe) sur les types exigés du tier → étiquette le mur de survie.
  const memberResist = save.characters.map((c) => charResist(c))
  function resistGap(firstDead, def, tier) {
    const reqs = raidReqs(def, tier)
    const idx = Math.max(0, save.characters.findIndex((c) => c.name === firstDead))
    const res = memberResist[idx] ?? {}
    let worst = 0
    for (const [type, req] of Object.entries(reqs)) worst = Math.max(worst, req - (res[type] ?? 0))
    return worst
  }

  const sig = { keystones: [], uniques: [] }
  { const ks = new Set(), uq = new Set()
    for (const c of save.characters) { for (const [id, r] of Object.entries(c.talents ?? {})) if (r > 0) ks.add(id)
      for (const s of EQUIP_SLOTS) { const u = c.equipment?.[s.id]?.unique?.id; if (u) uq.add(u) } }
    sig.keystones = [...ks]; sig.uniques = [...uq] }

  // ilvl moyen équipé (bande) — moyenne sur les persos de la moyenne de leurs pièces.
  const teamIlvl = Math.round(save.characters.reduce((acc, c) => {
    const its = EQUIP_SLOTS.map((s) => c.equipment?.[s.id]).filter(Boolean)
    return acc + (its.length ? its.reduce((a, it) => a + (it.ilvl ?? 0), 0) / its.length : 0)
  }, 0) / Math.max(1, save.characters.length))

  builds.push({
    name: `${(save.characters[save.activeChar] ?? save.characters[0])?.name ?? 'roster'} +${save.characters.length - 1}`,
    source: '💾', band: save.bestStage ?? 1, ilvl: teamIlvl, truth: save.raidProgress ?? null, sig,
    applyMods: () => setGlobalCombatMods({ power: eco.power, attackSpeed: eco.attackSpeed, vitality: eco.vitality }),
    cell(def, tier) {
      const trials = Array.from({ length: TRIALS }, () => simKill(def, tier))
      const wins = trials.filter((x) => x.win)
      const win = wins.length >= Math.ceil(TRIALS / 2)
      const ref = (win ? wins : trials.filter((x) => !x.win))[0] ?? trials[0]
      const ttk = win ? median(wins.map((x) => x.ttk)) : null
      let ttd = null
      if (win) ttd = median(Array.from({ length: PROBE_TRIALS }, () => simSurvive(def, tier).ttd))
      return { win, ttk, ttd, firstDead: ref.firstDead, firstT: ref.firstT, bossLeft: ref.bossLeft, member: ref.firstDead, resistGap: ref.firstDead ? resistGap(ref.firstDead, def, tier) : 0 }
    },
  })
}

if (!builds.length) {
  console.error('✗ Corpus vide : aucun build communautaire/référence, et aucun save fourni.')
  console.error('  → Fournis un export : node scripts/bench-difficulty.mjs chemin/vers/ta-save.json')
  process.exit(1)
}

/* ====================================================================== */
/* EXÉCUTION DE LA GRILLE                                                 */
/* ====================================================================== */
// grid[raidId][tier] = { cells: [{build, out}] }
const grid = {}
for (const def of RAIDS) { grid[def.id] = {}; for (const t of tiersOf(def)) grid[def.id][t] = { cells: [] } }
// maxClear[buildName][raidId] = tier max clear (offset + buckets)
const maxClear = new Map()

for (const b of builds) {
  b.applyMods()
  maxClear.set(b.name, {})
  for (const def of RAIDS) {
    let last = 0
    for (const t of tiersOf(def)) {
      const out = b.cell(def, t)
      grid[def.id][t].cells.push({ build: b, out })
      if (out.win) last = t
    }
    maxClear.get(b.name)[def.id] = last
  }
}

/* ====================================================================== */
/* AGRÉGATION + RAPPORT                                                   */
/* ====================================================================== */
function wallKind(out) {
  if (out.win) return null
  if (out.firstDead) return (out.resistGap ?? 0) >= RESIST_GAP ? 'résist' : 'survie'
  return 'DPS' // personne ne tombe + boss vivant à l'enrage = mur de DPS
}

function cellAgg(def, tier) {
  const cells = grid[def.id][tier].cells
  const total = cells.length
  const clearers = cells.filter((c) => c.out.win)
  const losers = cells.filter((c) => !c.out.win)
  const ttks = clearers.map((c) => c.out.ttk).filter((x) => x != null)
  const margins = clearers.map((c) => (c.out.ttd != null && c.out.ttk ? c.out.ttd / c.out.ttk : null)).filter((x) => x != null)
  const walls = { DPS: 0, survie: 0, 'résist': 0 }
  for (const c of losers) { const k = wallKind(c.out); if (k) walls[k]++ }
  // COHORTE du verdict : builds dont la bande encadre le Chapitre gaté (ni sous-niveau, ni out-gear).
  const need = onBandStage(def, tier)
  const lo = need - BAND_BELOW * M.CHAPITRE_SIZE, hi = need + BAND_ABOVE * M.CHAPITRE_SIZE
  const onBand = cells.filter((c) => c.build.band >= lo && c.build.band <= hi)
  const onBandClear = onBand.filter((c) => c.out.win).length
  return { total, clear: clearers.length, ttks, margins, walls, onBand: onBand.length, onBandClear, clearers }
}

function verdict(a) {
  if (a.onBand < N_MIN) return '⚪ N insuff.'
  const r = a.onBandClear / a.onBand
  const medM = median(a.margins)
  if (r < VERDICT_HARD) return '🔴 trop dur'
  if (r >= VERDICT_EASY && (isNaN(medM) || medM >= FACEROLL_MARGIN)) return '🟡 trop facile'
  return '🟢 sur cible'
}

console.log('═'.repeat(78))
console.log('HARNAIS DE DIFFICULTÉ — grille sur vrais builds (mesure pure, aucun knob touché)')
console.log('═'.repeat(78))
const nSave = builds.filter((b) => b.source === '💾').length
console.log(`Corpus : ${refCfgs.length} référence · ${communityCfgs.length} communauté · ${nSave} save`)
if (nSave) { const sb = builds.find((b) => b.source === '💾'); console.log(`Save « ${sb.name} » — bande bestStage ${sb.band} · ilvl moyen ${sb.ilvl} · vérité terrain ${sb.truth ? 'incluse' : 'absente'}`) }
console.log(`Essais/cellule : ${TRIALS} (majorité) · sonde de survie : ${PROBE_FACTOR}× enrage, ${PROBE_TRIALS} essais`)

/* ---- BLOC 1 : grille par raid ---- */
for (const def of RAIDS) {
  console.log(`\n── ${def.icon} ${def.name} ──`)
  console.log('  Tier  Clear%   TTK méd (p25/p75)     Marge   Mur D/S/R          Verdict')
  for (const t of tiersOf(def)) {
    const a = cellAgg(def, t)
    const clearPct = a.total ? Math.round((a.clear / a.total) * 100) : 0
    const ttkTxt = a.ttks.length ? `${median(a.ttks).toFixed(0)}s (${quantile(a.ttks, 0.25).toFixed(0)}/${quantile(a.ttks, 0.75).toFixed(0)})` : '—'
    const marginTxt = a.margins.length ? `${median(a.margins).toFixed(1)}×` : '—'
    const wallTxt = `${a.walls.DPS}/${a.walls.survie}/${a.walls['résist']}`
    console.log(`  T${padL(t, 2)}  ${padL(clearPct + '%', 5)}   ${pad(ttkTxt, 19)}  ${padL(marginTxt, 6)}   ${pad(wallTxt, 14)}     ${verdict(a)}`)
  }
}

/* ---- BLOC 2 : offset sim-vs-réel (save) ---- */
const saveBuild = builds.find((b) => b.source === '💾')
if (saveBuild && saveBuild.truth) {
  console.log('\n── OFFSET SIM-vs-RÉEL (save export) ──')
  console.log('  Raid                    Réel    Sim max   Offset')
  const offsets = []
  for (const def of RAIDS) {
    const real = saveBuild.truth[def.id] ?? 0
    const sim = maxClear.get(saveBuild.name)[def.id] ?? 0
    const off = sim - real
    if (real > 0 || sim > 0) offsets.push(off)
    console.log(`  ${pad(def.icon + ' ' + def.name, 22)}  ${padL('T' + real, 4)}    ${padL('T' + sim, 5)}    ${off >= 0 ? '+' : ''}${off}`)
  }
  if (offsets.length) {
    const med = median(offsets)
    console.log(`  → offset médian : ${med >= 0 ? '+' : ''}${med.toFixed(1)} tier`)
    console.log(med >= 3
      ? '    ⚠ offset large : surtout des RAIDS NON POUSSÉS à leur plafond (build sous-exploité) — pas que l\'optimisme du sim.'
      : '    (le sim suppose un jeu parfait ⇒ ~+1 tier optimiste)')
  }
} else if (saveBuild) {
  console.log('\n── OFFSET SIM-vs-RÉEL : vérité terrain absente du save (raidProgress vide) ──')
}

/* ---- BLOC 3 : build dominant (keystones/uniques partagés par les clearers) ---- */
// On regarde les cellules « de pointe » (les 2 plus hauts tiers clearés de chaque raid) — c'est là que
// la concentration de build se voit. On ne signale que ce qui est partagé par TOUS les clearers (≥2).
const TRIVIAL = (id) => id === 'co_start' || id.startsWith('cat_') || id.startsWith('cl_')
const isCapstone = (id) => id.startsWith('id_') // capstones d'identité = le cœur du build
console.log('\n── BUILD DOMINANT (leviers DISTINCTIFS partagés par les clearers, cellules de pointe) ──')
let dominantFound = false
for (const def of RAIDS) {
  const cleared = tiersOf(def).filter((t) => grid[def.id][t].cells.some((c) => c.out.win))
  for (const t of cleared.slice(-2)) {
    const cells = grid[def.id][t].cells
    const clearers = cells.filter((c) => c.out.win)
    const losers = cells.filter((c) => !c.out.win)
    if (clearers.length < 2) continue
    let ks = intersect(clearers.map((c) => c.build.sig.keystones)).filter((id) => !TRIVIAL(id))
    let uq = intersect(clearers.map((c) => c.build.sig.uniques))
    // DISTINCTIF : on retire ce que les NON-clearers ont aussi (un levier commun n'explique pas le clear).
    if (losers.length) {
      const ksL = new Set(losers.flatMap((c) => c.build.sig.keystones))
      const uqL = new Set(losers.flatMap((c) => c.build.sig.uniques))
      ks = ks.filter((id) => !ksL.has(id)); uq = uq.filter((id) => !uqL.has(id))
    } else {
      ks = ks.filter(isCapstone) // pas de contraste possible → on ne garde que les capstones d'identité
    }
    // On MÈNE par ce qui DÉFINIT le build (capstones d'identité + uniques) ; le reste = simple compteur
    // (« même archétype ») pour ne pas dérouler tout l'arbre.
    const caps = ks.filter(isCapstone).map((id) => getTalent(id)?.name ?? id)
    const uqs = uq.map((id) => `✦${uniqueName(id)}`)
    const others = ks.filter((id) => !isCapstone(id)).length
    const lead = [...caps, ...uqs]
    if (!lead.length && !others) continue
    dominantFound = true
    const head = lead.slice(0, DOMINANT_CAP).join(' · ') + (lead.length > DOMINANT_CAP ? ' …' : '')
    const tail = others ? `  (+${others} nœuds communs — même archétype)` : ''
    console.log(`  ${def.icon} ${def.name} T${t} (${clearers.length}/${cells.length}) : ${head || '—'}${tail}`)
  }
}
if (!dominantFound) console.log('  (rien de distinctif partagé par ≥2 clearers — corpus trop petit ou builds trop proches)')

/* ---- BLOC 4 : buckets par bande de progression + alerte cluster/outlier ---- */
console.log('\n── BUCKETS PAR BANDE DE PROGRESSION (bestStage → Chapitre) ──')
const byBand = new Map()
for (const b of builds) { const ch = M.chapitreOf(b.band); if (!byBand.has(ch)) byBand.set(ch, []); byBand.get(ch).push(b) }
for (const ch of [...byBand.keys()].sort((a, b) => a - b)) {
  const list = byBand.get(ch)
  // score de puissance = somme des tiers max clearés sur tous les raids.
  const scored = list.map((b) => ({ b, score: RAIDS.reduce((s, def) => s + (maxClear.get(b.name)[def.id] ?? 0), 0), dps: 0 }))
    .sort((x, y) => y.score - x.score)
  const dpsRatio = (() => { const ds = list.map((b) => b.ilvl).filter((x) => x > 0); return ds.length ? Math.max(...ds) / Math.max(1, median(ds)) : 0 })()
  console.log(`  Chapitre ${ch} (${list.length} build${list.length > 1 ? 's' : ''}) : top score ${scored[0].score} · médian ${median(scored.map((s) => s.score)).toFixed(0)} · top ${scored.map((s) => s.b.source).join('')}`)
  if (list.length < BUCKET_MIN) { console.log(`    ⚪ N insuffisant (<${BUCKET_MIN}) — pas d'alerte cluster/outlier fiable.`); continue }
  const top = scored[0].score, second = scored[1].score
  const near = scored.filter((s) => s !== scored[0] && top - s.score <= CLUSTER_NEAR).length
  if (top - second >= OUTLIER_GAP && near === 0) console.log(`    ⚠ OUTLIER solitaire : « ${scored[0].b.name} » seul à ${top} (2ᵉ à ${second}) — risque de build obligatoire (ligne rouge n°1).`)
  else console.log(`    ✓ cluster sain (${near + 1} build(s) à ≤${CLUSTER_NEAR} du top).`)
}

/* ---- BLOC 5 : récap des verdicts ---- */
console.log('\n── RÉCAP VERDICTS ──')
const hard = [], easy = []
for (const def of RAIDS) for (const t of tiersOf(def)) { const a = cellAgg(def, t); const v = verdict(a)
  if (v.includes('trop dur')) hard.push(`${def.icon}${def.name.split(' ')[1] ?? def.name} T${t} (mur ${dominantWall(a.walls)})`)
  if (v.includes('trop facile')) easy.push(`${def.icon} T${t}`) }
console.log(`  🔴 trop dur  : ${hard.join(' · ') || 'aucun'}`)
console.log(`  🟡 trop facile : ${easy.join(' · ') || 'aucun'}`)

console.log('\n' + '═'.repeat(78))
console.log('Fidélité = save-audit (kit de boss télégraphié + jeu parfait ; novas/déferlantes/rotations')
console.log('périodiques de tickRaid omises ⇒ ~+1 tier optimiste — d\'où l\'offset mesuré ci-dessus).')
console.log(savePath ? 'Grille terminée.' : 'Grille sur le corpus communautaire. Ajoute ta save : node scripts/bench-difficulty.mjs ta-save.json')

/* ---- (optionnel) dump JSON pour un futur dashboard ---- */
if (wantJson) {
  const dump = {
    generatedAt: new Date().toISOString(),
    builds: builds.map((b) => ({ name: b.name, source: b.source, band: b.band, ilvl: b.ilvl, truth: b.truth, maxClear: maxClear.get(b.name) })),
    grid: RAIDS.map((def) => ({ raid: def.id, tiers: tiersOf(def).map((t) => { const a = cellAgg(def, t)
      return { tier: t, total: a.total, clear: a.clear, ttkMed: a.ttks.length ? median(a.ttks) : null, marginMed: a.margins.length ? median(a.margins) : null, walls: a.walls, verdict: verdict(a) } }) })),
  }
  writeFileSync('difficulty-report.json', JSON.stringify(dump, null, 2))
  console.log('→ JSON écrit : difficulty-report.json')
}

/* ---- petites fonctions partagées ---- */
function intersect(lists) {
  if (!lists.length) return []
  return lists.reduce((acc, l) => acc.filter((x) => l.includes(x)), [...lists[0]])
}
function dominantWall(walls) {
  const e = Object.entries(walls).sort((a, b) => b[1] - a[1])[0]
  return e && e[1] > 0 ? e[0] : '—'
}
