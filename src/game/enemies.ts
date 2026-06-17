import type { Enemy, DamageType, EnemyAbility } from './types'
import { DAMAGE_TYPE_LIST } from './damage'
import type { BiomeId } from './biomes'
import { farmReq } from './resist'
import { enemyHp, enemyDmg, enemyArmor, farmDifficultyIlvl, ilvlFarm } from './progression'

/**
 * Technique SIGNATURE par biome (l'« autre chose » qui s'ajoute aux frappes physiques de base).
 * Chaque famille mappe sur un contre du kit héros (voir EnemyAbility). magnitude = fraction des
 * dégâts de base de l'ennemi.
 */
const BIOME_SIGNATURE: Record<BiomeId, EnemyAbility> = {
  physique: { kind: 'dot', element: 'physique', name: 'Saignement', icon: '🩸', cooldown: 5, magnitude: 0.6, duration: 4 },
  feu: { kind: 'dot', element: 'feu', name: 'Brûlure', icon: '🔥', cooldown: 5, magnitude: 0.8, duration: 4 },
  froid: { kind: 'cc', element: 'froid', name: 'Gel', icon: '❄️', cooldown: 9, magnitude: 0, duration: 1.2 },
  foudre: { kind: 'burst', element: 'foudre', name: 'Décharge', icon: '⚡', cooldown: 6, magnitude: 2.0, telegraph: 1.2 },
  nature: { kind: 'dot', element: 'nature', name: 'Poison', icon: '☠️', cooldown: 4, magnitude: 0.6, duration: 5 },
  arcane: { kind: 'debuff', element: 'arcane', name: 'Malédiction', icon: '✨', cooldown: 8, magnitude: 0, duration: 5 },
  ombre: { kind: 'drain', element: 'ombre', name: 'Drain de vie', icon: '🌑', cooldown: 6, magnitude: 1.4 },
}

/**
 * Techniques d'un ennemi selon son biome et son rang.
 * - Physique = biome d'APPRENTISSAGE : seuls élites/boss ont une technique (rien sur les normaux).
 * - Autres biomes : technique signature élémentaire pour TOUS ; les boss ajoutent un gros burst télégraphié.
 */
function biomeAbilities(biome: BiomeId, isBoss: boolean, isElite: boolean): EnemyAbility[] {
  const out: EnemyAbility[] = []
  if (biome === 'physique') {
    if (isBoss || isElite) out.push({ ...BIOME_SIGNATURE.physique })
    if (isBoss) out.push({ kind: 'burst', element: 'physique', name: 'Charge dévastatrice', icon: '💥', cooldown: 8, magnitude: 2.6, telegraph: 1.5 })
  } else {
    out.push({ ...BIOME_SIGNATURE[biome] })
    if (isBoss) out.push({ kind: 'burst', element: biome, name: 'Cataclysme', icon: '☄️', cooldown: 9, magnitude: 2.8, telegraph: 1.5 })
  }
  // Décale les premières incantations (pas de salve à t=0).
  out.forEach((a, i) => { a.cd = a.cooldown * (0.5 + i * 0.3) })
  return out
}

/** Faune PAR BIOME : chaque zone a ses créatures (texture, zéro redondance inter-biomes). */
const BIOME_ENEMIES: Record<BiomeId, string[]> = {
  physique: ['Gobelin pillard', 'Loup affamé', 'Squelette rouillé', 'Bandit de grand chemin', 'Ogre des cavernes', 'Brute orque', 'Mercenaire déchu', 'Sanglier de guerre', 'Gnoll chasseur', 'Géant des collines'],
  feu: ['Salamandre ardente', 'Diablotin des braises', 'Golem de magma', 'Chien de lave', 'Élémentaire de feu', 'Wyrm des cendres', 'Efrit déchaîné', 'Phénix corrompu', 'Forgeron damné', 'Cendre-vive'],
  froid: ['Loup arctique', 'Élémentaire de givre', 'Yéti des cimes', 'Harpie boréale', 'Golem de glace', 'Spectre gelé', 'Traqueur des neiges', 'Wendigo affamé', 'Sorcière du blizzard', 'Mammouth spectral'],
  foudre: ['Élémentaire d\'orage', 'Harpie fulgurante', 'Drake voltaïque', 'Esprit du tonnerre', 'Golem conducteur', 'Serpent d\'éclairs', 'Djinn des tempêtes', 'Vouivre des pics', 'Condor foudroyé', 'Titan statique'],
  nature: ['Araignée venimeuse', 'Tréant corrompu', 'Mante toxique', 'Serpent des lianes', 'Champignon carnivore', 'Dryade vengeresse', 'Basilic des fourrés', 'Frelon royal', 'Limace caustique', 'Gardien sylvestre'],
  arcane: ['Aberration instable', 'Tisseur de sorts', 'Élémentaire d\'arcane', 'Œil scrutateur', 'Golem runique', 'Djinn du Voile', 'Horreur géométrique', 'Mage dissous', 'Écho de mana', 'Sphinx déchu'],
  ombre: ['Goule putride', 'Spectre hurlant', 'Cultiste masqué', 'Démon mineur', 'Ombre rampante', 'Vampire famélique', 'Cauchemar incarné', 'Faucheur silencieux', 'Liche mineure', 'Dévoreur d\'âmes'],
}

/** Boss PAR BIOME (un nom thématique tous les 10 paliers). */
const BIOME_BOSSES: Record<BiomeId, string[]> = {
  physique: ['Seigneur Mortepierre', 'Korgath le Briseur', 'Général Fer-Noir', 'Urzog, Fléau des Plaines', 'La Montagne qui Marche'],
  feu: ['Pyrothan l\'Incandescent', 'La Fournaise Vivante', 'Ignis, Cœur de Braise', 'Le Sultan des Cendres', 'Vulkar l\'Éruptif'],
  froid: ['Borealis, le Gel Éternel', 'La Reine du Blizzard', 'Glacius l\'Implacable', 'Père Hiver Corrompu', 'L\'Avalanche Consciente'],
  foudre: ['Fulgur, Voix du Tonnerre', 'L\'Œil du Cyclone', 'Voltaïa la Fulgurante', 'Le Paratonnerre Vivant', 'Tempestas, l\'Orage Roi'],
  nature: ['La Matriarche des Ronces', 'Venimor l\'Empoisonneur', 'Le Cœur de la Jungle', 'Sylvanus le Pourrissant', 'La Ruche Première'],
  arcane: ['Néfarius l\'Éternel', 'Le Paradoxe Incarné', 'Arcanya, Mère des Sorts', 'L\'Équation Vivante', 'Voilebrume le Distordu'],
  ombre: ['Vrakthul l\'Insatiable', 'La Veuve d\'Ébène', 'L\'Avatar du Néant', 'Morsombre le Dévoreur', 'Le Roi sans Visage'],
}

/** Épithètes déterministes (pure texture — les TRAITS gardent les effets de stats). */
const EPITHETS = ['vorace', 'sinistre', 'hurlant', 'rampant', 'funeste', 'farouche', 'ancien', 'errant', 'sauvage', 'famélique']

/** Titres des CHAMPIONS ✦ : ennemis nommés rares au butin exceptionnel (moment de jackpot). */
const CHAMPION_TITLES = ['le Terrible', 'l\'Écorcheur', 'la Calamité', 'le Maudit', 'le Colossal', 'l\'Immortel', 'le Hanteur', 'la Fin de Toute Chose']
/** Chance qu'un ennemi normal (palier > 10) soit un champion. */
const CHAMPION_CHANCE = 0.03

/**
 * Traits déterministes (texture du combat classique, pas d'aléatoire d'un run à l'autre).
 * Apparaissent sur certains paliers et **cyclent** → on peut s'adapter (penetration vs Blindé…).
 */
interface EnemyTrait {
  id: string
  name: string
  hpMult?: number
  dmgMult?: number
  armorMult?: number
}
const TRAITS: EnemyTrait[] = [
  { id: 'blinde', name: 'Blindé', armorMult: 2.6 }, // la Pénétration aide
  { id: 'feroce', name: 'Féroce', dmgMult: 1.35 },
  { id: 'massif', name: 'Massif', hpMult: 1.6 },
  { id: 'coriace', name: 'Coriace', hpMult: 1.3, armorMult: 1.6 },
  { id: 'enrage', name: 'Enragé', dmgMult: 1.2, hpMult: 1.2 },
]

/** Palier à partir duquel les ennemis gagnent une résistance globale croissante. */
const RESIST_RAMP_FROM = 25
const RESIST_RAMP_PER_STAGE = 0.004
const RESIST_RAMP_CAP = 0.55
/** Élite tous les N paliers (hors boss) : stats accrues + meilleur butin. */
const ELITE_EVERY = 7

/** Résistance globale (tous types) d'un palier — croît linéairement, contrée par la Pénétration. */
export function stageResistRamp(stage: number): number {
  if (stage < RESIST_RAMP_FROM) return 0
  return Math.min(RESIST_RAMP_CAP, (stage - RESIST_RAMP_FROM) * RESIST_RAMP_PER_STAGE)
}

/**
 * FACTEUR DE DIFFICULTÉ DU FARM (v0.30.1) — deux rôles :
 *  1. RAMPE D'ONBOARDING : les premiers paliers sont très faibles → un perso NU démarre de zéro
 *     (palier 1 ~50 PV, tuable en 2-3 s), loote ses 1ers objets, s'équipe, progresse.
 *  2. PLATEAU DE FARM : au-delà de `ONBOARD_STAGES`, le farm plafonne à `FARM_PLATEAU` (~0,55) de la
 *     courbe calibrée — car les sims TTK calibrent sur du LÉGENDAIRE, alors qu'un farmeur a du stuff de
 *     FARM (~épique, ~2× moins de DPS). Sans ça le farm serait ~2× trop lent. Les RAIDS (qui donnent
 *     un meilleur stuff) ne passent PAS par ici → restent à pleine échelle (boss 35-40 s).
 * Le « mur de farm » (au-delà du cap de loot ilvl 200) subsiste : les PV montent toujours en b^ilvl.
 */
export const ONBOARD_STAGES = 22
export const FARM_PLATEAU = 0.55
export function onboardingMult(stage: number): number {
  if (stage >= ONBOARD_STAGES) return FARM_PLATEAU
  // Courbe TRÈS douce sur les premiers paliers (exposant 2,6) : le joueur early n'a ni keystones
  // (talents au niv 11) ni stuff complet → bien plus faible que les builds optimisés des sims. On lui
  // laisse de l'air pour gear/level/découvrir, puis on rejoint le plateau de farm au palier 22.
  return Math.max(0.004, FARM_PLATEAU * Math.pow(stage / ONBOARD_STAGES, 2.6))
}

/** Crée l'ennemi correspondant à un palier (stage) dans un biome donné. Boss tous les 10 paliers.
 *  `championMult` (v0.26, 🍖 rune d'Appât) : multiplie la chance d'apparition des champions ✦. */
export function makeEnemy(stage: number, biome: BiomeId = 'physique', championMult = 1): Enemy {
  const isBoss = stage % 10 === 0
  // Champion ✦ : rencontre rare et ALÉATOIRE (l'imprévu qui casse la routine du farm).
  const isChampion = !isBoss && stage > 10 && Math.random() < CHAMPION_CHANCE * championMult
  const isElite = !isBoss && !isChampion && stage % ELITE_EVERY === 0 && stage > ELITE_EVERY
  // Trait déterministe sur certains paliers (cycle), hors boss/élite/champion.
  const trait = !isBoss && !isElite && !isChampion && stage % 3 === 0 ? TRAITS[Math.floor(stage / 3) % TRAITS.length] : undefined

  // v0.30 — courbe UNIFIÉE : PV/dégâts = base commune b^ilvl (progression.ts) à partir du trash, ×
  // multiplicateur de CLASSE propre au FARM. Les boss de farm (jalon tous les 10 paliers) restent
  // LÉGERS (×5, comme à l'origine) — pas des murs de 35 s façon raid. Difficulté = STAGE (non capée).
  const farmHpMult = isBoss ? 5 : isElite ? 2.7 : isChampion ? 4 : 1
  const farmDmgMult = isBoss ? 1.8 : isElite ? 1.4 : isChampion ? 1.25 : 1
  const diffIlvl = farmDifficultyIlvl(stage)
  const traitHp = trait?.hpMult ?? 1
  const traitDmg = trait?.dmgMult ?? 1
  const armorMult = trait?.armorMult ?? 1
  // v0.30.1 — rampe d'onboarding : PV & dégâts des premiers paliers atténués (démarrage de zéro).
  const onboard = onboardingMult(stage)
  const maxHp = Math.round(enemyHp(diffIlvl, 'trash') * farmHpMult * traitHp * onboard)
  const pool = BIOME_ENEMIES[biome]
  const baseName = pool[(stage - 1) % pool.length]
  const bosses = BIOME_BOSSES[biome]
  const name = isBoss
    ? `★ ${bosses[Math.floor(stage / 10 - 1) % bosses.length]}`
    : isChampion
      ? `✦ ${baseName} ${CHAMPION_TITLES[Math.floor(Math.random() * CHAMPION_TITLES.length)]}`
      : isElite
        ? `◆ ${baseName} d'élite`
        : trait
          ? `${baseName} ${trait.name.toLowerCase()}`
          : stage % 2 === 1
            ? `${baseName} ${EPITHETS[(stage * 3 + baseName.length) % EPITHETS.length]}`
            : baseName

  // Résistance GLOBALE (tous types identiques) → difficulté monotone, la Pénétration la contre.
  // (v0.25 : le Cycle de prédation — self-résist + vulnérabilité par biome — a été supprimé.)
  const ramp = stageResistRamp(stage)
  const resist: Partial<Record<DamageType, number>> = {}
  if (ramp > 0) for (const t of DAMAGE_TYPE_LIST) resist[t] = ramp

  // Auto-attaques TOUJOURS PHYSIQUES (la base). L'élément du biome arrive en plus, via la technique
  // signature (DoT/burst/CC… typé) → « physique + autre chose ». Donc en biome Feu : frappes physiques
  // (→ armure / résist physique) + Brûlure de feu (→ résist feu + Purge). Double levier de survie.
  const damageType: DamageType = 'physique'

  return {
    name,
    maxHp,
    hp: maxHp,
    armor: Math.round(enemyArmor(diffIlvl, armorMult)),
    // Dégâts : MÊME base b que les PV (et que le joueur) → la pression suit la montée, fini le
    // one-shot exponentiel ET le « trop mou ». La menace vient des techniques télégraphiées + du
    // check de résistance (req), pas d'un mur sec. La classe encode le ratio (boss ×1,8 trash).
    damage: Math.round(enemyDmg(diffIlvl, 'trash') * farmDmgMult * traitDmg * onboard),
    // XP rare (monter de niveau se mérite — levelling volontairement lent au début).
    xp: Math.round((isBoss ? 38 : isElite || isChampion ? 17 : 4) * Math.pow(1.115, stage - 1)),
    resist,
    damageType,
    ...(trait ? { trait: trait.name } : isElite ? { trait: 'Élite' } : isChampion ? { trait: 'Champion ✦' } : {}),
    // Exigence de résistance (v0.24) sur l'élément du biome — nulle avant le palier 45, douce après.
    ...(() => { const rq = farmReq(stage); return rq > 0 ? { reqs: { [biome]: rq } as Partial<Record<DamageType, number>> } : {} })(),
    ...(() => { const a = biomeAbilities(biome, isBoss, isElite || isChampion); return a.length ? { abilities: a } : {} })(),
    ...(isElite || isChampion ? { elite: true, dodge: 0.1 } : {}),
    ...(isChampion ? { champion: true } : {}),
    // Boss : reçoivent les « Dégâts vs Boss », esquivent (→ Précision) et étourdissent (→ Ténacité).
    ...(isBoss ? { boss: true, dodge: 0.15, ccDur: 1.5, ccCd: 7 } : {}),
  }
}

export function isBossStage(stage: number): boolean {
  return stage % 10 === 0
}

/** ilvl de loot attendu pour une vague (v0.35 : = ilvlFarm = frontière − LAG, courbe unifiée, plus de
 *  cap — le loot reste en retard permanent sur la difficulté de la vague). */
export function stageIlvl(stage: number): number {
  return ilvlFarm(stage)
}

/** Décalage de chance de rareté selon le palier atteint. */
export function stageLuckTier(stage: number): number {
  return Math.floor(stage / 8)
}
