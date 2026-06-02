import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { SuggestionFeel } from "../../progressions/progressionGeneration";
import styles from "./PresetMenu.module.css";

export interface PresetMenuOption {
  id: string;
  label: string;
}

export interface PresetMenuCategory {
  label: string;
  options: PresetMenuOption[];
}

export interface PresetMenuSuggestionGroup {
  feel: SuggestionFeel;
  label: string;
  options: PresetMenuOption[];
}

export interface PresetMenuProps {
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  /** Text shown on the trigger when no option matches `currentId`. */
  customLabel: string;
  /** Display label of the active scale, used in the "Suggested for <scaleLabel>"
   * submenu heading (e.g. "Natural Minor (Aeolian)"). */
  scaleLabel: string;
  /** Id of the active preset/suggestion (or a custom sentinel). */
  currentId: string;
  categories: PresetMenuCategory[];
  suggestionGroups: PresetMenuSuggestionGroup[];
  disabled?: boolean;
  /** Sizing for the trigger. "auto" (default) is intrinsic; "fill" stretches
   * to the parent width, matching `LabeledSelect width="fill"`. */
  width?: "fill" | "auto";
  onSelect: (id: string) => void;
}

function findLabel(
  currentId: string,
  categories: PresetMenuCategory[],
  suggestionGroups: PresetMenuSuggestionGroup[],
  fallback: string,
): string {
  for (const cat of categories) {
    const hit = cat.options.find((o) => o.id === currentId);
    if (hit) return hit.label;
  }
  for (const group of suggestionGroups) {
    const hit = group.options.find((o) => o.id === currentId);
    if (hit) return hit.label;
  }
  return fallback;
}

function MenuOption({
  option,
  currentId,
  onSelect,
}: {
  option: PresetMenuOption;
  currentId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenu.Item
      className={styles["preset-menu-item"]}
      aria-current={option.id === currentId ? "true" : undefined}
      onSelect={() => onSelect(option.id)}
    >
      <span className={styles["preset-menu-item-indicator"]}>
        {option.id === currentId && <Check size={14} aria-hidden="true" />}
      </span>
      <span>{option.label}</span>
    </DropdownMenu.Item>
  );
}

export function PresetMenu({
  triggerLabel,
  customLabel,
  scaleLabel,
  currentId,
  categories,
  suggestionGroups,
  disabled,
  width = "auto",
  onSelect,
}: PresetMenuProps) {
  const currentLabel = findLabel(
    currentId,
    categories,
    suggestionGroups,
    customLabel,
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={clsx(styles["preset-menu-trigger"], {
          [styles["preset-menu-trigger--fill"]]: width === "fill",
        })}
        aria-label={triggerLabel}
        disabled={disabled}
      >
        <span className={styles["preset-menu-trigger-value"]}>{currentLabel}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={styles["preset-menu-chevron"]}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles["preset-menu-content"]}
          sideOffset={4}
          align="start"
          collisionPadding={{
            top: 8,
            right: 8,
            bottom: 8,
            left: 8,
          }}
        >
          {categories.map((category) => (
            <DropdownMenu.Sub key={category.label}>
              <DropdownMenu.SubTrigger className={styles["preset-menu-subtrigger"]}>
                <span>{category.label}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  className={styles["preset-menu-content"]}
                  sideOffset={2}
                  alignOffset={-4}
                  collisionPadding={{
                    top: 8,
                    right: 8,
                    bottom: 8,
                    left: 8,
                  }}
                >
                  {category.options.map((option) => (
                    <MenuOption
                      key={option.id}
                      option={option}
                      currentId={currentId}
                      onSelect={onSelect}
                    />
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          ))}

          {suggestionGroups.length > 0 && (
            <>
              <DropdownMenu.Separator className={styles["preset-menu-separator"]} />
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className={styles["preset-menu-subtrigger"]}>
                  <span>{`Suggested for ${scaleLabel}`}</span>
                  <ChevronRight size={14} aria-hidden="true" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    className={styles["preset-menu-content"]}
                    sideOffset={2}
                    alignOffset={-4}
                    collisionPadding={{
                      top: 8,
                      right: 8,
                      bottom: 8,
                      left: 8,
                    }}
                  >
                    {suggestionGroups.map((group, index) => (
                      <DropdownMenu.Group key={group.feel}>
                        {index > 0 && (
                          <DropdownMenu.Separator
                            className={styles["preset-menu-separator"]}
                          />
                        )}
                        <DropdownMenu.Label className={styles["preset-menu-group-label"]}>
                          {group.label}
                        </DropdownMenu.Label>
                        {group.options.map((option) => (
                          <MenuOption
                            key={option.id}
                            option={option}
                            currentId={currentId}
                            onSelect={onSelect}
                          />
                        ))}
                      </DropdownMenu.Group>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
