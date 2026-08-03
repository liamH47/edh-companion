import { getItem, setItem } from './storage'

export type CoinSide = 'heads' | 'tails'

export function flipCoin(): CoinSide {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

const COMMANDER_MODE_STORAGE_KEY = 'mtg-calc-coin-commander-mode'

/**
 * Whether the coin flip shows the Krark/Okaun/Zndrsplt commander experience, or the
 * plain heads/tails flip that is now the default.
 *
 * Deliberately an allow-list on the exact string, the shape `theme.ts` uses -- NOT
 * `sound.ts`'s `!== 'off'`. That form treats empty storage (a first-time user) and any
 * stray value as *enabled*, which would default commander mode **on** and invert the
 * whole redesign. Here anything that is not the literal `'on'` -- `null`, `'true'`,
 * garbage -- means off.
 */
export function isCommanderModeEnabled(): boolean {
  return getItem(COMMANDER_MODE_STORAGE_KEY) === 'on'
}

export function setCommanderModeEnabled(enabled: boolean): void {
  setItem(COMMANDER_MODE_STORAGE_KEY, enabled ? 'on' : 'off')
}
