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
  export { runSim, getClassPreset, initTalents, SIM_CLASSES, SIM_RAIDS, SIM_GEMS, SIM_RUNES, SIM_UNIQUES, SIM_SLOTS } from './src/game/simulator.ts'
  export { REFERENCE_BUILDS } from './src/game/referenceBuilds.ts'
  export { decodeBuild } from './src/game/buildCode.ts'
  export { setGlobalCombatMods } from './src/game/character.ts'
  export { getPower, powerSummary } from './src/game/powers.ts'
  export { DAMAGE_TYPES } from './src/game/damage.ts'
  export { TIME_RUNES } from './src/game/enchants.ts'
  export { RARITIES } from './src/game/rarities.ts'
  export { ALL_STAT_META } from './src/game/stats.ts'
  export { getTalent, CONSTELLATIONS, talentsByConstellation } from './src/game/talents.ts'
`)
const {
  runSim, getClassPreset, initTalents, SIM_CLASSES, SIM_RAIDS, SIM_GEMS, SIM_RUNES, SIM_UNIQUES, SIM_SLOTS,
  REFERENCE_BUILDS, decodeBuild, setGlobalCombatMods, getPower, powerSummary, DAMAGE_TYPES, TIME_RUNES, RARITIES, ALL_STAT_META,
  getTalent, CONSTELLATIONS, talentsByConstellation,
} = M
setGlobalCombatMods({ power: 1, attackSpeed: 1, vitality: 1 })

const REPO = 'Maxilyas/WarriorIdler'
const SUBMIT_URL = `https://github.com/${REPO}/issues/new?labels=build-submission&template=build-submission.yml`
const BENCH_CONTENT = { kind: 'raid', id: SIM_RAIDS[0].id, tier: 1, scan: true }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'Md' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

// Résolveurs id → { icon, name } (allégé pour les pills) ; le DÉTAIL complet (description, dégâts,
// recharge, scaling…) est mémorisé dans INFO[cat][nom] → le front affiche une carte au survol.
const gemMap = new Map(SIM_GEMS.map((g) => [g.id, g]))
const uniqueMap = new Map(SIM_UNIQUES.map((u) => [u.id, u]))
const clsMap = new Map(SIM_CLASSES.map((c) => [c.id, c]))
// Runes : indexées par id ('runePremierElan') ET par `time` ('premierElan') → couvre presets ET imports.
const runeInfo = new Map()
for (const r of TIME_RUNES) { const v = { icon: r.icon, name: r.name, desc: r.description }; runeInfo.set(r.id, v); runeInfo.set(r.time, v) }

const KIND_LABEL = { minor: 'Passif mineur', notable: 'Passif notable', keystone: 'Keystone', ability: 'Capacité', gateway: 'Passerelle' }
const INFO = { spell: {}, gem: {}, rune: {}, unique: {}, talent: {} }
const spell = (id) => {
  const p = getPower(id); if (!p) return null
  if (!INFO.spell[p.name]) {
    const s = powerSummary(p), dt = p.damageType ? DAMAGE_TYPES[p.damageType] : null
    INFO.spell[p.name] = { icon: p.icon ?? '•', name: p.name, passive: p.kind !== 'active', desc: p.description,
      effect: s?.effectMeta?.label, targets: s?.effectMeta?.targets, cd: s?.cooldown ?? null, scale: s?.scaleShort ?? null,
      mag: s?.magnitude ?? 0, type: dt ? { name: dt.name, icon: dt.icon, color: dt.color } : null }
  }
  return { icon: p.icon ?? '•', name: p.name }
}
const gem = (id) => { const g = gemMap.get(id); if (!g) return null; if (!INFO.gem[g.name]) INFO.gem[g.name] = { icon: g.icon, name: g.name, kind: g.kind === 'off' ? 'offensive' : 'défensive', color: g.color, desc: g.desc }; return { icon: g.icon, name: g.name } }
const rune = (id) => { const r = runeInfo.get(id); if (!r) return null; if (!INFO.rune[r.name]) INFO.rune[r.name] = { icon: r.icon, name: r.name, desc: r.desc }; return { icon: r.icon, name: r.name } }
const unique = (id) => { const u = uniqueMap.get(id); if (!u) return null; if (!INFO.unique[u.name]) INFO.unique[u.name] = { name: u.name, role: u.role, desc: u.desc }; return { name: u.name } }

// TOUTES les classes de BASE (hors Panthéon) + leurs constellations (racine + archétypes), dérivées des
// constellations : racine = role « … · classe » (tree base) ; archétype rattaché par le préfixe de role
// (« Voleur · … » → voleur). → 6 classes : guerrier, voleur, mage, chasseur, prêtre, druide.
const BASE_CLASSES = []
for (const [cid, m] of Object.entries(CONSTELLATIONS)) {
  if (m.tree === 'pantheon') continue
  if (/·\s*classe$/.test(m.role)) BASE_CLASSES.push({ id: cid, name: m.name, icon: m.icon, color: m.color, cons: [cid] })
}
for (const [cid, m] of Object.entries(CONSTELLATIONS)) {
  if (m.tree === 'pantheon' || !m.archetype) continue
  const cls = BASE_CLASSES.find((c) => m.role.startsWith(c.name + ' ·'))
  if (cls) cls.cons.push(cid)
}
// constellation → classe (pour les KPI de talents par classe) ; méta de classe (icône/nom/couleur).
const constToClass = new Map()
for (const c of BASE_CLASSES) for (const con of c.cons) constToClass.set(con, c.id)
const classMeta = (clsId) => { const m = CONSTELLATIONS[clsId]; return m ? { icon: m.icon, label: m.name, color: m.color } : (clsMap.get(clsId) ?? { icon: '🛡️', label: clsId, color: '#a78bfa' }) }

// CARTE D'ÉQUIPEMENT (imports : vrais items) — par emplacement : item + stat primaire + lignes + gemmes + unique.
function memberEquip(imp) {
  if (!imp?.equipment) return []
  const out = []
  for (const s of SIM_SLOTS) {
    const it = imp.equipment[s.id]; if (!it) continue
    const rar = RARITIES[it.rarity] || { name: it.rarity, color: '#cbd5e1' }
    const lines = (it.affixes || []).map((a) => {
      if (a.kind === 'stat') { const sm = ALL_STAT_META[a.stat]; return { label: '+' + a.value + ' ' + (sm?.short ?? a.stat), color: sm?.color ?? '#cbd5e1' } }
      const dt = DAMAGE_TYPES[a.type]
      return { label: (a.kind === 'resist' ? 'Rés ' : '+') + a.value + '% ' + (dt?.icon ?? a.type), color: dt?.color ?? '#cbd5e1' }
    })
    const pm = ALL_STAT_META[it.primary]
    out.push({
      slot: s.name, slotIcon: s.icon, name: it.name, rarity: rar.name, color: rar.color, ilvl: it.ilvl, stars: it.stars ?? 0,
      primary: pm ? { label: '+' + it.primaryValue + ' ' + (pm.short ?? it.primary), color: pm.color } : null, end: it.endurance ?? 0,
      element: it.damageType ? { icon: DAMAGE_TYPES[it.damageType].icon, name: DAMAGE_TYPES[it.damageType].name, color: DAMAGE_TYPES[it.damageType].color } : null,
      lines, gems: (it.gems || []).map((g) => g.cond).filter(Boolean).map(gem).filter(Boolean), unique: it.unique ? unique(it.unique.id) : null,
    })
  }
  return out
}

// Nœuds de talents ALLOUÉS (arbre de base) + leurs parents alloués → vue radiale du build.
function memberTalentNodes(talents) {
  const out = []
  for (const [id, rank] of Object.entries(talents)) {
    if (!rank || id === 'pa_start') continue
    const node = getTalent(id); if (!node) continue
    const meta = CONSTELLATIONS[node.constellation]
    if (meta?.tree === 'pantheon') continue
    const parents = id === 'co_start' ? [] : [...(node.requires || []), ...(node.requiresAll || [])].filter((r) => (talents[r] ?? 0) > 0)
    const power = node.unlockPower ? (getPower(node.unlockPower)?.name ?? null) : null
    // clé d'INFO talent UNIQUE (nom + rang) → le clic sur un nœud affiche sa carte.
    const key = node.name + (node.maxRank > 1 ? ' (' + rank + '/' + node.maxRank + ')' : '')
    if (!INFO.talent[key]) INFO.talent[key] = { name: node.name, rank, maxRank: node.maxRank, kind: KIND_LABEL[node.kind] ?? node.kind, constellation: meta?.name, color: meta?.color, desc: node.description, power }
    out.push({ id, key, rank, c: node.constellation, tier: node.tier, name: node.name, kind: node.kind, color: meta?.color ?? '#94a3b8', power, parents })
  }
  return out
}

// Compo d'UN membre depuis la config (gère membre importé = vrai Character).
function memberComposition(m, cfg) {
  const imp = m.imported, preset = getClassPreset(m.cls)
  const talents = m.talents ?? (imp ? imp.talents : initTalents(m.cls))
  // 3 groupes de capacités, comme en jeu : actifs / soutien / passifs.
  const resolveGroup = (arr) => (arr ?? []).filter(Boolean).map(spell).filter(Boolean)
  const actives = resolveGroup(m.powers ?? (imp ? imp.powers : preset.powers))
  const support = resolveGroup(m.support ?? (imp ? imp.support : preset.support))
  const passives = resolveGroup(m.passives ?? (imp ? imp.passives : preset.passives))
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
  // classe primaire = classe de base la plus investie (racine + archétypes) ; couvre prêtre/druide et
  // corrige l'étiquette « guerrier » des imports.
  let primary = m.cls, bestN = -1
  for (const c of BASE_CLASSES) {
    const n = c.cons.reduce((a, con) => a + talentsByConstellation(con).reduce((s, node) => s + (talents[node.id] ?? 0), 0), 0)
    if (n > bestN) { bestN = n; primary = c.id }
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
    actives, support, passives, gems: [...gems].map(gem).filter(Boolean),
    runes: [...runes].map(rune).filter(Boolean), uniques: [...uniques].map(unique).filter(Boolean),
    equip: memberEquip(imp), talentNodes: memberTalentNodes(talents) }
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
      talents: c.talentsGrouped, totalTalents: c.totalTalents, actives: c.actives, support: c.support, passives: c.passives,
      gems: c.gems, runes: c.runes, uniques: c.uniques, equip: c.equip, talentNodes: c.talentNodes,
    }
  })
  // Agrégats KPI.
  for (const c of comps) {
    for (const g of c.talentsGrouped) { const clsId = constToClass.get(g.constId); if (clsId) bump(agg.talentsByClass, clsId, g.points) }
    c.actives.forEach((s) => bump(agg.spells, s.name))
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
// Couleur de classe dominante (1er membre) pour le graphe d'archétypes.
DATA.forEach((d) => { const c = d.members[0]?.cls; d.color = CONSTELLATIONS[c]?.color ?? '#a78bfa'; d.clsLabel = d.members[0]?.clsLabel ?? c })

// 2) KPI résolus (top listes + talents par classe).
const topList = (map, n = 6) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }))
const talentsByClass = [...agg.talentsByClass.entries()].sort((a, b) => b[1] - a[1]).map(([cls, points]) => ({ cls, name: classMeta(cls).label, icon: classMeta(cls).icon, points }))
const KPI = {
  builds: DATA.length, classes: BASE_CLASSES.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  talentsByClass, spells: topList(agg.spells), gems: topList(agg.gems), runes: topList(agg.runes), uniques: topList(agg.uniques),
}
const ilvls = DATA.map((d) => d.ilvl)
const ILVL_MIN = Math.min(0, ...ilvls), ILVL_MAX = Math.max(10, ...ilvls)
const today = new Date().toISOString().slice(0, 10)

// 3) Rendu HTML : dashboard épuré — graphe d'archétypes (toggle Niveau), sous-classements, filtres,
// détail au clic, et statistiques de communauté en bas. Front embarqué (DATA/KPI JSON + vanilla JS).
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>⚔ Warrior Idler — Classement des builds</title>
<meta name="description" content="Classement de la communauté Warrior Idler : tier max, DPS, survie, archétypes, talents et sorts populaires. Soumets ton build !">
<style>
  :root{--bg:#0a0f1a;--panel:#111726;--card:#141b2b;--line:#222c3f;--txt:#e6ebf3;--mut:#7886a0;--mut2:#586277;
    --orange:#fb923c;--fuchsia:#e879f9;--dps:#34d399;--ehp:#38bdf8;--hp:#fb7185;--gold:#fbbf24;}
  *{box-sizing:border-box} html{scroll-behavior:smooth}
  body{margin:0;font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--txt);
    background:radial-gradient(900px 500px at 50% -8%,#19223b 0%,var(--bg) 60%) fixed;min-height:100vh;font-size:14px}
  .wrap{max-width:940px;margin:0 auto;padding:22px 16px 72px}
  a{color:inherit}
  .hero{text-align:center;padding:30px 12px 4px}
  .hero h1{margin:0;font-size:clamp(25px,5vw,40px);font-weight:900;letter-spacing:-.02em;
    background:linear-gradient(90deg,var(--orange),var(--fuchsia));-webkit-background-clip:text;background-clip:text;color:transparent}
  .hero .sub{color:var(--mut);margin:8px auto 16px;font-size:13.5px;max-width:560px;line-height:1.5}
  .cta{display:inline-block;text-decoration:none;font-weight:800;color:#1a1206;border-radius:13px;padding:12px 24px;font-size:15px;
    background:linear-gradient(180deg,#fdba74,#f97316)}
  .cta:hover{filter:brightness(1.06)}
  .count{margin-left:10px;color:var(--mut);font-size:13px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:18px}
  h2.sec{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--mut);margin:26px 4px 10px;font-weight:700}

  /* graphe */
  .chart{padding:14px 14px 8px;margin-top:18px}
  .chart .top{display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between;margin-bottom:6px}
  .seg{display:inline-flex;background:#0d1422;border:1px solid var(--line);border-radius:10px;padding:2px}
  .seg button{border:0;background:none;color:var(--mut);font:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer}
  .seg button.on{background:linear-gradient(90deg,var(--orange),var(--fuchsia));color:#1a1206}
  .legend{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--mut)}
  .legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:middle}
  svg.scatter{width:100%;height:300px;display:block}
  .scatter .grid{stroke:#1b2334}
  .ax{fill:var(--mut2);font-size:11px} .axt{fill:var(--mut);font-size:11px;font-weight:600}
  .dot{cursor:pointer;transition:opacity .15s} .dot:hover{opacity:.75}

  /* contrôles */
  .controls{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:11px 14px;margin-top:12px;font-size:13px}
  .controls .grp{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .controls label{color:var(--mut);font-size:12px}
  .chip{cursor:pointer;border:1px solid var(--line);background:#0d1422;color:var(--mut);border-radius:999px;padding:5px 11px;font-size:12px;font-weight:600;user-select:none}
  .chip.on{color:#1a1206;background:linear-gradient(90deg,var(--orange),var(--fuchsia));border-color:transparent}
  .controls input[type=range]{vertical-align:middle;accent-color:var(--orange)}
  .sep{width:1px;height:18px;background:var(--line)}

  /* liste */
  .colhead{display:grid;grid-template-columns:40px 1fr 92px 78px 78px 56px 20px;gap:10px;padding:2px 14px 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut2)}
  .colhead span{text-align:right} .colhead span:nth-child(2){text-align:left} .colhead span:nth-child(6){text-align:center}
  .row{border:1px solid var(--line);border-radius:14px;margin-bottom:8px;overflow:hidden;background:var(--panel)}
  .rhead{display:grid;grid-template-columns:40px 1fr 92px 78px 78px 56px 20px;gap:10px;align-items:center;padding:11px 14px;cursor:pointer}
  .rhead:hover{background:#ffffff05}
  .rk{text-align:center;font-weight:800;color:var(--mut);font-size:15px}
  .who{display:flex;align-items:center;gap:9px;min-width:0}
  .who .av{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex:0 0 auto;border:1px solid var(--line)}
  .who .nt{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .who .meta{display:block;font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .stat{text-align:right;font-variant-numeric:tabular-nums} .stat b{font-size:13.5px} .stat.dim b{color:var(--txt);opacity:.7}
  .stat label{display:block;font-size:9px;color:var(--mut2);text-transform:uppercase;letter-spacing:.05em}
  .tbadge{justify-self:center;font-weight:800;color:#1a1206;background:linear-gradient(90deg,var(--orange),var(--fuchsia));padding:3px 9px;border-radius:999px;font-size:12px}
  .chev{color:var(--mut2);transition:transform .2s} .row.open .chev{transform:rotate(90deg)}
  .detail{display:none;border-top:1px solid var(--line);padding:4px 14px 12px;background:#0d1322} .row.open .detail{display:block}
  .mb{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:10px;background:var(--card)}
  .mb .mh{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline} .mb .mn{font-weight:700} .mb .mtag{font-size:11px;color:var(--mut)}
  .mb .ms{margin-left:auto;display:flex;gap:13px;font-variant-numeric:tabular-nums;font-size:12px} .mb .ms .v{font-weight:700}
  .seg2{margin-top:9px} .seg2 .lab{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut2);margin-bottom:4px}
  .sec{margin-top:9px;border-top:1px solid #161e2b;padding-top:8px} .sec:first-of-type{border-top:0}
  .sec>.lab.tog{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);margin-bottom:5px;cursor:pointer;user-select:none}
  .sec>.lab.tog::before{content:'▾ ';color:var(--mut2)} .sec[data-open="0"]>.lab.tog::before{content:'▸ '}
  .sec[data-open="0"]>.secbody{display:none}
  .pills{display:flex;flex-wrap:wrap;gap:5px} .pill{background:#0d1422;border:1px solid var(--line);border-radius:8px;padding:3px 8px;font-size:12px}
  .treewrap{position:relative;height:300px;background:radial-gradient(60% 60% at 50% 45%,#121a2b,#0b1120);border:1px solid var(--line);border-radius:12px;overflow:hidden;touch-action:none;cursor:grab}
  .treewrap:active{cursor:grabbing} .treewrap svg{width:100%;height:100%;display:block} .treewrap .tnode{cursor:pointer} .treewrap .tnode:hover{stroke:#fff;stroke-width:1.6}
  .tzoom{position:absolute;right:8px;bottom:8px;display:flex;gap:5px} .tzoom button{width:26px;height:26px;border-radius:8px;border:1px solid var(--line);background:#0d1422cc;color:var(--txt);font-size:15px;font-weight:700;cursor:pointer}
  .tzoom button:hover{background:#16203a} .thint{position:absolute;left:8px;top:7px;font-size:9.5px;color:var(--mut2);pointer-events:none}
  .egrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:7px}
  .ecard{background:#0d1422;border:1px solid var(--line);border-radius:10px;padding:7px 9px;font-size:11.5px;border-left-width:3px}
  .ecard .etop{display:flex;gap:6px;align-items:baseline} .ecard .eslot{font-size:13px;flex:0 0 auto} .ecard .ename{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ecard .emeta{color:var(--mut2);font-size:10px;margin:1px 0 4px} .ecard .eprim{font-weight:700;font-size:12px}
  .ecard .elines{display:flex;flex-wrap:wrap;gap:3px 7px;margin-top:3px} .ecard .eline{font-size:10.5px;font-variant-numeric:tabular-nums}
  .ecard .egems{margin-top:4px;display:flex;gap:3px} .ecard .egem{cursor:help} .ecard .euniq{margin-top:4px;color:var(--gold);font-weight:600;font-size:11px;cursor:help}
  .empty{color:var(--mut);text-align:center;padding:18px}

  /* stats communauté */
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
  .kpi{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:13px 15px}
  .kpi h3{margin:0 0 9px;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut)}
  .trow{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:13px}
  .trow .ic{width:18px;text-align:center} .trow .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .trow .ct{color:var(--mut);font-variant-numeric:tabular-nums;font-size:12px}
  .clsbar{height:7px;border-radius:999px;background:#0d1422;overflow:hidden;flex:1} .clsbar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#a855f7,var(--fuchsia))}

  .bigempty{text-align:center;padding:46px 16px;margin-top:18px}
  .bigempty .e{font-size:54px} .bigempty h2{margin:8px 0 4px;font-size:20px} .bigempty p{color:var(--mut);max-width:420px;margin:0 auto 18px}
  footer{text-align:center;color:var(--mut2);font-size:12px;margin-top:30px;line-height:1.7} footer a{color:var(--orange);text-decoration:none}
  .info{cursor:help}
  #tip{position:fixed;left:0;top:0;z-index:60;display:none;max-width:300px;background:#0d1422;border:1px solid #2b3954;border-radius:12px;padding:10px 12px;box-shadow:0 14px 44px -12px #000c;pointer-events:none;font-size:12.5px;line-height:1.5}
  #tip .th{font-weight:700;margin-bottom:3px} #tip .ts{color:var(--mut);font-size:11.5px;margin-bottom:5px} #tip .td{color:#cbd5e1} #tip .tm{color:var(--mut2);font-size:11px;margin-top:6px}
  .tb{display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;background:#1b2436;color:var(--mut);margin-left:4px;vertical-align:middle} .tb.pas{background:#0e2a3a;color:var(--ehp)}
  @media(max-width:680px){.colhead,.rhead{grid-template-columns:32px 1fr 80px 56px 20px}.hidesm{display:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>⚔ Classement des builds</h1>
    <div class="sub">Les builds soumis par la communauté, rejoués sur le <b>même benchmark</b> (${esc(SIM_RAIDS[0].name)}, scan du tier max) via le vrai moteur. Moyenne de 3 simulations.</div>
    <a class="cta" href="${SUBMIT_URL}">🚀 Soumettre mon build</a><span class="count">· <span id="bcount">${DATA.length}</span> build${DATA.length > 1 ? 's' : ''}</span>
  </div>
  <div id="content"></div>
  <footer>
    Généré le ${today} · moteur identique au jeu (<code>runSim</code>).<br>
    Compose ton build dans le <a href="./">simulateur</a>, puis <a href="${SUBMIT_URL}">soumets-le</a> — il apparaîtra ici.
  </footer>
</div>
<div id="tip"></div>

<script>
const DATA = ${JSON.stringify(DATA)};
const KPI = ${JSON.stringify(KPI)};
const INFO = ${JSON.stringify(INFO)};
const ILVL_MIN = ${ILVL_MIN}, ILVL_MAX = ${ILVL_MAX};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n>=1e9?(n/1e9).toFixed(2)+'Md':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':Math.round(n).toString();
const MEDAL = {1:'🥇',2:'🥈',3:'🥉'};
const state = { sort:'tmax', cls:null, content:'all', team:'all', ilvl:ILVL_MIN, chart:'arch' };
const SORTS = { tmax:{lab:'🏆 Tier',key:d=>[d.tmax,d.dpsTotal]}, dps:{lab:'⚔ DPS',key:d=>[d.dpsTotal]}, ehp:{lab:'🛡 Survie',key:d=>[d.ehpMin]} };
const cmp = (a,b)=>{const ka=SORTS[state.sort].key(a),kb=SORTS[state.sort].key(b);for(let i=0;i<ka.length;i++){if(kb[i]!==ka[i])return kb[i]-ka[i];}return 0;};

function pass(d){
  if(state.cls && !d.classes.includes(state.cls)) return false;
  if(state.content!=='all' && d.contentKind!==state.content) return false;
  if(state.team==='solo' && !d.solo) return false;
  if(state.team==='team' && d.solo) return false;
  if(d.ilvl < state.ilvl) return false;
  return true;
}

if(!DATA.length){
  document.getElementById('content').innerHTML = \`<div class="bigempty"><div class="e">🏆</div><h2>Le classement attend son premier build.</h2><p>Compose le tien dans le simulateur en jeu, puis soumets-le — il s'affichera ici avec ses stats et son rang.</p><a class="cta" href="${SUBMIT_URL}">🚀 Soumettre mon build</a></div>\`;
} else {
  document.getElementById('content').innerHTML = \`
    <div class="card chart">
      <div class="top">
        <div class="seg" id="cmode"><button data-m="arch" class="on">Archétypes · DPS ↔ survie</button><button data-m="level">Par niveau · niveau ↔ tier</button></div>
        <div class="legend" id="legend"></div>
      </div>
      <svg class="scatter" id="svg" viewBox="0 0 700 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Nuage de points des builds"></svg>
    </div>

    <h2 class="sec">Classement</h2>
    <div class="card controls">
      <div class="grp"><label>Trier</label><span class="seg" id="sortseg"></span></div>
      <span class="sep"></span>
      <div class="grp" id="fcls"></div>
      <span class="sep"></span>
      <div class="grp" id="fcontent"></div>
      <span class="sep"></span>
      <div class="grp" id="fteam"></div>
      <span class="sep"></span>
      <div class="grp"><label>ilvl ≥ <b id="ilo">\${state.ilvl}</b></label><input type="range" min="\${ILVL_MIN}" max="\${ILVL_MAX}" value="\${state.ilvl}" id="ilvlr"></div>
    </div>
    <div class="colhead"><span>#</span><span>Build</span><span>\${SORTS[state.sort].lab.replace(/^.. /,'')}</span><span class="hidesm">DPS</span><span class="hidesm">Survie</span><span>Tier</span><span></span></div>
    <div id="list"></div>

    <h2 class="sec">📊 Statistiques de la communauté</h2>
    <div class="kpis" id="kpis"></div>\`;
  renderChart(); renderControls(); renderList(); renderKpis();
}

function logScale(v,min,max,a,b){const lv=Math.log10(Math.max(1,v)),lo=Math.log10(Math.max(1,min)),hi=Math.log10(Math.max(10,max));return a+(b-a)*(hi>lo?(lv-lo)/(hi-lo):0.5);}
function linScale(v,min,max,a,b){return a+(b-a)*(max>min?(v-min)/(max-min):0.5);}

function renderChart(){
  const svg=document.getElementById('svg'); if(!svg) return;
  const W=700,H=300,pl=46,pr=18,pt=14,pb=34;
  const mode=state.chart;
  const xv=d=>mode==='arch'?d.dpsTotal:d.level, yv=d=>mode==='arch'?d.ehpMin:d.tmax;
  const xs=DATA.map(xv),ys=DATA.map(yv);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const X=v=>mode==='arch'?logScale(v,xmin,xmax,pl,W-pr):linScale(v,Math.min(xmin,1),xmax,pl,W-pr);
  const Y=v=>mode==='arch'?logScale(v,ymin,ymax,H-pb,pt):linScale(v,0,Math.max(ymax,1),H-pb,pt);
  const xlab=mode==='arch'?'DPS d\\'équipe →':'Niveau de compte →', ylab=mode==='arch'?'↑ Survie (EHP)':'↑ Tier max';
  let g='';
  for(let i=0;i<=4;i++){const y=pt+(H-pb-pt)*i/4;g+=\`<line class="grid" x1="\${pl}" y1="\${y}" x2="\${W-pr}" y2="\${y}" stroke="#1b2334"/>\`;}
  g+=\`<text class="axt" x="\${pl}" y="\${H-8}">\${xlab}</text>\`;
  g+=\`<text class="axt" x="6" y="\${pt+8}" transform="rotate(0)">\${ylab}</text>\`;
  const tier=t=>5+Math.min(7,Math.max(0,t))*0.7;
  const dots=DATA.map(d=>\`<circle class="dot" cx="\${X(xv(d)).toFixed(1)}" cy="\${Y(yv(d)).toFixed(1)}" r="\${tier(d.tmax).toFixed(1)}" fill="\${d.color}" fill-opacity="0.82" stroke="#0a0f1a" stroke-width="1.5"><title>\${esc(d.name)} — \${esc(d.clsLabel)} · T\${d.tmax} · \${fmt(d.dpsTotal)} dps · \${fmt(d.ehpMin)} survie · niv \${d.level}</title></circle>\`).join('');
  svg.innerHTML=g+dots;
  // legend = classes présentes
  const seen={}; DATA.forEach(d=>seen[d.clsLabel]=d.color);
  document.getElementById('legend').innerHTML=Object.entries(seen).map(([n,c])=>\`<span><i style="background:\${c}"></i>\${esc(n)}</span>\`).join('')+'<span style="color:var(--mut2)">· taille = tier</span>';
}

function renderControls(){
  const chip=(on,label,act)=>\`<span class="chip\${on?' on':''}" data-act="\${act}">\${label}</span>\`;
  document.getElementById('sortseg').innerHTML=Object.entries(SORTS).map(([k,v])=>\`<button data-s="\${k}" class="\${state.sort===k?'on':''}" style="border:0;background:\${state.sort===k?'linear-gradient(90deg,var(--orange),var(--fuchsia))':'none'};color:\${state.sort===k?'#1a1206':'var(--mut)'};font:inherit;font-size:12px;font-weight:700;padding:6px 11px;border-radius:8px;cursor:pointer">\${v.lab}</button>\`).join('');
  document.getElementById('fcls').innerHTML='<label>Classe</label>'+chip(state.cls===null,'Toutes','cls:')+KPI.classes.map(c=>chip(state.cls===c.id,esc(c.icon)+' '+esc(c.name),'cls:'+c.id)).join('');
  document.getElementById('fcontent').innerHTML='<label>Contenu</label>'+chip(state.content==='all','Tous','content:all')+chip(state.content==='raid','☠️ Raid','content:raid')+chip(state.content==='dungeon','🏰 Donjon','content:dungeon');
  document.getElementById('fteam').innerHTML='<label>Compo</label>'+chip(state.team==='all','Toutes','team:all')+chip(state.team==='solo','Solo','team:solo')+chip(state.team==='team','Équipe','team:team');
  document.querySelectorAll('#cmode button').forEach(b=>b.onclick=()=>{state.chart=b.dataset.m;document.querySelectorAll('#cmode button').forEach(x=>x.classList.toggle('on',x===b));renderChart();});
  document.querySelectorAll('#sortseg button').forEach(b=>b.onclick=()=>{state.sort=b.dataset.s;renderControls();renderList();});
  document.querySelectorAll('.controls .chip').forEach(el=>el.onclick=()=>{const [k,v]=el.dataset.act.split(':');if(k==='cls')state.cls=v===''?null:v;else state[k]=v;renderControls();renderList();});
  const r=document.getElementById('ilvlr'); if(r) r.oninput=()=>{state.ilvl=+r.value;document.getElementById('ilo').textContent=r.value;renderList();};
}

// Grille d'ÉQUIPEMENT stylisée (par emplacement) : item coloré par rareté + stat primaire + lignes +
// gemmes (survolables) + unique (survolable) + élément d'arme.
function equipGrid(equip){
  if(!equip||!equip.length) return '';
  const cards=equip.map(it=>{
    const lines=it.lines.map(l=>\`<span class="eline" style="color:\${esc(l.color)}">\${esc(l.label)}</span>\`).join('');
    const gems=it.gems.map(g=>\`<span class="egem info" data-cat="gem" data-name="\${esc(g.name)}">\${esc(g.icon)}</span>\`).join('');
    const uniq=it.unique?\`<div class="euniq info" data-cat="unique" data-name="\${esc(it.unique.name)}">✦ \${esc(it.unique.name)}</div>\`:'';
    const elem=it.element?\` · <span style="color:\${esc(it.element.color)}">\${esc(it.element.icon)} \${esc(it.element.name)}</span>\`:'';
    return \`<div class="ecard" style="border-color:\${esc(it.color)}55">
      <div class="etop"><span class="eslot">\${esc(it.slotIcon)}</span><span class="ename" style="color:\${esc(it.color)}">\${esc(it.name)}</span></div>
      <div class="emeta">iL\${it.ilvl} · \${esc(it.rarity)}\${it.stars?' · ⭐'+it.stars:''}\${elem}</div>
      \${it.primary?\`<div class="eprim" style="color:\${esc(it.primary.color)}">\${esc(it.primary.label)}</div>\`:''}
      <div class="elines">\${lines}\${it.end?\`<span class="eline" style="color:#8b97ad">+\${it.end} END</span>\`:''}</div>
      \${gems?\`<div class="egems">\${gems}</div>\`:''}\${uniq}
    </div>\`;
  }).join('');
  return \`<div class="egrid">\${cards}</div>\`;
}

// Corps de l'arbre RADIAL : nœuds alloués (angle=constellation × rayon=tier) reliés à leurs parents,
// dans un <g> transformable (pan/zoom) ; chaque nœud est cliquable (data-cat="talent").
function treeBody(nodes){
  if(!nodes||nodes.length<=1) return '';
  const W=320,H=320,cx=W/2,cy=H/2,R=29;
  const cons=[...new Set(nodes.filter(n=>n.id!=='co_start').map(n=>n.c))];
  const ang={}; cons.forEach((c,i)=>ang[c]=(i/Math.max(1,cons.length))*2*Math.PI - Math.PI/2);
  const pos={co_start:{x:cx,y:cy}};
  const byC={}; nodes.forEach(n=>{ if(n.id==='co_start')return; (byC[n.c]=byC[n.c]||[]).push(n); });
  for(const c in byC){ const byT={}; byC[c].forEach(n=>{(byT[n.tier]=byT[n.tier]||[]).push(n);});
    for(const t in byT){ const arr=byT[t], r=Math.max(1,+t)*R; arr.forEach((n,i)=>{ const sp=(i-(arr.length-1)/2)*0.22; const a=ang[c]+sp; pos[n.id]={x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r}; }); } }
  let lines=''; nodes.forEach(n=>{ (n.parents||[]).forEach(p=>{ if(pos[p]&&pos[n.id]) lines+=\`<line x1="\${pos[p].x.toFixed(1)}" y1="\${pos[p].y.toFixed(1)}" x2="\${pos[n.id].x.toFixed(1)}" y2="\${pos[n.id].y.toFixed(1)}" stroke="#2b3954" stroke-width="1.3"/>\`; }); });
  let dots=\`<circle cx="\${cx}" cy="\${cy}" r="5.5" fill="#e2e8f0"/>\`;
  nodes.forEach(n=>{ if(n.id==='co_start')return; const p=pos[n.id]; if(!p)return; const rr=(n.kind==='keystone'||n.kind==='ability')?6:(n.kind==='notable'||n.kind==='gateway')?4.5:3.4; dots+=\`<circle class="tnode info" data-cat="talent" data-name="\${esc(n.key)}" cx="\${p.x.toFixed(1)}" cy="\${p.y.toFixed(1)}" r="\${rr}" fill="\${n.color}" stroke="#0a0f1a" stroke-width="1"/>\`; });
  return \`<div class="treewrap"><svg viewBox="0 0 \${W} \${H}"><g class="tg">\${lines}\${dots}</g></svg>
    <div class="tzoom"><button data-z="out" aria-label="Dézoomer">−</button><button data-z="in" aria-label="Zoomer">+</button><button data-z="reset" aria-label="Recentrer">⌖</button></div>
    <div class="thint">glisse pour déplacer · molette/boutons pour zoomer · clique un nœud</div></div>\`;
}

function memberCard(m){
  // section pliable : en-tête cliquable (.tog) + corps.
  const section=(label,body,open)=>body?\`<div class="sec" data-open="\${open?1:0}"><div class="lab tog">\${esc(label)}</div><div class="secbody">\${body}</div></div>\`:'';
  const P=(arr,cat)=>arr&&arr.length?\`<div class="pills">\${arr.map(x=>\`<span class="pill info" data-cat="\${cat}" data-name="\${esc(x.name)}">\${esc(x.icon||'✦')} \${esc(x.name)}</span>\`).join('')}</div>\`:'';
  const hasEquip=m.equip&&m.equip.length;
  return \`<div class="mb"><div class="mh"><span class="mn">\${esc(m.clsIcon)} \${esc(m.name)}</span><span class="mtag">\${esc(m.clsLabel)} · N\${m.level} · ilvl \${m.ilvl} · \${m.totalTalents} talents</span>
    <span class="ms"><span><span class="v" style="color:var(--dps)">\${fmt(m.dps)}</span> dps</span><span><span class="v" style="color:var(--ehp)">\${fmt(m.ehp)}</span> survie</span><span><span class="v" style="color:var(--hp)">\${fmt(m.hp)}</span> pv</span></span></div>
    \${section('Capacités actives ('+m.actives.length+')',P(m.actives,'spell'),true)}
    \${section('Soutien ('+m.support.length+')',P(m.support,'spell'),true)}
    \${section('Capacités passives ('+m.passives.length+')',P(m.passives,'spell'),true)}
    \${section('Runes ('+m.runes.length+')',P(m.runes,'rune'),true)}
    \${hasEquip?section('Équipement ('+m.equip.length+')',equipGrid(m.equip),false):(section('Gemmes ('+m.gems.length+')',P(m.gems,'gem'),false)+section('Uniques ('+m.uniques.length+')',P(m.uniques,'unique'),false))}
    \${m.talentNodes&&m.talentNodes.length>1?section('Arbre de talents ('+(m.talentNodes.length-1)+' nœuds)',treeBody(m.talentNodes),false):''}</div>\`;
}

function renderList(){
  const rows=DATA.filter(pass).sort(cmp); rows.forEach((d,i)=>d._r=i+1);
  document.getElementById('bcount').textContent=rows.length;
  const el=document.getElementById('list');
  if(!rows.length){el.innerHTML='<div class="empty">Aucun build ne correspond à ces filtres.</div>';return;}
  const primary=d=>state.sort==='dps'?{v:fmt(d.dpsTotal),l:'dps'}:state.sort==='ehp'?{v:fmt(d.ehpMin),l:'survie'}:{v:'T'+d.tmax,l:'tier'};
  el.innerHTML=rows.map(d=>{const p=primary(d);return \`
    <div class="row" data-r="\${d.rank}">
      <div class="rhead">
        <span class="rk">\${MEDAL[d._r]||d._r}</span>
        <span class="who"><span class="av" style="background:\${d.color}1f;color:\${d.color}">\${esc(d.members[0]?.clsIcon||'⚔️')}</span><span style="min-width:0"><span class="nt">\${esc(d.name)}</span><span class="meta">\${d.ref?'★ réf':esc(d.by)} · \${d.chars} perso\${d.chars>1?'s':''} · niv \${d.level} · ilvl \${d.ilvl} · \${esc(d.contentLabel)}</span></span></span>
        <span class="stat"><b style="color:var(--orange)">\${p.v}</b><label>\${p.l}</label></span>
        <span class="stat dim hidesm"><b style="color:var(--dps)">\${fmt(d.dpsTotal)}</b><label>dps</label></span>
        <span class="stat dim hidesm"><b style="color:var(--ehp)">\${fmt(d.ehpMin)}</b><label>survie</label></span>
        <span class="tbadge">T\${d.tmax}</span>
        <span class="chev">▸</span>
      </div>
      <div class="detail">\${d.members.map(memberCard).join('')}</div>
    </div>\`;}).join('');
  el.querySelectorAll('.rhead').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('open'));
}

function renderKpis(){
  const maxTal=Math.max(1,...KPI.talentsByClass.map(t=>t.points));
  const tl=(arr,cat)=>arr.length?arr.map(x=>{const i=INFO[cat]&&INFO[cat][x.name];return \`<div class="trow info" data-cat="\${cat}" data-name="\${esc(x.name)}"><span class="ic">\${esc((i&&i.icon)||'✦')}</span><span class="nm">\${esc(x.name)}</span><span class="ct">×\${x.count}</span></div>\`;}).join(''):'<div class="ct">—</div>';
  document.getElementById('kpis').innerHTML=\`
    <div class="kpi"><h3>Talents par classe</h3>\${KPI.talentsByClass.length?KPI.talentsByClass.map(t=>\`<div class="trow"><span class="ic">\${esc(t.icon)}</span><span class="nm">\${esc(t.name)}</span><span class="clsbar"><i style="width:\${(t.points/maxTal*100).toFixed(0)}%"></i></span><span class="ct">\${t.points}</span></div>\`).join(''):'<div class="ct">—</div>'}</div>
    <div class="kpi"><h3>Sorts populaires</h3>\${tl(KPI.spells,'spell')}</div>
    <div class="kpi"><h3>Gemmes populaires</h3>\${tl(KPI.gems,'gem')}</div>
    <div class="kpi"><h3>Runes populaires</h3>\${tl(KPI.runes,'rune')}</div>
    <div class="kpi"><h3>Uniques populaires</h3>\${tl(KPI.uniques,'unique')}</div>
  \`;
}

// Carte de DÉTAIL au survol (ou tap) — sur tout élément [data-cat][data-name], depuis INFO.
function tipHtml(cat,name){
  const d=INFO[cat]&&INFO[cat][name]; if(!d) return '';
  if(cat==='spell'){
    const badge=d.passive?'<span class="tb pas">Passif</span>':(d.effect?\`<span class="tb">\${esc(d.effect)}</span>\`:'');
    const type=d.type?\`<span class="tb" style="background:\${d.type.color}22;color:\${d.type.color}">\${esc(d.type.icon)} \${esc(d.type.name)}</span>\`:'';
    const stats=[d.cd!=null?\`⏱ \${d.cd}s\`:'',d.targets?\`🎯 \${esc(d.targets)}\`:'',d.scale?\`📈 \${esc(d.scale)}\`:''].filter(Boolean).join(' · ');
    const mag=d.mag>0?\`<div class="tm">≈ ×\${d.mag.toFixed(1)} de la puissance (scale aussi sur ton profil d'arme)</div>\`:'';
    return \`<div class="th">\${esc(d.icon)} \${esc(d.name)} \${badge}\${type}</div>\${stats?\`<div class="ts">\${stats}</div>\`:''}<div class="td">\${esc(d.desc)}</div>\${mag}\`;
  }
  if(cat==='gem') return \`<div class="th">\${esc(d.icon)} \${esc(d.name)} <span class="tb" style="background:\${d.color}22;color:\${d.color}">\${esc(d.kind)}</span></div><div class="td">\${esc(d.desc)}</div>\`;
  if(cat==='rune') return \`<div class="th">\${esc(d.icon)} \${esc(d.name)}</div><div class="td">\${esc(d.desc)}</div>\`;
  if(cat==='unique') return \`<div class="th">✦ \${esc(d.name)}\${d.role?\` <span class="tb">\${esc(d.role)}</span>\`:''}</div><div class="td">\${esc(d.desc)}</div>\`;
  if(cat==='talent'){
    const rk=d.maxRank>1?\` <span class="tb">\${d.rank}/\${d.maxRank}</span>\`:'';
    const cons=d.constellation?\` <span class="tb" style="background:\${d.color}22;color:\${d.color}">\${esc(d.constellation)}</span>\`:'';
    const pw=d.power?\`<div class="tm">✷ Débloque : \${esc(d.power)}</div>\`:'';
    return \`<div class="th">\${esc(d.name)} <span class="tb">\${esc(d.kind)}</span>\${rk}\${cons}</div><div class="td">\${esc(d.desc||'')}</div>\${pw}\`;
  }
  return '';
}
const tip=document.getElementById('tip');
function showTip(el){const h=tipHtml(el.dataset.cat,el.dataset.name);if(!h){tip.style.display='none';return;}tip.innerHTML=h;tip.style.display='block';}
function moveTip(e){const pad=14,w=tip.offsetWidth,hh=tip.offsetHeight;let x=e.clientX+pad,y=e.clientY+pad;if(x+w>innerWidth-8)x=e.clientX-w-pad;if(y+hh>innerHeight-8)y=e.clientY-hh-pad;tip.style.left=Math.max(8,x)+'px';tip.style.top=Math.max(8,y)+'px';}
document.addEventListener('mouseover',e=>{const t=e.target.closest&&e.target.closest('[data-cat]');if(t){showTip(t);moveTip(e);}});
document.addEventListener('mousemove',e=>{if(tip.style.display==='block')moveTip(e);});
document.addEventListener('mouseout',e=>{const t=e.target.closest&&e.target.closest('[data-cat]');if(t&&!(e.relatedTarget&&t.contains(e.relatedTarget)))tip.style.display='none';});
function pinTip(t){tip._for=t;const r=t.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(r.left,innerWidth-tip.offsetWidth-8))+'px';tip.style.top=(r.bottom+6)+'px';}
// tap sur un item = carte épinglée ; tap ailleurs masque. Les nœuds d'arbre (.tnode) sont gérés par le pan/zoom.
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.tnode'))return;const t=e.target.closest&&e.target.closest('.info[data-cat]');if(t){e.stopPropagation();if(tip.style.display==='block'&&tip._for===t){tip.style.display='none';tip._for=null;}else{showTip(t);pinTip(t);}}else if(!(e.target.closest&&e.target.closest('#tip'))){tip.style.display='none';tip._for=null;}},true);

// PLIAGE des sections (en-tête .tog → bascule .sec[data-open]).
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.lab.tog');if(t){const sec=t.closest('.sec');if(sec)sec.dataset.open=sec.dataset.open==='1'?'0':'1';}});

// ARBRE : pan (glisser) + zoom (molette/boutons) du <g class="tg"> + clic sur un nœud = sa carte.
const tgGet=g=>({tx:+(g.dataset.tx||0),ty:+(g.dataset.ty||0),s:+(g.dataset.s||1)});
const tgSet=(g,st)=>{g.dataset.tx=st.tx;g.dataset.ty=st.ty;g.dataset.s=st.s;g.setAttribute('transform','translate('+st.tx.toFixed(1)+' '+st.ty.toFixed(1)+') scale('+st.s.toFixed(3)+')');};
const tgZoom=(g,f)=>{const st=tgGet(g),ns=Math.max(0.5,Math.min(4,st.s*f)),C=160;st.tx+=(st.s-ns)*C;st.ty+=(st.s-ns)*C;st.s=ns;tgSet(g,st);};
let tdrag=null;
document.addEventListener('pointerdown',e=>{const w=e.target.closest&&e.target.closest('.treewrap');if(!w||(e.target.closest&&e.target.closest('.tzoom')))return;const g=w.querySelector('.tg');if(!g)return;const svg=w.querySelector('svg');const sc=320/((svg&&svg.clientWidth)||320);tdrag={g,x:e.clientX,y:e.clientY,st:tgGet(g),sc,moved:false,node:e.target.closest('.tnode')};try{w.setPointerCapture(e.pointerId)}catch(_){}});
document.addEventListener('pointermove',e=>{if(!tdrag)return;const dx=e.clientX-tdrag.x,dy=e.clientY-tdrag.y;if(Math.abs(dx)>3||Math.abs(dy)>3)tdrag.moved=true;tgSet(tdrag.g,{tx:tdrag.st.tx+dx*tdrag.sc,ty:tdrag.st.ty+dy*tdrag.sc,s:tdrag.st.s});});
document.addEventListener('pointerup',()=>{if(!tdrag)return;if(!tdrag.moved&&tdrag.node){showTip(tdrag.node);pinTip(tdrag.node);}tdrag=null;});
document.addEventListener('wheel',e=>{const w=e.target.closest&&e.target.closest('.treewrap');if(!w)return;e.preventDefault();const g=w.querySelector('.tg');if(g)tgZoom(g,e.deltaY<0?1.15:0.87);},{passive:false});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.tzoom button');if(!b)return;const g=b.closest('.treewrap').querySelector('.tg');if(!g)return;const z=b.dataset.z;if(z==='in')tgZoom(g,1.25);else if(z==='out')tgZoom(g,0.8);else tgSet(g,{tx:0,ty:0,s:1});});
</script>
</body>
</html>`

fs.mkdirSync('dist', { recursive: true })
fs.writeFileSync('dist/leaderboard.html', html)
console.log(`Leaderboard généré : dist/leaderboard.html · ${DATA.length} build(s) · graphe archétypes + sous-classements + filtres + stats.`)
