import { useEffect, useRef, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import clsx from "clsx";
import { X } from "lucide-react";
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
import { DrawerSelector } from "../DrawerSelector";
import { ToggleBar } from "./ToggleBar";
import "./SettingsOverlay.css";

const END_FRET = 24;
const ZOOM_MIN = 100;
const ZOOM_MAX = 300;
const ZOOM_STEP = 10;

const ACCIDENTAL_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "\u266F", value: "sharps" },
  { label: "\u266D", value: "flats" },
];

const ENHARMONIC_DISPLAY_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
];

type LayoutTier = "mobile" | "tablet" | "desktop";

const getLayoutTier = (): LayoutTier => {
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
};

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

export default function SettingsOverlay() {
  const [isOpen, setIsOpen] = useAtom(settingsOverlayOpenAtom);
  const [fretZoom, setFretZoom] = useAtom(fretZoomAtom);
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [tuningName, setTuningName] = useAtom(tuningNameAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [chordFretSpread, setChordFretSpread] = useAtom(chordFretSpreadAtom);
  const dispatchReset = useSetAtom(resetAtom);
  const [resetConfirming, setResetConfirming] = useState(false);
  const openTierRef = useRef<LayoutTier | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = () => {
    setIsOpen(false);
    setResetConfirming(false);
  };

  const handleResetClick = () => {
    if (resetConfirming) {
      dispatchReset();
      synth.setMute(false);
      setResetConfirming(false);
      setIsOpen(false);
    } else {
      setResetConfirming(true);
    }
  };

  // Auto-clear confirming state after 3 seconds
  useEffect(() => {
    if (!resetConfirming) return;
    const t = setTimeout(() => setResetConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [resetConfirming]);

  // Track layout tier at the moment the overlay opens.
  useEffect(() => {
    if (isOpen) {
      openTierRef.current = getLayoutTier();
    } else {
      openTierRef.current = null;
    }
  }, [isOpen]);

  // Auto-close the overlay when the layout tier changes (e.g., rotate,
  // desktop → mobile resize). Resizes within the same tier do nothing.
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      if (
        openTierRef.current &&
        getLayoutTier() !== openTierRef.current
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, setIsOpen]);

  // Trap focus inside the drawer while open and restore focus on close.
  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const drawer = drawerRef.current;
    const focusInitial = window.requestAnimationFrame(() => {
      const focusables = getFocusableElements(drawer);
      (closeButtonRef.current ?? focusables[0] ?? drawer)?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
        return;
      }

      if (e.key !== "Tab") return;

      const focusables = getFocusableElements(drawer);
      if (focusables.length === 0) {
        e.preventDefault();
        drawer?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey && activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusInitial);
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
      triggerRef.current = null;
    };
  }, [isOpen, setIsOpen]);

  return (
    <>
      <div
        className={clsx("settings-overlay-backdrop", { open: isOpen })}
        onClick={close}
        aria-hidden="true"
      />
      <div
        className={clsx("settings-overlay-drawer", { open: isOpen })}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        aria-hidden={!isOpen}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
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
        <div className="settings-overlay-content">
          <div className="overlay-control-group">
            <StepperControl
              label="Zoom"
              value={fretZoom}
              onChange={setFretZoom}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              formatValue={(z) => (z <= 100 ? "Auto" : `${z}%`)}
              buttonVariant="mobile"
            />
          </div>

          <div className="overlay-control-group">
            <span className="overlay-control-label">Fret Range</span>
            <FretRangeControl
              startFret={fretStart}
              endFret={fretEnd}
              onStartChange={setFretStart}
              onEndChange={setFretEnd}
              maxFret={END_FRET}
              layout="mobile"
            />
          </div>

          <div className="overlay-control-group">
            <DrawerSelector
              label="Tuning"
              value={tuningName}
              options={Object.keys(TUNINGS)}
              onSelect={(v) => v && setTuningName(v)}
            />
          </div>

          <div className="overlay-control-group">
            <StepperControl
              label="Chord Spread"
              value={chordFretSpread}
              onChange={setChordFretSpread}
              min={0}
              max={4}
              step={1}
              buttonVariant="mobile"
            />
          </div>

          <div className="overlay-control-group overlay-control-group--accidentals">
            <span className="overlay-control-label">Accidentals</span>
            <ToggleBar
              options={ACCIDENTAL_OPTIONS}
              value={accidentalMode}
              onChange={(v) =>
                setAccidentalMode(v as "sharps" | "flats" | "auto")
              }
            />
          </div>

          <div className="overlay-control-group">
            <span className="overlay-control-label">Enharmonic Display</span>
            <ToggleBar
              options={ENHARMONIC_DISPLAY_OPTIONS}
              value={enharmonicDisplay}
              onChange={(v) =>
                setEnharmonicDisplay(v as "auto" | "on" | "off")
              }
            />
          </div>

          <div className="overlay-reset-section">
            <button
              type="button"
              className={clsx("overlay-reset-btn", {
                "overlay-reset-confirming": resetConfirming,
              })}
              onClick={handleResetClick}
            >
              {resetConfirming ? "Click again to confirm" : "Reset all settings"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
