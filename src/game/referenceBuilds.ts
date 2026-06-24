/**
 * CATALOGUE DE BUILDS DE RÉFÉRENCE — versionné dans le repo (≠ bibliothèque perso du joueur en
 * localStorage). Lu par l'écran « Simulateur » (bouton Catalogue), le banc d'essai `builds-bench.mjs`
 * et le générateur de leaderboard.
 *
 * VIDÉ VOLONTAIREMENT : aucun des anciens builds-placeholder n'était représentatif. Le classement, le
 * banc et le catalogue in-game se basent désormais UNIQUEMENT sur les builds réels soumis par la
 * communauté (`src/game/communityBuilds.json`, via l'ingestion GitHub). Pour réintroduire un baseline
 * d'équilibrage, ajouter ici des entrées PRESET reproductibles (pas de membres importés).
 */
import type { SimConfig } from './simulator'

export interface ReferenceBuild { name: string; desc: string; config: SimConfig }

export const REFERENCE_BUILDS: ReferenceBuild[] = []
