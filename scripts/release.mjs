#!/usr/bin/env node
/**
 * Release helper script.
 * Usage:
 *   node scripts/release.mjs patch   → v0.1.0 → v0.1.1
 *   node scripts/release.mjs minor   → v0.1.0 → v0.2.0
 *   node scripts/release.mjs major   → v0.1.0 → v1.0.0
 *
 * What it does:
 *   1. Bumps version in package.json
 *   2. Creates a git commit with the version bump
 *   3. Creates a git tag
 *   4. Pushes commit + tag to remote
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const BUMP_TYPE = process.argv[2] || 'patch'

if (!['patch', 'minor', 'major'].includes(BUMP_TYPE)) {
  console.error('Usage: node scripts/release.mjs [patch|minor|major]')
  process.exit(1)
}

// Read current version
const pkgPath = resolve(process.cwd(), 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)

// Calculate new version
let newVersion
switch (BUMP_TYPE) {
  case 'major':
    newVersion = `${major + 1}.0.0`
    break
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`
    break
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`
    break
}

// Update package.json
pkg.version = newVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const tag = `v${newVersion}`

console.log(`\n📦 Bumping version: ${pkg.version.replace(newVersion, `${major}.${minor}.${patch}`)} → ${newVersion}`)
console.log(`🏷️  Tag: ${tag}\n`)

try {
  execSync(`git add package.json`, { stdio: 'inherit' })
  execSync(`git commit -m "release: ${tag}"`, { stdio: 'inherit' })
  execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'inherit' })
  console.log(`\n✅ Release ${tag} created locally.`)
  console.log(`\n📤 To publish: git push && git push --tags`)
} catch (e) {
  console.error('❌ Error creating release:', e.message)
  process.exit(1)
}
