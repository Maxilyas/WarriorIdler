import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/WarriorIdler/',
  // Le harnais de preview assigne un port via $PORT (autoPort) — Vite ne le lit pas seul.
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    rollupOptions: {
      output: {
        // v0.40.5 (perf, lot 8) — on isole react/react-dom dans leur PROPRE chunk (vendor stable,
        // mis en cache longtemps par le navigateur, jamais réinvalidé par une livraison de code app).
        // Le reste (CombatPanel, modales, WelcomeScreen, ui) part dans le bundle d'entrée ; les
        // panneaux non-combat sont déjà splittés par React.lazy (cf. App.tsx).
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Warrior Idler',
        short_name: 'WarriorIdler',
        description: 'Un idler textuel centré sur le stuff, inspiré de WoW.',
        theme_color: '#0b0e14',
        background_color: '#0b0e14',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
