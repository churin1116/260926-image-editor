import { zipSync } from "fflate";

export type Job = { path: string; render: () => Promise<Uint8Array<ArrayBuffer>> };
type Progress = (done: number) => void;

/**
 * Chrome and Edge on desktop, where folders open and save through the File
 * System Access API. Elsewhere folders open through <input webkitdirectory>
 * and saving falls back to a ZIP download.
 */
export function hasFolderAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/**
 * Must run first in a click or key handler: the picker needs the user gesture,
 * which expires if anything is awaited before it. Resolves null on cancel.
 */
export async function pickSaveFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // The id makes the browser reopen wherever the user saved last time.
    return (await window.showDirectoryPicker?.({ id: "recolor-save", mode: "readwrite" })) ?? null;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

async function fileExists(root: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  const parts = path.split("/");
  const name = parts.pop() as string;
  try {
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    await dir.getFileHandle(name);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") return false;
    throw err;
  }
}

/**
 * The paths that already name a file in the folder. Saving writes straight
 * into the chosen folder, so these would be replaced; asking first is what
 * keeps the originals safe when the user picks the folder they loaded from.
 */
export async function findExisting(
  root: FileSystemDirectoryHandle,
  paths: string[],
): Promise<string[]> {
  const found: string[] = [];
  for (const path of paths) if (await fileExists(root, path)) found.push(path);
  return found;
}

/** Writes each file at its path under the folder, replacing any file already there. */
export async function writeToFolder(
  root: FileSystemDirectoryHandle,
  jobs: Job[],
  onProgress: Progress,
): Promise<void> {
  for (const [i, job] of jobs.entries()) {
    const parts = job.path.split("/");
    const file = parts.pop() as string;
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
    const writable = await (await dir.getFileHandle(file, { create: true })).createWritable();
    await writable.write(await job.render());
    await writable.close();
    onProgress(i + 1);
  }
}

/**
 * Yields so the progress count can paint between images. Not setTimeout: a
 * background tab holds timers to about one per second, which would stall a
 * long export the moment the user switches tabs.
 */
function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      resolve();
    };
    port2.postMessage(null);
  });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function buildZip(folder: string, jobs: Job[], onProgress: Progress) {
  const entries: Record<string, Uint8Array> = {};
  for (const [i, job] of jobs.entries()) {
    entries[`${folder}/${job.path}`] = await job.render();
    onProgress(i + 1);
    await nextTask();
  }
  // PNG is already deflated; storing without compression is just as small and faster.
  return zipSync(entries, { level: 0 });
}

export async function downloadZip(folder: string, jobs: Job[], onProgress: Progress) {
  const zip = await buildZip(folder, jobs, onProgress);
  download(new Blob([new Uint8Array(zip)], { type: "application/zip" }), `${folder}.zip`);
}
