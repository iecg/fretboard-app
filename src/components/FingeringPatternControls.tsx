import { useCallback, useId, useRef, useState } from "react";
import clsx from "clsx";
import { CAGED_SHAPES, type CagedShape } from "../shapes";
import { type FingeringPattern } from "../store/atoms";
import { ToggleBar } from "./ToggleBar";
import "./FingeringPatternControls.css";
import shared from "./shared.module.css";

interface FingeringPatternControlsProps {
  fingeringPattern: FingeringPattern;
  setFingeringPattern: (pattern: FingeringPattern) => void;
  cagedShapes: Set<CagedShape>;
  setCagedShapes: (
    shapes: Set<CagedShape> | ((prev: Set<CagedShape>) => Set<CagedShape>),
  ) => void;
  npsPosition: number;
  setNpsPosition: (position: number) => void;
  displayFormat: "notes" | "degrees" | "none";
  setDisplayFormat: (format: "notes" | "degrees" | "none") => void;
  /** Called when a CAGED shape is clicked, even if already selected */
  onShapeClick?: (shape: CagedShape) => void;
}

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

/** True when the primary pointer is coarse (touch/pen). Evaluated once at load. */
const isTouchPrimary =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

function toggleShape(prev: Set<CagedShape>, shape: CagedShape): Set<CagedShape> {
  const next = new Set(prev);
  if (next.has(shape)) {
    if (next.size > 1) next.delete(shape);
  } else {
    next.add(shape);
  }
  return next;
}

export function FingeringPatternControls({
  fingeringPattern,
  setFingeringPattern,
  cagedShapes,
  setCagedShapes,
  npsPosition,
  setNpsPosition,
  displayFormat,
  setDisplayFormat,
  onShapeClick,
}: FingeringPatternControlsProps) {
  const shapeLabelId = useId();
  const shapeHelpId = useId();

  // Long-press tracking refs — shared across all shape buttons
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
          options={(["all", "caged", "3nps"] as FingeringPattern[]).map(
            (fp) => ({
              value: fp,
              label: fp === "all" ? "All" : fp.toUpperCase(),
            }),
          )}
          value={fingeringPattern}
          onChange={(v) => setFingeringPattern(v as FingeringPattern)}
        />
      </div>

      {fingeringPattern === "caged" && (
        <>
          <div className={shared["control-section"]}>
            {/* TODO: Shape selector is kept inline because it supports Shift+click / long-press
                multi-select, which ToggleBar does not support (single-select only).
                Refactor once ToggleBar gains a multi-select variant. */}
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
                  aria-pressed={cagedShapes.has(s)}
                  title={
                    isTouchPrimary
                      ? "Tap to select; long press to add/remove"
                      : "Click to select; Shift+click to toggle multiple"
                  }
                  data-pressing={pressingShape === s ? true : undefined}
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
                      setCagedShapes((prev) => toggleShape(prev, s));
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
                    if (e.shiftKey) {
                      setCagedShapes((prev) => toggleShape(prev, s));
                    } else {
                      setCagedShapes(new Set([s]));
                    }
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className={shared["shape-hint"]}>
              {isTouchPrimary ? "Long press to add shapes" : "Shift+click to add shapes"}
            </p>
          </div>
        </>
      )}

      {fingeringPattern === "3nps" && (
        <div className={shared["control-section"]}>
          <span className={shared["section-label"]}>Position</span>
          <ToggleBar
            options={[1, 2, 3, 4, 5, 6, 7].map((p) => ({
              value: p,
              label: String(p),
            }))}
            value={npsPosition}
            onChange={(v) => setNpsPosition(v as number)}
          />
        </div>
      )}

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Note Labels</span>
        <ToggleBar
          options={(["notes", "degrees", "none"] as const).map((fmt) => ({
            value: fmt,
            label:
              fmt === "notes"
                ? "Notes"
                : fmt === "degrees"
                  ? "Intervals"
                  : "None",
          }))}
          value={displayFormat}
          onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "none")}
        />
      </div>
    </>
  );
}
