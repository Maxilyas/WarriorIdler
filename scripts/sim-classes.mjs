/**
 * sim-classes.mjs — Simulateur d'équilibrage des CLASSES (refonte v0.29).
 *
 * Reproduit FIDÈLEMENT le moteur du jeu (src/game/stats.ts, damage.ts, combat.ts,
 * character.ts, items.ts) pour estimer le DPS RÉEL de chaque classe proposée, avec :
 *   - un stuff MOYEN (perso ~lvl 50, iLvl 75, Épique)   → colonne "MID"
 *   - un stuff ENDGAME (perso ~lvl 150, iLvl 225, Mythique) → colonne "END"
 *
 * Hypothèses (knobs en tête de fichier — change-les et relance) :
 *   - le joueur CIBLE ses stats (craft/donjons ciblés) → allocation idéale du budget
 *     de lignes secondaires selon les priorités de la classe ;
 *   - l'identité vient des KEYSTONES (arbre), pas des stats rares (laissées au drop) ;
 *   - bonus conditionnels (exécution, PV bas/hauts, ouverture) comptés à une UPTIME moyenne.
 *
 * Lancer : node scripts/sim-classes.mjs
 */

/* ------------------------------------------------------------------ */
/* 1. Constantes & helpers du MOTEUR (copie conforme du code source).   */
/* ------------------------------------------------------------------ */
const PER_PCT = 5000          // stats.ts : RATING_PER_PERCENT(50) × 100
const SECOND_STAT_SHARE = 0.2 // stats.ts : part de la 2e stat offensive
const SLOT_WEIGHT_SUM = 15.2  // somme des poids des 16 emplacements (slots.ts)

const statPower = (v) => 10 + v * 2
function softCap(v, soft, hard) {
  if (v <= soft) return v
  const head = hard - soft
  if (head <= 0) return soft
  const ex = v - soft
  return soft + (head * ex) / (ex + head)
}

/* ------------------------------------------------------------------ */
/* 2. Profils de STUFF (items.ts : budget = ilvl×poids×statMult×qMult).  */
/* ------------------------------------------------------------------ */
// MID : lvl ~50 → stage 50 → iLvl 75 (stageIlvl=stage×1.5), Épique t5, qualité Fin.
// END : lvl ~150 → stage 150 → iLvl 225, Mythique t9, qualité Supérieur.
const GEAR = {
  MID: { ilvl: 75,  tier: 5, statMult: 1.30, qMult: 1.04, affixPerItem: 4, baseStat: 55  },
  END: { ilvl: 225, tier: 9, statMult: 2.95, qMult: 1.08, affixPerItem: 6, baseStat: 155 },
}

/** Budget de stats d'un set complet pour un profil de stuff + une orientation off/def. */
function gearBudget(g, offFrac) {
  const totalBudget = g.ilvl * SLOT_WEIGHT_SUM * g.statMult * g.qMult
  const primaryTotal = totalBudget * offFrac                 // → stat principale (ciblée)
  const enduranceTotal = totalBudget * (1 - offFrac) * 1.9   // items.ts : ×1.9
  const statLines = 16 * g.affixPerItem * 0.62               // ~62% des lignes = stats
  const perLine = g.ilvl * 0.8 * g.statMult * g.qMult        // items.ts rollLineValue (facteur moyen 1.0)
  const secondaryBudget = statLines * perLine
  const dmgLines = 16 * g.affixPerItem * 0.22                // ~22% des lignes = +% type
  return { primaryTotal, enduranceTotal, secondaryBudget, dmgLines }
}

/** Multiplicateur de profil de dégâts pour un build FOCALISÉ sur un type (damage.ts). */
function typeMult(dmgLines, tier, focus) {
  const perLinePct = (14 / 100) * (1 + tier * 0.07)          // DMG_LINE base 14% × croissance tier
  const sumRaw = dmgLines * focus * perLinePct               // part des lignes mise sur SON type
  const bonus = softCap(sumRaw * 0.5, 0.6, 1.2)              // AFFIX_BONUS_SHARE 0.5 + soft cap
  return 1 + bonus
}

/* ------------------------------------------------------------------ */
/* 3. PROFILS de stats secondaires (poids d'allocation par identité).   */
/* ------------------------------------------------------------------ */
// Le moteur : Force→Maîtrise=réduction (pas dps) ; Agi→Maîtrise=dégâts crit ; Int→Maîtrise=dégâts bruts.
// Donc les builds Force/Agi évitent la Maîtrise pour le DPS, les Int la maximisent.
// NB refonte : chaque profil touche les 3 axes multiplicatifs universels (crit, hâte, ampli) pour
// que l'écart entre classes vienne du KEYSTONE, pas d'un accès fortuit à un axe de dégâts.
const SEC = {
  critF:   { crit: 32, dcrit: 22, hate: 30, pen: 16 },                 // Force crit
  haste:   { hate: 40, crit: 28, dcrit: 18, pen: 14 },                 // multistrike/vitesse
  critA:   { crit: 30, dcrit: 20, maitrise: 18, hate: 24, pen: 8 },    // Agi (maîtrise=crit dmg)
  dotI:    { alteration: 42, crit: 18, hate: 20, pen: 12, maitrise: 8 },// DoT (Altération)
  spell:   { maitrise: 30, crit: 22, hate: 24, pen: 14, dcrit: 10 },   // Int dégâts bruts
  boss:    { degatsBoss: 38, crit: 22, hate: 22, pen: 10, dcrit: 8 },  // anti-boss/exécution
  balA:    { crit: 28, hate: 28, maitrise: 18, pen: 16, dcrit: 10 },   // Agi équilibré
  balF:    { crit: 28, hate: 30, pen: 22, dcrit: 20 },                 // Force équilibré
}

/* ------------------------------------------------------------------ */
/* 4. DÉRIVÉES (stats.ts computeDerived) à partir d'une allocation.      */
/* ------------------------------------------------------------------ */
// 'current' = formules du moteur v0.28 (révèle le déséquilibre) ; 'rebalanced' = proposition refonte.
const MASTERY_MODE = process.env.MODE === 'current' ? 'current' : 'rebalanced'
function derive(main, mainVal, secondVal, alloc, ks) {
  const effMain = mainVal + SECOND_STAT_SHARE * secondVal
  const power = statPower(effMain)
  const masteryFrac = (alloc.maitrise ?? 0) / PER_PCT
  let masteryMult = 1, critMult = 2 + (alloc.dcrit ?? 0) / PER_PCT
  if (MASTERY_MODE === 'current') {
    // MOTEUR ACTUEL : Agi→crit ×2/frac NON CAPÉ (runaway) ; Int 0.9 (meilleur brut) ; Force 0.8.
    if (main === 'F') masteryMult = 1 + masteryFrac * 0.8
    else if (main === 'A') { masteryMult = 1 + masteryFrac * 0.45; critMult += masteryFrac * 2 }
    else masteryMult = 1 + masteryFrac * 0.9
  } else {
    // REBALANCÉ : même dégât brut par point pour les 3 stats ; l'identité vient des KEYSTONES.
    // Agi garde un PETIT bonus de crit (saveur), capé pour tuer le runaway.
    masteryMult = 1 + masteryFrac * 0.75
    if (main === 'A') critMult += softCap(masteryFrac * 0.5, 0.8, 1.6)
  }
  const critChance = softCap(0.05 + (alloc.crit ?? 0) / PER_PCT, 0.75, 0.92)
  const aps = 1 + (alloc.hate ?? 0) / PER_PCT
  const alterationMult = 1 + softCap((alloc.alteration ?? 0) / PER_PCT, 3, 5.5)
  const bossMult = 1 + softCap((alloc.degatsBoss ?? 0) / PER_PCT, 2.5, 4.5)
  const overpower = 1 + (ks.surpuissance ?? 0)   // keystone-driven (stat rare laissée au drop)
  const multistrike = ks.ms ?? 0
  return { power, masteryMult, critMult, critChance, aps, alterationMult, bossMult, overpower, multistrike }
}

/* Uptime moyenne des bonus conditionnels (combat idle, packs courts). */
const UPT = { execute: 0.25, lowHp: 0.30, highHp: 0.70, opener: 0.40 }
function condMult(ks, d) {
  let m = 1
  if (ks.dmg) m *= ks.dmg
  if (ks.exec) m *= 1 + (ks.exec.mult - 1) * UPT.execute
  if (ks.lowHp) m *= 1 + (ks.lowHp.mult - 1) * UPT.lowHp
  if (ks.highHp) m *= 1 + (ks.highHp.mult - 1) * UPT.highHp
  if (ks.opener) m *= 1 + (ks.opener.mult - 1) * UPT.opener
  if (ks.spellMult) m *= ks.spellMult
  return m
}

/** DoT keystone : +frac du coup/s, amplifié par l'Altération (~80% d'uptime soutenu). */
function dotMult(ks, d) {
  if (!ks.dot) return 1
  return 1 + ks.dot.frac * d.alterationMult * 0.8
}

/** DPS d'une capacité signature (character.ts abilityDps). */
function abilityDps(sig, d, tMult, dmg) {
  const value = sig.mag * d.power * tMult * dmg
  const cd = Math.max(0.5, sig.cd)
  if (sig.effect === 'nuke' || sig.effect === 'cleave') return value / cd
  if (sig.effect === 'dot') return value * 0.4 * d.alterationMult
  return 0
}

/* ------------------------------------------------------------------ */
/* 5. CATALOGUE DES CLASSES (refonte v0.29 — ≥36 identités).            */
/* main: F/A/I (stat dominante) · hybrid: [main2,frac] · type: focus élément
 * sec: profil d'allocation · ks: keystone d'identité · sig: 1-2 sorts signature
 * tax: part du budget secondaire détournée vers la survie · offFrac: orientation gear
 * ------------------------------------------------------------------ */
const DPS_OFF = 0.78, TANK_OFF = 0.46, HEAL_OFF = 0.52
const dps  = (o) => ({ role: 'DPS',  off: DPS_OFF,  tax: 0.05, ...o })
const tank = (o) => ({ role: 'TANK', off: TANK_OFF, tax: 0.45, ...o })
const heal = (o) => ({ role: 'HEAL', off: HEAL_OFF, tax: 0.50, ...o })

const CLASSES = [
  /* ===== DPS FORCE (mêlée) ===== */
  dps({ name: 'Armes',           wow: 'Arms Warrior',      main: 'F', type: 'physique', sec: SEC.boss,  ks: { exec: { th: 0.35, mult: 2.2 }, dmg: 1.10 }, sig: [{ mag: 4.4, cd: 3.5, effect: 'nuke' }] }),
  dps({ name: 'Fureur',          wow: 'Fury Warrior',      main: 'F', type: 'physique', sec: SEC.haste, ks: { lowHp: { th: 0.5, mult: 1.4 }, ms: 0.20 },   sig: [{ mag: 2.8, cd: 2.5, effect: 'cleave' }] }),
  dps({ name: 'Vindicte',        wow: 'Ret Paladin',       main: 'F', type: 'arcane',   sec: SEC.critF, ks: { dmg: 1.18, exec: { th: 0.2, mult: 1.8 } },   sig: [{ mag: 4.4, cd: 3.0, effect: 'nuke', type: 'arcane' }] }),
  dps({ name: 'Profanateur',     wow: 'Unholy DK',         main: 'F', type: 'ombre',    sec: SEC.dotI,  ks: { dot: { frac: 0.30, dur: 6 }, dmg: 1.10 },    sig: [{ mag: 2.6, cd: 4.5, effect: 'dot', type: 'ombre' }] }),
  dps({ name: 'Givre-mort',      wow: 'Frost DK',          main: 'F', type: 'froid',    sec: SEC.critF, ks: { dmg: 1.15, ms: 0.12 },                       sig: [{ mag: 4.0, cd: 3.5, effect: 'nuke', type: 'froid' }] }),

  /* ===== DPS AGILITÉ ===== */
  dps({ name: 'Maître des bêtes', wow: 'BM Hunter',        main: 'A', type: 'nature',   sec: SEC.balA,  ks: { dmg: 1.22 },                                  sig: [{ mag: 3.0, cd: 3.0, effect: 'cleave', type: 'nature' }] }),
  dps({ name: 'Tireur d\'élite',  wow: 'MM Hunter',        main: 'A', type: 'physique', sec: SEC.critA, ks: { dmg: 1.15, exec: { th: 0.2, mult: 2 } },      sig: [{ mag: 3.4, cd: 2.5, effect: 'nuke' }] }),
  dps({ name: 'Pisteur',          wow: 'Survival Hunter',  main: 'A', type: 'nature',   sec: SEC.dotI,  ks: { dot: { frac: 0.25, dur: 5 }, dmg: 1.12 },     sig: [{ mag: 2.2, cd: 4.0, effect: 'dot', type: 'nature' }] }),
  dps({ name: 'Assassin',         wow: 'Assa Rogue',       main: 'A', type: 'nature',   sec: SEC.dotI,  ks: { dot: { frac: 0.35, dur: 6 }, dmg: 1.10 },     sig: [{ mag: 2.6, cd: 4.0, effect: 'dot', type: 'nature' }] }),
  dps({ name: 'Flibustier',       wow: 'Outlaw Rogue',     main: 'A', type: 'physique', sec: SEC.haste, ks: { ms: 0.25, surpuissance: 0.30 },              sig: [{ mag: 5.0, cd: 3.5, effect: 'nuke' }] }),
  dps({ name: 'Lame des ombres',  wow: 'Sub Rogue',        main: 'A', type: 'ombre',    sec: SEC.critA, ks: { opener: { mult: 1.8, sec: 5 }, dmg: 1.10 },  sig: [{ mag: 7.5, cd: 12, effect: 'nuke', type: 'ombre' }] }),
  dps({ name: 'Marche-vent',      wow: 'Windwalker Monk',  main: 'A', type: 'physique', sec: SEC.haste, ks: { ms: 0.18, dmg: 1.12 },                       sig: [{ mag: 3.0, cd: 2.5, effect: 'cleave' }] }),
  dps({ name: 'Druide félin',     wow: 'Feral Druid',      main: 'A', type: 'nature',   sec: SEC.dotI,  ks: { dot: { frac: 0.30, dur: 6 }, dmg: 1.08 },     sig: [{ mag: 2.4, cd: 4.0, effect: 'dot', type: 'nature' }] }),
  dps({ name: 'Traqueur du Fléau',wow: 'Havoc DH',         main: 'A', type: 'feu',      sec: SEC.balA,  ks: { dmg: 1.20, ms: 0.10 },                       sig: [{ mag: 3.4, cd: 2.8, effect: 'cleave', type: 'feu' }] }),

  /* ===== DPS INTELLIGENCE (sorts) ===== */
  dps({ name: 'Pyromancien',     wow: 'Fire Mage',         main: 'I', type: 'feu',      sec: SEC.spell, ks: { dmg: 1.15, dot: { frac: 0.22, dur: 5 } },    sig: [{ mag: 3.8, cd: 2.5, effect: 'nuke', type: 'feu' }] }),
  dps({ name: 'Cryomancien',     wow: 'Frost Mage',        main: 'I', type: 'froid',    sec: SEC.spell, ks: { dmg: 1.10, exec: { th: 0.35, mult: 2 } },    sig: [{ mag: 3.4, cd: 2.8, effect: 'cleave', type: 'froid' }] }),
  dps({ name: 'Arcaniste',       wow: 'Arcane Mage',       main: 'I', type: 'arcane',   sec: SEC.spell, ks: { dmg: 1.25 },                                  sig: [{ mag: 5.2, cd: 6, effect: 'nuke', type: 'arcane' }] }),
  dps({ name: 'Démoniste effroi',wow: 'Affli Warlock',     main: 'I', type: 'ombre',    sec: SEC.dotI,  ks: { dot: { frac: 0.35, dur: 6 }, dmg: 1.20 },     sig: [{ mag: 2.6, cd: 4.5, effect: 'dot', type: 'ombre' }] }),
  dps({ name: 'Invocateur',      wow: 'Demo Warlock',      main: 'I', type: 'ombre',    sec: SEC.spell, ks: { dmg: 1.22 },                                  sig: [{ mag: 3.0, cd: 3.0, effect: 'cleave', type: 'ombre' }] }),
  dps({ name: 'Destructeur',     wow: 'Destro Warlock',    main: 'I', type: 'feu',      sec: SEC.spell, ks: { dmg: 1.15, surpuissance: 0.30 },              sig: [{ mag: 5.2, cd: 6, effect: 'nuke', type: 'feu' }] }),
  dps({ name: 'Élémentaliste',   wow: 'Ele Shaman',        main: 'I', type: 'foudre',   sec: SEC.spell, ks: { dmg: 1.18 },                                  sig: [{ mag: 3.8, cd: 3.2, effect: 'cleave', type: 'foudre' }] }),
  dps({ name: 'Chaman amélio.', wow: 'Enh Shaman',        main: 'A', type: 'foudre',   sec: SEC.haste, ks: { ms: 0.18, dmg: 1.12 },                       sig: [{ mag: 3.0, cd: 3.2, effect: 'cleave', type: 'foudre' }] }),
  dps({ name: 'Lunaire',         wow: 'Balance Druid',     main: 'I', type: 'arcane',   sec: SEC.spell, ks: { dmg: 1.18, dot: { frac: 0.18, dur: 5 } },    sig: [{ mag: 4.4, cd: 3.0, effect: 'nuke', type: 'arcane' }] }),
  dps({ name: 'Ombremancien',    wow: 'Shadow Priest',     main: 'I', type: 'ombre',    sec: SEC.dotI,  ks: { dot: { frac: 0.30, dur: 6 }, dmg: 1.15 },     sig: [{ mag: 2.6, cd: 4.5, effect: 'dot', type: 'ombre' }] }),
  dps({ name: 'Dévastateur',     wow: 'Deva Evoker',       main: 'I', type: 'feu',      sec: SEC.spell, ks: { dmg: 1.20 },                                  sig: [{ mag: 5.2, cd: 6, effect: 'nuke', type: 'feu' }] }),

  /* ===== TANKS ===== */
  tank({ name: 'Gardien',         wow: 'Prot Warrior',     main: 'F', type: 'physique', sec: SEC.balF, ks: { dmg: 1.05, thorns: 0.2 },                      sig: [{ mag: 2.4, cd: 3.2, effect: 'cleave' }] }),
  tank({ name: 'Croisé-Bouclier', wow: 'Prot Paladin',     main: 'F', type: 'arcane',   sec: SEC.balF, ks: { dmg: 1.05 },                                   sig: [{ mag: 2.4, cd: 3.0, effect: 'nuke', type: 'arcane' }] }),
  tank({ name: 'Chevalier de sang',wow: 'Blood DK',        main: 'F', type: 'ombre',    sec: SEC.balF, ks: { dmg: 1.08 },                                   sig: [{ mag: 2.6, cd: 3.5, effect: 'nuke', type: 'ombre' }] }),
  tank({ name: 'Maître brasseur', wow: 'Brewmaster Monk',  main: 'A', type: 'nature',   sec: SEC.balA, ks: { dmg: 1.05 },                                   sig: [{ mag: 2.4, cd: 3.0, effect: 'cleave', type: 'nature' }] }),
  tank({ name: 'Gardien sylvestre',wow: 'Guardian Druid',  main: 'F', type: 'nature',   sec: SEC.balF, ks: { dmg: 1.05, highHp: { th: 0.6, mult: 1.2 } },  sig: [{ mag: 2.4, cd: 3.5, effect: 'cleave', type: 'nature' }] }),
  tank({ name: 'Chasseur de démons',wow: 'Vengeance DH',   main: 'A', type: 'feu',      sec: SEC.balA, ks: { dmg: 1.10, thorns: 0.25 },                     sig: [{ mag: 2.6, cd: 3.0, effect: 'cleave', type: 'feu' }] }),
  tank({ name: 'Colosse',         wow: 'Juggernaut',       main: 'F', type: 'physique', sec: SEC.balF, ks: { highHp: { th: 0.6, mult: 1.3 }, dmg: 1.05 },  sig: [{ mag: 2.4, cd: 3.5, effect: 'cleave' }], hybrid: ['endurance', 0.35] }),

  /* ===== HEALERS ===== (DPS faible par design ; voir colonne HPS) */
  heal({ name: 'Prêtre sacré',    wow: 'Holy Priest',      main: 'I', type: 'arcane',   sec: SEC.spell, ks: { hot: 0.4 },  sig: [{ mag: 2.8, cd: 5, effect: 'nuke', type: 'arcane' }], healMag: 2.8, healCd: 4 }),
  heal({ name: 'Disciple',        wow: 'Disc Priest',      main: 'I', type: 'ombre',    sec: SEC.spell, ks: { healToDamage: 0.6, dmg: 1.05 }, sig: [{ mag: 3.0, cd: 3, effect: 'nuke', type: 'ombre' }], healMag: 1.8, healCd: 4 }),
  heal({ name: 'Druide réparateur',wow: 'Resto Druid',     main: 'I', type: 'nature',   sec: SEC.dotI,  ks: { hot: 0.5 },  sig: [{ mag: 1.8, cd: 5, effect: 'dot', type: 'nature' }], healMag: 1.4, healCd: 3, hot: true }),
  heal({ name: 'Chaman restaur.', wow: 'Resto Shaman',     main: 'I', type: 'foudre',   sec: SEC.spell, ks: { hot: 0.3 },  sig: [{ mag: 2.4, cd: 4, effect: 'cleave', type: 'foudre' }], healMag: 2.0, healCd: 4 }),
  heal({ name: 'Paladin sacré',   wow: 'Holy Paladin',     main: 'F', type: 'arcane',   sec: SEC.balF,  ks: { hot: 0.25 }, sig: [{ mag: 2.4, cd: 3, effect: 'nuke', type: 'arcane' }], healMag: 2.8, healCd: 5 }),
  heal({ name: 'Tisse-brume',     wow: 'Mistweaver Monk',  main: 'A', type: 'nature',   sec: SEC.balA,  ks: { hot: 0.3, dmg: 1.05 }, sig: [{ mag: 2.4, cd: 2.5, effect: 'cleave', type: 'nature' }], healMag: 1.6, healCd: 3, fistweave: true }),
  heal({ name: 'Préservateur',    wow: 'Pres Evoker',      main: 'I', type: 'feu',      sec: SEC.spell, ks: { hot: 0.35 }, sig: [{ mag: 2.6, cd: 5, effect: 'nuke', type: 'feu' }], healMag: 2.6, healCd: 4 }),
]

/* ------------------------------------------------------------------ */
/* 6. Calcul du DPS (+ EHP, + HPS) pour un profil de stuff.             */
/* ------------------------------------------------------------------ */
function simulate(cls, g) {
  const gb = gearBudget(g, cls.off)
  // Stat principale (+ base de niveau). Hybrides : une 2e stat à 35% du budget.
  let mainVal = gb.primaryTotal + g.baseStat, secondVal = 0
  if (cls.hybrid) {
    if (cls.hybrid[0] === 'endurance') secondVal = gb.enduranceTotal * cls.hybrid[1] // Endurance→offense (Colosse)
    else { secondVal = mainVal * cls.hybrid[1]; mainVal *= (1 - cls.hybrid[1]) }
  }
  // Allocation du budget secondaire selon le profil (moins la taxe survie).
  const offBudget = gb.secondaryBudget * (1 - cls.tax)
  const w = cls.sec, sumW = Object.values(w).reduce((a, b) => a + b, 0)
  const alloc = {}
  for (const k in w) alloc[k] = offBudget * (w[k] / sumW)

  const d = derive(cls.main, mainVal, secondVal, alloc, cls.ks)
  const tMult = typeMult(gb.dmgLines, g.tier, 0.70)
  const avgCrit = 1 + d.critChance * (d.critMult - 1)

  // Auto-attaque (combat.ts theoreticalDps) × conditionnels × DoT keystone.
  let auto = d.power * d.masteryMult * d.overpower * avgCrit * d.aps * tMult * (1 + d.multistrike)
  auto *= condMult(cls.ks, d)
  auto *= dotMult(cls.ks, d)
  // Dégâts vs boss/élite : ~35% du temps de combat en farm idle (boss de palier, élites, donjons).
  auto *= 1 + (d.bossMult - 1) * 0.35

  // Capacités signature.
  let sig = 0
  for (const s of (cls.sig ?? [])) sig += abilityDps(s, d, tMult, cls.ks.dmg ?? 1)

  const dpsTotal = auto + sig

  // EHP : PV ÷ atténuation générique (endurance + réduction Force). Approx.
  const hp = 100 + (gb.enduranceTotal + g.baseStat) * 12
  const masteryDr = cls.main === 'F' ? softCap((alloc.maitrise ?? 0) / PER_PCT * 0.85, 0.5, 0.7) : 0
  const mitig = Math.max(0.2, (1 - masteryDr) * (cls.role === 'TANK' ? 0.6 : 1)) // tanks : passives -40%
  const ehp = hp / mitig

  // HPS (healers) : magnitude × power × (1+hot) / cd, + heal→dégâts éventuel.
  let hps = 0
  if (cls.role === 'HEAL') {
    const hot = 1 + (cls.ks.hot ?? 0)
    hps = (cls.healMag * d.power * hot) / Math.max(1, cls.healCd)
    if (cls.fistweave) hps += auto * 0.5   // Tisse-brume : attaquer soigne
    if (cls.ks.healToDamage) hps *= 1.0    // Disciple : son "heal" est surtout du dégât (déjà dans dps)
  }
  return { dps: dpsTotal, auto, sig, ehp, hps, power: d.power, tMult, avgCrit, aps: d.aps }
}

/* ------------------------------------------------------------------ */
/* 7. Sortie.                                                          */
/* ------------------------------------------------------------------ */
function fmt(n) { return Math.round(n).toLocaleString('en-US') }
function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length) }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s }

function table(role) {
  const rows = CLASSES.filter((c) => c.role === role).map((c) => {
    const mid = simulate(c, GEAR.MID), end = simulate(c, GEAR.END)
    return { c, mid, end }
  })
  rows.sort((a, b) => b.end.dps - a.end.dps)
  // Indices relatifs (100 = médiane DPS de la catégorie, stuff END).
  const med = [...rows].map((r) => r.end.dps).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
  console.log(`\n=== ${role} ===`)
  console.log(pad('Classe', 18) + pad('Inspi WoW', 17) + pad('Stat', 5) + pad('Type', 9) +
    padL('DPS MID', 11) + padL('DPS END', 12) + padL('idx', 6) + padL('EHP END', 11) + (role === 'HEAL' ? padL('HPS END', 11) : ''))
  for (const { c, mid, end } of rows) {
    const idx = Math.round((end.dps / med) * 100)
    console.log(
      pad(c.name, 18) + pad(c.wow, 17) + pad({ F: 'FOR', A: 'AGI', I: 'INT' }[c.main], 5) +
      pad(c.type, 9) + padL(fmt(mid.dps), 11) + padL(fmt(end.dps), 12) + padL(idx, 6) +
      padL(fmt(end.ehp), 11) + (role === 'HEAL' ? padL(fmt(end.hps), 11) : ''))
  }
  const hi = rows[0].end.dps, lo = rows[rows.length - 1].end.dps
  console.log(`  → écart END : ×${(hi / lo).toFixed(2)} (top ${fmt(hi)} / bottom ${fmt(lo)})  — idéal < ×1.6`)
}

console.log('SIMULATION DES CLASSES — refonte v0.29  (DPS moteur-exact, hypothèses en tête de fichier)')
console.log(`Stuff MID = lvl~50 / iLvl ${GEAR.MID.ilvl} / Épique   |   Stuff END = lvl~150 / iLvl ${GEAR.END.ilvl} / Mythique`)
table('DPS')
table('TANK')
table('HEAL')

/* ------------------------------------------------------------------ */
/* 8. BUILDS HYBRIDES (mix de 2 classes : on combine leurs keystones).  */
/* ------------------------------------------------------------------ */
function findC(name) { return CLASSES.find((c) => c.name === name) }
function hybrid(name, aName, bName, mix) {
  const a = findC(aName), b = findC(bName)
  // mélange : stat principale de A, profil sec de A, + keystone offensif de B greffé.
  const merged = { ...a, name, ks: { ...a.ks, ...mix } }
  return merged
}

const HYBRIDS = [
  hybrid('Lame-Sang (Sub×Affli)',      'Lame des ombres', 'Démoniste effroi', { dot: { frac: 0.30, dur: 6 } }),
  hybrid('Pyro-Boss (Fire×Arms)',      'Pyromancien',     'Armes',            { exec: { th: 0.35, mult: 2.2 } }),
  hybrid('Berserker-Givre (Fury×FrostDK)','Fureur',       'Givre-mort',       { dmg: 1.15 }),
  hybrid('Assassin-Vitesse (Assa×WW)', 'Assassin',        'Marche-vent',      { ms: 0.18 }),
  hybrid('Arcane-Surp (Arcane×Destro)','Arcaniste',       'Destructeur',      { surpuissance: 0.30 }),
  hybrid('Croisé-DPS (ProtPal×Ret)',   'Croisé-Bouclier', 'Vindicte',         { dmg: 1.18, off: 0.62, tax: 0.25 }),
]

console.log('\n=== HYBRIDES (mix de 2 classes) ===')
console.log(pad('Build', 30) + pad('Stat', 5) + padL('DPS MID', 11) + padL('DPS END', 12))
for (const h of HYBRIDS) {
  // un hybride peut surcharger off/tax
  if (h.ks.off != null) h.off = h.ks.off
  if (h.ks.tax != null) h.tax = h.ks.tax
  const mid = simulate(h, GEAR.MID), end = simulate(h, GEAR.END)
  console.log(pad(h.name, 30) + pad({ F: 'FOR', A: 'AGI', I: 'INT' }[h.main], 5) + padL(fmt(mid.dps), 11) + padL(fmt(end.dps), 12))
}
