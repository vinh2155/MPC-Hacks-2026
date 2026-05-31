import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host : true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        proxyTimeout: 300_000,  // 5 min — compliance scan can take 2+ min
        timeout: 300_000,
      },
    },
  },
})
