/**
 * Types partagés par les SLICES d'actions du store (découpage des ~120 actions Zustand par domaine).
 * `set`/`get` sont typés sur l'état COMPLET (`GameState`) : un slice voit donc tout l'état et peut
 * appeler n'importe quelle action via `get().xxx()`. Les slices importent ce module ; ils n'importent
 * du store que des TYPES (`import type`, érasés) → pas de cycle runtime.
 */
import type { StoreApi } from 'zustand'
import type { GameState } from './store'

export type GameSet = StoreApi<GameState>['setState']
export type GameGet = StoreApi<GameState>['getState']
