/**
 * STORE ZUSTAND — le cœur runtime du jeu. Tient TOUT l'état mutable (`GameState`), expose les
 * actions, fait tourner la BOUCLE DE COMBAT (`tick`, 5 Hz) et gère la SAUVEGARDE/MIGRATION
 * localStorage (`persist` → `SaveData`, clé `SAVE_KEY`).
 *
 * Règle d'or : la logique de jeu vit dans les modules PURS de `game/` ; le store ne fait
 * qu'orchestrer l'état et appeler ces fonctions. Les champs transitoires (cooldowns, compteurs
 * de gemmes, états d'archétype) ne sont PAS persistés.
 *   → Doc : docs/systemes/10-etat-store-et-sauvegarde.md + docs/ARCHITECTURE.md
 */
import { create } from 'zustand'
import type {
  Item, PrimaryStat, OffensiveStat, SecondaryStat, EquipSlotId, ItemType, Enemy, DamageType, RarityId
} from './types'
import {
  makeCharacter, charMaxHp, computeUnlockedPowers, teamTalentPool, talentsSpent, isBuilder, isSupport,
  SUPPORT_SLOTS
} from './character'
import { getTalent, canAllocate, canAllocatePantheon, eveilBudget } from './talents'
import { getPower } from './powers'
import {
  getUpgrade, upgradeCost as accountUpgradeCost, upgradePoussiere, upgradeEclats, isMaxed, computeGlobalMods
} from './upgrades'
import {
  achievementBonuses, evaluateNewAchievements, fullyEquippedMinIlvl, getAchievement, type AchvCtx
} from './achievements'
import { cosmeticCost } from './avatar'
import {
  generateItem, rollWindowRarity, rollFarmRarity, recycleValue, recyclePoussiere, createCost, maxCraftTier,
  contentRarityTier, unlockedRarityTier, relicFromItem
} from './items'
import { constellationMods, echosGain, getConstNode, nodeCost, RELIC_BASE_ILVL } from './prestige'
import {
  craftMods, metierXpGain, canLearnNode, getMetierNode, respecCost, levelFromXp, METIERS, METIER_LIST,
  METIER_NODES, METIER_BRANCHES, AUTOMATE_FORGERON_LEVELS, pointsSpentInBranch, respecBranchCost, forgeBonus,
  signatureLingotCost, smeltLingots, MASTERWORK_LINGOTS, foyerActive, foyerRate, foyerAccrue, masterworkKey,
  frappeActive, CHALEUR_MAX, FRAPPE_HEAT_PERFECT, FRAPPE_HEAT_GOOD, FRAPPE_STREAK_RARITY, SURCHAUFFE_COST,
  type MetierId
} from './metiers'
import { itemSockets } from './gems'
import {
  getEnchant, enchantCost, equippedRules, equippedTimeRunes, timeRuneMods, rollRuneDrop, equippedPacts,
  eraseFragments, runeForgeCost, RUNE_GAMBLE_COST, ruleAmp, type TimeRuneMods, type PactMods
} from './enchants'
import { getMaitriseNode, currentWeek } from './maitrise'
import {
  condGemMods, rollCondGem, condGemKey, getCondGem, gemMaxRank, grindDust, BIOME_GEM_FAMILY, COND_GEM_DROP,
  GEM_DUST_DROP, CHAMPION_GEM_DROP, type CondGemId, type CondMods, type GemFamily, type GemQuality
} from './condGems'
import {
  tickAutomates, missionLabel, automateUpgradeCost, AUTOMATE_MAX, AUTOMATE_COSTS, AUTOMATE_NAMES,
  AUTOMATE_UPG_MAX, type Automate, type AutomateMission
} from './automates'
import {
  REAGENTS, REAGENT_DROP, getBrew, recipeForPair, EXPERIMENT_COST, BREW_QUALITIES, brewQualityAt, brewKey,
  parseBrewKey, millesimeChance, DAILY_TRANSMUTE_COST, PHILOSOPHALE_COST, PHILOSOPHALE_MULT, type BrewQuality
} from './alchimie'
import { makeEnemy, isBossStage, stageIlvl } from './enemies'
import { chapitreOf, vagueOf, raidGateForStage } from './progression'
import { type BiomeId } from './biomes'
import { maitriseBonus, surgeBiome, SURGE_GOLD_XP_MULT, SURGE_QUINT_MULT } from './biomeBonus'
import { RARITIES, RARITY_LIST } from './rarities'
import { SAVE_KEY, type SaveData, freshSave, loadSave, persist, discoverFromItems } from './save'
import {
  partyCombatStep, crescendoBonus, crescendoAdd, crescendoReset, resetAllCooldowns, resetLongestCooldown,
  tresorerieShield, gemKillEvents, requestManualCast, clearCooldowns
} from './combatEngine'
export { powerCooldowns } from './combatEngine'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES } from './damage'
import { TUT_QUESTS } from './tutorial'
import { offlineMessage, hasReward as inboxHasReward, INBOX_CAP, type InboxMessage } from './inbox'
import { dailyMetrics, rollDaily, getDailyQuest, questDone, todayStr, LOGIN_REWARDS } from './daily'
import { rollEvent, eventPoints, EVENT_MILESTONES, invasionAuraId } from './event'
import { insertCost, getUnique, UNIQUE_MAX_RANK, randomUniqueInstance, undiscoveredUnique } from './uniques'
import { generateDungeon, getDungeonDef, type DungeonId } from './dungeons'
import {
  generateRaid, getRaidDef, raidUnlocked, raidBossVariant, raidTierUnlockCost, raidTierCap, globalTier,
  RAID_LIST, type RaidId
} from './raids'
import { simulateOffline, type OfflineReport } from './offline'
// Phase C — helpers purs & constantes partagées extraits dans storeHelpers.ts (logique inchangée).
import {
  BOX_BULK_DISCOUNT, BOX_BULK_QTY, BOX_DUMP_SHAPE, BOX_PITY_CAP, BOX_PITY_STEP, BOX_RICH_SHAPE, CHAR2_STAGE,
  CHAR3_STAGE, CHOOSE_UNIQUE_COST, CLASSIC_GOLD_MULT, CLASSIC_XP_MULT, CONTRACT_LINGOTS, CURSED_WIN_CHANCE,
  FRAGMENT_INFUSE_COST, FREE_BOX_COOLDOWN_MS, MYSTERY_BOXES, QUINT_DROP, RECRUE_NAMES, RECRUIT_COST,
  RECRUIT_POUSSIERE, RETREAT_STAGES, SCEAU_COST, activeBrewBuffs, addQuint, applyChestRewards, applyItemPatch,
  autoEquipEmpties, bestRaidTier, boxGoldPrice, conseilProgress, findItemById, forgeContractsForDay, fullHeal,
  gainMetierXp, generateShop, grantTeamXp, highestLevel, invMax, nextLogId, pickBias, pushLog, quintTierMult,
  refreshGlobals, shopBuyPrice, shopRefreshCost, teamGemOpts, teamPactMods, tickDungeon, tickRaid, tutContext,
  weakestSlotType, xpForLevel
} from './storeHelpers'
// Ré-exports pour l'UI (les composants importent ces helpers/consts depuis './store').
export {
  bestRaidTier, forgeContractsForDay, CONTRACT_LINGOTS, xpForLevel, tutContext, maxContentIlvl,
  referenceIlvl, FRAGMENT_INFUSE_COST, CHOOSE_UNIQUE_COST, SCEAU_COST, MYSTERY_BOXES, boxGoldPrice,
  FREE_BOX_COOLDOWN_MS, BOX_BULK_QTY, BOX_BULK_DISCOUNT, BOX_PITY_STEP, BOX_PITY_CAP,
  RECRUIT_COST, RECRUIT_POUSSIERE,
} from './storeHelpers'
import { createWorldSlice } from './worldSlice'
import { createStuffSlice } from './stuffSlice'
import { createGemsSlice } from './gemsSlice'


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
  /** v0.41 — Surchauffe : dépense de la Chaleur (mini-jeu de Frappe) pour +1 ⭐ garanti. */
  surchauffe?: boolean
}

/** v0.26 — Contrat de forge quotidien : « forge-moi CETTE pièce ». */
export interface ForgeContractDef {
  type: ItemType
  primary: OffensiveStat
  /** Tier de rareté minimal exigé (calé sur ton plafond de craft − 2). */
  minTier: number
}

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


/** Progression par donjon-ressource (chaque donjon monte indépendamment). */
export type DungeonProgress = Record<DungeonId, number>

/** Progression par raid (chaque raid monte indépendamment). */
export type RaidProgress = Record<RaidId, number>






export interface GameState extends SaveData {
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
  /** 🔨 FRAPPE (v0.41) : une frappe du mini-jeu (parfait/bien/raté) → Chaleur + série + XP. */
  strikeForge: (result: 'perfect' | 'good' | 'miss') => void
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
  /** Équipe un sort de SOUTIEN (builder OU bouclier/soin) dans l'un des 3 slots dédiés (auto-cast). */
  setSupport: (slot: number, powerId: string | null) => void
  /** Bascule un emplacement de capacité entre AUTO et MANUEL (perso actif). */
  togglePowerAuto: (slot: number, charIndex?: number) => void
  /** Lance MANUELLEMENT la capacité d'un emplacement — strict : ne part qu'au prochain tick si prête.
   *  `charIndex` (v0.36) : cible N'IMPORTE QUEL héros, pas seulement l'actif (UI combat multi-perso). */
  castPower: (slot: number, charIndex?: number) => void
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
  /** v0.36 (lot 8) — l'apparence est désormais au niveau du COMPTE (un seul badge). On l'édite via le
   *  perso-ancre characters[0] ; plus de charId. */
  setAvatar: (sel: { palette?: string; emblem?: string; border?: string; aura?: string }) => void
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



/** ⚗️ Buffs d'OFFICINE actifs (élixir, huile, antidote, mutagène) — les expirés sont ignorés. */
export interface BrewBuffs {
  dmgMult: number
  goldMult: number
  hpMult: number
  speedMult: number
  oil: { type: DamageType; pct: number } | null
  antidote: { type: DamageType; pct: number } | null
}


export interface MysteryBox {
  id: number
  name: string
  icon: string
  gold: number
  count: number
  // v0.40.4 — la rareté n'est PLUS figée par coffre : elle suit la rareté DÉBLOQUÉE du compte
  // (unlockedRarityTier → fenêtre [top−4 → top]). `priceTier` ne sert qu'au POIDS DE PRIX (boxGoldPrice).
  priceTier: number
  /** Forme « premium » (Cosmique/Néant) : traîne haute moins raide → ~6% de rareté débloquée (vs ~1.7%). */
  richTail?: boolean
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


// ---- Combat d'équipe ----

export interface CombatMods {
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
      save.characters = grantTeamXp(save.characters, report.xp).chars
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
      if (ar.xpEach > 0) save.characters = grantTeamXp(save.characters, ar.xpEach).chars
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
      ...autoLogLines.map((text) => ({ id: nextLogId(), text, kind: 'craft' as LogKind })),
      { id: nextLogId(), text: 'Bienvenue, guerrier. Le combat commence.', kind: 'info' as LogKind },
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
        if (ar.xpEach > 0) characters = grantTeamXp(characters, ar.xpEach).chars
        s = { ...s, ...ar.eco, characters, log }
        if (ar.completed) persist(s)
      }

      // 🔥 Le Foyer (v0.41) : production idle d'XP + Lingots, en parallèle de tout (farm/donjon/raid).
      // Crédité par paquets toutes ~2 s (lissé) ; au retour d'absence, le grand écart est plafonné (12 h).
      if (foyerActive(s.metiers) && Date.now() - s.foyer.lastTick >= 2000) {
        const rate = foyerRate(s.metiers, s.automates.length, s.bestStage, s.foyer.masterworkKeys.length)
        const acc = foyerAccrue(s.foyer, rate, Date.now())
        let foyerLog = s.log
        let foyerMetiers = s.metiers
        if (acc.xp > 0) {
          const g = gainMetierXp({ metiers: foyerMetiers, log: foyerLog, characters: s.characters }, 'forgeron', acc.xp)
          foyerMetiers = g.metiers
          foyerLog = g.log
        }
        s = { ...s, foyer: acc.foyer, metiers: foyerMetiers, lingots: s.lingots + acc.lingots, log: foyerLog }
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
        // v0.36 — régén des murs Ch.6+ (sustain check) ; le tick l'applique à l'ennemi (mods.regen).
        regen: s.enemy.mur?.regen,
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
        log = pushLog(log, `💀 Équipe vaincue ! Repli au Chapitre ${chapitreOf(stage)} · Vague ${vagueOf(stage)}.`, 'death')
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

        {
          const r = grantTeamXp(chars, xpGain)
          chars = r.chars
          if (r.leveled) log = pushLog(log, `⬆ Niveau de compte ${chars[0].level} !`, 'level')
        }
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

        // Le verrou de farm fige la progression. GATE DE RAID (v0.36) : franchir le mur d'un vrai
        // Chapitre (5→14) exige le Raid T(c−4) ; tant qu'il n'est pas vaincu, on reste au mur (Prologue
        // 1-5 et Chapitre++ ≥ 16 libres). Le mur reste farmable, mais n'avance plus.
        const gateTier = raidGateForStage(stage)
        const gateLocked = gateTier > 0 && bestRaidTier(s.raidProgress) < gateTier
        let characters = chars
        let biomeBest = s.biomeBest
        let conseil = s.conseil
        let maitrisePoints = s.maitrisePoints
        if (!s.farmLock && !gateLocked) {
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

        // v0.39 — chaque VAGUE de farm démarre FRAÎCHE : PV pleins, bouclier purgé et recharges
        // remises à zéro (comme l'« entrée fraîche » en donjon). Le farm n'est plus une épreuve
        // d'attrition entre vagues ; les boucliers de départ (Réservoir/Doctrine, Égide) se
        // réarment au 1er tick face au nouvel ennemi via gemFightStart.
        characters = characters.map(fullHeal)
        resetAllCooldowns(characters)

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

    ...createWorldSlice(set, get),

    ...createStuffSlice(set, get),
    ...createGemsSlice(set, get),
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
      // v0.40.1 — la forge crée au niveau de ton FARM (palier) + bonus de métier — PLUS les donjons/raids,
      // qui faisaient sauter l'ilvl bien au-dessus du farm (ex. donjon nv 8 / raid T4 = ilvl 105 à palier 50).
      const ilvl = stageIlvl(Math.max(1, s.bestStage)) + forge.ilvlBonus
      // 🏆 Chef-d'œuvre (étage V) : 1/semaine, +1 cran GARANTI (capé), châsse garantie, coût ×1,5 + Lingots.
      const week = currentWeek()
      const masterwork = !!opts.masterwork
      if (masterwork && (!forge.masterwork || s.lastMasterwork >= week || s.lingots < MASTERWORK_LINGOTS)) return
      // ✒️ Signature : affixe garanti AU CHOIX (universel, débloqué par le nœud Signature) — coûte des Lingots.
      const signature = opts.signature && forge.signatures?.includes(opts.signature) ? opts.signature : undefined
      const signCost = signature ? Math.max(1, Math.round(signatureLingotCost(tier) * mods.signatureCostMult)) : 0
      if (signature && s.lingots < signCost + (masterwork ? MASTERWORK_LINGOTS : 0)) return
      // Coût : rareté choisie × métier (Économe) × chef-d'œuvre (×1,5).
      const c = createCost(tier, ilvl, contentRarityTier(s.bestStage, bestRaidTier(s.raidProgress)))
      const m = mods.costMult * (masterwork ? 1.5 : 1)
      const cost = { eclats: Math.round(c.eclats * m), noyau: Math.round(c.noyau * m), fragments: Math.round((c.fragments ?? 0) * m), poussiere: Math.round((c.poussiere ?? 0) * m), cosmic: Math.round((c.cosmic ?? 0) * m) }
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < cost.fragments || s.poussiere < cost.poussiere || s.cosmic < cost.cosmic) return
      // 🎲 Prodige : chance de rareté SUPÉRIEURE (corps IV : +12% local) — 💡 Inspiration : DEUX crans.
      const lucky = masterwork || (Math.random() < Math.min(0.75, mods.luckChance + forge.luckBonus + mods.chainChance + mods.creuset) && tier < craftCap)
      const inspired = lucky && !masterwork && mods.inspiration > 0 && Math.random() < mods.inspiration && tier + 2 <= craftCap
      // 🔨 Frappe maîtrisée : 5 PARFAITS d'affilée → +1 cran de rareté GARANTI (consommé ici).
      const streakReady = frappeActive(s.metiers) && s.chaleurStreak >= FRAPPE_STREAK_RARITY && tier < craftCap
      // 🔥 Surchauffe : dépense de Chaleur → +1 ⭐ garanti sur la pièce.
      const surchauffe = !!opts.surchauffe && frappeActive(s.metiers) && s.chaleur >= SURCHAUFFE_COST
      const prodTier = Math.min(craftCap, tier + (inspired ? 2 : lucky ? 1 : 0) + (streakReady ? 1 : 0))
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
      // 🔥 Surchauffe : +1 ⭐ garanti (capé à 5).
      if (surchauffe) item.stars = Math.min(5, (item.stars ?? 0) + 1)
      // ◈ Chaîne « qualité » + Creuset : chance d'un ⭐ supplémentaire (synergies hexagonales, Lot 4).
      if (Math.random() < mods.chainQualite + mods.creuset) item.stars = Math.min(5, (item.stars ?? 0) + 1)
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
      if (streakReady) log = pushLog(log, `⚡ Frappe maîtrisée : +1 cran de rareté garanti !`, 'craft')
      if (surchauffe) log = pushLog(log, `🔥 Surchauffe : +1 ⭐ (−${SURCHAUFFE_COST} Chaleur).`, 'craft')
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
      // 🔥 Foyer : un Chef-d'œuvre d'un type INÉDIT accélère la production passive (boucle vertueuse).
      let foyer = s.foyer
      if (masterwork) {
        const mwk = masterworkKey(item.type, item.primary, item.damageType, item.rarity)
        if (!foyer.masterworkKeys.includes(mwk)) foyer = { ...foyer, masterworkKeys: [...foyer.masterworkKeys, mwk] }
      }
      const next = {
        ...s,
        foyer,
        chaleur: surchauffe ? s.chaleur - SURCHAUFFE_COST : s.chaleur,
        chaleurStreak: streakReady ? 0 : s.chaleurStreak,
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

    strikeForge: (result) => {
      const s = get()
      if (!frappeActive(s.metiers)) return
      let chaleur = s.chaleur
      let streak = s.chaleurStreak
      let xpGain = 0
      if (result === 'perfect') {
        chaleur = Math.min(CHALEUR_MAX, chaleur + FRAPPE_HEAT_PERFECT)
        streak += 1
        xpGain = metierXpGain(2, 'modify', craftMods(s.metiers).forgeronXpMult)
      } else if (result === 'good') {
        chaleur = Math.min(CHALEUR_MAX, chaleur + FRAPPE_HEAT_GOOD)
        xpGain = 1
      } else {
        streak = 0
      }
      const g = xpGain > 0 ? gainMetierXp(s, 'forgeron', xpGain) : { metiers: s.metiers, log: s.log }
      const next = { ...s, chaleur, chaleurStreak: streak, metiers: g.metiers, log: g.log }
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
      const tierS = RARITIES[item.rarity].tier
      const lingots = Math.max(1, Math.round(base * mods.lingotierMult))
      // ◆ Haut fourneau (keystone Fondeur) : burst d'XP (fonte = 'ascend' ×2) + remboursement d'éclats.
      const gain = mods.hautFourneau
        ? metierXpGain(tierS, 'ascend', mods.forgeronXpMult) * 2
        : metierXpGain(tierS, 'modify', mods.forgeronXpMult)
      const eclatsRefund = mods.hautFourneau ? Math.round(tierS * tierS * 6) : 0
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = {
        ...s,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        lingots: s.lingots + lingots,
        essence: s.essence + eclatsRefund,
        metiers: g.metiers,
        log: pushLog(g.log, `🫕 Fondu : ${item.name} → +${lingots} Lingot${lingots > 1 ? 's' : ''} 🧱${mods.hautFourneau ? ` · 🌋 +${eclatsRefund} ♦ & burst d'XP` : ''}.`, 'craft'),
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
      // v0.36 — cap de tiers par raid (l'Abîme s'arrête à 2). Au-delà, plus de déblocage.
      if (cur + 1 > raidTierCap(def)) return
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
      if (powerId && isBuilder(getPower(powerId))) return // un builder va en SOUTIEN (auto-cast pur)
      const powers = char.powers.map((x) => (x === powerId ? null : x)) // unicité
      powers[slot] = powerId
      // MULTI-LANE (v0.39) : un bouclier/soin peut vivre en actif OU en soutien — jamais les deux.
      const support = (char.support ?? [null, null, null]).map((x) => (x === powerId ? null : x))
      const nc = { ...char, powers, support }
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

    // v0.39 : équipe un sort de SOUTIEN (builder OU bouclier/soin) dans l'un des 3 slots (auto-cast pur).
    setSupport: (slot, powerId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      const cur = char?.support ?? [null, null, null]
      if (!char || slot < 0 || slot >= SUPPORT_SLOTS) return
      if (powerId && !char.unlockedPowers.includes(powerId)) return
      if (powerId && !isSupport(getPower(powerId))) return // builders + boucliers/soins uniquement
      const support = cur.map((x) => (x === powerId ? null : x)) // unicité
      support[slot] = powerId
      // MULTI-LANE (v0.39) : retirer des actifs si le même sort y était (vit dans une seule lane).
      const powers = char.powers.map((x) => (x === powerId ? null : x))
      const nc = { ...char, support, powers }
      nc.hp = Math.min(nc.hp, charMaxHp(nc))
      const characters = s.characters.map((c, i) => (i === s.activeChar ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    togglePowerAuto: (slot, charIndex) => {
      const s = get()
      const idx = charIndex ?? s.activeChar
      const char = s.characters[idx]
      if (!char || slot < 0 || slot >= char.powers.length) return
      const powerAuto = char.powers.map((_, i) => (i === slot ? char.powerAuto?.[i] === false : char.powerAuto?.[i] !== false))
      const nc = { ...char, powerAuto }
      const characters = s.characters.map((c, i) => (i === idx ? nc : c))
      const next = { ...s, characters }
      persist(next)
      set(next)
    },

    castPower: (slot, charIndex) => {
      const s = get()
      const char = s.characters[charIndex ?? s.activeChar]
      if (!char) return
      const pid = char.powers[slot]
      if (!pid || char.powerAuto?.[slot] !== false) return // doit être en MANUEL
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      // Posé en attente : le prochain tick le lancera si la recharge est prête (strict, pas de file).
      requestManualCast(char.id, pid)
    },

    allocateTalent: (nodeId) => {
      const s = get()
      const char = s.characters[s.activeChar]
      if (!char) return
      const node = getTalent(nodeId)
      // v0.36 — budget = POOL PARTAGÉ (teamTalentPool), pas char.talentPoints. Dépenser baisse le pool
      // (dérivé du total dépensé) → pas de champ à décrémenter, pas de désync.
      const pool = teamTalentPool(s.characters, s.upgrades.talentBonus ?? 0)
      if (!node || !canAllocate(node, char.talents, pool)) return
      const talents = { ...char.talents, [nodeId]: (char.talents[nodeId] ?? 0) + 1 }
      const unlockedPowers = computeUnlockedPowers({ ...talents, ...(char.pantheon ?? {}) }, char.level)
      const nc = { ...char, talents, unlockedPowers }
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
      const unlockedPowers = computeUnlockedPowers({ ...talents, ...(char.pantheon ?? {}) }, char.level)
      const powers = char.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const passives = (char.passives ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const support = (char.support ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      // v0.36 — pas de champ talentPoints à rembourser : le pool partagé remonte tout seul (moins dépensé).
      const nc = { ...char, talents, unlockedPowers, powers, passives, support }
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
      const unlockedPowers = computeUnlockedPowers({ ...char.talents, ...next2 }, char.level)
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
      const unlockedPowers = computeUnlockedPowers({ ...char.talents, ...pantheon }, char.level)
      const powers = char.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const passives = (char.passives ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const support = (char.support ?? []).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, pantheon, unlockedPowers, powers, passives, support }
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
        support: [...(char.support ?? [])],
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
      // v0.36 — budget = POOL PARTAGÉ + ce que CE perso avait dépensé (remboursé en repartant de zéro).
      let points = teamTalentPool(s.characters, s.upgrades.talentBonus ?? 0) + talentsSpent(char)
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
      const unlockedPowers = computeUnlockedPowers({ ...talents, ...(char.pantheon ?? {}) }, char.level)
      const powers = preset.powers.map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const passives = (preset.passives ?? [null, null, null]).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const support = (preset.support ?? [null, null, null]).map((p) => (p && unlockedPowers.includes(p) ? p : null))
      const nc = { ...char, talents, unlockedPowers, powers, passives, support, primaryBias: preset.primaryBias }
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
      // v0.36 — 'talentBonus' n'écrit plus de champ par-perso : le bonus est lu depuis upgrades.talentBonus
      // par teamTalentPool (pool partagé), donc +1 au pool de COMPTE (pas +1 par perso).
      const characters = s.characters
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
      let log = pushLog(s.log, `🎉 Invasion — jalon ${index + 1} réclamé !`, 'level')
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

    setAvatar: (sel) => {
      const s = get()
      if (!s.characters.length) return
      // Apparence de COMPTE : éditée sur l'ancre characters[0] (badge unique). Les autres persos n'ont
      // plus d'apparence cosmétique propre (juste leur classe).
      const characters = s.characters.map((c, i) => (i === 0 ? { ...c, avatar: { ...c.avatar, ...sel } } : c))
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
      const goldCost = Math.round(boxGoldPrice(box, s.bestStage) * qty * (qty >= BOX_BULK_QTY ? BOX_BULK_DISCOUNT : 1))
      const fragCost = (box.costFragments ?? 0) * qty
      const cosmicCost = (box.costCosmic ?? 0) * qty
      if (s.gold < goldCost || s.fragments < fragCost || s.cosmic < cosmicCost) return

      // v0.40.3 — l'ilvl du drop suit le PALIER DE FARM (comme la forge v0.40.1), plus les donjons/raids.
      const ilvl = Math.max(1, stageIlvl(s.bestStage))
      // Karma du marchand 🍀 : la malchance accumulée gonfle la chance de jackpot, reset au proc.
      const pityBonus = Math.min(BOX_PITY_CAP, s.boxPity * BOX_PITY_STEP)
      let jackpotHit = false
      // Maillon Faible : cible l'emplacement le plus FAIBLE (vide ou au score le plus bas) du perso actif.
      const weakType = box.weakest ? weakestSlotType(s.characters[s.activeChar] ?? s.characters[0]) : undefined
      // v0.40.4 — fenêtre de rareté = rareté DÉBLOQUÉE du compte (palier/donjon/raid), pic au plancher.
      const rTop = unlockedRarityTier(bestRaidTier(s.raidProgress))
      const rFloor = Math.max(1, rTop - 4)

      const rollOne = (): Item => {
        const proc = box.jackpot > 0 && Math.random() < Math.min(0.95, box.jackpot + pityBonus)
        if (proc) jackpotHit = true
        // Standard : forme « dump » (sommet ~1,7%). Premium (richTail) ou jackpot : forme riche (~6%).
        const shape = box.richTail || proc ? BOX_RICH_SHAPE : BOX_DUMP_SHAPE
        const rarity = rollWindowRarity(rFloor, rFloor, rTop, shape)
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
      clearCooldowns()
      refreshGlobals(fresh.upgrades, fresh.maitrise, fresh.constellation, fresh.achievements)
      set({
        ...fresh,
        enemy: makeEnemy(fresh.stage, fresh.activeBiome),
        log: [{ id: nextLogId(), text: 'Nouvelle partie commencée.', kind: 'info' }],
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
        base = { ...base, gold: 5000 * base.prestigeRank, characters: grantTeamXp(base.characters, lvlXp).chars }
      }
      clearCooldowns()
      refreshGlobals(base.upgrades, base.maitrise, base.constellation, base.achievements)
      const logged = {
        ...base,
        enemy: makeEnemy(base.stage, base.activeBiome),
        log: [{ id: nextLogId(), text: `✨ ÉVEIL PRIMORDIAL #${base.prestigeRank} : +${gained} Échos 💠.${relic ? ` Relique conservée : ${relic.name}.` : ''} Une nouvelle vie commence.`, kind: 'level' }],
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

