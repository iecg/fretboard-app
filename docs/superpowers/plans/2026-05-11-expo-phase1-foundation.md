# Expo Mobile App — Phase 1 Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the FretFlow Expo mobile app as a standalone repo at `~/repos/fretflow-expo`, consuming `@fretflow/core` via local file path, with basic fretboard SVG rendering, scale selection, and tab navigation.

**Architecture:** Standalone Expo project (not a monorepo workspace). Consumes `@fretflow/core` via `file:../fretboard-app/packages/core` during development — will migrate to npm once published. Metro bundler configured to resolve and watch the local core package source for hot-reload. Fretboard renders via react-native-svg with logarithmic fret spacing.

**Tech Stack:** Expo SDK 53, Expo Router v5, React Native 0.79, react-native-svg, Jotai, AsyncStorage, TypeScript

**Working directory:** `/Users/isaaccocar/repos/fretflow-expo`
**Core package location:** `/Users/isaaccocar/repos/fretboard-app/packages/core`

---

### Task 1: Scaffold Expo Project + Git Init

**Files:**
- Create: `/Users/isaaccocar/repos/fretflow-expo/` (via create-expo-app)

- [ ] **Step 1: Create the Expo project**

```bash
cd /Users/isaaccocar/repos
npx create-expo-app@latest fretflow-expo --template tabs
```

This creates a tabs-template Expo project with Expo Router pre-configured.

- [ ] **Step 2: Initialize git repo**

```bash
cd /Users/isaaccocar/repos/fretflow-expo
git init
git add -A
git commit -m "chore: scaffold Expo project with tabs template"
```

- [ ] **Step 3: Add @fretflow/core as local file dependency**

In `package.json`, add to `"dependencies"`:
```json
"@fretflow/core": "file:../fretboard-app/packages/core"
```

Then install:
```bash
npm install
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @fretflow/core local file dependency"
```

---

### Task 2: Configure Metro for Local Core Package

**Files:**
- Modify: `metro.config.js`
- Modify: `tsconfig.json`

- [ ] **Step 1: Configure Metro bundler to resolve and watch @fretflow/core source**

Replace `metro.config.js` with:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const corePackagePath = path.resolve(__dirname, '../fretboard-app/packages/core');

config.watchFolders = [corePackagePath];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@fretflow/core') {
    return {
      filePath: path.resolve(corePackagePath, 'src/index.ts'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

- [ ] **Step 2: Configure TypeScript path alias**

In `tsconfig.json`, add under `"compilerOptions"`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@fretflow/core": ["../fretboard-app/packages/core/src/index.ts"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: Verify core package resolves**

Add a smoke test at the top of `app/(tabs)/index.tsx`:
```ts
import { NOTES } from '@fretflow/core';
console.log('Core package loaded, NOTES:', NOTES);
```

Run:
```bash
npx expo start
```

Verify the log appears in the terminal. Then revert the smoke test line.

- [ ] **Step 4: Commit**

```bash
git add metro.config.js tsconfig.json
git commit -m "feat: configure Metro and TypeScript for local @fretflow/core"
```

---

### Task 3: Install Dependencies + Clean Up Scaffold

**Files:**
- Modify: `package.json`
- Delete: default scaffold boilerplate

- [ ] **Step 1: Install required dependencies**

```bash
npx expo install react-native-svg jotai @react-native-async-storage/async-storage
```

- [ ] **Step 2: Clean up default scaffold**

Remove template boilerplate we'll replace:
```bash
rm -rf components constants hooks assets/images
```

Keep `assets/` directory and `app/` directory (we'll replace screen contents).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: install core deps and clean up scaffold"
```

---

### Task 4: Theme Tokens and Provider

**Files:**
- Create: `theme/tokens.ts`
- Create: `theme/ThemeProvider.tsx`
- Create: `theme/index.ts`

- [ ] **Step 1: Create design tokens**

Create `theme/tokens.ts`:

```ts
const spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
} as const;

const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

const lightColors = {
  background: '#ffffff',
  surface: '#f5f5f7',
  surfaceElevated: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  border: 'rgba(0, 0, 0, 0.12)',
  borderSubtle: 'rgba(0, 0, 0, 0.06)',
  accent: '#06b6d4',
  accentOrange: '#f97316',
  accentViolet: '#8b5cf6',
  noteRoot: '#06b6d4',
  noteActive: '#3b82f6',
  noteChordTone: '#f97316',
  noteScaleOnly: '#94a3b8',
  noteInactive: '#e2e8f0',
  fretboardWood: '#c4956a',
  fretboardWoodDark: '#a67c52',
  fretWire: '#9ca3af',
  stringWire: '#d1d5db',
  stringWireBass: '#9ca3af',
  inlayDot: 'rgba(255, 255, 255, 0.25)',
  nut: '#f5f0e8',
} as const;

const darkColors = {
  background: '#0a0a1a',
  surface: '#141428',
  surfaceElevated: '#1e1e3a',
  text: '#e8e8f0',
  textSecondary: '#9ca3af',
  border: 'rgba(255, 255, 255, 0.12)',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  accent: '#06b6d4',
  accentOrange: '#f97316',
  accentViolet: '#8b5cf6',
  noteRoot: '#06b6d4',
  noteActive: '#3b82f6',
  noteChordTone: '#f97316',
  noteScaleOnly: '#64748b',
  noteInactive: '#1e293b',
  fretboardWood: '#8b6b47',
  fretboardWoodDark: '#6d5339',
  fretWire: '#6b7280',
  stringWire: '#9ca3af',
  stringWireBass: '#6b7280',
  inlayDot: 'rgba(255, 255, 255, 0.15)',
  nut: '#d4cfc5',
} as const;

export type ColorScheme = typeof lightColors;

export const tokens = {
  spacing,
  fontSize,
  radius,
  colors: { light: lightColors, dark: darkColors },
} as const;
```

- [ ] **Step 2: Create ThemeProvider**

Create `theme/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { tokens, type ColorScheme } from './tokens';

interface ThemeContextValue {
  colors: ColorScheme;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: tokens.colors.light,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? tokens.colors.dark : tokens.colors.light;

  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 3: Create barrel export**

Create `theme/index.ts`:

```ts
export { tokens } from './tokens';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ColorScheme } from './tokens';
```

- [ ] **Step 4: Commit**

```bash
git add theme
git commit -m "feat: add theme tokens and ThemeProvider"
```

---

### Task 5: AsyncStorage Persistence Adapter

**Files:**
- Create: `store/storage.ts`

- [ ] **Step 1: Create the storage adapter**

Create `store/storage.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'jotai/utils';

export const STORAGE_PREFIX = 'fretflow:';

export function prefixedKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export const asyncStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export function createMobileStorage<T>() {
  return createJSONStorage<T>(() => asyncStorageAdapter);
}
```

- [ ] **Step 2: Commit**

```bash
git add store
git commit -m "feat: add AsyncStorage persistence adapter for Jotai"
```

---

### Task 6: Scale and Layout Atoms (Jotai Store)

**Files:**
- Create: `store/scaleAtoms.ts`
- Create: `store/layoutAtoms.ts`
- Create: `store/atoms.ts`

- [ ] **Step 1: Create scale atoms**

Create `store/scaleAtoms.ts`:

```ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { getScaleNotes } from '@fretflow/core';
import { createMobileStorage, prefixedKey } from './storage';

const storage = createMobileStorage<string>();

export const rootNoteAtom = atomWithStorage(
  prefixedKey('rootNote'),
  'C',
  storage,
);

export const scaleNameAtom = atomWithStorage(
  prefixedKey('scaleName'),
  'Major',
  storage,
);

export const scaleNotesAtom = atom((get) => {
  const root = get(rootNoteAtom);
  const scale = get(scaleNameAtom);
  return getScaleNotes(root, scale);
});

export const useFlatsAtom = atom((get) => {
  const root = get(rootNoteAtom);
  const FLAT_ROOTS = ['F', 'A#', 'D#', 'G#', 'C#', 'F#'];
  return FLAT_ROOTS.includes(root);
});
```

- [ ] **Step 2: Create layout atoms**

Create `store/layoutAtoms.ts`:

```ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { STANDARD_TUNING, TUNINGS } from '@fretflow/core';
import { createMobileStorage, prefixedKey } from './storage';

const stringStorage = createMobileStorage<string>();
const numberStorage = createMobileStorage<number>();

export const tuningNameAtom = atomWithStorage(
  prefixedKey('tuningName'),
  'Standard',
  stringStorage,
);

export const currentTuningAtom = atom((get) => {
  const name = get(tuningNameAtom);
  return TUNINGS[name] ?? STANDARD_TUNING;
});

export const fretStartAtom = atomWithStorage(
  prefixedKey('fretStart'),
  0,
  numberStorage,
);

export const fretEndAtom = atomWithStorage(
  prefixedKey('fretEnd'),
  12,
  numberStorage,
);
```

- [ ] **Step 3: Create barrel export**

Create `store/atoms.ts`:

```ts
export {
  rootNoteAtom,
  scaleNameAtom,
  scaleNotesAtom,
  useFlatsAtom,
} from './scaleAtoms';

export {
  tuningNameAtom,
  currentTuningAtom,
  fretStartAtom,
  fretEndAtom,
} from './layoutAtoms';
```

- [ ] **Step 4: Commit**

```bash
git add store
git commit -m "feat: add Jotai scale and layout atoms with persistence"
```

---

### Task 7: Root Layout + Tab Navigation Shell

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/scales.tsx`
- Create: `app/(tabs)/chords.tsx`
- Create: `app/(tabs)/circle.tsx`
- Create: `app/(tabs)/view.tsx`

- [ ] **Step 1: Create root layout with providers**

Replace `app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { Provider as JotaiProvider } from 'jotai';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <JotaiProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ThemeProvider>
      </JotaiProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Create tab layout**

Replace `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { useTheme } from '../../theme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen name="scales" options={{ title: 'Scales' }} />
      <Tabs.Screen name="chords" options={{ title: 'Chords' }} />
      <Tabs.Screen name="circle" options={{ title: 'Circle' }} />
      <Tabs.Screen name="view" options={{ title: 'View' }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Create placeholder tab screens**

Create `app/(tabs)/scales.tsx`:

```tsx
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export default function ScalesTab() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Scales</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
});
```

Create `app/(tabs)/chords.tsx`:

```tsx
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export default function ChordsTab() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Chords</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
});
```

Create `app/(tabs)/circle.tsx`:

```tsx
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export default function CircleTab() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Circle of Fifths</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
});
```

Create `app/(tabs)/view.tsx`:

```tsx
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export default function ViewTab() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>View</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
});
```

- [ ] **Step 4: Remove leftover default tab screens**

Delete `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/+not-found.tsx`, and any other default screens from the template that aren't in our tab list.

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "feat: add root layout with providers and tab navigation"
```

---

### Task 8: Fretboard Geometry Module

**Files:**
- Create: `components/fretboard/geometry.ts`

- [ ] **Step 1: Implement geometry module**

Create `components/fretboard/geometry.ts`:

```ts
import {
  NUT_WIDTH,
  NOTE_BUBBLE_RATIO,
  FRET_MARKERS,
  DOUBLE_DOT_FRETS,
} from '@fretflow/core';

export interface FretboardLayout {
  screenWidth: number;
  numStrings: number;
  startFret: number;
  endFret: number;
  stringRowPx: number;
  totalHeight: number;
  totalWidth: number;
  nutWidth: number;
  scalePx: number;
  scaleLeftAnchor: number;
}

interface LayoutInput {
  screenWidth: number;
  numStrings: number;
  startFret: number;
  endFret: number;
  stringRowPx: number;
}

function fretScale(fret: number): number {
  return Math.pow(2, -fret / 12);
}

export function computeFretboardLayout(input: LayoutInput): FretboardLayout {
  const { screenWidth, numStrings, startFret, endFret, stringRowPx } = input;
  const totalHeight = numStrings * stringRowPx;
  const hasNut = startFret === 0;
  const nutWidth = hasNut ? NUT_WIDTH : 0;

  const scaleLeftAnchor = fretScale(startFret);
  const rightAnchor = fretScale(endFret);
  const scaleRange = scaleLeftAnchor - rightAnchor;
  const scalePx = (screenWidth - nutWidth) / scaleRange;
  const totalWidth = screenWidth;

  return {
    screenWidth,
    numStrings,
    startFret,
    endFret,
    stringRowPx,
    totalHeight,
    totalWidth,
    nutWidth,
    scalePx,
    scaleLeftAnchor,
  };
}

export function getFretX(fret: number, layout: FretboardLayout): number {
  const pos = layout.scaleLeftAnchor - fretScale(fret);
  return layout.nutWidth + pos * layout.scalePx;
}

export function getFretCenterX(fret: number, layout: FretboardLayout): number {
  if (fret === 0) {
    return layout.nutWidth / 2;
  }
  const left = getFretX(fret - 1, layout);
  const right = getFretX(fret, layout);
  return (left + right) / 2;
}

export function getFretColumnWidth(fret: number, layout: FretboardLayout): number {
  if (fret === 0) return layout.nutWidth;
  return getFretX(fret, layout) - getFretX(fret - 1, layout);
}

export function getStringY(stringIndex: number, layout: FretboardLayout): number {
  return (stringIndex + 0.5) * layout.stringRowPx;
}

export function getNoteBubbleRadius(layout: FretboardLayout): number {
  return (layout.stringRowPx * NOTE_BUBBLE_RATIO) / 2;
}

export function isMarkerFret(fret: number): boolean {
  return FRET_MARKERS.includes(fret);
}

export function isDoubleMarkerFret(fret: number): boolean {
  return DOUBLE_DOT_FRETS.includes(fret);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/fretboard
git commit -m "feat: add fretboard geometry calculations"
```

---

### Task 9: FretboardBackground SVG Component

**Files:**
- Create: `components/fretboard/FretboardBackground.tsx`

- [ ] **Step 1: Create the background component**

Create `components/fretboard/FretboardBackground.tsx`:

```tsx
import { G, Line, Rect, Circle as SvgCircle } from 'react-native-svg';
import {
  type FretboardLayout,
  getFretX,
  getStringY,
  getFretCenterX,
  isMarkerFret,
  isDoubleMarkerFret,
} from './geometry';
import type { ColorScheme } from '../../theme/tokens';

interface Props {
  layout: FretboardLayout;
  colors: ColorScheme;
}

export function FretboardBackground({ layout, colors }: Props) {
  const { startFret, endFret, numStrings, totalHeight, totalWidth, nutWidth, stringRowPx } = layout;
  const inlayRadius = stringRowPx * 0.18;

  return (
    <G>
      {/* Wood background */}
      <Rect x={0} y={0} width={totalWidth} height={totalHeight} fill={colors.fretboardWood} />

      {/* Nut */}
      {startFret === 0 && (
        <Rect x={0} y={0} width={nutWidth} height={totalHeight} fill={colors.nut} />
      )}

      {/* Fret wires */}
      {Array.from({ length: endFret - startFret }, (_, i) => {
        const fret = startFret + i + 1;
        const x = getFretX(fret, layout);
        return (
          <Line key={`fret-${fret}`} x1={x} y1={0} x2={x} y2={totalHeight} stroke={colors.fretWire} strokeWidth={2} />
        );
      })}

      {/* Inlay dots */}
      {Array.from({ length: endFret - startFret + 1 }, (_, i) => {
        const fret = startFret + i;
        if (fret === 0 || !isMarkerFret(fret)) return null;
        const cx = getFretCenterX(fret, layout);
        const midY = totalHeight / 2;

        if (isDoubleMarkerFret(fret)) {
          const offset = stringRowPx * 1.2;
          return (
            <G key={`inlay-${fret}`}>
              <SvgCircle cx={cx} cy={midY - offset} r={inlayRadius} fill={colors.inlayDot} />
              <SvgCircle cx={cx} cy={midY + offset} r={inlayRadius} fill={colors.inlayDot} />
            </G>
          );
        }

        return <SvgCircle key={`inlay-${fret}`} cx={cx} cy={midY} r={inlayRadius} fill={colors.inlayDot} />;
      })}

      {/* Strings */}
      {Array.from({ length: numStrings }, (_, i) => {
        const y = getStringY(i, layout);
        const isBass = i >= numStrings - 2;
        const thickness = 1 + i * 0.3;
        return (
          <Line key={`string-${i}`} x1={0} y1={y} x2={totalWidth} y2={y}
            stroke={isBass ? colors.stringWireBass : colors.stringWire}
            strokeWidth={thickness} strokeLinecap="round" />
        );
      })}
    </G>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/fretboard/FretboardBackground.tsx
git commit -m "feat: add FretboardBackground SVG component"
```

---

### Task 10: FretboardNoteLayer + useNoteData

**Files:**
- Create: `components/fretboard/useNoteData.ts`
- Create: `components/fretboard/FretboardNoteLayer.tsx`

- [ ] **Step 1: Create the note data hook**

Create `components/fretboard/useNoteData.ts`:

```ts
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { getFretNote } from '@fretflow/core';
import {
  currentTuningAtom,
  scaleNotesAtom,
  rootNoteAtom,
  fretStartAtom,
  fretEndAtom,
} from '../../store/atoms';

export interface NoteData {
  stringIndex: number;
  fret: number;
  note: string;
  isRoot: boolean;
  isInScale: boolean;
}

export function useNoteData(): NoteData[] {
  const tuning = useAtomValue(currentTuningAtom);
  const scaleNotes = useAtomValue(scaleNotesAtom);
  const rootNote = useAtomValue(rootNoteAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);

  return useMemo(() => {
    const notes: NoteData[] = [];
    for (let si = 0; si < tuning.length; si++) {
      const openNote = tuning[si];
      for (let fret = startFret; fret <= endFret; fret++) {
        const note = getFretNote(openNote, fret);
        notes.push({
          stringIndex: si,
          fret,
          note,
          isRoot: note === rootNote,
          isInScale: scaleNotes.includes(note),
        });
      }
    }
    return notes;
  }, [tuning, scaleNotes, rootNote, startFret, endFret]);
}
```

- [ ] **Step 2: Create the note layer component**

Create `components/fretboard/FretboardNoteLayer.tsx`:

```tsx
import { G, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';
import {
  type FretboardLayout,
  getFretCenterX,
  getStringY,
  getNoteBubbleRadius,
} from './geometry';
import { getNoteDisplay } from '@fretflow/core';
import type { NoteData } from './useNoteData';
import type { ColorScheme } from '../../theme/tokens';

interface Props {
  layout: FretboardLayout;
  notes: NoteData[];
  colors: ColorScheme;
  useFlats: boolean;
}

function getNoteColor(note: NoteData, colors: ColorScheme): string {
  if (note.isRoot) return colors.noteRoot;
  if (note.isInScale) return colors.noteActive;
  return colors.noteInactive;
}

export function FretboardNoteLayer({ layout, notes, colors, useFlats }: Props) {
  const r = getNoteBubbleRadius(layout);

  return (
    <G>
      {notes.map((note) => {
        if (!note.isInScale && !note.isRoot) return null;

        const cx = getFretCenterX(note.fret, layout);
        const cy = getStringY(note.stringIndex, layout);
        const fill = getNoteColor(note, colors);
        const displayName = useFlats ? getNoteDisplay(note.note) : note.note;

        return (
          <G key={`${note.stringIndex}-${note.fret}`}>
            <SvgCircle
              cx={cx} cy={cy}
              r={note.isRoot ? r * 1.05 : r}
              fill={fill} opacity={0.9}
            />
            <SvgText
              x={cx} y={cy}
              fill="#ffffff"
              fontSize={r * 0.9}
              fontWeight="600"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {displayName}
            </SvgText>
          </G>
        );
      })}
    </G>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/fretboard/useNoteData.ts components/fretboard/FretboardNoteLayer.tsx
git commit -m "feat: add FretboardNoteLayer and useNoteData hook"
```

---

### Task 11: FretboardSVG Composite Component

**Files:**
- Create: `components/fretboard/FretboardSVG.tsx`
- Create: `components/fretboard/index.ts`

- [ ] **Step 1: Create the composite fretboard component**

Create `components/fretboard/FretboardSVG.tsx`:

```tsx
import { useMemo } from 'react';
import { useWindowDimensions, ScrollView, StyleSheet } from 'react-native';
import Svg from 'react-native-svg';
import { useAtomValue } from 'jotai';
import { useTheme } from '../../theme';
import { currentTuningAtom, fretStartAtom, fretEndAtom, useFlatsAtom } from '../../store/atoms';
import { computeFretboardLayout } from './geometry';
import { FretboardBackground } from './FretboardBackground';
import { FretboardNoteLayer } from './FretboardNoteLayer';
import { useNoteData } from './useNoteData';

const STRING_ROW_PX = 36;

export function FretboardSVG() {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const tuning = useAtomValue(currentTuningAtom);
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const notes = useNoteData();

  const layout = useMemo(
    () => computeFretboardLayout({
      screenWidth,
      numStrings: tuning.length,
      startFret,
      endFret,
      stringRowPx: STRING_ROW_PX,
    }),
    [screenWidth, tuning.length, startFret, endFret],
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <Svg
        width={layout.totalWidth}
        height={layout.totalHeight}
        viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
      >
        <FretboardBackground layout={layout} colors={colors} />
        <FretboardNoteLayer layout={layout} notes={notes} colors={colors} useFlats={useFlats} />
      </Svg>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
});
```

- [ ] **Step 2: Create barrel export**

Create `components/fretboard/index.ts`:

```ts
export { FretboardSVG } from './FretboardSVG';
```

- [ ] **Step 3: Commit**

```bash
git add components/fretboard
git commit -m "feat: add composite FretboardSVG with note data hook"
```

---

### Task 12: NoteGrid + ScaleSelector Controls

**Files:**
- Create: `components/controls/NoteGrid.tsx`
- Create: `components/controls/ScaleSelector.tsx`
- Create: `components/controls/index.ts`

- [ ] **Step 1: Create NoteGrid component**

Create `components/controls/NoteGrid.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { NOTES, getNoteDisplay } from '@fretflow/core';
import { useTheme } from '../../theme';
import { tokens } from '../../theme/tokens';

interface Props {
  selectedNote: string;
  onSelectNote: (note: string) => void;
  useFlats: boolean;
}

export function NoteGrid({ selectedNote, onSelectNote, useFlats }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {NOTES.map((note) => {
        const isSelected = note === selectedNote;
        const displayName = useFlats ? getNoteDisplay(note) : note;
        return (
          <Pressable
            key={note}
            onPress={() => onSelectNote(note)}
            style={[
              styles.cell,
              {
                backgroundColor: isSelected ? colors.accent : colors.surface,
                borderColor: isSelected ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: isSelected ? '#ffffff' : colors.text, fontWeight: isSelected ? '700' : '500' }]}>
              {displayName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, justifyContent: 'center', paddingHorizontal: tokens.spacing.lg },
  cell: { width: 52, height: 44, borderRadius: tokens.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: tokens.fontSize.md },
});
```

- [ ] **Step 2: Create ScaleSelector**

Create `components/controls/ScaleSelector.tsx`:

```tsx
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SCALE_FAMILIES, type ScaleFamily, type ScaleMember } from '@fretflow/core';
import { useTheme } from '../../theme';
import { tokens } from '../../theme/tokens';

interface Props {
  selectedScaleName: string;
  onSelectScale: (scaleName: string) => void;
}

export function ScaleSelector({ selectedScaleName, onSelectScale }: Props) {
  const { colors } = useTheme();

  const activeFamily = SCALE_FAMILIES.find((f: ScaleFamily) =>
    f.members.some((m: ScaleMember) => m.scaleName === selectedScaleName),
  ) ?? SCALE_FAMILIES[0];

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.rowContent}>
        {SCALE_FAMILIES.map((family: ScaleFamily) => {
          const isActive = family.id === activeFamily.id;
          return (
            <Pressable key={family.id} onPress={() => onSelectScale(family.defaultScaleName)}
              style={[styles.familyTab, { backgroundColor: isActive ? colors.accent : colors.surface, borderColor: isActive ? colors.accent : colors.border }]}>
              <Text style={[styles.familyLabel, { color: isActive ? '#ffffff' : colors.text }]}>
                {family.selectorLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.rowContent}>
        {activeFamily.members.map((member: ScaleMember) => {
          const isActive = member.scaleName === selectedScaleName;
          return (
            <Pressable key={member.scaleName} onPress={() => onSelectScale(member.scaleName)}
              style={[styles.memberChip, { backgroundColor: isActive ? colors.surfaceElevated : 'transparent', borderColor: isActive ? colors.accent : colors.border }]}>
              <Text style={[styles.memberLabel, { color: isActive ? colors.accent : colors.textSecondary, fontWeight: isActive ? '600' : '400' }]}>
                {member.shortLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.spacing.md },
  row: { flexGrow: 0 },
  rowContent: { gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.lg },
  familyTab: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.md, borderRadius: tokens.radius.md, borderWidth: 1 },
  familyLabel: { fontSize: tokens.fontSize.sm, fontWeight: '600' },
  memberChip: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.sm, borderRadius: tokens.radius.full, borderWidth: 1 },
  memberLabel: { fontSize: tokens.fontSize.sm },
});
```

- [ ] **Step 3: Create barrel export**

Create `components/controls/index.ts`:

```ts
export { NoteGrid } from './NoteGrid';
export { ScaleSelector } from './ScaleSelector';
```

- [ ] **Step 4: Commit**

```bash
git add components/controls
git commit -m "feat: add NoteGrid and ScaleSelector controls"
```

---

### Task 13: Wire Up Scales Tab with Fretboard

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/scales.tsx`

- [ ] **Step 1: Update root layout to include persistent fretboard**

Replace `app/_layout.tsx`:

```tsx
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Provider as JotaiProvider } from 'jotai';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../theme';
import { FretboardSVG } from '../components/fretboard';

function AppContent() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.fretboardContainer}>
        <FretboardSVG />
      </View>
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <JotaiProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </JotaiProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fretboardContainer: { paddingVertical: 8 },
  content: { flex: 1 },
});
```

- [ ] **Step 2: Wire up scales tab with controls**

Replace `app/(tabs)/scales.tsx`:

```tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAtom, useAtomValue } from 'jotai';
import { useTheme } from '../../theme';
import { tokens } from '../../theme/tokens';
import { rootNoteAtom, scaleNameAtom, useFlatsAtom } from '../../store/atoms';
import { NoteGrid, ScaleSelector } from '../../components/controls';
import { getNoteDisplay } from '@fretflow/core';

export default function ScalesTab() {
  const { colors } = useTheme();
  const [rootNote, setRootNote] = useAtom(rootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const displayRoot = useFlats ? getNoteDisplay(rootNote) : rootNote;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.header, { color: colors.text }]}>{displayRoot} {scaleName}</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Root Note</Text>
        <NoteGrid selectedNote={rootNote} onSelectNote={setRootNote} useFlats={useFlats} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Scale</Text>
        <ScaleSelector selectedScaleName={scaleName} onSelectScale={setScaleName} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingVertical: tokens.spacing.lg, gap: tokens.spacing.xl },
  header: { fontSize: tokens.fontSize['2xl'], fontWeight: '700', textAlign: 'center' },
  section: { gap: tokens.spacing.md },
  sectionTitle: { fontSize: tokens.fontSize.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: tokens.spacing.lg },
});
```

- [ ] **Step 3: Update app.json**

Update `app.json` with:
```json
{
  "expo": {
    "name": "FretFlow",
    "slug": "fretflow",
    "scheme": "fretflow"
  }
}
```

Keep the rest of the default values.

- [ ] **Step 4: Verify the full integration**

```bash
npx expo start
```

Open in Expo Go or simulator. Verify:
1. Fretboard renders at top with strings, frets, inlay dots, and nut
2. Scale notes appear as colored circles on the fretboard
3. Tabs work — Scales tab shows root note grid and scale selector
4. Tapping a different root note updates the fretboard
5. Switching scale family/mode updates the fretboard
6. Other tabs show placeholder text
7. Light/dark theme follows system setting

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire fretboard and scale controls into tab layout"
```
