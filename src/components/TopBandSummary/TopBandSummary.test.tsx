import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { TopBandSummary } from "./TopBandSummary";
import { chordTypeAtom } from "../../store/atoms";

// Spy on MotionConfig so we can assert it is NOT called during TopBandSummary rendering.
// The component previously wrapped its output in a local <MotionConfig reducedMotion="user">;
// Task 3 removed that wrapper in favour of the app-level AppMotionConfig.
const { MotionConfigSpy } = vi.hoisted(() => ({
  MotionConfigSpy: vi.fn((props: { children?: unknown; [k: string]: unknown }) => props.children),
}));

vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIMATION_PROPS = new Set([
    "initial", "animate", "exit", "transition", "variants",
    "whileHover", "whileTap", "whileFocus", "whileDrag", "whileInView",
    "layoutId", "layout", "onAnimationStart", "onAnimationComplete", "onUpdate",
  ]);
  const makeEl = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      const { children, ...rest } = props;
      const filtered: Record<string, unknown> = {};
      Object.entries(rest).forEach(([k, v]) => {
        if (!ANIMATION_PROPS.has(k)) filtered[k] = v;
      });
      return React.createElement(tag, { ...filtered, ref }, children as React.ReactNode);
    });
  const cache = new Map<string, unknown>();
  const motionProxy = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (!cache.has(prop)) cache.set(prop, makeEl(prop));
      return cache.get(prop);
    },
  });
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    MotionConfig: MotionConfigSpy,
    useReducedMotion: vi.fn().mockReturnValue(null),
  };
});


describe("TopBandSummary content", () => {
  it("renders the scale degree summary band", () => {
    const { getByTestId } = renderWithAtoms(<TopBandSummary />);
    expect(getByTestId("top-band-summary")).toBeTruthy();
  });

  it("shows the chord practice bar when chord practice is active", () => {
    // Setting chordTypeAtom makes showChordPracticeBarAtom resolve true.
    const { queryByTestId } = renderWithAtoms(<TopBandSummary />, [
      [chordTypeAtom, "Major Triad"],
    ]);
    expect(queryByTestId("chord-practice-bar")).toBeTruthy();
  });

  it("never renders a progression-status block", () => {
    const { queryByTestId } = renderWithAtoms(<TopBandSummary />, [
      [chordTypeAtom, "Major Triad"],
    ]);
    expect(queryByTestId("progression-status")).toBeNull();
  });
});

describe("TopBandSummary motion wiring", () => {
  beforeEach(() => {
    MotionConfigSpy.mockClear();
  });

  it("does not own a local MotionConfig wrapper", () => {
    renderWithAtoms(<TopBandSummary />, []);
    // MotionConfig was removed from TopBandSummary in favour of the app-level
    // AppMotionConfig wrapper; verify it is never instantiated here.
    expect(MotionConfigSpy).not.toHaveBeenCalled();
  });
});
