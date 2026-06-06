// ---- Stats ----

/** Stats primaires : orientent le build (le talent tree décidera laquelle scaler). */
export type PrimaryStat = 'force' | 'agilite' | 'intelligence' | 'endurance'

/** Stats secondaires : les "ratings" qui créent les synergies. */
export type SecondaryStat =
  | 'critique'
  | 'hate'
  | 'maitrise'
  | 'polyvalence'
  | 'volDeVie'

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

/** Affixe de dégât élémentaire : +value% de dégâts du type donné. */
export interface TypeAffix {
  type: DamageType
  value: number
}

// ---- Affixes ----

export interface Affix {
  stat: SecondaryStat
  value: number
}

// ---- Effets uniques (la future "âme" du jeu : centaines de capacités) ----

/** Définition d'un effet unique dans le registre (valeurs de base au rang 1). */
export interface UniqueEffect {
  id: string
  name: string
  /** Description (mécanique actuelle + accroche sur les synergies futures). */
  description: string
  /** Bonus de stats de base (rang 1), montés par le rang. */
  mods?: StatBlock
}

/** Instance d'un effet unique posée sur un objet : référence + rang. */
export interface UniqueInstance {
  id: string
  rank: number
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
  affixes: Affix[]
  /** Type de dégâts de base (uniquement sur l'arme principale). */
  damageType?: DamageType
  /** Affixes de dégâts élémentaires (+% par type). */
  typeAffixes?: TypeAffix[]
  unique?: UniqueInstance
}

export type Equipment = Partial<Record<EquipSlotId, Item>>

// ---- Capacités équipables (powers) ----

export type PowerKind = 'active' | 'passive'

/** Effet d'une capacité ACTIVE (auto-lancée sur cooldown en combat idle). */
export type PowerEffect = 'heal' | 'nuke' | 'shield' | 'buffParty' | 'cleave'

/** Définition d'une capacité dans le registre (valeurs de base, montées par le rang plus tard). */
export interface PowerDef {
  id: string
  name: string
  kind: PowerKind
  description: string
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
  /** Magnitude de base de l'effet (mise à l'échelle par la puissance du lanceur). */
  magnitude?: number
}

// ---- Personnage ----

export interface Character {
  id: string
  name: string
  level: number
  xp: number
  base: StatBlock
  equipment: Equipment
  /** 5 emplacements de capacité (id ou null). */
  powers: (string | null)[]
  /** Capacités débloquées (par niveau + par talents). */
  unlockedPowers: string[]
  /** Points de talent non dépensés. */
  talentPoints: number
  /** Talents alloués : id de nœud → rang. */
  talents: Record<string, number>
  primaryBias: PrimaryStat
  /** PV courants (les PV max sont dérivés du stuff). */
  hp: number
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
}
