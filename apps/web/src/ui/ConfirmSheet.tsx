import { Button } from './Button'
import { Sheet } from './Sheet'
import { Text } from './Text'

interface ConfirmSheetProps {
  open: boolean
  /** Dismiss without acting. Also fires on backdrop click, Esc and the close button,
   * since `Sheet` funnels every dismissal path through one callback. */
  onCancel: () => void
  onConfirm: () => void
  title: string
  /** What will be destroyed, in the player's terms -- name the actual thing ("this
   * card's tracked state", "the whole pod night"), not a generic "are you sure". The
   * title asks the question; this is what the answer costs. */
  message: string
  /** The confirm button's label. A verb that repeats the action ("Reset card"), never
   * "OK" -- a labelled button is what makes a confirm readable at a glance instead of
   * something to tap through. */
  confirmLabel: string
}

/**
 * The one confirmation dialog. Every irreversible reset in the app routes through it,
 * so they read identically and none of them is a bare button that wipes a session on a
 * mis-tap.
 *
 * Deliberately NOT used for reversible or routine actions -- "New turn", "Empty pool",
 * "Clear result". A confirm on something pressed every turn is worse than no confirm:
 * it trains people to tap straight through, which is exactly what makes the dialog
 * useless on the actions that genuinely needed one.
 *
 * Cancel is the primary-weight button and sits first; confirming is the outlined
 * `danger` one. The safe path should be the easy one to hit with a thumb, and the
 * destructive path should take a deliberate reach.
 */
export function ConfirmSheet({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <Text variant="body" color="muted">
        {message}
      </Text>
      <div className="flex gap-3">
        <Button onClick={onCancel} className="flex-1">
          Keep it
        </Button>
        <Button variant="danger" onClick={onConfirm} className="flex-1">
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}
