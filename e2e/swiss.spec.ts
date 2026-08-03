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
const EIGHT_PLAYERS = [...PLAYERS, 'Gus', 'Hana']

/** Round 1 of a 6-player pod: seats 1v4, 2v5, 3v6. */
const ROUND_ONE_PAIRINGS = [
  ['Ava', 'Dan'],
  ['Ben', 'Eve'],
  ['Cara', 'Finn'],
] as const

/** Round 1 of an 8-player pod: seats 1v5, 2v6, 3v7, 4v8. */
const EIGHT_ROUND_ONE_PAIRINGS = [
  ['Ava', 'Eve'],
  ['Ben', 'Finn'],
  ['Cara', 'Gus'],
  ['Dan', 'Hana'],
] as const

/** The setup screen starts with 4 rows, so anything larger adds rows first. */
async function startTournament(page: Page, players: string[] = PLAYERS) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Pairings' }).click()
  // The Pairings tab now opens on a chooser (casual pods vs Swiss); pick Swiss.
  await page.getByRole('button', { name: 'Swiss tournament' }).click()
  await expect(page.getByRole('heading', { name: 'New tournament' })).toBeVisible()

  for (let added = 4; added < players.length; added++) {
    await page.getByRole('button', { name: 'Add player' }).click()
  }

  for (const [index, name] of players.entries()) {
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

  test('runs an 8-player event through to standings', async ({ page }) => {
    // The most common real field size for this tool, and the one where seat pairing
    // spans the widest gap (seat i plays seat i+4).
    await startTournament(page, EIGHT_PLAYERS)

    await expect(page.getByRole('heading', { name: 'Round 1 of 3' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Report .+ versus .+$/ })).toHaveCount(4)

    for (const [a, b] of EIGHT_ROUND_ONE_PAIRINGS) {
      await expect(page.getByRole('button', { name: `Report ${a} versus ${b}` })).toBeVisible()
    }

    for (const [a, b] of EIGHT_ROUND_ONE_PAIRINGS) {
      await reportMatch(page, a, b, '2-0')
    }

    await page.getByRole('button', { name: 'Start round 2' }).click()
    await expect(page.getByRole('heading', { name: 'Round 2 of 3' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Report .+ versus .+$/ })).toHaveCount(4)

    await page.getByRole('button', { name: 'Standings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
    await expect(page.getByText('1-0-0', { exact: true })).toHaveCount(4)
    await expect(page.getByText('0-1-0', { exact: true })).toHaveCount(4)
  })

  test('gives exactly one player a bye in an odd field', async ({ page }) => {
    // Seven players is four matches: three real pairings plus a bye for the last seat.
    await startTournament(page, PLAYERS.concat('Gus').slice(0, 7))

    await expect(page.getByRole('heading', { name: 'Round 1 of 3' })).toBeVisible()
    await expect(page.getByText('Bye')).toHaveCount(1)
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

test.describe('Commander pods', () => {
  const SEVEN = ['Ava', 'Ben', 'Cara', 'Dan', 'Eve', 'Finn', 'Gus']

  async function startPodEvent(page: Page, players: string[]) {
    await page.goto('/swiss')
    // The Pairings tab now opens on a chooser (casual pods vs Swiss); pick Swiss.
    await page.getByRole('button', { name: 'Swiss tournament' }).click()
    await expect(page.getByRole('heading', { name: 'New tournament' })).toBeVisible()
    await page.getByRole('radio', { name: 'Commander' }).click()

    for (let added = 4; added < players.length; added++) {
      await page.getByRole('button', { name: 'Add player' }).click()
    }
    for (const [index, name] of players.entries()) {
      await page.getByRole('textbox', { name: `Player ${index + 1}` }).fill(name)
    }
    await page.getByRole('button', { name: 'Start with this seating' }).click()
  }

  test('splits seven players into a four and a three, with nobody sitting out', async ({
    page,
  }) => {
    await startPodEvent(page, SEVEN)

    await expect(page.getByRole('heading', { name: 'Round 1 of 3' })).toBeVisible()
    await expect(page.getByText('Ava, Ben, Cara, Dan')).toBeVisible()
    await expect(page.getByText('Eve, Finn, Gus')).toBeVisible()
    // No byes in Commander -- a table of three is a real game.
    await expect(page.getByText('Bye')).toBeHidden()
  })

  test('reports a pod by who won, then advances the round', async ({ page }) => {
    await startPodEvent(page, SEVEN)

    await page.getByRole('button', { name: /^Report the pod with Ava/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Report result' })
    await expect(sheet).toBeVisible()
    // Who won, not a scoreline -- listing four-player game-win permutations would be absurd.
    await expect(sheet.getByRole('button', { name: 'Cara won' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Cara won' }).click()
    await expect(sheet).toBeHidden()

    await page.getByRole('button', { name: /^Report the pod with Eve/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Finn won' }).click()

    await expect(page.getByText('Complete')).toBeVisible()
    await page.getByRole('button', { name: 'Start round 2' }).click()
    await expect(page.getByRole('heading', { name: 'Round 2 of 3' })).toBeVisible()
  })

  test('seats all five at one table rather than sitting anyone out', async ({ page }) => {
    // Five is the one count that cannot split into pods of three and four.
    await startPodEvent(page, SEVEN.slice(0, 5))

    await expect(page.getByText('Ava, Ben, Cara, Dan, Eve')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Report the pod with/ })).toHaveCount(1)
  })

  test('awards the pod winner three points and everyone else none', async ({ page }) => {
    await startPodEvent(page, SEVEN.slice(0, 4))

    await page.getByRole('button', { name: /^Report the pod with Ava/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ben won' }).click()

    await page.getByRole('button', { name: 'Standings', exact: true }).click()
    await expect(page.getByText('3 pts')).toHaveCount(1)
    await expect(page.getByText('0 pts')).toHaveCount(3)
  })
})
