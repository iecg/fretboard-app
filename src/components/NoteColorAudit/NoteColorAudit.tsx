import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { getNoteVisuals } from "../FretboardSVG/utils/semantics";
import fretboardStyles from "../FretboardSVG/FretboardSVG.module.css";
import practiceStyles from "../ChordPracticeBar/ChordPracticeBar.module.css";
import degreeStyles from "../DegreeChipStrip/DegreeChipStrip.module.css";
import chordRowStyles from "../ChordRowStrip/ChordRowStrip.module.css";
import styles from "./NoteColorAudit.module.css";
import {
  AUDIT_DEGREE_COLOR,
  AUDIT_DEGREE_ID,
  AUDIT_DEGREE_MODES,
  AUDIT_THEMES,
  CHORD_ROW_SWATCHES,
  DEGREE_RAMP_SWATCHES,
  FRETBOARD_AUDIT_GROUPS,
  getAuditId,
  getDegreeChipSwatchesForDegreeMode,
  getFretboardAuditSwatchesForDegreeMode,
  getPracticePillSwatchesForDegreeMode,
  type AuditDegreeMode,
  type AuditLens,
  type AuditTheme,
  type ChordRowAuditSwatch,
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
  textFill?: string;
  textStroke?: string;
};

type MeasurementKind = "svg-note" | "box";

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

  if (kind === "svg-note") {
    return {
      fill: computed.getPropertyValue("fill"),
      stroke: computed.getPropertyValue("stroke"),
      strokeWidth: computed.getPropertyValue("stroke-width"),
      strokeDasharray: computed.getPropertyValue("stroke-dasharray"),
      opacity: opacityComputed.getPropertyValue("opacity"),
      textFill: labelComputed?.getPropertyValue("fill"),
      textStroke: labelComputed?.getPropertyValue("stroke"),
    };
  }

  const before = includeBefore
    ? getComputedStyle(element, "::before").getPropertyValue("background-color")
    : undefined;

  return {
    backgroundColor: computed.getPropertyValue("background-color"),
    borderColor: computed.getPropertyValue("border-color"),
    borderWidth: computed.getPropertyValue("border-width"),
    borderStyle: computed.getPropertyValue("border-style"),
    opacity: opacityComputed.getPropertyValue("opacity"),
    beforeBackgroundColor: before,
    labelColor: labelComputed?.getPropertyValue("color"),
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
    textFill: "text fill",
    textStroke: "text stroke",
  };

  return (
    <dl className={styles.readout}>
      {fields.map((field) => (
        <div key={field}>
          <dt>{labels[field]}</dt>
          <dd>{computed?.[field] || "pending"}</dd>
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
          ]}
        />
      }
    >
      <section
        className={clsx(practiceStyles["chord-practice-bar"], styles["practice-scope"])}
        data-degree-colors={degreeMode.enabled ? "true" : undefined}
        aria-label={`${swatch.label} practice pill audit`}
      >
        <button
          ref={targetRef}
          type="button"
          className={practiceStyles["practice-bar-pill"]}
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
      </section>
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
            ...(swatch.isColorNote ? (["beforeBackgroundColor"] as const) : []),
          ]}
        />
      }
    >
      <section
        className={clsx(degreeStyles["degree-chip-strip"], styles["degree-scope"])}
        data-degree-colors={degreeMode.enabled ? "true" : undefined}
        aria-label={`${swatch.label} degree chip audit`}
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
            <button ref={targetRef} type="button" className={degreeStyles["degree-chip"]}>
              <span ref={labelRef} className={degreeStyles["degree-chip-note"]}>
                {swatch.display}
              </span>
            </button>
            <span className={degreeStyles["degree-chip-interval"]}>{swatch.interval}</span>
          </li>
        </ul>
      </section>
    </SwatchCard>
  );
}

function ChordRowCard({ swatch, theme }: { swatch: ChordRowAuditSwatch; theme: AuditTheme }) {
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const auditId = getAuditId(theme, "chord-row", "none", AUDIT_DEGREE_MODES[0], swatch.id);
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
            ...(swatch.kind === "chip" ? (["labelColor"] as const) : []),
          ]}
        />
      }
    >
      <section
        className={clsx(chordRowStyles["chord-row-strip"], styles["chord-row-scope"])}
        aria-label={`${swatch.label} chord row audit`}
      >
        {swatch.kind === "chip" ? (
          <ul className={clsx(chordRowStyles["chord-row-list"], styles["chord-row-list-single"])}>
            <li className={chordRowStyles["chord-row-item"]} data-role={swatch.role}>
              <span ref={targetRef} className={chordRowStyles["chord-row-chip"]}>
                <span ref={labelRef} className={chordRowStyles["chord-row-note"]}>
                  {swatch.display}
                </span>
              </span>
              {swatch.interval && (
                <span className={chordRowStyles["chord-row-interval"]}>{swatch.interval}</span>
              )}
            </li>
          </ul>
        ) : (
          <ul className={clsx(chordRowStyles["chord-row-legend"], styles["chord-row-legend-single"])}>
            <li className={chordRowStyles["chord-row-legend-item"]} data-role={swatch.role}>
              <span
                ref={targetRef}
                className={chordRowStyles["chord-row-legend-swatch"]}
                aria-hidden="true"
              />
            </li>
          </ul>
        )}
      </section>
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
            ...(swatch.isColorNote ? (["beforeBackgroundColor"] as const) : []),
          ]}
        />
      }
    >
      <section
        className={clsx(degreeStyles["degree-chip-strip"], styles["degree-scope"])}
        data-degree-colors="true"
        aria-label={`${swatch.label} degree ramp audit`}
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
            <button ref={targetRef} type="button" className={degreeStyles["degree-chip"]}>
              <span ref={labelRef} className={degreeStyles["degree-chip-note"]}>
                {swatch.display}
              </span>
            </button>
            <span className={degreeStyles["degree-chip-interval"]}>{swatch.interval}</span>
          </li>
        </ul>
      </section>
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

function ChordRowAuditMatrix({ theme }: { theme: AuditTheme }) {
  return (
    <section className={styles["audit-section"]}>
      <h3 className={styles["section-title"]}>Chord Row Strip</h3>
      <div className={styles["swatch-grid"]}>
        {CHORD_ROW_SWATCHES.map((swatch) => (
          <ChordRowCard key={swatch.id} swatch={swatch} theme={theme} />
        ))}
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

export function NoteColorAudit() {
  return (
    <main className={styles["note-color-audit"]} data-testid="note-color-audit">
      <header className={styles["audit-header"]}>
        <h1 className={styles["audit-title"]}>Note Color Audit Matrix</h1>
        <p className={styles["audit-subtitle"]}>
          Fill, ring, stroke width, stroke style, and opacity are read from computed
          browser styles for each rendered state.
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
            <ChordRowAuditMatrix theme={theme} />
            <DegreeRampAuditMatrix theme={theme} />
          </section>
        ))}
      </div>
    </main>
  );
}
