// Mission alert feed: turns the hourly simulation into readable events.
import { HOURS, siteFor, wrapHour } from "./sites";
import { simulate } from "./simulate";
import type { MissionParams } from "./types";

export type MissionEvent = { hour: number; tone: "ok" | "warn" | "fail" | "muted"; text: string };

export function missionEvents(p: MissionParams): MissionEvent[] {
  const s = siteFor(p);
  const r = simulate(p);
  const n = Math.min(p.durationDays * 24, HOURS);
  const out: MissionEvent[] = [{ hour: 0, tone: "muted", text: "Touchdown. Lander systems online." }];
  let belowReserve = false;
  let empty = false;

  for (let k = 1; k < n; k++) {
    const h = wrapHour(k + p.delayH);
    const prev = wrapHour(k - 1 + p.delayH);

    if (s.lit[h] !== s.lit[prev]) {
      out.push(
        s.lit[h]
          ? { hour: k, tone: "ok", text: "Sun clears the ridge. Panels charging." }
          : { hour: k, tone: "warn", text: "Sun drops behind the ridge. Running on battery." },
      );
    }
    if (s.earth[h] !== s.earth[prev]) {
      const text = { ok: "Earth link is strong again.", weak: "Earth is low on the horizon. Link is weak.", lost: "Earth set behind the terrain. Signal lost." }[s.earth[h]];
      out.push({ hour: k, tone: s.earth[h] === "ok" ? "ok" : s.earth[h] === "weak" ? "warn" : "fail", text });
    }
    if (!belowReserve && r.soc[k] < r.reserve) {
      belowReserve = true;
      out.push({ hour: k, tone: "fail", text: `Battery below safe reserve (${r.soc[k].toFixed(0)} kWh).` });
    }
    if (!empty && r.soc[k] <= 0) {
      empty = true;
      out.push({ hour: k, tone: "fail", text: "Battery empty. Lander shuts down." });
    }
  }

  // Warn two hours before each signal loss
  for (const e of out.filter((x) => x.text.startsWith("Earth set"))) {
    if (e.hour >= 2) out.push({ hour: e.hour - 2, tone: "warn", text: "Earth sets behind the ridge in 2 h." });
  }

  out.push({ hour: n - 1, tone: r.verdict === "fail" ? "fail" : "ok", text: r.verdict === "fail" ? "Mission did not complete." : "Mission complete." });
  return out.sort((a, b) => a.hour - b.hour);
}