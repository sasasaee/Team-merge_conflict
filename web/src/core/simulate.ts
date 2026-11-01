// TEMPORARY simulator so the UI shows live numbers. R3 replaces the inside of these functions.
import { HOURS, SITES, getSite, wrapHour } from "./sites";
import type { Cause, MissionParams, SimResult, Verdict } from "./types";

const PANEL_AREA_M2 = 10;
const SUN_KW_PER_M2 = 1.361;
export const RESERVE_FRACTION = 0.25;

export function simulate(p: MissionParams, extraDelayH = 0, effScale = 1): SimResult {
  const s = getSite(p.siteIdx);
  const n = Math.min(p.durationDays * 24, HOURS);
  const panelKw = PANEL_AREA_M2 * p.panelEff * effScale * SUN_KW_PER_M2;
  const reserve = p.batteryKwh * RESERVE_FRACTION;

  let soc = p.batteryKwh;
  let minSoc = soc;
  let failHour: number | null = null;
  let cause: Cause = null;
  let lit = 0;
  let ok = 0;
  let run = 0;
  let longest = 0;
  let dayOk = 0;
  let worstDay = 24;
  const socArr: number[] = [];

  for (let k = 0; k < n; k++) {
    const h = wrapHour(k + p.delayH + extraDelayH);

    // Battery: charge when sunlit, always drain the lander's load
    if (s.lit[h]) lit++;
    soc = Math.max(0, Math.min(p.batteryKwh, soc + (s.lit[h] ? panelKw : 0) - p.loadKw));
    socArr.push(Math.round(soc * 10) / 10);
    minSoc = Math.min(minSoc, soc);
    if (failHour === null && soc < reserve) {
      failHour = k;
      cause = "power";
    }

    // Earth contact: count good hours per day, track the longest signal loss
    const e = s.earth[h];
    if (e === "ok") {
      ok++;
      dayOk++;
    }
    run = e === "lost" ? run + 1 : 0;
    longest = Math.max(longest, run);

    if (k % 24 === 23) {
      worstDay = Math.min(worstDay, dayOk);
      if (failHour === null && dayOk < p.commHoursReq) {
        failHour = k;
        cause = "comm";
      }
      dayOk = 0;
    }
  }

  const verdict: Verdict =
    failHour !== null ? "fail" : minSoc < reserve * 1.5 || worstDay < p.commHoursReq + 2 ? "warn" : "ok";

  return {
    soc: socArr,
    minSoc,
    reserve,
    failHour,
    cause,
    litPct: lit / n,
    earthOkPct: ok / n,
    longestBlackoutH: longest,
    verdict,
  };
}

export const SCENARIOS = [
  { id: "nominal", label: "Nominal plan", delayH: 0, eff: 1 },
  { id: "early", label: "Land 24 h earlier", delayH: -24, eff: 1 },
  { id: "delay5", label: "Delayed 5 days", delayH: 120, eff: 1 },
  { id: "panels", label: "Panels 20% weaker", delayH: 0, eff: 0.8 },
] as const;

export function findSmallestDelay(p: MissionParams): { delayH: number; result: SimResult } | null {
  for (let d = 24; d <= 240; d += 24) {
    const result = simulate(p, d);
    if (result.verdict !== "fail") return { delayH: d, result };
  }
  return null;
}

export function findBestSite(p: MissionParams): { siteIdx: number; result: SimResult } | null {
  const score = (r: SimResult) => (r.verdict === "ok" ? 2 : r.verdict === "warn" ? 1 : 0) + r.minSoc / p.batteryKwh;
  let bestIdx = -1;
  let best: SimResult | null = null;
  for (let i = 0; i < SITES.length; i++) {
    if (i === p.siteIdx) continue;
    const r = simulate({ ...p, siteIdx: i });
    if (!best || score(r) > score(best)) {
      bestIdx = i;
      best = r;
    }
  }
  return best ? { siteIdx: bestIdx, result: best } : null;
}