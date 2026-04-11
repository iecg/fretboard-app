import { useEffect, type ReactNode } from "react";
import { useAtom } from "jotai";
import clsx from "clsx";
import { X } from "lucide-react";
import { settingsOverlayOpenAtom } from "../store/atoms";
import "./SettingsOverlay.css";

interface SettingsOverlayProps {
  children?: ReactNode;
}

export default function SettingsOverlay({ children }: SettingsOverlayProps) {
  const [isOpen, setIsOpen] = useAtom(settingsOverlayOpenAtom);

  const close = () => setIsOpen(false);

  // ESC closes the overlay when open.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        aria-hidden={!isOpen}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-overlay-header">
          <span className="settings-overlay-title">Settings</span>
          <button
            type="button"
            className="settings-overlay-close"
            onClick={close}
            aria-label="Close settings"
          >
            <X className="icon" />
          </button>
        </div>
        <div className="settings-overlay-content">{children}</div>
      </div>
    </>
  );
}
