# Onboarding Welcome Modal Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first-visit welcome modal: a 3-step orientation that introduces the fretboard, the Overlay tab, and the Song tab. Dismissed-state persists per-user. The Help button gains a "Show tour again" affordance.

**Architecture:** New `onboardingAtoms.ts` module holds `seenWelcomeTutorialAtom` (atomWithStorage). New `WelcomeModal.tsx` renders 3 stepped panes inside a portal modal (reuses HelpModal's chrome where it factors cleanly). `App.tsx` conditionally renders the modal on first visit. `HelpModal.tsx` gains a button that flips the atom false and opens the welcome modal. Reset action appends the new atom to the resettable list.

**Tech Stack:** React (lazy + Suspense), Jotai (atomWithStorage), CSS Modules, vitest-axe, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-27-onboarding-tutorial-design.md` (Phase 1 section).

**Scope note:** Phase 2 (TipPopover primitive + 5 initial contextual tips) is deferred to a separate plan when prioritized. This plan implements only the welcome modal.

---

## File Structure

```
src/
├── store/
│   ├── onboardingAtoms.ts        # CREATE: seenWelcomeTutorialAtom
│   ├── onboardingAtoms.test.ts   # CREATE: atom contract tests
│   └── actions.ts                # MODIFY: append seenWelcomeTutorialAtom to reset list

├── components/Onboarding/
│   ├── WelcomeModal.tsx          # CREATE: stepped modal component
│   ├── WelcomeModal.module.css   # CREATE: step layout + nav styling
│   └── WelcomeModal.test.tsx     # CREATE: component + a11y tests

├── components/HelpModal/
│   ├── HelpModal.tsx             # MODIFY: add "Show tour again" button
│   └── HelpModal.test.tsx        # MODIFY: assert new button + handler

├── App.tsx                       # MODIFY: conditionally render WelcomeModal

├── assets/onboarding/            # CREATE: placeholder illustrations
│   ├── step-fretboard.svg        #   (inline SVG mocks for now;
│   ├── step-overlay.svg          #    high-fidelity assets swap in later)
│   └── step-song.svg

└── i18n/
    └── translations.ts           # MODIFY: add onboarding.welcome.* keys
                                  #         (or equivalent i18n file)
```

---

### Task 1: Create `onboardingAtoms.ts` with persistence atom

**Files:**
- Create: `src/store/onboardingAtoms.ts`
- Test: `src/store/onboardingAtoms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/onboardingAtoms.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { seenWelcomeTutorialAtom } from "./onboardingAtoms";

describe("seenWelcomeTutorialAtom", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to false on fresh storage", () => {
    const store = createStore();
    expect(store.get(seenWelcomeTutorialAtom)).toBe(false);
  });

  it("persists to localStorage after being set true", () => {
    const store = createStore();
    store.set(seenWelcomeTutorialAtom, true);
    expect(localStorage.getItem("fretflow:seenWelcomeTutorial")).toBe("true");
  });

  it("reads existing localStorage value", () => {
    localStorage.setItem("fretflow:seenWelcomeTutorial", "true");
    const store = createStore();
    expect(store.get(seenWelcomeTutorialAtom)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/onboardingAtoms.test.ts`
Expected: FAIL — `onboardingAtoms.ts` doesn't exist.

- [ ] **Step 3: Create the atom module**

Create `src/store/onboardingAtoms.ts`:

```ts
/**
 * Atoms governing first-visit onboarding state.
 *
 * Phase 1 (this module today): a single boolean tracking whether the user
 * has seen and dismissed the welcome modal. Default `false`; set to `true`
 * on first dismiss; reset by the global reset action.
 *
 * Phase 2 (future): per-tip dismissed state for the TipPopover catalog,
 * keyed under `fretflow:tip:<tipKey>`. Not in this module yet.
 *
 * See `docs/superpowers/specs/2026-05-27-onboarding-tutorial-design.md`.
 */
import { atomWithStorage } from "jotai/utils";
import { k } from "../utils/storage";
import { booleanStorage, GET_ON_INIT } from "./storageHelpers";

export const seenWelcomeTutorialAtom = atomWithStorage<boolean>(
  k("seenWelcomeTutorial"),
  false,
  booleanStorage,
  GET_ON_INIT,
);
```

Note: The exact import path for `booleanStorage` and `GET_ON_INIT` depends on the codebase. If they live in `chordOverlayAtoms.ts` or `uiAtoms.ts` instead of a shared `storageHelpers.ts`, import from the right location. Run:

```bash
grep -rn "export.*booleanStorage\|export.*GET_ON_INIT" src/store/ | head -3
```

to find them, and update the import accordingly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/store/onboardingAtoms.test.ts`
Expected: PASS for all three tests.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep onboardingAtoms`
Expected: no errors.

---

### Task 2: Add i18n strings

**Files:**
- Modify: i18n translation file (likely `src/i18n/translations.ts` or `src/i18n/en.ts` — sweep to find)

- [ ] **Step 1: Locate the i18n file**

Run: `ls src/i18n/ && grep -rn "useTranslation\|t(\".*welcome\|^export" src/i18n/ 2>/dev/null | head -10`

Identify the file where translation keys are defined. The conventional location is a single `translations.ts` or `en.ts` flat object.

- [ ] **Step 2: Add onboarding keys**

In the identified file, add a new section:

```ts
onboarding: {
  welcome: {
    skipLabel: "Skip",
    backLabel: "Back",
    nextLabel: "Next",
    getStartedLabel: "Get started",
    showAgainLabel: "Show tour again",
    step1: {
      title: "Welcome to FretFlow",
      body: "FretFlow visualizes scales and chords on a guitar fretboard. Start by picking a root note and a scale — the fretboard lights up with the notes you can play.",
      altText: "Fretboard with C major scale notes highlighted",
    },
    step2: {
      title: "Overlay tab: scale and chord",
      body: "The Overlay tab is where you choose how the fretboard renders. Pick a fingering pattern (CAGED, 3NPS, 1-string, 2-strings). Stack a chord on top to see voicings.",
      altText: "Overlay tab with Scale and Chord cards labeled",
    },
    step3: {
      title: "Song tab: progressions and playback",
      body: "The Song tab lets you build chord progressions and play them back. The fretboard advances through each chord as it plays, so you can see exactly what's happening.",
      altText: "Song tab with a 4-bar progression and the play button highlighted",
    },
    finalNote: "Tap the (?) icon anytime to see this tour again.",
  },
},
```

Adapt the nesting depth to match the existing translation structure.

- [ ] **Step 3: Verify no key collisions**

Run: `grep -rn "onboarding\." src/ 2>/dev/null | head`
Expected: only the new keys + their future consumers (none yet). If any pre-existing `onboarding.*` key collides, rename to a unique namespace.

---

### Task 3: Create placeholder illustrations

**Files:**
- Create: `src/assets/onboarding/step-fretboard.svg`
- Create: `src/assets/onboarding/step-overlay.svg`
- Create: `src/assets/onboarding/step-song.svg`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/assets/onboarding
```

- [ ] **Step 2: Create placeholder SVGs**

Create `src/assets/onboarding/step-fretboard.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" role="img" aria-label="Fretboard illustration placeholder">
  <rect width="400" height="200" fill="#d6c4a0" rx="12"/>
  <g stroke="#857c6c" stroke-width="1.5">
    <line x1="0" y1="40" x2="400" y2="40"/>
    <line x1="0" y1="80" x2="400" y2="80"/>
    <line x1="0" y1="120" x2="400" y2="120"/>
    <line x1="0" y1="160" x2="400" y2="160"/>
  </g>
  <g fill="#2a251d">
    <circle cx="80" cy="60" r="10"/>
    <circle cx="160" cy="100" r="10"/>
    <circle cx="240" cy="140" r="10"/>
    <circle cx="320" cy="60" r="10"/>
  </g>
</svg>
```

Create `src/assets/onboarding/step-overlay.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" role="img" aria-label="Overlay tab illustration placeholder">
  <rect width="400" height="200" fill="#f6f2e9" rx="12"/>
  <rect x="20" y="30" width="360" height="60" fill="#ebebdc" stroke="#857c6c" stroke-width="1" rx="6"/>
  <text x="36" y="55" font-family="sans-serif" font-size="13" fill="#857c6c">SCALE</text>
  <text x="36" y="78" font-family="sans-serif" font-size="11" fill="#147088">CAGED · D shape</text>
  <rect x="20" y="110" width="360" height="60" fill="#ebebdc" stroke="#857c6c" stroke-width="1" rx="6"/>
  <text x="36" y="135" font-family="sans-serif" font-size="13" fill="#857c6c">CHORD</text>
  <text x="36" y="158" font-family="sans-serif" font-size="11" fill="#147088">C major · Full voicing</text>
</svg>
```

Create `src/assets/onboarding/step-song.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" role="img" aria-label="Song tab illustration placeholder">
  <rect width="400" height="200" fill="#f6f2e9" rx="12"/>
  <g>
    <rect x="20"  y="30" width="85" height="50" fill="#f6f2e9" stroke="#b1431b" stroke-width="2" rx="6"/>
    <rect x="110" y="30" width="85" height="50" fill="#f6f2e9" stroke="#857c6c" stroke-width="1" rx="6"/>
    <rect x="200" y="30" width="85" height="50" fill="#f6f2e9" stroke="#857c6c" stroke-width="1" rx="6"/>
    <rect x="290" y="30" width="85" height="50" fill="#f6f2e9" stroke="#857c6c" stroke-width="1" rx="6"/>
    <text x="56" y="62"  font-family="sans-serif" font-size="14" fill="#2a251d">C</text>
    <text x="146" y="62" font-family="sans-serif" font-size="14" fill="#2a251d">Am</text>
    <text x="236" y="62" font-family="sans-serif" font-size="14" fill="#2a251d">F</text>
    <text x="326" y="62" font-family="sans-serif" font-size="14" fill="#2a251d">G</text>
  </g>
  <circle cx="200" cy="140" r="24" fill="#147088"/>
  <polygon points="194,128 194,152 214,140" fill="#f6f2e9"/>
</svg>
```

These SVG mocks use the reference palette and are deliberately rough — they communicate the concept without polished visual design. High-fidelity assets can swap in later by overwriting the same file paths.

- [ ] **Step 3: Verify the files render**

Open each SVG in a browser or VS Code preview. Confirm they're not garbled and look approximately like the descriptions in the alt text.

---

### Task 4: Create `WelcomeModal` component

**Files:**
- Create: `src/components/Onboarding/WelcomeModal.tsx`
- Create: `src/components/Onboarding/WelcomeModal.module.css`
- Test: `src/components/Onboarding/WelcomeModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/Onboarding/WelcomeModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { WelcomeModal } from "./WelcomeModal";
import { seenWelcomeTutorialAtom } from "../../store/onboardingAtoms";

describe("WelcomeModal", () => {
  it("renders step 1 on initial mount", () => {
    renderWithAtoms(<WelcomeModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /welcome to fretflow/i })).toBeInTheDocument();
  });

  it("advances to step 2 when Next is clicked", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<WelcomeModal />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { name: /overlay tab/i })).toBeInTheDocument();
  });

  it("advances to step 3 from step 2", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<WelcomeModal />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { name: /song tab/i })).toBeInTheDocument();
  });

  it("goes Back from step 2 to step 1", async () => {
    const user = userEvent.setup();
    renderWithAtoms(<WelcomeModal />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("heading", { name: /welcome to fretflow/i })).toBeInTheDocument();
  });

  it("Get started on step 3 dismisses and sets atom true", async () => {
    const user = userEvent.setup();
    const { store } = renderWithAtoms(<WelcomeModal />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /get started/i }));
    expect(store.get(seenWelcomeTutorialAtom)).toBe(true);
  });

  it("Skip dismisses and sets atom true from any step", async () => {
    const user = userEvent.setup();
    const { store } = renderWithAtoms(<WelcomeModal />);
    await user.click(screen.getByRole("button", { name: /skip/i }));
    expect(store.get(seenWelcomeTutorialAtom)).toBe(true);
  });

  it("Esc dismisses and sets atom true", async () => {
    const user = userEvent.setup();
    const { store } = renderWithAtoms(<WelcomeModal />);
    await user.keyboard("{Escape}");
    expect(store.get(seenWelcomeTutorialAtom)).toBe(true);
  });

  it("traps focus within the dialog on initial mount", () => {
    renderWithAtoms(<WelcomeModal />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus(); // or any focusable inside has focus
  });
});
```

Add an a11y check:

```tsx
import { axe } from "vitest-axe";

it("has no a11y violations on step 1", async () => {
  const { container } = renderWithAtoms(<WelcomeModal />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/Onboarding/WelcomeModal.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create the CSS module**

Create `src/components/Onboarding/WelcomeModal.module.css`:

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(42, 37, 29, 0.6); /* INK at 60% */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--surface-card, #f6f2e9);
  color: var(--text-primary, #2a251d);
  border-radius: 12px;
  padding: var(--space-6, 24px);
  max-width: 480px;
  width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  outline: none;
}

.illustration {
  width: 100%;
  height: auto;
  margin-block-end: var(--space-4, 16px);
}

.heading {
  font-size: 1.4rem;
  margin-block-end: var(--space-2, 8px);
}

.body {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-primary, #2a251d);
  margin-block-end: var(--space-4, 16px);
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-block-start: var(--space-4, 16px);
  gap: var(--space-2, 8px);
}

.progressDots {
  display: flex;
  gap: 6px;
}

.progressDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted, #857c6c);
  opacity: 0.3;
}

.progressDotActive {
  background: var(--accent-primary, #147088);
  opacity: 1;
}

.navRight {
  display: flex;
  gap: var(--space-2, 8px);
}

.skipButton {
  background: transparent;
  border: 0;
  color: var(--text-muted, #857c6c);
  font-size: 0.9rem;
  cursor: pointer;
  padding: var(--space-2, 8px);
}

.primaryButton {
  background: var(--accent-primary, #147088);
  color: var(--surface-card, #f6f2e9);
  border: 0;
  border-radius: 6px;
  padding: var(--space-2, 8px) var(--space-4, 16px);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.secondaryButton {
  background: transparent;
  border: 1px solid var(--text-muted, #857c6c);
  color: var(--text-primary, #2a251d);
  border-radius: 6px;
  padding: var(--space-2, 8px) var(--space-4, 16px);
  font-size: 0.95rem;
  cursor: pointer;
}

.finalNote {
  font-size: 0.85rem;
  color: var(--text-muted, #857c6c);
  margin-block-start: var(--space-3, 12px);
  text-align: center;
}
```

- [ ] **Step 4: Create the component**

Create `src/components/Onboarding/WelcomeModal.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import clsx from "clsx";
import { seenWelcomeTutorialAtom } from "../../store/onboardingAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import stepFretboardSvg from "../../assets/onboarding/step-fretboard.svg";
import stepOverlaySvg from "../../assets/onboarding/step-overlay.svg";
import stepSongSvg from "../../assets/onboarding/step-song.svg";
import styles from "./WelcomeModal.module.css";

const STEP_COUNT = 3;

interface StepContent {
  title: string;
  body: string;
  alt: string;
  illustration: string;
}

export function WelcomeModal() {
  const { t } = useTranslation();
  const setSeen = useSetAtom(seenWelcomeTutorialAtom);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const steps: StepContent[] = [
    {
      title: t("onboarding.welcome.step1.title"),
      body: t("onboarding.welcome.step1.body"),
      alt: t("onboarding.welcome.step1.altText"),
      illustration: stepFretboardSvg,
    },
    {
      title: t("onboarding.welcome.step2.title"),
      body: t("onboarding.welcome.step2.body"),
      alt: t("onboarding.welcome.step2.altText"),
      illustration: stepOverlaySvg,
    },
    {
      title: t("onboarding.welcome.step3.title"),
      body: t("onboarding.welcome.step3.body"),
      alt: t("onboarding.welcome.step3.altText"),
      illustration: stepSongSvg,
    },
  ];

  const dismiss = useCallback(() => {
    setSeen(true);
  }, [setSeen]);

  const next = useCallback(() => {
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const back = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // Focus the dialog on mount for screen-reader announcement + keyboard navigation.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Esc dismisses; arrow keys navigate steps.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss, next, back]);

  // Outside click on backdrop dismisses.
  const onBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        dismiss();
      }
    },
    [dismiss],
  );

  const current = steps[step];
  const headingId = `welcome-modal-step-${step}-heading`;
  const isLast = step === STEP_COUNT - 1;

  return (
    <div className={styles.backdrop} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <img
          src={current.illustration}
          alt={current.alt}
          className={styles.illustration}
        />
        <h2 id={headingId} className={styles.heading}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        {isLast && (
          <p className={styles.finalNote}>{t("onboarding.welcome.finalNote")}</p>
        )}

        <div className={styles.nav}>
          <button
            type="button"
            className={styles.skipButton}
            onClick={dismiss}
          >
            {t("onboarding.welcome.skipLabel")}
          </button>

          <div className={styles.progressDots} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={clsx(
                  styles.progressDot,
                  i === step && styles.progressDotActive,
                )}
              />
            ))}
          </div>

          <div className={styles.navRight}>
            {step > 0 && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={back}
              >
                {t("onboarding.welcome.backLabel")}
              </button>
            )}
            <button
              type="button"
              className={styles.primaryButton}
              onClick={next}
            >
              {isLast
                ? t("onboarding.welcome.getStartedLabel")
                : t("onboarding.welcome.nextLabel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/Onboarding/WelcomeModal.test.tsx`
Expected: all tests pass. If any fail, address inline (likely focus-trap mechanics or i18n key mismatches).

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep WelcomeModal`
Expected: no errors.

---

### Task 5: Wire `WelcomeModal` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Locate the existing HelpModal lazy import**

Run: `grep -n "HelpModal\|lazy" src/App.tsx | head -10`

- [ ] **Step 2: Add lazy import for WelcomeModal**

Near the existing `const HelpModal = lazy(...)` line in `src/App.tsx`, add:

```tsx
const WelcomeModal = lazy(() =>
  import("./components/Onboarding/WelcomeModal").then((m) => ({ default: m.WelcomeModal }))
);
```

- [ ] **Step 3: Add the atom subscription**

In the `App` component function body, add:

```tsx
const seenWelcomeTutorial = useAtomValue(seenWelcomeTutorialAtom);
const showWelcomeModal =
  !seenWelcomeTutorial && import.meta.env.MODE !== "test";
```

The `MODE !== "test"` guard prevents the modal from auto-rendering during component tests of other components (which would otherwise need to dismiss it before testing anything else).

- [ ] **Step 4: Render conditionally**

In the App's JSX, near the existing `<HelpModal ... />` render, add:

```tsx
{showWelcomeModal && (
  <Suspense fallback={null}>
    <WelcomeModal />
  </Suspense>
)}
```

If `Suspense` isn't already imported, add it to the React import line:
```tsx
import { lazy, Suspense, useEffect } from "react";
```

- [ ] **Step 5: Add the atom import**

Near the top of `src/App.tsx`, add:

```tsx
import { seenWelcomeTutorialAtom } from "./store/onboardingAtoms";
```

If `useAtomValue` isn't already imported from jotai:

```tsx
import { useAtomValue } from "jotai";
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: zero errors.

- [ ] **Step 7: Smoke test in dev**

Run: `pnpm dev`

In the running app:
1. Open a new browser session (clear localStorage if needed: DevTools → Application → Clear storage).
2. Confirm the WelcomeModal renders on first load.
3. Click through all 3 steps. Confirm "Get started" dismisses.
4. Reload — modal should NOT reappear.

Don't commit this manual test result; just verify behavior is correct.

---

### Task 6: Add "Show tour again" button to `HelpModal`

**Files:**
- Modify: `src/components/HelpModal/HelpModal.tsx`
- Test: `src/components/HelpModal/HelpModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/HelpModal/HelpModal.test.tsx`:

```tsx
it("renders a 'Show tour again' button that resets seenWelcomeTutorialAtom", async () => {
  const user = userEvent.setup();
  const { store } = renderWithAtoms(
    <HelpModal isOpen={true} onClose={() => {}} />,
    { atoms: [[seenWelcomeTutorialAtom, true]] }
  );
  expect(store.get(seenWelcomeTutorialAtom)).toBe(true);
  await user.click(screen.getByRole("button", { name: /show tour again/i }));
  expect(store.get(seenWelcomeTutorialAtom)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/HelpModal/HelpModal.test.tsx -t "Show tour again"`
Expected: FAIL — button doesn't exist.

- [ ] **Step 3: Add the button**

In `src/components/HelpModal/HelpModal.tsx`:

1. Add imports:
```tsx
import { useSetAtom } from "jotai";
import { seenWelcomeTutorialAtom } from "../../store/onboardingAtoms";
import { useTranslation } from "../../hooks/useTranslation";
```

2. Inside the component body:
```tsx
const setSeen = useSetAtom(seenWelcomeTutorialAtom);
const { t } = useTranslation();

const handleShowTourAgain = () => {
  setSeen(false);
  onClose(); // Close the help modal so the welcome modal can take over
};
```

3. In the JSX (near other action buttons or in a footer):
```tsx
<button
  type="button"
  onClick={handleShowTourAgain}
  className={styles.tourAgainButton ?? styles.secondaryButton}
>
  {t("onboarding.welcome.showAgainLabel")}
</button>
```

If `HelpModal.module.css` has no equivalent button style, add one:

```css
.tourAgainButton {
  background: transparent;
  border: 1px solid var(--text-muted, #857c6c);
  color: var(--text-primary, #2a251d);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  margin-block-start: var(--space-3, 12px);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/HelpModal/HelpModal.test.tsx -t "Show tour again"`
Expected: PASS.

- [ ] **Step 5: Run full HelpModal test file**

Run: `pnpm vitest run src/components/HelpModal/HelpModal.test.tsx`
Expected: all tests pass (no regression from earlier Lens Consolidation plan's HelpModal changes either).

---

### Task 7: Add `seenWelcomeTutorialAtom` to reset action

**Files:**
- Modify: `src/store/actions.ts`

- [ ] **Step 1: Locate the reset action**

Run: `grep -n "RESET\|reset" src/store/actions.ts | head -10`

Find the reset action (likely a function or atom that calls `set(atom, RESET)` for each user-resettable atom).

- [ ] **Step 2: Add the atom to the reset list**

In `src/store/actions.ts`:

1. Add to imports:
```tsx
import { seenWelcomeTutorialAtom } from "./onboardingAtoms";
```

2. Inside the reset action body, alongside the other `set(..., RESET)` calls, add:
```tsx
set(seenWelcomeTutorialAtom, RESET);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json 2>&1 | grep actions.ts`
Expected: zero errors.

- [ ] **Step 4: Add a regression-guard test if the reset action has a test file**

If `src/store/actions.test.ts` exists, add:

```ts
it("includes seenWelcomeTutorialAtom in the reset chain", () => {
  const store = createStore();
  store.set(seenWelcomeTutorialAtom, true);
  store.set(resetAtom);  // or whatever the action's set-handle is called
  expect(store.get(seenWelcomeTutorialAtom)).toBe(false);
});
```

Adapt to match the existing test patterns.

Run: `pnpm vitest run src/store/actions.test.ts`
Expected: all tests pass.

---

### Task 8: Visual regression baseline + WelcomeModal snapshot

**Files:**
- Modify: visual snapshots under `e2e/`
- Optionally: add a new e2e test for the welcome modal flow

- [ ] **Step 1: Add visual snapshot e2e for the WelcomeModal (light + dark)**

Decide whether to add a dedicated visual test or rely on the modal appearing in existing first-load snapshots.

If the existing visual suite mocks `localStorage` such that `seenWelcomeTutorial = true` is preset (so the modal doesn't appear in app-component snapshots), the existing snapshots don't need refresh. Verify:

Run: `grep -rn "seenWelcomeTutorial\|onboarding" e2e/ 2>/dev/null`

If zero results, the visual suite doesn't account for the new modal — first-load snapshots will now include it. Decide:

**Option A (recommended):** Update the e2e setup helper to set `localStorage.setItem("fretflow:seenWelcomeTutorial", "true")` before each test. This keeps existing snapshots stable and isolates the modal to a dedicated test.

**Option B:** Refresh all first-load snapshots to include the welcome modal overlay.

If Option A:
- Locate the e2e setup (likely `e2e/test-utils/setup.ts` or in `playwright.config.ts` `globalSetup`).
- Add the localStorage preset.

If Option B: skip to Step 2.

- [ ] **Step 2: Add a dedicated welcome-modal e2e test (Option A path)**

Create `e2e/app-overlays/welcome-modal.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Welcome modal", () => {
  test("renders on first visit and dismisses on Get started", async ({ page }) => {
    await page.goto("/");
    // Welcome modal should appear (no localStorage preset for this test).
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Welcome to FretFlow");

    // Step through all 3.
    await page.getByRole("button", { name: /next/i }).click();
    await expect(dialog).toContainText("Overlay tab");
    await page.getByRole("button", { name: /next/i }).click();
    await expect(dialog).toContainText("Song tab");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(dialog).not.toBeVisible();

    // Reload — modal should NOT reappear.
    await page.reload();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
```

This test runs against a clean storage state (no preset). Make sure the test framework gives it fresh storage — Playwright's default behavior creates a new browser context per test, which has empty storage. If using a shared context, override per-test.

- [ ] **Step 3: Run e2e**

Run: `pnpm test:e2e:production`
Expected: existing tests pass (now with the localStorage preset if Option A); new welcome-modal test passes.

- [ ] **Step 4: Refresh visual baselines if needed (Option B path or any incidental shifts)**

Run: `pnpm test:visual:update`
Expected: small diff (or none, depending on Step 1 decision). Commit only intentional changes.

---

### Task 9: Final verification + commit

- [ ] **Step 1: Full lint + typecheck + test + build**

Run: `pnpm lint && pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 2: Commit**

```bash
git add src/store/onboardingAtoms.ts src/store/onboardingAtoms.test.ts \
        src/store/actions.ts \
        src/components/Onboarding/ \
        src/components/HelpModal/HelpModal.tsx \
        src/components/HelpModal/HelpModal.test.tsx \
        src/components/HelpModal/HelpModal.module.css \
        src/App.tsx \
        src/assets/onboarding/ \
        src/i18n/

# Only add e2e if Task 8 made changes there:
git add e2e/

git commit -m "$(cat <<'EOF'
feat(onboarding): add first-visit welcome modal (Phase 1)

3-step stepped modal introducing the fretboard, the Overlay tab, and the
Song tab. Dismissed-state persists via seenWelcomeTutorialAtom; HelpModal
gains a "Show tour again" button that resets the atom. Reset action
includes the new atom in its atom list.

Phase 2 (TipPopover + initial tips) deferred to a separate plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Visual baseline refresh commit (if any updates from Task 8)**

```bash
git add e2e/
git commit -m "$(cat <<'EOF'
test(visual): refresh baselines for welcome modal addition

Adds welcome-modal first-visit e2e and updates incidental snapshots that
shifted due to the new lazy chunk import. Linux baselines auto-rebuild.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Manual smoke verification

No file changes; no commit.

- [ ] **Step 1: Fresh-visit smoke**

1. Clear localStorage in DevTools.
2. Reload the app.
3. Confirm welcome modal renders.
4. Step through all 3 panes via Next button.
5. Click Get started. Modal dismisses.
6. Reload. Modal does not reappear.

- [ ] **Step 2: Keyboard navigation**

1. Clear localStorage. Reload.
2. Use ArrowRight to advance steps. Confirm advance.
3. Use ArrowLeft to go back. Confirm back.
4. Press Esc. Modal dismisses.

- [ ] **Step 3: Skip from step 1**

1. Clear localStorage. Reload.
2. On step 1, click Skip. Modal dismisses immediately.
3. Verify `localStorage.getItem("fretflow:seenWelcomeTutorial")` is `"true"`.

- [ ] **Step 4: Outside click**

1. Clear localStorage. Reload.
2. Click on the dark backdrop (outside the dialog).
3. Modal dismisses.

- [ ] **Step 5: Show tour again**

1. Open Help modal (? button).
2. Click "Show tour again".
3. Confirm: Help modal closes; Welcome modal opens at step 1.

- [ ] **Step 6: Reset action**

1. Trigger Settings → Reset (whatever UI exposes the reset action).
2. Confirm welcome modal returns on next visit (or immediately, depending on app behavior).

---

## Verification summary

```bash
pnpm lint && pnpm test && pnpm build && pnpm test:e2e:production
```
Expected: all green.

```bash
git log --oneline -3
```
Expected: 1-2 commits at the top: welcome modal implementation + (if applicable) visual baseline refresh.

---

## Phase 2 deferral note

Phase 2 (TipPopover primitive + 5 initial contextual tips) is a separate scope:
- `src/components/Onboarding/TipPopover.tsx` — anchored popover, per-tip persistence.
- `src/components/Onboarding/tipRegistry.ts` — initial 5-tip catalog.
- Tip placements distributed across `FingeringPatternControls`, `VoicingControl`, tab bar, etc.

When prioritized, write a sibling plan `2026-MM-DD-onboarding-tip-popover.md` (or similar). The `seenWelcomeTutorialAtom` infrastructure from this plan provides the pattern for the per-tip atoms.

---

## Self-review notes

- **Spec coverage:**
  - Phase 1 trigger and persistence: Tasks 1, 5.
  - Welcome modal content (3 steps + final): Tasks 2, 3, 4.
  - Component: Task 4.
  - App.tsx wiring: Task 5.
  - HelpModal "Show tour again": Task 6.
  - Reset action update: Task 7.
  - Storage contract test: Task 1 (atom tests).
  - i18n: Task 2.
  - Visual + e2e: Task 8.
  - Phase 2: explicitly deferred; not implemented.
- **Placeholder scan:** All steps have concrete code or commands. Task 8 has two branches (Option A vs Option B) — the implementer picks one based on the existing visual suite's structure; this is decision-making, not a placeholder.
- **Type consistency:** `seenWelcomeTutorialAtom` referenced consistently across Tasks 1, 5, 6, 7, 8. `WelcomeModal` consistent across Tasks 4-8. i18n keys match between Task 2 (definition) and Task 4 (consumption).
