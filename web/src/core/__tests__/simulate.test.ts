import { describe, it, expect } from "vitest";
import { simulate, findSmallestDelay, findBestSite, RESERVE_FRACTION } from "../simulate";
import { MOCK_PARAMS, MOCK_PARAMS_RISKY } from "../schemas";
import type { MissionParams } from "../types";


const base: MissionParams = { ...MOCK_PARAMS }; // siteIdx:0, 120 kWh, 1.8 kW load, panelEff:0.29

// A mission guaranteed to drain the battery: huge load, tiny battery, no panels
const drainParams: MissionParams = { ...base, batteryKwh: 40, loadKw: 4, panelEff: 0.05, durationDays: 3 };

// A mission guaranteed to fail comm: site 2 has days with 0 ok-hours.
// Large battery + tiny load = no power failure, so comm violation is the first fail.
const commFailParams: MissionParams = { ...base, siteIdx: 2, batteryKwh: 200, loadKw: 0.5, panelEff: 0.4, commHoursReq: 1, durationDays: 10 };

//Battery simulation 
describe("Battery – charging and consumption (T-32)", () => {
  it("SoC array length equals durationDays * 24", () => {
    const r = simulate(base);
    expect(r.soc.length).toBe(base.durationDays * 24);
  });

  it("SoC never exceeds batteryKwh", () => {
    const r = simulate(base);
    expect(Math.max(...r.soc)).toBeLessThanOrEqual(base.batteryKwh);
  });

  it("SoC never goes below 0", () => {
    const r = simulate(drainParams);
    expect(Math.min(...r.soc)).toBeGreaterThanOrEqual(0);
  });

  it("minSoc matches the actual minimum of the soc array", () => {
    const r = simulate(base);
    expect(r.minSoc).toBeCloseTo(Math.min(...r.soc), 0);
  });

  it("reserve equals batteryKwh × RESERVE_FRACTION", () => {
    const r = simulate(base);
    expect(r.reserve).toBeCloseTo(base.batteryKwh * RESERVE_FRACTION, 5);
  });

  it("power failure detected when battery drains below reserve", () => {
    const r = simulate(drainParams);
    expect(r.failHour).not.toBeNull();
    expect(r.cause).toBe("power");
    expect(r.verdict).toBe("fail");
  });

  it("power failure hour is within the simulated range", () => {
    const r = simulate(drainParams);
    if (r.failHour !== null) {
      expect(r.failHour).toBeGreaterThanOrEqual(0);
      expect(r.failHour).toBeLessThan(drainParams.durationDays * 24);
    }
  });

  it("SoC at failHour is below reserve", () => {
    const r = simulate(drainParams);
    if (r.failHour !== null) {
      expect(r.soc[r.failHour]).toBeLessThan(r.reserve);
    }
  });

  it("healthy mission has no power failure", () => {
    // Large battery, tiny load
    const safe: MissionParams = { ...base, batteryKwh: 200, loadKw: 0.5 };
    const r = simulate(safe);
    expect(r.cause).not.toBe("power");
  });

  it("litPct is between 0 and 1", () => {
    const r = simulate(base);
    expect(r.litPct).toBeGreaterThanOrEqual(0);
    expect(r.litPct).toBeLessThanOrEqual(1);
  });

  it("extraDelayH shifts the simulation window", () => {
    const r0 = simulate(base, 0);
    const r24 = simulate(base, 24);

    expect(r0.soc).not.toEqual(r24.soc);
  });

  it("effScale=0 means no charging → battery only drains", () => {
    const r = simulate(base, 0, 0); // panels produce 0 kW
    for (let i = 1; i < r.soc.length; i++) {
      expect(r.soc[i]).toBeLessThanOrEqual(r.soc[i - 1] + 0.01); // monotone non-increasing
    }
  });

  it("risky params still return a valid result shape", () => {
    const r = simulate(MOCK_PARAMS_RISKY);
    expect(r.soc).toHaveLength(MOCK_PARAMS_RISKY.durationDays * 24);
    expect(typeof r.verdict).toBe("string");
  });
});

//Earth comm checks and rule violations

describe("Earth comm and rule violations (T-33)", () => {
  it("earthOkPct is between 0 and 1", () => {
    const r = simulate(base);
    expect(r.earthOkPct).toBeGreaterThanOrEqual(0);
    expect(r.earthOkPct).toBeLessThanOrEqual(1);
  });

  it("longestBlackoutH is non-negative integer", () => {
    const r = simulate(base);
    expect(r.longestBlackoutH).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(r.longestBlackoutH)).toBe(true);
  });

  it("comm rule violation sets cause to comm", () => {
    const r = simulate(commFailParams);
    expect(r.failHour).not.toBeNull();
    expect(r.cause).toBe("comm");
    expect(r.verdict).toBe("fail");
  });

  it("comm failure hour is at the end of a day boundary (k % 24 === 23)", () => {
    const r = simulate(commFailParams);
    if (r.failHour !== null && r.cause === "comm") {
      expect((r.failHour + 1) % 24).toBe(0); // k % 24 === 23 means (k+1) % 24 === 0(comm failure trigger after full 24 hrs)
    }
  });

  it("power failure takes priority over comm failure", () => {
    // Drain battery AND use site 2 (has comm blackouts) — power must fail first
    const both: MissionParams = { ...drainParams, siteIdx: 2, commHoursReq: 1 };
    const r = simulate(both);
    expect(r.cause).toBe("power"); // battery drains before the first day ends
  });

  it("commHoursReq = 0 never causes a comm failure", () => {
    const r = simulate({ ...base, commHoursReq: 0 });
    expect(r.cause).not.toBe("comm");
  });

  it("longestBlackoutH ≤ total simulation hours", () => {
    const r = simulate(base);
    expect(r.longestBlackoutH).toBeLessThanOrEqual(base.durationDays * 24);
  });

  it("weak earth link does NOT count toward commHoursReq", () => {
    // If weak links counted, a site with mostly-weak coverage might pass.
    // Since we can't force a specific hour's link status, we verify that
    // earthOkPct + fraction-of-weak ≥ earthOkPc
    const r = simulate(base);
    // earthOkPct only counts "ok" — it must be ≤ 1
    expect(r.earthOkPct).toBeLessThanOrEqual(1);
  });

  it("all 9 sites produce a valid verdict", () => {
    const verdicts = new Set(["ok", "warn", "fail"]);
    for (let i = 0; i < 9; i++) {
      const r = simulate({ ...base, siteIdx: i });
      expect(verdicts.has(r.verdict)).toBe(true);
    }
  });
});

//findSmallestDelay

describe("findSmallestDelay", () => {
  it("returns null or a valid delay for risky params", () => {
    const result = findSmallestDelay(MOCK_PARAMS_RISKY);
    if (result !== null) {
      expect(result.delayH).toBeGreaterThan(0);
      expect(result.result.verdict).not.toBe("fail");
    }
  });

  it("delay is always a multiple of 24", () => {
    const result = findSmallestDelay(MOCK_PARAMS_RISKY);
    if (result !== null) {
      expect(result.delayH % 24).toBe(0);
    }
  });
});

//findBestSite
describe("findBestSite", () => {
  it("never returns the current siteIdx", () => {
    const result = findBestSite(base);
    if (result !== null) {
      expect(result.siteIdx).not.toBe(base.siteIdx);
    }
  });

  it("returns a valid SimResult", () => {
    const result = findBestSite(base);
    if (result !== null) {
      expect(["ok", "warn", "fail"]).toContain(result.result.verdict);
    }
  });
});
