import type { UniqueEffect, UniqueInstance, StatBlock, StatKey, DamageType } from './types'

/**
 * Catalogue des effets uniques — couvre TOUS les rôles (dps / heal / tank / resist / utility).
 * Chaque effet a des `mods` (et parfois des `resistMods`) de base montés par le rang, et un
 * texte d'actif débloqué au rang actif.
 *
 * Les effets apparaissent dès la rareté Épique (tier 5) ; ils peuvent aussi être INSÉRÉS sur
 * un objet en dépensant des essences de cet effet (recyclage d'uniques).
 *
 * Ajouter une capacité = ajouter une entrée ici. Rien d'autre à changer.
 */
export const UNIQUE_EFFECTS: UniqueEffect[] = [
  // ---------------- DPS ----------------
  { id: 'soif_de_sang', name: 'Soif de sang', role: 'dps', description: 'Vos coups critiques vous régénèrent.', mods: { critique: 40, volDeVie: 20 } },
  { id: 'lame_tempete', name: 'Lame-tempête', role: 'dps', description: 'Vos frappes s\'enchaînent en rafale.', mods: { hate: 50, force: 35 } },
  { id: 'precision_mortelle', name: 'Précision mortelle', role: 'dps', description: 'Vous visez les points vitaux.', mods: { critique: 60, degatsCrit: 50 } },
  { id: 'rage_du_berserker', name: 'Rage du berserker', role: 'dps', description: 'Plus vous êtes blessé, plus vous frappez fort.', mods: { force: 70, critique: 25 } },
  { id: 'fureur_des_arcanes', name: 'Fureur des arcanes', role: 'dps', description: 'La magie afflue dans vos veines.', mods: { intelligence: 60, hate: 25, degatsCrit: 30 } },
  { id: 'danse_des_ombres', name: 'Danse des ombres', role: 'dps', description: 'Vous esquivez en frappant.', mods: { agilite: 60, hate: 20 } },
  { id: 'perce_armure', name: 'Perce-armure', role: 'dps', description: 'Rien ne vous résiste.', mods: { penetration: 60, force: 30 } },
  { id: 'maitre_des_elements', name: 'Maître des éléments', role: 'dps', description: 'Les éléments vous obéissent.', mods: { maitrise: 60, intelligence: 30 } },
  { id: 'echo_du_vide', name: 'Écho du vide', role: 'dps', description: 'Le néant amplifie vos coups.', mods: { polyvalence: 45, maitrise: 35 } },
  { id: 'colere_titanesque', name: 'Colère titanesque', role: 'dps', description: 'Chaque coup ébranle le monde.', mods: { force: 50, degatsCrit: 70 } },
  { id: 'frappe_fantome', name: 'Frappe fantôme', role: 'dps', description: 'Vos lames traversent les défenses.', mods: { agilite: 45, penetration: 45 } },

  // ---------------- HEAL ----------------
  { id: 'flux_vital', name: 'Flux vital', role: 'heal', description: 'La vie circule à travers vous.', mods: { regen: 60, intelligence: 30 } },
  { id: 'sang_eternel', name: 'Sang éternel', role: 'heal', description: 'Vos blessures se referment seules.', mods: { volDeVie: 40, regen: 30 } },
  { id: 'benediction_solaire', name: 'Bénédiction solaire', role: 'heal', description: 'Une lumière apaisante vous entoure.', mods: { intelligence: 50, polyvalence: 30, regen: 25 } },
  { id: 'communion', name: 'Communion', role: 'heal', description: 'Votre esprit nourrit le groupe.', mods: { intelligence: 60, regen: 40 } },
  { id: 'renaissance', name: 'Renaissance', role: 'heal', description: 'Vous renaissez de vos cendres.', mods: { regen: 50, endurance: 60 } },

  // ---------------- TANK ----------------
  { id: 'colosse', name: 'Carrure de colosse', role: 'tank', description: 'Votre stature impose le respect.', mods: { endurance: 80, polyvalence: 25 } },
  { id: 'gardien_eternel', name: 'Gardien éternel', role: 'tank', description: 'Une volonté inépuisable.', mods: { endurance: 60, reductionDegats: 50 } },
  { id: 'mur_dacier', name: 'Mur d\'acier', role: 'tank', description: 'Immobile face à la tempête.', mods: { reductionDegats: 70, bouclier: 200 } },
  { id: 'peau_de_dragon', name: 'Peau de dragon', role: 'tank', description: 'Des écailles ancestrales vous couvrent.', mods: { endurance: 100, esquive: 30 } },
  { id: 'rempart_vivant', name: 'Rempart vivant', role: 'tank', description: 'Vous attirez et encaissez tout.', mods: { endurance: 70, bouclier: 300 } },

  // ---------------- RESIST ----------------
  { id: 'coeur_de_braise', name: 'Cœur de braise', role: 'resist', description: 'Le feu ne vous atteint plus.', mods: { endurance: 40 }, resistMods: { feu: 0.18 } },
  { id: 'armure_de_givre', name: 'Armure de givre', role: 'resist', description: 'Le froid glisse sur vous.', mods: { endurance: 40 }, resistMods: { froid: 0.18 } },
  { id: 'mise_a_la_terre', name: 'Mise à la terre', role: 'resist', description: 'La foudre vous contourne.', mods: { endurance: 40 }, resistMods: { foudre: 0.18 } },
  { id: 'voile_antimagie', name: 'Voile antimagie', role: 'resist', description: 'L\'arcane se dissipe à votre contact.', mods: { reductionDegats: 30 }, resistMods: { arcane: 0.18 } },
  { id: 'lumiere_purificatrice', name: 'Lumière purificatrice', role: 'resist', description: 'Les ombres vous fuient.', mods: { reductionDegats: 30 }, resistMods: { ombre: 0.18 } },
  { id: 'symbiose_naturelle', name: 'Symbiose naturelle', role: 'resist', description: 'La nature vous épargne.', mods: { regen: 40 }, resistMods: { nature: 0.18 } },
  { id: 'egide_prismatique', name: 'Égide prismatique', role: 'resist', description: 'Toutes les énergies s\'atténuent.', mods: { endurance: 50 }, resistMods: { feu: 0.08, froid: 0.08, foudre: 0.08, arcane: 0.08, ombre: 0.08, nature: 0.08, physique: 0.08 } },

  // ---------------- UTILITY ----------------
  { id: 'esprit_vif', name: 'Esprit vif', role: 'utility', description: 'Vos réflexes dépassent l\'ennemi.', mods: { hate: 60, esquive: 30 } },
  { id: 'fortune', name: 'Fortune du voyageur', role: 'utility', description: 'La chance vous sourit.', mods: { polyvalence: 50, regen: 30 } },
  { id: 'equilibre_parfait', name: 'Équilibre parfait', role: 'utility', description: 'Ni trop offensif, ni trop prudent.', mods: { polyvalence: 70 } },
  { id: 'source_intarissable', name: 'Source intarissable', role: 'utility', description: 'Une vitalité qui ne tarit jamais.', mods: { regen: 80, polyvalence: 30 } },
]

/** Capacité active future (proc/sort) débloquée à ce rang. */
const ACTIVE_ABILITY: Record<string, string> = {
  soif_de_sang: 'Frénésie : un crit déclenche un gain de vitesse d\'attaque.',
  lame_tempete: '15% de chance de frapper deux fois.',
  precision_mortelle: 'Les crits exécutent les ennemis affaiblis.',
  rage_du_berserker: 'Dégâts fortement accrus sous 50% de vie.',
  fureur_des_arcanes: 'Vos sorts rebondissent sur une cible proche.',
  danse_des_ombres: 'Empile des charges de célérité en esquivant.',
  perce_armure: 'Ignore totalement l\'armure sur les crits.',
  maitre_des_elements: 'Alterne feu/givre/foudre pour des combos.',
  echo_du_vide: 'Chaque kill propage une explosion de vide.',
  colere_titanesque: 'Les coups génèrent une onde de choc.',
  frappe_fantome: 'Les frappes ignorent une part des résistances.',
  flux_vital: 'Un soin différé suit chaque attaque.',
  sang_eternel: 'Un bouclier de sang se reforme hors combat.',
  benediction_solaire: 'Soigne le groupe à chaque sort lancé.',
  communion: 'Soigne tout le groupe sur la durée.',
  renaissance: 'Survit une fois à la mort par combat.',
  colosse: 'Renvoie une partie des dégâts subis.',
  gardien_eternel: 'Un bouclier se régénère hors combat.',
  mur_dacier: 'Devient brièvement insensible aux coups.',
  peau_de_dragon: 'Reflète les attaques esquivées.',
  rempart_vivant: 'Provoque toute la salle.',
  coeur_de_braise: 'Immole les attaquants au contact.',
  armure_de_givre: 'Ralentit les ennemis proches.',
  mise_a_la_terre: 'Décharge la foudre accumulée.',
  voile_antimagie: 'Dissipe un sort ennemi périodiquement.',
  lumiere_purificatrice: 'Purge les altérations d\'ombre.',
  symbiose_naturelle: 'Régénère en restant immobile.',
  egide_prismatique: 'Convertit les dégâts subis en bouclier.',
  esprit_vif: 'Esquive garantie après un coup encaissé.',
  fortune: 'Améliore le butin des combats.',
  equilibre_parfait: 'Adapte vos stats au combat.',
  source_intarissable: 'Régénère fortement hors combat.',
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

/** Résistances effectives d'un effet à un rang donné. */
export function uniqueResistAtRank(id: string, rank: number): Partial<Record<DamageType, number>> {
  const def = BY_ID.get(id)
  if (!def?.resistMods) return {}
  const scale = 1 + (rank - 1) * RANK_GROWTH
  const out: Partial<Record<DamageType, number>> = {}
  for (const t in def.resistMods) {
    const type = t as DamageType
    out[type] = (def.resistMods[type] ?? 0) * scale
  }
  return out
}

/** Mods d'une instance d'unique (raccourci). */
export function instanceMods(inst: UniqueInstance): StatBlock {
  return uniqueModsAtRank(inst.id, inst.rank)
}

/** Résistances d'une instance d'unique (raccourci). */
export function instanceResist(inst: UniqueInstance): Partial<Record<DamageType, number>> {
  return uniqueResistAtRank(inst.id, inst.rank)
}

/**
 * Tire (ou non) un effet unique selon la rareté. Naît au rang 1.
 * Les objets Épique (tier 5) et au-dessus peuvent en porter un.
 */
export function rollUnique(rarityTier: number): UniqueInstance | undefined {
  if (rarityTier < 5) return undefined
  const chance = Math.min(0.9, (rarityTier - 4) * 0.1)
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

/** Coût pour INSÉRER (poser) un effet sur un objet via des essences. */
export function insertCost(): { essences: number; eclats: number } {
  return { essences: 8, eclats: 500 }
}
