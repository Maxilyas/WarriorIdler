import { createPortal } from 'react-dom'
import { useGame } from '../game/store'

function fmtDuration(ms: number): string {
  const min = Math.floor(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

export function WelcomeBackModal() {
  const report = useGame((s) => s.pendingOffline)
  const claim = useGame((s) => s.claimOffline)
  if (!report) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-indigo-600/50 bg-gradient-to-b from-[#141022] to-[#0d111a] p-5 text-center shadow-2xl">
        <div className="text-4xl">🌙</div>
        <div className="mt-2 text-base font-bold text-indigo-200">Bon retour, guerrier !</div>
        <div className="text-xs text-slate-400">
          Ton équipe a combattu pendant ton absence ({fmtDuration(report.durationMs)}).
        </div>

        <div className="mt-3 space-y-1 rounded-lg bg-black/30 p-3 text-left text-[13px]">
          <Row label="⚔ Ennemis vaincus" value={report.kills.toLocaleString('fr-FR')} />
          <Row label="💰 Or" value={`+${report.gold.toLocaleString('fr-FR')}`} color="text-yellow-400" />
          <Row label="⬆ XP (par perso)" value={`+${report.xp.toLocaleString('fr-FR')}`} color="text-violet-300" />
          {report.noyau > 0 && <Row label="💠 Noyaux" value={`+${report.noyau}`} color="text-fuchsia-300" />}
          {report.sceaux > 0 && <Row label="🔑 Sceaux" value={`+${report.sceaux}`} color="text-amber-300" />}
          {report.items.length > 0 && <Row label="🎒 Objets trouvés" value={`+${report.items.length}`} color="text-sky-300" />}
        </div>

        <button
          onClick={claim}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Récupérer
        </button>
      </div>
    </div>,
    document.body,
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={'font-semibold ' + (color ?? 'text-slate-100')}>{value}</span>
    </div>
  )
}
