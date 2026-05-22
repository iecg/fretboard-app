type GuitarSynthModule = typeof import("./audio");

let modulePromise: Promise<GuitarSynthModule> | null = null;
let desiredMute = false;
let errorHandler: ((message: string) => void) | undefined;

async function loadAudioModule(): Promise<GuitarSynthModule> {
  if (!modulePromise) {
    modulePromise = import("./audio").then((mod) => {
      mod.synth.onError = errorHandler;
      mod.synth.setMute(desiredMute);
      return mod;
    });
  }
  return modulePromise;
}

function preloadAudioModule(): void {
  void loadAudioModule();
}

export function setGuitarMutePreference(mute: boolean): void {
  desiredMute = mute;
  preloadAudioModule();
  void modulePromise?.then((mod) => {
    mod.synth.setMute(mute);
  });
}

export function setGuitarAudioErrorHandler(
  nextHandler: ((message: string) => void) | undefined,
): void {
  errorHandler = nextHandler;
  preloadAudioModule();
  void modulePromise?.then((mod) => {
    mod.synth.onError = nextHandler;
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
}
