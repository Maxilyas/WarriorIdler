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
// `createWithEqualityFn` (= `create` + support natif d'une fn d'égalité au 2ᵉ arg de `useGame`, SANS
// le warning de dépréciation zustand v4.5). Importé ici (bundle principal) → pas de double React dans
// les chunks lazy, contrairement à `useStoreWithEqualityFn` importé directement dans un panneau lazy.
import { createWithEqualityFn as create } from 'zustand/traditional'
import type {
  Item, PrimaryStat, OffensiveStat, SecondaryStat, EquipSlotId, ItemType, Enemy, DamageType, RarityId
} from './types'
import { achievementBonuses } from './achievements'
import { constellationMods } from './prestige'
import { craftMods, type MetierId } from './metiers'
import { equippedRules, ruleAmp, type TimeRuneMods, type PactMods } from './enchants'
import { type CondGemId, type CondMods, type GemFamily, type GemQuality } from './condGems'
import { type UniqueActiveMods } from './uniques'
import { tickAutomates, type AutomateMission } from './automates'
import { makeEnemy } from './enemies'
import { type BiomeId } from './biomes'
import { type SaveData, loadSave, freshSave, persist } from './save'
import { bootStorage, SLOT0, type StorageMode } from './saveSlots'
export { powerCooldowns } from './combatEngine'
import { offlineMessage, INBOX_CAP, type InboxMessage } from './inbox'
import { dailyMetrics, rollDaily, todayStr } from './daily'
import { rollEvent } from './event'
import { type DungeonId } from './dungeons'
import { type RaidId } from './raids'
import { simulateOffline, type OfflineReport } from './offline'
// Phase C — helpers purs & constantes partagées extraits dans storeHelpers.ts (logique inchangée).
import { addQuint, grantTeamXp, invMax, nextLogId, refreshGlobals } from './storeHelpers'
// Ré-exports pour l'UI (les composants importent ces helpers/consts depuis './store').
export {
  bestRaidTier, forgeContractsForDay, CONTRACT_LINGOTS, xpForLevel, tutContext, maxContentIlvl,
  referenceIlvl, FRAGMENT_INFUSE_COST, CHOOSE_UNIQUE_COST, SCEAU_COST, MYSTERY_BOXES, boxGoldPrice,
  boxRarityWindow, FREE_BOX_COOLDOWN_MS, BOX_BULK_QTY, BOX_BULK_DISCOUNT, BOX_PITY_STEP, BOX_PITY_CAP,
  RECRUIT_COST, RECRUIT_POUSSIERE,
} from './storeHelpers'
import { createWorldSlice } from './worldSlice'
import { createStuffSlice } from './stuffSlice'
import { createGemsSlice } from './gemsSlice'
import { createOfficineSlice } from './officineSlice'
import { createAtelierSlice } from './atelierSlice'
import { createExpeditionsSlice } from './expeditionsSlice'
import { createHerosSlice } from './herosSlice'
import { createLiveopsSlice } from './liveopsSlice'
import { createMarketSlice } from './marketSlice'
import { createTickSlice } from './tickSlice'


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
  /** Signature (Compagnonnage III) : affixe garanti au choix (coûte des Lingots 🧱). */
  signature?: SecondaryStat
  /** Chef-d'œuvre hebdomadaire (Compagnonnage V) : +1 cran garanti + châsse garantie. */
  masterwork?: boolean
  /** Surchauffe : dépense de la Chaleur (mini-jeu de Frappe) pour +1 ⭐ garanti. */
  surchauffe?: boolean
}

/** Contrat de forge quotidien : « forge-moi CETTE pièce ». */
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
  /** Palier 2 — false tant que le boot async (lecture du stockage durable) n'a pas hydraté le store.
   *  Transitoire (jamais persisté) : tant que !booted, l'UI montre l'écran de chargement (aucun tick). */
  booted: boolean
  /** Palier 2 — mode de stockage effectif : `idb` (multi-slots) ou `local` (repli mono-slot). */
  storageMode: 'idb' | 'local'
  /** Palier 2 — id du slot actuellement chargé. */
  activeSlotId: string
  tick: (dt: number) => void
  setStage: (n: number) => void
  setBiome: (biome: BiomeId) => void
  /** force un biome contre des Fragments d'éternité (reste dessus ~1 h, puis rotation). */
  lockBiome: (biome: BiomeId) => void
  /** fait tourner la zone vers un biome ALÉATOIRE si l'échéance horaire est atteinte (timer). */
  rotateBiomeIfDue: () => void
  toggleFarmLock: () => void
  setRecycleThreshold: (tier: number) => void
  toggleAutoRecycle: () => void
  toggleAutoRecycleUseless: () => void
  insertEffect: (itemId: string, effectId: string) => void
  claimOffline: () => void
  /** réclame la récompense d'une quête du tutoriel « Premiers Pas » (si terminée et non réclamée). */
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
  /** 🎉 Réclame un seuil de l'event (le capstone débloque l'aura élémentaire). */
  claimEventMilestone: (index: number) => void
  /** cycle de vie mobile : l'appli passe en arrière-plan (horodate la mise en veille). */
  markAway: () => void
  /** retour au premier plan : crédite les gains hors-ligne accumulés en arrière-plan. */
  resumeAway: () => void
  equip: (itemId: string, targetSlot?: EquipSlotId) => void
  unequip: (slot: EquipSlotId) => void
  sell: (itemId: string) => void
  recycle: (itemId: string) => void
  sellAllBelow: (tier: number, uselessOnly?: boolean) => void
  recycleAllBelow: (tier: number, uselessOnly?: boolean) => void
  /** 🔒 Bascule le verrou anti-suppression d'un objet. */
  toggleLock: (itemId: string) => void
  /** Vend en lot une sélection d'objets (ignore les verrouillés). */
  sellMany: (itemIds: string[]) => void
  /** Recycle en lot une sélection d'objets (ignore les verrouillés). */
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
  /** 🛒 Échoppe de gemmes : achète une gemme de condition (rang 1) contre Poussière de gemme 🔹, sans Joaillier. */
  buyGem: (condId: CondGemId) => void
  /** RECOUPE (Joaillier) : monte d'un rang le paramètre d'une gemme SERTIE (poussière 🔹). */
  recutGem: (itemId: string, index: number) => void
  /** FUSION : 3 gemmes identiques du stock → 1 gemme au rang supérieur. */
  fuseGems: (key: string) => void
  /** 🔥 Fusionne d'un coup TOUS les lots de gemmes éligibles (cascade incluse). */
  fuseAllGems: () => void
  /** CORRUPTION : retaille risquée d'une gemme du stock (rang +1 / rien / broyée). */
  corruptGem: (key: string) => void
  /** PERÇAGE : ajoute UNE châsse à un objet (très cher, une fois par objet). */
  drillSocket: (itemId: string) => void
  /** ⚖️ Marché aux pierres : 1/jour, 3 gemmes du stock → 1 gemme au CHOIX (rang = min). */
  tradeGems: (keys: string[], targetId: CondGemId) => void
  /** Grave (ou remplace) la rune d'enchantement d'un objet (coût : Savoir-faire + éclats). */
  enchantItem: (itemId: string, enchantId: string) => void
  /** 🧽 EFFACEMENT : sacrifie une rune possédée → Fragments runiques 🜁. */
  eraseRune: (enchantId: string) => void
  /** 🔨 FORGE RUNIQUE : forge la rune de ton CHOIX (fragments + 🌌 + or, ×1,5/exemplaire). */
  forgeRune: (enchantId: string) => void
  /** 🎲 SURCHARGE RUNIQUE : 3 fragments → une rune aléatoire (jamais un pacte). */
  gambleRune: () => void
  /* — ⚗️ Officine — */
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
  /** 🔨 FRAPPE : une frappe du mini-jeu (parfait/bien/raté) → Chaleur + série + XP. */
  strikeForge: (result: 'perfect' | 'good' | 'miss') => void
  /** 🫕 FONDERIE : fond un objet du SAC (Rare+) en Lingots 🧱. */
  smeltItem: (itemId: string) => void
  /** 🔥 TREMPE LENTE : dépose un objet du sac au bac (+1 iLvl/24 h réelles, 5 max). */
  startTempering: (itemId: string) => void
  /** 🔥 Récupère l'objet du bac de trempe (crédite les jours écoulés). */
  collectTempering: () => void
  /** Apprend un rang d'un nœud d'arbre de métier (dépense un point gagné par niveau). */
  learnMetierNode: (metier: MetierId, nodeId: string) => void
  /** Réinitialise l'arbre d'un métier contre de l'or (XP et niveau conservés). */
  respecMetier: (metier: MetierId) => void
  /** réinitialise UNE branche de l'arbre (40% du coût complet) — changer de voie sans tout raser. */
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
   *  `charIndex` : cible N'IMPORTE QUEL héros, pas seulement l'actif (UI combat multi-perso). */
  castPower: (slot: number, charIndex?: number) => void
  allocateTalent: (nodeId: string) => void
  respecTalents: () => void
  /** alloue un nœud du PANTHÉON (2e arbre) avec le budget de Points d'Éveil (perso actif). */
  allocatePantheon: (nodeId: string) => void
  /** réinitialise le Panthéon du perso actif (gratuit : rebuild libre à chaque run). */
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
  /** 🏆 Évalue et débloque les hauts faits désormais atteints (appelé périodiquement). */
  checkAchievements: () => void
  /** 🏆 Choisit le TITRE affiché d'un héros (id de haut fait débloqué, ou null). */
  selectTitle: (charId: string, achId: string | null) => void
  /** 🎨 Personnalise le portrait d'un héros (palette / emblème). */
  /** L'apparence est au niveau du COMPTE (un seul badge). On l'édite via le perso-ancre
   *  characters[0] ; plus de charId. */
  setAvatar: (sel: { palette?: string; emblem?: string; border?: string; aura?: string }) => void
  /** 🎨 Débloque un cosmétique premium contre de la Poussière d'étoile 🌌. */
  unlockCosmetic: (id: string) => void
  /** Coffre du Destin : garde l'objet à cet index, recycle les autres. */
  chooseFromChoice: (index: number) => void
  recruitCharacter: () => void
  reset: () => void
  /** ÉVEIL PRIMORDIAL : reset DUR contre des Échos ; garde 1 Relique (slot choisi). */
  awaken: (relicSlot: EquipSlotId | null) => void
  /** investit des Échos dans un nœud de Constellation. */
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
  // la rareté n'est PAS figée par coffre : elle suit la rareté DÉBLOQUÉE du compte
  // (unlockedRarityTier → fenêtre [top−4 → top]). `priceTier` ne sert qu'au POIDS DE PRIX (boxGoldPrice).
  priceTier: number
  /** Forme « premium » (Cosmique/Néant) : traîne haute moins raide → ~6% de rareté débloquée (vs ~1.7%). */
  richTail?: boolean
  /** Forme de tirage EXPLICITE (override) — ex. coffres de départ « budget » (POOR : haut effondré).
   *  Si absent : RICH si `richTail`, sinon DUMP. Le jackpot force toujours RICH ponctuellement. */
  shape?: { shoulder: number; tail: number }
  /** Décale le PLAFOND de la fenêtre de rareté (le plancher suit, largeur fixe 4). Négatif = coffre
   *  « budget » (départ : −1, jamais le dernier cran débloqué) ; positif = capBonus (au-dessus de l'unlock). */
  capDelta?: number
  /** Monte le PIC dans la fenêtre (premium : +1 → hautes raretés bien plus fréquentes, sans dépasser le cap). */
  peakShift?: number
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
  /** 🩸 Pacte(s) actif(s) — bonus/malus permanents d'équipe (voir enchants.ts). */
  pact?: PactMods
  /** ✦ Actifs des uniques équipés (rang ≥ actif), agrégés au niveau équipe (voir uniques.ts). */
  uniqueActives?: UniqueActiveMods
  /** CONTEXTE de contenu pour les gemmes d'Environnement (où se passe le combat). */
  content?: {
    /** Biome actif (farm) — Prisme d'accord. */
    biomeType?: DamageType
    /** Biome en ⚡ Surcharge (farm) — Paratonnerre. */
    surge?: boolean
    /** Donjon : nombre de modificateurs actifs — Pierre de sceau. */
    affixCount?: number
    /** Raid : points de résistance offerts à l'équipe — Trophée de guerre. */
    resistBonus?: number
    /** « Mal de l'abîme » : multiplicateur de régén des héros en RAID (< 1 = bridée). */
    regenMult?: number
    /** Farm : à ≤ 2 vagues du record — Pied du mur (appliqué via heroMult au tick). */
    nearRecord?: boolean
    /** 🧴 Antidote ciblé (Officine) : −pct des dégâts SUBIS de ce type. */
    antidote?: { type: DamageType; pct: number }
  }
}

/** Données runtime (hors actions) que `hydrate` produit et que `bootGame` injecte via setState. */
type RuntimeData = SaveData & { enemy: Enemy; log: LogEntry[]; killCount: number; pendingOffline: OfflineReport | null }

/**
 * Calcule l'ÉTAT RUNTIME depuis une `SaveData` chargée : refresh des globaux, CRÉDIT HORS-LIGNE,
 * rattrapage des automates, roulement quotidien/event, ennemi & journal d'accueil. PARTAGÉ — appelé
 * EXACTEMENT une fois par chargement de slot (sinon double-crédit hors-ligne). Mute `save` (gains
 * crédités) puis le renvoie enrichi des champs transitoires. Extrait de l'init synchrone du store,
 * appelé APRÈS le boot async (lecture du stockage durable).
 */
export function hydrate(save: SaveData): RuntimeData {
  refreshGlobals(save.upgrades, save.maitrise, save.constellation, save.achievements)

  // Progression hors-ligne : applique les gains accumulés depuis la dernière sauvegarde. Le récap
  // part dans la ✉ boîte de réception (message « non lu ») au lieu d'un modal plein écran intrusif.
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
    // `pendingOffline` n'est pas alimenté (le modal de retour est remplacé par la ✉ inbox) ;
    // le champ et `claimOffline` restent dormants pour ne pas toucher au plan de sauvegarde.
    pendingOffline: null,
  }
}

export const useGame = create<GameState>((set, get) => {
  // BOOT ASYNCHRONE (Palier 2) : le store démarre en état PLACEHOLDER (booted:false) — AUCUN accès au
  // stockage durable ici (synchrone). `bootGame()` (appelé par main.tsx) lit IndexedDB / le repli
  // localStorage PUIS hydrate via setState. Tant que !booted, App affiche l'écran de chargement (le tick
  // est gardé sur `onboarded`, false dans la freshSave placeholder → aucune persist, aucun combat).
  const placeholder = freshSave()
  refreshGlobals(placeholder.upgrades, placeholder.maitrise, placeholder.constellation, placeholder.achievements)
  return {
    ...placeholder,
    enemy: makeEnemy(placeholder.stage, placeholder.activeBiome),
    log: [],
    killCount: 0,
    pendingOffline: null,
    booted: false,
    storageMode: 'idb' as StorageMode,
    activeSlotId: SLOT0,

    ...createTickSlice(set, get),

    ...createWorldSlice(set, get),

    ...createStuffSlice(set, get),
    ...createGemsSlice(set, get),
    ...createOfficineSlice(set, get),
    ...createAtelierSlice(set, get),
    ...createExpeditionsSlice(set, get),
    ...createHerosSlice(set, get),
    ...createLiveopsSlice(set, get),
    ...createMarketSlice(set, get),
  }
})

let booting = false
/**
 * Démarre le BOOT ASYNCHRONE (Palier 2) : lit le stockage durable (IndexedDB ou repli localStorage),
 * applique l'anti-windfall d'une bascule délibérée, HYDRATE le store, marque `booted`, puis persiste
 * l'état hydraté (filet + slot IDB). Idempotent (ignore les appels redondants — ex. StrictMode).
 */
export async function bootGame(): Promise<void> {
  if (booting || useGame.getState().booted) return
  booting = true
  let boot: { save: SaveData; activeId: string; mode: StorageMode; freshSwitch: boolean }
  try {
    boot = await bootStorage()
  } catch {
    boot = { save: loadSave(), activeId: SLOT0, mode: 'local', freshSwitch: false }
  }
  const save = boot.save
  // Anti-windfall : une bascule de slot DÉLIBÉRÉE ne crédite pas le temps « dormant » du slot cible.
  if (boot.freshSwitch) save.lastSeen = Date.now()
  const data = hydrate(save)
  useGame.setState({ ...data, booted: true, storageMode: boot.mode, activeSlotId: boot.activeId } as Partial<GameState>)
  // Écrit l'état hydraté (crédit hors-ligne appliqué, lastSeen=now) dans le filet + le slot IDB actif.
  persist(useGame.getState())
  booting = false
}

