# TopBandSummary Consolidation — Design

**Date:** 2026-05-12
**Status:** Approved (brainstorm)
**Scope:** Refine the unified top-band card so `DegreeChipStrip` and `ChordPracticeBar` read as two coherent regions of one card. Replace inline eye SVGs with lucide icons. Smooth all collapse transitions so the card never produces an abrupt layout jump.

## Context

`a52e98d feat(layout): merge summary and chord dock into unified top-band card` introduced `src/components/TopBandSummary/`, which renders `DegreeChipStrip` and (conditionally) `ChordPracticeBar` inside a single card. The card already suppresses child surface fills via `--strip-bg-override` cascading, so the two sections sit on one continuous surface — but several rough edges remain:

- Each section ships its own inline `EyeOpenIcon` / `EyeClosedIcon` SVG component, duplicated in three files.
- `DegreeChipStrip`'s `headerAction` slot (eye-toggle left, title text right) reads cleaner than `ChordPracticeBar`'s header.
- Headers are vertically heavy; the two stacked headers eat space.
- No visual seam between sections — when both are present they blur together.
- The chord section mount/unmount already animates, but **internal eye toggles** (scaleVisible inside DegreeChipStrip; chordOverlayHidden inside ChordPracticeBar) snap, producing abrupt height jumps.

## Goals

1. Both section headers share one visual pattern and one source of truth.
2. All eye icons render via `lucide-react` (`Eye`, `EyeOff`).
3. Headers are tighter (smaller font, smaller icon).
4. A subtle inset divider separates the chord section from the chip strip — and animates in/out with the chord section so it never orphans.
5. Every collapse (outer chord mount, inner eye toggle) animates smoothly.

## Non-Goals

- No change to chord-bar visibility logic (`showChordPracticeBarAtom`).
- No change to scale/chord domain separation, lens registry, or role/color tokens.
- No structural refactor of `DegreeChipStrip` or `ChordPracticeBar` beyond what's listed below.
- No `prefers-reduced-motion` overrides (rely on `motion/react` defaults).

## Design

### 1. Shared header pattern

Add `.card-section-header` to `src/components/shared/shared.module.css`:

```css
.card-section-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.4rem;
  width: 100%;
  font-family: var(--font-sans);
  font-size: var(--strip-header-size, 0.82rem);
  font-weight: var(--font-weight-medium);
  color: var(--text-main);
  line-height: 1.15;
  letter-spacing: 0.01em;
  flex-wrap: wrap;
}
```

Both `DegreeChipStrip.module.css` and `ChordPracticeBar.module.css` `composes:` this on their existing header classes. Each module retains only the rules that are genuinely local (chord bar's badge/lens-label slots; DegreeChipStrip's `data-has-action` legacy path is dropped — the shared rule handles it).

The header in `DegreeChipStrip` always renders the `headerAction` (eye) left, then the title text. `ChordPracticeBar` follows the same order: eye → title → lens-label → badge.

### 2. Lucide icons

Replace the three duplicated `EyeOpenIcon` / `EyeClosedIcon` components in:

- `src/components/TopBandSummary/TopBandSummary.tsx`
- `src/components/ChordPracticeBar/ChordPracticeBar.tsx`

with:

```tsx
import { Eye, EyeOff } from "lucide-react";
// …
{open ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
```

Size `16` (down from `18`) tightens the header rhythm. `aria-hidden` keeps the button's existing `aria-label` ("Show scale" / "Hide scale" / "Toggle visibility of chord overlay") as the sole accessible name.

### 3. Divider

Rendered as `::before` on `.chord-section` inside `TopBandSummary.module.css`, so it lives inside the `motion.div` and collapses with the chord bar:

```css
.chord-section { width: 100%; }

.chord-section::before {
  content: "";
  display: block;
  height: 1px;
  margin: 0 0.85rem;
  background: var(--chrome-border);
  opacity: 0.6;
}
```

Inset of `0.85rem` matches the card's horizontal padding so the line reads as a structural seam rather than a full-width cut. The `motion.div`'s `overflow: hidden` during the height tween hides the line while collapsing.

### 4. Internal collapse animations

Wrap each section's collapsible region in `AnimatePresence` + `motion.div`/`motion.ul`, mirroring the recipe already used in `TopBandSummary` for `.chord-section`.

**`DegreeChipStrip.tsx`** — wrap `.degree-chip-strip-list`:

```tsx
<AnimatePresence initial={false}>
  {visible && (
    <motion.ul
      key="chip-list"
      className={styles['degree-chip-strip-list']}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      {/* chip items */}
    </motion.ul>
  )}
</AnimatePresence>
```

**`ChordPracticeBar.tsx`** — wrap `.chord-practice-bar-groups-container`:

```tsx
<AnimatePresence initial={false}>
  {!collapsed && (
    <motion.div
      key="groups"
      className={styles['chord-practice-bar-groups-container']}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      {/* groups */}
    </motion.div>
  )}
</AnimatePresence>
```

The parent strip's `gap` collapses automatically when the child unmounts, so headers don't leave phantom space.

### 5. Card-level smoothing

Add to `.top-band-summary`:

```css
transition:
  box-shadow var(--transition-fast),
  border-color var(--transition-fast);
```

The card's height tracks children naturally (flex column, no fixed height); the child motion wrappers own the height tween. The transition above only smooths elevation/border response to theme changes — not height.

## Files Touched

| File | Change |
|---|---|
| `src/components/shared/shared.module.css` | Add `.card-section-header` |
| `src/components/TopBandSummary/TopBandSummary.tsx` | Import lucide `Eye`/`EyeOff`; remove local SVG components |
| `src/components/TopBandSummary/TopBandSummary.module.css` | Add `.chord-section::before`; add card transition |
| `src/components/DegreeChipStrip/DegreeChipStrip.tsx` | Wrap list in `AnimatePresence` + `motion.ul` |
| `src/components/DegreeChipStrip/DegreeChipStrip.module.css` | `composes: card-section-header`; trim local header rules |
| `src/components/ChordPracticeBar/ChordPracticeBar.tsx` | Import lucide `Eye`/`EyeOff`; remove local SVGs; wrap groups in `AnimatePresence` + `motion.div` |
| `src/components/ChordPracticeBar/ChordPracticeBar.module.css` | `composes: card-section-header`; trim local header rules |

## Test Impact

**Unit tests** (`DegreeChipStrip.test.tsx`, `ChordPracticeBar.test.tsx`, `ChordOverlayDock.test.tsx`):

- Any queries that pierced inline SVG markup (`data-icon="eye-open"`, `<path>` selectors) move to button `aria-label` queries ("Show scale" / "Hide scale" / "Toggle visibility of chord overlay") — these labels already exist on the buttons today.
- Motion wrappers don't change visible content in jsdom once mounted; existing `getByRole` / `queryByText` assertions continue to work. Watch for any assertion that depended on the `<svg>` being a direct child of the button — lucide adds a wrapper.

**Visual regression** (`e2e/app-overlays`, `e2e/app-components`):

- Header font drop (1.05rem → 0.82rem baseline) + icon size drop (18px → 16px) + divider will produce diffs.
- Plan a `npm run test:visual:update` (darwin) at the end of implementation, then `npm run test:visual:update:linux` for cross-platform.

**Required pre-PR**: `npm run lint`, `npm run test`, `npm run build`, plus visual regression refresh.

## Risk / Rollback

- All changes are scoped to four components + one shared CSS file. Rollback is `git revert` of the implementation commits.
- The motion wrappers reuse a pattern already proven in `TopBandSummary.tsx` (chord-section mount), so behavior is well-understood.
- `lucide-react` is already a dependency used app-wide; no new bundle cost beyond the two new icon imports (tree-shaken).
