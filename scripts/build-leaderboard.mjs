// GÉNÉRATEUR DU LEADERBOARD — rejoue chaque build (catalogue de référence + communautaire) sur un
// BENCHMARK COMMUN (mêmes conditions → classement juste) via le vrai moteur `runSim`, puis émet une page
// HTML autonome et soignée → `dist/leaderboard.html` (publiée sur GitHub Pages par le déploiement).
//   node scripts/build-leaderboard.mjs   (alias : npm run leaderboard)
import { build } from 'esbuild'
import fs from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { runSim, SIM_CLASSES, SIM_RAIDS } from './src/game/simulator.ts'
  export { REFERENCE_BUILDS } from './src/game/referenceBuilds.ts'
  export { decodeBuild } from './src/game/buildCode.ts'
  export { setGlobalCombatMods } from './src/game/character.ts'
`)
const { runSim, SIM_CLASSES, SIM_RAIDS, REFERENCE_BUILDS, decodeBuild, setGlobalCombatMods } = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 }) // baseline neutre (pas d'upgrades de compte)

const REPO = 'Maxilyas/WarriorIdler'
const SUBMIT_URL = `https://github.com/${REPO}/issues/new?labels=build-submission&template=build-submission.yml`
// BENCHMARK COMMUN : tous les builds sont jugés sur le même contenu (scan du tier max d'un raid de réf).
const BENCH_CONTENT = { kind: 'raid', id: SIM_RAIDS[0].id, tier: 1, scan: true }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const clsIcon = (id) => SIM_CLASSES.find((c) => c.id === id)?.icon ?? '🛡️'
const memberIcons = (cfg) => cfg.team.map((m) => m.imported ? '📥' : clsIcon(m.cls)).join(' ')

// 1) Rassembler référence + communauté, rejouer chacun sur le benchmark commun.
let community = []
try { community = JSON.parse(fs.readFileSync('src/game/communityBuilds.json', 'utf-8')) } catch { /* vide */ }
const entries = [
  ...REFERENCE_BUILDS.map((b) => ({ name: b.name, by: 'référence', config: b.config, ref: true })),
  ...community.map((b) => ({ name: b.name, by: b.by || 'anonyme', config: decodeBuild(b.code), ref: false })).filter((b) => b.config),
]

const rows = []
for (const e of entries) {
  const cfg = { ...e.config, content: { ...BENCH_CONTENT } }
  let r
  try { r = runSim(cfg) } catch { continue } // build corrompu → ignoré (jamais de crash du générateur)
  const o = r.outcome
  const dps = r.members.reduce((a, m) => a + m.dps, 0)
  const ehp = Math.min(...r.members.map((m) => m.ehp))
  rows.push({ name: e.name, by: e.by, ref: e.ref, icons: memberIcons(cfg), tmax: o.maxReached, dps, ehp, members: r.members.length })
}
// Classement : tier max franchi, puis DPS d'équipe.
rows.sort((a, b) => b.tmax - a.tmax || b.dps - a.dps)
rows.forEach((r, i) => { r.rank = i + 1 })

const maxDps = Math.max(1, ...rows.map((r) => r.dps))
const maxEhp = Math.max(1, ...rows.map((r) => r.ehp))
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
const today = new Date().toISOString().slice(0, 10)

// 2) Rendu HTML.
const podium = rows.slice(0, 3).map((r) => `
  <article class="podium p${r.rank}">
    <div class="medal">${MEDAL[r.rank]}</div>
    <div class="pname">${esc(r.name)}</div>
    <div class="pby">${r.ref ? '★ référence' : 'par ' + esc(r.by)}</div>
    <div class="picons">${esc(r.icons)}</div>
    <div class="ptmax"><span>T${r.tmax}</span><label>tier max</label></div>
    <div class="pstats">
      <div><b style="color:var(--dps)">${fmt(r.dps)}</b><label>DPS</label></div>
      <div><b style="color:var(--ehp)">${fmt(r.ehp)}</b><label>survie</label></div>
    </div>
  </article>`).join('')

const list = rows.map((r) => `
  <tr class="${r.ref ? 'ref' : ''}">
    <td class="rk">${MEDAL[r.rank] || r.rank}</td>
    <td class="nm"><span class="ic">${esc(r.icons)}</span><span class="nt">${esc(r.name)}</span><span class="by">${r.ref ? '★ référence' : esc(r.by)}</span></td>
    <td class="tm"><span class="tbadge">T${r.tmax}</span></td>
    <td class="bar"><div class="track"><div class="fill dps" style="width:${(r.dps / maxDps * 100).toFixed(1)}%"></div></div><span>${fmt(r.dps)}</span></td>
    <td class="bar"><div class="track"><div class="fill ehp" style="width:${(r.ehp / maxEhp * 100).toFixed(1)}%"></div></div><span>${fmt(r.ehp)}</span></td>
  </tr>`).join('')

const empty = `
  <div class="empty">
    <div class="ebig">🏆</div>
    <h2>Aucun build communautaire… pour l'instant.</h2>
    <p>Sois le <b>premier</b> à figurer au classement. Compose ton build dans le simulateur, et soumets-le.</p>
    <a class="cta big" href="${SUBMIT_URL}">🚀 Soumettre mon build</a>
  </div>`

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>⚔ Warrior Idler — Leaderboard des builds</title>
<meta name="description" content="Classement des builds Warrior Idler : tier max, DPS et survie, sur un benchmark commun. Soumets le tien !">
<style>
  :root{
    --bg:#0b1120; --panel:#11161f; --line:#1e293b; --txt:#e2e8f0; --mut:#64748b;
    --orange:#f97316; --fuchsia:#d946ef; --dps:#34d399; --ehp:#38bdf8; --gold:#fbbf24; --silver:#cbd5e1; --bronze:#d97706;
  }
  *{box-sizing:border-box} html{scroll-behavior:smooth}
  body{margin:0;font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--txt);
    background:radial-gradient(1200px 600px at 50% -10%, #1b2540 0%, var(--bg) 55%) fixed; min-height:100vh}
  .wrap{max-width:920px;margin:0 auto;padding:24px 16px 64px}
  header.hero{text-align:center;padding:40px 16px 8px;position:relative}
  .hero h1{margin:0;font-size:clamp(28px,6vw,46px);font-weight:900;letter-spacing:-.02em;
    background:linear-gradient(90deg,var(--orange),var(--fuchsia));-webkit-background-clip:text;background-clip:text;color:transparent}
  .hero .sub{color:var(--mut);margin:8px 0 18px;font-size:14px}
  .cta{display:inline-block;text-decoration:none;font-weight:800;color:#fff;border-radius:14px;padding:12px 22px;
    background:linear-gradient(180deg,#fb923c,#ea580c);box-shadow:0 10px 30px -8px #ea580c99;transition:transform .15s, box-shadow .15s}
  .cta:hover{transform:translateY(-2px);box-shadow:0 16px 40px -8px #ea580ccc}
  .cta.big{font-size:17px;padding:14px 28px;animation:pulse 2.4s ease-in-out infinite}
  @keyframes pulse{0%,100%{box-shadow:0 10px 30px -8px #ea580c99}50%{box-shadow:0 14px 44px -6px #ea580cdd}}
  .count{display:inline-flex;gap:6px;align-items:center;margin-left:10px;color:var(--mut);font-size:13px}

  .podiums{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:12px;align-items:end;margin:28px 0 8px}
  @media(max-width:640px){.podiums{grid-template-columns:1fr;}}
  .podium{background:linear-gradient(180deg,#151c28,#0e1320);border:1px solid var(--line);border-radius:18px;padding:18px 14px;text-align:center;position:relative;overflow:hidden}
  .podium.p1{border-color:#fbbf2466;box-shadow:0 0 0 1px #fbbf2433,0 18px 50px -16px #fbbf2455;transform:translateY(-10px)}
  .podium.p2{border-color:#cbd5e155} .podium.p3{border-color:#d9770655}
  .podium .medal{font-size:34px;line-height:1}
  .podium.p1::before{content:"";position:absolute;inset:-40% 30% auto;height:120px;background:radial-gradient(closest-side,#fbbf2433,transparent);filter:blur(6px)}
  .pname{font-weight:800;margin-top:6px;font-size:15px} .pby{color:var(--mut);font-size:11px;margin-top:2px}
  .picons{font-size:18px;margin:8px 0}
  .ptmax span{font-size:30px;font-weight:900;background:linear-gradient(90deg,var(--orange),var(--fuchsia));-webkit-background-clip:text;background-clip:text;color:transparent}
  .ptmax label{display:block;font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.08em}
  .pstats{display:flex;justify-content:center;gap:18px;margin-top:8px}
  .pstats b{font-size:15px} .pstats label{display:block;font-size:10px;color:var(--mut);text-transform:uppercase}

  .board{background:var(--panel);border:1px solid var(--line);border-radius:18px;margin-top:18px;overflow:hidden}
  .board h3{margin:0;padding:14px 18px;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut);border-bottom:1px solid var(--line)}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:11px 12px;border-bottom:1px solid #161e2b;vertical-align:middle}
  tr:last-child td{border-bottom:0} tr.ref{background:#fef3c708} tr:hover td{background:#ffffff06}
  .rk{width:42px;text-align:center;font-weight:800;color:var(--mut);font-size:15px}
  .nm{min-width:160px} .nm .ic{margin-right:8px} .nm .nt{font-weight:700}
  .nm .by{display:block;font-size:11px;color:var(--mut)}
  .tm{width:64px;text-align:center}
  .tbadge{display:inline-block;font-weight:800;color:#0b1120;background:linear-gradient(90deg,var(--orange),var(--fuchsia));padding:3px 10px;border-radius:999px;font-size:13px}
  .bar{width:170px} .bar .track{height:8px;border-radius:999px;background:#0e1626;overflow:hidden}
  .bar .fill{height:100%;border-radius:999px} .bar .fill.dps{background:linear-gradient(90deg,#059669,var(--dps))}
  .bar .fill.ehp{background:linear-gradient(90deg,#0284c7,var(--ehp))}
  .bar span{display:block;margin-top:3px;font-size:11px;color:var(--mut);text-align:right}
  @media(max-width:640px){.bar{width:96px} td{padding:9px 8px}}

  .empty{text-align:center;padding:48px 16px;background:var(--panel);border:1px solid var(--line);border-radius:18px;margin-top:18px}
  .empty .ebig{font-size:56px} .empty h2{margin:10px 0 4px} .empty p{color:var(--mut);max-width:420px;margin:0 auto 18px}
  .colhead{display:grid;grid-template-columns:42px 1fr 64px 170px 170px;padding:0 12px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}
  @media(max-width:640px){.colhead{grid-template-columns:42px 1fr 64px 96px 96px}}
  footer{text-align:center;color:var(--mut);font-size:12px;margin-top:26px;line-height:1.7}
  footer a{color:var(--orange);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>⚔ Leaderboard des builds</h1>
    <div class="sub">Chaque build est rejoué sur le <b>même benchmark</b> (raid « ${esc(SIM_RAIDS[0].name)} », scan du tier max) via le vrai moteur de combat. Classé par <b>tier max</b>, puis DPS d'équipe.</div>
    <a class="cta big" href="${SUBMIT_URL}">🚀 Soumettre mon build</a>
    <span class="count">· ${rows.length} build${rows.length > 1 ? 's' : ''} au classement</span>
  </header>

  ${rows.length === 0 ? empty : `
  <section class="podiums">${podium}</section>

  <section class="board">
    <h3>Classement complet</h3>
    <div class="colhead"><span>#</span><span>Build</span><span>Tier</span><span>DPS équipe</span><span>Survie (EHP)</span></div>
    <table><tbody>${list}</tbody></table>
  </section>`}

  <footer>
    Généré le ${today} · moteur identique au jeu (<code>runSim</code>).<br>
    Compose et teste ton build dans le <a href="./">simulateur en jeu</a>, puis <a href="${SUBMIT_URL}">soumets-le</a> — il apparaîtra ici.
  </footer>
</div>
</body>
</html>`

fs.mkdirSync('dist', { recursive: true })
fs.writeFileSync('dist/leaderboard.html', html)
console.log(`Leaderboard généré : dist/leaderboard.html · ${rows.length} build(s) classé(s) (benchmark : raid ${SIM_RAIDS[0].id}, scan).`)
