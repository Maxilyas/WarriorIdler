/**
 * SLICE « personnages, talents & capacités » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import {
  charMaxHp, computeUnlockedPowers, teamTalentPool, talentsSpent, isBuilder, isSupport, SUPPORT_SLOTS
} from './character'
import { getTalent, canAllocate, canAllocatePantheon, eveilBudget } from './talents'
import { getPower } from './powers'
import { persist } from './save'
import { requestManualCast } from './combatEngine'
import { pushLog } from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createHerosSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'setActiveChar' | 'renameCharacter' | 'setBias' | 'completeOnboarding' | 'setPower' | 'setPassive'
  | 'setSupport' | 'togglePowerAuto' | 'castPower' | 'allocateTalent' | 'respecTalents' | 'allocatePantheon'
  | 'respecPantheon' | 'saveBuildPreset' | 'applyBuildPreset' | 'deleteBuildPreset'
> {
  return {
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

  }
}
