# Theme-Adaptive DAW Faceplate Design

**Date:** 2026-05-15

**Status:** Active. Corrective design pass that arose mid-execution of DAW Shell Phase 4.

## 1. Background

The DAW Shell redesign gives FretFlow's control panels a "DAW faceplate" look. Phase 2/3
shipped the `Inspector` with a hardcoded navy substrate (`#0a121d`), a cyan radial wash,
a cyan hairline border, and cyan-underlined active tabs. Phase 4 (in progress on branch
`claude/daw-shell-phases-4-7`) reskinned `TopBandSummary` with the same hardcoded navy
recipe.

**The bug this design fixes:** the navy substrate is applied unconditionally, in both the
`modern-light` and `modern-dark` app themes. `TopBandSummary` sets
`--strip-bg-override: transparent`, so its children (the degree chip strip, the chord
practice bar) render their text directly on the substrate. In light theme those children
use the light palette — near-black text (`--text-main` ≈ `#0f172a`) — which lands on the
navy substrate and is effectively unreadable. The `Inspector` has the same latent issue:
in light theme its section/tab labels sit low-contrast on navy (its leaf controls happen
to paint their own light surfaces, which masks the worst of it).

The Phase 4 work also left two test files red (`e2e/theme-contract.spec.ts` asserts the
old light card surface for `top-band-summary`; `src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`
has four tests for a progression-status block Phase 4 deleted). Both are folded into this
design pass — see §6.

## 2. Decision

The DAW faceplate is a **theme-adaptive panel**, not a fixed dark "hardware" surface. It
is navy/cyan in `modern-dark` and a pale, faintly cool-tinted equivalent in
`modern-light`, keeping the cyan accent identity in both. The faceplate styling is shared
by the `Inspector` and `TopBandSummary` through one set of theme-aware tokens and one
shared CSS class.

Because the substrate now follows the app theme, the faceplate's children can keep using
the normal theme tokens — light text never lands on a navy panel and vice versa. No
per-child token scoping is required; making the substrate theme-aware is the fix.

## 3. Goals and Non-Goals

### Goals
- The faceplate (Inspector + TopBandSummary) is legible and visually coherent in both
  `modern-light` and `modern-dark`.
- One shared, theme-aware definition of the faceplate — no duplicated recipe, no
  hardcoded navy.
- Unblock the Phase 4 branch: the full quality gate (`lint`, `test`, `build`,
  `test:e2e:production`, `test:visual`) passes after this work.

### Non-Goals
- No change to the faceplate's *layout* (sizes, spacing, tab structure) — only its
  surface treatment becomes theme-aware.
- No change to faceplate child components (`DegreeChipStrip`, `ChordPracticeBar`, leaf
  controls) — they already consume theme tokens correctly.
- No new faceplate surfaces beyond the two that exist (Inspector, TopBandSummary). Phase
  6's future `TransportBar` may adopt the shared class later; that is out of scope here.

## 4. Faceplate Tokens

A theme-aware token set is added to `src/styles/semantic.css`, defined under both
`[data-theme="modern-dark"]` and `[data-theme="modern-light"]` (and given safe defaults
in `:root` equal to the dark values). The token CSS already uses bare
`[data-theme="…"]` attribute selectors, so these resolve correctly.

| Token | `modern-dark` | `modern-light` |
|---|---|---|
| `--faceplate-bg` | `#0a121d` | faint cool-tinted pale, approx `#eef3f6` |
| `--faceplate-bg-elevated` | `#0d1726` | approx `#f5f9fb` |
| `--faceplate-wash` | `rgb(77 228 255 / 0.04)` | `rgb(46 181 204 / 0.05)` |
| `--faceplate-border` | `rgb(77 228 255 / 0.12)` | `rgb(46 181 204 / 0.35)` |
| `--faceplate-shadow` | `0 1px 0 rgb(255 255 255 / 0.02) inset, 0 18px 40px -28px rgb(0 0 0 / 0.7)` | `0 1px 0 rgb(255 255 255 / 0.6) inset, 0 12px 28px -22px rgb(0 0 0 / 0.25)` |
| `--faceplate-accent` | `#4DE4FF` (`--neon-cyan`) | `#2EB5CC` (`--neon-cyan-dim`) |
| `--faceplate-accent-glow` | `var(--glow-cyan-sm)` (neon halo) | a softened soft shadow, approx `0 0 4px rgb(46 181 204 / 0.30)` |

Exact light-mode hex values are finalized during implementation against the existing
light surface ladder; the values above are the design intent (cool-tinted pale substrate,
dimmer-cyan accent, softer-but-present glow, lighter drop shadow). The accent uses the
already-defined `--neon-cyan` / `--neon-cyan-dim`.

## 5. Shared Faceplate Class and Component Changes

### 5a. Shared `.faceplate` class
A `.faceplate` class is added to `src/components/shared/shared.module.css`. It composes
the full surface recipe from the tokens in §4:

- `background`: the `--faceplate-wash` radial gradient layered over a
  `linear-gradient(180deg, --faceplate-bg-elevated, --faceplate-bg)`.
- `border: 1px solid var(--faceplate-border)`.
- `border-radius: 12px`.
- `box-shadow: var(--faceplate-shadow)`.

It carries only the surface treatment — no layout. Consumers add their own layout rules.

### 5b. `Inspector.module.css` / `Inspector.tsx`
- `.root` drops the hardcoded `--inspector-bg` / `--inspector-bg-elevated` /
  `--inspector-border` locals and the inline navy `background` / `border` / `box-shadow`.
  It applies the shared `.faceplate` (via CSS Modules `composes:` from
  `shared.module.css`, or by the component adding `shared.faceplate` to its className) and
  keeps its own layout rules (flex, gap, padding).
- The `.tab` active-state styling changes its `var(--neon-cyan…)` and `var(--glow-cyan-sm)`
  references to `var(--faceplate-accent)` and `var(--faceplate-accent-glow)` so the
  active-tab underline, active-tab text, and focus outline track the theme-aware accent.

### 5c. `TopBandSummary.module.css` / `TopBandSummary.tsx`
- `.top-band-summary` drops the Phase 4 hardcoded navy recipe (`--topband-*` locals and
  the inline navy `background` / `border` / `box-shadow`). It applies the shared
  `.faceplate` and keeps its layout rules (flex, centering, width, `transition`) and the
  `--strip-*-override` / `--strip-radius` custom properties.

### 5d. Data flow
Purely presentational. No new atoms, no new props, no behavior change. The only runtime
input is the existing `data-theme` attribute on `documentElement`, which already drives
every other themed token.

## 6. Folded-in Phase 4 fixes

This design pass also resolves the two red test files left by Phase 4:

- **`e2e/theme-contract.spec.ts`** — roughly six assertions require `top-band-summary`'s
  background to be the old light card surface (`rgb(252,249,245)`). They are rewritten to
  the new contract: in `modern-light` the faceplate substrate resolves to the light
  faceplate token, in `modern-dark` to the navy token; the strip children remain
  transparent over it. Inspector faceplate coverage is added where it fits naturally.
- **`src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`** — the four tests in the
  `describe("TopBandSummary chord integration")` block that assert the removed
  `Progression status` group (`shows read-only current and next…`, `wraps next…`,
  `shows a sane blocked status…`, `shows the active step unavailable reason…`) are
  deleted, along with the now-unused `activeProgressionStepIndexAtom` import. The
  remaining tests in that file (practice bar, degree strip, a11y, "does not render
  transport controls") stay.
- Playwright visual baselines (darwin + linux) are refreshed — the Inspector now also
  changes appearance in `modern-light`.

## 7. Testing

- **Unit:** existing `Inspector`, `ViewTab`, `TopBandSummary` tests must still pass. The
  `ChordOverlayDock.test.tsx` cleanup above. CSS-token changes are not unit-tested
  directly.
- **Theme contract (e2e):** `theme-contract.spec.ts` updated per §6 — it is the
  authoritative guard that the faceplate substrate is the correct token in each theme and
  that child strips stay transparent over it.
- **Visual regression:** refresh darwin + linux baselines for every suite that captures
  the Inspector or TopBandSummary (`app-layout`, `app-mobile`, `app-overlays`,
  `inspector`, `progression`, and the light-mode variants). Eyeball each: in light mode
  the faceplate is a pale cool panel with a dimmer-cyan border and readable child text;
  in dark mode it is unchanged navy.
- **Quality gate:** after this work, `npm run lint`, `npm run test`, `npm run build`,
  `npm run test:e2e:production`, and `npm run test:visual` all pass.

## 8. Sequencing

This work lands on the existing `claude/daw-shell-phases-4-7` branch, on top of the six
Phase 4 commits. Completing this design pass is what makes the Phase 4 branch mergeable;
the branch is finished only after the §7 quality gate passes.
