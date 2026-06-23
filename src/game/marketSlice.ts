/**
 * SLICE « coffres, recrutement, reset & prestige » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import type { Item, OffensiveStat } from './types'
import { makeCharacter } from './character'
import {
  generateItem, rollWindowRarity, recycleValue, recyclePoussiere, unlockedRarityTier, relicFromItem
} from './items'
import { constellationMods, echosGain, getConstNode, nodeCost, RELIC_BASE_ILVL } from './prestige'
import { rollCondGem } from './condGems'
import { makeEnemy, stageIlvl } from './enemies'
import { RARITIES } from './rarities'
import { SAVE_KEY, freshSave, persist, discoverFromItems } from './save'
import { clearCooldowns } from './combatEngine'
import { DAMAGE_TYPE_LIST } from './damage'
import { randomUniqueInstance, undiscoveredUnique } from './uniques'
import { getRaidDef, raidUnlocked } from './raids'
import {
  BOX_BULK_DISCOUNT, BOX_BULK_QTY, BOX_DUMP_SHAPE, BOX_PITY_CAP, BOX_PITY_STEP, BOX_RICH_SHAPE,
  CURSED_WIN_CHANCE, FREE_BOX_COOLDOWN_MS, MYSTERY_BOXES, RECRUE_NAMES, RECRUIT_COST, RECRUIT_POUSSIERE,
  bestRaidTier, boxGoldPrice, grantTeamXp, highestLevel, invMax, nextLogId, pickBias, pushLog, refreshGlobals,
  weakestSlotType, xpForLevel
} from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState, ChestReward } from './store'

export function createMarketSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'mysteryBox' | 'chooseFromChoice' | 'recruitCharacter' | 'reset' | 'awaken' | 'allocateConstellation'
> {
  return {
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
}
