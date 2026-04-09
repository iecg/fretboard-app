import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

export function DrawerSelector({
  label,
  value,
  options,
  onSelect,
  nullable = false,
}: {
  label: string;
  value: string | null;
  options: (string | { divider: string })[];
  onSelect: (opt: string | null) => void;
  nullable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="drawer-selector" ref={containerRef}>
      <button className="drawer-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="drawer-label">{label}</span>
        <span className="drawer-value">{value ?? "None"}</span>
        <ChevronDown className={`drawer-chevron ${open ? "open" : ""}`} />
      </button>
      {open && (
        <div className={clsx("drawer-options", "custom-scrollbar", dropUp && "drawer-options--above")}>
          {nullable && (
            <button
              className={`drawer-option ${value === null ? "active" : ""}`}
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              None
            </button>
          )}
          {options.map((opt, i) =>
            typeof opt === "string" ? (
              <button
                key={opt}
                className={`drawer-option ${value === opt ? "active" : ""}`}
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            ) : (
              <div key={`div-${i}`} className="drawer-divider">
                {opt.divider}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
