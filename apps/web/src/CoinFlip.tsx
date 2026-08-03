import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StatTile } from './ui/StatTile'
import { flipCoin, type CoinSide } from '@mtg/core'
import { formatNumber, heroFontSize, revealDuration, type HeroFontSize } from '@mtg/core'
import { motion } from '@mtg/core/theme/tokens'
import { playLoseSound, playWinSound } from '@mtg/core'
import { SoundToggle } from './SoundToggle'
import { Button } from './ui/Button'
import { Surface } from './ui/Surface'
import { Text } from './ui/Text'

const SPIN_TURNS = 4

// Okaun, Eye of Chaos: base 3/3, doubles power and toughness on every coin flip won
// (by anyone) until end of turn. Zndrsplt, Eye of Wisdom (1/4) draws a card on the same
// trigger, so "wins" below doubles as "cards drawn" -- no separate counter needed.
const OKAUN_BASE_POWER = 3

// Okaun's power doubles every win, so it reaches the same scale a card's hero number can.
// Reuse the card hero's font ladder rather than a fixed size, so "3,145,728/3,145,728"
// steps down instead of overflowing the 320px card -- and formatNumber switches to
// exponential past a safe integer instead of a 16-plus-digit run.
const OKAUN_SIZE_CLASS: Record<HeroFontSize, string> = {
  lg: 'text-3xl',
  md: 'text-2xl',
  sm: 'text-xl',
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

export function CoinFlip() {
  const [rotation, setRotation] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [lastResult, setLastResult] = useState<FlipResult | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const durationMs = revealDuration()
  const okaunPower = OKAUN_BASE_POWER * 2 ** wins
  const okaunDisplay = `${formatNumber(okaunPower)}/${formatNumber(okaunPower)}`

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
        <Text variant="body" color="muted">
          Heads: Krark&apos;s face. Tails: Krark&apos;s thumb.
        </Text>
        <SoundToggle />
      </div>

      <Surface level="raised" radius="lg" className="w-full max-w-xs text-center">
        <Text as="div" variant="label" color="accent">
          Okaun&apos;s power/toughness
        </Text>
        <Text
          as="div"
          variant="statTile"
          color="accent"
          className={`${OKAUN_SIZE_CLASS[heroFontSize(okaunPower)]} tabular-nums`}
        >
          {okaunDisplay}
        </Text>
        <Text as="div" variant="body" color="accent" className="mt-1 opacity-80">
          Zndrsplt draws a card on every win, too
        </Text>
      </Surface>

      {/* Flex, not grid: portability-rules.md bans CSS grid outright, since React
          Native has no equivalent. Equal thirds come from flex-1 on each wrapper. */}
      <div className="flex w-full max-w-xs gap-2">
        <div className="flex-1">
          <StatTile value={wins} label="Wins" />
        </div>
        <div className="flex-1">
          <StatTile value={losses} label="Losses" />
        </div>
        <div className="flex-1">
          <StatTile value={wins + losses} label="Total" />
        </div>
      </div>

      <div style={{ perspective: '800px' }}>
        <div
          className="relative h-32 w-32"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotation}deg)`,
            transition: `transform ${durationMs}ms ${motion.easing.standard}`,
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
        <Button onClick={() => handleCall('heads')} disabled={isFlipping} fullWidth>
          Call Heads
        </Button>
        <Button onClick={() => handleCall('tails')} disabled={isFlipping} fullWidth>
          Call Tails
        </Button>
      </div>

      <div aria-live="polite" className="h-10 text-center">
        {lastResult && (
          <>
            <Text as="p" variant="bodyStrong">
              {lastResult.side === 'heads' ? 'Heads!' : 'Tails!'}
            </Text>
            <Text as="p" variant="body" color={lastResult.won ? 'accent' : 'muted'}>
              Called {lastResult.call} — {lastResult.won ? 'Win!' : 'Loss'}
            </Text>
          </>
        )}
      </div>

      <Button variant="secondary" onClick={handleReset}>
        New Turn
      </Button>
    </section>
  )
}
