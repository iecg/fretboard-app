import { CAGED_SHAPES, type CagedShape } from '../shapes';
import { type FingeringPattern } from '../store/atoms';
import { ToggleBar } from './ToggleBar';
import './FingeringPatternControls.css';

interface FingeringPatternControlsProps {
  fingeringPattern: FingeringPattern;
  setFingeringPattern: (pattern: FingeringPattern) => void;
  cagedShapes: Set<CagedShape>;
  setCagedShapes: (shapes: Set<CagedShape> | ((prev: Set<CagedShape>) => Set<CagedShape>)) => void;
  npsPosition: number;
  setNpsPosition: (position: number) => void;
  shapeLabels: 'none' | 'caged' | 'modal';
  setShapeLabels: (labels: 'none' | 'caged' | 'modal') => void;
  displayFormat: 'notes' | 'degrees' | 'none';
  setDisplayFormat: (format: 'notes' | 'degrees' | 'none') => void;
}

export function FingeringPatternControls({
  fingeringPattern,
  setFingeringPattern,
  cagedShapes,
  setCagedShapes,
  npsPosition,
  setNpsPosition,
  shapeLabels,
  setShapeLabels,
  displayFormat,
  setDisplayFormat,
}: FingeringPatternControlsProps) {
  return (
    <>
      <div className="control-section">
        <span className="section-label">Fingering Pattern</span>
        <ToggleBar
          options={(["all", "caged", "3nps"] as FingeringPattern[]).map((fp) => ({
            value: fp,
            label: fp === "all" ? "All" : fp.toUpperCase(),
          }))}
          value={fingeringPattern}
          onChange={(v) => setFingeringPattern(v as FingeringPattern)}
        />
      </div>

      {fingeringPattern === "caged" && (
        <>
          <div className="control-section">
            {/* TODO: Shape selector is kept inline because it supports Shift+click
                multi-select, which ToggleBar does not support (single-select only).
                Refactor once ToggleBar gains a multi-select variant. */}
            <span className="section-label">Shape</span>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${cagedShapes.size === CAGED_SHAPES.length ? "active" : ""}`}
                onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}
              >
                All
              </button>
              {CAGED_SHAPES.map((s) => (
                <button
                  key={s}
                  className={`toggle-btn ${cagedShapes.has(s) ? "active" : ""}`}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      setCagedShapes((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) {
                          if (next.size > 1) next.delete(s);
                        } else {
                          next.add(s);
                        }
                        return next;
                      });
                    } else {
                      setCagedShapes(new Set([s]));
                    }
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="control-section">
            <span className="section-label">Shape Labels</span>
            <ToggleBar
              options={(["none", "caged", "modal"] as const).map((opt) => ({
                value: opt,
                label: opt === "none" ? "None" : opt === "caged" ? "CAGED" : "Modal",
              }))}
              value={shapeLabels}
              onChange={(v) => setShapeLabels(v as "none" | "caged" | "modal")}
            />
          </div>
        </>
      )}

      {fingeringPattern === "3nps" && (
        <div className="control-section">
          <span className="section-label">Position</span>
          <ToggleBar
            options={[
              { value: 0, label: "All" },
              ...[1, 2, 3, 4, 5, 6, 7].map((p) => ({ value: p, label: String(p) })),
            ]}
            value={npsPosition}
            onChange={(v) => setNpsPosition(v as number)}
          />
        </div>
      )}

      <div className="control-section">
        <span className="section-label">Note Labels</span>
        <ToggleBar
          options={(["notes", "degrees", "none"] as const).map((fmt) => ({
            value: fmt,
            label: fmt === "notes" ? "Notes" : fmt === "degrees" ? "Intervals" : "None",
          }))}
          value={displayFormat}
          onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "none")}
        />
      </div>
    </>
  );
}
