import { useMemo } from "react";
import clsx from "clsx";
import { SITES, simulate, useMission } from "@/core";
import { colors } from "@/ui";

// NASA SVS "CGI Moon Kit" colour map from LRO (svs.gsfc.nasa.gov/4720)
const MOON_TEXTURE = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg";

export function MoonMap() {
  const params = useMission((s) => s.params);
  const setParam = useMission((s) => s.setParam);
  const verdicts = useMemo(() => SITES.map((_, i) => simulate({ ...params, siteIdx: i }).verdict), [params]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative aspect-square w-full max-w-[280px]">
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

      <div className="flex flex-wrap justify-center gap-1.5">
        {SITES.map((site, i) => (
          <button
            key={site.id}
            type="button"
            aria-pressed={i === params.siteIdx}
            onClick={() => setParam("siteIdx", i)}
            className={clsx(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
              i === params.siteIdx ? "border-accent" : "border-line text-muted",
            )}
          >
            <i className="size-2 rounded-full" style={{ backgroundColor: colors[verdicts[i]] }} />
            {site.name}
          </button>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted">Preview using NASA LRO imagery. The 3D globe (R4) replaces this brick.</p>
    </div>
  );
}