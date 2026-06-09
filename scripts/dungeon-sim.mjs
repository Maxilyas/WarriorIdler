// Harnais de progression DONJON : pour des builds FOR/AGI/INT stuffés selon le niveau de perso
// (10/25/50/75/100), trouve le NIVEAU DE DONJON max franchissable (survivre ET tuer le boss).
// Utilise le VRAI code (makeDungeonEnemy) → la courbe reflète l'équilibrage réel, sans dérive.
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charMaxHp, charResist, charCombatMods, charPassives, charDps, charDamageProfile, setGlobalCombatMods } from './src/game/character.ts'
  export { incomingDps, armorMitigation } from './src/game/combat.ts'
  export { RARITIES } from './src/game/rarities.ts'
  export { ITEM_TYPES, EQUIP_SLOTS } from './src/game/slots.ts'
  export { makeDungeonEnemy, dungeonFights, dungeonRegen, DUNGEONS } from './src/game/dungeons.ts'
`)
const { makeCharacter, charDerived, charMaxHp, charResist, charCombatMods, charPassives, charDps, charDamageProfile, setGlobalCombatMods, incomingDps, armorMitigation, RARITIES, ITEM_TYPES, EQUIP_SLOTS, makeDungeonEnemy, dungeonFights, dungeonRegen, DUNGEONS } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })

const REGEN_RATE = 0.05
const statAffix = (stat, ilvl, m) => ({ kind: 'stat', stat, value: Math.max(1, Math.round(ilvl * 0.8 * m * 1.3)) })
const dmgAffix = (type, tier) => ({ kind: 'dmgType', type, value: Math.round(25 * (1 + tier * 0.12)) })
const resAffix = (type, tier) => ({ kind: 'resist', type, value: Math.min(30, Math.round(13 * (1 + tier * 0.06))) })
function makeItem(type, primary, elem, ilvl, rarityId) {
  const r = RARITIES[rarityId]; const budget = ilvl * ITEM_TYPES[type].weight * r.statMult; const offFrac = 0.6
  const prio = ['maitrise', 'critique', 'degatsCrit', 'penetration', 'hate']; const affixes = []
  for (let i = 0; i < r.affixCount; i++) {
    if (i === 0) affixes.push(resAffix(elem, r.tier))
    else if (i - 1 < prio.length) affixes.push(statAffix(prio[i - 1], ilvl, r.statMult))
    else affixes.push(dmgAffix(elem, r.tier))
  }
  return { id: type, name: type, type, rarity: rarityId, ilvl, primary,
    primaryValue: Math.max(1, Math.round(budget * offFrac * 1.15)),
    endurance: Math.max(1, Math.round(budget * (1 - offFrac) * 1.9 * 1.15)),
    orientation: 'equilibre', affixes, ...(type === 'armePrincipale' ? { damageType: elem } : {}) }
}
const BUILDS = {
  FORCE: { primary: 'force', bias: 'force', elem: 'physique', talents: ['fo_b5','fo_c4','bo_b2','fo_b1'], powers: ['frappe_lourde','choc_sismique','laceration','decapitation','tourbillon'] },
  AGI:   { primary: 'agilite', bias: 'agilite', elem: 'physique', talents: ['ag_b5','du_b2','sp_b2','ag_b3'], powers: ['eviscaration','tir_precis','volee_de_fleches','poison','soif_du_neant'] },
  INT:   { primary: 'intelligence', bias: 'intelligence', elem: 'arcane', talents: ['in_a7','in_b5','el_a1','el_a3','in_a5'], powers: ['eclair','embrasement','trait_de_givre','salve_arcanique','deluge_stellaire'] },
}
function makeChar(b, level, ilvl, rarityId) {
  const c = makeCharacter('Sim', level, b.bias); const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = makeItem(s.accepts, b.primary, b.elem, ilvl, rarityId)
  c.equipment = eq; c.talents = { co_start: 1 }; for (const t of b.talents) c.talents[t] = 1
  c.powers = [...b.powers]; c.hp = charMaxHp(c); return c
}
const GEAR = { 10: ['rare', 18], 25: ['epique', 40], 50: ['mythique', 78], 75: ['cosmique', 118], 100: ['transcendant', 155] }

function effectiveDps(c, enemy) {
  const dps = charDps(c); const prof = charDamageProfile(c); const d = charDerived(c)
  const physFrac = prof.profile.physique ?? 0
  const resE = enemy.resist?.[c.equipment.armePrincipale?.damageType ?? 'physique'] ?? 0
  return dps * (1 - physFrac * armorMitigation(enemy.armor, d.power)) * (1 - Math.max(0, resE))
}
function ttd(c, enemy) {
  const d = charDerived(c); const res = charResist(c); const pass = charPassives(c); const cm = charCombatMods(c)
  const extra = (1 - pass.damageReduction) * (1 - cm.flatDr)
  const taken = incomingDps(enemy.damage, enemy.damageType, d, res, extra)
  const hp = charMaxHp(c); const net = taken - hp * REGEN_RATE
  return net <= 0 ? Infinity : hp / net
}
// Donjon franchissable si le BOSS (dernier combat) est tué avant la mort et en temps raisonnable.
function clears(c, def, D) {
  const fights = dungeonFights(D)
  const boss = makeDungeonEnemy(def, D, fights - 1, fights, [])
  const tk = boss.hp / effectiveDps(c, boss)
  return ttd(c, boss) >= tk && tk < 180
}
function maxClearable(b, charLevel, def) {
  const [rarity, ilvl] = GEAR[charLevel]; const c = makeChar(b, charLevel, ilvl, rarity)
  let last = 0; for (let D = 1; D <= 60; D++) { if (clears(c, def, D)) last = D; else break } return last
}

const TRIAL = [['or', 'rapide (gros dégâts)'], ['butin', 'elite (DPS soutenu)'], ['poussiere', 'colosse (gros PV)']]
for (const [dId, label] of TRIAL) {
  console.log(`\n===== Donjon « ${DUNGEONS[dId].name} » — ${label} : niveau MAX franchissable =====`)
  console.log('CharLvl |  FORCE  AGI   INT   [stuff]')
  for (const L of [10, 25, 50, 75, 100]) {
    const r = Object.keys(BUILDS).map((n) => String(maxClearable(BUILDS[n], L, DUNGEONS[dId])).padStart(4)).join(' ')
    console.log(`  ${String(L).padStart(4)}  | ${r}    [${GEAR[L][0]} ilvl${GEAR[L][1]}]`)
  }
}
