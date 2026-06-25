import { motion } from "motion/react";
import clsx from "clsx";
import { CAGED_SHAPES, ANIMATION_DURATION_FAST } from "@fretflow/core";
import { useShapeState } from "@fretflow/fretboard/hooks/useShapeState";
import type { FingeringPattern } from "@fretflow/fretboard/store/fingeringAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { StringSetPicker } from "../shared/StringSetPicker";
import { GroupHeader, Prop } from "../Inspector/InspectorGrid";
import shared from "../shared/shared.module.css";
import styles from "./FingeringPatternControls.module.css";

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
        <Prop label={t("controls.shape")} span={9}>
          <div
            className={styles.shapeToggleBar}
            role="group"
            aria-label={t("controls.shape")}
          >
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
                  aria-pressed={isActive}
                  onClick={() => {
                    onShapeClick?.(s);
                    onRecenter?.();
                    selectSingleCagedShape(s);
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
              width="fill"
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
