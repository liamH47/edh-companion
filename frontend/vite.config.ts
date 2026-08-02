/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        // Type-only modules compile to nothing, so v8 sees zero statements and reports
        // 0% rather than 100%.
        'src/types.ts',
        'src/core/swiss/types.ts',
        '**/*.test.{ts,tsx}',
      ],
    },
  },
})
