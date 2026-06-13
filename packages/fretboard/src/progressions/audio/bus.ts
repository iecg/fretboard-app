/**
 * Shared audio context + master bus for progression playback.
 *
 * The progression track schedules many short-lived voices per bar (chord
 * strums, bass notes, drum hits, metronome clicks). Routing them all through
 * a single `GainNode` gives us a single fader to silence the entire backing
 * track on pause/mute without iterating every active voice.
 *
 * Lazy initialization is required: `AudioContext` construction is gated on a
 * user gesture in most browsers. Call `ensureProgressionAudio()` from inside
 * a click handler (e.g. the play button) before scheduling.
 */

import { getDraw } from "tone";
import { registerAudioContext, unregisterAudioContext } from "../../core/audioIdleSuspend";
import { buildLayerBuses, type LayerBuses } from "./layerBuses";
import { _resetToneBusForTests, bindToneToProgressionContext, resetToneBusBinding } from "./toneBus";
import { materializeSignalGraph, type MaterializedGraph, type SignalGraphPlan } from "./sound/buildSignalGraph";

const BUS_GAIN = 0.55;
const SILENCE_RAMP_SECONDS = 0.02;
const RESUME_RAMP_SECONDS = 0.04;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let layers: LayerBuses | null = null;
let unsupported = false;

/**
 * Set when Safari (or any browser) suspends the AudioContext after extended
 * idle. The next `resumeProgressionAudio()` call uses this to force a fresh
 * signal-graph rebuild — cached Tone.js nodes (Channel, Compressor, Limiter,
 * Reverb) may be non-functional after a long suspension even though the
 * context reports "running". The bus→destination native connection is also
 * re-established.
 */
let needsGraphRebuild = false;

/**
 * Zombie-context detection: Safari silently disconnects AudioContext audio
 * output after extended idle — the context reports `state === "running"` and
 * `currentTime` advances, but no audio reaches the speakers. No
 * `statechange` event fires. The only remedy is closing the dead context and
 * creating a fresh one.
 *
 * Two independent triggers mark a context as potentially zombie:
 *
 * 1. **Background return** — the page was hidden for ≥ 10 s. Safari
 *    aggressively reclaims resources for background tabs.
 * 2. **Long idle** — no audio was scheduled for ≥ 60 s while the page
 *    stayed visible. Safari may still throttle a visible-but-idle tab.
 */
let contextMayBeZombie = false;
let lastAudioActivityMs = 0;
let pageHiddenAtMs: number | null = null;
const MIN_HIDDEN_FOR_ZOMBIE_MS = 10_000;
const IDLE_ZOMBIE_THRESHOLD_MS = 60_000;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      pageHiddenAtMs = performance.now();
    } else if (document.visibilityState === "visible") {
      if (pageHiddenAtMs !== null && ctx) {
        const hiddenDuration = performance.now() - pageHiddenAtMs;
        if (hiddenDuration > MIN_HIDDEN_FOR_ZOMBIE_MS) {
          contextMayBeZombie = true;
        }
      }
      pageHiddenAtMs = null;
    }
  });
}

function tearDownForContextReplacement(): void {
  if (currentGraph) {
    try { currentGraph.dispose(); } catch { /* already disposed */ }
    currentGraph = null;
  }
  lastPlanKey = null;
  if (ctx) {
    unregisterAudioContext(ctx);
    try { ctx.close(); } catch { /* already closed */ }
  }
  ctx = null;
  bus = null;
  layers = null;
  needsGraphRebuild = false;
  contextMayBeZombie = false;
  resetToneBusBinding();
}


function getAudioContextConstructor(): (new () => AudioContext) | undefined {
  const w = window as Window & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

export interface ProgressionAudio {
  ctx: AudioContext;
  /** Parent gain — all four layer buses connect here, then to ctx.destination. */
  bus: GainNode;
  /** Per-layer gain nodes. Sequencer callbacks connect their voices here. */
  layers: LayerBuses;
}

/**
 * Lazily create the shared `AudioContext` + bus, returning them if available.
 * Returns `null` when Web Audio is unsupported or construction fails (e.g.
 * SSR, locked autoplay policy with no gesture yet).
 */
export function ensureProgressionAudio(): ProgressionAudio | null {
  if (unsupported) return null;

  // Zombie-context recovery (see block comment above the flags).
  if (ctx) {
    const isZombieFromBackground = contextMayBeZombie;
    const isZombieFromIdle =
      lastAudioActivityMs > 0 &&
      performance.now() - lastAudioActivityMs > IDLE_ZOMBIE_THRESHOLD_MS;
    if (isZombieFromBackground || isZombieFromIdle) {
      tearDownForContextReplacement();
    }
  }

  if (ctx && bus && layers) {
    lastAudioActivityMs = performance.now();
    return { ctx, bus, layers };
  }

  const Ctor = getAudioContextConstructor();
  if (!Ctor) {
    unsupported = true;
    return null;
  }

  try {
    ctx = new Ctor();

    // Track when Safari (or any browser) re-suspends the context after idle.
    // The flag tells resumeProgressionAudio() to rebuild stale Tone.js nodes.
    ctx.addEventListener("statechange", () => {
      if (ctx?.state === "suspended" || ctx?.state === "interrupted") {
        needsGraphRebuild = true;
      }
    });

    bus = ctx.createGain();
    bus.gain.value = BUS_GAIN;
    bus.connect(ctx.destination);
    layers = buildLayerBuses(ctx, bus);
    bindToneToProgressionContext({ ctx, bus, layers });
    registerAudioContext(ctx, "progression");
  } catch (err) {
    // Dev-mode diagnostic — silent in production. The 2026-05-25 P2-T1
    // regression (Tone.Draw.expiration assignment on undefined) hid in
    // this try/catch for the entire round-1 plan because the catch logged
    // nothing. The console.warn flips a known-recoverable failure into an
    // observable one during development without polluting production logs.
    if (import.meta.env.DEV) {
      console.warn("[progression-audio] ensureProgressionAudio init failed:", err);
    }
    unsupported = true;
    ctx = null;
    bus = null;
    layers = null;
    return null;
  }

  // Best-effort: raise Draw.expiration so heavy main-thread renders don't
  // silently drop chord-overlay advances. Default is 250ms; chord
  // boundaries are >=0.5s at sane tempos so 5s gives a 10x margin without
  // ever firing stale.
  //
  // This is an OPTIMIZATION ON TOP of the working bus — kept outside the
  // setup try/catch so a failure here doesn't poison `ensureProgressionAudio`
  // and return null to every caller. In jsdom test environments, the mock
  // AudioContext doesn't satisfy Tone's Draw class, so `getDraw()` returns
  // undefined and assigning `.expiration` would throw; before this guard
  // moved out of the main try, that silent throw broke the timeline tests
  // (regression introduced in commit 183caeb9, found 2026-05-25).
  try {
    getDraw().expiration = 5;
  } catch {
    // Non-fatal — playback works without it; only the chord-overlay React
    // advance loses its under-load safety margin.
  }

  lastAudioActivityMs = performance.now();
  return { ctx, bus, layers };
}

/** Best-effort resume; safe to call repeatedly. */
export async function resumeProgressionAudio(): Promise<void> {
  const audio = ensureProgressionAudio();
  if (!audio) return;
  if (audio.ctx.state === "suspended" || audio.ctx.state === "interrupted") {
    try {
      await audio.ctx.resume();
    } catch {
      // best-effort
    }
  }

  // Post-suspension recovery: after Safari re-suspends the AudioContext during
  // extended idle, ctx.resume() restores state to "running" but the cached
  // Tone.js signal-graph nodes (Channel, Compressor, Limiter, Reverb) may be
  // non-functional, and the bus→destination native connection may be broken.
  // Dispose the stale graph and reconnect the bus so the next
  // configureProgressionGraph() call builds fresh nodes.
  if (needsGraphRebuild) {
    if (currentGraph) {
      currentGraph.dispose();
      // dispose() already sets currentGraph = null and lastPlanKey = null
      // when the disposed graph matches currentGraph.
    }
    // Re-establish the bus→destination link (Safari may drop native
    // AudioNode connections during very long suspension).
    try { audio.bus.disconnect(); } catch { /* not connected */ }
    audio.bus.connect(audio.ctx.destination);
    needsGraphRebuild = false;
  }
}

/**
 * Snap the bus gain down to zero with a short ramp so currently-ringing
 * voices fade in ~20ms instead of running their full envelopes. Use on
 * pause/stop/mute to keep the track responsive.
 */
export function silenceProgressionBus(): void {
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(0, now + SILENCE_RAMP_SECONDS);
}

/**
 * Restore the bus to full level. Mirrors `silenceProgressionBus`; call when
 * resuming playback so the next scheduled hit isn't swallowed by a zero bus.
 */
export function restoreProgressionBus(): void {
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(BUS_GAIN, now + RESUME_RAMP_SECONDS);
}

const GRAPH_LAYERS = ["chord", "bass", "drums", "metronome"] as const;

let currentGraph: MaterializedGraph | null = null;
// Serialized signature of the plan behind `currentGraph`. When the next call
// presents a deeply-equal plan we reuse the live graph instead of tearing it
// down and rebuilding — the rebuild (disconnect → dispose → materialize →
// rewire) is synchronous and runs in the play-click task. MUST be reset to null
// anywhere `currentGraph` is disposed/cleared, or a stale plan key could cause a
// disposed graph to be wrongly reused.
let lastPlanKey: string | null = null;

/**
 * (Re)build the per-instrument mix graph for the active tier+genre and route
 * the four layer buses into it. Disposes any prior graph. Returns the graph, or
 * null when audio is unavailable. Call on play and whenever (quality, genre)
 * changes — never mid-step.
 *
 * The layer buses connect to the master `bus` by default (buildLayerBuses);
 * this disconnects them from that (or the prior graph) and reconnects them into
 * the new graph's native input nodes.
 */
export function configureProgressionGraph(plan: SignalGraphPlan): MaterializedGraph | null {
  const audio = ensureProgressionAudio();
  if (!audio) return null;

  // `planSignalGraph` returns a plain, serializable data object (no functions or
  // Tone nodes), so JSON.stringify is a stable signature. When the plan is
  // unchanged AND we still hold a live graph, skip the entire teardown/rebuild.
  const planKey = JSON.stringify(plan);
  if (planKey === lastPlanKey && currentGraph) return currentGraph;

  // Build the new graph FIRST. If materialization throws (Tone node
  // construction can fail on some devices/plans), we must not have already torn
  // down the prior routing — otherwise the four layer buses would be left
  // disconnected from the master bus and the backing track would go permanently
  // silent. Materializing before the swap means a failure propagates with the
  // old graph + layer connections still intact.
  const rawGraph = materializeSignalGraph(audio.ctx, audio.bus, plan);

  // Wrap dispose so tearing down the returned graph also invalidates the cache.
  // The cached object exposes dispose() as part of its contract; if a caller
  // disposed it without going through a rebuild, currentGraph/lastPlanKey would
  // still point at a dead graph and the next identical plan would reuse it. No
  // production caller disposes it today (only the rebuild path + test reset do),
  // so this guards the public dispose() against future misuse. Idempotent.
  let disposed = false;
  const graph: MaterializedGraph = {
    ...rawGraph,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      rawGraph.dispose();
      if (currentGraph === graph) {
        currentGraph = null;
        lastPlanKey = null;
      }
    },
  };

  for (const layer of GRAPH_LAYERS) {
    try { audio.layers[layer].disconnect(); } catch { /* not connected */ }
  }
  if (currentGraph) currentGraph.dispose();
  for (const layer of GRAPH_LAYERS) {
    audio.layers[layer].connect(graph.inputs[layer] as AudioNode);
  }
  currentGraph = graph;
  lastPlanKey = planKey;
  return graph;
}

/**
 * Called when the page becomes visible after being hidden while a progression
 * was playing. Handles two scenarios:
 *
 * 1. **Zombie context** (Safari) — AudioContext reports "running" but produces
 *    no audio after extended idle. `ensureProgressionAudio()` tears down the
 *    dead context and creates a fresh one. Old Tone.Parts are dead → caller
 *    must restart playback from bar 1.
 *
 * 2. **Suspended context** (Chrome/Firefox) — AudioContext was suspended when
 *    the tab went to background. `ctx.resume()` + `needsGraphRebuild` recovery
 *    restores the existing signal graph. Existing Tone.Parts continue after
 *    resume → no restart needed.
 *
 * Returns `true` when the context was replaced (scenario 1) — the caller
 * should restart playback. Returns `false` when the context was recovered
 * in-place (scenario 2) — the existing Parts are still valid.
 */
export async function recoverProgressionContext(): Promise<"restart" | "rebuild" | "none"> {
  if (!ctx) return "none";

  const wasZombie = contextMayBeZombie;

  // ensureProgressionAudio detects zombie → tears down dead context and
  // creates a fresh one. After this call, contextMayBeZombie is cleared and
  // ctx points at the replacement (or the same healthy context).
  ensureProgressionAudio();

  if (wasZombie) {
    // Old AudioContext was closed — all Tone.Parts referencing it are dead.
    // The caller must tear down and rebuild playback from bar 1.
    return "restart";
  }

  let graphWasDisposed = false;
  if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
    const hadGraph = currentGraph !== null;
    await resumeProgressionAudio();
    if (hadGraph && currentGraph === null) {
      graphWasDisposed = true;
    }
  }

  return graphWasDisposed ? "rebuild" : "none";
}

/** Test-only reset hook so the module behaves predictably across `vitest` runs. */
export function _resetProgressionAudioForTests(): void {
  if (currentGraph) { try { currentGraph.dispose(); } catch { /* */ } currentGraph = null; }
  lastPlanKey = null;
  ctx = null;
  bus = null;
  layers = null;
  unsupported = false;
  needsGraphRebuild = false;
  contextMayBeZombie = false;
  lastAudioActivityMs = 0;
  pageHiddenAtMs = null;
  _resetToneBusForTests();
}

