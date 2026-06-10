import { useState } from 'react'
import { useGame } from '../game/store'
import { DungeonPanel } from './DungeonPanel'
import { RaidPanel } from './RaidPanel'
import { SubTab } from './ui'

/** Hub Expéditions : donjons + raids sous un seul onglet de barre.
 *  Les raids restent visibles avant leur déblocage (teaser géré par RaidPanel). */
export function ExpedHub({ raidsUnlocked }: { raidsUnlocked: boolean }) {
  const sceaux = useGame((s) => s.sceaux)
  const orbes = useGame((s) => s.orbes)
  const inDungeon = useGame((s) => s.dungeon !== null)
  const inRaid = useGame((s) => s.raid !== null)
  const [sub, setSub] = useState<'donjons' | 'raids'>('donjons')

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex gap-1.5">
        <SubTab on={sub === 'donjons'} onClick={() => setSub('donjons')}>
          🏰 Donjons
          {(sceaux > 0 || inDungeon) && (
            <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-950">{inDungeon ? '!' : sceaux}</span>
          )}
        </SubTab>
        <SubTab on={sub === 'raids'} onClick={() => setSub('raids')}>
          {raidsUnlocked ? '☠️' : '🔒'} Raids
          {(orbes > 0 || inRaid) && raidsUnlocked && (
            <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-slate-950">{inRaid ? '!' : orbes}</span>
          )}
        </SubTab>
      </div>
      <div className="min-h-0 flex-1">{sub === 'donjons' ? <DungeonPanel /> : <RaidPanel />}</div>
    </div>
  )
}
