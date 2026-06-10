import { type ReactNode } from "react";
import { Drawer } from "vaul";
import { useAtom } from "jotai";
import { mobileSheetSnapAtom } from "../../store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import { SNAP_POINTS, snapIdToPoint, pointToSnapId } from "./mobileSheetSnap";
import sharedStyles from "../shared/shared.module.css";
import styles from "./MobileSheet.module.css";

interface MobileSheetProps {
  /** Mini-player transport row, always visible, pinned at sheet top. */
  peek: ReactNode;
  /** Expanded content (tabs). */
  children: ReactNode;
}

/**
 * Always-open, non-modal bottom sheet. Non-modal so the fretboard stays
 * interactive behind it; non-dismissible so it can never be flung away —
 * "peek" is the floor.
 */
export function MobileSheet({ peek, children }: MobileSheetProps) {
  const { t } = useTranslation();
  const [snapId, setSnapId] = useAtom(mobileSheetSnapAtom);
  // vaul's Drawer.Portal reparents Drawer.Content to <body>, so the portaled
  // subtree escapes the MobileShell `.shell` root that carries the layout
  // attributes. Re-stamp the real tier/variant here so every tier-scoped CSS
  // rule (Inspector grid/card, SongControls/TransportBar mobile rules, touch
  // targets) participates inside the sheet exactly as it does in the main shell.
  // Use the real values — tablet-split also renders the sheet, so this must not
  // be hardcoded to "mobile".
  const { tier, variant } = useLayoutMode();

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snapIdToPoint(snapId)}
      setActiveSnapPoint={(p) => setSnapId(pointToSnapId(p))}
    >
      <Drawer.Portal>
        <Drawer.Content
          className={styles.content}
          data-testid="mobile-sheet"
          data-layout-tier={tier}
          data-layout-variant={variant}
          aria-describedby={undefined}
        >
          <Drawer.Title className={sharedStyles["sr-only"]}>
            {t("mobileSheet.label")}
          </Drawer.Title>
          <div className={styles.handle} aria-hidden="true" />
          <div className={styles.peek}>{peek}</div>
          <div className={styles.body} data-snap={snapId}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
