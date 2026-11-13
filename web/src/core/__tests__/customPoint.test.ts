import { describe, expect, it } from "vitest";
import { findPoint, offsetKm } from "../customPoint";
import { SITES } from "../sites";

describe("custom landing point", () => {
  it("snaps a site's own coordinates to its centre", () => {
    SITES.forEach((s, i) => {
      const r = findPoint(s.lat, s.lon);
      expect(r.kind).toBe("snapped");
      if (r.kind === "snapped") {
        expect(r.siteIdx).toBe(i);
        expect([r.dxKm, r.dyKm]).toEqual([0, 0]);
        expect(r.distanceKm).toBeLessThan(0.01);
      }
    });
  });

  it("measures east and north offsets on the sphere", () => {
    const s = SITES[0];
    const northward = offsetKm(s.lat, s.lon, s.lat + 1 / 30.32, s.lon); // about 1 km north (1 deg = 30.32 km)
    expect(northward.north).toBeCloseTo(1, 1);
    expect(Math.abs(northward.east)).toBeLessThan(0.05);
  });

  it("snaps a point about 2 km north to the grid point (0, 2)", () => {
    const s = SITES[0];
    const r = findPoint(s.lat + 2 / 30.32, s.lon);
    expect(r.kind).toBe("snapped");
    if (r.kind === "snapped") expect([r.dxKm, r.dyKm]).toEqual([0, 2]);
  });

  it("reports points beyond the grid as not computed", () => {
    const s = SITES[0];
    const r = findPoint(s.lat + 5 / 30.32, s.lon);
    expect(r.kind).toBe("far");
  });

  it("rejects bad input and points outside the south pole", () => {
    expect(findPoint(NaN, 0).kind).toBe("invalid");
    expect(findPoint(-95, 0).kind).toBe("invalid");
    expect(findPoint(0, 0).kind).toBe("outside");
  });
});