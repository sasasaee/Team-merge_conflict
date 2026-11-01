// SAMPLE DATA FOR DESIGN ONLY. R1 and R2 replace getSite() with real NASA-based JSON.
import type { SiteData } from "./types";

export const HOURS = 24 * 28;

export const SITES = [
  { id: "malapert", name: "Malapert Massif" },
  { id: "mons-mouton", name: "Mons Mouton" },
  { id: "nobile-rim-1", name: "Nobile Rim 1" },
  { id: "haworth", name: "Haworth" },
  { id: "de-gerlache-rim-2", name: "de Gerlache Rim 2" },
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

export const wrapHour = (h: number) => ((h % HOURS) + HOURS) % HOURS;

export function getSite(i: number): SiteData {
  const hit = cache.get(i);
  if (hit) return hit;

  const p = PROFILES[i];
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