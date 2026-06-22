/**
 * DÉGÂTS — les 7 types, le PROFIL de dégâts (`computeDamageProfile` à partir de TOUT l'équipement +
 * keystones), le triangle d'élément (`ELEMENT_COUNTER`, affinités ennemies), et le matching de type
 * des sorts vs auto-attaques (`spellTypeMult`, knob `SPELL_TYPE_MATCH`). Le bonus cumulé par type est
 * soft-capé (`TYPE_BONUS_SOFT/HARD`).
 *   → Doc : docs/systemes/01-combat-et-degats.md
 */
import type { DamageType, Equipment } from './types'
import type { KeystoneEffect } from './talents'
import { instanceResist } from './uniques'
import { softCap } from './stats'

export interface DamageTypeMeta {
  id: DamageType
  name: string
  icon: string
  color: string
}

export const DAMAGE_TYPES: Record<DamageType, DamageTypeMeta> = {
  physique: { id: 'physique', name: 'Physique', icon: '⚔️', color: '#cbd5e1' },
  feu: { id: 'feu', name: 'Feu', icon: '🔥', color: '#ff6b35' },
  froid: { id: 'froid', name: 'Froid', icon: '❄️', color: '#4dd0e1' },
  foudre: { id: 'foudre', name: 'Foudre', icon: '⚡', color: '#ffd54f' },
  arcane: { id: 'arcane', name: 'Arcane', icon: '✨', color: '#c084fc' },
  ombre: { id: 'ombre', name: 'Ombre', icon: '🌑', color: '#a78bfa' },
  nature: { id: 'nature', name: 'Nature', icon: '🌿', color: '#66bb6a' },
}

export const DAMAGE_TYPE_LIST: DamageType[] = Object.keys(DAMAGE_TYPES) as DamageType[]

/**
 * v0.37 « Triangle d'élément » — chaque élément/biome RÉSISTE son propre élément et est VULNÉRABLE à
 * son opposé. Paires mutuelles (feu↔froid, foudre↔nature, arcane↔ombre) → rock-paper-scissors lisible.
 * Le Physique est NEUTRE (jamais bonus ni malus élémentaire ; il reste contré par l'armure). Donne du
 * sens à matcher l'élément de tes sorts AU CONTENU, et fait du multi-classe un levier (amène le contre).
 */
export const ELEMENT_COUNTER: Partial<Record<DamageType, DamageType>> = {
  feu: 'froid', froid: 'feu',
  foudre: 'nature', nature: 'foudre',
  arcane: 'ombre', ombre: 'arcane',
}
/** Surcroît de résistance d'un ennemi sur SON propre élément (points, additif à la rampe). Knob. */
export const ELEM_SELF_RESIST = 0.15
/** Vulnérabilité d'un ennemi à l'élément OPPOSÉ (points retranchés ; résist <0 = vrai bonus). Knob. */
export const ELEM_VULN = 0.20

/**
 * Construit la résistance d'un ennemi : base uniforme (rampe de difficulté) + AFFINITÉ ÉLÉMENTAIRE —
 * résiste son propre `element` (+ELEM_SELF_RESIST), vulnérable à l'opposé (−ELEM_VULN, <0 = vrai bonus).
 * Physique = neutre (pas d'opposé dans ELEMENT_COUNTER). Partagé par le FARM et les DONJONS. (Les RAIDS
 * ont leur propre check, plus fort et couvrant le Physique — voir VULN dans raids.ts.) `base` ≤ 0 → on
 * ne pose QUE les 2 cases d'affinité (pas de bruit de zéros).
 */
export function elementAffinityResist(element: DamageType, base: number): Partial<Record<DamageType, number>> {
  const counter = ELEMENT_COUNTER[element]
  const resist: Partial<Record<DamageType, number>> = {}
  if (base > 0) for (const t of DAMAGE_TYPE_LIST) resist[t] = base
  if (counter) {
    resist[element] = Math.min(0.85, base + ELEM_SELF_RESIST)
    resist[counter] = Math.max(-0.5, base - ELEM_VULN)
  }
  return resist
}

/**
 * v0.24 : la résistance du héros est en POINTS, NON PLAFONNÉE (modèle relatif — voir resist.ts).
 * L'ancien cap dur de 75 % est supprimé ; 1 ancien % = 1 point.
 */

export interface DamageProfile {
  /** Répartition des dégâts par type (somme = 1). */
  profile: Partial<Record<DamageType, number>>
  /** Bonus multiplicatif par type (0.3 = +30%). */
  bonus: Partial<Record<DamageType, number>>
  /** Type dominant (pour l'affichage). */
  mainType: DamageType
}

/** Poids de base de l'arme dans le profil (le reste vient des affixes +% type de TOUT le stuff). */
const WEAPON_BASE_WEIGHT = 1
/** Part d'un affixe « +% type » reversée dans la RÉPARTITION du profil (diversification). */
const AFFIX_PROFILE_SHARE = 0.7
/**
 * Part d'un affixe « +% type » conservée en bonus multiplicatif brut (+% de dégâts).
 * v0.22 : 1.0 → 0.5, et le bonus CUMULÉ par type est SOFT-CAPÉ (voir TYPE_BONUS_SOFT/HARD).
 * Avant : seule famille de stats SANS cap → ×5-6 de DPS en empilant 16 lignes quand la meilleure
 * ligne secondaire valait ~5% (cf. scripts/stat-weights.mjs). Une ligne de type reste le levier
 * d'identité le plus fort À L'UNITÉ (~2-3× une secondaire), mais l'empilement plafonne (~×2).
 */
const AFFIX_BONUS_SHARE = 0.5
/** Soft cap du bonus multiplicatif CUMULÉ par type. v0.35 : 0,6/1,2 → 0,4/0,8 (retour joueur : un
 *  ilvl 10 maxé-%type battait un ilvl 40 sur ~3 tranches → l'ossature ilvl était diluée). Plein
 *  rendement → +40%, asymptote +80% : le %type reste le levier le plus fort à l'unité (~2× une
 *  secondaire), mais l'inversion d'ilvl est bornée à ~1 tranche (l'ilvl reste l'ossature de v0.35). */
const TYPE_BONUS_SOFT = 0.4
const TYPE_BONUS_HARD = 0.8

/**
 * Calcule le profil de dégâts à partir de TOUT l'équipement (plus seulement l'arme) + des keystones.
 * - L'arme principale pose un poids de base sur son type.
 * - Chaque affixe `+% type` (n'importe quelle pièce) ajoute du POIDS à ce type dans la répartition
 *   ET un bonus multiplicatif → empiler du Feu sur une arme Physique fait basculer ton profil vers
 *   le Feu. Le stuff entier façonne le profil, l'arme ne le verrouille plus.
 * - `convertDamage` déplace une part d'un type vers un autre ; `splashType` ajoute une part SANS
 *   retirer (double appartenance), pour les nœuds « le Physique compte aussi comme Feu ».
 */
export function computeDamageProfile(equipment: Equipment, keystones: KeystoneEffect[] = []): DamageProfile {
  const mainTypeBase: DamageType = equipment.armePrincipale?.damageType ?? 'physique'

  // 1) Poids bruts par type : arme de base + contribution des affixes +% type de tout le stuff.
  const weight: Partial<Record<DamageType, number>> = { [mainTypeBase]: WEAPON_BASE_WEIGHT }
  const bonus: Partial<Record<DamageType, number>> = {}
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item) continue
    for (const aff of item.affixes) {
      if (aff.kind === 'dmgType' && aff.type) {
        weight[aff.type] = (weight[aff.type] ?? 0) + (aff.value / 100) * AFFIX_PROFILE_SHARE
        bonus[aff.type] = (bonus[aff.type] ?? 0) + (aff.value / 100) * AFFIX_BONUS_SHARE
      }
    }
    // (v0.22 : les gemmes sont des CONDITIONS, plus aucune contribution de stats ici.)
  }

  // 2) Conversions (déplacent) puis éclaboussures (ajoutent sans retirer).
  for (const k of keystones) {
    if (!k.convertDamage) continue
    const { from, to, frac } = k.convertDamage
    const moved = (weight[from] ?? 0) * frac
    if (moved <= 0) continue
    weight[from] = (weight[from] ?? 0) - moved
    weight[to] = (weight[to] ?? 0) + moved
  }
  for (const k of keystones) {
    if (!k.splashType) continue
    const { from, to, frac } = k.splashType
    const added = (weight[from] ?? 0) * frac
    if (added <= 0) continue
    weight[to] = (weight[to] ?? 0) + added
  }

  // ALCHIMISTE : transmutations basées sur le TYPE DE L'ARME (mainTypeBase) — n'importe quel élément.
  // Convert (déplace) d'abord, puis splash (ajoute), comme ci-dessus.
  for (const k of keystones) {
    if (!k.convertFromMain) continue
    const { to, frac } = k.convertFromMain
    const moved = (weight[mainTypeBase] ?? 0) * frac
    if (moved <= 0 || to === mainTypeBase) continue
    weight[mainTypeBase] = (weight[mainTypeBase] ?? 0) - moved
    weight[to] = (weight[to] ?? 0) + moved
  }
  for (const k of keystones) {
    const mainW = weight[mainTypeBase] ?? 0
    if (k.splashFromMain) {
      const { to, frac } = k.splashFromMain
      if (to !== mainTypeBase) weight[to] = (weight[to] ?? 0) + mainW * frac
    }
    if (k.splashFromMainAll && k.splashFromMainAll > 0) {
      for (const t of DAMAGE_TYPE_LIST) if (t !== mainTypeBase) weight[t] = (weight[t] ?? 0) + mainW * k.splashFromMainAll
    }
  }

  // 2b) Soft cap du bonus cumulé par type : empiler son élément garde du rendement, mais plafonne.
  for (const t in bonus) {
    const type = t as DamageType
    bonus[type] = softCap(bonus[type] ?? 0, TYPE_BONUS_SOFT, TYPE_BONUS_HARD)
  }

  // 3) Normalisation → répartition (somme = 1).
  let total = 0
  for (const t in weight) total += Math.max(0, weight[t as DamageType] ?? 0)
  if (total <= 0) { total = 1; weight[mainTypeBase] = 1 }
  const profile: Partial<Record<DamageType, number>> = {}
  let mainType = mainTypeBase
  let best = -1
  for (const t in weight) {
    const type = t as DamageType
    const v = Math.max(0, weight[type] ?? 0) / total
    if (v <= 0) continue
    profile[type] = v
    if (v > best) { best = v; mainType = type }
  }

  return { profile, bonus, mainType }
}

/**
 * Profil de résistances du héros, en POINTS (v0.24, non plafonné — modèle relatif, resist.ts).
 * Sources : lignes d'objet (1 ancien % = 1 point, telles quelles), talents et effets uniques
 * (données stockées en fractions → ×100 ici).
 */
export function computeResistProfile(
  equipment: Equipment,
  talentResist: Partial<Record<DamageType, number>> = {},
): Partial<Record<DamageType, number>> {
  const resist: Partial<Record<DamageType, number>> = {}
  for (const t in talentResist) resist[t as DamageType] = (talentResist[t as DamageType] ?? 0) * 100
  for (const slot in equipment) {
    const item = equipment[slot as keyof Equipment]
    if (!item) continue
    for (const aff of item.affixes) {
      if (aff.kind === 'resist' && aff.type) resist[aff.type] = (resist[aff.type] ?? 0) + aff.value
    }
    if (item.unique) {
      const ur = instanceResist(item.unique)
      for (const t in ur) resist[t as DamageType] = (resist[t as DamageType] ?? 0) + (ur[t as DamageType] ?? 0) * 100
    }
  }
  return resist
}

/** Multiplicateur de dégâts effectif sur le type dominant (pour l'affichage). */
export function effectiveTypeMult(p: DamageProfile): number {
  return 1 + (p.bonus[p.mainType] ?? 0)
}

/**
 * Multiplicateur de dégâts pondéré par TOUT le profil (répartition × bonus de type). C'est le
 * facteur des AUTO-ATTAQUES (rollHit). v0.37 : ce n'est PLUS le facteur des sorts — voir spellTypeMult.
 */
export function profileDamageMult(p: DamageProfile): number {
  let m = 0
  for (const t in p.profile) m += (p.profile[t as DamageType] ?? 0) * (1 + (p.bonus[t as DamageType] ?? 0))
  return m || 1
}

/**
 * v0.37 « Piste C » — part du multiplicateur d'un SORT qui suit le TYPE du sort (vs la moyenne du
 * profil, type-agnostique). 1 = matching pur (le hors-élément n'aide plus du tout) ; 0 = ancien
 * comportement (profileDamageMult). 0,7 : matcher l'élément de tes sorts est nettement payant, mais
 * un kit MULTI-ÉLÉMENT garde ~30 % de son investissement hors-type en valeur générique (multi-classe
 * protégé). Recalibrable via `npm run ttk`.
 */
export const SPELL_TYPE_MATCH = 0.7

/**
 * Types élémentaires « portés » par un sort : ses tags d'élément (un sort tri-élément les prend tous
 * → on retient le mieux stacké), sinon son type canonique (`damageType`, ou le type de l'arme).
 */
export function spellElementTypes(tags: string[] | undefined, canonical: DamageType): DamageType[] {
  if (tags) {
    const els = tags.filter((t): t is DamageType => (DAMAGE_TYPES as Record<string, unknown>)[t] !== undefined)
    if (els.length) return els
  }
  return [canonical]
}

/**
 * v0.37 « Piste C » — multiplicateur de TYPE pour un SORT. Blend entre la moyenne du profil (ancien,
 * type-agnostique) et le bonus du PROPRE type du sort (matching). Un sort multi-élément prend le bonus
 * du type le mieux stacké → stacker n'importe lequel de ses éléments le récompense. C'est ce qui donne
 * du SENS à matcher ton stuff à tes sorts : un sort feu profite de ton +% Feu, plus que d'un +% Givre.
 */
export function spellTypeMult(p: DamageProfile, spellTypes: DamageType[]): number {
  const avg = profileDamageMult(p)
  let matched = 0
  for (const t of spellTypes) matched = Math.max(matched, p.bonus[t] ?? 0)
  return (1 - SPELL_TYPE_MATCH) * avg + SPELL_TYPE_MATCH * (1 + matched)
}
