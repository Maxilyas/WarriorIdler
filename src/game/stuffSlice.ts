/**
 * SLICE « inventaire & équipement » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import type { Equipment, Item, EquipSlotId } from './types'
import { charMaxHp } from './character'
import { computeGlobalMods } from './upgrades'
import {
  sellValue, recycleValue, recyclePoussiere, itemScore, reforgeItem, surillvlItem, ascendItem, reforgeCost,
  surillvlCost, ascendCost, transmuteCost, craftRaidGate, contentRarityTier, SURILLVL_OVER_MARGIN,
  enhanceTypedAffixes, quintRefund
} from './items'
import { craftMods, metierXpGain } from './metiers'
import { RARITIES } from './rarities'
import { persist } from './save'
import { DAMAGE_TYPES } from './damage'
import { equipSlotsForType, slotAccepts } from './slots'
import { essenceGain, upgradeCost, getUnique, UNIQUE_MAX_RANK } from './uniques'
import {
  addQuint, applyItemPatch, bestRaidTier, bulkProtected, findItemById, gainMetierXp, gemStockAdd, invMax,
  itemUsefulForAnyChar, maxContentIlvl, partyBaseStats, pushLog, quintLogSuffix
} from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createStuffSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'equip' | 'unequip' | 'sell' | 'recycle' | 'sellAllBelow' | 'recycleAllBelow'
  | 'toggleLock' | 'sellMany' | 'recycleMany' | 'reforge' | 'surillvl' | 'ascend'
  | 'upgradeUnique' | 'transmute' | 'enhanceTyped'
> {
  return {
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

    sellAllBelow: (tier, uselessOnly = false) => {
      const s = get()
      // `uselessOnly` : ne cible QUE le butin qui n'améliore ni le DPS ni la survie d'aucun héros recruté
      // (case à cocher du tri manuel) — mêmes bases DPS/survie précalculées une fois.
      const bases = uselessOnly ? partyBaseStats(s.characters) : null
      let gold = s.gold
      let gems = s.gems
      let count = 0
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier && !bulkProtected(item) && (!bases || !itemUsefulForAnyChar(s.characters, bases, item))) {
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

    recycleAllBelow: (tier, uselessOnly = false) => {
      const s = get()
      const mods = craftMods(s.metiers)
      // `uselessOnly` : ne recycle QUE le butin qui n'améliore ni le DPS ni la survie d'aucun héros recruté.
      const bases = uselessOnly ? partyBaseStats(s.characters) : null
      let essence = s.essence
      let poussiere = s.poussiere
      let quint = s.quint
      let gems = s.gems
      let count = 0
      let xp = 0
      const essences = { ...s.essences }
      const keep: Item[] = []
      for (const item of s.inventory) {
        if (RARITIES[item.rarity].tier < tier && !bulkProtected(item) && (!bases || !itemUsefulForAnyChar(s.characters, bases, item))) {
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
      const c = ascendCost(item, contentRarityTier(s.bestStage, bestRaidTier(s.raidProgress)))
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

  }
}
