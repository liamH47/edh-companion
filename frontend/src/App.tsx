import { useEffect, useState } from 'react'
import { listCards } from './api'
import { CardForm } from './CardForm'
import { CoinFlip } from './CoinFlip'
import { ThemeToggle } from './ThemeToggle'
import type { CardMetadata } from './types'

type View = 'calculator' | 'coin-flip'

function App() {
  const [cards, setCards] = useState<CardMetadata[] | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('calculator')

  useEffect(() => {
    listCards()
      .then((fetchedCards) => {
        setCards(fetchedCards)
        setSelectedCardId(fetchedCards[0]?.id ?? null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load cards: {error}
        </p>
      </main>
    )
  }

  if (!cards || !selectedCardId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    )
  }

  // selectedCardId is only ever set to an id already present in `cards` (see above and the
  // <select> below), so a lookup miss here isn't a real, reachable state to guard against.
  const selectedCard = cards.find((card) => card.id === selectedCardId)!

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Commander&apos;s Companion</h1>
        <ThemeToggle />
      </header>

      <div
        role="tablist"
        aria-label="View"
        className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === 'calculator'}
          onClick={() => setView('calculator')}
          className={
            view === 'calculator'
              ? 'flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
              : 'flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400'
          }
        >
          Aetherflux
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'coin-flip'}
          onClick={() => setView('coin-flip')}
          className={
            view === 'coin-flip'
              ? 'flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
              : 'flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400'
          }
        >
          Coin Flip
        </button>
      </div>

      {view === 'calculator' ? (
        <>
          {cards.length > 1 && (
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Card
              <select
                value={selectedCardId}
                onChange={(event) => setSelectedCardId(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
            <CardForm key={selectedCardId} card={selectedCard} />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
          <CoinFlip />
        </div>
      )}
    </main>
  )
}

export default App
