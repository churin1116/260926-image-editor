/** Hue in degrees (0–360), saturation and value (brightness) in 0–1. */
export type Hsv = { h: number; s: number; v: number };
/** Integer channels in 0–255. */
export type Rgb = { r: number; g: number; b: number };

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return { r: channel(5), g: channel(3), b: channel(1) };
}

/**
 * Hue is undefined for grays and saturation for black, so both fall back to the
 * previous color — otherwise dragging through black would snap the wheel to red.
 */
export function rgbToHsv({ r, g, b }: Rgb, prev: Hsv = { h: 0, s: 0, v: 0 }): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);

  let h = prev.h;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d + 6) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  const s = max === 0 ? prev.s : d / max;
  return { h, s, v: max };
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();

/** "E53935" — no leading #, safe for file and folder names. */
export function hexCode({ r, g, b }: Rgb): string {
  return `${hex2(r)}${hex2(g)}${hex2(b)}`;
}

export function rgbToHex(rgb: Rgb): string {
  return `#${hexCode(rgb)}`;
}

/** Accepts "#E53935", "e53935" and the 3-digit short form. */
export function parseHex(input: string): Rgb | null {
  const m = input.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(m)) return null;
  const full = m.length === 3 ? [...m].map((c) => c + c).join("") : m;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const n = c / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Black or white, whichever has the higher WCAG contrast against the color. */
export function textOn(rgb: Rgb): "#000000" | "#FFFFFF" {
  const l = luminance(rgb);
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#FFFFFF";
}
