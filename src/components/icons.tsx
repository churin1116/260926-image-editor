const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function EyedropperIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M10.5 2.5a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L12 7l.5.5-1 1L8 5l1-1 .5.5z" />
      <path d="m8.5 5.5-5 5V13h2.5l5-5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...base} width={12} height={12} aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  );
}
