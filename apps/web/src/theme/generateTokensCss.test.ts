import { describe, expect, it } from 'vitest'
import { generateTokensCss } from './generateTokensCss'

// Whether the committed src/theme/tokens.css file matches this generator's output is
// checked by `npm run tokens:check` (see scripts/gen-tokens.mjs), not here: that
// comparison needs Node's fs/path/process, which src/ deliberately doesn't have types
// for (tsconfig.app.json scopes src to the browser; tsconfig.node.json is Node-only
// and covers just vite.config.ts) so app code can't accidentally depend on Node APIs.
describe('generateTokensCss', () => {
  it('emits light color variables inside an @theme block', () => {
    const css = generateTokensCss()
    expect(css).toContain('@theme {')
    expect(css).toContain('--color-surface: #fffdf7;')
    expect(css).toContain('--color-surface-raised: #f4e9d2;')
  })

  it('gives surface and surfaceRaised distinct values, in both themes -- identical values here is the bug that made every "raised" panel (Sheet, StatTile, Chip) have no visible lift in light mode', () => {
    const css = generateTokensCss()
    const lightBlock = css.slice(css.indexOf('@theme'), css.indexOf(':root {'))
    const darkBlock = css.slice(css.indexOf(':root.dark'))
    for (const block of [lightBlock, darkBlock]) {
      const surface = block.match(/--color-surface: (.+);/)?.[1]
      const surfaceRaised = block.match(/--color-surface-raised: (.+);/)?.[1]
      expect(surface).toBeTruthy()
      expect(surfaceRaised).not.toBe(surface)
    }
  })

  it('emits dark overrides scoped to :root.dark', () => {
    const css = generateTokensCss()
    const darkBlock = css.slice(css.indexOf(':root.dark'))
    expect(darkBlock).toContain('--color-surface: #221b13;')
  })

  it('emits the two font families into @theme, as Tailwind\'s reserved --font-* namespace', () => {
    const css = generateTokensCss()
    expect(css).toContain("--font-display: 'Fraunces'")
    expect(css).toContain("--font-body: 'Sora'")
  })

  it('emits radius tokens in px', () => {
    const css = generateTokensCss()
    expect(css).toContain('--radius-pill: 999px;')
  })

  it('does not declare a named spacing scale, which would shadow built-in Tailwind sizing utilities', () => {
    const css = generateTokensCss()
    // Match an actual declaration, not the explanatory comment above @theme that
    // necessarily mentions the variable prefix in prose.
    expect(css).not.toMatch(/^\s*--spacing-/m)
  })

  it('emits font-size tokens in rem, converted from a 16px root', () => {
    const css = generateTokensCss()
    expect(css).toContain('--text-title: 1.1250rem;')
  })
})
