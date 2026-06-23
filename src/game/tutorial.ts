/**
 * TUTORIEL « Premiers Pas » — chaîne de quêtes d'onboarding.
 *
 * Chaque étape introduit UN système (combat → équiper → Marché → Forge → Talents → Donjon), se
 * COMPLÈTE depuis l'état de jeu observable (pas de tracking lourd, un seul flag `bought`), et donne
 * une RÉCOMPENSE modérée (or/éclats/matériaux/1 objet) qui sert à l'étape suivante : de quoi crafter
 * et finir le tuto avec un set correct, sans court-circuiter le gear-up (pas de starter gear « full »).
 *
 * Choix de design (validés joueur) : PAS d'XP de perso par craft (l'XP reste le combat ; les métiers
 * ont déjà leur propre XP). Le niveau 10 (talents) s'atteint par le combat, pacé par l'onboarding.
 */

/** Contexte dérivé de l'état de jeu pour évaluer la complétion des quêtes. */
export interface TutCtx {
  bestStage: number
  maxLevel: number
  /** Emplacements équipés du perso actif. */
  equippedCount: number
  /** A acheté au moins une fois au Marché (seul flag persisté). */
  bought: boolean
  /** A modifié au moins un objet à la Forge (dérivé : surillvl/reforge/trempe/ascension). */
  crafted: boolean
  /** A alloué au moins un talent (au-delà du nœud racine). */
  talentAllocated: boolean
  /** A terminé au moins un donjon. */
  anyDungeon: boolean
}

/** Récompense d'une quête (créditée à la réclamation). `item` = 1 objet Rare garanti à l'iLvl courant. */
export interface TutReward {
  gold?: number
  eclats?: number
  noyau?: number
  sceaux?: number
  item?: boolean
}

export interface TutQuest {
  id: string
  title: string
  /** Ce qu'il faut faire (affiché au joueur). */
  desc: string
  icon: string
  /** Système enseigné (petit libellé). */
  teaches: string
  done: (c: TutCtx) => boolean
  reward: TutReward
  /** Texte de récompense (affiché). */
  rewardText: string
}

export const TUT_QUESTS: TutQuest[] = [
  {
    id: 'combat', icon: '⚔️', title: 'Le combat', teaches: 'Frappe & butin',
    desc: 'Vaincs des ennemis jusqu\'à la vague 3. Le butin tombe au sol — tes emplacements vides s\'équipent tout seuls.',
    done: (c) => c.bestStage >= 3,
    reward: { gold: 250 }, rewardText: '+250 or',
  },
  {
    id: 'equip', icon: '🎒', title: 'S\'équiper', teaches: 'Équipement',
    desc: 'Remplis 8 emplacements d\'équipement (onglet 🎒). Compare les objets : la plus grosse stat est ta primaire, vise le + de DPS / Survie.',
    done: (c) => c.equippedCount >= 8,
    reward: { item: true, eclats: 200 }, rewardText: '1 objet Rare + 200 ♦ éclats',
  },
  {
    id: 'marche', icon: '🏪', title: 'Le Marché', teaches: 'Achat',
    desc: 'Va au 🏪 Marché et achète quelque chose (un coffre ou un objet). L\'or sert à acheter du stuff et des coffres.',
    done: (c) => c.bought,
    reward: { gold: 400, eclats: 200 }, rewardText: '+400 or, +200 ♦ éclats',
  },
  {
    id: 'forge', icon: '🔨', title: 'La Forge', teaches: 'Craft',
    desc: 'À l\'🔨 Atelier, améliore un objet (surillvl, reforge ou ascension). Recycle ton vieux butin en ♦ éclats pour payer.',
    done: (c) => c.crafted,
    reward: { eclats: 400, noyau: 20 }, rewardText: '+400 ♦ éclats, +20 💠 noyaux',
  },
  {
    id: 'talents', icon: '🌌', title: 'Les Talents', teaches: 'Build',
    desc: 'Atteins le niveau 10 (hub 🛡 Héros) et alloue ton premier talent. Les talents définissent l\'identité de ton build.',
    done: (c) => c.maxLevel >= 10 && c.talentAllocated,
    reward: { gold: 800, eclats: 300 }, rewardText: '+800 or, +300 ♦ éclats',
  },
  {
    id: 'donjon', icon: '🏰', title: 'Les Donjons', teaches: 'Expéditions',
    desc: 'Termine ton premier 🏰 donjon (onglet Expéditions). Les donjons farment une ressource ciblée et du meilleur stuff.',
    done: (c) => c.anyDungeon,
    reward: { sceaux: 8, gold: 600 }, rewardText: '+8 🔑 sceaux, +600 or',
  },
]

export const TUT_QUEST_IDS = TUT_QUESTS.map((q) => q.id)

/** La quête est-elle terminée (prête à réclamer) ? */
export function tutDone(q: TutQuest, ctx: TutCtx): boolean {
  return q.done(ctx)
}

/** Toutes les quêtes sont-elles réclamées ? (→ on masque le journal). */
export function tutAllClaimed(claimed: string[]): boolean {
  return TUT_QUEST_IDS.every((id) => claimed.includes(id))
}

/** Nombre de quêtes terminées mais pas encore réclamées — alimente le red-dot de l'icône 🎯 flottante. */
export function tutClaimableCount(ctx: TutCtx, claimed: string[]): number {
  return TUT_QUESTS.filter((q) => q.done(ctx) && !claimed.includes(q.id)).length
}
