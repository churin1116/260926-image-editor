import { describe, expect, it } from "vitest";
import { commonRoot, comparePaths, fileName, outputLayout } from "./paths";

describe("commonRoot", () => {
  it("finds the folder every file came from", () => {
    expect(commonRoot(["icons/a.png", "icons/sub/b.png"])).toBe("icons");
  });

  it("is null for loose files or several folders", () => {
    expect(commonRoot(["a.png", "b.png"])).toBeNull();
    expect(commonRoot(["icons/a.png", "b.png"])).toBeNull();
    expect(commonRoot(["icons/a.png", "logos/b.png"])).toBeNull();
    expect(commonRoot([])).toBeNull();
  });
});

describe("outputLayout", () => {
  it("renames the source folder after the color and keeps the structure inside", () => {
    expect(outputLayout(["icons/a.png", "icons/sub/b.png"], "E53935")).toEqual({
      folder: "icons-E53935",
      files: ["a.png", "sub/b.png"],
    });
  });

  it("falls back to a generic folder for loose files", () => {
    expect(outputLayout(["a.png", "logos/b.png"], "FFCC00")).toEqual({
      folder: "recolor-FFCC00",
      files: ["a.png", "logos/b.png"],
    });
  });
});

describe("helpers", () => {
  it("takes the file name from a path", () => {
    expect(fileName("icons/sub/b.png")).toBe("b.png");
    expect(fileName("b.png")).toBe("b.png");
  });

  it("sorts numbers by value", () => {
    expect(["icon10.png", "icon2.png", "icon1.png"].sort(comparePaths)).toEqual([
      "icon1.png",
      "icon2.png",
      "icon10.png",
    ]);
  });
});
