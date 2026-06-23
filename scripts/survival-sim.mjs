// Harnais de survie : compare, par vague, le TEMPS-POUR-MOURIR (EHP / dégâts ennemis) au
// TEMPS-POUR-TUER (PV ennemi / DPS joueur). Si mourir << tuer, on se fait fondre avant de gagner.
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDerived, charMaxHp, charResist, charCombatMods, charPassives, charDps, setGlobalCombatMods } from './src/game/character.ts'
  export { incomingDps } from './src/game/combat.ts'
  export { enemyHp, enemyDmg } from './src/game/progression.ts'
  export { generateItem } from './src/game/items.ts'
  export { EQUIP_SLOTS } from './src/game/slots.ts'
`)
const { makeCharacter, charDerived, charMaxHp, charResist, charCombatMods, charPassives, charDps, setGlobalCombatMods, incomingDps, enemyHp, enemyDmg, generateItem, EQUIP_SLOTS } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })

// gear RÉEL via generateItem (budget exponentiel, comme ttk-sim). Le makeItem hand-rollé
// d'avant (budget LINÉAIRE) sous-estimait massivement l'EHP au-delà de l'ilvl ~150. Tank = orientation
// défensive (≈70% Endurance), DPS = offensive.
function makeChar(level, ilvl, rarityId, mode, b) {
  const c = makeCharacter('Sim', level, 'force')
  const eq = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl, rarity: rarityId, type: s.accepts, primary: 'force', stars: 3, orientation: mode === 'tank' ? 'defensif' : 'offensif', ...(s.accepts === 'armePrincipale' ? { element: 'physique' } : {}) })
  c.equipment = eq
  c.talents = { co_start: 1 }
  for (const t of b.talents) c.talents[t] = 1
  c.support = [...(b.support ?? [])]
  c.passives = [...(b.passives ?? [])]
  c.powers = [...b.powers]
  c.hp = charMaxHp(c)
  return c
}
const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+'Md' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'k' : Math.round(n).toString()

// builds réels (Guerrier). TANK : keystones flatDr (Forteresse .12 + Résilience .10 +
// Vengeance .06 + capstone Indomptable .15) + 3 passifs défensifs. DPS : Sentence + capstone + 3
// passifs offensifs. Générateur en SOUTIEN (sinon finisseurs à combo 1).
const TANK = {
  talents: ['cat_plaque', 'cl_guerrier', 're_hub', 're_inebranlable', 'se_resilience', 'ju_vengeance', 'id_guerrier'],
  support: ['re_bouclier_coup'], powers: ['gu_frappe', 're_revanche', 'se_saignement', 'gu_condamnation'],
  passives: ['pas_vitalite', 'pas_carapace', 'pas_rempart'],
}
const DPS = {
  talents: ['cat_plaque', 'cl_guerrier', 'se_hub', 'se_brutal', 'se_mortel', 'se_rage', 'id_guerrier'],
  support: ['se_mutile'], powers: ['gu_frappe', 'se_sentence', 'se_saignement', 'se_decapite', 'se_tourmente'],
  passives: ['pas_cruaute', 'pas_perforation', 'pas_celerite'],
}

function survivalSeconds(c, dmg, dmgType) {
  const d = charDerived(c); const res = charResist(c); const pass = charPassives(c); const cm = charCombatMods(c)
  const extra = (1 - pass.damageReduction) * (1 - cm.flatDr)
  const dpsTaken = incomingDps(dmg, dmgType, d, res, extra)
  return { hp: charMaxHp(c), dpsTaken, ttd: charMaxHp(c) / dpsTaken }
}

// modèle de contenu COURANT (aligné sur ttk-sim) : ilvl de contenu (ci) + gear LÉGENDAIRE calé,
// PV/dégâts ennemis via progression.ts (modèle Chapitres).
const CIS = [50, 150, 300, 400, 500, 700]
console.log('=== Survie vs offense à stuff calé (légendaire, ilvl = contenu) ===')
console.log('TTD = temps pour mourir (tank, dégâts boss en auto) · TTK = temps pour tuer (build DPS) · ratio<1 = on meurt avant de tuer\n')
for (const ci of CIS) {
  const lvl = Math.max(1, Math.min(200, Math.round(ci / 4)))
  const tank = makeChar(lvl, ci, 'legendaire', 'tank', TANK)
  const dps = makeChar(lvl, ci, 'legendaire', 'dps', DPS)
  const bossDmg = enemyDmg(ci, 'boss'); const bossHp = enemyHp(ci, 'boss')
  const sB = survivalSeconds(tank, bossDmg, 'physique')
  const ttkB = bossHp / charDps(dps)
  const ratio = sB.ttd / ttkB
  console.log(`ci ${String(ci).padStart(3)}: tank EHP=${fmt(sB.hp).padStart(6)} vs boss ${fmt(bossDmg).padStart(6)}/s → TTD=${sB.ttd.toFixed(1).padStart(5)}s | dps TTK boss=${ttkB.toFixed(1).padStart(5)}s | ratio ${ratio.toFixed(2).padStart(5)} ${ratio >= 1 ? '✅' : '❌ meurt avant'}`)
}
