import { expect, test } from '@playwright/test'

/**
 * The storm roster end-to-end: hold two payoffs, raise the count, and read both
 * answers at once. Comparing payoffs at a single count is what the category adds over
 * the four single-card storm screens.
 */
test.describe('storm', () => {
  test('compares two payoffs at one count, and counts copies plus the original', async ({
    page,
  }) => {
    await page.goto('/cards/storm')

    const sheet = page.getByRole('dialog', { name: 'Board state' })
    await expect(sheet).toBeVisible()

    const search = page.getByLabel('Search storm cards')
    for (const [term, name] of [
      ['grapeshot', 'Grapeshot'],
      ['tendrils', 'Tendrils of Agony'],
    ]) {
      await search.fill(term)
      await page.getByRole('button', { name: `Add ${name}` }).click()
    }
    await page.getByRole('button', { name: 'Done' }).click()

    // Storm 0 still resolves once -- there is no "nothing yet" state for a spell.
    await expect(page.getByText('1 damage', { exact: true })).toBeVisible()

    // Nine spells before it: nine copies plus the original is ten resolutions.
    const spellCast = page.getByRole('button', { name: 'Spell cast', exact: true })
    for (let index = 0; index < 9; index += 1) await spellCast.click()

    await expect(page.getByText('10 damage', { exact: true })).toBeVisible()
    // Tendrils drains 2 a resolution and gains it back, so both halves show.
    await expect(page.getByText('20 life · 20 life lost')).toBeVisible()

    // A payoff with no countable effect would say how many times instead; the two
    // above both have numbers, so check the shared storm math tile.
    const resolutionsTile = page.getByText('resolutions', { exact: true }).locator('..')
    await expect(resolutionsTile).toContainText('10')

    // "New turn" clears the count but keeps the hand: your payoffs are still there.
    await page.getByRole('button', { name: 'New turn' }).click()
    await expect(page.getByText('1 damage', { exact: true })).toBeVisible()
    await expect(page.getByText('Target player loses 2 life, you gain 2')).toBeVisible()
  })
})
