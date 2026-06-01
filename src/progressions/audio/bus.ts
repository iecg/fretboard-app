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
import { buildLayerBuses, type LayerBuses } from "./layerBuses";
import { _resetToneBusForTests, bindToneToProgressionContext } from "./toneBus";
import { materializeSignalGraph, type MaterializedGraph, type SignalGraphPlan } from "./sound/buildSignalGraph";

const BUS_GAIN = 0.55;
const SILENCE_RAMP_SECONDS = 0.02;
const RESUME_RAMP_SECONDS = 0.04;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let layers: LayerBuses | null = null;
let unsupported = false;

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
  if (ctx && bus && layers) return { ctx, bus, layers };

  const Ctor = getAudioContextConstructor();
  if (!Ctor) {
    unsupported = true;
    return null;
  }

  try {
    ctx = new Ctor();
    bus = ctx.createGain();
    bus.gain.value = BUS_GAIN;
    bus.connect(ctx.destination);
    layers = buildLayerBuses(ctx, bus);
    bindToneToProgressionContext({ ctx, bus, layers });
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

/** Test-only reset hook so the module behaves predictably across `vitest` runs. */
export function _resetProgressionAudioForTests(): void {
  if (currentGraph) { try { currentGraph.dispose(); } catch { /* */ } currentGraph = null; }
  lastPlanKey = null;
  ctx = null;
  bus = null;
  layers = null;
  unsupported = false;
  _resetToneBusForTests();
}

