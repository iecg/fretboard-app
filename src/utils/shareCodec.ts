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

export function encodeShareState(state: ShareState): string {
  const root = encodeRoot(state.root);
  const scale = encodeScale(state.scale);
  const ts = `${state.timeSignature.numerator}x${state.timeSignature.denominator}`;
  const chords = state.steps.map(encodeStep).join("-");
  return `${root}.${scale}.${state.tempo}.${ts}.${chords}`;
}
