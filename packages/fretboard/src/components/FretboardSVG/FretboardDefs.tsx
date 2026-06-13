import { memo } from "react";

interface FretboardDefsProps {
  svgDefId: (id: string) => string;
  neckWidthPx: number;
  neckHeight: number;
  taperPath: string;
}

export const FretboardDefs = memo(({
  svgDefId,
  neckWidthPx,
  neckHeight,
  taperPath,
}: FretboardDefsProps) => {
  return (
    <defs>
      <linearGradient id={svgDefId("fretboard-wood")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--fretboard-wood-top)" />
        <stop offset="55%" stopColor="var(--fretboard-wood-mid)" />
        <stop offset="100%" stopColor="var(--fretboard-wood-bottom)" />
      </linearGradient>
      <linearGradient
        id={svgDefId("fretboard-vignette")}
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop offset="0%" stopColor="rgb(0 0 0 / 0.55)" />
        <stop offset="8%" stopColor="rgb(0 0 0 / 0.16)" />
        <stop offset="50%" stopColor="rgb(255 255 255 / 0)" />
        <stop offset="92%" stopColor="rgb(0 0 0 / 0.16)" />
        <stop offset="100%" stopColor="rgb(0 0 0 / 0.55)" />
      </linearGradient>
      <filter
        id={svgDefId("wood-grain-filter")}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.012 0.95"
          numOctaves="4"
          seed="3"
          result="grain"
        />
        {/* Warm-shadow brown tint (~rgba(120,70,30,0.45)) — alpha 0.45, R=0.31 G=0.18 B=0.08 */}
        <feColorMatrix
          in="grain"
          type="matrix"
          values="0 0 0 0 0.31
                  0 0 0 0 0.18
                  0 0 0 0 0.08
                  0 0 0 0.45 0"
          result="grainTinted"
        />
        <feComposite in="grainTinted" in2="SourceGraphic" operator="in" />
      </filter>
      {/* Light-mode wood-grain filter — structurally different from dark:
          baseFrequency 0.018 0.72 (coarser horizontal, flatter vertical = broader lighter-wood grain)
          numOctaves 3 (fewer fine details, avoids muslin look on warm light gradient)
          seed 7 (distinct noise realization from dark seed=3)
          feColorMatrix: rgba(0.28,0.15,0.06,0.35) — subtler alpha to let light gradient show through */}
      <filter
        id={svgDefId("wood-grain-filter-light")}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.018 0.72"
          numOctaves="3"
          seed="7"
          result="noise"
        />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0.28
                  0 0 0 0 0.15
                  0 0 0 0 0.06
                  0 0 0 0.35 0"
          result="grainTinted"
        />
        <feComposite in="grainTinted" in2="SourceGraphic" operator="in" />
      </filter>
      <filter
        id={svgDefId("wood-highlights-filter")}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.022 0.55"
          numOctaves="2"
          seed="11"
          result="hl"
        />
        <feColorMatrix
          in="hl"
          type="matrix"
          values="0 0 0 0 0.32
                  0 0 0 0 0.21
                  0 0 0 0 0.12
                  0 0 0 0.09 0"
        />
      </filter>
      <filter
        id={svgDefId("wood-pores-filter")}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.55 0.55"
          numOctaves="1"
          seed="23"
          result="pores"
        />
        <feColorMatrix
          in="pores"
          type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.16 0"
        />
      </filter>
      {/* userSpaceOnUse ensures filter region isn't sized to zero-height line bbox */}
      <filter
        id={svgDefId("string-shadow-blur")}
        filterUnits="userSpaceOnUse"
        x={-4}
        y={-4}
        width={neckWidthPx + 8}
        height={neckHeight + 8}
      >
        <feGaussianBlur stdDeviation="0.75" />
      </filter>
      <linearGradient id={svgDefId("nut-material")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--nut-stop-1, #ffffff)" />
        <stop offset="35%" stopColor="var(--nut-stop-2, #fcfbf8)" />
        <stop offset="75%" stopColor="var(--nut-stop-3, #f8f4e8)" />
        <stop offset="100%" stopColor="var(--nut-stop-4, #f3ecd8)" />
      </linearGradient>
      <linearGradient
        id={svgDefId("fret-wire-cylinder")}
        x1="0" y1="0" x2="1" y2="0"
      >
        <stop offset="0%" stopColor="var(--fret-wire-dark)" />
        <stop offset="25%" stopColor="var(--fret-wire-medium)" />
        <stop offset="50%" stopColor="var(--fret-wire-bright)" />
        <stop offset="75%" stopColor="var(--fret-wire-medium)" />
        <stop offset="100%" stopColor="var(--fret-wire-dark)" />
      </linearGradient>
      <radialGradient id={svgDefId("inlay-pearl")} cx="35%" cy="32%" r="75%">
        <stop
          offset="0%"
          stopColor="var(--inlay-pearl-stop1)"
          stopOpacity="var(--inlay-pearl-opacity1)"
        />
        <stop
          offset="55%"
          stopColor="var(--inlay-pearl-stop2)"
          stopOpacity="var(--inlay-pearl-opacity2)"
        />
        <stop
          offset="100%"
          stopColor="var(--inlay-pearl-stop3)"
          stopOpacity="var(--inlay-pearl-opacity3)"
        />
      </radialGradient>
      <filter
        id={svgDefId("inlay-shadow")}
        x="-60%"
        y="-60%"
        width="220%"
        height="220%"
      >
        <feDropShadow
          dx="0"
          dy="0.6"
          stdDeviation="0.9"
          floodColor="#000"
          floodOpacity="0.6"
        />
      </filter>
      <filter
        id={svgDefId("glow-orange")}
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feDropShadow
          dx="0"
          dy="0"
          stdDeviation="3"
          floodColor="var(--neon-orange, #b1431b)"
          floodOpacity="var(--fretboard-glow-opacity)"
        />
      </filter>
      <clipPath id={svgDefId("fretboard-taper")}>
        <path d={taperPath} />
      </clipPath>
      {/* Rectangular clip matching the SVG's bounding box. Connector overlays
          (chord + interval) use this instead of the wood `fretboard-taper` so
          they can cross the wood's tapered top/bottom and nut/body edges near
          the outer strings. Connector pixels that land in the taper-carved
          corner gaps paint on the app-container backdrop — that's an
          accepted trade-off; the wood backdrop stays clipped to the taper
          and does not overflow into the gaps. */}
      <clipPath id={svgDefId("fretboard-svg-box")}>
        <rect x={0} y={0} width={neckWidthPx} height={neckHeight} />
      </clipPath>
    </defs>
  );
});
FretboardDefs.displayName = "FretboardDefs";
