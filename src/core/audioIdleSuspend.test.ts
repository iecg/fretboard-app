import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerAudioContext,
  unregisterAudioContext,
  holdAudioActive,
  releaseAudioActive,
  markAudioActivity,
  isContextSuspended,
  _resetAudioIdleSuspendForTests,
} from "./audioIdleSuspend";

function makeMockContext(state = "running"): AudioContext {
  return {
    state,
    suspend: vi.fn().mockResolvedValue(undefined),
  } as unknown as AudioContext;
}

const IDLE_MS = 30_000;

describe("audioIdleSuspend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetAudioIdleSuspendForTests();
  });

  afterEach(() => {
    _resetAudioIdleSuspendForTests();
    vi.useRealTimers();
  });

  it("suspends a registered context after 30s of inactivity", () => {
    const ctx = makeMockContext();
    registerAudioContext(ctx);
    markAudioActivity();

    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(ctx.suspend).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(ctx.suspend).toHaveBeenCalledOnce();
  });

  it("resets the timer on each markAudioActivity call", () => {
    const ctx = makeMockContext();
    registerAudioContext(ctx);
    markAudioActivity();

    vi.advanceTimersByTime(20_000);
    markAudioActivity();

    vi.advanceTimersByTime(20_000);
    expect(ctx.suspend).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(ctx.suspend).toHaveBeenCalledOnce();
  });

  it("does not suspend while held active", () => {
    const ctx = makeMockContext();
    registerAudioContext(ctx);
    holdAudioActive();
    markAudioActivity();

    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(ctx.suspend).not.toHaveBeenCalled();
  });

  it("starts idle timer when released", () => {
    const ctx = makeMockContext();
    registerAudioContext(ctx);
    holdAudioActive();

    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(ctx.suspend).not.toHaveBeenCalled();

    releaseAudioActive();
    vi.advanceTimersByTime(IDLE_MS);
    expect(ctx.suspend).toHaveBeenCalledOnce();
  });

  it("skips contexts that are already suspended", () => {
    const ctx = makeMockContext("suspended");
    registerAudioContext(ctx);
    markAudioActivity();

    vi.advanceTimersByTime(IDLE_MS);
    expect(ctx.suspend).not.toHaveBeenCalled();
  });

  it("suspends multiple registered contexts", () => {
    const ctx1 = makeMockContext();
    const ctx2 = makeMockContext();
    registerAudioContext(ctx1);
    registerAudioContext(ctx2);
    markAudioActivity();

    vi.advanceTimersByTime(IDLE_MS);
    expect(ctx1.suspend).toHaveBeenCalledOnce();
    expect(ctx2.suspend).toHaveBeenCalledOnce();
  });

  it("does not suspend unregistered contexts", () => {
    const ctx = makeMockContext();
    registerAudioContext(ctx);
    unregisterAudioContext(ctx);
    markAudioActivity();

    vi.advanceTimersByTime(IDLE_MS);
    expect(ctx.suspend).not.toHaveBeenCalled();
  });

  describe("isContextSuspended", () => {
    it("scopes to a role — ignores a suspended context of another role", () => {
      const progression = makeMockContext("running");
      const guitar = makeMockContext("suspended");
      registerAudioContext(progression, "progression");
      registerAudioContext(guitar, "guitar");

      // An idle guitar context must not make the progression check report suspended.
      expect(isContextSuspended("progression")).toBe(false);
      expect(isContextSuspended("guitar")).toBe(true);
    });

    it("reports the progression context's own suspended state", () => {
      const progression = makeMockContext("suspended");
      registerAudioContext(progression, "progression");
      expect(isContextSuspended("progression")).toBe(true);
    });

    it("with no role, checks every registered context", () => {
      const a = makeMockContext("running");
      const b = makeMockContext("suspended");
      registerAudioContext(a, "progression");
      registerAudioContext(b, "guitar");
      expect(isContextSuspended()).toBe(true);
    });

    it("upgrades a guitar context to progression when re-registered", () => {
      const ctx = makeMockContext("suspended");
      registerAudioContext(ctx, "guitar");
      expect(isContextSuspended("progression")).toBe(false);
      registerAudioContext(ctx, "progression");
      expect(isContextSuspended("progression")).toBe(true);
    });


  });
});
