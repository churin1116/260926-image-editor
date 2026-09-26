import { zipSync } from "fflate";

export type Job = { path: string; render: () => Promise<Uint8Array<ArrayBuffer>> };
type Progress = (done: number) => void;

/** Chrome and Edge on desktop; everywhere else saves a ZIP instead. */
export function canSaveToFolder(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/**
 * Must run first in a click or key handler: the picker needs the user gesture,
 * which expires if anything is awaited before it. Resolves null on cancel.
 */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // The id makes the browser reopen wherever the user saved last time.
    return (await window.showDirectoryPicker?.({ id: "recolor-save", mode: "readwrite" })) ?? null;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

export async function writeToFolder(
  parent: FileSystemDirectoryHandle,
  folder: string,
  jobs: Job[],
  onProgress: Progress,
): Promise<void> {
  const root = await parent.getDirectoryHandle(folder, { create: true });
  for (const [i, job] of jobs.entries()) {
    const parts = job.path.split("/");
    const name = parts.pop() as string;
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
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
