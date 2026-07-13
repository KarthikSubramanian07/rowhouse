# @rowhouse/ui

The Rowhouse design system.

> The visual language of a dark cinema room: high-contrast, mono-inflected, and
> developer-grade.

React 19 components plus Tailwind CSS v4 (CSS-first `@theme`) design tokens,
consumed by the Astro site via React islands. Source-exported: the app bundles
it directly (no build step here).

## Install / consume

```ts
// Components
import { Button, TimeCode, SyncLock, Waveform } from '@rowhouse/ui';

// Styles - import ONCE near the app root
import '@rowhouse/ui/styles.css';
```

`styles.css` pulls in, in order: `tailwindcss`, then `tokens.css` (raw design
tokens), then `fonts.css` (self-hosted `@font-face`), then `theme.css` (the
Tailwind v4 `@theme` that maps tokens into utilities). Everything is
self-contained: **no external network calls, all fonts self-hosted** (Cloudflare
Pages friendly).

---

## Design tokens

Tokens live as CSS custom properties in `src/styles/tokens.css` (the single
source of truth) and are mapped into Tailwind's `@theme` in `src/styles/theme.css`,
which generates the `bg-*`, `text-*`, `border-*`, `rounded-*`, `font-*` utilities
the components use. Use the utilities in components, or the raw `var(--token)` in
hand-written CSS / canvas code.

### Color

| Token | Value | Utility | Meaning |
| --- | --- | --- | --- |
| `--bg` | `#0B0B0D` | `bg-bg` | Near-black, faintly cool. Page background. |
| `--surface` | `#131317` | `bg-surface` | Cards, panels. |
| `--surface-2` | `#17171C` | `bg-surface-2` | Raised surfaces, menus, inputs. |
| `--border` | `#24242B` | `border-border` | Hairlines. |
| `--text-hi` | `#F2F0EC` | `text-text-hi` | Primary text: warm off-white, **never pure `#fff`**. |
| `--text-mid` | `#9E9EA7` | `text-text-mid` | Secondary text. |
| `--text-dim` | `#64646D` | `text-text-dim` | Tertiary / meta. |
| `--accent` | `#E0362E` | `bg-accent` / `text-accent` | **The single brand accent, cinema red.** live/REC, primary action, focus rings. Nothing else. |
| `--accent-hi` | `#FF5B54` | `text-accent-hi` | Accent hover / emphasis. |
| `--locked` | `#3DD68C` | `text-locked` | **Semantic status only:** the sync "locked" state. Never in chrome or branding. |
| `--react-fire` | `#FF7A45` | `text-fire` | Reaction: fire. |
| `--react-laugh` | `#F5C518` | `text-laugh` | Reaction: laugh. |
| `--react-cry` | `#4C8DFF` | `text-cry` | Reaction: cry. |
| `--react-shock` | `#B57BFF` | `text-shock` | Reaction: shock. |

Reaction colors are also exported as JS literals (`REACTION_COLORS`) because the
`<Waveform>` canvas needs real color strings at paint time.

### Radii & spacing

| Token | Value | Utility |
| --- | --- | --- |
| `--radius-1` | `4px` | `rounded-sm` |
| `--radius-2` | `8px` | `rounded-md` |
| `--radius-3` | `12px` | `rounded-lg` |

Spacing sits on a **4px grid** (`--spacing: 4px`), which is Tailwind v4's base
unit - every `p-*`, `gap-*`, `size-*` derives from it.

### Type scale

| Token | Size | Utility | Use |
| --- | --- | --- | --- |
| `--type-xs` | 12px | `text-xs` | Timecodes, meta, mono labels |
| `--type-sm` | 13px | `text-sm` | Secondary UI |
| `--type-base` | 15px | `text-base` | Body / default UI (a touch under 16px, dense) |
| `--type-md` | 17px | `text-md` | Emphasized body |
| `--type-lg` | 22px | `text-lg` | Section headings |
| `--type-xl` | 30px | `text-xl` | Card titles |
| `--type-2xl` | 40px | `text-2xl` | Page titles |
| `--type-display` | 64px | `text-display` | Fraunces hero / film titles |

### Motion

Motion is minimal and optional. **Every animation is guarded for
`prefers-reduced-motion`** (a global rule in `theme.css` zeroes them out). The
system has only two continuous motions:

- `animate-live-pulse`: the live/REC pulse (`LiveBadge`, sync dot).
- `animate-scan`: the sync-lock sweep (`SyncLock` listening state).

`animate-spin` (Spinner) is likewise guarded.

---

## Fonts

Self-hosted via `@fontsource-variable/*` (no CDN). Family vars are defined in
`fonts.css` (`--rh-font-*`) and mapped to Tailwind's `--font-*` namespace.

| Role | Font | Package | Utility | Notes |
| --- | --- | --- | --- | --- |
| **Display** | **Fraunces Variable** | `@fontsource-variable/fraunces` | `font-display` | Editorial cinematic serif. **Film titles and hero moments only.** |
| **UI / body** | **Geist Variable** | `@fontsource-variable/geist` | `font-sans` | Developer-grade sans. The default. |
| **Mono** | **Geist Mono Variable** | `@fontsource-variable/geist-mono` | `font-mono` | **Timecodes and data readouts.** |

Rationale: Geist and Geist Mono are a matched pair and both ship as variable
fontsource packages, so the UI and its mono readouts stay in one voice. Fraunces
provides an editorial serif for film titles, reserved for display use.

---

## Components

Behavior comes from `radix-ui` primitives; variants from `tailwind-variants`;
icons from `lucide-react`; toasts from `sonner`. Everything is keyboard
accessible with `focus-visible` rings in the cinema-red accent.

### Signature

#### `TimeCode`
Mono, tabular figures (digits never jitter). Formats via `formatTimecode` from
`@rowhouse/types` into `1:23:14` / `4:07`.

| Prop | Type | Notes |
| --- | --- | --- |
| `seconds` | `number` | Position to format. |
| `className?` | `string` | |

#### `SyncLock`
An instrument panel, not a spinner.

- `idle`: quiet, muted `--:--` readout.
- `listening`: an oscilloscope-like sweep scans for the position. Reduced-motion
  collapses the sweep to a static `listening...`.
- `locked`: resolves to the `--locked` green: the big mono `TimeCode` plus a
  confidence readout. A resync button stays visible (precision tuning, not
  failure).

| Prop | Type | Notes |
| --- | --- | --- |
| `status` | `'idle' \| 'listening' \| 'locked'` | |
| `positionSeconds?` | `number` | Shown when locked. |
| `confidence?` | `number` | `0..1`, rendered as `N% match`. |
| `onResync?` | `() => void` | Renders the always-visible resync control. |
| `className?` | `string` | |

#### `Waveform`
The async player centerpiece. Canvas-rendered commentary waveform with a
cinema-red playhead and reaction-marker dots clustered along the timeline. If no
`peaks` are given, a deterministic pattern is synthesized from the duration seed.
Click or arrow keys seek (`role="slider"`, left/right +/-5s, `shift` +/-30s,
`Home`/`End`). DPR-aware, redraws on resize.

| Prop | Type | Notes |
| --- | --- | --- |
| `durationSeconds` | `number` | |
| `positionSeconds` | `number` | Playhead position. |
| `peaks?` | `number[]` | Amplitudes `0..1`; synthesized if omitted. |
| `markers?` | `{ t; type: 'fire'\|'laugh'\|'cry'\|'shock'; count }[]` | Reaction clusters (`ReactionMarker[]`). Dot x = `t/duration`, color by type, radius by count. |
| `onSeek?` | `(seconds: number) => void` | Enables interaction; omit for a static display. |
| `className?`, `height?` | `string`, `number` | `height` default 72. |

#### `ReactionBar`
Fire / laugh / cry / shock buttons (`Flame`, `Laugh`, `Frown`, `Zap`). Each
flashes its own reaction color on press.

| Prop | Type | Notes |
| --- | --- | --- |
| `onReact?` | `(type: ReactionType) => void` | |
| `disabled?` | `boolean` | |
| `className?` | `string` | |

#### `LiveBadge`
Pulsing cinema-red `LIVE` pill (pulse guarded by reduced-motion).

| Prop | Type | Notes |
| --- | --- | --- |
| `label?` | `string` | Defaults to `LIVE`. |
| `className?` | `string` | |

#### `Wordmark` / `Logo`
`Wordmark` - the confident "Rowhouse" wordmark; the "ow" carries the accent
(`size`: `sm` `md` `lg`). `Logo` - a square SVG mark: a row of five seats, one
lit cinema-red (`size` px, `title` for a11y, `null` = decorative).

### Primitives

| Component | Notes |
| --- | --- |
| `Button` | `variant`: `primary` (accent) / `ghost` / `outline`; `size`: `sm` / `md`; `asChild` via Radix `Slot`. |
| `Badge` | `variant`: `default` / `accent` / `locked` / `outline`. Mono uppercase pill. |
| `Card` | `Card` (`raised?`) + `CardHeader` / `CardTitle` / `CardDescription` / `CardBody` / `CardFooter`. |
| `Avatar` | Radix Avatar, falls back from image to `fallback` (`src`, `alt`, `fallback`). |
| `Tabs` | `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` (Radix). Active = cinema-red underline. |
| `Dialog` | `Dialog` / `DialogTrigger` / `DialogContent` (`hideClose?`) / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogClose` (Radix, with overlay + `X`). |
| `Tooltip` | One-line `Tooltip` (`content`, `side`, `delayDuration`) or the raw `TooltipProvider` / `TooltipRoot` / `TooltipTrigger` / `TooltipContent`. |
| `DropdownMenu` | `DropdownMenu*` set - `Content` / `Item` / `CheckboxItem` / `Label` / `Separator` / `Group` (Radix). |
| `Input` | Text input with cinema-red focus ring (`invalid?`). |
| `Field` | Labeled field wrapper: `label`, `htmlFor`, `hint`, `error`, `required`. |
| `Spinner` | Minimal loader (`size`, `label`); spin guarded by reduced-motion. |
| `Toaster` / `toast` | Themed re-export of `sonner`. Mount `<Toaster />` once; fire `toast(...)`. |

`cn(...)` (clsx wrapper) and `button` / `badge` (`tailwind-variants` recipes) are
also exported for composition.

---

## Scripts

```bash
pnpm --filter @rowhouse/ui typecheck   # tsc --noEmit (strict)
```

TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
