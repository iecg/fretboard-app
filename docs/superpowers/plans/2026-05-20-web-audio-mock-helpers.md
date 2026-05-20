# Web Audio Mock Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated Web Audio test mocks from five test files into a shared `src/test-utils/mockWebAudio.ts` module, removing ~120–150 LOC of duplication.

**Architecture:** Single helper module exporting `createMockGain`, `createMockOsc`, `createMockFilter`, `createMockBufferSource`, `createMockBuffer`, and `buildMockCtx`. Helpers return `vi.fn()`-instrumented stand-ins for the matching `AudioNode` subclasses. Each consumer test file deletes its local copies and imports from the shared module.

**Tech Stack:** Vitest, TypeScript, Web Audio API types.

---

## File Structure

- Create: `src/test-utils/mockWebAudio.ts` — shared mock helpers
- Create: `src/test-utils/mockWebAudio.test.ts` — unit tests for the helpers (TDD)
- Modify: `src/core/audio.test.ts` — replace local helpers with imports
- Modify: `src/progressions/audio/scheduler.test.ts` — replace local helpers
- Modify: `src/progressions/audio/instruments/organVoice.test.ts` — replace local helpers
- Modify: `src/progressions/audio/instruments/pianoVoice.test.ts` — replace local helpers
- Modify: `src/progressions/audio/instruments/strumVoice.test.ts` — replace local helpers

The richest local definition is in `src/progressions/audio/scheduler.test.ts` (lines 9–107). It is the source of truth for the shared module because it covers every helper used elsewhere (gain, osc, filter, buffer source, buffer, context).

---

### Task 1: Create shared mock module with `createMockGain`

**Files:**
- Create: `src/test-utils/mockWebAudio.ts`
- Test: `src/test-utils/mockWebAudio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/test-utils/mockWebAudio.test.ts
import { describe, it, expect, vi } from "vitest";
import { createMockGain } from "./mockWebAudio";

describe("createMockGain", () => {
  it("returns a GainNode-shaped object with instrumented methods", () => {
    const gain = createMockGain();
    expect(gain.gain.value).toBe(1);
    expect(typeof gain.gain.setValueAtTime).toBe("function");
    expect(typeof gain.connect).toBe("function");
    expect(typeof gain.disconnect).toBe("function");
    expect(vi.isMockFunction(gain.gain.setValueAtTime)).toBe(true);
  });

  it("supports chained connect calls", () => {
    const a = createMockGain();
    const b = createMockGain();
    expect(a.connect(b)).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: FAIL with "Cannot find module './mockWebAudio'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/test-utils/mockWebAudio.ts
import { vi } from "vitest";

export interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

function makeParam(initial = 0): MockAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

export interface MockGainNode {
  gain: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

export function createMockGain(): MockGainNode {
  const node: MockGainNode = {
    gain: makeParam(1),
    connect: vi.fn((target: unknown) => target),
    disconnect: vi.fn(),
  };
  return node;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/test-utils/mockWebAudio.ts src/test-utils/mockWebAudio.test.ts
git commit -m "test: add shared createMockGain helper"
```

---

### Task 2: Add `createMockOsc`

**Files:**
- Modify: `src/test-utils/mockWebAudio.ts`
- Modify: `src/test-utils/mockWebAudio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// Append to src/test-utils/mockWebAudio.test.ts
import { createMockOsc } from "./mockWebAudio";

describe("createMockOsc", () => {
  it("returns an OscillatorNode-shaped object", () => {
    const osc = createMockOsc();
    expect(osc.frequency.value).toBe(440);
    expect(osc.detune.value).toBe(0);
    expect(typeof osc.start).toBe("function");
    expect(typeof osc.stop).toBe("function");
    expect(typeof osc.setPeriodicWave).toBe("function");
    expect(osc.type).toBe("sine");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: FAIL with "createMockOsc is not exported"

- [ ] **Step 3: Implement**

Append to `src/test-utils/mockWebAudio.ts`:

```ts
export type OscillatorType = "sine" | "square" | "sawtooth" | "triangle" | "custom";

export interface MockOscillatorNode {
  type: OscillatorType;
  frequency: MockAudioParam;
  detune: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setPeriodicWave: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

export function createMockOsc(): MockOscillatorNode {
  return {
    type: "sine",
    frequency: makeParam(440),
    detune: makeParam(0),
    connect: vi.fn((target: unknown) => target),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    setPeriodicWave: vi.fn(),
    onended: null,
  };
}
```

- [ ] **Step 4: Run test**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/test-utils/mockWebAudio.ts src/test-utils/mockWebAudio.test.ts
git commit -m "test: add shared createMockOsc helper"
```

---

### Task 3: Add `createMockFilter`, `createMockBufferSource`, `createMockBuffer`

**Files:**
- Modify: `src/test-utils/mockWebAudio.ts`
- Modify: `src/test-utils/mockWebAudio.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// Append to mockWebAudio.test.ts
import {
  createMockFilter,
  createMockBufferSource,
  createMockBuffer,
} from "./mockWebAudio";

describe("createMockFilter", () => {
  it("returns a BiquadFilterNode-shaped object", () => {
    const f = createMockFilter();
    expect(f.type).toBe("lowpass");
    expect(f.frequency.value).toBe(350);
    expect(f.Q.value).toBe(1);
    expect(typeof f.connect).toBe("function");
  });
});

describe("createMockBufferSource", () => {
  it("returns an AudioBufferSourceNode-shaped object", () => {
    const s = createMockBufferSource();
    expect(s.buffer).toBeNull();
    expect(typeof s.start).toBe("function");
    expect(typeof s.stop).toBe("function");
  });
});

describe("createMockBuffer", () => {
  it("returns an AudioBuffer-shaped object with sane defaults", () => {
    const b = createMockBuffer({ length: 4, sampleRate: 44100, numberOfChannels: 1 });
    expect(b.length).toBe(4);
    expect(b.sampleRate).toBe(44100);
    expect(b.numberOfChannels).toBe(1);
    expect(b.getChannelData(0)).toBeInstanceOf(Float32Array);
    expect(b.getChannelData(0).length).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: FAIL — helpers not exported

- [ ] **Step 3: Implement**

Append to `src/test-utils/mockWebAudio.ts`:

```ts
export type BiquadFilterType = "lowpass" | "highpass" | "bandpass" | "lowshelf" | "highshelf" | "peaking" | "notch" | "allpass";

export interface MockBiquadFilterNode {
  type: BiquadFilterType;
  frequency: MockAudioParam;
  Q: MockAudioParam;
  gain: MockAudioParam;
  detune: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

export function createMockFilter(): MockBiquadFilterNode {
  return {
    type: "lowpass",
    frequency: makeParam(350),
    Q: makeParam(1),
    gain: makeParam(0),
    detune: makeParam(0),
    connect: vi.fn((t: unknown) => t),
    disconnect: vi.fn(),
  };
}

export interface MockAudioBuffer {
  length: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  getChannelData: (i: number) => Float32Array;
}

export function createMockBuffer(opts: {
  length: number;
  sampleRate: number;
  numberOfChannels?: number;
}): MockAudioBuffer {
  const channels = opts.numberOfChannels ?? 1;
  const data = Array.from({ length: channels }, () => new Float32Array(opts.length));
  return {
    length: opts.length,
    duration: opts.length / opts.sampleRate,
    sampleRate: opts.sampleRate,
    numberOfChannels: channels,
    getChannelData: (i: number) => data[i],
  };
}

export interface MockBufferSourceNode {
  buffer: MockAudioBuffer | null;
  playbackRate: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

export function createMockBufferSource(): MockBufferSourceNode {
  return {
    buffer: null,
    playbackRate: makeParam(1),
    connect: vi.fn((t: unknown) => t),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
}
```

- [ ] **Step 4: Run test**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/test-utils/mockWebAudio.ts src/test-utils/mockWebAudio.test.ts
git commit -m "test: add filter/buffer/source mock helpers"
```

---

### Task 4: Add `buildMockCtx`

**Files:**
- Modify: `src/test-utils/mockWebAudio.ts`
- Modify: `src/test-utils/mockWebAudio.test.ts`

This factory must mirror the shape used by `scheduler.test.ts:79–107`: a `currentTime`, `destination`, and `createGain/createOscillator/createBiquadFilter/createBufferSource/createBuffer/createPeriodicWave` factory methods. It also records the children it produced so tests can assert on them.

- [ ] **Step 1: Write the failing test**

```ts
// Append to mockWebAudio.test.ts
import { buildMockCtx } from "./mockWebAudio";

describe("buildMockCtx", () => {
  it("exposes the standard AudioContext factory methods", () => {
    const ctx = buildMockCtx();
    expect(ctx.currentTime).toBe(0);
    expect(ctx.destination).toBeDefined();
    expect(typeof ctx.createGain).toBe("function");
    expect(typeof ctx.createOscillator).toBe("function");
    expect(typeof ctx.createBiquadFilter).toBe("function");
    expect(typeof ctx.createBufferSource).toBe("function");
    expect(typeof ctx.createBuffer).toBe("function");
    expect(typeof ctx.createPeriodicWave).toBe("function");
  });

  it("records nodes it created", () => {
    const ctx = buildMockCtx();
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    expect(ctx.created.gains).toContain(g);
    expect(ctx.created.oscillators).toContain(o);
  });

  it("allows currentTime override", () => {
    const ctx = buildMockCtx({ currentTime: 1.5 });
    expect(ctx.currentTime).toBe(1.5);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: FAIL — buildMockCtx missing

- [ ] **Step 3: Implement**

Append to `src/test-utils/mockWebAudio.ts`:

```ts
export interface MockAudioContext {
  currentTime: number;
  destination: MockGainNode;
  createGain: () => MockGainNode;
  createOscillator: () => MockOscillatorNode;
  createBiquadFilter: () => MockBiquadFilterNode;
  createBufferSource: () => MockBufferSourceNode;
  createBuffer: (channels: number, length: number, sampleRate: number) => MockAudioBuffer;
  createPeriodicWave: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  suspend: ReturnType<typeof vi.fn>;
  state: "running" | "suspended" | "closed";
  created: {
    gains: MockGainNode[];
    oscillators: MockOscillatorNode[];
    filters: MockBiquadFilterNode[];
    bufferSources: MockBufferSourceNode[];
    buffers: MockAudioBuffer[];
  };
}

export function buildMockCtx(opts: { currentTime?: number } = {}): MockAudioContext {
  const created: MockAudioContext["created"] = {
    gains: [],
    oscillators: [],
    filters: [],
    bufferSources: [],
    buffers: [],
  };
  const destination = createMockGain();
  return {
    currentTime: opts.currentTime ?? 0,
    destination,
    state: "running",
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    createPeriodicWave: vi.fn(),
    createGain: () => {
      const g = createMockGain();
      created.gains.push(g);
      return g;
    },
    createOscillator: () => {
      const o = createMockOsc();
      created.oscillators.push(o);
      return o;
    },
    createBiquadFilter: () => {
      const f = createMockFilter();
      created.filters.push(f);
      return f;
    },
    createBufferSource: () => {
      const s = createMockBufferSource();
      created.bufferSources.push(s);
      return s;
    },
    createBuffer: (numberOfChannels: number, length: number, sampleRate: number) => {
      const b = createMockBuffer({ length, sampleRate, numberOfChannels });
      created.buffers.push(b);
      return b;
    },
    created,
  };
}
```

- [ ] **Step 4: Run test**

Run: `pnpm vitest run src/test-utils/mockWebAudio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/test-utils/mockWebAudio.ts src/test-utils/mockWebAudio.test.ts
git commit -m "test: add buildMockCtx factory"
```

---

### Task 5: Migrate `scheduler.test.ts` to shared helpers

**Files:**
- Modify: `src/progressions/audio/scheduler.test.ts`

- [ ] **Step 1: Read existing file**

Read `src/progressions/audio/scheduler.test.ts` lines 1–110 to understand current local helpers. Confirm they match shared shapes.

- [ ] **Step 2: Replace local helpers with imports**

At the top of the file, remove all local helpers (the duplicated `createMockGain`/`createMockFilter`/`createMockOsc`/`createMockBufferSource`/`createMockBuffer`/`buildMockCtx` blocks between lines ~9–107) and add:

```ts
import {
  createMockGain,
  createMockFilter,
  createMockOsc,
  createMockBufferSource,
  createMockBuffer,
  buildMockCtx,
} from "../../test-utils/mockWebAudio";
```

Leave any test-specific helpers (e.g. tracking arrays, scheduler-specific factories) untouched.

- [ ] **Step 3: Run scheduler tests**

Run: `pnpm vitest run src/progressions/audio/scheduler.test.ts`
Expected: PASS — all previously passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/progressions/audio/scheduler.test.ts
git commit -m "test(scheduler): use shared web-audio mocks"
```

---

### Task 6: Migrate `organVoice.test.ts`

**Files:**
- Modify: `src/progressions/audio/instruments/organVoice.test.ts`

- [ ] **Step 1: Remove local helpers**

Delete the local `createMockGain` (lines ~6–19), `createMockOsc` (~21–34), and `buildMockCtx` (~36–44) definitions. Add at the top:

```ts
import {
  createMockGain,
  createMockOsc,
  buildMockCtx,
} from "../../../test-utils/mockWebAudio";
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run src/progressions/audio/instruments/organVoice.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/progressions/audio/instruments/organVoice.test.ts
git commit -m "test(organVoice): use shared web-audio mocks"
```

---

### Task 7: Migrate `pianoVoice.test.ts`

**Files:**
- Modify: `src/progressions/audio/instruments/pianoVoice.test.ts`

- [ ] **Step 1: Remove local helpers**

Delete `createMockGain` (~6–19), `createMockOsc` (~21–34), `buildMockCtx` (~36–44). Add:

```ts
import {
  createMockGain,
  createMockOsc,
  buildMockCtx,
} from "../../../test-utils/mockWebAudio";
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run src/progressions/audio/instruments/pianoVoice.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/progressions/audio/instruments/pianoVoice.test.ts
git commit -m "test(pianoVoice): use shared web-audio mocks"
```

---

### Task 8: Migrate `strumVoice.test.ts`

**Files:**
- Modify: `src/progressions/audio/instruments/strumVoice.test.ts`

- [ ] **Step 1: Remove local helpers**

Delete `createMockGain` (~7–20), `createMockFilter` (~22–34), `createMockOsc` (~36–50), `buildMockCtx` (~52–67). Add:

```ts
import {
  createMockGain,
  createMockFilter,
  createMockOsc,
  buildMockCtx,
} from "../../../test-utils/mockWebAudio";
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run src/progressions/audio/instruments/strumVoice.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/progressions/audio/instruments/strumVoice.test.ts
git commit -m "test(strumVoice): use shared web-audio mocks"
```

---

### Task 9: Migrate `src/core/audio.test.ts` (signature reconciliation)

**Files:**
- Modify: `src/core/audio.test.ts`

This file uses different names (`createMockGainNode`, `mockAudioContext` as plain object). The shared helpers cover the same surface area — rename at call sites instead of preserving old names.

- [ ] **Step 1: Read the file**

Read `src/core/audio.test.ts` lines 1–80 to map every reference to `createMockGainNode`, `createMockOscillator`, `createMockFilter`, and `mockAudioContext`.

- [ ] **Step 2: Replace helpers and call sites**

Delete local mock definitions (~lines 6–52). Add:

```ts
import {
  createMockGain,
  createMockOsc,
  createMockFilter,
  buildMockCtx,
} from "../test-utils/mockWebAudio";
```

Then rename in the file body:
- `createMockGainNode` → `createMockGain`
- `createMockOscillator` → `createMockOsc`
- `mockAudioContext` → replace with `buildMockCtx()` at each use site (or hoist `const ctx = buildMockCtx()` near the start of the relevant `describe` block, mirroring the previous variable's scope).

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/core/audio.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/audio.test.ts
git commit -m "test(audio): use shared web-audio mocks"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run full lint + test + build**

Run:
```bash
pnpm run lint && pnpm run test && pnpm run build
```
Expected: all green.

- [ ] **Step 2: Confirm LOC delta**

Run: `git diff --stat main...HEAD -- src/`
Expected: net negative change of roughly 120–150 LOC across the five migrated test files, offset by the new ~200 LOC helper module + tests.

- [ ] **Step 3: Final commit (if anything was left)**

Only needed if step 1 surfaced stylelint/eslint fixes. Otherwise skip.
