import { color, radius, typeScale } from './tokens.ts'

/** camelCase -> kebab-case, e.g. surfaceRaised -> surface-raised. */
function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function block(prefix: string, entries: [string, string | number][], unit = ''): string {
  return entries.map(([key, value]) => `  --${prefix}-${kebab(key)}: ${value}${unit};`).join('\n')
}

/**
 * Renders `tokens.ts` into the CSS `tokens.css` ships to Tailwind's `@theme`. Pure
 * string-building with no filesystem access, so both `scripts/gen-tokens.mjs` (writes
 * the file) and its test (checks the committed file matches) share one implementation.
 */
export function generateTokensCss(): string {
  const lightColors = block('color', Object.entries(color.light))
  const darkColors = block('color', Object.entries(color.dark))
  const radiusVars = block('radius', Object.entries(radius), 'px')
  const textVars = block(
    'text',
    Object.entries(typeScale).map(([key, value]) => [key, (value.size / 16).toFixed(4)]),
    'rem',
  )

  return `/* GENERATED FILE -- do not edit by hand. Run \`npm run tokens:build\`.
   Source of truth: src/theme/tokens.ts */

/* The spacing values from tokens.ts are deliberately NOT emitted as a named
   --spacing scale here: Tailwind v4's spacing scale backs far more than padding and
   gap utilities (width, height, max-width, min-width, inset, translate, and more),
   so a custom entry for e.g. "xl" silently shadows the built-in max-w-xl/w-xl/etc
   for every consumer of those utilities, not just the ones this design system
   intends to control. The spacing values (4, 8, 12, 16, 24, 32) are exact multiples
   of the default 4px unit, so components use the stock numeric scale directly
   (p-1, gap-2, px-4, gap-6, p-8, and so on) instead. */
@theme {
${lightColors}
${radiusVars}
${textVars}
}

/* Overrides the same --color-* variables the utilities above reference, so every
   Tailwind class generated from them (bg-surface, text-text-muted, ...) repaints for
   dark mode without a single hand-written dark: variant. .dark is toggled on <html>
   by src/core/theme.ts. */
:root.dark {
${darkColors}
}
`
}
