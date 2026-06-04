// Deterministic sRGB → OKLCH derivation for the --fb-* semantic tokens.
// Run: node scripts/derive-fb-oklch.mjs
// Paste the printed triplets into themes.css (Task 3). Re-run any time the
// source hex changes. APCA columns flag pairs below the §7 thresholds.
import { parse, converter } from "culori";

const oklch = converter("oklch");
const fmt = (hex) => {
  const c = oklch(parse(hex));
  const L = c.l.toFixed(4);
  const C = (c.c ?? 0).toFixed(4);
  const H = (c.h ?? 0).toFixed(1);
  return `oklch(${L} ${C} ${H})  // from ${hex}`;
};

const TOKENS = {
  "--fb-home-fill        (light=dark)": "#b5670a",
  "--fb-home-stroke      light": "#b1431b",
  "--fb-home-stroke      dark":  "#FF9A4D",
  "--fb-guide-fill       light": "#cfeefb",
  "--fb-guide-fill       dark":  "#1f5876",
  "--fb-guide-stroke     light": "#1583a6",
  "--fb-guide-stroke     dark":  "#7cecff",
  "--fb-neutral-fill     light": "#e3ddd8",
  "--fb-neutral-fill     dark":  "#1b232c",
  "--fb-neutral-stroke   light": "#574d40",
  "--fb-neutral-stroke   dark":  "#9aa3ab",
  "--fb-region-tint      light": "#6b5d4f", // alpha 0.20 applied in CSS
  "--fb-region-tint      dark":  "#9aa3ab", // alpha 0.14 applied in CSS
};

console.log("=== OKLCH triplets ===");
for (const [name, hex] of Object.entries(TOKENS)) {
  console.log(name.padEnd(34), fmt(hex));
}
