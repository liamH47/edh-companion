import { useEffect, useState } from 'react'
import { getItem, setItem } from '@mtg/core'
import { InstallIcon } from './ui/Icon'
import { Sheet } from './ui/Sheet'
import { Text } from './ui/Text'

const DISMISSED_KEY = 'mtg-calc-install-hint-dismissed'

/** Chrome/Android/desktop fire this before showing their own install UI; capturing it
 * and calling `.prompt()` ourselves is the only way to offer install from inside the
 * app's own chrome instead of leaving it to a menu item most people never find. Not in
 * the DOM lib -- no browser has shipped this as a standard event. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  // iOS Safari has no `display-mode` media query support before its own standalone
  // launch, hence the second, iOS-specific check.
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * The app's own "Install" affordance, next to the theme/sound toggles. Two unrelated
 * browsers, one slot: Chrome/Android/desktop fire `beforeinstallprompt`, which this
 * captures and replays on tap; iOS Safari fires no such event at all, so there the same
 * icon opens a Sheet with the manual "Add to Home Screen" steps instead. Renders
 * nothing once installed, and nothing on a browser that offers neither path (there is
 * nothing useful this component could do there).
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [iosSheetOpen, setIosSheetOpen] = useState(false)

  useEffect(() => {
    if (installed) return
    if (isIOS()) {
      setShowIOSHint(getItem(DISMISSED_KEY) !== 'true')
      return
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [installed])

  if (installed) return null

  if (deferredEvent) {
    const install = async () => {
      await deferredEvent.prompt()
      // Whatever the outcome, this exact event object can only be prompted once --
      // the browser fires a fresh one on a later visit if still not installed.
      await deferredEvent.userChoice
      setDeferredEvent(null)
    }
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Install app"
        className="min-h-12 min-w-12 rounded-full border border-border text-text-muted hover:bg-surface-raised hover:text-text"
      >
        <InstallIcon className="mx-auto h-5 w-5" />
      </button>
    )
  }

  if (showIOSHint) {
    const dismiss = () => {
      setItem(DISMISSED_KEY, 'true')
      setShowIOSHint(false)
      setIosSheetOpen(false)
    }
    return (
      <>
        <button
          type="button"
          onClick={() => setIosSheetOpen(true)}
          aria-label="Install app"
          className="min-h-12 min-w-12 rounded-full border border-border text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <InstallIcon className="mx-auto h-5 w-5" />
        </button>
        <Sheet open={iosSheetOpen} onClose={dismiss} title="Add to Home Screen">
          <Text variant="body" color="muted">
            Safari doesn&apos;t offer an in-app install button, but the same result is
            two taps away: open the Share menu, then choose &quot;Add to Home
            Screen&quot;. The app opens full-screen from your home screen after that,
            works offline, and needs no App Store visit.
          </Text>
        </Sheet>
      </>
    )
  }

  return null
}
