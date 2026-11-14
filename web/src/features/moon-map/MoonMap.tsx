import { useMemo } from "react";
import clsx from "clsx";
import { SITES, simulate, useMission } from "@/core";
import { colors } from "@/ui";

// Moon colour map, served locally from web/public so it works offline (see the README for its source)
const MOON_TEXTURE = import.meta.env.BASE_URL + "moon-color.jpg";

// Verdict of every site under the current plan (shared by the 2D map, the 3D Moon and the chips)
export function useSiteVerdicts() {
  const params = useMission((s) => s.params);
  return useMemo(() => SITES.map((_, i) => simulate({ ...params, siteIdx: i }).verdict), [params]);
}

// Row of site buttons under both Moon views, so they line up and work the same way
export function SiteChips() {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const setParam = useMission((s) => s.setParam);
  const verdicts = useSiteVerdicts();
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {SITES.map((site, i) => (
        <button
          key={site.id}
          type="button"
          aria-pressed={i === siteIdx}
          onClick={() => setParam("siteIdx", i)}
          className={clsx(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
            i === siteIdx ? "border-accent" : "border-line text-muted",
          )}
        >
          <i className="size-2 rounded-full" style={{ backgroundColor: colors[verdicts[i]] }} />
          {site.name}
        </button>
      ))}
    </div>
  );
}

// 2D view. The stage is the same size and position as the 3D Moon's, so switching views does not move anything.
export function MoonMap() {
  const params = useMission((s) => s.params);
  const setParam = useMission((s) => s.setParam);
  const verdicts = useSiteVerdicts();

  return (
    <div className="flex h-full flex-col gap-3">
      <div data-theme="dark" className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-[#03050a]">
        <div className="relative aspect-square w-[72%]">
          <div className="moon-spin absolute inset-0 rounded-full bg-moon/40" style={{ backgroundImage: `url(${MOON_TEXTURE})` }} />
          <div
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-line"
            style={{ background: "radial-gradient(circle at 35% 30%, transparent 35%, rgba(7,11,20,0.85) 78%)" }}
          />
          {SITES.map((site, i) => {
            const t = Math.PI * (0.15 + (0.7 * i) / (SITES.length - 1));
            const active = i === params.siteIdx;
            return (
              <button
                key={site.id}
                type="button"
                title={site.name}
                aria-label={site.name}
                aria-pressed={active}
                onClick={() => setParam("siteIdx", i)}
                className={clsx(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 transition-all",
                  active ? "size-4 ring-4 ring-white/25" : "size-3 hover:scale-125",
                )}
                style={{ left: `${50 + 28 * Math.cos(t)}%`, top: `${84 - 10 * Math.sin(t)}%`, backgroundColor: colors[verdicts[i]] }}
              />
            );
          })}
        </div>
      </div>
      <SiteChips />
      <p className="text-center text-[11px] text-muted">Moon preview. Click a site to choose it.</p>
    </div>
  );
}