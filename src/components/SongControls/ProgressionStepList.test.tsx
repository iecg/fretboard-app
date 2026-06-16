import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "../../test-utils/a11y";
import { ProgressionStepList } from "./ProgressionStepList";
import { singleMoveDiff } from "./progressionStepListUtils";
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
    render(<ProgressionStepList steps={steps} activeIndex={0} onSelect={() => {}} onReorder={vi.fn()} label="Chords" caption="Steps" />);
    const rows = screen.getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(/Chord 1, i, A minor, 1 bar/);
    expect(rows[1]).toHaveAccessibleName(/Chord 2, v, E minor, 2 bars/);
  });

  it("marks the active row with aria-current", () => {
    render(<ProgressionStepList steps={steps} activeIndex={1} onSelect={() => {}} onReorder={vi.fn()} label="Chords" caption="Steps" />);
    const rows = screen.getAllByRole("button");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[0]).not.toHaveAttribute("aria-current");
  });

  it("calls onSelect with the row index on click", () => {
    const onSelect = vi.fn();
    render(<ProgressionStepList steps={steps} activeIndex={0} onSelect={onSelect} onReorder={vi.fn()} label="Chords" caption="Steps" />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("renders the caption and optional meta summary", () => {
    render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={() => {}}
        onReorder={vi.fn()}
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
      <ProgressionStepList steps={steps} activeIndex={0} onSelect={() => {}} onReorder={vi.fn()} label="Chords" caption="Steps" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("selects on row-button click without triggering a reorder", () => {
    const onSelect = vi.fn();
    const onReorder = vi.fn();
    render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={onSelect}
        onReorder={onReorder}
        label="Chords"
        caption="Steps"
      />,
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("renders one button per row (handles are aria-hidden) with no a11y violation", async () => {
    const { container } = render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        label="Chords"
        caption="Steps"
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(steps.length);
    // Drag-enabled rows carry a grip-handle icon, nested inside the row button.
    expect(container.querySelectorAll("button svg")).toHaveLength(steps.length);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("clicking the drag handle inside the row does not select the step", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={onSelect}
        onReorder={vi.fn()}
        label="Chords"
        caption="Steps"
      />,
    );
    const handle = container.querySelector("button svg")!.parentElement!;
    fireEvent.click(handle);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders a plain selectable list with no drag handles when enableDrag is false", async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ProgressionStepList
        steps={steps}
        activeIndex={0}
        onSelect={onSelect}
        onReorder={vi.fn()}
        enableDrag={false}
        label="Chords"
        caption="Steps"
      />,
    );
    // Still one selectable button per row, but no grip-handle icons.
    expect(screen.getAllByRole("button")).toHaveLength(steps.length);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("singleMoveDiff", () => {
  it("detects a single move", () => {
    expect(singleMoveDiff(["a", "b", "c"], ["b", "a", "c"])).toEqual({ from: 0, to: 1 });
    expect(singleMoveDiff(["a", "b", "c"], ["b", "c", "a"])).toEqual({ from: 0, to: 2 });
    expect(singleMoveDiff(["a", "b", "c"], ["c", "a", "b"])).toEqual({ from: 2, to: 0 });
    expect(singleMoveDiff(["a", "b", "c"], ["a", "c", "b"])).toEqual({ from: 1, to: 2 });
  });

  it("returns null for an unchanged or mismatched order", () => {
    expect(singleMoveDiff(["a", "b", "c"], ["a", "b", "c"])).toBeNull();
    expect(singleMoveDiff(["a", "b"], ["a", "b", "c"])).toBeNull();
  });

  it("returns null for a multi-element permutation that is not a single move", () => {
    // Middle-section reversal: endpoints match a candidate move, but replaying
    // it would not reproduce `next`, so it must be rejected.
    expect(singleMoveDiff(["a", "b", "c", "d", "e"], ["a", "d", "c", "b", "e"])).toBeNull();
  });
});
