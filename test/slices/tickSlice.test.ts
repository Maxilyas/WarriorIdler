import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset, biomeRec, mkItem } from './_helpers'
import { makeCharacter, charMaxHp } from '../../src/game/character'
import { makeEnemy } from '../../src/game/enemies'
import { bulkProtected } from '../../src/game/storeHelpers'
import { raidGateForStage, raidGateWidth } from '../../src/game/progression'
import { raidsClearedAtTier } from '../../src/game/raids'
import type { EquipSlotId, ItemType, Item } from '../../src/game/types'

function gearedHero(level = 50) {
  const c = makeCharacter('H', level, 'force')
  c.equipment.armePrincipale = mkItem({ type: 'armePrincipale', ilvl: 150, rarity: 'epique' })
  c.hp = charMaxHp(c)
  return c
}

/** Héros endgame réaliste (stuff Abyssal ilvl 240 = borne raid Abîme) : tue au Chapitre 4 où le farm
 *  lâche de l'Épique/Légendaire (donc des uniques). */
const FULL_SLOTS: { slot: EquipSlotId; type: ItemType }[] = [
  { slot: 'tete', type: 'tete' }, { slot: 'cou', type: 'cou' }, { slot: 'epaules', type: 'epaules' },
  { slot: 'cape', type: 'cape' }, { slot: 'torse', type: 'torse' }, { slot: 'poignets', type: 'poignets' },
  { slot: 'mains', type: 'mains' }, { slot: 'taille', type: 'taille' }, { slot: 'jambes', type: 'jambes' },
  { slot: 'pieds', type: 'pieds' }, { slot: 'anneau1', type: 'anneau' }, { slot: 'anneau2', type: 'anneau' },
  { slot: 'bijou1', type: 'bijou' }, { slot: 'bijou2', type: 'bijou' },
  { slot: 'armePrincipale', type: 'armePrincipale' }, { slot: 'armeSecondaire', type: 'armeSecondaire' },
]
function strongHero() {
  const c = makeCharacter('H', 400, 'force')
  for (const { slot, type } of FULL_SLOTS) c.equipment[slot] = mkItem({ type, ilvl: 240, rarity: 'abyssal' })
  c.hp = charMaxHp(c)
  return c
}

/** PRNG déterministe (LCG) pour rendre les tests de drop/recyclage reproductibles. */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 0x100000000 }
  try { return fn() } finally { Math.random = orig }
}

describe('tickSlice', () => {
  beforeEach(() => reset())

  it('tick fait progresser le combat : un héros équipé tue et gagne de l\'or sur la durée', () => {
    reset({ characters: [gearedHero()], stage: 1, biomeBest: biomeRec(50), gold: 0, killCount: 0, enemy: makeEnemy(1) })
    for (let i = 0; i < 300; i++) g().tick(0.2)
    expect(g().killCount).toBeGreaterThan(0)
    expect(g().gold).toBeGreaterThan(0)
  })

  it('farmLock fige le palier (le combat tourne mais on n\'avance pas)', () => {
    reset({ characters: [gearedHero()], stage: 3, bestStage: 10, biomeBest: biomeRec(10), farmLock: true, killCount: 0, enemy: makeEnemy(3) })
    for (let i = 0; i < 200; i++) g().tick(0.2)
    expect(g().stage).toBe(3) // verrou de farm : palier inchangé
    expect(g().killCount).toBeGreaterThan(0) // mais des kills ont bien eu lieu
  })

  // GATE DE RAID — largeur croissante (§6) : franchir le mur d'un Chapitre exige N raids DISTINCTS au
  // tier T(c−4), N grandissant par bande (Ch.5-7:1 · 8-10:2 · 11-13:3 · 14:4). Anti-re-verrouillage :
  // ne bloque qu'au FRONT (stage ≥ bestStage). On teste le CÂBLAGE du tick au Ch.5 (mur battable) et le
  // CALENDRIER de largeur en fonctions pures (les hauts murs ne sont pas battables par un héros de test).
  describe('gate de raid (largeur croissante §6)', () => {
    const rp = (o: { forge?: number; reliquaire?: number; citadelle?: number; nexus?: number; abysse?: number } = {}) =>
      ({ forge: 0, reliquaire: 0, citadelle: 0, nexus: 0, abysse: 0, ...o })

    it('câblage du tick (Ch.5, largeur 1) : sans raid le mur bloque, avec 1 raid il s\'ouvre', () => {
      reset({ characters: [strongHero()], stage: 50, bestStage: 50, biomeBest: biomeRec(50), raidProgress: rp(), killCount: 0, enemy: makeEnemy(50) })
      for (let i = 0; i < 600; i++) g().tick(0.2)
      expect(g().stage).toBe(50)             // 0 raid < largeur 1 → verrou
      expect(g().killCount).toBeGreaterThan(0) // le combat a bien tourné (c'est le gate qui bloque)

      reset({ characters: [strongHero()], stage: 50, bestStage: 50, biomeBest: biomeRec(50), raidProgress: rp({ forge: 1 }), killCount: 0, enemy: makeEnemy(50) })
      for (let i = 0; i < 600; i++) g().tick(0.2)
      expect(g().stage).toBeGreaterThan(50)  // 1 raid au T1 ≥ largeur 1 → franchi
    })

    it('anti-re-verrouillage : un mur sous bestStage reste ouvert (stage < bestStage)', () => {
      reset({ characters: [strongHero()], stage: 50, bestStage: 60, biomeBest: biomeRec(60), raidProgress: rp(), killCount: 0, enemy: makeEnemy(50) })
      for (let i = 0; i < 600; i++) g().tick(0.2)
      expect(g().stage).toBeGreaterThan(50)  // stage < bestStage → gate désactivé malgré 0 raid
    })

    it('raidGateForStage : tier requis = T(c−4) au mur, 0 hors mur / hors Chapitres 5-14', () => {
      expect(raidGateForStage(50)).toBe(1)   // Ch.5
      expect(raidGateForStage(80)).toBe(4)   // Ch.8
      expect(raidGateForStage(140)).toBe(10) // Ch.14
      expect(raidGateForStage(55)).toBe(0)   // pas un mur
      expect(raidGateForStage(40)).toBe(0)   // Prologue (Ch.4 < 5)
      expect(raidGateForStage(150)).toBe(0)  // Ch.15+ libre
    })

    it('raidGateWidth : 1 (Ch.5-7) → 2 (8-10) → 3 (11-13) → 4 (Ch.14)', () => {
      expect([5, 6, 7].map(raidGateWidth)).toEqual([1, 1, 1])
      expect([8, 9, 10].map(raidGateWidth)).toEqual([2, 2, 2])
      expect([11, 12, 13].map(raidGateWidth)).toEqual([3, 3, 3])
      expect(raidGateWidth(14)).toBe(4)
    })

    it('raidsClearedAtTier : compte les raids de BASE ≥ tier (Abîme exclu) ; le Ch.8 exige 2 raids', () => {
      expect(raidsClearedAtTier(rp(), 4)).toBe(0)
      expect(raidsClearedAtTier(rp({ forge: 4 }), 4)).toBe(1)              // 1 raid au T4
      expect(raidsClearedAtTier(rp({ forge: 4, nexus: 4 }), 4)).toBe(2)   // 2 raids distincts
      expect(raidsClearedAtTier(rp({ forge: 3 }), 4)).toBe(0)             // tier insuffisant
      expect(raidsClearedAtTier(rp({ abysse: 9 }), 4)).toBe(0)            // l'Abîme ne compte pas
      // le cœur du feature : 1 raid au T4 ne franchit plus le mur du Ch.8 (largeur 2), 2 oui.
      expect(raidsClearedAtTier(rp({ forge: 4 }), 4) < raidGateWidth(8)).toBe(true)
      expect(raidsClearedAtTier(rp({ forge: 4, nexus: 4 }), 4) >= raidGateWidth(8)).toBe(true)
    })
  })

  // Régression — bug du seuil de rareté au drop : l'auto-recyclage protégeait TOUS les uniques
  // (`!it.unique`), contrairement au recyclage de masse (`bulkProtected` : verrou + uniques Cosmique+).
  // À Chapitre élevé ~1/4 des Légendaires farmés sont des uniques → avec un seuil élevé, le joueur voyait
  // de l'Épique/Légendaire (unique) « tomber » malgré le seuil. L'auto doit recycler les uniques sous
  // le seuil, comme la masse.
  describe('auto-recyclage par seuil de rareté', () => {
    it('partage le contrat de protection du recyclage de masse (bulkProtected)', () => {
      const epiqueUnique = { ...mkItem({ type: 'torse', ilvl: 100, rarity: 'epique' }), unique: { id: 'x', rank: 1 } } as Item
      const cosmiqueUnique = { ...mkItem({ type: 'torse', ilvl: 100, rarity: 'cosmique' }), unique: { id: 'x', rank: 1 } } as Item
      expect(bulkProtected(epiqueUnique)).toBe(false)                       // unique sous-Cosmique → recyclable
      expect(bulkProtected({ ...epiqueUnique, locked: true })).toBe(true)   // verrou joueur → protégé
      expect(bulkProtected(cosmiqueUnique)).toBe(true)                      // unique Cosmique+ → protégé
    })

    it('recycle les UNIQUES sous le seuil au drop (essences créditées, Codex préservé)', () => {
      withSeededRandom(20260623, () => {
        reset({
          characters: [strongHero()], stage: 40, bestStage: 40, biomeBest: biomeRec(40),
          autoRecycle: true, recycleThreshold: 13, // Cosmique : tout le farm (≤ Légendaire t6) doit partir, uniques compris
          gold: 0, essence: 0, essences: {}, inventory: [], killCount: 0, enemy: makeEnemy(40),
        })
        for (let i = 0; i < 6000; i++) g().tick(0.2)
      })
      expect(g().killCount).toBeGreaterThan(0)                               // le combat a bien tourné
      expect(g().essence).toBeGreaterThan(0)                                 // du butin a été recyclé (éclats)
      expect(g().inventory.every((it) => !it.unique)).toBe(true)             // AUCUN unique sous-Cosmique conservé (le fix)
      expect(Object.values(g().essences).some((v) => v > 0)).toBe(true)      // essences d'unique créditées (fidèle à la masse)
    })

    // Nouvelle option : recyclage auto du butin « inutile » (n'améliore ni DPS ni survie d'aucun héros),
    // cumulable et INDÉPENDANT du seuil de rareté (ici autoRecycle = false, seuil bas inactif).
    it('le mode « inutile » recycle le butin qui n\'upgrade personne (sans toucher au seuil de rareté)', () => {
      function farm(autoRecycleUseless: boolean) {
        let out = { inv: 0, ess: 0, kills: 0 }
        withSeededRandom(13371337, () => {
          reset({
            characters: [strongHero()], stage: 40, bestStage: 40, biomeBest: biomeRec(40),
            autoRecycle: false, autoRecycleUseless, recycleThreshold: 2, // seuil rareté inactif
            gold: 0, essence: 0, essences: {}, inventory: [], killCount: 0, enemy: makeEnemy(40),
          })
          for (let i = 0; i < 4000; i++) g().tick(0.2)
          out = { inv: g().inventory.length, ess: g().essence, kills: g().killCount }
        })
        return out
      }
      const off = farm(false)  // mode désactivé : le butin (full stuff fort → drops inutiles) s'accumule
      const on = farm(true)    // mode activé : le butin inutile part en éclats
      expect(off.kills).toBeGreaterThan(0)
      expect(on.kills).toBe(off.kills)              // même RNG → combat identique, seule la disposition change
      expect(off.inv).toBeGreaterThan(0)
      expect(on.inv).toBeLessThan(off.inv * 0.5)    // le héros est sur-gearé → l'ESSENTIEL du butin est inutile et part
      expect(on.ess).toBeGreaterThan(off.ess)       // il est converti en éclats (off n'en gagne aucun)
    })
  })
})
