import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset, biomeRec, mkItem } from './_helpers'
import { makeCharacter, charMaxHp } from '../../src/game/character'
import { makeEnemy } from '../../src/game/enemies'
import { bulkProtected } from '../../src/game/storeHelpers'
import type { EquipSlotId, ItemType, Item } from '../../src/game/types'

function gearedHero(level = 50) {
  const c = makeCharacter('H', level, 'force')
  c.equipment.armePrincipale = mkItem({ type: 'armePrincipale', ilvl: 150, rarity: 'epique' })
  c.hp = charMaxHp(c)
  return c
}

/** Héros sur-équipé : tue vite à un palier élevé (≈ 60) où le farm lâche de l'Épique/Légendaire. */
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
  for (const { slot, type } of FULL_SLOTS) c.equipment[slot] = mkItem({ type, ilvl: 800, rarity: 'legendaire' })
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

  // Régression — bug du seuil de rareté au drop : l'auto-recyclage protégeait TOUS les uniques
  // (`!it.unique`), contrairement au recyclage de masse (`bulkProtected` : verrou + uniques Cosmique+).
  // À haut palier ~1/4 des Légendaires farmés sont des uniques → avec un seuil élevé, le joueur voyait
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
      expect(on.inv).toBeLessThan(off.inv)          // le butin inutile ne s'accumule plus
      expect(on.ess).toBeGreaterThan(off.ess)       // il est converti en éclats (off n'en gagne aucun)
    })
  })
})
