import { describe, expect, it } from "vitest";
import { fromDirectoryHandle, fromFileList } from "./collect";

const file = (path: string) => {
  const f = new File(["x"], path.slice(path.lastIndexOf("/") + 1));
  Object.defineProperty(f, "webkitRelativePath", { value: path.includes("/") ? path : "" });
  return f;
};

// Just enough of FileSystemDirectoryHandle for fromDirectoryHandle to walk.
type Tree = { [name: string]: Tree | string };
const dirHandle = (name: string, tree: Tree): FileSystemDirectoryHandle =>
  ({
    kind: "directory",
    name,
    async *values() {
      for (const [child, value] of Object.entries(tree)) {
        yield typeof value === "string"
          ? { kind: "file", name: child, getFile: async () => new File([value], child) }
          : dirHandle(child, value);
      }
    },
  }) as unknown as FileSystemDirectoryHandle;

describe("fromFileList", () => {
  it("keeps PNGs with their folder path, sorted, and counts the rest", () => {
    const { picked, skipped } = fromFileList([
      file("icons/b10.png"),
      file("icons/sub/a.PNG"),
      file("icons/b2.png"),
      file("icons/notes.txt"),
    ]);
    expect(picked.map((p) => p.path)).toEqual(["icons/b2.png", "icons/b10.png", "icons/sub/a.PNG"]);
    expect(skipped).toBe(1);
  });

  it("ignores hidden files and folders without counting them", () => {
    const { picked, skipped } = fromFileList([
      file("icons/._a.png"),
      file("icons/.DS_Store"),
      file("icons/.cache/c.png"),
      file("icons/a.png"),
    ]);
    expect(picked.map((p) => p.path)).toEqual(["icons/a.png"]);
    expect(skipped).toBe(0);
  });

  it("uses the bare name for files picked without a folder", () => {
    expect(fromFileList([file("a.png")]).picked[0].path).toBe("a.png");
  });
});

describe("fromDirectoryHandle", () => {
  it("walks subfolders, prefixing paths with the picked folder's name", async () => {
    const { picked, skipped } = await fromDirectoryHandle(
      dirHandle("icons", {
        "a.png": "A",
        "readme.txt": "",
        "._a.png": "",
        sub: { "b.png": "B" },
        ".cache": { "c.png": "C" },
      }),
    );
    expect(picked.map((p) => p.path)).toEqual(["icons/a.png", "icons/sub/b.png"]);
    expect(await picked[1].file.text()).toBe("B");
    expect(skipped).toBe(1);
  });
});
