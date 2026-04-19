import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { HelpCircle, X } from "lucide-react";
import {
  settingsOverlayOpenAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  tuningNameAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  chordFretSpreadAtom,
  resetAtom,
} from "../store/atoms";
import { TUNINGS } from "../guitar";
import { synth } from "../audio";
import { StepperControl } from "./StepperControl";
import { FretRangeControl } from "./FretRangeControl";
import { LabeledSelect } from "./LabeledSelect";
import { ToggleBar } from "./ToggleBar";
import {
  getResponsiveLayout,
  getResponsiveTier,
  type ResponsiveTier,
} from "../layout/responsive";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  MAX_FRET, 
  FRET_ZOOM_MIN, 
  FRET_ZOOM_MAX 
} from "../constants";
import "./SettingsOverlay.css";

const ZOOM_STEP = 10;

type AccidentalOptionValue = "auto" | "sharps" | "flats";
type EnharmonicDisplayValue = "auto" | "on" | "off";
type HelpFieldId = "chordSpread" | "accidentals" | "enharmonicDisplay";
type SettingFieldKey =
  | "zoom"
  | "fretRange"
  | "tuning"
  | "accidentals"
  | "enharmonicDisplay"
  | "chordSpread";

type FieldHelp = {
  id: HelpFieldId;
  content: string;
};

type SettingFieldConfig = {
  key: SettingFieldKey;
  label: string;
  help?: FieldHelp;
  className?: string;
};

type SettingsSectionConfig = {
  id: string;
  title: string;
  tone?: "default" | "danger";
  fields: SettingFieldKey[];
};

const ACCIDENTAL_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "\u266F", value: "sharps" },
  { label: "\u266D", value: "flats" },
] as const satisfies readonly {
  label: string;
  value: AccidentalOptionValue;
}[];

const ENHARMONIC_DISPLAY_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
] as const satisfies readonly {
  label: string;
  value: EnharmonicDisplayValue;
}[];

const SETTING_FIELDS: Record<SettingFieldKey, SettingFieldConfig> = {
  zoom: {
    key: "zoom",
    label: "Zoom",
  },
  fretRange: {
    key: "fretRange",
    label: "Fret Range",
  },
  tuning: {
    key: "tuning",
    label: "Tuning",
  },
  accidentals: {
    key: "accidentals",
    label: "Accidentals",
    className: "overlay-field--accidentals",
    help: {
      id: "accidentals",
      content:
        "Auto chooses sharps or flats based on the current musical context.",
    },
  },
  enharmonicDisplay: {
    key: "enharmonicDisplay",
    label: "Enharmonic Display",
    help: {
      id: "enharmonicDisplay",
      content:
        "Controls whether equivalent note spellings appear when they clarify the theory view.",
    },
  },
  chordSpread: {
    key: "chordSpread",
    label: "Chord Spread",
    help: {
      id: "chordSpread",
      content:
        "Limits how far the visible chord tones can span across frets on the fretboard.",
    },
  },
};

const SETTINGS_SECTIONS: readonly SettingsSectionConfig[] = [
  {
    id: "view",
    title: "View",
    fields: ["zoom", "fretRange"],
  },
  {
    id: "instrument",
    title: "Instrument",
    fields: ["tuning"],
  },
  {
    id: "notation",
    title: "Notation",
    fields: ["accidentals", "enharmonicDisplay"],
  },
  {
    id: "chord-layout",
    title: "Chord Layout",
    fields: ["chordSpread"],
  },
  {
    id: "reset",
    title: "Reset",
    tone: "danger",
    fields: [],
  },
] as const;

// Retained for: auto-close overlay on layout-tier change (resize/rotate detection).
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

function OverlaySection({
  id,
  title,
  tone = "default",
  children,
}: {
  id: string;
  title: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "panel-surface",
        "panel-surface--compact",
        "overlay-section-card",
        tone === "danger" && "overlay-section-card--danger",
      )}
      aria-labelledby={`settings-section-${id}`}
    >
      <div className="overlay-section-heading">
        <h2 id={`settings-section-${id}`} className="overlay-section-title">
          {title}
        </h2>
      </div>
      <div className="overlay-section-body">{children}</div>
    </section>
  );
}

function OverlayFieldHeader({
  label,
  help,
  isHelpOpen,
  onToggleHelp,
  helpContainerRef,
}: {
  label: string;
  help?: FieldHelp;
  isHelpOpen: boolean;
  onToggleHelp: () => void;
  helpContainerRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="overlay-field-header">
      <span className="overlay-field-label">{label}</span>
      {help ? (
        <div className="overlay-field-help" ref={helpContainerRef}>
          <button
            type="button"
            className="overlay-help-trigger"
            aria-label={
              isHelpOpen ? `Hide help for ${label}` : `Show help for ${label}`
            }
            aria-expanded={isHelpOpen}
            aria-controls={`settings-help-${help.id}`}
            onClick={onToggleHelp}
          >
            <HelpCircle className="icon" />
          </button>
          {isHelpOpen ? (
            <div
              id={`settings-help-${help.id}`}
              className="overlay-help-popover"
            >
              {help.content}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SettingsOverlaySurface({
  layout,
  setIsOpen,
}: {
  layout: ReturnType<typeof getResponsiveLayout>;
  setIsOpen: (value: boolean) => void;
}) {
  const [fretZoom, setFretZoom] = useAtom(fretZoomAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(
    enharmonicDisplayAtom,
  );
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);
  const dispatchReset = useSetAtom(resetAtom);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [activeHelpField, setActiveHelpField] = useState<HelpFieldId | null>(
    null,
  );
  const activeHelpFieldRef = useRef<HelpFieldId | null>(null);

  useEffect(() => {
    activeHelpFieldRef.current = activeHelpField;
  }, [activeHelpField]);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const helpContainerRefs = useRef<Record<HelpFieldId, HTMLDivElement | null>>({
    chordSpread: null,
    accidentals: null,
    enharmonicDisplay: null,
  });

  const close = () => {
    setIsOpen(false);
  };

  const handleResetClick = () => {
    if (resetConfirming) {
      dispatchReset();
      synth.setMute(false);
      setIsOpen(false);
    } else {
      setResetConfirming(true);
    }
  };

  const handleHelpToggle = (fieldId: HelpFieldId) => {
    setActiveHelpField((current) => (current === fieldId ? null : fieldId));
  };

  // Auto-clear confirming state after 3 seconds
  useEffect(() => {
    if (!resetConfirming) return;
    const t = setTimeout(() => setResetConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [resetConfirming]);

  useEffect(() => {
    if (!activeHelpField) return;

    const handlePointerDown = (event: MouseEvent) => {
      const helpContainer = helpContainerRefs.current[activeHelpField];
      if (helpContainer?.contains(event.target as Node)) return;
      setActiveHelpField(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeHelpField]);

  // Capture trigger element at open time so useFocusTrap can restore focus on close.
  useEffect(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);

  // Trap focus inside the drawer while open and restore focus on close.
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
              setAccidentalMode(value as AccidentalOptionValue)
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
              setEnharmonicDisplay(value as EnharmonicDisplayValue)
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
          "overlay-field",
          field.className,
          isHelpOpen && "overlay-field--help-open",
          index < total - 1 && "overlay-field--divided",
        )}
      >
        <OverlayFieldHeader
          label={field.label}
          help={field.help}
          isHelpOpen={Boolean(isHelpOpen)}
          onToggleHelp={() => field.help && handleHelpToggle(field.help.id)}
          helpContainerRef={helpContainerRef}
        />
        <div className="overlay-field-control">{control}</div>
      </div>
    );
  };

  return (
    <>
      <motion.div
        className="settings-overlay-backdrop"
        onClick={close}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      />
      <motion.div
        className="settings-overlay-drawer"
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
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <div className="settings-overlay-header">
          <span className="settings-overlay-title">Settings</span>
          <button
            type="button"
            ref={closeButtonRef}
            className="settings-overlay-close"
            onClick={close}
            aria-label="Close settings"
          >
            <X className="icon" />
          </button>
        </div>
        <div className="settings-overlay-content custom-scrollbar">
          {SETTINGS_SECTIONS.map((section) => (
            <OverlaySection
              key={section.id}
              id={section.id}
              title={section.title}
              tone={section.tone}
            >
              {section.id === "reset" ? (
                <div className="overlay-reset-section">
                  <p className="overlay-reset-copy">
                    Restore every setting in the app back to its default value.
                  </p>
                  <button
                    type="button"
                    className={clsx("overlay-reset-btn", {
                      "overlay-reset-confirming": resetConfirming,
                    })}
                    onClick={handleResetClick}
                  >
                    {resetConfirming
                      ? "Click again to confirm"
                      : "Reset all settings"}
                  </button>
                </div>
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

  // Preserve atomWithStorage initialization behavior even while the drawer is closed.
  useAtomValue(fretZoomAtom);
  useAtomValue(fretStartAtom);
  useAtomValue(fretEndAtom);
  useAtomValue(tuningNameAtom);
  useAtomValue(chordFretSpreadAtom);

  // Track layout tier at the moment the overlay opens.
  useEffect(() => {
    const onResize = () => setViewport(getViewportSnapshot());
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    openTierRef.current = isOpen ? getLayoutTier() : null;
  }, [isOpen]);

  // Auto-close the overlay when the layout tier changes (e.g., rotate,
  // desktop → mobile resize). Resizes within the same tier keep the drawer
  // open and allow CSS to adapt the surface.
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
