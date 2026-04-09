import { CAGED_SHAPES, type CagedShape } from '../shapes';
import { type FingeringPattern } from '../store/atoms';
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
        <div className="toggle-group">
          {(["all", "caged", "3nps"] as FingeringPattern[]).map((fp) => (
            <button
              key={fp}
              className={`toggle-btn ${fingeringPattern === fp ? "active" : ""}`}
              onClick={() => setFingeringPattern(fp)}
            >
              {fp === "all" ? "All" : fp.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {fingeringPattern === "caged" && (
        <>
          <div className="control-section">
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
            <div className="toggle-group">
              {(["none", "caged", "modal"] as const).map((opt) => (
                <button
                  key={opt}
                  className={`toggle-btn ${shapeLabels === opt ? "active" : ""}`}
                  onClick={() => setShapeLabels(opt)}
                >
                  {opt === "none" ? "None" : opt === "caged" ? "CAGED" : "Modal"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {fingeringPattern === "3nps" && (
        <div className="control-section">
          <span className="section-label">Position</span>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${npsPosition === 0 ? "active" : ""}`}
              onClick={() => setNpsPosition(0)}
            >
              All
            </button>
            {[1, 2, 3, 4, 5, 6, 7].map((p) => (
              <button
                key={p}
                className={`toggle-btn ${npsPosition === p ? "active" : ""}`}
                onClick={() => setNpsPosition(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="control-section">
        <span className="section-label">Note Labels</span>
        <div className="toggle-group">
          {(["notes", "degrees", "none"] as const).map((fmt) => (
            <button
              key={fmt}
              className={`toggle-btn ${displayFormat === fmt ? "active" : ""}`}
              onClick={() => setDisplayFormat(fmt)}
            >
              {fmt === "notes" ? "Notes" : fmt === "degrees" ? "Intervals" : "None"}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
