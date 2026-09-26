import { describe, expect, it } from "vitest";
import { inkAlpha, paint } from "./ink";

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

describe("paint", () => {
  it("fills every pixel with the color and the given alpha", () => {
    expect([...paint(new Uint8ClampedArray([255, 0]), { r: 229, g: 57, b: 53 })]).toEqual([
      229, 57, 53, 255, 229, 57, 53, 0,
    ]);
  });
});
