import { useState, useEffect, useRef } from "react";

type ResolvedTheme = "modern-dark" | "modern-light";

/** Pre-rasterizes wood-grain layers to PNG for GPU-composited scrolling.
 *  Theme-aware: light mode uses structurally different feTurbulence params
 *  (baseFrequency 0.018 0.72, seed 7) to produce a broader, lighter wood grain. */
export function useWoodGrainTexture(width: number, height: number, theme: ResolvedTheme = "modern-dark"): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const prevKey = useRef('');

  useEffect(() => {
    const key = `${width}x${height}:${theme}`;
    if (key === prevKey.current || width <= 0 || height <= 0) return;
    prevKey.current = key;

    // Light mode: broader grain (coarser horizontal, flatter vertical, fewer octaves, different seed)
    // Dark mode: finer grain (original params preserved)
    const isLight = theme === "modern-light";
    const grainBaseFreq = isLight ? "0.018 0.72" : "0.012 0.95";
    const grainOctaves = isLight ? "2" : "2";
    const grainSeed = isLight ? "7" : "3";
    const grainMatrix = isLight
      ? "0 0 0 0 0.28 0 0 0 0 0.15 0 0 0 0 0.06 0 0 0 0.35 0"
      : "0 0 0 0 0.09 0 0 0 0 0.05 0 0 0 0 0.03 0 0 0 0.72 0";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <filter id="wg" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="${grainBaseFreq}" numOctaves="${grainOctaves}" seed="${grainSeed}" result="grain"/>
          <feColorMatrix in="grain" type="matrix" values="${grainMatrix}" result="grainTinted"/>
          <feComposite in="grainTinted" in2="SourceGraphic" operator="in"/>
        </filter>
        <filter id="wh" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022 0.55" numOctaves="1" seed="11" result="hl"/>
          <feColorMatrix in="hl" type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.21 0 0 0 0 0.12 0 0 0 0.09 0"/>
        </filter>
        <filter id="wp" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55 0.55" numOctaves="1" seed="23" result="pores"/>
          <feColorMatrix in="pores" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="#000" filter="url(#wg)" opacity="0.92"/>
      <rect width="${width}" height="${height}" fill="#000" filter="url(#wh)" opacity="0.6"/>
      <rect width="${width}" height="${height}" fill="#000" filter="url(#wp)" opacity="0.5"/>
    </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    let cancelled = false;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      if (!cancelled) {
        try { setDataUrl(canvas.toDataURL('image/png')); } catch { /* tainted canvas — stay on live filters */ }
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [width, height, theme]);

  return dataUrl;
}
