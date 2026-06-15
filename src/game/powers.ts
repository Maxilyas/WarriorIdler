import type { PowerDef, PowerEffect, DamageType } from './types'

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
