import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/Button'
import { Text } from './ui/Text'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Last line of defense. A render error anywhere below here would otherwise take the
 * whole app to a blank white screen -- the worst possible outcome mid-tournament, with
 * no way back. Storage writes are already guarded in core (storage.ts); this catches
 * the unexpected rest and offers a recover button instead of a dead page.
 *
 * A class component because that is the only React API that can catch a render error --
 * the same API (getDerivedStateFromError/componentDidCatch) exists in React Native, so
 * this ports unchanged.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No remote logging in this app, so the console is where a developer sees it.
    console.error('Unhandled render error:', error, info)
  }

  handleReset = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
          <Text as="h1" variant="title">
            Something went wrong
          </Text>
          <Text variant="body" color="muted">
            The app hit an unexpected error. Anything you&apos;ve saved on this device is
            still here.
          </Text>
          <Button onClick={this.handleReset}>Try again</Button>
        </main>
      )
    }
    return this.props.children
  }
}
