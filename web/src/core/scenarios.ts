// What-if scenarios: the current plan with one or more changes applied.
import { simulate } from "./simulate";
import type { MissionParams, SimResult } from "./types";

export const MAX_SCENARIOS = 4;

export type Scenario = {
  id: string;
  label: string;
  delayH: number; // shift the landing time (negative = earlier)
  effScale: number; // 0.8 = panels 20% weaker
  commScale: number; // 2 = need twice the daily Earth contact
  loadScale: number; // 1.5 = lander uses 50% more power
};

const base = { delayH: 0, effScale: 1, commScale: 1, loadScale: 1 };

export const PRESETS: Scenario[] = [
  { ...base, id: "early", label: "Land 24 h earlier", delayH: -24 },
  { ...base, id: "delay1", label: "Delay 1 day", delayH: 24 },
  { ...base, id: "delay5", label: "Delay 5 days", delayH: 120 },
  { ...base, id: "panels", label: "Panels 20% weaker", effScale: 0.8 },
  { ...base, id: "contact", label: "Need 2x contact time", commScale: 2 },
  { ...base, id: "power", label: "Use 50% more power", loadScale: 1.5 },
];

// Custom scenario from the sliders, with a readable label
export function customScenario(delayDays: number, panelPct: number, commScale: number): Scenario {
  const parts: string[] = [];
  const d = Math.abs(delayDays);
  if (delayDays !== 0) parts.push(`land ${d} day${d > 1 ? "s" : ""} ${delayDays > 0 ? "later" : "earlier"}`);
  if (panelPct !== 100) parts.push(`panels ${panelPct}%`);
  if (commScale !== 1) parts.push(`${commScale}x contact`);
  const text = parts.join(", ");
  const label = text ? text[0].toUpperCase() + text.slice(1) : "Same as plan";
  return { ...base, id: `custom:${delayDays}:${panelPct}:${commScale}`, label, delayH: delayDays * 24, effScale: panelPct / 100, commScale };
}

export function runScenario(p: MissionParams, sc: Scenario): SimResult {
  const changed = { ...p, commHoursReq: Math.min(24, p.commHoursReq * sc.commScale), loadKw: p.loadKw * sc.loadScale };
  return simulate(changed, sc.delayH, sc.effScale);
}