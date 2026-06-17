// Harnais MURS (refonte v0.35 — DESIGN_v0.35 §5-6) — l'outil qui pilote le calibrage.
//
// Pour chaque Palier, compare DEUX builds contre le boss-MUR (vague 10) :
//   • Build NU     = loot ilvl + stat primaire SEULE (zéro secondaire/talent/gemme/rune/pacte/alch).
//   • Build CIBLE  = loot ilvl + secondaires + talents (SIMULÉS FIDÈLEMENT via le vrai code)
//                    × l'enveloppe des systèmes situationnels (gemmes/runes/pacte/alch), PARAMÉTRÉE
//                    et scalée par le taux d'optimisation attendu τ(palier) (cf. §5.1-5.2).
//
// Règle de calibrage (§5.3) : à chaque Palier, le Build NU doit ÉCHOUER et le Build CIBLE doit
// PASSER, sur les checks ACTIFS de la tranche (DPS tôt → DPS+survie → +sustain tard). La marge de
// clear du CIBLE se resserre quand le Palier monte (margeMur). C'est ce double test qui transforme
// le retard de gear (LAG) en EXIGENCE d'optimisation réelle.
//
// Knobs (en tête) : LAG (progression.ts), τ, margeMur, TARGET_BOSS_TTK, enveloppes du stack.
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charCombatMods, setGlobalCombatMods } from './src/game/character.ts'
  export { generateItem } from './src/game/items.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export * as P from './src/game/progression.ts'
`)
const { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charEhp, charCombatMods, setGlobalCombatMods, generateItem, EQUIP_SLOTS, P } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })

// ---- KNOBS (à éprouver) ----
const PALIERS = [1, 5, 10, 15, 20, 25, 30, 35, 40]
const TARGET_BOSS_TTK = P.TTK.boss            // ~35 s : clear visé du Build CIBLE
const SURVIVE = P.SURVIVE_SECONDS             // ~8 s : secondes de boss encaissables minimum

/** Taux d'optimisation ATTENDU au Palier (§5.2) — par paliers (pas une rampe). */
function tau(p) { return p <= 10 ? 0.40 : p <= 25 ? 0.65 : 0.90 }
/** Nombre de checks ACTIFS (§5.2) : DPS tôt → +survie → +sustain. */
function nbChecks(p) { return p <= 10 ? 1 : p <= 25 ? 2 : 3 }
/** Marge de clear du CIBLE — large tôt, serrée tard (§6). */
function margeMur(p) { return Math.max(1.05, Math.min(1.30, 1.30 - (p - 10) * (0.25 / 30))) }

// Enveloppes des systèmes SITUATIONNELS (gemmes/runes/pacte/alch), au PLEIN (τ=1), d'après §5.1.
// (Les secondaires + talents NE sont PAS ici : ils sont dans le DPS/EHP réel du Build CIBLE.)
const STACK_DMG_FULL = 2.6   // gemmes ×1,3 · runes ×1,2 · pacte ×1,4 · alch ×1,2 (combiné, conservateur)
const STACK_SURV_FULL = 2.5  // gemmes bastion ×1,4 · runes ×1,15 · pacte ×1,3 · alch ×1,2
const stackDmg = (t) => 1 + (STACK_DMG_FULL - 1) * t
const stackSurv = (t) => 1 + (STACK_SURV_FULL - 1) * t

// Builds représentatifs (mêmes que ttk-sim/build-sim — comparaison contrôlée).
const BUILDS = {
  FORCE: { primary: 'force', bias: 'force', elem: 'physique', talents: ['fo_b5', 'fo_c4', 'bo_b2', 'fo_b1', 'du_a3'], powers: ['frappe_lourde', 'choc_sismique', 'laceration', 'decapitation', 'tourbillon'] },
  AGI: { primary: 'agilite', bias: 'agilite', elem: 'physique', talents: ['ag_b5', 'du_b2', 'sp_b2', 'ag_b3', 'du_a3'], powers: ['eviscaration', 'tir_precis', 'volee_de_fleches', 'poison', 'soif_du_neant'] },
  INT: { primary: 'intelligence', bias: 'intelligence', elem: 'arcane', talents: ['in_a7', 'in_b5', 'el_a1', 'el_a3', 'in_a5'], powers: ['eclair', 'embrasement', 'trait_de_givre', 'salve_arcanique', 'deluge_stellaire'] },
}

const charLevel = (stage) => Math.max(1, Math.min(120, stage))

// Build CIBLE : équipement légendaire RÉEL à l'ilvl de loot + talents + sorts (secondaires inclus).
function cibleChar(b, stage, ilvl) {
  const c = makeCharacter('Cible', charLevel(stage), b.bias)
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl, rarity: 'legendaire', type: s.accepts, primary: b.primary, stars: 3, ...(s.accepts === 'armePrincipale' ? { element: b.elem } : {}) })
  c.equipment = eq
  c.talents = { co_start: 1 }
  for (const t of b.talents) c.talents[t] = 1
  c.powers = [...b.powers]
  c.hp = charMaxHp(c)
  return c
}
// Build NU : même ilvl, mais stat PRIMAIRE seule — affixes secondaires retirés, ni talents ni sorts.
// (Plancher de sanité : un build vide doit échouer de loin.)
function nuChar(b, stage, ilvl) {
  const c = makeCharacter('Nu', charLevel(stage), b.bias)
  const eq = {}
  for (const s of EQUIP_SLOTS) {
    const it = generateItem({ ilvl, rarity: 'mediocre', type: s.accepts, primary: b.primary, stars: 1, ...(s.accepts === 'armePrincipale' ? { element: b.elem } : {}) })
    it.affixes = it.affixes.filter((a) => a.kind === 'dmgType') // garde le +% d'arme, zéro secondaire
    eq[s.id] = it
  }
  c.equipment = eq
  c.talents = { co_start: 1 }
  c.powers = []
  c.hp = charMaxHp(c)
  return c
}
// Build SOUS : joueur SOUS-OPTIMISÉ — épique (pas légendaire) + MOITIÉ des talents/sorts + stack τ−0,25.
// C'est LE test discriminant : il DOIT échouer à la frontière → prouve que l'optimisation est requise.
function sousChar(b, stage, ilvl) {
  const c = makeCharacter('Sous', charLevel(stage), b.bias)
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl, rarity: 'epique', type: s.accepts, primary: b.primary, stars: 2, ...(s.accepts === 'armePrincipale' ? { element: b.elem } : {}) })
  c.equipment = eq
  c.talents = { co_start: 1 }
  for (const t of b.talents.slice(0, Math.ceil(b.talents.length / 2))) c.talents[t] = 1
  c.powers = b.powers.slice(0, Math.ceil(b.powers.length / 2))
  c.hp = charMaxHp(c)
  return c
}

// DoT keystone (auto-attaques qui posent un DoT — non inclus dans charDps).
function dotDps(c) {
  const cm = charCombatMods(c)
  if (!cm.dot) return 0
  const d = charDerived(c), prof = charDamageProfile(c), pm = M.profileDamageMult(prof)
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult
}
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
function dpsOf(maker, stage, ilvl) {
  return avg(Object.values(BUILDS).flatMap((b) => Array.from({ length: 4 }, () => { const c = maker(b, stage, ilvl); return charDps(c) + dotDps(c) })))
}
function ehpOf(maker, stage, ilvl) {
  return avg(Object.values(BUILDS).flatMap((b) => Array.from({ length: 6 }, () => charEhp(maker(b, stage, ilvl)))))
}

const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const ok = (b) => b ? '✅' : '❌'
const pad = (s, n) => String(s).padStart(n)
const NOVA_FULL = 3.6 // pic de nova PLEIN (raids.ts, endgame) — la sévérité du burst RAMPE avec le Palier :
// nulle avant P20 (survie = « ne pas mourir aux autos », défenses encore minces) → pleine à P40.
// Sinon la survie est infranchissable à P15-20 puis triviale (soft-caps défensifs s'allumant ~P25).
const novaReq = (p) => Math.max(0, NOVA_FULL * (p - 20) / 20)

console.log('================= HARNAIS MURS v0.35 (code réel + enveloppe τ) =================')
console.log(`LAG0=${P.LAG0} K_LAG=${P.K_LAG} · pente ${P.PENTE_VAGUE} ilvl/vague · TTK cible boss ${TARGET_BOSS_TTK}s · survie ${SURVIVE}s + nova rampe→×${NOVA_FULL}`)
console.log(`stack dmg×${STACK_DMG_FULL} surv×${STACK_SURV_FULL} (plein) · τ 40/65/90 % · checks 1→3`)
console.log(`Test discriminant : SOUS (sous-optimisé) doit ÉCHOUER, CIBLE doit PASSER. NU = plancher de sanité.\n`)
console.log('Pal | loot LAG  τ chk | TTK nu/sous/cible (enrage)   | EHP-survie sous/cible (besoin) | DPS  SUR')

let allOk = true
for (const p of PALIERS) {
  const stage = p * P.PALIER_SIZE
  const front = P.frontierIlvl(stage)
  const loot = P.lootFarmIlvl(stage)
  const lag = Math.round(P.lagAt(p))
  const t = tau(p), tSous = Math.max(0, t - 0.25), nc = nbChecks(p), marge = margeMur(p)

  const dpsNu = dpsOf(nuChar, stage, loot)
  const dpsSous = dpsOf(sousChar, stage, loot) * stackDmg(tSous)
  const dpsCible = dpsOf(cibleChar, stage, loot) * stackDmg(t)
  const murHp = P.enemyHp(front, 'boss')
  const enrage = TARGET_BOSS_TTK * marge
  const ttkNu = murHp / dpsNu, ttkSous = murHp / dpsSous, ttkCible = murHp / dpsCible

  const murDmg = P.enemyDmg(front, 'boss')
  const ehpNu = ehpOf(nuChar, stage, loot)
  const ehpCible = ehpOf(cibleChar, stage, loot) * stackSurv(t)
  const ehpNeed = murDmg * (SURVIVE + novaReq(p)) // encaisser SURVIVE s d'auto + un pic de nova (rampe)

  // DPS = gate DISCRIMINANT (le vrai mur) : CIBLE clear, SOUS échoue, NU échoue (plancher).
  const dpsCheck = ttkCible <= enrage && ttkSous > enrage && ttkNu > enrage
  // SURVIE = PLANCHER anti-one-shot : CIBLE encaisse auto+nova, un build NU se fait one-shot.
  // (Pas un gate discriminant : l'écart EHP optimisé/sous-optimisé est trop petit — c'est le DPS qui filtre.)
  const survCheck = nc < 2 ? true : (ehpCible >= ehpNeed && ehpNu < ehpNeed)
  const palierOk = dpsCheck && survCheck
  if (!palierOk) allOk = false

  console.log(
    `${pad(p, 3)} | ${pad(loot, 4)} ${pad(lag, 3)} ${pad(Math.round(t * 100), 2)}% ${pad(nc, 2)} | ` +
    `${pad(ttkNu.toFixed(0), 4)}/${pad(ttkSous.toFixed(0), 4)}/${pad(ttkCible.toFixed(0), 3)}s (${enrage.toFixed(0)}s)`.padEnd(28) + ` | ` +
    `${pad(fmt(ehpNu), 7)}/${pad(fmt(ehpCible), 7)} (${pad(fmt(ehpNeed), 7)})`.padEnd(30) + ` | ` +
    `${dpsCheck ? 'DPS✓' : 'DPS✗'}  ${nc >= 2 ? (survCheck ? 'SUR✓' : 'SUR✗') : ' — '}`
  )
}

console.log(`\nLecture : DPS✓ (gate) = CIBLE clear ≤ enrage ET SOUS dépasse l'enrage. SUR✓ (plancher) = CIBLE encaisse auto+nova, NU se fait one-shot.`)
console.log(`Le check SUSTAIN (P26+, DoT/drain vs régen/vol de vie) reste qualitatif en v1 — à étoffer quand le mur l'imposera (Lot 2).`)
console.log(`\n=== VERDICT : ${allOk ? '✅ Mur discriminant — l\'optimisation est REQUISE à tous les Paliers' : '❌ non discriminant à certains Paliers → recaler LAG / τ / margeMur / stack / dmg du mur'} ===`)
