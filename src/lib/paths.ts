/** The one top-level folder every path sits in, or null for loose or mixed files. */
export function commonRoot(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const roots = paths.map((p) => (p.includes("/") ? p.slice(0, p.indexOf("/")) : null));
  const first = roots[0];
  return first !== null && roots.every((r) => r === first) ? first : null;
}

/**
 * Each file keeps its place inside the source folder, minus the source folder's
 * own name: saving to a folder puts them straight into the chosen one, and the
 * ZIP wraps them in a folder named after the source and the color ("icons-E53935").
 */
export function outputLayout(paths: string[], code: string): { folder: string; files: string[] } {
  const root = commonRoot(paths);
  return {
    folder: `${root ?? "recolor"}-${code}`,
    files: root ? paths.map((p) => p.slice(root.length + 1)) : paths,
  };
}

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

const collator = new Intl.Collator("ja", { numeric: true });

/** "icon2" before "icon10", folders grouped together. */
export function comparePaths(a: string, b: string): number {
  return collator.compare(a, b);
}
