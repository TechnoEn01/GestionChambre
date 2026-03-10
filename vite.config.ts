import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function getGitCommit(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    const status = execSync('git status --porcelain').toString().trim()
    const dirty = status ? '-dirty' : ''
    return `${hash}${dirty}`
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __GIT_VERSION__: JSON.stringify(getGitCommit()),
  },
  build: {
    outDir: 'docs',
  },
})
