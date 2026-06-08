// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { activeProgressionStepIndexAtom, beatsPerBarAtom, fastDisplayedStepIndexPrimitiveAtom, progressionPlayingAtom, progressionStepsAtom, setProgressionActiveStepIndexAtom, setProgressionPlayingAtom } from "../../store/progressionAtoms";
import { ProgressionTrack } from "./ProgressionTrack";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
  { id: "three", degree: "vi", duration: { value: 2, unit: "bar" }, qualityOverride: null },
  { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

const beatDurationProgression = [
  { id: "beat-step", degree: "I", duration: { value: 2, unit: "beat" }, qualityOverride: null },
  { id: "bar-step", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

const twoBarLeadingProgression = [
  { id: "one", degree: "I", duration: { value: 2, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "three", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "four", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

const eightStepProgression = [
  { id: "s1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "s2", degree: "ii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "s3", degree: "iii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "s4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "s5", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "s6", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "s7", degree: "vii", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "s8", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
] as const;

describe("ProgressionTrack", () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias */
      value: function(keyframes: any[], options: any) {
        const el = this;
        let _currentTime = 0;
        let _playState = 'running';
        let _duration = options.duration;
        const startX = parseFloat(keyframes[0].transform.match(/translateX\((.+)px\)/)?.[1] || "0");
        const endX = parseFloat(keyframes[1].transform.match(/translateX\((.+)px\)/)?.[1] || "0");
        const anim = {
          get currentTime() { return _currentTime; },
          set currentTime(v) { 
            _currentTime = v; 
            const pct = _currentTime / _duration;
            el.style.transform = `translateX(${startX + (endX - startX) * pct}px)`;
          },
          get playState() { return _playState; },
          play() { _playState = 'running'; },
          pause() { _playState = 'paused'; },
          cancel() { _playState = 'idle'; },
          effect: {
            getTiming() { return { duration: _duration }; },
            updateTiming(timing: any) { _duration = timing.duration; }
          }
        };
        return anim;
      }
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias */
    });
  });

  it("renders the timeline group, ruler, and chord blocks", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    expect(screen.getByRole("group", { name: "Progression track" })).toBeTruthy();
    expect(container.querySelector("[aria-label='Progression timeline']")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 1, I, C major, 1 bar, active/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Step 3, vi, A minor, 2 bars/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play progression" })).toBeNull();
    expect(screen.queryByText("Position")).toBeNull();
  });

  it("renders the empty state overlay inside the track when empty", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, []],
      [beatsPerBarAtom, 4],
    ]);

    expect(screen.getByText("Add a chord")).toBeTruthy();
    expect(screen.getByText("To start playback")).toBeTruthy();
    // Verify that the statusNote is NOT rendered below the track (so it doesn't take extra space/shift layout)
    expect(container.querySelector("[class*='statusNote']")).toBeNull();
  });

  it("renders short chord labels (e.g. C, G7, Am, F) in the visible block text", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // Verbose names stay in aria-label for accessibility; the visible chord-name
    // span uses the compact idiomatic form.
    expect(screen.getByText("C", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("G7", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Am", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("F", { selector: "span" })).toBeTruthy();
  });

  it("clicking a chord block selects that progression step", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, fourStepProgression],
      [activeProgressionStepIndexAtom, 0],
    ]);
    renderWithStore(<ProgressionTrack />, store);

    fireEvent.click(screen.getByRole("button", { name: /Step 3, vi, A minor, 2 bars/i }));

    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
  });

  it("sizes beat-duration blocks proportionally to the active meter", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, beatDurationProgression],
      [beatsPerBarAtom, 8],
    ]);

    expect(container.querySelector<HTMLElement>("[aria-label='Progression timeline']")?.style.getPropertyValue("--bar-count")).toBe("2");
    expect(
      screen
        .getByRole("button", { name: /Step 1, I, C major, 2 beats, active/i })
        .style.getPropertyValue("--duration-bars"),
    ).toBe("0.25");
  });

  it("positions the playhead using exact fractional total duration bars while playing", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, beatDurationProgression],
      [beatsPerBarAtom, 8],
      [activeProgressionStepIndexAtom, 1],
    ]);
    act(() => {
      store.set(setProgressionPlayingAtom, true);
    });

    const { container } = renderWithStore(<ProgressionTrack />, store);

    expect(container.querySelector<HTMLElement>("[data-testid='progression-playhead']")?.style.transform).toBe("");
  });

  it("positions chord blocks by exact cumulative bar percentages", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, twoBarLeadingProgression],
      [beatsPerBarAtom, 4],
    ]);

    const first = screen.getByRole("button", { name: /Step 1, I, C major, 2 bars, active/i });
    const second = screen.getByRole("button", { name: /Step 2, V, G major, 1 bar/i });
    const third = screen.getByRole("button", { name: /Step 3, vi, A minor, 1 bar/i });
    const fourth = screen.getByRole("button", { name: /Step 4, IV, F major, 1 bar/i });

    expect(first.style.left).toBe("0%");
    expect(first.style.width).toBe("calc(40% - 3px)");
    expect(second.style.left).toBe("40%");
    expect(second.style.width).toBe("calc(20% - 3px)");
    expect(third.style.left).toBe("60%");
    expect(third.style.width).toBe("calc(20% - 3px)");
    expect(fourth.style.left).toBe("80%");
    expect(fourth.style.width).toBe("calc(20% - 3px)");
  });

  it("shows spelled-out bar/beat labels in the visible duration span", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    // The duration span must show full words, not abbreviations like "1B" or "2B"
    expect(screen.getAllByText("1 bar", { selector: "span" }).length).toBeGreaterThan(0);
    expect(screen.getByText("2 bars", { selector: "span" })).toBeTruthy();
  });

  it("no longer renders the rehosted backing-track controls", () => {
    renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    expect(screen.queryByLabelText("Genre style")).toBeNull();
    expect(screen.queryByLabelText("Chord instrument")).toBeNull();
    expect(screen.queryByLabelText("Chord pattern")).toBeNull();
    expect(screen.queryByLabelText("Bass pattern")).toBeNull();
    expect(screen.queryByLabelText("Drum pattern")).toBeNull();
    expect(screen.queryByLabelText("Swing amount")).toBeNull();
  });

  it("ignores timeline-block clicks while progression is playing", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, fourStepProgression],
      [activeProgressionStepIndexAtom, 0],
    ]);
    store.set(setProgressionPlayingAtom, true);
    expect(store.get(progressionPlayingAtom)).toBe(true);
    renderWithStore(<ProgressionTrack />, store);

    fireEvent.click(screen.getByRole("button", { name: /Step 2, V, G dominant seventh, 1 bar/i }));

    expect(store.get(activeProgressionStepIndexAtom)).toBe(0);
  });

  it("active block follows fastDisplayedStepIndexPrimitiveAtom during playback", async () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    store.set(setProgressionPlayingAtom, true);

    render(
      <Provider store={store}>
        <ProgressionTrack />
      </Provider>,
    );

    // Initial: primitive defaults to 0
    expect(screen.getAllByRole("button")[0]).toHaveAttribute("data-active", "true");

    await act(() => {
      store.set(fastDisplayedStepIndexPrimitiveAtom, 1);
    });

    expect(screen.getAllByRole("button")[1]).toHaveAttribute("data-active", "true");
    expect(screen.getAllByRole("button")[0]).not.toHaveAttribute("data-active", "true");
  });

  it("active block follows activeProgressionStepIndexAtom when not playing", async () => {
    const store = createStore();
    store.set(progressionStepsAtom, [
      { id: "a", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      { id: "b", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
    ] as never);
    store.set(setProgressionActiveStepIndexAtom, 0);
    // fastDisplayedStepIndexPrimitiveAtom stays 0 (visualClock resets it on stop)

    render(
      <Provider store={store}>
        <ProgressionTrack />
      </Provider>,
    );

    expect(screen.getAllByRole("button")[0]).toHaveAttribute("data-active", "true");

    await act(() => {
      store.set(setProgressionActiveStepIndexAtom, 1);
    });

    // Block highlight must follow the editor selection, not stay on chord 1
    expect(screen.getAllByRole("button")[1]).toHaveAttribute("data-active", "true");
    expect(screen.getAllByRole("button")[0]).not.toHaveAttribute("data-active", "true");
  });

  it("no longer hosts the transport bar — only the timeline", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, fourStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    expect(container.querySelector("[data-testid='transport-bar']")).toBeNull();
    expect(container.querySelector("[aria-label='Progression timeline']")).toBeTruthy();
    expect(screen.queryByText("Position")).toBeNull();
  });

  it("exposes the chord count as a minimum timeline width variable", () => {
    const { container } = renderWithAtoms(<ProgressionTrack />, [
      [progressionStepsAtom, eightStepProgression],
      [beatsPerBarAtom, 4],
    ]);

    expect(
      container
        .querySelector<HTMLElement>("[aria-label='Progression timeline']")
        ?.style.getPropertyValue("--mobile-min-chord-count"),
    ).toBe("8");
  });

  it("does not move the stopped playhead when selecting a different chord on the timeline", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, twoBarLeadingProgression],
      [beatsPerBarAtom, 4],
      [activeProgressionStepIndexAtom, 0],
    ]);
    renderWithStore(<ProgressionTrack />, store);

    const playhead = document.querySelector<HTMLElement>("[data-testid='progression-playhead']");
    expect(playhead?.style.transform).toBe("translateX(0px)");

    fireEvent.click(screen.getByRole("button", { name: /Step 3, vi, A minor, 1 bar/i }));

    expect(store.get(activeProgressionStepIndexAtom)).toBe(2);
    expect(playhead?.style.transform).toBe("translateX(0px)");
  });
});
