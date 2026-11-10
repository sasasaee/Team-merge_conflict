// Real NASA-based site data (R2 pipeline output): web/public/data/<id>.json -> SiteData.
// Pure logic, no React. Rules are the same as pipeline/illumination.py.
import { SiteDataSchema } from "./schemas";
import type { EarthLink, SiteData } from "./types";

export const DNA_HOURS = 24 * 28; // Shadow DNA window: first lunar month after landing (same as the pipeline's dna)
export const MIN_REAL_HOURS = DNA_HOURS; // a real file shorter than this is rejected
const RELIABLE_DEG = 2.5; // Earth must be this far above the ridge for a reliable link

export type SiteFile = {
  grid?: { dx_km: number; dy_km: number; horizon: number[] }[];
  sun_az?: number[];
  sun_el?: number[];
  earth_az?: number[];
  earth_el?: number[];
};

// Ridge height in direction az: horizon[round(az) % 360]. Returns null if the file is missing fields or fails the schema.
export function siteDataFromFile(f: SiteFile): SiteData | null {
  const centre = f.grid?.find((g) => g.dx_km === 0 && g.dy_km === 0);
  if (!centre || !f.sun_az || !f.sun_el || !f.earth_az || !f.earth_el) return null;
  const n = Math.min(f.sun_az.length, f.sun_el.length, f.earth_az.length, f.earth_el.length);
  if (n < MIN_REAL_HOURS) return null;

  const raw: SiteData = {
    horizon: centre.horizon,
    sunAz: f.sun_az.slice(0, n),
    sunEl: f.sun_el.slice(0, n),
    earthAz: f.earth_az.slice(0, n),
    earthEl: f.earth_el.slice(0, n),
    lit: [],
    earth: [],
  };
  const d = withHorizon(raw, centre.horizon);
  d.grid = f.grid!.map((g) => ({ dxKm: g.dx_km, dyKm: g.dy_km, horizon: g.horizon }));
  return SiteDataSchema.safeParse(d).success ? d : null;
}

// Why a site file cannot be used (null = it is fine). Same checks as siteDataFromFile, in words a person can act on.
export function explainSiteFile(f: SiteFile): string | null {
  if (!f || typeof f !== "object") return "the file is not a JSON object";
  const missing = (["sun_az", "sun_el", "earth_az", "earth_el", "grid"] as const).filter((k) => !Array.isArray(f[k]));
  if (missing.length) return `it has no ${missing.join(", ")} field${missing.length > 1 ? "s" : ""}`;
  if (!f.grid!.some((g) => g.dx_km === 0 && g.dy_km === 0)) return "its grid has no centre point (dx_km 0, dy_km 0)";
  const n = Math.min(f.sun_az!.length, f.sun_el!.length, f.earth_az!.length, f.earth_el!.length);
  if (n < MIN_REAL_HOURS) return `it holds only ${n} hours; at least ${MIN_REAL_HOURS} (28 days) are needed`;
  if (siteDataFromFile(f) === null) return "some values have the wrong type or length (for example a horizon without 360 numbers)";
  return null;
}

// Same Sun and Earth positions, different mountains: rebuilds the lit and Earth-link arrays for another horizon.
// Used for the real site (centre horizon) and for the "Move N km" what-ifs (a nearby grid point).
export function withHorizon(base: SiteData, horizon: number[]): SiteData {
  const ridge = (az: number) => horizon[Math.round(az) % 360];
  const lit: boolean[] = [];
  const earth: EarthLink[] = [];
  for (let h = 0; h < base.sunAz.length; h++) {
    lit.push(base.sunEl[h] > ridge(base.sunAz[h]));
    const margin = base.earthEl[h] - ridge(base.earthAz[h]);
    earth.push(margin > RELIABLE_DEG ? "ok" : margin > 0 ? "weak" : "lost");
  }
  return { ...base, horizon, grid: undefined, lit, earth };
}