// Real NASA-based sky for each site (R2 pipeline output): web/public/data/<id>.json
import { useEffect, useState } from "react";
import type { EarthLink } from "./types";
import { SITES } from "./sites";

export const DNA_HOURS = 24 * 28; // first lunar month after landing, same window as the pipeline's dna
const RELIABLE_DEG = 2.5; // Earth must be this far above the ridge for a reliable link

type SiteFile = {
  grid?: { dx_km: number; dy_km: number; horizon: number[] }[];
  sun_az?: number[];
  sun_el?: number[];
  earth_az?: number[];
  earth_el?: number[];
};

export type RealSky = { lit: boolean[]; earth: EarthLink[] };

// Same rules as pipeline/illumination.py: ridge = horizon[round(az) % 360]
export function skyFromFile(f: SiteFile, hours = DNA_HOURS): RealSky | null {
  const centre = f.grid?.find((g) => g.dx_km === 0 && g.dy_km === 0);
  if (!centre || centre.horizon.length !== 360 || !f.sun_az || !f.sun_el || !f.earth_az || !f.earth_el) return null;
  const ridge = (az: number) => centre.horizon[Math.round(az) % 360];
  const n = Math.min(hours, f.sun_el.length, f.earth_el.length);
  const lit: boolean[] = [];
  const earth: EarthLink[] = [];
  for (let h = 0; h < n; h++) {
    lit.push(f.sun_el[h] > ridge(f.sun_az[h]));
    const margin = f.earth_el[h] - ridge(f.earth_az[h]);
    earth.push(margin > RELIABLE_DEG ? "ok" : margin > 0 ? "weak" : "lost");
  }
  return { lit, earth };
}

// One entry per site in SITES order; null = file missing or unreadable. The whole result is null while loading.
export function useRealSky(): (RealSky | null)[] | null {
  const [sky, setSky] = useState<(RealSky | null)[] | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(
      SITES.map((s) =>
        fetch(`${import.meta.env.BASE_URL}data/${s.id}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((f) => (f ? skyFromFile(f) : null))
          .catch(() => null),
      ),
    ).then((all) => alive && setSky(all));
    return () => {
      alive = false;
    };
  }, []);
  return sky;
}
