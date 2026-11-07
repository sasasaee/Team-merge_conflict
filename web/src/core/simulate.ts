// R3 – Mission Simulator Logic. UI reads from these pure functions; no React imports here.
import { HOURS, SITES, getSite, getSiteAt, wrapHour } from "./sites";
import type { Cause, MissionParams, SimResult, Verdict } from "./types";

const PANEL_AREA_M2 = 10;        // m²  — fixed hardware constant
const SUN_KW_PER_M2 = 1.361;     // kW/m² solar constant at the Moon
export const RESERVE_FRACTION = 0.25; // below 25 % of capacity = power failure

// `offset` moves the lander to a nearby grid point (km east / km north). Real data only; without it the site itself is used.
export function simulate(p: MissionParams, extraDelayH = 0, effScale = 1, offset?: { dxKm: number; dyKm: number }): SimResult {
  const s = offset ? getSiteAt(p.siteIdx, offset.dxKm, offset.dyKm) : getSite(p.siteIdx);
  const n = Math.min(p.durationDays * 24, HOURS);

  // Gross solar power (kW) the panels can deliver when fully illuminated
  const panelKw = PANEL_AREA_M2 * p.panelEff * effScale * SUN_KW_PER_M2;
  // Battery reserve floor — lander must stay above this level
  const reserve = p.batteryKwh * RESERVE_FRACTION;

  // ── State ────────────────────────────────────────────────────────────────
  let soc = p.batteryKwh;       // start fully charged (kWh)
  let minSoc = soc;
  let failHour: number | null = null;
  let cause: Cause = null;

  // Sunlight counters
  let litH = 0;                 // total illuminated hours

  // Earth-link counters
  let earthOkH = 0;             // total "ok"-link hours
  let blackoutRun = 0;          // current consecutive "lost" streak
  let longestBlackout = 0;      // longest "lost" streak so far

  // Per-day comm tracking
  let dayOkH = 0;               // "ok"-link hours in the current calendar day
  let worstDayOkH = 24;         // minimum daily ok-hours seen (worst day)
  let commViolationDays = 0;    // days where daily ok-hours < commHoursReq

  const socArr: number[] = [];

  for (let k = 0; k < n; k++) {
    const h = wrapHour(k + p.delayH + extraDelayH);

    // ── Battery charging and consumption ──────────────────────────────────
    const charge = s.lit[h] ? panelKw : 0;   // zero charge during shadow
    const net = charge - p.loadKw;            // net energy this hour (kWh)
    soc = Math.min(p.batteryKwh, soc + net);  // cap at full capacity
    soc = Math.max(0, soc);                   // floor at zero (discharged)
    socArr.push(Math.round(soc * 10) / 10);
    if (s.lit[h]) litH++;
    minSoc = Math.min(minSoc, soc);

    // Power failure: first hour SoC drops below the safe reserve
    if (failHour === null && soc < reserve) {
      failHour = k;
      cause = "power";
    }

    // ── Earth-link / communication ────────────────────────────────────────
    const e = s.earth[h];
    if (e === "ok") {
      earthOkH++;
      dayOkH++;
    }
    // Blackout = consecutive full signal-loss hours; "weak" resets the streak
    blackoutRun = e === "lost" ? blackoutRun + 1 : 0;
    longestBlackout = Math.max(longestBlackout, blackoutRun);

    // ── End-of-day rule check (every 24 h) ───────────────────────────────
    if (k % 24 === 23) {
      worstDayOkH = Math.min(worstDayOkH, dayOkH);

      if (dayOkH < p.commHoursReq) {
        commViolationDays++;
        // Record the first comm-rule violation as the mission fail event
        if (failHour === null) {
          failHour = k;
          cause = "comm";
        }
      }
      dayOkH = 0; // reset for next day
    }
  }

  // ── Verdict ───────────────────────────────────────────────────────────
  // "warn" if battery came within 1.5× reserve OR any day had a comm shortfall
  const powerAtRisk = minSoc < reserve * 1.5;
  const commAtRisk  = worstDayOkH < p.commHoursReq + 2 || commViolationDays > 0;
  const verdict: Verdict =
    failHour !== null ? "fail" : powerAtRisk || commAtRisk ? "warn" : "ok";

  return {
    soc: socArr,
    minSoc,
    reserve,
    failHour,
    cause,
    litPct: litH / n,
    earthOkPct: earthOkH / n,
    longestBlackoutH: longestBlackout,
    verdict,
  };
}

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
