# Chord Voicings Card UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `stringSetOptionsAtom` honest (no implicit ALL fallback), hide the string-set picker in full mode, and replace the picker dropdown with a toggle bar mirroring the CAGED shape control.

**Architecture:** Three coordinated changes: (1) atom contract update so `effectiveStringSetAtom` is voicing-mode-aware and no `ALL_STRINGS_OPTION` is added to the chord-active options list; (2) gate the picker render on `voicing === "close" && hasActiveChord`; (3) swap `ChordStringSetPicker` (dropdown wrapper around `LabeledSelect`) for `ChordStringSetToggleBar` (toggle bar mirroring `FingeringPatternControls#shapeToggleBar`).

**Tech Stack:** TypeScript, Jotai, React (motion/react for button animations), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-27-chord-voicings-card-ux-design.md`

**Sequencing:** Must land AFTER the Lens Consolidation plan (`docs/superpowers/plans/2026-05-27-lens-consolidation.md`). That plan removes the Lens row; this plan grows the String Set Prop span from 2 to 9, which would wrap awkwardly if Lens still occupied span 5.

---

## File Structure

```
src/store/
├── chordOverlayAtoms.ts          # MODIFY: stringSetOptionsAtom no-chord branch
│                                 #         returns []; effectiveStringSetAtom
│                                 #         voicing-mode-aware
├── chordOverlayAtoms.test.ts     # MODIFY: atom contract tests
└── voicingFallbackAtoms.test.ts  # MODIFY: full-mode emergent bypass test
                                  #         (no production code change)

src/components/ChordOverlayControls/
├── ChordOverlayControls.tsx              # MODIFY: render gate +
│                                         #         span bump 2 → 9 +
│                                         #         swap to ToggleBar
├── ChordStringSetToggleBar.tsx           # CREATE: new toggle bar component
├── ChordStringSetToggleBar.test.tsx      # CREATE: component tests
├── ChordStringSetToggleBar.module.css    # CREATE (if needed beyond shared toggle-btn)
├── ChordStringSetPicker.tsx              # DELETE
└── ChordStringSetPicker.test.tsx         # DELETE

src/store/
└── voicingStringSets.ts          # MODIFY (optional): drop ALL_STRINGS_OPTION
                                  #         export if no remaining consumers
```

---

### Task 1: Atom contract — `stringSetOptionsAtom` returns `[]` for no-chord

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts:292-294` (no-chord branch)
- Test: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/store/chordOverlayAtoms.test.ts` and add inside the existing describe block for `stringSetOptionsAtom`:

```ts
it("returns an empty list when no chord is active", () => {
  const store = createStore();
  store.set(chordRootAtom, "C");
  store.set(chordTypeAtom, null); // explicit null
  expect(store.get(stringSetOptionsAtom)).toEqual([]);
});
```

(Adjust imports / atom-setup boilerplate per the file's existing patterns.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "returns an empty list when no chord is active"`
Expected: FAIL — atom currently returns `[ALL_STRINGS_OPTION]`.

- [ ] **Step 3: Update the no-chord branch**

In `src/store/chordOverlayAtoms.ts` line 294, replace:
```ts
if (!chordType) return [ALL_STRINGS_OPTION];
```
with:
```ts
if (!chordType) return [];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "returns an empty list when no chord is active"`
Expected: PASS.

- [ ] **Step 5: Verify no `ALL_STRINGS_OPTION` regression test exists asserting the old behavior**

Run: `grep -n "ALL_STRINGS_OPTION" src/store/chordOverlayAtoms.test.ts`
Expected: no test cases still asserting the no-chord branch returns `[ALL_STRINGS_OPTION]`. If any exist, delete them.

---

### Task 2: Atom contract — `effectiveStringSetAtom` is voicing-mode-aware

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts:379-387` (effectiveStringSetAtom body)
- Test: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Locate the current implementation**

Run: `grep -n "effectiveStringSetAtom" src/store/chordOverlayAtoms.ts`
Confirm current implementation (around line 379):
```ts
export const effectiveStringSetAtom = atom((get): readonly number[] => {
  const options = get(stringSetOptionsAtom);
  const stored = get(voicingStringSetAtom);
  const match = options.find((o) => o.id === stored);
  if (match && !match.disabled) return match.strings;
  // Fallback chain: first enabled option (if any), else ALL.
  const firstEnabled = options.find((o) => !o.disabled);
  return firstEnabled ? firstEnabled.strings : ALL_STRINGS_OPTION.strings;
});
```

- [ ] **Step 2: Write the failing tests**

Add to `src/store/chordOverlayAtoms.test.ts`:

```ts
describe("effectiveStringSetAtom (voicing-mode aware)", () => {
  it("returns all 6 strings in full mode regardless of stored window", () => {
    const store = createStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "maj"); // or whatever a valid chord type is
    store.set(voicingAtom, "full");
    store.set(voicingStringSetAtom, "0-1-2"); // a 3-string window
    expect(store.get(effectiveStringSetAtom)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("returns stored window's strings in close mode when option is enabled", () => {
    const store = createStore();
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "maj");
    store.set(voicingAtom, "close");
    store.set(voicingStringSetAtom, "0-1-2");
    // assume "0-1-2" is enabled for this chord — adapt the chord-type to
    // a quality + position that yields enabled options for that window
    expect(store.get(effectiveStringSetAtom)).toEqual([0, 1, 2]);
  });

  it("returns stored window's strings (unchanged) in close mode when no option is enabled", () => {
    const store = createStore();
    // Set up the C dim / C major / G shape scenario where all options
    // are disabled (no close voicing fits the position).
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(chordRootAtom, "C");
    store.set(chordTypeAtom, "dim");
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set(["G"]));
    store.set(voicingAtom, "close");
    store.set(voicingStringSetAtom, "0-1-2");
    const options = store.get(stringSetOptionsAtom);
    // Sanity-check the setup: all options should be disabled
    expect(options.every((o) => o.disabled)).toBe(true);
    // Now the assertion: returns stored window unchanged (no silent ALL fallback)
    expect(store.get(effectiveStringSetAtom)).toEqual([0, 1, 2]);
  });
});
```

(Adapt atom imports + atom-setup to match the file's existing patterns. The third test's setup may need adjustment to actually reproduce the dead-end — the implementer iterates on the chord/scale/shape combo until `options.every(o => o.disabled)` holds.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "effectiveStringSetAtom"`
Expected: at least the full-mode and dead-end tests fail.

- [ ] **Step 4: Rewrite `effectiveStringSetAtom`**

In `src/store/chordOverlayAtoms.ts`, replace the existing `effectiveStringSetAtom` block (around lines 379-387) with:

```ts
const ALL_SIX_STRINGS: readonly number[] = [0, 1, 2, 3, 4, 5];

/**
 * The string indices the engine renders close-voicing candidates against.
 * Voicing-mode aware:
 *   - voicing === "full":  returns ALL_SIX_STRINGS unconditionally. Full mode
 *     uses the full board; the user's stored window is irrelevant.
 *   - voicing === "close": returns stored window's strings if it matches an
 *     enabled option; else first enabled option's strings (auto-heal);
 *     else stored window's strings unchanged (engine renders nothing, toggle
 *     bar honestly shows the dead-end).
 */
export const effectiveStringSetAtom = atom((get): readonly number[] => {
  if (get(voicingAtom) === "full") return ALL_SIX_STRINGS;
  const options = get(stringSetOptionsAtom);
  const stored = get(voicingStringSetAtom);
  const match = options.find((o) => o.id === stored);
  if (match && !match.disabled) return match.strings;
  const firstEnabled = options.find((o) => !o.disabled);
  if (firstEnabled) return firstEnabled.strings;
  // Dead-end: stored option may still exist (just disabled) — return its
  // strings so the toggle bar's selected button stays consistent. Engine
  // renders nothing because the stored window doesn't fit the position.
  if (match) return match.strings;
  // Final fallback: stored id matches nothing at all (e.g. after chord swap
  // shrunk voice count). Return empty so engine renders nothing.
  return [];
});
```

- [ ] **Step 5: Update imports**

If `ALL_STRINGS_OPTION` is no longer referenced in `chordOverlayAtoms.ts` after this change:

Run: `grep -n "ALL_STRINGS_OPTION" src/store/chordOverlayAtoms.ts`

If zero results, remove `ALL_STRINGS_OPTION` from the import line at the top of the file.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "effectiveStringSetAtom"`
Expected: PASS for all three tests.

- [ ] **Step 7: Run the full file to catch regressions**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts`
Expected: all tests pass. If a pre-existing test asserted the silent-ALL fallback in close mode, delete it (replaced by the dead-end test above).

---

### Task 3: Regression-guard for `fallbackVoicingMatchesAtom` full-mode bypass

**Files:**
- Test: `src/store/voicingFallbackAtoms.test.ts`

No production code change in this task — the behavior emerges from Task 2's `effectiveStringSetAtom` change. This task adds a regression-guard so future edits don't reintroduce a string-set filter in full mode.

- [ ] **Step 1: Write the regression-guard test**

Add to `src/store/voicingFallbackAtoms.test.ts`:

```ts
it("emits identical matches in full mode regardless of voicingStringSetAtom value", () => {
  const store = createStore();
  // Set up a scenario where a full-mode fallback exists (e.g. C major + D shape
  // with the truncated open-D-shape polygon that lacks a full-chord match).
  store.set(rootNoteAtom, "C");
  store.set(scaleNameAtom, "major");
  store.set(chordRootAtom, "C");
  store.set(chordTypeAtom, "maj");
  store.set(fingeringPatternAtom, "caged");
  store.set(cagedShapesAtom, new Set(["D"]));
  store.set(voicingAtom, "full");

  store.set(voicingStringSetAtom, "0-1-2");
  const matchesAll = store.get(fallbackVoicingMatchesAtom);

  store.set(voicingStringSetAtom, "2-3-4");
  const matchesWindow = store.get(fallbackVoicingMatchesAtom);

  expect(matchesAll).toEqual(matchesWindow);
});
```

(Adapt setup boilerplate. The exact scenario should be one where `fallbackPolygonsAtom` is non-empty; the implementer adjusts the chord/shape combo to match a known fallback case from the prior 7a3a72b3 commit's testing.)

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm vitest run src/store/voicingFallbackAtoms.test.ts -t "emits identical matches in full mode"`
Expected: PASS (because Task 2 already made `effectiveStringSetAtom` return all 6 strings in full mode).

---

### Task 4: Create `ChordStringSetToggleBar` component

**Files:**
- Create: `src/components/ChordOverlayControls/ChordStringSetToggleBar.tsx`
- Create: `src/components/ChordOverlayControls/ChordStringSetToggleBar.module.css`
- Test: `src/components/ChordOverlayControls/ChordStringSetToggleBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ChordOverlayControls/ChordStringSetToggleBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { ChordStringSetToggleBar } from "./ChordStringSetToggleBar";
import {
  chordRootAtom,
  chordTypeAtom,
  voicingAtom,
  voicingStringSetAtom,
} from "../../store/chordOverlayAtoms";

describe("ChordStringSetToggleBar", () => {
  function setupActiveTriadInCloseMode() {
    return {
      atoms: [
        [chordRootAtom, "C" as const],
        [chordTypeAtom, "maj" as const],
        [voicingAtom, "close" as const],
        [voicingStringSetAtom, "0-1-2"],
      ],
    };
  }

  it("renders one button per consecutive-string window", () => {
    renderWithAtoms(<ChordStringSetToggleBar />, setupActiveTriadInCloseMode());
    // C major triad = 3 voices → 4 windows: 0-1-2, 1-2-3, 2-3-4, 3-4-5
    expect(screen.getByRole("button", { name: "1·2·3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2·3·4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3·4·5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4·5·6" })).toBeInTheDocument();
  });

  it("does not render an 'All' button", () => {
    renderWithAtoms(<ChordStringSetToggleBar />, setupActiveTriadInCloseMode());
    expect(screen.queryByRole("button", { name: /^All$/i })).not.toBeInTheDocument();
  });

  it("marks the active window button with aria-pressed=true", () => {
    renderWithAtoms(<ChordStringSetToggleBar />, setupActiveTriadInCloseMode());
    expect(screen.getByRole("button", { name: "1·2·3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "2·3·4" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setValue with the option id on click", async () => {
    const user = userEvent.setup();
    const { store } = renderWithAtoms(<ChordStringSetToggleBar />, setupActiveTriadInCloseMode());
    await user.click(screen.getByRole("button", { name: "2·3·4" }));
    expect(store.get(voicingStringSetAtom)).toBe("1-2-3");
  });

  it("renders disabled buttons with aria-disabled and disabledReason as title", () => {
    // Set up a scenario where some options are disabled.
    // The dead-end scenario (C dim / C major / G shape) makes ALL disabled.
    // For this test, mock a partial-fit scenario via direct atom seeding if
    // possible, otherwise use the dead-end and assert at least one disabled
    // button has the right attributes.
    renderWithAtoms(<ChordStringSetToggleBar />, {
      atoms: [
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [chordRootAtom, "C"],
        [chordTypeAtom, "dim"],
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set(["G"])],
        [voicingAtom, "close"],
      ],
    });
    const disabledButton = screen.getByRole("button", { name: "1·2·3" });
    expect(disabledButton).toBeDisabled();
    expect(disabledButton).toHaveAttribute("title");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordStringSetToggleBar.test.tsx`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Create the component module CSS**

Create `src/components/ChordOverlayControls/ChordStringSetToggleBar.module.css`:

```css
.bar {
  display: flex;
  flex-direction: row;
  gap: var(--space-1, 4px);
  align-items: center;
}

.button {
  /* Composes with shared.toggle-btn for base styling.
     Override font-size if the digit labels need to shrink at narrow widths. */
  font-variant-numeric: tabular-nums;
  padding-inline: var(--space-2, 8px);
}
```

- [ ] **Step 4: Create the component**

Create `src/components/ChordOverlayControls/ChordStringSetToggleBar.tsx`:

```tsx
import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { motion } from "motion/react";
import { ANIMATION_DURATION_FAST } from "@fretflow/core";
import {
  voicingStringSetAtom,
  stringSetOptionsAtom,
} from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import shared from "../shared/shared.module.css";
import styles from "./ChordStringSetToggleBar.module.css";

/**
 * Toggle-bar string-set picker. Renders one button per consecutive-string
 * window. Mirrors the visual treatment of FingeringPatternControls'
 * shapeToggleBar. No "All" button — per the spec, picker offers only window
 * selections; the engine's full-mode behavior bypasses string-set filtering
 * via effectiveStringSetAtom.
 *
 * Auto-heal: if the stored window becomes invalid/disabled and another
 * option is enabled, snaps to the first enabled option. No-op if all options
 * are disabled (the toggle bar then visibly shows the dead-end honestly).
 */
export function ChordStringSetToggleBar() {
  const { t } = useTranslation();
  const [value, setValue] = useAtom(voicingStringSetAtom);
  const options = useAtomValue(stringSetOptionsAtom);

  useEffect(() => {
    const match = options.find((o) => o.id === value);
    if (!match || match.disabled) {
      const firstEnabled = options.find((o) => !o.disabled);
      if (firstEnabled) {
        setValue(firstEnabled.id);
      }
    }
  }, [value, options, setValue]);

  if (options.length === 0) return null;

  return (
    <div
      className={styles.bar}
      role="group"
      aria-label={t("inspector.chordStringSetLabel")}
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        const label = opt.strings.map((n) => String(n + 1)).join("·");
        return (
          <motion.button
            key={opt.id}
            type="button"
            className={clsx(
              shared["toggle-btn"],
              styles.button,
              isActive && shared.active,
            )}
            disabled={opt.disabled}
            aria-pressed={isActive}
            aria-disabled={opt.disabled || undefined}
            title={opt.disabled ? opt.disabledReason : undefined}
            onClick={() => {
              if (opt.disabled) return;
              setValue(opt.id);
            }}
            whileTap={opt.disabled ? undefined : { scale: 0.96 }}
            animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: ANIMATION_DURATION_FAST }}
          >
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordStringSetToggleBar.test.tsx`
Expected: PASS for all five tests. If the disabled-button test fails because the dead-end setup doesn't reproduce, adjust the chord/shape combo until `options.every(o => o.disabled)` holds.

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep ChordStringSetToggleBar`
Expected: no errors.

---

### Task 5: Wire `ChordStringSetToggleBar` into `ChordOverlayControls`

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`:

```ts
describe("string-set picker render gate", () => {
  it("renders the toggle bar in close mode with an active chord", () => {
    renderWithAtoms(<ChordOverlayControls />, {
      atoms: [
        [chordRootAtom, "C"],
        [chordTypeAtom, "maj"],
        [voicingAtom, "close"],
      ],
    });
    expect(screen.getByRole("group", { name: /string set/i })).toBeInTheDocument();
    // Specifically the new toggle bar's button, not a select
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("does NOT render the picker in full mode even when hasFallback is true", () => {
    renderWithAtoms(<ChordOverlayControls />, {
      atoms: [
        // Set up a scenario that yields hasFallback === true
        [rootNoteAtom, "C"],
        [scaleNameAtom, "major"],
        [chordRootAtom, "C"],
        [chordTypeAtom, "maj"],
        [fingeringPatternAtom, "caged"],
        [cagedShapesAtom, new Set(["D"])],
        [voicingAtom, "full"],
      ],
    });
    expect(screen.queryByRole("group", { name: /string set/i })).not.toBeInTheDocument();
  });

  it("does NOT render the picker when no chord is active", () => {
    renderWithAtoms(<ChordOverlayControls />, {
      atoms: [
        [chordTypeAtom, null],
        [voicingAtom, "close"],
      ],
    });
    expect(screen.queryByRole("group", { name: /string set/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx -t "string-set picker render gate"`
Expected: at least the full-mode-fallback and no-chord tests fail (current code renders picker in those cases).

- [ ] **Step 3: Update `ChordOverlayControls.tsx`**

Replace the entire file (assumes Lens Consolidation plan has already removed the Lens row — see Sequencing note in the spec header):

```tsx
import { useAtomValue } from "jotai";
import {
  chordTypeAtom,
  voicingAtom,
} from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { VoicingControl } from "./VoicingControl";
import { ChordStringSetToggleBar } from "./ChordStringSetToggleBar";
import panelStyles from "./ChordOverlayControls.module.css";

export function ChordOverlayControls() {
  const { t } = useTranslation();

  const chordType = useAtomValue(chordTypeAtom);
  const voicing = useAtomValue(voicingAtom);

  const hasActiveChord = Boolean(chordType);

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={12} className={panelStyles.grid}>
        <Prop label={t("inspector.voicingLabel")} span={3}>
          <VoicingControl />
        </Prop>
        {voicing === "close" && hasActiveChord ? (
          <Prop label={t("inspector.chordStringSetLabel")} span={9}>
            <ChordStringSetToggleBar />
          </Prop>
        ) : null}
      </PropGrid>
    </div>
  );
}
```

Note: `hasFallbackPositionsAtom` import is removed — the full-mode fallback branch no longer needs the picker. `ChordStringSetPicker` import replaced by `ChordStringSetToggleBar`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx -t "string-set picker render gate"`
Expected: PASS for all three tests.

- [ ] **Step 5: Run full file**

Run: `pnpm vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: all tests pass.

---

### Task 6: Delete `ChordStringSetPicker.tsx` and its test

**Files:**
- Delete: `src/components/ChordOverlayControls/ChordStringSetPicker.tsx`
- Delete: `src/components/ChordOverlayControls/ChordStringSetPicker.test.tsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "ChordStringSetPicker" src/ 2>/dev/null`
Expected: only the file itself + its test. No external imports remain (ChordOverlayControls was updated in Task 5).

- [ ] **Step 2: Delete the files**

```bash
rm src/components/ChordOverlayControls/ChordStringSetPicker.tsx
rm src/components/ChordOverlayControls/ChordStringSetPicker.test.tsx
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: zero errors.

---

### Task 7: (Optional) Drop `ALL_STRINGS_OPTION` export if dead

**Files:**
- Modify: `src/store/voicingStringSets.ts`

- [ ] **Step 1: Sweep remaining consumers**

Run: `grep -rn "ALL_STRINGS_OPTION" src/ packages/core/src/ 2>/dev/null`

- [ ] **Step 2: If only the definition + test remain, delete the export**

If the only matches are `src/store/voicingStringSets.ts` (the definition) and `src/store/voicingStringSets.test.ts` (a test that imports it), then:

- In `src/store/voicingStringSets.ts`: remove the `export` keyword from `ALL_STRINGS_OPTION`, OR delete the constant entirely if the test doesn't actually need it.
- In `src/store/voicingStringSets.test.ts`: update tests to inline the constant if needed, or simply assert `buildStringSetOptions` doesn't include an entry with `id: "all"`.

If other consumers exist, skip this task — `ALL_STRINGS_OPTION` stays public.

- [ ] **Step 3: Run the test file**

Run: `pnpm vitest run src/store/voicingStringSets.test.ts`
Expected: all tests pass.

---

### Task 8: Final verification + commit

- [ ] **Step 1: Full typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 5: Commit production code**

```bash
git add src/store/chordOverlayAtoms.ts \
        src/store/chordOverlayAtoms.test.ts \
        src/store/voicingFallbackAtoms.test.ts \
        src/store/voicingStringSets.ts \
        src/store/voicingStringSets.test.ts \
        src/components/ChordOverlayControls/ChordOverlayControls.tsx \
        src/components/ChordOverlayControls/ChordOverlayControls.test.tsx \
        src/components/ChordOverlayControls/ChordStringSetToggleBar.tsx \
        src/components/ChordOverlayControls/ChordStringSetToggleBar.test.tsx \
        src/components/ChordOverlayControls/ChordStringSetToggleBar.module.css
git rm src/components/ChordOverlayControls/ChordStringSetPicker.tsx \
       src/components/ChordOverlayControls/ChordStringSetPicker.test.tsx
git commit -m "$(cat <<'EOF'
refactor(chord-voicings): honest string-set picker + toggle bar swap

- stringSetOptionsAtom no-chord branch returns [] (was [ALL_STRINGS_OPTION]).
- effectiveStringSetAtom is voicing-mode-aware: full mode always returns all
  6 strings; close mode returns stored window or auto-heals to first
  enabled; no silent ALL fallback when all options are disabled.
- Picker render gate tightens to (voicing === "close" && hasActiveChord);
  drops the full-mode fallback branch entirely.
- Replace ChordStringSetPicker (LabeledSelect dropdown) with
  ChordStringSetToggleBar (toggle bar mirroring shapeToggleBar pattern).
  No "All" button.
- Prop span grows 2 → 9 to match the toggle-bar width pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Visual regression baseline refresh

- [ ] **Step 1: Refresh darwin baselines**

Run: `pnpm test:visual:update`
Expected: snapshots in `e2e/app-overlays/`, chord-voicings-card visuals update. No failures.

- [ ] **Step 2: Inspect the diff**

Run: `git diff --stat e2e/`
Expected: multiple `.png` files changed. Spot-check one: the chord-voicings card row 1 now shows Voicing (3) + String Set toggle bar (9) in close mode; only Voicing (3) in full mode.

- [ ] **Step 3: Commit snapshot updates**

```bash
git add e2e/
git commit -m "$(cat <<'EOF'
test(visual): refresh darwin baselines for string-set toggle bar swap

Picker changed from dropdown to toggle bar in close mode; picker removed
entirely in full mode. Linux baselines auto-rebuild on next CI run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Manual smoke verification

No file changes; no commit.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Verify close-mode toggle bar**

In the running app:
1. Set root: C, scale: Major, fingering: CAGED, shape: C.
2. Pick a chord (e.g. C maj).
3. Open Overlay tab → Chord card → set voicing to Close.
4. Confirm: a toggle bar appears with 4 buttons (1·2·3, 2·3·4, 3·4·5, 4·5·6). One button is highlighted (the active window).
5. Click a different button. Confirm: the highlight moves and the fretboard re-draws the connector lines for that string set.

- [ ] **Step 3: Verify dead-end communication**

1. Switch chord to C dim, shape to G.
2. Confirm: the toggle bar still appears, but every button is greyed/disabled. Hovering each shows a tooltip ("No voicing in current position"). No connector lines on the fretboard (engine renders nothing).

- [ ] **Step 4: Verify full-mode hides the picker**

1. Set voicing to Full.
2. Confirm: the toggle bar disappears entirely from the row. Only Voicing control remains.
3. With CAGED shape D (truncated polygon scenario), confirm: the open-C close-voicing fallback still renders at the open D-shape position (regression-guard for prior 7a3a72b3 work).

- [ ] **Step 5: Verify no-chord case**

1. Clear the active chord (or set chordType to null via whatever UI allows it).
2. Confirm: the toggle bar disappears.

---

## Verification summary

```bash
pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production
```
Expected: all green.

```bash
git log --oneline -3
```
Expected: 2 commits at the top (refactor + visual refresh).

---

## Self-review notes

- **Spec coverage:**
  - A1 (empty close-mode toggle bar + honest engine): Tasks 1, 2, 4, 5.
  - A2 (hide picker in full mode): Task 5 render gate + Task 3 regression-guard.
  - A3 (dropdown → toggle bar): Tasks 4, 5, 6.
  - Cleanups (delete ALL_STRINGS_OPTION if dead, delete picker): Tasks 6, 7.
- **Placeholder scan:** No TODO/TBD. Tests that need scenario tuning have explicit guidance ("adapt chord/shape until predicate holds") rather than vague "set up appropriate state" wording.
- **Type consistency:** `ChordStringSetToggleBar` consistent across Tasks 4-5. `effectiveStringSetAtom` return type `readonly number[]` preserved. `voicingAtom` value `"full"` / `"close"` matches the existing VoicingType union.
- **Sequencing:** Spec mandates Lens Consolidation plan ships first. Task 5's component rewrite assumes the Lens row is already gone — if implementing out-of-order, accept an interim wrap or coordinate the change.
