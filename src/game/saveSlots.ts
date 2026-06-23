/**
 * EMPLACEMENTS DE SAUVEGARDE & STOCKAGE DURABLE — couche multi-slots IndexedDB au-dessus de
 * `save.ts`. (À ne pas confondre avec `slots.ts`, qui décrit les emplacements d'ÉQUIPEMENT.)
 *
 * IndexedDB tient N slots (`{ id, name, createdAt, updatedAt, data: SaveData }`) ; le POINTEUR de slot
 * actif + le drapeau anti-windfall vivent dans `localStorage` (lecture synchrone, nécessaire au filet de
 * `flushSave`). La save localStorage existante est MIGRÉE idempotemment en `slot-0` au premier
 * lancement. Si IndexedDB est indisponible (mode privé strict), REPLI mono-slot sur `localStorage`.
 *
 * Durabilité : `save.ts` écrit un FILET synchrone localStorage (`SAVE_KEY`) à chaque persist + reçoit un
 * SINK injecté (`registerDurableSink`) qui mirrore le slot ACTIF dans IndexedDB (debounce). Au boot on
 * RÉCONCILIE filet vs IDB (le `lastSeen` le plus récent gagne — le filet survit à un kill brutal pendant
 * qu'une écriture IDB async est abandonnée). Le relais d'import (`IMPORT_KEY`) garde priorité.
 *
 * Acyclique : ce module importe `save.ts` ; `save.ts` ne l'importe JAMAIS (il reçoit le sink par
 * injection). Aucun accès à `indexedDB`/`window` au chargement du module (les sims Node restent saines).
 *   → Doc : docs/systemes/10-etat-store-et-sauvegarde.md
 */
import type { SaveData } from './save'
import { SAVE_KEY, IMPORT_KEY, freshSave, loadSave, sanitizeRaw, buildSaveData, registerDurableSink } from './save'

const DB_NAME = 'warrior-idler-db'
const DB_VERSION = 1
const STORE = 'slots'
/** Pointeur de slot actif (localStorage : lecture synchrone au boot + au flush). */
const ACTIVE_KEY = 'wi-active-slot'
/** Drapeau « bascule délibérée » : neutralise le crédit hors-ligne du slot cible (anti-windfall). */
const FRESH_SWITCH_KEY = 'wi-fresh-switch'
/** Id du slot initial (issu de la migration localStorage → IDB). */
export const SLOT0 = 'slot-0'
/** Borne raisonnable de sécurité (UI + perf). */
export const MAX_SLOTS = 12

export type StorageMode = 'idb' | 'local'
let mode: StorageMode = 'idb'
export function storageMode(): StorageMode { return mode }

export interface SlotMeta { id: string; name: string; createdAt: number; updatedAt: number }
export interface SlotRecord extends SlotMeta { data: SaveData }
/** Aperçu pour l'UI : métadonnées + repères de progression (sans embarquer toute la save). */
export interface SlotPreview extends SlotMeta {
  level: number
  bestStage: number
  gold: number
  prestigeRank: number
  chars: number
  active: boolean
}

// --- IndexedDB : ouverture paresseuse + petits wrappers Promesse ---------------------------------
let dbInstance: IDBDatabase | null = null
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) { reject(new Error('no-idb')); return }
    let req: IDBOpenDBRequest
    try { req = indexedDB.open(DB_NAME, DB_VERSION) } catch (e) { reject(e); return }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result) }
    req.onerror = () => reject(req.error ?? new Error('idb-open'))
    req.onblocked = () => reject(new Error('idb-blocked'))
  })
  return dbPromise
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
}

/** Écriture AWAITED jusqu'à la complétion de la transaction (durabilité des actions volontaires). */
async function putRecord(rec: SlotRecord): Promise<void> {
  const db = await openDB()
  await new Promise<void>((res, rej) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).put(rec)
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error ?? new Error('idb-abort'))
  })
}
async function getRecord(id: string): Promise<SlotRecord | undefined> {
  const db = await openDB()
  return reqP(db.transaction(STORE, 'readonly').objectStore(STORE).get(id) as IDBRequest<SlotRecord | undefined>)
}
async function getAllRecords(): Promise<SlotRecord[]> {
  const db = await openDB()
  return reqP(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<SlotRecord[]>)
}
async function deleteRecord(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((res, rej) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).delete(id)
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
  })
}

// --- Pointeur actif + drapeau (localStorage, synchrone) ------------------------------------------
export function getActiveSlotId(): string {
  try { return localStorage.getItem(ACTIVE_KEY) || SLOT0 } catch { return SLOT0 }
}
function setActiveSlotId(id: string): void {
  try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* */ }
}
function setFreshSwitchFlag(): void {
  try { localStorage.setItem(FRESH_SWITCH_KEY, '1') } catch { /* */ }
}
function consumeFreshSwitch(): boolean {
  try {
    const v = localStorage.getItem(FRESH_SWITCH_KEY) === '1'
    if (v) localStorage.removeItem(FRESH_SWITCH_KEY)
    return v
  } catch { return false }
}

function newSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}
function slotName(index: number): string {
  return `Partie ${index + 1}`
}
function maxLevel(s: SaveData): number {
  return s.characters.reduce((m, c) => Math.max(m, c.level), 1)
}
function previewOf(r: SlotRecord, activeId: string): SlotPreview {
  return {
    id: r.id, name: r.name, createdAt: r.createdAt, updatedAt: r.updatedAt,
    level: maxLevel(r.data), bestStage: r.data.bestStage, gold: r.data.gold,
    prestigeRank: r.data.prestigeRank ?? 0, chars: r.data.characters.length, active: r.id === activeId,
  }
}

// --- Sink durable : mirror du slot ACTIF dans IndexedDB (debounce ; immédiat sur flush) ----------
const MIRROR_DEBOUNCE_MS = 4000
let mirrorTimer: ReturnType<typeof setTimeout> | null = null
let mirrorPending: SaveData | null = null

function mirrorSink(data: SaveData, immediate: boolean): void {
  if (mode !== 'idb') return
  mirrorPending = data
  if (immediate) {
    if (mirrorTimer) { clearTimeout(mirrorTimer); mirrorTimer = null }
    void flushMirror()
    return
  }
  if (mirrorTimer === null) {
    mirrorTimer = setTimeout(() => { mirrorTimer = null; void flushMirror() }, MIRROR_DEBOUNCE_MS)
  }
}
async function flushMirror(): Promise<void> {
  const data = mirrorPending
  if (!data) return
  mirrorPending = null
  try { await writeSlotData(getActiveSlotId(), data) } catch { /* best-effort */ }
}
/** Écrit `data` dans le slot `id` en préservant nom/createdAt (rafraîchit updatedAt). */
async function writeSlotData(id: string, data: SaveData): Promise<void> {
  const existing = await getRecord(id)
  const now = Date.now()
  await putRecord({
    id,
    name: existing?.name ?? 'Partie',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    data,
  })
}

// --- Boot : probe + migration + réconciliation --------------------------------------------------
export interface BootResult { save: SaveData; activeId: string; mode: StorageMode; freshSwitch: boolean }

/** Lit le stockage durable et renvoie la save du slot ACTIF (migration/réconciliation/relais inclus).
 *  Ne crédite RIEN (le crédit hors-ligne est appliqué APRÈS, par `hydrate` côté store). */
export async function bootStorage(): Promise<BootResult> {
  const freshSwitch = consumeFreshSwitch()

  let db: IDBDatabase | null = null
  try { db = await openDB() } catch { db = null }
  if (!db) {
    // Repli mono-slot : la save vit dans localStorage (relais d'import compris).
    mode = 'local'
    return { save: loadSave(), activeId: SLOT0, mode, freshSwitch }
  }
  mode = 'idb'
  registerDurableSink(mirrorSink)

  // Migration IDEMPOTENTE : aucun slot encore → seed slot-0 depuis la save localStorage existante
  // (loadSave gère le merge defaults + sanitize ; une partie neuve sort une freshSave).
  const all = await getAllRecords()
  if (all.length === 0) {
    const seed = loadSave()
    const now = Date.now()
    await putRecord({ id: SLOT0, name: slotName(0), createdAt: now, updatedAt: now, data: seed })
    setActiveSlotId(SLOT0)
  }

  let activeId = getActiveSlotId()
  if (!(await getRecord(activeId))) {
    // L'actif a disparu (slot supprimé hors-piste) → repli sur le plus ancien slot existant.
    const fallback = (await getAllRecords()).sort((a, b) => a.createdAt - b.createdAt)[0]
    activeId = fallback?.id ?? SLOT0
    setActiveSlotId(activeId)
  }

  // Source la plus fraîche pour le slot ACTIF : relais d'import > filet localStorage > IDB.
  const idbRec = await getRecord(activeId)
  const idbData = idbRec ? sanitizeRaw(idbRec.data) : null

  let chosen: SaveData | null = null
  // 1) Relais d'import : priorité absolue, consommé ici.
  let importRaw: string | null = null
  try { importRaw = localStorage.getItem(IMPORT_KEY) } catch { /* */ }
  if (importRaw) {
    try { chosen = sanitizeRaw(JSON.parse(importRaw)) } catch { chosen = null }
    try { localStorage.removeItem(IMPORT_KEY) } catch { /* */ }
  }
  // 2) Filet localStorage vs IDB : on garde le lastSeen le plus récent — SAUF sur une bascule délibérée
  //    (`freshSwitch`), où le filet appartient encore au slot QUITTÉ : le `pagehide` du reload (markAway →
  //    persist) le réécrit avec l'état SOURCE *après* le changement de pointeur. On charge alors le slot
  //    CIBLE directement depuis l'IDB (le mirror durable est coupé pendant la bascule, voir switchToSlot).
  if (!chosen && !freshSwitch) {
    let netData: SaveData | null = null
    try { const r = localStorage.getItem(SAVE_KEY); if (r) netData = sanitizeRaw(JSON.parse(r)) } catch { /* */ }
    if (netData && idbData) chosen = (netData.lastSeen ?? 0) >= (idbData.lastSeen ?? 0) ? netData : idbData
    else chosen = netData ?? idbData
  }

  return { save: chosen ?? idbData ?? freshSave(), activeId, mode, freshSwitch }
}

// --- Gestion des slots (UI) ---------------------------------------------------------------------
/** Liste les aperçus de slots (triés par création). En repli local : un seul slot synthétique. */
export async function listSlots(): Promise<SlotPreview[]> {
  if (mode !== 'idb') {
    const s = loadSave()
    return [{
      id: SLOT0, name: 'Partie locale', createdAt: 0, updatedAt: s.lastSeen ?? 0,
      level: maxLevel(s), bestStage: s.bestStage, gold: s.gold, prestigeRank: s.prestigeRank ?? 0,
      chars: s.characters.length, active: true,
    }]
  }
  const activeId = getActiveSlotId()
  const all = await getAllRecords()
  return all.sort((a, b) => a.createdAt - b.createdAt).map((r) => previewOf(r, activeId))
}

/** Crée un nouvel emplacement avec une partie NEUVE (ne bascule pas dessus). Renvoie l'id. */
export async function createSlot(): Promise<string> {
  const all = await getAllRecords()
  if (all.length >= MAX_SLOTS) throw new Error('max-slots')
  const id = newSlotId()
  const now = Date.now()
  await putRecord({ id, name: slotName(all.length), createdAt: now, updatedAt: now, data: freshSave() })
  return id
}

/** Duplique un slot = BACKUP local instantané. Pour le slot ACTIF, on prend l'état EN COURS (`current`)
 *  pour un instantané fidèle. Ne bascule pas. Renvoie l'id de la copie. */
export async function duplicateSlot(sourceId: string, current?: SaveData): Promise<string> {
  const all = await getAllRecords()
  if (all.length >= MAX_SLOTS) throw new Error('max-slots')
  const src = all.find((r) => r.id === sourceId)
  const data = sourceId === getActiveSlotId() && current ? current : src?.data
  if (!data) throw new Error('no-source')
  const id = newSlotId()
  const now = Date.now()
  const baseName = src?.name ?? 'Partie'
  await putRecord({
    id, name: `${baseName} (copie)`.slice(0, 24), createdAt: now, updatedAt: now,
    data: JSON.parse(JSON.stringify(data)) as SaveData,
  })
  return id
}

export async function renameSlot(id: string, name: string): Promise<void> {
  const rec = await getRecord(id)
  if (!rec) return
  await putRecord({ ...rec, name: name.trim().slice(0, 24) || rec.name, updatedAt: Date.now() })
}

/** Supprime un slot (jamais l'actif : l'UI le désactive — garde-fou ici aussi). */
export async function deleteSlot(id: string): Promise<void> {
  if (id === getActiveSlotId()) throw new Error('cannot-delete-active')
  await deleteRecord(id)
}

/** Bascule vers `id` : persiste DURABLEMENT le slot courant (awaited), arme l'anti-windfall, purge le
 *  filet (qui pointait l'ancien slot), puis recharge → le boot recharge le nouveau slot via le chemin
 *  éprouvé. Action VOLONTAIRE → pas de course pagehide (on attend l'écriture IDB avant de recharger). */
export async function switchToSlot(id: string, current: SaveData): Promise<void> {
  if (mode !== 'idb' || id === getActiveSlotId()) return
  if (!(await getRecord(id))) throw new Error('no-slot')
  // COUPE le mirror durable AVANT toute autre chose : sinon un persist déclenché par le `pagehide` du
  // reload (App: markAway/flushSave) mirrorerait l'état SOURCE dans le slot CIBLE (course pointeur↔flush).
  // Le mirror est ré-enregistré par `bootStorage` au rechargement.
  registerDurableSink(null)
  await writeSlotData(getActiveSlotId(), current) // persiste durablement le slot courant (awaited)
  setActiveSlotId(id)
  setFreshSwitchFlag()
  try { localStorage.removeItem(SAVE_KEY) } catch { /* */ }
  reloadPage()
}

function reloadPage(): void {
  try { if (typeof window !== 'undefined') window.location.reload() } catch { /* */ }
}

/** Ré-exporté pour l'UI (construit le SaveData de l'état courant à passer à switch/duplicate). */
export { buildSaveData }

// --- Test-only ----------------------------------------------------------------------------------
/** Réinitialise l'état de module (mode, connexion IDB, sink, timers). Réservé aux tests. */
export function __resetForTests(): void {
  try { dbInstance?.close() } catch { /* */ }
  dbInstance = null
  dbPromise = null
  mode = 'idb'
  if (mirrorTimer) { clearTimeout(mirrorTimer); mirrorTimer = null }
  mirrorPending = null
  registerDurableSink(null)
}
