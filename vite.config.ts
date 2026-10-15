import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Repository Pages site: https://<github-username>.github.io/forfire/
// Hash routes keep refreshes on the static host from requesting missing files.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/forfire/',
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
