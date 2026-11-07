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

  const horizon = centre.horizon;
  const ridge = (az: number) => horizon[Math.round(az) % 360];
  const d: SiteData = { horizon, sunAz: [], sunEl: [], earthAz: [], earthEl: [], lit: [], earth: [] };
  for (let h = 0; h < n; h++) {
    d.sunAz.push(f.sun_az[h]);
    d.sunEl.push(f.sun_el[h]);
    d.earthAz.push(f.earth_az[h]);
    d.earthEl.push(f.earth_el[h]);
    d.lit.push(f.sun_el[h] > ridge(f.sun_az[h]));
    const margin = f.earth_el[h] - ridge(f.earth_az[h]);
    const link: EarthLink = margin > RELIABLE_DEG ? "ok" : margin > 0 ? "weak" : "lost";
    d.earth.push(link);
  }
  return SiteDataSchema.safeParse(d).success ? d : null;
}
