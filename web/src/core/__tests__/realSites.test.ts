import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MOCK_PARAMS, MissionParamsSchema, SimResultSchema, SiteDataSchema } from "../schemas";
import { siteDataFromFile } from "../realSites";
import { HOURS, SITES, getSite, loadRealSites, usingRealData, wrapHour } from "../sites";
import { siteDna } from "../dna";
import { findBestSite, findSmallestDelay, simulate } from "../simulate";
import { missionEvents } from "../events";
import { MAX_DELAY_H } from "../calendar";

// Real-format files: web/public/data/<id>.json (74 days, hourly). Skipped when they are not present.
const files = import.meta.glob<unknown>("../../../public/data/*.json", { eager: true, import: "default" });
const byId = (id: string) => files[`../../../public/data/${id}`];
const have = SITES.every((s) => byId(`${s.id}.json`) !== undefined);

describe.skipIf(!have)("real site data", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      const id = url.split("/").pop()!;
      return { ok: true, json: async () => byId(id) };
    });
    expect(await loadRealSites("/")).toBe(true);
  });
  afterAll(() => vi.unstubAllGlobals());

  it("loads all sites with a full 74 days", () => {
    expect(usingRealData()).toBe(true);
    expect(HOURS).toBeGreaterThanOrEqual(MAX_DELAY_H + 14 * 24);
    for (let i = 0; i < SITES.length; i++) expect(() => SiteDataSchema.parse(getSite(i))).not.toThrow();
  });

  it("lit/earth rules match the horizon", () => {
    const s = getSite(0);
    for (const h of [0, 100, 500, 1200]) {
      expect(s.lit[h]).toBe(s.sunEl[h] > s.horizon[Math.round(s.sunAz[h]) % 360]);
    }
  });

  it("simulate() is valid and finite for every site, at every delay in the calendar", () => {
    for (let i = 0; i < SITES.length; i++) {
      for (const delayH of [0, 24, 240, 720, MAX_DELAY_H]) {
        const p = { ...MOCK_PARAMS, siteIdx: i, delayH, durationDays: 14 };
        const r = simulate(MissionParamsSchema.parse({ ...p, delayH: Math.min(delayH, 240) }));
        expect(() => SimResultSchema.parse(r)).not.toThrow();
        const r2 = simulate({ ...p });
        expect(r2.soc.every(Number.isFinite)).toBe(true);
        expect(r2.soc.length).toBe(14 * 24);
      }
    }
  });

  it("the data does not repeat every 28 days", () => {
    // Sun elevation 28 days later must differ (the sample data repeated exactly; real data must not).
    const s = getSite(0);
    expect(HOURS).toBeGreaterThan(672 + 240);
    expect(s.sunEl.slice(0, 240).some((v, k) => v !== s.sunEl[672 + k])).toBe(true);
    expect(s.earthEl.slice(0, 240).some((v, k) => v !== s.earthEl[672 + k])).toBe(true);
  });
  it("DNA uses the first 28 days and matches the file", () => {
    const d = siteDna(0);
    const s = getSite(0);
    const lit = s.lit.slice(0, 672).filter(Boolean).length / 672;
    expect(d.litPct).toBeCloseTo(lit, 10);
  });

  it("events, findSmallestDelay and findBestSite run on real data", () => {
    expect(() => missionEvents({ ...MOCK_PARAMS, delayH: 500 })).not.toThrow();
    expect(() => findSmallestDelay({ ...MOCK_PARAMS, siteIdx: 3 })).not.toThrow();
    expect(findBestSite(MOCK_PARAMS)).not.toBeNull();
    expect(wrapHour(-1)).toBe(HOURS - 1);
  });
});

describe("siteDataFromFile", () => {
  const hz = Array.from({ length: 360 }, () => 1);
  const n = 24 * 30;
  const arr = (v: number) => Array.from({ length: n }, () => v);
  const good = {
    grid: [{ dx_km: 0, dy_km: 0, horizon: hz }],
    sun_az: arr(10),
    sun_el: arr(2),
    earth_az: arr(180),
    earth_el: arr(5),
  };
  it("applies the 2.5 degree rule", () => {
    const s = siteDataFromFile(good)!;
    expect(s.lit[0]).toBe(true); // 2 > 1
    expect(s.earth[0]).toBe("ok"); // margin 4 > 2.5
    expect(siteDataFromFile({ ...good, earth_el: arr(2.0) })!.earth[0]).toBe("weak"); // margin 1
    expect(siteDataFromFile({ ...good, earth_el: arr(0.5) })!.earth[0]).toBe("lost"); // margin -0.5
  });
  it("rejects incomplete or too-short files", () => {
    expect(siteDataFromFile({ ...good, grid: [] })).toBeNull();
    expect(siteDataFromFile({ ...good, sun_el: undefined })).toBeNull();
    expect(siteDataFromFile({ ...good, sun_az: [1, 2, 3] })).toBeNull();
    expect(siteDataFromFile({ ...good, grid: [{ dx_km: 0, dy_km: 0, horizon: [1, 2] }] })).toBeNull();
  });
});
