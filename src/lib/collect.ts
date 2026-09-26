import { comparePaths } from "./paths";

export type Picked = { file: File; path: string };
export type Collected = { picked: Picked[]; skipped: number };

// Dotfiles are ignored without being counted: besides .DS_Store they include
// macOS "._icon.png" AppleDouble files, which end in .png but are not images
// and appear whenever a folder has lived on a USB or SMB drive.
const isHidden = (path: string) => path.split("/").some((part) => part.startsWith("."));
const isPng = (path: string) => /\.png$/i.test(path);

/** Shared filtering for every way files come in, so they all count alike. */
function collector() {
  const picked: Picked[] = [];
  let skipped = 0;
  return {
    /** Checked before reading a file, so hidden and non-PNG files are never opened. */
    wants(path: string): boolean {
      if (isHidden(path)) return false;
      if (isPng(path)) return true;
      skipped++;
      return false;
    },
    add(file: File, path: string) {
      picked.push({ file, path });
    },
    result(): Collected {
      return { picked: picked.sort((a, b) => comparePaths(a.path, b.path)), skipped };
    },
  };
}

/** From <input type="file">, with or without webkitdirectory. */
export function fromFileList(list: Iterable<File>): Collected {
  const c = collector();
  for (const file of list) {
    const path = file.webkitRelativePath || file.name;
    if (c.wants(path)) c.add(file, path);
  }
  return c.result();
}

/**
 * Where the File System Access API exists (Chrome, Edge), folders are opened
 * with it instead of <input webkitdirectory>: for that input Chrome asks
 * "Upload N files to this site?", which reads as if the images leave the
 * machine. Resolves null on cancel.
 */
export async function pickSourceFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await window.showDirectoryPicker?.({ id: "recolor-open", mode: "read" })) ?? null;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

/** Paths start with the folder's own name, matching what webkitdirectory gives. */
export async function fromDirectoryHandle(dir: FileSystemDirectoryHandle): Promise<Collected> {
  const c = collector();
  const walk = async (handle: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
    for await (const child of handle.values()) {
      const path = `${prefix}/${child.name}`;
      if (child.kind === "directory") {
        if (!isHidden(child.name)) await walk(child as FileSystemDirectoryHandle, path);
      } else if (c.wants(path)) {
        c.add(await (child as FileSystemFileHandle).getFile(), path);
      }
    }
  };
  await walk(dir, dir.name);
  return c.result();
}

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  // readEntries hands back at most 100 entries per call; keep asking until empty.
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          next();
        }
      }, reject);
    next();
  });
}

function toFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** From a drop, descending into any folders that were dropped. */
export async function fromDataTransfer(dt: DataTransfer): Promise<Collected> {
  // Entries must be taken synchronously: the DataTransfer is emptied once the
  // drop handler yields. Some sources (an image dragged out of another app)
  // offer a file but no entry; those are taken as loose files.
  const roots: FileSystemEntry[] = [];
  const loose: File[] = [];
  for (const item of dt.items) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry();
    const file = entry ? null : item.getAsFile();
    if (entry) roots.push(entry);
    else if (file) loose.push(file);
  }

  const c = collector();
  for (const file of loose) if (c.wants(file.name)) c.add(file, file.name);

  const walk = async (entry: FileSystemEntry): Promise<void> => {
    const path = entry.fullPath.replace(/^\//, "");
    if (entry.isDirectory) {
      if (isHidden(entry.name)) return;
      const children = await readAll((entry as FileSystemDirectoryEntry).createReader());
      for (const child of children) await walk(child);
    } else if (c.wants(path)) {
      c.add(await toFile(entry as FileSystemFileEntry), path);
    }
  };
  for (const root of roots) await walk(root);
  return c.result();
}
