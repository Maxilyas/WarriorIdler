import { useState } from 'react'
import { useGame } from '../game/store'
import { PRIMARY_META } from '../game/stats'
import type { PrimaryStat } from '../game/types'

/** Les 3 spés jouables au départ (l'Endurance n'est jamais une stat de combat). */
type Spec = Exclude<PrimaryStat, 'endurance'>

/** Fiche de chaque spé : archétype, icône, accroche — pour un choix éclairé dès la 1re seconde. */
const SPECS: { id: Spec; icon: string; tag: string; blurb: string }[] = [
  {
    id: 'force', icon: '⚔️', tag: 'Guerrier de mêlée',
    blurb: 'Frappes lourdes et grosse survie. Solide et simple à jouer — l’idéal pour débuter.',
  },
  {
    id: 'agilite', icon: '🗡️', tag: 'Lame agile',
    blurb: 'Attaques rapides, critiques et coups furtifs. Pour un style nerveux et agressif.',
  },
  {
    id: 'intelligence', icon: '🔮', tag: 'Mage de guerre',
    blurb: 'Sorts élémentaires dévastateurs portés par le mana. Pour un style à distance.',
  },
]

/** Le cœur de boucle, expliqué en une poignée de lignes (un nouveau joueur sait où il va). */
const GOALS: { icon: string; title: string; text: string }[] = [
  { icon: '⚔️', title: 'Combats automatiques', text: 'Ton héros enchaîne seul des paliers d’ennemis de plus en plus coriaces — même hors-ligne.' },
  { icon: '🎒', title: 'Loote & équipe-toi', text: 'Chaque pièce te rend plus fort. Ta spécialisation oriente le butin qui tombe.' },
  { icon: '🔓', title: 'Débloque des systèmes', text: 'Marché, Forge, Talents, Donjons puis Raids s’ouvrent au fil de ta progression.' },
  { icon: '🎯', title: 'Objectif', text: 'Monter le plus haut possible en paliers et bâtir le build parfait.' },
]

/**
 * Écran d'accueil d'une PARTIE NEUVE : présente le but du jeu et fait CHOISIR la spé de départ avant
 * que le combat (et donc le butin) ne démarre. Résout le piège « ça lance tout seul en Force ».
 */
export function WelcomeScreen() {
  const completeOnboarding = useGame((s) => s.completeOnboarding)
  const [spec, setSpec] = useState<Spec | null>(null)

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#070a11]">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-5 px-4 py-8 sm:py-12">
        {/* En-tête de marque */}
        <header className="text-center">
          <h1 className="text-2xl font-bold tracking-wide sm:text-3xl">
            <span className="text-orange-400">⚔</span> Warrior <span className="text-orange-400">Idler</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">Un RPG idle : ton héros se bat en continu. À toi de le rendre redoutable.</p>
        </header>

        {/* But du jeu */}
        <section className="rounded-2xl border border-slate-800 bg-[#0d111a] p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Le but du jeu</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {GOALS.map((g) => (
              <div key={g.title} className="flex gap-2.5">
                <span className="text-lg leading-none">{g.icon}</span>
                <div>
                  <div className="text-[13px] font-semibold text-slate-200">{g.title}</div>
                  <div className="text-[11.5px] leading-snug text-slate-400">{g.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Choix de spécialisation */}
        <section>
          <div className="mb-1 text-center text-sm font-semibold text-slate-200">Choisis ta spécialisation de départ</div>
          <p className="mx-auto mb-3 max-w-md text-center text-[11.5px] leading-snug text-slate-500">
            Elle définit la <b className="text-slate-300">stat de combat</b> qui alimente ta puissance, et oriente le butin
            qui tombe. Tu pourras en changer plus tard dans l’onglet <b className="text-slate-300">🛡 Héros</b>.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {SPECS.map((s) => {
              const meta = PRIMARY_META[s.id]
              const on = spec === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSpec(s.id)}
                  className={
                    'rounded-2xl border p-4 text-left transition-all ' +
                    (on ? 'bg-white/5 ring-2' : 'border-slate-800 bg-[#0d111a] hover:bg-white/5')
                  }
                  style={on ? { borderColor: meta.color, boxShadow: `0 0 0 2px ${meta.color}, 0 0 22px -6px ${meta.color}` } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl leading-none">{s.icon}</span>
                    <div>
                      <div className="text-sm font-bold" style={{ color: meta.color }}>{meta.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">{s.tag}</div>
                    </div>
                    {on && <span className="ml-auto text-base" style={{ color: meta.color }}>✓</span>}
                  </div>
                  <p className="mt-2.5 text-[11.5px] leading-snug text-slate-400">{s.blurb}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Démarrer */}
        <div className="mt-auto">
          <button
            disabled={!spec}
            onClick={() => spec && completeOnboarding(spec)}
            className={
              'w-full rounded-2xl py-3.5 text-sm font-bold transition-colors ' +
              (spec ? 'bg-orange-500 text-slate-950 hover:bg-orange-400' : 'cursor-not-allowed bg-slate-800 text-slate-600')
            }
          >
            {spec ? `Commencer l’aventure en ${PRIMARY_META[spec].name}` : 'Choisis une spécialisation pour commencer'}
          </button>
        </div>
      </div>
    </div>
  )
}
