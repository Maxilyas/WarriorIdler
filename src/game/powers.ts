import type { PowerDef } from './types'

/**
 * Registre des capacités équipables (powers).
 *
 * Le RÔLE émerge des capacités équipées + du stuff :
 * - Provocation / Peau de pierre → tank
 * - Vague de soin → soigneur
 * - Frappe lourde / Cleave → dps
 *
 * Familles :
 * - PASSIVES : effet continu (menace, réduction de dégâts, bonus de stats).
 * - ACTIVES : auto-lancées sur cooldown en combat idle (heal, nuke, bouclier, buff).
 *
 * Débloquées par niveau de personnage pour l'instant ; l'arbre de talents (chantier #6)
 * deviendra la source principale (déblocage + rangs, comme les uniques).
 *
 * Ajouter une capacité = ajouter une entrée ici.
 */
export const POWERS: PowerDef[] = [
  // --- Capacités de départ (niveau 1) ---
  {
    id: 'frappe_lourde',
    name: 'Frappe lourde',
    kind: 'active',
    description: 'Assène un coup puissant à l\'ennemi.',
    unlockLevel: 1,
    cooldown: 3,
    effect: 'nuke',
    magnitude: 2.5,
  },
  {
    id: 'provocation',
    name: 'Provocation',
    kind: 'passive',
    description: 'Génère beaucoup plus de menace : attire les attaques ennemies.',
    unlockLevel: 1,
    threatMult: 4,
    mods: { endurance: 20 },
  },
  {
    id: 'vague_de_soin',
    name: 'Vague de soin',
    kind: 'active',
    description: 'Soigne périodiquement l\'allié le plus blessé (selon la puissance).',
    unlockLevel: 1,
    cooldown: 4,
    effect: 'heal',
    magnitude: 1.2,
  },

  // --- Niveau 5 ---
  {
    id: 'peau_de_pierre',
    name: 'Peau de pierre',
    kind: 'passive',
    description: 'Réduit les dégâts subis de 18%.',
    unlockLevel: 5,
    damageReduction: 0.18,
    mods: { endurance: 30 },
  },
  {
    id: 'cri_de_guerre',
    name: 'Cri de guerre',
    kind: 'active',
    description: 'Galvanise l\'équipe : soin léger de tout le groupe.',
    unlockLevel: 5,
    cooldown: 8,
    effect: 'buffParty',
    magnitude: 0.6,
  },

  // --- Niveau 10 ---
  {
    id: 'frenesie',
    name: 'Frénésie',
    kind: 'passive',
    description: 'Augmente fortement la Hâte et le Critique.',
    unlockLevel: 10,
    mods: { hate: 60, critique: 40 },
  },
  {
    id: 'bouclier_runique',
    name: 'Bouclier runique',
    kind: 'active',
    description: 'Érige un bouclier qui absorbe des dégâts sur le porteur.',
    unlockLevel: 10,
    cooldown: 6,
    effect: 'shield',
    magnitude: 3,
  },

  // --- Niveau 18 ---
  {
    id: 'tourbillon',
    name: 'Tourbillon',
    kind: 'active',
    description: 'Frappe lourde répétée à fort dégât.',
    unlockLevel: 18,
    cooldown: 2.5,
    effect: 'cleave',
    magnitude: 3.2,
  },
  {
    id: 'aura_de_puissance',
    name: 'Aura de puissance',
    kind: 'passive',
    description: 'Renforce la puissance et la maîtrise de tout le porteur.',
    unlockLevel: 18,
    mods: { maitrise: 70, polyvalence: 40 },
  },

  // --- Niveau 30 ---
  {
    id: 'guerison_majeure',
    name: 'Guérison majeure',
    kind: 'active',
    description: 'Soin puissant de l\'allié le plus blessé.',
    unlockLevel: 30,
    cooldown: 5,
    effect: 'heal',
    magnitude: 2.6,
  },
  {
    id: 'rempart',
    name: 'Rempart',
    kind: 'passive',
    description: 'Menace accrue et forte réduction des dégâts subis.',
    unlockLevel: 30,
    threatMult: 3,
    damageReduction: 0.25,
    mods: { endurance: 80 },
  },
]

const BY_ID = new Map(POWERS.map((p) => [p.id, p]))

export function getPower(id: string): PowerDef | undefined {
  return BY_ID.get(id)
}

/** Capacités débloquées à (ou avant) un niveau donné. */
export function powersUnlockedAt(level: number): PowerDef[] {
  return POWERS.filter((p) => p.unlockLevel <= level)
}

export const POWER_SLOTS = 5
