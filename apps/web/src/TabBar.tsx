import { CardsIcon, CoinIcon, DiceIcon, UsersIcon } from './ui/Icon'
import { Pressable } from './ui/Pressable'
import { Text } from './ui/Text'

export type TabName = 'cards' | 'coin' | 'swiss' | 'dice'

interface TabBarProps {
  active: TabName
  onSelect: (tab: TabName) => void
}

const TABS: { name: TabName; label: string; Icon: typeof CardsIcon }[] = [
  { name: 'cards', label: 'Cards', Icon: CardsIcon },
  { name: 'coin', label: 'Coin Flip', Icon: CoinIcon },
  { name: 'swiss', label: 'Pairings', Icon: UsersIcon },
  { name: 'dice', label: 'Dice', Icon: DiceIcon },
]

/** Bottom tab bar, thumb-zone reachable. Hidden on the card screen itself (App.tsx)
 * so it never competes with ActionBar for the bottom of the screen. Icon above label
 * on every tab -- `CardsIcon` used to appear only as CardThumb's offline fallback,
 * and the other three tabs had no icon at all, the one nav-shaped control in the app
 * that didn't pair one with its label. */
export function TabBar({ active, onSelect }: TabBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-xl">
        {TABS.map(({ name, label, Icon }) => (
          <Pressable
            key={name}
            aria-current={active === name ? 'page' : undefined}
            onClick={() => onSelect(name)}
            className="min-h-12 flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            <Icon className={active === name ? 'text-accent' : 'text-text-muted'} />
            <Text variant="label" color={active === name ? 'accent' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        ))}
      </div>
    </nav>
  )
}
