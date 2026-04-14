import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

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

  // Build flat options list for keyboard navigation (null option + string options)
  const flatOptions = [
    ...(nullable ? [null as string | null] : []),
    ...options.filter((o): o is string => typeof o === "string"),
  ];

  // Find index of currently selected value
  const selectedIndex = flatOptions.findIndex((opt) => opt === value);

  // Track active index for keyboard navigation (starts at selected value)
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  // Reset activeIndex when opening to match current selection
  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < 260);
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

  const listboxId = `${label.toLowerCase().replace(/\s+/g, '-')}-listbox`;
  const triggerId = `${label.toLowerCase().replace(/\s+/g, '-')}-trigger`;

  return (
    <div className="drawer-selector" ref={containerRef}>
      <button
        id={triggerId}
        ref={triggerRef}
        className="drawer-trigger"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
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
        <span className="drawer-label">{label}</span>
        <span className="drawer-value">{value ?? "None"}</span>
        <ChevronDown className={`drawer-chevron ${open ? "open" : ""}`} />
      </button>
      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          autoFocus
          aria-activedescendant={flatOptions[activeIndex] === null ? `${listboxId}-none` : `${listboxId}-${flatOptions[activeIndex]}`}
          className={clsx(
            "drawer-options",
            "custom-scrollbar",
            dropUp && "drawer-options--above",
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
              className={`drawer-option ${value === null ? "active" : ""} ${activeIndex === 0 ? "focused" : ""}`}
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
                  id={`${listboxId}-${opt}`}
                  data-index={flatIndex}
                  className={`drawer-option ${value === opt ? "active" : ""} ${activeIndex === flatIndex++ ? "focused" : ""}`}
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
                <div key={`div-${i}`} className="drawer-divider" role="separator">
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
