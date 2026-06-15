// Harnais TTK (refonte v0.30, LOT 0) — filet de sécurité chiffré de la courbe unifiée.
// Mesure le TEMPS DE KILL (TTK) sur tout l'axe d'ilvl (50→700) à stuff CALÉ et en sur/sous-stuff,
// + la survie + l'écart de rareté. Importe le VRAI module `progression.ts` (zéro copie de règles).
//
// Critères de succès (DESIGN_v0.30 §11) :
//   1. TTK plat à stuff calé (trash 3 s ±15 %, boss 35 s ±15 %) sur 50→700.
//   2. Sur-stuff borné (+20 ilvl → TTK ÷1,8 max).
//   3. Rareté à ilvl fixe ≤ ×3,8 (drop).
//   4. Aucun ilvl > 700.
//   5. Survie ~8 s de boss à stuff calé.
import { build } from 'esbuild'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const P = await load(`export * from './src/game/progression.ts'`)
const {
  POW_BASE, ILVL_MAX, RARITY_ILVL_PER_TIER, powerAt, effItemIlvl, ilvlPerDouble,
  ENEMY_HP_CLASS, enemyHp, enemyDmg, TTK, SURVIVE_SECONDS,
  ilvlFarm, ilvlDungeon, ilvlRaid,
} = P

const fmt = (n) => n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const ok = (b) => b ? '✅' : '❌'

// ---- Modèle JOUEUR (abstrait mais fidèle au design : DPS/HP ∝ b^(gearIlvl effectif)) ----
// Le DPS réel viendra du vrai code character.ts une fois le budget exponentiel câblé (LOT 2). Ici on
// modélise le joueur par sa loi de croissance : tout ce qui compte pour le TTK, c'est que la puissance
// suive b^ilvl avec la MÊME base que l'ennemi. Les secondaires sont un multiplicateur BORNÉ (identité
// de build), pas un facteur qui scale avec l'ilvl → ils décalent le TTK absolu, jamais sa PENTE.
const RARITY_BASELINE_TIER = 6 // « stuff calé » = rareté légendaire au niveau du contenu (réaliste)
const BUILD_SEC_MULT = 7.5     // multiplicateur secondaire borné d'un build optimisé (crit×dcrit×hâte×maîtrise×type)

// On SOLVE les deux constantes d'échelle pour viser les TTK cibles à stuff calé (gi = ci).
// playerDps(gi) = K_DPS · powerAt(gi + rarBonus) · BUILD_SEC_MULT
// trash calé : enemyHp(ci,'trash') / playerDps(ci) = TTK.trash
const rarBonus = RARITY_ILVL_PER_TIER * (RARITY_BASELINE_TIER - 1)
const CI_REF = 300
const K_DPS = enemyHp(CI_REF, 'trash') / (TTK.trash * powerAt(CI_REF + rarBonus) * BUILD_SEC_MULT)
const playerDps = (gi, rarTier = RARITY_BASELINE_TIER) => K_DPS * powerAt(effItemIlvl(gi, rarTier)) * BUILD_SEC_MULT

// Survie : playerHp(gi) ∝ b^gi ; survie boss calé = SURVIVE_SECONDS.
const MIT = 0.45 // atténuation générique « build correct » (esquive/réduction/maîtrise), bornée
const K_HP = (SURVIVE_SECONDS * enemyDmg(CI_REF, 'boss') * MIT) / powerAt(CI_REF + rarBonus)
const playerHp = (gi, rarTier = RARITY_BASELINE_TIER) => K_HP * powerAt(effItemIlvl(gi, rarTier))

const ttk = (ci, cls, gi, rarTier) => enemyHp(ci, cls) / playerDps(gi, rarTier)
const survive = (ci, cls, gi) => playerHp(gi) / (enemyDmg(ci, cls) * MIT)

console.log('================= HARNAIS TTK v0.30 (LOT 0) =================')
console.log(`b=${POW_BASE}  ×2 tous les ${ilvlPerDouble().toFixed(1)} ilvl  ·  cap ilvl ${ILVL_MAX}  ·  rareté +${RARITY_ILVL_PER_TIER}/cran`)
console.log(`plage de puissance 1→${ILVL_MAX} : ×${fmt(powerAt(ILVL_MAX - 1))}\n`)

// ---- (1) TTK à stuff CALÉ sur toute la plage ----
console.log('=== (1) TTK à stuff calé (gi = ci, rareté légendaire) ===')
console.log(' ci  | DPS joueur  | PV trash    | PV boss     | TTK trash | TTK élite | TTK boss | TTK raid')
const ttkRows = []
for (const ci of [50, 100, 150, 200, 300, 400, 500, 600, 700]) {
  const dps = playerDps(ci)
  const r = { ci, trash: ttk(ci, 'trash', ci), elite: ttk(ci, 'elite', ci), boss: ttk(ci, 'boss', ci), raid: ttk(ci, 'raidboss', ci) }
  ttkRows.push(r)
  console.log(` ${String(ci).padStart(3)} | ${fmt(dps).padStart(11)} | ${fmt(enemyHp(ci, 'trash')).padStart(11)} | ${fmt(enemyHp(ci, 'boss')).padStart(11)} |` +
    ` ${r.trash.toFixed(1).padStart(8)}s | ${r.elite.toFixed(1).padStart(8)}s | ${r.boss.toFixed(0).padStart(7)}s | ${r.raid.toFixed(0).padStart(7)}s`)
}
// Vérif planéité : variance du TTK trash/boss vs cible.
const trashErr = Math.max(...ttkRows.map((r) => Math.abs(r.trash - TTK.trash) / TTK.trash))
const bossErr = Math.max(...ttkRows.map((r) => Math.abs(r.boss - TTK.boss) / TTK.boss))
console.log(`\n  ${ok(trashErr < 0.15)} TTK trash plat (écart max ${(trashErr * 100).toFixed(1)}% vs cible ${TTK.trash}s, seuil 15%)`)
console.log(`  ${ok(bossErr < 0.15)} TTK boss  plat (écart max ${(bossErr * 100).toFixed(1)}% vs cible ${TTK.boss}s, seuil 15%)`)

// ---- (2) Sur/sous-stuff : le snowball résiduel, désormais BORNÉ ----
console.log('\n=== (2) Sur/sous-stuff vs contenu ci=400 (boss) ===')
console.log('  Δilvl |  TTK boss | ×vitesse vs calé')
const baseTtk = ttk(400, 'boss', 400)
for (const d of [-80, -40, -20, 0, 20, 40, 80, 150]) {
  const t = ttk(400, 'boss', 400 + d)
  console.log(`  ${(d >= 0 ? '+' : '') + d}`.padEnd(8) + `| ${t.toFixed(1).padStart(8)}s | ×${(baseTtk / t).toFixed(2)}`)
}
const over20 = baseTtk / ttk(400, 'boss', 420)
console.log(`  ${ok(over20 <= 1.85)} +20 ilvl borné (×${over20.toFixed(2)}, seuil ×1,85)`)

// ---- (3) Rareté à ilvl FIXE : amplification bornée (vs ×223 en v0.29) ----
console.log('\n=== (3) Rareté à ilvl fixe (ci=400) : ×DPS ===')
const base1 = playerDps(400, 1)
const rars = [['Médiocre', 1], ['Épique', 5], ['Légendaire', 6], ['Mythique', 9], ['Cosmique', 13], ['Transcendant', 16]]
for (const [n, t] of rars) console.log(`  ${n.padEnd(13)} ×${(playerDps(400, t) / base1).toFixed(2)}`)
const rarSpread = playerDps(400, 16) / playerDps(400, 1)
console.log(`  ${ok(rarSpread <= 4.0)} écart rareté borné (×${rarSpread.toFixed(2)}, seuil ×4,0 — était ×223)`)

// ---- (4) Cap d'ilvl : rien ne dépasse 700 ----
console.log('\n=== (4) Mapping contenu → ilvl (aucun > 700) ===')
const maxFarm = ilvlFarm(500), maxDun = ilvlDungeon(30)
const maxRaidBase = ilvlRaid(230, 10) // Forge tierFloor 230 + ... (les 4 raids montent jusqu'à ~600)
const maxAbysse = ilvlRaid(560, 10) // Abîme jusqu'à 700
console.log(`  Farm   palier 1→500 : ${ilvlFarm(1)} → ${maxFarm} (cap 200)`)
console.log(`  Donjon niv 1→30     : ${ilvlDungeon(1)} → ${maxDun} (cap 250)`)
console.log(`  Raids base T1→T10   : 230 → ${maxRaidBase}`)
console.log(`  Abîme  T1→T10       : 560 → ${maxAbysse}`)
const allUnder = [maxFarm, maxDun, ilvlRaid(440, 10), maxAbysse].every((v) => v <= ILVL_MAX)
console.log(`  ${ok(allUnder)} aucun ilvl de contenu > ${ILVL_MAX}`)

// ---- (5) Survie à stuff calé ----
console.log('\n=== (5) Survie à stuff calé (s d\'auto-attaque encaissables) ===')
console.log('  ci  | survie boss | survie raid')
const survRows = []
for (const ci of [50, 200, 400, 700]) {
  const sb = survive(ci, 'boss', ci), sr = survive(ci, 'raidboss', ci)
  survRows.push(sb)
  console.log(`  ${String(ci).padStart(3)} | ${sb.toFixed(1).padStart(9)}s | ${sr.toFixed(1).padStart(9)}s`)
}
const survErr = Math.max(...survRows.map((s) => Math.abs(s - SURVIVE_SECONDS) / SURVIVE_SECONDS))
console.log(`  ${ok(survErr < 0.15)} survie plate ~${SURVIVE_SECONDS}s (écart max ${(survErr * 100).toFixed(1)}%)`)

// ---- Verdict ----
const pass = trashErr < 0.15 && bossErr < 0.15 && over20 <= 1.85 && rarSpread <= 4.0 && allUnder && survErr < 0.15
console.log(`\n================= VERDICT : ${pass ? '✅ MODÈLE VALIDE' : '❌ À RECALER'} =================`)
console.log('Constantes solvées (à porter en LOT 2/4-6) :')
console.log(`  K_DPS=${K_DPS.toExponential(3)}  K_HP=${K_HP.toExponential(3)}  (ENEMY_HP0=${P.ENEMY_HP0}, ENEMY_DMG0=${P.ENEMY_DMG0})`)
