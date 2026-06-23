/**
 * SLICE « forge, métiers & automates » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import { generateItem, createCost, maxCraftTier, contentRarityTier } from './items'
import {
  craftMods, metierXpGain, canLearnNode, getMetierNode, respecCost, levelFromXp, METIERS, METIER_NODES,
  METIER_BRANCHES, AUTOMATE_FORGERON_LEVELS, pointsSpentInBranch, respecBranchCost, forgeBonus,
  signatureLingotCost, smeltLingots, MASTERWORK_LINGOTS, masterworkKey, frappeActive, CHALEUR_MAX,
  FRAPPE_HEAT_PERFECT, FRAPPE_HEAT_GOOD, FRAPPE_STREAK_RARITY, SURCHAUFFE_COST
} from './metiers'
import { itemSockets } from './gems'
import { currentWeek } from './maitrise'
import {
  missionLabel, automateUpgradeCost, AUTOMATE_MAX, AUTOMATE_COSTS, AUTOMATE_NAMES, AUTOMATE_UPG_MAX,
  type Automate
} from './automates'
import { stageIlvl } from './enemies'
import { RARITIES, RARITY_LIST } from './rarities'
import { persist, discoverFromItems } from './save'
import { type DungeonId } from './dungeons'
import { type RaidId } from './raids'
import {
  CONTRACT_LINGOTS, applyItemPatch, bestRaidTier, findItemById, forgeContractsForDay, gainMetierXp, invMax,
  pushLog
} from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createAtelierSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'createItem' | 'strikeForge' | 'smeltItem' | 'startTempering' | 'collectTempering' | 'learnMetierNode'
  | 'respecMetier' | 'respecMetierBranch' | 'buildAutomate' | 'assignAutomate' | 'toggleAutomatePause' | 'upgradeAutomate'
> {
  return {
    createItem: (opts) => {
      const s = get()
      const mods = craftMods(s.metiers)
      const tier = RARITIES[opts.rarity].tier
      // double horloge — la rareté craftable est bornée par la vague ET le tier de raid.
      const craftCap = maxCraftTier(s.bestStage, bestRaidTier(s.raidProgress))
      if (tier > craftCap) return
      // bonus de création UNIVERSELS (Maître forgeron + Signature), plus de corps de métier.
      const forge = forgeBonus(mods)
      // la forge crée au niveau de ton FARM (vague) + bonus de métier — pas les donjons/raids, qui
      // faisaient sauter l'ilvl bien au-dessus du farm (ex. donjon nv 8 / raid T4 = ilvl 105 à la vague 50).
      const ilvl = stageIlvl(Math.max(1, s.bestStage)) + forge.ilvlBonus
      // 🏆 Chef-d'œuvre (étage V) : 1/semaine, +1 cran GARANTI (capé), châsse garantie, coût ×1,5 + Lingots.
      const week = currentWeek()
      const masterwork = !!opts.masterwork
      if (masterwork && (!forge.masterwork || s.lastMasterwork >= week || s.lingots < MASTERWORK_LINGOTS)) return
      // ✒️ Signature : affixe garanti AU CHOIX (universel, débloqué par le nœud Signature) — coûte des Lingots.
      const signature = opts.signature && forge.signatures?.includes(opts.signature) ? opts.signature : undefined
      const signCost = signature ? Math.max(1, Math.round(signatureLingotCost(tier) * mods.signatureCostMult)) : 0
      if (signature && s.lingots < signCost + (masterwork ? MASTERWORK_LINGOTS : 0)) return
      // Coût : rareté choisie × métier (Économe) × chef-d'œuvre (×1,5).
      const c = createCost(tier, ilvl, contentRarityTier(s.bestStage, bestRaidTier(s.raidProgress)))
      const m = mods.costMult * (masterwork ? 1.5 : 1)
      const cost = { eclats: Math.round(c.eclats * m), noyau: Math.round(c.noyau * m), fragments: Math.round((c.fragments ?? 0) * m), poussiere: Math.round((c.poussiere ?? 0) * m), cosmic: Math.round((c.cosmic ?? 0) * m) }
      if (s.essence < cost.eclats || s.noyau < cost.noyau || s.fragments < cost.fragments || s.poussiere < cost.poussiere || s.cosmic < cost.cosmic) return
      // 🎲 Prodige : chance de rareté SUPÉRIEURE (corps IV : +12% local) — 💡 Inspiration : DEUX crans.
      const lucky = masterwork || (Math.random() < Math.min(0.75, mods.luckChance + forge.luckBonus + mods.chainChance + mods.creuset) && tier < craftCap)
      const inspired = lucky && !masterwork && mods.inspiration > 0 && Math.random() < mods.inspiration && tier + 2 <= craftCap
      // 🔨 Frappe maîtrisée : 5 PARFAITS d'affilée → +1 cran de rareté GARANTI (consommé ici).
      const streakReady = frappeActive(s.metiers) && s.chaleurStreak >= FRAPPE_STREAK_RARITY && tier < craftCap
      // 🔥 Surchauffe : dépense de Chaleur → +1 ⭐ garanti sur la pièce.
      const surchauffe = !!opts.surchauffe && frappeActive(s.metiers) && s.chaleur >= SURCHAUFFE_COST
      const prodTier = Math.min(craftCap, tier + (inspired ? 2 : lucky ? 1 : 0) + (streakReady ? 1 : 0))
      const rarityId = RARITY_LIST.find((r) => r.tier === prodTier)?.id ?? opts.rarity
      const item = generateItem({
        ilvl, type: opts.type, rarity: rarityId, primary: opts.primary,
        // ⭐ Polissage : meilleure distribution de qualité ; Chef-d'œuvre : qualité plancher Fin.
        starsFin: mods.polissage ? mods.polishFin : 0,
        ...(masterwork ? { minStars: 3 } : {}),
        ...(opts.orientation ? { orientation: opts.orientation } : {}),
        ...(opts.element ? { element: opts.element } : {}),
        ...(signature ? { forceStat: signature } : {}),
      })
      // 🔥 Surchauffe : +1 ⭐ garanti (capé à 5).
      if (surchauffe) item.stars = Math.min(5, (item.stars ?? 0) + 1)
      // ◈ Chaîne « qualité » + Creuset : chance d'un ⭐ supplémentaire (synergies hexagonales, Lot 4).
      if (Math.random() < mods.chainQualite + mods.creuset) item.stars = Math.min(5, (item.stars ?? 0) + 1)
      // 🏆 Chef-d'œuvre : châsse garantie (la qualité est désormais roulée dans generateItem).
      if (masterwork && itemSockets(item, 0) < 1) item.sockets = 1
      const inventory = [item, ...s.inventory].slice(0, invMax)
      // 🍀 Sérendipité : un craft SANS proc rembourse une part des coûts.
      const refundPct = !lucky && mods.serendipite > 0 ? mods.serendipite : 0
      const refund = {
        eclats: Math.round(cost.eclats * refundPct), noyau: Math.round(cost.noyau * refundPct),
        fragments: Math.round(cost.fragments * refundPct), poussiere: Math.round(cost.poussiere * refundPct),
        cosmic: Math.round(cost.cosmic * refundPct),
      }
      const gain = metierXpGain(prodTier, 'create', mods.forgeronXpMult * forge.xpMult * (masterwork ? 2 : 1))
      const g = gainMetierXp(s, 'forgeron', gain)
      let log = pushLog(
        g.log,
        `${masterwork ? '🏆 CHEF-D\'ŒUVRE : ' : 'Forgé : '}${item.name} (${RARITIES[rarityId].name}${item.stars ? ` ⭐${item.stars}` : ''})`
        + `${inspired ? ' — 💡 INSPIRATION, deux crans !' : lucky && !masterwork ? ' — 🎲 rareté chanceuse !' : ''}`
        + `${signature ? ` · ✒️ Signature ${signature}` : ''} (+${gain} XP 🔨).`,
        'craft',
      )
      if (streakReady) log = pushLog(log, `⚡ Frappe maîtrisée : +1 cran de rareté garanti !`, 'craft')
      if (surchauffe) log = pushLog(log, `🔥 Surchauffe : +1 ⭐ (−${SURCHAUFFE_COST} Chaleur).`, 'craft')
      if (refundPct > 0 && refund.eclats > 0) log = pushLog(log, `🍀 Sérendipité : ${Math.round(refundPct * 100)}% des coûts remboursés.`, 'craft')
      // 📋 Contrats de forge : la commande du jour est-elle remplie par CE craft ?
      let lingots = s.lingots - signCost - (masterwork ? MASTERWORK_LINGOTS : 0)
      let forgeContracts = s.forgeContracts
      if (mods.contrats) {
        const today = Math.floor(Date.now() / 86_400_000)
        if (!forgeContracts || forgeContracts.day !== today) forgeContracts = { day: today, done: [false, false, false] }
        const defs = forgeContractsForDay(today, craftCap)
        const hitIdx = defs.findIndex((d2, i) => !forgeContracts!.done[i] && d2.type === opts.type && d2.primary === opts.primary && prodTier >= d2.minTier)
        if (hitIdx >= 0) {
          const reward = CONTRACT_LINGOTS + mods.negociant
          lingots += reward
          forgeContracts = { ...forgeContracts, done: forgeContracts.done.map((d2, i) => (i === hitIdx ? true : d2)) }
          const cg = gainMetierXp({ metiers: g.metiers, log, characters: s.characters }, 'forgeron', gain * 2)
          g.metiers = cg.metiers
          log = pushLog(cg.log, `📋 CONTRAT REMPLI : +${reward} Lingot${reward > 1 ? 's' : ''} 🧱 et double XP !`, 'craft')
        }
      }
      // 🔥 Foyer : un Chef-d'œuvre d'un type INÉDIT accélère la production passive (boucle vertueuse).
      let foyer = s.foyer
      if (masterwork) {
        const mwk = masterworkKey(item.type, item.primary, item.damageType, item.rarity)
        if (!foyer.masterworkKeys.includes(mwk)) foyer = { ...foyer, masterworkKeys: [...foyer.masterworkKeys, mwk] }
      }
      const next = {
        ...s,
        foyer,
        chaleur: surchauffe ? s.chaleur - SURCHAUFFE_COST : s.chaleur,
        chaleurStreak: streakReady ? 0 : s.chaleurStreak,
        essence: s.essence - cost.eclats + refund.eclats,
        noyau: s.noyau - cost.noyau + refund.noyau,
        fragments: s.fragments - cost.fragments + refund.fragments,
        poussiere: s.poussiere - cost.poussiere + refund.poussiere,
        cosmic: s.cosmic - cost.cosmic + refund.cosmic,
        lingots,
        forgeContracts,
        lastMasterwork: masterwork ? week : s.lastMasterwork,
        metiers: g.metiers,
        inventory,
        codex: discoverFromItems(s.codex, [item]),
        log,
      }
      persist(next)
      set(next)
    },

    strikeForge: (result) => {
      const s = get()
      if (!frappeActive(s.metiers)) return
      let chaleur = s.chaleur
      let streak = s.chaleurStreak
      let xpGain = 0
      if (result === 'perfect') {
        chaleur = Math.min(CHALEUR_MAX, chaleur + FRAPPE_HEAT_PERFECT)
        streak += 1
        xpGain = metierXpGain(2, 'modify', craftMods(s.metiers).forgeronXpMult)
      } else if (result === 'good') {
        chaleur = Math.min(CHALEUR_MAX, chaleur + FRAPPE_HEAT_GOOD)
        xpGain = 1
      } else {
        streak = 0
      }
      const g = xpGain > 0 ? gainMetierXp(s, 'forgeron', xpGain) : { metiers: s.metiers, log: s.log }
      const next = { ...s, chaleur, chaleurStreak: streak, metiers: g.metiers, log: g.log }
      persist(next)
      set(next)
    },

    smeltItem: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.fonderie) return // nœud « Fonderie »
      const idx = s.inventory.findIndex((i) => i.id === itemId)
      if (idx < 0) return // uniquement depuis le SAC (jamais l'équipé)
      const item = s.inventory[idx]
      const base = smeltLingots(RARITIES[item.rarity].tier)
      if (base <= 0) return // sous Rare : ne vaut pas le feu
      const tierS = RARITIES[item.rarity].tier
      const lingots = Math.max(1, Math.round(base * mods.lingotierMult))
      // ◆ Haut fourneau (keystone Fondeur) : burst d'XP (fonte = 'ascend' ×2) + remboursement d'éclats.
      const gain = mods.hautFourneau
        ? metierXpGain(tierS, 'ascend', mods.forgeronXpMult) * 2
        : metierXpGain(tierS, 'modify', mods.forgeronXpMult)
      const eclatsRefund = mods.hautFourneau ? Math.round(tierS * tierS * 6) : 0
      const g = gainMetierXp(s, 'forgeron', gain)
      const next = {
        ...s,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        lingots: s.lingots + lingots,
        essence: s.essence + eclatsRefund,
        metiers: g.metiers,
        log: pushLog(g.log, `🫕 Fondu : ${item.name} → +${lingots} Lingot${lingots > 1 ? 's' : ''} 🧱${mods.hautFourneau ? ` · 🌋 +${eclatsRefund} ♦ & burst d'XP` : ''}.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    startTempering: (itemId) => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.trempeLente || s.trempe) return
      const item = s.inventory.find((i) => i.id === itemId)
      if (!item || (item.trempeCount ?? 0) >= 5) return
      const next = {
        ...s,
        trempe: { itemId, startedAt: Date.now() },
        log: pushLog(s.log, `🔥 ${item.name} plonge dans le bac de trempe (+1 iLvl par 24 h réelles, ${5 - (item.trempeCount ?? 0)} restants).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    collectTempering: () => {
      const s = get()
      if (!s.trempe) return
      const item = findItemById(s, s.trempe.itemId)
      if (!item) {
        const next = { ...s, trempe: null }
        persist(next)
        set(next)
        return
      }
      const days = Math.floor((Date.now() - s.trempe.startedAt) / 86_400_000)
      const gained = Math.max(0, Math.min(days, 5 - (item.trempeCount ?? 0)))
      if (gained <= 0) {
        const next = { ...s, trempe: null, log: pushLog(s.log, `🔥 ${item.name} ressort du bac — pas encore trempé (24 h par iLvl).`, 'craft') }
        persist(next)
        set(next)
        return
      }
      // +1 iLvl par jour : rescale plat (mêmes règles que le surillvl, lignes % intactes).
      const newIlvl = item.ilvl + gained
      const ratio = newIlvl / item.ilvl
      const upd = applyItemPatch(s, item.id, {
        ilvl: newIlvl,
        primaryValue: Math.round(item.primaryValue * ratio),
        endurance: Math.round(item.endurance * ratio),
        affixes: item.affixes.map((a) => (a.kind === 'stat' ? { ...a, value: Math.round(a.value * ratio) } : a)),
        trempeCount: (item.trempeCount ?? 0) + gained,
      })
      if (!upd) return
      const g = gainMetierXp(s, 'forgeron', metierXpGain(RARITIES[item.rarity].tier, 'ascend'))
      const next = {
        ...s, ...upd, trempe: null, metiers: g.metiers,
        log: pushLog(g.log, `🔥 Trempe lente : ${item.name} +${gained} iLvl (${item.ilvl} → ${newIlvl}).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    learnMetierNode: (metier, nodeId) => {
      const s = get()
      const def = getMetierNode(metier, nodeId)
      if (!def) return
      if (!canLearnNode(s.metiers, metier, nodeId, s.bestStage).ok) return
      const st = s.metiers[metier]
      const nodes = { ...st.nodes }
      // SWITCH d'exclusive GRATUIT (no-regret) : choisir une autre spé rembourse la
      // précédente (ses rangs redeviennent des points), au lieu d'exiger un respec payant.
      if (def.exclusive && (nodes[nodeId] ?? 0) === 0) {
        for (const n of METIER_NODES[metier]) {
          if (n.exclusive === def.exclusive && n.id !== nodeId) delete nodes[n.id]
        }
      }
      nodes[nodeId] = (nodes[nodeId] ?? 0) + 1
      const rank = nodes[nodeId]
      const metiers = { ...s.metiers, [metier]: { ...st, nodes } }
      const m = METIERS[metier]
      const next = {
        ...s, metiers,
        log: pushLog(s.log, `${m.icon} ${m.name} : ${def.icon} ${def.name}${def.maxRank > 1 ? ` rang ${rank}` : ''} appris !`, 'craft'),
      }
      persist(next)
      set(next)
    },

    respecMetier: (metier) => {
      const s = get()
      const st = s.metiers[metier]
      if (Object.keys(st.nodes).length === 0) return
      const cost = respecCost(st)
      if (s.gold < cost) return
      const metiers = { ...s.metiers, [metier]: { ...st, nodes: {} } }
      const m = METIERS[metier]
      const next = {
        ...s, metiers, gold: s.gold - cost,
        log: pushLog(s.log, `${m.icon} ${m.name} : arbre réinitialisé (-${cost.toLocaleString('fr-FR')} or). Points rendus.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    respecMetierBranch: (metier, branchId) => {
      const s = get()
      const st = s.metiers[metier]
      if (pointsSpentInBranch(st, metier, branchId) === 0) return
      const cost = respecBranchCost(st)
      if (s.gold < cost) return
      // Ne rase que les nœuds de la branche ('tronc' = nœuds sans champ branch).
      const nodes = { ...st.nodes }
      for (const n of METIER_NODES[metier]) {
        if ((n.branch ?? 'tronc') === branchId) delete nodes[n.id]
      }
      const metiers = { ...s.metiers, [metier]: { ...st, nodes } }
      const m = METIERS[metier]
      const bname = branchId === 'tronc' ? 'Tronc commun' : METIER_BRANCHES[metier].find((b) => b.id === branchId)?.name ?? branchId
      const next = {
        ...s, metiers, gold: s.gold - cost,
        log: pushLog(s.log, `${m.icon} ${m.name} : branche « ${bname} » réinitialisée (-${cost.toLocaleString('fr-FR')} or). Points rendus.`, 'craft'),
      }
      persist(next)
      set(next)
    },

    buildAutomate: () => {
      const s = get()
      const mods = craftMods(s.metiers)
      if (!mods.automates) return // nœud « Industrialisation » de l'arbre du Forgeron
      const idx = s.automates.length
      if (idx >= AUTOMATE_MAX) return
      if (idx >= 3 && !mods.automate4) return // 🏭 la 4e machine exige « Manufacture »
      if (levelFromXp(s.metiers.forgeron.xp) < AUTOMATE_FORGERON_LEVELS[idx]) return
      const c = AUTOMATE_COSTS[idx]
      if (s.gold < c.gold || s.poussiere < c.poussiere || s.fragments < c.fragments || s.cosmic < c.cosmic) return
      const a: Automate = {
        id: idx + 1,
        name: AUTOMATE_NAMES[idx] ?? `Automate ${idx + 1}`,
        mission: null, progress: 0, paused: false, speedLvl: 0, yieldLvl: 0, bank: {},
      }
      const next = {
        ...s,
        gold: s.gold - c.gold,
        poussiere: s.poussiere - c.poussiere,
        fragments: s.fragments - c.fragments,
        cosmic: s.cosmic - c.cosmic,
        automates: [...s.automates, a],
        log: pushLog(s.log, `🤖 Automate construit : ${a.name} ! Assigne-lui un donjon ou un raid déjà battu (Atelier).`, 'craft'),
      }
      persist(next)
      set(next)
    },

    assignAutomate: (id, mission) => {
      const s = get()
      if (mission) {
        // Uniquement du contenu DÉJÀ BATTU (l'automate ne progresse jamais, il récolte).
        const record = mission.kind === 'dungeon'
          ? s.dungeonProgress[mission.id as DungeonId] ?? 0
          : s.raidProgress[mission.id as RaidId] ?? 0
        if (mission.level < 1 || mission.level > record) return
      }
      const automates = s.automates.map((a) => (a.id === id ? { ...a, mission, progress: 0, waiting: false } : a))
      const next = {
        ...s, automates,
        log: pushLog(s.log, mission
          ? `🤖 Mission assignée : ${missionLabel(mission)}.`
          : '🤖 Mission retirée — l\'automate est au repos.', 'craft'),
      }
      persist(next)
      set(next)
    },

    toggleAutomatePause: (id) => {
      const s = get()
      const automates = s.automates.map((a) => (a.id === id ? { ...a, paused: !a.paused } : a))
      const next = { ...s, automates }
      persist(next)
      set(next)
    },

    upgradeAutomate: (id, kind) => {
      const s = get()
      const a = s.automates.find((x) => x.id === id)
      if (!a) return
      const lvl = kind === 'speed' ? a.speedLvl : a.yieldLvl
      if (lvl >= AUTOMATE_UPG_MAX) return
      const cost = automateUpgradeCost(kind, lvl)
      if (s.gold < cost) return
      const automates = s.automates.map((x) =>
        x.id === id ? { ...x, speedLvl: kind === 'speed' ? x.speedLvl + 1 : x.speedLvl, yieldLvl: kind === 'yield' ? x.yieldLvl + 1 : x.yieldLvl } : x,
      )
      const next = {
        ...s, automates, gold: s.gold - cost,
        log: pushLog(s.log, `🤖 ${a.name} amélioré : ${kind === 'speed' ? 'vitesse' : 'rendement'} niv. ${lvl + 1} (-${cost.toLocaleString('fr-FR')} or).`, 'craft'),
      }
      persist(next)
      set(next)
    },

  }
}
