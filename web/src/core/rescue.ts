// Rescue Mode: a short real-time game built on the same site data as the planner.
import { getSite, wrapHour } from "./sites";
import type { MissionParams } from "./types";

export const RESCUE_HOURS = 72;
// The game's lander is fixed hardware, so changing the planner's battery or power settings cannot make the game trivial.
export const RESCUE_HARDWARE = { batteryKwh: 120, loadKw: 1.8, panelEff: 0.29 } as const;
const PANEL_KW = 10 * 1.361;

export type Crisis = { id: string; title: string; story: string; effScale: number; extraLoadKw: number; delayH: number };

export const CRISES: Crisis[] = [
  { id: "dust", title: "Dust storm", story: "Landing kicked up dust that coated the solar panels. They now make 30% less power.", effScale: 0.7, extraLoadKw: 0, delayH: 0 },
  { id: "late", title: "Late landing", story: "The landing slipped by two days. The lander arrived just as a long shadow begins.", effScale: 1, extraLoadKw: 0, delayH: 48 },
  { id: "heater", title: "Stuck heater", story: "A heater is stuck on and draws an extra 0.8 kW from the battery.", effScale: 1, extraLoadKw: 0.8, delayH: 0 },
];

export type Move = "drive" | "instruments" | "hibernate" | "tilt";

export const MOVES: Record<Move, { label: string; detail: string }> = {
  drive: { label: "Drive 1 km toward sunlight", detail: "Reach higher ground with more sun. Costs 2 h and 4 kWh. Up to 3 times." },
  instruments: { label: "Switch off instruments", detail: "Cuts power use by 40%, but pauses science." },
  hibernate: { label: "Hibernate for 6 h", detail: "Power use drops to 0.4 kW. No science, no contact." },
  tilt: { label: "Tilt panels to the Sun", detail: "Panels make 15% more power. Once only." },
};

export type LogLine = { t: number; tone: "ok" | "warn" | "fail" | "muted"; text: string };

export type RescueState = {
  crisis: Crisis;
  startH: number; // hour in the site data where the game begins (just before sunset)
  params: MissionParams;
  t: number;
  soc: number;
  effScale: number;
  horizonDrop: number;
  drives: number;
  instrumentsOff: boolean;
  tilted: boolean;
  hibernateUntil: number;
  scienceH: number;
  status: "running" | "saved" | "lost";
  log: LogLine[];
};

// The game starts 3 hours before the longest night in the month after the (possibly delayed) landing,
// so every site gets a real challenge (a short night is too easy to survive, a long one needs good moves).
function findSunset(params: MissionParams, crisis: Crisis) {
  const site = getSite(params.siteIdx);
  const from = params.delayH + crisis.delayH;
  const window = 24 * 28;
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let k = 1; k <= window; k++) {
    const dark = !site.lit[wrapHour(from + k)];
    if (dark && runStart < 0 && site.lit[wrapHour(from + k - 1)]) runStart = k;
    if ((!dark || k === window) && runStart >= 0) {
      const len = (dark ? k + 1 : k) - runStart;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }
  return bestStart > 0 ? from + bestStart - 3 : from;
}

export function startRescue(crisis: Crisis, params: MissionParams): RescueState {
  return {
    crisis,
    startH: findSunset(params, crisis),
    params,
    t: 0,
    soc: params.batteryKwh * 0.35,
    effScale: crisis.effScale,
    horizonDrop: 0,
    drives: 0,
    instrumentsOff: false,
    tilted: false,
    hibernateUntil: -1,
    scienceH: 0,
    status: "running",
    log: [{ t: 0, tone: "fail", text: `${crisis.title}. ${crisis.story}` }],
  };
}

function loadKw(s: RescueState, t: number) {
  if (t < s.hibernateUntil) return 0.4;
  const base = s.params.loadKw + s.crisis.extraLoadKw;
  return s.instrumentsOff ? base * 0.6 : base;
}

export function isLit(s: RescueState, t: number) {
  const site = getSite(s.params.siteIdx);
  const h = wrapHour(s.startH + t);
  return site.sunEl[h] > site.horizon[Math.round(site.sunAz[h]) % 360] - s.horizonDrop;
}

function hourStep(s: RescueState): RescueState {
  const lit = isLit(s, s.t);
  const charge = lit ? PANEL_KW * s.params.panelEff * s.effScale : 0;
  const soc = Math.min(s.params.batteryKwh, s.soc + charge - loadKw(s, s.t));
  const science = s.t >= s.hibernateUntil && !s.instrumentsOff ? 1 : 0;
  return { ...s, t: s.t + 1, soc, scienceH: s.scienceH + science };
}

// Advance the game clock by one hour and check win/lose
export function tick(s: RescueState): RescueState {
  if (s.status !== "running") return s;
  const wasLit = isLit(s, s.t);
  let n = hourStep(s);
  const log = [...n.log];
  if (isLit(n, n.t) !== wasLit) {
    log.push(isLit(n, n.t) ? { t: n.t, tone: "ok", text: "Sun clears the ridge. Charging." } : { t: n.t, tone: "warn", text: "Shadow falls over the lander." });
  }
  if (n.t === n.hibernateUntil) log.push({ t: n.t, tone: "muted", text: "Waking up from hibernation." });
  if (n.soc <= 0) {
    n = { ...n, soc: 0, status: "lost" };
    log.push({ t: n.t, tone: "fail", text: "Battery empty. Mission lost." });
  } else if (n.t >= RESCUE_HOURS) {
    n = { ...n, status: "saved" };
    log.push({ t: n.t, tone: "ok", text: "The lander made it through. Mission saved." });
  }
  return { ...n, log };
}

export function canMove(s: RescueState, m: Move) {
  if (s.status !== "running") return false;
  if (m === "drive") return s.drives < 3;
  if (m === "tilt") return !s.tilted;
  if (m === "hibernate") return s.t >= s.hibernateUntil;
  return true;
}

export function applyMove(s: RescueState, m: Move): RescueState {
  if (!canMove(s, m)) return s;
  const log = [...s.log];
  let n = { ...s };
  if (m === "drive") {
    n = { ...n, drives: n.drives + 1, horizonDrop: n.horizonDrop + 0.1, soc: n.soc - 4 };
    log.push({ t: n.t, tone: "ok", text: `Drove 1 km toward the light (${n.drives}/3). Horizon is lower.` });
    n = hourStep(hourStep({ ...n, log }));
    return { ...n, log };
  }
  if (m === "instruments") {
    n.instrumentsOff = !n.instrumentsOff;
    log.push({ t: n.t, tone: "muted", text: n.instrumentsOff ? "Instruments off. Saving power." : "Instruments back on. Science resumed." });
  }
  if (m === "hibernate") {
    n.hibernateUntil = n.t + 6;
    log.push({ t: n.t, tone: "muted", text: "Hibernating for 6 hours." });
  }
  if (m === "tilt") {
    n = { ...n, tilted: true, effScale: n.effScale * 1.15 };
    log.push({ t: n.t, tone: "ok", text: "Panels tilted toward the Sun." });
  }
  return { ...n, log };
}

// How many hours until the battery runs out if nothing else changes
export function hoursLeft(s: RescueState): number | null {
  let x = { ...s, log: [] as LogLine[] };
  while (x.t < RESCUE_HOURS) {
    x = hourStep(x);
    if (x.soc <= 0) return x.t - s.t;
  }
  return null;
}