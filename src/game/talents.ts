import type { StatBlock, DamageType, OffensiveStat } from './types'

/**
 * ARBRE DE TALENTS v0.29 — REFONTE « NOYAUX DE CLASSE ».
 *
 * Topologie en 3 couches (voir DESIGN_v0.29_refonte_classes.md) :
 *   TRONC (Cœur)  →  Éveil + 3 hubs de rôle (DPS / Tank / Heal).
 *   NOYAUX (×39)  →  une CLASSE = une constellation compacte :
 *        ENTRÉE (1 pt) = sort signature + voie ouverte,
 *        IDENTITÉ (tier 1) = le keystone qui DÉFINIT la classe,
 *        approfondissement (stats, 2e keystone, capstone, ultime) = optionnel.
 *   Le MIX est natif : les points sont globaux, dipper une classe coûte ~2 pts
 *   (entrée + identité) → on combine librement plusieurs classes (PAS de cap de keystones).
 *
 * Inspiration : les 13 classes de World of Warcraft (39 specs → 39 noyaux).
 * Découplage moteur : toute capacité scale sur la STAT DOMINANTE (character.ts abilityPower) ;
 * la conversion de TYPE de dégâts a quitté l'arbre → elle vit dans le stuff (gemmes/runes).
 *
 * Data-driven : ajouter une classe = une entrée dans CLASSES.
 */

export type ConstellationId =
  | 'coeur'
  // DPS Force
  | 'armes' | 'fureur' | 'vindicte' | 'profanateur' | 'givremort'
  // DPS Agilité
  | 'tireur' | 'ombrelame' | 'traqueur' | 'bete' | 'assassin' | 'flibustier' | 'felin' | 'pisteur' | 'marchevent' | 'amelio'
  // DPS Intelligence
  | 'pyromancien' | 'cryomancien' | 'arcaniste' | 'effroi' | 'invocateur' | 'destructeur' | 'elementaliste' | 'devastateur' | 'lunaire' | 'ombremancien'
  // Tanks
  | 'gardien' | 'croise' | 'sang' | 'brasseur' | 'sylvestre' | 'vengeance' | 'colosse'
  // Heals
  | 'sacre' | 'disciple' | 'reparateur' | 'restaurateur' | 'preservateur' | 'paladinsacre' | 'brume'

export interface ConstellationMeta {
  id: ConstellationId
  name: string
  role: string
  color: string
  icon: string
  /** Archétype = classe (mis en avant dans l'UI ; le Cœur ne l'est pas). */
  archetype?: boolean
}

/** Effet fort d'un keystone, résolu par le moteur de combat (character.ts / combat.ts). INCHANGÉ. */
export interface KeystoneEffect {
  /** Convertit une fraction d'une stat primaire en une autre (« la Force compte comme Agi »). */
  statAsOther?: { from: OffensiveStat; to: OffensiveStat; frac: number }
  /** Convertit une fraction de l'Endurance en une stat offensive (Templier/Colosse). */
  enduranceAs?: { to: OffensiveStat; frac: number }
  /** Convertit une fraction d'un type de dégâts en un autre (déplace : retire de `from`). */
  convertDamage?: { from: DamageType; to: DamageType; frac: number }
  /** « Le type X compte AUSSI comme Y » : ajoute une part du poids de `from` à `to` sans la retirer. */
  splashType?: { from: DamageType; to: DamageType; frac: number }
  /** ALCHIMISTE (legacy) : convertit `frac` du type de l'ARME (déplace) vers `to`. */
  convertFromMain?: { to: DamageType; frac: number }
  /** ALCHIMISTE (legacy) : le type de l'ARME compte AUSSI comme `to` (ajoute sans retirer). */
  splashFromMain?: { to: DamageType; frac: number }
  /** ALCHIMISTE (legacy) : le type de l'arme compte AUSSI comme TOUS les autres éléments (`frac` chacun). */
  splashFromMainAll?: number
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
  /** ORACLE SANGLANT : fraction des SOINS de sorts aussi infligée en dégâts. */
  healToDamage?: number
  /** BRISEUR : les auto-attaques éclaboussent TOUS les autres ennemis du pack (fraction). */
  cleaveAuto?: number
  /** BRISEUR : +frac de dégâts par ennemi vivant au-delà du premier. */
  perEnemyBonus?: number
  /** FAUCHEUR : les DoT que ton équipe inflige TE soignent (fraction du tick). */
  dotLeech?: number
  /** PESTIFÉRÉ : ton DoT s'applique AUSSI aux autres ennemis du pack (fraction). */
  dotAoe?: number
  /** ASSASSIN : ×mult de dégâts pendant les `seconds` premières secondes face à chaque ennemi. */
  openerBonus?: { mult: number; seconds: number }
  /** FOUDREUR : les attaques REBONDISSENT sur `targets` autres ennemis (fraction des dégâts). */
  chainArc?: { frac: number; targets: number }
  /** FOUDREUR : toutes les `every` attaques, la suivante frappe ×mult (décharge statique). */
  staticN?: { every: number; mult: number }
  /** CHRONOMANCIEN : chaque sort lancé réduit les AUTRES recharges de `cdrOnCast` secondes. */
  cdrOnCast?: number
  /** CHRONOMANCIEN : multiplicateur des dégâts de SORTS (actives uniquement). */
  spellMult?: number
  /** PURGATEUR : chaque altération SUBIE donne +per de dégâts (cumul capé, durée du combat). */
  afflictionFuel?: { per: number; cap: number }
  /** ÉGIDE : le SURPLUS de résist face aux exigences du boss devient des dégâts (jusqu'à +value). */
  surplusToDamage?: number
  /** ÉGIDE : être touché par un type donne +gain résist de ce type (20 s, cumul ≤ cap). */
  adaptiveResist?: { gain: number; cap: number }
  /** ÉGIDE : les alliés bénéficient de `frac` de TA résistance (aura). */
  shareResist?: number
  /** ÉGIDE : régénère jusqu'à `value` ×PV max/s selon ton surplus de résist face au boss. */
  surplusRegen?: number
  /** ÉGIDE (Acclimatation) : les exigences de résistance comptent pour `frac` de moins. */
  reqReduction?: number
  /** ÉLÉMENTALISTE : +per de dégâts par type ≥ threshold de ton profil (au-delà du premier). */
  multiTypeBonus?: { per: number; threshold: number }
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
/* Helpers de construction.                                            */
/* ------------------------------------------------------------------ */
export const TALENTS: TalentNode[] = []

const STAT_FR: Record<string, string> = {
  force: 'Force', agilite: 'Agilité', intelligence: 'Intelligence', endurance: 'Endurance',
  critique: 'Critique', degatsCrit: 'Dégâts crit.', hate: 'Hâte', maitrise: 'Maîtrise', penetration: 'Pénétration',
  precision: 'Précision', alteration: 'Altération', degatsBoss: 'Dégâts boss',
  reductionDegats: 'Réduction', esquive: 'Esquive', barriere: 'Barrière', tenacite: 'Ténacité', regen: 'Régén', purge: 'Purge',
  volDeVie: 'Vol de vie', surpuissance: 'Surpuissance', multifrappe: 'Multifrappe', recuperation: 'Récupération',
}
function sd(mods: StatBlock): string {
  return Object.entries(mods).map(([k, v]) => `+${v} ${STAT_FR[k] ?? k}`).join(', ')
}

function single(n: TalentNode) { TALENTS.push(n) }

const ALL_TYPES: DamageType[] = ['physique', 'feu', 'froid', 'foudre', 'arcane', 'ombre', 'nature']
const allResist = (v: number): Partial<Record<DamageType, number>> =>
  Object.fromEntries(ALL_TYPES.map((t) => [t, v])) as Partial<Record<DamageType, number>>
void allResist // disponible pour les futurs nœuds de résistance (Égide, etc.)

/* ------------------------------------------------------------------ */
/* TRONC COMMUN — Éveil + 3 hubs de rôle.                              */
/* ------------------------------------------------------------------ */
single({ id: 'co_start', name: 'Éveil', constellation: 'coeur', kind: 'ability', tier: 0, maxRank: 1,
  description: '+10 stats primaires, +20 Endurance, et débloque Frappe.',
  statMods: { force: 10, agilite: 10, intelligence: 10, endurance: 20 }, unlockPower: 'frappe_simple' })

type Role = 'dps' | 'tank' | 'heal'
const ROLE_HUB: Record<Role, string> = { dps: 'co_hub_dps', tank: 'co_hub_tank', heal: 'co_hub_heal' }
single({ id: 'co_hub_dps', name: 'Voie de l\'Attaquant', constellation: 'coeur', kind: 'gateway', tier: 1, maxRank: 1, requires: ['co_start'], description: 'Ouvre les noyaux DPS. +15 Critique.', statMods: { critique: 15 } })
single({ id: 'co_hub_tank', name: 'Voie du Protecteur', constellation: 'coeur', kind: 'gateway', tier: 1, maxRank: 1, requires: ['co_start'], description: 'Ouvre les noyaux Tank. +40 Endurance.', statMods: { endurance: 40 } })
single({ id: 'co_hub_heal', name: 'Voie du Guérisseur', constellation: 'coeur', kind: 'gateway', tier: 1, maxRank: 1, requires: ['co_start'], description: 'Ouvre les noyaux Soigneur. +20 Régén.', statMods: { regen: 20 } })

/* ------------------------------------------------------------------ */
/* NOYAUX DE CLASSE — table de données + générateur.                   */
/* ------------------------------------------------------------------ */
interface KsSpec { name: string; desc: string; stat?: StatBlock; resist?: Partial<Record<DamageType, number>>; ks?: KeystoneEffect }
interface ClassDef {
  id: ConstellationId
  name: string
  wow: string
  role: Role
  color: string
  icon: string
  /** Stat primaire conseillée (l'entrée en donne ; les sorts scalent sur la dominante réelle). */
  primary: OffensiveStat | 'endurance'
  type: DamageType
  /** Capacité signature (id de powers.ts). */
  sig: string
  /** Keystone d'IDENTITÉ (tier 1). */
  identity: KsSpec
  /** Deux nœuds de stats (tier 1 puis tier 2). */
  statA: StatBlock
  statB: StatBlock
  /** 2e keystone optionnel (tier 2, approfondissement). */
  ks2?: KsSpec
  /** Capstone (tier 3). */
  cap: KsSpec
  /** Ultime optionnel (tier 4). */
  ult?: { name: string; power: string }
}

function emitKs(id: string, c: ConstellationId, tier: number, requires: string[], k: KsSpec, kind: TalentKind = 'keystone') {
  single({
    id, name: k.name, constellation: c, kind, tier, maxRank: 1, requires, description: k.desc,
    ...(k.stat ? { statMods: k.stat } : {}),
    ...(k.resist ? { resistMods: k.resist } : {}),
    ...(k.ks ? { keystone: k.ks } : {}),
  })
}

function emitClass(d: ClassDef) {
  const p = `cl_${d.id}_`
  const entryStat: StatBlock = d.primary === 'endurance' ? { endurance: 60 } : { [d.primary]: 30 }
  single({ id: `${p}e`, name: d.name, constellation: d.id, kind: 'ability', tier: 0, maxRank: 1, requires: [ROLE_HUB[d.role]],
    description: `${d.wow} — débloque sa capacité signature et ouvre la voie ${d.name}. ${sd(entryStat)}.`,
    statMods: entryStat, unlockPower: d.sig })
  emitKs(`${p}i`, d.id, 1, [`${p}e`], d.identity)
  single({ id: `${p}s1`, name: `${d.name} · affinité`, constellation: d.id, kind: 'minor', tier: 1, maxRank: 5, requires: [`${p}e`], description: `${sd(d.statA)} par rang.`, statMods: d.statA })
  single({ id: `${p}s2`, name: `${d.name} · maîtrise`, constellation: d.id, kind: 'minor', tier: 2, maxRank: 4, requires: [`${p}s1`], description: `${sd(d.statB)} par rang.`, statMods: d.statB })
  if (d.ks2) emitKs(`${p}k2`, d.id, 2, [`${p}i`], d.ks2)
  emitKs(`${p}c`, d.id, 3, [`${p}e`], d.cap)
  if (d.ult) single({ id: `${p}u`, name: d.ult.name, constellation: d.id, kind: 'ability', tier: 4, maxRank: 1, requires: [`${p}c`], description: `ULTIME — ${d.ult.name} (sort surpuissant, long cooldown).`, unlockPower: d.ult.power })
}

/* Raccourci pour les keystones « multiplicateur de dégâts » (alignés sur scripts/sim-classes.mjs). */
const KDMG = (m: number, name = 'Frénésie', desc = ''): KsSpec => ({ name, desc: desc || `+${Math.round((m - 1) * 100)}% de dégâts.`, ks: { damageMult: m } })

export const CLASSES: ClassDef[] = [
  /* ===================== DPS — FORCE ===================== */
  { id: 'armes', name: 'Armes', wow: 'Guerrier Armes', role: 'dps', color: '#ff6b6b', icon: '⚔', primary: 'force', type: 'physique', sig: 'frappe_lourde',
    identity: { name: 'Exécuter', desc: 'Exécute les ennemis sous 35% de PV (×2,2 dégâts).', stat: { degatsBoss: 20 }, ks: { executeBonus: { threshold: 0.35, mult: 2.2 } } },
    statA: { degatsBoss: 22 }, statB: { critique: 20 }, cap: KDMG(1.10, 'Maître de guerre', '+10% de dégâts, +40 Dégâts boss.'),
    ult: { name: 'Verdict', power: 'verdict' } },
  { id: 'fureur', name: 'Fureur', wow: 'Guerrier Fureur', role: 'dps', color: '#fa5252', icon: '🪓', primary: 'force', type: 'physique', sig: 'tourbillon',
    identity: { name: 'Berserk', desc: '+40% de dégâts sous 50% de tes PV.', ks: { lowHpBonus: { threshold: 0.5, mult: 1.4 } } },
    statA: { hate: 26 }, statB: { maitrise: 24 }, ks2: { name: 'Déchaînement', desc: '+20% de chance de Multifrappe.', ks: { multistrike: 0.20 } },
    cap: KDMG(1.12, 'Soif de sang', '+12% de dégâts.'), ult: { name: 'Furie sanguinaire', power: 'furie_sanguinaire' } },
  { id: 'vindicte', name: 'Vindicte', wow: 'Paladin Vindicte', role: 'dps', color: '#ffd43b', icon: '⚜', primary: 'force', type: 'arcane', sig: 'chatiment',
    identity: KDMG(1.18, 'Croisade', '+18% de dégâts sacrés.'),
    statA: { maitrise: 24 }, statB: { critique: 20 }, cap: { name: 'Jugement', desc: 'Exécute les ennemis sous 20% de PV (×1,8).', stat: { degatsBoss: 30 }, ks: { executeBonus: { threshold: 0.2, mult: 1.8 } } } },
  { id: 'profanateur', name: 'Profanateur', wow: 'DK Impie', role: 'dps', color: '#74b816', icon: '☠', primary: 'force', type: 'ombre', sig: 'fleau_dombre',
    identity: { name: 'Peste', desc: 'Tes coups infligent une maladie (DoT 30% du coup/s, 6 s).', ks: { dot: { frac: 0.30, duration: 6 } } },
    statA: { alteration: 30 }, statB: { maitrise: 20 }, ks2: { name: 'Épidémie', desc: 'Ta maladie s\'applique AUSSI au pack (50%).', ks: { dotAoe: 0.5 } },
    cap: KDMG(1.10, 'Avatar de peste', '+10% de dégâts, +40 Altération.') },
  { id: 'givremort', name: 'Givre-mort', wow: 'DK Givre', role: 'dps', color: '#4dd0e1', icon: '❄', primary: 'force', type: 'froid', sig: 'eclat_de_glace',
    identity: { name: 'Brisure', desc: 'Exécute les ennemis ralentis/gelés sous 35% de PV (×2).', ks: { executeBonus: { threshold: 0.35, mult: 2 } } },
    statA: { critique: 22 }, statB: { hate: 20 }, ks2: { name: 'Souffle glacial', desc: '+12% de chance de Multifrappe.', ks: { multistrike: 0.12 } },
    cap: KDMG(1.15, 'Pilier de givre', '+15% de dégâts.') },

  /* ===================== DPS — AGILITÉ ===================== */
  { id: 'tireur', name: 'Tireur d\'élite', wow: 'Chasseur Précision', role: 'dps', color: '#51cf66', icon: '🎯', primary: 'agilite', type: 'physique', sig: 'tir_precis',
    identity: { name: 'Visée parfaite', desc: 'Exécute les ennemis sous 20% de PV (×2).', stat: { precision: 30 }, ks: { executeBonus: { threshold: 0.2, mult: 2 } } },
    statA: { critique: 24 }, statB: { degatsCrit: 22 }, cap: KDMG(1.15, 'Tir mortel', '+15% de dégâts.') },
  { id: 'ombrelame', name: 'Lame des ombres', wow: 'Voleur Finesse', role: 'dps', color: '#b197fc', icon: '🌑', primary: 'agilite', type: 'ombre', sig: 'embuscade',
    identity: { name: 'Ouverture', desc: '×1,8 dégâts pendant les 5 premières s face à chaque ennemi.', ks: { openerBonus: { mult: 1.8, seconds: 5 } } },
    statA: { critique: 24 }, statB: { degatsCrit: 24 }, cap: KDMG(1.10, 'Danse des ombres', '+10% de dégâts.'), ult: { name: 'Phase éthérée', power: 'phase_etheree' } },
  { id: 'traqueur', name: 'Traqueur du Fléau', wow: 'DH Dévastation', role: 'dps', color: '#e8590c', icon: '😈', primary: 'agilite', type: 'feu', sig: 'lame_du_chaos',
    identity: KDMG(1.20, 'Métamorphose', '+20% de dégâts de chaos.'),
    statA: { critique: 22 }, statB: { hate: 22 }, ks2: { name: 'Fureur démoniaque', desc: '+10% de chance de Multifrappe.', ks: { multistrike: 0.10 } },
    cap: KDMG(1.10, 'Chasseur traqué', '+10% de dégâts.') },
  { id: 'bete', name: 'Maître des bêtes', wow: 'Chasseur Bêtes', role: 'dps', color: '#82c91e', icon: '🐾', primary: 'agilite', type: 'nature', sig: 'griffes_meute',
    identity: KDMG(1.22, 'Meute', '+22% de dégâts (ton familier frappe en continu — idéal en idle).'),
    statA: { critique: 22 }, statB: { hate: 22 }, cap: KDMG(1.12, 'Appel sauvage', '+12% de dégâts.') },
  { id: 'assassin', name: 'Assassin', wow: 'Voleur Assassinat', role: 'dps', color: '#94d82d', icon: '🗡', primary: 'agilite', type: 'nature', sig: 'poison',
    identity: { name: 'Toxines', desc: 'Tes coups empoisonnent (DoT 35% du coup/s, 6 s).', ks: { dot: { frac: 0.35, duration: 6 } } },
    statA: { alteration: 34 }, statB: { critique: 18 }, cap: KDMG(1.10, 'Maître des poisons', '+10% de dégâts, +40 Altération.') },
  { id: 'flibustier', name: 'Flibustier', wow: 'Voleur Hors-la-loi', role: 'dps', color: '#fab005', icon: '🎲', primary: 'agilite', type: 'physique', sig: 'eviscaration',
    identity: { name: 'Coup de dés', desc: '+25% de chance de Multifrappe.', ks: { multistrike: 0.25 } },
    statA: { hate: 28 }, statB: { critique: 22 }, cap: { name: 'Roulette truquée', desc: '+30 Surpuissance (mult de dégâts universel) — le chaos qui paie.', stat: { surpuissance: 30 } } },
  { id: 'felin', name: 'Druide félin', wow: 'Druide Farouche', role: 'dps', color: '#a9e34b', icon: '🐱', primary: 'agilite', type: 'nature', sig: 'saignement_sauvage',
    identity: { name: 'Lacérations', desc: 'Tes coups font saigner (DoT 30% du coup/s, 6 s).', ks: { dot: { frac: 0.30, duration: 6 } } },
    statA: { alteration: 30 }, statB: { critique: 20 }, cap: KDMG(1.08, 'Frénésie sauvage', '+8% de dégâts, +40 Altération.') },
  { id: 'pisteur', name: 'Pisteur', wow: 'Chasseur Survie', role: 'dps', color: '#66a80f', icon: '🪤', primary: 'agilite', type: 'nature', sig: 'piege_explosif',
    identity: { name: 'Pièges mortels', desc: 'Tes coups infligent un DoT (25% du coup/s, 5 s).', ks: { dot: { frac: 0.25, duration: 5 } } },
    statA: { alteration: 26 }, statB: { critique: 20 }, cap: KDMG(1.12, 'Survivant', '+12% de dégâts.') },
  { id: 'marchevent', name: 'Marche-vent', wow: 'Moine Marche-vent', role: 'dps', color: '#3bc9db', icon: '🐯', primary: 'agilite', type: 'physique', sig: 'paume_du_tigre',
    identity: { name: 'Enchaînement', desc: '+18% de chance de Multifrappe.', ks: { multistrike: 0.18 } },
    statA: { hate: 28 }, statB: { critique: 20 }, cap: KDMG(1.12, 'Touche du chi', '+12% de dégâts.'), ult: { name: 'Vengeance différée', power: 'vengeance_differee' } },
  { id: 'amelio', name: 'Chaman amélioration', wow: 'Chaman Amélioration', role: 'dps', color: '#ffd43b', icon: '⚡', primary: 'agilite', type: 'foudre', sig: 'arc_voltaique',
    identity: { name: 'Surcharge', desc: 'Tes attaques rebondissent sur 2 ennemis (45% des dégâts).', ks: { chainArc: { frac: 0.45, targets: 2 } } },
    statA: { hate: 26 }, statB: { critique: 20 }, ks2: { name: 'Loups spectraux', desc: '+18% de chance de Multifrappe.', ks: { multistrike: 0.18 } },
    cap: KDMG(1.12, 'Tempête ascendante', '+12% de dégâts.') },

  /* ===================== DPS — INTELLIGENCE ===================== */
  { id: 'pyromancien', name: 'Pyromancien', wow: 'Mage Feu', role: 'dps', color: '#ff6b35', icon: '🔥', primary: 'intelligence', type: 'feu', sig: 'boule_de_feu',
    identity: { name: 'Combustion', desc: 'Tes coups brûlent (DoT 22% du coup/s, 5 s).', ks: { dot: { frac: 0.22, duration: 5 } } },
    statA: { maitrise: 28 }, statB: { critique: 22 }, cap: KDMG(1.15, 'Immolation', '+15% de dégâts.') },
  { id: 'cryomancien', name: 'Cryomancien', wow: 'Mage Givre', role: 'dps', color: '#4dabf7', icon: '🧊', primary: 'intelligence', type: 'froid', sig: 'eclat_de_glace',
    identity: { name: 'Éclatement', desc: 'Exécute les ennemis gelés sous 35% de PV (×2).', stat: { precision: 24 }, ks: { executeBonus: { threshold: 0.35, mult: 2 } } },
    statA: { maitrise: 28 }, statB: { critique: 20 }, cap: KDMG(1.10, 'Hiver éternel', '+10% de dégâts.') },
  { id: 'arcaniste', name: 'Arcaniste', wow: 'Mage Arcanes', role: 'dps', color: '#c084fc', icon: '✨', primary: 'intelligence', type: 'arcane', sig: 'eclair',
    identity: KDMG(1.25, 'Pouvoir arcanique', '+25% de dégâts de sorts.'),
    statA: { maitrise: 30 }, statB: { recuperation: 6 }, ks2: { name: 'Précipitation', desc: 'Chaque sort réduit les autres recharges de 0,8 s.', ks: { cdrOnCast: 0.8 } },
    cap: { name: 'Hors du temps', desc: '+30% de dégâts de SORTS.', ks: { spellMult: 1.3 } }, ult: { name: 'Déluge stellaire', power: 'deluge_stellaire' } },
  { id: 'effroi', name: 'Démoniste de l\'effroi', wow: 'Démo. Affliction', role: 'dps', color: '#9775fa', icon: '💀', primary: 'intelligence', type: 'ombre', sig: 'mot_de_lombre',
    identity: { name: 'Fléaux', desc: 'Tes coups affligent (DoT 35% du coup/s, 6 s).', ks: { dot: { frac: 0.35, duration: 6 } } },
    statA: { alteration: 36 }, statB: { maitrise: 18 }, ks2: { name: 'Contagion', desc: 'Ton affliction s\'applique au pack (50%).', ks: { dotAoe: 0.5 } },
    cap: KDMG(1.20, 'Malédiction suprême', '+20% de dégâts, +40 Altération.'), ult: { name: 'Hémorragie cosmique', power: 'hemorragie_cosmique' } },
  { id: 'invocateur', name: 'Invocateur', wow: 'Démo. Démonologie', role: 'dps', color: '#845ef7', icon: '👹', primary: 'intelligence', type: 'ombre', sig: 'nuee_demoniaque',
    identity: KDMG(1.22, 'Légion', '+22% de dégâts (tes démons frappent en continu — idéal en idle).'),
    statA: { maitrise: 28 }, statB: { critique: 18 }, cap: KDMG(1.12, 'Tyran démoniaque', '+12% de dégâts.') },
  { id: 'destructeur', name: 'Destructeur', wow: 'Démo. Destruction', role: 'dps', color: '#f03e3e', icon: '💥', primary: 'intelligence', type: 'feu', sig: 'ruine',
    identity: { name: 'Chaos incarné', desc: '+30 Surpuissance (mult de dégâts universel).', stat: { surpuissance: 30 } },
    statA: { maitrise: 28 }, statB: { critique: 20 }, cap: KDMG(1.15, 'Cataclysme', '+15% de dégâts.') },
  { id: 'elementaliste', name: 'Élémentaliste', wow: 'Chaman Élémentaire', role: 'dps', color: '#ffa94d', icon: '🌋', primary: 'intelligence', type: 'foudre', sig: 'fulguration',
    identity: { name: 'Foudre en chaîne', desc: 'Tes attaques rebondissent sur 2 ennemis (45% des dégâts).', ks: { chainArc: { frac: 0.45, targets: 2 } } },
    statA: { maitrise: 28 }, statB: { penetration: 22 }, cap: KDMG(1.18, 'Ascendance', '+18% de dégâts.') },
  { id: 'devastateur', name: 'Aspect dévastateur', wow: 'Évoker Dévastation', role: 'dps', color: '#ff8787', icon: '🐉', primary: 'intelligence', type: 'feu', sig: 'souffle_ardent',
    identity: KDMG(1.20, 'Souffle draconique', '+20% de dégâts à charge.'),
    statA: { maitrise: 28 }, statB: { critique: 20 }, cap: KDMG(1.12, 'Colère draconique', '+12% de dégâts.') },
  { id: 'lunaire', name: 'Lunaire', wow: 'Druide Équilibre', role: 'dps', color: '#748ffc', icon: '🌙', primary: 'intelligence', type: 'arcane', sig: 'salve_arcanique',
    identity: { name: 'Éclipse', desc: 'Plus ton profil mêle d\'éléments, plus tu frappes fort (+7%/type ≥10%).', ks: { multiTypeBonus: { per: 0.07, threshold: 0.10 } } },
    statA: { maitrise: 28 }, statB: { critique: 20 }, ks2: { name: 'Brûlure lunaire', desc: 'Tes coups brûlent (DoT 18% du coup/s, 5 s).', ks: { dot: { frac: 0.18, duration: 5 } } },
    cap: KDMG(1.18, 'Incarnation', '+18% de dégâts.'), ult: { name: 'Sceau de faiblesse', power: 'sceau_faiblesse' } },
  { id: 'ombremancien', name: 'Ombremancien', wow: 'Prêtre Ombre', role: 'dps', color: '#7048e8', icon: '🗯️', primary: 'intelligence', type: 'ombre', sig: 'mot_de_lombre',
    identity: { name: 'Folie', desc: 'Tes coups affligent (DoT 30% du coup/s, 6 s).', ks: { dot: { frac: 0.30, duration: 6 } } },
    statA: { alteration: 30 }, statB: { critique: 18 }, cap: KDMG(1.15, 'Forme du Vide', '+15% de dégâts, +40 Altération.') },

  /* ===================== TANKS ===================== */
  { id: 'gardien', name: 'Gardien', wow: 'Guerrier Protection', role: 'tank', color: '#ffd43b', icon: '🛡', primary: 'force', type: 'physique', sig: 'provocation',
    identity: { name: 'Mur de boucliers', desc: '-15% de dégâts subis, renvoie 20% des dégâts (épines).', ks: { flatDr: 0.15, thorns: 0.2 } },
    statA: { reductionDegats: 24 }, statB: { endurance: 30 }, cap: { name: 'Inébranlable', desc: '-20% de dégâts subis, +200 Endurance.', stat: { endurance: 200 }, ks: { flatDr: 0.2 } }, ult: { name: 'Égide titanesque', power: 'egide_titanesque' } },
  { id: 'croise', name: 'Croisé-Bouclier', wow: 'Paladin Protection', role: 'tank', color: '#ffe066', icon: '⛪', primary: 'endurance', type: 'arcane', sig: 'provocation',
    identity: { name: 'Conviction', desc: '40% de ton Endurance compte comme Intelligence (frappes sacrées).', ks: { enduranceAs: { to: 'intelligence', frac: 0.4 } } },
    statA: { reductionDegats: 22 }, statB: { barriere: 120 }, ks2: { name: 'Aura protectrice', desc: 'Tes alliés bénéficient de 35% de ta résistance.', ks: { shareResist: 0.35 } },
    cap: { name: 'Gardien de la foi', desc: '-12% de dégâts subis, +120 Endurance.', stat: { endurance: 120 }, ks: { flatDr: 0.12 } } },
  { id: 'sang', name: 'Chevalier de sang', wow: 'DK Sang', role: 'tank', color: '#e03131', icon: '🩸', primary: 'force', type: 'ombre', sig: 'coup_runique',
    identity: { name: 'Arme runique', desc: '+25 Vol de vie, et tes DoT te soignent (20% du tick).', stat: { volDeVie: 25 }, ks: { dotLeech: 0.2 } },
    statA: { volDeVie: 14 }, statB: { reductionDegats: 20 }, cap: { name: 'Pacte de sang', desc: '-12% de dégâts subis, +20 Vol de vie.', stat: { volDeVie: 20 }, ks: { flatDr: 0.12 } }, ult: { name: 'Soif du néant', power: 'soif_du_neant' } },
  { id: 'brasseur', name: 'Maître brasseur', wow: 'Moine Brasseur', role: 'tank', color: '#94d82d', icon: '🍶', primary: 'agilite', type: 'nature', sig: 'provocation',
    identity: { name: 'Report (stagger)', desc: '-15% de dégâts subis, +40 Esquive.', stat: { esquive: 40 }, ks: { flatDr: 0.15 } },
    statA: { esquive: 26 }, statB: { reductionDegats: 18 }, cap: { name: 'Tonneau ivre', desc: '-10% de dégâts subis, +40 Esquive, +30 Régén.', stat: { esquive: 40, regen: 30 }, ks: { flatDr: 0.1 } } },
  { id: 'sylvestre', name: 'Gardien sylvestre', wow: 'Druide Gardien', role: 'tank', color: '#37b24d', icon: '🐻', primary: 'endurance', type: 'nature', sig: 'provocation',
    identity: { name: 'Cuir épais', desc: '+30% de dégâts au-dessus de 60% PV, -10% de dégâts subis.', ks: { highHpBonus: { threshold: 0.6, mult: 1.3 }, flatDr: 0.1 } },
    statA: { endurance: 40 }, statB: { regen: 28 }, cap: { name: 'Incarnation : Ursoc', desc: '+200 Endurance, +40 Régén.', stat: { endurance: 200, regen: 40 } } },
  { id: 'vengeance', name: 'Chasseur de démons', wow: 'DH Vengeance', role: 'tank', color: '#e8590c', icon: '👿', primary: 'agilite', type: 'feu', sig: 'lacere_chaos',
    identity: { name: 'Âmes dévorées', desc: '+25 Vol de vie, renvoie 25% des dégâts (épines).', stat: { volDeVie: 25 }, ks: { thorns: 0.25 } },
    statA: { volDeVie: 12 }, statB: { reductionDegats: 20 }, cap: { name: 'Métamorphose démoniaque', desc: '-12% de dégâts subis, +12% de dégâts.', ks: { flatDr: 0.12, damageMult: 1.12 } } },
  { id: 'colosse', name: 'Colosse', wow: 'Juggernaut', role: 'tank', color: '#a9b4c2', icon: '🗿', primary: 'endurance', type: 'physique', sig: 'onde_de_force',
    identity: { name: 'Force du titan', desc: '35% de ton Endurance compte comme Force.', ks: { enduranceAs: { to: 'force', frac: 0.35 } } },
    statA: { endurance: 45 }, statB: { reductionDegats: 18 }, ks2: { name: 'Rouleau compresseur', desc: '+30% de dégâts au-dessus de 70% PV.', ks: { highHpBonus: { threshold: 0.7, mult: 1.3 } } },
    cap: { name: 'Montagne vivante', desc: '+200 Endurance, -15% de dégâts subis.', stat: { endurance: 200 }, ks: { flatDr: 0.15 } } },

  /* ===================== HEALERS ===================== */
  { id: 'sacre', name: 'Prêtre sacré', wow: 'Prêtre Sacré', role: 'heal', color: '#69db7c', icon: '✚', primary: 'intelligence', type: 'arcane', sig: 'guerison_majeure',
    identity: { name: 'Réseau de vie', desc: 'Tes soins sont amplifiés de 40% (HoT).', ks: { hot: 0.4 } },
    statA: { regen: 28 }, statB: { intelligence: 22 }, cap: { name: 'Avatar de vie', desc: 'Soins +30%, +100 Intelligence, +80 Régén.', stat: { intelligence: 100, regen: 80 }, ks: { hot: 0.3 } }, ult: { name: 'Aube salvatrice', power: 'aube_salvatrice' } },
  { id: 'disciple', name: 'Disciple', wow: 'Prêtre Discipline', role: 'heal', color: '#9775fa', icon: '🕯️', primary: 'intelligence', type: 'ombre', sig: 'chatiment',
    identity: { name: 'Expiation', desc: 'Tes sorts de soin infligent aussi 60% du soin en dégâts à l\'ennemi.', ks: { healToDamage: 0.6 } },
    statA: { intelligence: 20 }, statB: { regen: 22 }, cap: { name: 'Transsubstantiation', desc: '+40% de heal→dégâts, soins +25%.', ks: { healToDamage: 0.4, hot: 0.25 } } },
  { id: 'reparateur', name: 'Druide réparateur', wow: 'Druide Restauration', role: 'heal', color: '#66bb6a', icon: '🌿', primary: 'intelligence', type: 'nature', sig: 'rajeunissement',
    identity: { name: 'Floraison', desc: 'Tes soins sur la durée sont amplifiés de 50% (HoT).', ks: { hot: 0.5 } },
    statA: { regen: 26 }, statB: { intelligence: 20 }, cap: { name: 'Arbre de vie', desc: 'Soins +30%, +90 Intelligence, +60 Régén.', stat: { intelligence: 90, regen: 60 }, ks: { hot: 0.3 } } },
  { id: 'restaurateur', name: 'Chaman restaurateur', wow: 'Chaman Restauration', role: 'heal', color: '#3bc9db', icon: '🌊', primary: 'intelligence', type: 'foudre', sig: 'imposition_des_mains',
    identity: { name: 'Vague de guérison', desc: 'Tes soins sont amplifiés de 30% (HoT) — soin en chaîne.', ks: { hot: 0.3 } },
    statA: { regen: 26 }, statB: { intelligence: 20 }, cap: { name: 'Totem de vie', desc: 'Soins +25%, +90 Intelligence.', stat: { intelligence: 90 }, ks: { hot: 0.25 } } },
  { id: 'preservateur', name: 'Préservateur', wow: 'Évoker Préservation', role: 'heal', color: '#20c997', icon: '🥚', primary: 'intelligence', type: 'feu', sig: 'songe_emeraude',
    identity: { name: 'Don de l\'éveillé', desc: 'Tes soins à charge sont amplifiés de 35% (HoT).', ks: { hot: 0.35 } },
    statA: { regen: 26 }, statB: { intelligence: 20 }, cap: { name: 'Écho temporel', desc: 'Soins +28%, +90 Intelligence.', stat: { intelligence: 90 }, ks: { hot: 0.28 } } },
  { id: 'paladinsacre', name: 'Paladin sacré', wow: 'Paladin Sacré', role: 'heal', color: '#ffe066', icon: '🌟', primary: 'force', type: 'arcane', sig: 'lumiere_sacree',
    identity: { name: 'Puissance sacrée', desc: 'Soin par l\'attaque (scale FORCE), amplifié de 25% (HoT).', ks: { hot: 0.25 } },
    statA: { regen: 22 }, statB: { force: 20 }, cap: { name: 'Aube dorée', desc: 'Soins +25%, +80 Régén.', stat: { regen: 80 }, ks: { hot: 0.25 } } },
  { id: 'brume', name: 'Tisse-brume', wow: 'Moine Tisse-brume', role: 'heal', color: '#63e6be', icon: '🌫️', primary: 'agilite', type: 'nature', sig: 'brume_revigorante',
    identity: { name: 'Fistweaving', desc: 'Frapper soigne (scale AGI), soins amplifiés de 30% (HoT).', ks: { hot: 0.3 } },
    statA: { hate: 22 }, statB: { regen: 22 }, cap: { name: 'Brume revigorante', desc: 'Soins +25%, +12% de dégâts (le combat soigne).', ks: { hot: 0.25, damageMult: 1.12 } } },
]

for (const d of CLASSES) emitClass(d)

/* Méta de constellation : Cœur (tronc) + une par classe. */
export const CONSTELLATIONS: Record<ConstellationId, ConstellationMeta> = (() => {
  const out = {} as Record<ConstellationId, ConstellationMeta>
  out.coeur = { id: 'coeur', name: 'Cœur', role: 'Tronc commun', color: '#e2e8f0', icon: '✶' }
  const roleLabel: Record<Role, string> = { dps: 'DPS', tank: 'Tank', heal: 'Soigneur' }
  for (const d of CLASSES) {
    out[d.id] = { id: d.id, name: d.name, role: `${roleLabel[d.role]} · ${d.wow}`, color: d.color, icon: d.icon, archetype: true }
  }
  return out
})()

export const CONSTELLATION_LIST: ConstellationId[] = ['coeur', ...CLASSES.map((d) => d.id)]

/* ------------------------------------------------------------------ */
/* Accès & agrégation (API INCHANGÉE — consommée par character.ts / UI). */
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

/* ------------------------------------------------------------------ */
/* GATING — palier CUMULATIF (v0.25) + verrou de compétence (v0.24).
/*  v0.29 : GATE_PER_TIER 5→3 (noyaux compacts → dipper une classe coûte ~2 pts → MIX natif).
/*  Le total exigé est clampé aux points disponibles en dessous (noyaux fins finissables).
/* ------------------------------------------------------------------ */
export const GATE_PER_TIER = 3

const tierTotals = new Map<ConstellationId, Map<number, number>>()
function tierTotalsFor(c: ConstellationId): Map<number, number> {
  let m = tierTotals.get(c)
  if (!m) {
    m = new Map()
    for (const n of TALENTS) {
      if (n.constellation !== c) continue
      m.set(n.tier, (m.get(n.tier) ?? 0) + n.maxRank)
    }
    tierTotals.set(c, m)
  }
  return m
}

/** Tier PRÉCÉDENT existant (le plus haut < tier ayant des nœuds) dans la constellation. */
function previousTier(c: ConstellationId, tier: number): number | null {
  let best: number | null = null
  for (const t of tierTotalsFor(c).keys()) {
    if (t < tier && (best == null || t > best)) best = t
  }
  return best
}

/** Points dépensés dans TOUS les tiers ≤ `tier` d'une constellation (cumulatif). */
export function spentInTier(talents: Record<string, number>, c: ConstellationId, tier: number): number {
  let spent = 0
  for (const id in talents) {
    const node = BY_ID.get(id)
    if (node?.constellation === c && node.tier <= tier) spent += talents[id]
  }
  return spent
}

/**
 * Verrou de palier d'un nœud (CUMULATIF) : GATE_PER_TIER points PAR TIER DE PROFONDEUR, dépensés
 * n'importe où dans les tiers ≤ tier précédent de la constellation. Clampé aux points disponibles.
 */
export function tierGate(node: TalentNode): { tier: number; need: number } {
  if (node.tier <= 0 || node.constellation === 'coeur') return { tier: 0, need: 0 }
  const prev = previousTier(node.constellation, node.tier)
  if (prev == null) return { tier: 0, need: 0 }
  const totals = tierTotalsFor(node.constellation)
  let depth = 0
  let available = 0
  for (const [t, total] of totals) {
    if (t < node.tier) { depth++; available += total }
  }
  return { tier: prev, need: Math.min(GATE_PER_TIER * depth, available) }
}

/** Les nœuds FORTS exigent leurs prérequis au rang MAX (verrou de compétence). */
export function strictRequires(node: TalentNode): boolean {
  return node.kind === 'keystone' || node.kind === 'ability'
}

/** Détail du verrouillage d'un nœud (pour l'UI). */
export interface GateInfo {
  gateTier: number
  spent: number
  need: number
  missingMaxed: string[]
}
export function gateInfo(node: TalentNode, talents: Record<string, number>): GateInfo {
  const missingMaxed: string[] = []
  if (strictRequires(node)) {
    for (const r of node.requires ?? []) {
      const rn = BY_ID.get(r)
      if (rn && (talents[r] ?? 0) < rn.maxRank) missingMaxed.push(rn.name)
    }
  }
  const g = tierGate(node)
  return { gateTier: g.tier, spent: g.need > 0 ? spentInTier(talents, node.constellation, g.tier) : 0, need: g.need, missingMaxed }
}

/** Peut-on allouer un point dans ce nœud ? (prérequis + verrous de palier/compétence). */
export function canAllocate(node: TalentNode, talents: Record<string, number>, points: number): boolean {
  if (points <= 0) return false
  if ((talents[node.id] ?? 0) >= node.maxRank) return false
  const strict = strictRequires(node)
  if (node.requires && node.requires.length) {
    const ok = node.requires.every((r) => {
      const have = talents[r] ?? 0
      if (have <= 0) return false
      if (!strict) return true
      const rn = BY_ID.get(r)
      return have >= (rn?.maxRank ?? 1)
    })
    if (!ok) return false
  }
  const g = tierGate(node)
  if (g.need > 0 && spentInTier(talents, node.constellation, g.tier) < g.need) return false
  return true
}

/** Le nœud est-il accessible (TOUS les prérequis remplis), indépendamment des points ? */
export function isReachable(node: TalentNode, talents: Record<string, number>): boolean {
  if (!node.requires || node.requires.length === 0) return true
  return node.requires.every((r) => (talents[r] ?? 0) > 0)
}
