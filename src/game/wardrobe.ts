import type { Character, EquipSlotId, Item, PrimaryStat, RarityId } from './types'
import { RARITIES } from './rarities'
import { DAMAGE_TYPES } from './damage'

/**
 * 👤 GARDE-ROBE (v0.43) — couche de PRÉSENTATION de l'avatar 2D en pied. AUCUN impact gameplay :
 * on dérive, depuis l'équipement RÉEL et la classe (résolue via les talents), une pile de calques
 * à composer par `<Mannequin>`. Voir DESIGN_v0.43_avatar.md.
 *
 * État TRANCHE VERTICALE (Lots 0+1) : les calques sont rendus en PLACEHOLDER SVG procédural (pas
 * d'asset raster encore). Quand le pack d'art (LPC) arrivera, `GearLayer` portera un `asset` et le
 * Mannequin dessinera le PNG ancré au lieu de la forme procédurale — le reste (résolution classe,
 * paliers, effets) ne bouge pas.
 */

// ---- Classes & catégories d'armure ----

export type ArmorType = 'plaque' | 'mailles' | 'cuir' | 'tissu'

export type ClassId =
  | 'guerrier' | 'paladin' | 'dk' // plaque
  | 'chasseur' | 'chaman' // mailles
  | 'voleur' | 'druide' // cuir
  | 'mage' | 'pretre' | 'demoniste' // tissu

/** Archétype de silhouette du corps nu (4 gabarits — un par catégorie d'armure). */
export type BodyShape = 'massif' | 'athletique' | 'agile' | 'robe'

export interface ClassMeta {
  id: ClassId
  name: string
  armor: ArmorType
  body: BodyShape
  /** Couleur d'identité de classe (teinte du gear aux bas paliers, accents). */
  tint: string
}

export const CLASS_META: Record<ClassId, ClassMeta> = {
  guerrier: { id: 'guerrier', name: 'Guerrier', armor: 'plaque', body: 'massif', tint: '#ef4444' },
  paladin: { id: 'paladin', name: 'Paladin', armor: 'plaque', body: 'massif', tint: '#eab308' },
  dk: { id: 'dk', name: 'Chevalier de la mort', armor: 'plaque', body: 'massif', tint: '#38bdf8' },
  chasseur: { id: 'chasseur', name: 'Chasseur', armor: 'mailles', body: 'athletique', tint: '#22c55e' },
  chaman: { id: 'chaman', name: 'Chaman', armor: 'mailles', body: 'athletique', tint: '#0ea5e9' },
  voleur: { id: 'voleur', name: 'Voleur', armor: 'cuir', body: 'agile', tint: '#a855f7' },
  druide: { id: 'druide', name: 'Druide', armor: 'cuir', body: 'agile', tint: '#4ade80' },
  mage: { id: 'mage', name: 'Mage', armor: 'tissu', body: 'robe', tint: '#6366f1' },
  pretre: { id: 'pretre', name: 'Prêtre', armor: 'tissu', body: 'robe', tint: '#fcd34d' },
  demoniste: { id: 'demoniste', name: 'Démoniste', armor: 'tissu', body: 'robe', tint: '#7c3aed' },
}

/** Classe par défaut d'une catégorie (fallback per-bias quand la classe fine est indéterminée). */
const DEFAULT_CLASS_OF_ARMOR: Record<ArmorType, ClassId> = {
  plaque: 'guerrier', mailles: 'chasseur', cuir: 'voleur', tissu: 'mage',
}

/** Mapping gateway de talent → catégorie d'armure (cf. talents.ts `cat_*`). */
const GATEWAY_ARMOR: Record<string, ArmorType> = {
  cat_plaque: 'plaque', cat_mailles: 'mailles', cat_cuir: 'cuir', cat_tissu: 'tissu',
}

/** Fallback quand aucun talent n'est alloué (perso frais) : biais primaire → catégorie. */
const BIAS_ARMOR: Record<PrimaryStat, ArmorType> = {
  force: 'plaque', endurance: 'plaque', agilite: 'cuir', intelligence: 'tissu',
}

/**
 * Indices de racine d'archétype → classe fine. Best-effort : on cherche dans `char.talents` un nœud
 * dont l'id commence par un de ces préfixes. La catégorie d'armure (corps) reste fiable même sans
 * match ; la classe fine ne sert qu'aux divergences hauts-paliers (hors tranche verticale).
 */
const CLASS_NODE_HINTS: { prefix: string; id: ClassId }[] = [
  { prefix: 'cl_druide', id: 'druide' },
  { prefix: 'vo_', id: 'voleur' },
  { prefix: 'gu_', id: 'guerrier' },
  { prefix: 'pa_', id: 'paladin' },
  { prefix: 'dk_', id: 'dk' },
  { prefix: 'ch_', id: 'chasseur' },
  { prefix: 'cm_', id: 'chaman' },
  { prefix: 'ma_', id: 'mage' },
  { prefix: 'pr_', id: 'pretre' },
  { prefix: 'de_', id: 'demoniste' },
]

/** Résout corps + teinte d'un héros : talents → catégorie d'armure (+ classe fine), fallback biais. */
export function resolveClass(char: Character): ClassMeta {
  const talents = char.talents ?? {}
  // 1) Catégorie d'armure = gateway cat_* alloué (rang ≥ 1).
  let armor: ArmorType | undefined
  for (const [node, a] of Object.entries(GATEWAY_ARMOR)) if ((talents[node] ?? 0) > 0) armor = a
  if (!armor) armor = BIAS_ARMOR[char.primaryBias] ?? 'plaque'

  // 2) Classe fine = racine d'archétype investie, cohérente avec la catégorie ; sinon défaut.
  let cls: ClassId | undefined
  for (const h of CLASS_NODE_HINTS) {
    if (Object.keys(talents).some((k) => k.startsWith(h.prefix) && (talents[k] ?? 0) > 0)) {
      if (CLASS_META[h.id].armor === armor) { cls = h.id; break }
    }
  }
  return CLASS_META[cls ?? DEFAULT_CLASS_OF_ARMOR[armor]]
}

// ---- Paliers visuels ----

/** 6 paliers visuels : projection des 16 raretés (la forme du gear change 6 fois). */
export type VisualTier = 0 | 1 | 2 | 3 | 4 | 5

export function visualTier(rarity: RarityId): VisualTier {
  const t = RARITIES[rarity].tier // 1..16
  return (t <= 2 ? 0 : t <= 4 ? 1 : t <= 6 ? 2 : t <= 8 ? 3 : t <= 11 ? 4 : 5) as VisualTier
}

/** iLvl de référence pour normaliser le glow (cap de contenu v0.30 ≈ 700). */
const ILVL_GLOW_REF = 700

// ---- Calques ----

/** Région du corps où se pose un calque (un slot d'équipement → une région, ~10 visibles). */
export type BodyRegion =
  | 'cape' | 'jambes' | 'torse' | 'pieds' | 'mains' | 'taille' | 'epaules' | 'tete' | 'bouclier' | 'arme'

/** Slot d'équipement → région visible + z-order (dos → face). Les slots absents (bijouterie) = pas de calque. */
const SLOT_RENDER: Partial<Record<EquipSlotId, { region: BodyRegion; z: number }>> = {
  cape: { region: 'cape', z: 10 },
  jambes: { region: 'jambes', z: 30 },
  pieds: { region: 'pieds', z: 35 },
  torse: { region: 'torse', z: 40 },
  taille: { region: 'taille', z: 45 },
  mains: { region: 'mains', z: 55 },
  epaules: { region: 'epaules', z: 60 },
  armeSecondaire: { region: 'bouclier', z: 65 },
  tete: { region: 'tete', z: 70 },
  armePrincipale: { region: 'arme', z: 80 },
}

/** Ordre des régions à composer (de l'arrière vers l'avant). */
export const REGION_ORDER: BodyRegion[] = ['cape', 'jambes', 'pieds', 'torse', 'taille', 'mains', 'epaules', 'bouclier', 'tete', 'arme']

/** Un calque prêt à composer. En placeholder : décrit une FORME ; plus tard `asset` portera un PNG. */
export interface GearLayer {
  slot: EquipSlotId
  region: BodyRegion
  z: number
  tier: VisualTier
  /** Teinte de rareté (RARITIES[r].color). */
  color: string
  /** Intensité du halo 0..1 (croît avec l'ilvl) — « chaque upgrade se sent ». */
  glow: number
  /** Couleur du halo : élément de l'arme (DAMAGE_TYPES) sinon teinte de rareté. */
  glowColor: string
  /** Pièce sertie d'au moins une gemme (scintillement). */
  gemmed: boolean
}

/** Glow 0..1 : un socle par palier + une rampe continue sur l'ilvl. */
function layerGlow(item: Item): number {
  const tier = visualTier(item.rarity)
  const byIlvl = Math.min(1, item.ilvl / ILVL_GLOW_REF)
  return Math.min(1, 0.15 + tier * 0.1 + byIlvl * 0.55)
}

/** Construit la pile de calques (triée dos→face) depuis l'équipement réel du héros. */
export function buildLayers(char: Character): GearLayer[] {
  const eq = char.equipment ?? {}
  const layers: GearLayer[] = []
  for (const [slot, render] of Object.entries(SLOT_RENDER) as [EquipSlotId, { region: BodyRegion; z: number }][]) {
    const item = eq[slot]
    if (!item) continue
    const isWeapon = slot === 'armePrincipale' && !!item.damageType
    layers.push({
      slot,
      region: render.region,
      z: render.z,
      tier: visualTier(item.rarity),
      color: RARITIES[item.rarity].color,
      glow: layerGlow(item),
      glowColor: isWeapon ? DAMAGE_TYPES[item.damageType!].color : RARITIES[item.rarity].color,
      gemmed: (item.gems?.length ?? 0) > 0,
    })
  }
  return layers.sort((a, b) => a.z - b.z)
}

/** Palier visuel le plus haut porté (pour l'éclat global / aura de la figurine). */
export function topVisualTier(char: Character): VisualTier {
  let top: VisualTier = 0
  for (const it of Object.values(char.equipment ?? {})) {
    if (!it) continue
    const t = visualTier(it.rarity)
    if (t > top) top = t
  }
  return top
}
