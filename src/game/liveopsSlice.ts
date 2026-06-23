/**
 * SLICE « marché, tutoriel, inbox, daily/event, maîtrises, hauts faits » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import {
  getUpgrade, upgradeCost as accountUpgradeCost, upgradePoussiere, upgradeEclats, isMaxed, computeGlobalMods
} from './upgrades'
import { evaluateNewAchievements, fullyEquippedMinIlvl, getAchievement, type AchvCtx } from './achievements'
import { cosmeticCost } from './avatar'
import { generateItem } from './items'
import { levelFromXp, METIER_LIST } from './metiers'
import { equippedPacts } from './enchants'
import { getMaitriseNode } from './maitrise'
import { stageIlvl } from './enemies'
import { persist, discoverFromItems } from './save'
import { TUT_QUESTS } from './tutorial'
import { hasReward as inboxHasReward, INBOX_CAP } from './inbox'
import { dailyMetrics, rollDaily, getDailyQuest, questDone, todayStr, LOGIN_REWARDS } from './daily'
import { rollEvent, eventPoints, EVENT_MILESTONES, invasionAuraId } from './event'
import { getRaidDef, globalTier, RAID_LIST } from './raids'
import {
  bestRaidTier, generateShop, highestLevel, invMax, pickBias, pushLog, refreshGlobals, shopBuyPrice,
  shopRefreshCost, tutContext
} from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createLiveopsSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'buyUpgrade' | 'refreshShop' | 'buyShopItem' | 'claimTutorialReward' | 'claimInbox' | 'claimAllInbox'
  | 'pushInbox' | 'markInboxSeen' | 'rollDailyIfNeeded' | 'claimDailyQuest' | 'claimLogin' | 'rollEventIfNeeded'
  | 'claimEventMilestone' | 'learnMaitrise' | 'checkAchievements' | 'selectTitle' | 'setAvatar' | 'unlockCosmetic'
> {
  return {
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
      // 'talentBonus' n'écrit pas de champ par-perso : le bonus est lu depuis upgrades.talentBonus
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
        tut: { ...s.tut, bought: true }, // quête tuto « Marché »
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
        // ---- étage Légende ----
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

  }
}
