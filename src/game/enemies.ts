import type { Enemy, DamageType, EnemyAbility } from './types'
import { elementAffinityResist } from './damage'
import type { BiomeId } from './biomes'
import { farmReq } from './resist'
import { ENEMY_DODGE } from './stats'
import { enemyHp, enemyDmg, enemyArmor, farmDifficultyIlvl, ilvlFarm, murEnrage, chapitreOf, vagueOf, CHAPITRE_SIZE } from './progression'

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

/** Boss PAR BIOME (un nom thématique par Chapitre). */
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
/** Chance qu'un ennemi normal (vague > 10) soit un champion. */
const CHAMPION_CHANCE = 0.03

// Les TRAITS déterministes (Blindé/Féroce/Massif…) ont été retirés : la difficulté d'une vague est
// PUREMENT sa position dans l'escalier du Chapitre (cf. waveStat). Plus de pics de stats hors-escalier ;
// les pics de BUTIN restent via élite ◆ / champion ✦.

/** Vague à partir de laquelle les ennemis gagnent une résistance globale croissante. */
const RESIST_RAMP_FROM = 25
const RESIST_RAMP_PER_STAGE = 0.004
const RESIST_RAMP_CAP = 0.55
/** Élite toutes les N vagues (hors boss) : marqueur de meilleur butin. */
const ELITE_EVERY = 7

/** Résistance globale (tous types) d'une vague — croît linéairement, contrée par la Pénétration. */
export function stageResistRamp(stage: number): number {
  if (stage < RESIST_RAMP_FROM) return 0
  return Math.min(RESIST_RAMP_CAP, (stage - RESIST_RAMP_FROM) * RESIST_RAMP_PER_STAGE)
}

/**
 * FACTEUR DE DIFFICULTÉ DU FARM — deux rôles :
 *  1. RAMPE D'ONBOARDING : les premières vagues sont très faibles → un perso NU démarre de zéro
 *     (vague 1 ~50 PV, tuable en 2-3 s), loote ses 1ers objets, s'équipe, progresse.
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
  // Courbe TRÈS douce sur les premières vagues (exposant 2,6) : le joueur early n'a ni keystones
  // (talents au niv 11) ni stuff complet → bien plus faible que les builds optimisés des sims. On lui
  // laisse de l'air pour gear/level/découvrir, puis on rejoint le plateau de farm à la vague 22.
  return Math.max(0.004, FARM_PLATEAU * Math.pow(stage / ONBOARD_STAGES, 2.6))
}

// ---- MURS : boss de fin de Chapitre (vague 10) ----
// Le mur est un VRAI boss-classe (~35 s) bâti sur l'enrage DPS (ossature présente partout) plus, dès le
// Chapitre 6, une régén de vie (sustain check). La mécanique DOMINANTE (murMechanic) sert d'étiquette
// d'archétype sur la fiche (cf. CombatPanel) : ses effets propres (nova/fortress/leech/rotate) ne sont
// PAS distingués en combat pour les murs — ce sont les RAIDS qui les portent (voir raids.ts).
const MUR_DOMINANTS = ['berserk', 'nova', 'fortress', 'leech', 'rotate'] as const
/** Mécanique dominante du mur d'un Palier (cycle de 5 ; Palier 1 = course au DPS pure). */
export function murMechanic(palier: number): string {
  return MUR_DOMINANTS[(Math.max(1, palier) - 1) % MUR_DOMINANTS.length]
}
// INTENSITÉ post-Prologue : les Chapitres 1-5 (tuto) restent CHILL ; à partir du Chapitre 6 (les vrais
// Chapitres, où les persos se débloquent), les murs montent en PV et gagnent une RÉGÉN de vie → vrai
// combat DPS / survie / heal (la « dynamique reine » multi-perso).
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

/** Multiplicateur de dégâts (DPS auto) d'un boss-mur vs le trash (= farmDmgMult du boss). */
export const MUR_DMG_MULT = 1.8

/** PV « nus » du boss-mur de fin de Chapitre (stage = chapitre·10), avant trait/multi-perso. SOURCE DE
 *  VÉRITÉ partagée : `makeEnemy` (le mur lui-même) ET `raids.ts` (les raids se calent AU-DESSUS du mur
 *  du Chapitre qu'ils gardent). `murSoftness` gère la rampe d'onboarding des tout premiers murs. */
export function murBossHp(stage: number): number {
  return enemyHp(farmDifficultyIlvl(stage), 'boss') * murHpRamp(chapitreOf(stage)) * murSoftness(stage)
}
/** Dégâts/s « nus » du boss-mur (auto-attaque) — même base que `makeEnemy`. */
export function murBossDmg(stage: number): number {
  return enemyDmg(farmDifficultyIlvl(stage), 'trash') * MUR_DMG_MULT * murSoftness(stage)
}

// ESCALIER DES VAGUES (ACCESSIBLE). Chaque Chapitre repart BAS et monte jusqu'à son boss :
// vague V = V·10 % du boss DU CHAPITRE (vague 1 = 10 %, vague 9 ≈ 90 %, vague 10 = boss) → plus de
// plateau farmable juste sous le boss. MAIS l'escalier « fond » progressivement pour rester ACCESSIBLE :
// pendant le PROLOGUE (Ch ≤ STAIRCASE_PROLOGUE) les vagues gardent la courbe d'onboarding (un perso NU
// tue la vague 1 ; ancrer au boss-classe ×11,7 d'emblée la rendrait imbattable sans stuff) ; l'escalier
// monte ensuite jusqu'à PLEIN à STAIRCASE_FULL (le joueur a alors du stuff de raid). Entre : mélange.
const STAIRCASE_PROLOGUE = 4   // dernier Chapitre 100 % accessible (courbe d'onboarding pure)
const STAIRCASE_FULL = 8       // 1er Chapitre à escalier PLEIN (ancré au boss)
/** Part d'escalier (0 = courbe accessible du prologue · 1 = escalier plein ancré au boss) selon le Chapitre. */
export function staircaseBlend(chapitre: number): number {
  return Math.max(0, Math.min(1, (chapitre - STAIRCASE_PROLOGUE) / (STAIRCASE_FULL - STAIRCASE_PROLOGUE)))
}
/**
 * PV ou DPS d'une vague NORMALE : mélange (par `staircaseBlend`) de
 *  - ACCESSIBLE (`accessible`) : la courbe trash×onboarding (prologue naked-friendly), et
 *  - ESCALIER : `metricBoss(bossDuChapitre) × (vague/10)` (chaque Chapitre repart à 10 % du boss et monte).
 * `metricBoss` = `murBossHp` (PV) ou `murBossDmg` (DPS).
 */
export function waveStat(stage: number, metricBoss: (s: number) => number, accessible: number): number {
  const c = chapitreOf(stage)
  const stair = metricBoss(c * CHAPITRE_SIZE) * (vagueOf(stage) / CHAPITRE_SIZE)
  return accessible + (stair - accessible) * staircaseBlend(c)
}

/** Crée l'ennemi correspondant à une vague (stage) dans un biome donné. Boss toutes les 10 vagues.
 *  `championMult` (🍖 rune d'Appât) : multiplie la chance d'apparition des champions ✦. */
export function makeEnemy(stage: number, biome: BiomeId = 'physique', championMult = 1): Enemy {
  const isBoss = stage % 10 === 0
  // Champion ✦ : rencontre rare et ALÉATOIRE — désormais un pic de BUTIN (jackpot), plus un pic de
  // difficulté. Élite ◆ tous les N paliers : marqueur de butin lui aussi.
  const isChampion = !isBoss && stage > 10 && Math.random() < CHAMPION_CHANCE * championMult
  const isElite = !isBoss && !isChampion && stage % ELITE_EVERY === 0 && stage > ELITE_EVERY

  // ESCALIER ACCESSIBLE : la difficulté (PV/DPS) d'une vague NORMALE = waveStat (courbe d'onboarding du
  // prologue → escalier ancré au boss, fondu progressif). Plus de multiplicateurs élite/champion/trait
  // (« fondus dans l'escalier »). Le boss (vague 10) = murBossHp/murBossDmg.
  const diffIlvl = farmDifficultyIlvl(stage)
  const trashHp = enemyHp(diffIlvl, 'trash') * onboardingMult(stage)
  const maxHp = Math.round(isBoss ? murBossHp(stage) : waveStat(stage, murBossHp, trashHp))
  const pool = BIOME_ENEMIES[biome]
  const baseName = pool[(stage - 1) % pool.length]
  const bosses = BIOME_BOSSES[biome]
  const name = isBoss
    ? `★ ${bosses[Math.floor(stage / 10 - 1) % bosses.length]}`
    : isChampion
      ? `✦ ${baseName} ${CHAMPION_TITLES[Math.floor(Math.random() * CHAMPION_TITLES.length)]}`
      : isElite
        ? `◆ ${baseName} d'élite`
        : stage % 2 === 1
          ? `${baseName} ${EPITHETS[(stage * 3 + baseName.length) % EPITHETS.length]}`
          : baseName

  // Résistance globale (rampe de vague, contrée par la Pénétration) + AFFINITÉ ÉLÉMENTAIRE : l'ennemi
  // RÉSISTE l'élément de son biome et est VULNÉRABLE à l'opposé (Physique neutre). Le tuyau de dégâts
  // (rollHit autos, spellResistMult sorts) applique résist/vuln par type → amener le bon élément (ou le
  // multi-classe) devient un levier. (Donjons et raids partagent ce modèle.)
  const resist = elementAffinityResist(biome, stageResistRamp(stage))

  // Auto-attaques TOUJOURS PHYSIQUES (la base). L'élément du biome arrive en plus, via la technique
  // signature (DoT/burst/CC… typé) → « physique + autre chose ». Donc en biome Feu : frappes physiques
  // (→ armure / résist physique) + Brûlure de feu (→ résist feu + Purge). Double levier de survie.
  const damageType: DamageType = 'physique'

  return {
    name,
    maxHp,
    hp: maxHp,
    armor: Math.round(enemyArmor(diffIlvl)),
    // Dégâts (DPS auto) : MÊME escalier accessible que les PV (waveStat). La menace vient des
    // techniques télégraphiées + du check de résistance (req), pas d'un mur sec.
    damage: Math.round(isBoss ? murBossDmg(stage) : waveStat(stage, murBossDmg, enemyDmg(diffIlvl, 'trash') * onboardingMult(stage))),
    // XP rare (monter de niveau se mérite — levelling volontairement lent au début).
    xp: Math.round((isBoss ? 38 : isElite || isChampion ? 17 : 4) * Math.pow(1.115, stage - 1)),
    resist,
    damageType,
    ...(isElite ? { trait: 'Élite' } : isChampion ? { trait: 'Champion ✦' } : {}),
    // Exigence de résistance sur l'élément du biome — nulle avant la vague 45, douce après.
    ...(() => { const rq = farmReq(stage); return rq > 0 ? { reqs: { [biome]: rq } as Partial<Record<DamageType, number>> } : {} })(),
    // l'élite/champion ne déclenche pas de capacité spéciale (fondu dans l'escalier) : seul le biome
    // (signature) et le boss portent les techniques.
    ...(() => { const a = biomeAbilities(biome, isBoss, false); return a.length ? { abilities: a } : {} })(),
    // Élite/champion = marqueurs de BUTIN uniquement (pas de pic de difficulté : ni esquive, ni stats).
    ...(isElite || isChampion ? { elite: true } : {}),
    ...(isChampion ? { champion: true } : {}),
    // Boss : reçoivent les « Dégâts vs Boss », esquivent (→ Précision, hit cap boss 1500) et étourdissent (→ Résilience).
    // MUR : métadonnée de dominante + enrage (fiche + tick), au Palier = stage / 10 (= n° de Chapitre).
    ...(isBoss ? {
      boss: true, dodge: ENEMY_DODGE.boss, ccDur: 1.5, ccCd: 7,
      mur: { mechanic: murMechanic(stage / 10), palier: stage / 10, enrageAt: murEnrage(stage / 10), regen: murRegenAt(stage / 10) },
    } : {}),
  }
}

export function isBossStage(stage: number): boolean {
  return stage % 10 === 0
}

/** ilvl de loot attendu pour une vague (= ilvlFarm = frontière − LAG, capé à ILVL_CAP_BASE — le loot
 *  reste en retard permanent sur la difficulté de la vague). */
export function stageIlvl(stage: number): number {
  return ilvlFarm(stage)
}

/** Décalage de chance de rareté selon la vague atteinte. */
export function stageLuckTier(stage: number): number {
  return Math.floor(stage / 8)
}
