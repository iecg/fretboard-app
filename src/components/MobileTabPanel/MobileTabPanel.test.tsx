// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ANIMATION_DURATION_XFADE, ANIMATION_EASE } from "@fretflow/core";
import { screen } from "@testing-library/react";
import { MobileTabPanel } from "../MobileTabPanel/MobileTabPanel";

// Capture the transition prop from every motion.div render before it is stripped,
// so tests can assert the progression tab uses shared constants (not magic numbers).
const { capturedTransitions } = vi.hoisted(() => ({
  capturedTransitions: [] as Array<Record<string, unknown>>,
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

  // motion.div captures transition before stripping it from the forwarded props.
  const makeDivWithCapture = () =>
    React.forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => {
      const { children, transition, ...rest } = props;
      if (transition && typeof transition === "object") {
        capturedTransitions.push(transition as Record<string, unknown>);
      }
      const filtered: Record<string, unknown> = {};
      Object.entries(rest).forEach(([k, v]) => {
        if (!ANIMATION_PROPS.has(k)) filtered[k] = v;
      });
      return React.createElement("div", { ...filtered, ref }, children as React.ReactNode);
    });

  const cache = new Map<string, unknown>([["div", makeDivWithCapture()]]);
  const motionProxy = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (!cache.has(prop)) cache.set(prop, makeEl(prop));
      return cache.get(prop);
    },
  });
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
    MotionConfig: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
    useReducedMotion: vi.fn().mockReturnValue(null),
  };
});

import {
  mobileTabAtom,
  rootNoteAtom,
  scaleNameAtom,
  chordTypeAtom,
  chordRootAtom,
} from "../../store/atoms";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";

/** Minimal valid seeds to prevent rendering errors in inlined child components. */
const BASE_SEEDS = [
  [rootNoteAtom, "C"],
  [scaleNameAtom, "Major"],
  [chordTypeAtom, null],
  [chordRootAtom, "C"],
] as const;

describe("MobileTabPanel/MobileTabPanel", () => {
  it("renders the tab content container", () => {
    renderWithAtoms(<MobileTabPanel />, [...BASE_SEEDS]);
    expect(screen.getByTestId("mobile-tab-content")).toBeInTheDocument();
  });

  it("shows scales tab content when mobileTab atom is 'scales'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "scales"],
    ]);
    // Card renders the section heading
    expect(screen.getByRole("heading", { level: 2, name: /^Scales$/i })).toBeInTheDocument();
    // ScaleSelector renders a Root note grid and Scale Family browser
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Scale Family" })).toBeInTheDocument();
  });

  it("shows chords tab content when mobileTab atom is 'chords'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "chords"],
    ]);
    // Card renders the section heading
    expect(screen.getByRole("heading", { level: 2, name: /^Chords$/i })).toBeInTheDocument();
    // ChordOverlayControls renders Chord Mode section
    expect(screen.getByText("Chord Mode")).toBeInTheDocument();
  });

  it("shows cof tab content when mobileTab atom is 'cof'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "cof"],
    ]);
    expect(screen.getByRole("heading", { level: 2, name: /^Key$/i })).toBeInTheDocument();
  });

  it("renders CircleOfFifths SVG directly when on cof tab", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "cof"],
    ]);
    expect(screen.getByTestId("circle-of-fifths-svg")).toBeInTheDocument();
    expect(screen.getByTestId("circle-of-fifths")).toBeInTheDocument();
  });

  it("shows view tab content when mobileTab atom is 'view'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "view"],
    ]);
    // Card renders the section heading
    expect(screen.getByRole("heading", { level: 2, name: /View/i })).toBeInTheDocument();
    // FingeringPatternControls renders a Fingering Pattern section
    expect(screen.getByText("Fingering Pattern")).toBeInTheDocument();
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
  });

  it("shows progression tab content when mobileTab atom is 'progression'", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "progression"],
    ]);

    expect(screen.getByRole("heading", { level: 2, name: /^Progression$/i })).toBeInTheDocument();
    expect(screen.getByText("Progression Mode")).toBeInTheDocument();
  });

  it("does not show scales content when on view tab", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "view"],
    ]);
    expect(screen.queryByText("Scale Family")).not.toBeInTheDocument();
  });

  it.each([
    ["scales"],
    ["chords"],
    ["progression"],
    ["cof"],
    ["view"],
  ] as const)(
    "has no accessibility violations on %s tab",
    async (tab) => {
      const { container } = renderWithAtoms(<MobileTabPanel />, [
        ...BASE_SEEDS,
        [mobileTabAtom, tab],
      ]);
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});

describe("MobileTabPanel/MobileTabPanel progression-tab motion wiring", () => {
  beforeEach(() => {
    capturedTransitions.length = 0;
  });

  it("progression tab motion.div transition uses shared animation constants", () => {
    renderWithAtoms(<MobileTabPanel />, [
      ...BASE_SEEDS,
      [mobileTabAtom, "progression"],
    ]);

    // Only the progression tab sets `ease` on its transition; other tabs omit it.
    const progressionTransition = capturedTransitions.find(
      (t) => Object.prototype.hasOwnProperty.call(t, "ease"),
    );
    expect(progressionTransition).toBeDefined();
    expect(progressionTransition).toMatchObject({
      duration: ANIMATION_DURATION_XFADE,
      ease: ANIMATION_EASE,
    });
  });
});
