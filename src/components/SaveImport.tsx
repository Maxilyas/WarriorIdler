import { useRef, useState, type ChangeEvent } from 'react'
import { parseImport, applyImport, type SaveData } from '../game/save'

/**
 * 📥 BLOC D'IMPORT DE SAUVEGARDE réutilisable (Palier 1) — fichier (`<input type=file>` + FileReader) OU
 * texte collé → `parseImport` DÉFENSIF (jamais d'écrasement avant validation) → CONFIRMATION → `applyImport`
 * (dépose sous le relais `IMPORT_KEY`) → `window.location.reload()`, qui réutilise le chemin de boot
 * éprouvé (`bootStorage`/`loadSave` → `sanitize`, crédit hors-ligne) et aboutit à une partie ONBOARDÉE.
 *
 * Partagé entre la section Réglages ([SaveTransfer]) et l'écran d'accueil ([WelcomeScreen]) → la logique
 * d'import n'est PAS dupliquée. `confirmPrompt` adapte le libellé d'avertissement au contexte (partie en
 * cours à écraser vs nouveau venu).
 */
export function SaveImport({
  confirmPrompt = '⚠ Importer cette sauvegarde ÉCRASERA définitivement ta partie en cours.',
}: {
  confirmPrompt?: string
}) {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, setPending] = useState<{ data: SaveData; warning?: string } | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
      window.location.reload() // réutilise le cold-start du store (sanitize + init), partie onboardée
    } catch {
      setPending(null)
      setMsg({ kind: 'err', text: "Écriture impossible (stockage plein ?) — import annulé, partie intacte." })
    }
  }

  // Étape de CONFIRMATION : la save importée est validée, on prévient avant d'écraser.
  if (pending) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3">
        <p className="text-[11px] font-semibold text-amber-300">{confirmPrompt}</p>
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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
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
