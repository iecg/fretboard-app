import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export interface ShareState {
  root: string;
  scale: string;
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  steps: Array<{
    degree: string;
    qualityOverride: string | null;
    duration: { value: number; unit: "bar" | "beat" };
  }>;
}

function encodeRoot(root: string): string {
  return root.replace("#", "s");
}

function encodeScale(scale: string): string {
  return scale.replace(/ /g, "+");
}

function encodeStep(step: ShareState["steps"][number]): string {
  let token = step.degree;
  if (step.qualityOverride) token += `:${step.qualityOverride}`;
  const isDefaultDuration = step.duration.value === 1 && step.duration.unit === "bar";
  if (!isDefaultDuration) {
    const suffix = step.duration.unit === "bar" ? "b" : "bt";
    token += `*${step.duration.value}${suffix}`;
  }
  return token;
}

const MIN_TEMPO = 40;
const MAX_TEMPO = 240;

function decodeRoot(encoded: string): string | null {
  const decoded = encoded.replace("s", "#");
  if (!/^[A-G]#?$/.test(decoded)) return null;
  return decoded;
}

function decodeScale(encoded: string): string {
  return encoded.replace(/\+/g, " ");
}

function decodeTimeSignature(encoded: string): { numerator: number; denominator: number } | null {
  const match = encoded.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (numerator < 1 || numerator > 16 || ![1, 2, 4, 8, 16].includes(denominator)) return null;
  return { numerator, denominator };
}

function decodeStep(token: string): ShareState["steps"][number] | null {
  const match = token.match(/^([ivIV]+)(?::([A-Za-z0-9]+))?(?:\*(\d+)(bt|b))?$/);
  if (!match) return null;
  const [, degree, quality, durationValue, durationUnit] = match;
  return {
    degree,
    qualityOverride: quality ?? null,
    duration: durationValue
      ? { value: Number(durationValue), unit: durationUnit === "bt" ? "beat" : "bar" }
      : { value: 1, unit: "bar" },
  };
}

export function decodeShareState(param: string): ShareState | null {
  if (!param) return null;
  const parts = param.split(".");
  if (parts.length < 5) return null;

  const root = decodeRoot(parts[0]);
  if (!root) return null;

  const scale = decodeScale(parts[1]);

  const tempo = Number(parts[2]);
  if (!Number.isFinite(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO) return null;

  const timeSignature = decodeTimeSignature(parts[3]);
  if (!timeSignature) return null;

  // Rejoin remaining parts in case scale name contained dots (unlikely but defensive)
  const chordsStr = parts.slice(4).join(".");
  const chordTokens = chordsStr.split("-").filter(Boolean);
  if (chordTokens.length === 0) return null;

  const steps: ShareState["steps"] = [];
  for (const token of chordTokens) {
    const step = decodeStep(token);
    if (!step) return null;
    steps.push(step);
  }

  return { root, scale, tempo: Math.round(tempo), timeSignature, steps };
}

export function encodeShareState(state: ShareState): string {
  const root = encodeRoot(state.root);
  const scale = encodeScale(state.scale);
  const ts = `${state.timeSignature.numerator}x${state.timeSignature.denominator}`;
  const chords = state.steps.map(encodeStep).join("-");
  return `${root}.${scale}.${state.tempo}.${ts}.${chords}`;
}

const MAX_S_PARAM_LENGTH = 1500;

export function encodeShareUrl(state: ShareState, baseUrl: string): string {
  const encoded = encodeShareState(state);
  const url = new URL(baseUrl);
  if (encoded.length <= MAX_S_PARAM_LENGTH) {
    url.searchParams.set("s", encoded);
  } else {
    const json = JSON.stringify(state);
    url.searchParams.set("z", compressToEncodedURIComponent(json));
  }
  return url.toString();
}

export function decodeShareUrl(params: URLSearchParams): ShareState | null {
  const s = params.get("s");
  if (s) return decodeShareState(s);

  const z = params.get("z");
  if (z) {
    try {
      const json = decompressFromEncodedURIComponent(z);
      if (!json) return null;
      const parsed = JSON.parse(json) as ShareState;
      // Validate structure minimally
      if (!parsed.root || !parsed.scale || !parsed.steps?.length) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}
