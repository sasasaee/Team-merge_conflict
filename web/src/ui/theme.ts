// Colours for code that can't use Tailwind classes (SVG, charts, 3D).
// Each one points at the CSS token in app/styles.css, so it follows the light/dark theme automatically.
export const colors = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  surface2: "var(--color-surface-2)",
  line: "var(--color-line)",
  text: "var(--color-text)",
  muted: "var(--color-muted)",
  sun: "var(--color-sun)",
  earth: "var(--color-earth)",
  moon: "var(--color-moon)",
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  fail: "var(--color-fail)",
  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-soft)",
} as const;

// The actual values of each token in both themes (shown on the UI kit page)
export const PALETTE: Record<keyof typeof colors, { dark: string; light: string }> = {
  bg: { dark: "#070B14", light: "#F4F6FB" },
  surface: { dark: "#0E1524", light: "#FFFFFF" },
  surface2: { dark: "#151E31", light: "#EEF2F8" },
  line: { dark: "#22304A", light: "#D6DDE9" },
  text: { dark: "#E6EAF2", light: "#0B1220" },
  muted: { dark: "#8A96AD", light: "#536079" },
  sun: { dark: "#F5A524", light: "#B45309" },
  earth: { dark: "#3B82F6", light: "#2563EB" },
  moon: { dark: "#9CA3AF", light: "#6B7280" },
  ok: { dark: "#22C55E", light: "#166534" },
  warn: { dark: "#F59E0B", light: "#C2410C" },
  fail: { dark: "#F87171", light: "#B91C1C" },
  accent: { dark: "#0F766E", light: "#0F766E" },
  accentSoft: { dark: "#5EEAD4", light: "#0F766E" },
};

export type Tone = "ok" | "warn" | "fail" | "muted" | "accent" | "sun" | "earth";

export const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  fail: "text-fail",
  muted: "text-muted",
  accent: "text-accent-soft",
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