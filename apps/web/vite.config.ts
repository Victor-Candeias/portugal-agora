import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/portugal-agora/' : '/',
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
    },
  },
})
