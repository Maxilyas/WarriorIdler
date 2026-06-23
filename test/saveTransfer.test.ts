import { describe, it, expect, beforeEach } from 'vitest'
import {
  freshSave,
  loadSave,
  exportSaveText,
  buildExport,
  parseImport,
  applyImport,
  lightChecksum,
  exportFilename,
  SAVE_SCHEMA,
  APP_TAG,
  SAVE_KEY,
  IMPORT_KEY,
} from '../src/game/save'
import type { GameState } from '../src/game/store'

beforeEach(() => localStorage.clear())

/** Construit un GameState minimal (suffisant pour buildSaveData) à partir d'une freshSave personnalisée. */
function stateWith(overrides: Partial<ReturnType<typeof freshSave>>): GameState {
  return { ...freshSave(), ...overrides } as unknown as GameState
}

describe('export — enveloppe', () => {
  it('estampille app / schéma / horodatage / checksum cohérent', () => {
    const env = buildExport(stateWith({ gold: 4242 }))
    expect(env.app).toBe(APP_TAG)
    expect(env.schema).toBe(SAVE_SCHEMA)
    expect(env.exportedAt).toBeGreaterThan(0)
    expect(env.data.gold).toBe(4242)
    // Le checksum doit correspondre au JSON compact des données.
    expect(env.checksum).toBe(lightChecksum(JSON.stringify(env.data)))
  })

  it('exportSaveText produit un JSON ré-analysable', () => {
    const text = exportSaveText(stateWith({ noyau: 9 }))
    const obj = JSON.parse(text)
    expect(obj.app).toBe(APP_TAG)
    expect(obj.data.noyau).toBe(9)
  })

  it('exportFilename suit le motif daté', () => {
    const name = exportFilename(new Date(2026, 5, 23, 9, 7)) // mois 0-indexé → juin
    expect(name).toBe('warrior-idler-2026-06-23-0907.json')
  })
})

describe('round-trip export → parseImport → applyImport → loadSave', () => {
  it('restitue à l\'identique les ressources et la progression', () => {
    const src = stateWith({ gold: 777, sceaux: 12, noyau: 3 })
    src.activeBiome = 'physique'
    src.biomeBest = { ...src.biomeBest, physique: 60 }
    src.stage = 47

    const text = exportSaveText(src)
    const res = parseImport(text)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.warning).toBeUndefined()

    applyImport(res.data)
    const back = loadSave()
    expect(back.gold).toBe(777)
    expect(back.sceaux).toBe(12)
    expect(back.noyau).toBe(3)
    expect(back.stage).toBe(47)
    expect(back.bestStage).toBe(60)
    // applyImport neutralise le crédit hors-ligne et marque onboardé.
    expect(back.onboarded).toBe(true)
  })

  it('le relais d\'import a PRIORITÉ sur SAVE_KEY et survit à une save concurrente (anti-clobber)', () => {
    // Simule la course du reload : SAVE_KEY contient l'état PRÉ-import (flush de pagehide), IMPORT_KEY
    // le payload importé. loadSave doit promouvoir l'import, pas l'état pré-import.
    const preImport = { ...freshSave(), gold: 111 }
    localStorage.setItem(SAVE_KEY, JSON.stringify(preImport))
    const imported = { ...freshSave(), gold: 999999 }
    applyImport(imported)
    const back = loadSave()
    expect(back.gold).toBe(999999)
    // Le relais est CONSOMMÉ (un reload ultérieur repart de la save normale, désormais = l'import promu).
    expect(localStorage.getItem(IMPORT_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).gold).toBe(999999)
    expect(loadSave().gold).toBe(999999)
  })

  it('applyImport remet lastSeen ≈ maintenant (pas de crédit hors-ligne fortuit)', () => {
    const before = Date.now()
    const text = exportSaveText(stateWith({ gold: 1 }))
    const res = parseImport(text)
    if (!res.ok) throw new Error('parse échoué')
    // Falsifie un vieux lastSeen dans le payload : applyImport doit l'écraser.
    res.data.lastSeen = 0
    applyImport(res.data)
    const back = loadSave()
    expect(back.lastSeen).toBeGreaterThanOrEqual(before)
  })
})

describe('parseImport — défensif', () => {
  it('rejette un JSON corrompu', () => {
    const res = parseImport('{ ceci n\'est pas: du JSON, ')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/JSON/i)
  })

  it('rejette un JSON valide mais sans équipe', () => {
    const res = parseImport(JSON.stringify({ app: APP_TAG, schema: 1, data: { gold: 5 } }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/équipe/i)
  })

  it('rejette un contenu non-objet', () => {
    expect(parseImport('42').ok).toBe(false)
    expect(parseImport('null').ok).toBe(false)
  })

  it('accepte un SaveData BRUT (sans enveloppe)', () => {
    const fresh = freshSave()
    const res = parseImport(JSON.stringify(fresh))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.characters).toHaveLength(1)
  })

  it('AVERTIT (sans bloquer) sur un schéma plus récent que l\'app', () => {
    const env = buildExport(stateWith({ gold: 1 }))
    const future = { ...env, schema: SAVE_SCHEMA + 5 }
    const res = parseImport(JSON.stringify(future))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.warning).toMatch(/récente/i)
  })

  it('AVERTIT sur un checksum incohérent (fichier altéré)', () => {
    const env = buildExport(stateWith({ gold: 1 }))
    const tampered = JSON.stringify({ ...env, checksum: env.checksum ^ 0xffff })
    const res = parseImport(tampered)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.warning).toMatch(/checksum/i)
  })

  it('NE touche PAS la save courante tant que applyImport n\'est pas appelé', () => {
    const fresh = freshSave()
    fresh.gold = 555
    localStorage.setItem(SAVE_KEY, JSON.stringify(fresh))
    // Un import corrompu ne doit RIEN écraser.
    parseImport('garbage{{{')
    expect(loadSave().gold).toBe(555)
  })
})
