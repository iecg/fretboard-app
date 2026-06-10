import type { ReactNode, RefObject } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import {
  HelpCircle,
  Moon,
  MoreVertical,
  Settings2,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ANIMATION_DURATION_XFADE } from "@fretflow/core";
import { isMutedAtom, toggleMuteAtom } from "../../store/audioAtoms";
import { settingsOverlayOpenAtom, themeAtom } from "../../store/uiAtoms";
import { useResolvedTheme } from "../../hooks/useResolvedTheme";
import { useTranslation } from "../../hooks/useTranslation";
import { SettingsTooltip } from "../SettingsTooltip/SettingsTooltip";
import { getCollisionPadding } from "../../utils/collision";
import sharedStyles from "../shared/shared.module.css";
import styles from "./AppHeaderActions.module.css";

export interface AppHeaderActionsProps {
  /** "buttons" (desktop): four inline icon buttons.
   *  "menu" (mobile): a single overflow trigger opening a dropdown. */
  variant: "buttons" | "menu";
  /** Opens the help modal. Owned by App so help open-state stays local there. */
  onShowHelp: () => void;
  /** Focus-return target for the help modal — applies to the buttons variant
   *  only (the menu variant's help item is a Radix menu item). */
  helpTriggerRef?: RefObject<HTMLButtonElement | null>;
}

interface HeaderAction {
  id: string;
  label: string;
  /** Accessible name / title for the buttons variant. */
  ariaLabel: string;
  title: string;
  /** Plain icon used in the menu variant. */
  menuIcon: ReactNode;
  run: () => void;
}

export function AppHeaderActions({
  variant,
  onShowHelp,
  helpTriggerRef,
}: AppHeaderActionsProps) {
  const { t } = useTranslation();
  const theme = useResolvedTheme();
  const setTheme = useSetAtom(themeAtom);
  const isMuted = useAtomValue(isMutedAtom);
  const toggleMute = useSetAtom(toggleMuteAtom);
  const setSettingsOverlayOpen = useSetAtom(settingsOverlayOpenAtom);

  const isDark = theme === "modern-dark";

  // Single source of truth for the four actions — shared by both variants so
  // handlers and labels never drift.
  const actions: HeaderAction[] = [
    {
      id: "theme",
      label: isDark ? t("common.themeToLight") : t("common.themeToDark"),
      ariaLabel: isDark ? t("common.themeToLight") : t("common.themeToDark"),
      title: isDark ? t("common.themeToLight") : t("common.themeToDark"),
      menuIcon: isDark ? <Sun className="icon" /> : <Moon className="icon" />,
      run: () => setTheme(isDark ? "light" : "dark"),
    },
    {
      id: "settings",
      label: t("settings.title"),
      ariaLabel: t("settings.open"),
      title: t("settings.title"),
      menuIcon: <Settings2 className="icon" />,
      run: () => setSettingsOverlayOpen((v) => !v),
    },
    {
      id: "mute",
      label: isMuted ? t("common.unmuteTitle") : t("common.muteTitle"),
      ariaLabel: isMuted ? t("common.unmute") : t("common.mute"),
      title: isMuted ? t("common.unmuteTitle") : t("common.muteTitle"),
      menuIcon: isMuted ? (
        <VolumeX className="icon icon-muted" />
      ) : (
        <Volume2 className="icon icon-active" />
      ),
      run: () => toggleMute(),
    },
    {
      id: "help",
      label: t("common.helpTitle"),
      ariaLabel: t("common.help"),
      title: t("common.helpTitle"),
      menuIcon: <HelpCircle className="icon" />,
      run: onShowHelp,
    },
  ];

  if (variant === "menu") {
    const padding = getCollisionPadding();
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          type="button"
          data-testid="header-overflow-trigger"
          className={clsx(
            sharedStyles["icon-button"],
            sharedStyles["icon-button--sm"],
          )}
          title={t("common.moreActions")}
          aria-label={t("common.moreActions")}
        >
          <MoreVertical className="icon" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles["menu-content"]}
            sideOffset={4}
            align="end"
            collisionPadding={padding}
          >
            {actions.map((action) => (
              <DropdownMenu.Item
                key={action.id}
                className={styles["menu-item"]}
                onSelect={action.run}
              >
                <span className={styles["menu-item-icon"]} aria-hidden="true">
                  {action.menuIcon}
                </span>
                <span>{action.label}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  // Buttons variant: each button's handler, labels, title, and icon come from
  // the shared `actions` array — only the per-id presentation wrapper differs
  // (SettingsTooltip on settings, the crossfade on mute, the focus-return ref
  // on help). This keeps handlers/labels single-sourced with the menu variant.
  const renderButton = (action: HeaderAction) => {
    const button = (
      <button
        key={action.id}
        ref={action.id === "help" ? helpTriggerRef : undefined}
        type="button"
        onClick={action.run}
        className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
        title={action.title}
        aria-label={action.ariaLabel}
      >
        {action.id === "mute" ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isMuted ? "muted" : "unmuted"}
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
              transition={{ duration: ANIMATION_DURATION_XFADE }}
              className={sharedStyles["flex-center"]}
            >
              {action.menuIcon}
            </motion.span>
          </AnimatePresence>
        ) : (
          action.menuIcon
        )}
      </button>
    );

    if (action.id === "settings") {
      return <SettingsTooltip key={action.id}>{button}</SettingsTooltip>;
    }
    return button;
  };

  return <>{actions.map(renderButton)}</>;
}
