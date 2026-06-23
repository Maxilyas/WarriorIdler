// Vérif de la refonte des stats sur la fiche du joueur (avant/après). node scripts/verif-stats-v038.mjs
import { build } from 'esbuild'
const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { computeDerived, describeStats, computeTotalStats } from './src/game/stats.ts'
  export { genericMitigation } from './src/game/combat.ts'
`)
const { computeDerived, genericMitigation, computeTotalStats } = M

// Fiche du joueur (build Force).
const total = {
  force: 7256, agilite: 15, intelligence: 860, endurance: 6492,
  critique: 1741, degatsCrit: 2692, hate: 1472, maitrise: 1330, penetration: 144, precision: 985,
  alteration: 1314, degatsBoss: 806, reductionDegats: 1449, esquive: 1074, barriere: 1931,
  tenacite: 480, purge: 168, regen: 1043, volDeVie: 301, surpuissance: 8, multifrappe: 174, recuperation: 0,
}
const d = computeDerived(total)
const pct = (x) => (x * 100).toFixed(1) + '%'

console.log('=== Stats dérivées (NOUVELLES formules) ===')
console.log('main stat       :', d.mainStat)
console.log('Critique        :', pct(d.critChance), '(av. 74,6%)')
console.log('Dégâts crit     : ×' + d.critMult.toFixed(2), '(av. ×3,07)')
console.log('Hâte            : +' + pct(d.attacksPerSecond - 1), '·', d.attacksPerSecond.toFixed(2), 'att/s (av. 1,59)')
console.log('Maîtrise (Force): DR', pct(d.masteryDr), '· Riposte', pct(d.riposteChance), '(contre-attaque)')
console.log('Pénétration     :', pct(d.penetration), '(av. 5,8%)')
console.log('Précision       :', pct(d.precision), '(av. 39,4%)')
console.log('Altération      : +' + pct(d.alterationMult - 1), '(av. +52,6%)')
console.log('Dégâts boss     : +' + pct(d.bossDamageMult - 1), '(av. +32,2%)')
console.log('Réduction       :', pct(d.flatDr), '(av. -55,8%) [Esquive repliée dedans]')
console.log('Résilience      :', pct(d.resilience), '(ex Tén 19,2% + Purge 6,7%)')
console.log('Barrière (EHP)  : +' + pct(d.shieldPct), '(inchangé)')
console.log('Vol de vie      :', pct(d.leech), '(av. 12,0%)')
console.log('damageTakenMult : ×' + d.damageTakenMult.toFixed(2), '(Surcharge, Int only)')

console.log('\n=== Survie (build Force) ===')
const mit = genericMitigation(d, 1)
console.log('Mitigation générique : take', pct(mit), '→ -' + pct(1 - mit), '(av. -80% capé)')
console.log('PV                   :', Math.round(d.hp).toLocaleString('fr-FR'))
console.log('EHP effectif         :', Math.round(d.hp / mit).toLocaleString('fr-FR'), '(av. ~690 000)')

console.log('\n=== Repli Régén → Intelligence (unique de soin ex-regen) ===')
const folded = computeTotalStats({ intelligence: 35, regen: 70 }, {})
console.log('base {int:35, regen:70} →', JSON.stringify({ intelligence: folded.intelligence, regen: folded.regen ?? 0 }), '(attendu int 105, regen 0)')
