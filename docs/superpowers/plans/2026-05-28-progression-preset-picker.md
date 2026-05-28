# Progression Preset Picker & Smarter Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single grouped `LabeledSelect` progression-preset picker with a radix DropdownMenu that browses presets by category and surfaces genre-tagged, scale-aware suggestions; make the trigger reflect a loaded suggestion.

**Architecture:** A new presentational `PresetMenu` component (radix `@radix-ui/react-dropdown-menu`) renders a value-bearing trigger plus category submenus and a "Suggested for <scale>" submenu. `SongControls` keeps all Jotai wiring and passes plain data + an `onSelect` callback. The suggestion generator (`progressionGeneration.ts`) gains a `feel` tag, deterministic ids, and degree-derived labels so suggestions can be matched back by `currentProgressionPresetIdAtom`.

**Tech Stack:** React 19 + TypeScript, Jotai, radix-ui, CSS Modules, Vitest + Testing Library + vitest-axe, Playwright (visual regression). Package manager is **pnpm**.

**Spec:** `docs/superpowers/specs/2026-05-28-progression-preset-picker-design.md`

---

## File Structure

- **Create** `src/components/PresetMenu/PresetMenu.tsx` — presentational DropdownMenu picker (trigger + category submenus + suggestions submenu). No atom access.
- **Create** `src/components/PresetMenu/PresetMenu.module.css` — trigger/content/item/submenu styling, mirroring `LabeledSelect.module.css` tokens.
- **Create** `src/components/PresetMenu/PresetMenu.test.tsx` — rendering, selection, current indicator, locked state, axe.
- **Modify** `src/progressions/progressionGeneration.ts` — `feel` tag, deterministic ids, degree-derived labels, one modal template, rationale comment for skipping `@tonaljs/progression`.
- **Modify** `src/progressions/progressionGeneration.test.ts` — assert feel tags, id format, modal template.
- **Modify** `src/store/progressionAtoms.ts` — extend `currentProgressionPresetIdAtom` to match suggestions.
- **Modify** `src/store/progressionAtoms.test.ts` (or nearest existing atoms test; create a focused test file if none) — suggestion matching.
- **Modify** `src/components/SongControls/SongControls.tsx` — swap the preset `LabeledSelect` for `PresetMenu`, build category + suggestion data, remove dead `presetGroups` plumbing.
- **Modify** `src/components/SongControls/SongControls.test.tsx` — update the preset-control assertion from `combobox` to `button`.
- **Modify** `package.json` — add `@radix-ui/react-dropdown-menu`.

---

## Task 1: Add the radix dropdown-menu dependency

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Install the dependency**

Run (from repo root):

```bash
pnpm add @radix-ui/react-dropdown-menu
```

Expected: `package.json` gains `"@radix-ui/react-dropdown-menu": "^2.x.x"` under `dependencies`; `pnpm-lock.yaml` updates. (Family already includes `@radix-ui/react-dialog`, `react-select`, etc.)

- [ ] **Step 2: Verify it resolves and the build still type-checks**

Run:

```bash
pnpm run build
```

Expected: PASS (no new type errors; nothing imports the package yet).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(deps): add @radix-ui/react-dropdown-menu for preset picker"
```

---

## Task 2: Genre-tagged, scale-aware suggestions with stable ids

Rework `progressionGeneration.ts` so each generated suggestion carries a `feel`
tag, a deterministic id, and a label derived from the scale's actual degrees
(instead of the hardcoded major-key label). Add one modal vamp template.

**Files:**
- Modify: `src/progressions/progressionGeneration.ts`
- Test: `src/progressions/progressionGeneration.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the body of `src/progressions/progressionGeneration.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { generateCommonProgressions } from "./progressionGeneration";

describe("generateCommonProgressions", () => {
  it("returns suggested-category presets for Major scale", () => {
    const presets = generateCommonProgressions("major", "C");
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) {
      expect(p.steps.length).toBeGreaterThan(0);
      expect(p.category).toBe("suggested");
    }
  });

  it("tags every suggestion with a known feel", () => {
    const presets = generateCommonProgressions("major", "C");
    for (const p of presets) {
      expect(["cadential", "vamp", "modal"]).toContain(p.feel);
    }
  });

  it("derives labels from the scale's own degrees", () => {
    const presets = generateCommonProgressions("major", "C");
    // IV-V-I cadence (ordinals 3,4,0) renders with major-scale degrees.
    expect(presets.some((p) => p.label === "IV-V-I")).toBe(true);
  });

  it("uses deterministic ids that encode feel + ordinals", () => {
    const a = generateCommonProgressions("major", "C").map((p) => p.id);
    const b = generateCommonProgressions("major", "C").map((p) => p.id);
    expect(a).toEqual(b);
    expect(a.every((id) => /^suggested-(cadential|vamp|modal)-\d+$/.test(id))).toBe(true);
  });

  it("includes a modal vamp for 7-degree scales", () => {
    const presets = generateCommonProgressions("dorian", "D");
    expect(presets.some((p) => p.feel === "modal")).toBe(true);
  });

  it("returns a defined array for pentatonic scales", () => {
    const presets = generateCommonProgressions("major pentatonic", "C");
    expect(Array.isArray(presets)).toBe(true);
  });

  it("generated presets have unique IDs", () => {
    const ids = generateCommonProgressions("major", "C").map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm exec vitest run src/progressions/progressionGeneration.test.ts
```

Expected: FAIL — `p.feel` is `undefined`, id regex fails (`generated-0`), etc.

- [ ] **Step 3: Rewrite `progressionGeneration.ts`**

Replace the entire contents of `src/progressions/progressionGeneration.ts` with:

```ts
import {
  getDegreeSequence,
  getDiatonicChord,
  type DegreeId,
} from "@fretflow/core";
import type { ProgressionPreset, ProgressionStep } from "./progressionDomain";

export type SuggestionFeel = "cadential" | "vamp" | "modal";

export interface SuggestedPreset extends Omit<ProgressionPreset, "category"> {
  category: "suggested";
  feel: SuggestionFeel;
}

interface ProgressionTemplate {
  feel: SuggestionFeel;
  ordinals: number[];
}

// NOTE: We deliberately do NOT use @tonaljs/progression here. Its
// fromRomanNumerals/toRomanNumerals API assumes a major-key roman-numeral
// frame, whereas getDiatonicChord is modal-aware (modes, borrowed chords,
// quality overrides). Routing generation through Tonal would be a downgrade.
// Revisit only if a "import from chord names" feature is added.

const CADENTIAL_TEMPLATES: ProgressionTemplate[] = [
  { feel: "cadential", ordinals: [3, 4, 0] }, // IV-V-I
  { feel: "cadential", ordinals: [1, 4, 0] }, // ii-V-I
  { feel: "cadential", ordinals: [0, 3, 4, 0] }, // I-IV-V-I
];

const CYCLE_TEMPLATES: ProgressionTemplate[] = [
  { feel: "cadential", ordinals: [5, 1, 4, 0] }, // vi-ii-V-I
  { feel: "cadential", ordinals: [2, 5, 1, 4, 0] }, // iii-vi-ii-V-I
];

const VAMP_TEMPLATES: ProgressionTemplate[] = [
  { feel: "vamp", ordinals: [0, 3] }, // I-IV shuttle
];

// Tonic to the scale's natural 7th degree — a modal vamp whose colour follows
// the selected mode (e.g. ♭VII in Dorian/Mixolydian/Aeolian).
const MODAL_TEMPLATES: ProgressionTemplate[] = [
  { feel: "modal", ordinals: [0, 6] }, // I-VII
];

function buildPreset(
  template: ProgressionTemplate,
  degrees: DegreeId[],
  scaleName: string,
  rootNote: string,
): SuggestedPreset | null {
  const steps: Array<Omit<ProgressionStep, "id">> = [];
  const labelParts: string[] = [];
  for (const ordinal of template.ordinals) {
    const degree = degrees[ordinal];
    if (!degree) return null;
    if (!getDiatonicChord(degree, scaleName, rootNote)) return null;
    steps.push({
      degree,
      duration: { value: 1, unit: "bar" },
      qualityOverride: null,
      manualRoot: null,
    });
    labelParts.push(degree);
  }
  return {
    id: `suggested-${template.feel}-${template.ordinals.join("")}`,
    label: labelParts.join("-"),
    category: "suggested",
    feel: template.feel,
    steps,
  };
}

export function generateCommonProgressions(
  scaleName: string,
  rootNote: string,
): SuggestedPreset[] {
  const degrees = getDegreeSequence(scaleName);
  if (degrees.length < 3) return [];

  const templates: ProgressionTemplate[] = [...CADENTIAL_TEMPLATES];
  if (degrees.length >= 6) templates.push(...CYCLE_TEMPLATES);
  if (degrees.length >= 4) templates.push(...VAMP_TEMPLATES);
  if (degrees.length >= 7) templates.push(...MODAL_TEMPLATES);

  const results: SuggestedPreset[] = [];
  for (const template of templates) {
    if (!template.ordinals.every((o) => o < degrees.length)) continue;
    const preset = buildPreset(template, degrees, scaleName, rootNote);
    if (preset) results.push(preset);
  }
  return results;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run src/progressions/progressionGeneration.test.ts
```

Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/progressionGeneration.ts src/progressions/progressionGeneration.test.ts
git commit -m "feat(progressions): genre-tagged, scale-aware suggestions with stable ids"
```

---

## Task 3: Reflect a loaded suggestion in the current-preset id

Extend `currentProgressionPresetIdAtom` so that, when the live steps don't match
any static preset, it checks the generated suggestions for the current scale +
root and returns the matching suggestion's stable id (so the trigger label shows
the suggestion instead of "Custom").

**Files:**
- Modify: `src/store/progressionAtoms.ts:376-383`
- Test: `src/store/progressionAtoms.test.ts` (append; if the file does not exist, create it with the imports shown)

- [ ] **Step 1: Write the failing test**

Append this `describe` block to `src/store/progressionAtoms.test.ts` (create the
file with these imports if it does not exist):

```ts
import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import {
  currentProgressionPresetIdAtom,
  loadProgressionStepsAtom,
  CUSTOM_PRESET_ID,
} from "./progressionAtoms";
import { rootNoteAtom, scaleNameAtom } from "./scaleAtoms";
import { generateCommonProgressions } from "../progressions/progressionGeneration";

describe("currentProgressionPresetIdAtom — suggestion matching", () => {
  it("returns a suggestion id when its steps are loaded", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    const suggestion = generateCommonProgressions("major", "C")[0];
    store.set(loadProgressionStepsAtom, suggestion.steps);
    expect(store.get(currentProgressionPresetIdAtom)).toBe(suggestion.id);
  });

  it("falls back to custom for an unmatched progression", () => {
    const store = createStore();
    store.set(rootNoteAtom, "C");
    store.set(scaleNameAtom, "major");
    store.set(loadProgressionStepsAtom, [
      { degree: "I", duration: { value: 3, unit: "bar" }, qualityOverride: "7", manualRoot: null },
    ]);
    expect(store.get(currentProgressionPresetIdAtom)).toBe(CUSTOM_PRESET_ID);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run src/store/progressionAtoms.test.ts -t "suggestion matching"
```

Expected: FAIL — first test returns `"custom"` instead of the suggestion id.

- [ ] **Step 3: Update the atom**

In `src/store/progressionAtoms.ts`, add this import near the other progression
imports at the top of the file:

```ts
import { generateCommonProgressions } from "../progressions/progressionGeneration";
```

Then replace the `currentProgressionPresetIdAtom` definition (currently lines
376-383) with:

```ts
export const currentProgressionPresetIdAtom = atom<string>((get) => {
  const steps = get(progressionStepsAtom);
  const scaleName = get(scaleNameAtom);
  const rootNote = get(rootNoteAtom);

  const presetMatch = getAvailableProgressionPresets(scaleName).find((preset) =>
    stepsMatchPreset(steps, getProgressionPresetStepsForScale(preset, scaleName)),
  );
  if (presetMatch) return presetMatch.id;

  const suggestionMatch = generateCommonProgressions(scaleName, rootNote).find(
    (suggestion) => stepsMatchPreset(steps, suggestion.steps),
  );
  if (suggestionMatch) return suggestionMatch.id;

  return CUSTOM_PRESET_ID;
});
```

(`stepsMatchPreset` is defined just above at line 360 and compares degree,
duration value/unit, and qualityOverride — exactly the fields suggestion steps
carry.)

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec vitest run src/store/progressionAtoms.test.ts -t "suggestion matching"
```

Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionAtoms.test.ts
git commit -m "feat(progressions): reflect loaded suggestion in current preset id"
```

---

## Task 4: PresetMenu component

A presentational radix DropdownMenu. It receives flat data + an `onSelect`
callback and shows the current selection on the trigger. No atom access.

**Files:**
- Create: `src/components/PresetMenu/PresetMenu.tsx`
- Create: `src/components/PresetMenu/PresetMenu.module.css`
- Test: `src/components/PresetMenu/PresetMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/PresetMenu/PresetMenu.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "../../test-utils/a11y";
import { PresetMenu, type PresetMenuProps } from "./PresetMenu";

const baseProps: PresetMenuProps = {
  triggerLabel: "Preset",
  customLabel: "Custom",
  scaleName: "major",
  currentId: "one-five-six-four",
  disabled: false,
  categories: [
    {
      label: "Pop / Rock",
      options: [
        { id: "one-five-six-four", label: "I-V-vi-IV" },
        { id: "vi-iv-i-v", label: "vi-IV-I-V" },
      ],
    },
    { label: "Jazz", options: [{ id: "two-five-one", label: "ii-V-I" }] },
  ],
  suggestionGroups: [
    {
      feel: "cadential",
      label: "Cadential",
      options: [{ id: "suggested-cadential-340", label: "IV-V-I" }],
    },
  ],
  onSelect: vi.fn(),
};

describe("PresetMenu", () => {
  it("shows the current preset label on the trigger", () => {
    render(<PresetMenu {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /Preset/i }),
    ).toHaveTextContent("I-V-vi-IV");
  });

  it("shows the custom label when current id is not found", () => {
    render(<PresetMenu {...baseProps} currentId="custom" />);
    expect(
      screen.getByRole("button", { name: /Preset/i }),
    ).toHaveTextContent("Custom");
  });

  it("selects a static preset from a category submenu", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PresetMenu {...baseProps} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /Preset/i }));
    await user.click(screen.getByRole("menuitem", { name: "Jazz" }));
    await user.click(screen.getByRole("menuitem", { name: "ii-V-I" }));
    expect(onSelect).toHaveBeenCalledWith("two-five-one");
  });

  it("selects a suggestion from the suggestions submenu", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PresetMenu {...baseProps} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /Preset/i }));
    await user.click(screen.getByRole("menuitem", { name: /Suggested for major/i }));
    await user.click(screen.getByRole("menuitem", { name: "IV-V-I" }));
    expect(onSelect).toHaveBeenCalledWith("suggested-cadential-340");
  });

  it("disables the trigger when locked", () => {
    render(<PresetMenu {...baseProps} disabled />);
    expect(screen.getByRole("button", { name: /Preset/i })).toBeDisabled();
  });

  it("has no axe violations", async () => {
    const { container } = render(<PresetMenu {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run src/components/PresetMenu/PresetMenu.test.tsx
```

Expected: FAIL — module `./PresetMenu` does not exist.

- [ ] **Step 3: Create the component**

Create `src/components/PresetMenu/PresetMenu.tsx`:

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { SuggestionFeel } from "../../progressions/progressionGeneration";
import styles from "./PresetMenu.module.css";

export interface PresetMenuOption {
  id: string;
  label: string;
}

export interface PresetMenuCategory {
  label: string;
  options: PresetMenuOption[];
}

export interface PresetMenuSuggestionGroup {
  feel: SuggestionFeel;
  label: string;
  options: PresetMenuOption[];
}

export interface PresetMenuProps {
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  /** Text shown on the trigger when no option matches `currentId`. */
  customLabel: string;
  /** Used in the "Suggested for <scaleName>" submenu heading. */
  scaleName: string;
  /** Id of the active preset/suggestion (or a custom sentinel). */
  currentId: string;
  categories: PresetMenuCategory[];
  suggestionGroups: PresetMenuSuggestionGroup[];
  disabled?: boolean;
  onSelect: (id: string) => void;
}

function findLabel(
  currentId: string,
  categories: PresetMenuCategory[],
  suggestionGroups: PresetMenuSuggestionGroup[],
  fallback: string,
): string {
  for (const cat of categories) {
    const hit = cat.options.find((o) => o.id === currentId);
    if (hit) return hit.label;
  }
  for (const group of suggestionGroups) {
    const hit = group.options.find((o) => o.id === currentId);
    if (hit) return hit.label;
  }
  return fallback;
}

function MenuOption({
  option,
  currentId,
  onSelect,
}: {
  option: PresetMenuOption;
  currentId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenu.Item
      className={styles["preset-menu-item"]}
      onSelect={() => onSelect(option.id)}
    >
      <span className={styles["preset-menu-item-indicator"]}>
        {option.id === currentId && <Check size={14} aria-hidden="true" />}
      </span>
      <span>{option.label}</span>
    </DropdownMenu.Item>
  );
}

export function PresetMenu({
  triggerLabel,
  customLabel,
  scaleName,
  currentId,
  categories,
  suggestionGroups,
  disabled,
  onSelect,
}: PresetMenuProps) {
  const currentLabel = findLabel(
    currentId,
    categories,
    suggestionGroups,
    customLabel,
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={styles["preset-menu-trigger"]}
        aria-label={triggerLabel}
        disabled={disabled}
      >
        <span className={styles["preset-menu-trigger-value"]}>{currentLabel}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={styles["preset-menu-chevron"]}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles["preset-menu-content"]}
          sideOffset={4}
          align="start"
        >
          {suggestionGroups.length > 0 && (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={styles["preset-menu-subtrigger"]}>
                <span>{`Suggested for ${scaleName}`}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  className={styles["preset-menu-content"]}
                  sideOffset={2}
                  alignOffset={-4}
                >
                  {suggestionGroups.map((group, index) => (
                    <DropdownMenu.Group key={group.feel}>
                      {index > 0 && (
                        <DropdownMenu.Separator
                          className={styles["preset-menu-separator"]}
                        />
                      )}
                      <DropdownMenu.Label className={styles["preset-menu-group-label"]}>
                        {group.label}
                      </DropdownMenu.Label>
                      {group.options.map((option) => (
                        <MenuOption
                          key={option.id}
                          option={option}
                          currentId={currentId}
                          onSelect={onSelect}
                        />
                      ))}
                    </DropdownMenu.Group>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          )}

          {categories.map((category) => (
            <DropdownMenu.Sub key={category.label}>
              <DropdownMenu.SubTrigger className={styles["preset-menu-subtrigger"]}>
                <span>{category.label}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  className={styles["preset-menu-content"]}
                  sideOffset={2}
                  alignOffset={-4}
                >
                  {category.options.map((option) => (
                    <MenuOption
                      key={option.id}
                      option={option}
                      currentId={currentId}
                      onSelect={onSelect}
                    />
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

> The unused `clsx` import will trip eslint; remove it if you don't add a
> conditional class. It is listed only so the import block is explicit — delete
> the `import clsx ...` line before committing if unused.

- [ ] **Step 4: Create the stylesheet**

Create `src/components/PresetMenu/PresetMenu.module.css` (mirrors
`LabeledSelect.module.css` tokens so the trigger matches sibling controls):

```css
.preset-menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 9rem;
  max-width: 100%;
  min-height: var(--control-height);
  padding: 0.25rem 0.7rem;
  background-color: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: var(--font-weight-medium);
  color: var(--dc-fg-strong);
  line-height: var(--leading-normal);
  cursor: pointer;
  transition: var(--dc-transition);
  overflow: hidden;
  white-space: nowrap;
}

.preset-menu-trigger:hover:not([data-disabled]) {
  background-color: var(--dc-bg-hover);
  border-color: var(--dc-border-hover);
}

.preset-menu-trigger:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
  box-shadow: var(--focus-ring-glow);
}

.preset-menu-trigger[data-state="open"] {
  border-color: var(--dc-border-active);
}

.preset-menu-trigger[data-disabled] {
  cursor: not-allowed;
  opacity: var(--disabled-opacity);
}

.preset-menu-trigger-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.preset-menu-chevron {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--dc-fg-muted);
  transition: transform var(--transition-fast);
}

.preset-menu-trigger[data-state="open"] .preset-menu-chevron {
  transform: rotate(180deg);
}

.preset-menu-content {
  z-index: var(--z-dropdown);
  min-width: 12rem;
  max-width: min(90vw, 22rem);
  max-height: min(60vh, 480px);
  overflow: auto;
  padding: 0.25rem;
  background:
    radial-gradient(120% 200% at 0% 0%, var(--faceplate-wash), transparent 55%),
    linear-gradient(180deg, var(--faceplate-bg-elevated), var(--faceplate-bg));
  border: 1px solid var(--faceplate-border);
  border-radius: var(--dc-radius);
  box-shadow: var(--elevation-overlay);
}

/* stylelint-disable selector-pseudo-class-no-unknown */
:global([data-theme="modern-light"]) .preset-menu-content {
  border-color: rgb(133 124 108 / 0.30);
  box-shadow: 0 4px 12px rgb(42 37 29 / 0.10), 0 1px 4px rgb(42 37 29 / 0.06);
}
/* stylelint-enable selector-pseudo-class-no-unknown */

.preset-menu-item,
.preset-menu-subtrigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 1.85rem;
  padding: 0.32rem 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  color: var(--dc-fg);
  border-radius: calc(var(--dc-radius) - 2px);
  cursor: pointer;
  user-select: none;
  outline: none;
}

.preset-menu-item {
  justify-content: flex-start;
}

.preset-menu-item[data-highlighted],
.preset-menu-subtrigger[data-highlighted],
.preset-menu-subtrigger[data-state="open"] {
  background-color: var(--dc-bg-hover);
  color: var(--dc-fg-strong);
}

.preset-menu-item-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  flex-shrink: 0;
  color: var(--dc-fg-strong);
}

.preset-menu-group-label {
  padding: 0.4rem 0.6rem 0.2rem;
  font-size: var(--text-xxs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--dc-fg-muted);
}

.preset-menu-separator {
  height: 1px;
  margin: 0.25rem 0.3rem;
  background: var(--faceplate-divider);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
pnpm exec vitest run src/components/PresetMenu/PresetMenu.test.tsx
```

Expected: PASS. If a submenu fails to open under jsdom via `click`, change the
two submenu interactions to keyboard: focus the trigger, then
`await user.keyboard("{ArrowDown}")` to move onto the SubTrigger and
`await user.keyboard("{ArrowRight}")` to open it. Keep `onSelect` assertions
unchanged.

- [ ] **Step 6: Lint the new files**

Run:

```bash
pnpm run lint
```

Expected: PASS. Remove the unused `clsx` import from `PresetMenu.tsx` if eslint
flags it.

- [ ] **Step 7: Commit**

```bash
git add src/components/PresetMenu/
git commit -m "feat(progressions): add PresetMenu dropdown picker component"
```

---

## Task 5: Wire PresetMenu into SongControls

Swap the preset `LabeledSelect` for `PresetMenu`, build the category and
suggestion data it needs, and remove the now-dead `presetGroups` plumbing. Keep
`handlePresetChange` (it already routes suggestions vs. static presets).

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Test: `src/components/SongControls/SongControls.test.tsx`

- [ ] **Step 1: Update the failing assertion in the existing test**

In `src/components/SongControls/SongControls.test.tsx`, the first test asserts:

```ts
expect(screen.getByRole("combobox", { name: "Preset" })).toBeInTheDocument();
```

Change it to:

```ts
expect(screen.getByRole("button", { name: "Preset" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run src/components/SongControls/SongControls.test.tsx -t "renders preset selector"
```

Expected: FAIL — the preset control is still a `combobox`, so the `button`
query finds nothing (or matches the wrong button).

- [ ] **Step 3: Replace the picker in `SongControls.tsx`**

(a) Update imports. Add the `PresetMenu` import and its types, and drop the
now-unused `LabeledSelectGroup` type import (keep `LabeledSelect` — it is still
used for root/scale/quality selects):

```tsx
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import {
  PresetMenu,
  type PresetMenuCategory,
  type PresetMenuSuggestionGroup,
} from "../PresetMenu/PresetMenu";
```

Add a feel-label map near `CATEGORY_LABELS` (after line 75 block):

```tsx
const SUGGESTION_FEEL_LABELS: Record<string, string> = {
  cadential: "Cadential",
  vamp: "Vamps",
  modal: "Modal",
};
```

(b) Replace the `presetGroups` construction (currently lines ~155-179) with
`categories` + `suggestionGroups` builders. Keep `availablePresets`,
`groupedPresets`, `suggestedPresets`, and `handlePresetChange` as they are:

```tsx
const categories: PresetMenuCategory[] = groupedPresets.map((group) => ({
  label: group.label,
  options: group.presets.map((preset) => ({
    id: preset.id,
    label: preset.label,
  })),
}));

const suggestionGroups: PresetMenuSuggestionGroup[] = Object.entries(
  suggestedPresets.reduce<Record<string, typeof suggestedPresets>>((acc, p) => {
    (acc[p.feel] ??= []).push(p);
    return acc;
  }, {}),
).map(([feel, presets]) => ({
  feel: feel as PresetMenuSuggestionGroup["feel"],
  label: SUGGESTION_FEEL_LABELS[feel] ?? feel,
  options: presets.map((p) => ({ id: p.id, label: p.label })),
}));
```

(c) Replace the preset `LabeledSelect` in the progression toolbar (currently
lines ~265-271) with:

```tsx
<PresetMenu
  triggerLabel={t("inspector.progressionPreset")}
  customLabel="Custom"
  scaleName={scaleName}
  currentId={currentProgressionPresetId}
  categories={categories}
  suggestionGroups={suggestionGroups}
  disabled={editsLocked}
  onSelect={handlePresetChange}
/>
```

(d) `handlePresetChange` already ignores `CUSTOM_PRESET_ID` and routes
suggestions through `loadProgressionSteps`; leave it unchanged. The
`CUSTOM_PRESET_ID` import stays (used by `handlePresetChange`).

- [ ] **Step 4: Run the SongControls tests to verify they pass**

Run:

```bash
pnpm exec vitest run src/components/SongControls/SongControls.test.tsx
```

Expected: PASS. If other tests in this file opened the preset control via
`combobox`/`option` queries, update them to open the `button` named "Preset" and
navigate the submenu (`menuitem` queries), mirroring Task 4's interaction
pattern.

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm run lint
```

Expected: PASS. Resolve any "unused variable" errors by deleting leftover dead
code (e.g. an orphaned `presetGroups` or `LabeledSelectGroup` reference).

- [ ] **Step 6: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.test.tsx
git commit -m "feat(progressions): use PresetMenu in SongControls, drop grouped select plumbing"
```

---

## Task 6: Full verification + visual snapshots

**Files:** none (verification + generated snapshots only)

- [ ] **Step 1: Run the full unit/component suite**

Run:

```bash
pnpm run test
```

Expected: PASS (entire suite green).

- [ ] **Step 2: Lint (eslint + stylelint)**

Run:

```bash
pnpm run lint
```

Expected: PASS.

- [ ] **Step 3: Production build**

Run:

```bash
pnpm run build
```

Expected: PASS (`tsc -b && vite build`).

- [ ] **Step 4: Regenerate darwin visual snapshots for affected suites**

The preset control appears in the component/overlay visual suites. Regenerate
and inspect the diffs to confirm the new picker renders as intended.

Run:

```bash
pnpm run test:visual:update
```

Expected: Snapshots for the affected suites (e.g. `app-components`,
`app-overlays`) update. Review the regenerated PNGs before committing — the
trigger should match sibling selects and the menu should open with category
submenus. (CI seeds linux snapshots; per CLAUDE.md, `__snapshots__` for unit
tests are gitignored, but the Playwright `e2e/` snapshots are committed.)

- [ ] **Step 5: Commit the snapshot updates**

```bash
git add e2e
git commit -m "test(visual): refresh snapshots for PresetMenu picker"
```

- [ ] **Step 6: Final confirmation**

Confirm the working tree is clean and all of `pnpm run lint`, `pnpm run test`,
`pnpm run build` passed in this session (per CLAUDE.md, these are mandatory
before a PR).

```bash
git status
```

Expected: clean tree, all commits present.

---

## Self-Review Notes

- **Spec coverage:** A (picker) → Tasks 1, 4, 5. B (genre-tagged scale-aware
  suggestions) → Task 2. C (trigger reflects suggestions) → Task 3. D (skip
  Tonal) → rationale comment in Task 2. Testing + cleanup → Tasks 4-6.
- **Type consistency:** `SuggestedPreset`/`SuggestionFeel` defined in Task 2 are
  imported by Tasks 3-5; `PresetMenuProps`/`PresetMenuCategory`/
  `PresetMenuSuggestionGroup` defined in Task 4 are imported by Task 5; the
  stable id format `suggested-<feel>-<ordinals>` from Task 2 is matched in Task 3
  and used as test fixtures in Task 4.
- **Out of scope (unchanged):** `@tonaljs/progression`, custom-preset
  persistence, static catalog content.
```
