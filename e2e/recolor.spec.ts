import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { decode, encode } from "fast-png";
import { unzipSync } from "fflate";

type Pixel = [number, number, number, number];

function png(size: number, pixel: (x: number, y: number) => Pixel): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data.set(pixel(x, y), (y * size + x) * 4);
  return encode({ width: size, height: size, data, channels: 4, depth: 8 });
}

const inSquare = (x: number, y: number) => x >= 4 && x < 12 && y >= 4 && y < 12;
// Transparent background, plus one nearly invisible pixel: a canvas round trip
// would shift the color of that pixel, so it proves the output is exact.
const TRANSPARENT = png(16, (x, y) =>
  x === 2 && y === 2 ? [0, 0, 0, 3] : inSquare(x, y) ? [0, 0, 0, 255] : [0, 0, 0, 0],
);
// White background with a mid-gray pixel, which should become half ink: half
// way to white while white is kept, half transparent once it is cleared.
const WHITE_BG = png(16, (x, y) =>
  x === 2 && y === 2
    ? [128, 128, 128, 255]
    : inSquare(x, y)
      ? [0, 0, 0, 255]
      : [255, 255, 255, 255],
);

/** A source folder as the user would have it, junk included. */
const FOLDER: Record<string, Uint8Array | string> = {
  "a.png": TRANSPARENT,
  "sub/b.png": WHITE_BG,
  "notes.txt": "not an image",
  "._a.png": "AppleDouble junk",
  ".cache/c.png": TRANSPARENT,
};

function pixel(file: Uint8Array, x: number, y: number): number[] {
  const { width, data } = decode(file);
  return [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];
}

/**
 * Stands in for the folder pickers with the origin-private file system: "read"
 * opens /icons (seeded with FOLDER), "readwrite" saves into /out. Installed
 * before the app loads, since it decides between folder saving and ZIP on mount.
 */
async function useOpfsPickers(page: Page) {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async (options) => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle(options?.mode === "read" ? "icons" : "out", { create: true });
    };
  });
  await page.goto("/");
  const files = Object.entries(FOLDER).map(([path, body]) => ({
    path,
    bytes: typeof body === "string" ? [...new TextEncoder().encode(body)] : [...body],
  }));
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory();
    for (const { path, bytes } of files) {
      const parts = ["icons", ...path.split("/")];
      const name = parts.pop() as string;
      let dir = root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
      const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await writable.write(new Uint8Array(bytes));
      await writable.close();
    }
  }, files);
}

/** Every file under /out, keyed by path. */
async function savedFiles(page: Page): Promise<Record<string, Uint8Array>> {
  const entries = await page.evaluate(async () => {
    const out: [string, number[]][] = [];
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const child of dir.values()) {
        if (child.kind === "directory")
          await walk(child as FileSystemDirectoryHandle, `${prefix}${child.name}/`);
        else {
          const file = await (child as FileSystemFileHandle).getFile();
          out.push([`${prefix}${child.name}`, [...new Uint8Array(await file.arrayBuffer())]]);
        }
      }
    };
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle("out"), "");
    return out;
  });
  return Object.fromEntries(entries.map(([path, bytes]) => [path, new Uint8Array(bytes)]));
}

async function setHex(page: Page, hex: string) {
  const input = page.getByLabel("HEXカラーコード");
  await input.fill(hex);
  await input.press("Enter");
}

test("opens a folder, recolors every preview, and saves exact pixels", async ({ page }) => {
  await useOpfsPickers(page);
  await page.getByRole("button", { name: "フォルダを選ぶ" }).click();

  // Hidden files are skipped silently; notes.txt is the one counted.
  await expect(page.locator(".tile-name")).toHaveText(["a.png", "b.png"]);
  await expect(page.getByText("PNG以外の1件は読み込みませんでした")).toBeVisible();

  await setHex(page, "1e88e5");
  for (const ink of await page.locator(".tile-ink").all()) {
    await expect(ink).toHaveCSS("background-color", "rgb(30, 136, 229)");
  }

  // The result shows as a toast, so the button stays exactly where it was.
  const save = page.getByRole("button", { name: "フォルダに保存" });
  const before = await save.boundingBox();
  await save.click();
  await expect(page.getByText("out に2枚保存しました")).toBeVisible();
  expect(await save.boundingBox()).toEqual(before);

  // Straight into the chosen folder, keeping the subfolders but not "icons" itself.
  const files = await savedFiles(page);
  expect(Object.keys(files).sort()).toEqual(["a.png", "sub/b.png"]);
  const a = files["a.png"];
  const b = files["sub/b.png"];
  expect(pixel(a, 8, 8)).toEqual([30, 136, 229, 255]);
  expect(pixel(a, 2, 2)).toEqual([30, 136, 229, 3]);
  expect(pixel(a, 0, 0)[3]).toBe(0);
  expect(pixel(b, 8, 8)).toEqual([30, 136, 229, 255]);
  expect(pixel(b, 2, 2)).toEqual([143, 196, 242, 255]);
  expect(pixel(b, 0, 0)).toEqual([255, 255, 255, 255]);
});

test("clearing white makes the white background transparent", async ({ page }) => {
  await useOpfsPickers(page);
  await page.getByRole("button", { name: "フォルダを選ぶ" }).click();
  await expect(page.locator(".tile")).toHaveCount(2);
  await setHex(page, "1e88e5");

  // Only b.png has white to keep, and the preview shows it until it is cleared.
  const paper = page.locator(".tile-paper");
  await expect(paper).toHaveCount(1);
  await expect(paper).toBeVisible();
  await page.getByLabel("白い部分を透明にする").check();
  await expect(paper).toBeHidden();

  await page.getByRole("button", { name: "フォルダに保存" }).click();
  await expect(page.getByText("out に2枚保存しました")).toBeVisible();
  const files = await savedFiles(page);
  const a = files["a.png"];
  const b = files["sub/b.png"];
  expect(pixel(a, 8, 8)).toEqual([30, 136, 229, 255]);
  expect(pixel(a, 2, 2)).toEqual([30, 136, 229, 3]);
  expect(pixel(b, 8, 8)).toEqual([30, 136, 229, 255]);
  expect(pixel(b, 2, 2)).toEqual([30, 136, 229, 127]);
  expect(pixel(b, 0, 0)[3]).toBe(0);

  // The choice is remembered for the next visit.
  await page.reload();
  await expect(page.getByLabel("白い部分を透明にする")).toBeChecked();
});

test("asks before replacing files already in the folder", async ({ page }) => {
  await useOpfsPickers(page);
  await page.getByRole("button", { name: "フォルダを選ぶ" }).click();
  await expect(page.locator(".tile")).toHaveCount(2);
  const save = page.getByRole("button", { name: "フォルダに保存" });
  const dialogs: string[] = [];
  let accept = false;
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void (accept ? dialog.accept() : dialog.dismiss());
  });

  // Nothing there yet, so nothing to ask.
  await setHex(page, "1e88e5");
  await save.click();
  await expect(page.getByText("out に2枚保存しました")).toBeVisible();
  expect(dialogs).toEqual([]);

  // Declining leaves the earlier files as they were.
  await setHex(page, "ffcc00");
  await save.click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain("「out」には同じ名前のファイルが2件あります");
  expect(dialogs[0]).toContain("sub/b.png");
  await expect(save).toBeEnabled();
  await expect(page.getByText("に2枚保存しました")).toHaveCount(0);
  expect(pixel((await savedFiles(page))["a.png"], 8, 8)).toEqual([30, 136, 229, 255]);

  accept = true;
  await save.click();
  await expect(page.getByText("out に2枚保存しました")).toBeVisible();
  const files = await savedFiles(page);
  expect(Object.keys(files).sort()).toEqual(["a.png", "sub/b.png"]);
  expect(pixel(files["a.png"], 8, 8)).toEqual([255, 204, 0, 255]);
  expect(pixel(files["sub/b.png"], 8, 8)).toEqual([255, 204, 0, 255]);
});

test("arrow keys on the hue ring step the color, even when pressed quickly", async ({ page }) => {
  await page.goto("/");
  await setHex(page, "ff0000");
  const hue = page.getByRole("slider", { name: "色相" });
  await hue.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect(hue).toHaveAttribute("aria-valuenow", "30");
  await expect(page.getByLabel("HEXカラーコード")).toHaveValue("#FF8000");
});

test("without folder access, opens folders by input and saves a ZIP", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", { value: undefined, configurable: true });
  });
  const root = testInfo.outputPath("icons");
  for (const [path, body] of Object.entries(FOLDER)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  }

  await page.goto("/");
  await page.locator("input[webkitdirectory]").setInputFiles(root);
  await expect(page.locator(".tile-name")).toHaveText(["a.png", "b.png"]);

  await setHex(page, "ffcc00");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "ZIPで保存" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("icons-FFCC00.zip");

  const zip = unzipSync(new Uint8Array(await readFile((await download.path()) as string)));
  expect(Object.keys(zip).sort()).toEqual(["icons-FFCC00/a.png", "icons-FFCC00/sub/b.png"]);
  expect(pixel(zip["icons-FFCC00/sub/b.png"], 8, 8)).toEqual([255, 204, 0, 255]);
});

test("dropped files are added", async ({ page }) => {
  await page.goto("/");
  // The tool renders client-side only; wait for it before dispatching events at it.
  await page.getByText("PNGをここにドロップ").waitFor();
  await page.evaluate(
    (bytes) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], "dropped.png", { type: "image/png" }));
      const app = document.querySelector(".app") as HTMLElement;
      app.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: dt }));
      app.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
    },
    [...TRANSPARENT],
  );
  await expect(page.locator(".tile-name")).toHaveText(["dropped.png"]);
  await expect(page.locator(".drop-overlay")).toHaveCount(0);
});
