import { describe, expect, it } from "vitest";
import { hexCode, hsvToRgb, parseHex, rgbToHex, rgbToHsv, textOn } from "./color";

describe("hsv ⇄ rgb", () => {
  it("converts primaries and secondaries", () => {
    expect(hsvToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb({ h: 60, s: 1, v: 1 })).toEqual({ r: 255, g: 255, b: 0 });
    expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
    expect(hsvToRgb({ h: 0, s: 0, v: 1 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("round-trips every 8-bit color it is given", () => {
    for (const rgb of [
      { r: 229, g: 57, b: 53 },
      { r: 1, g: 2, b: 3 },
      { r: 255, g: 204, b: 0 },
      { r: 128, g: 128, b: 128 },
    ]) {
      expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
    }
  });

  it("keeps the previous hue for grays and the previous saturation for black", () => {
    const prev = { h: 200, s: 0.7, v: 0.5 };
    expect(rgbToHsv({ r: 90, g: 90, b: 90 }, prev).h).toBe(200);
    expect(rgbToHsv({ r: 0, g: 0, b: 0 }, prev)).toEqual({ h: 200, s: 0.7, v: 0 });
  });
});

describe("hex", () => {
  it("formats uppercase with and without #", () => {
    expect(rgbToHex({ r: 229, g: 57, b: 53 })).toBe("#E53935");
    expect(hexCode({ r: 0, g: 10, b: 255 })).toBe("000AFF");
  });

  it("parses long, short and bare forms", () => {
    expect(parseHex("#e53935")).toEqual({ r: 229, g: 57, b: 53 });
    expect(parseHex(" E53935 ")).toEqual({ r: 229, g: 57, b: 53 });
    expect(parseHex("#f0a")).toEqual({ r: 255, g: 0, b: 170 });
  });

  it("rejects anything else", () => {
    for (const bad of ["", "#12", "#12345", "#1234567", "#GGGGGG", "red"]) {
      expect(parseHex(bad)).toBeNull();
    }
  });
});

describe("textOn", () => {
  it("puts black on light colors and white on dark ones", () => {
    expect(textOn({ r: 255, g: 235, b: 59 })).toBe("#000000");
    expect(textOn({ r: 21, g: 101, b: 192 })).toBe("#FFFFFF");
  });
});
