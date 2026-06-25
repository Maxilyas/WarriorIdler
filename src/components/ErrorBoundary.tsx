import { Component, type ReactNode } from 'react'

/**
 * FILET de rendu : un composant qui throw ne doit PAS faire un écran noir de tout le jeu.
 *
 * Deux familles d'erreurs sont couvertes :
 *  - **Chunk de code introuvable** (`React.lazy` + `Suspense`) : après une mise à jour PWA en
 *    arrière-plan, l'index encore en mémoire référence un hash de chunk qui n'existe plus → l'import
 *    dynamique rejette. Un re-render ne répare rien : on RECHARGE la page UNE fois (garde anti-boucle
 *    via `sessionStorage`), ce qui récupère le nouvel index. La partie est déjà sauvegardée.
 *  - **Throw de rendu** quelconque : on affiche une carte d'erreur (avec le message) + « Réessayer »
 *    (re-render) et « Recharger », au lieu d'un écran noir muet — l'en-tête et la barre d'onglets
 *    restent vivants quand le filet entoure le panneau (cf. `key={onglet}` dans `App.tsx`).
 */
const RELOAD_FLAG = 'wi-chunk-reload'

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module|ChunkLoadError/i.test(msg)
}

/** Ré-arme l'auto-rechargement une fois l'app stable (gère les MAJ successives d'une longue session
 *  idle), sans ré-armer instantanément (sinon boucle de reload sur un chunk durablement cassé). */
export function rearmChunkReload(delayMs = 10000): () => void {
  const id = window.setTimeout(() => {
    try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* */ }
  }, delayMs)
  return () => window.clearTimeout(id)
}

interface Props { children: ReactNode; fullscreen?: boolean }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1')
          window.location.reload()
        }
      } catch { /* sessionStorage indisponible : on tombe sur la carte manuelle */ }
    }
  }

  private reset = () => this.setState({ error: null })
  private reload = () => {
    try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* */ }
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunk = isChunkLoadError(error)
    return (
      <div className={'flex w-full flex-col items-center justify-center gap-3 p-6 text-center ' + (this.props.fullscreen ? 'h-[100dvh] bg-[#0b0e14]' : 'h-full min-h-[220px]')}>
        <div className="text-3xl">{chunk ? '🔄' : '⚠️'}</div>
        <div className="text-sm font-semibold text-slate-200">
          {chunk ? 'Mise à jour en cours…' : 'Oups — cet écran a planté'}
        </div>
        <div className="max-w-sm text-[11px] leading-snug text-slate-500">
          {chunk
            ? 'Une nouvelle version du jeu vient d\'être déployée. Recharge pour continuer — ta partie est sauvegardée.'
            : 'Une erreur inattendue est survenue dans cet écran. Ta partie est sauvegardée : réessaie, change d\'onglet, ou recharge.'}
        </div>
        {!chunk && (
          <pre className="max-w-sm overflow-auto rounded bg-black/40 p-2 text-left text-[10px] leading-snug text-rose-300">{error.message}</pre>
        )}
        <div className="flex gap-2">
          {!chunk && (
            <button onClick={this.reset} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-600">Réessayer</button>
          )}
          <button onClick={this.reload} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500">Recharger</button>
        </div>
      </div>
    )
  }
}
