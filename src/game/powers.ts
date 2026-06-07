import type { PowerDef } from './types'

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
    description: 'Un coup d\'arme rapide. Scale sur ta stat dominante.',
    unlockLevel: 1, cooldown: 3, effect: 'nuke', magnitude: 1.8, scaleStat: 'force',
  },

  // --- Berserker (Force / mêlée) ---
  {
    id: 'frappe_lourde', name: 'Frappe lourde', kind: 'active',
    description: 'Assène un coup dévastateur. Scale FOR.',
    unlockLevel: 1, cooldown: 3.5, effect: 'nuke', magnitude: 3, scaleStat: 'force',
  },
  {
    id: 'tourbillon', name: 'Tourbillon', kind: 'active',
    description: 'Frappe lourde répétée à fort dégât. Scale FOR.',
    unlockLevel: 1, cooldown: 2.5, effect: 'cleave', magnitude: 3.5, scaleStat: 'force',
  },

  // --- Rôdeur (Agilité / furtivité) ---
  {
    id: 'tir_precis', name: 'Tir précis', kind: 'active',
    description: 'Un tir visant les points vitaux. Scale AGI.',
    unlockLevel: 1, cooldown: 2.5, effect: 'nuke', magnitude: 2.6, scaleStat: 'agilite',
  },
  {
    id: 'poison', name: 'Lames empoisonnées', kind: 'active',
    description: 'Empoisonne l\'ennemi (DoT). Scale AGI.',
    unlockLevel: 1, cooldown: 4, effect: 'dot', magnitude: 1.4, scaleStat: 'agilite',
  },

  // --- Arcaniste (Intelligence / sorts) ---
  {
    id: 'eclair', name: 'Éclair arcanique', kind: 'active',
    description: 'Décharge d\'arcane. Scale INT.',
    unlockLevel: 1, cooldown: 2.5, effect: 'nuke', magnitude: 3.2, scaleStat: 'intelligence', damageType: 'arcane',
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
    description: 'Érige un bouclier qui absorbe des dégâts sur le porteur. Scale INT.',
    unlockLevel: 1, cooldown: 6, effect: 'shield', magnitude: 3, scaleStat: 'intelligence',
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
    description: 'Ouvre des plaies béantes (DoT physique). Scale FOR.',
    unlockLevel: 1, cooldown: 4.5, effect: 'dot', magnitude: 2.2, scaleStat: 'force',
  },
  {
    id: 'choc_sismique', name: 'Choc sismique', kind: 'active',
    description: 'Frappe le sol, dégâts massifs. Scale FOR.',
    unlockLevel: 1, cooldown: 4, effect: 'cleave', magnitude: 4.2, scaleStat: 'force',
  },
  {
    id: 'volee_de_fleches', name: 'Volée de flèches', kind: 'active',
    description: 'Une pluie de traits rapides. Scale AGI.',
    unlockLevel: 1, cooldown: 3, effect: 'cleave', magnitude: 3, scaleStat: 'agilite',
  },
  {
    id: 'eviscaration', name: 'Éviscération', kind: 'active',
    description: 'Coup mortel sur cible affaiblie. Scale AGI.',
    unlockLevel: 1, cooldown: 3.5, effect: 'nuke', magnitude: 4, scaleStat: 'agilite',
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
    unlockLevel: 1, cooldown: 3, effect: 'nuke', magnitude: 3.6, scaleStat: 'intelligence', damageType: 'arcane',
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
]

const BY_ID = new Map(POWERS.map((p) => [p.id, p]))

export function getPower(id: string): PowerDef | undefined {
  return BY_ID.get(id)
}

export const POWER_SLOTS = 5
