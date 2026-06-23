// Polyfill minimal de `localStorage` pour l'environnement Node (save.ts lit/écrit la save).
// In-memory, réinitialisable par les tests via `localStorage.clear()`.
class MemoryStorage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string) { this.store.set(k, String(v)) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
}

if (!('localStorage' in globalThis)) {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), writable: true })
}
