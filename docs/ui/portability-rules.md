# Portability rules

The strategy: **all logic and all tokens are platform-free; only leaf views are web-shaped.**
This is the checklist for every PR that touches `frontend/src/`.

## Layer boundaries

| Layer | Directory | React Native port cost |
|---|---|---|
| Card logic, hooks, storage, api, tokens | `src/core/`, `src/theme/tokens.ts` | Zero — copied verbatim |
| Domain components (`HeroStat`, `SetupSheet`, ...) | `src/cards/` | Prop shapes identical; swap the primitives they import |
| Primitives (`Surface`, `Text`, `Button`, ...) | `src/ui/` | Rewritten (~10 small files) |
| Platform shims (`*.web.ts`) | `src/core/platform/`, `src/core/navigation/history.web.ts` | Rewritten (a handful of files) |

If you're writing logic (a hook, a pure function, a data transform), it belongs in `src/core/`
and must not import React DOM, `window`/`document` unconditionally, or any `src/ui` component.
If you're writing a leaf view, it belongs in `src/ui/` or `src/cards/` and should do layout only
— push calculation into `src/core/`.

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
