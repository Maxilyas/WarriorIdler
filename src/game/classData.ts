import type { StatBlock, DamageType, OffensiveStat } from './types'

/**
 * Socle de données partagé des CLASSES (refonte v0.29.2 — arbres HANDCRAFTED).
 *
 * v0.29.2 : on abandonne la génération par gabarit (trop linéaire/uniforme). Chaque archétype
 * a désormais un arbre DESSINÉ À LA MAIN dans talents.ts (topologie unique + nœuds intermédiaires).
 * Ce module ne garde que les TYPES partagés par le moteur — au premier rang KeystoneEffect, dont
 * combat.ts / character.ts dépendent (re-exporté par talents.ts).
 */

export type Role = 'dps' | 'tank' | 'heal'

/** Catégories (le « T0 » qui regroupe les classes — par type d'armure, façon WoW). */
export type CategoryId = 'plaque' | 'mailles' | 'cuir' | 'tissu'

/** Effet fort d'un keystone, résolu par character.ts / combat.ts. */
export interface KeystoneEffect {
  statAsOther?: { from: OffensiveStat; to: OffensiveStat; frac: number }
  enduranceAs?: { to: OffensiveStat; frac: number }
  convertDamage?: { from: DamageType; to: DamageType; frac: number }
  splashType?: { from: DamageType; to: DamageType; frac: number }
  convertFromMain?: { to: DamageType; frac: number }
  splashFromMain?: { to: DamageType; frac: number }
  splashFromMainAll?: number
  dot?: { frac: number; duration: number }
  hot?: number
  damageMult?: number
  flatDr?: number
  thorns?: number
  multistrike?: number
  executeBonus?: { threshold: number; mult: number }
  lowHpBonus?: { threshold: number; mult: number }
  highHpBonus?: { threshold: number; mult: number }
  healToDamage?: number
  cleaveAuto?: number
  perEnemyBonus?: number
  dotLeech?: number
  dotAoe?: number
  openerBonus?: { mult: number; seconds: number }
  chainArc?: { frac: number; targets: number }
  staticN?: { every: number; mult: number }
  cdrOnCast?: number
  spellMult?: number
  afflictionFuel?: { per: number; cap: number }
  surplusToDamage?: number
  adaptiveResist?: { gain: number; cap: number }
  shareResist?: number
  surplusRegen?: number
  reqReduction?: number
  multiTypeBonus?: { per: number; threshold: number }

  /* ---- v0.29.2 : socle VOLEUR (mécaniques réutilisables) ---- */
  /** ASSASSIN : le venin s'empile plus haut (cap) et chaque stack frappe plus fort (perStack frac/s). */
  poison?: { perStack: number; maxStacks: number }
  /** OMBRELAME : relève le plafond de Points de Combo (au-delà de la base 5). */
  comboCap?: number
  /** OMBRELAME : tes générateurs donnent +comboGen Point(s) de Combo en plus. */
  comboGen?: number
  /** OMBRELAME : amplifie les dégâts des FINISSEURS (+finisherMult). */
  finisherMult?: number

  /* ---- v0.29.4 : socle TAGS + combos (réutilisable par TOUTES les classes) ---- */
  /** Bonus de dégâts à TOUS les sorts portant ce tag (multi-classe : marche pour les sorts des autres classes). */
  tagBonus?: { tag: string; damageMult: number }
  /** ASSASSIN « Catalyse » : la Distillation DOUBLE le venin avant de détoner. */
  detonateDouble?: boolean
  /** OMBRELAME : un finisseur REND `comboRefund` Points de Combo (spam de finisseurs). */
  comboRefund?: number

  /* ---- v0.29.6 : INVOCATION (pets) + CONTRÔLE (réutilisables) ---- */
  /** INVOCATION : un familier/totem/démon inflige en continu `petDps` × ton DPS d'auto-attaque. */
  petDps?: number
  /** CONTRÔLE « shatter » : +`shatter` de dégâts (mult) aux ennemis CONTRÔLÉS (gelés/ralentis). */
  shatter?: number

  /* ---- v0.30 : PYROMANCIEN (crits embrasent) ---- */
  /** PYROMANCIEN : un coup CRITIQUE pose/rafraîchit un Embrasement (DoT feu = `frac` du coup/s, `duration` s).
   *  Plusieurs nœuds cumulent leur `frac` (la durée prend le max). Amplifié par l'Altération. */
  igniteOnCrit?: { frac: number; duration: number }

  /* ---- v0.30 : REMPART (tank Rage → bouclier) ---- */
  /** REMPART : un FINISSEUR accorde au lanceur un bouclier d'absorption = `finisherShield` × ses dégâts.
   *  Convertit la dépense de Rage en survie (Bloc/Ignore Pain). Somme entre keystones. */
  finisherShield?: number

  /* ---- v0.31 : MAGE (mécaniques signature) ---- */
  /** PYROMANCIEN « Hot Streak » : tes sorts [feu] accumulent de la Chaleur (montée pondérée par le Critique) ;
   *  à `cap`, ton prochain sort [feu][direct] inflige ×`mult` (puis Chaleur → 0). On garde le plus fort. */
  hotStreak?: { cap: number; mult: number }
  /** ARCANISTE « Surcharge instable » : quand tes Charges atteignent le max, tu entres en Surcharge `window` s
   *  (dégâts ×`mult`, recharges ×2) ; la Surcharge CONSOMME tes Charges. On garde la plus longue/forte. */
  overload?: { window: number; mult: number }
}

/** Vocabulaire des TAGS de comportement (12) — les 7 types de dégâts servent aussi de tags. */
export const BEHAVIOR_TAGS = [
  'mono', 'zone', 'dot', 'direct', 'generateur', 'finisseur',
  'furtif', 'soin', 'protection', 'ultime', 'invocation', 'controle',
] as const

/** Spécification compacte d'un sort (→ PowerDef dans powers.ts). */
export interface SpellSpec {
  id: string
  name: string
  icon?: string
  effect: import('./types').PowerEffect
  mag: number
  cd: number
  type?: DamageType
  scale?: OffensiveStat | OffensiveStat[]
  duration?: number
  /** Tags de comportement (mono/zone/dot/finisseur…) — pour les modificateurs cross-classe. */
  tags?: string[]
  /** Nom de la RESSOURCE build/spend (générateur/finisseur) — défaut « Combo » si absent. */
  resource?: string
}

/** Spécification d'un nœud-keystone (effet + stats/résist éventuels). */
export interface KsSpec {
  name: string
  desc: string
  stat?: StatBlock
  resist?: Partial<Record<DamageType, number>>
  ks?: KeystoneEffect
}
