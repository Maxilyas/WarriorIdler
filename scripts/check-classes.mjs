// Vérif runtime ciblée des nouvelles classes (Mage / Chasseur) : alloue des talents,
// équipe des sorts, et contrôle que charCombatMods + abilityDps + les nouveaux keystones
// (igniteOnCrit / petDps / combo / tagBonus) produisent des nombres sains (pas de NaN, lignes attendues).
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const load = async (rel) => {
  const res = await build({
    entryPoints: [fileURLToPath(new URL(rel, import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const char = await load('../src/game/character.ts')
const { makeCharacter, charDps, dpsBreakdown, charCombatMods, computeUnlockedPowers } = char

function build1(name, bias, talents, powers) {
  const c = makeCharacter(name, 80, bias)
  c.talents = { co_start: 1, ...talents }
  c.unlockedPowers = computeUnlockedPowers(c.talents)
  c.powers = [...powers, null, null, null, null, null].slice(0, 5)
  return c
}

const cases = [
  ['Pyromancien (ignite)', 'intelligence',
    { cat_tissu: 1, cl_mage: 1, py_hub: 1, py_chaleur: 1, py_embrase: 1, py_fournaise: 1, py_braise: 1, py_pyromanie: 1, py_pyroblast: 1, py_combustion: 1 },
    ['py_boule', 'py_pyroblast', 'py_immolation'], '🔥 Embrasement'],
  ['Cryomancien (shatter)', 'intelligence',
    { cat_tissu: 1, cl_mage: 1, cr_hub: 1, cr_froidure: 1, cr_cone: 1, cr_fracas: 1, cr_glaciation: 1, cr_comete: 1, cr_givre: 1 },
    ['cr_eclat', 'cr_cone', 'cr_comete'], null],
  ['Arcaniste (charges)', 'intelligence',
    { cat_tissu: 1, cl_mage: 1, ar_hub: 1, ar_etude: 1, ar_flux: 1, ar_resonance: 1, ar_deflag: 1, ar_finamp: 1, ar_surcharge: 1, ar_cascade: 1 },
    ['ar_trait', 'ar_deflag', 'ar_orbe'], null],
  ['Meneur de meute (pet)', 'agilite',
    { cat_mailles: 1, cl_chasseur: 1, me_hub: 1, me_dressage: 1, me_familier: 1, me_meute: 1, me_alpha: 1, me_griffes: 1, me_nature: 1 },
    ['me_cmd', 'me_morsure'], '🐾 Familier'],
  ['Œil de faucon (concentration)', 'agilite',
    { cat_mailles: 1, cl_chasseur: 1, fa_hub: 1, fa_calme: 1, fa_respire: 1, fa_lynx: 1, fa_tir_vise: 1, fa_finamp: 1, fa_letalite: 1, fa_mise_a_mort: 1, fa_oeil: 1 },
    ['fa_visee', 'fa_tir_vise', 'fa_mortel'], null],
]

let bad = 0
for (const [name, bias, talents, powers, expectLine] of cases) {
  const c = build1(name, bias, talents, powers)
  const cm = charCombatMods(c)
  const total = charDps(c)
  const bd = dpsBreakdown(c)
  const nan = !Number.isFinite(total) || bd.spells.some((s) => !Number.isFinite(s.dps))
  const lines = bd.spells.map((s) => `${s.name}=${Math.round(s.dps).toLocaleString('fr-FR')}`).join('  ')
  const hasExpected = !expectLine || bd.spells.some((s) => s.name === expectLine && s.dps > 0)
  if (nan || !hasExpected || total <= 0) bad++
  console.log(`\n■ ${name}`)
  console.log(`  DPS total : ${Math.round(total).toLocaleString('fr-FR')}${nan ? '  ⚠ NaN!' : ''}`)
  console.log(`  igniteOnCrit=${cm.igniteOnCrit ? `frac ${cm.igniteOnCrit.frac.toFixed(2)}/${cm.igniteOnCrit.duration}s` : '—'}  petDps=${cm.petDps}  comboCap=+${cm.comboCap}  comboGen=+${cm.comboGen}  finisherMult=+${cm.finisherMult}  shatter=+${cm.shatter}  cdrOnCast=${cm.cdrOnCast}`)
  console.log(`  tagBonus=${JSON.stringify(cm.tagBonus)}`)
  console.log(`  sorts : ${lines}`)
  if (expectLine && !hasExpected) console.log(`  ✗ ligne attendue manquante : « ${expectLine} »`)
}
console.log(`\n${bad === 0 ? '✅ OK' : `❌ ${bad} cas en échec`}`)
process.exit(bad === 0 ? 0 : 1)
