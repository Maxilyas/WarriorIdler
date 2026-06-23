import { describe, it, expect, beforeEach } from 'vitest'
import { freshSave, loadSave, persist, discoverFromItems, SAVE_KEY } from '../src/game/save'
import type { GameState } from '../src/game/store'

beforeEach(() => localStorage.clear())

describe('freshSave', () => {
  it('produit une save neuve cohérente', () => {
    const s = freshSave()
    expect(s.characters).toHaveLength(1)
    expect(s.characters[0].level).toBe(1)
    expect(s.stage).toBe(1)
    expect(s.bestStage).toBe(1)
    expect(s.gold).toBe(0)
    expect(s.metiersV).toBe(8)
    expect(s.onboarded).toBe(false)
    expect(s.recycleThreshold).toBe(4)
    expect(s.inventory).toEqual([])
    expect(s.codex).toEqual([])
  })
})

describe('loadSave', () => {
  it('retourne une freshSave quand localStorage est vide', () => {
    const s = loadSave()
    expect(s.characters).toHaveLength(1)
    expect(s.onboarded).toBe(false)
  })

  it('complète les champs manquants d\'une save partielle (merge defaults) et considère onboardé', () => {
    // Save "ancienne" minimale : des persos + quelques ressources, le reste absent.
    const fresh = freshSave()
    const partial = { characters: fresh.characters, gold: 12345, noyau: 7 }
    localStorage.setItem(SAVE_KEY, JSON.stringify(partial))
    const s = loadSave()
    // Ressources fournies → conservées.
    expect(s.gold).toBe(12345)
    expect(s.noyau).toBe(7)
    // Champs absents → valeurs par défaut de freshSave.
    expect(s.metiersV).toBe(8)
    expect(s.recycleThreshold).toBe(4)
    // Save existante sans flag onboarded → on ne réimpose pas l'écran d'accueil.
    expect(s.onboarded).toBe(true)
  })
})

describe('persist → loadSave (round-trip)', () => {
  it('préserve les ressources et la progression (dérivée des records de biome)', () => {
    // `stage` est dérivé de biomeStages[activeBiome] et persist y resynchronise s.stage ;
    // `bestStage` = max global de biomeBest. On encode CE contrat, pas un champ plat.
    const s = { ...freshSave(), gold: 999, noyau: 5, sceaux: 3, stage: 42 }
    s.activeBiome = 'physique'
    s.biomeBest = { ...s.biomeBest, physique: 55 }
    persist(s as unknown as GameState)
    const back = loadSave()
    expect(back.gold).toBe(999)
    expect(back.noyau).toBe(5)
    expect(back.sceaux).toBe(3)
    expect(back.stage).toBe(42) // biomeStages[activeBiome], resynchronisé par persist
    expect(back.bestStage).toBe(55) // globalBest(biomeBest)
    expect(back.characters).toHaveLength(1)
  })
})

describe('discoverFromItems', () => {
  it('ajoute les uniques découverts sans doublon, ignore les non-uniques', () => {
    const items = [
      { unique: { id: 'foo' } },
      { unique: { id: 'foo' } }, // doublon → ignoré
      { unique: { id: 'bar' } },
      { }, // pas d'unique
      undefined,
    ]
    const out = discoverFromItems([], items as never)
    expect(out).toEqual(['foo', 'bar'])
  })

  it('ne mute pas le codex existant (immutable) et conserve l\'ordre', () => {
    const codex = ['a']
    const out = discoverFromItems(codex, [{ unique: { id: 'b' } }] as never)
    expect(out).toEqual(['a', 'b'])
    expect(codex).toEqual(['a']) // inchangé
  })
})
