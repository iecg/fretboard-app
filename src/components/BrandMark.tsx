import clsx from "clsx";

export interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={clsx("brand-mark", className)}
      viewBox="0 0 56 56"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="brand-mark-neck"
          gradientUnits="userSpaceOnUse"
          x1="10"
          y1="42"
          x2="44"
          y2="8"
        >
          <stop offset="0%" stopColor="#4DE4FF" />
          <stop offset="52%" stopColor="#62E9FF" />
          <stop offset="100%" stopColor="#FFB05C" />
        </linearGradient>
        <radialGradient id="brand-mark-body" cx="0.34" cy="0.3" r="0.95">
          <stop offset="0%" stopColor="rgba(140, 238, 255, 0.95)" />
          <stop offset="55%" stopColor="rgba(46, 181, 204, 0.75)" />
          <stop offset="100%" stopColor="rgba(17, 49, 64, 0.2)" />
        </radialGradient>
        <filter
          id="brand-mark-glow"
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="2.4"
            floodColor="#4DE4FF"
            floodOpacity="0.65"
          />
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="4.2"
            floodColor="#FFB05C"
            floodOpacity="0.3"
          />
        </filter>
      </defs>
      <g
        fill="none"
        filter="url(#brand-mark-glow)"
        stroke="url(#brand-mark-neck)"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M13 40.6c0-5.8 4.6-10.4 10.2-10.4 3 0 5.7 1.2 7.6 3.1l8.6-8.8c.8-.8 1.2-1.8 1.2-3v-5.5c0-.9.7-1.6 1.6-1.6h4.1c.9 0 1.6.7 1.6 1.6v4.1h-4.4"
          strokeWidth="2.6"
        />
        <path
          d="M31 33.5 23.6 26a4.1 4.1 0 0 0-5.8 0l-2.5 2.5a4.1 4.1 0 0 0 0 5.8l3 3"
          strokeWidth="2.1"
        />
        <path d="m40.6 15.2 5.6 5.6" strokeWidth="2" />
        <path d="m43.6 12.4 5.2 5.2" strokeWidth="1.8" />
        <circle
          cx="22.8"
          cy="40.7"
          r="9.2"
          fill="url(#brand-mark-body)"
          strokeWidth="2.3"
        />
        <circle
          cx="15.7"
          cy="45.2"
          r="4.8"
          fill="rgba(255,176,92,0.16)"
          strokeWidth="1.7"
        />
      </g>
    </svg>
  );
}

export default BrandMark;
