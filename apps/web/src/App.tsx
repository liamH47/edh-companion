import { CARDS } from '@mtg/core'
import { recordCardOpened } from '@mtg/core'
import type { Route } from '@mtg/core'
import { CardPickerScreen } from './cards/CardPickerScreen'
import { CardScreen } from './cards/CardScreen'
import { CoinFlip } from './CoinFlip'
import { useNavigation } from './core/navigation/useNavigation'
import { ErrorBoundary } from './ErrorBoundary'
import { DiceScreen } from './DiceScreen'
import { InstallPrompt } from './InstallPrompt'
import { PairingsScreen } from './pairings/PairingsScreen'
import { SoundToggle } from './SoundToggle'
import { TabBar, type TabName } from './TabBar'
import { ThemeToggle } from './ThemeToggle'

/** Which tab is highlighted for a given route. A `switch` rather than a ternary chain so
 * adding a route without mapping it is a type error, not a silently wrong highlight. */
function tabForRoute(name: Route['name']): TabName {
  switch (name) {
    case 'coin-flip':
      return 'coin'
    case 'swiss':
      return 'swiss'
    case 'dice':
      return 'dice'
    case 'card-picker':
    case 'card':
      return 'cards'
  }
}

/**
 * Every tab is now entirely local -- card metadata is bundled and compute runs in the
 * browser, so nothing here needs a connection. The loading and error states this file
 * used to carry existed only for the card-list fetch, which no longer happens.
 */
function App() {
  const { route, goToCardPicker, goToCard, goToCoinFlip, goToSwiss, goToDice } = useNavigation()

  const handleSelectCard = (cardId: string) => {
    recordCardOpened(cardId)
    goToCard(cardId)
  }

  const handleSelectTab = (tab: TabName) => {
    switch (tab) {
      case 'cards':
        return goToCardPicker()
      case 'coin':
        return goToCoinFlip()
      case 'swiss':
        return goToSwiss()
      case 'dice':
        return goToDice()
    }
  }

  // A card route whose id matches no card (a stale deep link) falls back to the picker
  // in place, without rewriting the URL.
  const selectedCard = route.name === 'card' ? CARDS.find((card) => card.id === route.cardId) : null

  // The card screen owns its own bottom-pinned ActionBar, so the tab bar would compete
  // with it for the same thumb-zone space -- hide it there (screen-spec.md).
  const showTabBar = !selectedCard

  return (
    <main
      // Bottom padding is set explicitly in BOTH branches rather than letting py-4/
      // sm:py-8 carry it: the tab-bar clearance class is unprefixed, and a responsive
      // variant like sm:py-8 is emitted later in the stylesheet -- so on desktop it was
      // silently overriding the clearance, leaving the fixed tab bar overlapping the
      // last ~32px of every scrollable view. Caught by e2e failing to click a
      // bottom-of-screen button on the desktop viewport only.
      //
      // dvh, not vh: on iOS Safari `100vh` is the LARGE viewport (60-110px taller than
      // what is actually on screen with the URL bar showing). While every screen was
      // top-aligned that only padded invisible space at the bottom; now that the card
      // route bounds its height and scrolls inside, vh would put the pinned ActionBar
      // under the browser chrome.
      //
      // A card route is `h-dvh` (bounded, so CardScreen's middle region scrolls between
      // a static header and a pinned ActionBar); every other route is `min-h-dvh` and
      // scrolls the page as before.
      className={`mx-auto flex w-full max-w-xl flex-col gap-4 bg-canvas px-4 pt-4 sm:px-6 sm:pt-8 ${
        showTabBar
          ? 'min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-[calc(5rem+env(safe-area-inset-bottom))]'
          : 'h-dvh pb-4 sm:pb-8'
      }`}
    >
      {/* Two mirrored flex-1 regions centre the title. On a narrow screen the icon
          cluster's min-width wins its side, drifting the title a few px left of true
          centre -- deliberately preferred over absolute centring, which collides the
          title with the icons at exactly those widths. Optically centred beats
          mathematically centred here. */}
      <header className="flex items-center">
        <div className="flex-1" aria-hidden="true" />
        <h1 className="font-display text-center text-xl font-semibold tracking-tight text-text sm:text-2xl">
          Mana Ledger
        </h1>
        <div className="flex flex-1 items-center justify-end gap-2">
          <InstallPrompt />
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* One boundary per tab, not just the single top-level one in main.tsx: a render
          error in (say) the Swiss screen should surface its own recover button without
          dragging Cards, Coin Flip and Dice down to a blank screen with it. The key
          resets the boundary on navigation, so leaving a broken route clears the error. */}
      <ErrorBoundary key={route.name}>
        {(route.name === 'card-picker' || route.name === 'card') &&
          (selectedCard ? (
            <CardScreen key={selectedCard.id} card={selectedCard} onBack={goToCardPicker} />
          ) : (
            <CardPickerScreen cards={CARDS} onSelectCard={handleSelectCard} />
          ))}

        {route.name === 'coin-flip' && <CoinFlip />}

        {route.name === 'swiss' && <PairingsScreen />}

        {route.name === 'dice' && <DiceScreen />}
      </ErrorBoundary>

      {showTabBar && <TabBar active={tabForRoute(route.name)} onSelect={handleSelectTab} />}
    </main>
  )
}

export default App
