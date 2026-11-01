import clsx from "clsx";

const LINKS = [
  { href: "#/", label: "Home" },
  { href: "#/plan", label: "Planner" },
  { href: "#/rescue", label: "Rescue Mode" },
  { href: "#/calendar", label: "Survival Calendar" },
  { href: "#/sites", label: "Shadow DNA" },
];

// Top navigation shared by every page. `current` is the hash of the active page.
export function NavBar({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 py-5">
      <a href="#/" className="flex items-center gap-3 text-lg font-bold">
        <img src="/favicon.svg" alt="" className="size-8" /> MoonScope
      </a>
      <div className="flex flex-wrap gap-1">
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
      </div>
    </nav>
  );
}