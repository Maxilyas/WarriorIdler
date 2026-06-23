/**
 * SLICE « gemmes de condition (sertissage, taille, fusion) » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import { craftMods, metierXpGain } from './metiers'
import { itemSockets, unsocketCost } from './gems'
import {
  rollCondGem, condGemKey, parseCondKey, getCondGem, condGemInstance, gemMaxRank, grindDust, recutCost,
  GEM_CUT_COST, GEM_FUSE_COUNT, GEM_FUSE_COST, GEM_CORRUPT_COST, GEM_QUALITIES, corruptOdds, rollCutQuality,
  drillCost, type CondGemId, type GemQuality
} from './condGems'
import { RARITIES } from './rarities'
import { persist } from './save'
import { applyItemPatch, findItemById, gainMetierXp, pushLog } from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createGemsSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'socketCondGem' | 'unsocketGem' | 'grindGem' | 'cutGem' | 'buyGem' | 'fuseGems'
  | 'fuseAllGems' | 'corruptGem' | 'drillSocket' | 'tradeGems' | 'recutGem'
> {
  return {
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

  }
}
