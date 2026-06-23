/**
 * SLICE « boucle de combat (tick 5 Hz) » — actions extraites de store.ts (découpage des actions Zustand par domaine).
 * Pattern : la fabrique renvoie un Pick<GameState, …> que le store spread dans son return ;
 * import type seul du store → pas de cycle runtime. set/get typés sur l'état complet (sliceTypes).
 */
import { makeCharacter } from './character'
import { computeGlobalMods } from './upgrades'
import { achievementBonuses } from './achievements'
import { generateItem, rollFarmRarity, recycleValue, recyclePoussiere } from './items'
import { craftMods, foyerActive, foyerRate, foyerAccrue } from './metiers'
import { equippedRules, equippedTimeRunes, timeRuneMods, ruleAmp } from './enchants'
import {
  condGemMods, rollCondGem, condGemKey, gemMaxRank, grindDust, BIOME_GEM_FAMILY, COND_GEM_DROP, GEM_DUST_DROP,
  CHAMPION_GEM_DROP
} from './condGems'
import { tickAutomates } from './automates'
import { REAGENTS, REAGENT_DROP, PHILOSOPHALE_MULT } from './alchimie'
import { makeEnemy, isBossStage, stageIlvl } from './enemies'
import { chapitreOf, vagueOf, raidGateForStage } from './progression'
import { maitriseBonus, surgeBiome, SURGE_GOLD_XP_MULT, SURGE_QUINT_MULT } from './biomeBonus'
import { RARITIES } from './rarities'
import { essenceGain } from './uniques'
import { persistThrottled, discoverFromItems } from './save'
import {
  partyCombatStep, crescendoBonus, crescendoAdd, crescendoReset, resetAllCooldowns, resetLongestCooldown,
  tresorerieShield, gemKillEvents
} from './combatEngine'
import { DAMAGE_TYPES } from './damage'
import {
  CHAR2_STAGE, CHAR3_STAGE, CLASSIC_GOLD_MULT, CLASSIC_XP_MULT, QUINT_DROP, RECRUE_NAMES, RETREAT_STAGES,
  activeBrewBuffs, autoEquipEmpties, bestRaidTier, bulkProtected, capPrepend, conseilProgress, fullHeal, gainMetierXp, grantTeamXp,
  highestLevel, invMax, itemUsefulForAnyChar, partyBaseStats, pickBias, pushLog, quintTierMult, teamGemOpts, teamPactMods, tickDungeon, tickRaid
} from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createTickSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'tick'
> {
  return {
    tick: (dt) => {
      let s = get()

      // Automates de forge : avancent en PARALLÈLE de tout le reste (farm, donjon, raid).
      const tickRules = equippedRules(s.characters)
      const tickCraft = craftMods(s.metiers)
      const ar = tickAutomates(
        s, dt,
        tickRules.has('econome') ? (tickCraft.loiAmplifiee ? 0.25 : 0.15) : 0,
        tickCraft.automateDurMult,
        tickRules.has('coffresDoubles') ? 0.15 * ruleAmp(tickCraft.ruleAmpTier) : 0,
      )
      if (ar) {
        let log = s.log
        for (const line of ar.lines) log = pushLog(log, line, 'craft')
        let characters = s.characters
        if (ar.xpEach > 0) characters = grantTeamXp(characters, ar.xpEach).chars
        s = { ...s, ...ar.eco, characters, log }
        if (ar.completed) persistThrottled(s)
      }

      // 🔥 Le Foyer : production idle d'XP + Lingots, en parallèle de tout (farm/donjon/raid).
      // Crédité par paquets toutes ~2 s (lissé) ; au retour d'absence, le grand écart est plafonné (12 h).
      if (foyerActive(s.metiers) && Date.now() - s.foyer.lastTick >= 2000) {
        const rate = foyerRate(s.metiers, s.automates.length, s.bestStage, s.foyer.masterworkKeys.length)
        const acc = foyerAccrue(s.foyer, rate, Date.now())
        let foyerLog = s.log
        let foyerMetiers = s.metiers
        if (acc.xp > 0) {
          const g = gainMetierXp({ metiers: foyerMetiers, log: foyerLog, characters: s.characters }, 'forgeron', acc.xp)
          foyerMetiers = g.metiers
          foyerLog = g.log
        }
        s = { ...s, foyer: acc.foyer, metiers: foyerMetiers, lingots: s.lingots + acc.lingots, log: foyerLog }
      }

      if (s.raid) {
        tickRaid(s, dt, set)
        return
      }
      if (s.dungeon) {
        tickDungeon(s, dt, set)
        return
      }

      // Bonus de biome : Maîtrise des Zones partout + gemme d'ENVIRONNEMENT (🌩️ Orage en
      // Surcharge) et 📯 Crescendo. (Élan du voyageur et gemme Nomade supprimés.)
      const cmodsTick = craftMods(s.metiers)
      const cond = condGemMods(s.characters, cmodsTick.gemSpec, teamGemOpts(s, cmodsTick))
      const runes = timeRuneMods(equippedTimeRunes(s.characters), cmodsTick.runisteTempo)
      const buffs = activeBrewBuffs(s)
      const pact = teamPactMods(s, cmodsTick, buffs)
      const surgedNow = surgeBiome() === s.activeBiome
      // 🧗 Pied du mur : à ≤ 2 vagues du record, le push frappe plus fort.
      const nearRecord = s.stage >= s.bestStage - 2
      const heroMult = (1 + maitriseBonus(s.bestStage))
        * (1 + crescendoBonus(cond.crescendoCap))
        * (surgedNow && cond.orage ? 1 + cond.orage : 1)
        * (nearRecord && cond.piedDuMurPct ? 1 + cond.piedDuMurPct : 1)
        * buffs.dmgMult
        * (buffs.oil && buffs.oil.type === s.activeBiome ? 1 + buffs.oil.pct : 1)
      const res = partyCombatStep(s.characters, s.enemy, dt, {
        heroMult, cond, runes, pact,
        // régén des murs Ch.6+ (sustain check) ; le tick l'applique à l'ennemi (mods.regen).
        regen: s.enemy.mur?.regen,
        content: { surge: surgedNow, biomeType: s.activeBiome, nearRecord, antidote: buffs.antidote ?? undefined },
      })
      let chars = res.chars
      const enemy = res.enemy
      let log = s.log
      for (const n of res.revived ?? []) log = pushLog(log, `🕊️ Sursis : ${n} survit in extremis !`, 'info')
      for (const n of res.rezzed ?? []) log = pushLog(log, `⛑️ ${n} se relève (35% PV) !`, 'info')

      if (!res.anyAlive) {
        crescendoReset() // 📯 Crescendo : l'équipe tombe, le cumul retombe
        // la mort ne fait JAMAIS retomber sous le Chapitre courant : le dernier mur franchi est un
        // CHECKPOINT. Repli de RETREAT_STAGES vagues, borné au plancher du Chapitre (1re vague du bloc de 10).
        const palierFloor = Math.floor((s.stage - 1) / 10) * 10 + 1
        const stage = Math.max(1, palierFloor, s.stage - RETREAT_STAGES)
        const healed = chars.map(fullHeal)
        log = pushLog(log, `💀 Équipe vaincue ! Repli au Chapitre ${chapitreOf(stage)} · Vague ${vagueOf(stage)}.`, 'death')
        const next = { ...s, characters: healed, stage, enemy: makeEnemy(stage, s.activeBiome), log }
        persistThrottled(next)
        set(next)
        return
      }

      if (enemy.hp <= 0) {
        let { stage, bestStage, gold, sceaux, inventory, poussiere, essence } = s
        const boss = isBossStage(stage)
        // ⛑️ Résurrection à la vague : un héros tombé (raid abandonné, mort isolée…) se relève à
        // chaque vague RÉSOLUE (gagnée ici ; perdue = repli plus haut). La mort n'a aucun coût.
        chars = chars.map((c) => (c.hp <= 0 ? fullHeal(c) : c))
        // 📯 Crescendo & 🛡️ Trésorerie : chaque kill nourrit le cumul / blinde le bouclier.
        crescendoAdd(1)
        tresorerieShield(chars, cond.tresorerieCap)
        gemKillEvents(chars, cond, 1, 1, runes, pact) // 🔔 Glas · 🦷 Fièvre · 🎺 Marche · 🪽 · 🍽️
        const eco = computeGlobalMods(s.upgrades, s.maitrise, achievementBonuses(s.achievements))
        // SURCHARGE élémentaire : le biome tournant rapporte +50% or/XP et ×2 quintessence.
        const surged = surgeBiome() === s.activeBiome
        const surgeMult = surged ? SURGE_GOLD_XP_MULT : 1
        // Runes de RÈGLE portées par l'équipe. ◈ Législateur amplifie (étages III/V : ruleAmp).
        const rules = equippedRules(s.characters)
        const loi = cmodsTick.loiAmplifiee
        const amp = ruleAmp(cmodsTick.ruleAmpTier)
        // règles économiques : 🫅 Mécène (or+/XP−), 🎓 Bourse (XP+/or−), 🎉 Saturnales
        // (dimanche réel), 👑 Hubris (pacte : récompenses de farm +).
        const dimanche = rules.has('saturnales') && new Date().getDay() === 0 ? 1 + 0.15 * amp : 1
        const hubris = 1 + (pact?.rewardBonus ?? 0)
        // 🍯 Élixir de fortune + 🜍 Pierre philosophale (relique de compte).
        const philo = s.philosophale ? PHILOSOPHALE_MULT : 1
        const goldRuleMult = (rules.has('mecene') ? 1 + 0.25 * amp : 1) * (rules.has('bourse') ? 0.9 : 1) * dimanche * hubris * buffs.goldMult * philo
        const xpRuleMult = (rules.has('bourse') ? 1 + 0.25 * amp : 1) * (rules.has('mecene') ? 0.9 : 1) * dimanche * hubris
        // Le combat CLASSIQUE n'est plus qu'un filet d'or/butin : la vraie source = donjons & raids.
        const goldGain = Math.round(enemy.xp * CLASSIC_GOLD_MULT * eco.goldGain * surgeMult * goldRuleMult)
        const xpGain = Math.round(enemy.xp * eco.xpGain * CLASSIC_XP_MULT * surgeMult * xpRuleMult)
        gold += goldGain

        {
          const r = grantTeamXp(chars, xpGain)
          chars = r.chars
          if (r.leveled) log = pushLog(log, `⬆ Niveau de compte ${chars[0].level} !`, 'level')
        }
        log = pushLog(log, `${s.enemy.name} vaincu ! +${xpGain} XP, +${goldGain} or.`, 'kill')

        // les ressources rares (Noyaux 💠, Orbes 🔮, Poussière 🌌) ne tombent PAS sur les
        // boss/élites de farm — elles se farment en DONJON dédié (mono-ressource). Le farm classique
        // reste une source de stuff, d'XP et d'un filet d'or.
        const elite = enemy.elite === true
        const champion = enemy.champion === true
        if (champion) log = pushLog(log, '✦ CHAMPION vaincu : butin exceptionnel !', 'kill')
        else if (elite) log = pushLog(log, '◆ Élite vaincue : butin supérieur !', 'kill')
        // Rune du Karma : la malchance s'accumule en chance (+1 cran de rareté / 40 kills sans Épique+, /25 en Législateur).
        const karmaBonus = rules.has('karma') ? Math.min(8, Math.floor(s.killsSinceEpic / (loi ? 25 : 40))) : 0
        // Rune de Transmutation brute : les monstres NORMAUX ne droppent plus d'objets.
        const transmut = rules.has('transmutation')
        // Moins d'objets en combat classique (le farm de stuff se fait en donjon/raid).
        // ONBOARDING : en tout début (vague < 15), CHAQUE kill normal droppe (au lieu de 30%)
        // → un perso nu se gear vite (couplé à l'auto-équip) et survit, au lieu d'enchaîner des kills
        // à vide et de mourir nu.
        const onboardDrop = s.bestStage < 15
        let drops = transmut && !boss && !elite
          ? 0
          : (boss ? 2 : (onboardDrop || Math.random() < 0.30 + eco.lootChance) ? 1 : 0) + (elite ? 1 : 0) + (champion ? 1 : 0)
        // 🔍 Monomanie : 2× moins d'objets… mais de meilleure facture (shift plus bas).
        if (rules.has('monomanie') && drops > 0) drops = Math.random() < 0.5 ? drops : 0
        // 🦷 Loi du talion : les élites/boss lâchent parfois leur butin DEUX fois.
        if ((elite || boss) && rules.has('talion') && Math.random() < 0.12 * amp) {
          drops *= 2
          log = pushLog(log, '🦷 Loi du talion : le butin tombe DEUX fois !', 'loot')
        }
        const bias = pickBias(chars)
        // FENÊTRE de rareté du farm (≤ Légendaire). Élite/champion/boss + karma/chance
        // décalent la fenêtre — toujours sous le plafond (la chasse est en donjon/raid).
        const shift = (boss ? 1 : 0) + (elite ? 1 : 0) + (champion ? 2 : 0)
          + Math.min(2, Math.floor(eco.rarityLuck)) + Math.min(2, karmaBonus)
          + (rules.has('monomanie') ? (amp >= 1.25 ? 2 : 1) : 0)
        // 🕳️ Tisse-châsse : les drops ont une chance accrue de porter une châsse.
        const socketLuck = rules.has('tisseChasse') ? 0.15 * amp : 0
        let codex = s.codex
        let essences = s.essences
        let autoRec = 0
        let killsSinceEpic = s.killsSinceEpic + 1
        // Recyclage auto « inutile » : on précalcule UNE fois le DPS/survie de base de l'équipe
        // (l'équipement ne change pas pendant la rafale de drops) pour ne pas recompter par objet.
        const baseStats = s.autoRecycleUseless ? partyBaseStats(chars) : null
        for (let dd = 0; dd < drops; dd++) {
          // Identité de loot du biome : ~50% dégâts de l'élément, ~25% résistance à l'élément, ~25% neutre.
          const br = Math.random()
          const biomeOpts = br < 0.5 ? { forceDmgType: s.activeBiome } : br < 0.75 ? { biasResist: s.activeBiome } : {}
          const it = generateItem({ ilvl: stageIlvl(stage), rarity: rollFarmRarity(stage, shift), primaryBias: bias, socketLuck, ...biomeOpts })
          // Rune du Karma : un drop Épique+ remet le compteur de pitié à zéro.
          if (RARITIES[it.rarity].tier >= 5) killsSinceEpic = 0
          // Recyclage automatique au drop — MÊME protection que le recyclage de masse (`bulkProtected` :
          // verrou joueur + uniques Cosmique+). Deux critères CUMULABLES :
          //  • seuil de rareté : la rareté est strictement sous le seuil choisi ;
          //  • « inutile » : l'objet n'améliore NI le DPS NI la survie d'aucun héros recruté.
          // Les uniques sous le seuil/inutiles sont recyclés (essences créditées, Codex préservé), comme
          // un drop suivi d'un recyclage de masse.
          const tierRecycle = s.autoRecycle && RARITIES[it.rarity].tier < s.recycleThreshold
          const uselessRecycle = baseStats !== null && !itemUsefulForAnyChar(chars, baseStats, it)
          if (!bulkProtected(it) && (tierRecycle || uselessRecycle)) {
            essence += Math.round(recycleValue(it) * eco.eclatGain)
            poussiere += recyclePoussiere(it)
            if (it.unique) {
              codex = discoverFromItems(codex, [it])
              const eg = essenceGain(RARITIES[it.rarity].tier, it.unique.rank) * (cmodsTick.distillateur ? 2 : 1)
              essences = { ...essences, [it.unique.id]: (essences[it.unique.id] ?? 0) + eg }
            }
            autoRec++
            continue
          }
          inventory = capPrepend(inventory, it, invMax)
          if (it.unique) codex = discoverFromItems(codex, [it])
          log = pushLog(log, `Butin : ${it.name}`, 'loot')
        }
        if (autoRec) log = pushLog(log, `♻️ ${autoRec} butin recyclé automatiquement.`, 'craft')
        // auto-équip des slots VIDES (onboarding) sur le perso ACTIF : un perso nu se gear
        // tout seul depuis ses drops (les emplacements déjà remplis ne bougent pas).
        {
          const ai = s.activeChar ?? 0
          if (chars[ai]) {
            const ae = autoEquipEmpties(chars[ai], inventory)
            if (ae.equipped > 0) {
              chars = chars.map((c, i) => (i === ai ? ae.char : c))
              inventory = ae.inventory
              log = pushLog(log, `🎒 ${ae.equipped} objet${ae.equipped > 1 ? 's' : ''} équipé${ae.equipped > 1 ? 's' : ''} (emplacement vide).`, 'loot')
            }
          }
        }

        // Bonus de métier sur les drops (Condensation de l'Alchimiste, Prospection du Joaillier).
        const cmods = cmodsTick
        // Transmutation brute : ×2 sur quintessences/gemmes/poussière (×3 en ◈ Législateur).
        const transmutMult = transmut ? (loi ? 3 : 2) : 1

        // Quintessence élémentaire : ressource ultra-rare du biome (type = celui des monstres).
        // 1% sur un ennemi normal, 5% sur une élite, 10% sur un boss. Farm continu et patient.
        let quint = s.quint
        {
          const qBase = boss ? QUINT_DROP.boss : elite ? QUINT_DROP.elite : QUINT_DROP.normal
          // 🪨 Quartzite : les quintessences du biome coulent plus volontiers.
          const quartz = rules.has('quartzite') ? 1 + 0.4 * amp : 1
          const qChance = qBase * quintTierMult(stage) * (surged ? SURGE_QUINT_MULT : 1) * transmutMult * cmods.quintDropMult * quartz * philo
          if (Math.random() < qChance) {
            const t = s.activeBiome
            quint = { ...quint, [t]: (quint[t] ?? 0) + 1 }
            log = pushLog(log, `${DAMAGE_TYPES[t].icon} Quintessence de ${DAMAGE_TYPES[t].name} récoltée ! (ultra-rare)`, 'loot')
          }
        }

        // 🔹 Poussière de gemme : matière première du Joaillier (taille & recoupe).
        let gems = s.gems
        let gemDust = s.gemDust
        let gemsSeen = s.gemsSeen
        {
          const rank2 = boss ? 'boss' : elite ? 'elite' : 'normal'
          // ⛏️ Veine mère + ⛏️ Prospecteur : les poussières coulent plus souvent/fort.
          const prospecteur = rules.has('prospecteur')
          const dustC = GEM_DUST_DROP.chance[rank2] * transmutMult * cmods.gemDropMult * (1 + (cond.veineMerePct ?? 0)) * philo
          if (Math.random() < dustC) {
            const amt = GEM_DUST_DROP.amount[rank2] * (prospecteur ? 2 : 1)
            gemDust += amt
            log = pushLog(log, `🔹 +${amt} poussière de gemme.`, 'loot')
          }
          // Gemme de CONDITION : drop par FAMILLE selon le biome (Feu/Foudre → Rythme,
          // Ombre/Nature → Flux, Arcane/Froid → Environnement, Physique → Bastion).
          // drops volontairement bas — le drop est un événement, la TAILLE/FUSION compensent.
          const gemC = COND_GEM_DROP[rank2] * transmutMult * cmods.gemDropMult * (prospecteur ? 0.5 : 1) * philo
          if (Math.random() < gemC) {
            const cg = rollCondGem(BIOME_GEM_FAMILY[s.activeBiome])
            // 🧿 Collectionneur : la gemme peut tomber directement au rang 2.
            const dropRank = rules.has('collectionneur') && Math.random() < 0.2 * amp ? Math.min(2, gemMaxRank(cg)) : 1
            const k = condGemKey(cg.id, dropRank)
            // 🥅 Tamis : les doublons sont auto-broyés à +20% de poussière.
            if (cmods.tamis && (gems[k] ?? 0) >= 1) {
              const dust = Math.round(grindDust(dropRank) * 1.2 * cmods.grindMult)
              gemDust += dust
              log = pushLog(log, `🥅 Tamis : ${cg.name} en doublon, auto-broyée (+${dust} 🔹).`, 'loot')
            } else {
              gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
              if (!gemsSeen.includes(cg.id)) gemsSeen = [...gemsSeen, cg.id]
              log = pushLog(log, `${cg.icon} GEMME : ${cg.name}${dropRank > 1 ? ` (rang ${dropRank})` : ''} (${cg.family}) — drop de biome !`, 'loot')
            }
          }
        }

        // 🌿 RÉACTIF de biome (Officine) : l'herbe du coin, pour les cuves de l'Alchimiste.
        let reagents = s.reagents
        {
          const rank2 = boss ? 'boss' : elite ? 'elite' : 'normal'
          const rChance = REAGENT_DROP[rank2 as 'normal' | 'elite' | 'boss'] * cmods.herboristeMult * philo
          if (Math.random() < rChance) {
            const t = s.activeBiome
            reagents = { ...reagents, [t]: (reagents[t] ?? 0) + 1 }
            log = pushLog(log, `${REAGENTS[t].icon} Réactif : ${REAGENTS[t].name}.`, 'loot')
          }
        }

        // Gemme de CONDITION : les champions ✦ en lâchent parfois (8%, toutes familles,
        // 👃 Nez du lapidaire : toujours rang 2 minimum).
        if (champion && Math.random() < CHAMPION_GEM_DROP * cmods.gemDropMult) {
          const cg = rollCondGem()
          const rank = cmods.nezLapidaire ? Math.min(gemMaxRank(cg), 2) : 1
          const k = condGemKey(cg.id, rank)
          gems = { ...gems, [k]: (gems[k] ?? 0) + 1 }
          if (!gemsSeen.includes(cg.id)) gemsSeen = [...gemsSeen, cg.id]
          log = pushLog(log, `${cg.icon} GEMME DE CONDITION : ${cg.name}${rank > 1 ? ` (rang ${rank})` : ''} ! (champion)`, 'loot')
        }

        // 🏆 Fragment de Conquête : boss/élite vaincu → la plus longue recharge de chacun tombe à zéro.
        if (cond.conquete && (boss || elite)) {
          resetLongestCooldown(chars)
          if (boss) log = pushLog(log, '🏆 Fragment de Conquête : recharges réinitialisées !', 'info')
        }

        // Le verrou de farm fige la progression. GATE DE RAID : franchir le mur d'un vrai
        // Chapitre (5→14) exige le Raid T(c−4) ; tant qu'il n'est pas vaincu, on reste au mur (Prologue
        // 1-5 et Chapitre++ ≥ 16 libres). Le mur reste farmable, mais n'avance plus.
        const gateTier = raidGateForStage(stage)
        const gateLocked = gateTier > 0 && bestRaidTier(s.raidProgress) < gateTier
        let characters = chars
        let biomeBest = s.biomeBest
        let conseil = s.conseil
        let maitrisePoints = s.maitrisePoints
        if (!s.farmLock && !gateLocked) {
          stage += 1
          biomeBest = { ...biomeBest, [s.activeBiome]: Math.max(biomeBest[s.activeBiome] ?? 0, stage) }
          bestStage = Math.max(bestStage, stage)
          // (plus de Sceau toutes les 5 vagues — l'Antre des Failles est LA source de Sceaux,
          //  sinon le donjon ne sert à rien. Appoints payants : forge de Sceau, Trousseau du Pilleur.)
          // 🏛️ Conseil : chaque vague gagnée avance le contrat Conquérant.
          {
            const cp = conseilProgress({ conseil, maitrisePoints }, log, 'paliers')
            conseil = cp.conseil
            maitrisePoints = cp.maitrisePoints
            log = cp.log
          }
          // Déblocage des personnages.
          if (bestStage >= CHAR2_STAGE && characters.length < 2) {
            characters = [...characters, makeCharacter(RECRUE_NAMES[0], highestLevel(characters), 'agilite')]
            log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[0]} rejoint ton équipe !`, 'level')
          }
          if (bestStage >= CHAR3_STAGE && characters.length < 3) {
            characters = [...characters, makeCharacter(RECRUE_NAMES[1], highestLevel(characters), 'intelligence')]
            log = pushLog(log, `🧑‍🤝‍🧑 ${RECRUE_NAMES[1]} rejoint ton équipe !`, 'level')
          }
        }

        // chaque VAGUE de farm démarre FRAÎCHE : PV pleins, bouclier purgé et recharges
        // remises à zéro (comme l'« entrée fraîche » en donjon). Le farm n'est plus une épreuve
        // d'attrition entre vagues ; les boucliers de départ (Réservoir/Doctrine, Égide) se
        // réarment au 1er tick face au nouvel ennemi via gemFightStart.
        characters = characters.map(fullHeal)
        resetAllCooldowns(characters)

        // L'échoppe ne se renouvelle plus au boss : rotation horaire gérée dans `tick`.
        // 🍖 Appât à champions : les ✦ rôdent plus souvent.
        const enemyNext = makeEnemy(stage, s.activeBiome, rules.has('appat') ? 1 + 0.35 * amp : 1)
        // 🌠 Étoile d'Overkill : l'excédent du coup fatal entame l'ennemi suivant.
        if (res.overkill > 0) enemyNext.hp = Math.max(1, enemyNext.maxHp - res.overkill)
        if (isBossStage(stage)) log = pushLog(log, `⚔ Un boss vous barre la route : ${enemyNext.name} !`, 'info')

        const next = { ...s, characters, stage, bestStage, biomeBest, conseil, maitrisePoints, gold, sceaux, poussiere, quint, gems, gemDust, gemsSeen, reagents, essence, essences, codex, inventory, killsSinceEpic, enemy: enemyNext, log, killCount: s.killCount + 1, totalKills: s.totalKills + 1 }
        persistThrottled(next)
        set(next)
        return
      }

      set({ ...s, characters: chars, enemy, log })
    },
  }
}
