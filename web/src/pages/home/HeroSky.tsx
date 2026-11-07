import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Pause, Play } from "lucide-react";
import { HOURS, SITES, getSite, simulate, useMission } from "@/core";
import { colors } from "@/ui";

// Live hero: one lunar month at the selected site, seen as a 360-degree horizon.
// x = compass direction (N on the left edge, all the way round), y = height above the horizon.
const W = 1600;
const H = 420;
const GROUND = 330; // y of 0 degrees
const SCALE = 26; // px per degree (heights exaggerated so the low south-pole Sun is visible)
const TICK_MS = 90; // one mission hour per tick, so a lunar month loops in about a minute

const x = (az: number) => (az / 360) * W;
const y = (el: number) => GROUND - el * SCALE;

// Fixed star field (same every render)
const STARS = Array.from({ length: 70 }, (_, i) => ({
  cx: (i * 233) % W,
  cy: (i * 97) % 220,
  r: i % 7 === 0 ? 1.6 : 0.9,
  o: 0.25 + ((i * 37) % 60) / 100,
}));

const LINK = {
  ok: { label: "Strong", color: colors.earth },
  weak: { label: "Weak", color: colors.warn },
  lost: { label: "Lost", color: colors.fail },
} as const;

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HeroSky() {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const params = useMission((s) => s.params);
  const setParam = useMission((s) => s.setParam);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  const site = getSite(siteIdx);
  const ridge = useMemo(
    () => site.horizon.map((el, az) => `${az === 0 ? "M" : "L"}${x(az)} ${y(el)}`).join(" ") + ` L${W} ${y(site.horizon[0])}`,
    [site],
  );
  const month = useMemo(() => simulate({ ...params, delayH: 0, durationDays: 28 }), [params]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setHour((h) => (h + 1) % HOURS), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const lit = site.lit[hour];
  const link = LINK[site.earth[hour]];
  const sunX = x(site.sunAz[hour]);
  const sunY = y(site.sunEl[hour]);
  const margin = site.sunEl[hour] - site.horizon[Math.round(site.sunAz[hour]) % 360];
  const soc = month.soc[hour] ?? 0;
  const socPct = soc / params.batteryKwh;
  const trail = Array.from({ length: 48 }, (_, k) => (hour - 47 + k + HOURS) % HOURS);

  return (
    <div className="relative">
      <div className="relative h-[300px] overflow-hidden sm:h-[420px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMax slice"
          className="absolute inset-0 size-full"
          role="img"
          aria-label={`Live view of the horizon at ${SITES[siteIdx].name}: the Sun circles low around the sky over one lunar month`}
        >
          <defs>
            <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#05080f" />
              <stop offset="1" stopColor={lit ? "#1d2a55" : "#0d1428"} style={{ transition: "stop-color 0.8s" }} />
            </linearGradient>
            <radialGradient id="hero-sun" gradientUnits="userSpaceOnUse" cx={sunX} cy={sunY} r={300}>
              <stop offset="0" stopColor={colors.sun} stopOpacity={lit ? 0.55 : 0.18} />
              <stop offset="0.4" stopColor={colors.sun} stopOpacity={lit ? 0.12 : 0.04} />
              <stop offset="1" stopColor={colors.sun} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hero-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#141c33" />
              <stop offset="1" stopColor="#070b14" />
            </linearGradient>
          </defs>

          <rect width={W} height={H} fill="url(#hero-sky)" />
          {STARS.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.o} />
          ))}
          <rect width={W} height={H} fill="url(#hero-sun)" />

          {/* Sun path over the last two days */}
          {trail.map((h, k) => (
            <circle key={k} cx={x(site.sunAz[h])} cy={y(site.sunEl[h])} r={2} fill={colors.sun} opacity={(k / 48) * 0.5} />
          ))}
          <circle cx={sunX} cy={sunY} r={11} fill="#fff4d6" />
          <circle cx={x(site.earthAz[hour])} cy={y(site.earthEl[hour])} r={16} fill={colors.earth} opacity={0.25} />
          <circle cx={x(site.earthAz[hour])} cy={y(site.earthEl[hour])} r={9} fill={colors.earth} />

          {/* Mountains: the ridge glows when sunlight reaches the lander */}
          <path d={`${ridge} L${W} ${H} L0 ${H} Z`} fill="url(#hero-ground)" />
          <path
            d={ridge}
            fill="none"
            stroke={lit ? colors.sun : colors.line}
            strokeWidth={2}
            opacity={0.9}
            style={{ transition: "stroke 0.6s" }}
          />
          <path d={`M0 ${H - 40} Q ${W * 0.25} ${H - 70} ${W * 0.5} ${H - 52} T ${W} ${H - 48} V ${H} H 0 Z`} fill="#060a13" />

          {/* Lander */}
          <g transform={`translate(${W / 2} ${H - 58})`}>
            <rect x={-18} y={-16} width={36} height={16} rx={3} fill="#cbd5e1" />
            <rect x={-40} y={-30} width={22} height={9} fill={lit ? colors.accentSoft : colors.accent} transform="rotate(-14 -29 -26)" />
            <rect x={18} y={-30} width={22} height={9} fill={lit ? colors.accentSoft : colors.accent} transform="rotate(14 29 -26)" />
            <path d="M-13 0 L-22 12 M13 0 L22 12" stroke="#cbd5e1" strokeWidth={3} />
          </g>

          {["N", "E", "S", "W"].map((l, i) => (
            <text key={l} x={x(i * 90) + 10} y={H - 12} fontSize={14} fill={colors.muted}>
              {l}
            </text>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-bg to-transparent" />
      </div>

      {/* Site switcher (left) and live readout (right), over the horizon on larger screens */}
      <div className="sm:absolute sm:inset-x-0 sm:bottom-6">
        <div className="mx-auto flex max-w-[1200px] flex-col-reverse gap-4 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between sm:pt-0 lg:px-8">
          <div className="flex flex-wrap gap-2 sm:max-w-md">
            {SITES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setParam("siteIdx", i)}
                aria-pressed={i === siteIdx}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs backdrop-blur transition",
                  i === siteIdx ? "border-accent-soft bg-accent/30 text-text" : "border-line bg-surface/60 text-muted hover:text-text",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="sm:w-80">
            <div className="rounded-2xl border border-line bg-surface/85 p-4 text-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] tracking-wider text-muted uppercase">Live at</div>
                  <div className="font-display font-semibold">{SITES[siteIdx].name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlaying(!playing)}
                  aria-label={playing ? "Pause the sky" : "Play the sky"}
                  className="grid size-8 place-items-center rounded-full bg-accent text-white hover:bg-accent/85"
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
              </div>
              <div className="num mt-2 text-xs text-muted">
                Day {Math.floor(hour / 24) + 1}, {String(hour % 24).padStart(2, "0")}:00
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted">Sun</dt>
                <dd className={clsx("text-right font-semibold", lit ? "text-sun" : "text-muted")}>
                  {lit ? `${margin.toFixed(1)}\u00B0 above the ridge` : "Behind the ridge"}
                </dd>
                <dt className="text-muted">Earth link</dt>
                <dd className="flex items-center justify-end gap-1.5 font-semibold">
                  <i className="size-2 rounded-full" style={{ backgroundColor: link.color }} />
                  {link.label}
                </dd>
                <dt className="text-muted">Battery</dt>
                <dd className="num text-right font-semibold">{soc.toFixed(0)} kWh</dd>
              </dl>
              <div className="mt-2 h-1.5 rounded-full bg-surface-2">
                <div
                  className={clsx("h-1.5 rounded-full transition-all", socPct < 0.25 ? "bg-fail" : socPct < 0.4 ? "bg-warn" : "bg-ok")}
                  style={{ width: `${Math.max(0, socPct) * 100}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] text-muted">Heights exaggerated. Based on NASA LOLA terrain data.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}