import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateCard, getCard, listCards } from './api'

function mockFetchOnce(
  body: unknown,
  init: { ok: boolean; status?: number; statusText?: string } = { ok: true },
) {
  const response = {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    statusText: init.statusText ?? '',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listCards', () => {
  it('fetches /api/cards and returns the parsed JSON', async () => {
    mockFetchOnce([{ id: 'aetherflux-reservoir' }])
    await expect(listCards()).resolves.toEqual([{ id: 'aetherflux-reservoir' }])
    expect(fetch).toHaveBeenCalledWith('/api/cards', undefined)
  })
})

describe('getCard', () => {
  it('fetches /api/cards/{id}', async () => {
    mockFetchOnce({ id: 'aetherflux-reservoir' })
    await expect(getCard('aetherflux-reservoir')).resolves.toEqual({
      id: 'aetherflux-reservoir',
    })
    expect(fetch).toHaveBeenCalledWith('/api/cards/aetherflux-reservoir', undefined)
  })

  it('throws with the response status and body text when the request fails', async () => {
    mockFetchOnce('card not found', { ok: false, status: 404, statusText: 'Not Found' })
    await expect(getCard('nonexistent-card')).rejects.toThrow('404 Not Found: card not found')
  })
})

describe('calculateCard', () => {
  it('posts inputs as JSON and returns outputs', async () => {
    mockFetchOnce({ outputs: { total_life: 6 } })
    const result = await calculateCard('aetherflux-reservoir', { spells_cast_after: 4 })
    expect(result).toEqual({ outputs: { total_life: 6 } })
    expect(fetch).toHaveBeenCalledWith('/api/cards/aetherflux-reservoir/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: { spells_cast_after: 4 } }),
    })
  })
})
