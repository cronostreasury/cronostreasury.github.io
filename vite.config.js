import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        cronos: `${root}cronos/index.html`,
        cronosProtocols: `${root}cronos/protocols/index.html`,
        cronosProtocol: `${root}cronos/protocol/index.html`,
        cronosTokens: `${root}cronos/tokens/index.html`,
        cronosYields: `${root}cronos/yields/index.html`,
        cronosAnalytics: `${root}cronos/analytics/index.html`,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
})
