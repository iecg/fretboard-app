import { useState, useEffect, useRef } from "react";

/** Pre-rasterizes wood-grain layers to PNG for GPU-composited scrolling. */
export function useWoodGrainTexture(width: number, height: number): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const prevKey = useRef('');

  useEffect(() => {
    const key = `${width}x${height}`;
    if (key === prevKey.current || width <= 0 || height <= 0) return;
    prevKey.current = key;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <filter id="wg" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.95" numOctaves="2" seed="3" result="grain"/>
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.09 0 0 0 0 0.05 0 0 0 0 0.03 0 0 0 0.72 0" result="grainTinted"/>
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
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      try { setDataUrl(canvas.toDataURL('image/png')); } catch { /* tainted canvas — stay on live filters */ }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [width, height]);

  return dataUrl;
}
