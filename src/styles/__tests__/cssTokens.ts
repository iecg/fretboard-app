import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse, converter } from "culori";

// Theme tokens are split across the app's themes.css and the fretboard
// package's own token stylesheet (fretboard-specific tokens — --fb-*,
// --chord-connector-*, wood/wire/etc. — were extracted into the package so it
// is self-contained for styling). readThemeBlock() merges the `[data-theme]`
// block from every source so every token resolves regardless of which file
// owns it.
const THEME_SOURCES = [
  new URL("../themes.css", import.meta.url),
  new URL(
    "../../../packages/fretboard/src/styles/fretboard-tokens.css",
    import.meta.url,
  ),
].map((u) => fileURLToPath(u));

/** Parse the `[data-theme="<theme>"] { ... }` block from one CSS file into a
 *  {token: value} map. Returns {} if the file has no such block. */
function readThemeBlockFromFile(
  file: string,
  theme: string,
): Record<string, string> {
  const css = readFileSync(file, "utf8");
  const head = `[data-theme="${theme}"] {`;
  const start = css.indexOf(head);
  if (start === -1) return {};
  // Match to the first top-level closing brace of this block.
  let depth = 0;
  let i = start + head.length - 1;
  const bodyStart = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = css.slice(bodyStart, i);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** Merge the `[data-theme="<theme>"]` token maps across all theme sources
 *  (app themes.css + the @fretflow/fretboard token file). Each token is defined
 *  in exactly one source, so the merge is conflict-free. */
export function readThemeBlock(theme: string): Record<string, string> {
  const out: Record<string, string> = {};
  let found = false;
  for (const file of THEME_SOURCES) {
    const block = readThemeBlockFromFile(file, theme);
    if (Object.keys(block).length > 0) found = true;
    Object.assign(out, block);
  }
  if (!found) throw new Error(`theme block not found: ${theme}`);
  return out;
}

/** Resolve a single `var(--x)` (one hop) against a token map; returns input unchanged if not a bare var(). */
export function resolveVar(value: string, map: Record<string, string>): string {
  const m = value.match(/^var\((--[\w-]+)\)$/);
  if (!m) return value;
  const resolved = map[m[1]];
  return resolved !== undefined ? resolved.trim() : value;
}

const toRgb = converter("rgb");

/**
 * APCA-W3 0.1.9 lightness contrast (Lc). Positive ⇒ light-mode polarity
 * (dark text on light bg); negative ⇒ dark-mode polarity. Magnitude is the
 * perceptual contrast. Public, stable formula — see apcacontrast.com.
 */
export function contrastAPCA(textColor: string, bgColor: string): number {
  const lum = (hex: string): number => {
    const c = toRgb(parse(hex));
    if (!c) throw new Error(`unparseable color: ${hex}`);
    const lin = (v: number) => Math.pow(v, 2.4);
    return 0.2126729 * lin(c.r) + 0.7151522 * lin(c.g) + 0.072175 * lin(c.b);
  };
  let Ytxt = lum(textColor);
  let Ybg = lum(bgColor);
  const Yclamp = (Y: number) => (Y > 0.022 ? Y : Y + Math.pow(0.022 - Y, 1.414));
  Ytxt = Yclamp(Ytxt);
  Ybg = Yclamp(Ybg);
  if (Math.abs(Ybg - Ytxt) < 0.0005) return 0;
  let Sapc: number;
  let outputContrast: number;
  if (Ybg > Ytxt) {
    Sapc = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * 1.14;
    outputContrast = Sapc < 0.001 ? 0 : Sapc - 0.027;
  } else {
    Sapc = (Math.pow(Ybg, 0.65) - Math.pow(Ytxt, 0.62)) * 1.14;
    outputContrast = Sapc > -0.001 ? 0 : Sapc + 0.027;
  }
  return outputContrast * 100;
}
