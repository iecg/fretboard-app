import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import styles from "./DrawerSelector.module.css";
import { DRAWER_DROPUP_THRESHOLD } from "./core/constants";

type DrawerSelectorOption = string | { divider: string };

interface DrawerSelectorBaseProps {
  label: string;
  options: DrawerSelectorOption[];
}

interface DrawerSelectorNullableProps extends DrawerSelectorBaseProps {
  value: string | null;
  onSelect: (opt: string | null) => void;
  nullable: true;
}

interface DrawerSelectorNonNullableProps extends DrawerSelectorBaseProps {
  value: string;
  onSelect: (opt: string) => void;
  nullable?: boolean;
}

type DrawerSelectorProps =
  | DrawerSelectorNullableProps
  | DrawerSelectorNonNullableProps;

function isNullableDrawerSelectorProps(
  props: DrawerSelectorProps,
): props is DrawerSelectorNullableProps {
  return props.nullable === true;
}

export function DrawerSelector(props: DrawerSelectorProps) {
  const { label, value, options } = props;
  const nullable = isNullableDrawerSelectorProps(props);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const flatOptions = [
    ...(nullable ? [null as string | null] : []),
    ...options.filter((o): o is string => typeof o === "string"),
  ];

  const selectedIndex = flatOptions.findIndex((opt) => opt === value);

  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }

  useEffect(() => {
    if (open && listboxRef.current) {
      listboxRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !listboxRef.current) return;
    const focused = listboxRef.current.querySelector<HTMLElement>(
      `.${styles["drawer-option"]}.${styles.focused}`,
    );
    focused?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < DRAWER_DROPUP_THRESHOLD);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const sanitizeId = (s: string) =>
    s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const listboxId = `${label.toLowerCase().replace(/\s+/g, '-')}-listbox`;
  const triggerId = `${label.toLowerCase().replace(/\s+/g, '-')}-trigger`;

  return (
    <div className={styles["drawer-selector"]} ref={containerRef}>
      <button
        id={triggerId}
        ref={triggerRef}
        className={clsx(styles["drawer-trigger"], open && styles.open)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
            }
          }
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={`${label}: ${value ?? "None"}`}
      >
        <span className={styles["drawer-label"]}>{label}</span>
        <span className={styles["drawer-value"]}>{value ?? "None"}</span>
        <ChevronDown
          className={clsx(styles["drawer-chevron"], open && styles.open)}
        />
      </button>
      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          aria-activedescendant={flatOptions[activeIndex] === null ? `${listboxId}-none` : `${listboxId}-${sanitizeId(flatOptions[activeIndex] as string)}`}
          className={clsx(
            styles["drawer-options"],
            "custom-scrollbar",
            dropUp && styles["drawer-options--above"],
          )}
          onKeyDown={(e) => {
            switch (e.key) {
              case "ArrowDown":
                e.preventDefault();
                setActiveIndex((prev) => Math.min(prev + 1, flatOptions.length - 1));
                break;
              case "ArrowUp":
                e.preventDefault();
                setActiveIndex((prev) => Math.max(prev - 1, 0));
                break;
              case "Home":
                e.preventDefault();
                setActiveIndex(0);
                break;
              case "End":
                e.preventDefault();
                setActiveIndex(flatOptions.length - 1);
                break;
              case "Enter":
              case " ":
                {
                  e.preventDefault();
                  const selected = flatOptions[activeIndex];
                  if (selected !== undefined) {
                    if (selected === null) {
                      if (nullable) props.onSelect(null);
                    } else {
                      props.onSelect(selected);
                    }
                  }
                  setOpen(false);
                  triggerRef.current?.focus();
                  break;
                }
              case "Escape":
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
                break;
              case "Tab":
                setOpen(false);
                break;
            }
          }}
        >
          {nullable && (
            <button
              type="button"
              id={`${listboxId}-none`}
              data-index={0}
              className={clsx(
                styles["drawer-option"],
                value === null && styles.active,
                activeIndex === 0 && styles.focused,
              )}
              onClick={() => {
                props.onSelect(null);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              role="option"
              aria-selected={value === null}
              tabIndex={-1}
            >
              None
            </button>
          )}
          {(() => {
            let flatIndex = nullable ? 1 : 0;
            return options.map((opt, i) =>
              typeof opt === "string" ? (
                <button
                  type="button"
                  key={opt}
                  id={`${listboxId}-${sanitizeId(opt)}`}
                  data-index={flatIndex}
                  className={clsx(
                    styles["drawer-option"],
                    value === opt && styles.active,
                    activeIndex === flatIndex++ && styles.focused,
                  )}
                  onClick={() => {
                    props.onSelect(opt);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  role="option"
                  aria-selected={value === opt}
                  tabIndex={-1}
                >
                  {opt}
                </button>
              ) : (
                <div
                  key={`div-${i}`}
                  className={styles["drawer-divider"]}
                  role="separator"
                >
                  {opt.divider}
                </div>
              ),
            );
          })()}
        </div>
      )}
    </div>
  );
}
