// What-if scenarios: the current plan with one or more changes applied.
import { simulate } from "./simulate";
import type { MissionParams, SimResult } from "./types";

export const MAX_SCENARIOS = 4;

export type Scenario = {
  id: string;
  label: string;
  delayH: number;    // shift the landing time (negative = earlier)
  effScale: number;  // 0.8 = panels 20% weaker
  commScale: number; // 2 = need twice the daily Earth contact
  loadScale: number; // 1.5 = lander uses 50% more power
  moveEastKm?: number;  // move the lander this far east (negative = west), whole km -2..2. Real data only.
  moveNorthKm?: number; // move the lander this far north (negative = south), whole km -2..2. Real data only.
};

const base = { delayH: 0, effScale: 1, commScale: 1, loadScale: 1 };

export const PRESETS: Scenario[] = [
  { ...base, id: "early",   label: "Land 24 h earlier",    delayH: -24  },
  { ...base, id: "delay1",  label: "Delay 1 day",          delayH:  24  },
  { ...base, id: "delay5",  label: "Delay 5 days",         delayH:  120 },
  { ...base, id: "panels",  label: "Panels 20% weaker",    effScale: 0.8 },
  { ...base, id: "contact", label: "Need 2x contact time", commScale: 2 },
  { ...base, id: "power",   label: "Use 50% more power",   loadScale: 1.5 },
  { ...base, id: "east2",   label: "Move 2 km east",       moveEastKm: 2 },
];

/**
 * Build a custom scenario from slider values.
 * loadScale defaults to 1 (unchanged) so existing callers that don't expose
 * the power-draw slider continue to work without modification.
 */
export function customScenario(
  delayDays: number,
  panelPct: number,
  commScale: number,
  loadScale = 1,
  moveEastKm = 0,
  moveNorthKm = 0,
): Scenario {
  const parts: string[] = [];
  const d = Math.abs(delayDays);
  if (delayDays !== 0) parts.push(`land ${d} day${d > 1 ? "s" : ""} ${delayDays > 0 ? "later" : "earlier"}`);
  if (panelPct !== 100) parts.push(`panels ${panelPct}%`);
  if (commScale !== 1) parts.push(`${commScale}x contact`);
  if (loadScale !== 1) parts.push(`${loadScale}x power draw`);
  if (moveEastKm !== 0) parts.push(`move ${Math.abs(moveEastKm)} km ${moveEastKm > 0 ? "east" : "west"}`);
  if (moveNorthKm !== 0) parts.push(`move ${Math.abs(moveNorthKm)} km ${moveNorthKm > 0 ? "north" : "south"}`);
  const text = parts.join(", ");
  const label = text ? text[0].toUpperCase() + text.slice(1) : "Same as plan";
  return {
    ...base,
    id: `custom:${delayDays}:${panelPct}:${commScale}:${loadScale}${moveEastKm || moveNorthKm ? `:e${moveEastKm}n${moveNorthKm}` : ""}`,
    label,
    delayH: delayDays * 24,
    effScale: panelPct / 100,
    commScale,
    loadScale,
    moveEastKm,
    moveNorthKm,
  };
}

/**
 * Run a scenario against a base mission.
 * The original params object is NEVER mutated — a fresh copy is built each time.
 * commHoursReq is clamped to 24 h/day (physical maximum).
 */
export function runScenario(p: MissionParams, sc: Scenario): SimResult {
  const commScale = Number.isFinite(sc.commScale) && sc.commScale > 0 ? sc.commScale : 1;
  const loadScale = Number.isFinite(sc.loadScale) && sc.loadScale > 0 ? sc.loadScale : 1;
  const effScale = Number.isFinite(sc.effScale) && sc.effScale >= 0 ? sc.effScale : 1;
  const delayH = Number.isFinite(sc.delayH) ? Math.round(sc.delayH) : 0;

  const changed: MissionParams = {
    ...p,
    commHoursReq: Math.max(0, Math.min(24, Math.round(p.commHoursReq * commScale))),
    loadKw: Math.max(0.1, p.loadKw * loadScale),
  };
  // Moving uses the pipeline's grid of nearby points (whole km, at most 2 km each way)
  const gridKm = (v: number | undefined) => (Number.isFinite(v) ? Math.max(-2, Math.min(2, Math.round(v as number))) : 0);
  const dxKm = gridKm(sc.moveEastKm);
  const dyKm = gridKm(sc.moveNorthKm);
  return simulate(changed, delayH, effScale, dxKm !== 0 || dyKm !== 0 ? { dxKm, dyKm } : undefined);
}
