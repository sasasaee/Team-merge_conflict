import { useEffect, useState } from "react";
import clsx from "clsx";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
const KEY = "moonscope-theme";

// Start from the saved choice (index.html already applied it before the first paint), else dark
function initialTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// Space-themed switch in the top menu: lunar night (Moon, stars) / lunar day (Sun, bright sky)
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const light = theme === "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // storage can be blocked (private window); the theme still works for this visit
    }
  }, [theme]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label="Light theme"
      title={light ? "Switch to lunar night (dark)" : "Switch to lunar day (light)"}
      onClick={() => setTheme(light ? "dark" : "light")}
      className={clsx(
        "relative h-8 w-15 shrink-0 overflow-hidden rounded-full border transition-colors duration-500",
        light ? "border-sky-300 bg-gradient-to-r from-sky-200 to-amber-100" : "border-line bg-gradient-to-r from-[#0b1530] to-[#1d2a55]",
      )}
    >
      {/* Stars at night, fading out by day */}
      <span aria-hidden className={clsx("absolute inset-0 transition-opacity duration-500", light ? "opacity-0" : "opacity-100")}>
        <i className="absolute top-1.5 right-3 size-0.5 rounded-full bg-white" />
        <i className="absolute top-4 right-5 size-[3px] rounded-full bg-white/80" />
        <i className="absolute top-2.5 right-7.5 size-0.5 rounded-full bg-white/60" />
        <i className="absolute bottom-1.5 right-2 size-0.5 rounded-full bg-white/70" />
      </span>
      {/* Knob: the Moon by night, the Sun by day */}
      <span
        aria-hidden
        className={clsx(
          "absolute top-1/2 left-1 grid size-6 -translate-y-1/2 place-items-center rounded-full transition-all duration-500",
          light ? "translate-x-7 bg-amber-400 text-amber-900 shadow-[0_0_12px_rgba(245,165,36,0.8)]" : "translate-x-0 bg-slate-300 text-slate-700",
        )}
      >
        {light ? <Sun size={14} /> : <Moon size={13} />}
      </span>
    </button>
  );
}