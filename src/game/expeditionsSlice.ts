/**
 * SLICE « donjons, raids & coffres » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import { charMaxHp } from './character'
import { craftMods, metierXpGain } from './metiers'
import { equippedRules } from './enchants'
import { getCondGem } from './condGems'
import { RARITIES } from './rarities'
import { persist } from './save'
import { resetAllCooldowns } from './combatEngine'
import { insertCost, getUnique, UNIQUE_MAX_RANK, randomUniqueInstance } from './uniques'
import { generateDungeon, getDungeonDef } from './dungeons'
import { generateRaid, getRaidDef, raidUnlocked, raidBossVariant, raidTierUnlockCost, raidTierCap } from './raids'
import {
  CHOOSE_UNIQUE_COST, FRAGMENT_INFUSE_COST, SCEAU_COST, applyChestRewards, applyItemPatch, findItemById,
  fullHeal, gainMetierXp, pushLog
} from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createExpeditionsSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'enterDungeon' | 'abandonDungeon' | 'enterRaid' | 'abandonRaid' | 'unlockRaidTier' | 'infuseUnique'
  | 'chooseUnique' | 'insertEffect' | 'claimChest' | 'craftSceau'
> {
  return {
    enterDungeon: (dungeonId, level, repeat = 1, wing) => {
      const s = get()
      if (s.dungeon || s.raid) return
      const def = getDungeonDef(dungeonId)
      if (!def || s.bestStage < def.unlockStage) return
      if (s.sceaux < def.sceauCost) return
      if (level < 1 || level > (s.dungeonProgress[dungeonId] ?? 0) + 1) return
      const dungeon = generateDungeon(dungeonId, level, s.bestStage, wing)
      dungeon.repeatLeft = Math.max(0, Math.round(repeat) - 1)
      // ⚗️ Potions de contenu ARMÉES (Officine) : consommées à l'entrée.
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
      // le tier doit être DÉBLOQUÉ (clear de la frontière + Trophées — voir unlockRaidTier).
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
      // 🛡️ Potion de garde ARMÉE (Officine) : l'équipe entre bardée d'un bouclier.
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
      // cap de tiers par raid (l'Abîme s'arrête à 2). Au-delà, plus de déblocage.
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
      if (!mods.synth3) return // Synthèse III (arbre de l'Alchimiste, vague 100)
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

  }
}
