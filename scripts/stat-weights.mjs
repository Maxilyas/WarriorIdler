// Harnais d'ÉQUILIBRAGE DES POIDS DE STATS : valeur marginale (ΔDPS%) d'une ligne d'affixe de
// chaque famille, par build × niveau × rareté, + courbe d'EMPILEMENT des lignes « +% type ».
// Utilise le VRAI code du jeu (esbuild) — diagnostic : les dégâts de type dominent-ils ?
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { makeCharacter, charDps, charMaxHp, setGlobalCombatMods } from './src/game/character.ts'
  export { RARITIES } from './src/game/rarities.ts'
  export { ITEM_TYPES, EQUIP_SLOTS } from './src/game/slots.ts'
  export { DMG_LINE_BASE, DMG_LINE_RANGE, DMG_LINE_TIER_GROWTH } from './src/game/items.ts'
`)
const { makeCharacter, charDps, charMaxHp, setGlobalCombatMods, RARITIES, ITEM_TYPES, EQUIP_SLOTS } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })

// Lignes au roll MOYEN (1.0) — on mesure des espérances, pas des max rolls.
const statAffix = (stat, ilvl, statMult) => ({ kind: 'stat', stat, value: Math.max(1, Math.round(ilvl * 0.8 * statMult)) })
const dmgAffix = (type, tier) => ({ kind: 'dmgType', type, value: Math.round((M.DMG_LINE_BASE + M.DMG_LINE_RANGE / 2) * (1 + tier * M.DMG_LINE_TIER_GROWTH)) })

// Pièce équilibrée : primaire+endurance au roll moyen, affixes fournis par l'appelant.
function makeItem(type, primary, elem, ilvl, rarityId, affixes) {
  const r = RARITIES[rarityId]
  const w = ITEM_TYPES[type].weight
  const budget = ilvl * w * r.statMult
  const offFrac = 0.62 // équilibré
  return {
    id: type, name: type, type, rarity: rarityId, ilvl, primary,
    primaryValue: Math.max(1, Math.round(budget * offFrac)),
    endurance: Math.max(1, Math.round(budget * (1 - offFrac) * 1.9)),
    orientation: 'equilibre',
    affixes,
    ...(type === 'armePrincipale' ? { damageType: elem } : {}),
  }
}

// Rotation de lignes « génériques » pour remplir le stuff de base (mix offensif standard).
const GENERIC = ['critique', 'hate', 'maitrise', 'degatsCrit', 'penetration', 'precision']

/**
 * Équipe un perso avec un stuff de référence où `typeLines` pièces portent UNE ligne « +% elem »
 * à la place d'une ligne générique (le reste : rotation GENERIC). `extra` = ligne supplémentaire
 * injectée sur la 1re pièce (mesure marginale, à slots constants : elle REMPLACE une générique).
 */
function gear(primary, elem, ilvl, rarityId, { typeLines = 0, extra = null } = {}) {
  const r = RARITIES[rarityId]
  const tier = r.tier
  const eq = {}
  let g = 0
  let t = 0
  EQUIP_SLOTS.forEach((s, idx) => {
    const affixes = []
    for (let i = 0; i < r.affixCount; i++) {
      const slotGetsType = t < typeLines && i === 0 && idx < typeLines
      if (idx === 0 && i === 0 && extra) affixes.push(extra) // ligne mesurée (remplace)
      else if (slotGetsType) { affixes.push(dmgAffix(elem, tier)); t++ }
      else affixes.push(statAffix(GENERIC[g++ % GENERIC.length], ilvl, r.statMult))
    }
    eq[s.id] = makeItem(s.accepts, primary, elem, ilvl, rarityId, affixes)
  })
  return eq
}

function dpsOf(primary, bias, elem, level, ilvl, rarityId, opts) {
  const c = makeCharacter('Sim', level, bias)
  c.equipment = gear(primary, elem, ilvl, rarityId, opts)
  c.talents = { co_start: 1 }
  c.hp = charMaxHp(c)
  return charDps(c)
}

const BUILDS = [
  { name: 'FORCE', primary: 'force', bias: 'force', elem: 'physique' },
  { name: 'AGI', primary: 'agilite', bias: 'agilite', elem: 'physique' },
  { name: 'INT', primary: 'intelligence', bias: 'intelligence', elem: 'arcane' },
]
const CONFIGS = [
  { level: 40, rar: 'epique' },
  { level: 80, rar: 'mythique' },
  { level: 120, rar: 'eternel' },
  { level: 120, rar: 'transcendant' },
]
// Lignes candidates pour la valeur marginale (offensives + la ligne de type).
const CANDIDATES = ['critique', 'degatsCrit', 'hate', 'maitrise', 'penetration', 'alteration', 'degatsBoss', 'dmgType']

console.log('=== VALEUR MARGINALE d\'une ligne (ΔDPS% en remplaçant une ligne générique) ===')
for (const cfg of CONFIGS) {
  const ilvl = Math.round(cfg.level * 1.5)
  const tier = RARITIES[cfg.rar].tier
  console.log(`\n--- N${cfg.level} · ${cfg.rar} (ilvl ${ilvl}, tier ${tier}) ---`)
  for (const b of BUILDS) {
    const base = dpsOf(b.primary, b.bias, b.elem, cfg.level, ilvl, cfg.rar, {})
    const parts = []
    for (const cand of CANDIDATES) {
      const extra = cand === 'dmgType' ? dmgAffix(b.elem, tier) : statAffix(cand, ilvl, RARITIES[cfg.rar].statMult)
      const d = dpsOf(b.primary, b.bias, b.elem, cfg.level, ilvl, cfg.rar, { extra })
      parts.push(`${cand === 'dmgType' ? `+%${b.elem}` : cand}=${(((d - base) / base) * 100).toFixed(1)}%`)
    }
    console.log(`  ${b.name.padEnd(6)} ${parts.join('  ')}`)
  }
}

console.log('\n=== EMPILEMENT des lignes « +% type » (DPS relatif vs 0 ligne, à slots constants) ===')
for (const cfg of CONFIGS) {
  const ilvl = Math.round(cfg.level * 1.5)
  console.log(`\n--- N${cfg.level} · ${cfg.rar} ---`)
  for (const b of BUILDS) {
    const base = dpsOf(b.primary, b.bias, b.elem, cfg.level, ilvl, cfg.rar, { typeLines: 0 })
    const steps = [2, 4, 8, 12, 16].map((k) => {
      const d = dpsOf(b.primary, b.bias, b.elem, cfg.level, ilvl, cfg.rar, { typeLines: k })
      return `${k}L=×${(d / base).toFixed(2)}`
    })
    console.log(`  ${b.name.padEnd(6)} ${steps.join('  ')}`)
  }
}
