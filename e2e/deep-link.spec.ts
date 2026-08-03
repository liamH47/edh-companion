import { expect, test } from '@playwright/test'

/**
 * The SPA catch-all in backend/app/frontend.py. This is the one behaviour that only
 * exists in the *packaged* app: in dev, Vite serves the frontend and handles unknown
 * paths itself, so nothing outside a container run ever exercises `serve_frontend`.
 *
 * It is also the most likely thing to break silently during the monorepo restructure,
 * because it depends on the Dockerfile copying the build output to exactly the path
 * `mount_frontend` looks in. A wrong COPY produces a healthy container serving 404s.
 */
test.describe('Deep links and static serving', () => {
  test('serves the app at a client-side route on a cold load', async ({ page }) => {
    // Not navigated to -- typed in, the way a shared link arrives.
    await page.goto('/cards/blood-artist')

    await expect(page.getByRole('heading', { name: 'Blood Artist' })).toBeVisible()
    expect(page.url()).toContain('/cards/blood-artist')
  })

  test('serves the app at the pairings route on a cold load', async ({ page }) => {
    await page.goto('/swiss')

    // The Pairings tab opens on its chooser (casual pods vs Swiss); seeing it proves
    // the route served the app rather than a 404.
    await expect(page.getByRole('heading', { name: 'Pairings' })).toBeVisible()
  })

  test('falls back to the picker for an unknown card id', async ({ page }) => {
    // A stale link to a card that no longer exists should land somewhere usable
    // rather than on a blank screen.
    await page.goto('/cards/not-a-real-card')

    await expect(page.getByRole('searchbox', { name: 'Search cards' })).toBeVisible()
  })

  test('serves hashed assets rather than index.html', async ({ page, request }) => {
    // The catch-all returns index.html for anything it cannot find on disk, so a
    // missing assets mount fails as "JS bundle is actually HTML" -- a blank page with
    // a confusing console error. Assert the content type directly.
    await page.goto('/')

    const scriptSrc = await page.locator('script[type="module"]').first().getAttribute('src')
    expect(scriptSrc).toBeTruthy()

    const asset = await request.get(scriptSrc!)
    expect(asset.ok()).toBeTruthy()
    expect(asset.headers()['content-type']).toContain('javascript')
  })

  test('keeps API routes from being shadowed by the catch-all', async ({ request }) => {
    // mount_frontend registers `/{full_path:path}` last precisely so it cannot
    // shadow /api or the health probes. Route registration order is easy to disturb.
    const health = await request.get('/healthz')
    expect(health.ok()).toBeTruthy()
    expect(await health.json()).toEqual({ status: 'ok' })

    const cards = await request.get('/api/cards')
    expect(cards.ok()).toBeTruthy()
    expect(cards.headers()['content-type']).toContain('application/json')
  })
})
