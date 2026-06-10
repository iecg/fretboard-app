import { type ReactNode, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { useSetAtom } from "jotai";
import { openModalSheetCountAtom } from "../../store/uiAtoms";
import sharedStyles from "./shared.module.css";
import styles from "./AdaptiveModal.module.css";

interface AdaptiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "dialog" = centered Radix dialog (desktop); "sheet" = full-height vaul drawer (mobile). */
  presentation: "dialog" | "sheet";
  /** Accessible name (aria-label / Drawer.Title / Dialog.Title). */
  label: string;
  children: ReactNode;
}

/**
 * Shared modal primitive. Presents content as a centered Radix Dialog on
 * desktop (`presentation="dialog"`) or a full-height, swipe-to-dismiss vaul
 * Drawer on mobile (`presentation="sheet"`). Both paths are controlled
 * (`open` / `onOpenChange`) and dismissible (Escape, overlay click, or — for
 * the sheet — a swipe-down drag).
 *
 * Both presentations carry a visually-hidden Title (Radix Dialog and vaul both
 * warn without one) which Radix wires up as the accessible name via
 * `aria-labelledby`. `aria-describedby={undefined}` opts out of Radix's
 * Description requirement to silence its dev-only console warning.
 */
export function AdaptiveModal({
  open,
  onOpenChange,
  presentation,
  label,
  children,
}: AdaptiveModalProps) {
  const setOpenModalSheetCount = useSetAtom(openModalSheetCountAtom);

  // A modal sheet (Settings / Help on mobile) legitimately aria-hides the
  // background via Radix's `hideOthers`. Register while open so the persistent
  // MobileSheet's un-hiding observer (`useUnhideMobileShell`) stands down and
  // does not fight that intended modal hiding. Only the sheet presentation is
  // modal-over-the-shell; the desktop "dialog" path doesn't share the mobile
  // shell surface, so it doesn't participate.
  const isOpenSheet = presentation === "sheet" && open;
  useEffect(() => {
    if (!isOpenSheet) return;
    setOpenModalSheetCount((c) => c + 1);
    return () => setOpenModalSheetCount((c) => c - 1);
  }, [isOpenSheet, setOpenModalSheetCount]);

  if (presentation === "sheet") {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className={styles.overlay} />
          <Drawer.Content
            className={styles.sheet}
            data-testid="adaptive-modal-sheet"
            aria-describedby={undefined}
          >
            <Drawer.Title className={sharedStyles["sr-only"]}>{label}</Drawer.Title>
            <Drawer.Handle className={styles.sheetHandle} />
            <div className={styles.sheetBody}>{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog} aria-describedby={undefined}>
          <Dialog.Title className={sharedStyles["sr-only"]}>{label}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
