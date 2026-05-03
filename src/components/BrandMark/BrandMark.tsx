import clsx from "clsx";
import { GUITAR_BODY_PATH_D, GUITAR_NECK_PATH_D } from "./BrandMark.path";

export interface BrandMarkProps {
  className?: string;
}

/**
 * FretFlow brand mark — electric-guitar silhouette sourced from SVG Repo
 * (see BrandMark.path.ts). The body path renders in cyan and the neck /
 * headstock / hardware path renders in orange, matching the two-tone
 * "FretFlow" wordmark. Each path carries its own per-segment neon glow.
 *
 * Coordinate space: viewBox "0 0 612.475 596.26327". Both paths sit inside
 * a group with translate(-89.501209, 0.00925); the neck path also carries
 * its own translate(-495.0688, 102.20105) to land it at the correct position.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={clsx("brand-mark", className)}
      viewBox="0 0 612.475 596.26327"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Per-segment neon glow via feDropShadow — two stacked shadows:
            a tight inner rim + a softer outer halo, color-matched. */}
        <filter
          id="brand-mark-glow-cyan"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="3"
            floodColor="var(--neon-cyan, #4DE4FF)"
            floodOpacity="0.9"
          />
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="9"
            floodColor="var(--neon-cyan, #4DE4FF)"
            floodOpacity="0.4"
          />
        </filter>
        <filter
          id="brand-mark-glow-orange"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="3"
            floodColor="var(--neon-orange, #FF9A4D)"
            floodOpacity="0.9"
          />
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="9"
            floodColor="var(--neon-orange, #FF9A4D)"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      {/* Outer group replicates the source SVG's coordinate offset. */}
      <g transform="translate(-89.501209,0.00925)">
        {/* Body — cyan fill + cyan edge glow. */}
        <path
          d={GUITAR_BODY_PATH_D}
          fill="var(--neon-cyan, #4DE4FF)"
          filter="url(#brand-mark-glow-cyan)"
        />

        {/* Neck, headstock, tuning pegs — orange fill + orange edge glow.
            Carries its own nested translate from the source SVG. */}
        <path
          d={GUITAR_NECK_PATH_D}
          transform="translate(-495.0688,102.20105)"
          fill="var(--neon-orange, #FF9A4D)"
          filter="url(#brand-mark-glow-orange)"
        />
      </g>
    </svg>
  );
}

export default BrandMark;
