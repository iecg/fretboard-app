# PWA & URL Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add installable PWA with offline support and one-button URL sharing of song configurations (key, scale, progression, tempo, time signature).

**Architecture:** A compact URL codec encodes shareable state into a single query param. A derived-atom override layer applies shared link state without touching localStorage. `vite-plugin-pwa` handles service worker generation and offline caching. A share button in the header generates/shares URLs, and a one-time install banner prompts PWA installation.

**Tech Stack:** Vite + vite-plugin-pwa + Workbox, lz-string (compression fallback), Jotai derived atoms, Web Share API + Clipboard API, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-09-pwa-and-sharing-design.md`

---

### Task 1: Share Codec — Types & Encoder

**Files:**
- Create: `src/utils/shareCodec.ts`
- Create: `src/utils/shareCodec.test.ts`

This task builds the pure `encodeShareState` function and the `ShareState` type. No React, no atoms — pure functions.

- [ ] **Step 1: Write the ShareState type and encoder tests**

```ts
// src/utils/shareCodec.test.ts
import { describe, it, expect } from "vitest";
import { encodeShareState, type ShareState } from "./shareCodec";

describe("encodeShareState", () => {
  it("encodes a basic major progression", () => {
    const state: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "vi", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "IV", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("C.major.120.4x4.I-V-vi-IV");
  });

  it("encodes quality overrides", () => {
    const state: ShareState = {
      root: "G",
      scale: "major",
      tempo: 90,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "ii", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("G.major.90.4x4.ii-V:7-I");
  });

  it("encodes non-default durations", () => {
    const state: ShareState = {
      root: "A",
      scale: "minor blues",
      tempo: 80,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: "7", duration: { value: 4, unit: "bar" } },
        { degree: "IV", qualityOverride: "7", duration: { value: 2, unit: "bar" } },
        { degree: "I", qualityOverride: "7", duration: { value: 2, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "IV", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "I", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("A.minor+blues.80.4x4.I:7*4b-IV:7*2b-I:7*2b-V:7-IV:7-I:7-V:7");
  });

  it("encodes beat durations", () => {
    const state: ShareState = {
      root: "D",
      scale: "dorian",
      tempo: 100,
      timeSignature: { numerator: 3, denominator: 4 },
      steps: [
        { degree: "i", qualityOverride: null, duration: { value: 2, unit: "beat" } },
        { degree: "IV", qualityOverride: null, duration: { value: 1, unit: "beat" } },
      ],
    };
    expect(encodeShareState(state)).toBe("D.dorian.100.3x4.i*2bt-IV*1bt");
  });

  it("encodes sharp root notes", () => {
    const state: ShareState = {
      root: "F#",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    expect(encodeShareState(state)).toBe("Fs.major.120.4x4.I");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/utils/shareCodec.test.ts`
Expected: FAIL — module `./shareCodec` not found.

- [ ] **Step 3: Implement ShareState type and encodeShareState**

```ts
// src/utils/shareCodec.ts
export interface ShareState {
  root: string;
  scale: string;
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  steps: Array<{
    degree: string;
    qualityOverride: string | null;
    duration: { value: number; unit: "bar" | "beat" };
  }>;
}

function encodeRoot(root: string): string {
  return root.replace("#", "s");
}

function encodeScale(scale: string): string {
  return scale.replace(/ /g, "+");
}

function encodeStep(step: ShareState["steps"][number]): string {
  let token = step.degree;
  if (step.qualityOverride) token += `:${step.qualityOverride}`;
  const isDefaultDuration = step.duration.value === 1 && step.duration.unit === "bar";
  if (!isDefaultDuration) {
    const suffix = step.duration.unit === "bar" ? "b" : "bt";
    token += `*${step.duration.value}${suffix}`;
  }
  return token;
}

export function encodeShareState(state: ShareState): string {
  const root = encodeRoot(state.root);
  const scale = encodeScale(state.scale);
  const ts = `${state.timeSignature.numerator}x${state.timeSignature.denominator}`;
  const chords = state.steps.map(encodeStep).join("-");
  return `${root}.${scale}.${state.tempo}.${ts}.${chords}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/utils/shareCodec.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/shareCodec.ts src/utils/shareCodec.test.ts
git commit -m "feat(share): add ShareState type and encodeShareState codec"
```

---

### Task 2: Share Codec — Decoder

**Files:**
- Modify: `src/utils/shareCodec.ts`
- Modify: `src/utils/shareCodec.test.ts`

- [ ] **Step 1: Write decoder tests**

```ts
// Append to src/utils/shareCodec.test.ts
import { decodeShareState } from "./shareCodec";

describe("decodeShareState", () => {
  it("decodes a basic major progression", () => {
    const result = decodeShareState("C.major.120.4x4.I-V-vi-IV");
    expect(result).toEqual({
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "vi", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "IV", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    });
  });

  it("decodes quality overrides", () => {
    const result = decodeShareState("G.major.90.4x4.ii-V:7-I");
    expect(result?.steps[1]).toEqual({
      degree: "V", qualityOverride: "7", duration: { value: 1, unit: "bar" },
    });
  });

  it("decodes non-default bar durations", () => {
    const result = decodeShareState("A.minor+blues.80.4x4.I:7*4b-IV:7*2b");
    expect(result?.steps[0].duration).toEqual({ value: 4, unit: "bar" });
    expect(result?.steps[1].duration).toEqual({ value: 2, unit: "bar" });
  });

  it("decodes beat durations", () => {
    const result = decodeShareState("D.dorian.100.3x4.i*2bt-IV*1bt");
    expect(result?.steps[0].duration).toEqual({ value: 2, unit: "beat" });
    expect(result?.steps[1].duration).toEqual({ value: 1, unit: "beat" });
  });

  it("decodes sharp root notes", () => {
    const result = decodeShareState("Fs.major.120.4x4.I");
    expect(result?.root).toBe("F#");
  });

  it("decodes scale names with spaces", () => {
    const result = decodeShareState("A.minor+blues.80.4x4.I");
    expect(result?.scale).toBe("minor blues");
  });

  it("returns null for malformed input", () => {
    expect(decodeShareState("")).toBeNull();
    expect(decodeShareState("C")).toBeNull();
    expect(decodeShareState("C.major")).toBeNull();
    expect(decodeShareState("not.a.valid.url.at-all-$$")).toBeNull();
  });

  it("returns null for invalid tempo", () => {
    expect(decodeShareState("C.major.abc.4x4.I")).toBeNull();
    expect(decodeShareState("C.major.0.4x4.I")).toBeNull();
    expect(decodeShareState("C.major.999.4x4.I")).toBeNull();
  });
});

describe("roundtrip", () => {
  it("encode then decode produces the original state", () => {
    const state: ShareState = {
      root: "F#",
      scale: "minor blues",
      tempo: 80,
      timeSignature: { numerator: 3, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: "7", duration: { value: 4, unit: "bar" } },
        { degree: "IV", qualityOverride: null, duration: { value: 2, unit: "beat" } },
        { degree: "vi", qualityOverride: "m7", duration: { value: 1, unit: "bar" } },
      ],
    };
    const encoded = encodeShareState(state);
    const decoded = decodeShareState(encoded);
    expect(decoded).toEqual(state);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pnpm vitest run src/utils/shareCodec.test.ts`
Expected: FAIL — `decodeShareState` is not exported.

- [ ] **Step 3: Implement decodeShareState**

Add to `src/utils/shareCodec.ts`:

```ts
const MIN_TEMPO = 40;
const MAX_TEMPO = 240;

function decodeRoot(encoded: string): string | null {
  const decoded = encoded.replace("s", "#");
  if (!/^[A-G]#?$/.test(decoded)) return null;
  return decoded;
}

function decodeScale(encoded: string): string {
  return encoded.replace(/\+/g, " ");
}

function decodeTimeSignature(encoded: string): { numerator: number; denominator: number } | null {
  const match = encoded.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (numerator < 1 || numerator > 16 || ![1, 2, 4, 8, 16].includes(denominator)) return null;
  return { numerator, denominator };
}

function decodeStep(token: string): ShareState["steps"][number] | null {
  const match = token.match(/^([ivIV]+)(?::([A-Za-z0-9]+))?(?:\*(\d+)(bt|b))?$/);
  if (!match) return null;
  const [, degree, quality, durationValue, durationUnit] = match;
  return {
    degree,
    qualityOverride: quality ?? null,
    duration: durationValue
      ? { value: Number(durationValue), unit: durationUnit === "bt" ? "beat" : "bar" }
      : { value: 1, unit: "bar" },
  };
}

export function decodeShareState(param: string): ShareState | null {
  if (!param) return null;
  const parts = param.split(".");
  if (parts.length < 5) return null;

  const root = decodeRoot(parts[0]);
  if (!root) return null;

  const scale = decodeScale(parts[1]);

  const tempo = Number(parts[2]);
  if (!Number.isFinite(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO) return null;

  const timeSignature = decodeTimeSignature(parts[3]);
  if (!timeSignature) return null;

  // Rejoin remaining parts in case scale name contained dots (unlikely but defensive)
  const chordsStr = parts.slice(4).join(".");
  const chordTokens = chordsStr.split("-").filter(Boolean);
  if (chordTokens.length === 0) return null;

  const steps: ShareState["steps"] = [];
  for (const token of chordTokens) {
    const step = decodeStep(token);
    if (!step) return null;
    steps.push(step);
  }

  return { root, scale, tempo: Math.round(tempo), timeSignature, steps };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/utils/shareCodec.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/shareCodec.ts src/utils/shareCodec.test.ts
git commit -m "feat(share): add decodeShareState codec with validation"
```

---

### Task 3: Share Codec — lz-string Compression Fallback

**Files:**
- Modify: `src/utils/shareCodec.ts`
- Modify: `src/utils/shareCodec.test.ts`

- [ ] **Step 1: Install lz-string**

```bash
pnpm add lz-string
pnpm add -D @types/lz-string
```

- [ ] **Step 2: Write compression fallback tests**

```ts
// Append to src/utils/shareCodec.test.ts
import { encodeShareUrl, decodeShareUrl } from "./shareCodec";

describe("compression fallback", () => {
  it("uses 's' param for short state", () => {
    const state: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    const url = encodeShareUrl(state, "https://example.com/app/");
    expect(url).toContain("?s=");
    expect(url).not.toContain("?z=");
  });

  it("falls back to 'z' param for very long state", () => {
    const longSteps = Array.from({ length: 200 }, (_, i) => ({
      degree: i % 2 === 0 ? "I" : "IV",
      qualityOverride: "mMaj7",
      duration: { value: 4, unit: "bar" as const },
    }));
    const state: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: longSteps,
    };
    const url = encodeShareUrl(state, "https://example.com/app/");
    expect(url).toContain("?z=");
  });

  it("roundtrips through compression", () => {
    const longSteps = Array.from({ length: 200 }, (_, i) => ({
      degree: i % 2 === 0 ? "I" : "IV",
      qualityOverride: "mMaj7",
      duration: { value: 4, unit: "bar" as const },
    }));
    const state: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: longSteps,
    };
    const url = encodeShareUrl(state, "https://example.com/app/");
    const params = new URL(url).searchParams;
    const decoded = decodeShareUrl(params);
    expect(decoded).toEqual(state);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/utils/shareCodec.test.ts`
Expected: FAIL — `encodeShareUrl` and `decodeShareUrl` not exported.

- [ ] **Step 4: Implement encodeShareUrl and decodeShareUrl**

Add to `src/utils/shareCodec.ts`:

```ts
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

const MAX_S_PARAM_LENGTH = 1500;

export function encodeShareUrl(state: ShareState, baseUrl: string): string {
  const encoded = encodeShareState(state);
  const url = new URL(baseUrl);
  if (encoded.length <= MAX_S_PARAM_LENGTH) {
    url.searchParams.set("s", encoded);
  } else {
    const json = JSON.stringify(state);
    url.searchParams.set("z", compressToEncodedURIComponent(json));
  }
  return url.toString();
}

export function decodeShareUrl(params: URLSearchParams): ShareState | null {
  const s = params.get("s");
  if (s) return decodeShareState(s);

  const z = params.get("z");
  if (z) {
    try {
      const json = decompressFromEncodedURIComponent(z);
      if (!json) return null;
      const parsed = JSON.parse(json) as ShareState;
      // Validate structure minimally
      if (!parsed.root || !parsed.scale || !parsed.steps?.length) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/utils/shareCodec.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/shareCodec.ts src/utils/shareCodec.test.ts package.json pnpm-lock.yaml
git commit -m "feat(share): add lz-string compression fallback for long URLs"
```

---

### Task 4: URL Override Atoms

**Files:**
- Create: `src/store/urlOverrideAtoms.ts`
- Create: `src/store/urlOverrideAtoms.test.ts`

This task builds the derived-atom override layer. Components will read from `effective*` atoms that return URL overrides when present, falling back to the real persisted atoms.

- [ ] **Step 1: Write override atom tests**

```ts
// src/store/urlOverrideAtoms.test.ts
import { describe, it, expect } from "vitest";
import { createStore } from "jotai";
import { urlOverridesAtom, effectiveRootNoteAtom, effectiveScaleNameAtom, effectiveTempoAtom, effectiveBeatsPerBarAtom, effectiveTimeSignatureDenominatorAtom, effectiveProgressionStepsAtom, clearUrlOverridesAtom } from "./urlOverrideAtoms";
import { baseRootNoteAtom } from "./scaleAtoms";
import { baseScaleNameAtom } from "./scaleAtoms";
import { progressionTempoBpmAtom, beatsPerBarAtom, timeSignatureDenominatorAtom, progressionStepsAtom } from "./progressionAtoms";
import type { ShareState } from "../utils/shareCodec";

describe("urlOverrideAtoms", () => {
  it("effective atoms return persisted values when no overrides", () => {
    const store = createStore();
    store.set(baseRootNoteAtom, "G");
    expect(store.get(effectiveRootNoteAtom)).toBe("G");
    expect(store.get(urlOverridesAtom)).toBeNull();
  });

  it("effective atoms return override values when set", () => {
    const store = createStore();
    store.set(baseRootNoteAtom, "G");
    const overrides: ShareState = {
      root: "C",
      scale: "minor",
      tempo: 100,
      timeSignature: { numerator: 3, denominator: 4 },
      steps: [
        { degree: "i", qualityOverride: null, duration: { value: 1, unit: "bar" } },
      ],
    };
    store.set(urlOverridesAtom, overrides);
    expect(store.get(effectiveRootNoteAtom)).toBe("C");
    expect(store.get(effectiveScaleNameAtom)).toBe("minor");
    expect(store.get(effectiveTempoAtom)).toBe(100);
    expect(store.get(effectiveBeatsPerBarAtom)).toBe(3);
    expect(store.get(effectiveTimeSignatureDenominatorAtom)).toBe(4);
  });

  it("effective progression steps converts ShareState steps to ProgressionSteps", () => {
    const store = createStore();
    const overrides: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [
        { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
        { degree: "V", qualityOverride: "7", duration: { value: 2, unit: "bar" } },
      ],
    };
    store.set(urlOverridesAtom, overrides);
    const steps = store.get(effectiveProgressionStepsAtom);
    expect(steps).toHaveLength(2);
    expect(steps[0].degree).toBe("I");
    expect(steps[0].qualityOverride).toBeNull();
    expect(steps[1].degree).toBe("V");
    expect(steps[1].qualityOverride).toBe("7");
    expect(steps[1].duration).toEqual({ value: 2, unit: "bar" });
    // Each step gets a generated id
    expect(typeof steps[0].id).toBe("string");
    expect(steps[0].id).not.toBe(steps[1].id);
  });

  it("clearUrlOverridesAtom sets overrides to null", () => {
    const store = createStore();
    const overrides: ShareState = {
      root: "C",
      scale: "major",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      steps: [{ degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } }],
    };
    store.set(urlOverridesAtom, overrides);
    expect(store.get(urlOverridesAtom)).not.toBeNull();
    store.set(clearUrlOverridesAtom);
    expect(store.get(urlOverridesAtom)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/store/urlOverrideAtoms.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the override atoms**

```ts
// src/store/urlOverrideAtoms.ts
import { atom } from "jotai";
import type { ShareState } from "../utils/shareCodec";
import type { ProgressionStep } from "../progressions/progressionDomain";
import { createProgressionStep } from "../progressions/progressionDomain";
import { baseRootNoteAtom, baseScaleNameAtom } from "./scaleAtoms";
import {
  progressionTempoBpmAtom,
  beatsPerBarAtom,
  timeSignatureDenominatorAtom,
  progressionStepsAtom,
} from "./progressionAtoms";

export const urlOverridesAtom = atom<ShareState | null>(null);

export const effectiveRootNoteAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.root ?? get(baseRootNoteAtom);
});

export const effectiveScaleNameAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.scale ?? get(baseScaleNameAtom);
});

export const effectiveTempoAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.tempo ?? get(progressionTempoBpmAtom);
});

export const effectiveBeatsPerBarAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.timeSignature.numerator ?? get(beatsPerBarAtom);
});

export const effectiveTimeSignatureDenominatorAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.timeSignature.denominator ?? get(timeSignatureDenominatorAtom);
});

function shareStepsToProgressionSteps(steps: ShareState["steps"]): ProgressionStep[] {
  return steps.map((step) =>
    createProgressionStep({
      degree: step.degree,
      qualityOverride: step.qualityOverride,
      duration: step.duration,
    }),
  );
}

export const effectiveProgressionStepsAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  if (overrides) return shareStepsToProgressionSteps(overrides.steps);
  return get(progressionStepsAtom);
});

export const clearUrlOverridesAtom = atom(null, (_get, set) => {
  set(urlOverridesAtom, null);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/store/urlOverrideAtoms.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/urlOverrideAtoms.ts src/store/urlOverrideAtoms.test.ts
git commit -m "feat(share): add URL override atom layer for temporary shared state"
```

---

### Task 5: useShareLinkHandler Hook

**Files:**
- Create: `src/hooks/useShareLinkHandler.ts`
- Create: `src/hooks/useShareLinkHandler.test.ts`

Parses the URL on mount. If share params are present, decodes and sets `urlOverridesAtom`, then strips params from the URL.

- [ ] **Step 1: Write the hook test**

```ts
// src/hooks/useShareLinkHandler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { type ReactNode } from "react";
import { urlOverridesAtom } from "../store/urlOverrideAtoms";
import { useShareLinkHandler } from "./useShareLinkHandler";

function createWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("useShareLinkHandler", () => {
  const originalLocation = window.location;
  const replaceStateSpy = vi.spyOn(window.history, "replaceState");

  beforeEach(() => {
    replaceStateSpy.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("sets urlOverridesAtom when share param is present", () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/?s=C.major.120.4x4.I-V-vi-IV"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    const overrides = store.get(urlOverridesAtom);
    expect(overrides).not.toBeNull();
    expect(overrides?.root).toBe("C");
    expect(overrides?.steps).toHaveLength(4);
  });

  it("strips query params after parsing", () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/?s=C.major.120.4x4.I"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", expect.not.stringContaining("?s="));
  });

  it("does nothing when no share params present", () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    expect(store.get(urlOverridesAtom)).toBeNull();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it("ignores malformed share params", () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/?s=garbage"),
      writable: true,
    });
    const store = createStore();
    renderHook(() => useShareLinkHandler(), { wrapper: createWrapper(store) });
    expect(store.get(urlOverridesAtom)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/hooks/useShareLinkHandler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useShareLinkHandler.ts
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { urlOverridesAtom } from "../store/urlOverrideAtoms";
import { decodeShareUrl } from "../utils/shareCodec";

export function useShareLinkHandler(): void {
  const setOverrides = useSetAtom(urlOverridesAtom);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("s") && !params.has("z")) return;

    const state = decodeShareUrl(params);
    if (!state) return;

    setOverrides(state);

    // Strip share params from URL without triggering navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    url.searchParams.delete("z");
    window.history.replaceState(null, "", url.pathname + url.hash);
  }, [setOverrides]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/hooks/useShareLinkHandler.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useShareLinkHandler.ts src/hooks/useShareLinkHandler.test.ts
git commit -m "feat(share): add useShareLinkHandler hook for inbound shared links"
```

---

### Task 6: Toast Component

**Files:**
- Create: `src/components/Toast/Toast.tsx`
- Create: `src/components/Toast/Toast.module.css`
- Create: `src/components/Toast/Toast.test.tsx`

A lightweight, auto-dismissing toast notification. No library — minimal component.

- [ ] **Step 1: Write Toast tests**

```tsx
// src/components/Toast/Toast.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders the message", () => {
    render(<Toast message="Link copied" onDismiss={() => {}} />);
    expect(screen.getByText("Link copied")).toBeInTheDocument();
  });

  it("has an accessible alert role", () => {
    render(<Toast message="Link copied" onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("calls onDismiss after the auto-dismiss duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Link copied" onDismiss={onDismiss} durationMs={2000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/Toast/Toast.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Toast component**

```tsx
// src/components/Toast/Toast.tsx
import { useEffect } from "react";
import styles from "./Toast.module.css";

interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 2500 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
```

```css
/* src/components/Toast/Toast.module.css */
.toast {
  position: fixed;
  bottom: var(--space-lg, 1.5rem);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-elevated, #2a2a2e);
  color: var(--color-text-primary, #fff);
  font-size: var(--font-size-sm, 0.875rem);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  pointer-events: none;
  animation: toast-in 200ms ease-out;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/Toast/Toast.test.tsx`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toast/
git commit -m "feat(ui): add Toast auto-dismiss notification component"
```

---

### Task 7: Share Button Component

**Files:**
- Create: `src/components/ShareButton/ShareButton.tsx`
- Create: `src/components/ShareButton/ShareButton.module.css`
- Create: `src/components/ShareButton/ShareButton.test.tsx`
- Modify: `src/App.tsx` (add share button to header actions)

- [ ] **Step 1: Write ShareButton tests**

```tsx
// src/components/ShareButton/ShareButton.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { type ReactNode } from "react";
import { ShareButton } from "./ShareButton";
import { baseRootNoteAtom, baseScaleNameAtom } from "../../store/scaleAtoms";
import { progressionTempoBpmAtom, beatsPerBarAtom, timeSignatureDenominatorAtom, progressionStepsAtom } from "../../store/progressionAtoms";
import type { ProgressionStep } from "../../progressions/progressionDomain";

function createWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

const DEFAULT_STEPS: ProgressionStep[] = [
  { id: "1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "2", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "3", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
];

describe("ShareButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders a share button with accessible label", () => {
    const store = createStore();
    store.set(progressionStepsAtom, DEFAULT_STEPS);
    render(<ShareButton />, { wrapper: createWrapper(store) });
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("copies a URL to clipboard on click", async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(baseRootNoteAtom, "C");
    store.set(baseScaleNameAtom, "major");
    store.set(progressionTempoBpmAtom, 120);
    store.set(beatsPerBarAtom, 4);
    store.set(timeSignatureDenominatorAtom, 4);
    store.set(progressionStepsAtom, DEFAULT_STEPS);

    render(<ShareButton />, { wrapper: createWrapper(store) });
    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("?s=C.major.120.4x4.I-V-vi-IV"),
    );
  });

  it("shows a toast after copying", async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(progressionStepsAtom, DEFAULT_STEPS);
    render(<ShareButton />, { wrapper: createWrapper(store) });
    await user.click(screen.getByRole("button", { name: /share/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/ShareButton/ShareButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ShareButton**

```tsx
// src/components/ShareButton/ShareButton.tsx
import { useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { Share2 } from "lucide-react";
import clsx from "clsx";
import { effectiveRootNoteAtom, effectiveScaleNameAtom, effectiveTempoAtom, effectiveBeatsPerBarAtom, effectiveTimeSignatureDenominatorAtom, effectiveProgressionStepsAtom } from "../../store/urlOverrideAtoms";
import { encodeShareUrl, type ShareState } from "../../utils/shareCodec";
import { Toast } from "../Toast/Toast";
import sharedStyles from "../shared/shared.module.css";

const BASE_URL = "https://iecg.github.io/fretboard-app/";

export function ShareButton() {
  const root = useAtomValue(effectiveRootNoteAtom);
  const scale = useAtomValue(effectiveScaleNameAtom);
  const tempo = useAtomValue(effectiveTempoAtom);
  const numerator = useAtomValue(effectiveBeatsPerBarAtom);
  const denominator = useAtomValue(effectiveTimeSignatureDenominatorAtom);
  const steps = useAtomValue(effectiveProgressionStepsAtom);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    const state: ShareState = {
      root,
      scale,
      tempo,
      timeSignature: { numerator, denominator },
      steps: steps.map((s) => ({
        degree: s.degree,
        qualityOverride: s.qualityOverride,
        duration: s.duration,
      })),
    };

    const url = encodeShareUrl(state, BASE_URL);

    if (typeof navigator.share === "function" && navigator.canShare?.({ url })) {
      try {
        await navigator.share({ url, title: `FretFlow — ${root} ${scale}` });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setToastMessage("Link copied");
    } catch {
      setToastMessage("Couldn't copy link");
    }
  }, [root, scale, tempo, numerator, denominator, steps]);

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
        title="Share this song"
        aria-label="Share this song"
      >
        <Share2 className="icon" />
      </button>
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </>
  );
}
```

```css
/* src/components/ShareButton/ShareButton.module.css */
/* Reserved for future share-specific styles. Component currently uses shared icon-button styles. */
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/ShareButton/ShareButton.test.tsx`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareButton/
git commit -m "feat(share): add ShareButton component with clipboard and Web Share API"
```

---

### Task 8: Wire Share Button and Share Link Handler into App

**Files:**
- Modify: `src/App.tsx`

This task adds the `<ShareButton />` to the header actions and calls `useShareLinkHandler()` in the App component.

- [ ] **Step 1: Add ShareButton import and useShareLinkHandler to App.tsx**

At the top of `src/App.tsx`, add:

```ts
import { ShareButton } from "./components/ShareButton/ShareButton";
import { useShareLinkHandler } from "./hooks/useShareLinkHandler";
```

Inside the App component function body (before the return), add:

```ts
useShareLinkHandler();
```

In the `actions` prop of `<AppHeader>`, add `<ShareButton />` before the theme toggle button:

```tsx
actions={
  <>
    <ShareButton />
    <button
      type="button"
      onClick={() => setTheme(theme === "modern-dark" ? "light" : "dark")}
      ...
```

- [ ] **Step 2: Run lint to check for issues**

Run: `pnpm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Run full test suite**

Run: `pnpm run test`
Expected: All tests PASS.

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(share): wire ShareButton and useShareLinkHandler into App"
```

---

### Task 9: Shared Link Banner Component

**Files:**
- Create: `src/components/SharedLinkBanner/SharedLinkBanner.tsx`
- Create: `src/components/SharedLinkBanner/SharedLinkBanner.module.css`
- Create: `src/components/SharedLinkBanner/SharedLinkBanner.test.tsx`
- Modify: `src/App.tsx` (render banner when overrides active)

- [ ] **Step 1: Write SharedLinkBanner tests**

```tsx
// src/components/SharedLinkBanner/SharedLinkBanner.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { type ReactNode } from "react";
import { SharedLinkBanner } from "./SharedLinkBanner";
import { urlOverridesAtom } from "../../store/urlOverrideAtoms";
import type { ShareState } from "../../utils/shareCodec";

const OVERRIDE: ShareState = {
  root: "C",
  scale: "major",
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  steps: [
    { degree: "I", qualityOverride: null, duration: { value: 1, unit: "bar" } },
    { degree: "V", qualityOverride: null, duration: { value: 1, unit: "bar" } },
    { degree: "vi", qualityOverride: null, duration: { value: 1, unit: "bar" } },
    { degree: "IV", qualityOverride: null, duration: { value: 1, unit: "bar" } },
  ],
};

function createWrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("SharedLinkBanner", () => {
  it("renders nothing when no overrides active", () => {
    const store = createStore();
    const { container } = render(<SharedLinkBanner />, { wrapper: createWrapper(store) });
    expect(container.firstChild).toBeNull();
  });

  it("renders banner text when overrides active", () => {
    const store = createStore();
    store.set(urlOverridesAtom, OVERRIDE);
    render(<SharedLinkBanner />, { wrapper: createWrapper(store) });
    expect(screen.getByText(/viewing shared song/i)).toBeInTheDocument();
    expect(screen.getByText(/C major/)).toBeInTheDocument();
  });

  it("clears overrides on dismiss", async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(urlOverridesAtom, OVERRIDE);
    render(<SharedLinkBanner />, { wrapper: createWrapper(store) });
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(store.get(urlOverridesAtom)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/SharedLinkBanner/SharedLinkBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SharedLinkBanner**

```tsx
// src/components/SharedLinkBanner/SharedLinkBanner.tsx
import { useAtomValue, useSetAtom } from "jotai";
import { X } from "lucide-react";
import { urlOverridesAtom, clearUrlOverridesAtom } from "../../store/urlOverrideAtoms";
import styles from "./SharedLinkBanner.module.css";

export function SharedLinkBanner() {
  const overrides = useAtomValue(urlOverridesAtom);
  const clearOverrides = useSetAtom(clearUrlOverridesAtom);

  if (!overrides) return null;

  const chordList = overrides.steps.map((s) => {
    let label = s.degree;
    if (s.qualityOverride) label += s.qualityOverride;
    return label;
  }).join("-");

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles["banner-text"]}>
        Viewing shared song — {overrides.root} {overrides.scale} {chordList}
      </span>
      <button
        type="button"
        onClick={() => clearOverrides()}
        className={styles["banner-dismiss"]}
        aria-label="Dismiss shared song view"
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

```css
/* src/components/SharedLinkBanner/SharedLinkBanner.module.css */
.banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm, 0.5rem);
  padding: var(--space-xs, 0.25rem) var(--space-md, 1rem);
  background: var(--color-accent-subtle, rgba(134, 59, 255, 0.15));
  color: var(--color-text-primary, #fff);
  font-size: var(--font-size-xs, 0.75rem);
  text-align: center;
  width: 100%;
}

.banner-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm, 4px);
  flex-shrink: 0;
}

.banner-dismiss:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/SharedLinkBanner/SharedLinkBanner.test.tsx`
Expected: All 3 tests PASS.

- [ ] **Step 5: Wire SharedLinkBanner into App.tsx**

In `src/App.tsx`, import and render `<SharedLinkBanner />` just above the `<AppHeader>` inside the main layout, or as the first child of the layout wrapper (check what slot is available — likely above the header or as a child of `MainLayoutWrapper`). The banner sits at the very top of the viewport.

```ts
import { SharedLinkBanner } from "./components/SharedLinkBanner/SharedLinkBanner";
```

Add `<SharedLinkBanner />` at the top of the rendered tree, above `<AppHeader>`.

- [ ] **Step 6: Run lint, test, build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/SharedLinkBanner/ src/App.tsx
git commit -m "feat(share): add SharedLinkBanner for active shared link indicator"
```

---

### Task 10: PWA — Install vite-plugin-pwa and Configure Service Worker

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (via pnpm add)
- Modify: `public/site.webmanifest`
- Modify: `src/main.tsx` (register SW)

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
pnpm add -D vite-plugin-pwa
```

- [ ] **Step 2: Update vite.config.ts to add the PWA plugin**

In `vite.config.ts`, add the import at the top:

```ts
import { VitePWA } from "vite-plugin-pwa";
```

In the `plugins` array, after the `react()` plugin, add:

```ts
VitePWA({
  registerType: "autoUpdate",
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
    navigateFallback: "index.html",
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "google-fonts-css" },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-woff",
          expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
    ],
  },
  manifest: false, // use existing site.webmanifest
}),
```

- [ ] **Step 3: Update site.webmanifest with required PWA fields**

Replace `public/site.webmanifest` with:

```json
{
  "name": "FretFlow",
  "short_name": "FretFlow",
  "description": "Interactive guitar fretboard for visualizing scales, chords, and fingering patterns",
  "id": "/fretboard-app/",
  "start_url": "/fretboard-app/",
  "scope": "/fretboard-app/",
  "display": "standalone",
  "background_color": "#121212",
  "theme_color": "#863bff",
  "icons": [
    {
      "src": "favicon-32x32.png",
      "sizes": "32x32",
      "type": "image/png"
    },
    {
      "src": "apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png"
    },
    {
      "src": "favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

Note: Proper 192×192 and 512×512 icons are needed for full Lighthouse PWA compliance but are not blocking — the SVG icon with `"sizes": "any"` covers most browsers. Create proper raster icons as a follow-up.

- [ ] **Step 4: Add 404.html copy to build script**

In `package.json`, modify the `build` script:

```json
"build": "tsc -b && vite build && cp dist/index.html dist/404.html"
```

- [ ] **Step 5: Run build to verify SW generation**

Run: `pnpm run build`
Expected: Build succeeds. `dist/` should now contain `sw.js` (or similar service worker file) and `dist/404.html`.

Verify: `ls dist/sw.js dist/404.html`

- [ ] **Step 6: Run full test suite**

Run: `pnpm run test`
Expected: All tests PASS. (The PWA plugin should not affect unit tests.)

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts public/site.webmanifest package.json pnpm-lock.yaml
git commit -m "feat(pwa): add vite-plugin-pwa with offline caching and service worker"
```

---

### Task 11: PWA — Install Banner

**Files:**
- Create: `src/hooks/usePWAInstall.ts`
- Create: `src/hooks/usePWAInstall.test.ts`
- Create: `src/components/InstallBanner/InstallBanner.tsx`
- Create: `src/components/InstallBanner/InstallBanner.module.css`
- Create: `src/components/InstallBanner/InstallBanner.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write usePWAInstall hook tests**

```ts
// src/hooks/usePWAInstall.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePWAInstall } from "./usePWAInstall";

describe("usePWAInstall", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: not installed (standalone = false)
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  it("canInstall is false initially", () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.canInstall).toBe(false);
  });

  it("canInstall becomes true after beforeinstallprompt fires", () => {
    const { result } = renderHook(() => usePWAInstall());
    act(() => {
      window.dispatchEvent(new Event("beforeinstallprompt"));
    });
    expect(result.current.canInstall).toBe(true);
  });

  it("canInstall stays false if previously dismissed", () => {
    localStorage.setItem("fretflow:installDismissed", "true");
    const { result } = renderHook(() => usePWAInstall());
    act(() => {
      window.dispatchEvent(new Event("beforeinstallprompt"));
    });
    expect(result.current.canInstall).toBe(false);
  });

  it("dismiss sets localStorage flag and canInstall to false", () => {
    const { result } = renderHook(() => usePWAInstall());
    act(() => {
      window.dispatchEvent(new Event("beforeinstallprompt"));
    });
    expect(result.current.canInstall).toBe(true);
    act(() => { result.current.dismiss(); });
    expect(result.current.canInstall).toBe(false);
    expect(localStorage.getItem("fretflow:installDismissed")).toBe("true");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/hooks/usePWAInstall.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement usePWAInstall**

```ts
// src/hooks/usePWAInstall.ts
import { useState, useEffect, useCallback, useRef } from "react";

const DISMISSED_KEY = "fretflow:installDismissed";
const VISIT_COUNT_KEY = "fretflow:visitCount";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Track visits
    const count = Number(localStorage.getItem(VISIT_COUNT_KEY) || "0") + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(count));

    const isDismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches;
    const isFirstVisit = count < 2;

    if (isDismissed || isInstalled || isFirstVisit) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }

    function handleAppInstalled() {
      setCanInstall(false);
      deferredPromptRef.current = null;
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
    deferredPromptRef.current = null;
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setCanInstall(false);
    deferredPromptRef.current = null;
  }, []);

  return { canInstall, install, dismiss };
}
```

- [ ] **Step 4: Run hook tests**

Run: `pnpm vitest run src/hooks/usePWAInstall.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Write InstallBanner tests**

```tsx
// src/components/InstallBanner/InstallBanner.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallBanner } from "./InstallBanner";

describe("InstallBanner", () => {
  it("renders when canInstall is true", () => {
    render(<InstallBanner canInstall={true} onInstall={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/install fretflow/i)).toBeInTheDocument();
  });

  it("renders nothing when canInstall is false", () => {
    const { container } = render(<InstallBanner canInstall={false} onInstall={vi.fn()} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onInstall when install button clicked", async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    render(<InstallBanner canInstall={true} onInstall={onInstall} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /install/i }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when dismiss button clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<InstallBanner canInstall={true} onInstall={vi.fn()} onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Implement InstallBanner**

```tsx
// src/components/InstallBanner/InstallBanner.tsx
import { Download, X } from "lucide-react";
import styles from "./InstallBanner.module.css";

interface InstallBannerProps {
  canInstall: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ canInstall, onInstall, onDismiss }: InstallBannerProps) {
  if (!canInstall) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles["banner-text"]}>
        Install FretFlow for offline practice
      </span>
      <button
        type="button"
        onClick={onInstall}
        className={styles["banner-install"]}
        aria-label="Install FretFlow"
      >
        <Download size={14} />
        <span>Install</span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className={styles["banner-dismiss"]}
        aria-label="Dismiss install prompt"
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

```css
/* src/components/InstallBanner/InstallBanner.module.css */
.banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm, 0.5rem);
  padding: var(--space-xs, 0.25rem) var(--space-md, 1rem);
  background: var(--color-accent-subtle, rgba(134, 59, 255, 0.15));
  color: var(--color-text-primary, #fff);
  font-size: var(--font-size-xs, 0.75rem);
  text-align: center;
  width: 100%;
}

.banner-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-install {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-accent, #863bff);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm, 4px);
  padding: 2px 8px;
  font-size: var(--font-size-xs, 0.75rem);
  cursor: pointer;
  white-space: nowrap;
}

.banner-install:hover {
  opacity: 0.9;
}

.banner-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm, 4px);
  flex-shrink: 0;
}

.banner-dismiss:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 7: Run all banner tests**

Run: `pnpm vitest run src/hooks/usePWAInstall.test.ts src/components/InstallBanner/InstallBanner.test.tsx`
Expected: All tests PASS.

- [ ] **Step 8: Wire InstallBanner into App.tsx**

In `src/App.tsx`, import and use:

```ts
import { usePWAInstall } from "./hooks/usePWAInstall";
import { InstallBanner } from "./components/InstallBanner/InstallBanner";
```

Inside the App component:

```ts
const { canInstall, install, dismiss } = usePWAInstall();
```

Render `<InstallBanner canInstall={canInstall} onInstall={install} onDismiss={dismiss} />` at the top of the layout, alongside or below `<SharedLinkBanner />`.

- [ ] **Step 9: Run lint, test, build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/usePWAInstall.ts src/hooks/usePWAInstall.test.ts src/components/InstallBanner/ src/App.tsx
git commit -m "feat(pwa): add install banner with beforeinstallprompt capture"
```

---

### Task 12: Final Integration — Lint, Test, Build, Manual Verification

**Files:**
- No new files. Verify everything works together.

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`
Expected: No errors.

- [ ] **Step 2: Run full test suite**

Run: `pnpm run test`
Expected: All tests PASS.

- [ ] **Step 3: Run build**

Run: `pnpm run build`
Expected: Build succeeds. Verify `dist/sw.js` and `dist/404.html` exist.

- [ ] **Step 4: Preview locally and smoke test**

Run: `pnpm run preview`

Verify:
1. App loads at `http://localhost:4173/fretboard-app/`
2. Share button visible in header
3. Click share button → clipboard contains a URL with `?s=` param
4. Navigate to the copied URL → shared state loads, banner appears
5. Dismiss banner → state reverts to defaults
6. Service worker registered (check DevTools → Application → Service Workers)
7. Go offline (DevTools → Network → Offline) → app still loads from cache

- [ ] **Step 5: Commit any final adjustments**

If any fixes were needed during smoke testing, commit them individually with descriptive messages.
