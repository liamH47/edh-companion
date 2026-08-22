import { expect, test } from '@playwright/test'

/**
 * The mana pool end-to-end: the standalone tracker, and the landfall integration where
 * a card says "add one mana of any color" and the app knows the amount but not the
 * colors.
 */
test.describe('mana pool', () => {
  test('tracks floating mana by color, and separates colorless from colored', async ({ page }) => {
    await page.goto('/cards/mana-pool')

    await page.getByRole('button', { name: 'Add green mana' }).click()
    await page.getByRole('button', { name: 'Add green mana' }).click()
    await page.getByRole('button', { name: 'Add blue mana' }).click()
    await page.getByRole('button', { name: 'Add colorless mana' }).click()

    // The hero is the total; the tiles are the split that decides what's castable.
    const colored = page.getByText('colored', { exact: true }).locator('..')
    await expect(colored).toContainText('3')
    const colorless = page.getByText('colorless', { exact: true }).locator('..')
    await expect(colorless).toContainText('1')
    // Two green is two mana but one color.
    const colors = page.getByText('colors', { exact: true }).locator('..')
    await expect(colors).toContainText('2')

    // Spending takes one, not the whole color.
    await page.getByRole('button', { name: 'Spend green mana' }).click()
    await expect(colored).toContainText('2')

    // A phase change empties the pool by rule, so that is a first-class button.
    await page.getByRole('button', { name: 'Empty the pool' }).click()
    await expect(colored).toContainText('0')
  })

  test('landfall carries a pool for the mana its triggers make', async ({ page }) => {
    await page.goto('/cards/landfall')

    await page.getByLabel('Search landfall cards').fill('cobra')
    await page.getByRole('button', { name: 'Add Lotus Cobra' }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    // Two land drops: the effect line says how much mana was made...
    const land = page.getByRole('button', { name: 'Land enters', exact: true })
    await land.click()
    await land.click()
    await expect(page.getByText('2 mana', { exact: true })).toBeVisible()

    // ...and the pool is where it goes, once you have picked the colours.
    await page.getByRole('button', { name: 'Add green mana' }).click()
    await page.getByRole('button', { name: 'Add blue mana' }).click()
    await expect(page.getByRole('button', { name: 'Spend green mana' })).toBeEnabled()

    // The pool survives a reload with the rest of the board state.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Spend blue mana' })).toBeEnabled()
  })
})
