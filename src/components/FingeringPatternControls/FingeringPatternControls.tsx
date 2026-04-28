import { useCallback, useId, useRef, useState } from "react";
import { useAtom } from "jotai";
import clsx from "clsx";
import { CAGED_SHAPES, type CagedShape } from "../../shapes";
import { useShapeState } from "../../hooks/useShapeState";
import { displayFormatAtom } from "../../store/atoms";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import shared from "../shared/shared.module.css";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

/** Primary pointer is coarse (touch/pen). */
const isTouchPrimary =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

export function FingeringPatternControls({ compact = false }: { compact?: boolean }) {
  const {
    fingeringPattern,
    setFingeringPattern,
    cagedShapes,
    setCagedShapes,
    toggleCagedShape,
    selectSingleCagedShape,
    npsPosition,
    setNpsPosition,
    npsOctave,
    setNpsOctave,
    onShapeClick,
    onRecenter,
  } = useShapeState();

  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);

  const shapeLabelId = useId();
  const shapeHelpId = useId();

  // Long-press tracking for shape buttons.
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedShapeRef = useRef<CagedShape | null>(null);
  const [pressingShape, setPressingShape] = useState<CagedShape | null>(null);

  const cancelPress = useCallback(() => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    pressStartRef.current = null;
    setPressingShape(null);
  }, []);

  return (
    <>
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Fingering Pattern</span>
        <ToggleBar
          options={[
            { value: "all", label: "All" },
            { value: "caged", label: "CAGED" },
            { value: "3nps", label: "3NPS" },
          ]}
          value={fingeringPattern}
          onChange={(v) => setFingeringPattern(v as "all" | "caged" | "3nps")}
          compact={compact}
        />
      </div>

      {fingeringPattern === "caged" && (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]} id={shapeLabelId}>Shape</span>
            <span id={shapeHelpId} className={shared["sr-only"]}>
              {isTouchPrimary
                ? "Tap to select a shape. Long press to toggle multiple shapes."
                : "Click to select a shape. Shift+click to toggle multiple shapes."}
            </span>
            <div
              className={shared["toggle-group"]}
              role="group"
              aria-labelledby={shapeLabelId}
              aria-describedby={shapeHelpId}
              data-compact={compact ? "true" : undefined}
            >
              <button
                type="button"
                className={clsx(
                  shared["toggle-btn"],
                  cagedShapes.size === CAGED_SHAPES.length && shared.active,
                )}
                aria-pressed={cagedShapes.size === CAGED_SHAPES.length}
                onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}
              >
                All
              </button>
              {CAGED_SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={clsx(
                    shared["toggle-btn"],
                    cagedShapes.has(s) && shared.active,
                  )}
                  data-pressing={pressingShape === s || undefined}
                  aria-pressed={cagedShapes.has(s)}
                  title={
                    isTouchPrimary
                      ? "Tap to select; long press to add/remove"
                      : "Click to select; Shift+click to toggle multiple"
                  }
                  onPointerDown={(e) => {
                    // Long press only applies to touch/pen — desktop uses Shift+click
                    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
                    cancelPress();
                    longPressedShapeRef.current = null;
                    pressStartRef.current = { x: e.clientX, y: e.clientY };
                    setPressingShape(s);
                    pressTimerRef.current = setTimeout(() => {
                      longPressedShapeRef.current = s;
                      pressTimerRef.current = null;
                      pressStartRef.current = null;
                      setPressingShape(null);
                      toggleCagedShape(s);
                      navigator.vibrate?.(30);
                    }, LONG_PRESS_MS);
                  }}
                  onPointerMove={(e) => {
                    if (!pressStartRef.current) return;
                    const dx = e.clientX - pressStartRef.current.x;
                    const dy = e.clientY - pressStartRef.current.y;
                    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancelPress();
                  }}
                  onPointerUp={cancelPress}
                  onPointerCancel={cancelPress}
                  onPointerLeave={cancelPress}
                  onContextMenu={(e) => {
                    // Suppress context menu that browsers show on long press
                    if (longPressedShapeRef.current !== null) e.preventDefault();
                  }}
                  onClick={(e) => {
                    // If this click followed a long press, skip single-select
                    if (longPressedShapeRef.current !== null) {
                      longPressedShapeRef.current = null;
                      return;
                    }
                    onShapeClick?.(s);
                    onRecenter?.();
                    if (e.shiftKey) {
                      toggleCagedShape(s);
                    } else {
                      selectSingleCagedShape(s);
                    }
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className={shared["field-hint"]}>
              {isTouchPrimary ? "Long press to add shapes" : "Shift+click to add shapes"}
            </p>
          </div>
        </>
      )}

      {fingeringPattern === "3nps" && (
        <>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Position</span>
            <ToggleBar
              options={[1, 2, 3, 4, 5, 6, 7].map((p) => ({
                value: p,
                label: String(p),
              }))}
              value={npsPosition}
              onChange={(v) => setNpsPosition(v as number)}
              compact={compact}
            />
          </div>
          <div className={shared["control-section"]}>
            <span className={shared["section-label"]}>Octave</span>
            <ToggleBar
              options={[
                { value: 0, label: "Low" },
                { value: 1, label: "High" },
              ]}
              value={npsOctave}
              onChange={(v) => setNpsOctave(v as number)}
              compact={compact}
            />
          </div>
        </>
      )}

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Note Labels</span>
        <ToggleBar
          options={(["notes", "degrees", "color", "none"] as const).map((fmt) => ({
            value: fmt,
            label:
              fmt === "notes"
                ? "Notes"
                : fmt === "degrees"
                  ? "Intervals"
                  : fmt === "color"
                    ? "Color"
                    : "None",
          }))}
          value={displayFormat}
          onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "color" | "none")}
          compact={compact}
        />
      </div>
    </>
  );
}
