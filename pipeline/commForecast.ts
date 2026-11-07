// T-28: TypeScript port of illumination.comm_forecast() for Saeera (core/). Same rule as the Python side.
// Earth state per hour: "ok" (> 2.5 deg above the ridge), "weak" (0..2.5 deg), "lost" (<= 0 deg).
export type EarthLink = "ok" | "weak" | "lost";
export type CommBand = { start: number; end: number; type: "weak" | "lost" }; // hours, end exclusive

export function commForecast(earth: EarthLink[]): CommBand[] {
  const out: CommBand[] = [];
  let start = 0;
  for (let i = 1; i <= earth.length; i++) {
    if (i === earth.length || earth[i] !== earth[start]) {
      if (earth[start] !== "ok") out.push({ start, end: i, type: earth[start] as "weak" | "lost" });
      start = i;
    }
  }
  return out;
}
