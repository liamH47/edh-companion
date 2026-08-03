import { useCallback, useEffect, useState } from 'react'
import { getRecentCardIds } from '@mtg/core'
import { pathToRoute, routeToPath, type Route } from '@mtg/core'

function initialRoute(): Route {
  const path = window.location.pathname
  const fromPath = pathToRoute(path)
  if (fromPath.name !== 'card-picker') return fromPath
  // Only the bare root jumps straight into the last-opened card, so a returning user
  // doesn't pay an extra tap on a cold launch (screen-spec.md). An explicit `/cards` --
  // reached via Back or the Cards tab -- stays on the list, so refreshing the list does
  // not teleport back into a card.
  if (path === '/') {
    const [mostRecentCardId] = getRecentCardIds()
    if (mostRecentCardId) return { name: 'card', cardId: mostRecentCardId }
  }
  return { name: 'card-picker' }
}

export interface Navigation {
  route: Route
  goToCardPicker: () => void
  goToCard: (cardId: string) => void
  goToCoinFlip: () => void
  goToSwiss: () => void
  goToDice: () => void
}

/**
 * Screen state plus web-only browser history sync (pushState/popstate), so Back
 * works and a card is linkable/refreshable. This whole hook is web-specific and
 * gets rewritten against React Navigation in an RN port -- unlike most of
 * `src/core`, there's no reusable sub-piece worth splitting out first.
 */
export function useNavigation(): Navigation {
  const [route, setRoute] = useState<Route>(initialRoute)

  useEffect(() => {
    const handlePopState = () => setRoute(pathToRoute(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((next: Route) => {
    setRoute(next)
    window.history.pushState(null, '', routeToPath(next))
  }, [])

  const goToCardPicker = useCallback(() => navigate({ name: 'card-picker' }), [navigate])
  const goToCard = useCallback((cardId: string) => navigate({ name: 'card', cardId }), [navigate])
  const goToCoinFlip = useCallback(() => navigate({ name: 'coin-flip' }), [navigate])
  const goToSwiss = useCallback(() => navigate({ name: 'swiss' }), [navigate])
  const goToDice = useCallback(() => navigate({ name: 'dice' }), [navigate])

  return { route, goToCardPicker, goToCard, goToCoinFlip, goToSwiss, goToDice }
}
