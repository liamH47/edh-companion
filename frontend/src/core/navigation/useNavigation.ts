import { useCallback, useEffect, useState } from 'react'
import { getRecentCardIds } from '../recentCards'
import { pathToRoute, routeToPath, type Route } from './navigation'

function initialRoute(): Route {
  const fromPath = pathToRoute(window.location.pathname)
  if (fromPath.name !== 'card-picker') return fromPath
  // Landed on the bare root with no route encoded in the URL: jump straight into
  // the last-opened card instead of the picker, so a returning user doesn't pay an
  // extra tap every launch (screen-spec.md).
  const [mostRecentCardId] = getRecentCardIds()
  return mostRecentCardId ? { name: 'card', cardId: mostRecentCardId } : { name: 'card-picker' }
}

export interface Navigation {
  route: Route
  goToCardPicker: () => void
  goToCard: (cardId: string) => void
  goToCoinFlip: () => void
  goToSwiss: () => void
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

  return { route, goToCardPicker, goToCard, goToCoinFlip, goToSwiss }
}
