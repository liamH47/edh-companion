import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordCardOpened } from '@mtg/core'
import { useNavigation } from './useNavigation'

beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(() => {
  localStorage.clear()
  window.history.pushState(null, '', '/')
})

describe('useNavigation', () => {
  it('starts at the card picker when the URL is / and there is no recent card', () => {
    const { result } = renderHook(() => useNavigation())
    expect(result.current.route).toEqual({ name: 'card-picker' })
  })

  it('starts at the most recently opened card when the URL is / and one exists', () => {
    recordCardOpened('craterhoof-behemoth')
    recordCardOpened('aetherflux-reservoir')
    const { result } = renderHook(() => useNavigation())
    expect(result.current.route).toEqual({ name: 'card', cardId: 'aetherflux-reservoir' })
  })

  it('honors a specific card URL over the recent-card fallback', () => {
    recordCardOpened('aetherflux-reservoir')
    window.history.pushState(null, '', '/cards/craterhoof-behemoth')
    const { result } = renderHook(() => useNavigation())
    expect(result.current.route).toEqual({ name: 'card', cardId: 'craterhoof-behemoth' })
  })

  it('stays on the picker at /cards even when a recent card exists', () => {
    // Going back to the list and refreshing must not teleport into the last card: the
    // explicit /cards path is not the bare root, so it does not trigger the redirect.
    recordCardOpened('aetherflux-reservoir')
    window.history.pushState(null, '', '/cards')
    const { result } = renderHook(() => useNavigation())
    expect(result.current.route).toEqual({ name: 'card-picker' })
  })

  it('starts at coin-flip when the URL is /coin-flip', () => {
    window.history.pushState(null, '', '/coin-flip')
    const { result } = renderHook(() => useNavigation())
    expect(result.current.route).toEqual({ name: 'coin-flip' })
  })

  it('goToCard updates the route and pushes /cards/:id', () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.goToCard('aetherflux-reservoir'))
    expect(result.current.route).toEqual({ name: 'card', cardId: 'aetherflux-reservoir' })
    expect(window.location.pathname).toBe('/cards/aetherflux-reservoir')
  })

  it('goToCoinFlip updates the route and pushes /coin-flip', () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.goToCoinFlip())
    expect(result.current.route).toEqual({ name: 'coin-flip' })
    expect(window.location.pathname).toBe('/coin-flip')
  })

  it('starts at swiss when the URL is /swiss', () => {
    window.history.pushState(null, '', '/swiss')
    const { result } = renderHook(() => useNavigation())
    expect(result.current.route).toEqual({ name: 'swiss' })
  })

  it('goToSwiss updates the route and pushes /swiss', () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.goToSwiss())
    expect(result.current.route).toEqual({ name: 'swiss' })
    expect(window.location.pathname).toBe('/swiss')
  })

  it('goToCardPicker updates the route and pushes /cards', () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.goToCard('aetherflux-reservoir'))
    act(() => result.current.goToCardPicker())
    expect(result.current.route).toEqual({ name: 'card-picker' })
    expect(window.location.pathname).toBe('/cards')
  })

  it('follows browser back/forward via popstate', () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.goToCard('aetherflux-reservoir'))
    act(() => {
      window.history.pushState(null, '', '/coin-flip')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.route).toEqual({ name: 'coin-flip' })
  })

  it('removes the popstate listener on unmount', () => {
    const { unmount } = renderHook(() => useNavigation())
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
    removeSpy.mockRestore()
  })
})
