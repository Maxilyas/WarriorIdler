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
const { getPower } = await load('../src/game/powers.ts')
const { makeCharacter, charDps, dpsBreakdown, charCombatMods, computeUnlockedPowers } = char

function build1(name, bias, talents, powers) {
  const c = makeCharacter(name, 80, bias)
  c.talents = { co_start: 1, ...talents }
  c.unlockedPowers = computeUnlockedPowers(c.talents)
  // v0.30 : les générateurs (builder) vont dans leur section dédiée, hors des 5 actifs.
  const act = [], gen = []
  for (const id of powers) (getPower(id)?.effect === 'builder' ? gen : act).push(id)
  c.powers = [...act, null, null, null, null, null].slice(0, 5)
  c.generators = [...gen, null, null, null].slice(0, 3)
  return c
}

const cases = [
  ['Pyromancien (Hot Streak)', 'intelligence',
    { cat_tissu: 1, cl_mage: 1, py_hub: 1, py_chaleur: 3, py_embrase: 1, py_fournaise: 1, py_hotstreak: 1, py_braise: 1, py_pyromanie: 1, py_pyroblast: 1, py_combustion: 1 },
    ['py_boule', 'py_pyroblast', 'py_immolation'], '🔥 Embrasement'],
  ['Cryomancien (shatter)', 'intelligence',
    { cat_tissu: 1, cl_mage: 1, cr_hub: 1, cr_froidure: 3, cr_cone: 1, cr_fracas: 1, cr_glaciation: 1, cr_comete: 1, cr_abime: 1, cr_givre: 1 },
    ['cr_eclat', 'cr_cone', 'cr_comete'], null],
  ['Arcaniste (Surcharge)', 'intelligence',
    { cat_tissu: 1, cl_mage: 1, ar_hub: 1, ar_etude: 3, ar_affinite: 1, ar_flux: 1, ar_resonance: 1, ar_overload: 1, ar_deflag: 1, ar_finamp: 1, ar_surcharge: 1, ar_cascade: 1 },
    ['ar_trait', 'ar_deflag', 'ar_orbe'], null],
  ['Meneur de meute (pet)', 'agilite',
    { cat_mailles: 1, cl_chasseur: 1, me_hub: 1, me_dressage: 1, me_familier: 1, me_meute: 1, me_alpha: 1, me_griffes: 1, me_nature: 1 },
    ['me_cmd', 'me_morsure'], '🐾 Familier'],
  ['Œil de faucon (concentration)', 'agilite',
    { cat_mailles: 1, cl_chasseur: 1, fa_hub: 1, fa_calme: 1, fa_respire: 1, fa_lynx: 1, fa_tir_vise: 1, fa_finamp: 1, fa_letalite: 1, fa_mise_a_mort: 1, fa_oeil: 1 },
    ['fa_visee', 'fa_tir_vise', 'fa_mortel'], null],
  ['Sentence (Rage DPS)', 'force',
    { cat_plaque: 1, cl_guerrier: 1, se_hub: 1, se_furie: 1, se_colere: 1, se_fin: 1, se_finamp: 1, se_mortel: 1, se_execute: 1, se_rage: 1 },
    ['se_mutile', 'se_sentence', 'se_saignement'], null],
  ['Rempart (TANK Rage→bouclier)', 'force',
    { cat_plaque: 1, cl_guerrier: 1, re_hub: 1, re_garde: 1, re_revanche: 1, re_bloc: 1, re_mur: 1, re_acier: 1, re_epines: 1, re_inebranlable: 1 },
    ['re_bouclier_coup', 're_revanche'], null],
  ['Lumière (HEAL atonement)', 'intelligence',
    { cat_tissu: 1, cl_pretre: 1, lu_hub: 1, lu_foi: 1, lu_hot: 1, lu_zele: 1, lu_chatiment: 1, lu_inquisition: 1, lu_ferveur: 1 },
    ['lu_soin', 'lu_renouveau', 'lu_benediction'], null],
  ['Vide (DoT ombre)', 'intelligence',
    { cat_tissu: 1, cl_pretre: 1, vi_hub: 1, vi_tenebres: 1, vi_dotamp: 1, vi_ombre: 1, vi_demence: 1, vi_forme: 1, vi_insanite: 1, vi_soif: 1, vi_drain: 1 },
    ['vi_mot_ombre', 'vi_douleur', 'vi_devorer'], null],
  // ---- v0.32 : 5 dernières classes ----
  ['Givre-mort (shatter mêlée)', 'force',
    { cat_plaque: 1, cl_dk: 1, gm_hub: 1, gm_obli: 1, gm_finamp: 1, gm_execute: 1, gm_buf1: 5, gm_fracas: 1, gm_glace: 1, gm_froid: 1 },
    ['gm_givre', 'gm_obliteration', 'gm_pilier'], null],
  ['Sang (TANK vampire)', 'force',
    { cat_plaque: 1, cl_dk: 1, sg_hub: 1, sg_os: 5, sg_marque: 1, sg_bouclier: 1, sg_builder: 1, sg_vampirisme: 1 },
    ['sg_drain', 'sg_marque'], null],
  ['Pestilence (multi-DoT)', 'intelligence',
    { cat_tissu: 1, cl_demoniste: 1, pe_hub: 1, pe_tox: 1, pe_dotamp: 1, pe_venmort: 1, pe_buf1: 5, pe_drain: 1, pe_chain: 1, pe_ombre: 1, pe_ombreamp: 1 },
    ['pe_fleau', 'pe_drain', 'pe_corruption'], null],
  ['Légion (démons)', 'intelligence',
    { cat_tissu: 1, cl_demoniste: 1, lg_hub: 1, lg_pacte: 1, lg_demon: 1, lg_buf1: 5, lg_legion: 1, lg_chaos: 1, lg_ombreamp: 1 },
    ['lg_nuee', 'lg_trait'], '🐾 Familier'],
  ['Élémentaire (foudre)', 'intelligence',
    { cat_mailles: 1, cl_chaman: 1, el_hub: 1, el_orage: 1, el_chain: 1, el_static: 1, el_buf1: 5, el_coulee: 1, el_maelstrom: 1, el_finamp: 1 },
    ['el_foudre', 'el_maelstrom', 'el_lave'], null],
  ['Vague (HEAL totems)', 'intelligence',
    { cat_mailles: 1, cl_chaman: 1, va_hub: 1, va_eau: 5, va_totemks: 1, va_buf: 5, va_chatiment: 1 },
    ['va_soin', 'va_chaine', 'va_totem'], null],
  ['Lunaire (astral)', 'intelligence',
    { cat_cuir: 1, cl_druide: 1, ln_hub: 1, ln_astre: 1, ln_dotamp: 1, ln_astral: 1, ln_finamp: 1, ln_buf1: 5, ln_plenitude: 1, ln_eclipse: 1 },
    ['ln_lune', 'ln_astral', 'ln_plenitude'], null],
  ['Ronce (TANK)', 'force',
    { cat_cuir: 1, cl_druide: 1, ro_hub: 1, ro_ecorce: 5, ro_epines: 1, ro_colosse: 1, ro_buf2: 5, ro_resist: 1 },
    ['ro_lacere', 'ro_ronces'], null],
  ['Floraison (HEAL HoT)', 'intelligence',
    { cat_cuir: 1, cl_druide: 1, fo_hub: 1, fo_seve: 5, fo_hot: 1, fo_buf: 5, fo_chatiment: 1 },
    ['fo_pousse', 'fo_floraison'], null],
  ['Croisé (sacré DPS)', 'force',
    { cat_plaque: 1, cl_paladin: 1, cs_hub: 1, cs_jugement: 1, cs_finamp: 1, cs_zele: 1, cs_buf1: 5, cs_croisade: 1, cs_arcaneamp: 1 },
    ['cs_marteau', 'cs_jugement'], null],
  ['Templier (TANK aura)', 'force',
    { cat_plaque: 1, cl_paladin: 1, tp_hub: 1, tp_aura: 5, tp_partage: 1, tp_epines: 1, tp_buf2: 5, tp_resist: 1 },
    ['tp_consecration'], null],
  ['Aube (HEAL en frappant)', 'force',
    { cat_plaque: 1, cl_paladin: 1, au_hub: 1, au_zele: 5, au_chatiment: 1, au_ferveur: 1, au_foi: 5 },
    ['au_verdict', 'au_lumiere'], null],
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
  console.log(`  shatter=+${cm.shatter}  petDps=${cm.petDps}  comboCap=+${cm.comboCap}  finisherShield=${cm.finisherShield}  thorns=${cm.thorns}  healToDmg=${cm.healToDamage}  damageToHeal=${cm.damageToHeal}  shareResist=${cm.shareResist}  dotLeech=${cm.dotLeech}  chainArc=${cm.chainArc ? `${cm.chainArc.frac}/${cm.chainArc.targets}` : '—'}  staticN=${cm.staticN ? `${cm.staticN.every}/×${cm.staticN.mult}` : '—'}  poison=${cm.poison.maxStacks}st`)
  console.log(`  tagBonus=${JSON.stringify(cm.tagBonus)}`)
  console.log(`  sorts : ${lines}`)
  if (expectLine && !hasExpected) console.log(`  ✗ ligne attendue manquante : « ${expectLine} »`)
}
console.log(`\n${bad === 0 ? '✅ OK' : `❌ ${bad} cas en échec`}`)
process.exit(bad === 0 ? 0 : 1)
