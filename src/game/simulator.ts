/**
 * SIMULATEUR (bac à sable) — moteur PUR pour l'écran « Simulateur ».
 *
 * Construit une équipe (1-3 persos) à partir d'une CONFIG choisie dans l'UI (classe, niveau, orientation
 * du stuff, gemmes, runes, consommable) et SIMULE un combat de raid/donjon via le VRAI moteur
 * (`partyCombatStep`), avec le `mods` complet (gemmes/runes/pactes/conso) — exactement comme tickRaid.
 *
 * GARDE-FOUS d'isolation vis-à-vis du combat LIVE (l'état de `combatEngine`/`character` est module-level) :
 *  - on N'appelle PAS `setGlobalCombatMods` (cela écraserait les mods de compte du jeu en cours) → la sim
 *    tourne avec les mods de compte ambiants du joueur (réaliste) ;
 *  - ids de perso FIXES (`sim-0..2`) → cache de stats borné, et `resetAllCooldowns(simTeam)` ne purge QUE
 *    ces ids (jamais ceux des persos du joueur) ;
 *  - on N'appelle PAS `fuelReset`/`crescendoReset` (globaux) et on omet le crescendo du heroMult.
 *  La sim étant synchrone, le tick live ne s'intercale jamais pendant son exécution.
 */
import type { Character, DamageType, ItemOrientation, OffensiveStat, RarityId } from './types'
import { makeCharacter, charDps, charMaxHp, charEhp, charDerived, charDamageProfile, charCombatMods } from './character'
import { profileDamageMult } from './damage'
import { generateItem } from './items'
import { EQUIP_SLOTS } from './slots'
import { RAID_LIST, makeRaidBoss, raidBerserkTime, type RaidDef } from './raids'
import { makeDungeonEnemy, dungeonFights, DUNGEONS } from './dungeons'
import { partyCombatStep, resetAllCooldowns } from './combatEngine'
import { craftMods } from './metiers'
import { condGemMods, getCondGem } from './condGems'
import { timeRuneMods, equippedTimeRunes, TIME_RUNES, type TimeRuneId } from './enchants'
import { activeBrewBuffs, teamPactMods, teamGemOpts } from './storeHelpers'
import { maitriseBonus } from './biomeBonus'
import { freshSave } from './save'

/* ------------------------------------------------------------------ */
/* Catalogues pour l'UI (curés — pas tout le contenu, pour rester lisible). */
/* ------------------------------------------------------------------ */
export interface ClassPreset {
  id: string; label: string; icon: string
  primary: OffensiveStat; bias: OffensiveStat; elem: DamageType
  talents: string[]; powers: string[]; support: string[]; passives: string[]
}
const PASSIVES = ['pas_cruaute', 'pas_perforation', 'pas_celerite']
export const SIM_CLASSES: ClassPreset[] = [
  { id: 'guerrier', label: 'Guerrier', icon: '⚔️', primary: 'force', bias: 'force', elem: 'physique',
    talents: ['cat_plaque', 'cl_guerrier', 'se_hub', 'se_brutal', 'se_mortel', 'se_rage', 'id_guerrier'], support: ['se_mutile'], powers: ['gu_frappe', 'se_sentence', 'se_saignement', 'se_decapite', 'se_tourmente'], passives: PASSIVES },
  { id: 'voleur', label: 'Voleur', icon: '🗡️', primary: 'agilite', bias: 'agilite', elem: 'physique',
    talents: ['cat_cuir', 'cl_voleur', 'om_hub', 'om_saig', 'om_surin', 'om_jum', 'id_voleur'], support: ['om_frappe_sournoise'], powers: ['om_eviscaration', 'vo_tranchant', 'om_embuscade', 'om_eventail', 'as_lame_enduite'], passives: PASSIVES },
  { id: 'mage', label: 'Mage', icon: '🔮', primary: 'intelligence', bias: 'intelligence', elem: 'feu',
    talents: ['cat_tissu', 'cl_mage', 'py_hub', 'py_pyromanie', 'py_hotstreak', 'py_combustion', 'id_mage'], support: [], powers: ['ma_eclair', 'py_boule', 'py_pyroblast', 'py_flammes', 'py_immolation'], passives: PASSIVES },
  { id: 'chasseur', label: 'Chasseur', icon: '🏹', primary: 'agilite', bias: 'agilite', elem: 'physique',
    talents: ['cat_mailles', 'cl_chasseur', 'me_hub', 'me_familier', 'me_meute', 'me_frenesie', 'me_coordination', 'id_chasseur'], support: [], powers: ['ch_tir', 'me_cmd', 'me_morsure', 'me_saignee', 'me_curee'], passives: PASSIVES },
]
export const getClassPreset = (id: string) => SIM_CLASSES.find((c) => c.id === id) ?? SIM_CLASSES[0]

export interface GemOpt { id: string; name: string; icon: string; kind: 'off' | 'def' }
const GEM_IDS: { id: string; kind: 'off' | 'def' }[] = [
  { id: 'overkill', kind: 'off' }, { id: 'tambour', kind: 'off' }, { id: 'hemorragie', kind: 'off' }, { id: 'conquete', kind: 'off' }, { id: 'detonation', kind: 'off' },
  { id: 'sixieme', kind: 'def' }, { id: 'tresorerie', kind: 'def' }, { id: 'souffle', kind: 'def' }, { id: 'riposte', kind: 'def' }, { id: 'perfusion', kind: 'def' },
]
export const SIM_GEMS: GemOpt[] = GEM_IDS.map(({ id, kind }) => {
  const def = getCondGem(id as never)
  return { id, kind, name: def?.name ?? id, icon: def?.icon ?? '◆' }
})

export interface RuneOpt { id: string; name: string; icon: string }
const RUNE_IDS = ['premierElan', 'hateFunebre', 'sursis', 'boucle', 'ouverture', 'dilatation']
export const SIM_RUNES: RuneOpt[] = RUNE_IDS.map((rid) => {
  const def = TIME_RUNES.find((e) => e.time === rid)
  return { id: rid, name: def?.name ?? rid, icon: def?.icon ?? '⏳' }
})

export const SIM_ELIXIRS = [
  { id: '', name: 'Aucun', icon: '∅' },
  { id: 'elixirPuissance', name: 'Élixir de puissance (+8% dégâts)', icon: '🧪' },
  { id: 'elixirVigueur', name: 'Élixir de vigueur (+12% PV)', icon: '🍶' },
]

export const SIM_ORIENTATIONS: { id: ItemOrientation; label: string }[] = [
  { id: 'offensif', label: 'Offensif' }, { id: 'equilibre', label: 'Équilibré' }, { id: 'defensif', label: 'Défensif' },
]
export const SIM_RAIDS = RAID_LIST.map((d) => ({ id: d.id, name: d.name, icon: d.icon }))
export const SIM_DUNGEONS = Object.values(DUNGEONS).map((d) => ({ id: d.id, name: d.name, icon: d.icon }))

/* ------------------------------------------------------------------ */
/* Config + résultat. */
/* ------------------------------------------------------------------ */
export interface SimMemberCfg {
  name: string; cls: string; level: number; orientation: ItemOrientation
  gems: string[]; runes: string[]
  /** Membre IMPORTÉ : un vrai personnage du joueur (vrais talents/stuff/gemmes/runes). Si présent,
   *  les champs cls/orientation/gems/runes/level ci-dessus sont ignorés — on utilise le perso tel quel. */
  imported?: Character
}

/** Crée une config de membre adossée à un VRAI personnage (à importer dans le simulateur). */
export function importedMember(char: Character): SimMemberCfg {
  return { name: char.name, cls: 'guerrier', level: char.level, orientation: 'equilibre', gems: [], runes: [], imported: char }
}
export interface SimConfig {
  ilvl: number; rarity: RarityId; bestStage: number; elixir: string
  team: SimMemberCfg[]
  content: { kind: 'raid' | 'dungeon'; id: string; tier: number; scan: boolean }
}
export interface SimMemberOut { name: string; cls: string; dps: number; ehp: number; maxHp: number }
export interface SimOutcome {
  scanned: boolean
  maxReached: number              // tier/niveau max battu (scan), sinon le tier/niveau testé si win
  win: boolean                    // (mode tier précis) ou y a-t-il au moins T1 (mode scan)
  wallAt: number                  // 1er tier/niveau échoué (0 = aucun mur dans la plage)
  dur: number; bossLeftPct: number; firstDead: string | null; firstT: number
}
export interface SimResult {
  members: SimMemberOut[]
  heroMult: number; runeCount: number; elixirActive: boolean
  contentLabel: string; unit: 'T' | 'niv'
  outcome: SimOutcome
}

export function defaultConfig(bestStage = 300): SimConfig {
  return {
    ilvl: 200, rarity: 'mythique', bestStage, elixir: '',
    team: [{ name: 'Héros', cls: 'guerrier', level: 75, orientation: 'equilibre', gems: ['sixieme', 'tresorerie'], runes: ['premierElan'] }],
    content: { kind: 'raid', id: RAID_LIST[0].id, tier: 5, scan: true },
  }
}

/* ------------------------------------------------------------------ */
/* Moteur. */
/* ------------------------------------------------------------------ */
function dotDps(c: Character): number {
  const cm = charCombatMods(c); if (!cm.dot) return 0
  const d = charDerived(c), pm = profileDamageMult(charDamageProfile(c))
  const perHit = d.power * d.masteryMult * d.overpower * (1 + d.critChance * (d.critMult - 1)) * pm * cm.damageMult
  return perHit * cm.dot.frac * d.alterationMult
}
const totalDps = (c: Character) => charDps(c) + dotDps(c)

function buildMember(m: SimMemberCfg, cfg: SimConfig, idx: number): Character {
  // Membre IMPORTÉ : on prend le vrai perso tel quel (clone défensif + id sim-*). Gear/talents/gemmes/
  // runes réels → fidélité totale au build optimisé du joueur.
  if (m.imported) {
    const src = m.imported
    const c: Character = { ...src, id: `sim-${idx}`, equipment: { ...src.equipment }, talents: { ...src.talents } }
    c.hp = charMaxHp(c)
    return c
  }
  const p = getClassPreset(m.cls)
  const c = makeCharacter(m.name || p.label, Math.max(1, m.level || 1), p.bias)
  c.id = `sim-${idx}` // id fixe → cache borné + cooldowns isolés
  const eq: Record<string, ReturnType<typeof generateItem>> = {}
  for (const s of EQUIP_SLOTS) eq[s.id] = generateItem({ ilvl: cfg.ilvl, rarity: cfg.rarity, type: s.accepts, primary: p.primary, stars: 3, orientation: m.orientation, ...(s.accepts === 'armePrincipale' ? { element: p.elem } : {}) })
  const slotIds = EQUIP_SLOTS.map((s) => s.id)
  m.gems.forEach((id, i) => { const it = eq[slotIds[i % slotIds.length]]; it.gems = [...(it.gems ?? []), { type: 'physique' as DamageType, tier: 1, cond: id, rank: 5, quality: 2 }] })
  c.equipment = eq as Character['equipment']
  c.talents = { co_start: 1 }
  for (const t of p.talents) c.talents[t] = 1
  c.powers = [...p.powers]
  c.support = [...p.support]
  c.passives = [...p.passives]
  c.hp = charMaxHp(c)
  return c
}

export function runSim(cfg: SimConfig): SimResult {
  const team = cfg.team.map((m, i) => buildMember(m, cfg, i))
  const now = Date.now()
  const s = {
    ...freshSave(), characters: team, bestStage: cfg.bestStage,
    elixirActive: cfg.elixir ? { id: cfg.elixir, until: now + 1e9, quality: 2 as const } : null,
  }
  const craft = craftMods(s.metiers)
  // `s` est un état synthétique structurellement valide ; cast pour satisfaire les Pick<GameState,…>.
  const sx = s as never
  const cond = condGemMods(team, craft.gemSpec, teamGemOpts(sx, craft))
  // Runes : celles posées sur le stuff RÉEL des persos importés (equippedTimeRunes) ∪ celles choisies en
  // config pour les membres preset (qui n'ont pas d'enchant sur leur gear généré).
  const runeSet = new Set<TimeRuneId>([...equippedTimeRunes(team), ...(cfg.team.flatMap((m) => m.runes) as TimeRuneId[])])
  const runes = timeRuneMods(runeSet, craft.runisteTempo)
  const buffs = activeBrewBuffs(sx)
  const pact = teamPactMods(sx, craft, buffs)
  const heroMult = (1 + maitriseBonus(cfg.bestStage)) * buffs.dmgMult // pas de crescendo (état live)
  const MODS = { heroMult, cond, runes, pact, content: { antidote: buffs.antidote ?? undefined } }

  const freshTeam = (): Character[] => {
    const p: Character[] = team.map((c) => ({ ...c, hp: charMaxHp(c), dots: undefined, weaken: undefined, stun: 0, rez: undefined }))
    resetAllCooldowns(p) // scopé aux ids sim-* uniquement
    return p
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simFight = (makeEnemy: (n: number) => any, timeLimit: number) => {
    let p = freshTeam(); let enemy = makeEnemy(p.length); const death: Record<string, number> = {}; let t = 0
    for (; t < timeLimit && enemy.hp > 0 && p.some((x) => x.hp > 0); t += 0.2) {
      const r = partyCombatStep(p, enemy, 0.2, MODS as never); p = r.chars; enemy = r.enemy
      for (const ch of p) if (ch.hp <= 0 && !(ch.name in death)) death[ch.name] = t
    }
    const order = Object.entries(death).sort((a, b) => a[1] - b[1])
    return { win: enemy.hp <= 0, dur: t, bossLeft: enemy.hp / enemy.maxHp, firstDead: order[0]?.[0] ?? null, firstT: order[0]?.[1] ?? 0 }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beats = (makeEnemy: (n: number) => any, timeLimit: number) => { let w = 0; for (let i = 0; i < 3; i++) if (simFight(makeEnemy, timeLimit).win) w++; return w >= 2 }

  const members: SimMemberOut[] = team.map((c, i) => ({ name: c.name, cls: cfg.team[i].cls, dps: totalDps(c), ehp: charEhp(c), maxHp: charMaxHp(c) }))

  // Résolution du contenu : `enemyAt(k)` renvoie un constructeur d'ennemi capturant le tier/niveau k.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enemyAt: (k: number) => (n: number) => any
  let timeAt: (k: number) => number
  let label: string, unit: 'T' | 'niv', cap: number
  if (cfg.content.kind === 'raid') {
    const def: RaidDef = RAID_LIST.find((d) => d.id === cfg.content.id) ?? RAID_LIST[0]
    const el = (def.element === 'rotating' ? 'arcane' : def.element) as DamageType
    enemyAt = (k) => (n) => makeRaidBoss(def, k, el, cfg.bestStage, n)
    timeAt = (k) => raidBerserkTime(def, k)
    label = `${def.icon} ${def.name}`; unit = 'T'; cap = 15
  } else {
    const def = Object.values(DUNGEONS).find((d) => d.id === cfg.content.id) ?? Object.values(DUNGEONS)[0]
    enemyAt = (k) => { const f = dungeonFights(k); return () => makeDungeonEnemy(def, k, f - 1, f, [], cfg.bestStage) }
    timeAt = () => 180
    label = `${def.icon} ${def.name}`; unit = 'niv'; cap = 25
  }

  const outcome: SimOutcome = { scanned: cfg.content.scan, maxReached: 0, win: false, wallAt: 0, dur: 0, bossLeftPct: 0, firstDead: null, firstT: 0 }
  if (cfg.content.scan) {
    let last = 0
    for (let k = 1; k <= cap; k++) { if (beats(enemyAt(k), timeAt(k))) last = k; else { outcome.wallAt = k; break } }
    outcome.maxReached = last; outcome.win = last >= 1
    if (outcome.wallAt > 0) { const d = simFight(enemyAt(outcome.wallAt), timeAt(outcome.wallAt)); outcome.dur = d.dur; outcome.bossLeftPct = d.bossLeft * 100; outcome.firstDead = d.firstDead; outcome.firstT = d.firstT }
  } else {
    const k = Math.max(1, cfg.content.tier)
    const d = simFight(enemyAt(k), timeAt(k))
    outcome.win = d.win; outcome.maxReached = d.win ? k : k - 1; outcome.wallAt = d.win ? 0 : k
    outcome.dur = d.dur; outcome.bossLeftPct = d.bossLeft * 100; outcome.firstDead = d.firstDead; outcome.firstT = d.firstT
  }

  return { members, heroMult, runeCount: runeSet.size, elixirActive: buffs.dmgMult > 1, contentLabel: label, unit, outcome }
}
