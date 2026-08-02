import { Text } from '../ui/Text'
import { Sheet } from '../ui/Sheet'

interface RulesTextPopoverProps {
  open: boolean
  onClose: () => void
  title: string
  rulesText: string
}

/** Surfaces `card.rules_text` -- fetched by the API today but never shown anywhere
 * in the old UI. Reuses Sheet rather than a new primitive: same dismiss behavior
 * (backdrop/Esc/close button), no new component surface for one read-only block. */
export function RulesTextPopover({ open, onClose, title, rulesText }: RulesTextPopoverProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Text as="p" variant="body" color="muted">
        {rulesText}
      </Text>
    </Sheet>
  )
}
