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

import type { ItemType, SecondaryStat } from './types'

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

/* ------------------------------------------------------------------ */
/* Compagnonnages du Forgeron (v0.26) — spécialisation par TYPE de pièce */
/* ------------------------------------------------------------------ */

export type CorpsId = 'heaumier' | 'cuirassier' | 'equipementier' | 'orfevre'

export interface CorpsDef {
  id: CorpsId
  name: string
  icon: string
  /** Types de pièces couverts (les ARMES restent hors spé — jugées bien réglées). */
  types: ItemType[]
  /** Affixes « Signature » (étage III) : garantis au CHOIX sur ces pièces. */
  signatures: SecondaryStat[]
}

export const CORPS: Record<CorpsId, CorpsDef> = {
  heaumier: { id: 'heaumier', name: 'Heaumier', icon: '🪖', types: ['tete', 'epaules'], signatures: ['critique', 'tenacite'] },
  cuirassier: { id: 'cuirassier', name: 'Cuirassier', icon: '🥋', types: ['torse', 'jambes', 'armeSecondaire'], signatures: ['reductionDegats', 'barriere'] },
  equipementier: { id: 'equipementier', name: 'Équipementier', icon: '🧤', types: ['mains', 'poignets', 'taille', 'pieds', 'cape'], signatures: ['hate', 'esquive'] },
  orfevre: { id: 'orfevre', name: 'Orfèvre', icon: '💍', types: ['cou', 'anneau', 'bijou'], signatures: ['alteration', 'precision'] },
}

export const CORPS_LIST: CorpsDef[] = Object.values(CORPS)

export function corpsOfType(type: ItemType): CorpsDef | undefined {
  return CORPS_LIST.find((c) => c.types.includes(type))
}

/** Coût en Lingots 🧱 de l'affixe Signature (étage III) selon la rareté visée. */
export function signatureLingotCost(rarityTier: number): number {
  return Math.max(1, rarityTier - 4)
}

/** Coût en Lingots 🧱 du Chef-d'œuvre hebdomadaire (étage V). */
export const MASTERWORK_LINGOTS = 10

/** Lingots 🧱 rendus par la FONTE d'un objet (tier ≥ 4 ; le reste ne vaut pas le feu). */
export function smeltLingots(rarityTier: number): number {
  return Math.max(0, rarityTier - 3)
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

// v0.26 : 25 → 50. La courbe reste IDENTIQUE jusqu'au niveau 25 (aucun joueur ne perd rien),
// puis s'adoucit (×1,15/niv au lieu de ×1,22) — les nouveaux niveaux nourrissent des arbres
// de 70-90 rangs où l'on ne peut PAS tout prendre (vrais choix, respec par branche).
export const METIER_MAX_LEVEL = 50

/** XP nécessaire pour passer du niveau `level` au suivant (géométrique, adoucie après 25). */
export function xpForNext(level: number): number {
  if (level < 25) return Math.round(60 * Math.pow(1.22, level - 1))
  return Math.round(60 * Math.pow(1.22, 24) * Math.pow(1.15, level - 25))
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
  /** Branche de l'arbre (v0.26) — absent = tronc commun. Le respec se fait PAR branche. */
  branch?: string
  /** Rang minimal requis sur le nœud parent `requires` (lignes étagées I→V : 1 par défaut). */
  requiresRank?: number
  /** Keystone (v0.28 E2) : nœud terminal à fort impact — rendu mis en avant (halo) dans l'arbre. */
  keystone?: boolean
}

/** Une branche d'arbre (v0.26) : l'UI groupe les nœuds par branche, le respec est par branche. */
export interface MetierBranch {
  id: string
  name: string
  icon: string
}

/** Branches par métier ('tronc' implicite en tête : nœuds sans `branch`). */
export const METIER_BRANCHES: Record<MetierId, MetierBranch[]> = {
  forgeron: [
    { id: 'corps', name: 'Compagnonnages', icon: '🛠️' },
    { id: 'prodige', name: 'Prodige', icon: '✨' },
    { id: 'procedes', name: 'Procédés', icon: '⚙️' },
    { id: 'industrie', name: 'Industrialisation', icon: '🤖' },
  ],
  joaillier: [
    { id: 'taille', name: 'Taille & Qualité', icon: '✂️' },
    { id: 'serti', name: 'Châsses & Sertissage', icon: '💎' },
    { id: 'familles', name: 'Maîtrises de famille', icon: '◈' },
    { id: 'negoce', name: 'Négoce & Sources', icon: '⚖️' },
  ],
  runiste: [
    { id: 'chrono', name: 'Chronomancie', icon: '⏳' },
    { id: 'lois', name: 'Législation', icon: '⚖️' },
    { id: 'pactes', name: 'Pactes', icon: '🩸' },
  ],
  alchimiste: [
    { id: 'officine', name: 'Officine', icon: '🧪' },
    { id: 'oeuvre', name: 'Grand Œuvre', icon: '⚗️' },
    { id: 'matiere', name: 'Matière', icon: '🌿' },
  ],
}

/** Points dépensés dans une branche donnée ('tronc' = nœuds sans branche). */
export function pointsSpentInBranch(state: MetierState, metier: MetierId, branchId: string): number {
  let total = 0
  for (const n of METIER_NODES[metier]) {
    const b = n.branch ?? 'tronc'
    if (b === branchId) total += state.nodes[n.id] ?? 0
  }
  return total
}

/** Coût (or) du respec d'UNE branche — 40% du respec complet (v0.26 : changer de voie sans tout raser). */
export function respecBranchCost(state: MetierState): number {
  return Math.round(respecCost(state) * 0.4)
}

export const METIER_NODES: Record<MetierId, MetierNode[]> = {
  // v0.26 — arbre REFONDU : tronc + Compagnonnages (corps de métier) + Prodige + Procédés
  // + Industrialisation. ~62 rangs dépensables. Les ARMES restent hors spé (bien réglées).
  forgeron: [
    /* — tronc commun — */
    { id: 'econome', name: 'Forge économe', icon: '💰', maxRank: 5,
      desc: '−4% des coûts de craft (éclats & matériaux) par rang.' },
    { id: 'pedagogie', name: 'Pédagogie', icon: '📚', maxRank: 3, minLevel: 4,
      desc: '+20% d\'XP de Forgeron par rang.' },
    { id: 'specEconome', name: 'Maître Économe', icon: '🪙', maxRank: 1, minLevel: 15,
      desc: '−15% de coûts de craft supplémentaires.' },
    /* — 🛠️ Compagnonnages : 1 corps MAJEUR (I→V)… — */
    { id: 'corpsHeaumier', name: 'Heaumier', icon: '🪖', maxRank: 5, minLevel: 10, exclusive: 'forgeron-corps', branch: 'corps',
      desc: '◈ Tête & Épaules — I : −15% coûts, +XP · II : +1 iLvl · III : affixe SIGNATURE au choix (crit/ténacité) · IV : +12% rareté sup. · V : Chef-d\'œuvre hebdo.' },
    { id: 'corpsCuirassier', name: 'Cuirassier', icon: '🥋', maxRank: 5, minLevel: 10, exclusive: 'forgeron-corps', branch: 'corps',
      desc: '◈ Torse, Jambes & Bouclier — I : −15% coûts, +XP · II : +1 iLvl · III : SIGNATURE (réduction/barrière) · IV : +12% rareté sup. · V : Chef-d\'œuvre hebdo.' },
    { id: 'corpsEquipementier', name: 'Équipementier', icon: '🧤', maxRank: 5, minLevel: 10, exclusive: 'forgeron-corps', branch: 'corps',
      desc: '◈ Mains, Poignets, Taille, Pieds & Cape — I : −15% coûts · II : +1 iLvl · III : SIGNATURE (hâte/esquive) · IV : +12% rareté sup. · V : Chef-d\'œuvre hebdo.' },
    { id: 'corpsOrfevre', name: 'Orfèvre', icon: '💍', maxRank: 5, minLevel: 10, exclusive: 'forgeron-corps', branch: 'corps',
      desc: '◈ Collier, Anneaux & Bijoux — I : −15% coûts · II : +1 iLvl · III : SIGNATURE (altération/précision) · IV : +12% rareté sup. · V : Chef-d\'œuvre hebdo.' },
    /* — …et 1 corps MINEUR (I–II) au niveau 35 — */
    { id: 'mineurHeaumier', name: 'Second corps : Heaumier', icon: '🪖', maxRank: 2, minLevel: 35, exclusive: 'forgeron-corps2', branch: 'corps',
      desc: 'Compagnonnage MINEUR (choisis un AUTRE corps que le majeur) — I : −15% coûts · II : +1 iLvl.' },
    { id: 'mineurCuirassier', name: 'Second corps : Cuirassier', icon: '🥋', maxRank: 2, minLevel: 35, exclusive: 'forgeron-corps2', branch: 'corps',
      desc: 'Compagnonnage MINEUR (choisis un AUTRE corps que le majeur) — I : −15% coûts · II : +1 iLvl.' },
    { id: 'mineurEquipementier', name: 'Second corps : Équipementier', icon: '🧤', maxRank: 2, minLevel: 35, exclusive: 'forgeron-corps2', branch: 'corps',
      desc: 'Compagnonnage MINEUR (choisis un AUTRE corps que le majeur) — I : −15% coûts · II : +1 iLvl.' },
    { id: 'mineurOrfevre', name: 'Second corps : Orfèvre', icon: '💍', maxRank: 2, minLevel: 35, exclusive: 'forgeron-corps2', branch: 'corps',
      desc: 'Compagnonnage MINEUR (choisis un AUTRE corps que le majeur) — I : −15% coûts · II : +1 iLvl.' },
    /* — ✨ Prodige : la rareté supérieure devient une voie — */
    { id: 'chance', name: 'Prodige', icon: '🎲', maxRank: 15, minLevel: 5, branch: 'prodige',
      desc: '+2% de chance de forger une rareté SUPÉRIEURE par rang (création).' },
    { id: 'inspiration', name: 'Inspiration', icon: '💡', maxRank: 3, minLevel: 12, requires: 'chance', requiresRank: 5, branch: 'prodige',
      desc: 'Quand la rareté supérieure proc : +2% par rang que le craft saute DEUX crans (annoncé en fanfare).' },
    { id: 'serendipite', name: 'Sérendipité', icon: '🍀', maxRank: 3, minLevel: 8, requires: 'chance', branch: 'prodige',
      desc: 'Les crafts SANS proc de rareté remboursent +8% de leurs coûts par rang.' },
    /* — ⚙️ Procédés — */
    { id: 'surillvl', name: 'Maître affûteur', icon: '⬆️', maxRank: 1, minLevel: 2, minStage: 20, branch: 'procedes',
      desc: 'Débloque le SURILLVL : augmenter l\'iLvl d\'un objet.' },
    { id: 'affutage', name: 'Affûtage supérieur', icon: '🗡️', maxRank: 1, minLevel: 20, requires: 'surillvl', branch: 'procedes',
      desc: 'Le surillvl donne +1 iLvl supplémentaire par usage.' },
    { id: 'transmute', name: 'Transmutateur', icon: '🔄', maxRank: 1, minLevel: 3, minStage: 20, branch: 'procedes',
      desc: 'Débloque la TRANSMUTATION : changer la stat primaire d\'un objet.' },
    { id: 'ascension', name: 'Grand-maître forgeron', icon: '✨', maxRank: 1, minLevel: 10, minStage: 50, requires: 'surillvl', branch: 'procedes', keystone: true,
      desc: 'Débloque l\'ASCENSION : monter un objet d\'un cran de rareté.' },
    { id: 'verrous', name: 'Verrous huilés', icon: '🔐', maxRank: 3, minLevel: 7, branch: 'procedes',
      desc: '−12% du surcoût des VERROUS de reforge par rang (garder ses bonnes lignes coûte moins).' },
    { id: 'contrats', name: 'Contrats de forge', icon: '📋', maxRank: 1, minLevel: 5, branch: 'procedes',
      desc: 'Débloque 3 COMMANDES quotidiennes : forger la pièce demandée paie en Lingots 🧱 et grosse XP.' },
    { id: 'negociant', name: 'Négociant', icon: '🤝', maxRank: 3, minLevel: 14, requires: 'contrats', branch: 'procedes',
      desc: '+1 Lingot 🧱 par contrat rempli, par rang.' },
    { id: 'fonderie', name: 'Fonderie', icon: '🫕', maxRank: 1, minLevel: 6, branch: 'procedes',
      desc: 'Débloque la FONTE : un objet Rare+ → Lingots 🧱 (la matière des Signatures et Chefs-d\'œuvre).' },
    { id: 'lingotier', name: 'Lingotier', icon: '🧱', maxRank: 3, minLevel: 11, requires: 'fonderie', branch: 'procedes',
      desc: '+15% de Lingots à la fonte par rang (arrondi au mieux).' },
    { id: 'trempeLente', name: 'Trempe lente', icon: '🔥', maxRank: 1, minLevel: 8, branch: 'procedes',
      desc: 'Débloque le BAC DE TREMPE : un objet déposé gagne +1 iLvl par 24 h RÉELLES (5 max par objet).' },
    { id: 'polissage', name: 'Polissage', icon: '🌟', maxRank: 1, minLevel: 9, branch: 'procedes',
      desc: 'Tes créations reçoivent une QUALITÉ ⭐1–5 (budget de stats ±8%) — roulée à la forge.' },
    { id: 'polissageFin', name: 'Main de maître', icon: '🤌', maxRank: 3, minLevel: 16, requires: 'polissage', branch: 'procedes',
      desc: 'Améliore les chances de hautes étoiles ⭐ par rang.' },
    { id: 'moules', name: 'Moules', icon: '🧩', maxRank: 1, minLevel: 13, branch: 'procedes',
      desc: 'Mémorise ton DERNIER craft : re-forger À L\'IDENTIQUE coûte −30%.' },
    /* — 🤖 Industrialisation — */
    { id: 'automates', name: 'Industrialisation', icon: '🤖', maxRank: 1, minLevel: 12, minStage: 65, branch: 'industrie',
      desc: 'Débloque la construction d\'AUTOMATES (machines qui refont les donjons/raids battus).' },
    { id: 'montage', name: 'Chaîne de montage', icon: '⚙️', maxRank: 3, requires: 'automates', branch: 'industrie',
      desc: '−8% de durée des runs d\'automates par rang.' },
    { id: 'automate4', name: 'Manufacture', icon: '🏭', maxRank: 1, minLevel: 40, minStage: 80, requires: 'automates', branch: 'industrie', keystone: true,
      desc: 'Débloque la construction d\'un QUATRIÈME automate.' },
  ],
  // v0.26 — arbre REFONDU : ~62 rangs dépensables (tronc + 4 branches), specs étagées I→V.
  joaillier: [
    /* — tronc commun — */
    { id: 'sertissage', name: 'Sertissage', icon: '💎', maxRank: 1,
      desc: 'Débloque le SERTISSAGE : poser des gemmes dans les châsses (Rare+).' },
    { id: 'extraction', name: 'Extraction propre', icon: '🪛', maxRank: 3, requires: 'sertissage',
      desc: '−25% du coût de désertissage par rang.' },
    { id: 'broyage', name: 'Broyage', icon: '⚒️', maxRank: 1, minLevel: 3,
      desc: 'Débloque le BROYAGE : réduire une gemme en poussière de gemme 💠.' },
    { id: 'lustrage', name: 'Lustrage', icon: '🧽', maxRank: 3, minLevel: 4,
      desc: '+20% d\'XP de Joaillier par rang.' },
    /* — ✂️ Taille & Qualité — */
    { id: 'taille', name: 'Taille', icon: '✂️', maxRank: 1, minLevel: 6, requires: 'broyage', branch: 'taille',
      desc: 'Débloque la TAILLE : façonner la gemme de ton CHOIX contre de la poussière (qualité roulée).' },
    { id: 'recoupe', name: 'Recoupe', icon: '🔬', maxRank: 1, minLevel: 10, requires: 'taille', branch: 'taille',
      desc: 'Débloque la RECOUPE : monter le RANG d\'une gemme sertie, cran par cran.' },
    { id: 'mainSure', name: 'Main sûre', icon: '🤲', maxRank: 5, minLevel: 8, requires: 'taille', branch: 'taille',
      desc: '+4% de chance de tailler une gemme PARFAITE ▴ par rang (et moins d\'Éclatées ▾).' },
    { id: 'inspirationJ', name: 'Inspiration', icon: '💡', maxRank: 5, minLevel: 12, requires: 'taille', branch: 'taille',
      desc: '+2% de chance par rang de tailler directement au RANG 2.' },
    { id: 'multitaille', name: 'Multitaille', icon: '✌️', maxRank: 3, minLevel: 16, requires: 'taille', branch: 'taille',
      desc: '+3% de chance par rang de produire une SECONDE gemme (aléatoire, même famille).' },
    { id: 'economat', name: 'Économat', icon: '🧮', maxRank: 5, minLevel: 5, requires: 'broyage', branch: 'taille',
      desc: '+6% de poussière au broyage par rang.' },
    { id: 'tailleEco', name: 'Geste précis', icon: '🫳', maxRank: 3, minLevel: 9, requires: 'taille', branch: 'taille',
      desc: '−10% du coût de la taille par rang.' },
    { id: 'fusion', name: 'Fusion', icon: '🔥', maxRank: 1, minLevel: 7, branch: 'taille',
      desc: 'Débloque la FUSION : 3 gemmes identiques → 1 gemme au rang SUPÉRIEUR. Résorbe ton stock.' },
    { id: 'fusionPropre', name: 'Fusion propre', icon: '♻️', maxRank: 3, minLevel: 11, requires: 'fusion', branch: 'taille',
      desc: '−20% des frais de fusion par rang.' },
    { id: 'corruption', name: 'Corruption', icon: '🫦', maxRank: 1, minLevel: 14, requires: 'taille', branch: 'taille',
      desc: 'Débloque la CORRUPTION : retaille risquée — 45% rang +1 · 35% rien · 20% broyée.' },
    { id: 'pacteLapidaire', name: 'Pacte du lapidaire', icon: '🤝', maxRank: 3, minLevel: 18, requires: 'corruption', branch: 'taille',
      desc: 'Améliore les chances de la corruption par rang (jusqu\'à ~55% / 30% / 15%).' },
    { id: 'stabilisation', name: 'Stabilisation', icon: '🧊', maxRank: 1, minLevel: 26, requires: 'pacteLapidaire', branch: 'taille',
      desc: 'La corruption ne peut PLUS détruire la gemme (échec = rien), mais coûte le double.' },
    /* — 💎 Châsses & Sertissage — */
    { id: 'chasseArme', name: 'Châsse forcée', icon: '🕳️', maxRank: 1, minLevel: 20, branch: 'serti',
      desc: 'Les ARMES gagnent une châsse supplémentaire.' },
    { id: 'chasseRoyale', name: 'Châsse royale', icon: '👑', maxRank: 1, minLevel: 22, requires: 'chasseArme', branch: 'serti',
      desc: 'La gemme sertie dans l\'ARME PRINCIPALE compte +1 rang (jusqu\'au max).' },
    { id: 'sertiConducteur', name: 'Serti conducteur', icon: '🔗', maxRank: 3, minLevel: 13, requires: 'sertissage', branch: 'serti',
      desc: 'Un héros portant 2+ gemmes de la MÊME famille : +4% sur leurs paramètres par rang.' },
    { id: 'mosaique', name: 'Mosaïque', icon: '🪩', maxRank: 3, minLevel: 17, requires: 'sertissage', branch: 'serti',
      desc: 'Si l\'équipe porte 3+ FAMILLES différentes : +3% sur TOUS les paramètres par rang.' },
    { id: 'percage', name: 'Perçage', icon: '🪛', maxRank: 1, minLevel: 24, minStage: 60, requires: 'sertissage', branch: 'serti',
      desc: 'Débloque le PERÇAGE : ajouter UNE châsse à un objet (très cher, une seule fois par objet).' },
    /* — ◈ Maîtrises de famille (lignes étagées I→V, une seule) — */
    { id: 'specRythme', name: 'Maître du Rythme', icon: '🥁', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'familles',
      desc: '◈ I : Rythme +1 rang · II : +10% paramètres · III : compteurs −1 · IV : +2 rangs · V : +15% et compteurs −2.' },
    { id: 'specFlux', name: 'Maître du Flux', icon: '🌊', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'familles',
      desc: '◈ I : Flux +1 rang · II : +10% paramètres · III : boucliers de gemmes +25% · IV : +2 rangs · V : « Marée » (caps +50%).' },
    { id: 'specEnv', name: 'Maître de l\'Environnement', icon: '🌍', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'familles',
      desc: '◈ I : Environnement +1 rang · II : +10% · III : coffres +10% · IV : +2 rangs · V : effets d\'Environnement +33%.' },
    { id: 'specBastion', name: 'Maître du Bastion', icon: '🛡️', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'familles',
      desc: '◈ I : Bastion +1 rang · II : +10% · III : les DoT subis −15% · IV : +2 rangs · V : « Citadelle » (l\'Égide couvre 2 coups).' },
    { id: 'doubleAllegeance', name: 'Double allégeance', icon: '🎭', maxRank: 1, minLevel: 45, branch: 'familles',
      desc: 'Ta famille la plus portée HORS spécialisation gagne +1 rang (jamais la profondeur I→V).' },
    /* — ⚖️ Négoce & Sources — */
    { id: 'prospection', name: 'Œil du prospecteur', icon: '🔍', maxRank: 3, minLevel: 3, branch: 'negoce',
      desc: '+25% de chance de drop de gemme par rang.' },
    { id: 'tamis', name: 'Tamis', icon: '🥅', maxRank: 1, minLevel: 10, requires: 'broyage', branch: 'negoce',
      desc: 'Les gemmes droppées en DOUBLON (déjà en stock) sont auto-broyées à +20% de poussière.' },
    { id: 'nezLapidaire', name: 'Nez du lapidaire', icon: '👃', maxRank: 1, minLevel: 16, branch: 'negoce',
      desc: 'Les gemmes droppées par les CHAMPIONS ✦ sont toujours au rang 2 minimum.' },
    { id: 'marcheAuxPierres', name: 'Marché aux pierres', icon: '⚖️', maxRank: 1, minLevel: 24, branch: 'negoce',
      desc: '1 échange par JOUR : 3 gemmes quelconques → 1 gemme au CHOIX (rang = min des 3).' },
    { id: 'catalogue', name: 'Catalogue', icon: '📖', maxRank: 1, minLevel: 30, branch: 'negoce',
      desc: 'Avoir possédé chaque gemme au moins une fois : +2% sur TOUS les paramètres de gemmes.' },
  ],
  // v0.26 — arbre REFONDU : tronc (gravure, atelier runique) + Chronomancie + Législation
  // + Pactes. Specs étagées I→V exclusives. ~45 rangs + fillers.
  runiste: [
    /* — tronc commun — */
    { id: 'gravure', name: 'Gravure', icon: '🪄', maxRank: 1,
      desc: 'Débloque la GRAVURE : une rune par pièce d\'équipement (runes de TEMPS).' },
    { id: 'palimpseste', name: 'Palimpseste', icon: '📜', maxRank: 3, requires: 'gravure',
      desc: '−15% du coût de gravure par rang.' },
    { id: 'calligraphie', name: 'Calligraphie', icon: '✒️', maxRank: 3, minLevel: 5,
      desc: '+20% d\'XP de Runiste par rang.' },
    { id: 'effacement', name: 'Effacement', icon: '🧽', maxRank: 1, minLevel: 4, requires: 'gravure',
      desc: 'Débloque l\'EFFACEMENT : sacrifier une rune possédée → Fragments runiques 🜁 (1 temps · 2 règle).' },
    { id: 'forgeRunique', name: 'Forge runique', icon: '🔨', maxRank: 1, minLevel: 10, requires: 'effacement',
      desc: 'Débloque la FORGE RUNIQUE : fragments 🜁 + 🌌 + or → la rune de ton CHOIX (coût ×1,5 par exemplaire).' },
    { id: 'surchargeRunique', name: 'Surcharge runique', icon: '🎲', maxRank: 1, minLevel: 18, requires: 'effacement',
      desc: 'Débloque la SURCHARGE : 3 fragments 🜁 → une rune ALÉATOIRE (jamais un pacte). Le gamble du Runiste.' },
    { id: 'greffier', name: 'Greffier', icon: '🖋️', maxRank: 3, minLevel: 7,
      desc: '+10% de chance de DROP de rune (raids, donjons) par rang.' },
    /* — ⏳ Chronomancie — */
    { id: 'specChrono', name: 'Chronomancien', icon: '⏳', maxRank: 5, minLevel: 15, exclusive: 'runiste-spec', requires: 'gravure', branch: 'chrono',
      desc: '◈ I→V : les runes de TEMPS gagnent +15% / +30% / +50% / +65% / +80% d\'efficacité.' },
    { id: 'horloger', name: 'Horloger', icon: '🕰️', maxRank: 3, minLevel: 9, requires: 'gravure', branch: 'chrono',
      desc: '+5% d\'efficacité des runes de TEMPS par rang (se cumule avec le Chronomancien).' },
    /* — ⚖️ Législation — */
    { id: 'regles', name: 'Lois du monde', icon: '⚖️', maxRank: 1, minLevel: 8, minStage: 50, requires: 'gravure', branch: 'lois',
      desc: 'Débloque les runes de RÈGLE : elles tordent le fonctionnement du jeu (loot, clés, économie).' },
    { id: 'specLegislateur', name: 'Législateur', icon: '🏛️', maxRank: 5, minLevel: 15, exclusive: 'runiste-spec', requires: 'regles', branch: 'lois',
      desc: '◈ I→V : règles AMPLIFIÉES aux étages III (Karma /25, Économe 25%, Transmutation ×3, knobs +25%) et V (Économe 35%, ×4, knobs +50%).' },
    /* — 🩸 Pactes — */
    { id: 'pactes', name: 'Sang d\'encre', icon: '🩸', maxRank: 1, minLevel: 12, minStage: 60, requires: 'gravure', branch: 'pactes',
      desc: 'Débloque la gravure des PACTES : un keystone bonus/malus, UN SEUL actif par équipe. Forgés, jamais droppés.' },
    { id: 'specPactiste', name: 'Pactiste', icon: '🖤', maxRank: 5, minLevel: 15, exclusive: 'runiste-spec', requires: 'pactes', branch: 'pactes',
      desc: '◈ I→V : les MALUS des pactes sont réduits de 5% / 10% / 15% / 20% / 30%.' },
    { id: 'doublePacte', name: 'Double pacte', icon: '⛓️', maxRank: 1, minLevel: 50, requires: 'specPactiste', requiresRank: 5, branch: 'pactes',
      desc: 'DEUX pactes actifs simultanément — mais leurs malus repassent ×1,5. Le nœud le plus dangereux du jeu.' },
  ],
  // v0.26 — arbre REFONDU : l'Alchimiste devient le métier des CONSOMMABLES et du temps réel.
  // Tronc + 🧪 Officine (cuves, recettes, brassins) + ⚗️ Grand Œuvre (quintessences, synthèses)
  // + 🌿 Matière (recyclage, réactifs). ~58 rangs.
  alchimiste: [
    /* — tronc commun — */
    { id: 'quintessence', name: 'Quintessence', icon: '⚗️', maxRank: 1,
      desc: 'Débloque le craft typé à la QUINTESSENCE (lignes de dégâts / résistance choisies).' },
    { id: 'paillasse', name: 'Paillasse ordonnée', icon: '🥼', maxRank: 3, minLevel: 4,
      desc: '+20% d\'XP d\'Alchimiste par rang.' },
    /* — 🧪 Officine — */
    { id: 'officine', name: 'Officine', icon: '🫖', maxRank: 1, minLevel: 2, branch: 'officine',
      desc: 'Débloque l\'OFFICINE : 2 cuves de brassage et l\'EXPÉRIMENTATION (découvre des recettes en combinant 2 réactifs).' },
    { id: 'cuve3', name: 'Troisième cuve', icon: '🫙', maxRank: 1, minLevel: 8, requires: 'officine', branch: 'officine',
      desc: 'Une CUVE de brassage supplémentaire (3).' },
    { id: 'cuve4', name: 'Quatrième cuve', icon: '🛁', maxRank: 1, minLevel: 18, requires: 'cuve3', branch: 'officine',
      desc: 'Une CUVE de brassage supplémentaire (4).' },
    { id: 'brassageRapide', name: 'Feu doux maîtrisé', icon: '🔥', maxRank: 3, minLevel: 6, requires: 'officine', branch: 'officine',
      desc: '−10% de temps de maturation des brassins par rang.' },
    { id: 'brassageCritique', name: 'Main du maître brasseur', icon: '✋', maxRank: 5, minLevel: 12, requires: 'officine', branch: 'officine',
      desc: '+4% de chance par rang qu\'un brassin récolté gagne UN cran de qualité.' },
    { id: 'grandsCrus', name: 'Grands crus', icon: '🍾', maxRank: 3, minLevel: 22, requires: 'brassageCritique', branch: 'officine',
      desc: '+2% de chance de MILLÉSIME ★ par rang (récoltes Parfaites uniquement).' },
    { id: 'transmutJour', name: 'Transmutation du jour', icon: '🌗', maxRank: 1, minLevel: 10, branch: 'officine',
      desc: '1/JOUR réel : 4 Quintessences d\'un type → 1 du type de ton CHOIX.' },
    { id: 'pharmacopee', name: 'Pharmacopée', icon: '📖', maxRank: 1, minLevel: 25, requires: 'officine', branch: 'officine',
      desc: '+5% de durée des élixirs/huiles/antidotes par RECETTE découverte.' },
    { id: 'philosophale', name: 'Pierre philosophale', icon: '🜍', maxRank: 1, minLevel: 50, minStage: 100, requires: 'officine', branch: 'officine',
      desc: 'CAPSTONE : débloque le Grand Œuvre ultime — la Pierre (relique de compte : +2% de drops de ressources, pour toujours).' },
    /* — ⚗️ Grand Œuvre — */
    { id: 'synthese1', name: 'Synthèse I — Infusion', icon: '✨', maxRank: 1, minLevel: 8, minStage: 80, branch: 'oeuvre',
      desc: 'Infuser un Fragment d\'éternité : ajoute un effet unique ALÉATOIRE (ou monte son rang).' },
    { id: 'synthese2', name: 'Synthèse II — Essence ciblée', icon: '🧬', maxRank: 1, minLevel: 14, minStage: 80, requires: 'synthese1', branch: 'oeuvre',
      desc: 'Insérer une essence d\'unique recyclé : un effet SEMI-CIBLÉ (celui de l\'essence).' },
    { id: 'synthese3', name: 'Synthèse III — Invocation', icon: '💫', maxRank: 1, minLevel: 20, minStage: 100, requires: 'synthese2', branch: 'oeuvre',
      desc: 'L\'acte final du craft : invoquer l\'effet unique de ton CHOIX (Éclats cosmiques).' },
    { id: 'rendementQ', name: 'Rendement quintessencié', icon: '⚖️', maxRank: 5, minLevel: 7, requires: 'quintessence', branch: 'oeuvre',
      desc: '−4% du coût des améliorations à la Quintessence par rang.' },
    { id: 'specTransmutateur', name: 'Catalyseur', icon: '⚗️', maxRank: 5, minLevel: 15, exclusive: 'alchimiste-spec', requires: 'quintessence', branch: 'oeuvre',
      desc: '◈ I→V : Quintessences −10/−15/−25/−30/−35% · à l\'étage III, le recyclage rembourse 100% des Quintessences investies.' },
    /* — 🌿 Matière — */
    { id: 'distillation', name: 'Distillation', icon: '🧪', maxRank: 5, branch: 'matiere',
      desc: '+10% d\'éclats au recyclage par rang.' },
    { id: 'condensation', name: 'Condensation', icon: '💧', maxRank: 5, minLevel: 5, branch: 'matiere',
      desc: '+20% de chance de drop de Quintessence par rang.' },
    { id: 'herboriste', name: 'Herboriste', icon: '🌿', maxRank: 5, minLevel: 3, branch: 'matiere',
      desc: '+8% de chance de drop de RÉACTIFS de biome par rang.' },
    { id: 'doubleDistillation', name: 'Double distillation', icon: '🔁', maxRank: 3, minLevel: 16, requires: 'officine', branch: 'matiere',
      desc: '+5% de chance par rang de ne PAS consommer les réactifs d\'un brassin.' },
    { id: 'specDistillateur', name: 'Distillateur', icon: '⚱️', maxRank: 5, minLevel: 15, exclusive: 'alchimiste-spec', requires: 'distillation', branch: 'matiere',
      desc: '◈ I→V : éclats au recyclage +10/+15/+25/+30/+35% · à l\'étage III, les essences d\'uniques tombent ×2.' },
  ],
}

/** Bonus de Compagnonnage applicables au craft d'un TYPE de pièce donné (majeur puis mineur). */
export interface CorpsBonus {
  /** Multiplicateur de coût (≤ 1 si le corps couvre la pièce). */
  costMult: number
  /** +iLvl plancher à la création (étage II). */
  ilvlBonus: number
  /** Affixes Signature proposables (étage III du MAJEUR uniquement), sinon null. */
  signatures: SecondaryStat[] | null
  /** Chance de rareté supérieure LOCALE (étage IV du majeur). */
  luckBonus: number
  /** Chef-d'œuvre hebdomadaire disponible (étage V du majeur). */
  masterwork: boolean
  /** Multiplicateur d'XP de forge sur ces pièces (étage I du majeur). */
  xpMult: number
}

export function corpsBonusFor(mods: CraftMods, type: ItemType): CorpsBonus {
  const out: CorpsBonus = { costMult: 1, ilvlBonus: 0, signatures: null, luckBonus: 0, masterwork: false, xpMult: 1 }
  const maj = mods.corpsMajeur
  if (maj && CORPS[maj.corps].types.includes(type)) {
    out.costMult = 0.85
    out.xpMult = 1.1
    if (maj.tier >= 2) out.ilvlBonus = 1
    if (maj.tier >= 3) out.signatures = CORPS[maj.corps].signatures
    if (maj.tier >= 4) out.luckBonus = 0.12
    if (maj.tier >= 5) out.masterwork = true
    return out
  }
  const min = mods.corpsMineur
  if (min && CORPS[min.corps].types.includes(type)) {
    out.costMult = 0.85
    if (min.tier >= 2) out.ilvlBonus = 1
  }
  return out
}

/** Niveau de Forgeron requis pour construire le 1er / 2e / 3e / 4e automate (4e : nœud Manufacture). */
export const AUTOMATE_FORGERON_LEVELS = [12, 16, 20, 26]

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
  const needRank = def.requiresRank ?? 1
  if (def.requires && (state.nodes[def.requires] ?? 0) < needRank) {
    const parent = getMetierNode(metier, def.requires)
    return { ok: false, reason: `Requiert « ${parent?.name ?? def.requires} »${needRank > 1 ? ` rang ${needRank}` : ''}.` }
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
  /** Gain d'iLvl par surillvl (2, ou 3 avec Affûtage supérieur). */
  surillvlStep: number
  transmute: boolean
  ascend: boolean
  automates: boolean
  /** Multiplicateur de durée des runs d'automates (≤ 1). */
  automateDurMult: number
  forgeronXpMult: number
  /** ◈ v0.26 — Compagnonnage MAJEUR : corps + étage I→V (null = aucun). */
  corpsMajeur: { corps: CorpsId; tier: number } | null
  /** Compagnonnage MINEUR (niv 35) : corps + étage I–II — ignoré s'il duplique le majeur. */
  corpsMineur: { corps: CorpsId; tier: number } | null
  /** Inspiration : chance que le proc de rareté saute DEUX crans. */
  inspiration: number
  /** Sérendipité : remboursement des crafts sans proc (fraction). */
  serendipite: number
  /** Verrous huilés : multiplicateur du surcoût des verrous de reforge (≤ 1). */
  verrousMult: number
  contrats: boolean
  /** Négociant : Lingots bonus par contrat rempli. */
  negociant: number
  fonderie: boolean
  /** Lingotier : multiplicateur de Lingots à la fonte (≥ 1). */
  lingotierMult: number
  trempeLente: boolean
  polissage: boolean
  /** Main de maître : rangs (qualité ⭐ des créations). */
  polishFin: number
  moules: boolean
  automate4: boolean
  /* Joaillier */
  gems: boolean
  unsocketCostMult: number
  gemDropMult: number
  /** Châsses bonus sur les armes. */
  weaponSocketBonus: number
  broyage: boolean
  taille: boolean
  recoupe: boolean
  /** ◈ v0.26 — Maîtrise de famille étagée : famille choisie + étage I→V (null = aucune). */
  gemSpec: { family: 'rythme' | 'flux' | 'environnement' | 'bastion'; tier: number } | null
  /** Double allégeance (niv 45) : une 2e famille (la plus portée) gagne +1 rang. */
  doubleAllegeance: boolean
  joaillierXpMult: number
  /** Main sûre : rangs (chance de Parfaite à la taille). */
  mainSure: number
  /** Inspiration : chance de tailler directement au rang 2. */
  tailleRank2: number
  /** Multitaille : chance de produire une 2e gemme. */
  multitaille: number
  /** Économat : multiplicateur de poussière au broyage (≥ 1). */
  grindMult: number
  /** Geste précis : multiplicateur du coût de taille (≤ 1). */
  tailleCostMult: number
  fusion: boolean
  /** Multiplicateur des frais de fusion (≤ 1). */
  fuseCostMult: number
  corruption: boolean
  /** Pacte du lapidaire : rangs (odds de corruption). */
  pacteLapidaire: number
  /** Stabilisation : la corruption ne détruit plus (coût ×2). */
  corruptSafe: boolean
  chasseRoyale: boolean
  /** Serti conducteur : bonus par rang si 2+ gemmes de même famille sur un héros (fraction). */
  sertiConducteur: number
  /** Mosaïque : bonus par rang si 3+ familles portées (fraction). */
  mosaique: number
  percage: boolean
  tamis: boolean
  nezLapidaire: boolean
  marcheAuxPierres: boolean
  catalogue: boolean
  /* Runiste */
  enchant: boolean
  ruleRunes: boolean
  enchantCostMult: number
  runisteXpMult: number
  /** ◈ Chronomancien I→V + Horloger : efficacité des runes de TEMPS (≥ 1). */
  runisteTempo: number
  /** ◈ Législateur : étage (0–5) — amplifications aux étages III et V. */
  ruleAmpTier: number
  /** Compat : règles amplifiées (étage ≥ 3 du Législateur). */
  loiAmplifiee: boolean
  /** 🩸 Gravure des Pactes débloquée. */
  pactes: boolean
  /** ◈ Pactiste : multiplicateur des MALUS de pacte (≤ 1). */
  pactMalusMult: number
  /** ⛓️ Double pacte : 2 pactes actifs (malus ×1,5). */
  doublePacte: boolean
  /** Atelier runique : Effacement / Forge / Surcharge débloqués. */
  effacement: boolean
  forgeRunique: boolean
  surchargeRunique: boolean
  /** Greffier : multiplicateur de chance de drop de rune (≥ 1). */
  greffierMult: number
  /* Alchimiste */
  quint: boolean
  /** Bonus multiplicatif d'éclats au recyclage (1 = aucun). */
  recycleMult: number
  quintDropMult: number
  synth1: boolean
  synth2: boolean
  synth3: boolean
  /** ◈ Distillateur (étage ≥ 3) : essences d'uniques ×2 au recyclage. */
  distillateur: boolean
  /** ◈ Catalyseur I→V + Rendement : multiplicateur du coût des Quintessences (≤ 1). */
  quintCostMult: number
  /** ◈ Catalyseur (étage ≥ 3) : remboursement à 100% des Quintessences au recyclage. */
  quintRefundFull: boolean
  /* — Officine (v0.26) — */
  alchimisteXpMult: number
  officine: boolean
  /** Nombre de cuves de brassage (0 sans Officine). */
  cuves: number
  /** Multiplicateur du temps de maturation (≤ 1). */
  brewTimeMult: number
  /** Chance qu'une récolte gagne un cran de qualité. */
  brewCrit: number
  /** Grands crus : rangs (chance de Millésime). */
  grandsCrus: number
  /** Herboriste : multiplicateur de drop des réactifs (≥ 1). */
  herboristeMult: number
  /** Double distillation : chance de ne pas consommer les réactifs. */
  doubleDistillation: number
  transmutJour: boolean
  /** Pharmacopée : +5% de durée par recette découverte (calculée côté store). */
  pharmacopee: boolean
  /** Capstone : craft de la Pierre philosophale débloqué. */
  philosophaleUnlock: boolean
}

export function craftMods(metiers: MetiersState): CraftMods {
  const r = (m: MetierId, id: string) => metiers[m].nodes[id] ?? 0
  // ◈ Compagnonnages (v0.26) : un corps majeur (I→V), un mineur (I–II) au niveau 35.
  const corpsMajeur: CraftMods['corpsMajeur'] =
    r('forgeron', 'corpsHeaumier') > 0 ? { corps: 'heaumier', tier: r('forgeron', 'corpsHeaumier') }
    : r('forgeron', 'corpsCuirassier') > 0 ? { corps: 'cuirassier', tier: r('forgeron', 'corpsCuirassier') }
    : r('forgeron', 'corpsEquipementier') > 0 ? { corps: 'equipementier', tier: r('forgeron', 'corpsEquipementier') }
    : r('forgeron', 'corpsOrfevre') > 0 ? { corps: 'orfevre', tier: r('forgeron', 'corpsOrfevre') }
    : null
  const corpsMineurRaw: CraftMods['corpsMineur'] =
    r('forgeron', 'mineurHeaumier') > 0 ? { corps: 'heaumier', tier: r('forgeron', 'mineurHeaumier') }
    : r('forgeron', 'mineurCuirassier') > 0 ? { corps: 'cuirassier', tier: r('forgeron', 'mineurCuirassier') }
    : r('forgeron', 'mineurEquipementier') > 0 ? { corps: 'equipementier', tier: r('forgeron', 'mineurEquipementier') }
    : r('forgeron', 'mineurOrfevre') > 0 ? { corps: 'orfevre', tier: r('forgeron', 'mineurOrfevre') }
    : null
  return {
    costMult: Math.max(0.4, 1 - r('forgeron', 'econome') * 0.04 - (r('forgeron', 'specEconome') > 0 ? 0.15 : 0)),
    luckChance: Math.min(0.6, r('forgeron', 'chance') * 0.02),
    surillvl: r('forgeron', 'surillvl') > 0,
    surillvlStep: r('forgeron', 'affutage') > 0 ? 3 : 2,
    transmute: r('forgeron', 'transmute') > 0,
    ascend: r('forgeron', 'ascension') > 0,
    automates: r('forgeron', 'automates') > 0,
    automateDurMult: 1 - r('forgeron', 'montage') * 0.08,
    forgeronXpMult: 1 + r('forgeron', 'pedagogie') * 0.2,
    corpsMajeur,
    corpsMineur: corpsMineurRaw && corpsMajeur && corpsMineurRaw.corps === corpsMajeur.corps ? null : corpsMineurRaw,
    inspiration: r('forgeron', 'inspiration') * 0.02,
    serendipite: r('forgeron', 'serendipite') * 0.08,
    verrousMult: Math.max(0.5, 1 - r('forgeron', 'verrous') * 0.12),
    contrats: r('forgeron', 'contrats') > 0,
    negociant: r('forgeron', 'negociant'),
    fonderie: r('forgeron', 'fonderie') > 0,
    lingotierMult: 1 + r('forgeron', 'lingotier') * 0.15,
    trempeLente: r('forgeron', 'trempeLente') > 0,
    polissage: r('forgeron', 'polissage') > 0,
    polishFin: r('forgeron', 'polissageFin'),
    moules: r('forgeron', 'moules') > 0,
    automate4: r('forgeron', 'automate4') > 0,
    gems: r('joaillier', 'sertissage') > 0,
    unsocketCostMult: Math.max(0.25, 1 - r('joaillier', 'extraction') * 0.25),
    gemDropMult: 1 + r('joaillier', 'prospection') * 0.25,
    weaponSocketBonus: r('joaillier', 'chasseArme') > 0 ? 1 : 0,
    broyage: r('joaillier', 'broyage') > 0,
    taille: r('joaillier', 'taille') > 0,
    recoupe: r('joaillier', 'recoupe') > 0,
    gemSpec:
      r('joaillier', 'specRythme') > 0 ? { family: 'rythme', tier: r('joaillier', 'specRythme') }
      : r('joaillier', 'specFlux') > 0 ? { family: 'flux', tier: r('joaillier', 'specFlux') }
      : r('joaillier', 'specEnv') > 0 ? { family: 'environnement', tier: r('joaillier', 'specEnv') }
      : r('joaillier', 'specBastion') > 0 ? { family: 'bastion', tier: r('joaillier', 'specBastion') }
      : null,
    doubleAllegeance: r('joaillier', 'doubleAllegeance') > 0,
    joaillierXpMult: 1 + r('joaillier', 'lustrage') * 0.2,
    mainSure: r('joaillier', 'mainSure'),
    tailleRank2: r('joaillier', 'inspirationJ') * 0.02,
    multitaille: r('joaillier', 'multitaille') * 0.03,
    grindMult: 1 + r('joaillier', 'economat') * 0.06,
    tailleCostMult: Math.max(0.5, 1 - r('joaillier', 'tailleEco') * 0.1),
    fusion: r('joaillier', 'fusion') > 0,
    fuseCostMult: Math.max(0.2, 1 - r('joaillier', 'fusionPropre') * 0.2),
    corruption: r('joaillier', 'corruption') > 0,
    pacteLapidaire: r('joaillier', 'pacteLapidaire'),
    corruptSafe: r('joaillier', 'stabilisation') > 0,
    chasseRoyale: r('joaillier', 'chasseRoyale') > 0,
    sertiConducteur: r('joaillier', 'sertiConducteur') * 0.04,
    mosaique: r('joaillier', 'mosaique') * 0.03,
    percage: r('joaillier', 'percage') > 0,
    tamis: r('joaillier', 'tamis') > 0,
    nezLapidaire: r('joaillier', 'nezLapidaire') > 0,
    marcheAuxPierres: r('joaillier', 'marcheAuxPierres') > 0,
    catalogue: r('joaillier', 'catalogue') > 0,
    enchant: r('runiste', 'gravure') > 0,
    ruleRunes: r('runiste', 'regles') > 0,
    enchantCostMult: Math.max(0.4, 1 - r('runiste', 'palimpseste') * 0.15),
    runisteXpMult: 1 + r('runiste', 'calligraphie') * 0.2,
    // ◈ Chronomancien I→V : 1,15 / 1,3 / 1,5 / 1,65 / 1,8 — + Horloger (+5%/rang).
    runisteTempo: [1, 1.15, 1.3, 1.5, 1.65, 1.8][Math.min(5, r('runiste', 'specChrono'))] + r('runiste', 'horloger') * 0.05,
    ruleAmpTier: r('runiste', 'specLegislateur'),
    loiAmplifiee: r('runiste', 'specLegislateur') >= 3,
    pactes: r('runiste', 'pactes') > 0,
    pactMalusMult: 1 - [0, 0.05, 0.1, 0.15, 0.2, 0.3][Math.min(5, r('runiste', 'specPactiste'))],
    doublePacte: r('runiste', 'doublePacte') > 0,
    effacement: r('runiste', 'effacement') > 0,
    forgeRunique: r('runiste', 'forgeRunique') > 0,
    surchargeRunique: r('runiste', 'surchargeRunique') > 0,
    greffierMult: 1 + r('runiste', 'greffier') * 0.1,
    quint: r('alchimiste', 'quintessence') > 0,
    // ◈ Distillateur I→V : +10/15/25/30/35% (l'étage III = l'ancien rang 1).
    recycleMult: (1 + r('alchimiste', 'distillation') * 0.1)
      * (1 + [0, 0.1, 0.15, 0.25, 0.3, 0.35][Math.min(5, r('alchimiste', 'specDistillateur'))]),
    quintDropMult: 1 + r('alchimiste', 'condensation') * 0.2,
    synth1: r('alchimiste', 'synthese1') > 0,
    synth2: r('alchimiste', 'synthese2') > 0,
    synth3: r('alchimiste', 'synthese3') > 0,
    distillateur: r('alchimiste', 'specDistillateur') >= 3,
    // ◈ Catalyseur I→V (−10/15/25/30/35%) × Rendement quintessencié (−4%/rang).
    quintCostMult: [1, 0.9, 0.85, 0.75, 0.7, 0.65][Math.min(5, r('alchimiste', 'specTransmutateur'))]
      * (1 - r('alchimiste', 'rendementQ') * 0.04),
    quintRefundFull: r('alchimiste', 'specTransmutateur') >= 3,
    alchimisteXpMult: 1 + r('alchimiste', 'paillasse') * 0.2,
    officine: r('alchimiste', 'officine') > 0,
    cuves: r('alchimiste', 'officine') > 0 ? 2 + r('alchimiste', 'cuve3') + r('alchimiste', 'cuve4') : 0,
    brewTimeMult: 1 - r('alchimiste', 'brassageRapide') * 0.1,
    brewCrit: r('alchimiste', 'brassageCritique') * 0.04,
    grandsCrus: r('alchimiste', 'grandsCrus'),
    herboristeMult: 1 + r('alchimiste', 'herboriste') * 0.08,
    doubleDistillation: r('alchimiste', 'doubleDistillation') * 0.05,
    transmutJour: r('alchimiste', 'transmutJour') > 0,
    pharmacopee: r('alchimiste', 'pharmacopee') > 0,
    philosophaleUnlock: r('alchimiste', 'philosophale') > 0,
  }
}

// (v0.25 : les CONVERSIONS de ressources du ◈ Transmutateur ont été SUPPRIMÉES — même principe
//  que le Comptoir d'échange : la fongibilité cassait « chaque donjon est LA source de sa
//  ressource ». La spécialisation est devenue ◈ Catalyseur, voir plus haut.)

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
