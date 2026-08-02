import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCard, resetComputeBackend, setComputeBackend } from './compute'

describe('compute backend', () => {
  beforeEach(() => {
    resetComputeBackend()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to the server by default', async () => {
    // The default matters: a host that registers nothing still computes, over the
    // network, which is what the web did before compute became swappable. Stubbing
    // fetch rather than the api module exercises the real request too.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ outputs: { total: 7 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(computeCard('blood-artist', { creatures_died: 2 })).resolves.toEqual({
      outputs: { total: 7 },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cards/blood-artist/calculate',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('routes through a registered backend instead, with no request at all', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const local = vi.fn().mockResolvedValue({ outputs: { total: 12 } })
    setComputeBackend(local)

    await expect(computeCard('grapeshot', { storm_count: 3 })).resolves.toEqual({
      outputs: { total: 12 },
    })
    expect(local).toHaveBeenCalledWith('grapeshot', { storm_count: 3 }, undefined)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes the abort signal through', async () => {
    const local = vi.fn().mockResolvedValue({ outputs: {} })
    setComputeBackend(local)
    const controller = new AbortController()

    await computeCard('scute-swarm', {}, controller.signal)

    expect(local).toHaveBeenCalledWith('scute-swarm', {}, controller.signal)
  })

  it('goes back to the server when reset', async () => {
    setComputeBackend(vi.fn().mockResolvedValue({ outputs: { total: 1 } }))
    resetComputeBackend()

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ outputs: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await computeCard('blood-artist', {})

    expect(fetchMock).toHaveBeenCalled()
  })
})
