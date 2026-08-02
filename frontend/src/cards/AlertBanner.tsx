import { Text } from '../ui/Text'

interface AlertBannerProps {
  message: string | null
}

/** Renders `card.alert.message` when active (screen-spec.md rule 7); renders
 * nothing when there's no active alert, including cards that declare none at all --
 * `message` is expected pre-resolved to null in that case (see resolveAlertMessage). */
export function AlertBanner({ message }: AlertBannerProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-center"
    >
      <Text variant="bodyStrong" color="danger">
        {message}
      </Text>
    </div>
  )
}
