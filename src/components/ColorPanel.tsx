"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { type Hsv, hsvToRgb, parseHex, type Rgb, rgbToHex, rgbToHsv } from "@/lib/color";
import { ColorWheel } from "./ColorWheel";
import { HexField, NumberField } from "./fields";
import { EyedropperIcon, PlusIcon } from "./icons";

type Props = {
  hsv: Hsv;
  onChange: (hsv: Hsv) => void;
  swatches: string[];
  onSwatchesChange: (swatches: string[]) => void;
};

const hasEyeDropper = typeof window !== "undefined" && typeof window.EyeDropper === "function";

export function ColorPanel({ hsv, onChange, swatches, onSwatchesChange }: Props) {
  const rgb = hsvToRgb(hsv);
  const hex = rgbToHex(rgb);
  const setRgb = (next: Rgb) => onChange(rgbToHsv(next, hsv));

  const pickFromScreen = async () => {
    if (!window.EyeDropper) return;
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const picked = parseHex(sRGBHex);
      if (picked) setRgb(picked);
    } catch {
      // Esc closes the eyedropper by rejecting; nothing changes.
    }
  };

  const removeSwatch = (target: string) => onSwatchesChange(swatches.filter((s) => s !== target));

  const onSwatchClick = (e: MouseEvent, value: string) => {
    if (e.altKey) removeSwatch(value);
    else {
      const picked = parseHex(value);
      if (picked) setRgb(picked);
    }
  };

  const onSwatchKey = (e: KeyboardEvent, value: string) => {
    if (e.key === "Delete" || e.key === "Backspace") removeSwatch(value);
  };

  return (
    <>
      <ColorWheel hsv={hsv} onChange={onChange} />

      <div className="color-row">
        <div className="chip" />
        <HexField hex={hex} onCommit={setRgb} />
        {hasEyeDropper && (
          <button
            type="button"
            className="icon-btn"
            onClick={pickFromScreen}
            aria-label="画面から色を拾う"
            title="画面から色を拾う"
          >
            <EyedropperIcon />
          </button>
        )}
      </div>

      <div className="fields">
        <NumberField
          label="H"
          unit="°"
          value={Math.round(hsv.h) % 360}
          max={359}
          onCommit={(h) => onChange({ ...hsv, h })}
        />
        <NumberField
          label="S"
          unit="%"
          value={Math.round(hsv.s * 100)}
          max={100}
          onCommit={(s) => onChange({ ...hsv, s: s / 100 })}
        />
        <NumberField
          label="B"
          unit="%"
          value={Math.round(hsv.v * 100)}
          max={100}
          onCommit={(v) => onChange({ ...hsv, v: v / 100 })}
        />
        <NumberField label="R" value={rgb.r} max={255} onCommit={(r) => setRgb({ ...rgb, r })} />
        <NumberField label="G" value={rgb.g} max={255} onCommit={(g) => setRgb({ ...rgb, g })} />
        <NumberField label="B" value={rgb.b} max={255} onCommit={(b) => setRgb({ ...rgb, b })} />
      </div>

      <div className="swatches">
        {swatches.map((value) => (
          <button
            key={value}
            type="button"
            className="swatch"
            style={{ background: value }}
            aria-current={value === hex}
            aria-label={`${value} を使う`}
            title={`${value}\nクリックで使う・Alt+クリックかDeleteキーで削除`}
            onClick={(e) => onSwatchClick(e, value)}
            onKeyDown={(e) => onSwatchKey(e, value)}
          />
        ))}
        <button
          type="button"
          className="swatch-add"
          onClick={() => onSwatchesChange([...swatches, hex])}
          disabled={swatches.includes(hex)}
          aria-label="今の色をスウォッチに保存"
          title="今の色をスウォッチに保存"
        >
          <PlusIcon />
        </button>
        {swatches.length === 0 && <span className="hint">よく使う色を保存</span>}
      </div>
    </>
  );
}
