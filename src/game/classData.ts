import type { StatBlock, DamageType, OffensiveStat, PowerEffect } from './types'

/**
 * SOURCE DE VÉRITÉ des CLASSES (refonte v0.29.1 — hiérarchie WoW).
 *
 *   RACINE (Éveil)  →  13 CLASSES  →  leurs ARCHÉTYPES (specs, 39)  →  branches profondes.
 *
 * Ce module est consommé par :
 *   - powers.ts   → génère TOUS les sorts (signature / secondaire / ultime de chaque spec).
 *   - talents.ts  → génère l'arbre (nœud de classe → entrées de spec → sous-arbres riches).
 * Un seul endroit à éditer → zéro désynchro entre sorts et nœuds.
 */

export type Role = 'dps' | 'tank' | 'heal'

export type ClassId =
  | 'guerrier' | 'paladin' | 'chasseur' | 'voleur' | 'pretre' | 'chaman' | 'mage'
  | 'demoniste' | 'moine' | 'druide' | 'demonhunter' | 'dk' | 'evoker'

/** Effet fort d'un keystone, résolu par character.ts / combat.ts. (Possédé ici, re-exporté par talents.ts.) */
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
}

/** Spécification compacte d'un sort (→ PowerDef généré dans powers.ts). */
export interface SpellSpec {
  id: string
  name: string
  icon?: string
  effect: PowerEffect
  /** Magnitude (× puissance) ou multiplicateur brut (charge/frenzy/mark). */
  mag: number
  cd: number
  type?: DamageType
  scale?: OffensiveStat | OffensiveStat[]
  duration?: number
}

/** Spécification d'un nœud-keystone (effet + stats/résist éventuels). */
export interface KsSpec {
  name: string
  desc: string
  stat?: StatBlock
  resist?: Partial<Record<DamageType, number>>
  ks?: KeystoneEffect
}

export interface SpecDef {
  id: string
  name: string
  wow: string
  role: Role
  color: string
  icon: string
  primary: OffensiveStat | 'endurance'
  type: DamageType
  sig: SpellSpec
  q: SpellSpec
  ult: SpellSpec
  identity: KsSpec
  ks2: KsSpec
  cap: KsSpec
  /** 3 nœuds de stats (les branches « passives » qui étoffent le sous-arbre). */
  sA: StatBlock
  sB: StatBlock
  sC: StatBlock
}

export interface ClassDef {
  id: ClassId
  name: string
  wow: string
  color: string
  icon: string
  /** Passif de classe (nœud racine de la classe). */
  passive: KsSpec
  /** Sort de classe de base (débloqué au nœud de classe). */
  classSpell: SpellSpec
  specs: SpecDef[]
}

/* Helpers de construction compacts. */
const sp = (id: string, name: string, icon: string, effect: PowerEffect, mag: number, cd: number, type?: DamageType, scale?: OffensiveStat | OffensiveStat[], duration?: number): SpellSpec =>
  ({ id, name, icon, effect, mag, cd, ...(type ? { type } : {}), ...(scale ? { scale } : {}), ...(duration ? { duration } : {}) })
const dmg = (m: number, name: string, desc?: string): KsSpec => ({ name, desc: desc ?? `+${Math.round((m - 1) * 100)}% de dégâts.`, ks: { damageMult: m } })
const F: OffensiveStat = 'force', A: OffensiveStat = 'agilite', I: OffensiveStat = 'intelligence'
const FA: OffensiveStat[] = ['force', 'agilite'], AI: OffensiveStat[] = ['agilite', 'intelligence']

export const CLASSES: ClassDef[] = [
  /* ============================ GUERRIER ============================ */
  {
    id: 'guerrier', name: 'Guerrier', wow: 'Warrior', color: '#ff6b6b', icon: '⚔',
    passive: { name: 'Maîtrise des armes', desc: '+25 Force, +20 Endurance.', stat: { force: 25, endurance: 20 } },
    classSpell: sp('guerrier_cls', 'Frappe héroïque', '⚔️', 'nuke', 2.6, 3, undefined, FA),
    specs: [
      { id: 'armes', name: 'Armes', wow: 'Arms', role: 'dps', color: '#ff6b6b', icon: '⚔', primary: F, type: 'physique',
        sig: sp('armes_sig', 'Frappe lourde', '🔨', 'nuke', 4.4, 3.5, undefined, FA),
        q: sp('armes_q', 'Fracasser', '💢', 'nuke', 5.4, 4, undefined, FA),
        ult: sp('armes_ult', 'Lame de titan', '⚔️', 'executeNuke', 5, 12, undefined, FA),
        identity: { name: 'Exécuter', desc: 'Exécute les ennemis sous 35% de PV (×2,2).', stat: { degatsBoss: 20 }, ks: { executeBonus: { threshold: 0.35, mult: 2.2 } } },
        ks2: dmg(1.10, 'Profonde entaille', '+10% de dégâts.'),
        cap: dmg(1.14, 'Maître de guerre', '+14% de dégâts, +40 Dégâts boss.'),
        sA: { degatsBoss: 22 }, sB: { critique: 20 }, sC: { force: 22 } },
      { id: 'fureur', name: 'Fureur', wow: 'Fury', role: 'dps', color: '#fa5252', icon: '🪓', primary: F, type: 'physique',
        sig: sp('fureur_sig', 'Tourbillon', '🌀', 'cleave', 2.8, 2.5, undefined, FA),
        q: sp('fureur_q', 'Décimer', '🪓', 'nuke', 4.2, 3, undefined, FA),
        ult: sp('fureur_ult', 'Furie sanguinaire', '😡', 'frenzy', 2, 22, undefined, FA, 6),
        identity: { name: 'Berserk', desc: '+40% de dégâts sous 50% de tes PV.', ks: { lowHpBonus: { threshold: 0.5, mult: 1.4 } } },
        ks2: { name: 'Déchaînement', desc: '+20% de chance de Multifrappe.', ks: { multistrike: 0.20 } },
        cap: dmg(1.12, 'Soif de sang', '+12% de dégâts.'),
        sA: { hate: 26 }, sB: { maitrise: 24 }, sC: { critique: 18 } },
      { id: 'gardien', name: 'Gardien', wow: 'Protection', role: 'tank', color: '#ffd43b', icon: '🛡', primary: F, type: 'physique',
        sig: sp('gardien_sig', 'Coup de bouclier', '🛡️', 'nuke', 2.4, 3, undefined, FA),
        q: sp('gardien_q', 'Cri de ralliement', '📣', 'shield', 3, 6, undefined, FA),
        ult: sp('gardien_ult', 'Égide titanesque', '🔰', 'bigShield', 14, 30),
        identity: { name: 'Mur de boucliers', desc: '-15% de dégâts subis, renvoie 20% des dégâts.', ks: { flatDr: 0.15, thorns: 0.2 } },
        ks2: { name: 'Représailles', desc: 'Renvoie 25% des dégâts subis.', ks: { thorns: 0.25 } },
        cap: { name: 'Inébranlable', desc: '-20% de dégâts subis, +200 Endurance.', stat: { endurance: 200 }, ks: { flatDr: 0.2 } },
        sA: { reductionDegats: 24 }, sB: { endurance: 30 }, sC: { barriere: 120 } },
      { id: 'colosse', name: 'Colosse', wow: 'Juggernaut', role: 'tank', color: '#a9b4c2', icon: '🗿', primary: 'endurance', type: 'physique',
        sig: sp('colosse_sig', 'Onde de choc', '💥', 'cleave', 2.4, 3.2, undefined, FA),
        q: sp('colosse_q', 'Charge dévastatrice', '🐗', 'nuke', 3.6, 4, undefined, FA),
        ult: sp('colosse_ult', 'Séisme', '🌋', 'megaCleave', 6, 18, undefined, FA),
        identity: { name: 'Force du titan', desc: '35% de ton Endurance compte comme Force.', ks: { enduranceAs: { to: 'force', frac: 0.35 } } },
        ks2: { name: 'Rouleau compresseur', desc: '+30% de dégâts au-dessus de 70% PV.', ks: { highHpBonus: { threshold: 0.7, mult: 1.3 } } },
        cap: { name: 'Montagne vivante', desc: '+200 Endurance, -15% de dégâts subis.', stat: { endurance: 200 }, ks: { flatDr: 0.15 } },
        sA: { endurance: 45 }, sB: { reductionDegats: 18 }, sC: { tenacite: 22 } },
    ],
  },

  /* ============================ PALADIN ============================ */
  {
    id: 'paladin', name: 'Paladin', wow: 'Paladin', color: '#ffd43b', icon: '⚜',
    passive: { name: 'Lumière intérieure', desc: '+20 Force, +20 Intelligence.', stat: { force: 20, intelligence: 20 } },
    classSpell: sp('paladin_cls', 'Marteau de justice', '🔨', 'nuke', 2.6, 3, 'arcane', FA),
    specs: [
      { id: 'vindicte', name: 'Vindicte', wow: 'Vindicte', role: 'dps', color: '#ffd43b', icon: '⚜', primary: F, type: 'arcane',
        sig: sp('vindicte_sig', 'Châtiment sacré', '⚜️', 'nuke', 4.2, 3, 'arcane', FA),
        q: sp('vindicte_q', 'Tempête divine', '✨', 'cleave', 3.2, 3.2, 'arcane', FA),
        ult: sp('vindicte_ult', 'Verdict du templier', '⚖️', 'executeNuke', 5, 12, 'arcane', FA),
        identity: dmg(1.18, 'Croisade', '+18% de dégâts sacrés.'),
        ks2: { name: 'Zèle', desc: 'Exécute les ennemis sous 20% de PV (×1,8).', ks: { executeBonus: { threshold: 0.2, mult: 1.8 } } },
        cap: dmg(1.12, 'Avatar', '+12% de dégâts, +40 Dégâts boss.'),
        sA: { maitrise: 24 }, sB: { critique: 20 }, sC: { degatsBoss: 22 } },
      { id: 'croise', name: 'Croisé-Bouclier', wow: 'Protection', role: 'tank', color: '#ffe066', icon: '⛪', primary: 'endurance', type: 'arcane',
        sig: sp('croise_sig', 'Bouclier vengeur', '🛡️', 'nuke', 2.4, 3, 'arcane', FA),
        q: sp('croise_q', 'Imposition des mains', '🙌', 'shield', 3, 6, 'arcane', I),
        ult: sp('croise_ult', 'Gardien antique', '🔰', 'bigShield', 13, 30),
        identity: { name: 'Conviction', desc: '40% de ton Endurance compte comme Intelligence.', ks: { enduranceAs: { to: 'intelligence', frac: 0.4 } } },
        ks2: { name: 'Aura protectrice', desc: 'Tes alliés bénéficient de 35% de ta résistance.', ks: { shareResist: 0.35 } },
        cap: { name: 'Gardien de la foi', desc: '-15% de dégâts subis, +150 Endurance.', stat: { endurance: 150 }, ks: { flatDr: 0.15 } },
        sA: { reductionDegats: 22 }, sB: { barriere: 120 }, sC: { endurance: 30 } },
      { id: 'paladinsacre', name: 'Paladin sacré', wow: 'Sacré', role: 'heal', color: '#fff3bf', icon: '🌟', primary: F, type: 'arcane',
        sig: sp('paladinsacre_sig', 'Lumière sacrée', '🌟', 'heal', 2.8, 3.5),
        q: sp('paladinsacre_q', 'Aube radieuse', '🌅', 'buffParty', 1.6, 6),
        ult: sp('paladinsacre_ult', 'Aube salvatrice', '🌅', 'bigHeal', 12, 24),
        identity: { name: 'Puissance sacrée', desc: 'Soin par l\'attaque (scale FORCE), amplifié de 25% (HoT).', ks: { hot: 0.25 } },
        ks2: { name: 'Bouclier de foi', desc: 'Soins +20%, +120 Barrière.', stat: { barriere: 120 }, ks: { hot: 0.2 } },
        cap: { name: 'Aube dorée', desc: 'Soins +25%, +80 Régén.', stat: { regen: 80 }, ks: { hot: 0.25 } },
        sA: { regen: 22 }, sB: { force: 20 }, sC: { maitrise: 18 } },
    ],
  },

  /* ============================ CHASSEUR ============================ */
  {
    id: 'chasseur', name: 'Chasseur', wow: 'Hunter', color: '#51cf66', icon: '🏹',
    passive: { name: 'Instinct du traqueur', desc: '+25 Agilité, +20 Critique.', stat: { agilite: 25, critique: 20 } },
    classSpell: sp('chasseur_cls', 'Tir automatique', '🏹', 'nuke', 2.6, 2.5, undefined, FA),
    specs: [
      { id: 'tireur', name: 'Tireur d\'élite', wow: 'Maîtrise des bêtes', role: 'dps', color: '#51cf66', icon: '🎯', primary: A, type: 'physique',
        sig: sp('tireur_sig', 'Tir précis', '🎯', 'nuke', 3.6, 2.5, undefined, FA),
        q: sp('tireur_q', 'Tir des Tréfonds', '🏹', 'nuke', 5.2, 4, undefined, FA),
        ult: sp('tireur_ult', 'Flèche du jugement', '⚖️', 'executeNuke', 5, 12, undefined, FA),
        identity: { name: 'Visée parfaite', desc: 'Exécute les ennemis sous 20% de PV (×2).', stat: { precision: 30 }, ks: { executeBonus: { threshold: 0.2, mult: 2 } } },
        ks2: dmg(1.10, 'Œil de lynx', '+10% de dégâts.'),
        cap: dmg(1.14, 'Tir mortel', '+14% de dégâts.'),
        sA: { critique: 24 }, sB: { degatsCrit: 22 }, sC: { precision: 24 } },
      { id: 'bete', name: 'Maître des bêtes', wow: 'BM', role: 'dps', color: '#82c91e', icon: '🐾', primary: A, type: 'nature',
        sig: sp('bete_sig', 'Griffes de la meute', '🐾', 'cleave', 3.0, 3, 'nature', FA),
        q: sp('bete_q', 'Morsure féroce', '🐺', 'nuke', 3.8, 3, 'nature', FA),
        ult: sp('bete_ult', 'Bête primordiale', '🦁', 'frenzy', 1.9, 20, 'nature', FA, 8),
        identity: dmg(1.22, 'Meute', '+22% de dégâts (ton familier frappe en continu).'),
        ks2: { name: 'Frénésie animale', desc: '+12% de chance de Multifrappe.', ks: { multistrike: 0.12 } },
        cap: dmg(1.12, 'Appel sauvage', '+12% de dégâts.'),
        sA: { critique: 22 }, sB: { hate: 22 }, sC: { maitrise: 18 } },
      { id: 'pisteur', name: 'Pisteur', wow: 'Survie', role: 'dps', color: '#66a80f', icon: '🪤', primary: A, type: 'nature',
        sig: sp('pisteur_sig', 'Piège explosif', '🪤', 'cleave', 2.8, 3.5, 'nature', FA),
        q: sp('pisteur_q', 'Lance empoisonnée', '🗡️', 'dot', 2.4, 4, 'nature', FA),
        ult: sp('pisteur_ult', 'Salve mortelle', '💥', 'megaCleave', 5.5, 18, 'nature', FA),
        identity: { name: 'Pièges mortels', desc: 'Tes coups infligent un DoT (25% du coup/s, 5 s).', ks: { dot: { frac: 0.25, duration: 5 } } },
        ks2: dmg(1.12, 'Prédateur', '+12% de dégâts.'),
        cap: dmg(1.12, 'Survivant', '+12% de dégâts, +40 Altération.'),
        sA: { alteration: 26 }, sB: { critique: 20 }, sC: { hate: 20 } },
    ],
  },

  /* ============================ VOLEUR ============================ */
  {
    id: 'voleur', name: 'Voleur', wow: 'Rogue', color: '#94d82d', icon: '🗡',
    passive: { name: 'Lames jumelles', desc: '+25 Agilité, +18 Hâte.', stat: { agilite: 25, hate: 18 } },
    classSpell: sp('voleur_cls', 'Taillade', '🔪', 'nuke', 2.6, 2.5, undefined, A),
    specs: [
      { id: 'assassin', name: 'Assassin', wow: 'Assassinat', role: 'dps', color: '#94d82d', icon: '🗡', primary: A, type: 'nature',
        sig: sp('assassin_sig', 'Lames empoisonnées', '🧪', 'dot', 1.6, 3.5, 'nature', A),
        q: sp('assassin_q', 'Éventration', '🩸', 'dot', 2.8, 4.5, 'nature', A),
        ult: sp('assassin_ult', 'Mort silencieuse', '☠️', 'rupture', 7, 16, 'nature', A, 8),
        identity: { name: 'Toxines', desc: 'Tes coups empoisonnent (DoT 35% du coup/s, 6 s).', ks: { dot: { frac: 0.35, duration: 6 } } },
        ks2: dmg(1.10, 'Venin mortel', '+10% de dégâts, +30 Altération.'),
        cap: dmg(1.12, 'Maître des poisons', '+12% de dégâts, +40 Altération.'),
        sA: { alteration: 34 }, sB: { critique: 18 }, sC: { penetration: 20 } },
      { id: 'ombrelame', name: 'Lame des ombres', wow: 'Finesse', role: 'dps', color: '#b197fc', icon: '🌑', primary: A, type: 'ombre',
        sig: sp('ombrelame_sig', 'Embuscade', '🗡️', 'nuke', 7.5, 12, 'ombre', A),
        q: sp('ombrelame_q', 'Éviscération', '🌑', 'nuke', 4.6, 3.5, 'ombre', A),
        ult: sp('ombrelame_ult', 'Phase éthérée', '🌫️', 'invuln', 0, 28, 'ombre', A, 2),
        identity: { name: 'Ouverture', desc: '×1,8 dégâts pendant les 5 premières s face à chaque ennemi.', ks: { openerBonus: { mult: 1.8, seconds: 5 } } },
        ks2: { name: 'Danse des ombres', desc: 'La fenêtre d\'ouverture passe à 8 s (×1,4 de plus).', ks: { openerBonus: { mult: 1.4, seconds: 8 } } },
        cap: dmg(1.12, 'Symbiose des ombres', '+12% de dégâts.'),
        sA: { critique: 24 }, sB: { degatsCrit: 24 }, sC: { agilite: 22 } },
      { id: 'flibustier', name: 'Flibustier', wow: 'Hors-la-loi', role: 'dps', color: '#fab005', icon: '🎲', primary: A, type: 'physique',
        sig: sp('flibustier_sig', 'Éviscération pirate', '🗡️', 'nuke', 5.0, 3.5, undefined, FA),
        q: sp('flibustier_q', 'Salve de pistolets', '🔫', 'cleave', 3.2, 3, undefined, FA),
        ult: sp('flibustier_ult', 'Vengeance différée', '⏳', 'charge', 3, 18, undefined, FA, 5),
        identity: { name: 'Coup de dés', desc: '+25% de chance de Multifrappe.', ks: { multistrike: 0.25 } },
        ks2: { name: 'Roulette truquée', desc: '+30 Surpuissance (mult de dégâts universel).', stat: { surpuissance: 30 } },
        cap: dmg(1.10, 'Hors-la-loi', '+10% de dégâts.'),
        sA: { hate: 28 }, sB: { critique: 22 }, sC: { multifrappe: 8 } },
    ],
  },

  /* ============================ PRÊTRE ============================ */
  {
    id: 'pretre', name: 'Prêtre', wow: 'Priest', color: '#e9ecef', icon: '✚',
    passive: { name: 'Discipline de l\'esprit', desc: '+25 Intelligence, +18 Régén.', stat: { intelligence: 25, regen: 18 } },
    classSpell: sp('pretre_cls', 'Mot de pouvoir', '✨', 'nuke', 2.4, 2.8, 'arcane', I),
    specs: [
      { id: 'sacre', name: 'Prêtre sacré', wow: 'Sacré', role: 'heal', color: '#69db7c', icon: '✚', primary: I, type: 'arcane',
        sig: sp('sacre_sig', 'Guérison majeure', '💚', 'heal', 2.8, 4, undefined, I),
        q: sp('sacre_q', 'Prière de guérison', '🙏', 'buffParty', 1.8, 6, undefined, I),
        ult: sp('sacre_ult', 'Aube salvatrice', '🌅', 'bigHeal', 12, 24, undefined, I),
        identity: { name: 'Réseau de vie', desc: 'Tes soins sont amplifiés de 40% (HoT).', ks: { hot: 0.4 } },
        ks2: { name: 'Sérénité', desc: 'Soins +20%, +40 Régén.', stat: { regen: 40 }, ks: { hot: 0.2 } },
        cap: { name: 'Avatar de vie', desc: 'Soins +30%, +100 Intelligence, +80 Régén.', stat: { intelligence: 100, regen: 80 }, ks: { hot: 0.3 } },
        sA: { regen: 28 }, sB: { intelligence: 22 }, sC: { maitrise: 16 } },
      { id: 'disciple', name: 'Disciple', wow: 'Discipline', role: 'heal', color: '#9775fa', icon: '🕯️', primary: I, type: 'ombre',
        sig: sp('disciple_sig', 'Pénitence', '🕯️', 'nuke', 3.0, 3, 'ombre', I),
        q: sp('disciple_q', 'Bouclier divin', '🛡️', 'shield', 3, 6, undefined, I),
        ult: sp('disciple_ult', 'Évangélisation', '🌟', 'bigHeal', 9, 22, undefined, I),
        identity: { name: 'Expiation', desc: 'Tes sorts de soin infligent aussi 60% du soin en dégâts.', ks: { healToDamage: 0.6 } },
        ks2: dmg(1.08, 'Châtiment', '+8% de dégâts.'),
        cap: { name: 'Transsubstantiation', desc: '+40% de heal→dégâts, soins +25%.', ks: { healToDamage: 0.4, hot: 0.25 } },
        sA: { intelligence: 22 }, sB: { regen: 22 }, sC: { maitrise: 18 } },
      { id: 'ombremancien', name: 'Ombremancien', wow: 'Ombre', role: 'dps', color: '#7048e8', icon: '🗯️', primary: I, type: 'ombre',
        sig: sp('ombremancien_sig', 'Mot de l\'ombre', '🗯️', 'dot', 2.6, 4.5, 'ombre', I),
        q: sp('ombremancien_q', 'Toucher mental', '🧠', 'nuke', 3.8, 2.8, 'ombre', I),
        ult: sp('ombremancien_ult', 'Hémorragie cosmique', '🧨', 'rupture', 8, 16, 'ombre', I, 8),
        identity: { name: 'Folie', desc: 'Tes coups affligent (DoT 30% du coup/s, 6 s).', ks: { dot: { frac: 0.30, duration: 6 } } },
        ks2: dmg(1.12, 'Vampirisme mental', '+12% de dégâts.'),
        cap: dmg(1.15, 'Forme du Vide', '+15% de dégâts, +40 Altération.'),
        sA: { alteration: 30 }, sB: { critique: 18 }, sC: { maitrise: 18 } },
    ],
  },

  /* ============================ CHAMAN ============================ */
  {
    id: 'chaman', name: 'Chaman', wow: 'Shaman', color: '#ffa94d', icon: '⚡',
    passive: { name: 'Communion des éléments', desc: '+22 Intelligence, +22 Agilité.', stat: { intelligence: 22, agilite: 22 } },
    classSpell: sp('chaman_cls', 'Choc de lave', '🌋', 'nuke', 2.6, 3, 'feu', AI),
    specs: [
      { id: 'elementaliste', name: 'Élémentaliste', wow: 'Élémentaire', role: 'dps', color: '#ffa94d', icon: '🌋', primary: I, type: 'foudre',
        sig: sp('elementaliste_sig', 'Fulguration', '⚡', 'cleave', 3.6, 3, 'foudre', I),
        q: sp('elementaliste_q', 'Salve élémentaire', '🌠', 'nuke', 4.8, 4, 'foudre', I),
        ult: sp('elementaliste_ult', 'Déluge stellaire', '🌠', 'megaCleave', 7, 20, 'foudre', I),
        identity: { name: 'Foudre en chaîne', desc: 'Tes attaques rebondissent sur 2 ennemis (45%).', ks: { chainArc: { frac: 0.45, targets: 2 } } },
        ks2: dmg(1.10, 'Surcharge', '+10% de dégâts.'),
        cap: dmg(1.16, 'Ascendance', '+16% de dégâts.'),
        sA: { maitrise: 28 }, sB: { penetration: 22 }, sC: { critique: 18 } },
      { id: 'amelio', name: 'Chaman amélioration', wow: 'Amélioration', role: 'dps', color: '#ffd43b', icon: '🌩️', primary: A, type: 'foudre',
        sig: sp('amelio_sig', 'Arc voltaïque', '⚡', 'cleave', 3.0, 3.2, 'foudre', AI),
        q: sp('amelio_q', 'Loups-tempête', '🐺', 'nuke', 3.6, 3, 'foudre', AI),
        ult: sp('amelio_ult', 'Tempête déchaînée', '🌩️', 'frenzy', 1.9, 20, 'foudre', AI, 8),
        identity: { name: 'Décharge statique', desc: 'Toutes les 5 attaques, la suivante frappe ×3.', ks: { staticN: { every: 5, mult: 3 } } },
        ks2: { name: 'Loups spectraux', desc: '+18% de chance de Multifrappe.', ks: { multistrike: 0.18 } },
        cap: dmg(1.12, 'Tempête ascendante', '+12% de dégâts.'),
        sA: { hate: 26 }, sB: { critique: 20 }, sC: { maitrise: 16 } },
      { id: 'restaurateur', name: 'Chaman restaurateur', wow: 'Restauration', role: 'heal', color: '#3bc9db', icon: '🌊', primary: I, type: 'foudre',
        sig: sp('restaurateur_sig', 'Vague de guérison', '🌊', 'heal', 2.6, 3.5, undefined, I),
        q: sp('restaurateur_q', 'Chaîne de soins', '💧', 'buffParty', 1.8, 5, undefined, I),
        ult: sp('restaurateur_ult', 'Totem de la marée', '🌊', 'bigHeal', 11, 24, undefined, I),
        identity: { name: 'Vague de guérison', desc: 'Tes soins sont amplifiés de 30% (HoT) — soin en chaîne.', ks: { hot: 0.3 } },
        ks2: { name: 'Esprit de l\'eau', desc: 'Soins +20%, +40 Régén.', stat: { regen: 40 }, ks: { hot: 0.2 } },
        cap: { name: 'Totem de vie', desc: 'Soins +25%, +90 Intelligence.', stat: { intelligence: 90 }, ks: { hot: 0.25 } },
        sA: { regen: 26 }, sB: { intelligence: 20 }, sC: { maitrise: 16 } },
    ],
  },

  /* ============================ MAGE ============================ */
  {
    id: 'mage', name: 'Mage', wow: 'Mage', color: '#4dabf7', icon: '✨',
    passive: { name: 'Esprit arcanique', desc: '+30 Intelligence, +15 Maîtrise.', stat: { intelligence: 30, maitrise: 15 } },
    classSpell: sp('mage_cls', 'Projectile des arcanes', '✨', 'nuke', 2.6, 2.8, 'arcane', I),
    specs: [
      { id: 'pyromancien', name: 'Pyromancien', wow: 'Feu', role: 'dps', color: '#ff6b35', icon: '🔥', primary: I, type: 'feu',
        sig: sp('pyromancien_sig', 'Boule de feu', '🔥', 'nuke', 3.8, 2.8, 'feu', I),
        q: sp('pyromancien_q', 'Pyroblast', '☄️', 'nuke', 5.4, 4, 'feu', I),
        ult: sp('pyromancien_ult', 'Météore', '☄️', 'megaCleave', 6.5, 18, 'feu', I),
        identity: { name: 'Combustion', desc: 'Tes coups brûlent (DoT 22% du coup/s, 5 s).', ks: { dot: { frac: 0.22, duration: 5 } } },
        ks2: dmg(1.12, 'Embrasement', '+12% de dégâts.'),
        cap: dmg(1.15, 'Immolation', '+15% de dégâts.'),
        sA: { maitrise: 28 }, sB: { critique: 22 }, sC: { penetration: 18 } },
      { id: 'cryomancien', name: 'Cryomancien', wow: 'Givre', role: 'dps', color: '#4dabf7', icon: '🧊', primary: I, type: 'froid',
        sig: sp('cryomancien_sig', 'Éclat de glace', '🧊', 'cleave', 3.4, 2.8, 'froid', I),
        q: sp('cryomancien_q', 'Lance de givre', '❄️', 'nuke', 4.2, 3, 'froid', I),
        ult: sp('cryomancien_ult', 'Comète de glace', '☄️', 'megaCleave', 6, 18, 'froid', I),
        identity: { name: 'Éclatement', desc: 'Exécute les ennemis gelés sous 35% de PV (×2).', stat: { precision: 24 }, ks: { executeBonus: { threshold: 0.35, mult: 2 } } },
        ks2: dmg(1.10, 'Hiver profond', '+10% de dégâts.'),
        cap: dmg(1.12, 'Hiver éternel', '+12% de dégâts.'),
        sA: { maitrise: 28 }, sB: { critique: 20 }, sC: { precision: 20 } },
      { id: 'arcaniste', name: 'Arcaniste', wow: 'Arcanes', role: 'dps', color: '#c084fc', icon: '✨', primary: I, type: 'arcane',
        sig: sp('arcaniste_sig', 'Éclair des arcanes', '🔮', 'nuke', 3.8, 2.5, 'arcane', I),
        q: sp('arcaniste_q', 'Explosion des arcanes', '💥', 'cleave', 3.8, 3.2, 'arcane', I),
        ult: sp('arcaniste_ult', 'Fracture du temps', '⏳', 'nuke', 8, 14, 'arcane', I),
        identity: dmg(1.25, 'Pouvoir arcanique', '+25% de dégâts de sorts.'),
        ks2: { name: 'Précipitation', desc: 'Chaque sort réduit les autres recharges de 0,8 s.', ks: { cdrOnCast: 0.8 } },
        cap: { name: 'Hors du temps', desc: '+30% de dégâts de SORTS.', ks: { spellMult: 1.3 } },
        sA: { maitrise: 30 }, sB: { recuperation: 6 }, sC: { critique: 18 } },
    ],
  },

  /* ============================ DÉMONISTE ============================ */
  {
    id: 'demoniste', name: 'Démoniste', wow: 'Warlock', color: '#9775fa', icon: '💀',
    passive: { name: 'Pacte démoniaque', desc: '+28 Intelligence, +12 Vol de vie.', stat: { intelligence: 28, volDeVie: 12 } },
    classSpell: sp('demoniste_cls', 'Trait de l\'ombre', '🌑', 'nuke', 2.6, 2.8, 'ombre', I),
    specs: [
      { id: 'effroi', name: 'Démoniste de l\'effroi', wow: 'Affliction', role: 'dps', color: '#9775fa', icon: '💀', primary: I, type: 'ombre',
        sig: sp('effroi_sig', 'Corruption', '🌑', 'dot', 2.6, 4.5, 'ombre', I),
        q: sp('effroi_q', 'Douleur instable', '💢', 'dot', 3.0, 5, 'ombre', I),
        ult: sp('effroi_ult', 'Malédiction d\'agonie', '🧨', 'rupture', 8, 16, 'ombre', I, 8),
        identity: { name: 'Fléaux', desc: 'Tes coups affligent (DoT 35% du coup/s, 6 s).', ks: { dot: { frac: 0.35, duration: 6 } } },
        ks2: { name: 'Contagion', desc: 'Ton affliction s\'applique au pack (50%).', ks: { dotAoe: 0.5 } },
        cap: dmg(1.20, 'Malédiction suprême', '+20% de dégâts, +40 Altération.'),
        sA: { alteration: 36 }, sB: { maitrise: 18 }, sC: { critique: 16 } },
      { id: 'invocateur', name: 'Invocateur', wow: 'Démonologie', role: 'dps', color: '#845ef7', icon: '👹', primary: I, type: 'ombre',
        sig: sp('invocateur_sig', 'Nuée démoniaque', '👹', 'cleave', 3.0, 3.2, 'ombre', I),
        q: sp('invocateur_q', 'Main de Gul\'dan', '🖐️', 'nuke', 4.4, 3.5, 'ombre', I),
        ult: sp('invocateur_ult', 'Tyran démoniaque', '👿', 'frenzy', 1.9, 20, 'ombre', I, 8),
        identity: dmg(1.22, 'Légion', '+22% de dégâts (tes démons frappent en continu).'),
        ks2: dmg(1.10, 'Horde infernale', '+10% de dégâts.'),
        cap: dmg(1.12, 'Seigneur démoniaque', '+12% de dégâts.'),
        sA: { maitrise: 28 }, sB: { critique: 18 }, sC: { intelligence: 20 } },
      { id: 'destructeur', name: 'Destructeur', wow: 'Destruction', role: 'dps', color: '#f03e3e', icon: '💥', primary: I, type: 'feu',
        sig: sp('destructeur_sig', 'Ruine', '💥', 'nuke', 4.4, 3, 'feu', I),
        q: sp('destructeur_q', 'Pluie de feu', '🔥', 'cleave', 3.6, 3.2, 'feu', I),
        ult: sp('destructeur_ult', 'Cataclysme', '☄️', 'megaCleave', 6.5, 18, 'feu', I),
        identity: { name: 'Chaos incarné', desc: '+30 Surpuissance (mult de dégâts universel).', stat: { surpuissance: 30 } },
        ks2: dmg(1.10, 'Embrasement', '+10% de dégâts.'),
        cap: dmg(1.15, 'Pluie de chaos', '+15% de dégâts.'),
        sA: { maitrise: 28 }, sB: { critique: 20 }, sC: { penetration: 18 } },
    ],
  },

  /* ============================ MOINE ============================ */
  {
    id: 'moine', name: 'Moine', wow: 'Monk', color: '#20c997', icon: '🥋',
    passive: { name: 'Équilibre du chi', desc: '+24 Agilité, +18 Hâte.', stat: { agilite: 24, hate: 18 } },
    classSpell: sp('moine_cls', 'Coup de tigre', '🐯', 'nuke', 2.6, 2.5, undefined, A),
    specs: [
      { id: 'marchevent', name: 'Marche-vent', wow: 'Marche-vent', role: 'dps', color: '#3bc9db', icon: '🐯', primary: A, type: 'physique',
        sig: sp('marchevent_sig', 'Paume du tigre', '🐯', 'nuke', 3.2, 2.5, undefined, A),
        q: sp('marchevent_q', 'Coup tournoyant', '🌀', 'cleave', 3.0, 3, undefined, A),
        ult: sp('marchevent_ult', 'Vengeance différée', '⏳', 'charge', 3, 18, undefined, FA, 5),
        identity: { name: 'Enchaînement', desc: '+18% de chance de Multifrappe.', ks: { multistrike: 0.18 } },
        ks2: dmg(1.10, 'Touche du chi', '+10% de dégâts.'),
        cap: dmg(1.12, 'Danse de la grue', '+12% de dégâts.'),
        sA: { hate: 28 }, sB: { critique: 20 }, sC: { multifrappe: 8 } },
      { id: 'brasseur', name: 'Maître brasseur', wow: 'Brasseur', role: 'tank', color: '#94d82d', icon: '🍶', primary: A, type: 'nature',
        sig: sp('brasseur_sig', 'Coup de tonneau', '🛢️', 'cleave', 2.4, 3, 'nature', A),
        q: sp('brasseur_q', 'Brassage purifiant', '🍶', 'shield', 3, 6, undefined, A),
        ult: sp('brasseur_ult', 'Bière de l\'éléphant', '🐘', 'bigShield', 12, 30),
        identity: { name: 'Report (stagger)', desc: '-15% de dégâts subis, +40 Esquive.', stat: { esquive: 40 }, ks: { flatDr: 0.15 } },
        ks2: { name: 'Roulade ivre', desc: '+30 Esquive, +20 Ténacité.', stat: { esquive: 30, tenacite: 20 } },
        cap: { name: 'Tonneau ivre', desc: '-10% de dégâts subis, +40 Esquive, +30 Régén.', stat: { esquive: 40, regen: 30 }, ks: { flatDr: 0.1 } },
        sA: { esquive: 26 }, sB: { reductionDegats: 18 }, sC: { tenacite: 18 } },
      { id: 'brume', name: 'Tisse-brume', wow: 'Tisse-brume', role: 'heal', color: '#63e6be', icon: '🌫️', primary: A, type: 'nature',
        sig: sp('brume_sig', 'Brume revigorante', '🌫️', 'heal', 1.8, 3),
        q: sp('brume_q', 'Cocon de jade', '🟢', 'shield', 2.6, 6),
        ult: sp('brume_ult', 'Pluie de renouveau', '🌧️', 'bigHeal', 10, 24),
        identity: { name: 'Fistweaving', desc: 'Frapper soigne (scale AGI), soins amplifiés de 30% (HoT).', ks: { hot: 0.3 } },
        ks2: dmg(1.10, 'Brume dansante', '+10% de dégâts (le combat soigne).'),
        cap: { name: 'Brume revigorante', desc: 'Soins +25%, +12% de dégâts.', ks: { hot: 0.25, damageMult: 1.12 } },
        sA: { hate: 22 }, sB: { regen: 22 }, sC: { agilite: 20 } },
    ],
  },

  /* ============================ DRUIDE ============================ */
  {
    id: 'druide', name: 'Druide', wow: 'Druid', color: '#82c91e', icon: '🐾',
    passive: { name: 'Métamorphose', desc: '+20 Agilité, +20 Intelligence.', stat: { agilite: 20, intelligence: 20 } },
    classSpell: sp('druide_cls', 'Griffe lunaire', '🌙', 'nuke', 2.6, 3, 'nature', AI),
    specs: [
      { id: 'lunaire', name: 'Lunaire', wow: 'Équilibre', role: 'dps', color: '#748ffc', icon: '🌙', primary: I, type: 'arcane',
        sig: sp('lunaire_sig', 'Éclair lunaire', '🌙', 'nuke', 3.6, 2.8, 'arcane', I),
        q: sp('lunaire_q', 'Rayon solaire', '☀️', 'cleave', 3.4, 3.2, 'nature', I),
        ult: sp('lunaire_ult', 'Pleine lune', '🌕', 'megaCleave', 6, 18, 'arcane', I),
        identity: { name: 'Éclipse', desc: 'Plus ton profil mêle d\'éléments, plus tu frappes fort (+7%/type ≥10%).', ks: { multiTypeBonus: { per: 0.07, threshold: 0.10 } } },
        ks2: { name: 'Brûlure lunaire', desc: 'Tes coups brûlent (DoT 18% du coup/s, 5 s).', ks: { dot: { frac: 0.18, duration: 5 } } },
        cap: dmg(1.16, 'Incarnation : Chouette', '+16% de dégâts.'),
        sA: { maitrise: 28 }, sB: { critique: 20 }, sC: { alteration: 18 } },
      { id: 'felin', name: 'Druide félin', wow: 'Farouche', role: 'dps', color: '#a9e34b', icon: '🐱', primary: A, type: 'nature',
        sig: sp('felin_sig', 'Lacération', '🩸', 'dot', 2.4, 4, 'nature', A),
        q: sp('felin_q', 'Mutilation', '🐾', 'nuke', 4.0, 3, 'nature', A),
        ult: sp('felin_ult', 'Traque sauvage', '🐆', 'rupture', 6, 16, 'nature', A, 8),
        identity: { name: 'Lacérations', desc: 'Tes coups font saigner (DoT 30% du coup/s, 6 s).', ks: { dot: { frac: 0.30, duration: 6 } } },
        ks2: dmg(1.10, 'Soif de sang', '+10% de dégâts, +30 Altération.'),
        cap: dmg(1.12, 'Incarnation : Roi-fauve', '+12% de dégâts, +40 Altération.'),
        sA: { alteration: 30 }, sB: { critique: 20 }, sC: { hate: 18 } },
      { id: 'sylvestre', name: 'Gardien sylvestre', wow: 'Gardien', role: 'tank', color: '#37b24d', icon: '🐻', primary: 'endurance', type: 'nature',
        sig: sp('sylvestre_sig', 'Coup de patte', '🐻', 'cleave', 2.4, 3, 'nature', FA),
        q: sp('sylvestre_q', 'Régénération', '🌿', 'heal', 2.4, 6, undefined, I),
        ult: sp('sylvestre_ult', 'Incarnation : Ursoc', '🐻', 'bigShield', 12, 30),
        identity: { name: 'Cuir épais', desc: '+30% de dégâts au-dessus de 60% PV, -10% de dégâts subis.', ks: { highHpBonus: { threshold: 0.6, mult: 1.3 }, flatDr: 0.1 } },
        ks2: { name: 'Rage sylvestre', desc: '-12% de dégâts subis.', ks: { flatDr: 0.12 } },
        cap: { name: 'Gardien antique', desc: '+200 Endurance, +40 Régén.', stat: { endurance: 200, regen: 40 } },
        sA: { endurance: 45 }, sB: { regen: 28 }, sC: { reductionDegats: 18 } },
      { id: 'reparateur', name: 'Druide réparateur', wow: 'Restauration', role: 'heal', color: '#66bb6a', icon: '🌿', primary: I, type: 'nature',
        sig: sp('reparateur_sig', 'Rajeunissement', '🌱', 'hot', 1.8, 4, undefined, I),
        q: sp('reparateur_q', 'Floraison', '🌸', 'buffParty', 1.6, 5, undefined, I),
        ult: sp('reparateur_ult', 'Floraison sauvage', '🌺', 'bigHeal', 11, 24, undefined, I),
        identity: { name: 'Floraison', desc: 'Tes soins sur la durée sont amplifiés de 50% (HoT).', ks: { hot: 0.5 } },
        ks2: { name: 'Vie luxuriante', desc: 'Soins +20%, +40 Régén.', stat: { regen: 40 }, ks: { hot: 0.2 } },
        cap: { name: 'Arbre de vie', desc: 'Soins +30%, +90 Intelligence, +60 Régén.', stat: { intelligence: 90, regen: 60 }, ks: { hot: 0.3 } },
        sA: { regen: 26 }, sB: { intelligence: 20 }, sC: { maitrise: 16 } },
    ],
  },

  /* ============================ CHASSEUR DE DÉMONS ============================ */
  {
    id: 'demonhunter', name: 'Chasseur de démons', wow: 'Demon Hunter', color: '#e8590c', icon: '😈',
    passive: { name: 'Métamorphose démoniaque', desc: '+25 Agilité, +15 Vol de vie.', stat: { agilite: 25, volDeVie: 15 } },
    classSpell: sp('demonhunter_cls', 'Lames du chaos', '😈', 'cleave', 2.6, 2.8, 'feu', A),
    specs: [
      { id: 'traqueur', name: 'Traqueur du Fléau', wow: 'Dévastation', role: 'dps', color: '#e8590c', icon: '😈', primary: A, type: 'feu',
        sig: sp('traqueur_sig', 'Lame du chaos', '😈', 'cleave', 3.4, 2.8, 'feu', A),
        q: sp('traqueur_q', 'Œil de Gul\'dan', '👁️', 'nuke', 4.2, 3.5, 'feu', A),
        ult: sp('traqueur_ult', 'Métamorphose', '👹', 'frenzy', 2, 20, 'feu', A, 8),
        identity: dmg(1.20, 'Métamorphose', '+20% de dégâts de chaos.'),
        ks2: { name: 'Fureur démoniaque', desc: '+12% de chance de Multifrappe.', ks: { multistrike: 0.12 } },
        cap: dmg(1.12, 'Chasseur traqué', '+12% de dégâts.'),
        sA: { critique: 22 }, sB: { hate: 22 }, sC: { agilite: 20 } },
      { id: 'vengeance', name: 'Vengeur', wow: 'Vengeance', role: 'tank', color: '#d9480f', icon: '👿', primary: A, type: 'feu',
        sig: sp('vengeance_sig', 'Lacération du chaos', '👿', 'cleave', 2.8, 3, 'feu', A),
        q: sp('vengeance_q', 'Cuirasse démoniaque', '🛡️', 'shield', 3, 6, 'feu', A),
        ult: sp('vengeance_ult', 'Âme dévorée', '🦇', 'lifeNuke', 6, 16, 'feu', A),
        identity: { name: 'Âmes dévorées', desc: '+25 Vol de vie, renvoie 25% des dégâts.', stat: { volDeVie: 25 }, ks: { thorns: 0.25 } },
        ks2: { name: 'Brûlure de l\'âme', desc: '-12% de dégâts subis.', ks: { flatDr: 0.12 } },
        cap: { name: 'Métamorphose défensive', desc: '-12% de dégâts subis, +12% de dégâts.', ks: { flatDr: 0.12, damageMult: 1.12 } },
        sA: { volDeVie: 12 }, sB: { reductionDegats: 20 }, sC: { esquive: 20 } },
    ],
  },

  /* ============================ CHEVALIER DE LA MORT ============================ */
  {
    id: 'dk', name: 'Chevalier de la mort', wow: 'Death Knight', color: '#4dd0e1', icon: '☠',
    passive: { name: 'Présence de givre', desc: '+25 Force, +18 Endurance.', stat: { force: 25, endurance: 18 } },
    classSpell: sp('dk_cls', 'Frappe de givre', '❄️', 'nuke', 2.6, 3, 'froid', FA),
    specs: [
      { id: 'profanateur', name: 'Profanateur', wow: 'Impie', role: 'dps', color: '#74b816', icon: '☣️', primary: F, type: 'ombre',
        sig: sp('profanateur_sig', 'Fléau d\'ombre', '🌑', 'dot', 2.6, 4.5, 'ombre', FA),
        q: sp('profanateur_q', 'Éclatement de plaies', '🤢', 'cleave', 3.4, 3.2, 'ombre', FA),
        ult: sp('profanateur_ult', 'Apocalypse', '💀', 'megaCleave', 6, 18, 'ombre', FA),
        identity: { name: 'Peste', desc: 'Tes coups infligent une maladie (DoT 30% du coup/s, 6 s).', ks: { dot: { frac: 0.30, duration: 6 } } },
        ks2: { name: 'Épidémie', desc: 'Ta maladie s\'applique AUSSI au pack (50%).', ks: { dotAoe: 0.5 } },
        cap: dmg(1.14, 'Avatar de peste', '+14% de dégâts, +40 Altération.'),
        sA: { alteration: 30 }, sB: { maitrise: 20 }, sC: { critique: 16 } },
      { id: 'givremort', name: 'Givre-mort', wow: 'Givre', role: 'dps', color: '#4dd0e1', icon: '❄', primary: F, type: 'froid',
        sig: sp('givremort_sig', 'Souffle de givre', '🧊', 'cleave', 3.4, 2.8, 'froid', FA),
        q: sp('givremort_q', 'Oblitération', '⚔️', 'nuke', 4.6, 3.5, 'froid', FA),
        ult: sp('givremort_ult', 'Pilier de givre', '🏔️', 'megaCleave', 6, 18, 'froid', FA),
        identity: { name: 'Brisure', desc: 'Exécute les ennemis ralentis/gelés sous 35% de PV (×2).', ks: { executeBonus: { threshold: 0.35, mult: 2 } } },
        ks2: { name: 'Lames runiques', desc: '+12% de chance de Multifrappe.', ks: { multistrike: 0.12 } },
        cap: dmg(1.15, 'Souverain du givre', '+15% de dégâts.'),
        sA: { critique: 22 }, sB: { hate: 20 }, sC: { force: 20 } },
      { id: 'sang', name: 'Chevalier de sang', wow: 'Sang', role: 'tank', color: '#e03131', icon: '🩸', primary: F, type: 'ombre',
        sig: sp('sang_sig', 'Coup runique', '🩸', 'lifeNuke', 3.0, 3.5, 'ombre', F),
        q: sp('sang_q', 'Pacte de mort', '💉', 'heal', 2.8, 6, undefined, F),
        ult: sp('sang_ult', 'Soif du néant', '🦇', 'lifeNuke', 6, 14, 'ombre', FA),
        identity: { name: 'Arme runique', desc: '+25 Vol de vie, et tes DoT te soignent (20% du tick).', stat: { volDeVie: 25 }, ks: { dotLeech: 0.2 } },
        ks2: { name: 'Croûte de sang', desc: '-12% de dégâts subis.', ks: { flatDr: 0.12 } },
        cap: { name: 'Pacte de sang', desc: '-12% de dégâts subis, +20 Vol de vie.', stat: { volDeVie: 20 }, ks: { flatDr: 0.12 } },
        sA: { volDeVie: 14 }, sB: { reductionDegats: 20 }, sC: { endurance: 30 } },
    ],
  },

  /* ============================ ÉVOKER ============================ */
  {
    id: 'evoker', name: 'Évoker', wow: 'Evoker', color: '#f783ac', icon: '🐉',
    passive: { name: 'Souffle draconique', desc: '+28 Intelligence, +15 Maîtrise.', stat: { intelligence: 28, maitrise: 15 } },
    classSpell: sp('evoker_cls', 'Coup d\'aile', '🐉', 'cleave', 2.6, 3, 'feu', I),
    specs: [
      { id: 'devastateur', name: 'Aspect dévastateur', wow: 'Dévastation', role: 'dps', color: '#ff8787', icon: '🐉', primary: I, type: 'feu',
        sig: sp('devastateur_sig', 'Souffle ardent', '🐉', 'nuke', 5.0, 4, 'feu', I),
        q: sp('devastateur_q', 'Éruption vivante', '🌋', 'cleave', 3.6, 3, 'feu', I),
        ult: sp('devastateur_ult', 'Tempête de feu draconique', '☄️', 'megaCleave', 7, 18, 'feu', I),
        identity: dmg(1.20, 'Souffle draconique', '+20% de dégâts à charge.'),
        ks2: dmg(1.10, 'Colère ardente', '+10% de dégâts.'),
        cap: dmg(1.14, 'Colère draconique', '+14% de dégâts.'),
        sA: { maitrise: 28 }, sB: { critique: 20 }, sC: { penetration: 18 } },
      { id: 'preservateur', name: 'Préservateur', wow: 'Préservation', role: 'heal', color: '#20c997', icon: '🥚', primary: I, type: 'feu',
        sig: sp('preservateur_sig', 'Songe d\'émeraude', '🍃', 'buffParty', 1.8, 5, undefined, I),
        q: sp('preservateur_q', 'Écho du rêve', '💚', 'heal', 2.6, 4, undefined, I),
        ult: sp('preservateur_ult', 'Souffle de rajeunissement', '🌿', 'bigHeal', 11, 24, undefined, I),
        identity: { name: 'Don de l\'éveillé', desc: 'Tes soins à charge sont amplifiés de 35% (HoT).', ks: { hot: 0.35 } },
        ks2: { name: 'Flux temporel', desc: 'Soins +20%, +40 Régén.', stat: { regen: 40 }, ks: { hot: 0.2 } },
        cap: { name: 'Écho temporel', desc: 'Soins +28%, +90 Intelligence.', stat: { intelligence: 90 }, ks: { hot: 0.28 } },
        sA: { regen: 26 }, sB: { intelligence: 20 }, sC: { maitrise: 16 } },
    ],
  },
]

/** Toutes les specs à plat (utilitaire). */
export const ALL_SPECS: SpecDef[] = CLASSES.flatMap((c) => c.specs)

/** Tous les sorts définis par les classes (classe + sig/q/ult de chaque spec). */
export const ALL_SPELLS: SpellSpec[] = CLASSES.flatMap((c) => [
  c.classSpell, ...c.specs.flatMap((s) => [s.sig, s.q, s.ult]),
])
