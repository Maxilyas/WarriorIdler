// Harnais de simulation d'équilibrage : DPS/EHP de builds FOR/AGI/INT avec stuff optimisé,
// par rareté et niveau. Utilise le VRAI code du jeu (transpilé via esbuild) — pas de copie de règles.
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charCombatMods, charResist, setGlobalCombatMods } from './src/game/character.ts'
  export { RARITIES } from './src/game/rarities.ts'
  export { ITEM_TYPES, EQUIP_SLOTS } from './src/game/slots.ts'
  export { profileDamageMult } from './src/game/damage.ts'
  export { DMG_LINE_BASE, DMG_LINE_RANGE, DMG_LINE_TIER_GROWTH, SECONDARY_FRAC, SECONDARY_SOFT, SECONDARY_HARD } from './src/game/items.ts'
  export { softCap } from './src/game/stats.ts'
  export { itemBudget, effItemIlvl } from './src/game/progression.ts'
`)
const { makeCharacter, charDerived, charDamageProfile, charDps, charMaxHp, charCombatMods, charResist, setGlobalCombatMods, RARITIES, ITEM_TYPES, EQUIP_SLOTS, itemBudget, effItemIlvl } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 }) // pas d'upgrades marchand (comparaison pure)

// Affixe stat à la valeur MAX (gear optimisé) : v0.30.1 — secondaire PROPORTIONNEL au budget
// (poids SECONDARY_FRAC), même formule que rollLineValue (max roll 1.3).
const statAffix = (stat, ilvl, tier, rare = false) => ({ kind: 'stat', stat, value: Math.max(1, Math.round(M.softCap(itemBudget(ilvl, tier, M.SECONDARY_FRAC, 1), M.SECONDARY_SOFT, M.SECONDARY_HARD) * (rare ? 0.5 : 1) * 1.3)) })
// Ligne de type au roll max — mêmes constantes que rollLineValue (plus de copie qui dérive).
const dmgAffix = (type, tier) => ({ kind: 'dmgType', type, value: Math.round((M.DMG_LINE_BASE + M.DMG_LINE_RANGE) * (1 + tier * M.DMG_LINE_TIER_GROWTH)) })

// Affixes offensifs prioritaires (mêmes pour tous → comparaison contrôlée), + dmgType de l'arme.
function affixesFor(elem, ilvl, tier, count) {
  const prio = ['maitrise', 'critique', 'degatsCrit', 'hate', 'penetration']
  const out = []
  for (let i = 0; i < count; i++) {
    if (i < prio.length) out.push(statAffix(prio[i], ilvl, tier))
    else out.push(dmgAffix(elem, tier)) // les slots restants en +% du type de l'arme
  }
  return out
}

// Construit une pièce optimisée (offensif partout pour le DPS max). v0.30 : budget EXPONENTIEL.
function makeItem(type, primary, elem, ilvl, rarityId) {
  const r = RARITIES[rarityId]
  const w = ITEM_TYPES[type].weight
  const budget = itemBudget(ilvl, r.tier, w, 1)
  const offFrac = 0.82 // offensif
  const isWeapon = type === 'armePrincipale'
  return {
    id: type, name: type, type, rarity: rarityId, ilvl, primary,
    primaryValue: Math.max(1, Math.round(budget * offFrac * 1.15)),
    endurance: Math.max(1, Math.round(budget * (1 - offFrac) * 1.9 * 1.15)),
    orientation: 'offensif',
    affixes: affixesFor(elem, ilvl, r.tier, r.affixCount),
    ...(isWeapon ? { damageType: elem } : {}),
  }
}

function fullEquipment(primary, elem, ilvl, rarityId) {
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = makeItem(s.accepts, primary, elem, ilvl, rarityId)
  return eq
}

// Builds : primaire, élément d'arme, keystones optimaux (ids de nœuds), sorts équipés.
const BUILDS = {
  FORCE: {
    primary: 'force', bias: 'force', elem: 'physique',
    // Carnage(1.3)+Titan(1.15)+Juge suprême(1.25) = x1.87 + Hémorragie(dot) + Tempête de lames(multi)
    talents: ['fo_b5', 'fo_c4', 'bo_b2', 'fo_b1', 'du_a3'],
    powers: ['frappe_lourde', 'choc_sismique', 'laceration', 'decapitation', 'tourbillon'],
  },
  AGI: {
    primary: 'agilite', bias: 'agilite', elem: 'physique',
    // Danse(1.25)+Sabreur(1.25,multi.15)+Lame d'outre-tombe(1.2) = x1.875 + Toxines(dot) + Tempête(multi)
    talents: ['ag_b5', 'du_b2', 'sp_b2', 'ag_b3', 'du_a3'],
    powers: ['eviscaration', 'tir_precis', 'volee_de_fleches', 'poison', 'soif_du_neant'],
  },
  INT: {
    primary: 'intelligence', bias: 'intelligence', elem: 'arcane',
    // Archimage(1.25)+Surcharge(1.3)+Trinité(1.35)+Cataclysme(1.4) = x3.19 + Combustion(dot)
    talents: ['in_a7', 'in_b5', 'el_a1', 'el_a3', 'in_a5'],
    powers: ['eclair', 'embrasement', 'trait_de_givre', 'salve_arcanique', 'deluge_stellaire'],
  },
}

function makeBuildChar(b, level, ilvl, rarityId) {
  const c = makeCharacter('Sim', level, b.bias)
  c.equipment = fullEquipment(b.primary, b.elem, ilvl, rarityId)
  c.talents = { co_start: 1 }
  for (const t of b.talents) c.talents[t] = 1
  c.powers = [...b.powers]
  c.hp = charMaxHp(c)
  return c
}

// DPS du DoT keystone (les coups appliquent un DoT) — non inclus dans charDps : on l'ajoute.
function dotKeystoneDps(c) {
  const cm = charCombatMods(c)
  if (!cm.dot) return 0
  const d = charDerived(c)
  const prof = charDamageProfile(c)
  const pm = M.profileDamageMult(prof)
  // dégâts d'UN coup (sans aps ni multifrappe) ~ theoreticalDps / (aps * (1+multi))
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult // dps soutenu (1 stack, rafraîchi)
}

// EHP : PV / atténuation effective (générique capée 0.8 + résistance moyenne aux 7 types).
function ehp(c) {
  const d = charDerived(c)
  const res = charResist(c)
  const types = ['physique','feu','froid','foudre','arcane','ombre','nature']
  const avgRes = types.reduce((a, t) => a + (res[t] ?? 0), 0) / types.length
  const generic = Math.max(0.2, (1 - d.dodge) * (1 - d.flatDr) * (1 - d.masteryDr))
  const hp = charMaxHp(c)
  return { hp, ehp: hp / (generic * (1 - avgRes)) }
}

const fmt = (n) => {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'Md'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return Math.round(n).toString()
}

const RARS = ['epique', 'cosmique', 'transcendant']
const LEVELS = [50, 100]
const ilvlFor = (lvl) => Math.round(lvl * 1.5) // stageIlvl ~ stage*1.5, stage≈level

console.log('=== DPS / EHP par build, rareté, niveau (stuff optimisé) ===\n')
const rows = []
for (const lvl of LEVELS) {
  for (const rar of RARS) {
    const ilvl = ilvlFor(lvl)
    const res = {}
    for (const [name, b] of Object.entries(BUILDS)) {
      const c = makeBuildChar(b, lvl, ilvl, rar)
      const baseDps = charDps(c)        // auto (incl. damageMult keystones) + sorts
      const dot = dotKeystoneDps(c)     // DoT keystone des auto-attaques
      const total = baseDps + dot
      const e = ehp(c)
      res[name] = { total, baseDps, dot, hp: e.hp, ehp: e.ehp }
    }
    const best = Math.max(...Object.values(res).map((r) => r.total))
    console.log(`--- Niveau ${lvl} · ${rar} (ilvl ${ilvl}) ---`)
    for (const name of Object.keys(BUILDS)) {
      const r = res[name]
      const pctVsBest = ((r.total / best) * 100).toFixed(0)
      console.log(`  ${name.padEnd(6)} DPS total=${fmt(r.total).padStart(8)} (${pctVsBest}% du max)  [auto+sorts=${fmt(r.baseDps)} · DoT=${fmt(r.dot)}]   HP=${fmt(r.hp)}  EHP=${fmt(r.ehp)}`)
      rows.push({ lvl, rar, name, ...r })
    }
    console.log('')
  }
}

// Écart max entre builds (ratio meilleur/pire) par config — pour repérer les déséquilibres.
console.log('=== Déséquilibre (ratio DPS meilleur/pire build) par config ===')
for (const lvl of LEVELS) for (const rar of RARS) {
  const set = rows.filter((r) => r.lvl === lvl && r.rar === rar)
  const mx = Math.max(...set.map((r) => r.total)), mn = Math.min(...set.map((r) => r.total))
  const top = set.find((r) => r.total === mx).name, bot = set.find((r) => r.total === mn).name
  console.log(`  L${lvl} ${rar.padEnd(12)} ratio=${(mx / mn).toFixed(2)}x  (top=${top}, bottom=${bot})`)
}
