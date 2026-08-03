import { describe, expect, it } from 'vitest'
import { cardImageUrl } from './cardImage'

const SCRYFALL_ID = '1d21ae20-2ef5-4dc0-aced-97497e6a8025'

describe('cardImageUrl', () => {
  it('builds a Scryfall image URL from the card id', () => {
    expect(cardImageUrl({ scryfall_id: SCRYFALL_ID })).toBe(
      `https://api.scryfall.com/cards/${SCRYFALL_ID}?format=image&version=normal`,
    )
  })

  it('defaults to the normal size', () => {
    // Large enough to read at arm's length, small enough not to stall on venue wifi.
    expect(cardImageUrl({ scryfall_id: SCRYFALL_ID })).toContain('version=normal')
  })

  it('honours an explicit version', () => {
    expect(cardImageUrl({ scryfall_id: SCRYFALL_ID }, 'large')).toContain('version=large')
  })

  it('returns null when the entry has no card behind it', () => {
    // Not defensive coding: scryfall_id is optional so a future entry can be a format
    // mechanic (commander tax) that no single card represents. Callers use the null to
    // decide whether the button renders at all.
    expect(cardImageUrl({ scryfall_id: null })).toBeNull()
  })

  it('treats an empty id as absent rather than building a broken URL', () => {
    expect(cardImageUrl({ scryfall_id: '' })).toBeNull()
  })
})
