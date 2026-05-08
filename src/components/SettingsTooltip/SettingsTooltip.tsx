import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { useAtom } from "jotai";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { coachmarkSettingsDismissedAtom } from "../../store/atoms";
import styles from "./SettingsTooltip.module.css";

const SECTION_TITLES = ["View", "Instrument", "Appearance", "Notation", "Chord Layout", "Reset"];

interface TriggerRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

function measureRect(el: HTMLElement): TriggerRect {
  const r = el.getBoundingClientRect();
  return { bottom: r.bottom, left: r.left, right: r.right, top: r.top, width: r.width };
}

export interface SettingsTooltipProps {
  /** The gear <button> element (trigger). */
  children: React.ReactNode;
}

export function SettingsTooltip({ children }: SettingsTooltipProps) {
  const [dismissed, setDismissed] = useAtom(coachmarkSettingsDismissedAtom);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<TriggerRect | null>(null);
  const tooltipId = useId();

  const measure = useCallback(() => {
    if (wrapperRef.current) {
      setRect(measureRect(wrapperRef.current));
    }
  }, []);

  // Measure when tooltip or coach mark needs positioning
  useEffect(() => {
    if (tooltipVisible || !dismissed) {
      measure();
    }
  }, [tooltipVisible, dismissed, measure]);

  // Tooltip show/hide
  const showTooltip = useCallback(() => {
    measure();
    setTooltipVisible(true);
  }, [measure]);

  const hideTooltip = useCallback(() => {
    setTooltipVisible(false);
  }, []);

  // Dismiss coach mark on any click in the wrapper (the gear button was clicked)
  const handleWrapperKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !dismissed) {
      setDismissed(true);
    }
  }, [dismissed, setDismissed]);

  // Global Escape: dismiss coach mark or hide tooltip
  useEffect(() => {
    if (!tooltipVisible && dismissed) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!dismissed) {
          setDismissed(true);
        }
        setTooltipVisible(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [tooltipVisible, dismissed, setDismissed]);

  // Computed position: place tooltip below-left of the trigger
  const tooltipStyle =
    rect
      ? {
          top: rect.bottom + 8,
          left: Math.max(8, rect.right - 160),
        }
      : undefined;

  // Coach mark: place below the trigger, slightly left to center arrow on button
  const coachStyle =
    rect
      ? {
          top: rect.bottom + 12,
          left: Math.max(8, rect.left - 16),
        }
      : undefined;

  // Inject aria-describedby into the trigger button child
  const triggerChild = (() => {
    if (typeof children === "object" && children !== null && "type" in (children as React.ReactElement)) {
      const el = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
      return (
        <el.type
          {...el.props}
          aria-describedby={tooltipId}
          className={clsx(el.props.className)}
        />
      );
    }
    return children;
  })();

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onClick={() => { if (!dismissed) setDismissed(true); }}
      onKeyDown={handleWrapperKeyDown}
      role="presentation"
    >
      {triggerChild}

      {createPortal(
        <>
          {/* Hover / focus tooltip */}
          <AnimatePresence>
            {tooltipVisible && dismissed && (
              <motion.div
                id={tooltipId}
                role="tooltip"
                className={styles.tooltip}
                style={tooltipStyle}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <p className={styles["tooltip-label"]}>Settings</p>
                <ul className={styles["tooltip-sections"]} aria-label="Settings sections">
                  {SECTION_TITLES.map((title) => (
                    <li key={title} className={styles["tooltip-section"]}>
                      {title}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* First-run coach mark */}
          <AnimatePresence>
            {!dismissed && (
              <motion.button
                type="button"
                className={styles["coach-mark"]}
                style={coachStyle}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, delay: 0.4 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissed(true);
                }}
                aria-label="Dismiss settings tip"
                data-testid="settings-coach-mark"
              >
                <span className={styles["coach-mark-text"]}>
                  Tap the gear to explore View, Notation, and more.
                </span>
                <span className={styles["coach-mark-close"]} aria-hidden="true">
                  ✕
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </div>
  );
}
