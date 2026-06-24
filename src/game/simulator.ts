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
import { makeCharacter, charDps, charMaxHp, charEhp, charDerived, charDamageProfile, charCombatMods, computeUnlockedPowers, isSupport, SUPPORT_SLOTS, PASSIVE_SLOTS } from './character'
import { getPower, POWER_SLOTS } from './powers'
import { profileDamageMult, DAMAGE_TYPE_LIST, DAMAGE_TYPES } from './damage'
import { generateItem, rollLineValue, specToAffix, starsMult, qualityBonusAffixes, type LineSpec } from './items'
import { RARITIES, RARITY_LIST } from './rarities'
import { UNIQUE_EFFECTS } from './uniques'
import { EQUIP_SLOTS, ITEM_TYPES } from './slots'
import { RAID_LIST, makeRaidBoss, raidBerserkTime, type RaidDef } from './raids'
import { makeDungeonEnemy, dungeonFights, DUNGEONS } from './dungeons'
import { partyCombatStep, resetAllCooldowns } from './combatEngine'
import { craftMods } from './metiers'
import { condGemMods, getCondGem } from './condGems'
import { timeRuneMods, equippedTimeRunes, TIME_RUNES, type TimeRuneId } from './enchants'
import { activeBrewBuffs, teamPactMods, teamGemOpts } from './storeHelpers'
import { maitriseBonus } from './biomeBonus'
import { freshSave } from './save'
import { SECONDARY_META, PRIMARY_META } from './stats'

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

export interface GemOpt { id: string; name: string; icon: string; color: string; kind: 'off' | 'def'; desc: string }
const GEM_IDS: { id: string; kind: 'off' | 'def' }[] = [
  { id: 'overkill', kind: 'off' }, { id: 'tambour', kind: 'off' }, { id: 'hemorragie', kind: 'off' }, { id: 'conquete', kind: 'off' }, { id: 'detonation', kind: 'off' },
  { id: 'sixieme', kind: 'def' }, { id: 'tresorerie', kind: 'def' }, { id: 'souffle', kind: 'def' }, { id: 'riposte', kind: 'def' }, { id: 'perfusion', kind: 'def' },
]
export const SIM_GEMS: GemOpt[] = GEM_IDS.map(({ id, kind }) => {
  const def = getCondGem(id as never)
  const vals = def?.values ?? []
  const v = vals[Math.min(4, vals.length - 1)] ?? 0
  return { id, kind, name: def?.name ?? id, icon: def?.icon ?? '◆', color: def?.color ?? '#cbd5e1', desc: def?.desc?.(v) ?? '' }
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
/** Stats primaires offensives sélectionnables (FORCE / AGI / INT) — pour le choix de stat du membre. */
export const SIM_PRIMARIES: { id: OffensiveStat; label: string; short: string; color: string }[] =
  (['force', 'agilite', 'intelligence'] as OffensiveStat[]).map((id) => ({ id, label: PRIMARY_META[id].name, short: PRIMARY_META[id].short, color: PRIMARY_META[id].color }))
export const SIM_RAIDS = RAID_LIST.map((d) => ({ id: d.id, name: d.name, icon: d.icon }))
export const SIM_DUNGEONS = Object.values(DUNGEONS).map((d) => ({ id: d.id, name: d.name, icon: d.icon }))

// Palette de stats secondaires pour l'éditeur de stuff pièce-par-pièce.
export interface StatOpt { id: string; name: string; short: string; color: string; kind: 'off' | 'def' | 'rare' }
const STAT_IDS: { id: string; kind: 'off' | 'def' | 'rare' }[] = [
  ...['critique', 'degatsCrit', 'hate', 'maitrise', 'penetration', 'alteration', 'degatsBoss', 'precision'].map((id) => ({ id, kind: 'off' as const })),
  ...['reductionDegats', 'barriere', 'resilience'].map((id) => ({ id, kind: 'def' as const })),
  ...['volDeVie', 'surpuissance', 'multifrappe', 'recuperation'].map((id) => ({ id, kind: 'rare' as const })),
]
export const SIM_STATS: StatOpt[] = STAT_IDS.map(({ id, kind }) => {
  const m = SECONDARY_META[id as keyof typeof SECONDARY_META]
  return { id, kind, name: m?.name ?? id, short: m?.short ?? id, color: m?.color ?? '#cbd5e1' }
})

// Types de dégâts (pour les lignes de RÉSISTANCE et de % DÉGÂTS) + raretés + uniques (pickers UI).
export const SIM_DMG_TYPES = DAMAGE_TYPE_LIST.map((t) => ({ id: t, name: DAMAGE_TYPES[t].name, icon: DAMAGE_TYPES[t].icon, color: DAMAGE_TYPES[t].color }))
export const SIM_RARITIES = RARITY_LIST.map((r) => ({ id: r.id, name: r.name, tier: r.tier, affixCount: r.affixCount }))
export const SIM_UNIQUES = UNIQUE_EFFECTS.map((u) => ({ id: u.id, name: u.name, role: u.role, desc: u.description + (u.active ? ' · ⚡ Actif : ' + u.active : '') }))

/** Une LIGNE d'affixe choisie : stat secondaire, résistance à un type, ou % dégâts d'un type. */
export type LineCfg = { k: 'stat' | 'resist' | 'dmg'; id: string }
/** Config de stuff d'UN emplacement (éditeur pièce-par-pièce) : ilvl/rareté fins, lignes, gemmes, unique. */
export interface GearSlotCfg {
  ilvl?: number          // override d'ilvl de la pièce (défaut = ilvl global)
  rarity?: string        // override de rareté (défaut = rareté globale) — pilote le NB de lignes
  stars?: number         // qualité ⭐ 1..5 (défaut 3) — budget + lignes bonus
  orientation: ItemOrientation
  lines: LineCfg[]       // lignes d'affixes (valeurs auto au budget) ; cap = nb de lignes de la rareté
  gems: string[]         // gemmes posées sur CETTE pièce (nombre = nb de châsses)
  gemRank?: number       // rang des gemmes de la pièce (défaut 5)
  unique?: string        // effet unique posé sur cette pièce
  uniqueRank?: number    // rang de l'unique 1..10 (défaut 10)
  element?: DamageType   // arme principale : type de dégâts de l'arme (défaut = élément de classe)
  stats?: string[]       // DÉPRÉCIÉ (v1) — migré en lignes de stat à la construction
}
export const SIM_MAX_GEM_RANK = 10
export const SIM_MAX_UNIQUE_RANK = 10 // = UNIQUE_MAX_RANK (uniques.ts) ; en dur pour éviter un souci d'ordre d'init
/** Affixes par défaut (priorité offensive) si l'emplacement n'est pas personnalisé. */
export const DEFAULT_AFFIXES = ['maitrise', 'critique', 'degatsCrit', 'hate', 'penetration']
/** Raccourci : transforme des ids de stat en lignes. */
export const statLines = (ids: string[]): LineCfg[] => ids.map((id) => ({ k: 'stat', id }))
/** Nombre de lignes d'affixes d'une rareté (base + bonus de qualité ⭐). */
export function maxLinesFor(rarityId: string, stars = 3): number {
  const r = RARITIES[rarityId as keyof typeof RARITIES]
  return Math.min(9, (r?.affixCount ?? 3) + qualityBonusAffixes(stars))
}
/** Pré-remplit une config de stuff complète (16 emplacements) à partir d'une orientation de base. */
export function initGear(orientation: ItemOrientation): Record<string, GearSlotCfg> {
  const g: Record<string, GearSlotCfg> = {}
  for (const s of EQUIP_SLOTS) g[s.id] = { orientation, lines: statLines(DEFAULT_AFFIXES), gems: [] }
  return g
}
/** Emplacements (id + libellé + icône) pour l'UI. */
export const SIM_SLOTS = EQUIP_SLOTS.map((s) => ({ id: s.id, name: s.name, accepts: s.accepts, icon: ITEM_TYPES[s.accepts].icon }))

function toLineSpec(l: LineCfg): LineSpec {
  if (l.k === 'stat') return { kind: 'stat', stat: l.id as never, weight: 1 }
  if (l.k === 'resist') return { kind: 'resist', type: l.id as DamageType, weight: 1 }
  return { kind: 'dmgType', type: l.id as DamageType, weight: 1 }
}

/** Constellations pertinentes par classe (cœur + classe + archétypes) — pour l'allocateur bac-à-sable. */
export const CLASS_CONSTELLATIONS: Record<string, string[]> = {
  guerrier: ['coeur', 'guerrier', 'sentence', 'rempart', 'juggernaut', 'furie'],
  voleur: ['coeur', 'voleur', 'assassin', 'ombrelame', 'lamevenin'],
  mage: ['coeur', 'mage', 'pyromancien', 'cryomancien', 'arcaniste', 'convergence'],
  chasseur: ['coeur', 'chasseur', 'meute', 'faucon', 'symbiose'],
}
/** Budget de points par défaut (pool d'endgame approx.) pour le bac-à-sable de talents. */
export const DEFAULT_TALENT_BUDGET = 90
/** Map de talents initiale d'une classe (chemin canonique) — point de départ de l'éditeur. */
export function initTalents(clsId: string): Record<string, number> {
  const p = getClassPreset(clsId)
  const t: Record<string, number> = { co_start: 1 }
  for (const id of p.talents) t[id] = 1
  return t
}

/** SNAPSHOT du stuff RÉEL d'un perso → config éditable pièce-par-pièce (inverse de `buildMember`).
 *  Sert à « détacher » l'équipement d'un membre importé pour le retoucher en partant du set exact.
 *  Les valeurs seront re-rollées au budget à la reconstruction (lignes/ilvl/rareté/⭐/gemmes/unique
 *  conservés à l'identique). Stat primaire NON capturée : `m.primary` (override) ?? primaire réelle. */
export function gearFromCharacter(char: Character): Record<string, GearSlotCfg> {
  const g: Record<string, GearSlotCfg> = {}
  for (const s of EQUIP_SLOTS) {
    const it = char.equipment?.[s.id]
    if (!it) { g[s.id] = { orientation: 'equilibre', lines: statLines(DEFAULT_AFFIXES), gems: [] }; continue }
    const lines: LineCfg[] = []
    for (const a of it.affixes ?? []) {
      if (a.kind === 'stat') { if (a.stat) lines.push({ k: 'stat', id: a.stat }) }
      else if (a.type) lines.push({ k: a.kind === 'resist' ? 'resist' : 'dmg', id: a.type })
    }
    const gems = (it.gems ?? []).map((gm) => gm.cond).filter((x): x is string => !!x)
    g[s.id] = {
      ilvl: it.ilvl, rarity: it.rarity, stars: it.stars ?? 3, orientation: it.orientation, lines, gems,
      ...(gems.length ? { gemRank: it.gems?.find((gm) => gm.rank)?.rank ?? 5 } : {}),
      ...(it.unique ? { unique: it.unique.id, uniqueRank: it.unique.rank } : {}),
      ...(it.damageType ? { element: it.damageType } : {}),
    }
  }
  return g
}

/* ------------------------------------------------------------------ */
/* Config + résultat. */
/* ------------------------------------------------------------------ */
export interface SimMemberCfg {
  name: string; cls: string; level: number; orientation: ItemOrientation
  gems: string[]; runes: string[]
  /** Stat primaire FORCE/AGI/INT à forcer sur tout l'équipement généré. Si absent : stat de la classe
   *  (membre preset) ou stat réelle de chaque pièce (membre importé). */
  primary?: OffensiveStat
  /** Stuff DÉTAILLÉ pièce-par-pièce (orientation + stats par emplacement). Si absent, on utilise
   *  l'orientation globale + les affixes par défaut. Ignoré pour un membre importé. */
  gear?: Record<string, GearSlotCfg>
  /** Arbre de TALENTS personnalisé (nodeId → rang). Si absent, le chemin canonique de la classe est
   *  utilisé. Ignoré pour un membre importé (qui garde ses vrais talents). */
  talents?: Record<string, number>
  /** Capacités ÉQUIPÉES choisies (ids), bornées aux slots. Si absent → défaut de la classe.
   *  Ignoré pour un membre importé. */
  powers?: string[]    // actifs (≤ POWER_SLOTS)
  support?: string[]   // soutien (≤ SUPPORT_SLOTS)
  passives?: string[]  // passifs (≤ PASSIVE_SLOTS)
  /** Membre IMPORTÉ : un vrai personnage du joueur (vrais talents/stuff/gemmes/runes). Si présent,
   *  les champs cls/orientation/gems/runes/level/gear ci-dessus sont ignorés — perso tel quel. */
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
  // Membre IMPORTÉ : on part du vrai perso (clone défensif + id sim-*). Par défaut, fidélité TOTALE
  // (gear/talents/gemmes/runes réels). Des OVERRIDES optionnels permettent de ne retoucher qu'une
  // partie (ex. juste l'arbre) : toute section non overridée reste byte-exacte au perso réel.
  if (m.imported) {
    const src = m.imported
    const c: Character = { ...src, id: `sim-${idx}`, equipment: { ...src.equipment }, talents: { ...src.talents } }
    if (m.talents) c.talents = { co_start: 1, ...m.talents }
    if (m.powers) c.powers = [...m.powers]
    if (m.support) c.support = [...m.support]
    if (m.passives) c.passives = [...m.passives]
    if (m.gear) {
      // Stuff retouché : on reconstruit chaque pièce snapshotée ; primaire = override membre ?? primaire
      // RÉELLE de la pièce ?? stat de classe. Une pièce sans config garde l'objet réel tel quel.
      const eq: Record<string, ReturnType<typeof generateItem>> = {}
      for (const s of EQUIP_SLOTS) {
        const gs = m.gear[s.id], real = src.equipment?.[s.id]
        if (!gs) { if (real) eq[s.id] = real; continue }
        const ilvl = gs.ilvl ?? real?.ilvl ?? cfg.ilvl
        const rarity = (gs.rarity ?? real?.rarity ?? cfg.rarity) as RarityId
        const stars = gs.stars ?? real?.stars ?? 3
        const orient = gs.orientation ?? real?.orientation ?? m.orientation
        const primary = m.primary ?? real?.primary ?? getClassPreset(m.cls).primary
        const elem = s.accepts === 'armePrincipale' ? (gs.element ?? real?.damageType) : undefined
        const it = generateItem({ ilvl, rarity, type: s.accepts, primary, stars, orientation: orient, ...(elem ? { element: elem } : {}) })
        const lines: LineCfg[] = gs.lines?.length ? gs.lines : (gs.stats ?? DEFAULT_AFFIXES).map((id) => ({ k: 'stat', id }))
        const tier = RARITIES[rarity].tier, qMult = starsMult(stars), cap = maxLinesFor(rarity, stars)
        it.affixes = lines.slice(0, cap).map((l) => { const sp = toLineSpec(l); return specToAffix(sp, rollLineValue(sp, ilvl, qMult, tier)) })
        it.gems = (gs.gems ?? []).map((id) => ({ type: 'physique' as DamageType, tier: 1, cond: id, rank: gs.gemRank ?? 5, quality: 2 }))
        it.unique = gs.unique ? { id: gs.unique, rank: gs.uniqueRank ?? SIM_MAX_UNIQUE_RANK } : undefined
        eq[s.id] = it
      }
      c.equipment = eq as Character['equipment']
    }
    c.hp = charMaxHp(c)
    return c
  }
  const p = getClassPreset(m.cls)
  const c = makeCharacter(m.name || p.label, Math.max(1, m.level || 1), p.bias)
  c.id = `sim-${idx}` // id fixe → cache borné + cooldowns isolés
  const eq: Record<string, ReturnType<typeof generateItem>> = {}
  for (const s of EQUIP_SLOTS) {
    const gs = m.gear?.[s.id]
    const ilvl = gs?.ilvl ?? cfg.ilvl
    const rarity = (gs?.rarity ?? cfg.rarity) as RarityId
    const stars = gs?.stars ?? 3
    const orient = gs?.orientation ?? m.orientation
    const elem = (s.accepts === 'armePrincipale' ? (gs?.element ?? p.elem) : undefined)
    const it = generateItem({ ilvl, rarity, type: s.accepts, primary: m.primary ?? p.primary, stars, orientation: orient, ...(elem ? { element: elem } : {}) })
    if (gs) {
      // Lignes EXACTES choisies (stat/résist/%dmg), au nb de lignes de la rareté+qualité ; valeurs au vrai budget.
      const lines: LineCfg[] = gs.lines?.length ? gs.lines : (gs.stats ?? DEFAULT_AFFIXES).map((id) => ({ k: 'stat', id }))
      const tier = RARITIES[rarity].tier, qMult = starsMult(stars), cap = maxLinesFor(rarity, stars)
      it.affixes = lines.slice(0, cap).map((l) => { const sp = toLineSpec(l); return specToAffix(sp, rollLineValue(sp, ilvl, qMult, tier)) })
      it.gems = (gs.gems ?? []).map((id) => ({ type: 'physique' as DamageType, tier: 1, cond: id, rank: gs.gemRank ?? 5, quality: 2 })) // nb = châsses
      it.unique = gs.unique ? { id: gs.unique, rank: gs.uniqueRank ?? SIM_MAX_UNIQUE_RANK } : undefined
    } else {
      // Mode simple : redistribue les stats par défaut (valeurs rollées conservées).
      const statAff = it.affixes.filter((a) => a.kind === 'stat'), other = it.affixes.filter((a) => a.kind !== 'stat')
      it.affixes = [...statAff.map((a, i) => ({ ...a, stat: DEFAULT_AFFIXES[i % DEFAULT_AFFIXES.length] as never })), ...other]
    }
    eq[s.id] = it
  }
  // Gemmes au NIVEAU MEMBRE (mode simple uniquement) — en mode détaillé, elles sont posées par pièce.
  if (!m.gear) {
    const slotIds = EQUIP_SLOTS.map((s) => s.id)
    m.gems.forEach((id, i) => { const it = eq[slotIds[i % slotIds.length]]; it.gems = [...(it.gems ?? []), { type: 'physique' as DamageType, tier: 1, cond: id, rank: 5, quality: 2 }] })
  }
  c.equipment = eq as Character['equipment']
  if (m.talents) {
    c.talents = { co_start: 1, ...m.talents } // arbre personnalisé (bac-à-sable)
  } else {
    c.talents = { co_start: 1 }
    for (const t of p.talents) c.talents[t] = 1
  }
  c.powers = m.powers ? [...m.powers] : [...p.powers]
  c.support = m.support ? [...m.support] : [...p.support]
  c.passives = m.passives ? [...m.passives] : [...p.passives]
  c.hp = charMaxHp(c)
  return c
}

/** Capacités débloquées par une map de talents, classées par destination de slot (actif/soutien/passif). */
export interface AbilityOpt { id: string; name: string; icon: string }
export const SIM_ABILITY_SLOTS = { active: POWER_SLOTS, support: SUPPORT_SLOTS, passive: PASSIVE_SLOTS }
export function availableAbilities(
  talents: Record<string, number>,
  equipped?: { active?: string[]; support?: string[]; passive?: string[] },
): { active: AbilityOpt[]; support: AbilityOpt[]; passive: AbilityOpt[] } {
  const out = { active: [] as AbilityOpt[], support: [] as AbilityOpt[], passive: [] as AbilityOpt[] }
  const seen = new Set<string>()
  const push = (g: 'active' | 'support' | 'passive', id: string) => {
    if (seen.has(id)) return
    const def = getPower(id); if (!def) return
    seen.add(id); out[g].push({ id, name: def.name, icon: def.icon ?? '•' })
  }
  for (const id of computeUnlockedPowers(talents)) {
    const def = getPower(id); if (!def) continue
    push(def.kind === 'passive' ? 'passive' : isSupport(def) ? 'support' : 'active', id)
  }
  // Inclut les capacités DÉJÀ ÉQUIPÉES (un preset équipe des sorts que son chemin minimal ne débloque
  // pas formellement) → elles apparaissent et restent surlignées dans leur groupe.
  if (equipped) (['active', 'support', 'passive'] as const).forEach((g) => (equipped[g] ?? []).forEach((id) => push(g, id)))
  return out
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
