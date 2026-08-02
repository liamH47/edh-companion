/**
 * Everything platform-free: card logic, session hooks, navigation routes, storage,
 * design tokens, and the seams a host app fills in.
 *
 * The network layer is deliberately *not* re-exported here: it has its own entry
 * point (`@mtg/core/api`) so there is exactly one specifier for it. Two ways to
 * import one module means a test that mocks one of them silently misses the other.
 *
 * The rule this package exists to enforce is mechanical, not aspirational: its
 * tsconfig omits `lib: ["DOM"]`, so `window`, `document`, `localStorage` and
 * `navigator` do not compile here. Reaching for one means adding a seam instead --
 * which is what keeps this importable from React Native unchanged.
 */
export * from './cardModel'
export * from './compute'
export * from './coin'
export * from './haptics'
export * from './motion'
export * from './navigation/navigation'
export * from './recentCards'
export * from './sound'
export * from './storage'
export * from './types'
export * from './useCardSession'
