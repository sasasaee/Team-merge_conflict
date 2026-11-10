import { PanelSkeleton } from "@/ui";

// Shown for a moment while a page's code is downloading (pages are loaded on demand)
export function PageLoader() {
  return (
    <div className="mx-auto grid max-w-[1440px] gap-4 px-5 py-8 lg:grid-cols-3 lg:px-8" aria-label="Loading page">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-4">
          <PanelSkeleton />
        </div>
      ))}
    </div>
  );
}