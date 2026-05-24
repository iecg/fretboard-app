import { useCallback, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { CAGED_SHAPES, type CagedShape, ANIMATION_DURATION_FAST } from "@fretflow/core";
import { useShapeState } from "../../hooks/useShapeState";
import type { FingeringPattern } from "../../store/fingeringAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { StringSetPicker } from "../shared/StringSetPicker";
import { GroupHeader, Prop } from "../Inspector/InspectorGrid";
import shared from "../shared/shared.module.css";
import styles from "./FingeringPatternControls.module.css";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

const isTouchPrimary =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

export interface FingeringPatternControlsProps {
  /** When true, suppresses the internal "Fingering" GroupHeader. Use when the
   * host already renders its own section heading for this group. */
  hideHeader?: boolean;
}

/**
 * Renders the FINGERING property-grid group: the group header plus the
 * pattern selector and its per-pattern sub-controls, as `Prop` cells. It is
 * designed to be a child of the View tab's `PropGrid` — React fragments are
 * transparent to CSS grid, so the emitted `GroupHeader`/`Prop` elements become
 * direct grid items.
 */
export function FingeringPatternControls({ hideHeader = false }: FingeringPatternControlsProps) {
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
      {!hideHeader && <GroupHeader>{t("inspector.groupFingering")}</GroupHeader>}

      <Prop label={t("inspector.fingeringPatternLabel")} span={3}>
        <LabeledSelect
          label={t("inspector.fingeringPatternLabel")}
          hideLabel
          width="fill"
          value={fingeringPattern}
          groups={[
            { options: [{ value: "none", label: t("inspector.none") }] },
            {
              groupLabel: t("inspector.fingeringGroupBoxShapes"),
              options: [
                { value: "caged", label: "CAGED" },
                { value: "3nps", label: "3NPS" },
              ],
            },
            {
              groupLabel: t("inspector.fingeringGroupLinear"),
              options: [
                { value: "one-string", label: "1-String" },
                { value: "two-strings", label: "2-Strings" },
              ],
            },
          ]}
          onChange={(v) => setFingeringPattern(v as FingeringPattern)}
        />
      </Prop>

      {fingeringPattern === "caged" && (
        <Prop
          label={t("controls.shape")}
          span={9}
          labelAccessory={
            isTouchPrimary ? t("controls.longPressToAdd") : t("controls.shiftClickToAdd")
          }
        >
          <span id={shapeHelpId} className={shared["sr-only"]}>
            {isTouchPrimary ? t("controls.shapeHintTouch") : t("controls.shapeHintPointer")}
          </span>
          <div
            className={styles.shapeToggleBar}
            role="group"
            aria-label={t("controls.shape")}
            aria-describedby={shapeHelpId}
          >
            <motion.button
              type="button"
              className={clsx(
                shared["toggle-btn"],
                styles.shapeToggleButton,
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
                  className={clsx(
                    shared["toggle-btn"],
                    styles.shapeToggleButton,
                    isActive && shared.active,
                  )}
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
          <Prop label={t("controls.position")} span={7}>
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
          <Prop label={t("controls.string")} span={3}>
            <StringSetPicker
              label={t("controls.string")}
              value={String(oneStringIndex)}
              onChange={(v) => setOneStringIndex(Number(v))}
              options={[0, 1, 2, 3, 4, 5].map((i) => ({
                id: String(i),
                strings: [i],
              }))}
              width="fill"
            />
          </Prop>
          <Prop
            label={t("controls.connectors")}
            span={6}
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
          <Prop label={t("controls.strings")} span={3}>
            <StringSetPicker
              label={t("controls.strings")}
              value={String(twoStringsPair)}
              onChange={(v) => setTwoStringsPair(Number(v))}
              options={
                twoStringsInterval === 3
                  ? [
                      { id: "0", strings: [0, 2] },
                      { id: "1", strings: [1, 3] },
                      { id: "2", strings: [2, 4] },
                      { id: "3", strings: [3, 5] },
                    ]
                  : [
                      { id: "0", strings: [0, 1] },
                      { id: "1", strings: [1, 2] },
                      { id: "2", strings: [2, 3] },
                      { id: "3", strings: [3, 4] },
                      { id: "4", strings: [4, 5] },
                    ]
              }
            />
          </Prop>
          <Prop
            label={t("controls.interval")}
            span={6}
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
