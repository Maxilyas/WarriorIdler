/**
 * MÉTIERS DE L'ATELIER (v0.22) — la refonte craft.
 *
 * Quatre métiers, quatre verbes — chacun répond à une question que lui seul résout :
 *  - 🔨 FORGERON   « façonner la matière »   : création, reforge, surillvl, transmutation,
 *                                              ascension + la branche Industrialisation (automates).
 *  - 💎 JOAILLIER  « programmer le combat »  : gemmes de condition (sertissage, broyage, taille, recoupe).
 *  - 🪄 RUNISTE    « tordre temps et règles »: runes (temps + règles).
 *  - ⚗️ ALCHIMISTE « distiller l'essence »   : quintessences + synthèse d'uniques (3 crans de précision).
 *
 * Progression : le NIVEAU (1→25) monte par la PRATIQUE — chaque action du métier donne de l'XP,
 * proportionnelle à la difficulté. 1 niveau = 1 point d'arbre. Les nœuds mêlent déblocages de
 * fonctions et bonus passifs ; les spécialisations (groupes exclusifs) se respéc contre de l'or.
 * Double verrou : le PALIER (bestStage) ouvre le métier et ses nœuds de contenu, l'ARBRE ouvre
 * les fonctions — le Savoir-faire 🔧 d'antan devient l'XP du Forgeron (plus une monnaie).
 */

export type MetierId = 'forgeron' | 'joaillier' | 'runiste' | 'alchimiste'

export interface MetierDef {
  id: MetierId
  name: string
  icon: string
  color: string
  /** Le « verbe » du métier — son identité en une ligne. */
  verb: string
  /** Palier (bestStage) qui ouvre le métier. */
  unlockStage: number
}

export const METIERS: Record<MetierId, MetierDef> = {
  forgeron: { id: 'forgeron', name: 'Forgeron', icon: '🔨', color: '#f59e0b', verb: 'Façonner la matière', unlockStage: 12 },
  joaillier: { id: 'joaillier', name: 'Joaillier', icon: '💎', color: '#38bdf8', verb: 'Programmer le combat', unlockStage: 25 },
  runiste: { id: 'runiste', name: 'Runiste', icon: '🪄', color: '#c084fc', verb: 'Tordre le temps et les règles', unlockStage: 35 },
  alchimiste: { id: 'alchimiste', name: 'Alchimiste', icon: '⚗️', color: '#34d399', verb: 'Distiller l\'essence', unlockStage: 40 },
}

export const METIER_LIST: MetierDef[] = Object.values(METIERS)

/* ------------------------------------------------------------------ */
/* Niveaux & XP                                                        */
/* ------------------------------------------------------------------ */

export const METIER_MAX_LEVEL = 25

/** XP nécessaire pour passer du niveau `level` au suivant (courbe géométrique douce). */
export function xpForNext(level: number): number {
  return Math.round(60 * Math.pow(1.22, level - 1))
}

/** XP cumulée nécessaire pour ATTEINDRE `level` (niveau 1 = 0 XP). */
export function xpTotalForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += xpForNext(l)
  return total
}

/** Niveau atteint avec `xp` d'expérience cumulée. */
export function levelFromXp(xp: number): number {
  let level = 1
  let total = 0
  while (level < METIER_MAX_LEVEL) {
    total += xpForNext(level)
    if (xp < total) break
    level++
  }
  return level
}

/**
 * XP gagnée par opération, proportionnelle à la DIFFICULTÉ (tier de rareté de l'objet/gemme).
 * create > ascend > modify — la formule historique du Savoir-faire, généralisée aux 4 métiers.
 */
export function metierXpGain(tier: number, kind: 'create' | 'ascend' | 'modify', mult = 1): number {
  const base = kind === 'create' ? 2 : kind === 'ascend' ? 3.5 : 0.7
  return Math.max(1, Math.round(base * Math.pow(Math.max(1, tier), 1.3) * mult))
}

/* ------------------------------------------------------------------ */
/* État                                                                */
/* ------------------------------------------------------------------ */

export interface MetierState {
  /** XP cumulée (jamais dépensée — le niveau en découle). */
  xp: number
  /** Rangs appris par nœud d'arbre. */
  nodes: Record<string, number>
}

export type MetiersState = Record<MetierId, MetierState>

export function emptyMetiers(): MetiersState {
  return {
    forgeron: { xp: 0, nodes: {} },
    joaillier: { xp: 0, nodes: {} },
    runiste: { xp: 0, nodes: {} },
    alchimiste: { xp: 0, nodes: {} },
  }
}

/** 1 point d'arbre par niveau, dès le niveau 1 — le métier s'ouvre avec son nœud de base apprenable. */
export function pointsTotal(state: MetierState): number {
  return levelFromXp(state.xp)
}

export function pointsSpent(state: MetierState): number {
  return Object.values(state.nodes).reduce((a, b) => a + b, 0)
}

export function pointsAvailable(state: MetierState): number {
  return pointsTotal(state) - pointsSpent(state)
}

/** Coût (or) d'une remise à zéro de l'arbre — l'XP et le niveau sont conservés. */
export function respecCost(state: MetierState): number {
  const lvl = levelFromXp(state.xp)
  return 20_000 * lvl * lvl
}

/* ------------------------------------------------------------------ */
/* Arbres                                                              */
/* ------------------------------------------------------------------ */

export interface MetierNode {
  id: string
  name: string
  icon: string
  desc: string
  /** 1 = déblocage de fonction ; >1 = bonus à rangs (1 point par rang). */
  maxRank: number
  /** Niveau de métier requis pour apprendre le 1er rang. */
  minLevel?: number
  /** Palier (bestStage) requis — synchronise le craft avec le contenu du jeu. */
  minStage?: number
  /** Nœud parent requis (rang ≥ 1). */
  requires?: string
  /** Groupe d'exclusivité : un seul nœud du groupe peut être appris (spécialisation). */
  exclusive?: string
}

export const METIER_NODES: Record<MetierId, MetierNode[]> = {
  forgeron: [
    { id: 'econome', name: 'Forge économe', icon: '💰', maxRank: 5,
      desc: '−4% des coûts de craft (éclats & matériaux) par rang.' },
    { id: 'surillvl', name: 'Maître affûteur', icon: '⬆️', maxRank: 1, minLevel: 2, minStage: 20,
      desc: 'Débloque le SURILLVL : augmenter l\'iLvl d\'un objet.' },
    { id: 'transmute', name: 'Transmutateur', icon: '🔄', maxRank: 1, minLevel: 3, minStage: 20,
      desc: 'Débloque la TRANSMUTATION : changer la stat primaire d\'un objet.' },
    { id: 'pedagogie', name: 'Pédagogie', icon: '📚', maxRank: 3, minLevel: 4,
      desc: '+20% d\'XP de Forgeron par rang.' },
    { id: 'chance', name: 'Œil du maître', icon: '🎲', maxRank: 5, minLevel: 5,
      desc: '+4% de chance de forger une rareté SUPÉRIEURE par rang (création).' },
    { id: 'ascension', name: 'Grand-maître forgeron', icon: '✨', maxRank: 1, minLevel: 10, minStage: 50, requires: 'surillvl',
      desc: 'Débloque l\'ASCENSION : monter un objet d\'un cran de rareté.' },
    { id: 'automates', name: 'Industrialisation', icon: '🤖', maxRank: 1, minLevel: 12, minStage: 65,
      desc: 'Débloque la construction d\'AUTOMATES (machines qui refont les donjons/raids battus).' },
    { id: 'montage', name: 'Chaîne de montage', icon: '⚙️', maxRank: 3, requires: 'automates',
      desc: '−8% de durée des runs d\'automates par rang.' },
    { id: 'specEconome', name: 'Maître Économe', icon: '🪙', maxRank: 1, minLevel: 15, exclusive: 'forgeron-spec',
      desc: 'SPÉCIALISATION : −15% de coûts de craft supplémentaires. Exclusif avec Maître Visionnaire.' },
    { id: 'specVisionnaire', name: 'Maître Visionnaire', icon: '🔮', maxRank: 1, minLevel: 15, exclusive: 'forgeron-spec',
      desc: 'SPÉCIALISATION : +12% de chance de rareté supérieure, et le surillvl donne +1 iLvl. Exclusif avec Maître Économe.' },
  ],
  joaillier: [
    { id: 'sertissage', name: 'Sertissage', icon: '💎', maxRank: 1,
      desc: 'Débloque le SERTISSAGE : poser des gemmes dans les châsses (Rare+).' },
    { id: 'extraction', name: 'Extraction propre', icon: '🪛', maxRank: 3, requires: 'sertissage',
      desc: '−25% du coût de désertissage par rang.' },
    { id: 'prospection', name: 'Œil du prospecteur', icon: '🔍', maxRank: 3, minLevel: 3,
      desc: '+25% de chance de drop de gemme par rang.' },
    { id: 'broyage', name: 'Broyage', icon: '⚒️', maxRank: 1, minLevel: 5,
      desc: 'Débloque le BROYAGE : réduire une gemme en poussière de gemme.' },
    { id: 'taille', name: 'Taille', icon: '✂️', maxRank: 1, minLevel: 8, requires: 'broyage',
      desc: 'Débloque la TAILLE : façonner la gemme de ton CHOIX contre de la poussière.' },
    { id: 'recoupe', name: 'Recoupe', icon: '🔬', maxRank: 1, minLevel: 12, requires: 'taille',
      desc: 'Débloque la RECOUPE : améliorer les paramètres d\'une gemme, cran par cran.' },
    { id: 'chasseArme', name: 'Châsse forcée', icon: '🕳️', maxRank: 1, minLevel: 20,
      desc: 'Les ARMES gagnent une châsse supplémentaire.' },
    { id: 'specRythme', name: 'Maître du Rythme', icon: '🥁', maxRank: 1, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage',
      desc: 'SPÉCIALISATION : les gemmes de RYTHME portées comptent +1 rang (jusqu\'au max). Exclusif avec les autres familles.' },
    { id: 'specFlux', name: 'Maître du Flux', icon: '🌊', maxRank: 1, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage',
      desc: 'SPÉCIALISATION : les gemmes de FLUX portées comptent +1 rang (jusqu\'au max). Exclusif avec les autres familles.' },
    { id: 'specEnv', name: 'Maître de l\'Environnement', icon: '🌍', maxRank: 1, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage',
      desc: 'SPÉCIALISATION : les gemmes d\'ENVIRONNEMENT portées comptent +1 rang (jusqu\'au max). Exclusif avec les autres familles.' },
  ],
  runiste: [
    { id: 'gravure', name: 'Gravure', icon: '🪄', maxRank: 1,
      desc: 'Débloque la GRAVURE : une rune par pièce d\'équipement (runes de TEMPS).' },
    { id: 'palimpseste', name: 'Palimpseste', icon: '📜', maxRank: 3, requires: 'gravure',
      desc: '−15% du coût de gravure par rang.' },
    { id: 'calligraphie', name: 'Calligraphie', icon: '✒️', maxRank: 3, minLevel: 5,
      desc: '+20% d\'XP de Runiste par rang.' },
    { id: 'regles', name: 'Lois du monde', icon: '⚖️', maxRank: 1, minLevel: 8, minStage: 50, requires: 'gravure',
      desc: 'Débloque les runes de RÈGLE : elles tordent le fonctionnement du jeu (loot, clés, biomes).' },
    { id: 'specChrono', name: 'Chronomancien', icon: '⏳', maxRank: 1, minLevel: 15, exclusive: 'runiste-spec', requires: 'gravure',
      desc: 'SPÉCIALISATION : les runes de TEMPS sont +50% efficaces (Premier élan +75%, Boucle 30 s, Sursis 40 s, Dilatation +75%). Exclusif avec Législateur.' },
    { id: 'specLegislateur', name: 'Législateur', icon: '⚖️', maxRank: 1, minLevel: 15, exclusive: 'runiste-spec', requires: 'regles',
      desc: 'SPÉCIALISATION : les runes de RÈGLE sont amplifiées (Karma /25 kills, Économe 25%, Transmutation ×3). Exclusif avec Chronomancien.' },
  ],
  alchimiste: [
    { id: 'quintessence', name: 'Quintessence', icon: '⚗️', maxRank: 1,
      desc: 'Débloque le craft typé à la QUINTESSENCE (lignes de dégâts / résistance choisies).' },
    { id: 'distillation', name: 'Distillation', icon: '🧪', maxRank: 3,
      desc: '+10% d\'éclats au recyclage par rang.' },
    { id: 'condensation', name: 'Condensation', icon: '💧', maxRank: 3, minLevel: 5,
      desc: '+20% de chance de drop de Quintessence par rang.' },
    { id: 'synthese1', name: 'Synthèse I — Infusion', icon: '✨', maxRank: 1, minLevel: 8, minStage: 80,
      desc: 'Infuser un Fragment d\'éternité : ajoute un effet unique ALÉATOIRE (ou monte son rang).' },
    { id: 'synthese2', name: 'Synthèse II — Essence ciblée', icon: '🧬', maxRank: 1, minLevel: 14, minStage: 80, requires: 'synthese1',
      desc: 'Insérer une essence d\'unique recyclé : un effet SEMI-CIBLÉ (celui de l\'essence).' },
    { id: 'synthese3', name: 'Synthèse III — Invocation', icon: '💫', maxRank: 1, minLevel: 20, minStage: 100, requires: 'synthese2',
      desc: 'L\'acte final du craft : invoquer l\'effet unique de ton CHOIX (Éclats cosmiques).' },
    { id: 'specDistillateur', name: 'Distillateur', icon: '🧪', maxRank: 1, minLevel: 15, exclusive: 'alchimiste-spec', requires: 'distillation',
      desc: 'SPÉCIALISATION : +25% d\'éclats au recyclage et essences d\'uniques ×2. Exclusif avec Transmutateur.' },
    { id: 'specTransmutateur', name: 'Transmutateur', icon: '⚗️', maxRank: 1, minLevel: 15, exclusive: 'alchimiste-spec', requires: 'quintessence',
      desc: 'SPÉCIALISATION : débloque la TRANSMUTATION DE RESSOURCES (♦ ↔ 🌌 / 💠 / ⚗️, à perte — l\'alchimie taxe). Exclusif avec Distillateur.' },
  ],
}

/** Niveau de Forgeron requis pour construire le 1er / 2e / 3e automate (remplace l'ex-coût 🔧). */
export const AUTOMATE_FORGERON_LEVELS = [12, 16, 20]

const NODE_BY_ID: Record<MetierId, Map<string, MetierNode>> = {
  forgeron: new Map(METIER_NODES.forgeron.map((n) => [n.id, n])),
  joaillier: new Map(METIER_NODES.joaillier.map((n) => [n.id, n])),
  runiste: new Map(METIER_NODES.runiste.map((n) => [n.id, n])),
  alchimiste: new Map(METIER_NODES.alchimiste.map((n) => [n.id, n])),
}

export function getMetierNode(metier: MetierId, nodeId: string): MetierNode | undefined {
  return NODE_BY_ID[metier].get(nodeId)
}

/** Rang appris d'un nœud. */
export function nodeRank(metiers: MetiersState, metier: MetierId, nodeId: string): number {
  return metiers[metier].nodes[nodeId] ?? 0
}

/** Peut-on apprendre un rang de ce nœud ? Renvoie la raison du refus sinon. */
export function canLearnNode(
  metiers: MetiersState,
  metier: MetierId,
  nodeId: string,
  bestStage: number,
): { ok: boolean; reason?: string } {
  const def = getMetierNode(metier, nodeId)
  if (!def) return { ok: false, reason: 'Nœud inconnu.' }
  const state = metiers[metier]
  if (bestStage < METIERS[metier].unlockStage) return { ok: false, reason: `Métier verrouillé (palier ${METIERS[metier].unlockStage}).` }
  const rank = state.nodes[nodeId] ?? 0
  if (rank >= def.maxRank) return { ok: false, reason: 'Rang maximal.' }
  if (pointsAvailable(state) < 1) return { ok: false, reason: 'Aucun point disponible — pratique ton métier.' }
  if (def.minLevel && levelFromXp(state.xp) < def.minLevel) return { ok: false, reason: `Niveau de métier ${def.minLevel} requis.` }
  if (def.minStage && bestStage < def.minStage) return { ok: false, reason: `Palier ${def.minStage} requis.` }
  if (def.requires && (state.nodes[def.requires] ?? 0) < 1) {
    const parent = getMetierNode(metier, def.requires)
    return { ok: false, reason: `Requiert « ${parent?.name ?? def.requires} ».` }
  }
  if (def.exclusive) {
    const rival = METIER_NODES[metier].find((n) => n.exclusive === def.exclusive && n.id !== nodeId && (state.nodes[n.id] ?? 0) > 0)
    if (rival) return { ok: false, reason: `Spécialisation déjà choisie : ${rival.name} (respec pour changer).` }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Effets agrégés                                                      */
/* ------------------------------------------------------------------ */

export interface CraftMods {
  /* Forgeron */
  /** Multiplicateur des coûts de craft (≤ 1). */
  costMult: number
  /** Chance de forger une rareté +1 cran (création). */
  luckChance: number
  surillvl: boolean
  /** Gain d'iLvl par surillvl (2, ou 3 en Maître Visionnaire). */
  surillvlStep: number
  transmute: boolean
  ascend: boolean
  automates: boolean
  /** Multiplicateur de durée des runs d'automates (≤ 1). */
  automateDurMult: number
  forgeronXpMult: number
  /* Joaillier */
  gems: boolean
  unsocketCostMult: number
  gemDropMult: number
  /** Châsses bonus sur les armes. */
  weaponSocketBonus: number
  broyage: boolean
  taille: boolean
  recoupe: boolean
  /** ◈ Spécialisation de famille : les gemmes portées de cette famille comptent +1 rang. */
  gemFamilyBonus: 'rythme' | 'flux' | 'environnement' | null
  /* Runiste */
  enchant: boolean
  ruleRunes: boolean
  enchantCostMult: number
  runisteXpMult: number
  /** ◈ Chronomancien : efficacité des runes de TEMPS (1 ou 1.5). */
  runisteTempo: number
  /** ◈ Législateur : runes de RÈGLE amplifiées. */
  loiAmplifiee: boolean
  /* Alchimiste */
  quint: boolean
  /** Bonus multiplicatif d'éclats au recyclage (1 = aucun). */
  recycleMult: number
  quintDropMult: number
  synth1: boolean
  synth2: boolean
  synth3: boolean
  /** ◈ Distillateur : essences d'uniques ×2 au recyclage. */
  distillateur: boolean
  /** ◈ Transmutateur : conversions de ressources débloquées. */
  transmutateur: boolean
}

export function craftMods(metiers: MetiersState): CraftMods {
  const r = (m: MetierId, id: string) => metiers[m].nodes[id] ?? 0
  const visionnaire = r('forgeron', 'specVisionnaire') > 0
  return {
    costMult: Math.max(0.4, 1 - r('forgeron', 'econome') * 0.04 - (r('forgeron', 'specEconome') > 0 ? 0.15 : 0)),
    luckChance: Math.min(0.6, r('forgeron', 'chance') * 0.04 + (visionnaire ? 0.12 : 0)),
    surillvl: r('forgeron', 'surillvl') > 0,
    surillvlStep: visionnaire ? 3 : 2,
    transmute: r('forgeron', 'transmute') > 0,
    ascend: r('forgeron', 'ascension') > 0,
    automates: r('forgeron', 'automates') > 0,
    automateDurMult: 1 - r('forgeron', 'montage') * 0.08,
    forgeronXpMult: 1 + r('forgeron', 'pedagogie') * 0.2,
    gems: r('joaillier', 'sertissage') > 0,
    unsocketCostMult: Math.max(0.25, 1 - r('joaillier', 'extraction') * 0.25),
    gemDropMult: 1 + r('joaillier', 'prospection') * 0.25,
    weaponSocketBonus: r('joaillier', 'chasseArme') > 0 ? 1 : 0,
    broyage: r('joaillier', 'broyage') > 0,
    taille: r('joaillier', 'taille') > 0,
    recoupe: r('joaillier', 'recoupe') > 0,
    gemFamilyBonus: r('joaillier', 'specRythme') > 0 ? 'rythme' : r('joaillier', 'specFlux') > 0 ? 'flux' : r('joaillier', 'specEnv') > 0 ? 'environnement' : null,
    enchant: r('runiste', 'gravure') > 0,
    ruleRunes: r('runiste', 'regles') > 0,
    enchantCostMult: Math.max(0.4, 1 - r('runiste', 'palimpseste') * 0.15),
    runisteXpMult: 1 + r('runiste', 'calligraphie') * 0.2,
    runisteTempo: r('runiste', 'specChrono') > 0 ? 1.5 : 1,
    loiAmplifiee: r('runiste', 'specLegislateur') > 0,
    quint: r('alchimiste', 'quintessence') > 0,
    recycleMult: (1 + r('alchimiste', 'distillation') * 0.1) * (r('alchimiste', 'specDistillateur') > 0 ? 1.25 : 1),
    quintDropMult: 1 + r('alchimiste', 'condensation') * 0.2,
    synth1: r('alchimiste', 'synthese1') > 0,
    synth2: r('alchimiste', 'synthese2') > 0,
    synth3: r('alchimiste', 'synthese3') > 0,
    distillateur: r('alchimiste', 'specDistillateur') > 0,
    transmutateur: r('alchimiste', 'specTransmutateur') > 0,
  }
}

/* ------------------------------------------------------------------ */
/* ◈ Transmutateur : conversions de ressources (à perte — l'alchimie taxe) */
/* ------------------------------------------------------------------ */

export type ConvRes = 'essence' | 'poussiere' | 'noyau' | 'quint'

export interface ConversionDef {
  id: string
  name: string
  from: { res: ConvRes; amt: number }
  to: { res: ConvRes; amt: number }
}

/** Taux volontairement défavorables (aller-retour ≈ ÷2) : un robinet d'appoint, jamais l'optimum. */
export const CONVERSIONS: ConversionDef[] = [
  { id: 'eclatsPoussiere', name: '♦ → 🌌 Poussière d\'étoile', from: { res: 'essence', amt: 400 }, to: { res: 'poussiere', amt: 1 } },
  { id: 'poussiereEclats', name: '🌌 → ♦ Éclats', from: { res: 'poussiere', amt: 1 }, to: { res: 'essence', amt: 200 } },
  { id: 'eclatsNoyau', name: '♦ → 💠 Noyau primordial', from: { res: 'essence', amt: 300 }, to: { res: 'noyau', amt: 1 } },
  { id: 'noyauEclats', name: '💠 → ♦ Éclats', from: { res: 'noyau', amt: 1 }, to: { res: 'essence', amt: 150 } },
  { id: 'eclatsQuint', name: '♦ → ⚗️ Quintessence (au choix)', from: { res: 'essence', amt: 2000 }, to: { res: 'quint', amt: 1 } },
]

export function getConversion(id: string): ConversionDef | undefined {
  return CONVERSIONS.find((c) => c.id === id)
}

/* ------------------------------------------------------------------ */
/* Migration des anciennes sauvegardes (Savoir-faire + forgeUpgrades)  */
/* ------------------------------------------------------------------ */

/** Correspondance ancienne amélioration → (métier, nœud, plafond de rang). */
const LEGACY_MAP: Record<string, { metier: MetierId; node: string; cap: number }> = {
  unlockSurillvl: { metier: 'forgeron', node: 'surillvl', cap: 1 },
  unlockTransmute: { metier: 'forgeron', node: 'transmute', cap: 1 },
  unlockAscend: { metier: 'forgeron', node: 'ascension', cap: 1 },
  forgeCost: { metier: 'forgeron', node: 'econome', cap: 5 },
  forgeLuck: { metier: 'forgeron', node: 'chance', cap: 5 },
  forgeYield: { metier: 'forgeron', node: 'pedagogie', cap: 3 },
  unlockGems: { metier: 'joaillier', node: 'sertissage', cap: 1 },
  unlockEnchant: { metier: 'runiste', node: 'gravure', cap: 1 },
  unlockQuint: { metier: 'alchimiste', node: 'quintessence', cap: 1 },
}

/**
 * Convertit l'ancien duo Savoir-faire 🔧 / forgeUpgrades en état de métiers.
 * Le Savoir-faire devient l'XP du Forgeron ; les achats deviennent des nœuds appris ; chaque
 * métier reçoit assez d'XP pour COUVRIR ses nœuds migrés (personne ne perd rien).
 */
export function migrateLegacyForge(mastery: number, upgrades: Record<string, number>, hasAutomates: boolean): MetiersState {
  const out = emptyMetiers()
  out.forgeron.xp = Math.max(0, Math.round(mastery))
  for (const [oldId, lvl] of Object.entries(upgrades)) {
    const map = LEGACY_MAP[oldId]
    if (!map || lvl <= 0) continue
    out[map.metier].nodes[map.node] = Math.min(map.cap, lvl)
  }
  if (hasAutomates) out.forgeron.nodes.automates = 1
  // Garantit les points : l'XP de chaque métier couvre au moins ses nœuds migrés (1 point/niveau dès le niv. 1).
  for (const m of METIER_LIST) {
    const st = out[m.id]
    const needed = xpTotalForLevel(Math.max(1, pointsSpent(st)))
    if (st.xp < needed) st.xp = needed
  }
  return out
}
