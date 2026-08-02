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
    expect(css).toContain('--color-surface: #ffffff;')
    expect(css).toContain('--color-surface-raised: #ffffff;')
  })

  it('emits dark overrides scoped to :root.dark', () => {
    const css = generateTokensCss()
    const darkBlock = css.slice(css.indexOf(':root.dark'))
    expect(darkBlock).toContain('--color-surface: #151d2e;')
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
