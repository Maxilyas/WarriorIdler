import type { StatBlock, DamageType, OffensiveStat } from './types'

/**
 * Grand arbre de talents UNIQUE en CONSTELLATIONS (sections navigables — confort mobile).
 * 6 spécialisations « cœur » (~30 nœuds chacune) + 5 ARCHÉTYPES qui changent le gameplay,
 * reliés par des passerelles (gateways) → builds hybrides (Berserker→Bastion, etc.).
 *
 * Inspirations : Path of Exile 2 (keystones forts), WoW (rôles), Final Fantasy (jobs).
 * Data-driven : un nœud peut donner des stats/résistances, débloquer une capacité, ou poser
 * un KEYSTONE (effet de build fort). Ajouter un nœud = une entrée.
 */

export type ConstellationId =
  | 'coeur' | 'force' | 'agilite' | 'intelligence' | 'bastion' | 'soin' | 'conversion'
  | 'templier' | 'elementaliste' | 'faucheur' | 'duelliste' | 'colosse'
  | 'pestifere' | 'bourreau' | 'spectre' | 'briseur'

export interface ConstellationMeta {
  id: ConstellationId
  name: string
  role: string
  color: string
  icon: string
  /** Archétype = "classe" qui change le gameplay (mis en avant dans l'UI). */
  archetype?: boolean
}

export const CONSTELLATIONS: Record<ConstellationId, ConstellationMeta> = {
  coeur: { id: 'coeur', name: 'Cœur', role: 'Tronc commun', color: '#e2e8f0', icon: '✶' },
  force: { id: 'force', name: 'Berserker', role: 'Mêlée · Force', color: '#ff6b6b', icon: '⚔' },
  agilite: { id: 'agilite', name: 'Rôdeur', role: 'Furtivité · Agilité', color: '#51cf66', icon: '🏹' },
  intelligence: { id: 'intelligence', name: 'Arcaniste', role: 'Sorts · Intelligence', color: '#4dabf7', icon: '✨' },
  bastion: { id: 'bastion', name: 'Bastion', role: 'Tank · Endurance', color: '#ffd43b', icon: '🛡' },
  soin: { id: 'soin', name: 'Oracle', role: 'Soin · Vie', color: '#69db7c', icon: '✚' },
  conversion: { id: 'conversion', name: 'Métamorphe', role: 'Hybride · Conversions', color: '#c084fc', icon: '🜂' },
  templier: { id: 'templier', name: 'Templier', role: 'Sacré · Tank-DPS', color: '#ffe066', icon: '⚜', archetype: true },
  elementaliste: { id: 'elementaliste', name: 'Élémentaliste', role: 'Tous éléments', color: '#ff8787', icon: '🌈', archetype: true },
  faucheur: { id: 'faucheur', name: 'Faucheur', role: 'Ombre · DoT · Drain', color: '#9775fa', icon: '☠', archetype: true },
  duelliste: { id: 'duelliste', name: 'Duelliste', role: 'Multifrappe · Burst', color: '#ffa94d', icon: '🗡', archetype: true },
  colosse: { id: 'colosse', name: 'Colosse', role: 'Juggernaut', color: '#a9b4c2', icon: '🗿', archetype: true },
  pestifere: { id: 'pestifere', name: 'Pestiféré', role: 'Peste · DoT · Altération', color: '#74b816', icon: '🦠', archetype: true },
  bourreau: { id: 'bourreau', name: 'Bourreau', role: 'Anti-boss · Exécution', color: '#c92a2a', icon: '🪓', archetype: true },
  spectre: { id: 'spectre', name: 'Spectre', role: 'Évasion · Précision · Anti-contrôle', color: '#b197fc', icon: '👻', archetype: true },
  briseur: { id: 'briseur', name: 'Briseur', role: 'Multi-cible · Inarrêtable', color: '#e8590c', icon: '🌋', archetype: true },
}

export const CONSTELLATION_LIST: ConstellationId[] = [
  'coeur', 'force', 'agilite', 'intelligence', 'bastion', 'soin', 'conversion',
  'templier', 'elementaliste', 'faucheur', 'duelliste', 'colosse',
  'pestifere', 'bourreau', 'spectre', 'briseur',
]

/** Effet fort d'un keystone, résolu par le moteur de combat (extensible). */
export interface KeystoneEffect {
  /** Convertit une fraction d'une stat primaire en une autre (« la Force compte comme Agi »). */
  statAsOther?: { from: OffensiveStat; to: OffensiveStat; frac: number }
  /** Convertit une fraction de l'Endurance en une stat offensive (Templier/Colosse). */
  enduranceAs?: { to: OffensiveStat; frac: number }
  /** Convertit une fraction d'un type de dégâts en un autre (déplace : retire de `from`). */
  convertDamage?: { from: DamageType; to: DamageType; frac: number }
  /**
   * « Le type X compte AUSSI comme Y » : ajoute une part du poids de `from` au type `to`
   * SANS la retirer de `from` (double appartenance → frappe la meilleure résistance des deux).
   */
  splashType?: { from: DamageType; to: DamageType; frac: number }
  /** Les coups appliquent un DoT : fraction des dégâts du coup / seconde, sur N secondes. */
  dot?: { frac: number; duration: number }
  /** Les soins sont amplifiés (HoT) : +X%. */
  hot?: number
  /** Multiplicateur de dégâts global. */
  damageMult?: number
  /** Réduction de dégâts plate supplémentaire (0.1 = -10%). */
  flatDr?: number
  /** Renvoie X% des dégâts subis à l'ennemi (épines). */
  thorns?: number
  /** Chance de multifrappe supplémentaire (flat). */
  multistrike?: number
  /** Exécution : ×mult de dégâts si les PV de l'ennemi sont sous `threshold`. */
  executeBonus?: { threshold: number; mult: number }
  /** Berserker : ×mult de dégâts si les PV du héros sont sous `threshold`. */
  lowHpBonus?: { threshold: number; mult: number }
  /** Juggernaut : ×mult de dégâts si les PV du héros sont AU-DESSUS de `threshold`. */
  highHpBonus?: { threshold: number; mult: number }
}

export type TalentKind = 'minor' | 'notable' | 'keystone' | 'ability' | 'gateway'

export interface TalentNode {
  id: string
  name: string
  constellation: ConstellationId
  description: string
  kind: TalentKind
  maxRank: number
  tier: number
  requires?: string[]
  statMods?: StatBlock
  resistMods?: Partial<Record<DamageType, number>>
  unlockPower?: string
  keystone?: KeystoneEffect
}

/* ------------------------------------------------------------------ */
/* Construction de l'arbre via un helper de chaîne (réduit le boilerplate).
/* ------------------------------------------------------------------ */

export const TALENTS: TalentNode[] = []

const STAT_FR: Record<string, string> = {
  force: 'Force', agilite: 'Agilité', intelligence: 'Intelligence', endurance: 'Endurance',
  critique: 'Critique', degatsCrit: 'Dégâts crit.', hate: 'Hâte', maitrise: 'Maîtrise', penetration: 'Pénétration',
  precision: 'Précision', alteration: 'Altération', degatsBoss: 'Dégâts boss',
  reductionDegats: 'Réduction', esquive: 'Esquive', barriere: 'Barrière', tenacite: 'Ténacité', regen: 'Régén',
  volDeVie: 'Vol de vie', surpuissance: 'Surpuissance', multifrappe: 'Multifrappe', recuperation: 'Récupération',
}
function sd(mods: StatBlock): string {
  return Object.entries(mods).map(([k, v]) => `+${v} ${STAT_FR[k] ?? k}`).join(', ')
}

interface NSpec {
  name: string
  kind?: TalentKind
  maxRank?: number
  statMods?: StatBlock
  resistMods?: Partial<Record<DamageType, number>>
  unlockPower?: string
  keystone?: KeystoneEffect
  desc?: string
}

/** Pousse une chaîne de nœuds (chacun requiert le précédent). Renvoie l'id du dernier. */
function chain(c: ConstellationId, prefix: string, root: string, startTier: number, specs: NSpec[]): string {
  let prev = root
  specs.forEach((spec, i) => {
    const id = `${prefix}${i}`
    const auto = spec.statMods ? `${sd(spec.statMods)}${(spec.maxRank ?? 1) > 1 ? ' par rang' : ''}.` : ''
    TALENTS.push({
      id, name: spec.name, constellation: c, description: spec.desc ?? auto,
      kind: spec.kind ?? 'minor', maxRank: spec.maxRank ?? 1, tier: startTier + i,
      requires: [prev],
      ...(spec.statMods ? { statMods: spec.statMods } : {}),
      ...(spec.resistMods ? { resistMods: spec.resistMods } : {}),
      ...(spec.unlockPower ? { unlockPower: spec.unlockPower } : {}),
      ...(spec.keystone ? { keystone: spec.keystone } : {}),
    })
    prev = id
  })
  return prev
}

function single(n: TalentNode) { TALENTS.push(n) }

const ALL_TYPES: DamageType[] = ['physique', 'feu', 'froid', 'foudre', 'arcane', 'ombre', 'nature']
const allResist = (v: number): Partial<Record<DamageType, number>> =>
  Object.fromEntries(ALL_TYPES.map((t) => [t, v])) as Partial<Record<DamageType, number>>

/* ---------------- CŒUR (hub) ---------------- */
single({ id: 'co_start', name: 'Éveil', constellation: 'coeur', kind: 'ability', tier: 0, maxRank: 1,
  description: '+10 stats primaires, +20 Endurance, et débloque Frappe.',
  statMods: { force: 10, agilite: 10, intelligence: 10, endurance: 20 }, unlockPower: 'frappe_simple' })
// HUB CŒUR ÉPURÉ : SEULE la node Éveil au centre, qui rayonne directement vers les 6 passerelles
// (aucun autre nœud au Cœur → visibilité maximale). Les 6 passerelles RAYONNENT du centre.
const coreGw: [string, string, number, StatBlock][] = [
  ['co_gw_force', '→ Berserker', 10, { force: 15 }],
  ['co_gw_agi', '→ Rôdeur', 11, { agilite: 15 }],
  ['co_gw_int', '→ Arcaniste', 12, { intelligence: 15 }],
  ['co_gw_soin', '→ Oracle', 13, { regen: 20, intelligence: 10 }],
  ['co_gw_conv', '→ Métamorphe', 14, { maitrise: 20 }],
  ['co_gw_bas', '→ Bastion', 15, { endurance: 40 }],
]
for (const [id, name, tier, mods] of coreGw) single({ id, name, constellation: 'coeur', kind: 'gateway', tier, maxRank: 1, requires: ['co_start'], description: `Ouvre la voie. ${sd(mods)}.`, statMods: mods })

/* ---------------- BERSERKER (Force) ---------------- */
single({ id: 'fo_entry', name: 'Fureur', constellation: 'force', kind: 'minor', tier: 0, maxRank: 5, requires: ['co_gw_force'], description: '+20 Force par rang.', statMods: { force: 20 } })
chain('force', 'fo_a', 'fo_entry', 1, [
  { name: 'Force brute I', maxRank: 5, statMods: { force: 18 } },
  { name: 'Brutalité', maxRank: 4, statMods: { critique: 22, degatsCrit: 18 } },
  { name: 'Frappe lourde', kind: 'ability', unlockPower: 'frappe_lourde', desc: 'Débloque Frappe lourde (nuke, scale FOR).' },
  { name: 'Force brute II', maxRank: 5, statMods: { force: 24 } },
  { name: 'Maître d\'armes', maxRank: 4, statMods: { maitrise: 28 } },
  { name: 'Tourbillon', kind: 'ability', unlockPower: 'tourbillon', desc: 'Débloque Tourbillon (cleave, scale FOR).' },
  { name: 'Sang pour sang', maxRank: 3, statMods: { force: 30, degatsCrit: 25 } },
  { name: 'Berserker', kind: 'keystone', desc: '+40% de dégâts sous 50% de tes PV.', statMods: { force: 40 }, keystone: { lowHpBonus: { threshold: 0.5, mult: 1.4 } } },
])
chain('force', 'fo_b', 'fo_entry', 1, [
  { name: 'Cuir épais', maxRank: 5, statMods: { endurance: 25 } },
  { name: 'Hémorragie', kind: 'keystone', desc: 'Tes coups font saigner (DoT 25% du coup/s, 4 s).', keystone: { dot: { frac: 0.25, duration: 4 } } },
  { name: 'Rage I', maxRank: 5, statMods: { hate: 22 } },
  { name: 'Lacération', kind: 'ability', unlockPower: 'laceration', desc: 'Débloque Lacération (DoT physique).' },
  { name: 'Cri de guerre', maxRank: 3, statMods: { maitrise: 26, force: 16 } },
  { name: 'Carnage', kind: 'keystone', desc: '+30% de dégâts, +30 Critique.', statMods: { critique: 30 }, keystone: { damageMult: 1.3 } },
])
chain('force', 'fo_c', 'fo_entry', 1, [
  { name: 'Vigueur', maxRank: 5, statMods: { force: 16, endurance: 16 } },
  { name: 'Pénétration brute', maxRank: 4, statMods: { penetration: 20 } },
  { name: 'Frappe sismique', kind: 'ability', unlockPower: 'choc_sismique', desc: 'Débloque Choc sismique (cleave puissant).' },
  { name: 'Indomptable', maxRank: 3, statMods: { force: 28, maitrise: 20 } },
  { name: 'Titan', kind: 'keystone', desc: 'Capstone : +60 Force/Maîtrise, +15% de dégâts.', statMods: { force: 60, maitrise: 60 }, keystone: { damageMult: 1.15 } },
])

/* ---------------- RÔDEUR (Agilité) ---------------- */
single({ id: 'ag_entry', name: 'Célérité', constellation: 'agilite', kind: 'minor', tier: 0, maxRank: 5, requires: ['co_gw_agi'], description: '+20 Agilité par rang.', statMods: { agilite: 20 } })
chain('agilite', 'ag_a', 'ag_entry', 1, [
  { name: 'Réflexes I', maxRank: 5, statMods: { agilite: 18 } },
  { name: 'Vivacité', maxRank: 4, statMods: { hate: 28 } },
  { name: 'Tir précis', kind: 'ability', unlockPower: 'tir_precis', desc: 'Débloque Tir précis (nuke, scale AGI).' },
  { name: 'Réflexes II', maxRank: 5, statMods: { agilite: 24 } },
  { name: 'Précision', maxRank: 4, statMods: { critique: 30, degatsCrit: 24 } },
  { name: 'Volée de flèches', kind: 'ability', unlockPower: 'volee_de_fleches', desc: 'Débloque Volée de flèches (cleave, scale AGI).' },
  { name: 'Œil de lynx', maxRank: 3, statMods: { critique: 35, penetration: 20 } },
  { name: 'Coup fatal', kind: 'keystone', desc: 'Exécute sous 20% de PV (×3 dégâts).', statMods: { degatsCrit: 40 }, keystone: { executeBonus: { threshold: 0.2, mult: 3 } } },
])
chain('agilite', 'ag_b', 'ag_entry', 1, [
  { name: 'Souplesse', maxRank: 5, statMods: { esquive: 26 } },
  { name: 'Lames empoisonnées', kind: 'ability', unlockPower: 'poison', desc: 'Débloque Poison (DoT, scale AGI).' },
  { name: 'Pas de l\'ombre', maxRank: 4, statMods: { esquive: 24, hate: 16 } },
  { name: 'Toxines', kind: 'keystone', desc: 'Tes coups empoisonnent (DoT 20% du coup/s, 5 s).', keystone: { dot: { frac: 0.2, duration: 5 } } },
  { name: 'Insaisissable', maxRank: 3, statMods: { esquive: 30, agilite: 20 } },
  { name: 'Danse mortelle', kind: 'keystone', desc: '+25% de dégâts, +30 Esquive.', statMods: { esquive: 30 }, keystone: { damageMult: 1.25 } },
])
chain('agilite', 'ag_c', 'ag_entry', 1, [
  { name: 'Affûtage', maxRank: 5, statMods: { agilite: 16, critique: 16 } },
  { name: 'Pénétration affûtée', maxRank: 4, statMods: { penetration: 24 } },
  { name: 'Frénésie', maxRank: 3, statMods: { hate: 40, agilite: 20 } },
  { name: 'Maître assassin', kind: 'keystone', desc: 'Capstone : +70 Agilité, +60 Dégâts crit., +15% Pénétration.', statMods: { agilite: 70, degatsCrit: 60, penetration: 750 } },
])

/* ---------------- ARCANISTE (Intelligence) ---------------- */
single({ id: 'in_entry', name: 'Sagacité', constellation: 'intelligence', kind: 'minor', tier: 0, maxRank: 5, requires: ['co_gw_int'], description: '+20 Intelligence par rang.', statMods: { intelligence: 20 } })
chain('intelligence', 'in_a', 'in_entry', 1, [
  { name: 'Savoir I', maxRank: 5, statMods: { intelligence: 18 } },
  { name: 'Éclair arcanique', kind: 'ability', unlockPower: 'eclair', desc: 'Débloque Éclair (nuke arcane, scale INT).' },
  { name: 'Concentration', maxRank: 4, statMods: { critique: 24, maitrise: 20 } },
  { name: 'Savoir II', maxRank: 5, statMods: { intelligence: 24 } },
  { name: 'Embrasement', kind: 'ability', unlockPower: 'embrasement', desc: 'Débloque Embrasement (DoT de feu, scale INT).' },
  { name: 'Combustion', kind: 'keystone', desc: 'Tes coups brûlent (DoT 22% du coup/s, 5 s).', keystone: { dot: { frac: 0.22, duration: 5 } } },
  { name: 'Pouvoir brut', maxRank: 3, statMods: { intelligence: 30, maitrise: 30 } },
  { name: 'Archimage', kind: 'keystone', desc: '+25% de dégâts, +50 Intelligence.', statMods: { intelligence: 50 }, keystone: { damageMult: 1.25 } },
])
chain('intelligence', 'in_b', 'in_entry', 1, [
  { name: 'Faille I', maxRank: 5, statMods: { penetration: 22 } },
  { name: 'Trait de givre', kind: 'ability', unlockPower: 'trait_de_givre', desc: 'Débloque Trait de givre (cleave froid).' },
  { name: 'Érudition', maxRank: 4, statMods: { intelligence: 22, hate: 14 } },
  { name: 'Conversion ardente', kind: 'keystone', desc: 'Convertit 40% des dégâts Physiques en Feu.', statMods: { maitrise: 30 }, keystone: { convertDamage: { from: 'physique', to: 'feu', frac: 0.4 } } },
  { name: 'Mèche courte', maxRank: 3, statMods: { degatsCrit: 40, intelligence: 18 } },
  { name: 'Surcharge', kind: 'keystone', desc: '+30% de dégâts, +30 Pénétration.', statMods: { penetration: 30 }, keystone: { damageMult: 1.3 } },
])
chain('intelligence', 'in_c', 'in_entry', 1, [
  { name: 'Méditation', maxRank: 5, statMods: { intelligence: 16, regen: 16 } },
  { name: 'Salve arcanique', kind: 'ability', unlockPower: 'salve_arcanique', desc: 'Débloque Salve arcanique (cleave).' },
  { name: 'Esprit aiguisé', maxRank: 3, statMods: { intelligence: 28, critique: 24 } },
  { name: 'Omnisavoir', kind: 'keystone', desc: 'Capstone : +90 Intelligence, +40 Maîtrise, +15% de dégâts.', statMods: { intelligence: 90, maitrise: 40 }, keystone: { damageMult: 1.15 } },
])

/* ---------------- BASTION (Endurance) ---------------- */
single({ id: 'ba_entry', name: 'Carrure', constellation: 'bastion', kind: 'minor', tier: 0, maxRank: 5, requires: ['co_gw_bas'], description: '+40 Endurance par rang.', statMods: { endurance: 40 } })
chain('bastion', 'ba_a', 'ba_entry', 1, [
  { name: 'Os d\'acier I', maxRank: 5, statMods: { endurance: 35 } },
  { name: 'Provocation', kind: 'ability', unlockPower: 'provocation', desc: 'Débloque Provocation (passive : menace).' },
  { name: 'Peau de pierre', maxRank: 4, statMods: { reductionDegats: 28 } },
  { name: 'Os d\'acier II', maxRank: 5, statMods: { endurance: 45 } },
  { name: 'Bouclier runique', kind: 'ability', unlockPower: 'bouclier_runique', desc: 'Débloque Bouclier runique (absorption).' },
  { name: 'Forteresse', kind: 'keystone', desc: '-15% de dégâts subis, +200 Bouclier.', statMods: { barriere: 200 }, keystone: { flatDr: 0.15 } },
  { name: 'Volonté', maxRank: 3, statMods: { endurance: 60, reductionDegats: 30 } },
  { name: 'Inébranlable', kind: 'keystone', desc: 'Capstone : +200 Endurance, -20% dégâts subis.', statMods: { endurance: 200, reductionDegats: 50 }, keystone: { flatDr: 0.2 } },
])
chain('bastion', 'ba_b', 'ba_entry', 1, [
  { name: 'Égide I', maxRank: 4, statMods: {}, resistMods: allResist(0.06), desc: '+6% résistance tous types par rang.' },
  { name: 'Bouclier de pointes', maxRank: 4, statMods: { barriere: 80, reductionDegats: 14 } },
  { name: 'Représailles', kind: 'keystone', desc: 'Renvoie 20% des dégâts subis à l\'ennemi.', keystone: { thorns: 0.2 } },
  { name: 'Égide II', maxRank: 3, statMods: {}, resistMods: allResist(0.08), desc: '+8% résistance tous types par rang.' },
  { name: 'Mur vivant', kind: 'keystone', desc: '+300 Bouclier, -10% dégâts subis.', statMods: { barriere: 300 }, keystone: { flatDr: 0.1 } },
])
chain('bastion', 'ba_c', 'ba_entry', 1, [
  { name: 'Stoïcisme', maxRank: 5, statMods: { endurance: 30, maitrise: 14 } },
  { name: 'Régénération de plaque', maxRank: 4, statMods: { regen: 30, endurance: 20 } },
  { name: 'Sentinelle', maxRank: 3, statMods: { endurance: 50, esquive: 24 } },
])
// Passerelles d'archétype découvertes en Bastion.
single({ id: 'ba_gw_templier', name: '→ Templier', constellation: 'bastion', kind: 'gateway', tier: 4, maxRank: 1, requires: ['ba_a4', 'ba_b2'], description: 'Passerelle vers le Templier (sacré). +20 Endurance, +20 Intelligence.', statMods: { endurance: 20, intelligence: 20 } })
single({ id: 'ba_gw_colosse', name: '→ Colosse', constellation: 'bastion', kind: 'gateway', tier: 4, maxRank: 1, requires: ['ba_a3', 'ba_c1'], description: 'Passerelle vers le Colosse (juggernaut). +60 Endurance.', statMods: { endurance: 60 } })

/* ---------------- ORACLE (Soin) ---------------- */
single({ id: 'so_entry', name: 'Bienveillance', constellation: 'soin', kind: 'minor', tier: 0, maxRank: 5, requires: ['co_gw_soin'], description: '+15 Intelligence, +15 Régén par rang.', statMods: { intelligence: 15, regen: 15 } })
chain('soin', 'so_a', 'so_entry', 1, [
  { name: 'Foi I', maxRank: 5, statMods: { intelligence: 16, regen: 16 } },
  { name: 'Vague de soin', kind: 'ability', unlockPower: 'vague_de_soin', desc: 'Débloque Vague de soin.' },
  { name: 'Bénédiction', maxRank: 4, statMods: { regen: 28 } },
  { name: 'Foi II', maxRank: 5, statMods: { intelligence: 20, regen: 20 } },
  { name: 'Guérison majeure', kind: 'ability', unlockPower: 'guerison_majeure', desc: 'Débloque Guérison majeure.' },
  { name: 'Réseau de vie', kind: 'keystone', desc: 'Tes soins sont amplifiés de 40% (HoT).', keystone: { hot: 0.4 } },
  { name: 'Sanctification', maxRank: 3, statMods: { regen: 50, intelligence: 24 } },
  { name: 'Avatar de vie', kind: 'keystone', desc: 'Capstone : +100 Intelligence, +80 Régén, soins +30%.', statMods: { intelligence: 100, regen: 80 }, keystone: { hot: 0.3 } },
])
chain('soin', 'so_b', 'so_entry', 1, [
  { name: 'Sève I', maxRank: 5, statMods: { regen: 24 } },
  { name: 'Transfert vital', kind: 'notable', maxRank: 2, statMods: { volDeVie: 20 }, desc: '+20 Vol de vie par rang (rare !).' },
  { name: 'Imposition des mains', kind: 'ability', unlockPower: 'imposition_des_mains', desc: 'Débloque Imposition des mains (soin de groupe).' },
  { name: 'Sève II', maxRank: 3, statMods: { regen: 36, maitrise: 18 } },
  { name: 'Symbiose', kind: 'keystone', desc: '+20 Vol de vie, +40 Régén.', statMods: { volDeVie: 20, regen: 40 } },
])
chain('soin', 'so_c', 'so_entry', 1, [
  { name: 'Sérénité', maxRank: 5, statMods: { maitrise: 20, regen: 12 } },
  { name: 'Lumière protectrice', maxRank: 4, statMods: {}, resistMods: allResist(0.05), desc: '+5% résistance tous types par rang.' },
  { name: 'Grâce', maxRank: 3, statMods: { intelligence: 30, regen: 30 } },
])

/* ---------------- MÉTAMORPHE (Conversions) ---------------- */
single({ id: 'cv_entry', name: 'Symbiose', constellation: 'conversion', kind: 'notable', tier: 0, maxRank: 1, requires: ['co_gw_conv'], description: '+30 à chaque stat offensive, +40 Polyvalence.', statMods: { force: 30, agilite: 30, intelligence: 30, maitrise: 40 } })
chain('conversion', 'cv_a', 'cv_entry', 1, [
  { name: 'Équilibre', maxRank: 4, statMods: { maitrise: 24 } },
  { name: 'Guerre dansante', kind: 'keystone', desc: '60% de ta Force compte aussi comme Agilité.', keystone: { statAsOther: { from: 'force', to: 'agilite', frac: 0.6 } } },
  { name: 'Esprit affûté', kind: 'keystone', desc: '60% de ton Agilité compte aussi comme Intelligence.', keystone: { statAsOther: { from: 'agilite', to: 'intelligence', frac: 0.6 } } },
  { name: 'Magie de guerre', kind: 'keystone', desc: '60% de ton Intelligence compte aussi comme Force.', keystone: { statAsOther: { from: 'intelligence', to: 'force', frac: 0.6 } } },
])
// Voile d'ombre (Physique→Ombre) et Givre éternel (Physique→Froid) sont des conversions ALTERNATIVES
// (exclusives) → branches SÉPARÉES depuis l'entrée, pas l'une après l'autre.
chain('conversion', 'cv_b', 'cv_entry', 1, [
  { name: 'Flux', maxRank: 4, statMods: { maitrise: 36 } },
  { name: 'Voile d\'ombre', kind: 'keystone', desc: 'Convertit 50% des dégâts Physiques en Ombre.', statMods: { maitrise: 30 }, keystone: { convertDamage: { from: 'physique', to: 'ombre', frac: 0.5 } } },
  { name: 'Omniscience', kind: 'keystone', desc: 'Capstone : +50 stats offensives, +20% dégâts, +10% réduction.', statMods: { force: 50, agilite: 50, intelligence: 50 }, keystone: { damageMult: 1.2, flatDr: 0.1 } },
])
chain('conversion', 'cv_d', 'cv_entry', 1, [
  { name: 'Cristallisation', maxRank: 4, statMods: { maitrise: 36 } },
  { name: 'Givre éternel', kind: 'keystone', desc: 'Convertit 50% des dégâts Physiques en Froid.', statMods: { maitrise: 30 }, keystone: { convertDamage: { from: 'physique', to: 'froid', frac: 0.5 } } },
])
// EMPREINTE — variantes « le Physique compte aussi comme … » vers les types non couverts par
// l'Élémentaliste (Ombre/Arcane/Nature), pour un build hybride physique-multitype.
chain('conversion', 'cv_c', 'cv_entry', 1, [
  { name: 'Empreinte d\'ombre', kind: 'keystone', statMods: { maitrise: 16 }, desc: 'Tes dégâts Physiques comptent AUSSI comme Ombre (50%).', keystone: { splashType: { from: 'physique', to: 'ombre', frac: 0.5 } } },
  { name: 'Empreinte arcanique', kind: 'keystone', statMods: { maitrise: 16 }, desc: 'Tes dégâts Physiques comptent AUSSI comme Arcane (50%).', keystone: { splashType: { from: 'physique', to: 'arcane', frac: 0.5 } } },
  { name: 'Empreinte sylvestre', kind: 'keystone', statMods: { maitrise: 16 }, desc: 'Tes dégâts Physiques comptent AUSSI comme Nature (50%).', keystone: { splashType: { from: 'physique', to: 'nature', frac: 0.5 } } },
  { name: 'Polymorphie', kind: 'keystone', statMods: { force: 30, agilite: 30, intelligence: 30 }, desc: 'Capstone : +30 à chaque stat offensive, +18% de dégâts.', keystone: { damageMult: 1.18 } },
])
single({ id: 'cv_gw_faucheur', name: '→ Faucheur', constellation: 'conversion', kind: 'gateway', tier: 2, maxRank: 1, requires: ['cv_b1'], description: 'Passerelle vers le Faucheur (ombre/DoT). +30 Intelligence.', statMods: { intelligence: 30 } })

/* ================== ARCHÉTYPES ================== */

/* TEMPLIER — sacré, tank-dps (dégâts scalent sur l'Endurance) */
single({ id: 'tp_entry', name: 'Serment sacré', constellation: 'templier', kind: 'notable', tier: 0, maxRank: 1, requires: ['ba_gw_templier'], description: 'Embrasse la voie sacrée. +40 Endurance, +40 Intelligence.', statMods: { endurance: 40, intelligence: 40 } })
chain('templier', 'tp_a', 'tp_entry', 1, [
  { name: 'Ferveur', maxRank: 5, statMods: { intelligence: 18, endurance: 18 } },
  { name: 'Châtiment sacré', kind: 'ability', unlockPower: 'chatiment', desc: 'Débloque Châtiment sacré (nuke).' },
  { name: 'Zèle', maxRank: 4, statMods: { maitrise: 24, reductionDegats: 16 } },
  { name: 'Conviction', kind: 'keystone', desc: 'ARCHÉTYPE : 40% de ton Endurance compte comme Intelligence (frappes sacrées).', keystone: { enduranceAs: { to: 'intelligence', frac: 0.4 } } },
])
chain('templier', 'tp_b', 'tp_entry', 1, [
  { name: 'Aura protectrice', maxRank: 4, statMods: {}, resistMods: allResist(0.07), desc: '+7% résistance tous types par rang.' },
  { name: 'Bouclier de foi', maxRank: 4, statMods: { barriere: 120, intelligence: 16 } },
  { name: 'Croisé', kind: 'keystone', desc: 'Capstone : +80 Endurance/Intelligence, +20% dégâts, -10% subis.', statMods: { endurance: 80, intelligence: 80 }, keystone: { damageMult: 1.2, flatDr: 0.1 } },
])

/* ÉLÉMENTALISTE — tous les éléments */
single({ id: 'el_entry', name: 'Affinité élémentaire', constellation: 'elementaliste', kind: 'notable', tier: 0, maxRank: 1, requires: ['in_gw_elem'], description: 'Maîtrise naissante des éléments. +50 Intelligence, +20 Pénétration.', statMods: { intelligence: 50, penetration: 20 } })
chain('elementaliste', 'el_a', 'el_entry', 1, [
  { name: 'Catalyse', maxRank: 5, statMods: { intelligence: 20, maitrise: 16 } },
  { name: 'Trinité élémentaire', kind: 'keystone', desc: 'ARCHÉTYPE : +35% de dégâts (tu manies tous les éléments).', statMods: { maitrise: 30 }, keystone: { damageMult: 1.35 } },
  { name: 'Résonance', maxRank: 4, statMods: { penetration: 24, degatsCrit: 20 } },
  { name: 'Cataclysme', kind: 'keystone', desc: 'Capstone : +90 Intelligence, +40% dégâts, +20 Pénétration.', statMods: { intelligence: 90, penetration: 20 }, keystone: { damageMult: 1.4 } },
])
chain('elementaliste', 'el_b', 'el_entry', 1, [
  { name: 'Prisme', maxRank: 4, statMods: {}, resistMods: allResist(0.07), desc: '+7% résistance tous types par rang.' },
  { name: 'Conduit', maxRank: 4, statMods: { intelligence: 18, hate: 16 } },
  { name: 'Embrasement total', kind: 'keystone', desc: 'Tes coups brûlent fort (DoT 30% du coup/s, 5 s).', keystone: { dot: { frac: 0.3, duration: 5 } } },
])
// DIFFUSION — « ton type de base compte AUSSI comme un élément » (ajoute sans retirer → diversifie
// ton profil pour contourner les résistances typées des ennemis). Empilables : couvre plusieurs types.
chain('elementaliste', 'el_c', 'el_entry', 1, [
  { name: 'Diffusion ardente', kind: 'keystone', statMods: { penetration: 14 }, desc: 'Tes dégâts Physiques comptent AUSSI comme Feu (50%).', keystone: { splashType: { from: 'physique', to: 'feu', frac: 0.5 } } },
  { name: 'Diffusion givrée', kind: 'keystone', statMods: { penetration: 14 }, desc: 'Tes dégâts Physiques comptent AUSSI comme Froid (50%).', keystone: { splashType: { from: 'physique', to: 'froid', frac: 0.5 } } },
  { name: 'Diffusion fulgurante', kind: 'keystone', statMods: { penetration: 14 }, desc: 'Tes dégâts Physiques comptent AUSSI comme Foudre (50%).', keystone: { splashType: { from: 'physique', to: 'foudre', frac: 0.5 } } },
  { name: 'Prisme parfait', kind: 'keystone', statMods: { penetration: 30, intelligence: 30 }, desc: 'Capstone : +30 Pénétration/Intelligence, +20% de dégâts.', keystone: { damageMult: 1.2 } },
])

/* FAUCHEUR — ombre, DoT, drain */
single({ id: 'fa_entry', name: 'Étreinte du vide', constellation: 'faucheur', kind: 'notable', tier: 0, maxRank: 1, requires: ['cv_gw_faucheur'], description: 'Le néant t\'accueille. +40 Intelligence, +15 Vol de vie.', statMods: { intelligence: 40, volDeVie: 15 } })
chain('faucheur', 'fa_a', 'fa_entry', 1, [
  { name: 'Malédiction', maxRank: 5, statMods: { intelligence: 18, degatsCrit: 18 } },
  { name: 'Fléau d\'ombre', kind: 'ability', unlockPower: 'fleau_dombre', desc: 'Débloque Fléau d\'ombre (DoT puissant).' },
  { name: 'Putréfaction', kind: 'keystone', desc: 'ARCHÉTYPE : tes coups infligent un fort DoT d\'ombre (35% du coup/s, 6 s).', keystone: { dot: { frac: 0.35, duration: 6 } } },
  { name: 'Moisson', kind: 'keystone', desc: 'Convertit 60% des dégâts Physiques en Ombre.', statMods: { maitrise: 30 }, keystone: { convertDamage: { from: 'physique', to: 'ombre', frac: 0.6 } } },
])
chain('faucheur', 'fa_b', 'fa_entry', 1, [
  { name: 'Sangsue', maxRank: 3, statMods: { volDeVie: 18 } },
  { name: 'Pacte de sang', kind: 'keystone', desc: '+25 Vol de vie, +20% dégâts.', statMods: { volDeVie: 25 }, keystone: { damageMult: 1.2 } },
  { name: 'Seigneur de la mort', kind: 'keystone', desc: 'Capstone : exécute sous 25% de PV (×3) + 20 Vol de vie.', statMods: { volDeVie: 20 }, keystone: { executeBonus: { threshold: 0.25, mult: 3 } } },
])

/* DUELLISTE — multifrappe, burst */
single({ id: 'du_entry', name: 'Art du duel', constellation: 'duelliste', kind: 'notable', tier: 0, maxRank: 1, requires: ['ag_gw_duel'], description: 'Vitesse et précision. +40 Agilité, +25 Hâte.', statMods: { agilite: 40, hate: 25 } })
chain('duelliste', 'du_a', 'du_entry', 1, [
  { name: 'Lames jumelles', maxRank: 5, statMods: { agilite: 18, critique: 16 } },
  { name: 'Éviscération', kind: 'ability', unlockPower: 'eviscaration', desc: 'Débloque Éviscération (nuke puissant).' },
  { name: 'Cadence', maxRank: 4, statMods: { hate: 26 } },
  { name: 'Tempête de lames', kind: 'keystone', desc: 'ARCHÉTYPE : +25% de chance de Multifrappe (frappe deux fois).', keystone: { multistrike: 0.25 } },
])
chain('duelliste', 'du_b', 'du_entry', 1, [
  { name: 'Esquive parfaite', maxRank: 4, statMods: { esquive: 24 } },
  { name: 'Précision létale', maxRank: 4, statMods: { degatsCrit: 30, critique: 20 } },
  { name: 'Sabreur', kind: 'keystone', desc: 'Capstone : +15% Multifrappe, +25% dégâts.', keystone: { multistrike: 0.15, damageMult: 1.25 } },
])

/* COLOSSE — juggernaut */
single({ id: 'jc_entry', name: 'Inflexible', constellation: 'colosse', kind: 'notable', tier: 0, maxRank: 1, requires: ['ba_gw_colosse'], description: 'Rien ne te fait reculer. +80 Endurance.', statMods: { endurance: 80 } })
chain('colosse', 'jc_a', 'jc_entry', 1, [
  { name: 'Masse I', maxRank: 5, statMods: { endurance: 40 } },
  { name: 'Force du titan', kind: 'keystone', desc: 'ARCHÉTYPE : 35% de ton Endurance compte comme Force.', keystone: { enduranceAs: { to: 'force', frac: 0.35 } } },
  { name: 'Masse II', maxRank: 4, statMods: { endurance: 50, reductionDegats: 16 } },
  { name: 'Rouleau compresseur', kind: 'keystone', desc: '+30% de dégâts quand tes PV sont au-dessus de 70%.', keystone: { highHpBonus: { threshold: 0.7, mult: 1.3 } } },
])
chain('colosse', 'jc_b', 'jc_entry', 1, [
  { name: 'Carapace', maxRank: 4, statMods: { reductionDegats: 24 } },
  { name: 'Épines de fer', kind: 'keystone', desc: 'Renvoie 30% des dégâts subis à l\'ennemi.', keystone: { thorns: 0.3 } },
  { name: 'Montagne vivante', kind: 'keystone', desc: 'Capstone : +200 Endurance, -15% subis, +20% dégâts au-dessus de 60% PV.', statMods: { endurance: 200 }, keystone: { flatDr: 0.15, highHpBonus: { threshold: 0.6, mult: 1.2 } } },
])

// Passerelles d'archétype hébergées dans les spécialisations correspondantes.
single({ id: 'in_gw_elem', name: '→ Élémentaliste', constellation: 'intelligence', kind: 'gateway', tier: 4, maxRank: 1, requires: ['in_a3', 'in_b3'], description: 'Passerelle vers l\'Élémentaliste. +30 Intelligence.', statMods: { intelligence: 30 } })
single({ id: 'ag_gw_duel', name: '→ Duelliste', constellation: 'agilite', kind: 'gateway', tier: 4, maxRank: 1, requires: ['ag_a3', 'ag_b2'], description: 'Passerelle vers le Duelliste. +30 Agilité.', statMods: { agilite: 30 } })

/* ================== ARCHÉTYPES v0.17 (4 nouveaux) ================== */

/* PESTIFÉRÉ — peste, DoT, Altération (scale via la nouvelle stat Altération) */
single({ id: 'in_gw_peste', name: '→ Pestiféré', constellation: 'intelligence', kind: 'gateway', tier: 5, maxRank: 1, requires: ['in_a4', 'in_b2'], description: 'Passerelle vers le Pestiféré (peste/DoT). +30 Altération.', statMods: { alteration: 30 } })
single({ id: 'pe_entry', name: 'Étreinte pestilentielle', constellation: 'pestifere', kind: 'notable', tier: 0, maxRank: 1, requires: ['in_gw_peste'], description: 'La maladie devient ton arme. +40 Intelligence, +30 Altération.', statMods: { intelligence: 40, alteration: 30 } })
chain('pestifere', 'pe_a', 'pe_entry', 1, [
  { name: 'Virulence', maxRank: 5, statMods: { alteration: 30, intelligence: 12 } },
  { name: 'Contagion', kind: 'keystone', desc: 'ARCHÉTYPE : tes coups infligent une peste (DoT 28% du coup/s, 6 s, amplifié par l\'Altération).', statMods: { alteration: 30 }, keystone: { dot: { frac: 0.28, duration: 6 } } },
  { name: 'Putréfaction', maxRank: 4, statMods: { alteration: 40 } },
  { name: 'Épidémie', kind: 'keystone', desc: '+30% de dégâts, +40 Altération.', statMods: { alteration: 40 }, keystone: { damageMult: 1.3 } },
])
chain('pestifere', 'pe_b', 'pe_entry', 1, [
  { name: 'Miasmes', maxRank: 5, statMods: { alteration: 28 } },
  { name: 'Fléau d\'ombre', kind: 'ability', unlockPower: 'fleau_dombre', desc: 'Débloque Fléau d\'ombre (DoT puissant).' },
  { name: 'Corruption', kind: 'keystone', desc: 'Convertit 50% des dégâts Physiques en Ombre.', statMods: { maitrise: 20 }, keystone: { convertDamage: { from: 'physique', to: 'ombre', frac: 0.5 } } },
  { name: 'Avatar de peste', kind: 'keystone', desc: 'Capstone : +80 Intelligence, +60 Altération, +20% de dégâts.', statMods: { intelligence: 80, alteration: 60 }, keystone: { damageMult: 1.2 } },
])

/* BOURREAU — anti-boss, exécution, précision (stat Dégâts boss + Précision) */
single({ id: 'fo_gw_bourreau', name: '→ Bourreau', constellation: 'force', kind: 'gateway', tier: 5, maxRank: 1, requires: ['fo_a3', 'fo_c1'], description: 'Passerelle vers le Bourreau (anti-boss). +30 Dégâts boss.', statMods: { degatsBoss: 30 } })
single({ id: 'bo_entry', name: 'Sentence de mort', constellation: 'bourreau', kind: 'notable', tier: 0, maxRank: 1, requires: ['fo_gw_bourreau'], description: 'Les colosses tombent sous ta hache. +40 Force, +30 Dégâts boss.', statMods: { force: 40, degatsBoss: 30 } })
chain('bourreau', 'bo_a', 'bo_entry', 1, [
  { name: 'Marque du bourreau', maxRank: 5, statMods: { degatsBoss: 30 } },
  { name: 'Décapitation', kind: 'ability', unlockPower: 'decapitation', desc: 'Débloque Décapitation (exécution, scale FOR).' },
  { name: 'Précision létale', maxRank: 4, statMods: { precision: 40 } },
  { name: 'Couperet', kind: 'keystone', desc: 'ARCHÉTYPE : exécute les ennemis sous 25% de PV (×3 dégâts).', statMods: { degatsBoss: 30 }, keystone: { executeBonus: { threshold: 0.25, mult: 3 } } },
])
chain('bourreau', 'bo_b', 'bo_entry', 1, [
  { name: 'Traque', maxRank: 5, statMods: { degatsBoss: 28, critique: 14 } },
  { name: 'Chasseur de titans', kind: 'keystone', desc: '+50 Dégâts boss, +30 Précision.', statMods: { degatsBoss: 50, precision: 30 } },
  { name: 'Juge suprême', kind: 'keystone', desc: 'Capstone : +80 Force, +60 Dégâts boss, +25% de dégâts.', statMods: { force: 80, degatsBoss: 60 }, keystone: { damageMult: 1.25 } },
])

/* SPECTRE — évasion, précision, anti-contrôle (Esquive + Ténacité + Précision) */
single({ id: 'ag_gw_spectre', name: '→ Spectre', constellation: 'agilite', kind: 'gateway', tier: 5, maxRank: 1, requires: ['ag_a3', 'ag_b0'], description: 'Passerelle vers le Spectre (évasion). +25 Esquive.', statMods: { esquive: 25 } })
single({ id: 'sp_entry', name: 'Forme spectrale', constellation: 'spectre', kind: 'notable', tier: 0, maxRank: 1, requires: ['ag_gw_spectre'], description: 'Tu deviens insaisissable. +40 Agilité, +30 Esquive.', statMods: { agilite: 40, esquive: 30 } })
chain('spectre', 'sp_a', 'sp_entry', 1, [
  { name: 'Forme éthérée', maxRank: 5, statMods: { esquive: 30 } },
  { name: 'Insaisissable', kind: 'keystone', desc: 'ARCHÉTYPE : +30 Esquive et +20% de dégâts.', statMods: { esquive: 30 }, keystone: { damageMult: 1.2 } },
  { name: 'Frappe spectrale', maxRank: 4, statMods: { precision: 30, agilite: 16 } },
  { name: 'Fantôme vengeur', kind: 'keystone', desc: 'Renvoie 25% des dégâts subis (épines), +30 Esquive.', statMods: { esquive: 30 }, keystone: { thorns: 0.25 } },
])
chain('spectre', 'sp_b', 'sp_entry', 1, [
  { name: 'Volonté indomptable', maxRank: 4, statMods: { tenacite: 40 } },
  { name: 'Esprit libre', kind: 'keystone', desc: 'Quasi-immunité au contrôle : +60 Ténacité, +30 Précision.', statMods: { tenacite: 60, precision: 30 } },
  { name: 'Lame d\'outre-tombe', kind: 'keystone', desc: 'Capstone : +70 Agilité, +50 Esquive, +20% de dégâts.', statMods: { agilite: 70, esquive: 50 }, keystone: { damageMult: 1.2 } },
])

/* BRISEUR — multi-cible, inarrêtable (Ténacité anti-CC + cleave pour les packs) */
single({ id: 'ba_gw_briseur', name: '→ Briseur', constellation: 'bastion', kind: 'gateway', tier: 5, maxRank: 1, requires: ['ba_a3', 'ba_c0'], description: 'Passerelle vers le Briseur (multi-cible). +30 Ténacité.', statMods: { tenacite: 30 } })
single({ id: 'br_entry', name: 'Rage inarrêtable', constellation: 'briseur', kind: 'notable', tier: 0, maxRank: 1, requires: ['ba_gw_briseur'], description: 'Rien ne t\'arrête. +80 Endurance, +30 Ténacité.', statMods: { endurance: 80, tenacite: 30 } })
chain('briseur', 'br_a', 'br_entry', 1, [
  { name: 'Déchaînement', maxRank: 5, statMods: { force: 18, endurance: 18 } },
  { name: 'Tourbillon', kind: 'ability', unlockPower: 'tourbillon', desc: 'Débloque Tourbillon (cleave : frappe tout le pack).' },
  { name: 'Onde de choc', kind: 'keystone', desc: 'ARCHÉTYPE : +30% de dégâts et +40 Ténacité.', statMods: { tenacite: 40 }, keystone: { damageMult: 1.3 } },
  { name: 'Imparable', kind: 'keystone', desc: '+60 Ténacité et -15% de dégâts subis.', statMods: { tenacite: 60 }, keystone: { flatDr: 0.15 } },
])
chain('briseur', 'br_b', 'br_entry', 1, [
  { name: 'Carapace de fer', maxRank: 4, statMods: { reductionDegats: 24 } },
  { name: 'Épines brûlantes', kind: 'keystone', desc: 'Renvoie 30% des dégâts subis à l\'ennemi.', keystone: { thorns: 0.3 } },
  { name: 'Cataclysme vivant', kind: 'keystone', desc: 'Capstone : +200 Endurance, +40 Ténacité, +20% de dégâts au-dessus de 60% PV.', statMods: { endurance: 200, tenacite: 40 }, keystone: { highHpBonus: { threshold: 0.6, mult: 1.2 } } },
])

/* ================== ULTIMES : 10 sorts surpuissants (nœuds-capacité profonds) ==================
 * Récompenses fortes à long cooldown, ancrées dans la voie thématique de chaque effet.
 */
const ULTIMATES: [string, string, ConstellationId, string, string][] = [
  // id, nom, constellation, prérequis (nœud existant), capacité débloquée
  ['ult_verdict', 'Verdict', 'bourreau', 'bo_entry', 'verdict'],
  ['ult_soif', 'Soif du néant', 'faucheur', 'fa_entry', 'soif_du_neant'],
  ['ult_deluge', 'Déluge stellaire', 'elementaliste', 'el_entry', 'deluge_stellaire'],
  ['ult_aube', 'Aube salvatrice', 'soin', 'so_a3', 'aube_salvatrice'],
  ['ult_hemo', 'Hémorragie cosmique', 'pestifere', 'pe_entry', 'hemorragie_cosmique'],
  ['ult_egide', 'Égide titanesque', 'bastion', 'ba_a4', 'egide_titanesque'],
  ['ult_phase', 'Phase éthérée', 'spectre', 'sp_entry', 'phase_etheree'],
  ['ult_vengeance', 'Vengeance différée', 'force', 'fo_a5', 'vengeance_differee'],
  ['ult_furie', 'Furie sanguinaire', 'duelliste', 'du_entry', 'furie_sanguinaire'],
  ['ult_sceau', 'Sceau de faiblesse', 'intelligence', 'in_a3', 'sceau_faiblesse'],
]
for (const [id, name, c, req, power] of ULTIMATES) {
  single({ id, name, constellation: c, kind: 'ability', tier: 9, maxRank: 1, requires: [req], description: `ULTIME — débloque ${name} (sort surpuissant, long cooldown).`, unlockPower: power })
}

/* ------------------------------------------------------------------ */

const BY_ID = new Map(TALENTS.map((t) => [t.id, t]))
export function getTalent(id: string): TalentNode | undefined {
  return BY_ID.get(id)
}

export function talentsByConstellation(c: ConstellationId): TalentNode[] {
  return TALENTS.filter((t) => t.constellation === c).sort((a, b) => a.tier - b.tier)
}

/** Stats cumulées issues des talents alloués. */
export function talentStatMods(talents: Record<string, number>): StatBlock {
  const out: StatBlock = {}
  for (const id in talents) {
    const rank = talents[id]
    const node = BY_ID.get(id)
    if (!node?.statMods || rank <= 0) continue
    for (const k in node.statMods) {
      const key = k as keyof StatBlock
      out[key] = (out[key] ?? 0) + (node.statMods[key] ?? 0) * rank
    }
  }
  return out
}

/** Résistances cumulées issues des talents alloués. */
export function talentResistMods(talents: Record<string, number>): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {}
  for (const id in talents) {
    const rank = talents[id]
    const node = BY_ID.get(id)
    if (!node?.resistMods || rank <= 0) continue
    for (const t in node.resistMods) {
      const type = t as DamageType
      out[type] = (out[type] ?? 0) + (node.resistMods[type] ?? 0) * rank
    }
  }
  return out
}

/** Capacités débloquées par les talents alloués. */
export function talentUnlockedPowers(talents: Record<string, number>): string[] {
  const out: string[] = []
  for (const id in talents) {
    if (talents[id] <= 0) continue
    const p = BY_ID.get(id)?.unlockPower
    if (p) out.push(p)
  }
  return out
}

/** Tous les keystones actifs (alloués), pour le moteur de combat. */
export function talentKeystones(talents: Record<string, number>): KeystoneEffect[] {
  const out: KeystoneEffect[] = []
  for (const id in talents) {
    if (talents[id] <= 0) continue
    const k = BY_ID.get(id)?.keystone
    if (k) out.push(k)
  }
  return out
}

/** Peut-on allouer un point dans ce nœud ? (adjacence : au moins un prérequis alloué). */
export function canAllocate(node: TalentNode, talents: Record<string, number>, points: number): boolean {
  if (points <= 0) return false
  if ((talents[node.id] ?? 0) >= node.maxRank) return false
  if (node.requires && node.requires.length && !node.requires.some((r) => (talents[r] ?? 0) > 0)) return false
  return true
}

/** Le nœud est-il accessible (prérequis remplis), indépendamment des points ? */
export function isReachable(node: TalentNode, talents: Record<string, number>): boolean {
  if (!node.requires || node.requires.length === 0) return true
  return node.requires.some((r) => (talents[r] ?? 0) > 0)
}
