import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/src-tauri/target/**', '**/artifacts/**'],
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    setupFiles: './src/test/setup.ts',
  },
})
