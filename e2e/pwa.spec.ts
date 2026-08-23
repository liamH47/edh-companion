import { expect, test } from '@playwright/test'

/**
 * Installability, and the offline cold-launch fix it exists for. Two failure modes
 * that only show up in the *packaged* app, the same reason deep-link.spec.ts exists:
 * `vite-plugin-pwa` writing its output somewhere the Dockerfile's COPY misses, and the
 * manifest/service worker being unreachable behind the SPA catch-all in
 * backend/app/frontend.py despite the page itself loading fine.
 */
test.describe('PWA installability', () => {
  test('links a fetchable manifest naming the app and its icon set', async ({ page, request }) => {
    await page.goto('/')

    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBeTruthy()

    const manifestResponse = await request.get(href!)
    expect(manifestResponse.ok()).toBeTruthy()
    expect(manifestResponse.headers()['content-type']).toContain('manifest+json')

    const manifest = await manifestResponse.json()
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]),
    )

    // Every icon the manifest points at actually resolves -- a manifest citing a path
    // the Dockerfile never copied is exactly the silent-404 failure mode this suite
    // is for.
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src)
      expect(iconResponse.ok()).toBeTruthy()
    }
  })

  test('links an apple-touch-icon, which iOS reads instead of the manifest', async ({
    page,
    request,
  }) => {
    await page.goto('/')

    const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect(href).toBeTruthy()

    const response = await request.get(href!)
    expect(response.ok()).toBeTruthy()
  })

  test('registers a service worker that takes control of the page', async ({ page }) => {
    await page.goto('/')

    const controlled = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active !== null
    })
    expect(controlled).toBe(true)
  })

  test('serves the app shell from cache when the network is unreachable on a fresh load', async ({
    page,
    context,
  }) => {
    // The whole point of precaching: a cold launch with zero signal still loads the UI,
    // not just an already-open tab (the gap noted in docs/mobile-port-roadmap.md).
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByRole('searchbox', { name: 'Search cards' })).toBeVisible()
    await context.setOffline(false)
  })
})
