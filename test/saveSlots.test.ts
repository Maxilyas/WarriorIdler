import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  bootStorage, listSlots, createSlot, duplicateSlot, renameSlot, deleteSlot, switchToSlot,
  getActiveSlotId, storageMode, SLOT0, __resetForTests,
} from '../src/game/saveSlots'
import { freshSave, SAVE_KEY, IMPORT_KEY } from '../src/game/save'

// Chaque test repart d'une base PROPRE : localStorage vidé + IndexedDB neuf + état de module réinitialisé.
beforeEach(() => {
  localStorage.clear()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).indexedDB = new IDBFactory()
  __resetForTests()
})
afterEach(() => { __resetForTests() })

describe('migration localStorage → IndexedDB', () => {
  it('seed slot-0 depuis la save localStorage existante (idempotent)', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...freshSave(), gold: 4242 }))
    const boot = await bootStorage()
    expect(boot.mode).toBe('idb')
    expect(boot.activeId).toBe(SLOT0)
    expect(boot.save.gold).toBe(4242)
    let slots = await listSlots()
    expect(slots).toHaveLength(1)
    expect(slots[0].id).toBe(SLOT0)
    // Re-boot : pas de re-seed (idempotent).
    await createSlot()
    await bootStorage()
    slots = await listSlots()
    expect(slots).toHaveLength(2)
  })

  it('partie NEUVE (aucune save) → slot-0 = freshSave', async () => {
    const boot = await bootStorage()
    expect(boot.save.characters).toHaveLength(1)
    expect(boot.save.onboarded).toBe(false)
    expect(await listSlots()).toHaveLength(1)
  })
})

describe('CRUD des slots', () => {
  it('créer / lister / renommer / dupliquer / supprimer', async () => {
    await bootStorage() // slot-0 actif
    const id2 = await createSlot()
    expect((await listSlots())).toHaveLength(2)

    await renameSlot(id2, 'Mon test')
    expect((await listSlots()).find((s) => s.id === id2)?.name).toBe('Mon test')

    const dupId = await duplicateSlot(SLOT0)
    expect((await listSlots())).toHaveLength(3)
    expect((await listSlots()).find((s) => s.id === dupId)?.name).toMatch(/copie/i)

    await deleteSlot(id2)
    expect((await listSlots())).toHaveLength(2)
  })

  it('refuse de supprimer le slot ACTIF', async () => {
    await bootStorage()
    await expect(deleteSlot(getActiveSlotId())).rejects.toThrow()
  })

  it('aperçu : niveau, chapitre, or, prestige', async () => {
    // `bestStage` est DÉRIVÉ de biomeBest par sanitize (cf. save.test.ts) → on encode CE contrat.
    const base = freshSave()
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...base, gold: 5000, biomeBest: { ...base.biomeBest, physique: 23 }, prestigeRank: 2 }))
    await bootStorage()
    const s = (await listSlots())[0]
    expect(s.gold).toBe(5000)
    expect(s.bestStage).toBe(23)
    expect(s.prestigeRank).toBe(2)
    expect(s.level).toBe(1)
    expect(s.active).toBe(true)
  })
})

describe('bascule de slot (switch)', () => {
  it('persiste le courant, pointe la cible, arme l\'anti-windfall, purge le filet', async () => {
    await bootStorage()
    const id2 = await createSlot()
    const current = { ...freshSave(), gold: 314 }
    await switchToSlot(id2, current) // reload no-op en Node
    expect(getActiveSlotId()).toBe(id2)
    expect(localStorage.getItem('wi-fresh-switch')).toBe('1')
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
    // Le slot QUITTÉ a reçu l'état courant.
    expect((await listSlots()).find((s) => s.id === SLOT0)?.gold).toBe(314)
  })

  it('anti-windfall : le boot suivant consomme le drapeau et neutralise le crédit hors-ligne', async () => {
    await bootStorage()
    const id2 = await createSlot()
    await switchToSlot(id2, { ...freshSave(), gold: 1 })
    const boot = await bootStorage()
    expect(boot.activeId).toBe(id2)
    expect(boot.freshSwitch).toBe(true)
    expect(localStorage.getItem('wi-fresh-switch')).toBeNull() // consommé
  })
})

describe('réconciliation filet localStorage ↔ IndexedDB (durabilité)', () => {
  it('garde le lastSeen le plus récent (filet plus neuf qu\'IDB → filet gagne)', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...freshSave(), gold: 100, lastSeen: 1000 }))
    const b1 = await bootStorage()
    expect(b1.save.gold).toBe(100)
    // Le filet a progressé (kill brutal : IDB resté à 100/1000, filet à 999/5000).
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...freshSave(), gold: 999, lastSeen: 5000 }))
    const b2 = await bootStorage()
    expect(b2.save.gold).toBe(999)
  })

  it('IDB plus neuf que le filet → IDB gagne', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...freshSave(), gold: 100, lastSeen: 1000 }))
    await bootStorage() // slot-0 IDB = 100/1000
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...freshSave(), gold: 50, lastSeen: 500 }))
    const b = await bootStorage()
    expect(b.save.gold).toBe(100) // IDB (1000) > filet (500)
  })
})

describe('compatibilité palier 1 (relais d\'import) + repli sans IndexedDB', () => {
  it('le relais d\'import est promu au boot et consommé (cible le slot actif)', async () => {
    await bootStorage() // seed slot-0
    localStorage.setItem(IMPORT_KEY, JSON.stringify({ ...freshSave(), gold: 8888 }))
    const boot = await bootStorage()
    expect(boot.save.gold).toBe(8888)
    expect(localStorage.getItem(IMPORT_KEY)).toBeNull()
  })

  it('IndexedDB indisponible → repli mono-slot localStorage', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const real = (globalThis as any).indexedDB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).indexedDB = undefined
    __resetForTests()
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...freshSave(), gold: 7 }))
    const boot = await bootStorage()
    expect(boot.mode).toBe('local')
    expect(storageMode()).toBe('local')
    expect(boot.save.gold).toBe(7)
    expect(await listSlots()).toHaveLength(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).indexedDB = real
  })
})
