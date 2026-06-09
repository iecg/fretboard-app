/**
 * Detect Safari's "dead Web Audio output" wedge.
 *
 * On Safari/macOS, after long idle or an output-device change (e.g. AirPods
 * handing off phone → Mac), the AudioContext keeps reporting `state: "running"`
 * and `currentTime` keeps advancing, but no audio reaches the speakers. It
 * survives a full page reload (a fresh AudioContext lands in the same wedged
 * per-process audio session), so recreating the context cannot fix it — only a
 * full browser restart does. We therefore DETECT the condition and tell the
 * user, rather than pretending to recover.
 *
 * Detection signal: `currentTime` advances regardless of real output, but
 * `getOutputTimestamp().contextTime` reports the frame the HARDWARE is actually
 * outputting — it freezes when nothing is being consumed. So:
 *   currentTime advanced  AND  contextTime did not  →  output is wedged.
 *
 * `getOutputTimestamp` is feature-detected; when unavailable the probe returns
 * "unknown" and we never raise a false alarm.
 */

import * as Tone from "tone";

export type OutputHealth = "healthy" | "wedged" | "unknown";

/** Gap between the two samples. Long enough that a healthy contextTime moves
 *  well past timer/scheduling jitter, short enough to feel instant. */
const PROBE_WINDOW_MS = 250;

/** A healthy hardware clock should advance by at least this fraction of the
 *  elapsed wall time across the window. Wedged output advances ~0. The slack
 *  absorbs output latency and timer imprecision. */
const MIN_ADVANCE_RATIO = 0.25;

function getLiveRawContext(): AudioContext | null {
  try {
    const raw = Tone.getContext().rawContext as unknown as AudioContext | undefined;
    return raw ?? null;
  } catch {
    return null;
  }
}

interface OutputTimestampCapable {
  getOutputTimestamp?: () => { contextTime?: number };
}

function readContextTime(ctx: AudioContext): number | null {
  const fn = (ctx as unknown as OutputTimestampCapable).getOutputTimestamp;
  if (typeof fn !== "function") return null;
  try {
    const ts = fn.call(ctx);
    return typeof ts?.contextTime === "number" ? ts.contextTime : null;
  } catch {
    return null;
  }
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sample the live context twice and classify output health. Only meaningful
 * while audio is (or was just) playing — the caller is responsible for probing
 * at a moment sound should be reaching the hardware.
 */
export async function probeOutputHealth(explicitCtx?: AudioContext): Promise<OutputHealth> {
  const ctx = explicitCtx ?? getLiveRawContext();
  // A suspended/closed context is a different (recoverable) condition handled
  // elsewhere; only a "running" context can be a silent-output zombie.
  if (!ctx || ctx.state !== "running") return "unknown";

  const ct0 = readContextTime(ctx);
  if (ct0 === null) return "unknown"; // getOutputTimestamp unsupported

  const t0 = ctx.currentTime;
  await wait(PROBE_WINDOW_MS);

  if (ctx.state !== "running") return "unknown";
  const ct1 = readContextTime(ctx);
  if (ct1 === null) return "unknown";
  const t1 = ctx.currentTime;

  const currentAdvanced = t1 - t0;
  const hardwareAdvanced = ct1 - ct0;

  // currentTime barely moved (e.g. context paused under the hood) → inconclusive.
  if (currentAdvanced < PROBE_WINDOW_MS / 1000 / 2) return "unknown";

  // Hardware clock kept up → real output. Otherwise it's frozen → wedged.
  return hardwareAdvanced >= currentAdvanced * MIN_ADVANCE_RATIO
    ? "healthy"
    : "wedged";
}
