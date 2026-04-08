# FretFlow — Copilot Instructions

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Type-check (tsc -b) then Vite production build
npm run lint       # ESLint across all .ts/.tsx files
```

No test suite exists.

## Architecture

Single-page React 19 + TypeScript app. All UI state lives in `App.tsx`. No routing, no server.

| File | Role |
|------|------|
| `theory.ts` | Music theory constants and pure functions (NOTES, SCALES, CHORDS, ENHARMONICS, key signatures, circle of fifths) |
| `guitar.ts` | Guitar-specific logic — tunings, fretboard layout, note/frequency math |
| `shapes.ts` | Procedural CAGED and 3NPS fingering pattern computation, polygon vertex generation |
| `audio.ts` | Web Audio API synth singleton (`GuitarSynth` class) |
| `Fretboard.tsx` | Pure rendering component — receives all data as props, no internal domain state. Renders SVG polygon overlays for CAGED shape backgrounds. |
| `CircleOfFifths.tsx` | SVG annular ring for root note selection with scale degree labels |
| `App.tsx` | All app state, polygon boundary merging, `DrawerSelector` inline dropdown component |

### CAGED Shape System

Shape computation flows through three layers:

1. **`shapes.ts`** — `getCagedCoordinates()` finds note positions per shape using `SHAPE_CONFIGS` (fret ranges) and generates polygon vertices using `SHAPE_TEMPLATES_PENT` (fixed per-string left/right offsets from anchor fret). For major-quality scales, shapes are remapped via relative minor (`MAJOR_TO_MINOR_SHAPE`) — e.g., C Major Pentatonic "G shape" uses the same pattern as A Minor Pentatonic "E shape".

2. **`App.tsx`** — Merges adjacent polygon boundaries at midpoints where shapes meet, then adds a small overlap buffer (0.3 frets) to eliminate SVG anti-aliasing gaps.

3. **`Fretboard.tsx`** — Converts polygon vertices (fret/string coordinates) to pixel SVG polygons. Each shape polygon has left-edge vertices (top→bottom) and right-edge vertices (bottom→top), with vertical caps extending to the top and bottom of the fretboard.

### Circle of Fifths Degrees

Scale degrees on the circle use chromatic interval conversion: `(circleIntervalIndex * 7) % 12` converts circle-of-fifths position to chromatic semitones, then looks up the degree from chromatic-interval-based maps (`MAJOR_CHROMATIC_DEGREES` / `MINOR_CHROMATIC_DEGREES`). Notes not in the scale get no degree label.

## Key Conventions

**Notes are always stored as sharps internally.** The chromatic scale is `NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']` in `theory.ts`. Flat display is resolved at render time only via `getNoteDisplay(note, rootNote)`, which checks `FLAT_KEYS` to decide whether to show e.g. `Bb` vs `A#`.

**Tuning arrays are ordered highest string first** (index 0 = thinnest/highest string, index 5 = thickest). Standard tuning: `['E4','B3','G3','D3','A2','E2']`.

**Fretboard cell coordinates** use `"stringIndex-fretIndex"` string keys (e.g. `"2-7"`) throughout props and maps.

**Fretboard rendering coordinates:**
- `STRING_ROW_PX = 40` — height per string row
- `fretToX(fret)` — maps fret number to pixel X (uniform width, including fret 0)
- `stringCenterY(s)` — vertical center of string `s` (`STRING_ROW_PX / 2 + s * STRING_ROW_PX`)

**Note classification** in `Fretboard.tsx`:
- `root-active` — root note that is highlighted or a chord tone
- `chord-tone` — in scale + in chord
- `note-active` — in scale, no chord overlay
- `note-scale-only` — in scale, chord overlay active (can be hidden by `hideNonChordNotes`)
- `chord-outside` — in chord but not in scale
- `note-inactive` — neither

**CSS variables** are defined in `index.css` under `:root`. CAGED shape colors use `--caged-e/d/c/a/g` and `--caged-*-bg` tokens.

**`clsx`** is used for all conditional class composition.

**`framer-motion`** — use for any new animations rather than CSS transitions alone.

**`DrawerSelector`** is an inline accordion dropdown defined at the top of `App.tsx`. Use it for any new selector controls to maintain visual consistency.
