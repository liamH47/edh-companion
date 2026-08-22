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

    // Ob Nixilis is a plain card with both setup fields and a live one, so it exercises
    // the sheet-then-play-area flow without any card-specific branching.
    await page.getByRole('button', { name: 'Ob Nixilis, the Fallen' }).click()

    // Setup fields mean the board-state sheet auto-opens on first visit
    // (screen-spec.md rule 4). Confirm it, which is what a player does before playing.
    const sheet = page.getByRole('dialog', { name: 'Board state' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('spinbutton', { name: '+1/+1 counters already on him' }).fill('0')
    await sheet.getByRole('button', { name: 'Done' }).click()
    await expect(sheet).toBeHidden()

    // 4 lands x 3 counters each = 12 counters on a 3/3, so he swings as a 15/15.
    await page.getByRole('spinbutton', { name: 'Lands entered this turn' }).fill('4')

    await expect(page.getByText('15', { exact: true })).toBeVisible()
  })

  test('filters the card list by search', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Kalonian Hydra' })).toBeVisible()

    await page.getByRole('searchbox', { name: 'Search cards' }).fill('scute')

    await expect(page.getByRole('button', { name: 'Scute Swarm' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kalonian Hydra' })).toBeHidden()
  })

  test('the list URL survives a reload; the bare root still restores the last card', async ({
    page,
  }) => {
    await page.goto('/')
    // Opening a card from the picker records it as the most-recently-used card.
    await page.getByRole('button', { name: 'Kalonian Hydra' }).click()
    await expect(page).toHaveURL(/\/cards\/kalonian-hydra/)

    // Reloading the list URL stays on the list. This is the reported bug: the picker used
    // to share the bare root, so a refresh here reopened the recorded card.
    await page.goto('/cards')
    await expect(page.getByRole('searchbox', { name: 'Search cards' })).toBeVisible()

    // The bare root still opens the last-used card directly -- the cold-launch convenience
    // is kept, just no longer conflated with an explicit trip back to the list.
    await page.goto('/')
    await expect(page.getByRole('searchbox', { name: 'Search cards' })).toBeHidden()
  })

  test('rolls Comet for you and logs the face that came up', async ({ page }) => {
    await page.goto('/cards/comet-stellar-pup')

    // Comet has one setup field, so the board-state sheet opens on arrival.
    const sheet = page.getByRole('dialog', { name: 'Board state' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Done' }).click()
    await expect(sheet).toBeHidden()

    // One die, not six "which did you roll?" buttons.
    const rollButton = page.getByRole('button', { name: 'Roll the die' })
    await expect(rollButton).toBeVisible()
    await expect(page.getByRole('button', { name: '4', exact: true })).toBeHidden()

    await expect(page.getByText('Nothing yet.')).toBeVisible()

    await rollButton.click()

    // The face is decided up front but only revealed when the tumble ends, so the
    // log gains exactly one entry, whatever it landed on. Each entry reads as
    // "<face> · <what it does>" (e.g. "4 · damage"), not a bare digit.
    await expect(page.getByText('Nothing yet.')).toBeHidden()
    await expect(
      page.getByRole('listitem').filter({ hasText: /^[1-6] · [a-z]+$/ }),
    ).toHaveCount(1)

    // One activation a turn unless a 6 buys more, so the die is now either spent or
    // recharged -- never in between.
    const remaining = await page.getByText(/acts left/).textContent()
    expect(remaining).toBeTruthy()

    // The loyalty badge on the card art tracks the roll: 5 before, and every possible
    // face moves it (1-2 -> 7, 3 -> 4, 4-5 -> 3, 6 -> 6), so it can never still read 5
    // after one roll. The badge renders over the image when Scryfall is reachable and
    // as the standalone shield when not -- both carry the same live region.
    const shield = page.getByTestId('loyalty-shield')
    const liveLoyalty = shield.locator('[aria-live="polite"]')
    await expect(liveLoyalty).not.toHaveText('5')

    // New turn clears the rolls but the walker keeps its counters: the loyalty
    // carries over instead of snapping back to 5.
    const carried = await liveLoyalty.textContent()
    await page.getByRole('button', { name: 'New turn' }).click()
    await expect(page.getByText('Nothing yet.')).toBeVisible()
    await expect(liveLoyalty).toHaveText(carried ?? '')

    // Damage between activations: the manual adjustment moves the shield directly.
    await page.getByRole('button', { name: /Decrease Other loyalty/ }).click()
    await expect(liveLoyalty).toHaveText(String(Number(carried) - 1))
  })

  test('computes with the API unreachable', async ({ page }) => {
    // The point of moving compute into the bundle: the Cards tab used to need a
    // connection for both the card list and every keystroke. Swiss and Coin Flip
    // already survived an outage; now Cards does too.
    await page.route('**/api/**', (route) => route.abort())

    await page.goto('/cards/ob-nixilis-the-fallen')
    const sheet = page.getByRole('dialog', { name: 'Board state' })
    await sheet.getByRole('spinbutton', { name: '+1/+1 counters already on him' }).fill('0')
    await sheet.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('spinbutton', { name: 'Lands entered this turn' }).fill('4')

    // 3 base + 4 lands x 3 counters = 15, computed entirely in the browser.
    await expect(page.getByText('15', { exact: true })).toBeVisible()
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
