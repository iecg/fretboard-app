# Guitar Note Geometry Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drastically speed up Fretboard matrix generation and note lookups in `guitar.ts` by exploiting the 12-fret repeating geometry of the instrument and caching Tonal.js parsing.

**Architecture:** 
1. `getFretboardNotes` currently calls `getFretNote` (which calls Tonal's `parseNote`) 150 times per tuning generation. We will instead parse the open string exactly once, derive the 12-note chromatic repeating sequence, and geometrically "stamp" it across the fretboard using modulo arithmetic.
2. We will add a micro-cache to `parseNote` so that subsequent calls for the same string (e.g., `"E4"`) return instantly without invoking Tonal's regex engine.

**Tech Stack:** TypeScript, Tonal.js, Vitest.

---

### Task 1: Micro-cache Tonal.js Parsing

**Files:**
- Modify: `packages/core/src/guitar.ts:14-22`

- [ ] **Step 1: Write the failing test**

Add a test block to `packages/core/src/guitar.test.ts` to ensure `parseNote` is memoized properly (testing identity):
```typescript
describe('parseNote caching', () => {
  it('returns the exact same parsed object instance for identical inputs', () => {
    const note1 = parseNote('E4');
    const note2 = parseNote('E4');
    expect(note1).toBe(note2); // reference equality proves cache hit
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fretflow/core test run packages/core/src/guitar.test.ts`
Expected: FAIL on reference equality.

- [ ] **Step 3: Write minimal implementation**

Modify `packages/core/src/guitar.ts` around line 14:
```typescript
const parseNoteCache = new Map<string, NoteWithOctave | null>();

/**
 * Parses a note string like "E4" or "A#3".
 * Returns a NoteWithOctave object or null if the string is invalid.
 */
export function parseNote(noteString: string): NoteWithOctave | null {
  if (!noteString) return null;
  if (parseNoteCache.has(noteString)) {
    return parseNoteCache.get(noteString) as NoteWithOctave | null;
  }
  
  const tonalNote = Note.get(noteString);
  if (tonalNote.empty || tonalNote.oct === undefined) {
    parseNoteCache.set(noteString, null);
    return null;
  }
  
  const result = {
    noteName: tonalNote.letter + (tonalNote.acc || ""),
    octave: tonalNote.oct,
  };
  
  parseNoteCache.set(noteString, result);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fretflow/core test run packages/core/src/guitar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/guitar.ts packages/core/src/guitar.test.ts
git commit -m "perf(core): micro-cache parseNote to avoid repeated Tonal.js regex parsing"
```

### Task 2: O(1) Fretboard Matrix Stamping

**Files:**
- Modify: `packages/core/src/guitar.ts:75-84` (inside `getFretboardNotes`)

- [ ] **Step 1: Write the failing test**

No new tests needed. We will run the existing test suite (`guitar.test.ts` and `voicings.test.ts`) to verify our geometric stamping exactly matches the old loop output.

- [ ] **Step 2: Replace the 150x loop with geometric stamping**

Modify `packages/core/src/guitar.ts` inside `getFretboardNotes`. Instead of looping `frets` times and calling `getFretNote`, derive the 12-note sequence once per string and map it:
```typescript
export function getFretboardNotes(tuning: string[], frets: number = 24): string[][] {
  const key = `${tuning.join(',')}|${frets}`;
  let cached = fretboardCache.get(key);
  if (!cached) {
    cached = tuning.map(stringNote => {
      const parsed = parseNote(stringNote);
      const noteName = parsed?.noteName ?? "E";
      const openIndex = NOTES.indexOf(noteName);
      
      // Calculate the 12-note repeating chromatic sequence for this string
      const chromaticSequence = Array.from({ length: 12 }, (_, i) => NOTES[(openIndex + i) % 12]);
      
      // Stamp the sequence across the entire fretboard length geometrically
      return Array.from({ length: frets + 1 }, (_, fret) => chromaticSequence[fret % 12]);
    });
    fretboardCache.set(key, cached);
  }
  return cached;
}
```

- [ ] **Step 3: Run tests to verify**

Run: `pnpm --filter @fretflow/core test run packages/core/src/guitar.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/guitar.ts
git commit -m "perf(core): generate fretboard geometrically using 12-note chromatic sequence stamping"
```
