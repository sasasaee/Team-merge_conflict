//Rule-based Mission Recommendations.
// Generates verified, actionable recommendations based on actual simulation results.
import { SITES } from "./sites";
import { simulate, findSmallestDelay, findBestSite } from "./simulate";
import { VERDICT_LABEL } from "./types";
import type { MissionParams, SimResult, Verdict } from "./types";

export type RecommendationCategory = "date" | "site" | "battery" | "power" | "panel";

export type Recommendation = {
  id: string;
  category: RecommendationCategory;
  title: string;
  reason: string;
  improvement: string;
  changes: Partial<MissionParams>;
  result: SimResult;
};

export type MissionAdvice = {
  isSafe: boolean;
  verdict: Verdict;
  message: string;
  recommendations: Recommendation[];
};

/**
 * Generates verified recommendations for a mission plan.
 * Every recommendation is re-simulated to confirm it measurably improves the outcome.
 * Neither the input params nor baseResult are modified.
 */
export function getRecommendations(params: MissionParams, baseResult?: SimResult): MissionAdvice {
  const current = baseResult ?? simulate(params);
  const recommendations: Recommendation[] = [];

  //Safe missions (verdict === "ok")
  if (current.verdict === "ok") {
    // Proactive check: if battery reserve is close to margin or blackout is long,
    // we can suggest high-margin optimizations.
    const isCloseToReserve = current.minSoc < current.reserve * 1.5;

    if (isCloseToReserve && params.batteryKwh < 200) {
      const upgradeKwh = Math.min(200, params.batteryKwh + 20);
      const testParams: MissionParams = { ...params, batteryKwh: upgradeKwh };
      const testRes = simulate(testParams);
      if (testRes.minSoc > current.minSoc) {
        recommendations.push({
          id: "proactive-battery",
          category: "battery",
          title: "Increase battery capacity for extra margin",
          reason: `Lowest battery charge reaches ${current.minSoc.toFixed(1)} kWh (close to safe reserve of ${current.reserve.toFixed(1)} kWh). Extra capacity adds resilience against longer eclipses.`,
          improvement: `Increases minimum SoC from ${current.minSoc.toFixed(1)} kWh to ${testRes.minSoc.toFixed(1)} kWh (+${(testRes.minSoc - current.minSoc).toFixed(1)} kWh buffer).`,
          changes: { batteryKwh: upgradeKwh },
          result: testRes,
        });
      }
    }

    return {
      isSafe: true,
      verdict: "ok",
      message: `Plan is FEASIBLE. Battery never drops below ${current.minSoc.toFixed(1)} kWh (reserve floor: ${current.reserve.toFixed(1)} kWh) and Earth communication link is active ${Math.round(current.earthOkPct * 100)}% of the mission.`,
      recommendations,
    };
  }

  //  Failing or Warn missions 
  const day = Math.floor((current.failHour ?? 0) / 24) + 1;
  const failureReason =
    current.cause === "power"
      ? `Battery depleted below safe reserve (${current.reserve.toFixed(0)} kWh) on day ${day}. Lunar surface shadow prevents solar array recharging.`
      : current.cause === "comm"
        ? `Daily Earth communication fell below required ${params.commHoursReq} h/day on day ${day}. Terrain obstruction blocked line of sight.`
        : `Mission is at risk: minimum SoC (${current.minSoc.toFixed(1)} kWh) is close to reserve, or communication margin is narrow.`;

  // 1. Landing date adjustment (timing fix)
  const delayFix = findSmallestDelay(params);
  if (delayFix && delayFix.result.verdict !== "fail") {
    const newDelay = params.delayH + delayFix.delayH;
    const testParams: MissionParams = { ...params, delayH: newDelay };
    const testRes = simulate(testParams);
    if (testRes.verdict !== "fail") {
      recommendations.push({
        id: "fix-delay",
        category: "date",
        title: "Choose a safer landing date",
        reason: `Shifting touchdown by ${delayFix.delayH / 24} day(s) aligns the mission with an extended solar illumination window and avoids critical shadow periods.`,
        improvement: `Elevates verdict to ${VERDICT_LABEL[testRes.verdict]} and raises lowest battery SoC to ${testRes.minSoc.toFixed(1)} kWh.`,
        changes: { delayH: newDelay },
        result: testRes,
      });
    }
  }

  // 2. Alternative landing site (location fix)
  const siteFix = findBestSite(params);
  if (siteFix && siteFix.result.verdict !== "fail") {
    const testParams: MissionParams = { ...params, siteIdx: siteFix.siteIdx };
    const testRes = simulate(testParams);
    if (testRes.verdict !== "fail") {
      const siteName = SITES[siteFix.siteIdx].name;
      recommendations.push({
        id: "fix-site",
        category: "site",
        title: "Choose a better landing site",
        reason: `${siteName} offers higher terrain clearance, reducing shadow depth and improving direct line-of-sight to Earth.`,
        improvement: `Verdict improves to ${VERDICT_LABEL[testRes.verdict]} with ${Math.round(testRes.earthOkPct * 100)}% Earth contact and ${testRes.minSoc.toFixed(1)} kWh minimum SoC.`,
        changes: { siteIdx: siteFix.siteIdx },
        result: testRes,
      });
    }
  }

  // 3. Battery capacity increase (energy storage fix)
  if (params.batteryKwh < 200) {
    for (let extra = 20; extra <= 200 - params.batteryKwh; extra += 20) {
      const testKwh = params.batteryKwh + extra;
      const testParams: MissionParams = { ...params, batteryKwh: testKwh };
      const testRes = simulate(testParams);
      if (testRes.verdict !== "fail" || testRes.minSoc > current.minSoc + 10) {
        if (testRes.verdict !== "fail") {
          recommendations.push({
            id: "fix-battery",
            category: "battery",
            title: "Increase battery capacity",
            reason: `A larger battery bank stores sufficient energy to bridge the shadow duration without penetrating the 25% safety reserve threshold.`,
            improvement: `Increasing capacity to ${testKwh} kWh (+${extra} kWh) brings minimum SoC to ${testRes.minSoc.toFixed(1)} kWh (${VERDICT_LABEL[testRes.verdict]}).`,
            changes: { batteryKwh: testKwh },
            result: testRes,
          });
          break; // only smallest effective battery increase
        }
      }
    }
  }

  // 4. Power consumption reduction (load shedding fix)
  if (params.loadKw > 0.5) {
    for (let testLoad = Math.round((params.loadKw - 0.3) * 10) / 10; testLoad >= 0.5; testLoad = Math.round((testLoad - 0.3) * 10) / 10) {
      const testParams: MissionParams = { ...params, loadKw: testLoad };
      const testRes = simulate(testParams);
      if (testRes.verdict !== "fail") {
        recommendations.push({
          id: "fix-power",
          category: "power",
          title: "Reduce power consumption",
          reason: `Lowering non-essential payload and thermal heater load slows battery drain during sunless periods.`,
          improvement: `Reducing power draw from ${params.loadKw.toFixed(1)} kW to ${testLoad.toFixed(1)} kW prevents failure and keeps SoC above ${testRes.minSoc.toFixed(1)} kWh.`,
          changes: { loadKw: testLoad },
          result: testRes,
        });
        break; // least restrictive reduction
      }
    }
  }

  // 5. Improve solar panel efficiency (generation fix)
  if (params.panelEff < 0.45) {
    for (let testEff = Math.round((params.panelEff + 0.05) * 100) / 100; testEff <= 0.45; testEff = Math.round((testEff + 0.05) * 100) / 100) {
      const testParams: MissionParams = { ...params, panelEff: testEff };
      const testRes = simulate(testParams);
      if (testRes.verdict !== "fail") {
        recommendations.push({
          id: "fix-panel",
          category: "panel",
          title: "Improve solar panel efficiency",
          reason: `Upgrading to higher efficiency solar cells produces higher wattage during lit periods, accelerating battery replenishment.`,
          improvement: `Raising cell efficiency from ${Math.round(params.panelEff * 100)}% to ${Math.round(testEff * 100)}% keeps the mission viable (${VERDICT_LABEL[testRes.verdict]}).`,
          changes: { panelEff: testEff },
          result: testRes,
        });
        break;
      }
    }
  }

  return {
    isSafe: false,
    verdict: current.verdict,
    message: failureReason,
    recommendations,
  };
}

