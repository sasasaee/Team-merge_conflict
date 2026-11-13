// Site data. Real NASA-based JSON (web/public/data/<id>.json) when all sites load, otherwise the sample data below.
import { explainSiteFile, siteDataFromFile, withHorizon, type SiteFile } from "./realSites";
import type { SiteData } from "./types";

// Number of hours the site arrays hold: 672 (28 days) for the sample data, the length of the real files otherwise
// (8,760 h = one year from the planned landing). Set by loadRealSites() before the app renders.
export let HOURS = 24 * 28;

// lat/lon: planetocentric degrees (east-positive) of each site point, the same values as in web/public/data/<id>.json
export const SITES = [
  { id: "malapert", name: "Malapert Massif", lat: -85.9671, lon: -2.2659 },
  { id: "mons-mouton", name: "Mons Mouton", lat: -84.3884, lon: 30.8775 },
  { id: "nobile-rim-1", name: "Nobile Rim 1", lat: -85.2283, lon: 36.5736 },
  { id: "haworth", name: "Haworth", lat: -86.9338, lon: -23.0496 },
  { id: "de-gerlache-rim-2", name: "de Gerlache Rim 2", lat: -88.3732, lon: -69.1712 },
  { id: "mons-mouton-plateau", name: "Mons Mouton Plateau", lat: -84.1899, lon: 28.9515 },
  { id: "nobile-rim-2", name: "Nobile Rim 2", lat: -84.0506, lon: 59.2629 },
  { id: "peak-near-cabeus-b", name: "Peak near Cabeus B", lat: -85.594, lon: -67.0533 },
  { id: "slater-plain", name: "Slater Plain", lat: -87.4356, lon: 113.6979 },
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

// What went wrong while loading the real data, per site: the cause and how to fix it. Empty when all files loaded.
export type DataProblem = { site: string; file: string; cause: string; fix: string };
let problems: DataProblem[] = [];
export const dataProblems = () => problems;

const PIPELINE_FIX = "Run pipeline/run_all.bat again (it writes web/public/data/<site>.json), then reload the page.";

async function loadOne(baseUrl: string, id: string, name: string): Promise<SiteData | DataProblem> {
  const file = `web/public/data/${id}.json`;
  let r: Response;
  try {
    r = await fetch(`${baseUrl}data/${id}.json`);
  } catch {
    return { site: name, file, cause: "The browser could not reach the server to download the file.", fix: "Check that pnpm dev (or the live site) is running and you are online, then reload." };
  }
  if (r.status === 404) return { site: name, file, cause: "The file does not exist.", fix: `Add ${file}. ${PIPELINE_FIX}` };
  if (!r.ok) return { site: name, file, cause: `The server answered ${r.status} ${r.statusText}.`, fix: "Reload the page. If it keeps happening, restart pnpm dev." };
  let json: SiteFile;
  try {
    json = await r.json();
  } catch {
    return { site: name, file, cause: "The file is not valid JSON (it may be cut off or half-written).", fix: PIPELINE_FIX };
  }
  const why = explainSiteFile(json);
  if (why) return { site: name, file, cause: `The file is in the wrong format: ${why}.`, fix: `${PIPELINE_FIX} The expected format is in docs/METHOD.md.` };
  return siteDataFromFile(json)!;
}

// Call once before rendering. All-or-nothing: if any site file is missing or invalid, every site keeps the sample data,
// and dataProblems() says which files failed, why, and how to fix them.
export async function loadRealSites(baseUrl = "/"): Promise<boolean> {
  try {
    const all = await Promise.all(SITES.map((s) => loadOne(baseUrl, s.id, s.name)));
    problems = all.filter((x): x is DataProblem => "cause" in x);
    if (problems.length) throw new Error(`${problems.length} site file(s) could not be used`);
    real = all as SiteData[];
    HOURS = Math.min(...real.map((x) => x.lit.length));
    cache.clear();
    moved.clear();
    return true;
  } catch (e) {
    if (!problems.length) {
      problems = [{ site: "All sites", file: "web/public/data", cause: `Unexpected error: ${e instanceof Error ? e.message : String(e)}.`, fix: "Reload the page. If it keeps happening, send this message to the team." }];
    }
    console.warn("Real site data not loaded, using sample data:", problems);
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

// The data for the plan's landing point: the custom grid point when one is set for this site, otherwise the site itself.
export function siteFor(p: { siteIdx: number; point?: { siteIdx: number; dxKm: number; dyKm: number } }): SiteData {
  const pt = p.point && p.point.siteIdx === p.siteIdx ? p.point : null;
  return pt ? getSiteAt(p.siteIdx, pt.dxKm, pt.dyKm) : getSite(p.siteIdx);
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