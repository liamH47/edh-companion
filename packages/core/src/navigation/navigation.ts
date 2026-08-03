/**
 * Screen names map 1:1 onto a future Expo Router file-based route:
 *   card-picker -> (tabs)/cards   card -> cards/[id]   coin-flip -> (tabs)/coin
 *   swiss -> (tabs)/swiss         dice -> (tabs)/dice
 * Pure route <-> URL-path conversion, no window access -- usable from a test or a
 * future RN port without a DOM. The web-only bit (syncing this with browser history)
 * lives in useNavigation.ts, which gets rewritten wholesale for React Navigation in
 * an RN port; splitting that further wouldn't leave anything reusable behind.
 */
export type Route =
  | { name: 'card-picker' }
  | { name: 'card'; cardId: string }
  | { name: 'coin-flip' }
  | { name: 'swiss' }
  | { name: 'dice' }

export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'card-picker':
      return '/'
    case 'card':
      return `/cards/${route.cardId}`
    case 'coin-flip':
      return '/coin-flip'
    case 'swiss':
      return '/swiss'
    case 'dice':
      return '/dice'
  }
}

export function pathToRoute(path: string): Route {
  if (path === '/coin-flip') return { name: 'coin-flip' }
  if (path === '/swiss') return { name: 'swiss' }
  if (path === '/dice') return { name: 'dice' }
  const match = /^\/cards\/([^/]+)$/.exec(path)
  if (match) return { name: 'card', cardId: match[1] }
  return { name: 'card-picker' }
}
