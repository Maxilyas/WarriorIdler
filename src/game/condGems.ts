import type { Character, DamageType, GemInstance } from './types'

/**
 * GEMMES DE CONDITION (v0.22, refonte v0.26) — LE système de gemmes.
 *
 * Plus AUCUNE stat plate : chaque gemme déclenche un COMPORTEMENT de combat. QUATRE familles :
 *  - 🥁 RYTHME        : compteurs (attaques, sorts, kills) — le tempo du combat.
 *  - 🌊 FLUX          : gestion de ressources (PV, soins, recharges, boucliers).
 *  - 🌍 ENVIRONNEMENT : l'état du monde (télégraphes, Surcharge, donjons, raids, champions).
 *  - 🛡️ BASTION       : la défense (v0.26) — anti-burst, épines, redirections. Biome Physique.
 *
 * Chaque gemme a UN paramètre chiffré (équilibrable), amélioré par la RECOUPE (rang 1→maxRank)
 * et par la QUALITÉ (v0.26 : Éclatée ▾ / Polie / Parfaite ▴ — roulée à la TAILLE). Les effets
 * sont agrégés au niveau de l'ÉQUIPE (meilleure instance portée). Doublons inutiles → FUSION
 * (3 identiques → rang +1) ou broyage en poussière 💠.
 *
 * v0.26 : drops ×0,4 (le drop redevient un événement) — la poussière est LA monnaie, le
 * Joaillier taille/fusionne/corrompt pour produire ce que le hasard ne donne plus.
 */

export type GemFamily = 'rythme' | 'flux' | 'environnement' | 'bastion'

export const GEM_FAMILIES: Record<GemFamily, { name: string; icon: string; color: string }> = {
  rythme: { name: 'Rythme', icon: '🥁', color: '#fbbf24' },
  flux: { name: 'Flux', icon: '🌊', color: '#38bdf8' },
  environnement: { name: 'Environnement', icon: '🌍', color: '#4ade80' },
  bastion: { name: 'Bastion', icon: '🛡️', color: '#94a3b8' },
}

export const GEM_FAMILY_LIST = Object.keys(GEM_FAMILIES) as GemFamily[]

export type CondGemId =
  // historiques
  | 'metronome' | 'echo' | 'crescendo' | 'overkill' | 'conquete'
  | 'pacte' | 'souffle' | 'tresorerie' | 'acharne'
  | 'opportuniste' | 'orage' | 'nuee'
  // v0.26 — 🥁 Rythme
  | 'tambour' | 'hemorragie' | 'glas' | 'riposte' | 'ostinato'
  | 'cadence' | 'marche' | 'detonation' | 'carillon' | 'dacapo'
  // v0.26 — 🌊 Flux
  | 'calice' | 'fievre' | 'perfusion' | 'vases' | 'garrot'
  | 'reservoir' | 'tension' | 'echangeur' | 'testament' | 'goutte'
  // v0.26 — 🌍 Environnement
  | 'boussole' | 'sceauGemme' | 'trophee' | 'prisme' | 'paratonnerre'
  | 'premiere' | 'cartographe' | 'sixieme' | 'piedDuMur' | 'veineMere'
  // v0.26 — 🛡️ Bastion
  | 'egide' | 'rempart' | 'carapace' | 'ancrage' | 'cilice'
  | 'verreTrempe' | 'doctrine' | 'granit' | 'tourGarde' | 'memoirePierre'

export interface CondGemDef {
  id: CondGemId
  family: GemFamily
  name: string
  icon: string
  color: string
  /** Valeur du paramètre par rang (index = rang − 1). maxRank = values.length. */
  values: number[]
  /** Description paramétrée (reçoit la valeur du rang courant). */
  desc: (v: number) => string
}

export const COND_GEMS: Record<CondGemId, CondGemDef> = {
  /* ================= 🥁 RYTHME — compteurs ================= */
  metronome: {
    id: 'metronome', family: 'rythme', name: 'Métronome', icon: '🎼', color: '#fbbf24',
    values: [10, 9, 8, 7, 6],
    desc: (v) => `Toutes les ${v} attaques auto, la suivante est un CRITIQUE garanti.`,
  },
  echo: {
    id: 'echo', family: 'rythme', name: 'Pierre d\'Écho', icon: '🔔', color: '#f59e0b',
    values: [6, 5, 4, 3],
    desc: (v) => `Tous les ${v} sorts lancés par l'équipe, le suivant résonne une 2e fois (50% d'effet).`,
  },
  crescendo: {
    id: 'crescendo', family: 'rythme', name: 'Crescendo', icon: '📯', color: '#fb923c',
    values: [20, 28, 36, 44, 52],
    desc: (v) => `+1% de dégâts par ennemi tué (cap +${v}%). Remis à zéro si l'équipe tombe.`,
  },
  overkill: {
    id: 'overkill', family: 'rythme', name: 'Étoile d\'Overkill', icon: '🌠', color: '#ffd43b',
    values: [1],
    desc: () => 'L\'excédent de dégâts du coup fatal frappe l\'ennemi SUIVANT. Le farm s\'enchaîne.',
  },
  conquete: {
    id: 'conquete', family: 'rythme', name: 'Fragment de Conquête', icon: '🏆', color: '#fb923c',
    values: [1],
    desc: () => 'Tuer un boss ou une élite remet à zéro la plus longue recharge de chaque héros.',
  },
  tambour: {
    id: 'tambour', family: 'rythme', name: 'Tambour de siège', icon: '🥁', color: '#f97316',
    values: [10, 13, 16, 18, 20],
    desc: (v) => `Toutes les 8 attaques sur la MÊME cible : Brèche — son armure −${v}% pendant 6 s.`,
  },
  hemorragie: {
    id: 'hemorragie', family: 'rythme', name: 'Hémorragie cadencée', icon: '🩸', color: '#ef4444',
    values: [6, 5, 4, 3],
    desc: (v) => `Tous les ${v} CRITIQUES : pose un saignement (60% du coup sur 6 s, amplifié par l'Altération).`,
  },
  glas: {
    id: 'glas', family: 'rythme', name: 'Glas', icon: '🔔', color: '#a3e635',
    values: [8, 7, 6, 5, 4],
    desc: (v) => `Tous les ${v} ennemis tués : l'équipe est soignée de 5% des PV max.`,
  },
  riposte: {
    id: 'riposte', family: 'rythme', name: 'Riposte mesurée', icon: '🤺', color: '#fda4af',
    values: [8, 7, 6, 5, 4],
    desc: (v) => `Toutes les ${v} s passées sous le feu ennemi, le héros visé riposte automatiquement (100% de l'arme).`,
  },
  ostinato: {
    id: 'ostinato', family: 'rythme', name: 'Ostinato', icon: '🎻', color: '#fcd34d',
    values: [1, 1.5, 2, 2.5, 3],
    desc: (v) => `Chaque attaque SANS critique : +${v}% de chance de critique cumulée (vidée au prochain crit).`,
  },
  cadence: {
    id: 'cadence', family: 'rythme', name: 'Cadence parfaite', icon: '🪘', color: '#fbbf24',
    values: [12, 10, 8, 7, 6],
    desc: (v) => `Toutes les ${v} attaques auto, la suivante MULTIFRAPPE (frappe deux fois).`,
  },
  marche: {
    id: 'marche', family: 'rythme', name: 'Marche triomphale', icon: '🎺', color: '#f59e0b',
    values: [10, 14, 18, 21, 25],
    desc: (v) => `+0,5% de dégâts par combat gagné SANS mort (cap +${v}%). Perdu si un héros tombe.`,
  },
  detonation: {
    id: 'detonation', family: 'rythme', name: 'Détonation arcanique', icon: '💥', color: '#c084fc',
    values: [8, 7, 6, 5, 4],
    desc: (v) => `Tous les ${v} sorts : le suivant frappe AUSSI les autres ennemis du pack (50% des dégâts).`,
  },
  carillon: {
    id: 'carillon', family: 'rythme', name: 'Carillon', icon: '🛎️', color: '#fde047',
    values: [6, 5, 4, 3],
    desc: (v) => `Tous les ${v} lancements de capacité : la recharge du suivant est réduite de MOITIÉ.`,
  },
  dacapo: {
    id: 'dacapo', family: 'rythme', name: 'Da capo', icon: '🔁', color: '#fb923c',
    values: [40, 35, 30, 25, 20],
    desc: (v) => `Au-delà de ${v} s de combat : tes compteurs de RYTHME avancent deux fois plus vite.`,
  },

  /* ================= 🌊 FLUX — ressources ================= */
  pacte: {
    id: 'pacte', family: 'flux', name: 'Pacte sanglant', icon: '🩸', color: '#f87171',
    values: [10, 14, 18, 22, 26],
    desc: (v) => `Recharges des capacités −${v}%, mais chaque lancement coûte 2% des PV max.`,
  },
  souffle: {
    id: 'souffle', family: 'flux', name: 'Second Souffle', icon: '🫁', color: '#34d399',
    values: [20, 27, 34, 41, 50],
    desc: (v) => `Sous 30% des PV : +${v}% de dégâts. Le dos au mur rend féroce.`,
  },
  tresorerie: {
    id: 'tresorerie', family: 'flux', name: 'Trésorerie de guerre', icon: '🛡️', color: '#fde047',
    values: [10, 14, 18, 24, 30],
    desc: (v) => `Chaque kill blinde un bouclier de 2% des PV max (cumul jusqu'à ${v}%).`,
  },
  acharne: {
    id: 'acharne', family: 'flux', name: 'Sablier de l\'Acharné', icon: '⏳', color: '#c084fc',
    values: [50, 62, 74, 86, 100],
    desc: (v) => `+2% de dégâts par seconde passée sur le MÊME ennemi (cap +${v}%). Le tueur de murs.`,
  },
  calice: {
    id: 'calice', family: 'flux', name: 'Calice débordant', icon: '🏆', color: '#38bdf8',
    values: [10, 15, 20, 25, 30],
    desc: (v) => `L'excédent de soin devient un BOUCLIER (cumul jusqu'à ${v}% des PV max).`,
  },
  fievre: {
    id: 'fievre', family: 'flux', name: 'Fièvre de l\'hallali', icon: '🦷', color: '#f472b6',
    values: [5, 7, 9, 12, 15],
    desc: (v) => `Pendant 5 s après un kill de l'équipe : +${v}% de vol de vie.`,
  },
  perfusion: {
    id: 'perfusion', family: 'flux', name: 'Perfusion', icon: '💉', color: '#4ade80',
    values: [50, 75, 100, 125, 150],
    desc: (v) => `Les héros sous 50% des PV régénèrent +${v}% plus vite.`,
  },
  vases: {
    id: 'vases', family: 'flux', name: 'Vases communicants', icon: '⚱️', color: '#22d3ee',
    values: [10, 15, 20, 25, 30],
    desc: (v) => `Chaque soin de capacité soigne AUSSI le héros le plus blessé de ${v}% du montant.`,
  },
  garrot: {
    id: 'garrot', family: 'flux', name: 'Garrot', icon: '🪢', color: '#86efac',
    values: [30, 40, 50, 60, 70],
    desc: (v) => `Quand une altération subie EXPIRE : soigne ${v}% des dégâts qu'elle a infligés.`,
  },
  reservoir: {
    id: 'reservoir', family: 'flux', name: 'Réservoir pressurisé', icon: '🫙', color: '#60a5fa',
    values: [15, 21, 27, 33, 40],
    desc: (v) => `Chaque combat démarre avec un bouclier de ${v}% des PV max.`,
  },
  tension: {
    id: 'tension', family: 'flux', name: 'Sous tension', icon: '⚡', color: '#facc15',
    values: [20, 27, 34, 42, 50],
    desc: (v) => `Quand TOUTES les capacités d'un héros rechargent : ses auto-attaques +${v}%.`,
  },
  echangeur: {
    id: 'echangeur', family: 'flux', name: 'Échangeur', icon: '🔃', color: '#a5b4fc',
    values: [0.3, 0.45, 0.6, 0.75, 0.9],
    desc: (v) => `Par tranche de 10% des PV max subis : les recharges du héros avancent de ${v} s.`,
  },
  testament: {
    id: 'testament', family: 'flux', name: 'Testament', icon: '📜', color: '#e2e8f0',
    values: [15, 20, 25, 30, 35],
    desc: (v) => `Quand un héros tombe : les survivants gagnent un bouclier de ${v}% et +10% de dégâts 10 s.`,
  },
  goutte: {
    id: 'goutte', family: 'flux', name: 'Goutte-à-goutte', icon: '💧', color: '#67e8f9',
    values: [20, 27, 34, 42, 50],
    desc: (v) => `Le vol de vie en EXCÈS (PV pleins) est conservé à ${v}% en régénération différée.`,
  },

  /* ================= 🌍 ENVIRONNEMENT — l'état du monde ================= */
  opportuniste: {
    id: 'opportuniste', family: 'environnement', name: 'Œil de l\'Opportuniste', icon: '👁️', color: '#4ade80',
    values: [30, 40, 50, 65, 80],
    desc: (v) => `Pendant qu'un ennemi INCANTE (télégraphe ⚠️) : +${v}% de dégâts.`,
  },
  orage: {
    id: 'orage', family: 'environnement', name: 'Chasseur d\'orage', icon: '🌩️', color: '#facc15',
    values: [15, 20, 25, 32, 40],
    desc: (v) => `Dans le biome en ⚡ Surcharge : +${v}% de dégâts.`,
  },
  nuee: {
    id: 'nuee', family: 'environnement', name: 'Cœur de Nuée', icon: '🐝', color: '#66bb6a',
    values: [7, 8, 9, 10, 12],
    desc: (v) => `+${v}% de dégâts par ennemi vivant au-delà du premier (cap +${v * 5}%). Roi des packs.`,
  },
  boussole: {
    id: 'boussole', family: 'environnement', name: 'Boussole du traqueur', icon: '🧭', color: '#fbbf24',
    values: [20, 27, 34, 42, 50],
    desc: (v) => `Les CHAMPIONS ✦ subissent +${v}% de dégâts. Le jackpot tombe plus vite.`,
  },
  sceauGemme: {
    id: 'sceauGemme', family: 'environnement', name: 'Pierre de sceau', icon: '🗝️', color: '#94a3b8',
    values: [4, 5, 6, 8, 10],
    desc: (v) => `En DONJON : +${v}% de dégâts par modificateur actif du donjon.`,
  },
  trophee: {
    id: 'trophee', family: 'environnement', name: 'Trophée de guerre', icon: '🏅', color: '#f87171',
    values: [10, 15, 20, 25, 30],
    desc: (v) => `En RAID : +${v} points de RÉSISTANCE à tous les types pour toute l'équipe.`,
  },
  prisme: {
    id: 'prisme', family: 'environnement', name: 'Prisme d\'accord', icon: '🔮', color: '#c084fc',
    values: [10, 14, 18, 21, 25],
    desc: (v) => `En farm : ${v}% de tes dégâts sont CONVERTIS dans le type du biome courant.`,
  },
  paratonnerre: {
    id: 'paratonnerre', family: 'environnement', name: 'Paratonnerre', icon: '🌂', color: '#a5f3fc',
    values: [10, 14, 18, 21, 25],
    desc: (v) => `Dans le biome en ⚡ Surcharge : −${v}% de dégâts subis.`,
  },
  premiere: {
    id: 'premiere', family: 'environnement', name: 'Première impression', icon: '🎯', color: '#fb7185',
    values: [15, 21, 27, 33, 40],
    desc: (v) => `Le PREMIER ennemi de chaque pack (2+) subit +${v}% de dégâts. L'ouverture compte.`,
  },
  cartographe: {
    id: 'cartographe', family: 'environnement', name: 'Cartographe', icon: '🗺️', color: '#fcd34d',
    values: [10, 14, 18, 21, 25],
    desc: (v) => `Les COFFRES de donjon rendent +${v}% de ressources.`,
  },
  sixieme: {
    id: 'sixieme', family: 'environnement', name: 'Sixième sens', icon: '💫', color: '#93c5fd',
    values: [15, 21, 27, 33, 40],
    desc: (v) => `Pendant qu'un ennemi INCANTE : l'équipe subit −${v}% de dégâts (miroir de l'Opportuniste).`,
  },
  piedDuMur: {
    id: 'piedDuMur', family: 'environnement', name: 'Pied du mur', icon: '🧗', color: '#fdba74',
    values: [10, 14, 18, 21, 25],
    desc: (v) => `En farm, à 2 paliers ou moins de ton RECORD : +${v}% de dégâts. La gemme du push.`,
  },
  veineMere: {
    id: 'veineMere', family: 'environnement', name: 'Veine mère', icon: '⛏️', color: '#a8a29e',
    values: [15, 21, 27, 33, 40],
    desc: (v) => `Les poussières (💠 gemme et 🌌 étoile) droppent +${v}% souvent.`,
  },

  /* ================= 🛡️ BASTION — la défense (v0.26, biome Physique) ================= */
  egide: {
    id: 'egide', family: 'bastion', name: 'Égide du premier sang', icon: '🛡️', color: '#94a3b8',
    values: [30, 38, 45, 53, 60],
    desc: (v) => `Le PREMIER coup subi par chaque héros à chaque combat est réduit de ${v}%. L'anti-burst.`,
  },
  rempart: {
    id: 'rempart', family: 'bastion', name: 'Rempart', icon: '🧱', color: '#cbd5e1',
    values: [3, 4, 5, 6],
    desc: (v) => `−${v}% de dégâts subis par ennemi vivant au-delà du premier (cap ×5). Miroir de la Nuée.`,
  },
  carapace: {
    id: 'carapace', family: 'bastion', name: 'Carapace réactive', icon: '🐢', color: '#86efac',
    values: [10, 14, 18, 21, 25],
    desc: (v) => `Après un coup ≥ 15% des PV max : bouclier de ${v}% des PV (10 s de recharge).`,
  },
  ancrage: {
    id: 'ancrage', family: 'bastion', name: 'Ancrage', icon: '⚓', color: '#7dd3fc',
    values: [5, 7, 9, 12, 15],
    desc: (v) => `Tant qu'AUCUN héros n'est tombé ce combat : −${v}% de dégâts subis.`,
  },
  cilice: {
    id: 'cilice', family: 'bastion', name: 'Cilice', icon: '🌵', color: '#bef264',
    values: [15, 21, 27, 33, 40],
    desc: (v) => `Renvoie ${v}% des dégâts subis à l'attaquant. Le build ÉPINES existe enfin.`,
  },
  verreTrempe: {
    id: 'verreTrempe', family: 'bastion', name: 'Verre trempé', icon: '🪟', color: '#e0f2fe',
    values: [8, 11, 14, 17, 20],
    desc: (v) => `Après 4 s sans subir le moindre coup : +${v}% de dégâts (perdu au prochain coup subi).`,
  },
  doctrine: {
    id: 'doctrine', family: 'bastion', name: 'Doctrine du bouclier', icon: '🔰', color: '#93c5fd',
    values: [20, 27, 34, 42, 50],
    desc: (v) => `Le porteur d'un BOUCLIER partage ${v}% de sa Barrière avec l'équipe (bouclier de début de combat).`,
  },
  granit: {
    id: 'granit', family: 'bastion', name: 'Granit', icon: '🪨', color: '#a8a29e',
    values: [15, 20, 25, 30, 35],
    desc: (v) => `Sous 30% des PV : −${v}% de dégâts subis. Miroir défensif du Second Souffle.`,
  },
  tourGarde: {
    id: 'tourGarde', family: 'bastion', name: 'Tour de garde', icon: '🗼', color: '#d6d3d1',
    values: [25, 34, 43, 51, 60],
    desc: (v) => `${v}% des coups visant un héros sous 30% PV sont redirigés vers le plus endurant.`,
  },
  memoirePierre: {
    id: 'memoirePierre', family: 'bastion', name: 'Mémoire de la pierre', icon: '🗿', color: '#d4d4d8',
    values: [30, 40, 50, 60, 70],
    desc: (v) => `La TÉNACITÉ réduit aussi les coups télégraphés, à ${v}% de sa valeur.`,
  },
}

export const COND_GEM_LIST: CondGemDef[] = Object.values(COND_GEMS)

export function getCondGem(id: string): CondGemDef | undefined {
  return COND_GEMS[id as CondGemId]
}

export function gemMaxRank(def: CondGemDef): number {
  return def.values.length
}

/* ------------------------------------------------------------------ */
/* Qualité (v0.26) — Éclatée ▾ / Polie / Parfaite ▴                     */
/* ------------------------------------------------------------------ */

/** 0 = Éclatée (−), 1 = Polie (neutre), 2 = Parfaite (+). Roulée à la TAILLE, jamais au drop. */
export type GemQuality = 0 | 1 | 2

export const GEM_QUALITIES: Record<GemQuality, { name: string; mark: string; color: string }> = {
  0: { name: 'Éclatée', mark: '▾', color: '#9ca3af' },
  1: { name: 'Polie', mark: '', color: '#e2e8f0' },
  2: { name: 'Parfaite', mark: '▴', color: '#fbbf24' },
}

/** true si une valeur PLUS BASSE est meilleure (compteurs « toutes les N… », seuils en s). */
export function gemLowBetter(def: CondGemDef): boolean {
  return def.values.length > 1 && def.values[def.values.length - 1] < def.values[0]
}

/** Multiplicateur de qualité orienté (les gemmes à valeur unique ne sont pas affectées). */
function qualityMult(def: CondGemDef, quality: GemQuality): number {
  if (def.values.length <= 1 || quality === 1) return 1
  if (gemLowBetter(def)) return quality === 2 ? 0.9 : 1.1
  return quality === 2 ? 1.15 : 0.85
}

/** Valeur de BASE du paramètre à un rang donné (clampé), sans qualité ni spécialisation. */
export function gemValue(def: CondGemDef, rank: number): number {
  return def.values[Math.max(0, Math.min(def.values.length, rank) - 1)]
}

/**
 * Valeur EFFECTIVE : rang + qualité + multiplicateur de famille (◈ spec II/V du Joaillier).
 * `famMult` > 1 améliore (divise les valeurs « plus bas = mieux »). Arrondi à 1 décimale.
 */
export function gemValueQ(def: CondGemDef, rank: number, quality: GemQuality = 1, famMult = 1): number {
  let v = gemValue(def, rank) * qualityMult(def, quality)
  if (famMult !== 1 && def.values.length > 1) v = gemLowBetter(def) ? v / famMult : v * famMult
  if (gemLowBetter(def)) v = Math.max(1, v)
  return Math.round(v * 10) / 10
}

/** Description au rang donné (qualité/famille comprises si fournies). */
export function gemDesc(def: CondGemDef, rank = 1, quality: GemQuality = 1, famMult = 1): string {
  return def.desc(gemValueQ(def, rank, quality, famMult))
}

/* ------------------------------------------------------------------ */
/* Clés de stock                                                       */
/* ------------------------------------------------------------------ */

/** Clé de stock : `cond:id[:rang[:qualité]]` — rang 1 Polie = `cond:id` (compat v0.22-25). */
export function condGemKey(id: CondGemId, rank = 1, quality: GemQuality = 1): string {
  if (quality !== 1) return `cond:${id}:${rank}:${quality}`
  return rank > 1 ? `cond:${id}:${rank}` : `cond:${id}`
}

/** Décode une clé de stock. Renvoie null si la gemme n'existe pas/plus. */
export function parseCondKey(key: string): { def: CondGemDef; rank: number; quality: GemQuality } | null {
  if (!key.startsWith('cond:')) return null
  const [, id, rank, quality] = key.split(':')
  const def = getCondGem(id)
  if (!def) return null
  const q = Number(quality)
  return {
    def,
    rank: Math.max(1, Math.min(gemMaxRank(def), Number(rank) || 1)),
    quality: (q === 0 || q === 2 ? q : 1) as GemQuality,
  }
}

/** Instance sertissable (type/tier vestigiels, `cond` + `rank` + `quality` font foi). */
export function condGemInstance(id: CondGemId, rank = 1, quality: GemQuality = 1): GemInstance {
  return { type: 'physique', tier: 0, cond: id, rank, ...(quality !== 1 ? { quality } : {}) }
}

/* ------------------------------------------------------------------ */
/* Drops                                                               */
/* ------------------------------------------------------------------ */

/** Famille de gemme qui tombe dans chaque biome — v0.26 : le Physique a la sienne (Bastion). */
export const BIOME_GEM_FAMILY: Partial<Record<DamageType, GemFamily>> = {
  feu: 'rythme', foudre: 'rythme',
  ombre: 'flux', nature: 'flux',
  arcane: 'environnement', froid: 'environnement',
  physique: 'bastion',
}

/** Tire une gemme au hasard, dans une famille donnée (ou toutes si absente). */
export function rollCondGem(family?: GemFamily): CondGemDef {
  const pool = family ? COND_GEM_LIST.filter((g) => g.family === family) : COND_GEM_LIST
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Chance de drop d'une gemme de condition dans le biome, par rang d'ennemi.
 *  v0.26 : ×0,4 (retour joueur « trop de gemmes ») — la TAILLE et la FUSION compensent. */
export const COND_GEM_DROP = { normal: 0.0012, elite: 0.008, boss: 0.02 }
/** Chance de drop des champions ✦ (v0.26 : 12% → 8%). */
export const CHAMPION_GEM_DROP = 0.08
/** Chance et montants de drop de POUSSIÈRE de gemme 💠, par rang d'ennemi (INCHANGÉ v0.26 :
 *  la poussière est la monnaie du Joaillier, c'est elle qui doit couler). */
export const GEM_DUST_DROP = { chance: { normal: 0.06, elite: 0.2, boss: 0.35 }, amount: { normal: 2, elite: 5, boss: 10 } }

/* ------------------------------------------------------------------ */
/* Poussière : broyage / taille / recoupe / fusion / corruption (v0.26)*/
/* ------------------------------------------------------------------ */

/** Poussière rendue par le broyage (+ par rang recoupé, ± par qualité). */
export function grindDust(rank = 1, quality: GemQuality = 1): number {
  const base = 15 + 10 * (Math.max(1, rank) - 1)
  return Math.round(base * (quality === 2 ? 1.3 : quality === 0 ? 0.7 : 1))
}

/** Poussière rendue par une ANCIENNE gemme élémentaire (migration v0.22). */
export function legacyGemDust(tier: number): number {
  return 2 * Math.pow(3, Math.max(1, tier) - 1) // Éclatée 2 · Polie 6 · Parfaite 18
}

/** Coût de TAILLE d'une gemme au choix (rang 1, qualité roulée). */
export const GEM_CUT_COST = 60

/** Coût de RECOUPE : passer du rang `rank` au suivant (la qualité est conservée). */
export function recutCost(rank: number): number {
  return 25 * (rank + 1) // 50 · 75 · 100 · 125
}

/** FUSION (v0.26) : 3 gemmes identiques (id + rang + qualité) → 1 au rang +1 (qualité conservée). */
export const GEM_FUSE_COUNT = 3
export const GEM_FUSE_COST = 30

/** CORRUPTION (v0.26, PoE) : retaille risquée d'une gemme du stock. */
export const GEM_CORRUPT_COST = 40
/** Probabilités [rang +1, rien, broyée] — améliorées par « Pacte du lapidaire » (rangs). */
export function corruptOdds(pacteRank = 0): [number, number, number] {
  const up = 0.45 + 0.034 * pacteRank   // 45% → ~55% à rang 3
  const destroy = Math.max(0.05, 0.2 - 0.017 * pacteRank) // 20% → ~15%
  return [up, Math.max(0, 1 - up - destroy), destroy]
}

/** Tirage de QUALITÉ à la taille : [Éclatée, Polie, Parfaite], amélioré par « Main sûre ». */
export function cutQualityOdds(mainSureRank = 0): [number, number, number] {
  const parfaite = 0.15 + 0.04 * mainSureRank // 15% → 35% à rang 5
  const eclatee = Math.max(0, 0.2 - 0.04 * mainSureRank) // 20% → 0% à rang 5
  return [eclatee, Math.max(0, 1 - parfaite - eclatee), parfaite]
}

export function rollCutQuality(mainSureRank = 0): GemQuality {
  const [e, p] = cutQualityOdds(mainSureRank)
  const r = Math.random()
  if (r < e) return 0
  if (r < e + p) return 1
  return 2
}

/** PERÇAGE (v0.26) : ajouter UNE châsse à un objet qui n'en a pas le maximum (1×/objet). */
export function drillCost(rarityTier: number): { dust: number; gold: number } {
  return { dust: 120 + 30 * rarityTier, gold: 40_000 * rarityTier }
}

/* ------------------------------------------------------------------ */
/* ◈ Spécialisations de famille (v0.26 : lignes étagées I→V)           */
/* ------------------------------------------------------------------ */

/** Spécialisation majeure du Joaillier : famille + étage (1..5). `minor` : 2e famille à +1 rang. */
export interface GemSpec {
  family: GemFamily
  tier: number
  minor?: GemFamily | null
}

/** Bonus de rang d'une famille selon la spec (I : +1 · IV : +2). */
function specRankBonus(spec: GemSpec | null | undefined, family: GemFamily): number {
  if (!spec) return 0
  if (spec.family === family) return (spec.tier >= 1 ? 1 : 0) + (spec.tier >= 4 ? 1 : 0)
  if (spec.minor === family) return 1
  return 0
}

/** Multiplicateur de paramètre d'une famille selon la spec (II : +10% · V : +15% cumulés). */
function specFamMult(spec: GemSpec | null | undefined, family: GemFamily): number {
  if (!spec || spec.family !== family) return 1
  return (spec.tier >= 2 ? 1.1 : 1) * (spec.tier >= 5 ? 1.15 : 1)
}

/* ------------------------------------------------------------------ */
/* Agrégation d'équipe (mods de combat)                                */
/* ------------------------------------------------------------------ */

/** Effets de gemmes actifs sur l'équipe — meilleure instance portée par gemme.
 *  Les champs « Pct » sont des FRACTIONS (0.3 = 30%). */
export interface CondMods {
  /* — historiques — */
  overkill?: boolean
  conquete?: boolean
  acharneCap?: number
  nueePer?: number
  metronomeN?: number
  echoN?: number
  crescendoCap?: number
  pacteCdr?: number
  souffle?: number
  tresorerieCap?: number
  opportuniste?: number
  orage?: number
  /* — 🥁 Rythme v0.26 — */
  /** Brèche : −% d'armure (fraction) toutes les 8 attaques sur la même cible, 6 s. */
  tambourPct?: number
  /** Saignement tous les N critiques (60% du coup sur 6 s). */
  hemorragieN?: number
  /** Soin d'équipe (5% PV max) tous les N kills. */
  glasN?: number
  /** Riposte automatique toutes les N s sous le feu. */
  riposteSec?: number
  /** +crit cumulé par attaque sans crit (fraction par stack). */
  ostinatoPer?: number
  /** Multifrappe garantie toutes les N attaques. */
  cadenceN?: number
  /** Cap de la Marche triomphale (fraction). */
  marcheCap?: number
  /** AoE 50% tous les N sorts. */
  detonationN?: number
  /** Recharge moitié prix tous les N lancements. */
  carillonN?: number
  /** Compteurs de rythme ×2 au-delà de N s de combat. */
  dacapoSec?: number
  /* — 🌊 Flux v0.26 — */
  caliceCap?: number
  fievreLeech?: number
  /** Bonus de régén sous 50% PV (fraction : 1 = +100%). */
  perfusionBonus?: number
  vasesPct?: number
  garrotPct?: number
  reservoirPct?: number
  tensionPct?: number
  /** Secondes de recharge avancées par tranche de 10% PV max subis. */
  echangeurSec?: number
  testamentPct?: number
  goutteePct?: number
  /* — 🌍 Environnement v0.26 — */
  boussolePct?: number
  sceauPct?: number
  /** Points de résistance offerts en raid. */
  tropheeRes?: number
  prismePct?: number
  paratonnerrePct?: number
  premierePct?: number
  cartographePct?: number
  sixiemePct?: number
  piedDuMurPct?: number
  veineMerePct?: number
  /* — 🛡️ Bastion v0.26 — */
  egidePct?: number
  /** Nombre de coups couverts par l'Égide (2 en ◈ Bastion V « Citadelle »). */
  egideHits?: number
  rempartPer?: number
  carapacePct?: number
  ancragePct?: number
  cilicePct?: number
  verreTrempePct?: number
  doctrinePct?: number
  granitPct?: number
  tourGardePct?: number
  memoirePct?: number
  /* — bonus de spec transverses — */
  /** ◈ Flux III : boucliers de gemmes ×1,25. */
  fluxShieldMult?: number
  /** ◈ Bastion III : les DoT subis −15%. */
  dotTakenMult?: number
  /** ◈ Environnement III : récompenses de coffres +10% (cumul Cartographe). */
  envChestPct?: number
}

/** Options d'agrégation calculées par le store depuis l'arbre du Joaillier (v0.26). */
export interface GemModOpts {
  /** Multiplicateur GLOBAL de paramètres (Mosaïque, Catalogue). */
  paramMult?: number
  /** Multiplicateur PAR FAMILLE (Serti conducteur : 2+ gemmes de la famille sur un héros). */
  familyMult?: Partial<Record<GemFamily, number>>
  /** Châsse royale : la gemme sertie dans l'ARME PRINCIPALE compte +1 rang. */
  chasseRoyale?: boolean
  /** Double allégeance : la famille la plus portée HORS spec gagne +1 rang. */
  autoMinor?: boolean
}

/** Famille la plus portée hors spécialisation (Double allégeance). */
function mostWornFamily(characters: Character[], exclude?: GemFamily): GemFamily | null {
  const counts = new Map<GemFamily, number>()
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      for (const g of it?.gems ?? []) {
        const def = g.cond ? COND_GEMS[g.cond as CondGemId] : undefined
        if (!def || def.family === exclude) continue
        counts.set(def.family, (counts.get(def.family) ?? 0) + 1)
      }
    }
  }
  let best: GemFamily | null = null
  let bestN = 0
  for (const [f, n] of counts) if (n > bestN) { best = f; bestN = n }
  return best
}

/** Meilleure instance portée par gemme sur TOUTE l'équipe (rang+qualité, spec et opts comprises). */
export function condGemInstances(
  characters: Character[],
  spec?: GemSpec | null,
  opts?: GemModOpts,
): Map<CondGemId, { rank: number; quality: GemQuality }> {
  const out = new Map<CondGemId, { rank: number; quality: GemQuality }>()
  const minor = opts?.autoMinor ? mostWornFamily(characters, spec?.family) : spec?.minor ?? null
  const effSpec: GemSpec | null = spec ? { ...spec, minor } : minor ? { family: minor, tier: 0, minor } : null
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      for (const g of it?.gems ?? []) {
        if (!g.cond) continue
        const id = g.cond as CondGemId
        const def = COND_GEMS[id]
        if (!def) continue
        const bonus = specRankBonus(effSpec, def.family)
          + (opts?.chasseRoyale && slot === 'armePrincipale' ? 1 : 0)
        const rank = Math.min(gemMaxRank(def), (g.rank ?? 1) + bonus)
        const quality = ((g.quality === 0 || g.quality === 2) ? g.quality : 1) as GemQuality
        const prev = out.get(id)
        if (!prev) { out.set(id, { rank, quality }); continue }
        // Meilleure instance = meilleure valeur effective (direction comprise).
        const a = gemValueQ(def, rank, quality)
        const b = gemValueQ(def, prev.rank, prev.quality)
        const better = gemLowBetter(def) ? a < b : a > b
        if (better) out.set(id, { rank, quality })
      }
    }
  }
  return out
}

/** Compat : meilleur RANG porté par gemme (UI, anciens appels). */
export function condGemRanks(characters: Character[], spec?: GemSpec | null, opts?: GemModOpts): Map<CondGemId, number> {
  const inst = condGemInstances(characters, spec, opts)
  const out = new Map<CondGemId, number>()
  for (const [id, v] of inst) out.set(id, v.rank)
  return out
}

/** Construit les mods de combat depuis les instances portées (spec ◈ I→V et opts d'arbre comprises). */
export function condGemMods(characters: Character[], spec?: GemSpec | null, opts?: GemModOpts): CondMods {
  const inst = condGemInstances(characters, spec, opts)
  const val = (id: CondGemId) => {
    const r = inst.get(id)
    if (!r) return undefined
    const def = COND_GEMS[id]
    const famMult = specFamMult(spec, def.family)
      * (opts?.familyMult?.[def.family] ?? 1)
      * (opts?.paramMult ?? 1)
    return gemValueQ(def, r.rank, r.quality, famMult)
  }
  const pct = (id: CondGemId) => {
    const v = val(id)
    return v !== undefined ? v / 100 : undefined
  }
  // ◈ Rythme III/V : les compteurs démarrent plus court (−1, −2 au V ; plancher 2).
  const counterShift = spec?.family === 'rythme' ? (spec.tier >= 3 ? 1 : 0) + (spec.tier >= 5 ? 1 : 0) : 0
  const counter = (id: CondGemId) => {
    const v = val(id)
    return v !== undefined ? Math.max(2, Math.round(v) - counterShift) : undefined
  }
  // ◈ Flux III : boucliers de gemmes ×1,25 · V « Marée » : caps Calice/Trésorerie ×1,5.
  const fluxTier = spec?.family === 'flux' ? spec.tier : 0
  const shieldMult = fluxTier >= 3 ? 1.25 : 1
  const capMult = fluxTier >= 5 ? 1.5 : 1
  // ◈ Environnement III/V.
  const envTier = spec?.family === 'environnement' ? spec.tier : 0
  const envMult = envTier >= 5 ? 1.33 : 1
  const envPct = (id: CondGemId) => {
    const v = pct(id)
    return v !== undefined ? v * envMult : undefined
  }
  // ◈ Bastion III/V.
  const bastionTier = spec?.family === 'bastion' ? spec.tier : 0

  const cap = (x: number | undefined, max: number) => (x !== undefined ? Math.min(max, x) : undefined)

  return {
    overkill: inst.has('overkill') || undefined,
    conquete: inst.has('conquete') || undefined,
    acharneCap: pct('acharne'),
    nueePer: pct('nuee'),
    metronomeN: counter('metronome'),
    echoN: counter('echo'),
    crescendoCap: pct('crescendo'),
    pacteCdr: pct('pacte'),
    souffle: pct('souffle'),
    tresorerieCap: pct('tresorerie') !== undefined ? pct('tresorerie')! * capMult : undefined,
    opportuniste: envPct('opportuniste'),
    orage: envPct('orage'),
    /* Rythme */
    tambourPct: cap(pct('tambour'), 0.35),
    hemorragieN: counter('hemorragie'),
    glasN: counter('glas'),
    riposteSec: val('riposte'),
    ostinatoPer: pct('ostinato'),
    cadenceN: counter('cadence'),
    marcheCap: pct('marche'),
    detonationN: counter('detonation'),
    carillonN: counter('carillon'),
    dacapoSec: val('dacapo'),
    /* Flux */
    caliceCap: pct('calice') !== undefined ? pct('calice')! * capMult : undefined,
    fievreLeech: pct('fievre'),
    perfusionBonus: pct('perfusion'),
    vasesPct: pct('vases'),
    garrotPct: cap(pct('garrot'), 0.9),
    reservoirPct: pct('reservoir') !== undefined ? pct('reservoir')! * shieldMult : undefined,
    tensionPct: pct('tension'),
    echangeurSec: val('echangeur'),
    testamentPct: pct('testament') !== undefined ? pct('testament')! * shieldMult : undefined,
    goutteePct: pct('goutte'),
    /* Environnement */
    boussolePct: envPct('boussole'),
    sceauPct: envPct('sceauGemme'),
    tropheeRes: val('trophee') !== undefined ? val('trophee')! * envMult : undefined,
    prismePct: cap(envPct('prisme'), 0.5),
    paratonnerrePct: cap(envPct('paratonnerre'), 0.5),
    premierePct: envPct('premiere'),
    cartographePct: envPct('cartographe'),
    sixiemePct: cap(envPct('sixieme'), 0.6),
    piedDuMurPct: envPct('piedDuMur'),
    veineMerePct: envPct('veineMere'),
    /* Bastion */
    egidePct: cap(pct('egide'), 0.8),
    egideHits: inst.has('egide') ? (bastionTier >= 5 ? 2 : 1) : undefined,
    rempartPer: pct('rempart'),
    carapacePct: pct('carapace') !== undefined ? pct('carapace')! * shieldMult : undefined,
    ancragePct: pct('ancrage'),
    cilicePct: pct('cilice'),
    verreTrempePct: pct('verreTrempe'),
    doctrinePct: pct('doctrine'),
    granitPct: cap(pct('granit'), 0.5),
    tourGardePct: cap(pct('tourGarde'), 0.8),
    memoirePct: cap(pct('memoirePierre'), 0.9),
    /* transverses */
    fluxShieldMult: shieldMult > 1 ? shieldMult : undefined,
    dotTakenMult: bastionTier >= 3 ? 0.85 : undefined,
    envChestPct: envTier >= 3 ? 0.1 : undefined,
  }
}

/** Multiplicateur de l'Acharné selon l'âge du combat contre l'ennemi courant. */
export function acharneMult(age: number, cap = 0.5): number {
  return 1 + Math.min(cap, 0.02 * age)
}

/** Multiplicateur de la Nuée selon le nombre d'ennemis vivants. */
export function nueeMult(aliveCount: number, per = 0.07): number {
  return 1 + Math.min(per * 5, per * Math.max(0, aliveCount - 1))
}
