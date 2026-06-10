import {
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom } from "jotai";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import { helpWhatsNewSeenAtom } from "../../store/uiAtoms";
import { HELP_TABS, CURRENT_WHATS_NEW_ID, type HelpTab } from "./helpContent";
import { HelpDiagram } from "./diagrams/HelpDiagram";
import { AdaptiveModal } from "../shared/AdaptiveModal";
import styles from "./HelpModal.module.css";
import sharedStyles from "../shared/shared.module.css";

const TAB_IDS = HELP_TABS.map((tab) => tab.id);

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

function HelpTabPanel({ tab }: { tab: HelpTab }) {
  const { t } = useTranslation();
  return (
    <div role="tabpanel" id={`help-panel-${tab.id}`} aria-labelledby={`help-tab-${tab.id}`}>
      {tab.sections.map((section) => (
        <section key={section.titleKey}>
          <h3>{t(section.titleKey)}</h3>
          {section.diagram ? <HelpDiagram id={section.diagram} /> : null}
          {section.items.map((item) => (
            <p key={item.bodyKey}>
              {item.labelKey ? (
                <>
                  <strong className={styles["help-modal-item-label"]}>
                    {t(item.labelKey)}
                  </strong>{" "}
                </>
              ) : null}
              {t(item.bodyKey)}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Single-source help body — the tablist + active panel + what's-new notice
 * shared by both the desktop dialog and the mobile sheet. Tab state lives here
 * so both presentations get identical behavior without duplicated markup.
 */
function HelpBody() {
  const { t } = useTranslation();
  const [whatsNewSeen, setWhatsNewSeen] = useAtom(helpWhatsNewSeenAtom);
  const [activeTabId, setActiveTabId] = useState<HelpTab["id"]>("start");

  const activeTab = HELP_TABS.find((tab) => tab.id === activeTabId) ?? HELP_TABS[0];
  const showWhatsNew = whatsNewSeen !== CURRENT_WHATS_NEW_ID;

  function handleTabsKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const current = TAB_IDS.indexOf(activeTabId);
    let nextIndex = -1;
    if (e.key === "ArrowRight") nextIndex = (current + 1) % TAB_IDS.length;
    else if (e.key === "ArrowLeft") nextIndex = (current - 1 + TAB_IDS.length) % TAB_IDS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = TAB_IDS.length - 1;
    if (nextIndex === -1) return;
    e.preventDefault();
    const nextId = TAB_IDS[nextIndex];
    setActiveTabId(nextId);
    e.currentTarget
      .querySelector<HTMLButtonElement>(`#help-tab-${nextId}`)
      ?.focus();
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- tablist uses roving tabindex; individual tabs are focusable */}
      <div className={styles["help-modal-tabs"]} role="tablist" aria-label={t("help.title")} onKeyDown={handleTabsKeyDown}>
        {HELP_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`help-tab-${tab.id}`}
            aria-selected={tab.id === activeTabId}
            aria-controls={`help-panel-${tab.id}`}
            className={styles["help-modal-tab"]}
            tabIndex={tab.id === activeTabId ? 0 : -1}
            onClick={() => setActiveTabId(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className={styles["help-modal-content"]} data-testid="help-modal-content">
        {showWhatsNew && activeTabId === "start" ? (
          <aside
            className={styles["help-modal-notice"]}
            data-testid="help-modal-whats-new"
            aria-label={t("help.whatsNew.label")}
          >
            <h3 className={styles["help-modal-notice-title"]}>
              {t("help.whatsNew.label")}
            </h3>
            <p>{t("help.whatsNew.body")}</p>
            <button
              type="button"
              className={styles["help-modal-notice-dismiss"]}
              onClick={() => setWhatsNewSeen(CURRENT_WHATS_NEW_ID)}
            >
              {t("help.whatsNew.dismiss")}
            </button>
          </aside>
        ) : null}

        <HelpTabPanel tab={activeTab} />
      </div>
    </>
  );
}

export function HelpModal({ isOpen, onClose, triggerRef }: HelpModalProps) {
  const { t } = useTranslation();
  const { useSheetShell } = useLayoutMode();

  /* Desktop focus-return. Restoring focus to the Help trigger after close is an
     a11y requirement (keyboard + screen-reader users must not be dumped on
     <body>). Only runs on the desktop path (`!useSheetShell`) — the touch
     shell uses the sheet, where vaul manages focus. Radix's own
     onCloseAutoFocus does not fire here — the dialog uses
     Portal forceMount and is conditionally unmounted by the `isOpen` guard, so
     Radix never runs its close-autofocus lifecycle (verified live: 0 calls) —
     and there is no Radix Dialog.Trigger to restore to (the trigger lives in
     the app header). So on the open→closed transition (desktop only) we
     persistently reclaim focus for the Help trigger every frame across a short
     window, re-reading the ref each frame (the header may re-render and swap the
     button node) and stopping as soon as focus sticks on the trigger. (On the
     mobile sheet, vaul manages focus and returns it to the document, not the
     trigger, which is acceptable.)

     NOTE: the desktop dialog's motion exit (motion.div as a Radix
     `Dialog.Content asChild` + forceMount child) can leave the content mounted
     at data-state="closed" with Radix's focus guards still trapping focus for a
     while — a pre-existing quirk of this modal, unchanged by this task. While
     that trap is active our reclaim loses to it; focus lands on the trigger once
     the guards release (and the jsdom test, where the exit unmounts promptly,
     verifies the wiring). */
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current || useSheetShell) return;
    wasOpenRef.current = false;

    let rafId = 0;
    const deadline = performance.now() + 2000;
    const reclaim = () => {
      const trigger = triggerRef?.current;
      if (!trigger) return;
      if (document.activeElement === trigger) return; // focus stuck — done
      trigger.focus();
      if (performance.now() > deadline) return;
      rafId = window.requestAnimationFrame(reclaim);
    };
    rafId = window.requestAnimationFrame(reclaim);
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, useSheetShell, triggerRef]);

  /* Touch shell (mobile or tablet-split): present as a full-height
     swipe-to-dismiss sheet. Focus-return to the trigger is NOT wired here —
     vaul manages focus and returns it to the document on close. (The desktop
     path restores focus via the effect above.) */
  if (useSheetShell) {
    return (
      <AdaptiveModal
        presentation="sheet"
        open={isOpen}
        onOpenChange={(open) => { if (!open) onClose(); }}
        label={t("help.title")}
      >
        <div className={styles["help-modal-header"]}>
          <h2 className={styles["help-modal-title"]}>{t("help.title")}</h2>
          <button
            type="button"
            className={clsx(
              sharedStyles["icon-button"],
              sharedStyles["icon-button--sm"],
              styles["help-modal-close"],
            )}
            aria-label={t("help.close")}
            onClick={onClose}
          >
            <X className="icon" />
          </button>
        </div>
        <HelpBody />
      </AdaptiveModal>
    );
  }

  /* Desktop (non-sheet shell): centered Radix Dialog with motion fade/scale. */
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {isOpen ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className={styles["help-modal-overlay"]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              // Idiomatic Radix focus-return. In practice it does not fire for
              // this dialog (forceMount + conditional unmount), so the effect
              // above is the mechanism that actually restores focus; this stays
              // as a correct fallback should the mount strategy ever change.
              onCloseAutoFocus={(e) => {
                if (triggerRef?.current) {
                  e.preventDefault();
                  triggerRef.current.focus();
                }
              }}
            >
              <motion.div
                className={styles["help-modal"]}
                data-testid="help-modal"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              >
                <div className={styles["help-modal-header"]}>
                  <Dialog.Title className={styles["help-modal-title"]}>
                    {t("help.title")}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className={clsx(
                        sharedStyles["icon-button"],
                        sharedStyles["icon-button--sm"],
                        styles["help-modal-close"],
                      )}
                      aria-label={t("help.close")}
                    >
                      <X className="icon" />
                    </button>
                  </Dialog.Close>
                </div>

                <HelpBody />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
