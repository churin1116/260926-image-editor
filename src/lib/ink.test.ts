import { describe, expect, it } from "vitest";
import { inkAlpha, paint, paperAlpha, paperUnderInk } from "./ink";

const px = (...values: number[][]) => new Uint8ClampedArray(values.flat());

describe("inkAlpha", () => {
  it("keeps the alpha of black pixels on a transparent background", () => {
    expect([...inkAlpha(px([0, 0, 0, 255], [0, 0, 0, 128], [0, 0, 0, 0]))]).toEqual([255, 128, 0]);
  });

  it("lifts a white background out and keeps gray edges as partial ink", () => {
    expect([...inkAlpha(px([255, 255, 255, 255], [0, 0, 0, 255], [128, 128, 128, 255]))]).toEqual([
      0, 255, 127,
    ]);
  });

  it("ignores the color hidden under fully transparent pixels", () => {
    expect([...inkAlpha(px([255, 255, 255, 0], [12, 34, 56, 0]))]).toEqual([0, 0]);
  });
});

describe("paperAlpha", () => {
  it("is what the source alpha leaves after the ink", () => {
    const rgba = px(
      [255, 255, 255, 255],
      [128, 128, 128, 255],
      [0, 0, 0, 255],
      [255, 255, 255, 64],
    );
    expect([...paperAlpha(rgba, inkAlpha(rgba))]).toEqual([255, 128, 0, 64]);
  });

  it("finds none on black over a transparent background", () => {
    const rgba = px([0, 0, 0, 255], [0, 0, 0, 3], [255, 255, 255, 0]);
    expect([...paperAlpha(rgba, inkAlpha(rgba))]).toEqual([0, 0, 0]);
  });
});

const red = { r: 229, g: 57, b: 53 };

describe("paint", () => {
  it("fills every pixel with the color and the given alpha", () => {
    expect([...paint(new Uint8ClampedArray([255, 0]), red)]).toEqual([
      229, 57, 53, 255, 229, 57, 53, 0,
    ]);
  });

  it("lays the ink on white paper: black to the color, white kept, gray in between", () => {
    const ink = new Uint8ClampedArray([255, 0, 127, 3, 0]);
    const paper = new Uint8ClampedArray([0, 255, 128, 0, 0]);
    expect([...paint(ink, red, paper)]).toEqual([
      ...[229, 57, 53, 255],
      ...[255, 255, 255, 255],
      ...[242, 156, 154, 255],
      ...[229, 57, 53, 3],
      ...[229, 57, 53, 0],
    ]);
  });
});

describe("paperUnderInk", () => {
  // Source-over, unpremultiplied, one channel at a time.
  const over = (top: number, alpha: number, below: number) =>
    top * (alpha / 255) + below * (1 - alpha / 255);

  it("stacked under the ink, shows the same pixel as paint with paper", () => {
    const ink = new Uint8ClampedArray([255, 0, 127, 40, 3, 200]);
    const paper = new Uint8ClampedArray([0, 255, 128, 100, 0, 30]);
    const under = paperUnderInk(ink, paper);
    const painted = paint(ink, red, paper);
    for (const backdrop of [0, 128, 255]) {
      for (let i = 0; i < ink.length; i++) {
        const stacked = over(red.r, ink[i], over(255, under[i], backdrop));
        const flat = over(painted[i * 4], painted[i * 4 + 3], backdrop);
        expect(stacked).toBeCloseTo(flat, 0);
      }
    }
  });

  it("leaves nothing under fully opaque ink", () => {
    expect([...paperUnderInk(new Uint8ClampedArray([255]), new Uint8ClampedArray([0]))]).toEqual([
      0,
    ]);
  });
});
