import { getSite, wrapHour } from "@/core";
import { colors } from "@/ui";

// 360-degree view from the lander: x = compass direction, y = height above the horizon.
const W = 1000;
const H = 180;
const EL_MIN = -2;
const EL_MAX = 13;
const x = (az: number) => (az / 360) * W;
const y = (el: number) => H - ((Math.max(EL_MIN, Math.min(EL_MAX, el)) - EL_MIN) / (EL_MAX - EL_MIN)) * H;

type Props = { siteIdx: number; hour: number; horizonDrop?: number };

export function Panorama({ siteIdx, hour, horizonDrop = 0 }: Props) {
  const s = getSite(siteIdx);
  const h = wrapHour(hour);
  const ground = "M0 " + H + " " + s.horizon.map((el, az) => `L${x(az)} ${y(el - horizonDrop)}`).join(" ") + ` L${W} ${y(s.horizon[0] - horizonDrop)} L${W} ${H} Z`;
  const trail = Array.from({ length: 36 }, (_, k) => wrapHour(h - 35 + k));
  const sunHidden = s.sunEl[h] <= s.horizon[Math.round(s.sunAz[h]) % 360] - horizonDrop;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full rounded-xl" preserveAspectRatio="none" role="img" aria-label="360 degree view from the lander">
        <defs>
          <linearGradient id="pano-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070b14" />
            <stop offset="1" stopColor="#1c2a52" />
          </linearGradient>
          <radialGradient id="pano-sun">
            <stop offset="0" stopColor={colors.sun} stopOpacity="0.5" />
            <stop offset="1" stopColor={colors.sun} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#pano-sky)" />
        <ellipse cx={x(s.sunAz[h])} cy={y(s.sunEl[h])} rx={120} ry={50} fill="url(#pano-sun)" opacity={sunHidden ? 0.35 : 1} />
        {trail.map((i, k) => (
          <circle key={k} cx={x(s.sunAz[i])} cy={y(s.sunEl[i])} r={1.6} fill={colors.sun} opacity={k / 50} />
        ))}
        <circle cx={x(s.sunAz[h])} cy={y(s.sunEl[h])} r={9} fill="#fff4d6" />
        <circle cx={x(s.earthAz[h])} cy={y(s.earthEl[h])} r={7} fill={colors.earth} />
        <path d={ground} fill="#0c1222" stroke={sunHidden ? colors.line : colors.sun} strokeOpacity={0.8} strokeWidth={1.5} />
        {[["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, az]) => (
          <text key={l} x={x(Number(az)) + 6} y={H - 8} fontSize={12} fill={colors.muted}>
            {l}
          </text>
        ))}
      </svg>
      <p className="text-xs text-muted">
        {sunHidden ? "The Sun is hidden behind the ridge. The lander is in shadow." : "The Sun is above the ridge. The panels are charging."} Earth is{" "}
        {s.earth[h] === "lost" ? "behind the terrain." : s.earth[h] === "weak" ? "low on the horizon." : "in clear view."}
      </p>
    </div>
  );
}