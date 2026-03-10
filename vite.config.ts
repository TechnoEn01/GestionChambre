import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base relative pour:
  // - un hébergement GitHub Pages sur /docs de la branche principale
  // - une intégration en iframe comme custom widget Grist
  base: './',
  build: {
    // Permet de configurer GitHub Pages en servant le dossier /docs depuis la branche principale.
    outDir: 'docs',
  },
})
