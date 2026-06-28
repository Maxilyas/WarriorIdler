// MOTEUR GA PARTAGÉ — blindé & extrêmement précis. Utilisé par precondition-map.mjs et ga-optimize.mjs
// (un seul moteur → ils ne peuvent plus diverger). Cf. docs/DIFFICULTE.md §6/§7.
//
// Ce que ce moteur corrige par rapport aux GA d'avant (audit du 28/06/2026) :
//  1. FITNESS MOYENNÉE — le combat est STOCHASTIQUE (esquive + crit, combat.ts) ; on tirait UN seul
//     combat par génome → bruit. Ici on moyenne N combats (winRate + bossLeft moyen), et le VERDICT
//     final passe par une grosse confirmation (confirm()).
//  2. ARBRES ÉVOLUTIFS — l'ancien allocateur glouton était DÉTERMINISTE (mêmes specs+budget → même
//     arbre). Ici chaque membre porte des POIDS PAR NŒUD (`tw`) ; l'allocateur pioche les nœuds VALIDES
//     (canAllocate) par poids décroissant → l'espace des arbres est réellement exploré, toujours valide.
//  3. GÉNOME PAR-PIÈCE — l'ancien mettait la MÊME rareté/⭐/lignes/gemmes sur les 16 slots. Ici CHAQUE
//     pièce a sa rareté, ses ⭐, ses lignes, ses gemmes, son rang de gemme, son unique, son élément.
//  4. RECHERCHE LONGUE — îlots multiples + migration + immigrants aléatoires + arrêt sur CONVERGENCE
//     (le meilleur ne progresse plus depuis `stallGens` générations) → on VOIT que ça a plateauté.
//
// Mode `unconstrained` (défaut) : on fige niveau + ilvl de l'ÉPOQUE du tier, mais on LIBÈRE la qualité
// (rareté/⭐/gemmes max par pièce + empilement d'uniques, dont l'exploit de tags) → BORNE HAUTE absolue.
// Mode contraint (flag) : raretés ≤ plafond de bande, uniques distincts, taggés gatés → carte RÉALISTE.

import { build } from 'esbuild'

/* ------------------------------------------------------------------ */
/* Chargement des modules de jeu (fonctions PURES de src/game).        */
/* ------------------------------------------------------------------ */
export async function loadGame() {
  const loadTs = async (entry) => {
    const res = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
    return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
  }
  return loadTs(`
    export { encodeBuild } from './src/game/buildCode.ts'
    export { runSim, initGear, SIM_GEMS, SIM_SLOTS } from './src/game/simulator.ts'
    export { PLAIN_UNIQUES, TAGGED_UNIQUES } from './src/game/uniques.ts'
    export { talentsByConstellation, canAllocate } from './src/game/talents.ts'
    export { computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel, setGlobalCombatMods } from './src/game/character.ts'
    export { SUPPORT_SLOTS, PASSIVE_SLOTS } from './src/game/character.ts'
    export { getPower, POWER_SLOTS } from './src/game/powers.ts'
    export { stageIlvl } from './src/game/enemies.ts'
    export { RARITY_LIST } from './src/game/rarities.ts'
  `)
}

/* ------------------------------------------------------------------ */
/* Fabrique de moteur (close sur les modules + la config de recherche).*/
/* ------------------------------------------------------------------ */
export function makeEngine(M, cfg = {}) {
  const {
    runSim, initGear, SIM_GEMS, PLAIN_UNIQUES, TAGGED_UNIQUES, talentsByConstellation, canAllocate,
    computeUnlockedPowers, isSupport, isBuilder, talentPointsForLevel, setGlobalCombatMods,
    SUPPORT_SLOTS, PASSIVE_SLOTS, getPower, POWER_SLOTS, stageIlvl, RARITY_LIST,
  } = M

  // ---- Constantes de domaine ----
  const SPEC_TO_CLASS = {
    sentence: 'guerrier', rempart: 'guerrier', juggernaut: 'guerrier', furie: 'guerrier',
    assassin: 'voleur', ombrelame: 'voleur', lamevenin: 'voleur',
    pyromancien: 'mage', cryomancien: 'mage', arcaniste: 'mage', convergence: 'mage',
    meute: 'chasseur', faucon: 'chasseur', symbiose: 'chasseur',
    lumiere: 'pretre', vide: 'pretre', crepuscule: 'pretre',
    floraison: 'druide', lunaire: 'druide', ronce: 'druide', metamorphe: 'druide',
  }
  const ALL_SPECS = Object.keys(SPEC_TO_CLASS)
  const PRIMARIES = ['force', 'agilite', 'intelligence']
  const STAT_OFF = ['maitrise', 'critique', 'degatsCrit', 'hate', 'penetration', 'degatsBoss', 'precision']
  const STAT_DEF = ['reductionDegats', 'resilience', 'barriere', 'recuperation', 'volDeVie']
  const ALL_STATS = [...STAT_OFF, ...STAT_DEF]
  const DMG_TYPES = ['physique', 'feu', 'froid', 'foudre', 'nature', 'arcane', 'ombre']
  const GEM_IDS = SIM_GEMS.map((g) => g.id)
  const COEUR = talentsByConstellation('coeur')
  const PLAIN_IDS = PLAIN_UNIQUES.map((u) => u.id)
  const TAGGED_IDS = TAGGED_UNIQUES.map((u) => u.id)
  const SLOT_COUNT = M.SIM_SLOTS.length

  const rnd = (a) => a[Math.floor(Math.random() * a.length)]
  const rint = (n) => Math.floor(Math.random() * n)
  const randIn = (lo, hi) => lo + rint(hi - lo + 1)
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

  // ---- Mods de compte RÉALISTES (calés save Ch.12). Le combat de compte est minime → eco modeste. ----
  const ecoFor = (stage) => ({
    power: 1 + Math.min(0.10, stage * 0.00054),
    attackSpeed: 1 + Math.min(0.01, stage * 0.000025),
    vitality: 1 + Math.min(0.08, stage * 0.00038),
  })

  /* ---- Contexte d'une cellule (raid × tier) : fige l'époque, fixe les plafonds. ---- */
  function ctxFor(raid, tier, { unconstrained = true } = {}) {
    const stage = (tier + 4) * 10            // Raid T(k) garde le mur du Chapitre (k+4)
    const level = Math.max(1, Math.round(stage * 0.92))
    const ilvl = stageIlvl(stage)
    const pool = talentPointsForLevel(level)
    const eco = ecoFor(stage)
    // Plafonds de QUALITÉ. Non contraint : tout au max + tous les uniques + empilement.
    //   Contraint (réaliste) : raretés ≤ bande, ⭐/gemmes gatées, taggés seulement si accès raid (T≥2),
    //   uniques DISTINCTS sur un nb de pièces ∝ taux de drop.
    const caps = unconstrained
      ? {
          rarityMin: 6, rarityMax: 16, maxStars: 5, maxGemRank: 10, maxGems: 3,
          uniqueChance: 0.85, distinctUniques: false,
          uniquePool: [...PLAIN_IDS, ...TAGGED_IDS], maxUniquePieces: SLOT_COUNT,
        }
      : (() => {
          const rarityCap = Math.min(14, 5 + tier)
          const taggedAccess = tier >= 2
          return {
            rarityMin: 4, rarityMax: rarityCap, maxStars: Math.min(5, 3 + Math.floor(tier / 3)),
            maxGemRank: Math.min(10, 3 + tier), maxGems: 2, uniqueChance: 0.55, distinctUniques: true,
            uniquePool: [...PLAIN_IDS, ...(taggedAccess ? TAGGED_IDS : [])],
            maxUniquePieces: (rt) => Math.max(1, Math.min(8, Math.round(16 * Math.min(1, (rt - 4) * 0.14)))),
          }
        })()
    return { raid, tier, stage, level, ilvl, pool, eco, caps, unconstrained }
  }

  /* ---- Génome : équipe de 1-3 membres. ---- */
  function randomLine() {
    const r = Math.random()
    if (r < 0.5) return { k: 'stat', id: rnd(STAT_OFF) }
    if (r < 0.78) return { k: 'stat', id: rnd(STAT_DEF) }
    return { k: Math.random() < 0.6 ? 'resist' : 'dmg', id: rnd(DMG_TYPES) }
  }
  function randomSlotGene(caps) {
    const rarity = randIn(caps.rarityMin, caps.rarityMax)
    const nLines = randIn(3, 9)
    return {
      rarity, stars: randIn(3, caps.maxStars),
      lines: Array.from({ length: nLines }, randomLine),
      gems: Array.from({ length: rint(caps.maxGems + 1) }, () => rnd(GEM_IDS)),
      gemRank: randIn(Math.max(1, caps.maxGemRank - 3), caps.maxGemRank),
      unique: Math.random() < caps.uniqueChance ? rnd(caps.uniquePool) : null,
      element: Math.random() < 0.25 ? rnd(DMG_TYPES) : null, // surtout pour les armes (porte de vuln)
    }
  }
  // Poids par nœud (arbre évolutif) : remplit le pool des specs, élague le hors-pool.
  function poolFor(specs) {
    const hubs = [...new Set(specs.map((s) => SPEC_TO_CLASS[s]))]
    return [...COEUR, ...hubs.flatMap((h) => talentsByConstellation(h)), ...specs.flatMap((s) => talentsByConstellation(s))]
  }
  function ensureWeights(m) {
    const pool = poolFor(m.specs)
    const tw = {}
    for (const n of pool) tw[n.id] = m.tw?.[n.id] ?? Math.round(Math.random() * 1000) / 1000
    m.tw = tw
  }
  function randomMember(caps) {
    const specs = [...new Set(Array.from({ length: 1 + rint(4) }, () => rnd(ALL_SPECS)))]
    const m = {
      specs, primary: rnd(PRIMARIES), weight: 1 + Math.random() * 2,
      gear: Array.from({ length: SLOT_COUNT }, () => randomSlotGene(caps)), tw: {},
    }
    ensureWeights(m)
    return m
  }
  const randomTeam = (caps) => Array.from({ length: 1 + rint(3) }, () => randomMember(caps))

  /* ---- Allocateur VALIDE piloté par les POIDS du génome (arbre évolutif & déterministe). ---- */
  function allocate(m, budget) {
    const talents = { co_start: 1 }
    const pool = poolFor(m.specs)
    const w = (id) => m.tw[id] ?? 0.5
    let pts = budget
    for (let g = 0; g < 6000 && pts > 0; g++) {
      const cands = pool.filter((n) => canAllocate(n, talents, pts))
      if (!cands.length) break
      // priorité = poids du génome (décroissant), tie-break tier croissant
      cands.sort((a, b) => (w(b.id) - w(a.id)) || (a.tier - b.tier))
      let any = false
      for (const n of cands) {
        if (pts <= 0) break
        if (!canAllocate(n, talents, pts)) continue
        talents[n.id] = (talents[n.id] ?? 0) + 1; pts -= 1; any = true
      }
      if (!any) break
    }
    return talents
  }
  function pickPowers(talents) {
    const defs = computeUnlockedPowers(talents).map((id) => ({ id, p: getPower(id) })).filter((x) => x.p)
    const dmg = defs.filter((x) => x.p.kind === 'active' && !isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
    const supEff = defs.filter((x) => isSupport(x.p) && !isBuilder(x.p)).sort((a, b) => (b.p.magnitude ?? 0) - (a.p.magnitude ?? 0))
    const builders = defs.filter((x) => isBuilder(x.p))
    const pass = defs.filter((x) => x.p.kind === 'passive').sort((a, b) => (b.p.threatMult ?? 1) - (a.p.threatMult ?? 1) || (b.p.damageReduction ?? 0) - (a.p.damageReduction ?? 0))
    const support = []
    for (const id of ['bouclier_runique', 'second_souffle']) if (supEff.some((x) => x.id === id) && support.length < SUPPORT_SLOTS) support.push(id)
    for (const x of [...supEff, ...builders]) if (!support.includes(x.id) && support.length < SUPPORT_SLOTS) support.push(x.id)
    const powers = []
    for (const x of [...dmg, ...supEff]) if (!powers.includes(x.id) && !support.includes(x.id) && powers.length < POWER_SLOTS) powers.push(x.id)
    return { powers, support, passives: pass.slice(0, PASSIVE_SLOTS).map((x) => x.id) }
  }

  /* ---- Génome → SimConfig (par-pièce ; toujours valide). ---- */
  function toConfig(team, ctx) {
    const totalW = team.reduce((a, x) => a + x.weight, 0)
    const members = team.map((m, i) => {
      const budget = Math.max(1, Math.round(ctx.pool * m.weight / totalW))
      const talents = allocate(m, budget)
      const pw = pickPowers(talents)
      const g = initGear('equilibre')
      const slotIds = Object.keys(g)
      // En mode contraint : uniques DISTINCTS sur un nb de pièces réaliste (∝ rareté de la pièce).
      const seen = new Set()
      slotIds.forEach((sid, k) => {
        const gene = m.gear[k] ?? m.gear[m.gear.length - 1]
        let unique = gene.unique || undefined
        if (unique && ctx.caps.distinctUniques) {
          const maxPieces = typeof ctx.caps.maxUniquePieces === 'function' ? ctx.caps.maxUniquePieces(gene.rarity) : ctx.caps.maxUniquePieces
          if (seen.has(unique) || seen.size >= maxPieces) unique = undefined
          else seen.add(unique)
        }
        g[sid] = {
          ...g[sid], ilvl: ctx.ilvl,
          rarity: RARITY_LIST[clamp(gene.rarity, 1, 16) - 1].id, stars: gene.stars,
          lines: gene.lines, gems: gene.gems, gemRank: gene.gemRank,
          ...(unique ? { unique, uniqueRank: 10 } : {}),
          ...(gene.element ? { element: gene.element } : {}),
        }
      })
      return { name: `m${i}`, cls: 'guerrier', level: ctx.level, orientation: 'equilibre', primary: m.primary, gems: [], runes: [], gear: g, talents, powers: pw.powers, support: pw.support, passives: pw.passives }
    })
    return { ilvl: ctx.ilvl, rarity: RARITY_LIST[clamp(ctx.caps.rarityMax, 1, 16) - 1].id, bestStage: ctx.stage, elixir: 'elixirPuissance', team: members }
  }

  /* ---- Combat moyenné (le combat est stochastique → on tire `samples` fois). ---- */
  function sampleCell(cfg, raid, tier, samples) {
    let wins = 0, bossLeftSum = 0, durSum = 0
    for (let i = 0; i < samples; i++) {
      const o = runSim({ ...cfg, content: { kind: 'raid', id: raid, tier, scan: false } }).outcome
      if (o.win) wins++
      bossLeftSum += o.bossLeftPct; durSum += o.dur
    }
    return { winRate: wins / samples, bossLeft: bossLeftSum / samples / 100, dur: durSum / samples }
  }

  /* ---- Fitness. Deux modes :
   *   'cell'     : on vise CE tier → fitness = winRate + progrès (boss bas) ; verdict ✓ si winRate élevé.
   *   'frontier' : on pousse le tier MAX → fitness = dernier tier clear + progrès au mur. ---- */
  function fitness(team, ctx, { mode = 'cell', samples = 11 } = {}) {
    setGlobalCombatMods(ctx.eco)
    const cfg = toConfig(team, ctx)
    if (mode === 'frontier') {
      let last = 0, wallBoss = 1
      for (let t = 1; t <= 15; t++) {
        const s = sampleCell(cfg, ctx.raid, t, Math.max(3, Math.round(samples / 2)))
        if (s.winRate >= 0.6) last = t
        else { wallBoss = s.bossLeft; break }
      }
      return last + (1 - wallBoss) * 0.9
    }
    const s = sampleCell(cfg, ctx.raid, ctx.tier, samples)
    return s.winRate * 1.0 + (1 - s.bossLeft) * 0.5
  }

  /* ---- Verdict de CONFIRMATION (grosse moyenne, indépendante de la recherche). ---- */
  function confirm(team, ctx, n = 60) {
    setGlobalCombatMods(ctx.eco)
    const cfg = toConfig(team, ctx)
    return sampleCell(cfg, ctx.raid, ctx.tier, n)
  }

  /* ---- Opérateurs GA ---- */
  const clone = (m) => JSON.parse(JSON.stringify(m))
  function mutateSlot(gene, caps) {
    const n = clone(gene); const r = Math.random()
    if (r < 0.22) n.rarity = clamp(n.rarity + (Math.random() < 0.5 ? 1 : -1) * randIn(1, 3), caps.rarityMin, caps.rarityMax)
    else if (r < 0.34) n.stars = randIn(3, caps.maxStars)
    else if (r < 0.5) { const i = rint(Math.max(1, n.lines.length)); n.lines[i] = randomLine() }
    else if (r < 0.6) { if (Math.random() < 0.5 && n.lines.length < 9) n.lines.push(randomLine()); else if (n.lines.length > 3) n.lines.splice(rint(n.lines.length), 1) }
    else if (r < 0.7) { if (n.lines.length > 1) { const i = rint(n.lines.length), j = rint(n.lines.length);[n.lines[i], n.lines[j]] = [n.lines[j], n.lines[i]] } } // réordonne (slice par rareté → l'ordre compte)
    else if (r < 0.8) { if (Math.random() < 0.5 && n.gems.length < caps.maxGems) n.gems.push(rnd(GEM_IDS)); else if (n.gems.length) n.gems[rint(n.gems.length)] = rnd(GEM_IDS); else n.gems = [rnd(GEM_IDS)] }
    else if (r < 0.88) n.gemRank = randIn(Math.max(1, caps.maxGemRank - 3), caps.maxGemRank)
    else if (r < 0.96) n.unique = Math.random() < caps.uniqueChance ? rnd(caps.uniquePool) : null
    else n.element = Math.random() < 0.5 ? rnd(DMG_TYPES) : null
    return n
  }
  function mutateMember(m, caps) {
    const n = clone(m); const r = Math.random()
    if (r < 0.2) { // specs (→ change le pool d'arbre)
      if (Math.random() < 0.5 && n.specs.length < 4) n.specs = [...new Set([...n.specs, rnd(ALL_SPECS)])]
      else if (n.specs.length > 1) n.specs.splice(rint(n.specs.length), 1)
      else n.specs = [rnd(ALL_SPECS)]
      ensureWeights(n)
    } else if (r < 0.3) n.primary = rnd(PRIMARIES)
    else if (r < 0.42) n.weight = Math.max(0.5, n.weight + (Math.random() - 0.5))
    else if (r < 0.62) { // PERTURBE l'arbre : déplace les poids de quelques nœuds → keystones différents
      const ids = Object.keys(n.tw); const k = 1 + rint(4)
      for (let i = 0; i < k && ids.length; i++) { const id = rnd(ids); n.tw[id] = clamp(n.tw[id] + (Math.random() - 0.5) * 0.6, 0, 1) }
    } else { // mute 1-3 pièces
      const k = 1 + rint(3)
      for (let i = 0; i < k; i++) { const slot = rint(n.gear.length); n.gear[slot] = mutateSlot(n.gear[slot], caps) }
    }
    return n
  }
  function crossover(a, b, caps) {
    // niveau équipe : pioche des membres dans les deux parents…
    const size = Math.random() < 0.5 ? a.length : b.length
    const poolM = [...a, ...b]
    const team = Array.from({ length: size }, () => clone(rnd(poolM)))
    // …puis crossover par-pièce entre deux membres alignés (mélange du stuff).
    if (team.length >= 1 && Math.random() < 0.5) {
      const m = team[rint(team.length)], donor = clone(rnd(poolM))
      for (let s = 0; s < m.gear.length; s++) if (Math.random() < 0.5) m.gear[s] = clone(donor.gear[s % donor.gear.length])
    }
    return team
  }
  function mutateTeam(t, caps, MUT) {
    let n = t.map((m) => (Math.random() < MUT ? mutateMember(m, caps) : m))
    if (Math.random() < 0.15) { if (n.length < 3 && Math.random() < 0.5) n = [...n, randomMember(caps)]; else if (n.length > 1) n = n.slice(0, -1) }
    return n
  }

  /* ---- Cache de fitness (hash compact ; le combat moyenné est ~stable). ---- */
  function hash(str) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677) } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) }

  /* ================================================================ */
  /* BOUCLE GA — îlots + migration + immigrants + arrêt sur CONVERGENCE */
  /* ================================================================ */
  function runGA(ctx, opts = {}) {
    const {
      islands = 4, pop = 28, elite = 4, tourney = 4, mut = 0.4, immigrants = 2,
      migrateEvery = 8, stallGens = 30, maxGens = 1500, samples = 11, mode = 'cell',
      epsilon = 0.01, onGen = null,
    } = opts
    const caps = ctx.caps
    const cache = new Map()
    let evals = 0
    const fit = (t) => { const k = hash(JSON.stringify(t)); let v = cache.get(k); if (v === undefined) { v = fitness(t, ctx, { mode, samples }); cache.set(k, v); evals++ } return v }

    let pops = Array.from({ length: islands }, () => Array.from({ length: pop }, () => randomTeam(caps)))
    let best = null, lastImprove = 0
    for (let gen = 0; gen < maxGens; gen++) {
      const islandBests = []
      for (let isl = 0; isl < islands; isl++) {
        const scored = pops[isl].map((t) => ({ t, f: fit(t) })).sort((a, b) => b.f - a.f)
        islandBests.push(scored[0])
        const next = scored.slice(0, elite).map((s) => s.t)
        for (let i = 0; i < immigrants; i++) next.push(randomTeam(caps)) // diversité
        while (next.length < pop) {
          const pick = () => { let b = scored[rint(pop)]; for (let i = 1; i < tourney; i++) { const c = scored[rint(pop)]; if (c.f > b.f) b = c } return b.t }
          next.push(mutateTeam(crossover(pick(), pick(), caps), caps, mut))
        }
        pops[isl] = next
      }
      // meilleur global de la génération
      const genBest = islandBests.sort((a, b) => b.f - a.f)[0]
      if (!best || genBest.f > best.f + epsilon) { best = { t: clone(genBest.t), f: genBest.f }; lastImprove = gen }
      if (onGen) onGen({ gen, bestF: best.f, genF: genBest.f, evals, stall: gen - lastImprove })
      // migration : injecte le meilleur global dans chaque île
      if (gen > 0 && gen % migrateEvery === 0) for (let isl = 0; isl < islands; isl++) pops[isl][pop - 1] = clone(best.t)
      // CONVERGENCE : plus de progrès depuis stallGens générations → on s'arrête.
      if (gen - lastImprove >= stallGens) return { best, gens: gen + 1, lastImprove, evals, converged: true }
    }
    return { best, gens: maxGens, lastImprove, evals, converged: false }
  }

  /* ---- Descriptions lisibles ---- */
  function describeTeam(team, ctx) {
    const cfg = toConfig(team, ctx)
    const lines = []
    team.forEach((m, i) => {
      const mc = cfg.team[i]
      const spent = Object.values(mc.talents).reduce((x, y) => x + y, 0) - 1
      const classes = [...new Set(m.specs.map((s) => SPEC_TO_CLASS[s]))]
      const uniqs = [...new Set(m.gear.map((g) => g.unique).filter(Boolean))]
      const rar = m.gear.map((g) => g.rarity)
      lines.push(`  ${m.primary} · [${classes.join('+')}] specs [${m.specs.join(',')}] · ${spent} pts · rareté ${Math.min(...rar)}–${Math.max(...rar)} · ${uniqs.length} uniques distincts`)
      lines.push(`     actifs: ${mc.powers.map((id) => getPower(id)?.name).join(', ')} · soutien: ${mc.support.map((id) => getPower(id)?.name).join(', ') || '—'}`)
    })
    return lines.join('\n')
  }

  return { ctxFor, randomTeam, toConfig, fitness, confirm, runGA, describeTeam, encodeBuild: M.encodeBuild, SPEC_TO_CLASS, RARITY_LIST }
}
