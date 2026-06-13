type GuitarSynthModule = typeof import("./audio");

let modulePromise: Promise<GuitarSynthModule> | null = null;
let desiredMute = false;
let errorHandler: ((message: string) => void) | undefined;
let outputWedgedHandler: (() => void) | undefined;

async function loadAudioModule(): Promise<GuitarSynthModule> {
  if (!modulePromise) {
    modulePromise = import("./audio").then((mod) => {
      mod.synth.onError = errorHandler;
      mod.synth.onOutputWedged = outputWedgedHandler;
      mod.synth.setMute(desiredMute);
      return mod;
    });
  }
  return modulePromise;
}

export function setGuitarMutePreference(mute: boolean): void {
  desiredMute = mute;
  void modulePromise?.then((mod) => {
    mod.synth.setMute(mute);
  });
}

export function prefetchAudioModule(): void {
  void loadAudioModule();
}

export function setGuitarAudioErrorHandler(
  nextHandler: ((message: string) => void) | undefined,
): void {
  errorHandler = nextHandler;
  void modulePromise?.then((mod) => {
    mod.synth.onError = nextHandler;
  });
}

export function setGuitarOutputWedgedHandler(
  nextHandler: (() => void) | undefined,
): void {
  outputWedgedHandler = nextHandler;
  void modulePromise?.then((mod) => {
    mod.synth.onOutputWedged = nextHandler;
  });
}

export async function resumeGuitarAudio(): Promise<void> {
  const mod = await loadAudioModule();
  await mod.synth.resume();
}

export async function playGuitarNote(frequency: number): Promise<void> {
  const mod = await loadAudioModule();
  await mod.synth.playNote(frequency);
}

export function __resetLazyGuitarAudioForTests(): void {
  modulePromise = null;
  desiredMute = false;
  errorHandler = undefined;
  outputWedgedHandler = undefined;
}
