type GuitarSynthModule = typeof import("./audio");

const defaultModuleLoader = () => import("./audio");

let modulePromise: Promise<GuitarSynthModule> | null = null;
let loadedModule: GuitarSynthModule | null = null;
let desiredMute = false;
let errorHandler: ((message: string) => void) | undefined;
let moduleLoader: () => Promise<GuitarSynthModule> = defaultModuleLoader;

async function loadAudioModule(): Promise<GuitarSynthModule> {
  if (loadedModule) {
    return loadedModule;
  }

  if (!modulePromise) {
    modulePromise = Promise.resolve()
      .then(() => moduleLoader())
      .then((mod) => {
        loadedModule = mod;
        mod.synth.onError = errorHandler;
        mod.synth.setMute(desiredMute);
        return mod;
      })
      .catch((error: unknown) => {
        modulePromise = null;
        loadedModule = null;
        throw error;
      });
  }
  return modulePromise;
}

function preloadAudioModule(): void {
  void loadAudioModule().catch(() => {
    // Swallow preload failures; explicit resume/play calls can retry.
  });
}

export function setGuitarMutePreference(mute: boolean): void {
  desiredMute = mute;
  preloadAudioModule();
  void modulePromise
    ?.then((mod) => {
      mod.synth.setMute(mute);
    })
    .catch(() => {
      // Swallow preload failures; explicit resume/play calls can retry.
    });
}

export function setGuitarAudioErrorHandler(
  nextHandler: ((message: string) => void) | undefined,
): void {
  errorHandler = nextHandler;
  preloadAudioModule();
  void modulePromise
    ?.then((mod) => {
      mod.synth.onError = nextHandler;
    })
    .catch(() => {
      // Swallow preload failures; explicit resume/play calls can retry.
    });
}

export async function resumeGuitarAudio(): Promise<void> {
  if (loadedModule) {
    await loadedModule.synth.resume();
    return;
  }

  const mod = await loadAudioModule();
  await mod.synth.resume();
}

export async function playGuitarNote(frequency: number): Promise<void> {
  if (loadedModule) {
    await loadedModule.synth.playNote(frequency);
    return;
  }

  const mod = await loadAudioModule();
  await mod.synth.playNote(frequency);
}

export function __resetLazyGuitarAudioForTests(): void {
  modulePromise = null;
  loadedModule = null;
  desiredMute = false;
  errorHandler = undefined;
  moduleLoader = defaultModuleLoader;
}

export function __setLazyGuitarAudioModuleLoaderForTests(
  nextLoader: () => Promise<GuitarSynthModule>,
): void {
  modulePromise = null;
  loadedModule = null;
  moduleLoader = nextLoader;
}
