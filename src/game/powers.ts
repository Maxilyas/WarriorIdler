import type { PowerDef, PowerEffect, DamageType, OffensiveStat } from './types'
import type { SpellSpec } from './classData'

/**
 * Registre des capacités équipables (powers).
 *
 * Le RÔLE émerge des capacités équipées + du stuff. Les capacités se débloquent
 * désormais UNIQUEMENT via l'arbre de talents (nœuds `ability`) — voir talents.ts.
 *
 * Familles :
 * - PASSIVES : effet continu (menace, réduction de dégâts, bonus de stats).
 * - ACTIVES : auto-lancées sur cooldown en combat idle ; scalent sur une stat précise
 *   (`scaleStat` : sort=INT, frappe=FOR, finesse=AGI). La Récupération réduit leur cooldown.
 *
 * Ajouter une capacité = ajouter une entrée ici + un nœud `ability` qui la débloque.
 */
export const POWERS: PowerDef[] = [
  // --- Capacité de départ (débloquée par le nœud Cœur « Éveil ») ---
  {
    id: 'frappe_simple', name: 'Frappe', kind: 'active',
    description: 'Un coup d\'arme rapide. Scale FOR/AGI (la meilleure).',
    unlockLevel: 1, cooldown: 3, effect: 'nuke', magnitude: 2.2, scaleStats: ['force', 'agilite'],
  },

  // --- Berserker (Force / mêlée) ---
  {
    id: 'frappe_lourde', name: 'Frappe lourde', kind: 'active',
    description: 'Assène un coup dévastateur. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 3.5, effect: 'nuke', magnitude: 4.4, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'tourbillon', name: 'Tourbillon', kind: 'active',
    description: 'Frappe lourde répétée à fort dégât. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 2.5, effect: 'cleave', magnitude: 2.8, scaleStats: ['force', 'agilite'],
  },

  // --- Rôdeur (Agilité / furtivité) ---
  {
    id: 'tir_precis', name: 'Tir précis', kind: 'active',
    description: 'Un tir visant les points vitaux. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 2.5, effect: 'nuke', magnitude: 3.4, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'poison', name: 'Lames empoisonnées', kind: 'active',
    description: 'Empoisonne l\'ennemi (DoT). Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 4, effect: 'dot', magnitude: 1.4, scaleStats: ['force', 'agilite'],
  },

  // --- Arcaniste (Intelligence / sorts) ---
  {
    id: 'eclair', name: 'Éclair arcanique', kind: 'active',
    description: 'Décharge d\'arcane. Scale INT.',
    unlockLevel: 1, cooldown: 2.5, effect: 'nuke', magnitude: 3.8, scaleStat: 'intelligence', damageType: 'arcane',
  },
  {
    id: 'embrasement', name: 'Embrasement', kind: 'active',
    description: 'Enflamme l\'ennemi (DoT de feu). Scale INT.',
    unlockLevel: 1, cooldown: 5, effect: 'dot', magnitude: 1.8, scaleStat: 'intelligence', damageType: 'feu',
  },

  // --- Bastion (tank) ---
  {
    id: 'provocation', name: 'Provocation', kind: 'passive',
    description: 'Génère beaucoup plus de menace : attire les attaques ennemies.',
    unlockLevel: 1, threatMult: 4, mods: { endurance: 40, reductionDegats: 20 },
  },
  {
    id: 'bouclier_runique', name: 'Bouclier runique', kind: 'active',
    description: 'Érige un bouclier d\'absorption sur le porteur. Scale sur ta stat principale OU ton Endurance (la meilleure).',
    unlockLevel: 1, cooldown: 6, effect: 'shield', magnitude: 3,
  },

  // --- Défensives TRANSVERSES (accessibles hors Bastion/Oracle, scalent sur la stat principale) ---
  {
    id: 'second_souffle', name: 'Second souffle', kind: 'active',
    description: 'Reprends ton souffle : soigne une grosse part de tes PV. Scale sur ta stat principale.',
    unlockLevel: 1, cooldown: 9, effect: 'heal', magnitude: 4,
  },
  {
    id: 'posture_defensive', name: 'Posture défensive', kind: 'passive',
    description: 'Garde haute : -18% de dégâts subis et +40 Endurance tant qu\'elle est équipée.',
    unlockLevel: 1, damageReduction: 0.18, mods: { endurance: 40 },
  },

  // --- Oracle (soin) ---
  {
    id: 'vague_de_soin', name: 'Vague de soin', kind: 'active',
    description: 'Soigne périodiquement l\'allié le plus blessé. Scale INT.',
    unlockLevel: 1, cooldown: 4, effect: 'heal', magnitude: 1.4, scaleStat: 'intelligence',
  },
  {
    id: 'guerison_majeure', name: 'Guérison majeure', kind: 'active',
    description: 'Soin puissant de l\'allié le plus blessé. Scale INT.',
    unlockLevel: 1, cooldown: 5, effect: 'heal', magnitude: 2.8, scaleStat: 'intelligence',
  },

  // --- Capacités d'archétypes / nœuds avancés ---
  {
    id: 'laceration', name: 'Lacération', kind: 'active',
    description: 'Ouvre des plaies béantes (DoT). Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 4.5, effect: 'dot', magnitude: 2.2, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'choc_sismique', name: 'Choc sismique', kind: 'active',
    description: 'Frappe le sol, dégâts massifs. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 4, effect: 'cleave', magnitude: 4.2, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'volee_de_fleches', name: 'Volée de flèches', kind: 'active',
    description: 'Une pluie de traits rapides. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 3, effect: 'cleave', magnitude: 3, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'eviscaration', name: 'Éviscération', kind: 'active',
    description: 'Coup mortel sur cible affaiblie. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 3.5, effect: 'nuke', magnitude: 5, scaleStats: ['force', 'agilite'],
  },
  // --- Archétypes v0.24 ---
  {
    id: 'arc_voltaique', name: 'Arc voltaïque', kind: 'active',
    description: 'Un éclair qui saute de cible en cible. Scale AGI/INT (la meilleure).',
    unlockLevel: 1, cooldown: 3.2, effect: 'cleave', magnitude: 3.0, scaleStats: ['agilite', 'intelligence'], damageType: 'foudre',
  },
  {
    id: 'fracture_temporelle', name: 'Fracture du temps', kind: 'active',
    description: 'Brise un instant en deux : lourde frappe d\'arcane. Scale INT.',
    unlockLevel: 1, cooldown: 6, effect: 'nuke', magnitude: 5.2, scaleStat: 'intelligence', damageType: 'arcane',
  },
  {
    id: 'embuscade', name: 'Embuscade', kind: 'active',
    description: 'Un coup d\'ouverture dévastateur — frappe pendant ta fenêtre d\'ouverture pour le maximum. Scale AGI.',
    unlockLevel: 1, cooldown: 12, effect: 'nuke', magnitude: 7.5, scaleStat: 'agilite',
  },
  {
    id: 'trait_de_givre', name: 'Trait de givre', kind: 'active',
    description: 'Éclat de glace perçant. Scale INT.',
    unlockLevel: 1, cooldown: 2.8, effect: 'cleave', magnitude: 3.4, scaleStat: 'intelligence', damageType: 'froid',
  },
  {
    id: 'salve_arcanique', name: 'Salve arcanique', kind: 'active',
    description: 'Déchaîne une rafale d\'arcane. Scale INT.',
    unlockLevel: 1, cooldown: 3.2, effect: 'cleave', magnitude: 3.8, scaleStat: 'intelligence', damageType: 'arcane',
  },
  {
    id: 'chatiment', name: 'Châtiment sacré', kind: 'active',
    description: 'Foudroie l\'ennemi d\'une lumière punitive. Scale INT.',
    unlockLevel: 1, cooldown: 3, effect: 'nuke', magnitude: 4.4, scaleStat: 'intelligence', damageType: 'arcane',
  },
  {
    id: 'imposition_des_mains', name: 'Imposition des mains', kind: 'active',
    description: 'Soin sacré puissant de tout le groupe. Scale INT.',
    unlockLevel: 1, cooldown: 6, effect: 'buffParty', magnitude: 1.8, scaleStat: 'intelligence',
  },
  {
    id: 'fleau_dombre', name: 'Fléau d\'ombre', kind: 'active',
    description: 'Une affliction qui ronge (DoT d\'ombre). Scale INT.',
    unlockLevel: 1, cooldown: 4.5, effect: 'dot', magnitude: 2.6, scaleStat: 'intelligence', damageType: 'ombre',
  },

  // --- Cœur (tronc commun) : capacité polyvalente précoce ---
  {
    id: 'onde_de_force', name: 'Onde de force', kind: 'active',
    description: 'Une déflagration concentrique qui frappe tout le pack. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 3.2, effect: 'cleave', magnitude: 2.4, scaleStats: ['force', 'agilite'],
  },

  // --- Bourreau (Force / anti-boss & exécution) ---
  {
    id: 'decapitation', name: 'Décapitation', kind: 'active',
    description: 'Un coup de hache fatal qui décapite les cibles affaiblies. Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 3.5, effect: 'nuke', magnitude: 5, scaleStats: ['force', 'agilite'],
  },

  // ================= ULTIMES (v0.19) : sorts surpuissants à long cooldown =================
  {
    id: 'verdict', name: 'Verdict', kind: 'active',
    description: 'Une sentence dévastatrice : +250% de dégâts selon les PV MANQUANTS de la cible (finisher anti-boss). Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 12, effect: 'executeNuke', magnitude: 4, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'soif_du_neant', name: 'Soif du néant', kind: 'active',
    description: 'Une frappe d\'ombre colossale qui te rend 60% des dégâts en vie (build solo). Scale FOR/AGI.',
    unlockLevel: 1, cooldown: 14, effect: 'lifeNuke', magnitude: 6, scaleStats: ['force', 'agilite'], damageType: 'ombre',
  },
  {
    id: 'deluge_stellaire', name: 'Déluge stellaire', kind: 'active',
    description: 'Un cataclysme d\'arcane qui pulvérise TOUT le pack d\'un coup énorme. Scale INT.',
    unlockLevel: 1, cooldown: 20, effect: 'megaCleave', magnitude: 7, scaleStat: 'intelligence', damageType: 'arcane',
  },
  {
    id: 'aube_salvatrice', name: 'Aube salvatrice', kind: 'active',
    description: 'Une vague de lumière qui rend une énorme quantité de PV à TOUT le groupe. Scale INT.',
    unlockLevel: 1, cooldown: 24, effect: 'bigHeal', magnitude: 12, scaleStat: 'intelligence',
  },
  {
    id: 'hemorragie_cosmique', name: 'Hémorragie cosmique', kind: 'active',
    description: 'Ouvre une plaie béante : BRISE la régénération ennemie 8 s et inflige un DoT massif (amplifié par l\'Altération). Scale INT.',
    unlockLevel: 1, cooldown: 16, effect: 'rupture', magnitude: 8, duration: 8, scaleStat: 'intelligence', damageType: 'ombre',
  },
  {
    id: 'egide_titanesque', name: 'Égide titanesque', kind: 'active',
    description: 'Érige un ÉNORME bouclier d\'absorption sur toi (et 40% à l\'équipe), soaké avant tes PV. Long cooldown. Scale sur ta stat principale OU ton Endurance (la meilleure).',
    unlockLevel: 1, cooldown: 30, effect: 'bigShield', magnitude: 14,
  },
  {
    id: 'phase_etheree', name: 'Phase éthérée', kind: 'active',
    description: 'Tu deviens immatériel : immunité TOTALE aux dégâts directs pendant 2 s (absorbe l\'attaque la plus mortelle).',
    unlockLevel: 1, cooldown: 28, effect: 'invuln', magnitude: 0, duration: 2, scaleStat: 'intelligence',
  },
  {
    id: 'vengeance_differee', name: 'Vengeance différée', kind: 'active',
    description: 'Pendant 5 s, enregistre tous tes dégâts ; à l\'issue, frappe une fois pour ×3 le total accumulé.',
    unlockLevel: 1, cooldown: 18, effect: 'charge', magnitude: 3, duration: 5, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'furie_sanguinaire', name: 'Furie sanguinaire', kind: 'active',
    description: 'Tu entres en transe : +100% de tous tes dégâts pendant 6 s.',
    unlockLevel: 1, cooldown: 22, effect: 'frenzy', magnitude: 2, duration: 6, scaleStats: ['force', 'agilite'],
  },
  {
    id: 'sceau_faiblesse', name: 'Sceau de faiblesse', kind: 'active',
    description: 'Marque la cible : elle subit +45% de TOUS les dégâts (auto-attaques et sorts) pendant 8 s. Scale INT.',
    unlockLevel: 1, cooldown: 20, effect: 'mark', magnitude: 1.45, duration: 8, scaleStat: 'intelligence',
  },

  /* ================= v0.29 : signatures des 36 noyaux de classe ================= */
  // -- DPS mêlée / agilité --
  { id: 'griffes_meute', name: 'Griffes de la meute', kind: 'active', description: 'Ton familier lacère le pack (DPS passif idéal en idle). Scale ta stat principale.', unlockLevel: 1, cooldown: 3, effect: 'cleave', magnitude: 3.0, damageType: 'nature' },
  { id: 'saignement_sauvage', name: 'Saignement sauvage', kind: 'active', description: 'Des plaies de fauve qui saignent (DoT nature). Scale AGI.', unlockLevel: 1, cooldown: 4, effect: 'dot', magnitude: 2.4, scaleStat: 'agilite', damageType: 'nature' },
  { id: 'piege_explosif', name: 'Piège explosif', kind: 'active', description: 'Un piège qui déchire le pack (zone nature). Scale AGI.', unlockLevel: 1, cooldown: 3.5, effect: 'cleave', magnitude: 2.8, scaleStat: 'agilite', damageType: 'nature' },
  { id: 'paume_du_tigre', name: 'Paume du tigre', kind: 'active', description: 'Une frappe d\'art martial fulgurante. Scale AGI.', unlockLevel: 1, cooldown: 2.5, effect: 'nuke', magnitude: 3.2, scaleStat: 'agilite' },
  { id: 'lame_du_chaos', name: 'Lame du chaos', kind: 'active', description: 'Un assaut démoniaque qui balaie le pack (feu/chaos). Scale AGI.', unlockLevel: 1, cooldown: 2.8, effect: 'cleave', magnitude: 3.4, scaleStat: 'agilite', damageType: 'feu' },
  // -- DPS sorts --
  { id: 'boule_de_feu', name: 'Boule de feu', kind: 'active', description: 'Un projectile incandescent. Scale INT.', unlockLevel: 1, cooldown: 2.8, effect: 'nuke', magnitude: 3.8, scaleStat: 'intelligence', damageType: 'feu' },
  { id: 'eclat_de_glace', name: 'Éclat de glace', kind: 'active', description: 'Des éclats gelés qui transpercent (froid). Scale INT.', unlockLevel: 1, cooldown: 2.8, effect: 'cleave', magnitude: 3.4, scaleStat: 'intelligence', damageType: 'froid' },
  { id: 'nuee_demoniaque', name: 'Nuée démoniaque', kind: 'active', description: 'Tes démons assaillent le pack (DPS passif idle). Scale INT.', unlockLevel: 1, cooldown: 3.2, effect: 'cleave', magnitude: 3.0, scaleStat: 'intelligence', damageType: 'ombre' },
  { id: 'ruine', name: 'Ruine', kind: 'active', description: 'Une décharge de chaos dévastatrice. Scale INT.', unlockLevel: 1, cooldown: 3, effect: 'nuke', magnitude: 4.4, scaleStat: 'intelligence', damageType: 'feu' },
  { id: 'fulguration', name: 'Fulguration', kind: 'active', description: 'La foudre des éléments frappe le pack. Scale INT.', unlockLevel: 1, cooldown: 3, effect: 'cleave', magnitude: 3.6, scaleStat: 'intelligence', damageType: 'foudre' },
  { id: 'souffle_ardent', name: 'Souffle ardent', kind: 'active', description: 'Un souffle draconique à charge. Scale INT.', unlockLevel: 1, cooldown: 4, effect: 'nuke', magnitude: 5.0, scaleStat: 'intelligence', damageType: 'feu' },
  { id: 'mot_de_lombre', name: 'Mot de l\'ombre', kind: 'active', description: 'Une affliction mentale qui ronge (DoT ombre). Scale INT.', unlockLevel: 1, cooldown: 4.5, effect: 'dot', magnitude: 2.6, scaleStat: 'intelligence', damageType: 'ombre' },
  // -- Tanks --
  { id: 'coup_runique', name: 'Coup runique', kind: 'active', description: 'Une frappe de givre-sang qui te soigne. Scale FOR.', unlockLevel: 1, cooldown: 3.5, effect: 'lifeNuke', magnitude: 3.0, scaleStat: 'force', damageType: 'ombre' },
  { id: 'lacere_chaos', name: 'Lacération du chaos', kind: 'active', description: 'Tu happes le pack et draines leur vie (feu). Scale AGI.', unlockLevel: 1, cooldown: 3, effect: 'cleave', magnitude: 2.8, scaleStat: 'agilite', damageType: 'feu' },
  // -- Heals (dont non-INT : scale sur la stat dominante) --
  { id: 'rajeunissement', name: 'Rajeunissement', kind: 'active', description: 'Un soin sur la durée (HoT) sur l\'allié blessé. Scale INT.', unlockLevel: 1, cooldown: 4, effect: 'hot', magnitude: 1.8, scaleStat: 'intelligence' },
  { id: 'songe_emeraude', name: 'Songe d\'émeraude', kind: 'active', description: 'Un soin à charge qui restaure tout le groupe. Scale INT.', unlockLevel: 1, cooldown: 5, effect: 'buffParty', magnitude: 1.8, scaleStat: 'intelligence' },
  { id: 'lumiere_sacree', name: 'Lumière sacrée', kind: 'active', description: 'Un soin puissant nourri par tes attaques. Scale sur ta stat principale (soin FORCE possible).', unlockLevel: 1, cooldown: 3.5, effect: 'heal', magnitude: 2.8 },
  { id: 'brume_revigorante', name: 'Brume revigorante', kind: 'active', description: 'Frapper diffuse une brume qui soigne (fistweaving). Scale sur ta stat principale (soin AGI possible).', unlockLevel: 1, cooldown: 3, effect: 'heal', magnitude: 1.8 },
]

/* ================= v0.29.1 : sorts GÉNÉRÉS depuis classData (39 specs × 3) ================= */
const EFFECT_FR: Record<PowerEffect, string> = {
  nuke: 'frappe directe', cleave: 'frappe de zone', dot: 'altération sur la durée',
  heal: 'soin', hot: 'soin sur la durée', shield: 'bouclier', buffParty: 'soin de groupe',
  bigShield: 'bouclier massif', invuln: 'immunité brève', charge: 'charge puis frappe ×3',
  frenzy: 'transe (+dégâts)', executeNuke: 'exécution (PV manquants)', megaCleave: 'cataclysme de zone',
  bigHeal: 'soin massif de groupe', lifeNuke: 'frappe vampirique', rupture: 'brise-régén + DoT',
  mark: 'vulnérabilité',
  poison: 'venin cumulatif (+1 stack)', detonate: 'détonation des stacks de venin',
  builder: 'générateur (+1 Point de Combo)', finisher: 'finisseur (× Points de Combo)',
}
const SCALE_FR: Record<OffensiveStat, string> = { force: 'FOR', agilite: 'AGI', intelligence: 'INT' }
function spellDescription(s: SpellSpec): string {
  const scale = Array.isArray(s.scale) ? s.scale.map((x) => SCALE_FR[x]).join('/') : s.scale ? SCALE_FR[s.scale] : 'stat principale'
  const t = s.type ? ` ${s.type}` : ''
  return `${EFFECT_FR[s.effect]}${t}. Scale ${scale}.`
}
function specToPower(s: SpellSpec): PowerDef {
  const scaleStats = Array.isArray(s.scale) ? s.scale : undefined
  const scaleStat = !Array.isArray(s.scale) ? s.scale : undefined
  return {
    id: s.id, name: s.name, kind: 'active', description: spellDescription(s),
    unlockLevel: 1, cooldown: s.cd, effect: s.effect, magnitude: s.mag,
    ...(s.type ? { damageType: s.type } : {}),
    ...(scaleStats ? { scaleStats } : {}),
    ...(scaleStat ? { scaleStat } : {}),
    ...(s.duration ? { duration: s.duration } : {}),
    ...(s.icon ? { icon: s.icon } : {}),
    ...(s.tags ? { tags: s.tags } : {}),
    ...(s.resource ? { resource: s.resource } : {}),
  }
}
/* Sorts du VOLEUR (handcrafted). Catégorie Cuir → Assassin (venin) + Ombrelame (combo/ombre). */
const VOLEUR_SPELLS: SpellSpec[] = [
  // Classe
  { id: 'vo_tranchant', name: 'Tranchant', icon: '🗡', effect: 'nuke', mag: 2.4, cd: 3, scale: ['force', 'agilite'], tags: ['mono', 'direct'] },
  // Assassin (venin)
  { id: 'as_lame_enduite', name: 'Lame enduite', icon: '🧪', effect: 'poison', mag: 1.2, cd: 3, type: 'nature', scale: ['force', 'agilite'], tags: ['mono', 'dot'] },
  { id: 'as_distillation', name: 'Distillation', icon: '💧', effect: 'detonate', mag: 0.55, cd: 8, type: 'nature', scale: ['force', 'agilite'], tags: ['mono', 'finisseur'] },
  { id: 'as_garrot', name: 'Garrot', icon: '🪢', effect: 'dot', mag: 2.4, cd: 6, type: 'physique', scale: ['force', 'agilite'], tags: ['mono', 'dot', 'soin'] },
  { id: 'as_nuee', name: 'Nuée toxique', icon: '☁️', effect: 'poison', mag: 1.0, cd: 5, type: 'nature', scale: ['force', 'agilite'], tags: ['zone', 'dot'] },
  { id: 'as_peste_souveraine', name: 'Peste Souveraine', icon: '☠️', effect: 'detonate', mag: 1.1, cd: 18, type: 'nature', scale: ['force', 'agilite'], tags: ['zone', 'finisseur', 'ultime'] },
  // Ombrelame (combo / ombre)
  { id: 'om_frappe_sournoise', name: 'Frappe sournoise', icon: '🗡', effect: 'builder', mag: 1.5, cd: 2.5, scale: 'agilite', tags: ['mono', 'direct', 'generateur'] },
  { id: 'om_eviscaration', name: 'Éviscération', icon: '🔪', effect: 'finisher', mag: 1.4, cd: 3.5, type: 'ombre', scale: 'agilite', tags: ['mono', 'direct', 'finisseur'] },
  { id: 'om_embuscade', name: 'Embuscade', icon: '💨', effect: 'nuke', mag: 7.5, cd: 12, type: 'ombre', scale: 'agilite', tags: ['mono', 'direct', 'furtif'] },
  { id: 'om_eventail', name: 'Éventail de couteaux', icon: '🔪', effect: 'finisher', mag: 1.0, cd: 4, type: 'physique', scale: 'agilite', tags: ['zone', 'direct', 'finisseur'] },
  { id: 'om_linceul', name: 'Linceul', icon: '🌑', effect: 'finisher', mag: 2.6, cd: 22, type: 'ombre', scale: 'agilite', tags: ['mono', 'direct', 'finisseur', 'ultime'] },
]
for (const s of VOLEUR_SPELLS) POWERS.push(specToPower(s))

/* Sorts du MAGE (handcrafted). Tissu → Pyromancien (feu/ignite) + Cryomancien (givre/contrôle/shatter)
 * + Arcaniste (Charge des arcanes : build/spend + CDR). 3 specs DPS très distinctes. */
const MAGE_SPELLS: SpellSpec[] = [
  // Classe
  { id: 'ma_eclair', name: 'Trait magique', icon: '🔮', effect: 'nuke', mag: 2.6, cd: 2.8, type: 'arcane', scale: 'intelligence', tags: ['mono', 'direct', 'arcane'] },
  // Pyromancien (feu — les crits embrasent)
  { id: 'py_boule', name: 'Boule de feu', icon: '🔥', effect: 'nuke', mag: 3.0, cd: 2.8, type: 'feu', scale: 'intelligence', tags: ['mono', 'direct', 'feu'] },
  { id: 'py_pyroblast', name: 'Pyroblast', icon: '☄️', effect: 'nuke', mag: 5.6, cd: 6, type: 'feu', scale: 'intelligence', tags: ['mono', 'direct', 'feu'] },
  { id: 'py_flammes', name: 'Flammes incandescentes', icon: '🌋', effect: 'cleave', mag: 3.2, cd: 3, type: 'feu', scale: 'intelligence', tags: ['zone', 'direct', 'feu'] },
  { id: 'py_immolation', name: 'Immolation', icon: '♨️', effect: 'dot', mag: 2.6, cd: 4.5, type: 'feu', scale: 'intelligence', tags: ['mono', 'dot', 'feu'] },
  { id: 'py_meteore', name: 'Météore', icon: '💢', effect: 'megaCleave', mag: 7, cd: 20, type: 'feu', scale: 'intelligence', tags: ['zone', 'direct', 'feu', 'ultime'] },
  // Cryomancien (givre — gèle puis fracasse)
  { id: 'cr_eclat', name: 'Éclat de givre', icon: '🧊', effect: 'nuke', mag: 3.0, cd: 2.6, type: 'froid', scale: 'intelligence', tags: ['mono', 'direct', 'froid'] },
  { id: 'cr_cone', name: 'Cône de givre', icon: '❄️', effect: 'cleave', mag: 2.6, cd: 5, duration: 4, type: 'froid', scale: 'intelligence', tags: ['zone', 'direct', 'froid', 'controle'] },
  { id: 'cr_comete', name: 'Comète de glace', icon: '☄️', effect: 'nuke', mag: 5.6, cd: 6, type: 'froid', scale: 'intelligence', tags: ['mono', 'direct', 'froid'] },
  { id: 'cr_gangue', name: 'Gangue de glace', icon: '🥶', effect: 'nuke', mag: 1.6, cd: 8, duration: 5, type: 'froid', scale: 'intelligence', tags: ['mono', 'direct', 'froid', 'controle'] },
  { id: 'cr_nova', name: 'Nova de givre', icon: '💠', effect: 'cleave', mag: 3.0, cd: 6, duration: 3, type: 'froid', scale: 'intelligence', tags: ['zone', 'direct', 'froid', 'controle'] },
  { id: 'cr_hiver', name: 'Hiver éternel', icon: '🌨️', effect: 'megaCleave', mag: 7, cd: 22, duration: 4, type: 'froid', scale: 'intelligence', tags: ['zone', 'direct', 'froid', 'controle', 'ultime'] },
  // Arcaniste (Charge des arcanes — build/spend + surcharge/CDR)
  { id: 'ar_trait', name: 'Trait des arcanes', icon: '🔹', effect: 'builder', mag: 1.6, cd: 2.5, type: 'arcane', scale: 'intelligence', tags: ['mono', 'direct', 'arcane', 'generateur'], resource: 'Charge des arcanes' },
  { id: 'ar_deflag', name: 'Déflagration des arcanes', icon: '🔷', effect: 'finisher', mag: 1.5, cd: 3.5, type: 'arcane', scale: 'intelligence', tags: ['mono', 'direct', 'arcane', 'finisseur'], resource: 'Charge des arcanes' },
  { id: 'ar_orbe', name: 'Orbe des arcanes', icon: '🟣', effect: 'cleave', mag: 3.4, cd: 3.2, type: 'arcane', scale: 'intelligence', tags: ['zone', 'direct', 'arcane'] },
  { id: 'ar_rupture', name: 'Rupture des arcanes', icon: '🌀', effect: 'executeNuke', mag: 4.0, cd: 5, type: 'arcane', scale: 'intelligence', tags: ['mono', 'direct', 'arcane'] },
  { id: 'ar_singularite', name: 'Singularité', icon: '🌌', effect: 'finisher', mag: 3.0, cd: 16, type: 'arcane', scale: 'intelligence', tags: ['mono', 'direct', 'arcane', 'finisseur', 'ultime'], resource: 'Charge des arcanes' },
]
for (const s of MAGE_SPELLS) POWERS.push(specToPower(s))

/* Sorts du CHASSEUR (handcrafted). Mailles → Meneur de meute (familier = invocation/DPS passif idle)
 * + Œil de faucon (Concentration : build/spend + visée → tir énorme, exécution, précision). */
const CHASSEUR_SPELLS: SpellSpec[] = [
  // Classe
  { id: 'ch_tir', name: 'Tir de chasse', icon: '🏹', effect: 'nuke', mag: 2.6, cd: 2.8, scale: 'agilite', tags: ['mono', 'direct'] },
  // Meneur de meute (familier + frappes bestiales)
  { id: 'me_cmd', name: 'Commandement bestial', icon: '🐺', effect: 'cleave', mag: 2.8, cd: 3, type: 'nature', scale: 'agilite', tags: ['zone', 'direct', 'nature', 'invocation'] },
  { id: 'me_morsure', name: 'Morsure du fauve', icon: '🐾', effect: 'nuke', mag: 4.4, cd: 3.5, type: 'nature', scale: 'agilite', tags: ['mono', 'direct', 'nature'] },
  { id: 'me_saignee', name: 'Saignée bestiale', icon: '🩸', effect: 'dot', mag: 2.4, cd: 4, type: 'nature', scale: 'agilite', tags: ['mono', 'dot', 'nature'] },
  { id: 'me_curee', name: 'Curée sauvage', icon: '🐗', effect: 'megaCleave', mag: 7, cd: 20, type: 'nature', scale: 'agilite', tags: ['zone', 'direct', 'nature', 'ultime', 'invocation'] },
  // Œil de faucon (Concentration : générateur → finisseur + exécution)
  { id: 'fa_visee', name: 'Tir assuré', icon: '🎯', effect: 'builder', mag: 1.6, cd: 2.5, scale: 'agilite', tags: ['mono', 'direct', 'generateur'], resource: 'Concentration' },
  { id: 'fa_tir_vise', name: 'Tir visé', icon: '🏹', effect: 'finisher', mag: 1.6, cd: 3.5, scale: 'agilite', tags: ['mono', 'direct', 'finisseur'], resource: 'Concentration' },
  { id: 'fa_mortel', name: 'Tir mortel', icon: '💀', effect: 'executeNuke', mag: 4.0, cd: 5, scale: 'agilite', tags: ['mono', 'direct'] },
  { id: 'fa_salve', name: 'Salve de flèches', icon: '🎇', effect: 'cleave', mag: 3.2, cd: 3, scale: 'agilite', tags: ['zone', 'direct'] },
  { id: 'fa_aigle', name: 'Tir de l\'aigle', icon: '🦅', effect: 'finisher', mag: 3.0, cd: 16, scale: 'agilite', tags: ['mono', 'direct', 'finisseur', 'ultime'], resource: 'Concentration' },
]
for (const s of CHASSEUR_SPELLS) POWERS.push(specToPower(s))

/* Sorts du GUERRIER (handcrafted). Plaque → Sentence (DPS : Rage build/spend + exécution + saignements)
 * + Rempart (TANK : Rage → bouclier d'absorption via finisherShield + épines + provocation). */
const GUERRIER_SPELLS: SpellSpec[] = [
  // Classe
  { id: 'gu_frappe', name: 'Frappe d\'arme', icon: '⚔️', effect: 'nuke', mag: 2.6, cd: 2.8, scale: 'force', tags: ['mono', 'direct'] },
  // Sentence (DPS — Rage → exécution + saignements)
  { id: 'se_mutile', name: 'Coup mutilant', icon: '🪓', effect: 'builder', mag: 1.6, cd: 2.5, scale: 'force', tags: ['mono', 'direct', 'generateur'], resource: 'Rage' },
  { id: 'se_sentence', name: 'Sentence', icon: '⚖️', effect: 'finisher', mag: 1.6, cd: 3.5, scale: 'force', tags: ['mono', 'direct', 'finisseur'], resource: 'Rage' },
  { id: 'se_saignement', name: 'Saignement profond', icon: '🩸', effect: 'dot', mag: 2.4, cd: 4, scale: 'force', tags: ['mono', 'dot'] },
  { id: 'se_decapite', name: 'Décapitation', icon: '🗡️', effect: 'executeNuke', mag: 4.0, cd: 5, scale: 'force', tags: ['mono', 'direct'] },
  { id: 'se_tourmente', name: 'Tourmente', icon: '🌀', effect: 'cleave', mag: 3.0, cd: 3, scale: 'force', tags: ['zone', 'direct'] },
  { id: 'se_carnage', name: 'Carnage', icon: '💥', effect: 'finisher', mag: 3.0, cd: 16, scale: 'force', tags: ['mono', 'direct', 'finisseur', 'ultime'], resource: 'Rage' },
  // Rempart (TANK — Rage → bouclier + provocation + épines)
  { id: 're_bouclier_coup', name: 'Coup de bouclier', icon: '🛡️', effect: 'builder', mag: 1.4, cd: 2.5, scale: 'force', tags: ['mono', 'direct', 'generateur', 'protection'], resource: 'Rage' },
  { id: 're_revanche', name: 'Revanche', icon: '🤺', effect: 'finisher', mag: 1.4, cd: 3.5, scale: 'force', tags: ['mono', 'direct', 'finisseur', 'protection'], resource: 'Rage' },
]
for (const s of GUERRIER_SPELLS) POWERS.push(specToPower(s))

/* Sorts du PRÊTRE (handcrafted). Tissu → Lumière (HEAL : soin + châtiment via healToDamage + boucliers)
 * + Vide (DPS : DoT d'ombre + Forme du Vide [frenzy] + drain). */
const PRETRE_SPELLS: SpellSpec[] = [
  // Classe
  { id: 'pr_chatiment', name: 'Châtiment', icon: '⚜️', effect: 'nuke', mag: 2.8, cd: 2.8, type: 'arcane', scale: 'intelligence', tags: ['mono', 'direct', 'arcane'] },
  // Lumière (HEAL — soin + smite)
  { id: 'lu_soin', name: 'Mot de lumière', icon: '💗', effect: 'heal', mag: 2.4, cd: 3, scale: 'intelligence', tags: ['soin'] },
  { id: 'lu_renouveau', name: 'Renouveau', icon: '💞', effect: 'hot', mag: 1.8, cd: 4, scale: 'intelligence', tags: ['soin'] },
  { id: 'lu_benediction', name: 'Bénédiction', icon: '✳️', effect: 'buffParty', mag: 1.8, cd: 5, scale: 'intelligence', tags: ['soin'] },
  { id: 'lu_aube', name: 'Aube salvatrice', icon: '🌅', effect: 'bigHeal', mag: 12, cd: 24, scale: 'intelligence', tags: ['soin', 'ultime'] },
  // Vide (DPS — DoT ombre + Folie)
  { id: 'vi_mot_ombre', name: 'Mot de l\'ombre', icon: '🗯️', effect: 'dot', mag: 2.6, cd: 4, type: 'ombre', scale: 'intelligence', tags: ['mono', 'dot', 'ombre'] },
  { id: 'vi_douleur', name: 'Douleur', icon: '🌑', effect: 'nuke', mag: 3.0, cd: 2.8, type: 'ombre', scale: 'intelligence', tags: ['mono', 'direct', 'ombre'] },
  { id: 'vi_forme', name: 'Forme du Vide', icon: '👁️', effect: 'frenzy', mag: 1.6, cd: 18, duration: 8, scale: 'intelligence', tags: ['ombre'] },
  { id: 'vi_tourment', name: 'Tourment', icon: '☄️', effect: 'cleave', mag: 3.0, cd: 3.2, type: 'ombre', scale: 'intelligence', tags: ['zone', 'direct', 'ombre'] },
  { id: 'vi_devorer', name: 'Dévorer l\'esprit', icon: '💀', effect: 'executeNuke', mag: 4.0, cd: 5, type: 'ombre', scale: 'intelligence', tags: ['mono', 'direct', 'ombre'] },
  { id: 'vi_folie', name: 'Folie dévorante', icon: '🌌', effect: 'megaCleave', mag: 7, cd: 20, type: 'ombre', scale: 'intelligence', tags: ['zone', 'direct', 'ombre', 'ultime'] },
]
for (const s of PRETRE_SPELLS) POWERS.push(specToPower(s))

const BY_ID = new Map(POWERS.map((p) => [p.id, p]))

export function getPower(id: string): PowerDef | undefined {
  return BY_ID.get(id)
}

/** Icône propre à chaque sort (combat + arbre). Distincte des icônes de types de dégâts. */
const POWER_ICON: Record<string, string> = {
  frappe_simple: '⚔️', frappe_lourde: '🔨', tourbillon: '🌀', choc_sismique: '🌋', laceration: '🩸',
  tir_precis: '🎯', volee_de_fleches: '🏹', poison: '🧪', eviscaration: '🗡️',
  eclair: '🔮', embrasement: '☄️', trait_de_givre: '❄️', salve_arcanique: '🌟', fleau_dombre: '🌑',
  chatiment: '⚜️', decapitation: '🪓', onde_de_force: '💢',
  provocation: '🚩', bouclier_runique: '🛡️', second_souffle: '💨', posture_defensive: '🧱',
  vague_de_soin: '💧', guerison_majeure: '💚', imposition_des_mains: '🙌',
  // Ultimes
  verdict: '⚖️', soif_du_neant: '🦇', deluge_stellaire: '🌠', aube_salvatrice: '🌅', hemorragie_cosmique: '🧨',
  egide_titanesque: '🔰', phase_etheree: '🌫️', vengeance_differee: '⏳', furie_sanguinaire: '😡', sceau_faiblesse: '🔻',
  // v0.29 — signatures de classe
  griffes_meute: '🐾', saignement_sauvage: '🩸', piege_explosif: '💣', paume_du_tigre: '🐯', lame_du_chaos: '😈',
  boule_de_feu: '🔥', eclat_de_glace: '🧊', nuee_demoniaque: '👹', ruine: '💥', fulguration: '⚡', souffle_ardent: '🐉', mot_de_lombre: '🗯️',
  coup_runique: '🩸', lacere_chaos: '👿',
  rajeunissement: '🌱', songe_emeraude: '🍃', lumiere_sacree: '🌟', brume_revigorante: '🌫️',
}

/** Icône d'un sort : champ explicite, table, puis repli (rôle/type). */
export function powerIcon(p: PowerDef): string {
  if (p.icon) return p.icon
  if (POWER_ICON[p.id]) return POWER_ICON[p.id]
  if (p.effect === 'heal' || p.effect === 'hot' || p.effect === 'buffParty') return '✚'
  if (p.effect === 'shield') return '🛡️'
  return '⚔️'
}

export const POWER_SLOTS = 5

/**
 * Méta d'affichage par type d'effet : libellé, icône (distincte des types de dégâts),
 * portée (mono-cible vs zone), et famille (offense / soin / soutien). Sert à présenter
 * un sort lisiblement dans l'arbre de talents et la fiche de sort.
 */
export interface PowerEffectMeta {
  label: string
  icon: string
  /** Nombre de cibles touchées, en clair. */
  targets: string
  family: 'offense' | 'soin' | 'soutien'
}

export const POWER_EFFECT_META: Record<PowerEffect, PowerEffectMeta> = {
  nuke: { label: 'Frappe directe', icon: '🎯', targets: 'Mono-cible', family: 'offense' },
  cleave: { label: 'Zone', icon: '💥', targets: 'Tout le pack', family: 'offense' },
  dot: { label: 'Altération (DoT)', icon: '☣️', targets: 'Mono-cible · sur la durée', family: 'offense' },
  heal: { label: 'Soin', icon: '💗', targets: 'Allié le plus blessé', family: 'soin' },
  hot: { label: 'Soin sur la durée', icon: '💞', targets: 'Allié · sur la durée', family: 'soin' },
  shield: { label: 'Bouclier', icon: '🛡️', targets: 'Porteur', family: 'soutien' },
  buffParty: { label: 'Soin de groupe', icon: '✳️', targets: 'Tout le groupe', family: 'soin' },
  // Ultimes
  bigShield: { label: 'Bouclier massif', icon: '🔰', targets: 'Porteur (+ équipe)', family: 'soutien' },
  invuln: { label: 'Immunité', icon: '🌫️', targets: 'Porteur · brève immunité', family: 'soutien' },
  charge: { label: 'Charge → frappe', icon: '⏳', targets: 'Mono-cible · différé ×3', family: 'offense' },
  frenzy: { label: 'Frénésie', icon: '😡', targets: 'Porteur · buff de dégâts', family: 'offense' },
  executeNuke: { label: 'Exécution', icon: '⚖️', targets: 'Mono-cible · PV manquants', family: 'offense' },
  megaCleave: { label: 'Cataclysme (zone)', icon: '🌠', targets: 'Tout le pack', family: 'offense' },
  bigHeal: { label: 'Soin massif', icon: '🌅', targets: 'Tout le groupe', family: 'soin' },
  lifeNuke: { label: 'Frappe vampirique', icon: '🦇', targets: 'Mono-cible + vol de vie', family: 'offense' },
  rupture: { label: 'Anti-régén + DoT', icon: '🧨', targets: 'Mono-cible · brise la régén', family: 'offense' },
  mark: { label: 'Vulnérabilité', icon: '🔻', targets: 'Mono-cible · amplifie les dégâts', family: 'offense' },
  // v0.29.2 — socle Voleur
  poison: { label: 'Venin (cumulatif)', icon: '🧪', targets: 'Mono-cible · +1 stack', family: 'offense' },
  detonate: { label: 'Détonation', icon: '💥', targets: 'Mono-cible · consomme les stacks', family: 'offense' },
  builder: { label: 'Générateur', icon: '🗡️', targets: 'Mono-cible · +1 Point de Combo', family: 'offense' },
  finisher: { label: 'Finisseur', icon: '🔪', targets: 'Mono-cible · × Points de Combo', family: 'offense' },
}

/** Stat de scaling d'un sort, en court (FOR / AGI / INT). */
export const SCALE_SHORT: Record<NonNullable<PowerDef['scaleStat']>, string> = {
  force: 'FOR', agilite: 'AGI', intelligence: 'INT',
}

/**
 * Libellé du scaling pour l'UI :
 * - multi-stat → "FOR/AGI" (prend la meilleure),
 * - stat unique → "FOR",
 * - aucune → "Stat principale" (scale sur ta stat dominante : ouvert à tous les builds).
 */
export function scaleLabel(p: PowerDef): string | null {
  if (p.scaleStats?.length) return p.scaleStats.map((s) => SCALE_SHORT[s]).join('/')
  if (p.scaleStat) return SCALE_SHORT[p.scaleStat]
  return 'Stat principale'
}

/** Effets qui infligent des dégâts TYPÉS (les seuls qui portent un type de dégât affichable). */
const TYPED_DAMAGE_EFFECTS: ReadonlySet<PowerEffect> = new Set<PowerEffect>([
  'nuke', 'cleave', 'dot', 'executeNuke', 'megaCleave', 'lifeNuke', 'rupture',
])

/** Le sort inflige-t-il des dégâts typés (→ a un type de dégât affichable) ? */
export function powerHasDamageType(p: PowerDef): boolean {
  return !!p.effect && TYPED_DAMAGE_EFFECTS.has(p.effect)
}

/**
 * Type de dégât EFFECTIF d'un sort : son type explicite (sorts élémentaires), sinon le type de
 * l'arme équipée (`weaponMainType`). Une Frappe sur une arme Ombre devient donc Ombre.
 */
export function powerDamageType(p: PowerDef, weaponMainType: DamageType): DamageType {
  return p.damageType ?? weaponMainType
}

/** Résumé d'affichage d'un sort actif (null pour les passifs). */
export interface PowerSummary {
  cooldown: number
  effectMeta: PowerEffectMeta
  scaleShort: string | null
  damageType: PowerDef['damageType']
  magnitude: number
}

export function powerSummary(p: PowerDef): PowerSummary | null {
  if (p.kind !== 'active' || !p.effect) return null
  return {
    cooldown: p.cooldown ?? 0,
    effectMeta: POWER_EFFECT_META[p.effect],
    scaleShort: p.kind === 'active' ? scaleLabel(p) : null,
    damageType: p.damageType,
    magnitude: p.magnitude ?? 0,
  }
}
