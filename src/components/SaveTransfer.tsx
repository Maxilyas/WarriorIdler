import { useState } from 'react'
import { useGame } from '../game/store'
import { exportSaveText, exportFilename } from '../game/save'
import { SaveImport } from './SaveImport'

/**
 * 💾 TRANSFERT DE SAUVEGARDE (Palier 1) — exporter / importer la partie par fichier.
 *
 * EXPORT : sérialise l'état courant (`exportSaveText`) en .json téléchargeable (Blob + <a download>),
 * avec replis « Copier » (presse-papier) et « Partager » (Web Share) pour le mobile où le download est
 * capricieux. IMPORT : délégué à [SaveImport] (logique partagée avec l'écran d'accueil).
 */
export function SaveTransfer() {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const doExport = () => {
    const text = exportSaveText(useGame.getState())
    const name = exportFilename()
    try {
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMsg({ kind: 'ok', text: `Sauvegarde exportée (${name}).` })
    } catch {
      setMsg({ kind: 'err', text: "Téléchargement impossible — essaie « Copier » ou « Partager »." })
    }
  }

  const doCopy = async () => {
    const text = exportSaveText(useGame.getState())
    try {
      await navigator.clipboard.writeText(text)
      setMsg({ kind: 'ok', text: 'Sauvegarde copiée dans le presse-papier — colle-la dans un fichier sûr.' })
    } catch {
      setMsg({ kind: 'err', text: 'Presse-papier refusé par le navigateur.' })
    }
  }

  const doShare = async () => {
    const text = exportSaveText(useGame.getState())
    try {
      await navigator.share({ title: 'Sauvegarde Warrior Idler', text })
      setMsg({ kind: 'ok', text: 'Sauvegarde partagée.' })
    } catch {
      /* l'utilisateur a annulé le partage — silencieux */
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-800/40 p-3">
      <div className="text-[11px] font-semibold text-slate-300">💾 Sauvegarde (fichier)</div>
      <p className="text-[10.5px] text-slate-500">
        Exporte ta partie dans un fichier pour la garder en sûreté ou la transférer sur un autre appareil.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={doExport} className="rounded-lg bg-emerald-800/60 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-800">
          ⬇ Exporter (fichier)
        </button>
        <button onClick={doCopy} className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-600">
          📋 Copier
        </button>
        {canShare && (
          <button onClick={doShare} className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-600">
            📤 Partager
          </button>
        )}
      </div>

      {msg && (
        <p className={'text-[11px] ' + (msg.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300')}>{msg.text}</p>
      )}

      <div className="pt-1">
        <SaveImport />
      </div>
    </div>
  )
}
