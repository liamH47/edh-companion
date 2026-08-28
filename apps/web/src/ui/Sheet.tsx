import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { transitionDuration } from '@mtg/core'
import { motion } from '@mtg/core/theme/tokens'
import { CloseIcon } from './Icon'
import { Pressable } from './Pressable'
import { Text } from './Text'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children?: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Bottom sheet: backdrop + panel sliding up from the bottom edge. Closes on
 * backdrop click, Esc, or the header's close button -- every path funnels through
 * `onClose` so callers have exactly one place to react (see SetupSheet's "Done").
 * Not portalled: every current use sits at the screen root already, and a portal
 * has no equivalent in React Native, where this same component gets rewritten
 * against a native modal API anyway.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      // Focus trap: Tab/Shift+Tab cycle within the sheet instead of escaping to the
      // page behind it. The panel itself (tabIndex=-1) is a valid wrap target too,
      // for a sheet with zero focusable children (e.g. an empty setup field list).
      const focusable = [
        panelRef.current,
        ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const durationMs = transitionDuration('sheet')

  return (
    /* A flex column ending at the bottom edge, not `items-end`: the panel has to be a
       shrinkable flex item in a definite-height box, or a tall sheet on a short viewport
       grows straight off the top of the screen. It used to -- on a landscape phone the
       panel's top sat at -38px with the Close button at y=-1, unreachable, and nothing
       scrolled to bring it back. Pure flex rather than a max-height: no percentage
       heights or viewport units, so src/ui/ keeps honouring portability-rules.md. */
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end">
      <div
        className="absolute inset-0 bg-overlay"
        style={{ transitionDuration: `${durationMs}ms`, transitionTimingFunction: motion.easing.decelerate }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex min-h-0 w-full max-w-xl flex-col gap-4 rounded-t-lg border border-b-0 border-border bg-surface-raised p-4 outline-none"
        style={{ transitionDuration: `${durationMs}ms`, transitionTimingFunction: motion.easing.standard }}
      >
        {/* The grab handle and the header never scroll away -- whatever happens to the
            body, the way out of the sheet stays on screen. */}
        <div className="mx-auto h-1 w-10 shrink-0 rounded-pill bg-border" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between">
          <Text as="h2" variant="title" id={titleId}>
            {title}
          </Text>
          <Pressable
            aria-label="Close"
            onClick={onClose}
            className="min-h-12 min-w-12 justify-center rounded-full text-text-muted hover:text-text"
          >
            <CloseIcon />
          </Pressable>
        </div>
        {/* Scrolls only when it has to: min-h-0 lets this shrink below its content, which
            is what stops the panel pushing past the top of the viewport. */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
