import { useState } from 'react'
import { useGame } from '../game/store'
import { CharacterPanel, type CharacterView } from './CharacterPanel'
import { TalentTree } from './TalentTree'
import { SubTab } from './ui'

type HerosView = CharacterView | 'talents'

/** Hub Héros : la fiche perso éclatée en vues courtes + l'arbre de talents,
 *  sous un seul onglet de barre. */
export function HerosHub({ talentsUnlocked }: { talentsUnlocked: boolean }) {
  const characters = useGame((s) => s.characters)
  const talentPoints = characters.reduce((a, c) => a + c.talentPoints, 0)
  const [sub, setSub] = useState<HerosView>('apercu')
  const active: HerosView = sub === 'talents' && !talentsUnlocked ? 'apercu' : sub

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex gap-1.5">
        <SubTab on={active === 'apercu'} onClick={() => setSub('apercu')}>🛡 Aperçu</SubTab>
        <SubTab on={active === 'stats'} onClick={() => setSub('stats')}>📊 Stats</SubTab>
        <SubTab on={active === 'capacites'} onClick={() => setSub('capacites')}>⚡ Capacités</SubTab>
        {talentsUnlocked && (
          <SubTab on={active === 'talents'} onClick={() => setSub('talents')}>
            🌌 Talents
            {talentPoints > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-950">{talentPoints}</span>}
          </SubTab>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {active === 'talents' ? (
          <TalentTree />
        ) : (
          <div className="h-full overflow-y-auto pr-1">
            <CharacterPanel view={active} />
          </div>
        )}
      </div>
    </div>
  )
}
