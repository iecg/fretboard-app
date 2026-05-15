# FretFlow Expo Mobile App — Design Spec

## Overview

Add a React Native mobile app to the FretFlow monorepo at `packages/mobile`, built with Expo (managed workflow) and Expo Router. The app achieves full feature parity with the web app across multiple phases, consuming `@fretflow/core` for all music theory and fretboard logic.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Expo (managed) + Expo Router | File-based routing, OTA updates, EAS Build |
| Rendering | react-native-svg | Web fretboard is already SVG; 1:1 component mapping |
| State | Jotai | Consistency with web app; atoms follow same patterns |
| Audio | Deferred to Phase 5 | Mobile audio synthesis is complex; ship visuals first |
| Location | `packages/mobile` | npm workspace alongside `packages/core` |
| Monorepo | npm workspaces + Metro symlink resolution | Approach A — standard Expo monorepo pattern |

## 1. Monorepo Integration

### Workspace Configuration

Add `packages/mobile` to the root `package.json` workspaces:

```json
"workspaces": ["packages/core", "packages/mobile"]
```

### Metro Bundler

`packages/mobile/metro.config.js`:
- `watchFolders`: include monorepo root so Metro resolves hoisted deps and `packages/core/src`
- `resolver.nodeModulesPaths`: point to root `node_modules`
- `resolver.extraNodeModules`: map `@fretflow/core` to `../core/src/index.ts` for live hot-reload

### TypeScript

`packages/mobile/tsconfig.json`:
- Extends shared strict settings (ES2023, strict mode)
- Adds `jsx: "react-jsx"` for React Native
- Path alias: `@fretflow/core` → `../core/src/index.ts`
- Added as a project reference in root `tsconfig.json`

### Node Version

Expo SDK 53 supports Node 18+. The monorepo requires Node >=24. No conflict.

## 2. Project Structure

```
packages/mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout: Jotai Provider, theme, SafeArea
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab navigator layout
│   │   ├── scales.tsx            # Scale selection tab
│   │   ├── chords.tsx            # Chord overlay tab
│   │   ├── circle.tsx            # Circle of Fifths tab
│   │   └── view.tsx              # View/fingering settings tab
│   ├── settings.tsx              # Settings (modal route)
│   └── help.tsx                  # Help (modal route)
├── components/
│   ├── fretboard/                # SVG fretboard (ported from web)
│   │   ├── FretboardSVG.tsx
│   │   ├── FretboardBackground.tsx
│   │   ├── FretboardNoteLayer.tsx
│   │   ├── FretboardShapeLayer.tsx
│   │   ├── FretboardHitTargetLayer.tsx
│   │   ├── FretboardDefs.tsx
│   │   └── FretNumbersRow.tsx
│   ├── controls/                 # Scale/chord/fingering controls
│   │   ├── NoteGrid.tsx
│   │   ├── ScaleSelector.tsx
│   │   ├── ChordOverlayControls.tsx
│   │   ├── FingeringPatternControls.tsx
│   │   ├── ToggleBar.tsx
│   │   ├── StepperControl.tsx
│   │   └── FretRangeControl.tsx
│   ├── practice/                 # Practice bar
│   │   └── ChordPracticeBar.tsx
│   ├── circle-of-fifths/         # Circle of Fifths SVG
│   │   ├── CircleOfFifths.tsx
│   │   └── DegreeChordList.tsx
│   └── shared/                   # Reusable primitives
│       ├── Card.tsx
│       ├── Header.tsx
│       └── IconButton.tsx
├── store/                        # Jotai atoms (mobile persistence layer)
│   ├── atoms.ts                  # Barrel re-export
│   └── storage.ts                # AsyncStorage adapter for atomWithStorage
├── hooks/
│   └── useLayout.ts              # Screen dimensions / orientation
├── theme/
│   ├── tokens.ts                 # Design tokens (colors, spacing, typography)
│   └── ThemeProvider.tsx         # Light/dark theme context
├── assets/                       # App icon, splash screen, fonts
├── app.json                      # Expo configuration
├── metro.config.js               # Metro bundler config (monorepo)
├── package.json
├── tsconfig.json
└── babel.config.js
```

## 3. Navigation Architecture

The app uses Expo Router with a **persistent fretboard + bottom tabs** pattern matching the web app's mobile layout:

- **Root layout** (`app/_layout.tsx`): Wraps app in Jotai `Provider`, `SafeAreaProvider`, and `ThemeProvider`. Renders the fretboard component persistently above a `<Slot>` for tab content. Defines modal routes for settings/help.
- **Tab layout** (`app/(tabs)/_layout.tsx`): Bottom tab navigator with 4 tabs — Scales, Chords, Circle of Fifths, View — matching the web's `BottomTabBar`.
- **Modal routes**: Settings and Help rendered as full-screen modals via Expo Router's modal presentation.

The fretboard is NOT inside the tab navigator — it lives in the root layout so it persists across tab changes without re-mounting.

## 4. Fretboard SVG Port

The web app already renders the fretboard as SVG. The port maps directly:

| Web (react) | Mobile (react-native-svg) |
|-------------|--------------------------|
| `<svg>` | `<Svg>` |
| `<rect>` | `<Rect>` |
| `<circle>` | `<Circle>` |
| `<line>` | `<Line>` |
| `<polygon>` | `<Polygon>` |
| `<text>` | `<SvgText>` |
| `<g>` | `<G>` |
| `<defs>` | `<Defs>` |
| `<pattern>` | `<Pattern>` |

Key differences:
- **Styling**: CSS classes/`data-*` attributes → inline SVG props (`fill`, `stroke`, `opacity`). Build a style resolver that maps semantic note roles to fill/stroke values.
- **Touch**: `onClick` → `onPress` / `onPressIn` on SVG elements. react-native-svg supports press events on individual shapes.
- **Scrolling**: Horizontal scroll via `ScrollView` wrapping the `<Svg>`, or `PanResponder` / `react-native-gesture-handler` for pinch-to-zoom.
- **Geometry**: `@fretflow/core` provides music theory calculations (notes on frets, tunings, scale/chord data). The SVG pixel geometry (fret positions, widths, note bubble sizes) must be built for mobile, adapting the web app's `fretboardGeometry.ts` approach to use `useWindowDimensions()` for screen-based sizing.
- **No CSS patterns**: Wood grain texture via SVG `<Pattern>` with `<Image>` or simplified solid fills.

## 5. State Management

### Atom Reuse Strategy

The Jotai atoms from the web app fall into three categories:

1. **Directly reusable** — Pure derived atoms that depend only on other atoms and `@fretflow/core` logic. These can be copied with zero changes: `scaleNotesAtom`, `chordTonesAtom`, `effectiveShapeDataAtom`, all computed/derived atoms.

2. **Persistence swap** — Atoms using `atomWithStorage` (localStorage). Replace with a React Native equivalent backed by `@react-native-async-storage/async-storage`. Create a `atomWithAsyncStorage` utility in `store/storage.ts` that mirrors the web's `atomWithStorage` API.

3. **Mobile-specific** — Layout atoms (`useLayoutMode` → `useWindowDimensions`), audio atoms (stubbed), and any mobile-only state (e.g., gesture state).

### Persistence

Create `store/storage.ts` with a Jotai `createStorage` adapter for AsyncStorage. All persisted atoms (root note, scale name, chord type, fingering pattern, theme, etc.) use this adapter to maintain state across app restarts.

## 6. Phasing Plan

### Phase 1: Foundation (MVP)
- Expo project scaffold with monorepo integration
- Metro bundler configured for `@fretflow/core` resolution
- Basic fretboard SVG rendering (static — strings, frets, inlays, note circles)
- Scale selection (NoteGrid + scale family/member picker)
- Jotai store with AsyncStorage persistence
- Light/dark theme support
- Bottom tab navigation shell

### Phase 2: Interactivity & Shapes
- Touch interactions on fretboard notes
- Fingering pattern controls (CAGED, 3NPS, one-string, two-strings)
- Shape polygon rendering on fretboard
- Auto-center/scroll to active shape region
- Fret range controls (start/end stepper)
- Zoom via pinch gesture

### Phase 3: Chords & Practice
- Chord overlay controls (root, type, degree/absolute mode)
- Practice lens system (targets, tension, intervals, guide-tones)
- Chord practice bar with note pills and role grouping
- Note semantic coloring (tension, guide-tone, chord-tone)

### Phase 4: Circle of Fifths & Settings
- Circle of Fifths SVG (interactive root selection)
- Degree chord list
- Settings screen (instrument, appearance, notation, view, chord layout)
- Help screen

### Phase 5: Audio & Polish
- Audio playback via `expo-av` or `expo-audio`
- Note samples or synthesis
- App icon and splash screen
- EAS Build configuration
- App Store / Play Store metadata

## 7. Key Dependencies

```json
{
  "dependencies": {
    "@fretflow/core": "workspace:*",
    "expo": "~53.0.0",
    "expo-router": "~5.0.0",
    "react": "19.0.0",
    "react-native": "0.79.x",
    "react-native-svg": "^15.x",
    "react-native-safe-area-context": "^5.x",
    "react-native-screens": "^4.x",
    "jotai": "^2.20.0",
    "@react-native-async-storage/async-storage": "^2.x",
    "react-native-gesture-handler": "^2.x",
    "react-native-reanimated": "^3.x",
    "lucide-react-native": "^0.x"
  }
}
```

Note: Exact versions will be determined by Expo SDK 53 compatibility at scaffold time. React version must match what Expo SDK 53 ships with (likely React 19.0.0, not 19.2.x from the web app — this is fine since `@fretflow/core` has no React dependency).

## 8. Testing Strategy

- **Unit tests**: Vitest for pure logic (shared with core's test setup)
- **Component tests**: React Native Testing Library (`@testing-library/react-native`)
- **E2E**: Deferred — evaluate Maestro or Detox once the app is functional
- **Manual testing**: Expo Go for rapid iteration during development

## 9. Out of Scope

- Push notifications
- Offline-first / sync
- User accounts / auth
- In-app purchases
- App Store submission (Phase 5 sets up EAS Build but doesn't submit)
- Tablet-optimized layouts (use phone layout initially; responsive improvements later)
