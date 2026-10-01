import { encode } from "fast-png";
import type { Rgb } from "./color";
import { inkAlpha, paint, paperAlpha, paperUnderInk } from "./ink";

type Pixels = { width: number; height: number; data: Uint8ClampedArray };

async function readPixels(file: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(file, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const { width, height } = bitmap;
  const ctx = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

/** Tiles are at most 256px wide; twice that keeps previews sharp on retina screens. */
const PREVIEW_MAX = 512;

/** The paper is null for artwork with none, such as black on a transparent background. */
export type Mask = { ink: string; paper: string | null; width: number; height: number };

const BLACK = { r: 0, g: 0, b: 0 };

function shrink(alpha: Uint8ClampedArray, width: number, height: number, w: number, h: number) {
  const full = new OffscreenCanvas(width, height);
  full.getContext("2d")?.putImageData(new ImageData(paint(alpha, BLACK), width, height), 0, 0);
  const ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(full, 0, 0, w, h);
  const small = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i++) out[i] = small[i * 4 + 3];
  return out;
}

// Encoded here rather than with canvas.convertToBlob, which a background tab
// throttles to about one call per second: switching tabs mid-import would
// otherwise slow a large folder to a crawl. Gray + alpha is all a mask needs.
function maskUrl(alpha: Uint8ClampedArray, width: number, height: number): string {
  const grayAlpha = new Uint8Array(width * height * 2);
  for (let i = 0; i < alpha.length; i++) grayAlpha[i * 2 + 1] = alpha[i];
  const png = encode({ width, height, data: grayAlpha, channels: 2, depth: 8 });
  return URL.createObjectURL(new Blob([new Uint8Array(png)], { type: "image/png" }));
}

/**
 * Black-on-transparent images of the artwork's ink and paper, used as CSS masks
 * over a block of the chosen color and a white block under it. Recoloring every
 * preview is then a single CSS variable change instead of re-rendering pixels
 * for each image.
 */
export async function makeMask(file: File): Promise<Mask> {
  const { width, height, data } = await readPixels(file);
  let ink = inkAlpha(data);
  let paper = paperAlpha(data, ink);
  const hasPaper = paper.some((a) => a > 0);
  let w = width;
  let h = height;

  const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
  if (scale < 1) {
    w = Math.max(1, Math.round(width * scale));
    h = Math.max(1, Math.round(height * scale));
    ink = shrink(ink, width, height, w, h);
    // Shrunk apart and only then stacked, so the edges mix as they will in the output.
    if (hasPaper) paper = shrink(paper, width, height, w, h);
  }

  return {
    ink: maskUrl(ink, w, h),
    paper: hasPaper ? maskUrl(paperUnderInk(ink, paper), w, h) : null,
    width,
    height,
  };
}

export function revokeMask({ ink, paper }: Mask) {
  URL.revokeObjectURL(ink);
  if (paper) URL.revokeObjectURL(paper);
}

/**
 * The final PNG at full size. Encoded directly rather than through a canvas,
 * which premultiplies alpha and would shift the color of faint edge pixels.
 * White stays white unless clearWhite, which leaves only the ink.
 */
export async function renderPng(
  file: File,
  color: Rgb,
  clearWhite: boolean,
): Promise<Uint8Array<ArrayBuffer>> {
  const { width, height, data } = await readPixels(file);
  const ink = inkAlpha(data);
  const rgba = paint(ink, color, clearWhite ? undefined : paperAlpha(data, ink));
  return new Uint8Array(encode({ width, height, data: rgba, channels: 4, depth: 8 }));
}
