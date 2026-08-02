import { useEffect, useState } from 'react'
import { listCards } from './api'
import { CardPickerScreen } from './cards/CardPickerScreen'
import { CardScreen } from './cards/CardScreen'
import { CoinFlip } from './CoinFlip'
import { useNavigation } from './core/navigation/useNavigation'
import { recordCardOpened } from './core/recentCards'
import { SwissScreen } from './swiss/SwissScreen'
import { TabBar, type TabName } from './TabBar'
import { ThemeToggle } from './ThemeToggle'
import { Text } from './ui/Text'
import type { CardMetadata } from './types'

/**
 * The card list is the only thing here that needs the network, so it is fetched and
 * error-handled *inside* the card routes rather than gating the whole app. The Coin
 * Flip and Pairings tabs are entirely local, and a backend outage must not take them
 * down with it -- running a draft on bad reception is exactly when Pairings matters.
 */
function CardRoutes({
  cards,
  error,
  route,
  onSelectCard,
  onBack,
}: {
  cards: CardMetadata[] | null
  error: string | null
  route: { name: 'card-picker' } | { name: 'card'; cardId: string }
  onSelectCard: (cardId: string) => void
  onBack: () => void
}) {
  if (error !== null) {
    return (
      <div role="alert" className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3">
        <Text variant="body" color="danger">
          Failed to load cards: {error}
        </Text>
      </div>
    )
  }

  if (cards === null) {
    return (
      <Text variant="body" color="muted">
        Loading…
      </Text>
    )
  }

  // A card route whose id no longer matches any registered card (a stale deep link)
  // falls back to the picker in place, without rewriting the URL -- rare enough
  // (cards aren't removed from the registry in normal operation) that a redirect
  // isn't worth the extra history entry.
  const selectedCard = route.name === 'card' ? cards.find((card) => card.id === route.cardId) : null

  if (selectedCard) {
    return <CardScreen key={selectedCard.id} card={selectedCard} onBack={onBack} />
  }
  return <CardPickerScreen cards={cards} onSelectCard={onSelectCard} />
}

function App() {
  const [cards, setCards] = useState<CardMetadata[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { route, goToCardPicker, goToCard, goToCoinFlip, goToSwiss } = useNavigation()

  useEffect(() => {
    listCards()
      .then(setCards)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const handleSelectCard = (cardId: string) => {
    recordCardOpened(cardId)
    goToCard(cardId)
  }

  const handleSelectTab = (tab: TabName) => {
    if (tab === 'cards') goToCardPicker()
    else if (tab === 'coin') goToCoinFlip()
    else goToSwiss()
  }

  const activeTab: TabName =
    route.name === 'coin-flip' ? 'coin' : route.name === 'swiss' ? 'swiss' : 'cards'

  // The card screen owns its own bottom-pinned ActionBar, so the tab bar would
  // compete with it for the same thumb-zone space -- hide it there (screen-spec.md).
  const onOpenCardScreen =
    route.name === 'card' && cards !== null && cards.some((card) => card.id === route.cardId)
  const showTabBar = !onOpenCardScreen

  return (
    <main
      className={`mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-canvas px-4 py-4 sm:px-6 sm:py-8 ${
        showTabBar ? 'pb-[calc(4rem+env(safe-area-inset-bottom))]' : ''
      }`}
    >
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
          Commander&apos;s Companion
        </h1>
        <ThemeToggle />
      </header>

      {(route.name === 'card-picker' || route.name === 'card') && (
        <CardRoutes
          cards={cards}
          error={error}
          route={route}
          onSelectCard={handleSelectCard}
          onBack={goToCardPicker}
        />
      )}

      {route.name === 'coin-flip' && <CoinFlip />}

      {route.name === 'swiss' && <SwissScreen />}

      {showTabBar && <TabBar active={activeTab} onSelect={handleSelectTab} />}
    </main>
  )
}

export default App
