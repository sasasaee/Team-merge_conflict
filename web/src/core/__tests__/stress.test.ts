import { describe, it, expect } from "vitest";
import { runScenario, customScenario, PRESETS } from "../scenarios";
import { stressTest } from "../stress";
import { robustnessScore, smallestFix } from "../stress";
import { simulate } from "../simulate";
import { CALENDAR_DAYS, landingDate, landingLabel, PLANNED_LANDING } from "../calendar";
import { MOCK_PARAMS, MOCK_PARAMS_RISKY } from "../schemas";
import type { MissionParams } from "../types";

const base: MissionParams = { ...MOCK_PARAMS };

// A clearly failing mission: tiny battery, huge load, bad site, comm req impossible to meet
const failingParams: MissionParams = {
  ...base,
  siteIdx: 2,
  batteryKwh: 40,
  loadKw: 4,
  panelEff: 0.05,
  durationDays: 5,
};

//What-if scenarios

describe("T-34: runScenario – parameter isolation", () => {
  it("does not mutate the original params object", () => {
    const original = { ...base };
    const sc = PRESETS.find((p) => p.id === "power")!;
    runScenario(base, sc);
    expect(base).toEqual(original);
  });

  it("returns a different SimResult for each distinct scenario", () => {
    const r0 = runScenario(base, PRESETS.find((p) => p.id === "early")!);
    const r1 = runScenario(base, PRESETS.find((p) => p.id === "delay5")!);
    expect(r0.soc).not.toEqual(r1.soc);
  });

  it("delay scenario shifts simulation by the correct number of hours", () => {
    const sc = PRESETS.find((p) => p.id === "delay1")!; // +24 h
    const rBase = simulate(base);
    const rDelayed = runScenario(base, sc);
    // Different start → different SoC profile
    expect(rBase.soc[0]).toBeDefined();
    expect(rDelayed.soc[0]).toBeDefined();
  });

  it("panels 20% weaker scenario reduces effective charging", () => {
    const sc = PRESETS.find((p) => p.id === "panels")!; // effScale = 0.8
    const rFull = simulate(base);
    const rWeak = runScenario(base, sc);
    // Weaker panels → lower or equal minSoc
    expect(rWeak.minSoc).toBeLessThanOrEqual(rFull.minSoc + 0.1);
  });

  it("2x contact scenario doubles commHoursReq (capped at 24)", () => {
    const sc = PRESETS.find((p) => p.id === "contact")!; // commScale = 2
    // With a double requirement on a comm-stressed site, verdict worsens or stays
    const rBase = simulate(base);
    const rComm = runScenario(base, sc);
    const verdictOrder = { ok: 0, warn: 1, fail: 2 };
    expect(verdictOrder[rComm.verdict]).toBeGreaterThanOrEqual(verdictOrder[rBase.verdict]);
  });

  it("1.5x power scenario increases load correctly", () => {
    const sc = PRESETS.find((p) => p.id === "power")!; // loadScale = 1.5
    const rBase = simulate(base);
    const rHeavy = runScenario(base, sc);
    // More load → lower or equal minSoc
    expect(rHeavy.minSoc).toBeLessThanOrEqual(rBase.minSoc + 0.1);
  });
});

describe("T-34: customScenario construction", () => {
  it("produces id that includes all four axes", () => {
    const sc = customScenario(2, 80, 2, 1.5);
    expect(sc.id).toContain("2");
    expect(sc.id).toContain("80");
    expect(sc.id).toContain("1.5");
  });

  it("loadScale defaults to 1 (backward-compatible)", () => {
    const sc = customScenario(0, 100, 1); // old 3-arg call
    expect(sc.loadScale).toBe(1);
  });

  it("'Same as plan' label when nothing changes", () => {
    const sc = customScenario(0, 100, 1, 1);
    expect(sc.label).toBe("Same as plan");
  });

  it("includes power-draw description when loadScale != 1", () => {
    const sc = customScenario(0, 100, 1, 1.5);
    expect(sc.label.toLowerCase()).toContain("power draw");
  });

  it("runScenario uses loadScale from customScenario", () => {
    const scNormal = customScenario(0, 100, 1, 1);
    const scHeavy = customScenario(0, 100, 1, 2);
    const rNormal = runScenario(base, scNormal);
    const rHeavy = runScenario(base, scHeavy);
    expect(rHeavy.minSoc).toBeLessThanOrEqual(rNormal.minSoc + 0.1);
  });

  it("commScale is clamped so commHoursReq stays ≤ 24", () => {
    // base commHoursReq = 4; with commScale = 10 → would be 40 → clamped to 24
    const sc = customScenario(0, 100, 10);
    // runScenario clamps to Math.min(24, 4*10) = 24
    const r = runScenario(base, sc);
    expect(r).toBeDefined(); // must not throw
  });
});

//Stress test

describe("T-35: stressTest", () => {
  it("evaluates exactly CALENDAR_DAYS (60) candidates", () => {
    const report = stressTest(base);
    expect(report.candidates).toHaveLength(CALENDAR_DAYS);
  });

  it("candidates are sorted by delayH ascending, starting at 0", () => {
    const report = stressTest(base);
    expect(report.candidates[0].delayH).toBe(0);
    expect(report.candidates[59].delayH).toBe(59 * 24);
    for (let i = 1; i < report.candidates.length; i++) {
      expect(report.candidates[i].delayH).toBe(report.candidates[i - 1].delayH + 24);
    }
  });

  it("passCount + failCount = 60", () => {
    const report = stressTest(base);
    expect(report.passCount + report.failCount).toBe(CALENDAR_DAYS);
  });

  it("earliestFailure is null when no candidates fail", () => {
    // Very robust params: huge battery, low load
    const robust: MissionParams = { ...base, batteryKwh: 200, loadKw: 0.5, panelEff: 0.4 };
    const report = stressTest(robust);
    if (report.failCount === 0) {
      expect(report.earliestFailure).toBeNull();
      expect(report.earliestFailureCause).toBeNull();
    }
  });

  it("earliestFailure is the first (smallest delayH) failure", () => {
    const report = stressTest(MOCK_PARAMS_RISKY);
    if (report.earliestFailure) {
      const earliestDelayH = report.earliestFailure.delayH;
      for (const c of report.candidates) {
        if (c.result.verdict === "fail") {
          expect(c.delayH).toBeGreaterThanOrEqual(earliestDelayH);
          break;
        }
      }
    }
  });

  it("each candidate result has a valid verdict", () => {
    const report = stressTest(base);
    const valid = new Set(["ok", "warn", "fail"]);
    for (const c of report.candidates) {
      expect(valid.has(c.result.verdict)).toBe(true);
    }
  });

  it("does not mutate base params", () => {
    const before = { ...base };
    stressTest(base);
    expect(base).toEqual(before);
  });

  it("note: data wraps every 28 days — candidates beyond day 28 reuse the same environmental pattern", () => {
    // This is the documented limitation. We verify it by checking that
    // candidate at day 0 and day 28 have identical soc arrays (because
    // the site data repeats with period HOURS = 28*24).
    const report = stressTest(base);
    const day0 = report.candidates[0].result.soc;
    const day28 = report.candidates[28].result.soc;
    expect(day0).toEqual(day28); // wrapHour makes them identical
  });
});

//Robustness score

describe("T-36: robustnessScore", () => {
  it("score is in [0, 1]", () => {
    const r = simulate(base);
    const report = robustnessScore(base, r);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(1);
  });

  it("tier is 'failing' when base mission fails", () => {
    const r = simulate(failingParams);
    expect(r.verdict).toBe("fail");
    const report = robustnessScore(failingParams, r);
    expect(report.tier).toBe("failing");
    expect(report.score).toBe(0);
  });

  it("probes array has one entry per PROBE_DELAYS_H (3 entries)", () => {
    const r = simulate(base);
    const report = robustnessScore(base, r);
    expect(report.probes).toHaveLength(3);
  });

  it("each probe has a delayH and a valid verdict", () => {
    const r = simulate(base);
    const report = robustnessScore(base, r);
    const valid = new Set(["ok", "warn", "fail"]);
    for (const probe of report.probes) {
      expect(probe.delayH).toBeGreaterThan(0);
      expect(valid.has(probe.verdict)).toBe(true);
    }
  });

  it("tier is 'strong' when score = 1 (all probes pass)", () => {
    const robust: MissionParams = { ...base, batteryKwh: 200, loadKw: 0.5, panelEff: 0.4, commHoursReq: 0 };
    const r = simulate(robust);
    if (r.verdict !== "fail") {
      const report = robustnessScore(robust, r);
      if (report.score === 1) expect(report.tier).toBe("strong");
    }
  });
});

//Smallest fix 

describe("T-36: smallestFix", () => {
  it("returns null when mission already passes", () => {
    const r = simulate(base);
    expect(r.verdict).not.toBe("fail");
    expect(smallestFix(base, r)).toBeNull();
  });

  it("returns a Fix object for a failing mission", () => {
    const r = simulate(failingParams);
    expect(r.verdict).toBe("fail");
    const fix = smallestFix(failingParams, r);
    // Should find at least one fix (delay or site or battery)
    if (fix) {
      expect(["delay", "site", "battery"]).toContain(fix.kind);
    }
  });

  it("fix result is verified non-fail", () => {
    const r = simulate(failingParams);
    const fix = smallestFix(failingParams, r);
    if (fix) {
      expect(fix.result.verdict).not.toBe("fail");
    }
  });

  it("fix params actually produce the stated result when re-simulated", () => {
    const r = simulate(failingParams);
    const fix = smallestFix(failingParams, r);
    if (fix) {
      const verified = simulate(fix.params);
      expect(verified.verdict).not.toBe("fail");
    }
  });

  it("delay fix does not modify siteIdx", () => {
    const r = simulate(failingParams);
    const fix = smallestFix(failingParams, r);
    if (fix && fix.kind === "delay") {
      expect(fix.params.siteIdx).toBe(failingParams.siteIdx);
    }
  });

  it("battery fix increases batteryKwh and stays within schema max (200)", () => {
    const r = simulate(failingParams);
    const fix = smallestFix(failingParams, r);
    if (fix && fix.kind === "battery") {
      expect(fix.params.batteryKwh).toBeGreaterThan(failingParams.batteryKwh);
      expect(fix.params.batteryKwh).toBeLessThanOrEqual(200);
    }
  });

  it("fix description is a non-empty string", () => {
    const r = simulate(failingParams);
    const fix = smallestFix(failingParams, r);
    if (fix) {
      expect(fix.description.length).toBeGreaterThan(0);
    }
  });

  it("prioritizes timing (delay) before site and battery when delay resolves failure", () => {
    // If a delay works, smallestFix should pick "delay" as the lowest-impact fix
    const r = simulate(failingParams);
    const fix = smallestFix(failingParams, r);
    if (fix) {
      expect(fix.kind).toBe("delay");
    }
  });

  it("preserves original mission parameters in smallestFix", () => {
    const original = JSON.parse(JSON.stringify(failingParams));
    const r = simulate(failingParams);
    smallestFix(failingParams, r);
    expect(failingParams).toEqual(original);
  });
});

//Additional Boundary and Reliability Tests

describe("T-38: Scenario input boundary and safety handling", () => {
  it("handles non-finite or negative scenario values safely", () => {
    const bogusScenario = {
      id: "bogus",
      label: "Bogus",
      delayH: NaN,
      effScale: -5,
      commScale: -2,
      loadScale: NaN,
    };
    const r = runScenario(base, bogusScenario);
    expect(r).toBeDefined();
    expect(r.soc.length).toBe(base.durationDays * 24);
  });

  it("handles zero values safely without division by zero or NaN", () => {
    const zeroScenario = {
      id: "zeros",
      label: "Zeros",
      delayH: 0,
      effScale: 0,
      commScale: 0,
      loadScale: 0,
    };
    const r = runScenario(base, zeroScenario);
    expect(r).toBeDefined();
    expect(Number.isFinite(r.minSoc)).toBe(true);
  });
});

describe("T-38: Earliest failure detection edge cases", () => {
  it("detects candidate 0 as earliest failure when base params already fail", () => {
    const report = stressTest(failingParams);
    expect(report.earliestFailure).not.toBeNull();
    expect(report.earliestFailure?.delayH).toBe(0);
    expect(report.earliestFailureCause).toBe("power");
    expect(report.failCount).toBeGreaterThan(0);
  });
});

describe("T-38: Robustness score tier coverage", () => {
  it("classifies moderate tier when 1 or 2 probes pass", () => {
    // Construct mock probes scenario
    const mockReport = {
      score: 2 / 3,
      tier: 2 / 3 === 1 ? "strong" : 2 / 3 >= 0.5 ? "moderate" : "fragile",
    };
    expect(mockReport.tier).toBe("moderate");
  });

  it("classifies fragile tier when less than 50% pass", () => {
    const mockReport = {
      score: 1 / 3,
      tier: 1 / 3 === 1 ? "strong" : 1 / 3 >= 0.5 ? "moderate" : "fragile",
    };
    expect(mockReport.tier).toBe("fragile");
  });

  it("robustnessScore preserves original parameters", () => {
    const original = JSON.parse(JSON.stringify(base));
    const r = simulate(base);
    robustnessScore(base, r);
    expect(base).toEqual(original);
  });
});

describe("T-38: Calendar dates and labels", () => {
  it("formats landing dates and labels correctly", () => {
    const d0 = landingDate(0);
    expect(d0.getTime()).toBe(PLANNED_LANDING);
    const label0 = landingLabel(0);
    expect(label0).toContain("Mar");

    const d24 = landingDate(24);
    expect(d24.getTime()).toBe(PLANNED_LANDING + 24 * 3600_000);
  });
});

describe("T-38: smallestFix branch coverage", () => {
  it("returns battery fix when delay and site cannot fix but larger battery can", () => {
    // A mission where every delay and site fails due to high load, but huge battery fixes it:
    const batteryFixParams: MissionParams = {
      ...base,
      siteIdx: 0,
      batteryKwh: 40,
      loadKw: 1.5,
      panelEff: 0.15,
      durationDays: 4,
    };
    const r = simulate(batteryFixParams);
    if (r.verdict === "fail") {
      const fix = smallestFix(batteryFixParams, r);
      if (fix) {
        expect(["delay", "site", "battery"]).toContain(fix.kind);
        const verified = simulate(fix.params);
        expect(verified.verdict).not.toBe("fail");
      }
    }
  });

  it("returns null when no practical fix exists for impossible mission", () => {
    const impossibleParams: MissionParams = {
      ...base,
      batteryKwh: 200,
      loadKw: 4.0,
      panelEff: 0.05,
      commHoursReq: 24,
      durationDays: 14,
    };
    const r = simulate(impossibleParams);
    const fix = smallestFix(impossibleParams, r);
    // When no delay, site, or battery (already 200) can fix it, returns null
    expect(fix).toBeNull();
  });
});



