import type { Rgb } from "./color";

/**
 * How much ink each pixel carries, read as if black artwork sat on white paper:
 * black is fully opaque, white fully transparent, and the source alpha is kept.
 * This one rule handles transparent-background PNGs (their pixels are already
 * black, so only alpha matters) and white-background ones alike, and keeps
 * anti-aliased edges soft instead of turning them into gray fringes.
 */
export function inkAlpha(rgba: ArrayLike<number>): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    const luma = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
    alpha[i] = (rgba[p + 3] * (255 - luma)) / 255;
  }
  return alpha;
}

/** RGBA pixels of a single flat color, shaped by the alpha from inkAlpha. */
export function paint(alpha: Uint8ClampedArray, { r, g, b }: Rgb): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(alpha.length * 4);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    rgba[p] = r;
    rgba[p + 1] = g;
    rgba[p + 2] = b;
    rgba[p + 3] = alpha[i];
  }
  return rgba;
}
