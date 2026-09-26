"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { parseHex, type Rgb } from "@/lib/color";

// While a field has focus it shows what the user is typing, not the formatted
// value, so a half-typed "2" is not rewritten to "002" under the cursor.

type NumberProps = {
  label: string;
  unit?: string;
  value: number;
  max: number;
  onCommit: (n: number) => void;
};

export function NumberField({ label, unit, value, max, onCommit }: NumberProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (n: number) => onCommit(Math.min(max, Math.max(0, Math.round(n))));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(max, Math.max(0, value + (e.key === "ArrowUp" ? step : -step)));
      commit(next);
      setDraft(String(next));
    } else if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={draft ?? String(value)}
        onFocus={(e) => {
          setDraft(String(value));
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const text = e.target.value.trim();
          if (/^\d+$/.test(text)) commit(Number(text));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={onKeyDown}
      />
      {unit && <span className="field-unit">{unit}</span>}
    </label>
  );
}

type HexProps = { hex: string; onCommit: (rgb: Rgb) => void };

export function HexField({ hex, onCommit }: HexProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  return (
    <input
      className="hex-input"
      aria-label="HEXカラーコード"
      autoComplete="off"
      spellCheck={false}
      maxLength={7}
      value={draft ?? hex}
      onFocus={(e) => {
        setDraft(hex);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        // Wait for all six digits; the 3-digit form would otherwise fire on the
        // way to typing a full code and jump the color around.
        const rgb = e.target.value.replace(/^#/, "").length === 6 ? parseHex(e.target.value) : null;
        if (rgb) onCommit(rgb);
      }}
      onBlur={(e) => {
        const text = e.target.value.replace(/^#/, "");
        const rgb = !cancelled.current && text.length === 3 ? parseHex(text) : null;
        if (rgb) onCommit(rgb);
        cancelled.current = false;
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancelled.current = true;
        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
      }}
    />
  );
}
