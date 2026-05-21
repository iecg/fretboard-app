import { lazy, Suspense, startTransition } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { SCALE_FAMILIES } from "@fretflow/core";
import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { setRootNoteAtom } from "../../store/actions";
import { enharmonicDisplayAtom } from "../../store/audioAtoms";
import { rootNoteAtom, scaleNameAtom, useFlatsAtom, scaleVisibleAtom } from "../../store/scaleAtoms";
import { ScaleTheoryFacts } from "./ScaleTheoryFacts";
import { GroupHeader, Prop, PropGrid } from "./InspectorGrid";
import { CircleOfFifthsSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { RootNoteSelect } from "../shared/RootNoteSelect";
import { Switch } from "../Switch/Switch";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import styles from "./ScaleTab.module.css";

// Build the grouped scale options from the catalog.
// UI groups: Major modes | Pentatonics | Blues | Harmonic / Melodic
// The last group merges the harmonic-minor and melodic-minor families.
const majorFamily = SCALE_FAMILIES.find((f) => f.id === "major");
const pentatonicFamily = SCALE_FAMILIES.find((f) => f.id === "pentatonic");
const bluesFamily = SCALE_FAMILIES.find((f) => f.id === "blues");
const harmonicMinorFamily = SCALE_FAMILIES.find((f) => f.id === "harmonic-minor");
const melodicMinorFamily = SCALE_FAMILIES.find((f) => f.id === "melodic-minor");

const SCALE_GROUPS: LabeledSelectGroup[] = [
  {
    groupLabel: "Major modes",
    options: (majorFamily?.members ?? []).map((m) => ({
      value: m.scaleName,
      label: m.displayLabel,
    })),
  },
  {
    groupLabel: "Pentatonics",
    options: (pentatonicFamily?.members ?? []).map((m) => ({
      value: m.scaleName,
      label: m.displayLabel,
    })),
  },
  {
    groupLabel: "Blues",
    options: (bluesFamily?.members ?? []).map((m) => ({
      value: m.scaleName,
      label: m.displayLabel,
    })),
  },
  {
    groupLabel: "Harmonic / Melodic",
    options: [
      ...(harmonicMinorFamily?.members ?? []).map((m) => ({
        value: m.scaleName,
        label: m.displayLabel,
      })),
      ...(melodicMinorFamily?.members ?? []).map((m) => ({
        value: m.scaleName,
        label: m.displayLabel,
      })),
    ],
  },
];

const CircleOfFifths = lazy(() =>
  import("../CircleOfFifths/CircleOfFifths").then((m) => ({
    default: m.CircleOfFifths,
  })),
);

export function ScaleTab() {
  const { t } = useTranslation();
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);
  const { tier } = useLayoutMode();
  const [visible, setVisible] = useAtom(scaleVisibleAtom);

  const handleRootNote = (note: string) => {
    startTransition(() => {
      setRootNote(note);
    });
  };

  const handleScaleName = (name: string) => {
    startTransition(() => {
      setScaleName(name);
    });
  };

  return (
    <div className={styles.root} data-inspector-tab="scale">
      <div className={styles.layerVisibilityRow}>
        <Switch
          label={t("inspector.scaleLayer")}
          checked={visible}
          onChange={setVisible}
        />
        <span aria-hidden="true">{t("inspector.scaleLayer")}</span>
      </div>
      <div className={styles.fingeringRow}>
        <PropGrid columns={tier === "mobile" ? 2 : 6}>
          <FingeringPatternControls />
        </PropGrid>
      </div>
      <div className={styles.columns}>
        <div className={styles.col}>
          <GroupHeader>{t("inspector.groupKey")}</GroupHeader>
          <PropGrid columns={2}>
            <Prop label="Root" span={2}>
              <RootNoteSelect
                value={rootNote}
                onSelect={handleRootNote}
                useFlats={useFlats}
              />
            </Prop>
            <Prop label="Scale" span={2}>
              <LabeledSelect
                label="Scale"
                value={scaleName}
                groups={SCALE_GROUPS}
                onChange={handleScaleName}
                hideLabel
              />
            </Prop>
          </PropGrid>
        </div>
        <div className={styles.col} data-scale-col="wheel">
          <GroupHeader>{t("inspector.groupWheel")}</GroupHeader>
          <Suspense fallback={<CircleOfFifthsSkeleton />}>
            <CircleOfFifths
              rootNote={rootNote}
              setRootNote={setRootNote}
              scaleName={scaleName}
              useFlats={useFlats}
              enharmonicDisplay={enharmonicDisplay}
            />
          </Suspense>
        </div>
        <div className={styles.col}>
          <GroupHeader>{t("inspector.groupTheory")}</GroupHeader>
          <ScaleTheoryFacts />
        </div>
      </div>
    </div>
  );
}
