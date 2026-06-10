import { type RefObject, type KeyboardEvent as ReactKeyboardEvent, useState } from "react";
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

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useTranslation();
  const { tier } = useLayoutMode();

  /* Mobile: present as a full-height swipe-to-dismiss sheet. Focus-return to
     the trigger is managed by vaul (focus returns to body/trigger as vaul
     dictates rather than via Radix's triggerRef restore). */
  if (tier === "mobile") {
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

  /* Desktop / tablet: centered Radix Dialog with motion fade/scale. */
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
            <Dialog.Content asChild>
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
