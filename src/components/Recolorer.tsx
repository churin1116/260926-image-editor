"use client";

import {
  type CSSProperties,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Toaster, toast } from "sonner";
import {
  type Collected,
  fromDataTransfer,
  fromDirectoryHandle,
  fromFileList,
  pickSourceFolder,
} from "@/lib/collect";
import { type Hsv, hexCode, hsvToRgb, rgbToHex, textOn } from "@/lib/color";
import { makeMask, renderPng, revokeMask } from "@/lib/image";
import { comparePaths, fileName, outputLayout } from "@/lib/paths";
import {
  downloadZip,
  findExisting,
  hasFolderAccess,
  pickSaveFolder,
  writeToFolder,
} from "@/lib/save";
import { load, store } from "@/lib/storage";
import { ColorPanel } from "./ColorPanel";
import { type Item, PreviewGrid } from "./PreviewGrid";

type Background = "white" | "black" | "checker";
type Progress = { done: number; total: number };

const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: "white", label: "白" },
  { value: "black", label: "黒" },
  { value: "checker", label: "透明" },
];

const isHsv = (v: unknown): v is Hsv =>
  typeof v === "object" &&
  v !== null &&
  ["h", "s", "v"].every((k) => typeof (v as Record<string, unknown>)[k] === "number");
const isHexList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string" && /^#[0-9A-F]{6}$/.test(s));
const isBackground = (v: unknown): v is Background => BACKGROUNDS.some((b) => b.value === v);
const isTileSize = (v: unknown): v is number => typeof v === "number" && v >= 64 && v <= 256;
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

const byPath = (a: Item, b: Item) => comparePaths(a.path, b.path);

function describeSaveError(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "フォルダへの書き込みが許可されませんでした。もう一度保存して、編集を許可してください。";
  }
  if (err instanceof DOMException && err.name === "NotFoundError") {
    return "元の画像が見つかりませんでした。移動や削除をした画像を外してから、もう一度保存してください。";
  }
  return `保存できませんでした（${err instanceof Error ? err.message : String(err)}）`;
}

function confirmOverwrite(folder: string, existing: string[]): boolean {
  const where = folder ? `「${folder}」` : "選んだフォルダ";
  const more = existing.length > 5 ? `\nほか${existing.length - 5}件` : "";
  const names = existing.slice(0, 5).join("\n") + more;
  return window.confirm(
    `${where}には同じ名前のファイルが${existing.length}件あります。上書きしますか？\n\n${names}`,
  );
}

const toasterStyle = {
  fontFamily: "var(--font-sans)",
  "--normal-bg": "var(--color-panel)",
  "--normal-border": "var(--color-line)",
  "--normal-text": "var(--color-fg)",
  "--border-radius": "4px",
} as CSSProperties;

export default function Recolorer() {
  const [hsv, setHsv] = useState<Hsv>(() => load("color", { h: 4, s: 0.76, v: 0.9 }, isHsv));
  const [swatches, setSwatches] = useState<string[]>(() => load("swatches", [], isHexList));
  const [background, setBackground] = useState<Background>(() =>
    load("background", "white", isBackground),
  );
  const [tileSize, setTileSize] = useState(() => load("tileSize", 128, isTileSize));
  const [clearWhite, setClearWhite] = useState(() => load("clearWhite", false, isBoolean));

  const [items, setItems] = useState<Item[]>([]);
  const [importing, setImporting] = useState<Progress | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<Progress | null>(null);
  const [dragging, setDragging] = useState(false);

  const [folderMode] = useState(hasFolderAccess);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const rgb = hsvToRgb(hsv);
  const hex = rgbToHex(rgb);
  const layout = outputLayout(
    items.map((i) => i.path),
    hexCode(rgb),
  );

  // The color changes on every pointer move; write it once the drag settles.
  useEffect(() => {
    const t = setTimeout(() => store("color", hsv), 300);
    return () => clearTimeout(t);
  }, [hsv]);
  useEffect(() => store("swatches", swatches), [swatches]);
  useEffect(() => store("background", background), [background]);
  useEffect(() => store("tileSize", tileSize), [tileSize]);
  useEffect(() => store("clearWhite", clearWhite), [clearWhite]);

  useEffect(() => {
    // Not in React's attribute types, and React drops unknown boolean props.
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  const addFiles = async ({ picked, skipped }: Collected) => {
    if (picked.length === 0) {
      setNotice(
        skipped > 0
          ? `PNGが見つかりませんでした（PNG以外が${skipped}件）`
          : "PNGが見つかりませんでした",
      );
      return;
    }
    setNotice(null);

    let failed = 0;
    let buffer: Item[] = [];
    const flush = () => {
      const incoming = buffer;
      buffer = [];
      setItems((prev) => {
        const replaced = new Set(incoming.map((i) => i.path));
        for (const old of prev) if (replaced.has(old.path)) revokeMask(old.mask);
        return [...prev.filter((i) => !replaced.has(i.path)), ...incoming].sort(byPath);
      });
    };

    setImporting({ done: 0, total: picked.length });
    for (const [i, { file, path }] of picked.entries()) {
      try {
        buffer.push({ path, name: fileName(path), file, mask: await makeMask(file) });
      } catch {
        failed++;
      }
      // Batch so a folder of hundreds re-renders the grid a few dozen times, not hundreds.
      if (buffer.length >= 12) flush();
      setImporting({ done: i + 1, total: picked.length });
    }
    flush();
    setImporting(null);

    const notes = [
      skipped > 0 && `PNG以外の${skipped}件は読み込みませんでした`,
      failed > 0 && `${failed}件は画像として開けませんでした`,
    ].filter(Boolean);
    setNotice(notes.length > 0 ? notes.join("。") : null);
  };

  const openFolder = async () => {
    if (!folderMode) {
      folderInput.current?.click();
      return;
    }
    try {
      const dir = await pickSourceFolder();
      if (dir) await addFiles(await fromDirectoryHandle(dir));
    } catch (err) {
      setNotice(
        `フォルダを開けませんでした（${err instanceof Error ? err.message : String(err)}）`,
      );
    }
  };

  const removeItem = useCallback((path: string) => {
    setItems((prev) => {
      const gone = prev.find((i) => i.path === path);
      if (gone) revokeMask(gone.mask);
      return prev.filter((i) => i.path !== path);
    });
  }, []);

  const clearAll = () => {
    for (const item of items) revokeMask(item.mask);
    setItems([]);
    setNotice(null);
  };

  const save = async () => {
    // Saving mid-import would silently leave out the images still loading.
    if (items.length === 0 || saving || importing) return;
    const color = rgb;
    const { folder, files } = layout;
    const jobs = items.map((item, i) => ({
      path: files[i],
      render: () => renderPng(item.file, color, clearWhite),
    }));
    const total = jobs.length;
    // Only the outcome of this save should be on screen.
    toast.dismiss();
    try {
      if (folderMode) {
        const dir = await pickSaveFolder();
        if (!dir) return;
        const existing = await findExisting(dir, files);
        if (existing.length > 0 && !confirmOverwrite(dir.name, existing)) return;
        setSaving({ done: 0, total });
        await writeToFolder(dir, jobs, (done) => setSaving({ done, total }));
        const where = dir.name ? `${dir.name} ` : "選んだフォルダ";
        toast.success(`${where}に${total}枚保存しました`);
      } else {
        setSaving({ done: 0, total });
        await downloadZip(folder, jobs, (done) => setSaving({ done, total }));
        toast.success(`${folder}.zip を保存しました`);
      }
    } catch (err) {
      toast.error(describeSaveError(err), { duration: 10_000 });
    } finally {
      setSaving(null);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");
  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current++;
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current--;
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void fromDataTransfer(e.dataTransfer).then(addFiles);
    },
  };

  const saveLabel = saving
    ? `保存中 ${saving.done} / ${saving.total}`
    : folderMode
      ? "フォルダに保存"
      : "ZIPで保存";

  const vars = {
    "--ink": hex,
    "--on-ink": textOn(rgb),
    "--tile": `${tileSize}px`,
  } as CSSProperties;

  const pickButtons = (verb: string) => (
    <>
      <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
        ファイルを{verb}
      </button>
      <button type="button" className="btn" onClick={openFolder}>
        フォルダを{verb}
      </button>
    </>
  );

  return (
    <>
      <div className="app" style={vars} {...dropHandlers}>
        <aside className="panel">
          <h1 className="brand">Image Editor</h1>
          <ColorPanel
            hsv={hsv}
            onChange={setHsv}
            swatches={swatches}
            onSwatchesChange={setSwatches}
          />

          {/* The button comes last: the block sits at the bottom of the panel, so
            nothing that appears or changes above it can move it. */}
          <div className="save">
            <label className="toggle">
              白い部分を透明にする
              <input
                type="checkbox"
                checked={clearWhite}
                onChange={(e) => setClearWhite(e.target.checked)}
              />
            </label>
            {items.length > 0 && (
              <p className="save-note">
                {folderMode
                  ? "選んだフォルダの直下に保存します。同じ名前のファイルがあれば、上書きする前に確認します"
                  : `「${layout.folder}.zip」をダウンロードします`}
              </p>
            )}
            <button
              type="button"
              className="save-btn"
              onClick={save}
              disabled={items.length === 0 || saving !== null || importing !== null}
              title="⌘S"
            >
              {saveLabel}
            </button>
          </div>
        </aside>

        <main className="stage" data-bg={background} data-white={clearWhite ? "clear" : "keep"}>
          {items.length > 0 || importing ? (
            <>
              <div className="toolbar">
                <div className="toolbar-group">
                  <span className="count">{items.length}枚</span>
                  {pickButtons("追加")}
                  <button
                    type="button"
                    className="btn"
                    onClick={clearAll}
                    disabled={importing !== null}
                  >
                    すべて外す
                  </button>
                </div>
                <div className="toolbar-group toolbar-end">
                  <fieldset className="segmented">
                    <legend className="sr-only">プレビューの背景</legend>
                    {BACKGROUNDS.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        aria-pressed={background === b.value}
                        onClick={() => setBackground(b.value)}
                      >
                        <span className="bg-dot" data-bg={b.value} />
                        {b.label}
                      </button>
                    ))}
                  </fieldset>
                  <input
                    type="range"
                    className="size-range"
                    min={64}
                    max={256}
                    step={8}
                    value={tileSize}
                    onChange={(e) => setTileSize(Number(e.target.value))}
                    aria-label="プレビューの大きさ"
                    title="プレビューの大きさ"
                  />
                </div>
                {(importing || notice) && (
                  <p className="notice" aria-live="polite">
                    {importing ? `読み込み中 ${importing.done} / ${importing.total}` : notice}
                  </p>
                )}
              </div>
              <PreviewGrid items={items} onRemove={removeItem} />
            </>
          ) : (
            <div className="empty">
              <div>
                <svg className="empty-mark" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M24 4c7 9.5 14 17.6 14 25.5a14 14 0 0 1-28 0C10 21.6 17 13.5 24 4Z" />
                </svg>
                <p className="empty-title">PNGをここにドロップ</p>
                <p className="empty-sub">
                  フォルダのままドロップすると、中の画像をまとめて読み込みます
                </p>
                <div className="empty-actions">{pickButtons("選ぶ")}</div>
                {notice && <p className="notice">{notice}</p>}
              </div>
            </div>
          )}

          {dragging && (
            <div className="drop-overlay" aria-hidden="true">
              ドロップして追加
            </div>
          )}
        </main>

        <input
          ref={fileInput}
          type="file"
          accept="image/png"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(fromFileList(e.target.files));
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(fromFileList(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
      <Toaster
        theme="dark"
        // Set inline: sonner injects its stylesheet after the app's, so its
        // theme would win over these from a CSS file.
        style={toasterStyle}
      />
    </>
  );
}
