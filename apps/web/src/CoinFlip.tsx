import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StatTile } from './ui/StatTile'
import {
  flipCoin,
  isCommanderModeEnabled,
  setCommanderModeEnabled,
  type CoinSide,
} from '@mtg/core'
import { formatNumber, heroFontSize, revealDuration, type HeroFontSize } from '@mtg/core'
import { motion } from '@mtg/core/theme/tokens'
import { playLoseSound, playWinSound } from '@mtg/core'
import { Button } from './ui/Button'
import { Surface } from './ui/Surface'
import { Text } from './ui/Text'
import { Toggle } from './ui/Toggle'

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

/** A plain gold coin with a large H / T, for the default flip that isn't about any
 * particular commander. */
function GenericFace({ letter }: { letter: string }) {
  return (
    <CoinBase>
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="46"
        fontWeight="bold"
        fill="#6b5010"
      >
        {letter}
      </text>
    </CoinBase>
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

/**
 * A goblin thumbs-up. Three details do the work of making it read as a *hand* rather than
 * a shape on a base: the thumb leaves the fist at an angle from one side instead of rising
 * symmetrically from the middle, the curled fingers are drawn as ridges across the fist,
 * and there is a nail at the tip and a sleeve cuff at the wrist. Drop any of those and it
 * goes back to being an anonymous vertical form -- which is exactly what the first version
 * was, and it did not read the way it was meant to.
 */
function KrarkThumb() {
  return (
    <CoinBase>
      {/* Sleeve, drawn first so the fist overlaps it at the wrist. */}
      <rect x="36" y="70" width="28" height="12" rx="5" fill="#4c7a2e" />
      {/* Thumb: angled up and to the left, off the side of the fist. */}
      <line
        x1="41"
        y1="50"
        x2="28"
        y2="29"
        stroke="#6fa348"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <ellipse cx="27" cy="28" rx="3.2" ry="4.2" fill="#cfe3b8" opacity="0.85" />
      {/* Fist, over the thumb's root so the join reads as one hand. */}
      <rect x="30" y="44" width="42" height="32" rx="12" fill="#6fa348" />
      {/* Curled fingers, seen side-on. */}
      <line x1="43" y1="52" x2="67" y2="52" stroke="#4c7a2e" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
      <line x1="43" y1="60" x2="67" y2="60" stroke="#4c7a2e" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
      <line x1="43" y1="68" x2="67" y2="68" stroke="#4c7a2e" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
      {/* Crease where the thumb meets the fist. */}
      <line x1="36" y1="52" x2="43" y2="47" stroke="#4c7a2e" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </CoinBase>
  )
}

/** The tumbling coin itself: a 3D flip around Y that lands showing `front` or `back`.
 * Shared by both modes so the animation lives in one place. */
function FlipCoin({
  rotation,
  durationMs,
  front,
  back,
}: {
  rotation: number
  durationMs: number
  front: ReactNode
  back: ReactNode
}) {
  return (
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
          {front}
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {back}
        </div>
      </div>
    </div>
  )
}

/**
 * The default flip: press once, see Heads or Tails. No call, no tally, no reset -- a real
 * coin never hears the call (it's made out loud between players), so this is the faithful
 * shape, and the common table use is just "who goes first".
 */
function PlainCoin() {
  const [rotation, setRotation] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [result, setResult] = useState<CoinSide | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const inFlight = useRef(false)
  const durationMs = revealDuration()

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current)
  }, [])

  const flip = () => {
    // Guard the sole, repeatedly-mashed button against a double-tap starting two flips.
    if (inFlight.current) return
    inFlight.current = true
    const outcome = flipCoin()
    setRotation((current) => rotationFor(current, outcome))
    setIsFlipping(true)
    timeoutRef.current = window.setTimeout(() => {
      setResult(outcome)
      setIsFlipping(false)
      inFlight.current = false
    }, durationMs)
  }

  return (
    <section className="flex flex-col items-center gap-5 py-4">
      <Text variant="body" color="muted">
        Flip to decide who goes first.
      </Text>

      <FlipCoin
        rotation={rotation}
        durationMs={durationMs}
        front={<GenericFace letter="H" />}
        back={<GenericFace letter="T" />}
      />

      <Button size="lg" onClick={flip} disabled={isFlipping}>
        {isFlipping ? 'Flipping…' : 'Flip'}
      </Button>

      <div aria-live="polite" className="h-8 text-center">
        {result && !isFlipping && (
          <Text as="p" variant="bodyStrong">
            {result === 'heads' ? 'Heads!' : 'Tails!'}
          </Text>
        )}
      </div>
    </section>
  )
}

interface FlipResult {
  call: CoinSide
  side: CoinSide
  won: boolean
}

/**
 * The commander experience: Krark's Thumb coin art, Okaun's doubling power/toughness,
 * Zndrsplt's card draw, and a win/loss tally. Called-side matters here, so the flip is
 * driven by Call Heads / Call Tails.
 */
function CommanderCoin() {
  const [rotation, setRotation] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [lastResult, setLastResult] = useState<FlipResult | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const inFlight = useRef(false)
  const durationMs = revealDuration()
  const okaunPower = OKAUN_BASE_POWER * 2 ** wins
  const okaunDisplay = `${formatNumber(okaunPower)}/${formatNumber(okaunPower)}`

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current)
  }, [])

  const handleCall = (call: CoinSide) => {
    if (inFlight.current) return
    inFlight.current = true
    const outcome = flipCoin()
    setRotation((current) => rotationFor(current, outcome))
    setIsFlipping(true)
    timeoutRef.current = window.setTimeout(() => {
      const won = outcome === call
      setLastResult({ call, side: outcome, won })
      setWins((current) => (won ? current + 1 : current))
      setLosses((current) => (won ? current : current + 1))
      setIsFlipping(false)
      inFlight.current = false
      if (won) playWinSound()
      else playLoseSound()
    }, durationMs)
  }

  const handleReset = () => {
    window.clearTimeout(timeoutRef.current)
    inFlight.current = false
    setIsFlipping(false)
    setWins(0)
    setLosses(0)
    setLastResult(null)
  }

  return (
    <section className="flex flex-col items-center gap-4 py-4">
      <Text variant="body" color="muted">
        Heads: Krark&apos;s face. Tails: Krark&apos;s thumb.
      </Text>

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

      <FlipCoin
        rotation={rotation}
        durationMs={durationMs}
        front={<KrarkFace />}
        back={<KrarkThumb />}
      />

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

/**
 * The coin flip screen. Plain by default; the Krark/Okaun/Zndrsplt commander experience
 * is behind a persisted toggle. Each mode is keyed so switching remounts it -- a fresh
 * start every time, which also clears any in-flight flip's timer and (for commander mode)
 * zeroes the tally rather than restoring a stale one.
 */
export function CoinFlip() {
  const [commanderMode, setCommanderMode] = useState(() => isCommanderModeEnabled())

  const changeMode = (next: boolean) => {
    setCommanderMode(next)
    setCommanderModeEnabled(next)
  }

  return (
    <section className="flex flex-col items-center gap-4 py-2">
      <div className="w-full max-w-xs">
        {/* Inverted so "Plain" sits on the left as the default-highlighted option. */}
        <Toggle
          value={!commanderMode}
          onChange={(plain) => changeMode(!plain)}
          label="Coin mode"
          trueLabel="Plain"
          falseLabel="Commander"
        />
      </div>

      {commanderMode ? <CommanderCoin key="commander" /> : <PlainCoin key="plain" />}
    </section>
  )
}
