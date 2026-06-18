import type { DamageType, Enemy, EnemyAbility, ItemType } from './types'
import { DAMAGE_TYPE_LIST } from './damage'
import { enemyHp, enemyDmg, enemyArmor, clampIlvl, lootFarmIlvl, frontierIlvl, lagAt, chapitreOf, ILVL_CAP_BASE, ILVL_CAP_ENDGAME } from './progression'

/**
 * RAIDS — refonte v0.23 « un boss, dix tiers ».
 *
 * Chaque raid est désormais UN AFFRONTEMENT UNIQUE contre un boss (un duo pour l'Abîme),
 * et le boss CHANGE À CHAQUE TIER : 5 visages par raid, chacun avec son kit télégraphié et
 * sa mécanique propre, qui reviennent « Éveillés » (plus vicieux) au-delà du tier 5.
 *
 *  - une IDENTITÉ par raid (lore, couleur, mécaniques signature),
 *  - un BUTIN CIBLÉ par catégorie d'équipement (Armes / Bijoux / Armures / Résistances / Tout),
 *  - des TIERS montés indépendamment, à la courbe DOUCE ET CONSTANTE : chaque tier = +4 paliers
 *    de farm (×~1,9 PV) — fini le mur exponentiel ; ~10 tiers sont atteignables,
 *  - un VRAI GAP de récompense entre tiers : ~+19 iLvl et +1 rang de rareté plancher par tier,
 *  - des RESSOURCES TRÈS RARES (Fragments d'éternité + **Éclat cosmique 💫**, exclusif aux raids).
 *
 * Le combat reste idle : la « difficulté » s'exprime via des seuils de stats (timer d'enrage dur,
 * novas qui one-shot le stuff faible, armure/résistances qui exigent de la pénétration, etc.).
 */

// ---- Mécaniques de boss (checks de stuff) ----

export type RaidMechanicKind =
  | 'berserk'   // ENRAGE DUR : timer de kill ; passé le délai, les dégâts explosent → check de DPS
  | 'nova'      // AoE périodique massive (typée) → check d'EHP / mitigation
  | 'fortress'  // armure + résistance colossales → check de PÉNÉTRATION
  | 'leech'     // le boss se régénère vite → check de BURST
  | 'swarm'     // vagues d'adds qui frappent l'équipe → check d'EHP de groupe
  | 'rotate'    // le boss change de type d'attaque à chaque phase → check de RÉSISTANCES larges
  | 'execute'   // le boss frappe plus fort à mesure qu'il perd ses PV → course contre la montre

export const RAID_MECHANIC_META: Record<RaidMechanicKind, { name: string; icon: string; desc: string }> = {
  berserk: { name: 'Enrage mortel', icon: '⏱️', desc: 'Timer de kill : passé le délai, les dégâts deviennent fatals. Il faut du DPS.' },
  nova: { name: 'Nova cataclysmique', icon: '☄️', desc: 'Explosion périodique qui pulvérise l\'équipe sous-équipée. Il faut des PV et de la mitigation.' },
  fortress: { name: 'Forteresse', icon: '🛡️', desc: 'Armure et résistances colossales. Sans Pénétration, ton DPS s\'effondre.' },
  leech: { name: 'Sangsue', icon: '🩸', desc: 'Le boss régénère sa vie en continu. Sans burst, tu ne le tueras jamais.' },
  swarm: { name: 'Déferlante', icon: '🐛', desc: 'Des vagues de renforts frappent toute l\'équipe. Survie de groupe exigée.' },
  rotate: { name: 'Prisme instable', icon: '🌈', desc: 'Le boss change de type d\'attaque à chaque phase. Il faut résister à TOUT.' },
  execute: { name: 'Acharnement', icon: '💀', desc: 'Plus le boss perd de vie, plus il frappe fort. Achève-le vite.' },
}

// ---- Registre des raids ----

export type RaidId = 'forge' | 'reliquaire' | 'citadelle' | 'nexus' | 'abysse'

export interface RaidDef {
  id: RaidId
  name: string
  icon: string
  color: string
  lore: string
  /** Catégorie d'équipement ciblée par le butin. */
  lootTypes: ItemType[]
  lootLabel: string
  /** Palier de déblocage (bestStage requis) — porte d'ACCÈS uniquement. */
  unlockStage: number
  /**
   * Ancre de DIFFICULTÉ (palier de farm de référence du Tier 1). Par défaut = unlockStage.
   * L'Abîme s'en sert pour être calé sur un Tier ~6 des autres raids (accessible) tout en
   * restant verrouillé derrière le palier 100.
   */
  anchorStage?: number
  /** Raid prérequis : doit avoir été clear (tier ≥ 1) au moins une fois. */
  requires?: RaidId
  /**
   * v0.27 — décalage de TIER MONDIAL. Toutes les courbes de RÉCOMPENSE et de CHECK calculent
   * `tier + tierOffset` (l'Abîme « commence » à un Tier 7 mondial). La DIFFICULTÉ (PV/dégâts, via
   * anchorStage) n'est PAS décalée — elle est déjà calée sur ce niveau.
   */
  tierOffset?: number
  /** v0.27 — porte d'accès « avoir atteint le tier N sur TOUS ces raids » (Abîme = endgame). */
  requiresAllTier?: { raids: RaidId[]; tier: number }
  /** Difficulté de base : multiplie PV et dégâts (≥1, monte d'un raid à l'autre). */
  baseDifficulty: number
  /** Mécaniques signature imposées (identité du raid — les boss de tier en AJOUTENT). */
  signature: RaidMechanicKind[]
  /** Élément principal, ou 'rotating' (le boss cycle les types d'attaque). */
  element: DamageType | 'rotating'
  /** Coût en Orbes de raid pour tenter. */
  orbeCost: number
}

/** Palier (bestStage) qui débloque le PREMIER raid. */
export const RAID_UNLOCK_STAGE = 50

export const RAIDS: Record<RaidId, RaidDef> = {
  forge: {
    id: 'forge', name: 'La Forge des Titans', icon: '⚒️', color: '#ff6b35',
    lore: 'Des enclumes grandes comme des collines, des gardiens de fonte en fusion. Seul un DPS perçant fend leur carapace.',
    lootTypes: ['armePrincipale', 'armeSecondaire'], lootLabel: 'Armes & Boucliers',
    unlockStage: 50, baseDifficulty: 1.0, signature: ['fortress', 'berserk'], element: 'physique', orbeCost: 1,
  },
  reliquaire: {
    id: 'reliquaire', name: 'Le Reliquaire Englouti', icon: '💍', color: '#4dd0e1',
    lore: 'Une crypte noyée où dorment les joyaux des rois morts. Leurs gardiens se ressoudent sans cesse — frappe vite et fort.',
    lootTypes: ['anneau', 'bijou', 'cou'], lootLabel: 'Anneaux, Bijoux & Colliers',
    unlockStage: 50, baseDifficulty: 1.0, signature: ['leech', 'swarm'], element: 'froid', orbeCost: 1,
  },
  citadelle: {
    id: 'citadelle', name: 'La Citadelle Éternelle', icon: '🏰', color: '#ffd43b',
    lore: 'Une forteresse battue par des orages sans fin. Ses sentinelles déchaînent des novas — seule une muraille de PV tient debout.',
    lootTypes: ['tete', 'epaules', 'torse', 'jambes', 'mains', 'taille', 'pieds', 'poignets', 'cape'], lootLabel: 'Pièces d\'armure',
    unlockStage: 50, baseDifficulty: 1.0, signature: ['nova', 'execute'], element: 'foudre', orbeCost: 1,
  },
  nexus: {
    id: 'nexus', name: 'Le Nexus Prismatique', icon: '🌈', color: '#c084fc',
    lore: 'Un cœur de magie pure où la réalité se fracture en sept couleurs. Le boss change d\'élément sans prévenir : résiste à tout, ou meurs.',
    lootTypes: ['cou', 'cape', 'bijou', 'anneau'], lootLabel: 'Accessoires de résistance',
    unlockStage: 50, baseDifficulty: 1.0, signature: ['rotate', 'nova'], element: 'rotating', orbeCost: 2,
  },
  abysse: {
    id: 'abysse', name: 'L\'Abîme Primordial', icon: '🕳️', color: '#8a2be2',
    lore: 'Le gouffre d\'où tout est né et où tout retourne. Les horreurs y chassent PAR PAIRES : abats l\'une, l\'autre entre en furie. Seul endroit au monde où tombe la Régalia du Néant.',
    lootTypes: ['tete', 'epaules', 'torse', 'jambes', 'mains', 'taille', 'pieds', 'poignets', 'cape', 'cou', 'anneau', 'bijou', 'armePrincipale', 'armeSecondaire'], lootLabel: 'Tout + set Régalia du Néant',
    // v0.23 : l'Abîme était EXTRÊMEMENT overtuné (ancré au palier 100 → des milliards de PV au T1).
    // Il reste verrouillé derrière le palier 100, mais sa DIFFICULTÉ est ancrée au palier 70 :
    // son Tier 1 ≈ un Tier 6 du Nexus, puis il scale au même pas (+4 paliers/tier).
    // v0.27 : accès = T7 sur les 4 raids de base (palier 100 RETIRÉ). tierOffset +6 ⇒ son T1 calcule
    // récompenses & checks comme un Tier 7 MONDIAL ; difficulté inchangée (anchorStage 70).
    unlockStage: 50, anchorStage: 70, tierOffset: 6,
    requiresAllTier: { raids: ['forge', 'reliquaire', 'citadelle', 'nexus'], tier: 7 },
    baseDifficulty: 1.9, signature: ['berserk', 'nova'], element: 'rotating', orbeCost: 3,
  },
}

export const RAID_LIST: RaidDef[] = [RAIDS.forge, RAIDS.reliquaire, RAIDS.citadelle, RAIDS.nexus, RAIDS.abysse]

export function getRaidDef(id: RaidId): RaidDef {
  return RAIDS[id]
}

/**
 * v0.27 — TIER MONDIAL : tier affiché + décalage du raid. Pilote TOUTES les courbes de récompense
 * et de check (iLvl, rareté, exigences, trophées, fragments, éclats, enrage). Pour les raids de
 * base (offset 0) c'est l'identité ; pour l'Abîme (+6), son Tier 1 = Tier 7 mondial.
 */
export function globalTier(def: RaidDef, tier: number): number {
  return tier + (def.tierOffset ?? 0)
}

/** Un raid est-il accessible (palier requis + raid prérequis clear + tier requis sur d'autres raids) ? */
export function raidUnlocked(def: RaidDef, bestStage: number, progress: Record<RaidId, number>): boolean {
  if (bestStage < def.unlockStage) return false
  if (def.requires && (progress[def.requires] ?? 0) < 1) return false
  if (def.requiresAllTier && def.requiresAllTier.raids.some((r) => (progress[r] ?? 0) < def.requiresAllTier!.tier)) return false
  return true
}

// ---- Constantes d'équilibrage (v0.30 — courbe UNIFIÉE) ----
// PV/dégâts des boss = base commune b^ilvl (progression.ts) à l'ilvl du raid ; la classe 'raidboss'
// (×13,3 PV / ×2 dégâts vs trash) donne le pool d'un vrai boss (~40 s à stuff calé). Plus de
// premiums propres aux raids : l'ilvl (bande 230→700) ET la classe portent tout.

/**
 * v0.30 — BANDE D'ILVL LINÉAIRE par raid (fini le ×1,22/tier exponentiel qui faisait le snowball).
 * Plancher ÉCHELONNÉ selon la difficulté du raid (Forge 230 … Nexus 500, Abîme 560) + pas CONSTANT
 * de +15 ilvl/tier → un rung ne saute jamais > +20 (jamais de trivialisation du tier précédent).
 * Les 4 raids de base se chevauchent (loot par type, faits en parallèle) en montant vers 700.
 */
// v0.35.1 — DIFFICULTÉ FIXE par tier (ne scale PLUS avec bestStage — retour joueur : « le T1 scale
// avec la puissance de mon palier »). Le tier MONDIAL est ancré à un PALIER de farm ABSOLU : T1 ≈
// palier 50 (déblocage des raids) … T10 ≈ palier 400 (≈ prestige), soit ~+39 paliers/tier (≈ ×1,9 de
// puissance/tier, la pente raid d'origine « +4 paliers/tier »). Un joueur SUR-palier out-gear les bas
// tiers (voulu : il revient les farmer pour la rareté/les mats) ; un joueur calé trouve son tier.
// L'Abîme (tierOffset +6) extrapole au-delà de 400 → contenu post-prestige. La rareté et l'exigence de
// résist montent toujours avec le tier mondial. raidIlvl = gear d'époque du palier ancre (lootFarmIlvl).
// v0.36 — l'ancre des raids suit les CHAPITRES qu'ils gatent (gate-raid §1) : le Raid T(k) ouvre le
// mur du Chapitre 4+k ≈ stage 40+10k → T1 ancré au Chapitre 5 (stage 50), T10 au Chapitre 14 (stage 140).
// raidIlvl = gear d'époque du palier ancre (lootFarmIlvl, capé 200) → un build calé sur le Chapitre rend
// un TTK ~40 s. Fini l'ancre 50→400 du monde ilvl-700.
const RAID_ANCHOR_LOW = 50    // stage ancre du Tier 1 MONDIAL (mur du Chapitre 5)
const RAID_ANCHOR_HIGH = 140  // stage ancre du Tier 10 MONDIAL (mur du Chapitre 14)
const RAID_ANCHOR_SPAN = 10   // nb de tiers mondiaux entre LOW et HIGH (= la pente : +10 stages/tier)
const FORTRESS_ARMOR_MULT = 3.2   // 'fortress' : armure colossale
const FORTRESS_RESIST_BONUS = 0.2 // 'fortress' : +résistance au thème

const ELEMENTS: DamageType[] = DAMAGE_TYPE_LIST

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Vulnérabilité thématique d'un élément (laisse une porte de sortie : varier ses dégâts). */
const VULN: Record<DamageType, DamageType> = {
  physique: 'arcane', feu: 'froid', froid: 'feu', foudre: 'nature',
  nature: 'foudre', arcane: 'ombre', ombre: 'arcane',
}

export interface ActiveRaid {
  raidId: RaidId
  tier: number
  /** Record de farm au lancement (v0.35) : cale l'ilvl/difficulté du raid sur TA tranche. */
  bestStage: number
  name: string
  /** Index du boss en cours (toujours 0 depuis la v0.23 — un seul affrontement). */
  current: number
  totalBosses: number
  /** enemies[0] = le boss (cible d'objectif) ; les suivants = jumeau d'Abîme / renforts (Déferlante). */
  enemies: Enemy[]
  /** Mécaniques du TIER (signature du raid + celles du boss du tier). */
  mechanics: RaidMechanicKind[]
  /** Type d'attaque courant (pour 'rotate'/'rotating'). */
  element: DamageType
  /** Cycle d'éléments pour 'rotate'. */
  rotateList: DamageType[]
  rotateIdx: number
  fightTime: number
  novaCd: number
  swarmCd: number
  rotateCd: number
  /** Délai (s) avant l'enrage mortel sur ce boss. */
  berserkAt: number
  /** Relances automatiques restantes (auto-farm) : à la fin du raid, on relance si > 0 et Orbes suffisantes. */
  repeatLeft?: number
}

/** Palier « effectif » du boss d'un tier — ne sert plus qu'au pacing de l'XP (les PV/dégâts passent
 *  par l'ilvl unifié). Conservé pour ne pas casser la courbe d'XP. */
function effStage(def: RaidDef, tier: number): number {
  return (def.anchorStage ?? def.unlockStage) + (globalTier(def, tier) - 1) * 4
}

/**
 * v0.25.x — SCALING MULTI-PERSO (tous les raids) : +55% de PV de boss par héros au-delà du premier
 * (×1,55 à 2 héros, ×2,1 à 3). Les DÉGÂTS ne scalent pas : la pression vient des capacités et du
 * check de résistance, le pool de PV garantit que le combat dure assez pour qu'ils s'expriment.
 */
export function raidPartyHpMult(partySize: number): number {
  return 1 + 0.55 * Math.max(0, partySize - 1)
}

/** Délai d'enrage dur (s). v0.36 : recalé pour le cap ilvl 200 (raids T1-T10 ∈ ~[65,186]). Aux ilvls
 *  plus bas qu'avant, les secondaires sont moins mûrs → le TTK à stuff CALÉ remonte (~62 s à T1 →
 *  ~45 s à T10) : l'enrage doit rester AU-DESSUS de cette courbe (sinon même le calé tape l'enrage).
 *  Pente douce 78 → plancher 56 → marge de clear positive à tous les tiers (le sous-optimisé échoue). */
export function raidBerserkTime(def: RaidDef, tier: number): number {
  return Math.max(56, 78 - globalTier(def, tier) * 2.2)
}

/** Palier de farm ANCRE d'un tier MONDIAL (T1→LOW … T_SPAN→HIGH ; extrapolé au-delà pour l'Abîme). */
export function raidAnchorPalier(globalTierN: number): number {
  const t = Math.max(1, globalTierN)
  return RAID_ANCHOR_LOW + (t - 1) * (RAID_ANCHOR_HIGH - RAID_ANCHOR_LOW) / (RAID_ANCHOR_SPAN - 1)
}

/**
 * iLvl de DIFFICULTÉ/butin d'un tier — v0.35.1 : FIXE, ancré à un palier de farm absolu (via le tier
 * MONDIAL), indépendant de bestStage. On GARDE l'argument `bestStage` (signature stable, ~8 appelants
 * + harnais) mais il N'EST PLUS LU : la difficulté ne suit plus le joueur. raidIlvl = gear d'époque du
 * palier ancre (lootFarmIlvl) → un joueur calé sur ce palier livre un TTK ~40 s ; un sur-palier out-gear.
 */
export function raidIlvl(def: RaidDef, tier: number, _bestStage = 0): number {
  // v0.36 — l'Abîme (endgame) est la SEULE source d'ilvl > base : un poil au-dessus de 200, le grind
  // ultime (T1 = 204 … plafonné à ILVL_CAP_ENDGAME = 240). Les futurs raids endgame suivront ce patron.
  if (def.id === 'abysse') return Math.min(ILVL_CAP_ENDGAME, ILVL_CAP_BASE + tier * 4)
  // Base raids : ancrés sur le Chapitre gaté (lootFarmIlvl est déjà capé à ILVL_CAP_BASE = 200).
  return clampIlvl(lootFarmIlvl(Math.round(raidAnchorPalier(globalTier(def, tier)))))
}

/**
 * v0.36 — ilvl de DIFFICULTÉ d'un boss de raid (PV / dégâts / armure) : NON CAPÉ → les PV montent à
 * CHAQUE tier indéfiniment (les raids sont l'endgame infini gaté par les Trophées). Le LOOT (raidIlvl)
 * reste capé (200 base / 240 Abîme) ; seule la DIFFICULTÉ continue de grimper. Corrige le plateau de PV.
 */
export function raidDifficultyIlvl(def: RaidDef, tier: number): number {
  const stage = Math.round(raidAnchorPalier(globalTier(def, tier)))
  return clampIlvl(Math.round(frontierIlvl(stage) - lagAt(chapitreOf(stage))))
}

/**
 * Rareté du butin de raid : FENÊTRE À PIC par tier (rollWindowRarity).
 * v0.30 — fenêtre quasi-PLATE : l'ilvl (bande 230→700) porte la progression, PAS la rareté. Le pic
 * ne grimpe que TRÈS lentement (Légendaire→Patrimoine sur 10 tiers, ×~1,2 de DPS) → fini le « creep
 * de rareté » qui ajoutait un snowball par-dessus l'ilvl. Le PLAFOND reste haut (jackpots rares
 * Céleste→Transcendant) : les raids restent la seule source des hautes raretés, mais elles sont
 * un événement, pas le vecteur de puissance.
 */
const RAID_WINDOW_FLOOR = [4, 4, 4, 5, 5, 5, 5, 6, 6, 6]   // T1..T10 : Rare → Légendaire (pic = +2)
const RAID_WINDOW_CAP = [11, 11, 12, 12, 13, 13, 14, 14, 15, 16] // T1..T10 : Céleste → Transcendant (jackpots)

export function raidRarityWindow(def: RaidDef, tier: number): { floor: number; peak: number; cap: number } {
  const i = Math.max(0, Math.min(RAID_WINDOW_FLOOR.length - 1, globalTier(def, tier) - 1))
  const floor = RAID_WINDOW_FLOOR[i]
  return { floor, peak: floor + 2, cap: RAID_WINDOW_CAP[i] }
}

/** Rareté plancher de la fenêtre (affichage). */
export function raidMinTier(def: RaidDef, tier: number): number {
  return raidRarityWindow(def, tier).floor
}

/** Rareté plafond ATTEIGNABLE de la fenêtre (affichage — traîne très rare). */
export function raidMaxTier(def: RaidDef, tier: number): number {
  return raidRarityWindow(def, tier).cap
}

/**
 * Nombre d'objets du coffre (v0.24, DESIGN §4.4) : 1 GARANTI (2 pour l'Abîme) + tirages
 * bonus indépendants dont la chance monte avec le tier — radin, mais juteux quand ça proc.
 *   T1 : +1 à 5% · +2 à 2.5%   ·   T5 : +1 à 25% · +2 à 12.5% · +3 à 5%   ·   T10 : 50/25/10%.
 */
export function rollRaidLootCount(def: RaidDef, tier: number): number {
  const gt = globalTier(def, tier)
  let n = def.id === 'abysse' ? 2 : 1
  const p1 = Math.min(0.5, 0.05 * gt)
  if (Math.random() < p1) n++
  if (Math.random() < p1 * 0.5) n++
  if (gt >= 3 && Math.random() < p1 * 0.2) n++
  return n
}

// ---- 🏆 Trophées (v0.24, DESIGN §4.5) : la monnaie de PASSAGE DE TIER, par raid ----
// Chaque victoire au tier T rapporte T Trophées de CE raid ; débloquer le tier suivant coûte
// ~5 clears du tier courant (ou plus de clears de tiers inférieurs). Chaque tier est un mur :
// on farme le T(n) — stuff + Trophées — pour ouvrir le T(n+1).

/** Trophées gagnés par victoire (= le tier MONDIAL vaincu — v0.27). */
export function raidTrophyGain(def: RaidDef, tier: number): number {
  return globalTier(def, tier)
}

/** Coût en Trophées du déblocage du tier `next` (≈ 5 clears du tier précédent, en tier mondial). */
export function raidTierUnlockCost(def: RaidDef, next: number): number {
  return 5 * Math.max(1, globalTier(def, next) - 1)
}

/** Fragments d'éternité gagnés. */
export function raidFragments(def: RaidDef, tier: number): number {
  const gt = globalTier(def, tier)
  return 1 + gt + (def.id === 'abysse' ? gt : 0)
}

/** Chance d'Éclat cosmique 💫 (ressource ultra-rare, exclusive aux raids). */
export function raidCosmicChance(def: RaidDef, tier: number): number {
  const base = 0.04 + globalTier(def, tier) * 0.05
  return Math.min(0.95, base * (def.id === 'abysse' ? 2.2 : 1))
}

/** Quantité d'Éclats cosmiques quand le tirage réussit (plus aux hauts tiers / Abîme). */
export function raidCosmicQty(def: RaidDef, tier: number): number {
  return 1 + Math.floor(globalTier(def, tier) / 4) + (def.id === 'abysse' ? 1 : 0)
}

/** Type d'objet aléatoire dans la catégorie ciblée du raid. */
export function pickRaidLootType(def: RaidDef): ItemType {
  return pick(def.lootTypes)
}

// ---- Boss de tier : 5 visages par raid, chacun avec sa mécanique et son kit ----

/** Cale les premières incantations d'un kit (pas de salve à t=0). */
function stagger(out: EnemyAbility[]): EnemyAbility[] {
  out.forEach((a, i) => { a.cd = a.cooldown * (0.6 + i * 0.35) })
  return out
}

export interface RaidBossVariant {
  name: string
  /** Identité mécanique du tier — une ligne, affichée au joueur. */
  blurb: string
  /** Mécaniques AJOUTÉES à la signature du raid pour ce boss. */
  extra: RaidMechanicKind[]
  /** Tweaks de stats (1 = neutre). */
  hp?: number
  dmg?: number
  armor?: number
  /** Rotation d'éléments imposée par CE boss (raids à élément fixe qui « tournent » sur ce tier). */
  rotate?: DamageType[]
  /** Kit de techniques télégraphiées (element = type d'attaque courant). */
  abilities: (element: DamageType) => EnemyAbility[]
  /** Abîme uniquement : nom et kit du JUMEAU du duo. */
  partnerName?: string
  partnerAbilities?: () => EnemyAbility[]
}

/**
 * Les visages de chaque raid : le tier T affronte le boss (T-1) mod 5. Au-delà du tier 5,
 * les mêmes reviennent « ÉVEILLÉS » : +1 mécanique, +12% de dégâts (voir raidBossVariant).
 */
const RAID_BOSSES: Record<RaidId, RaidBossVariant[]> = {
  forge: [
    {
      name: 'Hagen, l\'Enclume Vivante', blurb: 'Un mur de métal : armure colossale, marteau télégraphié à parer.',
      extra: [], armor: 1.25,
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Marteau-pilon', icon: '🔨', cooldown: 11, magnitude: 3.0, telegraph: 1.8 },
        { kind: 'dot', element: 'feu', name: 'Coulée de fonte', icon: '🌋', cooldown: 8, magnitude: 0.9, duration: 4 },
      ],
    },
    {
      name: 'Pyrax le Fondeur', blurb: 'La forge déborde : éruptions de zone et métal en fusion qui ronge l\'équipe.',
      extra: ['nova'], hp: 0.95,
      abilities: () => [
        { kind: 'burst', element: 'feu', name: 'Geyser de fonte', icon: '🌋', cooldown: 10, magnitude: 2.8, telegraph: 1.6 },
        { kind: 'dot', element: 'feu', name: 'Métal liquide', icon: '🫠', cooldown: 7, magnitude: 1.1, duration: 5 },
      ],
    },
    {
      name: 'Le Marteau Primordial', blurb: 'Course contre l\'enclume : moins de PV, mais il s\'acharne — du DPS, vite.',
      extra: ['execute'], hp: 0.8, dmg: 1.1,
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Frappe sismique', icon: '💥', cooldown: 10, magnitude: 3.4, telegraph: 1.7 },
        { kind: 'cc', element: 'physique', name: 'Onde assourdissante', icon: '🔔', cooldown: 12, magnitude: 0, duration: 1.5 },
      ],
    },
    {
      name: 'Vulcanar, Maître-Forge', blurb: 'Ses automates déferlent sans fin : survie de groupe exigée.',
      extra: ['swarm'],
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Marteau-pilon', icon: '🔨', cooldown: 11, magnitude: 2.9, telegraph: 1.8 },
        { kind: 'debuff', element: 'arcane', name: 'Appel de la chaîne', icon: '⛓️', cooldown: 12, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'L\'Âme de la Forge', blurb: 'Le feu originel se ressoude sans cesse : du burst, à travers l\'armure.',
      extra: ['leech'], armor: 1.15,
      abilities: () => [
        { kind: 'burst', element: 'feu', name: 'Souffle du creuset', icon: '🔥', cooldown: 11, magnitude: 3.2, telegraph: 1.9 },
        { kind: 'dot', element: 'feu', name: 'Brasier éternel', icon: '♨️', cooldown: 8, magnitude: 1.0, duration: 4 },
        { kind: 'drain', element: 'feu', name: 'Fonte vampirique', icon: '🩸', cooldown: 14, magnitude: 1.6 },
      ],
    },
  ],
  reliquaire: [
    {
      name: 'La Gardienne Noyée', blurb: 'Les flots la ressoudent : burst obligatoire, raz-de-marée à parer.',
      extra: [],
      abilities: () => [
        { kind: 'burst', element: 'froid', name: 'Raz-de-marée abyssal', icon: '🌊', cooldown: 10, magnitude: 2.8, telegraph: 1.6 },
        { kind: 'cc', element: 'froid', name: 'Étreinte glaçante', icon: '🧊', cooldown: 12, magnitude: 0, duration: 1.6 },
      ],
    },
    {
      name: 'Ossric aux Mille Bagues', blurb: 'L\'avare drape sa vie dans la tienne : drains et malédictions.',
      extra: [], armor: 1.1,
      abilities: () => [
        { kind: 'drain', element: 'arcane', name: 'Dîme des anneaux', icon: '💍', cooldown: 12, magnitude: 1.8 },
        { kind: 'debuff', element: 'arcane', name: 'Malédiction d\'avarice', icon: '🪙', cooldown: 10, magnitude: 0, duration: 6 },
        { kind: 'burst', element: 'froid', name: 'Pluie de joyaux', icon: '💎', cooldown: 13, magnitude: 2.6, telegraph: 1.5 },
      ],
    },
    {
      name: 'Le Conservateur Éternel', blurb: 'Une vitrine blindée : armure de musée et contrôles glaçants.',
      extra: ['fortress'], hp: 1.1, dmg: 0.9,
      abilities: () => [
        { kind: 'cc', element: 'froid', name: 'Mise sous verre', icon: '🫙', cooldown: 11, magnitude: 0, duration: 1.8 },
        { kind: 'dot', element: 'froid', name: 'Givre conservateur', icon: '❄️', cooldown: 8, magnitude: 0.9, duration: 5 },
      ],
    },
    {
      name: 'Néréa des Profondeurs', blurb: 'L\'abîme se soulève : lames de fond glacées en cadence.',
      extra: ['nova'],
      abilities: () => [
        { kind: 'burst', element: 'froid', name: 'Lame de fond', icon: '🌊', cooldown: 10, magnitude: 3.2, telegraph: 1.8 },
        { kind: 'debuff', element: 'froid', name: 'Chant des noyés', icon: '🎶', cooldown: 13, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'Le Roi des Marées', blurb: 'Plus il saigne, plus la marée frappe fort — achève-le vite.',
      extra: ['execute', 'nova'], hp: 1.05,
      abilities: () => [
        { kind: 'burst', element: 'froid', name: 'Vague scélérate', icon: '🌊', cooldown: 11, magnitude: 3.5, telegraph: 2.0 },
        { kind: 'dot', element: 'froid', name: 'Ressac', icon: '🌀', cooldown: 8, magnitude: 1.0, duration: 4 },
        { kind: 'drain', element: 'froid', name: 'Reflux', icon: '🩸', cooldown: 14, magnitude: 1.6 },
      ],
    },
  ],
  citadelle: [
    {
      name: 'Le Sénéchal de Foudre', blurb: 'L\'orage au garde-à-vous : novas réglées comme du papier à musique.',
      extra: [],
      abilities: () => [
        { kind: 'burst', element: 'foudre', name: 'Fracas du ciel', icon: '🌩️', cooldown: 11, magnitude: 3.4, telegraph: 2.0 },
        { kind: 'cc', element: 'foudre', name: 'Tonnerre assourdissant', icon: '🔔', cooldown: 13, magnitude: 0, duration: 1.4 },
      ],
    },
    {
      name: 'Tour-Vivante Aldric', blurb: 'Une tour qui marche : armure colossale, coups lents mais écrasants.',
      extra: ['fortress'], armor: 1.3, hp: 1.1, dmg: 0.95,
      abilities: () => [
        { kind: 'burst', element: 'physique', name: 'Chute de créneaux', icon: '🧱', cooldown: 13, magnitude: 3.6, telegraph: 2.2 },
        { kind: 'cc', element: 'physique', name: 'Verrouillage', icon: '🔒', cooldown: 12, magnitude: 0, duration: 1.6 },
      ],
    },
    {
      name: 'Le Rempart Hurlant', blurb: 'Son hurlement appelle la garnison : renforts en vagues continues.',
      extra: ['swarm'],
      abilities: () => [
        { kind: 'debuff', element: 'foudre', name: 'Hurlement du rempart', icon: '📢', cooldown: 11, magnitude: 0, duration: 5 },
        { kind: 'burst', element: 'foudre', name: 'Salve de tourelles', icon: '🏹', cooldown: 9, magnitude: 2.8, telegraph: 1.5 },
      ],
    },
    {
      name: 'Castellan Vorn', blurb: 'Il se nourrit de l\'orage : régénération continue, burst exigé.',
      extra: ['leech'],
      abilities: () => [
        { kind: 'drain', element: 'foudre', name: 'Siphon d\'orage', icon: '⚡', cooldown: 13, magnitude: 1.7 },
        { kind: 'burst', element: 'foudre', name: 'Fracas du ciel', icon: '🌩️', cooldown: 11, magnitude: 3.2, telegraph: 1.9 },
      ],
    },
    {
      name: 'L\'Orage Couronné', blurb: 'Le ciel entier se déchaîne — et change de visage : foudre, froid, nature.',
      extra: ['rotate'], rotate: ['foudre', 'froid', 'nature'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Couronnement', icon: '👑', cooldown: 10, magnitude: 3.3, telegraph: 1.8 },
        { kind: 'dot', element: 'nature', name: 'Pluie battante', icon: '🌧️', cooldown: 8, magnitude: 0.9, duration: 4 },
      ],
    },
  ],
  nexus: [
    {
      name: 'Le Prisme Brisé', blurb: 'Sept couleurs, sept morsures : résiste à tout.',
      extra: [],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Rayon prismatique', icon: '🔆', cooldown: 9, magnitude: 3.0, telegraph: 1.6 },
        { kind: 'debuff', element: 'arcane', name: 'Distorsion chromatique', icon: '🌀', cooldown: 12, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'Iris, Cœur du Spectre', blurb: 'Elle boit la lumière : sa vie remonte sans cesse.',
      extra: ['leech'],
      abilities: (element) => [
        { kind: 'drain', element: 'arcane', name: 'Absorption spectrale', icon: '👁️', cooldown: 12, magnitude: 1.8 },
        { kind: 'burst', element, name: 'Rayon prismatique', icon: '🔆', cooldown: 10, magnitude: 2.9, telegraph: 1.6 },
      ],
    },
    {
      name: 'L\'Écho Polychrome', blurb: 'Chaque couleur fait naître un écho : la nuée submerge.',
      extra: ['swarm'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Réverbération', icon: '🔊', cooldown: 9, magnitude: 2.7, telegraph: 1.5 },
        { kind: 'debuff', element: 'arcane', name: 'Écho dissonant', icon: '🎭', cooldown: 11, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'Chromax l\'Instable', blurb: 'Une bombe arc-en-ciel : enrage express et fission continue.',
      extra: ['berserk'], hp: 0.9, dmg: 1.05,
      abilities: (element) => [
        { kind: 'burst', element, name: 'Surcharge chromatique', icon: '💥', cooldown: 9, magnitude: 3.4, telegraph: 1.6 },
        { kind: 'dot', element: 'arcane', name: 'Fission', icon: '☢️', cooldown: 7, magnitude: 1.0, duration: 4 },
      ],
    },
    {
      name: 'Le Kaléidoscope', blurb: 'Toutes les couleurs à la fois : un mur prismatique qui s\'acharne.',
      extra: ['fortress', 'execute'], armor: 1.2, hp: 1.1,
      abilities: (element) => [
        { kind: 'burst', element, name: 'Spirale kaléidoscopique', icon: '🌀', cooldown: 10, magnitude: 3.2, telegraph: 1.8 },
        { kind: 'dot', element: 'arcane', name: 'Facettes coupantes', icon: '🔪', cooldown: 8, magnitude: 0.9, duration: 4 },
        { kind: 'cc', element: 'arcane', name: 'Verre figeant', icon: '🫙', cooldown: 13, magnitude: 0, duration: 1.4 },
      ],
    },
  ],
  abysse: [
    {
      name: 'Le Premier Silence', partnerName: 'Nul, le Dévoreur',
      blurb: 'Le silence annihile, le dévoreur boit : pare l\'Annihilation ou meurs.',
      extra: ['fortress'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Annihilation', icon: '💥', cooldown: 12, magnitude: 4.0, telegraph: 2.2 },
        { kind: 'dot', element: 'ombre', name: 'Corruption du néant', icon: '🕳️', cooldown: 8, magnitude: 1.0, duration: 5 },
      ],
      partnerAbilities: () => [
        { kind: 'cc', element: 'ombre', name: 'Étreinte du vide', icon: '🕳️', cooldown: 11, magnitude: 0, duration: 1.8 },
        { kind: 'drain', element: 'ombre', name: 'Dévoration', icon: '👄', cooldown: 13, magnitude: 1.8 },
      ],
    },
    {
      name: 'L\'Œil du Gouffre', partnerName: 'Ce-Qui-Reste',
      blurb: 'L\'Œil voit tes failles — plus tu le blesses, plus il frappe ; Ce-Qui-Reste te draine.',
      extra: ['execute'],
      abilities: () => [
        { kind: 'burst', element: 'ombre', name: 'Regard qui défait', icon: '👁️', cooldown: 11, magnitude: 3.8, telegraph: 2.0 },
        { kind: 'debuff', element: 'arcane', name: 'Iris du vide', icon: '🌀', cooldown: 10, magnitude: 0, duration: 6 },
      ],
      partnerAbilities: () => [
        { kind: 'dot', element: 'ombre', name: 'Lambeaux', icon: '🩹', cooldown: 7, magnitude: 1.1, duration: 5 },
        { kind: 'drain', element: 'ombre', name: 'Siphon d\'essence', icon: '🫗', cooldown: 13, magnitude: 1.6 },
      ],
    },
    {
      name: 'Abyssa la Primordiale', partnerName: 'Le Néant Couronné',
      blurb: 'Le couple royal du gouffre : leur cour déferle en renforts incessants.',
      extra: ['swarm'],
      abilities: (element) => [
        { kind: 'burst', element, name: 'Annihilation', icon: '💥', cooldown: 12, magnitude: 4.0, telegraph: 2.2 },
        { kind: 'debuff', element: 'ombre', name: 'Couronne d\'ombre', icon: '👑', cooldown: 12, magnitude: 0, duration: 5 },
      ],
      partnerAbilities: () => [
        { kind: 'cc', element: 'ombre', name: 'Étreinte du vide', icon: '🕳️', cooldown: 11, magnitude: 0, duration: 1.8 },
        { kind: 'drain', element: 'ombre', name: 'Tribut du Néant', icon: '🫴', cooldown: 14, magnitude: 1.7 },
      ],
    },
    {
      name: 'La Faim', partnerName: 'La Soif',
      blurb: 'Deux gueules, un seul appétit : tout ce qu\'elles touchent les nourrit.',
      extra: ['leech'],
      abilities: () => [
        { kind: 'burst', element: 'ombre', name: 'Gueule béante', icon: '🦷', cooldown: 10, magnitude: 3.6, telegraph: 1.8 },
        { kind: 'drain', element: 'ombre', name: 'Voracité', icon: '👄', cooldown: 12, magnitude: 2.0 },
      ],
      partnerAbilities: () => [
        { kind: 'drain', element: 'froid', name: 'Soif inextinguible', icon: '🥶', cooldown: 12, magnitude: 2.0 },
        { kind: 'debuff', element: 'arcane', name: 'Assèchement', icon: '🏜️', cooldown: 11, magnitude: 0, duration: 5 },
      ],
    },
    {
      name: 'L\'Avant-Monde', partnerName: 'L\'Après-Tout',
      blurb: 'Ce qui fut et ce qui sera : le temps se fracture, les éléments défilent.',
      extra: ['rotate', 'fortress'], armor: 1.15,
      abilities: (element) => [
        { kind: 'burst', element, name: 'Annihilation', icon: '💥', cooldown: 12, magnitude: 4.2, telegraph: 2.3 },
        { kind: 'cc', element: 'arcane', name: 'Paradoxe', icon: '⏳', cooldown: 12, magnitude: 0, duration: 1.6 },
      ],
      partnerAbilities: () => [
        { kind: 'dot', element: 'arcane', name: 'Échos d\'avant', icon: '🌀', cooldown: 8, magnitude: 1.0, duration: 5 },
        { kind: 'drain', element: 'arcane', name: 'Siphon temporel', icon: '⌛', cooldown: 13, magnitude: 1.7 },
      ],
    },
  ],
}

/** Ordre d'octroi de la mécanique bonus des boss ÉVEILLÉS (la première absente du kit du tier). */
const AWAKENED_EXTRA: RaidMechanicKind[] = ['execute', 'leech', 'swarm', 'fortress', 'berserk', 'nova', 'rotate']
/** Bonus de dégâts des boss Éveillés (tiers 6+). */
const AWAKENED_DMG = 1.12
const AWAKENED_HP = 1.05

export interface ResolvedBoss {
  variant: RaidBossVariant
  name: string
  partnerName?: string
  blurb: string
  /** Mécaniques complètes du tier (signature + boss + éveil). */
  mechanics: RaidMechanicKind[]
  awakened: boolean
  hpMult: number
  dmgMult: number
  armorMult: number
}

/** Résout le boss d'un tier : visage (cycle de 5), mécaniques fusionnées, éveil au-delà du tier 5. */
export function raidBossVariant(def: RaidDef, tier: number): ResolvedBoss {
  const list = RAID_BOSSES[def.id]
  const variant = list[(Math.max(1, tier) - 1) % list.length]
  const awakened = tier > list.length
  const mechanics: RaidMechanicKind[] = [...def.signature]
  for (const m of variant.extra) if (!mechanics.includes(m)) mechanics.push(m)
  if (awakened) {
    const bonus = AWAKENED_EXTRA.find((m) => !mechanics.includes(m))
    if (bonus) mechanics.push(bonus)
  }
  return {
    variant,
    name: awakened ? `${variant.name} · Éveillé` : variant.name,
    ...(variant.partnerName ? { partnerName: awakened ? `${variant.partnerName} · Éveillé` : variant.partnerName } : {}),
    blurb: awakened ? `${variant.blurb} ÉVEILLÉ : une mécanique de plus, des coups plus durs.` : variant.blurb,
    mechanics,
    awakened,
    hpMult: (variant.hp ?? 1) * (awakened ? AWAKENED_HP : 1),
    dmgMult: (variant.dmg ?? 1) * (awakened ? AWAKENED_DMG : 1),
    armorMult: variant.armor ?? 1,
  }
}

/** Mécaniques complètes d'un tier (raccourci pour l'UI et les recommandations). */
export function raidMechanics(def: RaidDef, tier: number): RaidMechanicKind[] {
  return raidBossVariant(def, tier).mechanics
}

/** DPS recommandé (contre le timer d'enrage). L'Abîme = duo (+10% de PV totaux).
 *  `partySize` : les PV du boss scalent avec l'équipe → le DPS demandé aussi. */
export function recommendedDps(def: RaidDef, tier: number, bestStage: number, partySize = 1): number {
  const hp = bossHp(def, tier, bestStage, partySize) * (def.id === 'abysse' ? PAIR_HP_TOTAL : 1)
  return Math.round(hp / raidBerserkTime(def, tier))
}

/** PV effectifs recommandés (encaisser ~8 s du boss + une nova). */
export function recommendedEhp(def: RaidDef, tier: number, bestStage: number): number {
  const dmg = bossDamage(def, tier, bestStage)
  const novaSpike = raidMechanics(def, tier).includes('nova') ? dmg * NOVA_MULT : 0
  return Math.round(dmg * 8 + novaSpike)
}

/** Multiplicateur de la Nova cataclysmique (AoE périodique) — partagé avec le tick de combat.
 *  v0.24 : 4.5 → 3.6 (compense la perte de la résist-réduction ; l'exigence fait le reste). */
export const NOVA_MULT = 3.6

// ---- Exigences de résistance (v0.24 — LE check de stuff par boss, voir resist.ts) ----

/** Exigence de base d'un raid à un tier (sur ses types d'ATTAQUE).
 *  v0.25.x : relevée (~+30%) — le joueur battait les boss à ×2,3 subis sans une ligne de résist.
 *  L'exigence doit être LE projet de stuff du tier, pas une taxe ignorable. */
export function raidReq(def: RaidDef, tier: number): number {
  return Math.round(70 + def.baseDifficulty * 30 + (globalTier(def, tier) - 1) * 34)
}

/**
 * Exigences PAR TYPE du boss d'un tier : types d'attaque (plein Req — adouci si le boss tourne
 * sur 3 types ou plus) + types du kit télégraphié (70% du Req). C'est la « fiche de boss » :
 * affichée avant l'engagement pour préparer son stuff de résistance.
 */
export function raidReqs(def: RaidDef, tier: number): Partial<Record<DamageType, number>> {
  const req = raidReq(def, tier)
  const v = raidBossVariant(def, tier)
  const out: Partial<Record<DamageType, number>> = {}
  const attackEls = v.variant.rotate ?? (def.element === 'rotating' ? [...DAMAGE_TYPE_LIST] : [def.element])
  const broad = attackEls.length >= 3 ? 0.8 : 1 // multi-type : exigence plus large mais moins haute
  for (const t of attackEls) out[t] = Math.max(out[t] ?? 0, Math.round(req * broad))
  const kit = [...v.variant.abilities(attackEls[0]), ...(v.variant.partnerAbilities ? v.variant.partnerAbilities() : [])]
  for (const ab of kit) {
    if (ab.magnitude <= 0) continue
    out[ab.element] = Math.max(out[ab.element] ?? 0, Math.round(req * 0.7))
  }
  return out
}

function bossHp(def: RaidDef, tier: number, _bestStage: number, partySize = 1): number {
  // v0.36 — PV ancrés sur l'ilvl de DIFFICULTÉ (non capé) → montent à chaque tier, plus de plateau.
  const v = raidBossVariant(def, tier)
  return Math.round(enemyHp(raidDifficultyIlvl(def, tier), 'raidboss') * v.hpMult * raidPartyHpMult(partySize))
}

function bossDamage(def: RaidDef, tier: number, _bestStage: number): number {
  const v = raidBossVariant(def, tier)
  return Math.round(enemyDmg(raidDifficultyIlvl(def, tier), 'raidboss') * v.dmgMult)
}

/** Construit le boss du tier. `element` = type d'attaque courant (pour les raids 'rotating'). */
export function makeRaidBoss(def: RaidDef, tier: number, element: DamageType, bestStage: number, partySize = 1): Enemy {
  const eff = effStage(def, tier)
  const v = raidBossVariant(def, tier)
  const maxHp = bossHp(def, tier, bestStage, partySize)

  // Le boss RÉSISTE à son thème (élément maison), avec une vulnérabilité = porte de sortie.
  const home: DamageType = def.element === 'rotating' ? 'arcane' : def.element
  const resist: Partial<Record<DamageType, number>> = {}
  resist[home] = 0.55 + (v.mechanics.includes('fortress') ? FORTRESS_RESIST_BONUS : 0)
  resist[VULN[home]] = -0.3

  const armorMult = (v.mechanics.includes('fortress') ? FORTRESS_ARMOR_MULT : 1.4) * v.armorMult

  return {
    name: `★ ${def.icon} ${v.name}`,
    maxHp,
    hp: maxHp,
    // v0.30 — armure unifiée (scale b^ilvl → Pénétration pertinente ; fortress ×3,2).
    armor: Math.round(enemyArmor(raidDifficultyIlvl(def, tier), armorMult)),
    damage: bossDamage(def, tier, bestStage),
    xp: Math.round(8 * Math.pow(1.12, eff - 1) * 6),
    resist,
    damageType: element,
    // Exigences de résistance du tier (v0.24) : LE check de stuff — affichées en fiche de boss.
    reqs: raidReqs(def, tier),
    elite: true,
    // Boss de raid : esquive marquée (→ Précision) + étourdissement régulier (→ Ténacité).
    boss: true,
    dodge: 0.2,
    ccDur: 2,
    ccCd: 6,
    // Kit signature TÉLÉGRAPHIÉ du boss du tier — à contrer (bouclier/immunité/Ténacité/Purge…).
    abilities: stagger(v.variant.abilities(element)),
  }
}

// ---- Duo de l'Abîme : les boss chassent PAR PAIRES (kits distincts, furie du survivant) ----

/** Répartition des PV du duo : chaque membre porte 55% des PV d'un boss seul (total ×1,1). */
const PAIR_HP_FRAC = 0.55
const PAIR_HP_TOTAL = PAIR_HP_FRAC * 2
/** Dégâts de chaque membre du duo (le total dépasse un boss seul → pression de groupe). */
const PAIR_DMG_FRAC = 0.7
/** Furie du survivant : multiplicateur de dégâts quand son jumeau meurt. */
export const PAIR_ENRAGE_MULT = 1.5

/**
 * Construit la RENCONTRE d'un tier : le boss du tier seul, ou le DUO de l'Abîme — deux boss
 * simultanés aux pouvoirs distincts (burst télégraphié d'un côté, contrôle/drain de l'autre).
 * Quand l'un tombe, l'autre entre en FURIE (+50% dégâts) → l'ordre de kill et les contres comptent.
 */
export function makeRaidEncounter(def: RaidDef, tier: number, element: DamageType, bestStage: number, partySize = 1): Enemy[] {
  const main = makeRaidBoss(def, tier, element, bestStage, partySize)
  const v = raidBossVariant(def, tier)
  if (def.id !== 'abysse' || !v.partnerName) return [main]
  const partner: Enemy = {
    ...main,
    name: `★ ${def.icon} ${v.partnerName}`,
    maxHp: Math.round(main.maxHp * PAIR_HP_FRAC),
    hp: Math.round(main.maxHp * PAIR_HP_FRAC),
    damage: Math.round(main.damage * PAIR_DMG_FRAC),
    xp: Math.round(main.xp * 0.5),
    abilities: stagger(v.variant.partnerAbilities ? v.variant.partnerAbilities() : []),
  }
  main.maxHp = Math.round(main.maxHp * PAIR_HP_FRAC)
  main.hp = main.maxHp
  main.damage = Math.round(main.damage * PAIR_DMG_FRAC)
  return [main, partner]
}

/** Plafond de rejetons SIMULTANÉS de la Déferlante — monte avec le tier (la « difficulté »).
 *  v0.25.x : les rejetons ne disparaissent plus tout seuls (plus de lifetime) → ils s'accumulent
 *  jusqu'au plafond tant qu'on ne les tue pas. Les ignorer devient un vrai choix de pression. */
export function raidMaxAdds(tier: number): number {
  return 2 + Math.floor(tier / 4) // T1-3 : 2 · T4-7 : 3 · T8+ : 4
}

/**
 * Crée un RENFORT de raid (mécanique Déferlante) : un add PERSISTANT (v0.25.x — il reste jusqu'à
 * sa mort, plus d'expiration) qui frappe l'équipe. Le nombre simultané est plafonné (raidMaxAdds).
 */
export function makeRaidAdd(def: RaidDef, tier: number, element: DamageType, bestStage: number, partySize = 1): Enemy {
  const ilvl = raidDifficultyIlvl(def, tier)
  // v0.30 — renfort = ennemi de classe 'elite' à l'ilvl du raid (× scaling multi-perso) ; il frappe
  // ~45 % d'un boss (pression de groupe, pas un second mur).
  const hp = Math.round(enemyHp(ilvl, 'elite') * raidPartyHpMult(partySize))
  // Les renforts exigent moitié moins que le boss (pression de groupe, pas un second check).
  const reqs: Partial<Record<DamageType, number>> = {}
  const br = raidReqs(def, tier)
  for (const t in br) reqs[t as DamageType] = Math.round((br[t as DamageType] ?? 0) * 0.5)
  return {
    name: `${def.icon} Rejeton`,
    maxHp: hp,
    hp,
    armor: Math.round(enemyArmor(ilvl)),
    damage: Math.round(bossDamage(def, tier, bestStage) * 0.45),
    xp: 0,
    resist: {},
    damageType: element,
    reqs,
    add: true,
  }
}

/** Crée le cycle d'éléments d'attaque (raids 'rotating' / boss de tier qui « tournent »). */
function rotateListFor(def: RaidDef, tier: number): DamageType[] {
  const v = raidBossVariant(def, tier)
  if (v.variant.rotate) return [...v.variant.rotate]
  if (def.element === 'rotating') return [...ELEMENTS]
  // Raid à élément fixe : pas de rotation (un seul élément).
  return [def.element]
}

/** Génère un raid prêt à jouer : UN affrontement contre le boss du tier.
 *  `partySize` : nombre de héros — les PV du boss scalent (raidPartyHpMult). */
export function generateRaid(raidId: RaidId, tier: number, bestStage: number, partySize = 1): ActiveRaid {
  const def = RAIDS[raidId]
  const v = raidBossVariant(def, tier)
  const rotateList = rotateListFor(def, tier)
  const startEl = rotateList[0]
  return {
    raidId,
    tier,
    bestStage,
    name: `${def.name} · Tier ${tier}`,
    current: 0,
    totalBosses: 1,
    enemies: makeRaidEncounter(def, tier, startEl, bestStage, partySize),
    mechanics: v.mechanics,
    element: startEl,
    rotateList,
    rotateIdx: 0,
    fightTime: 0,
    novaCd: 6,
    swarmCd: 5,
    rotateCd: 8,
    berserkAt: raidBerserkTime(def, tier),
  }
}
