// Site data. Real NASA-based JSON (web/public/data/<id>.json) when all sites load, otherwise the sample data below.
import { siteDataFromFile, withHorizon } from "./realSites";
import type { SiteData } from "./types";

// Number of hours the site arrays hold: 672 (28 days) for the sample data, the length of the real files otherwise
// (8,760 h = one year from the planned landing). Set by loadRealSites() before the app renders.
export let HOURS = 24 * 28;

export const SITES = [
  { id: "malapert", name: "Malapert Massif" },
  { id: "mons-mouton", name: "Mons Mouton" },
  { id: "nobile-rim-1", name: "Nobile Rim 1" },
  { id: "haworth", name: "Haworth" },
  { id: "de-gerlache-rim-2", name: "de Gerlache Rim 2" },
  { id: "mons-mouton-plateau", name: "Mons Mouton Plateau" },
  { id: "nobile-rim-2", name: "Nobile Rim 2" },
  { id: "peak-near-cabeus-b", name: "Peak near Cabeus B" },
  { id: "slater-plain", name: "Slater Plain" },
] as const;

const PROFILES = [
  { sunMean: 0.6, hBase: 0.3, hAmp: 0.9, earthMean: 7 },
  { sunMean: 0.6, hBase: 0.1, hAmp: 0.6, earthMean: 7 },
  { sunMean: 0.6, hBase: 0.1, hAmp: 1.2, earthMean: 6 },
  { sunMean: 0.6, hBase: 0.1, hAmp: 0.9, earthMean: 7 },
  { sunMean: 0.6, hBase: 0.1, hAmp: 0.6, earthMean: 7 },
];

const RAD = Math.PI / 180;
const cache = new Map<number, SiteData>();
const moved = new Map<string, SiteData>();
let real: SiteData[] | null = null;

export const usingRealData = () => real !== null;

// Call once before rendering. All-or-nothing: if any site file is missing or invalid, every site keeps the sample data.
export async function loadRealSites(baseUrl = "/"): Promise<boolean> {
  try {
    const all = await Promise.all(
      SITES.map(async (s) => {
        const r = await fetch(`${baseUrl}data/${s.id}.json`);
        return r.ok ? siteDataFromFile(await r.json()) : null;
      }),
    );
    if (all.some((x) => x === null)) throw new Error("a site file is missing or invalid");
    real = all as SiteData[];
    HOURS = Math.min(...real.map((x) => x.lit.length));
    cache.clear();
    moved.clear();
    return true;
  } catch (e) {
    console.warn("Real site data not loaded, using sample data:", e);
    real = null;
    HOURS = 24 * 28;
    return false;
  }
}

// The site as seen from a point dxKm east and dyKm north of it (whole km, -2..2). Real data only: the pipeline stores a
// 5x5 grid of horizons per site. Without a grid, or for a point that is not on it, this is the site itself.
export function getSiteAt(i: number, dxKm = 0, dyKm = 0): SiteData {
  const base = getSite(i);
  if ((dxKm === 0 && dyKm === 0) || !base.grid) return base;
  const point = base.grid.find((g) => g.dxKm === dxKm && g.dyKm === dyKm);
  if (!point) return base;
  const key = `${i}:${dxKm}:${dyKm}`;
  let hit = moved.get(key);
  if (!hit) {
    hit = withHorizon(base, point.horizon);
    moved.set(key, hit);
  }
  return hit;
}

export const wrapHour = (h: number) => ((h % HOURS) + HOURS) % HOURS;

export function getSite(i: number): SiteData {
  if (real) return real[i];
  const hit = cache.get(i);
  if (hit) return hit;

  const p = PROFILES[i % PROFILES.length]; // sample data only (used when the real files are missing)
  const horizon = Array.from(
    { length: 360 },
    (_, a) => p.hBase + p.hAmp * Math.abs(Math.sin((a + i * 37) * 2 * RAD)) + 0.5 * Math.sin((a * 5 + i * 23) * RAD) ** 2,
  );
  const hz = (az: number) => horizon[Math.round(az) % 360];
  const d: SiteData = { horizon, sunAz: [], sunEl: [], earthAz: [], earthEl: [], lit: [], earth: [] };

  for (let h = 0; h < HOURS; h++) {
    const month = (2 * Math.PI * h) / (27.3 * 24);
    const sunAz = ((h / (29.5 * 24)) * 360 + i * 40) % 360;
    const sunEl = p.sunMean + 1.2 * Math.sin(month + i * 0.9) + 0.3 * Math.sin((2 * Math.PI * h) / (5 * 24) + i);
    const earthAz = (180 + i * 12 + 8 * Math.sin(month) + 360) % 360;
    const earthEl = p.earthMean + 4.5 * Math.sin(month + i * 0.7 + 1.2);
    const margin = earthEl - hz(earthAz);

    d.sunAz.push(sunAz);
    d.sunEl.push(sunEl);
    d.earthAz.push(earthAz);
    d.earthEl.push(earthEl);
    d.lit.push(sunEl > hz(sunAz));
    d.earth.push(margin > 2.5 ? "ok" : margin > 0 ? "weak" : "lost");
  }

  cache.set(i, d);
  return d;
}