import { expect, test } from '@playwright/test'

/**
 * The coin flip is random, so nothing here asserts *which* side came up -- only that a
 * flip resolves into a result. The flip animation runs for 900ms before the result
 * lands, which is the one place in this app where a test has to wait on a timer rather
 * than a network round trip. The screen is plain by default; the Krark/Okaun/Zndrsplt
 * experience is behind the commander toggle.
 */
test.describe('Coin flip', () => {
  test('plain mode resolves a flip into a bare result', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Coin Flip' }).click()

    // Minimal by default: no tally, no Okaun, no call buttons.
    await expect(page.getByText('Wins')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Call Heads' })).toBeHidden()

    await page.getByRole('button', { name: 'Flip', exact: true }).click()
    await expect(page.getByText(/^(Heads|Tails)!$/)).toBeVisible()
  })

  test('commander mode resolves a call and updates the counters', async ({ page }) => {
    await page.goto('/coin-flip')
    await page.getByRole('button', { name: 'Commander' }).click()

    await expect(page.getByText('Wins')).toBeVisible()
    await expect(page.getByText("Okaun's power/toughness")).toBeVisible()

    await page.getByRole('button', { name: 'Call Heads' }).click()

    // Either outcome is valid; what matters is that one of them arrives.
    await expect(page.getByText(/^(Heads|Tails)!$/)).toBeVisible()
    await expect(page.getByText(/Called heads — (Win!|Loss)/)).toBeVisible()

    const total = page.locator('div', { hasText: /^Total$/ })
    await expect(total).toBeVisible()
  })

  test('commander mode doubles Okaun on a win and resets on a new turn', async ({ page }) => {
    await page.goto('/coin-flip')
    await page.getByRole('button', { name: 'Commander' }).click()

    // Okaun is a 3/3 before any flips are won.
    await expect(page.getByText('3/3')).toBeVisible()

    // Keep calling until a win lands -- each win doubles power, so the first win takes
    // Okaun to 6/6. Bounded so a pathological streak fails loudly, not forever.
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.getByRole('button', { name: 'Call Heads' }).click()
      await expect(page.getByText(/^(Heads|Tails)!$/)).toBeVisible()
      if (await page.getByText('6/6').isVisible()) break
    }
    await expect(page.getByText('6/6')).toBeVisible()

    await page.getByRole('button', { name: 'New Turn' }).click()
    await expect(page.getByText('3/3')).toBeVisible()
  })
})
