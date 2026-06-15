// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "../../test-utils/a11y";
import { ProgressionStepList } from "./ProgressionStepList";
import { PROGRESSION_STEP_LIST_ID } from "./progressionFocusIds";
import type { ResolvedProgressionStep } from "../../progressions/progressionDomain";

function makeStep(
  partial: Partial<ResolvedProgressionStep> & { id: string },
): ResolvedProgressionStep {
  return {
    id: partial.id,
    degree: partial.degree ?? "I",
    duration: partial.duration ?? { value: 1, unit: "bar" },
    qualityOverride: null,
    manualRoot: null,
    index: partial.index ?? 0,
    root: partial.root ?? "C",
    quality: partial.quality ?? "M",
    diatonicQuality: "M",
    label: partial.degree ?? "I",
    resolvedChordLabel: partial.resolvedChordLabel ?? "C major",
    shortChordLabel: "C",
    unavailable: partial.unavailable ?? false,
    unavailableReason: null,
    qualityOverrideApplied: false,
    invalidQualityOverride: false,
  };
}

const steps: ResolvedProgressionStep[] = [
  makeStep({ id: "a", degree: "i", resolvedChordLabel: "A minor", duration: { value: 1, unit: "bar" } }),
  makeStep({ id: "b", degree: "v", resolvedChordLabel: "E minor", duration: { value: 2, unit: "bar" } }),
];

describe("ProgressionStepList", () => {
  it("renders one row per step with degree, name, and duration in the accessible name", () => {
    render(<ProgressionStepList steps={steps} activeIndex={0} onSelect={() => {}} label="Chords" caption="Steps" />);
    const rows = screen.getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(/Chord 1, i, A minor, 1 bar/);
    expect(rows[1]).toHaveAccessibleName(/Chord 2, v, E minor, 2 bars/);
  });

  it("marks the active row with aria-current", () => {
    render(<ProgressionStepList steps={steps} activeIndex={1} onSelect={() => {}} label="Chords" caption="Steps" />);
    const rows = screen.getAllByRole("button");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[0]).not.toHaveAttribute("aria-current");
  });

  it("calls onSelect with the row index on click", () => {
    const onSelect = vi.fn();
    render(<ProgressionStepList steps={steps} activeIndex={0} onSelect={onSelect} label="Chords" caption="Steps" />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("renders the caption and optional meta summary", () => {
    render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={() => {}}
        label="Chords"
        caption="Steps"
        meta="2 chords · 3 bars"
      />,
    );
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("2 chords · 3 bars")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ProgressionStepList steps={steps} activeIndex={0} onSelect={() => {}} label="Chords" caption="Steps" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ProgressionStepList focus target", () => {
  it("exposes a focusable scroll container with the shared id", () => {
    const { container } = render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={() => {}}
        label="Progression"
        caption="Steps"
      />,
    );

    const scroll = container.querySelector(`#${PROGRESSION_STEP_LIST_ID}`);
    expect(scroll).not.toBeNull();
    expect(scroll?.getAttribute("tabindex")).toBe("-1");
  });
});
