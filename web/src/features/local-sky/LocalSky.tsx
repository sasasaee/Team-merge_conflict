import { siteFor, useMission, wrapHour } from "@/core";
import { colors } from "@/ui";

// Round sky map of the low sky: centre = 14 degrees up, edge = 8 degrees below the horizon level.
// Real horizons run from about -8 to +12 degrees, so heights outside this range are clamped to the centre or the rim.
const SIZE = 300;
const C = SIZE / 2;
const R = 130;
const EL_MAX = 14;
const EL_MIN = -8;
const RAD = Math.PI / 180;
const COMPASS: [string, number][] = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];

const radius = (el: number) => (R * (EL_MAX - Math.max(EL_MIN, Math.min(EL_MAX, el)))) / (EL_MAX - EL_MIN);
const point = (az: number, el: number): [number, number] => {
  const r = radius(el);
  return [C + r * Math.sin(az * RAD), C - r * Math.cos(az * RAD)];
};

export function LocalSky() {
  const params = useMission((s) => s.params);
  const delayH = params.delayH;
  const timeH = useMission((s) => s.timeH);
  const s = siteFor(params);
  const h = wrapHour(timeH + delayH);

  const outer = `M ${C - R} ${C} A ${R} ${R} 0 1 0 ${C + R} ${C} A ${R} ${R} 0 1 0 ${C - R} ${C} Z`;
  const terrain = "M " + s.horizon.map((el, az) => point(az, el).join(" ")).join(" L ") + " Z";
  const trail = Array.from({ length: 48 }, (_, k) => wrapHour(h - 47 + k));
  const [sx, sy] = point(s.sunAz[h], s.sunEl[h]);
  const [ex, ey] = point(s.earthAz[h], s.earthEl[h]);

  return (
    <div className="flex h-full flex-col items-center gap-3">
      <svg data-theme="dark" viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[320px]" role="img" aria-label="Local sky map">
        <defs>
          <radialGradient id="sky">
            <stop offset="0%" stopColor="#14203a" />
            <stop offset="100%" stopColor={colors.bg} />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R} fill="url(#sky)" stroke={colors.line} />
        {[0, 4, 8, 12].map((el) => (
          <g key={el}>
            <circle cx={C} cy={C} r={radius(el)} fill="none" stroke={colors.line} strokeDasharray="2 4" />
            <text x={C + 3} y={C - radius(el) - 3} fontSize={9} fill={colors.muted}>{el}{"\u00B0"}</text>
          </g>
        ))}
        <path d={`${outer} ${terrain}`} fillRule="evenodd" fill={colors.moon} fillOpacity={0.3} stroke={colors.moon} strokeOpacity={0.7} />
        {trail.map((i, k) => {
          const [x, y] = point(s.sunAz[i], s.sunEl[i]);
          return <circle key={`s${k}`} cx={x} cy={y} r={1.3} fill={colors.sun} opacity={k / 48} />;
        })}
        {trail.map((i, k) => {
          const [x, y] = point(s.earthAz[i], s.earthEl[i]);
          return <circle key={`e${k}`} cx={x} cy={y} r={1.1} fill={colors.earth} opacity={k / 48} />;
        })}
        <circle cx={sx} cy={sy} r={16} fill={colors.sun} opacity={0.15} />
        <circle cx={sx} cy={sy} r={8} fill={colors.sun} />
        <circle cx={ex} cy={ey} r={6.5} fill={colors.earth} stroke="#fff" strokeOpacity={0.7} />
        {COMPASS.map(([label, az]) => (
          <text
            key={label}
            x={C + (R + 11) * Math.sin(az * RAD)}
            y={C - (R + 11) * Math.cos(az * RAD) + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={colors.muted}
          >
            {label}
          </text>
        ))}
      </svg>

      <div className="flex flex-wrap justify-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-sun" /> Sun {s.sunEl[h].toFixed(1)}{"\u00B0"}</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-earth" /> Earth {s.earthEl[h].toFixed(1)}{"\u00B0"}</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-moon/50" /> Mountains</span>
      </div>
    </div>
  );
}