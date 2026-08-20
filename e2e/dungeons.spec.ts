import { expect, test } from '@playwright/test'

/**
 * The venture tracker end-to-end: enter a dungeon, walk a fork, complete it, and prove
 * the completed tally survives starting the next dungeon -- the one number nothing at
 * a physical table accumulates.
 */
test.describe('dungeons', () => {
  test('walks the Tomb hard path, completes, and the tally survives a new dungeon', async ({
    page,
  }) => {
    await page.goto('/cards/dungeons')

    // The dungeon picker lives inline (not behind the setup sheet): it changes every
    // time a dungeon completes, so it is the most repeated tap this screen has.
    await page.getByRole('radio', { name: 'Tomb of Annihilation' }).click()

    // Not ventured yet: only the entry is offered.
    const map = page.getByTestId('dungeon-map-tomb_path')
    await expect(map).toBeVisible()
    await expect(map.getByRole('button', { name: 'Trapped Entry, venture here' })).toBeVisible()

    // An unreachable room does not respond -- the road not taken stays not taken.
    // force: Playwright's actionability check refuses aria-disabled elements, and
    // proving the tap is inert requires delivering it anyway.
    await map
      .getByRole('button', { name: 'Cradle of the Death God, unreachable' })
      .click({ force: true })
    await expect(page.getByText('Not in this dungeon yet', { exact: false })).toBeVisible()

    // Walk the hard path: one brutal room where the cheap path takes two.
    await map.getByRole('button', { name: 'Trapped Entry, venture here' }).click()
    await map.getByRole('button', { name: 'Oubliette, venture here' }).click()
    await map.getByRole('button', { name: 'Cradle of the Death God, venture here' }).click()
    await expect(page.getByText('You are here: Cradle of the Death God')).toBeVisible()

    // Reaching the bottom room IS completion by rule: the banner fires and the tally
    // button unlocks.
    await expect(page.getByText(/Dungeon complete/)).toBeVisible()
    const markComplete = page.getByRole('button', { name: 'Mark dungeon complete', exact: true })
    await expect(markComplete).toBeEnabled()
    await markComplete.click()

    // A game-long tracker has no "New turn" to lose the tally to.
    await expect(page.getByRole('button', { name: 'New turn' })).toBeHidden()

    // Start the next dungeon: the path resets, the tally does not.
    await page.getByRole('radio', { name: 'Lost Mine of Phandelver' }).click()

    const phandelver = page.getByTestId('dungeon-map-phandelver_path')
    await expect(phandelver.getByRole('button', { name: 'Cave Entrance, venture here' })).toBeVisible()
    // The hero is the completed count, and it survived the switch.
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible()

    // Multi-dungeon: switching away did NOT wipe the Tomb walk. A player in several
    // dungeons at once (or checking another dungeon's shape) keeps every position.
    await page.getByRole('radio', { name: 'Tomb of Annihilation' }).click()
    await expect(
      page
        .getByTestId('dungeon-map-tomb_path')
        .getByRole('button', { name: 'Cradle of the Death God, current' }),
    ).toBeVisible()

    // And the whole board state survives a reload -- localStorage persistence.
    await page.reload()
    await expect(
      page
        .getByTestId('dungeon-map-tomb_path')
        .getByRole('button', { name: 'Cradle of the Death God, current' }),
    ).toBeVisible()
    await expect(page.getByText('You are here: Cradle of the Death God')).toBeVisible()
  })
})
