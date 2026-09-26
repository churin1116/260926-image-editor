import { strFromU8, strToU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZip } from "./save";

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
