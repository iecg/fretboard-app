import { useEffect, useRef, type RefObject } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  ANIMATION_DURATION_FAST,
  ANIMATION_EASE,
} from "../constants";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function HelpModal({ isOpen, onClose, triggerRef }: HelpModalProps) {
  const helpModalRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: helpModalRef,
    active: isOpen,
    onEscape: onClose,
    restoreFocusRef: triggerRef,
  });

  // Outside-click handler — close when clicking outside the modal container
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (helpModalRef.current && !helpModalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="help-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
        >
          <motion.div
            ref={helpModalRef}
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
          >
            <div className="help-modal-header">
              <h2 id="help-modal-title">FretFlow Help</h2>
              <button
                type="button"
                className="help-modal-close"
                onClick={onClose}
                aria-label="Close help"
              >
                <X className="icon" />
              </button>
            </div>
            <div className="help-modal-content">
              <h3>Getting Started</h3>
              <p>
                FretFlow is an interactive guitar fretboard and music theory
                tool. Choose a root note, scale, and optional chord overlay to
                visualize notes and intervals across a 6-string guitar neck.
              </p>

              <h3>Layout</h3>
              <ul>
                <li>
                  <strong>Mobile:</strong> The fretboard fills the center of the
                  screen. A tab bar below switches between the <em>Theory</em>{" "}
                  panel (scale, chord, Circle of Fifths) and the <em>View</em>{" "}
                  panel (fingering patterns, note labels).
                </li>
                <li>
                  <strong>Tablet &amp; desktop:</strong> Controls appear
                  alongside the fretboard in three cards — Music Theory,
                  Configuration, and Key Explorer.
                </li>
              </ul>

              <h3>Choosing a Scale</h3>
              <ul>
                <li>
                  <strong>Root:</strong> Tap a note in the note grid to set the
                  tonic.
                </li>
                <li>
                  <strong>Scale Family:</strong> Choose a broad family
                  (Pentatonic, Diatonic, etc.) from the dropdown.
                </li>
                <li>
                  <strong>Mode / Scale browser:</strong> Use the arrows or
                  dropdown to step through the modes or keys within that family.
                  The <em>Parallel</em> / <em>Relative</em> toggle controls
                  whether browsing stays on the same root or cycles through
                  relative keys.
                </li>
              </ul>

              <h3>Chord Overlay</h3>
              <ul>
                <li>
                  Expand <strong>Chord Overlay</strong> and pick a chord type to
                  highlight chord tones on the fretboard in a distinct color.
                </li>
                <li>
                  <strong>Link chord root to scale</strong> keeps the chord root
                  in sync with the scale root automatically.
                </li>
              </ul>

              <h3>Practice Lenses</h3>
              <p>
                When a chord overlay is active, a <strong>Lens</strong> selector
                appears below it. Lenses shape what the fretboard and practice
                bar show. Four lenses are available:
              </p>
              <ul>
                <li>
                  <strong>Chord Tones</strong> — the default lens. Highlights
                  every chord member (root, 3rd, 5th, 7th, etc.) and shows a{" "}
                  <em>Land on</em> cue in the practice bar listing all of them.
                  Scale notes remain visible. Use this to learn the shape of a
                  chord across the neck and practice landing phrases on strong
                  harmonic tones.
                </li>
                <li>
                  <strong>Guide Tones</strong> — narrows focus to the 3rd and
                  7th only. These two intervals define chord quality more than
                  any others, and moving smoothly between them across chord
                  changes is the core of jazz voice-leading. The practice bar
                  shows a <em>Guide tones</em> cue with just those two notes
                  marked. Only available for chords that contain a 3rd or 7th
                  (not power chords).
                </li>
                <li>
                  <strong>Tension</strong> — surfaces chord tones that fall
                  outside the active scale. These are the &ldquo;altered&rdquo;
                  or &ldquo;outside&rdquo; tones that create tension and need
                  resolution back into the scale. The practice bar shows three
                  cue rows: <em>Land on</em> (all chord tones),{" "}
                  <em>Tension</em> (the outside tones), and{" "}
                  <em>Resolve to</em> (the nearest in-scale neighbors for each
                  tension note). This lens is hidden automatically when the
                  chord is fully within the scale — no outside tones, no
                  tension to show.
                </li>
                <li>
                  <strong>Chord Only</strong> — hides all scale notes that are
                  not part of the chord, leaving only the chord tones visible on
                  the fretboard. Use this to see exactly where each chord tone
                  sits without the distraction of the surrounding scale.
                </li>
              </ul>

              <h3>Fingering Patterns</h3>
              <ul>
                <li>
                  <strong>All:</strong> Highlights every scale note with no
                  positional shapes.
                </li>
                <li>
                  <strong>CAGED:</strong> Shows overlapping position shapes
                  across the neck. Click a shape (C / A / G / E / D) to isolate
                  it; Shift-click to toggle multiple shapes. Enable{" "}
                  <em>Shape Labels</em> to letter each polygon.
                </li>
                <li>
                  <strong>3NPS:</strong> Shows 3-notes-per-string positions. Use
                  the position selector (1–7 or All) to isolate a single hand
                  position.
                </li>
              </ul>

              <h3>Note Labels &amp; Degree Strip</h3>
              <ul>
                <li>
                  The <strong>Note Labels</strong> toggle (Notes / Intervals /
                  None) controls what appears inside each fretboard dot.
                </li>
                <li>
                  The <strong>degree strip</strong> between the header and the
                  fretboard lists the scale's notes with their interval name
                  below each one. Chord tones are highlighted when a chord is
                  active.
                </li>
              </ul>

              <h3>Circle of Fifths</h3>
              <p>
                Tap any key segment to change the root note. Degree markers
                around the circle show how the current scale's intervals relate
                to each key. On mobile, expand it from the <em>Theory</em> tab
                under <em>Circle of Fifths</em>.
              </p>

              <h3>Header Controls</h3>
              <ul>
                <li>
                  <strong>Settings (gear icon):</strong> Opens a drawer for
                  Tuning, Zoom, Fret Range, Accidentals, Enharmonic Display, and
                  Chord Spread. Use Settings → Reset to restore all defaults.
                </li>
                <li>
                  <strong>Speaker icon:</strong> Toggles audio playback. Tap any
                  fretboard dot to hear the note when unmuted.
                </li>
              </ul>

              <h3>Tips</h3>
              <ul>
                <li>
                  Drag or scroll the fretboard horizontally when zoomed in.
                </li>
                <li>
                  The fret range control (in Settings or the Configuration card)
                  lets you focus on a specific section of the neck.
                </li>
                <li>
                  Use CAGED or 3NPS shapes to see how the same scale maps to
                  different hand positions.
                </li>
                <li>
                  Switch between Parallel and Relative browsing to explore
                  related modes without leaving the current key.
                </li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
