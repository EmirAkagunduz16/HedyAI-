#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

console.log('🔍 Hedy AI Health Check\n')

const checks = [
  {
    name: 'Frontend package.json',
    check: () => fs.existsSync(path.join(projectRoot, 'package.json')),
    message: 'Frontend package.json exists'
  },
  {
    name: 'Backend package.json',
    check: () => fs.existsSync(path.join(projectRoot, 'backend', 'package.json')),
    message: 'Backend package.json exists'
  },
  {
    name: 'Frontend .env-sample',
    check: () => fs.existsSync(path.join(projectRoot, '.env-sample')),
    message: 'Frontend environment template exists'
  },
  {
    name: 'Backend env.example',
    check: () => fs.existsSync(path.join(projectRoot, 'backend', 'env.example')),
    message: 'Backend environment template exists'
  },
  {
    name: 'Frontend .env',
    check: () => fs.existsSync(path.join(projectRoot, '.env')),
    message: 'Frontend environment file exists',
    warning: 'Please create .env file from .env-sample'
  },
  {
    name: 'Backend .env',
    check: () => fs.existsSync(path.join(projectRoot, 'backend', '.env')),
    message: 'Backend environment file exists',
    warning: 'Please create backend/.env file from backend/env.example'
  },
  {
    name: 'Frontend src directory',
    check: () => fs.existsSync(path.join(projectRoot, 'src')),
    message: 'Frontend source directory exists'
  },
  {
    name: 'Backend routes',
    check: () => fs.existsSync(path.join(projectRoot, 'backend', 'routes')),
    message: 'Backend routes directory exists'
  },
  {
    name: 'Backend models',
    check: () => fs.existsSync(path.join(projectRoot, 'backend', 'models')),
    message: 'Backend models directory exists'
  },
  {
    name: 'Services directory',
    check: () => fs.existsSync(path.join(projectRoot, 'src', 'services')),
    message: 'Frontend services directory exists'
  }
]

let passed = 0
let warnings = []

checks.forEach(({ name, check, message, warning }) => {
  if (check()) {
    console.log(`✅ ${message}`)
    passed++
  } else {
    console.log(`❌ ${name} - FAILED`)
    if (warning) {
      warnings.push(warning)
    }
  }
})

console.log(`\n📊 Health Check Results: ${passed}/${checks.length} checks passed`)

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:')
  warnings.forEach(warning => console.log(`   - ${warning}`))
}

if (passed === checks.length) {
  console.log('\n🎉 All checks passed! Your Hedy AI application is ready to go.')
  console.log('\n🚀 Quick Start:')
  console.log('   1. Edit .env files with your API keys')
  console.log('   2. Start MongoDB')
  console.log('   3. Run: npm run start:dev')
} else {
  console.log('\n❌ Some checks failed. Please review the setup instructions in README.md')
}

console.log('\n📚 For detailed setup instructions, see README.md')
process.exit(passed === checks.length ? 0 : 1)
