import { encode } from "fast-png";
import type { Rgb } from "./color";
import { inkAlpha, paint } from "./ink";

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

export type Mask = { url: string; width: number; height: number };

const BLACK = { r: 0, g: 0, b: 0 };

/**
 * A black-on-transparent image of the artwork's ink, used as a CSS mask over a
 * block of the chosen color. Recoloring every preview is then a single CSS
 * variable change instead of re-rendering pixels for each image.
 */
export async function makeMask(file: File): Promise<Mask> {
  const { width, height, data } = await readPixels(file);
  let alpha = inkAlpha(data);
  let w = width;
  let h = height;

  const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
  if (scale < 1) {
    const full = new OffscreenCanvas(width, height);
    full.getContext("2d")?.putImageData(new ImageData(paint(alpha, BLACK), width, height), 0, 0);
    w = Math.max(1, Math.round(width * scale));
    h = Math.max(1, Math.round(height * scale));
    const ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(full, 0, 0, w, h);
    const small = ctx.getImageData(0, 0, w, h).data;
    alpha = new Uint8ClampedArray(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = small[i * 4 + 3];
  }

  // Encoded here rather than with canvas.convertToBlob, which a background tab
  // throttles to about one call per second: switching tabs mid-import would
  // otherwise slow a large folder to a crawl. Gray + alpha is all a mask needs.
  const grayAlpha = new Uint8Array(w * h * 2);
  for (let i = 0; i < alpha.length; i++) grayAlpha[i * 2 + 1] = alpha[i];
  const png = encode({ width: w, height: h, data: grayAlpha, channels: 2, depth: 8 });
  const blob = new Blob([new Uint8Array(png)], { type: "image/png" });
  return { url: URL.createObjectURL(blob), width, height };
}

/**
 * The final PNG at full size. Encoded directly rather than through a canvas,
 * which premultiplies alpha and would shift the color of faint edge pixels.
 */
export async function renderPng(file: File, color: Rgb): Promise<Uint8Array<ArrayBuffer>> {
  const { width, height, data } = await readPixels(file);
  const png = encode({ width, height, data: paint(inkAlpha(data), color), channels: 4, depth: 8 });
  return new Uint8Array(png);
}
