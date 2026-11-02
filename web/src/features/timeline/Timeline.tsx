import { useEffect } from "react";
import { Pause, Play } from "lucide-react";
import { getSite, useMission, wrapHour } from "@/core";
import { colors } from "@/ui";

const LINK_COLOR = { ok: colors.earth, weak: colors.warn, lost: colors.fail } as const;
const LEGEND = [
  ["bg-sun", "Sunlit"],
  ["bg-earth", "Good Earth link"],
  ["bg-warn", "Weak link"],
  ["bg-fail", "Signal lost"],
] as const;

export function Timeline() {
  const params = useMission((s) => s.params);
  const timeH = useMission((s) => s.timeH);
  const playing = useMission((s) => s.playing);
  const setTime = useMission((s) => s.setTime);
  const setPlaying = useMission((s) => s.setPlaying);

  const n = params.durationDays * 24;
  const s = getSite(params.siteIdx);
  const w = 1000 / n;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const t = useMission.getState().timeH;
      useMission.getState().setTime(t + 1 >= n ? 0 : t + 1);
    }, 60);
    return () => window.clearInterval(id);
  }, [playing, n]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[64px_1fr] items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span>Sunlight</span>
        <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="row-span-2 h-14 w-full rounded-md">
          {Array.from({ length: n }, (_, k) => {
            const h = wrapHour(k + params.delayH);
            return (
              <g key={k}>
                <rect x={k * w} y={0} width={w + 0.6} height={26} fill={s.lit[h] ? colors.sun : colors.surface2} />
                <rect x={k * w} y={32} width={w + 0.6} height={26} fill={LINK_COLOR[s.earth[h]]} />
              </g>
            );
          })}
          <rect x={timeH * w - 1.5} y={0} width={3} height={60} fill="#fff" />
        </svg>
        <span>Earth link</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-8 place-items-center rounded-full bg-accent text-white hover:bg-accent/80"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <input type="range" aria-label="Mission time" min={0} max={n - 1} value={timeH} onChange={(e) => setTime(Number(e.target.value))} className="flex-1 accent-accent" />
        <span className="num w-28 text-right text-xs">
          Day {Math.floor(timeH / 24) + 1}, {String(timeH % 24).padStart(2, "0")}:00
        </span>
      </div>

      <div className="flex flex-wrap gap-4 text-[11px] text-muted">
        {LEGEND.map(([bg, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className={`h-2 w-4 rounded-sm ${bg}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}