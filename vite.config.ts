import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: mode === 'production' ? '/vyaya.vg/' : '/',
  resolve: {
    alias: { '@': path.resolve(rootDir, './src') },
  },
  build: {
    outDir: 'dist',
  },
}))
