import type { Character, Item } from './types'
import { RARITIES } from './rarities'

/**
 * RUNES : TEMPS, RÈGLES… et PACTES.
 *
 * Une rune par pièce, remplaçable ; graver CONSOMME l'exemplaire possédé. Effets d'ÉQUIPE :
 *  - ⏳ TEMPS  (16) : manipulent les horloges du combat (début, recharges, télégraphes, DoT).
 *  - ⚖️ RÈGLE  (17) : tordent le fonctionnement du JEU (loot, clés, drops, économie) tant que portées.
 *  - 🩸 PACTE  (14) : keystones à la PoE — GROS bonus permanent CONTRE GROS malus.
 *    UN SEUL pacte actif par équipe (deux via « Double pacte », malus ×1,5). Les pactes ne
 *    DROPPENT JAMAIS : uniquement forgés à l'Atelier runique (très cher — destruction de runes).
 *
 * Craft runique (le métier le plus cher du jeu) :
 *  - EFFACEMENT : sacrifier une rune possédée → Fragments runiques 🜁 (1 temps · 2 règle).
 *  - FORGE RUNIQUE : fragments + 🌌 + or (+ 💫 pour les pactes) → la rune de ton CHOIX,
 *    coût ×1,5 à chaque exemplaire déjà forgé de la même rune (anti-spam).
 *  - SURCHARGE : 3 fragments → une rune aléatoire (gamble).
 *
 * Spécialisations étagées (◈ I→V, exclusives) : Chronomancien (efficacité du TEMPS),
 * Législateur (RÈGLES amplifiées), Pactiste (malus des PACTES réduits).
 */

export type RuleId =
  | 'karma' | 'econome' | 'transmutation'
  // extension
  | 'collectionneur' | 'prospecteur' | 'archiviste' | 'tropheiste' | 'clesDouble'
  | 'appat' | 'monomanie' | 'quartzite' | 'coffresDoubles' | 'tisseChasse'
  | 'mecene' | 'bourse' | 'talion' | 'saturnales'

export type TimeRuneId =
  | 'premierElan' | 'boucle' | 'sursis' | 'dilatation'
  // extension
  | 'ouverture' | 'latence' | 'rembobinage' | 'sabliers' | 'usure' | 'hateFunebre'
  | 'preparation' | 'echoTemporel' | 'stase' | 'secondeAube' | 'avanceRapide' | 'grainDeSable'

export type PactId =
  | 'verre' | 'plomb' | 'ermite' | 'meute' | 'jeune' | 'sangVicie' | 'roc'
  | 'berserk' | 'pacifiste' | 'duelliste' | 'lignesLey' | 'colosse' | 'hubris' | 'memento'

export interface EnchantDef {
  id: string
  name: string
  icon: string
  description: string
  /** Rune de TEMPS : manipule les horloges du combat. */
  time?: TimeRuneId
  /** Rune de RÈGLE : tord les règles du jeu. */
  rule?: RuleId
  /** Rune de PACTE : keystone bonus/malus — jamais droppée, un seul actif. */
  pact?: PactId
  /** Marqueur « rare » (les règles sont 2× plus rares au DROP). */
  rare?: boolean
}

export const ENCHANTS: EnchantDef[] = [
  /* ============================ ⏳ TEMPS ============================ */
  { id: 'runePremierElan', name: 'Rune du Premier élan', icon: '⏱️', time: 'premierElan',
    description: 'Les 10 premières secondes de chaque combat : +50% de vitesse d\'attaque.' },
  { id: 'runeBoucle', name: 'Rune de la Boucle', icon: '🔁', time: 'boucle',
    description: 'Toutes les 45 s, les recharges de TOUTE l\'équipe sont remises à zéro.' },
  { id: 'runeSursis', name: 'Rune du Sursis', icon: '🕊️', time: 'sursis',
    description: 'Un héros qui devrait mourir survit à 25% de ses PV (une fois par minute chacun).' },
  { id: 'runeDilatation', name: 'Rune de Dilatation', icon: '🐌', time: 'dilatation',
    description: 'Les incantations télégraphiées des ennemis durent +50% (synergie : Œil de l\'Opportuniste).' },
  // --- extension ---
  { id: 'runeOuverture', name: 'Rune d\'Ouverture', icon: '🔓', time: 'ouverture',
    description: 'Au début de chaque combat, la PLUS LONGUE capacité de chaque héros est déjà rechargée.' },
  { id: 'runeLatence', name: 'Rune de Latence', icon: '🫧', time: 'latence',
    description: 'Les ennemis frappent −30% pendant les 8 premières secondes du combat.' },
  { id: 'runeRembobinage', name: 'Rune de Rembobinage', icon: '⏪', time: 'rembobinage',
    description: 'Un héros qui passe sous 25% PV : ses recharges avancent de 8 s (une fois par combat chacun).' },
  { id: 'runeSabliers', name: 'Rune des Sabliers liés', icon: '⌛', time: 'sabliers',
    description: 'Pendant qu\'un ennemi INCANTE : les recharges de l\'équipe défilent +75% plus vite.' },
  { id: 'runeUsure', name: 'Rune d\'Usure', icon: '🪦', time: 'usure',
    description: '+8% de dégâts infligés par tranche de 10 s de combat (3 tranches max). Le tueur de murs.' },
  { id: 'runeHateFunebre', name: 'Rune de Hâte funèbre', icon: '🪽', time: 'hateFunebre',
    description: 'Chaque ennemi tué : +18% de vitesse d\'attaque pendant 4 s.' },
  { id: 'runePreparation', name: 'Rune de Préparation', icon: '🎒', time: 'preparation',
    description: 'À chaque NOUVEAU combat, toutes les recharges avancent de 3 s.' },
  { id: 'runeEchoTemporel', name: 'Rune d\'Écho temporel', icon: '🌀', time: 'echoTemporel',
    description: 'Toutes les 30 s : la DERNIÈRE capacité lancée par l\'équipe est relancée à 60% d\'effet.' },
  { id: 'runeStase', name: 'Rune de Stase', icon: '🧊', time: 'stase',
    description: 'La montée en puissance des ennemis (Enragé, acharnement) est GELÉE les 15 premières secondes.' },
  { id: 'runeSecondeAube', name: 'Rune de Seconde aube', icon: '🌅', time: 'secondeAube',
    description: 'Le Sursis revient 35% plus vite (synergie : Rune du Sursis).' },
  { id: 'runeAvanceRapide', name: 'Rune d\'Avance rapide', icon: '⏩', time: 'avanceRapide',
    description: 'TES altérations (saignements, plaies) infligent leurs dégâts +40% plus vite.' },
  { id: 'runeGrainDeSable', name: 'Rune du Grain de sable', icon: '⏳', time: 'grainDeSable',
    description: 'La PREMIÈRE incantation de chaque ennemi non-boss est interrompue net.' },

  /* ============================ ⚖️ RÈGLES ============================ */
  { id: 'runeKarma', name: 'Rune du Karma', icon: '🎰', rare: true, rule: 'karma',
    description: 'PITIÉ DU DESTIN : chaque kill sans drop Épique+ augmente ta chance de rareté (+1 cran / 40 kills). Remise à zéro au prochain Épique+.' },
  { id: 'runeEconome', name: 'Rune de l\'Économe', icon: '🗝️', rare: true, rule: 'econome',
    description: '15% de chance de ne PAS consommer la clé (Sceau / Orbe) — pour toi ET tes automates.' },
  { id: 'runeTransmutation', name: 'Rune de Transmutation brute', icon: '⚗️', rare: true, rule: 'transmutation',
    description: 'Les monstres NORMAUX ne droppent plus d\'objets ; en échange, chance de Quintessence et de Gemme ×2. (Boss, élites et champions droppent toujours.)' },
  // --- extension ---
  { id: 'runeCollectionneur', name: 'Rune du Collectionneur', icon: '🧿', rare: true, rule: 'collectionneur',
    description: 'Les gemmes de condition droppées ont 20% de chance de tomber directement au RANG 2.' },
  { id: 'runeProspecteur', name: 'Rune du Prospecteur', icon: '⛏️', rare: true, rule: 'prospecteur',
    description: 'La poussière de gemme 🔹 droppe en DOUBLE, mais les gemmes entières −50%. L\'artisan avant le hasard.' },
  { id: 'runeArchiviste', name: 'Rune de l\'Archiviste', icon: '🗃️', rare: true, rule: 'archiviste',
    description: '+15% d\'XP pour les QUATRE métiers de l\'Atelier.' },
  { id: 'runeTropheiste', name: 'Rune du Trophéiste', icon: '🏆', rare: true, rule: 'tropheiste',
    description: '15% de chance que les Trophées de raid tombent en DOUBLE.' },
  { id: 'runeClesDouble', name: 'Rune des Clés en double', icon: '🔑', rare: true, rule: 'clesDouble',
    description: '15% de chance que les CLÉS gagnées (Sceaux / Orbes) soient doublées.' },
  { id: 'runeAppat', name: 'Rune d\'Appât à champions', icon: '🍖', rare: true, rule: 'appat',
    description: 'Les CHAMPIONS ✦ apparaissent +35% plus souvent en farm.' },
  { id: 'runeMonomanie', name: 'Rune de Monomanie', icon: '🔍', rare: true, rule: 'monomanie',
    description: 'Les objets droppent 2× MOINS, mais avec +1 cran de chance de rareté. La qualité avant la quantité.' },
  { id: 'runeQuartzite', name: 'Rune de Quartzite', icon: '🪨', rare: true, rule: 'quartzite',
    description: 'Les Quintessences du type du biome courant droppent +40% souvent.' },
  { id: 'runeCoffresDoubles', name: 'Rune des Coffres doubles', icon: '🎁', rare: true, rule: 'coffresDoubles',
    description: 'Tes AUTOMATES ont 15% de chance de rapporter un coffre double par run.' },
  { id: 'runeTisseChasse', name: 'Rune du Tisse-châsse', icon: '🕳️', rare: true, rule: 'tisseChasse',
    description: 'Les objets droppés ont +15% de chance de porter une CHÂSSE (de plus).' },
  { id: 'runeMecene', name: 'Rune du Mécène', icon: '🫅', rare: true, rule: 'mecene',
    description: 'L\'or gagné +25%, mais l\'XP de combat −10%. Les artistes coûtent cher.' },
  { id: 'runeBourse', name: 'Rune de la Bourse d\'études', icon: '🎓', rare: true, rule: 'bourse',
    description: 'L\'XP de combat +25%, mais l\'or gagné −10%. Le savoir n\'a pas de prix (si, un peu).' },
  { id: 'runeTalion', name: 'Rune de la Loi du talion', icon: '🦷', rare: true, rule: 'talion',
    description: 'Les ÉLITES et BOSS de farm ont 12% de chance de lâcher leur butin DEUX fois.' },
  { id: 'runeSaturnales', name: 'Rune des Saturnales', icon: '🎉', rare: true, rule: 'saturnales',
    description: 'Le DIMANCHE (réel) : or et XP de farm +15%. Le calendrier a du bon.' },

  /* ============================ 🩸 PACTES ============================ */
  // JAMAIS droppés : forgés à l'Atelier runique uniquement. UN SEUL actif par équipe.
  { id: 'pacteVerre', name: 'Pacte du Verre', icon: '🍷', pact: 'verre',
    description: 'PACTE : +35% de dégâts infligés… ET subis. Tout devient tranchant.' },
  { id: 'pactePlomb', name: 'Pacte du Plomb', icon: '🛢️', pact: 'plomb',
    description: 'PACTE : +35% de PV max, mais −20% de vitesse d\'attaque. Lourd, lent, immortel.' },
  { id: 'pacteErmite', name: 'Pacte de l\'Ermite', icon: '🧙', pact: 'ermite',
    description: 'PACTE : si tu n\'alignes qu\'UN héros — +55% de dégâts et de PV. La voie du solitaire.' },
  { id: 'pacteMeute', name: 'Pacte de la Meute', icon: '🐺', pact: 'meute',
    description: 'PACTE : +8% de dégâts par héros aligné au-delà du premier. La force du nombre.' },
  { id: 'pacteJeune', name: 'Pacte du Jeûne', icon: '🍽️', pact: 'jeune',
    description: 'PACTE : soins et régénération COUPÉS ; chaque ennemi tué rend 6% des PV max à l\'équipe.' },
  { id: 'pacteSangVicie', name: 'Pacte du Sang vicié', icon: '🧛', pact: 'sangVicie',
    description: 'PACTE : la régénération est COUPÉE ; +40% de vol de vie. Vis de ce que tu prends.' },
  { id: 'pacteRoc', name: 'Pacte du Roc', icon: '⛰️', pact: 'roc',
    description: 'PACTE : aucune Riposte possible ; −15% de dégâts subis, toujours. Inébranlable, mais immobile.' },
  { id: 'pacteBerserk', name: 'Pacte du Berserk', icon: '🤬', pact: 'berserk',
    description: 'PACTE : tes PV sont CAPÉS à 60% du maximum ; +30% de dégâts. Vivre, c\'est surfait.' },
  { id: 'pactePacifiste', name: 'Pacte du Pacifiste', icon: '🕊️', pact: 'pacifiste',
    description: 'PACTE : les auto-attaques infligent −90% ; les CAPACITÉS +60%. Tout dans l\'art.' },
  { id: 'pacteDuelliste', name: 'Pacte du Duelliste', icon: '🤺', pact: 'duelliste',
    description: 'PACTE : +40% de dégâts à la cible FOCUS, −30% aux autres. Un seul adversaire à la fois.' },
  { id: 'pacteLignesLey', name: 'Pacte des Lignes ley', icon: '🧵', pact: 'lignesLey',
    description: 'PACTE : TOUS tes dégâts deviennent du type de ton ARME (mono-élément) ; +25% de dégâts.' },
  { id: 'pacteColosse', name: 'Pacte du Colosse', icon: '🗿', pact: 'colosse',
    description: 'PACTE : vitesse d\'attaque FIGÉE à 0,8/s ; chaque coup frappe +60%. Gros. Lent. Définitif.' },
  { id: 'pacteHubris', name: 'Pacte d\'Hubris', icon: '👑', pact: 'hubris',
    description: 'PACTE : or et XP de farm +25%, mais le SURSIS et les survies in extremis sont DÉSACTIVÉS.' },
  { id: 'pacteMemento', name: 'Pacte Memento mori', icon: '💀', pact: 'memento',
    description: 'PACTE : quand un héros tombe, les survivants gagnent +25% de dégâts jusqu\'à la fin du run.' },
]

const BY_ID = new Map(ENCHANTS.map((e) => [e.id, e]))
export function getEnchant(id: string): EnchantDef | undefined {
  return BY_ID.get(id)
}

export const TIME_RUNES: EnchantDef[] = ENCHANTS.filter((e) => e.time)
export const RULE_RUNES: EnchantDef[] = ENCHANTS.filter((e) => e.rule)
export const PACT_RUNES: EnchantDef[] = ENCHANTS.filter((e) => e.pact)

/** Règles de jeu actives sur l'ÉQUIPE (union des runes de règle portées). */
export function equippedRules(characters: Character[]): Set<RuleId> {
  const out = new Set<RuleId>()
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      const def = it?.enchant ? BY_ID.get(it.enchant) : undefined
      if (def?.rule) out.add(def.rule)
    }
  }
  return out
}

/** Runes de TEMPS actives sur l'ÉQUIPE. */
export function equippedTimeRunes(characters: Character[]): Set<TimeRuneId> {
  const out = new Set<TimeRuneId>()
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      const def = it?.enchant ? BY_ID.get(it.enchant) : undefined
      if (def?.time) out.add(def.time)
    }
  }
  return out
}

/** Pactes 🩸 portés par l'équipe, dans l'ordre de découverte (1 actif — 2 via Double pacte). */
export function equippedPacts(characters: Character[]): PactId[] {
  const out: PactId[] = []
  for (const c of characters) {
    for (const slot in c.equipment) {
      const it = c.equipment[slot as keyof typeof c.equipment]
      const def = it?.enchant ? BY_ID.get(it.enchant) : undefined
      if (def?.pact && !out.includes(def.pact)) out.push(def.pact)
    }
  }
  return out
}

/** Effets chiffrés des runes de TEMPS — `tempo` ≥ 1 selon l'étage ◈ Chronomancien. */
export interface TimeRuneMods {
  /** +vitesse d'attaque en début de combat (fraction) pendant `premierElanDur` secondes. */
  premierElan?: number
  premierElanDur?: number
  /** Période (s) de la remise à zéro des recharges (0 = inactif). */
  boucleEvery?: number
  /** Délai (s) entre deux survies in extremis par héros (0 = inactif). */
  sursisCd?: number
  /** Allongement des télégraphes ennemis (fraction). */
  dilatation?: number
  /* — extension — */
  /** 🔓 Ouverture : la plus longue capacité démarre rechargée. */
  ouverture?: boolean
  /** 🫧 Latence : réduction des dégâts ennemis (fraction) pendant 8 s. */
  latence?: number
  /** ⏪ Rembobinage : secondes de recharges rendues quand un héros passe sous 25% PV (1×/combat). */
  rembobinageSec?: number
  /** ⌛ Sabliers liés : vitesse de recharge bonus pendant une incantation ennemie (fraction). */
  sabliers?: number
  /** 🪦 Usure : +dégâts par tranche de 10 s (fraction, 3 tranches max). */
  usurePer?: number
  /** 🪽 Hâte funèbre : +vitesse d'attaque (fraction) pendant 4 s après un kill. */
  hateFunebre?: number
  /** 🎒 Préparation : secondes de recharges rendues à CHAQUE nouveau combat. */
  preparationSec?: number
  /** 🌀 Écho temporel : fraction d'effet de la relance automatique (toutes les 30 s). */
  echoTemporel?: number
  /** 🧊 Stase : secondes de gel de la montée en puissance ennemie. */
  staseSec?: number
  /** ⏩ Avance rapide : accélération des DoT INFLIGÉS (fraction). */
  avanceRapide?: number
  /** ⏳ Grain de sable : 1re incantation des non-boss interrompue. */
  grainDeSable?: boolean
}

export function timeRuneMods(runes: Set<TimeRuneId>, tempo = 1): TimeRuneMods {
  const out: TimeRuneMods = {}
  if (runes.has('premierElan')) { out.premierElan = 0.5 * tempo; out.premierElanDur = 10 }
  if (runes.has('boucle')) out.boucleEvery = Math.round(45 / tempo)
  if (runes.has('sursis')) out.sursisCd = Math.round(60 / tempo)
  if (runes.has('dilatation')) out.dilatation = 0.5 * tempo
  // --- extension ---
  if (runes.has('ouverture')) out.ouverture = true
  if (runes.has('latence')) out.latence = Math.min(0.6, 0.3 * tempo)
  if (runes.has('rembobinage')) out.rembobinageSec = 8 * tempo
  if (runes.has('sabliers')) out.sabliers = 0.75 * tempo
  if (runes.has('usure')) out.usurePer = 0.08 * tempo
  if (runes.has('hateFunebre')) out.hateFunebre = 0.18 * tempo
  if (runes.has('preparation')) out.preparationSec = 3 * tempo
  if (runes.has('echoTemporel')) out.echoTemporel = Math.min(1, 0.6 * tempo)
  if (runes.has('stase')) out.staseSec = 15 * tempo
  if (runes.has('secondeAube') && out.sursisCd) out.sursisCd = Math.round(out.sursisCd * (1 - Math.min(0.6, 0.35 * tempo)))
  if (runes.has('avanceRapide')) out.avanceRapide = 0.4 * tempo
  if (runes.has('grainDeSable')) out.grainDeSable = true
  return out
}

/* ------------------------------------------------------------------ */
/* ⚖️ Amplification des règles (◈ Législateur I→V)                     */
/* ------------------------------------------------------------------ */

/** Multiplicateur des knobs de RÈGLE selon l'étage du Législateur (0 = sans spec). */
export function ruleAmp(tier: number): number {
  return tier >= 5 ? 1.5 : tier >= 3 ? 1.25 : 1
}

/* ------------------------------------------------------------------ */
/* 🩸 Pactes : effets agrégés                                          */
/* ------------------------------------------------------------------ */

/** Effets de combat d'un (ou deux) pacte(s). Les MALUS sont adoucis par ◈ Pactiste,
 *  et ALOURDIS ×1,5 quand « Double pacte » fait cohabiter deux serments. */
export interface PactMods {
  /** Multiplicateur de dégâts infligés (autos + sorts). */
  dmgOut: number
  /** Multiplicateur de dégâts SUBIS. */
  dmgIn: number
  /** Multiplicateur de PV max. */
  hpMult: number
  /** Multiplicateur de vitesse d'attaque (Plomb). */
  apsMult: number
  /** Vitesse d'attaque FORCÉE (Colosse : 0,8/s), 0 = inactif. */
  apsForce: number
  /** Multiplicateur des dégâts d'auto-attaque (Pacifiste : 0,1). */
  autoMult: number
  /** Multiplicateur des CAPACITÉS (Pacifiste). */
  spellMult: number
  /** Soins/régén coupés (Jeûne). */
  noHeal: boolean
  /** Régén seule coupée (Sang vicié). */
  noRegen: boolean
  /** Vol de vie bonus (fraction, Sang vicié). */
  leechBonus: number
  /** PV rendus à l'équipe par kill (fraction, Jeûne). */
  killHeal: number
  /** Riposte forcée à zéro (Roc — immobile, ne contre pas). Ex-noDodge. */
  noRiposte: boolean
  /** PV capés à cette fraction du max (Berserk : 0,6), 0 = inactif. */
  hpCap: number
  /** Bonus vs cible FOCUS / malus hors focus (Duelliste). */
  focusBonus: number
  offFocusMult: number
  /** Mono-élément : tout le profil bascule sur le type de l'ARME (Lignes ley). */
  monoElement: boolean
  /** Or/XP de farm bonus (Hubris) — appliqué aux mêmes sites que Mécène/Bourse. */
  rewardBonus: number
  /** Sursis et survies in extremis désactivés (Hubris). */
  noSursis: boolean
  /** Memento mori : bonus de dégâts des survivants après une mort (fraction). */
  mementoBonus: number
}

export function emptyPactMods(): PactMods {
  return {
    dmgOut: 1, dmgIn: 1, hpMult: 1, apsMult: 1, apsForce: 0, autoMult: 1, spellMult: 1,
    noHeal: false, noRegen: false, leechBonus: 0, killHeal: 0, noRiposte: false, hpCap: 0,
    focusBonus: 0, offFocusMult: 1, monoElement: false, rewardBonus: 0, noSursis: false, mementoBonus: 0,
  }
}

/**
 * Construit les effets des pactes ACTIFS. `malusMult` ≤ 1 (◈ Pactiste), `maxActive` 1 ou 2
 * (Double pacte → les malus repassent ×1,5). `teamSize` = héros alignés.
 */
export function pactMods(pacts: PactId[], teamSize: number, malusMult = 1, maxActive = 1): PactMods {
  const out = emptyPactMods()
  const active = pacts.slice(0, maxActive)
  const heavy = active.length >= 2 ? 1.5 : 1
  // malus effectif : fraction × pactiste × (double pacte ×1,5), borné.
  const mal = (x: number) => Math.min(0.95, x * malusMult * heavy)
  for (const p of active) {
    switch (p) {
      case 'verre': out.dmgOut *= 1.35; out.dmgIn *= 1 + mal(0.35); break
      case 'plomb': out.hpMult *= 1.35; out.apsMult *= 1 - mal(0.2); break
      case 'ermite': if (teamSize === 1) { out.dmgOut *= 1.55; out.hpMult *= 1.55 } break
      case 'meute': out.dmgOut *= 1 + 0.08 * Math.max(0, teamSize - 1); break
      case 'jeune': out.noHeal = true; out.killHeal = 0.06; break
      case 'sangVicie': out.noRegen = true; out.leechBonus = 0.4; break
      case 'roc': out.noRiposte = true; out.dmgIn *= 1 - 0.15; break
      case 'berserk': out.hpCap = Math.max(out.hpCap, Math.min(0.9, 0.6 + (1 - malusMult) * 0.4)); out.dmgOut *= 1.3; break
      case 'pacifiste': out.autoMult *= Math.max(0.05, 1 - mal(0.9)); out.spellMult *= 1.6; break
      case 'duelliste': out.focusBonus += 0.4; out.offFocusMult *= 1 - mal(0.3); break
      case 'lignesLey': out.monoElement = true; out.dmgOut *= 1.25; break
      case 'colosse': out.apsForce = 0.8; out.dmgOut *= 1.6; break
      case 'hubris': out.rewardBonus += 0.25; out.noSursis = true; break
      case 'memento': out.mementoBonus = 0.25; break
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Coûts de gravure & drops                                            */
/* ------------------------------------------------------------------ */

/**
 * Coût de gravure : éclats + 🌌 poussière d'étoile (l'encre du Runiste — thème temps/astres).
 * Coût RÉDUIT — la rareté vient du DROP : graver CONSOMME une rune possédée.
 */
export function enchantCost(_def: EnchantDef, item: Item): { eclats: number; poussiere: number } {
  const tier = RARITIES[item.rarity].tier
  return {
    eclats: Math.round(item.ilvl * 1.5 * tier),
    poussiere: Math.max(1, Math.ceil(tier / 2)),
  }
}

/* ---- RUNES PAR DÉCOUVERTE ----
 * Les runes ne se gravent pas à volonté : elles TOMBENT — raids surtout, hauts donjons un peu —
 * et la gravure CONSOMME l'exemplaire. Les RÈGLES sont 2× plus rares que le TEMPS.
 * Les PACTES ne tombent JAMAIS (forge runique uniquement). */

/** Tire la rune qui tombe (TEMPS pondérée 2 · RÈGLE pondérée 1 · PACTE exclu). */
export function rollRuneDrop(): EnchantDef {
  const pool = ENCHANTS.filter((e) => !e.pact)
  const total = pool.reduce((a, e) => a + (e.rule ? 1 : 2), 0)
  let r = Math.random() * total
  for (const e of pool) { r -= e.rule ? 1 : 2; if (r <= 0) return e }
  return pool[0]
}

/** Chance de rune par CLEAR de raid (monte avec le tier, capée). `greffier` : nœud du Runiste. */
export function raidRuneChance(tier: number, greffierMult = 1): number {
  return Math.min(0.45, (0.05 + 0.025 * tier) * greffierMult)
}

/** Chance de rune par RUN de donjon terminé (très faible — le raid est la vraie source). */
export function dungeonRuneChance(level: number, greffierMult = 1): number {
  return Math.min(0.05, (0.008 + 0.001 * level) * greffierMult)
}

/* ------------------------------------------------------------------ */
/* 🜁 Atelier runique : Effacement · Forge · Surcharge          */
/* ------------------------------------------------------------------ */

/** Fragments runiques 🜁 rendus par l'EFFACEMENT d'une rune possédée. */
export function eraseFragments(def: EnchantDef): number {
  return def.rule ? 2 : def.pact ? 3 : 1
}

export interface RuneForgeCost {
  fragments: number
  poussiere: number
  gold: number
  cosmic: number
}

/** Coût de FORGE d'une rune au choix — ×1,5 par exemplaire déjà forgé de la même rune. */
export function runeForgeCost(def: EnchantDef, alreadyForged = 0): RuneForgeCost {
  const growth = Math.pow(1.5, alreadyForged)
  if (def.pact) return { fragments: Math.ceil(16 * growth), poussiere: Math.ceil(150 * growth), gold: Math.round(10_000_000 * growth), cosmic: Math.ceil(25 * growth) }
  if (def.rule) return { fragments: Math.ceil(10 * growth), poussiere: Math.ceil(60 * growth), gold: Math.round(2_000_000 * growth), cosmic: 0 }
  return { fragments: Math.ceil(6 * growth), poussiere: Math.ceil(25 * growth), gold: Math.round(500_000 * growth), cosmic: 0 }
}

/** SURCHARGE runique : 3 fragments → une rune aléatoire (jamais un pacte). */
export const RUNE_GAMBLE_COST = 3
