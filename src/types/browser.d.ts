// Chromium-only APIs that lib.dom does not declare yet. Both are optional so
// every call site has to feature-detect.

interface Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
  EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
}
