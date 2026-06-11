import type { Enemy, DamageType, EnemyAbility } from './types'
import { DAMAGE_TYPE_LIST } from './damage'
import type { BiomeId } from './biomes'
import { BIOME_VULN, PREDATION_SELF_RESIST, PREDATION_VULN } from './biomeBonus'
import { farmReq } from './resist'

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

/** Crée l'ennemi correspondant à un palier (stage) dans un biome donné. Boss tous les 10 paliers. */
export function makeEnemy(stage: number, biome: BiomeId = 'physique'): Enemy {
  const isBoss = stage % 10 === 0
  // Champion ✦ : rencontre rare et ALÉATOIRE (l'imprévu qui casse la routine du farm).
  const isChampion = !isBoss && stage > 10 && Math.random() < CHAMPION_CHANCE
  const isElite = !isBoss && !isChampion && stage % ELITE_EVERY === 0 && stage > ELITE_EVERY
  // Trait déterministe sur certains paliers (cycle), hors boss/élite/champion.
  const trait = !isBoss && !isElite && !isChampion && stage % 3 === 0 ? TRAITS[Math.floor(stage / 3) % TRAITS.length] : undefined

  const hpMult = (isElite ? 2.2 : isChampion ? 1.8 : 1) * (trait?.hpMult ?? 1)
  const dmgMult = (isElite ? 1.4 : isChampion ? 1.25 : 1) * (trait?.dmgMult ?? 1)
  const armorMult = trait?.armorMult ?? 1

  // Croissance exponentielle douce du HP (réduite : moins de "sacs à PV"). Boss un peu moins gonflés.
  const hpBase = 40 * Math.pow(1.17, stage - 1)
  const maxHp = Math.round(hpBase * (isBoss ? 5 : 1) * hpMult)
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
  const ramp = stageResistRamp(stage)
  const resist: Partial<Record<DamageType, number>> = {}
  if (ramp > 0) for (const t of DAMAGE_TYPE_LIST) resist[t] = ramp
  // CYCLE DE PRÉDATION (v0.21) : hors Physique, les ennemis résistent à LEUR élément et sont
  // vulnérables à l'élément prédateur → camper le biome de son propre élément n'est plus optimal
  // (le butin de ton élément tombe là où les ennemis te résistent — arbitrage voulu).
  if (biome !== 'physique') {
    resist[biome] = (resist[biome] ?? 0) + PREDATION_SELF_RESIST
    const vul = BIOME_VULN[biome]
    resist[vul] = (resist[vul] ?? 0) + PREDATION_VULN
  }

  // Auto-attaques TOUJOURS PHYSIQUES (la base). L'élément du biome arrive en plus, via la technique
  // signature (DoT/burst/CC… typé) → « physique + autre chose ». Donc en biome Feu : frappes physiques
  // (→ armure / résist physique) + Brûlure de feu (→ résist feu + Purge). Double levier de survie.
  const damageType: DamageType = 'physique'

  return {
    name,
    maxHp,
    hp: maxHp,
    armor: Math.round(stage * 1.5 * armorMult),
    // Dégâts : croissance VOLONTAIREMENT plus lente que les PV (1.115 vs 1.17, comme les raids) →
    // les PV joueur (≈ linéaires) suivent, fini le one-shot exponentiel en fin de course. La menace
    // vient désormais de la pression soutenue + des techniques télégraphiées (à parer), pas du mur sec.
    damage: Math.round(7 * Math.pow(1.115, stage - 1) * (isBoss ? 1.8 : 1) * dmgMult),
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

/** ilvl de loot attendu pour un palier. */
export function stageIlvl(stage: number): number {
  return Math.max(1, Math.round(stage * 1.5))
}

/** Décalage de chance de rareté selon le palier atteint. */
export function stageLuckTier(stage: number): number {
  return Math.floor(stage / 8)
}
