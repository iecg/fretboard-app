// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FretboardEmbed } from "./FretboardEmbed";
// Prime the lazy chunk so React.lazy() resolves on first microtask in jsdom.
import "../components/FretboardSVG/FretboardSVG";

vi.mock("../core/lazyGuitarAudio", () => ({
  playGuitarNote: vi.fn().mockResolvedValue(undefined),
  prefetchAudioModule: vi.fn(),
  resumeGuitarAudio: vi.fn().mockResolvedValue(undefined),
}));
import {
  playGuitarNote,
  prefetchAudioModule,
  resumeGuitarAudio,
} from "../core/lazyGuitarAudio";

// Flushes React.lazy Suspense so the FretboardSVG mounts before assertions.
async function flushSuspense() {
  await act(async () => {
    await Promise.resolve();
  });
}

// The interactive hit target is a transparent `button[data-string-index]`
// rendered by FretboardHitTargetLayer.
function firstHitTarget(): HTMLButtonElement {
  const btn = document.querySelector<HTMLButtonElement>(
    "button[data-string-index][data-fret-index]",
  );
  if (!btn) throw new Error("no fretboard hit target rendered");
  return btn;
}

describe("FretboardEmbed", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the fretboard", async () => {
    render(<FretboardEmbed config={{}} />);
    await flushSuspense();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("applies config.root to the rendered scale", async () => {
    render(<FretboardEmbed config={{ root: "G", displayFormat: "notes" }} />);
    await flushSuspense();
    expect(screen.getAllByText("G").length).toBeGreaterThan(0);
  });

  it("isolates state between two embeds (per-embed store)", async () => {
    const { unmount } = render(
      <FretboardEmbed config={{ root: "G", displayFormat: "notes" }} />,
    );
    await flushSuspense();
    unmount();
    render(<FretboardEmbed config={{ root: "D", displayFormat: "notes" }} />);
    await flushSuspense();
    expect(screen.getAllByText("D").length).toBeGreaterThan(0);
  });

  it('audio="events": emits noteActivated and does NOT call the builtin synth', async () => {
    const onEvent = vi.fn();
    render(<FretboardEmbed config={{ audio: "events" }} onEvent={onEvent} />);
    await flushSuspense();
    const user = userEvent.setup();
    await user.click(firstHitTarget());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "noteActivated",
        frequency: expect.any(Number),
        note: expect.any(String),
        string: expect.any(Number),
        fret: expect.any(Number),
      }),
    );
    expect(playGuitarNote).not.toHaveBeenCalled();
  });

  it('audio="builtin" (default): calls the builtin synth', async () => {
    render(<FretboardEmbed config={{}} />);
    await flushSuspense();
    const user = userEvent.setup();
    await user.click(firstHitTarget());
    expect(playGuitarNote).toHaveBeenCalled();
  });

  it('audio="builtin": prefetches the audio module on mount and resumes on first gesture', async () => {
    render(<FretboardEmbed config={{}} />);
    await flushSuspense();
    expect(prefetchAudioModule).toHaveBeenCalled();
    expect(resumeGuitarAudio).not.toHaveBeenCalled();
    await userEvent.setup().pointer({ keys: "[MouseLeft]", target: firstHitTarget() });
    expect(resumeGuitarAudio).toHaveBeenCalled();
  });

  it('audio="events": does NOT prefetch the builtin audio module', async () => {
    render(<FretboardEmbed config={{ audio: "events" }} />);
    await flushSuspense();
    expect(prefetchAudioModule).not.toHaveBeenCalled();
  });
});
