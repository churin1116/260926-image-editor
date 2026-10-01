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

/**
 * How much white paper each pixel carries: the rest of the source alpha once
 * the ink from inkAlpha is taken out. Ink and paper together make up the pixel.
 */
export function paperAlpha(rgba: ArrayLike<number>, ink: Uint8ClampedArray): Uint8ClampedArray {
  const paper = new Uint8ClampedArray(ink.length);
  for (let i = 0; i < paper.length; i++) paper[i] = rgba[i * 4 + 3] - ink[i];
  return paper;
}

/**
 * RGBA pixels of a single flat color, shaped by the alpha from inkAlpha. Given
 * the paper from paperAlpha, the ink lies on white paper instead of on nothing.
 */
export function paint(
  ink: Uint8ClampedArray,
  { r, g, b }: Rgb,
  paper?: Uint8ClampedArray,
): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(ink.length * 4);
  for (let i = 0, p = 0; i < ink.length; i++, p += 4) {
    const white = paper ? paper[i] : 0;
    const alpha = ink[i] + white;
    // The paper's share of the pixel, mixed toward white. Zero leaves the color exact.
    const share = alpha === 0 ? 0 : white / alpha;
    rgba[p] = r + (255 - r) * share;
    rgba[p + 1] = g + (255 - g) * share;
    rgba[p + 2] = b + (255 - b) * share;
    rgba[p + 3] = alpha;
  }
  return rgba;
}

/**
 * The alpha for a white layer drawn under an ink layer, so the two stacked show
 * the same pixel as paint() with paper. The ink hides part of what lies beneath
 * it, so the layer must be more opaque than the paper's own share to show
 * through at that share.
 */
export function paperUnderInk(ink: Uint8ClampedArray, paper: Uint8ClampedArray) {
  const under = new Uint8ClampedArray(ink.length);
  for (let i = 0; i < under.length; i++) {
    under[i] = ink[i] === 255 ? 0 : (paper[i] * 255) / (255 - ink[i]);
  }
  return under;
}
