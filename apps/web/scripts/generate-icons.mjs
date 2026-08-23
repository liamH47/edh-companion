#!/usr/bin/env node
// One-time asset generation, run by hand (not part of the build or CI, same status as
// the hand-authored public/favicon.svg): rasterizes the app icon mark into the PNG
// sizes manifest.webmanifest and iOS's apple-touch-icon need. Rerun after a deliberate
// icon redesign; there's nothing here to drift out of sync with, so there's no --check.
//
// Rasterized with the Playwright Chromium already installed for e2e (no new
// dependency): render the SVG in a real browser at the exact target pixel size and
// screenshot it, rather than reaching for an SVG-to-PNG library.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const OUT_DIR = fileURLToPath(new URL('../public/icons', import.meta.url))
mkdirSync(OUT_DIR, { recursive: true })

// The mark: a gold card on dark ink, a cream inner face suggesting a ledger page, three
// gold rules across it suggesting written lines. Full-bleed background (required for a
// maskable icon) with the card comfortably inside the ~80%-diameter safe zone, so the
// same source serves both "any" and "maskable" purposes without a second layout.
const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#17130e" />
  <rect x="146" y="103" width="220" height="306" rx="22" fill="#dba054" />
  <rect x="174" y="131" width="164" height="250" rx="10" fill="#f3ead9" />
  <rect x="198" y="196" width="116" height="14" rx="7" fill="#dba054" />
  <rect x="198" y="242" width="116" height="14" rx="7" fill="#dba054" />
  <rect x="198" y="288" width="80" height="14" rx="7" fill="#dba054" />
</svg>
`.trim()

// [file name, pixel size, whether to omit the ink-colored corners (apple-touch-icon:
// iOS applies its own rounding, so it wants a plain full-bleed square, which this mark
// already is -- no separate variant needed).
const TARGETS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-512-maskable.png', 512],
  ['apple-touch-icon.png', 180],
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size] of TARGETS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${ICON_SVG.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  const png = await page.screenshot({ omitBackground: false })
  writeFileSync(`${OUT_DIR}/${name}`, png)
  console.log(`Wrote ${OUT_DIR}/${name}`)
}
await browser.close()
