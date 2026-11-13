import { describe, it, expect, vi, afterEach } from "vitest";
import { simulate, RESERVE_FRACTION } from "../simulate";
import { missionEvents } from "../events";
import {
  HOURS,
  SITES,
  getSite,
  wrapHour,
  loadRealSites,
  usingRealData,
  dataProblems,
} from "../sites";
import { startRescue, tick, applyMove, CRISES, RESCUE_HARDWARE } from "../rescue";
import { MOCK_PARAMS } from "../schemas";
import type { MissionParams } from "../types";

const files = import.meta.glob<unknown>("../../../public/data/*.json", { eager: true, import: "default" });
const byId = (id: string) => files[`../../../public/data/${id}`];

describe("R3 Mission Simulator – Edge Cases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Edge Case 1: Very long nights and battery discharge", () => {
    it("discharges battery steadily by loadKw each hour of darkness in simulate()", () => {
      // Pick a site and delay that enters darkness, or simulate with 0 panel efficiency
      const nightParams: MissionParams = {
        ...MOCK_PARAMS,
        batteryKwh: 100,
        loadKw: 2.0,
        panelEff: 0.15, // minimum panels
        durationDays: 2, // 48 hours
      };

      // Set extraDelay to ensure lander encounters dark hours
      const res = simulate(nightParams);
      const site = getSite(nightParams.siteIdx);

      // Verify that during any dark hour, soc decreased by exactly loadKw (or hit 0)
      for (let k = 1; k < res.soc.length; k++) {
        const h = wrapHour(k - 1 + nightParams.delayH);
        const wasDark = !site.lit[h];
        if (wasDark && res.soc[k - 1] > 0) {
          const expectedSoC = Math.max(0, Math.round((res.soc[k - 1] - nightParams.loadKw) * 10) / 10);
          expect(res.soc[k]).toBeCloseTo(expectedSoC, 1);
        }
      }
    });

    it("tracks battery discharge during extended night in rescue mode", () => {
      const crisis = CRISES[0];
      let state = startRescue(crisis, {
        ...MOCK_PARAMS,
        batteryKwh: RESCUE_HARDWARE.batteryKwh,
        loadKw: 2.0,
      });

      const initialSoc = state.soc;
      // Tick for 5 hours
      for (let i = 0; i < 5; i++) {
        state = tick(state);
      }
      expect(state.t).toBe(5);
      expect(state.soc).toBeLessThan(initialSoc);

      // Putting lander to sleep (hibernation) reduces consumption during night
      const hibernated = applyMove(state, "hibernate");
      const socBeforeHalt = hibernated.soc;
      const tickedHibernated = tick(hibernated);
      // Hibernation load is 0.4 kW
      expect(socBeforeHalt - tickedHibernated.soc).toBeLessThanOrEqual(0.45);
    });
  });

  describe("Edge Case 2: Battery reaching 0", () => {
    it("clamps battery SoC to exactly 0 and never allows negative energy in simulate()", () => {
      // Very high load and zero panels to guarantee complete battery drain
      const totalDrainParams: MissionParams = {
        ...MOCK_PARAMS,
        batteryKwh: 40,
        loadKw: 4.0,
        panelEff: 0.15,
        durationDays: 4, // 96 hours, will drain 40 kWh in ~10-15 dark hours
      };

      const res = simulate(totalDrainParams);
      expect(res.verdict).toBe("fail");
      expect(res.cause).toBe("power");
      expect(res.minSoc).toBe(0);

      // Ensure no negative SoC values exist
      expect(res.soc.every((val) => val >= 0)).toBe(true);
      expect(Math.min(...res.soc)).toBe(0);

      // failHour occurs when dropping below reserve (25%), well before 0
      const reserve = totalDrainParams.batteryKwh * RESERVE_FRACTION;
      expect(res.failHour).not.toBeNull();
      expect(res.soc[res.failHour!]).toBeLessThan(reserve);
    });

    it("records 'Battery empty' event when SoC reaches 0 in missionEvents()", () => {
      const totalDrainParams: MissionParams = {
        ...MOCK_PARAMS,
        batteryKwh: 40,
        loadKw: 4.0,
        panelEff: 0.15,
        durationDays: 4,
      };

      const events = missionEvents(totalDrainParams);

      const emptyEvent = events.find((e) => e.text.includes("Battery empty. Lander shuts down."));
      expect(emptyEvent).toBeDefined();
      expect(emptyEvent!.tone).toBe("fail");

      // Verify Earth set warning is also emitted when an Earth set event occurs
      const commFailParams: MissionParams = {
        ...MOCK_PARAMS,
        siteIdx: 2,
        durationDays: 10,
      };
      const commEvents = missionEvents(commFailParams);
      const warnBeforeLoss = commEvents.find((e) => e.text.includes("Earth sets behind the ridge in 2 h."));
      if (commEvents.some((e) => e.text.startsWith("Earth set") && e.hour >= 2)) {
        expect(warnBeforeLoss).toBeDefined();
        expect(warnBeforeLoss!.tone).toBe("warn");
      }
    });

    it("terminates rescue game with 'lost' status when SoC reaches 0", () => {
      const state = startRescue(CRISES[0], {
        ...MOCK_PARAMS,
        batteryKwh: 50,
      });

      // Force soc close to zero in darkness so net power is strictly negative
      let nearZero = { ...state, horizonDrop: -100, soc: 0.1 };
      nearZero = tick(nearZero);

      expect(nearZero.soc).toBe(0);
      expect(nearZero.status).toBe("lost");
      expect(nearZero.log.some((l) => l.text.includes("Battery empty. Mission lost."))).toBe(true);

      // Further ticks do not modify state once lost
      const afterLost = tick(nearZero);
      expect(afterLost).toBe(nearZero);
    });
  });

  describe("Edge Case 3: Accessing the last hour of yearly data", () => {
    it("wraps correctly at the last hour index (HOURS - 1) and beyond", () => {
      expect(wrapHour(HOURS - 1)).toBe(HOURS - 1);
      expect(wrapHour(HOURS)).toBe(0);
      expect(wrapHour(HOURS + 1)).toBe(1);
      expect(wrapHour(-1)).toBe(HOURS - 1);
    });

    it("provides valid and defined data arrays at the last hour (HOURS - 1) for all sites", () => {
      for (let i = 0; i < SITES.length; i++) {
        const site = getSite(i);
        const lastH = HOURS - 1;

        expect(typeof site.lit[lastH]).toBe("boolean");
        expect(Number.isFinite(site.sunAz[lastH])).toBe(true);
        expect(Number.isFinite(site.sunEl[lastH])).toBe(true);
        expect(Number.isFinite(site.earthAz[lastH])).toBe(true);
        expect(Number.isFinite(site.earthEl[lastH])).toBe(true);
        expect(["ok", "weak", "lost"]).toContain(site.earth[lastH]);
      }
    });

    it("simulates cleanly across the yearly data boundary without index out of bounds", () => {
      // Start near the end of data range and wrap around
      const boundaryParams: MissionParams = {
        ...MOCK_PARAMS,
        siteIdx: 0,
        delayH: HOURS - 5,
        durationDays: 3, // 72 hours, crosses HOURS - 1 into hour 0
      };

      const res = simulate(boundaryParams);
      expect(res.soc.length).toBe(72);
      expect(res.soc.every(Number.isFinite)).toBe(true);
      expect(res.litPct).toBeGreaterThanOrEqual(0);
      expect(res.litPct).toBeLessThanOrEqual(1);
    });
  });

  describe("Edge Case 4: Missing or corrupted site data with fallback to sample data", () => {
    it("handles fetch network failure and falls back to sample data", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network connection refused")));

      const loaded = await loadRealSites("/fake-base/");
      expect(loaded).toBe(false);
      expect(usingRealData()).toBe(false);
      expect(HOURS).toBe(24 * 28);

      const problems = dataProblems();
      expect(problems.length).toBeGreaterThan(0);
      expect(problems[0].cause).toContain("The browser could not reach the server to download the file.");

      // Fallback sample data works as expected
      const sampleSite = getSite(0);
      expect(sampleSite.lit.length).toBe(24 * 28);
    });

    it("handles 404 missing site file with fallback to sample data", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );

      const loaded = await loadRealSites("/missing/");
      expect(loaded).toBe(false);
      expect(usingRealData()).toBe(false);

      const problems = dataProblems();
      expect(problems.some((p) => p.cause.includes("The file does not exist."))).toBe(true);
      expect(getSite(1).lit.length).toBe(24 * 28);
    });

    it("handles 500 server error with fallback to sample data", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      const loaded = await loadRealSites("/error/");
      expect(loaded).toBe(false);
      const problems = dataProblems();
      expect(problems.some((p) => p.cause.includes("500"))).toBe(true);
    });

    it("handles corrupted JSON data with fallback to sample data", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON at position 0")),
        }),
      );

      const loaded = await loadRealSites("/corrupted-json/");
      expect(loaded).toBe(false);
      const problems = dataProblems();
      expect(problems.some((p) => p.cause.includes("The file is not valid JSON"))).toBe(true);
    });

    it("handles invalid site schema format with fallback to sample data", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ malformed: true }),
        }),
      );

      const loaded = await loadRealSites("/malformed-schema/");
      expect(loaded).toBe(false);
      const problems = dataProblems();
      expect(problems.some((p) => p.cause.includes("The file is in the wrong format"))).toBe(true);
    });

    it("handles unexpected errors in loadRealSites catch block", async () => {
      // First ensure problems array is empty by successfully loading valid site data
      vi.stubGlobal("fetch", async (url: string) => {
        const id = url.split("/").pop()!;
        return { ok: true, json: async () => byId(id) };
      });
      await loadRealSites("/");
      expect(dataProblems().length).toBe(0);

      // Now reject Promise.all so problems remains empty and the generic fallback error is created
      const originalPromiseAll = Promise.all;
      vi.spyOn(Promise, "all").mockRejectedValueOnce(new Error("Fatal filesystem breakdown"));

      const loaded = await loadRealSites("/fatal/");
      expect(loaded).toBe(false);
      const problems = dataProblems();
      expect(problems.some((p) => p.cause.includes("Unexpected error: Fatal filesystem breakdown"))).toBe(true);

      Promise.all = originalPromiseAll;
    });
  });
});
