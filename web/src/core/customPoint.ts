// Custom landing point: find the computed grid point nearest to a latitude/longitude the user types.
// Each site has a 5x5 grid of horizons, 1 km apart (dx = km east, dy = km north of the site, -2..2).
// A point within SNAP_KM of a grid point uses that point's real data; anything farther needs the pipeline.
import { SITES } from "./sites";

const MOON_R_KM = 1737.4; // same sphere as the terrain pipeline
const RAD = Math.PI / 180;
export const SNAP_KM = 0.75; // the grid is 1 km apart, so this covers the whole 5x5 area plus a margin
export const POLE_LIMIT_LAT = -80; // the terrain map covers the south pole only

export type PointMatch =
  | { kind: "invalid"; reason: string }
  | { kind: "outside"; reason: string }
  | { kind: "snapped"; siteIdx: number; dxKm: number; dyKm: number; distanceKm: number; label: string }
  | { kind: "far"; siteIdx: number; distanceKm: number };

const unit = (latDeg: number, lonDeg: number): [number, number, number] => {
  const la = latDeg * RAD;
  const lo = lonDeg * RAD;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};

// km east and km north of a site, on the local horizontal plane (fine at these few-km distances)
export function offsetKm(siteLat: number, siteLon: number, lat: number, lon: number): { east: number; north: number } {
  const u = unit(siteLat, siteLon);
  const v = unit(lat, lon);
  const d = [0, 1, 2].map((k) => MOON_R_KM * (v[k] - u[k]));
  const la = siteLat * RAD;
  const lo = siteLon * RAD;
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return { east: dot(d, east), north: dot(d, north) };
}

const clampGrid = (x: number) => Math.max(-2, Math.min(2, Math.round(x)));

function describe(dx: number, dy: number) {
  if (dx === 0 && dy === 0) return "site centre";
  const parts = [];
  if (dx) parts.push(`${Math.abs(dx)} km ${dx > 0 ? "E" : "W"}`);
  if (dy) parts.push(`${Math.abs(dy)} km ${dy > 0 ? "N" : "S"}`);
  return parts.join(", ");
}

export function findPoint(lat: number, lon: number): PointMatch {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { kind: "invalid", reason: "Enter numbers for latitude and longitude." };
  if (lat < -90 || lat > 90) return { kind: "invalid", reason: "Latitude must be between -90 and 90 (south is negative)." };
  if (lon < -180 || lon > 360) return { kind: "invalid", reason: "Longitude must be between -180 and 360." };
  if (lat > POLE_LIMIT_LAT)
    return { kind: "outside", reason: `MoonScope's terrain covers the south pole only (south of ${Math.abs(POLE_LIMIT_LAT)}\u00B0S). Use a negative latitude such as -85.9.` };

  let best: { siteIdx: number; dx: number; dy: number; dist: number; centreKm: number } | null = null;
  SITES.forEach((s, i) => {
    const { east, north } = offsetKm(s.lat, s.lon, lat, lon);
    const dx = clampGrid(east);
    const dy = clampGrid(north);
    const dist = Math.hypot(east - dx, north - dy);
    if (!best || dist < best.dist) best = { siteIdx: i, dx, dy, dist, centreKm: Math.hypot(east, north) };
  });
  const b = best!;
  if (b.dist > SNAP_KM) return { kind: "far", siteIdx: b.siteIdx, distanceKm: b.centreKm };
  return {
    kind: "snapped",
    siteIdx: b.siteIdx,
    dxKm: b.dx,
    dyKm: b.dy,
    distanceKm: b.dist,
    label: `${SITES[b.siteIdx].name}, ${describe(b.dx, b.dy)}`,
  };
}