// GÉNÉRATEUR DU LEADERBOARD / DASHBOARD — rejoue chaque build (référence + communautaire) sur un
// BENCHMARK COMMUN via le vrai moteur `runSim`, extrait toute la compo (talents/sorts/gemmes/runes/
// uniques), agrège des KPI, et émet une page HTML autonome et interactive (filtres + détail au clic)
// → `dist/leaderboard.html` (publiée sur GitHub Pages). Tout texte joueur est HTML-échappé.
//   node scripts/build-leaderboard.mjs   (alias : npm run leaderboard)
import { build } from 'esbuild'
import fs from 'node:fs'

const load = async (entry) => {
  const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
}
const M = await load(`
  export { runSim, getClassPreset, initTalents, SIM_CLASSES, SIM_RAIDS, SIM_GEMS, SIM_RUNES, SIM_UNIQUES, CLASS_CONSTELLATIONS } from './src/game/simulator.ts'
  export { REFERENCE_BUILDS } from './src/game/referenceBuilds.ts'
  export { decodeBuild } from './src/game/buildCode.ts'
  export { setGlobalCombatMods } from './src/game/character.ts'
  export { getPower } from './src/game/powers.ts'
  export { getTalent, CONSTELLATIONS, talentsByConstellation } from './src/game/talents.ts'
`)
const {
  runSim, getClassPreset, initTalents, SIM_CLASSES, SIM_RAIDS, SIM_GEMS, SIM_RUNES, SIM_UNIQUES,
  REFERENCE_BUILDS, decodeBuild, setGlobalCombatMods, getPower, getTalent, CONSTELLATIONS, talentsByConstellation, CLASS_CONSTELLATIONS,
} = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })

const REPO = 'Maxilyas/WarriorIdler'
const SUBMIT_URL = `https://github.com/${REPO}/issues/new?labels=build-submission&template=build-submission.yml`
const BENCH_CONTENT = { kind: 'raid', id: SIM_RAIDS[0].id, tier: 1, scan: true }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

// Résolveurs id → { icon, name } (résolus côté génération → le front ne manipule que des chaînes).
const gemMap = new Map(SIM_GEMS.map((g) => [g.id, g]))
const runeMap = new Map(SIM_RUNES.map((r) => [r.id, r]))
const uniqueMap = new Map(SIM_UNIQUES.map((u) => [u.id, u]))
const clsMap = new Map(SIM_CLASSES.map((c) => [c.id, c]))
const spell = (id) => { const p = getPower(id); return p ? { icon: p.icon ?? '•', name: p.name } : null }
const gem = (id) => { const g = gemMap.get(id); return g ? { icon: g.icon, name: g.name } : null }
const rune = (id) => { const r = runeMap.get(id); return r ? { icon: r.icon, name: r.name } : null }
const unique = (id) => { const u = uniqueMap.get(id); return u ? { name: u.name } : null }

// constellation → classe (hors « coeur », partagé) pour les KPI de talents par classe.
const constToClass = new Map()
for (const [clsId, cons] of Object.entries(CLASS_CONSTELLATIONS)) for (const c of cons) if (c !== 'coeur' && !constToClass.has(c)) constToClass.set(c, clsId)
const classMeta = (clsId) => clsMap.get(clsId) ?? { icon: '🛡️', label: clsId }

// Compo d'UN membre depuis la config (gère membre importé = vrai Character).
function memberComposition(m, cfg) {
  const imp = m.imported
  const talents = m.talents ?? (imp ? imp.talents : initTalents(m.cls))
  const spellIds = (m.powers ?? (imp ? imp.powers : getClassPreset(m.cls).powers) ?? []).filter(Boolean)
  const gems = new Set(), runes = new Set(), uniques = new Set()
  ;(m.gems ?? []).forEach((g) => gems.add(g))
  ;(m.runes ?? []).forEach((r) => runes.add(r))
  if (m.gear) for (const k in m.gear) { (m.gear[k].gems ?? []).forEach((g) => gems.add(g)); if (m.gear[k].unique) uniques.add(m.gear[k].unique) }
  if (imp?.equipment) for (const k in imp.equipment) {
    const it = imp.equipment[k]; if (!it) continue
    ;(it.gems ?? []).forEach((g) => g?.cond && gems.add(g.cond))
    if (it.enchant) runes.add(it.enchant)
    if (it.unique) uniques.add(it.unique.id)
  }
  // ilvl représentatif
  let ilvl = cfg.ilvl
  if (imp?.equipment) { const its = Object.values(imp.equipment).filter(Boolean); if (its.length) ilvl = Math.round(its.reduce((a, it) => a + (it.ilvl || 0), 0) / its.length) }
  else if (m.gear) { const ils = Object.values(m.gear).map((g) => g.ilvl).filter(Boolean); if (ils.length) ilvl = Math.round(ils.reduce((a, b) => a + b, 0) / ils.length) }
  // classe primaire = groupe de constellations de classe le plus investi (corrige l'import « guerrier »).
  let primary = m.cls, bestN = -1
  for (const clsId of Object.keys(CLASS_CONSTELLATIONS)) {
    const n = (CLASS_CONSTELLATIONS[clsId] || []).filter((c) => c !== 'coeur').reduce((a, c) => a + talentsByConstellation(c).reduce((s, node) => s + (talents[node.id] ?? 0), 0), 0)
    if (n > bestN) { bestN = n; primary = clsId }
  }
  // talents groupés par constellation (alloués seulement).
  const byConst = new Map()
  for (const [nodeId, rank] of Object.entries(talents)) {
    if (!rank || nodeId === 'co_start' || nodeId === 'pa_start') continue
    const node = getTalent(nodeId); if (!node) continue
    byConst.set(node.constellation, (byConst.get(node.constellation) ?? 0) + rank)
  }
  const talentsGrouped = [...byConst.entries()].map(([c, pts]) => {
    const meta = CONSTELLATIONS[c] ?? { name: c, icon: '•', color: '#94a3b8' }
    return { constId: c, name: meta.name, icon: meta.icon, color: meta.color, points: pts }
  }).sort((a, b) => b.points - a.points)
  const totalTalents = [...byConst.values()].reduce((a, b) => a + b, 0)
  return { talents, primary, ilvl, totalTalents, talentsGrouped,
    spells: spellIds.map(spell).filter(Boolean), gems: [...gems].map(gem).filter(Boolean),
    runes: [...runes].map(rune).filter(Boolean), uniques: [...uniques].map(unique).filter(Boolean) }
}

// 1) Rassembler + rejouer + extraire.
let community = []
try { community = JSON.parse(fs.readFileSync('src/game/communityBuilds.json', 'utf-8')) } catch { /* vide */ }
const entries = [
  ...REFERENCE_BUILDS.map((b) => ({ name: b.name, by: 'référence', config: b.config, ref: true })),
  ...community.map((b) => ({ name: b.name, by: b.by || 'anonyme', config: decodeBuild(b.code), ref: false })).filter((b) => b.config),
]

const DATA = []
const agg = { talentsByClass: new Map(), spells: new Map(), gems: new Map(), runes: new Map(), uniques: new Map() }
const bump = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n)
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1)

// Le stuff est rollé avec de l'aléatoire → on MOYENNE K runs pour un classement stable/équitable.
function simAvg(cfg, k = 3) {
  const runs = []
  for (let i = 0; i < k; i++) { try { runs.push(runSim({ ...cfg, content: { ...BENCH_CONTENT } })) } catch { /* run raté ignoré */ } }
  if (!runs.length) return null
  const members = cfg.team.map((_, i) => ({
    dps: mean(runs.map((r) => r.members[i]?.dps ?? 0)),
    ehp: mean(runs.map((r) => r.members[i]?.ehp ?? 0)),
    maxHp: mean(runs.map((r) => r.members[i]?.maxHp ?? 0)),
  }))
  return { members, tmax: Math.round(mean(runs.map((r) => r.outcome.maxReached))) }
}

for (const e of entries) {
  const cfg = e.config
  const r = simAvg(cfg)
  if (!r) continue
  const comps = cfg.team.map((m) => memberComposition(m, cfg))
  const members = cfg.team.map((m, i) => {
    const c = comps[i], rm = r.members[i] ?? {}
    return {
      name: m.imported?.name ?? m.name, cls: c.primary, clsIcon: classMeta(c.primary).icon, clsLabel: classMeta(c.primary).label,
      level: m.imported?.level ?? m.level, ilvl: c.ilvl,
      dps: Math.round(rm.dps ?? 0), ehp: Math.round(rm.ehp ?? 0), hp: Math.round(rm.maxHp ?? 0),
      talents: c.talentsGrouped, totalTalents: c.totalTalents, spells: c.spells, gems: c.gems, runes: c.runes, uniques: c.uniques,
    }
  })
  // Agrégats KPI.
  for (const c of comps) {
    for (const g of c.talentsGrouped) { const clsId = constToClass.get(g.constId); if (clsId) bump(agg.talentsByClass, clsId, g.points) }
    c.spells.forEach((s) => bump(agg.spells, s.name))
    c.gems.forEach((g) => bump(agg.gems, g.name))
    c.runes.forEach((r2) => bump(agg.runes, r2.name))
    c.uniques.forEach((u) => bump(agg.uniques, u.name))
  }
  const level = Math.max(...members.map((m) => m.level), 1)
  const ilvl = Math.round(members.reduce((a, m) => a + m.ilvl, 0) / members.length)
  DATA.push({
    name: e.name, by: e.by, ref: e.ref,
    chars: members.length, solo: members.length === 1, level, ilvl,
    contentKind: cfg.content?.kind ?? 'raid', contentLabel: (cfg.content?.kind === 'dungeon' ? 'Donjon' : 'Raid'),
    classes: [...new Set(members.map((m) => m.cls))],
    tmax: r.tmax, dpsTotal: members.reduce((a, m) => a + m.dps, 0), ehpMin: Math.min(...members.map((m) => m.ehp)),
    members,
  })
}
DATA.sort((a, b) => b.tmax - a.tmax || b.dpsTotal - a.dpsTotal)
DATA.forEach((d, i) => { d.rank = i + 1 })

// 2) KPI résolus (top listes + talents par classe).
const topList = (map, n = 6) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }))
const talentsByClass = [...agg.talentsByClass.entries()].sort((a, b) => b[1] - a[1]).map(([cls, points]) => ({ cls, name: classMeta(cls).label, icon: classMeta(cls).icon, points }))
const KPI = {
  builds: DATA.length, classes: [...new Set(DATA.flatMap((d) => d.classes))],
  talentsByClass, spells: topList(agg.spells), gems: topList(agg.gems), runes: topList(agg.runes), uniques: topList(agg.uniques),
}
const ilvls = DATA.map((d) => d.ilvl)
const ILVL_MIN = Math.min(0, ...ilvls), ILVL_MAX = Math.max(10, ...ilvls)
const today = new Date().toISOString().slice(0, 10)

// 3) Rendu HTML : KPI + filtres + liste, le tout piloté par un petit front JS à partir d'un blob JSON.
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>⚔ Warrior Idler — Dashboard des builds</title>
<meta name="description" content="Classement et statistiques des builds Warrior Idler : tier max, DPS, survie, talents, sorts, gemmes. Soumets le tien !">
<style>
  :root{--bg:#0b1120;--panel:#11161f;--card:#131a26;--line:#1e293b;--txt:#e2e8f0;--mut:#64748b;
    --orange:#f97316;--fuchsia:#d946ef;--dps:#34d399;--ehp:#38bdf8;--hp:#f472b6;--gold:#fbbf24;}
  *{box-sizing:border-box} html{scroll-behavior:smooth}
  body{margin:0;font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--txt);
    background:radial-gradient(1200px 600px at 50% -10%,#1b2540 0%,var(--bg) 55%) fixed;min-height:100vh}
  .wrap{max-width:980px;margin:0 auto;padding:24px 16px 64px}
  .hero{text-align:center;padding:36px 16px 6px}
  .hero h1{margin:0;font-size:clamp(26px,5.5vw,44px);font-weight:900;letter-spacing:-.02em;
    background:linear-gradient(90deg,var(--orange),var(--fuchsia));-webkit-background-clip:text;background-clip:text;color:transparent}
  .hero .sub{color:var(--mut);margin:8px 0 18px;font-size:14px}
  .cta{display:inline-block;text-decoration:none;font-weight:800;color:#fff;border-radius:14px;padding:13px 26px;font-size:16px;
    background:linear-gradient(180deg,#fb923c,#ea580c);box-shadow:0 10px 30px -8px #ea580c99;animation:pulse 2.4s ease-in-out infinite}
  @keyframes pulse{0%,100%{box-shadow:0 10px 30px -8px #ea580c99}50%{box-shadow:0 14px 44px -6px #ea580cdd}}
  .count{margin-left:10px;color:var(--mut);font-size:13px}

  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:26px 0 8px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px}
  .kpi h3{margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut)}
  .trow{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px}
  .trow .ic{width:20px;text-align:center} .trow .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .trow .ct{color:var(--mut);font-variant-numeric:tabular-nums;font-size:12px}
  .clsbar{height:8px;border-radius:999px;background:#0e1626;overflow:hidden;flex:1}
  .clsbar > i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#7c3aed,var(--fuchsia))}

  .filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin:8px 0 14px;font-size:13px}
  .filters .grp{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .chip{cursor:pointer;border:1px solid var(--line);background:#0e1626;color:var(--mut);border-radius:999px;padding:5px 11px;font-size:12px;font-weight:600;user-select:none}
  .chip.on{color:#0b1120;background:linear-gradient(90deg,var(--orange),var(--fuchsia));border-color:transparent}
  .filters label{color:var(--mut)} .filters input[type=range]{vertical-align:middle}
  .filters select{background:#0e1626;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:5px 8px}
  .sep{width:1px;height:20px;background:var(--line);margin:0 4px}

  .row{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:9px;overflow:hidden}
  .row.ref{background:#fef3c708}
  .rhead{display:grid;grid-template-columns:42px 1fr repeat(3,minmax(64px,82px)) 64px 22px;gap:10px;align-items:center;padding:11px 14px;cursor:pointer}
  .rhead:hover{background:#ffffff06}
  .rk{text-align:center;font-weight:800;color:var(--mut);font-size:15px}
  .who .nt{font-weight:700} .who .meta{display:block;font-size:11px;color:var(--mut);margin-top:1px}
  .who .ic{margin-right:6px}
  .stat{text-align:right;font-variant-numeric:tabular-nums} .stat b{font-size:14px} .stat label{display:block;font-size:9.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em}
  .tbadge{justify-self:center;display:inline-block;font-weight:800;color:#0b1120;background:linear-gradient(90deg,var(--orange),var(--fuchsia));padding:3px 9px;border-radius:999px;font-size:12px}
  .chev{color:var(--mut);transition:transform .2s} .row.open .chev{transform:rotate(90deg)}
  .detail{display:none;border-top:1px solid var(--line);padding:6px 14px 14px;background:#0d1320}
  .row.open .detail{display:block}
  .mb{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:10px;background:var(--card)}
  .mb .mh{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline} .mb .mn{font-weight:700} .mb .mtag{font-size:11px;color:var(--mut)}
  .mb .ms{margin-left:auto;display:flex;gap:14px;font-variant-numeric:tabular-nums;font-size:12px}
  .mb .ms .v{font-weight:700}
  .seg{margin-top:9px} .seg .lab{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin-bottom:4px}
  .pills{display:flex;flex-wrap:wrap;gap:5px} .pill{background:#0e1626;border:1px solid var(--line);border-radius:8px;padding:3px 8px;font-size:12px}
  .pill.tal{border-color:transparent}
  .empty{color:var(--mut);text-align:center;padding:24px}

  .colhead{display:grid;grid-template-columns:42px 1fr repeat(3,minmax(64px,82px)) 64px 22px;gap:10px;padding:0 14px 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
  .colhead span{text-align:right} .colhead span:nth-child(2){text-align:left} .colhead span:nth-child(6){text-align:center}
  footer{text-align:center;color:var(--mut);font-size:12px;margin-top:26px;line-height:1.7} footer a{color:var(--orange);text-decoration:none}
  @media(max-width:680px){.rhead,.colhead{grid-template-columns:34px 1fr 70px 64px 20px}.hidesm{display:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>⚔ Dashboard des builds</h1>
    <div class="sub">Chaque build rejoué sur le <b>même benchmark</b> (${esc(SIM_RAIDS[0].name)}, scan du tier max) via le vrai moteur. Classé par tier max, puis DPS.</div>
    <a class="cta" href="${SUBMIT_URL}">🚀 Soumettre mon build</a><span class="count">· <span id="bcount">${DATA.length}</span> build${DATA.length > 1 ? 's' : ''}</span>
  </div>

  <div class="kpis" id="kpis"></div>
  <div class="filters" id="filters"></div>
  <div class="colhead"><span>#</span><span>Build</span><span>DPS</span><span class="hidesm">Survie</span><span class="hidesm">HP</span><span>Tier</span><span></span></div>
  <div id="list"></div>

  <footer>
    Généré le ${today} · moteur identique au jeu (<code>runSim</code>).<br>
    Compose ton build dans le <a href="./">simulateur</a>, puis <a href="${SUBMIT_URL}">soumets-le</a> — il apparaîtra ici.
  </footer>
</div>

<script>
const DATA = ${JSON.stringify(DATA)};
const KPI = ${JSON.stringify(KPI)};
const ILVL_MIN = ${ILVL_MIN}, ILVL_MAX = ${ILVL_MAX};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n>=1e9?(n/1e9).toFixed(2)+'Md':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':Math.round(n).toString();
const MEDAL = {1:'🥇',2:'🥈',3:'🥉'};
const state = { cls:null, content:'all', team:'all', ilvl:ILVL_MIN };

// KPI cards
function renderKpis(){
  const maxTal = Math.max(1,...KPI.talentsByClass.map(t=>t.points));
  const tlist = (arr) => arr.length ? arr.map(x=>\`<div class="trow"><span class="ic">\${esc(x.icon||'•')}</span><span class="nm">\${esc(x.name)}</span><span class="ct">×\${x.count}</span></div>\`).join('') : '<div class="ct" style="color:var(--mut)">—</div>';
  document.getElementById('kpis').innerHTML = \`
    <div class="kpi"><h3>Talents par classe</h3>\${KPI.talentsByClass.length?KPI.talentsByClass.map(t=>\`<div class="trow"><span class="ic">\${esc(t.icon)}</span><span class="nm">\${esc(t.name)}</span><span class="clsbar"><i style="width:\${(t.points/maxTal*100).toFixed(0)}%"></i></span><span class="ct">\${t.points}</span></div>\`).join(''):'<div class="ct">—</div>'}</div>
    <div class="kpi"><h3>Sorts populaires</h3>\${tlist(KPI.spells)}</div>
    <div class="kpi"><h3>Gemmes populaires</h3>\${tlist(KPI.gems)}</div>
    <div class="kpi"><h3>Runes populaires</h3>\${tlist(KPI.runes)}</div>
    <div class="kpi"><h3>Uniques populaires</h3>\${tlist(KPI.uniques.map(u=>({...u,icon:'✦'})))}</div>\`;
}

// Filters
const CLS_ICON = {}; DATA.forEach(d=>d.members.forEach(m=>CLS_ICON[m.cls]=m.clsIcon));
function renderFilters(){
  const classes = KPI.classes;
  const chip = (on,label,on2) => \`<span class="chip\${on?' on':''}" data-act="\${on2}">\${label}</span>\`;
  document.getElementById('filters').innerHTML = \`
    <div class="grp"><label>Classe</label>\${chip(state.cls===null,'Toutes','cls:')}\${classes.map(c=>chip(state.cls===c,(CLS_ICON[c]||'')+' '+c,'cls:'+c)).join('')}</div>
    <span class="sep"></span>
    <div class="grp"><label>Contenu</label>\${chip(state.content==='all','Tous','content:all')}\${chip(state.content==='raid','☠️ Raid','content:raid')}\${chip(state.content==='dungeon','🏰 Donjon','content:dungeon')}</div>
    <span class="sep"></span>
    <div class="grp"><label>Compo</label>\${chip(state.team==='all','Toutes','team:all')}\${chip(state.team==='solo','Solo','team:solo')}\${chip(state.team==='team','Équipe','team:team')}</div>
    <span class="sep"></span>
    <div class="grp"><label>ilvl ≥ <b id="ilo">\${state.ilvl}</b></label><input type="range" min="\${ILVL_MIN}" max="\${ILVL_MAX}" value="\${state.ilvl}" id="ilvlr"></div>\`;
  document.querySelectorAll('#filters .chip').forEach(el=>el.onclick=()=>{
    const [k,v]=el.dataset.act.split(':');
    if(k==='cls') state.cls = v===''?null:v;
    else state[k]=v;
    renderFilters(); renderList();
  });
  const r=document.getElementById('ilvlr'); if(r) r.oninput=()=>{state.ilvl=+r.value;document.getElementById('ilo').textContent=r.value;renderList();};
}

function pass(d){
  if(state.cls && !d.classes.includes(state.cls)) return false;
  if(state.content!=='all' && d.contentKind!==state.content) return false;
  if(state.team==='solo' && !d.solo) return false;
  if(state.team==='team' && d.solo) return false;
  if(d.ilvl < state.ilvl) return false;
  return true;
}

function memberCard(m){
  const seg=(lab,items)=>items&&items.length?\`<div class="seg"><div class="lab">\${lab}</div><div class="pills">\${items}</div></div>\`:'';
  const tal=m.talents.map(t=>\`<span class="pill tal" style="background:\${esc(t.color)}22;color:\${esc(t.color)}">\${esc(t.icon)} \${esc(t.name)} ·\${t.points}</span>\`).join('');
  const sp=m.spells.map(s=>\`<span class="pill">\${esc(s.icon)} \${esc(s.name)}</span>\`).join('');
  const gm=m.gems.map(g=>\`<span class="pill">\${esc(g.icon)} \${esc(g.name)}</span>\`).join('');
  const rn=m.runes.map(r=>\`<span class="pill">\${esc(r.icon)} \${esc(r.name)}</span>\`).join('');
  const un=m.uniques.map(u=>\`<span class="pill">✦ \${esc(u.name)}</span>\`).join('');
  return \`<div class="mb">
    <div class="mh"><span class="mn">\${esc(m.clsIcon)} \${esc(m.name)}</span><span class="mtag">\${esc(m.clsLabel)} · N\${m.level} · ilvl \${m.ilvl} · \${m.totalTalents} talents</span>
      <span class="ms"><span><span class="v" style="color:var(--dps)">\${fmt(m.dps)}</span> dps</span><span><span class="v" style="color:var(--ehp)">\${fmt(m.ehp)}</span> survie</span><span><span class="v" style="color:var(--hp)">\${fmt(m.hp)}</span> pv</span></span></div>
    \${seg('Talents',tal)}\${seg('Capacités',sp)}\${seg('Gemmes',gm)}\${seg('Runes',rn)}\${seg('Uniques',un)}
  </div>\`;
}

function renderList(){
  const rows = DATA.filter(pass);
  document.getElementById('bcount').textContent = rows.length;
  const el = document.getElementById('list');
  if(!rows.length){ el.innerHTML='<div class="empty">Aucun build ne correspond à ces filtres.</div>'; return; }
  el.innerHTML = rows.map(d=>\`
    <div class="row \${d.ref?'ref':''}" data-r="\${d.rank}">
      <div class="rhead">
        <span class="rk">\${MEDAL[d.rank]||d.rank}</span>
        <span class="who"><span class="ic">\${esc(d.members.map(m=>m.clsIcon).join(''))}</span><span class="nt">\${esc(d.name)}</span><span class="meta">\${d.ref?'★ référence':esc(d.by)} · \${d.chars} perso\${d.chars>1?'s':''} · niv \${d.level} · ilvl \${d.ilvl} · \${esc(d.contentLabel)}</span></span>
        <span class="stat"><b style="color:var(--dps)">\${fmt(d.dpsTotal)}</b><label>dps</label></span>
        <span class="stat hidesm"><b style="color:var(--ehp)">\${fmt(d.ehpMin)}</b><label>survie</label></span>
        <span class="stat hidesm"><b style="color:var(--hp)">\${fmt(d.members.reduce((a,m)=>a+m.hp,0))}</b><label>hp</label></span>
        <span class="tbadge">T\${d.tmax}</span>
        <span class="chev">▸</span>
      </div>
      <div class="detail">\${d.members.map(memberCard).join('')}</div>
    </div>\`).join('');
  el.querySelectorAll('.rhead').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('open'));
}

renderKpis(); renderFilters(); renderList();
</script>
</body>
</html>`

fs.mkdirSync('dist', { recursive: true })
fs.writeFileSync('dist/leaderboard.html', html)
console.log(`Leaderboard généré : dist/leaderboard.html · ${DATA.length} build(s) · KPI (talents/sorts/gemmes/runes/uniques) · filtres + détail.`)
