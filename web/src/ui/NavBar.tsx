import type { ReactNode } from "react";
import clsx from "clsx";

const LINKS = [
  { href: "#/", label: "Home" },
  { href: "#/plan", label: "Planner" },
  { href: "#/rescue", label: "Rescue Mode" },
  { href: "#/calendar", label: "Survival Calendar" },
  { href: "#/sites", label: "Shadow DNA" },
];

// Top navigation, rendered once by App above every page and kept at the top while scrolling.
// `current` is the hash of the active page. `extra` sits next to the logo (the "?" About button),
// `end` sits after the page links (the theme switch).
export function NavBar({ current, extra, end }: { current: string; extra?: ReactNode; end?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <a href="#/" className="flex items-center gap-3 font-display text-lg font-bold">
            <img src="/favicon.svg" alt="" className="size-8" /> MoonScope
          </a>
          {extra}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={current === l.href ? "page" : undefined}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                current === l.href ? "bg-accent/20 text-text" : "text-muted hover:text-text",
              )}
            >
              {l.label}
            </a>
          ))}
          {end && <div className="ml-2">{end}</div>}
        </div>
      </nav>
    </header>
  );
}