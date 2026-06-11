import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Feuille de bas d'écran — le standard mobile du jeu pour tout contenu riche.
 * Remplace aussi les info-bulles `title`, inexistantes au tactile.
 */
export function Sheet({ title, onClose, children }: { title?: ReactNode; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-[#0b0e14] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-200">{title}</div>
            <button onClick={onClose} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-slate-400 hover:bg-slate-700" aria-label="Fermer">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Bouton à CONFIRMATION (double-tap) : le premier clic arme le bouton (« Confirmer ? », 4 s),
 * le second exécute. Standard mobile du jeu pour les actions destructrices (respec, ventes de
 * masse en haute rareté…) — pas de modal bloquante, pas de window.confirm.
 */
export function ConfirmButton({ onConfirm, className = '', confirmLabel = '⚠ Confirmer ?', disabled, title, children }: {
  onConfirm: () => void
  className?: string
  confirmLabel?: ReactNode
  disabled?: boolean
  title?: string
  children: ReactNode
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={() => {
        if (armed) { setArmed(false); onConfirm() } else setArmed(true)
      }}
      className={className + (armed ? ' !bg-rose-700/70 !text-rose-100 ring-1 ring-rose-400' : '')}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}

/** Onglet interne d'un hub (segmented control plein largeur). */
export function SubTab({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ' +
        (on ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200')
      }
    >
      {children}
    </button>
  )
}
