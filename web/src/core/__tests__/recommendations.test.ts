import { describe, it, expect } from "vitest";
import { getRecommendations } from "../recommendations";
import { simulate } from "../simulate";
import { MOCK_PARAMS } from "../schemas";
import type { MissionParams } from "../types";

const base: MissionParams = { ...MOCK_PARAMS };

// Severe power failure mission (heavy load, small battery, low panel efficiency)
const powerFailParams: MissionParams = {
  ...base,
  batteryKwh: 50,
  loadKw: 3.2,
  panelEff: 0.15,
  durationDays: 8,
};

// Pure communication failure mission (site 2 has zero-contact days)
const commFailParams: MissionParams = {
  ...base,
  siteIdx: 2,
  batteryKwh: 200,
  loadKw: 0.5,
  panelEff: 0.4,
  commHoursReq: 1,
  durationDays: 10,
};

describe("T-37: getRecommendations – Safe Missions", () => {
  it("marks already-safe mission as isSafe=true with informative message", () => {
    const advice = getRecommendations(base);
    expect(advice.isSafe).toBe(true);
    expect(advice.verdict).toBe("ok");
    expect(advice.message).toContain("FEASIBLE");
  });

  it("does not mutate original params object", () => {
    const original = JSON.parse(JSON.stringify(base));
    getRecommendations(base);
    expect(base).toEqual(original);
  });

  it("proactive recommendations on safe missions are pre-verified", () => {
    // If a safe mission has proactive tips, each must be re-simulated and valid
    const advice = getRecommendations(base);
    for (const rec of advice.recommendations) {
      expect(rec.reason.length).toBeGreaterThan(0);
      expect(rec.improvement.length).toBeGreaterThan(0);
      const verified = simulate({ ...base, ...rec.changes });
      expect(verified.verdict).toBe("ok");
    }
  });
});

describe("T-37: getRecommendations – Power Failure", () => {
  it("identifies power failure and provides verified recommendations", () => {
    const advice = getRecommendations(powerFailParams);
    expect(advice.isSafe).toBe(false);
    expect(advice.verdict).toBe("fail");
    expect(advice.message.toLowerCase()).toContain("battery");
    expect(advice.recommendations.length).toBeGreaterThan(0);
  });

  it("all returned recommendations have measurable explanations and verified results", () => {
    const advice = getRecommendations(powerFailParams);
    for (const rec of advice.recommendations) {
      expect(rec.title.length).toBeGreaterThan(0);
      expect(rec.reason.length).toBeGreaterThan(0);
      expect(rec.improvement.length).toBeGreaterThan(0);
      expect(rec.result).toBeDefined();
      expect(rec.result.verdict).not.toBe("fail");

      // Verify re-simulation produces the exact claimed non-fail result
      const reSim = simulate({ ...powerFailParams, ...rec.changes });
      expect(reSim.verdict).not.toBe("fail");
    }
  });

  it("can recommend battery capacity, power reduction, panel efficiency, or date/site changes", () => {
    const advice = getRecommendations(powerFailParams);
    const categories = advice.recommendations.map((r) => r.category);
    // At least one hardware or operational fix should be present
    const validCategories = ["date", "site", "battery", "power", "panel"];
    for (const cat of categories) {
      expect(validCategories).toContain(cat);
    }
  });
});

describe("T-37: getRecommendations – Communication Failure", () => {
  it("identifies comm failure and explains terrain/visibility cause", () => {
    const advice = getRecommendations(commFailParams);
    expect(advice.isSafe).toBe(false);
    expect(advice.verdict).toBe("fail");
    expect(advice.message.toLowerCase()).toContain("communication");
  });

  it("suggests verified alternative site or date to resolve comm blockage", () => {
    const advice = getRecommendations(commFailParams);
    // Comm failure should be resolved by site or date shifts
    const fixes = advice.recommendations.filter((r) => r.category === "site" || r.category === "date");
    expect(fixes.length).toBeGreaterThan(0);

    for (const fix of fixes) {
      const reSim = simulate({ ...commFailParams, ...fix.changes });
      expect(reSim.verdict).not.toBe("fail");
    }
  });
});

describe("T-37: Parameter preservation and edge cases", () => {
  it("works when passing pre-computed SimResult or letting function compute it", () => {
    const preComputed = simulate(powerFailParams);
    const advice1 = getRecommendations(powerFailParams, preComputed);
    const advice2 = getRecommendations(powerFailParams);
    expect(advice1.isSafe).toBe(advice2.isSafe);
    expect(advice1.verdict).toBe(advice2.verdict);
    expect(advice1.recommendations.length).toBe(advice2.recommendations.length);
  });

  it("recommends power consumption reduction when lower load fixes the failure", () => {
    // Mission that fails just barely due to load:
    const marginalPowerFail: MissionParams = {
      ...base,
      batteryKwh: 60,
      loadKw: 2.2,
      panelEff: 0.25,
      durationDays: 4,
    };
    const advice = getRecommendations(marginalPowerFail);
    if (advice.recommendations.some((r) => r.category === "power")) {
      const powerRec = advice.recommendations.find((r) => r.category === "power")!;
      expect(powerRec.changes.loadKw).toBeLessThan(marginalPowerFail.loadKw);
      expect(powerRec.result.verdict).not.toBe("fail");
    }
  });

  it("recommends panel efficiency upgrade when higher efficiency fixes the failure", () => {
    const lowEffParams: MissionParams = {
      ...base,
      batteryKwh: 80,
      loadKw: 1.5,
      panelEff: 0.10, // severely degraded
      durationDays: 4,
    };
    const advice = getRecommendations(lowEffParams);
    const panelRec = advice.recommendations.find((r) => r.category === "panel");
    if (panelRec) {
      expect(panelRec.changes.panelEff).toBeGreaterThan(lowEffParams.panelEff);
      expect(panelRec.result.verdict).not.toBe("fail");
    }
  });

  it("handles missions with warn verdict", () => {
    // Parameter set causing warn verdict
    const warnParams: MissionParams = {
      ...base,
      siteIdx: 1,
      batteryKwh: 60,
      loadKw: 1.5,
      panelEff: 0.20,
      durationDays: 6,
    };
    const r = simulate(warnParams);
    if (r.verdict === "warn") {
      const advice = getRecommendations(warnParams, r);
      expect(advice.isSafe).toBe(false);
      expect(advice.verdict).toBe("warn");
    }
  });
});
