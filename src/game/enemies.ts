import type { Enemy, DamageType, EnemyAbility } from './types'
import { DAMAGE_TYPE_LIST, ELEMENT_COUNTER, ELEM_SELF_RESIST, ELEM_VULN } from './damage'
import type { BiomeId } from './biomes'
import { farmReq } from './resist'
import { enemyHp, enemyDmg, enemyArmor, farmDifficultyIlvl, ilvlFarm, murEnrage } from './progression'

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

// ---- MURS (v0.35) : boss de fin de Palier (vague 10) — DESIGN_v0.35 §6 ----
// Le mur est un VRAI boss-classe (~35 s) avec une mécanique DOMINANTE cyclée (l'enrage DPS est
// l'ossature présente partout ; la dominante ajoute le défi de sa dimension). NB v0.35 (tranche 1) :
// la dominante est posée en MÉTADONNÉE (fiche + enrage) ; son application en combat (nova/fortress/
// leech/rotate) arrive avec le câblage du tick (tranche suivante).
const MUR_DOMINANTS = ['berserk', 'nova', 'fortress', 'leech', 'rotate'] as const
/** Mécanique dominante du mur d'un Palier (cycle de 5 ; Palier 1 = course au DPS pure). */
export function murMechanic(palier: number): string {
  return MUR_DOMINANTS[(Math.max(1, palier) - 1) % MUR_DOMINANTS.length]
}
// v0.36 — INTENSITÉ post-Prologue : les Chapitres 1-5 (tuto) restent CHILL ; à partir du Chapitre 6 (les
// vrais Chapitres, où les persos se débloquent), les murs montent en PV et gagnent une RÉGÉN de vie →
// vrai combat DPS / survie / heal (la « dynamique reine » multi-perso). Knobs à éprouver au playtest.
/** Multiplicateur de PV d'un mur selon son Chapitre (×1 jusqu'à Ch.5, puis +10 %/Chapitre → ×2 au Ch.15). */
export function murHpRamp(chapitre: number): number {
  return chapitre <= 5 ? 1 : 1 + 0.10 * (chapitre - 5)
}
/** Régén de vie d'un mur (fraction des PV max/s) : 0 jusqu'à Ch.5, puis 0,8 %/s par Chapitre, capé 4 %/s
 *  → force le BURST/sustain (et un heal d'appoint d'un 2e/3e héros). */
export function murRegenAt(chapitre: number): number {
  return chapitre <= 5 ? 0 : Math.min(0.04, 0.008 * (chapitre - 5))
}
/** Atténuation d'un MUR : rampe douce les tout premiers (jamais infranchissable d'emblée) puis PLEINE
 *  puissance (un mur ne doit pas être bridé par le plateau de farm — il est calé sur la frontière). */
export function murSoftness(stage: number): number {
  if (stage >= ONBOARD_STAGES) return 1
  return Math.max(0.02, onboardingMult(stage) / FARM_PLATEAU)
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

  // v0.35 — MUR : le boss de vague 10 devient un VRAI boss-classe (×11,7, ~35 s à stuff CIBLE), à
  // PLEINE puissance (pas le plateau de farm). Les autres rangs gardent la classe 'trash' × multi de
  // farm. Difficulté = STAGE (frontière, non capée).
  const farmHpMult = isElite ? 2.7 : isChampion ? 4 : 1
  const farmDmgMult = isBoss ? 1.8 : isElite ? 1.4 : isChampion ? 1.25 : 1
  const diffIlvl = farmDifficultyIlvl(stage)
  const traitHp = trait?.hpMult ?? 1
  const traitDmg = trait?.dmgMult ?? 1
  const armorMult = trait?.armorMult ?? 1
  // Atténuation : rampe d'onboarding pour le farm normal ; pour un MUR, rampe douce les tout premiers
  // paliers puis pleine puissance (murSoftness).
  const soft = isBoss ? murSoftness(stage) : onboardingMult(stage)
  const maxHp = Math.round((isBoss ? enemyHp(diffIlvl, 'boss') * murHpRamp(stage / 10) : enemyHp(diffIlvl, 'trash') * farmHpMult) * traitHp * soft)
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

  // Résistance globale (rampe de palier, contrée par la Pénétration) + AFFINITÉ ÉLÉMENTAIRE (v0.37) :
  // l'ennemi RÉSISTE l'élément de son biome et est VULNÉRABLE à l'opposé (ELEMENT_COUNTER). Le Physique
  // est neutre (pas d'opposé). Le tuyau v0.37 (rollHit pour les autos, spellResistMult pour les sorts)
  // applique déjà résist/vuln PAR TYPE → amener le bon élément (ou le multi-classe) devient un levier.
  const ramp = stageResistRamp(stage)
  const resist: Partial<Record<DamageType, number>> = {}
  const counter = ELEMENT_COUNTER[biome]
  if (ramp > 0 || counter) {
    for (const t of DAMAGE_TYPE_LIST) resist[t] = ramp
    if (counter) {
      resist[biome] = Math.min(0.85, ramp + ELEM_SELF_RESIST)       // résiste son propre élément
      resist[counter] = Math.max(-0.5, ramp - ELEM_VULN)            // vulnérable à l'opposé (<0 = bonus)
    }
  }

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
    damage: Math.round(enemyDmg(diffIlvl, 'trash') * farmDmgMult * traitDmg * soft),
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
    // MUR (v0.35) : métadonnée de dominante + enrage (fiche + tick), au Palier = stage / 10.
    ...(isBoss ? {
      boss: true, dodge: 0.15, ccDur: 1.5, ccCd: 7,
      mur: { mechanic: murMechanic(stage / 10), palier: stage / 10, enrageAt: murEnrage(stage / 10), regen: murRegenAt(stage / 10) },
    } : {}),
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
