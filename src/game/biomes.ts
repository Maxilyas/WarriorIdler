import type { DamageType } from './types'
import { DAMAGE_TYPES } from './damage'

/**
 * BIOMES (refonte v0.18) — 7 biomes = les 7 types de dégâts.
 *
 * Chaque biome a SA progression de paliers (indépendante). Le joueur choisit le biome actif.
 * - Physique = biome de DÉPART (apprentissage : dégâts physiques purs).
 * - Feu / Froid / Foudre / Nature = 4 « communs », débloqués ENSEMBLE (jalon neutre = palier 20
 *   en Physique) → aucun build n'est avantagé par l'ordre.
 * - Arcane / Ombre = 2 « rares », débloqués ENSEMBLE (meilleur palier tous biomes ≥ 50).
 *
 * Identité de loot : le butin d'un biome est orienté vers SON élément (dégâts + résistances de ce
 * type) — voir la génération de butin côté store. Les ennemis frappent dans l'élément du biome
 * (Physique → physique) ; les techniques signature typées arriveront avec les sorts ennemis (Phase 3).
 */

export type BiomeId = DamageType

export type BiomeTier = 'start' | 'common' | 'rare'

export interface BiomeDef {
  id: BiomeId
  name: string
  /** Icône & couleur reprises du type de dégâts associé. */
  icon: string
  color: string
  tier: BiomeTier
  lore: string
}

/** Palier de Physique requis pour débloquer les 4 biomes communs. */
export const BIOME_COMMON_UNLOCK = 20
/** Meilleur palier (tous biomes) requis pour débloquer les 2 biomes rares. */
export const BIOME_RARE_UNLOCK = 50

/* ---- v0.27 (F2) — ROTATION SUBIE des biomes + lock payant (Fragments d'éternité) ----
 * Par défaut, le biome actif tourne automatiquement. Pour rester sur un biome précis (farm
 * d'une quintessence/d'un stuff ciblé = contenu endgame), on VERROUILLE contre des Fragments.
 * KNOBS d'équilibrage (F2c). */
export const BIOME_ROTATE_MS = 10 * 60 * 1000   // un biome toutes les ~10 min
export const BIOME_LOCK_MS = 60 * 60 * 1000     // un lock dure ~1 h
export const BIOME_LOCK_FRAGMENTS = 3           // coût du lock en ✨ Fragments d'éternité

function def(id: BiomeId, name: string, tier: BiomeTier, lore: string): BiomeDef {
  return { id, name, tier, lore, icon: DAMAGE_TYPES[id].icon, color: DAMAGE_TYPES[id].color }
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  physique: def('physique', 'Champs de Bataille', 'start', 'Les terres de départ : des brutes qui frappent à l\'acier. On y apprend l\'équipement sans pression élémentaire.'),
  feu: def('feu', 'Terres de Cendres', 'common', 'Volcans et coulées de lave. Les créatures y brûlent ce qu\'elles touchent : la Brûlure ronge sur la durée.'),
  froid: def('froid', 'Toundra Gelée', 'common', 'Étendues de glace éternelle. Le Gel ralentit et fige les imprudents : la Ténacité est ton alliée.'),
  foudre: def('foudre', 'Pics Orageux', 'common', 'Sommets battus par des orages perpétuels. Des décharges fulgurantes punissent les PV faibles.'),
  nature: def('nature', 'Jungle Sauvage', 'common', 'Une végétation vorace et toxique. Le Poison s\'empile : il faut purger ou survivre.'),
  arcane: def('arcane', 'Voile Arcanique', 'rare', 'Une déchirure de magie pure où la réalité vacille. Des malédictions affaiblissent quiconque s\'y aventure.'),
  ombre: def('ombre', 'Royaume des Ombres', 'rare', 'Les ténèbres absolues. Les entités y drainent la vie et ouvrent des plaies : frappe vite et fort.'),
}

export const BIOME_LIST: BiomeDef[] = [
  BIOMES.physique, BIOMES.feu, BIOMES.froid, BIOMES.foudre, BIOMES.nature, BIOMES.arcane, BIOMES.ombre,
]

export const BIOME_IDS: BiomeId[] = BIOME_LIST.map((b) => b.id)

export function getBiomeDef(id: BiomeId): BiomeDef {
  return BIOMES[id]
}

/** Un biome est-il débloqué ? (physiqueBest = record en Physique ; globalBest = record tous biomes). */
export function biomeUnlocked(id: BiomeId, physiqueBest: number, globalBest: number): boolean {
  const tier = BIOMES[id].tier
  if (tier === 'start') return true
  if (tier === 'common') return physiqueBest >= BIOME_COMMON_UNLOCK
  return globalBest >= BIOME_RARE_UNLOCK
}

/** Liste ordonnée des biomes DÉBLOQUÉS (pour la rotation). */
export function unlockedBiomes(physiqueBest: number, globalBest: number): BiomeId[] {
  return BIOME_IDS.filter((id) => biomeUnlocked(id, physiqueBest, globalBest))
}

/** Biome débloqué SUIVANT (rotation cyclique) ; renvoie le courant s'il est seul. */
export function nextUnlockedBiome(current: BiomeId, physiqueBest: number, globalBest: number): BiomeId {
  const list = unlockedBiomes(physiqueBest, globalBest)
  if (list.length <= 1) return list[0] ?? current
  const i = list.indexOf(current)
  return list[(i + 1 + list.length) % list.length]
}

/** Texte d'aide expliquant comment débloquer un biome encore verrouillé. */
export function biomeUnlockHint(id: BiomeId): string {
  const tier = BIOMES[id].tier
  if (tier === 'common') return `Atteins le palier ${BIOME_COMMON_UNLOCK} aux Champs de Bataille`
  if (tier === 'rare') return `Atteins le palier ${BIOME_RARE_UNLOCK} (n'importe quel biome)`
  return ''
}
