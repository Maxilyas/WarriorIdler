/**
 * SLICE « monde » — actions de progression/zone/réglages & cycle hors-ligne (extraites de store.ts).
 * setStage/setBiome/lockBiome/rotateBiomeIfDue, toggles farm/recyclage, claimOffline, markAway/resumeAway.
 *   → Pattern : `create<Domaine>Slice(set, get)` renvoie un Pick<GameState, …> ; le store le spread dans
 *     son `return`. Aucun import runtime du store (types seulement) → pas de cycle.
 */
import { achievementBonuses } from './achievements'
import { constellationMods } from './prestige'
import { makeEnemy } from './enemies'
import { BIOME_IDS, biomeUnlocked, getBiomeDef, BIOME_LOCK_MS, BIOME_LOCK_FRAGMENTS } from './biomes'
import { RARITIES, RARITY_LIST } from './rarities'
import { persist } from './save'
import { resetAllCooldowns } from './combatEngine'
import { DAMAGE_TYPES } from './damage'
import { offlineMessage, INBOX_CAP } from './inbox'
import { simulateOffline } from './offline'
import { addQuint, fullHeal, grantTeamXp, invMax, pushLog, getAwaySince, setAwaySince } from './storeHelpers'
import type { GameSet, GameGet } from './sliceTypes'
import type { GameState } from './store'

export function createWorldSlice(set: GameSet, get: GameGet): Pick<GameState,
  | 'setStage' | 'setBiome' | 'lockBiome' | 'rotateBiomeIfDue' | 'toggleFarmLock'
  | 'setRecycleThreshold' | 'toggleAutoRecycle' | 'toggleAutoRecycleUseless' | 'claimOffline' | 'markAway' | 'resumeAway'
> {
  return {
    setStage: (n) => {
      const s = get()
      if (s.dungeon || s.raid) return
      // On ne peut farmer que jusqu'à son RECORD DANS LE BIOME ACTIF.
      const cap = Math.max(1, s.biomeBest[s.activeBiome] ?? 1)
      const stage = Math.max(1, Math.min(cap, Math.round(n)))
      // v0.40.2 — chaque vague démarre FRAÎCHE (cf. passage de vague par kill) : changer manuellement
      // de vague soigne l'équipe à fond + RAZ les recharges (sinon la barre de vie restait à son niveau).
      const characters = s.characters.map(fullHeal)
      resetAllCooldowns(characters)
      const next = { ...s, characters, stage, enemy: makeEnemy(stage, s.activeBiome) }
      persist(next)
      set(next)
    },

    setBiome: (biome) => {
      const s = get()
      if (s.dungeon || s.raid) return
      if (!BIOME_IDS.includes(biome) || biome === s.activeBiome) return
      if (!biomeUnlocked(biome, s.bestStage, s.bestStage)) return
      // v0.35 — progression GLOBALE : changer de biome GARDE ton Palier (le biome n'est qu'un CANAL
      // d'élément/résistance, pas un monde séparé). Une seule zone, un seul Palier.
      const stage = s.stage
      const characters = s.characters.map(fullHeal) // v0.40.2 — entrée fraîche (PV pleins + recharges RAZ)
      resetAllCooldowns(characters)
      const next = {
        ...s, activeBiome: biome, characters,
        enemy: makeEnemy(stage, biome),
        log: pushLog(s.log, `🧭 Zone : ${getBiomeDef(biome).icon} ${getBiomeDef(biome).name} (élément ${DAMAGE_TYPES[biome].name}).`, 'info'),
      }
      persist(next)
      set(next)
    },

    // v0.28 — FORCE un biome contre des Fragments : il reste actif ~1 h, puis la rotation reprend.
    lockBiome: (biome) => {
      const s = get()
      if (s.dungeon || s.raid) return
      if (!BIOME_IDS.includes(biome)) return
      if (!biomeUnlocked(biome, s.biomeBest.physique ?? 0, s.bestStage)) return
      if (s.fragments < BIOME_LOCK_FRAGMENTS) return
      const biomeStages = { ...s.biomeStages, [s.activeBiome]: s.stage }
      const stage = Math.max(1, biomeStages[biome] ?? 1)
      const until = Date.now() + BIOME_LOCK_MS
      const characters = s.characters.map(fullHeal) // v0.40.2 — entrée fraîche (PV pleins + recharges RAZ)
      resetAllCooldowns(characters)
      const next = {
        ...s,
        fragments: s.fragments - BIOME_LOCK_FRAGMENTS,
        activeBiome: biome, biomeStages, stage, characters,
        biomeLockUntil: until,
        nextRotateAt: until, // à la fin du forçage, la rotation aléatoire reprend aussitôt
        enemy: makeEnemy(stage, biome),
        log: pushLog(s.log, `🔒 Biome forcé : ${getBiomeDef(biome).icon} ${getBiomeDef(biome).name} (~${Math.round(BIOME_LOCK_MS / 60000)} min · -${BIOME_LOCK_FRAGMENTS} ✨).`, 'info'),
      }
      persist(next)
      set(next)
    },

    // v0.35 — la ROTATION HORAIRE FORCÉE est DÉSACTIVÉE : le biome est un CHOIX du joueur (l'axe
    // élément/résistance du modèle à mur unique — on prépare le biome que le mur exige). On change de
    // zone via setBiome, jamais subi. (Lot 4 : progression de Palier GLOBALE au lieu de par-biome.)
    rotateBiomeIfDue: () => {
      /* no-op : plus de rotation automatique. */
    },

    toggleFarmLock: () => {
      const s = get()
      const next = { ...s, farmLock: !s.farmLock }
      persist(next)
      set(next)
    },

    setRecycleThreshold: (tier) => {
      const s = get()
      const next = { ...s, recycleThreshold: Math.max(2, Math.min(16, Math.round(tier))) }
      persist(next)
      set(next)
    },

    toggleAutoRecycle: () => {
      const s = get()
      const next = { ...s, autoRecycle: !s.autoRecycle, log: pushLog(s.log, `Recyclage auto ${s.autoRecycle ? 'désactivé' : 'activé'} (sous ${RARITIES[RARITY_LIST.find((r) => r.tier === s.recycleThreshold)?.id ?? 'rare'].name}).`, 'info') }
      persist(next)
      set(next)
    },

    toggleAutoRecycleUseless: () => {
      const s = get()
      const next = { ...s, autoRecycleUseless: !s.autoRecycleUseless, log: pushLog(s.log, `Recyclage auto du butin inutile ${s.autoRecycleUseless ? 'désactivé' : 'activé'} (ni DPS ni survie pour aucun héros).`, 'info') }
      persist(next)
      set(next)
    },

    claimOffline: () => {
      set({ ...get(), pendingOffline: null })
    },

    // v0.27 (F3) — l'appli passe en arrière-plan : on horodate + persiste (couvre aussi la fermeture
    // dure, où le cold-start recalculera depuis lastSeen).
    markAway: () => {
      setAwaySince(Date.now())
      persist(get())
    },
    // v0.27 (F3) — retour au premier plan : crédite les gains hors-ligne du temps en arrière-plan
    // (même logique que le cold-start : applique les gains À L'ÉTAT + récap pendingOffline).
    resumeAway: () => {
      const s = get()
      if (!getAwaySince()) return
      const elapsed = Date.now() - getAwaySince()
      setAwaySince(0)
      if (elapsed < 60_000) return // sous 1 min : pas de récap (awaySince déjà consommé → pas de double-crédit)
      const report = simulateOffline(s.characters, s.stage, s.upgrades, elapsed, s.activeBiome, s.maitrise, achievementBonuses(s.achievements))
      if (!report) return
      const offMult = constellationMods(s.constellation).offlineMult
      if (offMult !== 1) { report.gold = Math.round(report.gold * offMult); report.noyau = Math.round(report.noyau * offMult); report.xp = Math.round(report.xp * offMult) }
      const next = { ...s }
      next.gold += report.gold
      next.noyau += report.noyau
      next.sceaux += report.sceaux
      if (report.quint) next.quint = addQuint(next.quint, { [report.quint.type]: report.quint.amount })
      next.characters = grantTeamXp(next.characters, report.xp).chars
      for (const it of report.items) next.inventory = [it, ...next.inventory].slice(0, invMax)
      // v0.31.3 — récap dans la ✉ inbox (message « non lu ») au lieu du modal plein écran.
      next.inbox = [offlineMessage(report, Date.now()), ...next.inbox].slice(0, INBOX_CAP)
      persist(next)
      set(next)
    },
  }
}
