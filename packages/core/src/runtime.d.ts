/**
 * The globals every JavaScript runtime this package targets actually has -- browsers,
 * Node 18+, and Hermes/React Native alike.
 *
 * Declared by hand rather than pulling in `lib: ["DOM"]`, which is the point: `window`,
 * `document`, `localStorage` and `navigator` stay *undeclared*, so reaching for one is
 * a compile error and the platform seams beside this file are the only way through.
 * This is the line between "universally available" and "web-shaped", made mechanical.
 */

declare function setTimeout(handler: () => void, timeout?: number): number
declare function clearTimeout(id: number | undefined): void

declare const console: { warn(...data: unknown[]): void; error(...data: unknown[]): void }

interface AbortSignal {
  readonly aborted: boolean
}

declare class AbortController {
  readonly signal: AbortSignal
  abort(): void
}

interface RequestInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
}

interface Response {
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  json(): Promise<unknown>
  text(): Promise<string>
}

declare function fetch(input: string, init?: RequestInit): Promise<Response>

declare function structuredClone<T>(value: T): T
