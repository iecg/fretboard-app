import {
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  useState,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom } from "jotai";
import { X } from "lucide-react";
import clsx from "clsx";
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

  /* Desktop (non-sheet shell): centered Radix Dialog. Radix owns mount/unmount
     via its built-in Presence, so the enter/exit animations are CSS keyframes
     keyed on `[data-state]` (see HelpModal.module.css). This is what makes the
     dialog actually tear down on close — running FocusScope's teardown and the
     `onCloseAutoFocus` below — instead of the old forceMount + AnimatePresence
     pairing, where AnimatePresence never released the portaled subtree and the
     dialog (plus its focus trap and scroll lock) lingered mounted forever. */
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles["help-modal-overlay"]} />
        <Dialog.Content
          className={styles["help-modal"]}
          data-testid="help-modal"
          // Restore focus to the Help trigger on close (the trigger lives in the
          // app header, so there is no Radix Dialog.Trigger to auto-restore to).
          // Re-read the ref at close time in case the header re-rendered and
          // swapped the button node.
          onCloseAutoFocus={(e) => {
            if (triggerRef?.current) {
              e.preventDefault();
              triggerRef.current.focus();
            }
          }}
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
