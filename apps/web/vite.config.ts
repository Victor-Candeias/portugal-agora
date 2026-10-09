import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/portugal-agora/' : '/',
  // OPEN_CHARGE_MAP_KEY (WEB-040) tem o mesmo nome no web, no mobile e no secret do GitHub.
  envPrefix: ['VITE_', 'OPEN_CHARGE_MAP_'],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@portugal-hoje/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api/comboios': {
        target: 'https://comboios.live',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/comboios/, ''),
      },
      '/api/carris': {
        target: 'https://gateway.carris.pt/gateway/gtfs/api/v2.11',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/carris/, ''),
      },
    },
  },
})
