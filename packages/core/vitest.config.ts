import { defineConfig } from 'vitest/config'

/**
 * Node environment by default -- almost everything here is pure. The few files that
 * are React hooks opt into jsdom with a `@vitest-environment jsdom` docblock, rather
 * than the whole package paying for a DOM it does not use.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    clearMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
      // See the note in apps/web: without an explicit include, v8 only instruments
      // files a test happened to import, so an untested module passes invisibly.
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/setup.ts',
        'src/index.ts',
        'src/swiss/index.ts',
        // Type-only modules compile to nothing, so v8 reports 0% rather than 100%.
        'src/types.ts',
        'src/swiss/types.ts',
        '**/*.test.ts',
      ],
    },
  },
})
