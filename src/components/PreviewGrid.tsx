"use client";

import { memo } from "react";
import type { Mask } from "@/lib/image";
import { CloseIcon } from "./icons";

export type Item = { path: string; name: string; file: File; mask: Mask };

type Props = { items: Item[]; onRemove: (path: string) => void };

// Memoized and color-agnostic: the tiles paint with var(--ink) from an ancestor,
// so dragging the wheel never re-renders this list.
export const PreviewGrid = memo(function PreviewGrid({ items, onRemove }: Props) {
  return (
    <ul className="grid">
      {items.map((item) => (
        <li key={item.path} className="tile">
          <div className="tile-canvas">
            <div
              className="tile-ink"
              role="img"
              aria-label={item.name}
              // Set as the longhand, not through a var() in the mask shorthand:
              // a var() there is re-parsed on every recolor, for every tile.
              style={{
                maskImage: `url("${item.mask.url}")`,
                WebkitMaskImage: `url("${item.mask.url}")`,
              }}
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
