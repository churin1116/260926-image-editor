import { comparePaths } from "./paths";

export type Picked = { file: File; path: string };
export type Collected = { picked: Picked[]; skipped: number };

// Dotfiles are ignored without being counted: besides .DS_Store they include
// macOS "._icon.png" AppleDouble files, which end in .png but are not images
// and appear whenever a folder has lived on a USB or SMB drive.
const isHidden = (path: string) => path.split("/").some((part) => part.startsWith("."));
const isPng = (name: string) => /\.png$/i.test(name);

function sorted(picked: Picked[], skipped: number): Collected {
  return { picked: picked.sort((a, b) => comparePaths(a.path, b.path)), skipped };
}

/** From <input type="file">, with or without webkitdirectory. */
export function fromFileList(list: FileList): Collected {
  const picked: Picked[] = [];
  let skipped = 0;
  for (const file of list) {
    const path = file.webkitRelativePath || file.name;
    if (isHidden(path)) continue;
    if (!isPng(file.name)) {
      skipped++;
      continue;
    }
    picked.push({ file, path });
  }
  return sorted(picked, skipped);
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

  const picked: Picked[] = [];
  let skipped = 0;
  for (const file of loose) {
    if (isHidden(file.name)) continue;
    if (isPng(file.name)) picked.push({ file, path: file.name });
    else skipped++;
  }

  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (isHidden(entry.name)) return;
    if (entry.isDirectory) {
      const children = await readAll((entry as FileSystemDirectoryEntry).createReader());
      for (const child of children) await walk(child);
      return;
    }
    if (!isPng(entry.name)) {
      skipped++;
      return;
    }
    const file = await toFile(entry as FileSystemFileEntry);
    picked.push({ file, path: entry.fullPath.replace(/^\//, "") });
  };

  for (const root of roots) await walk(root);
  return sorted(picked, skipped);
}
