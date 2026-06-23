import { useRef, useState, type ChangeEvent } from 'react'
import { useGame } from '../game/store'
import { exportSaveText, exportFilename, parseImport, applyImport, type SaveData } from '../game/save'

/**
 * 💾 TRANSFERT DE SAUVEGARDE (Palier 1) — exporter / importer la partie par fichier.
 *
 * EXPORT : sérialise l'état courant (`exportSaveText`) en .json téléchargeable (Blob + <a download>),
 * avec replis « Copier » (presse-papier) et « Partager » (Web Share) pour le mobile où le download est
 * capricieux. IMPORT : lit un fichier (FileReader) OU un texte collé → `parseImport` défensif (jamais
 * d'écrasement avant validation) → confirmation → `applyImport` (écrit dans localStorage) → reload, qui
 * réutilise le chemin d'init éprouvé du store (loadSave → sanitize, crédit hors-ligne, automates).
 */
export function SaveTransfer() {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, setPending] = useState<{ data: SaveData; warning?: string } | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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

  /** Valide un texte importé SANS écraser : succès → on arme la confirmation, échec → message clair. */
  const stage = (text: string) => {
    const res = parseImport(text)
    if (!res.ok) {
      setPending(null)
      setMsg({ kind: 'err', text: res.error })
      return
    }
    setMsg(null)
    setPending({ data: res.data, warning: res.warning })
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // autorise la re-sélection du même fichier
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => stage(String(reader.result ?? ''))
    reader.onerror = () => setMsg({ kind: 'err', text: 'Lecture du fichier impossible.' })
    reader.readAsText(file)
  }

  const confirmImport = () => {
    if (!pending) return
    try {
      applyImport(pending.data)
      window.location.reload() // réutilise le cold-start du store (sanitize + init)
    } catch {
      setPending(null)
      setMsg({ kind: 'err', text: "Écriture impossible (stockage plein ?) — import annulé, partie intacte." })
    }
  }

  // Étape de CONFIRMATION : la save importée est validée, on prévient avant d'écraser la partie.
  if (pending) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3">
        <p className="text-[11px] font-semibold text-amber-300">
          ⚠ Importer cette sauvegarde ÉCRASERA définitivement ta partie en cours.
        </p>
        {pending.warning && (
          <p className="whitespace-pre-line text-[11px] text-rose-300">{pending.warning}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={confirmImport}
            className="flex-1 rounded-lg bg-amber-700 py-2 text-xs font-semibold text-white hover:bg-amber-600"
          >
            Oui, importer et recharger
          </button>
          <button
            onClick={() => setPending(null)}
            className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-600"
          >
            Annuler
          </button>
        </div>
      </div>
    )
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

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-sky-900/50 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-900/70">
          ⬆ Importer un fichier
        </button>
        <button onClick={() => setPasteOpen((v) => !v)} className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-600">
          📝 Coller un texte
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json,.txt" onChange={onFile} className="hidden" />
      </div>

      {pasteOpen && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Colle ici le contenu d'une sauvegarde…"
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 p-2 font-mono text-[10px] text-slate-200 outline-none focus:border-sky-600"
          />
          <button
            onClick={() => stage(pasteText)}
            disabled={!pasteText.trim()}
            className="rounded-lg bg-sky-900/50 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-900/70 disabled:opacity-40"
          >
            Analyser le texte collé
          </button>
        </div>
      )}

      {msg && (
        <p className={'text-[11px] ' + (msg.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300')}>{msg.text}</p>
      )}
    </div>
  )
}
