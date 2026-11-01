// Colours for code that can't use Tailwind classes (SVG, charts, 3D).
// Must match the @theme values in app/styles.css.
export const colors = {
  bg: "#070B14",
  surface: "#0E1524",
  surface2: "#151E31",
  line: "#22304A",
  text: "#E6EAF2",
  muted: "#8A96AD",
  sun: "#F5A524",
  earth: "#3B82F6",
  moon: "#9CA3AF",
  ok: "#22C55E",
  warn: "#F59E0B",
  fail: "#EF4444",
  accent: "#8B5CF6",
} as const;

export type Tone = "ok" | "warn" | "fail" | "muted" | "accent" | "sun" | "earth";

export const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  fail: "text-fail",
  muted: "text-muted",
  accent: "text-accent",
  sun: "text-sun",
  earth: "text-earth",
};

export const toneBg: Record<Tone, string> = {
  ok: "bg-ok/15",
  warn: "bg-warn/15",
  fail: "bg-fail/15",
  muted: "bg-surface-2",
  accent: "bg-accent/15",
  sun: "bg-sun/15",
  earth: "bg-earth/15",
};