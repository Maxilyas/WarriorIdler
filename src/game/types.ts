// ---- Stats ----

/** Stats primaires : orientent le build (le talent tree décidera laquelle scaler). */
export type PrimaryStat = 'force' | 'agilite' | 'intelligence' | 'endurance'

/**
 * Stats secondaires : les "ratings" qui créent les synergies, groupées par rôle.
 * Le pool est large mais chaque objet n'en porte qu'un petit nombre fixe (selon la
 * rareté) → l'itémisation devient un choix entre offense, survie et soutien.
 */
export type SecondaryStat =
  // --- Offensif ---
  | 'critique' // chance de coup critique
  | 'degatsCrit' // multiplicateur des coups critiques
  | 'hate' // vitesse d'attaque / d'incantation
  | 'maitrise' // effet d'archétype (Force=bruiser, Agi=crit, Int=glass cannon) — distinct par build
  | 'penetration' // ignore une partie des résistances/armure ennemies
  | 'precision' // annule l'esquive ennemie (touché garanti contre les boss fuyants)
  | 'alteration' // amplifie les dégâts sur la durée (saignement/poison/feu)
  | 'degatsBoss' // +% de dégâts contre les boss & élites (farm de donjons/raids)
  // --- Défensif ---
  | 'reductionDegats' // réduction plate des dégâts subis
  | 'esquive' // chance d'éviter complètement un coup
  | 'barriere' // bouclier de départ : PV effectifs en plus (anti-burst)
  | 'tenacite' // réduit la durée des étourdissements/contrôles ennemis
  | 'purge' // réduit durée ET intensité des altérations subies (DoT/debuffs ennemis)
  // --- Soutien ---
  | 'regen' // régénération des PV
  // --- RARES (apparition très faible, effets puissants) ---
  | 'volDeVie' // soigne en infligeant des dégâts
  | 'surpuissance' // +% de dégâts globaux (multiplicatif)
  | 'multifrappe' // chance de frapper une seconde fois
  | 'recuperation' // réduit le temps de recharge des capacités

export type StatKey = PrimaryStat | SecondaryStat

/** Un sac de stats, toutes optionnelles. */
export type StatBlock = Partial<Record<StatKey, number>>

// ---- Raretés ----

export type RarityId =
  | 'mediocre'
  | 'commun'
  | 'inhabituel'
  | 'rare'
  | 'epique'
  | 'legendaire'
  | 'artefact'
  | 'patrimoine'
  | 'mythique'
  | 'ascendant'
  | 'celeste'
  | 'eternel'
  | 'cosmique'
  | 'abyssal'
  | 'primordial'
  | 'transcendant'

export interface Rarity {
  id: RarityId
  name: string
  tier: number
  color: string
  affixCount: number
  statMult: number
  weight: number
}

// ---- Types de dégâts ----

export type DamageType =
  | 'physique'
  | 'feu'
  | 'froid'
  | 'foudre'
  | 'arcane'
  | 'ombre'
  | 'nature'

// ---- Affixes ----

/**
 * Une « ligne » d'objet. Le nombre de lignes est FIXE par rareté (2→6) ; chaque ligne
 * est soit une stat secondaire, soit un bonus de dégâts d'un type, soit une résistance
 * à un type. Le joueur arbitre offense ↔ survie sur un budget de lignes limité.
 */
export type AffixKind = 'stat' | 'dmgType' | 'resist'

export interface Affix {
  kind: AffixKind
  /** Renseigné si kind === 'stat'. */
  stat?: SecondaryStat
  /** Renseigné si kind === 'dmgType' (+%dégâts) ou 'resist' (+%résistance). */
  type?: DamageType
  value: number
  /**
   * Nombre d'améliorations par Quintessence élémentaire (lignes typées uniquement).
   * 0/absent = ligne brute ; > 0 = ligne renforcée (marqueur visuel + remboursement au recyclage).
   */
  upgraded?: number
}

// ---- Effets uniques (la future "âme" du jeu : centaines de capacités) ----

/** Rôle d'un effet unique (pour le codex et le ciblage). */
export type UniqueRole = 'dps' | 'heal' | 'tank' | 'resist' | 'utility'

/** Définition d'un effet unique dans le registre (valeurs de base au rang 1). */
export interface UniqueEffect {
  id: string
  name: string
  /** Description (mécanique actuelle + accroche sur les synergies futures). */
  description: string
  /** Rôle principal de l'effet (catalogue couvrant tous les rôles). */
  role: UniqueRole
  /** Bonus de stats de base (rang 1), montés par le rang ET par la rareté/iLvl de l'objet. */
  mods?: StatBlock
  /** Bonus de résistances de base (rang 1), montés par le rang. */
  resistMods?: Partial<Record<DamageType, number>>
  /** Capacité active (proc/sort) débloquée au rang actif — texte d'accroche. */
  active?: string
}

/** Instance d'un effet unique posée sur un objet : référence + rang. */
export interface UniqueInstance {
  id: string
  rank: number
}

// ---- Gemmes (sertissage) ----

/** Une gemme sertie dans une châsse d'objet : élément + qualité (1=Éclatée, 2=Polie, 3=Parfaite). */
export interface GemInstance {
  type: DamageType
  tier: number
}

// ---- Équipement ----

/**
 * EquipSlotId = les 16 EMPLACEMENTS sur le personnage (où l'on équipe).
 * Anneau/Bijou ont deux emplacements (I et II).
 */
export type EquipSlotId =
  | 'tete'
  | 'cou'
  | 'epaules'
  | 'cape'
  | 'torse'
  | 'poignets'
  | 'mains'
  | 'taille'
  | 'jambes'
  | 'pieds'
  | 'anneau1'
  | 'anneau2'
  | 'bijou1'
  | 'bijou2'
  | 'armePrincipale'
  | 'armeSecondaire'

/**
 * ItemType = la NATURE de l'objet. Un objet de type "anneau" peut aller
 * dans l'emplacement Anneau I ou Anneau II.
 */
export type ItemType =
  | 'tete'
  | 'cou'
  | 'epaules'
  | 'cape'
  | 'torse'
  | 'poignets'
  | 'mains'
  | 'taille'
  | 'jambes'
  | 'pieds'
  | 'anneau'
  | 'bijou'
  | 'armePrincipale'
  | 'armeSecondaire'

/** Orientation offensive ↔ défensive d'une pièce (arbitrage dégâts / survie). */
export type ItemOrientation = 'offensif' | 'equilibre' | 'defensif'

/** Stat primaire OFFENSIVE d'un objet (l'Endurance est gérée à part). */
export type OffensiveStat = 'force' | 'agilite' | 'intelligence'

export interface Item {
  id: string
  name: string
  /** Nature de l'objet (détermine dans quels emplacements il peut aller). */
  type: ItemType
  rarity: RarityId
  ilvl: number
  /** Stat primaire offensive (Force / Agilité / Intelligence). */
  primary: OffensiveStat
  primaryValue: number
  /** Endurance garantie sur la pièce (la survie scale avec le stuff). */
  endurance: number
  /** Arbitrage offensif/défensif (répartition du budget primaire ↔ endurance). */
  orientation: ItemOrientation
  /** Lignes de l'objet (stats / dégâts de type / résistances), nombre fixé par la rareté. */
  affixes: Affix[]
  /** Type de dégâts de base (uniquement sur l'arme principale). */
  damageType?: DamageType
  unique?: UniqueInstance
  /** Gemmes serties (le nombre de châsses dépend de la rareté — voir gems.ts). */
  gems?: GemInstance[]
  /** Enchantement runique (id du registre enchants.ts) — une seule rune par pièce. */
  enchant?: string
  /** Pièce de SET (id du registre sets.ts) : bonus à paliers quand plusieurs pièces sont portées. */
  setId?: string
}

export type Equipment = Partial<Record<EquipSlotId, Item>>

// ---- Capacités équipables (powers) ----

export type PowerKind = 'active' | 'passive'

/**
 * Effet d'une capacité ACTIVE (auto-lancée sur cooldown en combat idle).
 * Base : heal / nuke / shield / buffParty / cleave / dot / hot.
 * Ultimes (v0.19) : effets forts à long cooldown qui dynamisent le combat.
 */
export type PowerEffect =
  | 'heal' | 'nuke' | 'shield' | 'buffParty' | 'cleave' | 'dot' | 'hot'
  | 'bigShield'    // énorme bouclier d'absorption (soaké avant les PV)
  | 'invuln'       // immunité brève aux dégâts directs (absorbe une attaque)
  | 'charge'       // enregistre les dégâts infligés pendant `duration`, puis frappe ×magnitude
  | 'frenzy'       // multiplicateur de dégâts temporaire sur le porteur
  | 'executeNuke'  // nuke amplifié par les PV MANQUANTS de la cible (finisher)
  | 'megaCleave'   // cataclysme : énorme dégât de zone (tout le pack)
  | 'bigHeal'      // soin massif de tout le groupe
  | 'lifeNuke'     // grosse frappe qui rend une part des dégâts en vie au lanceur
  | 'rupture'      // brise la régénération ennemie + forte plaie (DoT)
  | 'mark'         // marque la cible : elle subit ×magnitude de dégâts pendant `duration`

/** Définition d'une capacité dans le registre (valeurs de base, montées par le rang plus tard). */
export interface PowerDef {
  id: string
  name: string
  kind: PowerKind
  description: string
  /** Icône propre du sort (affichée en combat & dans l'arbre). À défaut, dérivée du type/effet. */
  icon?: string
  /** Niveau de personnage qui débloque la capacité (l'arbre de talents reprendra ce rôle). */
  unlockLevel: number
  // --- Passives ---
  /** Multiplie la menace générée par ce personnage (rôle tank). */
  threatMult?: number
  /** Réduction des dégâts subis (0.15 = -15%). */
  damageReduction?: number
  /** Bonus de stats permanents. */
  mods?: StatBlock
  // --- Actives (auto-cast) ---
  cooldown?: number // secondes entre deux déclenchements
  effect?: PowerEffect
  /** Magnitude de base de l'effet (mise à l'échelle par la puissance du lanceur ; ou multiplicateur brut pour charge/frenzy/mark). */
  magnitude?: number
  /** Durée (s) des effets temporels : charge, invuln, frenzy, rupture (DoT/anti-régén), mark. */
  duration?: number
  /** Stat primaire UNIQUE qui met la magnitude à l'échelle (sort=INT, frappe=FOR, finesse=AGI). */
  scaleStat?: OffensiveStat
  /**
   * Scaling MULTI-STAT : la capacité prend la MEILLEURE des stats listées (ex. ['force','agilite']
   * pour une frappe d'arme utilisable autant par un build Force qu'Agilité). Prioritaire sur
   * `scaleStat`. Ni l'un ni l'autre = scale sur la STAT DOMINANTE (utilitaire ouvert à tous).
   */
  scaleStats?: OffensiveStat[]
  /** Type de dégât EXPLICITE (sorts élémentaires). À défaut, le sort prend le type de l'arme équipée. */
  damageType?: DamageType
}

// ---- Personnage ----

/** Photo d'un build : talents + capacités équipées + spécialisation (présets, 3 par perso). */
export interface BuildPreset {
  name: string
  talents: Record<string, number>
  powers: (string | null)[]
  primaryBias: PrimaryStat
}

export interface Character {
  id: string
  name: string
  level: number
  xp: number
  base: StatBlock
  equipment: Equipment
  /** 5 emplacements de capacité (id ou null). */
  powers: (string | null)[]
  /** Mode de lancement par emplacement : true/absent = AUTO, false = MANUEL (bouton). */
  powerAuto?: boolean[]
  /** Capacités débloquées (par niveau + par talents). */
  unlockedPowers: string[]
  /** Points de talent non dépensés. */
  talentPoints: number
  /** Talents alloués : id de nœud → rang. */
  talents: Record<string, number>
  primaryBias: PrimaryStat
  /** Présets de build (3 emplacements) — application via respec payant. */
  buildPresets?: (BuildPreset | null)[]
  /** PV courants (les PV max sont dérivés du stuff). */
  hp: number
  /** Étourdissement restant (s) — transitoire, posé par les contrôles ennemis ; n'attaque pas tant que > 0. */
  stun?: number
  /** Altérations subies (DoT ennemis) — transitoire, dps déjà atténué (résist + Purge). */
  dots?: { dps: number; type: DamageType; remaining: number }[]
  /** Affaiblissement (malédiction) — transitoire : multiplie les dégâts du héros tant que remaining > 0. */
  weaken?: { mult: number; remaining: number }
  /** Bouclier d'absorption (sort « Égide titanesque ») — soaké AVANT les PV. Transitoire. */
  absorb?: number
  /** Immunité aux dégâts directs restante (s) — sort « Phase éthérée ». Transitoire. */
  invuln?: number
  /** « Vengeance différée » : enregistre les dégâts infligés puis frappe ×mult à expiration. Transitoire. */
  charge?: { dealt: number; remaining: number; mult: number }
  /** Frénésie (« Furie sanguinaire ») : multiplicateur de dégâts temporaire. Transitoire. */
  frenzy?: { mult: number; remaining: number }
}

// ---- Sorts ennemis (techniques télégraphiées, miroir du kit héros) ----

/**
 * Famille d'effet d'une technique ennemie. Chacune mappe sur un CONTRE du kit héros :
 * - 'dot'    altération sur la durée  → contrée par RÉSISTANCE du type + PURGE (+ régén/EHP)
 * - 'burst'  gros coup télégraphié    → contré par BARRIÈRE (EHP) / ESQUIVE / RÉDUCTION + résist
 * - 'cc'     contrôle (gel/étourdi)   → contré par TÉNACITÉ
 * - 'debuff' malédiction (−dégâts)    → contrée par PURGE
 * - 'drain'  vol de vie ennemi        → contré par BURST (le tuer vite) + résist
 */
export type EnemyAbilityKind = 'dot' | 'burst' | 'cc' | 'debuff' | 'drain'

export interface EnemyAbility {
  kind: EnemyAbilityKind
  element: DamageType
  name: string
  icon: string
  /** Délai (s) entre deux déclenchements. */
  cooldown: number
  /** Puissance, en fraction des dégâts de base de l'ennemi (dps pour les DoT, coup pour les burst). */
  magnitude: number
  /** Préavis (s) : barre de télégraphe avant impact (gros coups). */
  telegraph?: number
  /** Durée (s) des DoT / CC / debuffs. */
  duration?: number
  /** Recharge restante (transitoire, runtime). */
  cd?: number
  /** Temps de télégraphe restant (transitoire) : > 0 = en cours d'incantation. */
  cast?: number
}

// ---- Combat / ennemis ----

export interface Enemy {
  name: string
  maxHp: number
  hp: number
  armor: number
  damage: number
  xp: number
  /** Résistances par type (fraction : 0.25 = -25% dégâts subis ; négatif = vulnérable). */
  resist: Partial<Record<DamageType, number>>
  /** Type de dégâts infligés par l'ennemi (les résistances du héros le réduisent). */
  damageType: DamageType
  /** DoT actif posé par le héros (saignement/poison), résolu au tick. */
  dot?: { dps: number; remaining: number }
  /** Trait déterministe (texture du combat classique) : nom court affiché. */
  trait?: string
  /** Ennemi d'élite (stats accrues + meilleur butin). */
  elite?: boolean
  /** Champion ✦ : rencontre rare nommée, butin exceptionnel (drops + chance de rareté accrus). */
  champion?: boolean
  /** Renfort temporaire (adds de raid) : disparaît après `lifetime` secondes. */
  lifetime?: number
  /** Renfort secondaire (pas le boss / pas la cible d'objectif). */
  add?: boolean
  /** Boss : reçoit les bonus « Dégâts vs Boss » et peut étourdir. */
  boss?: boolean
  /** Chance d'ESQUIVE de l'ennemi (0..1) — annulée par la Précision du héros. */
  dodge?: number
  /** Étourdissement : durée (s) du contrôle infligé périodiquement (boss/élites). */
  ccDur?: number
  /** Minuteur de recharge du contrôle (transitoire, décrémenté au tick). */
  ccCd?: number
  /** Techniques signature (DoT/burst/CC/debuff/drain) selon le biome. Résolues au tick. */
  abilities?: EnemyAbility[]
  /** Suppression de régénération restante (s) — posée par « Hémorragie cosmique » (brise les murs de régén). */
  noRegen?: number
  /** Vulnérabilité — multiplicateur de dégâts SUBIS, posé par « Sceau de faiblesse ». Transitoire. */
  vuln?: { mult: number; remaining: number }
  /** Furie du survivant (duo de boss) : déjà enragé, ne se redéclenche pas. */
  enraged?: boolean
}
