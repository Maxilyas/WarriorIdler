import type { StatBlock, DamageType } from './types'
export type { KeystoneEffect } from './classData'
import type { KeystoneEffect } from './classData'

/**
 * ARBRE DE TALENTS v0.29.3 — ARBRES À CHOIX (façon Path of Exile), handcrafted classe par classe.
 *
 *   RACINE (Éveil) → 4 CATÉGORIES (armure) → CLASSES → ARCHÉTYPES (webs de grappes).
 *
 * Modèle d'allocation NOUVEAU (fini le couloir) :
 *   - RÉACHABILITÉ PAR ADJACENCE : un nœud est dispo s'il TOUCHE n'importe quel nœud déjà pris
 *     (`requires` = parent de layout + `links` = anneau/routes croisées, tous traités comme voisins).
 *   - NŒUDS DE CHOIX EXCLUSIFS (`exclusive`) : prendre A verrouille ses frères de groupe.
 *   - CONVERGENCE (`requiresAll`) : exige TOUS les nœuds listés (ex. identité au carrefour).
 *   - BUDGET (`minSpent`) : les payoffs (ultimes, capstones) exigent N pts investis DANS la voie.
 * → on navigue, on esquive ce qu'on ne veut pas, on trouve plein de chemins/builds. Multi-classe natif
 *   (catégories + entrées peu chères + keystones qui s'empilent entre classes, aucun cap).
 *
 * FAIT : Voleur (Cuir) → Assassin (afflictions) + Ombrelame (combo/ombre).
 *        Mage (Tissu) → Pyromancien (feu/ignite) + Cryomancien (givre/contrôle/shatter) + Arcaniste (charges/CDR).
 *        Chasseur (Mailles) → Meneur de meute (familier/invocation) + Œil de faucon (Concentration/exécution).
 *        Guerrier (Plaque) → Sentence (Rage/exécution/saignements) + Rempart (TANK : Rage→bouclier/épines).
 *        Prêtre (Tissu) → Lumière (HEAL : soin+châtiment) + Vide (DPS : DoT ombre/Folie).
 */

export type ConstellationId =
  | 'coeur' | 'voleur' | 'assassin' | 'ombrelame'
  | 'mage' | 'pyromancien' | 'cryomancien' | 'arcaniste'
  | 'chasseur' | 'meute' | 'faucon'
  | 'guerrier' | 'sentence' | 'rempart'
  | 'pretre' | 'lumiere' | 'vide'
  | 'dk' | 'givremort' | 'sang'
  | 'demoniste' | 'pestilence' | 'legion'
  | 'chaman' | 'elementaire' | 'vague'
  | 'druide' | 'lunaire' | 'ronce' | 'floraison'
  | 'paladin' | 'croise' | 'templier' | 'aube'

export interface ConstellationMeta {
  id: ConstellationId
  name: string
  role: string
  color: string
  icon: string
  archetype?: boolean
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
  /** Parent(s) de LAYOUT + voisins (réachabilité OR). */
  requires?: string[]
  /** Liens d'adjacence SUPPLÉMENTAIRES (anneau, routes croisées) — bidirectionnels pour la réachabilité. */
  links?: string[]
  /** CONVERGENCE : exige TOUS ces nœuds (au lieu de l'un d'eux). */
  requiresAll?: string[]
  /** CHOIX EXCLUSIF : prendre ce nœud verrouille les autres du même groupe. */
  exclusive?: string
  /** BUDGET : points à dépenser dans la constellation avant de pouvoir l'allouer. */
  minSpent?: number
  /** RANG PRÉREQUIS (v0.30) : un nœud précis doit être à AU MOINS ce rang (souvent son maximum) avant
   *  d'allouer celui-ci. Sert à GATER la puissance brute (DR/épines/+%dégâts) derrière un vrai
   *  investissement dans la node d'avant — « monte d'abord ce mineur au max ». */
  requiresRank?: { id: string; rank: number }
  statMods?: StatBlock
  resistMods?: Partial<Record<DamageType, number>>
  unlockPower?: string
  keystone?: KeystoneEffect
}

/* ------------------------------------------------------------------ */
/* Helpers de construction.                                           */
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
type Opt = Partial<Pick<TalentNode, 'requires' | 'links' | 'requiresAll' | 'exclusive' | 'minSpent' | 'requiresRank' | 'statMods' | 'resistMods' | 'unlockPower' | 'keystone'>>
function node(id: string, c: ConstellationId, kind: TalentKind, tier: number, maxRank: number, name: string, description: string, opt: Opt = {}) {
  TALENTS.push({ id, name, constellation: c, kind, tier, maxRank, description, ...opt })
}
function minor(id: string, c: ConstellationId, tier: number, name: string, maxRank: number, stat: StatBlock, opt: Opt = {}) {
  node(id, c, 'minor', tier, maxRank, name, `${sd(stat)} par rang.`, { statMods: stat, ...opt })
}
function ks(id: string, c: ConstellationId, tier: number, name: string, desc: string,
  kStone: { stat?: StatBlock; ks?: KeystoneEffect; resist?: Partial<Record<DamageType, number>> }, opt: Opt = {}) {
  node(id, c, opt.exclusive ? 'notable' : 'keystone', tier, 1, name, desc,
    { ...(kStone.stat ? { statMods: kStone.stat } : {}), ...(kStone.ks ? { keystone: kStone.ks } : {}), ...(kStone.resist ? { resistMods: kStone.resist } : {}), ...opt })
}
function ability(id: string, c: ConstellationId, tier: number, name: string, power: string, desc: string, opt: Opt = {}) {
  node(id, c, 'ability', tier, 1, name, desc, { unlockPower: power, ...opt })
}

/* ------------------------------------------------------------------ */
/* RACINE + 4 CATÉGORIES.                                              */
/* ------------------------------------------------------------------ */
node('co_start', 'coeur', 'ability', 0, 1, 'Éveil', '+10 stats primaires, +20 Endurance, débloque Frappe. La racine de l\'arbre.',
  { statMods: { force: 10, agilite: 10, intelligence: 10, endurance: 20 }, unlockPower: 'frappe_simple' })
node('cat_plaque', 'coeur', 'gateway', 1, 1, 'Plaque', 'Catégorie Plaque (Guerrier, Paladin, Chevalier de la mort). +40 Endurance, +15 Force.', { requires: ['co_start'], statMods: { endurance: 40, force: 15 } })
node('cat_mailles', 'coeur', 'gateway', 1, 1, 'Mailles', 'Catégorie Mailles (Chasseur, Chaman). +20 Agilité, +20 Intelligence.', { requires: ['co_start'], statMods: { agilite: 20, intelligence: 20 } })
node('cat_cuir', 'coeur', 'gateway', 1, 1, 'Cuir', 'Catégorie Cuir (Voleur, Druide). +30 Agilité, +15 Critique.', { requires: ['co_start'], statMods: { agilite: 30, critique: 15 } })
node('cat_tissu', 'coeur', 'gateway', 1, 1, 'Tissu', 'Catégorie Tissu (Mage, Démoniste, Prêtre). +40 Intelligence.', { requires: ['co_start'], statMods: { intelligence: 40 } })

/* VOLEUR — nœud de classe (peu cher : multi-classe natif). */
node('cl_voleur', 'voleur', 'ability', 0, 1, 'Voleur', 'Maître de la lame et du poison. Débloque Tranchant et ouvre ses deux archétypes. +25 Agilité, +15 Critique.',
  { requires: ['cat_cuir'], statMods: { agilite: 25, critique: 15 }, unlockPower: 'vo_tranchant' })

/* ================= ASSASSIN — réseau d'afflictions (PROFONDEUR : sorts gatés + modificateurs) =================
 * 1 sort de départ. La Distillation se MÉRITE (derrière les amplis de venin). L'ultime est tout au fond.
 * Les intermédiaires MODIFIENT tes sorts (tags cross-classe), ils ne donnent pas que des stats.
 */
ability('as_hub', 'assassin', 0, 'Assassin', 'as_lame_enduite', 'Entre dans la voie de l\'Assassin : débloque Lame enduite (venin cumulatif). +18 Agilité, +15 Altération.', { requires: ['cl_voleur'], statMods: { agilite: 18, alteration: 15 } })

// --- VENIN : amplis qui GATENT la Distillation ---
minor('as_tox', 'assassin', 1, 'Toxicologie', 3, { alteration: 18 }, { requires: ['as_hub'] })
ks('as_virulence', 'assassin', 1, 'Virulence', 'Tes sorts [dot] infligent +12% (marche aussi pour les DoT des autres classes).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'dot', damageMult: 1.12 } } }, { requires: ['as_tox'] })
ks('as_venmort', 'assassin', 2, 'Venin mortel', 'Ton venin s\'empile plus haut et frappe plus fort.', { stat: { alteration: 16 }, ks: { poison: { perStack: 0.05, maxStacks: 2 } } }, { requires: ['as_tox'] })
ks('as_letal', 'assassin', 3, 'Venin létal', 'CHOIX : +grosse intensité par stack (venin lent et brutal).', { stat: { alteration: 14 }, ks: { poison: { perStack: 0.06, maxStacks: 0 } } }, { requires: ['as_venmort'], exclusive: 'as_venin' })
ks('as_viru', 'assassin', 3, 'Venin virulent', 'CHOIX : +2 stacks max (venin qui sature plus haut).', { stat: { alteration: 14 }, ks: { poison: { perStack: 0, maxStacks: 2 } } }, { requires: ['as_venmort'], exclusive: 'as_venin' })

// --- DÉTONATION (gatée derrière le venin) → COMBO → ULTIME au fond ---
minor('as_buf_venin', 'assassin', 3, 'Distillerie', 5, { alteration: 8 }, { requires: ['as_venmort'] }) // ⛓ TAMPON : max (5 pts) pour la Distillation
ability('as_dist', 'assassin', 4, 'Distillation', 'as_distillation', 'Débloque Distillation : DÉTONE tous les stacks de venin (pic = stacks × dégâts). Gatée : Distillerie au max + 6 pts dans la voie.', { requires: ['as_venmort'], requiresRank: { id: 'as_buf_venin', rank: 5 }, minSpent: 6 })
ks('as_catalyse', 'assassin', 5, 'Catalyse', 'COMBO : ta Distillation DOUBLE le venin avant de détoner.', { stat: { penetration: 16 }, ks: { detonateDouble: true } }, { requires: ['as_dist'] })
ks('as_chain', 'assassin', 5, 'Réaction en chaîne', 'La détonation et tes DoT se propagent au pack (50%).', { stat: { penetration: 16 }, ks: { dotAoe: 0.5 } }, { requires: ['as_dist'] })
ability('as_peste', 'assassin', 6, 'Peste Souveraine', 'as_peste_souveraine', 'ULTIME — détonation cataclysmique de tout le venin. Tout au fond : 20 pts dans la voie.', { requires: ['as_chain'], minSpent: 20 })

// --- SAIGNEMENT (2e source de DoT) + CHOIX EXCLUSIF de 2e SORT ---
minor('as_lame', 'assassin', 1, 'Lames affûtées', 3, { critique: 18 }, { requires: ['as_hub'] })
ks('as_hemo', 'assassin', 2, 'Hémorragie vive', 'Tes coups ouvrent une plaie (DoT physique, 20% du coup/s, 5 s).', { stat: { alteration: 12 }, ks: { dot: { frac: 0.2, duration: 5 } } }, { requires: ['as_lame'] })
minor('as_buf_saign', 'assassin', 3, 'Affilage', 5, { critique: 8 }, { requires: ['as_hemo'] }) // ⛓ TAMPON : max (5 pts) pour le 2e sort
ks('as_beante', 'assassin', 3, 'Plaie béante', 'CHOIX : +12% de dégâts (saignements brutaux).', { ks: { damageMult: 1.12 } }, { requires: ['as_hemo'], exclusive: 'as_saign' })
ks('as_infect', 'assassin', 3, 'Plaie infectée', 'CHOIX : le saignement nourrit le venin (+intensité de stack).', { stat: { alteration: 10 }, ks: { poison: { perStack: 0.04, maxStacks: 0 } } }, { requires: ['as_hemo'], exclusive: 'as_saign' })
ability('as_garrot', 'assassin', 4, 'Garrot', 'as_garrot', 'CHOIX de SORT : étrangle (gros DoT mono) — soigne via tes drains. Gaté : Affilage au max + 8 pts.', { requires: ['as_buf_saign'], requiresRank: { id: 'as_buf_saign', rank: 5 }, exclusive: 'as_arme2', minSpent: 8 })
ability('as_nuee', 'assassin', 4, 'Nuée toxique', 'as_nuee', 'CHOIX de SORT : un nuage de venin sur tout le pack. Gaté : Affilage au max + 8 pts.', { requires: ['as_buf_saign'], requiresRank: { id: 'as_buf_saign', rank: 5 }, exclusive: 'as_arme2', minSpent: 8 })
ks('as_etrangle', 'assassin', 4, 'Étranglement', 'Tes finisseurs exécutent les ennemis sous 20% de PV (×2,2).', { ks: { executeBonus: { threshold: 0.2, mult: 2.2 } } }, { requires: ['as_garrot'] })
ks('as_spores', 'assassin', 4, 'Spores', 'Ta Nuée propage les altérations à tout le pack (50%).', { stat: { alteration: 14 }, ks: { dotAoe: 0.5 } }, { requires: ['as_nuee'] })

// --- DRAIN (SURVIE — profil poison/drain) ---
minor('as_sang', 'assassin', 1, 'Sangsue', 5, { volDeVie: 8 }, { requires: ['as_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ks('as_vamp', 'assassin', 2, 'Vampirisme toxique', 'SURVIE : tes DoT te soignent (25% du tick). +20 Régén. Exige Sangsue au rang max (5).', { stat: { regen: 20 }, ks: { dotLeech: 0.25 } }, { requires: ['as_sang'], requiresRank: { id: 'as_sang', rank: 5 } })
ability('as_reprise', 'assassin', 2, 'Reprise', 'second_souffle', 'SURVIE : débloque Reprise (auto-soin) — pour tenir en solo dès le début.', { requires: ['as_sang'] })
ks('as_meta', 'assassin', 3, 'Métabolisme morbide', 'SURVIE : +30 Régén, +12 Vol de vie, -8% de dégâts subis. Profond : 8 pts dans la voie.', { stat: { regen: 30, volDeVie: 12 }, ks: { flatDr: 0.08 } }, { requires: ['as_vamp'], minSpent: 8 })

/* ================= OMBRELAME — combo & ombre (PROFONDEUR : finisseurs gatés + combos) ================= */
ability('om_hub', 'ombrelame', 0, 'Ombrelame', 'om_frappe_sournoise', 'Entre dans la voie de l\'Ombrelame : débloque Frappe sournoise (générateur de Points de Combo). +18 Agilité, +12 Critique.', { requires: ['cl_voleur'], statMods: { agilite: 18, critique: 12 } })

// --- GÉNÉRATION ---
minor('om_aff', 'ombrelame', 1, 'Affûtage', 3, { critique: 18 }, { requires: ['om_hub'] })
ks('om_directamp', 'ombrelame', 1, 'Précision', 'Tes sorts [direct] infligent +12% (marche aussi pour les autres classes).', { stat: { critique: 12 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['om_aff'] })
ks('om_saig', 'ombrelame', 2, 'Saignée preste', 'GÉNÉRATION : tes générateurs donnent +1 Point de Combo.', { stat: { hate: 16 }, ks: { comboGen: 1 } }, { requires: ['om_aff'] })
ks('om_oeil', 'ombrelame', 3, 'Œil pour œil', 'CHOIX : +20 Critique, +1 PC (génération sur burst de crit).', { stat: { critique: 20 }, ks: { comboGen: 1 } }, { requires: ['om_saig'], exclusive: 'om_gen' })
ks('om_cad', 'ombrelame', 3, 'Cadence', 'CHOIX : +24 Hâte (génération rapide et régulière).', { stat: { hate: 24 } }, { requires: ['om_saig'], exclusive: 'om_gen' })

// --- FINITION : ampli + COMBO de spam ---
ability('om_evis', 'ombrelame', 1, 'Éviscération', 'om_eviscaration', 'FINITION : débloque Éviscération (finisseur — dégâts × Points de Combo). +16 Agilité.', { requires: ['om_hub'], statMods: { agilite: 16 } })
ks('om_finamp', 'ombrelame', 2, 'Mise à mort', 'Tes sorts [finisseur] infligent +15% (marche aussi pour les finisseurs des autres classes).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['om_evis'] })
ks('om_surin', 'ombrelame', 2, 'Surin mortel', 'Tes finisseurs frappent +25% plus fort.', { stat: { degatsCrit: 20 }, ks: { finisherMult: 0.25 } }, { requires: ['om_evis'] })
ks('om_refund', 'ombrelame', 3, 'Effusion', 'COMBO : un finisseur te REND 2 Points de Combo (spam de finisseurs).', { stat: { hate: 14 }, ks: { comboRefund: 2 } }, { requires: ['om_surin'] })

// --- CONVERGENCE : exige Génération ET Finition ---
ks('om_danse', 'ombrelame', 4, 'Danse de l\'ombre', 'IDENTITÉ (carrefour) : +2 Points de Combo max et +15% de dégâts. Exige Saignée preste ET Surin mortel.', { stat: { critique: 18 }, ks: { comboCap: 2, damageMult: 1.15 } }, { requiresAll: ['om_saig', 'om_surin'], minSpent: 8 })
minor('om_buf_fin', 'ombrelame', 4, 'Maître-lame', 5, { degatsCrit: 8 }, { requires: ['om_surin'] }) // ⛓ TAMPON : max (5 pts) vers l'ultime
ability('om_linceul', 'ombrelame', 5, 'Linceul', 'om_linceul', 'ULTIME — un finisseur dévastateur enveloppe la cible d\'ombre. Gaté : Maître-lame au max + 20 pts dans la voie.', { requires: ['om_danse'], requiresRank: { id: 'om_buf_fin', rank: 5 }, minSpent: 20 })

// --- FURTIVITÉ (SURVIE = esquive) + CHOIX EXCLUSIF d'ouverture ---
minor('om_cele', 'ombrelame', 1, 'Célérité', 5, { esquive: 12, hate: 6 }, { requires: ['om_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ability('om_voile', 'ombrelame', 2, 'Voile d\'ombre', 'posture_defensive', 'SURVIE : débloque Voile d\'ombre (passif : -18% de dégâts subis).', { requires: ['om_cele'] })
ks('om_derob', 'ombrelame', 2, 'Dérobade', 'Tu frappes depuis l\'ombre : +12% de dégâts, +30 Esquive. Exige Célérité au rang max (5).', { stat: { esquive: 30 }, ks: { damageMult: 1.12 } }, { requires: ['om_cele'], requiresRank: { id: 'om_cele', rank: 5 } })
ability('om_embus', 'ombrelame', 3, 'Embuscade', 'om_embuscade', 'CHOIX de SORT : énorme nuke d\'ouverture mono. Gaté : 8 pts dans la voie.', { requires: ['om_derob'], exclusive: 'om_arme2', minSpent: 8 })
ability('om_eventail', 'ombrelame', 3, 'Éventail de couteaux', 'om_eventail', 'CHOIX de SORT : finisseur de ZONE. Gaté : 8 pts dans la voie.', { requires: ['om_derob'], exclusive: 'om_arme2', minSpent: 8 })

// --- LAMES (multifrappe) ---
minor('om_lame', 'ombrelame', 1, 'Fil du rasoir', 3, { critique: 16 }, { requires: ['om_hub'] })
ks('om_jum', 'ombrelame', 2, 'Lames jumelles', 'LAMES : +18% de chance de Multifrappe.', { ks: { multistrike: 0.18 } }, { requires: ['om_lame'] })
ks('om_fren', 'ombrelame', 3, 'Frénésie', 'CHOIX : +26 Hâte.', { stat: { hate: 26 } }, { requires: ['om_jum'], exclusive: 'om_lames' })
ks('om_precis', 'ombrelame', 3, 'Précision létale', 'CHOIX : +24 Critique, +24 Dégâts crit.', { stat: { critique: 24, degatsCrit: 24 } }, { requires: ['om_jum'], exclusive: 'om_lames' })

/* ================================================================== */
/* MAGE (Tissu) — Pyromancien · Cryomancien · Arcaniste.               */
/* ================================================================== */
node('cl_mage', 'mage', 'ability', 0, 1, 'Mage', 'Maître des éléments et de l\'arcane. Débloque Trait magique et ouvre ses trois archétypes. +30 Intelligence.',
  { requires: ['cat_tissu'], statMods: { intelligence: 30 }, unlockPower: 'ma_eclair' })

/* ---- PYROMANCIEN — HOT STREAK : tes sorts de feu chargent la Chaleur (vite si Critique) ; à plein,
 *   ton prochain gros sort de feu est SURPUISSANT. EASY : les crits embrasent. HARD : enchaîner les
 *   fenêtres Hot Streak (timer Pyroblast à pleine Chaleur). Branches ASYMÉTRIQUES (longue signature). */
ability('py_hub', 'pyromancien', 0, 'Pyromancien', 'py_boule', 'Entre dans la voie du Pyromancien : débloque Boule de feu. +18 Intelligence, +12 Critique.', { requires: ['cl_mage'], statMods: { intelligence: 18, critique: 12 } })
// ── LONGUE branche SIGNATURE : Embrasement → Hot Streak → Pyroblast → Combustion → Météore.
minor('py_chaleur', 'pyromancien', 1, 'Chaleur ardente', 3, { critique: 18 }, { requires: ['py_hub'] })
ks('py_embrase', 'pyromancien', 2, 'Embrasement', 'EASY : tes coups CRITIQUES posent un Embrasement (DoT feu = 30% du coup/s, 6 s). Amplifié par l\'Altération.', { stat: { alteration: 14 }, ks: { igniteOnCrit: { frac: 0.3, duration: 6 } } }, { requires: ['py_chaleur'] })
ks('py_fournaise', 'pyromancien', 3, 'Fournaise', 'CHOIX : Embrasement plus intense (+0,25 de frac par crit).', { stat: { alteration: 12 }, ks: { igniteOnCrit: { frac: 0.25, duration: 0 } } }, { requires: ['py_embrase'], exclusive: 'py_ignite' })
ks('py_etincelles', 'pyromancien', 3, 'Pluie d\'étincelles', 'CHOIX : tes sorts [dot] +12% (cross-classe).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'dot', damageMult: 1.12 } } }, { requires: ['py_embrase'], exclusive: 'py_ignite' })
ks('py_hotstreak', 'pyromancien', 4, 'Hot Streak', 'SIGNATURE : tes sorts [feu] chargent la Chaleur (plus vite avec le Critique) ; à PLEIN, ton prochain sort [feu][direct] inflige ×2,2 puis remet la Chaleur à 0. Exige Chaleur ardente au rang max.', { stat: { critique: 16 }, ks: { hotStreak: { cap: 3, mult: 2.2 } } }, { requires: ['py_embrase'], requiresRank: { id: 'py_chaleur', rank: 3 } })
minor('py_buf_feu', 'pyromancien', 4, 'Combustible', 5, { critique: 8 }, { requires: ['py_hotstreak'] }) // ⛓ TAMPON : max (5 pts) vers Pyroblast
ability('py_pyroblast', 'pyromancien', 5, 'Pyroblast', 'py_pyroblast', 'Débloque Pyroblast : une frappe de feu COLOSSALE (LE sort à lâcher à pleine Chaleur). Gaté : Combustible au max + 10 pts dans la voie.', { requires: ['py_buf_feu'], requiresRank: { id: 'py_buf_feu', rank: 5 }, minSpent: 10 })
ks('py_combustion', 'pyromancien', 6, 'Combustion', 'PIC : la Chaleur se déclenche dès 2 et frappe ×2,6, ET tes sorts [feu] +18%. Profond : 14 pts dans la voie.', { stat: { degatsCrit: 18 }, ks: { hotStreak: { cap: 2, mult: 2.6 }, tagBonus: { tag: 'feu', damageMult: 1.18 } } }, { requires: ['py_pyroblast'], minSpent: 14 })
ability('py_meteore', 'pyromancien', 7, 'Météore', 'py_meteore', 'ULTIME — un météore pulvérise tout le pack. Tout au fond : 20 pts dans la voie.', { requires: ['py_combustion'], minSpent: 20 })
// ── MÉDIUM : feu direct + choix de 2e sort.
minor('py_braise', 'pyromancien', 1, 'Braises', 3, { degatsCrit: 18 }, { requires: ['py_hub'] })
ks('py_pyromanie', 'pyromancien', 2, 'Pyromanie', 'Tes sorts [direct] +12% (cross-classe).', { stat: { critique: 14 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['py_braise'] })
minor('py_buf_dir', 'pyromancien', 3, 'Incandescence', 5, { degatsCrit: 8 }, { requires: ['py_pyromanie'] }) // ⛓ TAMPON : max (5 pts) pour le 2e sort
ability('py_flammes', 'pyromancien', 4, 'Flammes incandescentes', 'py_flammes', 'CHOIX de SORT : un torrent de flammes sur tout le pack. Gaté : Incandescence au max + 8 pts.', { requires: ['py_buf_dir'], requiresRank: { id: 'py_buf_dir', rank: 5 }, exclusive: 'py_arme2', minSpent: 8 })
ability('py_immolation', 'pyromancien', 4, 'Immolation', 'py_immolation', 'CHOIX de SORT : embrase la cible (gros DoT mono soutenu). Gaté : Incandescence au max + 8 pts.', { requires: ['py_buf_dir'], requiresRank: { id: 'py_buf_dir', rank: 5 }, exclusive: 'py_arme2', minSpent: 8 })
// ── COURTE : survie.
minor('py_robe', 'pyromancien', 1, 'Robe ignifugée', 5, { regen: 12 }, { requires: ['py_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ability('py_souffle', 'pyromancien', 2, 'Second souffle', 'second_souffle', 'SURVIE : débloque Second souffle (auto-soin) pour tenir en solo.', { requires: ['py_robe'] })
ks('py_bouclierflam', 'pyromancien', 2, 'Bouclier de flammes', 'SURVIE : -8% de dégâts subis, +20 Régén, tes assaillants se brûlent (épines 10%). Exige Robe ignifugée au rang max (5).', { stat: { regen: 20 }, ks: { flatDr: 0.08, thorns: 0.1 } }, { requires: ['py_robe'], requiresRank: { id: 'py_robe', rank: 5 } })

/* ---- CRYOMANCIEN — GÈLE puis FRACASSE : contre une cible gelée, tes sorts gagnent un bonus de Fracas
 *   qui ESCALADE (Fracas → Glaciation → Abîme). EASY : geler + frapper. HARD : maintenir le gel et
 *   lâcher la Comète sur cible gelée au bon moment. Branches ASYMÉTRIQUES (longue signature). */
ability('cr_hub', 'cryomancien', 0, 'Cryomancien', 'cr_eclat', 'Entre dans la voie du Cryomancien : débloque Éclat de givre. +18 Intelligence, +12 Critique.', { requires: ['cl_mage'], statMods: { intelligence: 18, critique: 12 } })
// ── LONGUE branche SIGNATURE : Cône (gel) → Fracas → Glaciation → Comète → Abîme → Hiver.
minor('cr_froidure', 'cryomancien', 1, 'Froidure', 5, { intelligence: 12 }, { requires: ['cr_hub'] }) // ⛓ TAMPON signature (maxRank 5)
ability('cr_cone', 'cryomancien', 2, 'Cône de givre', 'cr_cone', 'EASY : débloque Cône de givre — GÈLE tout le pack (contrôle), la mise en place du fracas.', { requires: ['cr_froidure'] })
ks('cr_fracas', 'cryomancien', 3, 'Fracas', 'SHATTER : tes sorts infligent +20% contre une cible GELÉE/contrôlée.', { stat: { degatsCrit: 16 }, ks: { shatter: 0.2 } }, { requires: ['cr_cone'] })
ks('cr_glaciation', 'cryomancien', 4, 'Glaciation', 'SHATTER +25% de plus contre les gelés. Exige Froidure au rang max (5).', { stat: { degatsCrit: 18 }, ks: { shatter: 0.25 } }, { requires: ['cr_fracas'], requiresRank: { id: 'cr_froidure', rank: 5 } })
ability('cr_comete', 'cryomancien', 5, 'Comète de glace', 'cr_comete', 'Débloque Comète de glace : frappe COLOSSALE, dévastatrice sur cible gelée (le coup du fracas). Gaté : 10 pts dans la voie.', { requires: ['cr_glaciation'], minSpent: 10 })
ks('cr_abime', 'cryomancien', 6, 'Abîme glaciaire', 'SHATTER ultime : +30% de plus contre les gelés. Profond : 14 pts dans la voie.', { stat: { degatsCrit: 20 }, ks: { shatter: 0.3 } }, { requires: ['cr_comete'], minSpent: 14 })
ability('cr_hiver', 'cryomancien', 7, 'Hiver éternel', 'cr_hiver', 'ULTIME — un blizzard gèle ET pulvérise tout le pack. Tout au fond : 20 pts dans la voie.', { requires: ['cr_abime'], minSpent: 20 })
// ── MÉDIUM : tags froid/direct + choix de 2e contrôle.
minor('cr_gelure', 'cryomancien', 1, 'Gelure', 3, { critique: 18 }, { requires: ['cr_hub'] })
ks('cr_givre', 'cryomancien', 2, 'Maîtrise du givre', 'Tes sorts [froid] +12% (cross-classe).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'froid', damageMult: 1.12 } } }, { requires: ['cr_gelure'] })
ks('cr_perce', 'cryomancien', 3, 'Éclats perçants', 'Tes sorts [direct] +12% (cross-classe).', { stat: { penetration: 16 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['cr_givre'] })
minor('cr_buf_dir', 'cryomancien', 3, 'Glace éternelle', 5, { intelligence: 8 }, { requires: ['cr_perce'] }) // ⛓ TAMPON : max (5 pts) pour le 2e sort
ability('cr_gangue', 'cryomancien', 4, 'Gangue de glace', 'cr_gangue', 'CHOIX de SORT : emprisonne une cible (contrôle mono long) pour la fracasser. Gaté : Glace éternelle au max + 8 pts.', { requires: ['cr_buf_dir'], requiresRank: { id: 'cr_buf_dir', rank: 5 }, exclusive: 'cr_arme2', minSpent: 8 })
ability('cr_nova', 'cryomancien', 4, 'Nova de givre', 'cr_nova', 'CHOIX de SORT : une nova gèle tout le pack autour de toi. Gaté : Glace éternelle au max + 8 pts.', { requires: ['cr_buf_dir'], requiresRank: { id: 'cr_buf_dir', rank: 5 }, exclusive: 'cr_arme2', minSpent: 8 })
// ── COURTE : survie.
minor('cr_carapace', 'cryomancien', 1, 'Carapace de givre', 5, { barriere: 12 }, { requires: ['cr_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ability('cr_barriere', 'cryomancien', 2, 'Barrière de glace', 'bouclier_runique', 'SURVIE : débloque Barrière de glace (bouclier d\'absorption).', { requires: ['cr_carapace'] })
ks('cr_frimas', 'cryomancien', 2, 'Frimas protecteur', 'SURVIE : +30 Esquive, -8% de dégâts subis (le froid ralentit tes assaillants). Exige Carapace de givre au rang max (5).', { stat: { esquive: 30 }, ks: { flatDr: 0.08 } }, { requires: ['cr_carapace'], requiresRank: { id: 'cr_carapace', rank: 5 } })

/* ---- ARCANISTE — SURCHARGE INSTABLE : monte tes Charges ; au PLEIN, tu entres en Surcharge (dégâts de
 *   sorts ↑, recharges ×2) qui CONSOMME tes Charges. EASY : générer. HARD : déclencher la fenêtre quand
 *   tes gros sorts sont prêts et l'exploiter à fond. Branches ASYMÉTRIQUES (signature ramp vs finisseur). */
ability('ar_hub', 'arcaniste', 0, 'Arcaniste', 'ar_trait', 'Entre dans la voie de l\'Arcaniste : débloque Trait des arcanes (générateur de Charges des arcanes). +18 Intelligence, +12 Hâte.', { requires: ['cl_mage'], statMods: { intelligence: 18, hate: 12 } })
// ── LONGUE branche SIGNATURE : génération → Surcharge instable → Singularité.
minor('ar_etude', 'arcaniste', 1, 'Étude arcanique', 5, { hate: 10 }, { requires: ['ar_hub'] }) // ⛓ TAMPON signature (maxRank 5)
ks('ar_affinite', 'arcaniste', 1, 'Affinité arcanique', 'Tes sorts [arcane] +12% (cross-classe).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'arcane', damageMult: 1.12 } } }, { requires: ['ar_etude'] })
ks('ar_flux', 'arcaniste', 2, 'Flux de mana', 'GÉNÉRATION : tes générateurs donnent +1 Charge des arcanes.', { stat: { hate: 16 }, ks: { comboGen: 1 } }, { requires: ['ar_affinite'] })
ks('ar_resonance', 'arcaniste', 3, 'Résonance', 'CHOIX : +2 Charges max (Surcharge plus haute, plus rare).', { stat: { intelligence: 16 }, ks: { comboCap: 2 } }, { requires: ['ar_flux'], exclusive: 'ar_gen' })
ks('ar_cadence', 'arcaniste', 3, 'Cadence arcanique', 'CHOIX : +24 Hâte (Charges plus vite).', { stat: { hate: 24 } }, { requires: ['ar_flux'], exclusive: 'ar_gen' })
ks('ar_overload', 'arcaniste', 4, 'Surcharge instable', 'SIGNATURE : au PLEIN de Charges, tu entres en Surcharge 5 s (dégâts de sorts ×1,4, recharges ×2) — qui CONSOMME tes Charges. Exige Étude arcanique au rang max (5).', { stat: { intelligence: 16 }, ks: { overload: { window: 5, mult: 1.4 } } }, { requires: ['ar_flux'], requiresRank: { id: 'ar_etude', rank: 5 } })
ability('ar_singularite', 'arcaniste', 5, 'Singularité', 'ar_singularite', 'ULTIME — une singularité consume toutes tes Charges en une détonation arcanique. Tout au fond : 20 pts dans la voie.', { requires: ['ar_overload'], minSpent: 20 })
// ── MÉDIUM : dépense (finisseur) + spam + choix de 2e sort.
ability('ar_deflag', 'arcaniste', 1, 'Déflagration des arcanes', 'ar_deflag', 'SURCHARGE : débloque Déflagration (finisseur — dégâts × Charges). +16 Intelligence.', { requires: ['ar_hub'], statMods: { intelligence: 16 } })
ks('ar_finamp', 'arcaniste', 2, 'Maîtrise des surcharges', 'Tes sorts [finisseur] +15% (cross-classe).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['ar_deflag'] })
ks('ar_surcharge', 'arcaniste', 2, 'Trop-plein', 'Tes finisseurs frappent +25% plus fort.', { stat: { degatsCrit: 20 }, ks: { finisherMult: 0.25 } }, { requires: ['ar_deflag'] })
ks('ar_cascade', 'arcaniste', 3, 'Cascade temporelle', 'SPAM : chaque sort lancé rembourse 0,4 s de recharge à tes autres sorts. Profond : 8 pts dans la voie.', { stat: { hate: 14 }, ks: { cdrOnCast: 0.4 } }, { requires: ['ar_surcharge'], minSpent: 8 })
minor('ar_buf_dep', 'arcaniste', 3, 'Érudition', 5, { intelligence: 8 }, { requires: ['ar_surcharge'] }) // ⛓ TAMPON : max (5 pts) pour le 2e sort
ability('ar_orbe', 'arcaniste', 4, 'Orbe des arcanes', 'ar_orbe', 'CHOIX de SORT : un orbe instable balaie le pack (zone). Gaté : Érudition au max + 8 pts.', { requires: ['ar_buf_dep'], requiresRank: { id: 'ar_buf_dep', rank: 5 }, exclusive: 'ar_arme2', minSpent: 8 })
ability('ar_rupture', 'arcaniste', 4, 'Rupture des arcanes', 'ar_rupture', 'CHOIX de SORT : exécution arcane (amplifiée par les PV manquants). Gaté : Érudition au max + 8 pts.', { requires: ['ar_buf_dep'], requiresRank: { id: 'ar_buf_dep', rank: 5 }, exclusive: 'ar_arme2', minSpent: 8 })
// ── CARREFOUR optionnel : exige Génération ET Trop-plein.
ks('ar_apogee', 'arcaniste', 4, 'Apogée arcanique', 'IDENTITÉ (carrefour) : +2 Charges max et +15% de dégâts. Exige Flux de mana ET Trop-plein.', { stat: { intelligence: 18 }, ks: { comboCap: 2, damageMult: 1.15 } }, { requiresAll: ['ar_flux', 'ar_surcharge'], minSpent: 10 })
// SURVIE : voile arcanique.
minor('ar_voile', 'arcaniste', 1, 'Voile arcanique', 5, { barriere: 12 }, { requires: ['ar_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ability('ar_barriere', 'arcaniste', 2, 'Bouclier des arcanes', 'bouclier_runique', 'SURVIE : débloque Bouclier des arcanes (absorption).', { requires: ['ar_voile'] })
ks('ar_clignement', 'arcaniste', 3, 'Clignement', 'SURVIE : +30 Esquive, +18 Récupération (tu te téléportes hors de danger). Exige Voile arcanique au rang max (5).', { stat: { esquive: 30, recuperation: 18 } }, { requires: ['ar_voile'], requiresRank: { id: 'ar_voile', rank: 5 } })

/* ================================================================== */
/* CHASSEUR (Mailles) — Meneur de meute · Œil de faucon.               */
/* ================================================================== */
node('cl_chasseur', 'chasseur', 'ability', 0, 1, 'Chasseur', 'Pisteur des terres sauvages, lié à ses bêtes. Débloque Tir de chasse et ouvre ses deux archétypes. +20 Agilité, +20 Intelligence.',
  { requires: ['cat_mailles'], statMods: { agilite: 20, intelligence: 20 }, unlockPower: 'ch_tir' })

/* ---- MENEUR DE MEUTE — FAMILIER (invocation, DPS passif idle) + frénésie. ---- */
ability('me_hub', 'meute', 0, 'Meneur de meute', 'me_cmd', 'Entre dans la voie du Meneur de meute : débloque Commandement bestial. +18 Agilité, +12 Critique.', { requires: ['cl_chasseur'], statMods: { agilite: 18, critique: 12 } })
// FAMILIER : le pet est le cœur de l'archétype (DPS continu en idle).
minor('me_dressage', 'meute', 1, 'Dressage', 3, { agilite: 16 }, { requires: ['me_hub'] })
ks('me_familier', 'meute', 2, 'Familier', 'INVOCATION : un fauve combat à tes côtés — +30% de ton DPS d\'auto-attaque, en continu (idéal en idle).', { stat: { agilite: 12 }, ks: { petDps: 0.3 } }, { requires: ['me_dressage'] })
minor('me_buf_pet', 'meute', 3, 'Lien sauvage', 5, { agilite: 8 }, { requires: ['me_familier'] }) // ⛓ TAMPON : max (5 pts) pour la meute
ks('me_meute', 'meute', 4, 'Meute', 'INVOCATION : un second fauve te rejoint (+30% de plus). Exige Lien sauvage au rang max (5).', { stat: { agilite: 14 }, ks: { petDps: 0.3 } }, { requires: ['me_buf_pet'], requiresRank: { id: 'me_buf_pet', rank: 5 } })
ks('me_frenesie', 'meute', 4, 'Frénésie de meute', 'CHOIX : la meute enrage — +0,2 DPS de familier ET +12% de tes dégâts.', { stat: { hate: 16 }, ks: { petDps: 0.2, damageMult: 1.12 } }, { requires: ['me_meute'], exclusive: 'me_pet' })
ks('me_alpha', 'meute', 4, 'Instinct alpha', 'CHOIX : +0,35 DPS de familier (meute massive).', { stat: { agilite: 16 }, ks: { petDps: 0.35 } }, { requires: ['me_meute'], exclusive: 'me_pet' })
ability('me_curee', 'meute', 6, 'Curée sauvage', 'me_curee', 'ULTIME — toute la meute déferle sur le pack. Tout au fond : 20 pts dans la voie.', { requires: ['me_meute'], minSpent: 20 })
// TRAQUE : frappes bestiales (tags) + choix de 2e sort.
minor('me_griffes', 'meute', 1, 'Griffes acérées', 3, { critique: 18 }, { requires: ['me_hub'] })
ks('me_nature', 'meute', 2, 'Appel de la nature', 'Tes sorts [nature] +12% (marche aussi pour les autres classes).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'nature', damageMult: 1.12 } } }, { requires: ['me_griffes'] })
ks('me_coordination', 'meute', 3, 'Coordination', 'Tes sorts [direct] +12% (marche aussi pour les autres classes).', { stat: { critique: 14 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['me_nature'] })
minor('me_buf_traque', 'meute', 3, 'Pistage', 5, { critique: 8 }, { requires: ['me_nature'] }) // ⛓ TAMPON : max (5 pts) pour le 2e sort
ability('me_morsure', 'meute', 4, 'Morsure du fauve', 'me_morsure', 'CHOIX de SORT : une morsure dévastatrice mono-cible. Gaté : Pistage au max + 8 pts.', { requires: ['me_buf_traque'], requiresRank: { id: 'me_buf_traque', rank: 5 }, exclusive: 'me_arme2', minSpent: 8 })
ability('me_saignee', 'meute', 4, 'Saignée bestiale', 'me_saignee', 'CHOIX de SORT : des plaies de fauve qui saignent (DoT). Gaté : Pistage au max + 8 pts.', { requires: ['me_buf_traque'], requiresRank: { id: 'me_buf_traque', rank: 5 }, exclusive: 'me_arme2', minSpent: 8 })
// SURVIE : lien au familier.
minor('me_endurci', 'meute', 1, 'Cuir épais', 5, { regen: 12 }, { requires: ['me_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ks('me_symbiose', 'meute', 2, 'Symbiose', 'SURVIE : ton familier te protège — -10% de dégâts subis, +12 Vol de vie. Exige Cuir épais au rang max (5).', { stat: { volDeVie: 12 }, ks: { flatDr: 0.1 } }, { requires: ['me_endurci'], requiresRank: { id: 'me_endurci', rank: 5 } })
ability('me_souffle', 'meute', 2, 'Second souffle', 'second_souffle', 'SURVIE : débloque Second souffle (auto-soin).', { requires: ['me_endurci'] })

/* ---- ŒIL DE FAUCON — « Concentration » : visée (générateur) → tir énorme (finisseur) + exécution. ---- */
ability('fa_hub', 'faucon', 0, 'Œil de faucon', 'fa_visee', 'Entre dans la voie de l\'Œil de faucon : débloque Tir assuré (générateur de Concentration). +18 Agilité, +12 Précision.', { requires: ['cl_chasseur'], statMods: { agilite: 18, precision: 12 } })
// CONCENTRATION (générateur).
minor('fa_calme', 'faucon', 1, 'Sang-froid', 3, { precision: 16 }, { requires: ['fa_hub'] })
ks('fa_directamp', 'faucon', 1, 'Visée précise', 'Tes sorts [direct] +12% (marche aussi pour les autres classes).', { stat: { precision: 12 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['fa_calme'] })
ks('fa_respire', 'faucon', 2, 'Respiration', 'CONCENTRATION : tes générateurs donnent +1 Concentration.', { stat: { critique: 16 }, ks: { comboGen: 1 } }, { requires: ['fa_calme'] })
ks('fa_lynx', 'faucon', 3, 'Œil de lynx', 'CHOIX : +24 Précision, +1 Concentration.', { stat: { precision: 24 }, ks: { comboGen: 1 } }, { requires: ['fa_respire'], exclusive: 'fa_gen' })
ks('fa_rapide', 'faucon', 3, 'Tir rapide', 'CHOIX : +24 Hâte.', { stat: { hate: 24 } }, { requires: ['fa_respire'], exclusive: 'fa_gen' })
// TIR VISÉ (finisher) + exécution.
ability('fa_tir_vise', 'faucon', 1, 'Tir visé', 'fa_tir_vise', 'TIR : débloque Tir visé (finisseur — dégâts × Concentration). +16 Agilité.', { requires: ['fa_hub'], statMods: { agilite: 16 } })
ks('fa_finamp', 'faucon', 2, 'Tir précis', 'Tes sorts [finisseur] +15% (marche aussi pour les autres classes).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['fa_tir_vise'] })
ks('fa_letalite', 'faucon', 2, 'Létalité', 'Tes finisseurs frappent +25% plus fort.', { stat: { degatsCrit: 20 }, ks: { finisherMult: 0.25 } }, { requires: ['fa_tir_vise'] })
ks('fa_mise_a_mort', 'faucon', 3, 'Mise à mort', 'Tes finisseurs exécutent les ennemis sous 20% de PV (×2,2).', { stat: { degatsBoss: 14 }, ks: { executeBonus: { threshold: 0.2, mult: 2.2 } } }, { requires: ['fa_letalite'] })
minor('fa_buf_tir', 'faucon', 4, 'Maîtrise de l\'arc', 5, { precision: 8 }, { requires: ['fa_letalite'] }) // ⛓ TAMPON : max (5 pts) vers l'ultime
// CONVERGENCE + ULTIME.
ks('fa_oeil', 'faucon', 4, 'Œil du faucon', 'IDENTITÉ (carrefour) : +2 Concentration max et +15% de dégâts. Exige Respiration ET Létalité.', { stat: { precision: 18 }, ks: { comboCap: 2, damageMult: 1.15 } }, { requiresAll: ['fa_respire', 'fa_letalite'], minSpent: 8 })
ability('fa_aigle', 'faucon', 5, 'Tir de l\'aigle', 'fa_aigle', 'ULTIME — un tir parfait qui consume toute ta Concentration. Gaté : Maîtrise de l\'arc au max + 20 pts dans la voie.', { requires: ['fa_oeil'], requiresRank: { id: 'fa_buf_tir', rank: 5 }, minSpent: 20 })
// 2e SORT : choix exclusif (AoE vs exécution).
minor('fa_pisteur', 'faucon', 1, 'Pisteur', 3, { critique: 18 }, { requires: ['fa_hub'] })
ks('fa_precis', 'faucon', 2, 'Précision létale', '+24 Critique, +24 Dégâts crit.', { stat: { critique: 24, degatsCrit: 24 } }, { requires: ['fa_pisteur'] })
minor('fa_buf_chasse', 'faucon', 3, 'Affût', 5, { critique: 8 }, { requires: ['fa_pisteur'] }) // ⛓ TAMPON : max (5 pts) pour le 2e sort
ability('fa_salve', 'faucon', 4, 'Salve de flèches', 'fa_salve', 'CHOIX de SORT : une volée qui balaie le pack (zone). Gaté : Affût au max + 8 pts.', { requires: ['fa_buf_chasse'], requiresRank: { id: 'fa_buf_chasse', rank: 5 }, exclusive: 'fa_arme2', minSpent: 8 })
ability('fa_mortel', 'faucon', 4, 'Tir mortel', 'fa_mortel', 'CHOIX de SORT : exécution mono (amplifiée par les PV manquants). Gaté : Affût au max + 8 pts.', { requires: ['fa_buf_chasse'], requiresRank: { id: 'fa_buf_chasse', rank: 5 }, exclusive: 'fa_arme2', minSpent: 8 })
// SURVIE : camouflage.
minor('fa_camo', 'faucon', 1, 'Camouflage', 5, { esquive: 12 }, { requires: ['fa_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ability('fa_posture', 'faucon', 2, 'Posture défensive', 'posture_defensive', 'SURVIE : débloque Posture défensive (-18% de dégâts subis).', { requires: ['fa_camo'] })
ks('fa_retraite', 'faucon', 2, 'Retraite feinte', 'SURVIE : +30 Esquive, +12% de dégâts (tu frappes en reculant). Exige Camouflage au rang max (5).', { stat: { esquive: 30 }, ks: { damageMult: 1.12 } }, { requires: ['fa_camo'], requiresRank: { id: 'fa_camo', rank: 5 } })

/* ================================================================== */
/* GUERRIER (Plaque) — Sentence (DPS) · Rempart (TANK, ressource Rage). */
/* ================================================================== */
node('cl_guerrier', 'guerrier', 'ability', 0, 1, 'Guerrier', 'Maître d\'armes nourri par la Rage du combat. Débloque Frappe d\'arme et ouvre ses deux archétypes. +25 Force.',
  { requires: ['cat_plaque'], statMods: { force: 25 }, unlockPower: 'gu_frappe' })

/* ---- SENTENCE — Rage (build/spend) → exécution + saignements. ---- */
ability('se_hub', 'sentence', 0, 'Sentence', 'se_mutile', 'Entre dans la voie de la Sentence : débloque Coup mutilant (générateur de Rage). +18 Force, +12 Critique.', { requires: ['cl_guerrier'], statMods: { force: 18, critique: 12 } })
// GÉNÉRATION (Rage).
minor('se_furie', 'sentence', 1, 'Furie', 3, { force: 16 }, { requires: ['se_hub'] })
ks('se_directamp', 'sentence', 1, 'Brutalité', 'Tes sorts [direct] +12% (marche aussi pour les autres classes).', { stat: { critique: 14 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['se_furie'] })
ks('se_colere', 'sentence', 2, 'Colère bouillonnante', 'GÉNÉRATION : tes générateurs donnent +1 Rage.', { stat: { hate: 16 }, ks: { comboGen: 1 } }, { requires: ['se_furie'] })
ks('se_brutal', 'sentence', 3, 'Sang versé', 'CHOIX : +2 Rage max (frappes plus lourdes).', { stat: { force: 16 }, ks: { comboCap: 2 } }, { requires: ['se_colere'], exclusive: 'se_gen' })
ks('se_rapide', 'sentence', 3, 'Empressement', 'CHOIX : +24 Hâte (Rage qui monte vite).', { stat: { hate: 24 } }, { requires: ['se_colere'], exclusive: 'se_gen' })
// FINITION (Rage spend) + exécution.
ability('se_fin', 'sentence', 1, 'Sentence', 'se_sentence', 'FINITION : débloque Sentence (finisseur — dégâts × Rage). +16 Force.', { requires: ['se_hub'], statMods: { force: 16 } })
ks('se_finamp', 'sentence', 2, 'Mise à mort', 'Tes sorts [finisseur] +15% (marche aussi pour les autres classes).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['se_fin'] })
ks('se_mortel', 'sentence', 2, 'Coups mortels', 'Tes finisseurs frappent +25% plus fort.', { stat: { degatsCrit: 20 }, ks: { finisherMult: 0.25 } }, { requires: ['se_fin'] })
ks('se_execute', 'sentence', 3, 'Exécution', 'Tes finisseurs exécutent les ennemis sous 20% de PV (×2,2).', { stat: { degatsBoss: 14 }, ks: { executeBonus: { threshold: 0.2, mult: 2.2 } } }, { requires: ['se_mortel'] })
// CONVERGENCE + ULTIME.
ks('se_rage', 'sentence', 4, 'Soif de sang', 'IDENTITÉ (carrefour) : +2 Rage max et +15% de dégâts. Exige Colère bouillonnante ET Coups mortels.', { stat: { force: 18 }, ks: { comboCap: 2, damageMult: 1.15 } }, { requiresAll: ['se_colere', 'se_mortel'], minSpent: 8 })
minor('se_buf_rage', 'sentence', 4, 'Maîtrise martiale', 5, { force: 8 }, { requires: ['se_rage'] }) // ⛓ TAMPON : max (5 pts) vers l'ultime
ability('se_carnage', 'sentence', 5, 'Carnage', 'se_carnage', 'ULTIME — un finisseur dévastateur qui décime. Gaté : Maîtrise martiale au max + 20 pts dans la voie.', { requires: ['se_buf_rage'], requiresRank: { id: 'se_buf_rage', rank: 5 }, minSpent: 20 })
// SAIGNEMENT : DoT + choix de 2e sort.
minor('se_lame', 'sentence', 1, 'Lames affûtées', 3, { alteration: 16 }, { requires: ['se_hub'] })
ks('se_hemo', 'sentence', 2, 'Hémorragie', 'Tes coups ouvrent une plaie (DoT physique, 20% du coup/s, 5 s).', { stat: { alteration: 12 }, ks: { dot: { frac: 0.2, duration: 5 } } }, { requires: ['se_lame'] })
minor('se_buf_saign', 'sentence', 3, 'Plaies ouvertes', 5, { alteration: 8 }, { requires: ['se_hemo'] }) // ⛓ TAMPON : max (5 pts) pour le 2e sort
ability('se_saignement', 'sentence', 4, 'Saignement profond', 'se_saignement', 'CHOIX de SORT : ouvre une plaie béante (gros DoT mono). Gaté : Plaies ouvertes au max + 8 pts.', { requires: ['se_buf_saign'], requiresRank: { id: 'se_buf_saign', rank: 5 }, exclusive: 'se_arme2', minSpent: 8 })
ability('se_tourmente', 'sentence', 4, 'Tourmente', 'se_tourmente', 'CHOIX de SORT : balaie tout le pack (zone). Gaté : Plaies ouvertes au max + 8 pts.', { requires: ['se_buf_saign'], requiresRank: { id: 'se_buf_saign', rank: 5 }, exclusive: 'se_arme2', minSpent: 8 })
// SURVIE : garde du combattant.
minor('se_garde', 'sentence', 1, 'Garde haute', 5, { reductionDegats: 10 }, { requires: ['se_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ks('se_resilience', 'sentence', 2, 'Résilience', 'SURVIE : -10% de dégâts subis, +12 Vol de vie. Exige Garde haute au rang max (5).', { stat: { volDeVie: 12 }, ks: { flatDr: 0.1 } }, { requires: ['se_garde'], requiresRank: { id: 'se_garde', rank: 5 } })
ability('se_souffle', 'sentence', 2, 'Second souffle', 'second_souffle', 'SURVIE : débloque Second souffle (auto-soin).', { requires: ['se_garde'] })

/* ---- REMPART (TANK) — Rage → BOUCLIER (finisherShield) + épines + provocation. ---- */
ability('re_hub', 'rempart', 0, 'Rempart', 're_bouclier_coup', 'Entre dans la voie du Rempart : débloque Coup de bouclier (générateur de Rage). +18 Force, +40 Endurance.', { requires: ['cl_guerrier'], statMods: { force: 18, endurance: 40 } })
// BOUCLIER : la Rage devient de l'absorption.
minor('re_garde', 'rempart', 1, 'Bloc', 5, { endurance: 14 }, { requires: ['re_hub'] }) // ⛓ TAMPON bouclier (maxRank 5)
ability('re_revanche', 'rempart', 1, 'Revanche', 're_revanche', 'FINITION : débloque Revanche (finisseur — dégâts × Rage). +16 Force.', { requires: ['re_hub'], statMods: { force: 16 } })
ks('re_bloc', 'rempart', 2, 'Mur de boucliers', 'TANK (cooldown 30 s) : un finisseur t\'accorde un bouclier = 35% de ses dégâts — borné à 50% de tes PV max, total ≤ tes PV max. UNE fois toutes les 30 s (vraie capacité défensive, pas un bouclier permanent). Exige Bloc au rang max.', { stat: { endurance: 30 }, ks: { finisherShield: 0.35 } }, { requires: ['re_revanche'], requiresRank: { id: 're_garde', rank: 5 } })
ks('re_mur', 'rempart', 3, 'Inébranlable', 'TANK : +0,15 au bouclier de Mur de boucliers ET tes finisseurs +20%.', { stat: { barriere: 20 }, ks: { finisherShield: 0.15, finisherMult: 0.2 } }, { requires: ['re_bloc'], minSpent: 8 })
minor('re_buf_mur', 'rempart', 4, 'Garde de fer', 5, { endurance: 14 }, { requires: ['re_mur'] }) // ⛓ TAMPON : max (5 pts) vers l'ultime
ability('re_egide', 'rempart', 5, 'Égide titanesque', 'egide_titanesque', 'ULTIME — un ÉNORME bouclier d\'absorption (40% à l\'équipe). Gaté : Garde de fer au max + 20 pts dans la voie.', { requires: ['re_buf_mur'], requiresRank: { id: 're_buf_mur', rank: 5 }, minSpent: 20 })
// ÉPINES + PROVOCATION : menace & représailles.
minor('re_acier', 'rempart', 1, 'Peau d\'acier', 5, { reductionDegats: 10 }, { requires: ['re_hub'] }) // ⛓ TAMPON épines (maxRank 5)
ability('re_provoc', 'rempart', 2, 'Provocation', 'provocation', 'MENACE : débloque Provocation (attire les attaques — le rôle de tank).', { requires: ['re_acier'] })
ks('re_epines', 'rempart', 2, 'Épines', 'Tes assaillants encaissent 30% de tes dégâts d\'auto en retour. Exige Peau d\'acier au rang max.', { stat: { endurance: 20 }, ks: { thorns: 0.3 } }, { requires: ['re_acier'], requiresRank: { id: 're_acier', rank: 5 } })
ks('re_represailles', 'rempart', 3, 'Représailles', '+40% d\'épines de plus (le reflet devient une vraie source de dégâts). Profond : 8 pts dans la voie.', { stat: { reductionDegats: 14 }, ks: { thorns: 0.4 } }, { requires: ['re_epines'], minSpent: 8 })
// RÉSISTANCE : colosse.
minor('re_endurci', 'rempart', 1, 'Endurci', 5, { endurance: 14 }, { requires: ['re_hub'] }) // ⛓ TAMPON résistance (maxRank 5)
ks('re_inebranlable', 'rempart', 2, 'Forteresse', 'SURVIE : -12% de dégâts subis. Exige Endurci au rang max (5).', { stat: { endurance: 20 }, ks: { flatDr: 0.12 } }, { requires: ['re_endurci'], requiresRank: { id: 're_endurci', rank: 5 } })
ability('re_bouclier', 'rempart', 2, 'Bouclier runique', 'bouclier_runique', 'SURVIE : débloque Bouclier runique (absorption à la demande).', { requires: ['re_endurci'] })
ks('re_colosse', 'rempart', 3, 'Colosse', 'À plus de 60% de PV, +20% de dégâts (un mur qui frappe). Profond : 10 pts dans la voie.', { stat: { force: 16 }, ks: { highHpBonus: { threshold: 0.6, mult: 1.2 } } }, { requires: ['re_inebranlable'], minSpent: 10 })

/* ================================================================== */
/* PRÊTRE (Tissu) — Lumière (HEAL) · Vide (DPS).                        */
/* ================================================================== */
node('cl_pretre', 'pretre', 'ability', 0, 1, 'Prêtre', 'Canal du sacré et de l\'ombre. Débloque Châtiment et ouvre ses deux archétypes. +30 Intelligence.',
  { requires: ['cat_tissu'], statMods: { intelligence: 30 }, unlockPower: 'pr_chatiment' })

/* ---- LUMIÈRE (HEAL) — soin + châtiment (healToDamage : soigne en frappant) + boucliers. ---- */
ability('lu_hub', 'lumiere', 0, 'Lumière', 'lu_soin', 'Entre dans la voie de la Lumière : débloque Mot de lumière (soin). +18 Intelligence.', { requires: ['cl_pretre'], statMods: { intelligence: 18 } })
// SOIN : kit de soin pur.
minor('lu_foi', 'lumiere', 1, 'Foi', 5, { regen: 10 }, { requires: ['lu_hub'] }) // ⛓ TAMPON soin (maxRank 5)
ability('lu_renouveau', 'lumiere', 2, 'Renouveau', 'lu_renouveau', 'SOIN : débloque Renouveau (soin sur la durée).', { requires: ['lu_foi'] })
ks('lu_hot', 'lumiere', 2, 'Grâce persistante', 'SOIN : un soin sur la durée constant sur l\'allié blessé (+régén d\'équipe).', { stat: { regen: 20 }, ks: { hot: 0.5 } }, { requires: ['lu_foi'] })
ability('lu_benediction', 'lumiere', 3, 'Bénédiction', 'lu_benediction', 'Débloque Bénédiction (soin de tout le groupe). Gatée : Foi au max + 6 pts dans la voie.', { requires: ['lu_foi'], requiresRank: { id: 'lu_foi', rank: 5 }, minSpent: 6 })
// ATONEMENT : healToDamage (tes soins frappent aussi).
minor('lu_zele', 'lumiere', 1, 'Zèle', 5, { critique: 10 }, { requires: ['lu_hub'] }) // ⛓ TAMPON atonement (maxRank 5)
ks('lu_chatiment', 'lumiere', 2, 'Châtiment', 'ATONEMENT : 40% de tes soins frappent AUSSI l\'ennemi (tu soignes en châtiant — solo viable). Exige Zèle au rang max (5).', { stat: { intelligence: 12 }, ks: { healToDamage: 0.4 } }, { requires: ['lu_zele'], requiresRank: { id: 'lu_zele', rank: 5 } })
ks('lu_devotion', 'lumiere', 3, 'Dévotion', 'CHOIX : soins renforcés (+régén, +soin sur la durée).', { stat: { regen: 24 }, ks: { hot: 0.5 } }, { requires: ['lu_chatiment'], exclusive: 'lu_voie' })
ks('lu_inquisition', 'lumiere', 3, 'Inquisition', 'CHOIX : +40% de châtiment (tes soins frappent bien plus fort).', { stat: { intelligence: 14 }, ks: { healToDamage: 0.4 } }, { requires: ['lu_chatiment'], exclusive: 'lu_voie' })
ks('lu_ferveur', 'lumiere', 4, 'Ferveur', 'Tes sorts [soin] +15% et +12% de dégâts. Profond : 8 pts dans la voie.', { stat: { intelligence: 16 }, ks: { tagBonus: { tag: 'soin', damageMult: 1.15 }, damageMult: 1.12 } }, { requires: ['lu_chatiment'], minSpent: 8 })
minor('lu_buf_aube', 'lumiere', 4, 'Sacerdoce', 5, { intelligence: 8 }, { requires: ['lu_ferveur'] }) // ⛓ TAMPON : max (5 pts) vers l'ultime
ability('lu_aube', 'lumiere', 5, 'Aube salvatrice', 'lu_aube', 'ULTIME — une vague de lumière qui restaure ÉNORMÉMENT tout le groupe. Gaté : Sacerdoce au max + 20 pts dans la voie.', { requires: ['lu_buf_aube'], requiresRank: { id: 'lu_buf_aube', rank: 5 }, minSpent: 20 })
// SURVIE : grâce protectrice.
minor('lu_grace', 'lumiere', 1, 'Grâce', 5, { barriere: 12 }, { requires: ['lu_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ability('lu_bouclier', 'lumiere', 2, 'Bouclier sacré', 'bouclier_runique', 'SURVIE : débloque Bouclier sacré (absorption).', { requires: ['lu_grace'] })
ks('lu_protection', 'lumiere', 2, 'Protection divine', 'SURVIE : -10% de dégâts subis, +20 Régén. Exige Grâce au rang max (5).', { stat: { regen: 20 }, ks: { flatDr: 0.1 } }, { requires: ['lu_grace'], requiresRank: { id: 'lu_grace', rank: 5 } })

/* ---- VIDE (DPS) — DoT d'ombre + Forme du Vide (frenzy = Folie) + drain. ---- */
ability('vi_hub', 'vide', 0, 'Vide', 'vi_mot_ombre', 'Entre dans la voie du Vide : débloque Mot de l\'ombre (DoT d\'ombre). +18 Intelligence, +12 Altération.', { requires: ['cl_pretre'], statMods: { intelligence: 18, alteration: 12 } })
// AFFLICTION : DoT ombre (tags).
minor('vi_tenebres', 'vide', 1, 'Ténèbres', 3, { alteration: 18 }, { requires: ['vi_hub'] })
ks('vi_dotamp', 'vide', 1, 'Affliction', 'Tes sorts [dot] +12% (marche aussi pour les autres classes).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'dot', damageMult: 1.12 } } }, { requires: ['vi_tenebres'] })
ks('vi_ombre', 'vide', 2, 'Maîtrise de l\'ombre', 'Tes sorts [ombre] +12% (marche aussi pour les autres classes).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'ombre', damageMult: 1.12 } } }, { requires: ['vi_dotamp'] })
ability('vi_douleur', 'vide', 2, 'Douleur', 'vi_douleur', 'Débloque Douleur (frappe d\'ombre directe).', { requires: ['vi_hub'] })
// FOLIE : Forme du Vide (frenzy) + choix de 2e sort.
minor('vi_demence', 'vide', 1, 'Démence', 5, { degatsCrit: 10 }, { requires: ['vi_hub'] }) // ⛓ TAMPON signature (maxRank 5)
ability('vi_forme', 'vide', 2, 'Forme du Vide', 'vi_forme', 'FOLIE : débloque Forme du Vide (+60% de dégâts, 8 s — la fenêtre de Folie). Gatée : Démence au max + 6 pts dans la voie.', { requires: ['vi_demence'], requiresRank: { id: 'vi_demence', rank: 5 }, minSpent: 6 })
ks('vi_insanite', 'vide', 3, 'Insanité', 'PIC : +15% de dégâts permanent. Profond : 10 pts dans la voie.', { stat: { degatsCrit: 18 }, ks: { damageMult: 1.15 } }, { requires: ['vi_forme'], minSpent: 10 })
ability('vi_devorer', 'vide', 3, 'Dévorer l\'esprit', 'vi_devorer', 'CHOIX de SORT : exécution d\'ombre (amplifiée par les PV manquants). Gaté : 8 pts dans la voie.', { requires: ['vi_forme'], exclusive: 'vi_arme2', minSpent: 8 })
ability('vi_tourment', 'vide', 3, 'Tourment', 'vi_tourment', 'CHOIX de SORT : un tourment d\'ombre balaie le pack (zone). Gaté : 8 pts dans la voie.', { requires: ['vi_forme'], exclusive: 'vi_arme2', minSpent: 8 })
minor('vi_buf_folie', 'vide', 4, 'Murmures du Vide', 5, { degatsCrit: 8 }, { requires: ['vi_insanite'] }) // ⛓ TAMPON : max (5 pts) vers l'ultime
ability('vi_folie', 'vide', 5, 'Folie dévorante', 'vi_folie', 'ULTIME — un cataclysme d\'ombre engloutit tout le pack. Gaté : Murmures du Vide au max + 20 pts dans la voie.', { requires: ['vi_buf_folie'], requiresRank: { id: 'vi_buf_folie', rank: 5 }, minSpent: 20 })
// DRAIN : survie via les DoT.
minor('vi_soif', 'vide', 1, 'Soif d\'âmes', 5, { volDeVie: 8 }, { requires: ['vi_hub'] }) // ⛓ TAMPON survie (maxRank 5)
ks('vi_drain', 'vide', 2, 'Drain d\'ombre', 'SURVIE : tes DoT te soignent (25% du tick), +20 Régén. Exige Soif d\'âmes au rang max (5).', { stat: { regen: 20 }, ks: { dotLeech: 0.25 } }, { requires: ['vi_soif'], requiresRank: { id: 'vi_soif', rank: 5 } })
ks('vi_meta', 'vide', 3, 'Communion morbide', 'SURVIE : -8% de dégâts subis, +12 Vol de vie. Profond : 8 pts dans la voie.', { stat: { volDeVie: 12 }, ks: { flatDr: 0.08 } }, { requires: ['vi_drain'], minSpent: 8 })

/* ================================================================== */
/* CHEVALIER DE LA MORT (Plaque) — Givre-mort (DPS) · Sang (TANK).     */
/* ================================================================== */
node('cl_dk', 'dk', 'ability', 0, 1, 'Chevalier de la mort', 'Champion mort-vivant nourri par la Puissance runique. Débloque Frappe runique. +25 Force.', { requires: ['cat_plaque'], statMods: { force: 25 }, unlockPower: 'dk_frappe' })
/* ---- GIVRE-MORT — contrôle de mêlée → FRACAS runique + exécution. ---- */
ability('gm_hub', 'givremort', 0, 'Givre-mort', 'gm_givre', 'Débloque Lame de givre (générateur de Puissance runique). +18 Force, +12 Critique.', { requires: ['cl_dk'], statMods: { force: 18, critique: 12 } })
ability('gm_obli', 'givremort', 1, 'Oblitération', 'gm_obliteration', 'FINITION : débloque Oblitération (finisseur froid × Puissance runique). +16 Force.', { requires: ['gm_hub'], statMods: { force: 16 } })
ks('gm_finamp', 'givremort', 2, 'Lames affamées', 'Tes sorts [finisseur] +15% (cross-classe).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['gm_obli'] })
ks('gm_execute', 'givremort', 2, 'Exécution glaciale', 'Tes finisseurs exécutent les ennemis sous 20% de PV (×2,2).', { stat: { degatsBoss: 14 }, ks: { executeBonus: { threshold: 0.2, mult: 2.2 } } }, { requires: ['gm_obli'] })
minor('gm_buf1', 'givremort', 3, 'Maîtrise runique', 5, { force: 8 }, { requires: ['gm_obli'] })
ks('gm_fracas', 'givremort', 4, 'Fracas runique', 'SHATTER : tes sorts +35% contre une cible GELÉE/contrôlée. Exige Maîtrise runique au max (5).', { stat: { degatsCrit: 18 }, ks: { shatter: 0.35 } }, { requires: ['gm_buf1'], requiresRank: { id: 'gm_buf1', rank: 5 } })
ability('gm_apoc', 'givremort', 5, 'Apocalypse', 'gm_apocalypse', 'ULTIME — un cataclysme de givre pulvérise le pack. Tout au fond : 20 pts dans la voie.', { requires: ['gm_fracas'], minSpent: 20 })
minor('gm_glace', 'givremort', 1, 'Givre mordant', 3, { critique: 18 }, { requires: ['gm_hub'] })
ks('gm_froid', 'givremort', 2, 'Maîtrise du givre', 'Tes sorts [froid] +12% (cross-classe).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'froid', damageMult: 1.12 } } }, { requires: ['gm_glace'] })
minor('gm_buf2', 'givremort', 3, 'Aura de givre', 5, { critique: 8 }, { requires: ['gm_froid'] })
ability('gm_souffle', 'givremort', 4, 'Souffle givrant', 'gm_souffle', 'CHOIX de SORT : GÈLE le pack (le contrôle du fracas). Exige Aura de givre au max + 8 pts.', { requires: ['gm_buf2'], requiresRank: { id: 'gm_buf2', rank: 5 }, exclusive: 'gm_arme2', minSpent: 8 })
ability('gm_pilier', 'givremort', 4, 'Pilier de glace', 'gm_pilier', 'CHOIX de SORT : gros nuke froid mono. Exige Aura de givre au max + 8 pts.', { requires: ['gm_buf2'], requiresRank: { id: 'gm_buf2', rank: 5 }, exclusive: 'gm_arme2', minSpent: 8 })
minor('gm_buf3', 'givremort', 1, 'Carcasse', 5, { endurance: 12 }, { requires: ['gm_hub'] })
ability('gm_souffle_s', 'givremort', 2, 'Second souffle', 'second_souffle', 'SURVIE : auto-soin.', { requires: ['gm_buf3'] })
ks('gm_resist', 'givremort', 2, 'Endurance morbide', 'SURVIE : -10% de dégâts subis. Exige Carcasse au max (5).', { stat: { endurance: 16 }, ks: { flatDr: 0.1 } }, { requires: ['gm_buf3'], requiresRank: { id: 'gm_buf3', rank: 5 } })
/* ---- SANG (TANK) — encaisser → drainer (lifeNuke/dotLeech) → bouclier d'os (finisherShield). ---- */
ability('sg_hub', 'sang', 0, 'Sang', 'sg_drain', 'Débloque Frappe vampirique (drain). +18 Force, +40 Endurance.', { requires: ['cl_dk'], statMods: { force: 18, endurance: 40 } })
minor('sg_os', 'sang', 1, 'Os d\'acier', 5, { endurance: 14 }, { requires: ['sg_hub'] })
ability('sg_marque', 'sang', 1, 'Marque sanglante', 'sg_marque', 'FINITION : débloque Marque sanglante (finisseur). +16 Force.', { requires: ['sg_hub'], statMods: { force: 16 } })
ks('sg_bouclier', 'sang', 2, 'Bouclier d\'os', 'TANK (cd 30 s) : un finisseur t\'accorde un bouclier = 35% de ses dégâts (≤ tes PV). Exige Os d\'acier au max (5).', { stat: { endurance: 20 }, ks: { finisherShield: 0.35 } }, { requires: ['sg_os'], requiresRank: { id: 'sg_os', rank: 5 } })
ability('sg_builder', 'sang', 1, 'Soif de sang', 'sg_builder', 'GÉNÉRATION : débloque Soif de sang (générateur).', { requires: ['sg_hub'] })
ks('sg_vampirisme', 'sang', 2, 'Vampirisme', 'SURVIE : tes DoT te soignent (25% du tick), +20 Régén.', { stat: { regen: 20 }, ks: { dotLeech: 0.25 } }, { requires: ['sg_builder'] })
minor('sg_buf2', 'sang', 3, 'Sang noir', 5, { endurance: 12 }, { requires: ['sg_vampirisme'] })
ks('sg_caillot', 'sang', 4, 'Caillot', 'SURVIE : -12% de dégâts subis. Exige Sang noir au max (5).', { stat: { endurance: 16 }, ks: { flatDr: 0.12 } }, { requires: ['sg_buf2'], requiresRank: { id: 'sg_buf2', rank: 5 } })
ability('sg_provoc', 'sang', 2, 'Provocation', 'provocation', 'MENACE : attire les attaques (rôle de tank).', { requires: ['sg_os'] })
ability('sg_egide', 'sang', 5, 'Égide titanesque', 'egide_titanesque', 'ULTIME — énorme bouclier d\'absorption. Tout au fond : 20 pts dans la voie.', { requires: ['sg_bouclier'], minSpent: 20 })

/* ================================================================== */
/* DÉMONISTE (Tissu) — Pestilence (multi-DoT) · Légion (démons).       */
/* ================================================================== */
node('cl_demoniste', 'demoniste', 'ability', 0, 1, 'Démoniste', 'Maître des afflictions et des démons. Débloque Trait de l\'ombre. +30 Intelligence.', { requires: ['cat_tissu'], statMods: { intelligence: 30 }, unlockPower: 'de_trait' })
/* ---- PESTILENCE — empile des fléaux (poison ombre) → détone tout (drain). ---- */
ability('pe_hub', 'pestilence', 0, 'Pestilence', 'pe_fleau', 'Débloque Fléau (affliction d\'ombre cumulative). +18 Intelligence, +15 Altération.', { requires: ['cl_demoniste'], statMods: { intelligence: 18, alteration: 15 } })
minor('pe_tox', 'pestilence', 1, 'Virulence', 3, { alteration: 18 }, { requires: ['pe_hub'] })
ks('pe_dotamp', 'pestilence', 1, 'Affliction', 'Tes sorts [dot] +12% (cross-classe).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'dot', damageMult: 1.12 } } }, { requires: ['pe_tox'] })
ks('pe_venmort', 'pestilence', 2, 'Fléau mortel', 'Tes fléaux s\'empilent plus haut et plus fort.', { stat: { alteration: 16 }, ks: { poison: { perStack: 0.05, maxStacks: 2 } } }, { requires: ['pe_tox'] })
minor('pe_buf1', 'pestilence', 3, 'Putréfaction', 5, { alteration: 8 }, { requires: ['pe_venmort'] })
ability('pe_drain', 'pestilence', 4, 'Drain d\'âme', 'pe_drain', 'Débloque Drain d\'âme : DÉTONE tous les fléaux (pic = stacks × dégâts). Exige Putréfaction au max + 8 pts.', { requires: ['pe_buf1'], requiresRank: { id: 'pe_buf1', rank: 5 }, minSpent: 8 })
ks('pe_chain', 'pestilence', 5, 'Propagation', 'Tes fléaux et la détonation se propagent au pack (50%). Profond : 12 pts.', { stat: { penetration: 16 }, ks: { dotAoe: 0.5 } }, { requires: ['pe_drain'], minSpent: 12 })
ability('pe_fin', 'pestilence', 6, 'Fin du monde', 'pe_fin', 'ULTIME — détonation cataclysmique de tous les fléaux du pack. Tout au fond : 20 pts.', { requires: ['pe_chain'], minSpent: 20 })
minor('pe_ombre', 'pestilence', 1, 'Ténèbres', 3, { intelligence: 16 }, { requires: ['pe_hub'] })
ks('pe_ombreamp', 'pestilence', 2, 'Maîtrise de l\'ombre', 'Tes sorts [ombre] +12% (cross-classe).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'ombre', damageMult: 1.12 } } }, { requires: ['pe_ombre'] })
minor('pe_buf2', 'pestilence', 3, 'Corruption', 5, { alteration: 8 }, { requires: ['pe_ombreamp'] })
ability('pe_nuee', 'pestilence', 4, 'Nuée de fléaux', 'pe_nuee', 'CHOIX de SORT : un nuage de fléaux sur tout le pack. Exige Corruption au max + 8 pts.', { requires: ['pe_buf2'], requiresRank: { id: 'pe_buf2', rank: 5 }, exclusive: 'pe_arme2', minSpent: 8 })
ability('pe_corr', 'pestilence', 4, 'Corruption majeure', 'pe_corruption', 'CHOIX de SORT : un gros DoT d\'ombre mono. Exige Corruption au max + 8 pts.', { requires: ['pe_buf2'], requiresRank: { id: 'pe_buf2', rank: 5 }, exclusive: 'pe_arme2', minSpent: 8 })
minor('pe_buf3', 'pestilence', 1, 'Pacte', 5, { volDeVie: 8 }, { requires: ['pe_hub'] })
ks('pe_drainlife', 'pestilence', 2, 'Vampirisme d\'ombre', 'SURVIE : tes DoT te soignent (25% du tick). Exige Pacte au max (5).', { stat: { regen: 20 }, ks: { dotLeech: 0.25 } }, { requires: ['pe_buf3'], requiresRank: { id: 'pe_buf3', rank: 5 } })
/* ---- LÉGION — démons cumulés (petDps) + Tyran (frenzy). ---- */
ability('lg_hub', 'legion', 0, 'Légion', 'lg_nuee', 'Débloque Nuée démoniaque. +18 Intelligence, +12 Critique.', { requires: ['cl_demoniste'], statMods: { intelligence: 18, critique: 12 } })
minor('lg_pacte', 'legion', 1, 'Pacte démoniaque', 3, { intelligence: 16 }, { requires: ['lg_hub'] })
ks('lg_demon', 'legion', 2, 'Invocation', 'INVOCATION : un démon combat à tes côtés (+30% de ton DPS d\'auto, en continu).', { stat: { intelligence: 12 }, ks: { petDps: 0.3 } }, { requires: ['lg_pacte'] })
minor('lg_buf1', 'legion', 3, 'Lien démoniaque', 5, { intelligence: 8 }, { requires: ['lg_demon'] })
ks('lg_legion', 'legion', 4, 'Légion', 'INVOCATION : un second démon te rejoint (+35% de plus). Exige Lien démoniaque au max (5).', { stat: { intelligence: 14 }, ks: { petDps: 0.35 } }, { requires: ['lg_buf1'], requiresRank: { id: 'lg_buf1', rank: 5 } })
ability('lg_tyran', 'legion', 5, 'Tyran de l\'effroi', 'lg_tyran', 'ULTIME — invoque le Tyran qui survolte ta Légion (+dégâts). Tout au fond : 20 pts.', { requires: ['lg_legion'], minSpent: 20 })
minor('lg_chaos', 'legion', 1, 'Chaos', 3, { critique: 18 }, { requires: ['lg_hub'] })
ks('lg_ombreamp', 'legion', 2, 'Maître démoniste', 'Tes sorts [ombre] +12% (cross-classe).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'ombre', damageMult: 1.12 } } }, { requires: ['lg_chaos'] })
minor('lg_buf2', 'legion', 3, 'Savoir interdit', 5, { critique: 8 }, { requires: ['lg_ombreamp'] })
ability('lg_trait', 'legion', 4, 'Trait du chaos', 'lg_trait', 'CHOIX de SORT : un trait de chaos dévastateur. Exige Savoir interdit au max + 8 pts.', { requires: ['lg_buf2'], requiresRank: { id: 'lg_buf2', rank: 5 }, exclusive: 'lg_arme2', minSpent: 8 })
ability('lg_arma', 'legion', 4, 'Armageddon', 'lg_armageddon', 'CHOIX de SORT : une pluie de feu démoniaque (zone). Exige Savoir interdit au max + 8 pts.', { requires: ['lg_buf2'], requiresRank: { id: 'lg_buf2', rank: 5 }, exclusive: 'lg_arme2', minSpent: 8 })
minor('lg_buf3', 'legion', 1, 'Cuirasse d\'âmes', 5, { barriere: 12 }, { requires: ['lg_hub'] })
ks('lg_protection', 'legion', 2, 'Armure démoniaque', 'SURVIE : -10% de dégâts subis, +20 Régén. Exige Cuirasse d\'âmes au max (5).', { stat: { regen: 20 }, ks: { flatDr: 0.1 } }, { requires: ['lg_buf3'], requiresRank: { id: 'lg_buf3', rank: 5 } })

/* ================================================================== */
/* CHAMAN (Mailles) — Élémentaire (DPS) · Vague (HEAL).                */
/* ================================================================== */
node('cl_chaman', 'chaman', 'ability', 0, 1, 'Chaman', 'Voix des éléments. Débloque Éclair. +20 Agilité, +20 Intelligence.', { requires: ['cat_mailles'], statMods: { agilite: 20, intelligence: 20 }, unlockPower: 'sh_eclair' })
/* ---- ÉLÉMENTAIRE — foudre en chaîne + Surcharge (procs) + Maelström. ---- */
ability('el_hub', 'elementaire', 0, 'Élémentaire', 'el_foudre', 'Débloque Foudre en chaîne (rebondit sur le pack). +18 Intelligence, +12 Critique.', { requires: ['cl_chaman'], statMods: { intelligence: 18, critique: 12 } })
minor('el_orage', 'elementaire', 1, 'Orage', 3, { critique: 18 }, { requires: ['el_hub'] })
ks('el_chain', 'elementaire', 2, 'Foudre en chaîne', 'FOUDRE : tes éclairs rebondissent (+50% sur 2 cibles de plus).', { stat: { intelligence: 12 }, ks: { chainArc: { frac: 0.5, targets: 2 } } }, { requires: ['el_orage'] })
ks('el_static', 'elementaire', 3, 'Surcharge', 'PROC : toutes les 4 attaques, la suivante frappe ×1,6.', { stat: { hate: 14 }, ks: { staticN: { every: 4, mult: 1.6 } } }, { requires: ['el_chain'] })
minor('el_buf1', 'elementaire', 3, 'Fureur élémentaire', 5, { intelligence: 8 }, { requires: ['el_static'] })
ability('el_coulee', 'elementaire', 4, 'Coulée de lave', 'el_coulee', 'Débloque Coulée de lave (gros nuke de feu). Exige Fureur élémentaire au max + 10 pts.', { requires: ['el_buf1'], requiresRank: { id: 'el_buf1', rank: 5 }, minSpent: 10 })
ks('el_foudreamp', 'elementaire', 5, 'Maître de la foudre', 'Tes sorts [foudre] +18%. Profond : 12 pts.', { stat: { intelligence: 16 }, ks: { tagBonus: { tag: 'foudre', damageMult: 1.18 } } }, { requires: ['el_coulee'], minSpent: 12 })
ability('el_tempete', 'elementaire', 6, 'Tempête primordiale', 'el_tempete', 'ULTIME — une tempête pulvérise le pack. Tout au fond : 20 pts.', { requires: ['el_foudreamp'], minSpent: 20 })
ability('el_maelstrom', 'elementaire', 1, 'Vague de Maelström', 'el_maelstrom', 'GÉNÉRATION : débloque Vague de Maelström (générateur INT, +2 d\'un coup). +16 Intelligence.', { requires: ['el_hub'], statMods: { intelligence: 16 } })
ks('el_finamp', 'elementaire', 2, 'Maîtrise du Maelström', 'Tes sorts [finisseur] +15% (cross-classe).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['el_maelstrom'] })
minor('el_buf2', 'elementaire', 3, 'Flux tellurique', 5, { hate: 8 }, { requires: ['el_finamp'] })
ability('el_lave', 'elementaire', 4, 'Salve de lave', 'el_lave', 'CHOIX de SORT : un finisseur de feu (× Maelström). Exige Flux tellurique au max + 8 pts.', { requires: ['el_buf2'], requiresRank: { id: 'el_buf2', rank: 5 }, minSpent: 8 })
minor('el_buf3', 'elementaire', 1, 'Bouclier de pierre', 5, { barriere: 12 }, { requires: ['el_hub'] })
ks('el_protection', 'elementaire', 2, 'Bouclier élémentaire', 'SURVIE : -10% de dégâts subis, +30 Esquive. Exige Bouclier de pierre au max (5).', { stat: { esquive: 30 }, ks: { flatDr: 0.1 } }, { requires: ['el_buf3'], requiresRank: { id: 'el_buf3', rank: 5 } })
/* ---- VAGUE (HEAL) — soin de groupe en chaîne + totem (HoT). ---- */
ability('va_hub', 'vague', 0, 'Vague', 'va_soin', 'Débloque Vague de soin. +18 Intelligence.', { requires: ['cl_chaman'], statMods: { intelligence: 18 } })
minor('va_eau', 'vague', 1, 'Source vive', 5, { regen: 10 }, { requires: ['va_hub'] })
ability('va_totem', 'vague', 2, 'Totem de jouvence', 'va_totem', 'TOTEM : débloque Totem de jouvence (soin sur la durée).', { requires: ['va_eau'] })
ks('va_totemks', 'vague', 2, 'Totem de soin', 'TOTEM : un soin sur la durée constant sur l\'allié blessé (+régén d\'équipe). Exige Source vive au max (5).', { stat: { regen: 20 }, ks: { hot: 0.5 } }, { requires: ['va_eau'], requiresRank: { id: 'va_eau', rank: 5 } })
ability('va_chaine', 'vague', 3, 'Soin en chaîne', 'va_chaine', 'Débloque Soin en chaîne (groupe). Gaté : 6 pts dans la voie.', { requires: ['va_eau'], minSpent: 6 })
minor('va_buf', 'vague', 1, 'Communion', 5, { intelligence: 8 }, { requires: ['va_hub'] })
ks('va_chatiment', 'vague', 2, 'Courroux ancestral', 'ATONEMENT : 35% de tes soins frappent aussi l\'ennemi (solo viable). Exige Communion au max (5).', { stat: { intelligence: 12 }, ks: { healToDamage: 0.35 } }, { requires: ['va_buf'], requiresRank: { id: 'va_buf', rank: 5 } })
ability('va_maree', 'vague', 5, 'Marée de vie', 'va_maree', 'ULTIME — restaure énormément tout le groupe. Tout au fond : 20 pts.', { requires: ['va_chatiment'], minSpent: 20 })
minor('va_buf3', 'vague', 1, 'Carapace d\'écailles', 5, { barriere: 12 }, { requires: ['va_hub'] })
ability('va_bouclier', 'vague', 2, 'Bouclier de pierre', 'bouclier_runique', 'SURVIE : bouclier d\'absorption.', { requires: ['va_buf3'] })

/* ================================================================== */
/* DRUIDE (Cuir) — Lunaire (DPS) · Ronce (TANK) · Floraison (HEAL).    */
/* ================================================================== */
node('cl_druide', 'druide', 'ability', 0, 1, 'Druide', 'Gardien du cycle naturel et astral. Débloque Griffe lunaire. +30 Agilité.', { requires: ['cat_cuir'], statMods: { agilite: 30 }, unlockPower: 'dd_griffe' })
/* ---- LUNAIRE (DPS) — DoT astraux (Lune/Soleil) + Pouvoir astral → Plénitude. ---- */
ability('ln_hub', 'lunaire', 0, 'Lunaire', 'ln_lune', 'Débloque Éclat lunaire (DoT arcane). +18 Intelligence, +15 Altération.', { requires: ['cl_druide'], statMods: { intelligence: 18, alteration: 15 } })
minor('ln_astre', 'lunaire', 1, 'Affinité astrale', 3, { alteration: 18 }, { requires: ['ln_hub'] })
ks('ln_dotamp', 'lunaire', 1, 'Équinoxe', 'Tes sorts [dot] +12% (cross-classe).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'dot', damageMult: 1.12 } } }, { requires: ['ln_astre'] })
ability('ln_soleil', 'lunaire', 2, 'Feu solaire', 'ln_soleil', 'Débloque Feu solaire (DoT nature) — l\'autre face de l\'Éclipse.', { requires: ['ln_astre'] })
ability('ln_astral', 'lunaire', 1, 'Éclair astral', 'ln_astral', 'GÉNÉRATION : débloque Éclair astral (génère le Pouvoir astral, +2 d\'un coup). +16 Intelligence.', { requires: ['ln_hub'], statMods: { intelligence: 16 } })
ks('ln_finamp', 'lunaire', 2, 'Maîtrise astrale', 'Tes sorts [finisseur] +15% (cross-classe).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['ln_astral'] })
minor('ln_buf1', 'lunaire', 3, 'Pleine lune', 5, { intelligence: 8 }, { requires: ['ln_finamp'] })
ability('ln_plenitude', 'lunaire', 4, 'Plénitude', 'ln_plenitude', 'Débloque Plénitude (finisseur astral × Pouvoir astral). Exige Pleine lune au max + 8 pts.', { requires: ['ln_buf1'], requiresRank: { id: 'ln_buf1', rank: 5 }, minSpent: 8 })
ks('ln_eclipse', 'lunaire', 5, 'Éclipse', 'Tes sorts [arcane] ET [nature] +15% de dégâts. Profond : 12 pts.', { stat: { intelligence: 16 }, ks: { tagBonus: { tag: 'arcane', damageMult: 1.15 } } }, { requires: ['ln_plenitude'], minSpent: 12 })
ability('ln_etoiles', 'lunaire', 6, 'Chute d\'étoiles', 'ln_etoiles', 'ULTIME — une pluie d\'étoiles s\'abat sur le pack. Tout au fond : 20 pts.', { requires: ['ln_eclipse'], minSpent: 20 })
minor('ln_buf3', 'lunaire', 1, 'Fourrure', 5, { esquive: 12 }, { requires: ['ln_hub'] })
ks('ln_protection', 'lunaire', 2, 'Peau d\'écorce', 'SURVIE : -10% de dégâts subis. Exige Fourrure au max (5).', { stat: { esquive: 20 }, ks: { flatDr: 0.1 } }, { requires: ['ln_buf3'], requiresRank: { id: 'ln_buf3', rank: 5 } })
/* ---- RONCE (TANK) — gros PV, épines, +dégâts à PV hauts. ---- */
ability('ro_hub', 'ronce', 0, 'Ronce', 'ro_lacere', 'Débloque Lacération (zone). +18 Force, +40 Endurance.', { requires: ['cl_druide'], statMods: { force: 18, endurance: 40 } })
minor('ro_ecorce', 'ronce', 1, 'Écorce', 5, { endurance: 14 }, { requires: ['ro_hub'] })
ks('ro_epines', 'ronce', 2, 'Épines', 'Tes assaillants encaissent 30% de tes dégâts d\'auto en retour. Exige Écorce au max (5).', { stat: { endurance: 20 }, ks: { thorns: 0.3 } }, { requires: ['ro_ecorce'], requiresRank: { id: 'ro_ecorce', rank: 5 } })
ks('ro_colosse', 'ronce', 3, 'Colosse sylvestre', 'À plus de 60% de PV, +20% de dégâts. Profond : 10 pts.', { stat: { force: 16 }, ks: { highHpBonus: { threshold: 0.6, mult: 1.2 } } }, { requires: ['ro_epines'], minSpent: 10 })
ability('ro_provoc', 'ronce', 2, 'Provocation', 'provocation', 'MENACE : attire les attaques.', { requires: ['ro_ecorce'] })
minor('ro_buf2', 'ronce', 1, 'Régénération', 5, { regen: 12 }, { requires: ['ro_hub'] })
ks('ro_resist', 'ronce', 2, 'Cuir épais', 'SURVIE : -12% de dégâts subis. Exige Régénération au max (5).', { stat: { endurance: 16 }, ks: { flatDr: 0.12 } }, { requires: ['ro_buf2'], requiresRank: { id: 'ro_buf2', rank: 5 } })
ability('ro_ronces', 'ronce', 3, 'Ronces acérées', 'ro_ronces', 'CHOIX de SORT : un DoT nature qui saigne le pack. Gaté : 8 pts.', { requires: ['ro_buf2'], minSpent: 8 })
ability('ro_souffle', 'ronce', 2, 'Second souffle', 'second_souffle', 'SURVIE : auto-soin.', { requires: ['ro_buf2'] })
/* ---- FLORAISON (HEAL) — HoT empilés. ---- */
ability('fo_hub', 'floraison', 0, 'Floraison', 'fo_pousse', 'Débloque Pousse de vie (soin sur la durée). +18 Intelligence.', { requires: ['cl_druide'], statMods: { intelligence: 18 } })
minor('fo_seve', 'floraison', 1, 'Sève', 5, { regen: 10 }, { requires: ['fo_hub'] })
ks('fo_hot', 'floraison', 2, 'Floraison persistante', 'SOIN : un soin sur la durée constant (+régén d\'équipe). Exige Sève au max (5).', { stat: { regen: 20 }, ks: { hot: 0.5 } }, { requires: ['fo_seve'], requiresRank: { id: 'fo_seve', rank: 5 } })
ability('fo_floraison', 'floraison', 3, 'Floraison', 'fo_floraison', 'Débloque Floraison (soin direct). Gaté : 6 pts.', { requires: ['fo_seve'], minSpent: 6 })
ability('fo_eclosion', 'floraison', 5, 'Éclosion', 'fo_eclosion', 'ULTIME — toutes les fleurs éclosent : énorme soin de groupe. Tout au fond : 20 pts.', { requires: ['fo_hot'], minSpent: 20 })
minor('fo_buf', 'floraison', 1, 'Symbiose', 5, { intelligence: 8 }, { requires: ['fo_hub'] })
ks('fo_chatiment', 'floraison', 2, 'Courroux de la nature', 'ATONEMENT : 35% de tes soins frappent aussi l\'ennemi (solo viable). Exige Symbiose au max (5).', { stat: { intelligence: 12 }, ks: { healToDamage: 0.35 } }, { requires: ['fo_buf'], requiresRank: { id: 'fo_buf', rank: 5 } })
minor('fo_buf3', 'floraison', 1, 'Carapace végétale', 5, { barriere: 12 }, { requires: ['fo_hub'] })
ability('fo_bouclier', 'floraison', 2, 'Bouclier d\'écorce', 'bouclier_runique', 'SURVIE : bouclier d\'absorption.', { requires: ['fo_buf3'] })

/* ================================================================== */
/* PALADIN (Plaque) — Croisé (DPS) · Templier (TANK) · Aube (HEAL).    */
/* ================================================================== */
node('cl_paladin', 'paladin', 'ability', 0, 1, 'Paladin', 'Champion sacré porté par le Pouvoir Sacré. Débloque Châtiment du croisé. +25 Force.', { requires: ['cat_plaque'], statMods: { force: 25 }, unlockPower: 'pa_chatiment' })
/* ---- CROISÉ (DPS) — Pouvoir Sacré → Jugement + fenêtre de Croisade. ---- */
ability('cs_hub', 'croise', 0, 'Croisé', 'cs_marteau', 'Débloque Marteau du juste (générateur de Pouvoir Sacré). +18 Force, +12 Critique.', { requires: ['cl_paladin'], statMods: { force: 18, critique: 12 } })
ability('cs_jugement', 'croise', 1, 'Jugement', 'cs_jugement', 'FINITION : débloque Jugement (finisseur sacré × Pouvoir Sacré). +16 Force.', { requires: ['cs_hub'], statMods: { force: 16 } })
ks('cs_finamp', 'croise', 2, 'Verdict', 'Tes sorts [finisseur] +15% (cross-classe).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['cs_jugement'] })
ks('cs_zele', 'croise', 2, 'Zèle', 'Tes finisseurs frappent +25% plus fort.', { stat: { degatsCrit: 20 }, ks: { finisherMult: 0.25 } }, { requires: ['cs_jugement'] })
minor('cs_buf1', 'croise', 3, 'Ferveur sacrée', 5, { force: 8 }, { requires: ['cs_jugement'] })
ability('cs_croisade', 'croise', 4, 'Croisade', 'cs_croisade', 'Débloque Croisade (fenêtre de burst : +80% de dégâts 8 s). Exige Ferveur sacrée au max + 10 pts.', { requires: ['cs_buf1'], requiresRank: { id: 'cs_buf1', rank: 5 }, minSpent: 10 })
ks('cs_arcaneamp', 'croise', 5, 'Lumière vengeresse', 'Tes sorts [arcane] +18%. Profond : 12 pts.', { stat: { force: 16 }, ks: { tagBonus: { tag: 'arcane', damageMult: 1.18 } } }, { requires: ['cs_croisade'], minSpent: 12 })
ability('cs_aile', 'croise', 6, 'Aile de l\'aurore', 'cs_aile', 'ULTIME — les ailes de l\'aurore balaient le pack. Tout au fond : 20 pts.', { requires: ['cs_arcaneamp'], minSpent: 20 })
minor('cs_buf2', 'croise', 1, 'Zèle ardent', 3, { critique: 18 }, { requires: ['cs_hub'] })
ks('cs_directamp', 'croise', 2, 'Croisé fervent', 'Tes sorts [direct] +12% (cross-classe).', { stat: { critique: 14 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['cs_buf2'] })
minor('cs_buf3', 'croise', 1, 'Foi inébranlable', 5, { reductionDegats: 10 }, { requires: ['cs_hub'] })
ks('cs_resist', 'croise', 2, 'Bouclier de foi', 'SURVIE : -10% de dégâts subis. Exige Foi inébranlable au max (5).', { stat: { endurance: 16 }, ks: { flatDr: 0.1 } }, { requires: ['cs_buf3'], requiresRank: { id: 'cs_buf3', rank: 5 } })
/* ---- TEMPLIER (TANK) — aura de partage de résistance + épines. ---- */
ability('tp_hub', 'templier', 0, 'Templier', 'tp_consecration', 'Débloque Consécration (zone qui tient le pack). +18 Force, +40 Endurance.', { requires: ['cl_paladin'], statMods: { force: 18, endurance: 40 } })
minor('tp_aura', 'templier', 1, 'Aura sacrée', 5, { endurance: 14 }, { requires: ['tp_hub'] })
ks('tp_partage', 'templier', 2, 'Aura de dévotion', 'AURA : partage 30% de ta résistance avec l\'équipe. Exige Aura sacrée au max (5).', { stat: { endurance: 20 }, ks: { shareResist: 0.3 } }, { requires: ['tp_aura'], requiresRank: { id: 'tp_aura', rank: 5 } })
ks('tp_epines', 'templier', 3, 'Épines sacrées', 'Tes assaillants encaissent 30% de tes dégâts d\'auto en retour. Profond : 10 pts.', { stat: { endurance: 16 }, ks: { thorns: 0.3 } }, { requires: ['tp_partage'], minSpent: 10 })
ability('tp_provoc', 'templier', 2, 'Provocation', 'provocation', 'MENACE : attire les attaques.', { requires: ['tp_aura'] })
minor('tp_buf2', 'templier', 1, 'Plaque bénie', 5, { reductionDegats: 10 }, { requires: ['tp_hub'] })
ks('tp_resist', 'templier', 2, 'Forteresse sacrée', 'SURVIE : -12% de dégâts subis. Exige Plaque bénie au max (5).', { stat: { endurance: 16 }, ks: { flatDr: 0.12 } }, { requires: ['tp_buf2'], requiresRank: { id: 'tp_buf2', rank: 5 } })
ability('tp_egide', 'templier', 3, 'Égide titanesque', 'egide_titanesque', 'ULTIME — énorme bouclier d\'absorption (40% à l\'équipe). Tout au fond : 20 pts.', { requires: ['tp_resist'], minSpent: 20 })
/* ---- AUBE (HEAL) — soigne en FRAPPANT (damageToHeal), scale FORCE. ---- */
ability('au_hub', 'aube', 0, 'Aube', 'au_verdict', 'Débloque Verdict sacré : un healer offensif. +18 Force.', { requires: ['cl_paladin'], statMods: { force: 18 } })
minor('au_zele', 'aube', 1, 'Zèle sacré', 5, { critique: 10 }, { requires: ['au_hub'] })
ks('au_chatiment', 'aube', 2, 'Lumière rédemptrice', 'ATONEMENT INVERSÉ : 40% de tes DÉGÂTS soignent l\'allié le plus blessé (tu soignes en frappant). Exige Zèle sacré au max (5).', { stat: { force: 12 }, ks: { damageToHeal: 0.4 } }, { requires: ['au_zele'], requiresRank: { id: 'au_zele', rank: 5 } })
ks('au_ferveur', 'aube', 3, 'Ferveur de l\'aube', '+40% de soin par tes dégâts (rédemption accrue). Profond : 10 pts.', { stat: { force: 14 }, ks: { damageToHeal: 0.4 } }, { requires: ['au_chatiment'], minSpent: 10 })
ability('au_aurore', 'aube', 5, 'Aurore', 'au_aurore', 'ULTIME — une aurore restaure énormément tout le groupe. Tout au fond : 20 pts.', { requires: ['au_ferveur'], minSpent: 20 })
minor('au_foi', 'aube', 1, 'Foi', 5, { regen: 10 }, { requires: ['au_hub'] })
ability('au_lumiere', 'aube', 2, 'Flash de lumière', 'au_lumiere', 'SOIN : un soin direct en pic.', { requires: ['au_foi'] })
ability('au_imposition', 'aube', 3, 'Imposition des mains', 'au_imposition', 'Débloque Imposition des mains (soin de groupe). Gaté : 6 pts.', { requires: ['au_foi'], minSpent: 6 })
minor('au_buf3', 'aube', 1, 'Plaque sacrée', 5, { reductionDegats: 10 }, { requires: ['au_hub'] })
ks('au_resist', 'aube', 2, 'Grâce protectrice', 'SURVIE : -10% de dégâts subis. Exige Plaque sacrée au max (5).', { stat: { endurance: 16 }, ks: { flatDr: 0.1 } }, { requires: ['au_buf3'], requiresRank: { id: 'au_buf3', rank: 5 } })

/* ------------------------------------------------------------------ */
/* Méta de constellation.                                             */
/* ------------------------------------------------------------------ */
export const CONSTELLATIONS: Record<ConstellationId, ConstellationMeta> = {
  coeur: { id: 'coeur', name: 'Cœur & catégories', role: 'Racine', color: '#e2e8f0', icon: '✶' },
  voleur: { id: 'voleur', name: 'Voleur', role: 'Cuir · classe', color: '#a18152', icon: '🗡' },
  assassin: { id: 'assassin', name: 'Assassin', role: 'Voleur · afflictions', color: '#51cf66', icon: '☠', archetype: true },
  ombrelame: { id: 'ombrelame', name: 'Ombrelame', role: 'Voleur · combo & ombre', color: '#b197fc', icon: '🌑', archetype: true },
  mage: { id: 'mage', name: 'Mage', role: 'Tissu · classe', color: '#74c0fc', icon: '✨' },
  pyromancien: { id: 'pyromancien', name: 'Pyromancien', role: 'Mage · feu & embrasement', color: '#ff6b6b', icon: '🔥', archetype: true },
  cryomancien: { id: 'cryomancien', name: 'Cryomancien', role: 'Mage · givre & contrôle', color: '#3bc9db', icon: '❄️', archetype: true },
  arcaniste: { id: 'arcaniste', name: 'Arcaniste', role: 'Mage · charges & surcharge', color: '#b197fc', icon: '🔮', archetype: true },
  chasseur: { id: 'chasseur', name: 'Chasseur', role: 'Mailles · classe', color: '#94d82d', icon: '🏹' },
  meute: { id: 'meute', name: 'Meneur de meute', role: 'Chasseur · familier', color: '#82c91e', icon: '🐺', archetype: true },
  faucon: { id: 'faucon', name: 'Œil de faucon', role: 'Chasseur · concentration', color: '#fab005', icon: '🦅', archetype: true },
  guerrier: { id: 'guerrier', name: 'Guerrier', role: 'Plaque · classe', color: '#e8590c', icon: '⚔' },
  sentence: { id: 'sentence', name: 'Sentence', role: 'Guerrier · Rage & exécution', color: '#fa5252', icon: '⚖', archetype: true },
  rempart: { id: 'rempart', name: 'Rempart', role: 'Guerrier · TANK', color: '#f08c00', icon: '🛡', archetype: true },
  pretre: { id: 'pretre', name: 'Prêtre', role: 'Tissu · classe', color: '#f1f3f5', icon: '✚' },
  lumiere: { id: 'lumiere', name: 'Lumière', role: 'Prêtre · HEAL', color: '#ffd43b', icon: '🌟', archetype: true },
  vide: { id: 'vide', name: 'Vide', role: 'Prêtre · DoT ombre', color: '#9775fa', icon: '🌑', archetype: true },
  dk: { id: 'dk', name: 'Chevalier de la mort', role: 'Plaque · classe', color: '#5c7cfa', icon: '☠' },
  givremort: { id: 'givremort', name: 'Givre-mort', role: 'DK · givre & exécution', color: '#74c0fc', icon: '❄', archetype: true },
  sang: { id: 'sang', name: 'Sang', role: 'DK · TANK vampire', color: '#e03131', icon: '🩸', archetype: true },
  demoniste: { id: 'demoniste', name: 'Démoniste', role: 'Tissu · classe', color: '#9c36b5', icon: '💀' },
  pestilence: { id: 'pestilence', name: 'Pestilence', role: 'Démoniste · multi-DoT', color: '#82c91e', icon: '☣', archetype: true },
  legion: { id: 'legion', name: 'Légion', role: 'Démoniste · démons', color: '#7048e8', icon: '👹', archetype: true },
  chaman: { id: 'chaman', name: 'Chaman', role: 'Mailles · classe', color: '#3bc9db', icon: '⚡' },
  elementaire: { id: 'elementaire', name: 'Élémentaire', role: 'Chaman · foudre & Maelström', color: '#fcc419', icon: '🌩', archetype: true },
  vague: { id: 'vague', name: 'Vague', role: 'Chaman · HEAL totems', color: '#22b8cf', icon: '💧', archetype: true },
  druide: { id: 'druide', name: 'Druide', role: 'Cuir · classe', color: '#94d82d', icon: '🐾' },
  lunaire: { id: 'lunaire', name: 'Lunaire', role: 'Druide · astral', color: '#748ffc', icon: '🌙', archetype: true },
  ronce: { id: 'ronce', name: 'Ronce', role: 'Druide · TANK', color: '#2f9e44', icon: '🌳', archetype: true },
  floraison: { id: 'floraison', name: 'Floraison', role: 'Druide · HEAL HoT', color: '#69db7c', icon: '🌸', archetype: true },
  paladin: { id: 'paladin', name: 'Paladin', role: 'Plaque · classe', color: '#ffd43b', icon: '⚜' },
  croise: { id: 'croise', name: 'Croisé', role: 'Paladin · sacré DPS', color: '#ffe066', icon: '⚔', archetype: true },
  templier: { id: 'templier', name: 'Templier', role: 'Paladin · TANK aura', color: '#f59f00', icon: '🛡', archetype: true },
  aube: { id: 'aube', name: 'Aube', role: 'Paladin · HEAL (frappe)', color: '#ffec99', icon: '🌅', archetype: true },
}
export const CONSTELLATION_LIST: ConstellationId[] = [
  'coeur', 'voleur', 'assassin', 'ombrelame',
  'mage', 'pyromancien', 'cryomancien', 'arcaniste',
  'chasseur', 'meute', 'faucon',
  'guerrier', 'sentence', 'rempart',
  'pretre', 'lumiere', 'vide',
  'dk', 'givremort', 'sang',
  'demoniste', 'pestilence', 'legion',
  'chaman', 'elementaire', 'vague',
  'druide', 'lunaire', 'ronce', 'floraison',
  'paladin', 'croise', 'templier', 'aube',
]

/* ------------------------------------------------------------------ */
/* Accès & agrégation (API consommée par character.ts / UI).           */
/* ------------------------------------------------------------------ */
const BY_ID = new Map(TALENTS.map((t) => [t.id, t]))
export function getTalent(id: string): TalentNode | undefined { return BY_ID.get(id) }
export function talentsByConstellation(c: ConstellationId): TalentNode[] {
  return TALENTS.filter((t) => t.constellation === c).sort((a, b) => a.tier - b.tier)
}

export function talentStatMods(talents: Record<string, number>): StatBlock {
  const out: StatBlock = {}
  for (const id in talents) {
    const rank = talents[id]; const n = BY_ID.get(id)
    if (!n?.statMods || rank <= 0) continue
    for (const k in n.statMods) { const key = k as keyof StatBlock; out[key] = (out[key] ?? 0) + (n.statMods[key] ?? 0) * rank }
  }
  return out
}
export function talentResistMods(talents: Record<string, number>): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {}
  for (const id in talents) {
    const rank = talents[id]; const n = BY_ID.get(id)
    if (!n?.resistMods || rank <= 0) continue
    for (const t in n.resistMods) { const ty = t as DamageType; out[ty] = (out[ty] ?? 0) + (n.resistMods[ty] ?? 0) * rank }
  }
  return out
}
export function talentUnlockedPowers(talents: Record<string, number>): string[] {
  const out: string[] = []
  for (const id in talents) { if (talents[id] <= 0) continue; const p = BY_ID.get(id)?.unlockPower; if (p) out.push(p) }
  return out
}
export function talentKeystones(talents: Record<string, number>): KeystoneEffect[] {
  const out: KeystoneEffect[] = []
  for (const id in talents) { if (talents[id] <= 0) continue; const k = BY_ID.get(id)?.keystone; if (k) out.push(k) }
  return out
}

/* ---- Modèle d'allocation : adjacence + choix exclusif + budget. ---- */

/** Points dépensés dans une constellation (pour les portes de budget `minSpent`). */
export function spentInConstellation(talents: Record<string, number>, c: ConstellationId): number {
  let s = 0
  for (const id in talents) { if (BY_ID.get(id)?.constellation === c) s += talents[id] }
  return s
}

/** Un frère de groupe exclusif est-il déjà alloué (→ ce nœud est verrouillé) ? */
export function exclusiveBlocker(node: TalentNode, talents: Record<string, number>): TalentNode | null {
  if (!node.exclusive) return null
  for (const t of TALENTS) {
    if (t.id !== node.id && t.exclusive === node.exclusive && (talents[t.id] ?? 0) > 0) return t
  }
  return null
}

/** Réachabilité PAR ADJACENCE : voisin pris (OR), ou tous les `requiresAll` pris (convergence). */
export function isReachable(node: TalentNode, talents: Record<string, number>): boolean {
  if (node.requiresAll && node.requiresAll.length) return node.requiresAll.every((r) => (talents[r] ?? 0) > 0)
  const nb = [...(node.requires ?? []), ...(node.links ?? [])]
  if (nb.length === 0) return true
  return nb.some((r) => (talents[r] ?? 0) > 0)
}

/** Détail du verrouillage (pour l'UI). `need`/`spent` = porte de budget ; `exclusiveBlocked` = choix pris. */
export interface GateInfo {
  need: number
  spent: number
  exclusiveBlocked?: string
  /** RANG PRÉREQUIS non atteint : nom du nœud + rang requis + rang actuel (pour l'UI). */
  rankReq?: { name: string; need: number; have: number }
}
export function gateInfo(node: TalentNode, talents: Record<string, number>): GateInfo {
  const blk = exclusiveBlocker(node, talents)
  let rankReq: GateInfo['rankReq']
  if (node.requiresRank) {
    const have = talents[node.requiresRank.id] ?? 0
    if (have < node.requiresRank.rank) {
      rankReq = { name: BY_ID.get(node.requiresRank.id)?.name ?? node.requiresRank.id, need: node.requiresRank.rank, have }
    }
  }
  return {
    need: node.minSpent ?? 0,
    spent: node.minSpent ? spentInConstellation(talents, node.constellation) : 0,
    ...(blk ? { exclusiveBlocked: blk.name } : {}),
    ...(rankReq ? { rankReq } : {}),
  }
}

export function canAllocate(node: TalentNode, talents: Record<string, number>, points: number): boolean {
  if (points <= 0) return false
  if ((talents[node.id] ?? 0) >= node.maxRank) return false
  if (!isReachable(node, talents)) return false
  if (exclusiveBlocker(node, talents)) return false
  if (node.minSpent && spentInConstellation(talents, node.constellation) < node.minSpent) return false
  if (node.requiresRank && (talents[node.requiresRank.id] ?? 0) < node.requiresRank.rank) return false
  return true
}
