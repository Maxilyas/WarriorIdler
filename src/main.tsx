import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { bootGame } from './game/store'

// Palier 2 — BOOT ASYNCHRONE : lance la lecture du stockage durable (IndexedDB / repli localStorage)
// avant le rendu. App montre l'écran de chargement tant que `booted` est faux, puis s'hydrate.
void bootGame()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
