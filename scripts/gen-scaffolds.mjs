// GÉNÉRATEUR DE SQUELETTES DE BUILD — émet des codes WIB1 « corps » (stuff/gemmes/uniques/niveau/rareté
// d'époque) à ARBRE VIDE, pour que le JOUEUR construise l'arbre de talents + équipe les pouvoirs dans le
// Simulateur, puis re-partage (🔗) le build REMPLI. But : un corpus de VRAIS builds, sur une ÉCHELLE de
// rareté ET de niveau, pour la précondition §6 et l'équilibrage (docs/DIFFICULTE.md §9). La survie vient
// de l'arbre/pouvoirs choisis — ce que l'auto-génération ne sait pas faire.
//
//   node scripts/gen-scaffolds.mjs           → matrice par défaut (4 classes × 3 rungs), écrite dans scaffolds.txt
//
// Round-trip : ouvre scaffolds.txt → copie un code → Simulateur « Coller un code » → bâtis l'arbre +
// équipe les pouvoirs (survie incluse) → teste → 🔗 Partager → renvoie le code REMPLI. Le corps est
// PRÉSERVÉ (encodeBuild sérialise tout : stuff/gemmes/uniques/niveau/rareté).
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { encodeBuild } from './src/game/buildCode.ts'
  export { initGear, SIM_CLASSES, SIM_UNIQUES, SIM_GEMS } from './src/game/simulator.ts'
  export { stageIlvl } from './src/game/enemies.ts'
  export { RARITIES } from './src/game/rarities.ts'
`)
const { encodeBuild, initGear, SIM_CLASSES, SIM_UNIQUES, SIM_GEMS, stageIlvl, RARITIES } = M

// ---- KNOBS de la matrice (faciles à ajuster) ----
// Échelle COUPLÉE rareté×niveau (la progression naturelle : on monte en rareté en avançant). Chaque rung
// = un Chapitre + sa rareté d'époque pour un joueur équipé. Niveau ≈ 0,92×stage (calé sur un roster réel
// niv 111 @ stage 119). ilvl = stageIlvl(stage). Gemmes + 1 UNIQUE par pièce (cyclé pour la variété).
const PROFILES = [
  { ch: 5, rarity: 'epique' },      // début de raid : légendaires/épiques à uniques
  { ch: 8, rarity: 'legendaire' },  // mid
  { ch: 11, rarity: 'mythique' },   // avancé
]
const anchorLevel = (stage) => Math.max(1, Math.round(stage * 0.92))
const OFF_GEM = SIM_GEMS.find((g) => g.kind === 'off')?.id ?? 'overkill'
const DEF_GEM = SIM_GEMS.find((g) => g.kind === 'def')?.id ?? 'sixieme'

/** Stuff explicite : 16 pièces équilibrées + 1 gemme/pièce (off/def alternées) + 1 UNIQUE/pièce (cyclé).
 *  Lignes = défaut offensif (rééquilibrable d'un clic via « Appliquer à toutes les pièces » → Lignes). */
function buildGear(ch) {
  const g = initGear('equilibre')
  const rank = Math.min(10, ch) // rang gemmes/uniques qui monte avec la bande
  Object.keys(g).forEach((sid, i) => {
    g[sid] = {
      ...g[sid],
      gems: [i % 2 === 0 ? OFF_GEM : DEF_GEM], gemRank: rank,
      unique: SIM_UNIQUES[i % SIM_UNIQUES.length].id, uniqueRank: rank,
    }
  })
  return g
}

const lines = []
const push = (s) => lines.push(s)
push('=== Squelettes de build — ÉCHELLE rareté × niveau (corps généré, ARBRE À CONSTRUIRE) ===')
push('Ouvre ce fichier, copie un code WIB1 → Simulateur « Coller un code » → bâtis l\'arbre + équipe les')
push('pouvoirs (survie incluse) → teste → 🔗 Partager → renvoie le code REMPLI. Stuff/gemmes/uniques préservés.')
push('Stuff = 16 pièces équilibrées + 1 gemme/pièce + 1 UNIQUE/pièce (cyclé). Stats : défaut offensif —')
push('rééquilibre résist/défensif d\'un clic via « Appliquer à toutes les pièces » → Lignes, dans le Simulateur.')
push('')

const summary = []
for (const { ch, rarity } of PROFILES) {
  const stage = ch * 10
  const ilvl = stageIlvl(stage)
  const level = anchorLevel(stage)
  const rname = RARITIES[rarity]?.name ?? rarity
  push(`--- Rung Ch.${ch} · ${rname} · niv ${level} · ilvl ${ilvl} · gemmes+uniques rang ${Math.min(10, ch)} ---`)
  for (const c of SIM_CLASSES) {
    const cfg = {
      ilvl, rarity, bestStage: stage, elixir: '',
      team: [{
        name: `${c.label} Ch.${ch} ${rname}`, cls: c.id, level, orientation: 'equilibre',
        gems: [], runes: [], gear: buildGear(ch),
        talents: { co_start: 1 },               // ARBRE VIDE : à toi de le construire
        powers: [], support: [], passives: [],    // POUVOIRS À ÉQUIPER (après avoir débloqué l'arbre)
      }],
      content: { kind: 'raid', id: 'forge', tier: 1, scan: true },
    }
    const code = encodeBuild(cfg)
    push(`${c.icon} ${c.label} (Ch.${ch} ${rname}) :`)
    push(code)
    push('')
    summary.push(`${c.icon} ${c.label} Ch.${ch} ${rname}`)
  }
}

writeFileSync('scaffolds.txt', lines.join('\n'))
console.log(`✓ ${summary.length} profils écrits dans scaffolds.txt :`)
console.log('  ' + summary.join('\n  '))
console.log('\nProchaine étape : ouvre scaffolds.txt, construis les arbres dans le Simulateur, renvoie-moi les codes remplis.')
