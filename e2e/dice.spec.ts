import { expect, test } from '@playwright/test'

/**
 * The dice roll is random, so nothing here asserts a particular face -- only that a roll
 * resolves into an announced result, and that 2d6 shows a visible sum. Like the coin, the
 * tumble runs on a 900ms timer before the result lands.
 */
test.describe('Dice', () => {
  test('rolls a d6 from the tab', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Dice' }).click()

    await expect(page.getByRole('radiogroup', { name: 'Dice' })).toBeVisible()
    await page.getByRole('button', { name: 'Roll' }).click()
    await expect(page.getByText(/^Rolled [1-6]$/)).toBeVisible()
  })

  test('rolls 2d6 and shows a visible sum', async ({ page }) => {
    await page.goto('/dice')
    await page.getByRole('radio', { name: '2d6' }).click()

    await page.getByRole('button', { name: 'Roll' }).click()

    // Two dice, one combined result: "Rolled a and b — sum s".
    await expect(page.getByText(/^Rolled [1-6] and [1-6] — sum \d+$/)).toBeVisible()
  })

  test('rolls a d20', async ({ page }) => {
    await page.goto('/dice')
    await page.getByRole('radio', { name: 'd20' }).click()

    await page.getByRole('button', { name: 'Roll' }).click()
    await expect(page.getByText(/^Rolled ([1-9]|1[0-9]|20)$/)).toBeVisible()
  })
})
