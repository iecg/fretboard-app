import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const audioModule = vi.hoisted(() => ({
  synth: {
    resume: vi.fn(async () => {}),
    playNote: vi.fn(async () => {}),
    setMute: vi.fn(),
    onError: undefined as ((msg: string) => void) | undefined,
  },
}));

vi.mock("./audio", () => audioModule);

import {
  __resetLazyGuitarAudioForTests,
  playGuitarNote,
  resumeGuitarAudio,
  setGuitarAudioErrorHandler,
  setGuitarMutePreference,
} from "./lazyGuitarAudio";
import * as lazyGuitarAudio from "./lazyGuitarAudio";

describe("lazyGuitarAudio", () => {
  beforeEach(() => {
    __resetLazyGuitarAudioForTests();
    vi.clearAllMocks();
  });

  it("does not call synth.setMute until the lazy runtime has been loaded", () => {
    setGuitarMutePreference(true);
    expect(audioModule.synth.setMute).not.toHaveBeenCalled();
  });

  it("replays the stored mute preference and error handler on first lazy load", async () => {
    const onError = vi.fn();
    setGuitarMutePreference(true);
    setGuitarAudioErrorHandler(onError);

    await resumeGuitarAudio();

    expect(audioModule.synth.setMute).toHaveBeenCalledWith(true);
    expect(audioModule.synth.onError).toBe(onError);
    expect(audioModule.synth.resume).toHaveBeenCalledTimes(1);
  });

  it("preloads the lazy runtime when audio preferences are registered", async () => {
    const onError = vi.fn();

    setGuitarMutePreference(true);
    setGuitarAudioErrorHandler(onError);

    await waitFor(() => {
      expect(audioModule.synth.setMute).toHaveBeenCalledWith(true);
    });
    expect(audioModule.synth.onError).toBe(onError);
    expect(audioModule.synth.resume).not.toHaveBeenCalled();
  });

  it("uses a fast path for resume after preload resolves", async () => {
    setGuitarMutePreference(true);

    await waitFor(() => {
      expect(audioModule.synth.setMute).toHaveBeenCalledWith(true);
    });

    audioModule.synth.resume.mockClear();

    const resumePromise = resumeGuitarAudio();

    expect(audioModule.synth.resume).toHaveBeenCalledTimes(1);
    await resumePromise;
  });

  it("delegates note playback through the lazy runtime", async () => {
    await playGuitarNote(440);
    expect(audioModule.synth.playNote).toHaveBeenCalledWith(440);
  });

  it("uses a fast path for playback after preload resolves", async () => {
    setGuitarMutePreference(true);

    await waitFor(() => {
      expect(audioModule.synth.setMute).toHaveBeenCalledWith(true);
    });

    audioModule.synth.playNote.mockClear();

    const playPromise = playGuitarNote(440);

    expect(audioModule.synth.playNote).toHaveBeenCalledWith(440);
    await playPromise;
  });

  it("retries loading the lazy audio module after an import failure", async () => {
    const testControls = lazyGuitarAudio as typeof lazyGuitarAudio & {
      __setLazyGuitarAudioModuleLoaderForTests?: (
        loader: () => Promise<typeof audioModule>,
      ) => void;
    };
    const setModuleLoader = testControls.__setLazyGuitarAudioModuleLoaderForTests;

    expect(setModuleLoader).toBeTypeOf("function");

    const loadError = new Error("chunk load failed");
    const loader = vi
      .fn<() => Promise<typeof audioModule>>()
      .mockRejectedValueOnce(loadError)
      .mockResolvedValueOnce(audioModule);

    setModuleLoader!(loader);

    await expect(playGuitarNote(440)).rejects.toThrow(loadError);
    await expect(playGuitarNote(440)).resolves.toBeUndefined();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(audioModule.synth.playNote).toHaveBeenCalledWith(440);
  });
});
