import { Pressable } from './ui/Pressable'
import { Text } from './ui/Text'

export type TabName = 'cards' | 'coin' | 'swiss'

interface TabBarProps {
  active: TabName
  onSelect: (tab: TabName) => void
}

const TABS: { name: TabName; label: string }[] = [
  { name: 'cards', label: 'Cards' },
  { name: 'coin', label: 'Coin Flip' },
  { name: 'swiss', label: 'Pairings' },
]

/** Bottom tab bar, thumb-zone reachable. Hidden on the card screen itself (App.tsx)
 * so it never competes with ActionBar for the bottom of the screen. */
export function TabBar({ active, onSelect }: TabBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-xl">
        {TABS.map((tab) => (
          <Pressable
            key={tab.name}
            aria-current={active === tab.name ? 'page' : undefined}
            onClick={() => onSelect(tab.name)}
            className="min-h-12 flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            <Text variant="label" color={active === tab.name ? 'accent' : 'muted'}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </div>
    </nav>
  )
}
