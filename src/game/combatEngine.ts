/**
 * MOTEUR DE COMBAT — la résolution d'un pas de combat, extraite de `store.ts`.
 *
 * Tient l'ÉTAT TRANSITOIRE de combat (cooldowns, file de lancement manuel, compteurs de gemmes,
 * accumulateurs de runes/pactes, stacks d'archétypes…) — NON persisté, comme avant — et expose les
 * pas de combat purs : `partyCombatStep` (1 ennemi) et `partyCombatStepMulti` (donjons/raids).
 *
 * Le moteur ne touche PAS au `GameState` ni au journal : il reçoit ses entrées via `CombatMods`
 * (calculés par le store) et renvoie des données ; le store orchestre (loot/XP/log/persist).
 *   → Doc : docs/systemes/01-combat-et-degats.md
 *
 * Architecture : `store.ts → combatEngine.ts` à sens unique côté valeurs ; le moteur importe le type
 * `CombatMods` de `store.ts` en `import type` (érasé → aucun cycle runtime).
 */
import type { Character, Enemy, DamageType, PowerDef, EnemyAbility } from './types'
import { rollHit, incomingDps, theoreticalDps, spellResistMult } from './combat'
import { resistMult, enemyReq, resistSurplus, RESIST_DSCALE } from './resist'
import type { DerivedStats } from './stats'
import {
  charDerived, charMaxHp, charDamageProfile, charPassives, charResist, charCombatMods,
  abilityPower, powerScale, charDeck, type CombatMods as CharCombatMods,
} from './character'
import { getPower } from './powers'
import { spellTypeMult, spellElementTypes, DAMAGE_TYPE_LIST, type DamageProfile } from './damage'
import { acharneMult, nueeMult, type CondMods } from './condGems'
import { type TimeRuneMods, type PactMods } from './enchants'
import type { CombatMods } from './store'

// ---- État & constantes globaux de combat (déplacés de store.ts) ----
let regenMult = 1 // ajusté par l'amélioration "Régénération"
const REGEN_RATE = 0 // v0.38 — plus de DRIP passif en combat (soin = sorts/vol de vie/barrière). Voir choix design.
const HEALCUT_REGEN_MULT = 0.25 // régén pendant le heal-cut (×0.25 : les soins ne suivent plus)
const FARM_REZ_DELAY = 20
const CC_INTERVAL = 8
/** Réglé par le store (refreshGlobals) — multiplicateur de régénération de compte. */
export function setRegenMult(v: number) { regenMult = v }

// Cooldowns transitoires des capacités actives (clé `charId:powerId`). Non persistés.
const cooldowns = new Map<string, number>()
// Demandes de lancement MANUEL en attente (clé `charId:powerId`) : posées par castPower, consommées au tick.
const manualFire = new Set<string>()

/** Recharges courantes des capacités d'un perso (pour l'UI : 0 = prête). */
export function powerCooldowns(char: Character): Record<string, number> {
  const out: Record<string, number> = {}
  for (const pid of charDeck(char)) if (pid) out[pid] = Math.max(0, cooldowns.get(`${char.id}:${pid}`) ?? 0)
  return out
}

/** 🏆 Fragment de Conquête : remet à zéro la PLUS LONGUE recharge de chaque héros. */
export function resetLongestCooldown(chars: Character[]) {
  for (const c of chars) {
    let bestKey = ''
    let best = 0
    for (const pid of charDeck(c)) {
      if (!pid) continue
      const k = `${c.id}:${pid}`
      const cd = cooldowns.get(k) ?? 0
      if (cd > best) { best = cd; bestKey = k }
    }
    if (bestKey) cooldowns.set(bestKey, 0)
  }
}

/** Drapeaux des gemmes de condition pour le pas de combat. */
// État transitoire des gemmes de condition (compteurs de rythme). Non persisté, comme les cooldowns.
// Clés : `metronome:<charId>` (attaques), `echo` (sorts d'équipe), `crescendo` (kills d'équipe).
const gemCounters = new Map<string, number>()

// Runes de TEMPS : accumulateur de la Boucle (s) + prochain Sursis par héros (epoch ms).
let boucleAcc = 0
const sursisReadyAt = new Map<string, number>()

// ---- v0.24 : état transitoire des nouveaux archétypes (non persisté, comme les cooldowns) ----

// ÉGIDE « Aegis adaptatif » : stacks de résist par héros et par type (20 s glissantes).
const adaptiveStacks = new Map<string, Partial<Record<DamageType, { pts: number; remaining: number }>>>()
function adaptiveAdd(charId: string, type: DamageType, gain: number, cap: number) {
  const m = adaptiveStacks.get(charId) ?? {}
  const cur = m[type]
  m[type] = { pts: Math.min(cap, (cur?.pts ?? 0) + gain), remaining: 20 }
  adaptiveStacks.set(charId, m)
}
function adaptiveFor(charId: string): Partial<Record<DamageType, number>> {
  const m = adaptiveStacks.get(charId)
  if (!m) return {}
  const out: Partial<Record<DamageType, number>> = {}
  for (const t in m) {
    const e = m[t as DamageType]
    if (e && e.remaining > 0 && e.pts > 0) out[t as DamageType] = e.pts
  }
  return out
}
function adaptiveTick(dt: number) {
  for (const m of adaptiveStacks.values()) {
    for (const t in m) {
      const e = m[t as DamageType]
      if (e) e.remaining -= dt
    }
  }
}

// PURGATEUR « Combustion purificatrice » : altérations subies → carburant de dégâts (par héros).
function fuelAdd(charId: string) {
  gemCounters.set(`fuel:${charId}`, (gemCounters.get(`fuel:${charId}`) ?? 0) + 1)
}
function fuelMult(charId: string, fuel?: { per: number; cap: number }): number {
  if (!fuel) return 1
  return 1 + Math.min(fuel.cap, (gemCounters.get(`fuel:${charId}`) ?? 0) * fuel.per)
}
/** Remise à zéro du carburant (wipe / fin d'instance — comme le Crescendo). */
export function fuelReset() {
  for (const k of [...gemCounters.keys()]) if (k.startsWith('fuel:')) gemCounters.delete(k)
}

/**
 * ÉGIDE : enrichit les résistances effectives de l'équipe — « Égide partagée » (l'aura du
 * meilleur porteur profite aux ALLIÉS) + « Aegis adaptatif » (stacks du héros). Mute info[].
 */
function enrichResists(
  chars: Character[],
  info: ({ resist: Partial<Record<DamageType, number>>; cmods: CharCombatMods } | null)[],
) {
  // Aura : pour chaque type, la meilleure part partagée (et son porteur, exclu de sa propre aura).
  const aura: Partial<Record<DamageType, { v: number; owner: number }>> = {}
  chars.forEach((_, i) => {
    const d = info[i]
    if (!d || d.cmods.shareResist <= 0) return
    for (const t in d.resist) {
      const type = t as DamageType
      const v = (d.resist[type] ?? 0) * d.cmods.shareResist
      if (v > (aura[type]?.v ?? 0)) aura[type] = { v, owner: i }
    }
  })
  const hasAura = Object.keys(aura).length > 0
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const adaptive = d.cmods.adaptiveResist ? adaptiveFor(c.id) : null
    if (!hasAura && !adaptive) return
    const merged: Partial<Record<DamageType, number>> = { ...d.resist }
    if (hasAura) {
      for (const t in aura) {
        const type = t as DamageType
        const a = aura[type]
        if (a && a.owner !== i) merged[type] = (merged[type] ?? 0) + a.v
      }
    }
    if (adaptive) {
      for (const t in adaptive) {
        const type = t as DamageType
        merged[type] = (merged[type] ?? 0) + (adaptive[type] ?? 0)
      }
    }
    d.resist = merged
  })
}

/** 🔁 Boucle temporelle : remet à zéro TOUTES les recharges des héros donnés. */
export function resetAllCooldowns(chars: Character[]) {
  for (const c of chars) for (const pid of charDeck(c)) if (pid) cooldowns.set(`${c.id}:${pid}`, 0)
}

/** 🕊️ Sursis : si un héros vient de tomber et que sa rune est prête, il survit à 25% PV. */
function applySursis(chars: Character[], sursisCd?: number): string[] {
  if (!sursisCd) return []
  const revived: string[] = []
  const now = Date.now()
  for (const c of chars) {
    if (c.hp > 0) continue
    if ((sursisReadyAt.get(c.id) ?? 0) > now) continue
    c.hp = charMaxHp(c) * 0.25
    sursisReadyAt.set(c.id, now + sursisCd * 1000)
    revived.push(c.name)
  }
  return revived
}

/** Bonus du Crescendo : +1% de dégâts par kill, capé — remis à zéro quand l'équipe tombe. */
export function crescendoBonus(cap?: number): number {
  return cap ? Math.min(cap, 0.01 * (gemCounters.get('crescendo') ?? 0)) : 0
}
export function crescendoAdd(kills: number) {
  gemCounters.set('crescendo', (gemCounters.get('crescendo') ?? 0) + kills)
}
export function crescendoReset() {
  gemCounters.delete('crescendo')
  fuelReset() // 🜍 Purgateur : le carburant d'affliction retombe quand l'équipe tombe
  mementoOn = false // 💀 Memento mori : le run s'achève, la rage retombe
}

/** Trésorerie de guerre : chaque kill blinde un bouclier (2% PV max, cumul capé). */
export function tresorerieShield(chars: Character[], cap?: number) {
  if (!cap) return
  for (const c of chars) {
    if (c.hp <= 0) continue
    const mh = charMaxHp(c)
    const capV = cap * mh
    if ((c.absorb ?? 0) < capV) c.absorb = Math.min(capV, (c.absorb ?? 0) + 0.02 * mh)
  }
}

/* ================================================================== */
/* v0.26 — état transitoire & helpers des 40 nouvelles gemmes          */
/* (non persisté, comme les cooldowns — voir condGems.ts pour le pool) */
/* ================================================================== */

// Fenêtres d'ÉQUIPE (secondes restantes, décrémentées au pas de combat).
let fievreLeft = 0        // 🦷 Fièvre de l'hallali : vol de vie dopé après un kill
let testamentLeft = 0     // 📜 Testament : +10% de dégâts après une mort
let marcheCount = 0       // 🎺 Marche triomphale : combats gagnés sans mort
let ancrageBroken = false // ⚓ Ancrage : un héros est tombé dans le combat courant
let carillonReady = false // 🛎️ Carillon : la prochaine recharge est à moitié prix
// v0.26 — runes de TEMPS & pactes (transitoire, non persisté).
let hateFunebreLeft = 0   // 🪽 Hâte funèbre : fenêtre de vitesse après un kill
let echoTempAcc = 0       // 🌀 Écho temporel : horloge des 30 s
let lastCastGlobal: { charId: string; pid: string } | null = null // dernière capacité lancée (équipe)
let mementoOn = false     // 💀 Memento mori : un héros est tombé pendant ce run
const rembUsed = new Set<string>() // ⏪ Rembobinage : héros déjà servis CE combat
// Par héros (clé charId).
const verreTimer = new Map<string, number>()    // 🪟 Verre trempé : s sans subir de coup
const carapaceCdMap = new Map<string, number>() // 🐢 Carapace réactive : recharge (s)
const shieldCdMap = new Map<string, number>()   // 🛡 Mur de boucliers (Rempart) : recharge interne (s)
const riposteAcc = new Map<string, number>()    // 🤺 Riposte mesurée : s sous le feu
const echangeurAcc = new Map<string, number>()  // 🔃 Échangeur : fraction de PV subis accumulée
const egideLeft = new Map<string, number>()     // 🛡️ Égide : coups encore couverts CE combat
const hotPool = new Map<string, number>()       // 💧 Goutte-à-goutte : réserve de soin différé

/** 🎺 Bonus de la Marche triomphale (+0,5%/combat gagné sans mort, capé). */
function marcheBonus(cap?: number): number {
  return cap ? Math.min(cap, 0.005 * marcheCount) : 0
}

/** v0.26 : réactions d'équipe aux KILLS (🔔 Glas, 🦷 Fièvre, 🎺 Marche, 🪽 Hâte funèbre,
 *  🍽️ Jeûne). À appeler aux mêmes endroits que crescendoAdd — `wins` = combats gagnés. */
export function gemKillEvents(
  chars: Character[],
  cond: CondMods | undefined,
  kills: number,
  wins: number,
  runes?: TimeRuneMods,
  pact?: PactMods,
) {
  if (kills <= 0) return
  if (cond?.fievreLeech) fievreLeft = 5
  if (cond?.marcheCap) marcheCount += wins
  if (runes?.hateFunebre) hateFunebreLeft = 4
  // 🍽️ Pacte du Jeûne : seul soin restant — chaque kill nourrit l'équipe.
  if (pact?.killHeal) {
    for (const c of chars) {
      if (c.hp <= 0) continue
      c.hp = Math.min(charMaxHp(c), c.hp + charMaxHp(c) * pact.killHeal * kills)
    }
  }
  if (cond?.glasN) {
    const n = (gemCounters.get('glas') ?? 0) + kills
    const triggers = Math.floor(n / cond.glasN)
    gemCounters.set('glas', n - triggers * cond.glasN)
    if (triggers > 0 && !pact?.noHeal) {
      for (const c of chars) {
        if (c.hp <= 0) continue
        c.hp = Math.min(charMaxHp(c), c.hp + charMaxHp(c) * 0.05 * triggers)
      }
    }
  }
}

/** v0.26 : début de combat côté RUNES — 🔓 Ouverture (plus longue capacité prête),
 *  🎒 Préparation (recharges avancées), ⏪ Rembobinage réarmé. */
function runeFightStart(chars: Character[], runes?: TimeRuneMods) {
  rembUsed.clear()
  if (!runes) return
  for (const c of chars) {
    if (c.hp <= 0) continue
    if (runes.ouverture) {
      let bestKey = ''
      let bestCd = 0
      for (const pid of charDeck(c)) {
        if (!pid) continue
        const p = getPower(pid)
        if (!p || p.kind !== 'active') continue
        if ((p.cooldown ?? 0) > bestCd) { bestCd = p.cooldown ?? 0; bestKey = `${c.id}:${pid}` }
      }
      if (bestKey) cooldowns.set(bestKey, 0)
    }
    if (runes.preparationSec) {
      for (const pid of charDeck(c)) {
        if (!pid) continue
        const k = `${c.id}:${pid}`
        cooldowns.set(k, Math.max(0, (cooldowns.get(k) ?? 0) - runes.preparationSec))
      }
    }
  }
}

/** ⏪ Rembobinage : un héros qui passe sous 25% PV récupère X s de recharges (1×/combat). */
function runeRembobinage(chars: Character[], runes?: TimeRuneMods) {
  if (!runes?.rembobinageSec) return
  for (const c of chars) {
    if (c.hp <= 0 || rembUsed.has(c.id)) continue
    if (c.hp / charMaxHp(c) >= 0.25) continue
    rembUsed.add(c.id)
    for (const pid of charDeck(c)) {
      if (!pid) continue
      const k = `${c.id}:${pid}`
      cooldowns.set(k, Math.max(0, (cooldowns.get(k) ?? 0) - runes.rembobinageSec))
    }
  }
}

/** 🪦 Usure + 💀 Memento + 🩸 pacte : multiplicateur offensif d'équipe dépendant du temps. */
function runePactOffense(t: number, runes?: TimeRuneMods, pact?: PactMods): number {
  let m = 1
  if (runes?.usurePer) m *= 1 + runes.usurePer * Math.min(3, Math.floor(t / 10))
  if (pact) m *= pact.dmgOut
  if (mementoOn && pact?.mementoBonus) m *= 1 + pact.mementoBonus
  return m
}

/** v0.26 : début de combat — Égide rechargée, Ancrage réarmé, boucliers de départ
 *  (🫙 Réservoir pressurisé, 🔰 Doctrine du bouclier). Mute les copies de `chars`. */
export function gemFightStart(
  chars: Character[],
  info: ({ derived: DerivedStats } | null)[],
  cond?: CondMods,
) {
  ancrageBroken = false
  for (const c of chars) egideLeft.set(c.id, cond?.egideHits ?? 0)
  if (!cond) return
  if (cond.reservoirPct) {
    for (const c of chars) {
      if (c.hp <= 0) continue
      c.absorb = Math.max(c.absorb ?? 0, cond.reservoirPct * charMaxHp(c))
    }
  }
  if (cond.doctrinePct) {
    // Porteur de bouclier avec la meilleure Barrière → partage une part de ses PV de barrière.
    let hi = -1
    let hiVal = 0
    chars.forEach((c, i) => {
      const d = info[i]
      if (!d || c.hp <= 0 || !c.equipment.armeSecondaire) return
      if (d.derived.shieldPct > hiVal) { hiVal = d.derived.shieldPct; hi = i }
    })
    if (hi >= 0 && hiVal > 0) {
      const share = cond.doctrinePct * charMaxHp(chars[hi]) * (hiVal / (1 + hiVal))
      chars.forEach((c, i) => {
        if (i !== hi && c.hp > 0) c.absorb = Math.max(c.absorb ?? 0, share)
      })
    }
  }
}

/** v0.26 : un héros est-il tombé pendant ce pas ? (⚓ Ancrage, 🎺 Marche, 📜 Testament).
 *  À appeler APRÈS le Sursis (un héros sauvé in extremis n'est pas « tombé »). */
function gemDeathEvents(chars: Character[], aliveBefore: boolean[], cond?: CondMods, pact?: PactMods) {
  let died = false
  chars.forEach((c, i) => { if (aliveBefore[i] && c.hp <= 0) died = true })
  if (!died) return
  ancrageBroken = true
  marcheCount = 0
  if (pact?.mementoBonus) mementoOn = true // 💀 Memento mori : le deuil devient rage (fin du run)
  if (cond?.testamentPct) {
    testamentLeft = 10
    for (const c of chars) {
      if (c.hp <= 0) continue
      const mh = charMaxHp(c)
      c.absorb = Math.min(mh, (c.absorb ?? 0) + cond.testamentPct * mh)
    }
  }
}

/** v0.26 : multiplicateur de dégâts SUBIS des gemmes défensives (🪨 Granit, ⚓ Ancrage,
 *  💫 Sixième sens, 🌂 Paratonnerre, 🧱 Rempart, 🗿 Mémoire de la pierre). Plancher 0,1. */
function gemDefenseMult(
  c: Character,
  mh: number,
  o: { cond?: CondMods; casting?: boolean; surge?: boolean; aliveEnemies?: number; telegraphed?: boolean; tenacity?: number },
): number {
  const cond = o.cond
  if (!cond) return 1
  let m = 1
  if (cond.granitPct && c.hp / mh <= 0.3) m *= 1 - cond.granitPct
  if (cond.ancragePct && !ancrageBroken) m *= 1 - cond.ancragePct
  if (cond.sixiemePct && (o.casting || o.telegraphed)) m *= 1 - cond.sixiemePct
  if (cond.paratonnerrePct && o.surge) m *= 1 - cond.paratonnerrePct
  if (cond.rempartPer && (o.aliveEnemies ?? 1) > 1) {
    m *= 1 - Math.min(cond.rempartPer * 5, cond.rempartPer * ((o.aliveEnemies ?? 1) - 1))
  }
  if (o.telegraphed && cond.memoirePct && o.tenacity) m *= 1 - o.tenacity * cond.memoirePct
  return Math.max(0.1, m)
}

/** v0.26 : chaîne défensive de BASTION autour d'un dégât héros — 🛡️ Égide (1er coup),
 *  🐢 Carapace (gros coup → bouclier), 🔃 Échangeur (dégâts → recharges), 🌵 Cilice (épines),
 *  🪟 Verre trempé (reset). `discrete` = vrai COUP (télégraphe, explosion), pas le flux continu. */
function gemDamageHero(
  c: Character,
  amount: number,
  o: { cond?: CondMods; attacker?: Enemy; discrete?: boolean },
): number {
  let amt = amount
  const cond = o.cond
  if (o.discrete && amt > 0 && cond?.egidePct && (egideLeft.get(c.id) ?? 0) > 0) {
    amt *= 1 - cond.egidePct
    egideLeft.set(c.id, (egideLeft.get(c.id) ?? 1) - 1)
  }
  const taken = damageHero(c, amt)
  if (taken > 0) {
    verreTimer.set(c.id, 0)
    const mh = charMaxHp(c)
    if (cond?.echangeurSec) {
      const acc = (echangeurAcc.get(c.id) ?? 0) + taken / mh
      const steps = Math.floor(acc / 0.1)
      echangeurAcc.set(c.id, acc - steps * 0.1)
      if (steps > 0) {
        for (const pid of charDeck(c)) {
          if (!pid) continue
          const k = `${c.id}:${pid}`
          cooldowns.set(k, Math.max(0, (cooldowns.get(k) ?? 0) - steps * cond.echangeurSec))
        }
      }
    }
    if (o.discrete && cond?.carapacePct && taken >= 0.15 * mh && (carapaceCdMap.get(c.id) ?? 0) <= 0) {
      c.absorb = (c.absorb ?? 0) + cond.carapacePct * mh
      carapaceCdMap.set(c.id, 10)
    }
    if (cond?.cilicePct && o.attacker && o.attacker.hp > 0) {
      o.attacker.hp = Math.max(0, o.attacker.hp - taken * cond.cilicePct)
    }
  }
  return taken
}

/** 🗼 Tour de garde : si la cible est sous 30% PV, une fraction des coups part vers le plus
 *  endurant (PV max). Renvoie l'index du « garde » et la fraction redirigée, ou null. */
function tourGardeSplit(chars: Character[], targetI: number, cond?: CondMods): { tankI: number; frac: number } | null {
  if (!cond?.tourGardePct) return null
  const t = chars[targetI]
  if (t.hp <= 0 || t.hp / charMaxHp(t) > 0.3) return null
  let tankI = -1
  let best = charMaxHp(t)
  chars.forEach((c, i) => {
    if (i === targetI || c.hp <= 0) return
    const mh = charMaxHp(c)
    if (mh > best) { best = mh; tankI = i }
  })
  return tankI >= 0 ? { tankI, frac: cond.tourGardePct } : null
}

/** v0.26 : multiplicateur OFFENSIF par héros des nouvelles gemmes (🎺 Marche, 📜 Testament,
 *  ⚡ Sous tension, 🪟 Verre trempé, 🧭 Boussole vs champion, 🎯 Première impression). */
function gemOffenseMult(
  c: Character,
  cond: CondMods | undefined,
  target: Enemy | undefined,
  firstOfPack: boolean,
): number {
  if (!cond) return 1
  let m = 1
  if (cond.marcheCap) m *= 1 + marcheBonus(cond.marcheCap)
  if (cond.testamentPct && testamentLeft > 0) m *= 1.1
  if (cond.verreTrempePct && (verreTimer.get(c.id) ?? 0) >= 4) m *= 1 + cond.verreTrempePct
  if (cond.tensionPct) {
    let all = true
    let any = false
    for (const pid of charDeck(c)) {
      if (!pid) continue
      const p = getPower(pid)
      if (!p || p.kind !== 'active') continue
      any = true
      if ((cooldowns.get(`${c.id}:${pid}`) ?? 0) <= 0) { all = false; break }
    }
    if (any && all) m *= 1 + cond.tensionPct
  }
  if (cond.boussolePct && target?.champion) m *= 1 + cond.boussolePct
  if (cond.premierePct && firstOfPack) m *= 1 + cond.premierePct
  return m
}

/** 🤺 Riposte mesurée : accumule le temps sous le feu de `c` ; déclenche des ripostes. */
function gemRiposte(
  c: Character,
  d: { derived: DerivedStats; profile: DamageProfile; cmods: CharCombatMods },
  enemy: Enemy,
  dt: number,
  cond?: CondMods,
): number {
  if (!cond?.riposteSec || c.hp <= 0 || enemy.hp <= 0) return 0
  let acc = (riposteAcc.get(c.id) ?? 0) + dt
  let dealt = 0
  while (acc >= cond.riposteSec && enemy.hp > 0) {
    acc -= cond.riposteSec
    const hit = rollHit(d.derived, d.profile, enemy, { bonusMult: d.cmods.damageMult * d.cmods.autoTagMult })
    enemy.hp = Math.max(0, enemy.hp - hit.damage)
    dealt += hit.damage
  }
  riposteAcc.set(c.id, acc)
  return dealt
}

// 🤺 RIPOSTE de MAÎTRISE (v0.38, bruiser Force) : tant que tu es au combat, % de chance (riposteChance)
// de renvoyer une FRAPPE COMPLÈTE. Modélisé en continu = un contre toutes les (RIPOSTE_INTERVAL / chance)
// secondes → DPS ∝ chance × dégât d'une frappe. Zéro hors Force (riposteChance = 0).
const mRiposteAcc = new Map<string, number>()
const RIPOSTE_INTERVAL = 1.0
function masteryRiposte(
  c: Character,
  d: { derived: DerivedStats; profile: DamageProfile; cmods: CharCombatMods },
  enemy: Enemy,
  dt: number,
): number {
  const chance = d.derived.riposteChance
  if (chance <= 0 || c.hp <= 0 || enemy.hp <= 0) return 0
  const interval = RIPOSTE_INTERVAL / chance
  let acc = (mRiposteAcc.get(c.id) ?? 0) + dt
  let dealt = 0
  while (acc >= interval && enemy.hp > 0) {
    acc -= interval
    const hit = rollHit(d.derived, d.profile, enemy, { bonusMult: d.cmods.damageMult * d.cmods.autoTagMult })
    enemy.hp = Math.max(0, enemy.hp - hit.damage)
    dealt += hit.damage
  }
  mRiposteAcc.set(c.id, acc)
  return dealt
}

/** 💧/🏆 Soin de VOL DE VIE avec débordement (Goutte-à-goutte : l'excès devient régén différée). */
function gemLeechHeal(c: Character, amount: number, cond?: CondMods) {
  if (amount <= 0) return
  const mh = charMaxHp(c)
  const before = c.hp
  c.hp = Math.min(mh, c.hp + amount)
  const over = amount - (c.hp - before)
  if (over > 0 && cond?.goutteePct) {
    hotPool.set(c.id, Math.min(mh, (hotPool.get(c.id) ?? 0) + over * cond.goutteePct))
  }
}

/** 🏆/⚱️ Soin de CAPACITÉ avec débordement (Calice → bouclier) et écho (Vases communicants).
 *  `echo: false` pour les soins de GROUPE (tout le monde est déjà servi — pas de ricochet). */
function gemAbilityHeal(t: Character, amount: number, cond: CondMods | undefined, chars: Character[], echo = true) {
  if (amount <= 0) return
  const mh = charMaxHp(t)
  const before = t.hp
  t.hp = Math.min(mh, t.hp + amount)
  const over = amount - (t.hp - before)
  if (over > 0 && cond?.caliceCap) {
    const capV = cond.caliceCap * mh
    if ((t.absorb ?? 0) < capV) t.absorb = Math.min(capV, (t.absorb ?? 0) + over)
  }
  if (echo && cond?.vasesPct) {
    let low: Character | null = null
    for (const a of chars) {
      if (a.hp <= 0 || a === t) continue
      if (!low || a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
    }
    if (low) low.hp = Math.min(charMaxHp(low), low.hp + amount * cond.vasesPct)
  }
}

/** 🌗 COMMUNION D'OMBRE (v0.34) : les DoT du Prêtre soignent l'allié le plus blessé (somme des frac
 *  `dotHealsParty` de l'équipe × le tick de DoT). Sustain de groupe né de l'affliction (rôle Lumière). */
function healDotParty(chars: Character[], info: ({ cmods: CharCombatMods } | null | undefined)[], dmg: number) {
  let pool = 0
  for (let i = 0; i < chars.length; i++) { const d = info[i]; if (d && d.cmods.dotHealsParty > 0) pool += dmg * d.cmods.dotHealsParty }
  if (pool <= 0) return
  const alive = chars.filter((c) => c.hp > 0)
  if (!alive.length) return
  let low = alive[0]
  for (const a of alive) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
  low.hp = Math.min(charMaxHp(low), low.hp + pool)
}

/** 🌀 MÉTAMORPHE (v0.34) « Danse Primordiale » : multiplicateur de dégâts de la FORME active + Instinct.
 *  Fauve/Ours/Hibou donnent chacun leur bonus tant qu'ils sont actifs ; la Chimère cumule les 3 ;
 *  la Mémoire des formes (echo) garde une part des deux autres formes ; l'Instinct ajoute son momentum.
 *  Tout est BORNÉ (% fixes, stacks plafonnés) → plat en ilvl. */
function formDamageMult(c: Character, cm: CharCombatMods): number {
  if (!cm.shifter) return 1
  let bonus: number
  if ((c.chimera ?? 0) > 0) {
    bonus = cm.formFauve + cm.formOurs + cm.formHibou // Forme Chimère : les 3 formes à la fois
  } else {
    const f = c.form ?? 0
    bonus = f === 1 ? cm.formOurs : f === 2 ? cm.formHibou : cm.formFauve
    if (cm.formEcho > 0) bonus += cm.formEcho * (cm.formFauve + cm.formOurs + cm.formHibou - bonus) / 2 // écho des 2 autres formes
  }
  return 1 + bonus + cm.instinctPer * (c.instinct ?? 0)
}

/** 🛎️ Carillon : à appeler au moment de POSER une recharge — renvoie 0,5 quand le bonus est mûr. */
function carillonMult(cond?: CondMods): number {
  if (!cond?.carillonN) return 1
  if (carillonReady) { carillonReady = false; return 0.5 }
  const n = (gemCounters.get('carillon') ?? 0) + 1
  if (n >= cond.carillonN) { carillonReady = true; gemCounters.set('carillon', 0) } else gemCounters.set('carillon', n)
  return 1
}

/** 🔮 Prisme d'accord : déplace une fraction du profil de dégâts vers le type du biome. */
function shiftProfile(p: DamageProfile, to: DamageType, frac: number): DamageProfile {
  const profile: Partial<Record<DamageType, number>> = {}
  for (const t in p.profile) profile[t as DamageType] = (p.profile[t as DamageType] ?? 0) * (1 - frac)
  profile[to] = (profile[to] ?? 0) + frac
  return { ...p, profile }
}

/** Multiplicateur de dégâts SUBIS par un ennemi (vulnérabilité « Sceau de faiblesse »). */
function enemyVuln(enemy: Enemy): number {
  return enemy.vuln && enemy.vuln.remaining > 0 ? enemy.vuln.mult : 1
}

/**
 * AUTO « intelligent » (v0.29.4) : un SPENDER (finisseur / détonation) ne s'auto-lance qu'au-dessus
 * d'un seuil de ressource → l'idle reste correct. En MANUEL, le joueur décide (try-hard : timer le pic
 * à ressource pleine, dans une fenêtre de burst). C'est ça l'écart de skill idle ↔ try-hard.
 */
function autoSpenderReady(p: PowerDef, c: Character, enemy: Enemy | undefined, isManual: boolean): boolean {
  if (isManual) return true
  if (p.effect === 'finisher') return (c.combo ?? 0) >= 3
  if (p.effect === 'detonate') return (enemy?.venomStacks ?? 0) >= 4
  return true
}

/**
 * Lance une capacité active. Renvoie les DÉGÂTS infligés à l'ennemi (pour la « Vengeance différée »).
 * v0.37 « Piste C » : les dégâts d'un sort scalent sur le bonus de SON TYPE (matching — spellTypeMult,
 * et non plus la moyenne type-agnostique profileDamageMult) et subissent la résist ennemie de ce type
 * (spellResistMult). Donc empiler l'élément de tes sorts les booste, et la Pénétration sert aux casters.
 */
function fireActive(p: PowerDef, caster: Character, derived: DerivedStats, profile: DamageProfile, chars: Character[], enemy: Enemy, hotBonus: number, dmgMult = 1, healToDamage = 0, cond?: CondMods, pact?: PactMods): number {
  const base = (p.magnitude ?? 1) * abilityPower(derived, powerScale(p)) // soins (sans profil ni keystones)
  // v0.29.4 : bonus par TAG (cross-classe) — un nœud « tes [dot] +12% » booste TOUT sort taggé dot.
  const cm = charCombatMods(caster)
  // v0.37 « Piste C » — TYPE DU SORT. Un sort scale sur le bonus de SON type (matching : stacker l'élément
  // de tes sorts les booste), avec une part résiduelle de la moyenne du profil (multi-élément protégé),
  // PUIS subit la résist ennemie de ce type (comme les auto-attaques ; uniforme aujourd'hui → contrée par
  // la Pénétration). Remplace l'ancienne moyenne type-agnostique (profileDamageMult) pour les sorts.
  const weaponMainType: DamageType = caster.equipment.armePrincipale?.damageType ?? 'physique'
  const spellType: DamageType = p.damageType ?? weaponMainType
  const profMult = spellTypeMult(profile, spellElementTypes(p.tags, spellType))
    * spellResistMult(enemy, spellType, derived.penetration)
  let tagMult = 1
  if (p.tags) for (const t of p.tags) tagMult *= (cm.tagBonus[t] ?? 1)
  // v0.38 — le bonus de tag [soin] (ex : Ferveur « sorts [soin] +15% ») booste enfin les SOINS eux-mêmes
  // (avant : tagMult n'était appliqué qu'aux DÉGÂTS → le levier de soin par tag était mort).
  const healTagMult = cm.tagBonus['soin'] ?? 1
  // CONTRÔLE (v0.29.6) : un sort [controle] gèle/ralentit ; SHATTER : +dégâts aux ennemis contrôlés.
  if (p.tags?.includes('controle')) enemy.controlled = Math.max(enemy.controlled ?? 0, p.duration ?? 4)
  // SHATTER : +dégâts vs gelé/contrôlé. v0.34 « Équilibre des sphères » : shatter +frac×(altMult−1), BORNÉ.
  const shatterTot = cm.shatter + cm.shatterFromAlteration * (derived.alterationMult - 1)
  const shatterMult = (enemy.controlled ?? 0) > 0 ? 1 + shatterTot : 1
  // PYROMANCIEN « Hot Streak » (v0.31) : tes sorts [feu] chargent la Chaleur (montée pondérée par le Critique).
  // Un sort [feu][direct] lancé à PLEINE Chaleur est SURPUISSANT (×mult) puis remet la Chaleur à 0.
  let hotMult = 1
  if (cm.hotStreak && p.tags?.includes('feu')) {
    const isNuke = p.effect === 'nuke' || p.effect === 'cleave' || p.effect === 'megaCleave'
    if (isNuke && p.tags.includes('direct') && (caster.heat ?? 0) >= cm.hotStreak.cap) {
      hotMult = cm.hotStreak.mult
      caster.heat = 0
      // v0.34 « Combustion runique » : un déclenchement de Hot Streak octroie des Charges des arcanes (Feu→Arcane).
      if (cm.hotStreakCharges > 0) caster.combo = Math.min(5 + cm.comboCap, (caster.combo ?? 0) + cm.hotStreakCharges)
    } else {
      caster.heat = Math.min(cm.hotStreak.cap, (caster.heat ?? 0) + 1 + 2 * derived.critChance)
    }
  }
  // v0.34 « TRINITÉ » (Convergence) : +frac de TOUS tes dégâts par état élémentaire ACTIF (embrasement /
  // gel / surcharge), borné à 3 états (indépendant de l'ilvl → pas de snowball).
  const elemStates = cm.elementalStates > 0
    ? (enemy.dot ? 1 : 0) + ((enemy.controlled ?? 0) > 0 ? 1 : 0) + ((caster.overload ?? 0) > 0 ? 1 : 0)
    : 0
  const trinityMult = 1 + cm.elementalStates * elemStates
  const magDmg = base * profMult * dmgMult * tagMult * shatterMult * hotMult * trinityMult * formDamageMult(caster, cm) // type du sort (matching + résist) + keystones + tags + shatter + Hot Streak + Trinité + Forme
  // Boucliers : scalent sur la MEILLEURE de (stat principale, Endurance) → un tank qui empile
  // l'Endurance obtient un énorme bouclier (levier de survie qui suit l'Endurance).
  const shieldBase = (p.magnitude ?? 1) * Math.max(abilityPower(derived, powerScale(p)), derived.endurancePower)
  const vm = enemyVuln(enemy)
  // v0.34 « Lame Vénéneuse » : facteur crit du venin (gaté au seuil de Critique, BORNÉ) + application
  // de venin par un finisseur/générateur (référence = coup NORMAL non amplifié).
  const venCrit = cm.poisonCanCrit > 0 && derived.critChance >= cm.poisonCanCrit
    ? 1 + derived.critChance * (derived.critMult - 1) : 1
  const venomRef = base * profMult * dmgMult
  const applyVenom = (n: number) => {
    if (n <= 0) return
    const stacks = Math.min(cm.poison.maxStacks, (enemy.venomStacks ?? 0) + n)
    enemy.venomStacks = stacks
    const dps = stacks * cm.poison.perStack * venomRef * derived.alterationMult * venCrit
    enemy.dot = { dps: Math.max(dps, enemy.dot?.dps ?? 0), remaining: 8 }
  }
  const hit = (dmg: number): number => {
    const before = enemy.hp; enemy.hp = Math.max(0, enemy.hp - dmg); const done = before - enemy.hp
    // PALADIN AUBE : une fraction de TES DÉGÂTS soigne l'allié le plus blessé (« soigne en frappant »).
    if (cm.damageToHeal > 0 && done > 0 && !pact?.noHeal) {
      const allies = chars.filter((c) => c.hp > 0)
      if (allies.length) {
        let low = allies[0]
        for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
        gemAbilityHeal(low, done * cm.damageToHeal, cond, chars)
      }
    }
    return done
  }
  // v0.34 « Crépuscule » : amplis du CHÂTIMENT (atonement) — tous BORNÉS ou conditionnels.
  const folieActive = (caster.frenzy?.remaining ?? 0) > 0
  const folieDotMult = folieActive && cm.folieDot > 0 ? 1 + cm.folieDot : 1
  const atoneAmp = (cm.atonementIsShadow ? (cm.tagBonus['ombre'] ?? 1) : 1)
    * (1 + (cm.atonementVsDot > 0 && enemy.dot ? cm.atonementVsDot : 0))
    * (1 + cm.atonementFromAlteration * (derived.alterationMult - 1))
    * cm.atonementMult
    * (folieActive ? 1 + cm.folieEmpowersAtonement : 1)
  // DISSONANCE : un soin pose aussi un DoT d'ombre sur l'ennemi (scale comme un sort d'ombre).
  const applyHealDot = (healed: number) => {
    if (cm.healAppliesDot <= 0 || enemy.hp <= 0) return
    const dps = healed * spellTypeMult(profile, ['ombre']) * spellResistMult(enemy, 'ombre', derived.penetration) * 0.4 * derived.alterationMult * (cm.tagBonus['ombre'] ?? 1) * dmgMult * cm.healAppliesDot * folieDotMult
    enemy.dot = { dps: Math.max(dps, enemy.dot?.dps ?? 0), remaining: 6 }
  }
  // ORACLE SANGLANT / CHÂTIMENT : une fraction du SOIN est aussi infligée en dégâts à l'ennemi focus.
  const bleedHeal = (healed: number): number => (healToDamage > 0 && enemy.hp > 0 ? hit(healed * healToDamage * atoneAmp * vm) : 0)
  const canHeal = !pact?.noHeal && !cm.noSelfHeal // HÉRÉSIE : plus aucun soin
  switch (p.effect) {
    case 'nuke':
    case 'cleave':
    case 'megaCleave': {
      const done = hit(magDmg * vm)
      // v0.34 « Fracas ardent » (Convergence) : un coup [feu] sur un GELÉ pose un Embrasement (Givre→Feu).
      if (cm.frozenIgnites > 0 && (enemy.controlled ?? 0) > 0 && p.tags?.includes('feu') && enemy.hp > 0) {
        enemy.dot = { dps: Math.max(magDmg * cm.frozenIgnites * derived.alterationMult, enemy.dot?.dps ?? 0), remaining: 6 }
      }
      return done
    }
    case 'executeNuke': {
      // +250% de dégâts selon les PV MANQUANTS : finisher dévastateur.
      const missing = 1 - enemy.hp / Math.max(1, enemy.maxHp)
      return hit(magDmg * (1 + missing * 2.5) * vm)
    }
    case 'lifeNuke': {
      const done = hit(magDmg * vm)
      if (!pact?.noHeal) caster.hp = Math.min(charMaxHp(caster), caster.hp + done * 0.6)
      return done
    }
    case 'dot':
      // L'Altération amplifie les dégâts sur la durée. PÉNOMBRE : la Folie (frenzy) booste tes DoT.
      enemy.dot = { dps: Math.max(magDmg * 0.4 * derived.alterationMult * folieDotMult, enemy.dot?.dps ?? 0), remaining: 5 }
      return 0
    case 'rupture':
      // Brise la régén ennemie + grosse plaie (dégât immédiat + DoT puissant).
      enemy.noRegen = Math.max(enemy.noRegen ?? 0, p.duration ?? 8)
      enemy.dot = { dps: Math.max(magDmg * 0.5 * derived.alterationMult, enemy.dot?.dps ?? 0), remaining: p.duration ?? 8 }
      return hit(magDmg * 0.5 * vm)
    case 'mark':
      enemy.vuln = { mult: p.magnitude ?? 1.4, remaining: p.duration ?? 8 } // magnitude = multiplicateur brut
      return 0
    case 'heal':
    case 'hot': {
      const healed = base * (1 + hotBonus) * healTagMult
      const allies = chars.filter((c) => c.hp > 0)
      if (allies.length && canHeal) {
        let low = allies[0]
        for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
        gemAbilityHeal(low, healed, cond, chars) // 🏆 Calice + ⚱️ Vases (v0.26)
      }
      applyHealDot(healed) // DISSONANCE
      return bleedHeal(healed)
    }
    case 'bigHeal': {
      const healed = base * (1 + hotBonus) * healTagMult
      if (canHeal) for (const a of chars) if (a.hp > 0) gemAbilityHeal(a, healed, cond, chars, false)
      applyHealDot(healed)
      return bleedHeal(healed)
    }
    case 'buffParty': {
      const healed = base * 0.5 * (1 + hotBonus) * healTagMult
      if (canHeal) for (const a of chars) if (a.hp > 0) gemAbilityHeal(a, healed, cond, chars, false)
      applyHealDot(healed)
      return bleedHeal(healed)
    }
    // v0.34 « Crépuscule » — sorts hybrides : frappe d'ombre QUI SOIGNE.
    case 'smiteHeal': {
      const done = hit(magDmg * vm)
      if (canHeal && done > 0) {
        const allies = chars.filter((c) => c.hp > 0)
        if (allies.length) {
          let low = allies[0]
          for (const a of allies) if (a.hp / charMaxHp(a) < low.hp / charMaxHp(low)) low = a
          gemAbilityHeal(low, done * 0.5 * healTagMult, cond, chars) // soigne l'allié blessé = 50% des dégâts (× bonus [soin])
        }
      }
      return done
    }
    case 'eclipse': {
      // ULTIME : cataclysme d'ombre (zone) + restaure TOUT le groupe (40% des dégâts chacun).
      const done = hit(magDmg * vm)
      if (canHeal && done > 0) for (const a of chars) if (a.hp > 0) gemAbilityHeal(a, done * 0.4 * healTagMult, cond, chars, false)
      return done
    }
    case 'shield':
      // Bouclier runique (v0.36) : REMPLACE (max, pas +) et borné aux PV max → relancer ne cumule pas,
      // impossible d'empiler du bouclier à l'infini sur du trash avant le boss.
      caster.absorb = Math.min(charMaxHp(caster), Math.max(caster.absorb ?? 0, shieldBase))
      return 0
    case 'bigShield':
      // Énorme bouclier d'absorption (soaké avant les PV) + 40% à l'équipe — REMPLACE (max) + cap PV.
      caster.absorb = Math.min(charMaxHp(caster), Math.max(caster.absorb ?? 0, shieldBase))
      for (const a of chars) if (a.hp > 0 && a !== caster) a.absorb = Math.min(charMaxHp(a), Math.max(a.absorb ?? 0, shieldBase * 0.4))
      return 0
    case 'invuln':
      caster.invuln = Math.max(caster.invuln ?? 0, p.duration ?? 2)
      return 0
    case 'charge':
      // Démarre l'accumulation ; la frappe différée (×mult le cumul) est résolue dans le pas de combat.
      caster.charge = { dealt: 0, remaining: p.duration ?? 5, mult: p.magnitude ?? 3 }
      return 0
    case 'frenzy':
      caster.frenzy = { mult: p.magnitude ?? 2, remaining: p.duration ?? 6 }
      return 0
    // v0.34 « Avatar de guerre » (Juggernaut) : transe de dégâts (frenzy) + ÉNORME bouclier d'absorption.
    case 'avatar': {
      caster.frenzy = { mult: p.magnitude ?? 1.8, remaining: p.duration ?? 8 }
      const grant = Math.min(charMaxHp(caster), shieldBase * 2.5) // bouclier scalé sur Endurance, ≤ PV max
      caster.absorb = Math.max(caster.absorb ?? 0, grant)
      return 0
    }
    // v0.34 « Bond sauvage » (Métamorphe) : métamorphose-éclair (forme suivante + Instinct) puis frappe.
    case 'shift': {
      caster.form = ((caster.form ?? 0) + 1) % 3
      caster.formClock = Math.max(2, 5 - cm.shiftHaste)
      caster.instinct = Math.min(cm.instinctMax || 0, (caster.instinct ?? 0) + 1)
      return hit(magDmg * vm)
    }
    // v0.34 « Forme Chimère » (Métamorphe) : les 3 formes actives à la fois pendant `duration`.
    case 'chimera':
      caster.chimera = Math.max(caster.chimera ?? 0, p.duration ?? 10)
      return 0
    // --- v0.29.2 : socle VOLEUR ---
    case 'poison': {
      // ASSASSIN : empile un STACK de venin ; le DoT (enemy.dot) monte avec les stacks.
      const stacks = Math.min(cm.poison.maxStacks, (enemy.venomStacks ?? 0) + 1)
      enemy.venomStacks = stacks
      // v0.34 « Lame critique » : le venin hérite du critique (venCrit, borné, gaté au seuil).
      const dps = stacks * cm.poison.perStack * magDmg * derived.alterationMult * venCrit
      enemy.dot = { dps: Math.max(dps, enemy.dot?.dps ?? 0), remaining: 8 }
      return 0
    }
    case 'detonate': {
      // ASSASSIN : consomme tous les stacks → pic = stacks × magnitude. Catalyse double avant détonation.
      const before = enemy.venomStacks ?? 0
      const stacks = before * (cm.detonateDouble ? 2 : 1)
      if (stacks <= 0) return hit(magDmg * vm)
      const done = hit(magDmg * stacks * vm)
      // v0.34 « Apothéose du fléau » : ré-applique une fraction des stacks consommés (détonation soutenue).
      if (cm.detonateReapply > 0) {
        enemy.venomStacks = 0
        enemy.dot = undefined
        applyVenom(Math.floor(before * cm.detonateReapply))
      } else {
        enemy.venomStacks = 0
        enemy.dot = undefined
      }
      return done
    }
    case 'builder': {
      // OMBRELAME : +`gen` Point(s) de Combo (défaut 1 ; un générateur INT lent peut en donner +2) (+ petit coup).
      const cap = 5 + cm.comboCap
      caster.combo = Math.min(cap, (caster.combo ?? 0) + (p.gen ?? 1) + cm.comboGen)
      // v0.34 « Lames suintantes » : les générateurs appliquent aussi du venin (boucle venin↔combo).
      if (cm.builderPoison) applyVenom(1)
      // ARCANISTE « Surcharge instable » : au PLEIN de Charges, déclenche la fenêtre (et CONSOMME les Charges).
      if (cm.overload && (caster.overload ?? 0) <= 0 && (caster.combo ?? 0) >= cap) {
        caster.overload = cm.overload.window
        caster.combo = 0
        // v0.34 « Gel arcanique » (Convergence) : entrer en Surcharge GÈLE le pack (Arcane→Givre).
        if (cm.overloadFreezes) enemy.controlled = Math.max(enemy.controlled ?? 0, 3)
      }
      return hit(magDmg * vm)
    }
    case 'finisher': {
      // OMBRELAME : consomme les Points de Combo → dégâts × points. comboRefund en rend une partie (spam).
      const pts = Math.max(1, caster.combo ?? 0)
      const cap = 5 + cm.comboCap
      const venoms = enemy.venomStacks ?? 0
      // v0.34 « Lame Vénéneuse » : amplis de finisseur conditionnels (tous BORNÉS / gatés par une condition).
      let finMult = 1 + cm.finisherMult
      if (cm.finisherIsDot) finMult *= (cm.tagBonus['dot'] ?? 1)                 // compte comme [dot]
      if (cm.finisherVsVenom > 0 && venoms > 0) finMult *= 1 + cm.finisherVsVenom // Verdict toxique
      if (cm.finisherFromAlteration > 0) finMult *= 1 + cm.finisherFromAlteration * (derived.alterationMult - 1) // Symbiose (borné)
      if (cm.finisherVenomBonus > 0) finMult *= 1 + Math.min(0.4, cm.finisherVenomBonus * venoms) // Pacte (capé 40 %)
      // v0.34 « Bouclier offensif » (Juggernaut) : le finisseur frappe selon ton bouclier d'absorption (BORNÉ : ≤ PV).
      if (cm.shieldToFinisher > 0 && (caster.absorb ?? 0) > 0) finMult *= 1 + cm.shieldToFinisher * Math.min(1, (caster.absorb ?? 0) / Math.max(1, charMaxHp(caster)))
      const done = hit(magDmg * pts * 0.55 * finMult * vm)
      // v0.34 « Sang et acier » (Juggernaut) : un finisseur rafraîchit tes saignements (DoT physique).
      if (cm.finisherRefreshBleed && enemy.dot) enemy.dot.remaining = Math.max(enemy.dot.remaining, 5)
      // v0.34 « Bond coordonné » (Symbiose) : un finisseur fait BONDIR le familier (pic ≈ N s de son DPS).
      if (cm.petBurstOnFinisher > 0 && cm.petDps > 0) {
        const petMult = 1 + cm.petBonus + cm.petFromPrecision * derived.precision
        hit(theoreticalDps(derived, profile, cm.damageMult) * cm.petDps * petMult * cm.petBurstOnFinisher * vm)
      }
      // Lame Vénéneuse : le finisseur applique du venin (⌈PC × frac⌉). Entaille septique : rafraîchit.
      if (cm.finisherToPoison > 0) applyVenom(Math.ceil(pts * cm.finisherToPoison))
      else if (cm.finisherRefreshPoison && enemy.dot && venoms > 0) enemy.dot.remaining = 8
      // Toxine explosive : à PC plein, détone une fraction des stacks (consommés).
      if (cm.finisherDetonate > 0 && pts >= cap && venoms > 0) {
        const blown = Math.floor(venoms * cm.finisherDetonate) * (cm.detonateDouble ? 2 : 1)
        if (blown > 0) {
          hit(venomRef * blown * derived.alterationMult * venCrit * vm)
          enemy.venomStacks = Math.max(0, venoms - Math.floor(venoms * cm.finisherDetonate))
        }
      }
      // Toxine rémanente : prolonge le venin + le booste (par PC), sans le consommer.
      if (cm.finisherProlongsDot && enemy.dot) {
        enemy.dot.remaining = Math.min(15, enemy.dot.remaining + cm.finisherProlongsDot.seconds)
        enemy.dot.dps *= 1 + Math.min(0.6, cm.finisherProlongsDot.perCombo * pts)
      }
      caster.combo = cm.comboRefund
      // Danse vénéneuse : le finisseur regénère 1 PC si la cible est au venin MAX.
      if (cm.venomFinisherGen && venoms >= cm.poison.maxStacks) caster.combo = Math.min(cap, caster.combo + 1)
      // REMPART : convertit la dépense de Rage en bouclier — MAIS (1) au plus une fois / 30 s (cooldown
      // interne, sinon bouclier permanent = trop fort), (2) borné aux PV : au plus 50% des PV max par
      // déclenchement, total ≤ PV max. Le bouclier suit la SURVIE (PV), pas le dégât brut (milliards endgame).
      if (cm.finisherShield > 0 && (shieldCdMap.get(caster.id) ?? 0) <= 0) {
        const mh = charMaxHp(caster)
        const grant = Math.min(done * cm.finisherShield, mh * 0.5)
        const room = Math.max(0, mh - (caster.absorb ?? 0))
        const added = Math.min(grant, room)
        if (added > 0) { caster.absorb = (caster.absorb ?? 0) + added; shieldCdMap.set(caster.id, 30) }
      }
      return done
    }
  }
  return 0
}

/** Applique des dégâts à un héros via l'immunité puis le bouclier d'absorption. Renvoie les PV réellement perdus. */
function damageHero(c: Character, amount: number): number {
  if (amount <= 0) return 0
  if ((c.invuln ?? 0) > 0) return 0 // immunité totale (Phase éthérée)
  let amt = amount
  if ((c.absorb ?? 0) > 0) {
    const soak = Math.min(c.absorb!, amt)
    c.absorb = c.absorb! - soak
    amt -= soak
    if ((c.absorb ?? 0) <= 0) c.absorb = undefined
  }
  c.hp -= amt
  return amt
}

/** Contexte de combat d'un héros utilisé pour résoudre les techniques ennemies. */
interface AbilityCtx {
  derived: DerivedStats
  resist: Partial<Record<DamageType, number>>
  passives: { threatMult: number; damageReduction: number }
  cmods: CharCombatMods
  /** v0.26 : gemmes d'équipe + contexte (chaîne défensive sur les coups télégraphés). */
  cond?: CondMods
  surge?: boolean
  aliveEnemies?: number
  /** 🩸 Pacte(s) actif(s) — dmgIn s'applique aussi aux coups télégraphés. */
  pact?: PactMods
  /** 🧴 Antidote ciblé (Officine) — réduit les techniques de CE type. */
  antidote?: { type: DamageType; pct: number }
}

/** Applique l'effet d'une technique ennemie à un héros cible (modèle d'exigence + Purge). */
function applyEnemyAbility(ab: EnemyAbility, enemy: Enemy, t: Character, ctx: AbilityCtx) {
  const resist = ctx.resist[ab.element] ?? 0
  const purge = ctx.derived.resilience // v0.38 — la Résilience couvre l'ex-Purge (intensité/durée des altérations)
  const extra = (1 - ctx.passives.damageReduction) * (1 - ctx.cmods.flatDr)
  const req = enemyReq(enemy, ab.element)
  // ÉGIDE « Aegis adaptatif » : tout type qui te frappe te rend plus résistant à ce type.
  if (ctx.cmods.adaptiveResist && (ab.kind === 'dot' || ab.kind === 'burst' || ab.kind === 'drain')) {
    adaptiveAdd(t.id, ab.element, ctx.cmods.adaptiveResist.gain, ctx.cmods.adaptiveResist.cap)
  }
  // PURGATEUR : chaque affliction subie nourrit la Combustion purificatrice.
  if (ctx.cmods.afflictionFuel && (ab.kind === 'dot' || ab.kind === 'cc' || ab.kind === 'debuff')) fuelAdd(t.id)
  switch (ab.kind) {
    case 'dot': {
      // DoT : ignore armure/esquive. La PURGE réduit intensité + durée ET ronge l'exigence du
      // type sur les altérations (v0.24 §5.3 : Req_eff = Req − Purge×100 — la soupape anti-DoT).
      const reqDot = Math.max(0, req - purge * 100)
      const dps = Math.max(0, enemy.damage * ab.magnitude * resistMult(reqDot, resist, ctx.cmods.reqReduction) * (1 - purge))
      const remaining = (ab.duration ?? 4) * (1 - purge * 0.5)
      if (dps > 0) t.dots = [...(t.dots ?? []), { dps, type: ab.element, remaining }]
      break
    }
    case 'burst':
    case 'drain': {
      // Coup unique télégraphié : multiplicateur d'exigence + atténuation générique bornée,
      // puis la chaîne défensive v0.26 (Sixième sens, Granit, Mémoire de la pierre, Égide,
      // Carapace…) et enfin l'immunité/bouclier d'absorption du héros.
      let dmg = incomingDps(enemy.damage * ab.magnitude, ab.element, ctx.derived, ctx.resist, req, extra, ctx.cmods.reqReduction)
      dmg *= (ctx.pact?.dmgIn ?? 1)
        * (ctx.antidote && ctx.antidote.type === ab.element ? 1 - ctx.antidote.pct : 1)
        * gemDefenseMult(t, charMaxHp(t), {
        cond: ctx.cond, surge: ctx.surge, aliveEnemies: ctx.aliveEnemies,
        telegraphed: !!ab.telegraph, tenacity: ctx.derived.resilience,
      })
      const taken = gemDamageHero(t, dmg, { cond: ctx.cond, attacker: enemy, discrete: true })
      if (ab.kind === 'drain') enemy.hp = Math.min(enemy.maxHp, enemy.hp + taken * 0.6)
      break
    }
    case 'cc': {
      // Contrôle : durée réduite par la RÉSILIENCE (v0.38, ex-Ténacité).
      t.stun = Math.max(t.stun ?? 0, (ab.duration ?? 1) * (1 - ctx.derived.resilience))
      break
    }
    case 'debuff': {
      // Malédiction : −35% de dégâts du héros ; durée réduite par la PURGE.
      const dur = (ab.duration ?? 5) * (1 - purge)
      if (dur > 0.3) t.weaken = { mult: 0.65, remaining: Math.max(t.weaken?.remaining ?? 0, dur) }
      break
    }
  }
}

/** Fait progresser les techniques d'un ennemi (cooldown + télégraphe) et applique celles qui tombent.
 *  🐌 Dilatation : allonge les télégraphes · ⏳ Grain de sable : 1re incantation des non-boss coupée.
 *  v0.26 : 🗼 Tour de garde peut détourner le coup d'une cible fragile vers le plus endurant. */
function tickEnemyAbilities(enemy: Enemy, chars: Character[], info: (AbilityCtx | null)[], dt: number, runes?: TimeRuneMods) {
  if (!enemy.abilities || enemy.abilities.length === 0 || enemy.hp <= 0) return
  const alive = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
  if (!alive.length) return
  const dilatation = runes?.dilatation ?? 0
  // Cible = plus haute menace (même logique que l'auto-attaque).
  let ti = alive[0]
  let best = -1
  for (const i of alive) {
    const d = info[i]!
    const dps = d.derived.power * d.derived.attacksPerSecond
    const score = (dps + 1) * d.passives.threatMult
    if (score > best) { best = score; ti = i }
  }
  // 🗼 Tour de garde : coup discret → redirection probabiliste vers le « garde ».
  const cond = info[ti]?.cond
  const split = tourGardeSplit(chars, ti, cond)
  if (split && Math.random() < split.frac) ti = split.tankI
  const t = chars[ti]
  const ctx = info[ti]!
  for (const ab of enemy.abilities) {
    if ((ab.cast ?? 0) > 0) {
      ab.cast = (ab.cast ?? 0) - dt
      if ((ab.cast ?? 0) <= 0) { ab.cast = 0; applyEnemyAbility(ab, enemy, t, ctx); ab.cd = ab.cooldown }
    } else {
      ab.cd = (ab.cd ?? ab.cooldown) - dt
      if (ab.cd <= 0) {
        if (ab.telegraph && ab.telegraph > 0) {
          // ⏳ Grain de sable : la PREMIÈRE incantation de chaque non-boss est interrompue net.
          if (runes?.grainDeSable && !enemy.boss && !enemy.interrupted) {
            enemy.interrupted = true
            ab.cd = ab.cooldown
            continue
          }
          ab.cast = ab.telegraph * (1 + dilatation)
        } else { applyEnemyAbility(ab, enemy, t, ctx); ab.cd = ab.cooldown }
      }
    }
  }
}

/** Décompte des statuts transitoires du héros (étourdissement, malédiction, DoT subis).
 *  v0.26 : minute aussi les fenêtres des gemmes (Fièvre, Testament, Verre trempé, Carapace,
 *  Goutte-à-goutte) et soigne au Garrot quand une altération expire. */
function tickHeroStatuses(chars: Character[], dt: number, cond?: CondMods, pact?: PactMods) {
  adaptiveTick(dt) // Égide : les stacks adaptatifs s'éventent (20 s glissantes)
  if (fievreLeft > 0) fievreLeft = Math.max(0, fievreLeft - dt)
  if (testamentLeft > 0) testamentLeft = Math.max(0, testamentLeft - dt)
  if (hateFunebreLeft > 0) hateFunebreLeft = Math.max(0, hateFunebreLeft - dt)
  for (const c of chars) {
    // 🤬 Pacte du Berserk : les PV sont capés (les soins au-delà s'évaporent).
    if (pact?.hpCap && c.hp > 0) c.hp = Math.min(c.hp, charMaxHp(c) * pact.hpCap)
    if (c.stun && c.stun > 0) c.stun = Math.max(0, c.stun - dt)
    if (c.weaken) { c.weaken.remaining -= dt; if (c.weaken.remaining <= 0) c.weaken = undefined }
    if ((c.invuln ?? 0) > 0) { c.invuln = Math.max(0, c.invuln! - dt); if ((c.invuln ?? 0) <= 0) c.invuln = undefined }
    if (c.frenzy) { c.frenzy.remaining -= dt; if (c.frenzy.remaining <= 0) c.frenzy = undefined }
    if ((c.overload ?? 0) > 0) { c.overload = Math.max(0, c.overload! - dt) || undefined } // ✨ Surcharge Arcaniste
    if ((c.chimera ?? 0) > 0) { c.chimera = Math.max(0, c.chimera! - dt) || undefined } // 🐲 Forme Chimère
    // 🌀 MÉTAMORPHE « Danse Primordiale » : rotation auto des formes + Instinct (momentum).
    const cmF = charCombatMods(c)
    if (cmF.shifter) {
      const interval = Math.max(2, 5 - cmF.shiftHaste)
      c.formClock = (c.formClock ?? interval) - dt
      if (c.formClock <= 0) {
        c.form = ((c.form ?? 0) + 1) % 3                                  // Fauve → Ours → Hibou → …
        c.formClock = interval
        c.instinct = Math.min(cmF.instinctMax, (c.instinct ?? 0) + 1)     // chaque métamorphose : +1 Instinct
      }
      c.instinct = Math.max(0, (c.instinct ?? 0) - 0.05 * dt)             // décroît à l'arrêt (l'auto-cycle le maintient)
    }
    if (c.charge) c.charge.remaining -= dt // la frappe différée est résolue dans le pas de combat
    // v0.26 : horloges par héros des gemmes de Bastion/Flux.
    verreTimer.set(c.id, (verreTimer.get(c.id) ?? 0) + dt)
    const ccd = carapaceCdMap.get(c.id)
    if (ccd && ccd > 0) carapaceCdMap.set(c.id, Math.max(0, ccd - dt))
    const scd = shieldCdMap.get(c.id)
    if (scd && scd > 0) shieldCdMap.set(c.id, Math.max(0, scd - dt))
    // 💧 Goutte-à-goutte : la réserve se déverse à 2% des PV max par seconde (coupée au Jeûne).
    const pool = hotPool.get(c.id) ?? 0
    if (pool > 0 && c.hp > 0 && !pact?.noHeal) {
      const mh = charMaxHp(c)
      const flow = Math.min(pool, mh * 0.02 * dt)
      c.hp = Math.min(mh, c.hp + flow)
      hotPool.set(c.id, pool - flow)
    }
    if (c.dots && c.dots.length) {
      let dmg = 0
      for (const d of c.dots) {
        let tickDmg = d.dps * dt
        // ◈ Bastion III : les DoT subis sont atténués.
        if (cond?.dotTakenMult) tickDmg *= cond.dotTakenMult
        dmg += tickDmg
        d.dealt = (d.dealt ?? 0) + tickDmg
        d.remaining -= dt
      }
      // 🪢 Garrot : une altération qui EXPIRE rend une part des dégâts qu'elle a infligés.
      if (cond?.garrotPct && c.hp > 0) {
        let heal = 0
        for (const d of c.dots) if (d.remaining <= 0) heal += (d.dealt ?? 0) * cond.garrotPct
        if (heal > 0) c.hp = Math.min(charMaxHp(c), c.hp + heal)
      }
      c.dots = c.dots.filter((d) => d.remaining > 0)
      if (c.dots.length === 0) c.dots = undefined
      if (dmg > 0 && c.hp > 0) c.hp = Math.max(0, c.hp - dmg)
    }
  }
}

/** Un pas de combat de l'équipe contre un ennemi. Renvoie l'état mis à jour. */
/** v0.35 — vitesse d'explosion des dégâts d'un MUR passé son enrage (fraction/s). Course au DPS. */
const MUR_ENRAGE_RAMP = 0.5
export function partyCombatStep(input: Character[], enemyIn: Enemy, dt: number, mods?: CombatMods) {
  const enemy: Enemy = { ...enemyIn, dot: enemyIn.dot ? { ...enemyIn.dot } : undefined, abilities: enemyIn.abilities?.map((a) => ({ ...a })) }
  const chars: Character[] = input.map((c) => ({ ...c, dots: c.dots?.map((d) => ({ ...d })), weaken: c.weaken ? { ...c.weaken } : undefined }))
  // Âge du combat : nourrit le Sablier de l'Acharné (gemme) et le Premier élan (rune de temps).
  enemy.age = (enemy.age ?? 0) + dt
  // 🔁 Boucle temporelle : toutes les N secondes, les recharges de l'équipe tombent à zéro.
  if (mods?.runes?.boucleEvery) {
    boucleAcc += dt
    if (boucleAcc >= mods.runes.boucleEvery) { boucleAcc = 0; resetAllCooldowns(chars) }
  }
  // Étoile d'Overkill : excédent du coup fatal, reporté sur l'ennemi suivant par l'appelant.
  let overkill = 0
  // Œil de l'Opportuniste : bonus pendant qu'une technique ennemie INCANTE (télégraphe visible).
  const enemyCasting = enemy.abilities?.some((a) => (a.cast ?? 0) > 0) ?? false
  const opportunisteMult = mods?.cond?.opportuniste && enemyCasting ? 1 + mods.cond.opportuniste : 1
  // v0.26 : qui était debout AVANT ce pas (⚓ Ancrage / 🎺 Marche / 📜 Testament).
  const aliveBefore = chars.map((c) => c.hp > 0)
  // Décompte des statuts transitoires (étourdissement, malédiction, DoT subis) avant d'agir.
  tickHeroStatuses(chars, dt, mods?.cond, mods?.pact)
  const info = chars.map((c) =>
    c.hp > 0
      ? {
          derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c),
          resist: charResist(c), cmods: charCombatMods(c),
          cond: mods?.cond, surge: mods?.content?.surge, aliveEnemies: 1, pact: mods?.pact,
          antidote: mods?.content?.antidote,
        }
      : null,
  )
  // ÉGIDE : aura partagée + stacks adaptatifs → résistances effectives.
  enrichResists(chars, info)
  // 🔮 Prisme d'accord : une part du profil de dégâts bascule vers le type du biome.
  if (mods?.cond?.prismePct && mods.content?.biomeType) {
    for (const d of info) if (d) d.profile = shiftProfile(d.profile, mods.content.biomeType, mods.cond.prismePct)
  }
  // 🧵 Pacte des Lignes ley : TOUT le profil bascule sur le type de l'arme (mono-élément).
  if (mods?.pact?.monoElement) {
    chars.forEach((c, i) => {
      const d = info[i]
      if (!d) return
      const base = c.equipment.armePrincipale?.damageType ?? 'physique'
      d.profile = { ...d.profile, profile: { [base]: 1 }, mainType: base }
    })
  }
  // v0.26 : premier tick face à cet ennemi → Égide rechargée, boucliers de départ, runes d'ouverture.
  if ((enemy.age ?? 0) <= dt + 1e-9) {
    gemFightStart(chars, info, mods?.cond)
    runeFightStart(chars, mods?.runes)
  }

  let totalDealt = 0

  // 1) Attaques automatiques (+ Multifrappe) + DoT (keystone). Les persos étourdis n'attaquent pas.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    // ⏱️ Premier élan + 🪽 Hâte funèbre : vitesse d'attaque dopée (runes de temps).
    const elanRune = mods?.runes?.premierElan && (enemy.age ?? 0) <= (mods.runes.premierElanDur ?? 10) ? 1 + mods.runes.premierElan : 1
    const hateRune = hateFunebreLeft > 0 && mods?.runes?.hateFunebre ? 1 + mods.runes.hateFunebre : 1
    const hits = d.derived.attacksPerSecond * elanRune * hateRune * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    // Malédiction (debuff ennemi) réduit les dégâts ; Frénésie (« Furie sanguinaire ») les amplifie.
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const acharne = mods?.cond?.acharneCap ? acharneMult(enemy.age ?? 0, mods.cond.acharneCap) : 1
    // 🫁 Second Souffle : le dos au mur (sous 30% PV) rend féroce.
    const souffle = mods?.cond?.souffle && hpFrac <= 0.3 ? 1 + mods.cond.souffle : 1
    // 🔪 ASSASSIN : fenêtre d'OUVERTURE (×mult les premières secondes face à cet ennemi).
    const opener = d.cmods.opener && (enemy.age ?? 0) <= d.cmods.opener.seconds ? d.cmods.opener.mult : 1
    // 🜍 PURGATEUR : le carburant d'affliction amplifie les dégâts.
    const fuel = fuelMult(c.id, d.cmods.afflictionFuel)
    // 🛡️ ÉGIDE « Gardien du seuil » : le surplus de résist face aux exigences devient des dégâts.
    const surplusMult = d.cmods.surplusToDamage > 0
      ? 1 + Math.min(d.cmods.surplusToDamage, (resistSurplus(enemy, d.resist) / RESIST_DSCALE) * d.cmods.surplusToDamage)
      : 1
    // v0.26 : 🎺 Marche, 📜 Testament, ⚡ Sous tension, 🪟 Verre trempé, 🧭 Boussole (champion)
    // + 🪦 Usure / 🩸 pactes (dégâts, autos, focus — l'ennemi unique EST le focus).
    const gemMult = gemOffenseMult(c, mods?.cond, enemy, false)
    const pactAuto = (mods?.pact?.autoMult ?? 1) * (1 + (mods?.pact?.focusBonus ?? 0))
    const runePact = runePactOffense(enemy.age ?? 0, mods?.runes, mods?.pact)
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult * (mods?.heroMult ?? 1) * acharne * souffle * opportunisteMult * opener * fuel * surplusMult * gemMult * pactAuto * runePact * formDamageMult(c, d.cmods)
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    const metroN = mods?.cond?.metronomeN
    // 🔁 Da capo : au-delà du seuil, les compteurs de RYTHME avancent ×2.
    const cStep = mods?.cond?.dacapoSec && (enemy.age ?? 0) > mods.cond.dacapoSec ? 2 : 1
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole && enemy.hp > 0; h++) {
      // 🎼 Métronome : toutes les N attaques auto, la suivante est un CRITIQUE garanti.
      let forceCrit = false
      if (metroN) {
        const mk = `metronome:${c.id}`
        const n = (gemCounters.get(mk) ?? 0) + cStep
        if (n >= metroN) { forceCrit = true; gemCounters.set(mk, 0) } else gemCounters.set(mk, n)
      }
      // 🪘 Cadence parfaite : toutes les N attaques, la suivante MULTIFRAPPE garantie.
      let forceMulti = false
      if (mods?.cond?.cadenceN) {
        const ck = `cad:${c.id}`
        const n = (gemCounters.get(ck) ?? 0) + cStep
        if (n >= mods.cond.cadenceN) { forceMulti = true; gemCounters.set(ck, 0) } else gemCounters.set(ck, n)
      }
      // 🥁 Tambour de siège : 8 coups sur la MÊME cible → Brèche (armure rongée 6 s).
      if (mods?.cond?.tambourPct) {
        const tk = `tam:${c.id}`
        const tt = `tamT:${c.id}`
        const tgtId = enemy.uid ?? 0
        if (gemCounters.get(tt) !== tgtId) { gemCounters.set(tt, tgtId); gemCounters.set(tk, 0) }
        const n = (gemCounters.get(tk) ?? 0) + cStep
        if (n >= 8) { enemy.sunder = { pct: mods.cond.tambourPct, remaining: 6 }; gemCounters.set(tk, 0) } else gemCounters.set(tk, n)
      }
      // ⚡ FOUDREUR « Décharge » : toutes les N attaques, la suivante frappe ×mult.
      let staticMult = 1
      if (d.cmods.staticN) {
        const sk = `static:${c.id}`
        const n = (gemCounters.get(sk) ?? 0) + 1
        if (n >= d.cmods.staticN.every) { staticMult = d.cmods.staticN.mult; gemCounters.set(sk, 0) } else gemCounters.set(sk, n)
      }
      // 🎻 Ostinato : la malchance se cumule en chance de critique.
      const ostK = `ost:${c.id}`
      const bonusCrit = mods?.cond?.ostinatoPer ? (gemCounters.get(ostK) ?? 0) * mods.cond.ostinatoPer : 0
      // Multifrappe : chance de déclencher un coup supplémentaire.
      const strikes = 1 + (forceMulti || Math.random() < multistrikeChance ? 1 : 0)
      for (let s = 0; s < strikes && enemy.hp > 0; s++) {
        const hit = rollHit(d.derived, d.profile, enemy, { bonusMult: bonusMult * d.cmods.autoTagMult, execute: d.cmods.execute, forceCrit: forceCrit && s === 0, bonusCrit })
        if (mods?.cond?.ostinatoPer && s === 0) gemCounters.set(ostK, hit.crit ? 0 : (gemCounters.get(ostK) ?? 0) + cStep)
        // 🩸 Hémorragie cadencée : tous les N critiques, une plaie s'ouvre.
        if (hit.crit && mods?.cond?.hemorragieN) {
          const hk = `hem:${c.id}`
          const n = (gemCounters.get(hk) ?? 0) + 1
          if (n >= mods.cond.hemorragieN) {
            enemy.dot = { dps: Math.max((hit.damage * 0.6 / 6) * d.derived.alterationMult, enemy.dot?.dps ?? 0), remaining: 6 }
            gemCounters.set(hk, 0)
          } else gemCounters.set(hk, n)
        }
        // 🔥 PYROMANCIEN « Embrasement » : un coup CRITIQUE pose/rafraîchit un DoT feu.
        if (hit.crit && d.cmods.igniteOnCrit) {
          enemy.dot = { dps: Math.max(hit.damage * d.cmods.igniteOnCrit.frac * d.derived.alterationMult, enemy.dot?.dps ?? 0), remaining: d.cmods.igniteOnCrit.duration }
        }
        // 🩸 FURIE « Enrage » (v0.34) : un coup CRITIQUE déclenche/rafraîchit l'Enrage (frenzy) — sans jamais downgrader une transe plus forte.
        if (hit.crit && d.cmods.enrageOnCrit) {
          const e = d.cmods.enrageOnCrit
          c.frenzy = { mult: Math.max(e.mult, c.frenzy?.mult ?? 0), remaining: Math.max(e.duration, c.frenzy?.remaining ?? 0) }
        }
        const dmg = hit.damage * enemyVuln(enemy) * (s === 0 ? staticMult : 1) // Sceau de faiblesse + Décharge
        if (mods?.cond?.overkill && dmg > enemy.hp) overkill += dmg - enemy.hp
        enemy.hp = Math.max(0, enemy.hp - dmg)
        totalDealt += dmg
        dealtThis += dmg
        healed += hit.heal
        // 🦷 Fièvre de l'hallali : fenêtre de vol de vie dopé après un kill.
        if (fievreLeft > 0 && mods?.cond?.fievreLeech) healed += dmg * mods.cond.fievreLeech
        if (d.cmods.dot) enemy.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac * d.derived.alterationMult, enemy.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
      }
    }
    // 🐾 INVOCATION : le familier inflige en continu une fraction de ton DPS d'auto-attaque.
    if (d.cmods.petDps > 0 && enemy.hp > 0) {
      // v0.34 SYMBIOSE : le familier hérite de tes stats (petBonus + Précision, BORNÉ) et suit ta marque (vuln).
      const petMult = (1 + d.cmods.petBonus + d.cmods.petFromPrecision * d.derived.precision) * (d.cmods.petBonus > 0 ? enemyVuln(enemy) : 1)
      const pet = theoreticalDps(d.derived, d.profile, d.cmods.damageMult) * d.cmods.petDps * petMult * dt
      enemy.hp = Math.max(0, enemy.hp - pet); dealtThis += pet
      // LIEN INSTINCTIF : le familier génère de la Concentration (combo) au fil du temps → alimente tes finisseurs.
      if (d.cmods.petCombo > 0) c.combo = Math.min(5 + d.cmods.comboCap, (c.combo ?? 0) + d.cmods.petCombo * dt)
    }
    if (c.charge) c.charge.dealt += dealtThis
    if (healed && !mods?.pact?.noHeal) gemLeechHeal(c, healed, mods?.cond) // 💧 l'excès est conservé
  })

  // ❄ CONTRÔLE : le gel/ralenti s'estompe.
  if ((enemy.controlled ?? 0) > 0) { enemy.controlled = Math.max(0, (enemy.controlled ?? 0) - dt) || undefined }

  // 2) Dégâts du DoT sur l'ennemi + décompte de ses statuts (vulnérabilité, anti-régén).
  // ⏩ Avance rapide (rune) : TES altérations tickent plus vite (mêmes dégâts totaux, compressés).
  const dotHaste = 1 + (mods?.runes?.avanceRapide ?? 0)
  if (enemy.dot && enemy.hp > 0) {
    const dmg = enemy.dot.dps * dt * dotHaste
    enemy.hp = Math.max(0, enemy.hp - dmg)
    totalDealt += dmg
    enemy.dot.remaining -= dt * dotHaste
    if (enemy.dot.remaining <= 0) enemy.dot = undefined
    // ☠ FAUCHEUR : les DoT te soignent (fraction du tick).
    chars.forEach((c, i) => {
      const d = info[i]
      if (d && c.hp > 0 && d.cmods.dotLeech > 0) c.hp = Math.min(charMaxHp(c), c.hp + dmg * d.cmods.dotLeech)
    })
    healDotParty(chars, info, dmg) // 🌗 COMMUNION D'OMBRE : les DoT soignent l'allié le plus blessé
  }
  if ((enemy.noRegen ?? 0) > 0) enemy.noRegen = Math.max(0, enemy.noRegen! - dt)
  if (enemy.vuln) { enemy.vuln.remaining -= dt; if (enemy.vuln.remaining <= 0) enemy.vuln = undefined }
  if (enemy.sunder) { enemy.sunder.remaining -= dt; if (enemy.sunder.remaining <= 0) enemy.sunder = undefined }

  // 3) Capacités actives (cooldown réduit par la Récupération). AUTO = auto-lancées ; MANUEL = sur tap
  //    (castPower) uniquement, lancement STRICT (si pas prêt, rien). Étourdi = on ne LANCE pas, mais
  //    les RECHARGES continuent de tourner (le CD se résorbe même étourdi).
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const stunned = (c.stun ?? 0) > 0
    // ARCANISTE « Surcharge » (v0.31) : pendant la fenêtre, recharges ×2 et dégâts de sorts ×mult.
    const overloadOn = (c.overload ?? 0) > 0 && !!d.cmods.overload
    const overloadMult = overloadOn ? d.cmods.overload!.mult : 1
    // v0.30 : le « deck » de combat = 5 actifs (auto/manuel) + 3 générateurs (auto pur, fabriquent la ressource).
    const deck: { pid: string; auto: boolean }[] = []
    c.powers.forEach((pid, slot) => { if (pid) deck.push({ pid, auto: c.powerAuto?.[slot] !== false }) })
    for (const gid of c.support ?? []) if (gid) deck.push({ pid: gid, auto: true })
    deck.forEach(({ pid, auto }) => {
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      const key = `${c.id}:${pid}`
      // ⌛ Sabliers liés (v0.26) : les recharges défilent plus vite pendant une incantation ennemie.
      const cdTick = dt * (1 + (enemyCasting && mods?.runes?.sabliers ? mods.runes.sabliers : 0)) * (overloadOn ? 2 : 1)
      const cd = (cooldowns.get(key) ?? 0) - cdTick
      if (cd <= 0 && !stunned && (auto || manualFire.has(key)) && autoSpenderReady(p, c, enemy, manualFire.has(key))) {
        // 🩸 Pacte sanglant : recharges raccourcies, mais chaque lancement coûte 2% des PV max.
        const pacte = mods?.cond?.pacteCdr ?? 0
        // 🛎️ Carillon (v0.26) : tous les N lancements, la recharge suivante est à moitié prix.
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr) * (1 - pacte) * carillonMult(mods?.cond))
        if (pacte > 0) c.hp = Math.max(1, c.hp - 0.02 * charMaxHp(c))
        manualFire.delete(key)
        // ⏳ CHRONOMANCIEN « Cascade temporelle » : chaque sort lancé rembourse les autres recharges.
        if (d.cmods.cdrOnCast > 0) {
          for (const pid2 of charDeck(c)) {
            if (!pid2 || pid2 === pid) continue
            const k2 = `${c.id}:${pid2}`
            cooldowns.set(k2, Math.max(0, (cooldowns.get(k2) ?? 0) - d.cmods.cdrOnCast))
          }
        }
        // Sorts : keystones + ×sorts + 🩸 pactes (Pacifiste, Verre) + 🪦 Usure/💀 Memento.
        lastCastGlobal = { charId: c.id, pid } // 🌀 Écho temporel : mémorise la dernière capacité
        const spellMult = d.cmods.damageMult * d.cmods.spellMult * overloadMult
          * (mods?.pact?.spellMult ?? 1) * runePactOffense(enemy.age ?? 0, mods?.runes, mods?.pact)
        const dealt = fireActive(p, c, d.derived, d.profile, chars, enemy, d.cmods.hot, spellMult, d.cmods.healToDamage, mods?.cond, mods?.pact)
        // Vengeance différée : compte AUSSI les dégâts des sorts dans le cumul.
        if (c.charge && dealt > 0) c.charge.dealt += dealt
        // 💥 Détonation arcanique : le compteur d'équipe avance (l'AoE ne joue qu'en pack — Multi).
        if (mods?.cond?.detonationN && dealt > 0) {
          const n = (gemCounters.get('deto') ?? 0) + 1
          gemCounters.set('deto', n >= mods.cond.detonationN ? 0 : n)
        }
        // 🔔 Pierre d'Écho : tous les N sorts de l'équipe, le suivant résonne une 2e fois (50%).
        const echoN = mods?.cond?.echoN
        if (echoN) {
          const n = (gemCounters.get('echo') ?? 0) + 1
          if (n >= echoN) {
            gemCounters.set('echo', 0)
            const echoDealt = fireActive(p, c, d.derived, d.profile, chars, enemy, d.cmods.hot, spellMult * 0.5, d.cmods.healToDamage * 0.5, mods?.cond, mods?.pact)
            if (c.charge && echoDealt > 0) c.charge.dealt += echoDealt
          } else gemCounters.set('echo', n)
        }
      } else {
        cooldowns.set(key, Math.max(0, cd))
        if (!auto && !stunned) manualFire.delete(key) // cast manuel strict : pas de file d'attente
      }
    })
  })

  // 3b) Vengeance différée : la fenêtre expirée, déchaîne ×mult TOUT le cumul (auto + sorts).
  for (const c of chars) {
    if (!c.charge || c.charge.remaining > 0) continue
    if (c.hp > 0 && enemy.hp > 0 && c.charge.dealt > 0) {
      const burst = c.charge.dealt * c.charge.mult * enemyVuln(enemy)
      enemy.hp = Math.max(0, enemy.hp - burst)
      totalDealt += burst
    }
    c.charge = undefined
  }

  // 4) L'ennemi frappe la plus haute menace (dégâts typés, réduits par la résistance héros).
  const alive = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
  if (enemy.hp > 0 && alive.length) {
    let targetI = alive[0]
    let best = -1
    for (const i of alive) {
      const d = info[i]!
      const dps = d.derived.power * d.derived.attacksPerSecond
      const score = (dps + 1) * d.passives.threatMult
      if (score > best) {
        best = score
        targetI = i
      }
    }
    const t = chars[targetI]
    const td = info[targetI]!
    // Étourdissement du boss (réduit par la Ténacité de la cible).
    if (enemy.ccDur) {
      enemy.ccCd = (enemy.ccCd ?? 0) - dt
      if (enemy.ccCd <= 0) {
        enemy.ccCd = CC_INTERVAL
        t.stun = Math.max(t.stun ?? 0, enemy.ccDur * (1 - td.derived.resilience))
      }
    }
    // 🧊 Stase (rune) : la montée en puissance ennemie est gelée les X premières secondes.
    const rampT = Math.max(0, (mods?.fightTime ?? 0) - (mods?.runes?.staseSec ?? 0))
    // v0.35 — ENRAGE DUR du MUR (boss de fin de Palier) : passé `mur.enrageAt`, les dégâts EXPLOSENT
    // (+50 %/s) → course au DPS, l'ossature du mur (DESIGN_v0.35 §6). Depuis `enemy.age` (pas de
    // compounding) ; sans effet sur le farm normal / les packs (pas de `mur`).
    const murAge = enemy.age ?? 0
    const murEnrage = enemy.mur && murAge > enemy.mur.enrageAt
      ? 1 + (murAge - enemy.mur.enrageAt) * MUR_ENRAGE_RAMP : 1
    let effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * rampT) * (mods?.dmgMult ?? 1) * murEnrage
    // 🫧 Latence (rune) : les ennemis frappent moins fort en début de combat.
    if (mods?.runes?.latence && (enemy.age ?? 0) <= 8) effDmg *= 1 - mods.runes.latence
    // L'atténuation générique (esquive/réduction/maîtrise + passives/keystones) est BORNÉE
    // dans incomingDps ; le multiplicateur d'exigence du type (v0.24) s'applique avant.
    let incoming = incomingDps(
      effDmg, enemy.damageType, td.derived, td.resist,
      enemyReq(enemy, enemy.damageType),
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
      td.cmods.reqReduction,
    ) * dt
    // Réfléchissant : CAPÉ à 10% des PV max de la cible par seconde — sinon un héros à très gros
    // DPS et petits PV se one-shotait lui-même (400k DPS vs 12k PV…).
    if (mods?.reflect) incoming += Math.min(totalDealt * mods.reflect, charMaxHp(t) * 0.10 * dt)
    // v0.26 : 🗼 Tour de garde — une part du flux part vers le plus endurant si la cible chancelle.
    const split = tourGardeSplit(chars, targetI, mods?.cond)
    const parts: [number, number][] = split ? [[targetI, 1 - split.frac], [split.tankI, split.frac]] : [[targetI, 1]]
    for (const [ci, frac] of parts) {
      const cc = chars[ci]
      const cd2 = info[ci]
      if (!cd2 || frac <= 0) continue
      // Chaîne défensive (🪨 Granit, ⚓ Ancrage, 💫 Sixième sens, 🌂 Paratonnerre) + 🍷 pactes + 🧴 antidote…
      const antid = mods?.content?.antidote
      const dmg = incoming * frac * (mods?.pact?.dmgIn ?? 1)
        * (antid && antid.type === enemy.damageType ? 1 - antid.pct : 1)
        * gemDefenseMult(cc, charMaxHp(cc), {
          cond: mods?.cond, casting: enemyCasting, surge: mods?.content?.surge, aliveEnemies: 1,
        })
      // …puis Bastion réactif (🔃 Échangeur, 🌵 Cilice) et immunité/bouclier d'absorption.
      const taken = gemDamageHero(cc, dmg, { cond: mods?.cond, attacker: enemy })
      // ÉGIDE « Aegis adaptatif » : être frappé par un type endurcit contre ce type.
      if (cd2.cmods.adaptiveResist && taken > 0) adaptiveAdd(cc.id, enemy.damageType, cd2.cmods.adaptiveResist.gain * dt, cd2.cmods.adaptiveResist.cap)
      // Épines (thorns) : renvoie une fraction de l'attaque à l'ennemi (basée sur le coup, bouclier inclus).
      if (cd2.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - dmg * cd2.cmods.thorns)
      // 🩸 VENGEANCE (v0.34, Juggernaut) : encaisser génère de la Rage (Combo) ∝ aux PV perdus.
      if (cd2.cmods.damageToRage > 0 && taken > 0) cc.combo = Math.min(5 + cd2.cmods.comboCap, (cc.combo ?? 0) + cd2.cmods.damageToRage * Math.min(0.3, taken / Math.max(1, charMaxHp(cc))) * 8)
    }
    // 🤺 Riposte mesurée : le temps sous le feu se mue en contre-attaques.
    totalDealt += gemRiposte(t, td, enemy, dt, mods?.cond)
    totalDealt += masteryRiposte(t, td, enemy, dt) // 🤺 Riposte de Maîtrise (bruiser Force)
  }

  // 4b) Techniques signature de l'ennemi (DoT/burst/CC/debuff/drain) sur la plus haute menace.
  tickEnemyAbilities(enemy, chars, info, dt, mods?.runes)
  // ⏪ Rembobinage (rune) : un héros au bord du gouffre récupère ses recharges (1×/combat).
  runeRembobinage(chars, mods?.runes)
  // 🌀 Écho temporel (rune) : toutes les 30 s, la dernière capacité est relancée gratuitement.
  if (mods?.runes?.echoTemporel) {
    echoTempAcc += dt
    if (echoTempAcc >= 30 && lastCastGlobal && enemy.hp > 0) {
      echoTempAcc = 0
      const ci = chars.findIndex((c) => c.id === lastCastGlobal!.charId && c.hp > 0)
      const d = ci >= 0 ? info[ci] : null
      const p = getPower(lastCastGlobal.pid)
      if (d && p && p.kind === 'active') {
        const dealt = fireActive(p, chars[ci], d.derived, d.profile, chars, enemy, d.cmods.hot,
          d.cmods.damageMult * d.cmods.spellMult * mods.runes.echoTemporel, 0, mods?.cond, mods?.pact)
        totalDealt += dealt
      }
    }
  }

  // 5) Régénération de l'ennemi (Vampirique) — annulée par « Hémorragie cosmique ».
  if (mods?.regen && enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 5b) 🕊️ Sursis : un héros qui vient de tomber survit à 25% PV (👑 Hubris : sans filet).
  const revived = applySursis(chars, mods?.pact?.noSursis ? undefined : mods?.runes?.sursisCd)
  // v0.26 : morts restantes → ⚓ Ancrage brisé, 🎺 Marche perdue, 📜 Testament, 💀 Memento.
  gemDeathEvents(chars, aliveBefore, mods?.cond, mods?.pact)

  // 6) Régénération des persos (+ bonus de régén + Métaboliseur d'Égide) + clamp.
  // v0.25.x — RELÈVE (farm uniquement, ce pas de combat ne sert qu'aux paliers) : un héros tombé
  // se relève après FARM_REZ_DELAY à 35% de ses PV. Avant, hors wipe d'équipe, un mort restait
  // mort pour toujours (la régén ne touchait que les vivants) — c'était le « perso pas rez ».
  const rezzed: string[] = []
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      let regen = mh * REGEN_RATE * regenMult // v0.38 — base = 0 (REGEN_RATE) ; ne reste que les sources additives (métaboliseur…)
      // 🛡️ ÉGIDE « Métaboliseur » : le surplus de résist face aux exigences devient du soin/s.
      if (d.cmods.surplusRegen > 0) {
        regen += mh * Math.min(d.cmods.surplusRegen, (resistSurplus(enemy, d.resist) / RESIST_DSCALE) * d.cmods.surplusRegen)
      }
      // 💉 Perfusion (v0.38) : sous 50% des PV, soin/s FORFAITAIRE (la Régén de base a disparu → plus de × sur 0).
      if (mods?.cond?.perfusionBonus && c.hp / mh < 0.5) regen += mh * mods.cond.perfusionBonus * 0.05
      // 🍽️ Jeûne / 🧛 Sang vicié : la régénération est coupée.
      if (mods?.pact?.noHeal || mods?.pact?.noRegen) regen = 0
      c.hp = Math.min(mh, c.hp + regen * dt)
    } else if (c.hp <= 0) {
      c.rez = (c.rez ?? 0) + dt
      if (c.rez >= FARM_REZ_DELAY) {
        c.hp = Math.round(charMaxHp(c) * 0.35)
        c.rez = undefined
        rezzed.push(c.name)
      }
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemy, anyAlive: chars.some((c) => c.hp > 0), totalDealt, overkill, revived, rezzed }
}

/**
 * Pas de combat de l'équipe contre PLUSIEURS ennemis simultanés (donjons en pack, raids avec adds).
 * - Les auto-attaques + capacités mono-cible concentrent le feu sur le 1er ennemi vivant (focus).
 * - Les capacités `cleave` touchent TOUS les ennemis vivants.
 * - CHAQUE ennemi vivant frappe la plus haute menace → un pack met l'équipe sous pression (survie de groupe).
 */
export function partyCombatStepMulti(input: Character[], enemiesIn: Enemy[], dt: number, mods?: CombatMods) {
  const enemies: Enemy[] = enemiesIn.map((e) => ({ ...e, dot: e.dot ? { ...e.dot } : undefined, abilities: e.abilities?.map((a) => ({ ...a })) }))
  const chars: Character[] = input.map((c) => ({ ...c, dots: c.dots?.map((d) => ({ ...d })), weaken: c.weaken ? { ...c.weaken } : undefined }))
  // Gemmes de condition : Cœur de Nuée (packs) + Sablier de l'Acharné (âge de la cible focus).
  const aliveAtStart = enemies.filter((e) => e.hp > 0).length
  const nuee = mods?.cond?.nueePer ? nueeMult(aliveAtStart, mods.cond.nueePer) : 1
  for (const e of enemies) if (e.hp > 0) e.age = (e.age ?? 0) + dt
  // 🔁 Boucle temporelle : toutes les N secondes, les recharges de l'équipe tombent à zéro.
  if (mods?.runes?.boucleEvery) {
    boucleAcc += dt
    if (boucleAcc >= mods.runes.boucleEvery) { boucleAcc = 0; resetAllCooldowns(chars) }
  }
  // Œil de l'Opportuniste : bonus tant qu'au moins un ennemi du pack INCANTE (télégraphe).
  const anyCasting = enemies.some((e) => e.hp > 0 && e.abilities?.some((a) => (a.cast ?? 0) > 0))
  const opportunisteMult = mods?.cond?.opportuniste && anyCasting ? 1 + mods.cond.opportuniste : 1
  // v0.26 : qui était debout AVANT ce pas (⚓ Ancrage / 🎺 Marche / 📜 Testament).
  const aliveBefore = chars.map((c) => c.hp > 0)
  tickHeroStatuses(chars, dt, mods?.cond, mods?.pact)
  const info = chars.map((c) =>
    c.hp > 0
      ? {
          derived: charDerived(c), profile: charDamageProfile(c), passives: charPassives(c),
          resist: charResist(c), cmods: charCombatMods(c),
          cond: mods?.cond, surge: mods?.content?.surge, aliveEnemies: aliveAtStart, pact: mods?.pact,
          antidote: mods?.content?.antidote,
        }
      : null,
  )
  // ÉGIDE : aura partagée + stacks adaptatifs → résistances effectives.
  enrichResists(chars, info)
  // 🏅 Trophée de guerre (v0.26) : en raid, des points de résistance offerts à toute l'équipe.
  if (mods?.content?.resistBonus) {
    for (const d of info) {
      if (!d) continue
      const merged: Partial<Record<DamageType, number>> = { ...d.resist }
      for (const t of DAMAGE_TYPE_LIST) merged[t] = (merged[t] ?? 0) + mods.content.resistBonus
      d.resist = merged
    }
  }
  // 🧵 Pacte des Lignes ley : TOUT le profil bascule sur le type de l'arme (mono-élément).
  if (mods?.pact?.monoElement) {
    chars.forEach((c, i) => {
      const d = info[i]
      if (!d) return
      const base = c.equipment.armePrincipale?.damageType ?? 'physique'
      d.profile = { ...d.profile, profile: { [base]: 1 }, mainType: base }
    })
  }
  // v0.26 : premier tick de la RENCONTRE → Égide rechargée, boucliers de départ, runes d'ouverture.
  if ((mods?.fightTime ?? 99) <= dt + 1e-9) {
    gemFightStart(chars, info, mods?.cond)
    runeFightStart(chars, mods?.runes)
  }
  let totalDealt = 0
  const focus = (): Enemy | undefined => enemies.find((e) => e.hp > 0)

  // 1) Auto-attaques (+ Multifrappe) sur la cible focus + DoT keystone. Étourdi = pas d'attaque.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d || (c.stun ?? 0) > 0) return
    // ⏱️ Premier élan + 🪽 Hâte funèbre : vitesse d'attaque dopée (runes de temps).
    const elanRune = mods?.runes?.premierElan && (mods?.fightTime ?? 99) <= (mods.runes.premierElanDur ?? 10) ? 1 + mods.runes.premierElan : 1
    const hateRune = hateFunebreLeft > 0 && mods?.runes?.hateFunebre ? 1 + mods.runes.hateFunebre : 1
    const hits = d.derived.attacksPerSecond * elanRune * hateRune * dt
    const whole = Math.floor(hits) + (Math.random() < hits % 1 ? 1 : 0)
    const hpFrac = c.hp / charMaxHp(c)
    const lowHp = d.cmods.lowHp && hpFrac <= d.cmods.lowHp.threshold ? d.cmods.lowHp.mult : 1
    const highHp = d.cmods.highHp && hpFrac >= d.cmods.highHp.threshold ? d.cmods.highHp.mult : 1
    const weakenMult = c.weaken ? c.weaken.mult : 1
    const frenzyMult = c.frenzy && c.frenzy.remaining > 0 ? c.frenzy.mult : 1
    const acharne = mods?.cond?.acharneCap ? acharneMult(focus()?.age ?? 0, mods.cond.acharneCap) : 1
    // 🫁 Second Souffle : sous 30% PV, le héros frappe plus fort.
    const souffle = mods?.cond?.souffle && hpFrac <= 0.3 ? 1 + mods.cond.souffle : 1
    // 🔪 ASSASSIN : fenêtre d'OUVERTURE face à la cible focus (l'âge est par ennemi).
    const opener = d.cmods.opener && (focus()?.age ?? 99) <= d.cmods.opener.seconds ? d.cmods.opener.mult : 1
    // 🜍 PURGATEUR : carburant d'affliction. 🌋 BRISEUR : +dégâts par ennemi vivant.
    const fuel = fuelMult(c.id, d.cmods.afflictionFuel)
    const perEnemy = 1 + d.cmods.perEnemyBonus * Math.max(0, aliveAtStart - 1)
    // 🛡️ ÉGIDE « Gardien du seuil » : surplus de résist face à la cible focus → dégâts.
    const fTarget = focus()
    const surplusMult = d.cmods.surplusToDamage > 0 && fTarget
      ? 1 + Math.min(d.cmods.surplusToDamage, (resistSurplus(fTarget, d.resist) / RESIST_DSCALE) * d.cmods.surplusToDamage)
      : 1
    // v0.26 : 🎺 Marche, 📜 Testament, ⚡ Sous tension, 🪟 Verre trempé, 🧭 Boussole (champion),
    // 🎯 Première impression (le premier ennemi du pack, packs de 2+).
    const fTarget0 = focus()
    const firstOfPack = aliveAtStart >= 2 && !!fTarget0 && fTarget0 === enemies[0]
    const gemMult = gemOffenseMult(c, mods?.cond, fTarget0, firstOfPack)
    // 🩸 Pactes : autos (Pacifiste), bonus focus (Duelliste — les autos frappent le focus),
    // dégâts globaux (Verre, Meute…) + 🪦 Usure / 💀 Memento.
    const pactAuto = (mods?.pact?.autoMult ?? 1) * (1 + (mods?.pact?.focusBonus ?? 0))
    const runePact = runePactOffense(mods?.fightTime ?? 0, mods?.runes, mods?.pact)
    const bonusMult = d.cmods.damageMult * lowHp * highHp * weakenMult * frenzyMult * (mods?.heroMult ?? 1) * nuee * acharne * souffle * opportunisteMult * opener * fuel * perEnemy * surplusMult * gemMult * pactAuto * runePact * formDamageMult(c, d.cmods)
    const multistrikeChance = Math.min(0.85, d.derived.multistrike + d.cmods.multistrike)
    const metroN = mods?.cond?.metronomeN
    // 🔁 Da capo : au-delà du seuil de la RENCONTRE, les compteurs de RYTHME avancent ×2.
    const cStep = mods?.cond?.dacapoSec && (mods?.fightTime ?? 0) > mods.cond.dacapoSec ? 2 : 1
    let healed = 0
    let dealtThis = 0
    for (let h = 0; h < whole; h++) {
      const target = focus()
      if (!target) break
      // 🎼 Métronome : critique garanti toutes les N attaques auto.
      let forceCrit = false
      if (metroN) {
        const mk = `metronome:${c.id}`
        const n = (gemCounters.get(mk) ?? 0) + cStep
        if (n >= metroN) { forceCrit = true; gemCounters.set(mk, 0) } else gemCounters.set(mk, n)
      }
      // 🪘 Cadence parfaite : toutes les N attaques, la suivante MULTIFRAPPE garantie.
      let forceMulti = false
      if (mods?.cond?.cadenceN) {
        const ck = `cad:${c.id}`
        const n = (gemCounters.get(ck) ?? 0) + cStep
        if (n >= mods.cond.cadenceN) { forceMulti = true; gemCounters.set(ck, 0) } else gemCounters.set(ck, n)
      }
      // 🥁 Tambour de siège : 8 coups sur la MÊME cible → Brèche (armure rongée 6 s).
      if (mods?.cond?.tambourPct) {
        const tk = `tam:${c.id}`
        const tt = `tamT:${c.id}`
        const tgtId = target.uid ?? enemies.indexOf(target)
        if (gemCounters.get(tt) !== tgtId) { gemCounters.set(tt, tgtId); gemCounters.set(tk, 0) }
        const n = (gemCounters.get(tk) ?? 0) + cStep
        if (n >= 8) { target.sunder = { pct: mods.cond.tambourPct, remaining: 6 }; gemCounters.set(tk, 0) } else gemCounters.set(tk, n)
      }
      // ⚡ FOUDREUR « Décharge » : toutes les N attaques, la suivante frappe ×mult.
      let staticMult = 1
      if (d.cmods.staticN) {
        const sk = `static:${c.id}`
        const n = (gemCounters.get(sk) ?? 0) + 1
        if (n >= d.cmods.staticN.every) { staticMult = d.cmods.staticN.mult; gemCounters.set(sk, 0) } else gemCounters.set(sk, n)
      }
      // 🎻 Ostinato : la malchance se cumule en chance de critique.
      const ostK = `ost:${c.id}`
      const bonusCrit = mods?.cond?.ostinatoPer ? (gemCounters.get(ostK) ?? 0) * mods.cond.ostinatoPer : 0
      const strikes = 1 + (forceMulti || Math.random() < multistrikeChance ? 1 : 0)
      for (let st = 0; st < strikes; st++) {
        const t2 = focus()
        if (!t2) break
        const hit = rollHit(d.derived, d.profile, t2, { bonusMult: bonusMult * d.cmods.autoTagMult, execute: d.cmods.execute, forceCrit: forceCrit && st === 0, bonusCrit })
        if (mods?.cond?.ostinatoPer && st === 0) gemCounters.set(ostK, hit.crit ? 0 : (gemCounters.get(ostK) ?? 0) + cStep)
        // 🩸 Hémorragie cadencée : tous les N critiques, une plaie s'ouvre.
        if (hit.crit && mods?.cond?.hemorragieN) {
          const hk = `hem:${c.id}`
          const n = (gemCounters.get(hk) ?? 0) + 1
          if (n >= mods.cond.hemorragieN) {
            t2.dot = { dps: Math.max((hit.damage * 0.6 / 6) * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: 6 }
            gemCounters.set(hk, 0)
          } else gemCounters.set(hk, n)
        }
        // 🔥 PYROMANCIEN « Embrasement » : un coup CRITIQUE pose/rafraîchit un DoT feu.
        if (hit.crit && d.cmods.igniteOnCrit) {
          t2.dot = { dps: Math.max(hit.damage * d.cmods.igniteOnCrit.frac * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: d.cmods.igniteOnCrit.duration }
        }
        // 🩸 FURIE « Enrage » (v0.34) : un coup CRITIQUE déclenche/rafraîchit l'Enrage (frenzy).
        if (hit.crit && d.cmods.enrageOnCrit) {
          const e = d.cmods.enrageOnCrit
          c.frenzy = { mult: Math.max(e.mult, c.frenzy?.mult ?? 0), remaining: Math.max(e.duration, c.frenzy?.remaining ?? 0) }
        }
        const dmg = hit.damage * enemyVuln(t2) * (st === 0 ? staticMult : 1)
        // Étoile d'Overkill : l'excédent du coup fatal déborde sur les ennemis suivants du pack
        // (hors totalDealt → n'alimente pas le Réfléchissant).
        if (mods?.cond?.overkill && dmg > t2.hp) {
          let left = dmg - t2.hp
          t2.hp = 0
          while (left > 0) {
            const nx = focus()
            if (!nx) break
            const absorbed = Math.min(left, nx.hp)
            nx.hp -= absorbed
            left -= absorbed
          }
        }
        t2.hp = Math.max(0, t2.hp - dmg)
        totalDealt += dmg
        dealtThis += dmg
        healed += hit.heal
        // 🦷 Fièvre de l'hallali : fenêtre de vol de vie dopé après un kill.
        if (fievreLeft > 0 && mods?.cond?.fievreLeech) healed += dmg * mods.cond.fievreLeech
        if (d.cmods.dot) {
          t2.dot = { dps: Math.max(hit.damage * d.cmods.dot.frac * d.derived.alterationMult, t2.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
          // 🦠 PESTIFÉRÉ « Pandémie » : la peste s'applique aussi au reste du pack (fraction).
          if (d.cmods.dotAoe > 0) {
            const spread = hit.damage * d.cmods.dot.frac * d.derived.alterationMult * d.cmods.dotAoe
            for (const e of enemies) {
              if (e === t2 || e.hp <= 0) continue
              e.dot = { dps: Math.max(spread, e.dot?.dps ?? 0), remaining: d.cmods.dot.duration }
            }
          }
        }
        // 🌋 BRISEUR « Onde de choc » + ⚡ FOUDREUR « Foudre en chaîne » : éclaboussures sur le pack
        // (🤺 Duelliste : les coups hors focus sont amoindris).
        if ((d.cmods.cleaveAuto > 0 || d.cmods.chainArc) && dmg > 0) {
          let arcLeft = d.cmods.chainArc?.targets ?? 0
          const offFocus = mods?.pact?.offFocusMult ?? 1
          for (const e of enemies) {
            if (e === t2 || e.hp <= 0) continue
            let frac = d.cmods.cleaveAuto
            if (arcLeft > 0 && d.cmods.chainArc) { frac = Math.max(frac, d.cmods.chainArc.frac); arcLeft-- }
            if (frac <= 0) break
            const splash = dmg * frac * offFocus
            e.hp = Math.max(0, e.hp - splash)
            totalDealt += splash
            dealtThis += splash
          }
        }
      }
    }
    // 🐾 INVOCATION : le familier frappe la cible focus, en continu.
    if (d.cmods.petDps > 0) {
      const f = focus()
      if (f && f.hp > 0) {
        const petMult = (1 + d.cmods.petBonus + d.cmods.petFromPrecision * d.derived.precision) * (d.cmods.petBonus > 0 ? enemyVuln(f) : 1)
        const pet = theoreticalDps(d.derived, d.profile, d.cmods.damageMult) * d.cmods.petDps * petMult * dt
        f.hp = Math.max(0, f.hp - pet); dealtThis += pet
        if (d.cmods.petCombo > 0) c.combo = Math.min(5 + d.cmods.comboCap, (c.combo ?? 0) + d.cmods.petCombo * dt)
      }
    }
    if (c.charge) c.charge.dealt += dealtThis
    if (healed && !mods?.pact?.noHeal) gemLeechHeal(c, healed, mods?.cond) // 💧 l'excès est conservé
  })

  // 2) DoT par ennemi + décompte de ses statuts (vulnérabilité, anti-régén, Brèche).
  // ⏩ Avance rapide (rune) : TES altérations tickent plus vite (compressées, mêmes dégâts totaux).
  const dotHaste = 1 + (mods?.runes?.avanceRapide ?? 0)
  for (const enemy of enemies) {
    if ((enemy.controlled ?? 0) > 0) enemy.controlled = Math.max(0, (enemy.controlled ?? 0) - dt) || undefined // ❄ contrôle s'estompe
    if (enemy.dot && enemy.hp > 0) {
      const dmg = enemy.dot.dps * dt * dotHaste
      enemy.hp = Math.max(0, enemy.hp - dmg)
      totalDealt += dmg
      enemy.dot.remaining -= dt * dotHaste
      if (enemy.dot.remaining <= 0) enemy.dot = undefined
      // ☠ FAUCHEUR : les DoT te soignent (fraction du tick).
      chars.forEach((c, i) => {
        const d = info[i]
        if (d && c.hp > 0 && d.cmods.dotLeech > 0) c.hp = Math.min(charMaxHp(c), c.hp + dmg * d.cmods.dotLeech)
      })
      healDotParty(chars, info, dmg) // 🌗 COMMUNION D'OMBRE
    }
    if ((enemy.noRegen ?? 0) > 0) enemy.noRegen = Math.max(0, enemy.noRegen! - dt)
    if (enemy.vuln) { enemy.vuln.remaining -= dt; if (enemy.vuln.remaining <= 0) enemy.vuln = undefined }
    if (enemy.sunder) { enemy.sunder.remaining -= dt; if (enemy.sunder.remaining <= 0) enemy.sunder = undefined }
  }

  // 3) Actives : `cleave`/AoE touchent TOUS les ennemis, le reste la cible focus. Étourdi = on ne
  //    LANCE pas, mais les RECHARGES continuent de tourner.
  chars.forEach((c, i) => {
    const d = info[i]
    if (!d) return
    const stunned = (c.stun ?? 0) > 0
    // ARCANISTE « Surcharge » (v0.31) : pendant la fenêtre, recharges ×2 et dégâts de sorts ×mult.
    const overloadOn = (c.overload ?? 0) > 0 && !!d.cmods.overload
    const overloadMult = overloadOn ? d.cmods.overload!.mult : 1
    // v0.30 : deck = 5 actifs (auto/manuel) + 3 générateurs (auto pur).
    const deck: { pid: string; auto: boolean }[] = []
    c.powers.forEach((pid, slot) => { if (pid) deck.push({ pid, auto: c.powerAuto?.[slot] !== false }) })
    for (const gid of c.support ?? []) if (gid) deck.push({ pid: gid, auto: true })
    deck.forEach(({ pid, auto }) => {
      const p = getPower(pid)
      if (!p || p.kind !== 'active') return
      const key = `${c.id}:${pid}`
      // ⌛ Sabliers liés (v0.26) : les recharges défilent plus vite pendant une incantation ennemie.
      const cdTick = dt * (1 + (anyCasting && mods?.runes?.sabliers ? mods.runes.sabliers : 0)) * (overloadOn ? 2 : 1)
      const cd = (cooldowns.get(key) ?? 0) - cdTick
      if (cd <= 0 && !stunned && (auto || manualFire.has(key)) && autoSpenderReady(p, c, focus(), manualFire.has(key))) {
        // 🩸 Pacte sanglant : recharges raccourcies contre 2% des PV max par lancement.
        const pacte = mods?.cond?.pacteCdr ?? 0
        // 🛎️ Carillon (v0.26) : tous les N lancements, la recharge suivante est à moitié prix.
        cooldowns.set(key, (p.cooldown ?? 3) * (1 - d.derived.cdr) * (1 - pacte) * carillonMult(mods?.cond))
        if (pacte > 0) c.hp = Math.max(1, c.hp - 0.02 * charMaxHp(c))
        manualFire.delete(key)
        // ⏳ CHRONOMANCIEN « Cascade temporelle » : chaque sort lancé rembourse les autres recharges.
        if (d.cmods.cdrOnCast > 0) {
          for (const pid2 of charDeck(c)) {
            if (!pid2 || pid2 === pid) continue
            const k2 = `${c.id}:${pid2}`
            cooldowns.set(k2, Math.max(0, (cooldowns.get(k2) ?? 0) - d.cmods.cdrOnCast))
          }
        }
        lastCastGlobal = { charId: c.id, pid } // 🌀 Écho temporel : mémorise la dernière capacité
        const cast = (mult: number): number => {
          let dd = 0
          // 🩸 Pactes : ×sorts (Pacifiste), dégâts globaux + 🪦 Usure / 💀 Memento.
          const sm = d.cmods.damageMult * d.cmods.spellMult * mult * overloadMult
            * (mods?.pact?.spellMult ?? 1) * runePactOffense(mods?.fightTime ?? 0, mods?.runes, mods?.pact)
          if (p.effect === 'cleave' || p.effect === 'megaCleave') {
            const offFocus = mods?.pact?.offFocusMult ?? 1
            const f0 = focus()
            for (const e of enemies) if (e.hp > 0) dd += fireActive(p, c, d.derived, d.profile, chars, e, d.cmods.hot, sm * (e === f0 ? 1 : offFocus), d.cmods.healToDamage, mods?.cond, mods?.pact)
          } else {
            dd = fireActive(p, c, d.derived, d.profile, chars, focus() ?? enemies[0], d.cmods.hot, sm * (1 + (mods?.pact?.focusBonus ?? 0)), d.cmods.healToDamage, mods?.cond, mods?.pact)
          }
          return dd
        }
        let dealt = cast(1)
        // 💥 Détonation arcanique (v0.26) : tous les N sorts, celui-ci éclabousse le pack (50%).
        if (mods?.cond?.detonationN && dealt > 0) {
          const n = (gemCounters.get('deto') ?? 0) + 1
          if (n >= mods.cond.detonationN) {
            gemCounters.set('deto', 0)
            const t0 = focus()
            const splash = dealt * 0.5
            for (const e of enemies) {
              if (e === t0 || e.hp <= 0) continue
              e.hp = Math.max(0, e.hp - splash)
              totalDealt += splash
              dealt += splash
            }
          } else gemCounters.set('deto', n)
        }
        // 🔔 Pierre d'Écho : tous les N sorts de l'équipe, le suivant résonne une 2e fois (50%).
        const echoN = mods?.cond?.echoN
        if (echoN) {
          const n = (gemCounters.get('echo') ?? 0) + 1
          if (n >= echoN) { gemCounters.set('echo', 0); dealt += cast(0.5) } else gemCounters.set('echo', n)
        }
        if (c.charge && dealt > 0) c.charge.dealt += dealt
      } else {
        cooldowns.set(key, Math.max(0, cd))
        if (!auto && !stunned) manualFire.delete(key)
      }
    })
  })

  // 3b) Vengeance différée : la fenêtre expirée, déchaîne ×mult TOUT le cumul, sur la cible focus.
  for (const c of chars) {
    if (!c.charge || c.charge.remaining > 0) continue
    const tg = focus()
    if (c.hp > 0 && tg && c.charge.dealt > 0) {
      const burst = c.charge.dealt * c.charge.mult * enemyVuln(tg)
      tg.hp = Math.max(0, tg.hp - burst)
      totalDealt += burst
    }
    c.charge = undefined
  }

  // 4) Chaque ennemi vivant frappe la plus haute menace (l'équipe doit survivre au pack).
  let reflectApplied = false
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue
    const liveNow = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
    if (!liveNow.length) break
    let targetI = liveNow[0]
    let best = -1
    for (const i of liveNow) {
      const d = info[i]!
      const dps = d.derived.power * d.derived.attacksPerSecond
      const score = (dps + 1) * d.passives.threatMult
      if (score > best) { best = score; targetI = i }
    }
    const t = chars[targetI]
    const td = info[targetI]!
    // Étourdissement (boss) réduit par la Ténacité de la cible.
    if (enemy.ccDur) {
      enemy.ccCd = (enemy.ccCd ?? 0) - dt
      if (enemy.ccCd <= 0) {
        enemy.ccCd = CC_INTERVAL
        t.stun = Math.max(t.stun ?? 0, enemy.ccDur * (1 - td.derived.resilience))
      }
    }
    // 🧊 Stase (rune) : la montée en puissance ennemie est gelée les X premières secondes.
    const rampT = Math.max(0, (mods?.fightTime ?? 0) - (mods?.runes?.staseSec ?? 0))
    // v0.35 — ENRAGE DUR du MUR (boss de fin de Palier) : passé `mur.enrageAt`, les dégâts EXPLOSENT
    // (+50 %/s) → course au DPS, l'ossature du mur (DESIGN_v0.35 §6). Depuis `enemy.age` (pas de
    // compounding) ; sans effet sur le farm normal / les packs (pas de `mur`).
    const murAge = enemy.age ?? 0
    const murEnrage = enemy.mur && murAge > enemy.mur.enrageAt
      ? 1 + (murAge - enemy.mur.enrageAt) * MUR_ENRAGE_RAMP : 1
    let effDmg = enemy.damage * (1 + (mods?.enrage ?? 0) * rampT) * (mods?.dmgMult ?? 1) * murEnrage
    // 🫧 Latence (rune) : les ennemis frappent moins fort en début de rencontre.
    if (mods?.runes?.latence && (mods?.fightTime ?? 99) <= 8) effDmg *= 1 - mods.runes.latence
    let incoming = incomingDps(
      effDmg, enemy.damageType, td.derived, td.resist,
      enemyReq(enemy, enemy.damageType),
      (1 - td.passives.damageReduction) * (1 - td.cmods.flatDr),
      td.cmods.reqReduction,
    ) * dt
    // Même cap que le combat mono-cible : le renvoi ne dépasse jamais 10% des PV max/s.
    if (mods?.reflect && !reflectApplied) { incoming += Math.min(totalDealt * mods.reflect, charMaxHp(t) * 0.10 * dt); reflectApplied = true }
    // v0.26 : 🗼 Tour de garde — une part du flux part vers le plus endurant si la cible chancelle.
    const aliveE = enemies.filter((e) => e.hp > 0).length
    const split = tourGardeSplit(chars, targetI, mods?.cond)
    const parts: [number, number][] = split ? [[targetI, 1 - split.frac], [split.tankI, split.frac]] : [[targetI, 1]]
    for (const [ci, frac] of parts) {
      const cc = chars[ci]
      const cd2 = info[ci]
      if (!cd2 || frac <= 0) continue
      // Chaîne défensive (🧱 Rempart, 🪨 Granit, ⚓ Ancrage, 💫 Sixième sens, 🌂 Paratonnerre)
      // + 🍷 pactes + 🧴 antidote…
      const antid = mods?.content?.antidote
      const dmg = incoming * frac * (mods?.pact?.dmgIn ?? 1)
        * (antid && antid.type === enemy.damageType ? 1 - antid.pct : 1)
        * gemDefenseMult(cc, charMaxHp(cc), {
          cond: mods?.cond, casting: anyCasting, surge: mods?.content?.surge, aliveEnemies: aliveE,
        })
      // …puis Bastion réactif (🔃 Échangeur, 🌵 Cilice) et immunité/bouclier d'absorption.
      const taken = gemDamageHero(cc, dmg, { cond: mods?.cond, attacker: enemy })
      // ÉGIDE « Aegis adaptatif » : être frappé par un type endurcit contre ce type.
      if (cd2.cmods.adaptiveResist && taken > 0) adaptiveAdd(cc.id, enemy.damageType, cd2.cmods.adaptiveResist.gain * dt, cd2.cmods.adaptiveResist.cap)
      if (cd2.cmods.thorns > 0 && enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - dmg * cd2.cmods.thorns)
      // 🩸 VENGEANCE (v0.34, Juggernaut) : encaisser génère de la Rage (Combo) ∝ aux PV perdus.
      if (cd2.cmods.damageToRage > 0 && taken > 0) cc.combo = Math.min(5 + cd2.cmods.comboCap, (cc.combo ?? 0) + cd2.cmods.damageToRage * Math.min(0.3, taken / Math.max(1, charMaxHp(cc))) * 8)
    }
    // Techniques signature de CET ennemi (sur la plus haute menace).
    tickEnemyAbilities(enemy, chars, info, dt, mods?.runes)
  }
  // ⏪ Rembobinage (rune) : un héros au bord du gouffre récupère ses recharges (1×/combat).
  runeRembobinage(chars, mods?.runes)
  // 🌀 Écho temporel (rune) : toutes les 30 s, la dernière capacité est relancée gratuitement.
  if (mods?.runes?.echoTemporel) {
    echoTempAcc += dt
    const ft = focus()
    if (echoTempAcc >= 30 && lastCastGlobal && ft) {
      echoTempAcc = 0
      const ci = chars.findIndex((c) => c.id === lastCastGlobal!.charId && c.hp > 0)
      const d = ci >= 0 ? info[ci] : null
      const p = getPower(lastCastGlobal.pid)
      if (d && p && p.kind === 'active') {
        totalDealt += fireActive(p, chars[ci], d.derived, d.profile, chars, ft, d.cmods.hot,
          d.cmods.damageMult * d.cmods.spellMult * mods.runes.echoTemporel, 0, mods?.cond, mods?.pact)
      }
    }
  }

  // 4c) 🤺 Riposte mesurée (v0.26) : le temps sous le feu du pack se mue en contre-attaques (focus).
  if (mods?.cond?.riposteSec) {
    const liveNow = chars.map((_, i) => i).filter((i) => chars[i].hp > 0 && info[i])
    const ft = focus()
    if (liveNow.length && ft) {
      let ti2 = liveNow[0]
      let best2 = -1
      for (const i of liveNow) {
        const d = info[i]!
        const score = (d.derived.power * d.derived.attacksPerSecond + 1) * d.passives.threatMult
        if (score > best2) { best2 = score; ti2 = i }
      }
      totalDealt += gemRiposte(chars[ti2], info[ti2]!, ft, dt, mods?.cond)
      totalDealt += masteryRiposte(chars[ti2], info[ti2]!, ft, dt) // 🤺 Riposte de Maîtrise (bruiser Force)
    }
  }

  // 5) Régénération ennemie (Vampirique/Sangsue) — annulée par « Hémorragie cosmique ».
  if (mods?.regen) for (const enemy of enemies) if (enemy.hp > 0 && (enemy.noRegen ?? 0) <= 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * mods.regen * dt)

  // 5b) 🕊️ Sursis : un héros qui vient de tomber survit à 25% PV (👑 Hubris : sans filet).
  const revived = applySursis(chars, mods?.pact?.noSursis ? undefined : mods?.runes?.sursisCd)
  // v0.26 : morts restantes → ⚓ Ancrage brisé, 🎺 Marche perdue, 📜 Testament, 💀 Memento.
  gemDeathEvents(chars, aliveBefore, mods?.cond, mods?.pact)

  // 6) Régénération des persos (+ Métaboliseur d'Égide face à la cible focus) + clamp.
  chars.forEach((c, i) => {
    const d = info[i]
    if (c.hp > 0 && d) {
      const mh = charMaxHp(c)
      // v0.27 (Lot 3) « Mal de l'abîme » : la régén de base est BRIDÉE en raid (content.regenMult)
      // → la vie redevient une ressource, fini le tank qui out-régène tout sans bouger.
      let regen = mh * REGEN_RATE * regenMult * (mods?.content?.regenMult ?? 1) // v0.38 — base = 0 (REGEN_RATE) ; sources additives uniquement
      const ft = focus()
      if (d.cmods.surplusRegen > 0 && ft) {
        regen += mh * Math.min(d.cmods.surplusRegen, (resistSurplus(ft, d.resist) / RESIST_DSCALE) * d.cmods.surplusRegen)
      }
      // 💉 Perfusion (v0.38) : sous 50% des PV, soin/s FORFAITAIRE (la Régén de base a disparu → plus de × sur 0).
      if (mods?.cond?.perfusionBonus && c.hp / mh < 0.5) regen += mh * mods.cond.perfusionBonus * 0.05
      // v0.27 (Lot 3) « Blessures mortelles » : pendant la fenêtre de heal-cut (posée par la Nova),
      // la régén s'effondre → un tank ne peut plus éponger juste après une Nova.
      if ((c.healCut ?? 0) > 0) { regen *= HEALCUT_REGEN_MULT; c.healCut = Math.max(0, (c.healCut ?? 0) - dt) }
      // 🍽️ Jeûne / 🧛 Sang vicié : la régénération est coupée.
      if (mods?.pact?.noHeal || mods?.pact?.noRegen) regen = 0
      c.hp = Math.min(mh, c.hp + regen * dt)
    }
    if (c.hp < 0) c.hp = 0
  })

  return { chars, enemies, anyAlive: chars.some((c) => c.hp > 0), totalDealt, revived }
}


// ---- API pour le store (sites d'action) ----
/** 🎯 Demande de lancement MANUEL d'une capacité (posée par castPower, consommée au prochain tick). */
export function requestManualCast(charId: string, pid: string) {
  manualFire.add(`${charId}:${pid}`)
}
/** Vide les cooldowns transitoires (repli total / Éveil). Reproduit l'ancien `cooldowns.clear()`. */
export function clearCooldowns() {
  cooldowns.clear()
}
/** 💀 Memento mori : remet à zéro le drapeau (fin d'instance donjon/raid, depuis le store). */
export function resetMemento() {
  mementoOn = false
}
