import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Pause, Play } from "lucide-react";
import { HOURS, SITES, getSite, simulate, useMission } from "@/core";
import { colors } from "@/ui";

// Live hero: one lunar month at the selected site, seen as a 360-degree horizon.
// x = compass direction (N on the left edge, all the way round), y = height above the horizon.
const W = 1600;
const H = 420;
const TOP = 40; // highest point the Sun or Earth reaches is drawn here
const BOTTOM = 300; // lowest point of the ridge is drawn here (above the dark foreground)
const MAX_PX_PER_DEG = 60;
const TICK_MS = 90; // one mission hour per tick, so a lunar month loops in about a minute

const x = (az: number) => (az / 360) * W;

// Vertical scale per site: fit this site's ridge, Sun and Earth into the picture (heights exaggerated).
function fitScale(horizon: number[], sunEl: number[], earthEl: number[], hours: number) {
  let lo = Math.min(...horizon);
  let hi = Math.max(...horizon);
  for (let h = 0; h < hours; h++) hi = Math.max(hi, sunEl[h], earthEl[h]);
  lo -= 0.5;
  hi += 0.8;
  const px = Math.min(MAX_PX_PER_DEG, (BOTTOM - TOP) / (hi - lo));
  return (el: number) => BOTTOM - (el - lo) * px;
}

// Fixed star field (same every render)
const STARS = Array.from({ length: 70 }, (_, i) => ({
  cx: (i * 233) % W,
  cy: (i * 97) % 220,
  r: i % 7 === 0 ? 1.6 : 0.9,
  o: 0.25 + ((i * 37) % 60) / 100,
}));

// Fixed grain dots for the rock texture (one 96 x 96 tile, repeated)
const GRAIN = Array.from({ length: 70 }, (_, i) => ({
  cx: (i * 37) % 96,
  cy: (i * 61) % 96,
  r: i % 5 === 0 ? 0.9 : 0.5,
  light: i % 3 === 0,
}));

// Ridge path from a horizon array; `shift` rotates it (degrees) and `lift` raises it (px), for the hazy far layers
function ridgePath(horizon: number[], y: (el: number) => number, shift = 0, lift = 0) {
  const pts = Array.from({ length: 361 }, (_, az) => `${az === 0 ? "M" : "L"}${x(az)} ${y(horizon[(az + shift + 360) % 360]) - lift}`);
  return pts.join(" ");
}

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
  const loopH = Math.min(HOURS, 24 * 28); // the hero shows one lunar month, even though the real files hold a year
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  const site = getSite(siteIdx);
  const y = useMemo(() => fitScale(site.horizon, site.sunEl, site.earthEl, loopH), [site, loopH]);
  const ridge = useMemo(() => ridgePath(site.horizon, y), [site, y]);
  // Two hazy copies of the same real ridge, rotated and raised, read as distant ranges (drawn faint, behind the Sun)
  const farRidges = useMemo(() => [ridgePath(site.horizon, y, 47, 34), ridgePath(site.horizon, y, -23, 16)], [site, y]);
  const month = useMemo(() => simulate({ ...params, delayH: 0, durationDays: 28 }), [params]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setHour((h) => (h + 1) % loopH), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, loopH]);

  const lit = site.lit[hour];
  const link = LINK[site.earth[hour]];
  const sunX = x(site.sunAz[hour]);
  const sunY = y(site.sunEl[hour]);
  const margin = site.sunEl[hour] - site.horizon[Math.round(site.sunAz[hour]) % 360];
  const soc = month.soc[hour] ?? 0;
  const socPct = soc / params.batteryKwh;
  const ridgeAtSun = y(site.horizon[Math.round(site.sunAz[hour]) % 360]);
  const away = sunX > W / 2 ? -1 : 1; // shadows fall away from the Sun
  const trail = Array.from({ length: 48 }, (_, k) => (hour - 47 + k + loopH) % loopH);

  return (
    <div data-theme="dark" className="relative bg-bg text-text">
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
              <stop offset="0" stopColor={lit ? "#1b2440" : "#0c1220"} style={{ transition: "stop-color 0.8s" }} />
              <stop offset="1" stopColor="#05080f" />
            </linearGradient>
            <linearGradient id="hero-haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a4a78" />
              <stop offset="1" stopColor="#141c33" stopOpacity="0" />
            </linearGradient>
            {/* Warm light on the slopes that face the Sun */}
            <radialGradient id="hero-slope" gradientUnits="userSpaceOnUse" cx={sunX} cy={ridgeAtSun} r={520}>
              <stop offset="0" stopColor={colors.sun} stopOpacity={lit ? 0.32 : 0} />
              <stop offset="0.5" stopColor={colors.sun} stopOpacity={lit ? 0.08 : 0} />
              <stop offset="1" stopColor={colors.sun} stopOpacity="0" />
            </radialGradient>
            {/* Long shadow: the ground darkens away from the Sun */}
            <linearGradient id="hero-shadow" gradientUnits="userSpaceOnUse" x1={sunX} y1={0} x2={sunX + away * W * 0.7} y2={0}>
              <stop offset="0" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity={lit ? 0.55 : 0.35} />
            </linearGradient>
            <linearGradient id="hero-lander-shadow" x1={away > 0 ? 0 : 1} y1="0" x2={away > 0 ? 1 : 0} y2="0">
              <stop offset="0" stopColor="#000" stopOpacity="0.6" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </linearGradient>
            <pattern id="hero-grain" width={96} height={96} patternUnits="userSpaceOnUse">
              {GRAIN.map((g, i) => (
                <circle key={i} cx={g.cx} cy={g.cy} r={g.r} fill={g.light ? "#9aa6c4" : "#000"} opacity={g.light ? 0.18 : 0.35} />
              ))}
            </pattern>
            <clipPath id="hero-ground-clip">
              <path d={`${ridge} L${W} ${H} L0 ${H} Z`} />
            </clipPath>
            <filter id="hero-rim" x="-5%" y="-50%" width="110%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <rect width={W} height={H} fill="url(#hero-sky)" />
          {STARS.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.o} />
          ))}
          <rect width={W} height={H} fill="url(#hero-sun)" />

          {/* Depth: two faint, hazy copies of the real ridge read as distant ranges */}
          {farRidges.map((d, i) => (
            <path key={i} d={`${d} L${W} ${H} L0 ${H} Z`} fill="url(#hero-haze)" opacity={i === 0 ? 0.35 : 0.55} />
          ))}

          {/* Sun path over the last two days, the Sun and Earth (behind the real ridge, in front of the haze) */}
          {trail.map((h, k) => (
            <circle key={k} cx={x(site.sunAz[h])} cy={y(site.sunEl[h])} r={2} fill={colors.sun} opacity={(k / 48) * 0.5} />
          ))}
          <circle cx={sunX} cy={sunY} r={11} fill="#fff4d6" />
          <circle cx={x(site.earthAz[hour])} cy={y(site.earthEl[hour])} r={16} fill={colors.earth} opacity={0.25} />
          <circle cx={x(site.earthAz[hour])} cy={y(site.earthEl[hour])} r={9} fill={colors.earth} />

          {/* The real ridge (NASA LOLA horizon): rock fill, grain, sunlit slopes and long shadow */}
          <path d={`${ridge} L${W} ${H} L0 ${H} Z`} fill="url(#hero-ground)" />
          <g clipPath="url(#hero-ground-clip)">
            <rect width={W} height={H} fill="url(#hero-grain)" />
            <rect width={W} height={H} fill="url(#hero-slope)" />
            <rect width={W} height={H} fill="url(#hero-shadow)" />
          </g>

          {/* Rim light: a bright edge with a soft glow when sunlit, almost black when dark */}
          {lit && <path d={ridge} fill="none" stroke={colors.sun} strokeWidth={5} opacity={0.45} filter="url(#hero-rim)" />}
          <path d={ridge} fill="none" stroke={lit ? "#ffd58a" : "#0a0f1c"} strokeWidth={lit ? 1.6 : 1.5} style={{ transition: "stroke 0.6s" }} />

          {/* Foreground ground and the lander's long shadow, pointing away from the Sun */}
          <path d={`M0 ${H - 40} Q ${W * 0.25} ${H - 70} ${W * 0.5} ${H - 52} T ${W} ${H - 48} V ${H} H 0 Z`} fill="#060a13" />
          {lit && (
            <polygon
              points={`${W / 2},${H - 48} ${W / 2},${H - 36} ${W / 2 + away * 460},${H - 30} ${W / 2 + away * 440},${H - 46}`}
              fill="url(#hero-lander-shadow)"
            />
          )}

          {/* Lander: NASA Altair (web/public/Altair.svg), sitting on the foreground; glows when the Sun reaches it */}
          <image
            href={`${import.meta.env.BASE_URL}Altair.svg`}
            x={W / 2 - 60}
            y={H - 150}
            width={120}
            height={110}
            preserveAspectRatio="xMidYMax meet"
            style={{ filter: lit ? "drop-shadow(0 0 10px rgba(245,165,36,0.55))" : "none", transition: "filter 0.6s" }}
          />

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