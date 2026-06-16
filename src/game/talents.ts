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
 */

export type ConstellationId =
  | 'coeur' | 'voleur' | 'assassin' | 'ombrelame'
  | 'mage' | 'pyromancien' | 'cryomancien' | 'arcaniste'
  | 'chasseur' | 'meute' | 'faucon'

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
type Opt = Partial<Pick<TalentNode, 'requires' | 'links' | 'requiresAll' | 'exclusive' | 'minSpent' | 'statMods' | 'resistMods' | 'unlockPower' | 'keystone'>>
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
node('cat_plaque', 'coeur', 'gateway', 1, 1, 'Plaque', 'Catégorie Plaque (Guerrier, Paladin, Chevalier de la mort). +40 Endurance, +15 Force. — classes à venir.', { requires: ['co_start'], statMods: { endurance: 40, force: 15 } })
node('cat_mailles', 'coeur', 'gateway', 1, 1, 'Mailles', 'Catégorie Mailles (Chasseur ✓, Chaman à venir). +20 Agilité, +20 Intelligence.', { requires: ['co_start'], statMods: { agilite: 20, intelligence: 20 } })
node('cat_cuir', 'coeur', 'gateway', 1, 1, 'Cuir', 'Catégorie Cuir (Voleur, Druide). +30 Agilité, +15 Critique.', { requires: ['co_start'], statMods: { agilite: 30, critique: 15 } })
node('cat_tissu', 'coeur', 'gateway', 1, 1, 'Tissu', 'Catégorie Tissu (Mage ✓, Démoniste & Prêtre à venir). +40 Intelligence.', { requires: ['co_start'], statMods: { intelligence: 40 } })

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
ability('as_dist', 'assassin', 4, 'Distillation', 'as_distillation', 'Débloque Distillation : DÉTONE tous les stacks de venin (pic = stacks × dégâts). Gatée : 6 pts dans la voie.', { requires: ['as_venmort'], minSpent: 6 })
ks('as_catalyse', 'assassin', 5, 'Catalyse', 'COMBO : ta Distillation DOUBLE le venin avant de détoner.', { stat: { penetration: 16 }, ks: { detonateDouble: true } }, { requires: ['as_dist'] })
ks('as_chain', 'assassin', 5, 'Réaction en chaîne', 'La détonation et tes DoT se propagent au pack (50%).', { stat: { penetration: 16 }, ks: { dotAoe: 0.5 } }, { requires: ['as_dist'] })
ability('as_peste', 'assassin', 6, 'Peste Souveraine', 'as_peste_souveraine', 'ULTIME — détonation cataclysmique de tout le venin. Tout au fond : 20 pts dans la voie.', { requires: ['as_chain'], minSpent: 20 })

// --- SAIGNEMENT (2e source de DoT) + CHOIX EXCLUSIF de 2e SORT ---
minor('as_lame', 'assassin', 1, 'Lames affûtées', 3, { critique: 18 }, { requires: ['as_hub'] })
ks('as_hemo', 'assassin', 2, 'Hémorragie vive', 'Tes coups ouvrent une plaie (DoT physique, 20% du coup/s, 5 s).', { stat: { alteration: 12 }, ks: { dot: { frac: 0.2, duration: 5 } } }, { requires: ['as_lame'] })
ks('as_beante', 'assassin', 3, 'Plaie béante', 'CHOIX : +12% de dégâts (saignements brutaux).', { ks: { damageMult: 1.12 } }, { requires: ['as_hemo'], exclusive: 'as_saign' })
ks('as_infect', 'assassin', 3, 'Plaie infectée', 'CHOIX : le saignement nourrit le venin (+intensité de stack).', { stat: { alteration: 10 }, ks: { poison: { perStack: 0.04, maxStacks: 0 } } }, { requires: ['as_hemo'], exclusive: 'as_saign' })
ability('as_garrot', 'assassin', 3, 'Garrot', 'as_garrot', 'CHOIX de SORT : étrangle (gros DoT mono) — soigne via tes drains. Gaté : 8 pts dans la voie.', { requires: ['as_hemo'], exclusive: 'as_arme2', minSpent: 8 })
ability('as_nuee', 'assassin', 3, 'Nuée toxique', 'as_nuee', 'CHOIX de SORT : un nuage de venin sur tout le pack. Gaté : 8 pts dans la voie.', { requires: ['as_hemo'], exclusive: 'as_arme2', minSpent: 8 })
ks('as_etrangle', 'assassin', 4, 'Étranglement', 'Tes finisseurs exécutent les ennemis sous 20% de PV (×2,2).', { ks: { executeBonus: { threshold: 0.2, mult: 2.2 } } }, { requires: ['as_garrot'] })
ks('as_spores', 'assassin', 4, 'Spores', 'Ta Nuée propage les altérations à tout le pack (50%).', { stat: { alteration: 14 }, ks: { dotAoe: 0.5 } }, { requires: ['as_nuee'] })

// --- DRAIN (SURVIE — profil poison/drain) ---
minor('as_sang', 'assassin', 1, 'Sangsue', 3, { volDeVie: 10 }, { requires: ['as_hub'] })
ks('as_vamp', 'assassin', 2, 'Vampirisme toxique', 'SURVIE : tes DoT te soignent (25% du tick). +20 Régén.', { stat: { regen: 20 }, ks: { dotLeech: 0.25 } }, { requires: ['as_sang'] })
ability('as_reprise', 'assassin', 2, 'Reprise', 'second_souffle', 'SURVIE : débloque Reprise (auto-soin) — pour tenir en solo dès le début.', { requires: ['as_sang'] })
ks('as_meta', 'assassin', 3, 'Métabolisme morbide', 'SURVIE : +30 Régén, +12 Vol de vie, -8% de dégâts subis.', { stat: { regen: 30, volDeVie: 12 }, ks: { flatDr: 0.08 } }, { requires: ['as_vamp'] })

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
ability('om_linceul', 'ombrelame', 5, 'Linceul', 'om_linceul', 'ULTIME — un finisseur dévastateur enveloppe la cible d\'ombre. Tout au fond : 20 pts dans la voie.', { requires: ['om_danse'], minSpent: 20 })

// --- FURTIVITÉ (SURVIE = esquive) + CHOIX EXCLUSIF d'ouverture ---
minor('om_cele', 'ombrelame', 1, 'Célérité', 3, { esquive: 18, hate: 8 }, { requires: ['om_hub'] })
ability('om_voile', 'ombrelame', 2, 'Voile d\'ombre', 'posture_defensive', 'SURVIE : débloque Voile d\'ombre (passif : -18% de dégâts subis).', { requires: ['om_cele'] })
ks('om_derob', 'ombrelame', 2, 'Dérobade', 'Tu frappes depuis l\'ombre : +12% de dégâts, +30 Esquive.', { stat: { esquive: 30 }, ks: { damageMult: 1.12 } }, { requires: ['om_cele'] })
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

/* ---- PYROMANCIEN — les crits EMBRASENT (DoT feu) ; Combustion = pic de feu. ----
 * 1 sort de départ. Pyroblast se mérite (derrière l'ignite). Ultime tout au fond. */
ability('py_hub', 'pyromancien', 0, 'Pyromancien', 'py_boule', 'Entre dans la voie du Pyromancien : débloque Boule de feu. +18 Intelligence, +12 Critique.', { requires: ['cl_mage'], statMods: { intelligence: 18, critique: 12 } })
// IGNITE : crits → Embrasement → Pyroblast (gaté) → Combustion → ultime.
minor('py_chaleur', 'pyromancien', 1, 'Chaleur ardente', 3, { critique: 18 }, { requires: ['py_hub'] })
ks('py_embrase', 'pyromancien', 2, 'Embrasement', 'Tes coups CRITIQUES posent un Embrasement (DoT feu = 30% du coup/s, 6 s). Amplifié par l\'Altération.', { stat: { alteration: 14 }, ks: { igniteOnCrit: { frac: 0.3, duration: 6 } } }, { requires: ['py_chaleur'] })
ks('py_fournaise', 'pyromancien', 3, 'Fournaise', 'CHOIX : Embrasement plus intense (+0,25 de frac par crit).', { stat: { alteration: 12 }, ks: { igniteOnCrit: { frac: 0.25, duration: 0 } } }, { requires: ['py_embrase'], exclusive: 'py_ignite' })
ks('py_etincelles', 'pyromancien', 3, 'Pluie d\'étincelles', 'CHOIX : tes sorts [dot] +12% (marche aussi pour les autres classes).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'dot', damageMult: 1.12 } } }, { requires: ['py_embrase'], exclusive: 'py_ignite' })
ability('py_pyroblast', 'pyromancien', 4, 'Pyroblast', 'py_pyroblast', 'Débloque Pyroblast : une frappe de feu colossale. Gatée : 6 pts dans la voie.', { requires: ['py_embrase'], minSpent: 6 })
ks('py_combustion', 'pyromancien', 5, 'Combustion', 'PIC : tes sorts [feu] +18% et ton Embrasement encore plus fort (+0,3 de frac).', { stat: { degatsCrit: 18 }, ks: { tagBonus: { tag: 'feu', damageMult: 1.18 }, igniteOnCrit: { frac: 0.3, duration: 0 } } }, { requires: ['py_pyroblast'] })
ability('py_meteore', 'pyromancien', 6, 'Météore', 'py_meteore', 'ULTIME — un météore pulvérise tout le pack. Tout au fond : 20 pts dans la voie.', { requires: ['py_combustion'], minSpent: 20 })
// FEU DIRECT : crit + tags, choix de 2e sort.
minor('py_braise', 'pyromancien', 1, 'Braises', 3, { degatsCrit: 18 }, { requires: ['py_hub'] })
ks('py_pyromanie', 'pyromancien', 2, 'Pyromanie', 'Tes sorts [direct] +12% (marche aussi pour les autres classes).', { stat: { critique: 14 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['py_braise'] })
ks('py_surchauffe', 'pyromancien', 3, 'Surchauffe', '+24 Critique, +24 Dégâts crit.', { stat: { critique: 24, degatsCrit: 24 } }, { requires: ['py_pyromanie'] })
ability('py_flammes', 'pyromancien', 3, 'Flammes incandescentes', 'py_flammes', 'CHOIX de SORT : un torrent de flammes sur tout le pack. Gaté : 8 pts dans la voie.', { requires: ['py_pyromanie'], exclusive: 'py_arme2', minSpent: 8 })
ability('py_immolation', 'pyromancien', 3, 'Immolation', 'py_immolation', 'CHOIX de SORT : embrase la cible (gros DoT mono soutenu). Gaté : 8 pts dans la voie.', { requires: ['py_pyromanie'], exclusive: 'py_arme2', minSpent: 8 })
// SURVIE : robe ignifugée.
minor('py_robe', 'pyromancien', 1, 'Robe ignifugée', 3, { regen: 16 }, { requires: ['py_hub'] })
ks('py_bouclierflam', 'pyromancien', 2, 'Bouclier de flammes', 'SURVIE : -8% de dégâts subis, +20 Régén, tes assaillants se brûlent (épines 10%).', { stat: { regen: 20 }, ks: { flatDr: 0.08, thorns: 0.1 } }, { requires: ['py_robe'] })
ability('py_souffle', 'pyromancien', 2, 'Second souffle', 'second_souffle', 'SURVIE : débloque Second souffle (auto-soin) pour tenir en solo.', { requires: ['py_robe'] })

/* ---- CRYOMANCIEN — gèle (contrôle) puis FRACASSE (shatter). ---- */
ability('cr_hub', 'cryomancien', 0, 'Cryomancien', 'cr_eclat', 'Entre dans la voie du Cryomancien : débloque Éclat de givre. +18 Intelligence, +12 Critique.', { requires: ['cl_mage'], statMods: { intelligence: 18, critique: 12 } })
// CONTRÔLE → SHATTER → Comète (gaté) → ultime.
minor('cr_froidure', 'cryomancien', 1, 'Froidure', 3, { intelligence: 16 }, { requires: ['cr_hub'] })
ability('cr_cone', 'cryomancien', 2, 'Cône de givre', 'cr_cone', 'Débloque Cône de givre : GÈLE tout le pack (contrôle) — la mise en place du fracas.', { requires: ['cr_froidure'] })
ks('cr_fracas', 'cryomancien', 3, 'Fracas', 'SHATTER : tes sorts infligent +20% contre une cible GELÉE/contrôlée.', { stat: { degatsCrit: 16 }, ks: { shatter: 0.2 } }, { requires: ['cr_cone'] })
ks('cr_glaciation', 'cryomancien', 4, 'Glaciation', 'SHATTER renforcé : +25% de plus contre les ennemis contrôlés.', { stat: { degatsCrit: 18 }, ks: { shatter: 0.25 } }, { requires: ['cr_fracas'] })
ability('cr_comete', 'cryomancien', 4, 'Comète de glace', 'cr_comete', 'Débloque Comète de glace : frappe colossale, dévastatrice sur cible gelée. Gatée : 6 pts dans la voie.', { requires: ['cr_fracas'], minSpent: 6 })
ability('cr_hiver', 'cryomancien', 6, 'Hiver éternel', 'cr_hiver', 'ULTIME — un blizzard gèle ET pulvérise tout le pack. Tout au fond : 20 pts dans la voie.', { requires: ['cr_glaciation'], minSpent: 20 })
// GIVRE : tags froid/direct + choix de 2e contrôle.
minor('cr_gelure', 'cryomancien', 1, 'Gelure', 3, { critique: 18 }, { requires: ['cr_hub'] })
ks('cr_givre', 'cryomancien', 2, 'Maîtrise du givre', 'Tes sorts [froid] +12% (marche aussi pour les autres classes).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'froid', damageMult: 1.12 } } }, { requires: ['cr_gelure'] })
ks('cr_perce', 'cryomancien', 3, 'Éclats perçants', 'Tes sorts [direct] +12% (marche aussi pour les autres classes).', { stat: { penetration: 16 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['cr_givre'] })
ability('cr_gangue', 'cryomancien', 3, 'Gangue de glace', 'cr_gangue', 'CHOIX de SORT : emprisonne une cible (contrôle mono long) pour la fracasser. Gaté : 8 pts dans la voie.', { requires: ['cr_givre'], exclusive: 'cr_arme2', minSpent: 8 })
ability('cr_nova', 'cryomancien', 3, 'Nova de givre', 'cr_nova', 'CHOIX de SORT : une nova gèle tout le pack autour de toi. Gaté : 8 pts dans la voie.', { requires: ['cr_givre'], exclusive: 'cr_arme2', minSpent: 8 })
// SURVIE : carapace de givre.
minor('cr_carapace', 'cryomancien', 1, 'Carapace de givre', 3, { barriere: 18 }, { requires: ['cr_hub'] })
ability('cr_barriere', 'cryomancien', 2, 'Barrière de glace', 'bouclier_runique', 'SURVIE : débloque Barrière de glace (bouclier d\'absorption).', { requires: ['cr_carapace'] })
ks('cr_frimas', 'cryomancien', 2, 'Frimas protecteur', 'SURVIE : +30 Esquive, -8% de dégâts subis (le froid ralentit tes assaillants).', { stat: { esquive: 30 }, ks: { flatDr: 0.08 } }, { requires: ['cr_carapace'] })

/* ---- ARCANISTE — « Charge des arcanes » : build/spend + surcharge (CDR/spam). ---- */
ability('ar_hub', 'arcaniste', 0, 'Arcaniste', 'ar_trait', 'Entre dans la voie de l\'Arcaniste : débloque Trait des arcanes (générateur de Charges des arcanes). +18 Intelligence, +12 Hâte.', { requires: ['cl_mage'], statMods: { intelligence: 18, hate: 12 } })
// GÉNÉRATION (charges).
minor('ar_etude', 'arcaniste', 1, 'Étude arcanique', 3, { hate: 16 }, { requires: ['ar_hub'] })
ks('ar_affinite', 'arcaniste', 1, 'Affinité arcanique', 'Tes sorts [arcane] +12% (marche aussi pour les autres classes).', { stat: { intelligence: 12 }, ks: { tagBonus: { tag: 'arcane', damageMult: 1.12 } } }, { requires: ['ar_etude'] })
ks('ar_flux', 'arcaniste', 2, 'Flux de mana', 'GÉNÉRATION : tes générateurs donnent +1 Charge des arcanes.', { stat: { hate: 16 }, ks: { comboGen: 1 } }, { requires: ['ar_etude'] })
ks('ar_resonance', 'arcaniste', 3, 'Résonance', 'CHOIX : +2 Charges max (surcharge plus haut).', { stat: { intelligence: 16 }, ks: { comboCap: 2 } }, { requires: ['ar_flux'], exclusive: 'ar_gen' })
ks('ar_cadence', 'arcaniste', 3, 'Cadence arcanique', 'CHOIX : +24 Hâte (incantation rapide et régulière).', { stat: { hate: 24 } }, { requires: ['ar_flux'], exclusive: 'ar_gen' })
// SURCHARGE (finisher) + spam/CDR.
ability('ar_deflag', 'arcaniste', 1, 'Déflagration des arcanes', 'ar_deflag', 'SURCHARGE : débloque Déflagration (finisseur — dégâts × Charges). +16 Intelligence.', { requires: ['ar_hub'], statMods: { intelligence: 16 } })
ks('ar_finamp', 'arcaniste', 2, 'Maîtrise des surcharges', 'Tes sorts [finisseur] +15% (marche aussi pour les autres classes).', { stat: { degatsCrit: 12 }, ks: { tagBonus: { tag: 'finisseur', damageMult: 1.15 } } }, { requires: ['ar_deflag'] })
ks('ar_surcharge', 'arcaniste', 2, 'Surcharge', 'Tes finisseurs frappent +25% plus fort.', { stat: { degatsCrit: 20 }, ks: { finisherMult: 0.25 } }, { requires: ['ar_deflag'] })
ks('ar_cascade', 'arcaniste', 3, 'Cascade temporelle', 'SPAM : chaque sort lancé rembourse 0,4 s de recharge à tes autres sorts.', { stat: { hate: 14 }, ks: { cdrOnCast: 0.4 } }, { requires: ['ar_surcharge'] })
// CONVERGENCE : exige Génération ET Surcharge.
ks('ar_apogee', 'arcaniste', 4, 'Apogée arcanique', 'IDENTITÉ (carrefour) : +2 Charges max et +15% de dégâts. Exige Flux de mana ET Surcharge.', { stat: { intelligence: 18 }, ks: { comboCap: 2, damageMult: 1.15 } }, { requiresAll: ['ar_flux', 'ar_surcharge'], minSpent: 8 })
ability('ar_singularite', 'arcaniste', 5, 'Singularité', 'ar_singularite', 'ULTIME — une singularité consume toutes tes Charges en une détonation arcanique. Tout au fond : 20 pts dans la voie.', { requires: ['ar_apogee'], minSpent: 20 })
// 2e SORT : choix exclusif (AoE vs anti-boss) + écho.
minor('ar_savoir', 'arcaniste', 1, 'Savoir interdit', 3, { critique: 16 }, { requires: ['ar_hub'] })
ks('ar_echo', 'arcaniste', 2, 'Écho des arcanes', 'COMBO : un finisseur te REND 2 Charges (spam de surcharges).', { stat: { hate: 14 }, ks: { comboRefund: 2 } }, { requires: ['ar_savoir'] })
ability('ar_orbe', 'arcaniste', 3, 'Orbe des arcanes', 'ar_orbe', 'CHOIX de SORT : un orbe instable balaie le pack (zone). Gaté : 8 pts dans la voie.', { requires: ['ar_savoir'], exclusive: 'ar_arme2', minSpent: 8 })
ability('ar_rupture', 'arcaniste', 3, 'Rupture des arcanes', 'ar_rupture', 'CHOIX de SORT : exécution arcane (amplifiée par les PV manquants). Gaté : 8 pts dans la voie.', { requires: ['ar_savoir'], exclusive: 'ar_arme2', minSpent: 8 })
// SURVIE : voile arcanique.
minor('ar_voile', 'arcaniste', 1, 'Voile arcanique', 3, { barriere: 18 }, { requires: ['ar_hub'] })
ability('ar_barriere', 'arcaniste', 2, 'Bouclier des arcanes', 'bouclier_runique', 'SURVIE : débloque Bouclier des arcanes (absorption).', { requires: ['ar_voile'] })
ks('ar_clignement', 'arcaniste', 2, 'Clignement', 'SURVIE : +30 Esquive, +18 Récupération (tu te téléportes hors de danger).', { stat: { esquive: 30, recuperation: 18 } }, { requires: ['ar_voile'] })

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
ks('me_meute', 'meute', 3, 'Meute', 'INVOCATION : un second fauve te rejoint (+30% de plus).', { stat: { agilite: 14 }, ks: { petDps: 0.3 } }, { requires: ['me_familier'] })
ks('me_frenesie', 'meute', 4, 'Frénésie de meute', 'CHOIX : la meute enrage — +0,2 DPS de familier ET +12% de tes dégâts.', { stat: { hate: 16 }, ks: { petDps: 0.2, damageMult: 1.12 } }, { requires: ['me_meute'], exclusive: 'me_pet' })
ks('me_alpha', 'meute', 4, 'Instinct alpha', 'CHOIX : +0,35 DPS de familier (meute massive).', { stat: { agilite: 16 }, ks: { petDps: 0.35 } }, { requires: ['me_meute'], exclusive: 'me_pet' })
ability('me_curee', 'meute', 6, 'Curée sauvage', 'me_curee', 'ULTIME — toute la meute déferle sur le pack. Tout au fond : 20 pts dans la voie.', { requires: ['me_meute'], minSpent: 20 })
// TRAQUE : frappes bestiales (tags) + choix de 2e sort.
minor('me_griffes', 'meute', 1, 'Griffes acérées', 3, { critique: 18 }, { requires: ['me_hub'] })
ks('me_nature', 'meute', 2, 'Appel de la nature', 'Tes sorts [nature] +12% (marche aussi pour les autres classes).', { stat: { alteration: 12 }, ks: { tagBonus: { tag: 'nature', damageMult: 1.12 } } }, { requires: ['me_griffes'] })
ks('me_coordination', 'meute', 3, 'Coordination', 'Tes sorts [direct] +12% (marche aussi pour les autres classes).', { stat: { critique: 14 }, ks: { tagBonus: { tag: 'direct', damageMult: 1.12 } } }, { requires: ['me_nature'] })
ability('me_morsure', 'meute', 3, 'Morsure du fauve', 'me_morsure', 'CHOIX de SORT : une morsure dévastatrice mono-cible. Gaté : 8 pts dans la voie.', { requires: ['me_nature'], exclusive: 'me_arme2', minSpent: 8 })
ability('me_saignee', 'meute', 3, 'Saignée bestiale', 'me_saignee', 'CHOIX de SORT : des plaies de fauve qui saignent (DoT). Gaté : 8 pts dans la voie.', { requires: ['me_nature'], exclusive: 'me_arme2', minSpent: 8 })
// SURVIE : lien au familier.
minor('me_endurci', 'meute', 1, 'Cuir épais', 3, { regen: 16 }, { requires: ['me_hub'] })
ks('me_symbiose', 'meute', 2, 'Symbiose', 'SURVIE : ton familier te protège — -10% de dégâts subis, +12 Vol de vie.', { stat: { volDeVie: 12 }, ks: { flatDr: 0.1 } }, { requires: ['me_endurci'] })
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
// CONVERGENCE + ULTIME.
ks('fa_oeil', 'faucon', 4, 'Œil du faucon', 'IDENTITÉ (carrefour) : +2 Concentration max et +15% de dégâts. Exige Respiration ET Létalité.', { stat: { precision: 18 }, ks: { comboCap: 2, damageMult: 1.15 } }, { requiresAll: ['fa_respire', 'fa_letalite'], minSpent: 8 })
ability('fa_aigle', 'faucon', 5, 'Tir de l\'aigle', 'fa_aigle', 'ULTIME — un tir parfait qui consume toute ta Concentration. Tout au fond : 20 pts dans la voie.', { requires: ['fa_oeil'], minSpent: 20 })
// 2e SORT : choix exclusif (AoE vs exécution).
minor('fa_pisteur', 'faucon', 1, 'Pisteur', 3, { critique: 18 }, { requires: ['fa_hub'] })
ks('fa_precis', 'faucon', 2, 'Précision létale', '+24 Critique, +24 Dégâts crit.', { stat: { critique: 24, degatsCrit: 24 } }, { requires: ['fa_pisteur'] })
ability('fa_salve', 'faucon', 3, 'Salve de flèches', 'fa_salve', 'CHOIX de SORT : une volée qui balaie le pack (zone). Gaté : 8 pts dans la voie.', { requires: ['fa_pisteur'], exclusive: 'fa_arme2', minSpent: 8 })
ability('fa_mortel', 'faucon', 3, 'Tir mortel', 'fa_mortel', 'CHOIX de SORT : exécution mono (amplifiée par les PV manquants). Gaté : 8 pts dans la voie.', { requires: ['fa_pisteur'], exclusive: 'fa_arme2', minSpent: 8 })
// SURVIE : camouflage.
minor('fa_camo', 'faucon', 1, 'Camouflage', 3, { esquive: 18 }, { requires: ['fa_hub'] })
ability('fa_posture', 'faucon', 2, 'Posture défensive', 'posture_defensive', 'SURVIE : débloque Posture défensive (-18% de dégâts subis).', { requires: ['fa_camo'] })
ks('fa_retraite', 'faucon', 2, 'Retraite feinte', 'SURVIE : +30 Esquive, +12% de dégâts (tu frappes en reculant).', { stat: { esquive: 30 }, ks: { damageMult: 1.12 } }, { requires: ['fa_camo'] })

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
}
export const CONSTELLATION_LIST: ConstellationId[] = [
  'coeur', 'voleur', 'assassin', 'ombrelame',
  'mage', 'pyromancien', 'cryomancien', 'arcaniste',
  'chasseur', 'meute', 'faucon',
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
}
export function gateInfo(node: TalentNode, talents: Record<string, number>): GateInfo {
  const blk = exclusiveBlocker(node, talents)
  return {
    need: node.minSpent ?? 0,
    spent: node.minSpent ? spentInConstellation(talents, node.constellation) : 0,
    ...(blk ? { exclusiveBlocked: blk.name } : {}),
  }
}

export function canAllocate(node: TalentNode, talents: Record<string, number>, points: number): boolean {
  if (points <= 0) return false
  if ((talents[node.id] ?? 0) >= node.maxRank) return false
  if (!isReachable(node, talents)) return false
  if (exclusiveBlocker(node, talents)) return false
  if (node.minSpent && spentInConstellation(talents, node.constellation) < node.minSpent) return false
  return true
}
