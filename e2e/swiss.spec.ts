import { expect, type Page, test } from '@playwright/test'

/**
 * A full Swiss event driven through the UI. The pairing algorithm itself is covered
 * far more exhaustively by the seeded integration sweep in core/swiss -- what this
 * adds is proof that the whole tab works in the shipped bundle with no backend
 * involvement at all, which is the entire premise of keeping Swiss client-side.
 *
 * Only round 1 is deterministic (seat pairing: seat i plays seat i + floor(N/2)).
 * Round 2 onward shuffles within score groups, so assertions past round 1 are about
 * structure and standings, never about who specifically got paired with whom.
 */

const PLAYERS = ['Ava', 'Ben', 'Cara', 'Dan', 'Eve', 'Finn']

/** Round 1 of a 6-player pod: seats 1v4, 2v5, 3v6. */
const ROUND_ONE_PAIRINGS = [
  ['Ava', 'Dan'],
  ['Ben', 'Eve'],
  ['Cara', 'Finn'],
] as const

async function startTournament(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Pairings' }).click()
  await expect(page.getByRole('heading', { name: 'New tournament' })).toBeVisible()

  // The setup screen starts with 4 rows; a 6-player pod needs two more.
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByRole('button', { name: 'Add player' }).click()

  for (const [index, name] of PLAYERS.entries()) {
    await page.getByRole('textbox', { name: `Player ${index + 1}` }).fill(name)
  }

  await page.getByRole('button', { name: 'Start with this seating' }).click()
}

async function reportMatch(page: Page, a: string, b: string, scoreline: string) {
  await page.getByRole('button', { name: `Report ${a} versus ${b}` }).click()
  const sheet = page.getByRole('dialog', { name: 'Report result' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: scoreline, exact: true }).click()
  await expect(sheet).toBeHidden()
}

test.describe('Swiss pairings', () => {
  test('runs a 6-player event from setup through round 2 and standings', async ({ page }) => {
    await startTournament(page)

    await expect(page.getByRole('heading', { name: 'Round 1 of 3' })).toBeVisible()

    // Seat pairing is deterministic, so this is safe to assert exactly.
    for (const [a, b] of ROUND_ONE_PAIRINGS) {
      await expect(page.getByRole('button', { name: `Report ${a} versus ${b}` })).toBeVisible()
    }

    // Nothing reported yet, so the round cannot advance.
    await expect(page.getByRole('button', { name: 'Start round 2' })).toBeHidden()

    for (const [a, b] of ROUND_ONE_PAIRINGS) {
      await reportMatch(page, a, b, '2-0')
    }

    await expect(page.getByText('Complete')).toBeVisible()

    await page.getByRole('button', { name: 'Start round 2' }).click()
    await expect(page.getByRole('heading', { name: 'Round 2 of 3' })).toBeVisible()

    // Six active players is three matches, whoever they turned out to be.
    await expect(page.getByRole('button', { name: /^Report .+ versus .+$/ })).toHaveCount(3)

    await page.getByRole('button', { name: 'Standings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()

    // Three winners on 1-0-0 and three losers on 0-1-0 after one round.
    await expect(page.getByText('1-0-0', { exact: true })).toHaveCount(3)
    await expect(page.getByText('0-1-0', { exact: true })).toHaveCount(3)
    await expect(page.getByText('3 pts')).toHaveCount(3)
  })

  test('survives a reload mid-event', async ({ page }) => {
    // The tournament lives in localStorage, so closing the tab at a real table must
    // not lose the event. Nothing else in the suite covers persistence.
    await startTournament(page)
    await reportMatch(page, 'Ava', 'Dan', '2-0')

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Round 1 of 3' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Report Ava versus Dan' })).toContainText('2-0')
  })

  test('works with the card API unreachable', async ({ page }) => {
    // The reason Swiss is client-side: a backend outage must not take down the tab
    // you need mid-draft. Blocking /api/** simulates the outage the app is designed
    // to survive.
    await page.route('**/api/**', (route) => route.abort())

    await startTournament(page)

    await expect(page.getByRole('heading', { name: 'Round 1 of 3' })).toBeVisible()
    await reportMatch(page, 'Ava', 'Dan', '2-0')
    await expect(page.getByRole('button', { name: 'Report Ava versus Dan' })).toContainText('2-0')
  })
})
