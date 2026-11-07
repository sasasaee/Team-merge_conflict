/**
 * 60-candidate landing-date stress test.
 * Robustness score and smallest-fix finder.
 *
 * DATA LIMITATION NOTE
 * The synthetic site data contains exactly 672 hours (28 days).
 * `simulate()` uses `wrapHour()` to index into that 28-day window, so the
 * environmental pattern repeats every 28 days.  This means evaluating 60
 * candidate landing dates is NOT the same as simulating a 60-day mission —
 * we are testing 60 *start offsets* (each running a mission of `durationDays`
 * length) against the same repeating mock data.  When R1/R2 supply real
 * multi-month ephemeris data the functions below will work without change,
 * because they only call `simulate()`.
 */
import { CALENDAR_DAYS } from "./calendar";
import { SITES } from "./sites";
import { simulate, findSmallestDelay, findBestSite } from "./simulate";
import type { Cause, MissionParams, SimResult, Verdict } from "./types";

// Stress test 

export type CandidateResult = {
  /** Landing offset from the planned date, in hours (0 = planned date). */
  delayH: number;
  result: SimResult;
};

export type StressReport = {
  /** All 60 candidate results, sorted by delayH ascending. */
  candidates: CandidateResult[];
  /** Number of candidates that passed (verdict !== "fail"). */
  passCount: number;
  /** Number of candidates that failed (verdict === "fail"). */
  failCount: number;
  /**
   * The earliest-failing candidate, or null if none failed.
   * "Earliest" means the smallest delayH that produced a fail verdict.
   */
  earliestFailure: CandidateResult | null;
  /** Cause of the earliest failure, or null if no failures. */
  earliestFailureCause: Cause;
};

/**
 * Evaluate all CALENDAR_DAYS (60) candidate landing dates.
 *
 * Each candidate is offset by `candidateIdx × 24 h` from the base params.
 * The base `p.delayH` is preserved — the candidates are ADDITIONAL offsets
 * on top of whatever delay the user has already chosen.
 *
 * All 60 simulations run synchronously.  Each `simulate()` call takes < 1 ms
 * on modern hardware (a 10-day mission = 240 iterations), so the total is
 * well under 100 ms and a Web Worker is not needed.
 */
export function stressTest(p: MissionParams): StressReport {
  const candidates: CandidateResult[] = [];

  for (let day = 0; day < CALENDAR_DAYS; day++) {
    const delayH = day * 24;
    const result = simulate(p, delayH); // extra offset; p.delayH stays intact
    candidates.push({ delayH, result });
  }

  const failures = candidates.filter((c) => c.result.verdict === "fail");
  const earliestFailure = failures.length > 0 ? failures[0] : null;

  return {
    candidates,
    passCount: candidates.length - failures.length,
    failCount: failures.length,
    earliestFailure,
    earliestFailureCause: earliestFailure?.result.cause ?? null,
  };
}

// Robustness score 

/**
 * Score how robust the current mission is against timing perturbations.
 *
 * We test a small set of representative delay offsets (1, 3, 5 days) and
 * count how many produce a non-fail verdict.  The score is normalised to
 * [0, 1] and broken down into an interpretable tier:
 *
 *   "strong"  — passes all delay probes AND current mission is ok
 *   "moderate"— current mission passes but some delay probes fail
 *   "fragile" — current mission passes but most delay probes fail
 *   "failing" — current mission itself fails
 */
export type RobustnessTier = "strong" | "moderate" | "fragile" | "failing";

export type RobustnessReport = {
  /** Fraction of delay probes that pass, 0–1. */
  score: number;
  /** Human-readable tier. */
  tier: RobustnessTier;
  /** Raw probe results (delayH → verdict). */
  probes: Array<{ delayH: number; verdict: Verdict }>;
};

const PROBE_DELAYS_H = [24, 72, 120]; // 1, 3, 5 days

export function robustnessScore(p: MissionParams, baseResult: SimResult): RobustnessReport {
  if (baseResult.verdict === "fail") {
    return {
      score: 0,
      tier: "failing",
      probes: PROBE_DELAYS_H.map((delayH) => ({ delayH, verdict: simulate(p, delayH).verdict })),
    };
  }

  const probes = PROBE_DELAYS_H.map((delayH) => ({
    delayH,
    verdict: simulate(p, delayH).verdict,
  }));

  const passCount = probes.filter((x) => x.verdict !== "fail").length;
  const score = passCount / probes.length;
  const tier: RobustnessTier = score === 1 ? "strong" : score >= 0.5 ? "moderate" : "fragile";

  return { score, tier, probes };
}

//Smallest fix 

export type FixKind = "delay" | "site" | "battery";

export type Fix = {
  kind: FixKind;
  /** Human-readable description. */
  description: string;
  /** The adjusted params that make the mission pass. */
  params: MissionParams;
  /** The simulation result after applying the fix (verified to be non-fail). */
  result: SimResult;
};

/**
 * Find the smallest practical change that turns a failing mission into a
 * passing one.  Checks in order:
 *   1. Smallest landing delay (multiples of 24 h, up to 240 h = 10 days)
 *   2. Best alternative landing site
 *   3. Smallest battery size increase (steps of 20 kWh, up to 200 kWh)
 *
 * Returns null only if none of the above fixes work, which is extremely
 * unlikely with the mock data but possible if the params are extreme.
 *
 * Uses the existing `findSmallestDelay` and `findBestSite` from simulate.ts
 * to avoid duplicating logic.
 */
export function smallestFix(p: MissionParams, baseResult: SimResult): Fix | null {
  if (baseResult.verdict !== "fail") return null; // nothing to fix

  // 1. Try a landing delay (reuses existing function)
  const delayFix = findSmallestDelay(p);
  if (delayFix) {
    const fixedParams: MissionParams = { ...p, delayH: p.delayH + delayFix.delayH };
    const verified = simulate(fixedParams);
    if (verified.verdict !== "fail") {
      return {
        kind: "delay",
        description: `Land ${delayFix.delayH / 24} day${delayFix.delayH > 24 ? "s" : ""} later`,
        params: fixedParams,
        result: verified,
      };
    }
  }

  // 2. Try an alternative site (reuses existing function)
  const siteFix = findBestSite(p);
  if (siteFix && siteFix.result.verdict !== "fail") {
    const fixedParams: MissionParams = { ...p, siteIdx: siteFix.siteIdx };
    const verified = simulate(fixedParams);
    if (verified.verdict !== "fail") {
      return {
        kind: "site",
        description: `Switch to ${SITES[siteFix.siteIdx].name}`,
        params: fixedParams,
        result: verified,
      };
    }
  }

  // 3. Try increasing battery capacity in 20 kWh steps
  for (let extra = 20; extra <= 200 - p.batteryKwh; extra += 20) {
    const fixedParams: MissionParams = { ...p, batteryKwh: p.batteryKwh + extra };
    const result = simulate(fixedParams);
    if (result.verdict !== "fail") {
      return {
        kind: "battery",
        description: `Increase battery by ${extra} kWh (to ${fixedParams.batteryKwh} kWh)`,
        params: fixedParams,
        result,
      };
    }
  }

  return null; // no simple fix found
}

