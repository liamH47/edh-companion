/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "Commander's Companion",
        short_name: 'MTG Companion',
        description:
          'Dice, coin flips, pairings, and per-card calculators for casual Commander games -- works fully offline once installed.',
        // Matches the app icon's own background (docs/design/visual-identity.md) --
        // one static value regardless of the in-app light/dark toggle, so the install
        // splash and the OS chrome around the app agree with the icon rather than the
        // canvas color of whichever theme happens to be active at install time.
        theme_color: '#17130e',
        background_color: '#17130e',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell (JS/CSS/HTML/fonts) so a cold launch with zero signal
        // still loads the UI -- the actual fix for "offline only helps a tab that was
        // already open" (docs/mobile-port-roadmap.md, Phase 6.5).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
        runtimeCaching: [
          {
            // Card art is immutable per print -- a given scryfall_id never changes its
            // image -- so caching it indefinitely is safe, and it upgrades CardImage's
            // offline fallback (a text note) into the real art for anything already
            // seen. Matches api.scryfall.com (cardImage.ts's IMAGE_ENDPOINT), which
            // 302s to Scryfall's CDN; Workbox follows the redirect and caches the
            // final response under this key.
            urlPattern: /^https:\/\/api\.scryfall\.com\/cards\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'scryfall-card-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
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
