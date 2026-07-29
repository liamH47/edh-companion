import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flipCoin, type CoinSide } from './coin'
import { playLoseSound, playWinSound } from './sound'
import { SoundToggle } from './SoundToggle'

const SPIN_TURNS = 4
const FLIP_DURATION_MS = 900
const REDUCED_FLIP_DURATION_MS = 150

// Okaun, Eye of Chaos: base 3/3, doubles power and toughness on every coin flip won
// (by anyone) until end of turn. Zndrsplt, Eye of Wisdom (1/4) draws a card on the same
// trigger, so "wins" below doubles as "cards drawn" -- no separate counter needed.
const OKAUN_BASE_POWER = 3

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Smallest forward rotation (in whole extra spins) that lands on the given side. */
function rotationFor(currentRotation: number, outcome: CoinSide): number {
  const targetFaceDeg = outcome === 'heads' ? 0 : 180
  const delta = (((targetFaceDeg - (currentRotation % 360)) % 360) + 360) % 360
  return currentRotation + SPIN_TURNS * 360 + delta
}

function CoinBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="#e0b64a" stroke="#a87c1f" strokeWidth="3" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="#a87c1f" strokeWidth="1.5" opacity="0.6" />
      {children}
    </svg>
  )
}

function KrarkFace() {
  return (
    <CoinBase>
      <polygon points="24,42 14,28 30,34" fill="#5c8a3a" />
      <polygon points="76,42 86,28 70,34" fill="#5c8a3a" />
      <circle cx="50" cy="52" r="26" fill="#6fa348" />
      <path d="M32 44 Q38 38 46 42 Q40 48 32 44 Z" fill="#2b2b2b" />
      <line x1="32" y1="44" x2="18" y2="36" stroke="#2b2b2b" strokeWidth="2" />
      <ellipse cx="62" cy="46" rx="6" ry="7" fill="white" />
      <circle cx="63" cy="47" r="3" fill="#1a1a1a" />
      <path d="M38 64 Q50 74 64 62" stroke="#1a1a1a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="52" y="63" width="4" height="6" fill="#e8d24b" />
    </CoinBase>
  )
}

function KrarkThumb() {
  return (
    <CoinBase>
      <rect x="34" y="52" width="32" height="26" rx="10" fill="#6fa348" />
      <rect x="44" y="20" width="16" height="38" rx="8" fill="#6fa348" />
      <line x1="38" y1="60" x2="62" y2="60" stroke="#4c7a2e" strokeWidth="2" opacity="0.6" />
      <line x1="38" y1="68" x2="62" y2="68" stroke="#4c7a2e" strokeWidth="2" opacity="0.6" />
    </CoinBase>
  )
}

interface FlipResult {
  call: CoinSide
  side: CoinSide
  won: boolean
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-900/60">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

export function CoinFlip() {
  const [rotation, setRotation] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [lastResult, setLastResult] = useState<FlipResult | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const durationMs = prefersReducedMotion() ? REDUCED_FLIP_DURATION_MS : FLIP_DURATION_MS
  const okaunPower = OKAUN_BASE_POWER * 2 ** wins

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current)
  }, [])

  const handleCall = (call: CoinSide) => {
    const outcome = flipCoin()
    setRotation((current) => rotationFor(current, outcome))
    setIsFlipping(true)
    timeoutRef.current = window.setTimeout(() => {
      const won = outcome === call
      setLastResult({ call, side: outcome, won })
      setWins((current) => (won ? current + 1 : current))
      setLosses((current) => (won ? current : current + 1))
      setIsFlipping(false)
      if (won) playWinSound()
      else playLoseSound()
    }, durationMs)
  }

  const handleReset = () => {
    window.clearTimeout(timeoutRef.current)
    setIsFlipping(false)
    setWins(0)
    setLosses(0)
    setLastResult(null)
  }

  return (
    <section className="flex flex-col items-center gap-4 py-4">
      <div className="flex w-full max-w-xs items-center justify-between gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Heads: Krark&apos;s face. Tails: Krark&apos;s thumb.
        </p>
        <SoundToggle />
      </div>

      <div className="w-full max-w-xs rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-950/40">
        <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
          Okaun&apos;s power/toughness
        </div>
        <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
          {okaunPower}/{okaunPower}
        </div>
        <div className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
          Zndrsplt draws a card on every win, too
        </div>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-2">
        <StatBox value={wins} label="Wins" />
        <StatBox value={losses} label="Losses" />
        <StatBox value={wins + losses} label="Total" />
      </div>

      <div style={{ perspective: '800px' }}>
        <div
          className="relative h-32 w-32"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotation}deg)`,
            transition: `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <KrarkFace />
          </div>
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <KrarkThumb />
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <button
          type="button"
          onClick={() => handleCall('heads')}
          disabled={isFlipping}
          className="flex-1 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          Call Heads
        </button>
        <button
          type="button"
          onClick={() => handleCall('tails')}
          disabled={isFlipping}
          className="flex-1 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          Call Tails
        </button>
      </div>

      <div aria-live="polite" className="h-10 text-center">
        {lastResult && (
          <>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lastResult.side === 'heads' ? 'Heads!' : 'Tails!'}
            </p>
            <p
              className={
                lastResult.won
                  ? 'text-sm font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-sm font-medium text-slate-500 dark:text-slate-400'
              }
            >
              Called {lastResult.call} — {lastResult.won ? 'Win!' : 'Loss'}
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleReset}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        New Turn
      </button>
    </section>
  )
}
