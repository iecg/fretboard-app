# Blues Preset Scale Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three blues progression presets load the minor blues scale as the fretboard overlay instead of major/natural-minor, without changing chord resolution.

**Architecture:** Each preset declares a `scale` string that `loadProgressionPresetAtom` writes to `scaleNameAtom` (the overlay). Chord harmony resolves through `getHarmonyParentScale`, which already maps `"minor blues" → "minor"`, so swapping the preset's `scale` to `"minor blues"` changes only the overlay, not the resolved chords. This is a one-line-per-preset data change plus a test fixture update.

**Tech Stack:** TypeScript, Vitest, Jotai. Run tests with `pnpm test`.

---

### Task 1: Update the test fixture to expect `minor blues` for blues presets (failing test)

The `PRESET_HOME_SCALE` fixture in the domain test asserts the declared `scale`
for every preset, and a companion test verifies every preset's steps resolve
(not "unavailable") in that scale. Updating the fixture first makes the
"declares the expected scale" test fail until the source is changed, and proves
the resolution test still passes for the new scale.

**Files:**
- Modify: `src/progressions/progressionDomain.test.ts:597-599`

- [ ] **Step 1: Update the fixture entries**

In `src/progressions/progressionDomain.test.ts`, inside the `PRESET_HOME_SCALE`
object (starts at line 595), change the three blues entries.

Change this:

```ts
  "one-four-five": "major", "twelve-bar-blues": "major", "vi-iv-i-v": "major",
  "i-iv-vi-v": "major", "canon": "major", "eight-bar-blues": "major",
  "minor-blues": "minor", "one-six-two-five": "major", "three-six-two-five": "major",
```

To this:

```ts
  "one-four-five": "major", "twelve-bar-blues": "minor blues", "vi-iv-i-v": "major",
  "i-iv-vi-v": "major", "canon": "major", "eight-bar-blues": "minor blues",
  "minor-blues": "minor blues", "one-six-two-five": "major", "three-six-two-five": "major",
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/progressions/progressionDomain.test.ts -t "home scale"`

Expected: FAIL. The "declares the expected scale for every preset" test fails
because the source still declares `"major"` / `"minor"` for the three blues
presets while the fixture now expects `"minor blues"`.

(The "every preset's steps resolve ... in its home scale" test should already
PASS at this step, because `resolveProgressionStep(step, "minor blues", "C")`
resolves `I/IV/V` with `:7` overrides against the `minor` harmony parent to the
same C/F/G roots — none become unavailable. If that test fails, stop: the
assumption in the spec is wrong and needs revisiting before changing source.)

---

### Task 2: Change the blues presets' scale in the source

**Files:**
- Modify: `src/progressions/progressionDomain.ts:244-253`

- [ ] **Step 1: Update the three preset specs**

In `src/progressions/progressionDomain.ts`, in the `PRESET_SPECS` array, change
the `scale` field on the three blues presets.

Change this:

```ts
  { id: "twelve-bar-blues", label: "12-bar blues", category: "blues", scale: "major",
    spec: "I*4:7 IV*2:7 I*2:7 V:7 IV:7 I:7 V:7" },
```

To this:

```ts
  { id: "twelve-bar-blues", label: "12-bar blues", category: "blues", scale: "minor blues",
    spec: "I*4:7 IV*2:7 I*2:7 V:7 IV:7 I:7 V:7" },
```

Change this:

```ts
  { id: "eight-bar-blues", label: "8-bar blues", category: "blues", scale: "major",
    spec: "I*2:7 IV*2:7 I:7 V:7 I:7 V:7" },
  { id: "minor-blues", label: "Minor blues", category: "blues", scale: "minor",
    spec: "i*4 iv*2 i*2 V:7 iv i V:7" },
```

To this:

```ts
  { id: "eight-bar-blues", label: "8-bar blues", category: "blues", scale: "minor blues",
    spec: "I*2:7 IV*2:7 I:7 V:7 I:7 V:7" },
  { id: "minor-blues", label: "Minor blues", category: "blues", scale: "minor blues",
    spec: "i*4 iv*2 i*2 V:7 iv i V:7" },
```

- [ ] **Step 2: Run the domain tests to verify they pass**

Run: `pnpm test -- src/progressions/progressionDomain.test.ts`

Expected: PASS. Both the "home scale" tests pass — the declared scales now match
the fixture, and every preset's steps still resolve in its home scale.

---

### Task 3: Full verification and commit

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`

Expected: PASS. No other test referenced the blues presets' `scale` field
(`src/store/progressionAtoms.test.ts` only loads `one-five-six-four`), so no
further fixtures need updating. If any unexpected test fails, read its
assertion — it likely encodes the old `"major"`/`"minor"` overlay and should be
updated to `"minor blues"`.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`

Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm run build`

Expected: PASS (`tsc -b && vite build`).

- [ ] **Step 4: Manual smoke check (optional but recommended)**

Run: `pnpm run dev`, open the app, and in the Song tab load each blues preset
(12-bar blues, 8-bar blues, Minor blues). Confirm:
- the fretboard overlay shows the **minor blues** scale, and
- every progression step shows a resolved chord (none greyed-out / unavailable).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/progressionDomain.ts src/progressions/progressionDomain.test.ts
git commit -m "fix(progression): default blues presets to the minor blues overlay scale

The 12-bar, 8-bar, and minor blues presets loaded a major/natural-minor
overlay. Default them to the minor blues scale (the idiomatic soloing scale)
while chord resolution stays unchanged via the existing minor-blues -> minor
harmony parent mapping."
```
