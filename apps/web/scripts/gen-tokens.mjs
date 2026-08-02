#!/usr/bin/env node
// Writes/checks src/theme/tokens.css, generated from src/theme/tokens.ts via
// src/theme/generateTokensCss.ts (the single source of truth for the design system).
// `npm run tokens:build` writes the file; `npm run tokens:check` (--check) fails if the
// committed file is stale, so a tokens.ts edit can't silently skip regeneration.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generateTokensCss } from '../src/theme/generateTokensCss.ts'

const OUT_PATH = fileURLToPath(new URL('../src/theme/tokens.css', import.meta.url))
const css = generateTokensCss()
const isCheck = process.argv.includes('--check')

if (isCheck) {
  let existing = ''
  try {
    existing = readFileSync(OUT_PATH, 'utf8')
  } catch {
    existing = ''
  }
  if (existing !== css) {
    console.error('tokens.css is out of date -- run `npm run tokens:build`.')
    process.exit(1)
  }
  console.log('tokens.css is up to date.')
} else {
  writeFileSync(OUT_PATH, css)
  console.log(`Wrote ${OUT_PATH}`)
}
