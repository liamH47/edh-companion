import { describe, expect, it } from 'vitest'
import { pathToRoute, routeToPath } from './navigation'

describe('routeToPath', () => {
  it('maps card-picker to the root path', () => {
    expect(routeToPath({ name: 'card-picker' })).toBe('/')
  })

  it('maps a card route to /cards/:id', () => {
    expect(routeToPath({ name: 'card', cardId: 'aetherflux-reservoir' })).toBe(
      '/cards/aetherflux-reservoir',
    )
  })

  it('maps coin-flip to /coin-flip', () => {
    expect(routeToPath({ name: 'coin-flip' })).toBe('/coin-flip')
  })

  it('maps swiss to /swiss', () => {
    expect(routeToPath({ name: 'swiss' })).toBe('/swiss')
  })
})

describe('pathToRoute', () => {
  it('maps the root path to card-picker', () => {
    expect(pathToRoute('/')).toEqual({ name: 'card-picker' })
  })

  it('maps /coin-flip to coin-flip', () => {
    expect(pathToRoute('/coin-flip')).toEqual({ name: 'coin-flip' })
  })

  it('maps /cards/:id to a card route', () => {
    expect(pathToRoute('/cards/aetherflux-reservoir')).toEqual({
      name: 'card',
      cardId: 'aetherflux-reservoir',
    })
  })

  it('falls back to card-picker for an unrecognized path', () => {
    expect(pathToRoute('/something-unknown')).toEqual({ name: 'card-picker' })
  })

  it('falls back to card-picker for a bare /cards/ with no id', () => {
    expect(pathToRoute('/cards/')).toEqual({ name: 'card-picker' })
  })

  it('maps /swiss to the swiss route', () => {
    expect(pathToRoute('/swiss')).toEqual({ name: 'swiss' })
  })

  it('round-trips every route through routeToPath', () => {
    const routes: Parameters<typeof routeToPath>[0][] = [
      { name: 'card-picker' },
      { name: 'card', cardId: 'craterhoof-behemoth' },
      { name: 'coin-flip' },
      { name: 'swiss' },
    ]
    for (const route of routes) {
      expect(pathToRoute(routeToPath(route))).toEqual(route)
    }
  })
})
