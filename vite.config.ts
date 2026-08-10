import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.resolve(rootDir, 'app'),
  plugins: [react(), tailwindcss()],
  base: '/vyaya.vg/',
  resolve: {
    alias: { '@': path.resolve(rootDir, 'app/src') },
  },
  publicDir: path.resolve(rootDir, 'public'),
  build: {
    outDir: path.resolve(rootDir, 'dist'),
    emptyOutDir: true,
  },
  server: {
    // so /vyaya.vg paths aren't required in local if we open /
  },
})
