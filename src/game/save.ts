/**
 * SAUVEGARDE & MIGRATION — la couche de persistance, extraite de `store.ts`.
 *
 * Forme persistée (`SaveData`), partie NEUVE (`freshSave`), nettoyage/migration des vieilles saves
 * (`sanitize`, `migrateItem`, `migrateOldSave`), lecture (`loadSave`) et écriture (`persist`) dans
 * `localStorage` (clé `SAVE_KEY`). Pure : aucune dépendance à l'état transitoire de combat.
 *   → Doc : docs/systemes/10-etat-store-et-sauvegarde.md
 *
 * Note d'architecture : `save.ts` importe quelques TYPES de `store.ts` (`GameState`, `ChestReward`,
 * `ChoiceReward`, `DungeonProgress`, `RaidProgress`) en `import type` — érasés au build → aucun
 * cycle d'import runtime (`store.ts → save.ts` à sens unique côté valeurs).
 */
import type { Item, Affix, ItemType, Character, Enemy, EquipSlotId, DamageType } from './types'
import { makeCharacter, charMaxHp, talentPointsForLevel, computeUnlockedPowers, isBuilder, isSupport, SUPPORT_SLOTS } from './character'
import { getTalent, nodeTree } from './talents'
import { getPower } from './powers'
import { REMOVED_UPGRADES } from './upgrades'
import { emptyMetiers, emptyFoyer, levelFromXp, METIER_LIST, migrateLegacyForge, getMetierNode, type MetiersState, type ForgeronFoyer } from './metiers'
import { parseGemKey } from './gems'
import { getEnchant } from './enchants'
import { emptyConseil, type ConseilState } from './maitrise'
import { parseCondKey, getCondGem, legacyGemDust } from './condGems'
import { SECONDARY_STATS } from './stats'
import { AUTOMATE_MAX, AUTOMATE_NAMES, AUTOMATE_UPG_MAX, type Automate } from './automates'
import { BIOME_IDS, BIOME_ROTATE_MS, type BiomeId } from './biomes'
import { DAMAGE_TYPE_LIST } from './damage'
import { TUT_QUEST_IDS } from './tutorial'
import { welcomeMessage, type InboxMessage } from './inbox'
import { emptyDaily, type DailyState } from './daily'
import { emptyEvent, type EventState } from './event'
import { DUNGEONS, type ActiveDungeon, type DungeonId } from './dungeons'
import { RAIDS, type ActiveRaid, type RaidId } from './raids'
import type { ChestReward, ChoiceReward, DungeonProgress, RaidProgress, GameState } from './store'

export const SAVE_KEY = 'warrior-idler-save-v030c'

export interface SaveData {
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
  /** 🔥 Le Foyer (v0.41) : production idle d'XP de Forgeron + Lingots, indexée sur les Chefs-d'œuvre. */
  foyer: ForgeronFoyer
  /** 🔥 Chaleur (v0.41) : ressource du mini-jeu de Frappe (0..CHALEUR_MAX), dépensée à la forge. */
  chaleur: number
  /** Série de frappes PARFAITES en cours (5 → +1 cran de rareté garanti à la prochaine forge). */
  chaleurStreak: number
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

function emptyDungeonProgress(): DungeonProgress {
  const out = {} as DungeonProgress
  for (const id of Object.keys(DUNGEONS) as DungeonId[]) out[id] = 0
  return out
}

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

/** Ajoute les uniques portés par des objets au grimoire (sans doublon). */
export function discoverFromItems(codex: string[], items: (Item | undefined)[]): string[] {
  let out = codex
  for (const it of items) {
    const id = it?.unique?.id
    if (id && !out.includes(id)) out = [...out, id]
  }
  return out
}

export function freshSave(): SaveData {
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
    metiersV: 8,
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
    foyer: emptyFoyer(),
    chaleur: 0,
    chaleurStreak: 0,
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
  // v0.41 — MIGRATION metiersV 8 : Forge hexagonale. Les ids de tuiles sont INCHANGÉS (compat directe :
  // une tuile déjà possédée le reste, l'adjacence ne gate que les NOUVEAUX forgeages). Seule nouveauté
  // structurelle : le `foyer` est une tuile NEUVE servant de PORTE d'entrée de la Voie Industriel — les
  // anciennes saves possèdent automates/trempe/montage SANS foyer. On l'OFFRE (gratuit, si un point est
  // libre) pour reconnecter le bras au Creuset. Le reste est grandfathered : on ne retire RIEN (les
  // éventuels keystones multiples d'avant restent ; l'exclusivité ne vaut que pour les futurs choix).
  if ((save.metiersV ?? 1) < 8 && save.metiers?.forgeron) {
    const f = save.metiers.forgeron
    const nodes: Record<string, number> = { ...(f.nodes ?? {}) }
    const ownsIndustriel = ['automates', 'trempeLente', 'montage', 'automate4'].some((id) => (nodes[id] ?? 0) > 0)
    if (ownsIndustriel && !(nodes.foyer > 0)) {
      const available = levelFromXp(f.xp ?? 0) - Object.values(nodes).reduce((a, b) => a + b, 0)
      if (available >= 1) nodes.foyer = 1 // cadeau : reconnecte le bras Industriel sans rien faire perdre
    }
    save.metiers = { ...save.metiers, forgeron: { ...f, nodes } }
    save.metiersV = 8
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
  // v0.41 — Le Foyer (défauts robustes pour les anciennes saves).
  if (!save.foyer || typeof save.foyer !== 'object') save.foyer = emptyFoyer()
  if (!Array.isArray(save.foyer.masterworkKeys)) save.foyer.masterworkKeys = []
  if (typeof save.foyer.lastTick !== 'number') save.foyer.lastTick = Date.now()
  if (typeof save.foyer.xpAcc !== 'number') save.foyer.xpAcc = 0
  if (typeof save.foyer.lingotAcc !== 'number') save.foyer.lingotAcc = 0
  if (typeof save.chaleur !== 'number') save.chaleur = 0
  if (typeof save.chaleurStreak !== 'number') save.chaleurStreak = 0
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
    c.unlockedPowers = computeUnlockedPowers({ ...talents, ...pantheon }, c.level)
    // v0.39 : RÉPARTITION actifs (5) / SOUTIEN (3) / passifs (3). Migration : on relit les anciens
    // `powers` + `support` (ex-`generators`, back-compat) + `passives`, on valide, on range par genre —
    // seuls les builders quittent la barre des actifs ; les boucliers/soins restent où ils étaient.
    const legacyGen = (c as { generators?: (string | null)[] }).generators // ex-`generators` → `support`
    const powersArr = Array.isArray(c.powers) ? c.powers : []
    const supportArr = Array.isArray(c.support) ? c.support : Array.isArray(legacyGen) ? legacyGen : []
    const passivesArr = Array.isArray(c.passives) ? c.passives : []
    const act: string[] = []
    const sup: string[] = []
    const pas: string[] = []
    const seen = new Set<string>()
    const valid = (pid: string | null) => (pid && !seen.has(pid) && c.unlockedPowers.includes(pid) ? getPower(pid) : undefined)
    // v0.39 BUGFIX : on RESPECTE la lane où le joueur a rangé chaque sort. Les boucliers/soins sont
    // MULTI-LANE (équipables en Actif OU en Soutien) ; sans ce premier passage par lane, la
    // réconciliation les renvoyait toujours en Actif (`else`) → ils disparaissaient des slots Soutien
    // à chaque chargement de la save (« bouclier runique / second souffle s'enlève »).
    for (const pid of supportArr) { const pw = valid(pid); if (pw && isSupport(pw) && sup.length < SUPPORT_SLOTS) { sup.push(pid!); seen.add(pid!) } }
    for (const pid of passivesArr) { const pw = valid(pid); if (pw && pw.kind === 'passive' && pas.length < 3) { pas.push(pid!); seen.add(pid!) } }
    for (const pid of powersArr) { const pw = valid(pid); if (pw && pw.kind === 'active' && !isBuilder(pw) && act.length < 5) { act.push(pid!); seen.add(pid!) } }
    // Filet : un sort mal rangé (builder resté en Actif, passif égaré…) rejoint sa lane naturelle s'il
    // reste de la place — seuls les builders quittent d'office la barre d'actifs.
    for (const pid of [...supportArr, ...powersArr, ...passivesArr]) {
      const pw = valid(pid)
      if (!pw) continue
      if (pw.kind === 'passive') { if (pas.length < 3) { pas.push(pid!); seen.add(pid!) } }
      else if (isBuilder(pw)) { if (sup.length < SUPPORT_SLOTS) { sup.push(pid!); seen.add(pid!) } }
      else if (act.length < 5) { act.push(pid!); seen.add(pid!) }
    }
    c.powers = [0, 1, 2, 3, 4].map((i) => act[i] ?? null)
    c.support = [0, 1, 2].map((i) => sup[i] ?? null)
    delete (c as { generators?: unknown }).generators // v0.39 : champ renommé en `support`
    c.passives = [0, 1, 2].map((i) => pas[i] ?? null)
    // Mode auto/manuel par emplacement ACTIF (défaut AUTO).
    c.powerAuto = [0, 1, 2, 3, 4].map((i) => (Array.isArray(c.powerAuto) ? c.powerAuto[i] !== false : true))
    // Présets de build : structure validée (3 emplacements max, entrées bien formées).
    if (Array.isArray(c.buildPresets)) {
      c.buildPresets = c.buildPresets.slice(0, 3).map((p) => {
        if (!(p && typeof p === 'object' && p.talents && Array.isArray(p.powers))) return null
        const legacyPGen = (p as { generators?: (string | null)[] }).generators // ex-`generators` → `support`
        const support = Array.isArray(p.support) ? p.support.slice(0, 3) : Array.isArray(legacyPGen) ? legacyPGen.slice(0, 3) : undefined
        return { name: String(p.name ?? 'Build').slice(0, 14), talents: p.talents, powers: p.powers.slice(0, 5), passives: Array.isArray(p.passives) ? p.passives.slice(0, 3) : undefined, support, primaryBias: p.primaryBias ?? 'force' }
      })
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
    support: [null, null, null],
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

export function loadSave(): SaveData {
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

/** Construit le payload `SaveData` à partir de l'état runtime (sans les champs transitoires). Pur :
 *  appelé au moment du `persist`/`persistThrottled` — `lastSeen` reflète donc l'instant de l'appel. */
function buildSaveData(s: GameState): SaveData {
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
    metiersV: s.metiersV ?? 8,
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
    foyer: s.foyer,
    chaleur: s.chaleur,
    chaleurStreak: s.chaleurStreak,
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
  return data
}

/** Écriture brute (encapsule l'accès `localStorage`, qui peut échouer : quota, mode privé…). */
function writeSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

// --- Sauvegarde throttlée (perf) ---------------------------------------------------------------
// Le chemin chaud (boucle de combat 5 Hz : `tick`/`tickDungeon`/`tickRaid`) peut persister à chaque
// kill — soit jusqu'à 5 `JSON.stringify` de TOUT le save par seconde, bloquant sur le thread UI.
// `persistThrottled` coalesce ces écritures en AU PLUS une par fenêtre ; `persist` (synchrone) reste
// le contrat des actions joueur + round-trip ; `flushSave` force l'écriture au cycle de vie (veille).
const SAVE_THROTTLE_MS = 2000
let pendingSnapshot: SaveData | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Annule le write throttlé en attente (un write synchrone vient le superséder). */
function clearPending() {
  if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null }
  pendingSnapshot = null
}

/** Sauvegarde SYNCHRONE immédiate — actions joueur, contrat round-trip, cycle de vie. Supersède tout
 *  write throttlé en attente (l'état passé est le plus récent → le pending serait périmé). */
export function persist(s: GameState) {
  clearPending()
  writeSave(buildSaveData(s))
}

/** Sauvegarde THROTTLÉE — réservée au chemin chaud (boucle de combat). Mémorise l'instantané le plus
 *  récent et n'écrit qu'au plus une fois par `SAVE_THROTTLE_MS`. Aucune perte au-delà de cette fenêtre :
 *  `flushSave` (mise en veille/fermeture) et `persist` (action joueur) écrivent le pending immédiatement,
 *  et le cold-start recrédite tout écart via `lastSeen` (simulation hors-ligne). */
export function persistThrottled(s: GameState) {
  pendingSnapshot = buildSaveData(s) // immuabilité du store ⇒ l'instantané reste valide jusqu'au flush
  if (saveTimer === null) {
    saveTimer = setTimeout(() => {
      saveTimer = null
      if (pendingSnapshot) { writeSave(pendingSnapshot); pendingSnapshot = null }
    }, SAVE_THROTTLE_MS)
  }
}

/** Force l'écriture immédiate d'un éventuel instantané throttlé en attente (cycle de vie : passage en
 *  arrière-plan / fermeture). Idempotent : ne fait rien si rien n'est en attente. */
export function flushSave() {
  if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null }
  if (pendingSnapshot) { writeSave(pendingSnapshot); pendingSnapshot = null }
}

