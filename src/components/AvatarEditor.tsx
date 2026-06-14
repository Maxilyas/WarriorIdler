import { useGame } from '../game/store'
import { AVATAR_PALETTES, AVATAR_EMBLEMS, resolveAvatar } from '../game/avatar'
import { LevelBadge } from './LevelBadge'

/** 🎨 Éditeur de portrait (v0.28, C1) — palette + emblème, par héros. Aperçu live via LevelBadge. */
export function AvatarEditor() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setAvatar = useGame((s) => s.setAvatar)
  const char = characters[activeChar] ?? characters[0]
  if (!char) return null
  const { pal, emb } = resolveAvatar(char.primaryBias, char.avatar)

  return (
    <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">🎨 Apparence</div>
      <div className="flex items-start gap-3">
        <LevelBadge char={char} size={56} />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Palette</div>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAvatar(char.id, { palette: p.id })}
                  title={p.name}
                  className={'h-6 w-6 rounded-full ring-2 transition ' + (pal.id === p.id ? 'ring-orange-400' : 'ring-transparent hover:ring-slate-500')}
                  style={{ background: `linear-gradient(160deg, ${p.c1}, ${p.c2})` }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Emblème</div>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_EMBLEMS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setAvatar(char.id, { emblem: e.id })}
                  title={e.name}
                  className={'flex h-7 w-7 items-center justify-center rounded-lg text-sm transition ' + (emb.id === e.id ? 'bg-orange-500/20 ring-1 ring-orange-400' : 'bg-slate-800 hover:bg-slate-700')}
                >
                  {e.glyph}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
