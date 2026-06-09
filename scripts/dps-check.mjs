import { build } from 'esbuild'

const entry = `
export { charDps, makeCharacter } from './src/game/character.ts'
`
const res = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
})
const mod = await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
const { charDps, makeCharacter } = mod

const base = makeCharacter('A', 149, 'force')
base.powers = ['frappe_simple', null, null, null, null]
const withKeystone = { ...base, talents: { ...base.talents, fo_b5: 1 } } // fo_b5 = Carnage (damageMult 1.3)

const d1 = charDps(base)
const d2 = charDps(withKeystone)
console.log('charDps sans keystone :', Math.round(d1).toLocaleString('fr-FR'))
console.log('charDps avec Carnage (×1.3) :', Math.round(d2).toLocaleString('fr-FR'))
console.log('ratio (attendu ≈ 1.30) :', (d2 / d1).toFixed(3))
