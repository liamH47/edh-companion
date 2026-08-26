# Portability rules

The strategy: **all logic and all tokens are platform-free; only leaf views are web-shaped.**

## The boundary is enforced, not just documented

Platform-free code lives in the `@mtg/core` package, whose tsconfig **omits `lib: ["DOM"]`**.
So `window`, `document`, `localStorage` and `navigator` do not compile there — reaching for
one is a build error, not a code-review note.

What core *is* allowed is declared by hand in `packages/core/src/runtime.d.ts`: the globals
every target runtime genuinely has (`fetch`, `AbortController`, `setTimeout`,
`structuredClone`). That file is the line between "universally available" and "web-shaped",
written down and mechanical.

Anything genuinely platform-specific goes behind a **seam** — a settable backend with an
inert default, which the host app fills in at startup:

| Seam | Web supplies | React Native will supply |
|---|---|---|
| `setStorageBackend` | `localStorage` | MMKV (sync, so hooks can still read during render) |
| `setReducedMotionSource` | `matchMedia` | a cached `AccessibilityInfo` value |
| `setHapticsBackend` | `navigator.vibrate` | `expo-haptics` |
| `setSoundBackend` | `new Audio(url)` | `expo-audio` with bundled assets |
| `setComputeBackend` | the card API | the same, or local compute |

They are settable module-level singletons rather than React context, because the callers
include plain module-level functions a context cannot reach. `apps/web/src/platform.ts` is
the whole web side; the native equivalent will be the same shape.

## Layer boundaries

| Layer | Location | React Native port cost |
|---|---|---|
| Card logic, hooks, storage, tokens | `packages/core/` | Zero — imported unchanged |
| Domain components (`HeroStat`, `SetupSheet`, ...) | `apps/web/src/cards/` | Prop shapes identical; swap the primitives they import |
| Primitives (`Surface`, `Text`, `Button`, ...) | `apps/web/src/ui/` | Rewritten (~11 small files) |
| App shell, navigation, entry point | `apps/web/src/` | Rewritten against Expo Router |

If you're writing logic (a hook, a pure function, a data transform), it belongs in
`packages/core` — and the compiler will tell you if it isn't platform-free. If you're writing
a leaf view, it belongs in `apps/web/src/ui/` or `apps/web/src/cards/` and should do layout
only.

## Banned in `src/ui/` and `src/cards/`

No React Native equivalent, or a painful one:

- `display: grid` (CSS Grid) — use flexbox row/column.
- `<details>` / `<summary>` — use `Sheet` or a controlled expand/collapse.
- `<select>` — use `Toggle` (2 options) or a custom picker list.
- `<input type="checkbox">` / `<input type="radio">` — use `Toggle`.
- `position: sticky` — use an absolutely/fixed-positioned bar instead.
- `::before` / `::after` generated content — render a real element.
- `box-shadow` for structural elevation — use a `surface`/`surfaceRaised` tint
  (`Surface`'s `level` prop). Shadows are fine for one-off decorative touches, not layout.
- CSS `gap` on non-flex/grid containers.
- Percentage heights, `vh`/`vw` units — use flex sizing or fixed values from `spacing`.
- CSS transitions/animations on any property except `opacity` and `transform`.

> **The shell is the one exception to the viewport-unit ban.** `App.tsx` sets `min-h-dvh`
> (and `h-dvh` on the card route, so `CardScreen` can divide it into a static header, a
> scrolling middle and a pinned `ActionBar`). Some element has to establish the viewport's
> height before flex can divide it, and the shell is the layer `docs/roadmap.md` already
> lists as "rewritten against Expo Router" — there it becomes `SafeAreaView flex:1`. The
> ban still applies with no exceptions inside `src/ui/` and `src/cards/`.
>
> Use `dvh`, never `vh`: on iOS Safari `100vh` is the *large* viewport, 60–110px taller
> than what is on screen with the URL bar showing. While every screen was top-aligned that
> only padded invisible space; the moment a layout divides that height, `vh` puts pinned
> bottom content underneath the browser chrome.

## Use instead

- Flexbox row/column (`flex flex-col`/`flex-row`) with `gap-*` from the spacing scale.
- `Sheet` for anything modal/collapsible.
- `Toggle` for binary choice, a custom list for >2 options.
- `Pressable` for any custom-shaped tap target.
- `env(safe-area-inset-bottom)` padding on bars pinned to the screen edge (the action bar, tab
  bar) — RN's `SafeAreaView` solves the same problem.

## Icons

Hand-write icons as `<svg><path>/<circle>` only (see `src/ui/Icon.tsx`) — no icon font, no
sprite sheet. The same JSX compiles under `react-native-svg` (`Svg`/`Path`/`Circle`) with a
mechanical element-name swap.

## Frame-driven animation

The transitions rule above bans CSS animation on properties other than `opacity` and
`transform` because React Native cannot animate the rest. A **JS-driven per-frame
redraw** -- `requestAnimationFrame` or a timer updating SVG attributes such as polygon
`points` -- is not a CSS transition and is not banned: it is the correct tool for
properties CSS cannot animate at all, and it maps directly onto `Animated`/Reanimated
driving an SVG or Skia redraw on the native side. `requestAnimationFrame` is a shared
global on both platforms (RN polyfills it), so it needs no seam; call it directly from
the leaf component, the way `setTimeout` already is. Keep the *math* that produces each
frame in `packages/core` (see `dice3d/`) so the loop body stays a dumb sampler.

## Numbers

Never hardcode a number that means "the minimum tap target" or "how long this animation runs" —
import `hitTarget` / `motion` from `theme/tokens.ts`. This is what keeps a later RN port's
`StyleSheet` values in lockstep with the web build.

## Checklist for a new component

1. Does it need `window`/`document`/`localStorage`? If yes, does that live in
   `src/core/platform/*.web.ts` behind a small interface, not inline?
2. Does its layout use only flexbox, explicit `gap`, and fixed/`Dimensions`-style sizing?
3. Does every interactive element hit 48×48px minimum?
4. Does every color/spacing/radius/type value come from a token utility or `tokens.ts`, never a
   hardcoded hex/px?
5. Would swapping every `<div>`/`<span>`/`<button>` for `View`/`Text`/`Pressable` and every
   Tailwind class for an equivalent `StyleSheet` rule "just work" with no logic change?

If the answer to #5 is no, the component is doing something a primitive should be doing instead.
