import { expect, test } from '@playwright/test'

/**
 * The landfall tracker end-to-end: build a roster out of the searchable picker, drop
 * lands, and prove the two things a player cannot hold in their head -- the running
 * totals across several sources, and the rider that only fires on the turn's second
 * resolution.
 */
test.describe('landfall', () => {
  test('tracks three simultaneous triggers, the second-resolution rider, and the roster across turns', async ({
    page,
  }) => {
    await page.goto('/cards/landfall')

    // The roster is board state, so it lives in the setup sheet, which auto-opens on a
    // first visit. Search is the only way in: the roster is drawn from dozens of cards.
    const sheet = page.getByRole('dialog', { name: 'Board state' })
    await expect(sheet).toBeVisible()

    const search = page.getByLabel('Search landfall cards')
    for (const [term, name] of [
      ['cobra', 'Lotus Cobra'],
      ['tatyova', 'Tatyova, Benthic Druid'],
      ['tannuk', 'Tannuk, Memorial Ensign'],
    ]) {
      await search.fill(term)
      await page.getByRole('button', { name: `Add ${name}` }).click()
    }
    await page.getByRole('button', { name: 'Done' }).click()

    // Before a land drops the list reads as a forecast, which is what you look at
    // while deciding whether to crack a fetch.
    await expect(page.getByText('Add one mana of any color')).toBeVisible()
    await expect(page.getByText('on your next land').first()).toBeVisible()

    const landEnters = page.getByRole('button', { name: 'Land enters', exact: true })

    // One land: three abilities, and Tannuk's rider has NOT fired yet.
    await landEnters.click()
    await expect(page.getByText('1 damage to each opponent', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('2nd resolution drew a card')).toBeHidden()

    // Two lands: the rider fires exactly once, so cards drawn is 3 (Tatyova twice plus
    // the rider) rather than 2 or 4. This is the arithmetic the card invites you to
    // get wrong, and the reason the tracker exists.
    await landEnters.click()
    await expect(page.getByText('2nd resolution drew a card')).toBeVisible()

    // The stat strip carries the cross-source totals.
    const cardsTile = page.getByText('cards', { exact: true }).locator('..')
    await expect(cardsTile).toContainText('3')

    // "New turn" clears the lands but keeps the board: your permanents did not leave.
    await page.getByRole('button', { name: 'New turn' }).click()
    await expect(page.getByText('on your next land').first()).toBeVisible()
    await expect(page.getByText('Gain 1 life and draw a card')).toBeVisible()

    // And the whole board state survives a reload.
    await page.reload()
    await expect(page.getByText('Add one mana of any color')).toBeVisible()
    await expect(page.getByText('1 damage to each opponent', { exact: false }).first()).toBeVisible()
  })
})
