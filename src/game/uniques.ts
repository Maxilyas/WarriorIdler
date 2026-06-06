import type { UniqueEffect, UniqueInstance, StatBlock, StatKey } from './types'

/**
 * Effets uniques de DÉMONSTRATION.
 *
 * Vision : à terme, des centaines de capacités qui modifient sorts, talents et
 * créent des combos. Chaque effet a des `mods` de base (rang 1) montés par le rang,
 * et une description annonçant sa future synergie active (débloquée au rang actif).
 *
 * Ajouter une capacité = ajouter une entrée ici. Rien d'autre à changer.
 */
export const UNIQUE_EFFECTS: UniqueEffect[] = [
  {
    id: 'soif_de_sang',
    name: 'Soif de sang',
    description: 'Vos coups critiques vous régénèrent.',
    mods: { critique: 40, volDeVie: 30 },
  },
  {
    id: 'fureur_des_arcanes',
    name: 'Fureur des arcanes',
    description: 'La magie afflue dans vos veines.',
    mods: { intelligence: 60, hate: 25 },
  },
  {
    id: 'colosse',
    name: 'Carrure de colosse',
    description: 'Votre stature impose le respect.',
    mods: { endurance: 80, polyvalence: 25 },
  },
  {
    id: 'lame_tempete',
    name: 'Lame-tempête',
    description: 'Vos frappes s\'enchaînent en rafale.',
    mods: { hate: 50, force: 35 },
  },
  {
    id: 'precision_mortelle',
    name: 'Précision mortelle',
    description: 'Vous visez les points vitaux.',
    mods: { critique: 70 },
  },
  {
    id: 'danse_des_ombres',
    name: 'Danse des ombres',
    description: 'Vous esquivez en frappant.',
    mods: { agilite: 60, hate: 20 },
  },
  {
    id: 'gardien_eternel',
    name: 'Gardien éternel',
    description: 'Une volonté inépuisable.',
    mods: { endurance: 60, maitrise: 40 },
  },
  {
    id: 'maitre_des_elements',
    name: 'Maître des éléments',
    description: 'Les éléments vous obéissent.',
    mods: { maitrise: 60, intelligence: 30 },
  },
  {
    id: 'rage_du_berserker',
    name: 'Rage du berserker',
    description: 'Plus vous êtes blessé, plus vous frappez fort.',
    mods: { force: 70, critique: 25 },
  },
  {
    id: 'echo_du_vide',
    name: 'Écho du vide',
    description: 'Le néant amplifie vos coups.',
    mods: { polyvalence: 45, maitrise: 35 },
  },
]

/** Capacité active future (proc/sort) débloquée à ce rang. */
const ACTIVE_ABILITY: Record<string, string> = {
  soif_de_sang: 'Frénésie : un crit déclenche un gain de vitesse d\'attaque.',
  fureur_des_arcanes: 'Vos sorts rebondissent sur une cible proche.',
  colosse: 'Renvoie une partie des dégâts subis.',
  lame_tempete: '15% de chance de frapper deux fois.',
  precision_mortelle: 'Les crits exécutent les ennemis affaiblis.',
  danse_des_ombres: 'Empile des charges de célérité en esquivant.',
  gardien_eternel: 'Un bouclier se régénère hors combat.',
  maitre_des_elements: 'Alterne feu/givre/foudre pour des combos.',
  rage_du_berserker: 'Dégâts fortement accrus sous 50% de vie.',
  echo_du_vide: 'Chaque kill propage une explosion de vide.',
}

export const UNIQUE_MAX_RANK = 10
export const UNIQUE_ACTIVE_RANK = 5 // rang qui débloque la partie active
const RANK_GROWTH = 0.35 // +35% des mods de base par rang

const BY_ID = new Map(UNIQUE_EFFECTS.map((u) => [u.id, u]))
export function getUnique(id: string): UniqueEffect | undefined {
  return BY_ID.get(id)
}

export function uniqueActiveText(id: string): string | undefined {
  return ACTIVE_ABILITY[id]
}

export function isUniqueActive(rank: number): boolean {
  return rank >= UNIQUE_ACTIVE_RANK
}

/** Mods effectifs d'un effet à un rang donné (base × montée de rang). */
export function uniqueModsAtRank(id: string, rank: number): StatBlock {
  const def = BY_ID.get(id)
  if (!def?.mods) return {}
  const scale = 1 + (rank - 1) * RANK_GROWTH
  const out: StatBlock = {}
  for (const k in def.mods) {
    const key = k as StatKey
    out[key] = Math.round((def.mods[key] ?? 0) * scale)
  }
  return out
}

/** Mods d'une instance d'unique (raccourci). */
export function instanceMods(inst: UniqueInstance): StatBlock {
  return uniqueModsAtRank(inst.id, inst.rank)
}

/**
 * Tire (ou non) un effet unique selon la rareté. Naît au rang 1.
 * Seuls les objets Artefact (tier 7) et au-dessus peuvent en porter un.
 */
export function rollUnique(rarityTier: number): UniqueInstance | undefined {
  if (rarityTier < 7) return undefined
  const chance = Math.min(0.9, (rarityTier - 6) * 0.14)
  if (Math.random() > chance) return undefined
  const def = UNIQUE_EFFECTS[Math.floor(Math.random() * UNIQUE_EFFECTS.length)]
  return { id: def.id, rank: 1 }
}

/** Tire un effet unique au hasard (rang 1) — pour le craft sommital (infusion). */
export function randomUniqueInstance(): UniqueInstance {
  const def = UNIQUE_EFFECTS[Math.floor(Math.random() * UNIQUE_EFFECTS.length)]
  return { id: def.id, rank: 1 }
}

/** Essences gagnées en recyclant un objet portant cet unique. */
export function essenceGain(rarityTier: number, rank: number): number {
  return Math.max(1, Math.floor(rarityTier / 2) + Math.floor(rank / 2))
}

/** Coût pour monter un effet du rang actuel au suivant. */
export function upgradeCost(rank: number): { essences: number; eclats: number } {
  return { essences: rank, eclats: 40 * rank }
}
