import { cpSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
if (!existsSync(dist)) {
  console.error('dist/ missing — run vite build first')
  process.exit(1)
}

// Wipe previous published assets folder at repo root
if (existsSync('assets')) rmSync('assets', { recursive: true, force: true })

// Copy built assets + index to repo root (legacy GitHub Pages serves main:/)
cpSync(join(dist, 'assets'), 'assets', { recursive: true })
cpSync(join(dist, 'index.html'), 'index.html')

// Copy any other dist root files except assets
for (const name of readdirSync(dist)) {
  if (name === 'assets' || name === 'index.html') continue
  cpSync(join(dist, name), name, { recursive: true })
}

// GitHub Pages: skip Jekyll processing of underscored files
writeFileSync('.nojekyll', '')

console.log('Published dist → repo root for GitHub Pages (branch main, path /)')
