# Playback Lock Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repeated per-card "Stop playback to edit" overlays with an amplified transport status-dot glow, a single global screen-reader announcement, and a subtle per-card lock treatment (dim body + header lock icon + accent line).

**Architecture:** The TransportBar owns global playback-lock communication (the amplified PLAY status-dot glow plus one `aria-live` region). Each `InspectorCard` owns its own visual treatment via the existing `data-locked` attribute (body opacity, an inset accent line, and an `aria-hidden` header lock icon). The two concerns do not overlap. All state transitions are CSS-only (300ms ease); no JS animation libraries.

**Tech Stack:** React 19 + TypeScript, Jotai atoms, CSS Modules, lucide-react icons, Vitest + Testing Library (jsdom). Package manager is **pnpm**.

**Source spec:** [`docs/superpowers/specs/2026-05-29-playback-lock-redesign-design.md`](../specs/2026-05-29-playback-lock-redesign-design.md)

**Sequencing note:** Tasks are ordered so the build stays green after every task. The new i18n key is *added* before it is consumed (Task 1); the old `lockedHint` key is *removed last* (Task 6), after its final consumer (the SongControls overlays) is deleted in Task 4. The `overlay` prop is removed from `InspectorCard` (Task 5) only after its last caller stops passing it (Task 4).

**Run all commands from the worktree root:** `/Users/isaaccocar/repos/fretboard-app/.worktrees/playback-lock-overlay`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/i18n/types.ts` | i18n key type contract | Add `lockedAnnouncement` (Task 1); remove `lockedHint` (Task 6) |
| `src/i18n/en.ts` / `src/i18n/es.ts` | i18n strings | Add `lockedAnnouncement` (Task 1); remove `lockedHint` (Task 6) |
| `src/components/TransportBar/TransportBar.tsx` | Global playback status + lock announcement | sr-only `aria-live` region + amplified active-dot glow; label stays "PLAY" (Task 2) |
| `src/components/TransportBar/TransportBar.module.css` | Transport visual styling | Amplified active-dot pulse glow (Task 2) |
| `src/components/Inspector/InspectorCard.tsx` | Per-card chrome | Add header lock icon (Task 3); remove `overlay` prop + JSX + JSDoc (Task 5) |
| `src/components/Inspector/InspectorCard.module.css` | Per-card styling | Add `data-locked` body dim / accent line / lock-icon transition (Task 3); remove `.cardBodyOverlay` rules (Task 5) |
| `src/components/SongControls/SongControls.tsx` | Song-tab cards wiring | Delete 3 overlay blocks + `Square` import (Task 4) |
| Test files (co-located) | Behaviour verification | Updated per task |

---

## Task 1: Add `lockedAnnouncement` i18n key

Add the new global-announcement key to all three i18n files. The old `lockedHint` key stays for now (still consumed by SongControls until Task 4), so the build stays green.

**Files:**
- Modify: `src/i18n/types.ts:151`
- Modify: `src/i18n/en.ts:154`
- Modify: `src/i18n/es.ts:154`

- [ ] **Step 1: Add the type field**

In `src/i18n/types.ts`, immediately after the `lockedHint: string;` line (line 151), add:

```ts
    lockedHint: string;
    lockedAnnouncement: string;
```

- [ ] **Step 2: Add the English string**

In `src/i18n/en.ts`, immediately after the `lockedHint:` line (line 154), add:

```ts
    lockedHint: "Stop playback to edit",
    lockedAnnouncement: "Editing locked during playback",
```

- [ ] **Step 3: Add the Spanish string**

In `src/i18n/es.ts`, immediately after the `lockedHint:` line (line 154), add:

```ts
    lockedHint: "Detén la reproducción para editar",
    lockedAnnouncement: "Edición bloqueada durante la reproducción",
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS (no errors). The new required key is present in both `en` and `es` dictionaries, so the type contract is satisfied.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): add lockedAnnouncement key for global playback-lock status"
```

---

## Task 2: TransportBar — global lock announcement + amplified glow

Add one visually-hidden `aria-live` region announcing the global edit lock, and amplify the active-dot pulse glow. The status-light label stays the static string "Play" — no text swap (avoids a layout shift; playback is signalled by the dot glow).

**Files:**
- Modify: `src/components/TransportBar/TransportBar.tsx`
- Modify: `src/components/TransportBar/TransportBar.module.css:133-139`
- Test: `src/components/TransportBar/TransportBar.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/TransportBar/TransportBar.test.tsx`, add this test inside the existing `describe("TransportBar", …)` block (e.g. after the test ending at line 58):

```tsx
  it("announces the global edit lock via an aria-live region while playing", () => {
    const store = makeAtomStore([...playableAtoms]);
    const { container } = renderWithStore(
      <TooltipProvider delayDuration={0}><TransportBar /></TooltipProvider>,
      store,
    );

    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");

    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    expect(liveRegion).toHaveTextContent("Editing locked during playback");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/TransportBar/TransportBar.test.tsx -t "aria-live region while playing"`
Expected: FAIL — no element matches `[aria-live='polite']`.

- [ ] **Step 3: Add the shared-styles import**

In `src/components/TransportBar/TransportBar.tsx`, add this import after the existing `styles` import (line 13):

```tsx
import styles from "./TransportBar.module.css";
import shared from "../shared/shared.module.css";
```

> The status-light label is **not** changed — it stays `<span className={styles.statusLabel}>Play</span>` (line 63).

- [ ] **Step 4: Add the global aria-live region**

In `src/components/TransportBar/TransportBar.tsx`, add the live region as the first child inside the root `<div className={styles.transportBar} …>` (immediately before the `<div className={styles.statusLights} …>` opening tag at line 60):

```tsx
    <div className={styles.transportBar} data-testid="transport-bar">
      <span className={shared["sr-only"]} role="status" aria-live="polite">
        {progressionPlaying ? t("controls.lockedAnnouncement") : ""}
      </span>
      <div className={styles.statusLights} aria-label="Playback status">
```

`t` is already destructured from `useTranslation()` at the top of the component.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/TransportBar/TransportBar.test.tsx`
Expected: PASS — all TransportBar tests pass (the new aria-live test plus the existing suite, including the `getByText("Play")` check at line 56 which still holds, since the label is never changed).

- [ ] **Step 6: Amplify the active-dot pulse glow**

In `src/components/TransportBar/TransportBar.module.css`, replace the `.statusLight[data-active="true"] .statusDot` rule (lines 133-139):

```css
.statusLight[data-active="true"] .statusDot {
  background: var(--track-accent);
  box-shadow:
    0 0 5px var(--track-accent),
    0 0 10px rgb(77 228 255 / 0.5);
  animation: track-pulse 1.4s ease-in-out infinite;
}
```

with a stronger glow:

```css
.statusLight[data-active="true"] .statusDot {
  background: var(--track-accent);
  box-shadow:
    0 0 6px var(--track-accent),
    0 0 14px rgb(77 228 255 / 0.65);
  animation: track-pulse 1.4s ease-in-out infinite;
}
```

(This applies to every active status dot — Play and Loop — which is the intended "transport is live" cue.)

- [ ] **Step 7: Lint the stylesheet**

Run: `pnpm exec stylelint src/components/TransportBar/TransportBar.module.css`
Expected: PASS (no errors).

- [ ] **Step 8: Commit**

```bash
git add src/components/TransportBar/TransportBar.tsx src/components/TransportBar/TransportBar.module.css src/components/TransportBar/TransportBar.test.tsx
git commit -m "feat(transport): announce global edit lock and amplify the active-dot glow"
```

---

## Task 3: InspectorCard — header lock icon + card scrim CSS

Add an `aria-hidden` lock icon in the card header when `locked`, plus the `data-locked` body dim, accent line, and lock-icon transition. The `overlay` prop is left untouched in this task (SongControls still passes it until Task 4), so the build stays green.

**Files:**
- Modify: `src/components/Inspector/InspectorCard.tsx`
- Modify: `src/components/Inspector/InspectorCard.module.css`
- Test: `src/components/Inspector/InspectorCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/Inspector/InspectorCard.test.tsx`, add these tests inside the `describe("InspectorCard", …)` block (e.g. after the test ending at line 51):

```tsx
  it("renders a header lock icon when locked=true", () => {
    const { container } = renderCard({ locked: true });
    expect(container.querySelector(".lucide-lock")).toBeInTheDocument();
  });

  it("does not render a lock icon when locked=false (default)", () => {
    const { container } = renderCard();
    expect(container.querySelector(".lucide-lock")).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/Inspector/InspectorCard.test.tsx -t "header lock icon when locked"`
Expected: FAIL — no element matches `.lucide-lock` (no icon is rendered yet).

- [ ] **Step 3: Import the Lock icon**

In `src/components/Inspector/InspectorCard.tsx`, add the lucide import after the `clsx` import (line 2):

```tsx
import type { ReactNode } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
```

- [ ] **Step 4: Render the lock icon in the header**

In `src/components/Inspector/InspectorCard.tsx`, add the icon immediately after the `<h3>…</h3>` element (after line 90, before the `stateLabel` block):

```tsx
        <h3 id={labelledById} className={styles.cardName}>
          {name}
        </h3>
        {locked ? (
          <Lock size={11} className={styles.lockIcon} aria-hidden="true" />
        ) : null}
```

- [ ] **Step 5: Add the card-scrim styles**

In `src/components/Inspector/InspectorCard.module.css`, append these rules to the end of the file:

```css
.cardBody {
  transition: opacity 300ms ease;
}

.card[data-locked="true"] .cardBody {
  opacity: 0.75;
}

.card[data-locked="true"] {
  box-shadow: inset 2px 0 0 0 var(--faceplate-accent);
}

/* Light mode already carries a soft elevation shadow on .card; combine both so
   the accent line and the elevation coexist while locked (equal specificity,
   later source order would otherwise drop the elevation shadow). */
/* stylelint-disable selector-pseudo-class-no-unknown */
:global([data-theme="modern-light"]) .card[data-locked="true"] {
  box-shadow:
    inset 2px 0 0 0 var(--faceplate-accent),
    0 1px 4px rgb(42 37 29 / 0.06);
}
/* stylelint-enable selector-pseudo-class-no-unknown */

.lockIcon {
  color: var(--faceplate-accent);
  opacity: 0;
  transition: opacity 300ms ease 50ms;
}

.card[data-locked="true"] .lockIcon {
  opacity: 1;
}
```

> Note: `.cardBody` already exists at line 76 with `padding` + `position: relative`. The new `.cardBody { transition: … }` block adds the transition declaration via the cascade — both rules apply. (Optionally merge `transition: opacity 300ms ease;` into the existing line-76 rule instead; either is correct.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/Inspector/InspectorCard.test.tsx`
Expected: PASS — both new lock-icon tests pass; the existing suite (which still passes `overlay` and asserts it) is unaffected.

- [ ] **Step 7: Lint the stylesheet**

Run: `pnpm exec stylelint src/components/Inspector/InspectorCard.module.css`
Expected: PASS (no errors).

- [ ] **Step 8: Commit**

```bash
git add src/components/Inspector/InspectorCard.tsx src/components/Inspector/InspectorCard.module.css src/components/Inspector/InspectorCard.test.tsx
git commit -m "feat(inspector): add header lock icon and card-scrim lock treatment"
```

---

## Task 4: SongControls — delete the per-card overlays

Remove the 3 `overlay` props (Preset, Key, Progression cards) and the now-unused `Square` import. The cards keep their `locked` props. After this task nothing references `controls.lockedHint`.

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Test: `src/components/SongControls/SongControls.test.tsx:220-230`

- [ ] **Step 1: Update the failing test**

In `src/components/SongControls/SongControls.test.tsx`, replace the test at lines 220-230 ("Progression card surfaces the locked hint text during playback") with a lock-icon assertion:

```tsx
  it("shows lock icons in the Key and Progression card headers during playback", () => {
    const store = makeAtomStore([...BASE_SEEDS]);
    renderWithStore(
      <TooltipProvider><SongControls /></TooltipProvider>,
      store,
    );
    act(() => { store.set(setProgressionPlayingAtom, true); });

    const keyCard = screen.getByRole("region", { name: /key/i });
    const progressionCard = screen.getByRole("region", { name: /progression/i });

    expect(keyCard.querySelector(".lucide-lock")).toBeInTheDocument();
    expect(progressionCard.querySelector(".lucide-lock")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx -t "shows lock icons"`
Expected: PASS already? No — Task 3 added the icon, so this may already pass. Confirm it passes (the icon is rendered because `InspectorCard` now renders `<Lock>` when `locked`). If it passes, that is the correct post-Task-3 state; proceed. The point of this step is to retire the `getAllByText(/Stop playback to edit/i)` assertion, which would otherwise still find the overlay text until Step 3.

> Rationale: the old assertion at line 228 (`getAllByText(/Stop playback to edit/i)`) still passes until the overlays are deleted in Step 3, so leaving it in place would mask the removal. Replacing it now is the failing-test surrogate for "overlays are gone."

- [ ] **Step 3: Remove the `Square` import**

In `src/components/SongControls/SongControls.tsx`, change the lucide import (line 3) from:

```tsx
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, Info, Square } from "lucide-react";
```

to:

```tsx
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, Info } from "lucide-react";
```

- [ ] **Step 4: Delete the Preset card overlay prop**

In `src/components/SongControls/SongControls.tsx`, remove the `overlay` prop from the Preset `InspectorCard` (lines 203-205). The card becomes:

```tsx
          <InspectorCard
            name={t("inspector.groupPreset")}
            description={t("inspector.groupPresetDesc")}
            labelledById="song-preset-heading"
            locked={editsLocked}
          >
```

- [ ] **Step 5: Delete the Key card overlay prop**

In `src/components/SongControls/SongControls.tsx`, remove the `overlay` prop from the Key `InspectorCard` (lines 230-232). The card becomes:

```tsx
          <InspectorCard
            name={t("inspector.groupKey")}
            description={t("inspector.groupKeyDesc")}
            labelledById="song-key-heading"
            locked={editsLocked}
          >
```

- [ ] **Step 6: Delete the Progression card overlay prop**

In `src/components/SongControls/SongControls.tsx`, remove the `overlay` prop from the Progression `InspectorCard` (lines 294-296). The opening of that card becomes:

```tsx
      <InspectorCard
        name={t("inspector.groupProgression")}
        description={t("inspector.groupProgressionDesc")}
        labelledById="song-progression-heading"
        locked={editsLocked}
        headClassName={styles["progression-card-head"]}
        actions={
```

- [ ] **Step 7: Run the SongControls tests to verify they pass**

Run: `pnpm exec vitest run src/components/SongControls/SongControls.test.tsx`
Expected: PASS — the new lock-icon test passes; the existing `data-locked` tests (lines 189-205, 232-241) and the inert-actions test (line 208) are unchanged and still pass.

- [ ] **Step 8: Verify the build (Square removed, no dangling refs)**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS — no "unused `Square`" or missing-reference errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.test.tsx
git commit -m "feat(song): remove per-card playback-lock overlays in favor of lock icons"
```

---

## Task 5: InspectorCard — remove the `overlay` prop entirely

Now that no caller passes `overlay`, remove the prop, its JSDoc, the JSX block, and the `.cardBodyOverlay` CSS. Update the `locked` JSDoc.

**Files:**
- Modify: `src/components/Inspector/InspectorCard.tsx`
- Modify: `src/components/Inspector/InspectorCard.module.css:111-129`
- Test: `src/components/Inspector/InspectorCard.test.tsx:29-45, 78-85`

- [ ] **Step 1: Update the tests (remove overlay assertions)**

In `src/components/Inspector/InspectorCard.test.tsx`:

(a) Replace the two tests at lines 29-38 so they no longer pass `overlay`:

```tsx
  it("sets data-locked on the card section when locked=true", () => {
    const { container } = renderCard({ locked: true });
    expect(container.querySelector("section[data-locked='true']")).toBeInTheDocument();
  });

  it("makes the card body inert when locked=true", () => {
    const { container } = renderCard({ locked: true });
    // The body div carries both data-locked and inert; the section also gets data-locked.
    expect(container.querySelector("div[data-locked='true']")).toHaveAttribute("inert");
  });
```

(b) Delete the entire test at lines 40-45 ("renders the overlay content inside the body overlay when locked=true").

(c) Replace the locked-a11y test at lines 78-85 so it no longer passes `overlay`:

```tsx
  it("has no accessibility violations when locked", async () => {
    const { container } = renderCard({
      locked: true,
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec tsc -b --noEmit`
Expected: This step's "failure" is the type system: after Step 1 the test file no longer references `overlay`, but the prop still exists, so `tsc` still PASSES here. The true verification is Step 5 (tests still green after the prop is gone). Proceed to remove the prop.

> Note: removing a now-unused optional prop is a refactor; the test edits in Step 1 are what make the suite stop exercising `overlay`. Steps 3-4 delete the dead code.

- [ ] **Step 3: Remove the `overlay` prop and its JSDoc, update the `locked` JSDoc**

In `src/components/Inspector/InspectorCard.tsx`:

(a) Replace the `locked` JSDoc + prop and the `overlay` JSDoc + prop (lines 30-43) with just the `locked` prop and a trimmed JSDoc:

```tsx
  /**
   * When true, the card body becomes non-interactive (HTML5 `inert`) and
   * the card shows a `locked` data attribute. Independent of `active` (which
   * dims the body via the master toggle). The lock is communicated visually by
   * the header lock icon + body scrim, and to assistive tech by the global
   * `aria-live` region in the TransportBar.
   */
  locked?: boolean;
  /** Card body contents — typically a PropGrid. */
  children: ReactNode;
```

(b) Remove `overlay` from the destructured parameters (line 70). The destructure becomes:

```tsx
  headClassName,
  locked = false,
  children,
}: InspectorCardProps) {
```

(c) Remove the overlay JSX block (lines 118-122). The component's closing becomes:

```tsx
      <div
        className={clsx(styles.cardBody, bodyClassName)}
        data-locked={locked ? "true" : undefined}
        inert={locked || undefined}
      >
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Remove the `.cardBodyOverlay` CSS**

In `src/components/Inspector/InspectorCard.module.css`, delete the `.cardBodyOverlay` rule (lines 111-125) **and** the `:global([data-theme="modern-light"]) .cardBodyOverlay` rule (lines 127-129). The `.card[data-locked="true"] .cardHeadActions` cursor rules (lines 102-109) stay — the Progression card still passes `actions` while locked.

- [ ] **Step 5: Run the full check to verify everything passes**

Run: `pnpm exec vitest run src/components/Inspector/InspectorCard.test.tsx`
Expected: PASS — all InspectorCard tests pass (lock-icon tests from Task 3, plus the updated locked/inert/a11y tests).

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS — `overlay` is fully removed with no dangling references.

- [ ] **Step 6: Lint the stylesheet**

Run: `pnpm exec stylelint src/components/Inspector/InspectorCard.module.css`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add src/components/Inspector/InspectorCard.tsx src/components/Inspector/InspectorCard.module.css src/components/Inspector/InspectorCard.test.tsx
git commit -m "refactor(inspector): remove the obsolete overlay prop and cardBodyOverlay styles"
```

---

## Task 6: i18n — remove the obsolete `lockedHint` key

`lockedHint` is no longer referenced anywhere (its last consumer, the SongControls overlays, was removed in Task 4). Remove it from all three i18n files.

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Confirm there are no remaining references**

Run: `grep -rn "lockedHint" src/`
Expected: no matches (the only prior references were the SongControls overlays, removed in Task 4, and these i18n definitions).

- [ ] **Step 2: Remove the type field**

In `src/i18n/types.ts`, delete the line:

```ts
    lockedHint: string;
```

- [ ] **Step 3: Remove the English string**

In `src/i18n/en.ts`, delete the line:

```ts
    lockedHint: "Stop playback to edit",
```

- [ ] **Step 4: Remove the Spanish string**

In `src/i18n/es.ts`, delete the line:

```ts
    lockedHint: "Detén la reproducción para editar",
```

- [ ] **Step 5: Verify types compile**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS — no references to the removed key remain.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "chore(i18n): remove obsolete lockedHint key"
```

---

## Task 7: Full verification

Run the mandatory pre-PR checks (per `CLAUDE.md`).

- [ ] **Step 1: Lint (eslint + stylelint)**

Run: `pnpm run lint`
Expected: PASS (no errors).

- [ ] **Step 2: Unit + component tests**

Run: `pnpm run test`
Expected: PASS (all suites green).

- [ ] **Step 3: Production build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build` succeeds).

- [ ] **Step 4: Manual visual check (dev server)**

Run: `pnpm run dev`, open the app, go to the Song tab, and click Play.
Expected:
- The transport status light label stays "PLAY"; its dot turns bright cyan with a stronger pulsing glow (no label text shift).
- The Preset, Key, and Progression cards dim to ~75% opacity, show a cyan inset accent line on the left edge, and a small cyan lock icon appears in each header (~50ms after the dim begins).
- No centered "Stop playback to edit" overlay appears anywhere.
- The Time and Backing Track cards remain fully interactive.
- Stopping playback reverses all transitions.
- Toggle the theme to light mode and confirm the accent line is visible (`#147088`) and the card keeps its soft elevation shadow while locked.

- [ ] **Step 5: Commit any snapshot or incidental updates (if generated)**

```bash
git status
# If any auto-generated snapshots changed, review then:
# git add <paths> && git commit -m "test: refresh snapshots for playback-lock redesign"
```

> Note: no committed visual-regression snapshot captures the playing/locked state (the `app-overlays` suite captures only the initial-mount state), so `pnpm run test:visual` is not expected to require updates for this change.

---

## Self-Review

**Spec coverage** (against `2026-05-29-playback-lock-redesign-design.md`):
- TransportBar amplified active-dot pulse glow (label stays "PLAY", no swap) → Task 2 (Step 6). ✓
- Global `aria-live` lock announcement + `lockedAnnouncement` key → Task 1 + Task 2 (Step 4). ✓
- InspectorCard header lock icon (`aria-hidden`, size 11) → Task 3. ✓
- `data-locked` body opacity 0.75, inset accent line, 50ms-delayed icon transition → Task 3 (Step 5). ✓
- Light-mode box-shadow collision fix → Task 3 (Step 5). ✓
- Remove `overlay` prop + JSDoc + JSX, update `locked` JSDoc → Task 5. ✓
- Remove `.cardBodyOverlay` + light-mode variant → Task 5 (Step 4). ✓
- SongControls: delete 3 overlay blocks + `Square` import; keep `locked` → Task 4. ✓
- i18n: remove `lockedHint` from en/es/types → Task 6. ✓
- Test changes (`.lucide-lock` selectors, TransportBar a11y, SongControls hint→icon) → Tasks 2/3/4/5. ✓
- Out-of-scope items (ProgressionTrack, fretboard, backing track, layout tiers, state machine) → untouched. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" placeholders. Every code step shows complete code.

**Type consistency:** `lockedAnnouncement` (added Task 1, consumed Task 2) and `lockedHint` (removed Task 6) names are consistent across files. `.lucide-lock` selector used identically in Tasks 3/4. `editsLocked` / `progressionPlaying` / `setProgressionPlayingAtom` match the existing source.
