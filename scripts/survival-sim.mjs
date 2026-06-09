// Harnais de survie : compare, par palier, le TEMPS-POUR-MOURIR (EHP / dégâts ennemis) au
// TEMPS-POUR-TUER (PV ennemi / DPS joueur). Si mourir << tuer, on se fait fondre avant de gagner.
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charMaxHp, charResist, charCombatMods, charPassives, charDps, setGlobalCombatMods } from './src/game/character.ts'
  export { makeEnemy } from './src/game/enemies.ts'
  export { incomingDps } from './src/game/combat.ts'
  export { RARITIES } from './src/game/rarities.ts'
  export { ITEM_TYPES, EQUIP_SLOTS } from './src/game/slots.ts'
`)
const { makeCharacter, charDerived, charMaxHp, charResist, charCombatMods, charPassives, charDps, setGlobalCombatMods, makeEnemy, incomingDps, RARITIES, ITEM_TYPES, EQUIP_SLOTS } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })

const statAffix = (stat, ilvl, statMult) => ({ kind: 'stat', stat, value: Math.max(1, Math.round(ilvl * 0.8 * statMult * 1.3)) })
const resistAffix = (type, tier) => ({ kind: 'resist', type, value: Math.min(30, Math.round(13 * (1 + tier * 0.06))) })

function makeItem(type, primary, ilvl, rarityId, mode) {
  const r = RARITIES[rarityId]
  const budget = ilvl * ITEM_TYPES[type].weight * r.statMult
  const offFrac = mode === 'tank' ? 0.3 : 0.82 // defensif vs offensif (ENDURANCE = 1.9 dans items.ts)
  const affixes = []
  const defPrio = ['reductionDegats', 'esquive', 'barriere', 'tenacite']
  for (let i = 0; i < r.affixCount; i++) {
    if (mode === 'tank') {
      if (i < 2) affixes.push(resistAffix('physique', r.tier)) // 2 lignes de résist physique (auto ennemi = physique)
      else affixes.push(statAffix(defPrio[(i - 2) % defPrio.length], ilvl, r.statMult))
    } else {
      affixes.push(statAffix(['maitrise', 'critique', 'degatsCrit', 'hate', 'penetration'][i % 5], ilvl, r.statMult))
    }
  }
  return {
    id: type, name: type, type, rarity: rarityId, ilvl, primary,
    primaryValue: Math.max(1, Math.round(budget * offFrac * 1.15)),
    endurance: Math.max(1, Math.round(budget * (1 - offFrac) * 1.9 * 1.15)),
    orientation: mode === 'tank' ? 'defensif' : 'offensif',
    affixes,
    ...(type === 'armePrincipale' ? { damageType: 'physique' } : {}),
  }
}
function makeChar(level, ilvl, rarityId, mode, talents) {
  const c = makeCharacter('Sim', level, 'force')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = makeItem(s.accepts, 'force', ilvl, rarityId, mode)
  c.equipment = eq
  c.talents = { co_start: 1 }
  for (const t of talents) c.talents[t] = 1
  c.powers = ['frappe_lourde', 'choc_sismique', 'laceration', 'decapitation', 'tourbillon']
  c.hp = charMaxHp(c)
  return c
}
const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+'Md' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'k' : Math.round(n).toString()

// Tank : keystones défensifs (Forteresse flatDr .15, Inébranlable flatDr .2) + résist talents (Égide).
const TANK_TAL = ['ba_a5', 'ba_a7', 'ba_b0', 'ba_b3']
const DPS_TAL = ['fo_b5', 'fo_c4', 'bo_b2']

function survivalSeconds(c, enemy) {
  const d = charDerived(c); const res = charResist(c); const pass = charPassives(c); const cm = charCombatMods(c)
  const extra = (1 - pass.damageReduction) * (1 - cm.flatDr)
  const dpsTaken = incomingDps(enemy.damage, enemy.damageType, d, res, extra)
  return { hp: charMaxHp(c), dpsTaken, ttd: charMaxHp(c) / dpsTaken }
}

const STAGES = [30, 50, 70, 100, 130]
console.log('=== Survie vs offense par palier (rareté transcendant, ilvl=1.5xpalier) ===')
console.log('TTD = temps pour mourir (tank) · TTK = temps pour tuer (build DPS) · ratio<1 = on meurt avant de tuer\n')
for (const stage of STAGES) {
  const ilvl = Math.round(stage * 1.5); const lvl = stage
  const tank = makeChar(lvl, ilvl, 'transcendant', 'tank', TANK_TAL)
  const dps = makeChar(lvl, ilvl, 'transcendant', 'dps', DPS_TAL)
  const enemyN = makeEnemy(stage, 'physique')
  const enemyB = makeEnemy(stage - (stage % 10) + 10, 'physique') // prochain boss
  const sN = survivalSeconds(tank, enemyN)
  const sB = survivalSeconds(tank, enemyB)
  const playerDps = charDps(dps)
  const ttkN = enemyN.maxHp / playerDps
  const ttkB = enemyB.maxHp / playerDps
  console.log(`Palier ${stage}: tank HP=${fmt(sN.hp)}  | NORMAL dmg=${fmt(enemyN.damage)}/s TTD=${sN.ttd.toFixed(1)}s TTK=${ttkN.toFixed(1)}s ratio=${(sN.ttd/ttkN).toFixed(2)}`)
  console.log(`            boss(${enemyB.name.slice(0,12)}) dmg=${fmt(enemyB.damage)}/s TTD=${sB.ttd.toFixed(1)}s TTK=${ttkB.toFixed(1)}s ratio=${(sB.ttd/ttkB).toFixed(2)}`)
}
