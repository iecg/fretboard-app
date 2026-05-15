# Design Spec: Full Chord CAGED Shapes

Support traditional "full" chord voicings (CAGED system, open chords, and barre chords) in the chord overlay.

## Goals
- Allow users to toggle a "Full Chords" mode.
- Highlight standard 5-6 string CAGED voicings instead of global chord tones.
- Use the existing "connector" visual style to group these shapes.

## Proposed Changes

### 1. Core Library (`@fretflow/core`)
- **Templates:** Define `CHORD_SHAPE_TEMPLATES` in `packages/core/src/shapes/templates.ts`.
  - These will be similar to scale templates but specifically for 5-6 string chord fingerings.
  - Initial support: Major, Minor, and Dominant 7th shapes for C, A, G, E, and D.
- **Filtering Logic:** Add a helper to identify if a set of fret positions matches a standard CAGED shape.

### 2. State Management (`src/store`)
- **Atom:** Add `fullChordsEnabledAtom` (boolean) to `chordOverlayAtoms.ts`.
- **Derived Atom:** Create `fullChordPositionsAtom` that computes the `(string, fret)` pairs for all valid CAGED shapes of the active chord on the fretboard.

### 3. UI Components (`src/components`)
- **ChordOverlayControls:** Add a "Full Chords" toggle switch.
- **Fretboard / SVG:**
  - If `fullChordsEnabled` is true, filter the displayed chord dots to only those in `fullChordPositions`.
  - Update `useChordConnectorPolylines` to prioritize or exclusively display these "full" shapes.

### 4. Logic Adjustments
- **Note Semantics:** Update `noteSemanticMapAtom` to flag notes that are part of a "Full Chord" shape so they can be styled differently (or be the only ones shown).
- **Connectors:** The connector logic needs to be updated to handle voicings with redundant notes (e.g., a 6-string E-shape barre chord has three roots). The current logic looks for "exactly one of each member".

## Success Criteria
- Toggling "Full Chords" hides scattered chord tones and shows only standard CAGED shapes.
- The shapes are tied together with the connector "envelope".
- Works for any root and moves diatonically in "Degree" mode.
