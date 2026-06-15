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
    { id: 'atelier', name: 'Atelier', icon: '🔨' },
    { id: 'manufacture', name: 'Manufacture', icon: '⚙️' },
  ],
  joaillier: [
    { id: 'taillerie', name: 'Taillerie', icon: '💎' },
    { id: 'maitrise', name: 'Maîtrise & Sources', icon: '◈' },
  ],
  runiste: [
    { id: 'atelier', name: 'Atelier runique', icon: '🪄' },
    { id: 'voies', name: 'Voies', icon: '◈' },
  ],
  alchimiste: [
    { id: 'officine', name: 'Officine', icon: '🧪' },
    { id: 'oeuvre', name: 'Grand Œuvre', icon: '⚗️' },
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
  // v0.28 E2 — arbre RÉDUIT : 2 sections, ~14 nœuds. Atelier = les verbes de modif (3 premiers
  // indispensables). Manufacture = idle + ressources + efficacité. Plus de Compagnonnage (lock-in retiré).
  forgeron: [
    /* — 🔨 ATELIER : les outils de modif (les 3 premiers = indispensables) — */
    { id: 'surillvl', name: 'Affûtage', icon: '⬆️', maxRank: 2, minLevel: 2, minStage: 20, branch: 'atelier',
      desc: 'Débloque le SURILLVL (augmente l\'iLvl d\'un objet). Rang 2 : +1 iLvl supplémentaire par usage.' },
    { id: 'polissage', name: 'Polissage', icon: '🌟', maxRank: 3, minLevel: 6, branch: 'atelier',
      desc: 'Tes créations reçoivent une QUALITÉ ⭐1–5. Rangs 2-3 : meilleures chances de hautes étoiles.' },
    { id: 'trempeLente', name: 'Trempe lente', icon: '🔥', maxRank: 1, minLevel: 8, branch: 'atelier',
      desc: 'Débloque le BAC DE TREMPE : un objet déposé gagne +1 iLvl par 24 h RÉELLES (5 max par objet).' },
    { id: 'transmute', name: 'Transmutateur', icon: '🔄', maxRank: 1, minLevel: 4, minStage: 20, branch: 'atelier',
      desc: 'Débloque la TRANSMUTATION : changer la stat primaire d\'un objet.' },
    { id: 'maitreForgeron', name: 'Maître forgeron', icon: '🛠️', maxRank: 3, minLevel: 10, branch: 'atelier',
      desc: 'Tes créations : +1 iLvl (R1) · +12% rareté supérieure (R2) · ◆ Chef-d\'œuvre hebdomadaire (R3).' },
    { id: 'signature', name: 'Signature', icon: '✒️', maxRank: 1, minLevel: 12, branch: 'atelier',
      desc: 'Une création reçoit un AFFIXE GARANTI au choix (crit, ténacité, hâte…) — coûte des Lingots 🧱.' },
    { id: 'ascension', name: 'Grand-maître forgeron', icon: '✨', maxRank: 1, minLevel: 14, minStage: 50, requires: 'surillvl', branch: 'atelier', keystone: true,
      desc: 'Débloque l\'ASCENSION : monter un objet d\'un cran de rareté.' },
    /* — ⚙️ MANUFACTURE : idle, ressources & efficacité — */
    { id: 'econome', name: 'Forge économe', icon: '💰', maxRank: 5, branch: 'manufacture',
      desc: '−5% des coûts de craft par rang, et un craft sans proc de rareté rembourse une part de ses coûts.' },
    { id: 'chance', name: 'Prodige', icon: '🎲', maxRank: 5, minLevel: 5, branch: 'manufacture',
      desc: '+5% de chance de forger une rareté SUPÉRIEURE par rang ; au proc, chance de sauter DEUX crans.' },
    { id: 'fonderie', name: 'Fonderie & Contrats', icon: '🫕', maxRank: 1, minLevel: 6, branch: 'manufacture',
      desc: 'Débloque la FONTE (objet Rare+ → Lingots 🧱) ET 3 CONTRATS quotidiens (Lingots + grosse XP).' },
    { id: 'maitreFondeur', name: 'Maître fondeur', icon: '🧱', maxRank: 3, minLevel: 11, requires: 'fonderie', branch: 'manufacture',
      desc: '+15% de Lingots à la fonte et +1 Lingot par contrat rempli, par rang.' },
    { id: 'automates', name: 'Industrialisation', icon: '🤖', maxRank: 1, minLevel: 12, minStage: 65, branch: 'manufacture',
      desc: 'Débloque les AUTOMATES : des machines qui refont les donjons/raids déjà vaincus (idle).' },
    { id: 'montage', name: 'Chaîne de montage', icon: '⚙️', maxRank: 3, requires: 'automates', branch: 'manufacture',
      desc: '−8% de durée des runs d\'automates par rang.' },
    { id: 'automate4', name: 'Manufacture', icon: '🏭', maxRank: 1, minLevel: 40, minStage: 80, requires: 'automates', branch: 'manufacture', keystone: true,
      desc: 'Débloque la construction d\'un QUATRIÈME automate.' },
  ],
  // v0.26 — arbre REFONDU : ~62 rangs dépensables (tronc + 4 branches), specs étagées I→V.
  // v0.28 E2 — arbre RÉDUIT : 2 sections, ~14 nœuds. Taillerie = les verbes gemme (3 premiers
  // indispensables). Maîtrise & Sources = spé de famille (re-choix libre) + châsses + drop + troc.
  joaillier: [
    /* — 💎 TAILLERIE : faire & améliorer ses gemmes (3 premiers = indispensables) — */
    { id: 'sertissage', name: 'Sertissage', icon: '💎', maxRank: 1, branch: 'taillerie',
      desc: 'Débloque le SERTISSAGE : poser des gemmes dans les châsses (Rare+).' },
    { id: 'taille', name: 'Taille', icon: '✂️', maxRank: 2, minLevel: 6, requires: 'sertissage', branch: 'taillerie',
      desc: 'Débloque le BROYAGE (gemme → poussière 🔹) et la TAILLE (gemme au CHOIX). Rang 2 : meilleure qualité + chance de tailler au rang 2.' },
    { id: 'recoupe', name: 'Recoupe', icon: '🔬', maxRank: 1, minLevel: 10, requires: 'taille', branch: 'taillerie',
      desc: 'Débloque la RECOUPE : monter le RANG d\'une gemme sertie, cran par cran.' },
    { id: 'fusion', name: 'Fusion', icon: '🔥', maxRank: 1, minLevel: 7, requires: 'taille', branch: 'taillerie',
      desc: 'Débloque la FUSION : 3 gemmes identiques → 1 gemme au rang SUPÉRIEUR.' },
    { id: 'lapidaire', name: 'Lapidaire émérite', icon: '🤲', maxRank: 3, minLevel: 9, requires: 'taille', branch: 'taillerie',
      desc: 'Par rang : −coûts de taille & de fusion, +poussière au broyage, et chance de produire une SECONDE gemme.' },
    { id: 'corruption', name: 'Corruption', icon: '🫦', maxRank: 1, minLevel: 14, requires: 'recoupe', branch: 'taillerie',
      desc: 'Débloque la CORRUPTION : tenter un rang +1 sur UNE gemme — SÉCURISÉE (échec = rien, jamais détruite).' },
    { id: 'percage', name: 'Perçage', icon: '🪛', maxRank: 1, minLevel: 24, minStage: 60, requires: 'sertissage', branch: 'taillerie', keystone: true,
      desc: 'Débloque le PERÇAGE : ajouter UNE châsse à un objet (cher, une seule fois par objet).' },
    /* — ◈ MAÎTRISE & SOURCES : spé de famille (re-choix libre) + châsses + drop + troc — */
    { id: 'specRythme', name: 'Maître du Rythme', icon: '🥁', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'maitrise',
      desc: '◈ I : Rythme +1 rang · II : +10% paramètres · III : compteurs −1 · IV : +2 rangs · V : +15% et compteurs −2. (Re-choix libre.)' },
    { id: 'specFlux', name: 'Maître du Flux', icon: '🌊', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'maitrise',
      desc: '◈ I : Flux +1 rang · II : +10% paramètres · III : boucliers de gemmes +25% · IV : +2 rangs · V : « Marée » (caps +50%). (Re-choix libre.)' },
    { id: 'specEnv', name: 'Maître de l\'Environnement', icon: '🌍', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'maitrise',
      desc: '◈ I : Environnement +1 rang · II : +10% · III : coffres +10% · IV : +2 rangs · V : effets d\'Environnement +33%. (Re-choix libre.)' },
    { id: 'specBastion', name: 'Maître du Bastion', icon: '🛡️', maxRank: 5, minLevel: 15, exclusive: 'joaillier-spec', requires: 'sertissage', branch: 'maitrise',
      desc: '◈ I : Bastion +1 rang · II : +10% · III : les DoT subis −15% · IV : +2 rangs · V : « Citadelle » (l\'Égide couvre 2 coups). (Re-choix libre.)' },
    { id: 'synergies', name: 'Synergies de châsses', icon: '🔗', maxRank: 3, minLevel: 13, requires: 'sertissage', branch: 'maitrise',
      desc: 'Châsse d\'ARME supplémentaire (R1) + bonus multi-gemmes : 2+ même famille et 3+ familles différentes, par rang.' },
    { id: 'prospecteur', name: 'Prospecteur', icon: '🔍', maxRank: 3, minLevel: 3, branch: 'maitrise',
      desc: '+25% de drop de gemme par rang ; les doublons sont auto-broyés et les gemmes de champions ✦ sortent au rang 2+.' },
    { id: 'marche', name: 'Marché aux pierres', icon: '⚖️', maxRank: 1, minLevel: 24, branch: 'maitrise',
      desc: '1 troc/jour : 3 gemmes → 1 au CHOIX (rang = min). + bonus de collection quand tu as possédé chaque gemme.' },
  ],
  // v0.26 — arbre REFONDU : tronc (gravure, atelier runique) + Chronomancie + Législation
  // + Pactes. Specs étagées I→V exclusives. ~45 rangs + fillers.
  // v0.28 E2 — arbre RÉDUIT : 2 sections, 11 nœuds. Atelier runique = les verbes (graver/effacer/
  // forger/surcharger). Voies = les 3 maîtrises exclusives (re-choix libre) + Pactes.
  runiste: [
    /* — 🪄 ATELIER RUNIQUE : les verbes (3 premiers = indispensables) — */
    { id: 'gravure', name: 'Gravure', icon: '🪄', maxRank: 1, branch: 'atelier',
      desc: 'Débloque la GRAVURE : une rune par pièce d\'équipement (runes de TEMPS).' },
    { id: 'effacement', name: 'Effacement', icon: '🧽', maxRank: 1, minLevel: 4, requires: 'gravure', branch: 'atelier',
      desc: 'Débloque l\'EFFACEMENT : sacrifier une rune possédée → Fragments runiques 🜁.' },
    { id: 'forgeRunique', name: 'Forge runique', icon: '🔨', maxRank: 1, minLevel: 10, requires: 'effacement', branch: 'atelier',
      desc: 'Débloque la FORGE RUNIQUE : fragments 🜁 + 🌌 + or → la rune de ton CHOIX.' },
    { id: 'surchargeRunique', name: 'Surcharge runique', icon: '🎲', maxRank: 1, minLevel: 18, requires: 'effacement', branch: 'atelier',
      desc: 'Débloque la SURCHARGE : 3 fragments 🜁 → une rune ALÉATOIRE. Le gamble du Runiste.' },
    { id: 'runologue', name: 'Runologue', icon: '📜', maxRank: 3, minLevel: 5, requires: 'gravure', branch: 'atelier',
      desc: 'Par rang : −15% du coût de gravure, +XP de Runiste, +10% de chance de DROP de rune.' },
    { id: 'regles', name: 'Lois du monde', icon: '⚖️', maxRank: 1, minLevel: 8, minStage: 50, requires: 'gravure', branch: 'atelier',
      desc: 'Débloque les runes de RÈGLE : elles tordent le fonctionnement du jeu (loot, clés, économie).' },
    /* — ◈ VOIES : 1 maîtrise exclusive (re-choix libre) + Pactes — */
    { id: 'specChrono', name: 'Chronomancien', icon: '⏳', maxRank: 5, minLevel: 15, exclusive: 'runiste-spec', requires: 'gravure', branch: 'voies',
      desc: '◈ I→V : les runes de TEMPS gagnent +15% / +30% / +50% / +65% / +80% d\'efficacité. (Re-choix libre.)' },
    { id: 'specLegislateur', name: 'Législateur', icon: '🏛️', maxRank: 5, minLevel: 15, exclusive: 'runiste-spec', requires: 'regles', branch: 'voies',
      desc: '◈ I→V : règles AMPLIFIÉES aux étages III et V (Karma, Économe, Transmutation, knobs). (Re-choix libre.)' },
    { id: 'pactes', name: 'Sang d\'encre', icon: '🩸', maxRank: 1, minLevel: 12, minStage: 60, requires: 'gravure', branch: 'voies',
      desc: 'Débloque la gravure des PACTES : un keystone bonus/malus, UN SEUL actif par équipe. Forgés, jamais droppés.' },
    { id: 'specPactiste', name: 'Pactiste', icon: '🖤', maxRank: 5, minLevel: 15, exclusive: 'runiste-spec', requires: 'pactes', branch: 'voies',
      desc: '◈ I→V : les MALUS des pactes sont réduits de 5% / 10% / 15% / 20% / 30%. (Re-choix libre.)' },
    { id: 'doublePacte', name: 'Double pacte', icon: '⛓️', maxRank: 1, minLevel: 50, requires: 'specPactiste', requiresRank: 5, branch: 'voies', keystone: true,
      desc: 'DEUX pactes actifs simultanément — mais leurs malus repassent ×1,5. Le nœud le plus dangereux du jeu.' },
  ],
  // v0.26 — arbre REFONDU : l'Alchimiste devient le métier des CONSOMMABLES et du temps réel.
  // Tronc + 🧪 Officine (cuves, recettes, brassins) + ⚗️ Grand Œuvre (quintessences, synthèses)
  // + 🌿 Matière (recyclage, réactifs). ~58 rangs.
  // v0.28 E2 — arbre RÉDUIT : 2 sections, 12 nœuds. Officine = consommables & cuves.
  // Grand Œuvre = craft (quintessence/synthèses) + matière (Raffinage) + spé exclusive.
  alchimiste: [
    /* — 🧪 OFFICINE : consommables & cuves — */
    { id: 'officine', name: 'Officine', icon: '🫖', maxRank: 3, minLevel: 2, branch: 'officine',
      desc: 'Débloque l\'OFFICINE et l\'EXPÉRIMENTATION (découvre des recettes). Cuves de brassage : 2 (R1) · 3 (R2) · 4 (R3).' },
    { id: 'brasseur', name: 'Maître brasseur', icon: '✋', maxRank: 3, minLevel: 6, requires: 'officine', branch: 'officine',
      desc: 'Par rang : −10% de temps de maturation, +6% de chance de qualité supérieure, +chance de MILLÉSIME ★.' },
    { id: 'transmutJour', name: 'Transmutation du jour', icon: '🌗', maxRank: 1, minLevel: 10, branch: 'officine',
      desc: '1/JOUR réel : 4 Quintessences d\'un type → 1 du type de ton CHOIX.' },
    { id: 'pharmacopee', name: 'Pharmacopée', icon: '📖', maxRank: 1, minLevel: 25, requires: 'officine', branch: 'officine',
      desc: '+5% de durée des élixirs/huiles/antidotes par RECETTE découverte.' },
    { id: 'philosophale', name: 'Pierre philosophale', icon: '🜍', maxRank: 1, minLevel: 50, minStage: 100, requires: 'officine', branch: 'officine', keystone: true,
      desc: 'CAPSTONE : la Pierre philosophale (relique de compte : +2% de drops de ressources, pour toujours).' },
    /* — ⚗️ GRAND ŒUVRE : craft, synthèses, matière & spé — */
    { id: 'quintessence', name: 'Quintessence', icon: '⚗️', maxRank: 1, branch: 'oeuvre',
      desc: 'Débloque le craft typé à la QUINTESSENCE (lignes de dégâts / résistance choisies).' },
    { id: 'raffinage', name: 'Raffinage', icon: '🌿', maxRank: 3, minLevel: 5, requires: 'quintessence', branch: 'oeuvre',
      desc: 'Par rang : −coût des Quintessences, +éclats & Quintessences au recyclage, +drop de réactifs, +chance de ne pas les consommer.' },
    { id: 'synthese1', name: 'Synthèse I — Infusion', icon: '✨', maxRank: 1, minLevel: 8, minStage: 80, requires: 'quintessence', branch: 'oeuvre',
      desc: 'Infuser un Fragment d\'éternité : ajoute un effet unique ALÉATOIRE (ou monte son rang).' },
    { id: 'synthese2', name: 'Synthèse II — Essence ciblée', icon: '🧬', maxRank: 1, minLevel: 14, minStage: 80, requires: 'synthese1', branch: 'oeuvre',
      desc: 'Insérer une essence d\'unique recyclé : un effet SEMI-CIBLÉ (celui de l\'essence).' },
    { id: 'synthese3', name: 'Synthèse III — Invocation', icon: '💫', maxRank: 1, minLevel: 20, minStage: 100, requires: 'synthese2', branch: 'oeuvre', keystone: true,
      desc: 'L\'acte final du craft : invoquer l\'effet unique de ton CHOIX (Éclats cosmiques).' },
    { id: 'specTransmutateur', name: 'Catalyseur', icon: '⚗️', maxRank: 5, minLevel: 15, exclusive: 'alchimiste-spec', requires: 'quintessence', branch: 'oeuvre',
      desc: '◈ I→V : Quintessences −10/−15/−25/−30/−35% · étage III : recyclage rembourse 100% des Quintessences. (Re-choix libre.)' },
    { id: 'specDistillateur', name: 'Distillateur', icon: '⚱️', maxRank: 5, minLevel: 15, exclusive: 'alchimiste-spec', requires: 'quintessence', branch: 'oeuvre',
      desc: '◈ I→V : éclats au recyclage +10/+15/+25/+30/+35% · étage III : essences d\'uniques ×2. (Re-choix libre.)' },
  ],
}

/** Bonus de Compagnonnage applicables au craft d'un TYPE de pièce donné (majeur puis mineur). */
/** v0.28 E2 — affixes proposables à la Signature (au choix, UNIVERSEL) : union des anciennes
 *  listes de corps de métier, sans lock-in de spécialisation. */
export const SIGNATURE_CHOICES: SecondaryStat[] = ['critique', 'tenacite', 'reductionDegats', 'barriere', 'hate', 'esquive', 'alteration', 'precision']

/** Bonus de CRÉATION universels (v0.28 E2) — dérivés de Maître forgeron + Signature, appliqués à
 *  TOUTES les pièces (le Compagnonnage par corps a été retiré : plus de lock-in). */
export interface ForgeBonus {
  /** +iLvl plancher à la création (Maître forgeron R1). */
  ilvlBonus: number
  /** Affixes Signature proposables (au choix) si la Signature est débloquée, sinon null. */
  signatures: SecondaryStat[] | null
  /** Chance de rareté supérieure à la création (Maître forgeron R2). */
  luckBonus: number
  /** Chef-d'œuvre hebdomadaire disponible (Maître forgeron R3). */
  masterwork: boolean
  /** Multiplicateur d'XP de forge. */
  xpMult: number
}

export function forgeBonus(mods: CraftMods): ForgeBonus {
  const r = mods.maitreForgeron
  return {
    ilvlBonus: r >= 1 ? 1 : 0,
    luckBonus: r >= 2 ? 0.12 : 0,
    masterwork: r >= 3,
    xpMult: 1 + r * 0.05,
    signatures: mods.signature ? SIGNATURE_CHOICES : null,
  }
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
  // v0.28 — changer de spé exclusive est GRATUIT (no-regret) : les rangs de la rivale sont remboursés.
  let exclusiveRefund = 0
  if (def.exclusive && rank === 0) {
    const rival = METIER_NODES[metier].find((n) => n.exclusive === def.exclusive && n.id !== nodeId && (state.nodes[n.id] ?? 0) > 0)
    if (rival) exclusiveRefund = state.nodes[rival.id] ?? 0
  }
  if (pointsAvailable(state) + exclusiveRefund < 1) return { ok: false, reason: 'Aucun point disponible — pratique ton métier.' }
  if (def.minLevel && levelFromXp(state.xp) < def.minLevel) return { ok: false, reason: `Niveau de métier ${def.minLevel} requis.` }
  if (def.minStage && bestStage < def.minStage) return { ok: false, reason: `Palier ${def.minStage} requis.` }
  const needRank = def.requiresRank ?? 1
  if (def.requires && (state.nodes[def.requires] ?? 0) < needRank) {
    const parent = getMetierNode(metier, def.requires)
    return { ok: false, reason: `Requiert « ${parent?.name ?? def.requires} »${needRank > 1 ? ` rang ${needRank}` : ''}.` }
  }
  // (v0.28 : plus de blocage exclusif — choisir une autre spé la remplace gratuitement, voir learnMetierNode.)
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
  /** v0.28 E2 — Maître forgeron : rang 0–3 (bonus UNIVERSELS de création : +iLvl, +rareté, Chef-d'œuvre). */
  maitreForgeron: number
  /** v0.28 E2 — Signature débloquée : affixe garanti AU CHOIX sur une création (coûte des Lingots). */
  signature: boolean
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
  return {
    // v0.28 E2 — Forgeron remappé sur l'arbre réduit (Atelier + Manufacture).
    costMult: Math.max(0.4, 1 - r('forgeron', 'econome') * 0.05),
    luckChance: Math.min(0.6, r('forgeron', 'chance') * 0.05),
    surillvl: r('forgeron', 'surillvl') > 0,
    surillvlStep: r('forgeron', 'surillvl') >= 2 ? 3 : 2,
    transmute: r('forgeron', 'transmute') > 0,
    ascend: r('forgeron', 'ascension') > 0,
    automates: r('forgeron', 'automates') > 0,
    automateDurMult: 1 - r('forgeron', 'montage') * 0.08,
    forgeronXpMult: 1 + r('forgeron', 'maitreForgeron') * 0.05,
    maitreForgeron: r('forgeron', 'maitreForgeron'),
    signature: r('forgeron', 'signature') > 0,
    inspiration: Math.min(0.12, r('forgeron', 'chance') * 0.02),
    serendipite: r('forgeron', 'econome') * 0.04,
    verrousMult: Math.max(0.55, 1 - r('forgeron', 'econome') * 0.05),
    contrats: r('forgeron', 'fonderie') > 0,
    negociant: r('forgeron', 'maitreFondeur'),
    fonderie: r('forgeron', 'fonderie') > 0,
    lingotierMult: 1 + r('forgeron', 'maitreFondeur') * 0.15,
    trempeLente: r('forgeron', 'trempeLente') > 0,
    polissage: r('forgeron', 'polissage') > 0,
    polishFin: Math.max(0, r('forgeron', 'polissage') - 1),
    moules: false,
    automate4: r('forgeron', 'automate4') > 0,
    // v0.28 E2 — Joaillier remappé sur l'arbre réduit (Taillerie + Maîtrise & Sources).
    gems: r('joaillier', 'sertissage') > 0,
    unsocketCostMult: Math.max(0.5, 1 - r('joaillier', 'lapidaire') * 0.1),
    gemDropMult: 1 + r('joaillier', 'prospecteur') * 0.25,
    weaponSocketBonus: r('joaillier', 'synergies') > 0 ? 1 : 0,
    broyage: r('joaillier', 'taille') > 0,
    taille: r('joaillier', 'taille') > 0,
    recoupe: r('joaillier', 'recoupe') > 0,
    gemSpec:
      r('joaillier', 'specRythme') > 0 ? { family: 'rythme', tier: r('joaillier', 'specRythme') }
      : r('joaillier', 'specFlux') > 0 ? { family: 'flux', tier: r('joaillier', 'specFlux') }
      : r('joaillier', 'specEnv') > 0 ? { family: 'environnement', tier: r('joaillier', 'specEnv') }
      : r('joaillier', 'specBastion') > 0 ? { family: 'bastion', tier: r('joaillier', 'specBastion') }
      : null,
    doubleAllegeance: false,
    joaillierXpMult: 1 + r('joaillier', 'lapidaire') * 0.05,
    mainSure: r('joaillier', 'taille') >= 2 ? 3 : 0,
    tailleRank2: r('joaillier', 'taille') >= 2 ? 0.1 : 0,
    multitaille: r('joaillier', 'lapidaire') * 0.03,
    grindMult: 1 + r('joaillier', 'lapidaire') * 0.06,
    tailleCostMult: Math.max(0.5, 1 - r('joaillier', 'lapidaire') * 0.1),
    fusion: r('joaillier', 'fusion') > 0,
    fuseCostMult: Math.max(0.4, 1 - r('joaillier', 'lapidaire') * 0.1),
    corruption: r('joaillier', 'corruption') > 0,
    pacteLapidaire: r('joaillier', 'corruption') > 0 ? 3 : 0,
    corruptSafe: r('joaillier', 'corruption') > 0,
    chasseRoyale: r('joaillier', 'synergies') > 0,
    sertiConducteur: r('joaillier', 'synergies') * 0.04,
    mosaique: r('joaillier', 'synergies') * 0.03,
    percage: r('joaillier', 'percage') > 0,
    tamis: r('joaillier', 'prospecteur') > 0,
    nezLapidaire: r('joaillier', 'prospecteur') > 0,
    marcheAuxPierres: r('joaillier', 'marche') > 0,
    catalogue: r('joaillier', 'marche') > 0,
    enchant: r('runiste', 'gravure') > 0,
    ruleRunes: r('runiste', 'regles') > 0,
    enchantCostMult: Math.max(0.4, 1 - r('runiste', 'runologue') * 0.15),
    runisteXpMult: 1 + r('runiste', 'runologue') * 0.1,
    // ◈ Chronomancien I→V : 1,15 / 1,3 / 1,5 / 1,65 / 1,8 — + Horloger (+5%/rang).
    runisteTempo: [1, 1.15, 1.3, 1.5, 1.65, 1.8][Math.min(5, r('runiste', 'specChrono'))],
    ruleAmpTier: r('runiste', 'specLegislateur'),
    loiAmplifiee: r('runiste', 'specLegislateur') >= 3,
    pactes: r('runiste', 'pactes') > 0,
    pactMalusMult: 1 - [0, 0.05, 0.1, 0.15, 0.2, 0.3][Math.min(5, r('runiste', 'specPactiste'))],
    doublePacte: r('runiste', 'doublePacte') > 0,
    effacement: r('runiste', 'effacement') > 0,
    forgeRunique: r('runiste', 'forgeRunique') > 0,
    surchargeRunique: r('runiste', 'surchargeRunique') > 0,
    greffierMult: 1 + r('runiste', 'runologue') * 0.1,
    quint: r('alchimiste', 'quintessence') > 0,
    // v0.28 E2 — Alchimiste remappé sur l'arbre réduit (Officine + Grand Œuvre). Raffinage fond
    // rendementQ/distillation/condensation/herboriste/doubleDistillation ; Maître brasseur fond
    // brassageRapide/brassageCritique/grandsCrus ; officine porte le nombre de cuves.
    // ◈ Distillateur I→V : +10/15/25/30/35% (étage III = ancien rang 1).
    recycleMult: (1 + r('alchimiste', 'raffinage') * 0.1)
      * (1 + [0, 0.1, 0.15, 0.25, 0.3, 0.35][Math.min(5, r('alchimiste', 'specDistillateur'))]),
    quintDropMult: 1 + r('alchimiste', 'raffinage') * 0.2,
    synth1: r('alchimiste', 'synthese1') > 0,
    synth2: r('alchimiste', 'synthese2') > 0,
    synth3: r('alchimiste', 'synthese3') > 0,
    distillateur: r('alchimiste', 'specDistillateur') >= 3,
    // ◈ Catalyseur I→V (−10/15/25/30/35%) × Raffinage (−4%/rang).
    quintCostMult: [1, 0.9, 0.85, 0.75, 0.7, 0.65][Math.min(5, r('alchimiste', 'specTransmutateur'))]
      * (1 - r('alchimiste', 'raffinage') * 0.04),
    quintRefundFull: r('alchimiste', 'specTransmutateur') >= 3,
    alchimisteXpMult: 1 + r('alchimiste', 'raffinage') * 0.05,
    officine: r('alchimiste', 'officine') > 0,
    cuves: r('alchimiste', 'officine') > 0 ? 1 + r('alchimiste', 'officine') : 0,
    brewTimeMult: 1 - r('alchimiste', 'brasseur') * 0.1,
    brewCrit: r('alchimiste', 'brasseur') * 0.06,
    grandsCrus: r('alchimiste', 'brasseur'),
    herboristeMult: 1 + r('alchimiste', 'raffinage') * 0.08,
    doubleDistillation: r('alchimiste', 'raffinage') * 0.05,
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
