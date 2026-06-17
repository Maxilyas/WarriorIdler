import { create } from 'zustand'
import type {
  Equipment, Item, Affix, PrimaryStat, OffensiveStat, SecondaryStat, EquipSlotId, ItemType, Enemy, DamageType, RarityId, Character, PowerDef, EnemyAbility,
} from './types'
import { rollHit, incomingDps, genericMitigation, theoreticalDps } from './combat'
import { resistMult, enemyReq, resistSurplus, RESIST_DSCALE } from './resist'
import type { DerivedStats } from './stats'
import {
  makeCharacter, charDerived, charMaxHp, charDamageProfile, charPassives,
  charResist, charCombatMods, abilityPower, powerScale, computeUnlockedPowers, setGlobalCombatMods, setGlobalPrestigeResist,
  setPactDerivedMods, talentPointsForLevel, charDeck, isGenerator, GENERATOR_SLOTS, type CombatMods as CharCombatMods,
} from './character'
import { getTalent, canAllocate, canAllocatePantheon, nodeTree, eveilBudget } from './talents'
import { getPower } from './powers'
import { getUpgrade, upgradeCost as accountUpgradeCost, upgradePoussiere, upgradeEclats, isMaxed, computeGlobalMods, REMOVED_UPGRADES } from './upgrades'
import { achievementBonuses, evaluateNewAchievements, fullyEquippedMinIlvl, getAchievement, type AchvCtx } from './achievements'
import { cosmeticCost } from './avatar'
import {
  generateItem, rollBoxRarity, rollWindowRarity, rollFarmRarity, sellValue, recycleValue, recyclePoussiere, itemScore,
  reforgeItem, surillvlItem, ascendItem,
  reforgeCost, surillvlCost, ascendCost, createCost, transmuteCost, maxCraftTier, craftRaidGate, contentRarityTier,
  SURILLVL_OVER_MARGIN,
  enhanceTypedAffixes, quintRefund, relicFromItem,
} from './items'
import { constellationMods, echosGain, getConstNode, nodeCost, RELIC_BASE_ILVL } from './prestige'
import {
  craftMods, metierXpGain, canLearnNode, getMetierNode, respecCost, emptyMetiers, migrateLegacyForge,
  levelFromXp, METIERS, METIER_LIST, METIER_NODES, METIER_BRANCHES, AUTOMATE_FORGERON_LEVELS,
  pointsSpentInBranch, respecBranchCost,
  forgeBonus, signatureLingotCost, smeltLingots, MASTERWORK_LINGOTS,
  type MetierId, type MetiersState,
} from './metiers'
import { itemSockets, unsocketCost, parseGemKey } from './gems'
import {
  getEnchant, enchantCost, equippedRules, equippedTimeRunes, timeRuneMods, rollRuneDrop,
  raidRuneChance, dungeonRuneChance,
  equippedPacts, pactMods, emptyPactMods, eraseFragments, runeForgeCost, RUNE_GAMBLE_COST, ruleAmp,
  type TimeRuneMods, type PactMods,
} from './enchants'
import { getMaitriseNode, getContract, emptyConseil, conseilFresh, currentWeek, type ConseilState, type ContractId } from './maitrise'
import {
  condGemMods, acharneMult, nueeMult, rollCondGem, condGemKey, parseCondKey, getCondGem, condGemInstance,
  gemMaxRank, grindDust, legacyGemDust, recutCost, BIOME_GEM_FAMILY, COND_GEM_DROP, GEM_DUST_DROP, GEM_CUT_COST,
  CHAMPION_GEM_DROP, GEM_FUSE_COUNT, GEM_FUSE_COST, GEM_CORRUPT_COST, COND_GEM_LIST, GEM_QUALITIES,
  corruptOdds, rollCutQuality, drillCost,
  type CondGemId, type CondMods, type GemFamily, type GemModOpts, type GemQuality,
} from './condGems'
import {
  tickAutomates, missionLabel, automateUpgradeCost,
  AUTOMATE_MAX, AUTOMATE_COSTS, AUTOMATE_NAMES, AUTOMATE_UPG_MAX,
  type Automate, type AutomateMission,
} from './automates'
import {
  REAGENTS, REAGENT_DROP, getBrew, recipeForPair, EXPERIMENT_COST,
  BREW_QUALITIES, brewQualityAt, brewKey, parseBrewKey, millesimeChance,
  DAILY_TRANSMUTE_COST, PHILOSOPHALE_COST, PHILOSOPHALE_MULT,
  type BrewQuality,
} from './alchimie'
import { makeEnemy, isBossStage, stageIlvl } from './enemies'
import {
  BIOME_IDS, biomeUnlocked, getBiomeDef,
  BIOME_ROTATE_MS, BIOME_LOCK_MS, BIOME_LOCK_FRAGMENTS, type BiomeId,
} from './biomes'
import {
  maitriseBonus, surgeBiome,
  SURGE_GOLD_XP_MULT, SURGE_QUINT_MULT,
} from './biomeBonus'
import { RARITIES, RARITY_LIST } from './rarities'
import { SECONDARY_STATS } from './stats'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES, profileDamageMult, type DamageProfile } from './damage'
import { equipSlotsForType, slotAccepts, EQUIP_SLOTS } from './slots'
import { TUT_QUESTS, TUT_QUEST_IDS, type TutCtx } from './tutorial'
import { welcomeMessage, offlineMessage, hasReward as inboxHasReward, INBOX_CAP, type InboxMessage } from './inbox'
import {
  emptyDaily, dailyMetrics, rollDaily, getDailyQuest, questDone, todayStr, LOGIN_REWARDS, type DailyState,
} from './daily'
import {
  emptyEvent, rollEvent, eventPoints, EVENT_MILESTONES, invasionAuraId, type EventState,
} from './event'
import { essenceGain, upgradeCost, insertCost, getUnique, UNIQUE_MAX_RANK, randomUniqueInstance, undiscoveredUnique } from './uniques'
import {
  generateDungeon, makeDungeonPack, dungeonIlvl, dungeonRegen, getDungeonDef, dungeonLuckTier,
  cacheRarityWindow, butinOverChance, butinOverTier, BUTIN_RARITY_CAP,
  dungeonRunYield, dungeonKeyYield, DUNGEON_YIELD_PERFIGHT_FRAC,
  geodeDustYield, geodeGemChance, geodeGemRank,
  DUNGEONS, type ActiveDungeon, type DungeonId,
} from './dungeons'
import {
  generateRaid, makeRaidAdd, raidMaxAdds, getRaidDef, raidUnlocked, raidBossVariant,
  raidIlvl, raidRarityWindow, rollRaidLootCount, raidTrophyGain, raidTierUnlockCost,
  raidFragments, raidCosmicChance, raidCosmicQty, pickRaidLootType, globalTier,
  PAIR_ENRAGE_MULT, NOVA_MULT, RAIDS, RAID_LIST, type ActiveRaid, type RaidId,
} from './raids'
import { SETS } from './sets'
import { simulateOffline, type OfflineReport } from './offline'

// v0.30 — WIPE ASSUMÉ : la refonte de progression (budget d'objet exponentiel, échelle d'ilvl
// unifiée) rend les anciens objets/paliers incohérents sur la nouvelle courbe. On bumpe la clé →
// les saves v1 ne sont plus chargées (reset propre, comme un gros prestige). Cf. DESIGN_v0.30.md.
const SAVE_KEY = 'warrior-idler-save-v030c'
const MAX_LOG = 40
// v0.25 (DESIGN §2) : inventaire ILLIMITÉ (Sacoches supprimée) — borne purement technique.
// Le tri se fait par l'auto-recyclage (seuil de rareté) et les outils de masse.
const INV_BASE = 100000
let invMax = INV_BASE
let regenMult = 1 // ajusté par l'amélioration "Régénération"
const REGEN_RATE = 0.05
/** v0.27 (F3) — horodatage de la mise en arrière-plan (0 = au premier plan). */
let awaySince = 0

/* v0.27 (Lot 3) — socle ANTI-IMMORTALITÉ en RAID (knobs à éprouver). */
const RAID_REGEN_MULT = 0.5   // « Mal de l'abîme » : régén de base bridée de moitié en raid
const ESTOC_INTERVAL = 9      // s entre deux « Estocs primordiaux »
const ESTOC_PCT = 0.04        // % des PV MAX par estoc, IMPARABLE (ignore armure/résist/mitigation)
const HEALCUT_DUR = 4         // « Blessures mortelles » : durée (s) de la fenêtre de soins réduits (posée par la Nova)
const HEALCUT_REGEN_MULT = 0.25 // régén pendant le heal-cut (×0.25 : les soins ne suivent plus)
const FRAPPE_INTERVAL = 12    // « Frappe partagée » : intervalle (s)
const FRAPPE_MULT = 3.2       // dégâts TOTAUX (÷ héros vivants) → soloer la frappe = la prendre PLEINE
const ESTOCADE_INTERVAL = 8   // « Estocade » : intervalle (s) — frappe le plus BAS en PV
/** v0.25.x — RELÈVE en farm : un héros tombé se relève après ce délai (s), à 35% de ses PV. */
const FARM_REZ_DELAY = 20
const RETREAT_STAGES = 2
/** Intervalle (s) entre deux étourdissements d'un boss (après le 1er, cadencé par ccCd). */
const CC_INTERVAL = 8
// v0.35.1 — Personnages 2 & 3 = la « dynamique reine » REQUISE pour les RAIDS (contenu de groupe :
// heal/bouclier/synergie). Recrutable au Marché à un coût MODESTE et abordable dès que les raids
// comptent (palier 50) ; déblocage gratuit très tardif conservé comme filet de sécurité.
const CHAR2_STAGE = 350
const CHAR3_STAGE = 800
export const RECRUIT_COST = [1_000_000, 8_000_000] // or — 2ᵉ abordable dès le palier 50, 3ᵉ = vrai objectif
export const RECRUIT_POUSSIERE = [0, 30] // 2ᵉ : que de l'or (la poussière sert au craft) ; 3ᵉ : un peu
const RECRUE_NAMES = ['Lyra', 'Kael', 'Sora', 'Dorn', 'Mira']

export type LogKind = 'hit' | 'crit' | 'loot' | 'kill' | 'info' | 'level' | 'death' | 'gold' | 'craft'

export interface LogEntry {
  id: number
  text: string
  kind: LogKind
}

export interface CreateOptions {
  type: ItemType
  primary: OffensiveStat
  rarity: RarityId
  orientation?: import('./types').ItemOrientation
  element?: DamageType
  /** v0.26 — Signature (Compagnonnage III) : affixe garanti au choix (coûte des Lingots 🧱). */
  signature?: SecondaryStat
  /** v0.26 — Chef-d'œuvre hebdomadaire (Compagnonnage V) : +1 cran garanti + châsse garantie. */
  masterwork?: boolean
}

/** v0.26 — Contrat de forge quotidien : « forge-moi CETTE pièce ». */
export interface ForgeContractDef {
  type: ItemType
  primary: OffensiveStat
  /** Tier de rareté minimal exigé (calé sur ton plafond de craft − 2). */
  minTier: number
}

/** Les 3 commandes du jour, déterministes (mêmes pour tous au même jour epoch). */
export function forgeContractsForDay(day: number, craftCap: number): ForgeContractDef[] {
  // LCG simple seedé par le jour : stable, sans dépendance.
  let seed = (day * 2654435761) % 2147483647
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
  const types = EQUIP_SLOTS.map((s) => s.accepts).filter((t, i, a) => a.indexOf(t) === i && t !== 'armePrincipale')
  const prims: OffensiveStat[] = ['force', 'agilite', 'intelligence']
  const minTier = Math.max(2, craftCap - 2)
  const out: ForgeContractDef[] = []
  while (out.length < 3) {
    const t = types[Math.floor(rnd() * types.length)]
    if (out.some((c) => c.type === t)) continue
    out.push({ type: t, primary: prims[Math.floor(rnd() * prims.length)], minTier })
  }
  return out
}

/** Lingots 🧱 gagnés par contrat rempli (+ Négociant). */
export const CONTRACT_LINGOTS = 3

export interface ChestReward {
  dungeonName: string
  level: number
  items: Item[]
  eclats: number
  noyau: number
  gold: number
  sceaux: number
  orbes?: number
  fragments?: number
  poussiere?: number
  /** Éclat cosmique 💫 — ressource ultra-rare exclusive aux raids. */
  cosmic?: number
  /** XP d'équipe gagnée pendant le donjon (déjà créditée combat par combat ; affichage récap). */
  xp?: number
  /** 🔹 Poussière de gemme (La Géode). */
  gemDust?: number
  /** 💎 Gemme de condition trouvée dans le coffre (La Géode — aile choisie). */
  gem?: { id: CondGemId; rank: number }
}

/** Coffre du Destin 🎭 : objets révélés dont UN SEUL sera gardé (les autres sont recyclés). */
export interface ChoiceReward {
  name: string
  items: Item[]
}

export const SCEAU_COST = { noyau: 3, eclats: 600 }
export const FRAGMENT_INFUSE_COST = 2 // Fragments d'éternité pour infuser un effet unique
/** Invocation d'un effet unique au CHOIX (Éclat cosmique + Fragments). */
export const CHOOSE_UNIQUE_COST = { cosmic: 1, fragments: 3 }

/** Progression par donjon-ressource (chaque donjon monte indépendamment). */
export type DungeonProgress = Record<DungeonId, number>
function emptyDungeonProgress(): DungeonProgress {
  const out = {} as DungeonProgress
  for (const id of Object.keys(DUNGEONS) as DungeonId[]) out[id] = 0
  return out
}

/** Progression par raid (chaque raid monte indépendamment). */
export type RaidProgress = Record<RaidId, number>
function emptyRaidProgress(): RaidProgress {
  const out = {} as RaidProgress
  for (const id of Object.keys(RAIDS) as RaidId[]) out[id] = 0
  return out
}

/** Progression par biome (chaque biome monte indépendamment). */
function emptyBiomeRecord(physiqueValue: number, otherValue: number): Record<BiomeId, number> {
  const out = {} as Record<BiomeId, number>
  for (const id of BIOME_IDS) out[id] = id === 'physique' ? physiqueValue : otherValue
  return out
}

/** Meilleur palier tous biomes confondus (gate des donjons/raids/persos). */
function globalBest(biomeBest: Record<BiomeId, number>): number {
  let best = 1
  for (const id of BIOME_IDS) best = Math.max(best, biomeBest[id] ?? 0)
  return best
}

/** Stock de Quintessences vide (une entrée par type de dégâts). */
function emptyQuint(): Record<DamageType, number> {
  return Object.fromEntries(DAMAGE_TYPE_LIST.map((t) => [t, 0])) as Record<DamageType, number>
}

/** Ajoute un sac de Quintessences typées à un stock (immutable). */
function addQuint(base: Record<DamageType, number>, add: Partial<Record<DamageType, number>>): Record<DamageType, number> {
  let changed = false
  const out = { ...base }
  for (const t in add) {
    const v = add[t as DamageType] ?? 0
    if (v > 0) { out[t as DamageType] = (out[t as DamageType] ?? 0) + v; changed = true }
  }
  return changed ? out : base
}

/** Rend au stock les gemmes serties d'un objet (vente/recyclage : les gemmes ne se perdent pas). */
function gemStockAdd(stock: Record<string, number>, item: Item): Record<string, number> {
  if (!item.gems?.length) return stock
  const out = { ...stock }
  for (const g of item.gems) {
    if (!g.cond) continue // vestige élémentaire (ne devrait plus exister après migration)
    const k = condGemKey(g.cond as CondGemId, g.rank ?? 1)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** Suffixe de log « + 🔥3 + ❄️2 » pour un remboursement de Quintessences (vide si rien). */
function quintLogSuffix(refund: Partial<Record<DamageType, number>>): string {
  const parts: string[] = []
  for (const t in refund) {
    const v = refund[t as DamageType] ?? 0
    if (v > 0) parts.push(`${DAMAGE_TYPES[t as DamageType].icon}${v}`)
  }
  return parts.length ? ` + ${parts.join(' ')}` : ''
}

/** Chances de drop d'une Quintessence du biome actif selon le rang d'ennemi (au palier 1). */
const QUINT_DROP = { normal: 0.01, elite: 0.05, boss: 0.1 }
/** Bonus de drop de Quintessence par palier (multiplicatif, plafonné) → farmer son palier actuel
 *  rapporte plus que farmer 50 paliers en dessous. */
const QUINT_TIER_BONUS = 0.012
const QUINT_TIER_MULT_CAP = 4
/** Multiplicateur de drop de Quintessence au palier `stage`. */
function quintTierMult(stage: number): number {
  return Math.min(QUINT_TIER_MULT_CAP, 1 + Math.max(0, stage - 1) * QUINT_TIER_BONUS)
}

/**
 * Donjons = voie RENTABLE pour monter de niveau & farmer l'or. À CHAQUE combat gagné, l'équipe
 * gagne de l'XP (créditée tout de suite, gardée même si le run échoue) et de l'or (versé au coffre).
 * Multiplicateurs volontairement GÉNÉREUX (le levelling est lent par design) — à affiner.
 */
// ×XP de l'équipe par combat dans le Sanctuaire du Savoir. Relevé 7 → 24 (v0.21) : les donjons
// sont passés de 4+N combats à 2-4 → on préserve l'XP totale d'un run.
const DUNGEON_FIGHT_XP_MULT = 24
/** Boost de l'XP du combat CLASSIQUE : recale le ratio donjon/classique (~×80 → ~×10). */
const CLASSIC_XP_MULT = 8
/** Or par kill en combat CLASSIQUE (fraction de l'XP du mob). Relevé 0.12 → 0.8 : farmer les paliers
 *  rapporte enfin un vrai revenu d'or (avant : « pratiquement rien »). */
const CLASSIC_GOLD_MULT = 0.8

interface SaveData {
  characters: Character[]
  activeChar: number
  /** Palier courant DU BIOME ACTIF. */
  stage: number
  /** Meilleur palier tous biomes confondus (= max sur biomeBest). */
  bestStage: number
  /** Biome actif (combat classique). */
  activeBiome: BiomeId
  /** v0.28 — horodatage de la prochaine rotation ALÉATOIRE de la zone de chasse (~1 h). */
  nextRotateAt: number
  /** v0.28 — biome FORCÉ (payé en Fragments) jusqu'à cet horodatage (0 = rotation libre). */
  biomeLockUntil: number
  /** Palier courant mémorisé par biome (le biome actif reflète `stage`). */
  biomeStages: Record<BiomeId, number>
  /** Meilleur palier atteint par biome. */
  biomeBest: Record<BiomeId, number>
  /** Verrou de farm : fige la progression au palier courant. */
  farmLock: boolean
  gold: number
  essence: number
  noyau: number
  /** Poussière d'étoile : matériau rare de craft sommital. */
  poussiere: number
  /** Quintessences élémentaires : 1 par type de dégâts (drop ~1% par biome). Craft typé sur le stuff. */
  quint: Record<DamageType, number>
  /** Stock de gemmes de CONDITION (clé `cond:id[:rang[:qualité]]`) — drop par famille de biome. */
  gems: Record<string, number>
  /** Poussière de gemme 🔹 : broyage → taille (gemme au choix) & recoupe (rangs). Joaillier. */
  gemDust: number
  /** v0.26 : gemmes possédées au moins une fois (📖 Catalogue du Joaillier). */
  gemsSeen: string[]
  /** v0.26 : jour epoch du dernier échange au ⚖️ Marché aux pierres (1/jour). */
  lastStoneTrade: number
  /** v0.26 : Lingots 🧱 (Fonderie du Forgeron) — la matière des Signatures et Chefs-d'œuvre. */
  lingots: number
  /** v0.26 : objet au BAC DE TREMPE (🔥 Trempe lente) — +1 iLvl/24 h réelles, 5 max par objet. */
  trempe: { itemId: string; startedAt: number } | null
  /** v0.26 : 📋 Contrats de forge du jour (jour epoch + état des 3 commandes). */
  forgeContracts: { day: number; done: boolean[] } | null
  /** v0.26 : semaine epoch du dernier CHEF-D'ŒUVRE (Compagnonnage V, 1/semaine). */
  lastMasterwork: number
  /** v0.26 : Fragments runiques 🜁 (Effacement → Forge runique / Surcharge). */
  runeFragments: number
  /** v0.26 : exemplaires déjà FORGÉS par rune (le coût croît ×1,5 à chaque exemplaire). */
  runeCrafted: Record<string, number>
  /* — ⚗️ Officine de l'Alchimiste (v0.26) — */
  /** Réactifs de biome (1 herbe par type de dégâts). */
  reagents: Partial<Record<DamageType, number>>
  /** Brassins en stock (clé `id:qualité` — voir alchimie.ts). */
  brews: Record<string, number>
  /** Recettes DÉCOUVERTES par expérimentation (ids de BREWS). */
  alchemyRecipes: string[]
  /** Cuves de brassage en cours (maturation en temps réel). */
  cuvesEnCours: { recipeId: string; startedAt: number }[]
  /** Élixir d'équipe ACTIF (un seul) — expire en temps réel. */
  elixirActive: { id: string; quality: number; until: number } | null
  /** Huile d'arme active (type choisi à l'application). */
  oilActive: { type: DamageType; pct: number; until: number } | null
  /** Antidote actif (type choisi). */
  antidoteActive: { type: DamageType; pct: number; until: number } | null
  /** Mutagène actif (le sort en a décidé au débouchage). */
  mutagenActive: { mult: number; until: number } | null
  /** Potions ARMÉES (consommées à la prochaine entrée du contenu). */
  armedRaidShield: number | null
  armedChestBonus: number | null
  armedXpBonus: number | null
  /** Jour epoch de la dernière 🌗 Transmutation du jour. */
  lastTransmute: number
  /** 🜍 Pierre philosophale forgée (relique de compte : +2% drops de ressources). */
  philosophale: boolean
  /** v0.26 : version de migration des arbres de métiers (Prodige, etc.). */
  metiersV?: number
  essences: Record<string, number>
  sceaux: number
  dungeonProgress: DungeonProgress
  dungeon: ActiveDungeon | null
  pendingChest: ChestReward | null
  /** Coffre du Destin en attente de choix (3 objets révélés, un seul gardé). */
  pendingChoice: ChoiceReward | null
  /** Horodatage du dernier Coffre du Jour 🗓️ (gratuit, cooldown réel). */
  lastFreeBox: number
  /** Karma du marchand 🍀 : coffres ouverts sans jackpot (bonus de jackpot croissant, reset au proc). */
  boxPity: number
  orbes: number
  fragments: number
  /** Éclat cosmique 💫 — ressource ultra-rare des raids. */
  cosmic: number
  /** ✨ Échos primordiaux 💠 (v0.27, Lot 5) — monnaie de PRESTIGE (Éveil), investie en Constellation. */
  echos: number
  /** Nombre d'Éveils accomplis. */
  prestigeRank: number
  /** Horodatage (ms) du dernier Éveil — pour le haut fait « Renaissance Fulgurante ». */
  lastPrestigeAt?: number
  /** Rangs alloués dans la Constellation (méta-arbre de prestige). */
  constellation: Record<string, number>
  /** Relique conservée au dernier Éveil (1 pièce, iLvl plancher) — versée dans le sac au reset. */
  relic: Item | null
  raidProgress: RaidProgress
  /** 🏆 Trophées par raid (v0.24) : la monnaie de PASSAGE DE TIER (gagnés par clear). */
  raidTrophies: Partial<Record<RaidId, number>>
  /** Tier maximal TENTABLE par raid (v0.24) : monte via unlockRaidTier (clear + Trophées). */
  raidTierUnlocked: Partial<Record<RaidId, number>>
  raid: ActiveRaid | null
  /** 🪄 Runes POSSÉDÉES (v0.25, option A) : id de rune → quantité. Drop rare (raids surtout) ;
   *  la gravure CONSOMME un exemplaire — retirer/écraser ne rembourse pas. */
  runesOwned: Record<string, number>
  /** Grimoire : ids des effets uniques déjà découverts. */
  codex: string[]
  /** Améliorations permanentes : id → niveau. */
  upgrades: Record<string, number>
  /** 🏛️ Conseil des Maîtrises (v0.25) : contrats de la semaine courante. */
  conseil: ConseilState
  /** Points de Maîtrise non dépensés (1 par contrat hebdo rempli). */
  maitrisePoints: number
  /** Arbre de Maîtrise : id de nœud → rang (bonus minimes via computeGlobalMods). */
  maitrise: Record<string, number>
  /** 🏆 Hauts faits débloqués (v0.28) : id → true. Bonus permanents façon Maîtrise + titres. */
  achievements: Record<string, true>
  /** 🎨 Cosmétiques premium débloqués (v0.28 B2) : id de palette/emblème → true (sink Poussière d'étoile). */
  cosmetics: Record<string, true>
  /** Métiers de l'Atelier (v0.22) : XP cumulée + nœuds d'arbre appris, par métier. */
  metiers: MetiersState
  /** Automates de forge : farment en boucle les donjons/raids déjà battus (3 max). */
  automates: Automate[]
  /** Stock de l'échoppe du marchand. */
  shopStock: Item[]
  inventory: Item[]
  /** Seuil de rareté (tier) pour vente/recyclage en masse + recyclage auto. Persisté. */
  recycleThreshold: number
  /** Recyclage automatique : tout butin sous le seuil est recyclé directement au drop. */
  autoRecycle: boolean
  /** v0.31 — tutoriel « Premiers Pas » : quêtes dont la récompense a été réclamée + flag d'achat marché. */
  tut: { claimed: string[]; bought: boolean }
  /** ✉ Boîte de réception (v0.31.2) : gains à collecter (cadeaux, hors-ligne, events) — sortis du combat. */
  inbox: InboxMessage[]
  /** 📅 Quotidien (v0.31.4) : contrats du jour + connexion. */
  daily: DailyState
  /** Compteur de kills à vie (combat classique) — métrique des contrats du jour (delta depuis baseline). */
  totalKills: number
  /** Compteur de donjons terminés à vie — métrique des contrats du jour. */
  totalDungeons: number
  /** 🎉 Event Invasion élémentaire (v0.31.5) : élément de la semaine + paliers réclamés. */
  event: EventState
  /** 🎉 Auras d'invasion débloquées (ids AVATAR_AURAS) — cosmétiques d'event, collectionnés au fil des semaines. */
  eventCosmetics: string[]
  /** Rune du Karma (pity) : kills depuis le dernier drop Épique+ (compté en permanence). */
  killsSinceEpic: number
  /** Horodatage de la dernière sauvegarde (progression hors-ligne). */
  lastSeen: number
  /** Horodatage de la dernière rotation de l'échoppe (rotation horaire, indépendante du combat). */
  lastShopRefresh: number
  /** Écran d'accueil franchi (choix de spé + but du jeu) : false sur une partie NEUVE, true ensuite. */
  onboarded: boolean
}

interface GameState extends SaveData {
  enemy: Enemy
  log: LogEntry[]
  killCount: number
  /** Récap de progression hors-ligne à présenter au retour (modal). */
  pendingOffline: OfflineReport | null
  tick: (dt: number) => void
  setStage: (n: number) => void
  setBiome: (biome: BiomeId) => void
  /** v0.28 — force un biome contre des Fragments d'éternité (reste dessus ~1 h, puis rotation). */
  lockBiome: (biome: BiomeId) => void
  /** v0.28 — fait tourner la zone vers un biome ALÉATOIRE si l'échéance horaire est atteinte (timer). */
  rotateBiomeIfDue: () => void
  toggleFarmLock: () => void
  setRecycleThreshold: (tier: number) => void
  toggleAutoRecycle: () => void
  insertEffect: (itemId: string, effectId: string) => void
  claimOffline: () => void
  /** v0.31 — réclame la récompense d'une quête du tutoriel « Premiers Pas » (si terminée et non réclamée). */
  claimTutorialReward: (id: string) => void
  /** ✉ Réclame la récompense d'un message d'inbox (crédite puis marque réclamé). */
  claimInbox: (id: string) => void
  /** ✉ Réclame TOUS les messages en attente d'un coup. */
  claimAllInbox: () => void
  /** ✉ Dépose un message dans la boîte (cadeaux, gains hors-ligne, events). */
  pushInbox: (msg: InboxMessage) => void
  /** ✉ Marque tous les messages comme lus (appelé à l'ouverture de la boîte) → éteint les red-dots « non lu ». */
  markInboxSeen: () => void
  /** 📅 Passe au jour suivant si minuit local est franchi (tire de nouveaux contrats + avance le streak). */
  rollDailyIfNeeded: () => void
  /** 📅 Réclame la récompense d'un contrat du jour terminé. */
  claimDailyQuest: (id: string) => void
  /** 📅 Réclame la récompense de connexion du jour (1×/jour). */
  claimLogin: () => void
  /** 🎉 Fait tourner l'event Invasion si la semaine a changé (nouvel élément + reset). */
  rollEventIfNeeded: () => void
  /** 🎉 Réclame un palier de l'event (le capstone débloque l'aura élémentaire). */
  claimEventMilestone: (index: number) => void
  /** v0.27 (F3) — cycle de vie mobile : l'appli passe en arrière-plan (horodate la mise en veille). */
  markAway: () => void
  /** v0.27 (F3) — retour au premier plan : crédite les gains hors-ligne accumulés en arrière-plan. */
  resumeAway: () => void
  equip: (itemId: string, targetSlot?: EquipSlotId) => void
  unequip: (slot: EquipSlotId) => void
  sell: (itemId: string) => void
  recycle: (itemId: string) => void
  sellAllBelow: (tier: number) => void
  recycleAllBelow: (tier: number) => void
  /** 🔒 (v0.28) Bascule le verrou anti-suppression d'un objet. */
  toggleLock: (itemId: string) => void
  /** (v0.28) Vend en lot une sélection d'objets (ignore les verrouillés). */
  sellMany: (itemIds: string[]) => void
  /** (v0.28) Recycle en lot une sélection d'objets (ignore les verrouillés). */
  recycleMany: (itemIds: string[]) => void
  reforge: (itemId: string, locked: number[]) => void
  surillvl: (itemId: string) => void
  ascend: (itemId: string) => void
  upgradeUnique: (itemId: string) => void
  transmute: (itemId: string, newPrimary: OffensiveStat) => void
  /** Améliore (ou ajoute) la ligne typée (dégâts/résist) d'un objet via une Quintessence du type. */
  enhanceTyped: (itemId: string, type: DamageType, kind: 'dmgType' | 'resist') => void
  /** Sertit une gemme de CONDITION du stock (trigger de combat) dans une châsse libre. */
  socketCondGem: (itemId: string, condId: CondGemId, rank?: number, quality?: GemQuality) => void
  /** Désertit la gemme à l'index donné (coût en éclats, gemme rendue au stock avec son rang). */
  unsocketGem: (itemId: string, index: number) => void
  /** BROYAGE (Joaillier) : réduit une gemme du stock en poussière 🔹. */
  grindGem: (key: string) => void
  /** TAILLE (Joaillier) : façonne la gemme de son CHOIX (rang 1) contre de la poussière 🔹. */
  cutGem: (condId: CondGemId) => void
  /** 🛒 (v0.28 B2) Échoppe de gemmes : achète une gemme de condition (rang 1) contre Poussière de gemme 🔹, sans Joaillier. */
  buyGem: (condId: CondGemId) => void
  /** RECOUPE (Joaillier) : monte d'un rang le paramètre d'une gemme SERTIE (poussière 🔹). */
  recutGem: (itemId: string, index: number) => void
  /** FUSION (v0.26) : 3 gemmes identiques du stock → 1 gemme au rang supérieur. */
  fuseGems: (key: string) => void
  /** 🔥 (v0.28) Fusionne d'un coup TOUS les lots de gemmes éligibles (cascade incluse). */
  fuseAllGems: () => void
  /** CORRUPTION (v0.26) : retaille risquée d'une gemme du stock (rang +1 / rien / broyée). */
  corruptGem: (key: string) => void
  /** PERÇAGE (v0.26) : ajoute UNE châsse à un objet (très cher, une fois par objet). */
  drillSocket: (itemId: string) => void
  /** ⚖️ Marché aux pierres (v0.26) : 1/jour, 3 gemmes du stock → 1 gemme au CHOIX (rang = min). */
  tradeGems: (keys: string[], targetId: CondGemId) => void
  /** Grave (ou remplace) la rune d'enchantement d'un objet (coût : Savoir-faire + éclats). */
  enchantItem: (itemId: string, enchantId: string) => void
  /** 🧽 EFFACEMENT (v0.26) : sacrifie une rune possédée → Fragments runiques 🜁. */
  eraseRune: (enchantId: string) => void
  /** 🔨 FORGE RUNIQUE (v0.26) : forge la rune de ton CHOIX (fragments + 🌌 + or, ×1,5/exemplaire). */
  forgeRune: (enchantId: string) => void
  /** 🎲 SURCHARGE RUNIQUE (v0.26) : 3 fragments → une rune aléatoire (jamais un pacte). */
  gambleRune: () => void
  /* — ⚗️ Officine (v0.26) — */
  /** 🧪 EXPÉRIMENTATION : combine 2 réactifs (3 de chaque) — découvre une recette… ou pas. */
  experiment: (a: DamageType, b: DamageType) => void
  /** 🫙 Lance un brassin dans une cuve libre (recette DÉCOUVERTE uniquement). */
  brewStart: (recipeId: string) => void
  /** 🫙 Récolte la cuve `idx` — la QUALITÉ dépend du moment (Trouble/Pur/Parfait/Millésime). */
  brewCollect: (idx: number) => void
  /** 🧪 Boit un élixir d'équipe (un seul actif — remplace le précédent). */
  drinkElixir: (key: string) => void
  /** 🛡️/💰/📚 ARME une potion de contenu (consommée à la prochaine entrée de donjon/raid). */
  armPotion: (key: string) => void
  /** 🛢️ Applique une huile d'arme (type au choix). */
  useOil: (key: string, type: DamageType) => void
  /** 🧴 Boit un antidote ciblé (type au choix). */
  useAntidote: (key: string, type: DamageType) => void
  /** ☣️ Débouche un mutagène — la chimie décide (70/30). */
  drinkMutagen: (key: string) => void
  /** 🌗 Transmutation du jour : 4 Quintessences d'un type → 1 du type choisi (1/jour réel). */
  dailyTransmute: (from: DamageType, to: DamageType) => void
  /** 🜍 Forge la Pierre philosophale (capstone : réactifs des 7 biomes + un Millésime + 🌌). */
  craftPhilosophale: () => void
  createItem: (opts: CreateOptions) => void
  /** 🫕 FONDERIE (v0.26) : fond un objet du SAC (Rare+) en Lingots 🧱. */
  smeltItem: (itemId: string) => void
  /** 🔥 TREMPE LENTE (v0.26) : dépose un objet du sac au bac (+1 iLvl/24 h réelles, 5 max). */
  startTempering: (itemId: string) => void
  /** 🔥 Récupère l'objet du bac de trempe (crédite les jours écoulés). */
  collectTempering: () => void
  /** Apprend un rang d'un nœud d'arbre de métier (dépense un point gagné par niveau). */
  learnMetierNode: (metier: MetierId, nodeId: string) => void
  /** Réinitialise l'arbre d'un métier contre de l'or (XP et niveau conservés). */
  respecMetier: (metier: MetierId) => void
  /** v0.26 : réinitialise UNE branche de l'arbre (40% du coût complet) — changer de voie sans tout raser. */
  respecMetierBranch: (metier: MetierId, branchId: string) => void
  /** Construit le prochain automate de forge (3 max, coût croissant brutal). */
  buildAutomate: () => void
  /** Assigne (ou retire) la mission d'un automate — donjon/raid DÉJÀ battu uniquement. */
  assignAutomate: (id: number, mission: AutomateMission | null) => void
  toggleAutomatePause: (id: number) => void
  /** Améliore la vitesse ou le rendement d'un automate (or). */
  upgradeAutomate: (id: number, kind: 'speed' | 'yield') => void
  enterDungeon: (dungeonId: DungeonId, level: number, repeat?: number, wing?: GemFamily) => void
  abandonDungeon: () => void
  enterRaid: (raidId: RaidId, tier: number, repeat?: number) => void
  abandonRaid: () => void
  /** 🏆 Débloque le tier suivant d'un raid (exige : frontière vaincue + Trophées du raid). */
  unlockRaidTier: (raidId: RaidId) => void
  infuseUnique: (itemId: string) => void
  chooseUnique: (itemId: string, effectId: string) => void
  claimChest: () => void
  craftSceau: () => void
  setActiveChar: (index: number) => void
  /** Renomme un personnage (personnalisation du joueur). */
  renameCharacter: (index: number, name: string) => void
  setBias: (p: PrimaryStat) => void
  /** Écran d'accueil : valide le choix de spé de départ et lance la partie (one-shot, partie neuve). */
  completeOnboarding: (bias: PrimaryStat) => void
  setPower: (slot: number, powerId: string | null) => void
  setPassive: (slot: number, powerId: string | null) => void
  /** Équipe un GÉNÉRATEUR (sort builder) dans l'un des 3 slots dédiés (auto-cast). */
  setGenerator: (slot: number, powerId: string | null) => void
  /** Bascule un emplacement de capacité entre AUTO et MANUEL (perso actif). */
  togglePowerAuto: (slot: number) => void
  /** Lance MANUELLEMENT la capacité d'un emplacement (perso actif) — strict : ne part qu'au prochain tick si prête. */
  castPower: (slot: number) => void
  allocateTalent: (nodeId: string) => void
  respecTalents: () => void
  /** v0.33 — alloue un nœud du PANTHÉON (2e arbre) avec le budget de Points d'Éveil (perso actif). */
  allocatePantheon: (nodeId: string) => void
  /** v0.33 — réinitialise le Panthéon du perso actif (gratuit : rebuild libre à chaque run). */
  respecPantheon: () => void
  /** Sauvegarde le build courant (talents + capacités + spé) dans un emplacement (0-2). */
  saveBuildPreset: (slot: number, name?: string) => void
  /** Applique un préset : respec payant + réallocation validée nœud par nœud. */
  applyBuildPreset: (slot: number) => void
  deleteBuildPreset: (slot: number) => void
  buyUpgrade: (id: string) => void
  refreshShop: () => void
  buyShopItem: (itemId: string) => void
  /** Achète un coffre. `qty` ×5 = achat en gros (-10% d'or) ; `element` requis pour le coffre élémentaire. */
  mysteryBox: (id: number, opts?: { qty?: number; element?: DamageType }) => void
  /** 🏛️ Dépense un Point de Maîtrise dans un nœud de l'arbre du Conseil. */
  learnMaitrise: (nodeId: string) => void
  /** 🏆 (v0.28) Évalue et débloque les hauts faits désormais atteints (appelé périodiquement). */
  checkAchievements: () => void
  /** 🏆 (v0.28) Choisit le TITRE affiché d'un héros (id de haut fait débloqué, ou null). */
  selectTitle: (charId: string, achId: string | null) => void
  /** 🎨 (v0.28) Personnalise le portrait d'un héros (palette / emblème). */
  setAvatar: (charId: string, sel: { palette?: string; emblem?: string; border?: string; aura?: string }) => void
  /** 🎨 (v0.28 B2) Débloque un cosmétique premium contre de la Poussière d'étoile 🌌. */
  unlockCosmetic: (id: string) => void
  /** Coffre du Destin : garde l'objet à cet index, recycle les autres. */
  chooseFromChoice: (index: number) => void
  recruitCharacter: () => void
  reset: () => void
  /** v0.27 (Lot 5) — ÉVEIL PRIMORDIAL : reset DUR contre des Échos ; garde 1 Relique (slot choisi). */
  awaken: (relicSlot: EquipSlotId | null) => void
  /** v0.27 (Lot 5) — investit des Échos dans un nœud de Constellation. */
  allocateConstellation: (nodeId: string) => void
}

let logId = 1
function pushLog(log: LogEntry[], text: string, kind: LogKind): LogEntry[] {
  return [{ id: logId++, text, kind }, ...log].slice(0, MAX_LOG)
}

/** Crédite de l'XP de métier et journalise les montées de niveau (1 niveau = 1 point d'arbre). */
function gainMetierXp(
  s: Pick<GameState, 'metiers' | 'log'> & { characters?: Character[] },
  metier: MetierId,
  amount: number,
): { metiers: MetiersState; log: LogEntry[] } {
  // 🗃️ Rune de l'Archiviste (v0.26) : +15% d'XP pour les quatre métiers (amplifiée Législateur).
  if (s.characters && equippedRules(s.characters).has('archiviste')) {
    amount = Math.round(amount * (1 + 0.15 * ruleAmp(craftMods(s.metiers).ruleAmpTier)))
  }
  const st = s.metiers[metier]
  const before = levelFromXp(st.xp)
  const xp = st.xp + amount
  const after = levelFromXp(xp)
  const metiers = { ...s.metiers, [metier]: { ...st, xp } }
  let log = s.log
  if (after > before) {
    const def = METIERS[metier]
    log = pushLog(log, `${def.icon} ${def.name} niveau ${after} — +${after - before} point${after - before > 1 ? 's' : ''} d'arbre (Atelier) !`, 'level')
  }
  return { metiers, log }
}

/**
 * v0.25 — XP IMPLICITE des métiers (fin de donjon/raid) : porter ses gemmes fait travailler le
 * Joaillier, porter ses runes le Runiste — « les mécaniques s'amènent toutes seules ». Minuscule
 * (1 XP/gemme sertie portée, cap 5 · 1 XP/rune gravée portée, cap 4) : réel sur la durée, invisible
 * au quotidien. (L'Alchimiste a déjà ses sources implicites : quintessences + recyclage.)
 */
function passiveMetierXp(s: Pick<GameState, 'metiers' | 'characters'>, log: LogEntry[]): { metiers: MetiersState; log: LogEntry[] } {
  let gems = 0
  let runes = 0
  for (const c of s.characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      gems += it?.gems?.length ?? 0
      if (it?.enchant) runes++
    }
  }
  let metiers = s.metiers
  if (gems > 0) { const g = gainMetierXp({ metiers, log }, 'joaillier', Math.min(5, gems)); metiers = g.metiers; log = g.log }
  if (runes > 0) { const g = gainMetierXp({ metiers, log }, 'runiste', Math.min(4, runes)); metiers = g.metiers; log = g.log }
  return { metiers, log }
}

/**
 * 🏛️ Conseil des Maîtrises (v0.25, DESIGN §3) : avance un contrat hebdo. Gère le ROULEMENT de
 * semaine (contrats remis à zéro, les Points acquis restent) et crédite AUTOMATIQUEMENT le Point
 * de Maîtrise au seuil — la progression se fait en jouant, sans clic.
 */
function conseilProgress(
  s: Pick<GameState, 'conseil' | 'maitrisePoints'>,
  log: LogEntry[],
  id: ContractId,
  amount = 1,
): { conseil: ConseilState; maitrisePoints: number; log: LogEntry[] } {
  let conseil = conseilFresh(s.conseil)
  let maitrisePoints = s.maitrisePoints
  if (conseil.done[id]) return { conseil, maitrisePoints, log }
  const def = getContract(id)
  const counts = { ...conseil.counts, [id]: (conseil.counts[id] ?? 0) + amount }
  let done = conseil.done
  if (counts[id] >= def.need) {
    done = { ...done, [id]: true }
    maitrisePoints += 1
    log = pushLog(log, `🏛️ Contrat rempli — ${def.icon} ${def.name} : +1 Point de Maîtrise (Marché → 🏛️ Conseil) !`, 'level')
  }
  conseil = { ...conseil, counts, done }
  return { conseil, maitrisePoints, log }
}

function xpForLevel(level: number): number {
  // Exponentielle ACCÉLÉRÉE (le taux de croissance augmente avec le niveau) calibrée sur un planning
  // de temps cible « meilleur rendement » : ~10 min au niv 10, ~1 h au 30, ~2 h au 50, ~10 h au 70,
  // ~25 h au 90, ~150 h au 100 — puis ça devient un vrai mur d'endgame au-delà.
  //
  // Calage : à partir du point de repère « courbe précédente = niv 50 en ~5 min », on a estimé le
  // revenu d'XP au meilleur rendement (≈ croît en 1.10/niveau), puis ajusté A/α/β pour que le COÛT
  // (= revenu × temps voulu par niveau) suive le planning. α = pente de base, β·L² = accélération.
  // (Constantes faciles à régler : A=échelle globale, α=pente, β=durcissement de fin de course.)
  const x = level - 1
  return Math.round(560 * Math.exp(0.105 * x + 0.00055 * x * x))
}

// Cooldowns transitoires des capacités actives (clé `charId:powerId`). Non persistés.
const cooldowns = new Map<string, number>()
// Demandes de lancement MANUEL en attente (clé `charId:powerId`) : posées par castPower, consommées au tick.
const manualFire = new Set<string>()

/** Recharges courantes des capacités d'un perso (pour l'UI : 0 = prête). */
export function powerCooldowns(char: Character): Record<string, number> {
  const out: Record<string, number> = {}
  for (const pid of charDeck(char)) if (pid) out[pid] = Math.max(0, cooldowns.get(`${char.id}:${pid}`) ?? 0)
  return out
}

/** 🏆 Fragment de Conquête : remet à zéro la PLUS LONGUE recharge de chaque héros. */
function resetLongestCooldown(chars: Character[]) {
  for (const c of chars) {
    let bestKey = ''
    let best = 0
    for (const pid of charDeck(c)) {
      if (!pid) continue
      const k = `${c.id}:${pid}`
      const cd = cooldowns.get(k) ?? 0
      if (cd > best) { best = cd; bestKey = k }
    }
    if (bestKey) cooldowns.set(bestKey, 0)
  }
}

/** Drapeaux des gemmes de condition pour le pas de combat. */
// État transitoire des gemmes de condition (compteurs de rythme). Non persisté, comme les cooldowns.
// Clés : `metronome:<charId>` (attaques), `echo` (sorts d'équipe), `crescendo` (kills d'équipe).
const gemCounters = new Map<string, number>()

// Runes de TEMPS : accumulateur de la Boucle (s) + prochain Sursis par héros (epoch ms).
let boucleAcc = 0
const sursisReadyAt = new Map<string, number>()

// ---- v0.24 : état transitoire des nouveaux archétypes (non persisté, comme les cooldowns) ----

// ÉGIDE « Aegis adaptatif » : stacks de résist par héros et par type (20 s glissantes).
const adaptiveStacks = new Map<string, Partial<Record<DamageType, { pts: number; remaining: number }>>>()
function adaptiveAdd(charId: string, type: DamageType, gain: number, cap: number) {
  const m = adaptiveStacks.get(charId) ?? {}
  const cur = m[type]
  m[type] = { pts: Math.min(cap, (cur?.pts ?? 0) + gain), remaining: 20 }
  adaptiveStacks.set(charId, m)
}
function adaptiveFor(charId: string): Partial<Record<DamageType, number>> {
  const m = adaptiveStacks.get(charId)
  if (!m) return {}
  const out: Partial<Record<DamageType, number>> = {}
  for (const t in m) {
    const e = m[t as DamageType]
    if (e && e.remaining > 0 && e.pts > 0) out[t as DamageType] = e.pts
  }
  return out
}
function adaptiveTick(dt: number) {
  for (const m of adaptiveStacks.values()) {
    for (const t in m) {
      const e = m[t as DamageType]
      if (e) e.remaining -= dt
    }
  }
}

// PURGATEUR « Combustion purificatrice » : altérations subies → carburant de dégâts (par héros).
function fuelAdd(charId: string) {
  gemCounters.set(`fuel:${charId}`, (gemCounters.get(`fuel:${charId}`) ?? 0) + 1)
}
function fuelMult(charId: string, fuel?: { per: number; cap: number }): number {
  if (!fuel) return 1
  return 1 + Math.min(fuel.cap, (gemCounters.get(`fuel:${charId}`) ?? 0) * fuel.per)
}
/** Remise à zéro du carburant (wipe / fin d'instance — comme le Crescendo). */
function fuelReset() {
  for (const k of [...gemCounters.keys()]) if (k.startsWith('fuel:')) gemCounters.delete(k)
}

/**
 * ÉGIDE : enrichit les résistances effectives de l'équipe — « Égide partagée » (l'aura du
 * meilleur porteur profite aux ALLIÉS) + « Aegis adaptatif » (stacks du héros). Mute info[].
 */
function enrichResists(
  chars: Character[],
  info: ({ resist: Partial<Record<DamageType, number>>; cmods: CharCombatMods } | null)[],
) {
  // Aura : pour chaque type, la meilleure part partagée (et son porteur, exclu de sa propre aura).
  const aura: Partial<Record<DamageType, { v: number; owner: number }>> = {}
  chars.forEach((_, i) => {
    const d = info[i]
    if (!d || d.cmods.shareResist <= 0) return
    for (const t in d.resist) {
      const type = t as DamageType
      const v = (d.resist[type] ?? 0) * d.cmods.shareResist
      if (v > (aura[type]?.v ?? 0)) aura[type] = { v, owner: i }
    }
  })
  const hasAura = Object.keys(aura).length > 0
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const adaptive = d.cmods.adaptiveResist ? adaptiveFor(c.id) : null
    if (!hasAura && !adaptive) return
    const merged: Partial<Record<DamageType, number>> = { ...d.resist }
    if (hasAura) {
      for (const t in aura) {
        const type = t as DamageType
        const a = aura[type]
        if (a && a.owner !== i) merged[type] = (merged[type] ?? 0) + a.v
      }
    }
    if (adaptive) {
      for (const t in adaptive) {
        const type = t as DamageType
        merged[type] = (merged[type] ?? 0) + (adaptive[type] ?? 0)
      }
    }
    d.resist = merged
  })
}

/** 🔁 Boucle temporelle : remet à zéro TOUTES les recharges des héros donnés. */
function resetAllCooldowns(chars: Character[]) {
  for (const c of chars) for (const pid of charDeck(c)) if (pid) cooldowns.set(`${c.id}:${pid}`, 0)
}

/** 🕊️ Sursis : si un héros vient de tomber et que sa rune est prête, il survit à 25% PV. */
function applySursis(chars: Character[], sursisCd?: number): string[] {
  if (!sursisCd) return []
  const revived: string[] = []
  const now = Date.now()
  for (const c of chars) {
    if (c.hp > 0) continue
    if ((sursisReadyAt.get(c.id) ?? 0) > now) continue
    c.hp = charMaxHp(c) * 0.25
    sursisReadyAt.set(c.id, now + sursisCd * 1000)
    revived.push(c.name)
  }
  return revived
}

/** Bonus du Crescendo : +1% de dégâts par kill, capé — remis à zéro quand l'équipe tombe. */
function crescendoBonus(cap?: number): number {
  return cap ? Math.min(cap, 0.01 * (gemCounters.get('crescendo') ?? 0)) : 0
}
function crescendoAdd(kills: number) {
  gemCounters.set('crescendo', (gemCounters.get('crescendo') ?? 0) + kills)
}
function crescendoReset() {
  gemCounters.delete('crescendo')
  fuelReset() // 🜍 Purgateur : le carburant d'affliction retombe quand l'équipe tombe
  mementoOn = false // 💀 Memento mori : le run s'achève, la rage retombe
}

/** ⚗️ Buffs d'OFFICINE actifs (élixir, huile, antidote, mutagène) — les expirés sont ignorés. */
interface BrewBuffs {
  dmgMult: number
  goldMult: number
  hpMult: number
  speedMult: number
  oil: { type: DamageType; pct: number } | null
  antidote: { type: DamageType; pct: number } | null
}

function activeBrewBuffs(s: Pick<GameState, 'elixirActive' | 'oilActive' | 'antidoteActive' | 'mutagenActive'>): BrewBuffs {
  const now = Date.now()
  const out: BrewBuffs = { dmgMult: 1, goldMult: 1, hpMult: 1, speedMult: 1, oil: null, antidote: null }
  const e = s.elixirActive
  if (e && e.until > now) {
    const def = getBrew(e.id)
    const q = BREW_QUALITIES[Math.max(0, Math.min(3, e.quality)) as BrewQuality].mult
    if (def?.effect?.dmg) out.dmgMult *= 1 + def.effect.dmg * q
    if (def?.effect?.gold) out.goldMult *= 1 + def.effect.gold * q
    if (def?.effect?.hp) out.hpMult *= 1 + def.effect.hp * q
    if (def?.effect?.speed) out.speedMult *= 1 + def.effect.speed * q
  }
  if (s.oilActive && s.oilActive.until > now) out.oil = { type: s.oilActive.type, pct: s.oilActive.pct }
  if (s.antidoteActive && s.antidoteActive.until > now) out.antidote = { type: s.antidoteActive.type, pct: s.antidoteActive.pct }
  if (s.mutagenActive && s.mutagenActive.until > now) out.dmgMult *= s.mutagenActive.mult
  return out
}

/** v0.26 : calcule les mods de PACTE de l'équipe et synchronise les dérivées globales
 *  (PV, vitesse, vol de vie, esquive — character.ts), élixirs d'Officine compris. */
function teamPactMods(
  s: Pick<GameState, 'characters' | 'metiers'>,
  craft: ReturnType<typeof craftMods>,
  buffs?: BrewBuffs,
): PactMods {
  const ids = equippedPacts(s.characters)
  const pact = ids.length
    ? pactMods(ids, s.characters.length, craft.pactMalusMult, craft.doublePacte ? 2 : 1)
    : emptyPactMods()
  setPactDerivedMods({
    hpMult: pact.hpMult * (buffs?.hpMult ?? 1),
    apsMult: pact.apsMult * (buffs?.speedMult ?? 1),
    apsForce: pact.apsForce,
    leechBonus: pact.leechBonus,
    noDodge: pact.noDodge,
  })
  return pact
}

/** Trésorerie de guerre : chaque kill blinde un bouclier (2% PV max, cumul capé). */
function tresorerieShield(chars: Character[], cap?: number) {
  if (!cap) return
  for (const c of chars) {
    if (c.hp <= 0) continue
    const mh = charMaxHp(c)
    const capV = cap * mh
    if ((c.absorb ?? 0) < capV) c.absorb = Math.min(capV, (c.absorb ?? 0) + 0.02 * mh)
  }
}

/* ================================================================== */
/* v0.26 — état transitoire & helpers des 40 nouvelles gemmes          */
/* (non persisté, comme les cooldowns — voir condGems.ts pour le pool) */
/* ================================================================== */

// Fenêtres d'ÉQUIPE (secondes restantes, décrémentées au pas de combat).
let fievreLeft = 0        // 🦷 Fièvre de l'hallali : vol de vie dopé après un kill
let testamentLeft = 0     // 📜 Testament : +10% de dégâts après une mort
let marcheCount = 0       // 🎺 Marche triomphale : combats gagnés sans mort
let ancrageBroken = false // ⚓ Ancrage : un héros est tombé dans le combat courant
let carillonReady = false // 🛎️ Carillon : la prochaine recharge est à moitié prix
// v0.26 — runes de TEMPS & pactes (transitoire, non persisté).
let hateFunebreLeft = 0   // 🪽 Hâte funèbre : fenêtre de vitesse après un kill
let echoTempAcc = 0       // 🌀 Écho temporel : horloge des 30 s
let lastCastGlobal: { charId: string; pid: string } | null = null // dernière capacité lancée (équipe)
let mementoOn = false     // 💀 Memento mori : un héros est tombé pendant ce run
const rembUsed = new Set<string>() // ⏪ Rembobinage : héros déjà servis CE combat
// Par héros (clé charId).
const verreTimer = new Map<string, number>()    // 🪟 Verre trempé : s sans subir de coup
const carapaceCdMap = new Map<string, number>() // 🐢 Carapace réactive : recharge (s)
const shieldCdMap = new Map<string, number>()   // 🛡 Mur de boucliers (Rempart) : recharge interne (s)
const riposteAcc = new Map<string, number>()    // 🤺 Riposte mesurée : s sous le feu
const echangeurAcc = new Map<string, number>()  // 🔃 Échangeur : fraction de PV subis accumulée
const egideLeft = new Map<string, number>()     // 🛡️ Égide : coups encore couverts CE combat
const hotPool = new Map<string, number>()       // 💧 Goutte-à-goutte : réserve de soin différé

/** 🎺 Bonus de la Marche triomphale (+0,5%/combat gagné sans mort, capé). */
function marcheBonus(cap?: number): number {
  return cap ? Math.min(cap, 0.005 * marcheCount) : 0
}

/** v0.26 : réactions d'équipe aux KILLS (🔔 Glas, 🦷 Fièvre, 🎺 Marche, 🪽 Hâte funèbre,
 *  🍽️ Jeûne). À appeler aux mêmes endroits que crescendoAdd — `wins` = combats gagnés. */
function gemKillEvents(
  chars: Character[],
  cond: CondMods | undefined,
  kills: number,
  wins: number,
  runes?: TimeRuneMods,
  pact?: PactMods,
) {
  if (kills <= 0) return
  if (cond?.fievreLeech) fievreLeft = 5
  if (cond?.marcheCap) marcheCount += wins
  if (runes?.hateFunebre) hateFunebreLeft = 4
  // 🍽️ Pacte du Jeûne : seul soin restant — chaque kill nourrit l'équipe.
  if (pact?.killHeal) {
    for (const c of chars) {
      if (c.hp <= 0) continue
      c.hp = Math.min(charMaxHp(c), c.hp + charMaxHp(c) * pact.killHeal * kills)
    }
  }
  if (cond?.glasN) {
    const n = (gemCounters.get('glas') ?? 0) + kills
    const triggers = Math.floor(n / cond.glasN)
    gemCounters.set('glas', n - triggers * cond.glasN)
    if (triggers > 0 && !pact?.noHeal) {
      for (const c of chars) {
        if (c.hp <= 0) continue
        c.hp = Math.min(charMaxHp(c), c.hp + charMaxHp(c) * 0.05 * triggers)
      }
    }
  }
}

/** v0.26 : début de combat côté RUNES — 🔓 Ouverture (plus longue capacité prête),
 *  🎒 Préparation (recharges avancées), ⏪ Rembobinage réarmé. */
function runeFightStart(chars: Character[], runes?: TimeRuneMods) {
  rembUsed.clear()
  if (!runes) return
  for (const c of chars) {
    if (c.hp <= 0) continue
    if (runes.ouverture) {
      let bestKey = ''
      let bestCd = 0
      for (const pid of charDeck(c)) {
        if (!pid) continue
        const p = getPower(pid)
        if (!p || p.kind !== 'active') continue
        if ((p.cooldown ?? 0) > bestCd) { bestCd = p.cooldown ?? 0; bestKey = `${c.id}:${pid}` }
      }
      if (bestKey) cooldowns.set(bestKey, 0)
    }
    if (runes.preparationSec) {
      for (const pid of charDeck(c)) {
        if (!pid) continue
        const k = `${c.id}:${pid}`
        cooldowns.set(k, Math.max(0, (cooldowns.get(k) ?? 0) - runes.preparationSec))
      }
    }
  }
}

/** ⏪ Rembobinage : un héros qui passe sous 25% PV récupère X s de recharges (1×/combat). */
function runeRembobinage(chars: Character[], runes?: TimeRuneMods) {
  if (!runes?.rembobinageSec) return
  for (const c of chars) {
    if (c.hp <= 0 || rembUsed.has(c.id)) continue
    if (c.hp / charMaxHp(c) >= 0.25) continue
    rembUsed.add(c.id)
    for (const pid of charDeck(c)) {
      if (!pid) continue
      const k = `${c.id}:${pid}`
      cooldowns.set(k, Math.max(0, (cooldowns.get(k) ?? 0) - runes.rembobinageSec))
    }
  }
}

/** 🪦 Usure + 💀 Memento + 🩸 pacte : multiplicateur offensif d'équipe dépendant du temps. */
function runePactOffense(t: number, runes?: TimeRuneMods, pact?: PactMods): number {
  let m = 1
  if (runes?.usurePer) m *= 1 + runes.usurePer * Math.min(3, Math.floor(t / 10))
  if (pact) m *= pact.dmgOut
  if (mementoOn && pact?.mementoBonus) m *= 1 + pact.mementoBonus
  return m
}

/** v0.26 : début de combat — Égide rechargée, Ancrage réarmé, boucliers de départ
 *  (🫙 Réservoir pressurisé, 🔰 Doctrine du bouclier). Mute les copies de `chars`. */
function gemFightStart(
  chars: Character[],
  info: ({ derived: DerivedStats } | null)[],
  cond?: CondMods,
) {
  ancrageBroken = false
  for (const c of chars) egideLeft.set(c.id, cond?.egideHits ?? 0)
  if (!cond) return
  if (cond.reservoirPct) {
    for (const c of chars) {
      if (c.hp <= 0) continue
      c.absorb = Math.max(c.absorb ?? 0, cond.reservoirPct * charMaxHp(c))
    }
  }
  if (cond.doctrinePct) {
    // Porteur de bouclier avec la meilleure Barrière → partage une part de ses PV de barrière.
    let hi = -1
    let hiVal = 0
    chars.forEach((c, i) => {
      const d = info[i]
      if (!d || c.hp <= 0 || !c.equipment.armeSecondaire) return
      if (d.derived.shieldPct > hiVal) { hiVal = d.derived.shieldPct; hi = i }
    })
    if (hi >= 0 && hiVal > 0) {
      const share = cond.doctrinePct * charMaxHp(chars[hi]) * (hiVal / (1 + hiVal))
      chars.forEach((c, i) => {
        if (i !== hi && c.hp > 0) c.absorb = Math.max(c.absorb ?? 0, share)
      })
    }
  }
}

/** v0.26 : un héros est-il tombé pendant ce pas ? (⚓ Ancrage, 🎺 Marche, 📜 Testament).
 *  À appeler APRÈS le Sursis (un héros sauvé in extremis n'est pas « tombé »). */
function gemDeathEvents(chars: Character[], aliveBefore: boolean[], cond?: CondMods, pact?: PactMods) {
  let died = false
  chars.forEach((c, i) => { if (aliveBefore[i] && c.hp <= 0) died = true })
  if (!died) return
  ancrageBroken = true
  marcheCount = 0
  if (pact?.mementoBonus) mementoOn = true // 💀 Memento mori : le deuil devient rage (fin du run)
  if (cond?.testamentPct) {
    testamentLeft = 10
    for (const c of chars) {
      if (c.hp <= 0) continue
      const mh = charMaxHp(c)
      c.absorb = Math.min(mh, (c.absorb ?? 0) + cond.testamentPct * mh)
    }
  }
}

/** v0.26 : multiplicateur de dégâts SUBIS des gemmes défensives (🪨 Granit, ⚓ Ancrage,
 *  💫 Sixième sens, 🌂 Paratonnerre, 🧱 Rempart, 🗿 Mémoire de la pierre). Plancher 0,1. */
function gemDefenseMult(
  c: Character,
  mh: number,
  o: { cond?: CondMods; casting?: boolean; surge?: boolean; aliveEnemies?: number; telegraphed?: boolean; tenacity?: number },
): number {
  const cond = o.cond
  if (!cond) return 1
  let m = 1
  if (cond.granitPct && c.hp / mh <= 0.3) m *= 1 - cond.granitPct
  if (cond.ancragePct && !ancrageBroken) m *= 1 - cond.ancragePct
  if (cond.sixiemePct && (o.casting || o.telegraphed)) m *= 1 - cond.sixiemePct
  if (cond.paratonnerrePct && o.surge) m *= 1 - cond.paratonnerrePct
  if (cond.rempartPer && (o.aliveEnemies ?? 1) > 1) {
    m *= 1 - Math.min(cond.rempartPer * 5, cond.rempartPer * ((o.aliveEnemies ?? 1) - 1))
  }
  if (o.telegraphed && cond.memoirePct && o.tenacity) m *= 1 - o.tenacity * cond.memoirePct
  return Math.max(0.1, m)
}

/** v0.26 : chaîne défensive de BASTION autour d'un dégât héros — 🛡️ Égide (1er coup),
 *  🐢 Carapace (gros coup → bouclier), 🔃 Échangeur (dégâts → recharges), 🌵 Cilice (épines),
 *  🪟 Verre trempé (reset). `discrete` = vrai COUP (télégraphe, explosion), pas le flux continu. */
function gemDamageHero(
  c: Character,
  amount: number,
  o: { cond?: CondMods; attacker?: Enemy; discrete?: boolean },
): number {
  let amt = amount
  const cond = o.cond
  if (o.discrete && amt > 0 && cond?.egidePct && (egideLeft.get(c.id) ?? 0) > 0) {
    amt *= 1 - cond.egidePct
    egideLeft.set(c.id, (egideLeft.get(c.id) ?? 1) - 1)
  }
  const taken = damageHero(c, amt)
  if (taken > 0) {
    verreTimer.set(c.id, 0)
    const mh = charMaxHp(c)
    if (cond?.echangeurSec) {
      const acc = (echangeurAcc.get(c.id) ?? 0) + taken / mh
      const steps = Math.floor(acc / 0.1)
      echangeurAcc.set(c.id, acc - steps * 0.1)
      if (steps > 0) {
        for (const pid of charDeck(c)) {
          if (!pid) continue
          const k = `${c.id}:${pid}`
          cooldowns.set(k, Math.max(0, (cooldowns.get(k) ?? 0) - steps * cond.echangeurSec))
        }
      }
    }
    if (o.discrete && cond?.carapacePct && taken >= 0.15 * mh && (carapaceCdMap.get(c.id) ?? 0) <= 0) {
      c.absorb = (c.absorb ?? 0) + cond.carapacePct * mh
      carapaceCdMap.set(c.id, 10)
    }
    if (cond?.cilicePct && o.attacker && o.attacker.hp > 0) {
      o.attacker.hp = Math.max(0, o.attacker.hp - taken * cond.cilicePct)
    }
  }
  return taken
}

/** 🗼 Tour de garde : si la cible est sous 30% PV, une fraction des coups part vers le plus
 *  endurant (PV max). Renvoie l'index du « garde » et la fraction redirigée, ou null. */
function tourGardeSplit(chars: Character[], targetI: number, cond?: CondMods): { tankI: number; frac: number } | null {
  if (!cond?.tourGardePct) return null
  const t = chars[targetI]
  if (t.hp <= 0 || t.hp / charMaxHp(t) > 0.3) return null
  let tankI = -1
  let best = charMaxHp(t)
  chars.forEach((c, i) => {
    if (i === targetI || c.hp <= 0) return
    const mh = charMaxHp(c)
    if (mh > best) { best = mh; tankI = i }
  })
  return tankI >= 0 ? { tankI, frac: cond.tourGardePct } : null
}

/** v0.26 : multiplicateur OFFENSIF par héros des nouvelles gemmes (🎺 Marche, 📜 Testament,
 *  ⚡ Sous tension, 🪟 Verre trempé, 🧭 Boussole vs champion, 🎯 Première impression). */
function gemOffenseMult(
  c: Character,
  cond: CondMods | undefined,
  target: Enemy | undefined,
  firstOfPack: boolean,
): number {
  if (!cond) return 1
  let m = 1
  if (cond.marcheCap) m *= 1 + marcheBonus(cond.marcheCap)
  if (cond.testamentPct && testamentLeft > 0) m *= 1.1
  if (cond.verreTrempePct && (verreTimer.get(c.id) ?? 0) >= 4) m *= 1 + cond.verreTrempePct
  if (cond.tensionPct) {
    let all = true
    let any = false
    for (const pid of charDeck(c)) {
      if (!pid) continue
      const p = getPower(pid)
      if (!p || p.kind !== 'active') continue
      any = true
      if ((cooldowns.get(`${c.id}:${pid}`) ?? 0) <= 0) { all = false; break }
    }
    if (any && all) m *= 1 + cond.tensionPct
  }
  if (cond.boussolePct && target?.champion) m *= 1 + cond.boussolePct
  if (cond.premierePct && firstOfPack) m *= 1 + cond.premierePct
  return m
}

/** 🤺 Riposte mesurée : accumule le temps sous le feu de `c` ; déclenche des ripostes. */
function gemRiposte(
  c: Character,
  d: { derived: DerivedStats; profile: DamageProfile; cmods: CharCombatMods },
  enemy: Enemy,
  dt: number,
  cond?: CondMods,
): number {
  if (!cond?.riposteSec || c.hp <= 0 || enemy.hp <= 0) return 0
  let acc = (riposteAcc.get(c.id) ?? 0) + dt
  let dealt = 0
  while (acc >= cond.riposteSec && enemy.hp > 0) {
    acc -= cond.riposteSec
    const hit = rollHit(d.derived, d.profile, enemy, { bonusMult: d.cmods.damageMult })
    enemy.hp = Math.max(0, enemy.hp - hit.damage)
    dealt += hit.damage
  }
  riposteAcc.set(c.id, acc)
  return dealt
}

/** 💧/🏆 Soin de VOL DE VIE avec débordement (Goutte-à-goutte : l'excès devient régén différée). */
function gemLeechHeal(c: Character, amount: number, cond?: CondMods) {
  if (amount <= 0) return
  const mh = charMaxHp(c)
  const before = c.hp
  c.hp = Math.min(mh, c.hp + amount)
  const over = amount - (c.hp - before)
  if (over > 0 && cond?.goutteePct) {
    hotPool.set(c.id, Math.min(mh, (hotPool.get(c.id) ?? 0) + over * cond.goutteePct))
  }
}

/** 🏆/⚱️ Soin de CAPACITÉ avec débordement (Calice → bouclier) et écho (Vases communicants).
 *  `echo: false` pour les soins de GROUPE (tout le monde est déjà servi — pas de ricochet). */
function gemAbilityHeal(t: Character, amount: number, cond: CondMods | undefined, chars: Character[], echo = true) {
  if (amount <= 0) return
  const mh = charMaxHp(t)
  const before = t.hp
  t.hp = Math.min(mh, t.hp + amount)
  const over = amount - (t.hp - before)
  if (over > 0 && cond?.caliceCap) {
    const capV = cond.caliceCap * mh
    if ((t.absorb ?? 0) < capV) t.absorb = Math.min(capV, (t.absorb ?? 0) + over)
  }
  if (echo && cond?.vasesPct) {
    let low: Character | null = null
    for (const a of chars) {
      if (a.hp <= 0 || a === t) continue
      if (!low || a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
    }
    if (low) low.hp = Math.min(charMaxHp(low), low.hp + amount * cond.vasesPct)
  }
}

/** 🌗 COMMUNION D'OMBRE (v0.34) : les DoT du Prêtre soignent l'allié le plus blessé (somme des frac
 *  `dotHealsParty` de l'équipe × le tick de DoT). Sustain de groupe né de l'affliction (rôle Lumière). */
function healDotParty(chars: Character[], info: ({ cmods: CharCombatMods } | null | undefined)[], dmg: number) {
  let pool = 0
  for (let i = 0; i < chars.length; i++) { const d = info[i]; if (d && d.cmods.dotHealsParty > 0) pool += dmg * d.cmods.dotHealsParty }
  if (pool <= 0) return
  const alive = chars.filter((c) => c.hp > 0)
  if (!alive.length) return
  let low = alive[0]
  for (const a of alive) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
  low.hp = Math.min(charMaxHp(low), low.hp + pool)
}

/** 🌀 MÉTAMORPHE (v0.34) « Danse Primordiale » : multiplicateur de dégâts de la FORME active + Instinct.
 *  Fauve/Ours/Hibou donnent chacun leur bonus tant qu'ils sont actifs ; la Chimère cumule les 3 ;
 *  la Mémoire des formes (echo) garde une part des deux autres formes ; l'Instinct ajoute son momentum.
 *  Tout est BORNÉ (% fixes, stacks plafonnés) → plat en ilvl. */
function formDamageMult(c: Character, cm: CharCombatMods): number {
  if (!cm.shifter) return 1
  let bonus: number
  if ((c.chimera ?? 0) > 0) {
    bonus = cm.formFauve + cm.formOurs + cm.formHibou // Forme Chimère : les 3 formes à la fois
  } else {
    const f = c.form ?? 0
    bonus = f === 1 ? cm.formOurs : f === 2 ? cm.formHibou : cm.formFauve
    if (cm.formEcho > 0) bonus += cm.formEcho * (cm.formFauve + cm.formOurs + cm.formHibou - bonus) / 2 // écho des 2 autres formes
  }
  return 1 + bonus + cm.instinctPer * (c.instinct ?? 0)
}

/** 🛎️ Carillon : à appeler au moment de POSER une recharge — renvoie 0,5 quand le bonus est mûr. */
function carillonMult(cond?: CondMods): number {
  if (!cond?.carillonN) return 1
  if (carillonReady) { carillonReady = false; return 0.5 }
  const n = (gemCounters.get('carillon') ?? 0) + 1
  if (n >= cond.carillonN) { carillonReady = true; gemCounters.set('carillon', 0) } else gemCounters.set('carillon', n)
  return 1
}

/** 🔮 Prisme d'accord : déplace une fraction du profil de dégâts vers le type du biome. */
function shiftProfile(p: DamageProfile, to: DamageType, frac: number): DamageProfile {
  const profile: Partial<Record<DamageType, number>> = {}
  for (const t in p.profile) profile[t as DamageType] = (p.profile[t as DamageType] ?? 0) * (1 - frac)
  profile[to] = (profile[to] ?? 0) + frac
  return { ...p, profile }
}

/** v0.31 — AUTO-ÉQUIP des slots VIDES (onboarding) : remplit chaque emplacement vide du perso avec le
 *  meilleur objet compatible de l'inventaire. NON destructif — les slots déjà remplis ne bougent pas
 *  (les UPGRADES restent un choix manuel). Un perso nu se gear ainsi tout seul depuis ses drops. */
function autoEquipEmpties(char: Character, inventory: Item[]): { char: Character; inventory: Item[]; equipped: number } {
  const equipment = { ...char.equipment }
  let inv = inventory
  let equipped = 0
  for (const sl of EQUIP_SLOTS) {
    if (equipment[sl.id]) continue
    let bestIdx = -1
    let bestScore = -1
    for (let i = 0; i < inv.length; i++) {
      const it = inv[i]
      if (!it.locked && slotAccepts(sl.id, it.type) && itemScore(it) > bestScore) { bestScore = itemScore(it); bestIdx = i }
    }
    if (bestIdx >= 0) {
      equipment[sl.id] = inv[bestIdx]
      inv = inv.filter((_, i) => i !== bestIdx)
      equipped++
    }
  }
  if (equipped === 0) return { char, inventory, equipped: 0 }
  const nc: Character = { ...char, equipment }
  nc.hp = Math.min(nc.hp || charMaxHp(nc), charMaxHp(nc))
  return { char: nc, inventory: inv, equipped }
}

function freshSave(): SaveData {
  // v0.30.1 — on part NU (zéro stuff) : la rampe d'onboarding (enemies.ts) rend les premiers paliers
  // faibles pour qu'on loote et s'équipe de zéro, en découvrant les concepts/donjons/métiers.
  return {
    characters: [makeCharacter('Héros', 1, 'force')],
    activeChar: 0,
    stage: 1,
    bestStage: 1,
    activeBiome: 'physique',
    nextRotateAt: Date.now() + BIOME_ROTATE_MS,
    biomeLockUntil: 0,
    biomeStages: emptyBiomeRecord(1, 1),
    biomeBest: emptyBiomeRecord(1, 0),
    farmLock: false,
    gold: 0,
    essence: 0,
    noyau: 0,
    poussiere: 0,
    quint: emptyQuint(),
    gems: {},
    gemDust: 0,
    gemsSeen: [],
    lastStoneTrade: 0,
    lingots: 0,
    trempe: null,
    forgeContracts: null,
    lastMasterwork: 0,
    runeFragments: 0,
    runeCrafted: {},
    reagents: {},
    brews: {},
    alchemyRecipes: [],
    cuvesEnCours: [],
    elixirActive: null,
    oilActive: null,
    antidoteActive: null,
    mutagenActive: null,
    armedRaidShield: null,
    armedChestBonus: null,
    armedXpBonus: null,
    lastTransmute: 0,
    philosophale: false,
    metiersV: 7,
    essences: {},
    sceaux: 0,
    dungeonProgress: emptyDungeonProgress(),
    dungeon: null,
    pendingChest: null,
    pendingChoice: null,
    lastFreeBox: 0,
    boxPity: 0,
    orbes: 0,
    fragments: 0,
    cosmic: 0,
    echos: 0,
    prestigeRank: 0,
    constellation: {},
    relic: null,
    raidProgress: emptyRaidProgress(),
    raidTrophies: {},
    raidTierUnlocked: {},
    raid: null,
    runesOwned: {},
    codex: [],
    upgrades: {},
    conseil: emptyConseil(),
    maitrisePoints: 0,
    maitrise: {},
    achievements: {},
    cosmetics: {},
    metiers: emptyMetiers(),
    automates: [],
    shopStock: [],
    inventory: [],
    recycleThreshold: 4,
    autoRecycle: false,
    tut: { claimed: [], bought: false },
    // ✉ Boîte de réception semée d'un cadeau de bienvenue (montre OÙ atterrissent les gains). Pour les
    // saves existantes, le merge `{ ...freshSave(), ...p }` injecte ce message une fois (p.inbox absent).
    inbox: [welcomeMessage(Date.now())],
    daily: emptyDaily(),
    totalKills: 0,
    totalDungeons: 0,
    event: emptyEvent(),
    eventCosmetics: [],
    killsSinceEpic: 0,
    lastSeen: Date.now(),
    lastShopRefresh: 0,
    // Partie NEUVE : on montre l'écran d'accueil (but du jeu + choix de spé) avant de lancer le combat.
    onboarded: false,
  }
}

/**
 * Protection des ventes/recyclages DE MASSE : les objets à effet unique de très haute rareté
 * (Cosmique+) ne partent jamais en lot — recyclage à l'unité uniquement. Les uniques plus communs
 * (Épique…) restent recyclables en masse : c'est le moteur d'essences du jeu.
 */
function bulkProtected(item: Item): boolean {
  // 🔒 (v0.28) le verrou joueur protège de TOUTE suppression de masse/auto.
  return !!item.locked || (!!item.unique && RARITIES[item.rarity].tier >= 13)
}

/** Ajoute les uniques portés par des objets au grimoire (sans doublon). */
function discoverFromItems(codex: string[], items: (Item | undefined)[]): string[] {
  let out = codex
  for (const it of items) {
    const id = it?.unique?.id
    if (id && !out.includes(id)) out = [...out, id]
  }
  return out
}

let migrateId = 1
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateItem(item: any) {
  if (!item.type && item.slot) {
    const s = item.slot
    item.type = (s === 'anneau1' || s === 'anneau2' ? 'anneau' : s === 'bijou1' || s === 'bijou2' ? 'bijou' : s) as ItemType
    delete item.slot
  }
  if (item.unique && typeof item.unique.rank !== 'number') item.unique = { id: item.unique.id, rank: 1 }
  // Migration itémisation : Endurance garantie + orientation, primaire offensif uniquement.
  if (item.primary === 'endurance') {
    item.endurance = (item.endurance ?? 0) + item.primaryValue
    item.primary = 'force'
    item.primaryValue = Math.max(1, Math.round(item.primaryValue * 0.3))
    item.orientation = 'defensif'
  }
  if (typeof item.endurance !== 'number') item.endurance = 0
  if (!item.orientation) item.orientation = 'offensif'
  // Migration des affixes vers le format unifié (stat / dmgType / resist).
  // Renommage v0.17 : Bouclier→Barrière, Polyvalence supprimée→Maîtrise (préserve la valeur du stuff).
  const renameStat = (s: string): import('./types').SecondaryStat => (s === 'bouclier' ? 'barriere' : s === 'polyvalence' ? 'maitrise' : s) as import('./types').SecondaryStat
  const validStats = new Set<string>(SECONDARY_STATS)
  const affixes: Affix[] = []
  if (Array.isArray(item.affixes)) {
    for (const a of item.affixes) {
      if (a && a.kind === 'stat') { const st = a.stat ? renameStat(a.stat) : undefined; if (st && validStats.has(st)) affixes.push({ ...a, stat: st } as Affix) }
      else if (a && a.kind) affixes.push(a as Affix)
      else if (a && a.stat && validStats.has(renameStat(a.stat))) affixes.push({ kind: 'stat', stat: renameStat(a.stat), value: a.value })
    }
  }
  if (Array.isArray(item.typeAffixes)) {
    for (const ta of item.typeAffixes) if (ta?.type) affixes.push({ kind: 'dmgType', type: ta.type, value: ta.value })
    delete item.typeAffixes
  }
  item.affixes = affixes
}

function sanitizeItem(item: Item) {
  item.id = `save-${migrateId++}`
  migrateItem(item)
}

/** Nettoie/migre les objets (inventaire + équipement de chaque perso). */
function sanitize(save: SaveData): SaveData {
  for (const item of save.inventory) sanitizeItem(item)

  // Ressources / champs ajoutés.
  if (typeof save.poussiere !== 'number') save.poussiere = 0
  if (typeof save.cosmic !== 'number') save.cosmic = 0
  // v0.31 — tutoriel (vieilles saves : si déjà avancé, on considère le tuto déjà fait pour ne pas
  // re-proposer les quêtes de base à un joueur établi).
  if (!save.tut || !Array.isArray(save.tut.claimed)) {
    save.tut = { claimed: (save.bestStage ?? 1) >= 15 ? [...TUT_QUEST_IDS] : [], bought: (save.bestStage ?? 1) >= 15 }
  }
  // ✉ Filet de sécurité (le semis de bienvenue arrive déjà via le merge freshSave → tableau présent).
  if (!Array.isArray(save.inbox)) save.inbox = []
  // 📅 Quotidien : défauts pour les vieilles saves (le passage de jour initialise au cold-start).
  if (typeof save.totalKills !== 'number') save.totalKills = 0
  if (typeof save.totalDungeons !== 'number') save.totalDungeons = 0
  if (!save.daily || typeof save.daily.date !== 'string' || !Array.isArray(save.daily.questIds)) save.daily = emptyDaily()
  // 🎉 Event : défauts pour les vieilles saves (le passage de semaine initialise au cold-start).
  if (!save.event || typeof save.event.week !== 'string' || !Array.isArray(save.event.claimed)) save.event = emptyEvent()
  if (!Array.isArray(save.eventCosmetics)) save.eventCosmetics = []
  {
    const q = emptyQuint()
    const src = (save.quint ?? {}) as Record<string, number>
    for (const t of DAMAGE_TYPE_LIST) if (typeof src[t] === 'number') q[t] = src[t]
    save.quint = q
  }
  if (typeof save.farmLock !== 'boolean') save.farmLock = false
  if (!save.gems || typeof save.gems !== 'object') save.gems = {}
  if (typeof save.gemDust !== 'number') save.gemDust = 0
  if (typeof save.lastStoneTrade !== 'number') save.lastStoneTrade = 0
  if (typeof save.lingots !== 'number') save.lingots = 0
  if (save.trempe === undefined) save.trempe = null
  if (save.forgeContracts === undefined) save.forgeContracts = null
  if (typeof save.lastMasterwork !== 'number') save.lastMasterwork = 0
  if (typeof save.runeFragments !== 'number') save.runeFragments = 0
  if (!save.runeCrafted || typeof save.runeCrafted !== 'object') save.runeCrafted = {}
  // ⚗️ Officine (v0.26) — défauts des saves antérieures.
  if (!save.reagents || typeof save.reagents !== 'object') save.reagents = {}
  if (!save.brews || typeof save.brews !== 'object') save.brews = {}
  if (!Array.isArray(save.alchemyRecipes)) save.alchemyRecipes = []
  if (!Array.isArray(save.cuvesEnCours)) save.cuvesEnCours = []
  if (save.elixirActive === undefined) save.elixirActive = null
  if (save.oilActive === undefined) save.oilActive = null
  if (save.antidoteActive === undefined) save.antidoteActive = null
  if (save.mutagenActive === undefined) save.mutagenActive = null
  if (save.armedRaidShield === undefined) save.armedRaidShield = null
  if (save.armedChestBonus === undefined) save.armedChestBonus = null
  if (save.armedXpBonus === undefined) save.armedXpBonus = null
  if (typeof save.lastTransmute !== 'number') save.lastTransmute = 0
  if (typeof save.philosophale !== 'boolean') save.philosophale = false
  // v0.26 — MIGRATION des arbres (metiersV 2) : « Œil du maître » (+4%/rang ×5) devient
  // « Prodige » (+2%/rang ×15) → rangs ×2 (même valeur) ; ◈ Visionnaire (+12% + surillvl +1)
  // devient 6 rangs de Prodige + « Affûtage supérieur ». Personne ne perd un pourcent.
  if ((save.metiersV ?? 1) < 2 && save.metiers?.forgeron) {
    const nodes = { ...save.metiers.forgeron.nodes }
    if (nodes.chance) nodes.chance = Math.min(15, nodes.chance * 2)
    if (nodes.specVisionnaire) {
      nodes.chance = Math.min(15, (nodes.chance ?? 0) + 6)
      nodes.affutage = 1
      delete nodes.specVisionnaire
    }
    save.metiers = { ...save.metiers, forgeron: { ...save.metiers.forgeron, nodes } }
    save.metiersV = 2
  }
  // v0.26 — MIGRATION metiersV 3 : les specs plates (rang 1) deviennent des lignes étagées I→V.
  // L'ancien rang 1 valait l'étage III (mêmes chiffres : Chronomancien ×1,5, Législateur amplifié…)
  // → converti en rang 3 pour ne RIEN nerfer (les points en plus sont offerts par la migration).
  // (Joaillier : l'ancien rang 1 = « +1 rang de famille » = exactement le nouvel étage I → rien à migrer.)
  if ((save.metiersV ?? 1) < 3 && save.metiers) {
    for (const mid of ['runiste', 'alchimiste'] as const) {
      const st = save.metiers[mid]
      if (!st) continue
      const nodes = { ...st.nodes }
      for (const specId of ['specChrono', 'specLegislateur', 'specDistillateur', 'specTransmutateur']) {
        if (nodes[specId] === 1) nodes[specId] = 3
      }
      save.metiers = { ...save.metiers, [mid]: { ...st, nodes } }
    }
    save.metiersV = 3
  }
  // v0.28 E2 — MIGRATION metiersV 4 : arbre Forgeron RÉDUIT (Atelier + Manufacture). On fusionne les
  // anciens nœuds (surillvl+affutage, polissage+polissageFin, econome+specEconome, chance plafonné à 5)
  // et on RETIRE les disparus (Compagnonnage/Moules/Pédagogie/Sérendipité/Verrous/Contrats/Négociant/
  // Lingotier/Inspiration) → leurs points sont AUTOMATIQUEMENT rendus (pointsSpent recalculé). Idempotente.
  if ((save.metiersV ?? 1) < 4 && save.metiers?.forgeron) {
    const old: Record<string, number> = save.metiers.forgeron.nodes ?? {}
    const g = (id: string) => old[id] ?? 0
    const nodes: Record<string, number> = {}
    const surillvl = Math.min(2, g('surillvl') + g('affutage'))
    if (surillvl) nodes.surillvl = surillvl
    const polissage = Math.min(3, g('polissage') + g('polissageFin'))
    if (polissage) nodes.polissage = polissage
    const econome = Math.min(5, g('econome') + (g('specEconome') ? 2 : 0))
    if (econome) nodes.econome = econome
    const chance = Math.min(5, g('chance'))
    if (chance) nodes.chance = chance
    for (const [id, max] of [['transmute', 1], ['trempeLente', 1], ['ascension', 1], ['fonderie', 1], ['automates', 1], ['montage', 3], ['automate4', 1]] as const) {
      const v = Math.min(max, g(id))
      if (v) nodes[id] = v
    }
    save.metiers = { ...save.metiers, forgeron: { ...save.metiers.forgeron, nodes } }
    save.metiersV = 4
  }
  // v0.28 E2 — MIGRATION metiersV 5 : arbre Joaillier RÉDUIT (Taillerie + Maîtrise & Sources).
  // Fusionne les verbes-clés (taille = broyage+taille+qualité), garde specs/recoupe/fusion/corruption/
  // perçage/troc, RETIRE le filler → points rendus. Idempotente (clé : Math.max sur les rangs migrés).
  if ((save.metiersV ?? 1) < 5 && save.metiers?.joaillier) {
    const old: Record<string, number> = save.metiers.joaillier.nodes ?? {}
    const g = (id: string) => old[id] ?? 0
    const nodes: Record<string, number> = {}
    if (g('sertissage')) nodes.sertissage = 1
    const taille = Math.min(2, Math.max(g('taille'), g('broyage') ? 1 : 0) + (g('mainSure') || g('inspirationJ') ? 1 : 0))
    if (taille) nodes.taille = taille
    if (g('recoupe')) nodes.recoupe = 1
    if (g('fusion')) nodes.fusion = 1
    if (g('corruption')) nodes.corruption = 1
    if (g('percage')) nodes.percage = 1
    for (const sp of ['specRythme', 'specFlux', 'specEnv', 'specBastion']) {
      const v = Math.min(5, g(sp))
      if (v) nodes[sp] = v
    }
    if (g('marche') || g('marcheAuxPierres')) nodes.marche = 1
    save.metiers = { ...save.metiers, joaillier: { ...save.metiers.joaillier, nodes } }
    save.metiersV = 5
  }
  // v0.28 E2 — MIGRATION metiersV 6 : arbre Runiste RÉDUIT (Atelier runique + Voies). Garde les
  // verbes + les 3 spés ; RETIRE le filler (palimpseste/calligraphie/greffier/horloger) → points rendus.
  if ((save.metiersV ?? 1) < 6 && save.metiers?.runiste) {
    const old: Record<string, number> = save.metiers.runiste.nodes ?? {}
    const g = (id: string) => old[id] ?? 0
    const nodes: Record<string, number> = {}
    for (const [id, max] of [['gravure', 1], ['effacement', 1], ['forgeRunique', 1], ['surchargeRunique', 1], ['regles', 1], ['pactes', 1], ['specChrono', 5], ['specLegislateur', 5], ['specPactiste', 5], ['doublePacte', 1]] as const) {
      const v = Math.min(max, g(id))
      if (v) nodes[id] = v
    }
    save.metiers = { ...save.metiers, runiste: { ...save.metiers.runiste, nodes } }
    save.metiersV = 6
  }
  // v0.28 E2 — MIGRATION metiersV 7 : arbre Alchimiste RÉDUIT (Officine + Grand Œuvre). Fusionne les
  // cuves dans officine (R1-3), garde quint/synthèses/spés ; RETIRE le filler (paillasse/brassages/
  // grandsCrus/rendementQ/distillation/condensation/herboriste/doubleDistillation) → points rendus.
  if ((save.metiersV ?? 1) < 7 && save.metiers?.alchimiste) {
    const old: Record<string, number> = save.metiers.alchimiste.nodes ?? {}
    const g = (id: string) => old[id] ?? 0
    const nodes: Record<string, number> = {}
    const officine = Math.min(3, Math.max(g('officine'), g('officine') ? 1 : 0) + g('cuve3') + g('cuve4'))
    if (officine) nodes.officine = officine
    for (const [id, max] of [['quintessence', 1], ['transmutJour', 1], ['pharmacopee', 1], ['philosophale', 1], ['synthese1', 1], ['synthese2', 1], ['synthese3', 1], ['specTransmutateur', 5], ['specDistillateur', 5]] as const) {
      const v = Math.min(max, g(id))
      if (v) nodes[id] = v
    }
    save.metiers = { ...save.metiers, alchimiste: { ...save.metiers.alchimiste, nodes } }
    save.metiersV = 7
  }
  // v0.26 : 📖 Catalogue — les saves d'avant sont créditées de leurs gemmes déjà possédées
  // (stock + serties), pour ne pas repartir de zéro.
  if (!Array.isArray(save.gemsSeen)) save.gemsSeen = []
  {
    const seen = new Set(save.gemsSeen)
    for (const k of Object.keys(save.gems)) {
      const p = parseCondKey(k)
      if (p && (save.gems[k] ?? 0) > 0) seen.add(p.def.id)
    }
    for (const c of save.characters ?? []) {
      for (const slot in c.equipment) {
        const it = c.equipment[slot as EquipSlotId]
        for (const g of it?.gems ?? []) if (g.cond && getCondGem(g.cond)) seen.add(g.cond)
      }
    }
    save.gemsSeen = [...seen]
  }
  // Migration gemmes (v0.22) : les ÉLÉMENTAIRES sont broyées en poussière 🔹, les gemmes de
  // condition gagnent un rang (clé `cond:id[:rang]`). S'applique au stock ET aux gemmes serties.
  {
    for (const k of Object.keys(save.gems)) {
      if (k.startsWith('cond:')) {
        if (!parseCondKey(k)) delete save.gems[k] // gemme disparue du registre
        continue
      }
      const g = parseGemKey(k)
      save.gemDust += (save.gems[k] ?? 0) * legacyGemDust(g.tier || 1)
      delete save.gems[k]
    }
    const migrateItemGems = (it: Item) => {
      if (!it.gems?.length) return
      const keep: typeof it.gems = []
      for (const g of it.gems) {
        if (g.cond && getCondGem(g.cond)) keep.push({ ...g, rank: g.rank ?? 1 })
        else save.gemDust += legacyGemDust(g.tier || 1)
      }
      it.gems = keep.length ? keep : undefined
    }
    // Runes de STAT supprimées (v0.22) : effacées et remboursées en 🌌 poussière d'étoile.
    const migrateItemRune = (it: Item) => {
      if (it.enchant && !getEnchant(it.enchant)) {
        delete it.enchant
        save.poussiere += 8
      }
    }
    for (const it of save.inventory) { migrateItemGems(it); migrateItemRune(it) }
    for (const it of save.shopStock ?? []) { migrateItemGems(it); migrateItemRune(it) }
    for (const c of save.characters) for (const slot in c.equipment) { const it = c.equipment[slot as EquipSlotId]; if (it) { migrateItemGems(it); migrateItemRune(it) } }
  }
  // Automates : valide la structure (mission, bornes d'amélioration, banque).
  if (!Array.isArray(save.automates)) save.automates = []
  save.automates = save.automates
    .filter((a) => a && typeof a === 'object')
    .slice(0, AUTOMATE_MAX)
    .map((a, i) => ({
      id: typeof a.id === 'number' ? a.id : i + 1,
      name: typeof a.name === 'string' ? a.name : AUTOMATE_NAMES[i] ?? `Automate ${i + 1}`,
      mission: a.mission && (a.mission.kind === 'dungeon' || a.mission.kind === 'raid') && typeof a.mission.level === 'number' ? a.mission : null,
      progress: typeof a.progress === 'number' ? Math.max(0, a.progress) : 0,
      paused: a.paused === true,
      speedLvl: Math.max(0, Math.min(AUTOMATE_UPG_MAX, a.speedLvl ?? 0)),
      yieldLvl: Math.max(0, Math.min(AUTOMATE_UPG_MAX, a.yieldLvl ?? 0)),
      bank: a.bank && typeof a.bank === 'object' ? a.bank : {},
    }))
  // Métiers (v0.22) : migration de l'ancien duo Savoir-faire 🔧 / forgeUpgrades, sinon validation.
  // ATTENTION : loadSave spreade freshSave() AVANT la vieille sauvegarde — `save.metiers` existe
  // donc toujours (vide). La présence des champs LEGACY fait foi, pas l'absence de `metiers`.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = save as any
    const hasLegacy = typeof legacy.forgeMastery === 'number' || (legacy.forgeUpgrades && typeof legacy.forgeUpgrades === 'object')
    const metiersEmpty = !save.metiers || typeof save.metiers !== 'object' || !save.metiers.forgeron ||
      METIER_LIST.every((m) => {
        const st = save.metiers[m.id]
        return !st || ((st.xp ?? 0) === 0 && Object.keys(st.nodes ?? {}).length === 0)
      })
    if (hasLegacy && metiersEmpty) {
      save.metiers = migrateLegacyForge(
        typeof legacy.forgeMastery === 'number' ? legacy.forgeMastery : 0,
        legacy.forgeUpgrades && typeof legacy.forgeUpgrades === 'object' ? legacy.forgeUpgrades : {},
        save.automates.length > 0,
      )
    } else {
      const clean = emptyMetiers()
      for (const m of METIER_LIST) {
        const st = save.metiers[m.id]
        if (st && typeof st === 'object') {
          clean[m.id].xp = typeof st.xp === 'number' ? Math.max(0, st.xp) : 0
          if (st.nodes && typeof st.nodes === 'object') {
            for (const [id, rank] of Object.entries(st.nodes)) {
              const def = getMetierNode(m.id, id)
              if (def && typeof rank === 'number' && rank > 0) clean[m.id].nodes[id] = Math.min(def.maxRank, rank)
            }
          }
        }
      }
      save.metiers = clean
    }
    delete legacy.forgeMastery
    delete legacy.forgeUpgrades
  }
  if (typeof save.recycleThreshold !== 'number') save.recycleThreshold = 4
  if (typeof save.autoRecycle !== 'boolean') save.autoRecycle = false
  if (typeof save.lastFreeBox !== 'number') save.lastFreeBox = 0
  if (typeof save.boxPity !== 'number') save.boxPity = 0
  if (save.pendingChoice && !Array.isArray(save.pendingChoice.items)) save.pendingChoice = null
  if (typeof save.killsSinceEpic !== 'number') save.killsSinceEpic = 0
  if (typeof save.lastSeen !== 'number') save.lastSeen = Date.now()
  if (typeof save.lastShopRefresh !== 'number') save.lastShopRefresh = 0
  // Filet de sécurité : une save chargée SANS le flag = joueur existant → déjà onboardé (pas d'écran
  // d'accueil). Seul `freshSave()` pose explicitement `false` (et false reste false : c'est un booléen).
  if (typeof save.onboarded !== 'boolean') save.onboarded = true

  // v0.27 (F2) — rotation/lock des biomes (défauts pour les anciennes saves).
  if (typeof save.nextRotateAt !== 'number') save.nextRotateAt = Date.now() + BIOME_ROTATE_MS
  if (typeof save.biomeLockUntil !== 'number') save.biomeLockUntil = 0
  // v0.27 (Lot 5) — prestige (défauts pour les anciennes saves).
  if (typeof save.echos !== 'number') save.echos = 0
  if (typeof save.prestigeRank !== 'number') save.prestigeRank = 0
  if (!save.constellation || typeof save.constellation !== 'object') save.constellation = {}
  if (typeof save.relic === 'undefined') save.relic = null
  // Biomes (v0.18) : une ancienne save mono-zone devient le biome Physique.
  if (!save.activeBiome || !BIOME_IDS.includes(save.activeBiome)) save.activeBiome = 'physique'
  {
    const stages = emptyBiomeRecord(Math.max(1, save.stage ?? 1), 1)
    const best = emptyBiomeRecord(Math.max(1, save.bestStage ?? 1), 0)
    const srcStages = (save.biomeStages ?? {}) as Record<string, number>
    const srcBest = (save.biomeBest ?? {}) as Record<string, number>
    for (const id of BIOME_IDS) {
      if (typeof srcStages[id] === 'number') stages[id] = srcStages[id]
      if (typeof srcBest[id] === 'number') best[id] = srcBest[id]
    }
    save.biomeStages = stages
    save.biomeBest = best
    // `stage` = palier courant du biome actif ; `bestStage` = max global.
    save.stage = Math.max(1, stages[save.activeBiome] ?? 1)
    save.bestStage = globalBest(best)
  }

  // raidProgress : ancien `number` (raids génériques) → record par raid (refonte). On repart à 0.
  const rp = save.raidProgress as unknown
  if (!rp || typeof rp === 'number') {
    save.raidProgress = emptyRaidProgress()
  } else {
    const rec = emptyRaidProgress()
    for (const id of Object.keys(RAIDS) as RaidId[]) rec[id] = (rp as RaidProgress)[id] ?? 0
    save.raidProgress = rec
  }
  // 🏆 Trophées & tiers débloqués (v0.24) : migration — l'accès existant est conservé
  // (tier débloqué = meilleur tier vaincu + 1), les Trophées partent de zéro.
  if (!save.raidTrophies || typeof save.raidTrophies !== 'object') save.raidTrophies = {}
  // 🪄 Runes possédées (v0.25) : stash vide au départ — les runes déjà GRAVÉES sont conservées.
  if (!save.runesOwned || typeof save.runesOwned !== 'object') save.runesOwned = {}
  // 🏛️ Conseil des Maîtrises (v0.25) : contrats hebdo + arbre minime.
  if (!save.conseil || typeof save.conseil !== 'object') save.conseil = emptyConseil()
  if (typeof save.maitrisePoints !== 'number') save.maitrisePoints = 0
  if (!save.maitrise || typeof save.maitrise !== 'object') save.maitrise = {}
  if (!save.achievements || typeof save.achievements !== 'object') save.achievements = {}
  if (!save.cosmetics || typeof save.cosmetics !== 'object') save.cosmetics = {}
  // 🏪 v0.25 (DESIGN §1) : améliorations de combat + Sacoches SUPPRIMÉES — remboursement 100%
  // (or + éclats, recalculé depuis les formules de coût d'origine). Durcissement assumé.
  {
    const up = (save.upgrades ?? {}) as Record<string, number>
    let refundGold = 0
    let refundEclats = 0
    for (const id in REMOVED_UPGRADES) {
      const lvl = up[id] ?? 0
      if (lvl > 0) {
        const def = REMOVED_UPGRADES[id]
        for (let i = 0; i < lvl; i++) {
          const c = Math.round(def.baseCost * Math.pow(def.growth, i))
          refundGold += c
          refundEclats += Math.round(c * (def.eclatsFrac ?? 0))
        }
      }
      delete up[id]
    }
    if (refundGold > 0) {
      save.gold += refundGold
      save.essence += refundEclats
    }
  }
  {
    // SEED UNIQUE (v0.24 fix) : si la save n'a pas encore de tiers débloqués (pré-v0.24), on dérive
    // l'accès du meilleur tier vaincu +1. SINON on conserve l'acquis SANS re-bump — avant, ce bloc
    // tournait à CHAQUE chargement et faisait `max(progress+1, …)` → clear le tier N rouvrait le N+1
    // GRATUITEMENT au reload (le gate Trophées court-circuité). Désormais seul `unlockRaidTier` ouvre.
    const existing = save.raidTierUnlocked && typeof save.raidTierUnlocked === 'object'
      ? (save.raidTierUnlocked as Partial<Record<RaidId, number>>)
      : null
    const unlocked: Partial<Record<RaidId, number>> = {}
    for (const id of Object.keys(RAIDS) as RaidId[]) {
      unlocked[id] = existing
        ? Math.max(1, existing[id] ?? 1)                // conserve, ne re-bump jamais depuis progress
        : Math.max(1, (save.raidProgress[id] ?? 0) + 1) // seed initial, une seule fois
    }
    save.raidTierUnlocked = unlocked
  }

  // Raid en cours au format obsolète (pas de `raidId`) → abandonné par la migration.
  if (save.raid && !(save.raid as { raidId?: string }).raidId) save.raid = null
  // v0.23 : un raid = UN affrontement. Un raid multi-boss en cours (ancienne save) est abandonné.
  if (save.raid && (save.raid as ActiveRaid).totalBosses !== 1) save.raid = null

  // dungeonProgress : REFONTE v0.17 (clé = id de donjon-ressource, plus le type de dégâts) → reset propre,
  // en conservant uniquement les clés déjà au nouveau format si présentes.
  const dp = save.dungeonProgress as unknown
  const dprec = emptyDungeonProgress()
  if (dp && typeof dp === 'object') {
    for (const id of Object.keys(DUNGEONS) as DungeonId[]) {
      const v = (dp as Record<string, number>)[id]
      if (typeof v === 'number') dprec[id] = v
    }
  }
  save.dungeonProgress = dprec

  // Donjon actif : structure refondue (v0.17). Sans `dungeonId` (ancien format), on l'abandonne proprement.
  if (save.dungeon && !(save.dungeon as { dungeonId?: string }).dungeonId) save.dungeon = null
  if (save.raid) {
    const r = save.raid as ActiveRaid & { enemy?: Enemy }
    if (!Array.isArray(r.enemies)) {
      r.enemies = r.enemy ? [r.enemy] : []
    }
    delete r.enemy
    if (!r.enemies.length) save.raid = null
  }
  for (const c of save.characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as EquipSlotId]
      if (it) sanitizeItem(it)
    }
    // Talents : on CONSERVE l'allocation du joueur. On purge les nœuds inconnus (vieilles saves),
    // on garantit les racines, et on recalcule les dérivés. v0.33 : on ROUTE chaque nœud vers son
    // arbre (base / Panthéon) d'après sa constellation — migre les saves v0.32 où les 4 classes
    // avancées vivaient dans l'arbre unique (elles atterrissent dans `pantheon`, build préservé).
    const rawTalents = c.talents && typeof c.talents === 'object' ? c.talents : {}
    const rawPantheon = c.pantheon && typeof c.pantheon === 'object' ? c.pantheon : {}
    const talents: Record<string, number> = { co_start: 1 }
    const pantheon: Record<string, number> = { pa_start: 1 }
    let spent = 0
    for (const src of [rawTalents, rawPantheon]) {
      for (const id in src) {
        if (id === 'co_start' || id === 'pa_start') continue
        const node = getTalent(id)
        const rank = src[id]
        if (!node || rank <= 0) continue
        const r = Math.min(rank, node.maxRank)
        if (nodeTree(node) === 'pantheon') {
          pantheon[id] = r // Panthéon : pool de Points d'Éveil séparé (ne grève pas les points de niveau).
        } else {
          talents[id] = r
          spent += r
        }
      }
    }
    c.talents = talents
    c.pantheon = pantheon
    // Points restants = gagnés (au-delà du niveau de départ des talents) − dépensés (hors racine gratuite).
    c.talentPoints = Math.max(0, talentPointsForLevel(c.level) - spent)
    c.unlockedPowers = computeUnlockedPowers({ ...talents, ...pantheon })
    // v0.30 : RÉPARTITION actifs (5) / GÉNÉRATEURS (3) / passifs (3). Migration : on relit les anciens
    // `powers` (qui mélangeaient builders & actifs) + `generators` + `passives`, on valide, on range par
    // genre — les builders QUITTENT la barre des actifs et atterrissent dans leurs slots dédiés.
    const equipped = [
      ...(Array.isArray(c.powers) ? c.powers : []),
      ...(Array.isArray(c.generators) ? c.generators : []),
      ...(Array.isArray(c.passives) ? c.passives : []),
    ]
    const act: string[] = []
    const gen: string[] = []
    const pas: string[] = []
    for (const pid of equipped) {
      if (!pid || !c.unlockedPowers.includes(pid)) continue
      const pw = getPower(pid)
      if (!pw) continue
      if (pw.kind === 'passive') { if (pas.length < 3 && !pas.includes(pid)) pas.push(pid) }
      else if (isGenerator(pw)) { if (gen.length < GENERATOR_SLOTS && !gen.includes(pid)) gen.push(pid) }
      else if (act.length < 5 && !act.includes(pid)) act.push(pid)
    }
    c.powers = [0, 1, 2, 3, 4].map((i) => act[i] ?? null)
    c.generators = [0, 1, 2].map((i) => gen[i] ?? null)
    c.passives = [0, 1, 2].map((i) => pas[i] ?? null)
    // Mode auto/manuel par emplacement ACTIF (défaut AUTO).
    c.powerAuto = [0, 1, 2, 3, 4].map((i) => (Array.isArray(c.powerAuto) ? c.powerAuto[i] !== false : true))
    // Présets de build : structure validée (3 emplacements max, entrées bien formées).
    if (Array.isArray(c.buildPresets)) {
      c.buildPresets = c.buildPresets.slice(0, 3).map((p) =>
        p && typeof p === 'object' && p.talents && Array.isArray(p.powers)
          ? { name: String(p.name ?? 'Build').slice(0, 14), talents: p.talents, powers: p.powers.slice(0, 5), passives: Array.isArray(p.passives) ? p.passives.slice(0, 3) : undefined, generators: Array.isArray(p.generators) ? p.generators.slice(0, 3) : undefined, primaryBias: p.primaryBias ?? 'force' }
          : null,
      )
    } else {
      c.buildPresets = undefined
    }
    const mh = charMaxHp(c)
    c.hp = c.hp > 0 ? Math.min(c.hp, mh) : mh
    // Statuts de combat transitoires : ne pas les conserver entre deux sessions.
    c.rez = undefined
    c.stun = 0
    c.dots = undefined
    c.weaken = undefined
    c.heat = undefined
    c.overload = undefined
  }

  // Grimoire : amorce les découvertes depuis l'inventaire + l'équipement de l'équipe.
  let codex = Array.isArray(save.codex) ? save.codex : []
  codex = discoverFromItems(codex, save.inventory)
  for (const c of save.characters) codex = discoverFromItems(codex, Object.values(c.equipment))
  save.codex = codex

  return save
}

/** Construit l'équipe à partir d'une ancienne sauvegarde mono-personnage. */
function migrateOldSave(p: any): SaveData {
  const hero: Character = {
    id: 'char-hero',
    name: 'Héros',
    level: p.level ?? 1,
    xp: p.xp ?? 0,
    base: p.base ?? { force: 5, agilite: 5, intelligence: 5, endurance: 10 },
    equipment: p.equipment ?? {},
    powers: [null, null, null, null, null],
    passives: [null, null, null],
    generators: [null, null, null],
    unlockedPowers: [],
    talentPoints: talentPointsForLevel(p.level ?? 1),
    talents: {},
    primaryBias: p.primaryBias ?? 'force',
    hp: p.hp ?? 0,
  }
  // (talents/capacités réinitialisés par sanitize)

  const fresh = freshSave()
  return sanitize({
    ...fresh,
    onboarded: true, // save migrée = joueur existant : pas d'écran d'accueil.
    characters: [hero],
    stage: p.stage ?? 1,
    bestStage: p.bestStage ?? 1,
    gold: p.gold ?? 0,
    essence: p.essence ?? 0,
    noyau: p.noyau ?? 0,
    essences: p.essences ?? {},
    sceaux: p.sceaux ?? 0,
    dungeonProgress: p.dungeonProgress ?? 0,
    dungeon: p.dungeon ?? null,
    pendingChest: p.pendingChest ?? null,
    inventory: p.inventory ?? [],
  })
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      // Save existante : si le flag d'accueil n'y figure pas (versions < accueil), on considère le
      // joueur déjà onboardé — on ne lui réimpose pas l'écran de choix de spé.
      if (Array.isArray(p.characters)) return sanitize({ ...freshSave(), ...p, onboarded: p.onboarded ?? true })
      return migrateOldSave(p)
    }
  } catch {
    /* ignore */
  }
  return freshSave()
}

function persist(s: GameState) {
  const data: SaveData = {
    characters: s.characters,
    activeChar: s.activeChar,
    stage: s.stage,
    bestStage: s.bestStage,
    activeBiome: s.activeBiome,
    nextRotateAt: s.nextRotateAt,
    biomeLockUntil: s.biomeLockUntil,
    // Le biome actif reflète `stage` → on le synchronise à la sauvegarde.
    biomeStages: { ...s.biomeStages, [s.activeBiome]: s.stage },
    biomeBest: s.biomeBest,
    farmLock: s.farmLock,
    gold: s.gold,
    essence: s.essence,
    noyau: s.noyau,
    poussiere: s.poussiere,
    quint: s.quint,
    gems: s.gems,
    gemDust: s.gemDust,
    gemsSeen: s.gemsSeen,
    lastStoneTrade: s.lastStoneTrade,
    lingots: s.lingots,
    trempe: s.trempe,
    forgeContracts: s.forgeContracts,
    lastMasterwork: s.lastMasterwork,
    runeFragments: s.runeFragments,
    runeCrafted: s.runeCrafted,
    reagents: s.reagents,
    brews: s.brews,
    alchemyRecipes: s.alchemyRecipes,
    cuvesEnCours: s.cuvesEnCours,
    elixirActive: s.elixirActive,
    oilActive: s.oilActive,
    antidoteActive: s.antidoteActive,
    mutagenActive: s.mutagenActive,
    armedRaidShield: s.armedRaidShield,
    armedChestBonus: s.armedChestBonus,
    armedXpBonus: s.armedXpBonus,
    lastTransmute: s.lastTransmute,
    philosophale: s.philosophale,
    metiersV: s.metiersV ?? 7,
    essences: s.essences,
    sceaux: s.sceaux,
    dungeonProgress: s.dungeonProgress,
    dungeon: s.dungeon,
    pendingChest: s.pendingChest,
    pendingChoice: s.pendingChoice,
    lastFreeBox: s.lastFreeBox,
    boxPity: s.boxPity,
    orbes: s.orbes,
    fragments: s.fragments,
    cosmic: s.cosmic,
    echos: s.echos,
    prestigeRank: s.prestigeRank,
    constellation: s.constellation,
    relic: s.relic,
    raidProgress: s.raidProgress,
    raidTrophies: s.raidTrophies,
    raidTierUnlocked: s.raidTierUnlocked,
    raid: s.raid,
    runesOwned: s.runesOwned,
    codex: s.codex,
    upgrades: s.upgrades,
    conseil: s.conseil,
    maitrisePoints: s.maitrisePoints,
    maitrise: s.maitrise,
    achievements: s.achievements,
    cosmetics: s.cosmetics,
    metiers: s.metiers,
    automates: s.automates,
    shopStock: s.shopStock,
    inventory: s.inventory,
    recycleThreshold: s.recycleThreshold,
    tut: s.tut,
    inbox: s.inbox,
    daily: s.daily,
    totalKills: s.totalKills,
    totalDungeons: s.totalDungeons,
    event: s.event,
    eventCosmetics: s.eventCosmetics,
    autoRecycle: s.autoRecycle,
    killsSinceEpic: s.killsSinceEpic,
    lastSeen: Date.now(),
    lastShopRefresh: s.lastShopRefresh,
    onboarded: s.onboarded,
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

// ---- Logique de personnage / objets ----

function findItemById(s: GameState, id: string): Item | undefined {
  const inv = s.inventory.find((i) => i.id === id)
  if (inv) return inv
  for (const c of s.characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as EquipSlotId]
      if (it && it.id === id) return it
    }
  }
  return undefined
}

/** Applique un patch à un objet (inventaire ou équipement d'un perso) et reclampe les PV. */
function applyItemPatch(s: GameState, id: string, patch: Partial<Item>): Partial<GameState> | null {
  const invIdx = s.inventory.findIndex((i) => i.id === id)
  if (invIdx >= 0) {
    const inventory = [...s.inventory]
    inventory[invIdx] = { ...inventory[invIdx], ...patch }
    return { inventory }
  }
  let touched = false
  const characters = s.characters.map((c) => {
    let changed = false
    const equipment: Equipment = { ...c.equipment }
    for (const slot in equipment) {
      const it = equipment[slot as EquipSlotId]
      if (it && it.id === id) {
        equipment[slot as EquipSlotId] = { ...it, ...patch }
        changed = true
      }
    }
    if (!changed) return c
    touched = true
    const nc = { ...c, equipment }
    nc.hp = Math.min(nc.hp, charMaxHp(nc))
    return nc
  })
  return touched ? { characters } : null
}

function highestLevel(chars: Character[]): number {
  return chars.reduce((m, c) => Math.max(m, c.level), 1)
}

/** Soin complet + purge des statuts de combat transitoires (mort, repli, fin de donjon/raid). */
function fullHeal(c: Character): Character {
  return { ...c, hp: charMaxHp(c), rez: undefined, stun: 0, dots: undefined, weaken: undefined }
}

/** Met à jour les multiplicateurs globaux (combat, régén) — améliorations + 🏛️ Maîtrise (v0.25). */
function refreshGlobals(upgrades: Record<string, number>, maitrise: Record<string, number> = {}, constellation: Record<string, number> = {}, achievements: Record<string, true> = {}) {
  const m = computeGlobalMods(upgrades, maitrise, achievementBonuses(achievements))
  // ✨ Constellation de prestige (v0.27, Lot 5) : multiplie les globaux de combat + résist plate.
  const pm = constellationMods(constellation)
  setGlobalCombatMods({ power: m.power * pm.damageMult, attackSpeed: m.attackSpeed * pm.speedMult, vitality: m.vitality * pm.vitalityMult })
  setGlobalPrestigeResist(pm.resistFlat)
  regenMult = m.regen
}

// ---- Marchand ----
const SHOP_SIZE = 6
/** Intervalle de rotation de l'échoppe : 1 h réelle (indépendant du combat). */
export const SHOP_INTERVAL_MS = 60 * 60 * 1000
export interface MysteryBox {
  id: number
  name: string
  icon: string
  gold: number
  count: number
  /** Fourchette de rareté des objets (distribution pondérée + jackpot). */
  minTier: number
  maxTier: number
  jackpot: number
  /** Cible un type d'objet précis. */
  type?: ItemType
  /** Cible une CATÉGORIE d'objets (tire un type au hasard dedans : armes / armures / bijoux). */
  types?: ItemType[]
  /** GARANTIT la stat primaire des objets (coffre de build : Guerrier/Rôdeur/Mage). */
  primary?: OffensiveStat
  /** GARANTIT une ligne de stat secondaire sur chaque objet (coffre à affixe : Critique…). */
  guaranteeAffix?: SecondaryStat
  /** Biaise vers des résistances (stuff défensif). */
  biasResist?: boolean
  /** Garantit au moins un effet unique. */
  guaranteeUnique?: boolean
  eclats?: number
  noyau?: number
  poussiere?: number
  fragments?: number
  /** Récompenses en CLÉS (Trousseau du Pilleur). */
  sceaux?: number
  orbes?: number
  /** 🔹 Poussière de gemme (base — scalée sur le bestStage à l'achat). */
  gemDust?: number
  /** Chance qu'une gemme de CONDITION (rang 1) accompagne le coffre. */
  gemChance?: number
  /** Coffre du Jour 🗓️ : gratuit, un par FREE_BOX_COOLDOWN_MS. */
  free?: boolean
  /** Coffre du Destin 🎭 : révèle `count` objets, le joueur n'en GARDE qu'un (les autres recyclés). */
  choice?: boolean
  /** Coffre élémentaire 🔥 : l'élément est choisi à l'achat → ligne « +% dégâts du type » garantie. */
  elementPick?: boolean
  /** Coffre du Collectionneur 📖 : effet unique JAMAIS DÉCOUVERT garanti (complète le Grimoire). */
  collector?: boolean
  /** Coffre du Maillon Faible 🧩 : cible l'emplacement équipé le plus faible du perso actif. */
  weakest?: boolean
  /** Coffre Maudit 🎲 : 75% contenu DOUBLÉ, 25% un seul objet Commun. */
  cursed?: boolean
  /** Coût SUPPLÉMENTAIRE en ressources de raid (les coffres d'élite ne s'achètent pas qu'avec de l'or). */
  costFragments?: number
  costCosmic?: number
  desc: string
}

/** Coffre du Jour 🗓️ : un gratuit toutes les 22 h (réelles). */
export const FREE_BOX_COOLDOWN_MS = 22 * 3600 * 1000
/** Achat en gros 📦 : ×5 d'un coup → -10% sur l'or (pas sur les ressources de raid). */
export const BOX_BULK_QTY = 5
export const BOX_BULK_DISCOUNT = 0.9
/** Karma du marchand 🍀 : +1% de jackpot par coffre sans jackpot, plafonné à +25% ; reset au proc. */
export const BOX_PITY_STEP = 0.01
export const BOX_PITY_CAP = 0.25
/** Coffre Maudit 🎲 : chance que la malédiction soit déjouée (contenu doublé). */
export const CURSED_WIN_CHANCE = 0.75

// Catégories d'objets pour les coffres ciblés par slot.
const BOX_WEAPONS: ItemType[] = ['armePrincipale', 'armeSecondaire']
const BOX_ARMOR: ItemType[] = ['tete', 'epaules', 'cape', 'torse', 'poignets', 'mains', 'taille', 'jambes', 'pieds']
const BOX_ACCESSORIES: ItemType[] = ['anneau', 'bijou', 'cou']

/**
 * Coffres CIBLÉS et ATTRACTIFS (refonte v0.19). Au lieu de coffres « génériques » sans intérêt,
 * chaque coffre a une PROMESSE claire : un build (Guerrier/Rôdeur/Mage), un slot (armes/armures/
 * bijoux), un affixe fort (Critique), de la défense, ou des matériaux. Les petits coffres GARANTISSENT
 * un objet utile (ta stat) + des éclats → ils ne sont plus jamais « gâchés ».
 * id = index dans le tableau (utilisé par l'action mysteryBox).
 */
export const MYSTERY_BOXES: MysteryBox[] = [
  // --- Coffres de BUILD : bon marché, stat primaire GARANTIE + éclats → toujours utiles ---
  { id: 0, name: 'Coffre du Guerrier', icon: '🗡️', gold: 400, count: 2, minTier: 3, maxTier: 6, jackpot: 0.03, primary: 'force', eclats: 80, desc: 'FORCE garantie sur chaque objet (+ éclats). Rare → Légendaire.' },
  { id: 1, name: 'Coffre du Rôdeur', icon: '🏹', gold: 400, count: 2, minTier: 3, maxTier: 6, jackpot: 0.03, primary: 'agilite', eclats: 80, desc: 'AGILITÉ garantie sur chaque objet (+ éclats). Rare → Légendaire.' },
  { id: 2, name: 'Coffre du Mage', icon: '🔮', gold: 400, count: 2, minTier: 3, maxTier: 6, jackpot: 0.03, primary: 'intelligence', eclats: 80, desc: 'INTELLIGENCE garantie sur chaque objet (+ éclats). Rare → Légendaire.' },
  // --- Coffres de SLOT : combler un emplacement précis ---
  { id: 3, name: 'Arsenal', icon: '⚔️', gold: 45000, count: 2, minTier: 5, maxTier: 9, jackpot: 0.05, types: BOX_WEAPONS, desc: 'ARMES & boucliers uniquement. Épique → Mythique.' },
  { id: 4, name: 'Armurerie', icon: '🥋', gold: 45000, count: 3, minTier: 5, maxTier: 9, jackpot: 0.05, types: BOX_ARMOR, desc: 'PIÈCES D\'ARMURE uniquement. Épique → Mythique.' },
  { id: 5, name: 'Joaillier', icon: '💍', gold: 45000, count: 3, minTier: 5, maxTier: 9, jackpot: 0.05, types: BOX_ACCESSORIES, desc: 'BIJOUX (anneaux, talismans, colliers). Épique → Mythique.' },
  // --- Coffres à AFFIXE / DÉFENSE : stats garanties ---
  { id: 6, name: 'Coffre du Critique', icon: '🎯', gold: 120000, count: 3, minTier: 6, maxTier: 10, jackpot: 0.06, guaranteeAffix: 'degatsCrit', eclats: 500, desc: 'Ligne de Dégâts critiques GARANTIE sur chaque objet. Légendaire → Ascendant.' },
  { id: 7, name: 'Coffre du Gardien', icon: '🛡️', gold: 120000, count: 3, minTier: 6, maxTier: 10, jackpot: 0.06, biasResist: true, desc: 'Stuff défensif : résistances garanties. Légendaire → Ascendant.' },
  // --- Matériaux & haut de gamme ---
  { id: 8, name: 'Coffre du forgeron', icon: '🔨', gold: 400000, count: 1, minTier: 7, maxTier: 11, jackpot: 0.05, eclats: 3000, noyau: 12, poussiere: 8, desc: 'Matériaux de craft en MASSE (atelier/forge) + 1 objet.' },
  { id: 9, name: 'Coffre légendaire', icon: '🟠', gold: 800000, count: 4, minTier: 8, maxTier: 12, jackpot: 0.07, eclats: 1500, noyau: 5, poussiere: 3, costFragments: 2, desc: 'Mythique → Éternel. Exige des Fragments de raid.' },
  { id: 10, name: 'Coffre cosmique', icon: '🌟', gold: 2500000, count: 5, minTier: 10, maxTier: 14, jackpot: 0.09, guaranteeUnique: true, eclats: 4000, noyau: 10, poussiere: 12, fragments: 2, costFragments: 6, desc: 'Ascendant → Abyssal, 1 unique garanti. Exige des Fragments.' },
  { id: 11, name: 'Coffre du Néant', icon: '🕳️', gold: 10000000, count: 6, minTier: 12, maxTier: 16, jackpot: 0.13, guaranteeUnique: true, eclats: 10000, noyau: 25, poussiere: 35, fragments: 8, costFragments: 18, costCosmic: 3, desc: 'Le pari ultime : exige Fragments ✨ ET Éclats cosmiques 💫 (donc des raids).' },
  // --- Nouveautés v0.23 (les ids sont des INDEX : on n'insère jamais, on AJOUTE) ---
  { id: 12, name: 'Coffre du Jour', icon: '🗓️', gold: 0, free: true, count: 1, minTier: 4, maxTier: 8, jackpot: 0.06, eclats: 150, desc: 'GRATUIT toutes les 22 h. Un objet (Rare → Patrimoine) + des éclats. Reviens demain !' },
  { id: 13, name: 'Coffre Maudit', icon: '🎲', gold: 60000, count: 2, minTier: 6, maxTier: 10, jackpot: 0.08, cursed: true, desc: '75% : contenu DOUBLÉ (4 objets). 25% : la malédiction ne laisse qu\'un objet Commun.' },
  { id: 14, name: 'Coffre élémentaire', icon: '🔥', gold: 35000, count: 2, minTier: 5, maxTier: 9, jackpot: 0.05, elementPick: true, desc: 'Choisis un ÉLÉMENT : ligne « +% dégâts du type » garantie sur chaque objet (armes typées).' },
  { id: 15, name: 'Trousseau du Pilleur', icon: '🗝️', gold: 70000, count: 0, minTier: 1, maxTier: 1, jackpot: 0, sceaux: 5, orbes: 2, desc: '5 Sceaux 🔑 + 2 Orbes 🔮 d\'un coup — moins cher qu\'à l\'unité.' },
  { id: 16, name: 'Coffre du Lapidaire', icon: '💎', gold: 90000, count: 0, minTier: 1, maxTier: 1, jackpot: 0, gemDust: 220, gemChance: 0.45, desc: 'Poussière de gemme 🔹 (scalée sur ton record) + 45% de gemme de condition.' },
  { id: 17, name: 'Coffre du Destin', icon: '🎭', gold: 120000, count: 3, minTier: 6, maxTier: 11, jackpot: 0.07, choice: true, desc: 'Révèle 3 objets : tu n\'en GARDES qu\'UN, les deux autres sont recyclés en éclats.' },
  { id: 18, name: 'Coffre du Maillon Faible', icon: '🧩', gold: 150000, count: 2, minTier: 7, maxTier: 11, jackpot: 0.06, weakest: true, desc: 'Analyse ton équipement et cible ton EMPLACEMENT le plus faible (vide ou en retard).' },
  { id: 19, name: 'Coffre du Collectionneur', icon: '📖', gold: 300000, count: 1, minTier: 8, maxTier: 12, jackpot: 0.06, collector: true, costFragments: 3, desc: 'Un objet portant un effet unique JAMAIS DÉCOUVERT — complète le Grimoire.' },
]

/**
 * v0.25 — PRIX EN OR d'un coffre de stuff. Suit (a) la rareté ET (b) ton revenu d'or (record) :
 * un prix FIXE devenait vite trivial face au revenu exponentiel (« on a tout ce qu'on veut »).
 * Calé SOUS la croissance du Donjon d'Or (≈1,069^palier) → acheter coûte ~un nombre constant de
 * runs, qui décroît LENTEMENT (rentable sur le temps, jamais instantané). Lots de ressources
 * (count 0) & coffres gratuits : prix fixe (l'équation, indexée rareté, ne les concerne pas).
 */
const BOX_PRICE_K = 400       // base (~4 runs du Donjon d'Or au niveau courant)
const BOX_PRICE_RARITY = 2.5  // ×prix par cran de rareté moyenne (raide : « gonfle énormément » en haut)
const BOX_PRICE_STAGE = 1.06  // ×prix par palier de record (< revenu d'or → rentable sur le temps)
export function boxGoldPrice(box: MysteryBox, bestStage: number): number {
  if (box.free || box.count <= 0) return box.gold
  const tMoy = box.minTier + 1.5
  return Math.round(BOX_PRICE_K * box.count * Math.pow(BOX_PRICE_RARITY, tMoy - 3) * Math.pow(BOX_PRICE_STAGE, Math.max(1, bestStage)))
}

/** v0.25 — VERROU rareté×raids : meilleur tier de raid requis pour acheter (Céleste+ = raid only). */
export function boxRaidGate(box: MysteryBox): number {
  return Math.max(0, box.maxTier - 10) // maxTier 11→1 · 12→2 · 14→4 · 16→6
}
/** Meilleur tier de raid atteint, tous raids confondus. */
export function bestRaidTier(raidProgress: Record<string, number>): number {
  let best = 0
  for (const k in raidProgress) best = Math.max(best, raidProgress[k] ?? 0)
  return best
}

/**
 * iLvl MAX « de contenu » : le meilleur iLvl lootable dans les contenus DÉBLOQUÉS —
 * donjons (plafonnés à 125% du record de palier, voir dungeonIlvl) et raids VAINCUS
 * (iLvl du meilleur tier clear, par raid). Sert de plafond RELATIF au surillvl (v0.25.x) :
 * l'atelier suit la progression du joueur, il ne la double pas.
 */
/** v0.31 — contexte de complétion des quêtes du tutoriel, dérivé de l'état (pas de tracking lourd). */
export function tutContext(s: {
  characters: Character[]; activeChar: number; bestStage: number
  inventory: Item[]; dungeonProgress: Record<string, number>; tut: { bought: boolean }
}): TutCtx {
  const ac = s.characters[s.activeChar] ?? s.characters[0]
  const equippedCount = ac ? Object.values(ac.equipment).filter(Boolean).length : 0
  const maxLevel = s.characters.reduce((m, c) => Math.max(m, c.level), 1)
  const allItems: Item[] = [
    ...s.inventory,
    ...s.characters.flatMap((c) => Object.values(c.equipment).filter((i): i is Item => !!i)),
  ]
  const crafted = allItems.some((it) => (it.surCount ?? 0) > 0 || (it.reforgeCount ?? 0) > 0 || (it.trempeCount ?? 0) > 0)
  const talentAllocated = s.characters.some((c) => Object.entries(c.talents ?? {}).some(([k, v]) => k !== 'co_start' && (v ?? 0) > 0))
  const anyDungeon = Object.values(s.dungeonProgress ?? {}).some((v) => (v ?? 0) >= 1)
  return { bestStage: s.bestStage, maxLevel, equippedCount, bought: s.tut?.bought ?? false, crafted, talentAllocated, anyDungeon }
}

export function maxContentIlvl(bestStage: number, raidProgress: Record<string, number>): number {
  let best = Math.round(stageIlvl(Math.max(1, bestStage)) * 1.25)
  for (const def of RAID_LIST) {
    const t = raidProgress[def.id] ?? 0
    if (t >= 1) best = Math.max(best, raidIlvl(def, t, bestStage))
  }
  return best
}

/**
 * RÉFÉRENCE D'ILVL DU COMPTE (v0.28, B1) — le plus haut iLvl RÉELLEMENT obtenable selon le contenu
 * débloqué : farm (palier), DONJONS et RAIDS. C'est l'échelle UNIFIÉE : la forge, le marché et les
 * coffres produisent à ce niveau (ils suivent tes meilleurs drops au lieu de stagner au farm), et
 * l'inventaire colore le « retard » par rapport à elle. ≠ `maxContentIlvl` (qui garde le ×1.25 +
 * marge UNIQUEMENT comme plafond de surillvl, pour qu'on puisse pousser un poil au-dessus en craft).
 */
export function referenceIlvl(
  bestStage: number,
  raidProgress: Record<string, number>,
  dungeonProgress: Record<string, number>,
): number {
  let best = stageIlvl(Math.max(1, bestStage))
  for (const id in dungeonProgress) {
    const lvl = dungeonProgress[id] ?? 0
    if (lvl > 0) best = Math.max(best, dungeonIlvl(lvl, bestStage))
  }
  for (const def of RAID_LIST) {
    const t = raidProgress[def.id] ?? 0
    if (t >= 1) best = Math.max(best, raidIlvl(def, t, bestStage))
  }
  return best
}

/** Prix d'achat d'un objet en échoppe (croît FORTEMENT avec la rareté → vrai puits d'or). */
export function shopBuyPrice(item: Item): number {
  const tier = RARITIES[item.rarity].tier
  return Math.round(item.ilvl * Math.pow(tier, 2.6) * 1.5)
}

export function shopRefreshCost(bestStage: number): number {
  return Math.round(500 + bestStage * 60)
}

function generateShop(bestStage: number, raidProgress: Record<string, number>, dungeonProgress: Record<string, number>, luckBonus: number): Item[] {
  // B1 — le marché suit la référence du compte (raids/donjons compris), plus seulement le farm.
  const ilvl = Math.max(1, referenceIlvl(bestStage, raidProgress, dungeonProgress))
  // v0.35 — le marché est un DUMP D'OR à BASSE rareté : objets à TON ilvl (slot-filling) mais rareté
  // FAIBLE (plus de montée auto par stageLuckTier) → jamais la source principale de stuff. La rareté
  // se chasse au drop / donjon poussé / raid. Seul l'investissement marchand (luckBonus) nudge un peu.
  const luck = Math.min(2, luckBonus)
  const out: Item[] = []
  for (let i = 0; i < SHOP_SIZE; i++) out.push(generateItem({ ilvl, luckTier: luck }))
  return out
}

/** Type d'objet de l'emplacement le plus FAIBLE d'un perso (vide en priorité, sinon score minimal). */
function weakestSlotType(c: Character): ItemType {
  let worst: { score: number; type: ItemType } | null = null
  for (const slot of EQUIP_SLOTS) {
    const it = c.equipment[slot.id]
    const score = it ? itemScore(it) : -1 // un emplacement vide est toujours le plus faible
    if (!worst || score < worst.score) worst = { score, type: slot.accepts }
  }
  return worst!.type
}

/** Affinité de drop : celle d'un membre d'équipe au hasard (nourrit tous les builds). */
function pickBias(chars: Character[]): OffensiveStat {
  const living = chars.filter((c) => c.hp > 0)
  const pool = living.length ? living : chars
  const b = pool[Math.floor(Math.random() * pool.length)]?.primaryBias
  return b === 'agilite' || b === 'intelligence' ? b : 'force'
}

/** Donne de l'XP à un perso, gère les montées de niveau (gains de base + points de talent). */
function grantXp(char: Character, xp: number): Character {
  let level = char.level
  let curXp = char.xp + xp
  const base = { ...char.base }
  while (curXp >= xpForLevel(level)) {
    curXp -= xpForLevel(level)
    level++
    base[char.primaryBias] = (base[char.primaryBias] ?? 0) + 1
    base.endurance = (base.endurance ?? 0) + 1
  }
  // Points de talent : seulement au-delà de TALENT_START_LEVEL (l'arbre se débloque plus tard).
  const gainedPoints = talentPointsForLevel(level) - talentPointsForLevel(char.level)
  return { ...char, level, xp: curXp, base, talentPoints: char.talentPoints + gainedPoints }
}

// ---- Combat d'équipe ----

interface CombatMods {
  enrage?: number
  reflect?: number
  regen?: number
  fightTime?: number
  /** Multiplicateur plat des dégâts ennemis (enrage dur / acharnement de raid). */
  dmgMult?: number
  /** Multiplicateur plat des dégâts du HÉROS (Maîtrise des Zones, crescendo, environnement). */
  heroMult?: number
  /** Gemmes de condition actives sur l'équipe (triggers de combat — voir condGems.ts). */
  cond?: CondMods
  /** Runes de TEMPS actives (manipulation des horloges — voir enchants.ts). */
  runes?: TimeRuneMods
  /** 🩸 Pacte(s) actif(s) (v0.26) — bonus/malus permanents d'équipe (voir enchants.ts). */
  pact?: PactMods
  /** v0.26 : CONTEXTE de contenu pour les gemmes d'Environnement (où se passe le combat). */
  content?: {
    /** Biome actif (farm) — Prisme d'accord. */
    biomeType?: DamageType
    /** Biome en ⚡ Surcharge (farm) — Paratonnerre. */
    surge?: boolean
    /** Donjon : nombre de modificateurs actifs — Pierre de sceau. */
    affixCount?: number
    /** Raid : points de résistance offerts à l'équipe — Trophée de guerre. */
    resistBonus?: number
    /** v0.27 (Lot 3) — « Mal de l'abîme » : multiplicateur de régén des héros en RAID (< 1 = bridée). */
    regenMult?: number
    /** Farm : à ≤ 2 paliers du record — Pied du mur (appliqué via heroMult au tick). */
    nearRecord?: boolean
    /** 🧴 Antidote ciblé (Officine) : −pct des dégâts SUBIS de ce type. */
    antidote?: { type: DamageType; pct: number }
  }
}

/** Multiplicateur de dégâts SUBIS par un ennemi (vulnérabilité « Sceau de faiblesse »). */
function enemyVuln(enemy: Enemy): number {
  return enemy.vuln && enemy.vuln.remaining > 0 ? enemy.vuln.mult : 1
}

/**
 * AUTO « intelligent » (v0.29.4) : un SPENDER (finisseur / détonation) ne s'auto-lance qu'au-dessus
 * d'un seuil de ressource → l'idle reste correct. En MANUEL, le joueur décide (try-hard : timer le pic
 * à ressource pleine, dans une fenêtre de burst). C'est ça l'écart de skill idle ↔ try-hard.
 */
function autoSpenderReady(p: PowerDef, c: Character, enemy: Enemy | undefined, isManual: boolean): boolean {
  if (isManual) return true
  if (p.effect === 'finisher') return (c.combo ?? 0) >= 3
  if (p.effect === 'detonate') return (enemy?.venomStacks ?? 0) >= 4
  return true
}

/**
 * Lance une capacité active. Renvoie les DÉGÂTS infligés à l'ennemi (pour la « Vengeance différée »).
 * Les dégâts des sorts scalent sur le PROFIL DE DÉGÂTS de l'arme/du stuff (profileDamageMult) — comme
 * les auto-attaques — pour qu'un build qui empile un type booste aussi ses sorts.
 */
function fireActive(p: PowerDef, caster: Character, derived: DerivedStats, profile: DamageProfile, chars: Character[], enemy: Enemy, hotBonus: number, dmgMult = 1, healToDamage = 0, cond?: CondMods, pact?: PactMods): number {
  const base = (p.magnitude ?? 1) * abilityPower(derived, powerScale(p)) // soins (sans profil ni keystones)
  // v0.29.4 : bonus par TAG (cross-classe) — un nœud « tes [dot] +12% » booste TOUT sort taggé dot.
  const cm = charCombatMods(caster)
  let tagMult = 1
  if (p.tags) for (const t of p.tags) tagMult *= (cm.tagBonus[t] ?? 1)
  // CONTRÔLE (v0.29.6) : un sort [controle] gèle/ralentit ; SHATTER : +dégâts aux ennemis contrôlés.
  if (p.tags?.includes('controle')) enemy.controlled = Math.max(enemy.controlled ?? 0, p.duration ?? 4)
  // SHATTER : +dégâts vs gelé/contrôlé. v0.34 « Équilibre des sphères » : shatter +frac×(altMult−1), BORNÉ.
  const shatterTot = cm.shatter + cm.shatterFromAlteration * (derived.alterationMult - 1)
  const shatterMult = (enemy.controlled ?? 0) > 0 ? 1 + shatterTot : 1
  // PYROMANCIEN « Hot Streak » (v0.31) : tes sorts [feu] chargent la Chaleur (montée pondérée par le Critique).
  // Un sort [feu][direct] lancé à PLEINE Chaleur est SURPUISSANT (×mult) puis remet la Chaleur à 0.
  let hotMult = 1
  if (cm.hotStreak && p.tags?.includes('feu')) {
    const isNuke = p.effect === 'nuke' || p.effect === 'cleave' || p.effect === 'megaCleave'
    if (isNuke && p.tags.includes('direct') && (caster.heat ?? 0) >= cm.hotStreak.cap) {
      hotMult = cm.hotStreak.mult
      caster.heat = 0
      // v0.34 « Combustion runique » : un déclenchement de Hot Streak octroie des Charges des arcanes (Feu→Arcane).
      if (cm.hotStreakCharges > 0) caster.combo = Math.min(5 + cm.comboCap, (caster.combo ?? 0) + cm.hotStreakCharges)
    } else {
      caster.heat = Math.min(cm.hotStreak.cap, (caster.heat ?? 0) + 1 + 2 * derived.critChance)
    }
  }
  // v0.34 « TRINITÉ » (Convergence) : +frac de TOUS tes dégâts par état élémentaire ACTIF (embrasement /
  // gel / surcharge), borné à 3 états (indépendant de l'ilvl → pas de snowball).
  const elemStates = cm.elementalStates > 0
    ? (enemy.dot ? 1 : 0) + ((enemy.controlled ?? 0) > 0 ? 1 : 0) + ((caster.overload ?? 0) > 0 ? 1 : 0)
    : 0
  const trinityMult = 1 + cm.elementalStates * elemStates
  const magDmg = base * profileDamageMult(profile) * dmgMult * tagMult * shatterMult * hotMult * trinityMult * formDamageMult(caster, cm) // profil + keystones + tags + shatter + Hot Streak + Trinité + Forme
  // Boucliers : scalent sur la MEILLEURE de (stat principale, Endurance) → un tank qui empile
  // l'Endurance obtient un énorme bouclier (levier de survie qui suit l'Endurance).
  const shieldBase = (p.magnitude ?? 1) * Math.max(abilityPower(derived, powerScale(p)), derived.endurancePower)
  const vm = enemyVuln(enemy)
  // v0.34 « Lame Vénéneuse » : facteur crit du venin (gaté au seuil de Critique, BORNÉ) + application
  // de venin par un finisseur/générateur (référence = coup NORMAL non amplifié).
  const venCrit = cm.poisonCanCrit > 0 && derived.critChance >= cm.poisonCanCrit
    ? 1 + derived.critChance * (derived.critMult - 1) : 1
  const venomRef = base * profileDamageMult(profile) * dmgMult
  const applyVenom = (n: number) => {
    if (n <= 0) return
    const stacks = Math.min(cm.poison.maxStacks, (enemy.venomStacks ?? 0) + n)
    enemy.venomStacks = stacks
    const dps = stacks * cm.poison.perStack * venomRef * derived.alterationMult * venCrit
    enemy.dot = { dps: Math.max(dps, enemy.dot?.dps ?? 0), remaining: 8 }
  }
  const hit = (dmg: number): number => {
    const before = enemy.hp; enemy.hp = Math.max(0, enemy.hp - dmg); const done = before - enemy.hp
    // PALADIN AUBE : une fraction de TES DÉGÂTS soigne l'allié le plus blessé (« soigne en frappant »).
    if (cm.damageToHeal > 0 && done > 0 && !pact?.noHeal) {
      const allies = chars.filter((c) => c.hp > 0)
      if (allies.length) {
        let low = allies[0]
        for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
        gemAbilityHeal(low, done * cm.damageToHeal, cond, chars)
      }
    }
    return done
  }
  // v0.34 « Crépuscule » : amplis du CHÂTIMENT (atonement) — tous BORNÉS ou conditionnels.
  const folieActive = (caster.frenzy?.remaining ?? 0) > 0
  const folieDotMult = folieActive && cm.folieDot > 0 ? 1 + cm.folieDot : 1
  const atoneAmp = (cm.atonementIsShadow ? (cm.tagBonus['ombre'] ?? 1) : 1)
    * (1 + (cm.atonementVsDot > 0 && enemy.dot ? cm.atonementVsDot : 0))
    * (1 + cm.atonementFromAlteration * (derived.alterationMult - 1))
    * cm.atonementMult
    * (folieActive ? 1 + cm.folieEmpowersAtonement : 1)
  // DISSONANCE : un soin pose aussi un DoT d'ombre sur l'ennemi (scale comme un sort d'ombre).
  const applyHealDot = (healed: number) => {
    if (cm.healAppliesDot <= 0 || enemy.hp <= 0) return
    const dps = healed * profileDamageMult(profile) * 0.4 * derived.alterationMult * (cm.tagBonus['ombre'] ?? 1) * dmgMult * cm.healAppliesDot * folieDotMult
    enemy.dot = { dps: Math.max(dps, enemy.dot?.dps ?? 0), remaining: 6 }
  }
  // ORACLE SANGLANT / CHÂTIMENT : une fraction du SOIN est aussi infligée en dégâts à l'ennemi focus.
  const bleedHeal = (healed: number): number => (healToDamage > 0 && enemy.hp > 0 ? hit(healed * healToDamage * atoneAmp * vm) : 0)
  const canHeal = !pact?.noHeal && !cm.noSelfHeal // HÉRÉSIE : plus aucun soin
  switch (p.effect) {
    case 'nuke':
    case 'cleave':
    case 'megaCleave': {
      const done = hit(magDmg * vm)
      // v0.34 « Fracas ardent » (Convergence) : un coup [feu] sur un GELÉ pose un Embrasement (Givre→Feu).
      if (cm.frozenIgnites > 0 && (enemy.controlled ?? 0) > 0 && p.tags?.includes('feu') && enemy.hp > 0) {
        enemy.dot = { dps: Math.max(magDmg * cm.frozenIgnites * derived.alterationMult, enemy.dot?.dps ?? 0), remaining: 6 }
      }
      return done
    }
    case 'executeNuke': {
      // +250% de dégâts selon les PV MANQUANTS : finisher dévastateur.
      const missing = 1 - enemy.hp / Math.max(1, enemy.maxHp)
      return hit(magDmg * (1 + missing * 2.5) * vm)
    }
    case 'lifeNuke': {
      const done = hit(magDmg * vm)
      if (!pact?.noHeal) caster.hp = Math.min(charMaxHp(caster), caster.hp + done * 0.6)
      return done
    }
    case 'dot':
      // L'Altération amplifie les dégâts sur la durée. PÉNOMBRE : la Folie (frenzy) booste tes DoT.
      enemy.dot = { dps: Math.max(magDmg * 0.4 * derived.alterationMult * folieDotMult, enemy.dot?.dps ?? 0), remaining: 5 }
      return 0
    case 'rupture':
      // Brise la régén ennemie + grosse plaie (dégât immédiat + DoT puissant).
      enemy.noRegen = Math.max(enemy.noRegen ?? 0, p.duration ?? 8)
      enemy.dot = { dps: Math.max(magDmg * 0.5 * derived.alterationMult, enemy.dot?.dps ?? 0), remaining: p.duration ?? 8 }
      return hit(magDmg * 0.5 * vm)
    case 'mark':
      enemy.vuln = { mult: p.magnitude ?? 1.4, remaining: p.duration ?? 8 } // magnitude = multiplicateur brut
      return 0
    case 'heal':
    case 'hot': {
      const healed = base * (1 + hotBonus)
      const allies = chars.filter((c) => c.hp > 0)
      if (allies.length && canHeal) {
        let low = allies[0]
        for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
        gemAbilityHeal(low, healed, cond, chars) // 🏆 Calice + ⚱️ Vases (v0.26)
      }
      applyHealDot(healed) // DISSONANCE
      return bleedHeal(healed)
    }
    case 'bigHeal':
      if (canHeal) for (const a of chars) if (a.hp > 0) gemAbilityHeal(a, base * (1 + hotBonus), cond, chars, false)
      applyHealDot(base * (1 + hotBonus))
      return bleedHeal(base * (1 + hotBonus))
    case 'buffParty':
      if (canHeal) for (const a of chars) if (a.hp > 0) gemAbilityHeal(a, base * 0.5 * (1 + hotBonus), cond, chars, false)
      applyHealDot(base * 0.5 * (1 + hotBonus))
      return bleedHeal(base * 0.5 * (1 + hotBonus))
    // v0.34 « Crépuscule » — sorts hybrides : frappe d'ombre QUI SOIGNE.
    case 'smiteHeal': {
      const done = hit(magDmg * vm)
      if (canHeal && done > 0) {
        const allies = chars.filter((c) => c.hp > 0)
        if (allies.length) {
          let low = allies[0]
          for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
          gemAbilityHeal(low, done * 0.5, cond, chars) // soigne l'allié blessé = 50% des dégâts
        }
      }
      return done
    }
    case 'eclipse': {
      // ULTIME : cataclysme d'ombre (zone) + restaure TOUT le groupe (40% des dégâts chacun).
      const done = hit(magDmg * vm)
      if (canHeal && done > 0) for (const a of chars) if (a.hp > 0) gemAbilityHeal(a, done * 0.4, cond, chars, false)
      return done
    }
    case 'shield':
      // Bouclier runique : absorption sur le porteur (scale stat principale OU Endurance).
      caster.absorb = (caster.absorb ?? 0) + shieldBase
      return 0
    case 'bigShield':
      // Énorme bouclier d'absorption (soaké avant les PV) + 40% à l'équipe.
      caster.absorb = (caster.absorb ?? 0) + shieldBase
      for (const a of chars) if (a.hp > 0 && a !== caster) a.absorb = (a.absorb ?? 0) + shieldBase * 0.4
      return 0
    case 'invuln':
      caster.invuln = Math.max(caster.invuln ?? 0, p.duration ?? 2)
      return 0
    case 'charge':
      // Démarre l'accumulation ; la frappe différée (×mult le cumul) est résolue dans le pas de combat.
      caster.charge = { dealt: 0, remaining: p.duration ?? 5, mult: p.magnitude ?? 3 }
      return 0
    case 'frenzy':
      caster.frenzy = { mult: p.magnitude ?? 2, remaining: p.duration ?? 6 }
      return 0
    // v0.34 « Avatar de guerre » (Juggernaut) : transe de dégâts (frenzy) + ÉNORME bouclier d'absorption.
    case 'avatar': {
      caster.frenzy = { mult: p.magnitude ?? 1.8, remaining: p.duration ?? 8 }
      const grant = Math.min(charMaxHp(caster), shieldBase * 2.5) // bouclier scalé sur Endurance, ≤ PV max
      caster.absorb = Math.max(caster.absorb ?? 0, grant)
      return 0
    }
    // v0.34 « Bond sauvage » (Métamorphe) : métamorphose-éclair (forme suivante + Instinct) puis frappe.
    case 'shift': {
      caster.form = ((caster.form ?? 0) + 1) % 3
      caster.formClock = Math.max(2, 5 - cm.shiftHaste)
      caster.instinct = Math.min(cm.instinctMax || 0, (caster.instinct ?? 0) + 1)
      return hit(magDmg * vm)
    }
    // v0.34 « Forme Chimère » (Métamorphe) : les 3 formes actives à la fois pendant `duration`.
    case 'chimera':
      caster.chimera = Math.max(caster.chimera ?? 0, p.duration ?? 10)
      return 0
    // --- v0.29.2 : socle VOLEUR ---
    case 'poison': {
      // ASSASSIN : empile un STACK de venin ; le DoT (enemy.dot) monte avec les stacks.
      const stacks = Math.min(cm.poison.maxStacks, (enemy.venomStacks ?? 0) + 1)
      enemy.venomStacks = stacks
      // v0.34 « Lame critique » : le venin hérite du critique (venCrit, borné, gaté au seuil).
      const dps = stacks * cm.poison.perStack * magDmg * derived.alterationMult * venCrit
      enemy.dot = { dps: Math.max(dps, enemy.dot?.dps ?? 0), remaining: 8 }
      return 0
    }
    case 'detonate': {
      // ASSASSIN : consomme tous les stacks → pic = stacks × magnitude. Catalyse double avant détonation.
      const before = enemy.venomStacks ?? 0
      const stacks = before * (cm.detonateDouble ? 2 : 1)
      if (stacks <= 0) return hit(magDmg * vm)
      const done = hit(magDmg * stacks * vm)
      // v0.34 « Apothéose du fléau » : ré-applique une fraction des stacks consommés (détonation soutenue).
      if (cm.detonateReapply > 0) {
        enemy.venomStacks = 0
        enemy.dot = undefined
        applyVenom(Math.floor(before * cm.detonateReapply))
      } else {
        enemy.venomStacks = 0
        enemy.dot = undefined
      }
      return done
    }
    case 'builder': {
      // OMBRELAME : +`gen` Point(s) de Combo (défaut 1 ; un générateur INT lent peut en donner +2) (+ petit coup).
      const cap = 5 + cm.comboCap
      caster.combo = Math.min(cap, (caster.combo ?? 0) + (p.gen ?? 1) + cm.comboGen)
      // v0.34 « Lames suintantes » : les générateurs appliquent aussi du venin (boucle venin↔combo).
      if (cm.builderPoison) applyVenom(1)
      // ARCANISTE « Surcharge instable » : au PLEIN de Charges, déclenche la fenêtre (et CONSOMME les Charges).
      if (cm.overload && (caster.overload ?? 0) <= 0 && (caster.combo ?? 0) >= cap) {
        caster.overload = cm.overload.window
        caster.combo = 0
        // v0.34 « Gel arcanique » (Convergence) : entrer en Surcharge GÈLE le pack (Arcane→Givre).
        if (cm.overloadFreezes) enemy.controlled = Math.max(enemy.controlled ?? 0, 3)
      }
      return hit(magDmg * vm)
    }
    case 'finisher': {
      // OMBRELAME : consomme les Points de Combo → dégâts × points. comboRefund en rend une partie (spam).
      const pts = Math.max(1, caster.combo ?? 0)
      const cap = 5 + cm.comboCap
      const venoms = enemy.venomStacks ?? 0
      // v0.34 « Lame Vénéneuse » : amplis de finisseur conditionnels (tous BORNÉS / gatés par une condition).
      let finMult = 1 + cm.finisherMult
      if (cm.finisherIsDot) finMult *= (cm.tagBonus['dot'] ?? 1)                 // compte comme [dot]
      if (cm.finisherVsVenom > 0 && venoms > 0) finMult *= 1 + cm.finisherVsVenom // Verdict toxique
      if (cm.finisherFromAlteration > 0) finMult *= 1 + cm.finisherFromAlteration * (derived.alterationMult - 1) // Symbiose (borné)
      if (cm.finisherVenomBonus > 0) finMult *= 1 + Math.min(0.4, cm.finisherVenomBonus * venoms) // Pacte (capé 40 %)
      // v0.34 « Bouclier offensif » (Juggernaut) : le finisseur frappe selon ton bouclier d'absorption (BORNÉ : ≤ PV).
      if (cm.shieldToFinisher > 0 && (caster.absorb ?? 0) > 0) finMult *= 1 + cm.shieldToFinisher * Math.min(1, (caster.absorb ?? 0) / Math.max(1, charMaxHp(caster)))
      const done = hit(magDmg * pts * 0.55 * finMult * vm)
      // v0.34 « Sang et acier » (Juggernaut) : un finisseur rafraîchit tes saignements (DoT physique).
      if (cm.finisherRefreshBleed && enemy.dot) enemy.dot.remaining = Math.max(enemy.dot.remaining, 5)
      // v0.34 « Bond coordonné » (Symbiose) : un finisseur fait BONDIR le familier (pic ≈ N s de son DPS).
      if (cm.petBurstOnFinisher > 0 && cm.petDps > 0) {
        const petMult = 1 + cm.petBonus + cm.petFromPrecision * derived.precision
        hit(theoreticalDps(derived, profile, cm.damageMult) * cm.petDps * petMult * cm.petBurstOnFinisher * vm)
      }
      // Lame Vénéneuse : le finisseur applique du venin (⌈PC × frac⌉). Entaille septique : rafraîchit.
      if (cm.finisherToPoison > 0) applyVenom(Math.ceil(pts * cm.finisherToPoison))
      else if (cm.finisherRefreshPoison && enemy.dot && venoms > 0) enemy.dot.remaining = 8
      // Toxine explosive : à PC plein, détone une fraction des stacks (consommés).
      if (cm.finisherDetonate > 0 && pts >= cap && venoms > 0) {
        const blown = Math.floor(venoms * cm.finisherDetonate) * (cm.detonateDouble ? 2 : 1)
        if (blown > 0) {
          hit(venomRef * blown * derived.alterationMult * venCrit * vm)
          enemy.venomStacks = Math.max(0, venoms - Math.floor(venoms * cm.finisherDetonate))
        }
      }
      // Toxine rémanente : prolonge le venin + le booste (par PC), sans le consommer.
      if (cm.finisherProlongsDot && enemy.dot) {
        enemy.dot.remaining = Math.min(15, enemy.dot.remaining + cm.finisherProlongsDot.seconds)
        enemy.dot.dps *= 1 + Math.min(0.6, cm.finisherProlongsDot.perCombo * pts)
      }
      caster.combo = cm.comboRefund
      // Danse vénéneuse : le finisseur regénère 1 PC si la cible est au venin MAX.
      if (cm.venomFinisherGen && venoms >= cm.poison.maxStacks) caster.combo = Math.min(cap, caster.combo + 1)
      // REMPART : convertit la dépense de Rage en bouclier — MAIS (1) au plus une fois / 30 s (cooldown
      // interne, sinon bouclier permanent = trop fort), (2) borné aux PV : au plus 50% des PV max par
      // déclenchement, total ≤ PV max. Le bouclier suit la SURVIE (PV), pas le dégât brut (milliards endgame).
      if (cm.finisherShield > 0 && (shieldCdMap.get(caster.id) ?? 0) <= 0) {
        const mh = charMaxHp(caster)
        const grant = Math.min(done * cm.finisherShield, mh * 0.5)
        const room = Math.max(0, mh - (caster.absorb ?? 0))
        const added = Math.min(grant, room)
        if (added > 0) { caster.absorb = (caster.absorb ?? 0) + added; shieldCdMap.set(caster.id, 30) }
      }
      return done
    }
  }
  return 0
}

/** Applique des dégâts à un héros via l'immunité puis le bouclier d'absorption. Renvoie les PV réellement perdus. */
function damageHero(c: Character, amount: number): number {
  if (amount <= 0) return 0
  if ((c.invuln ?? 0) > 0) return 0 // immunité totale (Phase éthérée)
  let amt = amount
  if ((c.absorb ?? 0) > 0) {
    const soak = Math.min(c.absorb!, amt)
    c.absorb = c.absorb! - soak
    amt -= soak
    if ((c.absorb ?? 0) <= 0) c.absorb = undefined
  }
  c.hp -= amt
  return amt
}

/** Contexte de combat d'un héros utilisé pour résoudre les techniques ennemies. */
interface AbilityCtx {
  derived: DerivedStats
  resist: Partial<Record<DamageType, number>>
  passives: { threatMult: number; damageReduction: number }
  cmods: CharCombatMods
  /** v0.26 : gemmes d'équipe + contexte (chaîne défensive sur les coups télégraphés). */
  cond?: CondMods
  surge?: boolean
  aliveEnemies?: number
  /** 🩸 Pacte(s) actif(s) — dmgIn s'applique aussi aux coups télégraphés. */
  pact?: PactMods
  /** 🧴 Antidote ciblé (Officine) — réduit les techniques de CE type. */
  antidote?: { type: DamageType; pct: number }
}

/** Applique l'effet d'une technique ennemie à un héros cible (modèle d'exigence + Purge). */
function applyEnemyAbility(ab: EnemyAbility, enemy: Enemy, t: Character, ctx: AbilityCtx) {
  const resist = ctx.resist[ab.element] ?? 0
  const purge = ctx.derived.purge
  const extra = (1 - ctx.passives.damageReduction) * (1 - ctx.cmods.flatDr)
  const req = enemyReq(enemy, ab.element)
  // ÉGIDE « Aegis adaptatif » : tout type qui te frappe te rend plus résistant à ce type.
  if (ctx.cmods.adaptiveResist && (ab.kind === 'dot' || ab.kind === 'burst' || ab.kind === 'drain')) {
    adaptiveAdd(t.id, ab.element, ctx.cmods.adaptiveResist.gain, ctx.cmods.adaptiveResist.cap)
  }
  // PURGATEUR : chaque affliction subie nourrit la Combustion purificatrice.
  if (ctx.cmods.afflictionFuel && (ab.kind === 'dot' || ab.kind === 'cc' || ab.kind === 'debuff')) fuelAdd(t.id)
  switch (ab.kind) {
    case 'dot': {
      // DoT : ignore armure/esquive. La PURGE réduit intensité + durée ET ronge l'exigence du
      // type sur les altérations (v0.24 §5.3 : Req_eff = Req − Purge×100 — la soupape anti-DoT).
      const reqDot = Math.max(0, req - purge * 100)
      const dps = Math.max(0, enemy.damage * ab.magnitude * resistMult(reqDot, resist, ctx.cmods.reqReduction) * (1 - purge))
      const remaining = (ab.duration ?? 4) * (1 - purge * 0.5)
      if (dps > 0) t.dots = [...(t.dots ?? []), { dps, type: ab.element, remaining }]
      break
    }
    case 'burst':
    case 'drain': {
      // Coup unique télégraphié : multiplicateur d'exigence + atténuation générique bornée,
      // puis la chaîne défensive v0.26 (Sixième sens, Granit, Mémoire de la pierre, Égide,
      // Carapace…) et enfin l'immunité/bouclier d'absorption du héros.
      let dmg = incomingDps(enemy.damage * ab.magnitude, ab.element, ctx.derived, ctx.resist, req, extra, ctx.cmods.reqReduction)
      dmg *= (ctx.pact?.dmgIn ?? 1)
        * (ctx.antidote && ctx.antidote.type === ab.element ? 1 - ctx.antidote.pct : 1)
        * gemDefenseMult(t, charMaxHp(t), {
        cond: ctx.cond, surge: ctx.surge, aliveEnemies: ctx.aliveEnemies,
        telegraphed: !!ab.telegraph, tenacity: ctx.derived.tenacity,
      })
      const taken = gemDamageHero(t, dmg, { cond: ctx.cond, attacker: enemy, discrete: true })
      if (ab.kind === 'drain') enemy.hp = Math.min(enemy.maxHp, enemy.hp + taken * 0.6)
      break
    }
    case 'cc': {
      // Contrôle : durée réduite par la TÉNACITÉ.
      t.stun = Math.max(t.stun ?? 0, (ab.duration ?? 1) * (1 - ctx.derived.tenacity))
      break
    }
    case 'debuff': {
      // Malédiction : −35% de dégâts du héros ; durée réduite par la PURGE.
      const dur = (ab.duration ?? 5) * (1 - purge)
      if (dur > 0.3) t.weaken = { mult: 0.65, remaining: Math.max(t.weaken?.remaining ?? 0, dur) }
      break
    }
  }
}

/** Fait progresser les techniques d'un ennemi (cooldown + télégraphe) et applique celles qui tombent.
 *  🐌 Dilatation : allonge les télégraphes · ⏳ Grain de sable : 1re incantation des non-boss coupée.
 *  v0.26 : 🗼 Tour de garde peut détourner le coup d'une cible fragile vers le plus endurant. */
function tickEnemyAbilities(enemy: Enemy, chars: Character[], info: (AbilityCtx | null)[], dt: number, runes?: TimeRuneMods) {
  if (!enemy.abilities || enemy.abilities.length === 0 || enemy.hp <= 0) return
  const alive = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
  if (!alive.length) return
  const dilatation = runes?.dilatation ?? 0
  // Cible = plus haute menace (même logique que l'auto-attaque).
  let ti = alive[0]
  let best = -1
  for (const i of alive) {
    const d = info[i]!
    const dps = d.derived.power * d.derived.attacksPerSecond
    const score = (dps + 1) * d.passives.threatMult
    if (score > best) { best = score; ti = i }
  }
  // 🗼 Tour de garde : coup discret → redirection probabiliste vers le « garde ».
  const cond = info[ti]?.cond
  const split = tourGardeSplit(chars, ti, cond)
  if (split && Math.random() < split.frac) ti = split.tankI
  const t = chars[ti]
  const ctx = info[ti]!
  for (const ab of enemy.abilities) {
    if ((ab.cast ?? 0) > 0) {
      ab.cast = (ab.cast ?? 0) - dt
      if ((ab.cast ?? 0) <= 0) { ab.cast = 0; applyEnemyAbility(ab, enemy, t, ctx); ab.cd = ab.cooldown }
    } else {
      ab.cd = (ab.cd ?? ab.cooldown) - dt
      if (ab.cd <= 0) {
        if (ab.telegraph && ab.telegraph > 0) {
          // ⏳ Grain de sable : la PREMIÈRE incantation de chaque non-boss est interrompue net.
          if (runes?.grainDeSable && !enemy.boss && !enemy.interrupted) {
            enemy.interrupted = true
            ab.cd = ab.cooldown
            continue
          }
          ab.cast = ab.telegraph * (1 + dilatation)
        } else { applyEnemyAbility(ab, enemy, t, ctx); ab.cd = ab.cooldown }
      }
    }
  }
}

/** Décompte des statuts transitoires du héros (étourdissement, malédiction, DoT subis).
 *  v0.26 : minute aussi les fenêtres des gemmes (Fièvre, Testament, Verre trempé, Carapace,
 *  Goutte-à-goutte) et soigne au Garrot quand une altération expire. */
function tickHeroStatuses(chars: Character[], dt: number, cond?: CondMods, pact?: PactMods) {
  adaptiveTick(dt) // Égide : les stacks adaptatifs s'éventent (20 s glissantes)
  if (fievreLeft > 0) fievreLeft = Math.max(0, fievreLeft - dt)
  if (testamentLeft > 0) testamentLeft = Math.max(0, testamentLeft - dt)
  if (hateFunebreLeft > 0) hateFunebreLeft = Math.max(0, hateFunebreLeft - dt)
  for (const c of chars) {
    // 🤬 Pacte du Berserk : les PV sont capés (les soins au-delà s'évaporent).
    if (pact?.hpCap && c.hp > 0) c.hp = Math.min(c.hp, charMaxHp(c) * pact.hpCap)
    if (c.stun && c.stun > 0) c.stun = Math.max(0, c.stun - dt)
    if (c.weaken) { c.weaken.remaining -= dt; if (c.weaken.remaining <= 0) c.weaken = undefined }
    if ((c.invuln ?? 0) > 0) { c.invuln = Math.max(0, c.invuln! - dt); if ((c.invuln ?? 0) <= 0) c.invuln = undefined }
    if (c.frenzy) { c.frenzy.remaining -= dt; if (c.frenzy.remaining <= 0) c.frenzy = undefined }
    if ((c.overload ?? 0) > 0) { c.overload = Math.max(0, c.overload! - dt) || undefined } // ✨ Surcharge Arcaniste
    if ((c.chimera ?? 0) > 0) { c.chimera = Math.max(0, c.chimera! - dt) || undefined } // 🐲 Forme Chimère
    // 🌀 MÉTAMORPHE « Danse Primordiale » : rotation auto des formes + Instinct (momentum).
    const cmF = charCombatMods(c)
    if (cmF.shifter) {
      const interval = Math.max(2, 5 - cmF.shiftHaste)
      c.formClock = (c.formClock ?? interval) - dt
      if (c.formClock <= 0) {
        c.form = ((c.form ?? 0) + 1) % 3                                  // Fauve → Ours → Hibou → …
        c.formClock = interval
        c.instinct = Math.min(cmF.instinctMax, (c.instinct ?? 0) + 1)     // chaque métamorphose : +1 Instinct
      }
      c.instinct = Math.max(0, (c.instinct ?? 0) - 0.05 * dt)             // décroît à l'arrêt (l'auto-cycle le maintient)
    }
    if (c.charge) c.charge.remaining -= dt // la frappe différée est résolue dans le pas de combat
    // v0.26 : horloges par héros des gemmes de Bastion/Flux.
    verreTimer.set(c.id, (verreTimer.get(c.id) ?? 0) + dt)
    const ccd = carapaceCdMap.get(c.id)
    if (ccd && ccd > 0) carapaceCdMap.set(c.id, Math.max(0, ccd - dt))
    const scd = shieldCdMap.get(c.id)
    if (scd && scd > 0) shieldCdMap.set(c.id, Math.max(0, scd - dt))
    // 💧 Goutte-à-goutte : la réserve se déverse à 2% des PV max par seconde (coupée au Jeûne).
    const pool = hotPool.get(c.id) ?? 0
    if (pool > 0 && c.hp > 0 && !pact?.noHeal) {
      const mh = charMaxHp(c)
      const flow = Math.min(pool, mh * 0.02 * dt)
      c.hp = Math.min(mh, c.hp + flow)
      hotPool.set(c.id, pool - flow)
    }
    if (c.dots && c.dots.length) {
      let dmg = 0
      for (const d of c.dots) {
        let tickDmg = d.dps * dt
        // ◈ Bastion III : les DoT subis sont atténués.
        if (cond?.dotTakenMult) tickDmg *= cond.dotTakenMult
        dmg += tickDmg
        d.dealt = (d.dealt ?? 0) + tickDmg
        d.remaining -= dt
      }
      // 🪢 Garrot : une altération qui EXPIRE rend une part des dégâts qu'elle a infligés.
      if (cond?.garrotPct && c.hp > 0) {
        let heal = 0
        for (const d of c.dots) if (d.remaining <= 0) heal += (d.dealt ?? 0) * cond.garrotPct
        if (heal > 0) c.hp = Math.min(charMaxHp(c), c.hp + heal)
      }
      c.dots = c.dots.filter((d) => d.remaining > 0)
      if (c.dots.length === 0) c.dots = undefined
      if (dmg > 0 && c.hp > 0) c.hp = Math.max(0, c.hp - dmg)
    }
  }
}

/** Un pas de combat de l'équipe contre un ennemi. Renvoie l'état mis à jour. */
/** v0.35 — vitesse d'explosion des dégâts d'un MUR passé son enrage (fraction/s). Course au DPS. */
const MUR_ENRAGE_RAMP = 0.5
function partyCombatStep(input: Character[], enemyIn: Enemy, dt: number, mods?: CombatMods) {
  const enemy: Enemy = { ...enemyIn, dot: enemyIn.dot ? { ...enemyIn.dot } : undefined, abilities: enemyIn.abilities?.map((a) => ({ ...a })) }
  const chars: Character[] = input.map((c) => ({ ...c, dots: c.dots?.map((d) => ({ ...d })), weaken: c.weaken ? { ...c.weaken } : undefined }))
  // Âge du combat : nourrit le Sablier de l'Acharné (gemme) et le Premier élan (rune de temps).
  enemy.age = (enemy.age ?? 0) + dt
  // 🔁 Boucle temporelle : toutes les N secondes, les recharges de l'équipe tombent à zéro.
  if (mods?.runes?.boucleEvery) {
    boucleAcc += dt
    if (boucleAcc >= mods.runes.boucleEvery) { boucleAcc = 0; resetAllCooldowns(chars) }
  }
  // Étoile d'Overkill : excédent du coup fatal, reporté sur l'ennemi suivant par l'appelant.
  let overkill = 0
  // Œil de l'Opportuniste : bonus pendant qu'une technique ennemie INCANTE (télégraphe visible).
  const enemyCasting = enemy.abilities?.some((a) => (a.cast ?? 0) > 0) ?? false
  const opportunisteMult = mods?.cond?.opportuniste && enemyCasting ? 1 + mods.cond.opportuniste : 1
  // v0.26 : qui était debout AVANT ce pas (⚓ Ancrage / 🎺 Marche / 📜 Testament).
  const aliveBefore = chars.map((c) => c.hp > 0)
  // Décompte des statuts transitoires (étourdissement, malédiction, DoT subis) avant d'agir.
  tickHeroStatuses(chars, dt, mods?.cond, mods?.pact)
  const info = chars.map((c) =>
    c.hp > 0
      ? {
          derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c),
          resist: charResist(c), cmods: charCombatMods(c),
          cond: mods?.cond, surge: mods?.content?.surge, aliveEnemies: 1, pact: mods?.pact,
          antidote: mods?.content?.antidote,
        }
      : null,
  )
  // ÉGIDE : aura partagée + stacks adaptatifs → résistances effectives.
  enrichResists(chars, info)
  // 🔮 Prisme d'accord : une part du profil de dégâts bascule vers le type du biome.
  if (mods?.cond?.prismePct && mods.content?.biomeType) {
    for (const d of info) if (d) d.profile = shiftProfile(d.profile, mods.content.biomeType, mods.cond.prismePct)
  }
  // 🧵 Pacte des Lignes ley : TOUT le profil bascule sur le type de l'arme (mono-élément).
  if (mods?.pact?.monoElement) {
    chars.forEach((c, i) => {
      const d = info[i]
      if (!d) return
      const base = c.equipment.armePrincipale?.damageType ?? 'physique'
      d.profile = { ...d.profile, profile: { [base]: 1 }, mainType: base }
    })
  }
  // v0.26 : premier tick face à cet ennemi → Égide rechargée, boucliers de départ, runes d'ouverture.
  if ((enemy.age ?? 0) <= dt + 1e-9) {
    gemFightStart(chars, info, mods?.cond)
    runeFightStart(chars, mods?.runes)
  }

  let totalDealt = 0

  // 1) Attaques automatiques (+ Multifrappe) + DoT (keystone). Les persos étourdis n'attaquent pas.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    // ⏱️ Premier élan + 🪽 Hâte funèbre : vitesse d'attaque dopée (runes de temps).
    const elanRune = mods?.runes?.premierElan && (enemy.age ?? 0) <= (mods.runes.premierElanDur ?? 10) ? 1 + mods.runes.premierElan : 1
    const hateRune = hateFunebreLeft > 0 && mods?.runes?.hateFunebre ? 1 + mods.runes.hateFunebre : 1
    const hits = d.derived.attacksPerSecond * elanRune * hateRune * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    // Malédiction (debuff ennemi) réduit les dégâts ; Frénésie (« Furie sanguinaire ») les amplifie.
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const acharne = mods?.cond?.acharneCap ? acharneMult(enemy.age ?? 0, mods.cond.acharneCap) : 1
    // 🫁 Second Souffle : le dos au mur (sous 30% PV) rend féroce.
    const souffle = mods?.cond?.souffle && hpFrac <= 0.3 ? 1 + mods.cond.souffle : 1
    // 🔪 ASSASSIN : fenêtre d'OUVERTURE (×mult les premières secondes face à cet ennemi).
    const opener = d.cmods.opener && (enemy.age ?? 0) <= d.cmods.opener.seconds ? d.cmods.opener.mult : 1
    // 🜍 PURGATEUR : le carburant d'affliction amplifie les dégâts.
    const fuel = fuelMult(c.id, d.cmods.afflictionFuel)
    // 🛡️ ÉGIDE « Gardien du seuil » : le surplus de résist face aux exigences devient des dégâts.
    const surplusMult = d.cmods.surplusToDamage > 0
      ? 1 + Math.min(d.cmods.surplusToDamage, (resistSurplus(enemy, d.resist) / RESIST_DSCALE) * d.cmods.surplusToDamage)
      : 1
    // v0.26 : 🎺 Marche, 📜 Testament, ⚡ Sous tension, 🪟 Verre trempé, 🧭 Boussole (champion)
    // + 🪦 Usure / 🩸 pactes (dégâts, autos, focus — l'ennemi unique EST le focus).
    const gemMult = gemOffenseMult(c, mods?.cond, enemy, false)
    const pactAuto = (mods?.pact?.autoMult ?? 1) * (1 + (mods?.pact?.focusBonus ?? 0))
    const runePact = runePactOffense(enemy.age ?? 0, mods?.runes, mods?.pact)
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult * (mods?.heroMult ?? 1) * acharne * souffle * opportunisteMult * opener * fuel * surplusMult * gemMult * pactAuto * runePact * formDamageMult(c, d.cmods)
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    const metroN = mods?.cond?.metronomeN
    // 🔁 Da capo : au-delà du seuil, les compteurs de RYTHME avancent ×2.
    const cStep = mods?.cond?.dacapoSec && (enemy.age ?? 0) > mods.cond.dacapoSec ? 2 : 1
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole && enemy.hp > 0; h++) {
      // 🎼 Métronome : toutes les N attaques auto, la suivante est un CRITIQUE garanti.
      let forceCrit = false
      if (metroN) {
        const mk = `metronome:${c.id}`
        const n = (gemCounters.get(mk) ?? 0) + cStep
        if (n >= metroN) { forceCrit = true; gemCounters.set(mk, 0) } else gemCounters.set(mk, n)
      }
      // 🪘 Cadence parfaite : toutes les N attaques, la suivante MULTIFRAPPE garantie.
      let forceMulti = false
      if (mods?.cond?.cadenceN) {
        const ck = `cad:${c.id}`
        const n = (gemCounters.get(ck) ?? 0) + cStep
        if (n >= mods.cond.cadenceN) { forceMulti = true; gemCounters.set(ck, 0) } else gemCounters.set(ck, n)
      }
      // 🥁 Tambour de siège : 8 coups sur la MÊME cible → Brèche (armure rongée 6 s).
      if (mods?.cond?.tambourPct) {
        const tk = `tam:${c.id}`
        const tt = `tamT:${c.id}`
        const tgtId = enemy.uid ?? 0
        if (gemCounters.get(tt) !== tgtId) { gemCounters.set(tt, tgtId); gemCounters.set(tk, 0) }
        const n = (gemCounters.get(tk) ?? 0) + cStep
        if (n >= 8) { enemy.sunder = { pct: mods.cond.tambourPct, remaining: 6 }; gemCounters.set(tk, 0) } else gemCounters.set(tk, n)
      }
      // ⚡ FOUDREUR « Décharge » : toutes les N attaques, la suivante frappe ×mult.
      let staticMult = 1
      if (d.cmods.staticN) {
        const sk = `static:${c.id}`
        const n = (gemCounters.get(sk) ?? 0) + 1
        if (n >= d.cmods.staticN.every) { staticMult = d.cmods.staticN.mult; gemCounters.set(sk, 0) } else gemCounters.set(sk, n)
      }
      // 🎻 Ostinato : la malchance se cumule en chance de critique.
      const ostK = `ost:${c.id}`
      const bonusCrit = mods?.cond?.ostinatoPer ? (gemCounters.get(ostK) ?? 0) * mods.cond.ostinatoPer : 0
      // Multifrappe : chance de déclencher un coup supplémentaire.
      const strikes = 1 + (forceMulti || Math.random() < multistrikeChance ? 1 : 0)
      for (let s = 0; s < strikes && enemy.hp > 0; s++) {
        const hit = rollHit(d.derived, d.profile, enemy, { bonusMult, execute: d.cmods.execute, forceCrit: forceCrit && s === 0, bonusCrit })
        if (mods?.cond?.ostinatoPer && s === 0) gemCounters.set(ostK, hit.crit ? 0 : (gemCounters.get(ostK) ?? 0) + cStep)
        // 🩸 Hémorragie cadencée : tous les N critiques, une plaie s'ouvre.
        if (hit.crit && mods?.cond?.hemorragieN) {
          const hk = `hem:${c.id}`
          const n = (gemCounters.get(hk) ?? 0) + 1
          if (n >= mods.cond.hemorragieN) {
            enemy.dot = { dps: Math.max((hit.damage * 0.6 / 6) * d.derived.alterationMult, enemy.dot?.dps ?? 0), remaining: 6 }
            gemCounters.set(hk, 0)
          } else gemCounters.set(hk, n)
        }
        // 🔥 PYROMANCIEN « Embrasement » : un coup CRITIQUE pose/rafraîchit un DoT feu.
        if (hit.crit && d.cmods.igniteOnCrit) {
          enemy.dot = { dps: Math.max(hit.damage * d.cmods.igniteOnCrit.frac * d.derived.alterationMult, enemy.dot?.dps ?? 0), remaining: d.cmods.igniteOnCrit.duration }
        }
        // 🩸 FURIE « Enrage » (v0.34) : un coup CRITIQUE déclenche/rafraîchit l'Enrage (frenzy) — sans jamais downgrader une transe plus forte.
        if (hit.crit && d.cmods.enrageOnCrit) {
          const e = d.cmods.enrageOnCrit
          c.frenzy = { mult: Math.max(e.mult, c.frenzy?.mult ?? 0), remaining: Math.max(e.duration, c.frenzy?.remaining ?? 0) }
        }
        const dmg = hit.damage * enemyVuln(enemy) * (s === 0 ? staticMult : 1) // Sceau de faiblesse + Décharge
        if (mods?.cond?.overkill && dmg > enemy.hp) overkill += dmg - enemy.hp
        enemy.hp = Math.max(0, enemy.hp - dmg)
        totalDealt += dmg
        dealtThis += dmg
        healed += hit.heal
        // 🦷 Fièvre de l'hallali : fenêtre de vol de vie dopé après un kill.
        if (fievreLeft > 0 && mods?.cond?.fievreLeech) healed += dmg * mods.cond.fievreLeech
        if (d.cmods.dot) enemy.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac * d.derived.alterationMult, enemy.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
      }
    }
    // 🐾 INVOCATION : le familier inflige en continu une fraction de ton DPS d'auto-attaque.
    if (d.cmods.petDps > 0 && enemy.hp > 0) {
      // v0.34 SYMBIOSE : le familier hérite de tes stats (petBonus + Précision, BORNÉ) et suit ta marque (vuln).
      const petMult = (1 + d.cmods.petBonus + d.cmods.petFromPrecision * d.derived.precision) * (d.cmods.petBonus > 0 ? enemyVuln(enemy) : 1)
      const pet = theoreticalDps(d.derived, d.profile, d.cmods.damageMult) * d.cmods.petDps * petMult * dt
      enemy.hp = Math.max(0, enemy.hp - pet); dealtThis += pet
      // LIEN INSTINCTIF : le familier génère de la Concentration (combo) au fil du temps → alimente tes finisseurs.
      if (d.cmods.petCombo > 0) c.combo = Math.min(5 + d.cmods.comboCap, (c.combo ?? 0) + d.cmods.petCombo * dt)
    }
    if (c.charge) c.charge.dealt += dealtThis
    if (healed && !mods?.pact?.noHeal) gemLeechHeal(c, healed, mods?.cond) // 💧 l'excès est conservé
  })

  // ❄ CONTRÔLE : le gel/ralenti s'estompe.
  if ((enemy.controlled ?? 0) > 0) { enemy.controlled = Math.max(0, (enemy.controlled ?? 0) - dt) || undefined }

  // 2) Dégâts du DoT sur l'ennemi + décompte de ses statuts (vulnérabilité, anti-régén).
  // ⏩ Avance rapide (rune) : TES altérations tickent plus vite (mêmes dégâts totaux, compressés).
  const dotHaste = 1 + (mods?.runes?.avanceRapide ?? 0)
  if (enemy.dot && enemy.hp > 0) {
    const dmg = enemy.dot.dps * dt * dotHaste
    enemy.hp = Math.max(0, enemy.hp - dmg)
    totalDealt += dmg
    enemy.dot.remaining -= dt * dotHaste
    if (enemy.dot.remaining <= 0) enemy.dot = undefined
    // ☠ FAUCHEUR : les DoT te soignent (fraction du tick).
    chars.forEach((c, i) => {
      const d = info[i]
      if (d && c.hp > 0 && d.cmods.dotLeech > 0) c.hp = Math.min(charMaxHp(c), c.hp + dmg * d.cmods.dotLeech)
    })
    healDotParty(chars, info, dmg) // 🌗 COMMUNION D'OMBRE : les DoT soignent l'allié le plus blessé
  }
  if ((enemy.noRegen ?? 0) > 0) enemy.noRegen = Math.max(0, enemy.noRegen! - dt)
  if (enemy.vuln) { enemy.vuln.remaining -= dt; if (enemy.vuln.remaining <= 0) enemy.vuln = undefined }
  if (enemy.sunder) { enemy.sunder.remaining -= dt; if (enemy.sunder.remaining <= 0) enemy.sunder = undefined }

  // 3) Capacités actives (cooldown réduit par la Récupération). AUTO = auto-lancées ; MANUEL = sur tap
  //    (castPower) uniquement, lancement STRICT (si pas prêt, rien). Étourdi = on ne LANCE pas, mais
  //    les RECHARGES continuent de tourner (le CD se résorbe même étourdi).
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const stunned = (c.stun ?? 0) > 0
    // ARCANISTE « Surcharge » (v0.31) : pendant la fenêtre, recharges ×2 et dégâts de sorts ×mult.
    const overloadOn = (c.overload ?? 0) > 0 && !!d.cmods.overload
    const overloadMult = overloadOn ? d.cmods.overload!.mult : 1
    // v0.30 : le « deck » de combat = 5 actifs (auto/manuel) + 3 générateurs (auto pur, fabriquent la ressource).
    const deck: { pid: string; auto: boolean }[] = []
    c.powers.forEach((pid, slot) => { if (pid) deck.push({ pid, auto: c.powerAuto?.[slot] !== false }) })
    for (const gid of c.generators ?? []) if (gid) deck.push({ pid: gid, auto: true })
    deck.forEach(({ pid, auto }) => {
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      const key = `${c.id}:${pid}`
      // ⌛ Sabliers liés (v0.26) : les recharges défilent plus vite pendant une incantation ennemie.
      const cdTick = dt * (1 + (enemyCasting && mods?.runes?.sabliers ? mods.runes.sabliers : 0)) * (overloadOn ? 2 : 1)
      const cd = (cooldowns.get(key) ?? 0) - cdTick
      if (cd <= 0 && !stunned && (auto || manualFire.has(key)) && autoSpenderReady(p, c, enemy, manualFire.has(key))) {
        // 🩸 Pacte sanglant : recharges raccourcies, mais chaque lancement coûte 2% des PV max.
        const pacte = mods?.cond?.pacteCdr ?? 0
        // 🛎️ Carillon (v0.26) : tous les N lancements, la recharge suivante est à moitié prix.
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr) * (1 - pacte) * carillonMult(mods?.cond))
        if (pacte > 0) c.hp = Math.max(1, c.hp - 0.02 * charMaxHp(c))
        manualFire.delete(key)
        // ⏳ CHRONOMANCIEN « Cascade temporelle » : chaque sort lancé rembourse les autres recharges.
        if (d.cmods.cdrOnCast > 0) {
          for (const pid2 of charDeck(c)) {
            if (!pid2 || pid2 === pid) continue
            const k2 = `${c.id}:${pid2}`
            cooldowns.set(k2, Math.max(0, (cooldowns.get(k2) ?? 0) - d.cmods.cdrOnCast))
          }
        }
        // Sorts : keystones + ×sorts + 🩸 pactes (Pacifiste, Verre) + 🪦 Usure/💀 Memento.
        lastCastGlobal = { charId: c.id, pid } // 🌀 Écho temporel : mémorise la dernière capacité
        const spellMult = d.cmods.damageMult * d.cmods.spellMult * overloadMult
          * (mods?.pact?.spellMult ?? 1) * runePactOffense(enemy.age ?? 0, mods?.runes, mods?.pact)
        const dealt = fireActive(p, c, d.derived, d.profile, chars, enemy, d.cmods.hot, spellMult, d.cmods.healToDamage, mods?.cond, mods?.pact)
        // Vengeance différée : compte AUSSI les dégâts des sorts dans le cumul.
        if (c.charge && dealt > 0) c.charge.dealt += dealt
        // 💥 Détonation arcanique : le compteur d'équipe avance (l'AoE ne joue qu'en pack — Multi).
        if (mods?.cond?.detonationN && dealt > 0) {
          const n = (gemCounters.get('deto') ?? 0) + 1
          gemCounters.set('deto', n >= mods.cond.detonationN ? 0 : n)
        }
        // 🔔 Pierre d'Écho : tous les N sorts de l'équipe, le suivant résonne une 2e fois (50%).
        const echoN = mods?.cond?.echoN
        if (echoN) {
          const n = (gemCounters.get('echo') ?? 0) + 1
          if (n >= echoN) {
            gemCounters.set('echo', 0)
            const echoDealt = fireActive(p, c, d.derived, d.profile, chars, enemy, d.cmods.hot, spellMult * 0.5, d.cmods.healToDamage * 0.5, mods?.cond, mods?.pact)
            if (c.charge && echoDealt > 0) c.charge.dealt += echoDealt
          } else gemCounters.set('echo', n)
        }
      } else {
        cooldowns.set(key, Math.max(0, cd))
        if (!auto && !stunned) manualFire.delete(key) // cast manuel strict : pas de file d'attente
      }
    })
  })

  // 3b) Vengeance différée : la fenêtre expirée, déchaîne ×mult TOUT le cumul (auto + sorts).
  for (const c of chars) {
    if (!c.charge || c.charge.remaining > 0) continue
    if (c.hp > 0 && enemy.hp > 0 && c.charge.dealt > 0) {
      const burst = c.charge.dealt * c.charge.mult * enemyVuln(enemy)
      enemy.hp = Math.max(0, enemy.hp - burst)
      totalDealt += burst
    }
    c.charge = undefined
  }

  // 4) L'ennemi frappe la plus haute menace (dégâts typés, réduits par la résistance héros).
  const alive = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
  if (enemy.hp > 0 && alive.length) {
    let targetI = alive[0]
    let best = -1
    for (const i of alive) {
      const d = info[i]!
      const dps = d.derived.power * d.derived.attacksPerSecond
      const score = (dps + 1) * d.passives.threatMult
      if (score > best) {
        best = score
        targetI = i
      }
    }
    const t = chars[targetI]
    const td = info[targetI]!
    // Étourdissement du boss (réduit par la Ténacité de la cible).
    if (enemy.ccDur) {
      enemy.ccCd = (enemy.ccCd ?? 0) - dt
      if (enemy.ccCd <= 0) {
        enemy.ccCd = CC_INTERVAL
        t.stun = Math.max(t.stun ?? 0, enemy.ccDur * (1 - td.derived.tenacity))
      }
    }
    // 🧊 Stase (rune) : la montée en puissance ennemie est gelée les X premières secondes.
    const rampT = Math.max(0, (mods?.fightTime ?? 0) - (mods?.runes?.staseSec ?? 0))
    // v0.35 — ENRAGE DUR du MUR (boss de fin de Palier) : passé `mur.enrageAt`, les dégâts EXPLOSENT
    // (+50 %/s) → course au DPS, l'ossature du mur (DESIGN_v0.35 §6). Depuis `enemy.age` (pas de
    // compounding) ; sans effet sur le farm normal / les packs (pas de `mur`).
    const murAge = enemy.age ?? 0
    const murEnrage = enemy.mur && murAge > enemy.mur.enrageAt
      ? 1 + (murAge - enemy.mur.enrageAt) * MUR_ENRAGE_RAMP : 1
    let effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * rampT) * (mods?.dmgMult ?? 1) * murEnrage
    // 🫧 Latence (rune) : les ennemis frappent moins fort en début de combat.
    if (mods?.runes?.latence && (enemy.age ?? 0) <= 8) effDmg *= 1 - mods.runes.latence
    // L'atténuation générique (esquive/réduction/maîtrise + passives/keystones) est BORNÉE
    // dans incomingDps ; le multiplicateur d'exigence du type (v0.24) s'applique avant.
    let incoming = incomingDps(
      effDmg, enemy.damageType, td.derived, td.resist,
      enemyReq(enemy, enemy.damageType),
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
      td.cmods.reqReduction,
    ) * dt
    // Réfléchissant : CAPÉ à 10% des PV max de la cible par seconde — sinon un héros à très gros
    // DPS et petits PV se one-shotait lui-même (400k DPS vs 12k PV…).
    if (mods?.reflect) incoming += Math.min(totalDealt * mods.reflect, charMaxHp(t) * 0.10 * dt)
    // v0.26 : 🗼 Tour de garde — une part du flux part vers le plus endurant si la cible chancelle.
    const split = tourGardeSplit(chars, targetI, mods?.cond)
    const parts: [number, number][] = split ? [[targetI, 1 - split.frac], [split.tankI, split.frac]] : [[targetI, 1]]
    for (const [ci, frac] of parts) {
      const cc = chars[ci]
      const cd2 = info[ci]
      if (!cd2 || frac <= 0) continue
      // Chaîne défensive (🪨 Granit, ⚓ Ancrage, 💫 Sixième sens, 🌂 Paratonnerre) + 🍷 pactes + 🧴 antidote…
      const antid = mods?.content?.antidote
      const dmg = incoming * frac * (mods?.pact?.dmgIn ?? 1)
        * (antid && antid.type === enemy.damageType ? 1 - antid.pct : 1)
        * gemDefenseMult(cc, charMaxHp(cc), {
          cond: mods?.cond, casting: enemyCasting, surge: mods?.content?.surge, aliveEnemies: 1,
        })
      // …puis Bastion réactif (🔃 Échangeur, 🌵 Cilice) et immunité/bouclier d'absorption.
      const taken = gemDamageHero(cc, dmg, { cond: mods?.cond, attacker: enemy })
      // ÉGIDE « Aegis adaptatif » : être frappé par un type endurcit contre ce type.
      if (cd2.cmods.adaptiveResist && taken > 0) adaptiveAdd(cc.id, enemy.damageType, cd2.cmods.adaptiveResist.gain * dt, cd2.cmods.adaptiveResist.cap)
      // Épines (thorns) : renvoie une fraction de l'attaque à l'ennemi (basée sur le coup, bouclier inclus).
      if (cd2.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - dmg * cd2.cmods.thorns)
      // 🩸 VENGEANCE (v0.34, Juggernaut) : encaisser génère de la Rage (Combo) ∝ aux PV perdus.
      if (cd2.cmods.damageToRage > 0 && taken > 0) cc.combo = Math.min(5 + cd2.cmods.comboCap, (cc.combo ?? 0) + cd2.cmods.damageToRage * Math.min(0.3, taken / Math.max(1, charMaxHp(cc))) * 8)
    }
    // 🤺 Riposte mesurée : le temps sous le feu se mue en contre-attaques.
    totalDealt += gemRiposte(t, td, enemy, dt, mods?.cond)
  }

  // 4b) Techniques signature de l'ennemi (DoT/burst/CC/debuff/drain) sur la plus haute menace.
  tickEnemyAbilities(enemy, chars, info, dt, mods?.runes)
  // ⏪ Rembobinage (rune) : un héros au bord du gouffre récupère ses recharges (1×/combat).
  runeRembobinage(chars, mods?.runes)
  // 🌀 Écho temporel (rune) : toutes les 30 s, la dernière capacité est relancée gratuitement.
  if (mods?.runes?.echoTemporel) {
    echoTempAcc += dt
    if (echoTempAcc >= 30 && lastCastGlobal && enemy.hp > 0) {
      echoTempAcc = 0
      const ci = chars.findIndex((c) => c.id === lastCastGlobal!.charId && c.hp > 0)
      const d = ci >= 0 ? info[ci] : null
      const p = getPower(lastCastGlobal.pid)
      if (d && p && p.kind === 'active') {
        const dealt = fireActive(p, chars[ci], d.derived, d.profile, chars, enemy, d.cmods.hot,
          d.cmods.damageMult * d.cmods.spellMult * mods.runes.echoTemporel, 0, mods?.cond, mods?.pact)
        totalDealt += dealt
      }
    }
  }

  // 5) Régénération de l'ennemi (Vampirique) — annulée par « Hémorragie cosmique ».
  if (mods?.regen && enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 5b) 🕊️ Sursis : un héros qui vient de tomber survit à 25% PV (👑 Hubris : sans filet).
  const revived = applySursis(chars, mods?.pact?.noSursis ? undefined : mods?.runes?.sursisCd)
  // v0.26 : morts restantes → ⚓ Ancrage brisé, 🎺 Marche perdue, 📜 Testament, 💀 Memento.
  gemDeathEvents(chars, aliveBefore, mods?.cond, mods?.pact)

  // 6) Régénération des persos (+ bonus de régén + Métaboliseur d'Égide) + clamp.
  // v0.25.x — RELÈVE (farm uniquement, ce pas de combat ne sert qu'aux paliers) : un héros tombé
  // se relève après FARM_REZ_DELAY à 35% de ses PV. Avant, hors wipe d'équipe, un mort restait
  // mort pour toujours (la régén ne touchait que les vivants) — c'était le « perso pas rez ».
  const rezzed: string[] = []
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      let regen = mh * REGEN_RATE * (1 + d.derived.regenBonus) * regenMult
      // 🛡️ ÉGIDE « Métaboliseur » : le surplus de résist face aux exigences devient du soin/s.
      if (d.cmods.surplusRegen > 0) {
        regen += mh * Math.min(d.cmods.surplusRegen, (resistSurplus(enemy, d.resist) / RESIST_DSCALE) * d.cmods.surplusRegen)
      }
      // 💉 Perfusion (v0.26) : sous 50% des PV, la régénération s'emballe.
      if (mods?.cond?.perfusionBonus && c.hp / mh < 0.5) regen *= 1 + mods.cond.perfusionBonus
      // 🍽️ Jeûne / 🧛 Sang vicié : la régénération est coupée.
      if (mods?.pact?.noHeal || mods?.pact?.noRegen) regen = 0
      c.hp = Math.min(mh, c.hp + regen * dt)
    } else if (c.hp <= 0) {
      c.rez = (c.rez ?? 0) + dt
      if (c.rez >= FARM_REZ_DELAY) {
        c.hp = Math.round(charMaxHp(c) * 0.35)
        c.rez = undefined
        rezzed.push(c.name)
      }
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemy, anyAlive: chars.some((c) => c.hp > 0), totalDealt, overkill, revived, rezzed }
}

/**
 * Pas de combat de l'équipe contre PLUSIEURS ennemis simultanés (donjons en pack, raids avec adds).
 * - Les auto-attaques + capacités mono-cible concentrent le feu sur le 1er ennemi vivant (focus).
 * - Les capacités `cleave` touchent TOUS les ennemis vivants.
 * - CHAQUE ennemi vivant frappe la plus haute menace → un pack met l'équipe sous pression (survie de groupe).
 */
function partyCombatStepMulti(input: Character[], enemiesIn: Enemy[], dt: number, mods?: CombatMods) {
  const enemies: Enemy[] = enemiesIn.map((e) => ({ ...e, dot: e.dot ? { ...e.dot } : undefined, abilities: e.abilities?.map((a) => ({ ...a })) }))
  const chars: Character[] = input.map((c) => ({ ...c, dots: c.dots?.map((d) => ({ ...d })), weaken: c.weaken ? { ...c.weaken } : undefined }))
  // Gemmes de condition : Cœur de Nuée (packs) + Sablier de l'Acharné (âge de la cible focus).
  const aliveAtStart = enemies.filter((e) => e.hp > 0).length
  const nuee = mods?.cond?.nueePer ? nueeMult(aliveAtStart, mods.cond.nueePer) : 1
  for (const e of enemies) if (e.hp > 0) e.age = (e.age ?? 0) + dt
  // 🔁 Boucle temporelle : toutes les N secondes, les recharges de l'équipe tombent à zéro.
  if (mods?.runes?.boucleEvery) {
    boucleAcc += dt
    if (boucleAcc >= mods.runes.boucleEvery) { boucleAcc = 0; resetAllCooldowns(chars) }
  }
  // Œil de l'Opportuniste : bonus tant qu'au moins un ennemi du pack INCANTE (télégraphe).
  const anyCasting = enemies.some((e) => e.hp > 0 && e.abilities?.some((a) => (a.cast ?? 0) > 0))
  const opportunisteMult = mods?.cond?.opportuniste && anyCasting ? 1 + mods.cond.opportuniste : 1
  // v0.26 : qui était debout AVANT ce pas (⚓ Ancrage / 🎺 Marche / 📜 Testament).
  const aliveBefore = chars.map((c) => c.hp > 0)
  tickHeroStatuses(chars, dt, mods?.cond, mods?.pact)
  const info = chars.map((c) =>
    c.hp > 0
      ? {
          derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c),
          resist: charResist(c), cmods: charCombatMods(c),
          cond: mods?.cond, surge: mods?.content?.surge, aliveEnemies: aliveAtStart, pact: mods?.pact,
          antidote: mods?.content?.antidote,
        }
      : null,
  )
  // ÉGIDE : aura partagée + stacks adaptatifs → résistances effectives.
  enrichResists(chars, info)
  // 🏅 Trophée de guerre (v0.26) : en raid, des points de résistance offerts à toute l'équipe.
  if (mods?.content?.resistBonus) {
    for (const d of info) {
      if (!d) continue
      const merged: Partial<Record<DamageType, number>> = { ...d.resist }
      for (const t of DAMAGE_TYPE_LIST) merged[t] = (merged[t] ?? 0) + mods.content.resistBonus
      d.resist = merged
    }
  }
  // 🧵 Pacte des Lignes ley : TOUT le profil bascule sur le type de l'arme (mono-élément).
  if (mods?.pact?.monoElement) {
    chars.forEach((c, i) => {
      const d = info[i]
      if (!d) return
      const base = c.equipment.armePrincipale?.damageType ?? 'physique'
      d.profile = { ...d.profile, profile: { [base]: 1 }, mainType: base }
    })
  }
  // v0.26 : premier tick de la RENCONTRE → Égide rechargée, boucliers de départ, runes d'ouverture.
  if ((mods?.fightTime ?? 99) <= dt + 1e-9) {
    gemFightStart(chars, info, mods?.cond)
    runeFightStart(chars, mods?.runes)
  }
  let totalDealt = 0
  const focus = (): Enemy | undefined => enemies.find((e) => e.hp > 0)

  // 1) Auto-attaques (+ Multifrappe) sur la cible focus + DoT keystone. Étourdi = pas d'attaque.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    // ⏱️ Premier élan + 🪽 Hâte funèbre : vitesse d'attaque dopée (runes de temps).
    const elanRune = mods?.runes?.premierElan && (mods?.fightTime ?? 99) <= (mods.runes.premierElanDur ?? 10) ? 1 + mods.runes.premierElan : 1
    const hateRune = hateFunebreLeft > 0 && mods?.runes?.hateFunebre ? 1 + mods.runes.hateFunebre : 1
    const hits = d.derived.attacksPerSecond * elanRune * hateRune * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const acharne = mods?.cond?.acharneCap ? acharneMult(focus()?.age ?? 0, mods.cond.acharneCap) : 1
    // 🫁 Second Souffle : sous 30% PV, le héros frappe plus fort.
    const souffle = mods?.cond?.souffle && hpFrac <= 0.3 ? 1 + mods.cond.souffle : 1
    // 🔪 ASSASSIN : fenêtre d'OUVERTURE face à la cible focus (l'âge est par ennemi).
    const opener = d.cmods.opener && (focus()?.age ?? 99) <= d.cmods.opener.seconds ? d.cmods.opener.mult : 1
    // 🜍 PURGATEUR : carburant d'affliction. 🌋 BRISEUR : +dégâts par ennemi vivant.
    const fuel = fuelMult(c.id, d.cmods.afflictionFuel)
    const perEnemy = 1 + d.cmods.perEnemyBonus * Math.max(0, aliveAtStart - 1)
    // 🛡️ ÉGIDE « Gardien du seuil » : surplus de résist face à la cible focus → dégâts.
    const fTarget = focus()
    const surplusMult = d.cmods.surplusToDamage > 0 && fTarget
      ? 1 + Math.min(d.cmods.surplusToDamage, (resistSurplus(fTarget, d.resist) / RESIST_DSCALE) * d.cmods.surplusToDamage)
      : 1
    // v0.26 : 🎺 Marche, 📜 Testament, ⚡ Sous tension, 🪟 Verre trempé, 🧭 Boussole (champion),
    // 🎯 Première impression (le premier ennemi du pack, packs de 2+).
    const fTarget0 = focus()
    const firstOfPack = aliveAtStart >= 2 && !!fTarget0 && fTarget0 === enemies[0]
    const gemMult = gemOffenseMult(c, mods?.cond, fTarget0, firstOfPack)
    // 🩸 Pactes : autos (Pacifiste), bonus focus (Duelliste — les autos frappent le focus),
    // dégâts globaux (Verre, Meute…) + 🪦 Usure / 💀 Memento.
    const pactAuto = (mods?.pact?.autoMult ?? 1) * (1 + (mods?.pact?.focusBonus ?? 0))
    const runePact = runePactOffense(mods?.fightTime ?? 0, mods?.runes, mods?.pact)
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult * (mods?.heroMult ?? 1) * nuee * acharne * souffle * opportunisteMult * opener * fuel * perEnemy * surplusMult * gemMult * pactAuto * runePact * formDamageMult(c, d.cmods)
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    const metroN = mods?.cond?.metronomeN
    // 🔁 Da capo : au-delà du seuil de la RENCONTRE, les compteurs de RYTHME avancent ×2.
    const cStep = mods?.cond?.dacapoSec && (mods?.fightTime ?? 0) > mods.cond.dacapoSec ? 2 : 1
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole; h++) {
      const target = focus()
      if (!target) break
      // 🎼 Métronome : critique garanti toutes les N attaques auto.
      let forceCrit = false
      if (metroN) {
        const mk = `metronome:${c.id}`
        const n = (gemCounters.get(mk) ?? 0) + cStep
        if (n >= metroN) { forceCrit = true; gemCounters.set(mk, 0) } else gemCounters.set(mk, n)
      }
      // 🪘 Cadence parfaite : toutes les N attaques, la suivante MULTIFRAPPE garantie.
      let forceMulti = false
      if (mods?.cond?.cadenceN) {
        const ck = `cad:${c.id}`
        const n = (gemCounters.get(ck) ?? 0) + cStep
        if (n >= mods.cond.cadenceN) { forceMulti = true; gemCounters.set(ck, 0) } else gemCounters.set(ck, n)
      }
      // 🥁 Tambour de siège : 8 coups sur la MÊME cible → Brèche (armure rongée 6 s).
      if (mods?.cond?.tambourPct) {
        const tk = `tam:${c.id}`
        const tt = `tamT:${c.id}`
        const tgtId = target.uid ?? enemies.indexOf(target)
        if (gemCounters.get(tt) !== tgtId) { gemCounters.set(tt, tgtId); gemCounters.set(tk, 0) }
        const n = (gemCounters.get(tk) ?? 0) + cStep
        if (n >= 8) { target.sunder = { pct: mods.cond.tambourPct, remaining: 6 }; gemCounters.set(tk, 0) } else gemCounters.set(tk, n)
      }
      // ⚡ FOUDREUR « Décharge » : toutes les N attaques, la suivante frappe ×mult.
      let staticMult = 1
      if (d.cmods.staticN) {
        const sk = `static:${c.id}`
        const n = (gemCounters.get(sk) ?? 0) + 1
        if (n >= d.cmods.staticN.every) { staticMult = d.cmods.staticN.mult; gemCounters.set(sk, 0) } else gemCounters.set(sk, n)
      }
      // 🎻 Ostinato : la malchance se cumule en chance de critique.
      const ostK = `ost:${c.id}`
      const bonusCrit = mods?.cond?.ostinatoPer ? (gemCounters.get(ostK) ?? 0) * mods.cond.ostinatoPer : 0
      const strikes = 1 + (forceMulti || Math.random() < multistrikeChance ? 1 : 0)
      for (let st = 0; st < strikes; st++) {
        const t2 = focus()
        if (!t2) break
        const hit = rollHit(d.derived, d.profile, t2, { bonusMult, execute: d.cmods.execute, forceCrit: forceCrit && st === 0, bonusCrit })
        if (mods?.cond?.ostinatoPer && st === 0) gemCounters.set(ostK, hit.crit ? 0 : (gemCounters.get(ostK) ?? 0) + cStep)
        // 🩸 Hémorragie cadencée : tous les N critiques, une plaie s'ouvre.
        if (hit.crit && mods?.cond?.hemorragieN) {
          const hk = `hem:${c.id}`
          const n = (gemCounters.get(hk) ?? 0) + 1
          if (n >= mods.cond.hemorragieN) {
            t2.dot = { dps: Math.max((hit.damage * 0.6 / 6) * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: 6 }
            gemCounters.set(hk, 0)
          } else gemCounters.set(hk, n)
        }
        // 🔥 PYROMANCIEN « Embrasement » : un coup CRITIQUE pose/rafraîchit un DoT feu.
        if (hit.crit && d.cmods.igniteOnCrit) {
          t2.dot = { dps: Math.max(hit.damage * d.cmods.igniteOnCrit.frac * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: d.cmods.igniteOnCrit.duration }
        }
        // 🩸 FURIE « Enrage » (v0.34) : un coup CRITIQUE déclenche/rafraîchit l'Enrage (frenzy).
        if (hit.crit && d.cmods.enrageOnCrit) {
          const e = d.cmods.enrageOnCrit
          c.frenzy = { mult: Math.max(e.mult, c.frenzy?.mult ?? 0), remaining: Math.max(e.duration, c.frenzy?.remaining ?? 0) }
        }
        const dmg = hit.damage * enemyVuln(t2) * (st === 0 ? staticMult : 1)
        // Étoile d'Overkill : l'excédent du coup fatal déborde sur les ennemis suivants du pack
        // (hors totalDealt → n'alimente pas le Réfléchissant).
        if (mods?.cond?.overkill && dmg > t2.hp) {
          let left = dmg - t2.hp
          t2.hp = 0
          while (left > 0) {
            const nx = focus()
            if (!nx) break
            const absorbed = Math.min(left, nx.hp)
            nx.hp -= absorbed
            left -= absorbed
          }
        }
        t2.hp = Math.max(0, t2.hp - dmg)
        totalDealt += dmg
        dealtThis += dmg
        healed += hit.heal
        // 🦷 Fièvre de l'hallali : fenêtre de vol de vie dopé après un kill.
        if (fievreLeft > 0 && mods?.cond?.fievreLeech) healed += dmg * mods.cond.fievreLeech
        if (d.cmods.dot) {
          t2.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
          // 🦠 PESTIFÉRÉ « Pandémie » : la peste s'applique aussi au reste du pack (fraction).
          if (d.cmods.dotAoe > 0) {
            const spread = hit.damage * d.cmods.dot.frac * d.derived.alterationMult * d.cmods.dotAoe
            for (const e of enemies) {
              if (e === t2 || e.hp <= 0) continue
              e.dot = { dps: Math.max(spread, e.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
            }
          }
        }
        // 🌋 BRISEUR « Onde de choc » + ⚡ FOUDREUR « Foudre en chaîne » : éclaboussures sur le pack
        // (🤺 Duelliste : les coups hors focus sont amoindris).
        if ((d.cmods.cleaveAuto > 0 || d.cmods.chainArc) && dmg > 0) {
          let arcLeft = d.cmods.chainArc?.targets ?? 0
          const offFocus = mods?.pact?.offFocusMult ?? 1
          for (const e of enemies) {
            if (e === t2 || e.hp <= 0) continue
            let frac = d.cmods.cleaveAuto
            if (arcLeft > 0 && d.cmods.chainArc) { frac = Math.max(frac, d.cmods.chainArc.frac); arcLeft-- }
            if (frac <= 0) break
            const splash = dmg * frac * offFocus
            e.hp = Math.max(0, e.hp - splash)
            totalDealt += splash
            dealtThis += splash
          }
        }
      }
    }
    // 🐾 INVOCATION : le familier frappe la cible focus, en continu.
    if (d.cmods.petDps > 0) {
      const f = focus()
      if (f && f.hp > 0) {
        const petMult = (1 + d.cmods.petBonus + d.cmods.petFromPrecision * d.derived.precision) * (d.cmods.petBonus > 0 ? enemyVuln(f) : 1)
        const pet = theoreticalDps(d.derived, d.profile, d.cmods.damageMult) * d.cmods.petDps * petMult * dt
        f.hp = Math.max(0, f.hp - pet); dealtThis += pet
        if (d.cmods.petCombo > 0) c.combo = Math.min(5 + d.cmods.comboCap, (c.combo ?? 0) + d.cmods.petCombo * dt)
      }
    }
    if (c.charge) c.charge.dealt += dealtThis
    if (healed && !mods?.pact?.noHeal) gemLeechHeal(c, healed, mods?.cond) // 💧 l'excès est conservé
  })

  // 2) DoT par ennemi + décompte de ses statuts (vulnérabilité, anti-régén, Brèche).
  // ⏩ Avance rapide (rune) : TES altérations tickent plus vite (compressées, mêmes dégâts totaux).
  const dotHaste = 1 + (mods?.runes?.avanceRapide ?? 0)
  for (const enemy of enemies) {
    if ((enemy.controlled ?? 0) > 0) enemy.controlled = Math.max(0, (enemy.controlled ?? 0) - dt) || undefined // ❄ contrôle s'estompe
    if (enemy.dot && enemy.hp > 0) {
      const dmg = enemy.dot.dps * dt * dotHaste
      enemy.hp = Math.max(0, enemy.hp - dmg)
      totalDealt += dmg
      enemy.dot.remaining -= dt * dotHaste
      if (enemy.dot.remaining <= 0) enemy.dot = undefined
      // ☠ FAUCHEUR : les DoT te soignent (fraction du tick).
      chars.forEach((c, i) => {
        const d = info[i]
        if (d && c.hp > 0 && d.cmods.dotLeech > 0) c.hp = Math.min(charMaxHp(c), c.hp + dmg * d.cmods.dotLeech)
      })
      healDotParty(chars, info, dmg) // 🌗 COMMUNION D'OMBRE
    }
    if ((enemy.noRegen ?? 0) > 0) enemy.noRegen = Math.max(0, enemy.noRegen! - dt)
    if (enemy.vuln) { enemy.vuln.remaining -= dt; if (enemy.vuln.remaining <= 0) enemy.vuln = undefined }
    if (enemy.sunder) { enemy.sunder.remaining -= dt; if (enemy.sunder.remaining <= 0) enemy.sunder = undefined }
  }

  // 3) Actives : `cleave`/AoE touchent TOUS les ennemis, le reste la cible focus. Étourdi = on ne
  //    LANCE pas, mais les RECHARGES continuent de tourner.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const stunned = (c.stun ?? 0) > 0
    // ARCANISTE « Surcharge » (v0.31) : pendant la fenêtre, recharges ×2 et dégâts de sorts ×mult.
    const overloadOn = (c.overload ?? 0) > 0 && !!d.cmods.overload
    const overloadMult = overloadOn ? d.cmods.overload!.mult : 1
    // v0.30 : deck = 5 actifs (auto/manuel) + 3 générateurs (auto pur).
    const deck: { pid: string; auto: boolean }[] = []
    c.powers.forEach((pid, slot) => { if (pid) deck.push({ pid, auto: c.powerAuto?.[slot] !== false }) })
    for (const gid of c.generators ?? []) if (gid) deck.push({ pid: gid, auto: true })
    deck.forEach(({ pid, auto }) => {
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      const key = `${c.id}:${pid}`
      // ⌛ Sabliers liés (v0.26) : les recharges défilent plus vite pendant une incantation ennemie.
      const cdTick = dt * (1 + (anyCasting && mods?.runes?.sabliers ? mods.runes.sabliers : 0)) * (overloadOn ? 2 : 1)
      const cd = (cooldowns.get(key) ?? 0) - cdTick
      if (cd <= 0 && !stunned && (auto || manualFire.has(key)) && autoSpenderReady(p, c, focus(), manualFire.has(key))) {
        // 🩸 Pacte sanglant : recharges raccourcies contre 2% des PV max par lancement.
        const pacte = mods?.cond?.pacteCdr ?? 0
        // 🛎️ Carillon (v0.26) : tous les N lancements, la recharge suivante est à moitié prix.
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr) * (1 - pacte) * carillonMult(mods?.cond))
        if (pacte > 0) c.hp = Math.max(1, c.hp - 0.02 * charMaxHp(c))
        manualFire.delete(key)
        // ⏳ CHRONOMANCIEN « Cascade temporelle » : chaque sort lancé rembourse les autres recharges.
        if (d.cmods.cdrOnCast > 0) {
          for (const pid2 of charDeck(c)) {
            if (!pid2 || pid2 === pid) continue
            const k2 = `${c.id}:${pid2}`
            cooldowns.set(k2, Math.max(0, (cooldowns.get(k2) ?? 0) - d.cmods.cdrOnCast))
          }
        }
        lastCastGlobal = { charId: c.id, pid } // 🌀 Écho temporel : mémorise la dernière capacité
        const cast = (mult: number): number => {
          let dd = 0
          // 🩸 Pactes : ×sorts (Pacifiste), dégâts globaux + 🪦 Usure / 💀 Memento.
          const sm = d.cmods.damageMult * d.cmods.spellMult * mult * overloadMult
            * (mods?.pact?.spellMult ?? 1) * runePactOffense(mods?.fightTime ?? 0, mods?.runes, mods?.pact)
          if (p.effect === 'cleave' || p.effect === 'megaCleave') {
            const offFocus = mods?.pact?.offFocusMult ?? 1
            const f0 = focus()
            for (const e of enemies) if (e.hp > 0) dd += fireActive(p, c, d.derived, d.profile, chars, e, d.cmods.hot, sm * (e === f0 ? 1 : offFocus), d.cmods.healToDamage, mods?.cond, mods?.pact)
          } else {
            dd = fireActive(p, c, d.derived, d.profile, chars, focus() ?? enemies[0], d.cmods.hot, sm * (1 + (mods?.pact?.focusBonus ?? 0)), d.cmods.healToDamage, mods?.cond, mods?.pact)
          }
          return dd
        }
        let dealt = cast(1)
        // 💥 Détonation arcanique (v0.26) : tous les N sorts, celui-ci éclabousse le pack (50%).
        if (mods?.cond?.detonationN && dealt > 0) {
          const n = (gemCounters.get('deto') ?? 0) + 1
          if (n >= mods.cond.detonationN) {
            gemCounters.set('deto', 0)
            const t0 = focus()
            const splash = dealt * 0.5
            for (const e of enemies) {
              if (e === t0 || e.hp <= 0) continue
              e.hp = Math.max(0, e.hp - splash)
              totalDealt += splash
              dealt += splash
            }
          } else gemCounters.set('deto', n)
        }
        // 🔔 Pierre d'Écho : tous les N sorts de l'équipe, le suivant résonne une 2e fois (50%).
        const echoN = mods?.cond?.echoN
        if (echoN) {
          const n = (gemCounters.get('echo') ?? 0) + 1
          if (n >= echoN) { gemCounters.set('echo', 0); dealt += cast(0.5) } else gemCounters.set('echo', n)
        }
        if (c.charge && dealt > 0) c.charge.dealt += dealt
      } else {
        cooldowns.set(key, Math.max(0, cd))
        if (!auto && !stunned) manualFire.delete(key)
      }
    })
  })

  // 3b) Vengeance différée : la fenêtre expirée, déchaîne ×mult TOUT le cumul, sur la cible focus.
  for (const c of chars) {
    if (!c.charge || c.charge.remaining > 0) continue
    const tg = focus()
    if (c.hp > 0 && tg && c.charge.dealt > 0) {
      const burst = c.charge.dealt * c.charge.mult * enemyVuln(tg)
      tg.hp = Math.max(0, tg.hp - burst)
      totalDealt += burst
    }
    c.charge = undefined
  }

  // 4) Chaque ennemi vivant frappe la plus haute menace (l'équipe doit survivre au pack).
  let reflectApplied = false
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue
    const liveNow = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
    if (!liveNow.length) break
    let targetI = liveNow[0]
    let best = -1
    for (const i of liveNow) {
      const d = info[i]!
      const dps = d.derived.power * d.derived.attacksPerSecond
      const score = (dps + 1) * d.passives.threatMult
      if (score > best) { best = score; targetI = i }
    }
    const t = chars[targetI]
    const td = info[targetI]!
    // Étourdissement (boss) réduit par la Ténacité de la cible.
    if (enemy.ccDur) {
      enemy.ccCd = (enemy.ccCd ?? 0) - dt
      if (enemy.ccCd <= 0) {
        enemy.ccCd = CC_INTERVAL
        t.stun = Math.max(t.stun ?? 0, enemy.ccDur * (1 - td.derived.tenacity))
      }
    }
    // 🧊 Stase (rune) : la montée en puissance ennemie est gelée les X premières secondes.
    const rampT = Math.max(0, (mods?.fightTime ?? 0) - (mods?.runes?.staseSec ?? 0))
    // v0.35 — ENRAGE DUR du MUR (boss de fin de Palier) : passé `mur.enrageAt`, les dégâts EXPLOSENT
    // (+50 %/s) → course au DPS, l'ossature du mur (DESIGN_v0.35 §6). Depuis `enemy.age` (pas de
    // compounding) ; sans effet sur le farm normal / les packs (pas de `mur`).
    const murAge = enemy.age ?? 0
    const murEnrage = enemy.mur && murAge > enemy.mur.enrageAt
      ? 1 + (murAge - enemy.mur.enrageAt) * MUR_ENRAGE_RAMP : 1
    let effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * rampT) * (mods?.dmgMult ?? 1) * murEnrage
    // 🫧 Latence (rune) : les ennemis frappent moins fort en début de rencontre.
    if (mods?.runes?.latence && (mods?.fightTime ?? 99) <= 8) effDmg *= 1 - mods.runes.latence
    let incoming = incomingDps(
      effDmg, enemy.damageType, td.derived, td.resist,
      enemyReq(enemy, enemy.damageType),
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
      td.cmods.reqReduction,
    ) * dt
    // Même cap que le combat mono-cible : le renvoi ne dépasse jamais 10% des PV max/s.
    if (mods?.reflect && !reflectApplied) { incoming += Math.min(totalDealt * mods.reflect, charMaxHp(t) * 0.10 * dt); reflectApplied = true }
    // v0.26 : 🗼 Tour de garde — une part du flux part vers le plus endurant si la cible chancelle.
    const aliveE = enemies.filter((e) => e.hp > 0).length
    const split = tourGardeSplit(chars, targetI, mods?.cond)
    const parts: [number, number][] = split ? [[targetI, 1 - split.frac], [split.tankI, split.frac]] : [[targetI, 1]]
    for (const [ci, frac] of parts) {
      const cc = chars[ci]
      const cd2 = info[ci]
      if (!cd2 || frac <= 0) continue
      // Chaîne défensive (🧱 Rempart, 🪨 Granit, ⚓ Ancrage, 💫 Sixième sens, 🌂 Paratonnerre)
      // + 🍷 pactes + 🧴 antidote…
      const antid = mods?.content?.antidote
      const dmg = incoming * frac * (mods?.pact?.dmgIn ?? 1)
        * (antid && antid.type === enemy.damageType ? 1 - antid.pct : 1)
        * gemDefenseMult(cc, charMaxHp(cc), {
          cond: mods?.cond, casting: anyCasting, surge: mods?.content?.surge, aliveEnemies: aliveE,
        })
      // …puis Bastion réactif (🔃 Échangeur, 🌵 Cilice) et immunité/bouclier d'absorption.
      const taken = gemDamageHero(cc, dmg, { cond: mods?.cond, attacker: enemy })
      // ÉGIDE « Aegis adaptatif » : être frappé par un type endurcit contre ce type.
      if (cd2.cmods.adaptiveResist && taken > 0) adaptiveAdd(cc.id, enemy.damageType, cd2.cmods.adaptiveResist.gain * dt, cd2.cmods.adaptiveResist.cap)
      if (cd2.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - dmg * cd2.cmods.thorns)
      // 🩸 VENGEANCE (v0.34, Juggernaut) : encaisser génère de la Rage (Combo) ∝ aux PV perdus.
      if (cd2.cmods.damageToRage > 0 && taken > 0) cc.combo = Math.min(5 + cd2.cmods.comboCap, (cc.combo ?? 0) + cd2.cmods.damageToRage * Math.min(0.3, taken / Math.max(1, charMaxHp(cc))) * 8)
    }
    // Techniques signature de CET ennemi (sur la plus haute menace).
    tickEnemyAbilities(enemy, chars, info, dt, mods?.runes)
  }
  // ⏪ Rembobinage (rune) : un héros au bord du gouffre récupère ses recharges (1×/combat).
  runeRembobinage(chars, mods?.runes)
  // 🌀 Écho temporel (rune) : toutes les 30 s, la dernière capacité est relancée gratuitement.
  if (mods?.runes?.echoTemporel) {
    echoTempAcc += dt
    const ft = focus()
    if (echoTempAcc >= 30 && lastCastGlobal && ft) {
      echoTempAcc = 0
      const ci = chars.findIndex((c) => c.id === lastCastGlobal!.charId && c.hp > 0)
      const d = ci >= 0 ? info[ci] : null
      const p = getPower(lastCastGlobal.pid)
      if (d && p && p.kind === 'active') {
        totalDealt += fireActive(p, chars[ci], d.derived, d.profile, chars, ft, d.cmods.hot,
          d.cmods.damageMult * d.cmods.spellMult * mods.runes.echoTemporel, 0, mods?.cond, mods?.pact)
      }
    }
  }

  // 4c) 🤺 Riposte mesurée (v0.26) : le temps sous le feu du pack se mue en contre-attaques (focus).
  if (mods?.cond?.riposteSec) {
    const liveNow = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
    const ft = focus()
    if (liveNow.length && ft) {
      let ti2 = liveNow[0]
      let best2 = -1
      for (const i of liveNow) {
        const d = info[i]!
        const score = (d.derived.power * d.derived.attacksPerSecond + 1) * d.passives.threatMult
        if (score > best2) { best2 = score; ti2 = i }
      }
      totalDealt += gemRiposte(chars[ti2], info[ti2]!, ft, dt, mods?.cond)
    }
  }

  // 5) Régénération ennemie (Vampirique/Sangsue) — annulée par « Hémorragie cosmique ».
  if (mods?.regen) for (const enemy of enemies) if (enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 5b) 🕊️ Sursis : un héros qui vient de tomber survit à 25% PV (👑 Hubris : sans filet).
  const revived = applySursis(chars, mods?.pact?.noSursis ? undefined : mods?.runes?.sursisCd)
  // v0.26 : morts restantes → ⚓ Ancrage brisé, 🎺 Marche perdue, 📜 Testament, 💀 Memento.
  gemDeathEvents(chars, aliveBefore, mods?.cond, mods?.pact)

  // 6) Régénération des persos (+ Métaboliseur d'Égide face à la cible focus) + clamp.
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      // v0.27 (Lot 3) « Mal de l'abîme » : la régén de base est BRIDÉE en raid (content.regenMult)
      // → la vie redevient une ressource, fini le tank qui out-régène tout sans bouger.
      let regen = mh * REGEN_RATE * (1 + d.derived.regenBonus) * regenMult * (mods?.content?.regenMult ?? 1)
      const ft = focus()
      if (d.cmods.surplusRegen > 0 && ft) {
        regen += mh * Math.min(d.cmods.surplusRegen, (resistSurplus(ft, d.resist) / RESIST_DSCALE) * d.cmods.surplusRegen)
      }
      // 💉 Perfusion (v0.26) : sous 50% des PV, la régénération s'emballe.
      if (mods?.cond?.perfusionBonus && c.hp / mh < 0.5) regen *= 1 + mods.cond.perfusionBonus
      // v0.27 (Lot 3) « Blessures mortelles » : pendant la fenêtre de heal-cut (posée par la Nova),
      // la régén s'effondre → un tank ne peut plus éponger juste après une Nova.
      if ((c.healCut ?? 0) > 0) { regen *= HEALCUT_REGEN_MULT; c.healCut = Math.max(0, (c.healCut ?? 0) - dt) }
      // 🍽️ Jeûne / 🧛 Sang vicié : la régénération est coupée.
      if (mods?.pact?.noHeal || mods?.pact?.noRegen) regen = 0
      c.hp = Math.min(mh, c.hp + regen * dt)
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemies, anyAlive: chars.some((c) => c.hp > 0), totalDealt, revived }
}

/** v0.26 : options d'agrégation des gemmes issues de l'arbre du Joaillier — 🔗 Serti conducteur
 *  (2+ gemmes d'une famille sur un héros), 🪩 Mosaïque (3+ familles portées), 📖 Catalogue
 *  (collection complète), 👑 Châsse royale, 🎭 Double allégeance. */
function teamGemOpts(s: Pick<GameState, 'characters' | 'gemsSeen'>, cm: ReturnType<typeof craftMods>): GemModOpts {
  const familyMult: Partial<Record<GemFamily, number>> = {}
  const teamFamilies = new Set<GemFamily>()
  for (const c of s.characters) {
    const per = new Map<GemFamily, number>()
    for (const slot in c.equipment) {
      const it = c.equipment[slot as EquipSlotId]
      for (const g of it?.gems ?? []) {
        const def = g.cond ? getCondGem(g.cond) : undefined
        if (!def) continue
        per.set(def.family, (per.get(def.family) ?? 0) + 1)
        teamFamilies.add(def.family)
      }
    }
    if (cm.sertiConducteur > 0) {
      for (const [f, n] of per) if (n >= 2) familyMult[f] = 1 + cm.sertiConducteur
    }
  }
  let paramMult = 1
  if (cm.mosaique > 0 && teamFamilies.size >= 3) paramMult *= 1 + cm.mosaique
  if (cm.catalogue && COND_GEM_LIST.every((g) => s.gemsSeen.includes(g.id))) paramMult *= 1.02
  return {
    paramMult: paramMult !== 1 ? paramMult : undefined,
    familyMult: Object.keys(familyMult).length ? familyMult : undefined,
    chasseRoyale: cm.chasseRoyale || undefined,
    autoMinor: cm.doubleAllegeance || undefined,
  }
}

function tickDungeon(s: GameState, dt: number, set: (s: GameState) => void) {
  const d = s.dungeon!
  const def = getDungeonDef(d.dungeonId)
  const fightTime = d.fightTime + dt
  const runTime = (d.runTime ?? 0) + dt // horloge du run (défi « Pressé »)
  let enrage = 0
  let reflect = 0
  let regen = dungeonRegen(d.trait, d.level) // identité 'regen' : rampe avec le niveau (nulle au niv 1)
  for (const m of d.modifiers) {
    if (m.enrageRampPerSec) enrage += m.enrageRampPerSec
    if (m.reflectPct) reflect += m.reflectPct // vestige « Réfléchissant » (runs antérieurs à v0.25.x)
    if (m.regenPct) regen += m.regenPct
  }
  // v0.25.x (A) : les affixes de difficulté PAIENT — multiplicateur de récompenses du run.
  const rwMult = d.modifiers.reduce((a, m) => a * (m.rewardMult ?? 1), 1)
  const explodePct = d.modifiers.reduce((a, m) => a + (m.explodePct ?? 0), 0)

  const dCraft = craftMods(s.metiers)
  const dCond = condGemMods(s.characters, dCraft.gemSpec, teamGemOpts(s, dCraft))
  const dRunes = timeRuneMods(equippedTimeRunes(s.characters), dCraft.runisteTempo)
  const dBuffs = activeBrewBuffs(s)
  const dPact = teamPactMods(s, dCraft, dBuffs)
  // 🗝️ Pierre de sceau (v0.26) : +X% de dégâts par modificateur actif · ⚗️ élixir/🛢️ huile d'Officine.
  const dHeroMult = (1 + maitriseBonus(s.bestStage)) * (1 + crescendoBonus(dCond.crescendoCap))
    * (dCond.sceauPct ? 1 + dCond.sceauPct * d.modifiers.length : 1)
    * dBuffs.dmgMult
    * (dBuffs.oil && dBuffs.oil.type === def.element ? 1 + dBuffs.oil.pct : 1)
  const res = partyCombatStepMulti(s.characters, d.enemies, dt, {
    enrage, reflect, regen, fightTime, heroMult: dHeroMult, cond: dCond, runes: dRunes, pact: dPact,
    content: { affixCount: d.modifiers.length, antidote: dBuffs.antidote ?? undefined },
  })
  let chars = res.chars
  const enemies = res.enemies
  let log = s.log
  for (const n of res.revived ?? []) log = pushLog(log, `🕊️ Sursis : ${n} survit in extremis !`, 'info')

  // 💥 Volatile : chaque ennemi mort CE TICK explose (AoE typée sur l'équipe, exigence comprise).
  if (explodePct > 0) {
    let booms = 0
    for (let i = 0; i < enemies.length; i++) {
      if ((d.enemies[i]?.hp ?? 0) > 0 && enemies[i].hp <= 0) {
        chars = applyAoe(chars, enemies[i].damage * explodePct, enemies[i].damageType, enemyReq(enemies[i], enemies[i].damageType))
        booms++
      }
    }
    if (booms > 0) log = pushLog(log, `💥 Volatile : ${booms} explosion${booms > 1 ? 's' : ''} !`, 'death')
  }

  if (!res.anyAlive) {
    crescendoReset() // 📯 Crescendo : l'équipe tombe, le cumul retombe
    const healed = chars.map(fullHeal)
    log = pushLog(log, `💀 Échec dans ${d.name} ! L'équipe bat en retraite.`, 'death')
    const next = { ...s, characters: healed, dungeon: null, log }
    persist(next)
    set(next)
    return
  }

  if (enemies.every((e) => e.hp <= 0)) {
    // 📯 Crescendo & 🛡️ Trésorerie : chaque combat de pack nettoyé compte ses kills.
    crescendoAdd(enemies.length)
    tresorerieShield(chars, dCond.tresorerieCap)
    gemKillEvents(chars, dCond, enemies.length, 1, dRunes, dPact) // 🔔 Glas · 🦷 Fièvre · 🎺 Marche · 🪽 · 🍽️
    const eco = computeGlobalMods(s.upgrades, s.maitrise, achievementBonuses(s.achievements))
    const lv = d.level
    const packXp = enemies.reduce((a, e) => a + (e.xp ?? 0), 0)
    const noGold = d.modifiers.some((m) => m.noGold)

    // --- Récompense PAR COMBAT (chaque combat gagné crédite la ressource du donjon, tout de suite) ---
    let gold = s.gold, essence = s.essence, noyau = s.noyau, poussiere = s.poussiere, sceaux = s.sceaux, orbes = s.orbes, gemDust = s.gemDust
    const earned: Record<string, number> = { ...(d.earned ?? {}) }
    // Accumulateur fractionnaire (ressources rares) → crédite les UNITÉS ENTIÈRES gagnées ce combat.
    const accrue = (key: string, amt: number): number => {
      const prev = earned[key] ?? 0
      earned[key] = prev + amt
      return Math.floor(earned[key]) - Math.floor(prev)
    }
    const fightItems: Item[] = []
    let logBit = ''
    let leveled = false
    // Rendement par combat = part PERFIGHT du rendement total mappé sur les coûts (voir dungeons.ts),
    // × rwMult (v0.25.x : les affixes paient).
    const perFight = (r: 'gold' | 'eclats' | 'noyau' | 'poussiere') => dungeonRunYield(r, lv, d.bestStage ?? s.bestStage) * DUNGEON_YIELD_PERFIGHT_FRAC * rwMult / Math.max(1, d.totalFights)
    switch (def.reward) {
      case 'gold': { if (!noGold) { const g = Math.round(perFight('gold') * eco.goldGain); gold += g; logBit = `+${g.toLocaleString('fr-FR')} or` } break }
      case 'eclats': { const e2 = Math.round(perFight('eclats')); essence += e2; logBit = `+${e2.toLocaleString('fr-FR')} éclats` } break
      case 'noyau': { const n = accrue('noyau', perFight('noyau')); if (n) { noyau += n; logBit = `+${n} 💠` } } break
      case 'poussiere': { const pq = accrue('poussiere', perFight('poussiere')); if (pq) { poussiere += pq; logBit = `+${pq} 🌌` } } break
      // Clés : mêmes règles que les autres ressources (40% au fil des combats, 60% au coffre) —
      // fini le fil exponentiel indexé sur l'XP du pack qui rendait le coffre ridicule.
      case 'sceaux': { const sc = accrue('sceaux', dungeonKeyYield('sceaux', lv) * DUNGEON_YIELD_PERFIGHT_FRAC * rwMult / Math.max(1, d.totalFights)); if (sc) { sceaux += sc; logBit = `+${sc} 🔑` } } break
      case 'orbes': { const ob = accrue('orbes', dungeonKeyYield('orbes', lv) * DUNGEON_YIELD_PERFIGHT_FRAC * rwMult / Math.max(1, d.totalFights)); if (ob) { orbes += ob; logBit = `+${ob} 🔮` } } break
      case 'xp': {
        const xp = Math.round(packXp * DUNGEON_FIGHT_XP_MULT * eco.xpGain * rwMult * (1 + (d.xpPotion ?? 0)))
        chars = chars.map((c) => { if (c.hp <= 0) return c; const nc = grantXp(c, xp); if (nc.level > c.level) leveled = true; return nc })
        earned.xp = (earned.xp ?? 0) + xp
        logBit = `+${xp.toLocaleString('fr-FR')} XP`
        break
      }
      // Cache du Pilleur, drops PAR COMBAT : même fenêtre que le coffre (pic ≤ Légendaire, plafond Artefact).
      case 'stuff': { if (Math.random() < 0.4) { const cw = cacheRarityWindow(lv); fightItems.push(generateItem({ ilvl: dungeonIlvl(lv, s.bestStage), rarity: rollWindowRarity(cw.floor, cw.peak, cw.cap), primaryBias: pickBias(s.characters) })); logBit = '+1 objet' } break }
      // La Géode : la poussière 🔹 coule à chaque combat (la gemme, elle, attend le coffre).
      case 'gemmes': { const gd = accrue('gemDust', geodeDustYield(lv) * DUNGEON_YIELD_PERFIGHT_FRAC * rwMult / Math.max(1, d.totalFights)); if (gd) { gemDust += gd; logBit = `+${gd} 🔹` } } break
    }
    // ✦ Hanté : le Champion du pack vient de tomber → objet de haute rareté (Légendaire garanti, mieux possible).
    if (enemies.some((e) => e.champion)) {
      fightItems.push(generateItem({ ilvl: dungeonIlvl(lv, s.bestStage), luckTier: dungeonLuckTier(lv) + 4, minTier: 6, primaryBias: pickBias(s.characters) }))
      log = pushLog(log, '✦ Champion abattu — son trésor tombe !', 'loot')
    }
    log = pushLog(log, `⚔️ ${def.icon} Combat ${d.current + 1}/${d.totalFights}${logBit ? ` · ${logBit}` : ''}.`, 'kill')
    if (leveled) log = pushLog(log, '⬆ Niveau gagné !', 'level')

    let inventory = s.inventory
    for (const it of fightItems) inventory = [it, ...inventory].slice(0, invMax)
    const codex = fightItems.length ? discoverFromItems(s.codex, fightItems) : s.codex

    const nextIndex = d.current + 1
    if (nextIndex >= d.totalFights) {
      // 🏆 Fragment de Conquête : le boss final du donjon réinitialise les plus longues recharges.
      if (dCond.conquete) resetLongestCooldown(chars)
      fuelReset() // 🜍 Purgateur : fin d'instance, le carburant retombe
      mementoOn = false // 💀 Memento mori : fin du run
      const rareBonus = d.modifiers.reduce((a, m) => a + (m.rareBonus ?? 0), 0)
      const bias = pickBias(s.characters)

      // ⏱️ Pressé : coffre bonifié si le run est bouclé dans le temps imparti (runTime ≤ timerSec).
      const presse = d.modifiers.find((m) => m.timerBonus)
      const presseOk = !!presse && runTime <= (presse.timerSec ?? 0)
      if (presse) {
        log = presseOk
          ? pushLog(log, `⏱️ Pressé RÉUSSI (${Math.round(runTime)}s/${presse.timerSec}s) : coffre +${Math.round((presse.timerBonus ?? 0) * 100)}% !`, 'loot')
          : pushLog(log, `⏱️ Pressé manqué (${Math.round(runTime)}s/${presse.timerSec}s) — coffre normal.`, 'info')
      }
      // Multiplicateur de COFFRE : affixes payants (rwMult) × défi Pressé réussi
      // × 🗺️ Cartographe + ◈ Environnement III × 💰 Potion du pillard (v0.26).
      const chestMult = rwMult * (presseOk ? 1 + (presse?.timerBonus ?? 0) : 1)
        * (1 + (dCond.cartographePct ?? 0) + (dCond.envChestPct ?? 0))
        * (1 + (d.chestPotion ?? 0))

      // --- Coffre : BONUS de fin (montant ÉLEVÉ) de la ressource du donjon, EN PLUS du par-combat ---
      let items: Item[] = []
      let cGold = 0, cEclats = 0, cNoyau = 0, cPous = 0, cSceaux = 0, cOrbes = 0, cXp = earned.xp ?? 0
      let cDust = 0
      let cGem: { id: CondGemId; rank: number } | undefined
      const chestFrac = (1 - DUNGEON_YIELD_PERFIGHT_FRAC) * chestMult // 60% du rendement mappé, × affixes
      switch (def.reward) {
        case 'gold': cGold = noGold ? 0 : Math.round(dungeonRunYield('gold', lv, d.bestStage ?? s.bestStage) * chestFrac * eco.goldGain); break
        case 'eclats': cEclats = Math.round(dungeonRunYield('eclats', lv, d.bestStage ?? s.bestStage) * chestFrac); break
        case 'noyau': cNoyau = Math.round(dungeonRunYield('noyau', lv, d.bestStage ?? s.bestStage) * chestFrac); break
        case 'poussiere': cPous = Math.round(dungeonRunYield('poussiere', lv, d.bestStage ?? s.bestStage) * chestFrac); break
        case 'orbes': cOrbes = Math.round(dungeonKeyYield('orbes', lv) * chestFrac); break
        case 'sceaux': cSceaux = Math.round(dungeonKeyYield('sceaux', lv) * chestFrac); break
        // (🔑 Clés en double appliquée après le switch — voir plus bas.)
        case 'xp': { const bonus = Math.round(1200 * lv * Math.pow(1.12, lv) * chestMult * (1 + (d.xpPotion ?? 0))); chars = chars.map((c) => (c.hp > 0 ? grantXp(c, bonus) : c)); cXp += bonus; break }
        case 'stuff': {
          const ilvl = dungeonIlvl(lv, s.bestStage)
          const count = Math.max(1, Math.round((3 + Math.floor(lv / 2)) * chestMult))
          // v0.24 : FENÊTRE de la Cache (pic ≤ Légendaire, plafond pratique Artefact — même
          // « Avare » ne le perce pas). Au-dessus, seul le « voile » (infime, → Éternel max).
          const cw = cacheRarityWindow(lv)
          for (let i = 0; i < count; i++) {
            const rarity = Math.random() < butinOverChance(lv)
              ? (RARITY_LIST.find((r) => r.tier === butinOverTier())?.id ?? 'patrimoine')
              : rollWindowRarity(
                  Math.min(BUTIN_RARITY_CAP, cw.floor + rareBonus),
                  Math.min(BUTIN_RARITY_CAP, cw.peak + rareBonus),
                  Math.min(BUTIN_RARITY_CAP, cw.cap + rareBonus),
                )
            items.push(generateItem({ ilvl, rarity, primaryBias: bias }))
          }
          break
        }
        // La Géode : gros paquet de poussière 🔹 + chance d'une GEMME de l'aile choisie (pré-recoupée
        // aux hauts niveaux). C'est la seule source de gemme « semi-ciblée » du jeu.
        case 'gemmes': {
          cDust = Math.round(geodeDustYield(lv) * chestFrac)
          if (Math.random() < geodeGemChance(lv)) {
            const g = rollCondGem(d.wing)
            cGem = { id: g.id, rank: Math.min(gemMaxRank(g), geodeGemRank(lv)) }
          }
          break
        }
      }
      // 🔑 Clés en double (rune v0.26) : les clés du coffre peuvent être doublées.
      const dRules = equippedRules(s.characters)
      if ((cSceaux > 0 || cOrbes > 0) && dRules.has('clesDouble') && Math.random() < 0.15 * ruleAmp(dCraft.ruleAmpTier)) {
        cSceaux *= 2
        cOrbes *= 2
        log = pushLog(log, '🔑 Clés en double : le trousseau du coffre est doublé !', 'loot')
      }
      const chest: ChestReward = { dungeonName: d.name, level: lv, items, eclats: cEclats, noyau: cNoyau, gold: cGold, sceaux: cSceaux, orbes: cOrbes, poussiere: cPous, xp: cXp, gemDust: cDust, gem: cGem }

      // 🪄 Rune (v0.25) : drop TRÈS rare en fin de run — la vraie source est le raid (🖋️ Greffier aide).
      let runesOwned = s.runesOwned
      if (Math.random() < dungeonRuneChance(lv, dCraft.greffierMult)) {
        const rd = rollRuneDrop()
        runesOwned = { ...runesOwned, [rd.id]: (runesOwned[rd.id] ?? 0) + 1 }
        log = pushLog(log, `🪄 RUNE TROUVÉE : ${rd.icon} ${rd.name} !`, 'loot')
      }

      // 🛠️ XP implicite : les gemmes/runes portées font travailler Joaillier & Runiste.
      const pm = passiveMetierXp(s, log)
      log = pm.log
      // 🏛️ Conseil : un donjon terminé avance le contrat Expéditionnaire.
      const cp = conseilProgress(s, log, 'donjons')
      log = cp.log

      const healed: Character[] = chars.map(fullHeal)
      const dungeonProgress = { ...s.dungeonProgress, [d.dungeonId]: Math.max(s.dungeonProgress[d.dungeonId] ?? 0, lv) }
      const repeatLeft = d.repeatLeft ?? 0
      // État avec les pools PAR COMBAT déjà crédités (le coffre est un bonus en plus).
      // 📅 totalDungeons += 1 : porté par `base`, donc compté sur les DEUX chemins (auto-farm + normal).
      const base = { ...s, gold, essence, noyau, poussiere, sceaux, orbes, gemDust, inventory, codex, runesOwned, metiers: pm.metiers, conseil: cp.conseil, maitrisePoints: cp.maitrisePoints, totalDungeons: s.totalDungeons + 1 }

      // Auto-farm : on encaisse le coffre directement (sans modal) et on relance.
      if (repeatLeft > 0) {
        const credited = applyChestRewards(base, chest)
        if (credited.sceaux >= def.sceauCost) {
          const ndun = generateDungeon(d.dungeonId, lv, d.bestStage ?? s.bestStage, d.wing)
          ndun.repeatLeft = repeatLeft - 1
          const log3 = pushLog(log, `🔁 Auto-farm : run encaissé · ${repeatLeft} relance${repeatLeft > 1 ? 's' : ''} restante${repeatLeft > 1 ? 's' : ''}.`, 'info')
          const next = { ...base, ...credited, characters: healed, dungeonProgress, sceaux: credited.sceaux - def.sceauCost, dungeon: ndun, log: log3 }
          persist(next)
          set(next)
          return
        }
      }

      const log2 = pushLog(log, `🎉 ${d.name} vaincu ! Un coffre t'attend (bonus de fin).`, 'kill')
      const next = { ...base, characters: healed, dungeon: null, dungeonProgress, pendingChest: chest, log: log2 }
      persist(next)
      set(next)
      return
    }

    // Avance au combat suivant (pools par-combat crédités + accumulateur conservé).
    // ✦ Hanté : le Champion surgit au combat marqué (championAt).
    const nd: ActiveDungeon = {
      ...d,
      current: nextIndex,
      enemies: makeDungeonPack(def, d.level, nextIndex, d.totalFights, d.modifiers, d.bestStage ?? s.bestStage, nextIndex === d.championAt),
      fightTime: 0,
      runTime,
      earned,
    }
    if (nextIndex === d.championAt) log = pushLog(log, '✦ Un Champion vous barre la route !', 'death')
    const next = { ...s, characters: chars, gold, essence, noyau, poussiere, sceaux, orbes, gemDust, inventory, codex, dungeon: nd, log }
    persist(next)
    set(next)
    return
  }

  set({ ...s, characters: chars, dungeon: { ...d, enemies, fightTime, runTime }, log })
}

/** Dégâts de zone (Nova/adds) sur l'équipe, typés : multiplicateur d'exigence par perso.
 *  `onlyIdx` (v0.27) : limite le coup à un seul héros (Estocade — frappe le plus bas en PV). */
function applyAoe(chars: Character[], baseDmg: number, type: DamageType, req = 0, onlyIdx?: number): Character[] {
  return chars.map((c, i) => {
    if (c.hp <= 0 || (onlyIdx != null && i !== onlyIdx)) return c
    const d = charDerived(c)
    const p = charPassives(c)
    const cm = charCombatMods(c)
    const resist = charResist(c)[type] ?? 0
    // Même plafond d'atténuation que les coups normaux (pas d'invincibilité face aux Novas).
    const dmg = baseDmg * resistMult(req, resist) * genericMitigation(d, (1 - p.damageReduction) * (1 - cm.flatDr))
    if ((c.invuln ?? 0) > 0) return c // Phase éthérée : immunité totale
    let amt = dmg
    let absorb = c.absorb
    if (absorb && absorb > 0) { const soak = Math.min(absorb, amt); absorb -= soak; amt -= soak }
    return { ...c, hp: Math.max(0, c.hp - amt), absorb: absorb && absorb > 0 ? absorb : undefined }
  })
}

function tickRaid(s: GameState, dt: number, set: (s: GameState) => void) {
  const r = s.raid!
  const def = getRaidDef(r.raidId)
  const mech = r.mechanics
  const fightTime = r.fightTime + dt

  // --- Mécaniques de pression continue ---
  const drain = mech.includes('leech') ? 0.028 : 0 // Sangsue : le boss se régénère (check de burst)
  const enrage = 0.012 // léger durcissement pour éviter les combats interminables
  // Enrage DUR : passé le délai, les dégâts explosent (check de DPS).
  const overtime = Math.max(0, fightTime - r.berserkAt)
  let dmgMult = 1
  if (mech.includes('berserk') && overtime > 0) dmgMult *= 1 + overtime * 0.6
  // Acharnement : le boss frappe plus fort à mesure qu'il agonise (premier boss VIVANT — duo de l'Abîme).
  const bossIn = r.enemies.find((e) => e.boss && e.hp > 0) ?? r.enemies[0]
  if (mech.includes('execute')) dmgMult *= 1 + (1 - bossIn.hp / Math.max(1, bossIn.maxHp)) * 0.7
  // v0.27 (Lot 3) Forge « Surchauffe » : la forge chauffe à mesure qu'on la martèle → plus tu l'as
  // entamée, plus elle frappe fort (tension DPS↔survie, anti-glass-cannon).
  if (def.id === 'forge') dmgMult *= 1 + Math.min(0.8, (1 - bossIn.hp / Math.max(1, bossIn.maxHp)) * 0.8)

  const rCraft = craftMods(s.metiers)
  const rCond = condGemMods(s.characters, rCraft.gemSpec, teamGemOpts(s, rCraft))
  const rRunes = timeRuneMods(equippedTimeRunes(s.characters), rCraft.runisteTempo)
  const rBuffs = activeBrewBuffs(s)
  const rPact = teamPactMods(s, rCraft, rBuffs)
  const rHeroMult = (1 + maitriseBonus(s.bestStage)) * (1 + crescendoBonus(rCond.crescendoCap))
    * rBuffs.dmgMult
    * (rBuffs.oil && rBuffs.oil.type === r.element ? 1 + rBuffs.oil.pct : 1)
  const res = partyCombatStepMulti(s.characters, r.enemies, dt, {
    enrage, regen: drain, fightTime, dmgMult, heroMult: rHeroMult, cond: rCond, runes: rRunes, pact: rPact,
    // 🏅 Trophée de guerre (v0.26) : la gemme offre ses points de résist à l'équipe EN RAID.
    // v0.27 (Lot 3) « Mal de l'abîme » : régén bridée en raid (la vie redevient une ressource).
    content: { resistBonus: rCond.tropheeRes, regenMult: RAID_REGEN_MULT, antidote: rBuffs.antidote ?? undefined },
  })
  let chars = res.chars
  let enemies = res.enemies
  const aliveBosses = enemies.filter((e) => e.boss && e.hp > 0)
  const boss = aliveBosses[0] ?? enemies[0]
  let log = s.log
  for (const n of res.revived ?? []) log = pushLog(log, `🕊️ Sursis : ${n} survit in extremis !`, 'info')

  // v0.27 (Lot 3) Reliquaire « Avarice » : chaque renfort qui tombe REND 3% des PV au boss (l'avare
  // récupère son dû) → tuer les adds dans le mauvais ordre te punit, l'ordre de kill compte.
  if (def.id === 'reliquaire') {
    const killed = Math.max(0, r.enemies.filter((e) => e.add && e.hp > 0).length - enemies.filter((e) => e.add && e.hp > 0).length)
    if (killed > 0 && boss.hp > 0) {
      boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.03 * killed)
      log = pushLog(log, `🪙 ${boss.name} : Avarice — ${killed} renfort(s) tombé(s), il récupère des PV.`, 'info')
    }
  }

  // Duo de l'Abîme : quand l'un des jumeaux tombe, le survivant entre en FURIE (+50% dégâts).
  if (aliveBosses.length === 1 && !aliveBosses[0].enraged && enemies.some((e) => e.boss && e.hp <= 0)) {
    aliveBosses[0].enraged = true
    aliveBosses[0].damage = Math.round(aliveBosses[0].damage * PAIR_ENRAGE_MULT)
    log = pushLog(log, `💢 FURIE DU SURVIVANT : ${aliveBosses[0].name} s'embrase (+50% dégâts) !`, 'death')
  }
  let novaCd = r.novaCd - dt
  let swarmCd = r.swarmCd - dt
  let rotateCd = r.rotateCd - dt
  let element = r.element
  let rotateIdx = r.rotateIdx

  // Prisme : le boss change de type d'attaque (check de résistances larges).
  if (mech.includes('rotate') && rotateCd <= 0 && r.rotateList.length > 1) {
    rotateCd = 7
    rotateIdx = (rotateIdx + 1) % r.rotateList.length
    element = r.rotateList[rotateIdx]
    for (const b of aliveBosses) b.damageType = element
    log = pushLog(log, `🌈 ${boss.name} bascule en ${DAMAGE_TYPES[element].name} !`, 'info')
  }
  // Nova cataclysmique : grosse AoE typée (check d'EHP/mitigation). NOVA_MULT plat : la difficulté
  // du raid est DÉJÀ dans boss.damage (avant, ×4×baseDifficulty la comptait deux fois).
  if (mech.includes('nova') && novaCd <= 0) {
    // Citadelle « Effondrement » : sous 20% des PV du boss, les Novas s'enchaînent (course EHP↔DPS).
    novaCd = (def.id === 'citadelle' && boss.hp / Math.max(1, boss.maxHp) < 0.2) ? 2 : 6
    chars = applyAoe(chars, boss.damage * NOVA_MULT, element, enemyReq(boss, element))
    // « Blessures mortelles » : la Nova ouvre une fenêtre où les SOINS NE SUIVENT PLUS (heal-cut).
    chars = chars.map((c) => (c.hp > 0 ? { ...c, healCut: HEALCUT_DUR } : c))
    log = pushLog(log, `☄️ ${boss.name} déchaîne une Nova ${DAMAGE_TYPES[element].name} (soins réduits !) !`, 'death')
  }
  // v0.27 (Lot 3) « Estoc primordial » : coup périodique en % des PV MAX qui IGNORE armure/résist/
  // mitigation → punit l'empilement d'EHP & de réduction (le tank « increvable »). Ne mord que sur
  // les combats QUI DURENT (1er estoc à ESTOC_INTERVAL s) — un kill rapide n'est pas concerné.
  if (Math.floor(fightTime / ESTOC_INTERVAL) > Math.floor((fightTime - dt) / ESTOC_INTERVAL)) {
    chars = chars.map((c) => (c.hp > 0 ? { ...c, hp: Math.max(0, c.hp - charMaxHp(c) * ESTOC_PCT) } : c))
    log = pushLog(log, `🗡️ ${boss.name} porte un Estoc primordial (${Math.round(ESTOC_PCT * 100)}% PV max, imparable) !`, 'death')
  }
  // « Frappe partagée » : un gros coup RÉPARTI sur les héros vivants → soloer la frappe = la prendre
  // PLEINE (impose d'avoir ≥2 survivants pour la diluer).
  if (Math.floor(fightTime / FRAPPE_INTERVAL) > Math.floor((fightTime - dt) / FRAPPE_INTERVAL)) {
    const living = chars.filter((c) => c.hp > 0).length
    if (living > 0) {
      chars = applyAoe(chars, (boss.damage * FRAPPE_MULT) / living, element, enemyReq(boss, element))
      log = pushLog(log, `⚔️ ${boss.name} : Frappe partagée (÷${living} survivant${living > 1 ? 's' : ''}) !`, 'death')
    }
  }
  // « Estocade » : frappe le héros le plus BAS en PV (le DPS « protégé » doit aussi survivre).
  if (Math.floor(fightTime / ESTOCADE_INTERVAL) > Math.floor((fightTime - dt) / ESTOCADE_INTERVAL)) {
    let li = -1, lo = Infinity
    chars.forEach((c, i) => { if (c.hp > 0 && c.hp < lo) { lo = c.hp; li = i } })
    if (li >= 0) {
      chars = applyAoe(chars, boss.damage * 2.2, element, enemyReq(boss, element), li)
      log = pushLog(log, `🎯 ${boss.name} : Estocade sur le plus vulnérable !`, 'death')
    }
  }
  // Déferlante : fait SURGIR des renforts réels (combat à plusieurs adversaires).
  // v0.25.x : les rejetons PERSISTENT jusqu'à leur mort (plus d'expiration) — le plafond
  // simultané monte avec le tier (raidMaxAdds) : les ignorer laisse la pression s'empiler.
  if (mech.includes('swarm') && swarmCd <= 0) {
    swarmCd = 5
    const liveAdds = enemies.filter((e) => e.add && e.hp > 0).length
    const toSpawn = Math.max(0, Math.min(2, raidMaxAdds(r.tier) - liveAdds))
    // uid stable (1001+ pour ne JAMAIS percuter l'index des boss en [0]/[1]) + numérotation :
    // sans ça, la liste keyée par index faisait « sauter » les barres quand un rejeton tombait.
    const ADD_TAGS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ']
    let uid = enemies.reduce((m, e) => Math.max(m, e.uid ?? 0), 1000)
    for (let k = 0; k < toSpawn; k++) {
      const add = makeRaidAdd(def, r.tier, element, r.bestStage ?? s.bestStage, s.characters.length)
      add.uid = ++uid
      add.name = `${add.name} ${ADD_TAGS[(uid - 1001) % ADD_TAGS.length]}`
      enemies.push(add)
    }
    if (toSpawn > 0) log = pushLog(log, `🐛 ${toSpawn} renfort(s) surgissent !`, 'death')
  }

  // Renforts : nettoyage des morts (le boss en [0] est toujours conservé). Le décompte de
  // `lifetime` ne s'applique plus qu'aux rejetons d'anciennes sauvegardes (pré-v0.25.x).
  enemies = enemies.filter((e, idx) => {
    if (idx === 0) return true
    if (e.hp <= 0) return false
    if (e.lifetime != null) { e.lifetime -= dt; if (e.lifetime <= 0) return false }
    return true
  })

  if (!chars.some((c) => c.hp > 0)) {
    crescendoReset() // 📯 Crescendo : l'équipe tombe, le cumul retombe
    const healed = chars.map(fullHeal)
    const why = mech.includes('berserk') && overtime > 0 ? ' (enrage mortel — il fallait plus de DPS)' : ''
    log = pushLog(log, `💀 Raid échoué : ${r.name}${why}. L'équipe est anéantie.`, 'death')
    const next = { ...s, characters: healed, raid: null, log }
    persist(next)
    set(next)
    return
  }

  if (boss.hp <= 0) {
    // 🏆 Fragment de Conquête : chaque rencontre de boss vaincue réinitialise les longues recharges.
    if (rCond.conquete) resetLongestCooldown(chars)
    fuelReset() // 🜍 Purgateur : fin d'instance, le carburant retombe
    mementoOn = false // 💀 Memento mori : fin du run
    // 📯 Crescendo & 🛡️ Trésorerie : un boss de raid compte comme un kill.
    crescendoAdd(1)
    tresorerieShield(chars, rCond.tresorerieCap)
    gemKillEvents(chars, rCond, 1, 1, rRunes, rPact) // 🔔 Glas · 🦷 Fièvre · 🎺 Marche · 🪽 · 🍽️
    // v0.23 : un raid = UN affrontement → le boss (ou duo) vaincu, le trésor tombe directement.
    {
      const tier = r.tier
      const ilvl = raidIlvl(def, tier, r.bestStage ?? s.bestStage)
      // v0.24 : fenêtre à pic par tier (DESIGN §4.3) — pic « banal », traîne très rare vers le haut.
      const w = raidRarityWindow(def, tier)
      const count = rollRaidLootCount(def, tier)
      const bias = pickBias(s.characters)
      const items: Item[] = []
      for (let i = 0; i < count; i++) {
        const rarity = rollWindowRarity(w.floor, w.peak, w.cap)
        // L'Abîme : ~30% des objets sont des pièces de la RÉGALIA DU NÉANT (set exclusif).
        if (def.id === 'abysse' && Math.random() < 0.3) {
          const sd = SETS.neant
          const types = Object.keys(sd.pieces) as ItemType[]
          const t = types[Math.floor(Math.random() * types.length)]
          const it = generateItem({ ilvl, rarity, type: t, primaryBias: bias, minStars: 4, ...(t === 'armePrincipale' ? { element: 'ombre' as DamageType } : {}) })
          it.setId = sd.id
          it.name = sd.pieces[t]!
          items.push(it)
          continue
        }
        const lootType = pickRaidLootType(def)
        items.push(generateItem({
          ilvl, rarity, type: lootType, primaryBias: bias, minStars: def.id === 'abysse' ? 4 : 3,
          ...(def.id === 'nexus' ? { biasResist: DAMAGE_TYPE_LIST[Math.floor(Math.random() * DAMAGE_TYPE_LIST.length)] } : {}),
        }))
      }
      const cosmic = Math.random() < raidCosmicChance(def, tier) ? raidCosmicQty(def, tier) : 0
      const chest: ChestReward = {
        dungeonName: `${def.icon} ${def.name} · Tier ${tier}`,
        level: tier,
        items,
        eclats: Math.round(200 * tier * def.baseDifficulty),
        noyau: 3 + tier,
        gold: Math.round(400 * tier * def.baseDifficulty),
        sceaux: 0, // v0.25 : les Sceaux viennent de l'Antre des Failles, pas des raids

        fragments: raidFragments(def, tier),
        poussiere: Math.floor(tier / 2),
        cosmic,
      }
      const healed = chars.map(fullHeal)
      const raidProgress = { ...s.raidProgress, [r.raidId]: Math.max(s.raidProgress[r.raidId] ?? 0, tier) }
      // 🏆 Trophées du raid : la monnaie de passage de tier (≈ 5 clears du tier courant).
      // 🏆 Rune du Trophéiste (v0.26) : chance de doubler la moisson.
      const rRules = equippedRules(s.characters)
      let trophies = raidTrophyGain(def, tier)
      if (rRules.has('tropheiste') && Math.random() < 0.15 * ruleAmp(rCraft.ruleAmpTier)) {
        trophies *= 2
        log = pushLog(log, '🏆 Trophéiste : la moisson de Trophées est DOUBLÉE !', 'loot')
      }
      const raidTrophies = { ...s.raidTrophies, [r.raidId]: (s.raidTrophies[r.raidId] ?? 0) + trophies }
      log = pushLog(log, `🏆 +${trophies} Trophée${trophies > 1 ? 's' : ''} de ${def.name} (total ${raidTrophies[r.raidId]}).`, 'loot')
      const repeatLeft = r.repeatLeft ?? 0

      // Gemme de CONDITION (25% par raid vaincu) — l'autre source est le champion ✦ de farm.
      let gems = s.gems
      let gemsSeen = s.gemsSeen
      if (Math.random() < 0.25) {
        const cg = rollCondGem()
        gems = { ...gems, [condGemKey(cg.id)]: (gems[condGemKey(cg.id)] ?? 0) + 1 }
        if (!gemsSeen.includes(cg.id)) gemsSeen = [...gemsSeen, cg.id]
        log = pushLog(log, `${cg.icon} GEMME DE CONDITION : ${cg.name} !`, 'loot')
      }

      // 🪄 Rune (v0.25) : LE raid est la source des runes — chance qui monte avec le tier (🖋️ Greffier aide).
      let runesOwned = s.runesOwned
      if (Math.random() < raidRuneChance(tier, rCraft.greffierMult)) {
        const rd = rollRuneDrop()
        runesOwned = { ...runesOwned, [rd.id]: (runesOwned[rd.id] ?? 0) + 1 }
        log = pushLog(log, `🪄 RUNE TROUVÉE : ${rd.icon} ${rd.name} !`, 'loot')
      }

      // 🛠️ XP implicite : les gemmes/runes portées font travailler Joaillier & Runiste.
      const pm = passiveMetierXp(s, log)
      log = pm.log
      // 🏛️ Conseil : un raid vaincu avance le contrat Pourfendeur.
      const cp = conseilProgress(s, log, 'raids')
      log = cp.log

      // Auto-raid : s'il reste des relances ET assez d'Orbes, on encaisse le trésor et on relance.
      if (repeatLeft > 0) {
        const credited = applyChestRewards(s, chest)
        if (credited.orbes >= def.orbeCost) {
          const nr = generateRaid(r.raidId, tier, r.bestStage ?? s.bestStage, s.characters.length)
          nr.repeatLeft = repeatLeft - 1
          const log3 = pushLog(log, `🔁 Auto-raid : trésor encaissé${cosmic ? ` (💫 ×${cosmic})` : ''} · ${repeatLeft} relance${repeatLeft > 1 ? 's' : ''} restante${repeatLeft > 1 ? 's' : ''}.`, 'kill')
          const next = { ...s, ...credited, gems, gemsSeen, runesOwned, metiers: pm.metiers, conseil: cp.conseil, maitrisePoints: cp.maitrisePoints, characters: healed, raidProgress, raidTrophies, orbes: credited.orbes - def.orbeCost, raid: nr, log: log3 }
          persist(next)
          set(next)
          return
        }
      }

      log = pushLog(log, `🏆 RAID VAINCU : ${def.name} (Tier ${tier}) !${cosmic ? ` 💫 Éclat cosmique ×${cosmic} !` : ''} Un trésor t'attend.`, 'kill')
      const next = { ...s, gems, gemsSeen, runesOwned, metiers: pm.metiers, conseil: cp.conseil, maitrisePoints: cp.maitrisePoints, characters: healed, raid: null, raidProgress, raidTrophies, pendingChest: chest, log }
      persist(next)
      set(next)
      return
    }
  }

  set({ ...s, characters: chars, raid: { ...r, enemies, fightTime, novaCd, swarmCd, rotateCd, element, rotateIdx }, log })
}

/** Deltas d'état d'un coffre (ressources + inventaire + codex). XP exclue (déjà créditée par combat). */
function applyChestRewards(s: GameState, c: ChestReward): Pick<GameState, 'inventory' | 'codex' | 'essence' | 'noyau' | 'poussiere' | 'cosmic' | 'gold' | 'sceaux' | 'orbes' | 'fragments' | 'gemDust' | 'gems' | 'gemsSeen'> {
  let inventory = s.inventory
  for (const it of c.items) inventory = [it, ...inventory].slice(0, invMax)
  let gems = s.gems
  let gemsSeen = s.gemsSeen
  if (c.gem) {
    const k = condGemKey(c.gem.id, c.gem.rank)
    gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
    if (!gemsSeen.includes(c.gem.id)) gemsSeen = [...gemsSeen, c.gem.id]
  }
  return {
    inventory,
    codex: discoverFromItems(s.codex, c.items),
    essence: s.essence + c.eclats,
    noyau: s.noyau + c.noyau,
    poussiere: s.poussiere + (c.poussiere ?? 0),
    cosmic: s.cosmic + (c.cosmic ?? 0),
    gold: s.gold + c.gold,
    sceaux: s.sceaux + c.sceaux,
    orbes: s.orbes + (c.orbes ?? 0),
    fragments: s.fragments + (c.fragments ?? 0),
    gemDust: s.gemDust + (c.gemDust ?? 0),
    gems,
    gemsSeen,
  }
}

export const useGame = create<GameState>((set, get) => {
  const save = loadSave()
  refreshGlobals(save.upgrades, save.maitrise, save.constellation, save.achievements)

  // Progression hors-ligne : applique les gains accumulés depuis la dernière sauvegarde. v0.31.3 — le
  // récap part dans la ✉ boîte de réception (message « non lu ») au lieu d'un modal plein écran intrusif.
  const elapsed = Date.now() - (save.lastSeen ?? Date.now())
  if (elapsed > 0) {
    const report = simulateOffline(save.characters, save.stage, save.upgrades, elapsed, save.activeBiome, save.maitrise, achievementBonuses(save.achievements))
    if (report) {
      // ✨ Offrande au gouffre (Constellation) : booste les gains hors-ligne.
      const offMult = constellationMods(save.constellation).offlineMult
      if (offMult !== 1) { report.gold = Math.round(report.gold * offMult); report.noyau = Math.round(report.noyau * offMult); report.xp = Math.round(report.xp * offMult) }
      save.gold += report.gold
      save.noyau += report.noyau
      save.sceaux += report.sceaux
      if (report.quint) save.quint = addQuint(save.quint, { [report.quint.type]: report.quint.amount })
      save.characters = save.characters.map((c) => (c.hp > 0 ? grantXp(c, report.xp) : c))
      for (const it of report.items) save.inventory = [it, ...save.inventory].slice(0, invMax)
      save.inbox = [offlineMessage(report, Date.now()), ...save.inbox].slice(0, INBOX_CAP)
    }
  }

  // Automates de forge HORS-LIGNE : même moteur que le tick, avec un grand dt (plafonné 12 h,
  // plein régime — ce sont des machines). Les clés sont consommées run par run.
  const autoLogLines: string[] = []
  if (elapsed > 60_000 && save.automates.length > 0) {
    const offRules = equippedRules(save.characters)
    const offCraft = craftMods(save.metiers)
    const ar = tickAutomates(
      save, Math.min(elapsed, 12 * 3600 * 1000) / 1000,
      offRules.has('econome') ? (offCraft.loiAmplifiee ? 0.25 : 0.15) : 0,
      offCraft.automateDurMult,
      offRules.has('coffresDoubles') ? 0.15 * ruleAmp(offCraft.ruleAmpTier) : 0,
    )
    if (ar) {
      Object.assign(save, ar.eco)
      if (ar.xpEach > 0) save.characters = save.characters.map((c) => (c.hp > 0 ? grantXp(c, ar.xpEach) : c))
      autoLogLines.push(...ar.lines.map((l) => `(hors-ligne) ${l}`))
    }
  }

  // 📅 Quotidien : initialise / fait tourner les contrats du jour si le jour a changé (cold-start).
  {
    const today = todayStr()
    if (save.daily.date !== today) {
      save.daily = rollDaily(save.daily, dailyMetrics(save), today, { bestStage: save.bestStage })
    }
  }
  // 🎉 Event Invasion : initialise / fait tourner l'event de la semaine (cold-start).
  save.event = rollEvent(save.event, save.totalKills)

  return {
    ...save,
    enemy: makeEnemy(save.stage, save.activeBiome),
    log: [
      ...autoLogLines.map((text) => ({ id: logId++, text, kind: 'craft' as LogKind })),
      { id: logId++, text: 'Bienvenue, guerrier. Le combat commence.', kind: 'info' as LogKind },
    ],
    killCount: 0,
    // v0.31.3 — `pendingOffline` n'est plus alimenté (le modal de retour est remplacé par la ✉ inbox) ;
    // le champ et `claimOffline` restent dormants pour ne pas toucher au plan de sauvegarde.
    pendingOffline: null,

    tick: (dt) => {
      let s = get()

      // Automates de forge : avancent en PARALLÈLE de tout le reste (farm, donjon, raid).
      const tickRules = equippedRules(s.characters)
      const tickCraft = craftMods(s.metiers)
      const ar = tickAutomates(
        s, dt,
        tickRules.has('econome') ? (tickCraft.loiAmplifiee ? 0.25 : 0.15) : 0,
        tickCraft.automateDurMult,
        tickRules.has('coffresDoubles') ? 0.15 * ruleAmp(tickCraft.ruleAmpTier) : 0,
      )
      if (ar) {
        let log = s.log
        for (const line of ar.lines) log = pushLog(log, line, 'craft')
        let characters = s.characters
        if (ar.xpEach > 0) characters = characters.map((c) => (c.hp > 0 ? grantXp(c, ar.xpEach) : c))
        s = { ...s, ...ar.eco, characters, log }
        if (ar.completed) persist(s)
      }

      if (s.raid) {
        tickRaid(s, dt, set)
        return
      }
      if (s.dungeon) {
        tickDungeon(s, dt, set)
        return
      }

      // Bonus de biome : Maîtrise des Zones partout + gemme d'ENVIRONNEMENT (🌩️ Orage en
      // Surcharge) et 📯 Crescendo. (v0.25 : Élan du voyageur et gemme Nomade supprimés.)
      const cmodsTick = craftMods(s.metiers)
      const cond = condGemMods(s.characters, cmodsTick.gemSpec, teamGemOpts(s, cmodsTick))
      const runes = timeRuneMods(equippedTimeRunes(s.characters), cmodsTick.runisteTempo)
      const buffs = activeBrewBuffs(s)
      const pact = teamPactMods(s, cmodsTick, buffs)
      const surgedNow = surgeBiome() === s.activeBiome
      // 🧗 Pied du mur (v0.26) : à ≤ 2 paliers du record, le push frappe plus fort.
      const nearRecord = s.stage >= s.bestStage - 2
      const heroMult = (1 + maitriseBonus(s.bestStage))
        * (1 + crescendoBonus(cond.crescendoCap))
        * (surgedNow && cond.orage ? 1 + cond.orage : 1)
        * (nearRecord && cond.piedDuMurPct ? 1 + cond.piedDuMurPct : 1)
        * buffs.dmgMult
        * (buffs.oil && buffs.oil.type === s.activeBiome ? 1 + buffs.oil.pct : 1)
      const res = partyCombatStep(s.characters, s.enemy, dt, {
        heroMult, cond, runes, pact,
        content: { surge: surgedNow, biomeType: s.activeBiome, nearRecord, antidote: buffs.antidote ?? undefined },
      })
      let chars = res.chars
      const enemy = res.enemy
      let log = s.log
      for (const n of res.revived ?? []) log = pushLog(log, `🕊️ Sursis : ${n} survit in extremis !`, 'info')
      for (const n of res.rezzed ?? []) log = pushLog(log, `⛑️ ${n} se relève (35% PV) !`, 'info')

      if (!res.anyAlive) {
        crescendoReset() // 📯 Crescendo : l'équipe tombe, le cumul retombe
        // v0.35 — la mort ne fait JAMAIS retomber sous le PALIER courant : le dernier mur franchi est un
        // CHECKPOINT. Repli de RETREAT_STAGES vagues, borné au plancher du Palier (1re vague du bloc de 10).
        const palierFloor = Math.floor((s.stage - 1) / 10) * 10 + 1
        const stage = Math.max(1, palierFloor, s.stage - RETREAT_STAGES)
        const healed = chars.map(fullHeal)
        log = pushLog(log, `💀 Équipe vaincue ! Repli au palier ${stage}.`, 'death')
        const next = { ...s, characters: healed, stage, enemy: makeEnemy(stage, s.activeBiome), log }
        persist(next)
        set(next)
        return
      }

      if (enemy.hp <= 0) {
        let { stage, bestStage, gold, sceaux, inventory, poussiere, essence } = s
        const boss = isBossStage(stage)
        // ⛑️ Résurrection au palier : un héros tombé (raid abandonné, mort isolée…) se relève à
        // chaque palier RÉSOLU (gagné ici ; perdu = repli plus haut). La mort n'a aucun coût.
        chars = chars.map((c) => (c.hp <= 0 ? fullHeal(c) : c))
        // 📯 Crescendo & 🛡️ Trésorerie : chaque kill nourrit le cumul / blinde le bouclier.
        crescendoAdd(1)
        tresorerieShield(chars, cond.tresorerieCap)
        gemKillEvents(chars, cond, 1, 1, runes, pact) // 🔔 Glas · 🦷 Fièvre · 🎺 Marche · 🪽 · 🍽️
        const eco = computeGlobalMods(s.upgrades, s.maitrise, achievementBonuses(s.achievements))
        // SURCHARGE élémentaire : le biome tournant rapporte +50% or/XP et ×2 quintessence.
        const surged = surgeBiome() === s.activeBiome
        const surgeMult = surged ? SURGE_GOLD_XP_MULT : 1
        // Runes de RÈGLE portées par l'équipe. ◈ Législateur amplifie (étages III/V : ruleAmp).
        const rules = equippedRules(s.characters)
        const loi = cmodsTick.loiAmplifiee
        const amp = ruleAmp(cmodsTick.ruleAmpTier)
        // v0.26 — règles économiques : 🫅 Mécène (or+/XP−), 🎓 Bourse (XP+/or−), 🎉 Saturnales
        // (dimanche réel), 👑 Hubris (pacte : récompenses de farm +).
        const dimanche = rules.has('saturnales') && new Date().getDay() === 0 ? 1 + 0.15 * amp : 1
        const hubris = 1 + (pact?.rewardBonus ?? 0)
        // 🍯 Élixir de fortune + 🜍 Pierre philosophale (relique de compte).
        const philo = s.philosophale ? PHILOSOPHALE_MULT : 1
        const goldRuleMult = (rules.has('mecene') ? 1 + 0.25 * amp : 1) * (rules.has('bourse') ? 0.9 : 1) * dimanche * hubris * buffs.goldMult * philo
        const xpRuleMult = (rules.has('bourse') ? 1 + 0.25 * amp : 1) * (rules.has('mecene') ? 0.9 : 1) * dimanche * hubris
        // Le combat CLASSIQUE n'est plus qu'un filet d'or/butin : la vraie source = donjons & raids.
        const goldGain = Math.round(enemy.xp * CLASSIC_GOLD_MULT * eco.goldGain * surgeMult * goldRuleMult)
        const xpGain = Math.round(enemy.xp * eco.xpGain * CLASSIC_XP_MULT * surgeMult * xpRuleMult)
        gold += goldGain

        chars = chars.map((c) => {
          if (c.hp <= 0) return c
          const nc = grantXp(c, xpGain)
          if (nc.level > c.level) log = pushLog(log, `⬆ ${nc.name} niveau ${nc.level} !`, 'level')
          return nc
        })
        log = pushLog(log, `${s.enemy.name} vaincu ! +${xpGain} XP, +${goldGain} or.`, 'kill')

        // v0.18 : les ressources rares (Noyaux 💠, Orbes 🔮, Poussière 🌌) ne tombent PLUS sur les
        // boss/élites de farm — elles se farment en DONJON dédié (mono-ressource). Le farm classique
        // reste une source de stuff, d'XP et d'un filet d'or.
        const elite = enemy.elite === true
        const champion = enemy.champion === true
        if (champion) log = pushLog(log, '✦ CHAMPION vaincu : butin exceptionnel !', 'kill')
        else if (elite) log = pushLog(log, '◆ Élite vaincue : butin supérieur !', 'kill')
        // Rune du Karma : la malchance s'accumule en chance (+1 cran de rareté / 40 kills sans Épique+, /25 en Législateur).
        const karmaBonus = rules.has('karma') ? Math.min(8, Math.floor(s.killsSinceEpic / (loi ? 25 : 40))) : 0
        // Rune de Transmutation brute : les monstres NORMAUX ne droppent plus d'objets.
        const transmut = rules.has('transmutation')
        // Moins d'objets en combat classique (le farm de stuff se fait en donjon/raid).
        // v0.31 — ONBOARDING : en tout début (palier < 15), CHAQUE kill normal droppe (au lieu de 30%)
        // → un perso nu se gear vite (couplé à l'auto-équip) et survit, au lieu d'enchaîner des kills
        // à vide et de mourir nu.
        const onboardDrop = s.bestStage < 15
        let drops = transmut && !boss && !elite
          ? 0
          : (boss ? 2 : (onboardDrop || Math.random() < 0.30 + eco.lootChance) ? 1 : 0) + (elite ? 1 : 0) + (champion ? 1 : 0)
        // 🔍 Monomanie : 2× moins d'objets… mais de meilleure facture (shift plus bas).
        if (rules.has('monomanie') && drops > 0) drops = Math.random() < 0.5 ? drops : 0
        // 🦷 Loi du talion : les élites/boss lâchent parfois leur butin DEUX fois.
        if ((elite || boss) && rules.has('talion') && Math.random() < 0.12 * amp) {
          drops *= 2
          log = pushLog(log, '🦷 Loi du talion : le butin tombe DEUX fois !', 'loot')
        }
        const bias = pickBias(chars)
        // v0.24 : FENÊTRE de rareté du farm (≤ Légendaire). Élite/champion/boss + karma/chance
        // décalent la fenêtre — toujours sous le plafond (la chasse est en donjon/raid).
        const shift = (boss ? 1 : 0) + (elite ? 1 : 0) + (champion ? 2 : 0)
          + Math.min(2, Math.floor(eco.rarityLuck)) + Math.min(2, karmaBonus)
          + (rules.has('monomanie') ? (amp >= 1.25 ? 2 : 1) : 0)
        // 🕳️ Tisse-châsse : les drops ont une chance accrue de porter une châsse.
        const socketLuck = rules.has('tisseChasse') ? 0.15 * amp : 0
        let codex = s.codex
        let autoRec = 0
        let killsSinceEpic = s.killsSinceEpic + 1
        for (let dd = 0; dd < drops; dd++) {
          // Identité de loot du biome : ~50% dégâts de l'élément, ~25% résistance à l'élément, ~25% neutre.
          const br = Math.random()
          const biomeOpts = br < 0.5 ? { forceDmgType: s.activeBiome } : br < 0.75 ? { biasResist: s.activeBiome } : {}
          const it = generateItem({ ilvl: stageIlvl(stage), rarity: rollFarmRarity(stage, shift), primaryBias: bias, socketLuck, ...biomeOpts })
          // Rune du Karma : un drop Épique+ remet le compteur de pitié à zéro.
          if (RARITIES[it.rarity].tier >= 5) killsSinceEpic = 0
          // Recyclage automatique : tout butin commun sous le seuil part directement en éclats (on garde les uniques).
          if (s.autoRecycle && !it.unique && RARITIES[it.rarity].tier < s.recycleThreshold) {
            essence += Math.round(recycleValue(it) * eco.eclatGain)
            poussiere += recyclePoussiere(it)
            autoRec++
            continue
          }
          inventory = [it, ...inventory].slice(0, invMax)
          if (it.unique) codex = discoverFromItems(codex, [it])
          log = pushLog(log, `Butin : ${it.name}`, 'loot')
        }
        if (autoRec) log = pushLog(log, `♻️ ${autoRec} butin recyclé automatiquement.`, 'craft')
        // v0.31 — auto-équip des slots VIDES (onboarding) sur le perso ACTIF : un perso nu se gear
        // tout seul depuis ses drops (les emplacements déjà remplis ne bougent pas).
        {
          const ai = s.activeChar ?? 0
          if (chars[ai]) {
            const ae = autoEquipEmpties(chars[ai], inventory)
            if (ae.equipped > 0) {
              chars = chars.map((c, i) => (i === ai ? ae.char : c))
              inventory = ae.inventory
              log = pushLog(log, `🎒 ${ae.equipped} objet${ae.equipped > 1 ? 's' : ''} équipé${ae.equipped > 1 ? 's' : ''} (emplacement vide).`, 'loot')
            }
          }
        }

        // Bonus de métier sur les drops (Condensation de l'Alchimiste, Prospection du Joaillier).
        const cmods = cmodsTick
        // Transmutation brute : ×2 sur quintessences/gemmes/poussière (×3 en ◈ Législateur).
        const transmutMult = transmut ? (loi ? 3 : 2) : 1

        // Quintessence élémentaire : ressource ultra-rare du biome (type = celui des monstres).
        // 1% sur un ennemi normal, 5% sur une élite, 10% sur un boss. Farm continu et patient.
        let quint = s.quint
        {
          const qBase = boss ? QUINT_DROP.boss : elite ? QUINT_DROP.elite : QUINT_DROP.normal
          // 🪨 Quartzite (v0.26) : les quintessences du biome coulent plus volontiers.
          const quartz = rules.has('quartzite') ? 1 + 0.4 * amp : 1
          const qChance = qBase * quintTierMult(stage) * (surged ? SURGE_QUINT_MULT : 1) * transmutMult * cmods.quintDropMult * quartz * philo
          if (Math.random() < qChance) {
            const t = s.activeBiome
            quint = { ...quint, [t]: (quint[t] ?? 0) + 1 }
            log = pushLog(log, `${DAMAGE_TYPES[t].icon} Quintessence de ${DAMAGE_TYPES[t].name} récoltée ! (ultra-rare)`, 'loot')
          }
        }

        // 🔹 Poussière de gemme : matière première du Joaillier (taille & recoupe).
        let gems = s.gems
        let gemDust = s.gemDust
        let gemsSeen = s.gemsSeen
        {
          const rank2 = boss ? 'boss' : elite ? 'elite' : 'normal'
          // ⛏️ Veine mère + ⛏️ Prospecteur (v0.26) : les poussières coulent plus souvent/fort.
          const prospecteur = rules.has('prospecteur')
          const dustC = GEM_DUST_DROP.chance[rank2] * transmutMult * cmods.gemDropMult * (1 + (cond.veineMerePct ?? 0)) * philo
          if (Math.random() < dustC) {
            const amt = GEM_DUST_DROP.amount[rank2] * (prospecteur ? 2 : 1)
            gemDust += amt
            log = pushLog(log, `🔹 +${amt} poussière de gemme.`, 'loot')
          }
          // Gemme de CONDITION : drop par FAMILLE selon le biome (Feu/Foudre → Rythme,
          // Ombre/Nature → Flux, Arcane/Froid → Environnement, Physique → Bastion).
          // v0.26 : drops ×0,4 — le drop redevient un événement, la TAILLE/FUSION compensent.
          const gemC = COND_GEM_DROP[rank2] * transmutMult * cmods.gemDropMult * (prospecteur ? 0.5 : 1) * philo
          if (Math.random() < gemC) {
            const cg = rollCondGem(BIOME_GEM_FAMILY[s.activeBiome])
            // 🧿 Collectionneur : la gemme peut tomber directement au rang 2.
            const dropRank = rules.has('collectionneur') && Math.random() < 0.2 * amp ? Math.min(2, gemMaxRank(cg)) : 1
            const k = condGemKey(cg.id, dropRank)
            // 🥅 Tamis : les doublons sont auto-broyés à +20% de poussière.
            if (cmods.tamis && (gems[k] ?? 0) >= 1) {
              const dust = Math.round(grindDust(dropRank) * 1.2 * cmods.grindMult)
              gemDust += dust
              log = pushLog(log, `🥅 Tamis : ${cg.name} en doublon, auto-broyée (+${dust} 🔹).`, 'loot')
            } else {
              gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
              if (!gemsSeen.includes(cg.id)) gemsSeen = [...gemsSeen, cg.id]
              log = pushLog(log, `${cg.icon} GEMME : ${cg.name}${dropRank > 1 ? ` (rang ${dropRank})` : ''} (${cg.family}) — drop de biome !`, 'loot')
            }
          }
        }

        // 🌿 RÉACTIF de biome (v0.26, Officine) : l'herbe du coin, pour les cuves de l'Alchimiste.
        let reagents = s.reagents
        {
          const rank2 = boss ? 'boss' : elite ? 'elite' : 'normal'
          const rChance = REAGENT_DROP[rank2 as 'normal' | 'elite' | 'boss'] * cmods.herboristeMult * philo
          if (Math.random() < rChance) {
            const t = s.activeBiome
            reagents = { ...reagents, [t]: (reagents[t] ?? 0) + 1 }
            log = pushLog(log, `${REAGENTS[t].icon} Réactif : ${REAGENTS[t].name}.`, 'loot')
          }
        }

        // Gemme de CONDITION : les champions ✦ en lâchent parfois (v0.26 : 8%, toutes familles,
        // 👃 Nez du lapidaire : toujours rang 2 minimum).
        if (champion && Math.random() < CHAMPION_GEM_DROP * cmods.gemDropMult) {
          const cg = rollCondGem()
          const rank = cmods.nezLapidaire ? Math.min(gemMaxRank(cg), 2) : 1
          const k = condGemKey(cg.id, rank)
          gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
          if (!gemsSeen.includes(cg.id)) gemsSeen = [...gemsSeen, cg.id]
          log = pushLog(log, `${cg.icon} GEMME DE CONDITION : ${cg.name}${rank > 1 ? ` (rang ${rank})` : ''} ! (champion)`, 'loot')
        }

        // 🏆 Fragment de Conquête : boss/élite vaincu → la plus longue recharge de chacun tombe à zéro.
        if (cond.conquete && (boss || elite)) {
          resetLongestCooldown(chars)
          if (boss) log = pushLog(log, '🏆 Fragment de Conquête : recharges réinitialisées !', 'info')
        }

        // Le verrou de farm fige la progression au palier courant.
        let characters = chars
        let biomeBest = s.biomeBest
        let conseil = s.conseil
        let maitrisePoints = s.maitrisePoints
        if (!s.farmLock) {
          stage += 1
          biomeBest = { ...biomeBest, [s.activeBiome]: Math.max(biomeBest[s.activeBiome] ?? 0, stage) }
          bestStage = Math.max(bestStage, stage)
          // (v0.25 : plus de Sceau tous les 5 paliers — l'Antre des Failles est LA source de Sceaux,
          //  sinon le donjon ne sert à rien. Appoints payants : forge de Sceau, Trousseau du Pilleur.)
          // 🏛️ Conseil : chaque palier gagné avance le contrat Conquérant.
          {
            const cp = conseilProgress({ conseil, maitrisePoints }, log, 'paliers')
            conseil = cp.conseil
            maitrisePoints = cp.maitrisePoints
            log = cp.log
          }
          // Déblocage des personnages.
          if (bestStage >= CHAR2_STAGE && characters.length < 2) {
            characters = [...characters, makeCharacter(RECRUE_NAMES[0], highestLevel(characters), 'agilite')]
            log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[0]} rejoint ton équipe !`, 'level')
          }
          if (bestStage >= CHAR3_STAGE && characters.length < 3) {
            characters = [...characters, makeCharacter(RECRUE_NAMES[1], highestLevel(characters), 'intelligence')]
            log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[1]} rejoint ton équipe !`, 'level')
          }
        }

        // L'échoppe ne se renouvelle plus au boss : rotation horaire gérée dans `tick`.
        // 🍖 Appât à champions (v0.26) : les ✦ rôdent plus souvent.
        const enemyNext = makeEnemy(stage, s.activeBiome, rules.has('appat') ? 1 + 0.35 * amp : 1)
        // 🌠 Étoile d'Overkill : l'excédent du coup fatal entame l'ennemi suivant.
        if (res.overkill > 0) enemyNext.hp = Math.max(1, enemyNext.maxHp - res.overkill)
        if (isBossStage(stage)) log = pushLog(log, `⚔ Un boss vous barre la route : ${enemyNext.name} !`, 'info')

        const next = { ...s, characters, stage, bestStage, biomeBest, conseil, maitrisePoints, gold, sceaux, poussiere, quint, gems, gemDust, gemsSeen, reagents, essence, codex, inventory, killsSinceEpic, enemy: enemyNext, log, killCount: s.killCount + 1, totalKills: s.totalKills + 1 }
        persist(next)
        set(next)
        return
      }

      set({ ...s, characters: chars, enemy, log })
    },

    setStage: (n) => {
      const s = get()
      if (s.dungeon || s.raid) return
      // On ne peut farmer que jusqu'à son RECORD DANS LE BIOME ACTIF.
      const cap = Math.max(1, s.biomeBest[s.activeBiome] ?? 1)
      const stage = Math.max(1, Math.min(cap, Math.round(n)))
      const next = { ...s, stage, enemy: makeEnemy(stage, s.activeBiome) }
      persist(next)
      set(next)
    },

    setBiome: (biome) => {
      const s = get()
      if (s.dungeon || s.raid) return
      if (!BIOME_IDS.includes(biome) || biome === s.activeBiome) return
      if (!biomeUnlocked(biome, s.bestStage, s.bestStage)) return
      // v0.35 — progression GLOBALE : changer de biome GARDE ton Palier (le biome n'est qu'un CANAL
      // d'élément/résistance, pas un monde séparé). Une seule zone, un seul Palier.
      const stage = s.stage
      const next = {
        ...s, activeBiome: biome,
        enemy: makeEnemy(stage, biome),
        log: pushLog(s.log, `🧭 Zone : ${getBiomeDef(biome).icon} ${getBiomeDef(biome).name} (élément ${DAMAGE_TYPES[biome].name}).`, 'info'),
      }
      persist(next)
      set(next)
    },

    // v0.28 — FORCE un biome contre des Fragments : il reste actif ~1 h, puis la rotation reprend.
    lockBiome: (biome) => {
      const s = get()
      if (s.dungeon || s.raid) return
      if (!BIOME_IDS.includes(biome)) return
      if (!biomeUnlocked(biome, s.biomeBest.physique ?? 0, s.bestStage)) return
      if (s.fragments < BIOME_LOCK_FRAGMENTS) return
      const biomeStages = { ...s.biomeStages, [s.activeBiome]: s.stage }
      const stage = Math.max(1, biomeStages[biome] ?? 1)
      const until = Date.now() + BIOME_LOCK_MS
      const next = {
        ...s,
        fragments: s.fragments - BIOME_LOCK_FRAGMENTS,
        activeBiome: biome, biomeStages, stage,
        biomeLockUntil: until,
        nextRotateAt: until, // à la fin du forçage, la rotation aléatoire reprend aussitôt
        enemy: makeEnemy(stage, biome),
        log: pushLog(s.log, `🔒 Biome forcé : ${getBiomeDef(biome).icon} ${getBiomeDef(biome).name} (~${Math.round(BIOME_LOCK_MS / 60000)} min · -${BIOME_LOCK_FRAGMENTS} ✨).`, 'info'),
      }
      persist(next)
      set(next)
    },

    // v0.35 — la ROTATION HORAIRE FORCÉE est DÉSACTIVÉE : le biome est un CHOIX du joueur (l'axe
    // élément/résistance du modèle à mur unique — on prépare le biome que le mur exige). On change de
    // zone via setBiome, jamais subi. (Lot 4 : progression de Palier GLOBALE au lieu de par-biome.)
    rotateBiomeIfDue: () => {
      /* no-op : plus de rotation automatique. */
    },

    toggleFarmLock: () => {
      const s = get()
      const next = { ...s, farmLock: !s.farmLock }
      persist(next)
      set(next)
    },

    setRecycleThreshold: (tier) => {
      const s = get()
      const next = { ...s, recycleThreshold: Math.max(2, Math.min(16, Math.round(tier))) }
      persist(next)
      set(next)
    },

    toggleAutoRecycle: () => {
      const s = get()
      const next = { ...s, autoRecycle: !s.autoRecycle, log: pushLog(s.log, `Recyclage auto ${s.autoRecycle ? 'désactivé' : 'activé'} (sous ${RARITIES[RARITY_LIST.find((r) => r.tier === s.recycleThreshold)?.id ?? 'rare'].name}).`, 'info') }
      persist(next)
      set(next)
    },

    claimOffline: () => {
      set({ ...get(), pendingOffline: null })
    },

    // v0.27 (F3) — l'appli passe en arrière-plan : on horodate + persiste (couvre aussi la fermeture
    // dure, où le cold-start recalculera depuis lastSeen).
    markAway: () => {
      awaySince = Date.now()
      persist(get())
    },
    // v0.27 (F3) — retour au premier plan : crédite les gains hors-ligne du temps en arrière-plan
    // (même logique que le cold-start : applique les gains À L'ÉTAT + récap pendingOffline).
    resumeAway: () => {
      const s = get()
      if (!awaySince) return
      const elapsed = Date.now() - awaySince
      awaySince = 0
      if (elapsed < 60_000) return // sous 1 min : pas de récap (awaySince déjà consommé → pas de double-crédit)
      const report = simulateOffline(s.characters, s.stage, s.upgrades, elapsed, s.activeBiome, s.maitrise, achievementBonuses(s.achievements))
      if (!report) return
      const offMult = constellationMods(s.constellation).offlineMult
      if (offMult !== 1) { report.gold = Math.round(report.gold * offMult); report.noyau = Math.round(report.noyau * offMult); report.xp = Math.round(report.xp * offMult) }
      const next = { ...s }
      next.gold += report.gold
      next.noyau += report.noyau
      next.sceaux += report.sceaux
      if (report.quint) next.quint = addQuint(next.quint, { [report.quint.type]: report.quint.amount })
      next.characters = next.characters.map((c) => (c.hp > 0 ? grantXp(c, report.xp) : c))
      for (const it of report.items) next.inventory = [it, ...next.inventory].slice(0, invMax)
      // v0.31.3 — récap dans la ✉ inbox (message « non lu ») au lieu du modal plein écran.
      next.inbox = [offlineMessage(report, Date.now()), ...next.inbox].slice(0, INBOX_CAP)
      persist(next)
      set(next)
    },

    equip: (itemId, targetSlot) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item) return
      const char = s.characters[s.activeChar]
      if (!char) return
      const candidates = equipSlotsForType(item.type)
      if (!candidates.length) return

      let slot: EquipSlotId
      if (targetSlot && slotAccepts(targetSlot, item.type)) slot = targetSlot
      else {
        const empty = candidates.find((c) => !char.equipment[c.id])
        slot = empty
          ? empty.id
          : candidates.slice().sort((a, b) => itemScore(char.equipment[a.id]!) - itemScore(char.equipment[b.id]!))[0].id
      }

      const equipment: Equipment = { ...char.equipment }
      const previous = equipment[slot]
      equipment[slot] = item
      let inventory = s.inventory.filter((i) => i.id !== itemId)
      if (previous) inventory = [previous, ...inventory]
      const nc = { ...char, equipment }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters, inventory }
      persist(next)
      set(next)
    },

    unequip: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      const item = char?.equipment[slot]
      if (!char || !item) return
      const equipment: Equipment = { ...char.equipment }
      delete equipment[slot]
      const inventory = [item, ...s.inventory].slice(0, invMax)
      const nc = { ...char, equipment }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters, inventory }
      persist(next)
      set(next)
    },

    sell: (itemId) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item || item.locked) return
      const gain = sellValue(item)
      const next = {
        ...s,
        gold: s.gold + gain,
        gems: gemStockAdd(s.gems, item),
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(s.log, `Vendu : ${item.name} (+${gain} or${item.gems?.length ? ', gemmes rendues' : ''}).`, 'gold'),
      }
      persist(next)
      set(next)
    },

    recycle: (itemId) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item || item.locked) return
      const mods = craftMods(s.metiers)
      const gain = Math.round(recycleValue(item) * computeGlobalMods(s.upgrades).eclatGain * mods.recycleMult)
      const pous = recyclePoussiere(item)
      const refund = quintRefund(item, mods.quintRefundFull) // ◈ Catalyseur : 100%
      const essences = { ...s.essences }
      let essLog = ''
      if (item.unique) {
        // ◈ Distillateur : essences d'uniques ×2 au recyclage.
        const eg = essenceGain(RARITIES[item.rarity].tier, item.unique.rank) * (mods.distillateur ? 2 : 1)
        essences[item.unique.id] = (essences[item.unique.id] ?? 0) + eg
        essLog = ` + ${eg} essences de ${getUnique(item.unique.id)?.name ?? 'l\'effet'}`
      }
      const qLog = quintLogSuffix(refund)
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'modify'))
      // v0.25 — XP implicite : fondre le métal nourrit AUSSI le Forgeron (≈30% du gain alchimiste).
      const g2 = gainMetierXp({ metiers: g.metiers, log: g.log }, 'forgeron', Math.max(1, Math.round(metierXpGain(RARITIES[item.rarity].tier, 'modify') * 0.3)))
      const next = {
        ...s,
        essence: s.essence + gain,
        poussiere: s.poussiere + pous,
        quint: addQuint(s.quint, refund),
        gems: gemStockAdd(s.gems, item),
        essences,
        metiers: g2.metiers,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        log: pushLog(g2.log, `Recyclé : ${item.name} (+${gain} éclats${pous ? ` + ${pous} 🌌` : ''}${qLog}${essLog}${item.gems?.length ? ', gemmes rendues' : ''}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    sellAllBelow: (tier) => {
      const s = get()
      let gold = s.gold
      let gems = s.gems
      let count = 0
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier && !bulkProtected(item)) {
          gold += sellValue(item)
          gems = gemStockAdd(gems, item)
          count++
        } else keep.push(item)
      }
      const gained = gold - s.gold
      const next = { ...s, gold, gems, inventory: keep, log: count ? pushLog(s.log, `${count} objet(s) vendu(s) (+${gained} or).`, 'gold') : s.log }
      persist(next)
      set(next)
    },

    recycleAllBelow: (tier) => {
      const s = get()
      const mods = craftMods(s.metiers)
      let essence = s.essence
      let poussiere = s.poussiere
      let quint = s.quint
      let gems = s.gems
      let count = 0
      let xp = 0
      const essences = { ...s.essences }
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier && !bulkProtected(item)) {
          essence += Math.round(recycleValue(item) * mods.recycleMult)
          poussiere += recyclePoussiere(item)
          quint = addQuint(quint, quintRefund(item, mods.quintRefundFull))
          gems = gemStockAdd(gems, item)
          if (item.unique) essences[item.unique.id] = (essences[item.unique.id] ?? 0) + essenceGain(RARITIES[item.rarity].tier, item.unique.rank) * (mods.distillateur ? 2 : 1)
          xp += metierXpGain(RARITIES[item.rarity].tier, 'modify')
          count++
        } else keep.push(item)
      }
      const gained = essence - s.essence
      const g = count ? gainMetierXp(s, 'alchimiste', xp) : { metiers: s.metiers, log: s.log }
      // v0.25 — XP implicite : la fonte de masse nourrit aussi le Forgeron (≈30%).
      const g2 = count ? gainMetierXp({ metiers: g.metiers, log: g.log }, 'forgeron', Math.max(1, Math.round(xp * 0.3))) : g
      const next = { ...s, essence, poussiere, quint, gems, essences, metiers: g2.metiers, inventory: keep, log: count ? pushLog(g2.log, `${count} objet(s) recyclé(s) (+${gained} éclats).`, 'craft') : g2.log }
      persist(next)
      set(next)
    },

    toggleLock: (itemId) => {
      const s = get()
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item) return
      const inventory = s.inventory.map((i) => (i.id === itemId ? { ...i, locked: !i.locked } : i))
      const next = { ...s, inventory, log: pushLog(s.log, `${item.locked ? '🔓 Déverrouillé' : '🔒 Verrouillé'} : ${item.name}.`, 'info') }
      persist(next)
      set(next)
    },

    sellMany: (itemIds) => {
      const s = get()
      const ids = new Set(itemIds)
      let gold = s.gold
      let gems = s.gems
      let count = 0
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (ids.has(item.id) && !item.locked) {
          gold += sellValue(item)
          gems = gemStockAdd(gems, item)
          count++
        } else keep.push(item)
      }
      if (!count) return
      const gained = gold - s.gold
      const next = { ...s, gold, gems, inventory: keep, log: pushLog(s.log, `${count} objet(s) vendu(s) (+${gained} or).`, 'gold') }
      persist(next)
      set(next)
    },

    recycleMany: (itemIds) => {
      const s = get()
      const ids = new Set(itemIds)
      const mods = craftMods(s.metiers)
      let essence = s.essence
      let poussiere = s.poussiere
      let quint = s.quint
      let gems = s.gems
      let count = 0
      let xp = 0
      const essences = { ...s.essences }
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (ids.has(item.id) && !item.locked) {
          essence += Math.round(recycleValue(item) * mods.recycleMult)
          poussiere += recyclePoussiere(item)
          quint = addQuint(quint, quintRefund(item, mods.quintRefundFull))
          gems = gemStockAdd(gems, item)
          if (item.unique) essences[item.unique.id] = (essences[item.unique.id] ?? 0) + essenceGain(RARITIES[item.rarity].tier, item.unique.rank) * (mods.distillateur ? 2 : 1)
          xp += metierXpGain(RARITIES[item.rarity].tier, 'modify')
          count++
        } else keep.push(item)
      }
      if (!count) return
      const gained = essence - s.essence
      const g = gainMetierXp(s, 'alchimiste', xp)
      const g2 = gainMetierXp({ metiers: g.metiers, log: g.log }, 'forgeron', Math.max(1, Math.round(xp * 0.3)))
      const next = { ...s, essence, poussiere, quint, gems, essences, metiers: g2.metiers, inventory: keep, log: pushLog(g2.log, `${count} objet(s) recyclé(s) (+${gained} éclats).`, 'craft') }
      persist(next)
      set(next)
    },

    reforge: (itemId, locked) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item) return
      const mods = craftMods(s.metiers)
      // v0.25 : le prix monte avec les VERROUS choisis (+100%/verrou) et les reforges déjà faites.
      // v0.26 : 🔐 Verrous huilés — le surcoût des verrous est réduit (reforge ciblée moins chère).
      const cost = Math.round(reforgeCost(item, locked.length * mods.verrousMult) * mods.costMult)
      if (s.essence < cost) return
      // Les lignes renforcées à la Quintessence sont protégées (jamais re-tirées, pas facturées).
      const enhanced = item.affixes.map((a, i) => ((a.upgraded ?? 0) > 0 ? i : -1)).filter((i) => i >= 0)
      const allLocked = [...new Set([...locked, ...enhanced])]
      const upd = applyItemPatch(s, itemId, { affixes: reforgeItem(item, allLocked), reforgeCount: (item.reforgeCount ?? 0) + 1 })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = { ...s, ...upd, metiers: g.metiers, essence: s.essence - cost, log: pushLog(g.log, `Reforge : ${item.name} (-${cost} éclats, +${gain} XP 🔨).`, 'craft') }
      persist(next)
      set(next)
    },

    surillvl: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.surillvl) return // débloqué via l'arbre du Forgeron
      const item = findItemById(s, itemId)
      if (!item) return
      // v0.25.x : plafond RELATIF au contenu débloqué (+ marge), sur-coût ×4 par pas au-dessus.
      const content = maxContentIlvl(s.bestStage, s.raidProgress)
      if (item.ilvl + mods.surillvlStep > content + SURILLVL_OVER_MARGIN) return
      const over = Math.max(0, Math.ceil((item.ilvl + mods.surillvlStep - content) / mods.surillvlStep))
      const cost = Math.round(surillvlCost(item, over) * mods.costMult)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, surillvlItem(item, mods.surillvlStep))
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = { ...s, ...upd, metiers: g.metiers, essence: s.essence - cost, log: pushLog(g.log, `Surillvl : ${item.name} → iLvl ${item.ilvl + mods.surillvlStep} (-${cost} éclats, +${gain} XP 🔨).`, 'craft') }
      persist(next)
      set(next)
    },

    ascend: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.ascend) return // débloqué via l'arbre du Forgeron
      const item = findItemById(s, itemId)
      if (!item) return
      // v0.25 : verrou raid — ascensionner VERS un cran t exige un tier de raid ≥ t−8.
      if (craftRaidGate(RARITIES[item.rarity].tier + 1) > bestRaidTier(s.raidProgress)) return
      const patch = ascendItem(item)
      if (!patch) return
      const c = ascendCost(item, contentRarityTier(s.bestStage))
      const m = mods.costMult
      const cost = { eclats: Math.round(c.eclats * m), noyau: Math.round(c.noyau * m), fragments: Math.round((c.fragments ?? 0) * m), poussiere: Math.round((c.poussiere ?? 0) * m), cosmic: Math.round((c.cosmic ?? 0) * m) }
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < cost.fragments || s.poussiere < cost.poussiere || s.cosmic < cost.cosmic) return
      const upd = applyItemPatch(s, itemId, patch)
      if (!upd) return
      const gain = metierXpGain(RARITIES[patch.rarity!].tier, 'ascend', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        noyau: s.noyau - cost.noyau,
        fragments: s.fragments - cost.fragments,
        poussiere: s.poussiere - cost.poussiere,
        cosmic: s.cosmic - cost.cosmic,
        metiers: g.metiers,
        log: pushLog(g.log, `Ascension : ${item.name} → ${RARITIES[patch.rarity!].name} ! (-${cost.noyau} Noyau, +${gain} XP 🔨)`, 'craft'),
      }
      persist(next)
      set(next)
    },

    upgradeUnique: (itemId) => {
      const s = get()
      const item = findItemById(s, itemId)
      if (!item?.unique) return
      const rank = item.unique.rank
      if (rank >= UNIQUE_MAX_RANK) return
      const cost = upgradeCost(rank)
      const have = s.essences[item.unique.id] ?? 0
      if (have < cost.essences || s.essence < cost.eclats) return
      const upd = applyItemPatch(s, itemId, { unique: { id: item.unique.id, rank: rank + 1 } })
      if (!upd) return
      const essences = { ...s.essences, [item.unique.id]: have - cost.essences }
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'modify'))
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        essences,
        metiers: g.metiers,
        log: pushLog(g.log, `Effet amélioré : ${getUnique(item.unique.id)?.name ?? ''} → rang ${rank + 1} !`, 'craft'),
      }
      persist(next)
      set(next)
    },

    transmute: (itemId, newPrimary) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.transmute) return // débloqué via l'arbre du Forgeron
      const item = findItemById(s, itemId)
      if (!item || item.primary === newPrimary) return
      const cost = Math.round(transmuteCost(item) * mods.costMult)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, { primary: newPrimary })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = { ...s, ...upd, metiers: g.metiers, essence: s.essence - cost, log: pushLog(g.log, `Affinité transmutée : ${item.name} → ${newPrimary} (-${cost} éclats, +${gain} XP 🔨).`, 'craft') }
      persist(next)
      set(next)
    },

    enhanceTyped: (itemId, type, kind) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.quint) return // débloqué via l'arbre de l'Alchimiste
      const item = findItemById(s, itemId)
      if (!item) return
      const res = enhanceTypedAffixes(item, type, kind)
      if (!res) return
      // ◈ Catalyseur (v0.25) : les améliorations à la Quintessence coûtent −25%.
      const cost = Math.max(1, Math.round(res.cost * mods.quintCostMult))
      const have = s.quint[type] ?? 0
      if (have < cost) return
      const upd = applyItemPatch(s, itemId, { affixes: res.affixes })
      if (!upd) return
      const m = DAMAGE_TYPES[type]
      const verb = item.affixes.some((a) => a.kind === kind && a.type === type) ? 'renforcée' : 'ajoutée'
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify')
      const g = gainMetierXp(s, 'alchimiste', gain)
      const next = {
        ...s,
        ...upd,
        quint: { ...s.quint, [type]: have - cost },
        metiers: g.metiers,
        log: pushLog(g.log, `${m.icon} Ligne ${kind === 'resist' ? 'Résist.' : 'Dégâts'} ${m.name} ${verb} (-${cost} Quintessence, +${gain} XP ⚗️).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    socketCondGem: (itemId, condId, rank = 1, quality = 1) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.gems) return // débloqué via l'arbre du Joaillier (Sertissage)
      const def = getCondGem(condId)
      const item = findItemById(s, itemId)
      if (!def || !item) return
      if ((item.gems?.length ?? 0) >= itemSockets(item, mods.weaponSocketBonus)) return
      const key = condGemKey(condId, rank, quality)
      if ((s.gems[key] ?? 0) < 1) return
      const upd = applyItemPatch(s, itemId, { gems: [...(item.gems ?? []), condGemInstance(condId, rank, quality)] })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.joaillierXpMult)
      const g = gainMetierXp(s, 'joaillier', gain)
      const next = {
        ...s, ...upd,
        gems: { ...s.gems, [key]: (s.gems[key] ?? 0) - 1 },
        metiers: g.metiers,
        log: pushLog(g.log, `${def.icon} Sertie : ${def.name}${rank > 1 ? ` (rang ${rank})` : ''}${quality !== 1 ? ` ${GEM_QUALITIES[quality].name}` : ''} sur ${item.name} (+${gain} XP 💎).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    unsocketGem: (itemId, index) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.gems) return
      const item = findItemById(s, itemId)
      const gem = item?.gems?.[index]
      if (!item || !gem?.cond) return
      const cost = Math.round(unsocketCost() * mods.unsocketCostMult)
      if (s.essence < cost) return
      const upd = applyItemPatch(s, itemId, { gems: item.gems!.filter((_, i) => i !== index) })
      if (!upd) return
      const q = ((gem.quality === 0 || gem.quality === 2) ? gem.quality : 1) as GemQuality
      const key = condGemKey(gem.cond as CondGemId, gem.rank ?? 1, q)
      const label = getCondGem(gem.cond)?.name ?? 'gemme'
      const next = {
        ...s, ...upd,
        essence: s.essence - cost,
        gems: { ...s.gems, [key]: (s.gems[key] ?? 0) + 1 },
        log: pushLog(s.log, `💎 Désertie : ${label} (-${cost} éclats, gemme rendue avec son rang).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    grindGem: (key) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.broyage) return // nœud « Broyage » de l'arbre du Joaillier
      const parsed = parseCondKey(key)
      if (!parsed || (s.gems[key] ?? 0) < 1) return
      // 🧮 Économat (v0.26) : le broyage rend plus, la qualité joue (±30%).
      const dust = Math.round(grindDust(parsed.rank, parsed.quality) * mods.grindMult)
      const gems = { ...s.gems, [key]: (s.gems[key] ?? 0) - 1 }
      if (gems[key] <= 0) delete gems[key]
      const g = gainMetierXp(s, 'joaillier', metierXpGain(2 + parsed.rank, 'modify', mods.joaillierXpMult))
      const next = {
        ...s, gems, gemDust: s.gemDust + dust, metiers: g.metiers,
        log: pushLog(g.log, `⚒️ Broyée : ${parsed.def.name} → +${dust} 🔹 poussière.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    cutGem: (condId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.taille) return // nœud « Taille » de l'arbre du Joaillier
      const def = getCondGem(condId)
      const cost = Math.round(GEM_CUT_COST * mods.tailleCostMult)
      if (!def || s.gemDust < cost) return
      // v0.26 : la taille roule la QUALITÉ (🤲 Main sûre), peut sortir au rang 2 (💡 Inspiration)
      // et peut produire une 2e gemme de la même famille (✌️ Multitaille).
      const quality = rollCutQuality(mods.mainSure)
      const rank = Math.random() < mods.tailleRank2 ? Math.min(2, gemMaxRank(def)) : 1
      const key = condGemKey(condId, rank, quality)
      let gems = { ...s.gems, [key]: (s.gems[key] ?? 0) + 1 }
      let gemsSeen = s.gemsSeen.includes(def.id) ? s.gemsSeen : [...s.gemsSeen, def.id]
      const g = gainMetierXp(s, 'joaillier', metierXpGain(5, 'create', mods.joaillierXpMult))
      let log = pushLog(
        g.log,
        `✂️ Taillée : ${def.icon} ${def.name}${rank > 1 ? ` rang ${rank}` : ''}${quality !== 1 ? ` — ${GEM_QUALITIES[quality].name} ${GEM_QUALITIES[quality].mark}` : ''} (-${cost} 🔹).`,
        'craft',
      )
      if (mods.multitaille > 0 && Math.random() < mods.multitaille) {
        const extra = rollCondGem(def.family)
        const k2 = condGemKey(extra.id)
        gems = { ...gems, [k2]: (gems[k2] ?? 0) + 1 }
        if (!gemsSeen.includes(extra.id)) gemsSeen = [...gemsSeen, extra.id]
        log = pushLog(log, `✌️ Multitaille : ${extra.icon} ${extra.name} en bonus !`, 'craft')
      }
      const next = { ...s, gemDust: s.gemDust - cost, gems, gemsSeen, metiers: g.metiers, log }
      persist(next)
      set(next)
    },

    buyGem: (condId) => {
      // 🛒 (v0.28 B2) Échoppe de base — accessible SANS le Joaillier, mais plus chère que la Taille
      // (pas de qualité/rang/multitaille) : donne un usage à la Poussière de gemme aux non-joailliers.
      const s = get()
      const def = getCondGem(condId)
      if (!def) return
      const cost = GEM_CUT_COST * 2
      if (s.gemDust < cost) return
      const key = condGemKey(condId, 1, 1)
      const gems = { ...s.gems, [key]: (s.gems[key] ?? 0) + 1 }
      const gemsSeen = s.gemsSeen.includes(def.id) ? s.gemsSeen : [...s.gemsSeen, def.id]
      const next = { ...s, gems, gemDust: s.gemDust - cost, gemsSeen, log: pushLog(s.log, `🛒 Gemme achetée : ${def.icon} ${def.name} (-${cost} 🔹).`, 'craft') }
      persist(next)
      set(next)
    },

    fuseGems: (key) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.fusion) return // nœud « Fusion » de l'arbre du Joaillier
      const parsed = parseCondKey(key)
      if (!parsed || (s.gems[key] ?? 0) < GEM_FUSE_COUNT) return
      if (parsed.rank >= gemMaxRank(parsed.def)) return
      const cost = Math.round(GEM_FUSE_COST * mods.fuseCostMult)
      if (s.gemDust < cost) return
      const outKey = condGemKey(parsed.def.id, parsed.rank + 1, parsed.quality)
      const gems = { ...s.gems, [key]: (s.gems[key] ?? 0) - GEM_FUSE_COUNT }
      if (gems[key] <= 0) delete gems[key]
      gems[outKey] = (gems[outKey] ?? 0) + 1
      const gain = metierXpGain(4 + parsed.rank, 'ascend', mods.joaillierXpMult)
      const g = gainMetierXp(s, 'joaillier', gain)
      const next = {
        ...s, gems, gemDust: s.gemDust - cost, metiers: g.metiers,
        log: pushLog(g.log, `🔥 Fusion : 3× ${parsed.def.name} → rang ${parsed.rank + 1} (-${cost} 🔹, +${gain} XP 💎).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    fuseAllGems: () => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.fusion) return
      const cost1 = Math.round(GEM_FUSE_COST * mods.fuseCostMult)
      const gems: Record<string, number> = { ...s.gems }
      let gemDust = s.gemDust
      let fusions = 0
      let totalXp = 0
      // Boucle : on fusionne le premier lot éligible, puis on rebalaie (les résultats peuvent
      // redevenir éligibles → cascade). Garde-fou d'itérations + arrêt si la poussière manque.
      for (let guard = 0; guard < 2000; guard++) {
        if (gemDust < cost1) break
        let found: { key: string; parsed: NonNullable<ReturnType<typeof parseCondKey>> } | null = null
        for (const k in gems) {
          if ((gems[k] ?? 0) < GEM_FUSE_COUNT) continue
          const p = parseCondKey(k)
          if (!p || p.rank >= gemMaxRank(p.def)) continue
          found = { key: k, parsed: p }
          break
        }
        if (!found) break
        const { parsed } = found
        const outKey = condGemKey(parsed.def.id, parsed.rank + 1, parsed.quality)
        gems[found.key] -= GEM_FUSE_COUNT
        if (gems[found.key] <= 0) delete gems[found.key]
        gems[outKey] = (gems[outKey] ?? 0) + 1
        gemDust -= cost1
        totalXp += metierXpGain(4 + parsed.rank, 'ascend', mods.joaillierXpMult)
        fusions++
      }
      if (!fusions) return
      const g = gainMetierXp(s, 'joaillier', totalXp)
      const spent = s.gemDust - gemDust
      const next = {
        ...s, gems, gemDust, metiers: g.metiers,
        log: pushLog(g.log, `🔥 Fusion globale : ${fusions} fusion(s) effectuée(s) (-${spent} 🔹, +${totalXp} XP 💎).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    corruptGem: (key) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.corruption) return // nœud « Corruption » de l'arbre du Joaillier
      const parsed = parseCondKey(key)
      if (!parsed || (s.gems[key] ?? 0) < 1) return
      if (parsed.rank >= gemMaxRank(parsed.def)) return
      const cost = Math.round(GEM_CORRUPT_COST * (mods.corruptSafe ? 2 : 1))
      if (s.gemDust < cost) return
      const [up, , destroy] = corruptOdds(mods.pacteLapidaire)
      const r = Math.random()
      const gems = { ...s.gems }
      let gemDust = s.gemDust - cost
      let outcome: string
      if (r < up) {
        gems[key] = (gems[key] ?? 0) - 1
        if (gems[key] <= 0) delete gems[key]
        const outKey = condGemKey(parsed.def.id, parsed.rank + 1, parsed.quality)
        gems[outKey] = (gems[outKey] ?? 0) + 1
        outcome = `✨ RÉUSSIE — rang ${parsed.rank + 1} !`
      } else if (!mods.corruptSafe && r < up + destroy) {
        gems[key] = (gems[key] ?? 0) - 1
        if (gems[key] <= 0) delete gems[key]
        const dust = grindDust(parsed.rank, parsed.quality)
        gemDust += dust
        outcome = `💔 la gemme VOLE EN ÉCLATS (+${dust} 🔹)…`
      } else {
        outcome = '😮‍💨 rien ne se passe.'
      }
      const g = gainMetierXp(s, 'joaillier', metierXpGain(3 + parsed.rank, 'modify', mods.joaillierXpMult))
      const next = {
        ...s, gems, gemDust, metiers: g.metiers,
        log: pushLog(g.log, `🫦 Corruption de ${parsed.def.name} : ${outcome}`, 'craft'),
      }
      persist(next)
      set(next)
    },

    drillSocket: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.percage) return // nœud « Perçage » de l'arbre du Joaillier
      const item = findItemById(s, itemId)
      if (!item || item.drilled) return
      const current = itemSockets(item, 0)
      if (current >= 3) return
      const cost = drillCost(RARITIES[item.rarity].tier)
      if (s.gemDust < cost.dust || s.gold < cost.gold) return
      const upd = applyItemPatch(s, itemId, { sockets: current + 1, drilled: true })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'ascend', mods.joaillierXpMult)
      const g = gainMetierXp(s, 'joaillier', gain)
      const next = {
        ...s, ...upd,
        gemDust: s.gemDust - cost.dust,
        gold: s.gold - cost.gold,
        metiers: g.metiers,
        log: pushLog(g.log, `🪛 PERCÉE : ${item.name} gagne une châsse (-${cost.dust} 🔹, -${cost.gold.toLocaleString('fr-FR')} or, +${gain} XP 💎).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    tradeGems: (keys, targetId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.marcheAuxPierres) return
      const today = Math.floor(Date.now() / 86_400_000)
      if (s.lastStoneTrade >= today) return // 1 échange par jour réel
      if (keys.length !== 3) return
      const target = getCondGem(targetId)
      if (!target) return
      // Vérifie le stock (les clés peuvent se répéter : il faut le compte cumulé).
      const need = new Map<string, number>()
      for (const k of keys) need.set(k, (need.get(k) ?? 0) + 1)
      const parsedAll: { rank: number }[] = []
      for (const [k, n] of need) {
        const p = parseCondKey(k)
        if (!p || (s.gems[k] ?? 0) < n) return
        for (let i = 0; i < n; i++) parsedAll.push({ rank: p.rank })
      }
      const rank = Math.min(...parsedAll.map((p) => p.rank))
      const gems = { ...s.gems }
      for (const [k, n] of need) {
        gems[k] = (gems[k] ?? 0) - n
        if (gems[k] <= 0) delete gems[k]
      }
      const outKey = condGemKey(target.id, Math.min(rank, gemMaxRank(target)))
      gems[outKey] = (gems[outKey] ?? 0) + 1
      const gemsSeen = s.gemsSeen.includes(target.id) ? s.gemsSeen : [...s.gemsSeen, target.id]
      const g = gainMetierXp(s, 'joaillier', metierXpGain(5, 'modify', mods.joaillierXpMult))
      const next = {
        ...s, gems, gemsSeen, lastStoneTrade: today, metiers: g.metiers,
        log: pushLog(g.log, `⚖️ Marché aux pierres : 3 gemmes troquées contre ${target.icon} ${target.name}${rank > 1 ? ` (rang ${rank})` : ''}.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    recutGem: (itemId, index) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.recoupe) return // nœud « Recoupe » de l'arbre du Joaillier
      const item = findItemById(s, itemId)
      const gem = item?.gems?.[index]
      if (!item || !gem?.cond) return
      const def = getCondGem(gem.cond)
      if (!def) return
      const rank = gem.rank ?? 1
      if (rank >= gemMaxRank(def)) return
      const cost = recutCost(rank)
      if (s.gemDust < cost) return
      const gemsArr = item.gems!.map((x, i) => (i === index ? { ...x, rank: rank + 1 } : x))
      const upd = applyItemPatch(s, itemId, { gems: gemsArr })
      if (!upd) return
      const gain = metierXpGain(4 + rank, 'ascend')
      const g = gainMetierXp(s, 'joaillier', gain)
      const next = {
        ...s, ...upd,
        gemDust: s.gemDust - cost,
        metiers: g.metiers,
        log: pushLog(g.log, `🔬 Recoupe : ${def.name} → rang ${rank + 1} (-${cost} 🔹, +${gain} XP 💎).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    enchantItem: (itemId, enchantId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.enchant) return // débloqué via l'arbre du Runiste (Gravure)
      const def = getEnchant(enchantId)
      const item = findItemById(s, itemId)
      if (!def || !item || item.enchant === enchantId) return
      if (def.rule && !mods.ruleRunes) return // runes de RÈGLE : nœud « Lois du monde »
      // 🩸 Pactes (v0.26) : nœud « Sang d'encre » requis, et UN SEUL pacte actif par équipe
      // (deux via « Double pacte ») — un pacte différent déjà porté bloque la gravure.
      if (def.pact) {
        if (!mods.pactes) return
        const worn = equippedPacts(s.characters).filter((p) => p !== def.pact)
        if (worn.length >= (mods.doublePacte ? 2 : 1)) return
      }
      // v0.25 (option A) : la gravure CONSOMME une rune POSSÉDÉE (drop de raid/donjon).
      if ((s.runesOwned[enchantId] ?? 0) < 1) return
      const raw = enchantCost(def, item)
      const cost = { eclats: Math.round(raw.eclats * mods.enchantCostMult), poussiere: Math.round(raw.poussiere * mods.enchantCostMult) }
      if (s.essence < cost.eclats || s.poussiere < cost.poussiere) return
      const upd = applyItemPatch(s, itemId, { enchant: enchantId })
      if (!upd) return
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.runisteXpMult)
      const g = gainMetierXp(s, 'runiste', gain)
      const next = {
        ...s, ...upd,
        essence: s.essence - cost.eclats,
        poussiere: s.poussiere - cost.poussiere,
        runesOwned: { ...s.runesOwned, [enchantId]: (s.runesOwned[enchantId] ?? 0) - 1 },
        metiers: g.metiers,
        log: pushLog(g.log, `🪄 Rune gravée : ${def.icon} ${def.name} sur ${item.name} (rune consommée, -${cost.eclats} ♦${cost.poussiere ? `, -${cost.poussiere} 🌌` : ''}, +${gain} XP 🪄).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    eraseRune: (enchantId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.effacement) return
      const def = getEnchant(enchantId)
      if (!def || (s.runesOwned[enchantId] ?? 0) < 1) return
      const frags = eraseFragments(def)
      const runesOwned = { ...s.runesOwned, [enchantId]: (s.runesOwned[enchantId] ?? 0) - 1 }
      if (runesOwned[enchantId] <= 0) delete runesOwned[enchantId]
      const g = gainMetierXp(s, 'runiste', metierXpGain(3, 'modify', craftMods(s.metiers).runisteXpMult))
      const next = {
        ...s, runesOwned, runeFragments: s.runeFragments + frags, metiers: g.metiers,
        log: pushLog(g.log, `🧽 Effacée : ${def.icon} ${def.name} → +${frags} Fragment${frags > 1 ? 's' : ''} runique${frags > 1 ? 's' : ''} 🜁.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    forgeRune: (enchantId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.forgeRunique) return
      const def = getEnchant(enchantId)
      if (!def) return
      if (def.pact && !mods.pactes) return // les pactes exigent « Sang d'encre »
      const crafted = s.runeCrafted[enchantId] ?? 0
      const cost = runeForgeCost(def, crafted)
      if (s.runeFragments < cost.fragments || s.poussiere < cost.poussiere || s.gold < cost.gold || s.cosmic < cost.cosmic) return
      const g = gainMetierXp(s, 'runiste', metierXpGain(def.pact ? 12 : def.rule ? 8 : 6, 'create', mods.runisteXpMult))
      const next = {
        ...s,
        runeFragments: s.runeFragments - cost.fragments,
        poussiere: s.poussiere - cost.poussiere,
        gold: s.gold - cost.gold,
        cosmic: s.cosmic - cost.cosmic,
        runesOwned: { ...s.runesOwned, [enchantId]: (s.runesOwned[enchantId] ?? 0) + 1 },
        runeCrafted: { ...s.runeCrafted, [enchantId]: crafted + 1 },
        metiers: g.metiers,
        log: pushLog(g.log, `🔨 FORGE RUNIQUE : ${def.icon} ${def.name} ! (prochain exemplaire ×1,5)`, 'craft'),
      }
      persist(next)
      set(next)
    },

    gambleRune: () => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.surchargeRunique || s.runeFragments < RUNE_GAMBLE_COST) return
      const def = rollRuneDrop() // jamais un pacte
      const g = gainMetierXp(s, 'runiste', metierXpGain(4, 'create', mods.runisteXpMult))
      const next = {
        ...s,
        runeFragments: s.runeFragments - RUNE_GAMBLE_COST,
        runesOwned: { ...s.runesOwned, [def.id]: (s.runesOwned[def.id] ?? 0) + 1 },
        metiers: g.metiers,
        log: pushLog(g.log, `🎲 Surcharge runique : ${def.icon} ${def.name} !`, 'craft'),
      }
      persist(next)
      set(next)
    },

    experiment: (a, b) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.officine) return
      if ((s.reagents[a] ?? 0) < EXPERIMENT_COST || (s.reagents[b] ?? 0) < EXPERIMENT_COST) return
      if (a === b && (s.reagents[a] ?? 0) < EXPERIMENT_COST * 2) return
      const reagents = { ...s.reagents, [a]: (s.reagents[a] ?? 0) - EXPERIMENT_COST }
      reagents[b] = (reagents[b] ?? 0) - EXPERIMENT_COST
      const def = recipeForPair(a, b)
      let log = s.log
      let alchemyRecipes = s.alchemyRecipes
      let g = { metiers: s.metiers, log }
      if (def && !alchemyRecipes.includes(def.id)) {
        alchemyRecipes = [...alchemyRecipes, def.id]
        g = gainMetierXp(s, 'alchimiste', metierXpGain(10, 'create', mods.alchimisteXpMult))
        log = pushLog(g.log, `🧪 EURÊKA ! Recette découverte : ${def.icon} ${def.name} — ${def.desc}`, 'craft')
      } else if (def) {
        log = pushLog(log, `🧪 ${REAGENTS[a].icon}+${REAGENTS[b].icon} : tu connais déjà cette recette (${def.name}).`, 'craft')
      } else {
        g = gainMetierXp(s, 'alchimiste', metierXpGain(2, 'modify', mods.alchimisteXpMult))
        log = pushLog(g.log, `🧪 ${REAGENTS[a].icon}+${REAGENTS[b].icon} : fiasco fumant — rien à en tirer.`, 'craft')
      }
      const next = { ...s, reagents, alchemyRecipes, metiers: g.metiers, log }
      persist(next)
      set(next)
    },

    brewStart: (recipeId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.officine) return
      const def = getBrew(recipeId)
      if (!def || !s.alchemyRecipes.includes(recipeId)) return
      if (s.cuvesEnCours.length >= mods.cuves) return
      const [a, b] = def.recipe
      const needA = def.cost + (a === b ? def.cost : 0)
      if ((s.reagents[a] ?? 0) < needA || (a !== b && (s.reagents[b] ?? 0) < def.cost)) return
      // 🔁 Double distillation : chance de ne rien consommer.
      const free = mods.doubleDistillation > 0 && Math.random() < mods.doubleDistillation
      const reagents = { ...s.reagents }
      if (!free) {
        reagents[a] = (reagents[a] ?? 0) - def.cost
        reagents[b] = (reagents[b] ?? 0) - def.cost
      }
      const next = {
        ...s, reagents,
        cuvesEnCours: [...s.cuvesEnCours, { recipeId, startedAt: Date.now() }],
        log: pushLog(s.log, `🫙 Brassin lancé : ${def.icon} ${def.name} (à point dans ~${Math.round(def.brewMin * mods.brewTimeMult)} min${free ? ' · 🔁 réactifs préservés !' : ''}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    brewCollect: (idx) => {
      const s = get()
      const mods = craftMods(s.metiers)
      const cuve = s.cuvesEnCours[idx]
      if (!cuve) return
      const def = getBrew(cuve.recipeId)
      if (!def) {
        const next = { ...s, cuvesEnCours: s.cuvesEnCours.filter((_, i) => i !== idx) }
        persist(next)
        set(next)
        return
      }
      const elapsedMin = (Date.now() - cuve.startedAt) / 60_000
      let quality = brewQualityAt(def, elapsedMin, mods.brewTimeMult)
      // ✋ Main du maître brasseur : chance de gagner un cran de qualité.
      if (quality < 2 && mods.brewCrit > 0 && Math.random() < mods.brewCrit) quality = (quality + 1) as BrewQuality
      // 🍾 Millésime : seules les récoltes PARFAITES peuvent passer à la postérité.
      if (quality === 2 && Math.random() < millesimeChance(mods.grandsCrus)) quality = 3
      const count = def.charges ?? 1
      const key = brewKey(def.id, quality)
      const q = BREW_QUALITIES[quality]
      const gain = metierXpGain(5 + quality * 2, 'create', mods.alchimisteXpMult)
      const g = gainMetierXp(s, 'alchimiste', gain)
      const next = {
        ...s,
        cuvesEnCours: s.cuvesEnCours.filter((_, i) => i !== idx),
        brews: { ...s.brews, [key]: (s.brews[key] ?? 0) + count },
        metiers: g.metiers,
        log: pushLog(g.log, `${def.icon} Récolte : ${def.name} ${q.mark} ${q.name}${quality === 3 ? ' — MILLÉSIME !' : ''} ×${count} (+${gain} XP ⚗️).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    drinkElixir: (key) => {
      const s = get()
      const parsed = parseBrewKey(key)
      if (!parsed || parsed.def.kind !== 'elixir' || (s.brews[key] ?? 0) < 1) return
      const mods = craftMods(s.metiers)
      const q = BREW_QUALITIES[parsed.quality]
      // 📖 Pharmacopée : +5% de durée par recette découverte.
      const durMult = (mods.pharmacopee ? 1 + 0.05 * s.alchemyRecipes.length : 1) * q.mult
      const brews = { ...s.brews, [key]: (s.brews[key] ?? 0) - 1 }
      if (brews[key] <= 0) delete brews[key]
      const until = Date.now() + (parsed.def.durMin ?? 45) * 60_000 * durMult
      const next = {
        ...s, brews,
        elixirActive: { id: parsed.def.id, quality: parsed.quality, until },
        log: pushLog(s.log, `🧪 ${parsed.def.name} ${q.mark} bu — effet ${q.mult !== 1 ? `×${q.mult} ` : ''}pendant ~${Math.round((until - Date.now()) / 60_000)} min.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    armPotion: (key) => {
      const s = get()
      const parsed = parseBrewKey(key)
      if (!parsed || parsed.def.kind !== 'potion' || (s.brews[key] ?? 0) < 1) return
      const q = BREW_QUALITIES[parsed.quality]
      const brews = { ...s.brews, [key]: (s.brews[key] ?? 0) - 1 }
      if (brews[key] <= 0) delete brews[key]
      const patch: Partial<GameState> = {}
      if (parsed.def.id === 'potionGarde') patch.armedRaidShield = 0.25 * q.mult
      else if (parsed.def.id === 'potionPillard') patch.armedChestBonus = 0.25 * q.mult
      else if (parsed.def.id === 'potionErudit') patch.armedXpBonus = 0.3 * q.mult
      const next = {
        ...s, brews, ...patch,
        log: pushLog(s.log, `${parsed.def.icon} ${parsed.def.name} ${q.mark} ARMÉE — consommée à la prochaine entrée.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    useOil: (key, type) => {
      const s = get()
      const parsed = parseBrewKey(key)
      if (!parsed || parsed.def.kind !== 'huile' || (s.brews[key] ?? 0) < 1) return
      const mods = craftMods(s.metiers)
      const q = BREW_QUALITIES[parsed.quality]
      const durMult = (mods.pharmacopee ? 1 + 0.05 * s.alchemyRecipes.length : 1)
      const brews = { ...s.brews, [key]: (s.brews[key] ?? 0) - 1 }
      if (brews[key] <= 0) delete brews[key]
      const next = {
        ...s, brews,
        oilActive: { type, pct: 0.12 * q.mult, until: Date.now() + (parsed.def.durMin ?? 30) * 60_000 * durMult },
        log: pushLog(s.log, `🛢️ Huile ${DAMAGE_TYPES[type].name} appliquée : +${Math.round(12 * q.mult)}% quand l'élément du contenu correspond.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    useAntidote: (key, type) => {
      const s = get()
      const parsed = parseBrewKey(key)
      if (!parsed || parsed.def.kind !== 'antidote' || (s.brews[key] ?? 0) < 1) return
      const mods = craftMods(s.metiers)
      const q = BREW_QUALITIES[parsed.quality]
      const durMult = (mods.pharmacopee ? 1 + 0.05 * s.alchemyRecipes.length : 1)
      const brews = { ...s.brews, [key]: (s.brews[key] ?? 0) - 1 }
      if (brews[key] <= 0) delete brews[key]
      const next = {
        ...s, brews,
        antidoteActive: { type, pct: Math.min(0.5, 0.15 * q.mult), until: Date.now() + (parsed.def.durMin ?? 30) * 60_000 * durMult },
        log: pushLog(s.log, `🧴 Antidote ${DAMAGE_TYPES[type].name} bu : −${Math.round(Math.min(50, 15 * q.mult))}% des dégâts ${DAMAGE_TYPES[type].name} subis.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    drinkMutagen: (key) => {
      const s = get()
      const parsed = parseBrewKey(key)
      if (!parsed || parsed.def.kind !== 'mutagene' || (s.brews[key] ?? 0) < 1) return
      const q = BREW_QUALITIES[parsed.quality]
      const brews = { ...s.brews, [key]: (s.brews[key] ?? 0) - 1 }
      if (brews[key] <= 0) delete brews[key]
      const lucky = Math.random() < 0.7
      const mult = lucky ? 1 + 0.12 * q.mult : 1 - 0.08
      const next = {
        ...s, brews,
        mutagenActive: { mult, until: Date.now() + (parsed.def.durMin ?? 20) * 60_000 },
        log: pushLog(s.log, lucky ? `☣️ Mutagène : ça passe — +${Math.round((mult - 1) * 100)}% de dégâts !` : '☣️ Mutagène : ça pique — −8% de dégâts. La science a un prix.', 'craft'),
      }
      persist(next)
      set(next)
    },

    dailyTransmute: (from, to) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.transmutJour || from === to) return
      const today = Math.floor(Date.now() / 86_400_000)
      if (s.lastTransmute >= today) return
      if ((s.quint[from] ?? 0) < DAILY_TRANSMUTE_COST) return
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(6, 'modify', mods.alchimisteXpMult))
      const next = {
        ...s,
        quint: { ...s.quint, [from]: s.quint[from] - DAILY_TRANSMUTE_COST, [to]: (s.quint[to] ?? 0) + 1 },
        lastTransmute: today,
        metiers: g.metiers,
        log: pushLog(g.log, `🌗 Transmutation du jour : 4 ${DAMAGE_TYPES[from].icon} → 1 ${DAMAGE_TYPES[to].icon}.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    craftPhilosophale: () => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.philosophaleUnlock || s.philosophale) return
      if (DAMAGE_TYPE_LIST.some((t) => (s.reagents[t] ?? 0) < PHILOSOPHALE_COST.reagentsEach)) return
      if (s.poussiere < PHILOSOPHALE_COST.poussiere) return
      const millKey = Object.keys(s.brews).find((k) => k.endsWith(':3') && (s.brews[k] ?? 0) > 0)
      if (!millKey) return // il faut sacrifier un MILLÉSIME ★
      const reagents = { ...s.reagents }
      for (const t of DAMAGE_TYPE_LIST) reagents[t] = (reagents[t] ?? 0) - PHILOSOPHALE_COST.reagentsEach
      const brews = { ...s.brews, [millKey]: (s.brews[millKey] ?? 0) - 1 }
      if (brews[millKey] <= 0) delete brews[millKey]
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(20, 'ascend', mods.alchimisteXpMult))
      const next = {
        ...s, reagents, brews,
        poussiere: s.poussiere - PHILOSOPHALE_COST.poussiere,
        philosophale: true,
        metiers: g.metiers,
        log: pushLog(g.log, `🜍 LE GRAND ŒUVRE EST ACCOMPLI : la Pierre philosophale est tienne (+${Math.round((PHILOSOPHALE_MULT - 1) * 100)}% de drops de ressources, pour toujours).`, 'level'),
      }
      persist(next)
      set(next)
    },

    createItem: (opts) => {
      const s = get()
      const mods = craftMods(s.metiers)
      const tier = RARITIES[opts.rarity].tier
      // v0.25 : double horloge — la rareté craftable est bornée par le palier ET le tier de raid.
      const craftCap = maxCraftTier(s.bestStage, bestRaidTier(s.raidProgress))
      if (tier > craftCap) return
      // v0.28 E2 — bonus de création UNIVERSELS (Maître forgeron + Signature), plus de corps de métier.
      const forge = forgeBonus(mods)
      // B1 — la forge crée au niveau de ton meilleur contenu (raids/donjons compris) + bonus de métier.
      const ilvl = referenceIlvl(s.bestStage, s.raidProgress, s.dungeonProgress) + forge.ilvlBonus
      // 🏆 Chef-d'œuvre (étage V) : 1/semaine, +1 cran GARANTI (capé), châsse garantie, coût ×1,5 + Lingots.
      const week = currentWeek()
      const masterwork = !!opts.masterwork
      if (masterwork && (!forge.masterwork || s.lastMasterwork >= week || s.lingots < MASTERWORK_LINGOTS)) return
      // ✒️ Signature : affixe garanti AU CHOIX (universel, débloqué par le nœud Signature) — coûte des Lingots.
      const signature = opts.signature && forge.signatures?.includes(opts.signature) ? opts.signature : undefined
      const signCost = signature ? signatureLingotCost(tier) : 0
      if (signature && s.lingots < signCost + (masterwork ? MASTERWORK_LINGOTS : 0)) return
      // Coût : rareté choisie × métier (Économe) × chef-d'œuvre (×1,5).
      const c = createCost(tier, ilvl, contentRarityTier(s.bestStage))
      const m = mods.costMult * (masterwork ? 1.5 : 1)
      const cost = { eclats: Math.round(c.eclats * m), noyau: Math.round(c.noyau * m), fragments: Math.round((c.fragments ?? 0) * m), poussiere: Math.round((c.poussiere ?? 0) * m), cosmic: Math.round((c.cosmic ?? 0) * m) }
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < cost.fragments || s.poussiere < cost.poussiere || s.cosmic < cost.cosmic) return
      // 🎲 Prodige : chance de rareté SUPÉRIEURE (corps IV : +12% local) — 💡 Inspiration : DEUX crans.
      const lucky = masterwork || (Math.random() < Math.min(0.75, mods.luckChance + forge.luckBonus) && tier < craftCap)
      const inspired = lucky && !masterwork && mods.inspiration > 0 && Math.random() < mods.inspiration && tier + 2 <= craftCap
      const prodTier = Math.min(craftCap, tier + (inspired ? 2 : lucky ? 1 : 0))
      const rarityId = RARITY_LIST.find((r) => r.tier === prodTier)?.id ?? opts.rarity
      const item = generateItem({
        ilvl, type: opts.type, rarity: rarityId, primary: opts.primary,
        // ⭐ Polissage : meilleure distribution de qualité ; Chef-d'œuvre : qualité plancher Fin.
        starsFin: mods.polissage ? mods.polishFin : 0,
        ...(masterwork ? { minStars: 3 } : {}),
        ...(opts.orientation ? { orientation: opts.orientation } : {}),
        ...(opts.element ? { element: opts.element } : {}),
        ...(signature ? { forceStat: signature } : {}),
      })
      // 🏆 Chef-d'œuvre : châsse garantie (la qualité est désormais roulée dans generateItem).
      if (masterwork && itemSockets(item, 0) < 1) item.sockets = 1
      const inventory = [item, ...s.inventory].slice(0, invMax)
      // 🍀 Sérendipité : un craft SANS proc rembourse une part des coûts.
      const refundPct = !lucky && mods.serendipite > 0 ? mods.serendipite : 0
      const refund = {
        eclats: Math.round(cost.eclats * refundPct), noyau: Math.round(cost.noyau * refundPct),
        fragments: Math.round(cost.fragments * refundPct), poussiere: Math.round(cost.poussiere * refundPct),
        cosmic: Math.round(cost.cosmic * refundPct),
      }
      const gain = metierXpGain(prodTier, 'create', mods.forgeronXpMult * forge.xpMult * (masterwork ? 2 : 1))
      const g = gainMetierXp(s, 'forgeron', gain)
      let log = pushLog(
        g.log,
        `${masterwork ? '🏆 CHEF-D\'ŒUVRE : ' : 'Forgé : '}${item.name} (${RARITIES[rarityId].name}${item.stars ? ` ⭐${item.stars}` : ''})`
        + `${inspired ? ' — 💡 INSPIRATION, deux crans !' : lucky && !masterwork ? ' — 🎲 rareté chanceuse !' : ''}`
        + `${signature ? ` · ✒️ Signature ${signature}` : ''} (+${gain} XP 🔨).`,
        'craft',
      )
      if (refundPct > 0 && refund.eclats > 0) log = pushLog(log, `🍀 Sérendipité : ${Math.round(refundPct * 100)}% des coûts remboursés.`, 'craft')
      // 📋 Contrats de forge : la commande du jour est-elle remplie par CE craft ?
      let lingots = s.lingots - signCost - (masterwork ? MASTERWORK_LINGOTS : 0)
      let forgeContracts = s.forgeContracts
      if (mods.contrats) {
        const today = Math.floor(Date.now() / 86_400_000)
        if (!forgeContracts || forgeContracts.day !== today) forgeContracts = { day: today, done: [false, false, false] }
        const defs = forgeContractsForDay(today, craftCap)
        const hitIdx = defs.findIndex((d2, i) => !forgeContracts!.done[i] && d2.type === opts.type && d2.primary === opts.primary && prodTier >= d2.minTier)
        if (hitIdx >= 0) {
          const reward = CONTRACT_LINGOTS + mods.negociant
          lingots += reward
          forgeContracts = { ...forgeContracts, done: forgeContracts.done.map((d2, i) => (i === hitIdx ? true : d2)) }
          const cg = gainMetierXp({ metiers: g.metiers, log, characters: s.characters }, 'forgeron', gain * 2)
          g.metiers = cg.metiers
          log = pushLog(cg.log, `📋 CONTRAT REMPLI : +${reward} Lingot${reward > 1 ? 's' : ''} 🧱 et double XP !`, 'craft')
        }
      }
      const next = {
        ...s,
        essence: s.essence - cost.eclats + refund.eclats,
        noyau: s.noyau - cost.noyau + refund.noyau,
        fragments: s.fragments - cost.fragments + refund.fragments,
        poussiere: s.poussiere - cost.poussiere + refund.poussiere,
        cosmic: s.cosmic - cost.cosmic + refund.cosmic,
        lingots,
        forgeContracts,
        lastMasterwork: masterwork ? week : s.lastMasterwork,
        metiers: g.metiers,
        inventory,
        codex: discoverFromItems(s.codex, [item]),
        log,
      }
      persist(next)
      set(next)
    },

    smeltItem: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.fonderie) return // nœud « Fonderie »
      const idx = s.inventory.findIndex((i) => i.id === itemId)
      if (idx < 0) return // uniquement depuis le SAC (jamais l'équipé)
      const item = s.inventory[idx]
      const base = smeltLingots(RARITIES[item.rarity].tier)
      if (base <= 0) return // sous Rare : ne vaut pas le feu
      const lingots = Math.max(1, Math.round(base * mods.lingotierMult))
      const gain = metierXpGain(RARITIES[item.rarity].tier, 'modify', mods.forgeronXpMult)
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = {
        ...s,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        lingots: s.lingots + lingots,
        metiers: g.metiers,
        log: pushLog(g.log, `🫕 Fondu : ${item.name} → +${lingots} Lingot${lingots > 1 ? 's' : ''} 🧱.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    startTempering: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.trempeLente || s.trempe) return
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item || (item.trempeCount ?? 0) >= 5) return
      const next = {
        ...s,
        trempe: { itemId, startedAt: Date.now() },
        log: pushLog(s.log, `🔥 ${item.name} plonge dans le bac de trempe (+1 iLvl par 24 h réelles, ${5 - (item.trempeCount ?? 0)} restants).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    collectTempering: () => {
      const s = get()
      if (!s.trempe) return
      const item = findItemById(s, s.trempe.itemId)
      if (!item) {
        const next = { ...s, trempe: null }
        persist(next)
        set(next)
        return
      }
      const days = Math.floor((Date.now() - s.trempe.startedAt) / 86_400_000)
      const gained = Math.max(0, Math.min(days, 5 - (item.trempeCount ?? 0)))
      if (gained <= 0) {
        const next = { ...s, trempe: null, log: pushLog(s.log, `🔥 ${item.name} ressort du bac — pas encore trempé (24 h par iLvl).`, 'craft') }
        persist(next)
        set(next)
        return
      }
      // +1 iLvl par jour : rescale plat (mêmes règles que le surillvl, lignes % intactes).
      const newIlvl = item.ilvl + gained
      const ratio = newIlvl / item.ilvl
      const upd = applyItemPatch(s, item.id, {
        ilvl: newIlvl,
        primaryValue: Math.round(item.primaryValue * ratio),
        endurance: Math.round(item.endurance * ratio),
        affixes: item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.round(a.value * ratio) } : a)),
        trempeCount: (item.trempeCount ?? 0) + gained,
      })
      if (!upd) return
      const g = gainMetierXp(s, 'forgeron', metierXpGain(RARITIES[item.rarity].tier, 'ascend'))
      const next = {
        ...s, ...upd, trempe: null, metiers: g.metiers,
        log: pushLog(g.log, `🔥 Trempe lente : ${item.name} +${gained} iLvl (${item.ilvl} → ${newIlvl}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    learnMetierNode: (metier, nodeId) => {
      const s = get()
      const def = getMetierNode(metier, nodeId)
      if (!def) return
      if (!canLearnNode(s.metiers, metier, nodeId, s.bestStage).ok) return
      const st = s.metiers[metier]
      const nodes = { ...st.nodes }
      // v0.28 — SWITCH d'exclusive GRATUIT (no-regret) : choisir une autre spé rembourse la
      // précédente (ses rangs redeviennent des points), au lieu d'exiger un respec payant.
      if (def.exclusive && (nodes[nodeId] ?? 0) === 0) {
        for (const n of METIER_NODES[metier]) {
          if (n.exclusive === def.exclusive && n.id !== nodeId) delete nodes[n.id]
        }
      }
      nodes[nodeId] = (nodes[nodeId] ?? 0) + 1
      const rank = nodes[nodeId]
      const metiers = { ...s.metiers, [metier]: { ...st, nodes } }
      const m = METIERS[metier]
      const next = {
        ...s, metiers,
        log: pushLog(s.log, `${m.icon} ${m.name} : ${def.icon} ${def.name}${def.maxRank > 1 ? ` rang ${rank}` : ''} appris !`, 'craft'),
      }
      persist(next)
      set(next)
    },

    respecMetier: (metier) => {
      const s = get()
      const st = s.metiers[metier]
      if (Object.keys(st.nodes).length === 0) return
      const cost = respecCost(st)
      if (s.gold < cost) return
      const metiers = { ...s.metiers, [metier]: { ...st, nodes: {} } }
      const m = METIERS[metier]
      const next = {
        ...s, metiers, gold: s.gold - cost,
        log: pushLog(s.log, `${m.icon} ${m.name} : arbre réinitialisé (-${cost.toLocaleString('fr-FR')} or). Points rendus.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    respecMetierBranch: (metier, branchId) => {
      const s = get()
      const st = s.metiers[metier]
      if (pointsSpentInBranch(st, metier, branchId) === 0) return
      const cost = respecBranchCost(st)
      if (s.gold < cost) return
      // Ne rase que les nœuds de la branche ('tronc' = nœuds sans champ branch).
      const nodes = { ...st.nodes }
      for (const n of METIER_NODES[metier]) {
        if ((n.branch ?? 'tronc') === branchId) delete nodes[n.id]
      }
      const metiers = { ...s.metiers, [metier]: { ...st, nodes } }
      const m = METIERS[metier]
      const bname = branchId === 'tronc' ? 'Tronc commun' : METIER_BRANCHES[metier].find((b) => b.id === branchId)?.name ?? branchId
      const next = {
        ...s, metiers, gold: s.gold - cost,
        log: pushLog(s.log, `${m.icon} ${m.name} : branche « ${bname} » réinitialisée (-${cost.toLocaleString('fr-FR')} or). Points rendus.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    buildAutomate: () => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.automates) return // nœud « Industrialisation » de l'arbre du Forgeron
      const idx = s.automates.length
      if (idx >= AUTOMATE_MAX) return
      if (idx >= 3 && !mods.automate4) return // 🏭 la 4e machine exige « Manufacture » (v0.26)
      if (levelFromXp(s.metiers.forgeron.xp) < AUTOMATE_FORGERON_LEVELS[idx]) return
      const c = AUTOMATE_COSTS[idx]
      if (s.gold < c.gold || s.poussiere < c.poussiere || s.fragments < c.fragments || s.cosmic < c.cosmic) return
      const a: Automate = {
        id: idx + 1,
        name: AUTOMATE_NAMES[idx] ?? `Automate ${idx + 1}`,
        mission: null, progress: 0, paused: false, speedLvl: 0, yieldLvl: 0, bank: {},
      }
      const next = {
        ...s,
        gold: s.gold - c.gold,
        poussiere: s.poussiere - c.poussiere,
        fragments: s.fragments - c.fragments,
        cosmic: s.cosmic - c.cosmic,
        automates: [...s.automates, a],
        log: pushLog(s.log, `🤖 Automate construit : ${a.name} ! Assigne-lui un donjon ou un raid déjà battu (Atelier).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    assignAutomate: (id, mission) => {
      const s = get()
      if (mission) {
        // Uniquement du contenu DÉJÀ BATTU (l'automate ne progresse jamais, il récolte).
        const record = mission.kind === 'dungeon'
          ? s.dungeonProgress[mission.id as DungeonId] ?? 0
          : s.raidProgress[mission.id as RaidId] ?? 0
        if (mission.level < 1 || mission.level > record) return
      }
      const automates = s.automates.map((a) => (a.id === id ? { ...a, mission, progress: 0, waiting: false } : a))
      const next = {
        ...s, automates,
        log: pushLog(s.log, mission
          ? `🤖 Mission assignée : ${missionLabel(mission)}.`
          : '🤖 Mission retirée — l\'automate est au repos.', 'craft'),
      }
      persist(next)
      set(next)
    },

    toggleAutomatePause: (id) => {
      const s = get()
      const automates = s.automates.map((a) => (a.id === id ? { ...a, paused: !a.paused } : a))
      const next = { ...s, automates }
      persist(next)
      set(next)
    },

    upgradeAutomate: (id, kind) => {
      const s = get()
      const a = s.automates.find((x) => x.id === id)
      if (!a) return
      const lvl = kind === 'speed' ? a.speedLvl : a.yieldLvl
      if (lvl >= AUTOMATE_UPG_MAX) return
      const cost = automateUpgradeCost(kind, lvl)
      if (s.gold < cost) return
      const automates = s.automates.map((x) =>
        x.id === id ? { ...x, speedLvl: kind === 'speed' ? x.speedLvl + 1 : x.speedLvl, yieldLvl: kind === 'yield' ? x.yieldLvl + 1 : x.yieldLvl } : x,
      )
      const next = {
        ...s, automates, gold: s.gold - cost,
        log: pushLog(s.log, `🤖 ${a.name} amélioré : ${kind === 'speed' ? 'vitesse' : 'rendement'} niv. ${lvl + 1} (-${cost.toLocaleString('fr-FR')} or).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    enterDungeon: (dungeonId, level, repeat = 1, wing) => {
      const s = get()
      if (s.dungeon || s.raid) return
      const def = getDungeonDef(dungeonId)
      if (!def || s.bestStage < def.unlockStage) return
      if (s.sceaux < def.sceauCost) return
      if (level < 1 || level > (s.dungeonProgress[dungeonId] ?? 0) + 1) return
      const dungeon = generateDungeon(dungeonId, level, s.bestStage, wing)
      dungeon.repeatLeft = Math.max(0, Math.round(repeat) - 1)
      // ⚗️ Potions de contenu ARMÉES (Officine v0.26) : consommées à l'entrée.
      let log = s.log
      let armedChestBonus = s.armedChestBonus
      let armedXpBonus = s.armedXpBonus
      if (armedChestBonus) {
        dungeon.chestPotion = armedChestBonus
        armedChestBonus = null
        log = pushLog(log, `💰 Potion du pillard : le coffre de ce run rendra +${Math.round(dungeon.chestPotion * 100)}%.`, 'craft')
      }
      if (armedXpBonus) {
        dungeon.xpPotion = armedXpBonus
        armedXpBonus = null
        log = pushLog(log, `📚 Potion de l'érudit : l'XP de ce run +${Math.round(dungeon.xpPotion * 100)}%.`, 'craft')
      }
      // Rune de l'Économe : 15% de chance de préserver la clé.
      const saved = def.sceauCost > 0 && equippedRules(s.characters).has('econome') && Math.random() < (craftMods(s.metiers).loiAmplifiee ? 0.25 : 0.15)
      const cost = saved ? 0 : def.sceauCost
      const runs = dungeon.repeatLeft > 0 ? ` · auto ×${dungeon.repeatLeft + 1}` : ''
      // On ENTRE frais : PV pleins + recharges remises à zéro (fini les morts en donjon après un farm low PV).
      const healed = s.characters.map(fullHeal)
      resetAllCooldowns(healed)
      const next = { ...s, characters: healed, sceaux: s.sceaux - cost, dungeon, armedChestBonus, armedXpBonus, log: pushLog(log, `🏰 Entrée dans ${dungeon.name} (${dungeon.totalFights} combats${saved ? ', 🗝️ clé préservée !' : cost ? `, -${cost} 🔑` : ', gratuit'}${runs}).`, 'info') }
      persist(next)
      set(next)
    },

    abandonDungeon: () => {
      const s = get()
      if (!s.dungeon) return
      // Quitter une instance soigne et RESSUSCITE toute l'équipe (sinon un perso mort restait mort).
      const next = { ...s, characters: s.characters.map(fullHeal), dungeon: null, log: pushLog(s.log, 'Donjon abandonné. Le Sceau est perdu.', 'info') }
      persist(next)
      set(next)
    },

    enterRaid: (raidId, tier, repeat = 1) => {
      const s = get()
      if (s.raid || s.dungeon) return
      const def = getRaidDef(raidId)
      if (!def || !raidUnlocked(def, s.bestStage, s.raidProgress)) return
      // v0.24 : le tier doit être DÉBLOQUÉ (clear de la frontière + Trophées — voir unlockRaidTier).
      const maxTier = s.raidTierUnlocked[raidId] ?? 1
      if (tier < 1 || tier > maxTier) return
      if (s.orbes < def.orbeCost) return
      const raid = generateRaid(raidId, tier, s.bestStage, s.characters.length)
      raid.repeatLeft = Math.max(0, Math.round(repeat) - 1)
      // Rune de l'Économe : 15% de chance de préserver l'Orbe.
      const saved = equippedRules(s.characters).has('econome') && Math.random() < (craftMods(s.metiers).loiAmplifiee ? 0.25 : 0.15)
      const runs = raid.repeatLeft > 0 ? ` · auto ×${raid.repeatLeft + 1}` : ''
      const boss = raidBossVariant(def, tier)
      // On ENTRE frais : PV pleins + recharges remises à zéro (le boss se prépare à neuf).
      let healed = s.characters.map(fullHeal)
      resetAllCooldowns(healed)
      // 🛡️ Potion de garde ARMÉE (Officine v0.26) : l'équipe entre bardée d'un bouclier.
      let log = s.log
      let armedRaidShield = s.armedRaidShield
      if (armedRaidShield) {
        const pct = armedRaidShield
        healed = healed.map((c) => ({ ...c, absorb: Math.max(c.absorb ?? 0, charMaxHp(c) * pct) }))
        armedRaidShield = null
        log = pushLog(log, `🛡️ Potion de garde : l'équipe entre avec un bouclier de ${Math.round(pct * 100)}% des PV max.`, 'craft')
      }
      const next = { ...s, characters: healed, orbes: s.orbes - (saved ? 0 : def.orbeCost), raid, armedRaidShield, log: pushLog(log, `⚔️ Raid lancé : ${def.name} · Tier ${tier} — ${boss.name}${boss.partnerName ? ` & ${boss.partnerName}` : ''}${saved ? ' · 🗝️ Orbe préservée !' : ''}${runs}.`, 'info') }
      persist(next)
      set(next)
    },

    abandonRaid: () => {
      const s = get()
      if (!s.raid) return
      // Quitter une instance soigne et RESSUSCITE toute l'équipe (sinon un perso mort restait mort).
      const next = { ...s, characters: s.characters.map(fullHeal), raid: null, log: pushLog(s.log, 'Raid abandonné. L\'Orbe est perdue.', 'info') }
      persist(next)
      set(next)
    },

    unlockRaidTier: (raidId) => {
      const s = get()
      const def = getRaidDef(raidId)
      if (!def) return
      const cur = s.raidTierUnlocked[raidId] ?? 1
      // Il faut avoir VAINCU la frontière actuelle (le mur se franchit, il ne s'achète pas seul)…
      if ((s.raidProgress[raidId] ?? 0) < cur) return
      // …et payer les Trophées du raid (≈ 5 clears du tier courant).
      const cost = raidTierUnlockCost(def, cur + 1)
      if ((s.raidTrophies[raidId] ?? 0) < cost) return
      const next = {
        ...s,
        raidTrophies: { ...s.raidTrophies, [raidId]: (s.raidTrophies[raidId] ?? 0) - cost },
        raidTierUnlocked: { ...s.raidTierUnlocked, [raidId]: cur + 1 },
        log: pushLog(s.log, `🏆 ${def.name} : Tier ${cur + 1} débloqué (-${cost} Trophées) !`, 'level'),
      }
      persist(next)
      set(next)
    },

    infuseUnique: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.synth1) return // Synthèse I (arbre de l'Alchimiste)
      if (s.fragments < FRAGMENT_INFUSE_COST) return
      const item = findItemById(s, itemId)
      if (!item) return
      // Pas d'unique → en ajoute un ; sinon monte son rang.
      const newUnique = item.unique
        ? { id: item.unique.id, rank: Math.min(UNIQUE_MAX_RANK, item.unique.rank + 1) }
        : randomUniqueInstance()
      const upd = applyItemPatch(s, itemId, { unique: newUnique })
      if (!upd) return
      const label = item.unique ? `rang ${newUnique.rank}` : `effet ${getUnique(newUnique.id)?.name ?? ''}`
      const codex = s.codex.includes(newUnique.id) ? s.codex : [...s.codex, newUnique.id]
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'ascend'))
      const next = { ...s, ...upd, codex, metiers: g.metiers, fragments: s.fragments - FRAGMENT_INFUSE_COST, log: pushLog(g.log, `✨ Fragment infusé : ${item.name} (${label}).`, 'craft') }
      persist(next)
      set(next)
    },

    /** Invoque un effet unique AU CHOIX sur un objet (sink d'Éclat cosmique des raids). */
    chooseUnique: (itemId, effectId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.synth3) return // Synthèse III (arbre de l'Alchimiste, palier 100)
      const def = getUnique(effectId)
      if (!def) return
      const item = findItemById(s, itemId)
      if (!item) return
      if (s.cosmic < CHOOSE_UNIQUE_COST.cosmic || s.fragments < CHOOSE_UNIQUE_COST.fragments) return
      // Même effet déjà présent → monte son rang ; sinon le pose au rang 1.
      const rank = item.unique?.id === effectId ? Math.min(UNIQUE_MAX_RANK, item.unique.rank + 1) : 1
      const upd = applyItemPatch(s, itemId, { unique: { id: effectId, rank } })
      if (!upd) return
      const codex = s.codex.includes(effectId) ? s.codex : [...s.codex, effectId]
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'ascend'))
      const next = {
        ...s,
        ...upd,
        codex,
        cosmic: s.cosmic - CHOOSE_UNIQUE_COST.cosmic,
        fragments: s.fragments - CHOOSE_UNIQUE_COST.fragments,
        metiers: g.metiers,
        log: pushLog(g.log, `💫 Effet invoqué : ${def.name} sur ${item.name} (rang ${rank}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    insertEffect: (itemId, effectId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.synth2) return // Synthèse II (arbre de l'Alchimiste)
      const def = getUnique(effectId)
      if (!def) return
      const item = findItemById(s, itemId)
      if (!item) return
      const cost = insertCost()
      const have = s.essences[effectId] ?? 0
      if (have < cost.essences || s.essence < cost.eclats) return
      const rank = item.unique?.id === effectId ? item.unique.rank : 1
      const upd = applyItemPatch(s, itemId, { unique: { id: effectId, rank } })
      if (!upd) return
      const essences = { ...s.essences, [effectId]: have - cost.essences }
      const codex = s.codex.includes(effectId) ? s.codex : [...s.codex, effectId]
      const g = gainMetierXp(s, 'alchimiste', metierXpGain(RARITIES[item.rarity].tier, 'modify'))
      const next = {
        ...s,
        ...upd,
        essence: s.essence - cost.eclats,
        essences,
        codex,
        metiers: g.metiers,
        log: pushLog(g.log, `🧬 Effet inséré : ${def.name} sur ${item.name} (-${cost.essences} essences).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    claimChest: () => {
      const s = get()
      const c = s.pendingChest
      if (!c) return
      const pousG = c.poussiere ?? 0
      const cosmG = c.cosmic ?? 0
      const orbeG = c.orbes ?? 0
      const fragG = c.fragments ?? 0
      const gemG = c.gem ? getCondGem(c.gem.id) : undefined
      const next = {
        ...s,
        ...applyChestRewards(s, c),
        pendingChest: null,
        log: pushLog(
          s.log,
          `Coffre ouvert : ${c.items.length} objets${c.eclats ? `, +${c.eclats} éclats` : ''}${c.noyau ? `, +${c.noyau} noyaux` : ''}${pousG ? `, +${pousG} poussière` : ''}${c.gemDust ? `, +${c.gemDust} 🔹` : ''}${gemG ? `, 💎 ${gemG.name}${(c.gem!.rank ?? 1) > 1 ? ` R${c.gem!.rank}` : ''}` : ''}${cosmG ? `, +${cosmG} 💫` : ''}${c.gold ? `, +${c.gold} or` : ''}${c.sceaux ? `, +${c.sceaux} sceau` : ''}${orbeG ? `, +${orbeG} orbe` : ''}${fragG ? `, +${fragG} fragment` : ''}.`,
          'craft',
        ),
      }
      persist(next)
      set(next)
    },

    craftSceau: () => {
      const s = get()
      if (s.noyau < SCEAU_COST.noyau || s.essence < SCEAU_COST.eclats) return
      const next = {
        ...s,
        noyau: s.noyau - SCEAU_COST.noyau,
        essence: s.essence - SCEAU_COST.eclats,
        sceaux: s.sceaux + 1,
        log: pushLog(s.log, `🔑 Sceau de faille forgé (-${SCEAU_COST.noyau} noyaux, -${SCEAU_COST.eclats} éclats).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    setActiveChar: (index) => {
      const s = get()
      if (index < 0 || index >= s.characters.length) return
      const next = { ...s, activeChar: index }
      persist(next)
      set(next)
    },

    renameCharacter: (index, name) => {
      const s = get()
      const n = name.trim().slice(0, 16)
      if (!n || index < 0 || index >= s.characters.length || n === s.characters[index].name) return
      const old = s.characters[index].name
      const characters = s.characters.map((c, i) => (i === index ? { ...c, name: n } : c))
      const next = { ...s, characters, log: pushLog(s.log, `✏️ ${old} s'appelle désormais ${n}.`, 'info') }
      persist(next)
      set(next)
    },

    setBias: (p) => {
      const s = get()
      const characters = s.characters.map((c, i) => (i === s.activeChar ? { ...c, primaryBias: p } : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    completeOnboarding: (bias) => {
      const s = get()
      if (s.onboarded) return
      // Le héros de départ adopte la spé choisie → le butin penche du bon côté dès le 1er kill.
      const characters = s.characters.map((c, i) => (i === s.activeChar ? { ...c, primaryBias: bias } : c))
      const next = { ...s, characters, onboarded: true }
      persist(next)
      set(next)
    },

    setPower: (slot, powerId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || slot < 0 || slot >= char.powers.length) return
      if (powerId && !char.unlockedPowers.includes(powerId)) return
      if (powerId && isGenerator(getPower(powerId))) return // un générateur va dans sa section dédiée
      const powers = char.powers.map((x) => (x === powerId ? null : x)) // unicité
      powers[slot] = powerId
      const nc = { ...char, powers }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    // v0.29.5 : équipe une capacité PASSIVE dans l'un des 3 slots dédiés.
    setPassive: (slot, powerId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      const cur = char?.passives ?? [null, null, null]
      if (!char || slot < 0 || slot >= 3) return
      if (powerId && !char.unlockedPowers.includes(powerId)) return
      const passives = cur.map((x) => (x === powerId ? null : x)) // unicité
      passives[slot] = powerId
      const nc = { ...char, passives }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    // v0.30 : équipe un GÉNÉRATEUR (sort builder) dans l'un des 3 slots dédiés (auto-cast pur).
    setGenerator: (slot, powerId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      const cur = char?.generators ?? [null, null, null]
      if (!char || slot < 0 || slot >= GENERATOR_SLOTS) return
      if (powerId && !char.unlockedPowers.includes(powerId)) return
      if (powerId && !isGenerator(getPower(powerId))) return // seuls les builders vont ici
      const generators = cur.map((x) => (x === powerId ? null : x)) // unicité
      generators[slot] = powerId
      const nc = { ...char, generators }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    togglePowerAuto: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || slot < 0 || slot >= char.powers.length) return
      const powerAuto = char.powers.map((_, i) => (i === slot ? char.powerAuto?.[i] === false : char.powerAuto?.[i] !== false))
      const nc = { ...char, powerAuto }
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    castPower: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const pid = char.powers[slot]
      if (!pid || char.powerAuto?.[slot] !== false) return // doit être en MANUEL
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      // Posé en attente : le prochain tick le lancera si la recharge est prête (strict, pas de file).
      manualFire.add(`${char.id}:${pid}`)
    },

    allocateTalent: (nodeId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const node = getTalent(nodeId)
      if (!node || !canAllocate(node, char.talents, char.talentPoints)) return
      const talents = { ...char.talents, [nodeId]: (char.talents[nodeId] ?? 0) + 1 }
      const unlockedPowers = computeUnlockedPowers({ ...talents, ...(char.pantheon ?? {}) })
      const nc = { ...char, talents, talentPoints: char.talentPoints - 1, unlockedPowers }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    respecTalents: () => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const spent = Object.values(char.talents).reduce((a, b) => a + b, 0)
      // Le nœud racine « Éveil » (co_start) reste alloué d'office : on rembourse le reste.
      const refundable = spent - (char.talents.co_start ?? 0)
      if (refundable <= 0) return
      const cost = 200 * char.level
      if (s.gold < cost) return
      const talents = { co_start: 1 }
      // Le respec de base NE touche PAS au Panthéon (pool & arbre séparés) : on conserve `char.pantheon`.
      const unlockedPowers = computeUnlockedPowers({ ...talents, ...(char.pantheon ?? {}) })
      const powers = char.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const passives = (char.passives ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const generators = (char.generators ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, talents, talentPoints: char.talentPoints + refundable, unlockedPowers, powers, passives, generators }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, gold: s.gold - cost, characters, log: pushLog(s.log, `Talents réinitialisés (-${cost} or).`, 'craft') }
      persist(next)
      set(next)
    },

    // v0.33 — PANTHÉON : alloue un nœud du 2e arbre avec le budget de Points d'Éveil (= prestigeRank × K,
    // identique pour chaque perso). Pool & arbre SÉPARÉS de la base : ne touche jamais `talentPoints`.
    allocatePantheon: (nodeId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const node = getTalent(nodeId)
      const pantheon = char.pantheon ?? { pa_start: 1 }
      if (!node || !canAllocatePantheon(node, pantheon, eveilBudget(s.prestigeRank), s.prestigeRank)) return
      const next2 = { ...pantheon, [nodeId]: (pantheon[nodeId] ?? 0) + 1 }
      const unlockedPowers = computeUnlockedPowers({ ...char.talents, ...next2 })
      const nc = { ...char, pantheon: next2, unlockedPowers }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    // v0.33 — réinitialise le Panthéon (gratuit : le joueur refait son build d'Éveil à chaque run).
    respecPantheon: () => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const pantheon = { pa_start: 1 }
      const unlockedPowers = computeUnlockedPowers({ ...char.talents, ...pantheon })
      const powers = char.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const passives = (char.passives ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const generators = (char.generators ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, pantheon, unlockedPowers, powers, passives, generators }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters, log: pushLog(s.log, '🌌 Panthéon réinitialisé.', 'craft') }
      persist(next)
      set(next)
    },

    saveBuildPreset: (slot, name) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || slot < 0 || slot > 2) return
      const presets = [...(char.buildPresets ?? [null, null, null])]
      presets[slot] = {
        name: (name ?? presets[slot]?.name ?? `Build ${slot + 1}`).trim().slice(0, 14) || `Build ${slot + 1}`,
        talents: { ...char.talents },
        powers: [...char.powers],
        passives: [...(char.passives ?? [])],
        generators: [...(char.generators ?? [])],
        primaryBias: char.primaryBias,
      }
      const characters = s.characters.map((c, i) => (i === s.activeChar ? { ...c, buildPresets: presets } : c))
      const next = { ...s, characters, log: pushLog(s.log, `🧩 Préset « ${presets[slot]!.name} » sauvegardé.`, 'craft') }
      persist(next)
      set(next)
    },

    applyBuildPreset: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      const preset = char?.buildPresets?.[slot]
      if (!char || !preset) return
      // Respec payant (gratuit si rien n'est alloué au-delà de la racine).
      const refundable = Object.values(char.talents).reduce((a, b) => a + b, 0) - (char.talents.co_start ?? 0)
      const cost = refundable > 0 ? 200 * char.level : 0
      if (s.gold < cost) return
      // Réallocation VALIDÉE nœud par nœud (prérequis + budget de points du niveau actuel) :
      // un préset sauvegardé à plus haut niveau s'applique au mieux, jamais en triche.
      const target = preset.talents
      const talents: Record<string, number> = { co_start: 1 }
      let points = talentPointsForLevel(char.level)
      let progressed = true
      while (progressed) {
        progressed = false
        for (const id in target) {
          if (id === 'co_start') continue
          const node = getTalent(id)
          if (!node) continue
          const want = Math.min(target[id], node.maxRank)
          while ((talents[id] ?? 0) < want && canAllocate(node, talents, points)) {
            talents[id] = (talents[id] ?? 0) + 1
            points--
            progressed = true
          }
        }
      }
      const unlockedPowers = computeUnlockedPowers({ ...talents, ...(char.pantheon ?? {}) })
      const powers = preset.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const passives = (preset.passives ?? [null, null, null]).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const generators = (preset.generators ?? [null, null, null]).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, talents, talentPoints: points, unlockedPowers, powers, passives, generators, primaryBias: preset.primaryBias }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = {
        ...s, gold: s.gold - cost, characters,
        log: pushLog(s.log, `🧩 Préset « ${preset.name} » appliqué${cost ? ` (-${cost.toLocaleString('fr-FR')} or)` : ''}.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    deleteBuildPreset: (slot) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char || !char.buildPresets?.[slot]) return
      const presets = [...char.buildPresets]
      presets[slot] = null
      const characters = s.characters.map((c, i) => (i === s.activeChar ? { ...c, buildPresets: presets } : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    buyUpgrade: (id) => {
      const s = get()
      const def = getUpgrade(id)
      if (!def) return
      const level = s.upgrades[id] ?? 0
      if (isMaxed(def, level)) return
      const cost = accountUpgradeCost(def, level)
      const pous = upgradePoussiere(def, level)
      const ecl = upgradeEclats(def, level)
      if (s.gold < cost || s.poussiere < pous || s.essence < ecl) return
      const upgrades = { ...s.upgrades, [id]: level + 1 }
      let characters = s.characters
      if (id === 'talentBonus') characters = characters.map((c) => ({ ...c, talentPoints: c.talentPoints + 1 }))
      refreshGlobals(upgrades, s.maitrise, s.constellation, s.achievements)
      const next = { ...s, gold: s.gold - cost, poussiere: s.poussiere - pous, essence: s.essence - ecl, upgrades, characters, log: pushLog(s.log, `Amélioration : ${def.name} niv. ${level + 1} (-${cost.toLocaleString('fr-FR')} or${ecl ? `, -${ecl} ♦` : ''}${pous ? `, -${pous} 🌌` : ''}).`, 'gold') }
      persist(next)
      set(next)
    },

    refreshShop: () => {
      const s = get()
      const cost = shopRefreshCost(s.bestStage)
      if (s.gold < cost) return
      const eco = computeGlobalMods(s.upgrades)
      const next = { ...s, gold: s.gold - cost, shopStock: generateShop(s.bestStage, s.raidProgress, s.dungeonProgress, Math.floor(eco.rarityLuck)), lastShopRefresh: Date.now(), log: pushLog(s.log, `Échoppe rafraîchie (-${cost} or).`, 'gold') }
      persist(next)
      set(next)
    },

    buyShopItem: (itemId) => {
      const s = get()
      const item = s.shopStock.find((i) => i.id === itemId)
      if (!item) return
      const price = shopBuyPrice(item)
      if (s.gold < price) return
      const next = {
        ...s,
        gold: s.gold - price,
        shopStock: s.shopStock.filter((i) => i.id !== itemId),
        inventory: [item, ...s.inventory].slice(0, invMax),
        codex: discoverFromItems(s.codex, [item]),
        tut: { ...s.tut, bought: true }, // v0.31 — quête tuto « Marché »
        log: pushLog(s.log, `Acheté : ${item.name} (-${price} or).`, 'gold'),
      }
      persist(next)
      set(next)
    },

    claimTutorialReward: (id) => {
      const s = get()
      const q = TUT_QUESTS.find((x) => x.id === id)
      if (!q || s.tut.claimed.includes(id) || !q.done(tutContext(s))) return
      const r = q.reward
      let inventory = s.inventory
      let log = s.log
      if (r.item) {
        const it = generateItem({ ilvl: Math.max(8, stageIlvl(s.bestStage)), rarity: 'rare', primaryBias: pickBias(s.characters), minStars: 3 })
        inventory = [it, ...inventory].slice(0, invMax)
        log = pushLog(log, `🎁 Récompense : ${it.name}`, 'loot')
      }
      const next = {
        ...s,
        gold: s.gold + (r.gold ?? 0),
        essence: s.essence + (r.eclats ?? 0),
        noyau: s.noyau + (r.noyau ?? 0),
        sceaux: s.sceaux + (r.sceaux ?? 0),
        inventory,
        tut: { ...s.tut, claimed: [...s.tut.claimed, id] },
        log: pushLog(log, `🎯 Premiers Pas — « ${q.title} » accomplie : ${q.rewardText} !`, 'level'),
      }
      persist(next)
      set(next)
    },

    claimInbox: (id) => {
      const s = get()
      const m = s.inbox.find((x) => x.id === id)
      if (!m || m.claimed || !inboxHasReward(m.reward)) return
      const r = m.reward
      const next = {
        ...s,
        gold: s.gold + (r.gold ?? 0),
        essence: s.essence + (r.eclats ?? 0),
        noyau: s.noyau + (r.noyau ?? 0),
        sceaux: s.sceaux + (r.sceaux ?? 0),
        fragments: s.fragments + (r.fragments ?? 0),
        poussiere: s.poussiere + (r.poussiere ?? 0),
        inbox: s.inbox.map((x) => (x.id === id ? { ...x, claimed: true } : x)),
        log: pushLog(s.log, `✉ Récompense réclamée : ${m.title}.`, 'level'),
      }
      persist(next)
      set(next)
    },

    claimAllInbox: () => {
      const s = get()
      const pending = s.inbox.filter((m) => !m.claimed && inboxHasReward(m.reward))
      if (pending.length === 0) return
      let gold = s.gold, essence = s.essence, noyau = s.noyau, sceaux = s.sceaux, fragments = s.fragments, poussiere = s.poussiere
      for (const m of pending) {
        gold += m.reward.gold ?? 0
        essence += m.reward.eclats ?? 0
        noyau += m.reward.noyau ?? 0
        sceaux += m.reward.sceaux ?? 0
        fragments += m.reward.fragments ?? 0
        poussiere += m.reward.poussiere ?? 0
      }
      const next = {
        ...s, gold, essence, noyau, sceaux, fragments, poussiere,
        inbox: s.inbox.map((m) => (!m.claimed && inboxHasReward(m.reward) ? { ...m, claimed: true } : m)),
        log: pushLog(s.log, `✉ ${pending.length} récompense${pending.length > 1 ? 's' : ''} réclamée${pending.length > 1 ? 's' : ''}.`, 'level'),
      }
      persist(next)
      set(next)
    },

    pushInbox: (msg) => {
      const s = get()
      const next = { ...s, inbox: [msg, ...s.inbox].slice(0, INBOX_CAP) }
      persist(next)
      set(next)
    },

    markInboxSeen: () => {
      const s = get()
      if (s.inbox.every((m) => m.seen)) return
      const next = { ...s, inbox: s.inbox.map((m) => (m.seen ? m : { ...m, seen: true })) }
      persist(next)
      set(next)
    },

    rollDailyIfNeeded: () => {
      const s = get()
      const today = todayStr()
      if (s.daily.date === today) return
      const daily = rollDaily(s.daily, dailyMetrics(s), today, { bestStage: s.bestStage })
      const next = { ...s, daily }
      persist(next)
      set(next)
    },

    claimDailyQuest: (id) => {
      const s = get()
      if (s.daily.claimed.includes(id) || !s.daily.questIds.includes(id)) return
      const q = getDailyQuest(id)
      if (!q || !questDone(q, dailyMetrics(s), s.daily.baseline)) return
      const r = q.reward
      const next = {
        ...s,
        gold: s.gold + (r.gold ?? 0),
        essence: s.essence + (r.eclats ?? 0),
        noyau: s.noyau + (r.noyau ?? 0),
        sceaux: s.sceaux + (r.sceaux ?? 0),
        fragments: s.fragments + (r.fragments ?? 0),
        poussiere: s.poussiere + (r.poussiere ?? 0),
        daily: { ...s.daily, claimed: [...s.daily.claimed, id] },
        log: pushLog(s.log, `📅 Contrat du jour accompli : ${q.icon} ${q.title} !`, 'level'),
      }
      persist(next)
      set(next)
    },

    claimLogin: () => {
      const s = get()
      const today = todayStr()
      if (s.daily.date !== today || s.daily.loginClaimed === today) return
      const r = LOGIN_REWARDS[(s.daily.streak - 1 + LOGIN_REWARDS.length) % LOGIN_REWARDS.length]
      const next = {
        ...s,
        gold: s.gold + (r.gold ?? 0),
        essence: s.essence + (r.eclats ?? 0),
        noyau: s.noyau + (r.noyau ?? 0),
        sceaux: s.sceaux + (r.sceaux ?? 0),
        fragments: s.fragments + (r.fragments ?? 0),
        poussiere: s.poussiere + (r.poussiere ?? 0),
        daily: { ...s.daily, loginClaimed: today },
        log: pushLog(s.log, `📅 Connexion jour ${((s.daily.streak - 1) % LOGIN_REWARDS.length) + 1} réclamée !`, 'level'),
      }
      persist(next)
      set(next)
    },

    rollEventIfNeeded: () => {
      const s = get()
      const event = rollEvent(s.event, s.totalKills)
      if (event === s.event) return
      const next = { ...s, event }
      persist(next)
      set(next)
    },

    claimEventMilestone: (index) => {
      const s = get()
      const m = EVENT_MILESTONES[index]
      if (!m || s.event.claimed.includes(index)) return
      if (eventPoints(s.event, s.totalKills) < m.points) return
      const r = m.reward
      let eventCosmetics = s.eventCosmetics
      let log = pushLog(s.log, `🎉 Invasion — palier ${index + 1} réclamé !`, 'level')
      if (m.aura) {
        const auraId = invasionAuraId(s.event.element)
        if (!eventCosmetics.includes(auraId)) eventCosmetics = [...eventCosmetics, auraId]
        log = pushLog(log, `🏅 Aura d'invasion débloquée ! (Apparence → Parures)`, 'level')
      }
      const next = {
        ...s,
        gold: s.gold + (r.gold ?? 0),
        essence: s.essence + (r.eclats ?? 0),
        noyau: s.noyau + (r.noyau ?? 0),
        sceaux: s.sceaux + (r.sceaux ?? 0),
        fragments: s.fragments + (r.fragments ?? 0),
        poussiere: s.poussiere + (r.poussiere ?? 0),
        eventCosmetics,
        event: { ...s.event, claimed: [...s.event.claimed, index] },
        log,
      }
      persist(next)
      set(next)
    },

    learnMaitrise: (nodeId) => {
      const s = get()
      const def = getMaitriseNode(nodeId)
      if (!def) return
      const rank = s.maitrise[nodeId] ?? 0
      if (rank >= def.maxRank || s.maitrisePoints < 1) return
      const maitrise = { ...s.maitrise, [nodeId]: rank + 1 }
      refreshGlobals(s.upgrades, maitrise, s.constellation, s.achievements)
      const next = {
        ...s, maitrise, maitrisePoints: s.maitrisePoints - 1,
        log: pushLog(s.log, `🏛️ Maîtrise : ${def.icon} ${def.name} rang ${rank + 1}/${def.maxRank}.`, 'level'),
      }
      persist(next)
      set(next)
    },

    checkAchievements: () => {
      const s = get()
      const metierLevels = METIER_LIST.map((m) => levelFromXp(s.metiers[m.id].xp))
      const ctx: AchvCtx = {
        bestStage: s.bestStage,
        maxLevel: highestLevel(s.characters),
        prestigeRank: s.prestigeRank,
        bestRaidTier: bestRaidTier(s.raidProgress),
        dungeonLevels: Object.values(s.dungeonProgress).reduce((a, b) => a + (b ?? 0), 0),
        uniquesDiscovered: s.codex.length,
        metierMaxLevel: metierLevels.reduce((a, b) => Math.max(a, b), 0),
        metierMinLevel: metierLevels.reduce((a, b) => Math.min(a, b), Infinity),
        characters: s.characters,
        // ---- v0.32 : étage Légende ----
        curStage: s.stage,
        maxEquippedIlvl: s.characters.reduce((m, ch) => Math.max(m, fullyEquippedMinIlvl(ch)), 0),
        minRaidWorldTier: RAID_LIST.reduce((m, def) => Math.min(m, globalTier(def, s.raidProgress[def.id] ?? 0)), Infinity),
        abyssWorldTier: globalTier(getRaidDef('abysse'), s.raidProgress.abysse ?? 0),
        constellationAlloc: s.constellation,
        cosmeticsUnlocked: Object.keys(s.cosmetics).filter((id) => cosmeticCost(id) > 0).length,
        pactsEquipped: equippedPacts(s.characters).length,
        achvUnlockedCount: Object.keys(s.achievements).length,
        msSincePrestige: s.lastPrestigeAt ? Date.now() - s.lastPrestigeAt : Infinity,
      }
      const fresh = evaluateNewAchievements(ctx, s.achievements)
      if (!fresh.length) return
      const achievements = { ...s.achievements }
      let log = s.log
      for (const id of fresh) {
        achievements[id] = true
        const def = getAchievement(id)
        if (def) log = pushLog(log, `🏆 Haut fait débloqué : ${def.icon} ${def.name} !`, 'level')
      }
      // Les hauts faits créditent des rangs façon Maîtrise → recalcule les globaux de combat.
      refreshGlobals(s.upgrades, s.maitrise, s.constellation, achievements)
      const next = { ...s, achievements, log }
      persist(next)
      set(next)
    },

    selectTitle: (charId, achId) => {
      const s = get()
      // Titre valide = haut fait débloqué portant un titre (ou null pour retirer).
      if (achId !== null && (!s.achievements[achId] || !getAchievement(achId)?.title)) return
      const characters = s.characters.map((c) => (c.id === charId ? { ...c, title: achId ?? undefined } : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    setAvatar: (charId, sel) => {
      const s = get()
      const characters = s.characters.map((c) => (c.id === charId ? { ...c, avatar: { ...c.avatar, ...sel } } : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    unlockCosmetic: (id) => {
      const s = get()
      if (s.cosmetics[id]) return
      const cost = cosmeticCost(id)
      if (cost <= 0 || s.poussiere < cost) return
      const cosmetics = { ...s.cosmetics, [id]: true as const }
      const next = { ...s, cosmetics, poussiere: s.poussiere - cost, log: pushLog(s.log, `🎨 Cosmétique débloqué (-${cost} 🌌).`, 'info') }
      persist(next)
      set(next)
    },

    mysteryBox: (id, opts = {}) => {
      const s = get()
      const box = MYSTERY_BOXES[id]
      if (!box || s.pendingChest || s.pendingChoice) return
      // Coffre du Jour : gratuit, mais un seul par fenêtre de 22 h.
      if (box.free && Date.now() - s.lastFreeBox < FREE_BOX_COOLDOWN_MS) return
      if (box.elementPick && !opts.element) return
      // Achat en gros : ×5 d'un coup → -10% d'or. (Pas de gros sur le gratuit / le Destin.)
      const qty = box.free || box.choice ? 1 : Math.max(1, Math.min(BOX_BULK_QTY, Math.round(opts.qty ?? 1)))
      // v0.25 : verrou rareté×raids — les hautes raretés exigent d'avoir raidé (Céleste+ = raid only).
      if (bestRaidTier(s.raidProgress) < boxRaidGate(box)) return
      const goldCost = Math.round(boxGoldPrice(box, s.bestStage) * qty * (qty >= BOX_BULK_QTY ? BOX_BULK_DISCOUNT : 1))
      const fragCost = (box.costFragments ?? 0) * qty
      const cosmicCost = (box.costCosmic ?? 0) * qty
      if (s.gold < goldCost || s.fragments < fragCost || s.cosmic < cosmicCost) return

      // B1 — les coffres (souvent gated par raid) suivent la référence du compte, pas seulement le farm.
      const ilvl = Math.max(1, referenceIlvl(s.bestStage, s.raidProgress, s.dungeonProgress))
      // Karma du marchand 🍀 : la malchance accumulée gonfle la chance de jackpot, reset au proc.
      const pityBonus = Math.min(BOX_PITY_CAP, s.boxPity * BOX_PITY_STEP)
      let jackpotHit = false
      // Maillon Faible : cible l'emplacement le plus FAIBLE (vide ou au score le plus bas) du perso actif.
      const weakType = box.weakest ? weakestSlotType(s.characters[s.activeChar] ?? s.characters[0]) : undefined

      const rollOne = (): Item => {
        const proc = box.jackpot > 0 && Math.random() < Math.min(0.95, box.jackpot + pityBonus)
        if (proc) jackpotHit = true
        const rarity = rollBoxRarity(box.minTier, box.maxTier, proc ? 1 : 0)
        const type = weakType ?? box.type ?? (box.types ? box.types[Math.floor(Math.random() * box.types.length)] : undefined)
        return generateItem({
          ilvl, rarity, primaryBias: pickBias(s.characters),
          ...(box.primary ? { primary: box.primary } : {}),
          ...(type ? { type } : {}),
          ...(box.guaranteeAffix ? { forceStat: box.guaranteeAffix } : {}),
          ...(box.biasResist ? { biasResist: DAMAGE_TYPE_LIST[Math.floor(Math.random() * DAMAGE_TYPE_LIST.length)] } : {}),
          ...(opts.element ? { forceDmgType: opts.element, element: opts.element } : {}),
        })
      }

      const items: Item[] = []
      let cursedWins = 0
      let cursedFails = 0
      for (let q = 0; q < qty; q++) {
        if (box.cursed) {
          // Coffre Maudit 🎲 : pile, contenu doublé ; face, un seul objet Commun.
          if (Math.random() < CURSED_WIN_CHANCE) {
            cursedWins++
            for (let i = 0; i < box.count * 2; i++) items.push(rollOne())
          } else {
            cursedFails++
            items.push(generateItem({ ilvl, rarity: 'commun', primaryBias: pickBias(s.characters) }))
          }
        } else {
          for (let i = 0; i < box.count; i++) items.push(rollOne())
        }
      }
      // Collectionneur 📖 : l'objet porte un effet unique JAMAIS DÉCOUVERT (complète le Grimoire).
      if (box.collector && items.length) items[0].unique = undiscoveredUnique(s.codex)
      // Garantie d'unique : si aucun objet n'en a, on en pose un sur le meilleur.
      if (box.guaranteeUnique && !items.some((it) => it.unique)) {
        const best = items.reduce((a, b) => (RARITIES[b.rarity].tier > RARITIES[a.rarity].tier ? b : a), items[0])
        if (best) best.unique = randomUniqueInstance()
      }

      // Lapidaire 💎 : poussière de gemme scalée sur le record + chance de gemme de condition.
      const gemDustGain = box.gemDust ? Math.round(box.gemDust * (1 + s.bestStage / 50)) * qty : 0
      let gem: ChestReward['gem']
      if (box.gemChance && Math.random() < 1 - Math.pow(1 - box.gemChance, qty)) {
        const g = rollCondGem()
        gem = { id: g.id, rank: 1 }
      }

      // Le pity ne bouge que sur les coffres qui TIRENT des raretés (pas Trousseau/Lapidaire purs).
      const rolled = !box.cursed ? box.count > 0 : true
      const boxPity = rolled ? (jackpotHit ? 0 : s.boxPity + qty) : s.boxPity

      const extraCost = `${fragCost ? ` -${fragCost} ✨` : ''}${cosmicCost ? ` -${cosmicCost} 💫` : ''}`
      const bulk = qty > 1 ? ` ×${qty} (-10%)` : ''
      const cursedNote = box.cursed ? (cursedFails && !cursedWins ? ' 🎲 Maudit !' : cursedWins && !cursedFails ? ' 🎲 Malédiction déjouée : contenu doublé !' : ' 🎲 Fortunes mêlées.') : ''
      const logLine = box.free
        ? `🗓️ Coffre du Jour ouvert — reviens dans 22 h !`
        : `${box.name}${bulk} acheté (-${goldCost.toLocaleString('fr-FR')} or${extraCost}) !${cursedNote}`

      const base = {
        ...s,
        gold: s.gold - goldCost,
        fragments: s.fragments - fragCost,
        cosmic: s.cosmic - cosmicCost,
        boxPity,
        lastFreeBox: box.free ? Date.now() : s.lastFreeBox,
        tut: { ...s.tut, bought: true }, // v0.31 — quête tuto « Marché »
        log: pushLog(s.log, logLine, 'gold'),
      }
      // Coffre du Destin 🎭 : les objets partent dans le modal de CHOIX (un seul sera gardé).
      const next = box.choice
        ? { ...base, pendingChoice: { name: box.name, items } }
        : {
            ...base,
            pendingChest: {
              dungeonName: box.name, level: 0, items, gold: 0,
              sceaux: (box.sceaux ?? 0) * qty, orbes: (box.orbes ?? 0) * qty,
              eclats: (box.eclats ?? 0) * qty, noyau: (box.noyau ?? 0) * qty,
              poussiere: (box.poussiere ?? 0) * qty, fragments: (box.fragments ?? 0) * qty,
              gemDust: gemDustGain, gem,
            } satisfies ChestReward,
          }
      persist(next)
      set(next)
    },

    chooseFromChoice: (index) => {
      const s = get()
      const pc = s.pendingChoice
      if (!pc) return
      const chosen = pc.items[index]
      if (!chosen) return
      let essence = s.essence
      let poussiere = s.poussiere
      for (let i = 0; i < pc.items.length; i++) {
        if (i === index) continue
        essence += recycleValue(pc.items[i])
        poussiere += recyclePoussiere(pc.items[i])
      }
      const inventory = [chosen, ...s.inventory].slice(0, invMax)
      const next = {
        ...s, essence, poussiere, inventory,
        codex: discoverFromItems(s.codex, [chosen]),
        pendingChoice: null,
        log: pushLog(s.log, `🎭 Destin scellé : ${chosen.name} gardé, le reste recyclé en éclats.`, 'loot'),
      }
      persist(next)
      set(next)
    },

    recruitCharacter: () => {
      const s = get()
      if (s.characters.length >= 3) return
      const idx = s.characters.length - 1
      const cost = RECRUIT_COST[idx] ?? 250000
      const pous = RECRUIT_POUSSIERE[idx] ?? 0
      if (s.gold < cost || s.poussiere < pous) return
      const bias: OffensiveStat = s.characters.length === 1 ? 'agilite' : 'intelligence'
      const name = RECRUE_NAMES[idx] ?? 'Recrue'
      const characters = [...s.characters, makeCharacter(name, highestLevel(s.characters), bias)]
      const next = { ...s, gold: s.gold - cost, poussiere: s.poussiere - pous, characters, log: pushLog(s.log, `🧑‍🤝‍🧑 ${name} recruté(e) (-${cost} or${pous ? `, -${pous} 🌌` : ''}) !`, 'level') }
      persist(next)
      set(next)
    },

    reset: () => {
      const fresh = freshSave()
      localStorage.removeItem(SAVE_KEY)
      cooldowns.clear()
      refreshGlobals(fresh.upgrades, fresh.maitrise, fresh.constellation, fresh.achievements)
      set({
        ...fresh,
        enemy: makeEnemy(fresh.stage, fresh.activeBiome),
        log: [{ id: logId++, text: 'Nouvelle partie commencée.', kind: 'info' }],
        killCount: 0,
        pendingOffline: null,
      } as GameState)
    },

    // v0.27 (Lot 5) — ÉVEIL PRIMORDIAL : reset DUR contre des Échos. Conserve Échos + Constellation +
    // 1 Relique (slot choisi, iLvl plancher) + record de progression (gating) + XP des métiers.
    awaken: (relicSlot) => {
      const s = get()
      if (!raidUnlocked(getRaidDef('abysse'), s.bestStage, s.raidProgress)) return // éligible dès l'Abîme débloqué
      const pm = constellationMods(s.constellation)
      const raidsBeaten = Object.values(s.raidProgress).filter((t) => (t ?? 0) > 0).length
      const gained = echosGain(bestRaidTier(s.raidProgress), s.bestStage, raidsBeaten, pm.echosMult)
      // Relique : pièce choisie sur le perso actif, ramenée au plancher d'iLvl.
      const active = s.characters[s.activeChar] ?? s.characters[0]
      const kept = relicSlot ? active?.equipment[relicSlot] : undefined
      const relic: Item | null = kept ? relicFromItem(kept, RELIC_BASE_ILVL + pm.relicFloor) : null

      const fresh = freshSave()
      let base = {
        ...fresh,
        onboarded: true, // prestige ≠ nouvelle partie : pas de réaffichage de l'écran d'accueil.
        echos: s.echos + gained,
        prestigeRank: s.prestigeRank + 1,
        lastPrestigeAt: Date.now(), // ⏱️ départ du chrono « Renaissance Fulgurante »
        constellation: s.constellation,
        achievements: s.achievements, // 🏆 hauts faits conservés (permanents au compte)
        cosmetics: s.cosmetics,       // 🎨 cosmétiques débloqués conservés
        relic,
        raidProgress: s.raidProgress, // record conservé (gating des contenus)
        metiers: s.metiers,           // XP métiers conservée (choix A)
        inventory: relic ? [relic] : [],
      }
      // ✨ Première étincelle : coup de pouce de démarrage (or + ~3 niveaux).
      if (pm.etincelle) {
        const lvlXp = xpForLevel(1) + xpForLevel(2) + xpForLevel(3)
        base = { ...base, gold: 5000 * base.prestigeRank, characters: base.characters.map((c) => grantXp(c, lvlXp)) }
      }
      cooldowns.clear()
      refreshGlobals(base.upgrades, base.maitrise, base.constellation, base.achievements)
      const logged = {
        ...base,
        enemy: makeEnemy(base.stage, base.activeBiome),
        log: [{ id: logId++, text: `✨ ÉVEIL PRIMORDIAL #${base.prestigeRank} : +${gained} Échos 💠.${relic ? ` Relique conservée : ${relic.name}.` : ''} Une nouvelle vie commence.`, kind: 'level' }],
        killCount: 0,
        pendingOffline: null,
      } as GameState
      persist(logged)
      set(logged)
    },

    // v0.27 (Lot 5) — investit des Échos dans un nœud de Constellation.
    allocateConstellation: (nodeId) => {
      const s = get()
      const node = getConstNode(nodeId)
      if (!node) return
      const cur = s.constellation[nodeId] ?? 0
      if (cur >= node.maxRank) return
      const cost = nodeCost(node, cur)
      if (s.echos < cost) return
      const constellation = { ...s.constellation, [nodeId]: cur + 1 }
      refreshGlobals(s.upgrades, s.maitrise, constellation, s.achievements)
      const next = { ...s, echos: s.echos - cost, constellation, log: pushLog(s.log, `💠 Constellation : ${node.icon} ${node.name} → rang ${cur + 1} (−${cost} Échos).`, 'level') }
      persist(next)
      set(next)
    },
  }
})

export { xpForLevel }
