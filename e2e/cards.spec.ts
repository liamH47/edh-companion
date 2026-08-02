import { expect, test } from '@playwright/test'

/**
 * The card flow, end to end through the real API. Unit tests cover the arithmetic far
 * more thoroughly than this ever should -- what only an E2E run proves is that the
 * built bundle, the FastAPI card routes, and the POST /calculate round trip are all
 * wired together in the shipped artifact.
 *
 * Queries are by role and accessible name, matching the Vitest suites, so these break
 * when the app becomes unusable rather than when markup gets reshuffled.
 */
test.describe('Cards', () => {
  test('computes a card result from user input', async ({ page }) => {
    await page.goto('/')

    // Blood Artist is the simplest card with both a setup field and a live field, so
    // it exercises the sheet-then-play-area flow without any card-specific branching.
    await page.getByRole('button', { name: 'Blood Artist' }).click()

    // One setup field means the board-state sheet auto-opens on first visit
    // (screen-spec.md rule 4). Confirm it, which is what a player does before playing.
    const sheet = page.getByRole('dialog', { name: 'Board state' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('spinbutton', { name: 'Blood-Artist-style triggers you control' }).fill('3')
    await sheet.getByRole('button', { name: 'Done' }).click()
    await expect(sheet).toBeHidden()

    // 4 creatures died x 3 drain triggers = 12 life.
    await page
      .getByRole('spinbutton', { name: 'Creatures that died this event' })
      .fill('4')

    await expect(page.getByText('12', { exact: true })).toBeVisible()
  })

  test('filters the card list by search', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Blood Artist' })).toBeVisible()

    await page.getByRole('searchbox', { name: 'Search cards' }).fill('scute')

    await expect(page.getByRole('button', { name: 'Scute Swarm' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Blood Artist' })).toBeHidden()
  })

  test('serves every card the API advertises', async ({ page, request }) => {
    // Guards the registry against the frontend: a card registered in Python but
    // unreachable in the shipped bundle is exactly the kind of packaging mismatch
    // unit tests on either side cannot see.
    const response = await request.get('/api/cards')
    expect(response.ok()).toBeTruthy()
    const cards = (await response.json()) as { id: string; name: string }[]
    expect(cards.length).toBeGreaterThan(0)

    await page.goto('/')
    for (const card of cards) {
      await expect(page.getByRole('button', { name: card.name })).toBeVisible()
    }
  })
})
