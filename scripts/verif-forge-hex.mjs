// Vérif de la Forge hexagonale (DESIGN v0.41, Lot 0) — branchée sur le VRAI code de metiers.ts.
// Prouve : voisinage axial, Chaînes (run connecté de même famille), Creuset (entrées possédées),
// et la règle de FORGEABILITÉ par adjacence (voisin d'une tuile possédée ou du Creuset (0,0)).
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { emptyMetiers, hexNeighbors, forgeChains, forgeChainBonus, forgeCreuset, forgeForgeable, judgeFrappe, craftMods, foyerRate } from './src/game/metiers.ts'
`)
const { emptyMetiers, hexNeighbors, forgeChains, forgeChainBonus, forgeCreuset, forgeForgeable, judgeFrappe, craftMods, foyerRate } = M

let fails = 0
const check = (label, cond, got) => {
  console.log(`${cond ? '✅' : '❌'} ${label}${cond ? '' : `  (obtenu : ${JSON.stringify(got)})`}`)
  if (!cond) fails++
}
const withNodes = (nodes) => { const m = emptyMetiers(); m.forgeron.nodes = nodes; return m }

// 1) Voisinage axial du cœur — doit inclure les 3 entrées (0,-1)/(1,0)/(-1,1).
const nb = hexNeighbors(0, 0).map((p) => `${p.q},${p.r}`)
check('cœur a 6 voisins', nb.length === 6, nb)
check('voisins du cœur incluent les 3 entrées', ['0,-1', '1,0', '-1,1'].every((k) => nb.includes(k)), nb)

// 2) Chaîne « qualité » — bras Armurier complet (6 tuiles connectées) → bonus plein 0,42.
const fullArm = withNodes({ surillvl: 1, polissage: 1, maitreForgeron: 1, signature: 1, frappe: 1, ascension: 1 })
const chains = forgeChains(fullArm)
check('bras Armurier = 1 seule Chaîne qualité de taille 6', chains.length === 1 && chains[0].family === 'qualite' && chains[0].size === 6, chains)
check('Chaîne ×6 → bonus qualité 0,42', forgeChainBonus(fullArm).qualite === 0.42, forgeChainBonus(fullArm))

// 3) Chaîne courte — 2 tuiles = sous le seuil (×3) → bonus 0 ; 3 tuiles → 0,12.
check('Chaîne ×2 → 0', forgeChainBonus(withNodes({ surillvl: 1, polissage: 1 })).qualite === 0, null)
check('Chaîne ×3 → 0,12', forgeChainBonus(withNodes({ surillvl: 1, polissage: 1, maitreForgeron: 1 })).qualite === 0.12, null)

// 4) Familles distinctes ne fusionnent pas (qualité vs ressource).
const mixed = forgeChains(withNodes({ surillvl: 1, econome: 1 }))
check('familles distinctes = 2 Chaînes de taille 1', mixed.length === 2 && mixed.every((c) => c.size === 1), mixed)

// 5) Creuset — 0 / 2 / 3 entrées possédées.
check('Creuset sans entrée = 0', forgeCreuset(emptyMetiers()) === 0, null)
check('Creuset 2 entrées = 0,12', Math.abs(forgeCreuset(withNodes({ surillvl: 1, econome: 1 })) - 0.12) < 1e-9, forgeCreuset(withNodes({ surillvl: 1, econome: 1 })))
check('Creuset 3 entrées = 0,18', Math.abs(forgeCreuset(withNodes({ surillvl: 1, econome: 1, foyer: 1 })) - 0.18) < 1e-9, null)

// 6) Forgeabilité par adjacence.
check('vide : Affûtage forgeable (voisin du cœur)', forgeForgeable(emptyMetiers(), 'surillvl') === true, null)
check('vide : Polissage NON forgeable (pas voisin du cœur)', forgeForgeable(emptyMetiers(), 'polissage') === false, null)
check('Affûtage pris : Polissage devient forgeable', forgeForgeable(withNodes({ surillvl: 1 }), 'polissage') === true, null)

// 7) Frappe (Lot 3) — jugement par zones (parfait centré, bien autour, raté au bord).
check('centre = PARFAIT', judgeFrappe(0.5) === 'perfect', judgeFrappe(0.5))
check('bord de la zone parfaite = PARFAIT', judgeFrappe(0.58) === 'perfect', judgeFrappe(0.58))
check('juste hors zone parfaite = BIEN', judgeFrappe(0.62) === 'good', judgeFrappe(0.62))
check('loin du centre = RATÉ', judgeFrappe(0.78) === 'miss', judgeFrappe(0.78))
check('extrémité = RATÉ', judgeFrappe(0) === 'miss', judgeFrappe(0))

// 8) Keystone Haut fourneau + jonctions (polish v0.41) — câblage dans craftMods / foyerRate.
const cmBase = craftMods(emptyMetiers())
check('par défaut : signatureCostMult = 1', cmBase.signatureCostMult === 1, cmBase.signatureCostMult)
check('par défaut : hautFourneau = false', cmBase.hautFourneau === false, cmBase.hautFourneau)
const cmJ = craftMods(withNodes({ jonctionAF: 1, hautFourneau: 1 }))
check('jonctionAF → signatureCostMult 0,5', cmJ.signatureCostMult === 0.5, cmJ.signatureCostMult)
check('hautFourneau → mods.hautFourneau true', cmJ.hautFourneau === true, cmJ.hautFourneau)
const frBase = foyerRate(withNodes({ foyer: 1 }), 0, 6, 4)
const frFI = foyerRate(withNodes({ foyer: 1, jonctionFI: 1 }), 0, 6, 4)
const frAI = foyerRate(withNodes({ foyer: 1, jonctionAI: 1 }), 0, 6, 4)
check('jonctionFI → +Lingots du Foyer', frFI.lingots > frBase.lingots * 1.4, [frBase.lingots, frFI.lingots])
check('jonctionAI → +XP du Foyer (via Chefs-d\'œuvre)', frAI.xp > frBase.xp, [frBase.xp, frAI.xp])

console.log(fails === 0 ? '\n🎉 Tout passe.' : `\n💥 ${fails} échec(s).`)
process.exit(fails === 0 ? 0 : 1)
