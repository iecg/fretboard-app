import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import {
  settingsOverlayOpenAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  tuningNameAtom,
  chordFretSpreadAtom,
} from "../../store/atoms";
import { TUNINGS } from "../../core/guitar";
import { StepperControl } from "../StepperControl/StepperControl";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import {
  getResponsiveLayout,
  getResponsiveTier,
  type ResponsiveTier,
} from "../../layout/responsive";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  MAX_FRET,
  FRET_ZOOM_MIN,
  FRET_ZOOM_MAX,
  ANIMATION_DURATION_STANDARD,
  ANIMATION_EASE,
} from "../../core/constants";
import { type SettingFieldKey } from "./types";
import {
  ZOOM_STEP,
  ACCIDENTAL_OPTIONS,
  ENHARMONIC_DISPLAY_OPTIONS,
  SETTING_FIELDS,
  SETTINGS_SECTIONS,
} from "./constants";
import { OverlaySection, OverlayFieldHeader } from "./shared";
import { ResetSettingsSection } from "./sections/ResetSettingsSection";
import { useSettingsForm } from "./useSettingsForm";
import { useHelpPopover } from "./useHelpPopover";
import styles from "./SettingsOverlay.module.css";
import sharedStyles from "../shared/shared.module.css";

const getLayoutTier = (): ResponsiveTier => {
  if (typeof window === "undefined") return "desktop";
  return getResponsiveTier(window.innerWidth);
};

function getViewportSnapshot() {
  if (typeof window === "undefined") {
    return { width: 1440, height: 900 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function SettingsOverlaySurface({
  layout,
  setIsOpen,
}: {
  layout: ReturnType<typeof getResponsiveLayout>;
  setIsOpen: (value: boolean) => void;
}) {
  const {
    fretZoom,
    setFretZoom,
    fretStart,
    setFretStart,
    fretEnd,
    setFretEnd,
    tuningName,
    setTuningName,
    accidentalMode,
    setAccidentalMode,
    enharmonicDisplay,
    setEnharmonicDisplay,
    chordFretSpread,
    setChordFretSpread,
  } = useSettingsForm();

  const {
    activeHelpField,
    activeHelpFieldRef,
    helpContainerRefs,
    setActiveHelpField,
    handleHelpToggle,
  } = useHelpPopover();

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);

  /* Trap focus inside drawer. */
  useFocusTrap({
    containerRef: drawerRef,
    active: true,
    onEscape: () => {
      if (activeHelpFieldRef.current) {
        setActiveHelpField(null);
      } else {
        setIsOpen(false);
      }
    },
    restoreFocusRef: triggerRef,
  });

  const renderField = (
    fieldKey: SettingFieldKey,
    index: number,
    total: number,
  ) => {
    const field = SETTING_FIELDS[fieldKey];
    const isHelpOpen = field.help?.id === activeHelpField;
    const helpId = field.help?.id;
    const helpContainerRef = helpId
      ? (node: HTMLDivElement | null) => {
          helpContainerRefs.current[helpId] = node;
        }
      : undefined;

    let control: ReactNode = null;

    switch (field.key) {
      case "zoom":
        control = (
          <StepperControl
            value={fretZoom}
            onChange={setFretZoom}
            min={FRET_ZOOM_MIN}
            max={FRET_ZOOM_MAX}
            step={ZOOM_STEP}
            formatValue={(zoom) => (zoom <= 100 ? "Auto" : `${zoom}%`)}
            buttonVariant="mobile"
          />
        );
        break;
      case "fretRange":
        control = (
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="mobile"
          />
        );
        break;
      case "tuning":
        control = (
          <LabeledSelect
            label={field.label}
            value={tuningName}
            options={Object.keys(TUNINGS).map((name) => ({ value: name, label: name }))}
            onChange={setTuningName}
            hideLabel
          />
        );
        break;
      case "accidentals":
        control = (
          <ToggleBar
            options={ACCIDENTAL_OPTIONS}
            value={accidentalMode}
            onChange={(value) =>
              setAccidentalMode(value as typeof accidentalMode)
            }
          />
        );
        break;
      case "enharmonicDisplay":
        control = (
          <ToggleBar
            options={ENHARMONIC_DISPLAY_OPTIONS}
            value={enharmonicDisplay}
            onChange={(value) =>
              setEnharmonicDisplay(value as typeof enharmonicDisplay)
            }
          />
        );
        break;
      case "chordSpread":
        control = (
          <StepperControl
            value={chordFretSpread}
            onChange={setChordFretSpread}
            min={0}
            max={4}
            step={1}
            buttonVariant="mobile"
          />
        );
        break;
    }

    return (
      <div
        key={field.key}
        className={clsx(
          styles["overlay-field"],
          field.className,
          isHelpOpen && styles["overlay-field--help-open"],
          index < total - 1 && styles["overlay-field--divided"],
        )}
      >
        <OverlayFieldHeader
          label={field.label}
          help={field.help}
          isHelpOpen={Boolean(isHelpOpen)}
          onToggleHelp={() => field.help && handleHelpToggle(field.help.id)}
          helpContainerRef={helpContainerRef}
        />
        <div className={styles["overlay-field-control"]}>{control}</div>
      </div>
    );
  };

  return (
    <>
      <motion.div
        className={styles["settings-overlay-backdrop"]}
        onClick={close}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: ANIMATION_DURATION_STANDARD, ease: ANIMATION_EASE }}
      />
      <motion.div
        className={styles["settings-overlay-drawer"]}
        data-testid="settings-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-layout-tier={layout.tier}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: ANIMATION_DURATION_STANDARD, ease: ANIMATION_EASE }}
      >
        <div className={styles["settings-overlay-header"]}>
          <span className={styles["settings-overlay-title"]}>Settings</span>
          <button
            type="button"
            ref={closeButtonRef}
            className={clsx(sharedStyles["icon-button"], styles["settings-overlay-close"])}
            onClick={close}
            aria-label="Close settings"
          >
            <X className="icon" />
          </button>
        </div>
        <div className={clsx(styles["settings-overlay-content"], "custom-scrollbar")}>
          {SETTINGS_SECTIONS.map((section) => (
            <OverlaySection
              key={section.id}
              id={section.id}
              title={section.title}
              tone={section.tone}
            >
              {section.id === "reset" ? (
                <ResetSettingsSection onClose={close} />
              ) : (
                section.fields.map((fieldKey, index) =>
                  renderField(fieldKey, index, section.fields.length),
                )
              )}
            </OverlaySection>
          ))}
        </div>
      </motion.div>
    </>
  );
}

export default function SettingsOverlay() {
  const [isOpen, setIsOpen] = useAtom(settingsOverlayOpenAtom);
  const [viewport, setViewport] = useState(getViewportSnapshot);
  const openTierRef = useRef<ResponsiveTier | null>(null);
  const layout = getResponsiveLayout(viewport.width, viewport.height);

  useAtomValue(fretZoomAtom);
  useAtomValue(fretStartAtom);
  useAtomValue(fretEndAtom);
  useAtomValue(tuningNameAtom);
  useAtomValue(chordFretSpreadAtom);

  useEffect(() => {
    const onResize = () => setViewport(getViewportSnapshot());
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    openTierRef.current = isOpen ? getLayoutTier() : null;
  }, [isOpen]);

  /* Close on tier change (e.g. rotation). */
  useEffect(() => {
    if (!isOpen || !openTierRef.current) return;
    if (layout.tier !== openTierRef.current) {
      setIsOpen(false);
    }
  }, [isOpen, layout.tier, setIsOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <SettingsOverlaySurface layout={layout} setIsOpen={setIsOpen} />
      ) : null}
    </AnimatePresence>
  );
}
