# Full Chord CAGED Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Full Chords mode that swaps the current pitch-wide chord overlay for canonical 5-6 string CAGED voicings, keeps those shapes connected with the envelope renderer, and follows the active degree in degree mode.

**Architecture:** Add a small core matcher that turns canonical open-shape chord templates into concrete fretboard voicings for the active chord and tuning. Feed those coordinate-accurate voicings into Jotai derived atoms, then into `FretboardSVG` as explicit position keys and explicit connector voicings so rendering no longer relies on the existing “one of each pitch-class” connector search. Keep note-name semantics for lensing, but make coordinate filtering the source of truth for “only show full-chord notes,” because `noteSemanticMapAtom` is keyed by note name rather than `"string-fret"`.

**Tech Stack:** React 19, TypeScript, Jotai, Vitest, Testing Library, `@fretflow/core`.

---

## Canonical voicing reference

Use these as the source-of-truth fret arrays when authoring the template catalog. Arrays are written **low E → high E** because that is how chord charts are usually documented; convert them to the app’s **high string → low string** order when storing template data.

| Shape | Major | Minor | Dominant 7th |
|---|---|---|---|
| C | `x32010` | `x3101x` | `x32310` |
| A | `x02220` | `x02210` | `x02020` |
| G | `320003` | `355333` | `320001` |
| E | `022100` | `022000` | `020100` |
| D | `xx0232` | `xx0231` | `xx0212` |

These are the only supported qualities in v1. If the user switches to any other chord quality while Full Chords is on, the UI should automatically turn Full Chords off.

Full Chords is also **6-string only** in v1. On alternate tunings with fewer than 6 strings, the matcher should return no shapes and the control should auto-turn off with an explanatory hint.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/core/src/shapes/templates.ts` | Modify | Store the full-chord template catalog alongside existing scale-template data. |
| `packages/core/src/shapes/fullChordShapes.ts` | Create | Convert template data into concrete fretboard matches for a chord root, quality, tuning, and max fret. |
| `packages/core/src/shapes/fullChordShapes.test.ts` | Create | Lock matcher behavior for supported qualities, tuning order, and unsupported-quality fallbacks. |
| `packages/core/src/shapes/index.ts` | Modify | Re-export full-chord types/helpers from the shapes package surface. |
| `src/store/chordOverlayAtoms.ts` | Modify | Add persisted Full Chords state plus derived full-chord match / position atoms. |
| `src/store/chordOverlayAtoms.test.ts` | Modify | Cover the new state atoms in manual and degree modes. |
| `src/store/atoms.ts` | Modify | Re-export the new atoms from the barrel. |
| `src/hooks/useChordState.ts` | Modify | Expose Full Chords state to UI components. |
| `src/hooks/useFretboardState.ts` | Modify | Expose Full Chords positions and matches to the fretboard container. |
| `packages/core/src/theory.ts` | Modify | Extend `NoteSemantics` with a lightweight Full Chords flag. |
| `src/store/practiceLensAtoms.ts` | Modify | Mark active chord semantics as “full chord mode” when the feature is enabled. |
| `src/components/FretboardSVG/hooks/useNoteData.ts` | Modify | Gate chord-tone classification by coordinate when Full Chords mode is active. |
| `src/components/FretboardSVG/FretboardSVG.tsx` | Modify | Accept explicit Full Chords position keys and connector voicings in the SVG render pipeline. |
| `src/components/Fretboard/Fretboard.tsx` | Modify | Thread Full Chords positions and voicings from state into `FretboardSVG`. |
| `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` | Modify | Support explicit voicing input so redundant notes render one envelope per full shape. |
| `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts` | Modify | Lock the redundant-root / explicit-voicing connector path. |
| `src/components/FretboardSVG/FretboardSVG.test.tsx` | Modify | Assert that Full Chords mode hides scattered tones and only renders matched coordinates. |
| `src/components/ChordOverlayControls/ChordOverlayControls.tsx` | Modify | Add the Full Chords toggle and the auto-disable behavior for unsupported qualities. |
| `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` | Modify | Cover toggle rendering, supported-quality gating, and auto-off behavior. |

---

### Task 1: Build the core full-chord template matcher

**Files:**
- Modify: `packages/core/src/shapes/templates.ts`
- Create: `packages/core/src/shapes/fullChordShapes.ts`
- Create: `packages/core/src/shapes/fullChordShapes.test.ts`
- Modify: `packages/core/src/shapes/index.ts`

- [ ] **Step 1: Write the failing matcher tests**

Create `packages/core/src/shapes/fullChordShapes.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "../guitar";
import { getFullChordShapeMatches } from "./fullChordShapes";

describe("getFullChordShapeMatches", () => {
  it("returns the open E-shape major voicing for E major", () => {
    const matches = getFullChordShapeMatches({
      chordRoot: "E",
      chordType: "Major Triad",
      tuning: STANDARD_TUNING,
      maxFret: 24,
    });

    expect(matches.some((match) =>
      match.shape === "E" &&
      match.positionKeys.join("|") === "0-0|1-0|2-1|3-2|4-2|5-0",
    )).toBe(true);
  });

  it("returns the open A-shape minor voicing for A minor", () => {
    const matches = getFullChordShapeMatches({
      chordRoot: "A",
      chordType: "Minor Triad",
      tuning: STANDARD_TUNING,
      maxFret: 24,
    });

    expect(matches.some((match) =>
      match.shape === "A" &&
      match.positionKeys.join("|") === "0-0|1-1|2-2|3-2|4-0",
    )).toBe(true);
  });

  it("returns the open C7 voicing for C dominant 7th", () => {
    const matches = getFullChordShapeMatches({
      chordRoot: "C",
      chordType: "Dominant 7th",
      tuning: STANDARD_TUNING,
      maxFret: 24,
    });

    expect(matches.some((match) =>
      match.shape === "C" &&
      match.positionKeys.join("|") === "0-0|1-1|2-3|3-2|4-3",
    )).toBe(true);
  });

  it("keeps supported 4-note shapes such as open D major", () => {
    const matches = getFullChordShapeMatches({
      chordRoot: "D",
      chordType: "Major Triad",
      tuning: STANDARD_TUNING,
      maxFret: 24,
    });

    expect(matches.some((match) =>
      match.shape === "D" &&
      match.positionKeys.join("|") === "0-2|1-3|2-2|3-0",
    )).toBe(true);
  });

  it("returns an empty array for unsupported chord qualities", () => {
    expect(getFullChordShapeMatches({
      chordRoot: "C",
      chordType: "Major 7th",
      tuning: STANDARD_TUNING,
      maxFret: 24,
    })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run:

```bash
npm run test -- packages/core/src/shapes/fullChordShapes.test.ts
```

Expected: FAIL with `Cannot find module './fullChordShapes'` or missing export errors for `getFullChordShapeMatches`.

- [ ] **Step 3: Add the template catalog and matcher**

In `packages/core/src/shapes/templates.ts`, add the new types and export:

```ts
export type FullChordQuality = "Major Triad" | "Minor Triad" | "Dominant 7th";

export interface FullChordTemplate {
  shape: CagedShape;
  quality: FullChordQuality;
  anchorString: number;
  anchorFretOffset: number;
  fretsHighToLow: readonly (number | null)[];
}

export const FULL_CHORD_TEMPLATES: readonly FullChordTemplate[] = [
  { shape: "C", quality: "Major Triad", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [0, 1, 0, 2, 3, null] },
  { shape: "A", quality: "Major Triad", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 2, 2, 2, 0, null] },
  { shape: "G", quality: "Major Triad", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 0, 0, 0, 2, 3] },
  { shape: "E", quality: "Major Triad", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 1, 2, 2, 0] },
  { shape: "D", quality: "Major Triad", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [2, 3, 2, 0, null, null] },
  { shape: "C", quality: "Minor Triad", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [null, 1, 0, 1, 3, null] },
  { shape: "A", quality: "Minor Triad", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 1, 2, 2, 0, null] },
  { shape: "G", quality: "Minor Triad", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [3, 3, 3, 5, 5, 3] },
  { shape: "E", quality: "Minor Triad", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 0, 2, 2, 0] },
  { shape: "D", quality: "Minor Triad", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [1, 3, 2, 0, null, null] },
  { shape: "C", quality: "Dominant 7th", anchorString: 4, anchorFretOffset: 3, fretsHighToLow: [0, 1, 3, 2, 3, null] },
  { shape: "A", quality: "Dominant 7th", anchorString: 4, anchorFretOffset: 0, fretsHighToLow: [0, 2, 0, 2, 0, null] },
  { shape: "G", quality: "Dominant 7th", anchorString: 5, anchorFretOffset: 3, fretsHighToLow: [1, 0, 0, 0, 2, 3] },
  { shape: "E", quality: "Dominant 7th", anchorString: 5, anchorFretOffset: 0, fretsHighToLow: [0, 0, 1, 0, 2, 0] },
  { shape: "D", quality: "Dominant 7th", anchorString: 3, anchorFretOffset: 0, fretsHighToLow: [2, 1, 2, 0, null, null] },
];
```

Create `packages/core/src/shapes/fullChordShapes.ts` with:

```ts
import { CHORD_DEFINITIONS, NOTES } from "../theory";
import { getFretboardNotes } from "../guitar";
import type { CagedShape } from "./templates";
import { FULL_CHORD_TEMPLATES, type FullChordQuality } from "./templates";

export interface FullChordMatchNote {
  stringIndex: number;
  fretIndex: number;
  noteName: string;
}

export interface FullChordMatch {
  shape: CagedShape;
  quality: FullChordQuality;
  rootFret: number;
  positionKeys: string[];
  notes: FullChordMatchNote[];
}

export function getFullChordShapeMatches({
  chordRoot,
  chordType,
  tuning,
  maxFret,
}: {
  chordRoot: string;
  chordType: string | null;
  tuning: readonly string[];
  maxFret: number;
}): FullChordMatch[] {
  if (chordType !== "Major Triad" && chordType !== "Minor Triad" && chordType !== "Dominant 7th") {
    return [];
  }
  if (tuning.length !== 6) {
    return [];
  }

  const board = getFretboardNotes([...tuning], maxFret);
  const chordNotes = new Set(CHORD_DEFINITIONS[chordType].members.map((member) => {
    const rootIndex = NOTES.indexOf(chordRoot);
    return NOTES[(rootIndex + member.semitone) % 12];
  }));

  return FULL_CHORD_TEMPLATES
    .filter((template) => template.quality === chordType)
    .flatMap((template) => {
      const anchorRow = board[template.anchorString];
      const matches: FullChordMatch[] = [];

      for (let anchorFret = 0; anchorFret <= maxFret; anchorFret++) {
        if (anchorRow[anchorFret] !== chordRoot) continue;

        const notes = template.fretsHighToLow.flatMap((fret, stringIndex) => {
          if (fret === null) return [];
          const fretIndex = fret + anchorFret - template.anchorFretOffset;
          if (fretIndex < 0 || fretIndex > maxFret) return [];
          return [{
            stringIndex,
            fretIndex,
            noteName: board[stringIndex]![fretIndex]!,
          }];
        });

        if (notes.length < 4) continue;
        if (notes.some((note) => !chordNotes.has(note.noteName))) continue;

        matches.push({
          shape: template.shape,
          quality: template.quality,
          rootFret: anchorFret,
          positionKeys: notes.map((note) => `${note.stringIndex}-${note.fretIndex}`),
          notes,
        });
      }

      return matches;
    });
}
```

Update `packages/core/src/shapes/index.ts`:

```ts
export type { FullChordMatch, FullChordMatchNote } from "./fullChordShapes";
export type { FullChordQuality } from "./templates";
export { getFullChordShapeMatches } from "./fullChordShapes";
```

- [ ] **Step 4: Run the core tests**

Run:

```bash
npm run test -- packages/core/src/shapes/fullChordShapes.test.ts packages/core/src/shapes/shapes.test.ts
```

Expected: PASS for the new matcher tests and the existing shapes tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shapes/templates.ts \
        packages/core/src/shapes/fullChordShapes.ts \
        packages/core/src/shapes/fullChordShapes.test.ts \
        packages/core/src/shapes/index.ts
git commit -m "feat(chord-overlay): add full chord shape matcher"
```

---

### Task 2: Add Full Chords state and derived coordinate sets

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Modify: `src/store/chordOverlayAtoms.test.ts`
- Modify: `src/store/atoms.ts`
- Modify: `src/hooks/useChordState.ts`

- [ ] **Step 1: Write failing atom tests**

Append to `src/store/chordOverlayAtoms.test.ts`:

```ts
import {
  fullChordsEnabledAtom,
  fullChordMatchesAtom,
  fullChordPositionsAtom,
} from "./chordOverlayAtoms";

describe("chordOverlayAtoms — full chords", () => {
  it("returns E-shape full-chord coordinates for E major in manual mode", () => {
    const store = makeAtomStore([
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "E"],
      [chordQualityOverrideAtom, "Major Triad"],
      [fullChordsEnabledAtom, true],
    ]);

    expect(store.get(fullChordMatchesAtom).some((match) => match.shape === "E")).toBe(true);
    expect(store.get(fullChordPositionsAtom)).toContain("5-0");
    expect(store.get(fullChordPositionsAtom)).toContain("0-0");
  });

  it("tracks the active degree in degree mode", () => {
    const store = makeAtomStore([
      [chordOverlayModeAtom, "degree"],
      [chordDegreeAtom, "V"],
      [rootNoteAtom, "C"],
      [scaleNameAtom, "Major"],
      [chordQualityOverrideAtom, "Dominant 7th"],
      [fullChordsEnabledAtom, true],
    ]);

    expect(store.get(chordRootAtom)).toBe("G");
    expect(store.get(fullChordMatchesAtom).length).toBeGreaterThan(0);
  });

  it("returns no matches when the active chord quality is unsupported", () => {
    const store = makeAtomStore([
      [chordOverlayModeAtom, "manual"],
      [chordRootOverrideAtom, "C"],
      [chordQualityOverrideAtom, "Major 7th"],
      [fullChordsEnabledAtom, true],
    ]);

    expect(store.get(fullChordMatchesAtom)).toEqual([]);
    expect(store.get(fullChordPositionsAtom)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the atom tests and confirm the new assertions fail**

Run:

```bash
npm run test -- src/store/chordOverlayAtoms.test.ts
```

Expected: FAIL with missing atom exports for `fullChordsEnabledAtom`, `fullChordMatchesAtom`, and `fullChordPositionsAtom`.

- [ ] **Step 3: Implement the atoms and hook plumbing**

In `src/store/chordOverlayAtoms.ts`, add:

```ts
import { getFullChordShapeMatches } from "@fretflow/core";
import { currentTuningAtom } from "./layoutAtoms";

export const fullChordsEnabledAtom = atomWithStorage<boolean>(
  k("fullChordsEnabled"),
  false,
  booleanStorage,
  GET_ON_INIT,
);

export const fullChordMatchesAtom = atom((get) => {
  if (!get(fullChordsEnabledAtom)) return [];

  return getFullChordShapeMatches({
    chordRoot: get(chordRootAtom),
    chordType: get(chordTypeAtom),
    tuning: get(currentTuningAtom),
    maxFret: 24,
  });
});

export const fullChordPositionsAtom = atom((get) => {
  return get(fullChordMatchesAtom).flatMap((match) => match.positionKeys);
});
```

Update `src/store/atoms.ts`:

```ts
  fullChordsEnabledAtom,
  fullChordMatchesAtom,
  fullChordPositionsAtom,
```

Update `src/hooks/useChordState.ts`:

```ts
import {
  fullChordsEnabledAtom,
  fullChordMatchesAtom,
  fullChordPositionsAtom,
  currentTuningAtom,
} from "../store/atoms";

const [fullChordsEnabled, setFullChordsEnabled] = useAtom(fullChordsEnabledAtom);
const fullChordMatches = useAtomValue(fullChordMatchesAtom);
const fullChordPositions = useAtomValue(fullChordPositionsAtom);
const currentTuning = useAtomValue(currentTuningAtom);

return {
  // existing values...
  currentTuning,
  fullChordsEnabled,
  setFullChordsEnabled,
  fullChordMatches,
  fullChordPositions,
};
```

- [ ] **Step 4: Run the state tests**

Run:

```bash
npm run test -- src/store/chordOverlayAtoms.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/chordOverlayAtoms.ts \
        src/store/chordOverlayAtoms.test.ts \
        src/store/atoms.ts \
        src/hooks/useChordState.ts
git commit -m "feat(chord-overlay): add full chord state atoms"
```

---

### Task 3: Render only matched coordinates and drive connectors from explicit voicings

**Files:**
- Modify: `packages/core/src/theory.ts`
- Modify: `src/store/practiceLensAtoms.ts`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Modify: `src/components/FretboardSVG/hooks/useNoteData.ts`
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`
- Modify: `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`
- Modify: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write the failing connector and render tests**

Append to `src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts`:

```ts
it("builds one connector from an explicit 6-string E-shape voicing with repeated roots", () => {
  const result = buildChordConnectorPolylines(
    [],
    ["E", "G#", "B"],
    fretCenterX,
    stringYAt,
    STRING_ROW_PX,
    "E",
    undefined,
    [{
      voicingKey: "0,0|1,0|2,1|3,2|4,2|5,0",
      notes: [
        { stringIndex: 0, fretIndex: 0, noteName: "E" },
        { stringIndex: 1, fretIndex: 0, noteName: "B" },
        { stringIndex: 2, fretIndex: 1, noteName: "G#" },
        { stringIndex: 3, fretIndex: 2, noteName: "E" },
        { stringIndex: 4, fretIndex: 2, noteName: "B" },
        { stringIndex: 5, fretIndex: 0, noteName: "E" },
      ],
    }],
  );

  expect(result).toHaveLength(1);
  expect(result[0]!.voicingKey).toBe("0,0|1,0|2,1|3,2|4,2|5,0");
});
```

Append to `src/components/FretboardSVG/FretboardSVG.test.tsx`:

```tsx
it("only renders full-chord coordinates when full-chord positions are provided", () => {
  const noteSemantics = new Map([
    ["C", { isScaleRoot: true, isChordRoot: true, isChordTone: true, isInScale: true, isColorTone: false, isGuideTone: false, isTension: false, isFullChordMode: true }],
    ["E", { isScaleRoot: false, isChordRoot: false, isChordTone: true, isInScale: true, isColorTone: false, isGuideTone: false, isTension: false, isFullChordMode: true }],
    ["G", { isScaleRoot: false, isChordRoot: false, isChordTone: true, isInScale: true, isColorTone: false, isGuideTone: false, isTension: false, isFullChordMode: true }],
  ]);

  const { container } = render(
    <FretboardSVG
      {...BASE_PROPS}
      chordTones={["C", "E", "G"]}
      chordRoot="C"
      highlightNotes={["C", "D", "E", "F", "G", "A", "B"]}
      noteSemantics={noteSemantics}
      fullChordPositionKeys={new Set(["0-0", "1-1", "2-0", "3-2", "4-3"])}
      fullChordVoicings={[{
        voicingKey: "0,0|1,1|2,0|3,2|4,3",
        notes: [
          { stringIndex: 0, fretIndex: 0, noteName: "E" },
          { stringIndex: 1, fretIndex: 1, noteName: "C" },
          { stringIndex: 2, fretIndex: 0, noteName: "G" },
          { stringIndex: 3, fretIndex: 2, noteName: "E" },
          { stringIndex: 4, fretIndex: 3, noteName: "C" },
        ],
      }]}
    />,
  );

  expect(container.querySelectorAll(".chord-root, .chord-tone-in-scale").length).toBe(5);
});
```

- [ ] **Step 2: Run those test files and confirm they fail**

Run:

```bash
npm run test -- src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts src/components/FretboardSVG/FretboardSVG.test.tsx
```

Expected: FAIL because `buildChordConnectorPolylines` and `FretboardSVG` do not yet accept explicit full-chord voicings/position keys.

- [ ] **Step 3: Implement coordinate filtering and explicit voicing connectors**

Update `packages/core/src/theory.ts`:

```ts
export interface NoteSemantics {
  isScaleRoot: boolean;
  isChordRoot: boolean;
  isChordTone: boolean;
  isInScale: boolean;
  isColorTone: boolean;
  isGuideTone: boolean;
  isTension: boolean;
  memberName?: ChordMemberName;
  scaleDegree?: DegreeId;
  isDiatonicChord?: boolean;
  isFullChordMode?: boolean;
}
```

Update `src/store/practiceLensAtoms.ts`:

```ts
import { fullChordsEnabledAtom } from "./chordOverlayAtoms";

// inside noteSemanticMapAtom map.set(...)
isFullChordMode: get(fullChordsEnabledAtom),
```

Update `src/components/FretboardSVG/FretboardSVG.tsx` props and connector call:

```ts
import type { FullChordMatchNote } from "@fretflow/core";

fullChordPositionKeys?: Set<string>;
fullChordVoicings?: Array<{
  voicingKey: string;
  notes: FullChordMatchNote[];
}>;

const noteData = useNoteData({
  // existing props...
  noteSemantics,
  fullChordPositionKeys,
});

const connectorPolylines = useChordConnectorPolylines({
  noteData: chordNoteData,
  chordToneNames: fingeringPattern === "one-string" || fingeringPattern === "two-strings" ? [] : chordTones,
  fretCenterX,
  stringYAt,
  stringRowPx,
  chordRoot: chordRoot ?? "",
  yBounds: connectorYBounds,
  explicitVoicings: fullChordVoicings,
});
```

Update `src/components/FretboardSVG/hooks/useNoteData.ts`:

```ts
  fullChordPositionKeys,
}: UseNoteDataProps & { fullChordPositionKeys?: Set<string> }) {
  // ...
  const positionKey = `${stringIndex}-${fretIndex}`;
  const isFullChordCoordinate = !fullChordPositionKeys || fullChordPositionKeys.size === 0
    ? true
    : fullChordPositionKeys.has(positionKey);

  const noteClass = isNoteHidden
    ? "note-inactive"
    : effectiveSemantics
      ? classifyNoteFromSemantics(
          effectiveSemantics,
          isChordInRange && isFullChordCoordinate,
          isInActiveShape,
          hasChordOverlay,
          isHighlighted,
        )
      : classifyNote(
          isScaleRoot,
          isChordRootNote,
          isColorNote,
          isHighlighted,
          isChordTone && isFullChordCoordinate,
          hasChordOverlay,
          isChordInRange && isFullChordCoordinate,
          isInActiveShape,
        );
```

Update `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts`:

```ts
export interface ExplicitChordConnectorVoicing {
  voicingKey: string;
  notes: Array<{ stringIndex: number; fretIndex: number; noteName: string }>;
}

export interface UseChordConnectorPolylinesParams {
  noteData: NoteData[];
  chordToneNames: string[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
  stringRowPx: number;
  chordRoot: string;
  yBounds?: ConnectorYBounds;
  explicitVoicings?: ExplicitChordConnectorVoicing[];
}

export function buildChordConnectorPolylines(
  noteData: NoteData[],
  chordToneNames: string[],
  fretCenterX: (fretIndex: number) => number,
  stringYAt: (stringIndex: number, x: number) => number,
  stringRowPx: number,
  chordRoot: string,
  yBounds?: ConnectorYBounds,
  explicitVoicings: ExplicitChordConnectorVoicing[] = [],
): ChordConnectorVoicing[] {
  if (explicitVoicings.length > 0) {
    return explicitVoicings.map((voicing) => {
      const rawVertices = voicing.notes.map((note) => {
        const x = fretCenterX(note.fretIndex);
        return { x, y: stringYAt(note.stringIndex, x) };
      });
      const radius = resolveConnectorRadiusPx({
        vertices: rawVertices,
        preferredRadius: applyConnectorRadiusFloor(
          stringRowPx * CHORD_CONNECTOR_BASE_RADIUS_FACTOR,
          stringRowPx,
        ),
        yBounds,
        edgeSafe: false,
      });
      const pathStr = offsetOpenPolylinePath(rawVertices, radius);
      return {
        paths: { fill: pathStr, outline: pathStr },
        vertices: rawVertices,
        paletteIndex: inversionPaletteIndex(
          voicing.notes.map((note) => ({ ...note, octave: 0, noteClass: "chord-tone-in-scale", displayValue: note.noteName, applyDimOpacity: false, applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 }, isHidden: false, isTension: false, isGuideTone: false })),
          chordRoot,
          chordToneNames,
        ),
        voicingKey: voicing.voicingKey,
      };
    });
  }

  // keep existing search-based logic unchanged below
}

export function useChordConnectorPolylines({
  noteData,
  chordToneNames,
  fretCenterX,
  stringYAt,
  stringRowPx,
  chordRoot,
  yBounds,
  explicitVoicings = [],
}: UseChordConnectorPolylinesParams): ChordConnectorVoicing[] {
  return useMemo(
    () =>
      buildChordConnectorPolylines(
        noteData,
        chordToneNames,
        fretCenterX,
        stringYAt,
        stringRowPx,
        chordRoot,
        yBounds,
        explicitVoicings,
      ),
    [noteData, chordToneNames, fretCenterX, stringYAt, stringRowPx, chordRoot, yBounds, explicitVoicings],
  );
}
```

- [ ] **Step 4: Run the render and connector tests**

Run:

```bash
npm run test -- src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts src/components/FretboardSVG/FretboardSVG.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theory.ts \
        src/store/practiceLensAtoms.ts \
        src/components/FretboardSVG/FretboardSVG.tsx \
        src/components/FretboardSVG/hooks/useNoteData.ts \
        src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts \
        src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts \
        src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "feat(chord-overlay): render full chord voicings directly"
```

---

### Task 4: Add the Full Chords control and auto-disable UX

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx`
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Write the failing control tests**

Append to `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`:

```tsx
import { fullChordsEnabledAtom } from "../../store/atoms";
import { within } from "@testing-library/react";

describe("Full Chords toggle", () => {
  it("renders the toggle for supported qualities", () => {
    renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
    const group = screen.getByRole("group", { name: "Full Chords" });

    expect(group).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Off" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "On" })).toBeInTheDocument();
  });

  it("writes fullChordsEnabledAtom when turned on", async () => {
    const store = makeAtomStore([...MANUAL_MODE_SEEDS, [fullChordsEnabledAtom, false]]);
    renderWithStore(<ChordOverlayControls />, store);
    const group = screen.getByRole("group", { name: "Full Chords" });

    await userEvent.click(within(group).getByRole("button", { name: "On" }));
    expect(store.get(fullChordsEnabledAtom)).toBe(true);
  });

  it("automatically turns Full Chords off when the quality becomes unsupported", async () => {
    const store = makeAtomStore([
      ...MANUAL_MODE_SEEDS,
      [fullChordsEnabledAtom, true],
    ]);
    renderWithStore(<ChordOverlayControls />, store);

    await userEvent.click(screen.getByRole("button", { name: "M7" }));
    expect(store.get(fullChordsEnabledAtom)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the controls test file and confirm the new block fails**

Run:

```bash
npm run test -- src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
```

Expected: FAIL because the Full Chords UI is not rendered and the atom is not wired.

- [ ] **Step 3: Implement the toggle and auto-off effect**

Update `src/components/ChordOverlayControls/ChordOverlayControls.tsx`:

```tsx
const FULL_CHORD_SUPPORTED_TYPES = new Set([
  "Major Triad",
  "Minor Triad",
  "Dominant 7th",
]);

const {
  chordType,
  currentTuning,
  fullChordsEnabled,
  setFullChordsEnabled,
} = useChordState();

const fullChordsSupported = chordType != null
  && FULL_CHORD_SUPPORTED_TYPES.has(chordType)
  && currentTuning.length === 6;

useEffect(() => {
  if (fullChordsEnabled && !fullChordsSupported) {
    setFullChordsEnabled(false);
  }
}, [fullChordsEnabled, fullChordsSupported, setFullChordsEnabled]);
```

Render a new control section right below the Lens section:

```tsx
{!isPatternDisabled && chordType ? (
  <div className={shared["control-section"]}>
    <span className={shared["section-label"]}>Full Chords</span>
    <ToggleBar
      options={[
        { value: "off", label: "Off" },
        { value: "on", label: "On", disabled: !fullChordsSupported },
      ]}
      value={fullChordsEnabled ? "on" : "off"}
      onChange={(value) => setFullChordsEnabled(value === "on")}
      label="Full Chords"
      compact={compact}
    />
    <p className={shared["field-hint"]}>
      {fullChordsSupported
        ? "Show canonical CAGED voicings instead of scattered chord tones."
        : currentTuning.length !== 6
          ? "Full Chords currently supports 6-string tunings only."
          : "Full Chords currently supports Major Triad, Minor Triad, and Dominant 7th."}
    </p>
  </div>
) : null}
```

- [ ] **Step 4: Run the controls tests**

Run:

```bash
npm run test -- src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChordOverlayControls/ChordOverlayControls.tsx \
        src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
git commit -m "feat(chord-overlay): add full chords toggle"
```

---

### Task 5: Wire the atoms into the fretboard surface and run full verification

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx`
- Modify: `src/hooks/useFretboardState.ts`
- Modify: `src/hooks/useChordState.ts`

- [ ] **Step 1: Thread Full Chords data through the final call site**

In the component that renders `FretboardSVG`, pass the new props from `useChordState()`:

Update `src/hooks/useFretboardState.ts` first so the fretboard container can read the new data without opening a second set of atoms:

```ts
import {
  fullChordMatchesAtom,
  fullChordPositionsAtom,
} from "../store/atoms";

const fullChordMatches = useAtomValue(fullChordMatchesAtom);
const fullChordPositions = useAtomValue(fullChordPositionsAtom);

return {
  // existing values...
  fullChordMatches,
  fullChordPositions,
};
```

Then update `src/components/Fretboard/Fretboard.tsx`:

```tsx
<FretboardSVG
  // existing props...
  fullChordPositionKeys={new Set(state.fullChordPositions)}
  fullChordVoicings={state.fullChordMatches.map((match) => ({
    voicingKey: match.positionKeys
      .map((key) => key.replace("-", ","))
      .join("|"),
    notes: match.notes,
  }))}
/>
```

- [ ] **Step 2: Run the focused regression suite**

Run:

```bash
npm run test -- \
  packages/core/src/shapes/fullChordShapes.test.ts \
  src/store/chordOverlayAtoms.test.ts \
  src/components/ChordOverlayControls/ChordOverlayControls.test.tsx \
  src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts \
  src/components/FretboardSVG/FretboardSVG.test.tsx
```

Expected: PASS across all five files.

- [ ] **Step 3: Run repository validation**

Run:

```bash
npm run lint && npm run test && npm run build
```

Expected: all three commands PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shapes/templates.ts \
        packages/core/src/shapes/fullChordShapes.ts \
        packages/core/src/shapes/fullChordShapes.test.ts \
        packages/core/src/shapes/index.ts \
        packages/core/src/theory.ts \
        src/store/chordOverlayAtoms.ts \
        src/store/chordOverlayAtoms.test.ts \
        src/store/atoms.ts \
        src/store/practiceLensAtoms.ts \
        src/hooks/useChordState.ts \
        src/hooks/useFretboardState.ts \
        src/components/Fretboard/Fretboard.tsx \
        src/components/FretboardSVG/FretboardSVG.tsx \
        src/components/FretboardSVG/hooks/useNoteData.ts \
        src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts \
        src/components/FretboardSVG/hooks/useChordConnectorPolylines.test.ts \
        src/components/FretboardSVG/FretboardSVG.test.tsx \
        src/components/ChordOverlayControls/ChordOverlayControls.tsx \
        src/components/ChordOverlayControls/ChordOverlayControls.test.tsx
git commit -m "feat(chord-overlay): add full chord caged mode"
```
