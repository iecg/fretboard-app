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

  it("delegates note playback through the lazy runtime", async () => {
    await playGuitarNote(440);
    expect(audioModule.synth.playNote).toHaveBeenCalledWith(440);
  });
});
