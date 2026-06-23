/**
 * SLICE « runes & alchimie (Officine) » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import { craftMods, metierXpGain } from './metiers'
import {
  getEnchant, enchantCost, rollRuneDrop, equippedPacts, eraseFragments, runeForgeCost, RUNE_GAMBLE_COST
} from './enchants'
import {
  REAGENTS, getBrew, recipeForPair, EXPERIMENT_COST, BREW_QUALITIES, brewQualityAt, brewKey, parseBrewKey,
  millesimeChance, DAILY_TRANSMUTE_COST, PHILOSOPHALE_COST, PHILOSOPHALE_MULT, type BrewQuality
} from './alchimie'
import { RARITIES } from './rarities'
import { persist } from './save'
import { DAMAGE_TYPE_LIST, DAMAGE_TYPES } from './damage'
import { applyItemPatch, findItemById, gainMetierXp, pushLog } from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createOfficineSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'enchantItem' | 'eraseRune' | 'forgeRune' | 'gambleRune' | 'experiment' | 'brewStart'
  | 'brewCollect' | 'drinkElixir' | 'armPotion' | 'useOil' | 'useAntidote' | 'drinkMutagen'
  | 'dailyTransmute' | 'craftPhilosophale'
> {
  return {
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

  }
}
