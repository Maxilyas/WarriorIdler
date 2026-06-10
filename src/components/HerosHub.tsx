import { useState } from 'react'
import { useGame } from '../game/store'
import { CharacterPanel } from './CharacterPanel'
import { TalentTree } from './TalentTree'
import { SubTab } from './ui'

/** Hub Héros : fiche du personnage + arbre de talents sous un seul onglet de barre. */
export function HerosHub({ talentsUnlocked }: { talentsUnlocked: boolean }) {
  const characters = useGame((s) => s.characters)
  const talentPoints = characters.reduce((a, c) => a + c.talentPoints, 0)
  const [sub, setSub] = useState<'perso' | 'talents'>('perso')
  const active = sub === 'talents' && talentsUnlocked ? 'talents' : 'perso'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex gap-1.5">
        <SubTab on={active === 'perso'} onClick={() => setSub('perso')}>🛡 Perso</SubTab>
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
            <CharacterPanel />
          </div>
        )}
      </div>
    </div>
  )
}
