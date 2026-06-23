import { defineConfig } from 'vitest/config'

// Config de test ISOLÉE (pas de plugin PWA/React) : on ne teste que la logique de jeu pure
// (modules `src/game/*.ts`), en environnement Node. Voir `test/` pour les suites.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
})
