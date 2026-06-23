import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import {
  listSlots, createSlot, duplicateSlot, renameSlot, deleteSlot, switchToSlot, storageMode, buildSaveData,
  MAX_SLOTS, type SlotPreview,
} from '../game/saveSlots'

/**
 * 🗂 GESTIONNAIRE D'EMPLACEMENTS DE SAUVEGARDE (Palier 2) — lister / créer / renommer / dupliquer (=
 * backup local instantané) / supprimer / basculer, avec aperçu (niveau, chapitre, or, prestige).
 *
 * Les opérations sont async (IndexedDB). La BASCULE persiste le slot courant puis recharge la page →
 * le boot recharge le slot cible via le chemin éprouvé. En repli mono-slot (IDB indisponible), on
 * affiche un avertissement et on masque le multi-slot.
 */
export function SlotManager() {
  const mode = storageMode()
  const [slots, setSlots] = useState<SlotPreview[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)

  const refresh = () => { listSlots().then(setSlots).catch(() => setErr('Lecture des emplacements impossible.')) }
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  /** Enveloppe une action async : verrou anti-double-clic + message d'erreur + refresh. */
  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try { await fn() } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setErr(msg === 'max-slots' ? `Limite de ${MAX_SLOTS} emplacements atteinte.` : 'Opération impossible.')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const current = (): ReturnType<typeof buildSaveData> => buildSaveData(useGame.getState())

  if (mode !== 'idb') {
    return (
      <div className="rounded-lg bg-slate-800/40 p-3 text-[11px] text-slate-400">
        🗂 <span className="font-semibold text-slate-300">Emplacements multiples</span> indisponibles : ce
        navigateur restreint le stockage durable (mode privé ?). La partie reste sauvegardée localement
        (un seul emplacement). L'export/import par fichier reste disponible ci-dessous.
      </div>
    )
  }

  const full = (slots?.length ?? 0) >= MAX_SLOTS

  return (
    <div className="space-y-2 rounded-lg bg-slate-800/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-slate-300">🗂 Emplacements de sauvegarde</div>
        <button
          onClick={() => run(async () => { await createSlot() })}
          disabled={busy || full}
          className="rounded-lg bg-emerald-800/60 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-800 disabled:opacity-40"
        >
          + Nouvelle partie
        </button>
      </div>

      {slots === null && <div className="text-[11px] text-slate-500">Chargement…</div>}

      {slots?.map((s) => (
        <div key={s.id} className={'rounded-lg border p-2 ' + (s.active ? 'border-orange-600/50 bg-orange-950/15' : 'border-slate-700/60 bg-slate-900/40')}>
          {renaming?.id === s.id ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={renaming.value}
                maxLength={24}
                onChange={(e) => setRenaming({ id: s.id, value: e.target.value })}
                className="min-w-0 flex-1 rounded bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-sky-600"
              />
              <button onClick={() => run(async () => { await renameSlot(s.id, renaming.value); setRenaming(null) })} className="rounded bg-sky-900/60 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-900">OK</button>
              <button onClick={() => setRenaming(null)} className="rounded bg-slate-700 px-2 py-1 text-[11px] text-slate-300">✕</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <span className="truncate">{s.name}</span>
                  {s.active && <span className="shrink-0 rounded bg-orange-700/60 px-1 text-[9px] font-bold text-orange-100">EN COURS</span>}
                </div>
                <div className="text-[10px] text-slate-400">
                  Niv {s.level} · Ch.{Math.max(1, Math.ceil(s.bestStage / 10))} · 💰 {s.gold.toLocaleString('fr-FR')}
                  {s.prestigeRank > 0 && <span className="text-violet-300"> · ✦{s.prestigeRank}</span>}
                  <span className="text-slate-600"> · {s.chars} héros</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {!s.active && (
                  <button onClick={() => run(async () => { await switchToSlot(s.id, current()) })} disabled={busy} className="rounded bg-orange-800/60 px-2 py-1 text-[10px] font-medium text-orange-100 hover:bg-orange-800 disabled:opacity-40" title="Basculer sur cette partie (recharge)">Jouer</button>
                )}
                <button onClick={() => setRenaming({ id: s.id, value: s.name })} disabled={busy} className="rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-600 disabled:opacity-40" title="Renommer">✏️</button>
                <button onClick={() => run(async () => { await duplicateSlot(s.id, s.active ? current() : undefined) })} disabled={busy || full} className="rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-600 disabled:opacity-40" title="Dupliquer (backup)">📑</button>
                {!s.active && (
                  confirmDelete === s.id ? (
                    <button onClick={() => run(async () => { await deleteSlot(s.id); setConfirmDelete(null) })} disabled={busy} className="rounded bg-red-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-600">Sûr ?</button>
                  ) : (
                    <button onClick={() => setConfirmDelete(s.id)} disabled={busy} className="rounded bg-red-900/40 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900/60 disabled:opacity-40" title="Supprimer">🗑</button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <p className="text-[10px] text-slate-500">
        « Dupliquer » crée un backup instantané. Basculer recharge la page sur la partie choisie.
      </p>
      {err && <p className="text-[11px] text-rose-300">{err}</p>}
    </div>
  )
}
