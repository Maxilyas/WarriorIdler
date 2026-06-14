import { useGame } from '../game/store'
import { AVATAR_PALETTES, AVATAR_EMBLEMS, resolveAvatar } from '../game/avatar'
import { LevelBadge } from './LevelBadge'

/** 🎨 Éditeur de portrait (v0.28, C1 + B2) — palette + emblème par héros, avec cosmétiques premium
 *  débloqués contre Poussière d'étoile 🌌. Aperçu live via LevelBadge. */
export function AvatarEditor() {
  const characters = useGame((s) => s.characters)
  const activeChar = useGame((s) => s.activeChar)
  const setAvatar = useGame((s) => s.setAvatar)
  const cosmetics = useGame((s) => s.cosmetics)
  const poussiere = useGame((s) => s.poussiere)
  const unlockCosmetic = useGame((s) => s.unlockCosmetic)
  const char = characters[activeChar] ?? characters[0]
  if (!char) return null
  const { pal, emb } = resolveAvatar(char.primaryBias, char.avatar)

  const isLocked = (cost?: number, id?: string) => !!cost && cost > 0 && !cosmetics[id ?? '']

  return (
    <div className="rounded-xl border border-slate-800 bg-[#11151f] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">🎨 Apparence</span>
        <span className="text-[10px] text-indigo-300">🌌 {poussiere.toLocaleString('fr-FR')}</span>
      </div>
      <div className="flex items-start gap-3">
        <LevelBadge char={char} size={56} />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Palette <span className="text-slate-600">· 🔒 = à débloquer (🌌)</span></div>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_PALETTES.map((p) => {
                const locked = isLocked(p.cost, p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => (locked ? unlockCosmetic(p.id) : setAvatar(char.id, { palette: p.id }))}
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
                    onClick={() => (locked ? unlockCosmetic(e.id) : setAvatar(char.id, { emblem: e.id }))}
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
        </div>
      </div>
    </div>
  )
}
