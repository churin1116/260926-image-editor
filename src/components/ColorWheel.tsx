"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { type Hsv, hsvToRgb, rgbToHex } from "@/lib/color";

// Geometry as fractions of the wheel's width, so it scales with the panel.
const RING = 0.06; // hue ring thickness
const GAP = 0.035; // between ring and square
const INNER = 0.5 - RING - GAP;
const SIDE = INNER * Math.SQRT2; // square inscribed in the inner circle
const OFFSET = (1 - SIDE) / 2;
const HUE_TRACK = 0.5 - RING / 2; // radius the hue handle travels on

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const pct = (n: number) => `${n * 100}%`;

type Props = { hsv: Hsv; onChange: (hsv: Hsv) => void };

export function ColorWheel({ hsv, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<"hue" | "square" | null>(null);
  // Handlers read the latest color through a ref: a drag that started on the
  // ring must not reset saturation, and held-down arrow keys can fire again
  // before React has re-rendered with the previous step.
  const latest = useRef(hsv);
  latest.current = hsv;
  const emit = (next: Hsv) => {
    latest.current = next;
    onChange(next);
  };

  const locate = (e: PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };

  const apply = (p: { x: number; y: number }) => {
    if (drag.current === "hue") {
      const deg = (Math.atan2(p.x - 0.5, 0.5 - p.y) * 180) / Math.PI;
      emit({ ...latest.current, h: (deg + 360) % 360 });
    } else if (drag.current === "square") {
      emit({
        ...latest.current,
        s: clamp01((p.x - OFFSET) / SIDE),
        v: clamp01(1 - (p.y - OFFSET) / SIDE),
      });
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const p = locate(e);
    if (!p) return;
    // A handle overhangs its track (the square's at s=1 pokes past the edge), so
    // grabbing one decides the mode before position does.
    const handle = (e.target as HTMLElement).dataset.handle;
    const inSquare = p.x >= OFFSET && p.x <= 1 - OFFSET && p.y >= OFFSET && p.y <= 1 - OFFSET;
    drag.current = handle === "hue" || handle === "square" ? handle : inSquare ? "square" : "hue";
    e.currentTarget.setPointerCapture(e.pointerId);
    // Move focus to the matching handle so arrow keys continue the adjustment.
    e.currentTarget.querySelector<HTMLElement>(`[data-handle="${drag.current}"]`)?.focus();
    e.preventDefault();
    apply(p);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = drag.current && locate(e);
    if (p) apply(p);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onHueKey = (e: KeyboardEvent) => {
    const step = e.shiftKey || e.key.startsWith("Page") ? 10 : 1;
    const delta = {
      ArrowRight: step,
      ArrowUp: step,
      PageUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageDown: -step,
    }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const { h } = latest.current;
    emit({ ...latest.current, h: (Math.round(h) + delta + 360) % 360 });
  };

  const onSquareKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const { s, v } = latest.current;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowRight: { s: clamp01(s + step) },
      ArrowLeft: { s: clamp01(s - step) },
      ArrowUp: { v: clamp01(v + step) },
      ArrowDown: { v: clamp01(v - step) },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    emit({ ...latest.current, ...move });
  };

  const hueRad = (hsv.h * Math.PI) / 180;
  const pure = `hsl(${hsv.h} 100% 50%)`;

  return (
    <div
      ref={ref}
      className="wheel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="wheel-ring" />
      <div
        className="wheel-square"
        style={{
          left: pct(OFFSET),
          top: pct(OFFSET),
          width: pct(SIDE),
          height: pct(SIDE),
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})`,
        }}
      />
      <div
        data-handle="hue"
        role="slider"
        tabIndex={0}
        aria-label="色相"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsv.h) % 360}
        aria-valuetext={`${Math.round(hsv.h) % 360}度`}
        onKeyDown={onHueKey}
        className="wheel-handle"
        style={{
          left: pct(0.5 + HUE_TRACK * Math.sin(hueRad)),
          top: pct(0.5 - HUE_TRACK * Math.cos(hueRad)),
          background: pure,
        }}
      />
      <div
        data-handle="square"
        role="slider"
        tabIndex={0}
        aria-label="彩度と明度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`彩度 ${Math.round(hsv.s * 100)}%、明度 ${Math.round(hsv.v * 100)}%`}
        onKeyDown={onSquareKey}
        className="wheel-handle"
        style={{
          left: pct(OFFSET + hsv.s * SIDE),
          top: pct(OFFSET + (1 - hsv.v) * SIDE),
          background: rgbToHex(hsvToRgb(hsv)),
        }}
      />
    </div>
  );
}
