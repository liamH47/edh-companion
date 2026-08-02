/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Point at core's source directly rather than through the node_modules symlink.
    // Without this, `@mtg/core/api` and core's own internal `./api` resolve to two
    // different paths for the same file -- so a test that mocks one does not
    // intercept the call the other makes, and the real fetch runs in jsdom.
    alias: [
      {
        find: /^@mtg\/core$/,
        replacement: fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      },
      {
        find: /^@mtg\/core\/(.*)$/,
        replacement: fileURLToPath(new URL('../../packages/core/src/$1', import.meta.url)),
      },
    ],
    // A workspace can end up with its own nested copy of React, and two copies means
    // hooks called from @mtg/core read a different dispatcher than the one the app
    // rendered with -- which surfaces as "cannot read properties of null (useState)"
    // rather than anything that names the real cause.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8001',
      '/healthz': 'http://127.0.0.1:8001',
      '/readyz': 'http://127.0.0.1:8001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
      // Without an explicit `include`, v8 only instruments files some test happened to
      // import -- so a source file nothing imports contributes nothing and the run still
      // reports 100%. Listing src/** makes the threshold mean what it says: a new
      // module with no test fails the build instead of passing invisibly.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/setup.ts',
        // Registers the platform seams at startup. Every branch is a one-line handoff
        // to a browser API, so a test here would assert that the assignment happened
        // rather than that anything works -- the seams themselves are tested in core.
        'src/platform.ts',
        '**/*.test.{ts,tsx}',
      ],
    },
  },
})
