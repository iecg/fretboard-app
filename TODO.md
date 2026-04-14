# FretFlow - Improvement Roadmap

Comprehensive analysis of improvement opportunities in the FretFlow guitar learning application.

**Last Updated**: 2026-04-12

---

## Critical Issues (Fix Immediately)

### 1. State Management Fragmentation
**File**: `src/App.tsx` (lines 89-211)  
**Severity**: CRITICAL  
**Effort**: HIGH  
**Impact**: VERY HIGH

**Problem**:
- 19+ independent state variables managed separately
- 23+ individual localStorage `setItem()` calls
- useEffect with 18 dependencies triggers excessive re-renders
- No single source of truth for related settings
- Reset handler requires 20+ manual state resets
- Error-prone sync logic between linked states (e.g., `linkChordRoot`)

**Current Code Pattern**:
```typescript
const [rootNote, setRootNote] = useState(...)
const [scaleName, setScaleName] = useState(...)
const [chordRoot, setChordRoot] = useState(...)
// ... 16 more similar patterns
```

**Recommended Solution**:
- Consolidate into a single state object
- Create custom `useAppState` hook wrapping initialization and persistence
- Consider lightweight state management library (Zustand, Jotai) if complexity grows
- Batch localStorage updates with debouncing

**Testing**: Ensure state persistence, reset, and linking still work after refactor

---

### 2. Missing Error Handling
**Files**: All (especially `src/guitar.ts`, `src/audio.ts`, `src/App.tsx`)  
**Severity**: CRITICAL  
**Effort**: MEDIUM  
**Impact**: HIGH

**Problems**:
- `parseNote()` silently falls back to octave 4 for invalid input
- No validation when reading from localStorage
- No try-catch blocks anywhere
- Unsafe type casting in audio.ts: `(window as unknown as { webkitAudioContext: ... })`
- JSON.parse() could fail silently
- No graceful degradation if Web Audio API unavailable

**Required Changes**:
- [ ] Add explicit validation in `parseNote()` with error throwing
- [ ] Validate all localStorage data on load with sensible defaults
- [ ] Guard AudioContext creation with proper type checks
- [ ] Add try-catch to localStorage/JSON operations
- [ ] Log warnings for development, silent fallbacks for production
- [ ] Consider Zod schema validation for persisted data

**Example Issues**:
```typescript
// Current (silent failure)
export function parseNote(noteString: string): NoteWithOctave {
  const match = noteString.match(/^([A-G]#?)(\d)$/);
  if (match) {
    return { noteName: match[1], octave: parseInt(match[2], 10) };
  }
  return { noteName: noteString, octave: 4 }; // SILENT FALLBACK
}

// Better (explicit)
if (!match) {
  console.warn(`Invalid note format: "${noteString}", using C4`);
  return { noteName: 'C', octave: 4 };
}
```

---

### 3. Code Duplication in Summary Rendering
**File**: `src/App.tsx` (lines 356-431)  
**Severity**: HIGH  
**Effort**: LOW  
**Impact**: HIGH

**Problem**:
Nearly identical code appears twice:
- Scale notes summary (lines 383-402)
- Chord notes summary (lines 408-426)

Both compute: root index → chromatic interval → degree → Roman numeral → color

**Duplicated Block** (~40 lines):
```typescript
const rootIdx = NOTES.indexOf(rootNote);
const noteIdx = NOTES.indexOf(n);
const chromaticInterval = rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : -1;
const degree = chromaticInterval !== -1 ? INTERVAL_NAMES[chromaticInterval] : null;
const degreeMap = getDegreesForScale(scaleName);
const romanNumeral = chromaticInterval !== -1 ? degreeMap[chromaticInterval] : undefined;
const degreeColor = romanNumeral ? DEGREE_COLORS[romanNumeral] : undefined;
```

**Recommended Solution**:
- [ ] Extract a `<SummaryNote>` component accepting note, rootNote, scaleName
- [ ] Or create custom hook `useSummaryNoteData(note, rootNote, scaleName)`
- [ ] Reduce ~40 lines of duplication

---

## High-Impact Issues (Fix Next)

### 4. Missing Accessibility (A11y) Features
**Files**: All components  
**Severity**: HIGH  
**Effort**: MEDIUM  
**Impact**: HIGH

**Problems**:
- No ARIA labels on interactive elements
- No role attributes on custom buttons
- No semantic HTML (`<nav>`, `<section>`, `<button>`)
- Circle of Fifths SVG lacks alt text
- No keyboard navigation support
- No `:focus-visible` styles
- DrawerSelector dropdown not keyboard accessible
- Note bubbles lack semantic meaning

**Example Problem** (Fretboard.tsx):
```typescript
<button className="toolbar-btn" disabled={...} onClick={...}>
  {label}
</button>
// Missing: aria-label, role, title, tabindex
```

**Required Changes**:
- [ ] Add `aria-label` to all interactive elements
- [ ] Implement keyboard navigation (arrow keys, Enter, Escape)
- [ ] Add `:focus-visible` styles in CSS
- [ ] Use semantic HTML elements
- [ ] Add ARIA labels to Circle of Fifths segments
- [ ] Test with screen reader (NVDA, VoiceOver)
- [ ] Test keyboard-only navigation

**Priority Components**:
1. Toolbar buttons (Fretboard.tsx)
2. Circle of Fifths (CircleOfFifths.tsx)
3. DrawerSelector dropdown
4. Settings panel
5. Note bubbles/frets

---

### 5. Undocumented Complex Shape Polygon Logic
**File**: `src/shapes.ts` (~668 lines)  
**Severity**: HIGH  
**Effort**: MEDIUM  
**Impact**: HIGH

**Problems**:
- 6 shape template sets (7-NOTE, DORIAN, PHRYGIAN, LOCRIAN, HARMONIC_MINOR, PENTATONIC)
- Complex polygon vertex wrapping logic (lines 307-397)
- Deduplication across strings (lines 236-296)
- ~150 lines of nested loop logic with minimal explanation
- Hard to debug visual glitches
- Difficult to add new scales/modes

**Recommended Solution**:
- [ ] Add detailed inline comments explaining geometry algorithms
- [ ] Document template system with ASCII diagrams
- [ ] Extract helper functions with clear names:
  - `isShapeTruncated(shape, fretRange): boolean`
  - `wrapNoteToAdjacentString(note, fromString, toString): Note`
  - `deduplicateVertices(vertices): vertices`
- [ ] Create visual debug tool to test polygon generation
- [ ] Document why each shape template is necessary
- [ ] Add comments explaining mode remapping (MAJOR_TO_MINOR_SHAPE)

**Example Comment Needed**:
```typescript
// Line 299: Why MAX_WRAP_OVERSHOOT = 2?
// Answer: [Document this]
```

---

## Medium-Impact Issues (High Priority)

### 6. Type Safety Gaps
**Files**: Multiple  
**Severity**: MEDIUM  
**Effort**: MEDIUM  
**Impact**: MEDIUM

**Issue a**: Unsafe type casting (audio.ts, line 8)
```typescript
// Current (unsafe)
this.ctx = new (window.AudioContext || 
  (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

// Better
const AudioContextClass = window.AudioContext || 
  (window as any).webkitAudioContext || 
  (window as any).mozAudioContext;
if (!AudioContextClass) throw new Error('Web Audio API not supported');
this.ctx = new AudioContextClass();
```

**Issue b**: Array type casting (Fretboard.tsx, line 259)
```typescript
// Current
{[["Open", 0], ["Mid", 5], ["High", 12]].map(([label, fret]) => (
  <button key={label as string}>{label}</button>
))}

// Better - use const assertion
const QUICK_JUMP_TARGETS = [
  ["Open", 0],
  ["Mid", 5],
  ["High", 12],
] as const;
```

**Issue c**: No runtime validation of persisted data
```typescript
// If someone saves invalid displayFormat to localStorage, could break
const savedFormat = localStorage.getItem('displayFormat');
// No validation that it's in ['notes', 'intervals']
```

**Required Changes**:
- [ ] Replace `as unknown` casts with proper type guards
- [ ] Use `const` assertion for tuples to preserve literal types
- [ ] Add Zod/Yup schema for localStorage validation
- [ ] Type-safe localStorage wrapper with validation

---

### 7. Performance Issues
**File**: `src/App.tsx` (lines 188-211)  
**Severity**: MEDIUM  
**Effort**: MEDIUM  
**Impact**: MEDIUM

**Problems**:
- Persister `useEffect` has 18 dependencies (any change triggers all 23 localStorage writes)
- No batching of localStorage updates
- No debouncing
- Expensive re-renders of Fretboard component
- Re-renders even for non-visual state changes

**Recommended Solution**:
- [ ] Batch localStorage updates (single write per state change batch)
- [ ] Debounce persistence (500-1000ms)
- [ ] Use `useTransition` for non-critical updates
- [ ] Memoize expensive computed values with `useCallback`
- [ ] Profile with React DevTools to identify unnecessary re-renders
- [ ] Consider moving audio mute state to separate context

**Example**:
```typescript
// Current: 23 writes per change
useEffect(() => {
  localStorage.setItem('rootNote', rootNote);
  localStorage.setItem('scaleName', scaleName);
  // ... 21 more
}, [rootNote, scaleName, ...18 more]);

// Better: batch with debounce
useEffect(() => {
  const timer = setTimeout(() => {
    const state = { rootNote, scaleName, ... };
    localStorage.setItem('appState', JSON.stringify(state));
  }, 500);
  return () => clearTimeout(timer);
}, [rootNote, scaleName, ...]);
```

---

### 8. Insufficient Test Coverage
**Files**: `src/__tests__/` (4 test files)  
**Severity**: MEDIUM  
**Effort**: HIGH  
**Impact**: MEDIUM

**Current Coverage**:
- ✅ guitar.ts (good coverage)
- ✅ theory.ts (good coverage)
- ❌ App.tsx (NO TESTS)
- ❌ Fretboard.tsx (NO TESTS)
- ❌ CircleOfFifths.tsx (NO TESTS)
- ❌ audio.ts (NO TESTS)
- ❌ No integration tests
- ❌ No accessibility tests

**Required Tests**:
- [ ] App.tsx state initialization and reset
- [ ] State persistence to/from localStorage
- [ ] Fretboard rendering with various scale/chord combinations
- [ ] Circle of Fifths interaction
- [ ] Audio playback initialization
- [ ] localStorage fallback handling
- [ ] Mobile vs desktop layout switching
- [ ] CAGED shape visibility toggling
- [ ] Fret range/zoom interactions
- [ ] Keyboard navigation (once accessibility added)

**Test Template**:
```typescript
describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists state to localStorage', async () => {
    render(<App />);
    // Change root note
    // Verify localStorage updated
  });

  it('recovers state from localStorage', () => {
    localStorage.setItem('appState', JSON.stringify({...}));
    render(<App />);
    // Verify state loaded
  });
});
```

---

### 9. localStorage Validation Missing
**File**: `src/App.tsx` (lines 93-184)  
**Severity**: MEDIUM  
**Effort**: MEDIUM  
**Impact**: MEDIUM

**Problems**:
- No validation when reading from localStorage
- Assumes stored values match expected types
- Manual browser data editing could crash app
- `JSON.parse()` could throw unhandled errors

**Required Changes**:
- [ ] Create schema validation with Zod/Yup
- [ ] Validate all persisted data on load
- [ ] Provide helpful error messages
- [ ] Implement migration system for breaking changes
- [ ] Test corrupted localStorage scenarios

**Example**:
```typescript
// Current (unsafe)
const saved = localStorage.getItem('cagedShapes');
if (saved !== null) {
  try {
    return new Set(JSON.parse(saved) as CagedShape[]);
  } catch {
    // Silent failure
  }
}
return new Set();

// Better (validated)
const AppStateSchema = z.object({
  rootNote: z.enum(['C', 'C#', 'D', ...]),
  scaleName: z.enum(['Major', 'Minor', ...]),
  cagedShapes: z.array(z.enum(['C', 'A', 'G', 'E', 'D'])),
});

function loadState() {
  const saved = localStorage.getItem('appState');
  if (!saved) return defaults;
  try {
    return AppStateSchema.parse(JSON.parse(saved));
  } catch (e) {
    console.error('Invalid saved state:', e);
    return defaults;
  }
}
```

---

## Low-to-Medium Impact Issues

### 10. Magic Numbers Scattered Throughout
**Files**: Multiple  
**Severity**: LOW-MEDIUM  
**Effort**: LOW  
**Impact**: LOW

**Examples**:
- `STRING_ROW_PX = 40` (Fretboard.tsx, line 14)
- `ZOOM_MAX_PCT = 300` (Fretboard.tsx, line 15)
- `MAX_WRAP_OVERSHOOT = 2` (shapes.ts, line 299)
- `MAX_FRET = 24` (hardcoded throughout)
- Fret markers: `[3, 5, 7, 9, 12, 15, 17, 19, 21, 24]` (guitar.ts, line 67)

**Solution**:
- [ ] Extract all magic numbers to `src/constants.ts`
- [ ] Document why each value was chosen
- [ ] Use constants in all calculations

---

### 11. Responsive Design Breakpoints Inconsistency
**Files**: `src/App.css`, `src/index.css`  
**Severity**: LOW  
**Effort**: LOW  
**Impact**: LOW

**Issues**:
- Multiple conflicting breakpoints (600px, 767px, 768px, 1024px)
- Inconsistent mobile detection vs CSS breakpoints

**Solution**:
- [x] Unify all breakpoints — documented in RESPONSIVE LAYOUT comment block in App.css (CSS custom properties can't be used in media queries; comment serves as the single source of truth)
- [x] Fix 600px Ko-fi outlier → 767px (aligned with mobile threshold)
- [x] Remove redundant `@media (max-width: 1366px)` wrapper from landscape-tablet rules
- [x] Sync JavaScript `isMobile` detection (768px) with CSS — CSS max-width: 767px is equivalent to JS `< 768` for integer widths; clarified in comment

---

### 12. Long Component Files
**Severity**: LOW-MEDIUM  
**Effort**: HIGH  
**Impact**: LOW

**Current Sizes**:
- App.tsx: 1019 lines (VERY LARGE)
- Fretboard.tsx: 510 lines (LARGE)
- shapes.ts: 668 lines (LARGE)

**Recommended Refactoring**:
- [ ] Extract toolbar from Fretboard → `<FretboardToolbar />`
- [ ] Extract summary area from App → `<SummaryArea />`
- [ ] Extract settings from App → `<SettingsPanel />`
- [ ] Extract shapes algorithm utils → `shapeAlgorithms.ts`

---

### 13. Audio Synth Initialization Side Effects
**File**: `src/audio.ts`  
**Severity**: LOW  
**Effort**: LOW  
**Impact**: LOW

**Problem**:
```typescript
init() {
  if (!this.ctx) {
    this.ctx = new AudioContext();
  }
  if (this.ctx.state === 'suspended') {
    this.ctx.resume(); // May fail silently
  }
}
```

**Issue**: `resume()` might fail if called outside user gesture, no error feedback

**Solution**:
- [ ] Return Promise from `init()` to indicate success/failure
- [ ] Log errors to console in development
- [ ] Show user message if audio fails
- [ ] Test on various browsers (Safari, Firefox require user gesture)

---

### 14. Missing Input Boundary Validation
**Severity**: LOW  
**Effort**: LOW  
**Impact**: LOW

**Examples**:
- `getFretNoteWithOctave()` doesn't validate fretNumber >= 0
- `getCircleNoteLabels()` assumes scaleName exists
- No bounds checking in polygon math

**Solution**:
- [ ] Add explicit guards with informative errors
- [ ] Consider branded types for validated inputs
- [ ] Throw on invalid input vs. silent fallback

---

## Quick Wins (Good ROI - Easy Implementation)

| Task | File | Effort | Impact | Notes |
|------|------|--------|--------|-------|
| Extract localStorage helper | src/App.tsx | 30m | HIGH | Reduces 93 lines |
| Create `<SummaryNote>` component | src/App.tsx | 45m | HIGH | Eliminates 40 lines duplication |
| Add ARIA labels to toolbar | src/Fretboard.tsx | 1h | HIGH | Improves a11y |
| Extract magic numbers | src/constants.ts | 1h | LOW | Better maintainability |
| Add parseNote() validation | src/guitar.ts | 30m | HIGH | Prevents silent failures |
| Add `:focus-visible` styles | src/index.css | 15m | MEDIUM | Better keyboard UX |

---

## Positive Observations

✅ Excellent test coverage for utility functions (guitar.ts, theory.ts)  
✅ Beautiful, responsive UI with dark mode  
✅ Well-structured CSS with variables and clear organization  
✅ Good use of TypeScript types in function signatures  
✅ Clever polygon algorithm for CAGED shapes visualization  
✅ Proper separation of business logic from React components  
✅ Good use of `useMemo` to avoid unnecessary computations  
✅ Mobile-responsive design with thoughtful breakpoints  
✅ Clean, readable code overall (despite complexity)

---

## Implementation Priority

### Phase 1: Critical (Essential)
1. Consolidate state management
2. Add error handling throughout
3. Extract summary note duplication

### Phase 2: High Value (Important)
4. Add accessibility features
5. Document shapes.ts complexity
6. Fix type safety gaps

### Phase 3: Medium Value (Nice to Have)
7. Optimize performance (batching, debouncing)
8. Increase test coverage
9. Add localStorage validation

### Phase 4: Polish (Low Priority)
10. Extract magic numbers
11. Unify breakpoints
12. Refactor component sizes

---

## Testing Checklist

- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run lint` - no eslint errors
- [ ] Run `npm run build` - production build succeeds
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test mobile (iOS Safari, Chrome Mobile)
- [ ] Test keyboard navigation (once added)
- [ ] Test with screen reader (once a11y added)
- [ ] Test localStorage in DevTools console
- [ ] Test audio in different browsers

---

## Reference: Current Test Files

- `src/__tests__/guitar.test.ts` - String/fret calculations
- `src/__tests__/theory.test.ts` - Scale/chord theory
- `src/__tests__/shapes.test.ts` - CAGED shape logic
- `src/__tests__/DrawerSelector.test.tsx` - DrawerSelector component
- `vitest.config.ts` - Test configuration
