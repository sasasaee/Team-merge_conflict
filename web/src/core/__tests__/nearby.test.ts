// "Move N km" what-ifs (the pipeline's 5x5 grid), planner defaults and Rescue Mode balance, on the real site files.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SITES, getSite, getSiteAt, loadRealSites, usingRealData } from "../sites";
import { PRESETS, customScenario, runScenario } from "../scenarios";
import { simulate } from "../simulate";
import { CRISES, RESCUE_HARDWARE, applyMove, canMove, isLit, startRescue, tick, type Move } from "../rescue";
import { useMission } from "../store";
import type { MissionParams } from "../types";

// Real-format site files: web/public/data/<id>.json
const files = import.meta.glob<unknown>("../../../public/data/*.json", { eager: true, import: "default" });

const params = (siteIdx: number, over: Partial<MissionParams> = {}): MissionParams => ({
  siteIdx, delayH: 0, batteryKwh: 400, loadKw: 1.0, panelEff: 0.29, commHoursReq: 4, durationDays: 10, ...over,
});

describe("without real files (sample data)", () => {
  it("a move scenario falls back to the plain site", () => {
    expect(usingRealData()).toBe(false);
    expect(getSiteAt(0, 2, 0)).toBe(getSite(0));
    const east = PRESETS.find((p) => p.id === "east2")!;
    expect(runScenario(params(0), east)).toEqual(simulate(params(0)));
  });
});

describe("with the real site files", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", async (u: string) => ({ ok: true, json: async () => files[`../../../public/data/${u.split("/").pop()}`] }) as Response);
    expect(await loadRealSites("/")).toBe(true);
  });
  afterAll(() => vi.unstubAllGlobals());

  it("every site carries its 25 nearby points", () => {
    SITES.forEach((_, i) => {
      const g = getSite(i).grid!;
      expect(g).toHaveLength(25);
      expect(new Set(g.map((p) => `${p.dxKm},${p.dyKm}`)).size).toBe(25);
      expect(g.every((p) => p.horizon.length === 360)).toBe(true);
    });
  });

  it("getSiteAt: (0,0) is the site, other points use their own horizon, results are cached", () => {
    expect(getSiteAt(0, 0, 0)).toBe(getSite(0));
    const p = getSite(0).grid!.find((g) => g.dxKm === 2 && g.dyKm === -1)!;
    const moved = getSiteAt(0, 2, -1);
    expect(moved.horizon).toEqual(p.horizon);
    expect(moved.sunEl).toEqual(getSite(0).sunEl); // same Sun and Earth, different mountains
    expect(getSiteAt(0, 2, -1)).toBe(moved);
    expect(getSiteAt(0, 5, 5)).toBe(getSite(0)); // not on the grid
  });

  it("moving changes the lit hours somewhere, and a scenario with no move changes nothing", () => {
    const east = PRESETS.find((p) => p.id === "east2")!;
    const changed = SITES.filter((_, i) => getSiteAt(i, 2, 0).lit.filter(Boolean).length !== getSite(i).lit.filter(Boolean).length);
    expect(changed.length).toBeGreaterThan(0);
    SITES.forEach((_, i) => {
      expect(runScenario(params(i), { ...east, moveEastKm: 0 })).toEqual(simulate(params(i)));
      expect(runScenario(params(i), east)).toEqual(simulate(params(i), 0, 1, { dxKm: 2, dyKm: 0 }));
    });
  });

  it("custom scenarios label and clamp moves", () => {
    const sc = customScenario(0, 100, 1, 1, -2, 1);
    expect(sc.label).toBe("Move 2 km west, move 1 km north");
    const far = { ...sc, moveEastKm: 9, moveNorthKm: Number.NaN };
    expect(runScenario(params(0), far)).toEqual(simulate(params(0), 0, 1, { dxKm: 2, dyKm: 0 }));
  });
});

describe("defaults and Rescue Mode balance", () => {
  it("the planner starts with a plan that can survive at the first site, and a calendar with failing days", () => {
    const p = useMission.getState().params;
    expect(p.batteryKwh).toBe(400);
    expect(p.loadKw).toBe(1.0);
    expect(simulate(p).verdict).not.toBe("fail");
    let fails = 0;
    for (let d = 0; d < 60; d++) if (simulate({ ...p, delayH: d * 24 }).verdict === "fail") fails++;
    expect(fails).toBeGreaterThan(0);
  });

  const play = (siteIdx: number, crisis: number, opening: Move[], hibernateInDark: boolean) => {
    let s = startRescue(CRISES[crisis], { ...params(siteIdx), ...RESCUE_HARDWARE });
    for (const m of opening) s = applyMove(s, m);
    while (s.status === "running") {
      if (hibernateInDark && !isLit(s, s.t) && canMove(s, "hibernate")) s = applyMove(s, "hibernate");
      s = tick(s);
    }
    return s.status;
  };

  it("doing nothing loses and hibernating through the dark wins, whatever the planner settings are", () => {
    for (const i of [0, 1, 2, 3]) {
      CRISES.forEach((_, c) => {
        expect(play(i, c, [], false)).toBe("lost");
        expect(play(i, c, [], true)).toBe("saved");
      });
    }
  });
});
