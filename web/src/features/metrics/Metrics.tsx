import { VERDICT_LABEL, getSite, useMission, useSim, wrapHour } from "@/core";
import { StatTile } from "@/ui";

const pct = (x: number) => String(Math.round(x * 100));

export function Metrics() {
  const params = useMission((s) => s.params);
  const timeH = useMission((s) => s.timeH);
  const r = useSim();
  const s = getSite(params.siteIdx);
  const h = wrapHour(timeH + params.delayH);

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile label="Sun height now" value={s.sunEl[h].toFixed(1)} unit="°" tone="sun" hint={s.lit[h] ? "Sunlit" : "In shadow"} />
      <StatTile label="Time in sunlight" value={pct(r.litPct)} unit="%" />
      <StatTile label="Earth contact" value={pct(r.earthOkPct)} unit="%" tone="earth" />
      <StatTile
        label="Longest signal loss"
        value={String(r.longestBlackoutH)}
        unit="h"
        tone={r.longestBlackoutH > 48 ? "fail" : r.longestBlackoutH > 0 ? "warn" : "ok"}
      />
      <StatTile
        label="Lowest battery"
        value={r.minSoc.toFixed(0)}
        unit="kWh"
        tone={r.minSoc < r.reserve ? "fail" : r.minSoc < r.reserve * 1.5 ? "warn" : "ok"}
        hint={`Reserve ${r.reserve.toFixed(0)} kWh`}
      />
      <StatTile
        label="Verdict"
        value={VERDICT_LABEL[r.verdict]}
        tone={r.verdict}
        hint={r.failHour !== null ? `Fails on day ${Math.floor(r.failHour / 24) + 1} (${r.cause})` : "All rules pass"}
      />
    </div>
  );
}