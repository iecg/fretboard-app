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

describe("FretboardEmbed — M2 fingering/scale hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function renderWithProbe(config: Parameters<typeof FretboardEmbed>[0]["config"]) {
    // All imports are deferred until after vi.doMock so that each call to
    // renderWithProbe gets a fresh module graph (consistent atom instances).
    const [
      { useAtomValue: freshUseAtomValue },
      {
        fingeringPatternAtom: fpAtom,
        cagedShapesAtom: csAtom,
        npsPositionAtom: npsPosAtom,
        npsOctaveAtom: npsOctAtom,
        oneStringIndexAtom: osIdxAtom,
        oneStringIntervalAtom: osIntAtom,
        twoStringsPairAtom: tsPairAtom,
        twoStringsIntervalAtom: tsIntAtom,
      },
      { scaleVisibleAtom: svAtom },
    ] = await Promise.all([
      import("jotai"),
      import("../store/fingeringAtoms"),
      import("../store/scaleAtoms"),
    ]);
    vi.doMock("../components/Fretboard/Fretboard", () => ({
      Fretboard: () => {
        const fingeringPattern = freshUseAtomValue(fpAtom);
        const cagedShapes = freshUseAtomValue(csAtom);
        const npsPosition = freshUseAtomValue(npsPosAtom);
        const npsOctave = freshUseAtomValue(npsOctAtom);
        const oneStringIndex = freshUseAtomValue(osIdxAtom);
        const oneStringInterval = freshUseAtomValue(osIntAtom);
        const twoStringsPair = freshUseAtomValue(tsPairAtom);
        const twoStringsInterval = freshUseAtomValue(tsIntAtom);
        const scaleVisible = freshUseAtomValue(svAtom);
        return (
          <div
            data-testid="probe"
            data-fingering={fingeringPattern}
            data-caged={Array.from(cagedShapes).join(",")}
            data-nps-pos={String(npsPosition)}
            data-nps-oct={String(npsOctave)}
            data-one-idx={String(oneStringIndex)}
            data-one-int={String(oneStringInterval)}
            data-two-pair={String(twoStringsPair)}
            data-two-int={String(twoStringsInterval)}
            data-scale-visible={String(scaleVisible)}
          />
        );
      },
    }));
    const { FretboardEmbed: FreshFretboardEmbed } = await import("./FretboardEmbed");
    return render(<FreshFretboardEmbed config={config} />);
  }

  it("hydrates the active fingering pattern + CAGED shape", async () => {
    await renderWithProbe({ fingeringPattern: "caged", cagedShape: "A" });
    await flushSuspense();
    await act(async () => { await Promise.resolve(); });
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("data-fingering")).toBe("caged");
    expect(probe.getAttribute("data-caged")).toBe("A");
  });

  it("hydrates 3NPS position + octave", async () => {
    await renderWithProbe({ fingeringPattern: "3nps", npsPosition: 4, npsOctave: 1 });
    await flushSuspense();
    await act(async () => { await Promise.resolve(); });
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("data-nps-pos")).toBe("4");
    expect(probe.getAttribute("data-nps-oct")).toBe("1");
  });

  it("hydrates one-string + two-strings sub-params and scaleVisible", async () => {
    await renderWithProbe({
      fingeringPattern: "two-strings",
      oneStringIndex: 3,
      oneStringInterval: 1,
      twoStringsPair: 2,
      twoStringsInterval: 3,
      scaleVisible: false,
    });
    await flushSuspense();
    await act(async () => { await Promise.resolve(); });
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("data-one-idx")).toBe("3");
    expect(probe.getAttribute("data-one-int")).toBe("1");
    expect(probe.getAttribute("data-two-pair")).toBe("2");
    expect(probe.getAttribute("data-two-int")).toBe("3");
    expect(probe.getAttribute("data-scale-visible")).toBe("false");
  });
});

describe("FretboardEmbed — M3 progression hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function renderWithSongProbe(config: Parameters<typeof FretboardEmbed>[0]["config"]) {
    const [
      { useAtomValue: u },
      {
        currentProgressionPresetIdAtom: presetIdAtom,
        progressionLoopEnabledAtom: loopAtom,
        progressionTempoBpmAtom: tempoAtom,
        progressionGenreStyleAtom: genreAtom,
        progressionDrumsEnabledAtom: drumsAtom,
        progressionBassEnabledAtom: bassAtom,
        progressionChordEnabledAtom: chordsAtom,
        progressionMetronomeEnabledAtom: metroAtom,
      },
    ] = await Promise.all([import("jotai"), import("../store/progressionAtoms")]);
    vi.doMock("../hooks/useProgressionAudioPlayback", () => ({
      useProgressionAudioPlayback: () => {},
      __resetProgressionAudioPlaybackForTests: () => {},
    }));
    vi.doMock("../components/Fretboard/Fretboard", () => ({
      Fretboard: () => (
        <div
          data-testid="song-probe"
          data-preset={String(u(presetIdAtom))}
          data-loop={String(u(loopAtom))}
          data-tempo={String(u(tempoAtom))}
          data-genre={String(u(genreAtom))}
          data-drums={String(u(drumsAtom))}
          data-bass={String(u(bassAtom))}
          data-chords={String(u(chordsAtom))}
          data-metro={String(u(metroAtom))}
        />
      ),
    }));
    const { FretboardEmbed: Fresh } = await import("./FretboardEmbed");
    render(<Fresh config={config} />);
    await act(async () => { await Promise.resolve(); });
    return screen.getByTestId("song-probe");
  }

  it("hydrates preset, loop, tempo, genre and the four layer toggles", async () => {
    const probe = await renderWithSongProbe({
      progressionEnabled: true,
      progressionPreset: "two-five-one",
      progressionLoop: false,
      progressionTempoBpm: 120,
      progressionGenre: "jazz",
      drumsEnabled: false,
      bassEnabled: false,
      chordsEnabled: true,
      metronomeEnabled: true,
    });
    expect(probe.getAttribute("data-preset")).toBe("two-five-one");
    expect(probe.getAttribute("data-loop")).toBe("false");
    expect(probe.getAttribute("data-tempo")).toBe("120");
    expect(probe.getAttribute("data-genre")).toBe("jazz");
    expect(probe.getAttribute("data-drums")).toBe("false");
    expect(probe.getAttribute("data-bass")).toBe("false");
    expect(probe.getAttribute("data-chords")).toBe("true");
    expect(probe.getAttribute("data-metro")).toBe("true");
  });
});

describe("FretboardEmbed — progression playback runner mount", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function renderEmbed(config: Parameters<typeof FretboardEmbed>[0]["config"]) {
    const hookSpy = vi.fn();
    vi.doMock("../hooks/useProgressionAudioPlayback", () => ({
      useProgressionAudioPlayback: hookSpy,
      __resetProgressionAudioPlaybackForTests: () => {},
    }));
    // Mock the heavy child so the test stays in jsdom without SVG/audio.
    vi.doMock("../components/Fretboard/Fretboard", () => ({ Fretboard: () => null }));
    const { FretboardEmbed: Fresh } = await import("./FretboardEmbed");
    render(<Fresh config={config} />);
    await act(async () => { await Promise.resolve(); });
    return hookSpy;
  }

  it("mounts the playback hook when progressionEnabled is true", async () => {
    const spy = await renderEmbed({ progressionEnabled: true });
    expect(spy).toHaveBeenCalled();
  });

  it("does NOT mount the playback hook by default", async () => {
    const spy = await renderEmbed({});
    expect(spy).not.toHaveBeenCalled();
  });
});
