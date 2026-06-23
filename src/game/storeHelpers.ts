/**
 * STORE HELPERS — fonctions PURES d'orchestration et constantes partagées, extraites de `store.ts`
 * (Phase C du découpage du god-file). On y trouve : journal (`pushLog`/`nextLogId`), XP métiers &
 * Conseil, buffs d'Officine, auto-équipement, recherche/patch d'objets, prix & génération de
 * l'échoppe, coffres (`MYSTERY_BOXES`), iLvl de référence, et les pas d'orchestration de contenu
 * (`tickDungeon`/`tickRaid`/`applyChestRewards`).
 *
 * Règle d'or : aucune dépendance au store en runtime — seuls des TYPES sont importés de `./store`
 * (`import type`, érasés à la compilation → pas de cycle). Le store importe ces helpers, jamais
 * l'inverse au runtime.
 *   → Doc : docs/systemes/10-etat-store-et-sauvegarde.md + docs/ARCHITECTURE.md
 */
import type { Equipment, Item, OffensiveStat, EquipSlotId, ItemType, DamageType, Character } from './types'
import { genericMitigation } from './combat'
import { resistMult, enemyReq } from './resist'
import {
  charDerived, charMaxHp, charPassives, charResist, charCombatMods, computeUnlockedPowers, setGlobalCombatMods,
  setGlobalPrestigeResist, setPactDerivedMods
} from './character'
import { computeGlobalMods } from './upgrades'
import { achievementBonuses } from './achievements'
import { generateItem, rollWindowRarity, itemScore } from './items'
import { constellationMods } from './prestige'
import { craftMods, levelFromXp, METIERS, type MetierId, type MetiersState } from './metiers'
import {
  equippedRules, equippedTimeRunes, timeRuneMods, rollRuneDrop, raidRuneChance, dungeonRuneChance,
  equippedPacts, pactMods, emptyPactMods, ruleAmp, type PactMods
} from './enchants'
import { getContract, conseilFresh, type ConseilState, type ContractId } from './maitrise'
import {
  condGemMods, rollCondGem, condGemKey, getCondGem, gemMaxRank, COND_GEM_LIST, type CondGemId, type GemFamily,
  type GemModOpts
} from './condGems'
import { getBrew, BREW_QUALITIES, type BrewQuality } from './alchimie'
import { stageIlvl } from './enemies'
import { lootFarmIlvl } from './progression'
import { maitriseBonus } from './biomeBonus'
import { RARITIES, RARITY_LIST } from './rarities'
import { persist, discoverFromItems } from './save'
import {
  partyCombatStepMulti, crescendoBonus, crescendoAdd, crescendoReset, fuelReset, resetLongestCooldown,
  tresorerieShield, gemKillEvents, setRegenMult, resetMemento
} from './combatEngine'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES } from './damage'
import { slotAccepts, EQUIP_SLOTS } from './slots'
import { type TutCtx } from './tutorial'
import {
  generateDungeon, makeDungeonPack, dungeonIlvl, dungeonRegen, getDungeonDef, dungeonLuckTier,
  cacheRarityWindow, butinOverChance, butinOverTier, BUTIN_RARITY_CAP, dungeonRunYield, dungeonKeyYield,
  DUNGEON_YIELD_PERFIGHT_FRAC, geodeDustYield, geodeGemChance, geodeGemRank, type ActiveDungeon
} from './dungeons'
import {
  generateRaid, makeRaidAdd, raidMaxAdds, getRaidDef, raidIlvl, raidRarityWindow, rollRaidLootCount,
  raidTrophyGain, raidFragments, raidCosmicQty, pickRaidLootType, PAIR_ENRAGE_MULT, NOVA_MULT, RAID_LIST
} from './raids'
import { SETS } from './sets'
import type { GameState, ChestReward, ForgeContractDef, BrewBuffs, MysteryBox, LogEntry, LogKind } from './store'

// v0.30 — WIPE ASSUMÉ : la refonte de progression (budget d'objet exponentiel, échelle d'ilvl
// unifiée) rend les anciens objets/paliers incohérents sur la nouvelle courbe. On bumpe la clé →
// les saves v1 ne sont plus chargées (reset propre, comme un gros prestige). Cf. DESIGN_v0.30.md.
export const MAX_LOG = 40
// v0.25 (DESIGN §2) : inventaire ILLIMITÉ (Sacoches supprimée) — borne purement technique.
// Le tri se fait par l'auto-recyclage (seuil de rareté) et les outils de masse.
export const INV_BASE = 100000
export let invMax = INV_BASE
/* v0.27 (Lot 3) — socle ANTI-IMMORTALITÉ en RAID (knobs à éprouver). */
export const RAID_REGEN_MULT = 0.5   // « Mal de l'abîme » : régén de base bridée de moitié en raid
export const ESTOC_INTERVAL = 9      // s entre deux « Estocs primordiaux »
export const ESTOC_PCT = 0.04        // % des PV MAX par estoc, IMPARABLE (ignore armure/résist/mitigation)
export const HEALCUT_DUR = 4         // « Blessures mortelles » : durée (s) de la fenêtre de soins réduits (posée par la Nova)
export const FRAPPE_INTERVAL = 12    // « Frappe partagée » : intervalle (s)
export const FRAPPE_MULT = 3.2       // dégâts TOTAUX (÷ héros vivants) → soloer la frappe = la prendre PLEINE
export const ESTOCADE_INTERVAL = 8   // « Estocade » : intervalle (s) — frappe le plus BAS en PV
/** v0.25.x — RELÈVE en farm : un héros tombé se relève après ce délai (s), à 35% de ses PV. */
export const RETREAT_STAGES = 2
/** Intervalle (s) entre deux étourdissements d'un boss (après le 1er, cadencé par ccCd). */
// v0.35.1 — Personnages 2 & 3 = la « dynamique reine » REQUISE pour les RAIDS (contenu de groupe :
// heal/bouclier/synergie). Recrutable au Marché à un coût MODESTE et abordable dès que les raids
// comptent (palier 50) ; déblocage gratuit très tardif conservé comme filet de sécurité.
export const CHAR2_STAGE = 350
export const CHAR3_STAGE = 800
export const RECRUIT_COST = [1_000_000, 8_000_000] // or — 2ᵉ abordable dès le palier 50, 3ᵉ = vrai objectif
export const RECRUIT_POUSSIERE = [0, 30] // 2ᵉ : que de l'or (la poussière sert au craft) ; 3ᵉ : un peu
export const RECRUE_NAMES = ['Lyra', 'Kael', 'Sora', 'Dorn', 'Mira']

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
export const SCEAU_COST = { noyau: 3, eclats: 600 }
export const FRAGMENT_INFUSE_COST = 2 // Fragments d'éternité pour infuser un effet unique
/** Invocation d'un effet unique au CHOIX (Éclat cosmique + Fragments). */
export const CHOOSE_UNIQUE_COST = { cosmic: 1, fragments: 3 }
/** Ajoute un sac de Quintessences typées à un stock (immutable). */
export function addQuint(base: Record<DamageType, number>, add: Partial<Record<DamageType, number>>): Record<DamageType, number> {
  let changed = false
  const out = { ...base }
  for (const t in add) {
    const v = add[t as DamageType] ?? 0
    if (v > 0) { out[t as DamageType] = (out[t as DamageType] ?? 0) + v; changed = true }
  }
  return changed ? out : base
}

/** Rend au stock les gemmes serties d'un objet (vente/recyclage : les gemmes ne se perdent pas). */
export function gemStockAdd(stock: Record<string, number>, item: Item): Record<string, number> {
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
export function quintLogSuffix(refund: Partial<Record<DamageType, number>>): string {
  const parts: string[] = []
  for (const t in refund) {
    const v = refund[t as DamageType] ?? 0
    if (v > 0) parts.push(`${DAMAGE_TYPES[t as DamageType].icon}${v}`)
  }
  return parts.length ? ` + ${parts.join(' ')}` : ''
}

/** Chances de drop d'une Quintessence du biome actif selon le rang d'ennemi (au palier 1). */
export const QUINT_DROP = { normal: 0.01, elite: 0.05, boss: 0.1 }
/** Bonus de drop de Quintessence par palier (multiplicatif, plafonné) → farmer son palier actuel
 *  rapporte plus que farmer 50 paliers en dessous. */
export const QUINT_TIER_BONUS = 0.012
export const QUINT_TIER_MULT_CAP = 4
/** Multiplicateur de drop de Quintessence au palier `stage`. */
export function quintTierMult(stage: number): number {
  return Math.min(QUINT_TIER_MULT_CAP, 1 + Math.max(0, stage - 1) * QUINT_TIER_BONUS)
}

/**
 * Donjons = voie RENTABLE pour monter de niveau & farmer l'or. À CHAQUE combat gagné, l'équipe
 * gagne de l'XP (créditée tout de suite, gardée même si le run échoue) et de l'or (versé au coffre).
 * Multiplicateurs volontairement GÉNÉREUX (le levelling est lent par design) — à affiner.
 */
// ×XP de l'équipe par combat dans le Sanctuaire du Savoir. Relevé 7 → 24 (v0.21) : les donjons
// sont passés de 4+N combats à 2-4 → on préserve l'XP totale d'un run.
export const DUNGEON_FIGHT_XP_MULT = 24
/** Boost de l'XP du combat CLASSIQUE : recale le ratio donjon/classique (~×80 → ~×10). */
export const CLASSIC_XP_MULT = 8
/** Or par kill en combat CLASSIQUE (fraction de l'XP du mob). v0.36 : 0.8 → 5.0 — le farm devient la
 *  SEULE source d'or (donjons retirés de l'or) ; il doit couler franchement pour dépenser souvent au
 *  Marché (coffres + améliorations). KNOB à affiner après une grosse session de tests (cf. DESIGN_v0.36 §2.2). */
export const CLASSIC_GOLD_MULT = 5.0
let logId = 1
export function pushLog(log: LogEntry[], text: string, kind: LogKind): LogEntry[] {
  return [{ id: logId++, text, kind }, ...log].slice(0, MAX_LOG)
}

/** Crédite de l'XP de métier et journalise les montées de niveau (1 niveau = 1 point d'arbre). */
export function gainMetierXp(
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
export function passiveMetierXp(s: Pick<GameState, 'metiers' | 'characters'>, log: LogEntry[]): { metiers: MetiersState; log: LogEntry[] } {
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
export function conseilProgress(
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

export function xpForLevel(level: number): number {
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
export function activeBrewBuffs(s: Pick<GameState, 'elixirActive' | 'oilActive' | 'antidoteActive' | 'mutagenActive'>): BrewBuffs {
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
export function teamPactMods(
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
    noRiposte: pact.noRiposte,
  })
  return pact
}


/** v0.31 — AUTO-ÉQUIP des slots VIDES (onboarding) : remplit chaque emplacement vide du perso avec le
 *  meilleur objet compatible de l'inventaire. NON destructif — les slots déjà remplis ne bougent pas
 *  (les UPGRADES restent un choix manuel). Un perso nu se gear ainsi tout seul depuis ses drops. */
export function autoEquipEmpties(char: Character, inventory: Item[]): { char: Character; inventory: Item[]; equipped: number } {
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


/**
 * Protection des ventes/recyclages DE MASSE : les objets à effet unique de très haute rareté
 * (Cosmique+) ne partent jamais en lot — recyclage à l'unité uniquement. Les uniques plus communs
 * (Épique…) restent recyclables en masse : c'est le moteur d'essences du jeu.
 */
export function bulkProtected(item: Item): boolean {
  // 🔒 (v0.28) le verrou joueur protège de TOUTE suppression de masse/auto.
  return !!item.locked || (!!item.unique && RARITIES[item.rarity].tier >= 13)
}






// ---- Logique de personnage / objets ----

export function findItemById(s: GameState, id: string): Item | undefined {
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
export function applyItemPatch(s: GameState, id: string, patch: Partial<Item>): Partial<GameState> | null {
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

export function highestLevel(chars: Character[]): number {
  return chars.reduce((m, c) => Math.max(m, c.level), 1)
}

/** Soin complet + purge des statuts de combat transitoires (mort, repli, fin de donjon/raid). */
export function fullHeal(c: Character): Character {
  // v0.36 — la remise à neuf (mort / checkpoint de Chapitre) RAZ aussi le bouclier d'absorption :
  // pas de report d'un combat à l'autre (« reset dur hors combat »).
  return { ...c, hp: charMaxHp(c), absorb: undefined, rez: undefined, stun: 0, dots: undefined, weaken: undefined }
}

/** Met à jour les multiplicateurs globaux (combat, régén) — améliorations + 🏛️ Maîtrise (v0.25). */
export function refreshGlobals(upgrades: Record<string, number>, maitrise: Record<string, number> = {}, constellation: Record<string, number> = {}, achievements: Record<string, true> = {}) {
  const m = computeGlobalMods(upgrades, maitrise, achievementBonuses(achievements))
  // ✨ Constellation de prestige (v0.27, Lot 5) : multiplie les globaux de combat + résist plate.
  const pm = constellationMods(constellation)
  setGlobalCombatMods({ power: m.power * pm.damageMult, attackSpeed: m.attackSpeed * pm.speedMult, vitality: m.vitality * pm.vitalityMult })
  setGlobalPrestigeResist(pm.resistFlat)
  setRegenMult(m.regen)
}
// ---- Marchand ----
export const SHOP_SIZE = 6
/** Intervalle de rotation de l'échoppe : 1 h réelle (indépendant du combat). */
export const SHOP_INTERVAL_MS = 60 * 60 * 1000
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
export const BOX_WEAPONS: ItemType[] = ['armePrincipale', 'armeSecondaire']
export const BOX_ARMOR: ItemType[] = ['tete', 'epaules', 'cape', 'torse', 'poignets', 'mains', 'taille', 'jambes', 'pieds']
export const BOX_ACCESSORIES: ItemType[] = ['anneau', 'bijou', 'cou']

/**
 * Coffres CIBLÉS et ATTRACTIFS (refonte v0.19). Au lieu de coffres « génériques » sans intérêt,
 * chaque coffre a une PROMESSE claire : un build (Guerrier/Rôdeur/Mage), un slot (armes/armures/
 * bijoux), un affixe fort (Critique), de la défense, ou des matériaux. Les petits coffres GARANTISSENT
 * un objet utile (ta stat) + des éclats → ils ne sont plus jamais « gâchés ».
 * id = index dans le tableau (utilisé par l'action mysteryBox).
 */
// v0.40.4 — la RARETÉ de TOUS les coffres suit désormais la rareté DÉBLOQUÉE du compte (unlockedRarityTier,
// fenêtre [top−4 → top], pic au plancher = dump d'or). Les coffres ne diffèrent plus que par leur EFFET,
// leur count (2-4), leur `priceTier` (poids de prix) et `richTail` (forme premium). `maxTier` et le verrou
// de raid (boxRaidGate) ont disparu : on ne peut de toute façon pas dropper au-dessus de ce qu'on a débloqué.
export const MYSTERY_BOXES: MysteryBox[] = [
  // --- Coffres de BUILD : bon marché, stat primaire GARANTIE + éclats → toujours utiles ---
  { id: 0, name: 'Coffre du Guerrier', icon: '🗡️', gold: 400, count: 2, priceTier: 3, jackpot: 0.03, primary: 'force', eclats: 80, desc: 'FORCE garantie sur chaque objet (+ éclats).' },
  { id: 1, name: 'Coffre du Rôdeur', icon: '🏹', gold: 400, count: 2, priceTier: 3, jackpot: 0.03, primary: 'agilite', eclats: 80, desc: 'AGILITÉ garantie sur chaque objet (+ éclats).' },
  { id: 2, name: 'Coffre du Mage', icon: '🔮', gold: 400, count: 2, priceTier: 3, jackpot: 0.03, primary: 'intelligence', eclats: 80, desc: 'INTELLIGENCE garantie sur chaque objet (+ éclats).' },
  // --- Coffres de SLOT : combler un emplacement précis ---
  { id: 3, name: 'Arsenal', icon: '⚔️', gold: 45000, count: 2, priceTier: 5, jackpot: 0.05, types: BOX_WEAPONS, desc: 'ARMES & boucliers uniquement.' },
  { id: 4, name: 'Armurerie', icon: '🥋', gold: 45000, count: 3, priceTier: 5, jackpot: 0.05, types: BOX_ARMOR, desc: 'PIÈCES D\'ARMURE uniquement.' },
  { id: 5, name: 'Joaillier', icon: '💍', gold: 45000, count: 3, priceTier: 5, jackpot: 0.05, types: BOX_ACCESSORIES, desc: 'BIJOUX (anneaux, talismans, colliers).' },
  // --- Coffres à AFFIXE / DÉFENSE : stats garanties ---
  { id: 6, name: 'Coffre du Critique', icon: '🎯', gold: 120000, count: 3, priceTier: 6, jackpot: 0.06, guaranteeAffix: 'degatsCrit', eclats: 500, desc: 'Ligne de Dégâts critiques GARANTIE sur chaque objet.' },
  { id: 7, name: 'Coffre du Gardien', icon: '🛡️', gold: 120000, count: 3, priceTier: 6, jackpot: 0.06, biasResist: true, desc: 'Stuff défensif : résistances garanties.' },
  // --- Matériaux & haut de gamme ---
  { id: 8, name: 'Coffre du forgeron', icon: '🔨', gold: 400000, count: 2, priceTier: 7, jackpot: 0.05, eclats: 3000, noyau: 12, poussiere: 8, desc: 'Matériaux de craft en MASSE (atelier/forge) + objets.' },
  { id: 9, name: 'Coffre légendaire', icon: '🟠', gold: 800000, count: 4, priceTier: 8, jackpot: 0.07, eclats: 1500, noyau: 5, poussiere: 3, costFragments: 2, desc: 'Gros lot d\'objets. Exige des Fragments de raid.' },
  { id: 10, name: 'Coffre cosmique', icon: '🌟', gold: 2500000, count: 4, priceTier: 10, jackpot: 0.09, richTail: true, guaranteeUnique: true, eclats: 4000, noyau: 10, poussiere: 12, fragments: 2, costFragments: 6, desc: 'Hautes raretés plus généreuses + 1 unique garanti. Exige des Fragments.' },
  { id: 11, name: 'Coffre du Néant', icon: '🕳️', gold: 10000000, count: 4, priceTier: 12, jackpot: 0.13, richTail: true, guaranteeUnique: true, eclats: 10000, noyau: 25, poussiere: 35, fragments: 8, costFragments: 18, costCosmic: 3, desc: 'Le pari ultime : hautes raretés généreuses + unique garanti. Exige Fragments ✨ ET Éclats cosmiques 💫.' },
  // --- Nouveautés v0.23 (les ids sont des INDEX : on n'insère jamais, on AJOUTE) ---
  { id: 12, name: 'Coffre du Jour', icon: '🗓️', gold: 0, free: true, count: 2, priceTier: 4, jackpot: 0.06, eclats: 150, desc: 'GRATUIT toutes les 22 h. Des objets + des éclats. Reviens demain !' },
  { id: 13, name: 'Coffre Maudit', icon: '🎲', gold: 60000, count: 2, priceTier: 6, jackpot: 0.08, cursed: true, desc: '75% : contenu DOUBLÉ. 25% : la malédiction ne laisse qu\'un objet Commun.' },
  { id: 14, name: 'Coffre élémentaire', icon: '🔥', gold: 35000, count: 2, priceTier: 5, jackpot: 0.05, elementPick: true, desc: 'Choisis un ÉLÉMENT : ligne « +% dégâts du type » garantie (armes typées).' },
  { id: 15, name: 'Trousseau du Pilleur', icon: '🗝️', gold: 70000, count: 0, priceTier: 1, jackpot: 0, sceaux: 5, orbes: 2, desc: '5 Sceaux 🔑 + 2 Orbes 🔮 d\'un coup — moins cher qu\'à l\'unité.' },
  { id: 16, name: 'Coffre du Lapidaire', icon: '💎', gold: 90000, count: 0, priceTier: 1, jackpot: 0, gemDust: 220, gemChance: 0.45, desc: 'Poussière de gemme 🔹 (scalée sur ton record) + 45% de gemme de condition.' },
  { id: 17, name: 'Coffre du Destin', icon: '🎭', gold: 120000, count: 3, priceTier: 6, jackpot: 0.07, choice: true, desc: 'Révèle 3 objets : tu n\'en GARDES qu\'UN, les deux autres sont recyclés en éclats.' },
  { id: 18, name: 'Coffre du Maillon Faible', icon: '🧩', gold: 150000, count: 2, priceTier: 7, jackpot: 0.06, weakest: true, desc: 'Analyse ton équipement et cible ton EMPLACEMENT le plus faible (vide ou en retard).' },
  { id: 19, name: 'Coffre du Collectionneur', icon: '📖', gold: 300000, count: 2, priceTier: 8, jackpot: 0.06, collector: true, costFragments: 3, desc: 'Des objets dont un porte un effet unique JAMAIS DÉCOUVERT — complète le Grimoire.' },
  // v0.40.4 — le DUMP D'OR générique : pas d'effet, juste des objets à la rareté DÉBLOQUÉE de ton chapitre.
  { id: 20, name: 'Coffre du Chapitre', icon: '📦', gold: 50000, count: 3, priceTier: 6, jackpot: 0.05, desc: 'Objets à la rareté débloquée de ton chapitre (donjons/raids compris). Le dump d\'or polyvalent.' },
]

// v0.40.4 — formes de tirage de rareté des coffres (rollWindowRarity, pic au PLANCHER → dump d'or).
export const BOX_DUMP_SHAPE = { shoulder: 0.45, tail: 0.40 } // standard : rareté débloquée (sommet) ~1,7%
export const BOX_RICH_SHAPE = { shoulder: 0.70, tail: 0.60 } // premium (richTail / jackpot) : sommet ~6%

/**
 * v0.25 — PRIX EN OR d'un coffre de stuff. Suit (a) la rareté ET (b) ton revenu d'or (record) :
 * un prix FIXE devenait vite trivial face au revenu exponentiel (« on a tout ce qu'on veut »).
 * Calé SOUS la croissance du Donjon d'Or (≈1,069^palier) → acheter coûte ~un nombre constant de
 * runs, qui décroît LENTEMENT (rentable sur le temps, jamais instantané). Lots de ressources
 * (count 0) & coffres gratuits : prix fixe (l'équation, indexée rareté, ne les concerne pas).
 */
export const BOX_PRICE_K = 400       // base (~4 runs du Donjon d'Or au niveau courant)
export const BOX_PRICE_RARITY = 2.5  // ×prix par cran de rareté moyenne (raide : « gonfle énormément » en haut)
export const BOX_PRICE_STAGE = 1.06  // ×prix par palier de record (< revenu d'or → rentable sur le temps)
export function boxGoldPrice(box: MysteryBox, bestStage: number): number {
  if (box.free || box.count <= 0) return box.gold
  // v0.40.4 — `priceTier` = poids de prix par coffre (ex-minTier) ; le palier indexe via BOX_PRICE_STAGE.
  const tMoy = box.priceTier + 1.5
  return Math.round(BOX_PRICE_K * box.count * Math.pow(BOX_PRICE_RARITY, tMoy - 3) * Math.pow(BOX_PRICE_STAGE, Math.max(1, bestStage)))
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
  // v0.36 — FIX : plus de ×1.25 (relique v0.25, quand les donjons donnaient 125% du record). Comme
  // `stageIlvl` est désormais CAPÉ à 200, le ×1.25 gonflait le plafond à 250 → on pouvait surilvl un
  // objet 200 jusqu'à ~256 SANS l'Abîme. Le plafond = le MEILLEUR ilvl réellement atteignable (farm
  // capé 200 + raids vaincus, dont l'Abîme à 220/240) ; le surilvl ne perce que d'une MARGE fixe
  // (SURILLVL_OVER_MARGIN) au-dessus → pour dépasser 200, il FAUT clear l'Abîme.
  let best = stageIlvl(Math.max(1, bestStage))
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

export function generateShop(bestStage: number, raidProgress: Record<string, number>, dungeonProgress: Record<string, number>, luckBonus: number): Item[] {
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
export function weakestSlotType(c: Character): ItemType {
  let worst: { score: number; type: ItemType } | null = null
  for (const slot of EQUIP_SLOTS) {
    const it = c.equipment[slot.id]
    const score = it ? itemScore(it) : -1 // un emplacement vide est toujours le plus faible
    if (!worst || score < worst.score) worst = { score, type: slot.accepts }
  }
  return worst!.type
}

/** Affinité de drop : celle d'un membre d'équipe au hasard (nourrit tous les builds). */
export function pickBias(chars: Character[]): OffensiveStat {
  const living = chars.filter((c) => c.hp > 0)
  const pool = living.length ? living : chars
  const b = pool[Math.floor(Math.random() * pool.length)]?.primaryBias
  return b === 'agilite' || b === 'intelligence' ? b : 'force'
}

/** Donne de l'XP à un perso, gère les montées de niveau (gains de base + points de talent). */
/**
 * v0.36 — XP de COMPTE : level/xp sont PARTAGÉS par toute l'équipe (un seul niveau de compte). On avance
 * le compte UNE fois (depuis le niveau le plus haut) et on synchronise TOUS les héros — chacun rattrape
 * sa base (bias + endurance) jusqu'au niveau de compte. Un 2e/3e perso n'ajoute donc PAS de niveau, et
 * le pool de talents (teamTalentPool, dérivé) n'enfle pas. Remplace l'ancien grantXp par-perso.
 */
export function grantTeamXp(chars: Character[], xp: number): { chars: Character[]; leveled: boolean } {
  if (!chars.length) return { chars, leveled: false }
  const from = chars.reduce((m, c) => Math.max(m, c.level), 1)
  let level = from
  let curXp = (chars.find((c) => c.level === from)?.xp ?? 0) + xp
  while (curXp >= xpForLevel(level)) { curXp -= xpForLevel(level); level++ }
  const leveled = level > from
  const out = chars.map((c) => {
    const inc = level - c.level
    const base = { ...c.base }
    if (inc > 0) {
      base[c.primaryBias] = (base[c.primaryBias] ?? 0) + inc
      base.endurance = (base.endurance ?? 0) + inc
      // v0.39 : un palier de niveau peut débloquer un passif-conversion du SOCLE → recalcul.
      const unlockedPowers = computeUnlockedPowers({ ...c.talents, ...(c.pantheon ?? {}) }, level)
      return { ...c, level, xp: curXp, base, unlockedPowers }
    }
    return { ...c, level, xp: curXp, base }
  })
  return { chars: out, leveled }
}


/** v0.26 : options d'agrégation des gemmes issues de l'arbre du Joaillier — 🔗 Serti conducteur
 *  (2+ gemmes d'une famille sur un héros), 🪩 Mosaïque (3+ familles portées), 📖 Catalogue
 *  (collection complète), 👑 Châsse royale, 🎭 Double allégeance. */
export function teamGemOpts(s: Pick<GameState, 'characters' | 'gemsSeen'>, cm: ReturnType<typeof craftMods>): GemModOpts {
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

export function tickDungeon(s: GameState, dt: number, set: (s: GameState) => void) {
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
        { const r = grantTeamXp(chars, xp); chars = r.chars; if (r.leveled) leveled = true }
        earned.xp = (earned.xp ?? 0) + xp
        logBit = `+${xp.toLocaleString('fr-FR')} XP`
        break
      }
      // Cache du Pilleur (v0.36) : tout le butin tombe au COFFRE (count 1 → 5, +1 tous les 3 niveaux), à TA
      // tranche d'ilvl. Plus de drop par-combat → le nombre d'objets/run est piloté proprement par le niveau.
      case 'stuff': break
      // La Géode : la poussière 🔹 coule à chaque combat (la gemme, elle, attend le coffre).
      case 'gemmes': { const gd = accrue('gemDust', geodeDustYield(lv) * DUNGEON_YIELD_PERFIGHT_FRAC * rwMult / Math.max(1, d.totalFights)); if (gd) { gemDust += gd; logBit = `+${gd} 🔹` } } break
    }
    // ✦ Hanté : le Champion du pack vient de tomber → objet de haute rareté (Légendaire garanti, mieux possible).
    if (enemies.some((e) => e.champion)) {
      fightItems.push(generateItem({ ilvl: lootFarmIlvl(s.bestStage), luckTier: dungeonLuckTier(lv) + 4, minTier: 6, primaryBias: pickBias(s.characters), uniqueSource: 'dungeon' }))
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
      resetMemento() // 💀 Memento mori : fin du run
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
        case 'xp': { const bonus = Math.round(1200 * lv * Math.pow(1.12, lv) * chestMult * (1 + (d.xpPotion ?? 0))); chars = grantTeamXp(chars, bonus).chars; cXp += bonus; break }
        case 'stuff': {
          // v0.36 — ilvl du butin = TA tranche (record de palier), IDENTIQUE à tous les niveaux. Ce qui
          // change avec le niveau : le NOMBRE d'objets (1 → 5, droite +1 tous les 3 niveaux) et la rareté (cf. cw).
          const ilvl = lootFarmIlvl(s.bestStage)
          // v0.39.1 — droite linéaire 1 → 5 (plafond), +1 tous les 3 niveaux (paliers aux niv 4/7/10/13).
          const count = Math.max(1, Math.round(Math.min(5, 1 + Math.floor((lv - 1) / 3)) * chestMult))
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
                  cw.shoulder != null ? { shoulder: cw.shoulder } : undefined,
                )
            items.push(generateItem({ ilvl, rarity, primaryBias: bias, uniqueSource: 'dungeon' }))
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
export function applyAoe(chars: Character[], baseDmg: number, type: DamageType, req = 0, onlyIdx?: number): Character[] {
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

export function tickRaid(s: GameState, dt: number, set: (s: GameState) => void) {
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
    resetMemento() // 💀 Memento mori : fin du run
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
        // v0.40.2 — Abîme : forme custom (down 0.78 / shoulder 0.20 / tail 0.10) → Cosmique/Abyssal/Primo/
        // Trans = 39/50/10/1 EXACTEMENT. Raids de base : même côté gauche (down 0.30) mais traîne haute
        // RESSERRÉE (shoulder 0.15 / tail 0.12) → le sommet (Primo/Trans) reste sous l'Abîme.
        const rarity = def.id === 'abysse'
          ? rollWindowRarity(w.floor, w.peak, w.cap, { down: 0.78, shoulder: 0.20, tail: 0.10 })
          : rollWindowRarity(w.floor, w.peak, w.cap, { shoulder: 0.15, tail: 0.12 })
        // L'Abîme : ~30% des objets sont des pièces de la RÉGALIA DU NÉANT (set exclusif).
        if (def.id === 'abysse' && Math.random() < 0.3) {
          const sd = SETS.neant
          const types = Object.keys(sd.pieces) as ItemType[]
          const t = types[Math.floor(Math.random() * types.length)]
          const it = generateItem({ ilvl, rarity, type: t, primaryBias: bias, minStars: 4, uniqueSource: 'raid', ...(t === 'armePrincipale' ? { element: 'ombre' as DamageType } : {}) })
          it.setId = sd.id
          it.name = sd.pieces[t]!
          items.push(it)
          continue
        }
        const lootType = pickRaidLootType(def)
        items.push(generateItem({
          ilvl, rarity, type: lootType, primaryBias: bias, minStars: def.id === 'abysse' ? 4 : 3, uniqueSource: 'raid',
          ...(def.id === 'nexus' ? { biasResist: DAMAGE_TYPE_LIST[Math.floor(Math.random() * DAMAGE_TYPE_LIST.length)] } : {}),
        }))
      }
      const cosmic = raidCosmicQty(def, tier) // v0.36 — déterministe (courbe partagée, 0 sous Cosmique/Ch.12)
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
export function applyChestRewards(s: GameState, c: ChestReward): Pick<GameState, 'inventory' | 'codex' | 'essence' | 'noyau' | 'poussiere' | 'cosmic' | 'gold' | 'sceaux' | 'orbes' | 'fragments' | 'gemDust' | 'gems' | 'gemsSeen'> {
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

/** Compteur d'id de log, partagé (était module-privé du store ; `logId` reste interne ici). */
export function nextLogId(): number { return logId++ }
