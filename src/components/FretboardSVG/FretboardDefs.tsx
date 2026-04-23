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
        <stop offset="55%" stopColor="#0d0805" />
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
        <feColorMatrix
          in="grain"
          type="matrix"
          values="0 0 0 0 0.09
                  0 0 0 0 0.05
                  0 0 0 0 0.03
                  0 0 0 0.72 0"
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
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="35%" stopColor="#f4f4f1" />
        <stop offset="75%" stopColor="#d8d4cb" />
        <stop offset="100%" stopColor="#a9a59b" />
      </linearGradient>
      <linearGradient
        id={svgDefId("fret-wire-cylinder")}
        x1="0" y1="0" x2="1" y2="0"
      >
        <stop offset="0%" stopColor="#3e444c" />
        <stop offset="25%" stopColor="#a6afbc" />
        <stop offset="50%" stopColor="#ebeff5" />
        <stop offset="75%" stopColor="#a6afbc" />
        <stop offset="100%" stopColor="#3e444c" />
      </linearGradient>
      <radialGradient id={svgDefId("inlay-pearl")} cx="35%" cy="32%" r="75%">
        <stop
          offset="0%"
          stopColor="rgb(250 247 232)"
          stopOpacity="0.98"
        />
        <stop
          offset="55%"
          stopColor="rgb(218 209 182)"
          stopOpacity="0.88"
        />
        <stop
          offset="100%"
          stopColor="rgb(156 144 118)"
          stopOpacity="0.75"
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
        id={svgDefId("glow-cyan")}
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feDropShadow
          dx="0"
          dy="0"
          stdDeviation="3"
          floodColor="var(--neon-cyan)"
          floodOpacity="var(--fretboard-glow-opacity)"
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
          floodColor="var(--neon-orange)"
          floodOpacity="var(--fretboard-glow-opacity)"
        />
      </filter>
      <filter
        id={svgDefId("glow-violet")}
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feDropShadow
          dx="0"
          dy="0"
          stdDeviation="3"
          floodColor="var(--neon-violet)"
          floodOpacity="var(--fretboard-glow-opacity)"
        />
      </filter>
      <clipPath id={svgDefId("fretboard-taper")}>
        <path d={taperPath} />
      </clipPath>
    </defs>
  );
});
FretboardDefs.displayName = "FretboardDefs";
