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
  isGuitarAudioLoaded,
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

  it("replays the stored mute preference and error handler once preload completes", async () => {
    const onError = vi.fn();
    setGuitarMutePreference(true);
    setGuitarAudioErrorHandler(onError);

    await waitFor(() => {
      expect(audioModule.synth.setMute).toHaveBeenCalledWith(true);
    });

    await resumeGuitarAudio();

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

  it("preloads and returns on a cold-path resume until the runtime is loaded", async () => {
    const testControls = lazyGuitarAudio as typeof lazyGuitarAudio & {
      __setLazyGuitarAudioModuleLoaderForTests?: (
        loader: () => Promise<typeof audioModule>,
      ) => void;
    };
    const setModuleLoader = testControls.__setLazyGuitarAudioModuleLoaderForTests;

    expect(setModuleLoader).toBeTypeOf("function");

    let resolveModule: ((value: typeof audioModule) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<typeof audioModule>((resolve) => {
          resolveModule = resolve;
        }),
    );

    setModuleLoader!(loader);

    let settled = false;
    void resumeGuitarAudio().then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(settled).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(isGuitarAudioLoaded()).toBe(false);
    expect(audioModule.synth.resume).not.toHaveBeenCalled();

    resolveModule?.(audioModule);

    await waitFor(() => {
      expect(isGuitarAudioLoaded()).toBe(true);
    });
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

  it("preloads and returns on cold-path playback until the runtime is loaded", async () => {
    const testControls = lazyGuitarAudio as typeof lazyGuitarAudio & {
      __setLazyGuitarAudioModuleLoaderForTests?: (
        loader: () => Promise<typeof audioModule>,
      ) => void;
    };
    const setModuleLoader = testControls.__setLazyGuitarAudioModuleLoaderForTests;

    expect(setModuleLoader).toBeTypeOf("function");

    let resolveModule: ((value: typeof audioModule) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<typeof audioModule>((resolve) => {
          resolveModule = resolve;
        }),
    );

    setModuleLoader!(loader);

    let settled = false;
    void playGuitarNote(440).then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(settled).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(audioModule.synth.playNote).not.toHaveBeenCalled();

    resolveModule?.(audioModule);
    await waitFor(() => {
      expect(isGuitarAudioLoaded()).toBe(true);
    });

    await playGuitarNote(440);
    expect(audioModule.synth.playNote).toHaveBeenCalledWith(440);
  });

  it("suppresses preload failures during preference registration", async () => {
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

    setGuitarMutePreference(true);
    setGuitarAudioErrorHandler(() => {});
    await Promise.resolve();
    await Promise.resolve();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(audioModule.synth.setMute).not.toHaveBeenCalled();
  });

  it("retries loading the lazy audio module after a cold-path import failure", async () => {
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

    await expect(playGuitarNote(440)).resolves.toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    await expect(playGuitarNote(440)).resolves.toBeUndefined();

    expect(loader).toHaveBeenCalledTimes(2);
    await playGuitarNote(440);
    expect(audioModule.synth.playNote).toHaveBeenCalledWith(440);
  });
});
