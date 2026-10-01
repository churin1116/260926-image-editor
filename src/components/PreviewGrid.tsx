"use client";

import { memo } from "react";
import type { Mask } from "@/lib/image";
import { CloseIcon } from "./icons";

export type Item = { path: string; name: string; file: File; mask: Mask };

type Props = { items: Item[]; onRemove: (path: string) => void };

// Set as the longhand, not through a var() in the mask shorthand: a var() there
// is re-parsed on every recolor, for every tile.
const maskStyle = (url: string) => ({
  maskImage: `url("${url}")`,
  WebkitMaskImage: `url("${url}")`,
});

// Memoized and color-agnostic: the tiles paint with var(--ink) from an ancestor,
// so dragging the wheel never re-renders this list.
export const PreviewGrid = memo(function PreviewGrid({ items, onRemove }: Props) {
  return (
    <ul className="grid">
      {items.map((item) => (
        <li key={item.path} className="tile">
          <div className="tile-canvas">
            {item.mask.paper && <div className="tile-paper" style={maskStyle(item.mask.paper)} />}
            <div
              className="tile-ink"
              role="img"
              aria-label={item.name}
              style={maskStyle(item.mask.ink)}
            />
          </div>
          <p className="tile-name" title={`${item.path}\n${item.mask.width} × ${item.mask.height}`}>
            {item.name}
          </p>
          <button
            type="button"
            className="tile-remove"
            onClick={() => onRemove(item.path)}
            aria-label={`${item.name} を外す`}
            title="外す"
          >
            <CloseIcon />
          </button>
        </li>
      ))}
    </ul>
  );
});
