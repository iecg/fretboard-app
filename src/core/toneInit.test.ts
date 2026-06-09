import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no real AudioContext, so stub Tone's start/getContext surface
// and assert the gating behavior of ensureToneStarted. Use vi.hoisted so
// the mock state survives vi.mock's hoisting to the top of the module.
const mocks = vi.hoisted(() => {
  const state = { contextState: "suspended" as "suspended" | "running" };
  const startMock = vi.fn(async () => {
    state.contextState = "running";
  });
  return { state, startMock };
});

vi.mock("tone", () => ({
  start: mocks.startMock,
  getContext: () => ({
    get state() {
      return mocks.state.contextState;
    },
  }),
}));

import * as Tone from "tone";
import { __resetToneStartedForTests, ensureToneStarted } from "./toneInit";

describe("ensureToneStarted", () => {
  beforeEach(() => {
    mocks.startMock.mockClear();
    mocks.state.contextState = "suspended";
    __resetToneStartedForTests();
  });

  it("resolves and transitions the context to running on first call", async () => {
    await ensureToneStarted();
    expect(mocks.startMock).toHaveBeenCalledTimes(1);
    expect(Tone.getContext().state).toBe("running");
  });

  it("only invokes Tone.start() once across multiple sequential calls", async () => {
    await ensureToneStarted();
    await ensureToneStarted();
    await ensureToneStarted();
    expect(mocks.startMock).toHaveBeenCalledTimes(1);
  });

  it("re-invokes Tone.start() when the context has been re-suspended after initial start (Safari idle)", async () => {
    await ensureToneStarted();
    expect(mocks.startMock).toHaveBeenCalledTimes(1);

    // Simulate Safari re-suspending the context after extended idle.
    mocks.state.contextState = "suspended";

    await ensureToneStarted();
    expect(mocks.startMock).toHaveBeenCalledTimes(2);
    expect(Tone.getContext().state).toBe("running");
  });

  it("does not re-invoke Tone.start() once initialization has settled", async () => {
    await Promise.all([ensureToneStarted(), ensureToneStarted()]);
    // Concurrent callers may both miss the gate on their first turn, so
    // we only assert the post-condition: subsequent calls are no-ops.
    const callsAfterRace = mocks.startMock.mock.calls.length;
    await ensureToneStarted();
    expect(mocks.startMock).toHaveBeenCalledTimes(callsAfterRace);
  });
});
