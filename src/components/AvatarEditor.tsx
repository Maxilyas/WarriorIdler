import { useGame } from '../game/store'
import { AVATAR_PALETTES, AVATAR_EMBLEMS, AVATAR_BORDERS, AVATAR_AURAS, resolveAvatar } from '../game/avatar'
import { unlockedCosmetics } from '../game/achievements'
import { LevelBadge } from './LevelBadge'

/** 🎨 Éditeur de portrait — palette + emblème par héros, avec cosmétiques premium
 *  débloqués contre Poussière d'étoile 🌌. Parures de prestige (bordure + aura) débloquées
 *  par les hauts faits de l'étage Légende. Aperçu live via LevelBadge. */
export function AvatarEditor() {
  const characters = useGame((s) => s.characters)
  const setAvatar = useGame((s) => s.setAvatar)
  const cosmetics = useGame((s) => s.cosmetics)
  const poussiere = useGame((s) => s.poussiere)
  const unlockCosmetic = useGame((s) => s.unlockCosmetic)
  const achievements = useGame((s) => s.achievements)
  const eventCosmetics = useGame((s) => s.eventCosmetics)
  // apparence de COMPTE : éditée sur l'ancre characters[0], affichée par UN badge unique.
  const acct = characters[0]
  if (!acct) return null
  const { pal, emb, border, aura } = resolveAvatar(acct.primaryBias, acct.avatar)

  const parures = unlockedCosmetics(achievements)
  const myBorders = AVATAR_BORDERS.filter((b) => parures.borders.includes(b.id))
  // Auras = parures de hauts faits (Légende) ∪ auras d'invasion débloquées en event (🎉).
  const myAuras = AVATAR_AURAS.filter((a) => parures.auras.includes(a.id) || eventCosmetics.includes(a.id))

  const isLocked = (cost?: number, id?: string) => !!cost && cost > 0 && !cosmetics[id ?? '']

  return (
    <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">🎨 Apparence</span>
        <span className="text-[10px] text-indigo-300">🌌 {poussiere.toLocaleString('fr-FR')}</span>
      </div>
      <div className="flex items-start gap-3">
        <LevelBadge char={acct} size={56} />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Palette <span className="text-slate-600">· 🔒 = à débloquer (🌌)</span></div>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_PALETTES.map((p) => {
                const locked = isLocked(p.cost, p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => (locked ? unlockCosmetic(p.id) : setAvatar({ palette: p.id }))}
                    title={locked ? `${p.name} — débloquer pour 🌌 ${p.cost}` : p.name}
                    disabled={locked && poussiere < (p.cost ?? 0)}
                    className={'relative flex h-6 w-6 items-center justify-center rounded-full text-[8px] ring-2 transition disabled:cursor-not-allowed ' + (pal.id === p.id ? 'ring-orange-400' : 'ring-transparent hover:ring-slate-500') + (locked ? ' opacity-60' : '')}
                    style={{ background: `linear-gradient(160deg, ${p.c1}, ${p.c2})` }}
                  >
                    {locked && <span className="drop-shadow">🔒</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Emblème</div>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_EMBLEMS.map((e) => {
                const locked = isLocked(e.cost, e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() => (locked ? unlockCosmetic(e.id) : setAvatar({ emblem: e.id }))}
                    title={locked ? `${e.name} — débloquer pour 🌌 ${e.cost}` : e.name}
                    disabled={locked && poussiere < (e.cost ?? 0)}
                    className={'relative flex h-7 w-7 items-center justify-center rounded-lg text-sm transition disabled:cursor-not-allowed ' + (emb.id === e.id ? 'bg-orange-500/20 ring-1 ring-orange-400' : 'bg-slate-800 hover:bg-slate-700') + (locked ? ' opacity-50' : '')}
                  >
                    {e.glyph}
                    {locked && <span className="absolute -bottom-1 -right-1 text-[8px]">🔒</span>}
                  </button>
                )
              })}
            </div>
          </div>
          {/* 🏅 Parures de prestige — débloquées par les hauts faits Légende (pas d'achat). */}
          <div>
            <div className="mb-1 text-[10px] text-slate-500">🏅 Parures <span className="text-slate-600">· hauts faits Légende 👑 & events 🎉</span></div>
            {myBorders.length === 0 && myAuras.length === 0 ? (
              <div className="text-[10px] italic text-slate-600">Aucune parure pour l'instant — décroche un haut fait Légende ou un capstone d'invasion 🎉.</div>
            ) : (
              <div className="space-y-1.5">
                {myBorders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="w-12 shrink-0 text-[9px] uppercase tracking-wide text-slate-600">Bordure</span>
                    <button
                      onClick={() => setAvatar({ border: undefined })}
                      title="Aucune bordure"
                      className={'flex h-7 w-7 items-center justify-center rounded-full text-[9px] ring-2 transition ' + (!border ? 'ring-orange-400' : 'ring-transparent hover:ring-slate-500')}
                    >∅</button>
                    {myBorders.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setAvatar({ border: b.id })}
                        title={`Bordure ${b.name}`}
                        className={'h-7 w-7 rounded-full bg-[#0a0e16] ring-2 transition ' + (border?.id === b.id ? 'ring-orange-400' : 'ring-transparent hover:ring-slate-500')}
                        style={{ boxShadow: `inset 0 0 0 2.5px ${b.c2}, inset 0 0 0 4px ${b.c1}` }}
                      />
                    ))}
                  </div>
                )}
                {myAuras.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="w-12 shrink-0 text-[9px] uppercase tracking-wide text-slate-600">Aura</span>
                    <button
                      onClick={() => setAvatar({ aura: undefined })}
                      title="Aucune aura"
                      className={'flex h-7 w-7 items-center justify-center rounded-full text-[9px] ring-2 transition ' + (!aura ? 'ring-orange-400' : 'ring-transparent hover:ring-slate-500')}
                    >∅</button>
                    {myAuras.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setAvatar({ aura: a.id })}
                        title={`Aura ${a.name}`}
                        className={'h-7 w-7 rounded-full ring-2 transition ' + (aura?.id === a.id ? 'ring-orange-400' : 'ring-transparent hover:ring-slate-500')}
                        style={{ background: `radial-gradient(circle, ${a.color} 10%, transparent 72%)` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
