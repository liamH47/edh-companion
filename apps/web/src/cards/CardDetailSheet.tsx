import type { CardMetadata } from '@mtg/core'
import { Text } from '../ui/Text'
import { Sheet } from '../ui/Sheet'
import { CardImage } from './CardImage'

interface CardDetailSheetProps {
  open: boolean
  onClose: () => void
  card: CardMetadata
}

/**
 * The card itself: its printed image, with the verbatim Oracle text underneath.
 *
 * Was `RulesTextPopover`, which showed only the text. The image goes above rather than
 * replacing it for two reasons -- the text is the half that works offline, and it stays
 * selectable and readable by a screen reader in a way a picture of it never is.
 *
 * Reuses `Sheet` rather than adding a primitive: same dismiss behaviour (backdrop, Esc,
 * close button) for what is still one read-only block.
 */
export function CardDetailSheet({ open, onClose, card }: CardDetailSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={card.name}>
      <div className="flex flex-col gap-4">
        <CardImage card={card} />
        <Text as="p" variant="body" color="muted">
          {card.rules_text}
        </Text>
      </div>
    </Sheet>
  )
}
