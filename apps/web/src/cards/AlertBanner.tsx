import { Surface } from '../ui/Surface'
import { Text } from '../ui/Text'

interface AlertBannerProps {
  message: string | null
  /** "danger" reads as a loss; "success" (a dungeon completed) reads as the payoff --
   * accent-muted surface, accent text. Defaults to danger for safety: a mislabeled
   * loss is worse than a mislabeled win. */
  tone?: 'danger' | 'success' | null
}

/** Renders `card.alert.message` when active (screen-spec.md rule 7); renders
 * nothing when there's no active alert, including cards that declare none at all --
 * `message` is expected pre-resolved to null in that case (see resolveAlertMessage). */
export function AlertBanner({ message, tone = 'danger' }: AlertBannerProps) {
  if (!message) return null

  if (tone === 'success') {
    return (
      <div role="alert" className="rounded-lg bg-accent-muted p-4 text-center">
        <Text variant="bodyStrong" className="text-accent">
          {message}
        </Text>
      </div>
    )
  }
  return (
    <Surface tone="danger" radius="lg" role="alert" className="text-center">
      <Text variant="bodyStrong" color="danger">
        {message}
      </Text>
    </Surface>
  )
}
