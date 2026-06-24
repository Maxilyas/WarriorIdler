/**
 * CATALOGUE DE BUILDS DE RÉFÉRENCE — versionné dans le repo (≠ bibliothèque perso du joueur en
 * localStorage). Sert à DEUX usages :
 *  - chargeable dans l'écran « Simulateur » (bouton Catalogue) ;
 *  - lu par le banc d'essai headless `scripts/builds-bench.mjs` → comparaison d'équilibrage entre
 *    builds, dans les MÊMES conditions (mêmes SimConfig, vrai moteur via `runSim`).
 *
 * Ajouter un build de test = ajouter une entrée ici. Garder des configs PRESET (reproductibles),
 * pas de membres importés (qui dépendent d'une sauvegarde).
 */
import { defaultConfig, initGear, statLines, type SimConfig } from './simulator'

const base = (): SimConfig => defaultConfig(300)

/** Stuff complet orienté DoT : Altération + Maîtrise + Critique sur chaque pièce. */
function dotGear() {
  const g = initGear('equilibre')
  for (const k in g) g[k] = { ...g[k], lines: statLines(['alteration', 'maitrise', 'critique']) }
  return g
}
/** Stuff complet ultra-défensif : Réduction + Barrière + une ligne de résistance physique. */
function tankGear() {
  const g = initGear('defensif')
  for (const k in g) g[k] = { ...g[k], lines: [{ k: 'stat', id: 'reductionDegats' }, { k: 'stat', id: 'barriere' }, { k: 'resist', id: 'physique' }] }
  return g
}

export interface ReferenceBuild { name: string; desc: string; config: SimConfig }

export const REFERENCE_BUILDS: ReferenceBuild[] = [
  {
    name: 'Guerrier offensif', desc: 'FOR mêlée, full dégâts',
    config: { ...base(), team: [{ name: 'Guerrier', cls: 'guerrier', level: 75, orientation: 'offensif', gems: ['overkill', 'tambour', 'hemorragie'], runes: ['premierElan', 'hateFunebre'] }] },
  },
  {
    name: 'Guerrier tank', desc: 'FOR défensif, stuff tank par pièce',
    config: { ...base(), team: [{ name: 'Gardien', cls: 'guerrier', level: 75, orientation: 'defensif', gems: ['sixieme', 'tresorerie', 'souffle'], runes: ['sursis', 'boucle'], gear: tankGear() }] },
  },
  {
    name: 'Mage burst', desc: 'INT sorts, full offensif',
    config: { ...base(), team: [{ name: 'Mage', cls: 'mage', level: 75, orientation: 'offensif', gems: ['overkill', 'detonation'], runes: ['premierElan'] }] },
  },
  {
    name: 'Mage DoT (altération)', desc: 'INT, stuff Altération par pièce',
    config: { ...base(), team: [{ name: 'Mage DoT', cls: 'mage', level: 75, orientation: 'equilibre', gems: ['hemorragie', 'sixieme'], runes: ['premierElan'], gear: dotGear() }] },
  },
  {
    name: 'Voleur équilibré', desc: 'AGI, mix off/déf',
    config: { ...base(), team: [{ name: 'Voleur', cls: 'voleur', level: 75, orientation: 'equilibre', gems: ['overkill', 'sixieme'], runes: ['premierElan', 'sursis'] }] },
  },
  {
    name: 'Chasseur familier', desc: 'AGI, voie Meute (pet)',
    config: { ...base(), team: [{ name: 'Chasseur', cls: 'chasseur', level: 75, orientation: 'equilibre', gems: ['overkill', 'tresorerie'], runes: ['premierElan'] }] },
  },
  {
    name: 'Duo DPS + tank', desc: 'Mage burst + Guerrier tank (équipe)',
    config: {
      ...base(),
      team: [
        { name: 'Mage', cls: 'mage', level: 75, orientation: 'offensif', gems: ['overkill', 'detonation'], runes: ['premierElan'] },
        { name: 'Gardien', cls: 'guerrier', level: 75, orientation: 'defensif', gems: ['sixieme', 'tresorerie', 'souffle'], runes: ['sursis'], gear: tankGear() },
      ],
    },
  },
]
