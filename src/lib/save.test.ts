import { strFromU8, strToU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZip, freeName } from "./save";

describe("buildZip", () => {
  it("nests every file under the output folder and reports progress", async () => {
    const progress: number[] = [];
    const zip = await buildZip(
      "icons-E53935",
      [
        { path: "a.png", render: async () => strToU8("A") },
        { path: "sub/b.png", render: async () => strToU8("B") },
      ],
      (done) => progress.push(done),
    );
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(["icons-E53935/a.png", "icons-E53935/sub/b.png"]);
    expect(strFromU8(files["icons-E53935/sub/b.png"])).toBe("B");
    expect(progress).toEqual([1, 2]);
  });
});

describe("freeName", () => {
  it("uses the base name when it is free", async () => {
    expect(await freeName("icons-E53935", async () => false)).toBe("icons-E53935");
  });

  it("counts up from -2 past every taken name", async () => {
    const taken = new Set(["icons-E53935", "icons-E53935-2", "icons-E53935-3"]);
    expect(await freeName("icons-E53935", async (n) => taken.has(n))).toBe("icons-E53935-4");
  });
});
