// Harnais de couverture des EFFETS UNIQUES et des SETS — valeur marginale (ΔDPS% / ΔEHP%) de chaque
// effet posé sur une pièce de référence, scaling rang/rareté, intégrité du catalogue, et bonus de set
// par seuil (2/4/6). Utilise le VRAI code du jeu (transpilé via esbuild) — pas de copie de règles.
//
// Un item porte un unique via `item.unique = { id, rank }` : ses mods sont injectés par le moteur
// (stats.ts → totaux, damage.ts → résist, character.ts → tagBonus), donc charDps/charMaxHp/charResist
// reflètent l'effet de bout en bout. On mesure le delta vs un build de référence identique sans l'effet.
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charDps, charMaxHp, charEhp, charCombatMods, charResist, setGlobalCombatMods } from './src/game/character.ts'
  export { RARITIES } from './src/game/rarities.ts'
  export { ITEM_TYPES, EQUIP_SLOTS } from './src/game/slots.ts'
  export { DMG_LINE_BASE, DMG_LINE_RANGE, DMG_LINE_TIER_GROWTH, SECONDARY_FRAC, SECONDARY_SOFT, SECONDARY_HARD } from './src/game/items.ts'
  export { softCap, PRIMARY_STATS, SECONDARY_STATS } from './src/game/stats.ts'
  export { itemBudget } from './src/game/progression.ts'
  export { DAMAGE_TYPE_LIST } from './src/game/damage.ts'
  export { UNIQUE_EFFECTS, PLAIN_UNIQUES, TAGGED_UNIQUES, instanceMods, uniqueModsAtRank, UNIQUE_MAX_RANK, UNIQUE_ACTIVE_RANK, getUnique } from './src/game/uniques.ts'
  export { SETS, SET_LIST, setBonuses } from './src/game/sets.ts'
`)
const {
  makeCharacter, charDerived, charDps, charMaxHp, charEhp, charResist, setGlobalCombatMods,
  RARITIES, ITEM_TYPES, EQUIP_SLOTS, itemBudget, softCap, PRIMARY_STATS, SECONDARY_STATS, DAMAGE_TYPE_LIST,
  SECONDARY_FRAC, SECONDARY_SOFT, SECONDARY_HARD, DMG_LINE_BASE, DMG_LINE_RANGE, DMG_LINE_TIER_GROWTH,
  UNIQUE_EFFECTS, PLAIN_UNIQUES, TAGGED_UNIQUES, instanceMods, uniqueModsAtRank, UNIQUE_MAX_RANK, UNIQUE_ACTIVE_RANK, getUnique,
  SETS, SET_LIST, setBonuses,
} = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 }) // pas d'upgrades marchand (comparaison pure)

let errors = 0
const fail = (msg) => { errors++; console.log('  ✗ ' + msg) }
let warns = 0
const warn = (msg) => { warns++; console.log('  ⚠ ' + msg) }

/* ---------- construction d'items (mêmes formules que build-sim / rollLineValue) ---------- */
const statAffix = (stat, ilvl, tier) => ({ kind: 'stat', stat, value: Math.max(1, Math.round(softCap(itemBudget(ilvl, tier, SECONDARY_FRAC, 1), SECONDARY_SOFT, SECONDARY_HARD) * 1.3)) })
const dmgAffix = (type, tier) => ({ kind: 'dmgType', type, value: Math.round((DMG_LINE_BASE + DMG_LINE_RANGE) * (1 + tier * DMG_LINE_TIER_GROWTH)) })
function affixesFor(elem, ilvl, tier, count) {
  const prio = ['maitrise', 'critique', 'degatsCrit', 'hate', 'penetration']
  const out = []
  for (let i = 0; i < count; i++) out.push(i < prio.length ? statAffix(prio[i], ilvl, tier) : dmgAffix(elem, tier))
  return out
}
function makeItem(type, primary, elem, ilvl, rarityId) {
  const r = RARITIES[rarityId]
  const w = ITEM_TYPES[type].weight
  const budget = itemBudget(ilvl, r.tier, w, 1)
  const isWeapon = type === 'armePrincipale'
  return {
    id: type, name: type, type, rarity: rarityId, ilvl, primary,
    primaryValue: Math.max(1, Math.round(budget * 0.82 * 1.15)),
    endurance: Math.max(1, Math.round(budget * 0.18 * 1.9 * 1.15)),
    orientation: 'offensif',
    affixes: affixesFor(elem, ilvl, r.tier, r.affixCount),
    ...(isWeapon ? { damageType: elem } : {}),
  }
}
function fullEquipment(ilvl, rarityId) {
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = makeItem(s.accepts, 'force', 'physique', ilvl, rarityId)
  return eq
}

// Build de référence : FORCE, keystones damageMult PURS (Carnage+Titan, reflétés par charDps,
// AUCUN DoT non compté), pour que charDps soit la DPS totale et que la valeur d'une stat soit lisible.
const LEVEL = 100, ILVL = 150, RARITY = 'transcendant'
const TEST_RANK = 5 // rang « milieu » (l'actif se débloque au rang 5) ; le scaling de rang est UNIFORME
function makeRefChar() {
  const c = makeCharacter('Sim', LEVEL, 'force')
  c.equipment = fullEquipment(ILVL, RARITY)
  c.talents = { co_start: 1, fo_b5: 1, fo_c4: 1 }
  c.powers = ['frappe_lourde', 'choc_sismique', 'decapitation', 'tourbillon']
  // NE PAS appeler charMaxHp ici : cela figerait le cache de stats dérivées (clé = réf d'équipement)
  // AVANT toute mutation (unique/affixe/setId). Le 1er calcul dérivé doit se faire APRÈS la mutation.
  return c
}
// Slot porteur de l'unique : une pièce NON-arme (garde le damageType de l'arme intact).
const CARRIER = (EQUIP_SLOTS.find((s) => s.accepts !== 'armePrincipale') ?? EQUIP_SLOTS[0]).id

function measure(mutate) {
  const c = makeRefChar()
  if (mutate) mutate(c)
  c.hp = charMaxHp(c)
  return { dps: charDps(c), ehp: charEhp(c), hp: charMaxHp(c) }
}
const BASE = measure(null)
const dDps = (m) => ((m.dps - BASE.dps) / BASE.dps) * 100
const dEhp = (m) => ((m.ehp - BASE.ehp) / BASE.ehp) * 100
const dHp = (m) => ((m.hp - BASE.hp) / BASE.hp) * 100
const withUnique = (id, rank = TEST_RANK) => measure((c) => { c.equipment[CARRIER].unique = { id, rank } })

const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

/* ====================================================================== */
/* 1) INTÉGRITÉ DU CATALOGUE                                              */
/* ====================================================================== */
console.log('=== 1) Intégrité du catalogue d\'uniques ===')
const validType = new Set(DAMAGE_TYPE_LIST)
const seen = new Set()
for (const u of UNIQUE_EFFECTS) {
  if (seen.has(u.id)) fail(`id dupliqué : ${u.id}`)
  seen.add(u.id)
  for (const t in (u.resistMods ?? {})) if (!validType.has(t)) fail(`${u.id} : type de résist inconnu → « ${t} »`)
  for (const tm of (u.tagMods ?? [])) if (!(tm.mult > 0)) fail(`${u.id} : tagMod « ${tm.tag} » de mult invalide (${tm.mult})`)
  // NaN/croissance : mods rang 1 vs rang max, doivent être finis et croître.
  const r1 = uniqueModsAtRank(u.id, 1), rN = uniqueModsAtRank(u.id, UNIQUE_MAX_RANK)
  for (const k in r1) {
    if (!Number.isFinite(r1[k]) || !Number.isFinite(rN[k])) fail(`${u.id}/${k} : valeur non finie (NaN)`)
    else if (rN[k] < r1[k]) fail(`${u.id}/${k} : ne croît pas avec le rang (${r1[k]} → ${rN[k]})`)
  }
}
const roles = {}
for (const u of UNIQUE_EFFECTS) roles[u.role] = (roles[u.role] ?? 0) + 1
console.log(`  ${UNIQUE_EFFECTS.length} effets · ${PLAIN_UNIQUES.length} simples + ${TAGGED_UNIQUES.length} taggés · par rôle : ${Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(', ')}`)

// Sonde de LIVENESS empirique : pour chaque stat utilisée par un unique, injecte une grosse quantité
// et vérifie qu'elle bouge AU MOINS un des axes joueur (DPS / PVmax / EHP). Une stat « morte » (retirée
// du moteur mais encore référencée par des uniques — ex. esquive/regen) rend ces uniques silencieux.
const activePool = new Set([...PRIMARY_STATS, ...SECONDARY_STATS])
const usedStats = new Set()
const usersOf = {}
for (const u of UNIQUE_EFFECTS) for (const k in (u.mods ?? {})) { usedStats.add(k); (usersOf[k] ??= []).push(u.id) }
function statMoves(stat) {
  const c = makeRefChar()
  const it = c.equipment[CARRIER]
  c.equipment[CARRIER] = { ...it, affixes: [...it.affixes, { kind: 'stat', stat, value: 100000 }] }
  c.hp = charMaxHp(c)
  return Math.abs(charDps(c) - BASE.dps) + Math.abs(charMaxHp(c) - BASE.hp) + Math.abs(charEhp(c) - BASE.ehp)
}
const inertStats = [...usedStats].filter((s) => statMoves(s) < 1e-6)
const retired = [...usedStats].filter((s) => !activePool.has(s))
console.log(`  Stats utilisées par des uniques : ${usedStats.size} · hors pool de roll actif (legacy mais vivantes si absentes des alertes) : ${retired.length ? retired.join(', ') : 'aucune'}`)
// « Inerte » = invisible sur un mannequin SANS CIBLE : pénétration (pas d'armure ennemie), altération
// (pas de DoT sur ce build), degatsBoss (pas de boss), précision (pas de miss), vol de vie/résilience
// (sustain hors EHP-burst). À distinguer d'un mod réellement mort — d'où l'avertissement (non bloquant).
for (const s of inertStats) warn(`stat « ${s} » : aucun effet sur le mannequin sans cible — ${usersOf[s].length} uniques concernés (ex. ${usersOf[s].slice(0, 3).join(', ')}). Vérifier que ce n'est pas un mod mort.`)
console.log(`  rang max ${UNIQUE_MAX_RANK} · actif au rang ${UNIQUE_ACTIVE_RANK} · ${errors} erreur(s) d'intégrité.\n`)

/* ====================================================================== */
/* 2) VALEUR MARGINALE des uniques SIMPLES (stats/résist) — ΔDPS% / ΔEHP% */
/* ====================================================================== */
console.log(`=== 2) Valeur marginale — uniques SIMPLES (build FOR, ${RARITY} iLvl ${ILVL}, rang ${TEST_RANK}) ===`)
console.log(`  Référence : DPS ${fmt(BASE.dps)} · EHP ${fmt(BASE.ehp)} · porteur = slot « ${CARRIER} »`)
const plainRows = PLAIN_UNIQUES.map((u) => { const m = withUnique(u.id); return { u, ddps: dDps(m), dehp: dEhp(m) } })
// Tri par meilleur axe (max DPS ou EHP) pour exposer la dispersion.
plainRows.sort((a, b) => Math.max(b.ddps, b.dehp) - Math.max(a.ddps, a.dehp))
const show = (row) => console.log(`  ${row.u.id.padEnd(26)} ${row.u.role.padEnd(8)} ΔDPS ${fmtPct(row.ddps).padStart(7)}  ΔEHP ${fmtPct(row.dehp).padStart(7)}`)
console.log('  — Top 8 (offensif/défensif) —'); plainRows.slice(0, 8).forEach(show)
console.log('  — Bottom 8 —'); plainRows.slice(-8).forEach(show)
const sp = plainRows.map((r) => Math.max(r.ddps, r.dehp)).filter((v) => v > 0.1).sort((a, b) => a - b)
const med = sp[Math.floor(sp.length / 2)]
console.log(`  Dispersion (meilleur axe, ${sp.length}/${plainRows.length} uniques à effet mesurable) : min ${fmtPct(sp[0])} · méd ${fmtPct(med)} · max ${fmtPct(sp[sp.length - 1])} · ratio ${(sp[sp.length - 1] / sp[0]).toFixed(1)}x\n`)

/* ====================================================================== */
/* 3) UNIQUES TAGGÉS — la valeur de tag dépend du build (sorts du bon tag) */
/* ====================================================================== */
console.log('=== 3) Uniques TAGGÉS (build-defining) — part stats mesurée + bonus de tag annoncé ===')
console.log('  (Le bonus de tag ne s\'applique qu\'à un build portant des sorts du tag — ici on mesure la part STATS.)')
for (const u of TAGGED_UNIQUES) {
  const m = withUnique(u.id)
  const tags = (u.tagMods ?? []).map((t) => `${t.tag} +${Math.round(t.mult * (1 + (TEST_RANK - 1) * 0.35) * 100)}%`).join(', ')
  console.log(`  ${u.id.padEnd(26)} ΔDPS(stats) ${fmtPct(dDps(m)).padStart(7)}   tag: ${tags}`)
}
console.log('')

/* ====================================================================== */
/* 4) SCALING rang × rareté (un échantillon par rôle)                     */
/* ====================================================================== */
console.log('=== 4) Scaling rang × rareté (ΔDPS%|ΔEHP% du meilleur axe) ===')
const SAMPLES = ['precision_mortelle', 'colosse', 'coeur_de_braise', 'esprit_vif']
for (const id of SAMPLES) {
  const u = getUnique(id); if (!u) continue
  const at = (rank, rar) => { const m = measure((c) => { c.equipment[CARRIER].rarity = rar; c.equipment[CARRIER].unique = { id, rank } }); return Math.max(dDps(m), dEhp(m)) }
  console.log(`  ${id.padEnd(20)} (${u.role})  r1 épique ${fmtPct(at(1, 'epique')).padStart(7)} · r5 ${RARITY} ${fmtPct(at(5, RARITY)).padStart(7)} · r10 ${RARITY} ${fmtPct(at(10, RARITY)).padStart(7)}`)
}
console.log('')

/* ====================================================================== */
/* 5) SETS — bonus par seuil 2/4/6 : ΔDPS% / ΔHP% / ΔEHP%                 */
/* ====================================================================== */
console.log('=== 5) Sets — valeur par seuil de pièces ===')
const equipSet = (setId, nPieces) => (c) => { let k = 0; for (const s of EQUIP_SLOTS) { if (k >= nPieces) break; c.equipment[s.id].setId = setId; k++ } }
for (const set of SET_LIST) {
  const nPieces = Object.keys(set.pieces).length
  console.log(`  ◆ ${set.name} (${set.id}) — ${nPieces} pièces définies, ${set.bonuses.length} paliers`)
  if (set.bonuses.some((b) => b.pieces > nPieces)) fail(`${set.id} : un palier exige plus de pièces (${Math.max(...set.bonuses.map((b) => b.pieces))}) que le set n'en définit (${nPieces})`)
  for (const b of set.bonuses) {
    if (!(b.damageMult || b.hpMult || b.cdr || b.resistAll || b.leech)) { fail(`${set.id}/${b.pieces}p : palier sans aucun effet moteur (bonus mort)`); continue }
    const m = measure(equipSet(set.id, b.pieces))
    console.log(`    ${b.pieces}p : ΔDPS ${fmtPct(dDps(m)).padStart(7)} · ΔHP ${fmtPct(dHp(m)).padStart(7)} · ΔEHP ${fmtPct(dEhp(m)).padStart(7)}   « ${b.desc} »`)
  }
}
console.log('')

/* ---------- bilan ---------- */
console.log(`=== Bilan : ${errors} erreur(s) d'intégrité · ${warns} avertissement(s). ===`)
if (errors > 0) process.exit(1)
console.log('✓ Catalogue d\'uniques & sets cohérent (intégrité OK ; les tables ci-dessus pilotent l\'équilibrage).')
