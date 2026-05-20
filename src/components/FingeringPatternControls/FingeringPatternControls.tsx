import { useCallback, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { CAGED_SHAPES, type CagedShape, ANIMATION_DURATION_FAST } from "@fretflow/core";
import { useShapeState } from "../../hooks/useShapeState";
import type { FingeringPattern } from "../../store/fingeringAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { GroupHeader, Prop } from "../Inspector/InspectorGrid";
import shared from "../shared/shared.module.css";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

const isTouchPrimary =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

/**
 * Renders the FINGERING property-grid group: the group header plus the
 * pattern selector and its per-pattern sub-controls, as `Prop` cells. It is
 * designed to be a child of the View tab's `PropGrid` — React fragments are
 * transparent to CSS grid, so the emitted `GroupHeader`/`Prop` elements become
 * direct grid items.
 */
export function FingeringPatternControls() {
  const { t } = useTranslation();
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
    oneStringIndex,
    setOneStringIndex,
    oneStringInterval,
    setOneStringInterval,
    twoStringsPair,
    setTwoStringsPair,
    twoStringsInterval,
    setTwoStringsInterval,
  } = useShapeState();

  const shapeHelpId = useId();

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
      <GroupHeader>{t("inspector.groupFingering")}</GroupHeader>

      <Prop label={t("inspector.positionCluster")} span={2}>
        <ToggleBar
          label={t("inspector.positionCluster")}
          options={[
            { value: "none", label: "None" },
            { value: "caged", label: "CAGED" },
            { value: "3nps", label: "3NPS" },
          ]}
          value={
            fingeringPattern === "none" ||
            fingeringPattern === "caged" ||
            fingeringPattern === "3nps"
              ? fingeringPattern
              : undefined
          }
          onChange={(v) => setFingeringPattern(v as FingeringPattern)}
        />
      </Prop>

      <Prop label={t("inspector.stringStudyCluster")} span={2}>
        <ToggleBar
          label={t("inspector.stringStudyCluster")}
          options={[
            { value: "one-string", label: "1-String" },
            { value: "two-strings", label: "2-Strings" },
          ]}
          value={
            fingeringPattern === "one-string" || fingeringPattern === "two-strings"
              ? fingeringPattern
              : undefined
          }
          onChange={(v) => setFingeringPattern(v as FingeringPattern)}
        />
      </Prop>

      {fingeringPattern === "caged" && (
        <Prop
          label={t("controls.shape")}
          span={2}
          hint={isTouchPrimary ? t("controls.longPressToAdd") : t("controls.shiftClickToAdd")}
        >
          <span id={shapeHelpId} className={shared["sr-only"]}>
            {isTouchPrimary ? t("controls.shapeHintTouch") : t("controls.shapeHintPointer")}
          </span>
          <div
            className={shared["toggle-group"]}
            role="group"
            aria-label={t("controls.shape")}
            aria-describedby={shapeHelpId}
          >
            <motion.button
              type="button"
              className={clsx(
                shared["toggle-btn"],
                cagedShapes.size === CAGED_SHAPES.length && shared.active,
              )}
              aria-pressed={cagedShapes.size === CAGED_SHAPES.length}
              onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}
              whileTap={{ scale: 0.96 }}
              animate={
                cagedShapes.size === CAGED_SHAPES.length ? { scale: [1, 1.04, 1] } : { scale: 1 }
              }
              transition={{ duration: ANIMATION_DURATION_FAST }}
            >
              All
            </motion.button>
            {CAGED_SHAPES.map((s) => {
              const isActive = cagedShapes.has(s);
              return (
                <motion.button
                  key={s}
                  type="button"
                  className={clsx(shared["toggle-btn"], isActive && shared.active)}
                  data-pressing={pressingShape === s || undefined}
                  aria-pressed={isActive}
                  title={
                    isTouchPrimary
                      ? "Tap to select; long press to add/remove"
                      : "Click to select; Shift+click to toggle multiple"
                  }
                  onPointerDown={(e) => {
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
                    if (longPressedShapeRef.current !== null) e.preventDefault();
                  }}
                  onClick={(e) => {
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
                  whileTap={{ scale: 0.96 }}
                  animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={{ duration: ANIMATION_DURATION_FAST }}
                >
                  {s}
                </motion.button>
              );
            })}
          </div>
        </Prop>
      )}

      {fingeringPattern === "3nps" && (
        <>
          <Prop label={t("controls.position")} span={2}>
            <ToggleBar
              label={t("controls.position")}
              options={[1, 2, 3, 4, 5, 6, 7].map((p) => ({
                value: p,
                label: String(p),
              }))}
              value={npsPosition}
              onChange={(v) => setNpsPosition(v as number)}
            />
          </Prop>
          <Prop label={t("controls.octave")} span={2}>
            <ToggleBar
              label={t("controls.octave")}
              options={[
                { value: 0, label: "Low" },
                { value: 1, label: "High" },
              ]}
              value={npsOctave}
              onChange={(v) => setNpsOctave(v as number)}
            />
          </Prop>
        </>
      )}

      {fingeringPattern === "one-string" && (
        <>
          <Prop label={t("controls.string")} span={2}>
            <ToggleBar
              label={t("controls.string")}
              options={[1, 2, 3, 4, 5, 6].map((n, i) => ({ value: i, label: String(n) }))}
              value={oneStringIndex}
              onChange={(v) => setOneStringIndex(v as number)}
            />
          </Prop>
          <Prop
            label={t("controls.connectors")}
            span={2}
            hint={oneStringInterval > 0 ? t("controls.showConsecutiveSteps") : undefined}
          >
            <ToggleBar
              label={t("controls.connectors")}
              options={[
                { value: 0, label: t("controls.off") },
                { value: 1, label: t("controls.on") },
              ]}
              value={oneStringInterval}
              onChange={(v) => setOneStringInterval(v as number)}
            />
          </Prop>
        </>
      )}

      {fingeringPattern === "two-strings" && (
        <>
          <Prop label={t("controls.strings")} span={2}>
            <ToggleBar
              label={t("controls.strings")}
              options={
                twoStringsInterval === 3
                  ? [
                      { value: 0, label: "1-3" },
                      { value: 1, label: "2-4" },
                      { value: 2, label: "3-5" },
                      { value: 3, label: "4-6" },
                    ]
                  : [
                      { value: 0, label: "1-2" },
                      { value: 1, label: "2-3" },
                      { value: 2, label: "3-4" },
                      { value: 3, label: "4-5" },
                      { value: 4, label: "5-6" },
                    ]
              }
              value={twoStringsPair}
              onChange={(v) => setTwoStringsPair(v as number)}
            />
          </Prop>
          <Prop
            label={t("controls.interval")}
            span={2}
            hint={twoStringsInterval > 0 ? t("controls.pairMembersConnected") : undefined}
          >
            <ToggleBar
              label={t("controls.interval")}
              options={[
                { value: 0, label: t("controls.off") },
                { value: 1, label: "3rds" },
                { value: 2, label: "4ths" },
                { value: 3, label: "6ths" },
              ]}
              value={twoStringsInterval}
              onChange={(v) => setTwoStringsInterval(v as number)}
            />
          </Prop>
        </>
      )}
    </>
  );
}
