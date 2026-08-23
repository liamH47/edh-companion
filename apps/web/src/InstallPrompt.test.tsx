import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallPrompt } from './InstallPrompt'

function mockDisplayMode(standalone: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: standalone && query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

function mockUserAgent(ua: string) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua)
}

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

class FakeBeforeInstallPromptEvent extends Event {
  prompt = vi.fn(() => Promise.resolve())
  userChoice = Promise.resolve({ outcome: 'accepted' as const })
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    mockDisplayMode(false)
    mockUserAgent(DESKTOP_UA)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when already running standalone', () => {
    mockDisplayMode(true)
    render(<InstallPrompt />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing on a desktop browser that has not offered beforeinstallprompt', () => {
    render(<InstallPrompt />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an install button after beforeinstallprompt fires, and prompts on click', async () => {
    const user = userEvent.setup()
    render(<InstallPrompt />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    const event = new FakeBeforeInstallPromptEvent('beforeinstallprompt', { cancelable: true })
    window.dispatchEvent(event)

    const button = await screen.findByRole('button', { name: 'Install app' })
    await user.click(button)
    expect(event.prompt).toHaveBeenCalledOnce()

    // The captured event is single-use; the button disappears once its choice resolves.
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
  })

  it('hides the install button once appinstalled fires', async () => {
    render(<InstallPrompt />)
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    await screen.findByRole('button', { name: 'Install app' })

    window.dispatchEvent(new Event('appinstalled'))
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
  })

  it('offers the manual Add to Home Screen steps on iOS, where no install event exists', async () => {
    mockUserAgent(IOS_UA)
    const user = userEvent.setup()
    render(<InstallPrompt />)

    const button = await screen.findByRole('button', { name: 'Install app' })
    await user.click(button)
    expect(screen.getByRole('dialog', { name: 'Add to Home Screen' })).toBeInTheDocument()
    expect(screen.getByText(/open the Share menu/)).toBeInTheDocument()
  })

  it('remembers the iOS hint was seen, and does not show it again', async () => {
    mockUserAgent(IOS_UA)
    const user = userEvent.setup()
    const { unmount } = render(<InstallPrompt />)

    const button = await screen.findByRole('button', { name: 'Install app' })
    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(localStorage.getItem('mtg-calc-install-hint-dismissed')).toBe('true')

    unmount()
    render(<InstallPrompt />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
