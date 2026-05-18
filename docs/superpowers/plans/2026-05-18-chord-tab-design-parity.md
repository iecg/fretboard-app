# Chord Tab — Design Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Chord inspector tab to the updated `FretFlow DAW` design — layout, labels, control proportions, hints — and make the voicing engine actually drive the fretboard.

**Architecture:** Seven tasks. i18n strings first, then the new `voicingConnectorsAtom` plus the voicing-engine ungate, then the connector render wiring, then the `ChordOverlayControls` component rewrite, then three independent CSS-restyle tasks (`ChordTypeGrid`, `ToggleBar`, `StringSetPicker`).

**Tech Stack:** React 19 + TypeScript, Jotai atoms, CSS Modules, Vitest + Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-05-18-chord-tab-design-parity-design.md`

**Conventions:** Commit messages are Conventional Commits with a scope **and a lowercase subject** (commitlint rejects PascalCase / start-case subjects). Run `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` before the PR.

---

### Task 1: i18n strings

New UI strings for the Mode label, the static Mode hint, the Quality label, the static Lens hint, and the three voicing-control hints. Add to the type interface and both locales. `controls.connectors` ("Connectors" / "Conectores") already exists — reuse it; do not add it.

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Add the new keys to the type interface**

In `src/i18n/types.ts`, inside the `inspector` block, after the line `voicingStringSet: string;` add:

```ts
    voicingTypeHint: string;
    voicingInversionHint: string;
    voicingStringSetHint: string;
```

In the same file, inside the `controls` block, after the line `chordMode: string;` add:

```ts
    mode: string;
    modeHint: string;
    quality: string;
    lensHint: string;
```

- [ ] **Step 2: Add the English strings**

In `src/i18n/en.ts`, inside the `inspector` object, after `voicingStringSet: "String Set",` add:

```ts
    voicingTypeHint: "How densely the chord is voiced.",
    voicingInversionHint: "Which chord tone is the lowest note.",
    voicingStringSetHint:
      "Full CAGED uses all six strings — pick a subset for partial voicings.",
```

In the same file, inside the `controls` object, after `chordMode: "Chord Mode",` add:

```ts
    mode: "Mode",
    modeHint: "Off · Diatonic degree · Free root.",
    quality: "Quality",
    lensHint: "Landing tones · Tension shows chord notes outside the scale.",
```

- [ ] **Step 3: Add the Spanish strings**

In `src/i18n/es.ts`, inside the `inspector` object, after `voicingStringSet: "Juego de cuerdas",` add:

```ts
    voicingTypeHint: "Qué tan densa es la disposición del acorde.",
    voicingInversionHint: "Qué nota del acorde es la más grave.",
    voicingStringSetHint:
      "CAGED completo usa las seis cuerdas — elige un subconjunto para disposiciones parciales.",
```

In the same file, inside the `controls` object, after `chordMode: "Modo de acorde",` add:

```ts
    mode: "Modo",
    modeHint: "Apagado · Grado diatónico · Raíz libre.",
    quality: "Calidad",
    lensHint: "Notas de aterrizaje · Tensión muestra notas del acorde fuera de la escala.",
```

- [ ] **Step 4: Verify the build typechecks**

Run: `npx tsc -b`
Expected: exit 0, no errors. (The `inspector` / `controls` objects in `en.ts` and `es.ts` must satisfy the `types.ts` interface — a missing key in either locale fails here.)

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): add chord-tab parity strings"
```

---

### Task 2: voicingConnectorsAtom + voicing-engine ungate

Add the `voicingConnectorsAtom` (drives the new Connectors toggle, default `false`) and remove the `fullChordsEnabledAtom` gate from `voicingMatchesAtom` so the voicing engine runs whenever a chord is active. `fullChordsEnabledAtom` keeps its definition (the View tab still imports it).

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts`
- Modify: `src/store/atoms.ts`
- Test: `src/store/chordOverlayAtoms.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/store/chordOverlayAtoms.test.ts`, **replace** the existing test (currently the last `it` in the file):

```ts
  it("voicingMatchesAtom is empty when Full Chords is off", () => {
    const store = createStore();
    store.set(fullChordsEnabledAtom, false);
    expect(store.get(voicingMatchesAtom)).toEqual([]);
  });
```

with these two tests:

```ts
  it("voicingMatchesAtom returns engine output when a chord is active, regardless of Full Chords", () => {
    const store = createStore();
    store.set(chordOverlayModeAtom, "manual");
    store.set(chordRootOverrideAtom, "C");
    store.set(chordQualityOverrideAtom, "Major Triad");
    store.set(fullChordsEnabledAtom, false);
    expect(store.get(voicingMatchesAtom).length).toBeGreaterThan(0);
  });

  it("voicingConnectorsAtom defaults to false", () => {
    const store = createStore();
    expect(store.get(voicingConnectorsAtom)).toBe(false);
  });
```

In the same file's import block (the one importing from `./chordOverlayAtoms`), after `voicingMatchesAtom,` add `voicingConnectorsAtom,`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/store/chordOverlayAtoms.test.ts`
Expected: FAIL — `voicingConnectorsAtom` is not exported, and the first new test fails because `voicingMatchesAtom` still returns `[]` when `fullChordsEnabledAtom` is false.

- [ ] **Step 3: Add `voicingConnectorsAtom`**

In `src/store/chordOverlayAtoms.ts`, immediately after the `voicingStringSetAtom` declaration (the block ending `);` around line 464), add:

```ts
/**
 * Whether the voicing connector lines render on the fretboard. Drives the
 * Chord tab's VOICING-header "Connectors" toggle. Default off — the design
 * screenshot shows connectors hidden.
 */
export const voicingConnectorsAtom = atomWithStorage<boolean>(
  k("voicingConnectors"),
  false,
  booleanStorage,
  GET_ON_INIT,
);
```

- [ ] **Step 4: Remove the voicing-engine gate**

In `src/store/chordOverlayAtoms.ts`, in `voicingMatchesAtom`, delete the first line of the atom body:

```ts
  if (!get(fullChordsEnabledAtom)) return [];
```

The atom body now begins `if (get(chordOverlayHiddenAtom)) return [];`. Leave the rest of the atom — and `fullChordsEnabledAtom`'s own declaration — unchanged.

- [ ] **Step 5: Re-export `voicingConnectorsAtom` from the barrel**

In `src/store/atoms.ts`, in the `export { ... } from "./chordOverlayAtoms";` block, after the line `voicingStringSetAtom,` add `voicingConnectorsAtom,`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/store/chordOverlayAtoms.test.ts`
Expected: PASS — both new tests green.

- [ ] **Step 7: Commit**

```bash
git add src/store/chordOverlayAtoms.ts src/store/atoms.ts src/store/chordOverlayAtoms.test.ts
git commit -m "feat(store): add voicing-connectors atom and ungate the voicing engine"
```

---

### Task 3: Connectors render wiring

Thread a `showChordConnectors` boolean from `voicingConnectorsAtom` through `useFretboardState` → `Fretboard` → `FretboardSVG`, and gate the **chord** connector polylines on it. Interval connectors are unaffected.

**Files:**
- Modify: `src/hooks/useFretboardState.ts`
- Modify: `src/components/Fretboard/Fretboard.tsx`
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx`
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/FretboardSVG/FretboardSVG.test.tsx`, add this test inside the existing `describe("FretboardSVG/FretboardSVG", ...)` block, immediately after the test titled `"renders chord roles only for matched full-chord coordinates and drives one explicit connector"`:

```ts
  it("hides chord connectors when showChordConnectors is false", () => {
    const fullChordVoicings: Array<{
      shape: CagedShape;
      voicingKey: string;
      notes: Array<{ stringIndex: number; fretIndex: number; noteName: string }>;
    }> = [
      {
        shape: "E",
        voicingKey: "e-shape-c-major",
        notes: [
          { stringIndex: 0, fretIndex: 8, noteName: "C" },
          { stringIndex: 1, fretIndex: 8, noteName: "G" },
          { stringIndex: 2, fretIndex: 9, noteName: "E" },
          { stringIndex: 3, fretIndex: 10, noteName: "C" },
          { stringIndex: 4, fretIndex: 10, noteName: "G" },
          { stringIndex: 5, fretIndex: 8, noteName: "C" },
        ],
      },
    ];

    const { container } = render(
      <FretboardSVG
        {...BASE_PROPS}
        chordTones={["C", "E", "G"]}
        chordRoot="C"
        highlightNotes={["C", "E", "G"]}
        fullChordVoicings={fullChordVoicings}
        showChordConnectors={false}
      />,
    );

    expect(container.querySelector(".chord-connectors")).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: FAIL — `showChordConnectors` is not a known prop, and `.chord-connectors` still renders (the existing default behavior).

- [ ] **Step 3: Add the `showChordConnectors` prop to `FretboardSVG`**

In `src/components/FretboardSVG/FretboardSVG.tsx`, in the `FretboardSVGProps` interface, after the `fullChordVoicings?: Array<{ ... }>;` property add:

```ts
  /** When false, chord voicing connector polylines are not rendered. Defaults to true. */
  showChordConnectors?: boolean;
```

In the `FretboardSVG` component's destructured parameter list, after `fullChordVoicings,` add `showChordConnectors = true,`.

- [ ] **Step 4: Gate the chord-connector render block**

In the same file, find the chord-connector render guard inside the `<AnimatePresence mode="wait">` block:

```tsx
            <AnimatePresence mode="wait">
              {connectorPolylines.length > 0 && (
```

Change the condition to:

```tsx
            <AnimatePresence mode="wait">
              {showChordConnectors && connectorPolylines.length > 0 && (
```

Do **not** change the `intervalConnectorPolylines.length > 0` block that follows — interval connectors are unaffected.

- [ ] **Step 5: Expose `showChordConnectors` from `useFretboardState`**

In `src/hooks/useFretboardState.ts`:

In the import block from `../store/atoms`, after `fullChordMatchesAtom,` add `voicingConnectorsAtom,`.

Near the other `useAtomValue` calls (e.g. alongside `const fullChordMatches = useAtomValue(fullChordMatchesAtom);`) add:

```ts
  const showChordConnectors = useAtomValue(voicingConnectorsAtom);
```

In the hook's returned object, after `fullChordPositions: visibleFullChordPositions,` add:

```ts
    showChordConnectors,
```

- [ ] **Step 6: Pass the prop through `Fretboard`**

In `src/components/Fretboard/Fretboard.tsx`, find the `<FretboardSVG ... />` JSX and the line `fullChordVoicings={fullChordVoicings}`. Immediately after it add:

```tsx
          showChordConnectors={state.showChordConnectors}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardSVG.test.tsx`
Expected: PASS — the new test green, and the existing connector tests (`"renders chord roles only..."`, `"replaces the full-chord connector group..."`) still pass because `showChordConnectors` defaults to `true`.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useFretboardState.ts src/components/Fretboard/Fretboard.tsx src/components/FretboardSVG/FretboardSVG.tsx src/components/FretboardSVG/FretboardSVG.test.tsx
git commit -m "feat(fretboard): gate chord connectors on the voicing-connectors atom"
```

---

### Task 4: ChordOverlayControls rewrite

Rewrite the Chord tab component: Source row (Mode label, spans 2 / 3 / 1, single static Mode hint), Lens shows all three options always (compact labels, unavailable = disabled not hidden), Chord Type group inner label → "Quality", Voicing group with a Connectors toggle in the header and hints on Type / Inversion / String Set, and both the Full Chords and Show-on-Board switches removed.

**Files:**
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.tsx` (full rewrite)
- Modify: `src/components/ChordOverlayControls/ChordOverlayControls.module.css`
- Test: `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`

- [ ] **Step 1: Add the Connectors-toggle styles**

Append to `src/components/ChordOverlayControls/ChordOverlayControls.module.css`:

```css
/* VOICING-header "Connectors" toggle — a micro-label paired with the Switch,
   sitting in the GroupHeader right slot. */
.connectorsToggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.connectorsToggleLabel {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faceplate-accent);
  line-height: 1;
}
```

- [ ] **Step 2: Rewrite the component**

Replace the entire contents of `src/components/ChordOverlayControls/ChordOverlayControls.tsx` with:

```tsx
import { startTransition, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES } from "@fretflow/core";
import {
  lensAvailabilityAtom,
  fingeringPatternAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
  voicingConnectorsAtom,
  availableInversionsAtom,
} from "../../store/atoms";
import { StringSetPicker } from "../Inspector/StringSetPicker";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { ChordTypeGrid } from "../Inspector/ChordTypeGrid";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import panelStyles from "./ChordOverlayControls.module.css";
import shared from "../shared/shared.module.css";
import {
  buildDegreeToggleOptions,
  buildQualityToggleOptions,
} from "../shared/chordControlOptions";

/** Compact lens labels for the narrow Source-row Lens toggle. */
const LENS_SHORT_LABELS: Record<string, string> = {
  targets: "Chord",
  "guide-tones": "Guide",
  tension: "Tension",
};

export function ChordOverlayControls() {
  const { t } = useTranslation();
  const { scaleName, useFlats } = useScaleState();
  const {
    chordType,
    practiceLens,
    setPracticeLens,
    chordDegree,
    setChordDegree,
    chordOverlayMode,
    setChordOverlayMode,
    chordRootOverride,
    setChordRootOverride,
    chordQualityOverride,
    setChordQualityOverride,
  } = useChordState();
  const [voicingType, setVoicingType] = useAtom(voicingTypeAtom);
  const [voicingInversion, setVoicingInversion] = useAtom(voicingInversionAtom);
  const [voicingStringSet, setVoicingStringSet] = useAtom(voicingStringSetAtom);
  const [voicingConnectors, setVoicingConnectors] = useAtom(voicingConnectorsAtom);
  const availableInversions = useAtomValue(availableInversionsAtom);

  const lensAvailability = useAtomValue(lensAvailabilityAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isPatternDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";

  const hasQualityOverride = chordQualityOverride != null;
  const degreeSelectOptions = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden: hasQualityOverride,
    activeDegree: chordDegree,
    includeOffSentinel: false,
  });

  // All three lenses are always shown; an unavailable lens renders disabled.
  const lensOptions = lensAvailability.map((entry) => {
    const { id } = entry;
    const isActive = id === practiceLens;
    const reason = entry.reason ?? undefined;
    return {
      value: id,
      label: LENS_SHORT_LABELS[id] ?? entry.label,
      disabled: !isActive && !entry.available,
      title: !isActive && reason ? reason : undefined,
      description: !isActive && reason ? reason : undefined,
    };
  });

  const currentLensEntry = lensAvailability.find((l) => l.id === practiceLens);

  // Auto-exit unavailable lenses (except "targets").
  useEffect(() => {
    if (
      currentLensEntry &&
      !currentLensEntry.available &&
      currentLensEntry.id !== "targets"
    ) {
      const tAvailable = lensAvailability.find((l) => l.id === "targets")?.available;
      if (tAvailable) {
        setPracticeLens("targets");
      }
    }
  }, [currentLensEntry, lensAvailability, setPracticeLens]);

  const handleDegreeChange = (value: string) => {
    startTransition(() => {
      setChordDegree(value);
    });
  };

  const handleChordTypeChange = (value: string) => {
    startTransition(() => {
      setChordQualityOverride(value);
    });
  };

  // ── Visibility ────────────────────────────────────────────────────────
  const isOff = chordOverlayMode === "off";
  const showDegree = !isPatternDisabled && chordOverlayMode === "degree";
  const showChordTypeGrid =
    !isPatternDisabled &&
    (chordOverlayMode === "manual" ||
      (chordOverlayMode === "degree" && Boolean(chordDegree)));
  const showRoot = !isPatternDisabled && chordOverlayMode === "manual";
  const hasActiveChord = Boolean(chordType);
  const showDisplay = !isPatternDisabled && !isOff;
  const displayDisabled = !hasActiveChord;

  return (
    <div
      className={clsx(panelStyles.root, isPatternDisabled && panelStyles["panel-disabled"])}
      data-disabled={isPatternDisabled ? "true" : undefined}
    >
      {isPatternDisabled && (
        <p className={shared["field-hint"]} aria-live="polite">
          {t("controls.chordOverlayDisabled")}
        </p>
      )}
      <PropGrid columns={6} className={panelStyles.grid}>
        {/* ── SOURCE ───────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupSource")}</GroupHeader>
        <Prop
          label={t("controls.mode")}
          span={2}
          hint={isPatternDisabled ? undefined : t("controls.modeHint")}
        >
          <ToggleBar
            options={[
              {
                value: "off",
                label: isPatternDisabled
                  ? t("controls.disabled")
                  : t("controls.off"),
                disabled: isPatternDisabled,
              },
              {
                value: "degree",
                label: t("controls.degree"),
                disabled: isPatternDisabled,
              },
              {
                value: "manual",
                label: t("controls.manual"),
                disabled: isPatternDisabled,
              },
            ]}
            value={chordOverlayMode}
            onChange={isPatternDisabled ? () => undefined : setChordOverlayMode}
            label="Chord overlay mode"
          />
        </Prop>
        {showDegree && (
          <Prop label={t("controls.degree")} span={3}>
            <ToggleBar
              options={degreeSelectOptions}
              value={chordDegree ?? ""}
              onChange={handleDegreeChange}
              label="Chord degree"
            />
          </Prop>
        )}
        {showRoot && (
          <Prop label={t("controls.root")} span={3}>
            <NoteGrid
              notes={NOTES}
              selected={chordRootOverride}
              onSelect={(note) => {
                startTransition(() => {
                  setChordRootOverride(note);
                });
              }}
              useFlats={useFlats}
            />
          </Prop>
        )}
        {showDisplay && (
          <Prop label={t("controls.lens")} span={1} hint={t("controls.lensHint")}>
            <ToggleBar
              options={lensOptions.map((o) => ({
                ...o,
                disabled: displayDisabled || o.disabled,
              }))}
              value={practiceLens}
              onChange={displayDisabled ? () => undefined : setPracticeLens}
              label="Practice lens"
            />
          </Prop>
        )}

        {/* ── CHORD TYPE ───────────────────────────────────────────────── */}
        {showChordTypeGrid && (
          <>
            <GroupHeader>{t("inspector.groupChordType")}</GroupHeader>
            <Prop
              label={t("controls.quality")}
              span={6}
              hint={
                chordOverlayMode === "degree"
                  ? hasQualityOverride
                    ? t("controls.customChordHint")
                    : t("controls.diatonicDefaultHint")
                  : undefined
              }
            >
              <ChordTypeGrid
                label="Chord Type"
                options={buildQualityToggleOptions({ includeSentinel: false })}
                value={
                  chordOverlayMode === "degree"
                    ? chordType ?? ""
                    : chordQualityOverride ?? ""
                }
                onChange={handleChordTypeChange}
              />
            </Prop>
          </>
        )}

        {/* ── VOICING ──────────────────────────────────────────────────── */}
        {showDisplay && (
          <>
            <GroupHeader
              right={
                <span className={panelStyles.connectorsToggle}>
                  <span className={panelStyles.connectorsToggleLabel}>
                    {t("controls.connectors")}
                  </span>
                  <Switch
                    label={t("controls.connectors")}
                    checked={voicingConnectors}
                    onChange={setVoicingConnectors}
                    disabled={displayDisabled}
                  />
                </span>
              }
            >
              {t("inspector.groupVoicing")}
            </GroupHeader>
            <Prop
              label={t("inspector.voicingType")}
              span={3}
              hint={t("inspector.voicingTypeHint")}
            >
              <ToggleBar
                label="Voicing type"
                options={[
                  { value: "caged" as const, label: t("inspector.voicingTypeCaged") },
                  { value: "drop2" as const, label: t("inspector.voicingTypeDrop2") },
                  { value: "triad" as const, label: t("inspector.voicingTypeTriad") },
                ]}
                value={voicingType}
                onChange={setVoicingType}
              />
            </Prop>
            <Prop
              label={t("inspector.voicingInversion")}
              span={3}
              hint={t("inspector.voicingInversionHint")}
            >
              <ToggleBar
                label="Voicing inversion"
                options={(["root", "1st", "2nd", "3rd"] as const).map((v) => ({
                  value: v,
                  label: v === "root" ? t("controls.root") : v,
                  disabled: !availableInversions.includes(v),
                }))}
                value={voicingInversion}
                onChange={setVoicingInversion}
              />
            </Prop>
            <Prop
              label={t("inspector.voicingStringSet")}
              span={6}
              hint={t("inspector.voicingStringSetHint")}
            >
              <StringSetPicker value={voicingStringSet} onChange={setVoicingStringSet} />
            </Prop>
          </>
        )}
      </PropGrid>
    </div>
  );
}
```

Notes on what changed from the previous version, so the reviewer can confirm intent:
- `FULL_CHORD_SUPPORTED_TYPES`, `fullChordsSupported`, `fullChordsHint`, the Full Chords `Prop`/`Switch`, the Show-on-Board `Prop`/`Switch`, and the `chordOverlayHiddenAtom` / `LENS_REGISTRY` imports are all gone.
- `useChordState` no longer destructures `fullChordsEnabled` / `setFullChordsEnabled`.
- Mode `Prop` label is `controls.mode`, span `2`, with the single static `controls.modeHint`.
- Degree / Root `Prop`s are span `3`; Lens `Prop` is span `1` with the static `controls.lensHint`.
- Lens options always list all three lenses; `LENS_SHORT_LABELS` supplies the compact labels.
- Chord Type inner `Prop` label is `controls.quality`.
- VOICING `GroupHeader` carries the Connectors toggle in its `right` slot; Type / Inversion / String Set each have a hint.

- [ ] **Step 3: Update the component test file**

In `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`, make these changes:

(a) **Remove the `fullChordsEnabledAtom` import** from the import block (it is no longer referenced after the deletions below).

(b) **Delete the entire `describe("7b. full chords control", ...)` block** — all of its `it`/`it.each` tests reference the removed Full Chords switch.

(c) **Delete the entire `describe("Show on Board switch", ...)` block** — it references the removed Show-on-Board switch.

(d) In `describe("10. Mode label and hint (Degree/Manual toggle)", ...)`, the test `"renders visible 'Chord Mode' label adjacent to the toggle"` — change its assertion from `screen.getByText("Chord Mode")` to `screen.getByText("Mode")`.

(e) In `describe("8. chord-type toggle bar (manual mode)", ...)`, the test `"renders 'Chord Type' label in manual mode"` — the Chord Type inner cell label is now "Quality". Change its assertion to expect the text `"Quality"` instead of `"Chord Type"`. (The `inspector.groupChordType` group header still reads "Chord Type" — if the test queried the header, leave that; only the inner property label changed.)

(f) In `describe("12. lens hint uses LENS_REGISTRY description", ...)`, the lens hint is now a single static string. Replace the body of `"shows LENS_REGISTRY description for active lens"` and `"lens hint text updates when active lens changes"` with a single test:

```ts
    it("renders the static lens hint", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      expect(
        screen.getByText(
          "Landing tones · Tension shows chord notes outside the scale.",
        ),
      ).toBeInTheDocument();
    });
```

(Delete the now-redundant second test; keep `"does not render a lens help-button when chord is active"` and `"no legacy lens-hint paragraph remains"` if they still hold — they do, the hint is still a plain `<p>`.)

(g) Add a new `describe` block for the parity additions (place it after `describe("16. VOICING group controls ...", ...)`):

```ts
  describe("17. chord-tab design parity", () => {
    it("Lens toggle shows all three options", () => {
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const lens = screen.getByRole("group", { name: "Practice lens" });
      expect(within(lens).getByRole("button", { name: "Chord" })).toBeInTheDocument();
      expect(within(lens).getByRole("button", { name: "Guide" })).toBeInTheDocument();
      expect(within(lens).getByRole("button", { name: "Tension" })).toBeInTheDocument();
    });

    it("Tension lens option is disabled when unavailable", () => {
      // C Major triad on degree I has no outside tones → Tension unavailable.
      renderWithAtoms(<ChordOverlayControls />, [...DEGREE_MODE_SEEDS]);
      const lens = screen.getByRole("group", { name: "Practice lens" });
      expect(within(lens).getByRole("button", { name: "Tension" })).toBeDisabled();
    });

    it("renders the Connectors toggle in the VOICING group and writes voicingConnectorsAtom", async () => {
      const store = makeAtomStore([...MANUAL_MODE_SEEDS]);
      renderWithStore(<ChordOverlayControls />, store);
      const toggle = screen.getByRole("switch", { name: "Connectors" });
      expect(toggle).toBeInTheDocument();
      expect(store.get(voicingConnectorsAtom)).toBe(false);
      await userEvent.click(toggle);
      expect(store.get(voicingConnectorsAtom)).toBe(true);
    });

    it("no longer renders the Full Chords or Show on Board switches", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(screen.queryByRole("switch", { name: "Full Chords" })).toBeNull();
      expect(screen.queryByRole("switch", { name: "Show on Board" })).toBeNull();
    });

    it("shows hints for the voicing Type, Inversion and String Set controls", () => {
      renderWithAtoms(<ChordOverlayControls />, [...MANUAL_MODE_SEEDS]);
      expect(
        screen.getByText("How densely the chord is voiced."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Which chord tone is the lowest note."),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Full CAGED uses all six strings — pick a subset for partial voicings.",
        ),
      ).toBeInTheDocument();
    });
  });
```

Add `voicingConnectorsAtom` to the import block from `../../store/atoms`. (`makeAtomStore`, `renderWithStore`, `within`, `userEvent` are already imported in this file.)

- [ ] **Step 4: Run the component tests**

Run: `pnpm exec vitest run src/components/ChordOverlayControls/ChordOverlayControls.test.tsx`
Expected: PASS — all blocks green, including the new `"17. chord-tab design parity"` block.

- [ ] **Step 5: Run the broader inspector test suite for regressions**

Run: `pnpm exec vitest run src/components/ChordOverlayControls src/components/Inspector`
Expected: PASS. If `ChordTab.test.tsx` or `Inspector.test.tsx` asserted on the removed switches or the old "Chord Mode" label, update those assertions the same way (label "Chord Mode" → "Mode", remove switch queries).

- [ ] **Step 6: Commit**

```bash
git add src/components/ChordOverlayControls/
git commit -m "feat(inspector): chord-tab source/voicing parity layout"
```

---

### Task 5: ChordTypeGrid single-row 15-column layout

The CHORD TYPE grid renders all 15 quality cells in a single row.

**Files:**
- Modify: `src/components/Inspector/ChordTypeGrid.module.css`
- Test: `src/components/Inspector/ChordTypeGrid.test.tsx` (assertion update only if present)

- [ ] **Step 1: Update the grid CSS**

In `src/components/Inspector/ChordTypeGrid.module.css`, change the `.grid` rule:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.1875rem;
}
```

to:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(15, minmax(0, 1fr));
  gap: 0.125rem;
}
```

And change the `.cell` rule's `min-height`, `padding`, and `font-size` to fit 15 cells across one row:

```css
.cell {
  min-height: 1.5rem;
  padding: 0 0.125rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--dc-fg);
  background: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  cursor: pointer;
  transition: var(--dc-transition);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

Leave `.cell:hover`, `.cell:disabled`, `.cellActive`, `.cell:focus-visible` unchanged.

- [ ] **Step 2: Check the ChordTypeGrid test**

Run: `pnpm exec vitest run src/components/Inspector/ChordTypeGrid.test.tsx`
Expected: PASS. The test asserts on rendered buttons / `aria-pressed`, not on `grid-template-columns`, so it should be unaffected. If any assertion checks the column count or a CSS value, update it to `15`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Inspector/ChordTypeGrid.module.css
git commit -m "feat(inspector): chord-type grid single-row 15-column layout"
```

---

### Task 6: ToggleBar tighter, squarer proportions

The shared `.toggle-btn` / `.toggle-group` pills become less rounded, less wide, less tall. This is shared CSS — every `ToggleBar` in the app adopts the new proportions, by design.

**Files:**
- Modify: `src/components/shared/shared.module.css`
- Test: `src/components/shared/shared.test.tsx`

- [ ] **Step 1: Update the failing test assertion first**

In `src/components/shared/shared.test.tsx`, the test `"compact density is the default: toggle-btn base min-height is 1.6rem"` currently asserts:

```ts
    expect(sharedCSS).toMatch(/\.toggle-btn[^{]*\{[^}]*min-height:\s*1\.6rem/);
```

Change the regex to `1\.4rem`, and update the test title to `"... min-height is 1.4rem"` and any inline comment that says `1.6rem`. (The `note-btn` test at `1.65rem` is unchanged — Task 6 does not touch `.note-btn`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/shared/shared.test.tsx`
Expected: FAIL — `.toggle-btn` still declares `min-height: 1.6rem`.

- [ ] **Step 3: Restyle `.toggle-btn`**

In `src/components/shared/shared.module.css`, in the `.toggle-btn` rule, change these three declarations:

- `min-height: 1.6rem;` → `min-height: 1.4rem;`
- `padding: 0.12rem 0.5rem;` → `padding: 0.1rem 0.4rem;`
- `border-radius: calc(var(--dc-radius) - 2px);` → `border-radius: calc(var(--dc-radius) - 3px);`

Leave every other declaration in `.toggle-btn` (and the `:hover` / `:active` / `:focus-visible` / `.active` / mobile-tier rules) unchanged.

- [ ] **Step 4: Restyle `.toggle-group`**

In the same file, in the `.toggle-group` rule, change:

- `border-radius: var(--dc-radius);` → `border-radius: calc(var(--dc-radius) - 1px);`
- `padding: 0.12rem;` → `padding: 0.1rem;`

Leave the rest of `.toggle-group` (and `.toggle-group--default`, the `data-overflow` variants) unchanged.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/shared/shared.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/shared.module.css src/components/shared/shared.test.tsx
git commit -m "feat(shared): tighter squarer toggle-bar proportions"
```

---

### Task 7: StringSetPicker — cyan, reversed order, linear ramp

The string diagram uses cyan for on-strings in every card, renders low-E thickest at the bottom, and uses a constant per-string thickness step.

**Files:**
- Modify: `src/components/Inspector/StringSetPicker.tsx`
- Modify: `src/components/Inspector/StringSetPicker.module.css`
- Test: `src/components/Inspector/StringSetPicker.test.tsx` (assertion update only if needed)

- [ ] **Step 1: Reverse the string order and use a linear thickness ramp**

In `src/components/Inspector/StringSetPicker.tsx`, find the `card.mask.map(...)` block:

```tsx
              {card.mask.map((on, i) => (
                <span
                  key={i}
                  className={clsx(styles.string, on && styles.stringOn)}
                  style={{ height: `${2.2 - (i / 5) * 1.4}px` }}
                />
              ))}
```

Replace it with:

```tsx
              {[...card.mask].reverse().map((on, i) => (
                <span
                  key={i}
                  className={clsx(styles.string, on && styles.stringOn)}
                  style={{ height: `${1 + i * 0.4}px` }}
                />
              ))}
```

`card.mask` is ordered low-E → high-E. Reversing it renders high-E at the top (rendered index 0, thinnest at `1px`) and low-E at the bottom (rendered index 5, thickest at `3px`) — a constant `0.4px` step between adjacent strings. The `mask` array and the card `sub`-labels are not changed.

- [ ] **Step 2: Make on-strings cyan in every card**

In `src/components/Inspector/StringSetPicker.module.css`, change the `.stringOn` rule:

```css
.stringOn {
  background: var(--text-muted);
}

.cardActive .stringOn {
  background: var(--accent-primary);
}
```

to a single rule:

```css
.stringOn {
  background: var(--accent-primary);
}
```

(The `--accent-primary` token is the cyan accent; the per-card `.cardActive` override is no longer needed since every on-string is now cyan.)

- [ ] **Step 3: Run the StringSetPicker test**

Run: `pnpm exec vitest run src/components/Inspector/StringSetPicker.test.tsx`
Expected: PASS — the role / `aria-label` / `onChange` contract is unchanged. If a test asserts a specific inline `height` value or the old `--text-muted` color, update it to the new linear-ramp value / `--accent-primary`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Inspector/StringSetPicker.tsx src/components/Inspector/StringSetPicker.module.css
git commit -m "feat(inspector): string-set picker cyan strings and linear ramp"
```

---

### Task 8: Full verification and visual-regression baselines

**Files:** none (verification only).

- [ ] **Step 1: Typecheck and lint**

Run: `npx tsc -b`
Expected: exit 0.

Run: `pnpm run lint`
Expected: exit 0. (Watch for now-unused imports in `ChordOverlayControls.tsx` / `useChordState.ts` consumers — Task 4 removed several.)

- [ ] **Step 2: Full unit/component test suite**

Run: `pnpm run test`
Expected: PASS. If any other suite (`ChordTab`, `Inspector`, `ViewTab`, `Fretboard.wiring`) asserted on the old Chord-tab labels or the removed switches, update those assertions — label `"Chord Mode"` → `"Mode"`, inner Chord-Type label `"Chord Type"` → `"Quality"`, and remove queries for the Full Chords / Show-on-Board switches on the Chord tab.

- [ ] **Step 3: Production build**

Run: `pnpm run build`
Expected: exit 0.

- [ ] **Step 4: Refresh visual-regression baselines**

The shared ToggleBar restyle, the Chord-tab layout, and the StringSetPicker change shift several snapshots.

Run: `pnpm run test:visual:update`
Expected: darwin snapshots regenerated for `app-components`, `app-layout`, and `fretboard-svg`. Review the diffs to confirm they match the intended design (tighter toggle bars, single-row Quality grid, Connectors header toggle, cyan reversed string diagram) and contain no unintended changes.

- [ ] **Step 5: Commit the refreshed baselines**

```bash
git add e2e/
git commit -m "test(visual): refresh baselines for chord-tab parity"
```

---

## Self-Review

**Spec coverage:**
- §3 Source group (Mode label/span, Degree/Root span, Mode hint) → Task 1 + Task 4.
- §3a Lens three-options-always (compact labels, disabled-not-hidden, static hint, auto-exit kept) → Task 4.
- §4 Chord Type group (Quality label, 15-cell single row) → Task 1 + Task 4 + Task 5.
- §5a remove Full Chords switch → Task 4.
- §5b Connectors toggle (new atom, GroupHeader right slot, render gate) → Task 2 + Task 3 + Task 4.
- §5c voicing-control hints → Task 1 + Task 4.
- §5d voicing-engine ungate (item 12) → Task 2.
- §6a ToggleBar proportions → Task 6.
- §6b StringSetPicker (cyan, reversed order, linear ramp) → Task 7.
- §7 deferred app-shell items — not in this plan, by design.
- §8 cross-cutting (i18n en+es, one new atom, mandatory checks, visual baselines) → Tasks 1, 2, 8.
- §9 testing — covered across Tasks 2, 3, 4, 6, 7, 8.
- §10 acceptance criteria — verified by Task 8.

The View-tab "Full Chords" `ToggleProp` becoming a no-op is an intentional, spec-noted follow-up (§5d, §8) and is **not** addressed here.

**Type consistency:** `voicingConnectorsAtom` is defined in Task 2, re-exported via the barrel in Task 2, consumed by `useFretboardState` in Task 3 and `ChordOverlayControls` in Task 4. The `showChordConnectors` prop is added to `FretboardSVGProps` in Task 3 and passed by `Fretboard` in the same task. Translation keys added in Task 1 (`controls.mode`, `controls.modeHint`, `controls.quality`, `controls.lensHint`, `inspector.voicingTypeHint`, `inspector.voicingInversionHint`, `inspector.voicingStringSetHint`) are all consumed in Task 4; `controls.connectors` already exists and is reused.

**Placeholder scan:** No TBD/TODO; every code step shows complete content.
