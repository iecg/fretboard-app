import React, { Fragment, useId } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import styles from './LabeledSelect.module.css';

export interface LabeledSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /**
   * Optional rich content rendered in the dropdown item (and the trigger when
   * selected, unless `triggerContent` is also given). When provided, `label` is
   * still used as the typeahead / accessible text. Use for columnar / multi-part
   * option layouts.
   */
  content?: React.ReactNode;
  /**
   * Optional compact content rendered in the *trigger* when this option is
   * selected, distinct from the (richer) dropdown `content`. Lets the closed
   * control show a tighter value than the list rows.
   */
  triggerContent?: React.ReactNode;
}

export interface LabeledSelectGroup {
  /** Optional group heading. Omit for an ungrouped run of items. */
  groupLabel?: string;
  options: LabeledSelectOption[];
}

interface LabeledSelectBaseProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  'data-testid'?: string;
  'aria-describedby'?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  /** Sizing mode for the trigger. Defaults to "fill" (100% of parent).
   *
   * - "fill" — trigger stretches to fill parent container (most selects)
   * - "fixed" — caller specifies an exact width via `widthValue` (e.g. "6rem")
   *             so the trigger is a stable shape regardless of selected option
   * - "auto" — content-sized (intrinsic), min 5rem
   */
  width?: "fill" | "fixed" | "auto";
  /** Required when width="fixed". CSS length applied to the trigger. */
  widthValue?: string;
  /** Render the selected value in the accent color (e.g. the chord ROOT). */
  accentValue?: boolean;
  /**
   * @deprecated use `width="auto"`. Kept as an alias for back-compat during
   * the Plan H sweep.
   */
  fit?: boolean;
}

/** Exactly one of `options` (flat) or `groups` (grouped) must be provided. */
export type LabeledSelectProps = LabeledSelectBaseProps &
  (
    | { options: LabeledSelectOption[]; groups?: never }
    | { groups: LabeledSelectGroup[]; options?: never }
  );

function LabeledSelectItem({ value, label, disabled, content }: LabeledSelectOption) {
  return (
    <Select.Item
      value={value}
      disabled={disabled}
      textValue={label}
      className={styles['labeled-select-item']}
    >
      <Select.ItemText>{content ?? label}</Select.ItemText>
      <Select.ItemIndicator className={styles['labeled-select-item-indicator']}>
        <Check size={14} aria-hidden="true" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

export function LabeledSelect({
  label,
  value,
  options,
  groups,
  onChange,
  id,
  className,
  'data-testid': dataTestId,
  'aria-describedby': ariaDescribedBy,
  disabled,
  hideLabel,
  width,
  widthValue,
  accentValue,
  fit,
}: LabeledSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const labelId = `${selectId}-label`;

  const resolvedWidth: "fill" | "fixed" | "auto" =
    width ?? (fit ? "auto" : "fill");

  // When the selected option supplies `triggerContent`, render it in the closed
  // trigger (a tighter value than the list rows). Otherwise let Radix render the
  // selected item's text/content by default.
  const allOptions = groups ? groups.flatMap((g) => g.options) : (options ?? []);
  const selectedTriggerContent = allOptions.find((o) => o.value === value)?.triggerContent;

  return (
    <div
      className={clsx(
        styles['labeled-select'],
        {
          [styles['labeled-select--disabled']]: disabled,
          [styles['labeled-select--hide-label']]: hideLabel,
        },
        className,
      )}
      data-width={resolvedWidth === "fill" ? undefined : resolvedWidth}
      style={
        resolvedWidth === "fixed" && widthValue
          ? ({ "--labeled-select-width": widthValue } as React.CSSProperties)
          : undefined
      }
    >
      <span id={labelId} className={styles['labeled-select-label-text']}>
        {label}
      </span>
      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          id={selectId}
          className={clsx(
            styles['labeled-select-trigger'],
            accentValue && styles['labeled-select-trigger--accent-value'],
          )}
          aria-labelledby={labelId}
          aria-describedby={ariaDescribedBy}
          data-testid={dataTestId}
        >
          {selectedTriggerContent
            ? <Select.Value>{selectedTriggerContent}</Select.Value>
            : <Select.Value />}
          <Select.Icon className={styles['labeled-select-chevron']}>
            <ChevronDown size={16} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className={styles['labeled-select-content']}
            position="popper"
            sideOffset={4}
          >
            <Select.ScrollUpButton className={styles['labeled-select-scroll-button']}>
              ▲
            </Select.ScrollUpButton>
            <Select.Viewport className={styles['labeled-select-viewport']}>
              {groups
                ? groups.map((group, index) => (
                    <Fragment key={group.groupLabel ?? `group-${index}`}>
                      {index > 0 && (
                        <Select.Separator
                          className={styles['labeled-select-separator']}
                        />
                      )}
                      <Select.Group>
                        {group.groupLabel && (
                          <Select.Label
                            className={styles['labeled-select-group-label']}
                          >
                            {group.groupLabel}
                          </Select.Label>
                        )}
                        {group.options.map((option) => (
                          <LabeledSelectItem key={option.value} {...option} />
                        ))}
                      </Select.Group>
                    </Fragment>
                  ))
                : (options ?? []).map((option) => (
                    <LabeledSelectItem key={option.value} {...option} />
                  ))}
            </Select.Viewport>
            <Select.ScrollDownButton className={styles['labeled-select-scroll-button']}>
              ▼
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
