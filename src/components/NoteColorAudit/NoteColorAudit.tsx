import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";
import useLayoutMode from "../../hooks/useLayoutMode";
import { getNoteVisuals } from "../FretboardSVG/utils/semantics";
import fretboardStyles from "../FretboardSVG/FretboardSVG.module.css";
import practiceStyles from "../ChordPracticeBar/ChordPracticeBar.module.css";
import degreeStyles from "../DegreeChipStrip/DegreeChipStrip.module.css";
import styles from "./NoteColorAudit.module.css";
import {
  AUDIT_DEGREE_COLOR,
  AUDIT_DEGREE_ID,
  AUDIT_DEGREE_MODES,
  AUDIT_THEMES,
  CAGED_SHAPE_SWATCHES,
  DEGREE_RAMP_SWATCHES,
  FRETBOARD_AUDIT_GROUPS,
  getAuditId,
  getDegreeChipSwatchesForDegreeMode,
  getFretboardAuditSwatchesForDegreeMode,
  getPracticePillSwatchesForDegreeMode,
  type AuditDegreeMode,
  type AuditLens,
  type AuditTheme,
  type CagedShapeAuditSwatch,
  type DegreeChipAuditSwatch,
  type DegreeRampAuditSwatch,
  type FretboardAuditSwatch,
  type PracticePillAuditSwatch,
} from "./noteColorAuditFixtures";

type ComputedAuditStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
  strokeDasharray?: string;
  opacity?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: string;
  beforeBackgroundColor?: string;
  labelColor?: string;
  labelShadow?: string;
  textFill?: string;
  textStroke?: string;
  textStrokeWidth?: string;
  labelContrast?: string;
  ringContrast?: string;
};

type MeasurementKind = "svg-note" | "box";

type ParsedColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const OPAQUE_WHITE: ParsedColor = { r: 255, g: 255, b: 255, a: 1 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseAlpha(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;
  if (raw.endsWith("%")) {
    const value = Number.parseFloat(raw.slice(0, -1));
    if (!Number.isFinite(value)) return null;
    return clamp(value / 100, 0, 1);
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  return clamp(value, 0, 1);
}

function parseRgbChannel(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;
  if (raw.endsWith("%")) {
    const value = Number.parseFloat(raw.slice(0, -1));
    if (!Number.isFinite(value)) return null;
    return clamp((value / 100) * 255, 0, 255);
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  return clamp(value, 0, 255);
}

function parseSrgbChannel(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;
  if (raw.endsWith("%")) {
    const value = Number.parseFloat(raw.slice(0, -1));
    if (!Number.isFinite(value)) return null;
    return clamp((value / 100) * 255, 0, 255);
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  const normalized = value > 1 ? value / 255 : value;
  return clamp(normalized * 255, 0, 255);
}

function parseHexColor(value: string): ParsedColor | null {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) return null;
  const expanded = hex.length <= 4
    ? hex
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : hex;
  const bytes = expanded.match(/../g);
  if (!bytes) return null;
  const numbers = bytes.map((part) => Number.parseInt(part, 16));
  if (numbers.some((number) => Number.isNaN(number))) return null;

  const [r, g, b, alpha = 255] = numbers;
  return { r, g, b, a: clamp(alpha / 255, 0, 1) };
}

function parseColor(value: string | undefined): ParsedColor | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "none") return null;
  if (raw === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (raw.startsWith("#")) return parseHexColor(raw);

  const rgbMatch = raw.match(/^rgba?\((.+)\)$/i);
  if (rgbMatch) {
    const [colorPart, alphaPart] = rgbMatch[1].split("/");
    const tokens = colorPart.includes(",")
      ? colorPart.split(",").map((token) => token.trim()).filter(Boolean)
      : colorPart.trim().split(/\s+/);
    if (tokens.length < 3) return null;
    const channels = tokens.slice(0, 3).map(parseRgbChannel);
    if (channels.some((channel) => channel === null)) return null;
    const alphaToken = alphaPart
      ? alphaPart.trim()
      : tokens[3];
    const alpha = alphaToken ? parseAlpha(alphaToken) : 1;
    if (alpha === null) return null;
    return { r: channels[0]!, g: channels[1]!, b: channels[2]!, a: alpha };
  }

  const srgbMatch = raw.match(/^color\(srgb\s+(.+)\)$/i);
  if (srgbMatch) {
    const [colorPart, alphaPart] = srgbMatch[1].split("/");
    const tokens = colorPart.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 3) return null;
    const channels = tokens.slice(0, 3).map(parseSrgbChannel);
    if (channels.some((channel) => channel === null)) return null;
    const alpha = alphaPart ? parseAlpha(alphaPart.trim()) : 1;
    if (alpha === null) return null;
    return { r: channels[0]!, g: channels[1]!, b: channels[2]!, a: alpha };
  }

  return null;
}

function blendOver(foreground: ParsedColor, background: ParsedColor): ParsedColor {
  const alpha = clamp(foreground.a, 0, 1);
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

function toOpaque(color: ParsedColor): ParsedColor {
  if (color.a >= 1) return { ...color, a: 1 };
  return blendOver(color, OPAQUE_WHITE);
}

function toLinear(channel: number) {
  const normalized = channel / 255;
  if (normalized <= 0.04045) return normalized / 12.92;
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(color: ParsedColor) {
  return (
    0.2126 * toLinear(color.r) +
    0.7152 * toLinear(color.g) +
    0.0722 * toLinear(color.b)
  );
}

function resolveThemeBaseColor(element: Element): ParsedColor {
  const themedScope = element.closest("[data-theme]") ?? document.documentElement;
  const token = getComputedStyle(themedScope).getPropertyValue("--bg-color").trim();
  const tokenColor = parseColor(token);
  if (tokenColor) return toOpaque(tokenColor);
  return OPAQUE_WHITE;
}

function resolveBackdropColor(element: Element): ParsedColor {
  const stack: Element[] = [];
  let current: Element | null = element.parentElement;
  while (current) {
    stack.push(current);
    current = current.parentElement;
  }
  stack.reverse();

  let backdrop = resolveThemeBaseColor(element);
  for (const layer of stack) {
    const layerColor = parseColor(getComputedStyle(layer).getPropertyValue("background-color"));
    if (!layerColor || layerColor.a === 0) continue;
    backdrop = blendOver(layerColor, backdrop);
  }

  return backdrop;
}

function resolveLayerColor(layerRaw: string | undefined, backdrop: ParsedColor): ParsedColor | null {
  const layer = parseColor(layerRaw);
  if (!layer) return null;
  return toOpaque(layer.a < 1 ? blendOver(layer, backdrop) : { ...layer, a: 1 });
}

function calculateContrastRatioFromColors(
  foregroundRaw: string | undefined,
  background: ParsedColor | null,
) {
  if (!background) return null;
  const foreground = parseColor(foregroundRaw);
  if (!foreground) return null;

  const opaqueBackground = toOpaque(background);
  const opaqueForeground = toOpaque(
    foreground.a < 1 ? blendOver(foreground, opaqueBackground) : { ...foreground, a: 1 },
  );

  const luminanceA = getRelativeLuminance(opaqueForeground);
  const luminanceB = getRelativeLuminance(opaqueBackground);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function formatContrast(
  ratio: number | null,
  thresholds: { pass: number; warn: number },
) {
  if (ratio === null) return undefined;
  const status = ratio >= thresholds.pass ? "pass" : ratio >= thresholds.warn ? "warn" : "fail";
  return `${status} ${ratio.toFixed(2)}:1`;
}

function readStyle(
  element: Element,
  kind: MeasurementKind,
  opacityElement?: Element | null,
  labelElement?: Element | null,
  includeBefore = false,
): ComputedAuditStyle {
  const computed = getComputedStyle(element);
  const opacityComputed = opacityElement ? getComputedStyle(opacityElement) : computed;
  const labelComputed = labelElement ? getComputedStyle(labelElement) : undefined;
  const backdrop = resolveBackdropColor(element);

  if (kind === "svg-note") {
    const fillLayer = resolveLayerColor(computed.getPropertyValue("fill"), backdrop);
    const labelContrast = formatContrast(
      calculateContrastRatioFromColors(labelComputed?.getPropertyValue("fill"), fillLayer),
      { pass: 4.5, warn: 3 },
    );
    const ringContrast = formatContrast(
      calculateContrastRatioFromColors(computed.getPropertyValue("stroke"), fillLayer),
      { pass: 3, warn: 2 },
    );

    return {
      fill: computed.getPropertyValue("fill"),
      stroke: computed.getPropertyValue("stroke"),
      strokeWidth: computed.getPropertyValue("stroke-width"),
      strokeDasharray: computed.getPropertyValue("stroke-dasharray"),
      opacity: opacityComputed.getPropertyValue("opacity"),
      textFill: labelComputed?.getPropertyValue("fill"),
      textStroke: labelComputed?.getPropertyValue("stroke"),
      textStrokeWidth: labelComputed?.getPropertyValue("stroke-width"),
      labelContrast,
      ringContrast,
    };
  }

  const before = includeBefore
    ? getComputedStyle(element, "::before").getPropertyValue("background-color")
    : undefined;
  const elementSurface = resolveLayerColor(computed.getPropertyValue("background-color"), backdrop);
  const labelBackground = includeBefore
    ? resolveLayerColor(before, elementSurface ?? backdrop)
    : elementSurface;
  const labelContrast = formatContrast(
    calculateContrastRatioFromColors(labelComputed?.getPropertyValue("color"), labelBackground),
    { pass: 4.5, warn: 3 },
  );
  const ringContrast = formatContrast(
    calculateContrastRatioFromColors(computed.getPropertyValue("border-color"), elementSurface),
    { pass: 3, warn: 2 },
  );

  return {
    backgroundColor: computed.getPropertyValue("background-color"),
    borderColor: computed.getPropertyValue("border-color"),
    borderWidth: computed.getPropertyValue("border-width"),
    borderStyle: computed.getPropertyValue("border-style"),
    opacity: opacityComputed.getPropertyValue("opacity"),
    beforeBackgroundColor: before,
    labelColor: labelComputed?.getPropertyValue("color"),
    labelShadow: labelComputed?.getPropertyValue("text-shadow"),
    labelContrast,
    ringContrast,
  };
}

function useComputedAuditStyle(
  auditId: string,
  kind: MeasurementKind,
  targetRef: React.RefObject<Element | null>,
  opacityRef?: React.RefObject<Element | null>,
  labelRef?: React.RefObject<Element | null>,
  includeBefore = false,
) {
  const [computed, setComputed] = useState<ComputedAuditStyle | null>(null);

  useLayoutEffect(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const target = targetRef.current;
      if (!target) return;
      setComputed(readStyle(target, kind, opacityRef?.current, labelRef?.current, includeBefore));
    };

    firstFrame = requestAnimationFrame(() => {
      measure();
      secondFrame = requestAnimationFrame(measure);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [auditId, includeBefore, kind, labelRef, opacityRef, targetRef]);

  return computed;
}

function StyleReadout({
  computed,
  fields,
}: {
  computed: ComputedAuditStyle | null;
  fields: readonly (keyof ComputedAuditStyle)[];
}) {
  const labels: Record<keyof ComputedAuditStyle, string> = {
    fill: "fill",
    stroke: "stroke",
    strokeWidth: "stroke-w",
    strokeDasharray: "dash",
    opacity: "opacity",
    backgroundColor: "bg",
    borderColor: "border",
    borderWidth: "b-width",
    borderStyle: "b-style",
    beforeBackgroundColor: "::before bg",
    labelColor: "label",
    labelShadow: "label shadow",
    textFill: "text fill",
    textStroke: "text stroke",
    textStrokeWidth: "text s-w",
    labelContrast: "label ctr",
    ringContrast: "ring ctr",
  };

  return (
    <dl className={styles.readout}>
      {fields.map((field) => (
        <div key={field}>
          <dt>{labels[field]}</dt>
          <dd>
            {computed == null || !(field in computed)
              ? "pending"
              : computed[field]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SwatchCard({
  label,
  auditId,
  children,
  readout,
}: {
  label: string;
  auditId: string;
  children: ReactNode;
  readout: ReactNode;
}) {
  return (
    <article className={styles["swatch-card"]} data-audit-id={auditId}>
      <span className={styles["swatch-label"]}>{label}</span>
      <div className={styles["swatch-stage"]}>{children}</div>
      {readout}
    </article>
  );
}

function FretboardShape({
  swatch,
  shapeRef,
}: {
  swatch: FretboardAuditSwatch;
  shapeRef: (element: SVGGraphicsElement | null) => void;
}) {
  const { radiusScale, noteShape } = getNoteVisuals(swatch.noteClass);
  const cx = 30;
  const cy = 30;
  const r = 13 * radiusScale;

  if (noteShape === "squircle") {
    return (
      <>
        {swatch.noteClass === "chord-root" && (
          <rect
            x={cx - r - 3.5}
            y={cy - r - 3.5}
            width={(r + 3.5) * 2}
            height={(r + 3.5) * 2}
            rx={(r + 3.5) * 0.38}
            ry={(r + 3.5) * 0.38}
            style={{
              fill: "none",
              stroke: swatch.isTension
                ? "var(--neon-orange-dim)"
                : "color-mix(in srgb, var(--neon-orange) 22%, transparent)",
              strokeWidth: swatch.isTension ? 1.8 : 1.5,
              strokeDasharray: swatch.isTension ? "6 3" : undefined,
              paintOrder: "stroke",
            }}
          />
        )}
        <rect
          ref={shapeRef}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          rx={r * 0.38}
          ry={r * 0.38}
        />
      </>
    );
  }

  if (noteShape === "diamond") {
    return (
      <polygon
        ref={shapeRef}
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      />
    );
  }

  if (noteShape === "hexagon") {
    return (
      <polygon
        ref={shapeRef}
        points={Array.from({ length: 6 }, (_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(" ")}
      />
    );
  }

  return <circle ref={shapeRef} cx={cx} cy={cy} r={r} />;
}

function FretboardNoteCard({
  swatch,
  theme,
  context,
  degreeMode,
}: {
  swatch: FretboardAuditSwatch;
  theme: AuditTheme;
  context: AuditLens;
  degreeMode: AuditDegreeMode;
}) {
  const targetRef = useRef<SVGGraphicsElement | null>(null);
  const opacityRef = useRef<SVGGElement | null>(null);
  const labelRef = useRef<SVGTextElement | null>(null);
  const shapeRef = useCallback((element: SVGGraphicsElement | null) => {
    targetRef.current = element;
  }, []);
  const auditId = getAuditId(theme, "fretboard", context.id, degreeMode, swatch.id);
  const usesDegreeColor = degreeMode.enabled && swatch.degreeColorEligible;
  const { radiusScale } = getNoteVisuals(swatch.noteClass);
  const noteRadius = 13 * radiusScale;
  const computed = useComputedAuditStyle(auditId, "svg-note", targetRef, opacityRef, labelRef);

  return (
    <SwatchCard
      label={swatch.label}
      auditId={auditId}
      readout={
        <StyleReadout
          computed={computed}
          fields={[
            "fill",
            "stroke",
            "strokeWidth",
            "strokeDasharray",
            "opacity",
            "textFill",
            "textStroke",
            "textStrokeWidth",
            "labelContrast",
            "ringContrast",
          ]}
        />
      }
    >
      <div
        className={clsx(fretboardStyles["fretboard-board"], styles["fretboard-frame"])}
        data-practice-lens={context.dataPracticeLens}
        data-degree-colors={degreeMode.enabled ? "true" : undefined}
      >
        <div className={styles["fretboard-scope"]}>
          <svg className={styles["fretboard-svg"]} width="60" height="60" aria-hidden="true">
            <g
              ref={opacityRef}
              className={clsx(
                fretboardStyles["fretboard-note"],
                fretboardStyles[swatch.noteClass],
              )}
              data-note-role={swatch.noteClass}
              data-note-tension={swatch.isTension || undefined}
              data-note-guide-tone={swatch.isGuideTone || undefined}
              data-scale-degree={usesDegreeColor ? AUDIT_DEGREE_ID : undefined}
              data-degree-colors={usesDegreeColor ? "true" : undefined}
              style={
                {
                  "--note-r": String(noteRadius),
                  "--degree-color": AUDIT_DEGREE_COLOR,
                } as CSSProperties
              }
            >
              <FretboardShape swatch={swatch} shapeRef={shapeRef} />
              <text ref={labelRef} x="30" y="30">
                {swatch.display}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </SwatchCard>
  );
}

function PracticePillCard({
  swatch,
  theme,
  degreeMode,
}: {
  swatch: PracticePillAuditSwatch;
  theme: AuditTheme;
  degreeMode: AuditDegreeMode;
}) {
  const targetRef = useRef<HTMLButtonElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const auditId = getAuditId(theme, "practice-pill", "none", degreeMode, swatch.id);
  const usesDegreeColor = degreeMode.enabled && swatch.degreeColorEligible;
  const computed = useComputedAuditStyle(
    auditId,
    "box",
    targetRef,
    undefined,
    labelRef,
  );

  return (
    <SwatchCard
      label={swatch.label}
      auditId={auditId}
      readout={
        <StyleReadout
          computed={computed}
          fields={[
            "backgroundColor",
            "borderColor",
            "borderWidth",
            "borderStyle",
            "opacity",
            "labelColor",
            "labelShadow",
            "labelContrast",
            "ringContrast",
          ]}
        />
      }
    >
      <div
        className={clsx(practiceStyles["chord-practice-bar"], styles["practice-scope"])}
        data-degree-colors={degreeMode.enabled ? "true" : undefined}
        aria-label={`${theme.label} ${degreeMode.label} ${swatch.label} practice pill audit`}
      >
        <button
          ref={targetRef}
          type="button"
          className={practiceStyles["practice-bar-pill"]}
          tabIndex={-1}
          data-chord-root={swatch.isChordRoot ? "true" : undefined}
          data-guide-tone={swatch.isGuideTone ? "true" : undefined}
          data-tension={swatch.isTension ? "true" : undefined}
          data-in-scale={swatch.isInScale ? "true" : undefined}
          data-scale-degree={usesDegreeColor ? AUDIT_DEGREE_ID : undefined}
          data-hidden-note={swatch.isHidden ? "true" : undefined}
          style={{ "--degree-color": AUDIT_DEGREE_COLOR } as CSSProperties}
        >
          <span ref={labelRef} className={practiceStyles["practice-bar-pill-note"]}>
            {swatch.display}
          </span>
          {swatch.interval && (
            <span className={practiceStyles["practice-bar-pill-interval"]}>
              {swatch.interval}
            </span>
          )}
        </button>
      </div>
    </SwatchCard>
  );
}

function DegreeChipCard({
  swatch,
  theme,
  degreeMode,
}: {
  swatch: DegreeChipAuditSwatch;
  theme: AuditTheme;
  degreeMode: AuditDegreeMode;
}) {
  const targetRef = useRef<HTMLButtonElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const auditId = getAuditId(theme, "degree-chip", "none", degreeMode, swatch.id);
  const usesDegreeColor = degreeMode.enabled && swatch.degreeColorEligible;
  const computed = useComputedAuditStyle(
    auditId,
    "box",
    targetRef,
    undefined,
    labelRef,
    swatch.isColorNote,
  );

  return (
    <SwatchCard
      label={swatch.label}
      auditId={auditId}
      readout={
        <StyleReadout
          computed={computed}
          fields={[
            "backgroundColor",
            "borderColor",
            "borderWidth",
            "borderStyle",
            "opacity",
            "labelColor",
            "labelShadow",
            "labelContrast",
            "ringContrast",
            ...(swatch.isColorNote ? (["beforeBackgroundColor"] as const) : []),
          ]}
        />
      }
    >
      <div
        className={clsx(degreeStyles["degree-chip-strip"], styles["degree-scope"])}
        data-degree-colors={degreeMode.enabled ? "true" : undefined}
        aria-label={`${theme.label} ${swatch.label} degree chip audit`}
      >
        <ul className={clsx(degreeStyles["degree-chip-strip-list"], styles["degree-list-single"])}>
          <li
            className={degreeStyles["degree-chip-item"]}
            data-in-scale={swatch.inScale ? "true" : undefined}
            data-is-tonic={swatch.isTonic ? "true" : undefined}
            data-hidden={swatch.isHidden ? "true" : undefined}
            data-is-color-note={swatch.isColorNote ? "true" : undefined}
            data-scale-degree={usesDegreeColor ? AUDIT_DEGREE_ID : undefined}
            style={{ "--degree-color": AUDIT_DEGREE_COLOR } as CSSProperties}
          >
            <button
              ref={targetRef}
              type="button"
              className={degreeStyles["degree-chip"]}
              tabIndex={-1}
            >
              <span ref={labelRef} className={degreeStyles["degree-chip-note"]}>
                {swatch.display}
              </span>
            </button>
            <span className={degreeStyles["degree-chip-interval"]}>{swatch.interval}</span>
          </li>
        </ul>
      </div>
    </SwatchCard>
  );
}

function DegreeRampCard({
  swatch,
  theme,
}: {
  swatch: DegreeRampAuditSwatch;
  theme: AuditTheme;
}) {
  const targetRef = useRef<HTMLButtonElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const auditId = getAuditId(theme, "degree-ramp", "none", AUDIT_DEGREE_MODES[1], swatch.id);
  const computed = useComputedAuditStyle(
    auditId,
    "box",
    targetRef,
    undefined,
    labelRef,
    swatch.isColorNote,
  );

  return (
    <SwatchCard
      label={swatch.label}
      auditId={auditId}
      readout={
        <StyleReadout
          computed={computed}
          fields={[
            "backgroundColor",
            "borderColor",
            "borderWidth",
            "borderStyle",
            "opacity",
            "labelColor",
            "labelShadow",
            "labelContrast",
            "ringContrast",
            ...(swatch.isColorNote ? (["beforeBackgroundColor"] as const) : []),
          ]}
        />
      }
    >
      <div
        className={clsx(degreeStyles["degree-chip-strip"], styles["degree-scope"])}
        data-degree-colors="true"
        aria-label={`${theme.label} ${swatch.label} degree ramp audit`}
      >
        <ul className={clsx(degreeStyles["degree-chip-strip-list"], styles["degree-list-single"])}>
          <li
            className={degreeStyles["degree-chip-item"]}
            data-in-scale="true"
            data-is-tonic={swatch.isTonic ? "true" : undefined}
            data-is-color-note={swatch.isColorNote ? "true" : undefined}
            data-scale-degree={swatch.degreeId}
            style={{ "--degree-color": swatch.degreeColor } as CSSProperties}
          >
            <button
              ref={targetRef}
              type="button"
              className={degreeStyles["degree-chip"]}
              tabIndex={-1}
            >
              <span ref={labelRef} className={degreeStyles["degree-chip-note"]}>
                {swatch.display}
              </span>
            </button>
            <span className={degreeStyles["degree-chip-interval"]}>{swatch.interval}</span>
          </li>
        </ul>
      </div>
    </SwatchCard>
  );
}

function FretboardAuditMatrix({ theme }: { theme: AuditTheme }) {
  return (
    <section className={styles["audit-section"]}>
      <h3 className={styles["section-title"]}>Fretboard SVG Notes</h3>
      {FRETBOARD_AUDIT_GROUPS.map((context) => (
        <section key={context.id} className={styles["audit-group"]}>
          <h4 className={styles["group-title"]}>{context.label}</h4>
          <div className={styles["degree-grid"]}>
            {AUDIT_DEGREE_MODES.map((degreeMode) => {
              const swatches = getFretboardAuditSwatchesForDegreeMode(context, degreeMode);
              if (swatches.length === 0) return null;

              return (
                <div key={degreeMode.id} className={styles["degree-column"]}>
                  <h5 className={styles["degree-title"]}>{degreeMode.label}</h5>
                  <div className={styles["swatch-grid"]}>
                    {swatches.map((swatch) => (
                      <FretboardNoteCard
                        key={swatch.id}
                        swatch={swatch}
                        theme={theme}
                        context={context}
                        degreeMode={degreeMode}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

function PracticePillAuditMatrix({ theme }: { theme: AuditTheme }) {
  return (
    <section className={styles["audit-section"]}>
      <h3 className={styles["section-title"]}>Chord Practice Bar Pills</h3>
      <div className={styles["degree-grid"]}>
        {AUDIT_DEGREE_MODES.map((degreeMode) => {
          const swatches = getPracticePillSwatchesForDegreeMode(degreeMode);
          if (swatches.length === 0) return null;

          return (
            <div key={degreeMode.id} className={styles["degree-column"]}>
              <h4 className={styles["degree-title"]}>{degreeMode.label}</h4>
              <div className={styles["swatch-grid"]}>
                {swatches.map((swatch) => (
                  <PracticePillCard
                    key={swatch.id}
                    swatch={swatch}
                    theme={theme}
                    degreeMode={degreeMode}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DegreeChipAuditMatrix({ theme }: { theme: AuditTheme }) {
  return (
    <section className={styles["audit-section"]}>
      <h3 className={styles["section-title"]}>Degree Chip Strip</h3>
      <div className={styles["degree-grid"]}>
        {AUDIT_DEGREE_MODES.map((degreeMode) => {
          const swatches = getDegreeChipSwatchesForDegreeMode(degreeMode);
          if (swatches.length === 0) return null;

          return (
            <div key={degreeMode.id} className={styles["degree-column"]}>
              <h4 className={styles["degree-title"]}>{degreeMode.label}</h4>
              <div className={styles["swatch-grid"]}>
                {swatches.map((swatch) => (
                  <DegreeChipCard
                    key={swatch.id}
                    swatch={swatch}
                    theme={theme}
                    degreeMode={degreeMode}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DegreeRampAuditMatrix({ theme }: { theme: AuditTheme }) {
  return (
    <section className={styles["audit-section"]}>
      <h3 className={styles["section-title"]}>Degree Color Ramp</h3>
      <div className={styles["degree-ramp-grid"]}>
        {DEGREE_RAMP_SWATCHES.map((swatch) => (
          <DegreeRampCard key={swatch.id} swatch={swatch} theme={theme} />
        ))}
      </div>
    </section>
  );
}

function CagedShapeNoteCard({
  swatch,
  theme,
}: {
  swatch: CagedShapeAuditSwatch;
  theme: AuditTheme;
}) {
  const targetRef = useRef<SVGGraphicsElement | null>(null);
  const opacityRef = useRef<SVGGElement | null>(null);
  const labelRef = useRef<SVGTextElement | null>(null);
  const shapeRef = useCallback((element: SVGGraphicsElement | null) => {
    targetRef.current = element;
  }, []);
  const auditId = getAuditId(theme, "caged-shape", "none", AUDIT_DEGREE_MODES[0], swatch.id);
  const { radiusScale } = getNoteVisuals(swatch.noteClass);
  const noteRadius = 13 * radiusScale;
  const computed = useComputedAuditStyle(auditId, "svg-note", targetRef, opacityRef, labelRef);

  const fretboardSwatch: FretboardAuditSwatch = {
    id: swatch.id,
    label: swatch.label,
    noteClass: swatch.noteClass,
    display: swatch.display,
  };

  return (
    <SwatchCard
      label={swatch.label}
      auditId={auditId}
      readout={
        <StyleReadout
          computed={computed}
          fields={[
            "fill",
            "stroke",
            "strokeWidth",
            "opacity",
            "textFill",
            "labelContrast",
            "ringContrast",
          ]}
        />
      }
    >
      <div
        className={clsx(fretboardStyles["fretboard-board"], styles["fretboard-frame"])}
        data-full-chord-mode="true"
      >
        <div className={styles["fretboard-scope"]}>
          <svg className={styles["fretboard-svg"]} width="60" height="60" aria-hidden="true">
            <g
              ref={opacityRef}
              className={clsx(
                fretboardStyles["fretboard-note"],
                fretboardStyles[swatch.noteClass],
              )}
              data-note-role={swatch.noteClass}
              data-full-chord-shape={swatch.shapeKey}
              style={{ "--note-r": String(noteRadius) } as CSSProperties}
            >
              <FretboardShape swatch={fretboardSwatch} shapeRef={shapeRef} />
              <text ref={labelRef} x="30" y="30">
                {swatch.display}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </SwatchCard>
  );
}

function CagedShapeAuditMatrix({ theme }: { theme: AuditTheme }) {
  return (
    <section className={styles["audit-section"]}>
      <h3 className={styles["section-title"]}>Full-Chord CAGED Shapes</h3>
      <div className={styles["degree-ramp-grid"]}>
        {CAGED_SHAPE_SWATCHES.map((swatch) => (
          <CagedShapeNoteCard key={swatch.id} swatch={swatch} theme={theme} />
        ))}
      </div>
    </section>
  );
}

export function NoteColorAudit() {
  const layout = useLayoutMode();

  return (
    <main
      className={styles["note-color-audit"]}
      data-testid="note-color-audit"
      data-layout-tier={layout.tier}
      data-layout-variant={layout.variant}
    >
      <header className={styles["audit-header"]}>
        <h1 className={styles["audit-title"]}>Note Color Audit Matrix</h1>
        <p className={styles["audit-subtitle"]}>
          Fill, ring, stroke width, stroke style, label styling, and contrast metrics are
          read from computed browser styles for each rendered state.
        </p>
      </header>
      <div className={styles["theme-grid"]}>
        {AUDIT_THEMES.map((theme) => (
          <section
            key={theme.id}
            className={styles["theme-panel"]}
            data-theme={theme.dataTheme}
            aria-label={`${theme.label} theme audit`}
          >
            <h2 className={styles["theme-title"]}>{theme.label}</h2>
            <FretboardAuditMatrix theme={theme} />
            <PracticePillAuditMatrix theme={theme} />
            <DegreeChipAuditMatrix theme={theme} />
            <DegreeRampAuditMatrix theme={theme} />
            <CagedShapeAuditMatrix theme={theme} />
          </section>
        ))}
      </div>
    </main>
  );
}
